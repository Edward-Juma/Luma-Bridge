import { AlertSeverity, VerificationStatus } from '@prisma/client';
import { prisma } from '../db';
import { bump } from './cache';
import { HttpError } from './errors';

export interface RiskReason {
  code: string;
  weight: number;
  detail: string;
}

export interface RiskResult {
  score: number;
  reasons: RiskReason[];
}

function severityFor(score: number): AlertSeverity {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Computes a 0–100 risk score for a beneficiary from objective signals.
 * Persisted on the profile and surfaced to auditors with the reasons – never auto-rejects.
 */
export async function scoreBeneficiary(beneficiaryId: string): Promise<RiskResult> {
  const b = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    include: {
      user: { select: { signupIp: true, lastIp: true } },
      documents: true,
      needs: { include: { reports: { where: { status: { in: ['OPEN', 'REVIEWING'] } } } } },
    },
  });
  if (!b) return { score: 0, reasons: [] };

  const reasons: RiskReason[] = [];
  const add = (code: string, weight: number, detail: string) =>
    reasons.push({ code, weight, detail });

  // 1. Multiple beneficiary accounts from one signup IP
  if (b.user.signupIp) {
    const sameIp = await prisma.beneficiary.count({
      where: { id: { not: b.id }, user: { signupIp: b.user.signupIp } },
    });
    if (sameIp > 0) {
      add('SHARED_IP', Math.min(40, 20 * sameIp), `${sameIp} other beneficiary account(s) registered from the same IP.`);
    }
  }

  // 2. Same document file used by another person
  const hashes = b.documents.map((d) => d.sha256);
  if (hashes.length) {
    const dupes = await prisma.document.findMany({
      where: { sha256: { in: hashes }, beneficiaryId: { not: b.id } },
      select: { beneficiaryId: true },
    });
    const owners = new Set(dupes.map((d) => d.beneficiaryId));
    if (owners.size > 0) {
      add('DUPLICATE_DOCUMENT', 45, `An identical document file was uploaded by ${owners.size} other profile(s).`);
    }
  }

  // 3. Low AI authenticity scores
  const lowAi = b.documents.filter((d) => d.aiScore !== null && d.aiScore < 0.5);
  if (lowAi.length) {
    add('LOW_DOCUMENT_CONFIDENCE', Math.min(30, 15 * lowAi.length), `${lowAi.length} document(s) scored below 0.5 on automated authenticity checks.`);
  }

  // 4. Missing identity document
  if (!b.documents.some((d) => d.kind === 'IDENTITY' || d.kind === 'GOVERNMENT_DOCUMENT')) {
    add('NO_IDENTITY_DOCUMENT', 15, 'No identity or government document has been uploaded.');
  }

  // 5. Emergency contact == self, or shared with another profile
  if (b.emergencyContactPhone.replace(/\D/g, '') === b.phone.replace(/\D/g, '')) {
    add('SELF_AS_CONTACT', 25, 'Emergency contact phone is the same as the applicant phone.');
  } else {
    const shared = await prisma.beneficiary.count({
      where: { id: { not: b.id }, emergencyContactPhone: b.emergencyContactPhone },
    });
    if (shared > 0) {
      add('SHARED_CONTACT', 20, `Emergency contact is also used by ${shared} other profile(s).`);
    }
  }

  // 6. Community reports
  const openReports = b.needs.reduce((n, need) => n + need.reports.length, 0);
  if (openReports > 0) {
    add('COMMUNITY_REPORTS', Math.min(30, 10 * openReports), `${openReports} unresolved community report(s).`);
  }

  // 7. Unusually large goals
  const maxGoal = b.needs.reduce((m, n) => Math.max(m, Number(n.goalUsd)), 0);
  if (maxGoal >= 50_000) add('VERY_LARGE_GOAL', 20, `Goal of $${maxGoal.toLocaleString()} is unusually high.`);
  else if (maxGoal >= 20_000) add('LARGE_GOAL', 10, `Goal of $${maxGoal.toLocaleString()} is above typical range.`);

  // 8. Placeholder-looking story text
  const lowEffort = b.needs.some((n) => n.story.trim().length < 200);
  if (lowEffort) add('THIN_STORY', 8, 'At least one story is very short and gives little to verify.');

  const score = Math.min(100, reasons.reduce((s, r) => s + r.weight, 0));

  await prisma.beneficiary.update({ where: { id: b.id }, data: { fraudScore: score } });

  if (score >= 40) {
    const existing = await prisma.fraudAlert.findFirst({
      where: { beneficiaryId: b.id, type: 'RISK_SCORE', resolved: false },
    });
    const data = { score, severity: severityFor(score), details: { reasons } as unknown as object };
    if (existing) {
      await prisma.fraudAlert.update({ where: { id: existing.id }, data });
    } else {
      await prisma.fraudAlert.create({
        data: { beneficiaryId: b.id, type: 'RISK_SCORE', ...data },
      });
    }
  }

  return { score, reasons };
}

/**
 * Real-time donation screening: velocity + card-testing patterns.
 * Throws 429 for clear abuse, otherwise records alerts for auditors.
 */
export async function screenDonation(args: {
  ip: string;
  needId: string;
  amountUsd: number;
  email?: string | null;
}): Promise<{ flagged: boolean }> {
  const perIp = await bump(`don:ip:${args.ip}`, 3600);
  if (perIp > 15) {
    throw new HttpError(429, 'Too many donation attempts from your network. Please try again later.', 'rate_limited');
  }

  // Card-testing signature: many tiny attempts in 10 minutes
  const burst = await bump(`don:burst:${args.ip}`, 600);
  const tiny = args.amountUsd < 3;
  let flagged = false;

  if (burst > 6 && tiny) {
    flagged = true;
    await prisma.fraudAlert.create({
      data: {
        needId: args.needId,
        type: 'CARD_TESTING_PATTERN',
        severity: 'HIGH',
        score: 70,
        details: { ip: args.ip, attemptsIn10Min: burst, amountUsd: args.amountUsd },
      },
    });
    throw new HttpError(429, 'Unusual activity detected. Please try again later.', 'rate_limited');
  }

  if (args.amountUsd >= 5000) {
    flagged = true;
    await prisma.fraudAlert.create({
      data: {
        needId: args.needId,
        type: 'LARGE_DONATION',
        severity: 'MEDIUM',
        score: 40,
        details: { ip: args.ip, amountUsd: args.amountUsd },
      },
    });
  }

  return { flagged };
}

export function isPublic(status: VerificationStatus): boolean {
  return status === 'APPROVED';
}

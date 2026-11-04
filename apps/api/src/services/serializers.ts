import type { Beneficiary, Need } from '@prisma/client';

type NeedWithBeneficiary = Need & {
  beneficiary: Pick<
    Beneficiary,
    'fullName' | 'country' | 'city' | 'dateOfBirth' | 'gender' | 'photoUrl' | 'verificationId' | 'verifiedAt' | 'lastAuditAt'
  >;
};

export function ageFrom(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** First name + last initial only. Dignity first: we never publish full names of vulnerable people. */
export function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]}.`;
}

export function publicNeedCard(n: NeedWithBeneficiary) {
  const goal = Number(n.goalUsd);
  const raised = Number(n.raisedUsd);
  return {
    id: n.id,
    slug: n.slug,
    title: n.title,
    summary: n.summary,
    category: n.category,
    priority: n.priority,
    status: n.status,
    goalUsd: goal,
    raisedUsd: raised,
    percent: goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0,
    donationCount: n.donationCount,
    deadline: n.deadline,
    coverUrl: n.coverUrl ?? n.beneficiary.photoUrl,
    createdAt: n.createdAt,
    beneficiary: {
      name: displayName(n.beneficiary.fullName),
      age: ageFrom(n.beneficiary.dateOfBirth),
      gender: n.beneficiary.gender,
      country: n.beneficiary.country,
      city: n.beneficiary.city,
      photoUrl: n.beneficiary.photoUrl,
      verificationId: n.beneficiary.verificationId,
      verified: Boolean(n.beneficiary.verifiedAt),
    },
  };
}

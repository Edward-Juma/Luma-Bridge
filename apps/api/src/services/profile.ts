import { prisma } from '../db';

/** 0–100 completeness score shown on the beneficiary dashboard. */
export async function computeCompletion(beneficiaryId: string): Promise<number> {
  const b = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    include: {
      documents: { select: { kind: true } },
      paymentMethods: { select: { id: true } },
      needs: { select: { id: true, story: true, status: true } },
    },
  });
  if (!b) return 0;

  const checks: [boolean, number][] = [
    [true, 30], // core registration fields are mandatory, so a registered profile starts at 30
    [Boolean(b.photoUrl), 10],
    [b.documents.some((d) => d.kind === 'IDENTITY' || d.kind === 'GOVERNMENT_DOCUMENT'), 15],
    [b.documents.some((d) => d.kind !== 'IDENTITY' && d.kind !== 'GOVERNMENT_DOCUMENT'), 10],
    [b.paymentMethods.length > 0, 15],
    [b.needs.length > 0, 10],
    [b.needs.some((n) => n.status !== 'DRAFT'), 10],
  ];
  return checks.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
}

export async function refreshCompletion(beneficiaryId: string): Promise<number> {
  const pct = await computeCompletion(beneficiaryId);
  await prisma.beneficiary.update({ where: { id: beneficiaryId }, data: { profileCompletion: pct } });
  return pct;
}

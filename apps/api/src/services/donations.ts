import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { notify } from '../lib/audit';

/**
 * Marks a donation as succeeded and updates the need's totals in ONE transaction.
 * Idempotent: gateways retry webhooks, so confirming twice must not double count.
 */
export async function confirmDonation(donationId: string, gatewayRef?: string): Promise<boolean> {
  const result = await prisma.$transaction(
    async (tx) => {
      // Conditional update = row-level idempotency guard.
      const updated = await tx.donation.updateMany({
        where: { id: donationId, status: 'PENDING' },
        data: { status: 'SUCCEEDED', confirmedAt: new Date(), ...(gatewayRef ? { gatewayRef } : {}) },
      });
      if (updated.count === 0) return null;

      const donation = await tx.donation.findUniqueOrThrow({ where: { id: donationId } });
      const net = new Prisma.Decimal(donation.amountUsd).minus(donation.feeUsd);

      const need = await tx.need.update({
        where: { id: donation.needId },
        data: { raisedUsd: { increment: net }, donationCount: { increment: 1 } },
        include: { beneficiary: { select: { userId: true } } },
      });

      let funded = false;
      if (need.status === 'ACTIVE' && new Prisma.Decimal(need.raisedUsd).gte(need.goalUsd)) {
        await tx.need.update({ where: { id: need.id }, data: { status: 'FUNDED' } });
        funded = true;
      }
      return { donation, need, funded };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!result) return false;

  const { donation, need, funded } = result;
  const who = donation.anonymous ? 'An anonymous donor' : donation.donorName || 'A donor';
  await notify(
    need.beneficiary.userId,
    'You received a donation 💙',
    `${who} gave $${Number(donation.amountUsd).toFixed(2)} to "${need.title}".`,
  );
  if (funded) {
    await notify(need.beneficiary.userId, 'Goal reached 🎉', `"${need.title}" is fully funded. Thank you for sharing your story.`);
  }
  return true;
}

export async function failDonation(donationId: string): Promise<void> {
  await prisma.donation.updateMany({
    where: { id: donationId, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
}

/** Public-safe projection: anonymous donors never leak name/country/message/email/ip. */
export function publicDonation(d: {
  id: string;
  amount: Prisma.Decimal;
  currency: string;
  amountUsd: Prisma.Decimal;
  anonymous: boolean;
  donorName: string | null;
  donorCountry: string | null;
  message: string | null;
  createdAt: Date;
}) {
  return {
    id: d.id,
    amount: Number(d.amount),
    currency: d.currency,
    amountUsd: Number(d.amountUsd),
    anonymous: d.anonymous,
    donorName: d.anonymous ? 'Anonymous Donor' : d.donorName || 'Donor',
    donorCountry: d.anonymous ? null : d.donorCountry,
    message: d.anonymous ? null : d.message,
    createdAt: d.createdAt,
  };
}

/** Reverses a succeeded donation (refund / chargeback). Idempotent. */
export async function refundDonation(donationId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.donation.updateMany({
      where: { id: donationId, status: 'SUCCEEDED' },
      data: { status: 'REFUNDED' },
    });
    if (updated.count === 0) return false;
    const d = await tx.donation.findUniqueOrThrow({ where: { id: donationId } });
    const net = new Prisma.Decimal(d.amountUsd).minus(d.feeUsd);
    await tx.need.update({
      where: { id: d.needId },
      data: { raisedUsd: { decrement: net }, donationCount: { decrement: 1 } },
    });
    return true;
  });
}

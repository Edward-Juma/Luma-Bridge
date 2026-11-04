import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import { sendNotificationEmail } from './email';

interface AuditInput {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Append-only audit trail. Never throws – a logging failure must not break a request. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        meta: input.meta,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write log', err);
  }
}

export async function notify(userId: string, title: string, body: string): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, title, body } });
    if (env.RESEND_API_KEY) {
      void prisma.user
        .findUnique({ where: { id: userId }, select: { email: true } })
        .then((user) => user && sendNotificationEmail(user.email, title, body))
        .catch((err) => console.error('[notify] failed to send email', err));
    }
  } catch (err) {
    console.error('[notify] failed', err);
  }
}

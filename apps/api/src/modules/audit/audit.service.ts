import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type { Prisma } from '@bulava/database';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import type { RequestMeta } from '../../common/decorators/auth.decorators';

export interface AuditEntry {
  actorType: 'USER' | 'GUEST' | 'SYSTEM' | 'ANONYMOUS';
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  eventId?: string | null;
  result?: 'SUCCESS' | 'FAILURE';
  metadata?: Prisma.InputJsonValue;
  meta?: RequestMeta;
}

/**
 * Append-only audit trail: who, did what, to what, when, from where, result.
 * Pass `tx` to write the entry atomically with the change it describes.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    const data = {
      actorType: entry.actorType,
      actorId: entry.actorType === 'USER' ? (entry.actorId ?? null) : null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      eventId: entry.eventId ?? null,
      result: entry.result ?? 'SUCCESS',
      metadata: {
        ...(entry.actorType !== 'USER' && entry.actorId ? { actorRef: entry.actorId } : {}),
        ...((entry.metadata as object | undefined) ?? {}),
      },
      ipAddress: entry.meta?.ipAddress ?? null,
      userAgent: entry.meta?.userAgent ?? null,
    };
    if (tx) {
      await client.auditLog.create({ data });
      return;
    }
    // Outside a transaction an audit failure must not break the user action.
    try {
      await client.auditLog.create({ data });
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}

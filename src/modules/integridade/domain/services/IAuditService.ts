import { AuditLogEntry } from '../entities/AuditLogEntry.js';

export interface IAuditService {
  appendLog(
    entityType: string,
    entityId: string,
    action: string,
    actorId: string,
    payload: any
  ): Promise<AuditLogEntry>;
  verifyChain(fromTimestamp: Date): Promise<boolean>;
}

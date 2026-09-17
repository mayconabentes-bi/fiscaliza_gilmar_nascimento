import crypto from 'crypto';

export class AuditLogEntry {
  public readonly currentHash: string;

  constructor(
    public readonly id: string,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly action: string,
    public readonly previousHash: string,
    public readonly timestamp: Date,
    public readonly actorId: string,
    public readonly payload: string
  ) {
    this.currentHash = this.generateHash();
  }

  private generateHash(): string {
    const data = `${this.previousHash}${this.payload}${this.timestamp.toISOString()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

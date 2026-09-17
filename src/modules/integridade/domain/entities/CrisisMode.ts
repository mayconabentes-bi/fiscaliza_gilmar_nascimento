export enum CrisisStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

export class CrisisMode {
  constructor(
    public status: CrisisStatus,
    public triggerReason: string | null,
    public activatedAt: Date | null,
    public autoExpireAt: Date | null
  ) {}

  get isActive(): boolean {
    if (this.status !== CrisisStatus.ACTIVE) return false;
    if (this.autoExpireAt && new Date() > this.autoExpireAt) {
      return false;
    }
    return true;
  }
}

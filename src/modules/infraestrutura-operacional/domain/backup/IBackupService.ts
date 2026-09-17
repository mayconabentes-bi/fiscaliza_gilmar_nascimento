export interface IBackupService {
  createSnapshot(): Promise<string>; // Returns snapshot hash/id
  validateSnapshot(snapshotId: string): Promise<boolean>;
  restoreSnapshot(snapshotId: string): Promise<void>;
}

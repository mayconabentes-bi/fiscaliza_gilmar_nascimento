import { CivicReputation } from '../entities/CivicReputation.js';

export interface IReputationService {
  getReputation(userId: string): Promise<CivicReputation>;
  recordConstructiveAction(userId: string, points: number): Promise<void>;
  recordViolation(userId: string, penaltyPoints: number): Promise<void>;
}

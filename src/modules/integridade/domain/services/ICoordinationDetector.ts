import { UserRiskScore } from '../entities/UserRiskScore.js';

export interface ICoordinationDetector {
  analyzeTemporalWindow(userId: string, windowMinutes: number): Promise<void>;
  analyzeSemanticSimilarity(content: string, areaTematica: string): Promise<number>;
  getUserRiskScore(userId: string): Promise<UserRiskScore>;
}

export interface LoadTestReport {
  peakLatencyMs: number;
  errorRatePercentage: number;
  queueBacklogSize: number;
  bottlenecksDetected: string[];
  executedAt: Date;
  durationSeconds: number;
}

export interface ILoadSimulationService {
  simulateUserLoad(multiplier: number): Promise<LoadTestReport>;
  simulateInstitutionalPeak(): Promise<LoadTestReport>;
  simulateSimultaneousProposals(count: number): Promise<LoadTestReport>;
  simulateCoordinatedAttack(): Promise<LoadTestReport>;
}

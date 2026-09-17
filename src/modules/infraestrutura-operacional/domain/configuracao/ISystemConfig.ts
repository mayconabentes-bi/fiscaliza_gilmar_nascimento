export interface ISystemConfig {
  readonly maxPostsPerHour: number;
  readonly anomalyThreshold: number;
  readonly crisisAutoActivation: boolean;
  readonly cacheTtlDashboardSeconds: number;
  readonly queueRetryLimit: number;
  readonly dlqMaxSize: number;
  readonly cacheCleanupIntervalMs: number;
}

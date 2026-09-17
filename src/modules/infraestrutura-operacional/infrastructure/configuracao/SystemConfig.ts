import { ISystemConfig } from '../../domain/configuracao/ISystemConfig.js';
import { logger } from '../observabilidade/StructuredLogger.js';

export class SystemConfig implements ISystemConfig {
  readonly maxPostsPerHour: number;
  readonly anomalyThreshold: number;
  readonly crisisAutoActivation: boolean;
  readonly cacheTtlDashboardSeconds: number;
  readonly queueRetryLimit: number;
  readonly dlqMaxSize: number;
  readonly cacheCleanupIntervalMs: number;

  constructor() {
    this.maxPostsPerHour = parseInt(process.env.MAX_POSTS_PER_HOUR || '10', 10);
    this.anomalyThreshold = parseFloat(process.env.ANOMALY_THRESHOLD || '0.8');
    this.crisisAutoActivation = process.env.CRISIS_AUTO_ACTIVATION === 'true';
    this.cacheTtlDashboardSeconds = parseInt(process.env.CACHE_TTL_DASHBOARD || '300', 10);
    this.queueRetryLimit = parseInt(process.env.QUEUE_RETRY_LIMIT || '3', 10);
    this.dlqMaxSize = parseInt(process.env.DLQ_MAX_SIZE || '1000', 10);
    this.cacheCleanupIntervalMs = parseInt(process.env.CACHE_CLEANUP_INTERVAL_MS || '60000', 10);

    logger.info({
      module: 'SystemConfig',
      correlation_id: 'system',
      event_type: 'CONFIG_LOADED',
      message: 'System configuration loaded from environment variables.',
      metadata: {
        maxPostsPerHour: this.maxPostsPerHour,
        anomalyThreshold: this.anomalyThreshold,
        crisisAutoActivation: this.crisisAutoActivation,
        cacheTtlDashboardSeconds: this.cacheTtlDashboardSeconds,
        queueRetryLimit: this.queueRetryLimit,
        dlqMaxSize: this.dlqMaxSize,
        cacheCleanupIntervalMs: this.cacheCleanupIntervalMs
      }
    });
  }
}

export const systemConfig = new SystemConfig();

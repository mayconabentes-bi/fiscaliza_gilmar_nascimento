import { ICacheService } from '../../domain/cache/ICacheService.js';
import { logger } from '../observabilidade/StructuredLogger.js';
import { LogLevel } from '../../domain/observabilidade/IStructuredLogger.js';
import { systemConfig } from '../configuracao/SystemConfig.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

export class InMemoryCacheService implements ICacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Hardening: Periodic cleanup to prevent memory leaks from expired keys that are never accessed
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, systemConfig.cacheCleanupIntervalMs);
    
    // Unref to allow process exit if this is the only thing running
    this.cleanupInterval.unref();
  }

  private cleanupExpired() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug({
        module: 'InMemoryCacheService',
        correlation_id: 'system',
        event_type: 'CACHE_CLEANUP',
        message: `Cleaned up ${cleanedCount} expired cache entries.`
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug({
        module: 'InMemoryCacheService',
        correlation_id: 'system',
        event_type: 'CACHE_MISS',
        message: `Cache miss for key: ${key}`
      });
      return null;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      logger.debug({
        module: 'InMemoryCacheService',
        correlation_id: 'system',
        event_type: 'CACHE_EXPIRED',
        message: `Cache expired for key: ${key}`
      });
      this.cache.delete(key);
      return null;
    }

    logger.debug({
      module: 'InMemoryCacheService',
      correlation_id: 'system',
      event_type: 'CACHE_HIT',
      message: `Cache hit for key: ${key}`
    });
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiresAt });
    
    logger.debug({
      module: 'InMemoryCacheService',
      correlation_id: 'system',
      event_type: 'CACHE_SET',
      message: `Cache set for key: ${key}`,
      metadata: { ttlSeconds }
    });
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
    logger.debug({
      module: 'InMemoryCacheService',
      correlation_id: 'system',
      event_type: 'CACHE_INVALIDATED',
      message: `Cache invalidated for key: ${key}`
    });
  }
}

export const cacheService = new InMemoryCacheService();

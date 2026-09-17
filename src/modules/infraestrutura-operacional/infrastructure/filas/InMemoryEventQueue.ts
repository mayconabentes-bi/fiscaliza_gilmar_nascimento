import { IEvent, IEventQueue } from '../../domain/filas/IEventQueue.js';
import { logger } from '../observabilidade/StructuredLogger.js';
import { LogLevel } from '../../domain/observabilidade/IStructuredLogger.js';
import { systemConfig } from '../configuracao/SystemConfig.js';

type EventHandler = (event: IEvent) => Promise<void>;

interface QueueItem {
  event: IEvent;
  attempts: number;
}

export class InMemoryEventQueue implements IEventQueue {
  private handlers: Map<string, EventHandler[]> = new Map();
  private deadLetterQueue: IEvent[] = [];
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(maxRetries: number = systemConfig.queueRetryLimit, retryDelayMs: number = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  subscribe<T extends IEvent>(eventName: string, handler: (event: T) => Promise<void>): void {
    const currentHandlers = this.handlers.get(eventName) || [];
    currentHandlers.push(handler as EventHandler);
    this.handlers.set(eventName, currentHandlers);
  }

  async publish(event: IEvent): Promise<void> {
    // Processamento assíncrono garantido (não bloqueia a thread chamadora)
    setImmediate(() => {
      this.processEvent({ event, attempts: 0 });
    });
  }

  private async processEvent(item: QueueItem): Promise<void> {
    const { event, attempts } = item;
    const eventHandlers = this.handlers.get(event.eventName) || [];

    if (eventHandlers.length === 0) {
      logger.debug({
        module: 'InMemoryEventQueue',
        correlation_id: 'system',
        event_type: 'EVENT_IGNORED',
        message: `No handlers registered for event: ${event.eventName}`
      });
      return;
    }

    for (const handler of eventHandlers) {
      try {
        await handler(event);
      } catch (error: any) {
        logger.error({
          module: 'InMemoryEventQueue',
          correlation_id: 'system',
          event_type: 'EVENT_PROCESSING_FAILED',
          message: `Error processing event ${event.eventName}: ${error.message}`,
          metadata: { event, attempts }
        });

        if (attempts < this.maxRetries) {
          logger.info({
            module: 'InMemoryEventQueue',
            correlation_id: 'system',
            event_type: 'EVENT_RETRY_SCHEDULED',
            message: `Scheduling retry for event ${event.eventName} (Attempt ${attempts + 1} of ${this.maxRetries})`
          });
          
          setTimeout(() => {
            this.processEvent({ event, attempts: attempts + 1 });
          }, this.retryDelayMs * Math.pow(2, attempts)); // Exponential backoff
        } else {
          logger.fatal({
            module: 'InMemoryEventQueue',
            correlation_id: 'system',
            event_type: 'EVENT_MOVED_TO_DLQ',
            message: `Max retries reached for event ${event.eventName}. Moving to DLQ.`,
            metadata: { event }
          });
          
          // Hardening: Prevent DLQ from growing indefinitely
          if (this.deadLetterQueue.length >= systemConfig.dlqMaxSize) {
            logger.fatal({
              module: 'InMemoryEventQueue',
              correlation_id: 'system',
              event_type: 'DLQ_OVERFLOW',
              message: 'Dead Letter Queue reached max size. Dropping oldest event.',
              metadata: { droppedEvent: this.deadLetterQueue[0] }
            });
            this.deadLetterQueue.shift(); // Remove oldest
          }
          
          this.deadLetterQueue.push(event);
        }
      }
    }
  }

  getDLQ(): IEvent[] {
    return [...this.deadLetterQueue];
  }
}

export const eventQueue = new InMemoryEventQueue();

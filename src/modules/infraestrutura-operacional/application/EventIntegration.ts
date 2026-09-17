import { eventQueue } from '../infrastructure/filas/InMemoryEventQueue.js';
import { logger } from '../infrastructure/observabilidade/StructuredLogger.js';
import { LogLevel } from '../domain/observabilidade/IStructuredLogger.js';
import { 
  UserActionRecorded, 
  ProposalCreated, 
  ReputationUpdated, 
  RiskScoreUpdated, 
  AnomalyDetected 
} from '../../integridade/domain/events/IntegrityEvents.js';

export class EventIntegration {
  static initialize() {
    // Handler for UserActionRecorded
    eventQueue.subscribe<UserActionRecorded>('UserActionRecorded', async (event) => {
      logger.info({
        module: 'EventIntegration',
        correlation_id: 'system',
        event_type: 'PROCESSING_USER_ACTION',
        message: `Processing user action: ${event.payload.actionType} for user ${event.payload.userId}`
      });
      
      // Simulate heavy processing (e.g., updating risk score, checking coordination)
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Handler for ProposalCreated
    eventQueue.subscribe<ProposalCreated>('ProposalCreated', async (event) => {
      logger.info({
        module: 'EventIntegration',
        correlation_id: 'system',
        event_type: 'PROCESSING_PROPOSAL_CREATED',
        message: `Processing new proposal ${event.payload.proposalId} in municipality ${event.payload.municipalityId}`
      });
      
      // Simulate heavy processing (e.g., semantic analysis, anomaly detection)
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Handler for ReputationUpdated
    eventQueue.subscribe<ReputationUpdated>('ReputationUpdated', async (event) => {
      logger.info({
        module: 'EventIntegration',
        correlation_id: 'system',
        event_type: 'PROCESSING_REPUTATION_UPDATE',
        message: `Processing reputation update for user ${event.payload.userId}. New level: ${event.payload.newLevel}`
      });
      
      // Simulate heavy processing (e.g., updating materialized views, notifying user)
      await new Promise(resolve => setTimeout(resolve, 30));
    });

    // Handler for RiskScoreUpdated
    eventQueue.subscribe<RiskScoreUpdated>('RiskScoreUpdated', async (event) => {
      logger.info({
        module: 'EventIntegration',
        correlation_id: 'system',
        event_type: 'PROCESSING_RISK_SCORE_UPDATE',
        message: `Processing risk score update for user ${event.payload.userId}. New risk level: ${event.payload.newRiskLevel}`
      });
      
      // Simulate heavy processing (e.g., triggering crisis mode if too many high risks)
      await new Promise(resolve => setTimeout(resolve, 40));
    });

    // Handler for AnomalyDetected
    eventQueue.subscribe<AnomalyDetected>('AnomalyDetected', async (event) => {
      logger.warn({
        module: 'EventIntegration',
        correlation_id: 'system',
        event_type: 'PROCESSING_ANOMALY_DETECTED',
        message: `Processing anomaly alert ${event.payload.alertId} of type ${event.payload.type} with severity ${event.payload.severity}`
      });
      
      // Simulate heavy processing (e.g., sending alerts to admins, activating crisis mode)
      await new Promise(resolve => setTimeout(resolve, 60));
    });

    logger.info({
      module: 'EventIntegration',
      correlation_id: 'system',
      event_type: 'EVENT_HANDLERS_REGISTERED',
      message: 'All event handlers successfully registered with the EventQueue.'
    });
  }
}

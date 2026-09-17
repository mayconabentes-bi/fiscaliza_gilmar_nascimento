import { IEvent } from '../../../infraestrutura-operacional/domain/filas/IEventQueue.js';

export interface DomainEvent extends IEvent {
  eventName: string;
  timestamp: Date;
  payload: any;
}

export class UserActionRecorded implements DomainEvent {
  public readonly eventName = 'UserActionRecorded';
  public readonly timestamp = new Date();
  public readonly payload: any;
  constructor(
    public readonly userId: string,
    public readonly actionType: string,
    public readonly ipHash: string,
    public readonly deviceFingerprint: string
  ) {
    this.payload = { userId, actionType, ipHash, deviceFingerprint };
  }
}

export class ProposalSupported implements DomainEvent {
  public readonly eventName = 'ProposalSupported';
  public readonly timestamp = new Date();
  public readonly payload: any;
  constructor(
    public readonly proposalId: string,
    public readonly userId: string,
    public readonly supportType: string
  ) {
    this.payload = { proposalId, userId, supportType };
  }
}

export class ProposalCreated implements DomainEvent {
  public readonly eventName = 'ProposalCreated';
  public readonly timestamp = new Date();
  public readonly payload: any;
  constructor(
    public readonly proposalId: string,
    public readonly userId: string,
    public readonly municipalityId: string
  ) {
    this.payload = { proposalId, userId, municipalityId };
  }
}

export class CommentCreated implements DomainEvent {
  public readonly eventName = 'CommentCreated';
  public readonly timestamp = new Date();
  public readonly payload: any;
  constructor(
    public readonly commentId: string,
    public readonly proposalId: string,
    public readonly userId: string
  ) {
    this.payload = { commentId, proposalId, userId };
  }
}

export class ReputationUpdated implements DomainEvent {
  public readonly eventName = 'ReputationUpdated';
  public readonly timestamp = new Date();
  public readonly payload: any;
  constructor(
    public readonly userId: string,
    public readonly newScore: number,
    public readonly newLevel: string
  ) {
    this.payload = { userId, newScore, newLevel };
  }
}

export class RiskScoreUpdated implements DomainEvent {
  public readonly eventName = 'RiskScoreUpdated';
  public readonly timestamp = new Date();
  public readonly payload: any;
  constructor(
    public readonly userId: string,
    public readonly newRiskLevel: string,
    public readonly totalScore: number
  ) {
    this.payload = { userId, newRiskLevel, totalScore };
  }
}

export class AnomalyDetected implements DomainEvent {
  public readonly eventName = 'AnomalyDetected';
  public readonly timestamp = new Date();
  public readonly payload: any;
  constructor(
    public readonly alertId: string,
    public readonly type: string,
    public readonly severity: string
  ) {
    this.payload = { alertId, type, severity };
  }
}

export class CrisisActivated implements DomainEvent {
  public readonly eventName = 'CrisisActivated';
  public readonly timestamp = new Date();
  public readonly payload: any;
  constructor(
    public readonly reason: string,
    public readonly expiresAt: Date
  ) {
    this.payload = { reason, expiresAt };
  }
}

export enum AnomalySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export class AnomalyAlert {
  constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly severity: AnomalySeverity,
    public readonly affectedArea: string,
    public readonly detectedAt: Date,
    public readonly recommendedAction: string
  ) {}
}

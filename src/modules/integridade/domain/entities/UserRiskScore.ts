export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export class UserRiskScore {
  constructor(
    public readonly userId: string,
    public temporalScore: number,
    public semanticScore: number,
    public networkScore: number,
    public lastUpdate: Date
  ) {}

  get totalScore(): number {
    return (this.temporalScore + this.semanticScore + this.networkScore) / 3;
  }

  get riskLevel(): RiskLevel {
    const score = this.totalScore;
    if (score > 0.8) return RiskLevel.HIGH;
    if (score > 0.5) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }
}

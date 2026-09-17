export enum ReputationLevel {
  PARTICIPANTE = 'PARTICIPANTE',
  COLABORADOR = 'COLABORADOR',
  CONTRIBUINTE_TECNICO = 'CONTRIBUINTE_TECNICO',
  REFERENCIA_CIVICA = 'REFERENCIA_CIVICA'
}

export class CivicReputation {
  constructor(
    public readonly userId: string,
    public constructiveScore: number = 0,
    public consistencyScore: number = 0,
    public institutionalInteractionScore: number = 0,
    public violationPenalty: number = 0
  ) {}

  get reputationScore(): number {
    const score = (this.constructiveScore * 0.4) + 
                  (this.consistencyScore * 0.3) + 
                  (this.institutionalInteractionScore * 0.3) - 
                  this.violationPenalty;
    return Math.max(0, score);
  }

  get level(): ReputationLevel {
    const score = this.reputationScore;
    if (score >= 80) return ReputationLevel.REFERENCIA_CIVICA;
    if (score >= 50) return ReputationLevel.CONTRIBUINTE_TECNICO;
    if (score >= 20) return ReputationLevel.COLABORADOR;
    return ReputationLevel.PARTICIPANTE;
  }
}

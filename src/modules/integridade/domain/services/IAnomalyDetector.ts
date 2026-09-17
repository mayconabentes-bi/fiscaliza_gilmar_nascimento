import { AnomalyAlert } from '../entities/AnomalyAlert.js';

export interface IAnomalyDetector {
  detectSuddenGrowth(areaTematica: string): Promise<AnomalyAlert | null>;
  detectRegionalConcentration(municipio: string): Promise<AnomalyAlert | null>;
}

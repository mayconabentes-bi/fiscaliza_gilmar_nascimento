import { CrisisMode } from '../entities/CrisisMode.js';

export interface ICrisisManager {
  getCurrentStatus(): Promise<CrisisMode>;
  activateCrisis(reason: string, durationHours: number): Promise<void>;
  deactivateCrisis(): Promise<void>;
}

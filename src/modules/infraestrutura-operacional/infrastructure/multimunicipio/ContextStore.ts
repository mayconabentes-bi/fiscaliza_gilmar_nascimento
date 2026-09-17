import { AsyncLocalStorage } from 'async_hooks';
import { MunicipalityContext } from '../../domain/multimunicipio/MunicipalityContext.js';

export class ContextStore {
  private static storage = new AsyncLocalStorage<MunicipalityContext>();

  static run(context: MunicipalityContext, callback: () => void) {
    this.storage.run(context, callback);
  }

  static get(): MunicipalityContext | undefined {
    return this.storage.getStore();
  }

  static getMunicipalityId(): string | undefined {
    return this.storage.getStore()?.municipalityId;
  }
}

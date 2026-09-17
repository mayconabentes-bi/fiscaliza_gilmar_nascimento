import { cacheService } from '../infrastructure/cache/InMemoryCacheService.js';
import { logger } from '../infrastructure/observabilidade/StructuredLogger.js';
import { LogLevel } from '../domain/observabilidade/IStructuredLogger.js';

export class CachePolicy {
  // TTLs configuráveis
  private static readonly TTL_DASHBOARD_PUBLICO = 300; // 5 minutos
  private static readonly TTL_INDICADORES_MUNICIPIO = 600; // 10 minutos

  /**
   * Obtém ou atualiza o cache do Dashboard Público.
   * Nunca armazena dados sensíveis.
   */
  static async getDashboardPublico(fetchData: () => Promise<any>): Promise<any> {
    const key = 'dashboard:publico';
    const cached = await cacheService.get<any>(key);

    if (cached) {
      return cached;
    }

    const data = await fetchData();
    await cacheService.set(key, data, this.TTL_DASHBOARD_PUBLICO);
    return data;
  }

  /**
   * Obtém ou atualiza o cache de Indicadores Agregados por Município.
   * Nunca armazena dados sensíveis.
   */
  static async getIndicadoresMunicipio(municipalityId: string, fetchData: () => Promise<any>): Promise<any> {
    const key = `indicadores:municipio:${municipalityId}`;
    const cached = await cacheService.get<any>(key);

    if (cached) {
      return cached;
    }

    const data = await fetchData();
    await cacheService.set(key, data, this.TTL_INDICADORES_MUNICIPIO);
    return data;
  }

  /**
   * Invalida caches relacionados a um município específico.
   * Deve ser chamado quando há atualizações críticas (ex: nova proposta aprovada).
   */
  static async invalidateMunicipioCache(municipalityId: string): Promise<void> {
    await cacheService.invalidate(`indicadores:municipio:${municipalityId}`);
    // Opcionalmente invalidar o dashboard público se ele depender fortemente disso
    // await cacheService.invalidate('dashboard:publico');
  }
}

/**
 * Service to interact with IBGE API (Serviço de Dados)
 */
export class IBGEService {
  private static BASE_URL = 'https://servicodados.ibge.gov.br/api/v1';
  private static SIDRA_URL = 'https://servicodados.ibge.gov.br/api/v3';

  /**
   * Fetches all municipalities for Amazonas (State ID 13)
   */
  static async getMunicipiosAmazonas() {
    try {
      const response = await fetch(`${this.BASE_URL}/localidades/estados/13/municipios`);
      if (!response.ok) throw new Error('Failed to fetch IBGE municipalities');
      return await response.json();
    } catch (error) {
      console.error('IBGE API Error:', error);
      return [];
    }
  }

  /**
   * Fetches population estimate for a specific municipality (IBGE ID)
   * Using SIDRA Aggregate 6579 (Estimativas de população) for 2021
   */
  static async getPopulacaoEstimada(ibgeId: string) {
    try {
      // Aggregate 6579, Variable 93 (População estimada), Period 2021
      const response = await fetch(`${this.SIDRA_URL}/agregados/6579/periodos/2021/variaveis/93?localidades=N6[${ibgeId}]`);
      if (!response.ok) throw new Error(`Failed to fetch population for ${ibgeId}`);
      const data = await response.json();
      
      // SIDRA returns a complex structure, we need to extract the value
      if (data && data[0] && data[0].resultados && data[0].resultados[0].series[0].serie) {
        const value = Object.values(data[0].resultados[0].series[0].serie)[0];
        return parseInt(value as string, 10);
      }
      return null;
    } catch (error) {
      console.error(`IBGE SIDRA Error (${ibgeId}):`, error);
      return null;
    }
  }

  /**
   * Fetches PIB for a specific municipality (IBGE ID)
   * Using SIDRA Aggregate 5938 (PIB a preços correntes) for 2021
   */
  static async getPIB(ibgeId: string) {
    try {
      // Aggregate 5938, Variable 37 (PIB a preços correntes), Period 2021
      const response = await fetch(`${this.SIDRA_URL}/agregados/5938/periodos/2021/variaveis/37?localidades=N6[${ibgeId}]`);
      if (!response.ok) throw new Error(`Failed to fetch PIB for ${ibgeId}`);
      const data = await response.json();
      
      if (data && data[0] && data[0].resultados && data[0].resultados[0].series[0].serie) {
        const value = Object.values(data[0].resultados[0].series[0].serie)[0];
        return parseFloat(value as string);
      }
      return null;
    } catch (error) {
      console.error(`IBGE SIDRA PIB Error (${ibgeId}):`, error);
      return null;
    }
  }
}

export interface IMetricsCollector {
  recordResponseTime(endpoint: string, method: string, latencyMs: number): void;
  incrementProposalsCreated(municipalityId: string): void;
  incrementAnomalyAlerts(type: string, severity: string): void;
  incrementCrisisActivations(reason: string): void;
  recordVolumeByMunicipality(municipalityId: string, eventType: string, count: number): void;
  exportMetrics(): Promise<string>; // Returns Prometheus format string
}

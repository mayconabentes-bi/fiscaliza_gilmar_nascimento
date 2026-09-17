import { IMetricsCollector } from '../../domain/observabilidade/IMetricsCollector.js';

export class MetricsCollector implements IMetricsCollector {
  // Counters
  private proposalsCreated = new Map<string, number>();
  private anomalyAlerts = new Map<string, number>(); // key: type_severity
  private crisisActivations = new Map<string, number>();
  private volumeByMunicipality = new Map<string, number>(); // key: municipalityId_eventType

  // Histograms (simplified as sum and count for average/summary)
  private responseTimes = new Map<string, { sum: number; count: number }>(); // key: method_endpoint

  recordResponseTime(endpoint: string, method: string, latencyMs: number): void {
    const key = `${method}_${endpoint}`;
    const current = this.responseTimes.get(key) || { sum: 0, count: 0 };
    current.sum += latencyMs;
    current.count += 1;
    this.responseTimes.set(key, current);
  }

  incrementProposalsCreated(municipalityId: string): void {
    const current = this.proposalsCreated.get(municipalityId) || 0;
    this.proposalsCreated.set(municipalityId, current + 1);
  }

  incrementAnomalyAlerts(type: string, severity: string): void {
    const key = `${type}_${severity}`;
    const current = this.anomalyAlerts.get(key) || 0;
    this.anomalyAlerts.set(key, current + 1);
  }

  incrementCrisisActivations(reason: string): void {
    const current = this.crisisActivations.get(reason) || 0;
    this.crisisActivations.set(reason, current + 1);
  }

  recordVolumeByMunicipality(municipalityId: string, eventType: string, count: number): void {
    const key = `${municipalityId}_${eventType}`;
    const current = this.volumeByMunicipality.get(key) || 0;
    this.volumeByMunicipality.set(key, current + count);
  }

  async exportMetrics(): Promise<string> {
    const lines: string[] = [];

    // Response times (Summary representation)
    lines.push('# HELP http_request_duration_milliseconds HTTP request latency');
    lines.push('# TYPE http_request_duration_milliseconds summary');
    for (const [key, data] of this.responseTimes.entries()) {
      const [method, endpoint] = key.split('_');
      lines.push(`http_request_duration_milliseconds_sum{method="${method}",endpoint="${endpoint}"} ${data.sum}`);
      lines.push(`http_request_duration_milliseconds_count{method="${method}",endpoint="${endpoint}"} ${data.count}`);
    }

    // Proposals created
    lines.push('# HELP civic_proposals_created_total Total proposals created');
    lines.push('# TYPE civic_proposals_created_total counter');
    for (const [municipalityId, count] of this.proposalsCreated.entries()) {
      lines.push(`civic_proposals_created_total{municipality_id="${municipalityId}"} ${count}`);
    }

    // Anomaly alerts
    lines.push('# HELP civic_anomaly_alerts_total Total anomaly alerts');
    lines.push('# TYPE civic_anomaly_alerts_total counter');
    for (const [key, count] of this.anomalyAlerts.entries()) {
      const [type, severity] = key.split('_');
      lines.push(`civic_anomaly_alerts_total{type="${type}",severity="${severity}"} ${count}`);
    }

    // Crisis activations
    lines.push('# HELP civic_crisis_activations_total Total crisis activations');
    lines.push('# TYPE civic_crisis_activations_total counter');
    for (const [reason, count] of this.crisisActivations.entries()) {
      lines.push(`civic_crisis_activations_total{reason="${reason}"} ${count}`);
    }

    // Volume by municipality
    lines.push('# HELP civic_events_volume_total Total events by municipality');
    lines.push('# TYPE civic_events_volume_total counter');
    for (const [key, count] of this.volumeByMunicipality.entries()) {
      const [municipalityId, eventType] = key.split('_');
      lines.push(`civic_events_volume_total{municipality_id="${municipalityId}",event_type="${eventType}"} ${count}`);
    }

    return lines.join('\n') + '\n';
  }
}

export const metricsCollector = new MetricsCollector();

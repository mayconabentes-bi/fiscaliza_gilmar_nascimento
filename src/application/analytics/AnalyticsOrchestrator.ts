import { ThemeAggregationService } from "../../domain/aggregates/ThemeAggregationService.js";
import { RecurrenceScoreService } from "../../domain/aggregates/RecurrenceScoreService.js";

export class AnalyticsOrchestrator {
  static async processAll() {
    try {
      ThemeAggregationService.aggregatePublicacoes();
      RecurrenceScoreService.calculateScores();

      return { success: true, message: "Analytics processed successfully" };
    } catch (error: any) {
      console.error("Error processing analytics:", error);
      return { success: false, error: error.message };
    }
  }
}

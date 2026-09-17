import { IStructuredLogger, LogEntry, LogLevel } from '../../domain/observabilidade/IStructuredLogger.js';
import { ContextStore } from '../multimunicipio/ContextStore.js';

export class StructuredLogger implements IStructuredLogger {
  private log(level: LogLevel, entry: Omit<LogEntry, 'timestamp' | 'level'>) {
    const municipalityId = entry.municipality_id || ContextStore.getMunicipalityId();

    const logObject: LogEntry = {
      ...entry,
      municipality_id: municipalityId, // Injeção automática
      timestamp: new Date().toISOString(),
      level
    };
    
    // Using process.stdout/stderr.write to ensure thread-safe, unformatted JSON output
    // suitable for log aggregators (Cloud Logging, ELK, Datadog)
    const logString = JSON.stringify(logObject);
    
    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      process.stderr.write(logString + '\n');
    } else {
      process.stdout.write(logString + '\n');
    }
  }

  debug(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log(LogLevel.DEBUG, entry);
  }

  info(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log(LogLevel.INFO, entry);
  }

  warn(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log(LogLevel.WARN, entry);
  }

  error(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log(LogLevel.ERROR, entry);
  }

  fatal(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log(LogLevel.FATAL, entry);
  }
}

export const logger = new StructuredLogger();

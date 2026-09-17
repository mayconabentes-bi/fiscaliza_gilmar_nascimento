export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  correlation_id: string;
  user_id?: string;
  municipality_id?: string;
  event_type: string;
  latency_ms?: number;
  message: string;
  metadata?: Record<string, any>;
}

export interface IStructuredLogger {
  debug(entry: Omit<LogEntry, 'timestamp' | 'level'>): void;
  info(entry: Omit<LogEntry, 'timestamp' | 'level'>): void;
  warn(entry: Omit<LogEntry, 'timestamp' | 'level'>): void;
  error(entry: Omit<LogEntry, 'timestamp' | 'level'>): void;
  fatal(entry: Omit<LogEntry, 'timestamp' | 'level'>): void;
}

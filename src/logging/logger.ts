import { config } from "../config/index.js";

export type LogLevel = "DEBUG" | "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface LogEntry {
  /** Present on entries read back from storage (autoincrement row id); absent on a freshly-emitted entry. */
  id?: number;
  timestamp: string;
  level: LogLevel;
  event: string;
  scanId?: string;
  questionId?: string;
  provider?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 1,
  WARNING: 2,
  ERROR: 3,
};

export interface LogSink {
  write(entry: LogEntry): void;
}

/** Default sink: structured JSON lines to stdout/stderr. */
export class ConsoleSink implements LogSink {
  write(entry: LogEntry): void {
    const line = JSON.stringify(entry);
    if (entry.level === "ERROR") {
      // eslint-disable-next-line no-console
      console.error(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  }
}

/** In-memory sink, useful for tests that want to assert on emitted logs. */
export class MemoryLogSink implements LogSink {
  entries: LogEntry[] = [];
  write(entry: LogEntry): void {
    this.entries.push(entry);
  }
  clear(): void {
    this.entries = [];
  }
}

/** Writes to another sink and persists the same entry to the logs table. Persistence failures never break logging. */
export class CompositeDbSink implements LogSink {
  constructor(
    private readonly inner: LogSink,
    private readonly persist: (entry: LogEntry) => void,
  ) {}

  write(entry: LogEntry): void {
    this.inner.write(entry);
    try {
      this.persist(entry);
    } catch {
      // Logging must never crash the caller; the console sink already has the entry.
    }
  }
}

export interface LogContext {
  scanId?: string;
  questionId?: string;
  provider?: string;
}

export class Logger {
  private sink: LogSink;

  constructor(sink: LogSink = new ConsoleSink()) {
    this.sink = sink;
  }

  setSink(sink: LogSink): void {
    this.sink = sink;
  }

  private minLevel(): number {
    return LEVEL_ORDER[config().logLevel] ?? LEVEL_ORDER.INFO;
  }

  private emit(
    level: LogLevel,
    event: string,
    message: string,
    ctx: LogContext = {},
    metadata?: Record<string, unknown>,
  ): void {
    if (LEVEL_ORDER[level] < this.minLevel()) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      ...ctx,
      ...(metadata ? { metadata } : {}),
    };
    this.sink.write(entry);
  }

  debug(event: string, message: string, ctx?: LogContext, metadata?: Record<string, unknown>): void {
    this.emit("DEBUG", event, message, ctx, metadata);
  }
  info(event: string, message: string, ctx?: LogContext, metadata?: Record<string, unknown>): void {
    this.emit("INFO", event, message, ctx, metadata);
  }
  success(event: string, message: string, ctx?: LogContext, metadata?: Record<string, unknown>): void {
    this.emit("SUCCESS", event, message, ctx, metadata);
  }
  warning(event: string, message: string, ctx?: LogContext, metadata?: Record<string, unknown>): void {
    this.emit("WARNING", event, message, ctx, metadata);
  }
  error(event: string, message: string, ctx?: LogContext, metadata?: Record<string, unknown>): void {
    this.emit("ERROR", event, message, ctx, metadata);
  }
}

export const logger = new Logger();

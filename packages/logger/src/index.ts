import pino, { type Level, type Logger as PinoLogger } from "pino";

export type LogLevel = Level;

export type LogFields = Record<string, unknown>;

export type Logger = {
  trace(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  fatal(message: string, fields?: LogFields): void;
};

const RESERVED_FIELDS = new Set(["level", "time", "timestamp", "service", "msg"]);

function sanitizeFields(fields: LogFields): LogFields {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !RESERVED_FIELDS.has(key)));
}

export function createLogger(service: string): Logger {
  const logger: PinoLogger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ["password", "token", "secret", "*.password", "*.token", "*.secret"],
  });

  return {
    trace: (message, fields = {}) => logger.trace(sanitizeFields(fields), message),
    debug: (message, fields = {}) => logger.debug(sanitizeFields(fields), message),
    info: (message, fields = {}) => logger.info(sanitizeFields(fields), message),
    warn: (message, fields = {}) => logger.warn(sanitizeFields(fields), message),
    error: (message, fields = {}) => logger.error(sanitizeFields(fields), message),
    fatal: (message, fields = {}) => logger.fatal(sanitizeFields(fields), message),
  };
}

export function serializeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return { err: error };
  }

  return { error: String(error) };
}

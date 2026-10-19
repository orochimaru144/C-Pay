export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// In production, only log ERRORs. In development, log everything.
const CURRENT_LOG_LEVEL = typeof __DEV__ !== 'undefined' && __DEV__ ? LogLevel.DEBUG : LogLevel.ERROR;

function sanitizeLogArg(arg: any): any {
  if (arg === null || arg === undefined) return arg;
  if (typeof arg === 'string') {
    return arg
      .replace(/\b[G][A-Z2-7]{55}\b/g, '[REDACTED_ADDRESS]')
      .replace(/\b[0-9a-fA-F]{64}\b/g, '[REDACTED_HASH]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
      .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '[REDACTED_ID]');
  }
  if (arg instanceof Error) {
    return sanitizeLogArg(`${arg.name || 'Error'}: ${arg.message || 'classified'}`);
  }
  if (typeof arg === 'object') {
    if (arg.message || arg.code || arg.error || arg.details || arg.hint) {
      return sanitizeLogArg(`${arg.name || arg.code || 'Error'}: ${arg.message || arg.error || 'classified'}`);
    }
  }
  return arg;
}

export const Logger = {
  debug: (...args: any[]) => {
    if (CURRENT_LOG_LEVEL <= LogLevel.DEBUG) {
      console.debug(...args.map(sanitizeLogArg));
    }
  },
  info: (...args: any[]) => {
    if (CURRENT_LOG_LEVEL <= LogLevel.INFO) {
      console.info(...args.map(sanitizeLogArg));
    }
  },
  warn: (...args: any[]) => {
    if (CURRENT_LOG_LEVEL <= LogLevel.WARN) {
      console.warn(...args.map(sanitizeLogArg));
    }
  },
  error: (...args: any[]) => {
    if (CURRENT_LOG_LEVEL <= LogLevel.ERROR) {
      console.error(...args.map(sanitizeLogArg));
    }
  },
};

import { logger } from "./logger";
import { getRequestId } from "./request-context";

type LogMeta = Record<string, unknown>;

export const appLogger = {
  info(event: string, meta: LogMeta = {}) {
    logger.info({
      event,
      requestId: getRequestId(),
      ...meta,
    });
  },

  warn(event: string, meta: LogMeta = {}) {
    logger.warn({
      event,
      requestId: getRequestId(),
      ...meta,
    });
  },

  error(event: string, error: unknown, meta: LogMeta = {}) {
    logger.error({
      event,
      requestId: getRequestId(),
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      ...meta,
    });
  },
};

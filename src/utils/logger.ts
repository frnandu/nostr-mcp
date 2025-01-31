import { pino } from "pino";

/**
 * Configure pino logger with pretty printing in development
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
        }
      : undefined,
});

// Export the logger instance
export default logger;

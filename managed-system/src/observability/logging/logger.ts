import pino from 'pino'
import { config } from "@/config";

const isProduction = config.server.environment === "production"

export const logger = pino({
    level: config.observability.logLevel,
    base: {
        service: 'managed-system',
        environment: config.server.environment,
    },
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "password",
            "token",
            "accessToken",
            "refreshToken"
        ],
        censor: "[REDACTED]",
    },
    transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: 'pid,hostname'
            }
        }
})
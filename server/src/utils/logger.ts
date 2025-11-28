import { Connection } from 'vscode-languageserver';

interface Logger {
    log(message: string): void;
    error(message: string): void;
}

class ConsoleLogger implements Logger {
    private readonly prefix = '[SLiM Language Server]';

    log(message: string): void {
        console.log(`${this.prefix} ${message}`);
    }

    error(message: string): void {
        console.error(`${this.prefix} ${message}`);
    }
}

class ConnectionLogger implements Logger {
    constructor(private readonly connection: Connection) {}

    log(message: string): void {
        this.connection.console.log(message);
    }

    error(message: string): void {
        this.connection.console.error(message);
    }
}

// Global logger instance (initialized as console logger, can be upgraded to connection logger)
let logger: Logger = new ConsoleLogger();

export function initializeLogger(connection: Connection): void {
    logger = new ConnectionLogger(connection);
}

export function log(message: string): void {
    logger.log(message);
}

export function logError(message: string): void {
    logger.error(message);
}

export function logErrorWithStack(error: unknown, context?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const prefix = context ? `${context}: ` : '';

    logger.error(`${prefix}${errorMessage}`);
    if (errorStack) {
        logger.error(`Stack: ${errorStack}`);
    }
}
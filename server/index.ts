import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { setupHandlers } from './src/handlers/handlers';
import { FORMATTER_CONFIG } from './src/config/config';
import type { UserFormattingConfig } from './src/config/types';

// Create connection and document manager
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Listen for document changes
documents.listen(connection);

// Handle initialization
connection.onInitialize((params) => {
    // Apply user configuration for formatting
    const formattingConfig = params.initializationOptions?.formatting as UserFormattingConfig;
    if (formattingConfig) {
        if (typeof formattingConfig.maxConsecutiveBlankLines === 'number') {
            FORMATTER_CONFIG.MAX_CONSECUTIVE_BLANK_LINES = Math.max(0, Math.min(10, formattingConfig.maxConsecutiveBlankLines));
        }
    }

    return setupHandlers(connection, documents);
});

connection.onInitialized(() => {
    connection.console.log('SLiM Language Server initialized');
});

// Handle configuration changes
connection.onDidChangeConfiguration((change) => {
    const formattingConfig = change.settings?.slimTools?.formatting as UserFormattingConfig;
    if (formattingConfig) {
        if (typeof formattingConfig.maxConsecutiveBlankLines === 'number') {
            FORMATTER_CONFIG.MAX_CONSECUTIVE_BLANK_LINES = Math.max(0, Math.min(10, formattingConfig.maxConsecutiveBlankLines));
        }
    }
});

// Start listening
connection.listen();

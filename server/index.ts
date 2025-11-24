import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import { registerHandlers } from './src/handlers/handlers';
import { initializeLogger, log, logErrorWithStack } from './src/utils/logger';
import { DocumentationService } from './src/services/documentation-service';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

log('Starting...');

process.on('uncaughtException', (error) => {
    logErrorWithStack(error, 'Uncaught exception');
});

process.on('unhandledRejection', (reason) => {
    logErrorWithStack(reason, 'Unhandled rejection');
});

// Initialize services
const documentationService = new DocumentationService();

documents.listen(connection);

registerHandlers({
    connection,
    documents,
    documentationService,
});

connection.onInitialized(() => {
    initializeLogger(connection);
    log('SLiM Language Server initialized');
});

connection.listen();

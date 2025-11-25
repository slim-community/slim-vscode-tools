import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { loadDocumentation } from './src/services/documentation-service';
import { setupHandlers } from './src/handlers/handlers';

// Create connection and document manager
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Load documentation data
loadDocumentation();

// Setup all handlers and get initialization result
const initializeResult = setupHandlers(connection, documents);

// Listen for document changes
documents.listen(connection);

// Handle initialization
connection.onInitialize(() => {
    return initializeResult;
});

connection.onInitialized(() => {
    connection.console.log('SLiM Language Server initialized');
});

// Start listening
connection.listen();

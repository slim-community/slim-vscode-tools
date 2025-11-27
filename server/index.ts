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

// Listen for document changes
documents.listen(connection);

// Handle initialization
connection.onInitialize(() => {
    return setupHandlers(connection, documents);
});

connection.onInitialized(() => {
    connection.console.log('SLiM Language Server initialized');
});

// Start listening
connection.listen();

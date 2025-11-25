import {
    Connection,
    TextDocuments,
    InitializeResult,
    TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { validateTextDocument } from '../services/validation-service';
import { onHover } from '../providers/hover';
import { onCompletion, onCompletionResolve } from '../providers/completion';
import { onSignatureHelp } from '../providers/signature-help';
import { onReferences } from '../providers/references';
import { onDocumentSymbol } from '../providers/document-symbols';

export function setupHandlers(
    connection: Connection,
    documents: TextDocuments<TextDocument>
): InitializeResult {
    // Initialize handler
    const initializeResult: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.'],
            },
            hoverProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            documentFormattingProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',', ' '],
                retriggerCharacters: [',', ')'],
            },
        },
    };

    // Document change handler
    documents.onDidChangeContent((change) => {
        validateTextDocument(change.document, connection);
    });

    // Hover handler
    connection.onHover((params) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;
        return onHover(params, document);
    });

    // Completion handler
    connection.onCompletion((params) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return [];
        return onCompletion(params, document);
    });

    // Completion resolve handler
    connection.onCompletionResolve((item) => {
        return onCompletionResolve(item);
    });

    // Signature help handler
    connection.onSignatureHelp((params) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;
        return onSignatureHelp(params, document);
    });

    // References handler
    connection.onReferences(() => {
        return onReferences();
    });

    // Document symbol handler
    connection.onDocumentSymbol((params) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return [];
        return onDocumentSymbol(params, document);
    });

    return initializeResult;
}


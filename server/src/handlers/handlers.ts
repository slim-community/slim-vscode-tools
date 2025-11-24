import {
    InitializeParams,
    InitializeResult,
    ServerCapabilities,
    TextDocumentSyncKind,
} from 'vscode-languageserver';
import { registerHoverProvider } from '../providers/hover';
import { LanguageServerContext } from '../config/types';

export function registerHandlers(context: LanguageServerContext): void {
    const { connection } = context;

    // Register initialize handler
    connection.onInitialize((_params: InitializeParams): InitializeResult => {
        const result: InitializeResult = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,
                hoverProvider: true,
                // TODO: Implement additional providers
                // completionProvider: {
                //     resolveProvider: true,
                //     triggerCharacters: ['.'],
                // },
                // signatureHelpProvider: {
                //     triggerCharacters: ['(', ',', ' '],
                //     retriggerCharacters: [',', ')'],
                // },
                // definitionProvider: true,
                // referencesProvider: true,
                // documentSymbolProvider: true,
                // documentFormattingProvider: true,
                // codeActionProvider: {
                //     codeActionKinds: ['quickfix', 'refactor'],
                // },
                // inlayHintProvider: true,
                // renameProvider: {
                //     prepareProvider: true,
                // },
                // workspaceSymbolProvider: true,
                // codeLensProvider: {
                //     resolveProvider: false,
                // },
                // documentHighlightProvider: true,
            } as ServerCapabilities,
        };
        return result;
    });

    // Register all providers
    registerHoverProvider(context);
}

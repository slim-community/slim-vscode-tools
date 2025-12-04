import {
    CompletionParams,
    CompletionItem,
} from 'vscode-languageserver/node';
import { LanguageServerContext } from '../config/types';

export function registerCompletionProvider(context: LanguageServerContext): void {
    const { connection, documents, completionService } = context;

    connection.onCompletion((params: CompletionParams): CompletionItem[] => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return [];

        const completions = completionService.getCompletions(document, params.position);
        return Array.isArray(completions) ? completions : (completions?.items || []);
    });

    connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
        return completionService.resolveCompletion(item);
    });
}


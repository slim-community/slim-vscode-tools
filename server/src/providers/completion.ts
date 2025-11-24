import { CompletionParams, CompletionItem, CompletionList } from 'vscode-languageserver';
import { LanguageServerContext } from '../config/types';

export function registerCompletionProvider(context: LanguageServerContext): void {
    const { connection, documents, completionService } = context;

    connection.onCompletion((params: CompletionParams): CompletionItem[] | CompletionList | null => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;

        return completionService.getCompletions(document, params.position);
    });

    connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
        return completionService.resolveCompletion(item);
    });
}

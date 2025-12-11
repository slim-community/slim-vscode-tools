import {
    CompletionParams,
    CompletionItem,
} from 'vscode-languageserver/node';
import { LanguageServerContext } from '../config/types';
import { logErrorWithStack } from '../utils/logger';

export function registerCompletionProvider(context: LanguageServerContext): void {
    const { connection, documents, completionService } = context;

    connection.onCompletion((params: CompletionParams): CompletionItem[] => {
        try {
            // Always get the latest document version right before processing
            const document = documents.get(params.textDocument.uri);
            if (!document) return [];

            const completions = completionService.getCompletions(
                document, 
                params.position
            );
            return Array.isArray(completions) ? completions : (completions?.items || []);
        } catch (error) {
            logErrorWithStack(error, 'Error in completion provider');
            return []; 
        }
    });

    connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
        try {
            return completionService.resolveCompletion(item);
        } catch (error) {
            logErrorWithStack(error, 'Error resolving completion item');
            return item; // Return item as-is on error
        }
    });
}


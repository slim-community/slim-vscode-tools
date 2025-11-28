import {
    CompletionParams,
    CompletionItem,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageServerContext } from '../config/types';

export function onCompletion(
    params: CompletionParams,
    document: TextDocument,
    context: LanguageServerContext
): CompletionItem[] {
    const completions = context.completionService.getCompletions(document, params.position);
    
    return Array.isArray(completions) ? completions : (completions?.items || []);
}

export function onCompletionResolve(
    item: CompletionItem,
    context: LanguageServerContext
): CompletionItem {
    return context.completionService.resolveCompletion(item);
}


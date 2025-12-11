import {
    DocumentSymbolParams,
    DocumentSymbol,
    SymbolKind,
    Range,
} from 'vscode-languageserver/node';
import { LanguageServerContext } from '../config/types';
import { CALLBACK_NAMES, EIDOS_FUNCTION_REGEX } from '../config/config';
import { splitCodeAndComment, isPureCommentLine } from '../utils/text-processing';
import { findBlockRange } from '../utils/ranges';
import { documentCache } from '../services/document-cache';

const CALLBACK_PATTERN = new RegExp(
    `^\\s*(?:species\\s+\\w+\\s+)?(?:s\\d+\\s+)?(?:(\\d+(?::\\d+)?)\\s+)?(${CALLBACK_NAMES.join('|')})\\s*\\(`
);

// Register document symbol provider
export function registerDocumentSymbolProvider(context: LanguageServerContext): void {
    const { connection, documents } = context;

    connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return [];

        const lines = documentCache.getOrCreateLines(document);
        const symbols: DocumentSymbol[] = [];

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];

            if (!line.trim() || isPureCommentLine(line)) {
                continue;
            }

            const { code } = splitCodeAndComment(line);

            const functionSymbol = matchFunction(code, lineIndex, lines);
            if (functionSymbol) {
                symbols.push(functionSymbol);
                continue;
            }

            const callbackSymbol = matchCallback(code, lineIndex, lines);
            if (callbackSymbol) {
                symbols.push(callbackSymbol);
            }
        }

        return symbols;
    });
}

function matchFunction(
    code: string,
    lineIndex: number,
    lines: string[]
): DocumentSymbol | null {
    const match = code.match(EIDOS_FUNCTION_REGEX);
    if (!match) return null;

    const returnType = match[1];
    const functionName = match[2];
    const params = match[3];

    const blockRange = findBlockRange(lineIndex, lines);

    // Create display name with return type and parameters
    const displayName = `(${returnType}) ${functionName}(${params || ''})`;

    // Calculate selection range
    const nameStart = code.indexOf(functionName);
    const selectionRange = Range.create(
        lineIndex, nameStart,
        lineIndex, nameStart + functionName.length
    );

    return {
        name: displayName,
        kind: SymbolKind.Function,
        range: blockRange,
        selectionRange,
        detail: `function`,
    };
}

function matchCallback(
    code: string,
    lineIndex: number,
    lines: string[]
): DocumentSymbol | null {
    const match = code.match(CALLBACK_PATTERN);
    if (!match) return null;

    const tickInfo = match[1];
    const callbackName = match[2];

    const blockRange = findBlockRange(lineIndex, lines);

    const displayName = tickInfo ? `${tickInfo} ${callbackName}()` : `${callbackName}()`;

    // Calculate selection range
    const nameStart = code.indexOf(callbackName);
    const selectionRange = Range.create(
        lineIndex, nameStart,
        lineIndex, nameStart + callbackName.length + 2 // +2 for "()"
    );

    return {
        name: displayName,
        kind: SymbolKind.Method, // Use Method to differentiate from functions
        range: blockRange,
        selectionRange,
        detail: 'callback',
    };
}
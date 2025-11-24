import { decode as decodeHTML } from 'he';
import type { ParseState, ParseOptions } from '../config/types';

export type { ParseState, ParseOptions };

export function expandTypeAbbreviations(text: string): string {
    if (!text) return text;

    return text
        .replace(/\bNi\b/g, 'integer')
        .replace(/\bNl\b/g, 'logical')
        .replace(/\bNs\b/g, 'string')
        .replace(/\bNf\b/g, 'float')
        .replace(/\bNo<([^>]+)>/g, 'object<$1>')
        .replace(/\bNif\b/g, 'integer or float')
        .replace(/\bNis\b/g, 'integer or string')
        .replace(/\bis\b/g, 'integer or string');
}

export function cleanTypeNames(text: string): string {
    if (!text) return text;
    text = text.replace(/(\w+(?:<[^>]+>)?)\$/g, '$1');
    return expandTypeAbbreviations(text);
}

export function cleanSignature(signature: string): string {
    if (!signature) return signature;
    let cleaned = cleanTypeNames(signature);
    return cleaned.replace(/\bobject<([^>]+)>/gi, '<$1>');
}

export function cleanDocumentationText(text: string): string {
    if (!text) return text;

    // Decode HTML entities using 'he' library
    let cleaned = decodeHTML(text);

    // Clean type names
    cleaned = cleanTypeNames(cleaned);

    // Replace "object<ClassType>" with "<ClassType>" in descriptions
    cleaned = cleaned.replace(/\bobject<([^>]+)>/gi, '<$1>');

    // Convert HTML tags to markdown (preserve sub/sup tags)
    cleaned = cleaned
        .replace(/<span[^>]*>/gi, '')
        .replace(/<\/span>/gi, '')
        .replace(/<i>/gi, '*')
        .replace(/<\/i>/gi, '*')
        .replace(/<b>/gi, '**')
        .replace(/<\/b>/gi, '**')
        .replace(/<em>/gi, '*')
        .replace(/<\/em>/gi, '*')
        .replace(/<strong>/gi, '**')
        .replace(/<\/strong>/gi, '**');

    // Clean up multiple spaces
    return cleaned.replace(/\s{2,}/g, ' ');
}

export class StringCommentStateMachine {
    private state: ParseState;
    private readonly options: Required<ParseOptions>;

    constructor(options: ParseOptions = {}) {
        this.options = {
            trackStrings: options.trackStrings ?? true,
            trackComments: options.trackComments ?? true,
            trackMultiLineComments: options.trackMultiLineComments ?? true,
        };
        this.state = {
            inString: false,
            stringChar: null,
            inSingleLineComment: false,
            inMultiLineComment: false,
        };
    }

    getState(): ParseState {
        return { ...this.state };
    }

    processChar(
        char: string,
        prevChar: string | null,
        nextChar: string | null,
        code: string,
        position: number
    ): {
        skipChar: boolean;
        breakLine: boolean;
    } {
        let skipChar = false;
        let breakLine = false;

        if (this.options.trackComments && this.options.trackMultiLineComments) {
            const multiLineResult = this.handleMultiLineComment(char, prevChar, nextChar);
            if (multiLineResult) {
                return { skipChar: multiLineResult.skipChar, breakLine: false };
            }
        }

        if (this.options.trackComments) {
            const singleLineResult = this.handleSingleLineComment(char, nextChar);
            if (singleLineResult) {
                breakLine = true;
                return { skipChar, breakLine };
            }
        }

        if (
            this.options.trackStrings &&
            !this.state.inSingleLineComment &&
            !this.state.inMultiLineComment
        ) {
            this.handleString(char, code, position);
        }

        return { skipChar, breakLine };
    }

    private handleMultiLineComment(
        char: string,
        prevChar: string | null,
        nextChar: string | null
    ): { skipChar: boolean } | null {
        if (
            !this.state.inString &&
            !this.state.inSingleLineComment &&
            !this.state.inMultiLineComment &&
            char === '/' &&
            nextChar === '*'
        ) {
            this.state.inMultiLineComment = true;
            return { skipChar: true };
        }

        if (this.state.inMultiLineComment && prevChar === '*' && char === '/') {
            this.state.inMultiLineComment = false;
            return { skipChar: true };
        }

        return null;
    }

    private handleSingleLineComment(char: string, nextChar: string | null): boolean {
        if (
            !this.state.inString &&
            !this.state.inMultiLineComment &&
            char === '/' &&
            nextChar === '/'
        ) {
            this.state.inSingleLineComment = true;
            return true;
        }
        return false;
    }

    private handleString(char: string, code: string, position: number): void {
        const isEscaped = isEscapedQuote(code, position);
        const quoteChar = char === '"' || char === "'";

        if (!this.state.inString && quoteChar && !isEscaped) {
            this.state.inString = true;
            this.state.stringChar = char;
            return;
        }

        if (this.state.inString && char === this.state.stringChar && !isEscaped) {
            this.state.inString = false;
            this.state.stringChar = null;
            return;
        }
    }
}

export function isEscapedQuote(text: string, position: number): boolean {
    let backslashCount = 0;
    let j = position - 1;
    while (j >= 0 && text[j] === '\\') {
        backslashCount++;
        j--;
    }
    return backslashCount % 2 === 1;
}

export function parseCodeWithStringsAndComments(
    code: string,
    options: ParseOptions = {},
    onChar: ((char: string, state: ParseState, position: number) => void) | null = null,
    onStateChange: ((newState: ParseState) => void) | null = null
): ParseState {
    const stateMachine = new StringCommentStateMachine(options);

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const prevChar = i > 0 ? code[i - 1] : null;
        const nextChar = i < code.length - 1 ? code[i + 1] : null;

        // Process character through state machine
        const { skipChar, breakLine } = stateMachine.processChar(char, prevChar, nextChar, code, i);

        // Notify state change if needed
        if (onStateChange && (skipChar || breakLine)) {
            onStateChange(stateMachine.getState());
        }

        // Call character callback if provided
        if (onChar && !skipChar) {
            onChar(char, stateMachine.getState(), i);
        }

        if (breakLine) break;
        if (skipChar) i++; // Skip next char if we processed a two-char sequence
    }

    return stateMachine.getState();
}

export function countBracesIgnoringStringsAndComments(line: string): {
    openCount: number;
    closeCount: number;
} {
    let openCount = 0;
    let closeCount = 0;

    parseCodeWithStringsAndComments(line, {}, (char, state) => {
        if (!state.inString && !state.inSingleLineComment && !state.inMultiLineComment) {
            if (char === '{') openCount++;
            else if (char === '}') closeCount++;
        }
    });

    return { openCount, closeCount };
}

export function countParenthesesIgnoringStringsAndComments(code: string): {
    openCount: number;
    closeCount: number;
} {
    let openCount = 0;
    let closeCount = 0;

    parseCodeWithStringsAndComments(code, {}, (char, state) => {
        if (!state.inString && !state.inSingleLineComment && !state.inMultiLineComment) {
            if (char === '(') openCount++;
            else if (char === ')') closeCount++;
        }
    });

    return { openCount, closeCount };
}

export function removeFromLine(
    line: string,
    options: { strings?: boolean; comments?: boolean; replaceWithSpace?: boolean } = {}
): string {
    const { strings = false, comments = false, replaceWithSpace = false } = options;

    let result = '';
    let inString = false;
    let stringChar: string | null = null;
    let placeholderIndex = 0;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = i + 1 < line.length ? line[i + 1] : null;
        const isEscaped = isEscapedQuote(line, i);

        // Handle string start
        if (!inString && (char === '"' || char === "'") && !isEscaped) {
            if (strings) {
                inString = true;
                stringChar = char;
                if (replaceWithSpace) {
                    result += ' ';
                } else {
                    result += `__STR${placeholderIndex}__`;
                    placeholderIndex++;
                }
                i++;
                continue;
            }
        }

        // Handle string end
        if (inString && char === stringChar && !isEscaped) {
            inString = false;
            stringChar = null;
            if (replaceWithSpace) {
                result += ' ';
            }
            i++;
            continue;
        }

        // If we're in a string being removed
        if (inString) {
            if (replaceWithSpace) {
                result += ' ';
            }
            i++;
            continue;
        }

        // Handle single-line comments
        if (comments && char === '/' && nextChar === '/') {
            break; // Rest of line is a comment
        }

        // Handle multi-line comments
        if (comments && char === '/' && nextChar === '*') {
            i += 2;
            while (i < line.length - 1) {
                if (line[i] === '*' && line[i + 1] === '/') {
                    i += 2;
                    break;
                }
                i++;
            }
            continue;
        }

        result += char;
        i++;
    }

    return result;
}

// Backward compatibility wrappers
export function removeStringsFromLine(line: string): string {
    return removeFromLine(line, { strings: true });
}

export function removeCommentsFromLine(line: string): string {
    return removeFromLine(line, { comments: true });
}

export function removeCommentsAndStringsFromLine(line: string): string {
    return removeFromLine(line, { strings: true, comments: true, replaceWithSpace: true });
}

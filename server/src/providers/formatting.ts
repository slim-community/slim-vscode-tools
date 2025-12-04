import {
    DocumentFormattingParams,
    DocumentRangeFormattingParams,
    DocumentOnTypeFormattingParams,
    TextEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageServerContext, FormattingOptions } from '../config/types';
import { countBraces, removeStringsAndComments, splitCodeAndComment } from '../utils/text-processing';
import { TEXT_PROCESSING_PATTERNS, FORMATTER_CONFIG } from '../config/config';
import { log } from '../utils/logger';

// Register formatting provider
export function registerFormattingProvider(context: LanguageServerContext): void {
    const { connection, documents } = context;

    connection.onDocumentFormatting((params) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;
        return onDocumentFormatting(params, document, context);
    });

    connection.onDocumentRangeFormatting((params) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;
        return onDocumentRangeFormatting(params, document, context);
    });

    connection.onDocumentOnTypeFormatting((params) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;
        return onDocumentOnTypeFormatting(params, document, context);
    });
}

function formatLines(
    lines: string[],
    initialIndentLevel: number,
    indentString: string
): string {
    const formattedLines: string[] = [];
    let indentLevel = Math.max(0, Math.min(initialIndentLevel, FORMATTER_CONFIG.MAX_INDENT_LEVEL));
    let consecutiveBlankLines = 0;

    for (const line of lines) {
        const trimmed = line.trim();

        // Empty lines - limit consecutive blank lines
        if (!trimmed) {
            consecutiveBlankLines++;
            if (consecutiveBlankLines <= FORMATTER_CONFIG.MAX_CONSECUTIVE_BLANK_LINES) {
                formattedLines.push('');
            }
            continue;
        }

        // Reset blank line counter when we hit content
        consecutiveBlankLines = 0;

        // Comment-only lines - preserve current indent
        if (TEXT_PROCESSING_PATTERNS.COMMENT_LINE.test(trimmed)) {
            formattedLines.push(indentString.repeat(indentLevel) + trimmed);
            continue;
        }

        // Extract code and comment parts
        const { code, comment } = splitCodeAndComment(trimmed);

        if (!code) {
            // Comment-only after splitting
            formattedLines.push(indentString.repeat(indentLevel) + trimmed);
            continue;
        }

        // Normalize whitespace within the code (collapse multiple spaces)
        const normalizedCode = normalizeWhitespace(code);

        // Count braces in clean code (without strings/comments)
        const cleaned = removeStringsAndComments(normalizedCode, false);
        let { openCount, closeCount } = countBraces(cleaned);

        // Dedent for closing braces at start
        if (trimmed.startsWith('}')) {
            indentLevel = Math.max(0, indentLevel - 1);
            // We've already accounted for the leading closing brace, so don't count it again
            closeCount = Math.max(0, closeCount - 1);
        }

        // Format line with normalized whitespace
        const formatted = indentString.repeat(indentLevel) + normalizedCode + comment;
        formattedLines.push(formatted);

        // Update indent level based on remaining brace difference
        indentLevel += openCount - closeCount;
        
        // Clamp indent level to reasonable bounds
        indentLevel = Math.max(0, Math.min(indentLevel, FORMATTER_CONFIG.MAX_INDENT_LEVEL));
    }

    return formattedLines.join('\n');
}

export function formatSLiMCode(text: string, options: FormattingOptions): string {
    // Validate input
    if (!text || typeof text !== 'string') {
        return text || '';
    }

    const normalizedOptions = normalizeOptions(options);
    const indentString = normalizedOptions.insertSpaces 
        ? ' '.repeat(normalizedOptions.tabSize) 
        : '\t';
    const lines = text.split(/\r?\n/);

    return formatLines(lines, 0, indentString);
}

function formatRange(
    text: string,
    startLine: number,
    endLine: number,
    options: FormattingOptions
): string {
    // Validate input
    if (!text || typeof text !== 'string') {
        return text || '';
    }

    const lines = text.split(/\r?\n/);
    
    // Validate line numbers
    const validStartLine = Math.max(0, Math.min(startLine, lines.length - 1));
    const validEndLine = Math.max(validStartLine, Math.min(endLine, lines.length - 1));

    // Calculate initial indent level from context
    const contextIndentLevel = calculateContextIndentLevel(lines, validStartLine);

    // Format only the selected range
    const normalizedOptions = normalizeOptions(options);
    const indentString = normalizedOptions.insertSpaces 
        ? ' '.repeat(normalizedOptions.tabSize) 
        : '\t';
    const rangeLines = lines.slice(validStartLine, validEndLine + 1);

    return formatLines(rangeLines, contextIndentLevel, indentString);
}

export function onDocumentFormatting(
    params: DocumentFormattingParams,
    document: TextDocument,
    _context: LanguageServerContext
): TextEdit[] | null {
    try {
        log(`Formatting document: ${params.textDocument.uri}`);

        const text = document.getText();
        
        // Early return for empty documents
        if (!text || text.trim().length === 0) {
            return null;
        }

        const formatted = formatSLiMCode(text, {
            tabSize: params.options.tabSize,
            insertSpaces: params.options.insertSpaces,
        });

        // If formatting didn't change anything, return null (no edits needed)
        if (formatted === text) {
            return null;
        }

        // Return a single edit that replaces the entire document
        const lines = text.split('\n');
        return [
            {
                range: {
                    start: { line: 0, character: 0 },
                    end: {
                        line: Math.max(0, document.lineCount - 1),
                        character: lines[document.lineCount - 1]?.length || 0,
                    },
                },
                newText: formatted,
            },
        ];
    } catch (error) {
        log(`Error formatting document: ${error}`);
        return null;
    }
}

export function onDocumentRangeFormatting(
    params: DocumentRangeFormattingParams,
    document: TextDocument,
    _context: LanguageServerContext
): TextEdit[] | null {
    try {
        log(`Formatting range: ${params.textDocument.uri}`);

        const text = document.getText();
        
        // Early return for empty documents
        if (!text || text.trim().length === 0) {
            return null;
        }

        const { start, end } = params.range;
        
        // Validate range
        if (start.line < 0 || end.line < 0 || start.line > end.line) {
            log(`Invalid range for formatting: ${start.line} to ${end.line}`);
            return null;
        }

        const formatted = formatRange(text, start.line, end.line, {
            tabSize: params.options.tabSize,
            insertSpaces: params.options.insertSpaces,
        });

        const lines = text.split('\n');
        const validEndLine = Math.min(end.line, lines.length - 1);
        const endChar = lines[validEndLine]?.length || 0;

        return [
            {
                range: {
                    start: { line: start.line, character: 0 },
                    end: { line: validEndLine, character: endChar },
                },
                newText: formatted,
            },
        ];
    } catch (error) {
        log(`Error formatting range: ${error}`);
        return null;
    }
}

export function onDocumentOnTypeFormatting(
    params: DocumentOnTypeFormattingParams,
    document: TextDocument,
    _context: LanguageServerContext
): TextEdit[] | null {
    try {
        const { position, ch } = params;
        const currentLine = position.line;

        // Only format on newline or closing brace
        if (ch !== '\n' && ch !== '}') {
            return null;
        }

        const text = document.getText();
        
        // Early return for empty documents
        if (!text || text.trim().length === 0) {
            return null;
        }

        const lines = text.split('\n');
        
        // Validate line number
        if (currentLine < 0 || currentLine >= lines.length) {
            return null;
        }

        if (ch === '\n') {
            // Format the previous line and the current (new) line
            const startLine = Math.max(0, currentLine - 1);
            const endLine = Math.min(currentLine, lines.length - 1);

            const formatted = formatRange(text, startLine, endLine, {
                tabSize: params.options.tabSize,
                insertSpaces: params.options.insertSpaces,
            });

            const endChar = lines[endLine]?.length || 0;

            return [
                {
                    range: {
                        start: { line: startLine, character: 0 },
                        end: { line: endLine, character: endChar },
                    },
                    newText: formatted,
                },
            ];
        } else if (ch === '}') {
            // Format just the current line when closing brace is typed
            const formatted = formatRange(text, currentLine, currentLine, {
                tabSize: params.options.tabSize,
                insertSpaces: params.options.insertSpaces,
            });

            const endChar = lines[currentLine]?.length || 0;

            return [
                {
                    range: {
                        start: { line: currentLine, character: 0 },
                        end: { line: currentLine, character: endChar },
                    },
                    newText: formatted,
                },
            ];
        }

        return null;
    } catch (error) {
        log(`Error on-type formatting: ${error}`);
        return null;
    }
}

// Helper function to normalize whitespace in the code
function normalizeWhitespace(code: string): string {
    if (!code || !code.trim()) {
        return code;
    }

    let result = '';
    let inString = false;
    let stringChar = '';
    let lastWasSpace = false;

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const prevChar = i > 0 ? code[i - 1] : '';

        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
            result += char;
            lastWasSpace = false;
            continue;
        }

        if (inString && char === stringChar && prevChar !== '\\') {
            inString = false;
            result += char;
            lastWasSpace = false;
            continue;
        }

        // Inside strings, preserve all whitespace
        if (inString) {
            result += char;
            continue;
        }

        // Outside strings, collapse multiple spaces to one
        if (char === ' ' || char === '\t') {
            if (!lastWasSpace) {
                result += ' ';
                lastWasSpace = true;
            }
            continue;
        }

        result += char;
        lastWasSpace = false;
    }

    return result;
}

// Helper function to calculate the context indent level
function calculateContextIndentLevel(lines: string[], upToLine: number): number {
    let contextIndentLevel = 0;
    
    for (let i = 0; i < upToLine && i < lines.length; i++) {
        const line = lines[i];
        const cleaned = removeStringsAndComments(line, false);
        const { openCount, closeCount } = countBraces(cleaned);
        contextIndentLevel += openCount - closeCount;
    }
    
    return Math.max(0, Math.min(contextIndentLevel, FORMATTER_CONFIG.MAX_INDENT_LEVEL));
}

// Helper function to normalize the formatting options
function normalizeOptions(options: Partial<FormattingOptions>): FormattingOptions {
    return {
        tabSize: Math.max(1, Math.min(options.tabSize || 4, 20)),
        insertSpaces: options.insertSpaces !== false,
    };
}
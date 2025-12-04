import { WordInfo, WordInfoWithRange } from '../config/types';
import { resolveClassName } from './type-manager';
import { TWO_CHAR_OPS, SINGLE_CHAR_OPS, IDENTIFIER_PATTERNS, EIDOS_FUNCTION_REGEX } from '../config/config';
import { Position, Range } from 'vscode-languageserver';
import { parseEidosFunctionParameters } from './eidos-function-parser';
import { escapeRegex } from './text-processing';

// Helper function to get the word at a position with its range
export function getWordAtPositionWithRange(text: string, position: Position): WordInfoWithRange | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];
    const character = position.character;

    // Try to find quoted identifier first
    const quotedResult = getQuotedWordAtPosition(line, position.line, character);
    if (quotedResult) return quotedResult;

    // Fall back to regular word
    return getUnquotedWordAtPosition(line, position.line, character);
}

// Helper function to get a quoted word at a position
function getQuotedWordAtPosition(
    line: string,
    lineIndex: number,
    character: number
): WordInfoWithRange | null {
    // Check if cursor is on or right after opening quote
    if (line[character] === '"' || (character > 0 && line[character - 1] === '"')) {
        const start = line[character] === '"' ? character + 1 : character;
        let end = start;
        while (end < line.length && line[end] !== '"') {
            end++;
        }
        if (end < line.length && end > start) {
            return {
                word: line.substring(start, end),
                isQuoted: true,
                range: Range.create(lineIndex, start - 1, lineIndex, end + 1)
            };
        }
    }

    // Check if cursor is inside a quoted string
    let quoteStart = -1;
    for (let i = character - 1; i >= 0; i--) {
        if (line[i] === '"') {
            quoteStart = i;
            break;
        }
    }
    
    if (quoteStart !== -1) {
        const quoteEnd = line.indexOf('"', quoteStart + 1);
        if (quoteEnd !== -1 && character >= quoteStart && character <= quoteEnd) {
            return {
                word: line.substring(quoteStart + 1, quoteEnd),
                isQuoted: true,
                range: Range.create(lineIndex, quoteStart, lineIndex, quoteEnd + 1)
            };
        }
    }

    return null;
}

// Helper function to get an unquoted word at a position
function getUnquotedWordAtPosition(
    line: string,
    lineIndex: number,
    character: number
): WordInfoWithRange | null {
    const wordChar = /[a-zA-Z0-9_]/;

    // Move start back to beginning of word
    let start = character;
    while (start > 0 && wordChar.test(line[start - 1])) {
        start--;
    }

    // Move end forward to end of word
    let end = character;
    while (end < line.length && wordChar.test(line[end])) {
        end++;
    }

    if (start === end) return null;

    return {
        word: line.substring(start, end),
        isQuoted: false,
        range: Range.create(lineIndex, start, lineIndex, end)
    };
}

// Helper function to get the operator at a position
export function getOperatorAtPosition(text: string, position: Position): string | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];
    if (position.character >= line.length) return null;

    // Check multi-character operators first
    for (const op of TWO_CHAR_OPS) {
        const startPos = Math.max(0, position.character - op.length + 1);
        const endPos = Math.min(line.length, position.character + op.length);
        const substr = line.substring(startPos, endPos);

        for (let i = 0; i <= substr.length - op.length; i++) {
            if (substr.substring(i, i + op.length) === op) {
                const opStart = startPos + i;
                if (position.character >= opStart && position.character < opStart + op.length) {
                    return op;
                }
            }
        }
    }

    // Check single-character operators
    const char = line[position.character];
    if (char && SINGLE_CHAR_OPS.includes(char)) {
        // Skip if part of multi-char operator
        if (char === '<' || char === '>') {
            const nextChar = line[position.character + 1] || '';
            const prevChar = line[position.character - 1] || '';
            if (
                (char === '<' && (nextChar === '=' || nextChar === '-')) ||
                (char === '>' && (nextChar === '=' || prevChar === '-'))
            ) {
                return null;
            }
        }
        return char;
    }

    return null;
}

// Helper function to get the word and context at a position
export function getWordAndContextAtPosition(
    text: string,
    position: Position,
    instanceDefinitions: Record<string, string> = {}
): WordInfo | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    if (!line) {
        return null;
    }

    // Create fresh regex instances to avoid lastIndex state issues with global patterns
    const wordRegex = new RegExp(IDENTIFIER_PATTERNS.WORD.source, 'g');
    const dotRegex = new RegExp(IDENTIFIER_PATTERNS.DOT_WITH_MEMBER.source, 'g');

    // Check for simple method/property access pattern
    let dotMatch: RegExpExecArray | null;
    while ((dotMatch = dotRegex.exec(line)) !== null) {
        const start = dotMatch.index;
        const end = dotMatch.index + dotMatch[0].length;
        const objectNameEnd = dotMatch.index + dotMatch[1].length;
        
        if (position.character >= start && position.character <= end) {
            // If cursor is on the object name (before or at the dot), show object info
            if (position.character <= objectNameEnd) {
                const instanceClass = resolveClassName(dotMatch[1], instanceDefinitions);
                return {
                    word: dotMatch[1],
                    wordContext: {
                        isMethodOrProperty: false,
                        instanceClass: instanceClass || undefined,
                    },
                };
            }
            
            // If cursor is after the dot, show method/property info
            const className = resolveClassName(dotMatch[1], instanceDefinitions) || dotMatch[1];
            return {
                word: dotMatch[2] || '',
                wordContext: {
                    isMethodOrProperty: true,
                    className: className,
                    instanceName: dotMatch[1],
                },
            };
        }
    }

    // Find the word at cursor position
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(line)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (position.character >= start && position.character <= end) {
            // Use resolveClassName for better type inference (includes pattern matching)
            const instanceClass = resolveClassName(match[0], instanceDefinitions);
            return {
                word: match[0],
                wordContext: {
                    isMethodOrProperty: false,
                    instanceClass: instanceClass || undefined,
                },
            };
        }
    }

    return null;
}

// Helper function to get the position of a function name in a function signature
export function getFunctionNamePosition(line: string): { start: number; end: number } | null {
    const match = line.match(EIDOS_FUNCTION_REGEX);
    if (!match || match.index === undefined) return null;

    const functionName = match[2];
    const beforeName = match[0].substring(0, match[0].indexOf(functionName));
    const start = match.index + beforeName.length;
    const end = start + functionName.length;

    return { start, end };
}

// Helper function to get the position of a parameter in a function signature
export function getParameterPosition(
    line: string,
    parameterName: string
): { start: number; end: number } | null {
    const match = line.match(EIDOS_FUNCTION_REGEX);
    if (!match || match.index === undefined) return null;

    const paramsString = match[3];
    const params = parseEidosFunctionParameters(paramsString);
    
    const param = params.find(p => p.name === parameterName);
    if (!param) return null;

    // Find the parameter in the original parameters string
    const paramRegex = new RegExp(`\\b${escapeRegex(parameterName)}\\b`);
    const paramMatch = paramRegex.exec(paramsString);
    if (!paramMatch) return null;

    // Calculate absolute position in the line
    const paramsStartInMatch = match[0].indexOf(paramsString);
    const start = match.index + paramsStartInMatch + paramMatch.index;
    const end = start + parameterName.length;

    return { start, end };
}
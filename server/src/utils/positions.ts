import { WordInfo } from '../config/types';
import { instanceDefinitions } from './instance';
import { resolveClassName } from './type-manager';
import { TWO_CHAR_OPS, SINGLE_CHAR_OPS } from '../config/config';
import { Position } from 'vscode-languageserver';

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

export function getWordAndContextAtPosition(
    text: string,
    position: Position,
): WordInfo | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    if (!line) {
        return null;
    }

    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const dotRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)?/g;

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

export function getAutocompleteContextAtPosition(
    text: string,
    position: Position,
): WordInfo | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const lineUptoCursor = line.slice(0, position.character);

    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const dotRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*$/;

    // Check for simple method/property access pattern
    const dotMatch = lineUptoCursor.match(dotRegex);
    if (dotMatch) {
        // Use resolveClassName for better type inference (includes pattern matching)
        const className = resolveClassName(dotMatch[1], instanceDefinitions) || dotMatch[1];
        return {
            word: '',
            wordContext: {
                isMethodOrProperty: true,
                className: className,
                instanceName: dotMatch[1],
            },
        };
    }

    // Find the word at cursor position
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(lineUptoCursor)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (position.character >= start && position.character <= end) {
            return {
                word: match[0],
                wordContext: {
                    isMethodOrProperty: false,
                },
            };
        }
    }

    return null;
}


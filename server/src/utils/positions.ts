import { Position } from 'vscode-languageserver';
import { IDENTIFIER_PATTERNS } from '../config/config';
import { WordContext } from '../config/types';

export interface WordInfo {
    word: string;
    context: WordContext;
}

export interface PositionOptions {
    resolveClassName?: (
        instanceName: string,
        instanceDefinitions: Record<string, string>
    ) => string | null;
    instanceDefinitions?: Record<string, string>;
    classesData?: Record<string, unknown>;
    inferTypeFromExpression?: (expr: string) => string | null;
}

const TWO_CHAR_OPS = ['==', '!=', '<=', '>=', '&&', '||', '<-', '->'];
const SINGLE_CHAR_OPS = [
    ':',
    '[',
    ']',
    '+',
    '-',
    '*',
    '/',
    '%',
    '^',
    '|',
    '&',
    '!',
    '<',
    '>',
    '=',
    '?',
    '(',
    ')',
    '.',
];

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
    if (char && SINGLE_CHAR_OPS.includes(char as any)) {
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

function resolveClass(
    instanceName: string,
    options: PositionOptions,
    lineUptoCursor?: string
): string | undefined {
    const { resolveClassName, instanceDefinitions = {}, inferTypeFromExpression } = options;

    // Try resolver function
    if (resolveClassName) {
        const resolved = resolveClassName(instanceName, instanceDefinitions);
        if (resolved) return resolved;
    }

    // Try instance definitions
    const fromDefs = instanceDefinitions[instanceName];
    if (fromDefs) return fromDefs;

    // Try type inference
    if (inferTypeFromExpression && lineUptoCursor) {
        const inferred = inferTypeFromExpression(lineUptoCursor);
        if (inferred) return inferred;
    }

    // Return undefined if no resolution found
    return undefined;
}

export function getWordAndContextAtPosition(
    text: string,
    position: Position,
    options: PositionOptions = {}
): WordInfo | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];
    const lineUptoCursor = line.slice(0, position.character);

    // Check for dot pattern (object.member)
    const dotRegex = IDENTIFIER_PATTERNS.DOT_WITH_MEMBER;
    dotRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = dotRegex.exec(line)) !== null) {
        if (match.index === undefined) continue;
        const start = match.index;
        const dotPos = start + match[1].length;
        const end = start + match[0].length;

        if (position.character >= start && position.character <= end) {
            if (position.character < dotPos) {
                // Cursor on object name
                const instanceClass = resolveClass(match[1], options);
                return {
                    word: match[1],
                    context: { isMethodOrProperty: false, instanceClass },
                };
            } else {
                // Cursor on member name
                const className = resolveClass(match[1], options, lineUptoCursor);
                return {
                    word: match[2] || '',
                    context: {
                        isMethodOrProperty: true,
                        className,
                        instanceName: match[1],
                    },
                };
            }
        }
    }

    // Find word at cursor
    const wordRegex = IDENTIFIER_PATTERNS.WORD;
    wordRegex.lastIndex = 0;

    while ((match = wordRegex.exec(line)) !== null) {
        if (match.index === undefined) continue;
        const start = match.index;
        const end = start + match[0].length;

        if (position.character >= start && position.character <= end) {
            const word = match[0];
            const instanceClass = resolveClass(word, options);

            // Return word info with or without instanceClass
            // Functions, callbacks, and types won't have an instanceClass
            return {
                word,
                context: { isMethodOrProperty: false, instanceClass },
            };
        }
    }

    return null;
}

export function getAutocompleteContextAtPosition(
    text: string,
    position: Position,
    options: PositionOptions = {}
): WordInfo | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];
    const lineUptoCursor = line.slice(0, position.character);

    // Check for dot pattern (completing after "object.")
    const dotMatch = lineUptoCursor.match(IDENTIFIER_PATTERNS.DOT_PATTERN);
    if (dotMatch) {
        const className = resolveClass(dotMatch[1], options);
        return {
            word: '',
            context: {
                isMethodOrProperty: true,
                className,
                instanceName: dotMatch[1],
            },
        };
    }

    // Find word being typed
    const wordRegex = IDENTIFIER_PATTERNS.WORD;
    wordRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(lineUptoCursor)) !== null) {
        if (match.index === undefined) continue;
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
            return {
                word: match[0],
                context: { isMethodOrProperty: false },
            };
        }
    }

    return null;
}

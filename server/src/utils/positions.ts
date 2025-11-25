import { WordInfo } from '../config/types';
import { instanceDefinitions, instanceToClassMap } from './instance';

export function getWordAndContextAtPosition(
    text: string,
    position: { line: number; character: number }
): WordInfo | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];

    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const dotRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)?/g;

    // Check for method/property access pattern
    let dotMatch: RegExpExecArray | null;
    while ((dotMatch = dotRegex.exec(line)) !== null) {
        const start = dotMatch.index;
        const end = dotMatch.index + dotMatch[0].length;
        if (position.character >= start && position.character <= end) {
            const className = instanceDefinitions[dotMatch[1]] || dotMatch[1];
            return {
                word: dotMatch[2] || '',
                context: {
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
            const instanceClass = instanceDefinitions[match[0]] || instanceToClassMap[match[0]];
            return {
                word: match[0],
                context: {
                    isMethodOrProperty: false,
                    instanceClass: instanceClass,
                },
            };
        }
    }

    return null;
}

export function getAutocompleteContextAtPosition(
    text: string,
    position: { line: number; character: number }
): WordInfo | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];
    const lineUptoCursor = line.slice(0, position.character);

    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const dotRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*$/;

    // Check for method/property access pattern
    const dotMatch = lineUptoCursor.match(dotRegex);
    if (dotMatch) {
        const className =
            instanceDefinitions[dotMatch[1]] || instanceToClassMap[dotMatch[1]] || dotMatch[1];
        return {
            word: '',
            context: {
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
                context: {
                    isMethodOrProperty: false,
                },
            };
        }
    }

    return null;
}


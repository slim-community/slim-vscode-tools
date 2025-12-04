import {
    DefinitionParams,
    Location,
    Position,
    Range
} from 'vscode-languageserver';
import { LanguageServerContext, TrackingState } from '../config/types';
import { trackInstanceDefinitions } from '../utils/instance';
import { CALLBACK_PSEUDO_PARAMETERS } from '../config/config';
import { escapeRegex } from '../utils/text-processing';
import { getWordAtPositionWithRange } from '../utils/positions';
import { extractParameterNames } from '../utils/eidos-function-parser';
import { documentCache } from '../services/document-cache';

// Register definition provider
export function registerDefinitionProvider(context: LanguageServerContext): void {
    const { connection, documents } = context;

    connection.onDefinition((params: DefinitionParams): Location | Location[] | null => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;

        const text = document.getText();
        const lines = documentCache.getOrCreateLines(document);
        const position = params.position;
        
        const wordInfo = getWordAtPositionWithRange(text, position);
        if (!wordInfo) return null;

        const trackingState = trackInstanceDefinitions(document);

        return findDefinition(
            lines, 
            wordInfo.word,
            position,
            params.textDocument.uri,
            trackingState
        );
    });
}

// Find the definition of the word at the cursor position
function findDefinition(
    lines: string[],
    word: string,
    cursorPosition: Position,
    uri: string,
    trackingState: TrackingState
): Location | null {

    // Priority 1: Check callback pseudo-parameters first (if we're in a callback scope)
    const callbackName = trackingState.callbackContextByLine?.get(cursorPosition.line);
    if (callbackName) {
        const pseudoParams = CALLBACK_PSEUDO_PARAMETERS[callbackName] || {};
        if (word in pseudoParams) {
            const callbackPattern = callbackName.replace('()', '');
            const callbackRegex = new RegExp(`\\b${escapeRegex(callbackPattern)}\\s*\\(`);
            
            for (let i = cursorPosition.line; i >= 0; i--) {
                const line = lines[i].trim();
                if (!line.startsWith('//') && callbackRegex.test(lines[i])) {
                    return Location.create(uri, Range.create(
                        i, 0,
                        i, lines[i].length
                    ));
                }
            }
        }
    }

    // Priority 2: Check tracked definitions (constants, mutation types, etc.)
    if (trackingState.definedConstants?.has(word)) {
        const defLine = findFirstOccurrence(lines, `defineConstant("${word}"`, cursorPosition.line);
        if (defLine !== -1) {
            const match = lines[defLine].match(new RegExp(`defineConstant\\s*\\(\\s*["']${escapeRegex(word)}["']`));
            if (match) {
                const startChar = lines[defLine].indexOf(word, lines[defLine].indexOf('defineConstant'));
                return Location.create(uri, Range.create(
                    defLine, startChar,
                    defLine, startChar + word.length
                ));
            }
        }
    }

    if (trackingState.definedMutationTypes?.has(word)) {
        const defLine = findFirstOccurrence(lines, `initializeMutationType("${word}"`, cursorPosition.line);
        if (defLine !== -1) {
            const startChar = lines[defLine].indexOf(`"${word}"`);
            if (startChar !== -1) {
                return Location.create(uri, Range.create(
                    defLine, startChar + 1,
                    defLine, startChar + 1 + word.length
                ));
            }
        }
    }

    if (trackingState.definedGenomicElementTypes?.has(word)) {
        const defLine = findFirstOccurrence(lines, `initializeGenomicElementType("${word}"`, cursorPosition.line);
        if (defLine !== -1) {
            const startChar = lines[defLine].indexOf(`"${word}"`);
            if (startChar !== -1) {
                return Location.create(uri, Range.create(
                    defLine, startChar + 1,
                    defLine, startChar + 1 + word.length
                ));
            }
        }
    }

    if (trackingState.definedInteractionTypes?.has(word)) {
        const defLine = findFirstOccurrence(lines, `initializeInteractionType("${word}"`, cursorPosition.line);
        if (defLine !== -1) {
            const startChar = lines[defLine].indexOf(`"${word}"`);
            if (startChar !== -1) {
                return Location.create(uri, Range.create(
                    defLine, startChar + 1,
                    defLine, startChar + 1 + word.length
                ));
            }
        }
    }

    if (trackingState.definedSubpopulations?.has(word)) {
        const subpopPattern = `addSubpop("${word}"`;
        let defLine = findFirstOccurrence(lines, subpopPattern, cursorPosition.line);
        if (defLine !== -1) {
            const startChar = lines[defLine].indexOf(`"${word}"`);
            if (startChar !== -1) {
                return Location.create(uri, Range.create(
                    defLine, startChar + 1,
                    defLine, startChar + 1 + word.length
                ));
            }
        }
        
        const splitPattern = `addSubpopSplit("${word}"`;
        defLine = findFirstOccurrence(lines, splitPattern, cursorPosition.line);
        if (defLine !== -1) {
            const startChar = lines[defLine].indexOf(`"${word}"`);
            if (startChar !== -1) {
                return Location.create(uri, Range.create(
                    defLine, startChar + 1,
                    defLine, startChar + 1 + word.length
                ));
            }
        }
        
        // If word is in p<num> format, also search for numeric ID definition
        const pNumMatch = word.match(/^p(\d+)$/);
        if (pNumMatch) {
            const numericId = pNumMatch[1];
            
            const numericPattern = new RegExp(`addSubpop\\s*\\(\\s*${escapeRegex(numericId)}\\s*,`);
            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(numericPattern);
                if (match && match.index !== undefined) {
                    const idStart = match.index + match[0].indexOf(numericId);
                    return Location.create(uri, Range.create(
                        i, idStart,
                        i, idStart + numericId.length
                    ));
                }
            }
            
            const splitNumericPattern = new RegExp(`addSubpopSplit\\s*\\(\\s*${escapeRegex(numericId)}\\s*,`);
            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(splitNumericPattern);
                if (match && match.index !== undefined) {
                    const idStart = match.index + match[0].indexOf(numericId);
                    return Location.create(uri, Range.create(
                        i, idStart,
                        i, idStart + numericId.length
                    ));
                }
            }
        }
    }

    if (trackingState.definedSpecies?.has(word)) {
        const defLine = findFirstOccurrence(lines, `species ${word} initialize`, cursorPosition.line);
        if (defLine !== -1) {
            const match = lines[defLine].match(new RegExp(`species\\s+(${escapeRegex(word)})\\s+initialize`));
            if (match && match.index !== undefined) {
                const startChar = match.index + match[0].indexOf(word);
                return Location.create(uri, Range.create(
                    defLine, startChar,
                    defLine, startChar + word.length
                ));
            }
        }
    }

    // Priority 3: Check for function definitions
    const funcPattern = new RegExp(`^\\s*function\\s*\\([^)]+\\)\\s*${escapeRegex(word)}\\s*\\(`);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (funcPattern.test(line)) {
            const match = line.match(new RegExp(`function\\s*\\([^)]+\\)\\s*(${escapeRegex(word)})\\s*\\(`));
            if (match && match.index !== undefined) {
                const startChar = match.index + match[0].indexOf(word);
                return Location.create(uri, Range.create(
                    lineIndex, startChar,
                    lineIndex, startChar + word.length
                ));
            }
        }
    }

    // Priority 4: Check for function parameters
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const funcMatch = line.match(/function\s*\([^)]+\)\s*\w+\s*\(([^)]*)\)/);
        if (funcMatch) {
            const paramsString = funcMatch[1];
            const params = extractParameterNames(paramsString);
            
            if (params.includes(word)) {
                const paramRegex = new RegExp(`\\b${escapeRegex(word)}\\b`);
                const paramMatch = paramRegex.exec(paramsString);
                if (paramMatch) {
                    const paramStart = funcMatch.index! + funcMatch[0].indexOf(paramsString) + paramMatch.index;
                    return Location.create(uri, Range.create(
                        lineIndex, paramStart,
                        lineIndex, paramStart + word.length
                    ));
                }
            }
        }
    }

    // Priority 5: Check for variable declarations
    const assignmentPattern = new RegExp(`^\\s*${escapeRegex(word)}\\s*=`);
    for (let lineIndex = 0; lineIndex < cursorPosition.line; lineIndex++) {
        const line = lines[lineIndex];
        if (assignmentPattern.test(line)) {
            const match = line.match(new RegExp(`^\\s*(${escapeRegex(word)})\\s*=`));
            if (match && match.index !== undefined) {
                const startChar = match.index + match[0].indexOf(word);
                return Location.create(uri, Range.create(
                    lineIndex, startChar,
                    lineIndex, startChar + word.length
                ));
            }
        }
    }

    // Priority 6: Check for loop variables
    const forLoopPattern = new RegExp(`for\\s*\\(\\s*${escapeRegex(word)}\\s+in\\s+`);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (forLoopPattern.test(line)) {
            const match = line.match(new RegExp(`for\\s*\\(\\s*(${escapeRegex(word)})\\s+in`));
            if (match && match.index !== undefined) {
                const startChar = match.index + match[0].indexOf(word);
                return Location.create(uri, Range.create(
                    lineIndex, startChar,
                    lineIndex, startChar + word.length
                ));
            }
        }
    }

    return null;
}

// Find the first occurrence of the pattern in the lines
function findFirstOccurrence(lines: string[], pattern: string, cursorLine: number): number {
    // Search backwards first
    for (let i = cursorLine; i >= 0; i--) {
        if (lines[i].includes(pattern)) {
            return i;
        }
    }
    
    // Search forward if not found
    for (let i = cursorLine + 1; i < lines.length; i++) {
        if (lines[i].includes(pattern)) {
            return i;
        }
    }
    
    return -1;
}
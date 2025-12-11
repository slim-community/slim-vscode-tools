import {
    ReferenceParams,
    Location,
    Range
} from 'vscode-languageserver';
import { LanguageServerContext, TrackingState, WordInfoWithRange } from '../config/types';
import { trackInstanceDefinitions } from '../utils/instance';
import { escapeRegex, isInComment, isInStringLiteral, isPureCommentLine } from '../utils/text-processing';
import { getCommentRanges } from '../utils/ranges';
import { getWordAtPositionWithRange } from '../utils/positions';
import { CALLBACK_PSEUDO_PARAMETERS, DEFINITION_PATTERNS, QUOTED_DEFINITION_FUNCTION_PATTERNS, COMPILED_CALLBACK_PATTERNS } from '../config/config';
import { extractParameterNames } from '../utils/eidos-function-parser';
import { documentCache } from '../services/document-cache';

// Register references provider
export function registerReferencesProvider(context: LanguageServerContext): void {
    const { connection, documents } = context;

    connection.onReferences((params: ReferenceParams): Location[] => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return [];

        const text = document.getText();
        const lines = documentCache.getOrCreateLines(document);
        const position = params.position;
        
        // Get the word at cursor position
        const wordInfo = getWordAtPositionWithRange(text, position);
        if (!wordInfo) return [];

        // Use cached tracking state for context awareness
        const trackingState = trackInstanceDefinitions(document);

        // Find all references to this word
        return findAllReferences(
            lines,
            wordInfo,
            params.textDocument.uri,
            params.context.includeDeclaration,
            trackingState
        );
    });
}


function findAllReferences(
    lines: string[],
    wordInfo: WordInfoWithRange,
    uri: string,
    includeDeclaration: boolean,
    trackingState: TrackingState
): Location[] {
    const { word, isQuoted } = wordInfo;
    const references: Location[] = [];

    if (isQuoted) {
        findQuotedReferences(lines, word, uri, includeDeclaration, references);
    }
    
    findUnquotedReferences(lines, word, uri, includeDeclaration, trackingState, references);

    return references;
}

function findQuotedReferences(
    lines: string[],
    word: string,
    uri: string,
    includeDeclaration: boolean,
    references: Location[]
): void {
    const quotedPattern = new RegExp(`"${escapeRegex(word)}"`, 'g');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (isPureCommentLine(line)) continue;

        const commentRanges = getCommentRanges(line);
        quotedPattern.lastIndex = 0;
        
        let match: RegExpExecArray | null;
        while ((match = quotedPattern.exec(line)) !== null) {
            const matchIndex = match.index;
            
            if (isInComment(matchIndex, commentRanges)) continue;
            
            const isDeclaration = isQuotedDefinitionContext(line, matchIndex);
            if (isDeclaration && !includeDeclaration) continue;
            
            references.push(Location.create(uri, Range.create(
                lineIndex, matchIndex,
                lineIndex, matchIndex + word.length + 2 // +2 for quotes
            )));
        }
    }
}

function findUnquotedReferences(
    lines: string[],
    word: string,
    uri: string,
    includeDeclaration: boolean,
    trackingState: TrackingState,
    references: Location[]
): void {
    const wordPattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'g');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (isPureCommentLine(line)) continue;

        const commentRanges = getCommentRanges(line);
        wordPattern.lastIndex = 0;
        
        let match: RegExpExecArray | null;
        while ((match = wordPattern.exec(line)) !== null) {
            const matchIndex = match.index;
            
            if (isInComment(matchIndex, commentRanges)) continue;
            if (isInStringLiteral(line, matchIndex)) continue;
            
            const isDeclaration = isUnquotedDefinitionContext(
                line, word, matchIndex, lineIndex, trackingState
            );
            if (isDeclaration && !includeDeclaration) continue;
            
            references.push(Location.create(uri, Range.create(
                lineIndex, matchIndex,
                lineIndex, matchIndex + word.length
            )));
        }
    }
}

// Helper function to check if the word is in a quoted definition context
function isQuotedDefinitionContext(line: string, index: number): boolean {
    const before = line.substring(0, index).trim();
    return QUOTED_DEFINITION_FUNCTION_PATTERNS.some(pattern => pattern.test(before));
}

// Helper function to check if the word is in an unquoted definition context
function isUnquotedDefinitionContext(
    line: string,
    word: string,
    index: number,
    lineIndex: number,
    trackingState: TrackingState
): boolean {
    const before = line.substring(0, index).trim();
    const after = line.substring(index + word.length).trim();
    
    // Variable assignment: word = ... (but not comparison == or regex =~)
    if (after.startsWith('=') && !after.startsWith('==') && !after.startsWith('=~')) {
        // Make sure it's not part of a compound operator (+=, -=, etc.)
        if (!before.match(/[+\-*/<>!&|]$/)) {
            return true;
        }
    }
    
    // Function definition
    if (before.match(/\bfunction\s*\([^)]+\)\s*$/)) {
        return true;
    }
    
    // Function parameter definition
    if (isFunctionParameterDefinition(line, word)) {
        return true;
    }
    
    // For loop variable
    if (before.match(/\bfor\s*\(\s*$/) && after.startsWith(' in ')) {
        return true;
    }
    
    // Callback pseudo-parameter on callback declaration line
    if (isCallbackPseudoParameterDefinition(line, word, lineIndex, trackingState)) {
        return true;
    }

    return false;
}

// Helper function to check if the word is in a function parameter definition
function isFunctionParameterDefinition(line: string, word: string): boolean {
    const funcMatch = line.match(DEFINITION_PATTERNS.USER_FUNCTION);
    if (!funcMatch) {
        const funcParamMatch = line.match(/function\s*\([^)]+\)\s*\w+\s*\(([^)]*)\)/);
        if (funcParamMatch) {
            const paramsString = funcParamMatch[1];
            const params = extractParameterNames(paramsString);
            return params.includes(word);
        }
    }
    return false;
}

// Helper function to check if the word is in a callback pseudo-parameter definition
function isCallbackPseudoParameterDefinition(
    line: string,
    word: string,
    currentLineIndex: number,
    trackingState: TrackingState
): boolean {
    const callbackName = trackingState.callbackContextByLine?.get(currentLineIndex);
    if (!callbackName) return false;
    
    const pseudoParams = CALLBACK_PSEUDO_PARAMETERS[callbackName] || {};
    if (!(word in pseudoParams)) return false;
    
    return COMPILED_CALLBACK_PATTERNS.CALLBACK_CALL.test(line);
}
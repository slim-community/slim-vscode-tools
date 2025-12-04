import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { removeStringsAndComments, countParens } from '../utils/text-processing';
import { ERROR_MESSAGES, EVENT_PATTERNS, CONTROL_FLOW_PATTERNS, TEXT_PROCESSING_PATTERNS } from '../config/config';
import { LanguageMode, StructureValidationState } from '../config/types';
import {
    createCharacterDiagnostic,
    createLineStartDiagnostic,
    createContextDiagnostic,
    createLineDiagnostic,
} from '../utils/validation-utils';

function createStructureValidationState(): StructureValidationState {
    return {
        braceCount: 0,
        lastOpenBraceLine: -1,
        parenBalance: 0,
        bracketBalance: 0,
        inString: false,
        stringChar: null,
        stringStartLine: -1,
        stringStartChar: -1,
    };
}

export function validateStructure(
    lines: string[],
    fileType: LanguageMode
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const state = createStructureValidationState();

    // Validate each line and track multi-line constructs
    lines.forEach((line, lineIndex) => {
        const lineDiagnostics = validateLine(line, lineIndex, state, fileType);
        diagnostics.push(...lineDiagnostics);
    });

    // Validate document-level issues
    const unclosedBraceDiagnostic = validateUnclosedBraces(lines, state);
    if (unclosedBraceDiagnostic) {
        diagnostics.push(unclosedBraceDiagnostic);
    }

    const unclosedStringDiagnostic = validateUnclosedString(lines, state);
    if (unclosedStringDiagnostic) {
        diagnostics.push(unclosedStringDiagnostic);
    }

    const unclosedBracketDiagnostic = validateUnclosedBrackets(lines, state);
    if (unclosedBracketDiagnostic) {
        diagnostics.push(unclosedBracketDiagnostic);
    }

    return diagnostics;
}

function validateLine(
    line: string,
    lineIndex: number,
    state: StructureValidationState,
    fileType: LanguageMode
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const trimmedLine = line.trim();

    // Track string state across lines (strings can span multiple lines)
    trackStringState(line, lineIndex, state);

    // Track bracket balance
    trackBracketBalance(line, state);

    // Skip empty lines and comments for other validations
    if (!trimmedLine || trimmedLine.startsWith('//')) {
        return diagnostics;
    }

    // Check if this is a SLiM-specific event block (only in SLiM files)
    const isSlimBlock = fileType === 'slim' && (
        EVENT_PATTERNS.SLIM_BLOCK.test(trimmedLine) ||
        EVENT_PATTERNS.SLIM_BLOCK_SPECIES.test(trimmedLine)
    );

    // Validate brace balance
    const braceDiagnostic = validateBraceBalance(line, lineIndex, state, isSlimBlock);
    if (braceDiagnostic) {
        diagnostics.push(braceDiagnostic);
    }

    // Validate semicolon requirement (only outside strings)
    if (!state.inString) {
        const semicolonDiagnostic = validateSemicolon(line, trimmedLine, lineIndex, state);
        if (semicolonDiagnostic) {
            diagnostics.push(semicolonDiagnostic);
        }
    }

    return diagnostics;
}

function validateBraceBalance(
    line: string,
    lineIndex: number,
    state: StructureValidationState,
    isSlimBlock: boolean
): Diagnostic | null {
    const codeOnly = removeStringsAndComments(line);
    const openBracesInLine = (codeOnly.match(/{/g) || []).length;
    const closeBracesInLine = (codeOnly.match(/}/g) || []).length;

    state.braceCount += openBracesInLine - closeBracesInLine;

    if (openBracesInLine > 0) {
        state.lastOpenBraceLine = lineIndex;
    }

    // Check for unexpected closing braces
    if (state.braceCount < 0 && !isSlimBlock) {
        return createCharacterDiagnostic(
            DiagnosticSeverity.Error,
            lineIndex,
            line,
            '}',
            ERROR_MESSAGES.UNEXPECTED_CLOSING_BRACE,
            false // Find first occurrence
        );
    }

    return null;
}

function validateSemicolon(
    line: string,
    trimmedLine: string,
    lineIndex: number,
    state: StructureValidationState
): Diagnostic | null {
    const result = shouldHaveSemicolon(trimmedLine, state.parenBalance);
    state.parenBalance = result.parenBalance;

    // Only show semicolon warnings if the line looks "complete"
    if (result.shouldMark && !lineAppearsIncomplete(trimmedLine)) {
        return createLineStartDiagnostic(
            DiagnosticSeverity.Warning,
            lineIndex,
            line,
            ERROR_MESSAGES.MISSING_SEMICOLON
        );
    }

    return null;
}

function trackStringState(line: string, lineIndex: number, state: StructureValidationState): void {
    let inComment = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = i < line.length - 1 ? line[i + 1] : '';
        
        // Handle comments (strings in comments don't count)
        if (!state.inString && char === '/' && nextChar === '/') {
            inComment = true;
            break; // Rest of line is comment
        }
        
        // Handle escape sequences in strings
        if (state.inString && char === '\\' && i < line.length - 1) {
            i++; // Skip next character (it's escaped)
            continue;
        }
        
        // Handle string delimiters
        if (!inComment && (char === '"' || char === "'")) {
            if (!state.inString) {
                // Starting a string
                state.inString = true;
                state.stringChar = char;
                state.stringStartLine = lineIndex;
                state.stringStartChar = i;
            } else if (char === state.stringChar) {
                // Ending a string
                state.inString = false;
                state.stringChar = null;
                state.stringStartLine = -1;
                state.stringStartChar = -1;
            }
        }
    }
}

function trackBracketBalance(line: string, state: StructureValidationState): void {
    const codeOnly = removeStringsAndComments(line);
    const openBrackets = (codeOnly.match(/\[/g) || []).length;
    const closeBrackets = (codeOnly.match(/\]/g) || []).length;
    state.bracketBalance += openBrackets - closeBrackets;
}

function validateUnclosedBraces(
    lines: string[],
    state: StructureValidationState
): Diagnostic | null {
    // Early return if braces are balanced or no opening brace found
    if (state.braceCount <= 0 || state.lastOpenBraceLine < 0) {
        return null;
    }

    // Early return if last line closes the brace
    const lastLine = lines[lines.length - 1].trim();
    if (lastLine === '}') {
        return null;
    }

    // Create diagnostic for unclosed brace
    const line = lines[state.lastOpenBraceLine];
    return createLineDiagnostic(
        DiagnosticSeverity.Error,
        state.lastOpenBraceLine,
        line,
        ERROR_MESSAGES.UNCLOSED_BRACE
    );
}

function validateUnclosedString(
    lines: string[],
    state: StructureValidationState
): Diagnostic | null {
    if (!state.inString) {
        return null;
    }

    const startLine = state.stringStartLine >= 0 ? state.stringStartLine : 0;
    const startChar = state.stringStartChar >= 0 ? state.stringStartChar : 0;
    const line = lines[startLine];
    
    // Show opening quote and some context (~20 chars)
    return createContextDiagnostic(
        DiagnosticSeverity.Error,
        startLine,
        line,
        startChar,
        ERROR_MESSAGES.UNCLOSED_STRING,
        20
    );
}

function validateUnclosedBrackets(
    lines: string[],
    state: StructureValidationState
): Diagnostic | null {
    if (state.bracketBalance <= 0) {
        return null;
    }

    // Find a line with an opening bracket for the diagnostic
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const codeOnly = removeStringsAndComments(line);
        if (codeOnly.includes('[')) {
            // Underline the last opening bracket in this line
            return createCharacterDiagnostic(
                DiagnosticSeverity.Error,
                i,
                line,
                '[',
                'Unclosed bracket(s) - missing ]',
                true // Search from end to find last bracket
            );
        }
    }

    return null;
}

export function shouldHaveSemicolon(
    line: string,
    parenBalance: number = 0
): { shouldMark: boolean; parenBalance: number } {
    const cleaned = removeStringsAndComments(line);
    const parens = countParens(cleaned);
    const netParens = parenBalance + parens.openCount - parens.closeCount;

    const isDefinitelySafe =
        cleaned.endsWith(';') ||
        cleaned.endsWith('{') ||
        cleaned.endsWith('}') ||
        netParens > 0 ||
        CONTROL_FLOW_PATTERNS.CONTROL_FLOW_STATEMENT.test(cleaned) ||
        CONTROL_FLOW_PATTERNS.CALLBACK_DEFINITION_STATEMENT.test(cleaned) ||
        CONTROL_FLOW_PATTERNS.SLIM_EVENT_BLOCK.test(cleaned) ||
        TEXT_PROCESSING_PATTERNS.COMMENT_LINE.test(line) ||
        TEXT_PROCESSING_PATTERNS.COMMENT_CONTINUATION.test(line) ||
        TEXT_PROCESSING_PATTERNS.EMPTY_LINE.test(line);

    return {
        shouldMark: !isDefinitelySafe && netParens === 0,
        parenBalance: netParens,
    };
}

function lineAppearsIncomplete(line: string): boolean {
    // Line ends with an operator
    if (/[+\-*/%=<>!&|,]\s*$/.test(line)) {
        return true;
    }

    // Line ends with a dot
    if (/\.\s*$/.test(line)) {
        return true;
    }

    // Line has unclosed parentheses or brackets
    const openParens = (line.match(/\(/g) || []).length;
    const closeParens = (line.match(/\)/g) || []).length;
    const openBrackets = (line.match(/\[/g) || []).length;
    const closeBrackets = (line.match(/\]/g) || []).length;

    if (openParens > closeParens || openBrackets > closeBrackets) {
        return true;
    }

    // Line looks like it's starting a declaration/assignment but incomplete
    if (/^\s*\w+\s*=\s*$/.test(line)) {
        return true;
    }

    // Line ends with function call opening but no closing paren
    if (/\w+\s*\(\s*$/.test(line)) {
        return true;
    }

    return false;
}
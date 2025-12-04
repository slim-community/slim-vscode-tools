import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { createDiagnostic } from './diagnostics';

export function getFirstNonWhitespaceIndex(line: string): number {
    const index = line.search(/\S/);
    return index >= 0 ? index : 0;
}

export function getLastNonWhitespaceIndex(line: string): number {
    const trimmed = line.trimEnd();
    return trimmed.length;
}

export function createLineDiagnostic(
    severity: DiagnosticSeverity,
    lineIndex: number,
    line: string,
    message: string
): Diagnostic {
    const startChar = getFirstNonWhitespaceIndex(line);
    const endChar = getLastNonWhitespaceIndex(line);
    
    return createDiagnostic(severity, lineIndex, startChar, endChar, message);
}

export function createLineStartDiagnostic(
    severity: DiagnosticSeverity,
    lineIndex: number,
    line: string,
    message: string
): Diagnostic {
    const startChar = getFirstNonWhitespaceIndex(line);
    
    return createDiagnostic(severity, lineIndex, startChar, line.length, message);
}

export function createCharacterDiagnostic(
    severity: DiagnosticSeverity,
    lineIndex: number,
    line: string,
    targetChar: string,
    message: string,
    searchFromEnd: boolean = false
): Diagnostic {
    const pos = searchFromEnd ? line.lastIndexOf(targetChar) : line.indexOf(targetChar);
    
    if (pos >= 0) {
        return createDiagnostic(
            severity,
            lineIndex,
            pos,
            pos + targetChar.length,
            message
        );
    }
    
    // Fallback: underline non-whitespace content if character not found
    return createLineDiagnostic(severity, lineIndex, line, message);
}

export function createContextDiagnostic(
    severity: DiagnosticSeverity,
    lineIndex: number,
    line: string,
    startChar: number,
    message: string,
    contextLength: number = 20
): Diagnostic {
    const endChar = Math.min(startChar + contextLength, line.length);
    
    return createDiagnostic(severity, lineIndex, startChar, endChar, message);
}

export function createSafeDiagnostic(
    severity: DiagnosticSeverity,
    lineIndex: number,
    startChar: number,
    endChar: number,
    line: string,
    message: string
): Diagnostic {
    // Ensure valid range
    const safeStart = Math.max(0, Math.min(startChar, line.length));
    const safeEnd = Math.max(safeStart, Math.min(endChar, line.length));
    
    return createDiagnostic(severity, lineIndex, safeStart, safeEnd, message);
}
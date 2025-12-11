import { DiagnosticSeverity, Diagnostic, Connection } from 'vscode-languageserver';

const DIAGNOSTIC_SOURCE = 'slim-tools';

export function createDiagnostic(
    severity: DiagnosticSeverity,
    lineIndex: number,
    startChar: number,
    endChar: number,
    message: string
): Diagnostic {
    return {
        severity: severity,
        range: {
            start: { line: lineIndex, character: startChar },
            end: { line: lineIndex, character: endChar },
        },
        message: message,
        source: DIAGNOSTIC_SOURCE,
    };
}

export function sendDiagnostics(
    connection: Connection,
    uri: string,
    diagnostics: Diagnostic[]
): void {
    connection.sendDiagnostics({ uri, diagnostics });
}
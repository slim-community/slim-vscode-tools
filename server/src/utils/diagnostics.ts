import { DiagnosticSeverity, Diagnostic, Connection } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE } from '../config/config';

/**
 * Creates a diagnostic object with consistent formatting.
 * @param severity - The severity level (Error, Warning, etc.)
 * @param lineIndex - The line number (0-based)
 * @param startChar - The starting character position (0-based)
 * @param endChar - The ending character position (0-based)
 * @param message - The diagnostic message
 * @returns A diagnostic object ready to be added to diagnostics array
 */
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

/**
 * Sends diagnostics to the VS Code client for a given document.
 * @param connection - The language server connection
 * @param uri - The document URI
 * @param diagnostics - Array of diagnostic objects
 */
export function sendDiagnostics(
    connection: Connection,
    uri: string,
    diagnostics: Diagnostic[]
): void {
    connection.sendDiagnostics({ uri, diagnostics });
}

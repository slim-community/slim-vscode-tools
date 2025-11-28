import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity, Connection } from 'vscode-languageserver/node';
import { shouldHaveSemicolon } from '../validation/structure';
import { getFileType } from '../utils/file-type';

export async function validateTextDocument(
    textDocument: TextDocument,
    connection: Connection
): Promise<void> {
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    
    // Determine file type for appropriate validation
    const fileType = getFileType(textDocument);

    let braceCount = 0;
    let lastOpenBraceLine = -1;
    let parenBalance = 0;

    lines.forEach((line, lineIndex) => {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith('//')) {
            return;
        }

        // SLiM-specific callback/event block pattern (not applicable to Eidos)
        const isSlimBlock = fileType === 'slim' && 
            (/^\d+\s+\w+\(\)/.test(trimmedLine) || /^s\d+\s+\d+\s+\w+\(\)/.test(trimmedLine));

        const openBracesInLine = (line.match(/{/g) || []).length;
        const closeBracesInLine = (line.match(/}/g) || []).length;

        braceCount += openBracesInLine - closeBracesInLine;

        if (openBracesInLine > 0) {
            lastOpenBraceLine = lineIndex;
        }

        if (braceCount < 0 && !isSlimBlock) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineIndex, character: 0 },
                    end: { line: lineIndex, character: line.length },
                },
                message: 'Unexpected closing brace',
                source: 'slim-tools',
            });
        }

        const result = shouldHaveSemicolon(trimmedLine, parenBalance);
        parenBalance = result.parenBalance;

        if (result.shouldMark) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineIndex, character: 0 },
                    end: { line: lineIndex, character: line.length },
                },
                message: 'Statement might be missing a semicolon',
                source: 'slim-tools',
            });
        }
    });

    if (braceCount > 0) {
        const lastLine = lines[lines.length - 1].trim();
        const isCompleteBlock = lastLine === '}';

        if (!isCompleteBlock) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lastOpenBraceLine, character: 0 },
                    end: { line: lastOpenBraceLine, character: lines[lastOpenBraceLine].length },
                },
                message: 'Unclosed brace(s)',
                source: 'slim-tools',
            });
        }
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}


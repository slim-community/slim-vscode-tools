import {
    CodeAction,
    CodeActionKind,
    CodeActionParams,
    Diagnostic,
    WorkspaceEdit,
    TextEdit
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageServerContext } from '../config/types';
import { ERROR_MESSAGES } from '../config/config';

// Register code action provider
export function registerCodeActionProvider(context: LanguageServerContext): void {
    const { connection, documents } = context;

    connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return [];

        const codeActions: CodeAction[] = [];
        
        for (const diagnostic of params.context.diagnostics) {
            const actions = createCodeActionsForDiagnostic(diagnostic, document);
            codeActions.push(...actions);
        }

        // Add batch actions if multiple fixable diagnostics exist
        const batchActions = createBatchActions(params.context.diagnostics, document);
        codeActions.push(...batchActions);

        return codeActions;
    });
}

// Define all possible code actions for each diagnostic that can be fixed
function createCodeActionsForDiagnostic(
    diagnostic: Diagnostic,
    document: TextDocument
): CodeAction[] {
    const actions: CodeAction[] = [];
    const message = diagnostic.message;
    const uri = document.uri;

    if (message.includes('missing a semicolon')) {
        actions.push(createAddSemicolonAction(diagnostic, uri));
    }

    if (message.includes('Unclosed string literal')) {
        actions.push(...createCloseStringActions(diagnostic, document));
    }

    if (message === ERROR_MESSAGES.UNEXPECTED_CLOSING_BRACE) {
        actions.push(createRemoveBraceAction(diagnostic, uri));
    }

    if (message.includes('Unclosed brace')) {
        actions.push(createAddClosingBraceAction(diagnostic, uri));
    }

    if (message.includes('Unclosed bracket')) {
        actions.push(createAddClosingBracketAction(diagnostic, uri));
    }

    return actions;
}

function createAddSemicolonAction(diagnostic: Diagnostic, uri: string): CodeAction {
    const line = diagnostic.range.end.line;
    const character = diagnostic.range.end.character;

    const edit: WorkspaceEdit = {
        changes: {
            [uri]: [{
                range: {
                    start: { line, character },
                    end: { line, character }
                },
                newText: ';'
            }]
        }
    };

    return {
        title: 'Add semicolon',
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit,
        isPreferred: true
    };
}

function createCloseStringActions(diagnostic: Diagnostic, document: TextDocument): CodeAction[] {
    const line = diagnostic.range.start.line;
    const lineText = document.getText({
        start: { line, character: 0 },
        end: { line: line + 1, character: 0 }
    });

    const startChar = diagnostic.range.start.character;
    const openingQuote = lineText[startChar];
    
    // If we can determine the opening quote, only suggest matching one
    if (openingQuote === '"' || openingQuote === "'") {
        return [createCloseStringAction(diagnostic, document.uri, openingQuote)];
    }

    // Otherwise, suggest both options
    return [
        createCloseStringAction(diagnostic, document.uri, '"'),
        createCloseStringAction(diagnostic, document.uri, "'")
    ];
}

function createCloseStringAction(
    diagnostic: Diagnostic, 
    uri: string, 
    quoteChar: string
): CodeAction {
    const line = diagnostic.range.end.line;
    const character = diagnostic.range.end.character;

    const edit: WorkspaceEdit = {
        changes: {
            [uri]: [{
                range: {
                    start: { line, character },
                    end: { line, character }
                },
                newText: quoteChar
            }]
        }
    };

    const title = quoteChar === '"' 
        ? 'Close string with "'
        : "Close string with '";

    return {
        title,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit,
        isPreferred: quoteChar === '"' 
    };
}

function createRemoveBraceAction(diagnostic: Diagnostic, uri: string): CodeAction {
    const edit: WorkspaceEdit = {
        changes: {
            [uri]: [{
                range: diagnostic.range,
                newText: ''
            }]
        }
    };

    return {
        title: 'Remove unexpected closing brace',
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit,
        isPreferred: true
    };
}

function createAddClosingBraceAction(diagnostic: Diagnostic, uri: string): CodeAction {
    const line = diagnostic.range.start.line;
    
    return {
        title: 'Add closing brace',
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
            changes: {
                [uri]: [{
                    range: {
                        start: { line: line + 1, character: 0 },
                        end: { line: line + 1, character: 0 }
                    },
                    newText: '}\n'
                }]
            }
        },
        isPreferred: true
    };
}

function createAddClosingBracketAction(diagnostic: Diagnostic, uri: string): CodeAction {
    const line = diagnostic.range.end.line;
    const character = diagnostic.range.end.character;

    return {
        title: 'Add closing bracket',
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
            changes: {
                [uri]: [{
                    range: {
                        start: { line, character },
                        end: { line, character }
                    },
                    newText: ']'
                }]
            }
        },
        isPreferred: true
    };
}

function createBatchActions(diagnostics: Diagnostic[], document: TextDocument): CodeAction[] {
    const actions: CodeAction[] = [];
    
    // Group diagnostics by type
    const semicolonErrors = diagnostics.filter(d => 
        d.message.includes('missing a semicolon')
    );
    const unexpectedBraceErrors = diagnostics.filter(d => 
        d.message === ERROR_MESSAGES.UNEXPECTED_CLOSING_BRACE
    );
    
    // Batch fix all missing semicolons
    if (semicolonErrors.length > 1) {
        const edits: TextEdit[] = semicolonErrors.map(diagnostic => ({
            range: {
                start: { 
                    line: diagnostic.range.end.line, 
                    character: diagnostic.range.end.character 
                },
                end: { 
                    line: diagnostic.range.end.line, 
                    character: diagnostic.range.end.character 
                }
            },
            newText: ';'
        }));

        actions.push({
            title: `Fix all ${semicolonErrors.length} missing semicolons`,
            kind: CodeActionKind.QuickFix,
            diagnostics: semicolonErrors,
            edit: {
                changes: {
                    [document.uri]: edits
                }
            }
        });
    }

    // Batch remove all unexpected braces
    if (unexpectedBraceErrors.length > 1) {
        const edits: TextEdit[] = unexpectedBraceErrors.map(diagnostic => ({
            range: diagnostic.range,
            newText: ''
        }));

        actions.push({
            title: `Remove all ${unexpectedBraceErrors.length} unexpected braces`,
            kind: CodeActionKind.QuickFix,
            diagnostics: unexpectedBraceErrors,
            edit: {
                changes: {
                    [document.uri]: edits
                }
            }
        });
    }

    return actions;
}


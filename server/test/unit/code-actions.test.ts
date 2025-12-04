import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection, TextDocuments, DiagnosticSeverity, CodeActionKind } from 'vscode-languageserver/node';
import { DocumentationService } from '../../src/services/documentation-service';
import { registerCodeActionProvider } from '../../src/providers/code-actions';
import { LanguageServerContext } from '../../src/config/types';
import { CompletionService } from '../../src/services/completion-service';
import { ValidationService } from '../../src/services/validation-service';
import { documentCache } from '../../src/services/document-cache';
import { setLoggerSilent } from '../../src/utils/logger';
import { createDiagnostic } from '../../src/utils/diagnostics';
import { ERROR_MESSAGES } from '../../src/config/config';

describe('Code Actions Provider', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;
    let validationService: ValidationService;
    let mockConnection: any;
    let mockDocuments: any;
    let codeActionHandler: any;

    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
        validationService = new ValidationService(documentationService);

        mockConnection = {
            onCodeAction: (handler: any) => {
                codeActionHandler = handler;
            },
        };

        mockDocuments = {
            get: () => TextDocument.create('file:///test.slim', 'slim', 1, ''),
        };

        const context: LanguageServerContext = {
            connection: mockConnection as Connection,
            documents: mockDocuments as TextDocuments<TextDocument>,
            documentationService,
            completionService,
            validationService,
        };

        registerCodeActionProvider(context);
    });

    describe('Semicolon Code Actions', () => {
        it('should provide add semicolon action for missing semicolon', () => {
            const content = `x = 5`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Warning,
                0,
                5,
                5,
                'Statement might be missing a semicolon'
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                context: { diagnostics: [diagnostic] },
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            const semicolonAction = result.find((action: any) => action.title === 'Add semicolon');
            expect(semicolonAction).toBeDefined();
            expect(semicolonAction.kind).toBe(CodeActionKind.QuickFix);
            expect(semicolonAction.isPreferred).toBe(true);
            expect(semicolonAction.diagnostics).toHaveLength(1);
            expect(semicolonAction.edit).toBeDefined();
            expect(semicolonAction.edit.changes['file:///test.slim']).toBeDefined();
            expect(semicolonAction.edit.changes['file:///test.slim'][0].newText).toBe(';');
        });

        it('should place semicolon at correct position', () => {
            const content = `x = 5`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Warning,
                0,
                5,
                5,
                'Statement might be missing a semicolon'
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                context: { diagnostics: [diagnostic] },
            });

            const semicolonAction = result.find((action: any) => action.title === 'Add semicolon');
            const edit = semicolonAction.edit.changes['file:///test.slim'][0];
            
            expect(edit.range.start.line).toBe(0);
            expect(edit.range.start.character).toBe(5);
            expect(edit.range.end.line).toBe(0);
            expect(edit.range.end.character).toBe(5);
        });
    });

    describe('String Literal Code Actions', () => {
        it('should provide close string action for unclosed double quote string', () => {
            const content = `x = "unclosed string`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Error,
                0,
                4,
                20,
                'Unclosed string literal (missing closing quote)'
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 20 } },
                context: { diagnostics: [diagnostic] },
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            const closeStringAction = result.find((action: any) => action.title === 'Close string with "');
            expect(closeStringAction).toBeDefined();
            expect(closeStringAction.kind).toBe(CodeActionKind.QuickFix);
            expect(closeStringAction.isPreferred).toBe(true);
            expect(closeStringAction.edit.changes['file:///test.slim'][0].newText).toBe('"');
        });

        it('should provide close string action for unclosed single quote string', () => {
            const content = `x = 'unclosed string`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Error,
                0,
                4,
                20,
                'Unclosed string literal (missing closing quote)'
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 20 } },
                context: { diagnostics: [diagnostic] },
            });

            const closeStringAction = result.find((action: any) => action.title === "Close string with '");
            expect(closeStringAction).toBeDefined();
            expect(closeStringAction.edit.changes['file:///test.slim'][0].newText).toBe("'");
        });

        it('should provide both quote options when quote type cannot be determined', () => {
            const content = `x = unclosed`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Error,
                0,
                0,
                12,
                'Unclosed string literal (missing closing quote)'
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 12 } },
                context: { diagnostics: [diagnostic] },
            });

            const doubleQuoteAction = result.find((action: any) => action.title === 'Close string with "');
            const singleQuoteAction = result.find((action: any) => action.title === "Close string with '");
            
            expect(doubleQuoteAction).toBeDefined();
            expect(singleQuoteAction).toBeDefined();
            expect(doubleQuoteAction.isPreferred).toBe(true);
            expect(singleQuoteAction.isPreferred).toBe(false);
        });
    });

    describe('Brace Code Actions', () => {
        it('should provide remove brace action for unexpected closing brace', () => {
            const content = `x = 5;\n}`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Error,
                1,
                0,
                1,
                ERROR_MESSAGES.UNEXPECTED_CLOSING_BRACE
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
                context: { diagnostics: [diagnostic] },
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            const removeBraceAction = result.find((action: any) => 
                action.title === 'Remove unexpected closing brace'
            );
            expect(removeBraceAction).toBeDefined();
            expect(removeBraceAction.kind).toBe(CodeActionKind.QuickFix);
            expect(removeBraceAction.isPreferred).toBe(true);
            expect(removeBraceAction.edit.changes['file:///test.slim'][0].newText).toBe('');
        });

        it('should provide add closing brace action for unclosed brace', () => {
            const content = `initialize() {\n    x = 5;`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Error,
                0,
                13,
                14,
                'Unclosed brace(s)'
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
                context: { diagnostics: [diagnostic] },
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            const addBraceAction = result.find((action: any) => action.title === 'Add closing brace');
            expect(addBraceAction).toBeDefined();
            expect(addBraceAction.kind).toBe(CodeActionKind.QuickFix);
            expect(addBraceAction.isPreferred).toBe(true);
            expect(addBraceAction.edit.changes['file:///test.slim'][0].newText).toBe('}\n');
        });
    });

    describe('Bracket Code Actions', () => {
        it('should provide add closing bracket action for unclosed bracket', () => {
            const content = `x = arr[0`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Error,
                0,
                8,
                10,
                'Unclosed bracket'
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
                context: { diagnostics: [diagnostic] },
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            const addBracketAction = result.find((action: any) => action.title === 'Add closing bracket');
            expect(addBracketAction).toBeDefined();
            expect(addBracketAction.kind).toBe(CodeActionKind.QuickFix);
            expect(addBracketAction.isPreferred).toBe(true);
            expect(addBracketAction.edit.changes['file:///test.slim'][0].newText).toBe(']');
        });
    });

    describe('Batch Code Actions', () => {
        it('should provide batch action for multiple missing semicolons', () => {
            const content = `x = 5\ny = 10\nz = 15`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostics = [
                createDiagnostic(
                    DiagnosticSeverity.Warning,
                    0,
                    5,
                    5,
                    'Statement might be missing a semicolon'
                ),
                createDiagnostic(
                    DiagnosticSeverity.Warning,
                    1,
                    7,
                    7,
                    'Statement might be missing a semicolon'
                ),
                createDiagnostic(
                    DiagnosticSeverity.Warning,
                    2,
                    7,
                    7,
                    'Statement might be missing a semicolon'
                ),
            ];

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 2, character: 7 } },
                context: { diagnostics },
            });

            expect(result).toBeDefined();

            // Should have individual actions plus batch action
            const batchAction = result.find((action: any) => 
                action.title.includes('Fix all') && action.title.includes('missing semicolons')
            );
            expect(batchAction).toBeDefined();
            expect(batchAction.title).toBe('Fix all 3 missing semicolons');
            expect(batchAction.kind).toBe(CodeActionKind.QuickFix);
            expect(batchAction.diagnostics).toHaveLength(3);
            expect(batchAction.edit.changes['file:///test.slim']).toHaveLength(3);
        });

        it('should provide batch action for multiple unexpected braces', () => {
            const content = `x = 5;\n}\n}\n}`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostics = [
                createDiagnostic(
                    DiagnosticSeverity.Error,
                    1,
                    0,
                    1,
                    ERROR_MESSAGES.UNEXPECTED_CLOSING_BRACE
                ),
                createDiagnostic(
                    DiagnosticSeverity.Error,
                    2,
                    0,
                    1,
                    ERROR_MESSAGES.UNEXPECTED_CLOSING_BRACE
                ),
                createDiagnostic(
                    DiagnosticSeverity.Error,
                    3,
                    0,
                    1,
                    ERROR_MESSAGES.UNEXPECTED_CLOSING_BRACE
                ),
            ];

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 3, character: 1 } },
                context: { diagnostics },
            });

            expect(result).toBeDefined();

            const batchAction = result.find((action: any) => 
                action.title.includes('Remove all') && action.title.includes('unexpected braces')
            );
            expect(batchAction).toBeDefined();
            expect(batchAction.title).toBe('Remove all 3 unexpected braces');
            expect(batchAction.diagnostics).toHaveLength(3);
            expect(batchAction.edit.changes['file:///test.slim']).toHaveLength(3);
        });

        it('should not provide batch action for single diagnostic', () => {
            const content = `x = 5`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostics = [
                createDiagnostic(
                    DiagnosticSeverity.Warning,
                    0,
                    5,
                    5,
                    'Statement might be missing a semicolon'
                ),
            ];

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                context: { diagnostics },
            });

            expect(result).toBeDefined();

            const batchAction = result.find((action: any) => 
                action.title.includes('Fix all')
            );
            expect(batchAction).toBeUndefined();
        });
    });

    describe('Multiple Diagnostic Types', () => {
        it('should provide actions for multiple different diagnostic types', () => {
            const content = `x = 5\ny = "unclosed`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const diagnostics = [
                createDiagnostic(
                    DiagnosticSeverity.Warning,
                    0,
                    5,
                    5,
                    'Statement might be missing a semicolon'
                ),
                createDiagnostic(
                    DiagnosticSeverity.Error,
                    1,
                    4,
                    13,
                    'Unclosed string literal (missing closing quote)'
                ),
            ];

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 13 } },
                context: { diagnostics },
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            const semicolonAction = result.find((action: any) => action.title === 'Add semicolon');
            const stringAction = result.find((action: any) => action.title.includes('Close string'));

            expect(semicolonAction).toBeDefined();
            expect(stringAction).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('should return empty array for non-existent document', () => {
            mockDocuments.get = () => null;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Warning,
                0,
                5,
                5,
                'Statement might be missing a semicolon'
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///nonexistent.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                context: { diagnostics: [diagnostic] },
            });

            expect(result).toEqual([]);
        });

        it('should return empty array when no diagnostics provided', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5;');
            mockDocuments.get = () => document;

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                context: { diagnostics: [] },
            });

            expect(result).toEqual([]);
        });

        it('should not provide action for unsupported diagnostic type', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5;');
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Error,
                0,
                0,
                5,
                'Some other error message'
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                context: { diagnostics: [diagnostic] },
            });

            expect(result).toEqual([]);
        });

        it('should handle diagnostics with empty message', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5;');
            mockDocuments.get = () => document;

            const diagnostic = createDiagnostic(
                DiagnosticSeverity.Warning,
                0,
                5,
                5,
                ''
            );

            const result = codeActionHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                context: { diagnostics: [diagnostic] },
            });

            expect(result).toEqual([]);
        });
    });
});


import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SymbolKind } from 'vscode-languageserver/node';
import { registerDocumentSymbolProvider } from '../../src/providers/document-symbols';
import { createTestContext } from '../helpers/test-context';

describe('Document Symbols Provider', () => {
    let mockDocuments: any;
    let documentSymbolHandler: any;

    beforeEach(() => {
        const mockConnection = {
            onDocumentSymbol: (handler: any) => {
                documentSymbolHandler = handler;
            },
        };

        const result = createTestContext(mockConnection);
        mockDocuments = result.mockDocuments;

        registerDocumentSymbolProvider(result.context);
    });

    describe('User-defined functions', () => {
        it('should find function symbols with correct display name', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                'function (integer)myFunction(void) {\n  return 42;\n}'
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(1);
            expect(symbols[0].name).toBe('(integer) myFunction(void)');
            expect(symbols[0].kind).toBe(SymbolKind.Function);
            expect(symbols[0].detail).toBe('function');
            expect(symbols[0].range.start.line).toBe(0);
            expect(symbols[0].range.end.line).toBe(2);
        });

        it('should find multiple functions', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                'function (integer)firstFunc(void) {\n  return 1;\n}\n\nfunction (float)secondFunc(float x) {\n  return x;\n}'
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(2);
            expect(symbols[0].name).toBe('(integer) firstFunc(void)');
            expect(symbols[0].range.start.line).toBe(0);
            expect(symbols[1].name).toBe('(float) secondFunc(float x)');
            expect(symbols[1].range.start.line).toBe(4);
        });

        it('should set correct selection range for function name', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                'function (void)myFunction(void) {}'
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(1);
            expect(symbols[0].selectionRange.start.line).toBe(0);
            expect(symbols[0].selectionRange.end.line).toBe(0);
        });
    });

    describe('SLiM callbacks', () => {
        it('should find initialize callback', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                'initialize() {\n  initializeMutationRate(1e-8);\n}'
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(1);
            expect(symbols[0].name).toBe('initialize()');
            expect(symbols[0].kind).toBe(SymbolKind.Method);
            expect(symbols[0].detail).toBe('callback');
        });

        it('should find callbacks with tick numbers', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                '1 early() {\n  sim.addSubpop("p1", 500);\n}'
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(1);
            expect(symbols[0].name).toBe('1 early()');
            expect(symbols[0].kind).toBe(SymbolKind.Method);
        });

        it('should find callbacks with tick ranges', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                '1:100 late() {\n  // do something\n}'
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(1);
            expect(symbols[0].name).toBe('1:100 late()');
        });

        it('should find all callback types', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                [
                    'initialize() { }',
                    '1 first() { }',
                    '1 early() { }',
                    '1 late() { }',
                    '1 reproduction() { }',
                    'mutationEffect(m1) { return 1.0; }',
                    'fitnessEffect() { return 1.0; }',
                ].join('\n')
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols.length).toBeGreaterThanOrEqual(7);
            expect(symbols.map((s: any) => s.name)).toContain('initialize()');
            expect(symbols.map((s: any) => s.name)).toContain('1 first()');
            expect(symbols.map((s: any) => s.name)).toContain('1 early()');
            expect(symbols.map((s: any) => s.name)).toContain('1 late()');
        });
    });

    describe('Mixed content', () => {
        it('should find both functions and callbacks', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                [
                    'function (float)myHelper(float x) {',
                    '  return x * 2;',
                    '}',
                    '',
                    'initialize() {',
                    '  initializeMutationRate(1e-8);',
                    '}',
                    '',
                    '1 early() {',
                    '  sim.addSubpop("p1", 500);',
                    '}',
                ].join('\n')
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(3);
            expect(symbols[0].kind).toBe(SymbolKind.Function);
            expect(symbols[1].kind).toBe(SymbolKind.Method);
            expect(symbols[2].kind).toBe(SymbolKind.Method);
        });

        it('should handle document with comments', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                [
                    '// This is a comment',
                    'initialize() {',
                    '  // Another comment',
                    '  initializeMutationRate(1e-8);',
                    '}',
                ].join('\n')
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(1);
            expect(symbols[0].name).toBe('initialize()');
        });
    });

    describe('Edge cases', () => {
        it('should return empty array for empty document', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, '');
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(0);
        });

        it('should return empty array when no symbols found', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5;\ny = 10;\nz = x + y;');
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(0);
        });

        it('should handle unclosed braces gracefully', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                'initialize() {\n  initializeMutationRate(1e-8);'
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(1);
            expect(symbols[0].name).toBe('initialize()');
        });

        it('should correctly track block ranges for nested braces', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                [
                    'function (void)testNested(void) {',
                    '  if (T) {',
                    '    x = 1;',
                    '  }',
                    '  y = 2;',
                    '}',
                ].join('\n')
            );
            mockDocuments.get = () => document;

            const symbols = documentSymbolHandler({ textDocument: { uri: 'file:///test.slim' } });

            expect(symbols).toHaveLength(1);
            expect(symbols[0].range.start.line).toBe(0);
            expect(symbols[0].range.end.line).toBe(5);
        });
    });
});

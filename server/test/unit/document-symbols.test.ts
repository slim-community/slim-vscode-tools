import { describe, it, expect } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { onDocumentSymbol } from '../../src/providers/document-symbols';

describe('Document Symbols Provider', () => {
    it('should find function symbols in document', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            'function myFunction() {\n  return 42;\n}\n\nfunction anotherFunc() {\n  return 0;\n}'
        );

        const params = {
            textDocument: { uri: 'file:///test.slim' },
        };

        const symbols = onDocumentSymbol(params, document);

        expect(symbols).toHaveLength(2);
        expect(symbols[0].name).toBe('myFunction');
        expect(symbols[0].kind).toBe(12); // Function kind
        expect(symbols[0].location.uri).toBe('file:///test.slim');
        expect(symbols[0].location.range.start.line).toBe(0);

        expect(symbols[1].name).toBe('anotherFunc');
        expect(symbols[1].location.range.start.line).toBe(4);
    });

    it('should return empty array when no functions found', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            'x = 5;\ny = 10;\nz = x + y;'
        );

        const params = {
            textDocument: { uri: 'file:///test.slim' },
        };

        const symbols = onDocumentSymbol(params, document);

        expect(symbols).toHaveLength(0);
    });

    it('should handle document with mixed content', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            '// This is a comment\nx = 5;\nfunction calculateSum(a, b) {\n  return a + b;\n}\ny = 10;'
        );

        const params = {
            textDocument: { uri: 'file:///test.slim' },
        };

        const symbols = onDocumentSymbol(params, document);

        expect(symbols).toHaveLength(1);
        expect(symbols[0].name).toBe('calculateSum');
        expect(symbols[0].location.range.start.line).toBe(2);
    });

    it('should handle empty document', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            ''
        );

        const params = {
            textDocument: { uri: 'file:///test.slim' },
        };

        const symbols = onDocumentSymbol(params, document);

        expect(symbols).toHaveLength(0);
    });

    it('should correctly identify function on different lines', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            'x = 1;\nfunction firstFunc() {}\nfunction secondFunc() {}\nfunction thirdFunc() {}'
        );

        const params = {
            textDocument: { uri: 'file:///test.slim' },
        };

        const symbols = onDocumentSymbol(params, document);

        expect(symbols).toHaveLength(3);
        expect(symbols[0].name).toBe('firstFunc');
        expect(symbols[0].location.range.start.line).toBe(1);
        
        expect(symbols[1].name).toBe('secondFunc');
        expect(symbols[1].location.range.start.line).toBe(2);
        
        expect(symbols[2].name).toBe('thirdFunc');
        expect(symbols[2].location.range.start.line).toBe(3);
    });
});


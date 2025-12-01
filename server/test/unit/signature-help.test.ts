import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentationService } from '../../src/services/documentation-service';
import { onSignatureHelp } from '../../src/providers/signature-help';
import { LanguageServerContext } from '../../src/config/types';
import { CompletionService } from '../../src/services/completion-service';
import { Connection, TextDocuments } from 'vscode-languageserver/node';

describe('Signature Help Provider', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;
    let context: LanguageServerContext;
    let mockDocuments: any;

    beforeEach(() => {
        // Use real documentation service - it will load from docs/ directory
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
        
        // Verify documentation loaded successfully
        const functions = documentationService.getFunctions();
        if (Object.keys(functions).length === 0) {
            throw new Error('Documentation failed to load - no functions found. Check that docs/ directory exists.');
        }

        // Mock documents
        mockDocuments = {
            get: (uri: string) => TextDocument.create(uri, 'slim', 1, ''),
        };

        context = {
            connection: {} as Connection,
            documents: mockDocuments as TextDocuments<TextDocument>,
            documentationService,
            completionService,
        };
    });

    it('should return signature help for a known function', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(');
        
        const result = onSignatureHelp(
            {
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 4 }, // right after '('
                context: { triggerKind: 1, isRetrigger: false },
            },
            document,
            context
        );

        // sum() is a real Eidos function that must be in the docs
        const functions = documentationService.getFunctions();
        expect(functions['sum']).toBeDefined();
        
        expect(result).toBeTruthy();
        expect(result?.signatures).toBeTruthy();
        expect(result?.signatures.length).toBeGreaterThan(0);
        
        if (result?.signatures[0]) {
            expect(result.signatures[0].label).toContain('sum');
        }
    });

    it('should return null for unknown functions', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            'unknownFunc('
        );
        
        const result = onSignatureHelp(
            {
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 12 },
                context: { triggerKind: 1, isRetrigger: false },
            },
            document,
            context
        );

        expect(result).toBeNull();
    });

    it('should calculate active parameter based on comma count', () => {
        // Test parameter 0 (no commas)
        const doc1 = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(1');
        const result1 = onSignatureHelp(
            {
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 5 },
                context: { triggerKind: 1, isRetrigger: false },
            },
            doc1,
            context
        );
        expect(result1?.activeParameter).toBe(0);

        // Test parameter 1 (one comma)
        const doc2 = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(1, ');
        const result2 = onSignatureHelp(
            {
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 7 },
                context: { triggerKind: 1, isRetrigger: false },
            },
            doc2,
            context
        );
        expect(result2?.activeParameter).toBe(1);

        // Test parameter 2 (two commas)
        const doc3 = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(1, 2, ');
        const result3 = onSignatureHelp(
            {
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 10 },
                context: { triggerKind: 1, isRetrigger: false },
            },
            doc3,
            context
        );
        expect(result3?.activeParameter).toBe(2);
    });

    it('should ignore commas inside nested function calls', () => {
        // Nested function: outer(inner(1, 2), 
        // The outer function should be at parameter 1, not 2
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            'sum(c(1, 2), '
        );
        
        const result = onSignatureHelp(
            {
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 13 },
                context: { triggerKind: 1, isRetrigger: false },
            },
            document,
            context
        );

        // Should be at parameter 1 (after first comma at depth 0)
        // The commas inside c(1, 2) should be ignored
        expect(result?.activeParameter).toBe(1);
    });
});


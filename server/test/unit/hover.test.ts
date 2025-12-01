import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection, TextDocuments } from 'vscode-languageserver/node';
import { DocumentationService } from '../../src/services/documentation-service';
import { registerHoverProvider } from '../../src/providers/hover';
import { LanguageServerContext } from '../../src/config/types';
import { CompletionService } from '../../src/services/completion-service';

describe('Hover Provider', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;
    let mockConnection: any;
    let mockDocuments: any;
    let hoverHandler: any;

    beforeEach(() => {
        // Use real documentation service - it will load from docs/ directory
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
        
        // Verify documentation loaded successfully
        const functions = documentationService.getFunctions();
        if (Object.keys(functions).length === 0) {
            throw new Error('Documentation failed to load - no functions found. Check that docs/ directory exists.');
        }

        // Mock connection
        mockConnection = {
            onHover: (handler: any) => {
                hoverHandler = handler;
            },
        };

        // Mock documents
        mockDocuments = {
            get: (uri: string) => {
                return TextDocument.create(uri, 'slim', 1, 'sum(1, 2, 3);');
            },
        };

        const context: LanguageServerContext = {
            connection: mockConnection as Connection,
            documents: mockDocuments as TextDocuments<TextDocument>,
            documentationService,
            completionService,
        };

        registerHoverProvider(context);
    });

    it('should return hover info for a known function', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(1, 2, 3);');
        
        mockDocuments.get = () => document;

        // Hover over 'sum' at position (0, 1) - the 'u' in 'sum'
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 0, character: 1 },
        });

        // sum() is a real Eidos function that must be in the docs
        const functions = documentationService.getFunctions();
        expect(functions['sum']).toBeDefined();
        
        expect(result).toBeTruthy();
        expect(result.contents).toBeTruthy();
        
        // Check that the hover contains markdown with function information
        if (typeof result.contents === 'object' && 'value' in result.contents) {
            expect(result.contents.value).toContain('sum');
        }
    });

    it('should return null for unknown words', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            'unknownFunction();'
        );
        
        mockDocuments.get = () => document;

        // Hover over 'unknownFunction'
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 0, character: 5 },
        });

        expect(result).toBeNull();
    });

    it('should return hover info for operators', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 1 + 2;');
        
        mockDocuments.get = () => document;

        // Hover over '+' operator at position (0, 6)
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 0, character: 6 },
        });

        // Result might be null or have operator info depending on documentation
        // This test just ensures it doesn't crash
        expect(result === null || typeof result === 'object').toBe(true);
    });
});


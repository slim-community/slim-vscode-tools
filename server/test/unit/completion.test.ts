import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItemKind } from 'vscode-languageserver/node';
import { DocumentationService } from '../../src/services/documentation-service';
import { CompletionService } from '../../src/services/completion-service';

describe('Completion Service', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;

    beforeEach(() => {
        // Use real documentation service - it will load from docs/ directory
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
        
        // Verify documentation loaded successfully
        const functions = documentationService.getFunctions();
        if (Object.keys(functions).length === 0) {
            throw new Error('Documentation failed to load - no functions found. Check that docs/ directory exists.');
        }
    });

    it('should return function completions for global context', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, 'su');
        
        const completions = completionService.getCompletions(document, {
            line: 0,
            character: 2,
        });

        expect(completions).toBeTruthy();
        
        // Should be an array of completion items
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should include 'sum' function
        const sumCompletion = items.find(item => item.label === 'sum');
        expect(sumCompletion).toBeDefined();
        expect(sumCompletion?.kind).toBe(CompletionItemKind.Function);
    });

    it('should return method completions after dot operator', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, 'p1.');
        
        const completions = completionService.getCompletions(document, {
            line: 0,
            character: 3,
        });

        expect(completions).toBeTruthy();
        
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should include methods (p1 is likely a Subpopulation)
        expect(items.length).toBeGreaterThan(0);
        
        // All items should be methods or properties
        items.forEach(item => {
            expect([
                CompletionItemKind.Method,
                CompletionItemKind.Property,
            ]).toContain(item.kind);
        });
    });

    it('should include callbacks in slim files', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, '');
        
        const completions = completionService.getCompletions(document, {
            line: 0,
            character: 0,
        });

        expect(completions).toBeTruthy();
        
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should include SLiM-specific callbacks
        const callbacks = documentationService.getCallbacks('slim');
        const hasCallbacks = Object.keys(callbacks).length > 0;
        
        if (hasCallbacks) {
            // At least one callback should be in completions
            const callbackCompletions = items.filter(item => 
                item.kind === CompletionItemKind.Function && 
                Object.keys(callbacks).some(cb => item.label.includes(cb))
            );
            expect(callbackCompletions.length).toBeGreaterThan(0);
        }
    });

    it('should resolve completion with documentation', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sum');
        
        const completions = completionService.getCompletions(document, {
            line: 0,
            character: 3,
        });

        const items = Array.isArray(completions) ? completions : completions?.items || [];
        const sumItem = items.find(item => item.label === 'sum');
        
        expect(sumItem).toBeDefined();
        
        // Resolve the completion to get documentation
        if (sumItem) {
            const resolved = completionService.resolveCompletion(sumItem);
            
            expect(resolved).toBeDefined();
            expect(resolved.documentation).toBeDefined();
            
            if (resolved.documentation && typeof resolved.documentation === 'object' && 'value' in resolved.documentation) {
                expect(resolved.documentation.value).toContain('sum');
            }
        }
    });

    it('should return class constructors', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, '');
        
        const completions = completionService.getCompletions(document, {
            line: 0,
            character: 0,
        });

        expect(completions).toBeTruthy();
        
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should include class constructors like 'Dictionary'
        const classItems = items.filter(item => item.kind === CompletionItemKind.Class);
        expect(classItems.length).toBeGreaterThan(0);
    });
});


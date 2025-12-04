import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItemKind } from 'vscode-languageserver/node';
import { DocumentationService } from '../../src/services/documentation-service';
import { CompletionService } from '../../src/services/completion-service';
import { setLoggerSilent } from '../../src/utils/logger';
import { documentCache } from '../../src/services/document-cache';

describe('Completion Service', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;

    beforeEach(() => {
        setLoggerSilent(true);
        // Clear cache between tests to avoid stale data
        documentCache.clear();
        
        // Use real documentation service - it will load from docs/ directory
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
        
        // Verify documentation loaded successfully
        const functions = documentationService.getFunctions();
        if (Object.keys(functions).length === 0) {
            throw new Error('Documentation failed to load - no functions found. Check that docs/ directory exists.');
        }
    });

    describe('Global Completions', () => {
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

    describe('Method and Property Completions', () => {
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

        it('should return completions for sim object', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sim.');
            
            const completions = completionService.getCompletions(document, {
                line: 0,
                character: 4,
            });

            expect(completions).toBeTruthy();
            
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            expect(items.length).toBeGreaterThan(0);
            
            // Should include Species methods like addSubpop
            const addSubpopCompletion = items.find(item => item.label === 'addSubpop');
            expect(addSubpopCompletion).toBeDefined();
        });
    });

    describe('Chained Property Access', () => {
        it('should return Individual completions for p1.individuals[0].', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                'p1.individuals[0].'
            );
            
            const completions = completionService.getCompletions(document, {
                line: 0,
                character: 18,
            });

            expect(completions).toBeTruthy();
            
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            expect(items.length).toBeGreaterThan(0);
            
            // Should include Individual methods/properties
            const genomesCompletion = items.find(item => item.label === 'genomes' || item.label === 'haplosomes');
            expect(genomesCompletion).toBeDefined();
        });

        it('should return Haplosome completions for p1.individuals[0].genomes[0].', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                'p1.individuals[0].genomes[0].'
            );
            
            const completions = completionService.getCompletions(document, {
                line: 0,
                character: 29,
            });

            expect(completions).toBeTruthy();
            
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            expect(items.length).toBeGreaterThan(0);
            
            // Should include Haplosome methods/properties
            const mutationsCompletion = items.find(item => item.label === 'mutations');
            expect(mutationsCompletion).toBeDefined();
        });

        it('should return Subpopulation completions for sim.subpopulations[0].', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                'sim.subpopulations[0].'
            );
            
            const completions = completionService.getCompletions(document, {
                line: 0,
                character: 22,
            });

            expect(completions).toBeTruthy();
            
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            expect(items.length).toBeGreaterThan(0);
            
            // Should include Subpopulation methods/properties
            const individualsCompletion = items.find(item => item.label === 'individuals');
            expect(individualsCompletion).toBeDefined();
        });
    });

    describe('User-Defined Symbol Completions', () => {
        it('should include user-defined constants in completions', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    defineConstant("MY_CONST", 100);
}

1 early() {
    x = MY_CO
}`
            );
            
            const completions = completionService.getCompletions(document, {
                line: 5,
                character: 12,
            });

            expect(completions).toBeTruthy();
            
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            
            // Should include the user-defined constant
            const constCompletion = items.find(item => item.label === 'MY_CONST');
            expect(constCompletion).toBeDefined();
            expect(constCompletion?.kind).toBe(CompletionItemKind.Constant);
        });

        it('should include user-defined subpopulations in completions', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 100);
    sim.addSubpop("p2", 50);
}

2 late() {
    x = p
}`
            );
            
            const completions = completionService.getCompletions(document, {
                line: 6,
                character: 9,
            });

            expect(completions).toBeTruthy();
            
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            
            // Should include the defined subpopulations
            const p1Completion = items.find(item => item.label === 'p1');
            const p2Completion = items.find(item => item.label === 'p2');
            expect(p1Completion).toBeDefined();
            expect(p2Completion).toBeDefined();
        });

        it('should include user-defined mutation types in completions', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
    initializeMutationType("m2", 0.5, "e", 0.1);
}

1 early() {
    x = m
}`
            );
            
            const completions = completionService.getCompletions(document, {
                line: 6,
                character: 9,
            });

            expect(completions).toBeTruthy();
            
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            
            // Should include the defined mutation types
            const m1Completion = items.find(item => item.label === 'm1');
            const m2Completion = items.find(item => item.label === 'm2');
            expect(m1Completion).toBeDefined();
            expect(m2Completion).toBeDefined();
        });

        it('should include user-defined variables with inferred types', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    inds = p1.individuals;
    count = size(inds);
    x = in
}`
            );
            
            const completions = completionService.getCompletions(document, {
                line: 3,
                character: 10,
            });

            expect(completions).toBeTruthy();
            
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            
            // Should include the user-defined variable
            const indsCompletion = items.find(item => item.label === 'inds');
            expect(indsCompletion).toBeDefined();
            expect(indsCompletion?.kind).toBe(CompletionItemKind.Variable);
        });
    });

    describe('Completion Resolution', () => {
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

        it('should resolve user-defined variable completion', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    myVar = p1.individuals;
    x = my
}`
            );
            
            const completions = completionService.getCompletions(document, {
                line: 2,
                character: 10,
            });

            const items = Array.isArray(completions) ? completions : completions?.items || [];
            const myVarItem = items.find(item => item.label === 'myVar');
            
            expect(myVarItem).toBeDefined();
            
            if (myVarItem) {
                const resolved = completionService.resolveCompletion(myVarItem);
                
                expect(resolved).toBeDefined();
                expect(resolved.documentation).toBeDefined();
                
                if (resolved.documentation && typeof resolved.documentation === 'object' && 'value' in resolved.documentation) {
                    expect(resolved.documentation.value).toContain('Individual');
                }
            }
        });
    });
});

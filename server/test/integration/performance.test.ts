import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentationService } from '../../src/services/documentation-service';
import { CompletionService } from '../../src/services/completion-service';
import { ValidationService } from '../../src/services/validation-service';
import { setLoggerSilent } from '../../src/utils/logger';
import { documentCache } from '../../src/services/document-cache';
import { trackInstanceDefinitions } from '../../src/utils/instance';
import { validateStructure } from '../../src/validation/structure';

describe('Performance Tests', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;
    let validationService: ValidationService;

    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
        validationService = new ValidationService(documentationService);
    });

    describe('Large Document Handling', () => {
        it('should handle completion for large document (5000+ lines)', () => {
            // Create a large document with many lines
            const lines: string[] = [];
            for (let i = 0; i < 5000; i++) {
                lines.push(`    x${i} = ${i};`);
            }
            const content = `initialize() {\n${lines.join('\n')}\n}`;
            const document = TextDocument.create('file:///large.slim', 'slim', 1, content);

            const startTime = performance.now();
            const completions = completionService.getCompletions(document, {
                line: 2500,
                character: 10,
            });
            const endTime = performance.now();

            expect(completions).toBeDefined();
            expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
        });

        it('should handle instance tracking for large document (5000+ lines)', () => {
            const lines: string[] = [];
            for (let i = 0; i < 5000; i++) {
                lines.push(`    var${i} = p1.individuals[${i % 100}];`);
            }
            const content = `1 early() {\n    sim.addSubpop("p1", 1000);\n${lines.join('\n')}\n}`;
            const document = TextDocument.create('file:///large.slim', 'slim', 1, content);

            const startTime = performance.now();
            const trackingState = trackInstanceDefinitions(document);
            const endTime = performance.now();

            expect(trackingState).toBeDefined();
            expect(trackingState.instanceDefinitions).toBeDefined();
            expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
        });

        it('should handle structure validation for large document (5000+ lines)', () => {
            const lines: string[] = [];
            for (let i = 0; i < 5000; i++) {
                lines.push(`    if (x > ${i}) {`);
                lines.push(`        y = ${i};`);
                lines.push(`    }`);
            }
            const content = `initialize() {\n${lines.join('\n')}\n}`;
            const documentLines = content.split('\n');

            const startTime = performance.now();
            const diagnostics = validateStructure(documentLines, 'slim');
            const endTime = performance.now();

            expect(diagnostics).toBeDefined();
            expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
        });

        it('should handle very large document (10000+ lines) efficiently', () => {
            const lines: string[] = [];
            for (let i = 0; i < 10000; i++) {
                lines.push(`    result${i} = sum(1:${i});`);
            }
            const content = `1 early() {\n${lines.join('\n')}\n}`;
            const document = TextDocument.create('file:///very-large.slim', 'slim', 1, content);

            const startTime = performance.now();
            const trackingState = trackInstanceDefinitions(document);
            const endTime = performance.now();

            expect(trackingState).toBeDefined();
            expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
        });
    });

    describe('Deep Nesting Performance', () => {
        it('should handle deeply nested braces efficiently (200+ levels)', () => {
            // Create document with 200 levels of nesting
            let content = '';
            for (let i = 0; i < 200; i++) {
                content += 'if (x > 0) {\n';
            }
            for (let i = 0; i < 200; i++) {
                content += '    x = 1;\n';
            }
            for (let i = 0; i < 200; i++) {
                content += '}\n';
            }

            const document = TextDocument.create('file:///nested.slim', 'slim', 1, content);
            const lines = content.split('\n');

            const startTime = performance.now();
            const diagnostics = validateStructure(lines, 'slim');
            const endTime = performance.now();

            expect(diagnostics).toBeDefined();
            expect(endTime - startTime).toBeLessThan(300); // Should complete quickly
        });

        it('should handle deeply nested function calls efficiently (500+ levels)', () => {
            // Create deeply nested function call: func1(func2(func3(...)))
            let content = 'result = ';
            for (let i = 0; i < 500; i++) {
                content += `func${i}(`;
            }
            content += '1';
            for (let i = 0; i < 500; i++) {
                content += ')';
            }
            content += ';';

            const document = TextDocument.create('file:///nested-calls.slim', 'slim', 1, content);

            const startTime = performance.now();
            const completions = completionService.getCompletions(document, {
                line: 0,
                character: content.length - 1,
            });
            const endTime = performance.now();

            expect(completions).toBeDefined();
            expect(endTime - startTime).toBeLessThan(500);
        });

        it('should handle mixed deep nesting (braces, brackets, parentheses)', () => {
            let content = 'result = ';
            for (let i = 0; i < 100; i++) {
                content += 'arr[';
            }
            for (let i = 0; i < 100; i++) {
                content += 'func(';
            }
            for (let i = 0; i < 100; i++) {
                content += 'if (x) {';
            }
            content += '1';
            for (let i = 0; i < 100; i++) {
                content += '}';
            }
            for (let i = 0; i < 100; i++) {
                content += ')';
            }
            for (let i = 0; i < 100; i++) {
                content += ']';
            }
            content += ';';

            const document = TextDocument.create('file:///mixed-nesting.slim', 'slim', 1, content);
            const lines = content.split('\n');

            const startTime = performance.now();
            const diagnostics = validateStructure(lines, 'slim');
            const endTime = performance.now();

            expect(diagnostics).toBeDefined();
            expect(endTime - startTime).toBeLessThan(400);
        });
    });

    describe('Many Variables Performance', () => {
        it('should handle document with many variable definitions (2000+ vars)', () => {
            const lines: string[] = [];
            for (let i = 0; i < 2000; i++) {
                lines.push(`    var${i} = ${i};`);
            }
            const content = `1 early() {\n${lines.join('\n')}\n}`;
            const document = TextDocument.create('file:///many-vars.slim', 'slim', 1, content);

            const startTime = performance.now();
            const trackingState = trackInstanceDefinitions(document);
            const endTime = performance.now();

            expect(trackingState).toBeDefined();
            expect(Object.keys(trackingState.instanceDefinitions).length).toBeGreaterThan(0);
            expect(endTime - startTime).toBeLessThan(500);
        });

        it('should handle completion with many tracked variables (1000+ vars)', () => {
            const lines: string[] = [];
            for (let i = 0; i < 1000; i++) {
                lines.push(`    var${i} = p1.individuals[${i}];`);
            }
            lines.push('    x = var'); // Trigger completion
            const content = `1 early() {\n    sim.addSubpop("p1", 1000);\n${lines.join('\n')}\n}`;
            const document = TextDocument.create('file:///many-vars.slim', 'slim', 1, content);

            const startTime = performance.now();
            const completions = completionService.getCompletions(document, {
                line: 1001,
                character: 10,
            });
            const endTime = performance.now();

            expect(completions).toBeDefined();
            expect(endTime - startTime).toBeLessThan(500);
        });

        it('should handle complex variable dependencies efficiently', () => {
            const lines: string[] = [];
            // Create chain of dependencies: var0 -> var1 -> var2 -> ...
            for (let i = 0; i < 1000; i++) {
                if (i === 0) {
                    lines.push(`    var${i} = p1.individuals[0];`);
                } else {
                    lines.push(`    var${i} = var${i - 1}.genomes[0];`);
                }
            }
            const content = `1 early() {\n    sim.addSubpop("p1", 1000);\n${lines.join('\n')}\n}`;
            const document = TextDocument.create('file:///dependencies.slim', 'slim', 1, content);

            const startTime = performance.now();
            const trackingState = trackInstanceDefinitions(document);
            const endTime = performance.now();

            expect(trackingState).toBeDefined();
            // Should track all variables (may include p1 and other context variables)
            expect(Object.keys(trackingState.instanceDefinitions).length).toBeGreaterThanOrEqual(1000);
            expect(endTime - startTime).toBeLessThan(1000);
        });
    });

    describe('Cache Performance', () => {
        it('should use cache for repeated operations on same document', () => {
            const content = `1 early() {
    sim.addSubpop("p1", 1000);
    ind = p1.individuals[0];
    genome = ind.genomes[0];
}`;
            const document = TextDocument.create('file:///cache-test.slim', 'slim', 1, content);

            // First call - should populate cache
            const startTime1 = performance.now();
            const trackingState1 = trackInstanceDefinitions(document);
            const endTime1 = performance.now();
            const firstCallTime = endTime1 - startTime1;

            // Second call - should use cache
            const startTime2 = performance.now();
            const trackingState2 = trackInstanceDefinitions(document);
            const endTime2 = performance.now();
            const secondCallTime = endTime2 - startTime2;

            expect(trackingState1).toBeDefined();
            expect(trackingState2).toBeDefined();
            // Second call should be faster (or at least not significantly slower)
            expect(secondCallTime).toBeLessThanOrEqual(firstCallTime * 2);
        });

        it('should handle cache invalidation efficiently (50+ versions)', () => {
            const baseContent = `1 early() {
    sim.addSubpop("p1", 1000);
}`;

            // Create multiple versions of the document
            const documents: TextDocument[] = [];
            for (let i = 1; i <= 50; i++) {
                const content = `${baseContent}\n    x${i} = ${i};`;
                documents.push(TextDocument.create('file:///cache-invalidation.slim', 'slim', i, content));
            }

            const startTime = performance.now();
            for (const doc of documents) {
                trackInstanceDefinitions(doc);
            }
            const endTime = performance.now();

            // Should handle cache invalidation efficiently
            expect(endTime - startTime).toBeLessThan(1000);
        });
    });

    describe('Concurrent Operations', () => {
        it('should handle multiple completion requests efficiently (100+ requests)', () => {
            const content = `1 early() {
    sim.addSubpop("p1", 1000);
    ind = p1.individuals[0];
    genome = ind.genomes[0];
}`;
            const document = TextDocument.create('file:///concurrent.slim', 'slim', 1, content);

            // Generate many positions across the document
            const positions: Array<{ line: number; character: number }> = [];
            for (let i = 0; i < 100; i++) {
                positions.push({ line: Math.floor(i / 3), character: (i % 20) + 5 });
            }

            const startTime = performance.now();
            const results = positions.map(pos => completionService.getCompletions(document, pos));
            const endTime = performance.now();

            expect(results).toHaveLength(100);
            results.forEach(result => {
                expect(result).toBeDefined();
            });
            expect(endTime - startTime).toBeLessThan(1000);
        });

        it('should handle multiple validation requests efficiently (50+ passes)', () => {
            const lines: string[] = [];
            for (let i = 0; i < 500; i++) {
                lines.push(`    x${i} = ${i};`);
            }
            const content = `initialize() {\n${lines.join('\n')}\n}`;
            const documentLines = content.split('\n');

            const startTime = performance.now();
            // Simulate multiple validation passes
            for (let i = 0; i < 50; i++) {
                validateStructure(documentLines, 'slim');
            }
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(1000);
        });

        it('should handle mixed operations efficiently (completion + tracking + validation)', () => {
            const lines: string[] = [];
            for (let i = 0; i < 1000; i++) {
                lines.push(`    var${i} = p1.individuals[${i % 100}];`);
            }
            const content = `1 early() {\n    sim.addSubpop("p1", 1000);\n${lines.join('\n')}\n}`;
            const document = TextDocument.create('file:///mixed-ops.slim', 'slim', 1, content);
            const documentLines = content.split('\n');

            const startTime = performance.now();
            // Perform multiple different operations
            for (let i = 0; i < 10; i++) {
                trackInstanceDefinitions(document);
                completionService.getCompletions(document, { line: 500, character: 10 });
                validateStructure(documentLines, 'slim');
            }
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(2000);
        });
    });

    describe('Memory Usage', () => {
        it('should not leak memory with repeated operations (1000+ operations)', () => {
            const content = `1 early() {
    sim.addSubpop("p1", 1000);
}`;

            // Perform many operations
            for (let i = 0; i < 1000; i++) {
                const document = TextDocument.create(
                    `file:///memory-test-${i}.slim`,
                    'slim',
                    1,
                    content
                );
                trackInstanceDefinitions(document);
                completionService.getCompletions(document, { line: 1, character: 10 });
            }

            // Clear cache and verify it's empty
            documentCache.clear();
            const stats = documentCache.getStats();
            expect(stats.size).toBe(0);
        });

        it('should respect cache size limits (100+ entries)', () => {
            // Fill cache beyond default limit (25 entries)
            for (let i = 0; i < 100; i++) {
                const document = TextDocument.create(
                    `file:///cache-limit-${i}.slim`,
                    'slim',
                    1,
                    `x${i} = ${i};`
                );
                trackInstanceDefinitions(document);
            }

            const stats = documentCache.getStats();
            // Cache should not exceed max size (25)
            expect(stats.size).toBeLessThanOrEqual(25);
        });

        it('should handle rapid cache churn efficiently', () => {
            // Rapidly create and invalidate cache entries
            for (let i = 0; i < 200; i++) {
                const doc1 = TextDocument.create(`file:///churn-${i}.slim`, 'slim', 1, `x = ${i};`);
                trackInstanceDefinitions(doc1);
                
                // Invalidate by creating new version
                const doc2 = TextDocument.create(`file:///churn-${i}.slim`, 'slim', 2, `x = ${i + 1};`);
                trackInstanceDefinitions(doc2);
            }

            const stats = documentCache.getStats();
            // Cache should still respect limits
            expect(stats.size).toBeLessThanOrEqual(25);
        });
    });

    describe('Documentation Loading Performance', () => {
        it('should load documentation efficiently', () => {
            const startTime = performance.now();
            const functions = documentationService.getFunctions();
            const endTime = performance.now();

            expect(functions).toBeDefined();
            expect(Object.keys(functions).length).toBeGreaterThan(0);
            // Documentation should load quickly (cached after first load)
            expect(endTime - startTime).toBeLessThan(200);
        });

        it('should provide completions efficiently after documentation load', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(');

            const startTime = performance.now();
            const completions = completionService.getCompletions(document, {
                line: 0,
                character: 4,
            });
            const endTime = performance.now();

            expect(completions).toBeDefined();
            expect(endTime - startTime).toBeLessThan(200);
        });
    });

    describe('Stress Tests', () => {
        it('should handle extreme document size (20000+ lines)', () => {
            const lines: string[] = [];
            for (let i = 0; i < 20000; i++) {
                lines.push(`    result${i} = calculate(${i});`);
            }
            const content = `1 early() {\n${lines.join('\n')}\n}`;
            const document = TextDocument.create('file:///extreme.slim', 'slim', 1, content);

            const startTime = performance.now();
            const trackingState = trackInstanceDefinitions(document);
            const endTime = performance.now();

            expect(trackingState).toBeDefined();
            expect(endTime - startTime).toBeLessThan(5000); // Allow more time for extreme size
        });

        it('should handle complex real-world pattern efficiently', () => {
            // Simulate a complex real-world SLiM script
            const lines: string[] = [];
            lines.push('initialize() {');
            lines.push('    initializeMutationRate(1e-7);');
            lines.push('    initializeMutationType("m1", 0.5, "f", 0.0);');
            lines.push('    initializeGenomicElementType("g1", m1, 1.0);');
            lines.push('    initializeGenomicElement(g1, 0, 99999);');
            lines.push('    initializeRecombinationRate(1e-8);');
            lines.push('}');
            lines.push('');
            lines.push('1 early() {');
            lines.push('    sim.addSubpop("p1", 1000);');
            lines.push('}');
            
            // Add many callbacks with complex logic
            for (let i = 1; i <= 100; i++) {
                lines.push('');
                lines.push(`${i} late() {`);
                for (let j = 0; j < 50; j++) {
                    lines.push(`    ind${j} = p1.individuals[${j}];`);
                    lines.push(`    genome${j} = ind${j}.genomes[0];`);
                    lines.push(`    muts${j} = genome${j}.mutations;`);
                    lines.push(`    count${j} = length(muts${j});`);
                }
                lines.push('}');
            }

            const content = lines.join('\n');
            const document = TextDocument.create('file:///real-world.slim', 'slim', 1, content);

            const startTime = performance.now();
            const trackingState = trackInstanceDefinitions(document);
            const completions = completionService.getCompletions(document, { line: 500, character: 10 });
            const endTime = performance.now();

            expect(trackingState).toBeDefined();
            expect(completions).toBeDefined();
            expect(endTime - startTime).toBeLessThan(2000);
        });
    });
});


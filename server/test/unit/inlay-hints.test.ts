import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { InlayHintKind, Range } from 'vscode-languageserver/node';
import { registerInlayHintsProvider } from '../../src/providers/inlay-hints';
import { createTestContext } from '../helpers/test-context';

describe('Inlay Hints Provider', () => {
    let mockDocuments: any;
    let inlayHintHandler: any;

    beforeEach(() => {
        // Mock connection with nested languages.inlayHint.on
        const mockConnection = {
            languages: {
                inlayHint: {
                    on: (handler: any) => {
                        inlayHintHandler = handler;
                        return { dispose: () => {} };
                    },
                },
            },
        } as any;

        const result = createTestContext(mockConnection);
        mockDocuments = result.mockDocuments;

        registerInlayHintsProvider(result.context);
    });

    describe('Type Hints for Variable Assignments', () => {
        it('should provide type hints for subpopulation assignments', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
    pop = sim.subpopulations[0];
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 3, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            // Should have type hint for 'pop'
            const popHint = result.find(
                (h: any) => h.label.includes('Subpopulation')
            );
            expect(popHint).toBeDefined();
            expect(popHint.kind).toBe(InlayHintKind.Type);
        });

        it('should provide type hints for individual assignments', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    ind = p1.individuals[0];
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 2, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            // Should have type hint for 'ind'
            const indHint = result.find((h: any) => h.label.includes('Individual'));
            expect(indHint).toBeDefined();
            expect(indHint.kind).toBe(InlayHintKind.Type);
        });

        it('should not provide hints for property assignments', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    obj.property = 10;
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 2, 0),
            });

            // Should not provide hints for property assignments
            expect(result.length).toBe(0);
        });
    });

    describe('Type Hints for Loop Variables', () => {
        it('should provide type hints for individual loop variables', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (ind in p1.individuals) {
        catn(ind.fitness);
    }
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 4, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            // Should have type hint for 'ind'
            const indHint = result.find((h: any) => h.label.includes('Individual'));
            expect(indHint).toBeDefined();
            expect(indHint.kind).toBe(InlayHintKind.Type);
        });

        it('should provide type hints for genome loop variables', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (genome in p1.genomes) {
        catn(genome.size);
    }
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 4, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            // Should have type hint for 'genome' (Haplosome is the SLiM 4 class name)
            const genomeHint = result.find((h: any) => h.label.includes('Haplosome'));
            expect(genomeHint).toBeDefined();
            expect(genomeHint.kind).toBe(InlayHintKind.Type);
        });

        it('should provide type hints for mutation loop variables', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (mut in genome.mutations) {
        catn(mut.position);
    }
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 4, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            // Should have type hint for 'mut'
            const mutHint = result.find((h: any) => h.label.includes('Mutation'));
            expect(mutHint).toBeDefined();
            expect(mutHint.kind).toBe(InlayHintKind.Type);
        });

        it('should provide type hints for subpopulation loop variables', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (subpop in sim.subpopulations) {
        catn(subpop.individualCount);
    }
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 4, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            // Should have type hint for 'subpop'
            const subpopHint = result.find((h: any) => h.label.includes('Subpopulation'));
            expect(subpopHint).toBeDefined();
            expect(subpopHint.kind).toBe(InlayHintKind.Type);
        });

        it('should provide type hints for range loop variables', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (i in 1:10) {
        catn(i);
    }
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 4, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            // Should have type hint for 'i'
            const iHint = result.find((h: any) => h.label.includes('integer'));
            expect(iHint).toBeDefined();
            expect(iHint.kind).toBe(InlayHintKind.Type);
        });
    });

    describe('Parameter Name Hints', () => {
        it('should provide parameter name hints for function calls', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    x = sum(1, 2, 3);
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 2, 0),
            });

            expect(result).toBeDefined();
            // Should have parameter hints (if sum has documented parameters)
            const paramHints = result.filter((h: any) => h.kind === InlayHintKind.Parameter);
            // Note: This will depend on whether sum() has parameter names in docs
        });

        it('should not provide parameter hints for control structures', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    if (x > 0) {
        catn(x);
    }
    for (i in 1:10) {
        catn(i);
    }
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 7, 0),
            });

            expect(result).toBeDefined();
            // Should not have parameter hints for 'if' or 'for'
            const paramHints = result.filter((h: any) => {
                return h.kind === InlayHintKind.Parameter && (h.label.includes('if') || h.label.includes('for'));
            });
            expect(paramHints.length).toBe(0);
        });

        it('should handle nested function calls', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    x = abs(sum(1, 2));
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 2, 0),
            });

            expect(result).toBeDefined();
            // Should handle nested calls without errors
        });
    });

    describe('Edge Cases', () => {
        it('should skip comment lines', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    // x = p1.individuals[0];
    // for (ind in p1.individuals) { }
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 3, 0),
            });

            expect(result).toBeDefined();
            // Should not provide hints for commented code
            expect(result.length).toBe(0);
        });

        it('should skip empty lines', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {

    x = 10;

}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 4, 0),
            });

            expect(result).toBeDefined();
            // Should handle empty lines without errors
        });

        it('should handle multi-line function calls gracefully', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    x = someFunction(
        arg1,
        arg2
    );
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 5, 0),
            });

            expect(result).toBeDefined();
            // Should handle multi-line calls (may not provide hints for incomplete lines)
        });

        it('should return empty array for non-existent document', () => {
            mockDocuments.get = () => null;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///nonexistent.slim' },
                range: Range.create(0, 0, 10, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBe(0);
        });
    });

    describe('Complex Scenarios', () => {
        it('should provide hints for complex SLiM script', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationRate(1e-7);
}

1 early() {
    sim.addSubpop("p1", 1000);
    pop = sim.subpopulations[0];
    
    for (ind in pop.individuals) {
        fitness = ind.fitness;
    }
}

1000 late() {
    survivors = p1.individuals;
    catn(survivors.size());
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 16, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            // Should have multiple type hints
            const typeHints = result.filter((h: any) => h.kind === InlayHintKind.Type);
            expect(typeHints.length).toBeGreaterThan(0);
        });

        it('should handle tracked instance definitions', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
    myPop = sim.subpopulations[0];
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 3, 0),
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            // Should infer Subpopulation type from array access
            const myPopHint = result.find(
                (h: any) => h.label.includes('Subpopulation')
            );
            expect(myPopHint).toBeDefined();
        });

        it('should not provide type hints for numeric function results', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
    p1 = sim.subpopulations[0];
    males = sum(p1.individuals);
    total = length(p1.individuals);
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 5, 0),
            });

            expect(result).toBeDefined();

            // Should have type hint for p1 (Subpopulation)
            const p1Hint = result.find((h: any) => h.label.includes('Subpopulation'));
            expect(p1Hint).toBeDefined();

            // Should NOT have type hints for males or total (they should be numeric)
            const malesHint = result.find((h: any) => h.position.line === 2 && h.label.includes('Individual'));
            const totalHint = result.find((h: any) => h.position.line === 3 && h.label.includes('integer'));

            expect(malesHint).toBeUndefined();
            expect(totalHint).toBeUndefined();
        });

        it('should not provide type hints for numeric function results with complex expressions', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
    p1 = sim.subpopulations[0];
    males = sum(p1.individuals[p1.individuals.sex == "M"]);
    count = length(p1.individuals[p1.individuals.age > 0]);
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 5, 0),
            });

            expect(result).toBeDefined();

            // Should have type hint for p1 (Subpopulation)
            const p1Hint = result.find((h: any) => h.label.includes('Subpopulation'));
            expect(p1Hint).toBeDefined();

            // Should NOT have type hints for males or count (they should be numeric)
            const malesHint = result.find((h: any) => h.position.line === 2 && h.label.includes('Individual'));
            const countHint = result.find((h: any) => h.position.line === 3 && h.label.includes('Individual'));

            // These should be undefined - numeric functions shouldn't give type hints
            expect(malesHint).toBeUndefined();
            expect(countHint).toBeUndefined();
        });

        it('should handle user example with logical expressions in sum', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
    p1 = sim.subpopulations[0];
    ages = sapply(p1.individuals, "applyValue.getValue('age');");
    mean_age = mean(ages);
    males = sum(p1.individuals.sex == "M");
    females = sum(p1.individuals.sex == "F");
}`
            );

            mockDocuments.get = () => document;

            const result = inlayHintHandler({
                textDocument: { uri: 'file:///test.slim' },
                range: Range.create(0, 0, 7, 0),
            });

            expect(result).toBeDefined();

            // Should have type hint for p1 (Subpopulation)
            const p1Hint = result.find((h: any) => h.label.includes('Subpopulation'));
            expect(p1Hint).toBeDefined();

            // males and females should NOT have type hints (they should be numeric)
            const malesHint = result.find((h: any) => h.position.line === 4 && h.label.includes('Individual'));
            const femalesHint = result.find((h: any) => h.position.line === 5 && h.label.includes('Individual'));

            expect(malesHint).toBeUndefined();
            expect(femalesHint).toBeUndefined();
        });

    });
});


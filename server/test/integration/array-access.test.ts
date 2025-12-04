import { describe, it, expect } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { inferTypeFromExpression } from '../../src/utils/type-manager';
import { trackInstanceDefinitions } from '../../src/utils/instance';

/**
 * Integration tests for array access handling across the codebase.
 * These tests verify that array access is properly handled for type inference
 * and instance tracking.
 */
describe('Array Access Integration', () => {
    describe('Type Inference from Array Access', () => {
        it('should infer Subpopulation from sim.subpopulations[0]', () => {
            const type = inferTypeFromExpression('sim.subpopulations[0]');
            expect(type).toBe('Subpopulation');
        });

        it('should infer Subpopulation from species.subpopulations[0]', () => {
            const type = inferTypeFromExpression('species.subpopulations[0]');
            expect(type).toBe('Subpopulation');
        });

        it('should infer Individual from p1.individuals[0]', () => {
            const type = inferTypeFromExpression('p1.individuals[0]');
            expect(type).toBe('Individual');
        });

        it('should infer Individual from subpop.individuals[10]', () => {
            const type = inferTypeFromExpression('subpop.individuals[10]');
            expect(type).toBe('Individual');
        });

        it('should infer Haplosome from ind.genomes[0]', () => {
            const type = inferTypeFromExpression('ind.genomes[0]');
            expect(type).toBe('Haplosome');
        });

        it('should infer Haplosome from individual.genomes[1]', () => {
            const type = inferTypeFromExpression('individual.genomes[1]');
            expect(type).toBe('Haplosome');
        });

        it('should infer Mutation from genome.mutations[0]', () => {
            const type = inferTypeFromExpression('genome.mutations[0]');
            expect(type).toBe('Mutation');
        });

        it('should infer Mutation from ind.genomes[0].mutations[5]', () => {
            const type = inferTypeFromExpression('ind.genomes[0].mutations[5]');
            expect(type).toBe('Mutation');
        });

        it('should infer Chromosome from sim.chromosomes[0]', () => {
            const type = inferTypeFromExpression('sim.chromosomes[0]');
            expect(type).toBe('Chromosome');
        });

        it('should handle complex chained array access', () => {
            const type = inferTypeFromExpression('sim.subpopulations[0].individuals[10]');
            expect(type).toBe('Individual');
        });

        it('should handle array access with expressions as indices', () => {
            const type = inferTypeFromExpression('p1.individuals[i + 1]');
            expect(type).toBe('Individual');
        });

        it('should handle array access with method calls as indices', () => {
            const type = inferTypeFromExpression('p1.individuals[asInteger(x)]');
            expect(type).toBe('Individual');
        });
    });

    describe('Instance Tracking with Array Access', () => {
        it('should track variable assigned from array access', () => {
            const document = TextDocument.create(
                'file:///test-variable-tracking.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
    myPop = sim.subpopulations[0];
    myInd = p1.individuals[0];
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // Should track myPop as Subpopulation
            expect(trackingState.instanceDefinitions['myPop']).toBe('Subpopulation');

            // Should track myInd as Individual
            expect(trackingState.instanceDefinitions['myInd']).toBe('Individual');
        });

        it('should track nested array access assignments', () => {
            const document = TextDocument.create(
                'file:///test-nested-assignments.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationRate(1e-7);
}

1 early() {
    sim.addSubpop("p1", 1000);
}

2 early() {
    genome = p1.individuals[0].genomes[0];
    mutation = genome.mutations[0];
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // Should track genome as Haplosome
            expect(trackingState.instanceDefinitions['genome']).toBe('Haplosome');

            // Should track mutation as Mutation
            expect(trackingState.instanceDefinitions['mutation']).toBe('Mutation');
        });

        it('should track multiple variables from different array accesses', () => {
            const document = TextDocument.create(
                'file:///test-multiple-variables.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
    sim.addSubpop("p2", 500);
}

2 early() {
    pop1 = sim.subpopulations[0];
    pop2 = sim.subpopulations[1];
    ind1 = pop1.individuals[0];
    ind2 = pop2.individuals[0];
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.instanceDefinitions['pop1']).toBe('Subpopulation');
            expect(trackingState.instanceDefinitions['pop2']).toBe('Subpopulation');
            expect(trackingState.instanceDefinitions['ind1']).toBe('Individual');
            expect(trackingState.instanceDefinitions['ind2']).toBe('Individual');
        });

        it('should handle array access in loop contexts', () => {
            const document = TextDocument.create(
                'file:///test-loop-contexts.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
}

2 early() {
    for (i in 0:9) {
        ind = p1.individuals[i];
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // Should track ind as Individual even though it's in a loop
            expect(trackingState.instanceDefinitions['ind']).toBe('Individual');
        });
    });

    describe('Edge Cases', () => {
        it('should handle array access without spaces', () => {
            const type = inferTypeFromExpression('p1.individuals[0]');
            expect(type).toBe('Individual');
        });

        it('should handle array access with spaces', () => {
            const type = inferTypeFromExpression('p1.individuals[ 0 ]');
            expect(type).toBe('Individual');
        });

        it('should handle multi-dimensional array access', () => {
            // In SLiM, this would be accessing an element from a matrix
            const type = inferTypeFromExpression('p1.individuals[0][1]');
            // Should still infer Individual from the first array access
            expect(type).toBe('Individual');
        });

        it('should not infer type from unrecognized array access', () => {
            const type = inferTypeFromExpression('unknownObject[0]');
            expect(type).toBeNull();
        });

        it('should not infer type from array literals', () => {
            const type = inferTypeFromExpression('[1, 2, 3][0]');
            expect(type).toBeNull();
        });

        it('should handle method calls that return arrays', () => {
            // sampleIndividuals returns a vector of individuals
            const type = inferTypeFromExpression('p1.sampleIndividuals(10)[0]', { p1: 'Subpopulation' });
            expect(type).toBe('Individual');
        });
    });

    describe('Regression Tests', () => {
        it('should fix the original bug: sim.subpopulations[0] should infer Subpopulation', () => {
            // This was the bug we discovered during inlay hints testing
            const type = inferTypeFromExpression('sim.subpopulations[0]');
            expect(type).toBe('Subpopulation');
            expect(type).not.toBeNull();
        });

        it('should work with property access patterns that already worked', () => {
            // These patterns already worked before the fix
            expect(inferTypeFromExpression('p1.individuals[0]')).toBe('Individual');
            expect(inferTypeFromExpression('ind.genomes[0]')).toBe('Haplosome');
            expect(inferTypeFromExpression('genome.mutations[0]')).toBe('Mutation');
        });

        it('should track subpopulation from array access in instance tracking', () => {
            const document = TextDocument.create(
                'file:///test-subpopulation-tracking.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
}

2 early() {
    mySubpop = sim.subpopulations[0];
}`
            );

            const trackingState = trackInstanceDefinitions(document);
            
            // This should now work correctly
            expect(trackingState.instanceDefinitions['mySubpop']).toBe('Subpopulation');
        });
    });
});


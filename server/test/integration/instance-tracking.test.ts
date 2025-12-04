import { describe, it, expect } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { inferTypeFromExpression } from '../../src/utils/type-manager';
import { trackInstanceDefinitions } from '../../src/utils/instance';

describe('Instance Tracking', () => {
    it('should infer types for array access expressions', () => {
        expect(inferTypeFromExpression('sim.subpopulations[0]')).toBe('Subpopulation');
        expect(inferTypeFromExpression('p1.individuals[0]')).toBe('Individual');
        expect(inferTypeFromExpression('p1.individuals[0].genomes[0]')).toBe('Haplosome');
    });

    it('should track instance definitions within callbacks', () => {
        const document = TextDocument.create(
            'file:///test-instance-tracking-same-callback.slim',
            'slim',
            1,
            `1 early() {
    sim.addSubpop("p1", 1000);
}

2 early() {
    pop1 = sim.subpopulations[0];
    ind1 = p1.individuals[0];
    genome = ind1.genomes[0];
}`
        );

        const trackingState = trackInstanceDefinitions(document);

        expect(trackingState.instanceDefinitions['p1']).toBe('Subpopulation');
        expect(trackingState.instanceDefinitions['pop1']).toBe('Subpopulation');
        expect(trackingState.instanceDefinitions['ind1']).toBe('Individual');
        expect(trackingState.instanceDefinitions['genome']).toBe('Haplosome');
    });

    it('should track complex nested assignments', () => {
        const document = TextDocument.create(
            'file:///test-instance-tracking-exact-structure.slim',
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

        expect(trackingState.instanceDefinitions['p1']).toBe('Subpopulation');
        expect(trackingState.instanceDefinitions['genome']).toBe('Haplosome');
        expect(trackingState.instanceDefinitions['mutation']).toBe('Mutation');
    });
});


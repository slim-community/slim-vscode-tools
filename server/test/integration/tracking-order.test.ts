import { describe, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { trackInstanceDefinitions } from '../../src/utils/instance';
import { inferTypeFromExpression } from '../../src/utils/type-manager';

describe('Tracking Order Debug', () => {
    it('should track instance definitions in order', () => {
        const document = TextDocument.create(
            'file:///test-tracking-order.slim',
            'slim',
            1,
            `1 early() {
    sim.addSubpop("p1", 1000);
}

2 early() {
    genome = p1.individuals[0].genomes[0];
    mutation = genome.mutations[0];
}`
        );

        const trackingState = trackInstanceDefinitions(document);

        // Verify that the tracking worked correctly
        expect(trackingState.instanceDefinitions['p1']).toBe('Subpopulation');
        expect(trackingState.instanceDefinitions['genome']).toBe('Haplosome');
        expect(trackingState.instanceDefinitions['mutation']).toBe('Mutation');
    });
});


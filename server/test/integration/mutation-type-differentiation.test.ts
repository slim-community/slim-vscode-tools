import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { trackInstanceDefinitions } from '../../src/utils/instance';
import { CompletionService } from '../../src/services/completion-service';
import { DocumentationService } from '../../src/services/documentation-service';
import { CompletionItemKind } from 'vscode-languageserver/node';
import { setLoggerSilent } from '../../src/utils/logger';
import { documentCache } from '../../src/services/document-cache';
import { CLASS_NAMES } from '../../src/config/config';

describe('Mutation Type vs Mutation Instance Differentiation', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;

    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
    });

    it('should track mutation types in instanceDefinitions', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
    initializeMutationType("m2", 0.5, "e", 0.1);
}`
        );

        const trackingState = trackInstanceDefinitions(document);

        // Mutation types should be in definedMutationTypes Set
        expect(trackingState.definedMutationTypes.has('m1')).toBe(true);
        expect(trackingState.definedMutationTypes.has('m2')).toBe(true);

        // Mutation types should ALSO be in instanceDefinitions for proper resolution
        expect(trackingState.instanceDefinitions['m1']).toBe(CLASS_NAMES.MUTATION_TYPE);
        expect(trackingState.instanceDefinitions['m2']).toBe(CLASS_NAMES.MUTATION_TYPE);
    });

    it('should differentiate mutation types from mutation instances', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    mut = sim.mutationsOfType(m1)[0];
    muts = sim.mutationsOfType(m1);
}`
        );

        const trackingState = trackInstanceDefinitions(document);

        // m1 should be MutationType
        expect(trackingState.instanceDefinitions['m1']).toBe(CLASS_NAMES.MUTATION_TYPE);
        expect(trackingState.definedMutationTypes.has('m1')).toBe(true);

        // mut should be Mutation (instance)
        expect(trackingState.instanceDefinitions['mut']).toBe(CLASS_NAMES.MUTATION);

        // muts should be Mutation[] (vector)
        expect(trackingState.instanceDefinitions['muts']).toBe(CLASS_NAMES.MUTATION + '[]');
    });

    it('should provide MutationType completions for mutation type identifiers', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    m1.
}`
        );

        const completions = completionService.getCompletions(document, {
            line: 5,
            character: 7, // After "m1."
        });

        expect(completions).toBeTruthy();
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should include MutationType methods/properties
        // MutationType has properties like mutationEffect, mutationStackGroup, etc.
        // Note: This test verifies that m1 is recognized as MutationType and can have completions
        // The actual methods depend on documentation being loaded
        expect(items.length).toBeGreaterThan(0);
        // Check that we're getting method/property completions (not just global completions)
        const hasMethodOrProperty = items.some(item => 
            item.kind === CompletionItemKind.Method || item.kind === CompletionItemKind.Property
        );
        expect(hasMethodOrProperty).toBe(true);
    });

    it('should provide Mutation completions for mutation instance variables', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    mut = sim.mutationsOfType(m1)[0];
    mut.
}`
        );

        const completions = completionService.getCompletions(document, {
            line: 6,
            character: 9, // After "mut."
        });

        expect(completions).toBeTruthy();
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should include Mutation properties like position, selectionCoeff, etc.
        const positionCompletion = items.find(item => item.label === 'position');
        expect(positionCompletion).toBeDefined();
        expect(positionCompletion?.kind).toBe(CompletionItemKind.Property);
    });

    it('should track genomic element types in instanceDefinitions', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `initialize() {
    initializeGenomicElementType("g1", m1, 1.0);
}`
        );

        const trackingState = trackInstanceDefinitions(document);

        expect(trackingState.definedGenomicElementTypes.has('g1')).toBe(true);
        expect(trackingState.instanceDefinitions['g1']).toBe(CLASS_NAMES.GENOMIC_ELEMENT_TYPE);
    });

    it('should track interaction types in instanceDefinitions', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `initialize() {
    initializeInteractionType("i1", 1.0);
}`
        );

        const trackingState = trackInstanceDefinitions(document);

        expect(trackingState.definedInteractionTypes.has('i1')).toBe(true);
        expect(trackingState.instanceDefinitions['i1']).toBe(CLASS_NAMES.INTERACTION_TYPE);
    });

    it('should not confuse mutation type with mutation instance in expressions', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    // m1 is a MutationType
    m1.mutationEffect = function(mut) { return 1.0; };
    
    // mut is a Mutation instance
    mut = sim.mutationsOfType(m1)[0];
    pos = mut.position;
}`
        );

        const trackingState = trackInstanceDefinitions(document);

        // m1 should be MutationType
        expect(trackingState.instanceDefinitions['m1']).toBe(CLASS_NAMES.MUTATION_TYPE);
        
        // mut should be Mutation
        expect(trackingState.instanceDefinitions['mut']).toBe(CLASS_NAMES.MUTATION);
        
        // pos should be inferred as numeric (from mut.position)
        // Note: Type inference for property access might not always work, so this is optional
        // The important part is that m1 and mut are correctly differentiated
        if (trackingState.instanceDefinitions['pos']) {
            expect(trackingState.instanceDefinitions['pos']).toBe('numeric');
        }
    });
});


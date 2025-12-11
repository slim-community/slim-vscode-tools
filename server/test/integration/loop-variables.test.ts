import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { trackInstanceDefinitions, getVariablesInScope } from '../../src/utils/instance';
import { CompletionService } from '../../src/services/completion-service';
import { DocumentationService } from '../../src/services/documentation-service';
import { CompletionItemKind } from 'vscode-languageserver/node';
import { setLoggerSilent } from '../../src/utils/logger';
import { documentCache } from '../../src/services/document-cache';

describe('Loop Variable Tracking', () => {
    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
    });

    describe('Basic Loop Variable Tracking', () => {
        it('should track loop variables from for-in loops', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
    for (subpop in sim.subpopulations) {
        catn(subpop.individualCount);
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(1);
            expect(trackingState.loopScopes[0].variableName).toBe('subpop');
            expect(trackingState.loopScopes[0].variableType).toBe('Subpopulation');
            expect(trackingState.loopScopes[0].startLine).toBe(2);
        });

        it('should track loop variables for individuals', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    sim.addSubpop("p1", 1000);
    for (ind in p1.individuals) {
        catn(ind.age);
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(1);
            expect(trackingState.loopScopes[0].variableName).toBe('ind');
            expect(trackingState.loopScopes[0].variableType).toBe('Individual');
        });

        it('should track loop variables for mutations', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (mut in sim.mutationsOfType(m1)) {
        catn(mut.position);
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(1);
            expect(trackingState.loopScopes[0].variableName).toBe('mut');
            expect(trackingState.loopScopes[0].variableType).toBe('Mutation');
        });

        it('should track loop variables for integer ranges', () => {
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

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(1);
            expect(trackingState.loopScopes[0].variableName).toBe('i');
            expect(trackingState.loopScopes[0].variableType).toBe('integer');
        });
    });

    describe('Loop Scope Boundaries', () => {
        it('should correctly determine loop scope end with braces', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (subpop in sim.subpopulations) {
        catn(subpop.individualCount);
    }
    // subpop should not be in scope here
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(1);
            expect(trackingState.loopScopes[0].endLine).toBe(3); // Loop ends at closing brace (0-indexed: line 3)
        });

        it('should handle loops without explicit braces', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (i in 1:5) catn(i);
    // i should not be in scope here
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(1);
            // Single-line loop should end at the same line (0-indexed: line 1)
            expect(trackingState.loopScopes[0].endLine).toBe(1);
        });

        it('should handle nested loops with correct scoping', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (subpop in sim.subpopulations) {
        for (ind in subpop.individuals) {
            catn(ind.age);
        }
        // ind should not be in scope here
    }
    // subpop should not be in scope here
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(2);
            
            // Outer loop (0-indexed lines)
            expect(trackingState.loopScopes[0].variableName).toBe('subpop');
            expect(trackingState.loopScopes[0].startLine).toBe(1);
            expect(trackingState.loopScopes[0].endLine).toBe(6);
            
            // Inner loop
            expect(trackingState.loopScopes[1].variableName).toBe('ind');
            expect(trackingState.loopScopes[1].startLine).toBe(2);
            expect(trackingState.loopScopes[1].endLine).toBe(4);
        });

        it('should handle multiple sequential loops', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (subpop in sim.subpopulations) {
        catn(subpop.individualCount);
    }
    for (ind in p1.individuals) {
        catn(ind.age);
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(2);
            expect(trackingState.loopScopes[0].variableName).toBe('subpop');
            expect(trackingState.loopScopes[0].endLine).toBe(3);
            expect(trackingState.loopScopes[1].variableName).toBe('ind');
            expect(trackingState.loopScopes[1].startLine).toBe(4);
        });
    });

    describe('Variable Shadowing', () => {
        it('should handle loop variables shadowing outer variables', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    subpop = sim.subpopulations[0];
    for (subpop in sim.subpopulations) {
        // subpop here refers to loop variable
        catn(subpop.individualCount);
    }
    // subpop here refers to outer variable
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.instanceDefinitions['subpop']).toBe('Subpopulation');
            expect(trackingState.loopScopes).toHaveLength(1);
            expect(trackingState.loopScopes[0].variableName).toBe('subpop');
        });

        it('should handle nested loops with same variable name', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (x in sim.subpopulations) {
        for (x in x.individuals) {
            // Inner x shadows outer x
            catn(x.age);
        }
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(2);
            expect(trackingState.loopScopes[0].variableName).toBe('x');
            expect(trackingState.loopScopes[0].variableType).toBe('Subpopulation');
            expect(trackingState.loopScopes[1].variableName).toBe('x');
            expect(trackingState.loopScopes[1].variableType).toBe('Individual');
        });
    });

    describe('getVariablesInScope', () => {
        it('should return loop variables when inside loop scope', () => {
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

            const trackingState = trackInstanceDefinitions(document);
            
            // Inside loop (line 3)
            const varsInLoop = getVariablesInScope(trackingState, 3);
            expect(varsInLoop['subpop']).toBe('Subpopulation');
            
            // Outside loop (line 5)
            const varsOutside = getVariablesInScope(trackingState, 5);
            expect(varsOutside['subpop']).toBeUndefined();
        });

        it('should return correct variables for nested loops', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (subpop in sim.subpopulations) {
        for (ind in subpop.individuals) {
            catn(ind.age);
        }
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);
            
            // Inside inner loop (line 3, 0-indexed)
            const varsInner = getVariablesInScope(trackingState, 3);
            expect(varsInner['subpop']).toBe('Subpopulation');
            expect(varsInner['ind']).toBe('Individual');
            
            // Inside outer loop, outside inner loop (line 2, 0-indexed - the inner loop declaration line)
            const varsOuter = getVariablesInScope(trackingState, 2);
            expect(varsOuter['subpop']).toBe('Subpopulation');
            expect(varsOuter['ind']).toBeUndefined(); // ind is declared on this line, so not in scope yet
        });

        it('should include global instance definitions', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    p1 = sim.subpopulations[0];
    for (ind in p1.individuals) {
        catn(ind.age);
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);
            
            const varsInLoop = getVariablesInScope(trackingState, 3);
            expect(varsInLoop['sim']).toBe('Species');
            expect(varsInLoop['p1']).toBe('Subpopulation');
            expect(varsInLoop['ind']).toBe('Individual');
        });
    });

    describe('Edge Cases', () => {
        it('should handle loops at document end', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (subpop in sim.subpopulations) {
        catn(subpop.individualCount);
    }`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(1);
            // Should close at end of document
            expect(trackingState.loopScopes[0].endLine).toBeGreaterThan(0);
        });

        it('should handle empty loop bodies', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (subpop in sim.subpopulations) {
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(1);
            expect(trackingState.loopScopes[0].variableName).toBe('subpop');
        });

        it('should handle complex collection expressions', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    for (mut in sim.mutationsOfType(m1)) {
        catn(mut.position);
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.loopScopes).toHaveLength(1);
            expect(trackingState.loopScopes[0].variableName).toBe('mut');
            expect(trackingState.loopScopes[0].variableType).toBe('Mutation');
        });
    });
});

describe('Loop Variable Completions', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;

    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
    });

    it('should provide method completions for loop variables', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    sim.addSubpop("p1", 1000);
    for (subpop in sim.subpopulations) {
        subpop.
    }
}`
        );

        const completions = completionService.getCompletions(document, {
            line: 3,
            character: 15, // After "subpop."
        });

        expect(completions).toBeTruthy();
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should include Subpopulation methods
        const individualCountCompletion = items.find(item => item.label === 'individualCount');
        expect(individualCountCompletion).toBeDefined();
        expect(individualCountCompletion?.kind).toBe(CompletionItemKind.Property);
    });

    it('should provide property completions for loop variables', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    sim.addSubpop("p1", 1000);
    for (ind in p1.individuals) {
        ind.
    }
}`
        );

        const completions = completionService.getCompletions(document, {
            line: 3,
            character: 12, // After "ind."
        });

        expect(completions).toBeTruthy();
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should include Individual properties
        const ageCompletion = items.find(item => item.label === 'age');
        expect(ageCompletion).toBeDefined();
        expect(ageCompletion?.kind).toBe(CompletionItemKind.Property);
    });

    it('should not provide loop variable completions outside loop scope', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    for (subpop in sim.subpopulations) {
        catn(subpop.individualCount);
    }
    subpop.
}`
        );

        const completions = completionService.getCompletions(document, {
            line: 4,
            character: 11, // After "subpop." outside loop
        });

        expect(completions).toBeTruthy();
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should not have Subpopulation methods since subpop is out of scope
        // Instead should show global completions
        const sumCompletion = items.find(item => item.label === 'sum');
        expect(sumCompletion).toBeDefined();
    });

    it('should handle nested loop variable completions', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    sim.addSubpop("p1", 1000);
    for (subpop in sim.subpopulations) {
        for (ind in subpop.individuals) {
            ind.
        }
    }
}`
        );

        const completions = completionService.getCompletions(document, {
            line: 4,
            character: 16, // After "ind." in nested loop
        });

        expect(completions).toBeTruthy();
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should include Individual methods/properties
        const ageCompletion = items.find(item => item.label === 'age');
        expect(ageCompletion).toBeDefined();
    });

    it('should handle loop variable completions with partial typing', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    sim.addSubpop("p1", 1000);
    for (subpop in sim.subpopulations) {
        subpop.individual
    }
}`
        );

        const completions = completionService.getCompletions(document, {
            line: 3,
            character: 25, // After "subpop.individual"
        });

        expect(completions).toBeTruthy();
        const items = Array.isArray(completions) ? completions : completions?.items || [];
        
        // Should filter to properties starting with "individual"
        const individualCountCompletion = items.find(item => item.label === 'individualCount');
        expect(individualCountCompletion).toBeDefined();
    });
});

describe('Loop Variable Cache', () => {
    beforeEach(() => {
        documentCache.clear();
    });

    it('should cache loop scopes in tracking state', () => {
        const doc1 = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    for (subpop in sim.subpopulations) {
        catn(subpop.individualCount);
    }
}`
        );

        const trackingState1 = trackInstanceDefinitions(doc1);
        expect(trackingState1.loopScopes).toHaveLength(1);

        // Should be cached
        const trackingState2 = trackInstanceDefinitions(doc1);
        expect(trackingState2.loopScopes).toHaveLength(1);
        expect(trackingState2.loopScopes[0].variableName).toBe('subpop');
    });

    it('should invalidate loop scope cache on document version change', () => {
        const doc1 = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    for (subpop in sim.subpopulations) {
        catn(subpop.individualCount);
    }
}`
        );

        trackInstanceDefinitions(doc1);

        // New version with different loop
        const doc2 = TextDocument.create(
            'file:///test.slim',
            'slim',
            2,
            `1 early() {
    for (ind in p1.individuals) {
        catn(ind.age);
    }
}`
        );

        const trackingState2 = trackInstanceDefinitions(doc2);
        expect(trackingState2.loopScopes).toHaveLength(1);
        expect(trackingState2.loopScopes[0].variableName).toBe('ind');
    });
});


import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FoldingRangeKind } from 'vscode-languageserver/node';
import { registerFoldingRangeProvider } from '../../src/providers/folding-range';
import { createTestContext, createTestDocument } from '../helpers/test-context';

describe('Folding Range Provider', () => {
    let mockDocuments: any;
    let foldingRangeHandler: any;

    beforeEach(() => {
        const mockConnection = {
            onFoldingRanges: (handler: any) => {
                foldingRangeHandler = handler;
            },
        };

        const result = createTestContext(mockConnection);
        mockDocuments = result.mockDocuments;

        registerFoldingRangeProvider(result.context);
    });

    it('should provide folding ranges for SLiM callbacks', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    sim.addSubpop("p1", 1000);
    sim.addSubpop("p2", 500);
}

1000 late() {
    p1.setSubpopulationSize(2000);
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        // Check that we have region-type folding for callbacks
        const callbackFolds = result.filter(
            (r: any) => r.kind === FoldingRangeKind.Region
        );
        expect(callbackFolds.length).toBeGreaterThan(0);

        // First callback should fold from line 0 to 3
        const firstCallback = result.find((r: any) => r.startLine === 0);
        expect(firstCallback).toBeDefined();
        expect(firstCallback.endLine).toBe(3);
    });

    it('should provide folding ranges for functions', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `function (void)myFunction(void) {
    x = 10;
    return;
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        // Function should be a region-type fold
        const functionFolds = result.filter(
            (r: any) => r.kind === FoldingRangeKind.Region
        );
        expect(functionFolds.length).toBeGreaterThan(0);

        // Function should fold from line 0 to 3
        expect(result[0].startLine).toBe(0);
        expect(result[0].endLine).toBe(3);
    });

    it('should provide folding ranges for control structures', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `if (x > 0) {
    doSomething();
}

for (i in 1:10) {
    process(i);
}

while (condition) {
    loop();
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        // Should have 3 folding ranges (if, for, while)
        expect(result.length).toBeGreaterThanOrEqual(3);

        // Check first fold (if block)
        const ifBlock = result.find((r: any) => r.startLine === 0);
        expect(ifBlock).toBeDefined();
        expect(ifBlock.endLine).toBe(2);
    });

    it('should provide folding ranges for comment blocks', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `// This is a comment block
// that spans multiple lines
// and should be foldable

x = 10;

// Single comment should not fold`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();

        // Should have at least one comment fold
        const commentFolds = result.filter(
            (r: any) => r.kind === FoldingRangeKind.Comment
        );
        expect(commentFolds.length).toBeGreaterThan(0);

        // First comment block should fold from line 0 to 2
        const firstComment = commentFolds.find((r: any) => r.startLine === 0);
        expect(firstComment).toBeDefined();
        expect(firstComment.endLine).toBe(2);
    });

    it('should handle nested blocks', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    if (x > 0) {
        for (i in 1:10) {
            process(i);
        }
    }
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        // Should have 3 folding ranges (callback, if, for)
        expect(result.length).toBe(3);

        // Outer callback
        const callback = result.find((r: any) => r.startLine === 0 && r.endLine === 6);
        expect(callback).toBeDefined();

        // If block
        const ifBlock = result.find((r: any) => r.startLine === 1 && r.endLine === 5);
        expect(ifBlock).toBeDefined();

        // For loop
        const forLoop = result.find((r: any) => r.startLine === 2 && r.endLine === 4);
        expect(forLoop).toBeDefined();
    });

    it('should not fold single-line blocks', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `if (x > 0) { doSomething(); }`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        // No folding ranges for single-line blocks
        expect(result.length).toBe(0);
    });

    it('should handle strings with braces correctly', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    str = "This has a { brace";
    x = 10;
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        expect(result.length).toBe(1);

        // Should correctly fold the callback block
        expect(result[0].startLine).toBe(0);
        expect(result[0].endLine).toBe(3);
    });

    it('should handle comments with braces correctly', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `1 early() {
    // This comment has a { brace
    x = 10;
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();

        // Should correctly fold the callback block, ignoring brace in comment
        const callbackFold = result.find(
            (r: any) => r.kind === FoldingRangeKind.Region
        );
        expect(callbackFold).toBeDefined();
        expect(callbackFold.startLine).toBe(0);
        expect(callbackFold.endLine).toBe(3);
    });

    it('should return empty array for non-existent document', () => {
        mockDocuments.get = () => null;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///nonexistent.slim' },
        });

        expect(result).toBeDefined();
        expect(result.length).toBe(0);
    });

    it('should handle initialize blocks', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `initialize() {
    initializeMutationRate(1e-7);
    initializeRecombinationRate(1e-8);
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        // Initialize block should be a region-type fold
        const initFold = result.find(
            (r: any) => r.kind === FoldingRangeKind.Region && r.startLine === 0
        );
        expect(initFold).toBeDefined();
        expect(initFold.endLine).toBe(3);
    });

    it('should provide separate folding ranges for if/else blocks', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `if (x > 0) {
    doSomething();
} else {
    doSomethingElse();
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        expect(result.length).toBe(2);

        // If block: lines 0-2
        const ifBlock = result.find((r: any) => r.startLine === 0);
        expect(ifBlock).toBeDefined();
        expect(ifBlock.endLine).toBe(2);

        // Else block: lines 2-4
        const elseBlock = result.find((r: any) => r.startLine === 2);
        expect(elseBlock).toBeDefined();
        expect(elseBlock.endLine).toBe(4);
    });

    it('should provide separate folding ranges for if/else if/else chains', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `if (x > 10) {
    doA();
} else if (x > 5) {
    doB();
} else {
    doC();
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        expect(result.length).toBe(3);

        // If block: lines 0-2
        const ifBlock = result.find((r: any) => r.startLine === 0);
        expect(ifBlock).toBeDefined();
        expect(ifBlock.endLine).toBe(2);

        // Else if block: lines 2-4
        const elseIfBlock = result.find((r: any) => r.startLine === 2);
        expect(elseIfBlock).toBeDefined();
        expect(elseIfBlock.endLine).toBe(4);

        // Else block: lines 4-6
        const elseBlock = result.find((r: any) => r.startLine === 4);
        expect(elseBlock).toBeDefined();
        expect(elseBlock.endLine).toBe(6);
    });

    it('should handle nested if/else blocks', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `if (x > 0) {
    if (y > 0) {
        doA();
    } else {
        doB();
    }
} else {
    doC();
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        expect(result.length).toBe(4);

        // Outer if block: lines 0-6
        const outerIf = result.find((r: any) => r.startLine === 0 && r.endLine === 6);
        expect(outerIf).toBeDefined();

        // Inner if block: lines 1-3
        const innerIf = result.find((r: any) => r.startLine === 1 && r.endLine === 3);
        expect(innerIf).toBeDefined();

        // Inner else block: lines 3-5
        const innerElse = result.find((r: any) => r.startLine === 3 && r.endLine === 5);
        expect(innerElse).toBeDefined();

        // Outer else block: lines 6-8
        const outerElse = result.find((r: any) => r.startLine === 6 && r.endLine === 8);
        expect(outerElse).toBeDefined();
    });

    it('should handle complex SLiM script with multiple block types', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            `// Initialize the simulation
// Set up basic parameters
initialize() {
    initializeMutationRate(1e-7);
    initializeRecombinationRate(1e-8);
}

// Early event for population setup
1 early() {
    sim.addSubpop("p1", 1000);
}

// Custom function
function (void)calculateFitness(void) {
    for (ind in sim.subpopulations.individuals) {
        if (ind.fitness > 0) {
            // Process individual
            process(ind);
        }
    }
}

// Late event
1000 late() {
    catn("Done");
}`
        );

        mockDocuments.get = () => document;

        const result = foldingRangeHandler({
            textDocument: { uri: 'file:///test.slim' },
        });

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        // Should have comment folds
        const commentFolds = result.filter(
            (r: any) => r.kind === FoldingRangeKind.Comment
        );
        expect(commentFolds.length).toBeGreaterThan(0);

        // Should have region folds for callbacks and functions
        const regionFolds = result.filter(
            (r: any) => r.kind === FoldingRangeKind.Region
        );
        expect(regionFolds.length).toBeGreaterThanOrEqual(3); // initialize, early, function, late

        // Should have control structure folds
        const controlFolds = result.filter(
            (r: any) => !r.kind // blocks without specific kind
        );
        expect(controlFolds.length).toBeGreaterThan(0); // for and if blocks
    });
});


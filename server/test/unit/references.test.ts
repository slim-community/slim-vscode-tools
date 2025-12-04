import { describe, it, expect, beforeEach } from 'vitest';
import { ReferenceParams, Location } from 'vscode-languageserver';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { registerReferencesProvider } from '../../src/providers/references';
import { createTestServices } from '../helpers/test-context';

describe('References Provider', () => {
    let documents: TextDocuments<TextDocument>;
    let handler: ((params: ReferenceParams) => Location[]) | undefined;

    beforeEach(() => {
        const services = createTestServices();

        // Mock connection
        const connection = {
            onReferences: (callback: (params: ReferenceParams) => Location[]) => {
                handler = callback;
            },
        };

        documents = new TextDocuments(TextDocument);

        const context = {
            connection: connection as any,
            documents,
            ...services,
        };

        registerReferencesProvider(context);
    });

    function createDocument(uri: string, content: string): TextDocument {
        return TextDocument.create(uri, 'slim', 1, content);
    }

    function findReferences(
        document: TextDocument,
        line: number,
        character: number,
        includeDeclaration: boolean = true
    ): Location[] {
        if (!handler) {
            throw new Error('Handler not registered');
        }

        // Mock the documents.get() method to return our document
        documents.get = () => document;

        const params: ReferenceParams = {
            textDocument: { uri: document.uri },
            position: { line, character },
            context: { includeDeclaration },
        };

        return handler(params);
    }

    describe('Variable References', () => {
        it('should find all references to a variable', () => {
            const content = `
initialize() {
    defineConstant("K", 5000);
    myVar = 10;
    x = myVar + 5;
    y = myVar * 2;
    catn(myVar);
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 3, 5); // On "myVar" at line 3

            expect(refs.length).toBe(4); // declaration + 3 references
            expect(refs.map(r => r.range.start.line)).toEqual([3, 4, 5, 6]);
        });

        it('should exclude declaration when includeDeclaration is false', () => {
            const content = `
initialize() {
    myVar = 10;
    x = myVar + 5;
    y = myVar * 2;
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 5, false); // On "myVar", exclude declaration

            expect(refs.length).toBe(2); // only references, not declaration
            expect(refs.map(r => r.range.start.line)).toEqual([3, 4]);
        });

        it('should not find partial matches', () => {
            const content = `
initialize() {
    myVar = 10;
    myVariable = 20; // Should not match "myVar"
    x = myVar;
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 5); // On "myVar"

            expect(refs.length).toBe(2); // declaration + 1 reference
            expect(refs.every(r => {
                const line = content.split('\n')[r.range.start.line];
                const word = line.substring(r.range.start.character, r.range.end.character);
                return word === 'myVar';
            })).toBe(true);
        });
    });

    describe('Function References', () => {
        it('should find function definition and all calls', () => {
            const content = `
function (integer)myFunction(integer x) {
    return x * 2;
}

initialize() {
    a = myFunction(5);
    b = myFunction(10);
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 1, 19); // On function name (after return type)

            expect(refs.length).toBe(3); // definition + 2 calls
        });

        it('should find function parameter references', () => {
            const content = `
function (float)calculate(float value) {
    result = value * 2;
    catn(value);
    return value;
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 1, 33); // On "value" parameter

            expect(refs.length).toBe(4); // parameter definition + 3 uses
        });
    });

    describe('Quoted Identifier References', () => {
        it('should find references to quoted subpopulation IDs', () => {
            const content = `
initialize() {
    initializeMutationRate(1e-7);
    initializeMutationType("m1", 0.5, "f", 0.0);
    initializeGenomicElementType("g1", m1, 1.0);
    initializeGenomicElement(g1, 0, 99999);
    initializeRecombinationRate(1e-8);
}

1 early() {
    sim.addSubpop("p1", 500);
}

10 late() {
    p1.setSubpopulationSize(1000);
    catn(p1.individualCount);
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 10, 18); // On "p1" in addSubpop

            expect(refs.length).toBeGreaterThan(1);
            // Should find both quoted "p1" and unquoted p1 references
        });

        it('should find references to mutation type IDs', () => {
            const content = `
initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
    initializeMutationType("m2", 0.5, "f", 0.1);
    initializeGenomicElementType("g1", m1, 1.0);
}

1 early() {
    mut = sim.mutationsOfType(m1);
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 26); // On "m1"

            expect(refs.length).toBeGreaterThan(1);
        });
    });

    describe('Loop Variable References', () => {
        it('should find for-loop variable references', () => {
            const content = `
1 early() {
    for (i in 1:10) {
        catn(i);
        x = i * 2;
    }
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 10); // On "i" in for loop

            expect(refs.length).toBe(3); // definition + 2 uses
        });
    });

    describe('Constant References', () => {
        it('should find constant definition and references', () => {
            const content = `
initialize() {
    defineConstant("K", 5000);
    defineConstant("N", K / 2);
    catn("K = " + K);
}

1 early() {
    if (p1.individualCount > K) {
        p1.setSubpopulationSize(K);
    }
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 20); // On "K" in defineConstant

            expect(refs.length).toBeGreaterThan(2); // definition + multiple uses
        });
    });

    describe('String Literal Filtering', () => {
        it('should not find references inside string literals', () => {
            const content = `
initialize() {
    myVar = 10;
    catn("myVar is a variable"); // Should not match
    x = myVar; // Should match
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 5); // On "myVar"

            expect(refs.length).toBe(2); // declaration + 1 reference (not the one in string)
        });

        it('should handle escaped quotes in strings', () => {
            const content = `
initialize() {
    myVar = 10;
    catn("A string with \\"myVar\\" inside"); // Should not match
    x = myVar; // Should match
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 5); // On "myVar"

            expect(refs.length).toBe(2);
        });
    });

    describe('Comment Filtering', () => {
        it('should not find references in comments', () => {
            const content = `
initialize() {
    myVar = 10;
    // This is myVar in a comment
    /* This is also myVar in a comment */
    x = myVar; // But this myVar should match
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 5); // On "myVar"

            expect(refs.length).toBe(2); // declaration + 1 reference
        });
    });

    describe('Callback Pseudo-parameters', () => {
        it('should find references to callback pseudo-parameters', () => {
            const content = `
1 early() {
    catn(sim.cycle);
    x = sim.getValue("test");
}

10 late() {
    catn(sim.cycle);
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 10); // On "sim"

            expect(refs.length).toBeGreaterThan(1);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty document', () => {
            const doc = createDocument('file:///test.slim', '');
            const refs = findReferences(doc, 0, 0);

            expect(refs).toEqual([]);
        });

        it('should handle position out of bounds', () => {
            const content = `initialize() { }`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 10, 0); // Line out of bounds

            expect(refs).toEqual([]);
        });

        it('should handle single-character identifiers', () => {
            const content = `
initialize() {
    x = 10;
    y = x + 5;
    z = x * 2;
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 5); // On "x"

            expect(refs.length).toBe(3);
        });

        it('should distinguish between similar identifiers', () => {
            const content = `
initialize() {
    x = 10;
    x1 = 20;
    x2 = 30;
    y = x + 1; // Should only match "x", not "x1" or "x2"
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 5); // On "x"

            expect(refs.length).toBe(2); // Only "x", not "x1" or "x2"
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle nested scopes', () => {
            const content = `
function (integer)outer(integer x) {
    function (integer)inner(integer x) {
        return x * 2; // This x is the inner parameter
    }
    return inner(x); // This x is the outer parameter
}
`;
            const doc = createDocument('file:///test.slim', content);
            
            // Find references to outer's x
            const outerRefs = findReferences(doc, 1, 33);
            expect(outerRefs.length).toBeGreaterThanOrEqual(2);

            // Find references to inner's x
            const innerRefs = findReferences(doc, 2, 37);
            expect(innerRefs.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle multiple definition types', () => {
            const content = `
initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
    defineConstant("m1", 42); // Different m1 (constant)
}

1 early() {
    mut = sim.mutationsOfType(m1); // Which m1?
    catn(m1); // And which one here?
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 26); // On mutation type "m1"

            // Should find all references (implementation may vary based on scoping rules)
            expect(refs.length).toBeGreaterThan(0);
        });

        it('should handle method chaining', () => {
            const content = `
1 early() {
    ind = p1.sampleIndividuals(1);
    genome = ind.genomes[0];
    genome.addNewDrawnMutation(m1, 5000);
}
`;
            const doc = createDocument('file:///test.slim', content);
            const refs = findReferences(doc, 2, 5); // On "ind"

            expect(refs.length).toBe(2); // definition + 1 use
        });
    });
});


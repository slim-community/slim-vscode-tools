import { describe, it, expect } from 'vitest';
import { formatSLiMCode } from '../../src/providers/formatting';
import { FormattingOptions } from '../../src/config/types';

describe('Formatting Provider', () => {
    const defaultOptions: FormattingOptions = {
        tabSize: 4,
        insertSpaces: true,
    };

    const tabOptions: FormattingOptions = {
        tabSize: 4,
        insertSpaces: false,
    };

    describe('formatSLiMCode - Basic Indentation', () => {
        it('should indent nested braces correctly', () => {
            const input = `initialize() {
defineConstant("K", 500);
}`;
            const expected = `initialize() {
    defineConstant("K", 500);
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle multiple levels of nesting', () => {
            const input = `initialize() {
if (T) {
catn("nested");
}
}`;
            const expected = `initialize() {
    if (T) {
        catn("nested");
    }
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should dedent closing braces correctly', () => {
            const input = `initialize() {
defineConstant("K", 500);
defineConstant("N", 100);
}`;
            const expected = `initialize() {
    defineConstant("K", 500);
    defineConstant("N", 100);
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle single-line blocks', () => {
            const input = `initialize() { defineConstant("K", 500); }`;
            const expected = `initialize() { defineConstant("K", 500); }`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });
    });

    describe('formatSLiMCode - Comments', () => {
        it('should preserve comment-only lines with correct indentation', () => {
            const input = `initialize() {
// This is a comment
defineConstant("K", 500);
}`;
            const expected = `initialize() {
    // This is a comment
    defineConstant("K", 500);
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should preserve inline comments', () => {
            const input = `initialize() {
defineConstant("K", 500); // Population size
}`;
            const expected = `initialize() {
    defineConstant("K", 500); // Population size
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle multiple inline comments', () => {
            const input = `initialize() {
defineConstant("K", 500); // K value
defineConstant("N", 100); // N value
}`;
            const expected = `initialize() {
    defineConstant("K", 500); // K value
    defineConstant("N", 100); // N value
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should not be confused by comment-like strings', () => {
            const input = `initialize() {
defineConstant("url", "http://example.com");
}`;
            const expected = `initialize() {
    defineConstant("url", "http://example.com");
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });
    });

    describe('formatSLiMCode - SLiM Callbacks', () => {
        it('should format initialize callback', () => {
            const input = `initialize() {
initializeMutationRate(1e-7);
initializeMutationType("m1", 0.5, "f", 0.0);
initializeGenomicElementType("g1", m1, 1.0);
initializeGenomicElement(g1, 0, 99999);
initializeRecombinationRate(1e-8);
}`;
            const expected = `initialize() {
    initializeMutationRate(1e-7);
    initializeMutationType("m1", 0.5, "f", 0.0);
    initializeGenomicElementType("g1", m1, 1.0);
    initializeGenomicElement(g1, 0, 99999);
    initializeRecombinationRate(1e-8);
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should format early event callback', () => {
            const input = `1 early() {
sim.addSubpop("p1", 500);
}`;
            const expected = `1 early() {
    sim.addSubpop("p1", 500);
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should format late event callback', () => {
            const input = `1000 late() {
catn(sim.countOfMutationsOfType(m1));
}`;
            const expected = `1000 late() {
    catn(sim.countOfMutationsOfType(m1));
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should format fitness callback', () => {
            const input = `fitness(m1) {
return 1.0 + mut.selectionCoeff;
}`;
            const expected = `fitness(m1) {
    return 1.0 + mut.selectionCoeff;
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });
    });

    describe('formatSLiMCode - Control Flow', () => {
        it('should format if statements', () => {
            const input = `1 early() {
if (sim.generation == 100) {
catn("Generation 100");
}
}`;
            const expected = `1 early() {
    if (sim.generation == 100) {
        catn("Generation 100");
    }
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should format if-else statements', () => {
            const input = `1 early() {
if (sim.generation == 100) {
catn("Generation 100");
} else {
catn("Other generation");
}
}`;
            const expected = `1 early() {
    if (sim.generation == 100) {
        catn("Generation 100");
    } else {
        catn("Other generation");
    }
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should format for loops', () => {
            const input = `1 early() {
for (i in 1:10) {
catn(i);
}
}`;
            const expected = `1 early() {
    for (i in 1:10) {
        catn(i);
    }
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should format while loops', () => {
            const input = `1 early() {
x = 0;
while (x < 10) {
x = x + 1;
}
}`;
            const expected = `1 early() {
    x = 0;
    while (x < 10) {
        x = x + 1;
    }
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });
    });

    describe('formatSLiMCode - Functions', () => {
        it('should format function definitions', () => {
            const input = `function (void)myFunction(void) {
catn("Hello");
}`;
            const expected = `function (void)myFunction(void) {
    catn("Hello");
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should format functions with parameters', () => {
            const input = `function (integer)add(integer a, integer b) {
return a + b;
}`;
            const expected = `function (integer)add(integer a, integer b) {
    return a + b;
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should format nested function calls', () => {
            const input = `initialize() {
result = max(sapply(1:10, "applyValue^2;"));
}`;
            const expected = `initialize() {
    result = max(sapply(1:10, "applyValue^2;"));
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });
    });

    describe('formatSLiMCode - Empty Lines', () => {
        it('should preserve empty lines', () => {
            const input = `initialize() {
defineConstant("K", 500);

defineConstant("N", 100);
}`;
            const expected = `initialize() {
    defineConstant("K", 500);

    defineConstant("N", 100);
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle multiple consecutive empty lines', () => {
            const input = `initialize() {
defineConstant("K", 500);


defineConstant("N", 100);
}`;
            // Multiple blank lines are preserved up to 2 consecutive
            const expected = `initialize() {
    defineConstant("K", 500);


    defineConstant("N", 100);
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should collapse excessive blank lines', () => {
            const input = `initialize() {
defineConstant("K", 500);




defineConstant("N", 100);
}`;
            // More than 2 consecutive blank lines are collapsed to 2
            const expected = `initialize() {
    defineConstant("K", 500);


    defineConstant("N", 100);
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });
    });

    describe('formatSLiMCode - Tab Options', () => {
        it('should use tabs when insertSpaces is false', () => {
            const input = `initialize() {
defineConstant("K", 500);
}`;
            const expected = `initialize() {\n\tdefineConstant("K", 500);\n}`;
            expect(formatSLiMCode(input, tabOptions)).toBe(expected);
        });

        it('should use custom tab size', () => {
            const customOptions: FormattingOptions = {
                tabSize: 2,
                insertSpaces: true,
            };
            const input = `initialize() {
defineConstant("K", 500);
}`;
            const expected = `initialize() {
  defineConstant("K", 500);
}`;
            expect(formatSLiMCode(input, customOptions)).toBe(expected);
        });
    });

    describe('formatSLiMCode - Complex Cases', () => {
        it('should handle mixed braces on same line', () => {
            const input = `initialize() { defineConstant("K", 500);
defineConstant("N", 100); }`;
            const expected = `initialize() { defineConstant("K", 500);
    defineConstant("N", 100); }`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should format complete SLiM script', () => {
            const input = `initialize() {
initializeMutationRate(1e-7);
initializeMutationType("m1", 0.5, "f", 0.0);
initializeGenomicElementType("g1", m1, 1.0);
initializeGenomicElement(g1, 0, 99999);
initializeRecombinationRate(1e-8);
}

1 early() {
sim.addSubpop("p1", 500);
}

1000 late() {
catn(sim.countOfMutationsOfType(m1));
}`;
            const expected = `initialize() {
    initializeMutationRate(1e-7);
    initializeMutationType("m1", 0.5, "f", 0.0);
    initializeGenomicElementType("g1", m1, 1.0);
    initializeGenomicElement(g1, 0, 99999);
    initializeRecombinationRate(1e-8);
}

1 early() {
    sim.addSubpop("p1", 500);
}

1000 late() {
    catn(sim.countOfMutationsOfType(m1));
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle strings with braces', () => {
            const input = `initialize() {
catn("This string has { and }");
}`;
            const expected = `initialize() {
    catn("This string has { and }");
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle escaped quotes in strings', () => {
            const input = `initialize() {
catn("This is a \\"quoted\\" string");
}`;
            const expected = `initialize() {
    catn("This is a \\"quoted\\" string");
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle deeply nested structures', () => {
            const input = `initialize() {
if (T) {
for (i in 1:10) {
if (i > 5) {
catn(i);
}
}
}
}`;
            const expected = `initialize() {
    if (T) {
        for (i in 1:10) {
            if (i > 5) {
                catn(i);
            }
        }
    }
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });
    });

    describe('formatSLiMCode - Whitespace Normalization', () => {
        it('should collapse multiple spaces between tokens', () => {
            const input = `initialize() {
x  =   1   +      5;
}`;
            const expected = `initialize() {
    x = 1 + 5;
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should preserve spaces in strings', () => {
            const input = `initialize() {
catn("This   has    many    spaces");
}`;
            const expected = `initialize() {
    catn("This   has    many    spaces");
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should normalize spaces in complex expressions', () => {
            const input = `initialize() {
result    =    max(  sapply(  1:10  ,   "applyValue^2;"  )  );
}`;
            const expected = `initialize() {
    result = max( sapply( 1:10 , "applyValue^2;" ) );
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });
    });

    describe('formatSLiMCode - Edge Cases', () => {
        it('should handle empty file', () => {
            const input = '';
            const expected = '';
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle file with only whitespace', () => {
            const input = '   \n  \n   ';
            // Whitespace-only lines are collapsed to maximum 2 consecutive blank lines
            const expected = '\n';
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle file with only comments', () => {
            const input = `// Comment 1
// Comment 2
// Comment 3`;
            const expected = `// Comment 1
// Comment 2
// Comment 3`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should handle mismatched braces gracefully', () => {
            const input = `initialize() {
defineConstant("K", 500);`;
            const expected = `initialize() {
    defineConstant("K", 500);`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });

        it('should not be confused by braces in comments', () => {
            const input = `initialize() {
// This comment has { braces }
defineConstant("K", 500);
}`;
            const expected = `initialize() {
    // This comment has { braces }
    defineConstant("K", 500);
}`;
            expect(formatSLiMCode(input, defaultOptions)).toBe(expected);
        });
    });
});


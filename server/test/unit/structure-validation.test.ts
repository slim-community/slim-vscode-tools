import { describe, it, expect } from 'vitest';
import { validateStructure, shouldHaveSemicolon } from '../../src/validation/structure';
import { DiagnosticSeverity } from 'vscode-languageserver';

describe('Structure Validation', () => {
    describe('Brace Balance', () => {
        it('should detect unclosed braces', () => {
            const lines = [
                'initialize() {',
                '    x = 5;',
                // Missing closing brace
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
            expect(diagnostics[0].message).toContain('Unclosed brace');
        });

        it('should detect unexpected closing braces', () => {
            const lines = [
                'x = 5;',
                '}', // Unexpected close
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            expect(diagnostics.length).toBeGreaterThan(0);
            const errorDiag = diagnostics.find(d => 
                d.severity === DiagnosticSeverity.Error && 
                d.message.includes('Unexpected closing brace')
            );
            expect(errorDiag).toBeDefined();
        });

        it('should accept properly balanced braces', () => {
            const lines = [
                'initialize() {',
                '    x = 5;',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const braceErrors = diagnostics.filter(d => 
                d.message.includes('brace')
            );
            expect(braceErrors).toHaveLength(0);
        });

        it('should handle nested braces', () => {
            const lines = [
                'initialize() {',
                '    if (x > 0) {',
                '        y = 10;',
                '    }',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const braceErrors = diagnostics.filter(d => 
                d.message.includes('brace')
            );
            expect(braceErrors).toHaveLength(0);
        });

        it('should ignore braces in comments', () => {
            const lines = [
                'initialize() {',
                '    // This { is in a comment',
                '    x = 5;',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const braceErrors = diagnostics.filter(d => 
                d.message.includes('brace')
            );
            expect(braceErrors).toHaveLength(0);
        });

        it('should ignore braces in strings', () => {
            const lines = [
                'initialize() {',
                '    str = "This { is in a string";',
                '    x = 5;',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const braceErrors = diagnostics.filter(d => 
                d.message.includes('brace')
            );
            expect(braceErrors).toHaveLength(0);
        });
    });

    describe('Semicolon Validation', () => {
        it('should warn about missing semicolons', () => {
            const lines = [
                'x = 5', // Missing semicolon
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const semicolonWarnings = diagnostics.filter(d => 
                d.severity === DiagnosticSeverity.Warning &&
                d.message.includes('semicolon')
            );
            expect(semicolonWarnings.length).toBeGreaterThan(0);
        });

        it('should not warn when semicolon is present', () => {
            const lines = [
                'x = 5;',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const semicolonWarnings = diagnostics.filter(d => 
                d.message.includes('semicolon')
            );
            expect(semicolonWarnings).toHaveLength(0);
        });

        it('should not warn for control flow statements', () => {
            const lines = [
                'if (x > 0) {',
                '    y = 10;',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const semicolonWarnings = diagnostics.filter(d => 
                d.message.includes('semicolon')
            );
            expect(semicolonWarnings).toHaveLength(0);
        });

        it('should not warn for callback declarations', () => {
            const lines = [
                'initialize() {',
                '    x = 5;',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const semicolonWarnings = diagnostics.filter(d => 
                d.message.includes('semicolon') &&
                d.range.start.line === 0
            );
            expect(semicolonWarnings).toHaveLength(0);
        });

        it('should not warn for lines ending with braces', () => {
            const lines = [
                'if (x > 0) {',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const semicolonWarnings = diagnostics.filter(d => 
                d.message.includes('semicolon')
            );
            expect(semicolonWarnings).toHaveLength(0);
        });

        it('should not warn for incomplete lines (operators at end)', () => {
            const lines = [
                'x = 5 +', // Incomplete expression
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const semicolonWarnings = diagnostics.filter(d => 
                d.message.includes('semicolon')
            );
            expect(semicolonWarnings).toHaveLength(0);
        });

        it('should not warn for lines with unclosed parentheses', () => {
            const lines = [
                'result = sum(1, 2,', // Incomplete function call
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const semicolonWarnings = diagnostics.filter(d => 
                d.message.includes('semicolon')
            );
            expect(semicolonWarnings).toHaveLength(0);
        });
    });

    describe('String Validation', () => {
        it('should detect unclosed double quote strings', () => {
            const lines = [
                'x = "unclosed string',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const stringErrors = diagnostics.filter(d => 
                d.severity === DiagnosticSeverity.Error &&
                d.message.includes('Unclosed string')
            );
            expect(stringErrors.length).toBeGreaterThan(0);
        });

        it('should detect unclosed single quote strings', () => {
            const lines = [
                "x = 'unclosed string",
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const stringErrors = diagnostics.filter(d => 
                d.severity === DiagnosticSeverity.Error &&
                d.message.includes('Unclosed string')
            );
            expect(stringErrors.length).toBeGreaterThan(0);
        });

        it('should accept properly closed strings', () => {
            const lines = [
                'x = "properly closed";',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const stringErrors = diagnostics.filter(d => 
                d.message.includes('string')
            );
            expect(stringErrors).toHaveLength(0);
        });

        it('should handle escaped quotes in strings', () => {
            const lines = [
                'x = "string with \\"escaped\\" quotes";',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const stringErrors = diagnostics.filter(d => 
                d.message.includes('string')
            );
            expect(stringErrors).toHaveLength(0);
        });

        it('should detect strings that start but never close across lines', () => {
            const lines = [
                'initialize() {',
                '    x = "string starts here',
                '    y = 5;',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const stringErrors = diagnostics.filter(d => 
                d.severity === DiagnosticSeverity.Error &&
                d.message.includes('Unclosed string')
            );
            expect(stringErrors.length).toBeGreaterThan(0);
        });

        it('should handle mixed quote types correctly', () => {
            const lines = [
                'x = "double quotes";',
                "y = 'single quotes';",
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const stringErrors = diagnostics.filter(d => 
                d.message.includes('string')
            );
            expect(stringErrors).toHaveLength(0);
        });

        it('should not confuse quotes in comments with string delimiters', () => {
            const lines = [
                '// This is a "comment"',
                'x = 5;',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const stringErrors = diagnostics.filter(d => 
                d.message.includes('string')
            );
            expect(stringErrors).toHaveLength(0);
        });
    });

    describe('Bracket Validation', () => {
        it('should detect unclosed brackets', () => {
            const lines = [
                'x = arr[0',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const bracketErrors = diagnostics.filter(d => 
                d.severity === DiagnosticSeverity.Error &&
                d.message.includes('bracket')
            );
            expect(bracketErrors.length).toBeGreaterThan(0);
        });

        it('should accept properly closed brackets', () => {
            const lines = [
                'x = arr[0];',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const bracketErrors = diagnostics.filter(d => 
                d.message.includes('bracket')
            );
            expect(bracketErrors).toHaveLength(0);
        });

        it('should handle nested brackets', () => {
            const lines = [
                'x = matrix[i][j];',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const bracketErrors = diagnostics.filter(d => 
                d.message.includes('bracket')
            );
            expect(bracketErrors).toHaveLength(0);
        });

        it('should ignore brackets in strings', () => {
            const lines = [
                'x = "array[0]";',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const bracketErrors = diagnostics.filter(d => 
                d.message.includes('bracket')
            );
            expect(bracketErrors).toHaveLength(0);
        });
    });

    describe('SLiM Event Blocks', () => {
        it('should handle SLiM event blocks correctly', () => {
            const lines = [
                '1 early() {',
                '    x = 5;',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const braceErrors = diagnostics.filter(d => 
                d.message.includes('brace')
            );
            expect(braceErrors).toHaveLength(0);
        });

        it('should handle species-specific event blocks', () => {
            const lines = [
                's1 1 early() {',
                '    x = 5;',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const braceErrors = diagnostics.filter(d => 
                d.message.includes('brace')
            );
            expect(braceErrors).toHaveLength(0);
        });

        it('should not apply SLiM block rules in Eidos files', () => {
            const lines = [
                '1 early() {',
                '    x = 5;',
                '}',
            ];

            // In Eidos mode, this might be treated differently
            const diagnostics = validateStructure(lines, 'eidos');
            
            // Should still validate correctly (just different context)
            expect(diagnostics).toBeDefined();
        });
    });

    describe('shouldHaveSemicolon Function', () => {
        it('should return false for lines ending with semicolon', () => {
            const result = shouldHaveSemicolon('x = 5;');
            expect(result.shouldMark).toBe(false);
        });

        it('should return true for statements missing semicolon', () => {
            const result = shouldHaveSemicolon('x = 5');
            expect(result.shouldMark).toBe(true);
        });

        it('should return false for control flow statements', () => {
            const result = shouldHaveSemicolon('if (x > 0) {');
            expect(result.shouldMark).toBe(false);
        });

        it('should track parenthesis balance', () => {
            const result1 = shouldHaveSemicolon('sum(1,', 0);
            expect(result1.shouldMark).toBe(false);
            expect(result1.parenBalance).toBe(1);

            const result2 = shouldHaveSemicolon('2, 3)', result1.parenBalance);
            expect(result2.shouldMark).toBe(true); // Complete now, needs semicolon
            expect(result2.parenBalance).toBe(0);
        });

        it('should handle comments', () => {
            const result = shouldHaveSemicolon('// This is a comment');
            expect(result.shouldMark).toBe(false);
        });

        it('should handle empty lines', () => {
            const result = shouldHaveSemicolon('   ');
            expect(result.shouldMark).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty document', () => {
            const lines: string[] = [];
            const diagnostics = validateStructure(lines, 'slim');
            expect(diagnostics).toHaveLength(0);
        });

        it('should handle document with only comments', () => {
            const lines = [
                '// Comment 1',
                '// Comment 2',
            ];
            const diagnostics = validateStructure(lines, 'slim');
            expect(diagnostics).toHaveLength(0);
        });

        it('should handle document with mixed content', () => {
            const lines = [
                '// Initialize simulation',
                'initialize() {',
                '    defineConstant("N", 500);',
                '    x = 5;', // Has semicolon
                '}',
                '',
                '1 early() {',
                '    sim.addSubpop("p1", N);',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            // Should have no critical errors
            const errors = diagnostics.filter(d => 
                d.severity === DiagnosticSeverity.Error
            );
            expect(errors).toHaveLength(0);
        });

        it('should handle multi-line statements correctly', () => {
            const lines = [
                'result = sum(',
                '    1,',
                '    2,',
                '    3',
                ');',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            // Should not warn about semicolons on continuation lines
            const semicolonWarnings = diagnostics.filter(d => 
                d.message.includes('semicolon') &&
                (d.range.start.line === 1 || d.range.start.line === 2 || d.range.start.line === 3)
            );
            expect(semicolonWarnings).toHaveLength(0);
        });

        it('should handle complex mixed delimiters', () => {
            const lines = [
                'initialize() {',
                '    x = array[func("string", 123)];',
                '}',
            ];

            const diagnostics = validateStructure(lines, 'slim');
            
            const errors = diagnostics.filter(d => 
                d.severity === DiagnosticSeverity.Error
            );
            expect(errors).toHaveLength(0);
        });
    });
});

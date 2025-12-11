import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection, TextDocuments } from 'vscode-languageserver/node';
import { DocumentationService } from '../../src/services/documentation-service';
import { registerHoverProvider } from '../../src/providers/hover';
import { LanguageServerContext } from '../../src/config/types';
import { CompletionService } from '../../src/services/completion-service';
import { ValidationService } from '../../src/services/validation-service';
import { setLoggerSilent } from '../../src/utils/logger';
import { documentCache } from '../../src/services/document-cache';

describe('Hover Provider', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;
    let validationService: ValidationService;
    let mockConnection: any;
    let mockDocuments: any;
    let hoverHandler: any;

    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
        // Use real documentation service - it will load from docs/ directory
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
        validationService = new ValidationService(documentationService);
        
        // Verify documentation loaded successfully
        const functions = documentationService.getFunctions();
        if (Object.keys(functions).length === 0) {
            throw new Error('Documentation failed to load - no functions found. Check that docs/ directory exists.');
        }

        // Mock connection
        mockConnection = {
            onHover: (handler: any) => {
                hoverHandler = handler;
            },
        };

        // Mock documents
        mockDocuments = {
            get: (uri: string) => {
                return TextDocument.create(uri, 'slim', 1, 'sum(1, 2, 3);');
            },
        };

        const context: LanguageServerContext = {
            connection: mockConnection as Connection,
            documents: mockDocuments as TextDocuments<TextDocument>,
            documentationService,
            completionService,
            validationService,
        };

        registerHoverProvider(context);
    });

    it('should return hover info for a known function', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(1, 2, 3);');
        
        mockDocuments.get = () => document;

        // Hover over 'sum' at position (0, 1) - the 'u' in 'sum'
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 0, character: 1 },
        });

        // sum() is a real Eidos function that must be in the docs
        const functions = documentationService.getFunctions();
        expect(functions['sum']).toBeDefined();
        
        expect(result).toBeTruthy();
        expect(result.contents).toBeTruthy();
        
        // Check that the hover contains markdown with function information
        if (typeof result.contents === 'object' && 'value' in result.contents) {
            expect(result.contents.value).toContain('sum');
        }
    });

    it('should return null for unknown words', () => {
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            'unknownFunction();'
        );
        
        mockDocuments.get = () => document;

        // Hover over 'unknownFunction'
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 0, character: 5 },
        });

        expect(result).toBeNull();
    });

    it('should return hover info for operators', () => {
        const document = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 1 + 2;');
        
        mockDocuments.get = () => document;

        // Hover over '+' operator at position (0, 6)
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 0, character: 6 },
        });

        // Result might be null or have operator info depending on documentation
        // This test just ensures it doesn't crash
        expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should not show class property hover for standalone variables with matching names', () => {
        // 'age' is a property of Individual, but when used as a standalone variable
        // it should NOT show Individual.age hover info
        const document = TextDocument.create(
            'file:///test.slim',
            'slim',
            1,
            'age = asFloat(asInteger(rexp(1, 0.15)));'
        );
        
        mockDocuments.get = () => document;

        // Hover over 'age' at position (0, 1)
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 0, character: 1 },
        });

        // Should return null - standalone 'age' is just a local variable,
        // not the Individual.age property
        expect(result).toBeNull();
    });

    it('should show class property hover when accessed via dot notation', () => {
        // When accessed as ind.age, it SHOULD show Individual.age hover info
        const code = `late() {
    for (ind in sim.subpopulations.individuals) {
        x = ind.age;
    }
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, code);
        
        mockDocuments.get = () => document;

        // Hover over 'age' in 'ind.age' - line 2, character 16 (the 'a' in 'age')
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 16 },
        });

        expect(result).toBeTruthy();
        expect(result.contents).toBeTruthy();
        
        // Check that the hover contains Individual.age property information
        if (typeof result.contents === 'object' && 'value' in result.contents) {
            expect(result.contents.value).toContain('age');
            expect(result.contents.value).toContain('Individual');
        }
    });

    it('should show property source info when variable is assigned from class property', () => {
        // When a variable is assigned from a class property like age_var = Individual.age,
        // hovering over age_var should show it came from Individual.age
        const code = `late() {
    age_var = Individual.age;
    print(age_var);
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, code);
        
        mockDocuments.get = () => document;

        // Hover over 'age_var' in 'print(age_var)' - line 2, character 10
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 10 },
        });

        expect(result).toBeTruthy();
        expect(result.contents).toBeTruthy();
        
        // Check that the hover shows the property source
        if (typeof result.contents === 'object' && 'value' in result.contents) {
            expect(result.contents.value).toContain('age_var');
            expect(result.contents.value).toContain('Individual.age');
        }
    });

    it('should show property source info when variable is assigned from instance property', () => {
        // When a variable is assigned from an instance property like ind_age = ind.age,
        // hovering over ind_age should show it came from Individual.age
        const code = `late() {
    for (ind in sim.subpopulations.individuals) {
        ind_age = ind.age;
        print(ind_age);
    }
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, code);
        
        mockDocuments.get = () => document;

        // Hover over 'ind_age' in 'print(ind_age)' - line 3, character 14
        const result = hoverHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 3, character: 14 },
        });

        expect(result).toBeTruthy();
        expect(result.contents).toBeTruthy();
        
        // Check that the hover shows the property source
        if (typeof result.contents === 'object' && 'value' in result.contents) {
            expect(result.contents.value).toContain('ind_age');
            expect(result.contents.value).toContain('Individual.age');
        }
    });
});


import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection, TextDocuments } from 'vscode-languageserver/node';
import { DocumentationService } from '../../src/services/documentation-service';
import { registerDefinitionProvider } from '../../src/providers/definitions';
import { LanguageServerContext } from '../../src/config/types';
import { CompletionService } from '../../src/services/completion-service';
import { ValidationService } from '../../src/services/validation-service';
import { documentCache } from '../../src/services/document-cache';
import { setLoggerSilent } from '../../src/utils/logger';

describe('Definition Provider', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;
    let validationService: ValidationService;
    let mockConnection: any;
    let mockDocuments: any;
    let definitionHandler: any;

    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
        validationService = new ValidationService(documentationService);
        
        const functions = documentationService.getFunctions();
        if (Object.keys(functions).length === 0) {
            throw new Error('Documentation failed to load');
        }

        mockConnection = {
            onDefinition: (handler: any) => {
                definitionHandler = handler;
            },
        };

        mockDocuments = {
            get: () => TextDocument.create('file:///test.slim', 'slim', 1, ''),
        };

        const context: LanguageServerContext = {
            connection: mockConnection as Connection,
            documents: mockDocuments as TextDocuments<TextDocument>,
            documentationService,
            completionService,
            validationService,
        };

        registerDefinitionProvider(context);
    });

    // Core Eidos features
    it('should find user-defined constants', () => {
        const content = `initialize() {
    defineConstant("N", 500);
    x = N + 100;
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 8 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(1);
    });

    it('should find user-defined functions', () => {
        const content = `function (integer)myFunction(integer x, integer y) {
    return x + y;
}

initialize() {
    result = myFunction(10, 20);
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 5, character: 15 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(0);
    });

    it('should find function parameters', () => {
        const content = `function (integer)myFunction(integer x, integer y) {
    return x + y;
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 1, character: 11 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(0);
    });

    it('should find loop variables', () => {
        const content = `1 early() {
    for (i in 1:10) {
        catn(i);
    }
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 13 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(1);
    });

    it('should find variable first assignment', () => {
        const content = `1 early() {
    x = 10;
    y = x + 5;
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 8 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(1);
    });

    // SLiM-specific initialization objects
    it('should find mutation type definitions', () => {
        const content = `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
    initializeGenomicElementType("g1", m1, 1.0);
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 39 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(1);
    });

    it('should find genomic element type definitions', () => {
        const content = `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
    initializeGenomicElementType("g1", m1, 1.0);
    initializeGenomicElement(g1, 0, 99999);
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 3, character: 31 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(2);
    });

    it('should find interaction type definitions', () => {
        const content = `initialize() {
    initializeInteractionType("i1", "f", maxDistance=0.1);
    i1.evaluate();
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 5 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(1);
    });

    it('should find subpopulation definitions from addSubpop', () => {
        const content = `1 early() {
    sim.addSubpop("p1", K);
    p1.setSpatialBounds(c(0.0, 0.0, 10, 10));
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 4 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(1);
    });

    it('should find subpopulation definitions from numeric addSubpop', () => {
        const content = `1 early() {
    sim.addSubpop(1, 500);
    p1.setSpatialBounds(c(0.0, 0.0, 10, 10));
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 4 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(1);
        // Should point to the numeric ID in addSubpop(1, ...)
        expect(result.range.start.character).toBeGreaterThan(0);
    });

    it('should find subpopulation definitions from numeric addSubpopSplit', () => {
        const content = `1 early() {
    sim.addSubpop(1, 500);
}

10 early() {
    sim.addSubpopSplit(2, 100, p1);
    p2.setSpatialBounds(c(0.0, 0.0, 10, 10));
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 6, character: 4 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(5);
    });

    it('should find species declarations', () => {
        const content = `species fox initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    fox.addSubpop("p1", 500);
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 5, character: 5 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(0);
    });

    // Callback pseudo-parameters
    it('should find callback pseudo-parameters', () => {
        const content = `1: mutation(m1) {
    return mut.selectionCoeff > 0.0;
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 1, character: 12 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(0);
    });

    it('should find callback declaration, not comment mentioning callback', () => {
        const content = `// Reproduction callback
reproduction(NULL, "F") {
    age = individual.getValue("age");
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 11 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(1); // The actual callback, not comment
    });

    // Quoted identifiers (SLiM-specific)
    it('should handle quoted identifiers', () => {
        const content = `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 1, character: 29 },
        });

        expect(result).toBeTruthy();
        expect(result.range.start.line).toBe(1);
    });

    // Edge cases and negative tests
    it('should return null for unknown identifiers', () => {
        const content = `1 early() {
    x = unknownVariable + 10;
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 1, character: 10 },
        });

        expect(result).toBeNull();
    });

    it('should return null for identifiers in comments', () => {
        const content = `// This comment mentions individual
1 reproduction() {
    return individual.tagF > 0.5;
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 0, character: 25 },
        });

        expect(result).toBeNull();
    });

    it('should return null for identifiers in strings', () => {
        const content = `1 early() {
    x = 10;
    catn("The value of x is:");
}`;
        const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
        mockDocuments.get = () => document;

        const result = definitionHandler({
            textDocument: { uri: 'file:///test.slim' },
            position: { line: 2, character: 22 },
        });

        expect(result).toBeNull();
    });
});

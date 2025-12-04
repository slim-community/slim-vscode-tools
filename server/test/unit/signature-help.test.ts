import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentationService } from '../../src/services/documentation-service';
import { registerSignatureHelpProvider } from '../../src/providers/signature-help';
import { CompletionService } from '../../src/services/completion-service';
import { ValidationService } from '../../src/services/validation-service';
import { setLoggerSilent } from '../../src/utils/logger';
import { documentCache } from '../../src/services/document-cache';
import { createTestContext } from '../helpers/test-context';

describe('Signature Help Provider', () => {
    let documentationService: DocumentationService;
    let mockDocuments: any;
    let signatureHelpHandler: any;

    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
        
        documentationService = new DocumentationService();
        const completionService = new CompletionService(documentationService);
        const validationService = new ValidationService(documentationService);
        
        const functions = documentationService.getFunctions();
        if (Object.keys(functions).length === 0) {
            throw new Error('Documentation failed to load - no functions found. Check that docs/ directory exists.');
        }

        const mockConnection = {
            onSignatureHelp: (handler: any) => {
                signatureHelpHandler = handler;
                return { dispose: () => {} };
            },
        };

        const result = createTestContext(mockConnection, {
            documentationService,
            completionService,
            validationService,
        });
        mockDocuments = result.mockDocuments;

        registerSignatureHelpProvider(result.context);
    });

    describe('Function Signature Help', () => {
        it('should return signature help for a known function', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 4 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            const functions = documentationService.getFunctions();
            expect(functions['sum']).toBeDefined();
            
            expect(result).toBeTruthy();
            expect(result?.signatures).toBeTruthy();
            expect(result?.signatures.length).toBeGreaterThan(0);
            
            if (result?.signatures[0]) {
                expect(result.signatures[0].label).toContain('sum');
            }
        });

        it('should return null for unknown functions', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'unknownFunc(');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 12 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeNull();
        });

        it('should calculate active parameter based on comma count', () => {
            // Test parameter 0 (no commas)
            const doc1 = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(1');
            mockDocuments.get = () => doc1;
            const result1 = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 5 },
                context: { triggerKind: 1, isRetrigger: false },
            });
            expect(result1?.activeParameter).toBe(0);

            // Test parameter 1 (one comma) - use version 2 to invalidate cache
            const doc2 = TextDocument.create('file:///test.slim', 'slim', 2, 'sum(1, ');
            mockDocuments.get = () => doc2;
            const result2 = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 7 },
                context: { triggerKind: 1, isRetrigger: false },
            });
            expect(result2?.activeParameter).toBe(1);

            // Test parameter 2 (two commas) - use version 3 to invalidate cache
            const doc3 = TextDocument.create('file:///test.slim', 'slim', 3, 'sum(1, 2, ');
            mockDocuments.get = () => doc3;
            const result3 = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 10 },
                context: { triggerKind: 1, isRetrigger: false },
            });
            expect(result3?.activeParameter).toBe(2);
        });

        it('should ignore commas inside nested function calls', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(c(1, 2), ');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 13 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result?.activeParameter).toBe(1);
        });
    });

    describe('Method Signature Help', () => {
        it('should return signature help for class methods', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'p1.sampleIndividuals(');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 21 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.signatures).toBeTruthy();
            expect(result?.signatures.length).toBeGreaterThan(0);
            expect(result?.signatures[0].label).toContain('sampleIndividuals');
        });

        it('should return signature help for sim methods', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sim.addSubpop(');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 14 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.signatures).toBeTruthy();
            expect(result?.signatures.length).toBeGreaterThan(0);
            expect(result?.signatures[0].label).toContain('addSubpop');
        });

        it('should return signature help for chained method calls', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'p1.individuals[0].relatedness(');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 30 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.signatures).toBeTruthy();
            expect(result?.signatures.length).toBeGreaterThan(0);
            expect(result?.signatures[0].label).toContain('relatedness');
        });

        it('should track parameter position in method calls', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'p1.sampleIndividuals(10, ');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 25 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.activeParameter).toBe(1);
        });

        it('should handle user-defined variable types', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `myPop = sim.addSubpop("p1", 100);
myPop.sampleIndividuals(`
            );
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 1, character: 24 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.signatures).toBeTruthy();
            expect(result?.signatures.length).toBeGreaterThan(0);
            expect(result?.signatures[0].label).toContain('sampleIndividuals');
        });
    });

    describe('Constructor Signature Help', () => {
        it('should return signature help for Dictionary constructor', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'Dictionary(');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 11 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            const constructors = documentationService.getClassConstructors();
            if (constructors['Dictionary']) {
                expect(result).toBeTruthy();
                expect(result?.signatures).toBeTruthy();
                expect(result?.signatures.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Edge Cases', () => {
        it('should return null when cursor is not inside parentheses', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sum');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 3 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeNull();
        });

        it('should handle deeply nested parentheses', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sum(c(1, 2), mean(c(3, 4)), ');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 28 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.signatures[0].label).toContain('sum');
            expect(result?.activeParameter).toBe(2);
        });

        it('should handle method call after array indexing', () => {
            const document = TextDocument.create('file:///test.slim', 'slim', 1, 'sim.subpopulations[0].sampleIndividuals(');
            mockDocuments.get = () => document;
            
            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 0, character: 41 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.signatures[0].label).toContain('sampleIndividuals');
        });
    });
});

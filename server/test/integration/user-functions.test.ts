import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItemKind, Connection, TextDocuments } from 'vscode-languageserver/node';
import { DocumentationService } from '../../src/services/documentation-service';
import { CompletionService } from '../../src/services/completion-service';
import { ValidationService } from '../../src/services/validation-service';
import { registerHoverProvider } from '../../src/providers/hover';
import { registerSignatureHelpProvider } from '../../src/providers/signature-help';
import { LanguageServerContext } from '../../src/config/types';
import { setLoggerSilent } from '../../src/utils/logger';
import { documentCache } from '../../src/services/document-cache';
import { trackInstanceDefinitions } from '../../src/utils/instance';
import { extractDocComment } from '../../src/utils/text-processing';

describe('User-Defined Functions', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;
    let validationService: ValidationService;

    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
        validationService = new ValidationService(documentationService);
    });

    describe('Doc Comment Extraction', () => {
        it('should extract single-line comments above a function', () => {
            const lines = [
                '// This is a helper function',
                '// It does something useful',
                'function (void)myFunc() {',
                '}',
            ];
            
            const docComment = extractDocComment(lines, 2);
            expect(docComment).toBe('This is a helper function\nIt does something useful');
        });

        it('should extract multi-line comment above a function', () => {
            const lines = [
                '/* This is a multi-line',
                ' * comment describing',
                ' * the function */',
                'function (float)calculate(float x) {',
                '}',
            ];
            
            const docComment = extractDocComment(lines, 3);
            expect(docComment).toContain('This is a multi-line');
            expect(docComment).toContain('comment describing');
            expect(docComment).toContain('the function');
        });

        it('should return null when no comment exists above function', () => {
            const lines = [
                '',
                'function (void)noComment() {',
                '}',
            ];
            
            const docComment = extractDocComment(lines, 1);
            expect(docComment).toBeNull();
        });

        it('should skip empty lines between comment and function', () => {
            const lines = [
                '// Comment with blank line below',
                '',
                'function (integer)withBlank() {',
                '}',
            ];
            
            const docComment = extractDocComment(lines, 2);
            expect(docComment).toBe('Comment with blank line below');
        });

        it('should stop at non-comment code above', () => {
            const lines = [
                'x = 5;',
                '// Only this comment should be captured',
                'function (void)partialComment() {',
                '}',
            ];
            
            const docComment = extractDocComment(lines, 2);
            expect(docComment).toBe('Only this comment should be captured');
        });
    });

    describe('User Function Tracking', () => {
        it('should track user-defined functions with their signatures', () => {
            const content = `
// Calculate the sum of two numbers
function (float)add(float a, float b) {
    return a + b;
}

initialize() {
    // setup
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            const trackingState = trackInstanceDefinitions(document);
            
            expect(trackingState.userFunctions.size).toBe(1);
            expect(trackingState.userFunctions.has('add')).toBe(true);
            
            const funcInfo = trackingState.userFunctions.get('add');
            expect(funcInfo).toBeDefined();
            expect(funcInfo?.returnType).toBe('float');
            expect(funcInfo?.parameters).toBe('float a, float b');
            expect(funcInfo?.docComment).toBe('Calculate the sum of two numbers');
        });

        it('should track multiple user-defined functions', () => {
            const content = `
// First function
function (void)func1() {
}

// Second function
function (integer)func2(integer x) {
    return x * 2;
}

/* Third function
 * with multiline comment */
function (string)func3(string s) {
    return s;
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            const trackingState = trackInstanceDefinitions(document);
            
            expect(trackingState.userFunctions.size).toBe(3);
            expect(trackingState.userFunctions.has('func1')).toBe(true);
            expect(trackingState.userFunctions.has('func2')).toBe(true);
            expect(trackingState.userFunctions.has('func3')).toBe(true);
            
            const func1 = trackingState.userFunctions.get('func1');
            expect(func1?.returnType).toBe('void');
            expect(func1?.docComment).toBe('First function');
            
            const func2 = trackingState.userFunctions.get('func2');
            expect(func2?.returnType).toBe('integer');
            expect(func2?.parameters).toBe('integer x');
            
            const func3 = trackingState.userFunctions.get('func3');
            expect(func3?.returnType).toBe('string');
        });

        it('should handle functions without doc comments', () => {
            const content = `
function (void)noDocFunction() {
    // implementation
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            const trackingState = trackInstanceDefinitions(document);
            
            expect(trackingState.userFunctions.has('noDocFunction')).toBe(true);
            const funcInfo = trackingState.userFunctions.get('noDocFunction');
            expect(funcInfo?.docComment).toBeNull();
        });
    });

    describe('User Function Hover', () => {
        let hoverHandler: any;
        let mockDocuments: any;

        beforeEach(() => {
            const mockConnection = {
                onHover: (handler: any) => {
                    hoverHandler = handler;
                },
            };

            mockDocuments = {
                get: () => null,
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

        it('should show hover info for user-defined function', () => {
            const content = `
// Calculate the fitness of an individual
// based on their phenotype value
function (float)calculateFitness(float phenotype) {
    return 1.0 - abs(phenotype - 0.5);
}

1 late() {
    fitness = calculateFitness(0.3);
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            // Hover over 'calculateFitness' at the function call
            const result = hoverHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 8, character: 17 }, // On "calculateFitness"
            });

            expect(result).toBeTruthy();
            expect(result?.contents?.value).toContain('calculateFitness');
            expect(result?.contents?.value).toContain('user-defined function');
            expect(result?.contents?.value).toContain('float');
            expect(result?.contents?.value).toContain('Calculate the fitness');
        });

        it('should show hover info for function without doc comment', () => {
            const content = `
function (void)helperFunc() {
    // implementation
}

1 late() {
    helperFunc();
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const result = hoverHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 6, character: 8 },
            });

            expect(result).toBeTruthy();
            expect(result?.contents?.value).toContain('helperFunc');
            expect(result?.contents?.value).toContain('user-defined function');
        });
    });

    describe('User Function Completions', () => {
        it('should include user-defined functions in completions', () => {
            const content = `
// A custom function
function (float)myCustomFunc(integer x) {
    return x * 2.0;
}

1 late() {
    result = my
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            
            const completions = completionService.getCompletions(document, {
                line: 7,
                character: 14,
            });

            const items = Array.isArray(completions) ? completions : completions?.items || [];
            
            const userFuncCompletion = items.find(item => item.label === 'myCustomFunc');
            expect(userFuncCompletion).toBeDefined();
            expect(userFuncCompletion?.kind).toBe(CompletionItemKind.Function);
            expect(userFuncCompletion?.detail).toContain('float');
        });

        it('should sort user-defined functions before built-in functions', () => {
            const content = `
function (void)userFunc() {
}

1 late() {
    
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            
            const completions = completionService.getCompletions(document, {
                line: 5,
                character: 4,
            });

            const items = Array.isArray(completions) ? completions : completions?.items || [];
            
            const userFuncCompletion = items.find(item => item.label === 'userFunc');
            expect(userFuncCompletion).toBeDefined();
            // User functions should have sortText starting with 0
            expect(userFuncCompletion?.sortText).toMatch(/^0_/);
        });

        it('should resolve user function completion with documentation', () => {
            const content = `
// This is my function description
function (integer)myFunc(string s) {
    return size(s);
}

1 late() {
    x = my
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            
            const completions = completionService.getCompletions(document, {
                line: 7,
                character: 10,
            });

            const items = Array.isArray(completions) ? completions : completions?.items || [];
            const myFuncItem = items.find(item => item.label === 'myFunc');
            
            expect(myFuncItem).toBeDefined();
            
            if (myFuncItem) {
                const resolved = completionService.resolveCompletion(myFuncItem);
                expect(resolved.documentation).toBeDefined();
                
                if (resolved.documentation && typeof resolved.documentation === 'object' && 'value' in resolved.documentation) {
                    expect(resolved.documentation.value).toContain('myFunc');
                    expect(resolved.documentation.value).toContain('my function description');
                }
            }
        });
    });

    describe('User Function Signature Help', () => {
        let signatureHelpHandler: any;
        let mockDocuments: any;

        beforeEach(() => {
            const mockConnection = {
                onSignatureHelp: (handler: any) => {
                    signatureHelpHandler = handler;
                    return { dispose: () => {} };
                },
            };

            mockDocuments = {
                get: () => null,
            };

            const context: LanguageServerContext = {
                connection: mockConnection as Connection,
                documents: mockDocuments as TextDocuments<TextDocument>,
                documentationService,
                completionService,
                validationService,
            };

            registerSignatureHelpProvider(context);
        });

        it('should show signature help for user-defined function', () => {
            const content = `
// Calculate distance between two points
function (float)distance(float x1, float y1, float x2, float y2) {
    return sqrt((x2-x1)^2 + (y2-y1)^2);
}

1 late() {
    d = distance(
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 7, character: 17 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.signatures).toBeTruthy();
            expect(result?.signatures.length).toBeGreaterThan(0);
            expect(result?.signatures[0].label).toContain('distance');
            expect(result?.signatures[0].label).toContain('float x1');
        });

        it('should track active parameter in user function call', () => {
            const content = `
function (float)add(float a, float b) {
    return a + b;
}

1 late() {
    result = add(1.0, 
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 6, character: 22 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.activeParameter).toBe(1); // Second parameter
        });

        it('should show doc comment in signature help', () => {
            const content = `
// Multiply two numbers together
function (float)multiply(float x, float y) {
    return x * y;
}

1 late() {
    result = multiply(
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 7, character: 22 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeTruthy();
            expect(result?.signatures[0].documentation).toBeDefined();
            
            const docValue = typeof result?.signatures[0].documentation === 'object' 
                ? result.signatures[0].documentation.value 
                : result?.signatures[0].documentation;
            
            expect(docValue).toContain('Multiply two numbers');
        });

        it('should return null for unknown function', () => {
            const content = `
1 late() {
    unknownUserFunc(
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            mockDocuments.get = () => document;

            const result = signatureHelpHandler({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 2, character: 20 },
                context: { triggerKind: 1, isRetrigger: false },
            });

            expect(result).toBeNull();
        });
    });

    describe('Edge Cases', () => {
        it('should handle user function with no parameters', () => {
            const content = `
// Get current timestamp
function (integer)getTimestamp() {
    return community.tick;
}

1 late() {
    t = getTimestamp();
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            const trackingState = trackInstanceDefinitions(document);
            
            const funcInfo = trackingState.userFunctions.get('getTimestamp');
            expect(funcInfo).toBeDefined();
            expect(funcInfo?.parameters).toBe('');
            expect(funcInfo?.returnType).toBe('integer');
        });

        it('should handle complex parameter types', () => {
            const content = `
function (void)processInds(object<Individual> inds, integer count) {
    // process individuals
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            const trackingState = trackInstanceDefinitions(document);
            
            const funcInfo = trackingState.userFunctions.get('processInds');
            expect(funcInfo).toBeDefined();
            expect(funcInfo?.parameters).toContain('object<Individual>');
            expect(funcInfo?.parameters).toContain('integer count');
        });

        it('should handle inline comment after function signature', () => {
            const content = `
// Main doc comment
function (void)myFunc() // inline comment
{
    // body
}
`;
            const document = TextDocument.create('file:///test.slim', 'slim', 1, content);
            const trackingState = trackInstanceDefinitions(document);
            
            const funcInfo = trackingState.userFunctions.get('myFunc');
            expect(funcInfo).toBeDefined();
            expect(funcInfo?.docComment).toBe('Main doc comment');
        });
    });
});


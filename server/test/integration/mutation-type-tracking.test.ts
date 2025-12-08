import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { trackInstanceDefinitions } from '../../src/utils/instance';
import { CompletionService } from '../../src/services/completion-service';
import { DocumentationService } from '../../src/services/documentation-service';
import { setLoggerSilent } from '../../src/utils/logger';
import { documentCache } from '../../src/services/document-cache';
import { CLASS_NAMES } from '../../src/config/config';
import { registerHoverProvider } from '../../src/providers/hover';
import { registerInlayHintsProvider } from '../../src/providers/inlay-hints';
import { Connection, TextDocuments } from 'vscode-languageserver/node';
import { LanguageServerContext } from '../../src/config/types';
import { ValidationService } from '../../src/services/validation-service';

describe('Mutation Type Tracking for Mutation Instances', () => {
    let documentationService: DocumentationService;
    let completionService: CompletionService;

    beforeEach(() => {
        setLoggerSilent(true);
        documentCache.clear();
        documentationService = new DocumentationService();
        completionService = new CompletionService(documentationService);
    });

    describe('Instance Tracking', () => {
        it('should track mutation type for mutation instances from mutationsOfType', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    mut = sim.mutationsOfType(m1)[0];
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // Should track mut as Mutation
            expect(trackingState.instanceDefinitions['mut']).toBe(CLASS_NAMES.MUTATION);
            
            // Should track that mut is of type m1
            expect(trackingState.mutationTypeByInstance.get('mut')).toBe('m1');
        });

        it('should track mutation type for mutation vectors', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    muts = sim.mutationsOfType(m1);
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // Should track muts as Mutation[]
            expect(trackingState.instanceDefinitions['muts']).toBe(CLASS_NAMES.MUTATION + '[]');
            
            // Should track that muts contains mutations of type m1
            expect(trackingState.mutationTypeByInstance.get('muts')).toBe('m1');
        });

        it('should track mutation type through variable assignment', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    muts = sim.mutationsOfType(m1);
    mut = muts[0];
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // muts should have mutation type m1
            expect(trackingState.mutationTypeByInstance.get('muts')).toBe('m1');
            
            // mut should also have mutation type m1 (inherited from muts)
            expect(trackingState.mutationTypeByInstance.get('mut')).toBe('m1');
        });

        it('should track mutation type for loop variables', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    for (mut in sim.mutationsOfType(m1)) {
        catn(mut.position);
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // Should track that loop variable mut is of type m1
            expect(trackingState.mutationTypeByInstance.get('mut')).toBe('m1');
        });

        it('should not track mutation type if mutation type is not defined', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `1 early() {
    // m1 is not defined, so we shouldn't track it
    mut = sim.mutationsOfType(m1)[0];
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // Should track mut as Mutation
            expect(trackingState.instanceDefinitions['mut']).toBe(CLASS_NAMES.MUTATION);
            
            // But should NOT track mutation type since m1 is not defined
            expect(trackingState.mutationTypeByInstance.get('mut')).toBeUndefined();
        });

        it('should handle multiple mutation types correctly', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
    initializeMutationType("m2", 0.5, "e", 0.1);
}

1 early() {
    muts1 = sim.mutationsOfType(m1);
    muts2 = sim.mutationsOfType(m2);
    mut1 = muts1[0];
    mut2 = muts2[0];
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            expect(trackingState.mutationTypeByInstance.get('muts1')).toBe('m1');
            expect(trackingState.mutationTypeByInstance.get('muts2')).toBe('m2');
            expect(trackingState.mutationTypeByInstance.get('mut1')).toBe('m1');
            expect(trackingState.mutationTypeByInstance.get('mut2')).toBe('m2');
        });
    });

    describe('Hover Information', () => {
        it('should show mutation type in hover for mutation instances', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    mut = sim.mutationsOfType(m1)[0];
}`
            );

            let hoverResult: any = null;
            const mockConnection = {
                onHover: (handler: any) => {
                    hoverResult = handler;
                },
            } as any;

            const mockDocuments = {
                get: () => document,
            } as any;

            const context: LanguageServerContext = {
                connection: mockConnection as Connection,
                documents: mockDocuments as TextDocuments<TextDocument>,
                documentationService,
                completionService,
                validationService: {} as any,
            };

            registerHoverProvider(context);

            const result = hoverResult({
                textDocument: { uri: 'file:///test.slim' },
                position: { line: 5, character: 4 }, // On "mut"
            });

            expect(result).toBeTruthy();
            if (result?.contents) {
                const value = typeof result.contents === 'string' 
                    ? result.contents 
                    : result.contents.value;
                expect(value).toContain('mut');
                expect(value).toContain('Mutation');
                expect(value).toContain('m1');
            }
        });
    });

    describe('Completions', () => {
        it('should show mutation type in completion detail', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    mut = sim.mutationsOfType(m1)[0];
    mu
}`
            );

            const completions = completionService.getCompletions(document, {
                line: 6,
                character: 6, // After "mu"
            });

            expect(completions).toBeTruthy();
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            
            const mutCompletion = items.find(item => item.label === 'mut');
            expect(mutCompletion).toBeDefined();
            expect(mutCompletion?.detail).toContain('Mutation');
            expect(mutCompletion?.detail).toContain('m1');
        });

        it('should show mutation type in completion documentation', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    mut = sim.mutationsOfType(m1)[0];
}`
            );

            const completions = completionService.getCompletions(document, {
                line: 5,
                character: 8,
            });

            expect(completions).toBeTruthy();
            const items = Array.isArray(completions) ? completions : completions?.items || [];
            
            const mutCompletion = items.find(item => item.label === 'mut');
            expect(mutCompletion).toBeDefined();
            expect(mutCompletion?.data?.mutationType).toBe('m1');
            
            // Resolve the completion to get documentation
            const resolved = completionService.resolveCompletion(mutCompletion!);
            const docValue = typeof resolved.documentation === 'string' 
                ? resolved.documentation 
                : resolved.documentation?.value;
            expect(docValue).toContain('mutation type');
            expect(docValue).toContain('m1');
        });
    });

    describe('Inlay Hints', () => {
        it('should track mutation type for inlay hints (tested via tracking state)', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    mut = sim.mutationsOfType(m1)[0];
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // Verify mutation type is tracked (inlay hints will use this)
            expect(trackingState.mutationTypeByInstance.get('mut')).toBe('m1');
        });

        it('should track mutation type for loop variables in inlay hints', () => {
            const document = TextDocument.create(
                'file:///test.slim',
                'slim',
                1,
                `initialize() {
    initializeMutationType("m1", 0.5, "f", 0.0);
}

1 early() {
    for (mut in sim.mutationsOfType(m1)) {
        catn(mut.position);
    }
}`
            );

            const trackingState = trackInstanceDefinitions(document);

            // Verify mutation type is tracked for loop variable (inlay hints will use this)
            expect(trackingState.mutationTypeByInstance.get('mut')).toBe('m1');
        });
    });
});


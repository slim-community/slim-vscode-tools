import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { documentCache } from '../../src/services/document-cache';
import { TrackingState } from '../../src/config/types';
import { DiagnosticSeverity } from 'vscode-languageserver';

describe('Document Cache', () => {
    beforeEach(() => {
        // Clear cache before each test
        documentCache.clear();
    });

    describe('Tracking State Cache', () => {
        it('should cache and retrieve tracking state', () => {
            const doc = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5;');
            const trackingState: TrackingState = {
                instanceDefinitions: { x: 'integer' },
                definedConstants: new Set(['N']),
                definedMutationTypes: new Set(),
                definedGenomicElementTypes: new Set(),
                definedInteractionTypes: new Set(),
                definedSubpopulations: new Set(),
                definedScriptBlocks: new Set(),
                definedSpecies: new Set(),
                modelType: null,
                callbackContextByLine: new Map(),
            };

            documentCache.setTrackingState(doc, trackingState);
            const retrieved = documentCache.getTrackingState(doc);

            expect(retrieved).toBeTruthy();
            expect(retrieved?.instanceDefinitions).toEqual({ x: 'integer' });
            expect(retrieved?.definedConstants.has('N')).toBe(true);
        });

        it('should return null for non-existent document', () => {
            const doc = TextDocument.create('file:///nonexistent.slim', 'slim', 1, '');
            const retrieved = documentCache.getTrackingState(doc);
            expect(retrieved).toBeNull();
        });

        it('should invalidate cache on version change', () => {
            const doc1 = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5;');
            const trackingState: TrackingState = {
                instanceDefinitions: { x: 'integer' },
                definedConstants: new Set(),
                definedMutationTypes: new Set(),
                definedGenomicElementTypes: new Set(),
                definedInteractionTypes: new Set(),
                definedSubpopulations: new Set(),
                definedScriptBlocks: new Set(),
                definedSpecies: new Set(),
                modelType: null,
                callbackContextByLine: new Map(),
            };

            documentCache.setTrackingState(doc1, trackingState);

            // Create new version of same document
            const doc2 = TextDocument.create('file:///test.slim', 'slim', 2, 'x = 10;');
            const retrieved = documentCache.getTrackingState(doc2);

            expect(retrieved).toBeNull(); // Should be invalidated
        });
    });

    describe('Diagnostics Cache', () => {
        it('should cache and retrieve diagnostics', () => {
            const doc = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5');
            const diagnostics = [
                {
                    severity: DiagnosticSeverity.Warning,
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 5 },
                    },
                    message: 'Missing semicolon',
                    source: 'slim-tools',
                },
            ];

            documentCache.setDiagnostics(doc, diagnostics);
            const retrieved = documentCache.getDiagnostics(doc);

            expect(retrieved).toBeTruthy();
            expect(retrieved).toHaveLength(1);
            expect(retrieved?.[0].message).toBe('Missing semicolon');
        });

        it('should return null for non-existent document', () => {
            const doc = TextDocument.create('file:///nonexistent.slim', 'slim', 1, '');
            const retrieved = documentCache.getDiagnostics(doc);
            expect(retrieved).toBeNull();
        });

        it('should invalidate diagnostics on version change', () => {
            const doc1 = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5');
            const diagnostics = [
                {
                    severity: DiagnosticSeverity.Warning,
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 5 },
                    },
                    message: 'Missing semicolon',
                    source: 'slim-tools',
                },
            ];

            documentCache.setDiagnostics(doc1, diagnostics);

            // Create new version
            const doc2 = TextDocument.create('file:///test.slim', 'slim', 2, 'x = 5;');
            const retrieved = documentCache.getDiagnostics(doc2);

            expect(retrieved).toBeNull();
        });
    });

    describe('Unified Cache Entry', () => {
        it('should store both tracking state and diagnostics in same entry', () => {
            const doc = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5;');
            
            const trackingState: TrackingState = {
                instanceDefinitions: { x: 'integer' },
                definedConstants: new Set(),
                definedMutationTypes: new Set(),
                definedGenomicElementTypes: new Set(),
                definedInteractionTypes: new Set(),
                definedSubpopulations: new Set(),
                definedScriptBlocks: new Set(),
                definedSpecies: new Set(),
                modelType: null,
                callbackContextByLine: new Map(),
            };

            const diagnostics = [
                {
                    severity: DiagnosticSeverity.Information,
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 5 },
                    },
                    message: 'Test diagnostic',
                    source: 'slim-tools',
                },
            ];

            documentCache.setTrackingState(doc, trackingState);
            documentCache.setDiagnostics(doc, diagnostics);

            // Both should be retrievable
            const retrievedState = documentCache.getTrackingState(doc);
            const retrievedDiagnostics = documentCache.getDiagnostics(doc);

            expect(retrievedState).toBeTruthy();
            expect(retrievedDiagnostics).toBeTruthy();
            expect(retrievedDiagnostics).toHaveLength(1);
        });
    });

    describe('Cache Management', () => {
        it('should delete cache entry by URI', () => {
            const doc = TextDocument.create('file:///test.slim', 'slim', 1, 'x = 5;');
            const trackingState: TrackingState = {
                instanceDefinitions: { x: 'integer' },
                definedConstants: new Set(),
                definedMutationTypes: new Set(),
                definedGenomicElementTypes: new Set(),
                definedInteractionTypes: new Set(),
                definedSubpopulations: new Set(),
                definedScriptBlocks: new Set(),
                definedSpecies: new Set(),
                modelType: null,
                callbackContextByLine: new Map(),
            };

            documentCache.setTrackingState(doc, trackingState);
            expect(documentCache.getTrackingState(doc)).toBeTruthy();

            documentCache.delete(doc.uri);
            expect(documentCache.getTrackingState(doc)).toBeNull();
        });

        it('should clear entire cache', () => {
            const doc1 = TextDocument.create('file:///test1.slim', 'slim', 1, 'x = 5;');
            const doc2 = TextDocument.create('file:///test2.slim', 'slim', 1, 'y = 10;');
            
            const trackingState: TrackingState = {
                instanceDefinitions: {},
                definedConstants: new Set(),
                definedMutationTypes: new Set(),
                definedGenomicElementTypes: new Set(),
                definedInteractionTypes: new Set(),
                definedSubpopulations: new Set(),
                definedScriptBlocks: new Set(),
                definedSpecies: new Set(),
                modelType: null,
                callbackContextByLine: new Map(),
            };

            documentCache.setTrackingState(doc1, trackingState);
            documentCache.setTrackingState(doc2, trackingState);

            const stats = documentCache.getStats();
            expect(stats.size).toBe(2);

            documentCache.clear();

            const statsAfter = documentCache.getStats();
            expect(statsAfter.size).toBe(0);
        });

        it('should provide cache statistics', () => {
            const doc1 = TextDocument.create('file:///test1.slim', 'slim', 1, 'x = 5;');
            const doc2 = TextDocument.create('file:///test2.slim', 'slim', 1, 'y = 10;');
            
            const trackingState: TrackingState = {
                instanceDefinitions: {},
                definedConstants: new Set(),
                definedMutationTypes: new Set(),
                definedGenomicElementTypes: new Set(),
                definedInteractionTypes: new Set(),
                definedSubpopulations: new Set(),
                definedScriptBlocks: new Set(),
                definedSpecies: new Set(),
                modelType: null,
                callbackContextByLine: new Map(),
            };

            documentCache.setTrackingState(doc1, trackingState);
            documentCache.setTrackingState(doc2, trackingState);

            const stats = documentCache.getStats();
            expect(stats.size).toBe(2);
            expect(stats.entries).toContain('file:///test1.slim');
            expect(stats.entries).toContain('file:///test2.slim');
            expect(stats.maxSize).toBe(25);
            expect(stats.hitRate).toBeGreaterThanOrEqual(0);
        });
    });

    describe('LRU Eviction', () => {
        it('should track access order', () => {
            const docs = Array.from({ length: 5 }, (_, i) =>
                TextDocument.create(`file:///test${i}.slim`, 'slim', 1, 'x = 5;')
            );

            const trackingState: TrackingState = {
                instanceDefinitions: {},
                definedConstants: new Set(),
                definedMutationTypes: new Set(),
                definedGenomicElementTypes: new Set(),
                definedInteractionTypes: new Set(),
                definedSubpopulations: new Set(),
                definedScriptBlocks: new Set(),
                definedSpecies: new Set(),
                modelType: null,
                callbackContextByLine: new Map(),
            };

            // Add all docs to cache
            docs.forEach(doc => documentCache.setTrackingState(doc, trackingState));

            // Access doc 0 (should move to end of LRU)
            documentCache.getTrackingState(docs[0]);

            const stats = documentCache.getStats();
            expect(stats.size).toBe(5);
        });
    });
});


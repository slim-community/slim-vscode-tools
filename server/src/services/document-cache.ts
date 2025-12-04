import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic } from 'vscode-languageserver';
import { TrackingState, CacheEntry, CacheStats } from '../config/types';
import { CACHE_CONFIG } from '../config/config';

class DocumentCache {
    private cache = new Map<string, CacheEntry>();
    private accessOrder: string[] = []; // For LRU tracking
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
    };

    getLines(document: TextDocument): string[] | null {
        const cached = this.cache.get(document.uri);
        if (cached && cached.version === document.version && cached.lines) {
            this.recordAccess(document.uri);
            this.recordHit();
            return cached.lines;
        }
        this.recordMiss();
        return null;
    }

    getOrCreateLines(document: TextDocument): string[] {
        const cached = this.getLines(document);
        if (cached) return cached;
        
        const lines = document.getText().split('\n');
        this.setLines(document, lines);
        return lines;
    }

    setLines(document: TextDocument, lines: string[]): void {
        this.ensureCapacity();
        const existing = this.cache.get(document.uri);
        if (existing && existing.version === document.version) {
            existing.lines = lines;
        } else {
            this.cache.set(document.uri, {
                version: document.version,
                lines,
            });
        }
        this.recordAccess(document.uri);
    }

    getTrackingState(document: TextDocument): TrackingState | null {
        const cached = this.cache.get(document.uri);
        if (cached && cached.version === document.version) {
            this.recordAccess(document.uri);
            this.recordHit();
            return cached.trackingState || null;
        }
        this.recordMiss();
        return null;
    }

    setTrackingState(document: TextDocument, state: TrackingState): void {
        this.ensureCapacity();
        const existing = this.cache.get(document.uri);
        if (existing && existing.version === document.version) {
            existing.trackingState = state;
        } else {
            this.cache.set(document.uri, {
                version: document.version,
                trackingState: state,
            });
        }
        this.recordAccess(document.uri);
    }

    getDiagnostics(document: TextDocument): Diagnostic[] | null {
        const cached = this.cache.get(document.uri);
        if (cached && cached.version === document.version) {
            this.recordAccess(document.uri);
            this.recordHit();
            return cached.diagnostics || null;
        }
        this.recordMiss();
        return null;
    }

    setDiagnostics(document: TextDocument, diagnostics: Diagnostic[]): void {
        this.ensureCapacity();
        const existing = this.cache.get(document.uri);
        if (existing && existing.version === document.version) {
            existing.diagnostics = diagnostics;
        } else {
            this.cache.set(document.uri, {
                version: document.version,
                diagnostics,
            });
        }
        this.recordAccess(document.uri);
    }

    delete(uri: string): void {
        this.cache.delete(uri);
        this.accessOrder = this.accessOrder.filter(u => u !== uri);
    }

    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
        this.stats = { hits: 0, misses: 0, evictions: 0 };
    }

    getStats(): { 
        size: number; 
        entries: string[];
        maxSize: number;
        hitRate: number;
        evictions: number;
    } {
        const total = this.stats.hits + this.stats.misses;
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
            maxSize: CACHE_CONFIG.MAX_SIZE,
            hitRate: total > 0 ? this.stats.hits / total : 0,
            evictions: this.stats.evictions,
        };
    }

    private recordAccess(uri: string): void {
        this.accessOrder = this.accessOrder.filter(u => u !== uri);
        this.accessOrder.push(uri);
    }

    private ensureCapacity(): void {
        if (this.cache.size >= CACHE_CONFIG.MAX_SIZE) {
            const lruUri = this.accessOrder.shift();
            if (lruUri) {
                this.cache.delete(lruUri);
                this.stats.evictions++;
            }
        }
    }

    private recordHit(): void {
        if (CACHE_CONFIG.ENABLE_STATS) {
            this.stats.hits++;
        }
    }

    private recordMiss(): void {
        if (CACHE_CONFIG.ENABLE_STATS) {
            this.stats.misses++;
        }
    }
}

export const documentCache = new DocumentCache();

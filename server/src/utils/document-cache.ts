import { TextDocument } from 'vscode-languageserver-textdocument';
import { TrackingState } from '../config/types';

interface CacheEntry {
    version: number;
    state: TrackingState;
}

class DocumentCache {
    private cache = new Map<string, CacheEntry>();

    get(document: TextDocument): TrackingState | null {
        const cached = this.cache.get(document.uri);
        if (cached && cached.version === document.version) {
            return cached.state;
        }
        return null;
    }

    set(document: TextDocument, state: TrackingState): void {
        this.cache.set(document.uri, {
            version: document.version,
            state,
        });
    }

    delete(uri: string): void {
        this.cache.delete(uri);
    }

    clear(): void {
        this.cache.clear();
    }

    getStats(): { size: number; entries: string[] } {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
        };
    }
}

// Singleton instance
export const documentCache = new DocumentCache();


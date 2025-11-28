import { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageMode } from '../config/types';

export function getFileType(document: TextDocument): 'eidos' | 'slim' {
    const uri = document.uri;
    if (uri.endsWith('.eidos')) {
        return 'eidos';
    }
    return 'slim';
}

export function getFileTypeFromUri(uri: string): 'eidos' | 'slim' {
    if (uri.endsWith('.eidos')) {
        return 'eidos';
    }
    return 'slim';
}

export function isFeatureAvailable(source: string, fileType: LanguageMode): boolean {
    // SLiM files can use both Eidos and SLiM features
    if (fileType === 'slim') {
        return true;
    }
    
    // Eidos files can only use Eidos features
    if (fileType === 'eidos') {
        return source === 'eidos'; 
    }
    
    return true;
}

export function filterByFileType<T extends { source: string }>(
    items: { [key: string]: T },
    fileType: 'eidos' | 'slim'
): { [key: string]: T } {

    if (fileType === 'slim') {
        // SLiM files get everything
        return items;
    }
    
    // Eidos files only get Eidos items
    const filtered: { [key: string]: T } = {};
    for (const key in items) {
        if (items[key].source === 'eidos') {
            filtered[key] = items[key];
        }
    }
    return filtered;
}

export function isSourceAvailableInMode(
    source: LanguageMode | undefined,
    mode: LanguageMode
): boolean {
    // Eidos source is always available
    if (source === 'eidos') {
        return true;
    }

    // SLiM-specific features only in slim mode
    if (source === 'slim') {
        return mode === 'slim';
    }

    return true;
}
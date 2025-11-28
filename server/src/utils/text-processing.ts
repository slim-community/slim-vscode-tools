import { decode as decodeHTML } from 'he';
import type { ParseState, ParseOptions } from '../config/types';

export type { ParseState, ParseOptions };

export function expandTypeAbbreviations(text: string): string {
    if (!text) return text;

    // Process longest patterns first to avoid partial matches
    return text
        // 4+ character abbreviations (all nullable with N prefix)
        .replace(/\bNlif\b/g, 'logical or integer or float')
        .replace(/\bNlis\b/g, 'logical or integer or string')
        .replace(/\bNiso\b/g, 'integer or string or object')
        // 3 character abbreviations (all nullable with N prefix)
        .replace(/\bNif\b/g, 'integer or float')
        .replace(/\bNis\b/g, 'integer or string')
        .replace(/\bNio\b/g, 'integer or object')
        .replace(/\bNfs\b/g, 'float or string')
        .replace(/\bNli\b/g, 'logical or integer')
        .replace(/\bNlo\b/g, 'logical or object')
        // Non-nullable multi-type abbreviations (only match when followed by $ or <)
        .replace(/\biso(?=[\$<\s])/g, 'integer or string or object')
        .replace(/\bio(?=[\$<\s])/g, 'integer or object')
        .replace(/\bis(?=[\$<\s])/g, 'integer or string')
        // 2 character abbreviations with angle brackets (object types)
        .replace(/\bNo<([^>]+)>/g, 'object<$1>')
        // 2 character abbreviations (all nullable with N prefix)
        .replace(/\bNi\b/g, 'integer')
        .replace(/\bNl\b/g, 'logical')
        .replace(/\bNs\b/g, 'string')
        .replace(/\bNf\b/g, 'float')
        .replace(/\bNo\b/g, 'object');
}

// Remove the $ from type names
export function cleanTypeNames(text: string): string {
    if (!text) return text;
    text = text.replace(/(\w+(?:<[^>]+>)?)\$/g, '$1');
    return expandTypeAbbreviations(text);
}

// Turn "object<ClassType>" into "<ClassType>"
export function cleanSignature(signature: string): string {
    if (!signature) return signature;
    let cleaned = cleanTypeNames(signature);
    return cleaned.replace(/\bobject<([^>]+)>/gi, '<$1>');
}

// Decode HTML entities for clean math display; clean type names and signatures (resolves issue #6)
export function cleanDocumentationText(text: string): string {
    if (!text) return text;

    // Decode HTML entities using 'he' library
    let cleaned = decodeHTML(text);

    // Clean type names
    cleaned = cleanTypeNames(cleaned);

    // Replace "object<ClassType>" with "<ClassType>" in descriptions
    cleaned = cleaned.replace(/\bobject<([^>]+)>/gi, '<$1>');

    // Convert HTML tags to markdown (preserve sub/sup tags)
    cleaned = cleaned
        .replace(/<span[^>]*>/gi, '')
        .replace(/<\/span>/gi, '')
        .replace(/<i>/gi, '*')
        .replace(/<\/i>/gi, '*')
        .replace(/<b>/gi, '**')
        .replace(/<\/b>/gi, '**')
        .replace(/<em>/gi, '*')
        .replace(/<\/em>/gi, '*')
        .replace(/<strong>/gi, '**')
        .replace(/<\/strong>/gi, '**');

    // Clean up multiple spaces
    return cleaned.replace(/\s{2,}/g, ' ');
}
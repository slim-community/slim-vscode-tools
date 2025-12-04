import { decode as decodeHTML } from 'he';
import type { CommentRanges, StringParseState } from '../config/types';

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

export function removeStringsAndComments(line: string, shouldTrim: boolean = true): string {
    const strings: string[] = [];
    const codeWithPlaceholders = line.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
        strings.push(match);
        return `__STRING${strings.length - 1}__`;
    });

    const result = codeWithPlaceholders
        .replace(/\/\/.*$/, '')
        .replace(/\/\*.*?\*\//g, '');
    
    return shouldTrim ? result.trim() : result;
}

export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createStringParseState(): StringParseState {
    return { inString: false, escapeNext: false };
}

export function updateStringState(char: string, state: StringParseState): boolean {
    if (state.escapeNext) {
        state.escapeNext = false;
        return false;
    }

    if (char === '\\' && state.inString) {
        state.escapeNext = true;
        return false;
    }

    if (char === '"') {
        state.inString = !state.inString;
        return false;
    }

    return !state.inString;
}

export function findCharPositions(
    code: string,
    chars: string[]
): Array<{ index: number; char: string }> {
    const positions: Array<{ index: number; char: string }> = [];
    const state = createStringParseState();

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const shouldProcess = updateStringState(char, state);
        
        if (shouldProcess && chars.includes(char)) {
            positions.push({ index: i, char });
        }
    }

    return positions;
}

export function findBracePositionsInCode(code: string): Array<{ index: number; char: '{' | '}' }> {
    return findCharPositions(code, ['{', '}']) as Array<{ index: number; char: '{' | '}' }>;
}

export function countDelimiters(
    text: string, 
    open: string, 
    close: string
): { openCount: number; closeCount: number } {
    const openCount = (text.match(new RegExp(escapeRegex(open), 'g')) || []).length;
    const closeCount = (text.match(new RegExp(escapeRegex(close), 'g')) || []).length;
    return { openCount, closeCount };
}

export function countParens(text: string): { openCount: number; closeCount: number } {
    return countDelimiters(text, '(', ')');
}

export function countBraces(text: string): { openCount: number; closeCount: number } {
    return countDelimiters(text, '{', '}');
}

export function countCommasOutsideParens(text: string): number {
    const cleaned = removeStringsAndComments(text);
    
    let commaCount = 0;
    let parenDepth = 0;
    
    for (const char of cleaned) {
        if (char === '(') {
            parenDepth++;
        } else if (char === ')') {
            parenDepth--;
        } else if (char === ',' && parenDepth === 0) {
            commaCount++;
        }
    }
    
    return commaCount;
}

export function splitCodeAndComment(line: string): { code: string; comment: string } {
    const trimmed = line.trim();
    
    let inString = false;
    let stringChar = '';
    let commentIndex = -1;

    for (let i = 0; i < trimmed.length - 1; i++) {
        const char = trimmed[i];
        const nextChar = trimmed[i + 1];
        const prevChar = i > 0 ? trimmed[i - 1] : '';

        // Track string state
        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
            inString = false;
        }

        // Find comment outside of strings
        if (!inString && char === '/' && nextChar === '/') {
            commentIndex = i;
            break;
        }
    }

    if (commentIndex >= 0) {
        return {
            code: trimmed.substring(0, commentIndex).trim(),
            comment: ' ' + trimmed.substring(commentIndex),
        };
    }

    return { code: trimmed, comment: '' };
}

export function findSingleLineCommentStart(line: string): number {
    let inString = false;
    let stringChar: string | null = null;
    
    for (let i = 0; i < line.length - 1; i++) {
        const char = line[i];
        const prevChar = i > 0 ? line[i - 1] : '';
        
        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
            inString = false;
            stringChar = null;
        } else if (!inString && char === '/' && line[i + 1] === '/') {
            return i;
        }
    }
    
    return -1;
}

export function isInComment(index: number, commentRanges: CommentRanges): boolean {
    const { singleLineCommentStart, multiLineCommentRanges } = commentRanges;
    
    // Check single-line comment
    if (singleLineCommentStart !== -1 && index >= singleLineCommentStart) {
        return true;
    }
    
    // Check multi-line comments
    return multiLineCommentRanges.some(
        range => index >= range.start && index < range.end
    );
}

export function isInStringLiteral(line: string, index: number): boolean {
    const state = createStringParseState();
    
    for (let i = 0; i < index; i++) {
        updateStringState(line[i], state);
    }
    
    return state.inString;
}

export function isPureCommentLine(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('/*');
}

export function findMatchingParen(text: string, openIndex: number): number {
    let depth = 1;
    const state = createStringParseState();

    for (let i = openIndex + 1; i < text.length; i++) {
        const char = text[i];
        const shouldProcess = updateStringState(char, state);

        if (shouldProcess) {
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }
        }
    }

    return -1;
}

export function splitFunctionArguments(argsString: string): string[] {
    const args: string[] = [];
    let currentArg = '';
    let depth = 0;
    const state = createStringParseState();

    for (let i = 0; i < argsString.length; i++) {
        const char = argsString[i];
        const wasInString = state.inString;
        const shouldProcess = updateStringState(char, state);

        // Always add the character to the current argument
        currentArg += char;

        // Only process delimiters when not in a string
        if (shouldProcess) {
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
            } else if (char === ',' && depth === 0) {
                // Remove the comma we just added and push the argument
                args.push(currentArg.slice(0, -1));
                currentArg = '';
            }
        } else if (wasInString !== state.inString || state.escapeNext) {
            // Character was part of string delimiter or escape - keep it
        }
    }

    if (currentArg) {
        args.push(currentArg);
    }

    return args;
}

export function extractDocComment(lines: string[], targetLine: number): string | null {
    const commentLines: string[] = [];
    let lineIndex = targetLine - 1;
    
    // Work backwards from the line before the function
    while (lineIndex >= 0) {
        const line = lines[lineIndex].trim();
        
        // Skip empty lines at the start (but not after we've found comments)
        if (line === '' && commentLines.length === 0) {
            lineIndex--;
            continue;
        }
        
        // Check for single-line comment
        if (line.startsWith('//')) {
            // Remove the // prefix and trim
            const commentText = line.replace(/^\/\/\s?/, '').trim();
            commentLines.unshift(commentText);
            lineIndex--;
            continue;
        }
        
        // Check for end of multi-line comment
        if (line.endsWith('*/')) {
            // Collect the multi-line comment
            const multiLineComment = extractMultiLineComment(lines, lineIndex);
            if (multiLineComment) {
                commentLines.unshift(multiLineComment);
                // Find where the multi-line comment started
                while (lineIndex >= 0 && !lines[lineIndex].includes('/*')) {
                    lineIndex--;
                }
                lineIndex--;
                continue;
            }
        }
        
        // If we hit a non-comment, non-empty line, stop
        if (line !== '') {
            break;
        }
        
        lineIndex--;
    }
    
    if (commentLines.length === 0) {
        return null;
    }
    
    return commentLines.join('\n');
}

function extractMultiLineComment(lines: string[], endLine: number): string | null {
    const commentLines: string[] = [];
    let lineIndex = endLine;
    
    while (lineIndex >= 0) {
        const line = lines[lineIndex];
        const trimmed = line.trim();
        
        // Check if this line has the opening /*
        const startIndex = line.indexOf('/*');
        if (startIndex !== -1) {
            // Extract everything after /* on this line
            let content = line.substring(startIndex + 2);
            // Remove trailing */ if on same line
            content = content.replace(/\*\/$/, '').trim();
            // Remove leading * if present (common in multi-line comment style)
            content = content.replace(/^\*\s?/, '').trim();
            if (content) {
                commentLines.unshift(content);
            }
            break;
        }
        
        // For middle lines, strip leading * and trailing */
        let content = trimmed;
        content = content.replace(/^\*\s?/, ''); // Remove leading *
        content = content.replace(/\*\/$/, '').trim(); // Remove trailing */
        
        if (content) {
            commentLines.unshift(content);
        }
        
        lineIndex--;
    }
    
    if (commentLines.length === 0) {
        return null;
    }
    
    return commentLines.join('\n');
}
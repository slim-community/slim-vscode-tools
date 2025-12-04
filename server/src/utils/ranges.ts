import { FoldingRange, FoldingRangeKind, Range } from 'vscode-languageserver';
import { findSingleLineCommentStart, isPureCommentLine, splitCodeAndComment } from './text-processing';
import { BlockType, CommentRanges } from '../config/types';
import { FOLDING_RANGE_PATTERNS } from '../config/config';

// Helper function to find the range of a code block
export function findBlockRange(startLine: number, lines: string[]): Range {
    let braceCount = 0;
    let foundOpenBrace = false;
    let endLine = startLine;

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];

        if (isPureCommentLine(line)) {
            continue;
        }

        const { code } = splitCodeAndComment(line);

        for (const char of code) {
            if (char === '{') {
                braceCount++;
                foundOpenBrace = true;
            } else if (char === '}') {
                braceCount--;
                if (foundOpenBrace && braceCount === 0) {
                    endLine = i;
                    return Range.create(
                        startLine, 0,
                        endLine, lines[endLine].length
                    );
                }
            }
        }
    }

    return Range.create(
        startLine, 0,
        startLine, lines[startLine].length
    );
}

// Helper function to identify the type of a block
export function identifyBlockType(line: string): BlockType | null {
    const trimmed = line.trim();

    if (FOLDING_RANGE_PATTERNS.SLIM_CALLBACK.test(trimmed)) {
        return { kind: FoldingRangeKind.Region, type: 'callback' };
    }

    if (FOLDING_RANGE_PATTERNS.INITIALIZE_BLOCK.test(trimmed)) {
        return { kind: FoldingRangeKind.Region, type: 'initialize' };
    }

    if (FOLDING_RANGE_PATTERNS.FUNCTION_DEFINITION.test(trimmed)) {
        return { kind: FoldingRangeKind.Region, type: 'function' };
    }

    if (FOLDING_RANGE_PATTERNS.CONDITIONAL_BLOCK.test(trimmed)) {
        return { type: 'conditional' };
    }

    if (FOLDING_RANGE_PATTERNS.LOOP_BLOCK.test(trimmed)) {
        return { type: 'loop' };
    }

    return { type: 'block' };
}

// Helper function to find the range of comment blocks
export function findCommentBlocks(lines: string[]): FoldingRange[] {
    const ranges: FoldingRange[] = [];
    let commentStart: number | null = null;

    for (let i = 0; i < lines.length; i++) {
        if (isPureCommentLine(lines[i])) {
            if (commentStart === null) {
                commentStart = i;
            }
        } else if (commentStart !== null) {
            if (i - commentStart > 1) {
                ranges.push({
                    startLine: commentStart,
                    endLine: i - 1,
                    kind: FoldingRangeKind.Comment,
                });
            }
            commentStart = null;
        }
    }

    // Handle comment block that extends to end of file
    if (commentStart !== null && lines.length - commentStart > 1) {
        ranges.push({
            startLine: commentStart,
            endLine: lines.length - 1,
            kind: FoldingRangeKind.Comment,
        });
    }

    return ranges;
}

export function getCommentRanges(line: string): CommentRanges {
    const singleLineCommentStart = findSingleLineCommentStart(line);
    const multiLineCommentRanges: Array<{ start: number; end: number }> = [];
    
    const multiLineCommentRegex = /\/\*.*?\*\//g;
    let match: RegExpExecArray | null;
    while ((match = multiLineCommentRegex.exec(line)) !== null) {
        multiLineCommentRanges.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }
    
    return { singleLineCommentStart, multiLineCommentRanges };
}
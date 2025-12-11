import {
    FoldingRange,
    FoldingRangeKind,
    FoldingRangeParams,
} from 'vscode-languageserver';
import { LanguageServerContext } from '../config/types';
import { isPureCommentLine, splitCodeAndComment, findBracePositionsInCode } from '../utils/text-processing';
import { identifyBlockType, findCommentBlocks } from '../utils/ranges';
import { documentCache } from '../services/document-cache';

// Register folding range provider
export function registerFoldingRangeProvider(context: LanguageServerContext): void {
    const { connection, documents } = context;

    connection.onFoldingRanges((params: FoldingRangeParams): FoldingRange[] => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return [];

        const lines = documentCache.getOrCreateLines(document);

        return findFoldingRanges(lines);
    });
}

// Find the potential folding ranges in the document (large code blocks)
function findFoldingRanges(lines: string[]): FoldingRange[] {
    const ranges: FoldingRange[] = [];
    const bracketStack: Array<{ line: number; kind?: FoldingRangeKind; type: string }> = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!line.trim() || isPureCommentLine(line)) {
            continue;
        }

        const { code: codeOnly } = splitCodeAndComment(line);

        // Check for block starts
        const blockType = identifyBlockType(codeOnly);

        const bracePositions = findBracePositionsInCode(codeOnly);

        for (const pos of bracePositions) {
            if (pos.char === '{') {
                bracketStack.push({
                    line: i,
                    kind: blockType?.kind,
                    type: blockType?.type || 'block',
                });
            } else if (pos.char === '}') {
                if (bracketStack.length > 0) {
                    const start = bracketStack.pop()!;

                    // Only create folding range if the block spans multiple lines
                    if (i > start.line) {
                        const range: FoldingRange = {
                            startLine: start.line,
                            endLine: i,
                        };

                        if (start.kind) {
                            range.kind = start.kind;
                        }

                        ranges.push(range);
                    }
                }
            }
        }
    }

    // Add comment block folding
    ranges.push(...findCommentBlocks(lines));

    return ranges;
}
import {
    InlayHint,
    InlayHintKind,
    InlayHintParams,
    Position,
} from 'vscode-languageserver';
import { LanguageServerContext, TrackingState } from '../config/types';
import { trackInstanceDefinitions } from '../utils/instance';
import { inferTypeFromExpression, inferLoopVariableType } from '../utils/type-manager';
import { DEFINITION_PATTERNS, INLAY_HINT_PATTERNS } from '../config/config';
import { getFileType } from '../utils/file-type';
import { parseEidosFunctionSignature } from '../utils/eidos-function-parser';
import { isPureCommentLine, findMatchingParen, splitFunctionArguments } from '../utils/text-processing';
import { documentCache } from '../services/document-cache';

// Register inlay hints provider
export function registerInlayHintsProvider(context: LanguageServerContext): void {
    const { connection, documents, documentationService } = context;

    connection.languages.inlayHint.on((params: InlayHintParams): InlayHint[] => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        const hints: InlayHint[] = [];

        const trackingState = trackInstanceDefinitions(document);

        const fileType = getFileType(document);
        const functionsData = documentationService.getFunctions(fileType);

        const lines = documentCache.getOrCreateLines(document);
        const startLine = params.range.start.line;
        const endLine = params.range.end.line;

        for (
            let lineIndex = startLine;
            lineIndex <= endLine && lineIndex < lines.length;
            lineIndex++
        ) {
            const line = lines[lineIndex];

            if (!line.trim() || isPureCommentLine(line)) {
                continue;
            }

            // Add hints for variable assignments with inferred types
            hints.push(...getTypeHintsForLine(line, lineIndex, trackingState as TrackingState));

            // Add hints for function parameters
            hints.push(...getParameterHintsForLine(line, lineIndex, functionsData));
        }

        return hints;
    });
}

function getTypeHintsForLine(
    line: string,
    lineIndex: number,
    trackingState: TrackingState,
): InlayHint[] {
    const hints: InlayHint[] = [];

    // Pattern: variable = expression;
    const assignmentMatch = line.match(DEFINITION_PATTERNS.ASSIGNMENT);
    if (assignmentMatch) {
        const varName = assignmentMatch[1];
        const expression = assignmentMatch[2].trim();

        if (line.substring(0, line.indexOf(varName)).trim().endsWith('.')) {
            return hints;
        }

        const inferredType = inferTypeFromExpression(
            expression,
            trackingState.instanceDefinitions
        );

        if (inferredType) {
            const varIndex = line.indexOf(varName);
            if (varIndex !== -1) {
                hints.push({
                    position: Position.create(lineIndex, varIndex + varName.length),
                    label: `: ${inferredType}`,
                    kind: InlayHintKind.Type,
                    paddingLeft: false,
                    paddingRight: true,
                });
            }
        }
    }

    // Pattern: for (x in collection)
    const forInMatch = line.match(INLAY_HINT_PATTERNS.FOR_IN_LOOP);
    if (forInMatch) {
        const varName = forInMatch[1];
        const collection = forInMatch[2].trim();

        const elementType = inferLoopVariableType(
            collection,
            trackingState.instanceDefinitions
        );

        if (elementType) {
            const varIndex = line.indexOf(varName);
            if (varIndex !== -1) {
                hints.push({
                    position: Position.create(lineIndex, varIndex + varName.length),
                    label: `: ${elementType}`,
                    kind: InlayHintKind.Type,
                    paddingLeft: false,
                    paddingRight: true,
                });
            }
        }
    }

    return hints;
}

function getParameterHintsForLine(
    line: string,
    lineIndex: number,
    functionsData: Record<string, any>
): InlayHint[] {
    const hints: InlayHint[] = [];

    // Match function calls: functionName(arg1, arg2, ...)
    const functionCallPattern = INLAY_HINT_PATTERNS.FUNCTION_CALL;
    let match: RegExpExecArray | null;

    functionCallPattern.lastIndex = 0;

    while ((match = functionCallPattern.exec(line)) !== null) {
        const functionName = match[1];
        const openParenIndex = match.index + match[0].length - 1;

        if (INLAY_HINT_PATTERNS.CONTROL_STRUCTURES.includes(functionName)) {
            continue;
        }

        const funcInfo = functionsData[functionName];
        if (!funcInfo) {
            continue;
        }

        const signature = funcInfo.signature || funcInfo.signatures?.[0];
        if (!signature) {
            continue;
        }

        try {
            const parsed = parseEidosFunctionSignature(signature);
            if (!parsed || parsed.parameters.length === 0) {
                continue;
            }

            // Find the arguments in the function call
            const argsStart = openParenIndex + 1;
            const argsEnd = findMatchingParen(line, openParenIndex);
            if (argsEnd === -1) {
                continue; // Unclosed parenthesis or multi-line call
            }

            const argsString = line.substring(argsStart, argsEnd);
            const args = splitFunctionArguments(argsString);

            // Add parameter name hints for each argument
            let currentPos = argsStart;
            for (let i = 0; i < args.length && i < parsed.parameters.length; i++) {
                const arg = args[i];
                const param = parsed.parameters[i];

                if (!arg.trim()) {
                    continue;
                }

                const argPos = line.indexOf(arg.trim(), currentPos);
                if (argPos !== -1) {
                    hints.push({
                        position: Position.create(lineIndex, argPos),
                        label: `${param.name}:`,
                        kind: InlayHintKind.Parameter,
                        paddingLeft: false,
                        paddingRight: true,
                    });

                    currentPos = argPos + arg.length;
                }
            }
        } catch {
            // Skip this function if parsing fails
            continue;
        }
    }

    return hints;
}

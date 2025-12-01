import { SignatureHelp, SignatureHelpParams, MarkupKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageServerContext } from '../config/types';
import { getFileType } from '../utils/file-type';

function countCommasOutsideParens(text: string): number {
    let commaCount = 0;
    let parenDepth = 0;
    
    for (const char of text) {
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

export function onSignatureHelp(
    params: SignatureHelpParams,
    document: TextDocument,
    context: LanguageServerContext
): SignatureHelp | null {
    const position = params.position;
    const text = document.getText();
    
    // Determine file type and get filtered data from service
    const fileType = getFileType(document);
    const availableFunctions = context.documentationService.getFunctions(fileType);
    
    // Get the line up to cursor
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;
    
    const line = lines[position.line];
    const textBeforeCursor = line.substring(0, position.character);
    
    // Find the last unclosed opening paren by tracking paren depth
    let openParenIndex = -1;
    let depth = 0;
    
    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
        const char = textBeforeCursor[i];
        if (char === ')') {
            depth++;
        } else if (char === '(') {
            if (depth === 0) {
                openParenIndex = i;
                break;
            }
            depth--;
        }
    }
    
    if (openParenIndex === -1) return null;
    
    // Find the function name before the opening paren
    const textBeforeParen = textBeforeCursor.substring(0, openParenIndex);
    const functionNameMatch = textBeforeParen.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
    
    if (!functionNameMatch) return null;
    
    const functionName = functionNameMatch[1];
    const functionInfo = availableFunctions[functionName];
    
    if (functionInfo) {
        const signature = functionInfo.signature || '';

        if (!signature) {
            return null;
        }

        // Extract parameters from signature
        const paramList = signature.match(/\((.*?)\)/);
        const paramsText = paramList ? paramList[1].trim() : '';
        const parameters = paramsText ? paramsText.split(',').map((p) => p.trim()) : [];

        // Calculate active parameter by counting commas (accounting for nested parens)
        const textInParens = textBeforeCursor.substring(openParenIndex + 1);
        const commaCount = countCommasOutsideParens(textInParens);

        // For variadic functions (like sum(...)) or functions with no explicit params,
        // don't clamp the active parameter.
        const isVariadic = paramsText === '...' || paramsText.includes('...');
        const finalActiveParameter = isVariadic || commaCount >= parameters.length
            ? commaCount
            : Math.min(commaCount, Math.max(0, parameters.length - 1));

        return {
            signatures: [
                {
                    label: signature,
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: `${signature}\n\n${functionInfo.description}`,
                    },
                    parameters: parameters.map((param) => ({ label: param })),
                },
            ],
            activeSignature: 0,
            activeParameter: finalActiveParameter,
        };
    }

    return null;
}


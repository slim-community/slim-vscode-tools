import { SignatureHelp, SignatureHelpParams, MarkupKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getWordAndContextAtPosition } from '../utils/positions';
import { LanguageServerContext } from '../config/types';
import { getFileType } from '../utils/file-type';

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
    
    const word = getWordAndContextAtPosition(text, position);

    if (word && availableFunctions[word.word]) {
        const functionInfo = availableFunctions[word.word];
        const signature = functionInfo.signature || '';

        if (!signature) {
            return null;
        }

        // Extract parameters from signature
        const paramList = signature.match(/\((.*?)\)/);
        const parameters = paramList ? paramList[1].split(',').map((p) => p.trim()) : [];

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
            activeParameter: 0,
        };
    }

    return null;
}


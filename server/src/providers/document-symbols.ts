import { DocumentSymbolParams } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function onDocumentSymbol(params: DocumentSymbolParams, document: TextDocument): any[] {
    const text = document.getText();
    const symbols: any[] = [];

    const lines = text.split('\n');
    lines.forEach((line, index) => {
        const match = line.match(/function\s+(\w+)/);
        if (match) {
            symbols.push({
                name: match[1],
                kind: 12, // Function kind
                location: {
                    uri: params.textDocument.uri,
                    range: {
                        start: { line: index, character: 0 },
                        end: { line: index, character: line.length },
                    },
                },
            });
        }
    });

    return symbols;
}


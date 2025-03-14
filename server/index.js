const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  DiagnosticSeverity
} = require('vscode-languageserver/node');

const connection = createConnection(ProposedFeatures.all);
const { TextDocument } = require('vscode-languageserver-textdocument');
const documents = new TextDocuments(TextDocument);
const fs = require('fs');
const path = require('path');

// Load SLiM function data from JSON file
const functionDocsPath = path.join(__dirname, '..', 'docs', 'slim_function_docs.json');

let functionsData = {};
if (fs.existsSync(functionDocsPath)) {
  functionsData = JSON.parse(fs.readFileSync(functionDocsPath, 'utf8'));
  console.log('✅ Server loaded function documentation successfully.');
  console.log('Server loaded functions:', Object.keys(functionsData));
} else {
  console.error('❌ ERROR: slim_function_docs.json not found in server!');
}

documents.listen(connection);

connection.onInitialize(() => {
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      completionProvider: {
        resolveProvider: true
      },
      hoverProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      documentFormattingProvider: true,
      signatureHelpProvider: {   
          triggerCharacters: ["(", ",", " "],
          retriggerCharacters: [",", ")"]
      }
    }
  };
});

connection.onInitialized(() => {
  connection.console.log('SLiM Language Server initialized');
});

documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument) {
  const text = textDocument.getText();
  const pattern = /TODO/g;
  let m;
  const diagnostics = [];

  while ((m = pattern.exec(text))) {
    const diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(m.index),
        end: textDocument.positionAt(m.index + m[0].length)
      },
      message: `Found TODO`,
      source: 'slim-tools'
    };
    diagnostics.push(diagnostic);
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// ✅ Re-added document symbol provider to prevent "Unhandled method" error
connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const text = document.getText();
  const symbols = [];

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
            end: { line: index, character: line.length }
          }
        }
      });
    }
  });

  return symbols;
});

connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const position = params.position;
    const text = document.getText();
    const word = getWordAtPosition(text, position);

    if (functionsData[word]) {
        const functionInfo = functionsData[word];
        return {
            contents: {
                kind: "markdown",
                value: `**${word}**\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`
            }
        };
    }

    return null;
});

function getWordAtPosition(text, position) {
    const lines = text.split('\n');
    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const wordMatch = line.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);

    if (!wordMatch) return null;

    let bestMatch = null;

    for (const word of wordMatch) {
        const start = line.indexOf(word);
        const end = start + word.length;

        // Standard behavior: Return the word under the cursor
        if (position.character >= start && position.character <= end) {
            return word;
        }

        // Extra handling for function calls: Detect word before '('
        if (position.character > end && line.slice(end).match(/^\s*\(/)) {
            bestMatch = word; // Store last word before '('
        }
    }

    return bestMatch; // Return function name before '(' if found
}

connection.onCompletion((params) => {
    const completions = [];

    for (const funcName in functionsData) {
        const functionInfo = functionsData[funcName];
        completions.push({
            label: funcName,
            kind: 3, // Function completion
            detail: functionInfo.signature,
            documentation: {
                kind: "markdown",
                value: `**${funcName}**\n\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`
            },
            // Add command data to show documentation
            command: {
                title: 'Show Documentation',
                command: 'slimTools.showFunctionDoc',
                arguments: [funcName]
            }
        });
    }

    return completions;
});

// This resolves additional information for a completion item
connection.onCompletionResolve((item) => {
    if (functionsData[item.label]) {
        const functionInfo = functionsData[item.label];
        item.documentation = {
            kind: "markdown",
            value: `**${item.label}**\n\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`
        };
    }
    return item;
});

// parameter hints
connection.onSignatureHelp((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const position = params.position;
    const text = document.getText();
    const word = getWordAtPosition(text, position);

    console.log("Signature Help Triggered for:", word);

    if (functionsData[word]) {
        const functionInfo = functionsData[word];
        const signature = functionInfo.signature;
        
        // Extract parameters from signature
        const paramList = signature.match(/\((.*?)\)/);
        const parameters = paramList ? paramList[1].split(",").map(p => p.trim()) : [];

        return {
            signatures: [
                {
                    label: signature,
                    documentation: {
                        kind: "markdown",
                        value: `${functionInfo.signature}\n\n${functionInfo.description}`
                    },
                    parameters: parameters.map(param => ({ label: param }))
                }
            ],
            activeSignature: 0,
            activeParameter: 0
        };
    }

    return null;
});

// Add this handler for references
connection.onReferences((params) => {
    // Just return an empty array for now
    return [];
});

// Disable GoTo Definition by removing the definition handler
// connection.onDefinition((params) => {
//     const document = documents.get(params.textDocument.uri);
//     if (!document) return null;
//
//     const position = params.position;
//     const text = document.getText();
//     const word = getWordAtPosition(text, position);
//
//     console.log(`🔍 Server looking for definition of: ${word}`);
//     console.log(`Function exists in server: ${!!functionsData[word]}`);
//
//     if (functionsData[word]) {
//         // Previously, we would send a notification and return a dummy location...
//         connection.sendNotification('custom/showFunctionDoc', { functionName: word });
//         console.log(`Sent custom notification for: ${word}`);
//         
//         return {
//             uri: document.uri,
//             range: {
//                 start: position,
//                 end: position
//             }
//         };
//     }
//
//     return null;
// });

connection.listen();

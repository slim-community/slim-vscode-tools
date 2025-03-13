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
const functionsPath = path.join(__dirname, 'slim_functions.json');
const eidosFunctionsPath = path.join(__dirname, 'eidos_functions.json');

let functionsData = {};
if (fs.existsSync(functionsPath)) {
  functionsData = JSON.parse(fs.readFileSync(functionsPath, 'utf8'));
}
if (fs.existsSync(eidosFunctionsPath)) {
    Object.assign(functionsData, JSON.parse(fs.readFileSync(eidosFunctionsPath, 'utf8')));
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
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true, // Ensures document symbols are handled
      documentFormattingProvider: true,
      signatureHelpProvider: {   
          triggerCharacters: ["(", ",", " "],  // Adding space for better trigger detection
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
      return {
          contents: {
              kind: "markdown",
              value: functionsData[word]
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
        completions.push({
            label: funcName,
            kind: 3, // Function completion
            detail: functionsData[funcName].split("\n")[1].replace("```slim", "").trim(), // Function signature
            documentation: {
                kind: "markdown",
                value: functionsData[funcName]
            }
        });
    }

    return completions;
});

connection.onCompletionResolve((item) => {
    if (functionsData[item.label]) {
        item.documentation = {
            kind: "markdown",
            value: functionsData[item.label]
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
        // Extract function signature more reliably
        const signatureMarkdown = functionsData[word];
        const signatureLines = signatureMarkdown.split("\n");
        
        // Find the function signature line (should be within first few lines)
        let firstLine = signatureLines.find(line => line.startsWith("```slim"));
        if (!firstLine) return null;

        firstLine = firstLine.replace("```slim", "").trim(); // Remove markdown code block

        // Extract parameters
        const paramList = firstLine.match(/\((.*?)\)/); // Get content inside parentheses
        const parameters = paramList ? paramList[1].split(",").map(p => p.trim()) : [];

        return {
            signatures: [
                {
                    label: firstLine,  // Show function signature
                    documentation: {
                        kind: "markdown",
                        value: signatureMarkdown
                    },
                    parameters: parameters.map(param => ({ label: param })) // Format parameters
                }
            ],
            activeSignature: 0,
            activeParameter: 0
        };
    }

    return null;
});


connection.listen();

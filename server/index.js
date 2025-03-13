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
      documentSymbolProvider: true, // ✅ Ensures document symbols are handled
      documentFormattingProvider: true
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

  for (const word of wordMatch) {
    const start = line.indexOf(word);
    const end = start + word.length;

    if (position.character >= start && position.character <= end) {
      return word;
    }
  }

  return null;
}

connection.listen();

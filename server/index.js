const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  DiagnosticSeverity
} = require('vscode-languageserver/node');

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments();

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
      documentSymbolProvider: true,
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
      source: 'ex'
    };
    diagnostics.push(diagnostic);
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onCompletion(() => {
  return [
    {
      label: 'initialize',
      kind: 1,
      data: 1
    },
    {
      label: 'sim',
      kind: 6,
      data: 2
    }
  ];
});

connection.onCompletionResolve(item => {
  if (item.data === 1) {
    item.detail = 'SLiM initialize function';
    item.documentation = 'Initialize the SLiM simulation environment.';
  } else if (item.data === 2) {
    item.detail = 'SLiM simulation object';
    item.documentation = 'The main simulation object in SLiM.';
  }
  return item;
});

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  const position = params.position;
  const text = document.getText();
  const word = getWordAtPosition(text, position);

  if (word === 'initialize') {
    return {
      contents: 'Initialize the SLiM simulation environment.'
    };
  } else if (word === 'sim') {
    return {
      contents: 'The main simulation object in SLiM.'
    };
  } else if (word === 'initializeSLiMOptions') {
    return {
      contents: 'Initialize SLiM options.'
    };
  } else if (word === 'initializeMutationRate') {
    return {
      contents: 'Initialize the mutation rate.'
    };
  } else if (word === 'initializeMutationType') {
    return {
      contents: 'Initialize a mutation type.'
    };
  } else if (word === 'initializeGenomicElementType') {
    return {
      contents: 'Initialize a genomic element type.'
    };
  } else if (word === 'initializeGenomicElement') {
    return {
      contents: 'Initialize a genomic element.'
    };
  } else if (word === 'initializeRecombinationRate') {
    return {
      contents: 'Initialize the recombination rate.'
    };
  }

  return null;
});

connection.onDefinition((params) => {
  const document = documents.get(params.textDocument.uri);
  const position = params.position;
  const text = document.getText();
  const word = getWordAtPosition(text, position);

  if (word === 'initialize') {
    return {
      uri: params.textDocument.uri,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 }
      }
    };
  } else if (word === 'initializeSLiMOptions') {
    return {
      uri: params.textDocument.uri,
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 20 }
      }
    };
  }

  return null;
});

connection.onReferences((params) => {
  const document = documents.get(params.textDocument.uri);
  const position = params.position;
  const text = document.getText();
  const word = getWordAtPosition(text, position);

  const references = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    let match;
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    while ((match = regex.exec(line)) !== null) {
      references.push({
        uri: params.textDocument.uri,
        range: {
          start: { line: index, character: match.index },
          end: { line: index, character: match.index + word.length }
        }
      });
    }
  });

  return references;
});

connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
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

connection.onDocumentFormatting((params) => {
  const document = documents.get(params.textDocument.uri);
  const text = document.getText();
  const formattedText = formatText(text);

  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: document.lineCount, character: 0 }
      },
      newText: formattedText
    }
  ];
});

function formatText(text) {
  // Simple formatting example: trim trailing whitespace and ensure a newline at the end
  return text.split('\n').map(line => line.trimEnd()).join('\n') + '\n';
}

function getWordAtPosition(text, position) {
  const lines = text.split('\n');
  const line = lines[position.line];
  const words = line.split(/\s+/);
  return words.find(word => line.indexOf(word) <= position.character && line.indexOf(word) + word.length >= position.character);
}

connection.listen();
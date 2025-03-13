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

connection.listen();
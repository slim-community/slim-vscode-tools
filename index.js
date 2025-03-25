const path = require('path');
const vscode = require('vscode');
const fs = require('fs');
const tmp = require('tmp');

const {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} = require('vscode-languageclient/node');

const { DocTreeProvider } = require('./docTreeProvider');

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(path.join('server', 'index.js'));
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  };

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'slim' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
    }
  };

  client = new LanguageClient(
    'slimLanguageServer',
    'SLiM Language Server',
    serverOptions,
    clientOptions
  );

  client.start();

  // Register a data provider for the slimCommandsView
  const slimCommandsProvider = new SlimCommandsProvider();
  vscode.window.registerTreeDataProvider('slimCommandsView', slimCommandsProvider);

  // Create Status Bar Button
  let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(play) Run SLiM";
  statusBarItem.tooltip = "Run SLiM on the currently open file";
  statusBarItem.command = "slimTools.runSLiM";
  statusBarItem.show();

  // Register the SLiM execution command
  let runSlimCommand = vscode.commands.registerCommand('slimTools.runSLiM', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active SLiM file.");
      return;
    }

    // Get the SLiM interpreter path from user settings
    const config = vscode.workspace.getConfiguration('slimTools');
    const slimPath = config.get('slimInterpreterPath', 'slim'); // Default to "slim"

    const filePath = editor.document.fileName;

    // Run SLiM in a new terminal
    let terminal = vscode.window.createTerminal("SLiM Simulation");
    terminal.sendText(`${slimPath} "${filePath}"`);
    terminal.show();
  });

  // Register the DocTreeProvider
  const docTreeProvider = new DocTreeProvider(context);
  vscode.window.registerTreeDataProvider('docTreeView', docTreeProvider);

  const showDocCommand = vscode.commands.registerCommand('slimTools.showDocSection', async (title, docObj) => {
    let md = `# ${title}\n\n`;

    if (docObj.signature) {
      // Clean up weird whitespace
      const rawSig = Array.isArray(docObj.signature)
        ? docObj.signature.join('\n')
        : docObj.signature;
      const cleanedSig = rawSig.replace(/\u00a0/g, ' '); // replace non-breaking spaces with normal

      md += `**Signature**\n\n`;
      md += `\`\`\`cpp\n${cleanedSig}\n\`\`\`\n\n`;
    }

    if (docObj.description) {
      const cleanedDesc = docObj.description
        .replace(/\u00a0/g, ' ')
        .replace(/([.?!])\s+/g, '$1\n\n'); // turn long text into paragraphs
      md += `**Description**\n\n${cleanedDesc}\n\n`;
    }

    const tmpFile = tmp.fileSync({ postfix: '.md' });
    fs.writeFileSync(tmpFile.name, md);

    const doc = await vscode.workspace.openTextDocument(tmpFile.name);
    await vscode.commands.executeCommand('markdown.showPreviewToSide', doc.uri);
  });

  context.subscriptions.push(showDocCommand);





  // Register everything in the extension context
  context.subscriptions.push(runSlimCommand);
  context.subscriptions.push(statusBarItem);
}

function getDocHtml(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 1rem;
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
    }
    h2 {
      color: var(--vscode-editor-foreground);
    }
    pre {
      background-color: var(--vscode-editorGroupHeader-tabsBackground);
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
    }
    code {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      color: var(--vscode-editor-foreground);
    }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <pre><code>${escapeHtml(content)}</code></pre>
</body>
</html>`;
}

// Escape special HTML characters
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function deactivate() {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

class SlimCommandsProvider {
  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      const runSlimCommand = new vscode.TreeItem('Run SLiM');
      runSlimCommand.command = {
        command: 'slimTools.runSLiM',
        title: 'Run SLiM',
        tooltip: 'Run SLiM on the currently open file'
      };
      runSlimCommand.iconPath = new vscode.ThemeIcon('play');
      return [runSlimCommand];
    }
    return [];
  }
}

module.exports = {
  activate,
  deactivate
};

const path = require('path');
const vscode = require('vscode');
const {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} = require('vscode-languageclient/node');

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

  // Register everything in the extension context
  context.subscriptions.push(runSlimCommand);
  context.subscriptions.push(statusBarItem);
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

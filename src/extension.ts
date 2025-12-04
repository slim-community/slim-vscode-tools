import * as path from 'path';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import {
    workspace,
    ExtensionContext,
    window,
    commands,
    StatusBarAlignment,
    TreeItem,
    ThemeIcon,
} from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

import { DocTreeProvider } from './docTreeProvider';
import { DocSection } from './types';

let client: LanguageClient;

// Constants for temp file management
const MAX_TEMP_FILES = 5;
const TEMP_FILE_CLEANUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function activate(context: ExtensionContext) {

    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('out', 'server', 'index.js'));

    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions,
        },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for SLiM and Eidos files
        documentSelector: [       
            { scheme: 'file', language: 'slim' },
            { scheme: 'file', language: 'eidos' }
        ],
        synchronize: {
            // Notify the server about file changes to '.slim/.eidos' files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/*.{slim,eidos}'),
            // Sync configuration changes to the server
            configurationSection: 'slimTools'
        },
        initializationOptions: {
            // Pass initial configuration to server
            formatting: workspace.getConfiguration('slimTools.formatting')
        }
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'slimLanguageServer',
        'SLiM Language Server',
        serverOptions,
        clientOptions
    );

    // Start the client
    client.start();

    // Register a data provider for the slimCommandsView with dynamic updates
    const slimCommandsProvider = new SlimCommandsProvider();
    window.registerTreeDataProvider('slimCommandsView', slimCommandsProvider);
    
    // Update sidebar view when active editor changes
    window.onDidChangeActiveTextEditor(() => {
        slimCommandsProvider.refresh();
    });

    // Create Status Bar Button - dynamically updates based on active file
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    
    const updateStatusBar = () => {
        const editor = window.activeTextEditor;
        if (editor) {
            const isEidosFile = editor.document.fileName.endsWith('.eidos');
            const isSlimFile = editor.document.fileName.endsWith('.slim');
            
            if (isEidosFile || isSlimFile) {
                statusBarItem.text = isEidosFile ? '$(play) Run Eidos' : '$(play) Run SLiM';
                statusBarItem.tooltip = isEidosFile 
                    ? 'Run Eidos on the currently open file' 
                    : 'Run SLiM on the currently open file';
                statusBarItem.show();
            } else {
                statusBarItem.hide();
            }
        } else {
            statusBarItem.hide();
        }
    };
    
    statusBarItem.command = 'slimTools.runSLiM';
    updateStatusBar();
    
    // Update status bar when active editor changes
    window.onDidChangeActiveTextEditor(updateStatusBar);
    context.subscriptions.push(statusBarItem);

    // Register the SLiM/Eidos execution command
    const runSlimCommand = commands.registerCommand('slimTools.runSLiM', () => {
        const editor = window.activeTextEditor;
        if (!editor) {
            window.showErrorMessage('No active SLiM or Eidos file.');
            return;
        }

        const filePath = editor.document.fileName;
        const isEidosFile = filePath.endsWith('.eidos');
        
        // Get the interpreter path from user settings
        const config = workspace.getConfiguration('slimTools');
        const interpreterPath = config.get<string>('slimInterpreterPath', 'slim');

        // If it's an Eidos file, try to use 'eidos' command:
        let command = interpreterPath;
        if (isEidosFile) {
            if (interpreterPath === 'slim') {
                command = 'eidos';
            } else if (interpreterPath.endsWith('slim')) {
                command = interpreterPath.slice(0, -4) + 'eidos';
            } else if (interpreterPath.endsWith('slim.exe')) {
                command = interpreterPath.slice(0, -8) + 'eidos.exe';
            }
            // Otherwise keep the configured path (user may have custom setup)
        }
        const terminalName = isEidosFile ? 'Eidos Interpreter' : 'SLiM Simulation';

        // Run in a new terminal
        const terminal = window.createTerminal(terminalName);
        terminal.sendText(`${command} "${filePath}"`);
        terminal.show();
    });

    // Register the DocTreeProvider
    const docTreeProvider = new DocTreeProvider(context);
    window.registerTreeDataProvider('docTreeView', docTreeProvider);

    // Track temporary files for cleanup
    interface TempFileEntry {
        file: tmp.FileResult;
        timer: NodeJS.Timeout;
    }
    const tempFiles: TempFileEntry[] = [];
    
    // Helper function to cleanup a temp file safely
    const cleanupTempFile = (entry: TempFileEntry) => {
        clearTimeout(entry.timer);
        try {
            entry.file.removeCallback();
        } catch (error) {
            // Log but don't throw - file may already be deleted
            console.warn('Failed to cleanup temp file:', error);
        }
    };
    
    // Helper function to cleanup oldest temp files beyond limit
    const cleanupExcessTempFiles = () => {
        while (tempFiles.length > MAX_TEMP_FILES) {
            const oldEntry = tempFiles.shift();
            if (oldEntry) {
                cleanupTempFile(oldEntry);
            }
        }
    };
    
    // Register command to show documentation sections
    const showDocCommand = commands.registerCommand(
        'slimTools.showDocSection',
        async (title: string, docObj: DocSection) => {
            let md = `# ${title}\n\n`;

            if (docObj.signature || docObj.signatures) {
                // Handle both singular (classes/callbacks) and plural (functions)
                const rawSig = docObj.signatures 
                    ? docObj.signatures.join('\n')
                    : (docObj.signature || '');
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

            try {
                const tmpFile = tmp.fileSync({ postfix: '.md', keep: false });
                fs.writeFileSync(tmpFile.name, md);

                const doc = await workspace.openTextDocument(tmpFile.name);
                await commands.executeCommand('markdown.showPreviewToSide', doc.uri);
                
                // Set up auto-cleanup timer for this file
                const timer = setTimeout(() => {
                    const index = tempFiles.findIndex(entry => entry.file === tmpFile);
                    if (index !== -1) {
                        const entry = tempFiles.splice(index, 1)[0];
                        cleanupTempFile(entry);
                    }
                }, TEMP_FILE_CLEANUP_TIMEOUT_MS);
                
                tempFiles.push({ file: tmpFile, timer });
                
                // Cleanup oldest files if we exceed the limit
                cleanupExcessTempFiles();
            } catch (error) {
                window.showErrorMessage(`Failed to create documentation preview: ${error}`);
                console.error('Error creating temp file for documentation:', error);
            }
        }
    );

    // Cleanup temp files on deactivation
    context.subscriptions.push(
        runSlimCommand,
        showDocCommand,
        {
            dispose: () => {
                // Clean up all remaining temp files
                tempFiles.forEach(entry => {
                    cleanupTempFile(entry);
                });
                tempFiles.length = 0;
            }
        }
    );
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

// SlimCommandsProvider class - dynamically shows Run SLiM or Run Eidos based on active file
class SlimCommandsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            const editor = window.activeTextEditor;
            const isEidosFile = editor?.document.fileName.endsWith('.eidos');
            const isSlimFile = editor?.document.fileName.endsWith('.slim');
            
            // If no relevant file is open, show both options
            if (!isEidosFile && !isSlimFile) {
                const runSlimItem = new TreeItem('Run SLiM');
                runSlimItem.command = {
                    command: 'slimTools.runSLiM',
                    title: 'Run SLiM',
                    tooltip: 'Run SLiM on the currently open file',
                };
                runSlimItem.iconPath = new ThemeIcon('play');

                const runEidosItem = new TreeItem('Run Eidos');
                runEidosItem.command = {
                    command: 'slimTools.runSLiM',
                    title: 'Run Eidos',
                    tooltip: 'Run Eidos on the currently open file',
                };
                runEidosItem.iconPath = new ThemeIcon('play');

                return Promise.resolve([runSlimItem, runEidosItem]);
            }
            
            // Show appropriate command for current file
            const commandLabel = isEidosFile ? 'Run Eidos' : 'Run SLiM';
            const commandTooltip = isEidosFile 
                ? 'Run Eidos on the currently open file'
                : 'Run SLiM on the currently open file';
            
            const runCommand = new TreeItem(commandLabel);
            runCommand.command = {
                command: 'slimTools.runSLiM',
                title: commandLabel,
                tooltip: commandTooltip,
            };
            runCommand.iconPath = new ThemeIcon('play');
            return Promise.resolve([runCommand]);
        }
        return Promise.resolve([]);
    }
}

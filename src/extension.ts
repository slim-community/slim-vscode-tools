import * as path from 'path';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import {
    workspace,
    ExtensionContext,
    window,
    commands,
    ViewColumn,
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

// Update paths for all documentation files
const slimFunctionsPath = path.join(__dirname, '../../docs/slim_functions.json');
const eidosFunctionsPath = path.join(__dirname, '../../docs/eidos_functions.json');
const slimClassesPath = path.join(__dirname, '../../docs/slim_classes.json');
const eidosClassesPath = path.join(__dirname, '../../docs/eidos_classes.json');

// Update type definitions to match the new documentation structure
interface MethodInfo {
    signature: string;
    description: string;
}

interface PropertyInfo {
    type: string;
    description: string;
}

interface ClassInfo {
    constructor: {
        signature?: string;
        description?: string;
    };
    methods: { [key: string]: MethodInfo };
    properties: { [key: string]: PropertyInfo };
}

interface DocSection {
    signature?: string | string[];
    description?: string;
    [key: string]: any;
}

// Update data stores
let functionsData: { [key: string]: { signature: string; description: string } } = {};
let classesData: { [key: string]: ClassInfo } = {};

// Load all documentation files
function loadDocumentation() {
    try {
        if (fs.existsSync(slimFunctionsPath)) {
            const slimFunctions = JSON.parse(fs.readFileSync(slimFunctionsPath, 'utf8'));
            functionsData = { ...functionsData, ...slimFunctions };
        }
        if (fs.existsSync(eidosFunctionsPath)) {
            const eidosFunctions = JSON.parse(fs.readFileSync(eidosFunctionsPath, 'utf8'));
            functionsData = { ...functionsData, ...eidosFunctions };
        }
        if (fs.existsSync(slimClassesPath)) {
            const slimClasses = JSON.parse(fs.readFileSync(slimClassesPath, 'utf8'));
            classesData = { ...classesData, ...slimClasses };
        }
        if (fs.existsSync(eidosClassesPath)) {
            const eidosClasses = JSON.parse(fs.readFileSync(eidosClassesPath, 'utf8'));
            classesData = { ...classesData, ...eidosClasses };
        }
        console.log('✅ Extension loaded documentation successfully');
    } catch (error) {
        console.error('❌ Error loading documentation:', error);
    }
}

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // Load documentation first
    loadDocumentation();

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
        documentSelector: [{ scheme: 'file', language: 'slim' }],
        synchronize: {
            // Notify the server about file changes to '.slim' files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc'),
        },
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

    // Register a data provider for the slimCommandsView
    const slimCommandsProvider = new SlimCommandsProvider();
    window.registerTreeDataProvider('slimCommandsView', slimCommandsProvider);

    // Create Status Bar Button
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(play) Run SLiM';
    statusBarItem.tooltip = 'Run SLiM on the currently open file';
    statusBarItem.command = 'slimTools.runSLiM';
    statusBarItem.show();

    // Register the SLiM execution command
    const runSlimCommand = commands.registerCommand('slimTools.runSLiM', () => {
        const editor = window.activeTextEditor;
        if (!editor) {
            window.showErrorMessage('No active SLiM file.');
            return;
        }

        // Get the SLiM interpreter path from user settings
        const config = workspace.getConfiguration('slimTools');
        const slimPath = config.get<string>('slimInterpreterPath', 'slim'); // Default to "slim"

        const filePath = editor.document.fileName;

        // Run SLiM in a new terminal
        const terminal = window.createTerminal('SLiM Simulation');
        terminal.sendText(`${slimPath} "${filePath}"`);
        terminal.show();
    });

    // Register the DocTreeProvider
    const docTreeProvider = new DocTreeProvider(context);
    window.registerTreeDataProvider('docTreeView', docTreeProvider);

    // Register command to show documentation sections
    const showDocCommand = commands.registerCommand(
        'slimTools.showDocSection',
        async (title: string, docObj: DocSection) => {
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

            const doc = await workspace.openTextDocument(tmpFile.name);
            await commands.executeCommand('markdown.showPreviewToSide', doc.uri);
        }
    );

    // Register command to show function documentation
    const showFunctionDocCommand = commands.registerCommand(
        'slimTools.showFunctionDoc',
        (functionName: string) => {
            const functionInfo = functionsData[functionName];
            if (functionInfo) {
                const panel = window.createWebviewPanel(
                    'functionDoc',
                    `Documentation: ${functionName}`,
                    window.activeTextEditor?.viewColumn || ViewColumn.Active,
                    {}
                );

                panel.webview.html = `
                <h1>${functionName}</h1>
                <pre>${functionInfo.signature}</pre>
                <p>${functionInfo.description}</p>
            `;
            }
        }
    );

    // Register everything in the extension context
    context.subscriptions.push(
        runSlimCommand,
        statusBarItem,
        showDocCommand,
        showFunctionDocCommand
    );
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

// SlimCommandsProvider class
class SlimCommandsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            const runSlimCommand = new TreeItem('Run SLiM');
            runSlimCommand.command = {
                command: 'slimTools.runSLiM',
                title: 'Run SLiM',
                tooltip: 'Run SLiM on the currently open file',
            };
            runSlimCommand.iconPath = new ThemeIcon('play');
            return Promise.resolve([runSlimCommand]);
        }
        return Promise.resolve([]);
    }
}

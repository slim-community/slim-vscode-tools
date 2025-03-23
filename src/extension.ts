import * as path from 'path';
import * as fs from 'fs';
import {
    workspace,
    ExtensionContext,
    window,
    commands,
    ViewColumn
} from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

// Update paths for all documentation files
const slimFunctionsPath = path.join(__dirname, "../docs/slim_functions.json");
const eidosFunctionsPath = path.join(__dirname, "../docs/eidos_functions.json");
const slimClassesPath = path.join(__dirname, "../docs/slim_classes.json");
const eidosClassesPath = path.join(__dirname, "../docs/eidos_classes.json");

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

// Update data stores
let functionsData: { [key: string]: { signature: string; description: string } } = {};
let classesData: { [key: string]: ClassInfo } = {};

// Load all documentation files
function loadDocumentation() {
    try {
        if (fs.existsSync(slimFunctionsPath)) {
            const slimFunctions = JSON.parse(fs.readFileSync(slimFunctionsPath, "utf8"));
            functionsData = { ...functionsData, ...slimFunctions };
        }
        if (fs.existsSync(eidosFunctionsPath)) {
            const eidosFunctions = JSON.parse(fs.readFileSync(eidosFunctionsPath, "utf8"));
            functionsData = { ...functionsData, ...eidosFunctions };
        }
        if (fs.existsSync(slimClassesPath)) {
            const slimClasses = JSON.parse(fs.readFileSync(slimClassesPath, "utf8"));
            classesData = { ...classesData, ...slimClasses };
        }
        if (fs.existsSync(eidosClassesPath)) {
            const eidosClasses = JSON.parse(fs.readFileSync(eidosClassesPath, "utf8"));
            classesData = { ...classesData, ...eidosClasses };
        }
        console.log("✅ Extension loaded documentation successfully");
    } catch (error) {
        console.error("❌ Error loading documentation:", error);
    }
}

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // Load documentation first
    loadDocumentation();

    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        path.join('server', 'index.js')
    );

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
            options: debugOptions
        }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for SLiM and Eidos files
        documentSelector: [
            { scheme: 'file', language: 'slim' },
            { scheme: 'file', language: 'eidos' }
        ],
        synchronize: {
            // Notify the server about file changes to '.slim' files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/*.{slim,eidos}')
        }
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'slimLanguageServer',
        'SLiM Language Server',
        serverOptions,
        clientOptions
    );

    // Register command to show function documentation
    let disposable = commands.registerCommand('slimTools.showFunctionDoc', (functionName: string) => {
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
    });

    context.subscriptions.push(disposable);

    // Start the client. This will also launch the server
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

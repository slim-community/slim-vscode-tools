import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";

const functionDocsPath = path.join(__dirname, "../docs/slim_function_docs.json");
let functionDocs: { [key: string]: { signature: string; description: string } } = {};

// Load function documentation if the file exists
if (fs.existsSync(functionDocsPath)) {
    functionDocs = JSON.parse(fs.readFileSync(functionDocsPath, "utf8"));
    console.log("✅ Loaded function documentation successfully.");
} else {
    console.error("❌ ERROR: slim_function_docs.json not found!");
}

console.log('Available functions:', Object.keys(functionDocs));
console.log('Extension loaded functions:', Object.keys(functionDocs));

export function activate(context: vscode.ExtensionContext) {
    console.log('Activating extension with functions:', Object.keys(functionDocs));

    // Register a command to show function documentation
    const docCommand = vscode.commands.registerCommand('slimTools.showFunctionDoc', (functionName: string) => {
        console.log('Command executed with function:', functionName);
        
        // Check if the function name exists in our documentation
        if (!functionDocs[functionName]) {
            console.log(`Function not found: ${functionName}`);
            console.log('Available functions:', Object.keys(functionDocs));
            vscode.window.showErrorMessage(`No documentation found for: ${functionName}`);
            return;
        }
        
        const doc = functionDocs[functionName];
        console.log(`Creating webview for: ${functionName}`);
        
        try {
            // Create and show a webview panel
            const panel = vscode.window.createWebviewPanel(
                'slimFunctionDoc',
                `SLiM: ${functionName}`,
                vscode.ViewColumn.One,
                { enableScripts: false }
            );

            // Set the content
            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${functionName}</title>
                    <style>
                        body { font-family: var(--vscode-editor-font-family); margin: 16px; }
                        pre { background-color: var(--vscode-editor-background); padding: 12px; border-radius: 4px; }
                        h1 { color: var(--vscode-editor-foreground); }
                    </style>
                </head>
                <body>
                    <h1>${functionName}</h1>
                    <pre>${doc.signature}</pre>
                    <div>${doc.description.replace(/\n/g, '<br>')}</div>
                </body>
                </html>
            `;
            
            console.log('Webview created successfully');
        } catch (error) {
            console.error('Error creating webview:', error);
            vscode.window.showErrorMessage(`Error showing documentation: ${error}`);
        }
    });

    context.subscriptions.push(docCommand);

    // Register the language client for other features
    const serverModule = context.asAbsolutePath(path.join("server", "index.js"));
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "file", language: "slim" }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.slim')
        }
    };

    const client = new LanguageClient(
        'slimTools',
        'SLiM Language Server',
        serverOptions,
        clientOptions
    );

    // Start the client and set up notification handler
    client.start().then(() => {
        console.log('Client started, setting up notification handler');
        
        // Listen for the custom notification
        client.onNotification('custom/showFunctionDoc', (params: { functionName: string }) => {
            console.log('Received custom notification for:', params.functionName);
            vscode.commands.executeCommand('slimTools.showFunctionDoc', params.functionName);
        });
        
        console.log('Notification handler set up');
    });
    
    // Add the client to subscriptions for proper disposal
    context.subscriptions.push(client);
}

function formatDocumentation(name: string, doc: any): string {
    return `# ${name}\n\n\`\`\`slim\n${doc.signature}\n\`\`\`\n\n${doc.description}`;
}

// ✅ Webview function to show documentation
function showFunctionWebview(functionName: string) {
    const doc = functionDocs[functionName];

    const panel = vscode.window.createWebviewPanel(
        "slimFunctionDocs",
        `SLiM: ${functionName}`,
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${functionName} Documentation</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>${functionName}</h1>
            <pre>${functionDocs[functionName].signature}</pre>
            <p>${functionDocs[functionName].description}</p>
        </body>
        </html>
    `;
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const node_1 = require("vscode-languageclient/node");
const functionDocsPath = path.join(__dirname, "../docs/slim_function_docs.json");
let functionDocs = {};
// Load function documentation if the file exists
if (fs.existsSync(functionDocsPath)) {
    functionDocs = JSON.parse(fs.readFileSync(functionDocsPath, "utf8"));
    console.log("✅ Loaded function documentation successfully.");
}
else {
    console.error("❌ ERROR: slim_function_docs.json not found!");
}
console.log('Available functions:', Object.keys(functionDocs));
console.log('Extension loaded functions:', Object.keys(functionDocs));
function activate(context) {
    console.log('Activating extension with functions:', Object.keys(functionDocs));
    // Register a command to show function documentation
    const docCommand = vscode.commands.registerCommand('slimTools.showFunctionDoc', (functionName) => {
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
            const panel = vscode.window.createWebviewPanel('slimFunctionDoc', `SLiM: ${functionName}`, vscode.ViewColumn.One, { enableScripts: false });
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
        }
        catch (error) {
            console.error('Error creating webview:', error);
            vscode.window.showErrorMessage(`Error showing documentation: ${error}`);
        }
    });
    context.subscriptions.push(docCommand);
    // Register the language client for other features
    const serverModule = context.asAbsolutePath(path.join("server", "index.js"));
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: { module: serverModule, transport: node_1.TransportKind.ipc }
    };
    const clientOptions = {
        documentSelector: [{ scheme: "file", language: "slim" }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.slim')
        }
    };
    const client = new node_1.LanguageClient('slimTools', 'SLiM Language Server', serverOptions, clientOptions);
    // Start the client and set up notification handler
    client.start().then(() => {
        console.log('Client started, setting up notification handler');
        // Listen for the custom notification
        client.onNotification('custom/showFunctionDoc', (params) => {
            console.log('Received custom notification for:', params.functionName);
            vscode.commands.executeCommand('slimTools.showFunctionDoc', params.functionName);
        });
        console.log('Notification handler set up');
    });
    // Add the client to subscriptions for proper disposal
    context.subscriptions.push(client);
}
function formatDocumentation(name, doc) {
    return `# ${name}\n\n\`\`\`slim\n${doc.signature}\n\`\`\`\n\n${doc.description}`;
}
// ✅ Webview function to show documentation
function showFunctionWebview(functionName) {
    const doc = functionDocs[functionName];
    const panel = vscode.window.createWebviewPanel("slimFunctionDocs", `SLiM: ${functionName}`, vscode.ViewColumn.One, { enableScripts: true });
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

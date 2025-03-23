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
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
// Update paths for all documentation files
const slimFunctionsPath = path.join(__dirname, "../docs/slim_functions.json");
const eidosFunctionsPath = path.join(__dirname, "../docs/eidos_functions.json");
const slimClassesPath = path.join(__dirname, "../docs/slim_classes.json");
const eidosClassesPath = path.join(__dirname, "../docs/eidos_classes.json");
// Update data stores
let functionsData = {};
let classesData = {};
// Load all documentation files
function loadDocumentation() {
    try {
        if (fs.existsSync(slimFunctionsPath)) {
            const slimFunctions = JSON.parse(fs.readFileSync(slimFunctionsPath, "utf8"));
            functionsData = Object.assign(Object.assign({}, functionsData), slimFunctions);
        }
        if (fs.existsSync(eidosFunctionsPath)) {
            const eidosFunctions = JSON.parse(fs.readFileSync(eidosFunctionsPath, "utf8"));
            functionsData = Object.assign(Object.assign({}, functionsData), eidosFunctions);
        }
        if (fs.existsSync(slimClassesPath)) {
            const slimClasses = JSON.parse(fs.readFileSync(slimClassesPath, "utf8"));
            classesData = Object.assign(Object.assign({}, classesData), slimClasses);
        }
        if (fs.existsSync(eidosClassesPath)) {
            const eidosClasses = JSON.parse(fs.readFileSync(eidosClassesPath, "utf8"));
            classesData = Object.assign(Object.assign({}, classesData), eidosClasses);
        }
        console.log("✅ Extension loaded documentation successfully");
    }
    catch (error) {
        console.error("❌ Error loading documentation:", error);
    }
}
let client;
function activate(context) {
    // Load documentation first
    loadDocumentation();
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('server', 'index.js'));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for SLiM and Eidos files
        documentSelector: [
            { scheme: 'file', language: 'slim' },
            { scheme: 'file', language: 'eidos' }
        ],
        synchronize: {
            // Notify the server about file changes to '.slim' files contained in the workspace
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/*.{slim,eidos}')
        }
    };
    // Create the language client and start the client.
    client = new node_1.LanguageClient('slimLanguageServer', 'SLiM Language Server', serverOptions, clientOptions);
    // Register command to show function documentation
    let disposable = vscode_1.commands.registerCommand('slimTools.showFunctionDoc', (functionName) => {
        var _a;
        const functionInfo = functionsData[functionName];
        if (functionInfo) {
            const panel = vscode_1.window.createWebviewPanel('functionDoc', `Documentation: ${functionName}`, ((_a = vscode_1.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.viewColumn) || vscode_1.ViewColumn.Active, {});
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
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

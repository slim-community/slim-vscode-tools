import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    DiagnosticSeverity,
    InitializeResult,
    TextDocumentSyncKind,
    Diagnostic,
    CompletionItem,
    CompletionItemKind,
    Hover,
    MarkupKind,
    SignatureHelp,
    Location,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as path from 'path';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Load both function and class documentation
const slimFunctionsPath = path.join(__dirname, '../..', 'docs', 'slim_functions.json');
const eidosFunctionsPath = path.join(__dirname, '../..', 'docs', 'eidos_functions.json');
const slimClassesPath = path.join(__dirname, '../..', 'docs', 'slim_classes.json');
const eidosClassesPath = path.join(__dirname, '../..', 'docs', 'eidos_classes.json');
const slimCallbacksPath = path.join(__dirname, '../..', 'docs', 'slim_callbacks.json');
const eidosTypesPath = path.join(__dirname, '../..', 'docs', 'eidos_types.json');

// Type definitions
interface FunctionInfo {
    signature: string;
    signatures: string[];
    description: string;
    returnType: string;
    source: string;
}

interface MethodInfo {
    signature: string;
    description: string;
}

interface PropertyInfo {
    type: string;
    description: string;
}

interface ClassInfo {
    constructor?: {
        signature?: string;
        description?: string;
    };
    methods?: { [key: string]: MethodInfo };
    properties?: { [key: string]: PropertyInfo };
}

interface CallbackInfo {
    signature: string;
    description: string;
}

interface TypeInfo {
    description: string;
}

interface WordContext {
    isMethodOrProperty: boolean;
    className?: string;
    instanceName?: string;
    instanceClass?: string;
}

interface WordInfo {
    word: string;
    context: WordContext;
}

interface ConstructorInfo {
    signature: string;
    description: string;
}

let functionsData: { [key: string]: FunctionInfo } = {};
let classesData: { [key: string]: ClassInfo } = {};
let callbacksData: { [key: string]: CallbackInfo } = {};
let typesData: { [key: string]: TypeInfo } = {};

// Load all documentation files
function loadDocumentation(): void {
    try {
        if (fs.existsSync(slimFunctionsPath)) {
            const slimFunctions = JSON.parse(fs.readFileSync(slimFunctionsPath, 'utf8'));
            functionsData = { ...functionsData, ...flattenFunctionData(slimFunctions, 'SLiM') };
            console.log('Loaded slim functions:', Object.keys(functionsData));
        }
        if (fs.existsSync(eidosFunctionsPath)) {
            const eidosFunctions = JSON.parse(fs.readFileSync(eidosFunctionsPath, 'utf8'));
            functionsData = { ...functionsData, ...flattenFunctionData(eidosFunctions, 'Eidos') };
            console.log('Loaded eidos functions:', Object.keys(functionsData));
        }
        if (fs.existsSync(slimClassesPath)) {
            const slimClasses = JSON.parse(fs.readFileSync(slimClassesPath, 'utf8'));
            classesData = { ...classesData, ...slimClasses };
            console.log('Loaded slim classes:', Object.keys(classesData));
        }
        if (fs.existsSync(eidosClassesPath)) {
            const eidosClasses = JSON.parse(fs.readFileSync(eidosClassesPath, 'utf8'));
            classesData = { ...classesData, ...eidosClasses };
            console.log('Loaded eidos classes:', Object.keys(classesData));
        }
        if (fs.existsSync(slimCallbacksPath)) {
            const slimCallbacks = JSON.parse(fs.readFileSync(slimCallbacksPath, 'utf8'));
            callbacksData = { ...callbacksData, ...flattenCallbackData(slimCallbacks) };
            console.log('Loaded slim callbacks:', Object.keys(callbacksData));
        }
        if (fs.existsSync(eidosTypesPath)) {
            typesData = JSON.parse(fs.readFileSync(eidosTypesPath, 'utf8'));
            console.log('Loaded eidos types:', Object.keys(typesData));
        }
        console.log('✅ Server loaded documentation successfully');
    } catch (error) {
        console.error('❌ Error loading documentation:', error);
    }
}

function flattenFunctionData(data: any, source: string): { [key: string]: FunctionInfo } {
    const flattened: { [key: string]: FunctionInfo } = {};
    for (const category in data) {
        if (data.hasOwnProperty(category)) {
            const functions = data[category];
            for (const funcName in functions) {
                if (functions.hasOwnProperty(funcName)) {
                    const funcData = functions[funcName];
                    const signature = funcData.signatures[0]; // Assuming the first signature is the main one
                    const returnTypeMatch = signature.match(/^\(([^)]+)\)/);
                    const returnType = returnTypeMatch ? returnTypeMatch[1] : 'void';
                    const signatureWithoutReturnType = signature.replace(/^\([^)]+\)\s*/, '');
                    flattened[funcName] = {
                        ...funcData,
                        signature: signatureWithoutReturnType,
                        returnType: returnType,
                        source: source,
                    };
                }
            }
        }
    }
    return flattened;
}

function flattenCallbackData(data: any): { [key: string]: CallbackInfo } {
    const flattened: { [key: string]: CallbackInfo } = {};
    for (const callbackName in data) {
        if (data.hasOwnProperty(callbackName)) {
            const callbackData = data[callbackName];
            flattened[callbackName] = {
                ...callbackData,
                signature: callbackData.signature.replace(/\s+(callbacks|events)$/, ''),
            };
        }
    }
    return flattened;
}

loadDocumentation();

const instanceToClassMap: { [key: string]: string } = {
    sim: 'Species',
    // Add other known instances and their corresponding classes here
};

let instanceDefinitions: { [key: string]: string } = {};

function trackInstanceDefinitions(text: string): void {
    const lines = text.split('\n');
    const instanceRegex = /(\w+)\s*=\s*new\s+(\w+)/; // Example: p1 = new Subpopulation
    const subpopRegex = /sim\.addSubpop\("(\w+)",\s*\d+(?:,\s*[^)]*)?\)/; // Example: sim.addSubpop("p1", 100)
    const subpopSplitRegex = /sim\.addSubpopSplit\("(\w+)",\s*\d+(?:,\s*[^)]*)?\)/; // Example: sim.addSubpopSplit("p1", 100, ...)
    const earlyEventRegex = /community\.registerEarlyEvent\("(\w+)",\s*[^)]*\)/;
    const firstEventRegex = /community\.registerFirstEvent\("(\w+)",\s*[^)]*\)/;
    const interactionCallbackRegex = /community\.registerInteractionCallback\("(\w+)",\s*[^)]*\)/;
    const lateEventRegex = /community\.registerLateEvent\("(\w+)",\s*[^)]*\)/;
    const fitnessEffectCallbackRegex = /species\.registerFitnessEffectCallback\("(\w+)",\s*[^)]*\)/;
    const mateChoiceCallbackRegex = /species\.registerMateChoiceCallback\("(\w+)",\s*[^)]*\)/;
    const modifyChildCallbackRegex = /species\.registerModifyChildCallback\("(\w+)",\s*[^)]*\)/;
    const mutationCallbackRegex = /species\.registerMutationCallback\("(\w+)",\s*[^)]*\)/;
    const mutationEffectCallbackRegex =
        /species\.registerMutationEffectCallback\("(\w+)",\s*[^)]*\)/;
    const recombinationCallbackRegex = /species\.registerRecombinationCallback\("(\w+)",\s*[^)]*\)/;
    const reproductionCallbackRegex = /species\.registerReproductionCallback\("(\w+)",\s*[^)]*\)/;
    const survivalCallbackRegex = /species\.registerSurvivalCallback\("(\w+)",\s*[^)]*\)/;

    lines.forEach((line) => {
        let match: RegExpMatchArray | null;
        switch (true) {
            case (match = line.match(instanceRegex)) !== null:
                instanceDefinitions[match![1]] = match![2];
                break;
            case (match = line.match(subpopRegex)) !== null:
                instanceDefinitions[match![1]] = 'Subpopulation';
                break;
            case (match = line.match(subpopSplitRegex)) !== null:
                instanceDefinitions[match![1]] = 'Subpopulation';
                break;
            case (match = line.match(earlyEventRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(firstEventRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(interactionCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(lateEventRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(fitnessEffectCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(mateChoiceCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(modifyChildCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(mutationCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(mutationEffectCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(recombinationCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(reproductionCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(survivalCallbackRegex)) !== null:
                instanceDefinitions[match![1]] = 'SLiMEidosBlock';
                break;
        }
    });
}

documents.listen(connection);

connection.onInitialize(() => {
    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.'],
            },
            hoverProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            documentFormattingProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',', ' '],
                retriggerCharacters: [',', ')'],
            },
        },
    };
    return result;
});

connection.onInitialized(() => {
    connection.console.log('SLiM Language Server initialized');
});

documents.onDidChangeContent((change) => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    let braceCount = 0;
    let lastOpenBraceLine = -1;
    let parenBalance = 0;

    lines.forEach((line, lineIndex) => {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith('//')) {
            return;
        }

        const isSlimBlock =
            /^\d+\s+\w+\(\)/.test(trimmedLine) || /^s\d+\s+\d+\s+\w+\(\)/.test(trimmedLine);

        const openBracesInLine = (line.match(/{/g) || []).length;
        const closeBracesInLine = (line.match(/}/g) || []).length;

        braceCount += openBracesInLine - closeBracesInLine;

        if (openBracesInLine > 0) {
            lastOpenBraceLine = lineIndex;
        }

        if (braceCount < 0 && !isSlimBlock) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineIndex, character: 0 },
                    end: { line: lineIndex, character: line.length },
                },
                message: 'Unexpected closing brace',
                source: 'slim-tools',
            });
        }

        const result = shouldHaveSemicolon(trimmedLine, parenBalance);
        parenBalance = result.parenBalance;

        if (result.shouldMark) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineIndex, character: 0 },
                    end: { line: lineIndex, character: line.length },
                },
                message: 'Statement might be missing a semicolon',
                source: 'slim-tools',
            });
        }
    });

    if (braceCount > 0) {
        const lastLine = lines[lines.length - 1].trim();
        const isCompleteBlock = lastLine === '}';

        if (!isCompleteBlock) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lastOpenBraceLine, character: 0 },
                    end: { line: lastOpenBraceLine, character: lines[lastOpenBraceLine].length },
                },
                message: 'Unclosed brace(s)',
                source: 'slim-tools',
            });
        }
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function shouldHaveSemicolon(
    line: string,
    parenBalance: number = 0
): { shouldMark: boolean; parenBalance: number } {
    const strings: string[] = [];
    const codeWithPlaceholders = line.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
        strings.push(match);
        return `__STRING${strings.length - 1}__`;
    });

    const codeOnly = codeWithPlaceholders
        .replace(/\/\/.*$/, '')
        .replace(/\/\*.*?\*\//g, '')
        .trim();

    const restoredCode = strings.reduce(
        (code, str, i) => code.replace(`__STRING${i}__`, str),
        codeOnly
    );

    const openParens = (restoredCode.match(/\(/g) || []).length;
    const closeParens = (restoredCode.match(/\)/g) || []).length;
    const netParens = parenBalance + openParens - closeParens;

    const isDefinitelySafe =
        restoredCode.endsWith(';') ||
        restoredCode.endsWith('{') ||
        restoredCode.endsWith('}') ||
        netParens > 0 ||
        /^\s*(if|else|while|for|switch|case|default)\b.*\)?\s*{?\s*$/.test(restoredCode) ||
        /^(initialize|early|late|fitness)\s*\([^)]*\)\s*{?\s*$/.test(restoredCode) ||
        /^\s*(s\d+\s+)?\d+\s+(early|late|reproduction|fitness)\s*\(\)\s*$/.test(restoredCode) ||
        /^\s*\/[\/\*]/.test(line) ||
        /^\s*\*/.test(line) ||
        /^\s*$/.test(line);

    return {
        shouldMark: !isDefinitelySafe && netParens === 0,
        parenBalance: netParens,
    };
}

connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const symbols: any[] = [];

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
                        end: { line: index, character: line.length },
                    },
                },
            });
        }
    });

    return symbols;
});

connection.onHover((params): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const position = params.position;
    const text = document.getText();
    trackInstanceDefinitions(text);
    const wordInfo = getWordAndContextAtPosition(text, position);
    console.log('Hover triggered at position:', position);
    console.log('Word info:', wordInfo);
    if (!wordInfo) return null;

    const { word, context } = wordInfo;

    // Check if it's an instance
    if (context.instanceClass) {
        const markdown = `**${word}** (instance of ${context.instanceClass})`;
        console.log('Hover content:', markdown);
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: markdown,
            },
        };
    }

    // Check if it's a method or property of a known instance
    if (
        context.isMethodOrProperty &&
        context.className &&
        (instanceToClassMap[context.className] || classesData[context.className])
    ) {
        const className = instanceToClassMap[context.className] || context.className;
        if (classesData[className]) {
            // Check methods
            if (classesData[className].methods && classesData[className].methods![word]) {
                const methodInfo = classesData[className].methods![word];
                const markdown = `**${className}.${word}** (method)\n\`\`\`slim\n${methodInfo.signature}\n\`\`\`\n\n${methodInfo.description}`;
                console.log('Hover content:', markdown);
                return {
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: markdown,
                    },
                };
            }
            // Check properties
            if (classesData[className].properties && classesData[className].properties![word]) {
                const propInfo = classesData[className].properties![word];
                const markdown = `**${className}.${word}** (property)\nType: ${propInfo.type}\n\n${propInfo.description}`;
                console.log('Hover content:', markdown);
                return {
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: markdown,
                    },
                };
            }
        }
    }

    // Check if it's a standalone function
    if (functionsData[word]) {
        const functionInfo = functionsData[word];
        const markdown = `**${word}** (${functionInfo.source} function)\n\n**Return Type:** \`${functionInfo.returnType}\`\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`;
        console.log('Hover content:', markdown);
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: markdown,
            },
        };
    }

    // Check if it's a callback
    for (const callbackName in callbacksData) {
        const callbackInfo = callbacksData[callbackName];
        if (callbackInfo.signature === word || callbackName.startsWith(word)) {
            const markdown = `**${callbackName}** (callback)\n\n\`\`\`slim\n${callbackInfo.signature}\n\`\`\`\n\n${callbackInfo.description}`;
            console.log('Hover content:', markdown);
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: markdown,
                },
            };
        }
    }

    // Check if it's a type
    if (typesData[word]) {
        const typeInfo = typesData[word];
        const markdown = `**${word}** (type)\n\n${typeInfo.description}`;
        console.log('Hover content:', markdown);
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: markdown,
            },
        };
    }

    console.log('No hover content found for word:', word);
    return null;
});

function getWordAndContextAtPosition(
    text: string,
    position: { line: number; character: number }
): WordInfo | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];

    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const dotRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)?/g;

    // Check for method/property access pattern
    let dotMatch: RegExpExecArray | null;
    while ((dotMatch = dotRegex.exec(line)) !== null) {
        const start = dotMatch.index;
        const end = dotMatch.index + dotMatch[0].length;
        if (position.character >= start && position.character <= end) {
            const className = instanceDefinitions[dotMatch[1]] || dotMatch[1];
            return {
                word: dotMatch[2] || '',
                context: {
                    isMethodOrProperty: true,
                    className: className,
                    instanceName: dotMatch[1],
                },
            };
        }
    }

    // Find the word at cursor position
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(line)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (position.character >= start && position.character <= end) {
            const instanceClass = instanceDefinitions[match[0]] || instanceToClassMap[match[0]];
            return {
                word: match[0],
                context: {
                    isMethodOrProperty: false,
                    instanceClass: instanceClass,
                },
            };
        }
    }

    return null;
}

function getAutocompleteContextAtPosition(
    text: string,
    position: { line: number; character: number }
): WordInfo | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];
    const lineUptoCursor = line.slice(0, position.character);

    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const dotRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*$/;

    // Check for method/property access pattern
    const dotMatch = lineUptoCursor.match(dotRegex);
    if (dotMatch) {
        const className =
            instanceDefinitions[dotMatch[1]] || instanceToClassMap[dotMatch[1]] || dotMatch[1];
        return {
            word: '',
            context: {
                isMethodOrProperty: true,
                className: className,
                instanceName: dotMatch[1],
            },
        };
    }

    // Find the word at cursor position
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(lineUptoCursor)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (position.character >= start && position.character <= end) {
            return {
                word: match[0],
                context: {
                    isMethodOrProperty: false,
                },
            };
        }
    }

    return null;
}

function extractClassConstructors(classesData: { [key: string]: ClassInfo }): {
    [key: string]: ConstructorInfo;
} {
    const classConstructors: { [key: string]: ConstructorInfo } = {};
    for (const className in classesData) {
        const classInfo = classesData[className];
        const constructorInfo = classInfo.constructor || {};
        classConstructors[className] = {
            signature:
                constructorInfo.signature && constructorInfo.signature.trim() !== ''
                    ? constructorInfo.signature
                    : 'None',
            description:
                constructorInfo.description && constructorInfo.description.trim() !== ''
                    ? constructorInfo.description
                    : 'No constructor method implemented',
        };
    }
    return classConstructors;
}

// Load class constructors
const eidosClassesData: { [key: string]: ClassInfo } = JSON.parse(
    fs.readFileSync(eidosClassesPath, 'utf8')
);
const eidosClassConstructors = extractClassConstructors(eidosClassesData);

const slimClassesData: { [key: string]: ClassInfo } = JSON.parse(
    fs.readFileSync(slimClassesPath, 'utf8')
);
const slimClassConstructors = extractClassConstructors(slimClassesData);

connection.onCompletion((params): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const position = params.position;
    const text = document.getText();
    trackInstanceDefinitions(text);

    const completions: CompletionItem[] = [];
    const wordInfo = getAutocompleteContextAtPosition(text, position);

    if (wordInfo && wordInfo.context.isMethodOrProperty && wordInfo.context.className) {
        const className = wordInfo.context.className;

        if (classesData[className]) {
            const classInfo = classesData[className];

            // Add methods
            if (classInfo.methods) {
                for (const methodName in classInfo.methods) {
                    const methodInfo = classInfo.methods[methodName];
                    completions.push({
                        label: methodName,
                        kind: CompletionItemKind.Method,
                        detail: methodInfo.signature,
                        documentation: {
                            kind: MarkupKind.Markdown,
                            value: `**${className}.${methodName}** (method)\n\n\`\`\`slim\n${methodInfo.signature}\n\`\`\`\n\n${methodInfo.description}`,
                        },
                        command: {
                            title: 'Show Documentation',
                            command: 'slimTools.showFunctionDoc',
                            arguments: [`${className}.${methodName}`],
                        },
                    });
                }
            }

            // Add properties
            if (classInfo.properties) {
                for (const propName in classInfo.properties) {
                    const propInfo = classInfo.properties[propName];
                    completions.push({
                        label: propName,
                        kind: CompletionItemKind.Property,
                        detail: `Type: ${propInfo.type}`,
                        documentation: {
                            kind: MarkupKind.Markdown,
                            value: `**${className}.${propName}** (property)\nType: ${propInfo.type}\n\n${propInfo.description}`,
                        },
                        command: {
                            title: 'Show Documentation',
                            command: 'slimTools.showPropertyDoc',
                            arguments: [`${className}.${propName}`],
                        },
                    });
                }
            }
        }
    } else {
        // Add standalone functions
        for (const funcName in functionsData) {
            const functionInfo = functionsData[funcName];
            completions.push({
                label: functionInfo.signature,
                kind: CompletionItemKind.Function,
                detail: functionInfo.signature,
                documentation: {
                    kind: MarkupKind.Markdown,
                    value: `**${funcName}**\n\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`,
                },
                command: {
                    title: 'Show Documentation',
                    command: 'slimTools.showFunctionDoc',
                    arguments: [funcName],
                },
            });
        }

        // Add Eidos class constructors
        for (const className in eidosClassConstructors) {
            const constructorInfo = eidosClassConstructors[className];
            completions.push({
                label: className,
                kind: CompletionItemKind.Class,
                detail: constructorInfo.signature,
                documentation: {
                    kind: MarkupKind.Markdown,
                    value: `**${className}** (constructor)\n\n\`\`\`slim\n${constructorInfo.signature}\n\`\`\`\n\n${constructorInfo.description}`,
                },
                command: {
                    title: 'Show Documentation',
                    command: 'slimTools.showConstructorDoc',
                    arguments: [className],
                },
            });
        }

        // Add SLiM class constructors
        for (const className in slimClassConstructors) {
            const constructorInfo = slimClassConstructors[className];
            completions.push({
                label: className,
                kind: CompletionItemKind.Class,
                detail: constructorInfo.signature,
                documentation: {
                    kind: MarkupKind.Markdown,
                    value: `**${className}** (constructor)\n\n\`\`\`slim\n${constructorInfo.signature}\n\`\`\`\n\n${constructorInfo.description}`,
                },
                command: {
                    title: 'Show Documentation',
                    command: 'slimTools.showConstructorDoc',
                    arguments: [className],
                },
            });
        }

        // Add SLiM callbacks
        for (const callbackName in callbacksData) {
            const callbackInfo = callbacksData[callbackName];
            completions.push({
                label: callbackInfo.signature,
                kind: CompletionItemKind.Function,
                detail: callbackInfo.signature,
                documentation: {
                    kind: MarkupKind.Markdown,
                    value: `**${callbackName}**\n\n\`\`\`slim\n${callbackInfo.signature}\n\`\`\`\n\n${callbackInfo.description}`,
                },
                command: {
                    title: 'Show Documentation',
                    command: 'slimTools.showFunctionDoc',
                    arguments: [callbackName],
                },
            });
        }
    }

    return completions;
});

connection.onCompletionResolve((item): CompletionItem => {
    const [className, memberName] = item.label.split('.');

    if (functionsData[item.label]) {
        const functionInfo = functionsData[item.label];
        item.documentation = {
            kind: MarkupKind.Markdown,
            value: `**${item.label}**\n\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`,
        };
    } else if (classesData[className]) {
        const classInfo = classesData[className];

        if (classInfo.methods && classInfo.methods[memberName]) {
            const methodInfo = classInfo.methods[memberName];
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**${className}.${memberName}** (method)\n\n\`\`\`slim\n${methodInfo.signature}\n\`\`\`\n\n${methodInfo.description}`,
            };
        } else if (classInfo.properties && classInfo.properties[memberName]) {
            const propInfo = classInfo.properties[memberName];
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**${className}.${memberName}** (property)\nType: ${propInfo.type}\n\n${propInfo.description}`,
            };
        }
    }

    return item;
});

connection.onSignatureHelp((params): SignatureHelp | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const position = params.position;
    const text = document.getText();
    const word = getWordAndContextAtPosition(text, position);

    console.log('Signature Help Triggered for:', word);

    if (word && functionsData[word.word]) {
        const functionInfo = functionsData[word.word];
        const signature = functionInfo.signature;

        // Extract parameters from signature
        const paramList = signature.match(/\((.*?)\)/);
        const parameters = paramList ? paramList[1].split(',').map((p) => p.trim()) : [];

        return {
            signatures: [
                {
                    label: signature,
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: `${functionInfo.signature}\n\n${functionInfo.description}`,
                    },
                    parameters: parameters.map((param) => ({ label: param })),
                },
            ],
            activeSignature: 0,
            activeParameter: 0,
        };
    }

    return null;
});

connection.onReferences((): Location[] => {
    return [];
});

connection.listen();

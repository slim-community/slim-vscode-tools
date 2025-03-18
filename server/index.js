const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  DiagnosticSeverity
} = require('vscode-languageserver/node');

const connection = createConnection(ProposedFeatures.all);
const { TextDocument } = require('vscode-languageserver-textdocument');
const documents = new TextDocuments(TextDocument);
const fs = require('fs');
const path = require('path');

// Load both function and class documentation
const slimFunctionsPath = path.join(__dirname, '..', 'docs', 'slim_functions.json');
const eidosFunctionsPath = path.join(__dirname, '..', 'docs', 'eidos_functions.json');
const slimClassesPath = path.join(__dirname, '..', 'docs', 'slim_classes.json');
const eidosClassesPath = path.join(__dirname, '..', 'docs', 'eidos_classes.json');
const slimCallbacksPath = path.join(__dirname, '..', 'docs', 'slim_callbacks.json');
const eidosTypesPath = path.join(__dirname, '..', 'docs', 'eidos_types.json');

let functionsData = {};
let classesData = {};
let callbacksData = {};
let typesData = {};

// Load all documentation files
function loadDocumentation() {
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
            callbacksData = { ...callbacksData, ...flattenCallbackData(slimCallbacks) }; // Update this line
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

function flattenFunctionData(data, source) {
    const flattened = {};
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
                        source: source
                    };
                }
            }
        }
    }
    return flattened;
}

function flattenCallbackData(data) {
    const flattened = {};
    for (const callbackName in data) {
        if (data.hasOwnProperty(callbackName)) {
            const callbackData = data[callbackName];
            flattened[callbackName] = {
                ...callbackData,
                signature: callbackData.signature.replace(/\s+(callbacks|events)$/, '')
            };
        }
    }
    return flattened;
}

loadDocumentation();

// Add these constants at the top of your file
const SLIM_KEYWORDS = [
    'initialize', 'early', 'late', 'fitness', 'interaction',
    'mateChoice', 'modifyChild', 'mutation', 'recombination'
];

const SLIM_TYPES = [
    'void', 'integer', 'float', 'string', 'logical',
    'object', 'numeric', 'NULL', 'INF'
];

// Add this function to check for valid SLiM types
function validateSlimType(type) {
    return SLIM_TYPES.some(validType => type.includes(validType));
}

const instanceToClassMap = {
    'sim': 'Species',
    // Add other known instances and their corresponding classes here
};

let instanceDefinitions = {};

function trackInstanceDefinitions(text) {
    const lines = text.split('\n');
    const instanceRegex = /(\w+)\s*=\s*new\s+(\w+)/; // Example: p1 = new Subpopulation
    const subpopRegex = /sim\.addSubpop\("(\w+)",\s*\d+(?:,\s*[^)]*)?\)/; // Example: sim.addSubpop("p1", 100)
    const subpopSplitRegex = /sim\.addSubpopSplit\("(\w+)",\s*\d+(?:,\s*[^)]*)?\)/; // Example: sim.addSubpopSplit("p1", 100, ...)
    const earlyEventRegex = /community\.registerEarlyEvent\("(\w+)",\s*[^)]*\)/; // Example: community.registerEarlyEvent("event1", ...)
    const firstEventRegex = /community\.registerFirstEvent\("(\w+)",\s*[^)]*\)/; // Example: community.registerFirstEvent("event1", ...)
    const interactionCallbackRegex = /community\.registerInteractionCallback\("(\w+)",\s*[^)]*\)/; // Example: community.registerInteractionCallback("event1", ...)
    const lateEventRegex = /community\.registerLateEvent\("(\w+)",\s*[^)]*\)/; // Example: community.registerLateEvent("event1", ...)
    const fitnessEffectCallbackRegex = /species\.registerFitnessEffectCallback\("(\w+)",\s*[^)]*\)/; // Example: species.registerFitnessEffectCallback("callback1", ...)
    const mateChoiceCallbackRegex = /species\.registerMateChoiceCallback\("(\w+)",\s*[^)]*\)/; // Example: species.registerMateChoiceCallback("callback1", ...)
    const modifyChildCallbackRegex = /species\.registerModifyChildCallback\("(\w+)",\s*[^)]*\)/; // Example: species.registerModifyChildCallback("callback1", ...)
    const mutationCallbackRegex = /species\.registerMutationCallback\("(\w+)",\s*[^)]*\)/; // Example: species.registerMutationCallback("callback1", ...)
    const mutationEffectCallbackRegex = /species\.registerMutationEffectCallback\("(\w+)",\s*[^)]*\)/; // Example: species.registerMutationEffectCallback("callback1", ...)
    const recombinationCallbackRegex = /species\.registerRecombinationCallback\("(\w+)",\s*[^)]*\)/; // Example: species.registerRecombinationCallback("callback1", ...)
    const reproductionCallbackRegex = /species\.registerReproductionCallback\("(\w+)",\s*[^)]*\)/; // Example: species.registerReproductionCallback("callback1", ...)
    const survivalCallbackRegex = /species\.registerSurvivalCallback\("(\w+)",\s*[^)]*\)/; // Example: species.registerSurvivalCallback("callback1", ...)

    lines.forEach(line => {
        let match;
        switch (true) {
            case (match = line.match(instanceRegex)) !== null:
                instanceDefinitions[match[1]] = match[2];
                break;
            case (match = line.match(subpopRegex)) !== null:
                instanceDefinitions[match[1]] = 'Subpopulation';
                break;
            case (match = line.match(subpopSplitRegex)) !== null:
                instanceDefinitions[match[1]] = 'Subpopulation';
                break;
            case (match = line.match(earlyEventRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(firstEventRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(interactionCallbackRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(lateEventRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(fitnessEffectCallbackRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(mateChoiceCallbackRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(modifyChildCallbackRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(mutationCallbackRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(mutationEffectCallbackRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(recombinationCallbackRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(reproductionCallbackRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
            case (match = line.match(survivalCallbackRegex)) !== null:
                instanceDefinitions[match[1]] = 'SLiMEidosBlock';
                break;
        }
    });
}

documents.listen(connection);

connection.onInitialize(() => {
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.'] // Add dot as a trigger character
            },
            hoverProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            documentFormattingProvider: true,
            signatureHelpProvider: {   
                triggerCharacters: ["(", ",", " "],
                retriggerCharacters: [",", ")"]
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
    const diagnostics = [];
    const lines = text.split('\n');
    
    // Track braces across the entire file
    let braceCount = 0;
    let lastOpenBraceLine = -1;

    lines.forEach((line, lineIndex) => {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('//')) {
            return;
        }

        // Handle SLiM generation-prefixed blocks
        // Match patterns like "1000 late()" or "s1 1000 early()"
        const isSlimBlock = /^\d+\s+\w+\(\)/.test(trimmedLine) || 
                           /^s\d+\s+\d+\s+\w+\(\)/.test(trimmedLine);

        // Count braces in this line
        const openBracesInLine = (line.match(/{/g) || []).length;
        const closeBracesInLine = (line.match(/}/g) || []).length;
        
        // Update total brace count
        braceCount += openBracesInLine - closeBracesInLine;
        
        // Track where braces open
        if (openBracesInLine > 0) {
            lastOpenBraceLine = lineIndex;
        }

        // Only flag as error if we have more closing braces than opening ones
        // and it's not a complete SLiM block
        if (braceCount < 0 && !isSlimBlock) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineIndex, character: 0 },
                    end: { line: lineIndex, character: line.length }
                },
                message: 'Unexpected closing brace',
                source: 'slim-tools'
            });
        }

        // Check for missing semicolons, but exclude specific cases
        if (shouldHaveSemicolon(trimmedLine)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineIndex, character: 0 },
                    end: { line: lineIndex, character: line.length }
                },
                message: 'Statement might be missing a semicolon',
                source: 'slim-tools'
            });
        }
    });

    // After processing all lines, check if we have unclosed braces
    // Only report if we're not at the end of a complete block
    if (braceCount > 0) {
        const lastLine = lines[lines.length - 1].trim();
        const isCompleteBlock = lastLine === '}';
        
        if (!isCompleteBlock) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lastOpenBraceLine, character: 0 },
                    end: { line: lastOpenBraceLine, character: lines[lastOpenBraceLine].length }
                },
                message: 'Unclosed brace(s)',
                source: 'slim-tools'
            });
        }
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function shouldHaveSemicolon(line) {
    // Don't require semicolons for these cases
    if (line.endsWith('{') || 
        line.endsWith('}') || 
        line.endsWith(';') ||
        // SLiM block declarations
        /^(initialize|early|late|fitness)\s*\([^)]*\)\s*{?\s*$/.test(line) ||
        // Control structures
        /^(if|else|while|for)\s*\([^)]*\)\s*{?\s*$/.test(line) ||
        // Empty or comment lines
        /^\s*$/.test(line) || 
        /^\/\//.test(line)) {
        return false;
    }

    // Check if the line is a complete statement
    return true;
}

// ✅ Re-added document symbol provider to prevent "Unhandled method" error
connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const text = document.getText();
  const symbols = [];

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
            end: { line: index, character: line.length }
          }
        }
      });
    }
  });

  return symbols;
});

connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const position = params.position;
    const text = document.getText();
    trackInstanceDefinitions(text); // Track instance definitions
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
                kind: "markdown",
                value: markdown
            }
        };
    }

    // Check if it's a method or property of a known instance
    if (context.isMethodOrProperty && (instanceToClassMap[context.className] || classesData[context.className])) {
        const className = instanceToClassMap[context.className] || context.className;
        if (classesData[className]) {
            // Check methods
            if (classesData[className].methods && classesData[className].methods[word]) {
                const methodInfo = classesData[className].methods[word];
                const markdown = `**${className}.${word}** (method)\n\`\`\`slim\n${methodInfo.signature}\n\`\`\`\n\n${methodInfo.description}`;
                console.log('Hover content:', markdown);
                return {
                    contents: {
                        kind: "markdown",
                        value: markdown
                    }
                };
            }
            // Check properties
            if (classesData[className].properties && classesData[className].properties[word]) {
                const propInfo = classesData[className].properties[word];
                const markdown = `**${className}.${word}** (property)\nType: ${propInfo.type}\n\n${propInfo.description}`;
                console.log('Hover content:', markdown);
                return {
                    contents: {
                        kind: "markdown",
                        value: markdown
                    }
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
                kind: "markdown",
                value: markdown
            }
        };
    }

    // Check if it's a callback by matching the cleaned signature or the original key
    for (const callbackName in callbacksData) {
        const callbackInfo = callbacksData[callbackName];
        if (callbackInfo.signature === word || callbackName.startsWith(word)) {
            const markdown = `**${callbackName}** (callback)\n\n\`\`\`slim\n${callbackInfo.signature}\n\`\`\`\n\n${callbackInfo.description}`;
            console.log('Hover content:', markdown);
            return {
                contents: {
                    kind: "markdown",
                    value: markdown
                }
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
                kind: "markdown",
                value: markdown
            }
        };
    }

    console.log('No hover content found for word:', word);
    return null;
});

// Helper function to get word and its context at position
function getWordAndContextAtPosition(text, position) {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];
    const lineUptoCursor = line.slice(0, position.character);
    
    // Regular expression to find words and their context
    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const dotRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)?/g;

    // Check for method/property access pattern (e.g., "ClassName.method" or "object.method")
    let dotMatch;
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
                    instanceName: dotMatch[1]
                }
            };
        }
    }

    // Find the word at cursor position
    let match;
    while ((match = wordRegex.exec(line)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (position.character >= start && position.character <= end) {
            const instanceClass = instanceDefinitions[match[0]] || instanceToClassMap[match[0]];
            return {
                word: match[0],
                context: {
                    isMethodOrProperty: false,
                    instanceClass: instanceClass
                }
            };
        }
    }

    return null;
}

function getAutocompleteContextAtPosition(text, position) {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;

    const line = lines[position.line];
    const lineUptoCursor = line.slice(0, position.character);
    
    // Regular expression to find words and their context
    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const dotRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*$/; // Match "instance."

    // Check for method/property access pattern (e.g., "ClassName." or "object.")
    let dotMatch = lineUptoCursor.match(dotRegex);
    if (dotMatch) {
        const className = instanceDefinitions[dotMatch[1]] || instanceToClassMap[dotMatch[1]] || dotMatch[1];
        return {
            word: '',
            context: {
                isMethodOrProperty: true,
                className: className,
                instanceName: dotMatch[1]
            }
        };
    }

    // Find the word at cursor position
    let match;
    while ((match = wordRegex.exec(lineUptoCursor)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (position.character >= start && position.character <= end) {
            return {
                word: match[0],
                context: {
                    isMethodOrProperty: false
                }
            };
        }
    }

    return null;
}

function extractClassConstructors(classesData) {
    const classConstructors = {};
    for (const className in classesData) {
        const classInfo = classesData[className];
        const constructorInfo = classInfo.constructor || {};
        classConstructors[className] = {
            signature: constructorInfo.signature && constructorInfo.signature.trim() !== '' ? constructorInfo.signature : 'None',
            description: constructorInfo.description && constructorInfo.description.trim() !== '' ? constructorInfo.description : 'No constructor method implemented'
        };
    }
    return classConstructors;
}

// Load class constructors from eidos_classes.json
const eidosClassesData = JSON.parse(fs.readFileSync(eidosClassesPath, 'utf8'));
const eidosClassConstructors = extractClassConstructors(eidosClassesData);

// Load class constructors from slim_classes.json
const slimClassesData = JSON.parse(fs.readFileSync(slimClassesPath, 'utf8'));
const slimClassConstructors = extractClassConstructors(slimClassesData);

connection.onCompletion((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const position = params.position;
    const text = document.getText();
    trackInstanceDefinitions(text); // Track instance definitions

    const completions = [];
    const wordInfo = getAutocompleteContextAtPosition(text, position);

    if (wordInfo && wordInfo.context.isMethodOrProperty) {
        const className = wordInfo.context.className;

        if (classesData[className]) {
            const classInfo = classesData[className];

            // Add methods
            if (classInfo.methods) {
                for (const methodName in classInfo.methods) {
                    const methodInfo = classInfo.methods[methodName];
                    completions.push({
                        label: methodName,
                        kind: 2, // Method completion
                        detail: methodInfo.signature,
                        documentation: {
                            kind: "markdown",
                            value: `**${className}.${methodName}** (method)\n\n\`\`\`slim\n${methodInfo.signature}\n\`\`\`\n\n${methodInfo.description}`
                        },
                        // Add command data to show documentation
                        command: {
                            title: 'Show Documentation',
                            command: 'slimTools.showFunctionDoc',
                            arguments: [`${className}.${methodName}`]
                        }
                    });
                }
            }

            // Add properties
            if (classInfo.properties) {
                for (const propName in classInfo.properties) {
                    const propInfo = classInfo.properties[propName];
                    completions.push({
                        label: propName,
                        kind: 10, // Property completion
                        detail: `Type: ${propInfo.type}`,
                        documentation: {
                            kind: "markdown",
                            value: `**${className}.${propName}** (property)\nType: ${propInfo.type}\n\n${propInfo.description}`
                        },
                        // Add command data to show documentation
                        command: {
                            title: 'Show Documentation',
                            command: 'slimTools.showPropertyDoc',
                            arguments: [`${className}.${propName}`]
                        }
                    });
                }
            }
        }
    } else {
        // Add standalone functions to completions
        for (const funcName in functionsData) {
            const functionInfo = functionsData[funcName];
            completions.push({
                label: functionInfo.signature, // Use the signature instead of the key
                kind: 3, // Function completion
                detail: functionInfo.signature,
                documentation: {
                    kind: "markdown",
                    value: `**${funcName}**\n\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`
                },
                // Add command data to show documentation
                command: {
                    title: 'Show Documentation',
                    command: 'slimTools.showFunctionDoc',
                    arguments: [funcName]
                }
            });
        }

        // Add Eidos class constructors to completions
        for (const className in eidosClassConstructors) {
            const constructorInfo = eidosClassConstructors[className];
            completions.push({
                label: className,
                kind: 7, // Class completion
                detail: constructorInfo.signature,
                documentation: {
                    kind: "markdown",
                    value: `**${className}** (constructor)\n\n\`\`\`slim\n${constructorInfo.signature}\n\`\`\`\n\n${constructorInfo.description}`
                },
                // Add command data to show documentation
                command: {
                    title: 'Show Documentation',
                    command: 'slimTools.showConstructorDoc',
                    arguments: [className]
                }
            });
        }

        // Add SLiM class constructors to completions
        for (const className in slimClassConstructors) {
            const constructorInfo = slimClassConstructors[className];
            completions.push({
                label: className,
                kind: 7, // Class completion
                detail: constructorInfo.signature,
                documentation: {
                    kind: "markdown",
                    value: `**${className}** (constructor)\n\n\`\`\`slim\n${constructorInfo.signature}\n\`\`\`\n\n${constructorInfo.description}`
                },
                // Add command data to show documentation
                command: {
                    title: 'Show Documentation',
                    command: 'slimTools.showConstructorDoc',
                    arguments: [className]
                }
            });
        }

        // Add SLiM callbacks to completions
        for (const callbackName in callbacksData) {
            const callbackInfo = callbacksData[callbackName];
            completions.push({
                label: callbackInfo.signature, // Use the signature instead of the key
                kind: 3, // Function completion
                detail: callbackInfo.signature,
                documentation: {
                    kind: "markdown",
                    value: `**${callbackName}**\n\n\`\`\`slim\n${callbackInfo.signature}\n\`\`\`\n\n${callbackInfo.description}`
                },
                // Add command data to show documentation
                command: {
                    title: 'Show Documentation',
                    command: 'slimTools.showFunctionDoc',
                    arguments: [callbackName]
                }
            });
        }
    }

    return completions;
});

// This resolves additional information for a completion item
connection.onCompletionResolve((item) => {
    const [className, memberName] = item.label.split('.');

    if (functionsData[item.label]) {
        const functionInfo = functionsData[item.label];
        item.documentation = {
            kind: "markdown",
            value: `**${item.label}**\n\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`
        };
    } else if (classesData[className]) {
        const classInfo = classesData[className];

        if (classInfo.methods && classInfo.methods[memberName]) {
            const methodInfo = classInfo.methods[memberName];
            item.documentation = {
                kind: "markdown",
                value: `**${className}.${memberName}** (method)\n\n\`\`\`slim\n${methodInfo.signature}\n\`\`\`\n\n${methodInfo.description}`
            };
        } else if (classInfo.properties && classInfo.properties[memberName]) {
            const propInfo = classInfo.properties[memberName];
            item.documentation = {
                kind: "markdown",
                value: `**${className}.${memberName}** (property)\nType: ${propInfo.type}\n\n${propInfo.description}`
            };
        }
    }

    return item;
});

// parameter hints
connection.onSignatureHelp((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const position = params.position;
    const text = document.getText();
    const word = getWordAtPosition(text, position);

    console.log("Signature Help Triggered for:", word);

    if (functionsData[word]) {
        const functionInfo = functionsData[word];
        const signature = functionInfo.signature;
        
        // Extract parameters from signature
        const paramList = signature.match(/\((.*?)\)/);
        const parameters = paramList ? paramList[1].split(",").map(p => p.trim()) : [];

        return {
            signatures: [
                {
                    label: signature,
                    documentation: {
                        kind: "markdown",
                        value: `${functionInfo.signature}\n\n${functionInfo.description}`
                    },
                    parameters: parameters.map(param => ({ label: param }))
                }
            ],
            activeSignature: 0,
            activeParameter: 0
        };
    }

    return null;
});

// Add this handler for references
connection.onReferences((params) => {
    // Just return an empty array for now
    return [];
});



connection.listen();

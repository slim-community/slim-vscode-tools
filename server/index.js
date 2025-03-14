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

// Load SLiM function data from JSON file
const functionDocsPath = path.join(__dirname, '..', 'docs', 'slim_function_docs.json');

let functionsData = {};
if (fs.existsSync(functionDocsPath)) {
  functionsData = JSON.parse(fs.readFileSync(functionDocsPath, 'utf8'));
  console.log('✅ Server loaded function documentation successfully.');
  console.log('Server loaded functions:', Object.keys(functionsData));
} else {
  console.error('❌ ERROR: slim_function_docs.json not found in server!');
}

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

documents.listen(connection);

connection.onInitialize(() => {
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      completionProvider: {
        resolveProvider: true
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
    const word = getWordAtPosition(text, position);

    if (functionsData[word]) {
        const functionInfo = functionsData[word];
        return {
            contents: {
                kind: "markdown",
                value: `**${word}**\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`
            }
        };
    }

    return null;
});

function getWordAtPosition(text, position) {
    const lines = text.split('\n');
    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const wordMatch = line.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);

    if (!wordMatch) return null;

    let bestMatch = null;

    for (const word of wordMatch) {
        const start = line.indexOf(word);
        const end = start + word.length;

        // Standard behavior: Return the word under the cursor
        if (position.character >= start && position.character <= end) {
            return word;
        }

        // Extra handling for function calls: Detect word before '('
        if (position.character > end && line.slice(end).match(/^\s*\(/)) {
            bestMatch = word; // Store last word before '('
        }
    }

    return bestMatch; // Return function name before '(' if found
}

connection.onCompletion((params) => {
    const completions = [];

    for (const funcName in functionsData) {
        const functionInfo = functionsData[funcName];
        completions.push({
            label: funcName,
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

    return completions;
});

// This resolves additional information for a completion item
connection.onCompletionResolve((item) => {
    if (functionsData[item.label]) {
        const functionInfo = functionsData[item.label];
        item.documentation = {
            kind: "markdown",
            value: `**${item.label}**\n\n\`\`\`slim\n${functionInfo.signature}\n\`\`\`\n\n${functionInfo.description}`
        };
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

// Disable GoTo Definition by removing the definition handler
// connection.onDefinition((params) => {
//     const document = documents.get(params.textDocument.uri);
//     if (!document) return null;
//
//     const position = params.position;
//     const text = document.getText();
//     const word = getWordAtPosition(text, position);
//
//     console.log(`🔍 Server looking for definition of: ${word}`);
//     console.log(`Function exists in server: ${!!functionsData[word]}`);
//
//     if (functionsData[word]) {
//         // Previously, we would send a notification and return a dummy location...
//         connection.sendNotification('custom/showFunctionDoc', { functionName: word });
//         console.log(`Sent custom notification for: ${word}`);
//         
//         return {
//             uri: document.uri,
//             range: {
//                 start: position,
//                 end: position
//             }
//         };
//     }
//
//     return null;
// });

connection.listen();

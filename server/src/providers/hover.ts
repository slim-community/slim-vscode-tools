import { Hover, HoverParams, MarkupKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getWordAndContextAtPosition } from '../utils/positions';
import { trackInstanceDefinitions, instanceToClassMap } from '../utils/instance';
import { functionsData, classesData, callbacksData, typesData } from '../services/documentation-service';

export function onHover(params: HoverParams, document: TextDocument): Hover | null {
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
}


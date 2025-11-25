import {
    CompletionParams,
    CompletionItem,
    CompletionItemKind,
    MarkupKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getAutocompleteContextAtPosition } from '../utils/positions';
import { trackInstanceDefinitions } from '../utils/instance';
import {
    functionsData,
    classesData,
    callbacksData,
    extractClassConstructors,
} from '../services/documentation-service';
import * as fs from 'fs';
import { ClassInfo } from '../config/types';
import { EIDOS_CLASSES_PATH, SLIM_CLASSES_PATH } from '../config/paths';

// Load class constructors
const eidosClassesData: { [key: string]: ClassInfo } = JSON.parse(
    fs.readFileSync(EIDOS_CLASSES_PATH, 'utf8')
);
const eidosClassConstructors = extractClassConstructors(eidosClassesData);

const slimClassesData: { [key: string]: ClassInfo } = JSON.parse(
    fs.readFileSync(SLIM_CLASSES_PATH, 'utf8')
);
const slimClassConstructors = extractClassConstructors(slimClassesData);

export function onCompletion(params: CompletionParams, document: TextDocument): CompletionItem[] {
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
}

export function onCompletionResolve(item: CompletionItem): CompletionItem {
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
}


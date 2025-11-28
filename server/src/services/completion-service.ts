import {
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    Position,
    MarkupKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentationService } from './documentation-service';
import { getAutocompleteContextAtPosition } from '../utils/positions';
import { trackInstanceDefinitions } from '../utils/instance';
import {
    createFunctionMarkdown,
    createMethodMarkdown,
    createPropertyMarkdown,
    createCallbackMarkdown,
    createConstructorMarkdown,
    createOperatorMarkdown,
} from '../utils/markdown';
import {
    FunctionInfo,
    MethodInfo,
    PropertyInfo,
    CallbackInfo,
    OperatorInfo,
    ConstructorInfo,
    LanguageMode,
} from '../config/types';
import { cleanSignature, cleanTypeNames } from '../utils/text-processing';
import { getFileType } from '../utils/file-type';

export class CompletionService {
    constructor(private documentationService: DocumentationService) {}

    public getCompletions(
        document: TextDocument,
        position: Position
    ): CompletionItem[] | CompletionList | null {
        const text = document.getText();
        
        // Track instance definitions for better type resolution
        trackInstanceDefinitions(document);
        
        // Determine file type for filtering
        const fileType = getFileType(document);

        const completions: CompletionItem[] = [];
        const wordInfo = getAutocompleteContextAtPosition(text, position);

        // Check if we're completing a method or property
        if (wordInfo && wordInfo.wordContext.isMethodOrProperty) {
            this.addMethodAndPropertyCompletions(
                wordInfo.wordContext.className,
                completions,
                fileType
            );
        } else {
            // Add global completions (functions, constructors, callbacks, operators)
            this.addGlobalCompletions(completions, fileType);
        }

        return completions;
    }

    public resolveCompletion(item: CompletionItem): CompletionItem {
        // If item already has documentation, return as-is
        if (item.documentation) {
            return item;
        }

        // Lazy loading: Check data field for type information
        if (!item.data) {
            return item;
        }

        const data = item.data as any;
        
        // Handle different completion types
        switch (data.type) {
            case 'method': {
                const classesData = this.documentationService.getClasses();
                const classInfo = classesData[data.className];
                if (classInfo?.methods?.[data.methodName]) {
                    const methodInfo = classInfo.methods[data.methodName];
                    item.documentation = {
                        kind: MarkupKind.Markdown,
                        value: createMethodMarkdown(data.className, data.methodName, methodInfo),
                    };
                }
                break;
            }
            case 'property': {
                const classesData = this.documentationService.getClasses();
                const classInfo = classesData[data.className];
                if (classInfo?.properties?.[data.propertyName]) {
                    const propInfo = classInfo.properties[data.propertyName];
                    item.documentation = {
                        kind: MarkupKind.Markdown,
                        value: createPropertyMarkdown(data.className, data.propertyName, propInfo),
                    };
                }
                break;
            }
            case 'function': {
                const functionsData = this.documentationService.getFunctions();
                const functionInfo = functionsData[data.functionName];
                if (functionInfo) {
                    item.documentation = {
                        kind: MarkupKind.Markdown,
                        value: createFunctionMarkdown(
                            data.functionName,
                            functionInfo,
                            functionInfo.source
                        ),
                    };
                }
                break;
            }
            case 'callback': {
                const callbacksData = this.documentationService.getCallbacks();
                const callbackInfo = callbacksData[data.callbackName];
                if (callbackInfo) {
                    item.documentation = {
                        kind: MarkupKind.Markdown,
                        value: createCallbackMarkdown(data.callbackName, callbackInfo),
                    };
                }
                break;
            }
            case 'constructor': {
                const constructors = this.documentationService.getClassConstructors();
                const constructorInfo = constructors[data.className];
                if (constructorInfo) {
                    item.documentation = {
                        kind: MarkupKind.Markdown,
                        value: createConstructorMarkdown(data.className, constructorInfo),
                    };
                }
                break;
            }
            case 'operator': {
                const operatorsData = this.documentationService.getOperators();
                const operatorInfo = operatorsData[data.operatorName];
                if (operatorInfo) {
                    item.documentation = {
                        kind: MarkupKind.Markdown,
                        value: createOperatorMarkdown(data.operatorName, operatorInfo),
                    };
                }
                break;
            }
        }

        return item;
    }

    private addMethodAndPropertyCompletions(
        className: string | undefined,
        completions: CompletionItem[],
        fileType: LanguageMode
    ): void {
        if (!className) return;

        const classesData = this.documentationService.getClasses(fileType);
        const classInfo = classesData[className];

        if (!classInfo) return;

        // Add methods
        if (classInfo.methods) {
            for (const [methodName, methodInfo] of Object.entries(classInfo.methods)) {
                completions.push(
                    this.createMethodCompletion(className, methodName, methodInfo)
                );
            }
        }

        // Add properties
        if (classInfo.properties) {
            for (const [propName, propInfo] of Object.entries(classInfo.properties)) {
                completions.push(
                    this.createPropertyCompletion(className, propName, propInfo)
                );
            }
        }
    }

    private addGlobalCompletions(
        completions: CompletionItem[],
        fileType: LanguageMode
    ): void {
        const functionsData = this.documentationService.getFunctions(fileType);
        const classConstructors = this.documentationService.getClassConstructors(fileType);
        const callbacksData = this.documentationService.getCallbacks(fileType);
        const operatorsData = this.documentationService.getOperators();

        // Add functions
        for (const [funcName, funcInfo] of Object.entries(functionsData)) {
            completions.push(this.createFunctionCompletion(funcName, funcInfo));
        }

        // Add class constructors
        for (const [className, constructorInfo] of Object.entries(classConstructors)) {
            completions.push(this.createConstructorCompletion(className, constructorInfo));
        }

        // Add callbacks (SLiM-only)
        for (const [callbackName, callbackInfo] of Object.entries(callbacksData)) {
            completions.push(this.createCallbackCompletion(callbackName, callbackInfo));
        }

        // Add operators
        for (const [operatorName, operatorInfo] of Object.entries(operatorsData)) {
            completions.push(this.createOperatorCompletion(operatorName, operatorInfo));
        }
    }

    private createMethodCompletion(
        className: string,
        methodName: string,
        methodInfo: MethodInfo
    ): CompletionItem {
        const cleanedSignature = cleanSignature(methodInfo.signature);
        return {
            label: methodName,
            kind: CompletionItemKind.Method,
            detail: cleanedSignature,
            data: {
                type: 'method',
                className,
                methodName,
            },
            command: {
                title: 'Show Documentation',
                command: 'slimTools.showFunctionDoc',
                arguments: [`${className}.${methodName}`],
            },
        };
    }

    private createPropertyCompletion(
        className: string,
        propertyName: string,
        propertyInfo: PropertyInfo
    ): CompletionItem {
        const cleanedType = cleanTypeNames(propertyInfo.type);
        return {
            label: propertyName,
            kind: CompletionItemKind.Property,
            detail: `Type: ${cleanedType}`,
            data: {
                type: 'property',
                className,
                propertyName,
            },
            command: {
                title: 'Show Documentation',
                command: 'slimTools.showPropertyDoc',
                arguments: [`${className}.${propertyName}`],
            },
        };
    }

    private createFunctionCompletion(
        functionName: string,
        functionInfo: FunctionInfo
    ): CompletionItem {
        const signature = functionInfo.signature || functionInfo.signatures?.[0] || '';
        const cleanedSignature = cleanSignature(signature);
        return {
            label: functionName,
            kind: CompletionItemKind.Function,
            detail: cleanedSignature,
            data: {
                type: 'function',
                functionName,
            },
            command: {
                title: 'Show Documentation',
                command: 'slimTools.showFunctionDoc',
                arguments: [functionName],
            },
        };
    }

    private createCallbackCompletion(
        callbackName: string,
        callbackInfo: CallbackInfo
    ): CompletionItem {
        const cleanedSignature = cleanSignature(callbackInfo.signature);
        return {
            label: callbackName,
            kind: CompletionItemKind.Function,
            detail: cleanedSignature,
            data: {
                type: 'callback',
                callbackName,
            },
            command: {
                title: 'Show Documentation',
                command: 'slimTools.showFunctionDoc',
                arguments: [callbackName],
            },
        };
    }

    private createConstructorCompletion(
        className: string,
        constructorInfo: ConstructorInfo
    ): CompletionItem {
        const cleanedSignature = cleanSignature(constructorInfo.signature);
        return {
            label: className,
            kind: CompletionItemKind.Class,
            detail: cleanedSignature,
            data: {
                type: 'constructor',
                className,
            },
            command: {
                title: 'Show Documentation',
                command: 'slimTools.showConstructorDoc',
                arguments: [className],
            },
        };
    }
    
    private createOperatorCompletion(
        operatorName: string,
        operatorInfo: OperatorInfo
    ): CompletionItem {
        const cleanedSignature = cleanSignature(operatorInfo.signature);
        return {
            label: operatorName,
            kind: CompletionItemKind.Operator,
            detail: cleanedSignature,
            data: {
                type: 'operator',
                operatorName,
            },
            command: {
                title: 'Show Documentation',
                command: 'slimTools.showOperatorDoc',
                arguments: [operatorName],
            },
        };
    }
}


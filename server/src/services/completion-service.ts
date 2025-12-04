import {
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    Position,
    MarkupKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentationService } from './documentation-service';
import { trackInstanceDefinitions } from '../utils/instance';
import {
    createFunctionMarkdown,
    createMethodMarkdown,
    createPropertyMarkdown,
    createCallbackMarkdown,
    createConstructorMarkdown,
    createOperatorMarkdown,
    createUserFunctionMarkdown,
} from '../utils/markdown';
import {
    FunctionInfo,
    MethodInfo,
    PropertyInfo,
    CallbackInfo,
    OperatorInfo,
    ConstructorInfo,
    LanguageMode,
    TrackingState,
    WordInfo,
    UserFunctionInfo,
} from '../config/types';
import { cleanSignature, cleanTypeNames } from '../utils/text-processing';
import { getFileType } from '../utils/file-type';
import { resolveExpressionType } from '../utils/type-manager';
import { documentCache } from './document-cache';

export class CompletionService {
    constructor(private documentationService: DocumentationService) {}

    public getCompletions(
        document: TextDocument,
        position: Position
    ): CompletionItem[] | CompletionList | null {
        const lines = documentCache.getOrCreateLines(document);
        
        // Track instance definitions for better type resolution
        const trackingState = trackInstanceDefinitions(document);
        const instanceDefinitions = trackingState.instanceDefinitions as Record<string, string>;
        
        // Determine file type for filtering
        const fileType = getFileType(document);

        const completions: CompletionItem[] = [];
        
        // Get context at cursor position
        const context = getCompletionContext(lines, position, instanceDefinitions);

        if (context.wordContext.isMethodOrProperty && context.wordContext.className) {
            // Method/property completion on a type
            this.addMethodAndPropertyCompletions(
                context.wordContext.className,
                completions,
                fileType
            );
        } else {
            // Global completions
            this.addGlobalCompletions(completions, fileType);
            
            // Add user-defined symbols from tracking state
            this.addUserDefinedCompletions(completions, trackingState);
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
            case 'userVariable': {
                item.documentation = {
                    kind: MarkupKind.Markdown,
                    value: `**${data.varName}**\n\nUser-defined variable of type: \`${data.varType}\``,
                };
                break;
            }
            case 'userConstant': {
                item.documentation = {
                    kind: MarkupKind.Markdown,
                    value: `**${data.constName}**\n\nUser-defined constant${data.constType ? ` of type: \`${data.constType}\`` : ''}`,
                };
                break;
            }
            case 'subpopulation': {
                item.documentation = {
                    kind: MarkupKind.Markdown,
                    value: `**${data.subpopName}**\n\nSubpopulation defined in this simulation`,
                };
                break;
            }
            case 'mutationType': {
                item.documentation = {
                    kind: MarkupKind.Markdown,
                    value: `**${data.mutTypeName}**\n\nMutation type defined in this simulation`,
                };
                break;
            }
            case 'genomicElementType': {
                item.documentation = {
                    kind: MarkupKind.Markdown,
                    value: `**${data.getTypeName}**\n\nGenomic element type defined in this simulation`,
                };
                break;
            }
            case 'interactionType': {
                item.documentation = {
                    kind: MarkupKind.Markdown,
                    value: `**${data.intTypeName}**\n\nInteraction type defined in this simulation`,
                };
                break;
            }
            case 'userFunction': {
                const funcInfo = data.funcInfo as UserFunctionInfo;
                item.documentation = {
                    kind: MarkupKind.Markdown,
                    value: createUserFunctionMarkdown(funcInfo),
                };
                break;
            }
        }

        return item;
    }

    private addMethodAndPropertyCompletions(
        className: string,
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

    private addUserDefinedCompletions(
        completions: CompletionItem[],
        trackingState: TrackingState
    ): void {
        // Add user-defined constants
        for (const constName of trackingState.definedConstants) {
            const constType = trackingState.instanceDefinitions[constName];
            completions.push({
                label: constName,
                kind: CompletionItemKind.Constant,
                detail: constType ? `Constant: ${constType}` : 'User-defined constant',
                sortText: `0_${constName}`, // Sort user symbols first
                data: {
                    type: 'userConstant',
                    constName,
                    constType,
                },
            });
        }

        // Add subpopulations
        for (const subpopName of trackingState.definedSubpopulations) {
            completions.push({
                label: subpopName,
                kind: CompletionItemKind.Variable,
                detail: 'Subpopulation',
                sortText: `0_${subpopName}`,
                data: {
                    type: 'subpopulation',
                    subpopName,
                },
            });
        }

        // Add mutation types
        for (const mutTypeName of trackingState.definedMutationTypes) {
            completions.push({
                label: mutTypeName,
                kind: CompletionItemKind.Variable,
                detail: 'MutationType',
                sortText: `0_${mutTypeName}`,
                data: {
                    type: 'mutationType',
                    mutTypeName,
                },
            });
        }

        // Add genomic element types
        for (const getTypeName of trackingState.definedGenomicElementTypes) {
            completions.push({
                label: getTypeName,
                kind: CompletionItemKind.Variable,
                detail: 'GenomicElementType',
                sortText: `0_${getTypeName}`,
                data: {
                    type: 'genomicElementType',
                    getTypeName,
                },
            });
        }

        // Add interaction types
        for (const intTypeName of trackingState.definedInteractionTypes) {
            completions.push({
                label: intTypeName,
                kind: CompletionItemKind.Variable,
                detail: 'InteractionType',
                sortText: `0_${intTypeName}`,
                data: {
                    type: 'interactionType',
                    intTypeName,
                },
            });
        }

        // Add user-defined functions
        for (const [funcName, funcInfo] of trackingState.userFunctions) {
            completions.push(this.createUserFunctionCompletion(funcName, funcInfo));
        }

        // Add user-defined variables
        const builtIns = new Set(['sim', 'community', 'species']);
        const alreadyAdded = new Set([
            ...trackingState.definedConstants,
            ...trackingState.definedSubpopulations,
            ...trackingState.definedMutationTypes,
            ...trackingState.definedGenomicElementTypes,
            ...trackingState.definedInteractionTypes,
        ]);

        for (const [varName, varType] of Object.entries(trackingState.instanceDefinitions)) {
            if (builtIns.has(varName) || alreadyAdded.has(varName)) continue;
            
            completions.push({
                label: varName,
                kind: CompletionItemKind.Variable,
                detail: `Variable: ${varType}`,
                sortText: `1_${varName}`, 
                data: {
                    type: 'userVariable',
                    varName,
                    varType,
                },
            });
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
            sortText: `2_${functionName}`,
            data: {
                type: 'function',
                functionName,
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
            sortText: `2_${callbackName}`,
            data: {
                type: 'callback',
                callbackName,
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
            sortText: `2_${className}`,
            data: {
                type: 'constructor',
                className,
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
            sortText: `3_${operatorName}`, 
            data: {
                type: 'operator',
                operatorName,
            },
        };
    }

    private createUserFunctionCompletion(
        funcName: string,
        funcInfo: UserFunctionInfo
    ): CompletionItem {
        const signature = `(${funcInfo.returnType})${funcName}(${funcInfo.parameters})`;
        return {
            label: funcName,
            kind: CompletionItemKind.Function,
            detail: signature,
            sortText: `0_${funcName}`, // Sort user functions first
            data: {
                type: 'userFunction',
                funcName,
                funcInfo,
            },
        };
    }
}

function getCompletionContext(
    lines: string[],
    position: Position,
    instanceDefinitions: Record<string, string>
): WordInfo {
    if (position.line >= lines.length) {
        return { word: '', wordContext: { isMethodOrProperty: false } };
    }

    const line = lines[position.line];
    const lineUptoCursor = line.slice(0, position.character);

    // Check for chained property access
    const chainMatch = lineUptoCursor.match(/([a-zA-Z_][a-zA-Z0-9_.\[\]()]*)\s*\.\s*$/);
    
    if (chainMatch) {
        const expression = chainMatch[1];
        const className = resolveExpressionType(expression, instanceDefinitions);
        
        if (className) {
            return {
                word: '',
                wordContext: {
                    isMethodOrProperty: true,
                    className,
                    instanceName: expression,
                },
            };
        }
    }

    // Check for partial method/property after dot: "expr.partial"
    const partialChainMatch = lineUptoCursor.match(/([a-zA-Z_][a-zA-Z0-9_.\[\]()]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)$/);
    
    if (partialChainMatch) {
        const expression = partialChainMatch[1];
        const partial = partialChainMatch[2];
        const className = resolveExpressionType(expression, instanceDefinitions);
        
        if (className) {
            return {
                word: partial,
                wordContext: {
                    isMethodOrProperty: true,
                    className,
                    instanceName: expression,
                },
            };
        }
    }

    return { word: '', wordContext: { isMethodOrProperty: false } };
}

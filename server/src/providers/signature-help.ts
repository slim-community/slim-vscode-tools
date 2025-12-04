import { SignatureHelp, SignatureHelpParams, MarkupKind, ParameterInformation } from 'vscode-languageserver/node';
import { LanguageServerContext, MethodInfo, ConstructorInfo, CallContext, UserFunctionInfo } from '../config/types';
import { getFileType } from '../utils/file-type';
import { countCommasOutsideParens } from '../utils/text-processing';
import { trackInstanceDefinitions } from '../utils/instance';
import { resolveExpressionType } from '../utils/type-manager';
import { documentCache } from '../services/document-cache';

// Register signature help provider
export function registerSignatureHelpProvider(context: LanguageServerContext): void {
    const { connection, documents } = context;

    connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;

        const position = params.position;
    
        // Determine file type and get filtered data from service
        const fileType = getFileType(document);
    
        // Use cached tracking state for type resolution
        const trackingState = trackInstanceDefinitions(document);
        const instanceDefinitions = trackingState.instanceDefinitions as Record<string, string>;
    
        // Get the line up to cursor (use cached lines)
        const lines = documentCache.getOrCreateLines(document);
        if (position.line >= lines.length) return null;
    
    const line = lines[position.line];
    const textBeforeCursor = line.substring(0, position.character);
    
    // Find the last unclosed opening paren by tracking paren depth
    let openParenIndex = -1;
    let depth = 0;
    
    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
        const char = textBeforeCursor[i];
        if (char === ')') {
            depth++;
        } else if (char === '(') {
            if (depth === 0) {
                openParenIndex = i;
                break;
            }
            depth--;
        }
    }
    
    if (openParenIndex === -1) return null;
    
    // Parse the call context to determine what kind of signature help to provide
    const callContext = parseCallContext(textBeforeCursor, openParenIndex, instanceDefinitions);
    if (!callContext) return null;
    
    // Calculate active parameter by counting commas
    const textInParens = textBeforeCursor.substring(openParenIndex + 1);
    const commaCount = countCommasOutsideParens(textInParens);
    
    // Get signature help based on call context
    switch (callContext.kind) {
        case 'function': {
            // First check for user-defined functions
            const userFuncHelp = getUserFunctionSignatureHelp(
                callContext.name,
                commaCount,
                trackingState.userFunctions
            );
            if (userFuncHelp) return userFuncHelp;
            
            // Fall back to built-in functions
            return getFunctionSignatureHelp(
                callContext.name,
                commaCount,
                context.documentationService.getFunctions(fileType)
            );
        }
        
        case 'method':
            return getMethodSignatureHelp(
                callContext.className!,
                callContext.name,
                commaCount,
                context.documentationService.getClasses(fileType)
            );
        
        case 'constructor':
            return getConstructorSignatureHelp(
                callContext.name,
                commaCount,
                context.documentationService.getClassConstructors(fileType)
            );
    }
    });
}

function parseCallContext(
    textBeforeParen: string,
    openParenIndex: number,
    instanceDefinitions: Record<string, string>
): CallContext | null {
    const beforeParen = textBeforeParen.substring(0, openParenIndex).trimEnd();
    
    // Check for method call on an expression
    const methodMatch = beforeParen.match(/([a-zA-Z_][a-zA-Z0-9_.\[\]]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
    
    if (methodMatch) {
        const fullExpression = methodMatch[1];
        const methodName = methodMatch[2];
        
        // Resolve the type of the expression
        const className = resolveExpressionType(fullExpression, instanceDefinitions);
        
        if (className) {
            return {
                kind: 'method',
                name: methodName,
                className,
                openParenIndex
            };
        }
    }
    
    // Check for constructor call
    const constructorMatch = beforeParen.match(/([A-Z][a-zA-Z0-9_]*)\s*$/);
    if (constructorMatch) {
        const className = constructorMatch[1];
        return {
            kind: 'constructor',
            name: className,
            openParenIndex
        };
    }
    
    // Check for global function call
    const functionMatch = beforeParen.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
    if (functionMatch) {
        return {
            kind: 'function',
            name: functionMatch[1],
            openParenIndex
        };
    }
    
    return null;
}

function getUserFunctionSignatureHelp(
    functionName: string,
    commaCount: number,
    userFunctions: Map<string, UserFunctionInfo>
): SignatureHelp | null {
    const funcInfo = userFunctions.get(functionName);
    if (!funcInfo) return null;
    
    const signature = `${functionName}(${funcInfo.parameters})`;
    
    const { parameters, activeParameter } = parseSignatureParameters(signature, commaCount);
    
    const docComment = funcInfo.docComment || '';
    const documentation = docComment
        ? `**${functionName}** (user-defined function)\n\n**Return Type:** \`${funcInfo.returnType}\`\n\n${docComment}`
        : `**${functionName}** (user-defined function)\n\n**Return Type:** \`${funcInfo.returnType}\``;
    
    return {
        signatures: [{
            label: signature,
            documentation: {
                kind: MarkupKind.Markdown,
                value: documentation,
            },
            parameters: parameters,
        }],
        activeSignature: 0,
        activeParameter: activeParameter,
    };
}

function getFunctionSignatureHelp(
    functionName: string,
    commaCount: number,
    functionsData: Record<string, any>
): SignatureHelp | null {
    const functionInfo = functionsData[functionName];
    if (!functionInfo) return null;
    
    const signature = functionInfo.signature || functionInfo.signatures?.[0] || '';
    if (!signature) return null;
    
    const { parameters, activeParameter } = parseSignatureParameters(signature, commaCount);
    
    return {
        signatures: [{
            label: signature,
            documentation: {
                kind: MarkupKind.Markdown,
                value: `${signature}\n\n${functionInfo.description}`,
            },
            parameters: parameters,
        }],
        activeSignature: 0,
        activeParameter: activeParameter,
    };
}

function getMethodSignatureHelp(
    className: string,
    methodName: string,
    commaCount: number,
    classesData: Record<string, any>
): SignatureHelp | null {
    const classInfo = classesData[className];
    if (!classInfo?.methods) return null;
    
    const methodInfo: MethodInfo = classInfo.methods[methodName];
    if (!methodInfo?.signature) return null;
    
    const { parameters, activeParameter } = parseSignatureParameters(methodInfo.signature, commaCount);
    
    return {
        signatures: [{
            label: methodInfo.signature,
            documentation: {
                kind: MarkupKind.Markdown,
                value: `**${className}.${methodName}**\n\n${methodInfo.signature}\n\n${methodInfo.description}`,
            },
            parameters: parameters,
        }],
        activeSignature: 0,
        activeParameter: activeParameter,
    };
}

function getConstructorSignatureHelp(
    className: string,
    commaCount: number,
    constructorsData: Record<string, ConstructorInfo>
): SignatureHelp | null {
    const constructorInfo = constructorsData[className];
    if (!constructorInfo?.signature) return null;
    
    const { parameters, activeParameter } = parseSignatureParameters(constructorInfo.signature, commaCount);
    
    return {
        signatures: [{
            label: constructorInfo.signature,
            documentation: {
                kind: MarkupKind.Markdown,
                value: `**${className} Constructor**\n\n${constructorInfo.signature}\n\n${constructorInfo.description}`,
            },
            parameters: parameters,
        }],
        activeSignature: 0,
        activeParameter: activeParameter,
    };
}

// Helper function to parse signature parameters
function parseSignatureParameters(
    signature: string,
    commaCount: number
): { parameters: ParameterInformation[]; activeParameter: number } {
    // Extract parameters from signature
    const paramList = signature.match(/\((.*)\)/s);
    const paramsText = paramList ? paramList[1].trim() : '';
    
    // Handle empty parameter list
    if (!paramsText || paramsText === 'void') {
        return { parameters: [], activeParameter: 0 };
    }
    
    // Split parameters, accounting for nested brackets and parens
    const params = splitParameters(paramsText);
    
    const parameters: ParameterInformation[] = params.map(param => ({ 
        label: param.trim() 
    }));
    
    // Check if variadic
    const isVariadic = paramsText === '...' || paramsText.includes('...');
    
    // Calculate active parameter
    const activeParameter = isVariadic || commaCount >= parameters.length
        ? commaCount
        : Math.min(commaCount, Math.max(0, parameters.length - 1));
    
    return { parameters, activeParameter };
}

// Helper function to split parameters into an array of parameter strings
function splitParameters(paramsText: string): string[] {
    const params: string[] = [];
    let current = '';
    let depth = 0;
    let inBracket = 0;
    
    for (const char of paramsText) {
        if (char === '(' || char === '<') depth++;
        else if (char === ')' || char === '>') depth--;
        else if (char === '[') inBracket++;
        else if (char === ']') inBracket--;
        else if (char === ',' && depth === 0 && inBracket === 0) {
            params.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    
    if (current.trim()) {
        params.push(current.trim());
    }
    
    return params;
}

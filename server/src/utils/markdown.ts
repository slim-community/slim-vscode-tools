import { cleanSignature, cleanTypeNames, cleanDocumentationText } from '../utils/text-processing';
import { TICK_CYCLE_INFO } from '../config/config';
import {
    MethodInfo,
    PropertyInfo,
    FunctionInfo,
    CallbackInfo,
    TypeInfo,
    OperatorInfo,
    ConstructorInfo,
    LanguageMode,
    UserFunctionInfo,
} from '../config/types';

function normalizeTickCycleKey(signature: string, callbackName: string): string {
    let key = signature.replace(/\s+callbacks?$/i, '').trim();
    if (!key.includes('(')) key += '()';
    if (!TICK_CYCLE_INFO[key]) {
        const altKey = callbackName.replace(/\s+callbacks?$/i, '').trim();
        if (altKey && TICK_CYCLE_INFO[altKey]) return altKey;
    }
    return key;
}

function createTickCycleSection(tickCycleKey: string): string {
    const info = TICK_CYCLE_INFO[tickCycleKey];
    return info
        ? `\n\n**Tick Cycle:**\n- **WF model:** ${info.wf}\n- **nonWF model:** ${info.nonwf}\n`
        : '';
}

export function createMethodMarkdown(
    className: string,
    methodName: string,
    methodInfo: MethodInfo
): string {
    // Extract return type from signature, e.g., "(void)methodName()" -> "void"
    const returnTypeMatch = methodInfo.signature.match(/^\(([^)]+)\)/);
    const returnType = returnTypeMatch ? cleanTypeNames(returnTypeMatch[1]) : 'void';
    const signatureWithoutReturnType = methodInfo.signature.replace(/^\([^)]+\)\s*/, '');
    
    return `**${className}.${methodName}** (method)\n\n**Return Type:** \`${returnType}\`\n\n\`\`\`slim\n${cleanSignature(signatureWithoutReturnType)}\n\`\`\`\n\n${cleanDocumentationText(methodInfo.description)}`;
}

export function createPropertyMarkdown(
    className: string,
    propertyName: string,
    propertyInfo: PropertyInfo
): string {
    return `**${className}.${propertyName}** (property)\n\n**Type:** \`${cleanTypeNames(propertyInfo.type)}\`\n\n${cleanDocumentationText(propertyInfo.description)}`;
}

export function createPropertySourceMarkdown(
    variableName: string,
    className: string,
    propertyName: string,
    propertyInfo: PropertyInfo
): string {
    return `**${variableName}** ← \`${className}.${propertyName}\`\n\n**Type:** \`${cleanTypeNames(propertyInfo.type)}\`\n\n${cleanDocumentationText(propertyInfo.description)}`;
}

export function createFunctionMarkdown(
    functionName: string,
    functionInfo: FunctionInfo,
    source?: LanguageMode
): string {
    const sourceLabel = source || functionInfo.source || 'function';
    return `**${functionName}** (${sourceLabel} function)\n\n**Return Type:** \`${cleanTypeNames(functionInfo.returnType || 'void')}\`\n\n\`\`\`slim\n${cleanSignature(functionInfo.signature || '')}\n\`\`\`\n\n${cleanDocumentationText(functionInfo.description)}`;
}

export function createCallbackMarkdown(callbackName: string, callbackInfo: CallbackInfo): string {
    const signature = callbackInfo.signature || callbackName;
    const cleanedSignature = cleanSignature(signature);
    const tickCycleSection = createTickCycleSection(
        normalizeTickCycleKey(cleanedSignature, callbackName)
    );
    return `**${callbackName}** (callback)\n\n\`\`\`slim\n${cleanedSignature}\n\`\`\`${tickCycleSection}\n\n${cleanDocumentationText(callbackInfo.description)}`;
}

export function createTypeMarkdown(typeName: string, typeInfo: TypeInfo): string {
    return `**${typeName}** (type)\n\n${cleanDocumentationText(typeInfo.description)}`;
}

export function createOperatorMarkdown(operator: string, operatorInfo: OperatorInfo): string {
    return `**${operator}** (operator)\n\n${cleanDocumentationText(operatorInfo.description)}`;
}

export function createInstanceMarkdown(instanceName: string, instanceClass: string): string {
    return `**${instanceName}** (instance of ${instanceClass})`;
}

export function createEidosEventMarkdown(eventName: string, eventInfo: CallbackInfo): string {
    const fullEventName = eventName + '()';
    const tickCycleInfo = TICK_CYCLE_INFO[fullEventName];
    const tickCycleSection = tickCycleInfo
        ? `\n\n**Tick Cycle:**\n- **WF model:** ${tickCycleInfo.wf}\n- **nonWF model:** ${tickCycleInfo.nonwf}\n`
        : '';
    return `**${fullEventName}** (Eidos event)\n\n\`\`\`slim\n${fullEventName}\n\`\`\`${tickCycleSection}\n\n${cleanDocumentationText(eventInfo.description)}`;
}

export function createConstructorMarkdown(
    className: string,
    constructorInfo: ConstructorInfo
): string {
    return `**${className}** (constructor)\n\n\`\`\`slim\n${cleanSignature(constructorInfo.signature)}\n\`\`\`\n\n${cleanDocumentationText(constructorInfo.description)}`;
}

export function createUserFunctionMarkdown(funcInfo: UserFunctionInfo): string {
    const returnType = cleanTypeNames(funcInfo.returnType);
    const signature = `${funcInfo.name}(${funcInfo.parameters})`;
    
    let markdown = `**${funcInfo.name}** (user-defined function)\n\n`;
    markdown += `**Return Type:** \`${returnType}\`\n\n`;
    markdown += `\`\`\`slim\n${signature}\n\`\`\``;
    
    if (funcInfo.docComment) {
        markdown += `\n\n${funcInfo.docComment}`;
    }
    
    return markdown;
}
import { cleanSignature, cleanTypeNames, cleanDocumentationText } from './text-processing';
import { TICK_CYCLE_INFO } from '../config/config';
import {
    MethodInfo,
    PropertyInfo,
    FunctionData,
    CallbackInfo,
    TypeInfo,
    OperatorInfo,
    ConstructorInfo,
} from '../config/types';

type FunctionInfo = FunctionData;

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
    return `**${className}.${methodName}** (method)\n\`\`\`slim\n${cleanSignature(methodInfo.signature)}\n\`\`\`\n\n${cleanDocumentationText(methodInfo.description)}`;
}

export function createPropertyMarkdown(
    className: string,
    propertyName: string,
    propertyInfo: PropertyInfo
): string {
    return `**${className}.${propertyName}** (property)\nType: ${cleanTypeNames(propertyInfo.type)}\n\n${cleanDocumentationText(propertyInfo.description)}`;
}

export function createFunctionMarkdown(
    functionName: string,
    functionInfo: FunctionInfo,
    source?: 'SLiM' | 'Eidos'
): string {
    const sourceLabel = source || functionInfo.source || 'function';
    return `**${functionName}** (${sourceLabel} function)\n\n**Return Type:** \`${cleanTypeNames(functionInfo.returnType || 'void')}\`\n\`\`\`slim\n${cleanSignature(functionInfo.signature || '')}\n\`\`\`\n\n${cleanDocumentationText(functionInfo.description)}`;
}

export function createCallbackMarkdown(callbackName: string, callbackInfo: CallbackInfo): string {
    const signature = callbackInfo.signature || callbackName;
    const cleanedSignature = cleanSignature(signature);
    const tickCycleSection = createTickCycleSection(
        normalizeTickCycleKey(cleanedSignature, callbackName)
    );
    return `**${callbackName}** (callback)\n\n\`\`\`slim\n${cleanedSignature}\n\`\`\`${tickCycleSection}\n${cleanDocumentationText(callbackInfo.description)}`;
}

export function createTypeMarkdown(typeName: string, typeInfo: TypeInfo): string {
    return `**${typeName}** (type)\n\n${cleanDocumentationText(typeInfo.description)}`;
}

export function createOperatorMarkdown(operator: string, operatorInfo: OperatorInfo): string {
    return `**${operator}** (operator)\n\n${cleanDocumentationText(operatorInfo.description)}`;
}

/**
 * Creates markdown documentation for an instance.
 * @param instanceName - The instance name
 * @param instanceClass - The class name of the instance
 * @returns Markdown string for the instance
 */
export function createInstanceMarkdown(instanceName: string, instanceClass: string): string {
    return `**${instanceName}** (instance of ${instanceClass})`;
}

/**
 * Creates markdown documentation for an Eidos event.
 * @param eventName - The event name
 * @param eventInfo - The event information
 * @returns Markdown string for the event
 */
export function createEidosEventMarkdown(eventName: string, eventInfo: CallbackInfo): string {
    const fullEventName = eventName + '()';
    const tickCycleInfo = TICK_CYCLE_INFO[fullEventName];
    const tickCycleSection = tickCycleInfo
        ? `\n\n**Tick Cycle:**\n- **WF model:** ${tickCycleInfo.wf}\n- **nonWF model:** ${tickCycleInfo.nonwf}\n`
        : '';
    return `**${fullEventName}** (Eidos event)\n\n\`\`\`slim\n${fullEventName}\n\`\`\`${tickCycleSection}\n${cleanDocumentationText(eventInfo.description)}`;
}

/**
 * Creates markdown documentation for a constructor.
 * @param className - The class name
 * @param constructorInfo - The constructor information
 * @returns Markdown string for the constructor
 */
export function createConstructorMarkdown(
    className: string,
    constructorInfo: ConstructorInfo
): string {
    return `**${className}** (constructor)\n\n\`\`\`slim\n${cleanSignature(constructorInfo.signature)}\n\`\`\`\n\n${cleanDocumentationText(constructorInfo.description)}`;
}

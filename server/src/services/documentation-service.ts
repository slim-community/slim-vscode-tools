import * as fs from 'fs';
import { FunctionInfo, ClassInfo, CallbackInfo, TypeInfo, ConstructorInfo } from '../config/types';
import {
    SLIM_FUNCTIONS_PATH,
    EIDOS_FUNCTIONS_PATH,
    SLIM_CLASSES_PATH,
    EIDOS_CLASSES_PATH,
    SLIM_CALLBACKS_PATH,
    EIDOS_TYPES_PATH,
} from '../config/paths';

// Documentation data stores
export let functionsData: { [key: string]: FunctionInfo } = {};
export let classesData: { [key: string]: ClassInfo } = {};
export let callbacksData: { [key: string]: CallbackInfo } = {};
export let typesData: { [key: string]: TypeInfo } = {};

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

// Load all documentation files
export function loadDocumentation(): void {
    try {
        if (fs.existsSync(SLIM_FUNCTIONS_PATH)) {
            const slimFunctions = JSON.parse(fs.readFileSync(SLIM_FUNCTIONS_PATH, 'utf8'));
            functionsData = { ...functionsData, ...flattenFunctionData(slimFunctions, 'SLiM') };
            console.log('Loaded slim functions:', Object.keys(functionsData));
        }
        if (fs.existsSync(EIDOS_FUNCTIONS_PATH)) {
            const eidosFunctions = JSON.parse(fs.readFileSync(EIDOS_FUNCTIONS_PATH, 'utf8'));
            functionsData = { ...functionsData, ...flattenFunctionData(eidosFunctions, 'Eidos') };
            console.log('Loaded eidos functions:', Object.keys(functionsData));
        }
        if (fs.existsSync(SLIM_CLASSES_PATH)) {
            const slimClasses = JSON.parse(fs.readFileSync(SLIM_CLASSES_PATH, 'utf8'));
            classesData = { ...classesData, ...slimClasses };
            console.log('Loaded slim classes:', Object.keys(classesData));
        }
        if (fs.existsSync(EIDOS_CLASSES_PATH)) {
            const eidosClasses = JSON.parse(fs.readFileSync(EIDOS_CLASSES_PATH, 'utf8'));
            classesData = { ...classesData, ...eidosClasses };
            console.log('Loaded eidos classes:', Object.keys(classesData));
        }
        if (fs.existsSync(SLIM_CALLBACKS_PATH)) {
            const slimCallbacks = JSON.parse(fs.readFileSync(SLIM_CALLBACKS_PATH, 'utf8'));
            callbacksData = { ...callbacksData, ...flattenCallbackData(slimCallbacks) };
            console.log('Loaded slim callbacks:', Object.keys(callbacksData));
        }
        if (fs.existsSync(EIDOS_TYPES_PATH)) {
            typesData = JSON.parse(fs.readFileSync(EIDOS_TYPES_PATH, 'utf8'));
            console.log('Loaded eidos types:', Object.keys(typesData));
        }
        console.log('✅ Server loaded documentation successfully');
    } catch (error) {
        console.error('❌ Error loading documentation:', error);
    }
}

export function extractClassConstructors(classesData: { [key: string]: ClassInfo }): {
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


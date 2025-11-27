// Type definitions for SLiM Language Server

export interface FunctionInfo {
    signature: string;
    signatures: string[];
    description: string;
    returnType: string;
    source: string;
}

export interface MethodInfo {
    signature: string;
    description: string;
}

export interface PropertyInfo {
    type: string;
    description: string;
}

export interface ClassInfo {
    constructor?: {
        signature?: string;
        description?: string;
    };
    methods?: { [key: string]: MethodInfo };
    properties?: { [key: string]: PropertyInfo };
}

export interface CallbackInfo {
    signature: string;
    description: string;
}

export interface TypeInfo {
    description: string;
}

export interface WordContext {
    isMethodOrProperty: boolean;
    className?: string;
    instanceName?: string;
    instanceClass?: string;
}

export interface WordInfo {
    word: string;
    context: WordContext;
}

export interface ConstructorInfo {
    signature: string;
    description: string;
}


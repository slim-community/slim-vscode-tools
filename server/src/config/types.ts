import { Connection, TextDocument, TextDocuments } from 'vscode-languageserver';
import { DocumentationService } from '../services/documentation-service';

// CORE DATA STRUCTURES

/**
 * Function documentation data structure
 */
export interface FunctionData {
    signatures: string[];
    description: string;
    source?: 'SLiM' | 'Eidos';
    returnType?: string;
    signature?: string; // Primary signature (first from signatures array)
}

/**
 * Method information
 */
export interface MethodInfo {
    signature: string;
    description: string;
}

/**
 * Property information
 */
export interface PropertyInfo {
    type: string;
    description: string;
}

/**
 * Class documentation structure
 */
export interface ClassInfo {
    constructor?: {
        signature?: string;
        description?: string;
    };
    methods: Record<string, MethodInfo>;
    properties: Record<string, PropertyInfo>;
}

/**
 * Callback information
 */
export interface CallbackInfo {
    signature: string;
    description: string;
    // Add other callback properties as needed
}

/**
 * Type information
 */
export interface TypeInfo {
    description: string;
    // Add other type properties as needed
}

/**
 * Operator information
 */
export interface OperatorInfo {
    signature: string;
    description: string;
    symbol?: string;
    // Add other operator properties as needed
}

// Tracking state for instance definitions and constants
export interface TrackingState {
    instanceDefinitions: Record<string, string>;
    definedConstants: Set<string>;
    definedMutationTypes: Set<string>;
    definedGenomicElementTypes: Set<string>;
    definedInteractionTypes: Set<string>;
    definedSubpopulations: Set<string>;
    definedScriptBlocks: Set<string>;
    definedSpecies: Set<string>;
    modelType: 'WF' | 'nonWF' | null;
    callbackContextByLine: Map<number, string | null>;
}

// Callback context state
export interface CallbackState {
    currentCallback: string | null;
    braceDepth: number;
    callbackStartLine: number;
}

// Word context information for completion/hover
export interface WordContext {
    isMethodOrProperty: boolean;
    className?: string;
    instanceName?: string;
    instanceClass?: string;
}

// UTILS TYPES

// Parse state for tracking strings and comments
export interface ParseState {
    inString: boolean;
    stringChar: string | null;
    inSingleLineComment: boolean;
    inMultiLineComment: boolean;
}

// Options for parsing code
export interface ParseOptions {
    trackStrings?: boolean;
    trackComments?: boolean;
    trackMultiLineComments?: boolean;
}

// Parameter information extracted from signatures
export interface ParameterInfo {
    name: string | null;
    type: string;
    isOptional: boolean;
    defaultValue?: string;
}

// Constructor information
export interface ConstructorInfo {
    signature: string;
    description: string;
}

// Argument information for function calls
export interface ArgumentInfo {
    value: string;
    start: number;
    end: number;
}

// Language server context
export interface LanguageServerContext {
    connection: Connection;
    documents: TextDocuments<TextDocument>;
    documentationService: DocumentationService;
}

import { Connection } from 'vscode-languageserver/node';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentationService } from '../services/documentation-service';
import { CompletionService } from '../services/completion-service';

// ============================================================================
// Language mode
// ============================================================================

export type LanguageMode = 'eidos' | 'slim';

// ============================================================================
// Documentation types
// ============================================================================

export interface FunctionInfo {
    signatures: string[];
    description: string;
    source?: LanguageMode;
    returnType?: string;
    signature?: string; // Primary signature (first from signatures array)
}

export interface MethodInfo {
    signature: string;
    description: string;
}

export interface PropertyInfo {
    type: string;
    description: string;
}

export interface ConstructorInfo {
    signature: string;
    description: string;
}

export interface ClassInfo {
    constructor?: {
        signature?: string;
        description?: string;
    };
    methods?: { [key: string]: MethodInfo };
    properties?: { [key: string]: PropertyInfo };
    source?: LanguageMode;
}

export interface CallbackInfo {
    signature: string;
    description: string;
    source?: LanguageMode;
}

export interface TypeInfo {
    description: string;
    source?: LanguageMode; // Eidos types are available in both modes
}

export interface OperatorInfo {
    signature: string;
    description: string;
    source?: LanguageMode; // Eidos operators are available in both modes
}

export interface TickCycleInfo {
    wf: string;
    nonwf: string;
}

// ============================================================================
// Word and context analysis
// ============================================================================

export interface WordContext {
    isMethodOrProperty: boolean;
    className?: string;
    instanceName?: string;
    instanceClass?: string;
}

export interface WordInfo {
    word: string;
    wordContext: WordContext;
}

// ============================================================================
// Parsing types
// ============================================================================

export interface ParseState {
    inString: boolean;
    stringChar: string | null;
    inSingleLineComment: boolean;
    inMultiLineComment: boolean;
}

export interface ParseOptions {
    trackStrings?: boolean;
    trackComments?: boolean;
    trackMultiLineComments?: boolean;
}

// ============================================================================
// State tracking
// ============================================================================

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


// ============================================================================
// Language server
// ============================================================================

export interface LanguageServerContext {
    connection: Connection;
    documents: TextDocuments<TextDocument>;
    documentationService: DocumentationService;
    completionService: CompletionService;
}

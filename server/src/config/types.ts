import { Connection } from 'vscode-languageserver/node';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentationService } from '../services/documentation-service';
import { CompletionService } from '../services/completion-service';
import { ValidationService } from '../services/validation-service';
import { Diagnostic, FoldingRangeKind, Range } from 'vscode-languageserver';

// ============================================================================
// Language mode
// ============================================================================

// Supported script language modes: Eidos scripting language or SLiM simulation language
export type LanguageMode = 'eidos' | 'slim';

// ============================================================================
// Documentation types
// ============================================================================

// Documentation for a built-in function: signatures, description, and optional metadata
export interface FunctionInfo {
    signatures: string[];
    description: string;
    source?: LanguageMode;
    returnType?: string;
    signature?: string; // Primary signature (first from signatures array)
}

// Documentation for a class method: its signature and description
export interface MethodInfo {
    signature: string;
    description: string;
}

// Documentation for a class property: its type and description
export interface PropertyInfo {
    type: string;
    description: string;
}

// Documentation for a class constructor: its signature and description
export interface ConstructorInfo {
    signature: string;
    description: string;
}

// Complete documentation for a class: constructor, methods, properties, and source language
export interface ClassInfo {
    constructor?: {
        signature?: string;
        description?: string;
    };
    methods?: { [key: string]: MethodInfo };
    properties?: { [key: string]: PropertyInfo };
    source?: LanguageMode;
}

// Documentation for a SLiM callback (e.g., early, late, fitness callbacks)
export interface CallbackInfo {
    signature: string;
    description: string;
    source?: LanguageMode;
}

// Documentation for a primitive or built-in type (e.g., integer, float, string)
export interface TypeInfo {
    description: string;
    source?: LanguageMode; // Eidos types are available in both modes
}

// Parsed type separating base type from vector/singleton modifiers ([], $)
export interface ParsedTypeInfo {
    baseType: string;      // The type name without [] or $ suffix
    isSingleton: boolean;  // true for singleton types, false for vectors
}

// Documentation for an Eidos operator (e.g., arithmetic, logical, comparison)
export interface OperatorInfo {
    signature: string;
    description: string;
}

// Tick cycle descriptions for Wright-Fisher (WF) and non-Wright-Fisher (nonWF) models
export interface TickCycleInfo {
    wf: string;
    nonwf: string;
}

// ============================================================================
// Word and context analysis
// ============================================================================

// Context for a word: whether it's a method/property access and associated class info
export interface WordContext {
    isMethodOrProperty: boolean;
    className?: string;
    instanceName?: string;
    instanceClass?: string;
}

// A word extracted from source code along with its contextual information
export interface WordInfo {
    word: string;
    wordContext: WordContext;
}

// A word with its document range and whether it appears inside quotes
export interface WordInfoWithRange {
    word: string;
    isQuoted: boolean;
    range: Range;
}

// ============================================================================
// Parsing types
// ============================================================================

// Parser state tracking position within strings and comments
export interface ParseState {
    inString: boolean;
    stringChar: string | null;
    inSingleLineComment: boolean;
    inMultiLineComment: boolean;
}

// Configuration for what the parser should track (strings, comments)
export interface ParseOptions {
    trackStrings?: boolean;
    trackComments?: boolean;
    trackMultiLineComments?: boolean;
}

// State for parsing string literals, tracking escape sequences
export interface StringParseState {
    inString: boolean;
    escapeNext: boolean;
}

// ============================================================================
// Formatting
// ============================================================================

// Core formatting options: indentation size and tabs vs spaces
export interface FormattingOptions {
    tabSize: number;
    insertSpaces: boolean;
}

// User-configurable formatting preferences with optional overrides
export interface UserFormattingConfig {
    tabSize?: number;
    insertSpaces?: boolean;
    maxConsecutiveBlankLines?: number;
}

// ============================================================================
// State tracking
// ============================================================================

// Tracks origin of a variable assigned from a class property (e.g., x = sim.generation)
export interface PropertySourceInfo {
    className: string;
    propertyName: string;
}

// Document-wide state tracking instances, definitions, user functions, and model type
export interface TrackingState {
    instanceDefinitions: Record<string, string>;
    propertyAssignments: Map<string, PropertySourceInfo>;
    definedConstants: Set<string>;
    definedMutationTypes: Set<string>;
    definedGenomicElementTypes: Set<string>;
    definedInteractionTypes: Set<string>;
    definedSubpopulations: Set<string>;
    definedScriptBlocks: Set<string>;
    definedSpecies: Set<string>;
    userFunctions: Map<string, UserFunctionInfo>;
    modelType: 'WF' | 'nonWF' | null;
    callbackContextByLine: Map<number, string | null>;
}

// Tracks current callback block during parsing (name, nesting depth, start line)
export interface CallbackState {
    currentCallback: string | null;
    braceDepth: number;
    callbackStartLine: number;
}

// ============================================================================
// Caching
// ============================================================================

// Cached document data: version, parsed lines, tracking state, and diagnostics
export interface CacheEntry {
    version: number;
    lines?: string[];
    trackingState?: TrackingState;
    diagnostics?: Diagnostic[];
}

// Cache performance metrics: hit/miss counts and eviction count
export interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
}

// ============================================================================
// Validation
// ============================================================================

// State for validating code structure: brace/paren/bracket balance and string tracking
export interface StructureValidationState {
    braceCount: number;
    lastOpenBraceLine: number;
    parenBalance: number;
    bracketBalance: number;
    inString: boolean;
    stringChar: string | null;
    stringStartLine: number;
    stringStartChar: number;
}

// ============================================================================
// Context
// ============================================================================

// Main language server context: connection, documents, and all services
export interface LanguageServerContext {
    connection: Connection;
    documents: TextDocuments<TextDocument>;
    documentationService: DocumentationService;
    completionService: CompletionService;
    validationService: ValidationService;
}

// Context for an active function/method/constructor call (for signature help)
export interface CallContext {
    kind: 'function' | 'method' | 'constructor';
    name: string;
    className?: string;
    openParenIndex: number;
}

// ============================================================================
// Eidos function parser
// ============================================================================

// Parsed Eidos function signature: return type, name, parameters, and full text
export interface EidosFunctionSignature {
    returnType: string;
    functionName: string;
    parameters: EidosFunctionParameter[];
    fullSignature: string;
}

// A single parameter in an Eidos function signature: type and name
export interface EidosFunctionParameter {
    type: string;
    name: string;
}

// Metadata for a user-defined function: signature, return type, parameters, and doc comment
export interface UserFunctionInfo {
    name: string;
    signature: string;
    returnType: string;
    parameters: string;
    docComment: string | null;
    line: number;
}

// ============================================================================
// Ranges
// ============================================================================

// Character ranges of comments within a line (single-line and multi-line)
export interface CommentRanges {
    singleLineCommentStart: number;
    multiLineCommentRanges: Array<{ start: number; end: number }>;
}

// Code block type for folding ranges: kind (comment, region) and type identifier
export interface BlockType {
    kind?: FoldingRangeKind;
    type: string;
}
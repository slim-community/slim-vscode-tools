import { TickCycleInfo } from './types';

// ============================================================================
// Classes and types
// ============================================================================

export const CLASS_NAMES: Readonly<Record<string, string>> = {
    SPECIES: 'Species',
    COMMUNITY: 'Community',
    INDIVIDUAL: 'Individual',
    HAPLOSOME: 'Haplosome',
    MUTATION: 'Mutation',
    CHROMOSOME: 'Chromosome',
    SUBPOPULATION: 'Subpopulation',
    MUTATION_TYPE: 'MutationType',
    GENOMIC_ELEMENT_TYPE: 'GenomicElementType',
    INTERACTION_TYPE: 'InteractionType',
    LOGFILE: 'LogFile',
    DICTIONARY: 'Dictionary',
    SLIMEIDOS_BLOCK: 'SLiMEidosBlock',
} as const;

export const TYPE_NAMES = {
    INTEGER: 'integer',
    FLOAT: 'float',
    STRING: 'string',
    LOGICAL: 'logical',
    OBJECT: 'object',
    NUMERIC: 'numeric',
    NULL: 'NULL',
    INF: 'INF',
    VOID: 'void',
} as const;

// Known instance to class mappings
// These are built-in instances that should be recognized without explicit definition
export const INSTANCE_TO_CLASS_MAP: { [key: string]: string } = {
    sim: CLASS_NAMES.SPECIES,
    community: CLASS_NAMES.COMMUNITY,
    species: CLASS_NAMES.SPECIES,
    ind: CLASS_NAMES.INDIVIDUAL,
    genome: CLASS_NAMES.HAPLOSOME,
    mut: CLASS_NAMES.MUTATION,
    muts: CLASS_NAMES.MUTATION,
    mutations: CLASS_NAMES.MUTATION,
    mutation: CLASS_NAMES.MUTATION,
    chromosome: CLASS_NAMES.CHROMOSOME,
    chr: CLASS_NAMES.CHROMOSOME,
};

// ============================================================================
// Operators
// ============================================================================

export const TWO_CHAR_OPS = ['==', '!=', '<=', '>=', '&&', '||', '<-', '->'];

export const SINGLE_CHAR_OPS = [
    ':',
    '[',
    ']',
    '+',
    '-',
    '*',
    '/',
    '%',
    '^',
    '|',
    '&',
    '!',
    '<',
    '>',
    '=',
    '?',
    '(',
    ')',
    '.',
];

// ============================================================================
// Callbacks
// ============================================================================

export const EIDOS_EVENT_NAMES: readonly string[] = ['early', 'late', 'first'];

export const CALLBACK_NAMES: readonly string[] = [
    'initialize',
    'mutationEffect',
    'fitnessEffect',
    'mateChoice',
    'modifyChild',
    'recombination',
    'interaction',
    'reproduction',
    'mutation',
    'survival',
    ...EIDOS_EVENT_NAMES,
];

export const CALLBACK_PSEUDO_PARAMETERS: Readonly<Record<string, Record<string, string>>> = {
    'initialize()': {},
    'mutationEffect()': {
        mut: CLASS_NAMES.MUTATION,
        homozygous: TYPE_NAMES.LOGICAL,
        effect: TYPE_NAMES.FLOAT,
    },
    'fitnessEffect()': {
        individual: CLASS_NAMES.INDIVIDUAL,
        subpop: CLASS_NAMES.SUBPOPULATION,
    },
    'mateChoice()': {
        sourceSubpop: CLASS_NAMES.SUBPOPULATION,
        weights: TYPE_NAMES.FLOAT,
        individual: CLASS_NAMES.INDIVIDUAL,
        subpop: CLASS_NAMES.SUBPOPULATION,
    },
    'modifyChild()': {
        child: CLASS_NAMES.INDIVIDUAL,
        isCloning: TYPE_NAMES.LOGICAL,
        isSelfing: TYPE_NAMES.LOGICAL,
        parent1: CLASS_NAMES.INDIVIDUAL,
        parent2: CLASS_NAMES.INDIVIDUAL,
        sourceSubpop: CLASS_NAMES.SUBPOPULATION,
    },
    'recombination()': {
        haplosome1: CLASS_NAMES.HAPLOSOME,
        haplosome2: CLASS_NAMES.HAPLOSOME,
        breakpoints: TYPE_NAMES.INTEGER,
        individual: CLASS_NAMES.INDIVIDUAL,
        subpop: CLASS_NAMES.SUBPOPULATION,
    },
    'interaction()': {
        distance: TYPE_NAMES.FLOAT,
        strength: TYPE_NAMES.FLOAT,
        receiver: CLASS_NAMES.INDIVIDUAL,
        exerter: CLASS_NAMES.INDIVIDUAL,
    },
    'reproduction()': {
        individual: CLASS_NAMES.INDIVIDUAL,
        subpop: CLASS_NAMES.SUBPOPULATION,
    },
    'mutation()': {
        mut: CLASS_NAMES.MUTATION,
        haplosome: CLASS_NAMES.HAPLOSOME,
        element: 'GenomicElement',
        originalNuc: TYPE_NAMES.INTEGER,
        parent: CLASS_NAMES.INDIVIDUAL,
        subpop: CLASS_NAMES.SUBPOPULATION,
    },
    'survival()': {
        surviving: TYPE_NAMES.LOGICAL,
        fitness: TYPE_NAMES.FLOAT,
        draw: TYPE_NAMES.FLOAT,
        individual: CLASS_NAMES.INDIVIDUAL,
        subpop: CLASS_NAMES.SUBPOPULATION,
    },
} as const;

export const TICK_CYCLE_INFO: Readonly<Record<string, TickCycleInfo>> = {
    'first()': {
        wf: 'Step 0: Executes first in the tick cycle',
        nonwf: 'Step 0: Executes first in the tick cycle',
    },
    'early()': {
        wf: 'Step 1: Executes early in the tick cycle (after first(), before offspring generation)',
        nonwf: 'Step 2: Executes after offspring generation, before fitness calculation',
    },
    'late()': {
        wf: 'Step 5: Executes late in the tick cycle (after offspring become parents)',
        nonwf: 'Step 6: Executes late in the tick cycle (after selection and mutation removal)',
    },
    'initialize()': {
        wf: 'Pre-simulation: Executes before the simulation starts (not part of tick cycle)',
        nonwf: 'Pre-simulation: Executes before the simulation starts (not part of tick cycle)',
    },
    'mutationEffect()': {
        wf: 'Step 3: Called during fitness recalculation (at end of tick, for next tick)',
        nonwf: 'Step 3: Called during fitness recalculation (same tick)',
    },
    'fitnessEffect()': {
        wf: 'Step 3: Called during fitness recalculation (at end of tick, for next tick)',
        nonwf: 'Step 3: Called during fitness recalculation (same tick)',
    },
    'mateChoice()': {
        wf: 'Step 2.3: Called during offspring generation when choosing parent 2',
        nonwf: 'N/A: Not used in nonWF models (mating is script-controlled)',
    },
    'modifyChild()': {
        wf: 'Step 2.5: Called during offspring generation to suppress/modify child',
        nonwf: 'Step 1.4: Called during offspring generation to suppress/modify child',
    },
    'mutation()': {
        wf: 'Step 2.4: Called during offspring generation when mutations are created',
        nonwf: 'Step 1.3: Called during offspring generation when mutations are created',
    },
    'recombination()': {
        wf: 'Step 2.4: Called during offspring generation when gametes are created',
        nonwf: 'Step 1.3: Called during offspring generation when gametes are created',
    },
    'reproduction()': {
        wf: 'N/A: Not used in WF models (reproduction is automatic)',
        nonwf: 'Step 1.1: Called to trigger reproduction (script-controlled)',
    },
    'survival()': {
        wf: 'N/A: Not used in WF models (parents always die)',
        nonwf: 'Step 4: Called during selection phase to determine survival',
    },
    'interaction()': {
        wf: 'On-demand: Called when interaction strengths are evaluated (various points)',
        nonwf: 'On-demand: Called when interaction strengths are evaluated (various points)',
    },
} as const;

// ============================================================================
// Text processing patterns
// ============================================================================

export const TEXT_PROCESSING_PATTERNS = {
    WHITESPACE: /\s/,
    DIGIT: /\d/,
    NUMBER: /[\d.eE+-]/,
    IDENTIFIER_START: /[a-zA-Z_$]/,
    IDENTIFIER_CHAR: /[a-zA-Z0-9_$]/,
    OPERATOR_PUNCTUATION: /[+\-*/%=<>?:!.,;()[\]{}]/,
    KEYWORD: /^(if|else|for|while|do|return|break|continue|function|in|next)$/,
    WORD_CHAR: /^\w/,
    VALID_TERMINATOR: /^[\s\.,;:\)\]\}\+\-\*\/\%\<\>\=\!\&\|\?]/,
    OPEN_PAREN_AFTER_WS: /^\s*\(/,
    NULL_KEYWORD: /\b(NULL|null)\b/,
    RETURN_TYPE: /^\(([^)]+)\)/,
    PARAMETER_LIST: /\(([^)]*(?:\([^)]*\))?[^)]*)\)$/,
    OPTIONAL_PARAMETER: /^\[([^\]]+)\]/,
    TYPE_NAME_PARAM: /^([\w<>]+(?:\$)?)\s+(\w+)(?:\s*=\s*(.+))?$/,
    TYPE_ONLY: /^([\w<>]+(?:\$)?)/,
    NULLABLE_TYPE: /^N[^<]*/,
    NULLABLE_OBJECT_TYPE: /^No</,
    DOLLAR_SUFFIX: /\$$/,
    COMMENT_LINE: /^\s*\/[\/\*]/,
    COMMENT_CONTINUATION: /^\s*\*/,
    EMPTY_LINE: /^\s*$/,
    SINGLE_LINE_COMMENT: /\/\/.*$/,
    MULTILINE_COMMENT: /\/\*.*?\*\//g,
} as const;

export const TYPE_PATTERNS = {
    SUBPOPULATION: /^p\d+$/,
    MUTATION_TYPE: /^m\d+$/,
    GENOMIC_ELEMENT_TYPE: /^g\d+$/,
    INTERACTION_TYPE: /^i\d+$/,
    TYPE_ID_IN_CONTEXT: /[^a-zA-Z0-9_](p\d+|m\d+|g\d+|i\d+)[^a-zA-Z0-9_]/,
} as const;

export const TYPE_INFERENCE_PATTERNS = {
    NUMERIC_FUNCTIONS:
        /^(sum|mean|min|max|abs|sqrt|log|exp|sin|cos|tan|round|floor|ceil|length|size|sd|var)\s*\(/,
    ARITHMETIC_OPERATORS: /[+\-*\/%]/,
    LOGICAL_OPERATORS: /^(==|!=|<|>|<=|>=|&&|\|\||!)/,
    LOGICAL_FUNCTIONS: /^(all|any|isNULL|isNAN|isFinite|isInfinite)\s*\(/,
    SUBPOPULATION_METHODS:
        /\.(addSubpop|addSubpopSplit|subpopulations|subpopulationsWithIDs|subpopulationsWithNames|subpopulationByID)(\[|$|\()/,
    INDIVIDUAL_METHODS: /\.(individuals|sampleIndividuals|individualsWithPedigreeIDs)(\[|$|\()/,
    HAPLOSOME_METHODS: /\.(genomes|haplosomesForChromosomes|genome1|genome2)(\[|$|\()/,
    MUTATION_METHODS:
        /\.(mutations|mutationsOfType|mutationsFromHaplosomes|uniqueMutationsOfType)(\[|$|\()/,
    MUTATION_TYPE_METHODS:
        /(initializeMutationType|initializeMutationTypeNuc|\.mutationTypesWithIDs)\(/,
    GENOMIC_ELEMENT_TYPE_METHODS: /(initializeGenomicElementType|\.genomicElementTypesWithIDs)\(/,
    INTERACTION_TYPE_METHODS: /(initializeInteractionType|\.interactionTypesWithIDs)\(/,
    CHROMOSOME_METHODS: /(initializeChromosome|\.chromosomesWithIDs|\.chromosomesOfType)\(/,
    LOGFILE_METHODS: /\.createLogFile\(/,
} as const;

export const IDENTIFIER_PATTERNS = {
    WORD: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,
    METHOD_CALL: /\b(\w+)\s*\.\s*(\w+)\s*\(/g,
    PROPERTY_ACCESS: /\b(\w+)\s*\.\s*(\w+)\b(?![\(\w])/g,
    DOT_PATTERN: /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*$/,
    DOT_WITH_MEMBER: /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)?/g,
} as const;

export const DEFINITION_PATTERNS = {
    DEFINE_CONSTANT: /defineConstant\s*\(\s*"(\w+)"\s*,/,
    MUTATION_TYPE: /initializeMutationType\s*\(\s*"?(m\d+)"?/,
    GENOMIC_ELEMENT_TYPE: /initializeGenomicElementType\s*\(\s*"?(g\d+)"?/,
    INTERACTION_TYPE: /initializeInteractionType\s*\(\s*"?(i\d+)"?/,
    SUBPOP: /(?:sim|species|\w+)\.addSubpop\("(\w+)"/,
    SUBPOP_SPLIT: /(?:sim|species|\w+)\.addSubpopSplit\("(\w+)"/,
    SUBPOP_NUMERIC: /(?:sim|species|\w+)\.addSubpop\s*\(\s*(\d+)\s*,/,
    SUBPOP_SPLIT_NUMERIC: /(?:sim|species|\w+)\.addSubpopSplit\s*\(\s*(\d+)\s*,/,
    SPECIES: /species\s+(\w+)\s+initialize/,
    SCRIPT_BLOCK:
        /(?:first|early|late|initialize|fitnessEffect|interaction|mateChoice|modifyChild|mutation|mutationEffect|recombination|reproduction|survival)\s*\(\s*"(\w+)"\s*\)/,
    INSTANCE: /(\w+)\s*=\s*new\s+(\w+)/,
    ASSIGNMENT: /(\w+)\s*=\s*([^;]+)/,
    CONSTANT_VALUE: /defineConstant\s*\(\s*"[^"]+"\s*,\s*(.+?)(?:\)|$)/,
    USER_FUNCTION: /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
} as const;

export const VALIDATION_PATTERNS = {
    MUTATION_TYPE_REF: /\b(m\d+)\b/g,
    GENOMIC_ELEMENT_TYPE_REF: /\b(g\d+)\b/g,
    SUBPOPULATION_REF: /\b(p\d+)\b/g,
    DYNAMIC_MUT_TYPE: /initializeMutationType(?:Nuc)?\s*\(\s*[^"']/,
    DYNAMIC_MUT_TYPE_CONCAT: /initializeMutationType(?:Nuc)?\s*\(\s*[^"']*\+/,
    DYNAMIC_GEN_ELEM_TYPE: /initializeGenomicElementType\s*\(\s*[^"']/,
    DYNAMIC_GEN_ELEM_TYPE_CONCAT: /initializeGenomicElementType\s*\(\s*[^"']*\+/,
    DYNAMIC_SUBPOP: /(sim\.)?(addSubpop|addSubpopSplit)\s*\(\s*[^"']/,
} as const;

export const CONTROL_FLOW_PATTERNS = {
    CONTROL_FLOW_KEYWORDS:
        /\b(if|else|while|for|function|return|break|continue|switch|case|default)\s*\(/,
    CONTROL_FLOW_STATEMENT: /^\s*(if|else|while|for|switch|case|default)\b.*\)?\s*{?\s*$/,
    CALLBACK_DEFINITION_STATEMENT: /^(initialize|early|late|fitness)\s*\([^)]*\)\s*{?\s*$/,
    SLIM_EVENT_BLOCK: /^\s*(s\d+\s+)?\d+\s+(early|late|reproduction|fitness)\s*\(\)\s*$/,
} as const;

export const EVENT_PATTERNS = {
    STANDARD_EVENT: /^\s*\d+\s+(first|early|late)\s*\(/m,
    SPECIES_EVENT: /^\s*s\d+\s+\d+\s+(first|early|late)\s*\(/m,
    SLIM_BLOCK: /^\d+\s+\w+\(\)/,
    SLIM_BLOCK_SPECIES: /^s\d+\s+\d+\s+\w+\(\)/,
    INITIALIZE: /initialize\s*\(/,
    EVENT_WITH_PARAMS: /(first|early|late)\s*\(\s*[^)]+\s*\)\s*\{/,
    EVENT_MATCH: /(first|early|late)\s*\(/,
    OLD_SYNTAX: /^\s*(\d+)\s*\{/,
} as const;

export const CALLBACK_REGISTRATION_PATTERNS = {
    EARLY_EVENT: /community\.registerEarlyEvent\("(\w+)",\s*[^)]*\)/,
    FIRST_EVENT: /community\.registerFirstEvent\("(\w+)",\s*[^)]*\)/,
    INTERACTION_CALLBACK: /community\.registerInteractionCallback\("(\w+)",\s*[^)]*\)/,
    LATE_EVENT: /community\.registerLateEvent\("(\w+)",\s*[^)]*\)/,
    FITNESS_EFFECT_CALLBACK: /species\.registerFitnessEffectCallback\("(\w+)",\s*[^)]*\)/,
    MATE_CHOICE_CALLBACK: /species\.registerMateChoiceCallback\("(\w+)",\s*[^)]*\)/,
    MODIFY_CHILD_CALLBACK: /species\.registerModifyChildCallback\("(\w+)",\s*[^)]*\)/,
    MUTATION_CALLBACK: /species\.registerMutationCallback\("(\w+)",\s*[^)]*\)/,
    MUTATION_EFFECT_CALLBACK: /species\.registerMutationEffectCallback\("(\w+)",\s*[^)]*\)/,
    RECOMBINATION_CALLBACK: /species\.registerRecombinationCallback\("(\w+)",\s*[^)]*\)/,
    REPRODUCTION_CALLBACK: /species\.registerReproductionCallback\("(\w+)",\s*[^)]*\)/,
    SURVIVAL_CALLBACK: /species\.registerSurvivalCallback\("(\w+)",\s*[^)]*\)/,
} as const;

const callbackNamesJoined = CALLBACK_NAMES.join('|');

export const COMPILED_CALLBACK_PATTERNS = {
    CALLBACK_WITH_BRACE: new RegExp(
        `(?:species\\s+\\w+\\s+)?(?:s\\d+\\s+)?(?:\\d+(?::\\d+)?\\s+)?(${callbackNamesJoined})\\s*\\([^)]*\\)\\s*\\{`,
        'i'
    ),
    CALLBACK_WITHOUT_BRACE: new RegExp(
        `(?:species\\s+\\w+\\s+)?(?:s\\d+\\s+)?(?:\\d+(?::\\d+)?\\s+)?(${callbackNamesJoined})\\s*\\([^)]*\\)\\s*$`,
        'i'
    ),
    CALLBACK_CALL: new RegExp(`\\b(${callbackNamesJoined})\\s*\\(`, 'i'),
} as const;

export const EIDOS_FUNCTION_REGEX = /function\s*\(([^)]+)\)\s*(\w+)\s*\(([^)]*)\)/;

export const QUOTED_DEFINITION_FUNCTION_PATTERNS = [
    /defineConstant\s*\(\s*$/,
    /initializeMutationType\s*\(\s*$/,
    /initializeGenomicElementType\s*\(\s*$/,
    /initializeInteractionType\s*\(\s*$/,
    /addSubpop\s*\(\s*$/,
    /addSubpopSplit\s*\(\s*$/,
    /initializeSpecies\s*\(\s*$/,
    /registerEarlyEvent\s*\(\s*$/,
    /registerLateEvent\s*\(\s*$/,
    /registerFirstEvent\s*\(\s*$/,
    /registerFitnessCallback\s*\(\s*$/,
    /registerInteractionCallback\s*\(\s*$/,
    /registerMateChoiceCallback\s*\(\s*$/,
    /registerModifyChildCallback\s*\(\s*$/,
    /registerMutationCallback\s*\(\s*$/,
    /registerMutationEffectCallback\s*\(\s*$/,
    /registerRecombinationCallback\s*\(\s*$/,
    /registerReproductionCallback\s*\(\s*$/,
    /registerSurvivalCallback\s*\(\s*$/,
];

// ============================================================================
// Validation error messages
// ============================================================================

export const ERROR_MESSAGES = {
    // Brace errors
    UNEXPECTED_CLOSING_BRACE: 'Unexpected closing brace',
    UNCLOSED_BRACE: 'Unclosed brace(s)',

    // Semicolon warnings
    MISSING_SEMICOLON: 'Statement might be missing a semicolon',

    // String errors
    UNCLOSED_STRING: 'Unclosed string literal (missing closing quote)',

    // Event errors
    NO_EIDOS_EVENT:
        'No Eidos event found to start the simulation. At least one first(), early(), or late() event is required.',
    OLD_SYNTAX:
        'Event type must be specified explicitly. Use "1 early() { ... }" instead of "1 { ... }"',
    EVENT_PARAMETERS: (eventName: string) => `${eventName}() event needs 0 parameters`,

    // Definition errors
    DUPLICATE_DEFINITION: (typeName: string, id: string, firstLine: number) =>
        `${typeName} ${id} already defined (first defined at line ${firstLine})`,
    RESERVED_IDENTIFIER: (id: string, context?: string) =>
        `Identifier '${id}' is reserved and cannot be used${context ? ` for ${context}` : ''}`,
    RESERVED_SPECIES_NAME: (name: string) =>
        `Species name '${name}' is reserved and cannot be used`,

    // Method and property errors
    METHOD_NOT_EXISTS: (methodName: string, className: string) =>
        `Method '${methodName}' does not exist on ${className}`,
    PROPERTY_NOT_EXISTS: (propertyName: string, className: string) =>
        `Property '${propertyName}' does not exist on ${className}`,

    // Function call errors
    FUNCTION_NOT_FOUND: (funcName: string) =>
        `Function '${funcName}' not found in SLiM/Eidos documentation`,

    // NULL assignment errors
    NULL_TO_NON_NULLABLE: (paramName: string, typeName: string, context?: string) => {
        const contextStr = context ? ` in ${context}` : '';
        return `NULL cannot be passed to non-nullable parameter '${paramName}' of type '${typeName}'${contextStr}`;
    },

    // Reference warnings
    UNDEFINED_REFERENCE: (typeName: string, id: string) =>
        `${typeName} ${id} may not be defined in the focal species`,
} as const;

export const TYPE_NAMES_FOR_ERRORS = {
    MUTATION_TYPE: 'Mutation type',
    GENOMIC_ELEMENT_TYPE: 'Genomic element type',
    INTERACTION_TYPE: 'Interaction type',
    SUBPOPULATION: 'Subpopulation',
    SPECIES: 'Species',
    CONSTANT: 'Constant',
    SCRIPT_BLOCK: 'Script block',
} as const;

// ============================================================================
// Inlay hints
// ============================================================================

export const INLAY_HINT_PATTERNS = {
    FOR_IN_LOOP: /for\s*\(\s*(\w+)\s+in\s+([^)]+)\)/,
    FUNCTION_CALL: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
    CONTROL_STRUCTURES: ['if', 'for', 'while', 'function'] as readonly string[],
} as const;

// ============================================================================
// Folding ranges
// ============================================================================

export const FOLDING_RANGE_PATTERNS = {
    SLIM_CALLBACK: new RegExp(`^\\d+[:\\d]*\\s+(${callbackNamesJoined})\\s*\\(`),
    INITIALIZE_BLOCK: /^initialize\s*\(/,
    FUNCTION_DEFINITION: /^function\s+\(/,
    CONDITIONAL_BLOCK: /^(if|else\s+if|else)\s*(\(|{)/,
    LOOP_BLOCK: /^(for|while|do)\s*(\(|{)/,
} as const;

// ============================================================================
// Caching
// ============================================================================

export const CACHE_CONFIG = {
    MAX_SIZE: 25,
    ENABLE_STATS: false,
} as const;

// ============================================================================
// Formatting (mutable for user configuration)
// ============================================================================

export const FORMATTER_CONFIG = {
    MAX_INDENT_LEVEL: 50,
    MAX_CONSECUTIVE_BLANK_LINES: 2,
};
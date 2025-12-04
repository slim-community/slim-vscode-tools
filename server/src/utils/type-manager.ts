import { INSTANCE_TO_CLASS_MAP, CLASS_NAMES, TYPE_PATTERNS, 
    TYPE_INFERENCE_PATTERNS } from '../config/config';
    import { ClassInfo } from '../config/types';
import { EIDOS_CLASSES_PATH, SLIM_CLASSES_PATH } from '../config/paths';
import { vectorToSingleton, parseDocumentationType, 
    formatDocumentationType } from './vector-detector';
import * as fs from 'fs';

export function resolveClassName(
    instanceName: string,
    instanceDefinitions: Record<string, string> = {}
): string | null {
    if (instanceDefinitions[instanceName]) {
        return instanceDefinitions[instanceName];
    }

    if (INSTANCE_TO_CLASS_MAP[instanceName]) {
        return INSTANCE_TO_CLASS_MAP[instanceName];
    }

    if (TYPE_PATTERNS.SUBPOPULATION.test(instanceName)) {
        return CLASS_NAMES.SUBPOPULATION;
    }
    if (TYPE_PATTERNS.MUTATION_TYPE.test(instanceName)) {
        return CLASS_NAMES.MUTATION_TYPE;
    }
    if (TYPE_PATTERNS.GENOMIC_ELEMENT_TYPE.test(instanceName)) {
        return CLASS_NAMES.GENOMIC_ELEMENT_TYPE;
    }
    if (TYPE_PATTERNS.INTERACTION_TYPE.test(instanceName)) {
        return CLASS_NAMES.INTERACTION_TYPE;
    }

    return null;
}

export function inferTypeFromExpression(
    expr: string,
    instanceDefinitions?: Record<string, string>
): string | null {
    const trimmed = expr.trim();

    // Check for numeric/logicalfunctions first - these should not infer types
    if (TYPE_INFERENCE_PATTERNS.NUMERIC_FUNCTIONS.test(trimmed) || 
            TYPE_INFERENCE_PATTERNS.LOGICAL_FUNCTIONS.test(trimmed)) {
        return null;
    }

    // For expressions with array access, use specialized handler that handles chained access
    if (trimmed.includes('[')) {
        const arrayType = inferTypeFromArrayAccess(trimmed, instanceDefinitions);
        if (arrayType) {
            return arrayType;
        }
    }

    // Check for pure arithmetic/logical expressions (not containing array access or function calls)
    if (
        TYPE_INFERENCE_PATTERNS.ARITHMETIC_OPERATORS.test(trimmed) ||
        TYPE_INFERENCE_PATTERNS.LOGICAL_OPERATORS.test(trimmed)
    ) {
        return null;
    }

    const typePatterns: [RegExp, string][] = [
        [TYPE_INFERENCE_PATTERNS.SUBPOPULATION_METHODS, CLASS_NAMES.SUBPOPULATION + '[]'],
        [TYPE_INFERENCE_PATTERNS.INDIVIDUAL_METHODS, CLASS_NAMES.INDIVIDUAL + '[]'],
        [TYPE_INFERENCE_PATTERNS.HAPLOSOME_METHODS, CLASS_NAMES.HAPLOSOME + '[]'],
        [TYPE_INFERENCE_PATTERNS.MUTATION_METHODS, CLASS_NAMES.MUTATION + '[]'],
        [TYPE_INFERENCE_PATTERNS.MUTATION_TYPE_METHODS, CLASS_NAMES.MUTATION_TYPE + '[]'],
        [TYPE_INFERENCE_PATTERNS.GENOMIC_ELEMENT_TYPE_METHODS, CLASS_NAMES.GENOMIC_ELEMENT_TYPE + '[]'],
        [TYPE_INFERENCE_PATTERNS.INTERACTION_TYPE_METHODS, CLASS_NAMES.INTERACTION_TYPE + '[]'],
        [TYPE_INFERENCE_PATTERNS.CHROMOSOME_METHODS, CLASS_NAMES.CHROMOSOME + '[]'],
        [TYPE_INFERENCE_PATTERNS.LOGFILE_METHODS, CLASS_NAMES.LOGFILE + '[]'],
    ];

    for (const [pattern, type] of typePatterns) {
        if (pattern.test(expr)) {
            return type;
        }
    }

    return null;
}

function inferTypeFromArrayAccess(
    expr: string,
    instanceDefinitions?: Record<string, string>
): string | null {
    // First, check if the expression starts with a known variable
    if (instanceDefinitions) {
        const firstPart = expr.split(/[.\[]/, 1)[0];
        if (instanceDefinitions[firstPart]) {
            return inferTypeFromChainedAccess(expr, instanceDefinitions[firstPart]);
        }
    }
    
    // Find all array access patterns and get the last one
    const arrayAccessPattern = /\.(\w+)\s*\[[^\]]*\]/g;
    let lastMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;
    
    while ((match = arrayAccessPattern.exec(expr)) !== null) {
        lastMatch = match;
    }
    
    if (lastMatch) {
        const propertyName = lastMatch[1];
        const vectorType = inferVectorTypeFromPropertyName(propertyName);
        
        // Array access on a vector returns a singleton
        return vectorType ? vectorToSingleton(vectorType) : null;
    }
    
    // Fallback: No array access found, return null
    return null;
}

export function inferTypeFromChainedAccess(expr: string, baseType: string): string | null {
    let currentType = baseType;
    let i = 0;

    // Skip the initial identifier (e.g., 'p1' in 'p1.individuals[0]')
    const firstDot = expr.indexOf('.');
    if (firstDot === -1) return currentType;
    i = firstDot;

    while (i < expr.length) {
        if (expr[i] === '.') {
            i++; // Skip the dot
            // Find the next property/method name
            const nameStart = i;
            while (i < expr.length && /[a-zA-Z_]\w*/.test(expr[i])) {
                i++;
            }
            const name = expr.substring(nameStart, i);

            if (i < expr.length && expr[i] === '(') {
                // Method call - find the end of the method call
                let parenCount = 1;
                i++; // Skip the opening paren
                while (i < expr.length && parenCount > 0) {
                    if (expr[i] === '(') parenCount++;
                    else if (expr[i] === ')') parenCount--;
                    i++;
                }
                // Now infer the method return type
                const returnType = inferTypeFromMethodCall(currentType, name);
                if (returnType) {
                    currentType = returnType;
                } else {
                    return null;
                }
            } else {
                // Property access
                const propertyType = inferTypeFromProperty(currentType, name);
                if (propertyType) {
                    currentType = propertyType;
                } else {
                    return null;
                }
            }
        } else if (expr[i] === '[') {
            // Array access - find the end of the brackets
            let bracketCount = 1;
            i++; // Skip the opening bracket
            while (i < expr.length && bracketCount > 0) {
                if (expr[i] === '[') bracketCount++;
                else if (expr[i] === ']') bracketCount--;
                i++;
            }
            // Array access converts vector to singleton
            currentType = vectorToSingleton(currentType);
        } else {
            i++; // Skip other characters
        }
    }

    return currentType;
}

// Cache for loaded class documentation
let classDocumentationCache: Record<string, ClassInfo> | null = null;

function loadClassDocumentation(): Record<string, ClassInfo> {
    if (classDocumentationCache) {
        return classDocumentationCache;
    }

    classDocumentationCache = {};

    const slimClassesPath = SLIM_CLASSES_PATH;
    const eidosClassesPath = EIDOS_CLASSES_PATH;

    try {
        const slimClasses = JSON.parse(fs.readFileSync(slimClassesPath, 'utf8')) as Record<string, ClassInfo>;
        Object.assign(classDocumentationCache, slimClasses);
    } catch (error) {
        // Ignore errors if files don't exist
    }

    // Load Eidos classes
    try {
        const eidosClasses = JSON.parse(fs.readFileSync(eidosClassesPath, 'utf8')) as Record<string, ClassInfo>;
        Object.assign(classDocumentationCache, eidosClasses);
    } catch (error) {
        // Ignore errors if files don't exist
    }

    return classDocumentationCache;
}

function parseAndResolveDocType(typeString: string): string | null {
    const parsed = parseDocumentationType(typeString);
    if (!parsed) return null;

    // Check if the parsed className is a known CLASS_NAME value
    const knownClassValues = Object.values(CLASS_NAMES);
    const isKnownClass = knownClassValues.includes(parsed.className);

    // For object types, require a known class
    if (typeString.includes('object<') && !isKnownClass) {
        return null;
    }

    return formatDocumentationType(parsed.className, parsed.isSingleton);
}

function parseMethodReturnType(signature: string): string | null {
    const match = signature.match(/^\(\s*([^)]+)\s*\)/);
    if (!match) return null;

    return parseAndResolveDocType(match[1].trim());
}

function inferTypeFromProperty(baseType: string, propertyName: string): string | null {
    const singletonType = vectorToSingleton(baseType);

    const classes = loadClassDocumentation();

    for (const [className, classInfo] of Object.entries(classes)) {
        if (className === singletonType && classInfo.properties) {
            const propertyInfo = classInfo.properties[propertyName];
            if (propertyInfo && propertyInfo.type) {
                return parsePropertyType(propertyInfo.type);
            }
        }
    }

    switch (singletonType) {
        case CLASS_NAMES.SPECIES:
            if (propertyName === 'subpopulations') {
                return CLASS_NAMES.SUBPOPULATION + '[]';
            }
            break;
        case CLASS_NAMES.SUBPOPULATION:
            if (propertyName === 'individuals') {
                return CLASS_NAMES.INDIVIDUAL + '[]';
            }
            break;
        case CLASS_NAMES.INDIVIDUAL:
            if (['genomes', 'genome1', 'genome2'].includes(propertyName)) {
                return CLASS_NAMES.HAPLOSOME + '[]';
            }
            if (propertyName === 'haplosomes') {
                return CLASS_NAMES.HAPLOSOME + '[]';
            }
            break;
        case CLASS_NAMES.HAPLOSOME:
            if (propertyName === 'mutations') {
                return CLASS_NAMES.MUTATION + '[]';
            }
            break;
    }
    return null;
}

function parsePropertyType(typeString: string): string | null {
    return parseAndResolveDocType(typeString);
}

function inferTypeFromMethodCall(baseType: string, methodName: string): string | null {
    const singletonType = vectorToSingleton(baseType);

    const classes = loadClassDocumentation();

    for (const [className, classInfo] of Object.entries(classes)) {
        if (className === singletonType && classInfo.methods) {
            const methodInfo = classInfo.methods[methodName];
            if (methodInfo && methodInfo.signature) {
                return parseMethodReturnType(methodInfo.signature);
            }
        }
    }

    switch (singletonType) {
        case CLASS_NAMES.SUBPOPULATION:
            if (['individuals', 'sampleIndividuals', 'individualsWithPedigreeIDs'].includes(methodName)) {
                return CLASS_NAMES.INDIVIDUAL + '[]';
            }
            if (['subpopulations', 'subpopulationsWithIDs', 'subpopulationsWithNames'].includes(methodName)) {
                return CLASS_NAMES.SUBPOPULATION + '[]';
            }
            break;
        case CLASS_NAMES.INDIVIDUAL:
            if (['genomes', 'genome1', 'genome2'].includes(methodName)) {
                return CLASS_NAMES.HAPLOSOME + '[]';
            }
            break;
        case CLASS_NAMES.HAPLOSOME:
            if (['mutations', 'mutationsOfType', 'uniqueMutationsOfType'].includes(methodName)) {
                return CLASS_NAMES.MUTATION + '[]';
            }
            break;
    }
    return null;
}

function inferVectorTypeFromPropertyName(propertyName: string): string | null {
    switch (propertyName) {
        case 'subpopulations':
            return CLASS_NAMES.SUBPOPULATION + '[]';
        case 'individuals':
            return CLASS_NAMES.INDIVIDUAL + '[]';
        case 'genomes':
        case 'genome1':
        case 'genome2':
            return CLASS_NAMES.HAPLOSOME + '[]';
        case 'mutations':
            return CLASS_NAMES.MUTATION + '[]';
        case 'chromosomes':
            return CLASS_NAMES.CHROMOSOME + '[]';
        default:
            return null;
    }
}

export function inferLoopVariableType(
    collection: string,
    instanceDefinitions?: Record<string, string>
): string | null {
    if (collection.includes('.individuals')) {
        return CLASS_NAMES.INDIVIDUAL;
    }
    if (collection.includes('.genomes') || collection.includes('.haplosomes')) {
        return CLASS_NAMES.HAPLOSOME;
    }
    if (collection.includes('.mutations')) {
        return CLASS_NAMES.MUTATION;
    }
    if (collection.includes('.subpopulations') || collection === 'sim.subpopulations') {
        return CLASS_NAMES.SUBPOPULATION;
    }
    if (collection.includes('.chromosomes')) {
        return CLASS_NAMES.CHROMOSOME;
    }

    // Range expression like 1:10
    if (/\d+:\d+/.test(collection)) {
        return 'integer';
    }

    // seq() function returns numeric vector
    if (/seq\(/.test(collection)) {
        return 'numeric';
    }

    // seqLen() returns integer vector
    if (/seqLen\(/.test(collection)) {
        return 'integer';
    }

    const collectionType = inferTypeFromExpression(collection, instanceDefinitions);
    if (collectionType) {
        return vectorToSingleton(collectionType);
    }

    return null;
}

export function resolveExpressionType(
    expression: string,
    instanceDefinitions: Record<string, string>
): string | null {
    const trimmed = expression.trim();

    // Simple case: just an identifier
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
        const resolved = instanceDefinitions[trimmed] || resolveClassName(trimmed, instanceDefinitions);
        return resolved ? vectorToSingleton(resolved) : null;
    }

    // Complex expression with chained access - find the base identifier
    const baseIdentifier = trimmed.split(/[.\[]/)[0];
    if (!baseIdentifier) return null;

    const baseType = instanceDefinitions[baseIdentifier] || resolveClassName(baseIdentifier, instanceDefinitions);
    if (!baseType) {
        const patternType = resolveClassName(trimmed, instanceDefinitions);
        return patternType ? vectorToSingleton(patternType) : null;
    }

    const chainedType = inferTypeFromChainedAccess(trimmed, baseType);
    return chainedType ? vectorToSingleton(chainedType) : null;
}
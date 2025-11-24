import { TEXT_PROCESSING_PATTERNS, TYPE_PATTERNS, CLASS_NAMES } from '../config/config';
import { ParameterInfo } from '../config/types';
import { TYPE_INFERENCE_PATTERNS } from '../config/config';

export type { ParameterInfo };

export interface TypeInfo {
    baseType: string;
    isSingleton: boolean;
    isVector: boolean;
    isNullable: boolean;
}

export function isSingletonType(type: string): boolean {
    if (!type) return false;
    return TEXT_PROCESSING_PATTERNS.DOLLAR_SUFFIX.test(type);
}

export function isVectorType(type: string): boolean {
    if (!type) return false;
    return !TEXT_PROCESSING_PATTERNS.DOLLAR_SUFFIX.test(type);
}

export function getBaseType(type: string): string {
    if (!type) return type;
    return type.replace(TEXT_PROCESSING_PATTERNS.DOLLAR_SUFFIX, '');
}

export function isNullableType(type: string): boolean {
    if (!type) return false;
    const baseType = getBaseType(type);
    return (
        TEXT_PROCESSING_PATTERNS.NULLABLE_TYPE.test(baseType) ||
        TEXT_PROCESSING_PATTERNS.NULLABLE_OBJECT_TYPE.test(baseType)
    );
}

export function parseTypeInfo(type: string): TypeInfo {
    if (!type) {
        return {
            baseType: '',
            isSingleton: false,
            isVector: false,
            isNullable: false,
        };
    }

    const hasDollar = isSingletonType(type);
    const baseType = getBaseType(type);

    return {
        baseType,
        isSingleton: hasDollar,
        isVector: !hasDollar,
        isNullable: isNullableType(type),
    };
}

export function extractParameterTypes(signature: string): ParameterInfo[] {
    const params: ParameterInfo[] = [];
    if (!signature) return params;

    const paramMatch = signature.match(TEXT_PROCESSING_PATTERNS.PARAMETER_LIST);
    if (!paramMatch) return params;

    const paramString = paramMatch[1];
    if (!paramString.trim()) return params;

    const paramParts: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < paramString.length; i++) {
        const char = paramString[i];
        if (char === '<') depth++;
        else if (char === '>') depth--;
        else if (char === ',' && depth === 0) {
            paramParts.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) paramParts.push(current.trim());

    for (const param of paramParts) {
        const optionalMatch = param.match(TEXT_PROCESSING_PATTERNS.OPTIONAL_PARAMETER);
        const isOptional = !!optionalMatch;
        const paramContent = optionalMatch ? optionalMatch[1] : param;

        const typeNameMatch = paramContent.match(TEXT_PROCESSING_PATTERNS.TYPE_NAME_PARAM);
        if (typeNameMatch) {
            params.push({
                name: typeNameMatch[2],
                type: typeNameMatch[1],
                isOptional: isOptional,
                defaultValue: typeNameMatch[3],
            });
        } else {
            const typeMatch = paramContent.match(TEXT_PROCESSING_PATTERNS.TYPE_ONLY);
            if (typeMatch) {
                params.push({
                    name: null,
                    type: typeMatch[1],
                    isOptional: isOptional,
                });
            }
        }
    }

    return params;
}

const INSTANCE_TO_CLASS_MAP: Readonly<Record<string, string>> = {
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

export function inferTypeFromExpression(expr: string): string | null {
    const trimmed = expr.trim();

    if (
        TYPE_INFERENCE_PATTERNS.NUMERIC_FUNCTIONS.test(trimmed) ||
        TYPE_INFERENCE_PATTERNS.ARITHMETIC_OPERATORS.test(trimmed)
    ) {
        return null;
    }

    if (
        TYPE_INFERENCE_PATTERNS.LOGICAL_OPERATORS.test(trimmed) ||
        TYPE_INFERENCE_PATTERNS.LOGICAL_FUNCTIONS.test(trimmed)
    ) {
        return null;
    }

    const typePatterns: [RegExp, string][] = [
        [TYPE_INFERENCE_PATTERNS.SUBPOPULATION_METHODS, CLASS_NAMES.SUBPOPULATION],
        [TYPE_INFERENCE_PATTERNS.INDIVIDUAL_METHODS, CLASS_NAMES.INDIVIDUAL],
        [TYPE_INFERENCE_PATTERNS.HAPLOSOME_METHODS, CLASS_NAMES.HAPLOSOME],
        [TYPE_INFERENCE_PATTERNS.MUTATION_METHODS, CLASS_NAMES.MUTATION],
        [TYPE_INFERENCE_PATTERNS.MUTATION_TYPE_METHODS, CLASS_NAMES.MUTATION_TYPE],
        [TYPE_INFERENCE_PATTERNS.GENOMIC_ELEMENT_TYPE_METHODS, CLASS_NAMES.GENOMIC_ELEMENT_TYPE],
        [TYPE_INFERENCE_PATTERNS.INTERACTION_TYPE_METHODS, CLASS_NAMES.INTERACTION_TYPE],
        [TYPE_INFERENCE_PATTERNS.CHROMOSOME_METHODS, CLASS_NAMES.CHROMOSOME],
        [TYPE_INFERENCE_PATTERNS.LOGFILE_METHODS, CLASS_NAMES.LOGFILE],
    ];

    for (const [pattern, type] of typePatterns) {
        if (pattern.test(expr)) {
            return type;
        }
    }

    return null;
}

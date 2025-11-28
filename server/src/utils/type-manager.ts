import { INSTANCE_TO_CLASS_MAP, CLASS_NAMES, TYPE_PATTERNS, TYPE_INFERENCE_PATTERNS } from '../config/config';

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
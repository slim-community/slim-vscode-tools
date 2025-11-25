// Configuration constants for the SLiM Language Server

// Known instance to class mappings
// These are built-in instances that should be recognized without explicit definition
export const INSTANCE_TO_CLASS_MAP: { [key: string]: string } = {
    sim: 'Species',
    // Add other known instances and their corresponding classes here
};

// SLiM keywords (for potential future use)
export const SLIM_KEYWORDS = [
    'initialize',
    'early',
    'late',
    'fitness',
    'interaction',
    'mateChoice',
    'modifyChild',
    'mutation',
    'recombination',
];

// SLiM types (for potential future use)
export const SLIM_TYPES = [
    'void',
    'integer',
    'float',
    'string',
    'logical',
    'object',
    'numeric',
    'NULL',
    'INF',
];


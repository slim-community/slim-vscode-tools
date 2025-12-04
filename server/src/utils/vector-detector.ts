/**
 * Type system for SLiM/Eidos that properly distinguishes between
 * singletons and vectors.
 * 
 * In Eidos, everything is a vector by default. Singletons are marked with $
 * in the documentation. We represent this as:
 * - Singleton: "Subpopulation"
 * - Vector: "Subpopulation[]"
 */

import { ParsedTypeInfo } from "../config/types"; 

export function parseType(typeString: string): ParsedTypeInfo | null {
    if (!typeString) return null;

    // Check if it's our array notation
    if (typeString.endsWith('[]')) {
        return {
            baseType: typeString.slice(0, -2),
            isSingleton: false,
        };
    }

    // Check if it's Eidos singleton notation
    if (typeString.endsWith('$')) {
        return {
            baseType: typeString.slice(0, -1),
            isSingleton: true,
        };
    }

    // Default: assume it's a singleton for class types, vector for primitives
    const primitiveTypes = ['integer', 'float', 'string', 'logical', 'numeric'];
    if (primitiveTypes.includes(typeString.toLowerCase())) {
        return {
            baseType: typeString,
            isSingleton: false,
        };
    }

    // For class types, default to singleton
    return {
        baseType: typeString,
        isSingleton: true,
    };
}

export function formatType(typeInfo: ParsedTypeInfo): string {
    return typeInfo.isSingleton ?? false ? typeInfo.baseType : `${typeInfo.baseType}[]`;
}

export function formatTypeString(typeString: string): string {
    const parsed = parseType(typeString);
    return parsed ? formatType(parsed) : typeString;
}

export function isVectorType(typeString: string): boolean {
    const parsed = parseType(typeString);
    return parsed ? !parsed.isSingleton : false;
}

export function isSingletonType(typeString: string): boolean {
    const parsed = parseType(typeString);
    return parsed ? parsed.isSingleton : true; // Default to singleton
}

export function getBaseType(typeString: string): string {
    const parsed = parseType(typeString);
    return parsed ? parsed.baseType : typeString;
}

export function vectorToSingleton(typeString: string): string {
    const parsed = parseType(typeString);
    if (!parsed) return typeString;

    return parsed.baseType;
}

export function singletonToVector(typeString: string): string {
    const parsed = parseType(typeString);
    if (!parsed) return `${typeString}[]`;

    if (parsed.isSingleton) {
        return formatType({ baseType: parsed.baseType, isSingleton: false });
    }

    return typeString;
}

export function areTypesCompatible(
    providedType: string,
    expectedType: string,
    allowAutoPromotion: boolean = true
): boolean {
    const provided = parseType(providedType);
    const expected = parseType(expectedType);

    if (!provided || !expected) return false;

    // Base types must match
    if (provided.baseType !== expected.baseType) return false;

    // Exact match
    if (provided.isSingleton === expected.isSingleton) return true;

    // Auto-promotion: singleton -> vector (if allowed)
    if (allowAutoPromotion && provided.isSingleton && !expected.isSingleton) {
        return true;
    }

    // No demotion: vector -> singleton is not allowed
    return false;
}

export function parseDocumentationType(typeString: string): { className: string; isSingleton: boolean } | null {
    if (!typeString) return null;

    let workingType = typeString.trim();
    let isSingleton = true; // Default to singleton

    // Check for array suffix first (takes precedence)
    if (workingType.endsWith('[]')) {
        isSingleton = false;
        workingType = workingType.slice(0, -2);
    }
    // Check for singleton marker
    else if (workingType.endsWith('$')) {
        isSingleton = true;
        workingType = workingType.slice(0, -1);
    }

    // Handle object<ClassName> wrapper
    const objectMatch = workingType.match(/^object<(.+)>$/);
    if (objectMatch) {
        return { className: objectMatch[1], isSingleton };
    }

    // Handle No<ClassName> abbreviated wrapper
    const abbrevMatch = workingType.match(/^No<(.+)>$/);
    if (abbrevMatch) {
        return { className: abbrevMatch[1], isSingleton };
    }

    // Plain type name
    return { className: workingType, isSingleton };
}

export function formatDocumentationType(className: string, isSingleton: boolean): string {
    return isSingleton ? className : `${className}[]`;
}

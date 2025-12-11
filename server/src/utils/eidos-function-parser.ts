import { EidosFunctionSignature, EidosFunctionParameter } from '../config/types';
import { EIDOS_FUNCTION_REGEX } from '../config/config';

export function parseEidosFunctionSignature(line: string): EidosFunctionSignature | null {
    const match = line.match(EIDOS_FUNCTION_REGEX);
    if (!match) return null;

    const [fullSignature, returnType, functionName, paramsString] = match;
    
    const parameters = parseEidosFunctionParameters(paramsString);

    return {
        returnType: returnType.trim(),
        functionName,
        parameters,
        fullSignature,
    };
}

export function parseEidosFunctionParameters(paramsString: string): EidosFunctionParameter[] {
    if (!paramsString || !paramsString.trim()) {
        return [];
    }

    return paramsString
        .split(',')
        .map(param => {
            const trimmed = param.trim();
            if (!trimmed) return null;

            // Split by whitespace to separate type and name
            const parts = trimmed.split(/\s+/);
            
            if (parts.length === 1) {
                // Special case: "void" as sole parameter or type without name
                if (parts[0] === 'void') {
                    return null; // void parameter means no parameters
                }
                return { type: parts[0], name: '' };
            }

            const name = parts[parts.length - 1];
            const type = parts.slice(0, -1).join(' ');

            return { type, name };
        })
        .filter((p): p is EidosFunctionParameter => p !== null);
}

export function extractParameterNames(paramsString: string): string[] {
    const params = parseEidosFunctionParameters(paramsString);
    return params.map(p => p.name).filter(name => name.length > 0);
}

export function isEidosFunctionDefinition(line: string): boolean {
    return EIDOS_FUNCTION_REGEX.test(line);
}

export function extractFunctionName(line: string): string | null {
    const match = line.match(EIDOS_FUNCTION_REGEX);
    return match ? match[2] : null;
}
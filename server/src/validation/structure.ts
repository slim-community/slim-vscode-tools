// Validation utilities for checking code structure

export function shouldHaveSemicolon(
    line: string,
    parenBalance: number = 0
): { shouldMark: boolean; parenBalance: number } {
    const strings: string[] = [];
    const codeWithPlaceholders = line.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
        strings.push(match);
        return `__STRING${strings.length - 1}__`;
    });

    const codeOnly = codeWithPlaceholders
        .replace(/\/\/.*$/, '')
        .replace(/\/\*.*?\*\//g, '')
        .trim();

    const restoredCode = strings.reduce(
        (code, str, i) => code.replace(`__STRING${i}__`, str),
        codeOnly
    );

    const openParens = (restoredCode.match(/\(/g) || []).length;
    const closeParens = (restoredCode.match(/\)/g) || []).length;
    const netParens = parenBalance + openParens - closeParens;

    const isDefinitelySafe =
        restoredCode.endsWith(';') ||
        restoredCode.endsWith('{') ||
        restoredCode.endsWith('}') ||
        netParens > 0 ||
        /^\s*(if|else|while|for|switch|case|default)\b.*\)?\s*{?\s*$/.test(restoredCode) ||
        /^(initialize|early|late|fitness)\s*\([^)]*\)\s*{?\s*$/.test(restoredCode) ||
        /^\s*(s\d+\s+)?\d+\s+(early|late|reproduction|fitness)\s*\(\)\s*$/.test(restoredCode) ||
        /^\s*\/[\/\*]/.test(line) ||
        /^\s*\*/.test(line) ||
        /^\s*$/.test(line);

    return {
        shouldMark: !isDefinitelySafe && netParens === 0,
        parenBalance: netParens,
    };
}


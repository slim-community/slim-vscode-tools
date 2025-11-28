import { CALLBACK_PSEUDO_PARAMETERS } from '../config/config';
import { inferTypeFromExpression } from './type-manager';
import { DEFINITION_PATTERNS, CALLBACK_REGISTRATION_PATTERNS, COMPILED_CALLBACK_PATTERNS } from '../config/config';
import { CLASS_NAMES } from '../config/config';
import { TrackingState, CallbackState } from '../config/types';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { documentCache } from './document-cache';

// Global instance definitions accessible to other modules
export let instanceDefinitions: Record<string, string> = {};

export function trackInstanceDefinitions(
    document: TextDocument,
    state?: TrackingState
): TrackingState {
    // Check cache first for massive performance improvement
    if (!state) {
        const cached = documentCache.get(document);
        if (cached) {
            // Update global instanceDefinitions from cache
            instanceDefinitions = cached.instanceDefinitions as Record<string, string>;
            return cached;
        }
    }
    // Create fresh tracking state for this analysis, or use provided state
    const trackingState = state || {
        instanceDefinitions: {},
        definedConstants: new Set<string>(),
        definedMutationTypes: new Set<string>(),
        definedGenomicElementTypes: new Set<string>(),
        definedInteractionTypes: new Set<string>(),
        definedSubpopulations: new Set<string>(),
        definedScriptBlocks: new Set<string>(),
        definedSpecies: new Set<string>(),
        modelType: null,
        callbackContextByLine: new Map(),
    };
    const text = document.getText();
    const lines = text.split('\n');

    let callbackState: CallbackState = {
        currentCallback: null,
        braceDepth: 0,
        callbackStartLine: -1,
    };

    let pendingCallback: string | null = null;

    lines.forEach((line, lineIndex) => {
        const { currentCallback, braceDepth, callbackStartLine } = callbackState;
        let newCallback = currentCallback;
        let newBraceDepth = braceDepth;
        let newCallbackStartLine = callbackStartLine;

        // Use pre-compiled patterns for better performance
        const callbackWithBraceMatch = line.match(COMPILED_CALLBACK_PATTERNS.CALLBACK_WITH_BRACE);
        const callbackWithoutBraceMatch = !callbackWithBraceMatch
            ? line.match(COMPILED_CALLBACK_PATTERNS.CALLBACK_WITHOUT_BRACE)
            : null;

        const detectedCallback = callbackWithBraceMatch
            ? callbackWithBraceMatch[1].toLowerCase() + '()'
            : callbackWithoutBraceMatch
              ? callbackWithoutBraceMatch[1].toLowerCase() + '()'
              : null;

        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;

        if (callbackWithBraceMatch && openBraces > 0 && detectedCallback) {
            newCallback = detectedCallback;
            newCallbackStartLine = lineIndex;
            newBraceDepth = 0;
            pendingCallback = null;

            const pseudoParams = CALLBACK_PSEUDO_PARAMETERS[detectedCallback];
            if (pseudoParams && Object.keys(pseudoParams).length > 0) {
                for (const [paramName, paramType] of Object.entries(
                    pseudoParams as Record<string, string>
                )) {
                    (trackingState.instanceDefinitions as Record<string, string>)[paramName] =
                        paramType;
                }
            }
        } else if (callbackWithoutBraceMatch && !currentCallback && detectedCallback) {
            pendingCallback = detectedCallback;
        } else if (pendingCallback && openBraces > 0 && !currentCallback) {
            newCallback = pendingCallback;
            newCallbackStartLine = lineIndex;
            newBraceDepth = 0;

            const pseudoParams = CALLBACK_PSEUDO_PARAMETERS[pendingCallback];
            if (pseudoParams && Object.keys(pseudoParams).length > 0) {
                for (const [paramName, paramType] of Object.entries(
                    pseudoParams as Record<string, string>
                )) {
                    (trackingState.instanceDefinitions as Record<string, string>)[paramName] =
                        paramType;
                }
            }

            pendingCallback = null;
        }

        if (newCallback) {
            newBraceDepth += openBraces - closeBraces;

            if (newBraceDepth <= 0 && closeBraces > 0) {
                newCallback = null;
                newCallbackStartLine = -1;
                newBraceDepth = 0;
            }
        }

        callbackState = {
            currentCallback: newCallback,
            braceDepth: newBraceDepth,
            callbackStartLine: newCallbackStartLine,
        };

        trackingState.callbackContextByLine.set(lineIndex, callbackState.currentCallback);

        // Pre-filter: Only check for model type if line contains relevant keywords
        if (line.includes('initializeSLiMModelType')) {
            const modelTypeMatch = line.match(/initializeSLiMModelType\s*\(\s*["'](\w+)["']\s*\)/);
            if (modelTypeMatch) {
                const type = modelTypeMatch[1];
                if (type === 'WF' || type === 'nonWF') {
                    trackingState.modelType = type;
                }
            }
        }

        // Pre-filter: Only check for constants if line contains relevant keywords
        const constantMatch = line.includes('defineConstant') ? line.match(DEFINITION_PATTERNS.DEFINE_CONSTANT) : null;
        if (constantMatch) {
            const constName = constantMatch[1];
            if (!trackingState.definedConstants.has(constName)) {
                trackingState.definedConstants.add(constName);
            }

            const constValueMatch = line.match(DEFINITION_PATTERNS.CONSTANT_VALUE);
            if (constValueMatch) {
                const valueExpr = constValueMatch[1].trim();
                const cleanValue = valueExpr.replace(/\)\s*$/, '').trim();
                const inferredType = inferTypeFromExpression(cleanValue);
                if (inferredType) {
                    (trackingState.instanceDefinitions as Record<string, string>)[constName] =
                        inferredType;
                }
            } else {
                for (
                    let lookAhead = 1;
                    lookAhead <= 3 && lineIndex + lookAhead < lines.length;
                    lookAhead++
                ) {
                    const nextLine = lines[lineIndex + lookAhead].trim();
                    if (!nextLine || nextLine.startsWith('//')) continue;

                    if (nextLine.includes(')')) {
                        const valuePart = nextLine.split(')')[0].trim();
                        const inferredType = inferTypeFromExpression(valuePart);
                        if (inferredType) {
                            (trackingState.instanceDefinitions as Record<string, string>)[
                                constName
                            ] = inferredType;
                        }
                        break;
                    } else {
                        const inferredType = inferTypeFromExpression(nextLine);
                        if (inferredType) {
                            (trackingState.instanceDefinitions as Record<string, string>)[
                                constName
                            ] = inferredType;
                            break;
                        }
                    }
                }
            }
        }

        let typeMatch: RegExpMatchArray | null;

        // Pre-filter: Only check mutation type if line contains relevant keywords
        if (line.includes('initializeMutationType')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.MUTATION_TYPE)) !== null) {
                trackingState.definedMutationTypes.add(typeMatch[1]);
            }
        }

        // Pre-filter: Only check genomic element type if line contains relevant keywords
        if (line.includes('initializeGenomicElementType')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.GENOMIC_ELEMENT_TYPE)) !== null) {
                trackingState.definedGenomicElementTypes.add(typeMatch[1]);
            }
        }

        // Pre-filter: Only check interaction type if line contains relevant keywords
        if (line.includes('initializeInteractionType')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.INTERACTION_TYPE)) !== null) {
                trackingState.definedInteractionTypes.add(typeMatch[1]);
            }
        }

        // Pre-filter: Only check species if line contains relevant keywords
        if (line.includes('species') && line.includes('initialize')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.SPECIES)) !== null) {
                trackingState.definedSpecies.add(typeMatch[1]);
            }
        }

        // Pre-filter: Only check subpopulation if line contains relevant keywords
        if (line.includes('addSubpop')) {
            if (
                (typeMatch = line.match(DEFINITION_PATTERNS.SUBPOP)) !== null ||
                (typeMatch = line.match(DEFINITION_PATTERNS.SUBPOP_SPLIT)) !== null
            ) {
                const subpopName = typeMatch[1];
                trackingState.definedSubpopulations.add(subpopName);
                (trackingState.instanceDefinitions as Record<string, string>)[subpopName] =
                    CLASS_NAMES.SUBPOPULATION;
            }
        }

        // Pre-filter: Only check script block registrations if line contains relevant keywords
        if (line.includes('register') && line.includes('Callback')) {
            const scriptBlockPatterns = [
                CALLBACK_REGISTRATION_PATTERNS.EARLY_EVENT,
                CALLBACK_REGISTRATION_PATTERNS.FIRST_EVENT,
                CALLBACK_REGISTRATION_PATTERNS.INTERACTION_CALLBACK,
                CALLBACK_REGISTRATION_PATTERNS.LATE_EVENT,
                CALLBACK_REGISTRATION_PATTERNS.FITNESS_EFFECT_CALLBACK,
                CALLBACK_REGISTRATION_PATTERNS.MATE_CHOICE_CALLBACK,
                CALLBACK_REGISTRATION_PATTERNS.MODIFY_CHILD_CALLBACK,
                CALLBACK_REGISTRATION_PATTERNS.MUTATION_CALLBACK,
                CALLBACK_REGISTRATION_PATTERNS.MUTATION_EFFECT_CALLBACK,
                CALLBACK_REGISTRATION_PATTERNS.RECOMBINATION_CALLBACK,
                CALLBACK_REGISTRATION_PATTERNS.REPRODUCTION_CALLBACK,
                CALLBACK_REGISTRATION_PATTERNS.SURVIVAL_CALLBACK,
            ];

            for (const pattern of scriptBlockPatterns) {
                const scriptMatch = line.match(pattern);
                if (scriptMatch !== null) {
                    const blockId = scriptMatch[1];
                    trackingState.definedScriptBlocks.add(blockId);
                    (trackingState.instanceDefinitions as Record<string, string>)[blockId] =
                        CLASS_NAMES.SLIMEIDOS_BLOCK;
                    break;
                }
            }
        }

        if ((typeMatch = line.match(DEFINITION_PATTERNS.INSTANCE)) !== null) {
            (trackingState.instanceDefinitions as Record<string, string>)[typeMatch[1]] =
                typeMatch[2];
        }

        if ((typeMatch = line.match(DEFINITION_PATTERNS.ASSIGNMENT)) !== null) {
            const rhs = typeMatch[2].trim();
            const inferredType = inferTypeFromExpression(rhs);
            if (inferredType) {
                (trackingState.instanceDefinitions as Record<string, string>)[typeMatch[1]] =
                    inferredType;
            }
        }
    });

    // Update global instanceDefinitions for use by other modules
    instanceDefinitions = trackingState.instanceDefinitions as Record<string, string>;

    // Cache the result for future calls (only if not using provided state)
    if (!state) {
        documentCache.set(document, trackingState);
    }

    return trackingState;
}
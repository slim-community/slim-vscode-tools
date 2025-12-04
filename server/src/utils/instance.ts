import { CALLBACK_PSEUDO_PARAMETERS } from '../config/config';
import { inferTypeFromExpression, resolveClassName } from './type-manager';
import { DEFINITION_PATTERNS, CALLBACK_REGISTRATION_PATTERNS, COMPILED_CALLBACK_PATTERNS, EIDOS_FUNCTION_REGEX } from '../config/config';
import { CLASS_NAMES } from '../config/config';
import { TrackingState, CallbackState, UserFunctionInfo, PropertySourceInfo } from '../config/types';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { documentCache } from '../services/document-cache';
import { extractDocComment } from './text-processing';

// Pattern to match property access: ClassName.property or instance.property
const PROPERTY_ACCESS_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)$/;

export function trackInstanceDefinitions(
    document: TextDocument,
    state?: TrackingState
): TrackingState {
    if (!state) {
        const cached = documentCache.getTrackingState(document);
        if (cached) {
            return cached;
        }
    }

    const trackingState: TrackingState = state || {
        instanceDefinitions: {
            sim: CLASS_NAMES.SPECIES,
            community: CLASS_NAMES.COMMUNITY,
            species: CLASS_NAMES.SPECIES,
        },
        propertyAssignments: new Map<string, PropertySourceInfo>(),
        definedConstants: new Set<string>(),
        definedMutationTypes: new Set<string>(),
        definedGenomicElementTypes: new Set<string>(),
        definedInteractionTypes: new Set<string>(),
        definedSubpopulations: new Set<string>(),
        definedScriptBlocks: new Set<string>(),
        definedSpecies: new Set<string>(),
        userFunctions: new Map<string, UserFunctionInfo>(),
        modelType: null,
        callbackContextByLine: new Map(),
    };
    
    // Use cached lines or create and cache them
    const lines = documentCache.getOrCreateLines(document);

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

        if (line.includes('initializeSLiMModelType')) {
            const modelTypeMatch = line.match(/initializeSLiMModelType\s*\(\s*["'](\w+)["']\s*\)/);
            if (modelTypeMatch) {
                const type = modelTypeMatch[1];
                if (type === 'WF' || type === 'nonWF') {
                    trackingState.modelType = type;
                }
            }
        }

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
                const inferredType = inferTypeFromExpression(
                    cleanValue,
                    trackingState.instanceDefinitions as Record<string, string>
                );
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
                        const inferredType = inferTypeFromExpression(
                            valuePart,
                            trackingState.instanceDefinitions as Record<string, string>
                        );
                        if (inferredType) {
                            (trackingState.instanceDefinitions as Record<string, string>)[
                                constName
                            ] = inferredType;
                        }
                        break;
                    } else {
                        const inferredType = inferTypeFromExpression(
                            nextLine,
                            trackingState.instanceDefinitions as Record<string, string>
                        );
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

        if (line.includes('initializeMutationType')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.MUTATION_TYPE)) !== null) {
                trackingState.definedMutationTypes.add(typeMatch[1]);
            }
        }

        if (line.includes('initializeGenomicElementType')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.GENOMIC_ELEMENT_TYPE)) !== null) {
                trackingState.definedGenomicElementTypes.add(typeMatch[1]);
            }
        }

        if (line.includes('initializeInteractionType')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.INTERACTION_TYPE)) !== null) {
                trackingState.definedInteractionTypes.add(typeMatch[1]);
            }
        }

        if (line.includes('species') && line.includes('initialize')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.SPECIES)) !== null) {
                trackingState.definedSpecies.add(typeMatch[1]);
            }
        }

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
            
            if (
                (typeMatch = line.match(DEFINITION_PATTERNS.SUBPOP_NUMERIC)) !== null ||
                (typeMatch = line.match(DEFINITION_PATTERNS.SUBPOP_SPLIT_NUMERIC)) !== null
            ) {
                const numericId = typeMatch[1];
                const subpopName = `p${numericId}`;
                trackingState.definedSubpopulations.add(subpopName);
                (trackingState.instanceDefinitions as Record<string, string>)[subpopName] =
                    CLASS_NAMES.SUBPOPULATION;
            }
        }

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

        // Track user-defined functions with their doc comments
        const funcMatch = line.match(EIDOS_FUNCTION_REGEX);
        if (funcMatch) {
            const returnType = funcMatch[1];
            const functionName = funcMatch[2];
            const parameters = funcMatch[3] || '';
            
            // Extract doc comment from lines above this function
            const docComment = extractDocComment(lines, lineIndex);
            
            const userFuncInfo: UserFunctionInfo = {
                name: functionName,
                signature: `(${returnType})${functionName}(${parameters})`,
                returnType,
                parameters,
                docComment,
                line: lineIndex,
            };
            
            trackingState.userFunctions.set(functionName, userFuncInfo);
        }

        if ((typeMatch = line.match(DEFINITION_PATTERNS.ASSIGNMENT)) !== null) {
            const varName = typeMatch[1];
            const rhs = typeMatch[2].trim();
            
            // Check if the RHS is a simple property access: ClassName.property or instance.property
            const propertyAccessMatch = rhs.match(PROPERTY_ACCESS_PATTERN);
            if (propertyAccessMatch) {
                const objectName = propertyAccessMatch[1];
                const propertyName = propertyAccessMatch[2];
                
                // Try to resolve the object to a class name
                // First check if it's a known class name directly (e.g., Individual.age)
                const knownClassValues = Object.values(CLASS_NAMES) as string[];
                let resolvedClassName: string | null = null;
                
                if (knownClassValues.includes(objectName)) {
                    // Direct class name access (e.g., Individual.age)
                    resolvedClassName = objectName;
                } else {
                    // Try to resolve as an instance (e.g., ind.age where ind is an Individual)
                    resolvedClassName = resolveClassName(
                        objectName,
                        trackingState.instanceDefinitions as Record<string, string>
                    );
                }
                
                if (resolvedClassName) {
                    trackingState.propertyAssignments.set(varName, {
                        className: resolvedClassName,
                        propertyName: propertyName,
                    });
                }
            }
            
            const inferredType = inferTypeFromExpression(
                rhs,
                trackingState.instanceDefinitions as Record<string, string>
            );
            if (inferredType) {
                (trackingState.instanceDefinitions as Record<string, string>)[varName] =
                    inferredType;
            }
        }
    });

    if (!state) {
        documentCache.setTrackingState(document, trackingState);
    }

    return trackingState;
}
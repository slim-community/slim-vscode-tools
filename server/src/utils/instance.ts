import { CALLBACK_PSEUDO_PARAMETERS } from '../config/config';
import { inferTypeFromExpression, resolveClassName, inferLoopVariableType } from './type-manager';
import { DEFINITION_PATTERNS, CALLBACK_REGISTRATION_PATTERNS, COMPILED_CALLBACK_PATTERNS, EIDOS_FUNCTION_REGEX } from '../config/config';
import { CLASS_NAMES } from '../config/config';
import { TrackingState, CallbackState, UserFunctionInfo, PropertySourceInfo } from '../config/types';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { documentCache } from '../services/document-cache';
import { extractDocComment } from './text-processing';
import { LoopScope } from '../config/types';

// Pattern to match property access: ClassName.property or instance.property
const PROPERTY_ACCESS_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)$/;

// Pattern to match mutationsOfType calls: mutationsOfType(m1) or sim.mutationsOfType(m1)
const MUTATIONS_OF_TYPE_PATTERN = /mutationsOfType\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/;

function extractMutationTypeFromExpression(expression: string): string | null {
    const withoutArrayAccess = expression.replace(/\[[^\]]*\]/g, '');
    const match = withoutArrayAccess.match(MUTATIONS_OF_TYPE_PATTERN);
    return match ? match[1] : null;
}

function getMutationTypeForVariable(
    rhs: string,
    trackingState: TrackingState
): string | null {
    const mutationType = extractMutationTypeFromExpression(rhs);
    if (mutationType) {
        // Check if it's a defined mutation type OR if it's in instanceDefinitions as MutationType
        if (trackingState.definedMutationTypes.has(mutationType) || 
            trackingState.instanceDefinitions[mutationType] === CLASS_NAMES.MUTATION_TYPE) {
            return mutationType;
        }
    }
    
    // Check if RHS is a variable that we know contains mutations of a specific type
    const rhsVarMatch = rhs.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(\[.*\])?$/);
    if (rhsVarMatch) {
        const sourceVar = rhsVarMatch[1];
        if (trackingState.mutationTypeByInstance.has(sourceVar)) {
            return trackingState.mutationTypeByInstance.get(sourceVar)!;
        }
    }
    
    return null;
}

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
        loopScopes: [],
        mutationTypeByInstance: new Map<string, string>(),
    };
    
    // Use cached lines or create and cache them
    const lines = documentCache.getOrCreateLines(document);

    let callbackState: CallbackState = {
        currentCallback: null,
        braceDepth: 0,
        callbackStartLine: -1,
    };

    let pendingCallback: string | null = null;

    // Track brace depth for loop scope management
    let currentBraceDepth = 0;

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
        const previousBraceDepth = currentBraceDepth;
        currentBraceDepth += openBraces - closeBraces;

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
                const mutTypeName = typeMatch[1];
                trackingState.definedMutationTypes.add(mutTypeName);
                (trackingState.instanceDefinitions as Record<string, string>)[mutTypeName] =
                    CLASS_NAMES.MUTATION_TYPE;
            }
        }

        if (line.includes('initializeGenomicElementType')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.GENOMIC_ELEMENT_TYPE)) !== null) {
                const getTypeName = typeMatch[1];
                trackingState.definedGenomicElementTypes.add(getTypeName);
                (trackingState.instanceDefinitions as Record<string, string>)[getTypeName] =
                    CLASS_NAMES.GENOMIC_ELEMENT_TYPE;
            }
        }

        if (line.includes('initializeInteractionType')) {
            if ((typeMatch = line.match(DEFINITION_PATTERNS.INTERACTION_TYPE)) !== null) {
                const intTypeName = typeMatch[1];
                trackingState.definedInteractionTypes.add(intTypeName);
                (trackingState.instanceDefinitions as Record<string, string>)[intTypeName] =
                    CLASS_NAMES.INTERACTION_TYPE;
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
            
            // Check if the RHS is a simple variable name (could be a loop variable)
            const isSimpleVariable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rhs);
            const propertyAccessMatch = rhs.match(PROPERTY_ACCESS_PATTERN);
            const needsScopeCheck = isSimpleVariable || propertyAccessMatch;
            
            // Use instanceDefinitions by default, only get full scope if needed
            let variablesForInference = trackingState.instanceDefinitions as Record<string, string>;
            if (needsScopeCheck) {
                variablesForInference = getVariablesInScope(trackingState, lineIndex);
            }
            
            // Check if the RHS is a simple property access: ClassName.property or instance.property
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
                        variablesForInference
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
                variablesForInference
            );
            if (inferredType) {
                (trackingState.instanceDefinitions as Record<string, string>)[varName] =
                    inferredType;
                
                // If this is a Mutation instance, check if we can extract the mutation type
                if (inferredType === CLASS_NAMES.MUTATION) {
                    const mutationType = getMutationTypeForVariable(rhs, trackingState);
                    if (mutationType) {
                        trackingState.mutationTypeByInstance.set(varName, mutationType);
                    } else {
                        // Check if RHS is a variable that already has a known mutation type
                        const rhsVarMatch = rhs.match(/^([a-zA-Z_][a-zA-Z0-9_]*)$/);
                        if (rhsVarMatch) {
                            const sourceVar = rhsVarMatch[1];
                            if (trackingState.mutationTypeByInstance.has(sourceVar)) {
                                trackingState.mutationTypeByInstance.set(
                                    varName,
                                    trackingState.mutationTypeByInstance.get(sourceVar)!
                                );
                            }
                        }
                    }
                } else if (inferredType === CLASS_NAMES.MUTATION + '[]') {
                    // For mutation vectors, also track the mutation type
                    const mutationType = getMutationTypeForVariable(rhs, trackingState);
                    if (mutationType) {
                        trackingState.mutationTypeByInstance.set(varName, mutationType);
                    } else {
                        // Check if RHS is a variable that already has a known mutation type
                        const rhsVarMatch = rhs.match(/^([a-zA-Z_][a-zA-Z0-9_]*)$/);
                        if (rhsVarMatch) {
                            const sourceVar = rhsVarMatch[1];
                            if (trackingState.mutationTypeByInstance.has(sourceVar)) {
                                trackingState.mutationTypeByInstance.set(
                                    varName,
                                    trackingState.mutationTypeByInstance.get(sourceVar)!
                                );
                            }
                        }
                    }
                }
            }
        }

        // Track loop variables with scope
        const forInMatch = line.match(/for\s*\(\s*(\w+)\s+in\s+((?:[^()]*|\([^()]*\))*)\)/);
        if (forInMatch) {
            const loopVarName = forInMatch[1];
            const collection = forInMatch[2].trim();
            
            // Check if this is a single-line loop (ends with semicolon, no opening brace after the for statement)
            const afterFor = line.substring(line.indexOf(')') + 1).trim();
            const isSingleLineLoop = afterFor.endsWith(';') && !afterFor.startsWith('{');
            
            // Infer the type of the loop variable from the collection
            const elementType = inferLoopVariableType(
                collection,
                trackingState.instanceDefinitions as Record<string, string>
            );
            
            if (elementType) {
                for (let i = trackingState.loopScopes.length - 1; i >= 0; i--) {
                    const existingScope = trackingState.loopScopes[i];
                    if (existingScope.endLine === -1 && existingScope.braceDepth >= previousBraceDepth) {
                        existingScope.endLine = lineIndex - 1;
                    }
                }
                
                // Create a new loop scope
                const loopScope: LoopScope = {
                    variableName: loopVarName,
                    variableType: elementType,
                    startLine: lineIndex,
                    endLine: isSingleLineLoop ? lineIndex : -1, 
                    braceDepth: previousBraceDepth, 
                };
                
                trackingState.loopScopes.push(loopScope);
                
                // If this is a Mutation loop variable, check if we can extract the mutation type
                if (elementType === CLASS_NAMES.MUTATION) {
                    const mutationType = getMutationTypeForVariable(collection, trackingState);
                    if (mutationType) {
                        trackingState.mutationTypeByInstance.set(loopVarName, mutationType);
                    }
                }
            }
        }
        
        // Close loop scopes when braces close
        if (closeBraces > 0) {
            for (let i = trackingState.loopScopes.length - 1; i >= 0; i--) {
                const scope = trackingState.loopScopes[i];
                if (scope.endLine === -1 && scope.braceDepth >= currentBraceDepth) {
                    // This loop scope ended at the current line
                    scope.endLine = lineIndex;
                }
            }
        }
    });

    // Close any remaining open loop scopes at the end of the document
    for (const scope of trackingState.loopScopes) {
        if (scope.endLine === -1) {
            scope.endLine = lines.length - 1;
        }
    }

    if (!state) {
        documentCache.setTrackingState(document, trackingState);
    }

    return trackingState;
}

export function getVariablesInScope(
    trackingState: TrackingState,
    lineIndex: number
): Record<string, string> {
    const variables: Record<string, string> = {
        ...trackingState.instanceDefinitions,
    };
    
    for (const scope of trackingState.loopScopes) {
        if (scope.startLine < lineIndex && 
            (scope.endLine === -1 || lineIndex <= scope.endLine)) {
            variables[scope.variableName] = scope.variableType;
        }
    }
    
    return variables;
}
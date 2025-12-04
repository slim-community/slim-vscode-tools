import { Hover } from 'vscode-languageserver';
import { WordContext, FunctionInfo, ClassInfo, CallbackInfo, TypeInfo, UserFunctionInfo, PropertySourceInfo } from '../config/types';
import { CLASS_NAMES } from '../config/config';
import { resolveClassName } from './type-manager';
import {
    createMethodMarkdown,
    createPropertyMarkdown,
    createFunctionMarkdown,
    createCallbackMarkdown,
    createTypeMarkdown,
    createInstanceMarkdown,
    createEidosEventMarkdown,
    createUserFunctionMarkdown,
    createPropertySourceMarkdown,
} from './markdown';
import { EIDOS_EVENT_NAMES } from '../config/config';

function createHoverResponse(markdown: string): Hover {
    return { contents: { kind: 'markdown', value: markdown } };
}

function resolveClassForHover(
    className: string | undefined,
    instanceDefinitions: Record<string, string>,
    classesData: Record<string, ClassInfo>
): string | null {
    if (!className) return null;

    const resolved = resolveClassName(className, instanceDefinitions) || className;
    return classesData[resolved] ? resolved : classesData[className] ? className : null;
}

function getClassMemberHover(
    word: string,
    className: string | null,
    classesData: Record<string, ClassInfo>
): Hover | null {
    if (!className) return null;

    const classInfo = classesData[className];
    if (!classInfo) return null;

    if (classInfo.methods?.[word]) {
        return createHoverResponse(createMethodMarkdown(className, word, classInfo.methods[word]));
    }

    if (classInfo.properties?.[word]) {
        return createHoverResponse(
            createPropertyMarkdown(className, word, classInfo.properties[word])
        );
    }

    return null;
}

function getLogFileMemberHover(word: string, classesData: Record<string, ClassInfo>): Hover | null {
    if (!classesData[CLASS_NAMES.DICTIONARY]) return null;

    const dictClass = classesData[CLASS_NAMES.DICTIONARY];
    if (dictClass.methods?.[word]) {
        return createHoverResponse(
            createMethodMarkdown(CLASS_NAMES.LOGFILE, word, dictClass.methods[word])
        );
    }

    if (dictClass.properties?.[word]) {
        return createHoverResponse(
            createPropertyMarkdown(CLASS_NAMES.LOGFILE, word, dictClass.properties[word])
        );
    }

    for (const [, classInfo] of Object.entries(classesData)) {
        if (
            classInfo.methods?.[word] &&
            classInfo.methods[word].description?.includes(CLASS_NAMES.LOGFILE)
        ) {
            return createHoverResponse(
                createMethodMarkdown(CLASS_NAMES.LOGFILE, word, classInfo.methods[word])
            );
        }
    }

    return null;
}

function getCallbackHover(word: string, callbacksData: Record<string, CallbackInfo>): Hover | null {
    if (EIDOS_EVENT_NAMES.includes(word) && callbacksData['Eidos events']) {
        return createHoverResponse(createEidosEventMarkdown(word, callbacksData['Eidos events']));
    }

    for (const [callbackName, callbackInfo] of Object.entries(callbacksData)) {
        if (
            callbackInfo.signature === word + '()' ||
            callbackInfo.signature === word ||
            callbackName.startsWith(word + '(') ||
            callbackName.startsWith(word + '()')
        ) {
            return createHoverResponse(createCallbackMarkdown(callbackName, callbackInfo));
        }
    }

    return null;
}

export function getHoverForWord(
    word: string,
    context: WordContext,
    functionsData: Record<string, FunctionInfo>,
    classesData: Record<string, ClassInfo>,
    callbacksData: Record<string, CallbackInfo>,
    typesData: Record<string, TypeInfo>,
    instanceDefinitions: Record<string, string>,
    userFunctions?: Map<string, UserFunctionInfo>,
    propertyAssignments?: Map<string, PropertySourceInfo>
): Hover | null {
    if (context.instanceClass) {
        return createHoverResponse(createInstanceMarkdown(word, context.instanceClass));
    }

    if (context.isMethodOrProperty && context.className) {
        const className = resolveClassForHover(context.className, instanceDefinitions, classesData);

        if (className === CLASS_NAMES.LOGFILE) {
            const hover = getLogFileMemberHover(word, classesData);
            if (hover) return hover;
        }

        const hover = getClassMemberHover(word, className, classesData);
        if (hover) return hover;
    }

    // Check if this variable was assigned from a class property (e.g., age_var = Individual.age)
    if (propertyAssignments?.has(word)) {
        const source = propertyAssignments.get(word)!;
        const classInfo = classesData[source.className];
        if (classInfo?.properties?.[source.propertyName]) {
            return createHoverResponse(
                createPropertySourceMarkdown(
                    word,
                    source.className,
                    source.propertyName,
                    classInfo.properties[source.propertyName]
                )
            );
        }
    }

    const functionInfo = functionsData[word];
    if (functionInfo && typeof functionInfo === 'object' && 'signature' in functionInfo) {
        const source = functionInfo.source || undefined;
        return createHoverResponse(createFunctionMarkdown(word, functionInfo, source));
    }

    // Check for user-defined functions
    if (userFunctions?.has(word)) {
        const userFuncInfo = userFunctions.get(word)!;
        return createHoverResponse(createUserFunctionMarkdown(userFuncInfo));
    }

    const callbackHover = getCallbackHover(word, callbacksData);
    if (callbackHover) return callbackHover;

    const typeInfo = typesData[word];
    if (typeInfo) {
        return createHoverResponse(createTypeMarkdown(word, typeInfo));
    }

    return null;
}
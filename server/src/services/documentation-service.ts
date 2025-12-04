import * as fs from 'fs';

import {
    SLIM_FUNCTIONS_PATH,
    EIDOS_FUNCTIONS_PATH,
    SLIM_CLASSES_PATH,
    EIDOS_CLASSES_PATH,
    SLIM_CALLBACKS_PATH,
    EIDOS_TYPES_PATH,
    EIDOS_OPERATORS_PATH,
} from '../config/paths';
import {
    TEXT_PROCESSING_PATTERNS,
} from '../config/config';
import {
    FunctionInfo,
    ClassInfo,
    CallbackInfo,
    TypeInfo,
    OperatorInfo,
    ConstructorInfo,
    LanguageMode,
} from '../config/types';
import { log, logErrorWithStack } from '../utils/logger';
import { cleanSignature } from '../utils/text-processing';
import { isSourceAvailableInMode } from '../utils/file-type';

// Helper function to extract constructor information from class data
function buildClassConstructors(
    classesData: Record<string, ClassInfo>
): Record<string, ConstructorInfo> {
    const classConstructors: Record<string, ConstructorInfo> = {};

    for (const [className, classInfo] of Object.entries(classesData)) {
        const constructorInfo = classInfo.constructor || {};
        const rawSignature = constructorInfo.signature?.trim() || 'None';
        classConstructors[className] = {
            signature: rawSignature !== 'None' ? cleanSignature(rawSignature) : 'None',
            description:
                constructorInfo.description?.trim() || 'No constructor method implemented',
        };
    }

    return classConstructors;
}

export class DocumentationService {
    private functionsData: Record<string, FunctionInfo> = {};
    private classesData: Record<string, ClassInfo> = {};
    private callbacksData: Record<string, CallbackInfo> = {};
    private typesData: Record<string, TypeInfo> = {};
    private operatorsData: Record<string, OperatorInfo> = {};
    private classConstructors: Record<string, ConstructorInfo> = {};

    constructor() {
        this.loadDocumentation();
    }

    public loadDocumentation(): void {
        try {
            this.loadFunctionData(SLIM_FUNCTIONS_PATH, 'slim', this.functionsData);
            log(`Loaded SLiM functions: ${Object.keys(this.functionsData).length} functions`);

            this.loadFunctionData(EIDOS_FUNCTIONS_PATH, 'eidos', this.functionsData);
            log(
                `Loaded Eidos functions: ${Object.keys(this.functionsData).length} total functions`
            );

            this.loadClassData(SLIM_CLASSES_PATH, 'slim', this.classesData);
            log(`Loaded SLiM classes: ${Object.keys(this.classesData).length} classes`);

            this.loadClassData(EIDOS_CLASSES_PATH, 'eidos', this.classesData);
            log(`Loaded Eidos classes: ${Object.keys(this.classesData).length} total classes`);

            this.loadCallbackData(SLIM_CALLBACKS_PATH, this.callbacksData);
            log(`Loaded SLiM callbacks: ${Object.keys(this.callbacksData).length} callbacks`);

            const types = this.loadJsonFile<Record<string, TypeInfo>>(EIDOS_TYPES_PATH);
            if (types) {
                // Add source to each type (Eidos types are available in both modes)
                for (const [typeName, typeInfo] of Object.entries(types)) {
                    if (typeInfo && typeof typeInfo === 'object') {
                        this.typesData[typeName] = { ...typeInfo, source: 'eidos' };
                    }
                }
                log(`Loaded Eidos types: ${Object.keys(this.typesData).length} types`);
            }

            this.loadOperatorData(EIDOS_OPERATORS_PATH, this.operatorsData);
            log(`Loaded Eidos operators: ${Object.keys(this.operatorsData).length} operators`);

            this.classConstructors = this.extractClassConstructors(this.classesData);

            log('Documentation loaded successfully');
        } catch (error) {
            logErrorWithStack(error, 'Error loading documentation');
        }
    }

    public getFunctions(mode?: LanguageMode): Record<string, FunctionInfo> {
        if (!mode) {
            return this.functionsData;
        }
        return this.filterByLanguageMode(this.functionsData, mode);
    }

    public getClasses(mode?: LanguageMode): Record<string, ClassInfo> {
        if (!mode) {
            return this.classesData;
        }
        return this.filterByLanguageMode(this.classesData, mode);
    }

    public getCallbacks(mode?: LanguageMode): Record<string, CallbackInfo> {
        if (!mode) {
            return this.callbacksData;
        }
        return this.filterByLanguageMode(this.callbacksData, mode);
    }

    public getTypes(mode?: LanguageMode): Record<string, TypeInfo> {
        if (!mode) {
            return this.typesData;
        }
        return this.filterByLanguageMode(this.typesData, mode);
    }

    public getOperators(): Record<string, OperatorInfo> {
        return this.operatorsData;
    }

    public getClassConstructors(mode?: LanguageMode): Record<string, ConstructorInfo> {
        if (!mode) {
            return this.classConstructors;
        }
        // Filter constructors based on their parent class's source
        const filteredClasses = this.getClasses(mode);
        const result: Record<string, ConstructorInfo> = {};
        for (const [className, constructorInfo] of Object.entries(this.classConstructors)) {
            if (filteredClasses[className]) {
                result[className] = constructorInfo;
            }
        }
        return result;
    }

    private filterByLanguageMode<T extends { source?: LanguageMode }>(
        data: Record<string, T>,
        mode: LanguageMode
    ): Record<string, T> {
        const result: Record<string, T> = {};
        for (const [key, value] of Object.entries(data)) {
            if (isSourceAvailableInMode(value.source, mode)) {
                result[key] = value;
            }
        }
        return result;
    }

    private transformFunctionData(
        _funcName: string,
        funcData: { signatures: string[]; description: string },
        _category: string,
        source: LanguageMode
    ): FunctionInfo {
        const signature = funcData.signatures[0];
        const returnTypeMatch = signature.match(TEXT_PROCESSING_PATTERNS.RETURN_TYPE);
        const returnType = returnTypeMatch ? returnTypeMatch[1] : 'void';
        const signatureWithoutReturnType = signature.replace(/^\([^)]+\)\s*/, '');

        return {
            ...funcData,
            signature: signatureWithoutReturnType,
            returnType,
            source,
        };
    }

    private transformCallbackData(
        _callbackName: string,
        callbackData: { signature: string; description: string }
    ): CallbackInfo {
        return {
            ...callbackData,
            signature: callbackData.signature.replace(/\s+(callbacks|events)$/, ''),
            source: 'slim', // All callbacks are SLiM-specific
        };
    }

    private transformOperatorData(
        _operatorKey: string,
        operatorInfo: { signature?: string; description: string }
    ): OperatorInfo {
        return {
            ...operatorInfo,
            signature: operatorInfo.signature || '',
        };
    }

    private loadJsonFile<T>(filePath: string): T | null {
        if (!fs.existsSync(filePath)) {
            log(`Warning: Documentation file not found: ${filePath}`);
            return null;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Validate content is not empty
            if (!content || content.trim().length === 0) {
                log(`Warning: Documentation file is empty: ${filePath}`);
                return null;
            }
            
            const parsed = JSON.parse(content);
            
            // Validate that parsed content is an object
            if (typeof parsed !== 'object' || parsed === null) {
                log(`Warning: Documentation file does not contain valid JSON object: ${filePath}`);
                return null;
            }
            
            return parsed as T;
        } catch (error) {
            if (error instanceof SyntaxError) {
                logErrorWithStack(error, `Invalid JSON syntax in ${filePath}`);
            } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
                logErrorWithStack(error, `Permission denied reading ${filePath}`);
            } else {
                logErrorWithStack(error, `Error loading ${filePath}`);
            }
            return null;
        }
    }

    private loadFunctionData(
        filePath: string,
        source: LanguageMode,
        target: Record<string, FunctionInfo>
    ): void {
        const data =
            this.loadJsonFile<
                Record<string, Record<string, { signatures: string[]; description: string }>>
            >(filePath);
        if (!data) return;

        for (const [category, items] of Object.entries(data)) {
            if (!items || typeof items !== 'object') continue;
            
            for (const [key, value] of Object.entries(items)) {
                // Skip invalid entries silently
                if (!value || !Array.isArray(value.signatures) || !value.signatures.length) continue;
                
                target[key] = this.transformFunctionData(key, value, category, source);
            }
        }
    }

    private loadClassData(
        filePath: string,
        source: LanguageMode,
        target: Record<string, ClassInfo>
    ): void {
        const data = this.loadJsonFile<Record<string, ClassInfo>>(filePath);
        if (!data) return;

        for (const [className, classInfo] of Object.entries(data)) {
            if (!classInfo || typeof classInfo !== 'object') continue;
            target[className] = { ...classInfo, source };
        }
    }

    private loadCallbackData(filePath: string, target: Record<string, CallbackInfo>): void {
        const data =
            this.loadJsonFile<Record<string, { signature: string; description: string }>>(
                filePath
            );
        if (!data) return;

        for (const [key, value] of Object.entries(data)) {
            if (!value || !value.signature) continue;
            target[key] = this.transformCallbackData(key, value);
        }
    }

    private loadOperatorData(filePath: string, target: Record<string, OperatorInfo>): void {
        const data =
            this.loadJsonFile<Record<string, { signature?: string; description: string }>>(
                filePath
            );
        if (!data) return;

        for (const [key, value] of Object.entries(data)) {
            if (!value || typeof value !== 'object') continue;
            
            const signature = value.signature || '';
            const extractedKeys = signature
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s);

            for (const extractedKey of extractedKeys) {
                const normalizedKey = extractedKey.trim().replace(/['"]/g, '');
                if (normalizedKey) {
                    target[normalizedKey] = this.transformOperatorData(key, value);
                }
            }
        }
    }

    private extractClassConstructors(
        classesData: Record<string, ClassInfo>
    ): Record<string, ConstructorInfo> {
        return buildClassConstructors(classesData);
    }
}
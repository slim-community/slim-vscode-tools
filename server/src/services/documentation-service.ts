import * as fs from 'fs';
import {
    slimFunctionsPath,
    eidosFunctionsPath,
    slimClassesPath,
    eidosClassesPath,
    slimCallbacksPath,
    eidosTypesPath,
    eidosOperatorsPath,
} from '../config/paths';
import { TEXT_PROCESSING_PATTERNS } from '../config/config';
import {
    FunctionData,
    ClassInfo,
    CallbackInfo,
    TypeInfo,
    OperatorInfo,
    ConstructorInfo,
} from '../config/types';
import { log, logErrorWithStack } from '../utils/logger';
import { cleanSignature } from '../utils/text-processing';

export class DocumentationService {
    private functionsData: Record<string, FunctionData> = {};
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
            this.loadFunctionData(slimFunctionsPath, 'SLiM', this.functionsData);
            log(`Loaded slim functions: ${Object.keys(this.functionsData).length} functions`);

            this.loadFunctionData(eidosFunctionsPath, 'Eidos', this.functionsData);
            log(
                `Loaded eidos functions: ${Object.keys(this.functionsData).length} total functions`
            );

            this.loadClassData(slimClassesPath, this.classesData);
            log(`Loaded slim classes: ${Object.keys(this.classesData).length} classes`);

            this.loadClassData(eidosClassesPath, this.classesData);
            log(`Loaded eidos classes: ${Object.keys(this.classesData).length} total classes`);

            this.loadCallbackData(slimCallbacksPath, this.callbacksData);
            log(`Loaded slim callbacks: ${Object.keys(this.callbacksData).length} callbacks`);

            const types = this.loadJsonFile<Record<string, TypeInfo>>(eidosTypesPath);
            if (types) {
                Object.assign(this.typesData, types);
                log(`Loaded eidos types: ${Object.keys(this.typesData).length} types`);
            }

            this.loadOperatorData(eidosOperatorsPath, this.operatorsData);
            log(`Loaded eidos operators: ${Object.keys(this.operatorsData).length} operators`);

            this.classConstructors = this.extractClassConstructors(this.classesData);

            log('Documentation loaded successfully');
        } catch (error) {
            logErrorWithStack(error, 'Error loading documentation');
        }
    }

    public getFunctions(): Record<string, FunctionData> {
        return this.functionsData;
    }

    public getClasses(): Record<string, ClassInfo> {
        return this.classesData;
    }

    public getCallbacks(): Record<string, CallbackInfo> {
        return this.callbacksData;
    }

    public getTypes(): Record<string, TypeInfo> {
        return this.typesData;
    }

    public getOperators(): Record<string, OperatorInfo> {
        return this.operatorsData;
    }

    public getClassConstructors(): Record<string, ConstructorInfo> {
        return this.classConstructors;
    }

    private transformFunctionData(
        _funcName: string,
        funcData: { signatures: string[]; description: string },
        _category: string,
        source: 'SLiM' | 'Eidos'
    ): FunctionData {
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
        };
    }

    private transformOperatorData(
        _operatorKey: string,
        operatorInfo: { signature?: string; description: string },
        normalizedSymbol: string
    ): OperatorInfo {
        return {
            ...operatorInfo,
            signature: operatorInfo.signature || '',
            symbol: normalizedSymbol,
        };
    }

    private loadJsonFile<T>(filePath: string): T | null {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content) as T;
        } catch (error) {
            logErrorWithStack(error, `Error loading ${filePath}`);
            return null;
        }
    }

    private loadFunctionData(
        filePath: string,
        source: 'SLiM' | 'Eidos',
        target: Record<string, FunctionData>
    ): void {
        const data =
            this.loadJsonFile<
                Record<string, Record<string, { signatures: string[]; description: string }>>
            >(filePath);
        if (!data) return;

        for (const [category, items] of Object.entries(data)) {
            for (const [key, value] of Object.entries(items)) {
                target[key] = this.transformFunctionData(key, value, category, source);
            }
        }
    }

    private loadClassData(filePath: string, target: Record<string, ClassInfo>): void {
        const data = this.loadJsonFile<Record<string, ClassInfo>>(filePath);
        if (data) {
            Object.assign(target, data);
        }
    }

    private loadCallbackData(filePath: string, target: Record<string, CallbackInfo>): void {
        const data =
            this.loadJsonFile<Record<string, { signature: string; description: string }>>(filePath);
        if (!data) return;

        for (const [key, value] of Object.entries(data)) {
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
            const signature = value.signature || '';
            const extractedKeys = signature
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s);

            for (const extractedKey of extractedKeys) {
                const normalizedKey = extractedKey.trim().replace(/['"]/g, '');
                if (normalizedKey) {
                    target[normalizedKey] = this.transformOperatorData(key, value, normalizedKey);
                }
            }
        }
    }

    private extractClassConstructors(
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
}

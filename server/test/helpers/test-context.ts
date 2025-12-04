import { Connection, TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentationService } from '../../src/services/documentation-service';
import { CompletionService } from '../../src/services/completion-service';
import { ValidationService } from '../../src/services/validation-service';
import { LanguageServerContext } from '../../src/config/types';
import { setLoggerSilent } from '../../src/utils/logger';
import { documentCache } from '../../src/services/document-cache';


export interface TestContextOptions {
    /** Whether to verify documentation loaded (default: false) */
    verifyDocumentation?: boolean;
    /** Whether to clear the document cache (default: true) */
    clearCache?: boolean;
    /** Whether to silence the logger (default: true) */
    silentLogger?: boolean;
    /** Optional pre-created services to use instead of creating new ones */
    documentationService?: DocumentationService;
    completionService?: CompletionService;
    validationService?: ValidationService;
}

export interface TestContextResult {
    documentationService: DocumentationService;
    completionService: CompletionService;
    validationService: ValidationService;
    mockDocuments: TextDocuments<TextDocument>;
    context: LanguageServerContext;
}

export function createTestServices(options: TestContextOptions = {}): {
    documentationService: DocumentationService;
    completionService: CompletionService;
    validationService: ValidationService;
} {
    const {
        verifyDocumentation = false,
        clearCache = true,
        silentLogger = true,
    } = options;

    if (silentLogger) {
        setLoggerSilent(true);
    }

    if (clearCache) {
        documentCache.clear();
    }

    // Use provided services or create new ones
    const documentationService = options.documentationService ?? new DocumentationService();
    const completionService = options.completionService ?? new CompletionService(documentationService);
    const validationService = options.validationService ?? new ValidationService(documentationService);

    if (verifyDocumentation) {
        const functions = documentationService.getFunctions();
        if (Object.keys(functions).length === 0) {
            throw new Error(
                'Documentation failed to load - no functions found. Check that docs/ directory exists.'
            );
        }
    }

    return {
        documentationService,
        completionService,
        validationService,
    };
}

export function createMockDocuments(): any {
    return {
        get: (uri: string) => TextDocument.create(uri, 'slim', 1, ''),
    };
}

export function createTestContext(
    mockConnection: Partial<Connection>,
    options: TestContextOptions = {}
): TestContextResult {
    const services = createTestServices(options);
    const mockDocuments = createMockDocuments();

    const context: LanguageServerContext = {
        connection: mockConnection as Connection,
        documents: mockDocuments as TextDocuments<TextDocument>,
        ...services,
    };

    return {
        ...services,
        mockDocuments,
        context,
    };
}

export function createTestDocument(
    content: string,
    uri: string = 'file:///test.slim',
    languageId: string = 'slim',
    version: number = 1
): TextDocument {
    return TextDocument.create(uri, languageId, version, content);
}


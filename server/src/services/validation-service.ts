import { Diagnostic } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentationService } from './documentation-service';
import { validateStructure } from '../validation/structure';
import { getFileType } from '../utils/file-type';
import { documentCache } from './document-cache';

export class ValidationService {
    constructor(private documentationService: DocumentationService) {
        // documentationService will be used when additional validation features are integrated
    }

    // Gets the documentation service
    public getDocumentationService(): DocumentationService {
        return this.documentationService;
    }

    public async validate(textDocument: TextDocument): Promise<Diagnostic[]> {
        // Check cache first - avoid re-validating unchanged documents
        const cached = documentCache.getDiagnostics(textDocument);
        if (cached) {
            return cached;
        }

        const lines = documentCache.getOrCreateLines(textDocument);
        const diagnostics: Diagnostic[] = [];

        // Determine file type for appropriate validation
        const fileType = getFileType(textDocument);

        // Run structure validation (stateless - safe for concurrent calls)
        const structureDiagnostics = validateStructure(lines, fileType);
        diagnostics.push(...structureDiagnostics);

        // Future validation modules will be called here following this pattern:
        // e.g. for method/property call validation,
        //
        //    const methodPropertyDiagnostics = validateMethodOrPropertyCall(
        //        lines,
        //        trackingState,
        //        this.documentationService.getClasses(fileType)
        //    );
        //    diagnostics.push(...methodPropertyDiagnostics);

        // Cache the results using the unified document cache
        documentCache.setDiagnostics(textDocument, diagnostics);

        return diagnostics;
    }
}

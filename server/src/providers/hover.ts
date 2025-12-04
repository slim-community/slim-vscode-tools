import { HoverParams } from 'vscode-languageserver';
import { getOperatorAtPosition, getWordAndContextAtPosition } from '../utils/positions';
import { trackInstanceDefinitions } from '../utils/instance';
import { createOperatorMarkdown } from '../utils/markdown';
import { LanguageServerContext } from '../config/types';
import { getHoverForWord } from '../utils/hover-resolvers';
import { getFileType } from '../utils/file-type';

export function registerHoverProvider(context: LanguageServerContext): void {
    const { connection, documents, documentationService } = context;

    connection.onHover((params: HoverParams) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;

        const position = params.position;
        const text = document.getText();
        const trackingState = trackInstanceDefinitions(document);

        // Get documentation data (with proper file type filtering)
        const fileType = getFileType(document);
        const functionsData = documentationService.getFunctions(fileType);
        const classesData = documentationService.getClasses(fileType);
        const callbacksData = documentationService.getCallbacks(fileType);
        const typesData = documentationService.getTypes(fileType);
        const operatorsData = documentationService.getOperators();

        // Check for operators first
        const operator = getOperatorAtPosition(text, position);
        if (operator && operatorsData[operator]) {
            return {
                contents: {
                    kind: 'markdown',
                    value: createOperatorMarkdown(operator, operatorsData[operator]),
                },
            };
        }

        const wordInfo = getWordAndContextAtPosition(
            text, 
            position,
            trackingState.instanceDefinitions as Record<string, string>
        );
        if (!wordInfo) return null;

        return getHoverForWord(
            wordInfo.word,
            wordInfo.wordContext,
            functionsData,
            classesData,
            callbacksData,
            typesData,
            trackingState.instanceDefinitions as Record<string, string>,
            trackingState.userFunctions,
            trackingState.propertyAssignments
        );
    });
}
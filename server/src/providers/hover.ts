import { HoverParams } from 'vscode-languageserver';
import { getOperatorAtPosition, getWordAndContextAtPosition } from '../utils/positions';
import { trackInstanceDefinitions } from '../utils/instance';
import { inferTypeFromExpression, resolveClassName } from '../utils/type-manager';
import { createOperatorMarkdown } from '../utils/markdown';
import { LanguageServerContext } from '../config/types';
import { getHoverForWord } from '../utils/hover-resolvers';

export function registerHoverProvider(context: LanguageServerContext): void {
    const { connection, documents, documentationService } = context;
    const functionsData = documentationService.getFunctions();
    const classesData = documentationService.getClasses();
    const callbacksData = documentationService.getCallbacks();
    const typesData = documentationService.getTypes();
    const operatorsData = documentationService.getOperators();

    connection.onHover((params: HoverParams) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) return null;

        const position = params.position;
        const text = document.getText();
        const trackingState = trackInstanceDefinitions(document);

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

        const wordInfo = getWordAndContextAtPosition(text, position, {
            resolveClassName,
            instanceDefinitions: trackingState.instanceDefinitions,
            inferTypeFromExpression,
        });
        if (!wordInfo) return null;

        return getHoverForWord(
            wordInfo.word,
            wordInfo.context,
            functionsData,
            classesData,
            callbacksData,
            typesData,
            trackingState.instanceDefinitions
        );
    });
}

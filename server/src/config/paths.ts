import * as path from 'path';

// Calculate extension root: from out/server/src/config/ go up 4 levels to project root
const extensionRoot = path.resolve(__dirname, '..', '..', '..', '..');

const slimFunctionsPath = path.join(extensionRoot, 'docs', 'slim_functions.json');
const eidosFunctionsPath = path.join(extensionRoot, 'docs', 'eidos_functions.json');
const slimClassesPath = path.join(extensionRoot, 'docs', 'slim_classes.json');
const eidosClassesPath = path.join(extensionRoot, 'docs', 'eidos_classes.json');
const slimCallbacksPath = path.join(extensionRoot, 'docs', 'slim_callbacks.json');
const eidosTypesPath = path.join(extensionRoot, 'docs', 'eidos_types.json');
const eidosOperatorsPath = path.join(extensionRoot, 'docs', 'eidos_operators.json');

export {
    slimFunctionsPath,
    eidosFunctionsPath,
    slimClassesPath,
    eidosClassesPath,
    slimCallbacksPath,
    eidosTypesPath,
    eidosOperatorsPath,
};

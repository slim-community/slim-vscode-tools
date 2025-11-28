import * as path from 'path';

// Documentation file paths relative to the compiled output directory
// When compiled, files in server/src will be in out/server/src
// So we need to go up 4 levels: out/server/src/config -> root
export const SLIM_FUNCTIONS_PATH = path.join(__dirname, '../../../..', 'docs', 'slim_functions.json');
export const EIDOS_FUNCTIONS_PATH = path.join(__dirname, '../../../..', 'docs', 'eidos_functions.json');
export const SLIM_CLASSES_PATH = path.join(__dirname, '../../../..', 'docs', 'slim_classes.json');
export const EIDOS_CLASSES_PATH = path.join(__dirname, '../../../..', 'docs', 'eidos_classes.json');
export const SLIM_CALLBACKS_PATH = path.join(__dirname, '../../../..', 'docs', 'slim_callbacks.json');
export const EIDOS_TYPES_PATH = path.join(__dirname, '../../../..', 'docs', 'eidos_types.json');
export const EIDOS_OPERATORS_PATH = path.join(__dirname, '../../../..', 'docs', 'eidos_operators.json');

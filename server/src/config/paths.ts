import * as path from 'path';

// Documentation file paths - works in both compiled and test environments
// Detect if we're in compiled output (out/server/src/config) or source (server/src/config)
const isCompiledOutput = __dirname.includes(path.join('out', 'server'));
const levelsUp = isCompiledOutput ? '../../../..' : '../../..';

export const SLIM_FUNCTIONS_PATH = path.join(__dirname, levelsUp, 'docs', 'slim_functions.json');
export const EIDOS_FUNCTIONS_PATH = path.join(__dirname, levelsUp, 'docs', 'eidos_functions.json');
export const SLIM_CLASSES_PATH = path.join(__dirname, levelsUp, 'docs', 'slim_classes.json');
export const EIDOS_CLASSES_PATH = path.join(__dirname, levelsUp, 'docs', 'eidos_classes.json');
export const SLIM_CALLBACKS_PATH = path.join(__dirname, levelsUp, 'docs', 'slim_callbacks.json');
export const EIDOS_TYPES_PATH = path.join(__dirname, levelsUp, 'docs', 'eidos_types.json');
export const EIDOS_OPERATORS_PATH = path.join(__dirname, levelsUp, 'docs', 'eidos_operators.json');

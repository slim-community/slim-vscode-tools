# Change Log

All notable changes to the "slim-tools" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

### Initial release
- simple handling of coloring, sytax checking. 
- Run SLiM script command
- Status bar integration

### 0.0.1-beta
Added new features:
- Real-time syntax checking and validation
- SLiM-specific block structure validation
- Enhanced error reporting with inline diagnostics
- Support for generation-prefixed blocks

### 0.0.1
Initial release of `slim-tools` with the following features:
- Syntax highlighting for SLiM scripts
- Snippets for common SLiM patterns
- Basic IntelliSense support
- Custom view and command to run SLiM scripts
- Status bar integration

## [0.0.2]

- Full, auto-parsed SLiM documentation now appears in an object-oriented aware way
- Hover / autocomplete for Classes, their properties and methods, etc. 

## [0.0.3]

- Documentation Tree view now shows the full hierarchy of classes, methods, properties, etc.
- Clicking on document item in the tree view opens the corresponding section of the slim documentation in a webview
- Improvements in semicolon handling to be more C++ like


## [0.0.4]

- this is only a number bump to include a better icon on the marketplace

## [0.0.5]
- Added GH action to auto-publish the extension to the marketplace
- altered the repo location in the package.json to point to the new location in the slim-community organization

## [0.0.6]
- Added better handling of semicolons in the editor

## [0.0.7]
- Updated documentation to SLiM v5.1
- Improved language configuration (indentation rules, folding, etc.)
- Updated link in README
- Added test simulations (and moved the existing one) into `/test-sims`
- Remove unused files

## [0.0.8]
- Refactor the language server and extension from JavaScript to TypeScript
- Boilerplate for Vitest testing system
- Small updates to syntax (slim.tmLanguage.json)
- ESLint/Prettier installed for the project
- Update .gitignore

## [0.0.9]
- Refactor: Increase modularity of language server providers and utils for future expansion
- - `server/src` for all language server code
- - `server/src/config` for constants and types shared across the language server
- - - `config.ts` for constants
- - - `paths.ts` for paths
- - - `types.ts` for TypeScript types
- - `server/src/handlers` holds `handlers.ts` for implementing handlers that get sent to `server/index.ts`
- - `server/src/providers` for providers of individual language server features (fed into `handlers`)
- - - `completion.ts` for code completion 
- - - `document-symbols.ts` for outline view
- - - `hover.ts` for hover info
- - - `references.ts` for finding all references across the file (not yet implemented)
- - - `signature-help.ts` for hints about required & optional parameters for functions and methods
- - `server/src/services` for services used across the language server
- - - `documentation-service.ts` manages loading documentation
- - - `validation-service.ts` manages validating code files / checking for errors
- - `server/src/utils` for general utilities used across the language server
- - - `instance.ts` for tracking defined objects within the current file
- - - `positions.ts` for tracking positions in the file
- - `server/src/validation` for scripts used by the validation service to check for errors
- - - `structure.ts` for validating the structure of the script (e.g. semicolon-related errors)

## [0.0.10]

### Major Features
- **Eidos file support**: Full language server support for `.eidos` files with appropriate feature filtering
  - Added language configuration for `.eidos` file extension in `package.json`
  - Eidos files only receive Eidos-specific completions, hover info, and documentation
- **Performance improvements**: Document caching system to reduce redundant parsing
- **Enhanced type inference**: Comprehensive type resolution for variables, constants, and expressions

### New Utilities
- `file-type.ts`: Determines file type (`.eidos` vs `.slim`) and filters features accordingly
- `logger.ts`: Connection-aware logging system with fallback to console logging
- `document-cache.ts`: Version-aware caching system for parsed document state
- `text-processing.ts`: HTML entity decoding (using `he` library - resolves issue [#6](https://github.com/slim-community/slim-vscode-tools/issues/6)), type name cleaning, and signature formatting
- `markdown.ts`: Centralized markdown generation for hover tooltips and completion documentation
- `type-manager.ts`: Type inference engine for expressions, variables, and SLiM-specific patterns (e.g., `p1`, `m1`)
- `hover-resolvers.ts`: Modular hover resolution logic separated from provider code

### Services
- `completion-service.ts`: Refactored completion logic into dedicated service class
  - Supports context-aware completions for methods, properties, functions, callbacks, and types
  - Integrates with type inference for better suggestions
- `documentation-service.ts`: Turned documentation retrieval and management into a service
  - Loads operator documentation from `eidos_operators.json`
  - Improved error handling and logging

### Improvements to Existing Files

#### `instance.ts`
- Tracks pseudo-parameters (e.g., `mut`, `individual`, `subpop`) within callback scopes
- Detects model type (WF vs nonWF) from `initializeSLiMModelType()`
- Tracks defined constants, mutation types, genomic element types, interaction types, subpopulations, species, and script blocks
- Properly handles multiple active documents without race conditions

#### `handlers.ts`
- Initializes `DocumentationService` and `CompletionService` instances
- Creates `LanguageServerContext` object for passing shared state
- Registers document cache cleanup on document close

#### `hover.ts`
- Refactored to use `hover-resolvers.ts` for cleaner separation of concerns

#### `extension.ts`
- Status bar now dynamically shows "Run Eidos" or "Run SLiM" based on active file

### Test Files
- Added `test.eidos`: Lotka-Volterra predator-prey dynamics simulator (pure Eidos implementation)
- Added unit tests for language server providers in `server/src/test`

## [0.0.11]

### Major Features
- **Go to Definition** (`definitions.ts`): Jump to the definition of variables, functions, constants, and SLiM objects
- **Code Actions (Quick Fixes)** (`code-actions.ts`): Automated fixes for common syntax errors (missing semicolons, unmatched braces, etc.)
- **Formatting** (`formatting.ts`): Configurable document formatting for full documents or ranges
- **Find All References** (`references.ts`): Locate all usages of variables, functions, and SLiM objects
- **Folding Ranges** (`folding-range.ts`): Collapse code blocks for better navigation
- **Inlay Hints** (`inlay-hints.ts`): Inline type and parameter information

### New Utilities
- `diagnostics.ts`: Centralized diagnostic creation utilities for consistent error reporting
- `validation-utils.ts`: Helper utilities for getting character ranges for validation diagnostics
- `eidos-function-parser.ts`: Parser for Eidos function signatures and parameter extraction
- `vector-detector.ts`: Singleton/vector type discrimination and conversion utilities for Eidos type system
- `ranges.ts`: Block range finding and comment range detection utilities for folding and navigation

### Refactored Validation System

#### `validation-service.ts`
- Integrated with document caching system for significant performance improvement in large files
- Modular validation pipeline with clear extension points
- Prepared infrastructure for future validation modules

#### `structure.ts`
- Complete rewrite with enhanced error detection
  - Multi-line string tracking with proper escape sequence handling
  - Improved brace, bracket, and parenthesis balance tracking
  - Better detection of unclosed constructs

### Enhanced Caching System (`document-cache.ts`)
- Implemented configurable LRU (Least Recently Used) eviction policy
- Separate caching for tracking state and diagnostics

### Test Coverage
- **New test suites**
  - Comprehensive unit test suites for all providers
  - Existing unit tests expanded for new functionality and edge cases
  - New integration tests for testing array access, instance tracking, and tracking order
  
### Minor Updates & Bug Fixes
- Improved `signature-help.ts` and `completion-service.ts` with new features/utils
- Fixed user-defined function handling to use the correct Eidos syntax
- Added user-defined functions to tracking for hover info, completion, and signature help
- Improve hover info behavior for class members
- Fixed subpopulation definition patterns to handle multispecies models
- Improved multi-line string handling in validation
- Removed `--passWithNoTests` flag from language server test script (tests now required to pass)
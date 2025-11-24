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

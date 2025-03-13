# slim-tools README

`slim-tools` is a Visual Studio Code extension designed to provide comprehensive support for the SLiM simulation package. This extension includes features such as syntax highlighting, snippets, IntelliSense, and commands to enhance the development experience for SLiM scripts.

## ✨ Features

### Syntax Highlighting
Provides syntax highlighting for SLiM scripts using a TextMate grammar. This includes:
- Line and block comments
- Double and single-quoted strings with escape sequences
- Control keywords (`if`, `else`, `for`, `while`, `function`, `return`, `break`, `continue`)
- SLiM-specific keywords (`initialize`, `sim`, `initializeSLiMOptions`, etc.)
- Numeric constants
- Language variables (`this`, `self`)
- Function definitions and parameters

### Snippets
Includes a set of useful snippets to speed up the development process. For example:
- `initWF`: Initializes a basic Wright-Fisher model.
- `initSel`: Initializes a model with selection.

### IntelliSense
Provides basic IntelliSense features such as auto-completion for keywords, functions, and variables.

### Commands
Adds a custom view in the activity bar with a command to run SLiM scripts:
- **Run SLiM**: Executes the currently open SLiM script using the SLiM interpreter.

### Status Bar Integration
Adds a status bar button to quickly run the SLiM script in the active editor.

## Requirements

- Visual Studio Code version 1.98.0 or higher
- SLiM interpreter installed and accessible in your system's PATH or configured in the extension settings

## Extension Settings

This extension contributes the following settings:

* `slimTools.slimInterpreterPath`: Path to the SLiM interpreter (e.g., `/usr/local/bin/slim` or `C:\\Users\\YourName\\slim.exe`).

## Known Issues

- None at the moment. Please report any issues on the [GitHub repository](https://github.com/your-repo/slim-tools/issues).

## Release Notes

### 1.0.0

Initial release of `slim-tools` with the following features:
- Syntax highlighting for SLiM scripts
- Snippets for common SLiM patterns
- Basic IntelliSense support
- Custom view and command to run SLiM scripts
- Status bar integration


**Enjoy!**

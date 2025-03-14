# slim-vscode-tools README

`slim-vscode-tools` is a Visual Studio Code extension designed to provide comprehensive support for the SLiM simulation package. This extension includes features such as syntax highlighting, snippets, IntelliSense, and commands to enhance the development experience for SLiM scripts.

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

![Syntax Highlighting](./images/syntax_colors.png)

### Hover Information

Will show a tooltip with the function signature and complete documentation for the function for the SLiM manual.

![Hover Information](./images/hover_over_docs.png)

### Auto-completion

Provides auto-completion for SLiM keywords, functions, and variables.
Will show a tooltip with the function signature and description.

![Auto-completion](./images/autocomplete.png)

### Syntax Checking
Provides real-time syntax validation for SLiM scripts:
- Brace matching and block structure validation
- Semicolon checking for statements
- SLiM-specific block structure validation (initialize, early, late, fitness)
- Generation-prefixed block validation (e.g., "1000 late()")
- Function parameter validation
- Smart error reporting with inline diagnostics
- Support for multi-line code blocks

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
Also adds a command to run the SLiM script in Activity Bar.

![Status Bar Integration](./images/run_slim.png)

## Requirements

- Visual Studio Code version 1.98.0 or higher
- SLiM interpreter installed and accessible in your system's PATH or configured in the extension settings

## Installation

Currently this extension is not published to the marketplace, so you will need to install it manually.

There are a few ways to do this:

You can build from source:
1. Clone the repository
2. Run `npm install` to install the dependencies
3. Run `npm run package` to package the extension
4. Install the resulting package with `code --install-extension slim-vscode-tools-0.0.1-beta.vsix` (this assumes you've installed the `vscode` command line tool)

You can use the prepackaged package from the releases:
1. get the latest version from the [GitHub repository](https://github.com/andrewkern/slim-tools/releases)
2. Install the `.vsix` file manually with `code --install-extension slim-vscode-tools-0.0.1-beta.vsix`

Optionally you can install the `.vsix` file from within `vscode` by:
1. Open `vscode`.
2. Go to Extensions View by pressing Ctrl+Shift+X (Windows/Linux) or Cmd+Shift+X (Mac).
3. Click on the More Actions (⋮) menu at the top right of the Extensions panel.
4. Select "Install from VSIX...".
5. Locate and select the .vsix file from your system.
6. Click Install and wait for it to complete.

## Extension Settings

This extension contributes the following settings:

* `slimTools.slimInterpreterPath`: Path to the SLiM interpreter (e.g., `/usr/local/bin/slim` or `C:\\Users\\YourName\\slim.exe`).

## Diagnostic Features

The extension provides real-time diagnostic feedback for:
- Syntax errors (mismatched braces, missing semicolons)
- SLiM-specific block structure issues
- Function parameter validation
- Code style recommendations

Diagnostics are displayed as:
- 🔴 Errors: Critical issues that need to be fixed
- 🟡 Warnings: Potential issues or style recommendations

## Known Issues

- None at the moment. Please report any issues on the [GitHub repository](https://github.com/your-repo/slim-tools/issues).

## Release Notes

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

**Enjoy!**

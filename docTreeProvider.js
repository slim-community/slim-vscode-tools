const vscode = require('vscode');
const path = require('path');

class DocTreeProvider {
  constructor(context) {
    this.context = context;
    this.docsPath = path.join(context.extensionPath, 'docs');
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      // Root: List all JSON files in /doc
      const dirUri = vscode.Uri.file(this.docsPath);
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      const jsonFiles = entries.filter(([name, type]) => name.endsWith('.json'));

    return jsonFiles.map(([name]) => {
      const fileUri = vscode.Uri.file(path.join(this.docsPath, name));

      const prettyLabel = name
        .replace(/_/g, ' ')        // replace underscores with spaces
        .replace(/\.json$/i, '')   // strip .json extension
        .replace(/\b\w/g, c => c.toUpperCase()) // capitalize each word
        .replace(/\bSlim\b/, 'SLiM');

      const item = new vscode.TreeItem(prettyLabel, vscode.TreeItemCollapsibleState.Collapsed);
      item.resourceUri = fileUri;
      item.contextValue = 'docFile';
      return item;
    });
    } else if (element.resourceUri) {
      // Expand a JSON file: parse top-level structure
      const content = await vscode.workspace.fs.readFile(element.resourceUri);
      const json = JSON.parse(content.toString());
      return this._jsonToTreeItems(json);
    } else if (element.jsonChildren) {
      // Nested JSON node
      return element.jsonChildren;
    }

    return [];
  }

_jsonToTreeItems(obj, parentLabel = null) {
  return Object.entries(obj)
    .map(([key, value]) => {
      // 👉 Unified behavior for docLeaf fields
      if (['description', 'signature', 'type'].includes(key) && typeof value === 'string') {
        const parent = obj;
        const item = new vscode.TreeItem(key, vscode.TreeItemCollapsibleState.None);
        item.description = value.length > 60 ? value.slice(0, 57) + '…' : value;
        item.tooltip = new vscode.MarkdownString(`**${key}**\n\n${value}`);
        item.command = {
          command: 'slimTools.showDocSection',
          title: 'Open Doc Section',
          arguments: [parentLabel || 'Untitled', { ...parent }] // ✅ use explicit label
        };
        item.iconPath = new vscode.ThemeIcon(
          key === 'description' ? 'comment' :
          key === 'signature' ? 'symbol-method' :
          'symbol-property'
        );
        item.contextValue = 'docLeaf';
        return item;
      }

      // 👉 Nested object (e.g. method, property, class)
      if (typeof value === 'object' && value !== null) {
        const children = this._jsonToTreeItems(value, key); // ✅ pass label down
        if (children.length === 0) return null; // ✅ skip empty objects

        const item = new vscode.TreeItem(key, vscode.TreeItemCollapsibleState.Collapsed);
        item.jsonChildren = children;

        const isDocLike = 'signature' in value || 'description' in value || 'type' in value;
        if (isDocLike) {
          item.command = {
            command: 'slimTools.showDocSection',
            title: 'Open Doc Section',
            arguments: [key, { ...value }] // ✅ consistent title
          };

          if ('signature' in value) {
            item.iconPath = new vscode.ThemeIcon('symbol-method');
          } else if ('type' in value) {
            item.iconPath = new vscode.ThemeIcon('symbol-property');
          } else {
            item.iconPath = new vscode.ThemeIcon('book');
          }

          item.contextValue = 'docComposite';
        } else {
          item.contextValue = 'docNode';
        }

        return item;
      }

      // 👉 Fallback key-value leaf (rare)
      const item = new vscode.TreeItem(key, vscode.TreeItemCollapsibleState.None);
      item.description = String(value).length > 60 ? String(value).slice(0, 57) + '…' : String(value);
      item.tooltip = new vscode.MarkdownString(`**${key}**\n\n${value}`);
      item.command = {
        command: 'slimTools.showDocSection',
        title: 'Open Doc Section',
        arguments: [key, value]
      };
      item.iconPath = new vscode.ThemeIcon('book');
      item.contextValue = 'docLeaf';
      return item;
    })
    .filter(item => item !== null);
}





}

module.exports = { DocTreeProvider };

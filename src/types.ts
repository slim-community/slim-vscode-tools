import * as vscode from 'vscode';

export interface DocSection {
    description?: string;
    signature?: string;         // singular - used in classes/callbacks
    signatures?: string[];      // plural - used in functions
    type?: string;             // used in class properties
    
    // For nested class structures
    constructor?: DocSection | {};
    methods?: { [key: string]: DocSection };
    properties?: { [key: string]: DocSection };
    
    // Allow other arbitrary nested properties
    [key: string]: any;
}

export interface MethodInfo {
    signature: string;
    description: string;
}

export interface PropertyInfo {
    type: string;
    description: string;
}

export interface ClassInfo {
    constructor: {
        signature?: string;
        description?: string;
    };
    methods: { [key: string]: MethodInfo };
    properties: { [key: string]: PropertyInfo };
}

export interface DocTreeItem extends vscode.TreeItem {
    resourceUri?: vscode.Uri;
    jsonChildren?: DocTreeItem[];
}
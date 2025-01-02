// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "makedynsql" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand('makedynsql.helloWorld', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World from MakeDynamicSQL!');
    });

    context.subscriptions.push(disposable);

    const makeDynamic = vscode.commands.registerCommand('makedynsql.makeDynamic', async () => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showInformationMessage("No active editor found.");
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text) {
            vscode.window.showInformationMessage("No text selected.");
            return;
        }

        // Step 1: Parse the declare block to extract variables and their values
        const declareRegex = /declare\s+([\s\S]+?)\s*(?=\bgo\b|$)/i; // Regex for capturing declare block
        const match = declareRegex.exec(text);
        if (!match) {
            vscode.window.showErrorMessage("No declare block found.");
            return;
        }

        const declareBlock = match[1].trim();
        const variableRegex = /(@\w+)\s+nvarchar\(max\)\s*=\s*'([^']+)'/gi;

        const variables: { name: string; value: string; coreValue: string }[] = [];
        let variableMatch;
        while ((variableMatch = variableRegex.exec(declareBlock)) !== null) {
            const [_, name, value] = variableMatch;
            const coreValue = extractCoreValue(value); // Helper to extract the core value (right-hand side)
            variables.push({ name, value, coreValue });
        }

        // Step 2: Escape single quotes in the SQL (excluding the variable injections)
        let updatedSQL = text.replace(declareRegex, ''); // Remove the original declare block

        // Escape single quotes in SQL string literals
        updatedSQL = updatedSQL.replace(/'([^']+)'/g, "''$1''");

        // Step 3: Replace variables with their placeholders in the SQL
        variables.forEach(({ name }) => {
            const replacement = `' + ${name} + '`; // Correct concatenation format
            const regex = new RegExp(escapeRegex(name), 'g'); // Replace variables in the SQL script
            updatedSQL = updatedSQL.replace(regex, replacement);
        });

        // Step 4: Rebuild the declare block with only the right-hand side (core values)
        const newDeclareBlock = `declare ${variables
            .map(({ name, coreValue }) => `${name} nvarchar(max) = '${coreValue}'`)
            .join(',\n        ')}\n`;

        // Step 5: Wrap the SQL in @dynsql and handle the dynamic SQL
        let dynamicSQL = `declare @dynsql nvarchar(max) = '`;

        // Add the SQL script, which already has single quotes escaped
        dynamicSQL += updatedSQL;

        // Add closing single quote and exec statement
        dynamicSQL += `'\nexec(@dynsql)`;

        // Step 6: Replace the editor content with the new declare block and dynamic SQL
        editor.edit((editBuilder) => {
            editBuilder.replace(selection, newDeclareBlock + dynamicSQL.trim());
        });
    });

    context.subscriptions.push(makeDynamic);
}
function extractCoreValue(value: string): string {
    // Logic to extract core value from RHS of the declaration
    const match = /=\s*(.+)$/i.exec(value);
    return match ? match[1].trim() : value; // If no match, return the original value
}

function escapeRegex(text: string): string {
    // Escape special characters for regex
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// This method is called when your extension is deactivated
export function deactivate() { }

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const makeDynamic = vscode.commands.registerCommand('makedynsql.makeDynamic', async () => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showInformationMessage("No active editor found.");
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text) {
            vscode.window.showInformationMessage("No text selected...");
            return;
        }

        // Get the default data type from settings or fallback to "nvarchar(max)"
        const config = vscode.workspace.getConfiguration("makedynsql");
        const DEFAULT_DATA_TYPE = config.get<string>("defaultDataType", "nvarchar(max)");

        // Step 1: Parse the declare block
        const declareRegex = /declare\s+([\s\S]+?)\s*(?=\bgo\b|$)/i; // Regex for capturing declare block
        const match = declareRegex.exec(text);
        if (!match) {
            vscode.window.showErrorMessage("No declare block found.");
            return;
        }

        const declareBlock = match[1].trim();
        const variableRegex = /(@\w+)\s*\w*\(.*?\)\s*=\s*'(.*)'/gi;

        const variables: { name: string; originalRHS: string; lhs: string; rhs: string; has_quotes: boolean }[] = [];
        let variableMatch;
        while ((variableMatch = variableRegex.exec(declareBlock)) !== null) {
            const [_, name, originalRHS] = variableMatch;

            let lhs = '';
            let rhs = originalRHS;

            // If there's an equal sign in the RHS, split into LHS and RHS
            const equalsMatch = /(.*?)=(.*)/.exec(originalRHS);
            if (equalsMatch) {
                lhs = equalsMatch[1].trim(); // Extract LHS
                rhs = equalsMatch[2].trim(); // Extract RHS
            }

            let has_quotes = rhs.includes("'");

            // Normalize improperly escaped quotes (single quotes that aren't doubled)
            const cleanedRHS = rhs.replace(/''/g, "'").replace(/'/g, "''");

            variables.push({ name, originalRHS, lhs, rhs: cleanedRHS, has_quotes });
        }

        // Step 2: Escape single quotes in the SQL script before variable replacement
        let updatedSQL = text.replace(declareRegex, ''); // Remove the original declare block
        updatedSQL = updatedSQL.replace(/'/g, "''");

        // Step 3: Replace the variables with their placeholders in the SQL script
        variables.forEach(({ name, originalRHS, lhs, rhs, has_quotes }) => {
            let doubleQuotes = "";
            if (has_quotes) {
                doubleQuotes = "''";
            }
            const replacement = lhs
                ? `${lhs} = ${doubleQuotes}' + ${name} + N'${doubleQuotes}` // Add LHS = ' + @variable + '
                : `${doubleQuotes}' + ${name} + N'${doubleQuotes}`; // For variables without an LHS
            const regex = new RegExp(escapeRegex(originalRHS), 'g');
            updatedSQL = updatedSQL.replace(regex, replacement);
        });

        // Step 4: Rebuild the declare block with right-hand values only
        const newDeclareBlock = `declare ${variables
            .map(({ name, rhs, has_quotes }) => {
                // Remove '' at the start and end, replace with single quotes if has_quotes is true
                if (has_quotes) {
                    rhs = rhs.replace(/^''(.*)''$/, "'$1'"); // Replaces outer '' with single quotes
                }
                return `${name} ${DEFAULT_DATA_TYPE} = '${rhs}'`;
            })
            .join(',\n        ')}\n`;

        // Step 5: Wrap the SQL in @dynsql and handle dynamic SQL
        let dynamicSQL = `declare @dynsql ${DEFAULT_DATA_TYPE} = N'\n`;
        dynamicSQL += updatedSQL;
        dynamicSQL += `'\nexec(@dynsql)`;

        // Step 6: Replace the editor content
        editor.edit((editBuilder) => {
            editBuilder.replace(selection, newDeclareBlock + '\n\n' + dynamicSQL.trim());
        });
    });

    context.subscriptions.push(makeDynamic);

    const unJoinLines = vscode.commands.registerCommand('makedynsql.unJoinLines', async () => {
    })
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

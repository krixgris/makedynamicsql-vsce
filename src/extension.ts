// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const makeDynamic = vscode.commands.registerCommand('makedynsql.makeDynamic', async (args) => {
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

        // Escape quotes and start building new SQL block
        // TODO: Remove initial go block if there is one
        let updatedSQL = text.replace(declareRegex, ''); // Remove the original declare block
        updatedSQL = updatedSQL.replace(/'/g, "''");

        // Replace variables from top declare
        variables.forEach(({ name, originalRHS, lhs, has_quotes }) => {
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

        // Rebuild the declare block with right-hand values only
        const newDeclareBlock = `declare ${variables
            .map(({ name, rhs, has_quotes }) => {
                // Remove '' at the start and end, replace with single quotes if has_quotes is true
                if (has_quotes) {
                    rhs = rhs.replace(/^''(.*)''$/, "'$1'"); // Replaces outer '' with single quotes
                }
                return `${name} ${DEFAULT_DATA_TYPE} = '${rhs}'`;
            })
            .join(',\n        ')}\n`;

        // Wrap the SQL in @dynsql and handle dynamic SQL
        let dynamicSQL = `declare @dynsql ${DEFAULT_DATA_TYPE} = N'\n`;
        dynamicSQL += updatedSQL;
        dynamicSQL += `'\nexec(@dynsql)`;

        // Replace the editor content
        editor.edit((editBuilder) => {
            editBuilder.replace(selection, newDeclareBlock + '\n\n' + dynamicSQL.trim());
        });
    });

    context.subscriptions.push(makeDynamic);

    const unJoinLines = vscode.commands.registerCommand('makedynsql.unJoinLines', async (args) => {
        // s/^\(\s*\)\(.*\),\([^,]*\)$/\1\2\r\1,\3/
        // Implement above vim substitution to a vscode plugin
        // replace last comma (or read from settings which delimiter) with a new line + delimiter
        // place the delimiter either before or after new line depending on setting
        // after replacement, move cursor one line up so the command can be repeated
        //
        // only perform the replacement if a comma is found, otherwise do nothing
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            // Read arguments
            const delimiter = args?.delimiter ?? ","; // Default delimiter
            const delimiterNewline = args?.delimiterNewline ?? false; // Whether to put delimiter on newline
            const padding = args?.padding ?? false; // Only match delimiters surrounded by spaces
            const ignoreParentheses = args?.ignoreParentheses ?? true; // Ignore delimiters inside parentheses by default
            const rePadDelimiter = args?.reapplyPadding ?? false; // Add padding when reinserting. I.e. space after and 
            const isCaseSensitive = args?.caseSensitive ?? false;

            const delimiterLength = delimiter.length;
            const rePadSpace = rePadDelimiter ? " " : "";

            const document = editor.document;
            const position = editor.selection.active; // Cursor position
            const line = document.lineAt(position.line); // Current line
            let lineText = line.text;

            if (ignoreParentheses) {
                lineText = lineText.replace(/\([^)]*\)/g, (match) => {
                    return " ".repeat(match.length); // Replace with spaces to preserve line length
                });
            }

            const regexSettings = isCaseSensitive ? "g" : "gi";

            const delimiterRegex = padding
                ? new RegExp(`\\s${delimiter}\\s`, regexSettings) // Match " delimiter " (surrounded by spaces)
                : new RegExp(delimiter, regexSettings); // Match the delimiter anywhere

            const delimiterCount = (lineText.match(delimiterRegex) || []).length;
            const firstWord = lineText.trimStart().substring(0, delimiterLength);
            if (
                delimiterCount === 0 ||
                (delimiterCount === 1 && firstWord === delimiter)
            ) {
                vscode.window.showInformationMessage("Line does not meet delimiter replacement criteria.");
                return;
            }

            // Find the last delimiter and split the line
            const lastDelimiterIndex = isCaseSensitive ?
                lineText.lastIndexOf(delimiter) :
                lineText.toLowerCase().lastIndexOf(delimiter.toLowerCase());
            const originalLineText = line.text;
            const beforeDelimiterRaw = originalLineText.substring(0, lastDelimiterIndex);
            const afterDelimiterRaw = originalLineText.substring(lastDelimiterIndex + delimiterLength).trim();

            // Add delimiter to either the new line or keep it on the current line
            const beforeDelimiter = delimiterNewline
                ? `${beforeDelimiterRaw}${rePadSpace}${delimiter.trimEnd()}`
                : beforeDelimiterRaw;
            const afterDelimiter = delimiterNewline
                ? afterDelimiterRaw
                : `${delimiter.trimEnd()}${rePadSpace}${afterDelimiterRaw}`

            const indentation = lineText.match(/^\s*/)?.[0] || "";

            editor.edit(editBuilder => {
                const newText = `${beforeDelimiter}\n${indentation}${afterDelimiter}`;
                editBuilder.replace(line.range, newText);
            }).then(() => {
                const newPosition = new vscode.Position(position.line, beforeDelimiter.length);
                editor.selection = new vscode.Selection(newPosition, newPosition);
            });
        };
    });

    vscode.commands.registerCommand('makedynsql.unJoinLinesComma', () => {
        vscode.commands.executeCommand('makedynsql.unJoinLines', { delimiter: "," });
    });

    vscode.commands.registerCommand('makedynsql.unJoinLinesAnd', () => {
        vscode.commands.executeCommand('makedynsql.unJoinLines', { delimiter: "and", padding: true, reapplyPadding: true });
    });
    vscode.commands.registerCommand('makedynsql.unJoinLinesOr', () => {
        vscode.commands.executeCommand('makedynsql.unJoinLines', { delimiter: "or", padding: true, reapplyPadding: true });
    });

    context.subscriptions.push(unJoinLines);
}

function escapeRegex(text: string): string {
    // Escape special characters for regex
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// This method is called when your extension is deactivated
export function deactivate() { }

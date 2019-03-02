
import * as vscode from 'vscode';
export class AddMissingCaseProvider implements vscode.CodeActionProvider {
	public provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
		return context.diagnostics
			.filter((d) => d.message.startsWith("Missing cases"))
			.map((d) => ({
				title: "Add missing cases",
				command: "keli.addMissingCases",
				arguments: [document, d.range, d.message]
			}));
	}
}

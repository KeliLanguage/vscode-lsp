/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';
import { AddMissingCaseProvider } from './AddMissingCaseProvider';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
	// register code action provider
	const provider = new AddMissingCaseProvider();
	vscode.languages.registerCodeActionsProvider("keli", provider);

	// create a run keli program button
	const myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	context.subscriptions.push(myStatusBarItem);
	myStatusBarItem.command = "keli.runThisFile";
	myStatusBarItem.text = "▶ Run this Keli program ◀";
	myStatusBarItem.show();

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'keli' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'keliLanguageServer',
		'Keli Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	// register command: runThisFile
	context.subscriptions.push(vscode.commands.registerCommand("keli.runThisFile", () => {
		const currentContents = vscode.window.activeTextEditor.document.getText();

		// Clear the output
		// Why not just clear by using displayOutputs([]) ?
		//	because that will causes the decoration to be gone and will caused the code to be move towards left
		//  so, instead of making them gone, we just convert the output into dots
		//	so that there will be no bouncy animation (which is distracting)
		displayOutputs(previousOutputs.map(x =>
			({ ...x, output: Array.from({length: x.output.length}).map(x => "").join(".") + "." })));

		client.sendNotification("keli/runThisFile", currentContents);
	}));

	// register command: addMissingCases
	context.subscriptions.push(vscode.commands
		.registerCommand("keli.addMissingCases", (doc, range: vscode.Range, message: string) => {
			const insertPosition = new vscode.Position(range.end.line, range.end.character + 1);
		const edit = new vscode.WorkspaceEdit();
		const missingCases = "\n\t" + message
			.split("\n").slice(1)
			.map((x) => `case(${x.trim()}):\n\t\t(undefined)`)
			.join("\n\t");
		edit.insert(doc.uri, insertPosition, missingCases);
		vscode.workspace.applyEdit(edit);
	}));

	// setup on notification hook
	client.onReady().then(() => {
		client.onNotification("keli/runThisFileCompleted", (outputs) => {
			try {
				const parsedOutputs = JSON.parse(outputs);
				previousOutputs = parsedOutputs;
				displayOutputs(parsedOutputs);
			} catch (error) {
				vscode.window.showErrorMessage(error.toString());
			}
		});

		client.onNotification("keli/runThisFileFailed", (error) => {
			vscode.window.showErrorMessage(error);
		});
	});


}

// this variable is for the runThisFile command
var previousOutputs: Output[] = [];

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}


const decoType = vscode.window.createTextEditorDecorationType({
	borderWidth: "6px",
	borderColor: "blue",
	after: {
		margin: "1em",
		
	},
});

interface Output {
	output: string;
	lineNumber: number;
}
/**
 * This function will display the given outputs at the beginning of each corresponding line number
 *
 * @export
 * @param {{ output: string, lineNumber: number }[]} outputs
 */
export function displayOutputs(outputs: Output[]) {
	const activeEditor = vscode.window.activeTextEditor;
	const decorations = outputs.map(({ output, lineNumber }) => {
		lineNumber--; // need to minus one, because VSCode internal line numbers starts from zero, not one
		const startPos = new vscode.Position(lineNumber, 0);
		const endPos = new vscode.Position(lineNumber, 0);
		const decoration: vscode.DecorationOptions = {
			range: new vscode.Range(startPos, endPos),
			hoverMessage: output,
			renderOptions: {
				after: {
					contentText: output,
					fontStyle: "italic",
					color: "darkgray",
				}
			}
			
		};
		return decoration;
	});
	activeEditor.setDecorations(decoType, decorations);
}
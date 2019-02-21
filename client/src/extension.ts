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

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
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

	// register commands
	context.subscriptions.push(vscode.commands.registerCommand("keli.runThisFile", () => {
		const currentContents = vscode.window.activeTextEditor.document.getText();
		client.sendNotification("keli/runThisFile", currentContents);
	}));

	client.onReady().then(() => {
		client.onNotification("keli/runThisFileCompleted", (outputs) => {
			try {
				displayOutputs(JSON.parse(outputs));
			} catch (error) {
				vscode.window.showErrorMessage(error.toString());
			}
		});

		client.onNotification("keli/runThisFileFailed", (error) => {
			vscode.window.showErrorMessage(error);
		});
	});
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}


const decoType = vscode.window.createTextEditorDecorationType({
	borderWidth: "6px 0px 0px 0px",
	borderColor: "blue",
	after: {
		margin: "2em",
		
	},
});

export function displayOutputs(outputs: { output: string, lineNumber: number }[]) {
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
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextEdit,
	InsertTextFormat
} from 'vscode-languageserver';
import { KeliService, File } from './keliService';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;


connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
	hasDiagnosticRelatedInformationCapability =
		!!(capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation);

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ["."]
			}
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});


// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

documents.onDidSave((e) => {
	validateTextDocument(e.document);
});

async function validateTextDocument(doc: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(doc.uri);
	const file: File = { uri: doc.uri, contents: doc.getText() };
	KeliService.analyze(file).then((diagnostics) => {
		// connection.window.showInformationMessage(diagnostics.toString());
		connection.sendDiagnostics({ uri: doc.uri, diagnostics });
	});
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	async (_textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		const keywords:CompletionItem[] = [
			{
				label: "choice.",
				detail: "Declare a tagged union.",
				kind: CompletionItemKind.Keyword,
				insertText: "tags.\n\tcase($1)",
				insertTextFormat: InsertTextFormat.Snippet,
			},
			{
				label: "$",
				detail: "This keyword is use for declaring object types or object expression.",
				kind: CompletionItemKind.Keyword
			},
			{
				label: "module.import()",
				insertText: "module.import(\"$1\")",
				insertTextFormat: InsertTextFormat.Snippet,
				detail: "This keyword is use for importing module",
				kind: CompletionItemKind.Keyword
			}
		];

		const position = _textDocumentPosition.position;
		const fileContents = documents.get(_textDocumentPosition.textDocument.uri).getText();
		const miscSuggestions = 
				[...new Set(fileContents .match(/[\w\d\’\'-]+/gi))] // Set is for removing duplicates
				.map((x) => ({ label: x, kind: CompletionItemKind.Text }));
		try {
			const file: File = { uri: _textDocumentPosition.textDocument.uri, contents: fileContents };
			const otherItems = await KeliService.getCompletionItems(file, { ...position, character: position.character - 1 });
			// connection.window.showInformationMessage(otherItems.length.toString());
			if (otherItems.some((x) =>
				x.kind === CompletionItemKind.Function
				|| x.kind === CompletionItemKind.Method
				|| x.kind === CompletionItemKind.Enum
				|| x.kind === CompletionItemKind.Constructor
				|| x.kind === CompletionItemKind.Property)) {
				return otherItems;
			} else {
				return otherItems.concat(keywords).concat(miscSuggestions);
			}
		} catch (error) {
			return keywords.concat(miscSuggestions);
		}
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			(item.detail = 'TypeScript details'),
				(item.documentation = 'TypeScript documentation');
		} else if (item.data === 2) {
			(item.detail = 'JavaScript details'),
				(item.documentation = 'JavaScript documentation');
		}
		return item;
	}
);

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

connection.onNotification("keli/runThisFile", async (file: File) => {
	try {
		const result = await KeliService.execute(file);
		connection.sendNotification("keli/runThisFileCompleted", JSON.stringify(result));
	} catch (error) {
		connection.window.showInformationMessage(error);
		connection.sendNotification("keli/runThisFileFailed", error.toString());
	}
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
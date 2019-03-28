import { Diagnostic, CompletionItem, Position } from 'vscode-languageserver';

export interface File {
	uri: string;
	contents: string;
}

export class KeliService {
	private static KELI_COMPILER_PATH = "keli";
	public static analyze(file: File): Promise<Diagnostic[]> {
		return this.runCommand(file, "analyze", [])
			.then((result) => JSON.parse(result).map((x) => ({...x, message: x.message.trim(), source: "[keli]"})));
	}

	public static getCompletionItems(file: File, position: Position): Promise<CompletionItem[]> {
		return this.runCommand(file, "suggest", [
			position.line.toString(),
			position.character.toString()
		])
			.then(JSON.parse)
			.then((xs: CompletionItem[]) =>
				xs
				// Remove all those competion items that are prefixed with underscore (as they are private functions)
				.filter(x => !x.label.startsWith("_"))
				.map(x => {
					x.documentation = { kind: "markdown", value: x.documentation as string };
					return x;
				}));
	}

	public static execute(file: File): Promise<{ output: string, lineNumber: number }[]> {
		return this.runCommand(file, "run", ["--show-line-number"])
			.then((result: string) => {
				return result.split("\n")
					.filter((x) => x.length > 0)
					.map((x) => {
						const tokens = x.slice(5).split("=");
						return {
							lineNumber: parseInt(tokens[0].trim()),
							output: tokens[1].trimLeft(),
						};
					});
			});
	}

	private static runCommand(
		file: File,
		command: string,
		extraArgs : string[]): Promise<any> {
		const { spawn } = require('child_process');
		const fs = require("fs"); 
		const path = require("path");
		const fileParentDir = path.basename(path.dirname(file.uri));
		const tempFilename = fileParentDir + "/__temp__.keli";
		return new Promise((resolve, reject) => {
			fs.writeFile(tempFilename, file.contents, (err) => {
				const process = spawn(KeliService.KELI_COMPILER_PATH, [command, tempFilename].concat(extraArgs));
				process.stdout.on('data', (data) => {
					try {
						resolve(data.toString());
					} catch (error) {
						reject(error);
					}
				});
				process.stderr.on('data', (data) => {
					reject(data);
					console.log("Error encountered when analyzing Keli: " + data.toString());
				});
			});
		});
	}
}

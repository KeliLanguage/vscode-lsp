import { Diagnostic, CompletionItem, Position } from 'vscode-languageserver';

export class KeliService {
	private static KELI_COMPILER_PATH = "/home/hou32hou/Repos/keli/compiler/.stack-work/install/x86_64-linux/lts-13.0/8.6.3/bin/keli-compiler-exe";
	public static analyze(fileContents: string): Promise<Diagnostic[]> {
		return this.runCommand(fileContents, "--analyze", [])
			.then((result) => result.map((x) => ({...x, message: x.message.trim(), source: "[keli]"})));
	}

	public static getCompletionItems(fileContents:string, position: Position): Promise<CompletionItem[]> {
		return this.runCommand(fileContents, "--suggest", [
			"--line", position.line.toString(),
			"--column", position.character.toString()
		]);
	}

	private static runCommand(
		fileContents: string,
		commandOptions: string,
		extraArgs : string[]): Promise<any> {
		const { spawn } = require('child_process');
		const fs = require("fs"); 
		return new Promise((resolve, reject) => {
			fs.writeFile("__temp__.keli", fileContents, (err) => {
				const command = spawn(KeliService.KELI_COMPILER_PATH, [commandOptions, "__temp__.keli"].concat(extraArgs));
				command.stdout.on('data', (data) => {
					try {
						resolve(JSON.parse(data.toString()));
					} catch (error) {
						reject(error);
					}
				});
				command.stderr.on('data', (data) => {
					reject(data);
					console.log("Error encountered when analyzing Keli: " + data.toString());
				});
			});
		});
	}
}

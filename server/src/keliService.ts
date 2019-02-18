import { Diagnostic, CompletionItem } from 'vscode-languageserver';

export class KeliService {
	private static KELI_COMPILER_PATH = "/home/hou32hou/Repos/keli/compiler/.stack-work/install/x86_64-linux/lts-13.0/8.6.3/bin/keli-compiler-exe";
	public static analyze(fileContents: string): Promise<Diagnostic[]> {
		return this.runCommand(fileContents, "--analyze")
			.then((result) => result.map((x) => ({...x, message: x.message.trim(), source: "[keli]"})));
	}

	public static getCompletionItems(): Promise<CompletionItem[]> {
		return this.runCommand(null, "--suggest");
	}

	private static runCommand(fileContents: string | null, commandOptions: string): Promise<any> {
		const { spawn } = require('child_process');
		const fs = require("fs"); 
		return new Promise((resolve, reject) => {
			function continueCommand() {
				const command = spawn(KeliService.KELI_COMPILER_PATH, [commandOptions, "__temp__.keli"]);
				command.stdout.on('data', (data) => {
					try {
						resolve(JSON.parse(data.toString()));
					} catch (error) {
						return error;
					}
				});
				command.stderr.on('data', (data) => {
					console.log("Error encountered when analyzing Keli: " + data.toString());
				});
			}
			if(fileContents === null) {
				continueCommand();
			} else {
				fs.writeFile("__temp__.keli", fileContents, (err) => {
					continueCommand();
				});
			}
		});

	}
}

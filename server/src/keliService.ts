import { Diagnostic } from 'vscode-languageserver';

export class KeliService {
	private static KELI_COMPILER_PATH = "/home/hou32hou/Repos/keli/compiler/.stack-work/install/x86_64-linux/lts-13.0/8.6.3/bin/keli-compiler-exe";
	public static analyze(contents: string): Promise<Diagnostic[]> {
		const { spawn } = require('child_process');
		const fs = require("fs"); 
		return new Promise((resolve, reject) => {
			fs.writeFile("__temp__.keli", contents, (err) => {
				const command = spawn(this.KELI_COMPILER_PATH, ['--analyze', "__temp__.keli"]);
				command.stdout.on('data', (data) => {
					try {
						const result: Diagnostic[] = JSON.parse(JSON.parse(data.toString()));
						resolve(result.map((x) => ({...x, message: x.message.trim(), source: "keli"})));
					} catch (error) {
						return error;
					}
				});
				command.stderr.on('data', (data) => {
					console.log("Error encountered when analyzing Keli: " + data.toString());
				});
			});
		});
	}
}
import { Diagnostic } from 'vscode-languageserver';

export class KeliService {
	private static KELI_COMPILER_PATH = "/home/hou32hou/Repos/keli/compiler/.stack-work/install/x86_64-linux/lts-13.0/8.6.3/bin/keli-compiler-exe";
	public static analyze(contents: string): Diagnostic[] {
		const { spawnSync } = require('child_process');
		const fs = require("fs");
		fs.writeFileSync("__temp__.keli", contents);
		const commandOutput = spawnSync(this.KELI_COMPILER_PATH, ['--analyze', "__temp__.keli"]);
		try {
			const result: Diagnostic[] = JSON.parse(JSON.parse(commandOutput.output.slice(1, -1)));
			return result.map((x) => ({...x, message: x.message.trim(), source: "keli"}));
		} catch (error) {
			return error;
		}
	}
}
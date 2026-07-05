import { colors } from './colors.js';

export class TerminalOutput {
	static header(label: string): string {
		return colors.header(`\n=== ${label} ===`);
	}

	static json(obj: unknown): string {
		return colors.json(JSON.stringify(obj, null, 2));
	}
}

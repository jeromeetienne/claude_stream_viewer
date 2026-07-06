import { colors } from './colors.js';

/** Builds the colorized string primitives shared by the log and stats renderers. */
export class TerminalOutput {
	/** Returns a colorized `=== LABEL ===` section header, preceded by a blank line. */
	static header(label: string): string {
		return colors.header(`\n=== ${label} ===`);
	}

	/** Returns a dimmed, pretty-printed (2-space) JSON rendering of `obj`. */
	static json(obj: unknown): string {
		return colors.json(JSON.stringify(obj, null, 2));
	}
}

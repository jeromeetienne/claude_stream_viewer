import { colors } from '../libs/colors.js';
import type { ToolInput } from '../types/claude_event.js';

/**
 * Renders a `tool_use` block's input into compact, human-readable lines — one
 * dedicated formatter per known tool (Bash, Read, Grep, …).
 */
export class ToolInputFormatter {
	/**
	 * Formats a tool's input into display lines, dispatched by tool name.
	 * Unrecognized tools fall back to a pretty-printed JSON dump.
	 *
	 * @param name  Tool name from the `tool_use` block.
	 * @param input Raw tool input object.
	 * @returns Colorized lines to print beneath the tool header.
	 */
	static format(name: string, input: ToolInput): string[] {
		if (name === 'Bash') return ToolInputFormatter.formatBashInput(input);
		if (name === 'Read') return ToolInputFormatter.formatReadInput(input);
		if (name === 'Write') return ToolInputFormatter.formatWriteInput(input);
		if (name === 'Edit') return ToolInputFormatter.formatEditInput(input);
		if (name === 'Grep') return ToolInputFormatter.formatGrepInput(input);
		if (name === 'Glob') return ToolInputFormatter.formatGlobInput(input);
		if (name === 'TodoWrite') return ToolInputFormatter.formatTodoWriteInput(input);
		if (name === 'WebFetch') return ToolInputFormatter.formatWebFetchInput(input);
		if (name === 'WebSearch') return ToolInputFormatter.formatWebSearchInput(input);
		if (name === 'Task' || name === 'Agent') return ToolInputFormatter.formatTaskInput(input);
		return ToolInputFormatter.formatFallbackInput(input);
	}

	private static formatBashInput(input: ToolInput): string[] {
		const command = ToolInputFormatter.readString(input, 'command') ?? '';
		const description = ToolInputFormatter.readString(input, 'description');
		const lines: string[] = [];
		const cmdLines = command.split('\n');
		lines.push(colors.text(`$ ${cmdLines[0] ?? ''}`));
		for (let i = 1; i < cmdLines.length; i++) {
			lines.push(colors.text(cmdLines[i]));
		}
		if (description !== undefined) {
			lines.push(colors.system(`# ${description}`));
		}
		return lines;
	}

	private static formatReadInput(input: ToolInput): string[] {
		const filePath = ToolInputFormatter.readString(input, 'file_path') ?? '';
		const offset = ToolInputFormatter.readNumber(input, 'offset');
		const limit = ToolInputFormatter.readNumber(input, 'limit');
		let suffix = '';
		if (offset !== undefined && limit !== undefined) {
			suffix = `:${offset}-${offset + limit - 1}`;
		} else if (offset !== undefined) {
			suffix = `:${offset}+`;
		}
		return [colors.text(`${filePath}${suffix}`)];
	}

	private static formatWriteInput(input: ToolInput): string[] {
		const filePath = ToolInputFormatter.readString(input, 'file_path') ?? '';
		return [colors.text(filePath)];
	}

	private static formatEditInput(input: ToolInput): string[] {
		const filePath = ToolInputFormatter.readString(input, 'file_path') ?? '';
		const lines = [colors.text(filePath)];
		if (ToolInputFormatter.readBoolean(input, 'replace_all') === true) {
			lines.push(colors.system('replace_all=true'));
		}
		return lines;
	}

	private static formatGrepInput(input: ToolInput): string[] {
		const pattern = ToolInputFormatter.readString(input, 'pattern') ?? '';
		const path = ToolInputFormatter.readString(input, 'path');
		const head = path !== undefined ? `"${pattern}" in ${path}` : `"${pattern}"`;
		const flags: string[] = [];
		const outputMode = ToolInputFormatter.readString(input, 'output_mode');
		if (outputMode !== undefined) flags.push(`output_mode=${outputMode}`);
		if (ToolInputFormatter.readBoolean(input, '-n') === true) flags.push('-n');
		if (ToolInputFormatter.readBoolean(input, '-i') === true) flags.push('-i');
		const headLimit = ToolInputFormatter.readNumber(input, 'head_limit');
		if (headLimit !== undefined) flags.push(`head_limit=${headLimit}`);
		const glob = ToolInputFormatter.readString(input, 'glob');
		if (glob !== undefined) flags.push(`glob=${glob}`);
		const fileType = ToolInputFormatter.readString(input, 'type');
		if (fileType !== undefined) flags.push(`type=${fileType}`);
		if (flags.length === 0) {
			return [colors.text(head)];
		}
		return [`${colors.text(head)} ${colors.system(`(${flags.join(', ')})`)}`];
	}

	private static formatGlobInput(input: ToolInput): string[] {
		const pattern = ToolInputFormatter.readString(input, 'pattern') ?? '';
		const path = ToolInputFormatter.readString(input, 'path');
		const text = path !== undefined ? `${pattern} in ${path}` : pattern;
		return [colors.text(text)];
	}

	private static formatTodoWriteInput(input: ToolInput): string[] {
		const todos = input['todos'];
		if (Array.isArray(todos) === false) {
			return [colors.system('(no todos)')];
		}
		return todos.map((todo) => {
			if (typeof todo !== 'object' || todo === null) {
				return colors.text(String(todo));
			}
			const t = todo as Record<string, unknown>;
			const status = typeof t['status'] === 'string' ? t['status'] : '?';
			const content = typeof t['content'] === 'string' ? t['content'] : '';
			let mark = '?';
			if (status === 'pending') mark = ' ';
			else if (status === 'in_progress') mark = '~';
			else if (status === 'completed') mark = 'x';
			return colors.text(`[${mark}] ${content}`);
		});
	}

	private static formatWebFetchInput(input: ToolInput): string[] {
		const url = ToolInputFormatter.readString(input, 'url') ?? '';
		const prompt = ToolInputFormatter.readString(input, 'prompt');
		const lines = [colors.text(url)];
		if (prompt !== undefined) {
			lines.push(colors.system(`prompt: ${prompt}`));
		}
		return lines;
	}

	private static formatWebSearchInput(input: ToolInput): string[] {
		const query = ToolInputFormatter.readString(input, 'query') ?? '';
		const flags: string[] = [];
		const allowed = input['allowed_domains'];
		if (Array.isArray(allowed) && allowed.length > 0) {
			flags.push(`allowed_domains=[${allowed.map((d) => String(d)).join(', ')}]`);
		}
		const blocked = input['blocked_domains'];
		if (Array.isArray(blocked) && blocked.length > 0) {
			flags.push(`blocked_domains=[${blocked.map((d) => String(d)).join(', ')}]`);
		}
		const head = colors.text(`"${query}"`);
		if (flags.length === 0) return [head];
		return [`${head} ${colors.system(`(${flags.join(', ')})`)}`];
	}

	private static formatTaskInput(input: ToolInput): string[] {
		const description = ToolInputFormatter.readString(input, 'description') ?? '';
		const subagentType = ToolInputFormatter.readString(input, 'subagent_type') ?? 'agent';
		const prompt = ToolInputFormatter.readString(input, 'prompt');
		const lines = [colors.text(`[${subagentType}] ${description}`)];
		if (prompt !== undefined) {
			const PROMPT_PREVIEW_LIMIT = 200;
			if (prompt.length <= PROMPT_PREVIEW_LIMIT) {
				lines.push(colors.system(`prompt: ${prompt}`));
			} else {
				const head = prompt.slice(0, PROMPT_PREVIEW_LIMIT);
				lines.push(colors.system(`prompt: ${head}… (${prompt.length} chars)`));
			}
		}
		return lines;
	}

	private static formatFallbackInput(input: ToolInput): string[] {
		const json = JSON.stringify(input, null, 2);
		return json.split('\n').map((line) => colors.json(line));
	}

	private static readString(input: ToolInput, key: string): string | undefined {
		const value = input[key];
		return typeof value === 'string' ? value : undefined;
	}

	private static readNumber(input: ToolInput, key: string): number | undefined {
		const value = input[key];
		return typeof value === 'number' ? value : undefined;
	}

	private static readBoolean(input: ToolInput, key: string): boolean | undefined {
		const value = input[key];
		return typeof value === 'boolean' ? value : undefined;
	}
}

import { colors } from '../libs/colors.js';
import { TerminalOutput } from '../libs/terminal_output.js';
import { ToolInputFormatter } from './tool_input_formatter.js';
import type { ClaudeEvent, ContentBlock, ToolInput } from '../types/claude_event.js';

const MAX_TOOL_RESULT_LINES = 40;

export class LogRenderer {
	private toolNamesById = new Map<string, string>();

	render(event: ClaudeEvent) {
		const type = event.type;
		if (type === 'stream_event') return;
		if (type === 'system') return this.renderSystem(event);
		if (type === 'assistant') return this.renderAssistant(event);
		if (type === 'user') return this.renderUser(event);
		if (type === 'rate_limit_event') return this.renderRateLimit(event);
		if (type === 'result') return this.renderResult(event);
		this.printHeader(`${type ?? 'unknown'}`);
		this.printJSON(event);
	}

	private printHeader(label: string) {
		console.log(TerminalOutput.header(label));
	}

	private printJSON(obj: unknown) {
		console.log(TerminalOutput.json(obj));
	}

	private renderSystem(event: ClaudeEvent) {
		if (event.subtype !== 'init') {
			this.printHeader(`SYSTEM: ${event.subtype ?? 'unknown'}`);
			this.printJSON(event);
			return;
		}
		this.printHeader('SESSION');
		const sessionPrefix = event.session_id !== undefined ? event.session_id.slice(0, 8) : 'unknown';
		const toolsCount = event.tools !== undefined ? event.tools.length : 0;
		console.log(colors.system(`model: ${event.model ?? 'unknown'}`));
		console.log(colors.system(`cwd: ${event.cwd ?? 'unknown'}`));
		console.log(colors.system(`tools: ${toolsCount}`));
		console.log(colors.system(`session: ${sessionPrefix}`));
		if (event.claude_code_version !== undefined) {
			console.log(colors.system(`claude-code: v${event.claude_code_version}`));
		}
	}

	private renderAssistant(event: ClaudeEvent) {
		const content = event.message?.content;
		if (content === undefined) return;
		for (const block of content) {
			this.renderAssistantBlock(block);
		}
	}

	private renderAssistantBlock(block: ContentBlock) {
		if (block.type === 'thinking') {
			console.log(colors.system('\n--- thinking ---'));
			console.log(colors.thinking(block.thinking ?? ''));
			return;
		}
		if (block.type === 'text') {
			console.log(colors.text(`\n${block.text ?? ''}`));
			return;
		}
		if (block.type === 'tool_use') {
			this.renderToolUse(block);
			return;
		}
		console.log(colors.system(`\n[assistant block: ${block.type ?? 'unknown'}]`));
		this.printJSON(block);
	}

	private renderToolUse(block: ContentBlock) {
		const name = block.name ?? 'tool';
		if (block.id !== undefined) {
			this.toolNamesById.set(block.id, name);
		}
		console.log(colors.tool(`\n→ ${name}`));

		const rawInput = block.input;
		const input: ToolInput = (rawInput !== null && typeof rawInput === 'object')
			? rawInput as ToolInput
			: {};
		const bodyLines = ToolInputFormatter.format(name, input);
		for (const line of bodyLines) {
			console.log(`    ${line}`);
		}
	}

	private renderUser(event: ClaudeEvent) {
		const content = event.message?.content;
		if (content === undefined) return;
		for (const block of content) {
			if (block.type === 'tool_result') {
				this.renderToolResult(block);
				continue;
			}
			console.log(colors.system(`\n[user block: ${block.type ?? 'unknown'}]`));
			this.printJSON(block);
		}
	}

	private renderToolResult(block: ContentBlock) {
		const toolName = block.tool_use_id !== undefined
			? this.toolNamesById.get(block.tool_use_id) ?? block.tool_use_id.slice(0, 12)
			: 'unknown';
		const isError = block.is_error === true;
		const label = isError ? `← ${toolName} ERROR` : `← ${toolName} result`;
		console.log(colors.tool(`\n${label}`));

		const text = LogRenderer.toolResultToText(block.content);
		const lines = text.split('\n');
		const colorFn = isError ? colors.error : colors.text;
		if (lines.length <= MAX_TOOL_RESULT_LINES) {
			console.log(colorFn(text));
			return;
		}
		const head = lines.slice(0, MAX_TOOL_RESULT_LINES).join('\n');
		const moreCount = lines.length - MAX_TOOL_RESULT_LINES;
		console.log(colorFn(head));
		console.log(colors.system(`… (truncated, ${moreCount} more lines)`));
	}

	private static toolResultToText(content: ContentBlock['content']): string {
		if (content === undefined) return '';
		if (typeof content === 'string') return content;
		return content.map((b) => b.text ?? '').join('');
	}

	private renderRateLimit(event: ClaudeEvent) {
		const status = event.rate_limit_info?.status ?? 'unknown';
		console.log(colors.system(`\n[rate_limit] ${status}`));
	}

	private renderResult(event: ClaudeEvent) {
		this.printHeader('RESULT');
		if (event.terminal_reason !== undefined) console.log(colors.system(`terminal_reason: ${event.terminal_reason}`));
		if (event.stop_reason !== undefined) console.log(colors.system(`stop_reason: ${event.stop_reason}`));
		if (event.is_error === true) console.log(colors.error('is_error: true'));
		const denials = event.permission_denials;
		if (denials !== undefined && denials.length > 0) console.log(colors.system(`permission_denials: ${denials.length}`));
		if (event.num_turns !== undefined) console.log(colors.system(`turns: ${event.num_turns}`));
		if (event.duration_ms !== undefined) console.log(colors.system(`duration: ${(event.duration_ms / 1000).toFixed(2)}s`));
		if (event.total_cost_usd !== undefined) console.log(colors.system(`cost: $${event.total_cost_usd.toFixed(4)}`));
	}
}

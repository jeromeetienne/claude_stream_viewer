import { colors } from '../libs/colors.js';
import { TerminalOutput } from '../libs/terminal_output.js';
import type { StatsFormat, StatsReport } from '../types/stats_report.js';

/** Renders a {@link StatsReport} as colorized text, JSON, or Markdown. */
export class StatsRenderer {
	/**
	 * Renders the report in the requested format and returns it as a single
	 * string ready to print. Text output is colorized; JSON and Markdown are not.
	 */
	static render(report: StatsReport, format: StatsFormat): string {
		if (format === 'json') return JSON.stringify(report, null, 2);
		if (format === 'markdown') return StatsRenderer.formatMarkdown(report);
		return StatsRenderer.formatText(report);
	}

	private static formatText(report: StatsReport): string {
		const lines: string[] = [];
		const r = report.result;
		lines.push(TerminalOutput.header('RESULT'));
		if (report.truncated === true) lines.push(colors.system('(no result event — stream truncated)'));
		if (r.terminalReason !== undefined) lines.push(colors.system(`terminal_reason: ${r.terminalReason}`));
		if (r.stopReason !== undefined) lines.push(colors.system(`stop_reason: ${r.stopReason}`));
		if (r.isError === true) lines.push(colors.error('is_error: true'));
		if (r.permissionDenials > 0) lines.push(colors.system(`permission_denials: ${r.permissionDenials}`));
		if (r.numTurns !== undefined) lines.push(colors.system(`turns: ${r.numTurns}`));
		if (r.durationMs !== undefined) lines.push(colors.system(`duration: ${(r.durationMs / 1000).toFixed(2)}s`));
		if (r.totalCostUsd !== undefined) lines.push(colors.system(`cost: $${r.totalCostUsd.toFixed(4)}`));

		const latency = report.latency;
		if (latency !== undefined) {
			lines.push(TerminalOutput.header('LATENCY'));
			lines.push(colors.system(`wall:  ${(latency.wallMs / 1000).toFixed(2)}s`));
			if (latency.apiMs !== undefined) lines.push(colors.system(`api:   ${(latency.apiMs / 1000).toFixed(2)}s`));
			if (latency.localMs !== undefined) lines.push(colors.system(`local: ${(latency.localMs / 1000).toFixed(2)}s (tools + overhead)`));
			if (latency.throughputTokPerS !== undefined) lines.push(colors.system(`throughput: ${latency.throughputTokPerS} output tok/s (api time)`));
		}

		const tokens = report.tokens;
		if (tokens !== undefined) {
			lines.push(TerminalOutput.header('TOKENS'));
			lines.push(colors.system(`input:        ${StatsRenderer.formatCount(tokens.input)}`));
			lines.push(colors.system(`output:       ${StatsRenderer.formatCount(tokens.output)}`));
			lines.push(colors.system(`cache read:   ${StatsRenderer.formatCount(tokens.cacheRead)}`));
			lines.push(colors.system(`cache create: ${StatsRenderer.formatCount(tokens.cacheCreate)}`));
			lines.push(colors.system(`total:        ${StatsRenderer.formatCount(tokens.total)}`));
			lines.push(colors.system(`cache hit:    ${tokens.cacheHitPct.toFixed(1)}% of prompt tokens`));
			if (tokens.byModel.length > 0) {
				lines.push(colors.system('\nby model:'));
				for (const model of tokens.byModel) {
					const costSuffix = model.costUsd !== undefined ? ` $${model.costUsd.toFixed(4)}` : '';
					lines.push(colors.system(`  ${model.model}: in=${StatsRenderer.formatCount(model.input)} out=${StatsRenderer.formatCount(model.output)} cache_read=${StatsRenderer.formatCount(model.cacheRead)} cache_create=${StatsRenderer.formatCount(model.cacheCreate)}${costSuffix}`));
				}
			}
		}

		const context = report.context;
		if (context.peakPromptTokens > 0) {
			lines.push(TerminalOutput.header('CONTEXT'));
			lines.push(colors.system(`peak prompt: ${StatsRenderer.formatCount(context.peakPromptTokens)} tokens`));
			if (context.contextWindow !== undefined && context.peakPct !== undefined) {
				lines.push(colors.system(`window:      ${StatsRenderer.formatCount(context.contextWindow)} (${context.peakPct.toFixed(1)}% used at peak)`));
			}
		}

		const tools = report.tools;
		if (tools.byTool.length > 0) {
			lines.push(TerminalOutput.header('TOOLS'));
			lines.push(colors.system(`calls: ${tools.totalCalls}`));
			for (const entry of tools.byTool) {
				lines.push(colors.system(`  ${entry.name}: ${entry.count}`));
			}
			if (tools.resultCount > 0) {
				const line = `errors: ${tools.errorCount}/${tools.resultCount} (${tools.errorPct.toFixed(1)}%)`;
				lines.push(tools.errorCount > 0 ? colors.error(line) : colors.system(line));
			}
		}

		return lines.join('\n');
	}

	private static formatMarkdown(report: StatsReport): string {
		const lines: string[] = [];
		const r = report.result;
		lines.push('## Stream stats');
		lines.push('');
		const summary: string[] = [];
		if (r.terminalReason !== undefined) summary.push(r.terminalReason);
		if (r.stopReason !== undefined) summary.push(r.stopReason);
		if (r.numTurns !== undefined) summary.push(`${r.numTurns} turns`);
		if (r.durationMs !== undefined) summary.push(`${(r.durationMs / 1000).toFixed(2)}s`);
		if (r.totalCostUsd !== undefined) summary.push(`$${r.totalCostUsd.toFixed(4)}`);
		if (summary.length > 0) {
			lines.push(`**Result:** ${summary.join(' · ')}`);
			lines.push('');
		}
		if (report.truncated === true) {
			lines.push('_No result event — stream truncated._');
			lines.push('');
		}
		if (r.isError === true) {
			lines.push('> ⚠️ **is_error: true**');
			lines.push('');
		}
		if (r.permissionDenials > 0) {
			lines.push(`> permission denials: ${r.permissionDenials}`);
			lines.push('');
		}

		const latency = report.latency;
		if (latency !== undefined) {
			lines.push('### Latency');
			lines.push('');
			lines.push('| metric | value |');
			lines.push('|---|---|');
			lines.push(`| wall | ${(latency.wallMs / 1000).toFixed(2)}s |`);
			if (latency.apiMs !== undefined) lines.push(`| api | ${(latency.apiMs / 1000).toFixed(2)}s |`);
			if (latency.localMs !== undefined) lines.push(`| local (tools + overhead) | ${(latency.localMs / 1000).toFixed(2)}s |`);
			if (latency.throughputTokPerS !== undefined) lines.push(`| throughput | ${latency.throughputTokPerS} output tok/s |`);
			lines.push('');
		}

		const tokens = report.tokens;
		if (tokens !== undefined) {
			lines.push('### Tokens');
			lines.push('');
			lines.push('| type | count |');
			lines.push('|---|--:|');
			lines.push(`| input | ${StatsRenderer.formatCount(tokens.input)} |`);
			lines.push(`| output | ${StatsRenderer.formatCount(tokens.output)} |`);
			lines.push(`| cache read | ${StatsRenderer.formatCount(tokens.cacheRead)} |`);
			lines.push(`| cache create | ${StatsRenderer.formatCount(tokens.cacheCreate)} |`);
			lines.push(`| **total** | **${StatsRenderer.formatCount(tokens.total)}** |`);
			lines.push(`| cache hit | ${tokens.cacheHitPct.toFixed(1)}% |`);
			lines.push('');
			if (tokens.byModel.length > 0) {
				lines.push('**By model:**');
				lines.push('');
				lines.push('| model | in | out | cache read | cache create | cost |');
				lines.push('|---|--:|--:|--:|--:|--:|');
				for (const model of tokens.byModel) {
					const cost = model.costUsd !== undefined ? `$${model.costUsd.toFixed(4)}` : '';
					lines.push(`| ${model.model} | ${StatsRenderer.formatCount(model.input)} | ${StatsRenderer.formatCount(model.output)} | ${StatsRenderer.formatCount(model.cacheRead)} | ${StatsRenderer.formatCount(model.cacheCreate)} | ${cost} |`);
				}
				lines.push('');
			}
		}

		const context = report.context;
		if (context.peakPromptTokens > 0) {
			lines.push('### Context');
			lines.push('');
			if (context.contextWindow !== undefined && context.peakPct !== undefined) {
				lines.push(`Peak prompt **${StatsRenderer.formatCount(context.peakPromptTokens)}** tokens — ${context.peakPct.toFixed(1)}% of ${StatsRenderer.formatCount(context.contextWindow)} window.`);
			} else {
				lines.push(`Peak prompt **${StatsRenderer.formatCount(context.peakPromptTokens)}** tokens.`);
			}
			lines.push('');
		}

		const tools = report.tools;
		if (tools.byTool.length > 0) {
			lines.push('### Tools');
			lines.push('');
			lines.push(`Total calls: **${tools.totalCalls}**`);
			lines.push('');
			lines.push('| tool | calls |');
			lines.push('|---|--:|');
			for (const entry of tools.byTool) {
				lines.push(`| ${entry.name} | ${entry.count} |`);
			}
			lines.push('');
			if (tools.resultCount > 0) {
				lines.push(`Errors: ${tools.errorCount}/${tools.resultCount} (${tools.errorPct.toFixed(1)}%)`);
				lines.push('');
			}
		}

		return lines.join('\n').trimEnd();
	}

	private static formatCount(value: number): string {
		return value.toLocaleString('en-US');
	}
}

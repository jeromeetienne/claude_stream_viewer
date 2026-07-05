import type { ClaudeEvent, ModelUsage } from '../types/claude_event.js';
import type { ModelTokens, StatsReport } from '../types/stats_report.js';

export class StatsCollector {
	private toolUseCounts = new Map<string, number>();
	private toolResultCount = 0;
	private toolResultErrorCount = 0;
	private peakPromptTokens = 0;
	private resultEvent: ClaudeEvent | undefined;

	track(event: ClaudeEvent) {
		const type = event.type;
		if (type === 'assistant') {
			this.trackPromptSize(event);
			this.trackToolUses(event);
			return;
		}
		if (type === 'user') {
			this.trackToolResults(event);
			return;
		}
		if (type === 'result') {
			this.resultEvent = event;
		}
	}

	private trackPromptSize(event: ClaudeEvent) {
		const usage = event.message?.usage;
		if (usage === undefined) return;
		const prompt = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
		if (prompt > this.peakPromptTokens) {
			this.peakPromptTokens = prompt;
		}
	}

	private trackToolUses(event: ClaudeEvent) {
		const content = event.message?.content;
		if (content === undefined) return;
		for (const block of content) {
			if (block.type !== 'tool_use') {
				continue;
			}
			const name = block.name ?? 'tool';
			this.toolUseCounts.set(name, (this.toolUseCounts.get(name) ?? 0) + 1);
		}
	}

	private trackToolResults(event: ClaudeEvent) {
		const content = event.message?.content;
		if (content === undefined) return;
		for (const block of content) {
			if (block.type !== 'tool_result') {
				continue;
			}
			this.toolResultCount += 1;
			if (block.is_error === true) {
				this.toolResultErrorCount += 1;
			}
		}
	}

	buildReport(): StatsReport {
		const event = this.resultEvent;
		const usage = event?.usage;

		const result = {
			terminalReason: event?.terminal_reason,
			stopReason: event?.stop_reason,
			isError: event?.is_error === true,
			numTurns: event?.num_turns,
			permissionDenials: event?.permission_denials?.length ?? 0,
			durationMs: event?.duration_ms,
			totalCostUsd: event?.total_cost_usd,
		};

		let latency: StatsReport['latency'];
		if (event?.duration_ms !== undefined) {
			const wallMs = event.duration_ms;
			const apiMs = event.duration_api_ms;
			const localMs = apiMs !== undefined ? Math.max(0, wallMs - apiMs) : undefined;
			const output = usage?.output_tokens;
			const throughputTokPerS = (apiMs !== undefined && apiMs > 0 && output !== undefined && output > 0)
				? Math.round(output / (apiMs / 1000))
				: undefined;
			latency = { wallMs, apiMs, localMs, throughputTokPerS };
		}

		let tokens: StatsReport['tokens'];
		if (usage !== undefined) {
			const input = usage.input_tokens ?? 0;
			const output = usage.output_tokens ?? 0;
			const cacheRead = usage.cache_read_input_tokens ?? 0;
			const cacheCreate = usage.cache_creation_input_tokens ?? 0;
			const total = input + output + cacheRead + cacheCreate;
			const promptTotal = input + cacheRead + cacheCreate;
			const cacheHitPct = promptTotal > 0 ? StatsCollector.round1((cacheRead / promptTotal) * 100) : 0;
			tokens = {
				input,
				output,
				cacheRead,
				cacheCreate,
				total,
				cacheHitPct,
				byModel: StatsCollector.buildByModel(event?.modelUsage),
			};
		}

		const contextWindow = StatsCollector.maxContextWindow(event?.modelUsage);
		const context = {
			peakPromptTokens: this.peakPromptTokens,
			contextWindow: contextWindow > 0 ? contextWindow : undefined,
			peakPct: contextWindow > 0 ? StatsCollector.round1((this.peakPromptTokens / contextWindow) * 100) : undefined,
		};

		const byTool = [...this.toolUseCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
		const totalCalls = byTool.reduce((sum, entry) => sum + entry.count, 0);
		const errorPct = this.toolResultCount > 0 ? StatsCollector.round1((this.toolResultErrorCount / this.toolResultCount) * 100) : 0;
		const tools = {
			totalCalls,
			byTool,
			resultCount: this.toolResultCount,
			errorCount: this.toolResultErrorCount,
			errorPct,
		};

		return {
			truncated: this.resultEvent === undefined,
			result,
			latency,
			tokens,
			context,
			tools,
		};
	}

	private static buildByModel(modelUsage: Record<string, ModelUsage> | undefined): ModelTokens[] {
		if (modelUsage === undefined) return [];
		return Object.entries(modelUsage).map(([model, usage]) => ({
			model,
			input: usage.inputTokens ?? 0,
			output: usage.outputTokens ?? 0,
			cacheRead: usage.cacheReadInputTokens ?? 0,
			cacheCreate: usage.cacheCreationInputTokens ?? 0,
			costUsd: usage.costUSD,
		}));
	}

	private static maxContextWindow(modelUsage: Record<string, ModelUsage> | undefined): number {
		if (modelUsage === undefined) return 0;
		let max = 0;
		for (const usage of Object.values(modelUsage)) {
			const contextWindow = usage.contextWindow ?? 0;
			if (contextWindow > max) {
				max = contextWindow;
			}
		}
		return max;
	}

	private static round1(value: number): number {
		return Math.round(value * 10) / 10;
	}
}

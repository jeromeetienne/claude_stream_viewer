import { test } from 'node:test';
import Assert from 'node:assert/strict';

import { StatsCollector } from '../../src/stats/stats_collector.js';
import type { ClaudeEvent } from '../../src/types/claude_event.js';

const assistantToolUse = (name: string): ClaudeEvent => ({
	type: 'assistant',
	message: { content: [{ type: 'tool_use', name }] },
});

const userToolResult = (isError: boolean): ClaudeEvent => ({
	type: 'user',
	message: { content: [{ type: 'tool_result', is_error: isError }] },
});

test('buildReport marks the stream truncated when no result event is seen', () => {
	const collector = new StatsCollector();
	const report = collector.buildReport();
	Assert.equal(report.truncated, true);
	Assert.equal(report.latency, undefined);
	Assert.equal(report.tokens, undefined);
	Assert.equal(report.tools.totalCalls, 0);
	Assert.equal(report.context.peakPromptTokens, 0);
});

test('counts tool_use blocks and sorts byTool by descending count', () => {
	const collector = new StatsCollector();
	collector.track(assistantToolUse('Bash'));
	collector.track(assistantToolUse('Read'));
	collector.track(assistantToolUse('Bash'));
	collector.track(assistantToolUse('Bash'));
	collector.track(assistantToolUse('Read'));
	const report = collector.buildReport();
	Assert.equal(report.tools.totalCalls, 5);
	Assert.deepEqual(report.tools.byTool, [
		{ name: 'Bash', count: 3 },
		{ name: 'Read', count: 2 },
	]);
});

test('tool_use blocks without a name fall back to "tool"', () => {
	const collector = new StatsCollector();
	collector.track({ type: 'assistant', message: { content: [{ type: 'tool_use' }] } });
	const report = collector.buildReport();
	Assert.deepEqual(report.tools.byTool, [{ name: 'tool', count: 1 }]);
});

test('tracks tool_result counts, error counts, and error percentage', () => {
	const collector = new StatsCollector();
	collector.track(userToolResult(false));
	collector.track(userToolResult(true));
	collector.track(userToolResult(false));
	collector.track(userToolResult(false));
	const report = collector.buildReport();
	Assert.equal(report.tools.resultCount, 4);
	Assert.equal(report.tools.errorCount, 1);
	Assert.equal(report.tools.errorPct, 25);
});

test('peak prompt tokens sums input, cache read, and cache creation across assistant events', () => {
	const collector = new StatsCollector();
	collector.track({
		type: 'assistant',
		message: { usage: { input_tokens: 100, cache_read_input_tokens: 50, cache_creation_input_tokens: 10 } },
	});
	collector.track({
		type: 'assistant',
		message: { usage: { input_tokens: 200, cache_read_input_tokens: 300, cache_creation_input_tokens: 0 } },
	});
	collector.track({
		type: 'assistant',
		message: { usage: { input_tokens: 10, cache_read_input_tokens: 10, cache_creation_input_tokens: 0 } },
	});
	const report = collector.buildReport();
	Assert.equal(report.context.peakPromptTokens, 500);
});

test('buildReport computes token totals and cache hit percentage from the result event', () => {
	const collector = new StatsCollector();
	collector.track({
		type: 'result',
		usage: {
			input_tokens: 100,
			output_tokens: 40,
			cache_read_input_tokens: 300,
			cache_creation_input_tokens: 100,
		},
	});
	const report = collector.buildReport();
	Assert.equal(report.truncated, false);
	Assert.ok(report.tokens);
	Assert.equal(report.tokens.input, 100);
	Assert.equal(report.tokens.output, 40);
	Assert.equal(report.tokens.cacheRead, 300);
	Assert.equal(report.tokens.cacheCreate, 100);
	Assert.equal(report.tokens.total, 540);
	// cacheRead / (input + cacheRead + cacheCreate) = 300 / 500 = 60%
	Assert.equal(report.tokens.cacheHitPct, 60);
});

test('buildReport derives latency: local time is wall minus api, plus throughput', () => {
	const collector = new StatsCollector();
	collector.track({
		type: 'result',
		duration_ms: 10000,
		duration_api_ms: 4000,
		usage: { output_tokens: 2000 },
	});
	const report = collector.buildReport();
	Assert.ok(report.latency);
	Assert.equal(report.latency.wallMs, 10000);
	Assert.equal(report.latency.apiMs, 4000);
	Assert.equal(report.latency.localMs, 6000);
	// 2000 output tokens / 4s = 500 tok/s
	Assert.equal(report.latency.throughputTokPerS, 500);
});

test('localMs is clamped to zero when api time exceeds wall time', () => {
	const collector = new StatsCollector();
	collector.track({ type: 'result', duration_ms: 3000, duration_api_ms: 5000, usage: { output_tokens: 100 } });
	const report = collector.buildReport();
	Assert.ok(report.latency);
	Assert.equal(report.latency.localMs, 0);
});

test('context window uses the largest contextWindow across modelUsage and computes peakPct', () => {
	const collector = new StatsCollector();
	collector.track({ type: 'assistant', message: { usage: { input_tokens: 100000 } } });
	collector.track({
		type: 'result',
		modelUsage: {
			'claude-a': { contextWindow: 200000 },
			'claude-b': { contextWindow: 1000000 },
		},
	});
	const report = collector.buildReport();
	Assert.equal(report.context.contextWindow, 1000000);
	Assert.equal(report.context.peakPromptTokens, 100000);
	// 100000 / 1000000 = 10%
	Assert.equal(report.context.peakPct, 10);
});

test('buildReport maps modelUsage into byModel token breakdowns', () => {
	const collector = new StatsCollector();
	collector.track({
		type: 'result',
		usage: { input_tokens: 1, output_tokens: 1 },
		modelUsage: {
			'claude-opus': {
				inputTokens: 1000,
				outputTokens: 500,
				cacheReadInputTokens: 200,
				cacheCreationInputTokens: 100,
				costUSD: 0.1234,
			},
		},
	});
	const report = collector.buildReport();
	Assert.ok(report.tokens);
	Assert.deepEqual(report.tokens.byModel, [
		{
			model: 'claude-opus',
			input: 1000,
			output: 500,
			cacheRead: 200,
			cacheCreate: 100,
			costUsd: 0.1234,
		},
	]);
});

test('buildReport surfaces result metadata (terminal reason, turns, cost, denials)', () => {
	const collector = new StatsCollector();
	collector.track({
		type: 'result',
		terminal_reason: 'completed',
		stop_reason: 'end_turn',
		is_error: false,
		num_turns: 7,
		total_cost_usd: 0.42,
		duration_ms: 1234,
		permission_denials: [{}, {}],
	});
	const report = collector.buildReport();
	Assert.equal(report.result.terminalReason, 'completed');
	Assert.equal(report.result.stopReason, 'end_turn');
	Assert.equal(report.result.isError, false);
	Assert.equal(report.result.numTurns, 7);
	Assert.equal(report.result.totalCostUsd, 0.42);
	Assert.equal(report.result.durationMs, 1234);
	Assert.equal(report.result.permissionDenials, 2);
});

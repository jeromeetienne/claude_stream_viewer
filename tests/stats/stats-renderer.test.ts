import { test, before } from 'node:test';
import Assert from 'node:assert/strict';
import Chalk from 'chalk';

import { StatsRenderer } from '../../src/stats/stats_renderer.js';
import type { StatsReport } from '../../src/types/stats_report.js';

before(() => {
	// Disable colors so text output is deterministic (same mechanism as --no-color).
	Chalk.level = 0;
});

const sampleReport = (): StatsReport => ({
	truncated: false,
	result: {
		terminalReason: 'completed',
		stopReason: 'end_turn',
		isError: false,
		numTurns: 4,
		permissionDenials: 0,
		durationMs: 13633,
		totalCostUsd: 0.1234,
	},
	latency: {
		wallMs: 13633,
		apiMs: 8000,
		localMs: 5633,
		throughputTokPerS: 250,
	},
	tokens: {
		input: 1200,
		output: 3400,
		cacheRead: 56000,
		cacheCreate: 7000,
		total: 67600,
		cacheHitPct: 87.5,
		byModel: [
			{ model: 'claude-opus', input: 1200, output: 3400, cacheRead: 56000, cacheCreate: 7000, costUsd: 0.1234 },
		],
	},
	context: {
		peakPromptTokens: 64200,
		contextWindow: 1000000,
		peakPct: 6.4,
	},
	tools: {
		totalCalls: 5,
		byTool: [
			{ name: 'Bash', count: 3 },
			{ name: 'Read', count: 2 },
		],
		resultCount: 5,
		errorCount: 1,
		errorPct: 20,
	},
});

test('json format is the pretty-printed report itself', () => {
	const report = sampleReport();
	const out = StatsRenderer.render(report, 'json');
	Assert.equal(out, JSON.stringify(report, null, 2));
	Assert.deepEqual(JSON.parse(out), report);
});

test('tty (text) format includes each section header and key figures', () => {
	const out = StatsRenderer.render(sampleReport(), 'tty');
	Assert.match(out, /=== RESULT ===/);
	Assert.match(out, /=== LATENCY ===/);
	Assert.match(out, /=== TOKENS ===/);
	Assert.match(out, /=== CONTEXT ===/);
	Assert.match(out, /=== TOOLS ===/);
	Assert.match(out, /terminal_reason: completed/);
	Assert.match(out, /duration: 13\.63s/);
	Assert.match(out, /cost: \$0\.1234/);
	Assert.match(out, /throughput: 250 output tok\/s/);
	// formatCount inserts thousands separators
	Assert.match(out, /cache read:\s+56,000/);
	Assert.match(out, /cache hit:\s+87\.5%/);
	Assert.match(out, /Bash: 3/);
	Assert.match(out, /errors: 1\/5 \(20\.0%\)/);
});

test('tty format notes truncation when no result event was seen', () => {
	const report = sampleReport();
	report.truncated = true;
	const out = StatsRenderer.render(report, 'tty');
	Assert.match(out, /no result event — stream truncated/);
});

test('markdown format renders headings and tables', () => {
	const out = StatsRenderer.render(sampleReport(), 'markdown');
	Assert.match(out, /^## Stream stats/m);
	Assert.match(out, /^### Latency/m);
	Assert.match(out, /^### Tokens/m);
	Assert.match(out, /^### Context/m);
	Assert.match(out, /^### Tools/m);
	Assert.match(out, /\*\*Result:\*\* completed · end_turn · 4 turns/);
	Assert.match(out, /\| \*\*total\*\* \| \*\*67,600\*\* \|/);
	Assert.match(out, /Total calls: \*\*5\*\*/);
	Assert.match(out, /\| Bash \| 3 \|/);
});

test('markdown format flags is_error with a callout', () => {
	const report = sampleReport();
	report.result.isError = true;
	const out = StatsRenderer.render(report, 'markdown');
	Assert.match(out, /> ⚠️ \*\*is_error: true\*\*/);
});

test('renderer omits latency and tokens sections when absent', () => {
	const report = sampleReport();
	delete report.latency;
	delete report.tokens;
	const text = StatsRenderer.render(report, 'tty');
	Assert.doesNotMatch(text, /=== LATENCY ===/);
	Assert.doesNotMatch(text, /=== TOKENS ===/);
	const markdown = StatsRenderer.render(report, 'markdown');
	Assert.doesNotMatch(markdown, /### Latency/);
	Assert.doesNotMatch(markdown, /### Tokens/);
});

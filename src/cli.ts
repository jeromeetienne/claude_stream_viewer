#!/usr/bin/env node

// Reads Claude Code stream-json events line-by-line from stdin and pretty-prints
// the consolidated event layer (system/assistant/user/result). The fine-grained
// `stream_event` SSE envelopes are ignored — the consolidated events already
// carry fully assembled content blocks.
//
// With --stats/-s (or --json / --markdown) the streamed log is suppressed and
// only a summary report is printed at the end.
//
// Usage:
//   claude --output-format stream-json --verbose -p "explain quantum computing" | npx claude_stream_viewer
//   … | npx claude_stream_viewer --stats
//   … | npx claude_stream_viewer --json

import Readline from 'node:readline';
import Fs from 'node:fs';
import Path from 'node:path';
import * as Commander from 'commander';
import Chalk from 'chalk';

import { colors } from './libs/colors.js';
import { TerminalOutput } from './libs/terminal_output.js';
import { LogRenderer } from './log_viewer/log_renderer.js';
import { StatsCollector } from './stats/stats_collector.js';
import { StatsRenderer } from './stats/stats_renderer.js';
import type { ClaudeEvent } from './types/claude_event.js';
import type { StatsFormat } from './types/stats_report.js';

const __dirname = new URL('.', import.meta.url).pathname;

/** Parsed command-line options (see the Commander definitions in {@link main}). */
type CliOptions = {
	color: boolean;
	stats: boolean;
	json: boolean;
	markdown: boolean;
};

/**
 * Entry point: parses options, then reads stream-json events line-by-line from
 * stdin. Every event is fed to the {@link StatsCollector}; unless a stats-only
 * mode is active it is also rendered by the {@link LogRenderer}. On stdin close
 * it prints either the stats summary or the `[stream ended]` marker.
 */
async function main(): Promise<void> {
	const packageJsonPath = Path.join(__dirname, '..', 'package.json');
	const packageJson: object = JSON.parse(await Fs.promises.readFile(packageJsonPath, 'utf-8'));
	const packageVersion = (packageJson as { version?: string }).version ?? 'unknown';

	const program = new Commander.Command();
	program
		.name('claude_stream_viewer')
		.description('Pretty-prints Claude Code consolidated stream-json events from stdin with colorized output.')
		.version(packageVersion)
		.option('--no-color', 'disable colored output')
		.option('-s, --stats', 'output only the summary stats (latency, tokens, context, tools); suppresses the streamed log')
		.option('--json', 'output stats as JSON (implies --stats)')
		.option('--markdown', 'output stats as Markdown (implies --stats)')
		.parse(process.argv);

	const options = program.opts<CliOptions>();
	if (options.color === false) {
		Chalk.level = 0;
	}

	const format: StatsFormat = options.json === true ? 'json' : options.markdown === true ? 'markdown' : 'text';
	const statsMode = options.stats === true || options.json === true || options.markdown === true;

	const collector = new StatsCollector();
	const logRenderer = new LogRenderer();

	const readline = Readline.createInterface({
		input: process.stdin,
		crlfDelay: Infinity,
	});

	readline.on('line', (line) => {
		if (line.trim() === '') return;
		let event: ClaudeEvent;
		try {
			event = JSON.parse(line);
		} catch (err) {
			console.error(colors.error('Invalid JSON:'), line);
			return;
		}
		try {
			collector.track(event);
			if (statsMode === false) {
				logRenderer.render(event);
			}
		} catch (err) {
			console.error(colors.error('Error processing event:'), err);
			if (statsMode === false) {
				console.log(TerminalOutput.json(event));
			}
		}
	});

	await new Promise<void>((resolve) => {
		readline.on('close', () => {
			if (statsMode === true) {
				console.log(StatsRenderer.render(collector.buildReport(), format));
			} else {
				console.log(colors.system('\n[stream ended]'));
			}
			resolve();
		});
	});
}

await main();

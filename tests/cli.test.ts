import { test } from 'node:test';
import Assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import Fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const sampleData = fileURLToPath(new URL('../data/claude_events/basic.claude_events.jsonl', import.meta.url));

type CliResult = {
	stdout: string;
	stderr: string;
	code: number | null;
};

const runCli = (args: string[], stdin: string): Promise<CliResult> => {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ['--import', 'tsx', cliPath, ...args], {
			cwd: projectRoot,
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
		child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
		child.on('error', reject);
		child.on('close', (code) => resolve({ stdout, stderr, code }));
		child.stdin.write(stdin);
		child.stdin.end();
	});
};

test('--stats --format json emits a parseable stats report for the sample stream', async () => {
	const input = Fs.readFileSync(sampleData, 'utf-8');
	const { stdout, code } = await runCli(['--stats', '--format', 'json'], input);
	Assert.equal(code, 0);
	const report = JSON.parse(stdout);
	Assert.equal(report.truncated, false);
	Assert.equal(report.result.isError, false);
	Assert.ok(report.tokens);
	Assert.ok(report.tokens.total > 0);
	Assert.ok(Array.isArray(report.tools.byTool));
});

test('default (log) mode prints the stream-ended marker', async () => {
	const input = Fs.readFileSync(sampleData, 'utf-8');
	const { stdout, code } = await runCli(['--no-color'], input);
	Assert.equal(code, 0);
	Assert.match(stdout, /\[stream ended\]/);
	Assert.match(stdout, /=== SESSION ===/);
});

test('invalid JSON lines are reported on stderr without crashing', async () => {
	const { stdout, stderr, code } = await runCli(['--no-color'], 'this is not json\n');
	Assert.equal(code, 0);
	Assert.match(stderr, /Invalid JSON:/);
	Assert.match(stdout, /\[stream ended\]/);
});

test('blank input still exits cleanly with the stream-ended marker', async () => {
	const { stdout, code } = await runCli(['--no-color'], '\n\n');
	Assert.equal(code, 0);
	Assert.match(stdout, /\[stream ended\]/);
});

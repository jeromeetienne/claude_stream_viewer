import { test, before } from 'node:test';
import Assert from 'node:assert/strict';
import Chalk from 'chalk';

import { ToolInputFormatter } from '../../src/log_viewer/tool_input_formatter.js';

before(() => {
	// Disable colors so formatted lines are plain, comparable strings.
	Chalk.level = 0;
});

test('Bash formats the command with a $ prefix and appends the description', () => {
	const lines = ToolInputFormatter.format('Bash', { command: 'ls -la', description: 'list files' });
	Assert.deepEqual(lines, ['$ ls -la', '# list files']);
});

test('Bash preserves multi-line commands, prefixing only the first line', () => {
	const lines = ToolInputFormatter.format('Bash', { command: 'echo a\necho b' });
	Assert.deepEqual(lines, ['$ echo a', 'echo b']);
});

test('Read appends an offset+limit range suffix to the file path', () => {
	Assert.deepEqual(ToolInputFormatter.format('Read', { file_path: '/a/b.ts', offset: 10, limit: 20 }), ['/a/b.ts:10-29']);
	Assert.deepEqual(ToolInputFormatter.format('Read', { file_path: '/a/b.ts', offset: 5 }), ['/a/b.ts:5+']);
	Assert.deepEqual(ToolInputFormatter.format('Read', { file_path: '/a/b.ts' }), ['/a/b.ts']);
});

test('Edit notes replace_all only when it is true', () => {
	Assert.deepEqual(ToolInputFormatter.format('Edit', { file_path: '/a/b.ts', replace_all: true }), ['/a/b.ts', 'replace_all=true']);
	Assert.deepEqual(ToolInputFormatter.format('Edit', { file_path: '/a/b.ts', replace_all: false }), ['/a/b.ts']);
	Assert.deepEqual(ToolInputFormatter.format('Edit', { file_path: '/a/b.ts' }), ['/a/b.ts']);
});

test('Grep renders the pattern, optional path, and active flags', () => {
	Assert.deepEqual(ToolInputFormatter.format('Grep', { pattern: 'foo' }), ['"foo"']);
	const lines = ToolInputFormatter.format('Grep', {
		pattern: 'foo',
		path: 'src',
		output_mode: 'content',
		'-n': true,
		'-i': true,
		head_limit: 5,
		glob: '*.ts',
		type: 'ts',
	});
	Assert.equal(lines.length, 1);
	Assert.match(lines[0], /"foo" in src/);
	Assert.match(lines[0], /output_mode=content/);
	Assert.match(lines[0], /-n/);
	Assert.match(lines[0], /-i/);
	Assert.match(lines[0], /head_limit=5/);
	Assert.match(lines[0], /glob=\*\.ts/);
	Assert.match(lines[0], /type=ts/);
});

test('TodoWrite maps each todo status to a checkbox mark', () => {
	const lines = ToolInputFormatter.format('TodoWrite', {
		todos: [
			{ status: 'pending', content: 'a' },
			{ status: 'in_progress', content: 'b' },
			{ status: 'completed', content: 'c' },
		],
	});
	Assert.deepEqual(lines, ['[ ] a', '[~] b', '[x] c']);
});

test('TodoWrite handles a missing todos array gracefully', () => {
	Assert.deepEqual(ToolInputFormatter.format('TodoWrite', {}), ['(no todos)']);
});

test('Task/Agent shows the subagent label and previews long prompts with a length suffix', () => {
	const short = ToolInputFormatter.format('Task', { description: 'do it', subagent_type: 'Explore', prompt: 'hi' });
	Assert.deepEqual(short, ['[Explore] do it', 'prompt: hi']);

	const longPrompt = 'x'.repeat(250);
	const long = ToolInputFormatter.format('Agent', { description: 'big', prompt: longPrompt });
	Assert.equal(long[0], '[agent] big');
	Assert.match(long[1], /prompt: x{200}… \(250 chars\)/);
});

test('unknown tools fall back to a pretty-printed JSON dump', () => {
	const lines = ToolInputFormatter.format('SomeUnknownTool', { alpha: 1, beta: 'two' });
	Assert.equal(lines.join('\n'), JSON.stringify({ alpha: 1, beta: 'two' }, null, 2));
});

import Chalk from 'chalk';

/**
 * Chalk color palette shared by every renderer. Colors are disabled globally by
 * setting `Chalk.level = 0` (via `--no-color`), which these bound functions
 * honor at call time.
 */
export const colors = {
	text: Chalk.white,
	tool: Chalk.cyan,
	system: Chalk.gray,
	error: Chalk.red,
	json: Chalk.dim,
	header: Chalk.yellow.bold,
	thinking: Chalk.gray.italic,
};

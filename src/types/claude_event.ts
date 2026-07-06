/**
 * A single content block inside an `assistant` or `user` message.
 *
 * The same shape covers every block kind (`text`, `thinking`, `tool_use`,
 * `tool_result`); only the fields relevant to a given `type` are populated.
 */
export type ContentBlock = {
	type?: string;
	text?: string;
	thinking?: string;
	id?: string;
	name?: string;
	input?: unknown;
	tool_use_id?: string;
	content?: string | Array<{ type?: string; text?: string }>;
	is_error?: boolean;
};

/** Raw, untyped input object of a `tool_use` block, keyed by parameter name. */
export type ToolInput = Record<string, unknown>;

/** Per-model usage aggregate, as found in the result event's `modelUsage` map. */
export type ModelUsage = {
	inputTokens?: number;
	outputTokens?: number;
	cacheReadInputTokens?: number;
	cacheCreationInputTokens?: number;
	costUSD?: number;
	contextWindow?: number;
};

/**
 * A consolidated Claude Code stream-json event (`system`, `assistant`, `user`,
 * `rate_limit_event`, `result`, …).
 *
 * Partial typing on purpose: only the fields the viewer reads are listed.
 * Anything unrecognized falls through to the unknown-event branch.
 */
export type ClaudeEvent = {
	type?: string;
	subtype?: string;
	cwd?: string;
	model?: string;
	tools?: string[];
	session_id?: string;
	claude_code_version?: string;
	message?: {
		content?: ContentBlock[];
		usage?: {
			input_tokens?: number;
			cache_read_input_tokens?: number;
			cache_creation_input_tokens?: number;
		};
	};
	rate_limit_info?: {
		status?: string;
	};
	result?: string;
	total_cost_usd?: number;
	duration_ms?: number;
	duration_api_ms?: number;
	num_turns?: number;
	is_error?: boolean;
	stop_reason?: string;
	permission_denials?: unknown[];
	terminal_reason?: string;
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
		cache_read_input_tokens?: number;
		cache_creation_input_tokens?: number;
	};
	modelUsage?: Record<string, ModelUsage>;
};

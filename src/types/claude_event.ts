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

export type ToolInput = Record<string, unknown>;

export type ModelUsage = {
	inputTokens?: number;
	outputTokens?: number;
	cacheReadInputTokens?: number;
	cacheCreationInputTokens?: number;
	costUSD?: number;
	contextWindow?: number;
};

// Partial typing on purpose: only fields we render are listed. Anything we
// don't recognize falls through to the unknown-event branch.
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

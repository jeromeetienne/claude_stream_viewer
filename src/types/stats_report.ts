/** Output format selected on the command line for the stats summary. */
export type StatsFormat = 'tty' | 'json' | 'markdown';

/** Token counts and cost attributed to a single model within a session. */
export type ModelTokens = {
	model: string;
	input: number;
	output: number;
	cacheRead: number;
	cacheCreate: number;
	costUsd?: number;
};

/**
 * Structured end-of-stream statistics assembled by {@link StatsCollector} from
 * the `result` event and the accumulators tracked across the stream.
 *
 * `latency` and `tokens` are absent when the stream had no `result` event
 * (see `truncated`); `context` and `tools` are always present because they are
 * derived from per-event accumulators.
 */
export type StatsReport = {
	/** True when no `result` event was seen (the stream was cut short). */
	truncated: boolean;
	result: {
		terminalReason?: string;
		stopReason?: string;
		isError: boolean;
		numTurns?: number;
		permissionDenials: number;
		durationMs?: number;
		totalCostUsd?: number;
	};
	/** Present only when the result event carried timing. */
	latency?: {
		wallMs: number;
		apiMs?: number;
		/** Wall time minus API time — local tool execution and overhead. */
		localMs?: number;
		throughputTokPerS?: number;
	};
	/** Present only when the result event carried usage. */
	tokens?: {
		input: number;
		output: number;
		cacheRead: number;
		cacheCreate: number;
		total: number;
		/** Cache reads as a percentage of all prompt tokens. */
		cacheHitPct: number;
		byModel: ModelTokens[];
	};
	context: {
		/** Largest single-message prompt (input + cache) seen in the stream. */
		peakPromptTokens: number;
		contextWindow?: number;
		peakPct?: number;
	};
	tools: {
		totalCalls: number;
		byTool: Array<{ name: string; count: number }>;
		resultCount: number;
		errorCount: number;
		errorPct: number;
	};
};

export type StatsFormat = 'text' | 'json' | 'markdown';

export type ModelTokens = {
	model: string;
	input: number;
	output: number;
	cacheRead: number;
	cacheCreate: number;
	costUsd?: number;
};

export type StatsReport = {
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
	latency?: {
		wallMs: number;
		apiMs?: number;
		localMs?: number;
		throughputTokPerS?: number;
	};
	tokens?: {
		input: number;
		output: number;
		cacheRead: number;
		cacheCreate: number;
		total: number;
		cacheHitPct: number;
		byModel: ModelTokens[];
	};
	context: {
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

import _ from "lodash";

export function arrayToString<T>(arr: T[]): string {
	return `[${arr.join(", ")}]`;
}

export function mean(arr: number[]): number {
	return _.sum(arr) / arr.length;
}

/**
 * Rounds a number to the nearest power of two
 * @param num (number) The number to round
 * @returns (number) The number rounded to the nearest power of two
 */
export function roundToPowerOfTwo(num: number) {
	const log = Math.log2(num);
	const lower = 2 ** Math.floor(log);
	const upper = 2 ** Math.ceil(log);
	const mean = (lower + upper) / 2;
	return num >= mean ? upper : lower;
}

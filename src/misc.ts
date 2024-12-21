import _ from "lodash";

export function arrayToString<T>(arr: T[]): string {
	return `[${arr.join(", ")}]`;
}

export function mean(arr: number[]): number {
	return _.sum(arr) / arr.length;
}

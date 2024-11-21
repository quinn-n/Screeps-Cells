function arrayToString<T>(arr: T[]): string {
	return `[${arr.join(", ")}]`;
}

export default { arrayToString };

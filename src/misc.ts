
function arrayToString<T>(arr: T[]): string {
    return `[${arr.join(', ')}]`;
}

module.exports = { arrayToString };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;

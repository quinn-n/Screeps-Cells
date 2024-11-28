/*
pixel.generator.js
Uses excess cpu to generate pixels
*/

function run() {
	if (Game.cpu.bucket + Game.cpu.limit >= 10000) {
		Game.cpu.generatePixel();
	}
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;

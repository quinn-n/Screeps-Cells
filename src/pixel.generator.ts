/*
pixel.generator.js
Uses excess cpu to generate pixels
*/

function run() {
	if (Game.cpu.bucket + Game.cpu.limit >= 10000) {
		Game.cpu.generatePixel();
	}
}

export default { run };

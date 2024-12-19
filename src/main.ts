import cleanup from "./cleanup";
import pixelGenerator from "./pixel.generator";

function loop() {
	cleanup.run();

	pixelGenerator.run();

	}
}

// Make sure the game can find the loop function
module.exports = { loop };

import cleanup from "./cleanup";
import pixelGenerator from "./pixel.generator";

import roleRoom from "./role.room";

function loop() {
	cleanup.run();

	pixelGenerator.run();

	for (const r in Game.rooms) {
		roleRoom.run(r);
	}
}

export default { loop };

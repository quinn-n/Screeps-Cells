import type { CellConfig } from "./config.cell";
import type { BaseCreep, RoomID } from "./types";

import cellConfig from "./config.cell";

//Moves a creep towards parking area
function park(creep: BaseCreep) {
	if (creep.room.name !== creep.memory.room) {
		goToRoom(creep, creep.memory.room);
	} else {
		const parkingArea = cellConfig[creep.room.name].PARKING;
		creep.moveTo(parkingArea.x, parkingArea.y, { maxRooms: 1 });
	}
}

function goToRoom(creep: Creep, room: RoomID) {
	const exit = creep.room.findExitTo(room);
	if (exit === ERR_NO_PATH) {
		console.log(`No path to room ${room}`);
		return;
	}
	if (exit === ERR_INVALID_ARGS) {
		console.error(`Invalid room name: ${room}`);
		return;
	}
	// biome-ignore lint/style/noNonNullAssertion: If exit is invalid, this won't run
	creep.moveTo(creep.pos.findClosestByRange(exit)!);
}

export default { park, goToRoom };

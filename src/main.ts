import Allocator from "./allocator";
import cleanup from "./cleanup";
import { createCreepInstance } from "./misc";
import pixelGenerator from "./pixel.generator";
import { BaseRoom } from "./room";

function loop() {
	cleanup.run();

	tickAllocator();
	tickRooms();
	tickCreeps();

	// pixelGenerator.run();
}

function tickAllocator() {
	const allocator = Allocator.Instance;

	allocator.tick();
}

function tickRooms() {
	for (const room of Object.values(Game.rooms).map((room) =>
		BaseRoom.fromRoom(room),
	)) {
		if (room.controller?.my) {
			room.tick();
		}
	}
}

function tickCreeps() {
	for (const creep of Object.values(Game.creeps).map((creep) =>
		createCreepInstance(creep),
	)) {
		creep.tick();
	}
}

// Make sure the game can find the loop function
module.exports = { loop };

import Allocator from "./allocator";
import cleanup from "./cleanup";
import type { BaseCreep } from "./creep.base";
import pixelGenerator from "./pixel.generator";
import type { BaseRoom } from "./room";

function loop() {
	cleanup.run();

	tickAllocator();
	tickRooms();
	tickCreeps();

	pixelGenerator.run();
}

function tickAllocator() {
	const allocator = Allocator.Instance;

	allocator.tick();
}

function tickRooms() {
	for (const room of Object.values(Game.rooms) as BaseRoom[]) {
		if (room.controller?.my) {
			room.tick();
		}
	}
}

function tickCreeps() {
	for (const creep of Object.values(Game.creeps) as BaseCreep[]) {
		creep.tick();
	}
}

// Make sure the game can find the loop function
module.exports = { loop };

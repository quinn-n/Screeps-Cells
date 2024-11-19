import type { CreepType } from "./role.room";
import type { BaseCreep } from "./types";

const _ = require("lodash");

/**
 * Calculates estimated work done per tick by a creep for a given role
 */
function creepWorkPerTick(creep: BaseCreep, role: CreepType) {
	return creep.getActiveBodyparts(WORK) * 2;
}

function workTimeRatio(creep: BaseCreep, role: CreepType) {
	const room = creep.room;
	// TODO: Move this to a role.room class function when it is created
	// Should be cached and updated when a new data point is added
	room.memory.averageTravelTime[role];
}

function freeExcessCreeps(role: CreepType, room: Room) {
	const creeps = _.filter(
		Game.creeps,
		(creep: BaseCreep) =>
			creep.memory.role === role && creep.memory.home === room.name,
	);
}

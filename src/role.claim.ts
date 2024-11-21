/*
role.claim.js
Functions to manage claim creeps
*/

import _ from "lodash";
import cellConfig from "./config.cell";
import utilityCreep from "./utility.creep";

import type { BaseCreep, RoomID } from "./types";

function run(creep: BaseCreep) {
	if (creep.memory.room === creep.memory.home || own(creep.memory.room)) {
		setRoom(creep);
	}

	if (creep.room.name !== creep.memory.room) {
		utilityCreep.goToRoom(creep, creep.memory.room);
		return;
	}

	const claimCfg = cellConfig[creep.memory.home].claim;

	const controller = creep.room.controller;
	if (controller === undefined) {
		console.log(
			`Claim creep ${creep.name} in room ${creep.room.name} has no controller. Please double-check config.`,
		);
		return;
	}
	if (claimCfg.CLAIM_ROOMS.includes(creep.room.name)) {
		const err = creep.claimController(controller);
		if (err === ERR_NOT_IN_RANGE) {
			creep.moveTo(controller, { maxRooms: 1 });
			console.log("Moving to controller");
			return;
		}
		if (err === OK) {
			return;
		}
		if (err === ERR_GCL_NOT_ENOUGH) {
			console.log(`GCL not enough to claim room ${creep.room.name}`);
			creep.reserveController(controller);
			return;
		}
		console.log(`Claim creep got error: ${err}`);
		return;
	}
	if (claimCfg.RESERVE_ROOMS.includes(creep.room.name)) {
		const err = creep.reserveController(controller);
		if (err === ERR_NOT_IN_RANGE) {
			creep.moveTo(controller, { maxRooms: 1 });
			return;
		}
		if (err === OK) {
			return;
		}
		console.log(`Claim creep got error: ${err}`);
	}
}

/*
Sets creep's room
*/
function setRoom(creep: BaseCreep) {
	const claimCfg = cellConfig[creep.memory.home].claim;
	const CLAIM_ROOMS = claimCfg.CLAIM_ROOMS;
	for (const roomID of CLAIM_ROOMS) {
		if (!hasCreepAssigned(roomID) && !own(roomID)) {
			creep.memory.room = roomID;
			return;
		}
	}
	const RESERVE_ROOMS = claimCfg.RESERVE_ROOMS;
	for (const roomID of RESERVE_ROOMS) {
		if (!hasCreepAssigned(roomID)) {
			creep.memory.room = roomID;
			return;
		}
	}
}

/*
Returns true if room is owned by the player
*/
function own(roomID: RoomID) {
	const room = Game.rooms[roomID];
	// If room is not visible, it is not owned or does not exist.
	if (room === undefined) {
		return false;
	}

	const controller = room.controller;

	// If room has no controller, it is not owned.
	if (controller === undefined) {
		return false;
	}

	return controller.my;
}

/*
Returns true if a given room has a reserve creep assigned to it
*/
function hasCreepAssigned(roomID: RoomID) {
	const creeps = _.filter(
		Game.creeps,
		(creep: BaseCreep) =>
			creep.memory.role === "reserve" && creep.memory.room === roomID,
	);
	return creeps.length > 0;
}

export default { run };

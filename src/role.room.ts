/*
cell role
manages a single cell
*/

import _ from "lodash";

import configCell from "./config.cell";
import utilityCreep from "./utility.creep";

import harvestSource from "./harvest.source";

import roleSpawn from "./role.spawn";
import roleTower from "./role.tower";
import roleLink from "./role.link";
import roleTerminal from "./role.terminal";

import roleHarvester from "./role.harvester";
import roleConstructor from "./role.constructor";
import roleUpgrader from "./role.upgrader";
import roleRepair from "./role.repair";
import roleSecurity from "./role.security";
import roleClaim from "./role.claim";
import roleLogistics from "./role.logistics";

import type { BaseCreep, RoomID } from "./types";

export type HARVESTER_CREEP = "harvester";
export type CONSTRUCTOR_CREEP = "constructor";
export type UPGRADER_CREEP = "upgrader";
export type REPAIR_CREEP = "repair";
export type SECURITY_CREEP = "security";
export type CLAIM_CREEP = "claim";
export type LOGISTICS_CREEP = "logistics";

export type CreepType =
	| HARVESTER_CREEP
	| CONSTRUCTOR_CREEP
	| UPGRADER_CREEP
	| REPAIR_CREEP
	| SECURITY_CREEP
	| CLAIM_CREEP
	| LOGISTICS_CREEP;

function run(roomID: RoomID) {
	runStructures(roomID);

	sendExtraditions(roomID);
	runCreeps(roomID);
}

/*
Runs creep functions
*/
function runCreeps(roomID: RoomID) {
	const creeps = _.filter(
		Game.creeps,
		(creep: BaseCreep) => creep.memory.home === roomID && !creep.spawning,
	);
	for (const creep of creeps) {
		if (creep.room.name !== creep.memory.room) {
			utilityCreep.goToRoom(creep, creep.memory.room);
			continue;
		}

		if (creep.memory.role === "harvester") {
			roleHarvester.run(creep);
		} else if (creep.memory.role === "constructor") {
			roleConstructor.run(creep);
		} else if (creep.memory.role === "upgrader") {
			roleUpgrader.run(creep);
		} else if (creep.memory.role === "repair") {
			roleRepair.run(creep);
		} else if (creep.memory.role === "security") {
			roleSecurity.run(creep);
		} else if (creep.memory.role === "claim") {
			roleClaim.run(creep);
		} else if (creep.memory.role === "logistics") {
			roleLogistics.run(creep);
		}
	}
}

/*
Runs all structures in a room
*/
function runStructures(roomID: RoomID) {
	spawnCreeps(roomID);
	runTowers(roomID);
	runLinks(roomID);
	runTerminal(roomID);
}

/*
Runs all terminals in a room
*/
function runTerminal(roomID: RoomID) {
	const terminals = _.filter(
		Game.rooms[roomID].find(FIND_MY_STRUCTURES),
		(structure: Structure) => structure.structureType === STRUCTURE_TERMINAL,
	);
	for (const t in terminals) {
		const term = terminals[t];
		roleTerminal.run(term);
	}
}

/*
Spawns creeps needed in a room
*/
function spawnCreeps(roomID: RoomID) {
	if (configCell[roomID] === undefined) {
		//console.log("Got no config for room " + roomID);
		return;
	}
	const spawnCfg = configCell[roomID].SPAWN;
	for (const role in spawnCfg) {
		const creepCfg = spawnCfg[role as CreepType];

		if (creepCfg === undefined) {
			continue;
		}

		const nCreeps = getCreepsForRoom(roomID, role as CreepType);

		if (nCreeps < creepCfg.N_CREEPS) {
			const err = roleSpawn.spawnCreep(roomID, role);
			if (err === OK || err === ERR_NOT_ENOUGH_ENERGY) {
				return;
			}
		}
	}
}

/*
Runs towers in a room
*/
function runTowers(roomID: RoomID) {
	const towers = _.filter(
		Game.rooms[roomID].find(FIND_MY_STRUCTURES),
		(structure: Structure) => structure.structureType === STRUCTURE_TOWER,
	);
	for (const t in towers) {
		const tower = towers[t];
		roleTower.run(tower);
	}
}

/*
Runs links in a room
*/
function runLinks(roomID: RoomID) {
	const links = _.filter(
		Game.rooms[roomID].find(FIND_MY_STRUCTURES),
		(structure: AnyOwnedStructure) =>
			structure.structureType === STRUCTURE_LINK,
	) as StructureLink[];
	for (const l in links) {
		const link = links[l];
		roleLink.run(link);
	}
}

/*
Send extradition creeps
*/
function sendExtraditions(homeRoom: RoomID) {
	if (configCell[homeRoom] === undefined) {
		return;
	}
	const extraditionCfg = configCell[homeRoom].EXTRADITED_CREEPS;
	for (const room in extraditionCfg) {
		const roomExtraditionCfg = extraditionCfg[room];
		for (const creepTypeStr in roomExtraditionCfg) {
			const creepType = creepTypeStr as CreepType;
			const typeCfg = roomExtraditionCfg[creepType];
			if (!typeCfg) {
				throw new Error(
					`typeCfg is undefined for ${creepType} in ${homeRoom} going to ${room}`,
				);
			}
			const creeps = _.filter(
				Game.creeps,
				(creep: BaseCreep) =>
					creep.memory.home === homeRoom &&
					creep.memory.room === creep.memory.home &&
					creep.memory.role === creepType,
			);
			const nExtradited = _.filter(
				Game.creeps,
				(creep: BaseCreep) =>
					creep.memory.home === homeRoom &&
					creep.memory.room === room &&
					creep.memory.role === creepType,
			).length;

			for (
				let i = 0;
				i < typeCfg.N_CREEPS - nExtradited && i < creeps.length;
				i++
			) {
				creeps[i].memory.room = room;
				if (creeps[i].memory.targetSource !== undefined) {
					harvestSource.clearTarget(creeps[i]);
				}
			}
		}
	}
}

/*
Returns the number of creeps belonging to a room
*/
function getCreepsForRoom(homeRoom: RoomID, role: CreepType) {
	let n = 0;
	for (const c in Game.creeps) {
		const creep = Game.creeps[c] as BaseCreep;
		if (creep.memory.home === homeRoom && creep.memory.role === role) {
			n++;
		}
	}
	return n;
}

export default { run };

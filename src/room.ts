import type { CreepType } from "./role.room";
import type { Ticker } from "./ticker";
import type { BaseCreep } from "./types";

interface BaseRoomMemory extends RoomMemory {
	_creepTravelTimes: {
		[key in CreepType]: number[];
	};
}

class BaseRoom extends Room implements Ticker {
	public tick() {}
	public getCreeps(role?: CreepType) {
		return this.find(FIND_MY_CREEPS, {
			filter: (creep: BaseCreep) => {
				if (creep.memory.home !== this.name) {
					return false;
				}
				if (!role) {
					return true;
				}
				return creep.memory.role === role;
			},
		});
	}
}

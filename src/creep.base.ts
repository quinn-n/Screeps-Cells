import type { CreepType } from "./role.room";
import type { RoomID } from "./types";

export interface BaseCreepMemory extends CreepMemory {
	role: CreepType;
	currentTask: BaseCreepTask;
	targetTask: BaseCreepTask;
	home: RoomID;
	room: RoomID;
	spawner: Id<StructureSpawn>;
	toRecycle: boolean;
}

export type BaseCreepTask = null;

class BaseCreep extends Creep {
	public tick() {
		if (this._shouldUpdateTask) {
			this._updateTask();
		}
	}

	private _updateTask() {
		this.currentTask = this.targetTask;
	}

	private get _shouldUpdateTask() {
		return (
			this.memory.currentTask === "harvesting" &&
			this.store.getFreeCapacity() === 0
		);
	}

	public get targetTask(): BaseCreepTask {
		return this.memory.targetTask;
	}
	public set targetTask(newTask: BaseCreepTask) {
		this.memory.targetTask = newTask;
	}

	public get currentTask(): BaseCreepTask {
		return this.memory.currentTask;
	}
	private set currentTask(newTask: BaseCreepTask) {
		this.memory.currentTask = newTask;
	}

	public memory: BaseCreepMemory = super.memory as BaseCreepMemory;
}

module.exports = { BaseCreep };

export default module.exports;

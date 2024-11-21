import type { WorkerCreepTask } from "./creep.worker";
import type { CreepType } from "./role.room";
import { BaseRoom } from "./room";
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

export type BaseCreepTask = "" | WorkerCreepTask;

export abstract class BaseCreep extends Creep {
	public abstract tick(): void;

	private park() {
		// TODO: Rooms should auto-generate parking spots
		this.moveTo(new RoomPosition(25, 25, this.memory.home));
	}

	private _updateTask() {
		this.currentTask = this.targetTask;
	}

	/**
	 * Should return true whenever it's a good time to update the creep's task
	 */
	protected abstract get _shouldUpdateTask(): boolean;

	public get targetTask(): BaseCreepTask {
		return this.memory.targetTask;
	}
	public set targetTask(newTask: BaseCreepTask) {
		this.memory.targetTask = newTask;
	}

	public get currentTask(): BaseCreepTask {
		return this.memory.currentTask;
	}
	protected set currentTask(newTask: BaseCreepTask) {
		this.memory.currentTask = newTask;
	}

	public memory: BaseCreepMemory = super.memory as BaseCreepMemory;
	public room: BaseRoom = new BaseRoom(this.memory.room);
}

module.exports = { BaseCreep };

export default module.exports;

import type { CreepTask, CreepType } from "./creep.types";
import { BaseRoom } from "./room";
import type { RoomID } from "./types";

export interface BaseCreepMemory extends CreepMemory {
	role: CreepType;
	currentTask: CreepTask;
	targetTask: CreepTask;
	home: RoomID;
	room: RoomID;
	spawner: Id<StructureSpawn>;
	toRecycle: boolean;
}

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

	public get targetTask(): CreepTask {
		return this.memory.targetTask;
	}
	public set targetTask(newTask: CreepTask) {
		this.memory.targetTask = newTask;
	}

	public get currentTask(): CreepTask {
		return this.memory.currentTask;
	}
	protected set currentTask(newTask: CreepTask) {
		this.memory.currentTask = newTask;
	}

	public memory: BaseCreepMemory = super.memory as BaseCreepMemory;
	public room: BaseRoom = BaseRoom.fromRoom(this.room);
}

export function generateCreepName(baseName: string) {
	return `${baseName}-${Game.time}`;
}

export default { BaseCreep };

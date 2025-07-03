import type { BaseCreepMemory, CreepTask } from "./creep.types";
import { BaseRoom } from "./room";

export abstract class BaseCreep extends Creep {
	public abstract tick(): void;

	private park() {
		// TODO: Rooms should auto-generate parking spots
		this.moveTo(new RoomPosition(25, 25, this.memory.home));
	}

	public get targetTask() {
		return this.memory.targetTask;
	}
	public set targetTask(newTask: CreepTask | undefined) {
		this.memory.targetTask = newTask;
	}

	public get currentTask() {
		return this.memory.currentTask;
	}
	protected set currentTask(newTask: CreepTask | undefined) {
		this.memory.currentTask = newTask;
	}

	public memory: BaseCreepMemory = super.memory as BaseCreepMemory;
	public room: BaseRoom = BaseRoom.fromRoom(this.room);
}

export function generateCreepName(baseName: string) {
	return `${baseName}-${Game.time}`;
}

export default { BaseCreep };

import { BaseCreep, type BaseCreepMemory } from "./creep.base";

export type WorkerCreepTask =
	| "harvesting"
	| "depositing"
	| "upgrading"
	| "building"
	| "repairing";

export interface WorkerCreepMemory extends BaseCreepMemory {
	targetSource: Id<Source> | null;
	currentTask: WorkerCreepTask;
}

export class WorkerCreep extends BaseCreep {
	public tick() {
		if (this.currentTask !== "harvesting") {
			this.memory.targetSource = null;
		}

		if (this.currentTask === "harvesting") {
			this._harvest();
		}

		if (this.currentTask === "depositing") {
			this._deposit();
		}

		if (this.store.getUsedCapacity() === 0) {
			this.currentTask = "harvesting";
		}
	}

	private _harvest() {
		// targetSource should be set by the allocator
		// TODO: Ask the allocator to find a new source in either of these cases.
		if (this.memory.targetSource === null) {
			console.error(
				`Creep ${this.name} in room ${this.room.name} has no target source!`,
			);
			return;
		}
		const source = Game.getObjectById(this.memory.targetSource);
		if (source === null) {
			console.error(
				`Creep ${this.name} in room ${this.room.name} has an invalid target source ${this.memory.targetSource}`,
			);
			return;
		}

		const harvestError = this.harvest(source);
		if (harvestError === ERR_NOT_IN_RANGE) {
			this.moveTo(source);
		}
		if (harvestError === ERR_NOT_ENOUGH_RESOURCES) {
			this.memory.targetSource = null;
		}
	}

	private _deposit(resource: ResourceConstant = RESOURCE_ENERGY) {
		const target = this.room.findStorageWithSpace(resource);
		if (target === ERR_FULL) {
			this.memory.targetTask = "";
			return;
		}

		const depositError = this.transfer(target, resource);
		if (depositError === ERR_NOT_IN_RANGE) {
			this.moveTo(target);
		}
	}

	protected findClosestAvailableSource() {
		const sources = this.room.getAvailableSources();
		return this.pos.findClosestByPath(sources);
	}

	/**
	 * Work creeps update their tasks when they're done harvesting, or when they have no task.
	 */
	protected get _shouldUpdateTask() {
		const justFinishedHarvesting =
			this.currentTask === "harvesting" && this.store.getFreeCapacity() === 0;

		const hasNoTask = this.currentTask === "";
		return justFinishedHarvesting || hasNoTask;
	}

	public memory: WorkerCreepMemory = this.memory;
}

import { BaseCreep, type BaseCreepMemory } from "./creep.base";

export type ROLE_WORKER = "worker";
export declare const ROLE_WORKER: ROLE_WORKER;

export type WORKER_TASK_HARVESTING = "harvesting";
export type WORKER_TASK_DEPOSITING = "depositing";
export type WORKER_TASK_UPGRADING = "upgrading";
export type WORKER_TASK_BUILDING = "building";
export type WORKER_TASK_REPAIRING = "repairing";

export declare const WORKER_TASK_HARVESTING: WORKER_TASK_HARVESTING;
export declare const WORKER_TASK_DEPOSITING: WORKER_TASK_DEPOSITING;
export declare const WORKER_TASK_UPGRADING: WORKER_TASK_UPGRADING;
export declare const WORKER_TASK_BUILDING: WORKER_TASK_BUILDING;
export declare const WORKER_TASK_REPAIRING: WORKER_TASK_REPAIRING;

export type WorkerCreepTask =
	| WORKER_TASK_HARVESTING
	| WORKER_TASK_DEPOSITING
	| WORKER_TASK_UPGRADING
	| WORKER_TASK_BUILDING
	| WORKER_TASK_REPAIRING;

export interface WorkerCreepMemory extends BaseCreepMemory {
	targetSource: Id<Source> | null;
	currentTask: WorkerCreepTask;
}

export class WorkerCreep extends BaseCreep {
	public tick() {
		if (this.currentTask === WORKER_TASK_HARVESTING) {
			this._harvest();
		}

		if (this.currentTask === WORKER_TASK_DEPOSITING) {
			this._deposit();
		}

		if (this.store.getUsedCapacity() === 0) {
			this.currentTask = WORKER_TASK_DEPOSITING;
		}
	}

	private _harvest() {
		// targetSource should be set by the allocator
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

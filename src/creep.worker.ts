import { BaseCreep, type BaseCreepMemory } from "./creep.base";

export type ROLE_WORKER_CREEP = "worker";
export const ROLE_WORKER_CREEP: ROLE_WORKER_CREEP = "worker";

export type WORKER_TASK_HARVESTING = "harvesting";
export type WORKER_TASK_DEPOSITING = "depositing";
export type WORKER_TASK_UPGRADING = "upgrading";
export type WORKER_TASK_BUILDING = "building";
export type WORKER_TASK_REPAIRING = "repairing";

export const WORKER_TASK_HARVESTING: WORKER_TASK_HARVESTING = "harvesting";
export const WORKER_TASK_DEPOSITING: WORKER_TASK_DEPOSITING = "depositing";
export const WORKER_TASK_UPGRADING: WORKER_TASK_UPGRADING = "upgrading";
export const WORKER_TASK_BUILDING: WORKER_TASK_BUILDING = "building";
export const WORKER_TASK_REPAIRING: WORKER_TASK_REPAIRING = "repairing";

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
	public static fromCreep(creep: Creep) {
		return new WorkerCreep(creep.id);
	}

	public tick() {
		if (this.currentTask === WORKER_TASK_HARVESTING) {
			const err = this._harvest();
			if (err !== OK || this.store.getFreeCapacity() === 0) {
				this.currentTask = WORKER_TASK_DEPOSITING;
				this.depositStartTime = Game.time;
			}
		}

		if (this.currentTask === WORKER_TASK_DEPOSITING) {
			const err = this._deposit();
			if (err !== OK || this.store.getUsedCapacity() === 0) {
				this.currentTask = WORKER_TASK_HARVESTING;
			}
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

		if (this.store.getFreeCapacity() === 0) {
			return ERR_FULL;
		}

		const harvestError = this.harvest(source);
		if (harvestError === ERR_NOT_IN_RANGE) {
			this.moveTo(source);
			return OK;
		}

		return harvestError;
	}

	private _deposit(resource: ResourceConstant = RESOURCE_ENERGY) {
		if (this.store[resource] === 0) {
			return ERR_NOT_ENOUGH_RESOURCES;
		}
		const target = this.room.findStorageWithSpace(resource);
		if (target === ERR_FULL) {
			return ERR_FULL;
		}

		const depositError = this.transfer(target, resource);
		if (depositError === ERR_NOT_IN_RANGE) {
			this.moveTo(target);
		}
		return OK;
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

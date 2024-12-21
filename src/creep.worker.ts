import Allocator from "./allocator";
import { BaseCreep, type BaseCreepMemory } from "./creep.base";
import {
	WORKER_TASK_DEPOSITING,
	WORKER_TASK_HARVESTING,
	type WorkerCreepTask,
} from "./creep.types";

export interface WorkerCreepMemory extends BaseCreepMemory {
	targetSource: Id<Source> | null;
	currentTask: WorkerCreepTask;
	depositStartTime: number;
}

export class WorkerCreep extends BaseCreep {
	public static fromCreep(creep: Creep) {
		return new WorkerCreep(creep.id);
	}

	public tick() {
		if (this.currentTask === WORKER_TASK_HARVESTING) {
			const err = this._harvest();
			if (err !== OK || this.store.getFreeCapacity() === 0) {
				console.log("Switching to deposit mode");
				this.currentTask = WORKER_TASK_DEPOSITING;
				this.depositStartTime = Game.time;
			}
		}

		if (this.currentTask === WORKER_TASK_DEPOSITING) {
			const err = this._deposit();
			if (err !== OK || this.store.getUsedCapacity() === 0) {
				console.log("Switching to harvest mode");
				this.currentTask = WORKER_TASK_HARVESTING;
				if (this.memory.targetSource === null) {
					console.log(
						`Creep ${this.name} in room ${this.room.name} has no target source!`,
					);
					return;
				}

				const timeTaken = Game.time - this.depositStartTime;
				// If the creep didn't spend any time depositing, storage is full.
				// So don't save the deposit time.
				// TODO: Clear task from creep so the allocator can reuse the creep.
				if (timeTaken === 0) {
					return;
				}

				const allocator = Allocator.Instance;
				allocator.addSourceDepositTime(
					this.memory.targetSource,
					this,
					Game.time - this.depositStartTime,
				);
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

	protected set depositStartTime(time: number) {
		this.memory.depositStartTime = time;
	}

	protected get depositStartTime() {
		return this.memory.depositStartTime;
	}

	public memory: WorkerCreepMemory = this.memory;
}

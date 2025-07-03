import _ from "lodash";
import { BaseCreep } from "./creep.base";
import {
	WORKER_TASK_DEPOSITING,
	WORKER_TASK_HARVESTING,
	WORKER_TASK_UPGRADING,
	type WorkerCreepMemory,
} from "./creep.types";
import { BaseRoom } from "./room";
import { addSourceDepositTime } from "./allocator";

export class WorkerCreep extends BaseCreep {
	public static fromCreep(creep: Creep) {
		return new WorkerCreep(creep.id);
	}

	public tick() {
		if (this.currentTask === undefined) {
			this.switchToTargetTask();
		}

		if (this.currentTask === WORKER_TASK_HARVESTING) {
			const err = this._harvest();
			if (err !== OK || this.store.getFreeCapacity() === 0) {
				if (this.targetTask === WORKER_TASK_HARVESTING) {
					this.startTime = Game.time;
					this.currentTask = WORKER_TASK_DEPOSITING;
				} else {
					this.switchToTargetTask();
				}
			}
		}

		if (this.currentTask === WORKER_TASK_DEPOSITING) {
			const err = this._deposit();
			if (err !== OK || this.store.getUsedCapacity() === 0) {
				this.currentTask = WORKER_TASK_HARVESTING;
				if (this.memory.targetSource === undefined) {
					console.log(
						`Creep ${this.name} in room ${this.room.name} has no target source!`,
					);
					return;
				}

				const timeTaken = Game.time - this.startTime;
				// If the creep didn't spend any time depositing, storage is full.
				// So don't save the deposit time.
				if (timeTaken === 0) {
					this.targetTask = undefined;
					this.switchToTargetTask();
					return;
				}

				addSourceDepositTime(
					this.memory.targetSource,
					this,
					Game.time - this.startTime,
				);
			}
		}

		if (this.currentTask === WORKER_TASK_UPGRADING) {
			// Clear targetSource after harvesting
			this.memory.targetSource = undefined;

			const err = this._upgradeController();
			if (err === ERR_NOT_ENOUGH_RESOURCES) {
				const collectionErr = this._collectResource(RESOURCE_ENERGY);
				// Harvest own energy if the room has none in storage
				if (collectionErr === ERR_NOT_ENOUGH_RESOURCES) {
					const source = this.findClosestSource();
					if (source === ERR_NOT_ENOUGH_RESOURCES) {
						console.log(
							`Creep ${this.name} in room ${this.room.name} has no sources to harvest from!`,
						);
						return;
					}
					this.memory.targetSource = source.id;
					this.currentTask = WORKER_TASK_HARVESTING;
				}
			}
		}
	}

	/**
	 * Find the closest source to the creep.
	 * Not inteded for mass harvesting once a storage structure exists; use the allocator for that.
	 * @returns {Source | number} - The closest source to the creep, or an error code if no sources are found.
	 */
	private findClosestSource() {
		const sources = this.room.find(FIND_SOURCES_ACTIVE);
		if (sources.length === 0) {
			return ERR_NOT_ENOUGH_RESOURCES;
		}
		sources.sort((a, b) => this.pos.getRangeTo(a) - this.pos.getRangeTo(b));
		return sources[0];
	}

	private switchToTargetTask() {
		this.currentTask = this.targetTask;
	}

	/**
	 * Harvest energy from source
	 * @returns {number} - ERR_FULL if the creep is full, OK if the creep is harvesting, or the error code from Creep.harvest
	 */
	private _harvest(): number {
		const sourceId = this.memory.targetSource;

		// targetSource should be set by the allocator
		if (sourceId === undefined) {
			console.log(
				`Creep ${this.name} in room ${this.room.name} has no target source!`,
			);
			return ERR_INVALID_ARGS;
		}
		const source = Game.getObjectById(sourceId);
		if (source === null) {
			console.log(
				`Creep ${this.name} in room ${this.room.name} has an invalid target source ${this.memory.targetSource}`,
			);
			return ERR_INVALID_TARGET;
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

	/**
	 * Collect a resource from the room.
	 * Pull from storage if the room has it, otherwise
	 * harvest from a source.
	 * @param {ResourceConstant} resource - The resource to collect
	 * @returns {number} - OK if the resource was collected, or ERR_NOT_ENOUGH_RESOURCES if the resource couldn't be found
	 */
	private _collectResource(resource: ResourceConstant) {
		const storageStructures = this.room.find(FIND_STRUCTURES, {
			filter: (structure) => {
				const isRightType =
					structure.structureType === STRUCTURE_STORAGE ||
					structure.structureType === STRUCTURE_CONTAINER ||
					structure.structureType === STRUCTURE_LINK;

				if (!isRightType) {
					return false;
				}

				if (structure.store[resource] === 0) {
					return false;
				}

				return true;
			},
		});

		storageStructures.sort(
			(a, b) => this.pos.getRangeTo(a) - this.pos.getRangeTo(b),
		);

		for (const structure of storageStructures) {
			const err = this.withdraw(structure, resource);
			if (err === ERR_NOT_IN_RANGE) {
				const moveErr = this.moveTo(structure);
				// Skip this structure if the creep can't get to it
				if (moveErr === ERR_NO_PATH) {
					continue;
				}

				return OK;
			}

			if (err === OK) {
				return OK;
			}
		}

		return ERR_NOT_ENOUGH_RESOURCES;
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

	private _upgradeController() {
		const controller = this.room.controller;
		if (controller === undefined) {
			return ERR_NOT_FOUND;
		}

		if (this.store[RESOURCE_ENERGY] === 0) {
			return ERR_NOT_ENOUGH_RESOURCES;
		}

		const upgradeError = this.upgradeController(controller);
		if (upgradeError === ERR_NOT_IN_RANGE) {
			this.moveTo(controller);
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

	protected set startTime(time: number) {
		this.memory.startTime = time;
	}

	protected get startTime() {
		return this.memory.startTime;
	}

	public memory: WorkerCreepMemory = this.memory;
	public room: BaseRoom = BaseRoom.fromRoom(this.room);
}

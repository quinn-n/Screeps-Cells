/*
 * role.terminal.js
 * Code to manage terminals
 * Written by Quinn Neufeld
 */

import type { CellConfig } from "./config.cell";

const _ = require("lodash");

const cellConfig: CellConfig = require("./config.cell");

function run(terminal: StructureTerminal) {
	const TERM_CFG = cellConfig[terminal.room.name].TERMINAL;
	if (TERM_CFG === undefined) {
		return;
	}
	for (const resourceString in TERM_CFG) {
		const resource = resourceString as ResourceConstant;
		const RESOURCE_CFG = TERM_CFG[resource];

		// `RESOURCE_CFG` will always be defined because it's pulled from `TERM_CFG`, which is what's being iterated over.
		// This check is here to satisfy TypeScript.
		if (!RESOURCE_CFG) {
			throw Error(
				`Resource config for ${resource} in room ${terminal.room.name} is undefined`,
			);
		}

		//Attempt to sell resources for min_price if there's more in store than the max
		if (
			RESOURCE_CFG.sell !== undefined &&
			terminal.store[resource] > RESOURCE_CFG.sell.max
		) {
			const gameOrders = Game.market.getAllOrders({
				type: ORDER_BUY,
				resourceType: resource,
			});
			const orders = _.filter(
				gameOrders,
				(order: Order) => order.price >= RESOURCE_CFG.sell.min_price,
			);
			if (orders.length) {
				sortByPrice(orders);
				const ord = orders[0];
				let amount = terminal.store[resource] - RESOURCE_CFG.sell.min;
				if (ord.amount < amount) {
					amount = ord.amount;
				}
				if (resource === RESOURCE_ENERGY) {
					const energy_cost = Game.market.calcTransactionCost(
						amount,
						terminal.room.name,
						ord.roomName,
					);
					if (
						terminal.store[resource] - RESOURCE_CFG.sell.min <
						amount + energy_cost
					) {
						amount =
							terminal.store[resource] - RESOURCE_CFG.sell.min - energy_cost;
					}
				}
				console.log(
					`Terminal in room ${terminal.room.name} attempting to sell ${amount} ${resource}`,
				);
				const dealErr = Game.market.deal(ord.id, amount, terminal.room.name);
				if (dealErr !== OK && dealErr !== ERR_TIRED) {
					console.log(
						`Game.market.deal in role.termainal.js got error ${dealErr}`,
					);
				}
			}
		}
		//Attempt to buy resources if there's less in store than the minimum
		else if (
			RESOURCE_CFG.buy !== undefined &&
			terminal.store[resource] < RESOURCE_CFG.buy.min
		) {
			const gameOrders = Game.market.getAllOrders({
				type: ORDER_SELL,
				resourceType: resource,
			});
			const orders = _.filter(
				gameOrders,
				(order: Order) => order.price <= RESOURCE_CFG.buy.max_price,
			);
			if (orders.length) {
				sortByPrice(orders);
				orders.reverse();
				const ord = orders[0];
				let amount = RESOURCE_CFG.buy.max - terminal.store[resource];
				if (ord.amount < amount) {
					amount = ord.amount;
				}
				const dealErr = Game.market.deal(ord.id, amount, terminal.room.name);
				if (dealErr !== OK) {
					console.log(
						`Game.market.deal in role.termainal.js got error ${dealErr}`,
					);
				}
			}
		}
	}
}

/**
 * Returns the order with the highest price in the list
 */
function sortByPrice(orders: Order[]) {
	let e = orders.length - 1;
	while (e > 0) {
		for (let i = 0; i < e; i++) {
			if (orders[i].price > orders[i + 1].price) swap(orders, i, i + 1);
		}
		e--;
	}
}

/**
 * Swaps two elements in a list
 */
function swap<T>(list: T[], x: number, y: number) {
	const c = list[x];
	list[x] = list[y];
	list[y] = c;
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;

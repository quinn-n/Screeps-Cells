
/*
role.tower.js
Functions to manage towers
*/

import type { CellConfig } from "./config.cell";

const _ = require("lodash");

const cellConfig: CellConfig = require("./config.cell");

function run(tower: StructureTower) {
    const TWR_CFG = cellConfig[tower.room.name].TOWERS;

    //Attack first possible hostile creep
    const hostileCreeps = tower.room.find(FIND_HOSTILE_CREEPS);
    for (const creep of hostileCreeps) {
        const attackErr = tower.attack(creep);
        if (attackErr === OK) {
            return;
        }
    }

    //Repair structures if repair is enabled
    if (TWR_CFG.REPAIR_ENABLED) {
        const damagedStructures = _.filter(tower.room.find(FIND_MY_STRUCTURES), (structure: Structure) => structure.hits < structure.hitsMax);
        for (const structure of damagedStructures) {
            const repairErr = tower.repair(structure);
            if (repairErr === OK) {
                return;
            }
        }
    }

    //Heal friendly creeps if healing is enabled
    if (TWR_CFG.HEAL_ENABLED) {
        const damagedCreeps = _.filter(tower.room.find(FIND_MY_CREEPS), (creep: Creep) => creep.hits < creep.hitsMax);
        for (const creep of damagedCreeps) {
            const healErr = tower.heal(creep);
            if (healErr === OK) {
                return;
            }
        }
    }
}

module.exports = { run }; 

// This just makes sure that typescript recognises the file as a module.
export default module.exports;

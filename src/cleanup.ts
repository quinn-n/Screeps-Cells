
/**
 * @module cleanup
 * Cleanup functions for things like dead creeps
 */

function run() {
    for (const c in Memory.creeps) {
        if (!Game.creeps[c]) {
            console.log(`Freeing memory from creep ${c}`);
            delete Memory.creeps[c];
        }
    }
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;

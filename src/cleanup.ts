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

export default { run };

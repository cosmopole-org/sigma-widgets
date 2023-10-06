
import Creature from "./Creature"
import Func from "./Func"

class CreatureStore {

    _store
    putCreature(creature) { this._store[creature.key] = creature }
    removeCreature(key) { delete this._store[key] }
    findCreature(key) { return this._store[key] }

    constructor() {
        this._store = {}
    }
}

export default CreatureStore

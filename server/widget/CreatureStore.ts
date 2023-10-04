
import Creature from "./Creature"
import Func from "./Func"

class CreatureStore {

    private _store: { [id: string]: Creature }
    public putCreature(creature: Creature) { this._store[creature.key] = creature }
    public removeCreature(key: string) { delete this._store[key] }
    public findCreature(key: string) { return this._store[key] }

    constructor() {
        this._store = {}
    }
}

export default CreatureStore

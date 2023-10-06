
import Func from "./Func"

class MemoryLayer {

    _units
    get units() { return this._units }
    findUnit(key) { return this._units[key] }
    putUnit(key, unit) { this._units[key] = unit }
    removeUnit(key) { delete this._units[key] }

    constructor(initialUnits) {
        this._units = initialUnits ? initialUnits : {}
    }
}

export default MemoryLayer

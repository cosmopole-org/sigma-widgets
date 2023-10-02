
import Func from "./Func"

class MemoryLayer {

    private _units: { [id: string]: any }
    public get units() { return this._units }
    public findUnit(key: string) { return this._units[key] }
    public putUnit(key: string, unit: any) { this._units[key] = unit }
    public removeUnit(key: string) { delete this._units[key] }

    constructor(initialUnits?: { [id: string]: any }) {
        this._units = initialUnits ? initialUnits : {}
    }
}

export default MemoryLayer

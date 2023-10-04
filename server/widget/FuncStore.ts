import Func from "./Func"

class FuncStore {

    private _store: { [id: string]: Func }
    public get store() { return this._store }
    public putFunc(func: Func) { this._store[func.key] = func }
    public removeFunc(key: string) { delete this._store[key] }
    public findFunc(key: string) { return this._store[key] }

    constructor() {
        this._store = {}
    }
}

export default FuncStore

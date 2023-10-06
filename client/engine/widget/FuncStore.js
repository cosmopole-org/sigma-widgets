import Func from "./Func"

class FuncStore {

    _store
    get store() { return this._store }
    putFunc(func) { this._store[func.key] = func }
    removeFunc(key) { delete this._store[key] }
    findFunc(key) { return this._store[key] }

    constructor() {
        this._store = {}
    }
}

export default FuncStore

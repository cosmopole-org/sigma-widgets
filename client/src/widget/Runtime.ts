
import Func from './Func'
import Module from './Module'

class Runtime {

    _module: Module
    public get module() { return this._module }

    private _funcs: { [id: string]: Func }
    public findFunc(key: string) { return this._funcs[key] }
    public putFunc(func: Func) { this._funcs[func.key] = func }
    public removeFunc(key: string) { delete this._funcs[key] }

    constructor(module: Module, funcs?: { [id: string]: Func }) {
        this._module = module
        this._funcs = funcs ? funcs : {}
    }
}

export default Runtime


import Module from "./Module"

class INative {
    
    private _module: Module
    public get key() { return this._module.key }

    constructor(module: Module) {
        this._module = module
    }
}

export default INative

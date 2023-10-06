
import Module from "./Module"

class INative {
    
    _module
    get key() { return this._module.key }

    constructor(module) {
        this._module = module
    }
}

export default INative

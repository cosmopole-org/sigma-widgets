
import Module from './Module'
import BaseElement from './elements/BaseElement'

class DOM {

    _module: Module

    _root?: BaseElement
    public get root() { return this._root }
    public setRoot(root: BaseElement) { this._root = root }

    constructor(module: Module, root?: BaseElement) {
        this._module = module
        this._root = root
    }
}

export default DOM

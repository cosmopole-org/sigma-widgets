
import Creature from './Creature'
import Module from './Module'
import BaseElement from './elements/BaseElement'

class DOM {

    _module
    get module() { return this._module }

    _creature
    get creature() { return this._creature }

    _root
    get root() { return this._root }
    setRoot(root) { this._root = root }

    constructor(module, creature, root) {
        this._module = module
        this._creature = creature
        this._root = root
    }
}

export default DOM

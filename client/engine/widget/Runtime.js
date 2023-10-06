
import Creature from './Creature'
import INative from './INative'
import MemoryLayer from './MemoryLayer'
import Memory from './MemoryLayer'
import Module from './Module'
import Utils from './utils'

class Runtime {

    _module
    get module() { return this._module }

    _creature
    get creature() { return this._creature }

    _native
    get native() { return this._native }

    stack = []
    pushOnStack(initialUnits) { this.stack.push(new MemoryLayer(initialUnits)) }
    popFromStack() { this.stack.pop() }
    get stackTop() { return this.stack[this.stack.length - 1] }
    resetStack() {
        this.stack = []
        this.pushOnStack({ ...this._native })
    }

    reset() {
        this.resetStack()
    }

    execute(ast) {
        Utils.executor.executeBlock(ast, new Utils.executor.ExecutionMeta({ creature: this._creature }))
    }

    load() {
        this.execute(this.module.ast.body.body)
    }

    clone() {
        let copy = new Runtime(this.module, this.creature, { native: this.native, stack: new Array(...this.stack) })
        return copy
    }

    constructor(module, creature, reusableTools) {
        this._module = module
        this._creature = creature
        this._native = reusableTools?.native ? reusableTools.native : this._module.applet._nativeBuilder(this._module)
        if (reusableTools?.stack) {
            this.stack = reusableTools.stack
        } else {
            this.reset()
        }
    }
}


export default Runtime

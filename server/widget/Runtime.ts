
import Creature from './Creature'
import INative from './INative'
import MemoryLayer from './MemoryLayer'
import Memory from './MemoryLayer'
import Module from './Module'
import Utils from './utils'

class Runtime {

    private _module: Module
    public get module() { return this._module }

    private _creature: Creature
    public get creature() { return this._creature }

    private _native: INative
    public get native() { return this._native }

    public stack: Array<Memory> = []
    public pushOnStack(initialUnits?: { [id: string]: any }) { this.stack.push(new MemoryLayer(initialUnits)) }
    public popFromStack() { this.stack.pop() }
    public get stackTop() { return this.stack[this.stack.length - 1] }
    public resetStack() {
        this.stack = []
        this.pushOnStack({ ...this._native })
    }

    public reset() {
        this.resetStack()
    }

    public execute(ast: any) {
        Utils.executor.executeBlock(ast, new Utils.executor.ExecutionMeta({ creature: this._creature }))
    }

    public load() {
        this.execute(this.module.ast.body.body)
    }

    public clone() {
        let copy = new Runtime(this.module, this.creature, { native: this.native, stack: new Array(...this.stack) })
        return copy
    }

    constructor(module: Module, creature?: Creature, reusableTools?: any) {
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


import INative from './INative'
import MemoryLayer from './MemoryLayer'
import Memory from './MemoryLayer'
import Module from './Module'
import Utils from './utils'

class Runtime {

    private _module: Module
    public get module() { return this._module }

    private _native: INative
    public get native() { return this._native }

    private _stack: Array<Memory>
    public get stack() { return this._stack }
    public pushOnStack(initialUnits?: { [id: string]: any }) { this._stack.push(new MemoryLayer(initialUnits)) }
    public get stackTop() { return this._stack[this._stack.length - 1] }
    public resetStack() {
        this._stack = []
        this.pushOnStack(this._native)
    }

    public reset() {
        this.resetStack()
    }

    public execute(ast: any) {
        Utils.executor.executeBlock(ast, new Utils.executor.ExecutionMeta({ module: this._module }))
    }

    public load() {
        this.execute(this.module.ast.body.body)
    }

    constructor(module: Module) {
        this._module = module
        this._native = this._module.applet._nativeBuilder(this._module)
        this.reset()
    }
}


export default Runtime


import DOM from "./DOM"
import Module from "./Module"
import Runtime from "./Runtime"
import Utils from './utils'

class Creature {

    private _key: string
    public get key() { return this._key }

    private _module: Module
    public get module() { return this._module }

    private _runtime: Runtime
    public get runtime() { return this._runtime }

    private _dom: DOM
    public get dom() { return this._dom }

    constructor(module: Module, defaultValues?: any) {
        this._key = defaultValues?.key ? defaultValues.key : Utils.generator.generateKey()
        this._module = module
        this._dom = defaultValues?.dom ? defaultValues.dom : new DOM(this._module, this)
        this._runtime = defaultValues?.runtime ? defaultValues.runtime : new Runtime(this._module, this)
        if (!defaultValues?.runtime) {
            this._runtime.load()
            this._runtime.stack[0].findUnit('constructor')()
        }
    }
}

export default Creature

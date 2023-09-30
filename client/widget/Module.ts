
import Applet from "./Applet"
import DOM from "./DOM"
import Runtime from "./Runtime"
import Utils from './utils'

class Module {

    private _applet: Applet
    public get applet() { return this._applet }
    public setApplet(applet: Applet) { this._applet = applet }

    private _key: string
    get key() { return this._key }

    private _runtime: Runtime
    public get runtime() { return this._runtime }

    private _dom: DOM
    public get dom() { return this._dom }

    private _ast?: any
    public get ast() { return this._ast }
    public setAst(ast: any) { this._ast = ast }

    public instantiate() {
        this._dom = new DOM(this)
        this._runtime = new Runtime(this)
        this.runtime.load()
    }

    constructor(key: string, applet: Applet, ast?: any) {
        this._key = key
        this._applet = applet
        this._ast = ast
    }
}

export default Module

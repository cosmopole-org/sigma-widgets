
import Utils from './utils'

class Func {

    private _key: string
    public get key() { return this._key }

    private _code: string
    public get code() { return this._code }
    public setCode(code: string) { this._code = code }

    private _ast?: object
    public get ast() { return this._ast }
    public setAst(ast: object) { this._ast = ast }

    constructor(code: string, ast?: object) {
        this._key = Utils.generator.generateKey()
        this._code = code
        this._ast = ast
    }
}

export default Func

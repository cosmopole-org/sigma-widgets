
import Utils from './utils'

class Func {

    _key
    get key() { return this._key }

    _code
    get code() { return this._code }
    setCode(code) { this._code = code }

    _ast
    get ast() { return this._ast }
    setAst(ast) { this._ast = ast }

    constructor(code, ast) {
        this._key = Utils.generator.generateKey()
        this._code = code
        this._ast = ast
    }
}

export default Func

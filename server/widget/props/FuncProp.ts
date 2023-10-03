
import BaseProp from './BaseProp'

class FuncProp extends BaseProp {

    _value?: string
    public get value() { return this._value }
    public setValue(v: any) { this._value = v}

    _defaultValue: string
    public get defaultValue() { return this._defaultValue }

    constructor(defaultValue: string) {
        super('function')
        this._value = defaultValue
        this._defaultValue = defaultValue
    }
}

export default FuncProp

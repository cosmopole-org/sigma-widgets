
import BaseProp from './BaseProp'

class BooleanProp extends BaseProp {

    _value
    get value() { return this._value }
    setValue(v) { this._value = v}

    _defaultValue
    get defaultValue() { return this._defaultValue }

    constructor(defaultValue) {
        super('boolean')
        this._value = defaultValue
        this._defaultValue = defaultValue
    }
}

export default BooleanProp

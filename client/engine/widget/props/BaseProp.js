
class BaseProp {

    _type
    get type() { return this._type }

    setValue(value) {}

    constructor(type) {
        this._type = type
    }
}

export default BaseProp

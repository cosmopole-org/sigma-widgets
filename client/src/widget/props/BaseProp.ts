
class BaseProp {

    _type: string
    public get type() { return this._type }

    constructor(type: string) {
        this._type = type
    }
}

export default BaseProp

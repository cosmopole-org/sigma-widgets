import BaseProp from "../props/BaseProp";

class BaseElement {

    private _controlType: string
    public get controlType() { return this._controlType }

    public _props: { [key: string]: BaseProp }
    get props() { return this._props }

    public _styles: { [key: string]: any }
    get styles() { return this._styles }

    public _children: Array<BaseElement>
    get children() { return this._children }

    constructor(
        controlType: string,
        props: { [key: string]: BaseProp },
        styles: { [key: string]: any },
        children?: Array<BaseElement>
    ) {
        this._controlType = controlType
        this._props = props;
        this._styles = styles
        this._children = children ? children : []
    }
}

export default BaseElement

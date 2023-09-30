import BaseProp from "../props/BaseProp";

class BaseElement {

    _props: { [key: string]: BaseProp }
    get props() { return this._props }

    _styles: { [key: string]: any }
    get styles() { return this._styles }

    _children: Array<BaseElement>
    get children() { return this._children }

    constructor(
        props: { [key: string]: BaseProp },
        styles: { [key: string]: any },
        children?: Array<BaseElement>
    ) {
        this._props = props;
        this._styles = styles
        this._children = children ? children : []
    }
}

export default BaseElement

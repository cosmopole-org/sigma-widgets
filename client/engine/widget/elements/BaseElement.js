import BaseProp from "../props/BaseProp";
import styleToCssString from '../utils/convertStylesToCss'

class BaseElement {

    _key
    get key() { return this._key }

    _controlType
    get controlType() { return this._controlType }

    _props
    get props() { return this._props }

    _styles
    get styles() { return this._styles }

    _children
    get children() { return this._children }

    constructor(
        key,
        controlType,
        props,
        styles,
        children
    ) {
        this._key = key
        this._controlType = controlType
        this._props = props;
        this._styles = styleToCssString(styles)
        this._children = children ? children : []
    }
}

export default BaseElement

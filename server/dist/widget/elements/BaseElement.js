"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BaseElement {
    get key() { return this._key; }
    get controlType() { return this._controlType; }
    get props() { return this._props; }
    get styles() { return this._styles; }
    get children() { return this._children; }
    constructor(key, controlType, props, styles, children) {
        this._key = key;
        this._controlType = controlType;
        this._props = props;
        this._styles = styles;
        this._children = children ? children : [];
    }
}
exports.default = BaseElement;
//# sourceMappingURL=BaseElement.js.map
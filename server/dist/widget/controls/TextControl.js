"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseControl_1 = require("./BaseControl");
const StringProp_1 = require("../props/StringProp");
const utils_1 = require("../utils");
class TextControl extends BaseControl_1.default {
    static instantiate(overridenProps, overridenStyles, children) {
        return utils_1.default.generator.prepareElement(TextControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
    }
}
TextControl.TYPE = 'text';
TextControl.defaultProps = {
    text: new StringProp_1.default('')
};
TextControl.defaultStyles = {
    width: 150,
    height: 'auto'
};
exports.default = TextControl;
//# sourceMappingURL=TextControl.js.map
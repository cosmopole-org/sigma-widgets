/******/ (function() { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./cssProperty.ts":
/*!************************!*\
  !*** ./cssProperty.ts ***!
  \************************/
/***/ (function(__unused_webpack_module, exports) {


Object.defineProperty(exports, "__esModule", ({ value: true }));
var isUnitlessNumber = {
    boxFlex: true,
    boxFlexGroup: true,
    columnCount: true,
    flex: true,
    flexGrow: true,
    flexPositive: true,
    flexShrink: true,
    flexNegative: true,
    fontWeight: true,
    lineClamp: true,
    lineHeight: true,
    opacity: true,
    order: true,
    orphans: true,
    widows: true,
    zIndex: true,
    zoom: true,
    fillOpacity: true,
    strokeDashoffset: true,
    strokeOpacity: true,
    strokeWidth: true
};
function prefixKey(prefix, key) {
    return prefix + key.charAt(0).toUpperCase() + key.substring(1);
}
var prefixes = ['Webkit', 'ms', 'Moz', 'O'];
Object.keys(isUnitlessNumber).forEach(function (prop) {
    prefixes.forEach(function (prefix) {
        isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
    });
});
var shorthandPropertyExpansions = {
    background: {
        backgroundImage: true,
        backgroundPosition: true,
        backgroundRepeat: true,
        backgroundColor: true
    },
    border: {
        borderWidth: true,
        borderStyle: true,
        borderColor: true
    },
    borderBottom: {
        borderBottomWidth: true,
        borderBottomStyle: true,
        borderBottomColor: true
    },
    borderLeft: {
        borderLeftWidth: true,
        borderLeftStyle: true,
        borderLeftColor: true
    },
    borderRight: {
        borderRightWidth: true,
        borderRightStyle: true,
        borderRightColor: true
    },
    borderTop: {
        borderTopWidth: true,
        borderTopStyle: true,
        borderTopColor: true
    },
    font: {
        fontStyle: true,
        fontVariant: true,
        fontWeight: true,
        fontSize: true,
        lineHeight: true,
        fontFamily: true
    }
};
var CSSProperty = {
    isUnitlessNumber: isUnitlessNumber,
    shorthandPropertyExpansions: shorthandPropertyExpansions
};
exports["default"] = CSSProperty;


/***/ }),

/***/ "./hyphenateStyleName.ts":
/*!*******************************!*\
  !*** ./hyphenateStyleName.ts ***!
  \*******************************/
/***/ (function(__unused_webpack_module, exports) {


Object.defineProperty(exports, "__esModule", ({ value: true }));
var msPattern = /^ms-/;
var _uppercasePattern = /([A-Z])/g;
function hyphenate(string) {
    return string.replace(_uppercasePattern, '-$1').toLowerCase();
}
function hyphenateStyleName(string) {
    return hyphenate(string).replace(msPattern, '-ms-');
}
exports["default"] = hyphenateStyleName;


/***/ }),

/***/ "./native.ts":
/*!*******************!*\
  !*** ./native.ts ***!
  \*******************/
/***/ (function(__unused_webpack_module, exports) {


Object.defineProperty(exports, "__esModule", ({ value: true }));
class Native {
    constructor(module, controls) {
        this.globalMemory = {};
        this.intervals = {};
        this.timeouts = {};
        this.controls = {};
        this.module = undefined;
        this.nativeElement = (compType, props, styles, children) => {
            let control = this.controls[compType];
            let c = control.instantiate(props, styles, children);
            return c;
        };
        this.Object = {
            keys: (obj) => {
                return Object.keys(obj);
            },
            values: (obj) => {
                return Object.values(obj);
            }
        };
        this.alert = (str) => {
            window.alert(str);
        };
        this.console = {
            log: (...strs) => {
                console.log(...strs);
            }
        };
        this.setInterval = (callback, period) => {
            this.intervals[setInterval(callback, period) + ''] = true;
        };
        this.setTimeout = (callback, timeout) => {
            this.timeouts[setTimeout(callback, timeout) + ''] = true;
        };
        this.module = module;
        this.controls = controls;
    }
}
exports["default"] = Native;


/***/ }),

/***/ "./uiBuilder.ts":
/*!**********************!*\
  !*** ./uiBuilder.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const cssProperty_1 = __webpack_require__(/*! ./cssProperty */ "./cssProperty.ts");
const hyphenateStyleName_1 = __webpack_require__(/*! ./hyphenateStyleName */ "./hyphenateStyleName.ts");
let { isUnitlessNumber } = cssProperty_1.default;
var isArray = Array.isArray;
var keys = Object.keys;
var counter = 1;
var unquotedContentValueRegex = /^(normal|none|(\b(url\([^)]*\)|chapter_counter|attr\([^)]*\)|(no-)?(open|close)-quote|inherit)((\b\s*)|$|\s+))+)$/;
function buildRule(key, value) {
    if (!isUnitlessNumber[key] && typeof value === 'number') {
        value = '' + value + 'px';
    }
    else if (key === 'content' && !unquotedContentValueRegex.test(value)) {
        value = "'" + value.replace(/'/g, "\\'") + "'";
    }
    return (0, hyphenateStyleName_1.default)(key) + ': ' + value + ';  ';
}
function buildValue(key, value) {
    if (!isUnitlessNumber[key] && typeof value === 'number') {
        value = '' + value + 'px';
    }
    else if (key === 'content' && !unquotedContentValueRegex.test(value)) {
        value = "'" + value.replace(/'/g, "\\'") + "'";
    }
    return value + '';
}
function styleToCssString(rules) {
    var result = '';
    if (!rules || keys(rules).length === 0) {
        return result;
    }
    var styleKeys = keys(rules);
    for (var j = 0, l = styleKeys.length; j < l; j++) {
        var styleKey = styleKeys[j];
        var value = rules[styleKey];
        if (isArray(value)) {
            for (var i = 0, len = value.length; i < len; i++) {
                result += buildRule(styleKey, value[i]);
            }
        }
        else {
            result += buildRule(styleKey, value);
        }
    }
    return result;
}
class UiBuilder {
    constructor() {
        this.bindings = {};
    }
    createElement(controlType, tag, props, styles, control) {
        let element = document.createElement(tag);
        for (let key in props) {
            element[key] = props[key];
        }
        element.style.cssText = styleToCssString(styles);
        this.bindings[props.cosmoId] = { rendered: element, controlType, control };
        return element;
    }
    build(element, parentKey) {
        var _a, _b, _c, _d, _e, _f;
        if (element === undefined)
            return undefined;
        let result = undefined;
        if (typeof element === 'string' || typeof element === 'number' || typeof element === 'boolean') {
            let span = document.createElement('span');
            span.textContent = element.toString();
            result = span;
        }
        else {
            switch (element._controlType) {
                case 'text': {
                    result = this.createElement('text', 'span', {
                        cosmoId: element._key,
                        textContent: (_a = element._props.text) === null || _a === void 0 ? void 0 : _a._value
                    }, element._styles, element);
                    break;
                }
                case 'box': {
                    result = this.createElement('box', 'div', {
                        cosmoId: element._key,
                    }, element._styles, element);
                    element._children.forEach((c) => {
                        let childEl = this.build(c);
                        if (childEl !== undefined) {
                            result === null || result === void 0 ? void 0 : result.appendChild(childEl);
                        }
                    });
                    break;
                }
                case 'card': {
                    result = this.createElement('card', 'div', {
                        cosmoId: element._key,
                    }, element._styles, element);
                    element._children.forEach(c => {
                        let childEl = this.build(c);
                        if (childEl !== undefined) {
                            result === null || result === void 0 ? void 0 : result.appendChild(childEl);
                        }
                    });
                    break;
                }
                case 'button': {
                    let elementTag;
                    if (((_b = element._props.variant) === null || _b === void 0 ? void 0 : _b._value) === 'outlined') {
                        elementTag = 'md-outlined-button';
                    }
                    else {
                        elementTag = 'md-filled-button';
                    }
                    result = this.createElement('button', elementTag, {
                        cosmoId: element._key,
                        textContent: (_c = element._props.caption) === null || _c === void 0 ? void 0 : _c._value,
                        onclick: (_d = element._props.onClick) === null || _d === void 0 ? void 0 : _d._value
                    }, element._styles, element);
                    break;
                }
                case 'tabs': {
                    result = this.createElement('tabs', 'md-tabs', {
                        cosmoId: element._key,
                        onchange: (_e = element._props.onChange) === null || _e === void 0 ? void 0 : _e._value
                    }, element._styles, element);
                    element._children.forEach(c => {
                        let childEl = this.build(c);
                        if (childEl !== undefined) {
                            result === null || result === void 0 ? void 0 : result.appendChild(childEl);
                        }
                    });
                    break;
                }
                case 'primary-tab': {
                    result = this.createElement('primary-tab', 'md-primary-tab', {
                        cosmoId: element._key,
                    }, element._styles, element);
                    element._children.forEach(c => {
                        let childEl = this.build(c);
                        if (childEl !== undefined) {
                            result === null || result === void 0 ? void 0 : result.appendChild(childEl);
                        }
                    });
                    break;
                }
            }
        }
        if (parentKey !== undefined) {
            let parent = (_f = this.bindings[parentKey]) === null || _f === void 0 ? void 0 : _f.rendered;
            if (parent !== undefined && result !== undefined) {
                parent.appendChild(result);
            }
        }
        return result;
    }
    createChild(newChild, parentKey) {
        return this.build(newChild, parentKey);
    }
    deleteChild(childKey) {
        let elCont = this.bindings[childKey];
        if (elCont) {
            let { rendered } = elCont;
            rendered.remove();
        }
    }
    replaceChild(element, newChild) {
        let key = element._key;
        let elCont = this.bindings[key];
        if (elCont) {
            let { rendered } = elCont;
            let newRendered = this.build(newChild);
            rendered.replaceWith(newRendered);
            return newRendered;
        }
    }
    updateStyle(elementKey, cssKey, cssValue) {
        let elCont = this.bindings[elementKey];
        if (elCont) {
            let { rendered } = elCont;
            rendered.style[cssKey] = cssValue;
        }
    }
    updateProp(elementKey, propKey, propValue) {
        let elCont = this.bindings[elementKey];
        if (elCont) {
            let { rendered, controlType, control } = elCont;
            switch (controlType) {
                case 'text': {
                    switch (propKey) {
                        case 'text': {
                            rendered.textContent = propValue;
                            break;
                        }
                    }
                    break;
                }
                case 'box': {
                    switch (propKey) {
                        case 'text': {
                            rendered.textContent = propValue;
                            break;
                        }
                    }
                    break;
                }
                case 'button': {
                    switch (propKey) {
                        case 'caption': {
                            rendered.textContent = propValue;
                            break;
                        }
                        case 'variant': {
                            let elementTag;
                            if (propValue === 'outlined') {
                                elementTag = 'md-outlined-button';
                            }
                            else {
                                elementTag = 'md-filled-button';
                            }
                            rendered.replaceWith(this.createElement('button', elementTag, {
                                cosmoId: elementKey,
                                textContent: control._props.caption._value
                            }, control._styles, control));
                            break;
                        }
                    }
                    break;
                }
            }
        }
    }
}
exports["default"] = UiBuilder;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
!function() {
var exports = __webpack_exports__;
/*!******************!*\
  !*** ./index.ts ***!
  \******************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
const uiBuilder_1 = __webpack_require__(/*! ./uiBuilder */ "./uiBuilder.ts");
const native_1 = __webpack_require__(/*! ./native */ "./native.ts");
class MwcDriver {
    update(key, updates) {
        console.log(updates);
        let that = this;
        console.log(this);
        updates.forEach((u) => {
            if (u.__action__ === 'element_deleted') {
                that.uiBuilder.deleteChild(u.__key__);
            }
            else if (u.__action__ === 'element_created') {
                that.uiBuilder.createChild(u.__element__, u.__parentKey__);
            }
            else if (u.__action__ === 'props_updated') {
                Object.keys(u.__updated__).forEach(propKey => {
                    that.uiBuilder.updateProp(u.__key__, propKey, u.__updated__[propKey]._value);
                });
            }
            else if (u.__action__ === 'styles_updated') {
                Object.keys(u.__updated__).forEach(styleKey => {
                    that.uiBuilder.updateStyle(u.__key__, styleKey, u.__updated__[styleKey]);
                });
            }
        });
    }
    start(genesisComponent, Controls) {
        this.applet.run(genesisComponent, (mod) => new native_1.default(mod, Controls), this.update).then((runnable) => {
            console.log(runnable.root);
            let ui = this.uiBuilder.build(runnable.root);
            ui && (this.root.appendChild(ui));
            runnable.mount();
        });
    }
    constructor(applet, container) {
        this.root = container;
        this.applet = applet;
        this.uiBuilder = new uiBuilder_1.default();
        this.update = this.update.bind(this);
        this.start = this.start.bind(this);
    }
}
exports["default"] = MwcDriver;
window.MwcDriver = MwcDriver
}();
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LElBQUksQ0FBQyxJQUFJLENBQUM7UUFDcEMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDdEMsQ0FBQztDQUNKO0FBRUQscUJBQWUsU0FBUyIsInNvdXJjZXMiOlsid2VicGFjazovL2FwcGxldC1td2MvLi9jc3NQcm9wZXJ0eS50cyIsIndlYnBhY2s6Ly9hcHBsZXQtbXdjLy4vaHlwaGVuYXRlU3R5bGVOYW1lLnRzIiwid2VicGFjazovL2FwcGxldC1td2MvLi9uYXRpdmUudHMiLCJ3ZWJwYWNrOi8vYXBwbGV0LW13Yy8uL3VpQnVpbGRlci50cyIsIndlYnBhY2s6Ly9hcHBsZXQtbXdjL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL2FwcGxldC1td2MvLi9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQ1NTIHByb3BlcnRpZXMgd2hpY2ggYWNjZXB0IG51bWJlcnMgYnV0IGFyZSBub3QgaW4gdW5pdHMgb2YgXCJweFwiLlxuICovXG52YXIgaXNVbml0bGVzc051bWJlciA9IHtcbiAgYm94RmxleDogdHJ1ZSxcbiAgYm94RmxleEdyb3VwOiB0cnVlLFxuICBjb2x1bW5Db3VudDogdHJ1ZSxcbiAgZmxleDogdHJ1ZSxcbiAgZmxleEdyb3c6IHRydWUsXG4gIGZsZXhQb3NpdGl2ZTogdHJ1ZSxcbiAgZmxleFNocmluazogdHJ1ZSxcbiAgZmxleE5lZ2F0aXZlOiB0cnVlLFxuICBmb250V2VpZ2h0OiB0cnVlLFxuICBsaW5lQ2xhbXA6IHRydWUsXG4gIGxpbmVIZWlnaHQ6IHRydWUsXG4gIG9wYWNpdHk6IHRydWUsXG4gIG9yZGVyOiB0cnVlLFxuICBvcnBoYW5zOiB0cnVlLFxuICB3aWRvd3M6IHRydWUsXG4gIHpJbmRleDogdHJ1ZSxcbiAgem9vbTogdHJ1ZSxcblxuICAvLyBTVkctcmVsYXRlZCBwcm9wZXJ0aWVzXG4gIGZpbGxPcGFjaXR5OiB0cnVlLFxuICBzdHJva2VEYXNob2Zmc2V0OiB0cnVlLFxuICBzdHJva2VPcGFjaXR5OiB0cnVlLFxuICBzdHJva2VXaWR0aDogdHJ1ZVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge3N0cmluZ30gcHJlZml4IHZlbmRvci1zcGVjaWZpYyBwcmVmaXgsIGVnOiBXZWJraXRcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgc3R5bGUgbmFtZSwgZWc6IHRyYW5zaXRpb25EdXJhdGlvblxuICogQHJldHVybiB7c3RyaW5nfSBzdHlsZSBuYW1lIHByZWZpeGVkIHdpdGggYHByZWZpeGAsIHByb3Blcmx5IGNhbWVsQ2FzZWQsIGVnOlxuICogV2Via2l0VHJhbnNpdGlvbkR1cmF0aW9uXG4gKi9cbmZ1bmN0aW9uIHByZWZpeEtleShwcmVmaXgsIGtleSkge1xuICByZXR1cm4gcHJlZml4ICsga2V5LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsga2V5LnN1YnN0cmluZygxKTtcbn1cblxuLyoqXG4gKiBTdXBwb3J0IHN0eWxlIG5hbWVzIHRoYXQgbWF5IGNvbWUgcGFzc2VkIGluIHByZWZpeGVkIGJ5IGFkZGluZyBwZXJtdXRhdGlvbnNcbiAqIG9mIHZlbmRvciBwcmVmaXhlcy5cbiAqL1xudmFyIHByZWZpeGVzID0gWydXZWJraXQnLCAnbXMnLCAnTW96JywgJ08nXTtcblxuLy8gVXNpbmcgT2JqZWN0LmtleXMgaGVyZSwgb3IgZWxzZSB0aGUgdmFuaWxsYSBmb3ItaW4gbG9vcCBtYWtlcyBJRTggZ28gaW50byBhblxuLy8gaW5maW5pdGUgbG9vcCwgYmVjYXVzZSBpdCBpdGVyYXRlcyBvdmVyIHRoZSBuZXdseSBhZGRlZCBwcm9wcyB0b28uXG5PYmplY3Qua2V5cyhpc1VuaXRsZXNzTnVtYmVyKS5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7XG4gIHByZWZpeGVzLmZvckVhY2goZnVuY3Rpb24gKHByZWZpeCkge1xuICAgIGlzVW5pdGxlc3NOdW1iZXJbcHJlZml4S2V5KHByZWZpeCwgcHJvcCldID0gaXNVbml0bGVzc051bWJlcltwcm9wXTtcbiAgfSk7XG59KTtcblxuLyoqXG4gKiBNb3N0IHN0eWxlIHByb3BlcnRpZXMgY2FuIGJlIHVuc2V0IGJ5IGRvaW5nIC5zdHlsZVtwcm9wXSA9ICcnIGJ1dCBJRThcbiAqIGRvZXNuJ3QgbGlrZSBkb2luZyB0aGF0IHdpdGggc2hvcnRoYW5kIHByb3BlcnRpZXMgc28gZm9yIHRoZSBwcm9wZXJ0aWVzIHRoYXRcbiAqIElFOCBicmVha3Mgb24sIHdoaWNoIGFyZSBsaXN0ZWQgaGVyZSwgd2UgaW5zdGVhZCB1bnNldCBlYWNoIG9mIHRoZVxuICogaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLiBTZWUgaHR0cDovL2J1Z3MuanF1ZXJ5LmNvbS90aWNrZXQvMTIzODUuXG4gKiBUaGUgNC12YWx1ZSAnY2xvY2snIHByb3BlcnRpZXMgbGlrZSBtYXJnaW4sIHBhZGRpbmcsIGJvcmRlci13aWR0aCBzZWVtIHRvXG4gKiBiZWhhdmUgd2l0aG91dCBhbnkgcHJvYmxlbXMuIEN1cmlvdXNseSwgbGlzdC1zdHlsZSB3b3JrcyB0b28gd2l0aG91dCBhbnlcbiAqIHNwZWNpYWwgcHJvZGRpbmcuXG4gKi9cbnZhciBzaG9ydGhhbmRQcm9wZXJ0eUV4cGFuc2lvbnMgPSB7XG4gIGJhY2tncm91bmQ6IHtcbiAgICBiYWNrZ3JvdW5kSW1hZ2U6IHRydWUsXG4gICAgYmFja2dyb3VuZFBvc2l0aW9uOiB0cnVlLFxuICAgIGJhY2tncm91bmRSZXBlYXQ6IHRydWUsXG4gICAgYmFja2dyb3VuZENvbG9yOiB0cnVlXG4gIH0sXG4gIGJvcmRlcjoge1xuICAgIGJvcmRlcldpZHRoOiB0cnVlLFxuICAgIGJvcmRlclN0eWxlOiB0cnVlLFxuICAgIGJvcmRlckNvbG9yOiB0cnVlXG4gIH0sXG4gIGJvcmRlckJvdHRvbToge1xuICAgIGJvcmRlckJvdHRvbVdpZHRoOiB0cnVlLFxuICAgIGJvcmRlckJvdHRvbVN0eWxlOiB0cnVlLFxuICAgIGJvcmRlckJvdHRvbUNvbG9yOiB0cnVlXG4gIH0sXG4gIGJvcmRlckxlZnQ6IHtcbiAgICBib3JkZXJMZWZ0V2lkdGg6IHRydWUsXG4gICAgYm9yZGVyTGVmdFN0eWxlOiB0cnVlLFxuICAgIGJvcmRlckxlZnRDb2xvcjogdHJ1ZVxuICB9LFxuICBib3JkZXJSaWdodDoge1xuICAgIGJvcmRlclJpZ2h0V2lkdGg6IHRydWUsXG4gICAgYm9yZGVyUmlnaHRTdHlsZTogdHJ1ZSxcbiAgICBib3JkZXJSaWdodENvbG9yOiB0cnVlXG4gIH0sXG4gIGJvcmRlclRvcDoge1xuICAgIGJvcmRlclRvcFdpZHRoOiB0cnVlLFxuICAgIGJvcmRlclRvcFN0eWxlOiB0cnVlLFxuICAgIGJvcmRlclRvcENvbG9yOiB0cnVlXG4gIH0sXG4gIGZvbnQ6IHtcbiAgICBmb250U3R5bGU6IHRydWUsXG4gICAgZm9udFZhcmlhbnQ6IHRydWUsXG4gICAgZm9udFdlaWdodDogdHJ1ZSxcbiAgICBmb250U2l6ZTogdHJ1ZSxcbiAgICBsaW5lSGVpZ2h0OiB0cnVlLFxuICAgIGZvbnRGYW1pbHk6IHRydWVcbiAgfVxufTtcblxudmFyIENTU1Byb3BlcnR5ID0ge1xuICBpc1VuaXRsZXNzTnVtYmVyOiBpc1VuaXRsZXNzTnVtYmVyLFxuICBzaG9ydGhhbmRQcm9wZXJ0eUV4cGFuc2lvbnM6IHNob3J0aGFuZFByb3BlcnR5RXhwYW5zaW9uc1xufTtcblxuZXhwb3J0IGRlZmF1bHQgQ1NTUHJvcGVydHlcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgbXNQYXR0ZXJuID0gL15tcy0vO1xuXG52YXIgX3VwcGVyY2FzZVBhdHRlcm4gPSAvKFtBLVpdKS9nO1xuXG4vKipcbiAqIEh5cGhlbmF0ZXMgYSBjYW1lbGNhc2VkIHN0cmluZywgZm9yIGV4YW1wbGU6XG4gKlxuICogICA+IGh5cGhlbmF0ZSgnYmFja2dyb3VuZENvbG9yJylcbiAqICAgPCBcImJhY2tncm91bmQtY29sb3JcIlxuICpcbiAqIEZvciBDU1Mgc3R5bGUgbmFtZXMsIHVzZSBgaHlwaGVuYXRlU3R5bGVOYW1lYCBpbnN0ZWFkIHdoaWNoIHdvcmtzIHByb3Blcmx5XG4gKiB3aXRoIGFsbCB2ZW5kb3IgcHJlZml4ZXMsIGluY2x1ZGluZyBgbXNgLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHJpbmdcbiAqIEByZXR1cm4ge3N0cmluZ31cbiAqL1xuZnVuY3Rpb24gaHlwaGVuYXRlKHN0cmluZykge1xuICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoX3VwcGVyY2FzZVBhdHRlcm4sICctJDEnKS50b0xvd2VyQ2FzZSgpO1xufVxuXG4vKipcbiAqIEh5cGhlbmF0ZXMgYSBjYW1lbGNhc2VkIENTUyBwcm9wZXJ0eSBuYW1lLCBmb3IgZXhhbXBsZTpcbiAqXG4gKiAgID4gaHlwaGVuYXRlU3R5bGVOYW1lKCdiYWNrZ3JvdW5kQ29sb3InKVxuICogICA8IFwiYmFja2dyb3VuZC1jb2xvclwiXG4gKiAgID4gaHlwaGVuYXRlU3R5bGVOYW1lKCdNb3pUcmFuc2l0aW9uJylcbiAqICAgPCBcIi1tb3otdHJhbnNpdGlvblwiXG4gKiAgID4gaHlwaGVuYXRlU3R5bGVOYW1lKCdtc1RyYW5zaXRpb24nKVxuICogICA8IFwiLW1zLXRyYW5zaXRpb25cIlxuICpcbiAqIEFzIE1vZGVybml6ciBzdWdnZXN0cyAoaHR0cDovL21vZGVybml6ci5jb20vZG9jcy8jcHJlZml4ZWQpLCBhbiBgbXNgIHByZWZpeFxuICogaXMgY29udmVydGVkIHRvIGAtbXMtYC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nXG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGh5cGhlbmF0ZVN0eWxlTmFtZShzdHJpbmcpIHtcbiAgcmV0dXJuIGh5cGhlbmF0ZShzdHJpbmcpLnJlcGxhY2UobXNQYXR0ZXJuLCAnLW1zLScpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBoeXBoZW5hdGVTdHlsZU5hbWVcbiIsIlxuY2xhc3MgTmF0aXZlIHtcblxuICAgIGdsb2JhbE1lbW9yeSA9IHt9XG4gICAgaW50ZXJ2YWxzID0ge31cbiAgICB0aW1lb3V0cyA9IHt9XG4gICAgY29udHJvbHMgPSB7fVxuICAgIG1vZHVsZSA9IHVuZGVmaW5lZFxuXG4gICAgbmF0aXZlRWxlbWVudCA9IChjb21wVHlwZTogc3RyaW5nLCBwcm9wczoge1tpZDogc3RyaW5nXTogYW55fSwgc3R5bGVzOiB7W2lkOiBzdHJpbmddOiBhbnl9LCBjaGlsZHJlbjogQXJyYXk8YW55PikgPT4ge1xuICAgICAgICBsZXQgY29udHJvbCA9IHRoaXMuY29udHJvbHNbY29tcFR5cGVdXG4gICAgICAgIGxldCBjID0gY29udHJvbC5pbnN0YW50aWF0ZShwcm9wcywgc3R5bGVzLCBjaGlsZHJlbilcbiAgICAgICAgcmV0dXJuIGNcbiAgICB9XG4gICAgT2JqZWN0ID0ge1xuICAgICAgICBrZXlzOiAob2JqOiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopXG4gICAgICAgIH0sXG4gICAgICAgIHZhbHVlczogKG9iajogYW55KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhvYmopXG4gICAgICAgIH1cbiAgICB9XG4gICAgYWxlcnQgPSAoc3RyOiBhbnkpID0+IHtcbiAgICAgICAgd2luZG93LmFsZXJ0KHN0cilcbiAgICB9XG4gICAgY29uc29sZSA9IHtcbiAgICAgICAgbG9nOiAoLi4uc3RyczogQXJyYXk8YW55PikgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coLi4uc3RycylcbiAgICAgICAgfVxuICAgIH1cbiAgICBzZXRJbnRlcnZhbCA9IChjYWxsYmFjazogKCkgPT4gdm9pZCwgcGVyaW9kOiBudW1iZXIpID0+IHtcbiAgICAgICAgdGhpcy5pbnRlcnZhbHNbc2V0SW50ZXJ2YWwoY2FsbGJhY2ssIHBlcmlvZCkgKyAnJ10gPSB0cnVlXG4gICAgfVxuICAgIHNldFRpbWVvdXQgPSAoY2FsbGJhY2s6ICgpID0+IHZvaWQsIHRpbWVvdXQ6IG51bWJlcikgPT4ge1xuICAgICAgICB0aGlzLnRpbWVvdXRzW3NldFRpbWVvdXQoY2FsbGJhY2ssIHRpbWVvdXQpICsgJyddID0gdHJ1ZVxuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKG1vZHVsZTogYW55LCBjb250cm9sczoge1tpZDogc3RyaW5nXTogYW55fSkge1xuICAgICAgICB0aGlzLm1vZHVsZSA9IG1vZHVsZVxuICAgICAgICB0aGlzLmNvbnRyb2xzID0gY29udHJvbHNcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5hdGl2ZVxuIiwiXG5pbXBvcnQgY3NzUHJvcGVydHkgZnJvbSAnLi9jc3NQcm9wZXJ0eSc7XG5pbXBvcnQgaHlwaGVuYXRlU3R5bGVOYW1lIGZyb20gJy4vaHlwaGVuYXRlU3R5bGVOYW1lJztcblxubGV0IHsgaXNVbml0bGVzc051bWJlciB9ID0gY3NzUHJvcGVydHlcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xudmFyIGtleXMgPSBPYmplY3Qua2V5cztcblxudmFyIGNvdW50ZXIgPSAxO1xuLy8gRm9sbG93cyBzeW50YXggYXQgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL2NvbnRlbnQsXG4vLyBpbmNsdWRpbmcgbXVsdGlwbGUgc3BhY2Ugc2VwYXJhdGVkIHZhbHVlcy5cbnZhciB1bnF1b3RlZENvbnRlbnRWYWx1ZVJlZ2V4ID0gL14obm9ybWFsfG5vbmV8KFxcYih1cmxcXChbXildKlxcKXxjaGFwdGVyX2NvdW50ZXJ8YXR0clxcKFteKV0qXFwpfChuby0pPyhvcGVufGNsb3NlKS1xdW90ZXxpbmhlcml0KSgoXFxiXFxzKil8JHxcXHMrKSkrKSQvO1xuXG5mdW5jdGlvbiBidWlsZFJ1bGUoa2V5LCB2YWx1ZSkge1xuICAgIGlmICghaXNVbml0bGVzc051bWJlcltrZXldICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdmFsdWUgPSAnJyArIHZhbHVlICsgJ3B4JztcbiAgICB9XG4gICAgZWxzZSBpZiAoa2V5ID09PSAnY29udGVudCcgJiYgIXVucXVvdGVkQ29udGVudFZhbHVlUmVnZXgudGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgdmFsdWUgPSBcIidcIiArIHZhbHVlLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKSArIFwiJ1wiO1xuICAgIH1cblxuICAgIHJldHVybiBoeXBoZW5hdGVTdHlsZU5hbWUoa2V5KSArICc6ICcgKyB2YWx1ZSArICc7ICAnO1xufVxuXG5mdW5jdGlvbiBidWlsZFZhbHVlKGtleSwgdmFsdWUpIHtcbiAgICBpZiAoIWlzVW5pdGxlc3NOdW1iZXJba2V5XSAmJiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHZhbHVlID0gJycgKyB2YWx1ZSArICdweCc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGtleSA9PT0gJ2NvbnRlbnQnICYmICF1bnF1b3RlZENvbnRlbnRWYWx1ZVJlZ2V4LnRlc3QodmFsdWUpKSB7XG4gICAgICAgIHZhbHVlID0gXCInXCIgKyB2YWx1ZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIikgKyBcIidcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWUgKyAnJztcbn1cblxuZnVuY3Rpb24gc3R5bGVUb0Nzc1N0cmluZyhydWxlczogeyBbaWQ6IHN0cmluZ106IGFueSB9KTogc3RyaW5nIHtcbiAgICB2YXIgcmVzdWx0ID0gJydcbiAgICBpZiAoIXJ1bGVzIHx8IGtleXMocnVsZXMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICB2YXIgc3R5bGVLZXlzID0ga2V5cyhydWxlcyk7XG4gICAgZm9yICh2YXIgaiA9IDAsIGwgPSBzdHlsZUtleXMubGVuZ3RoOyBqIDwgbDsgaisrKSB7XG4gICAgICAgIHZhciBzdHlsZUtleSA9IHN0eWxlS2V5c1tqXTtcbiAgICAgICAgdmFyIHZhbHVlID0gcnVsZXNbc3R5bGVLZXldO1xuXG4gICAgICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ICs9IGJ1aWxkUnVsZShzdHlsZUtleSwgdmFsdWVbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ICs9IGJ1aWxkUnVsZShzdHlsZUtleSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmNsYXNzIFVpQnVpbGRlciB7XG5cbiAgICBiaW5kaW5ncyA9IHt9XG5cbiAgICBjb25zdHJ1Y3RvcigpIHsgfVxuXG4gICAgY3JlYXRlRWxlbWVudChjb250cm9sVHlwZTogc3RyaW5nLCB0YWc6IHN0cmluZywgcHJvcHM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgc3R5bGVzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sIGNvbnRyb2w6IGFueSk6IEhUTUxFbGVtZW50IHtcbiAgICAgICAgbGV0IGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZylcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHByb3BzKSB7XG4gICAgICAgICAgICBlbGVtZW50W2tleV0gPSBwcm9wc1trZXldXG4gICAgICAgIH1cbiAgICAgICAgZWxlbWVudC5zdHlsZS5jc3NUZXh0ID0gc3R5bGVUb0Nzc1N0cmluZyhzdHlsZXMpXG4gICAgICAgIHRoaXMuYmluZGluZ3NbcHJvcHMuY29zbW9JZF0gPSB7IHJlbmRlcmVkOiBlbGVtZW50LCBjb250cm9sVHlwZSwgY29udHJvbCB9XG4gICAgICAgIHJldHVybiBlbGVtZW50XG4gICAgfVxuXG4gICAgYnVpbGQoZWxlbWVudDogYW55LCBwYXJlbnRLZXk/OiBzdHJpbmcpOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGlmIChlbGVtZW50ID09PSB1bmRlZmluZWQpIHJldHVybiB1bmRlZmluZWRcbiAgICAgICAgbGV0IHJlc3VsdDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcbiAgICAgICAgaWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgZWxlbWVudCA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGVsZW1lbnQgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgbGV0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJylcbiAgICAgICAgICAgIHNwYW4udGV4dENvbnRlbnQgPSBlbGVtZW50LnRvU3RyaW5nKClcbiAgICAgICAgICAgIHJlc3VsdCA9IHNwYW5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN3aXRjaCAoZWxlbWVudC5fY29udHJvbFR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICd0ZXh0Jzoge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB0aGlzLmNyZWF0ZUVsZW1lbnQoXG4gICAgICAgICAgICAgICAgICAgICAgICAndGV4dCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3BhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29zbW9JZDogZWxlbWVudC5fa2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHRDb250ZW50OiBlbGVtZW50Ll9wcm9wcy50ZXh0Py5fdmFsdWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zdHlsZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50XG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FzZSAnYm94Jzoge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB0aGlzLmNyZWF0ZUVsZW1lbnQoXG4gICAgICAgICAgICAgICAgICAgICAgICAnYm94JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdkaXYnLFxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvc21vSWQ6IGVsZW1lbnQuX2tleSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zdHlsZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50XG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5fY2hpbGRyZW4uZm9yRWFjaCgoYzogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgY2hpbGRFbCA9IHRoaXMuYnVpbGQoYylcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZEVsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQ/LmFwcGVuZENoaWxkKGNoaWxkRWwpXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlICdjYXJkJzoge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB0aGlzLmNyZWF0ZUVsZW1lbnQoXG4gICAgICAgICAgICAgICAgICAgICAgICAnY2FyZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGl2JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3Ntb0lkOiBlbGVtZW50Ll9rZXksXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5fc3R5bGVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX2NoaWxkcmVuLmZvckVhY2goYyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgY2hpbGRFbCA9IHRoaXMuYnVpbGQoYylcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZEVsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQ/LmFwcGVuZENoaWxkKGNoaWxkRWwpXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlICdidXR0b24nOiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBlbGVtZW50VGFnXG4gICAgICAgICAgICAgICAgICAgIGlmIChlbGVtZW50Ll9wcm9wcy52YXJpYW50Py5fdmFsdWUgPT09ICdvdXRsaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRUYWcgPSAnbWQtb3V0bGluZWQtYnV0dG9uJ1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudFRhZyA9ICdtZC1maWxsZWQtYnV0dG9uJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuY3JlYXRlRWxlbWVudChcbiAgICAgICAgICAgICAgICAgICAgICAgICdidXR0b24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudFRhZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3Ntb0lkOiBlbGVtZW50Ll9rZXksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dENvbnRlbnQ6IGVsZW1lbnQuX3Byb3BzLmNhcHRpb24/Ll92YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbmNsaWNrOiBlbGVtZW50Ll9wcm9wcy5vbkNsaWNrPy5fdmFsdWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zdHlsZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50XG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FzZSAndGFicyc6IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy5jcmVhdGVFbGVtZW50KFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RhYnMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ21kLXRhYnMnLFxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvc21vSWQ6IGVsZW1lbnQuX2tleSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbmNoYW5nZTogZWxlbWVudC5fcHJvcHMub25DaGFuZ2U/Ll92YWx1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX3N0eWxlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9jaGlsZHJlbi5mb3JFYWNoKGMgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNoaWxkRWwgPSB0aGlzLmJ1aWxkKGMpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hpbGRFbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0Py5hcHBlbmRDaGlsZChjaGlsZEVsKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlICdwcmltYXJ5LXRhYic6IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy5jcmVhdGVFbGVtZW50KFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3ByaW1hcnktdGFiJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdtZC1wcmltYXJ5LXRhYicsXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29zbW9JZDogZWxlbWVudC5fa2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX3N0eWxlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9jaGlsZHJlbi5mb3JFYWNoKGMgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNoaWxkRWwgPSB0aGlzLmJ1aWxkKGMpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hpbGRFbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0Py5hcHBlbmRDaGlsZChjaGlsZEVsKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocGFyZW50S2V5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGxldCBwYXJlbnQgPSB0aGlzLmJpbmRpbmdzW3BhcmVudEtleV0/LnJlbmRlcmVkXG4gICAgICAgICAgICBpZiAocGFyZW50ICE9PSB1bmRlZmluZWQgJiYgcmVzdWx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQocmVzdWx0KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRcbiAgICB9XG5cbiAgICBjcmVhdGVDaGlsZChuZXdDaGlsZDogYW55LCBwYXJlbnRLZXk6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGQobmV3Q2hpbGQsIHBhcmVudEtleSlcbiAgICB9XG5cbiAgICBkZWxldGVDaGlsZChjaGlsZEtleTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGxldCBlbENvbnQgPSB0aGlzLmJpbmRpbmdzW2NoaWxkS2V5XVxuICAgICAgICBpZiAoZWxDb250KSB7XG4gICAgICAgICAgICBsZXQgeyByZW5kZXJlZCB9ID0gZWxDb250XG4gICAgICAgICAgICByZW5kZXJlZC5yZW1vdmUoKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVwbGFjZUNoaWxkKGVsZW1lbnQ6IGFueSwgbmV3Q2hpbGQ6IGFueSk6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkIHtcbiAgICAgICAgbGV0IGtleSA9IGVsZW1lbnQuX2tleVxuICAgICAgICBsZXQgZWxDb250ID0gdGhpcy5iaW5kaW5nc1trZXldXG4gICAgICAgIGlmIChlbENvbnQpIHtcbiAgICAgICAgICAgIGxldCB7IHJlbmRlcmVkIH0gPSBlbENvbnRcbiAgICAgICAgICAgIGxldCBuZXdSZW5kZXJlZCA9IHRoaXMuYnVpbGQobmV3Q2hpbGQpXG4gICAgICAgICAgICByZW5kZXJlZC5yZXBsYWNlV2l0aChuZXdSZW5kZXJlZClcbiAgICAgICAgICAgIHJldHVybiBuZXdSZW5kZXJlZFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlU3R5bGUoZWxlbWVudEtleTogc3RyaW5nLCBjc3NLZXk6IHN0cmluZywgY3NzVmFsdWU6IGFueSk6IHZvaWQge1xuICAgICAgICBsZXQgZWxDb250ID0gdGhpcy5iaW5kaW5nc1tlbGVtZW50S2V5XVxuICAgICAgICBpZiAoZWxDb250KSB7XG4gICAgICAgICAgICBsZXQgeyByZW5kZXJlZCB9ID0gZWxDb250XG4gICAgICAgICAgICByZW5kZXJlZC5zdHlsZVtjc3NLZXldID0gY3NzVmFsdWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVByb3AoZWxlbWVudEtleTogc3RyaW5nLCBwcm9wS2V5OiBzdHJpbmcsIHByb3BWYWx1ZTogYW55KTogdm9pZCB7XG4gICAgICAgIGxldCBlbENvbnQgPSB0aGlzLmJpbmRpbmdzW2VsZW1lbnRLZXldXG4gICAgICAgIGlmIChlbENvbnQpIHtcbiAgICAgICAgICAgIGxldCB7IHJlbmRlcmVkLCBjb250cm9sVHlwZSwgY29udHJvbCB9ID0gZWxDb250XG4gICAgICAgICAgICBzd2l0Y2ggKGNvbnRyb2xUeXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAndGV4dCc6IHtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChwcm9wS2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICd0ZXh0Jzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbmRlcmVkLnRleHRDb250ZW50ID0gcHJvcFZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlICdib3gnOiB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAocHJvcEtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAndGV4dCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW5kZXJlZC50ZXh0Q29udGVudCA9IHByb3BWYWx1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FzZSAnYnV0dG9uJzoge1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKHByb3BLZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2NhcHRpb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyZWQudGV4dENvbnRlbnQgPSBwcm9wVmFsdWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAndmFyaWFudCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudFRhZzogc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BWYWx1ZSA9PT0gJ291dGxpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50VGFnID0gJ21kLW91dGxpbmVkLWJ1dHRvbidcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50VGFnID0gJ21kLWZpbGxlZC1idXR0b24nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbmRlcmVkLnJlcGxhY2VXaXRoKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNyZWF0ZUVsZW1lbnQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYnV0dG9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRUYWcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29zbW9JZDogZWxlbWVudEtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0Q29udGVudDogY29udHJvbC5fcHJvcHMuY2FwdGlvbi5fdmFsdWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sLl9zdHlsZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVWlCdWlsZGVyXG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiXG5pbXBvcnQgVWlCdWlsZGVyIGZyb20gJy4vdWlCdWlsZGVyJ1xuaW1wb3J0IE5hdGl2ZSBmcm9tICcuL25hdGl2ZSdcblxuY2xhc3MgTXdjRHJpdmVyIHtcblxuICAgIGFwcGxldDtcbiAgICByb290O1xuICAgIHVpQnVpbGRlcjtcblxuICAgIHVwZGF0ZShrZXk6IHN0cmluZywgdXBkYXRlczogQXJyYXk8YW55Pikge1xuICAgICAgICBjb25zb2xlLmxvZyh1cGRhdGVzKVxuICAgICAgICBsZXQgdGhhdCA9IHRoaXNcbiAgICAgICAgY29uc29sZS5sb2codGhpcylcbiAgICAgICAgdXBkYXRlcy5mb3JFYWNoKCh1OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmICh1Ll9fYWN0aW9uX18gPT09ICdlbGVtZW50X2RlbGV0ZWQnKSB7XG4gICAgICAgICAgICAgICAgdGhhdC51aUJ1aWxkZXIuZGVsZXRlQ2hpbGQodS5fX2tleV9fKVxuICAgICAgICAgICAgfSBlbHNlIGlmICh1Ll9fYWN0aW9uX18gPT09ICdlbGVtZW50X2NyZWF0ZWQnKSB7XG4gICAgICAgICAgICAgICAgdGhhdC51aUJ1aWxkZXIuY3JlYXRlQ2hpbGQodS5fX2VsZW1lbnRfXywgdS5fX3BhcmVudEtleV9fKVxuICAgICAgICAgICAgfSBlbHNlIGlmICh1Ll9fYWN0aW9uX18gPT09ICdwcm9wc191cGRhdGVkJykge1xuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHUuX191cGRhdGVkX18pLmZvckVhY2gocHJvcEtleSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoYXQudWlCdWlsZGVyLnVwZGF0ZVByb3AodS5fX2tleV9fLCBwcm9wS2V5LCB1Ll9fdXBkYXRlZF9fW3Byb3BLZXldLl92YWx1ZSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIGlmICh1Ll9fYWN0aW9uX18gPT09ICdzdHlsZXNfdXBkYXRlZCcpIHtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyh1Ll9fdXBkYXRlZF9fKS5mb3JFYWNoKHN0eWxlS2V5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhhdC51aUJ1aWxkZXIudXBkYXRlU3R5bGUodS5fX2tleV9fLCBzdHlsZUtleSwgdS5fX3VwZGF0ZWRfX1tzdHlsZUtleV0pXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3RhcnQoZ2VuZXNpc0NvbXBvbmVudDogc3RyaW5nLCBDb250cm9sczogeyBbaWQ6IHN0cmluZ106IGFueSB9KSB7XG4gICAgICAgIHRoaXMuYXBwbGV0LnJ1bihnZW5lc2lzQ29tcG9uZW50LCAobW9kOiBhbnkpID0+IG5ldyBOYXRpdmUobW9kLCBDb250cm9scyksIHRoaXMudXBkYXRlKS50aGVuKChydW5uYWJsZTogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhydW5uYWJsZS5yb290KVxuICAgICAgICAgICAgbGV0IHVpID0gdGhpcy51aUJ1aWxkZXIuYnVpbGQocnVubmFibGUucm9vdClcbiAgICAgICAgICAgIHVpICYmICh0aGlzLnJvb3QuYXBwZW5kQ2hpbGQodWkpKVxuICAgICAgICAgICAgcnVubmFibGUubW91bnQoKVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKGFwcGxldDogYW55LCBjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHRoaXMucm9vdCA9IGNvbnRhaW5lclxuICAgICAgICB0aGlzLmFwcGxldCA9IGFwcGxldFxuICAgICAgICB0aGlzLnVpQnVpbGRlciA9IG5ldyBVaUJ1aWxkZXIoKVxuICAgICAgICB0aGlzLnVwZGF0ZSA9IHRoaXMudXBkYXRlLmJpbmQodGhpcylcbiAgICAgICAgdGhpcy5zdGFydCA9IHRoaXMuc3RhcnQuYmluZCh0aGlzKVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXdjRHJpdmVyXG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=
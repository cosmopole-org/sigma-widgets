// cssProperty.ts
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
  // SVG-related properties
  fillOpacity: true,
  strokeDashoffset: true,
  strokeOpacity: true,
  strokeWidth: true
};
function prefixKey(prefix, key) {
  return prefix + key.charAt(0).toUpperCase() + key.substring(1);
}
var prefixes = ["Webkit", "ms", "Moz", "O"];
Object.keys(isUnitlessNumber).forEach(function(prop) {
  prefixes.forEach(function(prefix) {
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
  isUnitlessNumber,
  shorthandPropertyExpansions
};
var cssProperty_default = CSSProperty;

// hyphenateStyleName.ts
var msPattern = /^ms-/;
var _uppercasePattern = /([A-Z])/g;
function hyphenate(string) {
  return string.replace(_uppercasePattern, "-$1").toLowerCase();
}
function hyphenateStyleName(string) {
  return hyphenate(string).replace(msPattern, "-ms-");
}
var hyphenateStyleName_default = hyphenateStyleName;

// uiBuilder.ts
var { isUnitlessNumber: isUnitlessNumber2 } = cssProperty_default;
var isArray = Array.isArray;
var keys = Object.keys;
var unquotedContentValueRegex = /^(normal|none|(\b(url\([^)]*\)|chapter_counter|attr\([^)]*\)|(no-)?(open|close)-quote|inherit)((\b\s*)|$|\s+))+)$/;
function buildRule(key, value) {
  if (!isUnitlessNumber2[key] && typeof value === "number") {
    value = "" + value + "px";
  } else if (key === "content" && !unquotedContentValueRegex.test(value)) {
    value = "'" + value.replace(/'/g, "\\'") + "'";
  }
  return hyphenateStyleName_default(key) + ": " + value + ";  ";
}
function styleToCssString(rules) {
  var result = "";
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
    } else {
      result += buildRule(styleKey, value);
    }
  }
  return result;
}
var UiBuilder = class {
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
    if (element === void 0)
      return void 0;
    let result = void 0;
    if (typeof element === "string" || typeof element === "number" || typeof element === "boolean") {
      let span = document.createElement("span");
      span.textContent = element.toString();
      result = span;
    } else {
      switch (element._controlType) {
        case "text": {
          result = this.createElement(
            "text",
            "span",
            {
              cosmoId: element._key,
              textContent: (_a = element._props.text) == null ? void 0 : _a._value
            },
            element._styles,
            element
          );
          break;
        }
        case "box": {
          result = this.createElement(
            "box",
            "div",
            {
              cosmoId: element._key
            },
            element._styles,
            element
          );
          element._children.forEach((c) => {
            let childEl = this.build(c);
            if (childEl !== void 0) {
              result == null ? void 0 : result.appendChild(childEl);
            }
          });
          break;
        }
        case "card": {
          result = this.createElement(
            "card",
            "div",
            {
              cosmoId: element._key
            },
            element._styles,
            element
          );
          element._children.forEach((c) => {
            let childEl = this.build(c);
            if (childEl !== void 0) {
              result == null ? void 0 : result.appendChild(childEl);
            }
          });
          break;
        }
        case "button": {
          let elementTag;
          if (((_b = element._props.variant) == null ? void 0 : _b._value) === "outlined") {
            elementTag = "md-outlined-button";
          } else {
            elementTag = "md-filled-button";
          }
          result = this.createElement(
            "button",
            elementTag,
            {
              cosmoId: element._key,
              textContent: (_c = element._props.caption) == null ? void 0 : _c._value,
              onclick: (_d = element._props.onClick) == null ? void 0 : _d._value
            },
            element._styles,
            element
          );
          break;
        }
        case "tabs": {
          result = this.createElement(
            "tabs",
            "md-tabs",
            {
              cosmoId: element._key,
              onchange: (_e = element._props.onChange) == null ? void 0 : _e._value
            },
            element._styles,
            element
          );
          element._children.forEach((c) => {
            let childEl = this.build(c);
            if (childEl !== void 0) {
              result == null ? void 0 : result.appendChild(childEl);
            }
          });
          break;
        }
        case "primary-tab": {
          result = this.createElement(
            "primary-tab",
            "md-primary-tab",
            {
              cosmoId: element._key
            },
            element._styles,
            element
          );
          element._children.forEach((c) => {
            let childEl = this.build(c);
            if (childEl !== void 0) {
              result == null ? void 0 : result.appendChild(childEl);
            }
          });
          break;
        }
      }
    }
    if (parentKey !== void 0) {
      let parent = (_f = this.bindings[parentKey]) == null ? void 0 : _f.rendered;
      if (parent !== void 0 && result !== void 0) {
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
        case "text": {
          switch (propKey) {
            case "text": {
              rendered.textContent = propValue;
              break;
            }
          }
          break;
        }
        case "box": {
          switch (propKey) {
            case "text": {
              rendered.textContent = propValue;
              break;
            }
          }
          break;
        }
        case "button": {
          switch (propKey) {
            case "caption": {
              rendered.textContent = propValue;
              break;
            }
            case "variant": {
              let elementTag;
              if (propValue === "outlined") {
                elementTag = "md-outlined-button";
              } else {
                elementTag = "md-filled-button";
              }
              rendered.replaceWith(
                this.createElement(
                  "button",
                  elementTag,
                  {
                    cosmoId: elementKey,
                    textContent: control._props.caption._value
                  },
                  control._styles,
                  control
                )
              );
              break;
            }
          }
          break;
        }
      }
    }
  }
};
var uiBuilder_default = UiBuilder;

// index.ts
var MwcDriver = class {
  update(key, updates) {
    console.log(updates);
    let that = this;
    console.log(this);
    updates.forEach((u) => {
      if (u.__action__ === "element_deleted") {
        that.uiBuilder.deleteChild(u.__key__);
      } else if (u.__action__ === "element_created") {
        that.uiBuilder.createChild(u.__element__, u.__parentKey__);
      } else if (u.__action__ === "props_updated") {
        Object.keys(u.__updated__).forEach((propKey) => {
          that.uiBuilder.updateProp(u.__key__, propKey, u.__updated__[propKey]._value);
        });
      } else if (u.__action__ === "styles_updated") {
        Object.keys(u.__updated__).forEach((styleKey) => {
          that.uiBuilder.updateStyle(u.__key__, styleKey, u.__updated__[styleKey]);
        });
      }
    });
  }
  start(genesisComponent) {
    this.applet.run(genesisComponent, this.update).then((runnable) => {
      let ui = this.uiBuilder.build(runnable.root);
      ui && this.root.appendChild(ui);
      runnable.mount();
    });
  }
  constructor(applet, container) {
    this.root = container;
    this.applet = applet;
    this.uiBuilder = new uiBuilder_default();
    this.update = this.update.bind(this);
    this.start = this.start.bind(this);
  }
};
var applet_mwc_default = MwcDriver;
export {
  applet_mwc_default as default
};
//# sourceMappingURL=index.js.map
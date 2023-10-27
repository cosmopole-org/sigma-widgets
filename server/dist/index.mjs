var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// widget/DOM.ts
var DOM = class {
  get module() {
    return this._module;
  }
  get creature() {
    return this._creature;
  }
  get root() {
    return this._root;
  }
  setRoot(root) {
    this._root = root;
  }
  constructor(module, creature, root) {
    this._module = module;
    this._creature = creature;
    this._root = root;
  }
};
var DOM_default = DOM;

// widget/ExecutionMeta.ts
var ExecutionMeta = class {
  constructor(metaDict) {
    this.creature = metaDict.creature;
    this.declaration = metaDict.declaration === true;
    this.declarationType = metaDict.declarationType;
    this.returnIdParent = metaDict.returnIdParent;
    this.isAnotherCreature = metaDict.isAnotherCreature;
    this.parentJsxKey = metaDict.parentJsxKey;
    if (this.declaration && !this.declarationType) {
    }
  }
};
var ExecutionMeta_default = ExecutionMeta;

// widget/MemoryLayer.ts
var MemoryLayer = class {
  get units() {
    return this._units;
  }
  findUnit(key) {
    return this._units[key];
  }
  putUnit(key, unit) {
    this._units[key] = unit;
  }
  removeUnit(key) {
    delete this._units[key];
  }
  constructor(initialUnits) {
    this._units = initialUnits ? initialUnits : {};
  }
};
var MemoryLayer_default = MemoryLayer;

// widget/elements/BaseElement.ts
var BaseElement = class {
  get key() {
    return this._key;
  }
  get controlType() {
    return this._controlType;
  }
  get props() {
    return this._props;
  }
  get styles() {
    return this._styles;
  }
  get children() {
    return this._children;
  }
  update(props, styles, children) {
    if (props)
      this._props = props;
    if (styles)
      this._styles = styles;
    if (children)
      this._children = children;
  }
  constructor(key, controlType, props, styles, children) {
    this._key = key;
    this._controlType = controlType;
    this._props = props;
    this._styles = styles;
    this._children = children ? children : [];
  }
};
var BaseElement_default = BaseElement;

// widget/utils/generator.ts
var generateKey = () => {
  return Math.random().toString().substring(2);
};
function clone(instance) {
  const copy = new instance.constructor();
  Object.assign(copy, instance);
  return copy;
}
var prepareElement = (typeName, defaultProps, overridenProps, defaultStyles, overridenStyles, children) => {
  let finalProps = {};
  Object.keys(defaultProps).forEach((propKey) => {
    if (overridenProps[propKey] !== void 0) {
      let bpProp = defaultProps[propKey];
      let copiedProp = clone(bpProp);
      copiedProp.setValue(overridenProps[propKey]);
      finalProps[propKey] = copiedProp;
    }
  });
  let finalStyles = __spreadValues({}, defaultStyles);
  if (overridenStyles)
    finalStyles = __spreadValues(__spreadValues({}, finalStyles), overridenStyles);
  return new BaseElement_default(overridenProps["key"], typeName, finalProps, finalStyles, children);
};
var nestedContext = (creature, otherMetas) => {
  if (otherMetas) {
    return new ExecutionMeta_default(__spreadProps(__spreadValues({}, otherMetas), { creature, isAnotherCreature: true }));
  } else {
    return new ExecutionMeta_default({ creature, isAnotherCreature: true });
  }
};
var generator_default = { generateKey, prepareElement, nestedContext };

// widget/utils/compiler.ts
import { Parser as AcornParser } from "acorn";
import * as jsx from "acorn-jsx";

// widget/utils/cssProperty.ts
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

// widget/utils/hyphenateStyleName.ts
var msPattern = /^ms-/;
var _uppercasePattern = /([A-Z])/g;
function hyphenate(string) {
  return string.replace(_uppercasePattern, "-$1").toLowerCase();
}
function hyphenateStyleName(string) {
  return hyphenate(string).replace(msPattern, "-ms-");
}
var hyphenateStyleName_default = hyphenateStyleName;

// widget/utils/compiler.ts
var { isUnitlessNumber: isUnitlessNumber2 } = cssProperty_default;
var jsxCompiler = AcornParser.extend(jsx());
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
function buildValue(key, value) {
  if (!isUnitlessNumber2[key] && typeof value === "number") {
    value = "" + value + "px";
  } else if (key === "content" && !unquotedContentValueRegex.test(value)) {
    value = "'" + value.replace(/'/g, "\\'") + "'";
  }
  return value + "";
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
var parse = (jsxCode) => {
  return jsxCompiler.parse(jsxCode, { sourceType: "module", ecmaVersion: "latest" });
};
var extractModules = (middleCode, applet) => {
  return middleCode.body.filter((declaration) => declaration.type === "ClassDeclaration").map((declaration) => {
    return new Module_default(declaration.id.name, applet, declaration);
  });
};
var compiler_default = { parse, extractModules, styleToCssString, buildRule, buildValue };

// widget/utils/json.ts
var prettify = (obj) => {
  return JSON.stringify(obj, void 0, 4);
};
var updates = [];
var findChanges = (parentKey, el1, el2) => {
  if (el1._key !== el2._key) {
    updates.push(
      {
        __action__: "element_deleted",
        __key__: el1._key,
        __parentKey__: parentKey
      },
      {
        __action__: "element_created",
        __key__: el2._key,
        __element__: el2,
        __parentKey__: parentKey
      }
    );
    return;
  }
  let propsChanges = { __action__: "props_updated", __key__: el2._key, __created__: {}, __deleted__: {}, __updated__: {} };
  for (let pKey in el2._props) {
    if (el1._props[pKey] === void 0) {
      propsChanges.__created__[pKey] = el2._props[pKey];
    }
  }
  for (let pKey in el1._props) {
    if (el2._props[pKey] === void 0) {
      propsChanges.__deleted__[pKey] = el2._props[pKey];
    }
  }
  for (let pKey in el2._props) {
    if (el1._props[pKey] !== void 0 && el2._props[pKey] !== void 0) {
      if (el1._props[pKey].getValue() !== el2._props[pKey].getValue()) {
        propsChanges.__updated__[pKey] = el2._props[pKey];
      }
    }
  }
  if (Object.keys(propsChanges.__created__).length > 0 || Object.keys(propsChanges.__deleted__).length > 0 || Object.keys(propsChanges.__updated__).length > 0) {
    updates.push(propsChanges);
  }
  let stylesChanges = { __action__: "styles_updated", __key__: el2._key, __created__: {}, __deleted__: {}, __updated__: {} };
  for (let sKey in el2._styles) {
    if (el1._styles[sKey] === void 0) {
      stylesChanges.__created__[sKey] = el2._styles[sKey];
    }
  }
  for (let sKey in el1._styles) {
    if (el2._styles[sKey] === void 0) {
      stylesChanges.__deleted__[sKey] = el2._styles[sKey];
    }
  }
  for (let sKey in el2._styles) {
    if (el1._styles[sKey] !== void 0 && el2._styles[sKey] !== void 0) {
      if (el1._styles[sKey] !== el2._styles[sKey]) {
        stylesChanges.__updated__[sKey] = el2._styles[sKey];
      }
    }
  }
  if (Object.keys(stylesChanges.__created__).length > 0 || Object.keys(stylesChanges.__deleted__).length > 0 || Object.keys(stylesChanges.__updated__).length > 0) {
    updates.push(stylesChanges);
  }
  let cs = {};
  el2._children.forEach((child) => {
    cs[child._key] = child;
  });
  el1._children.forEach((child) => {
    if (cs[child._key]) {
      findChanges(el1._key, child, cs[child._key]);
    } else {
      updates.push(
        {
          __action__: "element_deleted",
          __key__: child._key,
          __parentKey__: el1._key
        }
      );
    }
  });
  cs = {};
  el1._children.forEach((child) => {
    cs[child._key] = child;
  });
  el2._children.forEach((child) => {
    if (!cs[child._key]) {
      updates.push(
        {
          __action__: "element_created",
          __key__: child._key,
          __element__: child,
          __parentKey__: el2._key
        }
      );
    }
  });
};
var diff = (el1, el2) => {
  updates = [];
  findChanges(void 0, el1, el2);
  return updates;
};
var json_default = { prettify, diff };

// widget/utils/executor.ts
var executeSingle = (code, meta) => {
  let callback = codeCallbacks[code.type];
  if (callback) {
    let r = callback(code, meta);
    return r;
  } else {
    return code;
  }
};
var executeBlock = (codes, meta) => {
  for (let i = 0; i < codes.length; i++) {
    let code = codes[i];
    let r = executeSingle(code, meta);
    if (r == null ? void 0 : r.returnFired)
      return r;
  }
};
var findLayer = (meta, id) => {
  for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
    let r = meta.creature._runtime.stack[i].findUnit(id);
    if (r !== void 0) {
      return meta.creature.runtime.stack[i];
    }
  }
};
var generateCallbackFunction = (code, meta) => {
  let newMetaBranch = meta;
  return (...args) => {
    let parameters = {};
    code.params.forEach((param, index) => {
      parameters[param.name] = args[index];
    });
    let firstParam = args[0];
    if (firstParam && firstParam instanceof ExecutionMeta_default && firstParam.isAnotherCreature) {
      newMetaBranch = firstParam;
    }
    newMetaBranch.creature.runtime.pushOnStack(parameters);
    let result = executeSingle(code.body, newMetaBranch);
    newMetaBranch.creature.runtime.popFromStack();
    return result == null ? void 0 : result.value;
  };
};
var codeCallbacks = {
  UnaryExpression: (code, meta) => {
    if (code.operator === "!") {
      return !executeSingle(code.argument, meta);
    }
  },
  LogicalExpression: (code, meta) => {
    if (code.operator === "&&") {
      return executeSingle(code.left, meta) && executeSingle(code.right, meta);
    } else if (code.operator === "||") {
      return executeSingle(code.left, meta) || executeSingle(code.right, meta);
    }
  },
  ConditionalExpression: (code, meta) => {
    return executeSingle(code.test, meta) ? executeSingle(code.consequent, meta) : executeSingle(code.alternate, meta);
  },
  ThisExpression: (code, meta) => {
    return meta.creature.thisObj;
  },
  JSXExpressionContainer: (code, meta) => {
    return executeSingle(code.expression, meta);
  },
  JSXText: (code, meta) => {
    return code.value.trim();
  },
  JSXElement: (code, meta) => {
    if (!code.cosmoId)
      code.cosmoId = utils_default.generator.generateKey();
    let Control = meta.creature.module.applet.findModule(code.openingElement.name.name);
    let attrs = {};
    code.openingElement.attributes.forEach((attr) => {
      attrs[attr.name.name] = executeSingle(attr.value, meta);
    });
    let key = attrs["key"];
    if (key === void 0) {
      key = code.cosmoId;
    }
    if (meta.parentJsxKey)
      key = meta.parentJsxKey + "-" + key;
    attrs["key"] = key;
    let c = meta.creature.module.applet.cache.elements[key];
    let isNew = c === void 0;
    c = Control.instantiate(attrs, attrs["style"], [], c == null ? void 0 : c.thisObj);
    let childMeta = new ExecutionMeta_default(__spreadProps(__spreadValues({}, meta), { parentJsxKey: key }));
    let children = code.children.map((child) => executeSingle(child, childMeta)).flat(Infinity).filter((child) => child !== "");
    c.fillChildren(children);
    if (meta.parentJsxKey)
      c.thisObj.parentJsxKey = meta.parentJsxKey;
    let newMetaBranch = utils_default.generator.nestedContext(c, __spreadProps(__spreadValues({}, meta), { parentJsxKey: key }));
    meta.creature.module.applet.cache.elements[key] = c;
    if (isNew)
      c.getBaseMethod("constructor")(newMetaBranch);
    if (meta.creature.module.applet.firstMount) {
      c.getBaseMethod("onMount")(newMetaBranch);
    } else {
      meta.creature.module.applet.cache.mounts.push(() => c.getBaseMethod("onMount")(newMetaBranch));
    }
    let r = c.getBaseMethod("render")(newMetaBranch);
    if (!meta.creature.module.applet.oldVersions[c._key]) {
      meta.creature.module.applet.oldVersions[c._key] = r;
    }
    return r;
  },
  Program: (code, meta) => {
    code.body.forEach((child) => {
      executeSingle(child, meta);
    });
  },
  Literal: (code, meta) => {
    return code.value;
  },
  FunctionExpression: (code, meta) => {
    let newCreatureBranch = new Creature_default(meta.creature.module, __spreadProps(__spreadValues({}, meta.creature), { runtime: meta.creature.runtime.clone() }));
    let newMetaBranch = new ExecutionMeta_default(__spreadProps(__spreadValues({}, meta), { creature: newCreatureBranch }));
    return generateCallbackFunction(code, newMetaBranch);
  },
  FunctionDeclaration: (code, meta) => {
    let newCreatureBranch = new Creature_default(meta.creature.module, __spreadProps(__spreadValues({}, meta.creature), { runtime: meta.creature.runtime.clone() }));
    let newMetaBranch = new ExecutionMeta_default(__spreadProps(__spreadValues({}, meta), { creature: newCreatureBranch }));
    meta.creature.runtime.stackTop.putUnit(code.id.name, generateCallbackFunction(code, newMetaBranch));
  },
  MethodDefinition: (code, meta) => {
    meta.creature.runtime.stackTop.putUnit(code.key.name, executeSingle(code.value, meta));
  },
  VariableDeclaration: (code, meta) => {
    if (code.kind === "let") {
      code.declarations.forEach((d) => executeSingle(d, new ExecutionMeta_default(__spreadProps(__spreadValues({}, meta), { declaration: true, declarationType: "let" }))));
    } else if (code.kind === "const") {
      code.declarations.forEach((d) => executeSingle(d, new ExecutionMeta_default(__spreadProps(__spreadValues({}, meta), { declaration: true, declarationType: "const" }))));
    }
  },
  VariableDeclarator: (code, meta) => {
    if (meta == null ? void 0 : meta.declaration) {
      let val = executeSingle(code.init, meta);
      if (code.id.type === "ObjectPattern") {
        code.id.properties.forEach((property) => {
          meta.creature.runtime.stackTop.putUnit(property.key.name, val[property.key.name]);
        });
      } else {
        meta.creature.runtime.stackTop.putUnit(code.id.name, val);
      }
    }
  },
  Identifier: (code, meta) => {
    if (meta.returnIdParent) {
      for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
        let wrapper = findLayer(meta, code.name);
        if (wrapper) {
          return { parent: wrapper.units, id: code.name };
        }
      }
    } else {
      for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
        let r = meta.creature.runtime.stack[i].findUnit(code.name);
        if (r !== void 0) {
          return r;
        }
      }
    }
  },
  BinaryExpression: (code, meta) => {
    if (code.operator === "+") {
      return executeSingle(code.left, meta) + executeSingle(code.right, meta);
    } else if (code.operator === "-") {
      return executeSingle(code.left, meta) - executeSingle(code.right, meta);
    } else if (code.operator === "*") {
      return executeSingle(code.left, meta) * executeSingle(code.right, meta);
    } else if (code.operator === "/") {
      return executeSingle(code.left, meta) / executeSingle(code.right, meta);
    } else if (code.operator === "^") {
      return Math.pow(executeSingle(code.left, meta), executeSingle(code.right, meta));
    } else if (code.operator === "%") {
      return executeSingle(code.left, meta) % executeSingle(code.right, meta);
    } else if (code.operator === "===") {
      return executeSingle(code.left, meta) === executeSingle(code.right, meta);
    } else if (code.operator === "<") {
      return executeSingle(code.left, meta) < executeSingle(code.right, meta);
    } else if (code.operator === ">") {
      return executeSingle(code.left, meta) > executeSingle(code.right, meta);
    } else if (code.operator === "&") {
      return executeSingle(code.left, meta) & executeSingle(code.right, meta);
    } else if (code.operator === "|") {
      return executeSingle(code.left, meta) | executeSingle(code.right, meta);
    }
  },
  IfStatement: (code, meta) => {
    if (executeSingle(code.test, meta)) {
      let r = executeSingle(code.consequent, meta);
      if (r == null ? void 0 : r.breakFired)
        return r;
      else if (r == null ? void 0 : r.returnFired)
        return r;
    } else if (code.alternate) {
      let r = executeSingle(code.alternate, meta);
      if (r == null ? void 0 : r.breakFired)
        return r;
      else if (r == null ? void 0 : r.returnFired)
        return r;
    }
  },
  BreakStatement: (code, meta) => {
    return { breakFired: true };
  },
  WhileStatement: (code, meta) => {
    while (executeSingle(code.test, meta)) {
      let r = executeSingle(code.body, meta);
      if (r == null ? void 0 : r.breakFired)
        break;
      else if (r == null ? void 0 : r.returnFired)
        return r;
    }
  },
  BlockStatement: (code, meta) => {
    var _a;
    for (let i = 0; i < ((_a = code.body) == null ? void 0 : _a.length); i++) {
      let r = executeSingle(code.body[i], meta);
      if (r == null ? void 0 : r.breakFired)
        return r;
      else if (r == null ? void 0 : r.returnFired)
        return r;
    }
  },
  ExpressionStatement: (code, meta) => {
    return executeSingle(code.expression, meta);
  },
  AssignmentExpression: (code, meta) => {
    let right = executeSingle(code.right, meta);
    let wrapper = executeSingle(code.left, __spreadProps(__spreadValues({}, meta), { returnIdParent: true }));
    if (wrapper) {
      if (wrapper.parent !== void 0) {
        let before = wrapper.parent[wrapper.id];
        if (code.operator === "=") {
          wrapper.parent[wrapper.id] = right;
        } else if (code.operator === "+=") {
          wrapper.parent[wrapper.id] = before + right;
        } else if (code.operator === "-=") {
          wrapper.parent[wrapper.id] = before - right;
        } else if (code.operator === "*=") {
          wrapper.parent[wrapper.id] = before * right;
        } else if (code.operator === "/=") {
          wrapper.parent[wrapper.id] = before / right;
        } else if (code.operator === "^=") {
          wrapper.parent[wrapper.id] = Math.pow(before, right);
        } else if (code.operator === "%=") {
          wrapper.parent[wrapper.id] = before % right;
        }
      } else {
        let layer = findLayer(meta, wrapper.id);
        if (layer) {
          let r = layer.findUnit(wrapper.id);
          if (r) {
            if (code.operator === "=") {
              r = right;
            } else if (code.operator === "+=") {
              r += right;
            } else if (code.operator === "-=") {
              r -= right;
            } else if (code.operator === "*=") {
              r *= right;
            } else if (code.operator === "/=") {
              r /= right;
            } else if (code.operator === "^=") {
              r = Math.pow(r, right);
            } else if (code.operator === "%=") {
              r %= right;
            }
            layer.putUnit(code.name, r);
          }
        }
      }
    }
  },
  ForStatement: (code, meta) => {
    for (executeSingle(code.init, meta); executeSingle(code.test, meta); executeSingle(code.update, meta)) {
      let r = executeSingle(code.body, meta);
      if (r == null ? void 0 : r.breakFired)
        break;
      else if (r == null ? void 0 : r.returnFired)
        return r;
    }
  },
  UpdateExpression: (code, meta) => {
    if (["++", "--"].includes(code.operator)) {
      let wrapper = executeSingle(code.argument, __spreadProps(__spreadValues({}, meta), { returnIdParent: true }));
      if (wrapper) {
        if (wrapper.parent !== void 0) {
          let before = wrapper.parent[wrapper.id];
          if (typeof before === "number") {
            if (code.operator === "++")
              before++;
            else if (code.operator === "--")
              before--;
            wrapper.parent[wrapper.id] = before;
          }
        } else {
          let layer = findLayer(meta, wrapper.id);
          if (layer) {
            let r = layer.findUnit(wrapper.id);
            if (r) {
              if (typeof r === "number") {
                if (code.operator === "++")
                  r++;
                else if (code.operator === "--")
                  r--;
                layer.putUnit(code.name, r);
              }
            }
          }
        }
      }
    }
  },
  CallExpression: (code, meta) => {
    let prop = void 0;
    if (code.property === void 0) {
      let r = executeSingle(code.callee, meta);
      return r(...code.arguments.map((c) => executeSingle(c, meta)));
    } else {
      if (code.callee.property.type === "Identifier") {
        prop = code.callee.property.name;
      }
      let r = executeSingle(code.callee.object, meta);
      return r[prop](...code.arguments.map((c) => executeSingle(c, meta)));
    }
  },
  MemberExpression: (code, meta) => {
    let prop = void 0;
    if (code.property === void 0) {
      let r = executeSingle(code.object, meta);
      if (meta.returnIdParent) {
        return { parent: void 0, id: code.name };
      } else {
        return r;
      }
    } else {
      if (code.computed) {
        prop = executeSingle(code.property, meta);
      } else {
        if (code.property.type === "Identifier") {
          prop = code.property.name;
        } else if (code.property.type === "Literal") {
          prop = code.property.value;
        }
      }
      let filteredMeta = __spreadValues({}, meta);
      delete filteredMeta["returnIdParent"];
      let r = executeSingle(code.object, filteredMeta);
      if (Array.isArray(r)) {
        let p = r[prop];
        if (typeof p === "function") {
          return (...args) => {
            switch (prop) {
              case "push": {
                return r.push(...args);
              }
              case "map": {
                return r.map(...args);
              }
              case "forEach": {
                return r.forEach(...args);
              }
              default: {
              }
            }
          };
        } else {
          if (meta.returnIdParent) {
            return { parent: r, id: prop };
          } else {
            return r[prop];
          }
        }
      } else {
        if (meta.returnIdParent) {
          return { parent: r, id: prop };
        } else {
          return r[prop];
        }
      }
    }
  },
  SwitchStatement: (code, meta) => {
    let disc = executeSingle(code.discriminant, meta);
    for (let i = 0; i < code.cases.length; i++) {
      let c = code.cases[i];
      if (c.type === "SwitchCase") {
        let caseCond = executeSingle(c.test, meta);
        if (disc === caseCond) {
          for (let j = 0; j < c.consequent.lengthl; j++) {
            let co = c.consequent[j];
            let r = executeSingle(co, meta);
            if (r == null ? void 0 : r.returnFired)
              return r;
          }
        }
      }
    }
  },
  ArrowFunctionExpression: (code, meta) => {
    let newCreatureBranch = new Creature_default(meta.creature.module, __spreadProps(__spreadValues({}, meta.creature), { runtime: meta.creature.runtime.clone() }));
    let newMetaBranch = new ExecutionMeta_default(__spreadProps(__spreadValues({}, meta), { creature: newCreatureBranch }));
    return generateCallbackFunction(code, newMetaBranch);
  },
  ObjectExpression: (code, meta) => {
    let obj = {};
    code.properties.forEach((property) => {
      if (property.type === "Property") {
        if (property.key.type === "Identifier") {
          obj[property.key.name] = executeSingle(property.value, meta);
        }
      } else {
        if (property.type === "SpreadElement") {
          obj[property.argument.name] = executeSingle(property, meta);
        }
      }
    });
    return obj;
  },
  ArrayExpression: (code, meta) => {
    let result = [];
    code.elements.forEach((arrEl) => {
      let r = executeSingle(arrEl, meta);
      if (arrEl.type === "SpreadElement" && Array.isArray(r)) {
        result.push(...r);
      } else {
        result.push(r);
      }
    });
    return result;
  },
  SpreadElement: (code, meta) => {
    let source = executeSingle(code.argument, meta);
    if (Array.isArray(source)) {
      return [...source];
    } else {
      return __spreadValues({}, source);
    }
  },
  ReturnStatement: (code, meta) => {
    return { value: executeSingle(code.argument, meta), returnFired: true };
  }
};
var executor_default = { executeSingle, executeBlock, ExecutionMeta: ExecutionMeta_default };

// widget/utils/index.ts
var utils_default = { generator: generator_default, compiler: compiler_default, json: json_default, executor: executor_default };

// widget/Runtime.ts
var Runtime = class _Runtime {
  constructor(module, creature, reusableTools) {
    this.stack = [];
    this._module = module;
    this._creature = creature;
    this._native = (reusableTools == null ? void 0 : reusableTools.native) ? reusableTools.native : this._module.applet._nativeBuilder(this._module);
    if (reusableTools == null ? void 0 : reusableTools.stack) {
      this.stack = reusableTools.stack;
    } else {
      this.reset();
    }
  }
  get module() {
    return this._module;
  }
  get creature() {
    return this._creature;
  }
  get native() {
    return this._native;
  }
  pushOnStack(initialUnits) {
    this.stack.push(new MemoryLayer_default(initialUnits));
  }
  popFromStack() {
    this.stack.pop();
  }
  get stackTop() {
    return this.stack[this.stack.length - 1];
  }
  resetStack() {
    this.stack = [];
    this.pushOnStack(__spreadValues({}, this._native));
  }
  reset() {
    this.resetStack();
  }
  execute(ast) {
    utils_default.executor.executeBlock(ast, new utils_default.executor.ExecutionMeta({ creature: this._creature }));
  }
  load() {
    this.execute(this.module.ast.body.body);
  }
  clone() {
    let copy = new _Runtime(this.module, this.creature, { native: this.native, stack: new Array(...this.stack) });
    return copy;
  }
};
var Runtime_default = Runtime;

// widget/Creature.ts
var Creature = class {
  get key() {
    return this._key;
  }
  get cosmoId() {
    return this._cosmoId;
  }
  setCosmoId(cosmoId) {
    this._cosmoId = cosmoId;
  }
  get module() {
    return this._module;
  }
  get runtime() {
    return this._runtime;
  }
  get dom() {
    return this._dom;
  }
  getBaseMethod(methodId) {
    return this._runtime.stack[0].findUnit(methodId);
  }
  update(props, styles, children) {
    this.thisObj = __spreadProps(__spreadValues({}, this.thisObj), {
      props,
      styles,
      children
    });
  }
  fillChildren(children) {
    this.thisObj.children = children;
  }
  constructor(module, defaultValues) {
    this._key = (defaultValues == null ? void 0 : defaultValues._key) ? defaultValues._key : utils_default.generator.generateKey();
    this._cosmoId = defaultValues == null ? void 0 : defaultValues.cosmoId;
    this._module = module;
    this._dom = (defaultValues == null ? void 0 : defaultValues.dom) ? defaultValues.dom : new DOM_default(this._module, this);
    this._runtime = (defaultValues == null ? void 0 : defaultValues.runtime) ? defaultValues.runtime : new Runtime_default(this._module, this);
    this.thisObj = defaultValues == null ? void 0 : defaultValues.thisObj;
    if (!(defaultValues == null ? void 0 : defaultValues.runtime)) {
      this._runtime.load();
    }
    if (!this.thisObj) {
      this.thisObj = {};
      Object.keys(this._runtime.stack[0].units).forEach((k) => {
        if (!this._runtime.native[k] || k === "constructor") {
          this.thisObj[k] = this._runtime.stack[0].units[k];
        }
      });
      this.thisObj = {};
    }
    this.thisObj["setState"] = (stateUpdate) => {
      console.log(stateUpdate);
      this.thisObj["state"] = __spreadValues(__spreadValues({}, this.thisObj["state"]), stateUpdate);
      let newMetaBranch = new ExecutionMeta_default({ creature: this, parentJsxKey: this.thisObj["parentJsxKey"] });
      let newRender = this.getBaseMethod("render")(newMetaBranch);
      this._module.applet.onCreatureStateChange(this, newRender);
    };
  }
};
var Creature_default = Creature;

// widget/CreatureStore.ts
var CreatureStore = class {
  putCreature(creature) {
    this._store[creature.key] = creature;
  }
  removeCreature(key) {
    delete this._store[key];
  }
  findCreature(key) {
    return this._store[key];
  }
  constructor() {
    this._store = {};
  }
};
var CreatureStore_default = CreatureStore;

// widget/FuncStore.ts
var FuncStore = class {
  get store() {
    return this._store;
  }
  putFunc(func) {
    this._store[func.key] = func;
  }
  removeFunc(key) {
    delete this._store[key];
  }
  findFunc(key) {
    return this._store[key];
  }
  constructor() {
    this._store = {};
  }
};
var FuncStore_default = FuncStore;

// widget/Module.ts
var Module = class {
  get applet() {
    return this._applet;
  }
  setApplet(applet) {
    this._applet = applet;
  }
  get creatures() {
    return this._creatures;
  }
  get key() {
    return this._key;
  }
  get funcs() {
    return this._funcs;
  }
  get dom() {
    return this._dom;
  }
  get ast() {
    return this._ast;
  }
  setAst(ast) {
    this._ast = ast;
  }
  instantiate(props, styles, children, thisObj) {
    let creature = new Creature_default(
      this,
      {
        cosmoId: props == null ? void 0 : props.key,
        thisObj: thisObj ? __spreadProps(__spreadValues({}, thisObj), {
          props: props ? props : {},
          styles: styles ? styles : {},
          children: children ? children : []
        }) : {
          props: props ? props : {},
          styles: styles ? styles : {},
          children: children ? children : []
        }
      }
    );
    this._creatures.putCreature(creature);
    return creature;
  }
  constructor(key, applet, ast) {
    this._key = key;
    this._applet = applet;
    this._ast = ast;
    this._creatures = new CreatureStore_default();
    this._funcs = new FuncStore_default();
    this._dom = new DOM_default(this);
  }
};
var Module_default = Module;

// widget/Applet.ts
var Runnable = class {
  constructor(root, mount) {
    this.root = root;
    this.mount = mount;
  }
};
var Applet = class {
  constructor(key, modules) {
    this.cache = {
      elements: {},
      mounts: []
    };
    this.oldVersions = {};
    this.firstMount = false;
    this._key = key;
    this._modules = modules ? modules : {};
  }
  get key() {
    return this._key;
  }
  findModule(id) {
    return this._modules[id];
  }
  putModule(module) {
    module.setApplet(this);
    this._modules[module.key] = module;
  }
  removeModule(key) {
    delete this._modules[key];
  }
  fill(jsxCode) {
    this.middleCode = utils_default.compiler.parse(jsxCode);
    console.log(JSON.stringify(this.middleCode));
    let r = utils_default.compiler.extractModules(this.middleCode, this);
    r.forEach((module) => this.putModule(module));
  }
  onCreatureStateChange(creature, newVersion) {
    let oldVersion = this.oldVersions[creature._key];
    this.oldVersions[creature._key] = newVersion;
    let updates2 = utils_default.json.diff(oldVersion, newVersion);
    updates2.forEach((u) => {
      if (u.__action__ === "element_deleted") {
        let keys2 = Object.keys(this.cache.elements).filter((k) => {
          if (k.startsWith(u.__key__)) {
            delete this.cache.elements[k];
            return true;
          } else {
            return false;
          }
        });
        if (keys2.length > 0) {
          let temp = keys2[keys2.length - 1].split("-");
          if (temp.length > 1) {
            let temp2 = temp.slice(0, temp.length - 1).join("-");
            delete this.cache.elements[temp2];
          }
        }
      }
    });
    this.update(oldVersion._key, updates2);
  }
  run(genesis, nativeBuilder, update) {
    return new Promise((resolve) => {
      this._nativeBuilder = nativeBuilder;
      this.update = update;
      this.firstMount = false;
      this.cache.elements = {};
      this.cache.mounts = [];
      let genesisMod = this._modules[genesis];
      this._genesisCreature = genesisMod.instantiate();
      let genesisMetaContext = utils_default.generator.nestedContext(this._genesisCreature);
      this.cache.mounts.push(() => this._genesisCreature.getBaseMethod("onMount")(genesisMetaContext));
      this._genesisCreature.getBaseMethod("constructor")(genesisMetaContext);
      let view = this._genesisCreature.getBaseMethod("render")(genesisMetaContext);
      this.oldVersions[this._genesisCreature._key] = view;
      resolve(
        new Runnable(
          view,
          () => {
            this.firstMount = true;
            this.cache.mounts.reverse().forEach((onMount) => onMount());
          }
        )
      );
    });
  }
};
var Applet_default = Applet;

// widget/controls/BaseControl.ts
var BaseControl = class {
};
var BaseControl_default = BaseControl;

// widget/controls/BoxControl.ts
var _BoxControl = class _BoxControl extends BaseControl_default {
  static instantiate(overridenProps, overridenStyles, children) {
    return utils_default.generator.prepareElement(_BoxControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
};
_BoxControl.TYPE = "box";
_BoxControl.defaultProps = {};
_BoxControl.defaultStyles = {
  width: 200,
  height: 200
};
var BoxControl = _BoxControl;
var BoxControl_default = BoxControl;

// widget/props/BaseProp.ts
var BaseProp = class {
  get type() {
    return this._type;
  }
  constructor(type) {
    this._type = type;
  }
};
var BaseProp_default = BaseProp;

// widget/props/StringProp.ts
var StringProp = class extends BaseProp_default {
  constructor(defaultValue) {
    super("string");
    this._value = defaultValue;
    this._defaultValue = defaultValue;
  }
  get value() {
    return this._value;
  }
  setValue(v) {
    this._value = v;
  }
  getValue() {
    return this._value;
  }
  get defaultValue() {
    return this._defaultValue;
  }
};
var StringProp_default = StringProp;

// widget/props/FuncProp.ts
var FuncProp = class extends BaseProp_default {
  constructor(defaultValue) {
    super("function");
    this._value = defaultValue;
    this._defaultValue = defaultValue;
  }
  get value() {
    return this._value;
  }
  setValue(v) {
    this._value = v;
  }
  getValue() {
    return this._value;
  }
  get defaultValue() {
    return this._defaultValue;
  }
};
var FuncProp_default = FuncProp;

// widget/controls/ButtonControl.ts
var _ButtonControl = class _ButtonControl extends BaseControl_default {
  static instantiate(overridenProps, overridenStyles, children) {
    return utils_default.generator.prepareElement(_ButtonControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
};
_ButtonControl.TYPE = "button";
_ButtonControl.defaultProps = {
  caption: new StringProp_default(""),
  variant: new StringProp_default("filled"),
  onClick: new FuncProp_default(void 0)
};
_ButtonControl.defaultStyles = {
  width: 150,
  height: "auto"
};
var ButtonControl = _ButtonControl;
var ButtonControl_default = ButtonControl;

// widget/controls/CardControl.ts
var _CardControl = class _CardControl extends BaseControl_default {
  static instantiate(overridenProps, overridenStyles, children) {
    return utils_default.generator.prepareElement(_CardControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
};
_CardControl.TYPE = "card";
_CardControl.defaultProps = {};
_CardControl.defaultStyles = {
  width: 200,
  height: 200,
  boxShadow: "rgba(0, 0, 0, 0.24) 0px 3px 8px",
  backgroundColor: "#fff",
  borderRadius: 4
};
var CardControl = _CardControl;
var CardControl_default = CardControl;

// widget/controls/TabsControl.ts
var _TabsControl = class _TabsControl extends BaseControl_default {
  static instantiate(overridenProps, overridenStyles, children) {
    return utils_default.generator.prepareElement(_TabsControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
};
_TabsControl.TYPE = "tabs";
_TabsControl.defaultProps = {
  onChange: new FuncProp_default(void 0)
};
_TabsControl.defaultStyles = {};
var TabsControl = _TabsControl;
var TabsControl_default = TabsControl;

// widget/controls/PrimaryTabControl.ts
var _PrimaryTabControl = class _PrimaryTabControl extends BaseControl_default {
  static instantiate(overridenProps, overridenStyles, children) {
    return utils_default.generator.prepareElement(_PrimaryTabControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
};
_PrimaryTabControl.TYPE = "primary-tab";
_PrimaryTabControl.defaultProps = {};
_PrimaryTabControl.defaultStyles = {};
var PrimaryTabControl = _PrimaryTabControl;
var PrimaryTabControl_default = PrimaryTabControl;

// widget/controls/TextControl.ts
var _TextControl = class _TextControl extends BaseControl_default {
  static instantiate(overridenProps, overridenStyles, children) {
    return utils_default.generator.prepareElement(_TextControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
};
_TextControl.TYPE = "text";
_TextControl.defaultProps = {
  text: new StringProp_default("")
};
_TextControl.defaultStyles = {
  width: 150,
  height: "auto"
};
var TextControl = _TextControl;
var TextControl_default = TextControl;

// widget/controls/index.ts
var controls_default = {
  [TextControl_default.TYPE]: TextControl_default,
  [ButtonControl_default.TYPE]: ButtonControl_default,
  [BoxControl_default.TYPE]: BoxControl_default,
  [CardControl_default.TYPE]: CardControl_default,
  [TabsControl_default.TYPE]: TabsControl_default,
  [PrimaryTabControl_default.TYPE]: PrimaryTabControl_default
};

// widget/INative.ts
var INative = class {
  get key() {
    return this._module.key;
  }
  constructor(module) {
    this._module = module;
  }
};
var INative_default = INative;
export {
  Applet_default as Applet,
  controls_default as Controls,
  INative_default as INative,
  Module_default as Module,
  Runnable,
  utils_default as Utils
};
//# sourceMappingURL=index.mjs.map
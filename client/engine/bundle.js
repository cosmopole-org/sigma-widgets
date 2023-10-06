(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _INative = _interopRequireDefault(require("./widget/INative"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class Native extends _INative.default {
  globalMemory = {};
  intervals = {};
  timeouts = {};
  console = {
    log: (...strs) => {
      console.log(...strs);
    }
  };
  setInterval = (callback, period) => {
    this.intervals[setInterval(callback, period) + ''] = true;
  };
  setTimeout = (callback, timeout) => {
    this.timeouts[setTimeout(callback, timeout) + ''] = true;
  };
}
var _default = exports.default = Native;

},{"./widget/INative":10}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Module = _interopRequireDefault(require("./widget/Module"));
var _Native = _interopRequireDefault(require("./Native"));
var _Applet = _interopRequireWildcard(require("./widget/Applet"));
var _utils = _interopRequireDefault(require("./widget/utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var _default = exports.default = {
  Module: _Module.default,
  Native: _Native.default,
  Applet: _Applet.default,
  Runnable: _Applet.Runnable,
  Utils: _utils.default
};

window.engine = _default

},{"./Native":1,"./widget/Applet":3,"./widget/Module":12,"./widget/utils":23}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Runnable = void 0;
var _Module = _interopRequireDefault(require("./Module"));
var _utils = _interopRequireDefault(require("./utils"));
var _INative = _interopRequireDefault(require("./INative"));
var _Creature = _interopRequireDefault(require("./Creature"));
var _BaseElement = _interopRequireDefault(require("./elements/BaseElement"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class Runnable {
  root;
  mount;
  constructor(root, mount) {
    this.root = root;
    this.mount = mount;
  }
}
exports.Runnable = Runnable;
class Applet {
  _key;
  get key() {
    return this._key;
  }
  _genesisCreature;
  _nativeBuilder;
  _modules;
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
  middleCode;
  fill(middleCode) {
    this.middleCode = middleCode;
    let r = _utils.default.compiler.extractModules(this.middleCode, this);
    r.forEach(module => this.putModule(module));
  }
  cache = {
    elements: {},
    mounts: []
  };
  oldVersions = {};
  onCreatureStateChange(creature, newVersion) {
    let oldVersion = this.oldVersions[creature._key];
    this.oldVersions[creature._key] = newVersion;
    this.update(_utils.default.json.diff(oldVersion, newVersion));
  }
  update;
  run(genesis, nativeBuilder, update) {
    return new Promise(resolve => {
      this._nativeBuilder = nativeBuilder;
      this.update = update;
      this.cache.elements = {};
      this.cache.mounts = [];
      let genesisMod = this._modules[genesis];
      this._genesisCreature = genesisMod.instantiate();
      let genesisMetaContext = _utils.default.generator.nestedContext(this._genesisCreature);
      this.cache.mounts.push(() => this._genesisCreature.getBaseMethod('onMount')(genesisMetaContext));
      this._genesisCreature.getBaseMethod('constructor')(genesisMetaContext);
      let view = this._genesisCreature.getBaseMethod('render')(genesisMetaContext);
      this.oldVersions[this._genesisCreature._key] = view;
      resolve(new Runnable(view, () => {
        this.cache.mounts.reverse().forEach(onMount => onMount());
      }));
    });
  }
  constructor(key, modules) {
    this._key = key;
    this._modules = modules ? modules : {};
  }
}
var _default = exports.default = Applet;

},{"./Creature":4,"./INative":10,"./Module":12,"./elements/BaseElement":17,"./utils":23}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _DOM = _interopRequireDefault(require("./DOM"));
var _Module = _interopRequireDefault(require("./Module"));
var _Runtime = _interopRequireDefault(require("./Runtime"));
var _BaseElement = _interopRequireDefault(require("./elements/BaseElement"));
var _utils = _interopRequireDefault(require("./utils"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class Creature {
  _key;
  get key() {
    return this._key;
  }
  _cosmoId;
  get cosmoId() {
    return this._cosmoId;
  }
  setCosmoId(cosmoId) {
    this._cosmoId = cosmoId;
  }
  _module;
  get module() {
    return this._module;
  }
  _runtime;
  get runtime() {
    return this._runtime;
  }
  _dom;
  get dom() {
    return this._dom;
  }
  thisObj;
  getBaseMethod(methodId) {
    return this._runtime.stack[0].findUnit(methodId);
  }
  constructor(module, defaultValues) {
    this._key = defaultValues?._key ? defaultValues._key : _utils.default.generator.generateKey();
    this._cosmoId = defaultValues?.cosmoId;
    this._module = module;
    this._dom = defaultValues?.dom ? defaultValues.dom : new _DOM.default(this._module, this);
    this._runtime = defaultValues?.runtime ? defaultValues.runtime : new _Runtime.default(this._module, this);
    this.thisObj = defaultValues?.thisObj;
    if (!defaultValues?.runtime) {
      this._runtime.load();
    }
    if (!this.thisObj) {
      this.thisObj = {};
      Object.keys(this._runtime.stack[0].units).forEach(k => {
        if (!this._runtime.native[k] || k === 'constructor') {
          this.thisObj[k] = this._runtime.stack[0].units[k];
        }
      });
      this.thisObj = {};
    }
    this.thisObj['setState'] = stateUpdate => {
      this.thisObj['state'] = {
        ...this.thisObj['state'],
        ...stateUpdate
      };
      let newMetaBranch = _utils.default.generator.nestedContext(this);
      let newRender = this.getBaseMethod('render')(newMetaBranch);
      this._module.applet.onCreatureStateChange(this, newRender);
    };
  }
}
var _default = exports.default = Creature;

},{"./DOM":6,"./Module":12,"./Runtime":13,"./elements/BaseElement":17,"./utils":23}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Creature = _interopRequireDefault(require("./Creature"));
var _Func = _interopRequireDefault(require("./Func"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class CreatureStore {
  _store;
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
}
var _default = exports.default = CreatureStore;

},{"./Creature":4,"./Func":8}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Creature = _interopRequireDefault(require("./Creature"));
var _Module = _interopRequireDefault(require("./Module"));
var _BaseElement = _interopRequireDefault(require("./elements/BaseElement"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class DOM {
  _module;
  get module() {
    return this._module;
  }
  _creature;
  get creature() {
    return this._creature;
  }
  _root;
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
}
var _default = exports.default = DOM;

},{"./Creature":4,"./Module":12,"./elements/BaseElement":17}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Creature = _interopRequireDefault(require("./Creature"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class ExecutionMeta {
  creature;
  declaration;
  declarationType;
  returnIdParent;
  isAnotherCreature;
  parentJsxKey;
  constructor(metaDict) {
    this.creature = metaDict.creature;
    this.declaration = metaDict.declaration === true;
    this.declarationType = metaDict.declarationType;
    this.returnIdParent = metaDict.returnIdParent;
    this.isAnotherCreature = metaDict.isAnotherCreature;
    this.parentJsxKey = metaDict.parentJsxKey;
    if (this.declaration && !this.declarationType) {
      // TODO: throw invalid execution metadata exception
    }
  }
}
var _default = exports.default = ExecutionMeta;

},{"./Creature":4}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _utils = _interopRequireDefault(require("./utils"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class Func {
  _key;
  get key() {
    return this._key;
  }
  _code;
  get code() {
    return this._code;
  }
  setCode(code) {
    this._code = code;
  }
  _ast;
  get ast() {
    return this._ast;
  }
  setAst(ast) {
    this._ast = ast;
  }
  constructor(code, ast) {
    this._key = _utils.default.generator.generateKey();
    this._code = code;
    this._ast = ast;
  }
}
var _default = exports.default = Func;

},{"./utils":23}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Func = _interopRequireDefault(require("./Func"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class FuncStore {
  _store;
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
}
var _default = exports.default = FuncStore;

},{"./Func":8}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Module = _interopRequireDefault(require("./Module"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class INative {
  _module;
  get key() {
    return this._module.key;
  }
  constructor(module) {
    this._module = module;
  }
}
var _default = exports.default = INative;

},{"./Module":12}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Func = _interopRequireDefault(require("./Func"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class MemoryLayer {
  _units;
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
}
var _default = exports.default = MemoryLayer;

},{"./Func":8}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Applet = _interopRequireDefault(require("./Applet"));
var _Creature = _interopRequireDefault(require("./Creature"));
var _CreatureStore = _interopRequireDefault(require("./CreatureStore"));
var _DOM = _interopRequireDefault(require("./DOM"));
var _FuncStore = _interopRequireDefault(require("./FuncStore"));
var _Runtime = _interopRequireDefault(require("./Runtime"));
var _BaseElement = _interopRequireDefault(require("./elements/BaseElement"));
var _utils = _interopRequireDefault(require("./utils"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class Module {
  _applet;
  get applet() {
    return this._applet;
  }
  setApplet(applet) {
    this._applet = applet;
  }
  _creatures;
  get creatures() {
    return this._creatures;
  }
  _key;
  get key() {
    return this._key;
  }
  _funcs;
  get funcs() {
    return this._funcs;
  }
  _dom;
  get dom() {
    return this._dom;
  }
  _ast;
  get ast() {
    return this._ast;
  }
  setAst(ast) {
    this._ast = ast;
  }
  instantiate(props, styles, children, thisObj) {
    let creature = new _Creature.default(this, {
      cosmoId: props?.key,
      thisObj: thisObj ? {
        ...thisObj,
        props: props ? props : {},
        styles: styles ? styles : {},
        children: children ? children : []
      } : {
        props: props ? props : {},
        styles: styles ? styles : {},
        children: children ? children : []
      }
    });
    this._creatures.putCreature(creature);
    return creature;
  }
  constructor(key, applet, ast) {
    this._key = key;
    this._applet = applet;
    this._ast = ast;
    this._creatures = new _CreatureStore.default();
    this._funcs = new _FuncStore.default();
    this._dom = new _DOM.default(this);
  }
}
var _default = exports.default = Module;

},{"./Applet":3,"./Creature":4,"./CreatureStore":5,"./DOM":6,"./FuncStore":9,"./Runtime":13,"./elements/BaseElement":17,"./utils":23}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Creature = _interopRequireDefault(require("./Creature"));
var _INative = _interopRequireDefault(require("./INative"));
var _MemoryLayer = _interopRequireDefault(require("./MemoryLayer"));
var _Module = _interopRequireDefault(require("./Module"));
var _utils = _interopRequireDefault(require("./utils"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class Runtime {
  _module;
  get module() {
    return this._module;
  }
  _creature;
  get creature() {
    return this._creature;
  }
  _native;
  get native() {
    return this._native;
  }
  stack = [];
  pushOnStack(initialUnits) {
    this.stack.push(new _MemoryLayer.default(initialUnits));
  }
  popFromStack() {
    this.stack.pop();
  }
  get stackTop() {
    return this.stack[this.stack.length - 1];
  }
  resetStack() {
    this.stack = [];
    this.pushOnStack({
      ...this._native
    });
  }
  reset() {
    this.resetStack();
  }
  execute(ast) {
    _utils.default.executor.executeBlock(ast, new _utils.default.executor.ExecutionMeta({
      creature: this._creature
    }));
  }
  load() {
    this.execute(this.module.ast.body.body);
  }
  clone() {
    let copy = new Runtime(this.module, this.creature, {
      native: this.native,
      stack: new Array(...this.stack)
    });
    return copy;
  }
  constructor(module, creature, reusableTools) {
    this._module = module;
    this._creature = creature;
    this._native = reusableTools?.native ? reusableTools.native : this._module.applet._nativeBuilder(this._module);
    if (reusableTools?.stack) {
      this.stack = reusableTools.stack;
    } else {
      this.reset();
    }
  }
}
var _default = exports.default = Runtime;

},{"./Creature":4,"./INative":10,"./MemoryLayer":11,"./Module":12,"./utils":23}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
class BaseControl {}
var _default = exports.default = BaseControl;

},{}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseControl = _interopRequireDefault(require("./BaseControl"));
var _StringProp = _interopRequireDefault(require("../props/StringProp"));
var _utils = _interopRequireDefault(require("../utils"));
var _BaseElement = _interopRequireDefault(require("../elements/BaseElement"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class TextControl extends _BaseControl.default {
  static TYPE = 'text';
  static defaultProps = {
    text: new _StringProp.default('')
  };
  static defaultStyles = {
    width: 150,
    height: 'auto'
  };
  static instantiate(overridenProps, overridenStyles, children) {
    return _utils.default.generator.prepareElement(TextControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
}
var _default = exports.default = TextControl;

},{"../elements/BaseElement":17,"../props/StringProp":19,"../utils":23,"./BaseControl":14}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _TextControl = _interopRequireDefault(require("./TextControl"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var _default = exports.default = {
  [_TextControl.default.TYPE]: _TextControl.default
};

},{"./TextControl":15}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseProp = _interopRequireDefault(require("../props/BaseProp"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class BaseElement {
  _key;
  get key() {
    return this._key;
  }
  _controlType;
  get controlType() {
    return this._controlType;
  }
  _props;
  get props() {
    return this._props;
  }
  _styles;
  get styles() {
    return this._styles;
  }
  _children;
  get children() {
    return this._children;
  }
  constructor(key, controlType, props, styles, children) {
    this._key = key;
    this._controlType = controlType;
    this._props = props;
    this._styles = styles;
    this._children = children ? children : [];
  }
}
var _default = exports.default = BaseElement;

},{"../props/BaseProp":18}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
class BaseProp {
  _type;
  get type() {
    return this._type;
  }
  setValue(value) {}
  constructor(type) {
    this._type = type;
  }
}
var _default = exports.default = BaseProp;

},{}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseProp = _interopRequireDefault(require("./BaseProp"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class StringProp extends _BaseProp.default {
  _value;
  get value() {
    return this._value;
  }
  setValue(v) {
    this._value = v;
  }
  _defaultValue;
  get defaultValue() {
    return this._defaultValue;
  }
  constructor(defaultValue) {
    super('string');
    this._value = defaultValue;
    this._defaultValue = defaultValue;
  }
}
var _default = exports.default = StringProp;

},{"./BaseProp":18}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Applet = _interopRequireDefault(require("../Applet"));
var _Module = _interopRequireDefault(require("../Module"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
// let jsxCompiler = AcornParser.extend(jsx());

// let parse = (jsxCode) => {
//     return jsxCompiler.parse(jsxCode, { sourceType: 'module', ecmaVersion: 'latest' });
// }
let extractModules = (middleCode, applet) => {
  return middleCode.body.filter(declaration => declaration.type === 'ClassDeclaration').map(declaration => {
    return new _Module.default(declaration.id.name, applet, declaration);
  });
};
var _default = exports.default = {
  extractModules
};

},{"../Applet":3,"../Module":12}],21:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseElement = _interopRequireDefault(require("../elements/BaseElement"));
var _Creature = _interopRequireDefault(require("../Creature"));
var _index = _interopRequireDefault(require("../controls/index"));
var _ExecutionMeta = _interopRequireDefault(require("../ExecutionMeta"));
var _ = _interopRequireDefault(require("."));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let executeSingle = (code, meta) => {
  let callback = codeCallbacks[code.type];
  if (callback) {
    let r = callback(code, meta);
    return r;
  } else {
    return code;
  }
};
let executeBlock = (codes, meta) => {
  for (let i = 0; i < codes.length; i++) {
    let code = codes[i];
    let r = executeSingle(code, meta);
    if (r?.returnFired) return r;
  }
};
let findLayer = (meta, id) => {
  for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
    let r = meta.creature.runtime.stack[i].findUnit(id);
    if (r) {
      return meta.creature.runtime.stack[i];
    }
  }
};
const generateCallbackFunction = (code, meta) => {
  let newMetaBranch = meta;
  return (...args) => {
    let parameters = {};
    code.params.forEach((param, index) => {
      parameters[param.name] = args[index];
    });
    let firstParam = args[0];
    if (firstParam && firstParam instanceof _ExecutionMeta.default && firstParam.isAnotherCreature) {
      newMetaBranch = firstParam;
    }
    newMetaBranch.creature.runtime.pushOnStack(parameters);
    let result = executeSingle(code.body, newMetaBranch);
    newMetaBranch.creature.runtime.popFromStack();
    return result?.value;
  };
};
let codeCallbacks = {
  UnaryExpression: (code, meta) => {
    if (code.operator === '!') {
      return !executeSingle(code.argument, meta);
    }
  },
  LogicalExpression: (code, meta) => {
    if (code.operator === '&&') {
      return executeSingle(code.left, meta) && executeSingle(code.right, meta);
    } else if (code.operator === '||') {
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
    if (!code.cosmoId) code.cosmoId = _.default.generator.generateKey();
    let Control = _index.default[code.openingElement.name.name];
    if (!Control) {
      Control = meta.creature.module.applet.findModule(code.openingElement.name.name);
    }
    let attrs = {};
    code.openingElement.attributes.forEach(attr => {
      attrs[attr.name.name] = executeSingle(attr.value, meta);
    });
    let key = attrs['key'];
    if (!key) {
      key = code.cosmoId;
      if (meta.parentJsxKey) key = meta.parentJsxKey + '-' + key;
      attrs['key'] = key;
    }
    let c = meta.creature.module.applet.cache.elements[key];
    let isNew = c === undefined;
    let children = code.children.map(child => executeSingle(child, meta)).flat(Infinity).filter(child => child !== '');
    if (!c) {
      c = Control.instantiate(attrs, attrs['style'], children);
    } else {
      let cThisObj = c.thisObj;
      c = Control.instantiate(attrs, attrs['style'], children, cThisObj);
    }
    meta.creature.module.applet.cache.elements[key] = c;
    if (c instanceof _BaseElement.default) return c;else {
      let newMetaBranch = _.default.generator.nestedContext(c, {
        ...meta,
        parentJsxKey: key
      });
      meta.creature.module.applet.cache.mounts.push(() => c.getBaseMethod('onMount')(newMetaBranch));
      if (isNew) c.getBaseMethod('constructor')(newMetaBranch);
      let r = c.getBaseMethod('render')(newMetaBranch);
      if (!meta.creature.module.applet.oldVersions[c._key]) {
        meta.creature.module.applet.oldVersions[c._key] = r;
      }
      return r;
    }
  },
  Program: (code, meta) => {
    code.body.forEach(child => {
      executeSingle(child, meta);
    });
  },
  Literal: (code, meta) => {
    return code.value;
  },
  FunctionExpression: (code, meta) => {
    let newCreatureBranch = new _Creature.default(meta.creature.module, {
      ...meta.creature,
      runtime: meta.creature.runtime.clone()
    });
    let newMetaBranch = new _ExecutionMeta.default({
      ...meta,
      creature: newCreatureBranch
    });
    return generateCallbackFunction(code, newMetaBranch);
  },
  FunctionDeclaration: (code, meta) => {
    let newCreatureBranch = new _Creature.default(meta.creature.module, {
      ...meta.creature,
      runtime: meta.creature.runtime.clone()
    });
    let newMetaBranch = new _ExecutionMeta.default({
      ...meta,
      creature: newCreatureBranch
    });
    meta.creature.runtime.stackTop.putUnit(code.id.name, generateCallbackFunction(code, newMetaBranch));
  },
  MethodDefinition: (code, meta) => {
    meta.creature.runtime.stackTop.putUnit(code.key.name, executeSingle(code.value, meta));
  },
  VariableDeclaration: (code, meta) => {
    if (code.kind === 'let') {
      code.declarations.forEach(d => executeSingle(d, new _ExecutionMeta.default({
        ...meta,
        declaration: true,
        declarationType: 'let'
      })));
    } else if (code.kind === 'const') {
      code.declarations.forEach(d => executeSingle(d, new _ExecutionMeta.default({
        ...meta,
        declaration: true,
        declarationType: 'const'
      })));
    }
  },
  VariableDeclarator: (code, meta) => {
    if (meta?.declaration) {
      meta.creature.runtime.stackTop.putUnit(code.id.name, executeSingle(code.init, meta));
    }
  },
  Identifier: (code, meta) => {
    for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
      if (meta.returnIdParent) {
        let wrapper = findLayer(meta, code.name);
        if (wrapper) {
          return {
            parent: wrapper.units,
            id: code.name
          };
        }
      } else {
        let r = meta.creature.runtime.stack[i].findUnit(code.name);
        if (r) {
          return r;
        }
      }
    }
  },
  BinaryExpression: (code, meta) => {
    if (code.operator === '+') {
      return executeSingle(code.left, meta) + executeSingle(code.right, meta);
    } else if (code.operator === '-') {
      return executeSingle(code.left, meta) - executeSingle(code.right, meta);
    } else if (code.operator === '*') {
      return executeSingle(code.left, meta) * executeSingle(code.right, meta);
    } else if (code.operator === '/') {
      return executeSingle(code.left, meta) / executeSingle(code.right, meta);
    } else if (code.operator === '^') {
      return Math.pow(executeSingle(code.left, meta), executeSingle(code.right, meta));
    } else if (code.operator === '%') {
      return executeSingle(code.left, meta) % executeSingle(code.right, meta);
    } else if (code.operator === '===') {
      return executeSingle(code.left, meta) === executeSingle(code.right, meta);
    } else if (code.operator === '<') {
      return executeSingle(code.left, meta) < executeSingle(code.right, meta);
    } else if (code.operator === '>') {
      return executeSingle(code.left, meta) > executeSingle(code.right, meta);
    } else if (code.operator === '&') {
      return executeSingle(code.left, meta) & executeSingle(code.right, meta);
    } else if (code.operator === '|') {
      return executeSingle(code.left, meta) | executeSingle(code.right, meta);
    }
  },
  IfStatement: (code, meta) => {
    if (executeSingle(code.test, meta)) {
      let r = executeSingle(code.consequent, meta);
      if (r?.breakFired) return r;else if (r?.returnFired) return r;
    } else if (code.alternate) {
      let r = executeSingle(code.alternate, meta);
      if (r?.breakFired) return r;else if (r?.returnFired) return r;
    }
  },
  BreakStatement: (code, meta) => {
    return {
      breakFired: true
    };
  },
  WhileStatement: (code, meta) => {
    while (executeSingle(code.test, meta)) {
      let r = executeSingle(code.body, meta);
      if (r?.breakFired) break;else if (r?.returnFired) return r;
    }
  },
  BlockStatement: (code, meta) => {
    for (let i = 0; i < code.body?.length; i++) {
      let r = executeSingle(code.body[i], meta);
      if (r?.breakFired) return r;else if (r?.returnFired) return r;
    }
  },
  ExpressionStatement: (code, meta) => {
    return executeSingle(code.expression, meta);
  },
  AssignmentExpression: (code, meta) => {
    let right = executeSingle(code.right, meta);
    let wrapper = executeSingle(code.left, {
      ...meta,
      returnIdParent: true
    });
    if (wrapper) {
      if (wrapper.parent !== undefined) {
        let before = wrapper.parent[wrapper.id];
        if (code.operator === '=') {
          wrapper.parent[wrapper.id] = right;
        } else if (code.operator === '+=') {
          wrapper.parent[wrapper.id] = before + right;
        } else if (code.operator === '-=') {
          wrapper.parent[wrapper.id] = before - right;
        } else if (code.operator === '*=') {
          wrapper.parent[wrapper.id] = before * right;
        } else if (code.operator === '/=') {
          wrapper.parent[wrapper.id] = before / right;
        } else if (code.operator === '^=') {
          wrapper.parent[wrapper.id] = Math.pow(before, right);
        } else if (code.operator === '%=') {
          wrapper.parent[wrapper.id] = before % right;
        }
      } else {
        let layer = findLayer(meta, wrapper.id);
        if (layer) {
          let r = layer.findUnit(wrapper.id);
          if (r) {
            if (code.operator === '=') {
              r = right;
            } else if (code.operator === '+=') {
              r += right;
            } else if (code.operator === '-=') {
              r -= right;
            } else if (code.operator === '*=') {
              r *= right;
            } else if (code.operator === '/=') {
              r /= right;
            } else if (code.operator === '^=') {
              r = Math.pow(r, right);
            } else if (code.operator === '%=') {
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
      if (r?.breakFired) break;else if (r?.returnFired) return r;
    }
  },
  UpdateExpression: (code, meta) => {
    if (['++', '--'].includes(code.operator)) {
      let wrapper = executeSingle(code.argument, {
        ...meta,
        returnIdParent: true
      });
      if (wrapper) {
        if (wrapper.parent !== undefined) {
          let before = wrapper.parent[wrapper.id];
          if (typeof before === 'number') {
            if (code.operator === '++') before++;else if (code.operator === '--') before--;
            wrapper.parent[wrapper.id] = before;
          }
        } else {
          let layer = findLayer(meta, wrapper.id);
          if (layer) {
            let r = layer.findUnit(wrapper.id);
            if (r) {
              if (typeof r === 'number') {
                if (code.operator === '++') r++;else if (code.operator === '--') r--;
                layer.putUnit(code.name, r);
              }
            }
          }
        }
      }
    }
  },
  CallExpression: (code, meta) => {
    let prop = undefined;
    if (code.property === undefined) {
      let r = executeSingle(code.callee, meta);
      return r(...code.arguments.map(c => executeSingle(c, meta)));
    } else {
      if (code.callee.property.type === 'Identifier') {
        prop = code.callee.property.name;
      }
      let r = executeSingle(code.callee.object, meta);
      return r[prop](...code.arguments.map(c => executeSingle(c, meta)));
    }
  },
  MemberExpression: (code, meta) => {
    let prop = undefined;
    if (code.property === undefined) {
      let r = executeSingle(code.object, meta);
      if (meta.returnIdParent) {
        return {
          parent: undefined,
          id: code.name
        };
      } else {
        return r;
      }
    } else {
      if (code.computed) {
        prop = executeSingle(code.property, meta);
      } else {
        if (code.property.type === 'Identifier') {
          prop = code.property.name;
        } else if (code.property.type === 'Literal') {
          prop = code.property.value;
        }
      }
      let filteredMeta = {
        ...meta
      };
      delete filteredMeta['returnIdParent'];
      let r = executeSingle(code.object, filteredMeta);
      if (Array.isArray(r)) {
        let p = r[prop];
        if (typeof p === 'function') {
          return (...args) => {
            switch (prop) {
              case 'push':
                {
                  return r.push(...args);
                }
              case 'map':
                {
                  return r.map(...args);
                }
              case 'forEach':
                {
                  return r.forEach(...args);
                }
              default:
                {}
            }
          };
        } else {
          if (meta.returnIdParent) {
            return {
              parent: r,
              id: prop
            };
          } else {
            return r[prop];
          }
        }
      } else {
        if (meta.returnIdParent) {
          return {
            parent: r,
            id: prop
          };
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
      if (c.type === 'SwitchCase') {
        let caseCond = executeSingle(c.test, meta);
        if (disc === caseCond) {
          for (let j = 0; j < c.consequent.lengthl; j++) {
            let co = c.consequent[j];
            let r = executeSingle(co, meta);
            if (r?.returnFired) return r;
          }
        }
      }
    }
  },
  ArrowFunctionExpression: (code, meta) => {
    let newCreatureBranch = new _Creature.default(meta.creature.module, {
      ...meta.creature,
      runtime: meta.creature.runtime.clone()
    });
    let newMetaBranch = new _ExecutionMeta.default({
      ...meta,
      creature: newCreatureBranch
    });
    return generateCallbackFunction(code, newMetaBranch);
  },
  ObjectExpression: (code, meta) => {
    let obj = {};
    code.properties.forEach(property => {
      if (property.type === 'Property') {
        if (property.key.type === 'Identifier') {
          obj[property.key.name] = executeSingle(property.value, meta);
        }
      } else {
        if (property.type === 'SpreadElement') {
          obj[property.argument.name] = executeSingle(property, meta);
        }
      }
    });
    return obj;
  },
  ArrayExpression: (code, meta) => {
    let result = [];
    code.elements.forEach(arrEl => {
      let r = executeSingle(arrEl, meta);
      if (arrEl.type === 'SpreadElement' && Array.isArray(r)) {
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
      return {
        ...source
      };
    }
  },
  ReturnStatement: (code, meta) => {
    return {
      value: executeSingle(code.argument, meta),
      returnFired: true
    };
  }
};
var _default = exports.default = {
  executeSingle,
  executeBlock,
  ExecutionMeta: _ExecutionMeta.default
};

},{".":23,"../Creature":4,"../ExecutionMeta":7,"../controls/index":16,"../elements/BaseElement":17}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseElement = _interopRequireDefault(require("../elements/BaseElement"));
var _BaseProp = _interopRequireDefault(require("../props/BaseProp"));
var _ExecutionMeta = _interopRequireDefault(require("../ExecutionMeta"));
var _Creature = _interopRequireDefault(require("../Creature"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let generateKey = () => {
  return Math.random().toString().substring(2);
};
function clone(instance) {
  const copy = JSON.parse(JSON.stringify(instance));
  Object.assign(copy, instance);
  return copy;
}
const prepareElement = (typeName, defaultProps, overridenProps, defaultStyles, overridenStyles, children) => {
  let finalProps = {};
  Object.keys(defaultProps).forEach(propKey => {
    if (overridenProps[propKey]) {
      let bpProp = defaultProps[propKey];
      let copiedProp = clone(bpProp);
      copiedProp.setValue(overridenProps[propKey]);
      finalProps[propKey] = copiedProp;
    }
  });
  let finalStyles = {
    ...defaultStyles
  };
  if (overridenStyles) finalStyles = {
    ...finalStyles,
    ...overridenStyles
  };
  return new _BaseElement.default(overridenProps['key'], typeName, finalProps, finalStyles, children);
};
const nestedContext = (creature, otherMetas) => {
  if (otherMetas) {
    return new _ExecutionMeta.default({
      ...otherMetas,
      creature,
      isAnotherCreature: true
    });
  } else {
    return new _ExecutionMeta.default({
      creature,
      isAnotherCreature: true
    });
  }
};
var _default = exports.default = {
  generateKey,
  prepareElement,
  nestedContext
};

},{"../Creature":4,"../ExecutionMeta":7,"../elements/BaseElement":17,"../props/BaseProp":18}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _generator = _interopRequireDefault(require("./generator"));
var _compiler = _interopRequireDefault(require("./compiler"));
var _json = _interopRequireDefault(require("./json"));
var _executor = _interopRequireDefault(require("./executor"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var _default = exports.default = {
  generator: _generator.default,
  compiler: _compiler.default,
  json: _json.default,
  executor: _executor.default
};

},{"./compiler":20,"./executor":21,"./generator":22,"./json":24}],24:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
let prettify = obj => {
  return JSON.stringify(obj, undefined, 4);
};
let diff = (obj1, obj2) => {
  if (obj2 === undefined) {
    if (obj1 === undefined) {
      return undefined;
    } else {
      return {
        __state__: 'deleted'
      };
    }
  } else {
    if (obj1 === undefined) {
      return {
        __state__: 'created',
        __value__: obj2
      };
    } else {
      let getType = val => {
        return Array.isArray(val) ? 'array' : typeof val;
      };
      if (getType(obj1) !== getType(obj2)) {
        return {
          __state__: 'created',
          __value__: obj2
        };
      } else {
        if (getType(obj1) === 'array') {
          let result = {};
          for (let i = 0; i < Math.max(obj2.length, obj1.length); i++) {
            let r = diff(obj1[i], obj2[i]);
            if (r !== undefined) result[i] = r;
          }
          if (Object.keys(result).length === 0) return undefined;else return result;
        } else if (getType(obj1) === 'object') {
          let result = {};
          for (let key in obj2) {
            let r = diff(obj1[key], obj2[key]);
            if (r !== undefined) result[key] = r;
          }
          for (let key in obj1) {
            if (!obj2[key]) {
              result[key] = {
                __state__: 'created',
                __value__: obj2
              };
            }
          }
          if (Object.keys(result).length === 0) return undefined;else return result;
        } else {
          if (obj1 === obj2) {
            return undefined;
          } else {
            return {
              __state__: 'updated',
              __value__: obj2
            };
          }
        }
      }
    }
  }
};
var _default = exports.default = {
  prettify,
  diff
};

},{}]},{},[2]);
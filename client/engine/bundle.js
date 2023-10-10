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
  Object = {
    keys: obj => {
      return Object.keys(obj);
    },
    values: obj => {
      return Object.values(obj);
    }
  };
  alert = str => {
    window.alert(str);
  };
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

},{"./Native":1,"./widget/Applet":3,"./widget/Module":12,"./widget/utils":33}],3:[function(require,module,exports){
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
    // newVersion._key = oldVersion._key
    this.cache.elements[newVersion._key] = newVersion._key;
    delete this.cache.elements[oldVersion._key];
    this.update(oldVersion._key, newVersion._key, _utils.default.json.diff(oldVersion, newVersion));
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

},{"./Creature":4,"./INative":10,"./Module":12,"./elements/BaseElement":22,"./utils":33}],4:[function(require,module,exports){
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
      let newMetaBranch = _utils.default.generator.nestedContext(this, {
        parentJsxKey: '100'
      });
      let newRender = this.getBaseMethod('render')(newMetaBranch);
      this._module.applet.onCreatureStateChange(this, newRender);
    };
  }
}
var _default = exports.default = Creature;

},{"./DOM":6,"./Module":12,"./Runtime":13,"./elements/BaseElement":22,"./utils":33}],5:[function(require,module,exports){
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

},{"./Creature":4,"./Module":12,"./elements/BaseElement":22}],7:[function(require,module,exports){
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

},{"./utils":33}],9:[function(require,module,exports){
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

},{"./Applet":3,"./Creature":4,"./CreatureStore":5,"./DOM":6,"./FuncStore":9,"./Runtime":13,"./elements/BaseElement":22,"./utils":33}],13:[function(require,module,exports){
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

},{"./Creature":4,"./INative":10,"./MemoryLayer":11,"./Module":12,"./utils":33}],14:[function(require,module,exports){
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
var _utils = _interopRequireDefault(require("../utils"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class BoxControl extends _BaseControl.default {
  static TYPE = 'box';
  static defaultProps = {};
  static defaultStyles = {
    width: 200,
    height: 200
  };
  static instantiate(overridenProps, overridenStyles, children) {
    return _utils.default.generator.prepareElement(BoxControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
}
var _default = exports.default = BoxControl;

},{"../utils":33,"./BaseControl":14}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseControl = _interopRequireDefault(require("./BaseControl"));
var _StringProp = _interopRequireDefault(require("../props/StringProp"));
var _utils = _interopRequireDefault(require("../utils"));
var _FuncProp = _interopRequireDefault(require("../props/FuncProp"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class ButtonControl extends _BaseControl.default {
  static TYPE = 'button';
  static defaultProps = {
    caption: new _StringProp.default(''),
    variant: new _StringProp.default('filled'),
    onClick: new _FuncProp.default(undefined)
  };
  static defaultStyles = {
    width: 150,
    height: 56
  };
  static instantiate(overridenProps, overridenStyles, children) {
    return _utils.default.generator.prepareElement(ButtonControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
}
var _default = exports.default = ButtonControl;

},{"../props/FuncProp":25,"../props/StringProp":27,"../utils":33,"./BaseControl":14}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseControl = _interopRequireDefault(require("./BaseControl"));
var _utils = _interopRequireDefault(require("../utils"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class CardControl extends _BaseControl.default {
  static TYPE = 'card';
  static defaultProps = {};
  static defaultStyles = {
    width: 200,
    height: 200,
    boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px',
    backgroundColor: '#fff',
    borderRadius: 4
  };
  static instantiate(overridenProps, overridenStyles, children) {
    return _utils.default.generator.prepareElement(CardControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
}
var _default = exports.default = CardControl;

},{"../utils":33,"./BaseControl":14}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseControl = _interopRequireDefault(require("./BaseControl"));
var _utils = _interopRequireDefault(require("../utils"));
var _BaseElement = _interopRequireDefault(require("../elements/BaseElement"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class PrimaryTabControl extends _BaseControl.default {
  static TYPE = 'primary-tab';
  static defaultProps = {};
  static defaultStyles = {};
  static instantiate(overridenProps, overridenStyles, children) {
    return _utils.default.generator.prepareElement(PrimaryTabControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
}
var _default = exports.default = PrimaryTabControl;

},{"../elements/BaseElement":22,"../utils":33,"./BaseControl":14}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseControl = _interopRequireDefault(require("./BaseControl"));
var _utils = _interopRequireDefault(require("../utils"));
var _BaseElement = _interopRequireDefault(require("../elements/BaseElement"));
var _FuncProp = _interopRequireDefault(require("../props/FuncProp"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class TabsControl extends _BaseControl.default {
  static TYPE = 'tabs';
  static defaultProps = {
    onChange: new _FuncProp.default(undefined)
  };
  static defaultStyles = {};
  static instantiate(overridenProps, overridenStyles, children) {
    return _utils.default.generator.prepareElement(TabsControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
  }
}
var _default = exports.default = TabsControl;

},{"../elements/BaseElement":22,"../props/FuncProp":25,"../utils":33,"./BaseControl":14}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseControl = _interopRequireDefault(require("./BaseControl"));
var _StringProp = _interopRequireDefault(require("../props/StringProp"));
var _utils = _interopRequireDefault(require("../utils"));
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

},{"../props/StringProp":27,"../utils":33,"./BaseControl":14}],21:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _TextControl = _interopRequireDefault(require("./TextControl"));
var _ButtonControl = _interopRequireDefault(require("./ButtonControl"));
var _BoxControl = _interopRequireDefault(require("./BoxControl"));
var _CardControl = _interopRequireDefault(require("./CardControl"));
var _TabsControl = _interopRequireDefault(require("./TabsControl"));
var _PrimaryTabControl = _interopRequireDefault(require("./PrimaryTabControl"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var _default = exports.default = {
  [_TextControl.default.TYPE]: _TextControl.default,
  [_ButtonControl.default.TYPE]: _ButtonControl.default,
  [_BoxControl.default.TYPE]: _BoxControl.default,
  [_CardControl.default.TYPE]: _CardControl.default,
  [_TabsControl.default.TYPE]: _TabsControl.default,
  [_PrimaryTabControl.default.TYPE]: _PrimaryTabControl.default
};

},{"./BoxControl":15,"./ButtonControl":16,"./CardControl":17,"./PrimaryTabControl":18,"./TabsControl":19,"./TextControl":20}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
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

},{}],23:[function(require,module,exports){
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

},{}],24:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseProp = _interopRequireDefault(require("./BaseProp"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class BooleanProp extends _BaseProp.default {
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
    super('boolean');
    this._value = defaultValue;
    this._defaultValue = defaultValue;
  }
}
var _default = exports.default = BooleanProp;

},{"./BaseProp":23}],25:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseProp = _interopRequireDefault(require("./BaseProp"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class FuncProp extends _BaseProp.default {
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
    super('function');
    this._value = defaultValue;
    this._defaultValue = defaultValue;
  }
}
var _default = exports.default = FuncProp;

},{"./BaseProp":23}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseProp = _interopRequireDefault(require("./BaseProp"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class NumberProp extends _BaseProp.default {
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
    super('number');
    this._value = defaultValue;
    this._defaultValue = defaultValue;
  }
}
var _default = exports.default = NumberProp;

},{"./BaseProp":23}],27:[function(require,module,exports){
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

},{"./BaseProp":23}],28:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Module = _interopRequireDefault(require("../Module"));
var _cssProperty = require("./cssProperty");
var _hyphenateStyleName = _interopRequireDefault(require("./hyphenateStyleName"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var isArray = Array.isArray;
var keys = Object.keys;
var counter = 1;
// Follows syntax at https://developer.mozilla.org/en-US/docs/Web/CSS/content,
// including multiple space separated values.
var unquotedContentValueRegex = /^(normal|none|(\b(url\([^)]*\)|chapter_counter|attr\([^)]*\)|(no-)?(open|close)-quote|inherit)((\b\s*)|$|\s+))+)$/;
function buildRule(key, value) {
  if (!_cssProperty.isUnitlessNumber[key] && typeof value === 'number') {
    value = '' + value + 'px';
  } else if (key === 'content' && !unquotedContentValueRegex.test(value)) {
    value = "'" + value.replace(/'/g, "\\'") + "'";
  }
  return (0, _hyphenateStyleName.default)(key) + ': ' + value + ';  ';
}
function buildValue(key, value) {
  if (!_cssProperty.isUnitlessNumber[key] && typeof value === 'number') {
    value = '' + value + 'px';
  } else if (key === 'content' && !unquotedContentValueRegex.test(value)) {
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
    } else {
      result += buildRule(styleKey, value);
    }
  }
  return result;
}

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
  extractModules,
  styleToCssString,
  buildRule,
  buildValue
};

},{"../Module":12,"./cssProperty":29,"./hyphenateStyleName":32}],29:[function(require,module,exports){
'use strict';

/**
 * CSS properties which accept numbers but are not in units of "px".
 */
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
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

/**
 * @param {string} prefix vendor-specific prefix, eg: Webkit
 * @param {string} key style name, eg: transitionDuration
 * @return {string} style name prefixed with `prefix`, properly camelCased, eg:
 * WebkitTransitionDuration
 */
function prefixKey(prefix, key) {
  return prefix + key.charAt(0).toUpperCase() + key.substring(1);
}

/**
 * Support style names that may come passed in prefixed by adding permutations
 * of vendor prefixes.
 */
var prefixes = ['Webkit', 'ms', 'Moz', 'O'];

// Using Object.keys here, or else the vanilla for-in loop makes IE8 go into an
// infinite loop, because it iterates over the newly added props too.
Object.keys(isUnitlessNumber).forEach(function (prop) {
  prefixes.forEach(function (prefix) {
    isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
  });
});

/**
 * Most style properties can be unset by doing .style[prop] = '' but IE8
 * doesn't like doing that with shorthand properties so for the properties that
 * IE8 breaks on, which are listed here, we instead unset each of the
 * individual properties. See http://bugs.jquery.com/ticket/12385.
 * The 4-value 'clock' properties like margin, padding, border-width seem to
 * behave without any problems. Curiously, list-style works too without any
 * special prodding.
 */
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
module.exports = CSSProperty;
var _default = exports.default = CSSProperty;

},{}],30:[function(require,module,exports){
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
      c = Control.instantiate(attrs, attrs['style'], children, undefined, meta.parentJsxKey);
    } else {
      let cThisObj = c.thisObj;
      c = Control.instantiate(attrs, attrs['style'], children, cThisObj, meta.parentJsxKey);
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

},{".":33,"../Creature":4,"../ExecutionMeta":7,"../controls/index":21,"../elements/BaseElement":22}],31:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _BaseElement = _interopRequireDefault(require("../elements/BaseElement"));
var _ExecutionMeta = _interopRequireDefault(require("../ExecutionMeta"));
var _StringProp = _interopRequireDefault(require("../props/StringProp"));
var _NumberProp = _interopRequireDefault(require("../props/NumberProp"));
var _BooleanProp = _interopRequireDefault(require("../props/BooleanProp"));
var _FuncProp = _interopRequireDefault(require("../props/FuncProp"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let generateKey = () => {
  return Math.random().toString().substring(2);
};
function clone(T, instance) {
  const copy = JSON.parse(JSON.stringify(instance));
  Object.assign(T, copy);
  return copy;
}
const prepareElement = (typeName, defaultProps, overridenProps, defaultStyles, overridenStyles, children) => {
  let finalProps = {};
  Object.keys(defaultProps).forEach(propKey => {
    if (overridenProps[propKey] !== undefined) {
      let bpProp = defaultProps[propKey];
      let copiedProp;
      if (bpProp._type === 'string') {
        copiedProp = clone(_StringProp.default, bpProp);
      } else if (bpProp._type === 'number') {
        copiedProp = clone(_NumberProp.default, bpProp);
      } else if (bpProp._type === 'boolean') {
        copiedProp = clone(_BooleanProp.default, bpProp);
      } else if (bpProp._type === 'function') {
        copiedProp = clone(_FuncProp.default, bpProp);
      }
      copiedProp._value = overridenProps[propKey];
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

},{"../ExecutionMeta":7,"../elements/BaseElement":22,"../props/BooleanProp":24,"../props/FuncProp":25,"../props/NumberProp":26,"../props/StringProp":27}],32:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var msPattern = /^ms-/;
var _uppercasePattern = /([A-Z])/g;

/**
 * Hyphenates a camelcased string, for example:
 *
 *   > hyphenate('backgroundColor')
 *   < "background-color"
 *
 * For CSS style names, use `hyphenateStyleName` instead which works properly
 * with all vendor prefixes, including `ms`.
 *
 * @param {string} string
 * @return {string}
 */
function hyphenate(string) {
  return string.replace(_uppercasePattern, '-$1').toLowerCase();
}

/**
 * Hyphenates a camelcased CSS property name, for example:
 *
 *   > hyphenateStyleName('backgroundColor')
 *   < "background-color"
 *   > hyphenateStyleName('MozTransition')
 *   < "-moz-transition"
 *   > hyphenateStyleName('msTransition')
 *   < "-ms-transition"
 *
 * As Modernizr suggests (http://modernizr.com/docs/#prefixed), an `ms` prefix
 * is converted to `-ms-`.
 *
 * @param {string} string
 * @return {string}
 */
function hyphenateStyleName(string) {
  return hyphenate(string).replace(msPattern, '-ms-');
}
var _default = exports.default = hyphenateStyleName;

},{}],33:[function(require,module,exports){
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

},{"./compiler":28,"./executor":30,"./generator":31,"./json":34}],34:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
let prettify = obj => {
  return JSON.stringify(obj, undefined, 4);
};
let diff = (obj1, obj2) => {
  if (obj2._key || obj1._key) {
    if (obj2._key !== obj1._key) {
      return {
        __state__: 'updated',
        __value__: obj2
      };
    }
  }
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

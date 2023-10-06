"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseElement_1 = require("../elements/BaseElement");
const Creature_1 = require("../Creature");
const index_1 = require("../controls/index");
const ExecutionMeta_1 = require("../ExecutionMeta");
const utils_1 = require("../utils");
let executeSingle = (code, meta) => {
    let callback = codeCallbacks[code.type];
    if (callback) {
        let r = callback(code, meta);
        return r;
    }
    else {
        return code;
    }
};
let executeBlock = (codes, meta) => {
    for (let i = 0; i < codes.length; i++) {
        let code = codes[i];
        let r = executeSingle(code, meta);
        if (r === null || r === void 0 ? void 0 : r.returnFired)
            return r;
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
        if (firstParam && (firstParam instanceof ExecutionMeta_1.default) && firstParam.isAnotherCreature) {
            newMetaBranch = firstParam;
        }
        newMetaBranch.creature.runtime.pushOnStack(parameters);
        let result = executeSingle(code.body, newMetaBranch);
        newMetaBranch.creature.runtime.popFromStack();
        return result === null || result === void 0 ? void 0 : result.value;
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
        }
        else if (code.operator === '||') {
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
            code.cosmoId = utils_1.default.generator.generateKey();
        let Control = index_1.default[code.openingElement.name.name];
        if (!Control) {
            Control = meta.creature.module.applet.findModule(code.openingElement.name.name);
        }
        let attrs = {};
        code.openingElement.attributes.forEach((attr) => {
            attrs[attr.name.name] = executeSingle(attr.value, meta);
        });
        let key = attrs['key'];
        if (!key) {
            key = code.cosmoId;
            if (meta.parentJsxKey)
                key = meta.parentJsxKey + '-' + key;
            attrs['key'] = key;
        }
        let c = meta.creature.module.applet.cache.elements[key];
        let isNew = (c === undefined);
        let children = code.children.map((child) => executeSingle(child, meta)).flat(Infinity).filter((child) => (child !== ''));
        if (!c) {
            c = Control.instantiate(attrs, attrs['style'], children);
        }
        else {
            let cThisObj = c.thisObj;
            c = Control.instantiate(attrs, attrs['style'], children, cThisObj);
        }
        meta.creature.module.applet.cache.elements[key] = c;
        if (c instanceof BaseElement_1.default)
            return c;
        else {
            let newMetaBranch = utils_1.default.generator.nestedContext(c, Object.assign(Object.assign({}, meta), { parentJsxKey: key }));
            meta.creature.module.applet.cache.mounts.push(() => c.getBaseMethod('onMount')(newMetaBranch));
            if (isNew)
                c.getBaseMethod('constructor')(newMetaBranch);
            let r = c.getBaseMethod('render')(newMetaBranch);
            if (!meta.creature.module.applet.oldVersions[c._key]) {
                meta.creature.module.applet.oldVersions[c._key] = r;
            }
            return r;
        }
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
        let newCreatureBranch = new Creature_1.default(meta.creature.module, Object.assign(Object.assign({}, meta.creature), { runtime: meta.creature.runtime.clone() }));
        let newMetaBranch = new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { creature: newCreatureBranch }));
        return generateCallbackFunction(code, newMetaBranch);
    },
    FunctionDeclaration: (code, meta) => {
        let newCreatureBranch = new Creature_1.default(meta.creature.module, Object.assign(Object.assign({}, meta.creature), { runtime: meta.creature.runtime.clone() }));
        let newMetaBranch = new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { creature: newCreatureBranch }));
        meta.creature.runtime.stackTop.putUnit(code.id.name, generateCallbackFunction(code, newMetaBranch));
    },
    MethodDefinition: (code, meta) => {
        meta.creature.runtime.stackTop.putUnit(code.key.name, executeSingle(code.value, meta));
    },
    VariableDeclaration: (code, meta) => {
        if (code.kind === 'let') {
            code.declarations.forEach((d) => executeSingle(d, new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { declaration: true, declarationType: 'let' }))));
        }
        else if (code.kind === 'const') {
            code.declarations.forEach((d) => executeSingle(d, new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { declaration: true, declarationType: 'const' }))));
        }
    },
    VariableDeclarator: (code, meta) => {
        if (meta === null || meta === void 0 ? void 0 : meta.declaration) {
            meta.creature.runtime.stackTop.putUnit(code.id.name, executeSingle(code.init, meta));
        }
    },
    Identifier: (code, meta) => {
        for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
            if (meta.returnIdParent) {
                let wrapper = findLayer(meta, code.name);
                if (wrapper) {
                    return { parent: wrapper.units, id: code.name };
                }
            }
            else {
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
        }
        else if (code.operator === '-') {
            return executeSingle(code.left, meta) - executeSingle(code.right, meta);
        }
        else if (code.operator === '*') {
            return executeSingle(code.left, meta) * executeSingle(code.right, meta);
        }
        else if (code.operator === '/') {
            return executeSingle(code.left, meta) / executeSingle(code.right, meta);
        }
        else if (code.operator === '^') {
            return Math.pow(executeSingle(code.left, meta), executeSingle(code.right, meta));
        }
        else if (code.operator === '%') {
            return executeSingle(code.left, meta) % executeSingle(code.right, meta);
        }
        else if (code.operator === '===') {
            return executeSingle(code.left, meta) === executeSingle(code.right, meta);
        }
        else if (code.operator === '<') {
            return executeSingle(code.left, meta) < executeSingle(code.right, meta);
        }
        else if (code.operator === '>') {
            return executeSingle(code.left, meta) > executeSingle(code.right, meta);
        }
        else if (code.operator === '&') {
            return executeSingle(code.left, meta) & executeSingle(code.right, meta);
        }
        else if (code.operator === '|') {
            return executeSingle(code.left, meta) | executeSingle(code.right, meta);
        }
    },
    IfStatement: (code, meta) => {
        if (executeSingle(code.test, meta)) {
            let r = executeSingle(code.consequent, meta);
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                return r;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
        else if (code.alternate) {
            let r = executeSingle(code.alternate, meta);
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                return r;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
    },
    BreakStatement: (code, meta) => {
        return { breakFired: true };
    },
    WhileStatement: (code, meta) => {
        while (executeSingle(code.test, meta)) {
            let r = executeSingle(code.body, meta);
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                break;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
    },
    BlockStatement: (code, meta) => {
        var _a;
        for (let i = 0; i < ((_a = code.body) === null || _a === void 0 ? void 0 : _a.length); i++) {
            let r = executeSingle(code.body[i], meta);
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                return r;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
    },
    ExpressionStatement: (code, meta) => {
        return executeSingle(code.expression, meta);
    },
    AssignmentExpression: (code, meta) => {
        let right = executeSingle(code.right, meta);
        let wrapper = executeSingle(code.left, Object.assign(Object.assign({}, meta), { returnIdParent: true }));
        if (wrapper) {
            if (wrapper.parent !== undefined) {
                let before = wrapper.parent[wrapper.id];
                if (code.operator === '=') {
                    wrapper.parent[wrapper.id] = right;
                }
                else if (code.operator === '+=') {
                    wrapper.parent[wrapper.id] = before + right;
                }
                else if (code.operator === '-=') {
                    wrapper.parent[wrapper.id] = before - right;
                }
                else if (code.operator === '*=') {
                    wrapper.parent[wrapper.id] = before * right;
                }
                else if (code.operator === '/=') {
                    wrapper.parent[wrapper.id] = before / right;
                }
                else if (code.operator === '^=') {
                    wrapper.parent[wrapper.id] = Math.pow(before, right);
                }
                else if (code.operator === '%=') {
                    wrapper.parent[wrapper.id] = before % right;
                }
            }
            else {
                let layer = findLayer(meta, wrapper.id);
                if (layer) {
                    let r = layer.findUnit(wrapper.id);
                    if (r) {
                        if (code.operator === '=') {
                            r = right;
                        }
                        else if (code.operator === '+=') {
                            r += right;
                        }
                        else if (code.operator === '-=') {
                            r -= right;
                        }
                        else if (code.operator === '*=') {
                            r *= right;
                        }
                        else if (code.operator === '/=') {
                            r /= right;
                        }
                        else if (code.operator === '^=') {
                            r = Math.pow(r, right);
                        }
                        else if (code.operator === '%=') {
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
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                break;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
    },
    UpdateExpression: (code, meta) => {
        if (['++', '--'].includes(code.operator)) {
            let wrapper = executeSingle(code.argument, Object.assign(Object.assign({}, meta), { returnIdParent: true }));
            if (wrapper) {
                if (wrapper.parent !== undefined) {
                    let before = wrapper.parent[wrapper.id];
                    if (typeof before === 'number') {
                        if (code.operator === '++')
                            before++;
                        else if (code.operator === '--')
                            before--;
                        wrapper.parent[wrapper.id] = before;
                    }
                }
                else {
                    let layer = findLayer(meta, wrapper.id);
                    if (layer) {
                        let r = layer.findUnit(wrapper.id);
                        if (r) {
                            if (typeof r === 'number') {
                                if (code.operator === '++')
                                    r++;
                                else if (code.operator === '--')
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
        let prop = undefined;
        if (code.property === undefined) {
            let r = executeSingle(code.callee, meta);
            return r(...code.arguments.map((c) => executeSingle(c, meta)));
        }
        else {
            if (code.callee.property.type === 'Identifier') {
                prop = code.callee.property.name;
            }
            let r = executeSingle(code.callee.object, meta);
            return r[prop](...code.arguments.map((c) => executeSingle(c, meta)));
        }
    },
    MemberExpression: (code, meta) => {
        let prop = undefined;
        if (code.property === undefined) {
            let r = executeSingle(code.object, meta);
            if (meta.returnIdParent) {
                return { parent: undefined, id: code.name };
            }
            else {
                return r;
            }
        }
        else {
            if (code.computed) {
                prop = executeSingle(code.property, meta);
            }
            else {
                if (code.property.type === 'Identifier') {
                    prop = code.property.name;
                }
                else if (code.property.type === 'Literal') {
                    prop = code.property.value;
                }
            }
            let filteredMeta = Object.assign({}, meta);
            delete filteredMeta['returnIdParent'];
            let r = executeSingle(code.object, filteredMeta);
            if (Array.isArray(r)) {
                let p = r[prop];
                if (typeof p === 'function') {
                    return (...args) => {
                        switch (prop) {
                            case 'push': {
                                return r.push(...args);
                            }
                            case 'map': {
                                return r.map(...args);
                            }
                            case 'forEach': {
                                return r.forEach(...args);
                            }
                            default: {
                            }
                        }
                    };
                }
                else {
                    if (meta.returnIdParent) {
                        return { parent: r, id: prop };
                    }
                    else {
                        return r[prop];
                    }
                }
            }
            else {
                if (meta.returnIdParent) {
                    return { parent: r, id: prop };
                }
                else {
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
                        if (r === null || r === void 0 ? void 0 : r.returnFired)
                            return r;
                    }
                }
            }
        }
    },
    ArrowFunctionExpression: (code, meta) => {
        let newCreatureBranch = new Creature_1.default(meta.creature.module, Object.assign(Object.assign({}, meta.creature), { runtime: meta.creature.runtime.clone() }));
        let newMetaBranch = new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { creature: newCreatureBranch }));
        return generateCallbackFunction(code, newMetaBranch);
    },
    ObjectExpression: (code, meta) => {
        let obj = {};
        code.properties.forEach((property) => {
            if (property.type === 'Property') {
                if (property.key.type === 'Identifier') {
                    obj[property.key.name] = executeSingle(property.value, meta);
                }
            }
            else {
                if (property.type === 'SpreadElement') {
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
            if ((arrEl.type === 'SpreadElement') && Array.isArray(r)) {
                result.push(...r);
            }
            else {
                result.push(r);
            }
        });
        return result;
    },
    SpreadElement: (code, meta) => {
        let source = executeSingle(code.argument, meta);
        if (Array.isArray(source)) {
            return [...source];
        }
        else {
            return Object.assign({}, source);
        }
    },
    ReturnStatement: (code, meta) => {
        return { value: executeSingle(code.argument, meta), returnFired: true };
    }
};
exports.default = { executeSingle, executeBlock, ExecutionMeta: ExecutionMeta_1.default };
//# sourceMappingURL=executor.js.map
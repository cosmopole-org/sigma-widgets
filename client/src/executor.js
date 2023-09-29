import { getModules, notifyComponentAppendByCode, notifyModuleAppendByCode } from "../App";
import ControlStore from "../controls";
import { indexedElements, stateHub, updateState } from "../elements";

let globalElementsDict = {};
export let syncGlobalElementsDict = (ged) => {
    globalElementsDict = ged;
}

let globalUpdaters = {};
export let syncGlobalUpdaters = (gu) => {
    globalUpdaters = gu;
}

export let globalWrapperUpdaters = {};
export let syncGlobalWrapperUpdaters = (elId, updater) => {
    globalWrapperUpdaters[elId] = updater;
}

let globalMemory = {};
let intervals = {};
let timeouts = {};

export let memory = {
    variables: {
        Object: {
            keys: (obj) => {
                let r = Object.keys(obj);
                return r;
            }
        },
        JSON: {
            stringify: (obj) => JSON.stringify(obj),
            parse: (str) => JSON.parse(str)
        },
        elements: {
            updateProp: (elementId, propKey, propValue) => {
                let element = globalElementsDict[elementId];
                if (element) {
                    element.props[propKey].value = propValue;
                    globalWrapperUpdaters[elementId]();
                }
            },
            updateStyle: (elementId, styleKey, styleValue) => {
                let element = globalElementsDict[elementId];
                if (element) {
                    element.style[styleKey] = styleValue;
                    globalWrapperUpdaters[elementId]();
                }
            },
            queryStates: (elementId) => {
                let result = [];
                Object.keys(stateHub).forEach(key => {
                    if (key.endsWith(':' + elementId)) {
                        result.push(stateHub[key].state);
                    }
                });
                return result;
            }
        },
        components: {
            create: (compType, parentId, props, style, exProps) => {
                let Control = ControlStore.controls[compType];
                let el = new Control(indexedElements['main:' + parentId], props, style, exProps, '');
                if (props.id !== undefined && props.id.length > 0) {
                    indexedElements['main:' + props.id] = el;
                }
                notifyComponentAppendByCode(el, parentId);
                return el;
            },
            use: (moduleId) => {
                let mod = Object.values(getModules()).filter(m => (m.title === moduleId))[0];
                mod = JSON.parse(JSON.stringify(mod));
                mod.create = (updates, parentId) => {
                    let traverse = (el) => {
                        let Control = ControlStore.controls[el.controlKey];
                        let element = Object.assign(new Control, JSON.parse(JSON.stringify(el)));
                        if (updates[element.props.id.value]) {
                            let update = updates[element.props.id.value];
                            if (update.props) {
                                Object.keys(update.props).forEach(pKey => {
                                    element.props[pKey].value = update.props[pKey];
                                })
                            }
                            element.style = { ...element.style, ...update.style };
                            element.state = update.state ? update.state : {};
                        }
                        element.children = element.children.map(child => traverse(child));
                        return element;
                    }
                    let key = Object.keys(mod.main.roots)[0]
                    mod.main.roots[key] = traverse(mod.main.roots[key]);
                    notifyModuleAppendByCode(mod, parentId);
                }
                return mod;
            },
        },
        updateState: (elementId, updates, meta) => {
            return updateState(elementId, updates, meta);
        },
        container: {
            width: () => window.innerWidth,
            height: () => window.innerHeight
        },
        ask: (data, callback) => {
            callback({ ping: 'pong' });
        },
        listen: (topic, callback) => {
            callback({ ping: 'pong' });
        },
        time: {
            now: {
                hour: () => new Date().getHours(),
                minute: () => new Date().getMinutes(),
                second: () => new Date().getSeconds()
            }
        },
        memory: {
            globalize: (key, value) => {
                globalMemory[key] = value;
            },
            lookGlobal: (key) => globalMemory[key]
        },
        clearGlobal: (key) => {
            delete globalMemory[key];
        },
        setInterval: (callback, period) => {
            let codeId = setInterval(() => {
                callback();
            }, period);
            intervals[codeId] = true;
            return codeId;
        },
        setTimeout: (callback, delay) => {
            let codeId = setTimeout(() => {
                callback();
            }, delay);
            timeouts[codeId] = true;
            return codeId;
        },
        clearInterval: (interval) => {
            clearInterval(interval);
        },
        clearTimeout: (timeout) => {
            clearTimeout(timeout);
            delete timeouts[timeout];
        },
        alert: (text) => {
            alert(text);
        },
        console: {
            log: (...text) => {
                console.log(...text?.slice(0, text?.length - 1));
            }
        }
    }
};

let arrayFunctions = {
    push: (array, item) => {
        array.push(item);
    }
}

export function reserveMemoryVariable(key, value) {
    try {
        memory.variables[key] = value;
    } catch (ex) { console.log(ex); }
}

export function kill() {
    Object.keys(intervals).forEach(codeId => clearInterval(codeId));
    Object.keys(timeouts).forEach(codeId => clearTimeout(codeId));
}

export default function execute(code, meta) {
    if (code?.dataType === 'array') {
        return code?.data;
    }
    switch (code.type) {
        case 'Program': {
            code.body.forEach(child => {
                execute(child, meta)
            })
            break
        }
        case 'VariableDeclaration': {
            if (code.kind === 'let') {
                code.declarations.forEach(d => execute(d, { ...meta, declaration: true, declarationType: 'let' }));
            } else if (code.kind === 'const') {
                code.declarations.forEach(d => execute(d, { ...meta, declaration: true, declarationType: 'const' }));
            }
            break
        }
        case 'VariableDeclarator': {
            if (meta?.declaration) {
                memory.variables[code.id.name] = execute(code.init, meta);
            }
            break
        }
        case 'Identifier': {
            let res = memory.variables[meta.groupId + ':' + code.name];
            res = res !== undefined ? res : memory.variables[code.name];
            return res;
        }
        case 'Literal': {
            return code.value
        }
        case 'BinaryExpression': {
            if (code.operator === '+') {
                return execute(code.left, meta) + execute(code.right, meta)
            } else if (code.operator === '-') {
                return execute(code.left, meta) - execute(code.right, meta)
            } else if (code.operator === '*') {
                return execute(code.left, meta) * execute(code.right, meta)
            } else if (code.operator === '/') {
                return execute(code.left, meta) / execute(code.right, meta)
            } else if (code.operator === '^') {
                return Math.pow(execute(code.left, meta), execute(code.right, meta))
            } else if (code.operator === '%') {
                return execute(code.left, meta) % execute(code.right, meta)
            } else if (code.operator === '===') {
                return execute(code.left, meta) === execute(code.right, meta)
            } else if (code.operator === '<') {
                return execute(code.left, meta) < execute(code.right, meta)
            } else if (code.operator === '>') {
                return execute(code.left, meta) > execute(code.right, meta)
            }
            break
        }
        case 'IfStatement': {
            if (execute(code.test, meta)) {
                let r = execute(code.consequent, meta)
                if (r?.breakFired === true) {
                    return r
                }
            } else if (code.alternate) {
                let r = execute(code.alternate, meta)
                if (r?.breakFired === true) {
                    return r
                }
            }
            break
        }
        case 'BreakStatement': {
            return { breakFired: true };
        }
        case 'WhileStatement': {
            while (execute(code.test, meta)) {
                let r = execute(code.body, meta)
                if (r?.breakFired === true) {
                    return
                }
            }
            break
        }
        case 'BlockStatement': {
            for (let i = 0; i < code.body?.length; i++) {
                let r = execute(code.body[i], meta)
                if (r?.breakFired === true) {
                    return r
                }
            }
            break
        }
        case 'ExpressionStatement': {
            return execute(code.expression, meta)
        }
        case 'AssignmentExpression': {
            if (code.operator === '=') {
                memory.variables[code.left.name] = execute(code.right, meta)
            } else if (code.operator === '+=') {
                memory.variables[code.left.name] = execute(code.left, meta) + execute(code.right, meta)
            } else if (code.operator === '-=') {
                memory.variables[code.left.name] = execute(code.left, meta) - execute(code.right, meta)
            } else if (code.operator === '*=') {
                memory.variables[code.left.name] = execute(code.left, meta) * execute(code.right, meta)
            } else if (code.operator === '/=') {
                memory.variables[code.left.name] = execute(code.left, meta) / execute(code.right, meta)
            } else if (code.operator === '^=') {
                memory.variables[code.left.name] = Math.pow(execute(code.left, meta), execute(code.right, meta))
            } else if (code.operator === '%=') {
                memory.variables[code.left.name] = execute(code.left, meta) % execute(code.right, meta)
            }
            break
        }
        case 'ForStatement': {
            for (execute(code.init, meta); execute(code.test, meta); execute(code.update, meta)) {
                let r = execute(code.body, meta)
                if (r?.breakFired === true) {
                    return
                }
            }
            break
        }
        case 'UpdateExpression': {
            if (code.operator === '++') {
                memory.variables[code.argument.name]++
            }
            break
        }
        case 'CallExpression': {
            let prop = undefined
            if (code.property === undefined) {
                let r = execute(code.callee, meta);
                return r(...code.arguments.map(c => execute(c, meta)), meta);
            } else {
                if (code.callee.property.type === 'Identifier') {
                    prop = code.callee.property.name
                }
                let r = execute(code.callee.object, meta);
                return r[prop](...code.arguments.map(c => execute(c, meta)), meta)
            }
        }
        case 'MemberExpression': {
            let prop = undefined
            if (code.property === undefined) {
                let r = execute(code.object, meta);
                return r;
            } else {
                if (code.property.type === 'Identifier') {
                    if (code.computed) {
                        prop = execute(code.property, meta);
                        console.log('executed prop', prop);
                    } else {
                        if (code.property.type === 'Identifier') {
                            prop = code.property.name
                        } else if (code.property.type === 'Literal') {
                            prop = code.property.value;
                        }
                    }
                }
                let r = execute(code.object, meta);
                if (Array.isArray(r)) {
                    let p = r[prop];
                    if (typeof p === 'function') {
                        return (...args) => {
                            switch (prop) {
                                case 'push': {
                                    return r.push(args[0]);
                                }
                                case 'map': {
                                    return r.map(args[0]);
                                }
                                case 'forEach': {
                                    return r.forEach(args[0]);
                                }
                                default: {

                                }
                            }
                        }
                    } else {
                        return p;
                    }
                } else {
                    return r[prop];
                }
            }
        }
        case 'SwitchStatement': {
            let disc = execute(code.discriminant, meta)
            code.cases.forEach(c => {
                if (c.type === 'SwitchCase') {
                    let caseCond = execute(c.test, meta);
                    if (disc === caseCond) {
                        c.consequent.forEach(co => execute(co, meta))
                    }
                }
            })
            break
        }
        case 'ArrowFunctionExpression': {
            return (...args) => {
                code.params.map((param, index) => {
                    memory.variables[param.name] = args[index + 1];
                });
                return execute(code.body, meta);
            };
        }
        case 'ObjectExpression': {
            let obj = {};
            code.properties.forEach(property => {
                if (property.key.type === 'Identifier') {
                    obj[property.key.name] = execute(property.value, meta);
                }
            });
            return obj;
        }
        case 'ArrayExpression': {
            return code.elements.map(arrEl => execute(arrEl, meta));
        }
        case 'ReturnStatement': {
            return execute(code.argument, meta);
        }
        default: {
            return code;
        }
    }
}

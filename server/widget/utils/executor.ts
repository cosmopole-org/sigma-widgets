
import BaseElement from "../elements/BaseElement"
import Creature from "../Creature"
import Controls from '../controls/index'
import ExecutionMeta from "../ExecutionMeta"
import Utils from '../utils'

let executeSingle = (code: any, meta: ExecutionMeta) => {
    let callback = codeCallbacks[code.type]
    if (callback) {
        let r = callback(code, meta)
        return r
    } else {
        return code
    }
}

let executeBlock = (codes: Array<any>, meta: ExecutionMeta) => {
    for (let i = 0; i < codes.length; i++) {
        let code = codes[i]
        let r = executeSingle(code, meta)
        if (r?.returnFired) return r
    }
}

let findLayer = (meta: ExecutionMeta, id: string) => {
    for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
        let r = meta.creature.runtime.stack[i].findUnit(id)
        if (r) {
            return meta.creature.runtime.stack[i]
        }
    }
}

const generateCallbackFunction = (code: any, meta: ExecutionMeta) => {
    let newMetaBranch = meta
    return (...args: Array<any>) => {
        let parameters = {}
        code.params.forEach((param: any, index: number) => {
            parameters[param.name] = args[index + 1]
        })
        let firstParam = args[0]
        if (firstParam && (firstParam instanceof ExecutionMeta) && firstParam.isAnotherCreature) {
            newMetaBranch = firstParam
        }
        newMetaBranch.creature.runtime.pushOnStack(parameters)
        let result = executeSingle(code.body, newMetaBranch)
        newMetaBranch.creature.runtime.popFromStack()
        return result?.value
    }
}

let cache = {
    elements: {}
}

let codeCallbacks = {
    ThisExpression: (code: any, meta: ExecutionMeta) => {
        return meta.creature.thisObj
    },
    JSXExpressionContainer: (code: any, meta: ExecutionMeta) => {
        return executeSingle(code.expression, meta)
    },
    JSXText: (code: any, meta: ExecutionMeta) => {
        return code.value.trim();
    },
    JSXElement: (code: any, meta: ExecutionMeta) => {
        if (!code.cosmoId) code.cosmoId = Utils.generator.generateKey()
        let Control = Controls[code.openingElement.name.name]
        if (!Control) {
            Control = meta.creature.module.applet.findModule(code.openingElement.name.name)
        }
        let attrs = {}
        code.openingElement.attributes.forEach((attr: any) => {
            attrs[attr.name.name] = executeSingle(attr.value, meta)
        })
        let key = attrs['key']
        if (!key) {
            key = code.cosmoId
            if (meta.parentJsxKey) key = meta.parentJsxKey + key
            attrs['key'] = key
        }
        let c = cache.elements[key];
        let isNew = (c === undefined)
        if (!c) {
            let children = code.children.map((child: any) => executeSingle(child, meta)).flat(Infinity).filter((child: any) => (child !== ''))
            c = Control.instantiate(attrs, attrs['style'], children)
            cache.elements[key] = c
        }
        if (c instanceof BaseElement) return c
        else {
            let newMetaBranch = Utils.generator.nestedContext(c, { ...meta, parentJsxKey: key })
            if (isNew) c.runtime.stack[0].findUnit('constructor')(newMetaBranch)
            return c._runtime.stack[0].findUnit('render')(newMetaBranch)
        }
    },
    Program: (code: any, meta: ExecutionMeta) => {
        code.body.forEach((child: any) => {
            executeSingle(child, meta)
        })
    },
    Literal: (code: any, meta: ExecutionMeta) => {
        return code.value
    },
    FunctionExpression: (code: any, meta: ExecutionMeta) => {
        let newCreatureBranch = new Creature(meta.creature.module, { ...meta.creature, runtime: meta.creature.runtime.clone() })
        let newMetaBranch = new ExecutionMeta({ ...meta, creature: newCreatureBranch })
        return generateCallbackFunction(code, newMetaBranch)
    },
    FunctionDeclaration: (code: any, meta: ExecutionMeta) => {
        let newCreatureBranch = new Creature(meta.creature.module, { ...meta.creature, runtime: meta.creature.runtime.clone() })
        let newMetaBranch = new ExecutionMeta({ ...meta, creature: newCreatureBranch })
        meta.creature.runtime.stackTop.putUnit(code.id.name, generateCallbackFunction(code, newMetaBranch))
    },
    MethodDefinition: (code: any, meta: ExecutionMeta) => {
        meta.creature.runtime.stackTop.putUnit(code.key.name, executeSingle(code.value, meta))
    },
    VariableDeclaration: (code: any, meta: ExecutionMeta) => {
        if (code.kind === 'let') {
            code.declarations.forEach((d: any) => executeSingle(d, new ExecutionMeta({ ...meta, declaration: true, declarationType: 'let' })));
        } else if (code.kind === 'const') {
            code.declarations.forEach((d: any) => executeSingle(d, new ExecutionMeta({ ...meta, declaration: true, declarationType: 'const' })));
        }
    },
    VariableDeclarator: (code: any, meta: ExecutionMeta) => {
        if (meta?.declaration) {
            meta.creature.runtime.stackTop.putUnit(code.id.name, executeSingle(code.init, meta))
        }
    },
    Identifier: (code: any, meta: ExecutionMeta) => {
        for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
            if (meta.returnIdParent) {
                let wrapper = findLayer(meta, code.name)
                if (wrapper) {
                    return { parent: wrapper.units, id: code.name }
                }
            } else {
                let r = meta.creature.runtime.stack[i].findUnit(code.name)
                if (r) {
                    return r
                }
            }
        }
    },
    BinaryExpression: (code: any, meta: ExecutionMeta) => {
        if (code.operator === '+') {
            return executeSingle(code.left, meta) + executeSingle(code.right, meta)
        } else if (code.operator === '-') {
            return executeSingle(code.left, meta) - executeSingle(code.right, meta)
        } else if (code.operator === '*') {
            return executeSingle(code.left, meta) * executeSingle(code.right, meta)
        } else if (code.operator === '/') {
            return executeSingle(code.left, meta) / executeSingle(code.right, meta)
        } else if (code.operator === '^') {
            return Math.pow(executeSingle(code.left, meta), executeSingle(code.right, meta))
        } else if (code.operator === '%') {
            return executeSingle(code.left, meta) % executeSingle(code.right, meta)
        } else if (code.operator === '===') {
            return executeSingle(code.left, meta) === executeSingle(code.right, meta)
        } else if (code.operator === '<') {
            return executeSingle(code.left, meta) < executeSingle(code.right, meta)
        } else if (code.operator === '>') {
            return executeSingle(code.left, meta) > executeSingle(code.right, meta)
        }
    },
    IfStatement: (code: any, meta: ExecutionMeta) => {
        if (executeSingle(code.test, meta)) {
            let r = executeSingle(code.consequent, meta)
            if (r?.breakFired === true) {
                return r
            }
        } else if (code.alternate) {
            let r = executeSingle(code.alternate, meta)
            if (r?.breakFired === true) {
                return r
            }
        }
    },
    BreakStatement: (code: any, meta: ExecutionMeta) => {
        return { breakFired: true };
    },
    WhileStatement: (code: any, meta: ExecutionMeta) => {
        while (executeSingle(code.test, meta)) {
            let r = executeSingle(code.body, meta)
            if (r.breakFired) break
            else if (r.returnFired) return r
        }
    },
    BlockStatement: (code: any, meta: ExecutionMeta) => {
        for (let i = 0; i < code.body?.length; i++) {
            let r = executeSingle(code.body[i], meta)
            if (r?.breakFired) return r
            else if (r?.returnFired) return r
        }
    },
    ExpressionStatement: (code: any, meta: ExecutionMeta) => {
        return executeSingle(code.expression, meta)
    },
    AssignmentExpression: (code: any, meta: ExecutionMeta) => {
        let right = executeSingle(code.right, meta)
        let wrapper = executeSingle(code.left, { ...meta, returnIdParent: true })
        if (wrapper) {
            if (wrapper.parent !== undefined) {
                let before = wrapper.parent[wrapper.id]
                if (code.operator === '=') {
                    wrapper.parent[wrapper.id] = right
                } else if (code.operator === '+=') {
                    wrapper.parent[wrapper.id] = before + right
                } else if (code.operator === '-=') {
                    wrapper.parent[wrapper.id] = before - right
                } else if (code.operator === '*=') {
                    wrapper.parent[wrapper.id] = before * right
                } else if (code.operator === '/=') {
                    wrapper.parent[wrapper.id] = before / right
                } else if (code.operator === '^=') {
                    wrapper.parent[wrapper.id] = Math.pow(before, right)
                } else if (code.operator === '%=') {
                    wrapper.parent[wrapper.id] = before % right
                }
            } else {
                let layer = findLayer(meta, wrapper.id)
                if (layer) {
                    let r = layer.findUnit(wrapper.id)
                    if (r) {
                        if (code.operator === '=') {
                            r = right
                        } else if (code.operator === '+=') {
                            r += right
                        } else if (code.operator === '-=') {
                            r -= right
                        } else if (code.operator === '*=') {
                            r *= right
                        } else if (code.operator === '/=') {
                            r /= right
                        } else if (code.operator === '^=') {
                            r = Math.pow(r, right)
                        } else if (code.operator === '%=') {
                            r %= right
                        }
                        layer.putUnit(code.name, r)
                    }
                }
            }
        }
    },
    ForStatement: (code: any, meta: ExecutionMeta) => {
        for (executeSingle(code.init, meta); executeSingle(code.test, meta); executeSingle(code.update, meta)) {
            let r = executeSingle(code.body, meta)
            if (r?.breakFired) break
            else if (r?.returnFired) return r
        }
    },
    UpdateExpression: (code: any, meta: ExecutionMeta) => {
        if (['++', '--'].includes(code.operator)) {
            let wrapper = executeSingle(code.argument, { ...meta, returnIdParent: true })
            if (wrapper) {
                if (wrapper.parent !== undefined) {
                    let before = wrapper.parent[wrapper.id]
                    if (typeof before === 'number') {
                        if (code.operator === '++') before++
                        else if (code.operator === '--') before--
                        wrapper.parent[wrapper.id] = before
                    }
                } else {
                    let layer = findLayer(meta, wrapper.id)
                    if (layer) {
                        let r = layer.findUnit(wrapper.id)
                        if (r) {
                            if (typeof r === 'number') {
                                if (code.operator === '++') r++
                                else if (code.operator === '--') r--
                                layer.putUnit(code.name, r)
                            }
                        }
                    }
                }
            }
        }
    },
    CallExpression: (code: any, meta: ExecutionMeta) => {
        let prop = undefined
        if (code.property === undefined) {
            let r = executeSingle(code.callee, meta);
            return r(...code.arguments.map((c: any) => executeSingle(c, meta)));
        } else {
            if (code.callee.property.type === 'Identifier') {
                prop = code.callee.property.name
            }
            let r = executeSingle(code.callee.object, meta);
            return r[prop](...code.arguments.map((c: any) => executeSingle(c, meta)))
        }
    },
    MemberExpression: (code: any, meta: ExecutionMeta) => {
        let prop = undefined
        if (code.property === undefined) {
            let r = executeSingle(code.object, meta);
            if (meta.returnIdParent) {
                return { parent: undefined, id: code.name }
            } else {
                return r;
            }
        } else {
            if (code.property.type === 'Identifier') {
                if (code.computed) {
                    prop = executeSingle(code.property, meta);
                } else {
                    if (code.property.type === 'Identifier') {
                        prop = code.property.name
                    } else if (code.property.type === 'Literal') {
                        prop = code.property.value;
                    }
                }
            }
            let filteredMeta = { ...meta }
            delete filteredMeta['returnIdParent']
            let r = executeSingle(code.object, filteredMeta);
            if (Array.isArray(r)) {
                let p = r[prop];
                if (typeof p === 'function') {
                    return (...args: Array<any>) => {
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
                    if (meta.returnIdParent) {
                        return { parent: r, id: prop }
                    } else {
                        return r[prop];
                    }
                }
            } else {
                if (meta.returnIdParent) {
                    return { parent: r, id: prop }
                } else {
                    return r[prop];
                }
            }
        }
    },
    SwitchStatement: (code: any, meta: ExecutionMeta) => {
        let disc = executeSingle(code.discriminant, meta)
        for (let i = 0; i < code.cases.length; i++) {
            let c = code.cases[i]
            if (c.type === 'SwitchCase') {
                let caseCond = executeSingle(c.test, meta);
                if (disc === caseCond) {
                    for (let j = 0; j < c.consequent.lengthl; j++) {
                        let co = c.consequent[j]
                        let r = executeSingle(co, meta)
                        if (r?.returnFired) return r
                    }
                }
            }
        }
    },
    ArrowFunctionExpression: (code: any, meta: ExecutionMeta) => {
        let newCreatureBranch = new Creature(meta.creature.module, { ...meta.creature, runtime: meta.creature.runtime.clone() })
        let newMetaBranch = new ExecutionMeta({ ...meta, creature: newCreatureBranch })
        return generateCallbackFunction(code, newMetaBranch)
    },
    ObjectExpression: (code: any, meta: ExecutionMeta) => {
        let obj = {}
        code.properties.forEach((property: any) => {
            if (property.key.type === 'Identifier') {
                obj[property.key.name] = executeSingle(property.value, meta)
            }
        })
        return obj
    },
    ArrayExpression: (code: any, meta: ExecutionMeta) => {
        return code.elements.map((arrEl: any) => executeSingle(arrEl, meta));
    },
    ReturnStatement: (code: any, meta: ExecutionMeta) => {
        return { value: executeSingle(code.argument, meta), returnFired: true }
    }
}

export default { executeSingle, executeBlock, ExecutionMeta }

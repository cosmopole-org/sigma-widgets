
import Module from "../Module";

class ExecutionMeta {

    module: Module
    declaration?: boolean
    declarationType?: string
    returnIdParent?: boolean

    constructor(metaDict: any) {
        this.module = metaDict.module
        this.declaration = (metaDict.declaration === true)
        this.declarationType = metaDict.declarationType
        this.returnIdParent = metaDict.returnIdParent
        if (this.declaration && !this.declarationType) {
            // TODO: throw invalid execution metadata exception
        }
    }
}

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
    for (let i = meta.module.runtime.stack.length - 1; i >= 0; i--) {
        let r = meta.module.runtime.stack[i].findUnit(id)
        if (r) {
            return meta.module.runtime.stack[i]
        }
    }
}

let codeCallbacks = {
    Program: (code: any, meta: ExecutionMeta) => {
        code.body.forEach((child: any) => {
            executeSingle(child, meta)
        })
    },
    Literal: (code: any, meta: ExecutionMeta) => {
        return code.value
    },
    FunctionExpression: (code: any, meta: ExecutionMeta) => {
        let newModuleBranch = { ...meta.module, runtime: meta.module.runtime.clone() }
        let newMetaBranch = new ExecutionMeta({ ...meta, module: newModuleBranch })
        return (...args: Array<any>) => {
            let parameters = {}
            code.params.forEach((param: any, index: number) => {
                parameters[param.name] = args[index + 1]
            })
            newMetaBranch.module.runtime.pushOnStack(parameters)
            let result = executeSingle(code.body, newMetaBranch)
            newMetaBranch.module.runtime.popFromStack()
            return result
        }
    },
    FunctionDeclaration: (code: any, meta: ExecutionMeta) => {
        let newModuleBranch = { ...meta.module, runtime: meta.module.runtime.clone() }
        let newMetaBranch = new ExecutionMeta({ ...meta, module: newModuleBranch })
        meta.module.runtime.stackTop.putUnit(code.id.name, (...args: Array<any>) => {
            let parameters = {}
            code.params.forEach((param: any, index: number) => {
                parameters[param.name] = args[index + 1]
            })
            newMetaBranch.module.runtime.pushOnStack(parameters)
            let result = executeSingle(code.body, newMetaBranch)
            newMetaBranch.module.runtime.popFromStack()
            return result
        })
    },
    MethodDefinition: (code: any, meta: ExecutionMeta) => {
        meta.module.runtime.stackTop.putUnit(code.key.name, executeSingle(code.value, meta))
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
            meta.module.runtime.stackTop.putUnit(code.id.name, executeSingle(code.init, meta))
        }
    },
    Identifier: (code: any, meta: ExecutionMeta) => {
        for (let i = meta.module.runtime.stack.length - 1; i >= 0; i--) {
            if (meta.returnIdParent) {
                let wrapper = findLayer(meta, code.name)
                if (wrapper) {
                    return { parent: wrapper.units, id: code.name }
                }
            } else {
                let r = meta.module.runtime.stack[i].findUnit(code.name)
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
        let layer = findLayer(meta, code.name)
        if (layer) {
            if (code.operator === '=') {
                layer.putUnit(code.left.name, executeSingle(code.right, meta))
            } else if (code.operator === '+=') {
                layer.putUnit(code.left.name, executeSingle(code.left, meta) + executeSingle(code.right, meta))
            } else if (code.operator === '-=') {
                layer.putUnit(code.left.name, executeSingle(code.left, meta) - executeSingle(code.right, meta))
            } else if (code.operator === '*=') {
                layer.putUnit(code.left.name, executeSingle(code.left, meta) * executeSingle(code.right, meta))
            } else if (code.operator === '/=') {
                layer.putUnit(code.left.name, executeSingle(code.left, meta) / executeSingle(code.right, meta))
            } else if (code.operator === '^=') {
                layer.putUnit(code.left.name, Math.pow(executeSingle(code.left, meta), executeSingle(code.right, meta)))
            } else if (code.operator === '%=') {
                layer.putUnit(code.left.name, executeSingle(code.left, meta) % executeSingle(code.right, meta))
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
        let newModuleBranch = { ...meta.module, runtime: meta.module.runtime.clone() }
        let newMetaBranch = new ExecutionMeta({ ...meta, module: newModuleBranch })
        return (...args: Array<any>) => {
            let parameters = {}
            code.params.forEach((param: any, index: number) => {
                parameters[param.name] = args[index + 1]
            })
            newMetaBranch.module.runtime.pushOnStack(parameters)
            let result = executeSingle(code.body, newMetaBranch)
            newMetaBranch.module.runtime.popFromStack()
            return result
        }
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
        return executeSingle(code.argument, meta);
    }
}

export default { executeSingle, executeBlock, ExecutionMeta }

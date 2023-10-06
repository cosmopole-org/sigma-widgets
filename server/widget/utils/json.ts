
let prettify = (obj: any) => {
    return JSON.stringify(obj, undefined, 4)
}

let diff = (obj1: any, obj2: any) => {
    if (obj2 === undefined) {
        if (obj1 === undefined) {
            return undefined
        } else {
            return {
                __state__: 'deleted'
            }
        }
    } else {
        if (obj1 === undefined) {
            return {
                __state__: 'created',
                __value__: obj2
            }
        } else {
            let getType = (val: any) => {
                return Array.isArray(val) ? 'array' : typeof val
            }
            if (getType(obj1) !== getType(obj2)) {
                return {
                    __state__: 'created',
                    __value__: obj2
                }
            } else {
                if (getType(obj1) === 'array') {
                    let result = {}
                    for (let i = 0; i < Math.max(obj2.length, obj1.length); i++) {
                        let r = diff(obj1[i], obj2[i])
                        if (r !== undefined) result[i] = r
                    }
                    if (Object.keys(result).length === 0) return undefined
                    else return result
                } else if (getType(obj1) === 'object') {
                    let result = {}
                    for (let key in obj2) {
                        let r = diff(obj1[key], obj2[key])
                        if (r !== undefined) result[key] = r
                    }
                    for (let key in obj1) {
                        if (!obj2[key]) {
                            result[key] = {
                                __state__: 'created',
                                __value__: obj2
                            }
                        }
                    }
                    if (Object.keys(result).length === 0) return undefined
                    else return result
                } else {
                    if (obj1 === obj2) {
                        return undefined
                    } else {
                        return {
                            __state__: 'updated',
                            __value__: obj2
                        }
                    }
                }
            }
        }
    }
}

export default { prettify, diff }

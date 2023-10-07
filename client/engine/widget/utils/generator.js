
import BaseElement from "../elements/BaseElement";
import ExecutionMeta from "../ExecutionMeta";
import StringProp from "../props/StringProp";
import NumberProp from "../props/NumberProp";
import BooleanProp from "../props/BooleanProp";
import FuncProp from "../props/FuncProp";

let generateKey = () => {
    return Math.random().toString().substring(2)
}

function clone(T, instance) {
    const copy = JSON.parse(JSON.stringify(instance));
    Object.assign(T, copy);
    return copy;
}

const prepareElement = (
    typeName,
    defaultProps,
    overridenProps,
    defaultStyles,
    overridenStyles,
    children
) => {
    let finalProps = {}
    Object.keys(defaultProps).forEach(propKey => {
        if (overridenProps[propKey] !== undefined) {
            let bpProp = defaultProps[propKey]
            let copiedProp
            if (bpProp._type === 'string') {
                copiedProp = clone(StringProp, bpProp)
            } else if (bpProp._type === 'number') {
                copiedProp = clone(NumberProp, bpProp)
            } else if (bpProp._type === 'boolean') {
                copiedProp = clone(BooleanProp, bpProp)
            } else if (bpProp._type === 'function') {
                copiedProp = clone(FuncProp, bpProp)
            }
            copiedProp._value = overridenProps[propKey]
            finalProps[propKey] = copiedProp
        }
    });
    let finalStyles = { ...defaultStyles }
    if (overridenStyles) finalStyles = { ...finalStyles, ...overridenStyles }
    return new BaseElement(overridenProps['key'], typeName, finalProps, finalStyles, children)
}

const nestedContext = (creature, otherMetas) => {
    if (otherMetas) {
        return new ExecutionMeta({ ...otherMetas, creature, isAnotherCreature: true })
    } else {
        return new ExecutionMeta({ creature, isAnotherCreature: true })
    }
}

export default { generateKey, prepareElement, nestedContext }


import BaseElement from "../elements/BaseElement";
import BaseProp from "../props/BaseProp";
import ExecutionMeta from "../ExecutionMeta";
import Creature from "../Creature";

let generateKey = () => {
    return Math.random().toString().substring(2)
}

function clone(instance) {
    const copy = JSON.parse(JSON.stringify(instance));
    Object.assign(copy, instance);
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
        if (overridenProps[propKey]) {
            let bpProp = defaultProps[propKey]
            let copiedProp = clone(bpProp)
            copiedProp.setValue(overridenProps[propKey])
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

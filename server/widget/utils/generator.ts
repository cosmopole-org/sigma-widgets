import NumberProp from "../props/NumberProp";
import BaseElement from "../elements/BaseElement";
import BaseProp from "../props/BaseProp";
import StringProp from "../props/StringProp";

let generateKey = () => {
    return Math.random().toString().substring(2)
}

function clone<T>(instance: T): T {
    const copy = new (instance.constructor as { new(): T })();
    Object.assign(copy, instance);
    return copy;
}

let prepareElement = (
    typeName: string,
    defaultProps: { [id: string]: BaseProp },
    overridenProps: { [id: string]: any },
    defaultStyles: { [id: string]: any },
    overridenStyles: { [id: string]: any }
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
    return new BaseElement(typeName, finalProps, finalStyles, [])
}

export default { generateKey, prepareElement }

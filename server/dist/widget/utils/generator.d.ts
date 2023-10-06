import BaseElement from "../elements/BaseElement";
import BaseProp from "../props/BaseProp";
import ExecutionMeta from "../ExecutionMeta";
import Creature from "../Creature";
declare const _default: {
    generateKey: () => string;
    prepareElement: (typeName: string, defaultProps: {
        [id: string]: BaseProp;
    }, overridenProps: {
        [id: string]: any;
    }, defaultStyles: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: BaseElement[]) => BaseElement;
    nestedContext: (creature: Creature, otherMetas?: ExecutionMeta) => ExecutionMeta;
};
export default _default;

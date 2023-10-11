import BaseControl from './BaseControl';
import StringProp from '../props/StringProp';
import BaseElement from '../elements/BaseElement';
import FuncProp from '../props/FuncProp';
declare class ButtonControl extends BaseControl {
    static readonly TYPE = "button";
    static defaultProps: {
        caption: StringProp;
        variant: StringProp;
        onClick: FuncProp;
    };
    static defaultStyles: {
        width: number;
        height: string;
    };
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}
export default ButtonControl;

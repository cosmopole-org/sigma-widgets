import BaseControl from './BaseControl';
import BaseElement from '../elements/BaseElement';
import FuncProp from '../props/FuncProp';
declare class TabsControl extends BaseControl {
    static readonly TYPE = "tabs";
    static defaultProps: {
        onChange: FuncProp;
    };
    static defaultStyles: {};
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}
export default TabsControl;

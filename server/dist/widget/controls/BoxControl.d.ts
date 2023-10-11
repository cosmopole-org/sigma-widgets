import BaseControl from './BaseControl';
import BaseElement from '../elements/BaseElement';
declare class BoxControl extends BaseControl {
    static readonly TYPE = "box";
    static defaultProps: {};
    static defaultStyles: {
        width: number;
        height: number;
    };
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}
export default BoxControl;

import BaseControl from './BaseControl';
import BaseElement from '../elements/BaseElement';
declare class PrimaryTabControl extends BaseControl {
    static readonly TYPE = "primary-tab";
    static defaultProps: {};
    static defaultStyles: {};
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}
export default PrimaryTabControl;

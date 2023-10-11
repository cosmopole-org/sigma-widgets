import BaseControl from './BaseControl';
import BaseElement from '../elements/BaseElement';
declare class CardControl extends BaseControl {
    static readonly TYPE = "card";
    static defaultProps: {};
    static defaultStyles: {
        width: number;
        height: number;
        boxShadow: string;
        backgroundColor: string;
        borderRadius: number;
    };
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}
export default CardControl;

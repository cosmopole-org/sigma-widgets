import BaseControl from './BaseControl';
import StringProp from '../props/StringProp';
import BaseElement from '../elements/BaseElement';
declare class TextControl extends BaseControl {
    static readonly TYPE = "text";
    static defaultProps: {
        text: StringProp;
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
export default TextControl;


import BaseControl from './BaseControl';
import StringProp from '../props/StringProp'
import Utils from '../utils';

class TextControl extends BaseControl {

    public static readonly TYPE = 'text'
    public static defaultProps = {
        text: new StringProp('')
    }
    public static defaultStyles = {
        width: 150,
        height: 'auto'
    }

    public static instantiate(overridenProps: { [id: string]: any }, overridenStyles: { [id: string]: any }) {
        return Utils.generator.prepareElement(TextControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles)
    }
}

export default TextControl

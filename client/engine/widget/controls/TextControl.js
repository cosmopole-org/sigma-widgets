
import BaseControl from './BaseControl';
import StringProp from '../props/StringProp'
import Utils from '../utils';

class TextControl extends BaseControl {

    static TYPE = 'text'
    static defaultProps = {
        text: new StringProp('')
    }
    static defaultStyles = {
        width: 150,
        height: 'auto'
    }

    static instantiate(overridenProps, overridenStyles, children) {
        return Utils.generator.prepareElement(TextControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children)
    }
}

export default TextControl

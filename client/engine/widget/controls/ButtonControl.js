
import BaseControl from './BaseControl';
import StringProp from '../props/StringProp'
import Utils from '../utils';
import FuncProp from '../props/FuncProp';

class ButtonControl extends BaseControl {

    static TYPE = 'button'
    static defaultProps = {
        caption: new StringProp(''),
        variant: new StringProp('filled'),
        onClick: new FuncProp(undefined)
    }
    static defaultStyles = {
        width: 150,
        height: 56
    }

    static instantiate(overridenProps, overridenStyles, children) {
        return Utils.generator.prepareElement(ButtonControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children)
    }
}

export default ButtonControl

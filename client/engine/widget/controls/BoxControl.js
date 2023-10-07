
import BaseControl from './BaseControl';
import Utils from '../utils';

class BoxControl extends BaseControl {

    static TYPE = 'box'
    static defaultProps = {
        
    }
    static defaultStyles = {
        width: 200,
        height: 200
    }

    static instantiate(overridenProps, overridenStyles, children) {
        return Utils.generator.prepareElement(BoxControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children)
    }
}

export default BoxControl


import BaseControl from './BaseControl';
import Utils from '../utils';
import BaseElement from '../elements/BaseElement';

class PrimaryTabControl extends BaseControl {

    static TYPE = 'primary-tab'
    static defaultProps = {
        
    }
    static defaultStyles = {
        
    }

    static instantiate(overridenProps, overridenStyles, children) {
        return Utils.generator.prepareElement(PrimaryTabControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children)
    }
}

export default PrimaryTabControl

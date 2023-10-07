
import BaseControl from './BaseControl';
import Utils from '../utils';
import BaseElement from '../elements/BaseElement';

class TabsControl extends BaseControl {

    static TYPE = 'tabs'
    static defaultProps = {
        
    }
    static defaultStyles = {
        
    }

    static instantiate(overridenProps, overridenStyles, children) {
        return Utils.generator.prepareElement(TabsControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children)
    }
}

export default TabsControl

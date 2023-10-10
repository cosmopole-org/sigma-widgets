
import BaseControl from './BaseControl';
import Utils from '../utils';
import BaseElement from '../elements/BaseElement';
import FuncProp from '../props/FuncProp';

class TabsControl extends BaseControl {

    static TYPE = 'tabs'
    static defaultProps = {
        onChange: new FuncProp(undefined)
    }
    static defaultStyles = {
        
    }

    static instantiate(overridenProps, overridenStyles, children) {
        return Utils.generator.prepareElement(TabsControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children)
    }
}

export default TabsControl

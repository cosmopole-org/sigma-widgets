
import BaseControl from './BaseControl';
import Utils from '../utils';
import BaseElement from '../elements/BaseElement';

class BoxControl extends BaseControl {

    public static readonly TYPE = 'box'
    public static defaultProps = {
        
    }
    public static defaultStyles = {
        width: 200,
        height: 200
    }

    public static instantiate(overridenProps: { [id: string]: any }, overridenStyles: { [id: string]: any }, children: Array<BaseElement>) {
        return Utils.generator.prepareElement(BoxControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children)
    }
}

export default BoxControl


import BaseControl from './BaseControl';
import Utils from '../utils';

class CardControl extends BaseControl {

    static TYPE = 'card'
    static defaultProps = {
        
    }
    static defaultStyles = {
        width: 200,
        height: 200,
        boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px',
        backgroundColor: '#fff',
        borderRadius: 4
    }

    static instantiate(overridenProps, overridenStyles, children) {
        return Utils.generator.prepareElement(CardControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children)
    }
}

export default CardControl

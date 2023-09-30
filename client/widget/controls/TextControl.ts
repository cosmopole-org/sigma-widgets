
import BaseControl from './BaseControl';
import StringProp from './props/StringProp'

class TextControl extends BaseControl {

    public readonly defaultProps = {
        text: new StringProp('')
    }

    public readonly defaultStyles = {
        width: 150,
        height: 'auto'
    }
}

export default TextControl

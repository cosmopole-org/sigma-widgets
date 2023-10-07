
import TextControl from "./TextControl"
import ButtonControl from './ButtonControl'
import BoxControl from './BoxControl'
import CardControl from './CardControl'
import TabsControl from './TabsControl'
import PrimaryTabControl from './PrimaryTabControl'

export default {
    [TextControl.TYPE]: TextControl,
    [ButtonControl.TYPE]: ButtonControl,
    [BoxControl.TYPE]: BoxControl,
    [CardControl.TYPE]: CardControl,
    [TabsControl.TYPE]: TabsControl,
    [PrimaryTabControl.TYPE]: PrimaryTabControl
}

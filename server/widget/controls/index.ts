
import BoxControl from "./BoxControl"
import ButtonControl from "./ButtonControl"
import CardControl from "./CardControl"
import TabsControl from "./TabsControl"
import PrimaryTabControl from "./PrimaryTabControl"
import TextControl from "./TextControl"

export default {
    [TextControl.TYPE]: TextControl,
    [ButtonControl.TYPE]: ButtonControl,
    [BoxControl.TYPE]: BoxControl,
    [CardControl.TYPE]: CardControl,
    [TabsControl.TYPE]: TabsControl,
    [PrimaryTabControl.TYPE]: PrimaryTabControl
}

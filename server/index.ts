
import Module from './widget/Module'
import Native from './Native'
import Applet, { Runnable } from './widget/Applet'
import Utils from './widget/utils'

let applet = new Applet('frame')

applet.fill(
    `
    class Box {
        constructor() {
        
        }
        onMount() {

        }
        render() {
            return nativeElement('box', this.props, this.styles, this.children)
        }
    }
    class Text {
        constructor() {
        
        }
        onMount() {

        }
        render() {
            return nativeElement('text', this.props, this.styles, [])
        }
    }
    class Child {
        constructor() {
            this.state = {
                name: 'mamad'
            }
        }
        onMount() {
            setTimeout(() => {
                this.setState({ name: 'keyhan' })
            }, 1000)
        }
        render() {
            return (
                <Box>
                    {
                        this.state.name === 'mamad' ? [0, 1].map(item => {
                            return (
                                <Text key={item} text={this.state.name + ' ' + item} />
                            )
                        }) : [0, 1, 2].map(item => {
                            return (
                                <Text key={item} text={this.state.name} />
                            )
                        })
                    }
                </Box>
            )
        }
    }
    class Test {
        constructor() {

        }
        onMount() {

        }
        render() {
            return (
                <Child />
            )
        }
    }
    `
)

const update = (key: string, u: any) => {
    console.log(Utils.json.prettify(u))
}

applet.run('Test', (mod: Module) => new Native(mod), update).then((runnable: Runnable) => {
    console.log(Utils.json.prettify(runnable.root))
    runnable.mount()
})


import Module from './widget/Module'
import Native from './Native'
import Applet from './widget/Applet'
import Utils from './widget/utils'

let applet = new Applet('frame')

applet.fill(
    `
    class Test {
        constructor() {
            console.log('ok')
            this.name = 'keyhan'
        }
        render() {
            console.log('name:', this.name)
            return (
                <text text='5'>
                    {this.children}
                </text>
            )
        }
    }
    class Middle {
        constructor() {
            this.lastName = 'mohammadi'
        }
        render() {
            console.log('lastName:', this.lastName)
            return (
                <text text='6'>
                    {this.children}
                </text>
            )
        }
    }
    class Button {
        constructor() { }
        render() {
            return (
                <Test hello='1'>
                    <text text='2' />
                    <Middle>
                        <Test>
                            <text text='4' />
                        </Test>
                    </Middle>
                    <Middle>
                        <Test>
                            <text text='4' />
                        </Test>
                    </Middle>
                </Test>
            )
        }
    }
`
)

// <text>
//     <text/>
//     <text>
//         <text/>
//     </text>
// </text>

console.log(Utils.json.prettify(applet.run('Button', (mod: Module) => new Native(mod))))

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
class Button {
    constructor() {

    }
    onMount() {

    }
    render() {
        return nativeElement('button', this.props, this.styles, [])
    }
}
class Tabs {
    constructor() {

    }
    onMount() {

    }
    render() {
        return nativeElement('tabs', this.props, this.styles, this.children)
    }
}
class PrimaryTab {
    constructor() {

    }
    onMount() {

    }
    render() {
        return nativeElement('primary-tab', this.props, this.styles, this.children)
    }
}
class Food {
    constructor() {
        this.state = {
            count: 0
        }
    }
    onMount() {

    }
    render() {
        let { food } = this.props
        let { count } = this.state
        return (
            <Box key={food.id} style={{ margin: 8, width: 100, height: 100, backgroundColor: '#fff' }}>
                <Text text={food.id} style={{ width: '100%', height: '50%', display: 'flex', verticalAlign: 'middle', textAlign: 'center', alignItems: 'center', justifyContent: 'center' }} />
                <Text text={count} style={{ width: '100%', height: '50%', display: 'flex', verticalAlign: 'middle', textAlign: 'center', alignItems: 'center', justifyContent: 'center' }} />
                <Box style={{ width: '100%', height: 32, alignItems: 'center', justifyContent: 'center', textAlign: 'center', display: 'flex' }}>
                    <Button style={{ width: 32, height: 32 }} caption='-' onClick={() => this.setState({ count: count + 1 })} />
                    <Button style={{ width: 32, height: 32 }} caption='+' />
                </Box>
            </Box>
        )
    }
}
class Test {
    constructor() {
        this.state = {
            selectedCategoryId: 'pizza',
            menu: {
                pizza: [
                    {
                        id: 'pizza 1',
                        count: 0
                    },
                    {
                        id: 'pizza 2',
                        count: 0
                    }
                ],
                pasta: [
                    {
                        id: 'pasta 1',
                        count: 0
                    },
                    {
                        id: 'pasta 2',
                        count: 0
                    }
                ]
            }
        }
    }
    onMount() {

    }
    render() {
        let cats = Object.keys(this.state.menu)
        return (
            <Box style={{ width: '100%', height: '100%', backgroundColor: '#eee' }}>
                <Tabs onChange={e => {
                    this.setState({ ...this.state, selectedCategoryId: cats[e.target.activeTabIndex] })
                }}>
                    {
                        cats.map(cat => {
                            return <PrimaryTab><Text style={{ width: '100%', textAlign: 'center' }} text={cat} /></PrimaryTab>
                        })
                    }
                </Tabs>
                <Box style={{ width: '100%', height: 'calc(100% - 50px)', overflowY: 'auto', display: 'flex', flexWrap: 'wrap' }}>
                    {
                        this.state.menu[this.state.selectedCategoryId].map(food => {
                            return (
                                <Food key={food.id} food={food} />
                            )
                        })
                    }
                </Box>
            </Box>
        )
    }
}
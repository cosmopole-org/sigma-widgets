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
            count: this.props.food.count
        }
    }
    onMount() {

    }
    render() {
        return (
            <Box style={{
                marginTop: 16, width: 'calc(100% - 32px)', height: 125, backgroundColor: '#fff', borderRadius: 16,
                boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px', marginBottom: 24
            }}>
                <Box style={{ width: '100%', paddingTop: 8, height: 'calc(100% - 28px)', position: 'relative' }}>
                    <Box style={{ marginTop: 8, paddingLeft: 16, height: 'auto', width: 'auto', display: 'flex' }}>
                        <Text text={this.props.food.id} style={{ fontSize: 18, fontWeight: 'bold', width: 'auto', display: 'flex', verticalAlign: 'middle', textAlign: 'left', alignItems: 'left', justifyContent: 'left' }} />
                        <Text text={this.props.food.tag} style={{ width: 'auto', paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, backgroundColor: '#9cf', borderRadius: 12, marginLeft: 16, fontSize: 17, textAlign: 'left' }} />
                        <Box style={{ flex: 1, height: 16 }} />
                        <Box style={{ height: 'auto', width: 'auto' }}>
                            <Text text={this.state.count} style={{ width: 'auto', height: 'auto', display: this.state.count === 0 ? 'none' : 'block', backgroundColor: 'pink', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: '50%' }} />
                        </Box>
                        <Box style={{ height: 16, width: 16 }} />
                    </Box>
                    <Box style={{ marginTop: 16, height: 'auto', width: 'auto', paddingLeft: 16 }}>
                        <Text text={this.props.food.description} style={{ width: '100%', textAlign: 'left' }} />
                    </Box>
                    <Box style={{ borderRadius: '12px 0px 0px 12px', width: 'auto', height: 'auto', position: 'absolute', right: 0, top: 56, backgroundColor: '#9fc', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
                        <Text text={this.props.food.price + ' $'} style={{ width: 'auto' }} />
                    </Box>
                </Box>
                <Box style={{ width: 'calc(100% - 32px)', height: 32, alignItems: 'right', justifyContent: 'right', textAlign: 'right', display: 'flex' }}>
                    <Button style={{ height: 32, maxWidth: 56, fontSize: 25 }} caption='-' onClick={() => {
                        if (this.state.count > 0) {
                            this.props.onCountChange(this.state.count - 1)
                            this.setState({ count: this.state.count - 1 })
                        }
                    }} />
                    <Box style={{ width: 16, height: 16 }} />
                    <Button style={{ height: 32, maxWidth: 56, fontSize: 18 }} caption='+' onClick={() => {
                        this.props.onCountChange(this.state.count + 1)
                        this.setState({ count: this.state.count + 1 })
                    }} />
                </Box>
            </Box>
        )
    }
}
class Test {
    constructor() {
        this.state = {
            total: 0,
            selectedCategoryId: 'pizza',
            menu: {
                pizza: [
                    {
                        id: 'pizza 1',
                        description: 'bla bla bla',
                        tag: 'a tag ...',
                        count: 0,
                        price: 16
                    },
                    {
                        id: 'pizza 2',
                        description: 'bla bla bla',
                        tag: 'a tag ...',
                        count: 0,
                        price: 32
                    },
                    {
                        id: 'pizza 3',
                        description: 'bla bla bla',
                        tag: 'a tag ...',
                        count: 0,
                        price: 16
                    },
                    {
                        id: 'pizza 4',
                        description: 'bla bla bla',
                        tag: 'a tag ...',
                        count: 0,
                        price: 32
                    },
                    {
                        id: 'pizza 5',
                        description: 'bla bla bla',
                        tag: 'a tag ...',
                        count: 0,
                        price: 16
                    },
                    {
                        id: 'pizza 6',
                        description: 'bla bla bla',
                        tag: 'a tag ...',
                        count: 0,
                        price: 32
                    }
                ],
                pasta: [
                    {
                        id: 'pasta 1',
                        description: 'bla bla bla',
                        tag: 'a tag ...',
                        count: 0,
                        price: 48
                    },
                    {
                        id: 'pasta 2',
                        description: 'bla bla bla',
                        tag: 'a tag ...',
                        count: 0,
                        price: 64
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
            <Box style={{ width: 'calc(100% - 16px)', height: '100%', backgroundColor: '#eee', position: 'relative', padding: 8 }}>
                <Tabs onChange={e => {
                    this.state.selectedCategoryId = cats[e.target.activeTabIndex]
                    this.setState(this.state)
                }} style={{ borderRadius: 28, boxShadow: 'rgba(0, 0, 0, 0.16) 0px 1px 4px' }}>
                    {
                        cats.map(cat => {
                            return <PrimaryTab><Text style={{ width: '100%', textAlign: 'center', fontSize: 17 }} text={cat} /></PrimaryTab>
                        })
                    }
                </Tabs>
                <Box style={{ padding: 16, width: '100%', height: 'calc(100% - 56px)', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start' }}>
                    <Box style={{ width: '100%', height: 'auto' }}>
                        {
                            this.state.menu[this.state.selectedCategoryId].map(food => {
                                return (
                                    <Food key={food.id} food={food} onCountChange={count => {
                                        food.count = count
                                        let cats = Object.keys(this.state.menu)
                                        let total = 0
                                        cats.forEach(cat => {
                                            let foods = this.state.menu[cat]
                                            foods.forEach(food => {
                                                total += (food.price * food.count)
                                            })
                                        })
                                        this.state.total = total
                                        this.setState(this.state)
                                    }} />
                                )
                            })
                        }
                    </Box>
                    <Box style={{ width: '100%', height: 100 }} />
                </Box>
                <Text text={this.state.total + ' $'} style={{ boxShadow: 'rgba(0, 0, 0, 0.35) 0px 5px 15px', fontSize: 17, position: 'absolute', left: 0, bottom: 0, paddingLeft: 24, paddingTop: 24, backgroundColor: '#fff', width: 'calc(100%)', height: 56 }} />
                <Button style={{ width: 100, height: 48, position: 'absolute', right: 16, bottom: 24, borderRadius: 0 }} caption='Submit' onClick={() => {
                    console.log({ order: this.state.menu, total: this.state.total })
                }} />
            </Box>
        )
    }
}
class Food {
    constructor() {
        this.state = {
            count: this.props.food.price
        }
    }
    onMount() {

    }
    render() {
        return (
            <card style={{ margin: 8, width: 100, height: 100 }}>
                <text text={this.props.food.id} style={{ width: '100%', height: '50%', display: 'flex', verticalAlign: 'middle', textAlign: 'center', alignItems: 'center', justifyContent: 'center' }} />
                <text text={this.state.count} style={{ width: '100%', height: '50%', display: 'flex', verticalAlign: 'middle', textAlign: 'center', alignItems: 'center', justifyContent: 'center' }} />
                <box style={{ width: '100%', height: 32, alignItems: 'center', justifyContent: 'center', textAlign: 'center', display: 'flex' }}>
                    <button style={{ width: 32, height: 32 }} caption='-' onClick={() => {
                        this.props.printMenu()
                        this.setState({ count: this.state.count - 1 })
                    }} />
                    <button style={{ width: 32, height: 32 }} caption='+' onClick={() => {
                        this.props.printMenu()
                        this.setState({ count: this.state.count + 1 })
                    }} />
                </box>
            </card>
        )
    }
}
class Button {
    constructor() {
        this.state = {
            selectedCategory: 'pizza',
            menu: {
                pizza: [
                    {
                        id: 'pizza 1',
                        count: 0,
                        price: 10
                    },
                    {
                        id: 'pizza 2',
                        count: 0,
                        price: 25
                    }
                ],
                pasta: [
                    {
                        id: 'pasta 1',
                        count: 0,
                        price: 20
                    },
                    {
                        id: 'pasta 2',
                        count: 0,
                        price: 35
                    }
                ]
            }
        }
    }
    onMount() {

    }
    render() {
        let tabsArr = Object.keys(this.state.menu)
        return (
            <box style={{ backgroundColor: '#eee', width: '100%', height: '100%' }}>
                <tabs style={{ width: '100%', height: 56 }} onChange={e => {
                    this.setState({ selectedCategory: tabsArr[e.target.activeTabIndex] })
                }}>
                    {
                        tabsArr.map(cat => {
                            return <primary-tab key={cat}>{cat}</primary-tab>
                        })
                    }
                </tabs>

                <box style={{ width: '100%', height: 'calc(100% - 56px)', display: 'flex', flexWrap: 'wrap', overflowY: 'auto', alignContent: 'flex-start' }}>
                    {
                        this.state.menu[this.state.selectedCategory].map(food => {
                            return <Food key={food.id} food={food} printMenu={() => {
                                console.log(this.state.menu)
                            }} />
                        })
                    }
                </box>
            </box>
        )
    }
}
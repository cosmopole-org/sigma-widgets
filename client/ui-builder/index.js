
class UIDriver {

    bindings = {}

    createElement(controlType, tag, props, styles) {
        let element = document.createElement(tag)
        for (let key in props) {
            element[key] = props[key]
        }
        element.style = styles
        this.bindings[props.cosmoId] = { rendered: element, controlType }
        return element
    }

    build(element, parentKey) {
        if (element === undefined) return undefined
        let result = undefined
        if (typeof element === 'string' || typeof element === 'number' || typeof element === 'boolean') {
            let span = document.createElement('span')
            span.id = element._key
            span.textContent = element
            result = span
        } else {
            switch (element._controlType) {
                case 'text': {
                    result = this.createElement(
                        'text',
                        'span',
                        {
                            cosmoId: element._key,
                            textContent: element._props.text._value
                        },
                        element._styles
                    )
                    break
                }
                case 'box': {
                    result = this.createElement(
                        'box',
                        'div',
                        {
                            cosmoId: element._key,
                        },
                        element._styles
                    )
                    element._children.forEach(c => {
                        result.appendChild(this.build(c))
                    });
                    break
                }
                case 'card': {
                    result = this.createElement(
                        'card',
                        'div',
                        {
                            cosmoId: element._key,
                        },
                        element._styles
                    )
                    element._children.forEach(c => {
                        result.appendChild(this.build(c))
                    });
                    break
                }
                case 'button': {
                    let elementTag
                    if (element._props.variant._value === 'outlined') {
                        elementTag = 'md-outlined-button'
                    } else {
                        elementTag = 'md-filled-button'
                    }
                    result = this.createElement(
                        'button',
                        elementTag,
                        {
                            cosmoId: element._key,
                            textContent: element._props.caption._value
                        },
                        element._styles
                    )
                    break
                }
                case 'tabs': {
                    result = this.createElement(
                        'tabs',
                        'md-tabs',
                        {
                            cosmoId: element._key,
                        },
                        element._styles
                    )
                    element._children.forEach(c => {
                        result.appendChild(this.build(c))
                    })
                    break
                }
                case 'primary-tab': {
                    result = this.createElement(
                        'primary-tab',
                        'md-primary-tab',
                        {
                            cosmoId: element._key,
                        },
                        element._styles
                    )
                    element._children.forEach(c => {
                        result.appendChild(this.build(c))
                    })
                    break
                }
            }
        }
        let parent = this.bindings[parentKey]?.rendered
        if (parent) {
            parent.appendChild(result)
        }
        return result
    }

    update(element, propKey, propValue) {
        let key = element._key
        let elCont = this.bindings[key]
        if (elCont) {
            let { rendered, controlType } = elCont
            switch (controlType) {
                case 'text': {
                    switch (propKey) {
                        case 'text': {
                            rendered.textContent = propValue
                            break
                        }
                    }
                    break
                }
                case 'button': {
                    switch (propKey) {
                        case 'caption': {
                            rendered.textContent = propValue
                            break
                        }
                        case 'variant': {
                            let elementTag
                            if (propValue === 'outlined') {
                                elementTag = 'md-outlined-button'
                            } else {
                                elementTag = 'md-filled-button'
                            }
                            rendered.replaceWith(
                                this.createElement(
                                    'button',
                                    elementTag,
                                    {
                                        cosmoId: key,
                                        textContent: element._props.caption._value
                                    },
                                    element._styles
                                )
                            )
                            break
                        }
                    }
                    break
                }
            }
        }
    }
}

window.UIDriver = UIDriver

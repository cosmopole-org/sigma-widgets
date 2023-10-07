
let bindings = {}

class UIDriver {

    build(element) {
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
                    let text = document.createElement('span')
                    text.id = element._key
                    text.textContent = element._props.text._value
                    text.style = element._styles
                    result = text
                    break
                }
                case 'button': {
                    let button = document.createElement('md-filled-button')
                    button.id = element._key
                    button.textContent = element._props.caption._value
                    button.style = element._styles
                    result = button
                    break
                }
            }
        }
        bindings[element._key] = { element: result, controlType: element.controlType }
        return result
    }

    update(elKey, propKey, propValue) {
        let elCont = bindings[elKey]
        if (elCont) {
            let { element, controlType } = elCont
            switch (controlType) {
                case 'text': {
                    switch (propKey) {
                        case 'text': {
                            element.textContent = propValue
                            break
                        }
                    }
                    break
                }
                case 'button': {
                    switch (propKey) {
                        case 'caption': {
                            element.textContent = propValue
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

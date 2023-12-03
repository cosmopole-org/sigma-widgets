
import cssProperty from './cssProperty';
import hyphenateStyleName from './hyphenateStyleName';

let { isUnitlessNumber } = cssProperty

var isArray = Array.isArray;
var keys = Object.keys;

var counter = 1;
// Follows syntax at https://developer.mozilla.org/en-US/docs/Web/CSS/content,
// including multiple space separated values.
var unquotedContentValueRegex = /^(normal|none|(\b(url\([^)]*\)|chapter_counter|attr\([^)]*\)|(no-)?(open|close)-quote|inherit)((\b\s*)|$|\s+))+)$/;

function buildRule(key, value) {
    if (!isUnitlessNumber[key] && typeof value === 'number') {
        value = '' + value + 'px';
    }
    else if (key === 'content' && !unquotedContentValueRegex.test(value)) {
        value = "'" + value.replace(/'/g, "\\'") + "'";
    }

    return hyphenateStyleName(key) + ': ' + value + ';  ';
}

function buildValue(key, value) {
    if (!isUnitlessNumber[key] && typeof value === 'number') {
        value = '' + value + 'px';
    }
    else if (key === 'content' && !unquotedContentValueRegex.test(value)) {
        value = "'" + value.replace(/'/g, "\\'") + "'";
    }

    return value + '';
}

function styleToCssString(rules: { [id: string]: any }): string {
    var result = ''
    if (!rules || keys(rules).length === 0) {
        return result;
    }
    var styleKeys = keys(rules);
    for (var j = 0, l = styleKeys.length; j < l; j++) {
        var styleKey = styleKeys[j];
        var value = rules[styleKey];

        if (isArray(value)) {
            for (var i = 0, len = value.length; i < len; i++) {
                result += buildRule(styleKey, value[i]);
            }
        }
        else {
            result += buildRule(styleKey, value);
        }
    }
    return result;
}

class UiBuilder {

    bindings = {}

    constructor() { }

    createElement(controlType: string, tag: string, props: { [id: string]: any }, styles: { [id: string]: any }, control: any): HTMLElement {
        let element = document.createElement(tag)
        for (let key in props) {
            element[key] = props[key]
        }
        element.style.cssText = styleToCssString(styles)
        this.bindings[props.cosmoId] = { rendered: element, controlType, control }
        return element
    }

    build(element: any, parentKey?: string): HTMLElement | undefined {
        if (element === undefined) return undefined
        let result: HTMLElement | undefined = undefined
        if (typeof element === 'string' || typeof element === 'number' || typeof element === 'boolean') {
            let span = document.createElement('span')
            span.textContent = element.toString()
            result = span
        } else {
            switch (element._controlType) {
                case 'text': {
                    result = this.createElement(
                        'text',
                        'span',
                        {
                            cosmoId: element._key,
                            textContent: element._props.text?._value
                        },
                        element._styles,
                        element
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
                        element._styles,
                        element
                    )
                    element._children.forEach((c: any) => {
                        let childEl = this.build(c)
                        if (childEl !== undefined) {
                            result?.appendChild(childEl)
                        }
                    });
                    break
                }
                case 'image': {
                    result = this.createElement(
                        'image',
                        'img',
                        {
                            cosmoId: element._key,
                            src: element._props.src?._value
                        },
                        element._styles,
                        element
                    )
                    element._children.forEach((c: any) => {
                        let childEl = this.build(c)
                        if (childEl !== undefined) {
                            result?.appendChild(childEl)
                        }
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
                        element._styles,
                        element
                    )
                    element._children.forEach(c => {
                        let childEl = this.build(c)
                        if (childEl !== undefined) {
                            result?.appendChild(childEl)
                        }
                    });
                    break
                }
                case 'button': {
                    let elementTag
                    if (element._props.variant?._value === 'outlined') {
                        elementTag = 'md-outlined-button'
                    } else {
                        elementTag = 'md-filled-button'
                    }
                    result = this.createElement(
                        'button',
                        elementTag,
                        {
                            cosmoId: element._key,
                            textContent: element._props.caption?._value,
                            onclick: element._props.onClick?._value
                        },
                        element._styles,
                        element
                    )
                    break
                }
                case 'tabs': {
                    result = this.createElement(
                        'tabs',
                        'md-tabs',
                        {
                            cosmoId: element._key,
                            onchange: element._props.onChange?._value
                        },
                        element._styles,
                        element
                    )
                    element._children.forEach(c => {
                        let childEl = this.build(c)
                        if (childEl !== undefined) {
                            result?.appendChild(childEl)
                        }
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
                        element._styles,
                        element
                    )
                    element._children.forEach(c => {
                        let childEl = this.build(c)
                        if (childEl !== undefined) {
                            result?.appendChild(childEl)
                        }
                    })
                    break
                }
            }
        }
        if (parentKey !== undefined) {
            let parent = this.bindings[parentKey]?.rendered
            if (parent !== undefined && result !== undefined) {
                parent.appendChild(result)
            }
        }
        return result
    }

    createChild(newChild: any, parentKey: string): HTMLElement | undefined {
        return this.build(newChild, parentKey)
    }

    deleteChild(childKey: string): void {
        let elCont = this.bindings[childKey]
        if (elCont) {
            let { rendered } = elCont
            rendered.remove()
        }
    }

    replaceChild(element: any, newChild: any): HTMLElement | undefined {
        let key = element._key
        let elCont = this.bindings[key]
        if (elCont) {
            let { rendered } = elCont
            let newRendered = this.build(newChild)
            rendered.replaceWith(newRendered)
            return newRendered
        }
    }

    updateStyle(elementKey: string, cssKey: string, cssValue: any): void {
        let elCont = this.bindings[elementKey]
        if (elCont) {
            let { rendered } = elCont
            rendered.style[cssKey] = cssValue
        }
    }

    updateProp(elementKey: string, propKey: string, propValue: any): void {
        let elCont = this.bindings[elementKey]
        if (elCont) {
            let { rendered, controlType, control } = elCont
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
                case 'box': {
                    switch (propKey) {
                        case 'text': {
                            rendered.textContent = propValue
                            break
                        }
                    }
                    break
                }
                case 'image': {
                    switch (propKey) {
                        case 'src': {
                            rendered.src = propValue
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
                            let elementTag: string
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
                                        cosmoId: elementKey,
                                        textContent: control._props.caption._value
                                    },
                                    control._styles,
                                    control
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

export default UiBuilder

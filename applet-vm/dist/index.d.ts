import * as acorn from 'acorn';

declare class INative {
    _module: Module;
    get key(): string;
    constructor(module: Module);
}

declare abstract class BaseProp {
    _type: string;
    get type(): string;
    abstract setValue(value: any): void;
    abstract getValue(): any;
    constructor(type: string);
}

declare class BaseElement {
    _key: string;
    get key(): string;
    private _controlType;
    get controlType(): string;
    _props: {
        [key: string]: BaseProp;
    };
    get props(): {
        [key: string]: BaseProp;
    };
    _styles: {
        [key: string]: any;
    };
    get styles(): {
        [key: string]: any;
    };
    _children: Array<BaseElement>;
    get children(): BaseElement[];
    update(props?: {
        [id: string]: any;
    }, styles?: {
        [id: string]: any;
    }, children?: Array<BaseElement>): void;
    constructor(key: string, controlType: string, props: {
        [key: string]: BaseProp;
    }, styles: {
        [key: string]: any;
    }, children?: Array<BaseElement>);
}

declare class DOM {
    private _module;
    get module(): Module;
    private _creature;
    get creature(): Creature;
    private _root?;
    get root(): BaseElement;
    setRoot(root: BaseElement): void;
    constructor(module: Module, creature?: Creature, root?: BaseElement);
}

declare class MemoryLayer {
    private _units;
    get units(): {
        [id: string]: any;
    };
    findUnit(key: string): any;
    putUnit(key: string, unit: any): void;
    removeUnit(key: string): void;
    constructor(initialUnits?: {
        [id: string]: any;
    });
}

declare class Runtime {
    private _module;
    get module(): Module;
    private _creature;
    get creature(): Creature;
    private _native;
    get native(): INative;
    stack: Array<MemoryLayer>;
    pushOnStack(initialUnits?: {
        [id: string]: any;
    }): void;
    popFromStack(): void;
    get stackTop(): MemoryLayer;
    resetStack(): void;
    reset(): void;
    execute(ast: any): void;
    load(): void;
    clone(): Runtime;
    constructor(module: Module, creature?: Creature, reusableTools?: any);
}

declare class Creature {
    _key: string;
    get key(): string;
    private _cosmoId;
    get cosmoId(): string;
    setCosmoId(cosmoId: string): void;
    private _module;
    get module(): Module;
    _runtime: Runtime;
    get runtime(): Runtime;
    _dom: DOM;
    get dom(): DOM;
    thisObj: {
        [id: string]: any;
    };
    getBaseMethod(methodId: string): any;
    update(props?: {
        [id: string]: any;
    }, styles?: {
        [id: string]: any;
    }, children?: Array<BaseElement>): void;
    fillChildren(children: Array<BaseElement>): void;
    constructor(module: Module, defaultValues?: any);
}

declare class Runnable {
    root: BaseElement;
    mount: () => void;
    constructor(root: BaseElement, mount: () => void);
}
declare class Applet {
    _key: string;
    get key(): string;
    _genesisCreature: Creature;
    _nativeBuilder: (mod: Module) => INative;
    private _modules;
    findModule(id: string): Module;
    putModule(module: Module): void;
    removeModule(key: string): void;
    middleCode: any;
    filledClasses: Array<any>;
    fill(jsxCode: any): void;
    cache: {
        elements: {};
        mounts: any[];
    };
    oldVersions: {};
    onCreatureStateChange(creature: Creature, newVersion: BaseElement): void;
    update: (key: string, u: any) => void;
    firstMount: boolean;
    klasses: {
        [id: string]: any;
    };
    runRaw(update: (key: string, u: any) => void): Promise<unknown>;
    buildContext(mod: Module): {
        _module: Module;
    };
    setContextBuilder(ctxBuilder: (mod: Module) => INative): void;
    run(genesis: string, update: (key: string, u: any) => void): Promise<unknown>;
    constructor(key: string, modules?: {
        [id: string]: Module;
    });
}

declare class CreatureStore {
    private _store;
    putCreature(creature: Creature): void;
    removeCreature(key: string): void;
    findCreature(key: string): Creature;
    constructor();
}

declare class Func {
    private _key;
    get key(): string;
    private _code;
    get code(): string;
    setCode(code: string): void;
    private _ast?;
    get ast(): any;
    setAst(ast: any): void;
    constructor(code: string, ast?: any);
}

declare class FuncStore {
    private _store;
    get store(): {
        [id: string]: Func;
    };
    putFunc(func: Func): void;
    removeFunc(key: string): void;
    findFunc(key: string): Func;
    constructor();
}

declare class Module {
    private _applet;
    get applet(): Applet;
    setApplet(applet: Applet): void;
    private _creatures;
    get creatures(): CreatureStore;
    private _key;
    get key(): string;
    private _funcs;
    get funcs(): FuncStore;
    private _dom;
    get dom(): DOM;
    private _ast?;
    get ast(): any;
    setAst(ast: any): void;
    instantiate(props?: {
        [id: string]: any;
    }, styles?: {
        [id: string]: any;
    }, children?: Array<BaseElement>, thisObj?: any): Creature;
    constructor(key: string, applet: Applet, ast?: any);
}

declare class ExecutionMeta {
    creature: Creature;
    declaration?: boolean;
    declarationType?: string;
    returnIdParent?: boolean;
    isAnotherCreature?: boolean;
    isParentScript?: boolean;
    parentJsxKey: string;
    nonCreatureClassThisObj: boolean;
    constructor(metaDict: any);
}

declare const _default$1: {
    generator: {
        generateKey: () => string;
        prepareElement: (typeName: string, defaultProps: {
            [id: string]: BaseProp;
        }, overridenProps: {
            [id: string]: any;
        }, defaultStyles: {
            [id: string]: any;
        }, overridenStyles: {
            [id: string]: any;
        }, children: BaseElement[]) => BaseElement;
        nestedContext: (creature: Creature, otherMetas?: ExecutionMeta) => ExecutionMeta;
    };
    compiler: {
        parse: (jsxCode: string) => acorn.Node;
        extractModules: (middleCode: any, applet: Applet) => any;
        styleToCssString: (rules: any) => string;
        buildRule: (key: any, value: any) => string;
        buildValue: (key: any, value: any) => string;
    };
    json: {
        prettify: (obj: any) => string;
        diff: (el1: BaseElement, el2: BaseElement) => any[];
    };
    executor: {
        executeSingle: (code: any, meta: ExecutionMeta) => any;
        executeBlock: (codes: any[], meta: ExecutionMeta) => any;
        ExecutionMeta: typeof ExecutionMeta;
    };
};

declare class BaseControl {
}

declare class BoxControl extends BaseControl {
    static readonly TYPE = "box";
    static defaultProps: {};
    static defaultStyles: {
        width: number;
        height: number;
    };
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}

declare class StringProp extends BaseProp {
    _value?: string;
    get value(): string;
    setValue(v: any): void;
    getValue(): string;
    _defaultValue: string;
    get defaultValue(): string;
    constructor(defaultValue: string);
}

declare class FuncProp extends BaseProp {
    _value?: () => void;
    get value(): () => void;
    setValue(v: any): void;
    getValue(): () => void;
    _defaultValue?: () => void;
    get defaultValue(): () => void;
    constructor(defaultValue?: () => void);
}

declare class ButtonControl extends BaseControl {
    static readonly TYPE = "button";
    static defaultProps: {
        caption: StringProp;
        variant: StringProp;
        onClick: FuncProp;
    };
    static defaultStyles: {
        width: number;
        height: string;
    };
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}

declare class CardControl extends BaseControl {
    static readonly TYPE = "card";
    static defaultProps: {};
    static defaultStyles: {
        width: number;
        height: number;
        boxShadow: string;
        backgroundColor: string;
        borderRadius: number;
    };
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}

declare class TabsControl extends BaseControl {
    static readonly TYPE = "tabs";
    static defaultProps: {
        onChange: FuncProp;
    };
    static defaultStyles: {};
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}

declare class PrimaryTabControl extends BaseControl {
    static readonly TYPE = "primary-tab";
    static defaultProps: {};
    static defaultStyles: {};
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}

declare class TextControl extends BaseControl {
    static readonly TYPE = "text";
    static defaultProps: {
        text: StringProp;
    };
    static defaultStyles: {
        width: number;
        height: string;
    };
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}

declare class HtmlControl extends BaseControl {
    static readonly TYPE = "html";
    static defaultProps: {};
    static defaultStyles: {};
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}

declare class BodyControl extends BaseControl {
    static readonly TYPE = "body";
    static defaultProps: {};
    static defaultStyles: {};
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}

declare class ScriptControl extends BaseControl {
    static readonly TYPE = "script";
    static defaultProps: {};
    static defaultStyles: {};
    static instantiate(overridenProps: {
        [id: string]: any;
    }, overridenStyles: {
        [id: string]: any;
    }, children: Array<BaseElement>): BaseElement;
}

declare const _default: {
    text: typeof TextControl;
    button: typeof ButtonControl;
    box: typeof BoxControl;
    card: typeof CardControl;
    tabs: typeof TabsControl;
    "primary-tab": typeof PrimaryTabControl;
    html: typeof HtmlControl;
    body: typeof BodyControl;
    script: typeof ScriptControl;
};

export { Applet, _default as Controls, INative, Module, Runnable, _default$1 as Utils };

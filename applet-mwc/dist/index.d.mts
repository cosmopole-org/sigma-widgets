declare class MwcDriver {
    applet: any;
    root: any;
    uiBuilder: any;
    update(key: string, updates: Array<any>): void;
    start(genesisComponent: string): void;
    constructor(applet: any, container: HTMLElement);
}

export { MwcDriver as default };

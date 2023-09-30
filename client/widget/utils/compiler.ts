
import { Parser as AcornParser } from 'acorn';
import * as jsx from 'acorn-jsx';
import Applet from '../Applet';
import Func from '../Func';
import Module from '../Module';

let jsxCompiler = AcornParser.extend(jsx());

let parse = (jsxCode: string) => {
    return jsxCompiler.parse(jsxCode, { sourceType: 'module', ecmaVersion: 'latest' });
}

let extractModules = (middleCode: any, applet: Applet) => {
    return middleCode.body
        .filter((declaration: any) => declaration.type === 'ClassDeclaration')
        .map((declaration: any) => {
            return new Module(declaration.id.name, applet, declaration)
        })
}

export default { parse, extractModules }

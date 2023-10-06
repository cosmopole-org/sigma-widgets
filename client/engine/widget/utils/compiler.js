
import Applet from '../Applet';
import Module from '../Module';

// let jsxCompiler = AcornParser.extend(jsx());

// let parse = (jsxCode) => {
//     return jsxCompiler.parse(jsxCode, { sourceType: 'module', ecmaVersion: 'latest' });
// }

let extractModules = (middleCode, applet) => {
    return middleCode.body
        .filter((declaration) => declaration.type === 'ClassDeclaration')
        .map((declaration) => {
            return new Module(declaration.id.name, applet, declaration)
        })
}

export default { extractModules }

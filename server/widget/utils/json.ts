
import { diff } from 'deep-object-diff';

let prettify = (obj: any) => {
    return JSON.stringify(obj, undefined, 4)
}

export default { prettify, diff }

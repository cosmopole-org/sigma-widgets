
import React from 'react';
import './App.css';
import reactElementToJSXString from 'react-element-to-jsx-string';
import { Parser } from 'acorn';
import jsx from 'acorn-jsx';

let jsxCompiler = Parser.extend(jsx());

let funcsStore = {}, tempEffects = {};
let states = {}

const filterEvent = (eventKey, event, filtered) => {
  let funcId = 'func:' + Math.random()
  funcsStore[funcId] = event
  filtered[eventKey] = funcId
}

const extractEvents = (props) => {
  let filtered = props
  props.onClick && (filterEvent('onClick', props.onClick, filtered))
  return filtered
}

const scan = (node) => {
  let ps = { ...node.props }
  if (ps) {
    delete ps['style']
    delete ps['children']
  }
  let filtered = extractEvents(ps)
  return {
    controlKey: node.type.name,
    props: filtered,
    style: node.props?.style,
    children: node.props?.children ?
      node.props?.children?.map ?
        node.props?.children?.map(c => scan(c)) :
        [node.props?.children].map(c => scan(c)) :
      []
  }
}

const jsxStrToNode = (str) => {
  return jsxCompiler.parse(str, { sourceType: 'module' });
}

const execute = (node) => {
  if (!node?.type) return node;
  switch (node.type) {
    case 'Program': {

    }
  }
  return node;
}

const compile = (jsxStr) => {
  let node = jsxStrToNode(jsxStr);
  return node;
}

function App() {

  return null;
}

export default App;

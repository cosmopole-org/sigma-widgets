/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/acorn-jsx/index.js":
/*!*****************************************!*\
  !*** ./node_modules/acorn-jsx/index.js ***!
  \*****************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


const XHTMLEntities = __webpack_require__(/*! ./xhtml */ "./node_modules/acorn-jsx/xhtml.js");

const hexNumber = /^[\da-fA-F]+$/;
const decimalNumber = /^\d+$/;

// The map to `acorn-jsx` tokens from `acorn` namespace objects.
const acornJsxMap = new WeakMap();

// Get the original tokens for the given `acorn` namespace object.
function getJsxTokens(acorn) {
  acorn = acorn.Parser.acorn || acorn;
  let acornJsx = acornJsxMap.get(acorn);
  if (!acornJsx) {
    const tt = acorn.tokTypes;
    const TokContext = acorn.TokContext;
    const TokenType = acorn.TokenType;
    const tc_oTag = new TokContext('<tag', false);
    const tc_cTag = new TokContext('</tag', false);
    const tc_expr = new TokContext('<tag>...</tag>', true, true);
    const tokContexts = {
      tc_oTag: tc_oTag,
      tc_cTag: tc_cTag,
      tc_expr: tc_expr
    };
    const tokTypes = {
      jsxName: new TokenType('jsxName'),
      jsxText: new TokenType('jsxText', {beforeExpr: true}),
      jsxTagStart: new TokenType('jsxTagStart', {startsExpr: true}),
      jsxTagEnd: new TokenType('jsxTagEnd')
    };

    tokTypes.jsxTagStart.updateContext = function() {
      this.context.push(tc_expr); // treat as beginning of JSX expression
      this.context.push(tc_oTag); // start opening tag context
      this.exprAllowed = false;
    };
    tokTypes.jsxTagEnd.updateContext = function(prevType) {
      let out = this.context.pop();
      if (out === tc_oTag && prevType === tt.slash || out === tc_cTag) {
        this.context.pop();
        this.exprAllowed = this.curContext() === tc_expr;
      } else {
        this.exprAllowed = true;
      }
    };

    acornJsx = { tokContexts: tokContexts, tokTypes: tokTypes };
    acornJsxMap.set(acorn, acornJsx);
  }

  return acornJsx;
}

// Transforms JSX element name to string.

function getQualifiedJSXName(object) {
  if (!object)
    return object;

  if (object.type === 'JSXIdentifier')
    return object.name;

  if (object.type === 'JSXNamespacedName')
    return object.namespace.name + ':' + object.name.name;

  if (object.type === 'JSXMemberExpression')
    return getQualifiedJSXName(object.object) + '.' +
    getQualifiedJSXName(object.property);
}

module.exports = function(options) {
  options = options || {};
  return function(Parser) {
    return plugin({
      allowNamespaces: options.allowNamespaces !== false,
      allowNamespacedObjects: !!options.allowNamespacedObjects
    }, Parser);
  };
};

// This is `tokTypes` of the peer dep.
// This can be different instances from the actual `tokTypes` this plugin uses.
Object.defineProperty(module.exports, "tokTypes", ({
  get: function get_tokTypes() {
    return getJsxTokens(__webpack_require__(/*! acorn */ "./node_modules/acorn/dist/acorn.js")).tokTypes;
  },
  configurable: true,
  enumerable: true
}));

function plugin(options, Parser) {
  const acorn = Parser.acorn || __webpack_require__(/*! acorn */ "./node_modules/acorn/dist/acorn.js");
  const acornJsx = getJsxTokens(acorn);
  const tt = acorn.tokTypes;
  const tok = acornJsx.tokTypes;
  const tokContexts = acorn.tokContexts;
  const tc_oTag = acornJsx.tokContexts.tc_oTag;
  const tc_cTag = acornJsx.tokContexts.tc_cTag;
  const tc_expr = acornJsx.tokContexts.tc_expr;
  const isNewLine = acorn.isNewLine;
  const isIdentifierStart = acorn.isIdentifierStart;
  const isIdentifierChar = acorn.isIdentifierChar;

  return class extends Parser {
    // Expose actual `tokTypes` and `tokContexts` to other plugins.
    static get acornJsx() {
      return acornJsx;
    }

    // Reads inline JSX contents token.
    jsx_readToken() {
      let out = '', chunkStart = this.pos;
      for (;;) {
        if (this.pos >= this.input.length)
          this.raise(this.start, 'Unterminated JSX contents');
        let ch = this.input.charCodeAt(this.pos);

        switch (ch) {
        case 60: // '<'
        case 123: // '{'
          if (this.pos === this.start) {
            if (ch === 60 && this.exprAllowed) {
              ++this.pos;
              return this.finishToken(tok.jsxTagStart);
            }
            return this.getTokenFromCode(ch);
          }
          out += this.input.slice(chunkStart, this.pos);
          return this.finishToken(tok.jsxText, out);

        case 38: // '&'
          out += this.input.slice(chunkStart, this.pos);
          out += this.jsx_readEntity();
          chunkStart = this.pos;
          break;

        case 62: // '>'
        case 125: // '}'
          this.raise(
            this.pos,
            "Unexpected token `" + this.input[this.pos] + "`. Did you mean `" +
              (ch === 62 ? "&gt;" : "&rbrace;") + "` or " + "`{\"" + this.input[this.pos] + "\"}" + "`?"
          );

        default:
          if (isNewLine(ch)) {
            out += this.input.slice(chunkStart, this.pos);
            out += this.jsx_readNewLine(true);
            chunkStart = this.pos;
          } else {
            ++this.pos;
          }
        }
      }
    }

    jsx_readNewLine(normalizeCRLF) {
      let ch = this.input.charCodeAt(this.pos);
      let out;
      ++this.pos;
      if (ch === 13 && this.input.charCodeAt(this.pos) === 10) {
        ++this.pos;
        out = normalizeCRLF ? '\n' : '\r\n';
      } else {
        out = String.fromCharCode(ch);
      }
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }

      return out;
    }

    jsx_readString(quote) {
      let out = '', chunkStart = ++this.pos;
      for (;;) {
        if (this.pos >= this.input.length)
          this.raise(this.start, 'Unterminated string constant');
        let ch = this.input.charCodeAt(this.pos);
        if (ch === quote) break;
        if (ch === 38) { // '&'
          out += this.input.slice(chunkStart, this.pos);
          out += this.jsx_readEntity();
          chunkStart = this.pos;
        } else if (isNewLine(ch)) {
          out += this.input.slice(chunkStart, this.pos);
          out += this.jsx_readNewLine(false);
          chunkStart = this.pos;
        } else {
          ++this.pos;
        }
      }
      out += this.input.slice(chunkStart, this.pos++);
      return this.finishToken(tt.string, out);
    }

    jsx_readEntity() {
      let str = '', count = 0, entity;
      let ch = this.input[this.pos];
      if (ch !== '&')
        this.raise(this.pos, 'Entity must start with an ampersand');
      let startPos = ++this.pos;
      while (this.pos < this.input.length && count++ < 10) {
        ch = this.input[this.pos++];
        if (ch === ';') {
          if (str[0] === '#') {
            if (str[1] === 'x') {
              str = str.substr(2);
              if (hexNumber.test(str))
                entity = String.fromCharCode(parseInt(str, 16));
            } else {
              str = str.substr(1);
              if (decimalNumber.test(str))
                entity = String.fromCharCode(parseInt(str, 10));
            }
          } else {
            entity = XHTMLEntities[str];
          }
          break;
        }
        str += ch;
      }
      if (!entity) {
        this.pos = startPos;
        return '&';
      }
      return entity;
    }

    // Read a JSX identifier (valid tag or attribute name).
    //
    // Optimized version since JSX identifiers can't contain
    // escape characters and so can be read as single slice.
    // Also assumes that first character was already checked
    // by isIdentifierStart in readToken.

    jsx_readWord() {
      let ch, start = this.pos;
      do {
        ch = this.input.charCodeAt(++this.pos);
      } while (isIdentifierChar(ch) || ch === 45); // '-'
      return this.finishToken(tok.jsxName, this.input.slice(start, this.pos));
    }

    // Parse next token as JSX identifier

    jsx_parseIdentifier() {
      let node = this.startNode();
      if (this.type === tok.jsxName)
        node.name = this.value;
      else if (this.type.keyword)
        node.name = this.type.keyword;
      else
        this.unexpected();
      this.next();
      return this.finishNode(node, 'JSXIdentifier');
    }

    // Parse namespaced identifier.

    jsx_parseNamespacedName() {
      let startPos = this.start, startLoc = this.startLoc;
      let name = this.jsx_parseIdentifier();
      if (!options.allowNamespaces || !this.eat(tt.colon)) return name;
      var node = this.startNodeAt(startPos, startLoc);
      node.namespace = name;
      node.name = this.jsx_parseIdentifier();
      return this.finishNode(node, 'JSXNamespacedName');
    }

    // Parses element name in any form - namespaced, member
    // or single identifier.

    jsx_parseElementName() {
      if (this.type === tok.jsxTagEnd) return '';
      let startPos = this.start, startLoc = this.startLoc;
      let node = this.jsx_parseNamespacedName();
      if (this.type === tt.dot && node.type === 'JSXNamespacedName' && !options.allowNamespacedObjects) {
        this.unexpected();
      }
      while (this.eat(tt.dot)) {
        let newNode = this.startNodeAt(startPos, startLoc);
        newNode.object = node;
        newNode.property = this.jsx_parseIdentifier();
        node = this.finishNode(newNode, 'JSXMemberExpression');
      }
      return node;
    }

    // Parses any type of JSX attribute value.

    jsx_parseAttributeValue() {
      switch (this.type) {
      case tt.braceL:
        let node = this.jsx_parseExpressionContainer();
        if (node.expression.type === 'JSXEmptyExpression')
          this.raise(node.start, 'JSX attributes must only be assigned a non-empty expression');
        return node;

      case tok.jsxTagStart:
      case tt.string:
        return this.parseExprAtom();

      default:
        this.raise(this.start, 'JSX value should be either an expression or a quoted JSX text');
      }
    }

    // JSXEmptyExpression is unique type since it doesn't actually parse anything,
    // and so it should start at the end of last read token (left brace) and finish
    // at the beginning of the next one (right brace).

    jsx_parseEmptyExpression() {
      let node = this.startNodeAt(this.lastTokEnd, this.lastTokEndLoc);
      return this.finishNodeAt(node, 'JSXEmptyExpression', this.start, this.startLoc);
    }

    // Parses JSX expression enclosed into curly brackets.

    jsx_parseExpressionContainer() {
      let node = this.startNode();
      this.next();
      node.expression = this.type === tt.braceR
        ? this.jsx_parseEmptyExpression()
        : this.parseExpression();
      this.expect(tt.braceR);
      return this.finishNode(node, 'JSXExpressionContainer');
    }

    // Parses following JSX attribute name-value pair.

    jsx_parseAttribute() {
      let node = this.startNode();
      if (this.eat(tt.braceL)) {
        this.expect(tt.ellipsis);
        node.argument = this.parseMaybeAssign();
        this.expect(tt.braceR);
        return this.finishNode(node, 'JSXSpreadAttribute');
      }
      node.name = this.jsx_parseNamespacedName();
      node.value = this.eat(tt.eq) ? this.jsx_parseAttributeValue() : null;
      return this.finishNode(node, 'JSXAttribute');
    }

    // Parses JSX opening tag starting after '<'.

    jsx_parseOpeningElementAt(startPos, startLoc) {
      let node = this.startNodeAt(startPos, startLoc);
      node.attributes = [];
      let nodeName = this.jsx_parseElementName();
      if (nodeName) node.name = nodeName;
      while (this.type !== tt.slash && this.type !== tok.jsxTagEnd)
        node.attributes.push(this.jsx_parseAttribute());
      node.selfClosing = this.eat(tt.slash);
      this.expect(tok.jsxTagEnd);
      return this.finishNode(node, nodeName ? 'JSXOpeningElement' : 'JSXOpeningFragment');
    }

    // Parses JSX closing tag starting after '</'.

    jsx_parseClosingElementAt(startPos, startLoc) {
      let node = this.startNodeAt(startPos, startLoc);
      let nodeName = this.jsx_parseElementName();
      if (nodeName) node.name = nodeName;
      this.expect(tok.jsxTagEnd);
      return this.finishNode(node, nodeName ? 'JSXClosingElement' : 'JSXClosingFragment');
    }

    // Parses entire JSX element, including it's opening tag
    // (starting after '<'), attributes, contents and closing tag.

    jsx_parseElementAt(startPos, startLoc) {
      let node = this.startNodeAt(startPos, startLoc);
      let children = [];
      let openingElement = this.jsx_parseOpeningElementAt(startPos, startLoc);
      let closingElement = null;

      if (!openingElement.selfClosing) {
        contents: for (;;) {
          switch (this.type) {
          case tok.jsxTagStart:
            startPos = this.start; startLoc = this.startLoc;
            this.next();
            if (this.eat(tt.slash)) {
              closingElement = this.jsx_parseClosingElementAt(startPos, startLoc);
              break contents;
            }
            children.push(this.jsx_parseElementAt(startPos, startLoc));
            break;

          case tok.jsxText:
            children.push(this.parseExprAtom());
            break;

          case tt.braceL:
            children.push(this.jsx_parseExpressionContainer());
            break;

          default:
            this.unexpected();
          }
        }
        if (getQualifiedJSXName(closingElement.name) !== getQualifiedJSXName(openingElement.name)) {
          this.raise(
            closingElement.start,
            'Expected corresponding JSX closing tag for <' + getQualifiedJSXName(openingElement.name) + '>');
        }
      }
      let fragmentOrElement = openingElement.name ? 'Element' : 'Fragment';

      node['opening' + fragmentOrElement] = openingElement;
      node['closing' + fragmentOrElement] = closingElement;
      node.children = children;
      if (this.type === tt.relational && this.value === "<") {
        this.raise(this.start, "Adjacent JSX elements must be wrapped in an enclosing tag");
      }
      return this.finishNode(node, 'JSX' + fragmentOrElement);
    }

    // Parse JSX text

    jsx_parseText() {
      let node = this.parseLiteral(this.value);
      node.type = "JSXText";
      return node;
    }

    // Parses entire JSX element from current position.

    jsx_parseElement() {
      let startPos = this.start, startLoc = this.startLoc;
      this.next();
      return this.jsx_parseElementAt(startPos, startLoc);
    }

    parseExprAtom(refShortHandDefaultPos) {
      if (this.type === tok.jsxText)
        return this.jsx_parseText();
      else if (this.type === tok.jsxTagStart)
        return this.jsx_parseElement();
      else
        return super.parseExprAtom(refShortHandDefaultPos);
    }

    readToken(code) {
      let context = this.curContext();

      if (context === tc_expr) return this.jsx_readToken();

      if (context === tc_oTag || context === tc_cTag) {
        if (isIdentifierStart(code)) return this.jsx_readWord();

        if (code == 62) {
          ++this.pos;
          return this.finishToken(tok.jsxTagEnd);
        }

        if ((code === 34 || code === 39) && context == tc_oTag)
          return this.jsx_readString(code);
      }

      if (code === 60 && this.exprAllowed && this.input.charCodeAt(this.pos + 1) !== 33) {
        ++this.pos;
        return this.finishToken(tok.jsxTagStart);
      }
      return super.readToken(code);
    }

    updateContext(prevType) {
      if (this.type == tt.braceL) {
        var curContext = this.curContext();
        if (curContext == tc_oTag) this.context.push(tokContexts.b_expr);
        else if (curContext == tc_expr) this.context.push(tokContexts.b_tmpl);
        else super.updateContext(prevType);
        this.exprAllowed = true;
      } else if (this.type === tt.slash && prevType === tok.jsxTagStart) {
        this.context.length -= 2; // do not consider JSX expr -> JSX open tag -> ... anymore
        this.context.push(tc_cTag); // reconsider as closing tag context
        this.exprAllowed = false;
      } else {
        return super.updateContext(prevType);
      }
    }
  };
}


/***/ }),

/***/ "./node_modules/acorn-jsx/xhtml.js":
/*!*****************************************!*\
  !*** ./node_modules/acorn-jsx/xhtml.js ***!
  \*****************************************/
/***/ (function(module) {

module.exports = {
  quot: '\u0022',
  amp: '&',
  apos: '\u0027',
  lt: '<',
  gt: '>',
  nbsp: '\u00A0',
  iexcl: '\u00A1',
  cent: '\u00A2',
  pound: '\u00A3',
  curren: '\u00A4',
  yen: '\u00A5',
  brvbar: '\u00A6',
  sect: '\u00A7',
  uml: '\u00A8',
  copy: '\u00A9',
  ordf: '\u00AA',
  laquo: '\u00AB',
  not: '\u00AC',
  shy: '\u00AD',
  reg: '\u00AE',
  macr: '\u00AF',
  deg: '\u00B0',
  plusmn: '\u00B1',
  sup2: '\u00B2',
  sup3: '\u00B3',
  acute: '\u00B4',
  micro: '\u00B5',
  para: '\u00B6',
  middot: '\u00B7',
  cedil: '\u00B8',
  sup1: '\u00B9',
  ordm: '\u00BA',
  raquo: '\u00BB',
  frac14: '\u00BC',
  frac12: '\u00BD',
  frac34: '\u00BE',
  iquest: '\u00BF',
  Agrave: '\u00C0',
  Aacute: '\u00C1',
  Acirc: '\u00C2',
  Atilde: '\u00C3',
  Auml: '\u00C4',
  Aring: '\u00C5',
  AElig: '\u00C6',
  Ccedil: '\u00C7',
  Egrave: '\u00C8',
  Eacute: '\u00C9',
  Ecirc: '\u00CA',
  Euml: '\u00CB',
  Igrave: '\u00CC',
  Iacute: '\u00CD',
  Icirc: '\u00CE',
  Iuml: '\u00CF',
  ETH: '\u00D0',
  Ntilde: '\u00D1',
  Ograve: '\u00D2',
  Oacute: '\u00D3',
  Ocirc: '\u00D4',
  Otilde: '\u00D5',
  Ouml: '\u00D6',
  times: '\u00D7',
  Oslash: '\u00D8',
  Ugrave: '\u00D9',
  Uacute: '\u00DA',
  Ucirc: '\u00DB',
  Uuml: '\u00DC',
  Yacute: '\u00DD',
  THORN: '\u00DE',
  szlig: '\u00DF',
  agrave: '\u00E0',
  aacute: '\u00E1',
  acirc: '\u00E2',
  atilde: '\u00E3',
  auml: '\u00E4',
  aring: '\u00E5',
  aelig: '\u00E6',
  ccedil: '\u00E7',
  egrave: '\u00E8',
  eacute: '\u00E9',
  ecirc: '\u00EA',
  euml: '\u00EB',
  igrave: '\u00EC',
  iacute: '\u00ED',
  icirc: '\u00EE',
  iuml: '\u00EF',
  eth: '\u00F0',
  ntilde: '\u00F1',
  ograve: '\u00F2',
  oacute: '\u00F3',
  ocirc: '\u00F4',
  otilde: '\u00F5',
  ouml: '\u00F6',
  divide: '\u00F7',
  oslash: '\u00F8',
  ugrave: '\u00F9',
  uacute: '\u00FA',
  ucirc: '\u00FB',
  uuml: '\u00FC',
  yacute: '\u00FD',
  thorn: '\u00FE',
  yuml: '\u00FF',
  OElig: '\u0152',
  oelig: '\u0153',
  Scaron: '\u0160',
  scaron: '\u0161',
  Yuml: '\u0178',
  fnof: '\u0192',
  circ: '\u02C6',
  tilde: '\u02DC',
  Alpha: '\u0391',
  Beta: '\u0392',
  Gamma: '\u0393',
  Delta: '\u0394',
  Epsilon: '\u0395',
  Zeta: '\u0396',
  Eta: '\u0397',
  Theta: '\u0398',
  Iota: '\u0399',
  Kappa: '\u039A',
  Lambda: '\u039B',
  Mu: '\u039C',
  Nu: '\u039D',
  Xi: '\u039E',
  Omicron: '\u039F',
  Pi: '\u03A0',
  Rho: '\u03A1',
  Sigma: '\u03A3',
  Tau: '\u03A4',
  Upsilon: '\u03A5',
  Phi: '\u03A6',
  Chi: '\u03A7',
  Psi: '\u03A8',
  Omega: '\u03A9',
  alpha: '\u03B1',
  beta: '\u03B2',
  gamma: '\u03B3',
  delta: '\u03B4',
  epsilon: '\u03B5',
  zeta: '\u03B6',
  eta: '\u03B7',
  theta: '\u03B8',
  iota: '\u03B9',
  kappa: '\u03BA',
  lambda: '\u03BB',
  mu: '\u03BC',
  nu: '\u03BD',
  xi: '\u03BE',
  omicron: '\u03BF',
  pi: '\u03C0',
  rho: '\u03C1',
  sigmaf: '\u03C2',
  sigma: '\u03C3',
  tau: '\u03C4',
  upsilon: '\u03C5',
  phi: '\u03C6',
  chi: '\u03C7',
  psi: '\u03C8',
  omega: '\u03C9',
  thetasym: '\u03D1',
  upsih: '\u03D2',
  piv: '\u03D6',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
  zwnj: '\u200C',
  zwj: '\u200D',
  lrm: '\u200E',
  rlm: '\u200F',
  ndash: '\u2013',
  mdash: '\u2014',
  lsquo: '\u2018',
  rsquo: '\u2019',
  sbquo: '\u201A',
  ldquo: '\u201C',
  rdquo: '\u201D',
  bdquo: '\u201E',
  dagger: '\u2020',
  Dagger: '\u2021',
  bull: '\u2022',
  hellip: '\u2026',
  permil: '\u2030',
  prime: '\u2032',
  Prime: '\u2033',
  lsaquo: '\u2039',
  rsaquo: '\u203A',
  oline: '\u203E',
  frasl: '\u2044',
  euro: '\u20AC',
  image: '\u2111',
  weierp: '\u2118',
  real: '\u211C',
  trade: '\u2122',
  alefsym: '\u2135',
  larr: '\u2190',
  uarr: '\u2191',
  rarr: '\u2192',
  darr: '\u2193',
  harr: '\u2194',
  crarr: '\u21B5',
  lArr: '\u21D0',
  uArr: '\u21D1',
  rArr: '\u21D2',
  dArr: '\u21D3',
  hArr: '\u21D4',
  forall: '\u2200',
  part: '\u2202',
  exist: '\u2203',
  empty: '\u2205',
  nabla: '\u2207',
  isin: '\u2208',
  notin: '\u2209',
  ni: '\u220B',
  prod: '\u220F',
  sum: '\u2211',
  minus: '\u2212',
  lowast: '\u2217',
  radic: '\u221A',
  prop: '\u221D',
  infin: '\u221E',
  ang: '\u2220',
  and: '\u2227',
  or: '\u2228',
  cap: '\u2229',
  cup: '\u222A',
  'int': '\u222B',
  there4: '\u2234',
  sim: '\u223C',
  cong: '\u2245',
  asymp: '\u2248',
  ne: '\u2260',
  equiv: '\u2261',
  le: '\u2264',
  ge: '\u2265',
  sub: '\u2282',
  sup: '\u2283',
  nsub: '\u2284',
  sube: '\u2286',
  supe: '\u2287',
  oplus: '\u2295',
  otimes: '\u2297',
  perp: '\u22A5',
  sdot: '\u22C5',
  lceil: '\u2308',
  rceil: '\u2309',
  lfloor: '\u230A',
  rfloor: '\u230B',
  lang: '\u2329',
  rang: '\u232A',
  loz: '\u25CA',
  spades: '\u2660',
  clubs: '\u2663',
  hearts: '\u2665',
  diams: '\u2666'
};


/***/ }),

/***/ "./node_modules/acorn/dist/acorn.js":
/*!******************************************!*\
  !*** ./node_modules/acorn/dist/acorn.js ***!
  \******************************************/
/***/ (function(__unused_webpack_module, exports) {

(function (global, factory) {
   true ? factory(exports) :
  0;
})(this, (function (exports) { 'use strict';

  // This file was generated. Do not modify manually!
  var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 370, 1, 81, 2, 71, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 193, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 84, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 406, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14, 9, 5351, 0, 7, 14, 13835, 9, 87, 9, 39, 4, 60, 6, 26, 9, 1014, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4706, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357, 0, 62, 13, 499, 13, 983, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];

  // This file was generated. Do not modify manually!
  var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 68, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 349, 41, 7, 1, 79, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 159, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 264, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 16, 0, 2, 12, 2, 33, 125, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1071, 18, 5, 4026, 582, 8634, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 689, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 43, 8, 8936, 3, 2, 6, 2, 1, 2, 290, 16, 0, 30, 2, 3, 0, 15, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 7, 5, 262, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27, 757, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4153, 7, 221, 3, 5761, 15, 7472, 3104, 541, 1507, 4938, 6, 4191];

  // This file was generated. Do not modify manually!
  var nonASCIIidentifierChars = "\u200c\u200d\xb7\u0300-\u036f\u0387\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u07fd\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u0898-\u089f\u08ca-\u08e1\u08e3-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u09fe\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0afa-\u0aff\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b55-\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c00-\u0c04\u0c3c\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c81-\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0cf3\u0d00-\u0d03\u0d3b\u0d3c\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d81-\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0de6-\u0def\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ece\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1369-\u1371\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u180f-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19d0-\u19da\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1ab0-\u1abd\u1abf-\u1ace\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf4\u1cf7-\u1cf9\u1dc0-\u1dff\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69e\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua82c\ua880\ua881\ua8b4-\ua8c5\ua8d0-\ua8d9\ua8e0-\ua8f1\ua8ff-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\ua9e5\ua9f0-\ua9f9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b-\uaa7d\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe2f\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f";

  // This file was generated. Do not modify manually!
  var nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0560-\u0588\u05d0-\u05ea\u05ef-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u0860-\u086a\u0870-\u0887\u0889-\u088e\u08a0-\u08c9\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u09fc\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0af9\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c5d\u0c60\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cdd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d04-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e86-\u0e8a\u0e8c-\u0ea3\u0ea5\u0ea7-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u1711\u171f-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1878\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4c\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1c90-\u1cba\u1cbd-\u1cbf\u1ce9-\u1cec\u1cee-\u1cf3\u1cf5\u1cf6\u1cfa\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2118-\u211d\u2124\u2126\u2128\u212a-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309b-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312f\u3131-\u318e\u31a0-\u31bf\u31f0-\u31ff\u3400-\u4dbf\u4e00-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua7ca\ua7d0\ua7d1\ua7d3\ua7d5-\ua7d9\ua7f2-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua8fe\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab69\uab70-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc";

  // These are a run-length and offset encoded representation of the
  // >0xffff code points that are a valid part of identifiers. The
  // offset starts at 0x10000, and each pair of numbers represents an
  // offset to the next range, and then a size of the range.

  // Reserved word lists for various dialects of the language

  var reservedWords = {
    3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
    5: "class enum extends super const export import",
    6: "enum",
    strict: "implements interface let package private protected public static yield",
    strictBind: "eval arguments"
  };

  // And the keywords

  var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";

  var keywords$1 = {
    5: ecma5AndLessKeywords,
    "5module": ecma5AndLessKeywords + " export import",
    6: ecma5AndLessKeywords + " const class extends export import super"
  };

  var keywordRelationalOperator = /^in(stanceof)?$/;

  // ## Character categories

  var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
  var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

  // This has a complexity linear to the value of the code. The
  // assumption is that looking up astral identifier characters is
  // rare.
  function isInAstralSet(code, set) {
    var pos = 0x10000;
    for (var i = 0; i < set.length; i += 2) {
      pos += set[i];
      if (pos > code) { return false }
      pos += set[i + 1];
      if (pos >= code) { return true }
    }
    return false
  }

  // Test whether a given character code starts an identifier.

  function isIdentifierStart(code, astral) {
    if (code < 65) { return code === 36 }
    if (code < 91) { return true }
    if (code < 97) { return code === 95 }
    if (code < 123) { return true }
    if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code)) }
    if (astral === false) { return false }
    return isInAstralSet(code, astralIdentifierStartCodes)
  }

  // Test whether a given character is part of an identifier.

  function isIdentifierChar(code, astral) {
    if (code < 48) { return code === 36 }
    if (code < 58) { return true }
    if (code < 65) { return false }
    if (code < 91) { return true }
    if (code < 97) { return code === 95 }
    if (code < 123) { return true }
    if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code)) }
    if (astral === false) { return false }
    return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes)
  }

  // ## Token types

  // The assignment of fine-grained, information-carrying type objects
  // allows the tokenizer to store the information it has about a
  // token in a way that is very cheap for the parser to look up.

  // All token type variables start with an underscore, to make them
  // easy to recognize.

  // The `beforeExpr` property is used to disambiguate between regular
  // expressions and divisions. It is set on all token types that can
  // be followed by an expression (thus, a slash after them would be a
  // regular expression).
  //
  // The `startsExpr` property is used to check if the token ends a
  // `yield` expression. It is set on all token types that either can
  // directly start an expression (like a quotation mark) or can
  // continue an expression (like the body of a string).
  //
  // `isLoop` marks a keyword as starting a loop, which is important
  // to know when parsing a label, in order to allow or disallow
  // continue jumps to that label.

  var TokenType = function TokenType(label, conf) {
    if ( conf === void 0 ) conf = {};

    this.label = label;
    this.keyword = conf.keyword;
    this.beforeExpr = !!conf.beforeExpr;
    this.startsExpr = !!conf.startsExpr;
    this.isLoop = !!conf.isLoop;
    this.isAssign = !!conf.isAssign;
    this.prefix = !!conf.prefix;
    this.postfix = !!conf.postfix;
    this.binop = conf.binop || null;
    this.updateContext = null;
  };

  function binop(name, prec) {
    return new TokenType(name, {beforeExpr: true, binop: prec})
  }
  var beforeExpr = {beforeExpr: true}, startsExpr = {startsExpr: true};

  // Map keyword names to token types.

  var keywords = {};

  // Succinct definitions of keyword token types
  function kw(name, options) {
    if ( options === void 0 ) options = {};

    options.keyword = name;
    return keywords[name] = new TokenType(name, options)
  }

  var types$1 = {
    num: new TokenType("num", startsExpr),
    regexp: new TokenType("regexp", startsExpr),
    string: new TokenType("string", startsExpr),
    name: new TokenType("name", startsExpr),
    privateId: new TokenType("privateId", startsExpr),
    eof: new TokenType("eof"),

    // Punctuation token types.
    bracketL: new TokenType("[", {beforeExpr: true, startsExpr: true}),
    bracketR: new TokenType("]"),
    braceL: new TokenType("{", {beforeExpr: true, startsExpr: true}),
    braceR: new TokenType("}"),
    parenL: new TokenType("(", {beforeExpr: true, startsExpr: true}),
    parenR: new TokenType(")"),
    comma: new TokenType(",", beforeExpr),
    semi: new TokenType(";", beforeExpr),
    colon: new TokenType(":", beforeExpr),
    dot: new TokenType("."),
    question: new TokenType("?", beforeExpr),
    questionDot: new TokenType("?."),
    arrow: new TokenType("=>", beforeExpr),
    template: new TokenType("template"),
    invalidTemplate: new TokenType("invalidTemplate"),
    ellipsis: new TokenType("...", beforeExpr),
    backQuote: new TokenType("`", startsExpr),
    dollarBraceL: new TokenType("${", {beforeExpr: true, startsExpr: true}),

    // Operators. These carry several kinds of properties to help the
    // parser use them properly (the presence of these properties is
    // what categorizes them as operators).
    //
    // `binop`, when present, specifies that this operator is a binary
    // operator, and will refer to its precedence.
    //
    // `prefix` and `postfix` mark the operator as a prefix or postfix
    // unary operator.
    //
    // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
    // binary operators with a very low precedence, that should result
    // in AssignmentExpression nodes.

    eq: new TokenType("=", {beforeExpr: true, isAssign: true}),
    assign: new TokenType("_=", {beforeExpr: true, isAssign: true}),
    incDec: new TokenType("++/--", {prefix: true, postfix: true, startsExpr: true}),
    prefix: new TokenType("!/~", {beforeExpr: true, prefix: true, startsExpr: true}),
    logicalOR: binop("||", 1),
    logicalAND: binop("&&", 2),
    bitwiseOR: binop("|", 3),
    bitwiseXOR: binop("^", 4),
    bitwiseAND: binop("&", 5),
    equality: binop("==/!=/===/!==", 6),
    relational: binop("</>/<=/>=", 7),
    bitShift: binop("<</>>/>>>", 8),
    plusMin: new TokenType("+/-", {beforeExpr: true, binop: 9, prefix: true, startsExpr: true}),
    modulo: binop("%", 10),
    star: binop("*", 10),
    slash: binop("/", 10),
    starstar: new TokenType("**", {beforeExpr: true}),
    coalesce: binop("??", 1),

    // Keyword token types.
    _break: kw("break"),
    _case: kw("case", beforeExpr),
    _catch: kw("catch"),
    _continue: kw("continue"),
    _debugger: kw("debugger"),
    _default: kw("default", beforeExpr),
    _do: kw("do", {isLoop: true, beforeExpr: true}),
    _else: kw("else", beforeExpr),
    _finally: kw("finally"),
    _for: kw("for", {isLoop: true}),
    _function: kw("function", startsExpr),
    _if: kw("if"),
    _return: kw("return", beforeExpr),
    _switch: kw("switch"),
    _throw: kw("throw", beforeExpr),
    _try: kw("try"),
    _var: kw("var"),
    _const: kw("const"),
    _while: kw("while", {isLoop: true}),
    _with: kw("with"),
    _new: kw("new", {beforeExpr: true, startsExpr: true}),
    _this: kw("this", startsExpr),
    _super: kw("super", startsExpr),
    _class: kw("class", startsExpr),
    _extends: kw("extends", beforeExpr),
    _export: kw("export"),
    _import: kw("import", startsExpr),
    _null: kw("null", startsExpr),
    _true: kw("true", startsExpr),
    _false: kw("false", startsExpr),
    _in: kw("in", {beforeExpr: true, binop: 7}),
    _instanceof: kw("instanceof", {beforeExpr: true, binop: 7}),
    _typeof: kw("typeof", {beforeExpr: true, prefix: true, startsExpr: true}),
    _void: kw("void", {beforeExpr: true, prefix: true, startsExpr: true}),
    _delete: kw("delete", {beforeExpr: true, prefix: true, startsExpr: true})
  };

  // Matches a whole line break (where CRLF is considered a single
  // line break). Used to count lines.

  var lineBreak = /\r\n?|\n|\u2028|\u2029/;
  var lineBreakG = new RegExp(lineBreak.source, "g");

  function isNewLine(code) {
    return code === 10 || code === 13 || code === 0x2028 || code === 0x2029
  }

  function nextLineBreak(code, from, end) {
    if ( end === void 0 ) end = code.length;

    for (var i = from; i < end; i++) {
      var next = code.charCodeAt(i);
      if (isNewLine(next))
        { return i < end - 1 && next === 13 && code.charCodeAt(i + 1) === 10 ? i + 2 : i + 1 }
    }
    return -1
  }

  var nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;

  var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;

  var ref = Object.prototype;
  var hasOwnProperty = ref.hasOwnProperty;
  var toString = ref.toString;

  var hasOwn = Object.hasOwn || (function (obj, propName) { return (
    hasOwnProperty.call(obj, propName)
  ); });

  var isArray = Array.isArray || (function (obj) { return (
    toString.call(obj) === "[object Array]"
  ); });

  function wordsRegexp(words) {
    return new RegExp("^(?:" + words.replace(/ /g, "|") + ")$")
  }

  function codePointToString(code) {
    // UTF-16 Decoding
    if (code <= 0xFFFF) { return String.fromCharCode(code) }
    code -= 0x10000;
    return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00)
  }

  var loneSurrogate = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/;

  // These are used when `options.locations` is on, for the
  // `startLoc` and `endLoc` properties.

  var Position = function Position(line, col) {
    this.line = line;
    this.column = col;
  };

  Position.prototype.offset = function offset (n) {
    return new Position(this.line, this.column + n)
  };

  var SourceLocation = function SourceLocation(p, start, end) {
    this.start = start;
    this.end = end;
    if (p.sourceFile !== null) { this.source = p.sourceFile; }
  };

  // The `getLineInfo` function is mostly useful when the
  // `locations` option is off (for performance reasons) and you
  // want to find the line/column position for a given character
  // offset. `input` should be the code string that the offset refers
  // into.

  function getLineInfo(input, offset) {
    for (var line = 1, cur = 0;;) {
      var nextBreak = nextLineBreak(input, cur, offset);
      if (nextBreak < 0) { return new Position(line, offset - cur) }
      ++line;
      cur = nextBreak;
    }
  }

  // A second argument must be given to configure the parser process.
  // These options are recognized (only `ecmaVersion` is required):

  var defaultOptions = {
    // `ecmaVersion` indicates the ECMAScript version to parse. Must be
    // either 3, 5, 6 (or 2015), 7 (2016), 8 (2017), 9 (2018), 10
    // (2019), 11 (2020), 12 (2021), 13 (2022), 14 (2023), or `"latest"`
    // (the latest version the library supports). This influences
    // support for strict mode, the set of reserved words, and support
    // for new syntax features.
    ecmaVersion: null,
    // `sourceType` indicates the mode the code should be parsed in.
    // Can be either `"script"` or `"module"`. This influences global
    // strict mode and parsing of `import` and `export` declarations.
    sourceType: "script",
    // `onInsertedSemicolon` can be a callback that will be called
    // when a semicolon is automatically inserted. It will be passed
    // the position of the comma as an offset, and if `locations` is
    // enabled, it is given the location as a `{line, column}` object
    // as second argument.
    onInsertedSemicolon: null,
    // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
    // trailing commas.
    onTrailingComma: null,
    // By default, reserved words are only enforced if ecmaVersion >= 5.
    // Set `allowReserved` to a boolean value to explicitly turn this on
    // an off. When this option has the value "never", reserved words
    // and keywords can also not be used as property names.
    allowReserved: null,
    // When enabled, a return at the top level is not considered an
    // error.
    allowReturnOutsideFunction: false,
    // When enabled, import/export statements are not constrained to
    // appearing at the top of the program, and an import.meta expression
    // in a script isn't considered an error.
    allowImportExportEverywhere: false,
    // By default, await identifiers are allowed to appear at the top-level scope only if ecmaVersion >= 2022.
    // When enabled, await identifiers are allowed to appear at the top-level scope,
    // but they are still not allowed in non-async functions.
    allowAwaitOutsideFunction: null,
    // When enabled, super identifiers are not constrained to
    // appearing in methods and do not raise an error when they appear elsewhere.
    allowSuperOutsideMethod: null,
    // When enabled, hashbang directive in the beginning of file is
    // allowed and treated as a line comment. Enabled by default when
    // `ecmaVersion` >= 2023.
    allowHashBang: false,
    // By default, the parser will verify that private properties are
    // only used in places where they are valid and have been declared.
    // Set this to false to turn such checks off.
    checkPrivateFields: true,
    // When `locations` is on, `loc` properties holding objects with
    // `start` and `end` properties in `{line, column}` form (with
    // line being 1-based and column 0-based) will be attached to the
    // nodes.
    locations: false,
    // A function can be passed as `onToken` option, which will
    // cause Acorn to call that function with object in the same
    // format as tokens returned from `tokenizer().getToken()`. Note
    // that you are not allowed to call the parser from the
    // callback—that will corrupt its internal state.
    onToken: null,
    // A function can be passed as `onComment` option, which will
    // cause Acorn to call that function with `(block, text, start,
    // end)` parameters whenever a comment is skipped. `block` is a
    // boolean indicating whether this is a block (`/* */`) comment,
    // `text` is the content of the comment, and `start` and `end` are
    // character offsets that denote the start and end of the comment.
    // When the `locations` option is on, two more parameters are
    // passed, the full `{line, column}` locations of the start and
    // end of the comments. Note that you are not allowed to call the
    // parser from the callback—that will corrupt its internal state.
    onComment: null,
    // Nodes have their start and end characters offsets recorded in
    // `start` and `end` properties (directly on the node, rather than
    // the `loc` object, which holds line/column data. To also add a
    // [semi-standardized][range] `range` property holding a `[start,
    // end]` array with the same numbers, set the `ranges` option to
    // `true`.
    //
    // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
    ranges: false,
    // It is possible to parse multiple files into a single AST by
    // passing the tree produced by parsing the first file as
    // `program` option in subsequent parses. This will add the
    // toplevel forms of the parsed file to the `Program` (top) node
    // of an existing parse tree.
    program: null,
    // When `locations` is on, you can pass this to record the source
    // file in every node's `loc` object.
    sourceFile: null,
    // This value, if given, is stored in every node, whether
    // `locations` is on or off.
    directSourceFile: null,
    // When enabled, parenthesized expressions are represented by
    // (non-standard) ParenthesizedExpression nodes
    preserveParens: false
  };

  // Interpret and default an options object

  var warnedAboutEcmaVersion = false;

  function getOptions(opts) {
    var options = {};

    for (var opt in defaultOptions)
      { options[opt] = opts && hasOwn(opts, opt) ? opts[opt] : defaultOptions[opt]; }

    if (options.ecmaVersion === "latest") {
      options.ecmaVersion = 1e8;
    } else if (options.ecmaVersion == null) {
      if (!warnedAboutEcmaVersion && typeof console === "object" && console.warn) {
        warnedAboutEcmaVersion = true;
        console.warn("Since Acorn 8.0.0, options.ecmaVersion is required.\nDefaulting to 2020, but this will stop working in the future.");
      }
      options.ecmaVersion = 11;
    } else if (options.ecmaVersion >= 2015) {
      options.ecmaVersion -= 2009;
    }

    if (options.allowReserved == null)
      { options.allowReserved = options.ecmaVersion < 5; }

    if (!opts || opts.allowHashBang == null)
      { options.allowHashBang = options.ecmaVersion >= 14; }

    if (isArray(options.onToken)) {
      var tokens = options.onToken;
      options.onToken = function (token) { return tokens.push(token); };
    }
    if (isArray(options.onComment))
      { options.onComment = pushComment(options, options.onComment); }

    return options
  }

  function pushComment(options, array) {
    return function(block, text, start, end, startLoc, endLoc) {
      var comment = {
        type: block ? "Block" : "Line",
        value: text,
        start: start,
        end: end
      };
      if (options.locations)
        { comment.loc = new SourceLocation(this, startLoc, endLoc); }
      if (options.ranges)
        { comment.range = [start, end]; }
      array.push(comment);
    }
  }

  // Each scope gets a bitset that may contain these flags
  var
      SCOPE_TOP = 1,
      SCOPE_FUNCTION = 2,
      SCOPE_ASYNC = 4,
      SCOPE_GENERATOR = 8,
      SCOPE_ARROW = 16,
      SCOPE_SIMPLE_CATCH = 32,
      SCOPE_SUPER = 64,
      SCOPE_DIRECT_SUPER = 128,
      SCOPE_CLASS_STATIC_BLOCK = 256,
      SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION | SCOPE_CLASS_STATIC_BLOCK;

  function functionFlags(async, generator) {
    return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0)
  }

  // Used in checkLVal* and declareName to determine the type of a binding
  var
      BIND_NONE = 0, // Not a binding
      BIND_VAR = 1, // Var-style binding
      BIND_LEXICAL = 2, // Let- or const-style binding
      BIND_FUNCTION = 3, // Function declaration
      BIND_SIMPLE_CATCH = 4, // Simple (identifier pattern) catch binding
      BIND_OUTSIDE = 5; // Special case for function names as bound inside the function

  var Parser = function Parser(options, input, startPos) {
    this.options = options = getOptions(options);
    this.sourceFile = options.sourceFile;
    this.keywords = wordsRegexp(keywords$1[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
    var reserved = "";
    if (options.allowReserved !== true) {
      reserved = reservedWords[options.ecmaVersion >= 6 ? 6 : options.ecmaVersion === 5 ? 5 : 3];
      if (options.sourceType === "module") { reserved += " await"; }
    }
    this.reservedWords = wordsRegexp(reserved);
    var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict;
    this.reservedWordsStrict = wordsRegexp(reservedStrict);
    this.reservedWordsStrictBind = wordsRegexp(reservedStrict + " " + reservedWords.strictBind);
    this.input = String(input);

    // Used to signal to callers of `readWord1` whether the word
    // contained any escape sequences. This is needed because words with
    // escape sequences must not be interpreted as keywords.
    this.containsEsc = false;

    // Set up token state

    // The current position of the tokenizer in the input.
    if (startPos) {
      this.pos = startPos;
      this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
      this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
    } else {
      this.pos = this.lineStart = 0;
      this.curLine = 1;
    }

    // Properties of the current token:
    // Its type
    this.type = types$1.eof;
    // For tokens that include more information than their type, the value
    this.value = null;
    // Its start and end offset
    this.start = this.end = this.pos;
    // And, if locations are used, the {line, column} object
    // corresponding to those offsets
    this.startLoc = this.endLoc = this.curPosition();

    // Position information for the previous token
    this.lastTokEndLoc = this.lastTokStartLoc = null;
    this.lastTokStart = this.lastTokEnd = this.pos;

    // The context stack is used to superficially track syntactic
    // context to predict whether a regular expression is allowed in a
    // given position.
    this.context = this.initialContext();
    this.exprAllowed = true;

    // Figure out if it's a module code.
    this.inModule = options.sourceType === "module";
    this.strict = this.inModule || this.strictDirective(this.pos);

    // Used to signify the start of a potential arrow function
    this.potentialArrowAt = -1;
    this.potentialArrowInForAwait = false;

    // Positions to delayed-check that yield/await does not exist in default parameters.
    this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
    // Labels in scope.
    this.labels = [];
    // Thus-far undefined exports.
    this.undefinedExports = Object.create(null);

    // If enabled, skip leading hashbang line.
    if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!")
      { this.skipLineComment(2); }

    // Scope tracking for duplicate variable names (see scope.js)
    this.scopeStack = [];
    this.enterScope(SCOPE_TOP);

    // For RegExp validation
    this.regexpState = null;

    // The stack of private names.
    // Each element has two properties: 'declared' and 'used'.
    // When it exited from the outermost class definition, all used private names must be declared.
    this.privateNameStack = [];
  };

  var prototypeAccessors = { inFunction: { configurable: true },inGenerator: { configurable: true },inAsync: { configurable: true },canAwait: { configurable: true },allowSuper: { configurable: true },allowDirectSuper: { configurable: true },treatFunctionsAsVar: { configurable: true },allowNewDotTarget: { configurable: true },inClassStaticBlock: { configurable: true } };

  Parser.prototype.parse = function parse () {
    var node = this.options.program || this.startNode();
    this.nextToken();
    return this.parseTopLevel(node)
  };

  prototypeAccessors.inFunction.get = function () { return (this.currentVarScope().flags & SCOPE_FUNCTION) > 0 };

  prototypeAccessors.inGenerator.get = function () { return (this.currentVarScope().flags & SCOPE_GENERATOR) > 0 && !this.currentVarScope().inClassFieldInit };

  prototypeAccessors.inAsync.get = function () { return (this.currentVarScope().flags & SCOPE_ASYNC) > 0 && !this.currentVarScope().inClassFieldInit };

  prototypeAccessors.canAwait.get = function () {
    for (var i = this.scopeStack.length - 1; i >= 0; i--) {
      var scope = this.scopeStack[i];
      if (scope.inClassFieldInit || scope.flags & SCOPE_CLASS_STATIC_BLOCK) { return false }
      if (scope.flags & SCOPE_FUNCTION) { return (scope.flags & SCOPE_ASYNC) > 0 }
    }
    return (this.inModule && this.options.ecmaVersion >= 13) || this.options.allowAwaitOutsideFunction
  };

  prototypeAccessors.allowSuper.get = function () {
    var ref = this.currentThisScope();
      var flags = ref.flags;
      var inClassFieldInit = ref.inClassFieldInit;
    return (flags & SCOPE_SUPER) > 0 || inClassFieldInit || this.options.allowSuperOutsideMethod
  };

  prototypeAccessors.allowDirectSuper.get = function () { return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0 };

  prototypeAccessors.treatFunctionsAsVar.get = function () { return this.treatFunctionsAsVarInScope(this.currentScope()) };

  prototypeAccessors.allowNewDotTarget.get = function () {
    var ref = this.currentThisScope();
      var flags = ref.flags;
      var inClassFieldInit = ref.inClassFieldInit;
    return (flags & (SCOPE_FUNCTION | SCOPE_CLASS_STATIC_BLOCK)) > 0 || inClassFieldInit
  };

  prototypeAccessors.inClassStaticBlock.get = function () {
    return (this.currentVarScope().flags & SCOPE_CLASS_STATIC_BLOCK) > 0
  };

  Parser.extend = function extend () {
      var plugins = [], len = arguments.length;
      while ( len-- ) plugins[ len ] = arguments[ len ];

    var cls = this;
    for (var i = 0; i < plugins.length; i++) { cls = plugins[i](cls); }
    return cls
  };

  Parser.parse = function parse (input, options) {
    return new this(options, input).parse()
  };

  Parser.parseExpressionAt = function parseExpressionAt (input, pos, options) {
    var parser = new this(options, input, pos);
    parser.nextToken();
    return parser.parseExpression()
  };

  Parser.tokenizer = function tokenizer (input, options) {
    return new this(options, input)
  };

  Object.defineProperties( Parser.prototype, prototypeAccessors );

  var pp$9 = Parser.prototype;

  // ## Parser utilities

  var literal = /^(?:'((?:\\.|[^'\\])*?)'|"((?:\\.|[^"\\])*?)")/;
  pp$9.strictDirective = function(start) {
    if (this.options.ecmaVersion < 5) { return false }
    for (;;) {
      // Try to find string literal.
      skipWhiteSpace.lastIndex = start;
      start += skipWhiteSpace.exec(this.input)[0].length;
      var match = literal.exec(this.input.slice(start));
      if (!match) { return false }
      if ((match[1] || match[2]) === "use strict") {
        skipWhiteSpace.lastIndex = start + match[0].length;
        var spaceAfter = skipWhiteSpace.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;
        var next = this.input.charAt(end);
        return next === ";" || next === "}" ||
          (lineBreak.test(spaceAfter[0]) &&
           !(/[(`.[+\-/*%<>=,?^&]/.test(next) || next === "!" && this.input.charAt(end + 1) === "="))
      }
      start += match[0].length;

      // Skip semicolon, if any.
      skipWhiteSpace.lastIndex = start;
      start += skipWhiteSpace.exec(this.input)[0].length;
      if (this.input[start] === ";")
        { start++; }
    }
  };

  // Predicate that tests whether the next token is of the given
  // type, and if yes, consumes it as a side effect.

  pp$9.eat = function(type) {
    if (this.type === type) {
      this.next();
      return true
    } else {
      return false
    }
  };

  // Tests whether parsed token is a contextual keyword.

  pp$9.isContextual = function(name) {
    return this.type === types$1.name && this.value === name && !this.containsEsc
  };

  // Consumes contextual keyword if possible.

  pp$9.eatContextual = function(name) {
    if (!this.isContextual(name)) { return false }
    this.next();
    return true
  };

  // Asserts that following token is given contextual keyword.

  pp$9.expectContextual = function(name) {
    if (!this.eatContextual(name)) { this.unexpected(); }
  };

  // Test whether a semicolon can be inserted at the current position.

  pp$9.canInsertSemicolon = function() {
    return this.type === types$1.eof ||
      this.type === types$1.braceR ||
      lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
  };

  pp$9.insertSemicolon = function() {
    if (this.canInsertSemicolon()) {
      if (this.options.onInsertedSemicolon)
        { this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc); }
      return true
    }
  };

  // Consume a semicolon, or, failing that, see if we are allowed to
  // pretend that there is a semicolon at this position.

  pp$9.semicolon = function() {
    if (!this.eat(types$1.semi) && !this.insertSemicolon()) { this.unexpected(); }
  };

  pp$9.afterTrailingComma = function(tokType, notNext) {
    if (this.type === tokType) {
      if (this.options.onTrailingComma)
        { this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc); }
      if (!notNext)
        { this.next(); }
      return true
    }
  };

  // Expect a token of a given type. If found, consume it, otherwise,
  // raise an unexpected token error.

  pp$9.expect = function(type) {
    this.eat(type) || this.unexpected();
  };

  // Raise an unexpected token error.

  pp$9.unexpected = function(pos) {
    this.raise(pos != null ? pos : this.start, "Unexpected token");
  };

  var DestructuringErrors = function DestructuringErrors() {
    this.shorthandAssign =
    this.trailingComma =
    this.parenthesizedAssign =
    this.parenthesizedBind =
    this.doubleProto =
      -1;
  };

  pp$9.checkPatternErrors = function(refDestructuringErrors, isAssign) {
    if (!refDestructuringErrors) { return }
    if (refDestructuringErrors.trailingComma > -1)
      { this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element"); }
    var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
    if (parens > -1) { this.raiseRecoverable(parens, isAssign ? "Assigning to rvalue" : "Parenthesized pattern"); }
  };

  pp$9.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
    if (!refDestructuringErrors) { return false }
    var shorthandAssign = refDestructuringErrors.shorthandAssign;
    var doubleProto = refDestructuringErrors.doubleProto;
    if (!andThrow) { return shorthandAssign >= 0 || doubleProto >= 0 }
    if (shorthandAssign >= 0)
      { this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns"); }
    if (doubleProto >= 0)
      { this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property"); }
  };

  pp$9.checkYieldAwaitInDefaultParams = function() {
    if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos))
      { this.raise(this.yieldPos, "Yield expression cannot be a default value"); }
    if (this.awaitPos)
      { this.raise(this.awaitPos, "Await expression cannot be a default value"); }
  };

  pp$9.isSimpleAssignTarget = function(expr) {
    if (expr.type === "ParenthesizedExpression")
      { return this.isSimpleAssignTarget(expr.expression) }
    return expr.type === "Identifier" || expr.type === "MemberExpression"
  };

  var pp$8 = Parser.prototype;

  // ### Statement parsing

  // Parse a program. Initializes the parser, reads any number of
  // statements, and wraps them in a Program node.  Optionally takes a
  // `program` argument.  If present, the statements will be appended
  // to its body instead of creating a new node.

  pp$8.parseTopLevel = function(node) {
    var exports = Object.create(null);
    if (!node.body) { node.body = []; }
    while (this.type !== types$1.eof) {
      var stmt = this.parseStatement(null, true, exports);
      node.body.push(stmt);
    }
    if (this.inModule)
      { for (var i = 0, list = Object.keys(this.undefinedExports); i < list.length; i += 1)
        {
          var name = list[i];

          this.raiseRecoverable(this.undefinedExports[name].start, ("Export '" + name + "' is not defined"));
        } }
    this.adaptDirectivePrologue(node.body);
    this.next();
    node.sourceType = this.options.sourceType;
    return this.finishNode(node, "Program")
  };

  var loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"};

  pp$8.isLet = function(context) {
    if (this.options.ecmaVersion < 6 || !this.isContextual("let")) { return false }
    skipWhiteSpace.lastIndex = this.pos;
    var skip = skipWhiteSpace.exec(this.input);
    var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
    // For ambiguous cases, determine if a LexicalDeclaration (or only a
    // Statement) is allowed here. If context is not empty then only a Statement
    // is allowed. However, `let [` is an explicit negative lookahead for
    // ExpressionStatement, so special-case it first.
    if (nextCh === 91 || nextCh === 92) { return true } // '[', '/'
    if (context) { return false }

    if (nextCh === 123 || nextCh > 0xd7ff && nextCh < 0xdc00) { return true } // '{', astral
    if (isIdentifierStart(nextCh, true)) {
      var pos = next + 1;
      while (isIdentifierChar(nextCh = this.input.charCodeAt(pos), true)) { ++pos; }
      if (nextCh === 92 || nextCh > 0xd7ff && nextCh < 0xdc00) { return true }
      var ident = this.input.slice(next, pos);
      if (!keywordRelationalOperator.test(ident)) { return true }
    }
    return false
  };

  // check 'async [no LineTerminator here] function'
  // - 'async /*foo*/ function' is OK.
  // - 'async /*\n*/ function' is invalid.
  pp$8.isAsyncFunction = function() {
    if (this.options.ecmaVersion < 8 || !this.isContextual("async"))
      { return false }

    skipWhiteSpace.lastIndex = this.pos;
    var skip = skipWhiteSpace.exec(this.input);
    var next = this.pos + skip[0].length, after;
    return !lineBreak.test(this.input.slice(this.pos, next)) &&
      this.input.slice(next, next + 8) === "function" &&
      (next + 8 === this.input.length ||
       !(isIdentifierChar(after = this.input.charCodeAt(next + 8)) || after > 0xd7ff && after < 0xdc00))
  };

  // Parse a single statement.
  //
  // If expecting a statement and finding a slash operator, parse a
  // regular expression literal. This is to handle cases like
  // `if (foo) /blah/.exec(foo)`, where looking at the previous token
  // does not help.

  pp$8.parseStatement = function(context, topLevel, exports) {
    var starttype = this.type, node = this.startNode(), kind;

    if (this.isLet(context)) {
      starttype = types$1._var;
      kind = "let";
    }

    // Most types of statements are recognized by the keyword they
    // start with. Many are trivial to parse, some require a bit of
    // complexity.

    switch (starttype) {
    case types$1._break: case types$1._continue: return this.parseBreakContinueStatement(node, starttype.keyword)
    case types$1._debugger: return this.parseDebuggerStatement(node)
    case types$1._do: return this.parseDoStatement(node)
    case types$1._for: return this.parseForStatement(node)
    case types$1._function:
      // Function as sole body of either an if statement or a labeled statement
      // works, but not when it is part of a labeled statement that is the sole
      // body of an if statement.
      if ((context && (this.strict || context !== "if" && context !== "label")) && this.options.ecmaVersion >= 6) { this.unexpected(); }
      return this.parseFunctionStatement(node, false, !context)
    case types$1._class:
      if (context) { this.unexpected(); }
      return this.parseClass(node, true)
    case types$1._if: return this.parseIfStatement(node)
    case types$1._return: return this.parseReturnStatement(node)
    case types$1._switch: return this.parseSwitchStatement(node)
    case types$1._throw: return this.parseThrowStatement(node)
    case types$1._try: return this.parseTryStatement(node)
    case types$1._const: case types$1._var:
      kind = kind || this.value;
      if (context && kind !== "var") { this.unexpected(); }
      return this.parseVarStatement(node, kind)
    case types$1._while: return this.parseWhileStatement(node)
    case types$1._with: return this.parseWithStatement(node)
    case types$1.braceL: return this.parseBlock(true, node)
    case types$1.semi: return this.parseEmptyStatement(node)
    case types$1._export:
    case types$1._import:
      if (this.options.ecmaVersion > 10 && starttype === types$1._import) {
        skipWhiteSpace.lastIndex = this.pos;
        var skip = skipWhiteSpace.exec(this.input);
        var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
        if (nextCh === 40 || nextCh === 46) // '(' or '.'
          { return this.parseExpressionStatement(node, this.parseExpression()) }
      }

      if (!this.options.allowImportExportEverywhere) {
        if (!topLevel)
          { this.raise(this.start, "'import' and 'export' may only appear at the top level"); }
        if (!this.inModule)
          { this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'"); }
      }
      return starttype === types$1._import ? this.parseImport(node) : this.parseExport(node, exports)

      // If the statement does not start with a statement keyword or a
      // brace, it's an ExpressionStatement or LabeledStatement. We
      // simply start parsing an expression, and afterwards, if the
      // next token is a colon and the expression was a simple
      // Identifier node, we switch to interpreting it as a label.
    default:
      if (this.isAsyncFunction()) {
        if (context) { this.unexpected(); }
        this.next();
        return this.parseFunctionStatement(node, true, !context)
      }

      var maybeName = this.value, expr = this.parseExpression();
      if (starttype === types$1.name && expr.type === "Identifier" && this.eat(types$1.colon))
        { return this.parseLabeledStatement(node, maybeName, expr, context) }
      else { return this.parseExpressionStatement(node, expr) }
    }
  };

  pp$8.parseBreakContinueStatement = function(node, keyword) {
    var isBreak = keyword === "break";
    this.next();
    if (this.eat(types$1.semi) || this.insertSemicolon()) { node.label = null; }
    else if (this.type !== types$1.name) { this.unexpected(); }
    else {
      node.label = this.parseIdent();
      this.semicolon();
    }

    // Verify that there is an actual destination to break or
    // continue to.
    var i = 0;
    for (; i < this.labels.length; ++i) {
      var lab = this.labels[i];
      if (node.label == null || lab.name === node.label.name) {
        if (lab.kind != null && (isBreak || lab.kind === "loop")) { break }
        if (node.label && isBreak) { break }
      }
    }
    if (i === this.labels.length) { this.raise(node.start, "Unsyntactic " + keyword); }
    return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement")
  };

  pp$8.parseDebuggerStatement = function(node) {
    this.next();
    this.semicolon();
    return this.finishNode(node, "DebuggerStatement")
  };

  pp$8.parseDoStatement = function(node) {
    this.next();
    this.labels.push(loopLabel);
    node.body = this.parseStatement("do");
    this.labels.pop();
    this.expect(types$1._while);
    node.test = this.parseParenExpression();
    if (this.options.ecmaVersion >= 6)
      { this.eat(types$1.semi); }
    else
      { this.semicolon(); }
    return this.finishNode(node, "DoWhileStatement")
  };

  // Disambiguating between a `for` and a `for`/`in` or `for`/`of`
  // loop is non-trivial. Basically, we have to parse the init `var`
  // statement or expression, disallowing the `in` operator (see
  // the second parameter to `parseExpression`), and then check
  // whether the next token is `in` or `of`. When there is no init
  // part (semicolon immediately after the opening parenthesis), it
  // is a regular `for` loop.

  pp$8.parseForStatement = function(node) {
    this.next();
    var awaitAt = (this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual("await")) ? this.lastTokStart : -1;
    this.labels.push(loopLabel);
    this.enterScope(0);
    this.expect(types$1.parenL);
    if (this.type === types$1.semi) {
      if (awaitAt > -1) { this.unexpected(awaitAt); }
      return this.parseFor(node, null)
    }
    var isLet = this.isLet();
    if (this.type === types$1._var || this.type === types$1._const || isLet) {
      var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
      this.next();
      this.parseVar(init$1, true, kind);
      this.finishNode(init$1, "VariableDeclaration");
      if ((this.type === types$1._in || (this.options.ecmaVersion >= 6 && this.isContextual("of"))) && init$1.declarations.length === 1) {
        if (this.options.ecmaVersion >= 9) {
          if (this.type === types$1._in) {
            if (awaitAt > -1) { this.unexpected(awaitAt); }
          } else { node.await = awaitAt > -1; }
        }
        return this.parseForIn(node, init$1)
      }
      if (awaitAt > -1) { this.unexpected(awaitAt); }
      return this.parseFor(node, init$1)
    }
    var startsWithLet = this.isContextual("let"), isForOf = false;
    var refDestructuringErrors = new DestructuringErrors;
    var init = this.parseExpression(awaitAt > -1 ? "await" : true, refDestructuringErrors);
    if (this.type === types$1._in || (isForOf = this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
      if (this.options.ecmaVersion >= 9) {
        if (this.type === types$1._in) {
          if (awaitAt > -1) { this.unexpected(awaitAt); }
        } else { node.await = awaitAt > -1; }
      }
      if (startsWithLet && isForOf) { this.raise(init.start, "The left-hand side of a for-of loop may not start with 'let'."); }
      this.toAssignable(init, false, refDestructuringErrors);
      this.checkLValPattern(init);
      return this.parseForIn(node, init)
    } else {
      this.checkExpressionErrors(refDestructuringErrors, true);
    }
    if (awaitAt > -1) { this.unexpected(awaitAt); }
    return this.parseFor(node, init)
  };

  pp$8.parseFunctionStatement = function(node, isAsync, declarationPosition) {
    this.next();
    return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync)
  };

  pp$8.parseIfStatement = function(node) {
    this.next();
    node.test = this.parseParenExpression();
    // allow function declarations in branches, but only in non-strict mode
    node.consequent = this.parseStatement("if");
    node.alternate = this.eat(types$1._else) ? this.parseStatement("if") : null;
    return this.finishNode(node, "IfStatement")
  };

  pp$8.parseReturnStatement = function(node) {
    if (!this.inFunction && !this.options.allowReturnOutsideFunction)
      { this.raise(this.start, "'return' outside of function"); }
    this.next();

    // In `return` (and `break`/`continue`), the keywords with
    // optional arguments, we eagerly look for a semicolon or the
    // possibility to insert one.

    if (this.eat(types$1.semi) || this.insertSemicolon()) { node.argument = null; }
    else { node.argument = this.parseExpression(); this.semicolon(); }
    return this.finishNode(node, "ReturnStatement")
  };

  pp$8.parseSwitchStatement = function(node) {
    this.next();
    node.discriminant = this.parseParenExpression();
    node.cases = [];
    this.expect(types$1.braceL);
    this.labels.push(switchLabel);
    this.enterScope(0);

    // Statements under must be grouped (by label) in SwitchCase
    // nodes. `cur` is used to keep the node that we are currently
    // adding statements to.

    var cur;
    for (var sawDefault = false; this.type !== types$1.braceR;) {
      if (this.type === types$1._case || this.type === types$1._default) {
        var isCase = this.type === types$1._case;
        if (cur) { this.finishNode(cur, "SwitchCase"); }
        node.cases.push(cur = this.startNode());
        cur.consequent = [];
        this.next();
        if (isCase) {
          cur.test = this.parseExpression();
        } else {
          if (sawDefault) { this.raiseRecoverable(this.lastTokStart, "Multiple default clauses"); }
          sawDefault = true;
          cur.test = null;
        }
        this.expect(types$1.colon);
      } else {
        if (!cur) { this.unexpected(); }
        cur.consequent.push(this.parseStatement(null));
      }
    }
    this.exitScope();
    if (cur) { this.finishNode(cur, "SwitchCase"); }
    this.next(); // Closing brace
    this.labels.pop();
    return this.finishNode(node, "SwitchStatement")
  };

  pp$8.parseThrowStatement = function(node) {
    this.next();
    if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start)))
      { this.raise(this.lastTokEnd, "Illegal newline after throw"); }
    node.argument = this.parseExpression();
    this.semicolon();
    return this.finishNode(node, "ThrowStatement")
  };

  // Reused empty array added for node fields that are always empty.

  var empty$1 = [];

  pp$8.parseCatchClauseParam = function() {
    var param = this.parseBindingAtom();
    var simple = param.type === "Identifier";
    this.enterScope(simple ? SCOPE_SIMPLE_CATCH : 0);
    this.checkLValPattern(param, simple ? BIND_SIMPLE_CATCH : BIND_LEXICAL);
    this.expect(types$1.parenR);

    return param
  };

  pp$8.parseTryStatement = function(node) {
    this.next();
    node.block = this.parseBlock();
    node.handler = null;
    if (this.type === types$1._catch) {
      var clause = this.startNode();
      this.next();
      if (this.eat(types$1.parenL)) {
        clause.param = this.parseCatchClauseParam();
      } else {
        if (this.options.ecmaVersion < 10) { this.unexpected(); }
        clause.param = null;
        this.enterScope(0);
      }
      clause.body = this.parseBlock(false);
      this.exitScope();
      node.handler = this.finishNode(clause, "CatchClause");
    }
    node.finalizer = this.eat(types$1._finally) ? this.parseBlock() : null;
    if (!node.handler && !node.finalizer)
      { this.raise(node.start, "Missing catch or finally clause"); }
    return this.finishNode(node, "TryStatement")
  };

  pp$8.parseVarStatement = function(node, kind, allowMissingInitializer) {
    this.next();
    this.parseVar(node, false, kind, allowMissingInitializer);
    this.semicolon();
    return this.finishNode(node, "VariableDeclaration")
  };

  pp$8.parseWhileStatement = function(node) {
    this.next();
    node.test = this.parseParenExpression();
    this.labels.push(loopLabel);
    node.body = this.parseStatement("while");
    this.labels.pop();
    return this.finishNode(node, "WhileStatement")
  };

  pp$8.parseWithStatement = function(node) {
    if (this.strict) { this.raise(this.start, "'with' in strict mode"); }
    this.next();
    node.object = this.parseParenExpression();
    node.body = this.parseStatement("with");
    return this.finishNode(node, "WithStatement")
  };

  pp$8.parseEmptyStatement = function(node) {
    this.next();
    return this.finishNode(node, "EmptyStatement")
  };

  pp$8.parseLabeledStatement = function(node, maybeName, expr, context) {
    for (var i$1 = 0, list = this.labels; i$1 < list.length; i$1 += 1)
      {
      var label = list[i$1];

      if (label.name === maybeName)
        { this.raise(expr.start, "Label '" + maybeName + "' is already declared");
    } }
    var kind = this.type.isLoop ? "loop" : this.type === types$1._switch ? "switch" : null;
    for (var i = this.labels.length - 1; i >= 0; i--) {
      var label$1 = this.labels[i];
      if (label$1.statementStart === node.start) {
        // Update information about previous labels on this node
        label$1.statementStart = this.start;
        label$1.kind = kind;
      } else { break }
    }
    this.labels.push({name: maybeName, kind: kind, statementStart: this.start});
    node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
    this.labels.pop();
    node.label = expr;
    return this.finishNode(node, "LabeledStatement")
  };

  pp$8.parseExpressionStatement = function(node, expr) {
    node.expression = expr;
    this.semicolon();
    return this.finishNode(node, "ExpressionStatement")
  };

  // Parse a semicolon-enclosed block of statements, handling `"use
  // strict"` declarations when `allowStrict` is true (used for
  // function bodies).

  pp$8.parseBlock = function(createNewLexicalScope, node, exitStrict) {
    if ( createNewLexicalScope === void 0 ) createNewLexicalScope = true;
    if ( node === void 0 ) node = this.startNode();

    node.body = [];
    this.expect(types$1.braceL);
    if (createNewLexicalScope) { this.enterScope(0); }
    while (this.type !== types$1.braceR) {
      var stmt = this.parseStatement(null);
      node.body.push(stmt);
    }
    if (exitStrict) { this.strict = false; }
    this.next();
    if (createNewLexicalScope) { this.exitScope(); }
    return this.finishNode(node, "BlockStatement")
  };

  // Parse a regular `for` loop. The disambiguation code in
  // `parseStatement` will already have parsed the init statement or
  // expression.

  pp$8.parseFor = function(node, init) {
    node.init = init;
    this.expect(types$1.semi);
    node.test = this.type === types$1.semi ? null : this.parseExpression();
    this.expect(types$1.semi);
    node.update = this.type === types$1.parenR ? null : this.parseExpression();
    this.expect(types$1.parenR);
    node.body = this.parseStatement("for");
    this.exitScope();
    this.labels.pop();
    return this.finishNode(node, "ForStatement")
  };

  // Parse a `for`/`in` and `for`/`of` loop, which are almost
  // same from parser's perspective.

  pp$8.parseForIn = function(node, init) {
    var isForIn = this.type === types$1._in;
    this.next();

    if (
      init.type === "VariableDeclaration" &&
      init.declarations[0].init != null &&
      (
        !isForIn ||
        this.options.ecmaVersion < 8 ||
        this.strict ||
        init.kind !== "var" ||
        init.declarations[0].id.type !== "Identifier"
      )
    ) {
      this.raise(
        init.start,
        ((isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer")
      );
    }
    node.left = init;
    node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
    this.expect(types$1.parenR);
    node.body = this.parseStatement("for");
    this.exitScope();
    this.labels.pop();
    return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement")
  };

  // Parse a list of variable declarations.

  pp$8.parseVar = function(node, isFor, kind, allowMissingInitializer) {
    node.declarations = [];
    node.kind = kind;
    for (;;) {
      var decl = this.startNode();
      this.parseVarId(decl, kind);
      if (this.eat(types$1.eq)) {
        decl.init = this.parseMaybeAssign(isFor);
      } else if (!allowMissingInitializer && kind === "const" && !(this.type === types$1._in || (this.options.ecmaVersion >= 6 && this.isContextual("of")))) {
        this.unexpected();
      } else if (!allowMissingInitializer && decl.id.type !== "Identifier" && !(isFor && (this.type === types$1._in || this.isContextual("of")))) {
        this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
      } else {
        decl.init = null;
      }
      node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
      if (!this.eat(types$1.comma)) { break }
    }
    return node
  };

  pp$8.parseVarId = function(decl, kind) {
    decl.id = this.parseBindingAtom();
    this.checkLValPattern(decl.id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
  };

  var FUNC_STATEMENT = 1, FUNC_HANGING_STATEMENT = 2, FUNC_NULLABLE_ID = 4;

  // Parse a function declaration or literal (depending on the
  // `statement & FUNC_STATEMENT`).

  // Remove `allowExpressionBody` for 7.0.0, as it is only called with false
  pp$8.parseFunction = function(node, statement, allowExpressionBody, isAsync, forInit) {
    this.initFunction(node);
    if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
      if (this.type === types$1.star && (statement & FUNC_HANGING_STATEMENT))
        { this.unexpected(); }
      node.generator = this.eat(types$1.star);
    }
    if (this.options.ecmaVersion >= 8)
      { node.async = !!isAsync; }

    if (statement & FUNC_STATEMENT) {
      node.id = (statement & FUNC_NULLABLE_ID) && this.type !== types$1.name ? null : this.parseIdent();
      if (node.id && !(statement & FUNC_HANGING_STATEMENT))
        // If it is a regular function declaration in sloppy mode, then it is
        // subject to Annex B semantics (BIND_FUNCTION). Otherwise, the binding
        // mode depends on properties of the current scope (see
        // treatFunctionsAsVar).
        { this.checkLValSimple(node.id, (this.strict || node.generator || node.async) ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION); }
    }

    var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    this.enterScope(functionFlags(node.async, node.generator));

    if (!(statement & FUNC_STATEMENT))
      { node.id = this.type === types$1.name ? this.parseIdent() : null; }

    this.parseFunctionParams(node);
    this.parseFunctionBody(node, allowExpressionBody, false, forInit);

    this.yieldPos = oldYieldPos;
    this.awaitPos = oldAwaitPos;
    this.awaitIdentPos = oldAwaitIdentPos;
    return this.finishNode(node, (statement & FUNC_STATEMENT) ? "FunctionDeclaration" : "FunctionExpression")
  };

  pp$8.parseFunctionParams = function(node) {
    this.expect(types$1.parenL);
    node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
    this.checkYieldAwaitInDefaultParams();
  };

  // Parse a class declaration or literal (depending on the
  // `isStatement` parameter).

  pp$8.parseClass = function(node, isStatement) {
    this.next();

    // ecma-262 14.6 Class Definitions
    // A class definition is always strict mode code.
    var oldStrict = this.strict;
    this.strict = true;

    this.parseClassId(node, isStatement);
    this.parseClassSuper(node);
    var privateNameMap = this.enterClassBody();
    var classBody = this.startNode();
    var hadConstructor = false;
    classBody.body = [];
    this.expect(types$1.braceL);
    while (this.type !== types$1.braceR) {
      var element = this.parseClassElement(node.superClass !== null);
      if (element) {
        classBody.body.push(element);
        if (element.type === "MethodDefinition" && element.kind === "constructor") {
          if (hadConstructor) { this.raiseRecoverable(element.start, "Duplicate constructor in the same class"); }
          hadConstructor = true;
        } else if (element.key && element.key.type === "PrivateIdentifier" && isPrivateNameConflicted(privateNameMap, element)) {
          this.raiseRecoverable(element.key.start, ("Identifier '#" + (element.key.name) + "' has already been declared"));
        }
      }
    }
    this.strict = oldStrict;
    this.next();
    node.body = this.finishNode(classBody, "ClassBody");
    this.exitClassBody();
    return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression")
  };

  pp$8.parseClassElement = function(constructorAllowsSuper) {
    if (this.eat(types$1.semi)) { return null }

    var ecmaVersion = this.options.ecmaVersion;
    var node = this.startNode();
    var keyName = "";
    var isGenerator = false;
    var isAsync = false;
    var kind = "method";
    var isStatic = false;

    if (this.eatContextual("static")) {
      // Parse static init block
      if (ecmaVersion >= 13 && this.eat(types$1.braceL)) {
        this.parseClassStaticBlock(node);
        return node
      }
      if (this.isClassElementNameStart() || this.type === types$1.star) {
        isStatic = true;
      } else {
        keyName = "static";
      }
    }
    node.static = isStatic;
    if (!keyName && ecmaVersion >= 8 && this.eatContextual("async")) {
      if ((this.isClassElementNameStart() || this.type === types$1.star) && !this.canInsertSemicolon()) {
        isAsync = true;
      } else {
        keyName = "async";
      }
    }
    if (!keyName && (ecmaVersion >= 9 || !isAsync) && this.eat(types$1.star)) {
      isGenerator = true;
    }
    if (!keyName && !isAsync && !isGenerator) {
      var lastValue = this.value;
      if (this.eatContextual("get") || this.eatContextual("set")) {
        if (this.isClassElementNameStart()) {
          kind = lastValue;
        } else {
          keyName = lastValue;
        }
      }
    }

    // Parse element name
    if (keyName) {
      // 'async', 'get', 'set', or 'static' were not a keyword contextually.
      // The last token is any of those. Make it the element name.
      node.computed = false;
      node.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);
      node.key.name = keyName;
      this.finishNode(node.key, "Identifier");
    } else {
      this.parseClassElementName(node);
    }

    // Parse element value
    if (ecmaVersion < 13 || this.type === types$1.parenL || kind !== "method" || isGenerator || isAsync) {
      var isConstructor = !node.static && checkKeyName(node, "constructor");
      var allowsDirectSuper = isConstructor && constructorAllowsSuper;
      // Couldn't move this check into the 'parseClassMethod' method for backward compatibility.
      if (isConstructor && kind !== "method") { this.raise(node.key.start, "Constructor can't have get/set modifier"); }
      node.kind = isConstructor ? "constructor" : kind;
      this.parseClassMethod(node, isGenerator, isAsync, allowsDirectSuper);
    } else {
      this.parseClassField(node);
    }

    return node
  };

  pp$8.isClassElementNameStart = function() {
    return (
      this.type === types$1.name ||
      this.type === types$1.privateId ||
      this.type === types$1.num ||
      this.type === types$1.string ||
      this.type === types$1.bracketL ||
      this.type.keyword
    )
  };

  pp$8.parseClassElementName = function(element) {
    if (this.type === types$1.privateId) {
      if (this.value === "constructor") {
        this.raise(this.start, "Classes can't have an element named '#constructor'");
      }
      element.computed = false;
      element.key = this.parsePrivateIdent();
    } else {
      this.parsePropertyName(element);
    }
  };

  pp$8.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
    // Check key and flags
    var key = method.key;
    if (method.kind === "constructor") {
      if (isGenerator) { this.raise(key.start, "Constructor can't be a generator"); }
      if (isAsync) { this.raise(key.start, "Constructor can't be an async method"); }
    } else if (method.static && checkKeyName(method, "prototype")) {
      this.raise(key.start, "Classes may not have a static property named prototype");
    }

    // Parse value
    var value = method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);

    // Check value
    if (method.kind === "get" && value.params.length !== 0)
      { this.raiseRecoverable(value.start, "getter should have no params"); }
    if (method.kind === "set" && value.params.length !== 1)
      { this.raiseRecoverable(value.start, "setter should have exactly one param"); }
    if (method.kind === "set" && value.params[0].type === "RestElement")
      { this.raiseRecoverable(value.params[0].start, "Setter cannot use rest params"); }

    return this.finishNode(method, "MethodDefinition")
  };

  pp$8.parseClassField = function(field) {
    if (checkKeyName(field, "constructor")) {
      this.raise(field.key.start, "Classes can't have a field named 'constructor'");
    } else if (field.static && checkKeyName(field, "prototype")) {
      this.raise(field.key.start, "Classes can't have a static field named 'prototype'");
    }

    if (this.eat(types$1.eq)) {
      // To raise SyntaxError if 'arguments' exists in the initializer.
      var scope = this.currentThisScope();
      var inClassFieldInit = scope.inClassFieldInit;
      scope.inClassFieldInit = true;
      field.value = this.parseMaybeAssign();
      scope.inClassFieldInit = inClassFieldInit;
    } else {
      field.value = null;
    }
    this.semicolon();

    return this.finishNode(field, "PropertyDefinition")
  };

  pp$8.parseClassStaticBlock = function(node) {
    node.body = [];

    var oldLabels = this.labels;
    this.labels = [];
    this.enterScope(SCOPE_CLASS_STATIC_BLOCK | SCOPE_SUPER);
    while (this.type !== types$1.braceR) {
      var stmt = this.parseStatement(null);
      node.body.push(stmt);
    }
    this.next();
    this.exitScope();
    this.labels = oldLabels;

    return this.finishNode(node, "StaticBlock")
  };

  pp$8.parseClassId = function(node, isStatement) {
    if (this.type === types$1.name) {
      node.id = this.parseIdent();
      if (isStatement)
        { this.checkLValSimple(node.id, BIND_LEXICAL, false); }
    } else {
      if (isStatement === true)
        { this.unexpected(); }
      node.id = null;
    }
  };

  pp$8.parseClassSuper = function(node) {
    node.superClass = this.eat(types$1._extends) ? this.parseExprSubscripts(null, false) : null;
  };

  pp$8.enterClassBody = function() {
    var element = {declared: Object.create(null), used: []};
    this.privateNameStack.push(element);
    return element.declared
  };

  pp$8.exitClassBody = function() {
    var ref = this.privateNameStack.pop();
    var declared = ref.declared;
    var used = ref.used;
    if (!this.options.checkPrivateFields) { return }
    var len = this.privateNameStack.length;
    var parent = len === 0 ? null : this.privateNameStack[len - 1];
    for (var i = 0; i < used.length; ++i) {
      var id = used[i];
      if (!hasOwn(declared, id.name)) {
        if (parent) {
          parent.used.push(id);
        } else {
          this.raiseRecoverable(id.start, ("Private field '#" + (id.name) + "' must be declared in an enclosing class"));
        }
      }
    }
  };

  function isPrivateNameConflicted(privateNameMap, element) {
    var name = element.key.name;
    var curr = privateNameMap[name];

    var next = "true";
    if (element.type === "MethodDefinition" && (element.kind === "get" || element.kind === "set")) {
      next = (element.static ? "s" : "i") + element.kind;
    }

    // `class { get #a(){}; static set #a(_){} }` is also conflict.
    if (
      curr === "iget" && next === "iset" ||
      curr === "iset" && next === "iget" ||
      curr === "sget" && next === "sset" ||
      curr === "sset" && next === "sget"
    ) {
      privateNameMap[name] = "true";
      return false
    } else if (!curr) {
      privateNameMap[name] = next;
      return false
    } else {
      return true
    }
  }

  function checkKeyName(node, name) {
    var computed = node.computed;
    var key = node.key;
    return !computed && (
      key.type === "Identifier" && key.name === name ||
      key.type === "Literal" && key.value === name
    )
  }

  // Parses module export declaration.

  pp$8.parseExportAllDeclaration = function(node, exports) {
    if (this.options.ecmaVersion >= 11) {
      if (this.eatContextual("as")) {
        node.exported = this.parseModuleExportName();
        this.checkExport(exports, node.exported, this.lastTokStart);
      } else {
        node.exported = null;
      }
    }
    this.expectContextual("from");
    if (this.type !== types$1.string) { this.unexpected(); }
    node.source = this.parseExprAtom();
    this.semicolon();
    return this.finishNode(node, "ExportAllDeclaration")
  };

  pp$8.parseExport = function(node, exports) {
    this.next();
    // export * from '...'
    if (this.eat(types$1.star)) {
      return this.parseExportAllDeclaration(node, exports)
    }
    if (this.eat(types$1._default)) { // export default ...
      this.checkExport(exports, "default", this.lastTokStart);
      node.declaration = this.parseExportDefaultDeclaration();
      return this.finishNode(node, "ExportDefaultDeclaration")
    }
    // export var|const|let|function|class ...
    if (this.shouldParseExportStatement()) {
      node.declaration = this.parseExportDeclaration(node);
      if (node.declaration.type === "VariableDeclaration")
        { this.checkVariableExport(exports, node.declaration.declarations); }
      else
        { this.checkExport(exports, node.declaration.id, node.declaration.id.start); }
      node.specifiers = [];
      node.source = null;
    } else { // export { x, y as z } [from '...']
      node.declaration = null;
      node.specifiers = this.parseExportSpecifiers(exports);
      if (this.eatContextual("from")) {
        if (this.type !== types$1.string) { this.unexpected(); }
        node.source = this.parseExprAtom();
      } else {
        for (var i = 0, list = node.specifiers; i < list.length; i += 1) {
          // check for keywords used as local names
          var spec = list[i];

          this.checkUnreserved(spec.local);
          // check if export is defined
          this.checkLocalExport(spec.local);

          if (spec.local.type === "Literal") {
            this.raise(spec.local.start, "A string literal cannot be used as an exported binding without `from`.");
          }
        }

        node.source = null;
      }
      this.semicolon();
    }
    return this.finishNode(node, "ExportNamedDeclaration")
  };

  pp$8.parseExportDeclaration = function(node) {
    return this.parseStatement(null)
  };

  pp$8.parseExportDefaultDeclaration = function() {
    var isAsync;
    if (this.type === types$1._function || (isAsync = this.isAsyncFunction())) {
      var fNode = this.startNode();
      this.next();
      if (isAsync) { this.next(); }
      return this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync)
    } else if (this.type === types$1._class) {
      var cNode = this.startNode();
      return this.parseClass(cNode, "nullableID")
    } else {
      var declaration = this.parseMaybeAssign();
      this.semicolon();
      return declaration
    }
  };

  pp$8.checkExport = function(exports, name, pos) {
    if (!exports) { return }
    if (typeof name !== "string")
      { name = name.type === "Identifier" ? name.name : name.value; }
    if (hasOwn(exports, name))
      { this.raiseRecoverable(pos, "Duplicate export '" + name + "'"); }
    exports[name] = true;
  };

  pp$8.checkPatternExport = function(exports, pat) {
    var type = pat.type;
    if (type === "Identifier")
      { this.checkExport(exports, pat, pat.start); }
    else if (type === "ObjectPattern")
      { for (var i = 0, list = pat.properties; i < list.length; i += 1)
        {
          var prop = list[i];

          this.checkPatternExport(exports, prop);
        } }
    else if (type === "ArrayPattern")
      { for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
        var elt = list$1[i$1];

          if (elt) { this.checkPatternExport(exports, elt); }
      } }
    else if (type === "Property")
      { this.checkPatternExport(exports, pat.value); }
    else if (type === "AssignmentPattern")
      { this.checkPatternExport(exports, pat.left); }
    else if (type === "RestElement")
      { this.checkPatternExport(exports, pat.argument); }
    else if (type === "ParenthesizedExpression")
      { this.checkPatternExport(exports, pat.expression); }
  };

  pp$8.checkVariableExport = function(exports, decls) {
    if (!exports) { return }
    for (var i = 0, list = decls; i < list.length; i += 1)
      {
      var decl = list[i];

      this.checkPatternExport(exports, decl.id);
    }
  };

  pp$8.shouldParseExportStatement = function() {
    return this.type.keyword === "var" ||
      this.type.keyword === "const" ||
      this.type.keyword === "class" ||
      this.type.keyword === "function" ||
      this.isLet() ||
      this.isAsyncFunction()
  };

  // Parses a comma-separated list of module exports.

  pp$8.parseExportSpecifier = function(exports) {
    var node = this.startNode();
    node.local = this.parseModuleExportName();

    node.exported = this.eatContextual("as") ? this.parseModuleExportName() : node.local;
    this.checkExport(
      exports,
      node.exported,
      node.exported.start
    );

    return this.finishNode(node, "ExportSpecifier")
  };

  pp$8.parseExportSpecifiers = function(exports) {
    var nodes = [], first = true;
    // export { x, y as z } [from '...']
    this.expect(types$1.braceL);
    while (!this.eat(types$1.braceR)) {
      if (!first) {
        this.expect(types$1.comma);
        if (this.afterTrailingComma(types$1.braceR)) { break }
      } else { first = false; }

      nodes.push(this.parseExportSpecifier(exports));
    }
    return nodes
  };

  // Parses import declaration.

  pp$8.parseImport = function(node) {
    this.next();

    // import '...'
    if (this.type === types$1.string) {
      node.specifiers = empty$1;
      node.source = this.parseExprAtom();
    } else {
      node.specifiers = this.parseImportSpecifiers();
      this.expectContextual("from");
      node.source = this.type === types$1.string ? this.parseExprAtom() : this.unexpected();
    }
    this.semicolon();
    return this.finishNode(node, "ImportDeclaration")
  };

  // Parses a comma-separated list of module imports.

  pp$8.parseImportSpecifier = function() {
    var node = this.startNode();
    node.imported = this.parseModuleExportName();

    if (this.eatContextual("as")) {
      node.local = this.parseIdent();
    } else {
      this.checkUnreserved(node.imported);
      node.local = node.imported;
    }
    this.checkLValSimple(node.local, BIND_LEXICAL);

    return this.finishNode(node, "ImportSpecifier")
  };

  pp$8.parseImportDefaultSpecifier = function() {
    // import defaultObj, { x, y as z } from '...'
    var node = this.startNode();
    node.local = this.parseIdent();
    this.checkLValSimple(node.local, BIND_LEXICAL);
    return this.finishNode(node, "ImportDefaultSpecifier")
  };

  pp$8.parseImportNamespaceSpecifier = function() {
    var node = this.startNode();
    this.next();
    this.expectContextual("as");
    node.local = this.parseIdent();
    this.checkLValSimple(node.local, BIND_LEXICAL);
    return this.finishNode(node, "ImportNamespaceSpecifier")
  };

  pp$8.parseImportSpecifiers = function() {
    var nodes = [], first = true;
    if (this.type === types$1.name) {
      nodes.push(this.parseImportDefaultSpecifier());
      if (!this.eat(types$1.comma)) { return nodes }
    }
    if (this.type === types$1.star) {
      nodes.push(this.parseImportNamespaceSpecifier());
      return nodes
    }
    this.expect(types$1.braceL);
    while (!this.eat(types$1.braceR)) {
      if (!first) {
        this.expect(types$1.comma);
        if (this.afterTrailingComma(types$1.braceR)) { break }
      } else { first = false; }

      nodes.push(this.parseImportSpecifier());
    }
    return nodes
  };

  pp$8.parseModuleExportName = function() {
    if (this.options.ecmaVersion >= 13 && this.type === types$1.string) {
      var stringLiteral = this.parseLiteral(this.value);
      if (loneSurrogate.test(stringLiteral.value)) {
        this.raise(stringLiteral.start, "An export name cannot include a lone surrogate.");
      }
      return stringLiteral
    }
    return this.parseIdent(true)
  };

  // Set `ExpressionStatement#directive` property for directive prologues.
  pp$8.adaptDirectivePrologue = function(statements) {
    for (var i = 0; i < statements.length && this.isDirectiveCandidate(statements[i]); ++i) {
      statements[i].directive = statements[i].expression.raw.slice(1, -1);
    }
  };
  pp$8.isDirectiveCandidate = function(statement) {
    return (
      this.options.ecmaVersion >= 5 &&
      statement.type === "ExpressionStatement" &&
      statement.expression.type === "Literal" &&
      typeof statement.expression.value === "string" &&
      // Reject parenthesized strings.
      (this.input[statement.start] === "\"" || this.input[statement.start] === "'")
    )
  };

  var pp$7 = Parser.prototype;

  // Convert existing expression atom to assignable pattern
  // if possible.

  pp$7.toAssignable = function(node, isBinding, refDestructuringErrors) {
    if (this.options.ecmaVersion >= 6 && node) {
      switch (node.type) {
      case "Identifier":
        if (this.inAsync && node.name === "await")
          { this.raise(node.start, "Cannot use 'await' as identifier inside an async function"); }
        break

      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
      case "RestElement":
        break

      case "ObjectExpression":
        node.type = "ObjectPattern";
        if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
        for (var i = 0, list = node.properties; i < list.length; i += 1) {
          var prop = list[i];

        this.toAssignable(prop, isBinding);
          // Early error:
          //   AssignmentRestProperty[Yield, Await] :
          //     `...` DestructuringAssignmentTarget[Yield, Await]
          //
          //   It is a Syntax Error if |DestructuringAssignmentTarget| is an |ArrayLiteral| or an |ObjectLiteral|.
          if (
            prop.type === "RestElement" &&
            (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")
          ) {
            this.raise(prop.argument.start, "Unexpected token");
          }
        }
        break

      case "Property":
        // AssignmentProperty has type === "Property"
        if (node.kind !== "init") { this.raise(node.key.start, "Object pattern can't contain getter or setter"); }
        this.toAssignable(node.value, isBinding);
        break

      case "ArrayExpression":
        node.type = "ArrayPattern";
        if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
        this.toAssignableList(node.elements, isBinding);
        break

      case "SpreadElement":
        node.type = "RestElement";
        this.toAssignable(node.argument, isBinding);
        if (node.argument.type === "AssignmentPattern")
          { this.raise(node.argument.start, "Rest elements cannot have a default value"); }
        break

      case "AssignmentExpression":
        if (node.operator !== "=") { this.raise(node.left.end, "Only '=' operator can be used for specifying default value."); }
        node.type = "AssignmentPattern";
        delete node.operator;
        this.toAssignable(node.left, isBinding);
        break

      case "ParenthesizedExpression":
        this.toAssignable(node.expression, isBinding, refDestructuringErrors);
        break

      case "ChainExpression":
        this.raiseRecoverable(node.start, "Optional chaining cannot appear in left-hand side");
        break

      case "MemberExpression":
        if (!isBinding) { break }

      default:
        this.raise(node.start, "Assigning to rvalue");
      }
    } else if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
    return node
  };

  // Convert list of expression atoms to binding list.

  pp$7.toAssignableList = function(exprList, isBinding) {
    var end = exprList.length;
    for (var i = 0; i < end; i++) {
      var elt = exprList[i];
      if (elt) { this.toAssignable(elt, isBinding); }
    }
    if (end) {
      var last = exprList[end - 1];
      if (this.options.ecmaVersion === 6 && isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier")
        { this.unexpected(last.argument.start); }
    }
    return exprList
  };

  // Parses spread element.

  pp$7.parseSpread = function(refDestructuringErrors) {
    var node = this.startNode();
    this.next();
    node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
    return this.finishNode(node, "SpreadElement")
  };

  pp$7.parseRestBinding = function() {
    var node = this.startNode();
    this.next();

    // RestElement inside of a function parameter must be an identifier
    if (this.options.ecmaVersion === 6 && this.type !== types$1.name)
      { this.unexpected(); }

    node.argument = this.parseBindingAtom();

    return this.finishNode(node, "RestElement")
  };

  // Parses lvalue (assignable) atom.

  pp$7.parseBindingAtom = function() {
    if (this.options.ecmaVersion >= 6) {
      switch (this.type) {
      case types$1.bracketL:
        var node = this.startNode();
        this.next();
        node.elements = this.parseBindingList(types$1.bracketR, true, true);
        return this.finishNode(node, "ArrayPattern")

      case types$1.braceL:
        return this.parseObj(true)
      }
    }
    return this.parseIdent()
  };

  pp$7.parseBindingList = function(close, allowEmpty, allowTrailingComma, allowModifiers) {
    var elts = [], first = true;
    while (!this.eat(close)) {
      if (first) { first = false; }
      else { this.expect(types$1.comma); }
      if (allowEmpty && this.type === types$1.comma) {
        elts.push(null);
      } else if (allowTrailingComma && this.afterTrailingComma(close)) {
        break
      } else if (this.type === types$1.ellipsis) {
        var rest = this.parseRestBinding();
        this.parseBindingListItem(rest);
        elts.push(rest);
        if (this.type === types$1.comma) { this.raiseRecoverable(this.start, "Comma is not permitted after the rest element"); }
        this.expect(close);
        break
      } else {
        elts.push(this.parseAssignableListItem(allowModifiers));
      }
    }
    return elts
  };

  pp$7.parseAssignableListItem = function(allowModifiers) {
    var elem = this.parseMaybeDefault(this.start, this.startLoc);
    this.parseBindingListItem(elem);
    return elem
  };

  pp$7.parseBindingListItem = function(param) {
    return param
  };

  // Parses assignment pattern around given atom if possible.

  pp$7.parseMaybeDefault = function(startPos, startLoc, left) {
    left = left || this.parseBindingAtom();
    if (this.options.ecmaVersion < 6 || !this.eat(types$1.eq)) { return left }
    var node = this.startNodeAt(startPos, startLoc);
    node.left = left;
    node.right = this.parseMaybeAssign();
    return this.finishNode(node, "AssignmentPattern")
  };

  // The following three functions all verify that a node is an lvalue —
  // something that can be bound, or assigned to. In order to do so, they perform
  // a variety of checks:
  //
  // - Check that none of the bound/assigned-to identifiers are reserved words.
  // - Record name declarations for bindings in the appropriate scope.
  // - Check duplicate argument names, if checkClashes is set.
  //
  // If a complex binding pattern is encountered (e.g., object and array
  // destructuring), the entire pattern is recursively checked.
  //
  // There are three versions of checkLVal*() appropriate for different
  // circumstances:
  //
  // - checkLValSimple() shall be used if the syntactic construct supports
  //   nothing other than identifiers and member expressions. Parenthesized
  //   expressions are also correctly handled. This is generally appropriate for
  //   constructs for which the spec says
  //
  //   > It is a Syntax Error if AssignmentTargetType of [the production] is not
  //   > simple.
  //
  //   It is also appropriate for checking if an identifier is valid and not
  //   defined elsewhere, like import declarations or function/class identifiers.
  //
  //   Examples where this is used include:
  //     a += …;
  //     import a from '…';
  //   where a is the node to be checked.
  //
  // - checkLValPattern() shall be used if the syntactic construct supports
  //   anything checkLValSimple() supports, as well as object and array
  //   destructuring patterns. This is generally appropriate for constructs for
  //   which the spec says
  //
  //   > It is a Syntax Error if [the production] is neither an ObjectLiteral nor
  //   > an ArrayLiteral and AssignmentTargetType of [the production] is not
  //   > simple.
  //
  //   Examples where this is used include:
  //     (a = …);
  //     const a = …;
  //     try { … } catch (a) { … }
  //   where a is the node to be checked.
  //
  // - checkLValInnerPattern() shall be used if the syntactic construct supports
  //   anything checkLValPattern() supports, as well as default assignment
  //   patterns, rest elements, and other constructs that may appear within an
  //   object or array destructuring pattern.
  //
  //   As a special case, function parameters also use checkLValInnerPattern(),
  //   as they also support defaults and rest constructs.
  //
  // These functions deliberately support both assignment and binding constructs,
  // as the logic for both is exceedingly similar. If the node is the target of
  // an assignment, then bindingType should be set to BIND_NONE. Otherwise, it
  // should be set to the appropriate BIND_* constant, like BIND_VAR or
  // BIND_LEXICAL.
  //
  // If the function is called with a non-BIND_NONE bindingType, then
  // additionally a checkClashes object may be specified to allow checking for
  // duplicate argument names. checkClashes is ignored if the provided construct
  // is an assignment (i.e., bindingType is BIND_NONE).

  pp$7.checkLValSimple = function(expr, bindingType, checkClashes) {
    if ( bindingType === void 0 ) bindingType = BIND_NONE;

    var isBind = bindingType !== BIND_NONE;

    switch (expr.type) {
    case "Identifier":
      if (this.strict && this.reservedWordsStrictBind.test(expr.name))
        { this.raiseRecoverable(expr.start, (isBind ? "Binding " : "Assigning to ") + expr.name + " in strict mode"); }
      if (isBind) {
        if (bindingType === BIND_LEXICAL && expr.name === "let")
          { this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name"); }
        if (checkClashes) {
          if (hasOwn(checkClashes, expr.name))
            { this.raiseRecoverable(expr.start, "Argument name clash"); }
          checkClashes[expr.name] = true;
        }
        if (bindingType !== BIND_OUTSIDE) { this.declareName(expr.name, bindingType, expr.start); }
      }
      break

    case "ChainExpression":
      this.raiseRecoverable(expr.start, "Optional chaining cannot appear in left-hand side");
      break

    case "MemberExpression":
      if (isBind) { this.raiseRecoverable(expr.start, "Binding member expression"); }
      break

    case "ParenthesizedExpression":
      if (isBind) { this.raiseRecoverable(expr.start, "Binding parenthesized expression"); }
      return this.checkLValSimple(expr.expression, bindingType, checkClashes)

    default:
      this.raise(expr.start, (isBind ? "Binding" : "Assigning to") + " rvalue");
    }
  };

  pp$7.checkLValPattern = function(expr, bindingType, checkClashes) {
    if ( bindingType === void 0 ) bindingType = BIND_NONE;

    switch (expr.type) {
    case "ObjectPattern":
      for (var i = 0, list = expr.properties; i < list.length; i += 1) {
        var prop = list[i];

      this.checkLValInnerPattern(prop, bindingType, checkClashes);
      }
      break

    case "ArrayPattern":
      for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
        var elem = list$1[i$1];

      if (elem) { this.checkLValInnerPattern(elem, bindingType, checkClashes); }
      }
      break

    default:
      this.checkLValSimple(expr, bindingType, checkClashes);
    }
  };

  pp$7.checkLValInnerPattern = function(expr, bindingType, checkClashes) {
    if ( bindingType === void 0 ) bindingType = BIND_NONE;

    switch (expr.type) {
    case "Property":
      // AssignmentProperty has type === "Property"
      this.checkLValInnerPattern(expr.value, bindingType, checkClashes);
      break

    case "AssignmentPattern":
      this.checkLValPattern(expr.left, bindingType, checkClashes);
      break

    case "RestElement":
      this.checkLValPattern(expr.argument, bindingType, checkClashes);
      break

    default:
      this.checkLValPattern(expr, bindingType, checkClashes);
    }
  };

  // The algorithm used to determine whether a regexp can appear at a
  // given point in the program is loosely based on sweet.js' approach.
  // See https://github.com/mozilla/sweet.js/wiki/design


  var TokContext = function TokContext(token, isExpr, preserveSpace, override, generator) {
    this.token = token;
    this.isExpr = !!isExpr;
    this.preserveSpace = !!preserveSpace;
    this.override = override;
    this.generator = !!generator;
  };

  var types = {
    b_stat: new TokContext("{", false),
    b_expr: new TokContext("{", true),
    b_tmpl: new TokContext("${", false),
    p_stat: new TokContext("(", false),
    p_expr: new TokContext("(", true),
    q_tmpl: new TokContext("`", true, true, function (p) { return p.tryReadTemplateToken(); }),
    f_stat: new TokContext("function", false),
    f_expr: new TokContext("function", true),
    f_expr_gen: new TokContext("function", true, false, null, true),
    f_gen: new TokContext("function", false, false, null, true)
  };

  var pp$6 = Parser.prototype;

  pp$6.initialContext = function() {
    return [types.b_stat]
  };

  pp$6.curContext = function() {
    return this.context[this.context.length - 1]
  };

  pp$6.braceIsBlock = function(prevType) {
    var parent = this.curContext();
    if (parent === types.f_expr || parent === types.f_stat)
      { return true }
    if (prevType === types$1.colon && (parent === types.b_stat || parent === types.b_expr))
      { return !parent.isExpr }

    // The check for `tt.name && exprAllowed` detects whether we are
    // after a `yield` or `of` construct. See the `updateContext` for
    // `tt.name`.
    if (prevType === types$1._return || prevType === types$1.name && this.exprAllowed)
      { return lineBreak.test(this.input.slice(this.lastTokEnd, this.start)) }
    if (prevType === types$1._else || prevType === types$1.semi || prevType === types$1.eof || prevType === types$1.parenR || prevType === types$1.arrow)
      { return true }
    if (prevType === types$1.braceL)
      { return parent === types.b_stat }
    if (prevType === types$1._var || prevType === types$1._const || prevType === types$1.name)
      { return false }
    return !this.exprAllowed
  };

  pp$6.inGeneratorContext = function() {
    for (var i = this.context.length - 1; i >= 1; i--) {
      var context = this.context[i];
      if (context.token === "function")
        { return context.generator }
    }
    return false
  };

  pp$6.updateContext = function(prevType) {
    var update, type = this.type;
    if (type.keyword && prevType === types$1.dot)
      { this.exprAllowed = false; }
    else if (update = type.updateContext)
      { update.call(this, prevType); }
    else
      { this.exprAllowed = type.beforeExpr; }
  };

  // Used to handle egde cases when token context could not be inferred correctly during tokenization phase

  pp$6.overrideContext = function(tokenCtx) {
    if (this.curContext() !== tokenCtx) {
      this.context[this.context.length - 1] = tokenCtx;
    }
  };

  // Token-specific context update code

  types$1.parenR.updateContext = types$1.braceR.updateContext = function() {
    if (this.context.length === 1) {
      this.exprAllowed = true;
      return
    }
    var out = this.context.pop();
    if (out === types.b_stat && this.curContext().token === "function") {
      out = this.context.pop();
    }
    this.exprAllowed = !out.isExpr;
  };

  types$1.braceL.updateContext = function(prevType) {
    this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
    this.exprAllowed = true;
  };

  types$1.dollarBraceL.updateContext = function() {
    this.context.push(types.b_tmpl);
    this.exprAllowed = true;
  };

  types$1.parenL.updateContext = function(prevType) {
    var statementParens = prevType === types$1._if || prevType === types$1._for || prevType === types$1._with || prevType === types$1._while;
    this.context.push(statementParens ? types.p_stat : types.p_expr);
    this.exprAllowed = true;
  };

  types$1.incDec.updateContext = function() {
    // tokExprAllowed stays unchanged
  };

  types$1._function.updateContext = types$1._class.updateContext = function(prevType) {
    if (prevType.beforeExpr && prevType !== types$1._else &&
        !(prevType === types$1.semi && this.curContext() !== types.p_stat) &&
        !(prevType === types$1._return && lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) &&
        !((prevType === types$1.colon || prevType === types$1.braceL) && this.curContext() === types.b_stat))
      { this.context.push(types.f_expr); }
    else
      { this.context.push(types.f_stat); }
    this.exprAllowed = false;
  };

  types$1.backQuote.updateContext = function() {
    if (this.curContext() === types.q_tmpl)
      { this.context.pop(); }
    else
      { this.context.push(types.q_tmpl); }
    this.exprAllowed = false;
  };

  types$1.star.updateContext = function(prevType) {
    if (prevType === types$1._function) {
      var index = this.context.length - 1;
      if (this.context[index] === types.f_expr)
        { this.context[index] = types.f_expr_gen; }
      else
        { this.context[index] = types.f_gen; }
    }
    this.exprAllowed = true;
  };

  types$1.name.updateContext = function(prevType) {
    var allowed = false;
    if (this.options.ecmaVersion >= 6 && prevType !== types$1.dot) {
      if (this.value === "of" && !this.exprAllowed ||
          this.value === "yield" && this.inGeneratorContext())
        { allowed = true; }
    }
    this.exprAllowed = allowed;
  };

  // A recursive descent parser operates by defining functions for all
  // syntactic elements, and recursively calling those, each function
  // advancing the input stream and returning an AST node. Precedence
  // of constructs (for example, the fact that `!x[1]` means `!(x[1])`
  // instead of `(!x)[1]` is handled by the fact that the parser
  // function that parses unary prefix operators is called first, and
  // in turn calls the function that parses `[]` subscripts — that
  // way, it'll receive the node for `x[1]` already parsed, and wraps
  // *that* in the unary operator node.
  //
  // Acorn uses an [operator precedence parser][opp] to handle binary
  // operator precedence, because it is much more compact than using
  // the technique outlined above, which uses different, nesting
  // functions to specify precedence, for all of the ten binary
  // precedence levels that JavaScript defines.
  //
  // [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser


  var pp$5 = Parser.prototype;

  // Check if property name clashes with already added.
  // Object/class getters and setters are not allowed to clash —
  // either with each other or with an init property — and in
  // strict mode, init properties are also not allowed to be repeated.

  pp$5.checkPropClash = function(prop, propHash, refDestructuringErrors) {
    if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement")
      { return }
    if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand))
      { return }
    var key = prop.key;
    var name;
    switch (key.type) {
    case "Identifier": name = key.name; break
    case "Literal": name = String(key.value); break
    default: return
    }
    var kind = prop.kind;
    if (this.options.ecmaVersion >= 6) {
      if (name === "__proto__" && kind === "init") {
        if (propHash.proto) {
          if (refDestructuringErrors) {
            if (refDestructuringErrors.doubleProto < 0) {
              refDestructuringErrors.doubleProto = key.start;
            }
          } else {
            this.raiseRecoverable(key.start, "Redefinition of __proto__ property");
          }
        }
        propHash.proto = true;
      }
      return
    }
    name = "$" + name;
    var other = propHash[name];
    if (other) {
      var redefinition;
      if (kind === "init") {
        redefinition = this.strict && other.init || other.get || other.set;
      } else {
        redefinition = other.init || other[kind];
      }
      if (redefinition)
        { this.raiseRecoverable(key.start, "Redefinition of property"); }
    } else {
      other = propHash[name] = {
        init: false,
        get: false,
        set: false
      };
    }
    other[kind] = true;
  };

  // ### Expression parsing

  // These nest, from the most general expression type at the top to
  // 'atomic', nondivisible expression types at the bottom. Most of
  // the functions will simply let the function(s) below them parse,
  // and, *if* the syntactic construct they handle is present, wrap
  // the AST node that the inner parser gave them in another node.

  // Parse a full expression. The optional arguments are used to
  // forbid the `in` operator (in for loops initalization expressions)
  // and provide reference for storing '=' operator inside shorthand
  // property assignment in contexts where both object expression
  // and object pattern might appear (so it's possible to raise
  // delayed syntax error at correct position).

  pp$5.parseExpression = function(forInit, refDestructuringErrors) {
    var startPos = this.start, startLoc = this.startLoc;
    var expr = this.parseMaybeAssign(forInit, refDestructuringErrors);
    if (this.type === types$1.comma) {
      var node = this.startNodeAt(startPos, startLoc);
      node.expressions = [expr];
      while (this.eat(types$1.comma)) { node.expressions.push(this.parseMaybeAssign(forInit, refDestructuringErrors)); }
      return this.finishNode(node, "SequenceExpression")
    }
    return expr
  };

  // Parse an assignment expression. This includes applications of
  // operators like `+=`.

  pp$5.parseMaybeAssign = function(forInit, refDestructuringErrors, afterLeftParse) {
    if (this.isContextual("yield")) {
      if (this.inGenerator) { return this.parseYield(forInit) }
      // The tokenizer will assume an expression is allowed after
      // `yield`, but this isn't that kind of yield
      else { this.exprAllowed = false; }
    }

    var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1, oldDoubleProto = -1;
    if (refDestructuringErrors) {
      oldParenAssign = refDestructuringErrors.parenthesizedAssign;
      oldTrailingComma = refDestructuringErrors.trailingComma;
      oldDoubleProto = refDestructuringErrors.doubleProto;
      refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
    } else {
      refDestructuringErrors = new DestructuringErrors;
      ownDestructuringErrors = true;
    }

    var startPos = this.start, startLoc = this.startLoc;
    if (this.type === types$1.parenL || this.type === types$1.name) {
      this.potentialArrowAt = this.start;
      this.potentialArrowInForAwait = forInit === "await";
    }
    var left = this.parseMaybeConditional(forInit, refDestructuringErrors);
    if (afterLeftParse) { left = afterLeftParse.call(this, left, startPos, startLoc); }
    if (this.type.isAssign) {
      var node = this.startNodeAt(startPos, startLoc);
      node.operator = this.value;
      if (this.type === types$1.eq)
        { left = this.toAssignable(left, false, refDestructuringErrors); }
      if (!ownDestructuringErrors) {
        refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;
      }
      if (refDestructuringErrors.shorthandAssign >= left.start)
        { refDestructuringErrors.shorthandAssign = -1; } // reset because shorthand default was used correctly
      if (this.type === types$1.eq)
        { this.checkLValPattern(left); }
      else
        { this.checkLValSimple(left); }
      node.left = left;
      this.next();
      node.right = this.parseMaybeAssign(forInit);
      if (oldDoubleProto > -1) { refDestructuringErrors.doubleProto = oldDoubleProto; }
      return this.finishNode(node, "AssignmentExpression")
    } else {
      if (ownDestructuringErrors) { this.checkExpressionErrors(refDestructuringErrors, true); }
    }
    if (oldParenAssign > -1) { refDestructuringErrors.parenthesizedAssign = oldParenAssign; }
    if (oldTrailingComma > -1) { refDestructuringErrors.trailingComma = oldTrailingComma; }
    return left
  };

  // Parse a ternary conditional (`?:`) operator.

  pp$5.parseMaybeConditional = function(forInit, refDestructuringErrors) {
    var startPos = this.start, startLoc = this.startLoc;
    var expr = this.parseExprOps(forInit, refDestructuringErrors);
    if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
    if (this.eat(types$1.question)) {
      var node = this.startNodeAt(startPos, startLoc);
      node.test = expr;
      node.consequent = this.parseMaybeAssign();
      this.expect(types$1.colon);
      node.alternate = this.parseMaybeAssign(forInit);
      return this.finishNode(node, "ConditionalExpression")
    }
    return expr
  };

  // Start the precedence parser.

  pp$5.parseExprOps = function(forInit, refDestructuringErrors) {
    var startPos = this.start, startLoc = this.startLoc;
    var expr = this.parseMaybeUnary(refDestructuringErrors, false, false, forInit);
    if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
    return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, forInit)
  };

  // Parse binary operators with the operator precedence parsing
  // algorithm. `left` is the left-hand side of the operator.
  // `minPrec` provides context that allows the function to stop and
  // defer further parser to one of its callers when it encounters an
  // operator that has a lower precedence than the set it is parsing.

  pp$5.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, forInit) {
    var prec = this.type.binop;
    if (prec != null && (!forInit || this.type !== types$1._in)) {
      if (prec > minPrec) {
        var logical = this.type === types$1.logicalOR || this.type === types$1.logicalAND;
        var coalesce = this.type === types$1.coalesce;
        if (coalesce) {
          // Handle the precedence of `tt.coalesce` as equal to the range of logical expressions.
          // In other words, `node.right` shouldn't contain logical expressions in order to check the mixed error.
          prec = types$1.logicalAND.binop;
        }
        var op = this.value;
        this.next();
        var startPos = this.start, startLoc = this.startLoc;
        var right = this.parseExprOp(this.parseMaybeUnary(null, false, false, forInit), startPos, startLoc, prec, forInit);
        var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical || coalesce);
        if ((logical && this.type === types$1.coalesce) || (coalesce && (this.type === types$1.logicalOR || this.type === types$1.logicalAND))) {
          this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses");
        }
        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, forInit)
      }
    }
    return left
  };

  pp$5.buildBinary = function(startPos, startLoc, left, right, op, logical) {
    if (right.type === "PrivateIdentifier") { this.raise(right.start, "Private identifier can only be left side of binary expression"); }
    var node = this.startNodeAt(startPos, startLoc);
    node.left = left;
    node.operator = op;
    node.right = right;
    return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression")
  };

  // Parse unary operators, both prefix and postfix.

  pp$5.parseMaybeUnary = function(refDestructuringErrors, sawUnary, incDec, forInit) {
    var startPos = this.start, startLoc = this.startLoc, expr;
    if (this.isContextual("await") && this.canAwait) {
      expr = this.parseAwait(forInit);
      sawUnary = true;
    } else if (this.type.prefix) {
      var node = this.startNode(), update = this.type === types$1.incDec;
      node.operator = this.value;
      node.prefix = true;
      this.next();
      node.argument = this.parseMaybeUnary(null, true, update, forInit);
      this.checkExpressionErrors(refDestructuringErrors, true);
      if (update) { this.checkLValSimple(node.argument); }
      else if (this.strict && node.operator === "delete" &&
               node.argument.type === "Identifier")
        { this.raiseRecoverable(node.start, "Deleting local variable in strict mode"); }
      else if (node.operator === "delete" && isPrivateFieldAccess(node.argument))
        { this.raiseRecoverable(node.start, "Private fields can not be deleted"); }
      else { sawUnary = true; }
      expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
    } else if (!sawUnary && this.type === types$1.privateId) {
      if ((forInit || this.privateNameStack.length === 0) && this.options.checkPrivateFields) { this.unexpected(); }
      expr = this.parsePrivateIdent();
      // only could be private fields in 'in', such as #x in obj
      if (this.type !== types$1._in) { this.unexpected(); }
    } else {
      expr = this.parseExprSubscripts(refDestructuringErrors, forInit);
      if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
      while (this.type.postfix && !this.canInsertSemicolon()) {
        var node$1 = this.startNodeAt(startPos, startLoc);
        node$1.operator = this.value;
        node$1.prefix = false;
        node$1.argument = expr;
        this.checkLValSimple(expr);
        this.next();
        expr = this.finishNode(node$1, "UpdateExpression");
      }
    }

    if (!incDec && this.eat(types$1.starstar)) {
      if (sawUnary)
        { this.unexpected(this.lastTokStart); }
      else
        { return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false, false, forInit), "**", false) }
    } else {
      return expr
    }
  };

  function isPrivateFieldAccess(node) {
    return (
      node.type === "MemberExpression" && node.property.type === "PrivateIdentifier" ||
      node.type === "ChainExpression" && isPrivateFieldAccess(node.expression)
    )
  }

  // Parse call, dot, and `[]`-subscript expressions.

  pp$5.parseExprSubscripts = function(refDestructuringErrors, forInit) {
    var startPos = this.start, startLoc = this.startLoc;
    var expr = this.parseExprAtom(refDestructuringErrors, forInit);
    if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")")
      { return expr }
    var result = this.parseSubscripts(expr, startPos, startLoc, false, forInit);
    if (refDestructuringErrors && result.type === "MemberExpression") {
      if (refDestructuringErrors.parenthesizedAssign >= result.start) { refDestructuringErrors.parenthesizedAssign = -1; }
      if (refDestructuringErrors.parenthesizedBind >= result.start) { refDestructuringErrors.parenthesizedBind = -1; }
      if (refDestructuringErrors.trailingComma >= result.start) { refDestructuringErrors.trailingComma = -1; }
    }
    return result
  };

  pp$5.parseSubscripts = function(base, startPos, startLoc, noCalls, forInit) {
    var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" &&
        this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 &&
        this.potentialArrowAt === base.start;
    var optionalChained = false;

    while (true) {
      var element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit);

      if (element.optional) { optionalChained = true; }
      if (element === base || element.type === "ArrowFunctionExpression") {
        if (optionalChained) {
          var chainNode = this.startNodeAt(startPos, startLoc);
          chainNode.expression = element;
          element = this.finishNode(chainNode, "ChainExpression");
        }
        return element
      }

      base = element;
    }
  };

  pp$5.shouldParseAsyncArrow = function() {
    return !this.canInsertSemicolon() && this.eat(types$1.arrow)
  };

  pp$5.parseSubscriptAsyncArrow = function(startPos, startLoc, exprList, forInit) {
    return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true, forInit)
  };

  pp$5.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
    var optionalSupported = this.options.ecmaVersion >= 11;
    var optional = optionalSupported && this.eat(types$1.questionDot);
    if (noCalls && optional) { this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions"); }

    var computed = this.eat(types$1.bracketL);
    if (computed || (optional && this.type !== types$1.parenL && this.type !== types$1.backQuote) || this.eat(types$1.dot)) {
      var node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      if (computed) {
        node.property = this.parseExpression();
        this.expect(types$1.bracketR);
      } else if (this.type === types$1.privateId && base.type !== "Super") {
        node.property = this.parsePrivateIdent();
      } else {
        node.property = this.parseIdent(this.options.allowReserved !== "never");
      }
      node.computed = !!computed;
      if (optionalSupported) {
        node.optional = optional;
      }
      base = this.finishNode(node, "MemberExpression");
    } else if (!noCalls && this.eat(types$1.parenL)) {
      var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
      this.yieldPos = 0;
      this.awaitPos = 0;
      this.awaitIdentPos = 0;
      var exprList = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
      if (maybeAsyncArrow && !optional && this.shouldParseAsyncArrow()) {
        this.checkPatternErrors(refDestructuringErrors, false);
        this.checkYieldAwaitInDefaultParams();
        if (this.awaitIdentPos > 0)
          { this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function"); }
        this.yieldPos = oldYieldPos;
        this.awaitPos = oldAwaitPos;
        this.awaitIdentPos = oldAwaitIdentPos;
        return this.parseSubscriptAsyncArrow(startPos, startLoc, exprList, forInit)
      }
      this.checkExpressionErrors(refDestructuringErrors, true);
      this.yieldPos = oldYieldPos || this.yieldPos;
      this.awaitPos = oldAwaitPos || this.awaitPos;
      this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
      var node$1 = this.startNodeAt(startPos, startLoc);
      node$1.callee = base;
      node$1.arguments = exprList;
      if (optionalSupported) {
        node$1.optional = optional;
      }
      base = this.finishNode(node$1, "CallExpression");
    } else if (this.type === types$1.backQuote) {
      if (optional || optionalChained) {
        this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
      }
      var node$2 = this.startNodeAt(startPos, startLoc);
      node$2.tag = base;
      node$2.quasi = this.parseTemplate({isTagged: true});
      base = this.finishNode(node$2, "TaggedTemplateExpression");
    }
    return base
  };

  // Parse an atomic expression — either a single token that is an
  // expression, an expression started by a keyword like `function` or
  // `new`, or an expression wrapped in punctuation like `()`, `[]`,
  // or `{}`.

  pp$5.parseExprAtom = function(refDestructuringErrors, forInit, forNew) {
    // If a division operator appears in an expression position, the
    // tokenizer got confused, and we force it to read a regexp instead.
    if (this.type === types$1.slash) { this.readRegexp(); }

    var node, canBeArrow = this.potentialArrowAt === this.start;
    switch (this.type) {
    case types$1._super:
      if (!this.allowSuper)
        { this.raise(this.start, "'super' keyword outside a method"); }
      node = this.startNode();
      this.next();
      if (this.type === types$1.parenL && !this.allowDirectSuper)
        { this.raise(node.start, "super() call outside constructor of a subclass"); }
      // The `super` keyword can appear at below:
      // SuperProperty:
      //     super [ Expression ]
      //     super . IdentifierName
      // SuperCall:
      //     super ( Arguments )
      if (this.type !== types$1.dot && this.type !== types$1.bracketL && this.type !== types$1.parenL)
        { this.unexpected(); }
      return this.finishNode(node, "Super")

    case types$1._this:
      node = this.startNode();
      this.next();
      return this.finishNode(node, "ThisExpression")

    case types$1.name:
      var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
      var id = this.parseIdent(false);
      if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(types$1._function)) {
        this.overrideContext(types.f_expr);
        return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true, forInit)
      }
      if (canBeArrow && !this.canInsertSemicolon()) {
        if (this.eat(types$1.arrow))
          { return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false, forInit) }
        if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === types$1.name && !containsEsc &&
            (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) {
          id = this.parseIdent(false);
          if (this.canInsertSemicolon() || !this.eat(types$1.arrow))
            { this.unexpected(); }
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true, forInit)
        }
      }
      return id

    case types$1.regexp:
      var value = this.value;
      node = this.parseLiteral(value.value);
      node.regex = {pattern: value.pattern, flags: value.flags};
      return node

    case types$1.num: case types$1.string:
      return this.parseLiteral(this.value)

    case types$1._null: case types$1._true: case types$1._false:
      node = this.startNode();
      node.value = this.type === types$1._null ? null : this.type === types$1._true;
      node.raw = this.type.keyword;
      this.next();
      return this.finishNode(node, "Literal")

    case types$1.parenL:
      var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow, forInit);
      if (refDestructuringErrors) {
        if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr))
          { refDestructuringErrors.parenthesizedAssign = start; }
        if (refDestructuringErrors.parenthesizedBind < 0)
          { refDestructuringErrors.parenthesizedBind = start; }
      }
      return expr

    case types$1.bracketL:
      node = this.startNode();
      this.next();
      node.elements = this.parseExprList(types$1.bracketR, true, true, refDestructuringErrors);
      return this.finishNode(node, "ArrayExpression")

    case types$1.braceL:
      this.overrideContext(types.b_expr);
      return this.parseObj(false, refDestructuringErrors)

    case types$1._function:
      node = this.startNode();
      this.next();
      return this.parseFunction(node, 0)

    case types$1._class:
      return this.parseClass(this.startNode(), false)

    case types$1._new:
      return this.parseNew()

    case types$1.backQuote:
      return this.parseTemplate()

    case types$1._import:
      if (this.options.ecmaVersion >= 11) {
        return this.parseExprImport(forNew)
      } else {
        return this.unexpected()
      }

    default:
      return this.parseExprAtomDefault()
    }
  };

  pp$5.parseExprAtomDefault = function() {
    this.unexpected();
  };

  pp$5.parseExprImport = function(forNew) {
    var node = this.startNode();

    // Consume `import` as an identifier for `import.meta`.
    // Because `this.parseIdent(true)` doesn't check escape sequences, it needs the check of `this.containsEsc`.
    if (this.containsEsc) { this.raiseRecoverable(this.start, "Escape sequence in keyword import"); }
    var meta = this.parseIdent(true);

    if (this.type === types$1.parenL && !forNew) {
      return this.parseDynamicImport(node)
    } else if (this.type === types$1.dot) {
      node.meta = meta;
      return this.parseImportMeta(node)
    } else {
      this.unexpected();
    }
  };

  pp$5.parseDynamicImport = function(node) {
    this.next(); // skip `(`

    // Parse node.source.
    node.source = this.parseMaybeAssign();

    // Verify ending.
    if (!this.eat(types$1.parenR)) {
      var errorPos = this.start;
      if (this.eat(types$1.comma) && this.eat(types$1.parenR)) {
        this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
      } else {
        this.unexpected(errorPos);
      }
    }

    return this.finishNode(node, "ImportExpression")
  };

  pp$5.parseImportMeta = function(node) {
    this.next(); // skip `.`

    var containsEsc = this.containsEsc;
    node.property = this.parseIdent(true);

    if (node.property.name !== "meta")
      { this.raiseRecoverable(node.property.start, "The only valid meta property for import is 'import.meta'"); }
    if (containsEsc)
      { this.raiseRecoverable(node.start, "'import.meta' must not contain escaped characters"); }
    if (this.options.sourceType !== "module" && !this.options.allowImportExportEverywhere)
      { this.raiseRecoverable(node.start, "Cannot use 'import.meta' outside a module"); }

    return this.finishNode(node, "MetaProperty")
  };

  pp$5.parseLiteral = function(value) {
    var node = this.startNode();
    node.value = value;
    node.raw = this.input.slice(this.start, this.end);
    if (node.raw.charCodeAt(node.raw.length - 1) === 110) { node.bigint = node.raw.slice(0, -1).replace(/_/g, ""); }
    this.next();
    return this.finishNode(node, "Literal")
  };

  pp$5.parseParenExpression = function() {
    this.expect(types$1.parenL);
    var val = this.parseExpression();
    this.expect(types$1.parenR);
    return val
  };

  pp$5.shouldParseArrow = function(exprList) {
    return !this.canInsertSemicolon()
  };

  pp$5.parseParenAndDistinguishExpression = function(canBeArrow, forInit) {
    var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
    if (this.options.ecmaVersion >= 6) {
      this.next();

      var innerStartPos = this.start, innerStartLoc = this.startLoc;
      var exprList = [], first = true, lastIsComma = false;
      var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
      this.yieldPos = 0;
      this.awaitPos = 0;
      // Do not save awaitIdentPos to allow checking awaits nested in parameters
      while (this.type !== types$1.parenR) {
        first ? first = false : this.expect(types$1.comma);
        if (allowTrailingComma && this.afterTrailingComma(types$1.parenR, true)) {
          lastIsComma = true;
          break
        } else if (this.type === types$1.ellipsis) {
          spreadStart = this.start;
          exprList.push(this.parseParenItem(this.parseRestBinding()));
          if (this.type === types$1.comma) {
            this.raiseRecoverable(
              this.start,
              "Comma is not permitted after the rest element"
            );
          }
          break
        } else {
          exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
        }
      }
      var innerEndPos = this.lastTokEnd, innerEndLoc = this.lastTokEndLoc;
      this.expect(types$1.parenR);

      if (canBeArrow && this.shouldParseArrow(exprList) && this.eat(types$1.arrow)) {
        this.checkPatternErrors(refDestructuringErrors, false);
        this.checkYieldAwaitInDefaultParams();
        this.yieldPos = oldYieldPos;
        this.awaitPos = oldAwaitPos;
        return this.parseParenArrowList(startPos, startLoc, exprList, forInit)
      }

      if (!exprList.length || lastIsComma) { this.unexpected(this.lastTokStart); }
      if (spreadStart) { this.unexpected(spreadStart); }
      this.checkExpressionErrors(refDestructuringErrors, true);
      this.yieldPos = oldYieldPos || this.yieldPos;
      this.awaitPos = oldAwaitPos || this.awaitPos;

      if (exprList.length > 1) {
        val = this.startNodeAt(innerStartPos, innerStartLoc);
        val.expressions = exprList;
        this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
      } else {
        val = exprList[0];
      }
    } else {
      val = this.parseParenExpression();
    }

    if (this.options.preserveParens) {
      var par = this.startNodeAt(startPos, startLoc);
      par.expression = val;
      return this.finishNode(par, "ParenthesizedExpression")
    } else {
      return val
    }
  };

  pp$5.parseParenItem = function(item) {
    return item
  };

  pp$5.parseParenArrowList = function(startPos, startLoc, exprList, forInit) {
    return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, false, forInit)
  };

  // New's precedence is slightly tricky. It must allow its argument to
  // be a `[]` or dot subscript expression, but not a call — at least,
  // not without wrapping it in parentheses. Thus, it uses the noCalls
  // argument to parseSubscripts to prevent it from consuming the
  // argument list.

  var empty = [];

  pp$5.parseNew = function() {
    if (this.containsEsc) { this.raiseRecoverable(this.start, "Escape sequence in keyword new"); }
    var node = this.startNode();
    var meta = this.parseIdent(true);
    if (this.options.ecmaVersion >= 6 && this.eat(types$1.dot)) {
      node.meta = meta;
      var containsEsc = this.containsEsc;
      node.property = this.parseIdent(true);
      if (node.property.name !== "target")
        { this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'"); }
      if (containsEsc)
        { this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters"); }
      if (!this.allowNewDotTarget)
        { this.raiseRecoverable(node.start, "'new.target' can only be used in functions and class static block"); }
      return this.finishNode(node, "MetaProperty")
    }
    var startPos = this.start, startLoc = this.startLoc;
    node.callee = this.parseSubscripts(this.parseExprAtom(null, false, true), startPos, startLoc, true, false);
    if (this.eat(types$1.parenL)) { node.arguments = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false); }
    else { node.arguments = empty; }
    return this.finishNode(node, "NewExpression")
  };

  // Parse template expression.

  pp$5.parseTemplateElement = function(ref) {
    var isTagged = ref.isTagged;

    var elem = this.startNode();
    if (this.type === types$1.invalidTemplate) {
      if (!isTagged) {
        this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
      }
      elem.value = {
        raw: this.value,
        cooked: null
      };
    } else {
      elem.value = {
        raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
        cooked: this.value
      };
    }
    this.next();
    elem.tail = this.type === types$1.backQuote;
    return this.finishNode(elem, "TemplateElement")
  };

  pp$5.parseTemplate = function(ref) {
    if ( ref === void 0 ) ref = {};
    var isTagged = ref.isTagged; if ( isTagged === void 0 ) isTagged = false;

    var node = this.startNode();
    this.next();
    node.expressions = [];
    var curElt = this.parseTemplateElement({isTagged: isTagged});
    node.quasis = [curElt];
    while (!curElt.tail) {
      if (this.type === types$1.eof) { this.raise(this.pos, "Unterminated template literal"); }
      this.expect(types$1.dollarBraceL);
      node.expressions.push(this.parseExpression());
      this.expect(types$1.braceR);
      node.quasis.push(curElt = this.parseTemplateElement({isTagged: isTagged}));
    }
    this.next();
    return this.finishNode(node, "TemplateLiteral")
  };

  pp$5.isAsyncProp = function(prop) {
    return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" &&
      (this.type === types$1.name || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword || (this.options.ecmaVersion >= 9 && this.type === types$1.star)) &&
      !lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
  };

  // Parse an object literal or binding pattern.

  pp$5.parseObj = function(isPattern, refDestructuringErrors) {
    var node = this.startNode(), first = true, propHash = {};
    node.properties = [];
    this.next();
    while (!this.eat(types$1.braceR)) {
      if (!first) {
        this.expect(types$1.comma);
        if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types$1.braceR)) { break }
      } else { first = false; }

      var prop = this.parseProperty(isPattern, refDestructuringErrors);
      if (!isPattern) { this.checkPropClash(prop, propHash, refDestructuringErrors); }
      node.properties.push(prop);
    }
    return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression")
  };

  pp$5.parseProperty = function(isPattern, refDestructuringErrors) {
    var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
    if (this.options.ecmaVersion >= 9 && this.eat(types$1.ellipsis)) {
      if (isPattern) {
        prop.argument = this.parseIdent(false);
        if (this.type === types$1.comma) {
          this.raiseRecoverable(this.start, "Comma is not permitted after the rest element");
        }
        return this.finishNode(prop, "RestElement")
      }
      // Parse argument.
      prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
      // To disallow trailing comma via `this.toAssignable()`.
      if (this.type === types$1.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
        refDestructuringErrors.trailingComma = this.start;
      }
      // Finish
      return this.finishNode(prop, "SpreadElement")
    }
    if (this.options.ecmaVersion >= 6) {
      prop.method = false;
      prop.shorthand = false;
      if (isPattern || refDestructuringErrors) {
        startPos = this.start;
        startLoc = this.startLoc;
      }
      if (!isPattern)
        { isGenerator = this.eat(types$1.star); }
    }
    var containsEsc = this.containsEsc;
    this.parsePropertyName(prop);
    if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
      isAsync = true;
      isGenerator = this.options.ecmaVersion >= 9 && this.eat(types$1.star);
      this.parsePropertyName(prop);
    } else {
      isAsync = false;
    }
    this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
    return this.finishNode(prop, "Property")
  };

  pp$5.parseGetterSetter = function(prop) {
    prop.kind = prop.key.name;
    this.parsePropertyName(prop);
    prop.value = this.parseMethod(false);
    var paramCount = prop.kind === "get" ? 0 : 1;
    if (prop.value.params.length !== paramCount) {
      var start = prop.value.start;
      if (prop.kind === "get")
        { this.raiseRecoverable(start, "getter should have no params"); }
      else
        { this.raiseRecoverable(start, "setter should have exactly one param"); }
    } else {
      if (prop.kind === "set" && prop.value.params[0].type === "RestElement")
        { this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params"); }
    }
  };

  pp$5.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
    if ((isGenerator || isAsync) && this.type === types$1.colon)
      { this.unexpected(); }

    if (this.eat(types$1.colon)) {
      prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
      prop.kind = "init";
    } else if (this.options.ecmaVersion >= 6 && this.type === types$1.parenL) {
      if (isPattern) { this.unexpected(); }
      prop.kind = "init";
      prop.method = true;
      prop.value = this.parseMethod(isGenerator, isAsync);
    } else if (!isPattern && !containsEsc &&
               this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" &&
               (prop.key.name === "get" || prop.key.name === "set") &&
               (this.type !== types$1.comma && this.type !== types$1.braceR && this.type !== types$1.eq)) {
      if (isGenerator || isAsync) { this.unexpected(); }
      this.parseGetterSetter(prop);
    } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
      if (isGenerator || isAsync) { this.unexpected(); }
      this.checkUnreserved(prop.key);
      if (prop.key.name === "await" && !this.awaitIdentPos)
        { this.awaitIdentPos = startPos; }
      prop.kind = "init";
      if (isPattern) {
        prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
      } else if (this.type === types$1.eq && refDestructuringErrors) {
        if (refDestructuringErrors.shorthandAssign < 0)
          { refDestructuringErrors.shorthandAssign = this.start; }
        prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
      } else {
        prop.value = this.copyNode(prop.key);
      }
      prop.shorthand = true;
    } else { this.unexpected(); }
  };

  pp$5.parsePropertyName = function(prop) {
    if (this.options.ecmaVersion >= 6) {
      if (this.eat(types$1.bracketL)) {
        prop.computed = true;
        prop.key = this.parseMaybeAssign();
        this.expect(types$1.bracketR);
        return prop.key
      } else {
        prop.computed = false;
      }
    }
    return prop.key = this.type === types$1.num || this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never")
  };

  // Initialize empty function node.

  pp$5.initFunction = function(node) {
    node.id = null;
    if (this.options.ecmaVersion >= 6) { node.generator = node.expression = false; }
    if (this.options.ecmaVersion >= 8) { node.async = false; }
  };

  // Parse object or class method.

  pp$5.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
    var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;

    this.initFunction(node);
    if (this.options.ecmaVersion >= 6)
      { node.generator = isGenerator; }
    if (this.options.ecmaVersion >= 8)
      { node.async = !!isAsync; }

    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));

    this.expect(types$1.parenL);
    node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
    this.checkYieldAwaitInDefaultParams();
    this.parseFunctionBody(node, false, true, false);

    this.yieldPos = oldYieldPos;
    this.awaitPos = oldAwaitPos;
    this.awaitIdentPos = oldAwaitIdentPos;
    return this.finishNode(node, "FunctionExpression")
  };

  // Parse arrow function expression with given parameters.

  pp$5.parseArrowExpression = function(node, params, isAsync, forInit) {
    var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;

    this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);
    this.initFunction(node);
    if (this.options.ecmaVersion >= 8) { node.async = !!isAsync; }

    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;

    node.params = this.toAssignableList(params, true);
    this.parseFunctionBody(node, true, false, forInit);

    this.yieldPos = oldYieldPos;
    this.awaitPos = oldAwaitPos;
    this.awaitIdentPos = oldAwaitIdentPos;
    return this.finishNode(node, "ArrowFunctionExpression")
  };

  // Parse function body and check parameters.

  pp$5.parseFunctionBody = function(node, isArrowFunction, isMethod, forInit) {
    var isExpression = isArrowFunction && this.type !== types$1.braceL;
    var oldStrict = this.strict, useStrict = false;

    if (isExpression) {
      node.body = this.parseMaybeAssign(forInit);
      node.expression = true;
      this.checkParams(node, false);
    } else {
      var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
      if (!oldStrict || nonSimple) {
        useStrict = this.strictDirective(this.end);
        // If this is a strict mode function, verify that argument names
        // are not repeated, and it does not try to bind the words `eval`
        // or `arguments`.
        if (useStrict && nonSimple)
          { this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list"); }
      }
      // Start a new scope with regard to labels and the `inFunction`
      // flag (restore them to their old value afterwards).
      var oldLabels = this.labels;
      this.labels = [];
      if (useStrict) { this.strict = true; }

      // Add the params to varDeclaredNames to ensure that an error is thrown
      // if a let/const declaration in the function clashes with one of the params.
      this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
      // Ensure the function name isn't a forbidden identifier in strict mode, e.g. 'eval'
      if (this.strict && node.id) { this.checkLValSimple(node.id, BIND_OUTSIDE); }
      node.body = this.parseBlock(false, undefined, useStrict && !oldStrict);
      node.expression = false;
      this.adaptDirectivePrologue(node.body.body);
      this.labels = oldLabels;
    }
    this.exitScope();
  };

  pp$5.isSimpleParamList = function(params) {
    for (var i = 0, list = params; i < list.length; i += 1)
      {
      var param = list[i];

      if (param.type !== "Identifier") { return false
    } }
    return true
  };

  // Checks function params for various disallowed patterns such as using "eval"
  // or "arguments" and duplicate parameters.

  pp$5.checkParams = function(node, allowDuplicates) {
    var nameHash = Object.create(null);
    for (var i = 0, list = node.params; i < list.length; i += 1)
      {
      var param = list[i];

      this.checkLValInnerPattern(param, BIND_VAR, allowDuplicates ? null : nameHash);
    }
  };

  // Parses a comma-separated list of expressions, and returns them as
  // an array. `close` is the token type that ends the list, and
  // `allowEmpty` can be turned on to allow subsequent commas with
  // nothing in between them to be parsed as `null` (which is needed
  // for array literals).

  pp$5.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
    var elts = [], first = true;
    while (!this.eat(close)) {
      if (!first) {
        this.expect(types$1.comma);
        if (allowTrailingComma && this.afterTrailingComma(close)) { break }
      } else { first = false; }

      var elt = (void 0);
      if (allowEmpty && this.type === types$1.comma)
        { elt = null; }
      else if (this.type === types$1.ellipsis) {
        elt = this.parseSpread(refDestructuringErrors);
        if (refDestructuringErrors && this.type === types$1.comma && refDestructuringErrors.trailingComma < 0)
          { refDestructuringErrors.trailingComma = this.start; }
      } else {
        elt = this.parseMaybeAssign(false, refDestructuringErrors);
      }
      elts.push(elt);
    }
    return elts
  };

  pp$5.checkUnreserved = function(ref) {
    var start = ref.start;
    var end = ref.end;
    var name = ref.name;

    if (this.inGenerator && name === "yield")
      { this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator"); }
    if (this.inAsync && name === "await")
      { this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function"); }
    if (this.currentThisScope().inClassFieldInit && name === "arguments")
      { this.raiseRecoverable(start, "Cannot use 'arguments' in class field initializer"); }
    if (this.inClassStaticBlock && (name === "arguments" || name === "await"))
      { this.raise(start, ("Cannot use " + name + " in class static initialization block")); }
    if (this.keywords.test(name))
      { this.raise(start, ("Unexpected keyword '" + name + "'")); }
    if (this.options.ecmaVersion < 6 &&
      this.input.slice(start, end).indexOf("\\") !== -1) { return }
    var re = this.strict ? this.reservedWordsStrict : this.reservedWords;
    if (re.test(name)) {
      if (!this.inAsync && name === "await")
        { this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function"); }
      this.raiseRecoverable(start, ("The keyword '" + name + "' is reserved"));
    }
  };

  // Parse the next token as an identifier. If `liberal` is true (used
  // when parsing properties), it will also convert keywords into
  // identifiers.

  pp$5.parseIdent = function(liberal) {
    var node = this.parseIdentNode();
    this.next(!!liberal);
    this.finishNode(node, "Identifier");
    if (!liberal) {
      this.checkUnreserved(node);
      if (node.name === "await" && !this.awaitIdentPos)
        { this.awaitIdentPos = node.start; }
    }
    return node
  };

  pp$5.parseIdentNode = function() {
    var node = this.startNode();
    if (this.type === types$1.name) {
      node.name = this.value;
    } else if (this.type.keyword) {
      node.name = this.type.keyword;

      // To fix https://github.com/acornjs/acorn/issues/575
      // `class` and `function` keywords push new context into this.context.
      // But there is no chance to pop the context if the keyword is consumed as an identifier such as a property name.
      // If the previous token is a dot, this does not apply because the context-managing code already ignored the keyword
      if ((node.name === "class" || node.name === "function") &&
        (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
        this.context.pop();
      }
    } else {
      this.unexpected();
    }
    return node
  };

  pp$5.parsePrivateIdent = function() {
    var node = this.startNode();
    if (this.type === types$1.privateId) {
      node.name = this.value;
    } else {
      this.unexpected();
    }
    this.next();
    this.finishNode(node, "PrivateIdentifier");

    // For validating existence
    if (this.options.checkPrivateFields) {
      if (this.privateNameStack.length === 0) {
        this.raise(node.start, ("Private field '#" + (node.name) + "' must be declared in an enclosing class"));
      } else {
        this.privateNameStack[this.privateNameStack.length - 1].used.push(node);
      }
    }

    return node
  };

  // Parses yield expression inside generator.

  pp$5.parseYield = function(forInit) {
    if (!this.yieldPos) { this.yieldPos = this.start; }

    var node = this.startNode();
    this.next();
    if (this.type === types$1.semi || this.canInsertSemicolon() || (this.type !== types$1.star && !this.type.startsExpr)) {
      node.delegate = false;
      node.argument = null;
    } else {
      node.delegate = this.eat(types$1.star);
      node.argument = this.parseMaybeAssign(forInit);
    }
    return this.finishNode(node, "YieldExpression")
  };

  pp$5.parseAwait = function(forInit) {
    if (!this.awaitPos) { this.awaitPos = this.start; }

    var node = this.startNode();
    this.next();
    node.argument = this.parseMaybeUnary(null, true, false, forInit);
    return this.finishNode(node, "AwaitExpression")
  };

  var pp$4 = Parser.prototype;

  // This function is used to raise exceptions on parse errors. It
  // takes an offset integer (into the current `input`) to indicate
  // the location of the error, attaches the position to the end
  // of the error message, and then raises a `SyntaxError` with that
  // message.

  pp$4.raise = function(pos, message) {
    var loc = getLineInfo(this.input, pos);
    message += " (" + loc.line + ":" + loc.column + ")";
    var err = new SyntaxError(message);
    err.pos = pos; err.loc = loc; err.raisedAt = this.pos;
    throw err
  };

  pp$4.raiseRecoverable = pp$4.raise;

  pp$4.curPosition = function() {
    if (this.options.locations) {
      return new Position(this.curLine, this.pos - this.lineStart)
    }
  };

  var pp$3 = Parser.prototype;

  var Scope = function Scope(flags) {
    this.flags = flags;
    // A list of var-declared names in the current lexical scope
    this.var = [];
    // A list of lexically-declared names in the current lexical scope
    this.lexical = [];
    // A list of lexically-declared FunctionDeclaration names in the current lexical scope
    this.functions = [];
    // A switch to disallow the identifier reference 'arguments'
    this.inClassFieldInit = false;
  };

  // The functions in this module keep track of declared variables in the current scope in order to detect duplicate variable names.

  pp$3.enterScope = function(flags) {
    this.scopeStack.push(new Scope(flags));
  };

  pp$3.exitScope = function() {
    this.scopeStack.pop();
  };

  // The spec says:
  // > At the top level of a function, or script, function declarations are
  // > treated like var declarations rather than like lexical declarations.
  pp$3.treatFunctionsAsVarInScope = function(scope) {
    return (scope.flags & SCOPE_FUNCTION) || !this.inModule && (scope.flags & SCOPE_TOP)
  };

  pp$3.declareName = function(name, bindingType, pos) {
    var redeclared = false;
    if (bindingType === BIND_LEXICAL) {
      var scope = this.currentScope();
      redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
      scope.lexical.push(name);
      if (this.inModule && (scope.flags & SCOPE_TOP))
        { delete this.undefinedExports[name]; }
    } else if (bindingType === BIND_SIMPLE_CATCH) {
      var scope$1 = this.currentScope();
      scope$1.lexical.push(name);
    } else if (bindingType === BIND_FUNCTION) {
      var scope$2 = this.currentScope();
      if (this.treatFunctionsAsVar)
        { redeclared = scope$2.lexical.indexOf(name) > -1; }
      else
        { redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1; }
      scope$2.functions.push(name);
    } else {
      for (var i = this.scopeStack.length - 1; i >= 0; --i) {
        var scope$3 = this.scopeStack[i];
        if (scope$3.lexical.indexOf(name) > -1 && !((scope$3.flags & SCOPE_SIMPLE_CATCH) && scope$3.lexical[0] === name) ||
            !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
          redeclared = true;
          break
        }
        scope$3.var.push(name);
        if (this.inModule && (scope$3.flags & SCOPE_TOP))
          { delete this.undefinedExports[name]; }
        if (scope$3.flags & SCOPE_VAR) { break }
      }
    }
    if (redeclared) { this.raiseRecoverable(pos, ("Identifier '" + name + "' has already been declared")); }
  };

  pp$3.checkLocalExport = function(id) {
    // scope.functions must be empty as Module code is always strict.
    if (this.scopeStack[0].lexical.indexOf(id.name) === -1 &&
        this.scopeStack[0].var.indexOf(id.name) === -1) {
      this.undefinedExports[id.name] = id;
    }
  };

  pp$3.currentScope = function() {
    return this.scopeStack[this.scopeStack.length - 1]
  };

  pp$3.currentVarScope = function() {
    for (var i = this.scopeStack.length - 1;; i--) {
      var scope = this.scopeStack[i];
      if (scope.flags & SCOPE_VAR) { return scope }
    }
  };

  // Could be useful for `this`, `new.target`, `super()`, `super.property`, and `super[property]`.
  pp$3.currentThisScope = function() {
    for (var i = this.scopeStack.length - 1;; i--) {
      var scope = this.scopeStack[i];
      if (scope.flags & SCOPE_VAR && !(scope.flags & SCOPE_ARROW)) { return scope }
    }
  };

  var Node = function Node(parser, pos, loc) {
    this.type = "";
    this.start = pos;
    this.end = 0;
    if (parser.options.locations)
      { this.loc = new SourceLocation(parser, loc); }
    if (parser.options.directSourceFile)
      { this.sourceFile = parser.options.directSourceFile; }
    if (parser.options.ranges)
      { this.range = [pos, 0]; }
  };

  // Start an AST node, attaching a start offset.

  var pp$2 = Parser.prototype;

  pp$2.startNode = function() {
    return new Node(this, this.start, this.startLoc)
  };

  pp$2.startNodeAt = function(pos, loc) {
    return new Node(this, pos, loc)
  };

  // Finish an AST node, adding `type` and `end` properties.

  function finishNodeAt(node, type, pos, loc) {
    node.type = type;
    node.end = pos;
    if (this.options.locations)
      { node.loc.end = loc; }
    if (this.options.ranges)
      { node.range[1] = pos; }
    return node
  }

  pp$2.finishNode = function(node, type) {
    return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc)
  };

  // Finish node at given position

  pp$2.finishNodeAt = function(node, type, pos, loc) {
    return finishNodeAt.call(this, node, type, pos, loc)
  };

  pp$2.copyNode = function(node) {
    var newNode = new Node(this, node.start, this.startLoc);
    for (var prop in node) { newNode[prop] = node[prop]; }
    return newNode
  };

  // This file contains Unicode properties extracted from the ECMAScript specification.
  // The lists are extracted like so:
  // $$('#table-binary-unicode-properties > figure > table > tbody > tr > td:nth-child(1) code').map(el => el.innerText)

  // #table-binary-unicode-properties
  var ecma9BinaryProperties = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
  var ecma10BinaryProperties = ecma9BinaryProperties + " Extended_Pictographic";
  var ecma11BinaryProperties = ecma10BinaryProperties;
  var ecma12BinaryProperties = ecma11BinaryProperties + " EBase EComp EMod EPres ExtPict";
  var ecma13BinaryProperties = ecma12BinaryProperties;
  var ecma14BinaryProperties = ecma13BinaryProperties;

  var unicodeBinaryProperties = {
    9: ecma9BinaryProperties,
    10: ecma10BinaryProperties,
    11: ecma11BinaryProperties,
    12: ecma12BinaryProperties,
    13: ecma13BinaryProperties,
    14: ecma14BinaryProperties
  };

  // #table-binary-unicode-properties-of-strings
  var ecma14BinaryPropertiesOfStrings = "Basic_Emoji Emoji_Keycap_Sequence RGI_Emoji_Modifier_Sequence RGI_Emoji_Flag_Sequence RGI_Emoji_Tag_Sequence RGI_Emoji_ZWJ_Sequence RGI_Emoji";

  var unicodeBinaryPropertiesOfStrings = {
    9: "",
    10: "",
    11: "",
    12: "",
    13: "",
    14: ecma14BinaryPropertiesOfStrings
  };

  // #table-unicode-general-category-values
  var unicodeGeneralCategoryValues = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";

  // #table-unicode-script-values
  var ecma9ScriptValues = "Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
  var ecma10ScriptValues = ecma9ScriptValues + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
  var ecma11ScriptValues = ecma10ScriptValues + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
  var ecma12ScriptValues = ecma11ScriptValues + " Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi";
  var ecma13ScriptValues = ecma12ScriptValues + " Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith";
  var ecma14ScriptValues = ecma13ScriptValues + " Hrkt Katakana_Or_Hiragana Kawi Nag_Mundari Nagm Unknown Zzzz";

  var unicodeScriptValues = {
    9: ecma9ScriptValues,
    10: ecma10ScriptValues,
    11: ecma11ScriptValues,
    12: ecma12ScriptValues,
    13: ecma13ScriptValues,
    14: ecma14ScriptValues
  };

  var data = {};
  function buildUnicodeData(ecmaVersion) {
    var d = data[ecmaVersion] = {
      binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion] + " " + unicodeGeneralCategoryValues),
      binaryOfStrings: wordsRegexp(unicodeBinaryPropertiesOfStrings[ecmaVersion]),
      nonBinary: {
        General_Category: wordsRegexp(unicodeGeneralCategoryValues),
        Script: wordsRegexp(unicodeScriptValues[ecmaVersion])
      }
    };
    d.nonBinary.Script_Extensions = d.nonBinary.Script;

    d.nonBinary.gc = d.nonBinary.General_Category;
    d.nonBinary.sc = d.nonBinary.Script;
    d.nonBinary.scx = d.nonBinary.Script_Extensions;
  }

  for (var i = 0, list = [9, 10, 11, 12, 13, 14]; i < list.length; i += 1) {
    var ecmaVersion = list[i];

    buildUnicodeData(ecmaVersion);
  }

  var pp$1 = Parser.prototype;

  var RegExpValidationState = function RegExpValidationState(parser) {
    this.parser = parser;
    this.validFlags = "gim" + (parser.options.ecmaVersion >= 6 ? "uy" : "") + (parser.options.ecmaVersion >= 9 ? "s" : "") + (parser.options.ecmaVersion >= 13 ? "d" : "") + (parser.options.ecmaVersion >= 15 ? "v" : "");
    this.unicodeProperties = data[parser.options.ecmaVersion >= 14 ? 14 : parser.options.ecmaVersion];
    this.source = "";
    this.flags = "";
    this.start = 0;
    this.switchU = false;
    this.switchV = false;
    this.switchN = false;
    this.pos = 0;
    this.lastIntValue = 0;
    this.lastStringValue = "";
    this.lastAssertionIsQuantifiable = false;
    this.numCapturingParens = 0;
    this.maxBackReference = 0;
    this.groupNames = [];
    this.backReferenceNames = [];
  };

  RegExpValidationState.prototype.reset = function reset (start, pattern, flags) {
    var unicodeSets = flags.indexOf("v") !== -1;
    var unicode = flags.indexOf("u") !== -1;
    this.start = start | 0;
    this.source = pattern + "";
    this.flags = flags;
    if (unicodeSets && this.parser.options.ecmaVersion >= 15) {
      this.switchU = true;
      this.switchV = true;
      this.switchN = true;
    } else {
      this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
      this.switchV = false;
      this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
    }
  };

  RegExpValidationState.prototype.raise = function raise (message) {
    this.parser.raiseRecoverable(this.start, ("Invalid regular expression: /" + (this.source) + "/: " + message));
  };

  // If u flag is given, this returns the code point at the index (it combines a surrogate pair).
  // Otherwise, this returns the code unit of the index (can be a part of a surrogate pair).
  RegExpValidationState.prototype.at = function at (i, forceU) {
      if ( forceU === void 0 ) forceU = false;

    var s = this.source;
    var l = s.length;
    if (i >= l) {
      return -1
    }
    var c = s.charCodeAt(i);
    if (!(forceU || this.switchU) || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l) {
      return c
    }
    var next = s.charCodeAt(i + 1);
    return next >= 0xDC00 && next <= 0xDFFF ? (c << 10) + next - 0x35FDC00 : c
  };

  RegExpValidationState.prototype.nextIndex = function nextIndex (i, forceU) {
      if ( forceU === void 0 ) forceU = false;

    var s = this.source;
    var l = s.length;
    if (i >= l) {
      return l
    }
    var c = s.charCodeAt(i), next;
    if (!(forceU || this.switchU) || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l ||
        (next = s.charCodeAt(i + 1)) < 0xDC00 || next > 0xDFFF) {
      return i + 1
    }
    return i + 2
  };

  RegExpValidationState.prototype.current = function current (forceU) {
      if ( forceU === void 0 ) forceU = false;

    return this.at(this.pos, forceU)
  };

  RegExpValidationState.prototype.lookahead = function lookahead (forceU) {
      if ( forceU === void 0 ) forceU = false;

    return this.at(this.nextIndex(this.pos, forceU), forceU)
  };

  RegExpValidationState.prototype.advance = function advance (forceU) {
      if ( forceU === void 0 ) forceU = false;

    this.pos = this.nextIndex(this.pos, forceU);
  };

  RegExpValidationState.prototype.eat = function eat (ch, forceU) {
      if ( forceU === void 0 ) forceU = false;

    if (this.current(forceU) === ch) {
      this.advance(forceU);
      return true
    }
    return false
  };

  RegExpValidationState.prototype.eatChars = function eatChars (chs, forceU) {
      if ( forceU === void 0 ) forceU = false;

    var pos = this.pos;
    for (var i = 0, list = chs; i < list.length; i += 1) {
      var ch = list[i];

        var current = this.at(pos, forceU);
      if (current === -1 || current !== ch) {
        return false
      }
      pos = this.nextIndex(pos, forceU);
    }
    this.pos = pos;
    return true
  };

  /**
   * Validate the flags part of a given RegExpLiteral.
   *
   * @param {RegExpValidationState} state The state to validate RegExp.
   * @returns {void}
   */
  pp$1.validateRegExpFlags = function(state) {
    var validFlags = state.validFlags;
    var flags = state.flags;

    var u = false;
    var v = false;

    for (var i = 0; i < flags.length; i++) {
      var flag = flags.charAt(i);
      if (validFlags.indexOf(flag) === -1) {
        this.raise(state.start, "Invalid regular expression flag");
      }
      if (flags.indexOf(flag, i + 1) > -1) {
        this.raise(state.start, "Duplicate regular expression flag");
      }
      if (flag === "u") { u = true; }
      if (flag === "v") { v = true; }
    }
    if (this.options.ecmaVersion >= 15 && u && v) {
      this.raise(state.start, "Invalid regular expression flag");
    }
  };

  /**
   * Validate the pattern part of a given RegExpLiteral.
   *
   * @param {RegExpValidationState} state The state to validate RegExp.
   * @returns {void}
   */
  pp$1.validateRegExpPattern = function(state) {
    this.regexp_pattern(state);

    // The goal symbol for the parse is |Pattern[~U, ~N]|. If the result of
    // parsing contains a |GroupName|, reparse with the goal symbol
    // |Pattern[~U, +N]| and use this result instead. Throw a *SyntaxError*
    // exception if _P_ did not conform to the grammar, if any elements of _P_
    // were not matched by the parse, or if any Early Error conditions exist.
    if (!state.switchN && this.options.ecmaVersion >= 9 && state.groupNames.length > 0) {
      state.switchN = true;
      this.regexp_pattern(state);
    }
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-Pattern
  pp$1.regexp_pattern = function(state) {
    state.pos = 0;
    state.lastIntValue = 0;
    state.lastStringValue = "";
    state.lastAssertionIsQuantifiable = false;
    state.numCapturingParens = 0;
    state.maxBackReference = 0;
    state.groupNames.length = 0;
    state.backReferenceNames.length = 0;

    this.regexp_disjunction(state);

    if (state.pos !== state.source.length) {
      // Make the same messages as V8.
      if (state.eat(0x29 /* ) */)) {
        state.raise("Unmatched ')'");
      }
      if (state.eat(0x5D /* ] */) || state.eat(0x7D /* } */)) {
        state.raise("Lone quantifier brackets");
      }
    }
    if (state.maxBackReference > state.numCapturingParens) {
      state.raise("Invalid escape");
    }
    for (var i = 0, list = state.backReferenceNames; i < list.length; i += 1) {
      var name = list[i];

      if (state.groupNames.indexOf(name) === -1) {
        state.raise("Invalid named capture referenced");
      }
    }
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-Disjunction
  pp$1.regexp_disjunction = function(state) {
    this.regexp_alternative(state);
    while (state.eat(0x7C /* | */)) {
      this.regexp_alternative(state);
    }

    // Make the same message as V8.
    if (this.regexp_eatQuantifier(state, true)) {
      state.raise("Nothing to repeat");
    }
    if (state.eat(0x7B /* { */)) {
      state.raise("Lone quantifier brackets");
    }
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-Alternative
  pp$1.regexp_alternative = function(state) {
    while (state.pos < state.source.length && this.regexp_eatTerm(state))
      { }
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Term
  pp$1.regexp_eatTerm = function(state) {
    if (this.regexp_eatAssertion(state)) {
      // Handle `QuantifiableAssertion Quantifier` alternative.
      // `state.lastAssertionIsQuantifiable` is true if the last eaten Assertion
      // is a QuantifiableAssertion.
      if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
        // Make the same message as V8.
        if (state.switchU) {
          state.raise("Invalid quantifier");
        }
      }
      return true
    }

    if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
      this.regexp_eatQuantifier(state);
      return true
    }

    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Assertion
  pp$1.regexp_eatAssertion = function(state) {
    var start = state.pos;
    state.lastAssertionIsQuantifiable = false;

    // ^, $
    if (state.eat(0x5E /* ^ */) || state.eat(0x24 /* $ */)) {
      return true
    }

    // \b \B
    if (state.eat(0x5C /* \ */)) {
      if (state.eat(0x42 /* B */) || state.eat(0x62 /* b */)) {
        return true
      }
      state.pos = start;
    }

    // Lookahead / Lookbehind
    if (state.eat(0x28 /* ( */) && state.eat(0x3F /* ? */)) {
      var lookbehind = false;
      if (this.options.ecmaVersion >= 9) {
        lookbehind = state.eat(0x3C /* < */);
      }
      if (state.eat(0x3D /* = */) || state.eat(0x21 /* ! */)) {
        this.regexp_disjunction(state);
        if (!state.eat(0x29 /* ) */)) {
          state.raise("Unterminated group");
        }
        state.lastAssertionIsQuantifiable = !lookbehind;
        return true
      }
    }

    state.pos = start;
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-Quantifier
  pp$1.regexp_eatQuantifier = function(state, noError) {
    if ( noError === void 0 ) noError = false;

    if (this.regexp_eatQuantifierPrefix(state, noError)) {
      state.eat(0x3F /* ? */);
      return true
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-QuantifierPrefix
  pp$1.regexp_eatQuantifierPrefix = function(state, noError) {
    return (
      state.eat(0x2A /* * */) ||
      state.eat(0x2B /* + */) ||
      state.eat(0x3F /* ? */) ||
      this.regexp_eatBracedQuantifier(state, noError)
    )
  };
  pp$1.regexp_eatBracedQuantifier = function(state, noError) {
    var start = state.pos;
    if (state.eat(0x7B /* { */)) {
      var min = 0, max = -1;
      if (this.regexp_eatDecimalDigits(state)) {
        min = state.lastIntValue;
        if (state.eat(0x2C /* , */) && this.regexp_eatDecimalDigits(state)) {
          max = state.lastIntValue;
        }
        if (state.eat(0x7D /* } */)) {
          // SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-term
          if (max !== -1 && max < min && !noError) {
            state.raise("numbers out of order in {} quantifier");
          }
          return true
        }
      }
      if (state.switchU && !noError) {
        state.raise("Incomplete quantifier");
      }
      state.pos = start;
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-Atom
  pp$1.regexp_eatAtom = function(state) {
    return (
      this.regexp_eatPatternCharacters(state) ||
      state.eat(0x2E /* . */) ||
      this.regexp_eatReverseSolidusAtomEscape(state) ||
      this.regexp_eatCharacterClass(state) ||
      this.regexp_eatUncapturingGroup(state) ||
      this.regexp_eatCapturingGroup(state)
    )
  };
  pp$1.regexp_eatReverseSolidusAtomEscape = function(state) {
    var start = state.pos;
    if (state.eat(0x5C /* \ */)) {
      if (this.regexp_eatAtomEscape(state)) {
        return true
      }
      state.pos = start;
    }
    return false
  };
  pp$1.regexp_eatUncapturingGroup = function(state) {
    var start = state.pos;
    if (state.eat(0x28 /* ( */)) {
      if (state.eat(0x3F /* ? */) && state.eat(0x3A /* : */)) {
        this.regexp_disjunction(state);
        if (state.eat(0x29 /* ) */)) {
          return true
        }
        state.raise("Unterminated group");
      }
      state.pos = start;
    }
    return false
  };
  pp$1.regexp_eatCapturingGroup = function(state) {
    if (state.eat(0x28 /* ( */)) {
      if (this.options.ecmaVersion >= 9) {
        this.regexp_groupSpecifier(state);
      } else if (state.current() === 0x3F /* ? */) {
        state.raise("Invalid group");
      }
      this.regexp_disjunction(state);
      if (state.eat(0x29 /* ) */)) {
        state.numCapturingParens += 1;
        return true
      }
      state.raise("Unterminated group");
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedAtom
  pp$1.regexp_eatExtendedAtom = function(state) {
    return (
      state.eat(0x2E /* . */) ||
      this.regexp_eatReverseSolidusAtomEscape(state) ||
      this.regexp_eatCharacterClass(state) ||
      this.regexp_eatUncapturingGroup(state) ||
      this.regexp_eatCapturingGroup(state) ||
      this.regexp_eatInvalidBracedQuantifier(state) ||
      this.regexp_eatExtendedPatternCharacter(state)
    )
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-InvalidBracedQuantifier
  pp$1.regexp_eatInvalidBracedQuantifier = function(state) {
    if (this.regexp_eatBracedQuantifier(state, true)) {
      state.raise("Nothing to repeat");
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-SyntaxCharacter
  pp$1.regexp_eatSyntaxCharacter = function(state) {
    var ch = state.current();
    if (isSyntaxCharacter(ch)) {
      state.lastIntValue = ch;
      state.advance();
      return true
    }
    return false
  };
  function isSyntaxCharacter(ch) {
    return (
      ch === 0x24 /* $ */ ||
      ch >= 0x28 /* ( */ && ch <= 0x2B /* + */ ||
      ch === 0x2E /* . */ ||
      ch === 0x3F /* ? */ ||
      ch >= 0x5B /* [ */ && ch <= 0x5E /* ^ */ ||
      ch >= 0x7B /* { */ && ch <= 0x7D /* } */
    )
  }

  // https://www.ecma-international.org/ecma-262/8.0/#prod-PatternCharacter
  // But eat eager.
  pp$1.regexp_eatPatternCharacters = function(state) {
    var start = state.pos;
    var ch = 0;
    while ((ch = state.current()) !== -1 && !isSyntaxCharacter(ch)) {
      state.advance();
    }
    return state.pos !== start
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedPatternCharacter
  pp$1.regexp_eatExtendedPatternCharacter = function(state) {
    var ch = state.current();
    if (
      ch !== -1 &&
      ch !== 0x24 /* $ */ &&
      !(ch >= 0x28 /* ( */ && ch <= 0x2B /* + */) &&
      ch !== 0x2E /* . */ &&
      ch !== 0x3F /* ? */ &&
      ch !== 0x5B /* [ */ &&
      ch !== 0x5E /* ^ */ &&
      ch !== 0x7C /* | */
    ) {
      state.advance();
      return true
    }
    return false
  };

  // GroupSpecifier ::
  //   [empty]
  //   `?` GroupName
  pp$1.regexp_groupSpecifier = function(state) {
    if (state.eat(0x3F /* ? */)) {
      if (this.regexp_eatGroupName(state)) {
        if (state.groupNames.indexOf(state.lastStringValue) !== -1) {
          state.raise("Duplicate capture group name");
        }
        state.groupNames.push(state.lastStringValue);
        return
      }
      state.raise("Invalid group");
    }
  };

  // GroupName ::
  //   `<` RegExpIdentifierName `>`
  // Note: this updates `state.lastStringValue` property with the eaten name.
  pp$1.regexp_eatGroupName = function(state) {
    state.lastStringValue = "";
    if (state.eat(0x3C /* < */)) {
      if (this.regexp_eatRegExpIdentifierName(state) && state.eat(0x3E /* > */)) {
        return true
      }
      state.raise("Invalid capture group name");
    }
    return false
  };

  // RegExpIdentifierName ::
  //   RegExpIdentifierStart
  //   RegExpIdentifierName RegExpIdentifierPart
  // Note: this updates `state.lastStringValue` property with the eaten name.
  pp$1.regexp_eatRegExpIdentifierName = function(state) {
    state.lastStringValue = "";
    if (this.regexp_eatRegExpIdentifierStart(state)) {
      state.lastStringValue += codePointToString(state.lastIntValue);
      while (this.regexp_eatRegExpIdentifierPart(state)) {
        state.lastStringValue += codePointToString(state.lastIntValue);
      }
      return true
    }
    return false
  };

  // RegExpIdentifierStart ::
  //   UnicodeIDStart
  //   `$`
  //   `_`
  //   `\` RegExpUnicodeEscapeSequence[+U]
  pp$1.regexp_eatRegExpIdentifierStart = function(state) {
    var start = state.pos;
    var forceU = this.options.ecmaVersion >= 11;
    var ch = state.current(forceU);
    state.advance(forceU);

    if (ch === 0x5C /* \ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
      ch = state.lastIntValue;
    }
    if (isRegExpIdentifierStart(ch)) {
      state.lastIntValue = ch;
      return true
    }

    state.pos = start;
    return false
  };
  function isRegExpIdentifierStart(ch) {
    return isIdentifierStart(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */
  }

  // RegExpIdentifierPart ::
  //   UnicodeIDContinue
  //   `$`
  //   `_`
  //   `\` RegExpUnicodeEscapeSequence[+U]
  //   <ZWNJ>
  //   <ZWJ>
  pp$1.regexp_eatRegExpIdentifierPart = function(state) {
    var start = state.pos;
    var forceU = this.options.ecmaVersion >= 11;
    var ch = state.current(forceU);
    state.advance(forceU);

    if (ch === 0x5C /* \ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
      ch = state.lastIntValue;
    }
    if (isRegExpIdentifierPart(ch)) {
      state.lastIntValue = ch;
      return true
    }

    state.pos = start;
    return false
  };
  function isRegExpIdentifierPart(ch) {
    return isIdentifierChar(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */ || ch === 0x200C /* <ZWNJ> */ || ch === 0x200D /* <ZWJ> */
  }

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-AtomEscape
  pp$1.regexp_eatAtomEscape = function(state) {
    if (
      this.regexp_eatBackReference(state) ||
      this.regexp_eatCharacterClassEscape(state) ||
      this.regexp_eatCharacterEscape(state) ||
      (state.switchN && this.regexp_eatKGroupName(state))
    ) {
      return true
    }
    if (state.switchU) {
      // Make the same message as V8.
      if (state.current() === 0x63 /* c */) {
        state.raise("Invalid unicode escape");
      }
      state.raise("Invalid escape");
    }
    return false
  };
  pp$1.regexp_eatBackReference = function(state) {
    var start = state.pos;
    if (this.regexp_eatDecimalEscape(state)) {
      var n = state.lastIntValue;
      if (state.switchU) {
        // For SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-atomescape
        if (n > state.maxBackReference) {
          state.maxBackReference = n;
        }
        return true
      }
      if (n <= state.numCapturingParens) {
        return true
      }
      state.pos = start;
    }
    return false
  };
  pp$1.regexp_eatKGroupName = function(state) {
    if (state.eat(0x6B /* k */)) {
      if (this.regexp_eatGroupName(state)) {
        state.backReferenceNames.push(state.lastStringValue);
        return true
      }
      state.raise("Invalid named reference");
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-CharacterEscape
  pp$1.regexp_eatCharacterEscape = function(state) {
    return (
      this.regexp_eatControlEscape(state) ||
      this.regexp_eatCControlLetter(state) ||
      this.regexp_eatZero(state) ||
      this.regexp_eatHexEscapeSequence(state) ||
      this.regexp_eatRegExpUnicodeEscapeSequence(state, false) ||
      (!state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state)) ||
      this.regexp_eatIdentityEscape(state)
    )
  };
  pp$1.regexp_eatCControlLetter = function(state) {
    var start = state.pos;
    if (state.eat(0x63 /* c */)) {
      if (this.regexp_eatControlLetter(state)) {
        return true
      }
      state.pos = start;
    }
    return false
  };
  pp$1.regexp_eatZero = function(state) {
    if (state.current() === 0x30 /* 0 */ && !isDecimalDigit(state.lookahead())) {
      state.lastIntValue = 0;
      state.advance();
      return true
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-ControlEscape
  pp$1.regexp_eatControlEscape = function(state) {
    var ch = state.current();
    if (ch === 0x74 /* t */) {
      state.lastIntValue = 0x09; /* \t */
      state.advance();
      return true
    }
    if (ch === 0x6E /* n */) {
      state.lastIntValue = 0x0A; /* \n */
      state.advance();
      return true
    }
    if (ch === 0x76 /* v */) {
      state.lastIntValue = 0x0B; /* \v */
      state.advance();
      return true
    }
    if (ch === 0x66 /* f */) {
      state.lastIntValue = 0x0C; /* \f */
      state.advance();
      return true
    }
    if (ch === 0x72 /* r */) {
      state.lastIntValue = 0x0D; /* \r */
      state.advance();
      return true
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-ControlLetter
  pp$1.regexp_eatControlLetter = function(state) {
    var ch = state.current();
    if (isControlLetter(ch)) {
      state.lastIntValue = ch % 0x20;
      state.advance();
      return true
    }
    return false
  };
  function isControlLetter(ch) {
    return (
      (ch >= 0x41 /* A */ && ch <= 0x5A /* Z */) ||
      (ch >= 0x61 /* a */ && ch <= 0x7A /* z */)
    )
  }

  // https://www.ecma-international.org/ecma-262/8.0/#prod-RegExpUnicodeEscapeSequence
  pp$1.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {
    if ( forceU === void 0 ) forceU = false;

    var start = state.pos;
    var switchU = forceU || state.switchU;

    if (state.eat(0x75 /* u */)) {
      if (this.regexp_eatFixedHexDigits(state, 4)) {
        var lead = state.lastIntValue;
        if (switchU && lead >= 0xD800 && lead <= 0xDBFF) {
          var leadSurrogateEnd = state.pos;
          if (state.eat(0x5C /* \ */) && state.eat(0x75 /* u */) && this.regexp_eatFixedHexDigits(state, 4)) {
            var trail = state.lastIntValue;
            if (trail >= 0xDC00 && trail <= 0xDFFF) {
              state.lastIntValue = (lead - 0xD800) * 0x400 + (trail - 0xDC00) + 0x10000;
              return true
            }
          }
          state.pos = leadSurrogateEnd;
          state.lastIntValue = lead;
        }
        return true
      }
      if (
        switchU &&
        state.eat(0x7B /* { */) &&
        this.regexp_eatHexDigits(state) &&
        state.eat(0x7D /* } */) &&
        isValidUnicode(state.lastIntValue)
      ) {
        return true
      }
      if (switchU) {
        state.raise("Invalid unicode escape");
      }
      state.pos = start;
    }

    return false
  };
  function isValidUnicode(ch) {
    return ch >= 0 && ch <= 0x10FFFF
  }

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-IdentityEscape
  pp$1.regexp_eatIdentityEscape = function(state) {
    if (state.switchU) {
      if (this.regexp_eatSyntaxCharacter(state)) {
        return true
      }
      if (state.eat(0x2F /* / */)) {
        state.lastIntValue = 0x2F; /* / */
        return true
      }
      return false
    }

    var ch = state.current();
    if (ch !== 0x63 /* c */ && (!state.switchN || ch !== 0x6B /* k */)) {
      state.lastIntValue = ch;
      state.advance();
      return true
    }

    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalEscape
  pp$1.regexp_eatDecimalEscape = function(state) {
    state.lastIntValue = 0;
    var ch = state.current();
    if (ch >= 0x31 /* 1 */ && ch <= 0x39 /* 9 */) {
      do {
        state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);
        state.advance();
      } while ((ch = state.current()) >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */)
      return true
    }
    return false
  };

  // Return values used by character set parsing methods, needed to
  // forbid negation of sets that can match strings.
  var CharSetNone = 0; // Nothing parsed
  var CharSetOk = 1; // Construct parsed, cannot contain strings
  var CharSetString = 2; // Construct parsed, can contain strings

  // https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClassEscape
  pp$1.regexp_eatCharacterClassEscape = function(state) {
    var ch = state.current();

    if (isCharacterClassEscape(ch)) {
      state.lastIntValue = -1;
      state.advance();
      return CharSetOk
    }

    var negate = false;
    if (
      state.switchU &&
      this.options.ecmaVersion >= 9 &&
      ((negate = ch === 0x50 /* P */) || ch === 0x70 /* p */)
    ) {
      state.lastIntValue = -1;
      state.advance();
      var result;
      if (
        state.eat(0x7B /* { */) &&
        (result = this.regexp_eatUnicodePropertyValueExpression(state)) &&
        state.eat(0x7D /* } */)
      ) {
        if (negate && result === CharSetString) { state.raise("Invalid property name"); }
        return result
      }
      state.raise("Invalid property name");
    }

    return CharSetNone
  };

  function isCharacterClassEscape(ch) {
    return (
      ch === 0x64 /* d */ ||
      ch === 0x44 /* D */ ||
      ch === 0x73 /* s */ ||
      ch === 0x53 /* S */ ||
      ch === 0x77 /* w */ ||
      ch === 0x57 /* W */
    )
  }

  // UnicodePropertyValueExpression ::
  //   UnicodePropertyName `=` UnicodePropertyValue
  //   LoneUnicodePropertyNameOrValue
  pp$1.regexp_eatUnicodePropertyValueExpression = function(state) {
    var start = state.pos;

    // UnicodePropertyName `=` UnicodePropertyValue
    if (this.regexp_eatUnicodePropertyName(state) && state.eat(0x3D /* = */)) {
      var name = state.lastStringValue;
      if (this.regexp_eatUnicodePropertyValue(state)) {
        var value = state.lastStringValue;
        this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
        return CharSetOk
      }
    }
    state.pos = start;

    // LoneUnicodePropertyNameOrValue
    if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
      var nameOrValue = state.lastStringValue;
      return this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue)
    }
    return CharSetNone
  };

  pp$1.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
    if (!hasOwn(state.unicodeProperties.nonBinary, name))
      { state.raise("Invalid property name"); }
    if (!state.unicodeProperties.nonBinary[name].test(value))
      { state.raise("Invalid property value"); }
  };

  pp$1.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
    if (state.unicodeProperties.binary.test(nameOrValue)) { return CharSetOk }
    if (state.switchV && state.unicodeProperties.binaryOfStrings.test(nameOrValue)) { return CharSetString }
    state.raise("Invalid property name");
  };

  // UnicodePropertyName ::
  //   UnicodePropertyNameCharacters
  pp$1.regexp_eatUnicodePropertyName = function(state) {
    var ch = 0;
    state.lastStringValue = "";
    while (isUnicodePropertyNameCharacter(ch = state.current())) {
      state.lastStringValue += codePointToString(ch);
      state.advance();
    }
    return state.lastStringValue !== ""
  };

  function isUnicodePropertyNameCharacter(ch) {
    return isControlLetter(ch) || ch === 0x5F /* _ */
  }

  // UnicodePropertyValue ::
  //   UnicodePropertyValueCharacters
  pp$1.regexp_eatUnicodePropertyValue = function(state) {
    var ch = 0;
    state.lastStringValue = "";
    while (isUnicodePropertyValueCharacter(ch = state.current())) {
      state.lastStringValue += codePointToString(ch);
      state.advance();
    }
    return state.lastStringValue !== ""
  };
  function isUnicodePropertyValueCharacter(ch) {
    return isUnicodePropertyNameCharacter(ch) || isDecimalDigit(ch)
  }

  // LoneUnicodePropertyNameOrValue ::
  //   UnicodePropertyValueCharacters
  pp$1.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
    return this.regexp_eatUnicodePropertyValue(state)
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClass
  pp$1.regexp_eatCharacterClass = function(state) {
    if (state.eat(0x5B /* [ */)) {
      var negate = state.eat(0x5E /* ^ */);
      var result = this.regexp_classContents(state);
      if (!state.eat(0x5D /* ] */))
        { state.raise("Unterminated character class"); }
      if (negate && result === CharSetString)
        { state.raise("Negated character class may contain strings"); }
      return true
    }
    return false
  };

  // https://tc39.es/ecma262/#prod-ClassContents
  // https://www.ecma-international.org/ecma-262/8.0/#prod-ClassRanges
  pp$1.regexp_classContents = function(state) {
    if (state.current() === 0x5D /* ] */) { return CharSetOk }
    if (state.switchV) { return this.regexp_classSetExpression(state) }
    this.regexp_nonEmptyClassRanges(state);
    return CharSetOk
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRanges
  // https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRangesNoDash
  pp$1.regexp_nonEmptyClassRanges = function(state) {
    while (this.regexp_eatClassAtom(state)) {
      var left = state.lastIntValue;
      if (state.eat(0x2D /* - */) && this.regexp_eatClassAtom(state)) {
        var right = state.lastIntValue;
        if (state.switchU && (left === -1 || right === -1)) {
          state.raise("Invalid character class");
        }
        if (left !== -1 && right !== -1 && left > right) {
          state.raise("Range out of order in character class");
        }
      }
    }
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtom
  // https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtomNoDash
  pp$1.regexp_eatClassAtom = function(state) {
    var start = state.pos;

    if (state.eat(0x5C /* \ */)) {
      if (this.regexp_eatClassEscape(state)) {
        return true
      }
      if (state.switchU) {
        // Make the same message as V8.
        var ch$1 = state.current();
        if (ch$1 === 0x63 /* c */ || isOctalDigit(ch$1)) {
          state.raise("Invalid class escape");
        }
        state.raise("Invalid escape");
      }
      state.pos = start;
    }

    var ch = state.current();
    if (ch !== 0x5D /* ] */) {
      state.lastIntValue = ch;
      state.advance();
      return true
    }

    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassEscape
  pp$1.regexp_eatClassEscape = function(state) {
    var start = state.pos;

    if (state.eat(0x62 /* b */)) {
      state.lastIntValue = 0x08; /* <BS> */
      return true
    }

    if (state.switchU && state.eat(0x2D /* - */)) {
      state.lastIntValue = 0x2D; /* - */
      return true
    }

    if (!state.switchU && state.eat(0x63 /* c */)) {
      if (this.regexp_eatClassControlLetter(state)) {
        return true
      }
      state.pos = start;
    }

    return (
      this.regexp_eatCharacterClassEscape(state) ||
      this.regexp_eatCharacterEscape(state)
    )
  };

  // https://tc39.es/ecma262/#prod-ClassSetExpression
  // https://tc39.es/ecma262/#prod-ClassUnion
  // https://tc39.es/ecma262/#prod-ClassIntersection
  // https://tc39.es/ecma262/#prod-ClassSubtraction
  pp$1.regexp_classSetExpression = function(state) {
    var result = CharSetOk, subResult;
    if (this.regexp_eatClassSetRange(state)) ; else if (subResult = this.regexp_eatClassSetOperand(state)) {
      if (subResult === CharSetString) { result = CharSetString; }
      // https://tc39.es/ecma262/#prod-ClassIntersection
      var start = state.pos;
      while (state.eatChars([0x26, 0x26] /* && */)) {
        if (
          state.current() !== 0x26 /* & */ &&
          (subResult = this.regexp_eatClassSetOperand(state))
        ) {
          if (subResult !== CharSetString) { result = CharSetOk; }
          continue
        }
        state.raise("Invalid character in character class");
      }
      if (start !== state.pos) { return result }
      // https://tc39.es/ecma262/#prod-ClassSubtraction
      while (state.eatChars([0x2D, 0x2D] /* -- */)) {
        if (this.regexp_eatClassSetOperand(state)) { continue }
        state.raise("Invalid character in character class");
      }
      if (start !== state.pos) { return result }
    } else {
      state.raise("Invalid character in character class");
    }
    // https://tc39.es/ecma262/#prod-ClassUnion
    for (;;) {
      if (this.regexp_eatClassSetRange(state)) { continue }
      subResult = this.regexp_eatClassSetOperand(state);
      if (!subResult) { return result }
      if (subResult === CharSetString) { result = CharSetString; }
    }
  };

  // https://tc39.es/ecma262/#prod-ClassSetRange
  pp$1.regexp_eatClassSetRange = function(state) {
    var start = state.pos;
    if (this.regexp_eatClassSetCharacter(state)) {
      var left = state.lastIntValue;
      if (state.eat(0x2D /* - */) && this.regexp_eatClassSetCharacter(state)) {
        var right = state.lastIntValue;
        if (left !== -1 && right !== -1 && left > right) {
          state.raise("Range out of order in character class");
        }
        return true
      }
      state.pos = start;
    }
    return false
  };

  // https://tc39.es/ecma262/#prod-ClassSetOperand
  pp$1.regexp_eatClassSetOperand = function(state) {
    if (this.regexp_eatClassSetCharacter(state)) { return CharSetOk }
    return this.regexp_eatClassStringDisjunction(state) || this.regexp_eatNestedClass(state)
  };

  // https://tc39.es/ecma262/#prod-NestedClass
  pp$1.regexp_eatNestedClass = function(state) {
    var start = state.pos;
    if (state.eat(0x5B /* [ */)) {
      var negate = state.eat(0x5E /* ^ */);
      var result = this.regexp_classContents(state);
      if (state.eat(0x5D /* ] */)) {
        if (negate && result === CharSetString) {
          state.raise("Negated character class may contain strings");
        }
        return result
      }
      state.pos = start;
    }
    if (state.eat(0x5C /* \ */)) {
      var result$1 = this.regexp_eatCharacterClassEscape(state);
      if (result$1) {
        return result$1
      }
      state.pos = start;
    }
    return null
  };

  // https://tc39.es/ecma262/#prod-ClassStringDisjunction
  pp$1.regexp_eatClassStringDisjunction = function(state) {
    var start = state.pos;
    if (state.eatChars([0x5C, 0x71] /* \q */)) {
      if (state.eat(0x7B /* { */)) {
        var result = this.regexp_classStringDisjunctionContents(state);
        if (state.eat(0x7D /* } */)) {
          return result
        }
      } else {
        // Make the same message as V8.
        state.raise("Invalid escape");
      }
      state.pos = start;
    }
    return null
  };

  // https://tc39.es/ecma262/#prod-ClassStringDisjunctionContents
  pp$1.regexp_classStringDisjunctionContents = function(state) {
    var result = this.regexp_classString(state);
    while (state.eat(0x7C /* | */)) {
      if (this.regexp_classString(state) === CharSetString) { result = CharSetString; }
    }
    return result
  };

  // https://tc39.es/ecma262/#prod-ClassString
  // https://tc39.es/ecma262/#prod-NonEmptyClassString
  pp$1.regexp_classString = function(state) {
    var count = 0;
    while (this.regexp_eatClassSetCharacter(state)) { count++; }
    return count === 1 ? CharSetOk : CharSetString
  };

  // https://tc39.es/ecma262/#prod-ClassSetCharacter
  pp$1.regexp_eatClassSetCharacter = function(state) {
    var start = state.pos;
    if (state.eat(0x5C /* \ */)) {
      if (
        this.regexp_eatCharacterEscape(state) ||
        this.regexp_eatClassSetReservedPunctuator(state)
      ) {
        return true
      }
      if (state.eat(0x62 /* b */)) {
        state.lastIntValue = 0x08; /* <BS> */
        return true
      }
      state.pos = start;
      return false
    }
    var ch = state.current();
    if (ch < 0 || ch === state.lookahead() && isClassSetReservedDoublePunctuatorCharacter(ch)) { return false }
    if (isClassSetSyntaxCharacter(ch)) { return false }
    state.advance();
    state.lastIntValue = ch;
    return true
  };

  // https://tc39.es/ecma262/#prod-ClassSetReservedDoublePunctuator
  function isClassSetReservedDoublePunctuatorCharacter(ch) {
    return (
      ch === 0x21 /* ! */ ||
      ch >= 0x23 /* # */ && ch <= 0x26 /* & */ ||
      ch >= 0x2A /* * */ && ch <= 0x2C /* , */ ||
      ch === 0x2E /* . */ ||
      ch >= 0x3A /* : */ && ch <= 0x40 /* @ */ ||
      ch === 0x5E /* ^ */ ||
      ch === 0x60 /* ` */ ||
      ch === 0x7E /* ~ */
    )
  }

  // https://tc39.es/ecma262/#prod-ClassSetSyntaxCharacter
  function isClassSetSyntaxCharacter(ch) {
    return (
      ch === 0x28 /* ( */ ||
      ch === 0x29 /* ) */ ||
      ch === 0x2D /* - */ ||
      ch === 0x2F /* / */ ||
      ch >= 0x5B /* [ */ && ch <= 0x5D /* ] */ ||
      ch >= 0x7B /* { */ && ch <= 0x7D /* } */
    )
  }

  // https://tc39.es/ecma262/#prod-ClassSetReservedPunctuator
  pp$1.regexp_eatClassSetReservedPunctuator = function(state) {
    var ch = state.current();
    if (isClassSetReservedPunctuator(ch)) {
      state.lastIntValue = ch;
      state.advance();
      return true
    }
    return false
  };

  // https://tc39.es/ecma262/#prod-ClassSetReservedPunctuator
  function isClassSetReservedPunctuator(ch) {
    return (
      ch === 0x21 /* ! */ ||
      ch === 0x23 /* # */ ||
      ch === 0x25 /* % */ ||
      ch === 0x26 /* & */ ||
      ch === 0x2C /* , */ ||
      ch === 0x2D /* - */ ||
      ch >= 0x3A /* : */ && ch <= 0x3E /* > */ ||
      ch === 0x40 /* @ */ ||
      ch === 0x60 /* ` */ ||
      ch === 0x7E /* ~ */
    )
  }

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassControlLetter
  pp$1.regexp_eatClassControlLetter = function(state) {
    var ch = state.current();
    if (isDecimalDigit(ch) || ch === 0x5F /* _ */) {
      state.lastIntValue = ch % 0x20;
      state.advance();
      return true
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence
  pp$1.regexp_eatHexEscapeSequence = function(state) {
    var start = state.pos;
    if (state.eat(0x78 /* x */)) {
      if (this.regexp_eatFixedHexDigits(state, 2)) {
        return true
      }
      if (state.switchU) {
        state.raise("Invalid escape");
      }
      state.pos = start;
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalDigits
  pp$1.regexp_eatDecimalDigits = function(state) {
    var start = state.pos;
    var ch = 0;
    state.lastIntValue = 0;
    while (isDecimalDigit(ch = state.current())) {
      state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);
      state.advance();
    }
    return state.pos !== start
  };
  function isDecimalDigit(ch) {
    return ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */
  }

  // https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigits
  pp$1.regexp_eatHexDigits = function(state) {
    var start = state.pos;
    var ch = 0;
    state.lastIntValue = 0;
    while (isHexDigit(ch = state.current())) {
      state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
      state.advance();
    }
    return state.pos !== start
  };
  function isHexDigit(ch) {
    return (
      (ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */) ||
      (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) ||
      (ch >= 0x61 /* a */ && ch <= 0x66 /* f */)
    )
  }
  function hexToInt(ch) {
    if (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) {
      return 10 + (ch - 0x41 /* A */)
    }
    if (ch >= 0x61 /* a */ && ch <= 0x66 /* f */) {
      return 10 + (ch - 0x61 /* a */)
    }
    return ch - 0x30 /* 0 */
  }

  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-LegacyOctalEscapeSequence
  // Allows only 0-377(octal) i.e. 0-255(decimal).
  pp$1.regexp_eatLegacyOctalEscapeSequence = function(state) {
    if (this.regexp_eatOctalDigit(state)) {
      var n1 = state.lastIntValue;
      if (this.regexp_eatOctalDigit(state)) {
        var n2 = state.lastIntValue;
        if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
          state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
        } else {
          state.lastIntValue = n1 * 8 + n2;
        }
      } else {
        state.lastIntValue = n1;
      }
      return true
    }
    return false
  };

  // https://www.ecma-international.org/ecma-262/8.0/#prod-OctalDigit
  pp$1.regexp_eatOctalDigit = function(state) {
    var ch = state.current();
    if (isOctalDigit(ch)) {
      state.lastIntValue = ch - 0x30; /* 0 */
      state.advance();
      return true
    }
    state.lastIntValue = 0;
    return false
  };
  function isOctalDigit(ch) {
    return ch >= 0x30 /* 0 */ && ch <= 0x37 /* 7 */
  }

  // https://www.ecma-international.org/ecma-262/8.0/#prod-Hex4Digits
  // https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigit
  // And HexDigit HexDigit in https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence
  pp$1.regexp_eatFixedHexDigits = function(state, length) {
    var start = state.pos;
    state.lastIntValue = 0;
    for (var i = 0; i < length; ++i) {
      var ch = state.current();
      if (!isHexDigit(ch)) {
        state.pos = start;
        return false
      }
      state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
      state.advance();
    }
    return true
  };

  // Object type used to represent tokens. Note that normally, tokens
  // simply exist as properties on the parser object. This is only
  // used for the onToken callback and the external tokenizer.

  var Token = function Token(p) {
    this.type = p.type;
    this.value = p.value;
    this.start = p.start;
    this.end = p.end;
    if (p.options.locations)
      { this.loc = new SourceLocation(p, p.startLoc, p.endLoc); }
    if (p.options.ranges)
      { this.range = [p.start, p.end]; }
  };

  // ## Tokenizer

  var pp = Parser.prototype;

  // Move to the next token

  pp.next = function(ignoreEscapeSequenceInKeyword) {
    if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc)
      { this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword); }
    if (this.options.onToken)
      { this.options.onToken(new Token(this)); }

    this.lastTokEnd = this.end;
    this.lastTokStart = this.start;
    this.lastTokEndLoc = this.endLoc;
    this.lastTokStartLoc = this.startLoc;
    this.nextToken();
  };

  pp.getToken = function() {
    this.next();
    return new Token(this)
  };

  // If we're in an ES6 environment, make parsers iterable
  if (typeof Symbol !== "undefined")
    { pp[Symbol.iterator] = function() {
      var this$1$1 = this;

      return {
        next: function () {
          var token = this$1$1.getToken();
          return {
            done: token.type === types$1.eof,
            value: token
          }
        }
      }
    }; }

  // Toggle strict mode. Re-reads the next number or string to please
  // pedantic tests (`"use strict"; 010;` should fail).

  // Read a single token, updating the parser object's token-related
  // properties.

  pp.nextToken = function() {
    var curContext = this.curContext();
    if (!curContext || !curContext.preserveSpace) { this.skipSpace(); }

    this.start = this.pos;
    if (this.options.locations) { this.startLoc = this.curPosition(); }
    if (this.pos >= this.input.length) { return this.finishToken(types$1.eof) }

    if (curContext.override) { return curContext.override(this) }
    else { this.readToken(this.fullCharCodeAtPos()); }
  };

  pp.readToken = function(code) {
    // Identifier or keyword. '\uXXXX' sequences are allowed in
    // identifiers, so '\' also dispatches to that.
    if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\' */)
      { return this.readWord() }

    return this.getTokenFromCode(code)
  };

  pp.fullCharCodeAtPos = function() {
    var code = this.input.charCodeAt(this.pos);
    if (code <= 0xd7ff || code >= 0xdc00) { return code }
    var next = this.input.charCodeAt(this.pos + 1);
    return next <= 0xdbff || next >= 0xe000 ? code : (code << 10) + next - 0x35fdc00
  };

  pp.skipBlockComment = function() {
    var startLoc = this.options.onComment && this.curPosition();
    var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
    if (end === -1) { this.raise(this.pos - 2, "Unterminated comment"); }
    this.pos = end + 2;
    if (this.options.locations) {
      for (var nextBreak = (void 0), pos = start; (nextBreak = nextLineBreak(this.input, pos, this.pos)) > -1;) {
        ++this.curLine;
        pos = this.lineStart = nextBreak;
      }
    }
    if (this.options.onComment)
      { this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos,
                             startLoc, this.curPosition()); }
  };

  pp.skipLineComment = function(startSkip) {
    var start = this.pos;
    var startLoc = this.options.onComment && this.curPosition();
    var ch = this.input.charCodeAt(this.pos += startSkip);
    while (this.pos < this.input.length && !isNewLine(ch)) {
      ch = this.input.charCodeAt(++this.pos);
    }
    if (this.options.onComment)
      { this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos,
                             startLoc, this.curPosition()); }
  };

  // Called at the start of the parse and after every token. Skips
  // whitespace and comments, and.

  pp.skipSpace = function() {
    loop: while (this.pos < this.input.length) {
      var ch = this.input.charCodeAt(this.pos);
      switch (ch) {
      case 32: case 160: // ' '
        ++this.pos;
        break
      case 13:
        if (this.input.charCodeAt(this.pos + 1) === 10) {
          ++this.pos;
        }
      case 10: case 8232: case 8233:
        ++this.pos;
        if (this.options.locations) {
          ++this.curLine;
          this.lineStart = this.pos;
        }
        break
      case 47: // '/'
        switch (this.input.charCodeAt(this.pos + 1)) {
        case 42: // '*'
          this.skipBlockComment();
          break
        case 47:
          this.skipLineComment(2);
          break
        default:
          break loop
        }
        break
      default:
        if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
          ++this.pos;
        } else {
          break loop
        }
      }
    }
  };

  // Called at the end of every token. Sets `end`, `val`, and
  // maintains `context` and `exprAllowed`, and skips the space after
  // the token, so that the next one's `start` will point at the
  // right position.

  pp.finishToken = function(type, val) {
    this.end = this.pos;
    if (this.options.locations) { this.endLoc = this.curPosition(); }
    var prevType = this.type;
    this.type = type;
    this.value = val;

    this.updateContext(prevType);
  };

  // ### Token reading

  // This is the function that is called to fetch the next token. It
  // is somewhat obscure, because it works in character codes rather
  // than characters, and because operator parsing has been inlined
  // into it.
  //
  // All in the name of speed.
  //
  pp.readToken_dot = function() {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next >= 48 && next <= 57) { return this.readNumber(true) }
    var next2 = this.input.charCodeAt(this.pos + 2);
    if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) { // 46 = dot '.'
      this.pos += 3;
      return this.finishToken(types$1.ellipsis)
    } else {
      ++this.pos;
      return this.finishToken(types$1.dot)
    }
  };

  pp.readToken_slash = function() { // '/'
    var next = this.input.charCodeAt(this.pos + 1);
    if (this.exprAllowed) { ++this.pos; return this.readRegexp() }
    if (next === 61) { return this.finishOp(types$1.assign, 2) }
    return this.finishOp(types$1.slash, 1)
  };

  pp.readToken_mult_modulo_exp = function(code) { // '%*'
    var next = this.input.charCodeAt(this.pos + 1);
    var size = 1;
    var tokentype = code === 42 ? types$1.star : types$1.modulo;

    // exponentiation operator ** and **=
    if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {
      ++size;
      tokentype = types$1.starstar;
      next = this.input.charCodeAt(this.pos + 2);
    }

    if (next === 61) { return this.finishOp(types$1.assign, size + 1) }
    return this.finishOp(tokentype, size)
  };

  pp.readToken_pipe_amp = function(code) { // '|&'
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === code) {
      if (this.options.ecmaVersion >= 12) {
        var next2 = this.input.charCodeAt(this.pos + 2);
        if (next2 === 61) { return this.finishOp(types$1.assign, 3) }
      }
      return this.finishOp(code === 124 ? types$1.logicalOR : types$1.logicalAND, 2)
    }
    if (next === 61) { return this.finishOp(types$1.assign, 2) }
    return this.finishOp(code === 124 ? types$1.bitwiseOR : types$1.bitwiseAND, 1)
  };

  pp.readToken_caret = function() { // '^'
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 61) { return this.finishOp(types$1.assign, 2) }
    return this.finishOp(types$1.bitwiseXOR, 1)
  };

  pp.readToken_plus_min = function(code) { // '+-'
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === code) {
      if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 &&
          (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {
        // A `-->` line comment
        this.skipLineComment(3);
        this.skipSpace();
        return this.nextToken()
      }
      return this.finishOp(types$1.incDec, 2)
    }
    if (next === 61) { return this.finishOp(types$1.assign, 2) }
    return this.finishOp(types$1.plusMin, 1)
  };

  pp.readToken_lt_gt = function(code) { // '<>'
    var next = this.input.charCodeAt(this.pos + 1);
    var size = 1;
    if (next === code) {
      size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
      if (this.input.charCodeAt(this.pos + size) === 61) { return this.finishOp(types$1.assign, size + 1) }
      return this.finishOp(types$1.bitShift, size)
    }
    if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 &&
        this.input.charCodeAt(this.pos + 3) === 45) {
      // `<!--`, an XML-style comment that should be interpreted as a line comment
      this.skipLineComment(4);
      this.skipSpace();
      return this.nextToken()
    }
    if (next === 61) { size = 2; }
    return this.finishOp(types$1.relational, size)
  };

  pp.readToken_eq_excl = function(code) { // '=!'
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 61) { return this.finishOp(types$1.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2) }
    if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) { // '=>'
      this.pos += 2;
      return this.finishToken(types$1.arrow)
    }
    return this.finishOp(code === 61 ? types$1.eq : types$1.prefix, 1)
  };

  pp.readToken_question = function() { // '?'
    var ecmaVersion = this.options.ecmaVersion;
    if (ecmaVersion >= 11) {
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 46) {
        var next2 = this.input.charCodeAt(this.pos + 2);
        if (next2 < 48 || next2 > 57) { return this.finishOp(types$1.questionDot, 2) }
      }
      if (next === 63) {
        if (ecmaVersion >= 12) {
          var next2$1 = this.input.charCodeAt(this.pos + 2);
          if (next2$1 === 61) { return this.finishOp(types$1.assign, 3) }
        }
        return this.finishOp(types$1.coalesce, 2)
      }
    }
    return this.finishOp(types$1.question, 1)
  };

  pp.readToken_numberSign = function() { // '#'
    var ecmaVersion = this.options.ecmaVersion;
    var code = 35; // '#'
    if (ecmaVersion >= 13) {
      ++this.pos;
      code = this.fullCharCodeAtPos();
      if (isIdentifierStart(code, true) || code === 92 /* '\' */) {
        return this.finishToken(types$1.privateId, this.readWord1())
      }
    }

    this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
  };

  pp.getTokenFromCode = function(code) {
    switch (code) {
    // The interpretation of a dot depends on whether it is followed
    // by a digit or another two dots.
    case 46: // '.'
      return this.readToken_dot()

    // Punctuation tokens.
    case 40: ++this.pos; return this.finishToken(types$1.parenL)
    case 41: ++this.pos; return this.finishToken(types$1.parenR)
    case 59: ++this.pos; return this.finishToken(types$1.semi)
    case 44: ++this.pos; return this.finishToken(types$1.comma)
    case 91: ++this.pos; return this.finishToken(types$1.bracketL)
    case 93: ++this.pos; return this.finishToken(types$1.bracketR)
    case 123: ++this.pos; return this.finishToken(types$1.braceL)
    case 125: ++this.pos; return this.finishToken(types$1.braceR)
    case 58: ++this.pos; return this.finishToken(types$1.colon)

    case 96: // '`'
      if (this.options.ecmaVersion < 6) { break }
      ++this.pos;
      return this.finishToken(types$1.backQuote)

    case 48: // '0'
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 120 || next === 88) { return this.readRadixNumber(16) } // '0x', '0X' - hex number
      if (this.options.ecmaVersion >= 6) {
        if (next === 111 || next === 79) { return this.readRadixNumber(8) } // '0o', '0O' - octal number
        if (next === 98 || next === 66) { return this.readRadixNumber(2) } // '0b', '0B' - binary number
      }

    // Anything else beginning with a digit is an integer, octal
    // number, or float.
    case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9
      return this.readNumber(false)

    // Quotes produce strings.
    case 34: case 39: // '"', "'"
      return this.readString(code)

    // Operators are parsed inline in tiny state machines. '=' (61) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.
    case 47: // '/'
      return this.readToken_slash()

    case 37: case 42: // '%*'
      return this.readToken_mult_modulo_exp(code)

    case 124: case 38: // '|&'
      return this.readToken_pipe_amp(code)

    case 94: // '^'
      return this.readToken_caret()

    case 43: case 45: // '+-'
      return this.readToken_plus_min(code)

    case 60: case 62: // '<>'
      return this.readToken_lt_gt(code)

    case 61: case 33: // '=!'
      return this.readToken_eq_excl(code)

    case 63: // '?'
      return this.readToken_question()

    case 126: // '~'
      return this.finishOp(types$1.prefix, 1)

    case 35: // '#'
      return this.readToken_numberSign()
    }

    this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
  };

  pp.finishOp = function(type, size) {
    var str = this.input.slice(this.pos, this.pos + size);
    this.pos += size;
    return this.finishToken(type, str)
  };

  pp.readRegexp = function() {
    var escaped, inClass, start = this.pos;
    for (;;) {
      if (this.pos >= this.input.length) { this.raise(start, "Unterminated regular expression"); }
      var ch = this.input.charAt(this.pos);
      if (lineBreak.test(ch)) { this.raise(start, "Unterminated regular expression"); }
      if (!escaped) {
        if (ch === "[") { inClass = true; }
        else if (ch === "]" && inClass) { inClass = false; }
        else if (ch === "/" && !inClass) { break }
        escaped = ch === "\\";
      } else { escaped = false; }
      ++this.pos;
    }
    var pattern = this.input.slice(start, this.pos);
    ++this.pos;
    var flagsStart = this.pos;
    var flags = this.readWord1();
    if (this.containsEsc) { this.unexpected(flagsStart); }

    // Validate pattern
    var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));
    state.reset(start, pattern, flags);
    this.validateRegExpFlags(state);
    this.validateRegExpPattern(state);

    // Create Literal#value property value.
    var value = null;
    try {
      value = new RegExp(pattern, flags);
    } catch (e) {
      // ESTree requires null if it failed to instantiate RegExp object.
      // https://github.com/estree/estree/blob/a27003adf4fd7bfad44de9cef372a2eacd527b1c/es5.md#regexpliteral
    }

    return this.finishToken(types$1.regexp, {pattern: pattern, flags: flags, value: value})
  };

  // Read an integer in the given radix. Return null if zero digits
  // were read, the integer value otherwise. When `len` is given, this
  // will return `null` unless the integer has exactly `len` digits.

  pp.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {
    // `len` is used for character escape sequences. In that case, disallow separators.
    var allowSeparators = this.options.ecmaVersion >= 12 && len === undefined;

    // `maybeLegacyOctalNumericLiteral` is true if it doesn't have prefix (0x,0o,0b)
    // and isn't fraction part nor exponent part. In that case, if the first digit
    // is zero then disallow separators.
    var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;

    var start = this.pos, total = 0, lastCode = 0;
    for (var i = 0, e = len == null ? Infinity : len; i < e; ++i, ++this.pos) {
      var code = this.input.charCodeAt(this.pos), val = (void 0);

      if (allowSeparators && code === 95) {
        if (isLegacyOctalNumericLiteral) { this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals"); }
        if (lastCode === 95) { this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore"); }
        if (i === 0) { this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits"); }
        lastCode = code;
        continue
      }

      if (code >= 97) { val = code - 97 + 10; } // a
      else if (code >= 65) { val = code - 65 + 10; } // A
      else if (code >= 48 && code <= 57) { val = code - 48; } // 0-9
      else { val = Infinity; }
      if (val >= radix) { break }
      lastCode = code;
      total = total * radix + val;
    }

    if (allowSeparators && lastCode === 95) { this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits"); }
    if (this.pos === start || len != null && this.pos - start !== len) { return null }

    return total
  };

  function stringToNumber(str, isLegacyOctalNumericLiteral) {
    if (isLegacyOctalNumericLiteral) {
      return parseInt(str, 8)
    }

    // `parseFloat(value)` stops parsing at the first numeric separator then returns a wrong value.
    return parseFloat(str.replace(/_/g, ""))
  }

  function stringToBigInt(str) {
    if (typeof BigInt !== "function") {
      return null
    }

    // `BigInt(value)` throws syntax error if the string contains numeric separators.
    return BigInt(str.replace(/_/g, ""))
  }

  pp.readRadixNumber = function(radix) {
    var start = this.pos;
    this.pos += 2; // 0x
    var val = this.readInt(radix);
    if (val == null) { this.raise(this.start + 2, "Expected number in radix " + radix); }
    if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
      val = stringToBigInt(this.input.slice(start, this.pos));
      ++this.pos;
    } else if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }
    return this.finishToken(types$1.num, val)
  };

  // Read an integer, octal integer, or floating-point number.

  pp.readNumber = function(startsWithDot) {
    var start = this.pos;
    if (!startsWithDot && this.readInt(10, undefined, true) === null) { this.raise(start, "Invalid number"); }
    var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
    if (octal && this.strict) { this.raise(start, "Invalid number"); }
    var next = this.input.charCodeAt(this.pos);
    if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
      var val$1 = stringToBigInt(this.input.slice(start, this.pos));
      ++this.pos;
      if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }
      return this.finishToken(types$1.num, val$1)
    }
    if (octal && /[89]/.test(this.input.slice(start, this.pos))) { octal = false; }
    if (next === 46 && !octal) { // '.'
      ++this.pos;
      this.readInt(10);
      next = this.input.charCodeAt(this.pos);
    }
    if ((next === 69 || next === 101) && !octal) { // 'eE'
      next = this.input.charCodeAt(++this.pos);
      if (next === 43 || next === 45) { ++this.pos; } // '+-'
      if (this.readInt(10) === null) { this.raise(start, "Invalid number"); }
    }
    if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }

    var val = stringToNumber(this.input.slice(start, this.pos), octal);
    return this.finishToken(types$1.num, val)
  };

  // Read a string value, interpreting backslash-escapes.

  pp.readCodePoint = function() {
    var ch = this.input.charCodeAt(this.pos), code;

    if (ch === 123) { // '{'
      if (this.options.ecmaVersion < 6) { this.unexpected(); }
      var codePos = ++this.pos;
      code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
      ++this.pos;
      if (code > 0x10FFFF) { this.invalidStringToken(codePos, "Code point out of bounds"); }
    } else {
      code = this.readHexChar(4);
    }
    return code
  };

  pp.readString = function(quote) {
    var out = "", chunkStart = ++this.pos;
    for (;;) {
      if (this.pos >= this.input.length) { this.raise(this.start, "Unterminated string constant"); }
      var ch = this.input.charCodeAt(this.pos);
      if (ch === quote) { break }
      if (ch === 92) { // '\'
        out += this.input.slice(chunkStart, this.pos);
        out += this.readEscapedChar(false);
        chunkStart = this.pos;
      } else if (ch === 0x2028 || ch === 0x2029) {
        if (this.options.ecmaVersion < 10) { this.raise(this.start, "Unterminated string constant"); }
        ++this.pos;
        if (this.options.locations) {
          this.curLine++;
          this.lineStart = this.pos;
        }
      } else {
        if (isNewLine(ch)) { this.raise(this.start, "Unterminated string constant"); }
        ++this.pos;
      }
    }
    out += this.input.slice(chunkStart, this.pos++);
    return this.finishToken(types$1.string, out)
  };

  // Reads template string tokens.

  var INVALID_TEMPLATE_ESCAPE_ERROR = {};

  pp.tryReadTemplateToken = function() {
    this.inTemplateElement = true;
    try {
      this.readTmplToken();
    } catch (err) {
      if (err === INVALID_TEMPLATE_ESCAPE_ERROR) {
        this.readInvalidTemplateToken();
      } else {
        throw err
      }
    }

    this.inTemplateElement = false;
  };

  pp.invalidStringToken = function(position, message) {
    if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
      throw INVALID_TEMPLATE_ESCAPE_ERROR
    } else {
      this.raise(position, message);
    }
  };

  pp.readTmplToken = function() {
    var out = "", chunkStart = this.pos;
    for (;;) {
      if (this.pos >= this.input.length) { this.raise(this.start, "Unterminated template"); }
      var ch = this.input.charCodeAt(this.pos);
      if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) { // '`', '${'
        if (this.pos === this.start && (this.type === types$1.template || this.type === types$1.invalidTemplate)) {
          if (ch === 36) {
            this.pos += 2;
            return this.finishToken(types$1.dollarBraceL)
          } else {
            ++this.pos;
            return this.finishToken(types$1.backQuote)
          }
        }
        out += this.input.slice(chunkStart, this.pos);
        return this.finishToken(types$1.template, out)
      }
      if (ch === 92) { // '\'
        out += this.input.slice(chunkStart, this.pos);
        out += this.readEscapedChar(true);
        chunkStart = this.pos;
      } else if (isNewLine(ch)) {
        out += this.input.slice(chunkStart, this.pos);
        ++this.pos;
        switch (ch) {
        case 13:
          if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; }
        case 10:
          out += "\n";
          break
        default:
          out += String.fromCharCode(ch);
          break
        }
        if (this.options.locations) {
          ++this.curLine;
          this.lineStart = this.pos;
        }
        chunkStart = this.pos;
      } else {
        ++this.pos;
      }
    }
  };

  // Reads a template token to search for the end, without validating any escape sequences
  pp.readInvalidTemplateToken = function() {
    for (; this.pos < this.input.length; this.pos++) {
      switch (this.input[this.pos]) {
      case "\\":
        ++this.pos;
        break

      case "$":
        if (this.input[this.pos + 1] !== "{") {
          break
        }

      // falls through
      case "`":
        return this.finishToken(types$1.invalidTemplate, this.input.slice(this.start, this.pos))

      // no default
      }
    }
    this.raise(this.start, "Unterminated template");
  };

  // Used to read escaped characters

  pp.readEscapedChar = function(inTemplate) {
    var ch = this.input.charCodeAt(++this.pos);
    ++this.pos;
    switch (ch) {
    case 110: return "\n" // 'n' -> '\n'
    case 114: return "\r" // 'r' -> '\r'
    case 120: return String.fromCharCode(this.readHexChar(2)) // 'x'
    case 117: return codePointToString(this.readCodePoint()) // 'u'
    case 116: return "\t" // 't' -> '\t'
    case 98: return "\b" // 'b' -> '\b'
    case 118: return "\u000b" // 'v' -> '\u000b'
    case 102: return "\f" // 'f' -> '\f'
    case 13: if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; } // '\r\n'
    case 10: // ' \n'
      if (this.options.locations) { this.lineStart = this.pos; ++this.curLine; }
      return ""
    case 56:
    case 57:
      if (this.strict) {
        this.invalidStringToken(
          this.pos - 1,
          "Invalid escape sequence"
        );
      }
      if (inTemplate) {
        var codePos = this.pos - 1;

        this.invalidStringToken(
          codePos,
          "Invalid escape sequence in template string"
        );
      }
    default:
      if (ch >= 48 && ch <= 55) {
        var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
        var octal = parseInt(octalStr, 8);
        if (octal > 255) {
          octalStr = octalStr.slice(0, -1);
          octal = parseInt(octalStr, 8);
        }
        this.pos += octalStr.length - 1;
        ch = this.input.charCodeAt(this.pos);
        if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
          this.invalidStringToken(
            this.pos - 1 - octalStr.length,
            inTemplate
              ? "Octal literal in template string"
              : "Octal literal in strict mode"
          );
        }
        return String.fromCharCode(octal)
      }
      if (isNewLine(ch)) {
        // Unicode new line characters after \ get removed from output in both
        // template literals and strings
        return ""
      }
      return String.fromCharCode(ch)
    }
  };

  // Used to read character escape sequences ('\x', '\u', '\U').

  pp.readHexChar = function(len) {
    var codePos = this.pos;
    var n = this.readInt(16, len);
    if (n === null) { this.invalidStringToken(codePos, "Bad character escape sequence"); }
    return n
  };

  // Read an identifier, and return it as a string. Sets `this.containsEsc`
  // to whether the word contained a '\u' escape.
  //
  // Incrementally adds only escaped chars, adding other chunks as-is
  // as a micro-optimization.

  pp.readWord1 = function() {
    this.containsEsc = false;
    var word = "", first = true, chunkStart = this.pos;
    var astral = this.options.ecmaVersion >= 6;
    while (this.pos < this.input.length) {
      var ch = this.fullCharCodeAtPos();
      if (isIdentifierChar(ch, astral)) {
        this.pos += ch <= 0xffff ? 1 : 2;
      } else if (ch === 92) { // "\"
        this.containsEsc = true;
        word += this.input.slice(chunkStart, this.pos);
        var escStart = this.pos;
        if (this.input.charCodeAt(++this.pos) !== 117) // "u"
          { this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX"); }
        ++this.pos;
        var esc = this.readCodePoint();
        if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral))
          { this.invalidStringToken(escStart, "Invalid Unicode escape"); }
        word += codePointToString(esc);
        chunkStart = this.pos;
      } else {
        break
      }
      first = false;
    }
    return word + this.input.slice(chunkStart, this.pos)
  };

  // Read an identifier or keyword token. Will check for reserved
  // words when necessary.

  pp.readWord = function() {
    var word = this.readWord1();
    var type = types$1.name;
    if (this.keywords.test(word)) {
      type = keywords[word];
    }
    return this.finishToken(type, word)
  };

  // Acorn is a tiny, fast JavaScript parser written in JavaScript.
  //
  // Acorn was written by Marijn Haverbeke, Ingvar Stepanyan, and
  // various contributors and released under an MIT license.
  //
  // Git repositories for Acorn are available at
  //
  //     http://marijnhaverbeke.nl/git/acorn
  //     https://github.com/acornjs/acorn.git
  //
  // Please use the [github bug tracker][ghbt] to report issues.
  //
  // [ghbt]: https://github.com/acornjs/acorn/issues
  //
  // [walk]: util/walk.js


  var version = "8.10.0";

  Parser.acorn = {
    Parser: Parser,
    version: version,
    defaultOptions: defaultOptions,
    Position: Position,
    SourceLocation: SourceLocation,
    getLineInfo: getLineInfo,
    Node: Node,
    TokenType: TokenType,
    tokTypes: types$1,
    keywordTypes: keywords,
    TokContext: TokContext,
    tokContexts: types,
    isIdentifierChar: isIdentifierChar,
    isIdentifierStart: isIdentifierStart,
    Token: Token,
    isNewLine: isNewLine,
    lineBreak: lineBreak,
    lineBreakG: lineBreakG,
    nonASCIIwhitespace: nonASCIIwhitespace
  };

  // The main exported interface (under `self.acorn` when in the
  // browser) is a `parse` function that takes a code string and
  // returns an abstract syntax tree as specified by [Mozilla parser
  // API][api].
  //
  // [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

  function parse(input, options) {
    return Parser.parse(input, options)
  }

  // This function tries to parse a single expression at a given
  // offset in a string. Useful for parsing mixed-language formats
  // that embed JavaScript expressions.

  function parseExpressionAt(input, pos, options) {
    return Parser.parseExpressionAt(input, pos, options)
  }

  // Acorn is organized as a tokenizer and a recursive-descent parser.
  // The `tokenizer` export provides an interface to the tokenizer.

  function tokenizer(input, options) {
    return Parser.tokenizer(input, options)
  }

  exports.Node = Node;
  exports.Parser = Parser;
  exports.Position = Position;
  exports.SourceLocation = SourceLocation;
  exports.TokContext = TokContext;
  exports.Token = Token;
  exports.TokenType = TokenType;
  exports.defaultOptions = defaultOptions;
  exports.getLineInfo = getLineInfo;
  exports.isIdentifierChar = isIdentifierChar;
  exports.isIdentifierStart = isIdentifierStart;
  exports.isNewLine = isNewLine;
  exports.keywordTypes = keywords;
  exports.lineBreak = lineBreak;
  exports.lineBreakG = lineBreakG;
  exports.nonASCIIwhitespace = nonASCIIwhitespace;
  exports.parse = parse;
  exports.parseExpressionAt = parseExpressionAt;
  exports.tokContexts = types;
  exports.tokTypes = types$1;
  exports.tokenizer = tokenizer;
  exports.version = version;

}));


/***/ }),

/***/ "./src/widget/Applet.ts":
/*!******************************!*\
  !*** ./src/widget/Applet.ts ***!
  \******************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Runnable = void 0;
const index_1 = __webpack_require__(/*! ./utils/index */ "./src/widget/utils/index.ts");
class Runnable {
    constructor(root, mount) {
        this.root = root;
        this.mount = mount;
    }
}
exports.Runnable = Runnable;
class Applet {
    get key() { return this._key; }
    findModule(id) { return this._modules[id]; }
    putModule(module) {
        module.setApplet(this);
        this._modules[module.key] = module;
    }
    removeModule(key) { delete this._modules[key]; }
    fill(jsxCode) {
        this.middleCode = index_1.default.compiler.parse(jsxCode);
        console.log(JSON.stringify(this.middleCode));
        let r = index_1.default.compiler.extractModules(this.middleCode, this);
        r.forEach((module) => this.putModule(module));
    }
    onCreatureStateChange(creature, newVersion) {
        let oldVersion = this.oldVersions[creature._key];
        this.oldVersions[creature._key] = newVersion;
        let updates = index_1.default.json.diff(oldVersion, newVersion);
        updates.forEach((u) => {
            if (u.__action__ === 'element_deleted') {
                delete this.cache.elements[u.__key__];
            }
        });
        this.update(oldVersion._key, updates);
    }
    run(genesis, nativeBuilder, update) {
        return new Promise(resolve => {
            this._nativeBuilder = nativeBuilder;
            this.update = update;
            this.firstMount = false;
            this.cache.elements = {};
            this.cache.mounts = [];
            let genesisMod = this._modules[genesis];
            this._genesisCreature = genesisMod.instantiate();
            let genesisMetaContext = index_1.default.generator.nestedContext(this._genesisCreature);
            this.cache.mounts.push(() => this._genesisCreature.getBaseMethod('onMount')(genesisMetaContext));
            this._genesisCreature.getBaseMethod('constructor')(genesisMetaContext);
            let view = this._genesisCreature.getBaseMethod('render')(genesisMetaContext);
            this.oldVersions[this._genesisCreature._key] = view;
            resolve(new Runnable(view, () => {
                this.firstMount = true;
                this.cache.mounts.reverse().forEach((onMount) => onMount());
            }));
        });
    }
    constructor(key, modules) {
        this.cache = {
            elements: {},
            mounts: []
        };
        this.oldVersions = {};
        this.firstMount = false;
        this._key = key;
        this._modules = modules ? modules : {};
    }
}
exports["default"] = Applet;


/***/ }),

/***/ "./src/widget/Creature.ts":
/*!********************************!*\
  !*** ./src/widget/Creature.ts ***!
  \********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const DOM_1 = __webpack_require__(/*! ./DOM */ "./src/widget/DOM.ts");
const ExecutionMeta_1 = __webpack_require__(/*! ./ExecutionMeta */ "./src/widget/ExecutionMeta.ts");
const Runtime_1 = __webpack_require__(/*! ./Runtime */ "./src/widget/Runtime.ts");
const utils_1 = __webpack_require__(/*! ./utils */ "./src/widget/utils/index.ts");
class Creature {
    get key() { return this._key; }
    get cosmoId() { return this._cosmoId; }
    setCosmoId(cosmoId) { this._cosmoId = cosmoId; }
    get module() { return this._module; }
    get runtime() { return this._runtime; }
    get dom() { return this._dom; }
    getBaseMethod(methodId) {
        return this._runtime.stack[0].findUnit(methodId);
    }
    update(props, styles, children) {
        this.thisObj = Object.assign(Object.assign({}, this.thisObj), { props,
            styles,
            children });
    }
    fillChildren(children) {
        this.thisObj.children = children;
    }
    constructor(module, defaultValues) {
        this._key = (defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues._key) ? defaultValues._key : utils_1.default.generator.generateKey();
        this._cosmoId = defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.cosmoId;
        this._module = module;
        this._dom = (defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.dom) ? defaultValues.dom : new DOM_1.default(this._module, this);
        this._runtime = (defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.runtime) ? defaultValues.runtime : new Runtime_1.default(this._module, this);
        this.thisObj = defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.thisObj;
        if (!(defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.runtime)) {
            this._runtime.load();
        }
        if (!this.thisObj) {
            this.thisObj = {};
            Object.keys(this._runtime.stack[0].units).forEach(k => {
                if (!this._runtime.native[k] || (k === 'constructor')) {
                    this.thisObj[k] = this._runtime.stack[0].units[k];
                }
            });
            this.thisObj = {};
        }
        this.thisObj['setState'] = (stateUpdate) => {
            this.thisObj['state'] = Object.assign(Object.assign({}, this.thisObj['state']), stateUpdate);
            let newMetaBranch = new ExecutionMeta_1.default({ creature: this, parentJsxKey: this.thisObj['parentJsxKey'] });
            let newRender = this.getBaseMethod('render')(newMetaBranch);
            this._module.applet.onCreatureStateChange(this, newRender);
        };
    }
}
exports["default"] = Creature;


/***/ }),

/***/ "./src/widget/CreatureStore.ts":
/*!*************************************!*\
  !*** ./src/widget/CreatureStore.ts ***!
  \*************************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class CreatureStore {
    putCreature(creature) { this._store[creature.key] = creature; }
    removeCreature(key) { delete this._store[key]; }
    findCreature(key) { return this._store[key]; }
    constructor() {
        this._store = {};
    }
}
exports["default"] = CreatureStore;


/***/ }),

/***/ "./src/widget/DOM.ts":
/*!***************************!*\
  !*** ./src/widget/DOM.ts ***!
  \***************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class DOM {
    get module() { return this._module; }
    get creature() { return this._creature; }
    get root() { return this._root; }
    setRoot(root) { this._root = root; }
    constructor(module, creature, root) {
        this._module = module;
        this._creature = creature;
        this._root = root;
    }
}
exports["default"] = DOM;


/***/ }),

/***/ "./src/widget/ExecutionMeta.ts":
/*!*************************************!*\
  !*** ./src/widget/ExecutionMeta.ts ***!
  \*************************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class ExecutionMeta {
    constructor(metaDict) {
        this.creature = metaDict.creature;
        this.declaration = (metaDict.declaration === true);
        this.declarationType = metaDict.declarationType;
        this.returnIdParent = metaDict.returnIdParent;
        this.isAnotherCreature = metaDict.isAnotherCreature;
        this.parentJsxKey = metaDict.parentJsxKey;
        if (this.declaration && !this.declarationType) {
        }
    }
}
exports["default"] = ExecutionMeta;


/***/ }),

/***/ "./src/widget/FuncStore.ts":
/*!*********************************!*\
  !*** ./src/widget/FuncStore.ts ***!
  \*********************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class FuncStore {
    get store() { return this._store; }
    putFunc(func) { this._store[func.key] = func; }
    removeFunc(key) { delete this._store[key]; }
    findFunc(key) { return this._store[key]; }
    constructor() {
        this._store = {};
    }
}
exports["default"] = FuncStore;


/***/ }),

/***/ "./src/widget/MemoryLayer.ts":
/*!***********************************!*\
  !*** ./src/widget/MemoryLayer.ts ***!
  \***********************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class MemoryLayer {
    get units() { return this._units; }
    findUnit(key) { return this._units[key]; }
    putUnit(key, unit) { this._units[key] = unit; }
    removeUnit(key) { delete this._units[key]; }
    constructor(initialUnits) {
        this._units = initialUnits ? initialUnits : {};
    }
}
exports["default"] = MemoryLayer;


/***/ }),

/***/ "./src/widget/Module.ts":
/*!******************************!*\
  !*** ./src/widget/Module.ts ***!
  \******************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const Creature_1 = __webpack_require__(/*! ./Creature */ "./src/widget/Creature.ts");
const CreatureStore_1 = __webpack_require__(/*! ./CreatureStore */ "./src/widget/CreatureStore.ts");
const DOM_1 = __webpack_require__(/*! ./DOM */ "./src/widget/DOM.ts");
const FuncStore_1 = __webpack_require__(/*! ./FuncStore */ "./src/widget/FuncStore.ts");
class Module {
    get applet() { return this._applet; }
    setApplet(applet) { this._applet = applet; }
    get creatures() { return this._creatures; }
    get key() { return this._key; }
    get funcs() { return this._funcs; }
    get dom() { return this._dom; }
    get ast() { return this._ast; }
    setAst(ast) { this._ast = ast; }
    instantiate(props, styles, children, thisObj) {
        let creature = new Creature_1.default(this, {
            cosmoId: props === null || props === void 0 ? void 0 : props.key,
            thisObj: thisObj ? Object.assign(Object.assign({}, thisObj), { props: props ? props : {}, styles: styles ? styles : {}, children: children ? children : [] }) : {
                props: props ? props : {},
                styles: styles ? styles : {},
                children: children ? children : []
            }
        });
        this._creatures.putCreature(creature);
        return creature;
    }
    constructor(key, applet, ast) {
        this._key = key;
        this._applet = applet;
        this._ast = ast;
        this._creatures = new CreatureStore_1.default();
        this._funcs = new FuncStore_1.default();
        this._dom = new DOM_1.default(this);
    }
}
exports["default"] = Module;


/***/ }),

/***/ "./src/widget/Runtime.ts":
/*!*******************************!*\
  !*** ./src/widget/Runtime.ts ***!
  \*******************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const MemoryLayer_1 = __webpack_require__(/*! ./MemoryLayer */ "./src/widget/MemoryLayer.ts");
const utils_1 = __webpack_require__(/*! ./utils */ "./src/widget/utils/index.ts");
class Runtime {
    get module() { return this._module; }
    get creature() { return this._creature; }
    get native() { return this._native; }
    pushOnStack(initialUnits) { this.stack.push(new MemoryLayer_1.default(initialUnits)); }
    popFromStack() { this.stack.pop(); }
    get stackTop() { return this.stack[this.stack.length - 1]; }
    resetStack() {
        this.stack = [];
        this.pushOnStack(Object.assign({}, this._native));
    }
    reset() {
        this.resetStack();
    }
    execute(ast) {
        utils_1.default.executor.executeBlock(ast, new utils_1.default.executor.ExecutionMeta({ creature: this._creature }));
    }
    load() {
        this.execute(this.module.ast.body.body);
    }
    clone() {
        let copy = new Runtime(this.module, this.creature, { native: this.native, stack: new Array(...this.stack) });
        return copy;
    }
    constructor(module, creature, reusableTools) {
        this.stack = [];
        this._module = module;
        this._creature = creature;
        this._native = (reusableTools === null || reusableTools === void 0 ? void 0 : reusableTools.native) ? reusableTools.native : this._module.applet._nativeBuilder(this._module);
        if (reusableTools === null || reusableTools === void 0 ? void 0 : reusableTools.stack) {
            this.stack = reusableTools.stack;
        }
        else {
            this.reset();
        }
    }
}
exports["default"] = Runtime;


/***/ }),

/***/ "./src/widget/controls/BaseControl.ts":
/*!********************************************!*\
  !*** ./src/widget/controls/BaseControl.ts ***!
  \********************************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class BaseControl {
}
exports["default"] = BaseControl;


/***/ }),

/***/ "./src/widget/controls/BoxControl.ts":
/*!*******************************************!*\
  !*** ./src/widget/controls/BoxControl.ts ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BaseControl_1 = __webpack_require__(/*! ./BaseControl */ "./src/widget/controls/BaseControl.ts");
const utils_1 = __webpack_require__(/*! ../utils */ "./src/widget/utils/index.ts");
class BoxControl extends BaseControl_1.default {
    static instantiate(overridenProps, overridenStyles, children) {
        return utils_1.default.generator.prepareElement(BoxControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
    }
}
BoxControl.TYPE = 'box';
BoxControl.defaultProps = {};
BoxControl.defaultStyles = {
    width: 200,
    height: 200
};
exports["default"] = BoxControl;


/***/ }),

/***/ "./src/widget/controls/ButtonControl.ts":
/*!**********************************************!*\
  !*** ./src/widget/controls/ButtonControl.ts ***!
  \**********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BaseControl_1 = __webpack_require__(/*! ./BaseControl */ "./src/widget/controls/BaseControl.ts");
const StringProp_1 = __webpack_require__(/*! ../props/StringProp */ "./src/widget/props/StringProp.ts");
const utils_1 = __webpack_require__(/*! ../utils */ "./src/widget/utils/index.ts");
const FuncProp_1 = __webpack_require__(/*! ../props/FuncProp */ "./src/widget/props/FuncProp.ts");
class ButtonControl extends BaseControl_1.default {
    static instantiate(overridenProps, overridenStyles, children) {
        return utils_1.default.generator.prepareElement(ButtonControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
    }
}
ButtonControl.TYPE = 'button';
ButtonControl.defaultProps = {
    caption: new StringProp_1.default(''),
    variant: new StringProp_1.default('filled'),
    onClick: new FuncProp_1.default(undefined)
};
ButtonControl.defaultStyles = {
    width: 150,
    height: 'auto'
};
exports["default"] = ButtonControl;


/***/ }),

/***/ "./src/widget/controls/CardControl.ts":
/*!********************************************!*\
  !*** ./src/widget/controls/CardControl.ts ***!
  \********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BaseControl_1 = __webpack_require__(/*! ./BaseControl */ "./src/widget/controls/BaseControl.ts");
const utils_1 = __webpack_require__(/*! ../utils */ "./src/widget/utils/index.ts");
class CardControl extends BaseControl_1.default {
    static instantiate(overridenProps, overridenStyles, children) {
        return utils_1.default.generator.prepareElement(CardControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
    }
}
CardControl.TYPE = 'card';
CardControl.defaultProps = {};
CardControl.defaultStyles = {
    width: 200,
    height: 200,
    boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px',
    backgroundColor: '#fff',
    borderRadius: 4
};
exports["default"] = CardControl;


/***/ }),

/***/ "./src/widget/controls/PrimaryTabControl.ts":
/*!**************************************************!*\
  !*** ./src/widget/controls/PrimaryTabControl.ts ***!
  \**************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BaseControl_1 = __webpack_require__(/*! ./BaseControl */ "./src/widget/controls/BaseControl.ts");
const utils_1 = __webpack_require__(/*! ../utils */ "./src/widget/utils/index.ts");
class PrimaryTabControl extends BaseControl_1.default {
    static instantiate(overridenProps, overridenStyles, children) {
        return utils_1.default.generator.prepareElement(PrimaryTabControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
    }
}
PrimaryTabControl.TYPE = 'primary-tab';
PrimaryTabControl.defaultProps = {};
PrimaryTabControl.defaultStyles = {};
exports["default"] = PrimaryTabControl;


/***/ }),

/***/ "./src/widget/controls/TabsControl.ts":
/*!********************************************!*\
  !*** ./src/widget/controls/TabsControl.ts ***!
  \********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BaseControl_1 = __webpack_require__(/*! ./BaseControl */ "./src/widget/controls/BaseControl.ts");
const utils_1 = __webpack_require__(/*! ../utils */ "./src/widget/utils/index.ts");
const FuncProp_1 = __webpack_require__(/*! ../props/FuncProp */ "./src/widget/props/FuncProp.ts");
class TabsControl extends BaseControl_1.default {
    static instantiate(overridenProps, overridenStyles, children) {
        return utils_1.default.generator.prepareElement(TabsControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
    }
}
TabsControl.TYPE = 'tabs';
TabsControl.defaultProps = {
    onChange: new FuncProp_1.default(undefined)
};
TabsControl.defaultStyles = {};
exports["default"] = TabsControl;


/***/ }),

/***/ "./src/widget/controls/TextControl.ts":
/*!********************************************!*\
  !*** ./src/widget/controls/TextControl.ts ***!
  \********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BaseControl_1 = __webpack_require__(/*! ./BaseControl */ "./src/widget/controls/BaseControl.ts");
const StringProp_1 = __webpack_require__(/*! ../props/StringProp */ "./src/widget/props/StringProp.ts");
const utils_1 = __webpack_require__(/*! ../utils */ "./src/widget/utils/index.ts");
class TextControl extends BaseControl_1.default {
    static instantiate(overridenProps, overridenStyles, children) {
        return utils_1.default.generator.prepareElement(TextControl.TYPE, this.defaultProps, overridenProps, this.defaultStyles, overridenStyles, children);
    }
}
TextControl.TYPE = 'text';
TextControl.defaultProps = {
    text: new StringProp_1.default('')
};
TextControl.defaultStyles = {
    width: 150,
    height: 'auto'
};
exports["default"] = TextControl;


/***/ }),

/***/ "./src/widget/controls/index.ts":
/*!**************************************!*\
  !*** ./src/widget/controls/index.ts ***!
  \**************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BoxControl_1 = __webpack_require__(/*! ./BoxControl */ "./src/widget/controls/BoxControl.ts");
const ButtonControl_1 = __webpack_require__(/*! ./ButtonControl */ "./src/widget/controls/ButtonControl.ts");
const CardControl_1 = __webpack_require__(/*! ./CardControl */ "./src/widget/controls/CardControl.ts");
const TabsControl_1 = __webpack_require__(/*! ./TabsControl */ "./src/widget/controls/TabsControl.ts");
const PrimaryTabControl_1 = __webpack_require__(/*! ./PrimaryTabControl */ "./src/widget/controls/PrimaryTabControl.ts");
const TextControl_1 = __webpack_require__(/*! ./TextControl */ "./src/widget/controls/TextControl.ts");
exports["default"] = {
    [TextControl_1.default.TYPE]: TextControl_1.default,
    [ButtonControl_1.default.TYPE]: ButtonControl_1.default,
    [BoxControl_1.default.TYPE]: BoxControl_1.default,
    [CardControl_1.default.TYPE]: CardControl_1.default,
    [TabsControl_1.default.TYPE]: TabsControl_1.default,
    [PrimaryTabControl_1.default.TYPE]: PrimaryTabControl_1.default
};


/***/ }),

/***/ "./src/widget/elements/BaseElement.ts":
/*!********************************************!*\
  !*** ./src/widget/elements/BaseElement.ts ***!
  \********************************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class BaseElement {
    get key() { return this._key; }
    get controlType() { return this._controlType; }
    get props() { return this._props; }
    get styles() { return this._styles; }
    get children() { return this._children; }
    update(props, styles, children) {
        if (props)
            this._props = props;
        if (styles)
            this._styles = styles;
        if (children)
            this._children = children;
    }
    constructor(key, controlType, props, styles, children) {
        this._key = key;
        this._controlType = controlType;
        this._props = props;
        this._styles = styles;
        this._children = children ? children : [];
    }
}
exports["default"] = BaseElement;


/***/ }),

/***/ "./src/widget/props/BaseProp.ts":
/*!**************************************!*\
  !*** ./src/widget/props/BaseProp.ts ***!
  \**************************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class BaseProp {
    get type() { return this._type; }
    constructor(type) {
        this._type = type;
    }
}
exports["default"] = BaseProp;


/***/ }),

/***/ "./src/widget/props/FuncProp.ts":
/*!**************************************!*\
  !*** ./src/widget/props/FuncProp.ts ***!
  \**************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BaseProp_1 = __webpack_require__(/*! ./BaseProp */ "./src/widget/props/BaseProp.ts");
class FuncProp extends BaseProp_1.default {
    get value() { return this._value; }
    setValue(v) { this._value = v; }
    getValue() { return this._value; }
    get defaultValue() { return this._defaultValue; }
    constructor(defaultValue) {
        super('function');
        this._value = defaultValue;
        this._defaultValue = defaultValue;
    }
}
exports["default"] = FuncProp;


/***/ }),

/***/ "./src/widget/props/StringProp.ts":
/*!****************************************!*\
  !*** ./src/widget/props/StringProp.ts ***!
  \****************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BaseProp_1 = __webpack_require__(/*! ./BaseProp */ "./src/widget/props/BaseProp.ts");
class StringProp extends BaseProp_1.default {
    get value() { return this._value; }
    setValue(v) { this._value = v; }
    getValue() { return this._value; }
    get defaultValue() { return this._defaultValue; }
    constructor(defaultValue) {
        super('string');
        this._value = defaultValue;
        this._defaultValue = defaultValue;
    }
}
exports["default"] = StringProp;


/***/ }),

/***/ "./src/widget/utils/compiler.ts":
/*!**************************************!*\
  !*** ./src/widget/utils/compiler.ts ***!
  \**************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const acorn_1 = __webpack_require__(/*! acorn */ "./node_modules/acorn/dist/acorn.js");
const jsx = __webpack_require__(/*! acorn-jsx */ "./node_modules/acorn-jsx/index.js");
const Module_1 = __webpack_require__(/*! ../Module */ "./src/widget/Module.ts");
const cssProperty_1 = __webpack_require__(/*! ./cssProperty */ "./src/widget/utils/cssProperty.ts");
const hyphenateStyleName_1 = __webpack_require__(/*! ./hyphenateStyleName */ "./src/widget/utils/hyphenateStyleName.ts");
let { isUnitlessNumber } = cssProperty_1.default;
let jsxCompiler = acorn_1.Parser.extend(jsx());
var isArray = Array.isArray;
var keys = Object.keys;
var counter = 1;
var unquotedContentValueRegex = /^(normal|none|(\b(url\([^)]*\)|chapter_counter|attr\([^)]*\)|(no-)?(open|close)-quote|inherit)((\b\s*)|$|\s+))+)$/;
function buildRule(key, value) {
    if (!isUnitlessNumber[key] && typeof value === 'number') {
        value = '' + value + 'px';
    }
    else if (key === 'content' && !unquotedContentValueRegex.test(value)) {
        value = "'" + value.replace(/'/g, "\\'") + "'";
    }
    return (0, hyphenateStyleName_1.default)(key) + ': ' + value + ';  ';
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
function styleToCssString(rules) {
    var result = '';
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
let parse = (jsxCode) => {
    return jsxCompiler.parse(jsxCode, { sourceType: 'module', ecmaVersion: 'latest' });
};
let extractModules = (middleCode, applet) => {
    return middleCode.body
        .filter((declaration) => declaration.type === 'ClassDeclaration')
        .map((declaration) => {
        return new Module_1.default(declaration.id.name, applet, declaration);
    });
};
exports["default"] = { parse, extractModules, styleToCssString, buildRule, buildValue };


/***/ }),

/***/ "./src/widget/utils/cssProperty.ts":
/*!*****************************************!*\
  !*** ./src/widget/utils/cssProperty.ts ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
var isUnitlessNumber = {
    boxFlex: true,
    boxFlexGroup: true,
    columnCount: true,
    flex: true,
    flexGrow: true,
    flexPositive: true,
    flexShrink: true,
    flexNegative: true,
    fontWeight: true,
    lineClamp: true,
    lineHeight: true,
    opacity: true,
    order: true,
    orphans: true,
    widows: true,
    zIndex: true,
    zoom: true,
    fillOpacity: true,
    strokeDashoffset: true,
    strokeOpacity: true,
    strokeWidth: true
};
function prefixKey(prefix, key) {
    return prefix + key.charAt(0).toUpperCase() + key.substring(1);
}
var prefixes = ['Webkit', 'ms', 'Moz', 'O'];
Object.keys(isUnitlessNumber).forEach(function (prop) {
    prefixes.forEach(function (prefix) {
        isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
    });
});
var shorthandPropertyExpansions = {
    background: {
        backgroundImage: true,
        backgroundPosition: true,
        backgroundRepeat: true,
        backgroundColor: true
    },
    border: {
        borderWidth: true,
        borderStyle: true,
        borderColor: true
    },
    borderBottom: {
        borderBottomWidth: true,
        borderBottomStyle: true,
        borderBottomColor: true
    },
    borderLeft: {
        borderLeftWidth: true,
        borderLeftStyle: true,
        borderLeftColor: true
    },
    borderRight: {
        borderRightWidth: true,
        borderRightStyle: true,
        borderRightColor: true
    },
    borderTop: {
        borderTopWidth: true,
        borderTopStyle: true,
        borderTopColor: true
    },
    font: {
        fontStyle: true,
        fontVariant: true,
        fontWeight: true,
        fontSize: true,
        lineHeight: true,
        fontFamily: true
    }
};
var CSSProperty = {
    isUnitlessNumber: isUnitlessNumber,
    shorthandPropertyExpansions: shorthandPropertyExpansions
};
exports["default"] = CSSProperty;


/***/ }),

/***/ "./src/widget/utils/executor.ts":
/*!**************************************!*\
  !*** ./src/widget/utils/executor.ts ***!
  \**************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const Creature_1 = __webpack_require__(/*! ../Creature */ "./src/widget/Creature.ts");
const ExecutionMeta_1 = __webpack_require__(/*! ../ExecutionMeta */ "./src/widget/ExecutionMeta.ts");
const _1 = __webpack_require__(/*! . */ "./src/widget/utils/index.ts");
let executeSingle = (code, meta) => {
    let callback = codeCallbacks[code.type];
    if (callback) {
        let r = callback(code, meta);
        return r;
    }
    else {
        return code;
    }
};
let executeBlock = (codes, meta) => {
    for (let i = 0; i < codes.length; i++) {
        let code = codes[i];
        let r = executeSingle(code, meta);
        if (r === null || r === void 0 ? void 0 : r.returnFired)
            return r;
    }
};
let findLayer = (meta, id) => {
    for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
        let r = meta.creature._runtime.stack[i].findUnit(id);
        if (r !== undefined) {
            return meta.creature.runtime.stack[i];
        }
    }
};
const generateCallbackFunction = (code, meta) => {
    let newMetaBranch = meta;
    return (...args) => {
        let parameters = {};
        code.params.forEach((param, index) => {
            parameters[param.name] = args[index];
        });
        let firstParam = args[0];
        if (firstParam && (firstParam instanceof ExecutionMeta_1.default) && firstParam.isAnotherCreature) {
            newMetaBranch = firstParam;
        }
        newMetaBranch.creature.runtime.pushOnStack(parameters);
        let result = executeSingle(code.body, newMetaBranch);
        newMetaBranch.creature.runtime.popFromStack();
        return result === null || result === void 0 ? void 0 : result.value;
    };
};
let codeCallbacks = {
    UnaryExpression: (code, meta) => {
        if (code.operator === '!') {
            return !executeSingle(code.argument, meta);
        }
    },
    LogicalExpression: (code, meta) => {
        if (code.operator === '&&') {
            return executeSingle(code.left, meta) && executeSingle(code.right, meta);
        }
        else if (code.operator === '||') {
            return executeSingle(code.left, meta) || executeSingle(code.right, meta);
        }
    },
    ConditionalExpression: (code, meta) => {
        return executeSingle(code.test, meta) ? executeSingle(code.consequent, meta) : executeSingle(code.alternate, meta);
    },
    ThisExpression: (code, meta) => {
        return meta.creature.thisObj;
    },
    JSXExpressionContainer: (code, meta) => {
        return executeSingle(code.expression, meta);
    },
    JSXText: (code, meta) => {
        return code.value.trim();
    },
    JSXElement: (code, meta) => {
        if (!code.cosmoId)
            code.cosmoId = _1.default.generator.generateKey();
        let Control = meta.creature.module.applet.findModule(code.openingElement.name.name);
        let attrs = {};
        code.openingElement.attributes.forEach((attr) => {
            attrs[attr.name.name] = executeSingle(attr.value, meta);
        });
        let key = attrs['key'];
        if (key === undefined) {
            key = code.cosmoId;
        }
        if (meta.parentJsxKey)
            key = meta.parentJsxKey + '-' + key;
        attrs['key'] = key;
        let c = meta.creature.module.applet.cache.elements[key];
        let isNew = (c === undefined);
        c = Control.instantiate(attrs, attrs['style'], [], c === null || c === void 0 ? void 0 : c.thisObj);
        let childMeta = new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { parentJsxKey: key }));
        let children = code.children.map((child) => executeSingle(child, childMeta))
            .flat(Infinity).filter((child) => (child !== ''));
        c.fillChildren(children);
        if (meta.parentJsxKey)
            c.thisObj.parentJsxKey = meta.parentJsxKey;
        let newMetaBranch = _1.default.generator.nestedContext(c, Object.assign(Object.assign({}, meta), { parentJsxKey: key }));
        meta.creature.module.applet.cache.elements[key] = c;
        if (isNew)
            c.getBaseMethod('constructor')(newMetaBranch);
        if (meta.creature.module.applet.firstMount) {
            c.getBaseMethod('onMount')(newMetaBranch);
        }
        else {
            meta.creature.module.applet.cache.mounts.push(() => c.getBaseMethod('onMount')(newMetaBranch));
        }
        let r = c.getBaseMethod('render')(newMetaBranch);
        if (!meta.creature.module.applet.oldVersions[c._key]) {
            meta.creature.module.applet.oldVersions[c._key] = r;
        }
        return r;
    },
    Program: (code, meta) => {
        code.body.forEach((child) => {
            executeSingle(child, meta);
        });
    },
    Literal: (code, meta) => {
        return code.value;
    },
    FunctionExpression: (code, meta) => {
        let newCreatureBranch = new Creature_1.default(meta.creature.module, Object.assign(Object.assign({}, meta.creature), { runtime: meta.creature.runtime.clone() }));
        let newMetaBranch = new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { creature: newCreatureBranch }));
        return generateCallbackFunction(code, newMetaBranch);
    },
    FunctionDeclaration: (code, meta) => {
        let newCreatureBranch = new Creature_1.default(meta.creature.module, Object.assign(Object.assign({}, meta.creature), { runtime: meta.creature.runtime.clone() }));
        let newMetaBranch = new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { creature: newCreatureBranch }));
        meta.creature.runtime.stackTop.putUnit(code.id.name, generateCallbackFunction(code, newMetaBranch));
    },
    MethodDefinition: (code, meta) => {
        meta.creature.runtime.stackTop.putUnit(code.key.name, executeSingle(code.value, meta));
    },
    VariableDeclaration: (code, meta) => {
        if (code.kind === 'let') {
            code.declarations.forEach((d) => executeSingle(d, new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { declaration: true, declarationType: 'let' }))));
        }
        else if (code.kind === 'const') {
            code.declarations.forEach((d) => executeSingle(d, new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { declaration: true, declarationType: 'const' }))));
        }
    },
    VariableDeclarator: (code, meta) => {
        if (meta === null || meta === void 0 ? void 0 : meta.declaration) {
            let val = executeSingle(code.init, meta);
            if (code.id.type === 'ObjectPattern') {
                code.id.properties.forEach((property) => {
                    meta.creature.runtime.stackTop.putUnit(property.key.name, val[property.key.name]);
                });
            }
            else {
                meta.creature.runtime.stackTop.putUnit(code.id.name, val);
            }
        }
    },
    Identifier: (code, meta) => {
        if (meta.returnIdParent) {
            for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
                let wrapper = findLayer(meta, code.name);
                if (wrapper) {
                    return { parent: wrapper.units, id: code.name };
                }
            }
        }
        else {
            for (let i = meta.creature.runtime.stack.length - 1; i >= 0; i--) {
                let r = meta.creature.runtime.stack[i].findUnit(code.name);
                if (r !== undefined) {
                    return r;
                }
            }
        }
    },
    BinaryExpression: (code, meta) => {
        if (code.operator === '+') {
            return executeSingle(code.left, meta) + executeSingle(code.right, meta);
        }
        else if (code.operator === '-') {
            return executeSingle(code.left, meta) - executeSingle(code.right, meta);
        }
        else if (code.operator === '*') {
            return executeSingle(code.left, meta) * executeSingle(code.right, meta);
        }
        else if (code.operator === '/') {
            return executeSingle(code.left, meta) / executeSingle(code.right, meta);
        }
        else if (code.operator === '^') {
            return Math.pow(executeSingle(code.left, meta), executeSingle(code.right, meta));
        }
        else if (code.operator === '%') {
            return executeSingle(code.left, meta) % executeSingle(code.right, meta);
        }
        else if (code.operator === '===') {
            return executeSingle(code.left, meta) === executeSingle(code.right, meta);
        }
        else if (code.operator === '<') {
            return executeSingle(code.left, meta) < executeSingle(code.right, meta);
        }
        else if (code.operator === '>') {
            return executeSingle(code.left, meta) > executeSingle(code.right, meta);
        }
        else if (code.operator === '&') {
            return executeSingle(code.left, meta) & executeSingle(code.right, meta);
        }
        else if (code.operator === '|') {
            return executeSingle(code.left, meta) | executeSingle(code.right, meta);
        }
    },
    IfStatement: (code, meta) => {
        if (executeSingle(code.test, meta)) {
            let r = executeSingle(code.consequent, meta);
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                return r;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
        else if (code.alternate) {
            let r = executeSingle(code.alternate, meta);
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                return r;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
    },
    BreakStatement: (code, meta) => {
        return { breakFired: true };
    },
    WhileStatement: (code, meta) => {
        while (executeSingle(code.test, meta)) {
            let r = executeSingle(code.body, meta);
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                break;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
    },
    BlockStatement: (code, meta) => {
        var _a;
        for (let i = 0; i < ((_a = code.body) === null || _a === void 0 ? void 0 : _a.length); i++) {
            let r = executeSingle(code.body[i], meta);
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                return r;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
    },
    ExpressionStatement: (code, meta) => {
        return executeSingle(code.expression, meta);
    },
    AssignmentExpression: (code, meta) => {
        let right = executeSingle(code.right, meta);
        let wrapper = executeSingle(code.left, Object.assign(Object.assign({}, meta), { returnIdParent: true }));
        if (wrapper) {
            if (wrapper.parent !== undefined) {
                let before = wrapper.parent[wrapper.id];
                if (code.operator === '=') {
                    wrapper.parent[wrapper.id] = right;
                }
                else if (code.operator === '+=') {
                    wrapper.parent[wrapper.id] = before + right;
                }
                else if (code.operator === '-=') {
                    wrapper.parent[wrapper.id] = before - right;
                }
                else if (code.operator === '*=') {
                    wrapper.parent[wrapper.id] = before * right;
                }
                else if (code.operator === '/=') {
                    wrapper.parent[wrapper.id] = before / right;
                }
                else if (code.operator === '^=') {
                    wrapper.parent[wrapper.id] = Math.pow(before, right);
                }
                else if (code.operator === '%=') {
                    wrapper.parent[wrapper.id] = before % right;
                }
            }
            else {
                let layer = findLayer(meta, wrapper.id);
                if (layer) {
                    let r = layer.findUnit(wrapper.id);
                    if (r) {
                        if (code.operator === '=') {
                            r = right;
                        }
                        else if (code.operator === '+=') {
                            r += right;
                        }
                        else if (code.operator === '-=') {
                            r -= right;
                        }
                        else if (code.operator === '*=') {
                            r *= right;
                        }
                        else if (code.operator === '/=') {
                            r /= right;
                        }
                        else if (code.operator === '^=') {
                            r = Math.pow(r, right);
                        }
                        else if (code.operator === '%=') {
                            r %= right;
                        }
                        layer.putUnit(code.name, r);
                    }
                }
            }
        }
    },
    ForStatement: (code, meta) => {
        for (executeSingle(code.init, meta); executeSingle(code.test, meta); executeSingle(code.update, meta)) {
            let r = executeSingle(code.body, meta);
            if (r === null || r === void 0 ? void 0 : r.breakFired)
                break;
            else if (r === null || r === void 0 ? void 0 : r.returnFired)
                return r;
        }
    },
    UpdateExpression: (code, meta) => {
        if (['++', '--'].includes(code.operator)) {
            let wrapper = executeSingle(code.argument, Object.assign(Object.assign({}, meta), { returnIdParent: true }));
            if (wrapper) {
                if (wrapper.parent !== undefined) {
                    let before = wrapper.parent[wrapper.id];
                    if (typeof before === 'number') {
                        if (code.operator === '++')
                            before++;
                        else if (code.operator === '--')
                            before--;
                        wrapper.parent[wrapper.id] = before;
                    }
                }
                else {
                    let layer = findLayer(meta, wrapper.id);
                    if (layer) {
                        let r = layer.findUnit(wrapper.id);
                        if (r) {
                            if (typeof r === 'number') {
                                if (code.operator === '++')
                                    r++;
                                else if (code.operator === '--')
                                    r--;
                                layer.putUnit(code.name, r);
                            }
                        }
                    }
                }
            }
        }
    },
    CallExpression: (code, meta) => {
        let prop = undefined;
        if (code.property === undefined) {
            let r = executeSingle(code.callee, meta);
            return r(...code.arguments.map((c) => executeSingle(c, meta)));
        }
        else {
            if (code.callee.property.type === 'Identifier') {
                prop = code.callee.property.name;
            }
            let r = executeSingle(code.callee.object, meta);
            return r[prop](...code.arguments.map((c) => executeSingle(c, meta)));
        }
    },
    MemberExpression: (code, meta) => {
        let prop = undefined;
        if (code.property === undefined) {
            let r = executeSingle(code.object, meta);
            if (meta.returnIdParent) {
                return { parent: undefined, id: code.name };
            }
            else {
                return r;
            }
        }
        else {
            if (code.computed) {
                prop = executeSingle(code.property, meta);
            }
            else {
                if (code.property.type === 'Identifier') {
                    prop = code.property.name;
                }
                else if (code.property.type === 'Literal') {
                    prop = code.property.value;
                }
            }
            let filteredMeta = Object.assign({}, meta);
            delete filteredMeta['returnIdParent'];
            let r = executeSingle(code.object, filteredMeta);
            if (Array.isArray(r)) {
                let p = r[prop];
                if (typeof p === 'function') {
                    return (...args) => {
                        switch (prop) {
                            case 'push': {
                                return r.push(...args);
                            }
                            case 'map': {
                                return r.map(...args);
                            }
                            case 'forEach': {
                                return r.forEach(...args);
                            }
                            default: {
                            }
                        }
                    };
                }
                else {
                    if (meta.returnIdParent) {
                        return { parent: r, id: prop };
                    }
                    else {
                        return r[prop];
                    }
                }
            }
            else {
                if (meta.returnIdParent) {
                    return { parent: r, id: prop };
                }
                else {
                    return r[prop];
                }
            }
        }
    },
    SwitchStatement: (code, meta) => {
        let disc = executeSingle(code.discriminant, meta);
        for (let i = 0; i < code.cases.length; i++) {
            let c = code.cases[i];
            if (c.type === 'SwitchCase') {
                let caseCond = executeSingle(c.test, meta);
                if (disc === caseCond) {
                    for (let j = 0; j < c.consequent.lengthl; j++) {
                        let co = c.consequent[j];
                        let r = executeSingle(co, meta);
                        if (r === null || r === void 0 ? void 0 : r.returnFired)
                            return r;
                    }
                }
            }
        }
    },
    ArrowFunctionExpression: (code, meta) => {
        let newCreatureBranch = new Creature_1.default(meta.creature.module, Object.assign(Object.assign({}, meta.creature), { runtime: meta.creature.runtime.clone() }));
        let newMetaBranch = new ExecutionMeta_1.default(Object.assign(Object.assign({}, meta), { creature: newCreatureBranch }));
        return generateCallbackFunction(code, newMetaBranch);
    },
    ObjectExpression: (code, meta) => {
        let obj = {};
        code.properties.forEach((property) => {
            if (property.type === 'Property') {
                if (property.key.type === 'Identifier') {
                    obj[property.key.name] = executeSingle(property.value, meta);
                }
            }
            else {
                if (property.type === 'SpreadElement') {
                    obj[property.argument.name] = executeSingle(property, meta);
                }
            }
        });
        return obj;
    },
    ArrayExpression: (code, meta) => {
        let result = [];
        code.elements.forEach((arrEl) => {
            let r = executeSingle(arrEl, meta);
            if ((arrEl.type === 'SpreadElement') && Array.isArray(r)) {
                result.push(...r);
            }
            else {
                result.push(r);
            }
        });
        return result;
    },
    SpreadElement: (code, meta) => {
        let source = executeSingle(code.argument, meta);
        if (Array.isArray(source)) {
            return [...source];
        }
        else {
            return Object.assign({}, source);
        }
    },
    ReturnStatement: (code, meta) => {
        return { value: executeSingle(code.argument, meta), returnFired: true };
    }
};
exports["default"] = { executeSingle, executeBlock, ExecutionMeta: ExecutionMeta_1.default };


/***/ }),

/***/ "./src/widget/utils/generator.ts":
/*!***************************************!*\
  !*** ./src/widget/utils/generator.ts ***!
  \***************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const BaseElement_1 = __webpack_require__(/*! ../elements/BaseElement */ "./src/widget/elements/BaseElement.ts");
const ExecutionMeta_1 = __webpack_require__(/*! ../ExecutionMeta */ "./src/widget/ExecutionMeta.ts");
let generateKey = () => {
    return Math.random().toString().substring(2);
};
function clone(instance) {
    const copy = new instance.constructor();
    Object.assign(copy, instance);
    return copy;
}
const prepareElement = (typeName, defaultProps, overridenProps, defaultStyles, overridenStyles, children) => {
    let finalProps = {};
    Object.keys(defaultProps).forEach(propKey => {
        if (overridenProps[propKey] !== undefined) {
            let bpProp = defaultProps[propKey];
            let copiedProp = clone(bpProp);
            copiedProp.setValue(overridenProps[propKey]);
            finalProps[propKey] = copiedProp;
        }
    });
    let finalStyles = Object.assign({}, defaultStyles);
    if (overridenStyles)
        finalStyles = Object.assign(Object.assign({}, finalStyles), overridenStyles);
    return new BaseElement_1.default(overridenProps['key'], typeName, finalProps, finalStyles, children);
};
const nestedContext = (creature, otherMetas) => {
    if (otherMetas) {
        return new ExecutionMeta_1.default(Object.assign(Object.assign({}, otherMetas), { creature, isAnotherCreature: true }));
    }
    else {
        return new ExecutionMeta_1.default({ creature, isAnotherCreature: true });
    }
};
exports["default"] = { generateKey, prepareElement, nestedContext };


/***/ }),

/***/ "./src/widget/utils/hyphenateStyleName.ts":
/*!************************************************!*\
  !*** ./src/widget/utils/hyphenateStyleName.ts ***!
  \************************************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
var msPattern = /^ms-/;
var _uppercasePattern = /([A-Z])/g;
function hyphenate(string) {
    return string.replace(_uppercasePattern, '-$1').toLowerCase();
}
function hyphenateStyleName(string) {
    return hyphenate(string).replace(msPattern, '-ms-');
}
exports["default"] = hyphenateStyleName;


/***/ }),

/***/ "./src/widget/utils/index.ts":
/*!***********************************!*\
  !*** ./src/widget/utils/index.ts ***!
  \***********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const generator_1 = __webpack_require__(/*! ./generator */ "./src/widget/utils/generator.ts");
const compiler_1 = __webpack_require__(/*! ./compiler */ "./src/widget/utils/compiler.ts");
const json_1 = __webpack_require__(/*! ./json */ "./src/widget/utils/json.ts");
const executor_1 = __webpack_require__(/*! ./executor */ "./src/widget/utils/executor.ts");
exports["default"] = { generator: generator_1.default, compiler: compiler_1.default, json: json_1.default, executor: executor_1.default };


/***/ }),

/***/ "./src/widget/utils/json.ts":
/*!**********************************!*\
  !*** ./src/widget/utils/json.ts ***!
  \**********************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
let prettify = (obj) => {
    return JSON.stringify(obj, undefined, 4);
};
let updates = [];
let findChanges = (parentKey, el1, el2) => {
    if (el1._key !== el2._key) {
        updates.push({
            __action__: 'element_deleted',
            __key__: el1._key,
            __parentKey__: parentKey
        }, {
            __action__: 'element_created',
            __key__: el2._key,
            __element__: JSON.parse(JSON.stringify(el2)),
            __parentKey__: parentKey
        });
        return;
    }
    let propsChanges = { __action__: 'props_updated', __key__: el2._key, __created__: {}, __deleted__: {}, __updated__: {} };
    for (let pKey in el2._props) {
        if (el1._props[pKey] === undefined) {
            propsChanges.__created__[pKey] = el2._props[pKey].getValue();
        }
    }
    for (let pKey in el1._props) {
        if (el2._props[pKey] === undefined) {
            propsChanges.__deleted__[pKey] = el2._props[pKey].getValue();
        }
    }
    for (let pKey in el2._props) {
        if (el1._props[pKey] !== undefined && el2._props[pKey] !== undefined) {
            if (el1._props[pKey].getValue() !== el2._props[pKey].getValue()) {
                propsChanges.__updated__[pKey] = el2._props[pKey].getValue();
            }
        }
    }
    if ((Object.keys(propsChanges.__created__).length > 0) ||
        (Object.keys(propsChanges.__deleted__).length > 0) ||
        (Object.keys(propsChanges.__updated__).length > 0)) {
        updates.push(propsChanges);
    }
    let stylesChanges = { __action__: 'styles_updated', __key__: el2._key, __created__: {}, __deleted__: {}, __updated__: {} };
    for (let sKey in el2._styles) {
        if (el1._styles[sKey] === undefined) {
            stylesChanges.__created__[sKey] = el2._styles[sKey];
        }
    }
    for (let sKey in el1._styles) {
        if (el2._styles[sKey] === undefined) {
            stylesChanges.__deleted__[sKey] = el2._styles[sKey];
        }
    }
    for (let sKey in el2._styles) {
        if (el1._styles[sKey] !== undefined && el2._styles[sKey] !== undefined) {
            if (el1._styles[sKey] !== el2._styles[sKey]) {
                stylesChanges.__updated__[sKey] = el2._styles[sKey];
            }
        }
    }
    if ((Object.keys(stylesChanges.__created__).length > 0) ||
        (Object.keys(stylesChanges.__deleted__).length > 0) ||
        (Object.keys(stylesChanges.__updated__).length > 0)) {
        updates.push(stylesChanges);
    }
    let cs = {};
    el2._children.forEach(child => { cs[child._key] = child; });
    el1._children.forEach(child => {
        if (cs[child._key]) {
            findChanges(el1._key, child, cs[child._key]);
        }
        else {
            updates.push({
                __action__: 'element_deleted',
                __key__: child._key,
                __parentKey__: el1._key
            });
        }
    });
    cs = {};
    el1._children.forEach(child => { cs[child._key] = child; });
    el2._children.forEach(child => {
        if (!cs[child._key]) {
            updates.push({
                __action__: 'element_created',
                __key__: child._key,
                __element__: JSON.parse(JSON.stringify(child)),
                __parentKey__: el2._key
            });
        }
    });
};
let diff = (el1, el2) => {
    updates = [];
    findChanges(undefined, el1, el2);
    return updates;
};
exports["default"] = { prettify, diff };


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
!function() {
"use strict";
var exports = __webpack_exports__;
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Controls = exports.Utils = exports.Module = exports.Runnable = exports.Applet = void 0;
const Module_1 = __webpack_require__(/*! ./widget/Module */ "./src/widget/Module.ts");
exports.Module = Module_1.default;
const Applet_1 = __webpack_require__(/*! ./widget/Applet */ "./src/widget/Applet.ts");
exports.Applet = Applet_1.default;
Object.defineProperty(exports, "Runnable", ({ enumerable: true, get: function () { return Applet_1.Runnable; } }));
const utils_1 = __webpack_require__(/*! ./widget/utils */ "./src/widget/utils/index.ts");
exports.Utils = utils_1.default;
const controls_1 = __webpack_require__(/*! ./widget/controls */ "./src/widget/controls/index.ts");
exports.Controls = controls_1.default;
window.engine = exports
}();
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lnbWEtYnVuZGxlLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBYTs7QUFFYixzQkFBc0IsbUJBQU8sQ0FBQyxrREFBUzs7QUFFdkM7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlDQUF5QyxpQkFBaUI7QUFDMUQsaURBQWlELGlCQUFpQjtBQUNsRTtBQUNBOztBQUVBO0FBQ0Esa0NBQWtDO0FBQ2xDLGtDQUFrQztBQUNsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBO0FBQ0E7O0FBRUEsaUJBQWlCO0FBQ2pCO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQSxtREFBa0Q7QUFDbEQ7QUFDQSx3QkFBd0IsbUJBQU8sQ0FBQyxpREFBTztBQUN2QyxHQUFHO0FBQ0g7QUFDQTtBQUNBLENBQUMsRUFBQzs7QUFFRjtBQUNBLGdDQUFnQyxtQkFBTyxDQUFDLGlEQUFPO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsdUJBQXVCO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsdUJBQXVCO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBLGdDQUFnQyxhQUFhLGtCQUFrQixpQ0FBaUM7QUFDaEc7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVk7QUFDWjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5QkFBeUI7QUFDekI7QUFDQTtBQUNBO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQjtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYztBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBWTtBQUNaO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRLDJDQUEyQztBQUNuRDtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLHlCQUF5QjtBQUN6QjtBQUNBO0FBQ0EsbUNBQW1DO0FBQ25DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSLGtDQUFrQztBQUNsQyxvQ0FBb0M7QUFDcEM7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7QUN2ZUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSxRQUFROztBQUVSO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBOztBQUVBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBLFFBQVE7O0FBRVI7QUFDQTtBQUNBLDJDQUEyQztBQUMzQztBQUNBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHdCQUF3Qjs7QUFFeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw2Q0FBNkM7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esd0NBQXdDLGNBQWM7QUFDdEQ7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLDZC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eUMsUUFBUTtBQUNqRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUSxPQUFPO0FBQ2Y7QUFDQSxzQkFBc0Isd0RBQXdEO0FBQzlFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxpQ0FBaUM7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0I7QUFDdEI7QUFDQSxpQ0FBaUM7QUFDakM7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxXQUFXO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBO0FBQ0Esc0NBQXNDO0FBQ3RDO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0NBQWdDO0FBQ2hDO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0Esa0NBQWtDOztBQUVsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnREFBZ0Q7QUFDaEQ7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseUJBQXlCO0FBQ3pCLHFCQUFxQjtBQUNyQixNQUFNO0FBQ047QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFROztBQUVSO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBVTtBQUNWLE1BQU07QUFDTjtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0EsbUJBQW1CO0FBQ25CO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDRDQUE0QztBQUM1QztBQUNBO0FBQ0Esb0JBQW9CLGlCQUFpQjtBQUNyQztBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxnQkFBZ0IsWUFBWSxvQkFBb0I7QUFDaEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3Q0FBd0M7QUFDeEM7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0NBQXNDO0FBQ3RDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBLE1BQU0sT0FBTyxZQUFZLFlBQVk7QUFDckM7QUFDQTtBQUNBO0FBQ0EsNENBQTRDO0FBQzVDO0FBQ0EsUUFBUTtBQUNSLGdEQUFnRCxpQkFBaUI7QUFDakU7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUJBQXFCO0FBQ3JCO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLG9CQUFvQjtBQUNwQjtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVEsdUNBQXVDLGlCQUFpQjtBQUNoRTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQVEseUNBQXlDLHFCQUFxQjtBQUN0RTs7QUFFQSxxQkFBcUI7QUFDckI7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjs7QUFFQTtBQUNBLG9CQUFvQjtBQUNwQixrQ0FBa0MsaUJBQWlCO0FBQ25EO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxnQkFBZ0IsWUFBWTtBQUM1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVEQUF1RDtBQUN2RCxRQUFRLE9BQU87O0FBRWY7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0EsNEJBQTRCLFlBQVk7QUFDeEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0NBQXNDO0FBQ3RDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVEQUF1RDtBQUN2RCxRQUFRLE9BQU87O0FBRWY7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLG9CQUFvQixtRUFBbUU7QUFDdkY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBWTtBQUNaOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHNDQUFzQztBQUN0QyxnREFBZ0QsaUJBQWlCO0FBQ2pFOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLG9DQUFvQztBQUNwQztBQUNBOztBQUVBO0FBQ0E7QUFDQSxzQ0FBc0M7QUFDdEM7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVk7QUFDWjs7QUFFQTtBQUNBLHFDQUFxQztBQUNyQztBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0EsMEJBQTBCOztBQUUxQjtBQUNBO0FBQ0E7QUFDQSxNQUFNLG1DQUFtQztBQUN6QztBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQSxvQkFBb0IsU0FBUztBQUM3QjtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsUUFBUTs7QUFFUjs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQjtBQUNuQixhQUFhO0FBQ2I7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjtBQUNBO0FBQ0E7QUFDQSwyQ0FBMkM7QUFDM0M7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQSxpRUFBaUU7QUFDakU7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxlQUFlLElBQUksWUFBWTtBQUMvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQSxZQUFZO0FBQ1o7QUFDQTtBQUNBLGNBQWM7QUFDZDtBQUNBO0FBQ0EsNENBQTRDO0FBQzVDO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0Esb0JBQW9CO0FBQ3BCOztBQUVBO0FBQ0Esb0JBQW9CO0FBQ3BCOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLDhDQUE4QyxpQkFBaUI7QUFDL0Q7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0EsZ0RBQWdELHFCQUFxQjtBQUNyRTs7QUFFQSxrQkFBa0I7QUFDbEI7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsNkJBQTZCO0FBQzdCLDZCQUE2QjtBQUM3Qiw4QkFBOEI7QUFDOUI7QUFDQTtBQUNBLDJEQUEyRCxrQ0FBa0M7QUFDN0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7O0FBRVI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQTs7QUFFQTtBQUNBLDBDQUEwQyxRQUFRO0FBQ2xEO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjtBQUNBOztBQUVBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBLFVB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O0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSw0QkFBNEI7QUFDNUI7O0FBRUE7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLGlCQUFpQjs7QUFFakI7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0EsaUJBQWlCOztBQUVqQjtBQUNBOztBQUVBO0FBQ0EsUUFBUTtBQUNSO0FBQ0EsUUFBUTtBQUNSO0FBQ0EsUUFBUTs7QUFFUjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsNERBQTREO0FBQzVEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsNkNBQTZDO0FBQzdDLHlCQUF5QjtBQUN6QjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQSw0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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvRUFBb0U7QUFDcEUsUUFBUSxPQUFPOztBQUVmO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0EsWUFBWTtBQUNaLFFBQVE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSwyREFBMkQ7QUFDM0Q7QUFDQTtBQUNBO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQSwwQkFBMEI7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDBCQUEwQjs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLGVBQWU7QUFDbEM7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFD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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQixzQkFBc0I7QUFDNUM7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMkRBQTJELGNBQWM7QUFDekU7QUFDQSxvQ0FBb0MsMkJBQTJCO0FBQy9EO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQjtBQUN0QjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVEsc0JBQXNCO0FBQzlCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBWTtBQUNaO0FBQ0E7QUFDQTtBQUNBLFlBQVk7QUFDWjtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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QUFDLEVBQUU7UUFDMUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDakIsT0FBTyxDQUFDLElBQUksQ0FDUjtnQkFDSSxVQUFVLEVBQUUsaUJBQWlCO2dCQUM3QixPQUFPLEVBQUUsS0FBSyxDQUFDLElBQUk7Z0JBQ25CLFdBQVcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzlDLGFBQWEsRUFBRSxHQUFHLENBQUMsSUFBSTthQUMxQixDQUNKO1NBQ0o7SUFDTCxDQUFDLENBQUM7QUFDTixDQUFDO0FBRUQsSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFnQixFQUFFLEdBQWdCLEVBQUUsRUFBRTtJQUM5QyxPQUFPLEdBQUcsRUFBRTtJQUNaLFdBQVcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztJQUNoQyxPQUFPLE9BQU87QUFDbEIsQ0FBQztBQUVELHFCQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTs7Ozs7OztVQ2pIakM7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTs7VUFFQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTs7Ozs7Ozs7Ozs7Ozs7QUNyQkEsc0ZBQW9DO0FBUWhDLGlCQVJHLGdCQUFNLENBUUg7QUFQVixzRkFBa0Q7QUFLOUMsaUJBTEcsZ0JBQU0sQ0FLSDtBQUNOLDBGQU5hLGlCQUFRLFFBTWI7QUFMWix5RkFBa0M7QUFPOUIsZ0JBUEcsZUFBSyxDQU9IO0FBTlQsa0dBQXdDO0FBT3BDLG1CQVBHLGtCQUFRLENBT0giLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly92bWVuZ2luZS8uL25vZGVfbW9kdWxlcy9hY29ybi1qc3gvaW5kZXguanMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9ub2RlX21vZHVsZXMvYWNvcm4tanN4L3hodG1sLmpzIiwid2VicGFjazovL3ZtZW5naW5lLy4vbm9kZV9tb2R1bGVzL2Fjb3JuL2Rpc3QvYWNvcm4uanMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L0FwcGxldC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvQ3JlYXR1cmUudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L0NyZWF0dXJlU3RvcmUudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L0RPTS50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvRXhlY3V0aW9uTWV0YS50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvRnVuY1N0b3JlLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9NZW1vcnlMYXllci50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvTW9kdWxlLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9SdW50aW1lLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9jb250cm9scy9CYXNlQ29udHJvbC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvY29udHJvbHMvQm94Q29udHJvbC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvY29udHJvbHMvQnV0dG9uQ29udHJvbC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvY29udHJvbHMvQ2FyZENvbnRyb2wudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L2NvbnRyb2xzL1ByaW1hcnlUYWJDb250cm9sLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9jb250cm9scy9UYWJzQ29udHJvbC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvY29udHJvbHMvVGV4dENvbnRyb2wudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L2NvbnRyb2xzL2luZGV4LnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9lbGVtZW50cy9CYXNlRWxlbWVudC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvcHJvcHMvQmFzZVByb3AudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L3Byb3BzL0Z1bmNQcm9wLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9wcm9wcy9TdHJpbmdQcm9wLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC91dGlscy9jb21waWxlci50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvdXRpbHMvY3NzUHJvcGVydHkudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L3V0aWxzL2V4ZWN1dG9yLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC91dGlscy9nZW5lcmF0b3IudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L3V0aWxzL2h5cGhlbmF0ZVN0eWxlTmFtZS50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvdXRpbHMvaW5kZXgudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L3V0aWxzL2pzb24udHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBYSFRNTEVudGl0aWVzID0gcmVxdWlyZSgnLi94aHRtbCcpO1xuXG5jb25zdCBoZXhOdW1iZXIgPSAvXltcXGRhLWZBLUZdKyQvO1xuY29uc3QgZGVjaW1hbE51bWJlciA9IC9eXFxkKyQvO1xuXG4vLyBUaGUgbWFwIHRvIGBhY29ybi1qc3hgIHRva2VucyBmcm9tIGBhY29ybmAgbmFtZXNwYWNlIG9iamVjdHMuXG5jb25zdCBhY29ybkpzeE1hcCA9IG5ldyBXZWFrTWFwKCk7XG5cbi8vIEdldCB0aGUgb3JpZ2luYWwgdG9rZW5zIGZvciB0aGUgZ2l2ZW4gYGFjb3JuYCBuYW1lc3BhY2Ugb2JqZWN0LlxuZnVuY3Rpb24gZ2V0SnN4VG9rZW5zKGFjb3JuKSB7XG4gIGFjb3JuID0gYWNvcm4uUGFyc2VyLmFjb3JuIHx8IGFjb3JuO1xuICBsZXQgYWNvcm5Kc3ggPSBhY29ybkpzeE1hcC5nZXQoYWNvcm4pO1xuICBpZiAoIWFjb3JuSnN4KSB7XG4gICAgY29uc3QgdHQgPSBhY29ybi50b2tUeXBlcztcbiAgICBjb25zdCBUb2tDb250ZXh0ID0gYWNvcm4uVG9rQ29udGV4dDtcbiAgICBjb25zdCBUb2tlblR5cGUgPSBhY29ybi5Ub2tlblR5cGU7XG4gICAgY29uc3QgdGNfb1RhZyA9IG5ldyBUb2tDb250ZXh0KCc8dGFnJywgZmFsc2UpO1xuICAgIGNvbnN0IHRjX2NUYWcgPSBuZXcgVG9rQ29udGV4dCgnPC90YWcnLCBmYWxzZSk7XG4gICAgY29uc3QgdGNfZXhwciA9IG5ldyBUb2tDb250ZXh0KCc8dGFnPi4uLjwvdGFnPicsIHRydWUsIHRydWUpO1xuICAgIGNvbnN0IHRva0NvbnRleHRzID0ge1xuICAgICAgdGNfb1RhZzogdGNfb1RhZyxcbiAgICAgIHRjX2NUYWc6IHRjX2NUYWcsXG4gICAgICB0Y19leHByOiB0Y19leHByXG4gICAgfTtcbiAgICBjb25zdCB0b2tUeXBlcyA9IHtcbiAgICAgIGpzeE5hbWU6IG5ldyBUb2tlblR5cGUoJ2pzeE5hbWUnKSxcbiAgICAgIGpzeFRleHQ6IG5ldyBUb2tlblR5cGUoJ2pzeFRleHQnLCB7YmVmb3JlRXhwcjogdHJ1ZX0pLFxuICAgICAganN4VGFnU3RhcnQ6IG5ldyBUb2tlblR5cGUoJ2pzeFRhZ1N0YXJ0Jywge3N0YXJ0c0V4cHI6IHRydWV9KSxcbiAgICAgIGpzeFRhZ0VuZDogbmV3IFRva2VuVHlwZSgnanN4VGFnRW5kJylcbiAgICB9O1xuXG4gICAgdG9rVHlwZXMuanN4VGFnU3RhcnQudXBkYXRlQ29udGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jb250ZXh0LnB1c2godGNfZXhwcik7IC8vIHRyZWF0IGFzIGJlZ2lubmluZyBvZiBKU1ggZXhwcmVzc2lvblxuICAgICAgdGhpcy5jb250ZXh0LnB1c2godGNfb1RhZyk7IC8vIHN0YXJ0IG9wZW5pbmcgdGFnIGNvbnRleHRcbiAgICAgIHRoaXMuZXhwckFsbG93ZWQgPSBmYWxzZTtcbiAgICB9O1xuICAgIHRva1R5cGVzLmpzeFRhZ0VuZC51cGRhdGVDb250ZXh0ID0gZnVuY3Rpb24ocHJldlR5cGUpIHtcbiAgICAgIGxldCBvdXQgPSB0aGlzLmNvbnRleHQucG9wKCk7XG4gICAgICBpZiAob3V0ID09PSB0Y19vVGFnICYmIHByZXZUeXBlID09PSB0dC5zbGFzaCB8fCBvdXQgPT09IHRjX2NUYWcpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LnBvcCgpO1xuICAgICAgICB0aGlzLmV4cHJBbGxvd2VkID0gdGhpcy5jdXJDb250ZXh0KCkgPT09IHRjX2V4cHI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmV4cHJBbGxvd2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgYWNvcm5Kc3ggPSB7IHRva0NvbnRleHRzOiB0b2tDb250ZXh0cywgdG9rVHlwZXM6IHRva1R5cGVzIH07XG4gICAgYWNvcm5Kc3hNYXAuc2V0KGFjb3JuLCBhY29ybkpzeCk7XG4gIH1cblxuICByZXR1cm4gYWNvcm5Kc3g7XG59XG5cbi8vIFRyYW5zZm9ybXMgSlNYIGVsZW1lbnQgbmFtZSB0byBzdHJpbmcuXG5cbmZ1bmN0aW9uIGdldFF1YWxpZmllZEpTWE5hbWUob2JqZWN0KSB7XG4gIGlmICghb2JqZWN0KVxuICAgIHJldHVybiBvYmplY3Q7XG5cbiAgaWYgKG9iamVjdC50eXBlID09PSAnSlNYSWRlbnRpZmllcicpXG4gICAgcmV0dXJuIG9iamVjdC5uYW1lO1xuXG4gIGlmIChvYmplY3QudHlwZSA9PT0gJ0pTWE5hbWVzcGFjZWROYW1lJylcbiAgICByZXR1cm4gb2JqZWN0Lm5hbWVzcGFjZS5uYW1lICsgJzonICsgb2JqZWN0Lm5hbWUubmFtZTtcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdKU1hNZW1iZXJFeHByZXNzaW9uJylcbiAgICByZXR1cm4gZ2V0UXVhbGlmaWVkSlNYTmFtZShvYmplY3Qub2JqZWN0KSArICcuJyArXG4gICAgZ2V0UXVhbGlmaWVkSlNYTmFtZShvYmplY3QucHJvcGVydHkpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHJldHVybiBmdW5jdGlvbihQYXJzZXIpIHtcbiAgICByZXR1cm4gcGx1Z2luKHtcbiAgICAgIGFsbG93TmFtZXNwYWNlczogb3B0aW9ucy5hbGxvd05hbWVzcGFjZXMgIT09IGZhbHNlLFxuICAgICAgYWxsb3dOYW1lc3BhY2VkT2JqZWN0czogISFvcHRpb25zLmFsbG93TmFtZXNwYWNlZE9iamVjdHNcbiAgICB9LCBQYXJzZXIpO1xuICB9O1xufTtcblxuLy8gVGhpcyBpcyBgdG9rVHlwZXNgIG9mIHRoZSBwZWVyIGRlcC5cbi8vIFRoaXMgY2FuIGJlIGRpZmZlcmVudCBpbnN0YW5jZXMgZnJvbSB0aGUgYWN0dWFsIGB0b2tUeXBlc2AgdGhpcyBwbHVnaW4gdXNlcy5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2R1bGUuZXhwb3J0cywgXCJ0b2tUeXBlc1wiLCB7XG4gIGdldDogZnVuY3Rpb24gZ2V0X3Rva1R5cGVzKCkge1xuICAgIHJldHVybiBnZXRKc3hUb2tlbnMocmVxdWlyZShcImFjb3JuXCIpKS50b2tUeXBlcztcbiAgfSxcbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBlbnVtZXJhYmxlOiB0cnVlXG59KTtcblxuZnVuY3Rpb24gcGx1Z2luKG9wdGlvbnMsIFBhcnNlcikge1xuICBjb25zdCBhY29ybiA9IFBhcnNlci5hY29ybiB8fCByZXF1aXJlKFwiYWNvcm5cIik7XG4gIGNvbnN0IGFjb3JuSnN4ID0gZ2V0SnN4VG9rZW5zKGFjb3JuKTtcbiAgY29uc3QgdHQgPSBhY29ybi50b2tUeXBlcztcbiAgY29uc3QgdG9rID0gYWNvcm5Kc3gudG9rVHlwZXM7XG4gIGNvbnN0IHRva0NvbnRleHRzID0gYWNvcm4udG9rQ29udGV4dHM7XG4gIGNvbnN0IHRjX29UYWcgPSBhY29ybkpzeC50b2tDb250ZXh0cy50Y19vVGFnO1xuICBjb25zdCB0Y19jVGFnID0gYWNvcm5Kc3gudG9rQ29udGV4dHMudGNfY1RhZztcbiAgY29uc3QgdGNfZXhwciA9IGFjb3JuSnN4LnRva0NvbnRleHRzLnRjX2V4cHI7XG4gIGNvbnN0IGlzTmV3TGluZSA9IGFjb3JuLmlzTmV3TGluZTtcbiAgY29uc3QgaXNJZGVudGlmaWVyU3RhcnQgPSBhY29ybi5pc0lkZW50aWZpZXJTdGFydDtcbiAgY29uc3QgaXNJZGVudGlmaWVyQ2hhciA9IGFjb3JuLmlzSWRlbnRpZmllckNoYXI7XG5cbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgUGFyc2VyIHtcbiAgICAvLyBFeHBvc2UgYWN0dWFsIGB0b2tUeXBlc2AgYW5kIGB0b2tDb250ZXh0c2AgdG8gb3RoZXIgcGx1Z2lucy5cbiAgICBzdGF0aWMgZ2V0IGFjb3JuSnN4KCkge1xuICAgICAgcmV0dXJuIGFjb3JuSnN4O1xuICAgIH1cblxuICAgIC8vIFJlYWRzIGlubGluZSBKU1ggY29udGVudHMgdG9rZW4uXG4gICAganN4X3JlYWRUb2tlbigpIHtcbiAgICAgIGxldCBvdXQgPSAnJywgY2h1bmtTdGFydCA9IHRoaXMucG9zO1xuICAgICAgZm9yICg7Oykge1xuICAgICAgICBpZiAodGhpcy5wb3MgPj0gdGhpcy5pbnB1dC5sZW5ndGgpXG4gICAgICAgICAgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCAnVW50ZXJtaW5hdGVkIEpTWCBjb250ZW50cycpO1xuICAgICAgICBsZXQgY2ggPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpO1xuXG4gICAgICAgIHN3aXRjaCAoY2gpIHtcbiAgICAgICAgY2FzZSA2MDogLy8gJzwnXG4gICAgICAgIGNhc2UgMTIzOiAvLyAneydcbiAgICAgICAgICBpZiAodGhpcy5wb3MgPT09IHRoaXMuc3RhcnQpIHtcbiAgICAgICAgICAgIGlmIChjaCA9PT0gNjAgJiYgdGhpcy5leHByQWxsb3dlZCkge1xuICAgICAgICAgICAgICArK3RoaXMucG9zO1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0b2suanN4VGFnU3RhcnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VG9rZW5Gcm9tQ29kZShjaCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG91dCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0b2suanN4VGV4dCwgb3V0KTtcblxuICAgICAgICBjYXNlIDM4OiAvLyAnJidcbiAgICAgICAgICBvdXQgKz0gdGhpcy5pbnB1dC5zbGljZShjaHVua1N0YXJ0LCB0aGlzLnBvcyk7XG4gICAgICAgICAgb3V0ICs9IHRoaXMuanN4X3JlYWRFbnRpdHkoKTtcbiAgICAgICAgICBjaHVua1N0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSA2MjogLy8gJz4nXG4gICAgICAgIGNhc2UgMTI1OiAvLyAnfSdcbiAgICAgICAgICB0aGlzLnJhaXNlKFxuICAgICAgICAgICAgdGhpcy5wb3MsXG4gICAgICAgICAgICBcIlVuZXhwZWN0ZWQgdG9rZW4gYFwiICsgdGhpcy5pbnB1dFt0aGlzLnBvc10gKyBcImAuIERpZCB5b3UgbWVhbiBgXCIgK1xuICAgICAgICAgICAgICAoY2ggPT09IDYyID8gXCImZ3Q7XCIgOiBcIiZyYnJhY2U7XCIpICsgXCJgIG9yIFwiICsgXCJge1xcXCJcIiArIHRoaXMuaW5wdXRbdGhpcy5wb3NdICsgXCJcXFwifVwiICsgXCJgP1wiXG4gICAgICAgICAgKTtcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmIChpc05ld0xpbmUoY2gpKSB7XG4gICAgICAgICAgICBvdXQgKz0gdGhpcy5pbnB1dC5zbGljZShjaHVua1N0YXJ0LCB0aGlzLnBvcyk7XG4gICAgICAgICAgICBvdXQgKz0gdGhpcy5qc3hfcmVhZE5ld0xpbmUodHJ1ZSk7XG4gICAgICAgICAgICBjaHVua1N0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAganN4X3JlYWROZXdMaW5lKG5vcm1hbGl6ZUNSTEYpIHtcbiAgICAgIGxldCBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyk7XG4gICAgICBsZXQgb3V0O1xuICAgICAgKyt0aGlzLnBvcztcbiAgICAgIGlmIChjaCA9PT0gMTMgJiYgdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKSA9PT0gMTApIHtcbiAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgICAgb3V0ID0gbm9ybWFsaXplQ1JMRiA/ICdcXG4nIDogJ1xcclxcbic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXQgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb25zKSB7XG4gICAgICAgICsrdGhpcy5jdXJMaW5lO1xuICAgICAgICB0aGlzLmxpbmVTdGFydCA9IHRoaXMucG9zO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gb3V0O1xuICAgIH1cblxuICAgIGpzeF9yZWFkU3RyaW5nKHF1b3RlKSB7XG4gICAgICBsZXQgb3V0ID0gJycsIGNodW5rU3RhcnQgPSArK3RoaXMucG9zO1xuICAgICAgZm9yICg7Oykge1xuICAgICAgICBpZiAodGhpcy5wb3MgPj0gdGhpcy5pbnB1dC5sZW5ndGgpXG4gICAgICAgICAgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCAnVW50ZXJtaW5hdGVkIHN0cmluZyBjb25zdGFudCcpO1xuICAgICAgICBsZXQgY2ggPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpO1xuICAgICAgICBpZiAoY2ggPT09IHF1b3RlKSBicmVhaztcbiAgICAgICAgaWYgKGNoID09PSAzOCkgeyAvLyAnJidcbiAgICAgICAgICBvdXQgKz0gdGhpcy5pbnB1dC5zbGljZShjaHVua1N0YXJ0LCB0aGlzLnBvcyk7XG4gICAgICAgICAgb3V0ICs9IHRoaXMuanN4X3JlYWRFbnRpdHkoKTtcbiAgICAgICAgICBjaHVua1N0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNOZXdMaW5lKGNoKSkge1xuICAgICAgICAgIG91dCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKTtcbiAgICAgICAgICBvdXQgKz0gdGhpcy5qc3hfcmVhZE5ld0xpbmUoZmFsc2UpO1xuICAgICAgICAgIGNodW5rU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICArK3RoaXMucG9zO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBvdXQgKz0gdGhpcy5pbnB1dC5zbGljZShjaHVua1N0YXJ0LCB0aGlzLnBvcysrKTtcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR0LnN0cmluZywgb3V0KTtcbiAgICB9XG5cbiAgICBqc3hfcmVhZEVudGl0eSgpIHtcbiAgICAgIGxldCBzdHIgPSAnJywgY291bnQgPSAwLCBlbnRpdHk7XG4gICAgICBsZXQgY2ggPSB0aGlzLmlucHV0W3RoaXMucG9zXTtcbiAgICAgIGlmIChjaCAhPT0gJyYnKVxuICAgICAgICB0aGlzLnJhaXNlKHRoaXMucG9zLCAnRW50aXR5IG11c3Qgc3RhcnQgd2l0aCBhbiBhbXBlcnNhbmQnKTtcbiAgICAgIGxldCBzdGFydFBvcyA9ICsrdGhpcy5wb3M7XG4gICAgICB3aGlsZSAodGhpcy5wb3MgPCB0aGlzLmlucHV0Lmxlbmd0aCAmJiBjb3VudCsrIDwgMTApIHtcbiAgICAgICAgY2ggPSB0aGlzLmlucHV0W3RoaXMucG9zKytdO1xuICAgICAgICBpZiAoY2ggPT09ICc7Jykge1xuICAgICAgICAgIGlmIChzdHJbMF0gPT09ICcjJykge1xuICAgICAgICAgICAgaWYgKHN0clsxXSA9PT0gJ3gnKSB7XG4gICAgICAgICAgICAgIHN0ciA9IHN0ci5zdWJzdHIoMik7XG4gICAgICAgICAgICAgIGlmIChoZXhOdW1iZXIudGVzdChzdHIpKVxuICAgICAgICAgICAgICAgIGVudGl0eSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQoc3RyLCAxNikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3RyID0gc3RyLnN1YnN0cigxKTtcbiAgICAgICAgICAgICAgaWYgKGRlY2ltYWxOdW1iZXIudGVzdChzdHIpKVxuICAgICAgICAgICAgICAgIGVudGl0eSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQoc3RyLCAxMCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbnRpdHkgPSBYSFRNTEVudGl0aWVzW3N0cl07XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0ciArPSBjaDtcbiAgICAgIH1cbiAgICAgIGlmICghZW50aXR5KSB7XG4gICAgICAgIHRoaXMucG9zID0gc3RhcnRQb3M7XG4gICAgICAgIHJldHVybiAnJic7XG4gICAgICB9XG4gICAgICByZXR1cm4gZW50aXR5O1xuICAgIH1cblxuICAgIC8vIFJlYWQgYSBKU1ggaWRlbnRpZmllciAodmFsaWQgdGFnIG9yIGF0dHJpYnV0ZSBuYW1lKS5cbiAgICAvL1xuICAgIC8vIE9wdGltaXplZCB2ZXJzaW9uIHNpbmNlIEpTWCBpZGVudGlmaWVycyBjYW4ndCBjb250YWluXG4gICAgLy8gZXNjYXBlIGNoYXJhY3RlcnMgYW5kIHNvIGNhbiBiZSByZWFkIGFzIHNpbmdsZSBzbGljZS5cbiAgICAvLyBBbHNvIGFzc3VtZXMgdGhhdCBmaXJzdCBjaGFyYWN0ZXIgd2FzIGFscmVhZHkgY2hlY2tlZFxuICAgIC8vIGJ5IGlzSWRlbnRpZmllclN0YXJ0IGluIHJlYWRUb2tlbi5cblxuICAgIGpzeF9yZWFkV29yZCgpIHtcbiAgICAgIGxldCBjaCwgc3RhcnQgPSB0aGlzLnBvcztcbiAgICAgIGRvIHtcbiAgICAgICAgY2ggPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQoKyt0aGlzLnBvcyk7XG4gICAgICB9IHdoaWxlIChpc0lkZW50aWZpZXJDaGFyKGNoKSB8fCBjaCA9PT0gNDUpOyAvLyAnLSdcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHRvay5qc3hOYW1lLCB0aGlzLmlucHV0LnNsaWNlKHN0YXJ0LCB0aGlzLnBvcykpO1xuICAgIH1cblxuICAgIC8vIFBhcnNlIG5leHQgdG9rZW4gYXMgSlNYIGlkZW50aWZpZXJcblxuICAgIGpzeF9wYXJzZUlkZW50aWZpZXIoKSB7XG4gICAgICBsZXQgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgICBpZiAodGhpcy50eXBlID09PSB0b2suanN4TmFtZSlcbiAgICAgICAgbm9kZS5uYW1lID0gdGhpcy52YWx1ZTtcbiAgICAgIGVsc2UgaWYgKHRoaXMudHlwZS5rZXl3b3JkKVxuICAgICAgICBub2RlLm5hbWUgPSB0aGlzLnR5cGUua2V5d29yZDtcbiAgICAgIGVsc2VcbiAgICAgICAgdGhpcy51bmV4cGVjdGVkKCk7XG4gICAgICB0aGlzLm5leHQoKTtcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgJ0pTWElkZW50aWZpZXInKTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSBuYW1lc3BhY2VkIGlkZW50aWZpZXIuXG5cbiAgICBqc3hfcGFyc2VOYW1lc3BhY2VkTmFtZSgpIHtcbiAgICAgIGxldCBzdGFydFBvcyA9IHRoaXMuc3RhcnQsIHN0YXJ0TG9jID0gdGhpcy5zdGFydExvYztcbiAgICAgIGxldCBuYW1lID0gdGhpcy5qc3hfcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICBpZiAoIW9wdGlvbnMuYWxsb3dOYW1lc3BhY2VzIHx8ICF0aGlzLmVhdCh0dC5jb2xvbikpIHJldHVybiBuYW1lO1xuICAgICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICBub2RlLm5hbWVzcGFjZSA9IG5hbWU7XG4gICAgICBub2RlLm5hbWUgPSB0aGlzLmpzeF9wYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgJ0pTWE5hbWVzcGFjZWROYW1lJyk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2VzIGVsZW1lbnQgbmFtZSBpbiBhbnkgZm9ybSAtIG5hbWVzcGFjZWQsIG1lbWJlclxuICAgIC8vIG9yIHNpbmdsZSBpZGVudGlmaWVyLlxuXG4gICAganN4X3BhcnNlRWxlbWVudE5hbWUoKSB7XG4gICAgICBpZiAodGhpcy50eXBlID09PSB0b2suanN4VGFnRW5kKSByZXR1cm4gJyc7XG4gICAgICBsZXQgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgICBsZXQgbm9kZSA9IHRoaXMuanN4X3BhcnNlTmFtZXNwYWNlZE5hbWUoKTtcbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR0LmRvdCAmJiBub2RlLnR5cGUgPT09ICdKU1hOYW1lc3BhY2VkTmFtZScgJiYgIW9wdGlvbnMuYWxsb3dOYW1lc3BhY2VkT2JqZWN0cykge1xuICAgICAgICB0aGlzLnVuZXhwZWN0ZWQoKTtcbiAgICAgIH1cbiAgICAgIHdoaWxlICh0aGlzLmVhdCh0dC5kb3QpKSB7XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgICBuZXdOb2RlLm9iamVjdCA9IG5vZGU7XG4gICAgICAgIG5ld05vZGUucHJvcGVydHkgPSB0aGlzLmpzeF9wYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgICAgbm9kZSA9IHRoaXMuZmluaXNoTm9kZShuZXdOb2RlLCAnSlNYTWVtYmVyRXhwcmVzc2lvbicpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfVxuXG4gICAgLy8gUGFyc2VzIGFueSB0eXBlIG9mIEpTWCBhdHRyaWJ1dGUgdmFsdWUuXG5cbiAgICBqc3hfcGFyc2VBdHRyaWJ1dGVWYWx1ZSgpIHtcbiAgICAgIHN3aXRjaCAodGhpcy50eXBlKSB7XG4gICAgICBjYXNlIHR0LmJyYWNlTDpcbiAgICAgICAgbGV0IG5vZGUgPSB0aGlzLmpzeF9wYXJzZUV4cHJlc3Npb25Db250YWluZXIoKTtcbiAgICAgICAgaWYgKG5vZGUuZXhwcmVzc2lvbi50eXBlID09PSAnSlNYRW1wdHlFeHByZXNzaW9uJylcbiAgICAgICAgICB0aGlzLnJhaXNlKG5vZGUuc3RhcnQsICdKU1ggYXR0cmlidXRlcyBtdXN0IG9ubHkgYmUgYXNzaWduZWQgYSBub24tZW1wdHkgZXhwcmVzc2lvbicpO1xuICAgICAgICByZXR1cm4gbm9kZTtcblxuICAgICAgY2FzZSB0b2suanN4VGFnU3RhcnQ6XG4gICAgICBjYXNlIHR0LnN0cmluZzpcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VFeHByQXRvbSgpO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsICdKU1ggdmFsdWUgc2hvdWxkIGJlIGVpdGhlciBhbiBleHByZXNzaW9uIG9yIGEgcXVvdGVkIEpTWCB0ZXh0Jyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSlNYRW1wdHlFeHByZXNzaW9uIGlzIHVuaXF1ZSB0eXBlIHNpbmNlIGl0IGRvZXNuJ3QgYWN0dWFsbHkgcGFyc2UgYW55dGhpbmcsXG4gICAgLy8gYW5kIHNvIGl0IHNob3VsZCBzdGFydCBhdCB0aGUgZW5kIG9mIGxhc3QgcmVhZCB0b2tlbiAobGVmdCBicmFjZSkgYW5kIGZpbmlzaFxuICAgIC8vIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIG5leHQgb25lIChyaWdodCBicmFjZSkuXG5cbiAgICBqc3hfcGFyc2VFbXB0eUV4cHJlc3Npb24oKSB7XG4gICAgICBsZXQgbm9kZSA9IHRoaXMuc3RhcnROb2RlQXQodGhpcy5sYXN0VG9rRW5kLCB0aGlzLmxhc3RUb2tFbmRMb2MpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZUF0KG5vZGUsICdKU1hFbXB0eUV4cHJlc3Npb24nLCB0aGlzLnN0YXJ0LCB0aGlzLnN0YXJ0TG9jKTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZXMgSlNYIGV4cHJlc3Npb24gZW5jbG9zZWQgaW50byBjdXJseSBicmFja2V0cy5cblxuICAgIGpzeF9wYXJzZUV4cHJlc3Npb25Db250YWluZXIoKSB7XG4gICAgICBsZXQgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgICB0aGlzLm5leHQoKTtcbiAgICAgIG5vZGUuZXhwcmVzc2lvbiA9IHRoaXMudHlwZSA9PT0gdHQuYnJhY2VSXG4gICAgICAgID8gdGhpcy5qc3hfcGFyc2VFbXB0eUV4cHJlc3Npb24oKVxuICAgICAgICA6IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgICB0aGlzLmV4cGVjdCh0dC5icmFjZVIpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCAnSlNYRXhwcmVzc2lvbkNvbnRhaW5lcicpO1xuICAgIH1cblxuICAgIC8vIFBhcnNlcyBmb2xsb3dpbmcgSlNYIGF0dHJpYnV0ZSBuYW1lLXZhbHVlIHBhaXIuXG5cbiAgICBqc3hfcGFyc2VBdHRyaWJ1dGUoKSB7XG4gICAgICBsZXQgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgICBpZiAodGhpcy5lYXQodHQuYnJhY2VMKSkge1xuICAgICAgICB0aGlzLmV4cGVjdCh0dC5lbGxpcHNpcyk7XG4gICAgICAgIG5vZGUuYXJndW1lbnQgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oKTtcbiAgICAgICAgdGhpcy5leHBlY3QodHQuYnJhY2VSKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCAnSlNYU3ByZWFkQXR0cmlidXRlJyk7XG4gICAgICB9XG4gICAgICBub2RlLm5hbWUgPSB0aGlzLmpzeF9wYXJzZU5hbWVzcGFjZWROYW1lKCk7XG4gICAgICBub2RlLnZhbHVlID0gdGhpcy5lYXQodHQuZXEpID8gdGhpcy5qc3hfcGFyc2VBdHRyaWJ1dGVWYWx1ZSgpIDogbnVsbDtcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgJ0pTWEF0dHJpYnV0ZScpO1xuICAgIH1cblxuICAgIC8vIFBhcnNlcyBKU1ggb3BlbmluZyB0YWcgc3RhcnRpbmcgYWZ0ZXIgJzwnLlxuXG4gICAganN4X3BhcnNlT3BlbmluZ0VsZW1lbnRBdChzdGFydFBvcywgc3RhcnRMb2MpIHtcbiAgICAgIGxldCBub2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgbm9kZS5hdHRyaWJ1dGVzID0gW107XG4gICAgICBsZXQgbm9kZU5hbWUgPSB0aGlzLmpzeF9wYXJzZUVsZW1lbnROYW1lKCk7XG4gICAgICBpZiAobm9kZU5hbWUpIG5vZGUubmFtZSA9IG5vZGVOYW1lO1xuICAgICAgd2hpbGUgKHRoaXMudHlwZSAhPT0gdHQuc2xhc2ggJiYgdGhpcy50eXBlICE9PSB0b2suanN4VGFnRW5kKVxuICAgICAgICBub2RlLmF0dHJpYnV0ZXMucHVzaCh0aGlzLmpzeF9wYXJzZUF0dHJpYnV0ZSgpKTtcbiAgICAgIG5vZGUuc2VsZkNsb3NpbmcgPSB0aGlzLmVhdCh0dC5zbGFzaCk7XG4gICAgICB0aGlzLmV4cGVjdCh0b2suanN4VGFnRW5kKTtcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgbm9kZU5hbWUgPyAnSlNYT3BlbmluZ0VsZW1lbnQnIDogJ0pTWE9wZW5pbmdGcmFnbWVudCcpO1xuICAgIH1cblxuICAgIC8vIFBhcnNlcyBKU1ggY2xvc2luZyB0YWcgc3RhcnRpbmcgYWZ0ZXIgJzwvJy5cblxuICAgIGpzeF9wYXJzZUNsb3NpbmdFbGVtZW50QXQoc3RhcnRQb3MsIHN0YXJ0TG9jKSB7XG4gICAgICBsZXQgbm9kZSA9IHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICAgIGxldCBub2RlTmFtZSA9IHRoaXMuanN4X3BhcnNlRWxlbWVudE5hbWUoKTtcbiAgICAgIGlmIChub2RlTmFtZSkgbm9kZS5uYW1lID0gbm9kZU5hbWU7XG4gICAgICB0aGlzLmV4cGVjdCh0b2suanN4VGFnRW5kKTtcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgbm9kZU5hbWUgPyAnSlNYQ2xvc2luZ0VsZW1lbnQnIDogJ0pTWENsb3NpbmdGcmFnbWVudCcpO1xuICAgIH1cblxuICAgIC8vIFBhcnNlcyBlbnRpcmUgSlNYIGVsZW1lbnQsIGluY2x1ZGluZyBpdCdzIG9wZW5pbmcgdGFnXG4gICAgLy8gKHN0YXJ0aW5nIGFmdGVyICc8JyksIGF0dHJpYnV0ZXMsIGNvbnRlbnRzIGFuZCBjbG9zaW5nIHRhZy5cblxuICAgIGpzeF9wYXJzZUVsZW1lbnRBdChzdGFydFBvcywgc3RhcnRMb2MpIHtcbiAgICAgIGxldCBub2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgbGV0IGNoaWxkcmVuID0gW107XG4gICAgICBsZXQgb3BlbmluZ0VsZW1lbnQgPSB0aGlzLmpzeF9wYXJzZU9wZW5pbmdFbGVtZW50QXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICAgIGxldCBjbG9zaW5nRWxlbWVudCA9IG51bGw7XG5cbiAgICAgIGlmICghb3BlbmluZ0VsZW1lbnQuc2VsZkNsb3NpbmcpIHtcbiAgICAgICAgY29udGVudHM6IGZvciAoOzspIHtcbiAgICAgICAgICBzd2l0Y2ggKHRoaXMudHlwZSkge1xuICAgICAgICAgIGNhc2UgdG9rLmpzeFRhZ1N0YXJ0OlxuICAgICAgICAgICAgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0OyBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgICAgICAgICB0aGlzLm5leHQoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmVhdCh0dC5zbGFzaCkpIHtcbiAgICAgICAgICAgICAgY2xvc2luZ0VsZW1lbnQgPSB0aGlzLmpzeF9wYXJzZUNsb3NpbmdFbGVtZW50QXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICAgICAgICAgICAgYnJlYWsgY29udGVudHM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaGlsZHJlbi5wdXNoKHRoaXMuanN4X3BhcnNlRWxlbWVudEF0KHN0YXJ0UG9zLCBzdGFydExvYykpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlIHRvay5qc3hUZXh0OlxuICAgICAgICAgICAgY2hpbGRyZW4ucHVzaCh0aGlzLnBhcnNlRXhwckF0b20oKSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgdHQuYnJhY2VMOlxuICAgICAgICAgICAgY2hpbGRyZW4ucHVzaCh0aGlzLmpzeF9wYXJzZUV4cHJlc3Npb25Db250YWluZXIoKSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aGlzLnVuZXhwZWN0ZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGdldFF1YWxpZmllZEpTWE5hbWUoY2xvc2luZ0VsZW1lbnQubmFtZSkgIT09IGdldFF1YWxpZmllZEpTWE5hbWUob3BlbmluZ0VsZW1lbnQubmFtZSkpIHtcbiAgICAgICAgICB0aGlzLnJhaXNlKFxuICAgICAgICAgICAgY2xvc2luZ0VsZW1lbnQuc3RhcnQsXG4gICAgICAgICAgICAnRXhwZWN0ZWQgY29ycmVzcG9uZGluZyBKU1ggY2xvc2luZyB0YWcgZm9yIDwnICsgZ2V0UXVhbGlmaWVkSlNYTmFtZShvcGVuaW5nRWxlbWVudC5uYW1lKSArICc+Jyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBmcmFnbWVudE9yRWxlbWVudCA9IG9wZW5pbmdFbGVtZW50Lm5hbWUgPyAnRWxlbWVudCcgOiAnRnJhZ21lbnQnO1xuXG4gICAgICBub2RlWydvcGVuaW5nJyArIGZyYWdtZW50T3JFbGVtZW50XSA9IG9wZW5pbmdFbGVtZW50O1xuICAgICAgbm9kZVsnY2xvc2luZycgKyBmcmFnbWVudE9yRWxlbWVudF0gPSBjbG9zaW5nRWxlbWVudDtcbiAgICAgIG5vZGUuY2hpbGRyZW4gPSBjaGlsZHJlbjtcbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR0LnJlbGF0aW9uYWwgJiYgdGhpcy52YWx1ZSA9PT0gXCI8XCIpIHtcbiAgICAgICAgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCBcIkFkamFjZW50IEpTWCBlbGVtZW50cyBtdXN0IGJlIHdyYXBwZWQgaW4gYW4gZW5jbG9zaW5nIHRhZ1wiKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgJ0pTWCcgKyBmcmFnbWVudE9yRWxlbWVudCk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgSlNYIHRleHRcblxuICAgIGpzeF9wYXJzZVRleHQoKSB7XG4gICAgICBsZXQgbm9kZSA9IHRoaXMucGFyc2VMaXRlcmFsKHRoaXMudmFsdWUpO1xuICAgICAgbm9kZS50eXBlID0gXCJKU1hUZXh0XCI7XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZXMgZW50aXJlIEpTWCBlbGVtZW50IGZyb20gY3VycmVudCBwb3NpdGlvbi5cblxuICAgIGpzeF9wYXJzZUVsZW1lbnQoKSB7XG4gICAgICBsZXQgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgICB0aGlzLm5leHQoKTtcbiAgICAgIHJldHVybiB0aGlzLmpzeF9wYXJzZUVsZW1lbnRBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgIH1cblxuICAgIHBhcnNlRXhwckF0b20ocmVmU2hvcnRIYW5kRGVmYXVsdFBvcykge1xuICAgICAgaWYgKHRoaXMudHlwZSA9PT0gdG9rLmpzeFRleHQpXG4gICAgICAgIHJldHVybiB0aGlzLmpzeF9wYXJzZVRleHQoKTtcbiAgICAgIGVsc2UgaWYgKHRoaXMudHlwZSA9PT0gdG9rLmpzeFRhZ1N0YXJ0KVxuICAgICAgICByZXR1cm4gdGhpcy5qc3hfcGFyc2VFbGVtZW50KCk7XG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBzdXBlci5wYXJzZUV4cHJBdG9tKHJlZlNob3J0SGFuZERlZmF1bHRQb3MpO1xuICAgIH1cblxuICAgIHJlYWRUb2tlbihjb2RlKSB7XG4gICAgICBsZXQgY29udGV4dCA9IHRoaXMuY3VyQ29udGV4dCgpO1xuXG4gICAgICBpZiAoY29udGV4dCA9PT0gdGNfZXhwcikgcmV0dXJuIHRoaXMuanN4X3JlYWRUb2tlbigpO1xuXG4gICAgICBpZiAoY29udGV4dCA9PT0gdGNfb1RhZyB8fCBjb250ZXh0ID09PSB0Y19jVGFnKSB7XG4gICAgICAgIGlmIChpc0lkZW50aWZpZXJTdGFydChjb2RlKSkgcmV0dXJuIHRoaXMuanN4X3JlYWRXb3JkKCk7XG5cbiAgICAgICAgaWYgKGNvZGUgPT0gNjIpIHtcbiAgICAgICAgICArK3RoaXMucG9zO1xuICAgICAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHRvay5qc3hUYWdFbmQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKChjb2RlID09PSAzNCB8fCBjb2RlID09PSAzOSkgJiYgY29udGV4dCA9PSB0Y19vVGFnKVxuICAgICAgICAgIHJldHVybiB0aGlzLmpzeF9yZWFkU3RyaW5nKGNvZGUpO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29kZSA9PT0gNjAgJiYgdGhpcy5leHByQWxsb3dlZCAmJiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKSAhPT0gMzMpIHtcbiAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odG9rLmpzeFRhZ1N0YXJ0KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdXBlci5yZWFkVG9rZW4oY29kZSk7XG4gICAgfVxuXG4gICAgdXBkYXRlQ29udGV4dChwcmV2VHlwZSkge1xuICAgICAgaWYgKHRoaXMudHlwZSA9PSB0dC5icmFjZUwpIHtcbiAgICAgICAgdmFyIGN1ckNvbnRleHQgPSB0aGlzLmN1ckNvbnRleHQoKTtcbiAgICAgICAgaWYgKGN1ckNvbnRleHQgPT0gdGNfb1RhZykgdGhpcy5jb250ZXh0LnB1c2godG9rQ29udGV4dHMuYl9leHByKTtcbiAgICAgICAgZWxzZSBpZiAoY3VyQ29udGV4dCA9PSB0Y19leHByKSB0aGlzLmNvbnRleHQucHVzaCh0b2tDb250ZXh0cy5iX3RtcGwpO1xuICAgICAgICBlbHNlIHN1cGVyLnVwZGF0ZUNvbnRleHQocHJldlR5cGUpO1xuICAgICAgICB0aGlzLmV4cHJBbGxvd2VkID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy50eXBlID09PSB0dC5zbGFzaCAmJiBwcmV2VHlwZSA9PT0gdG9rLmpzeFRhZ1N0YXJ0KSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sZW5ndGggLT0gMjsgLy8gZG8gbm90IGNvbnNpZGVyIEpTWCBleHByIC0+IEpTWCBvcGVuIHRhZyAtPiAuLi4gYW55bW9yZVxuICAgICAgICB0aGlzLmNvbnRleHQucHVzaCh0Y19jVGFnKTsgLy8gcmVjb25zaWRlciBhcyBjbG9zaW5nIHRhZyBjb250ZXh0XG4gICAgICAgIHRoaXMuZXhwckFsbG93ZWQgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBzdXBlci51cGRhdGVDb250ZXh0KHByZXZUeXBlKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgcXVvdDogJ1xcdTAwMjInLFxuICBhbXA6ICcmJyxcbiAgYXBvczogJ1xcdTAwMjcnLFxuICBsdDogJzwnLFxuICBndDogJz4nLFxuICBuYnNwOiAnXFx1MDBBMCcsXG4gIGlleGNsOiAnXFx1MDBBMScsXG4gIGNlbnQ6ICdcXHUwMEEyJyxcbiAgcG91bmQ6ICdcXHUwMEEzJyxcbiAgY3VycmVuOiAnXFx1MDBBNCcsXG4gIHllbjogJ1xcdTAwQTUnLFxuICBicnZiYXI6ICdcXHUwMEE2JyxcbiAgc2VjdDogJ1xcdTAwQTcnLFxuICB1bWw6ICdcXHUwMEE4JyxcbiAgY29weTogJ1xcdTAwQTknLFxuICBvcmRmOiAnXFx1MDBBQScsXG4gIGxhcXVvOiAnXFx1MDBBQicsXG4gIG5vdDogJ1xcdTAwQUMnLFxuICBzaHk6ICdcXHUwMEFEJyxcbiAgcmVnOiAnXFx1MDBBRScsXG4gIG1hY3I6ICdcXHUwMEFGJyxcbiAgZGVnOiAnXFx1MDBCMCcsXG4gIHBsdXNtbjogJ1xcdTAwQjEnLFxuICBzdXAyOiAnXFx1MDBCMicsXG4gIHN1cDM6ICdcXHUwMEIzJyxcbiAgYWN1dGU6ICdcXHUwMEI0JyxcbiAgbWljcm86ICdcXHUwMEI1JyxcbiAgcGFyYTogJ1xcdTAwQjYnLFxuICBtaWRkb3Q6ICdcXHUwMEI3JyxcbiAgY2VkaWw6ICdcXHUwMEI4JyxcbiAgc3VwMTogJ1xcdTAwQjknLFxuICBvcmRtOiAnXFx1MDBCQScsXG4gIHJhcXVvOiAnXFx1MDBCQicsXG4gIGZyYWMxNDogJ1xcdTAwQkMnLFxuICBmcmFjMTI6ICdcXHUwMEJEJyxcbiAgZnJhYzM0OiAnXFx1MDBCRScsXG4gIGlxdWVzdDogJ1xcdTAwQkYnLFxuICBBZ3JhdmU6ICdcXHUwMEMwJyxcbiAgQWFjdXRlOiAnXFx1MDBDMScsXG4gIEFjaXJjOiAnXFx1MDBDMicsXG4gIEF0aWxkZTogJ1xcdTAwQzMnLFxuICBBdW1sOiAnXFx1MDBDNCcsXG4gIEFyaW5nOiAnXFx1MDBDNScsXG4gIEFFbGlnOiAnXFx1MDBDNicsXG4gIENjZWRpbDogJ1xcdTAwQzcnLFxuICBFZ3JhdmU6ICdcXHUwMEM4JyxcbiAgRWFjdXRlOiAnXFx1MDBDOScsXG4gIEVjaXJjOiAnXFx1MDBDQScsXG4gIEV1bWw6ICdcXHUwMENCJyxcbiAgSWdyYXZlOiAnXFx1MDBDQycsXG4gIElhY3V0ZTogJ1xcdTAwQ0QnLFxuICBJY2lyYzogJ1xcdTAwQ0UnLFxuICBJdW1sOiAnXFx1MDBDRicsXG4gIEVUSDogJ1xcdTAwRDAnLFxuICBOdGlsZGU6ICdcXHUwMEQxJyxcbiAgT2dyYXZlOiAnXFx1MDBEMicsXG4gIE9hY3V0ZTogJ1xcdTAwRDMnLFxuICBPY2lyYzogJ1xcdTAwRDQnLFxuICBPdGlsZGU6ICdcXHUwMEQ1JyxcbiAgT3VtbDogJ1xcdTAwRDYnLFxuICB0aW1lczogJ1xcdTAwRDcnLFxuICBPc2xhc2g6ICdcXHUwMEQ4JyxcbiAgVWdyYXZlOiAnXFx1MDBEOScsXG4gIFVhY3V0ZTogJ1xcdTAwREEnLFxuICBVY2lyYzogJ1xcdTAwREInLFxuICBVdW1sOiAnXFx1MDBEQycsXG4gIFlhY3V0ZTogJ1xcdTAwREQnLFxuICBUSE9STjogJ1xcdTAwREUnLFxuICBzemxpZzogJ1xcdTAwREYnLFxuICBhZ3JhdmU6ICdcXHUwMEUwJyxcbiAgYWFjdXRlOiAnXFx1MDBFMScsXG4gIGFjaXJjOiAnXFx1MDBFMicsXG4gIGF0aWxkZTogJ1xcdTAwRTMnLFxuICBhdW1sOiAnXFx1MDBFNCcsXG4gIGFyaW5nOiAnXFx1MDBFNScsXG4gIGFlbGlnOiAnXFx1MDBFNicsXG4gIGNjZWRpbDogJ1xcdTAwRTcnLFxuICBlZ3JhdmU6ICdcXHUwMEU4JyxcbiAgZWFjdXRlOiAnXFx1MDBFOScsXG4gIGVjaXJjOiAnXFx1MDBFQScsXG4gIGV1bWw6ICdcXHUwMEVCJyxcbiAgaWdyYXZlOiAnXFx1MDBFQycsXG4gIGlhY3V0ZTogJ1xcdTAwRUQnLFxuICBpY2lyYzogJ1xcdTAwRUUnLFxuICBpdW1sOiAnXFx1MDBFRicsXG4gIGV0aDogJ1xcdTAwRjAnLFxuICBudGlsZGU6ICdcXHUwMEYxJyxcbiAgb2dyYXZlOiAnXFx1MDBGMicsXG4gIG9hY3V0ZTogJ1xcdTAwRjMnLFxuICBvY2lyYzogJ1xcdTAwRjQnLFxuICBvdGlsZGU6ICdcXHUwMEY1JyxcbiAgb3VtbDogJ1xcdTAwRjYnLFxuICBkaXZpZGU6ICdcXHUwMEY3JyxcbiAgb3NsYXNoOiAnXFx1MDBGOCcsXG4gIHVncmF2ZTogJ1xcdTAwRjknLFxuICB1YWN1dGU6ICdcXHUwMEZBJyxcbiAgdWNpcmM6ICdcXHUwMEZCJyxcbiAgdXVtbDogJ1xcdTAwRkMnLFxuICB5YWN1dGU6ICdcXHUwMEZEJyxcbiAgdGhvcm46ICdcXHUwMEZFJyxcbiAgeXVtbDogJ1xcdTAwRkYnLFxuICBPRWxpZzogJ1xcdTAxNTInLFxuICBvZWxpZzogJ1xcdTAxNTMnLFxuICBTY2Fyb246ICdcXHUwMTYwJyxcbiAgc2Nhcm9uOiAnXFx1MDE2MScsXG4gIFl1bWw6ICdcXHUwMTc4JyxcbiAgZm5vZjogJ1xcdTAxOTInLFxuICBjaXJjOiAnXFx1MDJDNicsXG4gIHRpbGRlOiAnXFx1MDJEQycsXG4gIEFscGhhOiAnXFx1MDM5MScsXG4gIEJldGE6ICdcXHUwMzkyJyxcbiAgR2FtbWE6ICdcXHUwMzkzJyxcbiAgRGVsdGE6ICdcXHUwMzk0JyxcbiAgRXBzaWxvbjogJ1xcdTAzOTUnLFxuICBaZXRhOiAnXFx1MDM5NicsXG4gIEV0YTogJ1xcdTAzOTcnLFxuICBUaGV0YTogJ1xcdTAzOTgnLFxuICBJb3RhOiAnXFx1MDM5OScsXG4gIEthcHBhOiAnXFx1MDM5QScsXG4gIExhbWJkYTogJ1xcdTAzOUInLFxuICBNdTogJ1xcdTAzOUMnLFxuICBOdTogJ1xcdTAzOUQnLFxuICBYaTogJ1xcdTAzOUUnLFxuICBPbWljcm9uOiAnXFx1MDM5RicsXG4gIFBpOiAnXFx1MDNBMCcsXG4gIFJobzogJ1xcdTAzQTEnLFxuICBTaWdtYTogJ1xcdTAzQTMnLFxuICBUYXU6ICdcXHUwM0E0JyxcbiAgVXBzaWxvbjogJ1xcdTAzQTUnLFxuICBQaGk6ICdcXHUwM0E2JyxcbiAgQ2hpOiAnXFx1MDNBNycsXG4gIFBzaTogJ1xcdTAzQTgnLFxuICBPbWVnYTogJ1xcdTAzQTknLFxuICBhbHBoYTogJ1xcdTAzQjEnLFxuICBiZXRhOiAnXFx1MDNCMicsXG4gIGdhbW1hOiAnXFx1MDNCMycsXG4gIGRlbHRhOiAnXFx1MDNCNCcsXG4gIGVwc2lsb246ICdcXHUwM0I1JyxcbiAgemV0YTogJ1xcdTAzQjYnLFxuICBldGE6ICdcXHUwM0I3JyxcbiAgdGhldGE6ICdcXHUwM0I4JyxcbiAgaW90YTogJ1xcdTAzQjknLFxuICBrYXBwYTogJ1xcdTAzQkEnLFxuICBsYW1iZGE6ICdcXHUwM0JCJyxcbiAgbXU6ICdcXHUwM0JDJyxcbiAgbnU6ICdcXHUwM0JEJyxcbiAgeGk6ICdcXHUwM0JFJyxcbiAgb21pY3JvbjogJ1xcdTAzQkYnLFxuICBwaTogJ1xcdTAzQzAnLFxuICByaG86ICdcXHUwM0MxJyxcbiAgc2lnbWFmOiAnXFx1MDNDMicsXG4gIHNpZ21hOiAnXFx1MDNDMycsXG4gIHRhdTogJ1xcdTAzQzQnLFxuICB1cHNpbG9uOiAnXFx1MDNDNScsXG4gIHBoaTogJ1xcdTAzQzYnLFxuICBjaGk6ICdcXHUwM0M3JyxcbiAgcHNpOiAnXFx1MDNDOCcsXG4gIG9tZWdhOiAnXFx1MDNDOScsXG4gIHRoZXRhc3ltOiAnXFx1MDNEMScsXG4gIHVwc2loOiAnXFx1MDNEMicsXG4gIHBpdjogJ1xcdTAzRDYnLFxuICBlbnNwOiAnXFx1MjAwMicsXG4gIGVtc3A6ICdcXHUyMDAzJyxcbiAgdGhpbnNwOiAnXFx1MjAwOScsXG4gIHp3bmo6ICdcXHUyMDBDJyxcbiAgendqOiAnXFx1MjAwRCcsXG4gIGxybTogJ1xcdTIwMEUnLFxuICBybG06ICdcXHUyMDBGJyxcbiAgbmRhc2g6ICdcXHUyMDEzJyxcbiAgbWRhc2g6ICdcXHUyMDE0JyxcbiAgbHNxdW86ICdcXHUyMDE4JyxcbiAgcnNxdW86ICdcXHUyMDE5JyxcbiAgc2JxdW86ICdcXHUyMDFBJyxcbiAgbGRxdW86ICdcXHUyMDFDJyxcbiAgcmRxdW86ICdcXHUyMDFEJyxcbiAgYmRxdW86ICdcXHUyMDFFJyxcbiAgZGFnZ2VyOiAnXFx1MjAyMCcsXG4gIERhZ2dlcjogJ1xcdTIwMjEnLFxuICBidWxsOiAnXFx1MjAyMicsXG4gIGhlbGxpcDogJ1xcdTIwMjYnLFxuICBwZXJtaWw6ICdcXHUyMDMwJyxcbiAgcHJpbWU6ICdcXHUyMDMyJyxcbiAgUHJpbWU6ICdcXHUyMDMzJyxcbiAgbHNhcXVvOiAnXFx1MjAzOScsXG4gIHJzYXF1bzogJ1xcdTIwM0EnLFxuICBvbGluZTogJ1xcdTIwM0UnLFxuICBmcmFzbDogJ1xcdTIwNDQnLFxuICBldXJvOiAnXFx1MjBBQycsXG4gIGltYWdlOiAnXFx1MjExMScsXG4gIHdlaWVycDogJ1xcdTIxMTgnLFxuICByZWFsOiAnXFx1MjExQycsXG4gIHRyYWRlOiAnXFx1MjEyMicsXG4gIGFsZWZzeW06ICdcXHUyMTM1JyxcbiAgbGFycjogJ1xcdTIxOTAnLFxuICB1YXJyOiAnXFx1MjE5MScsXG4gIHJhcnI6ICdcXHUyMTkyJyxcbiAgZGFycjogJ1xcdTIxOTMnLFxuICBoYXJyOiAnXFx1MjE5NCcsXG4gIGNyYXJyOiAnXFx1MjFCNScsXG4gIGxBcnI6ICdcXHUyMUQwJyxcbiAgdUFycjogJ1xcdTIxRDEnLFxuICByQXJyOiAnXFx1MjFEMicsXG4gIGRBcnI6ICdcXHUyMUQzJyxcbiAgaEFycjogJ1xcdTIxRDQnLFxuICBmb3JhbGw6ICdcXHUyMjAwJyxcbiAgcGFydDogJ1xcdTIyMDInLFxuICBleGlzdDogJ1xcdTIyMDMnLFxuICBlbXB0eTogJ1xcdTIyMDUnLFxuICBuYWJsYTogJ1xcdTIyMDcnLFxuICBpc2luOiAnXFx1MjIwOCcsXG4gIG5vdGluOiAnXFx1MjIwOScsXG4gIG5pOiAnXFx1MjIwQicsXG4gIHByb2Q6ICdcXHUyMjBGJyxcbiAgc3VtOiAnXFx1MjIxMScsXG4gIG1pbnVzOiAnXFx1MjIxMicsXG4gIGxvd2FzdDogJ1xcdTIyMTcnLFxuICByYWRpYzogJ1xcdTIyMUEnLFxuICBwcm9wOiAnXFx1MjIxRCcsXG4gIGluZmluOiAnXFx1MjIxRScsXG4gIGFuZzogJ1xcdTIyMjAnLFxuICBhbmQ6ICdcXHUyMjI3JyxcbiAgb3I6ICdcXHUyMjI4JyxcbiAgY2FwOiAnXFx1MjIyOScsXG4gIGN1cDogJ1xcdTIyMkEnLFxuICAnaW50JzogJ1xcdTIyMkInLFxuICB0aGVyZTQ6ICdcXHUyMjM0JyxcbiAgc2ltOiAnXFx1MjIzQycsXG4gIGNvbmc6ICdcXHUyMjQ1JyxcbiAgYXN5bXA6ICdcXHUyMjQ4JyxcbiAgbmU6ICdcXHUyMjYwJyxcbiAgZXF1aXY6ICdcXHUyMjYxJyxcbiAgbGU6ICdcXHUyMjY0JyxcbiAgZ2U6ICdcXHUyMjY1JyxcbiAgc3ViOiAnXFx1MjI4MicsXG4gIHN1cDogJ1xcdTIyODMnLFxuICBuc3ViOiAnXFx1MjI4NCcsXG4gIHN1YmU6ICdcXHUyMjg2JyxcbiAgc3VwZTogJ1xcdTIyODcnLFxuICBvcGx1czogJ1xcdTIyOTUnLFxuICBvdGltZXM6ICdcXHUyMjk3JyxcbiAgcGVycDogJ1xcdTIyQTUnLFxuICBzZG90OiAnXFx1MjJDNScsXG4gIGxjZWlsOiAnXFx1MjMwOCcsXG4gIHJjZWlsOiAnXFx1MjMwOScsXG4gIGxmbG9vcjogJ1xcdTIzMEEnLFxuICByZmxvb3I6ICdcXHUyMzBCJyxcbiAgbGFuZzogJ1xcdTIzMjknLFxuICByYW5nOiAnXFx1MjMyQScsXG4gIGxvejogJ1xcdTI1Q0EnLFxuICBzcGFkZXM6ICdcXHUyNjYwJyxcbiAgY2x1YnM6ICdcXHUyNjYzJyxcbiAgaGVhcnRzOiAnXFx1MjY2NScsXG4gIGRpYW1zOiAnXFx1MjY2Nidcbn07XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuICB0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBmYWN0b3J5KGV4cG9ydHMpIDpcbiAgdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKFsnZXhwb3J0cyddLCBmYWN0b3J5KSA6XG4gIChnbG9iYWwgPSB0eXBlb2YgZ2xvYmFsVGhpcyAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWxUaGlzIDogZ2xvYmFsIHx8IHNlbGYsIGZhY3RvcnkoZ2xvYmFsLmFjb3JuID0ge30pKTtcbn0pKHRoaXMsIChmdW5jdGlvbiAoZXhwb3J0cykgeyAndXNlIHN0cmljdCc7XG5cbiAgLy8gVGhpcyBmaWxlIHdhcyBnZW5lcmF0ZWQuIERvIG5vdCBtb2RpZnkgbWFudWFsbHkhXG4gIHZhciBhc3RyYWxJZGVudGlmaWVyQ29kZXMgPSBbNTA5LCAwLCAyMjcsIDAsIDE1MCwgNCwgMjk0LCA5LCAxMzY4LCAyLCAyLCAxLCA2LCAzLCA0MSwgMiwgNSwgMCwgMTY2LCAxLCA1NzQsIDMsIDksIDksIDM3MCwgMSwgODEsIDIsIDcxLCAxMCwgNTAsIDMsIDEyMywgMiwgNTQsIDE0LCAzMiwgMTAsIDMsIDEsIDExLCAzLCA0NiwgMTAsIDgsIDAsIDQ2LCA5LCA3LCAyLCAzNywgMTMsIDIsIDksIDYsIDEsIDQ1LCAwLCAxMywgMiwgNDksIDEzLCA5LCAzLCAyLCAxMSwgODMsIDExLCA3LCAwLCAzLCAwLCAxNTgsIDExLCA2LCA5LCA3LCAzLCA1NiwgMSwgMiwgNiwgMywgMSwgMywgMiwgMTAsIDAsIDExLCAxLCAzLCA2LCA0LCA0LCAxOTMsIDE3LCAxMCwgOSwgNSwgMCwgODIsIDE5LCAxMywgOSwgMjE0LCA2LCAzLCA4LCAyOCwgMSwgODMsIDE2LCAxNiwgOSwgODIsIDEyLCA5LCA5LCA4NCwgMTQsIDUsIDksIDI0MywgMTQsIDE2NiwgOSwgNzEsIDUsIDIsIDEsIDMsIDMsIDIsIDAsIDIsIDEsIDEzLCA5LCAxMjAsIDYsIDMsIDYsIDQsIDAsIDI5LCA5LCA0MSwgNiwgMiwgMywgOSwgMCwgMTAsIDEwLCA0NywgMTUsIDQwNiwgNywgMiwgNywgMTcsIDksIDU3LCAyMSwgMiwgMTMsIDEyMywgNSwgNCwgMCwgMiwgMSwgMiwgNiwgMiwgMCwgOSwgOSwgNDksIDQsIDIsIDEsIDIsIDQsIDksIDksIDMzMCwgMywgMTAsIDEsIDIsIDAsIDQ5LCA2LCA0LCA0LCAxNCwgOSwgNTM1MSwgMCwgNywgMTQsIDEzODM1LCA5LCA4NywgOSwgMzksIDQsIDYwLCA2LCAyNiwgOSwgMTAxNCwgMCwgMiwgNTQsIDgsIDMsIDgyLCAwLCAxMiwgMSwgMTk2MjgsIDEsIDQ3MDYsIDQ1LCAzLCAyMiwgNTQzLCA0LCA0LCA1LCA5LCA3LCAzLCA2LCAzMSwgMywgMTQ5LCAyLCAxNDE4LCA0OSwgNTEzLCA1NCwgNSwgNDksIDksIDAsIDE1LCAwLCAyMywgNCwgMiwgMTQsIDEzNjEsIDYsIDIsIDE2LCAzLCA2LCAyLCAxLCAyLCA0LCAxMDEsIDAsIDE2MSwgNiwgMTAsIDksIDM1NywgMCwgNjIsIDEzLCA0OTksIDEzLCA5ODMsIDYsIDExMCwgNiwgNiwgOSwgNDc1OSwgOSwgNzg3NzE5LCAyMzldO1xuXG4gIC8vIFRoaXMgZmlsZSB3YXMgZ2VuZXJhdGVkLiBEbyBub3QgbW9kaWZ5IG1hbnVhbGx5IVxuICB2YXIgYXN0cmFsSWRlbnRpZmllclN0YXJ0Q29kZXMgPSBbMCwgMTEsIDIsIDI1LCAyLCAxOCwgMiwgMSwgMiwgMTQsIDMsIDEzLCAzNSwgMTIyLCA3MCwgNTIsIDI2OCwgMjgsIDQsIDQ4LCA0OCwgMzEsIDE0LCAyOSwgNiwgMzcsIDExLCAyOSwgMywgMzUsIDUsIDcsIDIsIDQsIDQzLCAxNTcsIDE5LCAzNSwgNSwgMzUsIDUsIDM5LCA5LCA1MSwgMTMsIDEwLCAyLCAxNCwgMiwgNiwgMiwgMSwgMiwgMTAsIDIsIDE0LCAyLCA2LCAyLCAxLCA2OCwgMzEwLCAxMCwgMjEsIDExLCA3LCAyNSwgNSwgMiwgNDEsIDIsIDgsIDcwLCA1LCAzLCAwLCAyLCA0MywgMiwgMSwgNCwgMCwgMywgMjIsIDExLCAyMiwgMTAsIDMwLCA2NiwgMTgsIDIsIDEsIDExLCAyMSwgMTEsIDI1LCA3MSwgNTUsIDcsIDEsIDY1LCAwLCAxNiwgMywgMiwgMiwgMiwgMjgsIDQzLCAyOCwgNCwgMjgsIDM2LCA3LCAyLCAyNywgMjgsIDUzLCAxMSwgMjEsIDExLCAxOCwgMTQsIDE3LCAxMTEsIDcyLCA1NiwgNTAsIDE0LCA1MCwgMTQsIDM1LCAzNDksIDQxLCA3LCAxLCA3OSwgMjgsIDExLCAwLCA5LCAyMSwgNDMsIDE3LCA0NywgMjAsIDI4LCAyMiwgMTMsIDUyLCA1OCwgMSwgMywgMCwgMTQsIDQ0LCAzMywgMjQsIDI3LCAzNSwgMzAsIDAsIDMsIDAsIDksIDM0LCA0LCAwLCAxMywgNDcsIDE1LCAzLCAyMiwgMCwgMiwgMCwgMzYsIDE3LCAyLCAyNCwgMjAsIDEsIDY0LCA2LCAyLCAwLCAyLCAzLCAyLCAxNCwgMiwgOSwgOCwgNDYsIDM5LCA3LCAzLCAxLCAzLCAyMSwgMiwgNiwgMiwgMSwgMiwgNCwgNCwgMCwgMTksIDAsIDEzLCA0LCAxNTksIDUyLCAxOSwgMywgMjEsIDIsIDMxLCA0NywgMjEsIDEsIDIsIDAsIDE4NSwgNDYsIDQyLCAzLCAzNywgNDcsIDIxLCAwLCA2MCwgNDIsIDE0LCAwLCA3MiwgMjYsIDM4LCA2LCAxODYsIDQzLCAxMTcsIDYzLCAzMiwgNywgMywgMCwgMywgNywgMiwgMSwgMiwgMjMsIDE2LCAwLCAyLCAwLCA5NSwgNywgMywgMzgsIDE3LCAwLCAyLCAwLCAyOSwgMCwgMTEsIDM5LCA4LCAwLCAyMiwgMCwgMTIsIDQ1LCAyMCwgMCwgMTksIDcyLCAyNjQsIDgsIDIsIDM2LCAxOCwgMCwgNTAsIDI5LCAxMTMsIDYsIDIsIDEsIDIsIDM3LCAyMiwgMCwgMjYsIDUsIDIsIDEsIDIsIDMxLCAxNSwgMCwgMzI4LCAxOCwgMTYsIDAsIDIsIDEyLCAyLCAzMywgMTI1LCAwLCA4MCwgOTIxLCAxMDMsIDExMCwgMTgsIDE5NSwgMjYzNywgOTYsIDE2LCAxMDcxLCAxOCwgNSwgNDAyNiwgNTgyLCA4NjM0LCA1NjgsIDgsIDMwLCAxOCwgNzgsIDE4LCAyOSwgMTksIDQ3LCAxNywgMywgMzIsIDIwLCA2LCAxOCwgNjg5LCA2MywgMTI5LCA3NCwgNiwgMCwgNjcsIDEyLCA2NSwgMSwgMiwgMCwgMjksIDYxMzUsIDksIDEyMzcsIDQzLCA4LCA4OTM2LCAzLCAyLCA2LCAyLCAxLCAyLCAyOTAsIDE2LCAwLCAzMCwgMiwgMywgMCwgMTUsIDMsIDksIDM5NSwgMjMwOSwgMTA2LCA2LCAxMiwgNCwgOCwgOCwgOSwgNTk5MSwgODQsIDIsIDcwLCAyLCAxLCAzLCAwLCAzLCAxLCAzLCAzLCAyLCAxMSwgMiwgMCwgMiwgNiwgMiwgNjQsIDIsIDMsIDMsIDcsIDIsIDYsIDIsIDI3LCAyLCAzLCAyLCA0LCAyLCAwLCA0LCA2LCAyLCAzMzksIDMsIDI0LCAyLCAyNCwgMiwgMzAsIDIsIDI0LCAyLCAzMCwgMiwgMjQsIDIsIDMwLCAyLCAyNCwgMiwgMzAsIDIsIDI0LCAyLCA3LCAxODQ1LCAzMCwgNywgNSwgMjYyLCA2MSwgMTQ3LCA0NCwgMTEsIDYsIDE3LCAwLCAzMjIsIDI5LCAxOSwgNDMsIDQ4NSwgMjcsIDc1NywgNiwgMiwgMywgMiwgMSwgMiwgMTQsIDIsIDE5NiwgNjAsIDY3LCA4LCAwLCAxMjA1LCAzLCAyLCAyNiwgMiwgMSwgMiwgMCwgMywgMCwgMiwgOSwgMiwgMywgMiwgMCwgMiwgMCwgNywgMCwgNSwgMCwgMiwgMCwgMiwgMCwgMiwgMiwgMiwgMSwgMiwgMCwgMywgMCwgMiwgMCwgMiwgMCwgMiwgMCwgMiwgMCwgMiwgMSwgMiwgMCwgMywgMywgMiwgNiwgMiwgMywgMiwgMywgMiwgMCwgMiwgOSwgMiwgMTYsIDYsIDIsIDIsIDQsIDIsIDE2LCA0NDIxLCA0MjcxOSwgMzMsIDQxNTMsIDcsIDIyMSwgMywgNTc2MSwgMTUsIDc0NzIsIDMxMDQsIDU0MSwgMTUwNywgNDkzOCwgNiwgNDE5MV07XG5cbiAgLy8gVGhpcyBmaWxlIHdhcyBnZW5lcmF0ZWQuIERvIG5vdCBtb2RpZnkgbWFudWFsbHkhXG4gIHZhciBub25BU0NJSWlkZW50aWZpZXJDaGFycyA9IFwiXFx1MjAwY1xcdTIwMGRcXHhiN1xcdTAzMDAtXFx1MDM2ZlxcdTAzODdcXHUwNDgzLVxcdTA0ODdcXHUwNTkxLVxcdTA1YmRcXHUwNWJmXFx1MDVjMVxcdTA1YzJcXHUwNWM0XFx1MDVjNVxcdTA1YzdcXHUwNjEwLVxcdTA2MWFcXHUwNjRiLVxcdTA2NjlcXHUwNjcwXFx1MDZkNi1cXHUwNmRjXFx1MDZkZi1cXHUwNmU0XFx1MDZlN1xcdTA2ZThcXHUwNmVhLVxcdTA2ZWRcXHUwNmYwLVxcdTA2ZjlcXHUwNzExXFx1MDczMC1cXHUwNzRhXFx1MDdhNi1cXHUwN2IwXFx1MDdjMC1cXHUwN2M5XFx1MDdlYi1cXHUwN2YzXFx1MDdmZFxcdTA4MTYtXFx1MDgxOVxcdTA4MWItXFx1MDgyM1xcdTA4MjUtXFx1MDgyN1xcdTA4MjktXFx1MDgyZFxcdTA4NTktXFx1MDg1YlxcdTA4OTgtXFx1MDg5ZlxcdTA4Y2EtXFx1MDhlMVxcdTA4ZTMtXFx1MDkwM1xcdTA5M2EtXFx1MDkzY1xcdTA5M2UtXFx1MDk0ZlxcdTA5NTEtXFx1MDk1N1xcdTA5NjJcXHUwOTYzXFx1MDk2Ni1cXHUwOTZmXFx1MDk4MS1cXHUwOTgzXFx1MDliY1xcdTA5YmUtXFx1MDljNFxcdTA5YzdcXHUwOWM4XFx1MDljYi1cXHUwOWNkXFx1MDlkN1xcdTA5ZTJcXHUwOWUzXFx1MDllNi1cXHUwOWVmXFx1MDlmZVxcdTBhMDEtXFx1MGEwM1xcdTBhM2NcXHUwYTNlLVxcdTBhNDJcXHUwYTQ3XFx1MGE0OFxcdTBhNGItXFx1MGE0ZFxcdTBhNTFcXHUwYTY2LVxcdTBhNzFcXHUwYTc1XFx1MGE4MS1cXHUwYTgzXFx1MGFiY1xcdTBhYmUtXFx1MGFjNVxcdTBhYzctXFx1MGFjOVxcdTBhY2ItXFx1MGFjZFxcdTBhZTJcXHUwYWUzXFx1MGFlNi1cXHUwYWVmXFx1MGFmYS1cXHUwYWZmXFx1MGIwMS1cXHUwYjAzXFx1MGIzY1xcdTBiM2UtXFx1MGI0NFxcdTBiNDdcXHUwYjQ4XFx1MGI0Yi1cXHUwYjRkXFx1MGI1NS1cXHUwYjU3XFx1MGI2MlxcdTBiNjNcXHUwYjY2LVxcdTBiNmZcXHUwYjgyXFx1MGJiZS1cXHUwYmMyXFx1MGJjNi1cXHUwYmM4XFx1MGJjYS1cXHUwYmNkXFx1MGJkN1xcdTBiZTYtXFx1MGJlZlxcdTBjMDAtXFx1MGMwNFxcdTBjM2NcXHUwYzNlLVxcdTBjNDRcXHUwYzQ2LVxcdTBjNDhcXHUwYzRhLVxcdTBjNGRcXHUwYzU1XFx1MGM1NlxcdTBjNjJcXHUwYzYzXFx1MGM2Ni1cXHUwYzZmXFx1MGM4MS1cXHUwYzgzXFx1MGNiY1xcdTBjYmUtXFx1MGNjNFxcdTBjYzYtXFx1MGNjOFxcdTBjY2EtXFx1MGNjZFxcdTBjZDVcXHUwY2Q2XFx1MGNlMlxcdTBjZTNcXHUwY2U2LVxcdTBjZWZcXHUwY2YzXFx1MGQwMC1cXHUwZDAzXFx1MGQzYlxcdTBkM2NcXHUwZDNlLVxcdTBkNDRcXHUwZDQ2LVxcdTBkNDhcXHUwZDRhLVxcdTBkNGRcXHUwZDU3XFx1MGQ2MlxcdTBkNjNcXHUwZDY2LVxcdTBkNmZcXHUwZDgxLVxcdTBkODNcXHUwZGNhXFx1MGRjZi1cXHUwZGQ0XFx1MGRkNlxcdTBkZDgtXFx1MGRkZlxcdTBkZTYtXFx1MGRlZlxcdTBkZjJcXHUwZGYzXFx1MGUzMVxcdTBlMzQtXFx1MGUzYVxcdTBlNDctXFx1MGU0ZVxcdTBlNTAtXFx1MGU1OVxcdTBlYjFcXHUwZWI0LVxcdTBlYmNcXHUwZWM4LVxcdTBlY2VcXHUwZWQwLVxcdTBlZDlcXHUwZjE4XFx1MGYxOVxcdTBmMjAtXFx1MGYyOVxcdTBmMzVcXHUwZjM3XFx1MGYzOVxcdTBmM2VcXHUwZjNmXFx1MGY3MS1cXHUwZjg0XFx1MGY4NlxcdTBmODdcXHUwZjhkLVxcdTBmOTdcXHUwZjk5LVxcdTBmYmNcXHUwZmM2XFx1MTAyYi1cXHUxMDNlXFx1MTA0MC1cXHUxMDQ5XFx1MTA1Ni1cXHUxMDU5XFx1MTA1ZS1cXHUxMDYwXFx1MTA2Mi1cXHUxMDY0XFx1MTA2Ny1cXHUxMDZkXFx1MTA3MS1cXHUxMDc0XFx1MTA4Mi1cXHUxMDhkXFx1MTA4Zi1cXHUxMDlkXFx1MTM1ZC1cXHUxMzVmXFx1MTM2OS1cXHUxMzcxXFx1MTcxMi1cXHUxNzE1XFx1MTczMi1cXHUxNzM0XFx1MTc1MlxcdTE3NTNcXHUxNzcyXFx1MTc3M1xcdTE3YjQtXFx1MTdkM1xcdTE3ZGRcXHUxN2UwLVxcdTE3ZTlcXHUxODBiLVxcdTE4MGRcXHUxODBmLVxcdTE4MTlcXHUxOGE5XFx1MTkyMC1cXHUxOTJiXFx1MTkzMC1cXHUxOTNiXFx1MTk0Ni1cXHUxOTRmXFx1MTlkMC1cXHUxOWRhXFx1MWExNy1cXHUxYTFiXFx1MWE1NS1cXHUxYTVlXFx1MWE2MC1cXHUxYTdjXFx1MWE3Zi1cXHUxYTg5XFx1MWE5MC1cXHUxYTk5XFx1MWFiMC1cXHUxYWJkXFx1MWFiZi1cXHUxYWNlXFx1MWIwMC1cXHUxYjA0XFx1MWIzNC1cXHUxYjQ0XFx1MWI1MC1cXHUxYjU5XFx1MWI2Yi1cXHUxYjczXFx1MWI4MC1cXHUxYjgyXFx1MWJhMS1cXHUxYmFkXFx1MWJiMC1cXHUxYmI5XFx1MWJlNi1cXHUxYmYzXFx1MWMyNC1cXHUxYzM3XFx1MWM0MC1cXHUxYzQ5XFx1MWM1MC1cXHUxYzU5XFx1MWNkMC1cXHUxY2QyXFx1MWNkNC1cXHUxY2U4XFx1MWNlZFxcdTFjZjRcXHUxY2Y3LVxcdTFjZjlcXHUxZGMwLVxcdTFkZmZcXHUyMDNmXFx1MjA0MFxcdTIwNTRcXHUyMGQwLVxcdTIwZGNcXHUyMGUxXFx1MjBlNS1cXHUyMGYwXFx1MmNlZi1cXHUyY2YxXFx1MmQ3ZlxcdTJkZTAtXFx1MmRmZlxcdTMwMmEtXFx1MzAyZlxcdTMwOTlcXHUzMDlhXFx1YTYyMC1cXHVhNjI5XFx1YTY2ZlxcdWE2NzQtXFx1YTY3ZFxcdWE2OWVcXHVhNjlmXFx1YTZmMFxcdWE2ZjFcXHVhODAyXFx1YTgwNlxcdWE4MGJcXHVhODIzLVxcdWE4MjdcXHVhODJjXFx1YTg4MFxcdWE4ODFcXHVhOGI0LVxcdWE4YzVcXHVhOGQwLVxcdWE4ZDlcXHVhOGUwLVxcdWE4ZjFcXHVhOGZmLVxcdWE5MDlcXHVhOTI2LVxcdWE5MmRcXHVhOTQ3LVxcdWE5NTNcXHVhOTgwLVxcdWE5ODNcXHVhOWIzLVxcdWE5YzBcXHVhOWQwLVxcdWE5ZDlcXHVhOWU1XFx1YTlmMC1cXHVhOWY5XFx1YWEyOS1cXHVhYTM2XFx1YWE0M1xcdWFhNGNcXHVhYTRkXFx1YWE1MC1cXHVhYTU5XFx1YWE3Yi1cXHVhYTdkXFx1YWFiMFxcdWFhYjItXFx1YWFiNFxcdWFhYjdcXHVhYWI4XFx1YWFiZVxcdWFhYmZcXHVhYWMxXFx1YWFlYi1cXHVhYWVmXFx1YWFmNVxcdWFhZjZcXHVhYmUzLVxcdWFiZWFcXHVhYmVjXFx1YWJlZFxcdWFiZjAtXFx1YWJmOVxcdWZiMWVcXHVmZTAwLVxcdWZlMGZcXHVmZTIwLVxcdWZlMmZcXHVmZTMzXFx1ZmUzNFxcdWZlNGQtXFx1ZmU0ZlxcdWZmMTAtXFx1ZmYxOVxcdWZmM2ZcIjtcblxuICAvLyBUaGlzIGZpbGUgd2FzIGdlbmVyYXRlZC4gRG8gbm90IG1vZGlmeSBtYW51YWxseSFcbiAgdmFyIG5vbkFTQ0lJaWRlbnRpZmllclN0YXJ0Q2hhcnMgPSBcIlxceGFhXFx4YjVcXHhiYVxceGMwLVxceGQ2XFx4ZDgtXFx4ZjZcXHhmOC1cXHUwMmMxXFx1MDJjNi1cXHUwMmQxXFx1MDJlMC1cXHUwMmU0XFx1MDJlY1xcdTAyZWVcXHUwMzcwLVxcdTAzNzRcXHUwMzc2XFx1MDM3N1xcdTAzN2EtXFx1MDM3ZFxcdTAzN2ZcXHUwMzg2XFx1MDM4OC1cXHUwMzhhXFx1MDM4Y1xcdTAzOGUtXFx1MDNhMVxcdTAzYTMtXFx1MDNmNVxcdTAzZjctXFx1MDQ4MVxcdTA0OGEtXFx1MDUyZlxcdTA1MzEtXFx1MDU1NlxcdTA1NTlcXHUwNTYwLVxcdTA1ODhcXHUwNWQwLVxcdTA1ZWFcXHUwNWVmLVxcdTA1ZjJcXHUwNjIwLVxcdTA2NGFcXHUwNjZlXFx1MDY2ZlxcdTA2NzEtXFx1MDZkM1xcdTA2ZDVcXHUwNmU1XFx1MDZlNlxcdTA2ZWVcXHUwNmVmXFx1MDZmYS1cXHUwNmZjXFx1MDZmZlxcdTA3MTBcXHUwNzEyLVxcdTA3MmZcXHUwNzRkLVxcdTA3YTVcXHUwN2IxXFx1MDdjYS1cXHUwN2VhXFx1MDdmNFxcdTA3ZjVcXHUwN2ZhXFx1MDgwMC1cXHUwODE1XFx1MDgxYVxcdTA4MjRcXHUwODI4XFx1MDg0MC1cXHUwODU4XFx1MDg2MC1cXHUwODZhXFx1MDg3MC1cXHUwODg3XFx1MDg4OS1cXHUwODhlXFx1MDhhMC1cXHUwOGM5XFx1MDkwNC1cXHUwOTM5XFx1MDkzZFxcdTA5NTBcXHUwOTU4LVxcdTA5NjFcXHUwOTcxLVxcdTA5ODBcXHUwOTg1LVxcdTA5OGNcXHUwOThmXFx1MDk5MFxcdTA5OTMtXFx1MDlhOFxcdTA5YWEtXFx1MDliMFxcdTA5YjJcXHUwOWI2LVxcdTA5YjlcXHUwOWJkXFx1MDljZVxcdTA5ZGNcXHUwOWRkXFx1MDlkZi1cXHUwOWUxXFx1MDlmMFxcdTA5ZjFcXHUwOWZjXFx1MGEwNS1cXHUwYTBhXFx1MGEwZlxcdTBhMTBcXHUwYTEzLVxcdTBhMjhcXHUwYTJhLVxcdTBhMzBcXHUwYTMyXFx1MGEzM1xcdTBhMzVcXHUwYTM2XFx1MGEzOFxcdTBhMzlcXHUwYTU5LVxcdTBhNWNcXHUwYTVlXFx1MGE3Mi1cXHUwYTc0XFx1MGE4NS1cXHUwYThkXFx1MGE4Zi1cXHUwYTkxXFx1MGE5My1cXHUwYWE4XFx1MGFhYS1cXHUwYWIwXFx1MGFiMlxcdTBhYjNcXHUwYWI1LVxcdTBhYjlcXHUwYWJkXFx1MGFkMFxcdTBhZTBcXHUwYWUxXFx1MGFmOVxcdTBiMDUtXFx1MGIwY1xcdTBiMGZcXHUwYjEwXFx1MGIxMy1cXHUwYjI4XFx1MGIyYS1cXHUwYjMwXFx1MGIzMlxcdTBiMzNcXHUwYjM1LVxcdTBiMzlcXHUwYjNkXFx1MGI1Y1xcdTBiNWRcXHUwYjVmLVxcdTBiNjFcXHUwYjcxXFx1MGI4M1xcdTBiODUtXFx1MGI4YVxcdTBiOGUtXFx1MGI5MFxcdTBiOTItXFx1MGI5NVxcdTBiOTlcXHUwYjlhXFx1MGI5Y1xcdTBiOWVcXHUwYjlmXFx1MGJhM1xcdTBiYTRcXHUwYmE4LVxcdTBiYWFcXHUwYmFlLVxcdTBiYjlcXHUwYmQwXFx1MGMwNS1cXHUwYzBjXFx1MGMwZS1cXHUwYzEwXFx1MGMxMi1cXHUwYzI4XFx1MGMyYS1cXHUwYzM5XFx1MGMzZFxcdTBjNTgtXFx1MGM1YVxcdTBjNWRcXHUwYzYwXFx1MGM2MVxcdTBjODBcXHUwYzg1LVxcdTBjOGNcXHUwYzhlLVxcdTBjOTBcXHUwYzkyLVxcdTBjYThcXHUwY2FhLVxcdTBjYjNcXHUwY2I1LVxcdTBjYjlcXHUwY2JkXFx1MGNkZFxcdTBjZGVcXHUwY2UwXFx1MGNlMVxcdTBjZjFcXHUwY2YyXFx1MGQwNC1cXHUwZDBjXFx1MGQwZS1cXHUwZDEwXFx1MGQxMi1cXHUwZDNhXFx1MGQzZFxcdTBkNGVcXHUwZDU0LVxcdTBkNTZcXHUwZDVmLVxcdTBkNjFcXHUwZDdhLVxcdTBkN2ZcXHUwZDg1LVxcdTBkOTZcXHUwZDlhLVxcdTBkYjFcXHUwZGIzLVxcdTBkYmJcXHUwZGJkXFx1MGRjMC1cXHUwZGM2XFx1MGUwMS1cXHUwZTMwXFx1MGUzMlxcdTBlMzNcXHUwZTQwLVxcdTBlNDZcXHUwZTgxXFx1MGU4MlxcdTBlODRcXHUwZTg2LVxcdTBlOGFcXHUwZThjLVxcdTBlYTNcXHUwZWE1XFx1MGVhNy1cXHUwZWIwXFx1MGViMlxcdTBlYjNcXHUwZWJkXFx1MGVjMC1cXHUwZWM0XFx1MGVjNlxcdTBlZGMtXFx1MGVkZlxcdTBmMDBcXHUwZjQwLVxcdTBmNDdcXHUwZjQ5LVxcdTBmNmNcXHUwZjg4LVxcdTBmOGNcXHUxMDAwLVxcdTEwMmFcXHUxMDNmXFx1MTA1MC1cXHUxMDU1XFx1MTA1YS1cXHUxMDVkXFx1MTA2MVxcdTEwNjVcXHUxMDY2XFx1MTA2ZS1cXHUxMDcwXFx1MTA3NS1cXHUxMDgxXFx1MTA4ZVxcdTEwYTAtXFx1MTBjNVxcdTEwYzdcXHUxMGNkXFx1MTBkMC1cXHUxMGZhXFx1MTBmYy1cXHUxMjQ4XFx1MTI0YS1cXHUxMjRkXFx1MTI1MC1cXHUxMjU2XFx1MTI1OFxcdTEyNWEtXFx1MTI1ZFxcdTEyNjAtXFx1MTI4OFxcdTEyOGEtXFx1MTI4ZFxcdTEyOTAtXFx1MTJiMFxcdTEyYjItXFx1MTJiNVxcdTEyYjgtXFx1MTJiZVxcdTEyYzBcXHUxMmMyLVxcdTEyYzVcXHUxMmM4LVxcdTEyZDZcXHUxMmQ4LVxcdTEzMTBcXHUxMzEyLVxcdTEzMTVcXHUxMzE4LVxcdTEzNWFcXHUxMzgwLVxcdTEzOGZcXHUxM2EwLVxcdTEzZjVcXHUxM2Y4LVxcdTEzZmRcXHUxNDAxLVxcdTE2NmNcXHUxNjZmLVxcdTE2N2ZcXHUxNjgxLVxcdTE2OWFcXHUxNmEwLVxcdTE2ZWFcXHUxNmVlLVxcdTE2ZjhcXHUxNzAwLVxcdTE3MTFcXHUxNzFmLVxcdTE3MzFcXHUxNzQwLVxcdTE3NTFcXHUxNzYwLVxcdTE3NmNcXHUxNzZlLVxcdTE3NzBcXHUxNzgwLVxcdTE3YjNcXHUxN2Q3XFx1MTdkY1xcdTE4MjAtXFx1MTg3OFxcdTE4ODAtXFx1MThhOFxcdTE4YWFcXHUxOGIwLVxcdTE4ZjVcXHUxOTAwLVxcdTE5MWVcXHUxOTUwLVxcdTE5NmRcXHUxOTcwLVxcdTE5NzRcXHUxOTgwLVxcdTE5YWJcXHUxOWIwLVxcdTE5YzlcXHUxYTAwLVxcdTFhMTZcXHUxYTIwLVxcdTFhNTRcXHUxYWE3XFx1MWIwNS1cXHUxYjMzXFx1MWI0NS1cXHUxYjRjXFx1MWI4My1cXHUxYmEwXFx1MWJhZVxcdTFiYWZcXHUxYmJhLVxcdTFiZTVcXHUxYzAwLVxcdTFjMjNcXHUxYzRkLVxcdTFjNGZcXHUxYzVhLVxcdTFjN2RcXHUxYzgwLVxcdTFjODhcXHUxYzkwLVxcdTFjYmFcXHUxY2JkLVxcdTFjYmZcXHUxY2U5LVxcdTFjZWNcXHUxY2VlLVxcdTFjZjNcXHUxY2Y1XFx1MWNmNlxcdTFjZmFcXHUxZDAwLVxcdTFkYmZcXHUxZTAwLVxcdTFmMTVcXHUxZjE4LVxcdTFmMWRcXHUxZjIwLVxcdTFmNDVcXHUxZjQ4LVxcdTFmNGRcXHUxZjUwLVxcdTFmNTdcXHUxZjU5XFx1MWY1YlxcdTFmNWRcXHUxZjVmLVxcdTFmN2RcXHUxZjgwLVxcdTFmYjRcXHUxZmI2LVxcdTFmYmNcXHUxZmJlXFx1MWZjMi1cXHUxZmM0XFx1MWZjNi1cXHUxZmNjXFx1MWZkMC1cXHUxZmQzXFx1MWZkNi1cXHUxZmRiXFx1MWZlMC1cXHUxZmVjXFx1MWZmMi1cXHUxZmY0XFx1MWZmNi1cXHUxZmZjXFx1MjA3MVxcdTIwN2ZcXHUyMDkwLVxcdTIwOWNcXHUyMTAyXFx1MjEwN1xcdTIxMGEtXFx1MjExM1xcdTIxMTVcXHUyMTE4LVxcdTIxMWRcXHUyMTI0XFx1MjEyNlxcdTIxMjhcXHUyMTJhLVxcdTIxMzlcXHUyMTNjLVxcdTIxM2ZcXHUyMTQ1LVxcdTIxNDlcXHUyMTRlXFx1MjE2MC1cXHUyMTg4XFx1MmMwMC1cXHUyY2U0XFx1MmNlYi1cXHUyY2VlXFx1MmNmMlxcdTJjZjNcXHUyZDAwLVxcdTJkMjVcXHUyZDI3XFx1MmQyZFxcdTJkMzAtXFx1MmQ2N1xcdTJkNmZcXHUyZDgwLVxcdTJkOTZcXHUyZGEwLVxcdTJkYTZcXHUyZGE4LVxcdTJkYWVcXHUyZGIwLVxcdTJkYjZcXHUyZGI4LVxcdTJkYmVcXHUyZGMwLVxcdTJkYzZcXHUyZGM4LVxcdTJkY2VcXHUyZGQwLVxcdTJkZDZcXHUyZGQ4LVxcdTJkZGVcXHUzMDA1LVxcdTMwMDdcXHUzMDIxLVxcdTMwMjlcXHUzMDMxLVxcdTMwMzVcXHUzMDM4LVxcdTMwM2NcXHUzMDQxLVxcdTMwOTZcXHUzMDliLVxcdTMwOWZcXHUzMGExLVxcdTMwZmFcXHUzMGZjLVxcdTMwZmZcXHUzMTA1LVxcdTMxMmZcXHUzMTMxLVxcdTMxOGVcXHUzMWEwLVxcdTMxYmZcXHUzMWYwLVxcdTMxZmZcXHUzNDAwLVxcdTRkYmZcXHU0ZTAwLVxcdWE0OGNcXHVhNGQwLVxcdWE0ZmRcXHVhNTAwLVxcdWE2MGNcXHVhNjEwLVxcdWE2MWZcXHVhNjJhXFx1YTYyYlxcdWE2NDAtXFx1YTY2ZVxcdWE2N2YtXFx1YTY5ZFxcdWE2YTAtXFx1YTZlZlxcdWE3MTctXFx1YTcxZlxcdWE3MjItXFx1YTc4OFxcdWE3OGItXFx1YTdjYVxcdWE3ZDBcXHVhN2QxXFx1YTdkM1xcdWE3ZDUtXFx1YTdkOVxcdWE3ZjItXFx1YTgwMVxcdWE4MDMtXFx1YTgwNVxcdWE4MDctXFx1YTgwYVxcdWE4MGMtXFx1YTgyMlxcdWE4NDAtXFx1YTg3M1xcdWE4ODItXFx1YThiM1xcdWE4ZjItXFx1YThmN1xcdWE4ZmJcXHVhOGZkXFx1YThmZVxcdWE5MGEtXFx1YTkyNVxcdWE5MzAtXFx1YTk0NlxcdWE5NjAtXFx1YTk3Y1xcdWE5ODQtXFx1YTliMlxcdWE5Y2ZcXHVhOWUwLVxcdWE5ZTRcXHVhOWU2LVxcdWE5ZWZcXHVhOWZhLVxcdWE5ZmVcXHVhYTAwLVxcdWFhMjhcXHVhYTQwLVxcdWFhNDJcXHVhYTQ0LVxcdWFhNGJcXHVhYTYwLVxcdWFhNzZcXHVhYTdhXFx1YWE3ZS1cXHVhYWFmXFx1YWFiMVxcdWFhYjVcXHVhYWI2XFx1YWFiOS1cXHVhYWJkXFx1YWFjMFxcdWFhYzJcXHVhYWRiLVxcdWFhZGRcXHVhYWUwLVxcdWFhZWFcXHVhYWYyLVxcdWFhZjRcXHVhYjAxLVxcdWFiMDZcXHVhYjA5LVxcdWFiMGVcXHVhYjExLVxcdWFiMTZcXHVhYjIwLVxcdWFiMjZcXHVhYjI4LVxcdWFiMmVcXHVhYjMwLVxcdWFiNWFcXHVhYjVjLVxcdWFiNjlcXHVhYjcwLVxcdWFiZTJcXHVhYzAwLVxcdWQ3YTNcXHVkN2IwLVxcdWQ3YzZcXHVkN2NiLVxcdWQ3ZmJcXHVmOTAwLVxcdWZhNmRcXHVmYTcwLVxcdWZhZDlcXHVmYjAwLVxcdWZiMDZcXHVmYjEzLVxcdWZiMTdcXHVmYjFkXFx1ZmIxZi1cXHVmYjI4XFx1ZmIyYS1cXHVmYjM2XFx1ZmIzOC1cXHVmYjNjXFx1ZmIzZVxcdWZiNDBcXHVmYjQxXFx1ZmI0M1xcdWZiNDRcXHVmYjQ2LVxcdWZiYjFcXHVmYmQzLVxcdWZkM2RcXHVmZDUwLVxcdWZkOGZcXHVmZDkyLVxcdWZkYzdcXHVmZGYwLVxcdWZkZmJcXHVmZTcwLVxcdWZlNzRcXHVmZTc2LVxcdWZlZmNcXHVmZjIxLVxcdWZmM2FcXHVmZjQxLVxcdWZmNWFcXHVmZjY2LVxcdWZmYmVcXHVmZmMyLVxcdWZmYzdcXHVmZmNhLVxcdWZmY2ZcXHVmZmQyLVxcdWZmZDdcXHVmZmRhLVxcdWZmZGNcIjtcblxuICAvLyBUaGVzZSBhcmUgYSBydW4tbGVuZ3RoIGFuZCBvZmZzZXQgZW5jb2RlZCByZXByZXNlbnRhdGlvbiBvZiB0aGVcbiAgLy8gPjB4ZmZmZiBjb2RlIHBvaW50cyB0aGF0IGFyZSBhIHZhbGlkIHBhcnQgb2YgaWRlbnRpZmllcnMuIFRoZVxuICAvLyBvZmZzZXQgc3RhcnRzIGF0IDB4MTAwMDAsIGFuZCBlYWNoIHBhaXIgb2YgbnVtYmVycyByZXByZXNlbnRzIGFuXG4gIC8vIG9mZnNldCB0byB0aGUgbmV4dCByYW5nZSwgYW5kIHRoZW4gYSBzaXplIG9mIHRoZSByYW5nZS5cblxuICAvLyBSZXNlcnZlZCB3b3JkIGxpc3RzIGZvciB2YXJpb3VzIGRpYWxlY3RzIG9mIHRoZSBsYW5ndWFnZVxuXG4gIHZhciByZXNlcnZlZFdvcmRzID0ge1xuICAgIDM6IFwiYWJzdHJhY3QgYm9vbGVhbiBieXRlIGNoYXIgY2xhc3MgZG91YmxlIGVudW0gZXhwb3J0IGV4dGVuZHMgZmluYWwgZmxvYXQgZ290byBpbXBsZW1lbnRzIGltcG9ydCBpbnQgaW50ZXJmYWNlIGxvbmcgbmF0aXZlIHBhY2thZ2UgcHJpdmF0ZSBwcm90ZWN0ZWQgcHVibGljIHNob3J0IHN0YXRpYyBzdXBlciBzeW5jaHJvbml6ZWQgdGhyb3dzIHRyYW5zaWVudCB2b2xhdGlsZVwiLFxuICAgIDU6IFwiY2xhc3MgZW51bSBleHRlbmRzIHN1cGVyIGNvbnN0IGV4cG9ydCBpbXBvcnRcIixcbiAgICA2OiBcImVudW1cIixcbiAgICBzdHJpY3Q6IFwiaW1wbGVtZW50cyBpbnRlcmZhY2UgbGV0IHBhY2thZ2UgcHJpdmF0ZSBwcm90ZWN0ZWQgcHVibGljIHN0YXRpYyB5aWVsZFwiLFxuICAgIHN0cmljdEJpbmQ6IFwiZXZhbCBhcmd1bWVudHNcIlxuICB9O1xuXG4gIC8vIEFuZCB0aGUga2V5d29yZHNcblxuICB2YXIgZWNtYTVBbmRMZXNzS2V5d29yZHMgPSBcImJyZWFrIGNhc2UgY2F0Y2ggY29udGludWUgZGVidWdnZXIgZGVmYXVsdCBkbyBlbHNlIGZpbmFsbHkgZm9yIGZ1bmN0aW9uIGlmIHJldHVybiBzd2l0Y2ggdGhyb3cgdHJ5IHZhciB3aGlsZSB3aXRoIG51bGwgdHJ1ZSBmYWxzZSBpbnN0YW5jZW9mIHR5cGVvZiB2b2lkIGRlbGV0ZSBuZXcgaW4gdGhpc1wiO1xuXG4gIHZhciBrZXl3b3JkcyQxID0ge1xuICAgIDU6IGVjbWE1QW5kTGVzc0tleXdvcmRzLFxuICAgIFwiNW1vZHVsZVwiOiBlY21hNUFuZExlc3NLZXl3b3JkcyArIFwiIGV4cG9ydCBpbXBvcnRcIixcbiAgICA2OiBlY21hNUFuZExlc3NLZXl3b3JkcyArIFwiIGNvbnN0IGNsYXNzIGV4dGVuZHMgZXhwb3J0IGltcG9ydCBzdXBlclwiXG4gIH07XG5cbiAgdmFyIGtleXdvcmRSZWxhdGlvbmFsT3BlcmF0b3IgPSAvXmluKHN0YW5jZW9mKT8kLztcblxuICAvLyAjIyBDaGFyYWN0ZXIgY2F0ZWdvcmllc1xuXG4gIHZhciBub25BU0NJSWlkZW50aWZpZXJTdGFydCA9IG5ldyBSZWdFeHAoXCJbXCIgKyBub25BU0NJSWlkZW50aWZpZXJTdGFydENoYXJzICsgXCJdXCIpO1xuICB2YXIgbm9uQVNDSUlpZGVudGlmaWVyID0gbmV3IFJlZ0V4cChcIltcIiArIG5vbkFTQ0lJaWRlbnRpZmllclN0YXJ0Q2hhcnMgKyBub25BU0NJSWlkZW50aWZpZXJDaGFycyArIFwiXVwiKTtcblxuICAvLyBUaGlzIGhhcyBhIGNvbXBsZXhpdHkgbGluZWFyIHRvIHRoZSB2YWx1ZSBvZiB0aGUgY29kZS4gVGhlXG4gIC8vIGFzc3VtcHRpb24gaXMgdGhhdCBsb29raW5nIHVwIGFzdHJhbCBpZGVudGlmaWVyIGNoYXJhY3RlcnMgaXNcbiAgLy8gcmFyZS5cbiAgZnVuY3Rpb24gaXNJbkFzdHJhbFNldChjb2RlLCBzZXQpIHtcbiAgICB2YXIgcG9zID0gMHgxMDAwMDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNldC5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgcG9zICs9IHNldFtpXTtcbiAgICAgIGlmIChwb3MgPiBjb2RlKSB7IHJldHVybiBmYWxzZSB9XG4gICAgICBwb3MgKz0gc2V0W2kgKyAxXTtcbiAgICAgIGlmIChwb3MgPj0gY29kZSkgeyByZXR1cm4gdHJ1ZSB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgLy8gVGVzdCB3aGV0aGVyIGEgZ2l2ZW4gY2hhcmFjdGVyIGNvZGUgc3RhcnRzIGFuIGlkZW50aWZpZXIuXG5cbiAgZnVuY3Rpb24gaXNJZGVudGlmaWVyU3RhcnQoY29kZSwgYXN0cmFsKSB7XG4gICAgaWYgKGNvZGUgPCA2NSkgeyByZXR1cm4gY29kZSA9PT0gMzYgfVxuICAgIGlmIChjb2RlIDwgOTEpIHsgcmV0dXJuIHRydWUgfVxuICAgIGlmIChjb2RlIDwgOTcpIHsgcmV0dXJuIGNvZGUgPT09IDk1IH1cbiAgICBpZiAoY29kZSA8IDEyMykgeyByZXR1cm4gdHJ1ZSB9XG4gICAgaWYgKGNvZGUgPD0gMHhmZmZmKSB7IHJldHVybiBjb2RlID49IDB4YWEgJiYgbm9uQVNDSUlpZGVudGlmaWVyU3RhcnQudGVzdChTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpKSB9XG4gICAgaWYgKGFzdHJhbCA9PT0gZmFsc2UpIHsgcmV0dXJuIGZhbHNlIH1cbiAgICByZXR1cm4gaXNJbkFzdHJhbFNldChjb2RlLCBhc3RyYWxJZGVudGlmaWVyU3RhcnRDb2RlcylcbiAgfVxuXG4gIC8vIFRlc3Qgd2hldGhlciBhIGdpdmVuIGNoYXJhY3RlciBpcyBwYXJ0IG9mIGFuIGlkZW50aWZpZXIuXG5cbiAgZnVuY3Rpb24gaXNJZGVudGlmaWVyQ2hhcihjb2RlLCBhc3RyYWwpIHtcbiAgICBpZiAoY29kZSA8IDQ4KSB7IHJldHVybiBjb2RlID09PSAzNiB9XG4gICAgaWYgKGNvZGUgPCA1OCkgeyByZXR1cm4gdHJ1ZSB9XG4gICAgaWYgKGNvZGUgPCA2NSkgeyByZXR1cm4gZmFsc2UgfVxuICAgIGlmIChjb2RlIDwgOTEpIHsgcmV0dXJuIHRydWUgfVxuICAgIGlmIChjb2RlIDwgOTcpIHsgcmV0dXJuIGNvZGUgPT09IDk1IH1cbiAgICBpZiAoY29kZSA8IDEyMykgeyByZXR1cm4gdHJ1ZSB9XG4gICAgaWYgKGNvZGUgPD0gMHhmZmZmKSB7IHJldHVybiBjb2RlID49IDB4YWEgJiYgbm9uQVNDSUlpZGVudGlmaWVyLnRlc3QoU3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKSkgfVxuICAgIGlmIChhc3RyYWwgPT09IGZhbHNlKSB7IHJldHVybiBmYWxzZSB9XG4gICAgcmV0dXJuIGlzSW5Bc3RyYWxTZXQoY29kZSwgYXN0cmFsSWRlbnRpZmllclN0YXJ0Q29kZXMpIHx8IGlzSW5Bc3RyYWxTZXQoY29kZSwgYXN0cmFsSWRlbnRpZmllckNvZGVzKVxuICB9XG5cbiAgLy8gIyMgVG9rZW4gdHlwZXNcblxuICAvLyBUaGUgYXNzaWdubWVudCBvZiBmaW5lLWdyYWluZWQsIGluZm9ybWF0aW9uLWNhcnJ5aW5nIHR5cGUgb2JqZWN0c1xuICAvLyBhbGxvd3MgdGhlIHRva2VuaXplciB0byBzdG9yZSB0aGUgaW5mb3JtYXRpb24gaXQgaGFzIGFib3V0IGFcbiAgLy8gdG9rZW4gaW4gYSB3YXkgdGhhdCBpcyB2ZXJ5IGNoZWFwIGZvciB0aGUgcGFyc2VyIHRvIGxvb2sgdXAuXG5cbiAgLy8gQWxsIHRva2VuIHR5cGUgdmFyaWFibGVzIHN0YXJ0IHdpdGggYW4gdW5kZXJzY29yZSwgdG8gbWFrZSB0aGVtXG4gIC8vIGVhc3kgdG8gcmVjb2duaXplLlxuXG4gIC8vIFRoZSBgYmVmb3JlRXhwcmAgcHJvcGVydHkgaXMgdXNlZCB0byBkaXNhbWJpZ3VhdGUgYmV0d2VlbiByZWd1bGFyXG4gIC8vIGV4cHJlc3Npb25zIGFuZCBkaXZpc2lvbnMuIEl0IGlzIHNldCBvbiBhbGwgdG9rZW4gdHlwZXMgdGhhdCBjYW5cbiAgLy8gYmUgZm9sbG93ZWQgYnkgYW4gZXhwcmVzc2lvbiAodGh1cywgYSBzbGFzaCBhZnRlciB0aGVtIHdvdWxkIGJlIGFcbiAgLy8gcmVndWxhciBleHByZXNzaW9uKS5cbiAgLy9cbiAgLy8gVGhlIGBzdGFydHNFeHByYCBwcm9wZXJ0eSBpcyB1c2VkIHRvIGNoZWNrIGlmIHRoZSB0b2tlbiBlbmRzIGFcbiAgLy8gYHlpZWxkYCBleHByZXNzaW9uLiBJdCBpcyBzZXQgb24gYWxsIHRva2VuIHR5cGVzIHRoYXQgZWl0aGVyIGNhblxuICAvLyBkaXJlY3RseSBzdGFydCBhbiBleHByZXNzaW9uIChsaWtlIGEgcXVvdGF0aW9uIG1hcmspIG9yIGNhblxuICAvLyBjb250aW51ZSBhbiBleHByZXNzaW9uIChsaWtlIHRoZSBib2R5IG9mIGEgc3RyaW5nKS5cbiAgLy9cbiAgLy8gYGlzTG9vcGAgbWFya3MgYSBrZXl3b3JkIGFzIHN0YXJ0aW5nIGEgbG9vcCwgd2hpY2ggaXMgaW1wb3J0YW50XG4gIC8vIHRvIGtub3cgd2hlbiBwYXJzaW5nIGEgbGFiZWwsIGluIG9yZGVyIHRvIGFsbG93IG9yIGRpc2FsbG93XG4gIC8vIGNvbnRpbnVlIGp1bXBzIHRvIHRoYXQgbGFiZWwuXG5cbiAgdmFyIFRva2VuVHlwZSA9IGZ1bmN0aW9uIFRva2VuVHlwZShsYWJlbCwgY29uZikge1xuICAgIGlmICggY29uZiA9PT0gdm9pZCAwICkgY29uZiA9IHt9O1xuXG4gICAgdGhpcy5sYWJlbCA9IGxhYmVsO1xuICAgIHRoaXMua2V5d29yZCA9IGNvbmYua2V5d29yZDtcbiAgICB0aGlzLmJlZm9yZUV4cHIgPSAhIWNvbmYuYmVmb3JlRXhwcjtcbiAgICB0aGlzLnN0YXJ0c0V4cHIgPSAhIWNvbmYuc3RhcnRzRXhwcjtcbiAgICB0aGlzLmlzTG9vcCA9ICEhY29uZi5pc0xvb3A7XG4gICAgdGhpcy5pc0Fzc2lnbiA9ICEhY29uZi5pc0Fzc2lnbjtcbiAgICB0aGlzLnByZWZpeCA9ICEhY29uZi5wcmVmaXg7XG4gICAgdGhpcy5wb3N0Zml4ID0gISFjb25mLnBvc3RmaXg7XG4gICAgdGhpcy5iaW5vcCA9IGNvbmYuYmlub3AgfHwgbnVsbDtcbiAgICB0aGlzLnVwZGF0ZUNvbnRleHQgPSBudWxsO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGJpbm9wKG5hbWUsIHByZWMpIHtcbiAgICByZXR1cm4gbmV3IFRva2VuVHlwZShuYW1lLCB7YmVmb3JlRXhwcjogdHJ1ZSwgYmlub3A6IHByZWN9KVxuICB9XG4gIHZhciBiZWZvcmVFeHByID0ge2JlZm9yZUV4cHI6IHRydWV9LCBzdGFydHNFeHByID0ge3N0YXJ0c0V4cHI6IHRydWV9O1xuXG4gIC8vIE1hcCBrZXl3b3JkIG5hbWVzIHRvIHRva2VuIHR5cGVzLlxuXG4gIHZhciBrZXl3b3JkcyA9IHt9O1xuXG4gIC8vIFN1Y2NpbmN0IGRlZmluaXRpb25zIG9mIGtleXdvcmQgdG9rZW4gdHlwZXNcbiAgZnVuY3Rpb24ga3cobmFtZSwgb3B0aW9ucykge1xuICAgIGlmICggb3B0aW9ucyA9PT0gdm9pZCAwICkgb3B0aW9ucyA9IHt9O1xuXG4gICAgb3B0aW9ucy5rZXl3b3JkID0gbmFtZTtcbiAgICByZXR1cm4ga2V5d29yZHNbbmFtZV0gPSBuZXcgVG9rZW5UeXBlKG5hbWUsIG9wdGlvbnMpXG4gIH1cblxuICB2YXIgdHlwZXMkMSA9IHtcbiAgICBudW06IG5ldyBUb2tlblR5cGUoXCJudW1cIiwgc3RhcnRzRXhwciksXG4gICAgcmVnZXhwOiBuZXcgVG9rZW5UeXBlKFwicmVnZXhwXCIsIHN0YXJ0c0V4cHIpLFxuICAgIHN0cmluZzogbmV3IFRva2VuVHlwZShcInN0cmluZ1wiLCBzdGFydHNFeHByKSxcbiAgICBuYW1lOiBuZXcgVG9rZW5UeXBlKFwibmFtZVwiLCBzdGFydHNFeHByKSxcbiAgICBwcml2YXRlSWQ6IG5ldyBUb2tlblR5cGUoXCJwcml2YXRlSWRcIiwgc3RhcnRzRXhwciksXG4gICAgZW9mOiBuZXcgVG9rZW5UeXBlKFwiZW9mXCIpLFxuXG4gICAgLy8gUHVuY3R1YXRpb24gdG9rZW4gdHlwZXMuXG4gICAgYnJhY2tldEw6IG5ldyBUb2tlblR5cGUoXCJbXCIsIHtiZWZvcmVFeHByOiB0cnVlLCBzdGFydHNFeHByOiB0cnVlfSksXG4gICAgYnJhY2tldFI6IG5ldyBUb2tlblR5cGUoXCJdXCIpLFxuICAgIGJyYWNlTDogbmV3IFRva2VuVHlwZShcIntcIiwge2JlZm9yZUV4cHI6IHRydWUsIHN0YXJ0c0V4cHI6IHRydWV9KSxcbiAgICBicmFjZVI6IG5ldyBUb2tlblR5cGUoXCJ9XCIpLFxuICAgIHBhcmVuTDogbmV3IFRva2VuVHlwZShcIihcIiwge2JlZm9yZUV4cHI6IHRydWUsIHN0YXJ0c0V4cHI6IHRydWV9KSxcbiAgICBwYXJlblI6IG5ldyBUb2tlblR5cGUoXCIpXCIpLFxuICAgIGNvbW1hOiBuZXcgVG9rZW5UeXBlKFwiLFwiLCBiZWZvcmVFeHByKSxcbiAgICBzZW1pOiBuZXcgVG9rZW5UeXBlKFwiO1wiLCBiZWZvcmVFeHByKSxcbiAgICBjb2xvbjogbmV3IFRva2VuVHlwZShcIjpcIiwgYmVmb3JlRXhwciksXG4gICAgZG90OiBuZXcgVG9rZW5UeXBlKFwiLlwiKSxcbiAgICBxdWVzdGlvbjogbmV3IFRva2VuVHlwZShcIj9cIiwgYmVmb3JlRXhwciksXG4gICAgcXVlc3Rpb25Eb3Q6IG5ldyBUb2tlblR5cGUoXCI/LlwiKSxcbiAgICBhcnJvdzogbmV3IFRva2VuVHlwZShcIj0+XCIsIGJlZm9yZUV4cHIpLFxuICAgIHRlbXBsYXRlOiBuZXcgVG9rZW5UeXBlKFwidGVtcGxhdGVcIiksXG4gICAgaW52YWxpZFRlbXBsYXRlOiBuZXcgVG9rZW5UeXBlKFwiaW52YWxpZFRlbXBsYXRlXCIpLFxuICAgIGVsbGlwc2lzOiBuZXcgVG9rZW5UeXBlKFwiLi4uXCIsIGJlZm9yZUV4cHIpLFxuICAgIGJhY2tRdW90ZTogbmV3IFRva2VuVHlwZShcImBcIiwgc3RhcnRzRXhwciksXG4gICAgZG9sbGFyQnJhY2VMOiBuZXcgVG9rZW5UeXBlKFwiJHtcIiwge2JlZm9yZUV4cHI6IHRydWUsIHN0YXJ0c0V4cHI6IHRydWV9KSxcblxuICAgIC8vIE9wZXJhdG9ycy4gVGhlc2UgY2Fycnkgc2V2ZXJhbCBraW5kcyBvZiBwcm9wZXJ0aWVzIHRvIGhlbHAgdGhlXG4gICAgLy8gcGFyc2VyIHVzZSB0aGVtIHByb3Blcmx5ICh0aGUgcHJlc2VuY2Ugb2YgdGhlc2UgcHJvcGVydGllcyBpc1xuICAgIC8vIHdoYXQgY2F0ZWdvcml6ZXMgdGhlbSBhcyBvcGVyYXRvcnMpLlxuICAgIC8vXG4gICAgLy8gYGJpbm9wYCwgd2hlbiBwcmVzZW50LCBzcGVjaWZpZXMgdGhhdCB0aGlzIG9wZXJhdG9yIGlzIGEgYmluYXJ5XG4gICAgLy8gb3BlcmF0b3IsIGFuZCB3aWxsIHJlZmVyIHRvIGl0cyBwcmVjZWRlbmNlLlxuICAgIC8vXG4gICAgLy8gYHByZWZpeGAgYW5kIGBwb3N0Zml4YCBtYXJrIHRoZSBvcGVyYXRvciBhcyBhIHByZWZpeCBvciBwb3N0Zml4XG4gICAgLy8gdW5hcnkgb3BlcmF0b3IuXG4gICAgLy9cbiAgICAvLyBgaXNBc3NpZ25gIG1hcmtzIGFsbCBvZiBgPWAsIGArPWAsIGAtPWAgZXRjZXRlcmEsIHdoaWNoIGFjdCBhc1xuICAgIC8vIGJpbmFyeSBvcGVyYXRvcnMgd2l0aCBhIHZlcnkgbG93IHByZWNlZGVuY2UsIHRoYXQgc2hvdWxkIHJlc3VsdFxuICAgIC8vIGluIEFzc2lnbm1lbnRFeHByZXNzaW9uIG5vZGVzLlxuXG4gICAgZXE6IG5ldyBUb2tlblR5cGUoXCI9XCIsIHtiZWZvcmVFeHByOiB0cnVlLCBpc0Fzc2lnbjogdHJ1ZX0pLFxuICAgIGFzc2lnbjogbmV3IFRva2VuVHlwZShcIl89XCIsIHtiZWZvcmVFeHByOiB0cnVlLCBpc0Fzc2lnbjogdHJ1ZX0pLFxuICAgIGluY0RlYzogbmV3IFRva2VuVHlwZShcIisrLy0tXCIsIHtwcmVmaXg6IHRydWUsIHBvc3RmaXg6IHRydWUsIHN0YXJ0c0V4cHI6IHRydWV9KSxcbiAgICBwcmVmaXg6IG5ldyBUb2tlblR5cGUoXCIhL35cIiwge2JlZm9yZUV4cHI6IHRydWUsIHByZWZpeDogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pLFxuICAgIGxvZ2ljYWxPUjogYmlub3AoXCJ8fFwiLCAxKSxcbiAgICBsb2dpY2FsQU5EOiBiaW5vcChcIiYmXCIsIDIpLFxuICAgIGJpdHdpc2VPUjogYmlub3AoXCJ8XCIsIDMpLFxuICAgIGJpdHdpc2VYT1I6IGJpbm9wKFwiXlwiLCA0KSxcbiAgICBiaXR3aXNlQU5EOiBiaW5vcChcIiZcIiwgNSksXG4gICAgZXF1YWxpdHk6IGJpbm9wKFwiPT0vIT0vPT09LyE9PVwiLCA2KSxcbiAgICByZWxhdGlvbmFsOiBiaW5vcChcIjwvPi88PS8+PVwiLCA3KSxcbiAgICBiaXRTaGlmdDogYmlub3AoXCI8PC8+Pi8+Pj5cIiwgOCksXG4gICAgcGx1c01pbjogbmV3IFRva2VuVHlwZShcIisvLVwiLCB7YmVmb3JlRXhwcjogdHJ1ZSwgYmlub3A6IDksIHByZWZpeDogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pLFxuICAgIG1vZHVsbzogYmlub3AoXCIlXCIsIDEwKSxcbiAgICBzdGFyOiBiaW5vcChcIipcIiwgMTApLFxuICAgIHNsYXNoOiBiaW5vcChcIi9cIiwgMTApLFxuICAgIHN0YXJzdGFyOiBuZXcgVG9rZW5UeXBlKFwiKipcIiwge2JlZm9yZUV4cHI6IHRydWV9KSxcbiAgICBjb2FsZXNjZTogYmlub3AoXCI/P1wiLCAxKSxcblxuICAgIC8vIEtleXdvcmQgdG9rZW4gdHlwZXMuXG4gICAgX2JyZWFrOiBrdyhcImJyZWFrXCIpLFxuICAgIF9jYXNlOiBrdyhcImNhc2VcIiwgYmVmb3JlRXhwciksXG4gICAgX2NhdGNoOiBrdyhcImNhdGNoXCIpLFxuICAgIF9jb250aW51ZToga3coXCJjb250aW51ZVwiKSxcbiAgICBfZGVidWdnZXI6IGt3KFwiZGVidWdnZXJcIiksXG4gICAgX2RlZmF1bHQ6IGt3KFwiZGVmYXVsdFwiLCBiZWZvcmVFeHByKSxcbiAgICBfZG86IGt3KFwiZG9cIiwge2lzTG9vcDogdHJ1ZSwgYmVmb3JlRXhwcjogdHJ1ZX0pLFxuICAgIF9lbHNlOiBrdyhcImVsc2VcIiwgYmVmb3JlRXhwciksXG4gICAgX2ZpbmFsbHk6IGt3KFwiZmluYWxseVwiKSxcbiAgICBfZm9yOiBrdyhcImZvclwiLCB7aXNMb29wOiB0cnVlfSksXG4gICAgX2Z1bmN0aW9uOiBrdyhcImZ1bmN0aW9uXCIsIHN0YXJ0c0V4cHIpLFxuICAgIF9pZjoga3coXCJpZlwiKSxcbiAgICBfcmV0dXJuOiBrdyhcInJldHVyblwiLCBiZWZvcmVFeHByKSxcbiAgICBfc3dpdGNoOiBrdyhcInN3aXRjaFwiKSxcbiAgICBfdGhyb3c6IGt3KFwidGhyb3dcIiwgYmVmb3JlRXhwciksXG4gICAgX3RyeToga3coXCJ0cnlcIiksXG4gICAgX3Zhcjoga3coXCJ2YXJcIiksXG4gICAgX2NvbnN0OiBrdyhcImNvbnN0XCIpLFxuICAgIF93aGlsZToga3coXCJ3aGlsZVwiLCB7aXNMb29wOiB0cnVlfSksXG4gICAgX3dpdGg6IGt3KFwid2l0aFwiKSxcbiAgICBfbmV3OiBrdyhcIm5ld1wiLCB7YmVmb3JlRXhwcjogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pLFxuICAgIF90aGlzOiBrdyhcInRoaXNcIiwgc3RhcnRzRXhwciksXG4gICAgX3N1cGVyOiBrdyhcInN1cGVyXCIsIHN0YXJ0c0V4cHIpLFxuICAgIF9jbGFzczoga3coXCJjbGFzc1wiLCBzdGFydHNFeHByKSxcbiAgICBfZXh0ZW5kczoga3coXCJleHRlbmRzXCIsIGJlZm9yZUV4cHIpLFxuICAgIF9leHBvcnQ6IGt3KFwiZXhwb3J0XCIpLFxuICAgIF9pbXBvcnQ6IGt3KFwiaW1wb3J0XCIsIHN0YXJ0c0V4cHIpLFxuICAgIF9udWxsOiBrdyhcIm51bGxcIiwgc3RhcnRzRXhwciksXG4gICAgX3RydWU6IGt3KFwidHJ1ZVwiLCBzdGFydHNFeHByKSxcbiAgICBfZmFsc2U6IGt3KFwiZmFsc2VcIiwgc3RhcnRzRXhwciksXG4gICAgX2luOiBrdyhcImluXCIsIHtiZWZvcmVFeHByOiB0cnVlLCBiaW5vcDogN30pLFxuICAgIF9pbnN0YW5jZW9mOiBrdyhcImluc3RhbmNlb2ZcIiwge2JlZm9yZUV4cHI6IHRydWUsIGJpbm9wOiA3fSksXG4gICAgX3R5cGVvZjoga3coXCJ0eXBlb2ZcIiwge2JlZm9yZUV4cHI6IHRydWUsIHByZWZpeDogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pLFxuICAgIF92b2lkOiBrdyhcInZvaWRcIiwge2JlZm9yZUV4cHI6IHRydWUsIHByZWZpeDogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pLFxuICAgIF9kZWxldGU6IGt3KFwiZGVsZXRlXCIsIHtiZWZvcmVFeHByOiB0cnVlLCBwcmVmaXg6IHRydWUsIHN0YXJ0c0V4cHI6IHRydWV9KVxuICB9O1xuXG4gIC8vIE1hdGNoZXMgYSB3aG9sZSBsaW5lIGJyZWFrICh3aGVyZSBDUkxGIGlzIGNvbnNpZGVyZWQgYSBzaW5nbGVcbiAgLy8gbGluZSBicmVhaykuIFVzZWQgdG8gY291bnQgbGluZXMuXG5cbiAgdmFyIGxpbmVCcmVhayA9IC9cXHJcXG4/fFxcbnxcXHUyMDI4fFxcdTIwMjkvO1xuICB2YXIgbGluZUJyZWFrRyA9IG5ldyBSZWdFeHAobGluZUJyZWFrLnNvdXJjZSwgXCJnXCIpO1xuXG4gIGZ1bmN0aW9uIGlzTmV3TGluZShjb2RlKSB7XG4gICAgcmV0dXJuIGNvZGUgPT09IDEwIHx8IGNvZGUgPT09IDEzIHx8IGNvZGUgPT09IDB4MjAyOCB8fCBjb2RlID09PSAweDIwMjlcbiAgfVxuXG4gIGZ1bmN0aW9uIG5leHRMaW5lQnJlYWsoY29kZSwgZnJvbSwgZW5kKSB7XG4gICAgaWYgKCBlbmQgPT09IHZvaWQgMCApIGVuZCA9IGNvZGUubGVuZ3RoO1xuXG4gICAgZm9yICh2YXIgaSA9IGZyb207IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdmFyIG5leHQgPSBjb2RlLmNoYXJDb2RlQXQoaSk7XG4gICAgICBpZiAoaXNOZXdMaW5lKG5leHQpKVxuICAgICAgICB7IHJldHVybiBpIDwgZW5kIC0gMSAmJiBuZXh0ID09PSAxMyAmJiBjb2RlLmNoYXJDb2RlQXQoaSArIDEpID09PSAxMCA/IGkgKyAyIDogaSArIDEgfVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIHZhciBub25BU0NJSXdoaXRlc3BhY2UgPSAvW1xcdTE2ODBcXHUyMDAwLVxcdTIwMGFcXHUyMDJmXFx1MjA1ZlxcdTMwMDBcXHVmZWZmXS87XG5cbiAgdmFyIHNraXBXaGl0ZVNwYWNlID0gLyg/Olxcc3xcXC9cXC8uKnxcXC9cXCpbXl0qP1xcKlxcLykqL2c7XG5cbiAgdmFyIHJlZiA9IE9iamVjdC5wcm90b3R5cGU7XG4gIHZhciBoYXNPd25Qcm9wZXJ0eSA9IHJlZi5oYXNPd25Qcm9wZXJ0eTtcbiAgdmFyIHRvU3RyaW5nID0gcmVmLnRvU3RyaW5nO1xuXG4gIHZhciBoYXNPd24gPSBPYmplY3QuaGFzT3duIHx8IChmdW5jdGlvbiAob2JqLCBwcm9wTmFtZSkgeyByZXR1cm4gKFxuICAgIGhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wTmFtZSlcbiAgKTsgfSk7XG5cbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IChmdW5jdGlvbiAob2JqKSB7IHJldHVybiAoXG4gICAgdG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCJcbiAgKTsgfSk7XG5cbiAgZnVuY3Rpb24gd29yZHNSZWdleHAod29yZHMpIHtcbiAgICByZXR1cm4gbmV3IFJlZ0V4cChcIl4oPzpcIiArIHdvcmRzLnJlcGxhY2UoLyAvZywgXCJ8XCIpICsgXCIpJFwiKVxuICB9XG5cbiAgZnVuY3Rpb24gY29kZVBvaW50VG9TdHJpbmcoY29kZSkge1xuICAgIC8vIFVURi0xNiBEZWNvZGluZ1xuICAgIGlmIChjb2RlIDw9IDB4RkZGRikgeyByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKSB9XG4gICAgY29kZSAtPSAweDEwMDAwO1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKChjb2RlID4+IDEwKSArIDB4RDgwMCwgKGNvZGUgJiAxMDIzKSArIDB4REMwMClcbiAgfVxuXG4gIHZhciBsb25lU3Vycm9nYXRlID0gLyg/OltcXHVEODAwLVxcdURCRkZdKD8hW1xcdURDMDAtXFx1REZGRl0pfCg/OlteXFx1RDgwMC1cXHVEQkZGXXxeKVtcXHVEQzAwLVxcdURGRkZdKS87XG5cbiAgLy8gVGhlc2UgYXJlIHVzZWQgd2hlbiBgb3B0aW9ucy5sb2NhdGlvbnNgIGlzIG9uLCBmb3IgdGhlXG4gIC8vIGBzdGFydExvY2AgYW5kIGBlbmRMb2NgIHByb3BlcnRpZXMuXG5cbiAgdmFyIFBvc2l0aW9uID0gZnVuY3Rpb24gUG9zaXRpb24obGluZSwgY29sKSB7XG4gICAgdGhpcy5saW5lID0gbGluZTtcbiAgICB0aGlzLmNvbHVtbiA9IGNvbDtcbiAgfTtcblxuICBQb3NpdGlvbi5wcm90b3R5cGUub2Zmc2V0ID0gZnVuY3Rpb24gb2Zmc2V0IChuKSB7XG4gICAgcmV0dXJuIG5ldyBQb3NpdGlvbih0aGlzLmxpbmUsIHRoaXMuY29sdW1uICsgbilcbiAgfTtcblxuICB2YXIgU291cmNlTG9jYXRpb24gPSBmdW5jdGlvbiBTb3VyY2VMb2NhdGlvbihwLCBzdGFydCwgZW5kKSB7XG4gICAgdGhpcy5zdGFydCA9IHN0YXJ0O1xuICAgIHRoaXMuZW5kID0gZW5kO1xuICAgIGlmIChwLnNvdXJjZUZpbGUgIT09IG51bGwpIHsgdGhpcy5zb3VyY2UgPSBwLnNvdXJjZUZpbGU7IH1cbiAgfTtcblxuICAvLyBUaGUgYGdldExpbmVJbmZvYCBmdW5jdGlvbiBpcyBtb3N0bHkgdXNlZnVsIHdoZW4gdGhlXG4gIC8vIGBsb2NhdGlvbnNgIG9wdGlvbiBpcyBvZmYgKGZvciBwZXJmb3JtYW5jZSByZWFzb25zKSBhbmQgeW91XG4gIC8vIHdhbnQgdG8gZmluZCB0aGUgbGluZS9jb2x1bW4gcG9zaXRpb24gZm9yIGEgZ2l2ZW4gY2hhcmFjdGVyXG4gIC8vIG9mZnNldC4gYGlucHV0YCBzaG91bGQgYmUgdGhlIGNvZGUgc3RyaW5nIHRoYXQgdGhlIG9mZnNldCByZWZlcnNcbiAgLy8gaW50by5cblxuICBmdW5jdGlvbiBnZXRMaW5lSW5mbyhpbnB1dCwgb2Zmc2V0KSB7XG4gICAgZm9yICh2YXIgbGluZSA9IDEsIGN1ciA9IDA7Oykge1xuICAgICAgdmFyIG5leHRCcmVhayA9IG5leHRMaW5lQnJlYWsoaW5wdXQsIGN1ciwgb2Zmc2V0KTtcbiAgICAgIGlmIChuZXh0QnJlYWsgPCAwKSB7IHJldHVybiBuZXcgUG9zaXRpb24obGluZSwgb2Zmc2V0IC0gY3VyKSB9XG4gICAgICArK2xpbmU7XG4gICAgICBjdXIgPSBuZXh0QnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gQSBzZWNvbmQgYXJndW1lbnQgbXVzdCBiZSBnaXZlbiB0byBjb25maWd1cmUgdGhlIHBhcnNlciBwcm9jZXNzLlxuICAvLyBUaGVzZSBvcHRpb25zIGFyZSByZWNvZ25pemVkIChvbmx5IGBlY21hVmVyc2lvbmAgaXMgcmVxdWlyZWQpOlxuXG4gIHZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAvLyBgZWNtYVZlcnNpb25gIGluZGljYXRlcyB0aGUgRUNNQVNjcmlwdCB2ZXJzaW9uIHRvIHBhcnNlLiBNdXN0IGJlXG4gICAgLy8gZWl0aGVyIDMsIDUsIDYgKG9yIDIwMTUpLCA3ICgyMDE2KSwgOCAoMjAxNyksIDkgKDIwMTgpLCAxMFxuICAgIC8vICgyMDE5KSwgMTEgKDIwMjApLCAxMiAoMjAyMSksIDEzICgyMDIyKSwgMTQgKDIwMjMpLCBvciBgXCJsYXRlc3RcImBcbiAgICAvLyAodGhlIGxhdGVzdCB2ZXJzaW9uIHRoZSBsaWJyYXJ5IHN1cHBvcnRzKS4gVGhpcyBpbmZsdWVuY2VzXG4gICAgLy8gc3VwcG9ydCBmb3Igc3RyaWN0IG1vZGUsIHRoZSBzZXQgb2YgcmVzZXJ2ZWQgd29yZHMsIGFuZCBzdXBwb3J0XG4gICAgLy8gZm9yIG5ldyBzeW50YXggZmVhdHVyZXMuXG4gICAgZWNtYVZlcnNpb246IG51bGwsXG4gICAgLy8gYHNvdXJjZVR5cGVgIGluZGljYXRlcyB0aGUgbW9kZSB0aGUgY29kZSBzaG91bGQgYmUgcGFyc2VkIGluLlxuICAgIC8vIENhbiBiZSBlaXRoZXIgYFwic2NyaXB0XCJgIG9yIGBcIm1vZHVsZVwiYC4gVGhpcyBpbmZsdWVuY2VzIGdsb2JhbFxuICAgIC8vIHN0cmljdCBtb2RlIGFuZCBwYXJzaW5nIG9mIGBpbXBvcnRgIGFuZCBgZXhwb3J0YCBkZWNsYXJhdGlvbnMuXG4gICAgc291cmNlVHlwZTogXCJzY3JpcHRcIixcbiAgICAvLyBgb25JbnNlcnRlZFNlbWljb2xvbmAgY2FuIGJlIGEgY2FsbGJhY2sgdGhhdCB3aWxsIGJlIGNhbGxlZFxuICAgIC8vIHdoZW4gYSBzZW1pY29sb24gaXMgYXV0b21hdGljYWxseSBpbnNlcnRlZC4gSXQgd2lsbCBiZSBwYXNzZWRcbiAgICAvLyB0aGUgcG9zaXRpb24gb2YgdGhlIGNvbW1hIGFzIGFuIG9mZnNldCwgYW5kIGlmIGBsb2NhdGlvbnNgIGlzXG4gICAgLy8gZW5hYmxlZCwgaXQgaXMgZ2l2ZW4gdGhlIGxvY2F0aW9uIGFzIGEgYHtsaW5lLCBjb2x1bW59YCBvYmplY3RcbiAgICAvLyBhcyBzZWNvbmQgYXJndW1lbnQuXG4gICAgb25JbnNlcnRlZFNlbWljb2xvbjogbnVsbCxcbiAgICAvLyBgb25UcmFpbGluZ0NvbW1hYCBpcyBzaW1pbGFyIHRvIGBvbkluc2VydGVkU2VtaWNvbG9uYCwgYnV0IGZvclxuICAgIC8vIHRyYWlsaW5nIGNvbW1hcy5cbiAgICBvblRyYWlsaW5nQ29tbWE6IG51bGwsXG4gICAgLy8gQnkgZGVmYXVsdCwgcmVzZXJ2ZWQgd29yZHMgYXJlIG9ubHkgZW5mb3JjZWQgaWYgZWNtYVZlcnNpb24gPj0gNS5cbiAgICAvLyBTZXQgYGFsbG93UmVzZXJ2ZWRgIHRvIGEgYm9vbGVhbiB2YWx1ZSB0byBleHBsaWNpdGx5IHR1cm4gdGhpcyBvblxuICAgIC8vIGFuIG9mZi4gV2hlbiB0aGlzIG9wdGlvbiBoYXMgdGhlIHZhbHVlIFwibmV2ZXJcIiwgcmVzZXJ2ZWQgd29yZHNcbiAgICAvLyBhbmQga2V5d29yZHMgY2FuIGFsc28gbm90IGJlIHVzZWQgYXMgcHJvcGVydHkgbmFtZXMuXG4gICAgYWxsb3dSZXNlcnZlZDogbnVsbCxcbiAgICAvLyBXaGVuIGVuYWJsZWQsIGEgcmV0dXJuIGF0IHRoZSB0b3AgbGV2ZWwgaXMgbm90IGNvbnNpZGVyZWQgYW5cbiAgICAvLyBlcnJvci5cbiAgICBhbGxvd1JldHVybk91dHNpZGVGdW5jdGlvbjogZmFsc2UsXG4gICAgLy8gV2hlbiBlbmFibGVkLCBpbXBvcnQvZXhwb3J0IHN0YXRlbWVudHMgYXJlIG5vdCBjb25zdHJhaW5lZCB0b1xuICAgIC8vIGFwcGVhcmluZyBhdCB0aGUgdG9wIG9mIHRoZSBwcm9ncmFtLCBhbmQgYW4gaW1wb3J0Lm1ldGEgZXhwcmVzc2lvblxuICAgIC8vIGluIGEgc2NyaXB0IGlzbid0IGNvbnNpZGVyZWQgYW4gZXJyb3IuXG4gICAgYWxsb3dJbXBvcnRFeHBvcnRFdmVyeXdoZXJlOiBmYWxzZSxcbiAgICAvLyBCeSBkZWZhdWx0LCBhd2FpdCBpZGVudGlmaWVycyBhcmUgYWxsb3dlZCB0byBhcHBlYXIgYXQgdGhlIHRvcC1sZXZlbCBzY29wZSBvbmx5IGlmIGVjbWFWZXJzaW9uID49IDIwMjIuXG4gICAgLy8gV2hlbiBlbmFibGVkLCBhd2FpdCBpZGVudGlmaWVycyBhcmUgYWxsb3dlZCB0byBhcHBlYXIgYXQgdGhlIHRvcC1sZXZlbCBzY29wZSxcbiAgICAvLyBidXQgdGhleSBhcmUgc3RpbGwgbm90IGFsbG93ZWQgaW4gbm9uLWFzeW5jIGZ1bmN0aW9ucy5cbiAgICBhbGxvd0F3YWl0T3V0c2lkZUZ1bmN0aW9uOiBudWxsLFxuICAgIC8vIFdoZW4gZW5hYmxlZCwgc3VwZXIgaWRlbnRpZmllcnMgYXJlIG5vdCBjb25zdHJhaW5lZCB0b1xuICAgIC8vIGFwcGVhcmluZyBpbiBtZXRob2RzIGFuZCBkbyBub3QgcmFpc2UgYW4gZXJyb3Igd2hlbiB0aGV5IGFwcGVhciBlbHNld2hlcmUuXG4gICAgYWxsb3dTdXBlck91dHNpZGVNZXRob2Q6IG51bGwsXG4gICAgLy8gV2hlbiBlbmFibGVkLCBoYXNoYmFuZyBkaXJlY3RpdmUgaW4gdGhlIGJlZ2lubmluZyBvZiBmaWxlIGlzXG4gICAgLy8gYWxsb3dlZCBhbmQgdHJlYXRlZCBhcyBhIGxpbmUgY29tbWVudC4gRW5hYmxlZCBieSBkZWZhdWx0IHdoZW5cbiAgICAvLyBgZWNtYVZlcnNpb25gID49IDIwMjMuXG4gICAgYWxsb3dIYXNoQmFuZzogZmFsc2UsXG4gICAgLy8gQnkgZGVmYXVsdCwgdGhlIHBhcnNlciB3aWxsIHZlcmlmeSB0aGF0IHByaXZhdGUgcHJvcGVydGllcyBhcmVcbiAgICAvLyBvbmx5IHVzZWQgaW4gcGxhY2VzIHdoZXJlIHRoZXkgYXJlIHZhbGlkIGFuZCBoYXZlIGJlZW4gZGVjbGFyZWQuXG4gICAgLy8gU2V0IHRoaXMgdG8gZmFsc2UgdG8gdHVybiBzdWNoIGNoZWNrcyBvZmYuXG4gICAgY2hlY2tQcml2YXRlRmllbGRzOiB0cnVlLFxuICAgIC8vIFdoZW4gYGxvY2F0aW9uc2AgaXMgb24sIGBsb2NgIHByb3BlcnRpZXMgaG9sZGluZyBvYmplY3RzIHdpdGhcbiAgICAvLyBgc3RhcnRgIGFuZCBgZW5kYCBwcm9wZXJ0aWVzIGluIGB7bGluZSwgY29sdW1ufWAgZm9ybSAod2l0aFxuICAgIC8vIGxpbmUgYmVpbmcgMS1iYXNlZCBhbmQgY29sdW1uIDAtYmFzZWQpIHdpbGwgYmUgYXR0YWNoZWQgdG8gdGhlXG4gICAgLy8gbm9kZXMuXG4gICAgbG9jYXRpb25zOiBmYWxzZSxcbiAgICAvLyBBIGZ1bmN0aW9uIGNhbiBiZSBwYXNzZWQgYXMgYG9uVG9rZW5gIG9wdGlvbiwgd2hpY2ggd2lsbFxuICAgIC8vIGNhdXNlIEFjb3JuIHRvIGNhbGwgdGhhdCBmdW5jdGlvbiB3aXRoIG9iamVjdCBpbiB0aGUgc2FtZVxuICAgIC8vIGZvcm1hdCBhcyB0b2tlbnMgcmV0dXJuZWQgZnJvbSBgdG9rZW5pemVyKCkuZ2V0VG9rZW4oKWAuIE5vdGVcbiAgICAvLyB0aGF0IHlvdSBhcmUgbm90IGFsbG93ZWQgdG8gY2FsbCB0aGUgcGFyc2VyIGZyb20gdGhlXG4gICAgLy8gY2FsbGJhY2vigJR0aGF0IHdpbGwgY29ycnVwdCBpdHMgaW50ZXJuYWwgc3RhdGUuXG4gICAgb25Ub2tlbjogbnVsbCxcbiAgICAvLyBBIGZ1bmN0aW9uIGNhbiBiZSBwYXNzZWQgYXMgYG9uQ29tbWVudGAgb3B0aW9uLCB3aGljaCB3aWxsXG4gICAgLy8gY2F1c2UgQWNvcm4gdG8gY2FsbCB0aGF0IGZ1bmN0aW9uIHdpdGggYChibG9jaywgdGV4dCwgc3RhcnQsXG4gICAgLy8gZW5kKWAgcGFyYW1ldGVycyB3aGVuZXZlciBhIGNvbW1lbnQgaXMgc2tpcHBlZC4gYGJsb2NrYCBpcyBhXG4gICAgLy8gYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyBhIGJsb2NrIChgLyogKi9gKSBjb21tZW50LFxuICAgIC8vIGB0ZXh0YCBpcyB0aGUgY29udGVudCBvZiB0aGUgY29tbWVudCwgYW5kIGBzdGFydGAgYW5kIGBlbmRgIGFyZVxuICAgIC8vIGNoYXJhY3RlciBvZmZzZXRzIHRoYXQgZGVub3RlIHRoZSBzdGFydCBhbmQgZW5kIG9mIHRoZSBjb21tZW50LlxuICAgIC8vIFdoZW4gdGhlIGBsb2NhdGlvbnNgIG9wdGlvbiBpcyBvbiwgdHdvIG1vcmUgcGFyYW1ldGVycyBhcmVcbiAgICAvLyBwYXNzZWQsIHRoZSBmdWxsIGB7bGluZSwgY29sdW1ufWAgbG9jYXRpb25zIG9mIHRoZSBzdGFydCBhbmRcbiAgICAvLyBlbmQgb2YgdGhlIGNvbW1lbnRzLiBOb3RlIHRoYXQgeW91IGFyZSBub3QgYWxsb3dlZCB0byBjYWxsIHRoZVxuICAgIC8vIHBhcnNlciBmcm9tIHRoZSBjYWxsYmFja+KAlHRoYXQgd2lsbCBjb3JydXB0IGl0cyBpbnRlcm5hbCBzdGF0ZS5cbiAgICBvbkNvbW1lbnQ6IG51bGwsXG4gICAgLy8gTm9kZXMgaGF2ZSB0aGVpciBzdGFydCBhbmQgZW5kIGNoYXJhY3RlcnMgb2Zmc2V0cyByZWNvcmRlZCBpblxuICAgIC8vIGBzdGFydGAgYW5kIGBlbmRgIHByb3BlcnRpZXMgKGRpcmVjdGx5IG9uIHRoZSBub2RlLCByYXRoZXIgdGhhblxuICAgIC8vIHRoZSBgbG9jYCBvYmplY3QsIHdoaWNoIGhvbGRzIGxpbmUvY29sdW1uIGRhdGEuIFRvIGFsc28gYWRkIGFcbiAgICAvLyBbc2VtaS1zdGFuZGFyZGl6ZWRdW3JhbmdlXSBgcmFuZ2VgIHByb3BlcnR5IGhvbGRpbmcgYSBgW3N0YXJ0LFxuICAgIC8vIGVuZF1gIGFycmF5IHdpdGggdGhlIHNhbWUgbnVtYmVycywgc2V0IHRoZSBgcmFuZ2VzYCBvcHRpb24gdG9cbiAgICAvLyBgdHJ1ZWAuXG4gICAgLy9cbiAgICAvLyBbcmFuZ2VdOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD03NDU2NzhcbiAgICByYW5nZXM6IGZhbHNlLFxuICAgIC8vIEl0IGlzIHBvc3NpYmxlIHRvIHBhcnNlIG11bHRpcGxlIGZpbGVzIGludG8gYSBzaW5nbGUgQVNUIGJ5XG4gICAgLy8gcGFzc2luZyB0aGUgdHJlZSBwcm9kdWNlZCBieSBwYXJzaW5nIHRoZSBmaXJzdCBmaWxlIGFzXG4gICAgLy8gYHByb2dyYW1gIG9wdGlvbiBpbiBzdWJzZXF1ZW50IHBhcnNlcy4gVGhpcyB3aWxsIGFkZCB0aGVcbiAgICAvLyB0b3BsZXZlbCBmb3JtcyBvZiB0aGUgcGFyc2VkIGZpbGUgdG8gdGhlIGBQcm9ncmFtYCAodG9wKSBub2RlXG4gICAgLy8gb2YgYW4gZXhpc3RpbmcgcGFyc2UgdHJlZS5cbiAgICBwcm9ncmFtOiBudWxsLFxuICAgIC8vIFdoZW4gYGxvY2F0aW9uc2AgaXMgb24sIHlvdSBjYW4gcGFzcyB0aGlzIHRvIHJlY29yZCB0aGUgc291cmNlXG4gICAgLy8gZmlsZSBpbiBldmVyeSBub2RlJ3MgYGxvY2Agb2JqZWN0LlxuICAgIHNvdXJjZUZpbGU6IG51bGwsXG4gICAgLy8gVGhpcyB2YWx1ZSwgaWYgZ2l2ZW4sIGlzIHN0b3JlZCBpbiBldmVyeSBub2RlLCB3aGV0aGVyXG4gICAgLy8gYGxvY2F0aW9uc2AgaXMgb24gb3Igb2ZmLlxuICAgIGRpcmVjdFNvdXJjZUZpbGU6IG51bGwsXG4gICAgLy8gV2hlbiBlbmFibGVkLCBwYXJlbnRoZXNpemVkIGV4cHJlc3Npb25zIGFyZSByZXByZXNlbnRlZCBieVxuICAgIC8vIChub24tc3RhbmRhcmQpIFBhcmVudGhlc2l6ZWRFeHByZXNzaW9uIG5vZGVzXG4gICAgcHJlc2VydmVQYXJlbnM6IGZhbHNlXG4gIH07XG5cbiAgLy8gSW50ZXJwcmV0IGFuZCBkZWZhdWx0IGFuIG9wdGlvbnMgb2JqZWN0XG5cbiAgdmFyIHdhcm5lZEFib3V0RWNtYVZlcnNpb24gPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnZXRPcHRpb25zKG9wdHMpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xuXG4gICAgZm9yICh2YXIgb3B0IGluIGRlZmF1bHRPcHRpb25zKVxuICAgICAgeyBvcHRpb25zW29wdF0gPSBvcHRzICYmIGhhc093bihvcHRzLCBvcHQpID8gb3B0c1tvcHRdIDogZGVmYXVsdE9wdGlvbnNbb3B0XTsgfVxuXG4gICAgaWYgKG9wdGlvbnMuZWNtYVZlcnNpb24gPT09IFwibGF0ZXN0XCIpIHtcbiAgICAgIG9wdGlvbnMuZWNtYVZlcnNpb24gPSAxZTg7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmVjbWFWZXJzaW9uID09IG51bGwpIHtcbiAgICAgIGlmICghd2FybmVkQWJvdXRFY21hVmVyc2lvbiAmJiB0eXBlb2YgY29uc29sZSA9PT0gXCJvYmplY3RcIiAmJiBjb25zb2xlLndhcm4pIHtcbiAgICAgICAgd2FybmVkQWJvdXRFY21hVmVyc2lvbiA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUud2FybihcIlNpbmNlIEFjb3JuIDguMC4wLCBvcHRpb25zLmVjbWFWZXJzaW9uIGlzIHJlcXVpcmVkLlxcbkRlZmF1bHRpbmcgdG8gMjAyMCwgYnV0IHRoaXMgd2lsbCBzdG9wIHdvcmtpbmcgaW4gdGhlIGZ1dHVyZS5cIik7XG4gICAgICB9XG4gICAgICBvcHRpb25zLmVjbWFWZXJzaW9uID0gMTE7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmVjbWFWZXJzaW9uID49IDIwMTUpIHtcbiAgICAgIG9wdGlvbnMuZWNtYVZlcnNpb24gLT0gMjAwOTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5hbGxvd1Jlc2VydmVkID09IG51bGwpXG4gICAgICB7IG9wdGlvbnMuYWxsb3dSZXNlcnZlZCA9IG9wdGlvbnMuZWNtYVZlcnNpb24gPCA1OyB9XG5cbiAgICBpZiAoIW9wdHMgfHwgb3B0cy5hbGxvd0hhc2hCYW5nID09IG51bGwpXG4gICAgICB7IG9wdGlvbnMuYWxsb3dIYXNoQmFuZyA9IG9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTQ7IH1cblxuICAgIGlmIChpc0FycmF5KG9wdGlvbnMub25Ub2tlbikpIHtcbiAgICAgIHZhciB0b2tlbnMgPSBvcHRpb25zLm9uVG9rZW47XG4gICAgICBvcHRpb25zLm9uVG9rZW4gPSBmdW5jdGlvbiAodG9rZW4pIHsgcmV0dXJuIHRva2Vucy5wdXNoKHRva2VuKTsgfTtcbiAgICB9XG4gICAgaWYgKGlzQXJyYXkob3B0aW9ucy5vbkNvbW1lbnQpKVxuICAgICAgeyBvcHRpb25zLm9uQ29tbWVudCA9IHB1c2hDb21tZW50KG9wdGlvbnMsIG9wdGlvbnMub25Db21tZW50KTsgfVxuXG4gICAgcmV0dXJuIG9wdGlvbnNcbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hDb21tZW50KG9wdGlvbnMsIGFycmF5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGJsb2NrLCB0ZXh0LCBzdGFydCwgZW5kLCBzdGFydExvYywgZW5kTG9jKSB7XG4gICAgICB2YXIgY29tbWVudCA9IHtcbiAgICAgICAgdHlwZTogYmxvY2sgPyBcIkJsb2NrXCIgOiBcIkxpbmVcIixcbiAgICAgICAgdmFsdWU6IHRleHQsXG4gICAgICAgIHN0YXJ0OiBzdGFydCxcbiAgICAgICAgZW5kOiBlbmRcbiAgICAgIH07XG4gICAgICBpZiAob3B0aW9ucy5sb2NhdGlvbnMpXG4gICAgICAgIHsgY29tbWVudC5sb2MgPSBuZXcgU291cmNlTG9jYXRpb24odGhpcywgc3RhcnRMb2MsIGVuZExvYyk7IH1cbiAgICAgIGlmIChvcHRpb25zLnJhbmdlcylcbiAgICAgICAgeyBjb21tZW50LnJhbmdlID0gW3N0YXJ0LCBlbmRdOyB9XG4gICAgICBhcnJheS5wdXNoKGNvbW1lbnQpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEVhY2ggc2NvcGUgZ2V0cyBhIGJpdHNldCB0aGF0IG1heSBjb250YWluIHRoZXNlIGZsYWdzXG4gIHZhclxuICAgICAgU0NPUEVfVE9QID0gMSxcbiAgICAgIFNDT1BFX0ZVTkNUSU9OID0gMixcbiAgICAgIFNDT1BFX0FTWU5DID0gNCxcbiAgICAgIFNDT1BFX0dFTkVSQVRPUiA9IDgsXG4gICAgICBTQ09QRV9BUlJPVyA9IDE2LFxuICAgICAgU0NPUEVfU0lNUExFX0NBVENIID0gMzIsXG4gICAgICBTQ09QRV9TVVBFUiA9IDY0LFxuICAgICAgU0NPUEVfRElSRUNUX1NVUEVSID0gMTI4LFxuICAgICAgU0NPUEVfQ0xBU1NfU1RBVElDX0JMT0NLID0gMjU2LFxuICAgICAgU0NPUEVfVkFSID0gU0NPUEVfVE9QIHwgU0NPUEVfRlVOQ1RJT04gfCBTQ09QRV9DTEFTU19TVEFUSUNfQkxPQ0s7XG5cbiAgZnVuY3Rpb24gZnVuY3Rpb25GbGFncyhhc3luYywgZ2VuZXJhdG9yKSB7XG4gICAgcmV0dXJuIFNDT1BFX0ZVTkNUSU9OIHwgKGFzeW5jID8gU0NPUEVfQVNZTkMgOiAwKSB8IChnZW5lcmF0b3IgPyBTQ09QRV9HRU5FUkFUT1IgOiAwKVxuICB9XG5cbiAgLy8gVXNlZCBpbiBjaGVja0xWYWwqIGFuZCBkZWNsYXJlTmFtZSB0byBkZXRlcm1pbmUgdGhlIHR5cGUgb2YgYSBiaW5kaW5nXG4gIHZhclxuICAgICAgQklORF9OT05FID0gMCwgLy8gTm90IGEgYmluZGluZ1xuICAgICAgQklORF9WQVIgPSAxLCAvLyBWYXItc3R5bGUgYmluZGluZ1xuICAgICAgQklORF9MRVhJQ0FMID0gMiwgLy8gTGV0LSBvciBjb25zdC1zdHlsZSBiaW5kaW5nXG4gICAgICBCSU5EX0ZVTkNUSU9OID0gMywgLy8gRnVuY3Rpb24gZGVjbGFyYXRpb25cbiAgICAgIEJJTkRfU0lNUExFX0NBVENIID0gNCwgLy8gU2ltcGxlIChpZGVudGlmaWVyIHBhdHRlcm4pIGNhdGNoIGJpbmRpbmdcbiAgICAgIEJJTkRfT1VUU0lERSA9IDU7IC8vIFNwZWNpYWwgY2FzZSBmb3IgZnVuY3Rpb24gbmFtZXMgYXMgYm91bmQgaW5zaWRlIHRoZSBmdW5jdGlvblxuXG4gIHZhciBQYXJzZXIgPSBmdW5jdGlvbiBQYXJzZXIob3B0aW9ucywgaW5wdXQsIHN0YXJ0UG9zKSB7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyA9IGdldE9wdGlvbnMob3B0aW9ucyk7XG4gICAgdGhpcy5zb3VyY2VGaWxlID0gb3B0aW9ucy5zb3VyY2VGaWxlO1xuICAgIHRoaXMua2V5d29yZHMgPSB3b3Jkc1JlZ2V4cChrZXl3b3JkcyQxW29wdGlvbnMuZWNtYVZlcnNpb24gPj0gNiA/IDYgOiBvcHRpb25zLnNvdXJjZVR5cGUgPT09IFwibW9kdWxlXCIgPyBcIjVtb2R1bGVcIiA6IDVdKTtcbiAgICB2YXIgcmVzZXJ2ZWQgPSBcIlwiO1xuICAgIGlmIChvcHRpb25zLmFsbG93UmVzZXJ2ZWQgIT09IHRydWUpIHtcbiAgICAgIHJlc2VydmVkID0gcmVzZXJ2ZWRXb3Jkc1tvcHRpb25zLmVjbWFWZXJzaW9uID49IDYgPyA2IDogb3B0aW9ucy5lY21hVmVyc2lvbiA9PT0gNSA/IDUgOiAzXTtcbiAgICAgIGlmIChvcHRpb25zLnNvdXJjZVR5cGUgPT09IFwibW9kdWxlXCIpIHsgcmVzZXJ2ZWQgKz0gXCIgYXdhaXRcIjsgfVxuICAgIH1cbiAgICB0aGlzLnJlc2VydmVkV29yZHMgPSB3b3Jkc1JlZ2V4cChyZXNlcnZlZCk7XG4gICAgdmFyIHJlc2VydmVkU3RyaWN0ID0gKHJlc2VydmVkID8gcmVzZXJ2ZWQgKyBcIiBcIiA6IFwiXCIpICsgcmVzZXJ2ZWRXb3Jkcy5zdHJpY3Q7XG4gICAgdGhpcy5yZXNlcnZlZFdvcmRzU3RyaWN0ID0gd29yZHNSZWdleHAocmVzZXJ2ZWRTdHJpY3QpO1xuICAgIHRoaXMucmVzZXJ2ZWRXb3Jkc1N0cmljdEJpbmQgPSB3b3Jkc1JlZ2V4cChyZXNlcnZlZFN0cmljdCArIFwiIFwiICsgcmVzZXJ2ZWRXb3Jkcy5zdHJpY3RCaW5kKTtcbiAgICB0aGlzLmlucHV0ID0gU3RyaW5nKGlucHV0KTtcblxuICAgIC8vIFVzZWQgdG8gc2lnbmFsIHRvIGNhbGxlcnMgb2YgYHJlYWRXb3JkMWAgd2hldGhlciB0aGUgd29yZFxuICAgIC8vIGNvbnRhaW5lZCBhbnkgZXNjYXBlIHNlcXVlbmNlcy4gVGhpcyBpcyBuZWVkZWQgYmVjYXVzZSB3b3JkcyB3aXRoXG4gICAgLy8gZXNjYXBlIHNlcXVlbmNlcyBtdXN0IG5vdCBiZSBpbnRlcnByZXRlZCBhcyBrZXl3b3Jkcy5cbiAgICB0aGlzLmNvbnRhaW5zRXNjID0gZmFsc2U7XG5cbiAgICAvLyBTZXQgdXAgdG9rZW4gc3RhdGVcblxuICAgIC8vIFRoZSBjdXJyZW50IHBvc2l0aW9uIG9mIHRoZSB0b2tlbml6ZXIgaW4gdGhlIGlucHV0LlxuICAgIGlmIChzdGFydFBvcykge1xuICAgICAgdGhpcy5wb3MgPSBzdGFydFBvcztcbiAgICAgIHRoaXMubGluZVN0YXJ0ID0gdGhpcy5pbnB1dC5sYXN0SW5kZXhPZihcIlxcblwiLCBzdGFydFBvcyAtIDEpICsgMTtcbiAgICAgIHRoaXMuY3VyTGluZSA9IHRoaXMuaW5wdXQuc2xpY2UoMCwgdGhpcy5saW5lU3RhcnQpLnNwbGl0KGxpbmVCcmVhaykubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBvcyA9IHRoaXMubGluZVN0YXJ0ID0gMDtcbiAgICAgIHRoaXMuY3VyTGluZSA9IDE7XG4gICAgfVxuXG4gICAgLy8gUHJvcGVydGllcyBvZiB0aGUgY3VycmVudCB0b2tlbjpcbiAgICAvLyBJdHMgdHlwZVxuICAgIHRoaXMudHlwZSA9IHR5cGVzJDEuZW9mO1xuICAgIC8vIEZvciB0b2tlbnMgdGhhdCBpbmNsdWRlIG1vcmUgaW5mb3JtYXRpb24gdGhhbiB0aGVpciB0eXBlLCB0aGUgdmFsdWVcbiAgICB0aGlzLnZhbHVlID0gbnVsbDtcbiAgICAvLyBJdHMgc3RhcnQgYW5kIGVuZCBvZmZzZXRcbiAgICB0aGlzLnN0YXJ0ID0gdGhpcy5lbmQgPSB0aGlzLnBvcztcbiAgICAvLyBBbmQsIGlmIGxvY2F0aW9ucyBhcmUgdXNlZCwgdGhlIHtsaW5lLCBjb2x1bW59IG9iamVjdFxuICAgIC8vIGNvcnJlc3BvbmRpbmcgdG8gdGhvc2Ugb2Zmc2V0c1xuICAgIHRoaXMuc3RhcnRMb2MgPSB0aGlzLmVuZExvYyA9IHRoaXMuY3VyUG9zaXRpb24oKTtcblxuICAgIC8vIFBvc2l0aW9uIGluZm9ybWF0aW9uIGZvciB0aGUgcHJldmlvdXMgdG9rZW5cbiAgICB0aGlzLmxhc3RUb2tFbmRMb2MgPSB0aGlzLmxhc3RUb2tTdGFydExvYyA9IG51bGw7XG4gICAgdGhpcy5sYXN0VG9rU3RhcnQgPSB0aGlzLmxhc3RUb2tFbmQgPSB0aGlzLnBvcztcblxuICAgIC8vIFRoZSBjb250ZXh0IHN0YWNrIGlzIHVzZWQgdG8gc3VwZXJmaWNpYWxseSB0cmFjayBzeW50YWN0aWNcbiAgICAvLyBjb250ZXh0IHRvIHByZWRpY3Qgd2hldGhlciBhIHJlZ3VsYXIgZXhwcmVzc2lvbiBpcyBhbGxvd2VkIGluIGFcbiAgICAvLyBnaXZlbiBwb3NpdGlvbi5cbiAgICB0aGlzLmNvbnRleHQgPSB0aGlzLmluaXRpYWxDb250ZXh0KCk7XG4gICAgdGhpcy5leHByQWxsb3dlZCA9IHRydWU7XG5cbiAgICAvLyBGaWd1cmUgb3V0IGlmIGl0J3MgYSBtb2R1bGUgY29kZS5cbiAgICB0aGlzLmluTW9kdWxlID0gb3B0aW9ucy5zb3VyY2VUeXBlID09PSBcIm1vZHVsZVwiO1xuICAgIHRoaXMuc3RyaWN0ID0gdGhpcy5pbk1vZHVsZSB8fCB0aGlzLnN0cmljdERpcmVjdGl2ZSh0aGlzLnBvcyk7XG5cbiAgICAvLyBVc2VkIHRvIHNpZ25pZnkgdGhlIHN0YXJ0IG9mIGEgcG90ZW50aWFsIGFycm93IGZ1bmN0aW9uXG4gICAgdGhpcy5wb3RlbnRpYWxBcnJvd0F0ID0gLTE7XG4gICAgdGhpcy5wb3RlbnRpYWxBcnJvd0luRm9yQXdhaXQgPSBmYWxzZTtcblxuICAgIC8vIFBvc2l0aW9ucyB0byBkZWxheWVkLWNoZWNrIHRoYXQgeWllbGQvYXdhaXQgZG9lcyBub3QgZXhpc3QgaW4gZGVmYXVsdCBwYXJhbWV0ZXJzLlxuICAgIHRoaXMueWllbGRQb3MgPSB0aGlzLmF3YWl0UG9zID0gdGhpcy5hd2FpdElkZW50UG9zID0gMDtcbiAgICAvLyBMYWJlbHMgaW4gc2NvcGUuXG4gICAgdGhpcy5sYWJlbHMgPSBbXTtcbiAgICAvLyBUaHVzLWZhciB1bmRlZmluZWQgZXhwb3J0cy5cbiAgICB0aGlzLnVuZGVmaW5lZEV4cG9ydHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgLy8gSWYgZW5hYmxlZCwgc2tpcCBsZWFkaW5nIGhhc2hiYW5nIGxpbmUuXG4gICAgaWYgKHRoaXMucG9zID09PSAwICYmIG9wdGlvbnMuYWxsb3dIYXNoQmFuZyAmJiB0aGlzLmlucHV0LnNsaWNlKDAsIDIpID09PSBcIiMhXCIpXG4gICAgICB7IHRoaXMuc2tpcExpbmVDb21tZW50KDIpOyB9XG5cbiAgICAvLyBTY29wZSB0cmFja2luZyBmb3IgZHVwbGljYXRlIHZhcmlhYmxlIG5hbWVzIChzZWUgc2NvcGUuanMpXG4gICAgdGhpcy5zY29wZVN0YWNrID0gW107XG4gICAgdGhpcy5lbnRlclNjb3BlKFNDT1BFX1RPUCk7XG5cbiAgICAvLyBGb3IgUmVnRXhwIHZhbGlkYXRpb25cbiAgICB0aGlzLnJlZ2V4cFN0YXRlID0gbnVsbDtcblxuICAgIC8vIFRoZSBzdGFjayBvZiBwcml2YXRlIG5hbWVzLlxuICAgIC8vIEVhY2ggZWxlbWVudCBoYXMgdHdvIHByb3BlcnRpZXM6ICdkZWNsYXJlZCcgYW5kICd1c2VkJy5cbiAgICAvLyBXaGVuIGl0IGV4aXRlZCBmcm9tIHRoZSBvdXRlcm1vc3QgY2xhc3MgZGVmaW5pdGlvbiwgYWxsIHVzZWQgcHJpdmF0ZSBuYW1lcyBtdXN0IGJlIGRlY2xhcmVkLlxuICAgIHRoaXMucHJpdmF0ZU5hbWVTdGFjayA9IFtdO1xuICB9O1xuXG4gIHZhciBwcm90b3R5cGVBY2Nlc3NvcnMgPSB7IGluRnVuY3Rpb246IHsgY29uZmlndXJhYmxlOiB0cnVlIH0saW5HZW5lcmF0b3I6IHsgY29uZmlndXJhYmxlOiB0cnVlIH0saW5Bc3luYzogeyBjb25maWd1cmFibGU6IHRydWUgfSxjYW5Bd2FpdDogeyBjb25maWd1cmFibGU6IHRydWUgfSxhbGxvd1N1cGVyOiB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSB9LGFsbG93RGlyZWN0U3VwZXI6IHsgY29uZmlndXJhYmxlOiB0cnVlIH0sdHJlYXRGdW5jdGlvbnNBc1ZhcjogeyBjb25maWd1cmFibGU6IHRydWUgfSxhbGxvd05ld0RvdFRhcmdldDogeyBjb25maWd1cmFibGU6IHRydWUgfSxpbkNsYXNzU3RhdGljQmxvY2s6IHsgY29uZmlndXJhYmxlOiB0cnVlIH0gfTtcblxuICBQYXJzZXIucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UgKCkge1xuICAgIHZhciBub2RlID0gdGhpcy5vcHRpb25zLnByb2dyYW0gfHwgdGhpcy5zdGFydE5vZGUoKTtcbiAgICB0aGlzLm5leHRUb2tlbigpO1xuICAgIHJldHVybiB0aGlzLnBhcnNlVG9wTGV2ZWwobm9kZSlcbiAgfTtcblxuICBwcm90b3R5cGVBY2Nlc3NvcnMuaW5GdW5jdGlvbi5nZXQgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAodGhpcy5jdXJyZW50VmFyU2NvcGUoKS5mbGFncyAmIFNDT1BFX0ZVTkNUSU9OKSA+IDAgfTtcblxuICBwcm90b3R5cGVBY2Nlc3NvcnMuaW5HZW5lcmF0b3IuZ2V0ID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gKHRoaXMuY3VycmVudFZhclNjb3BlKCkuZmxhZ3MgJiBTQ09QRV9HRU5FUkFUT1IpID4gMCAmJiAhdGhpcy5jdXJyZW50VmFyU2NvcGUoKS5pbkNsYXNzRmllbGRJbml0IH07XG5cbiAgcHJvdG90eXBlQWNjZXNzb3JzLmluQXN5bmMuZ2V0ID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gKHRoaXMuY3VycmVudFZhclNjb3BlKCkuZmxhZ3MgJiBTQ09QRV9BU1lOQykgPiAwICYmICF0aGlzLmN1cnJlbnRWYXJTY29wZSgpLmluQ2xhc3NGaWVsZEluaXQgfTtcblxuICBwcm90b3R5cGVBY2Nlc3NvcnMuY2FuQXdhaXQuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnNjb3BlU3RhY2subGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHZhciBzY29wZSA9IHRoaXMuc2NvcGVTdGFja1tpXTtcbiAgICAgIGlmIChzY29wZS5pbkNsYXNzRmllbGRJbml0IHx8IHNjb3BlLmZsYWdzICYgU0NPUEVfQ0xBU1NfU1RBVElDX0JMT0NLKSB7IHJldHVybiBmYWxzZSB9XG4gICAgICBpZiAoc2NvcGUuZmxhZ3MgJiBTQ09QRV9GVU5DVElPTikgeyByZXR1cm4gKHNjb3BlLmZsYWdzICYgU0NPUEVfQVNZTkMpID4gMCB9XG4gICAgfVxuICAgIHJldHVybiAodGhpcy5pbk1vZHVsZSAmJiB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTMpIHx8IHRoaXMub3B0aW9ucy5hbGxvd0F3YWl0T3V0c2lkZUZ1bmN0aW9uXG4gIH07XG5cbiAgcHJvdG90eXBlQWNjZXNzb3JzLmFsbG93U3VwZXIuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZWYgPSB0aGlzLmN1cnJlbnRUaGlzU2NvcGUoKTtcbiAgICAgIHZhciBmbGFncyA9IHJlZi5mbGFncztcbiAgICAgIHZhciBpbkNsYXNzRmllbGRJbml0ID0gcmVmLmluQ2xhc3NGaWVsZEluaXQ7XG4gICAgcmV0dXJuIChmbGFncyAmIFNDT1BFX1NVUEVSKSA+IDAgfHwgaW5DbGFzc0ZpZWxkSW5pdCB8fCB0aGlzLm9wdGlvbnMuYWxsb3dTdXBlck91dHNpZGVNZXRob2RcbiAgfTtcblxuICBwcm90b3R5cGVBY2Nlc3NvcnMuYWxsb3dEaXJlY3RTdXBlci5nZXQgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAodGhpcy5jdXJyZW50VGhpc1Njb3BlKCkuZmxhZ3MgJiBTQ09QRV9ESVJFQ1RfU1VQRVIpID4gMCB9O1xuXG4gIHByb3RvdHlwZUFjY2Vzc29ycy50cmVhdEZ1bmN0aW9uc0FzVmFyLmdldCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXMudHJlYXRGdW5jdGlvbnNBc1ZhckluU2NvcGUodGhpcy5jdXJyZW50U2NvcGUoKSkgfTtcblxuICBwcm90b3R5cGVBY2Nlc3NvcnMuYWxsb3dOZXdEb3RUYXJnZXQuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZWYgPSB0aGlzLmN1cnJlbnRUaGlzU2NvcGUoKTtcbiAgICAgIHZhciBmbGFncyA9IHJlZi5mbGFncztcbiAgICAgIHZhciBpbkNsYXNzRmllbGRJbml0ID0gcmVmLmluQ2xhc3NGaWVsZEluaXQ7XG4gICAgcmV0dXJuIChmbGFncyAmIChTQ09QRV9GVU5DVElPTiB8IFNDT1BFX0NMQVNTX1NUQVRJQ19CTE9DSykpID4gMCB8fCBpbkNsYXNzRmllbGRJbml0XG4gIH07XG5cbiAgcHJvdG90eXBlQWNjZXNzb3JzLmluQ2xhc3NTdGF0aWNCbG9jay5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLmN1cnJlbnRWYXJTY29wZSgpLmZsYWdzICYgU0NPUEVfQ0xBU1NfU1RBVElDX0JMT0NLKSA+IDBcbiAgfTtcblxuICBQYXJzZXIuZXh0ZW5kID0gZnVuY3Rpb24gZXh0ZW5kICgpIHtcbiAgICAgIHZhciBwbHVnaW5zID0gW10sIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICB3aGlsZSAoIGxlbi0tICkgcGx1Z2luc1sgbGVuIF0gPSBhcmd1bWVudHNbIGxlbiBdO1xuXG4gICAgdmFyIGNscyA9IHRoaXM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwbHVnaW5zLmxlbmd0aDsgaSsrKSB7IGNscyA9IHBsdWdpbnNbaV0oY2xzKTsgfVxuICAgIHJldHVybiBjbHNcbiAgfTtcblxuICBQYXJzZXIucGFyc2UgPSBmdW5jdGlvbiBwYXJzZSAoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMob3B0aW9ucywgaW5wdXQpLnBhcnNlKClcbiAgfTtcblxuICBQYXJzZXIucGFyc2VFeHByZXNzaW9uQXQgPSBmdW5jdGlvbiBwYXJzZUV4cHJlc3Npb25BdCAoaW5wdXQsIHBvcywgb3B0aW9ucykge1xuICAgIHZhciBwYXJzZXIgPSBuZXcgdGhpcyhvcHRpb25zLCBpbnB1dCwgcG9zKTtcbiAgICBwYXJzZXIubmV4dFRva2VuKCk7XG4gICAgcmV0dXJuIHBhcnNlci5wYXJzZUV4cHJlc3Npb24oKVxuICB9O1xuXG4gIFBhcnNlci50b2tlbml6ZXIgPSBmdW5jdGlvbiB0b2tlbml6ZXIgKGlucHV0LCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzKG9wdGlvbnMsIGlucHV0KVxuICB9O1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKCBQYXJzZXIucHJvdG90eXBlLCBwcm90b3R5cGVBY2Nlc3NvcnMgKTtcblxuICB2YXIgcHAkOSA9IFBhcnNlci5wcm90b3R5cGU7XG5cbiAgLy8gIyMgUGFyc2VyIHV0aWxpdGllc1xuXG4gIHZhciBsaXRlcmFsID0gL14oPzonKCg/OlxcXFwufFteJ1xcXFxdKSo/KSd8XCIoKD86XFxcXC58W15cIlxcXFxdKSo/KVwiKS87XG4gIHBwJDkuc3RyaWN0RGlyZWN0aXZlID0gZnVuY3Rpb24oc3RhcnQpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uIDwgNSkgeyByZXR1cm4gZmFsc2UgfVxuICAgIGZvciAoOzspIHtcbiAgICAgIC8vIFRyeSB0byBmaW5kIHN0cmluZyBsaXRlcmFsLlxuICAgICAgc2tpcFdoaXRlU3BhY2UubGFzdEluZGV4ID0gc3RhcnQ7XG4gICAgICBzdGFydCArPSBza2lwV2hpdGVTcGFjZS5leGVjKHRoaXMuaW5wdXQpWzBdLmxlbmd0aDtcbiAgICAgIHZhciBtYXRjaCA9IGxpdGVyYWwuZXhlYyh0aGlzLmlucHV0LnNsaWNlKHN0YXJ0KSk7XG4gICAgICBpZiAoIW1hdGNoKSB7IHJldHVybiBmYWxzZSB9XG4gICAgICBpZiAoKG1hdGNoWzFdIHx8IG1hdGNoWzJdKSA9PT0gXCJ1c2Ugc3RyaWN0XCIpIHtcbiAgICAgICAgc2tpcFdoaXRlU3BhY2UubGFzdEluZGV4ID0gc3RhcnQgKyBtYXRjaFswXS5sZW5ndGg7XG4gICAgICAgIHZhciBzcGFjZUFmdGVyID0gc2tpcFdoaXRlU3BhY2UuZXhlYyh0aGlzLmlucHV0KSwgZW5kID0gc3BhY2VBZnRlci5pbmRleCArIHNwYWNlQWZ0ZXJbMF0ubGVuZ3RoO1xuICAgICAgICB2YXIgbmV4dCA9IHRoaXMuaW5wdXQuY2hhckF0KGVuZCk7XG4gICAgICAgIHJldHVybiBuZXh0ID09PSBcIjtcIiB8fCBuZXh0ID09PSBcIn1cIiB8fFxuICAgICAgICAgIChsaW5lQnJlYWsudGVzdChzcGFjZUFmdGVyWzBdKSAmJlxuICAgICAgICAgICAhKC9bKGAuWytcXC0vKiU8Pj0sP14mXS8udGVzdChuZXh0KSB8fCBuZXh0ID09PSBcIiFcIiAmJiB0aGlzLmlucHV0LmNoYXJBdChlbmQgKyAxKSA9PT0gXCI9XCIpKVxuICAgICAgfVxuICAgICAgc3RhcnQgKz0gbWF0Y2hbMF0ubGVuZ3RoO1xuXG4gICAgICAvLyBTa2lwIHNlbWljb2xvbiwgaWYgYW55LlxuICAgICAgc2tpcFdoaXRlU3BhY2UubGFzdEluZGV4ID0gc3RhcnQ7XG4gICAgICBzdGFydCArPSBza2lwV2hpdGVTcGFjZS5leGVjKHRoaXMuaW5wdXQpWzBdLmxlbmd0aDtcbiAgICAgIGlmICh0aGlzLmlucHV0W3N0YXJ0XSA9PT0gXCI7XCIpXG4gICAgICAgIHsgc3RhcnQrKzsgfVxuICAgIH1cbiAgfTtcblxuICAvLyBQcmVkaWNhdGUgdGhhdCB0ZXN0cyB3aGV0aGVyIHRoZSBuZXh0IHRva2VuIGlzIG9mIHRoZSBnaXZlblxuICAvLyB0eXBlLCBhbmQgaWYgeWVzLCBjb25zdW1lcyBpdCBhcyBhIHNpZGUgZWZmZWN0LlxuXG4gIHBwJDkuZWF0ID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGUpIHtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9O1xuXG4gIC8vIFRlc3RzIHdoZXRoZXIgcGFyc2VkIHRva2VuIGlzIGEgY29udGV4dHVhbCBrZXl3b3JkLlxuXG4gIHBwJDkuaXNDb250ZXh0dWFsID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IHR5cGVzJDEubmFtZSAmJiB0aGlzLnZhbHVlID09PSBuYW1lICYmICF0aGlzLmNvbnRhaW5zRXNjXG4gIH07XG5cbiAgLy8gQ29uc3VtZXMgY29udGV4dHVhbCBrZXl3b3JkIGlmIHBvc3NpYmxlLlxuXG4gIHBwJDkuZWF0Q29udGV4dHVhbCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaXNDb250ZXh0dWFsKG5hbWUpKSB7IHJldHVybiBmYWxzZSB9XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgcmV0dXJuIHRydWVcbiAgfTtcblxuICAvLyBBc3NlcnRzIHRoYXQgZm9sbG93aW5nIHRva2VuIGlzIGdpdmVuIGNvbnRleHR1YWwga2V5d29yZC5cblxuICBwcCQ5LmV4cGVjdENvbnRleHR1YWwgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgaWYgKCF0aGlzLmVhdENvbnRleHR1YWwobmFtZSkpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgfTtcblxuICAvLyBUZXN0IHdoZXRoZXIgYSBzZW1pY29sb24gY2FuIGJlIGluc2VydGVkIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuXG4gIHBwJDkuY2FuSW5zZXJ0U2VtaWNvbG9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5lb2YgfHxcbiAgICAgIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5icmFjZVIgfHxcbiAgICAgIGxpbmVCcmVhay50ZXN0KHRoaXMuaW5wdXQuc2xpY2UodGhpcy5sYXN0VG9rRW5kLCB0aGlzLnN0YXJ0KSlcbiAgfTtcblxuICBwcCQ5Lmluc2VydFNlbWljb2xvbiA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLmNhbkluc2VydFNlbWljb2xvbigpKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLm9uSW5zZXJ0ZWRTZW1pY29sb24pXG4gICAgICAgIHsgdGhpcy5vcHRpb25zLm9uSW5zZXJ0ZWRTZW1pY29sb24odGhpcy5sYXN0VG9rRW5kLCB0aGlzLmxhc3RUb2tFbmRMb2MpOyB9XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfTtcblxuICAvLyBDb25zdW1lIGEgc2VtaWNvbG9uLCBvciwgZmFpbGluZyB0aGF0LCBzZWUgaWYgd2UgYXJlIGFsbG93ZWQgdG9cbiAgLy8gcHJldGVuZCB0aGF0IHRoZXJlIGlzIGEgc2VtaWNvbG9uIGF0IHRoaXMgcG9zaXRpb24uXG5cbiAgcHAkOS5zZW1pY29sb24gPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuZWF0KHR5cGVzJDEuc2VtaSkgJiYgIXRoaXMuaW5zZXJ0U2VtaWNvbG9uKCkpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgfTtcblxuICBwcCQ5LmFmdGVyVHJhaWxpbmdDb21tYSA9IGZ1bmN0aW9uKHRva1R5cGUsIG5vdE5leHQpIHtcbiAgICBpZiAodGhpcy50eXBlID09PSB0b2tUeXBlKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLm9uVHJhaWxpbmdDb21tYSlcbiAgICAgICAgeyB0aGlzLm9wdGlvbnMub25UcmFpbGluZ0NvbW1hKHRoaXMubGFzdFRva1N0YXJ0LCB0aGlzLmxhc3RUb2tTdGFydExvYyk7IH1cbiAgICAgIGlmICghbm90TmV4dClcbiAgICAgICAgeyB0aGlzLm5leHQoKTsgfVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH07XG5cbiAgLy8gRXhwZWN0IGEgdG9rZW4gb2YgYSBnaXZlbiB0eXBlLiBJZiBmb3VuZCwgY29uc3VtZSBpdCwgb3RoZXJ3aXNlLFxuICAvLyByYWlzZSBhbiB1bmV4cGVjdGVkIHRva2VuIGVycm9yLlxuXG4gIHBwJDkuZXhwZWN0ID0gZnVuY3Rpb24odHlwZSkge1xuICAgIHRoaXMuZWF0KHR5cGUpIHx8IHRoaXMudW5leHBlY3RlZCgpO1xuICB9O1xuXG4gIC8vIFJhaXNlIGFuIHVuZXhwZWN0ZWQgdG9rZW4gZXJyb3IuXG5cbiAgcHAkOS51bmV4cGVjdGVkID0gZnVuY3Rpb24ocG9zKSB7XG4gICAgdGhpcy5yYWlzZShwb3MgIT0gbnVsbCA/IHBvcyA6IHRoaXMuc3RhcnQsIFwiVW5leHBlY3RlZCB0b2tlblwiKTtcbiAgfTtcblxuICB2YXIgRGVzdHJ1Y3R1cmluZ0Vycm9ycyA9IGZ1bmN0aW9uIERlc3RydWN0dXJpbmdFcnJvcnMoKSB7XG4gICAgdGhpcy5zaG9ydGhhbmRBc3NpZ24gPVxuICAgIHRoaXMudHJhaWxpbmdDb21tYSA9XG4gICAgdGhpcy5wYXJlbnRoZXNpemVkQXNzaWduID1cbiAgICB0aGlzLnBhcmVudGhlc2l6ZWRCaW5kID1cbiAgICB0aGlzLmRvdWJsZVByb3RvID1cbiAgICAgIC0xO1xuICB9O1xuXG4gIHBwJDkuY2hlY2tQYXR0ZXJuRXJyb3JzID0gZnVuY3Rpb24ocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgaXNBc3NpZ24pIHtcbiAgICBpZiAoIXJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHsgcmV0dXJuIH1cbiAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy50cmFpbGluZ0NvbW1hID4gLTEpXG4gICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnRyYWlsaW5nQ29tbWEsIFwiQ29tbWEgaXMgbm90IHBlcm1pdHRlZCBhZnRlciB0aGUgcmVzdCBlbGVtZW50XCIpOyB9XG4gICAgdmFyIHBhcmVucyA9IGlzQXNzaWduID8gcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQXNzaWduIDogcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQmluZDtcbiAgICBpZiAocGFyZW5zID4gLTEpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHBhcmVucywgaXNBc3NpZ24gPyBcIkFzc2lnbmluZyB0byBydmFsdWVcIiA6IFwiUGFyZW50aGVzaXplZCBwYXR0ZXJuXCIpOyB9XG4gIH07XG5cbiAgcHAkOS5jaGVja0V4cHJlc3Npb25FcnJvcnMgPSBmdW5jdGlvbihyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCBhbmRUaHJvdykge1xuICAgIGlmICghcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykgeyByZXR1cm4gZmFsc2UgfVxuICAgIHZhciBzaG9ydGhhbmRBc3NpZ24gPSByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnNob3J0aGFuZEFzc2lnbjtcbiAgICB2YXIgZG91YmxlUHJvdG8gPSByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLmRvdWJsZVByb3RvO1xuICAgIGlmICghYW5kVGhyb3cpIHsgcmV0dXJuIHNob3J0aGFuZEFzc2lnbiA+PSAwIHx8IGRvdWJsZVByb3RvID49IDAgfVxuICAgIGlmIChzaG9ydGhhbmRBc3NpZ24gPj0gMClcbiAgICAgIHsgdGhpcy5yYWlzZShzaG9ydGhhbmRBc3NpZ24sIFwiU2hvcnRoYW5kIHByb3BlcnR5IGFzc2lnbm1lbnRzIGFyZSB2YWxpZCBvbmx5IGluIGRlc3RydWN0dXJpbmcgcGF0dGVybnNcIik7IH1cbiAgICBpZiAoZG91YmxlUHJvdG8gPj0gMClcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKGRvdWJsZVByb3RvLCBcIlJlZGVmaW5pdGlvbiBvZiBfX3Byb3RvX18gcHJvcGVydHlcIik7IH1cbiAgfTtcblxuICBwcCQ5LmNoZWNrWWllbGRBd2FpdEluRGVmYXVsdFBhcmFtcyA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLnlpZWxkUG9zICYmICghdGhpcy5hd2FpdFBvcyB8fCB0aGlzLnlpZWxkUG9zIDwgdGhpcy5hd2FpdFBvcykpXG4gICAgICB7IHRoaXMucmFpc2UodGhpcy55aWVsZFBvcywgXCJZaWVsZCBleHByZXNzaW9uIGNhbm5vdCBiZSBhIGRlZmF1bHQgdmFsdWVcIik7IH1cbiAgICBpZiAodGhpcy5hd2FpdFBvcylcbiAgICAgIHsgdGhpcy5yYWlzZSh0aGlzLmF3YWl0UG9zLCBcIkF3YWl0IGV4cHJlc3Npb24gY2Fubm90IGJlIGEgZGVmYXVsdCB2YWx1ZVwiKTsgfVxuICB9O1xuXG4gIHBwJDkuaXNTaW1wbGVBc3NpZ25UYXJnZXQgPSBmdW5jdGlvbihleHByKSB7XG4gICAgaWYgKGV4cHIudHlwZSA9PT0gXCJQYXJlbnRoZXNpemVkRXhwcmVzc2lvblwiKVxuICAgICAgeyByZXR1cm4gdGhpcy5pc1NpbXBsZUFzc2lnblRhcmdldChleHByLmV4cHJlc3Npb24pIH1cbiAgICByZXR1cm4gZXhwci50eXBlID09PSBcIklkZW50aWZpZXJcIiB8fCBleHByLnR5cGUgPT09IFwiTWVtYmVyRXhwcmVzc2lvblwiXG4gIH07XG5cbiAgdmFyIHBwJDggPSBQYXJzZXIucHJvdG90eXBlO1xuXG4gIC8vICMjIyBTdGF0ZW1lbnQgcGFyc2luZ1xuXG4gIC8vIFBhcnNlIGEgcHJvZ3JhbS4gSW5pdGlhbGl6ZXMgdGhlIHBhcnNlciwgcmVhZHMgYW55IG51bWJlciBvZlxuICAvLyBzdGF0ZW1lbnRzLCBhbmQgd3JhcHMgdGhlbSBpbiBhIFByb2dyYW0gbm9kZS4gIE9wdGlvbmFsbHkgdGFrZXMgYVxuICAvLyBgcHJvZ3JhbWAgYXJndW1lbnQuICBJZiBwcmVzZW50LCB0aGUgc3RhdGVtZW50cyB3aWxsIGJlIGFwcGVuZGVkXG4gIC8vIHRvIGl0cyBib2R5IGluc3RlYWQgb2YgY3JlYXRpbmcgYSBuZXcgbm9kZS5cblxuICBwcCQ4LnBhcnNlVG9wTGV2ZWwgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIGV4cG9ydHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGlmICghbm9kZS5ib2R5KSB7IG5vZGUuYm9keSA9IFtdOyB9XG4gICAgd2hpbGUgKHRoaXMudHlwZSAhPT0gdHlwZXMkMS5lb2YpIHtcbiAgICAgIHZhciBzdG10ID0gdGhpcy5wYXJzZVN0YXRlbWVudChudWxsLCB0cnVlLCBleHBvcnRzKTtcbiAgICAgIG5vZGUuYm9keS5wdXNoKHN0bXQpO1xuICAgIH1cbiAgICBpZiAodGhpcy5pbk1vZHVsZSlcbiAgICAgIHsgZm9yICh2YXIgaSA9IDAsIGxpc3QgPSBPYmplY3Qua2V5cyh0aGlzLnVuZGVmaW5lZEV4cG9ydHMpOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gMSlcbiAgICAgICAge1xuICAgICAgICAgIHZhciBuYW1lID0gbGlzdFtpXTtcblxuICAgICAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZSh0aGlzLnVuZGVmaW5lZEV4cG9ydHNbbmFtZV0uc3RhcnQsIChcIkV4cG9ydCAnXCIgKyBuYW1lICsgXCInIGlzIG5vdCBkZWZpbmVkXCIpKTtcbiAgICAgICAgfSB9XG4gICAgdGhpcy5hZGFwdERpcmVjdGl2ZVByb2xvZ3VlKG5vZGUuYm9keSk7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgbm9kZS5zb3VyY2VUeXBlID0gdGhpcy5vcHRpb25zLnNvdXJjZVR5cGU7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlByb2dyYW1cIilcbiAgfTtcblxuICB2YXIgbG9vcExhYmVsID0ge2tpbmQ6IFwibG9vcFwifSwgc3dpdGNoTGFiZWwgPSB7a2luZDogXCJzd2l0Y2hcIn07XG5cbiAgcHAkOC5pc0xldCA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uIDwgNiB8fCAhdGhpcy5pc0NvbnRleHR1YWwoXCJsZXRcIikpIHsgcmV0dXJuIGZhbHNlIH1cbiAgICBza2lwV2hpdGVTcGFjZS5sYXN0SW5kZXggPSB0aGlzLnBvcztcbiAgICB2YXIgc2tpcCA9IHNraXBXaGl0ZVNwYWNlLmV4ZWModGhpcy5pbnB1dCk7XG4gICAgdmFyIG5leHQgPSB0aGlzLnBvcyArIHNraXBbMF0ubGVuZ3RoLCBuZXh0Q2ggPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQobmV4dCk7XG4gICAgLy8gRm9yIGFtYmlndW91cyBjYXNlcywgZGV0ZXJtaW5lIGlmIGEgTGV4aWNhbERlY2xhcmF0aW9uIChvciBvbmx5IGFcbiAgICAvLyBTdGF0ZW1lbnQpIGlzIGFsbG93ZWQgaGVyZS4gSWYgY29udGV4dCBpcyBub3QgZW1wdHkgdGhlbiBvbmx5IGEgU3RhdGVtZW50XG4gICAgLy8gaXMgYWxsb3dlZC4gSG93ZXZlciwgYGxldCBbYCBpcyBhbiBleHBsaWNpdCBuZWdhdGl2ZSBsb29rYWhlYWQgZm9yXG4gICAgLy8gRXhwcmVzc2lvblN0YXRlbWVudCwgc28gc3BlY2lhbC1jYXNlIGl0IGZpcnN0LlxuICAgIGlmIChuZXh0Q2ggPT09IDkxIHx8IG5leHRDaCA9PT0gOTIpIHsgcmV0dXJuIHRydWUgfSAvLyAnWycsICcvJ1xuICAgIGlmIChjb250ZXh0KSB7IHJldHVybiBmYWxzZSB9XG5cbiAgICBpZiAobmV4dENoID09PSAxMjMgfHwgbmV4dENoID4gMHhkN2ZmICYmIG5leHRDaCA8IDB4ZGMwMCkgeyByZXR1cm4gdHJ1ZSB9IC8vICd7JywgYXN0cmFsXG4gICAgaWYgKGlzSWRlbnRpZmllclN0YXJ0KG5leHRDaCwgdHJ1ZSkpIHtcbiAgICAgIHZhciBwb3MgPSBuZXh0ICsgMTtcbiAgICAgIHdoaWxlIChpc0lkZW50aWZpZXJDaGFyKG5leHRDaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdChwb3MpLCB0cnVlKSkgeyArK3BvczsgfVxuICAgICAgaWYgKG5leHRDaCA9PT0gOTIgfHwgbmV4dENoID4gMHhkN2ZmICYmIG5leHRDaCA8IDB4ZGMwMCkgeyByZXR1cm4gdHJ1ZSB9XG4gICAgICB2YXIgaWRlbnQgPSB0aGlzLmlucHV0LnNsaWNlKG5leHQsIHBvcyk7XG4gICAgICBpZiAoIWtleXdvcmRSZWxhdGlvbmFsT3BlcmF0b3IudGVzdChpZGVudCkpIHsgcmV0dXJuIHRydWUgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBjaGVjayAnYXN5bmMgW25vIExpbmVUZXJtaW5hdG9yIGhlcmVdIGZ1bmN0aW9uJ1xuICAvLyAtICdhc3luYyAvKmZvbyovIGZ1bmN0aW9uJyBpcyBPSy5cbiAgLy8gLSAnYXN5bmMgLypcXG4qLyBmdW5jdGlvbicgaXMgaW52YWxpZC5cbiAgcHAkOC5pc0FzeW5jRnVuY3Rpb24gPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uIDwgOCB8fCAhdGhpcy5pc0NvbnRleHR1YWwoXCJhc3luY1wiKSlcbiAgICAgIHsgcmV0dXJuIGZhbHNlIH1cblxuICAgIHNraXBXaGl0ZVNwYWNlLmxhc3RJbmRleCA9IHRoaXMucG9zO1xuICAgIHZhciBza2lwID0gc2tpcFdoaXRlU3BhY2UuZXhlYyh0aGlzLmlucHV0KTtcbiAgICB2YXIgbmV4dCA9IHRoaXMucG9zICsgc2tpcFswXS5sZW5ndGgsIGFmdGVyO1xuICAgIHJldHVybiAhbGluZUJyZWFrLnRlc3QodGhpcy5pbnB1dC5zbGljZSh0aGlzLnBvcywgbmV4dCkpICYmXG4gICAgICB0aGlzLmlucHV0LnNsaWNlKG5leHQsIG5leHQgKyA4KSA9PT0gXCJmdW5jdGlvblwiICYmXG4gICAgICAobmV4dCArIDggPT09IHRoaXMuaW5wdXQubGVuZ3RoIHx8XG4gICAgICAgIShpc0lkZW50aWZpZXJDaGFyKGFmdGVyID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KG5leHQgKyA4KSkgfHwgYWZ0ZXIgPiAweGQ3ZmYgJiYgYWZ0ZXIgPCAweGRjMDApKVxuICB9O1xuXG4gIC8vIFBhcnNlIGEgc2luZ2xlIHN0YXRlbWVudC5cbiAgLy9cbiAgLy8gSWYgZXhwZWN0aW5nIGEgc3RhdGVtZW50IGFuZCBmaW5kaW5nIGEgc2xhc2ggb3BlcmF0b3IsIHBhcnNlIGFcbiAgLy8gcmVndWxhciBleHByZXNzaW9uIGxpdGVyYWwuIFRoaXMgaXMgdG8gaGFuZGxlIGNhc2VzIGxpa2VcbiAgLy8gYGlmIChmb28pIC9ibGFoLy5leGVjKGZvbylgLCB3aGVyZSBsb29raW5nIGF0IHRoZSBwcmV2aW91cyB0b2tlblxuICAvLyBkb2VzIG5vdCBoZWxwLlxuXG4gIHBwJDgucGFyc2VTdGF0ZW1lbnQgPSBmdW5jdGlvbihjb250ZXh0LCB0b3BMZXZlbCwgZXhwb3J0cykge1xuICAgIHZhciBzdGFydHR5cGUgPSB0aGlzLnR5cGUsIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpLCBraW5kO1xuXG4gICAgaWYgKHRoaXMuaXNMZXQoY29udGV4dCkpIHtcbiAgICAgIHN0YXJ0dHlwZSA9IHR5cGVzJDEuX3ZhcjtcbiAgICAgIGtpbmQgPSBcImxldFwiO1xuICAgIH1cblxuICAgIC8vIE1vc3QgdHlwZXMgb2Ygc3RhdGVtZW50cyBhcmUgcmVjb2duaXplZCBieSB0aGUga2V5d29yZCB0aGV5XG4gICAgLy8gc3RhcnQgd2l0aC4gTWFueSBhcmUgdHJpdmlhbCB0byBwYXJzZSwgc29tZSByZXF1aXJlIGEgYml0IG9mXG4gICAgLy8gY29tcGxleGl0eS5cblxuICAgIHN3aXRjaCAoc3RhcnR0eXBlKSB7XG4gICAgY2FzZSB0eXBlcyQxLl9icmVhazogY2FzZSB0eXBlcyQxLl9jb250aW51ZTogcmV0dXJuIHRoaXMucGFyc2VCcmVha0NvbnRpbnVlU3RhdGVtZW50KG5vZGUsIHN0YXJ0dHlwZS5rZXl3b3JkKVxuICAgIGNhc2UgdHlwZXMkMS5fZGVidWdnZXI6IHJldHVybiB0aGlzLnBhcnNlRGVidWdnZXJTdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX2RvOiByZXR1cm4gdGhpcy5wYXJzZURvU3RhdGVtZW50KG5vZGUpXG4gICAgY2FzZSB0eXBlcyQxLl9mb3I6IHJldHVybiB0aGlzLnBhcnNlRm9yU3RhdGVtZW50KG5vZGUpXG4gICAgY2FzZSB0eXBlcyQxLl9mdW5jdGlvbjpcbiAgICAgIC8vIEZ1bmN0aW9uIGFzIHNvbGUgYm9keSBvZiBlaXRoZXIgYW4gaWYgc3RhdGVtZW50IG9yIGEgbGFiZWxlZCBzdGF0ZW1lbnRcbiAgICAgIC8vIHdvcmtzLCBidXQgbm90IHdoZW4gaXQgaXMgcGFydCBvZiBhIGxhYmVsZWQgc3RhdGVtZW50IHRoYXQgaXMgdGhlIHNvbGVcbiAgICAgIC8vIGJvZHkgb2YgYW4gaWYgc3RhdGVtZW50LlxuICAgICAgaWYgKChjb250ZXh0ICYmICh0aGlzLnN0cmljdCB8fCBjb250ZXh0ICE9PSBcImlmXCIgJiYgY29udGV4dCAhPT0gXCJsYWJlbFwiKSkgJiYgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgIHJldHVybiB0aGlzLnBhcnNlRnVuY3Rpb25TdGF0ZW1lbnQobm9kZSwgZmFsc2UsICFjb250ZXh0KVxuICAgIGNhc2UgdHlwZXMkMS5fY2xhc3M6XG4gICAgICBpZiAoY29udGV4dCkgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgICAgcmV0dXJuIHRoaXMucGFyc2VDbGFzcyhub2RlLCB0cnVlKVxuICAgIGNhc2UgdHlwZXMkMS5faWY6IHJldHVybiB0aGlzLnBhcnNlSWZTdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX3JldHVybjogcmV0dXJuIHRoaXMucGFyc2VSZXR1cm5TdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX3N3aXRjaDogcmV0dXJuIHRoaXMucGFyc2VTd2l0Y2hTdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX3Rocm93OiByZXR1cm4gdGhpcy5wYXJzZVRocm93U3RhdGVtZW50KG5vZGUpXG4gICAgY2FzZSB0eXBlcyQxLl90cnk6IHJldHVybiB0aGlzLnBhcnNlVHJ5U3RhdGVtZW50KG5vZGUpXG4gICAgY2FzZSB0eXBlcyQxLl9jb25zdDogY2FzZSB0eXBlcyQxLl92YXI6XG4gICAgICBraW5kID0ga2luZCB8fCB0aGlzLnZhbHVlO1xuICAgICAgaWYgKGNvbnRleHQgJiYga2luZCAhPT0gXCJ2YXJcIikgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgICAgcmV0dXJuIHRoaXMucGFyc2VWYXJTdGF0ZW1lbnQobm9kZSwga2luZClcbiAgICBjYXNlIHR5cGVzJDEuX3doaWxlOiByZXR1cm4gdGhpcy5wYXJzZVdoaWxlU3RhdGVtZW50KG5vZGUpXG4gICAgY2FzZSB0eXBlcyQxLl93aXRoOiByZXR1cm4gdGhpcy5wYXJzZVdpdGhTdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuYnJhY2VMOiByZXR1cm4gdGhpcy5wYXJzZUJsb2NrKHRydWUsIG5vZGUpXG4gICAgY2FzZSB0eXBlcyQxLnNlbWk6IHJldHVybiB0aGlzLnBhcnNlRW1wdHlTdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX2V4cG9ydDpcbiAgICBjYXNlIHR5cGVzJDEuX2ltcG9ydDpcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPiAxMCAmJiBzdGFydHR5cGUgPT09IHR5cGVzJDEuX2ltcG9ydCkge1xuICAgICAgICBza2lwV2hpdGVTcGFjZS5sYXN0SW5kZXggPSB0aGlzLnBvcztcbiAgICAgICAgdmFyIHNraXAgPSBza2lwV2hpdGVTcGFjZS5leGVjKHRoaXMuaW5wdXQpO1xuICAgICAgICB2YXIgbmV4dCA9IHRoaXMucG9zICsgc2tpcFswXS5sZW5ndGgsIG5leHRDaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdChuZXh0KTtcbiAgICAgICAgaWYgKG5leHRDaCA9PT0gNDAgfHwgbmV4dENoID09PSA0NikgLy8gJygnIG9yICcuJ1xuICAgICAgICAgIHsgcmV0dXJuIHRoaXMucGFyc2VFeHByZXNzaW9uU3RhdGVtZW50KG5vZGUsIHRoaXMucGFyc2VFeHByZXNzaW9uKCkpIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYWxsb3dJbXBvcnRFeHBvcnRFdmVyeXdoZXJlKSB7XG4gICAgICAgIGlmICghdG9wTGV2ZWwpXG4gICAgICAgICAgeyB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsIFwiJ2ltcG9ydCcgYW5kICdleHBvcnQnIG1heSBvbmx5IGFwcGVhciBhdCB0aGUgdG9wIGxldmVsXCIpOyB9XG4gICAgICAgIGlmICghdGhpcy5pbk1vZHVsZSlcbiAgICAgICAgICB7IHRoaXMucmFpc2UodGhpcy5zdGFydCwgXCInaW1wb3J0JyBhbmQgJ2V4cG9ydCcgbWF5IGFwcGVhciBvbmx5IHdpdGggJ3NvdXJjZVR5cGU6IG1vZHVsZSdcIik7IH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBzdGFydHR5cGUgPT09IHR5cGVzJDEuX2ltcG9ydCA/IHRoaXMucGFyc2VJbXBvcnQobm9kZSkgOiB0aGlzLnBhcnNlRXhwb3J0KG5vZGUsIGV4cG9ydHMpXG5cbiAgICAgIC8vIElmIHRoZSBzdGF0ZW1lbnQgZG9lcyBub3Qgc3RhcnQgd2l0aCBhIHN0YXRlbWVudCBrZXl3b3JkIG9yIGFcbiAgICAgIC8vIGJyYWNlLCBpdCdzIGFuIEV4cHJlc3Npb25TdGF0ZW1lbnQgb3IgTGFiZWxlZFN0YXRlbWVudC4gV2VcbiAgICAgIC8vIHNpbXBseSBzdGFydCBwYXJzaW5nIGFuIGV4cHJlc3Npb24sIGFuZCBhZnRlcndhcmRzLCBpZiB0aGVcbiAgICAgIC8vIG5leHQgdG9rZW4gaXMgYSBjb2xvbiBhbmQgdGhlIGV4cHJlc3Npb24gd2FzIGEgc2ltcGxlXG4gICAgICAvLyBJZGVudGlmaWVyIG5vZGUsIHdlIHN3aXRjaCB0byBpbnRlcnByZXRpbmcgaXQgYXMgYSBsYWJlbC5cbiAgICBkZWZhdWx0OlxuICAgICAgaWYgKHRoaXMuaXNBc3luY0Z1bmN0aW9uKCkpIHtcbiAgICAgICAgaWYgKGNvbnRleHQpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlRnVuY3Rpb25TdGF0ZW1lbnQobm9kZSwgdHJ1ZSwgIWNvbnRleHQpXG4gICAgICB9XG5cbiAgICAgIHZhciBtYXliZU5hbWUgPSB0aGlzLnZhbHVlLCBleHByID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICAgIGlmIChzdGFydHR5cGUgPT09IHR5cGVzJDEubmFtZSAmJiBleHByLnR5cGUgPT09IFwiSWRlbnRpZmllclwiICYmIHRoaXMuZWF0KHR5cGVzJDEuY29sb24pKVxuICAgICAgICB7IHJldHVybiB0aGlzLnBhcnNlTGFiZWxlZFN0YXRlbWVudChub2RlLCBtYXliZU5hbWUsIGV4cHIsIGNvbnRleHQpIH1cbiAgICAgIGVsc2UgeyByZXR1cm4gdGhpcy5wYXJzZUV4cHJlc3Npb25TdGF0ZW1lbnQobm9kZSwgZXhwcikgfVxuICAgIH1cbiAgfTtcblxuICBwcCQ4LnBhcnNlQnJlYWtDb250aW51ZVN0YXRlbWVudCA9IGZ1bmN0aW9uKG5vZGUsIGtleXdvcmQpIHtcbiAgICB2YXIgaXNCcmVhayA9IGtleXdvcmQgPT09IFwiYnJlYWtcIjtcbiAgICB0aGlzLm5leHQoKTtcbiAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5zZW1pKSB8fCB0aGlzLmluc2VydFNlbWljb2xvbigpKSB7IG5vZGUubGFiZWwgPSBudWxsOyB9XG4gICAgZWxzZSBpZiAodGhpcy50eXBlICE9PSB0eXBlcyQxLm5hbWUpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICBlbHNlIHtcbiAgICAgIG5vZGUubGFiZWwgPSB0aGlzLnBhcnNlSWRlbnQoKTtcbiAgICAgIHRoaXMuc2VtaWNvbG9uKCk7XG4gICAgfVxuXG4gICAgLy8gVmVyaWZ5IHRoYXQgdGhlcmUgaXMgYW4gYWN0dWFsIGRlc3RpbmF0aW9uIHRvIGJyZWFrIG9yXG4gICAgLy8gY29udGludWUgdG8uXG4gICAgdmFyIGkgPSAwO1xuICAgIGZvciAoOyBpIDwgdGhpcy5sYWJlbHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBsYWIgPSB0aGlzLmxhYmVsc1tpXTtcbiAgICAgIGlmIChub2RlLmxhYmVsID09IG51bGwgfHwgbGFiLm5hbWUgPT09IG5vZGUubGFiZWwubmFtZSkge1xuICAgICAgICBpZiAobGFiLmtpbmQgIT0gbnVsbCAmJiAoaXNCcmVhayB8fCBsYWIua2luZCA9PT0gXCJsb29wXCIpKSB7IGJyZWFrIH1cbiAgICAgICAgaWYgKG5vZGUubGFiZWwgJiYgaXNCcmVhaykgeyBicmVhayB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChpID09PSB0aGlzLmxhYmVscy5sZW5ndGgpIHsgdGhpcy5yYWlzZShub2RlLnN0YXJ0LCBcIlVuc3ludGFjdGljIFwiICsga2V5d29yZCk7IH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIGlzQnJlYWsgPyBcIkJyZWFrU3RhdGVtZW50XCIgOiBcIkNvbnRpbnVlU3RhdGVtZW50XCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZURlYnVnZ2VyU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIHRoaXMuc2VtaWNvbG9uKCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkRlYnVnZ2VyU3RhdGVtZW50XCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZURvU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIHRoaXMubGFiZWxzLnB1c2gobG9vcExhYmVsKTtcbiAgICBub2RlLmJvZHkgPSB0aGlzLnBhcnNlU3RhdGVtZW50KFwiZG9cIik7XG4gICAgdGhpcy5sYWJlbHMucG9wKCk7XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5fd2hpbGUpO1xuICAgIG5vZGUudGVzdCA9IHRoaXMucGFyc2VQYXJlbkV4cHJlc3Npb24oKTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpXG4gICAgICB7IHRoaXMuZWF0KHR5cGVzJDEuc2VtaSk7IH1cbiAgICBlbHNlXG4gICAgICB7IHRoaXMuc2VtaWNvbG9uKCk7IH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiRG9XaGlsZVN0YXRlbWVudFwiKVxuICB9O1xuXG4gIC8vIERpc2FtYmlndWF0aW5nIGJldHdlZW4gYSBgZm9yYCBhbmQgYSBgZm9yYC9gaW5gIG9yIGBmb3JgL2BvZmBcbiAgLy8gbG9vcCBpcyBub24tdHJpdmlhbC4gQmFzaWNhbGx5LCB3ZSBoYXZlIHRvIHBhcnNlIHRoZSBpbml0IGB2YXJgXG4gIC8vIHN0YXRlbWVudCBvciBleHByZXNzaW9uLCBkaXNhbGxvd2luZyB0aGUgYGluYCBvcGVyYXRvciAoc2VlXG4gIC8vIHRoZSBzZWNvbmQgcGFyYW1ldGVyIHRvIGBwYXJzZUV4cHJlc3Npb25gKSwgYW5kIHRoZW4gY2hlY2tcbiAgLy8gd2hldGhlciB0aGUgbmV4dCB0b2tlbiBpcyBgaW5gIG9yIGBvZmAuIFdoZW4gdGhlcmUgaXMgbm8gaW5pdFxuICAvLyBwYXJ0IChzZW1pY29sb24gaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIG9wZW5pbmcgcGFyZW50aGVzaXMpLCBpdFxuICAvLyBpcyBhIHJlZ3VsYXIgYGZvcmAgbG9vcC5cblxuICBwcCQ4LnBhcnNlRm9yU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIHZhciBhd2FpdEF0ID0gKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5ICYmIHRoaXMuY2FuQXdhaXQgJiYgdGhpcy5lYXRDb250ZXh0dWFsKFwiYXdhaXRcIikpID8gdGhpcy5sYXN0VG9rU3RhcnQgOiAtMTtcbiAgICB0aGlzLmxhYmVscy5wdXNoKGxvb3BMYWJlbCk7XG4gICAgdGhpcy5lbnRlclNjb3BlKDApO1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEucGFyZW5MKTtcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnNlbWkpIHtcbiAgICAgIGlmIChhd2FpdEF0ID4gLTEpIHsgdGhpcy51bmV4cGVjdGVkKGF3YWl0QXQpOyB9XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUZvcihub2RlLCBudWxsKVxuICAgIH1cbiAgICB2YXIgaXNMZXQgPSB0aGlzLmlzTGV0KCk7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5fdmFyIHx8IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5fY29uc3QgfHwgaXNMZXQpIHtcbiAgICAgIHZhciBpbml0JDEgPSB0aGlzLnN0YXJ0Tm9kZSgpLCBraW5kID0gaXNMZXQgPyBcImxldFwiIDogdGhpcy52YWx1ZTtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgdGhpcy5wYXJzZVZhcihpbml0JDEsIHRydWUsIGtpbmQpO1xuICAgICAgdGhpcy5maW5pc2hOb2RlKGluaXQkMSwgXCJWYXJpYWJsZURlY2xhcmF0aW9uXCIpO1xuICAgICAgaWYgKCh0aGlzLnR5cGUgPT09IHR5cGVzJDEuX2luIHx8ICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNiAmJiB0aGlzLmlzQ29udGV4dHVhbChcIm9mXCIpKSkgJiYgaW5pdCQxLmRlY2xhcmF0aW9ucy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5KSB7XG4gICAgICAgICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5faW4pIHtcbiAgICAgICAgICAgIGlmIChhd2FpdEF0ID4gLTEpIHsgdGhpcy51bmV4cGVjdGVkKGF3YWl0QXQpOyB9XG4gICAgICAgICAgfSBlbHNlIHsgbm9kZS5hd2FpdCA9IGF3YWl0QXQgPiAtMTsgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlRm9ySW4obm9kZSwgaW5pdCQxKVxuICAgICAgfVxuICAgICAgaWYgKGF3YWl0QXQgPiAtMSkgeyB0aGlzLnVuZXhwZWN0ZWQoYXdhaXRBdCk7IH1cbiAgICAgIHJldHVybiB0aGlzLnBhcnNlRm9yKG5vZGUsIGluaXQkMSlcbiAgICB9XG4gICAgdmFyIHN0YXJ0c1dpdGhMZXQgPSB0aGlzLmlzQ29udGV4dHVhbChcImxldFwiKSwgaXNGb3JPZiA9IGZhbHNlO1xuICAgIHZhciByZWZEZXN0cnVjdHVyaW5nRXJyb3JzID0gbmV3IERlc3RydWN0dXJpbmdFcnJvcnM7XG4gICAgdmFyIGluaXQgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbihhd2FpdEF0ID4gLTEgPyBcImF3YWl0XCIgOiB0cnVlLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTtcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLl9pbiB8fCAoaXNGb3JPZiA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ICYmIHRoaXMuaXNDb250ZXh0dWFsKFwib2ZcIikpKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkpIHtcbiAgICAgICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5faW4pIHtcbiAgICAgICAgICBpZiAoYXdhaXRBdCA+IC0xKSB7IHRoaXMudW5leHBlY3RlZChhd2FpdEF0KTsgfVxuICAgICAgICB9IGVsc2UgeyBub2RlLmF3YWl0ID0gYXdhaXRBdCA+IC0xOyB9XG4gICAgICB9XG4gICAgICBpZiAoc3RhcnRzV2l0aExldCAmJiBpc0Zvck9mKSB7IHRoaXMucmFpc2UoaW5pdC5zdGFydCwgXCJUaGUgbGVmdC1oYW5kIHNpZGUgb2YgYSBmb3Itb2YgbG9vcCBtYXkgbm90IHN0YXJ0IHdpdGggJ2xldCcuXCIpOyB9XG4gICAgICB0aGlzLnRvQXNzaWduYWJsZShpbml0LCBmYWxzZSwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgICB0aGlzLmNoZWNrTFZhbFBhdHRlcm4oaW5pdCk7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUZvckluKG5vZGUsIGluaXQpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY2hlY2tFeHByZXNzaW9uRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIHRydWUpO1xuICAgIH1cbiAgICBpZiAoYXdhaXRBdCA+IC0xKSB7IHRoaXMudW5leHBlY3RlZChhd2FpdEF0KTsgfVxuICAgIHJldHVybiB0aGlzLnBhcnNlRm9yKG5vZGUsIGluaXQpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUZ1bmN0aW9uU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSwgaXNBc3luYywgZGVjbGFyYXRpb25Qb3NpdGlvbikge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIHJldHVybiB0aGlzLnBhcnNlRnVuY3Rpb24obm9kZSwgRlVOQ19TVEFURU1FTlQgfCAoZGVjbGFyYXRpb25Qb3NpdGlvbiA/IDAgOiBGVU5DX0hBTkdJTkdfU1RBVEVNRU5UKSwgZmFsc2UsIGlzQXN5bmMpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUlmU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIG5vZGUudGVzdCA9IHRoaXMucGFyc2VQYXJlbkV4cHJlc3Npb24oKTtcbiAgICAvLyBhbGxvdyBmdW5jdGlvbiBkZWNsYXJhdGlvbnMgaW4gYnJhbmNoZXMsIGJ1dCBvbmx5IGluIG5vbi1zdHJpY3QgbW9kZVxuICAgIG5vZGUuY29uc2VxdWVudCA9IHRoaXMucGFyc2VTdGF0ZW1lbnQoXCJpZlwiKTtcbiAgICBub2RlLmFsdGVybmF0ZSA9IHRoaXMuZWF0KHR5cGVzJDEuX2Vsc2UpID8gdGhpcy5wYXJzZVN0YXRlbWVudChcImlmXCIpIDogbnVsbDtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiSWZTdGF0ZW1lbnRcIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlUmV0dXJuU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIGlmICghdGhpcy5pbkZ1bmN0aW9uICYmICF0aGlzLm9wdGlvbnMuYWxsb3dSZXR1cm5PdXRzaWRlRnVuY3Rpb24pXG4gICAgICB7IHRoaXMucmFpc2UodGhpcy5zdGFydCwgXCIncmV0dXJuJyBvdXRzaWRlIG9mIGZ1bmN0aW9uXCIpOyB9XG4gICAgdGhpcy5uZXh0KCk7XG5cbiAgICAvLyBJbiBgcmV0dXJuYCAoYW5kIGBicmVha2AvYGNvbnRpbnVlYCksIHRoZSBrZXl3b3JkcyB3aXRoXG4gICAgLy8gb3B0aW9uYWwgYXJndW1lbnRzLCB3ZSBlYWdlcmx5IGxvb2sgZm9yIGEgc2VtaWNvbG9uIG9yIHRoZVxuICAgIC8vIHBvc3NpYmlsaXR5IHRvIGluc2VydCBvbmUuXG5cbiAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5zZW1pKSB8fCB0aGlzLmluc2VydFNlbWljb2xvbigpKSB7IG5vZGUuYXJndW1lbnQgPSBudWxsOyB9XG4gICAgZWxzZSB7IG5vZGUuYXJndW1lbnQgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpOyB0aGlzLnNlbWljb2xvbigpOyB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlJldHVyblN0YXRlbWVudFwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VTd2l0Y2hTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgbm9kZS5kaXNjcmltaW5hbnQgPSB0aGlzLnBhcnNlUGFyZW5FeHByZXNzaW9uKCk7XG4gICAgbm9kZS5jYXNlcyA9IFtdO1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuYnJhY2VMKTtcbiAgICB0aGlzLmxhYmVscy5wdXNoKHN3aXRjaExhYmVsKTtcbiAgICB0aGlzLmVudGVyU2NvcGUoMCk7XG5cbiAgICAvLyBTdGF0ZW1lbnRzIHVuZGVyIG11c3QgYmUgZ3JvdXBlZCAoYnkgbGFiZWwpIGluIFN3aXRjaENhc2VcbiAgICAvLyBub2Rlcy4gYGN1cmAgaXMgdXNlZCB0byBrZWVwIHRoZSBub2RlIHRoYXQgd2UgYXJlIGN1cnJlbnRseVxuICAgIC8vIGFkZGluZyBzdGF0ZW1lbnRzIHRvLlxuXG4gICAgdmFyIGN1cjtcbiAgICBmb3IgKHZhciBzYXdEZWZhdWx0ID0gZmFsc2U7IHRoaXMudHlwZSAhPT0gdHlwZXMkMS5icmFjZVI7KSB7XG4gICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLl9jYXNlIHx8IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5fZGVmYXVsdCkge1xuICAgICAgICB2YXIgaXNDYXNlID0gdGhpcy50eXBlID09PSB0eXBlcyQxLl9jYXNlO1xuICAgICAgICBpZiAoY3VyKSB7IHRoaXMuZmluaXNoTm9kZShjdXIsIFwiU3dpdGNoQ2FzZVwiKTsgfVxuICAgICAgICBub2RlLmNhc2VzLnB1c2goY3VyID0gdGhpcy5zdGFydE5vZGUoKSk7XG4gICAgICAgIGN1ci5jb25zZXF1ZW50ID0gW107XG4gICAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgICBpZiAoaXNDYXNlKSB7XG4gICAgICAgICAgY3VyLnRlc3QgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChzYXdEZWZhdWx0KSB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZSh0aGlzLmxhc3RUb2tTdGFydCwgXCJNdWx0aXBsZSBkZWZhdWx0IGNsYXVzZXNcIik7IH1cbiAgICAgICAgICBzYXdEZWZhdWx0ID0gdHJ1ZTtcbiAgICAgICAgICBjdXIudGVzdCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5leHBlY3QodHlwZXMkMS5jb2xvbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIWN1cikgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgICAgICBjdXIuY29uc2VxdWVudC5wdXNoKHRoaXMucGFyc2VTdGF0ZW1lbnQobnVsbCkpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmV4aXRTY29wZSgpO1xuICAgIGlmIChjdXIpIHsgdGhpcy5maW5pc2hOb2RlKGN1ciwgXCJTd2l0Y2hDYXNlXCIpOyB9XG4gICAgdGhpcy5uZXh0KCk7IC8vIENsb3NpbmcgYnJhY2VcbiAgICB0aGlzLmxhYmVscy5wb3AoKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiU3dpdGNoU3RhdGVtZW50XCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZVRocm93U3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIGlmIChsaW5lQnJlYWsudGVzdCh0aGlzLmlucHV0LnNsaWNlKHRoaXMubGFzdFRva0VuZCwgdGhpcy5zdGFydCkpKVxuICAgICAgeyB0aGlzLnJhaXNlKHRoaXMubGFzdFRva0VuZCwgXCJJbGxlZ2FsIG5ld2xpbmUgYWZ0ZXIgdGhyb3dcIik7IH1cbiAgICBub2RlLmFyZ3VtZW50ID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICB0aGlzLnNlbWljb2xvbigpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJUaHJvd1N0YXRlbWVudFwiKVxuICB9O1xuXG4gIC8vIFJldXNlZCBlbXB0eSBhcnJheSBhZGRlZCBmb3Igbm9kZSBmaWVsZHMgdGhhdCBhcmUgYWx3YXlzIGVtcHR5LlxuXG4gIHZhciBlbXB0eSQxID0gW107XG5cbiAgcHAkOC5wYXJzZUNhdGNoQ2xhdXNlUGFyYW0gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcGFyYW0gPSB0aGlzLnBhcnNlQmluZGluZ0F0b20oKTtcbiAgICB2YXIgc2ltcGxlID0gcGFyYW0udHlwZSA9PT0gXCJJZGVudGlmaWVyXCI7XG4gICAgdGhpcy5lbnRlclNjb3BlKHNpbXBsZSA/IFNDT1BFX1NJTVBMRV9DQVRDSCA6IDApO1xuICAgIHRoaXMuY2hlY2tMVmFsUGF0dGVybihwYXJhbSwgc2ltcGxlID8gQklORF9TSU1QTEVfQ0FUQ0ggOiBCSU5EX0xFWElDQUwpO1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEucGFyZW5SKTtcblxuICAgIHJldHVybiBwYXJhbVxuICB9O1xuXG4gIHBwJDgucGFyc2VUcnlTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgbm9kZS5ibG9jayA9IHRoaXMucGFyc2VCbG9jaygpO1xuICAgIG5vZGUuaGFuZGxlciA9IG51bGw7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5fY2F0Y2gpIHtcbiAgICAgIHZhciBjbGF1c2UgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5wYXJlbkwpKSB7XG4gICAgICAgIGNsYXVzZS5wYXJhbSA9IHRoaXMucGFyc2VDYXRjaENsYXVzZVBhcmFtKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uIDwgMTApIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgICAgY2xhdXNlLnBhcmFtID0gbnVsbDtcbiAgICAgICAgdGhpcy5lbnRlclNjb3BlKDApO1xuICAgICAgfVxuICAgICAgY2xhdXNlLmJvZHkgPSB0aGlzLnBhcnNlQmxvY2soZmFsc2UpO1xuICAgICAgdGhpcy5leGl0U2NvcGUoKTtcbiAgICAgIG5vZGUuaGFuZGxlciA9IHRoaXMuZmluaXNoTm9kZShjbGF1c2UsIFwiQ2F0Y2hDbGF1c2VcIik7XG4gICAgfVxuICAgIG5vZGUuZmluYWxpemVyID0gdGhpcy5lYXQodHlwZXMkMS5fZmluYWxseSkgPyB0aGlzLnBhcnNlQmxvY2soKSA6IG51bGw7XG4gICAgaWYgKCFub2RlLmhhbmRsZXIgJiYgIW5vZGUuZmluYWxpemVyKVxuICAgICAgeyB0aGlzLnJhaXNlKG5vZGUuc3RhcnQsIFwiTWlzc2luZyBjYXRjaCBvciBmaW5hbGx5IGNsYXVzZVwiKTsgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJUcnlTdGF0ZW1lbnRcIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlVmFyU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSwga2luZCwgYWxsb3dNaXNzaW5nSW5pdGlhbGl6ZXIpIHtcbiAgICB0aGlzLm5leHQoKTtcbiAgICB0aGlzLnBhcnNlVmFyKG5vZGUsIGZhbHNlLCBraW5kLCBhbGxvd01pc3NpbmdJbml0aWFsaXplcik7XG4gICAgdGhpcy5zZW1pY29sb24oKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiVmFyaWFibGVEZWNsYXJhdGlvblwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VXaGlsZVN0YXRlbWVudCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB0aGlzLm5leHQoKTtcbiAgICBub2RlLnRlc3QgPSB0aGlzLnBhcnNlUGFyZW5FeHByZXNzaW9uKCk7XG4gICAgdGhpcy5sYWJlbHMucHVzaChsb29wTGFiZWwpO1xuICAgIG5vZGUuYm9keSA9IHRoaXMucGFyc2VTdGF0ZW1lbnQoXCJ3aGlsZVwiKTtcbiAgICB0aGlzLmxhYmVscy5wb3AoKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiV2hpbGVTdGF0ZW1lbnRcIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlV2l0aFN0YXRlbWVudCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZiAodGhpcy5zdHJpY3QpIHsgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCBcIid3aXRoJyBpbiBzdHJpY3QgbW9kZVwiKTsgfVxuICAgIHRoaXMubmV4dCgpO1xuICAgIG5vZGUub2JqZWN0ID0gdGhpcy5wYXJzZVBhcmVuRXhwcmVzc2lvbigpO1xuICAgIG5vZGUuYm9keSA9IHRoaXMucGFyc2VTdGF0ZW1lbnQoXCJ3aXRoXCIpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJXaXRoU3RhdGVtZW50XCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUVtcHR5U3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJFbXB0eVN0YXRlbWVudFwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VMYWJlbGVkU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSwgbWF5YmVOYW1lLCBleHByLCBjb250ZXh0KSB7XG4gICAgZm9yICh2YXIgaSQxID0gMCwgbGlzdCA9IHRoaXMubGFiZWxzOyBpJDEgPCBsaXN0Lmxlbmd0aDsgaSQxICs9IDEpXG4gICAgICB7XG4gICAgICB2YXIgbGFiZWwgPSBsaXN0W2kkMV07XG5cbiAgICAgIGlmIChsYWJlbC5uYW1lID09PSBtYXliZU5hbWUpXG4gICAgICAgIHsgdGhpcy5yYWlzZShleHByLnN0YXJ0LCBcIkxhYmVsICdcIiArIG1heWJlTmFtZSArIFwiJyBpcyBhbHJlYWR5IGRlY2xhcmVkXCIpO1xuICAgIH0gfVxuICAgIHZhciBraW5kID0gdGhpcy50eXBlLmlzTG9vcCA/IFwibG9vcFwiIDogdGhpcy50eXBlID09PSB0eXBlcyQxLl9zd2l0Y2ggPyBcInN3aXRjaFwiIDogbnVsbDtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5sYWJlbHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHZhciBsYWJlbCQxID0gdGhpcy5sYWJlbHNbaV07XG4gICAgICBpZiAobGFiZWwkMS5zdGF0ZW1lbnRTdGFydCA9PT0gbm9kZS5zdGFydCkge1xuICAgICAgICAvLyBVcGRhdGUgaW5mb3JtYXRpb24gYWJvdXQgcHJldmlvdXMgbGFiZWxzIG9uIHRoaXMgbm9kZVxuICAgICAgICBsYWJlbCQxLnN0YXRlbWVudFN0YXJ0ID0gdGhpcy5zdGFydDtcbiAgICAgICAgbGFiZWwkMS5raW5kID0ga2luZDtcbiAgICAgIH0gZWxzZSB7IGJyZWFrIH1cbiAgICB9XG4gICAgdGhpcy5sYWJlbHMucHVzaCh7bmFtZTogbWF5YmVOYW1lLCBraW5kOiBraW5kLCBzdGF0ZW1lbnRTdGFydDogdGhpcy5zdGFydH0pO1xuICAgIG5vZGUuYm9keSA9IHRoaXMucGFyc2VTdGF0ZW1lbnQoY29udGV4dCA/IGNvbnRleHQuaW5kZXhPZihcImxhYmVsXCIpID09PSAtMSA/IGNvbnRleHQgKyBcImxhYmVsXCIgOiBjb250ZXh0IDogXCJsYWJlbFwiKTtcbiAgICB0aGlzLmxhYmVscy5wb3AoKTtcbiAgICBub2RlLmxhYmVsID0gZXhwcjtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiTGFiZWxlZFN0YXRlbWVudFwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VFeHByZXNzaW9uU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSwgZXhwcikge1xuICAgIG5vZGUuZXhwcmVzc2lvbiA9IGV4cHI7XG4gICAgdGhpcy5zZW1pY29sb24oKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiRXhwcmVzc2lvblN0YXRlbWVudFwiKVxuICB9O1xuXG4gIC8vIFBhcnNlIGEgc2VtaWNvbG9uLWVuY2xvc2VkIGJsb2NrIG9mIHN0YXRlbWVudHMsIGhhbmRsaW5nIGBcInVzZVxuICAvLyBzdHJpY3RcImAgZGVjbGFyYXRpb25zIHdoZW4gYGFsbG93U3RyaWN0YCBpcyB0cnVlICh1c2VkIGZvclxuICAvLyBmdW5jdGlvbiBib2RpZXMpLlxuXG4gIHBwJDgucGFyc2VCbG9jayA9IGZ1bmN0aW9uKGNyZWF0ZU5ld0xleGljYWxTY29wZSwgbm9kZSwgZXhpdFN0cmljdCkge1xuICAgIGlmICggY3JlYXRlTmV3TGV4aWNhbFNjb3BlID09PSB2b2lkIDAgKSBjcmVhdGVOZXdMZXhpY2FsU2NvcGUgPSB0cnVlO1xuICAgIGlmICggbm9kZSA9PT0gdm9pZCAwICkgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG5cbiAgICBub2RlLmJvZHkgPSBbXTtcbiAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmJyYWNlTCk7XG4gICAgaWYgKGNyZWF0ZU5ld0xleGljYWxTY29wZSkgeyB0aGlzLmVudGVyU2NvcGUoMCk7IH1cbiAgICB3aGlsZSAodGhpcy50eXBlICE9PSB0eXBlcyQxLmJyYWNlUikge1xuICAgICAgdmFyIHN0bXQgPSB0aGlzLnBhcnNlU3RhdGVtZW50KG51bGwpO1xuICAgICAgbm9kZS5ib2R5LnB1c2goc3RtdCk7XG4gICAgfVxuICAgIGlmIChleGl0U3RyaWN0KSB7IHRoaXMuc3RyaWN0ID0gZmFsc2U7IH1cbiAgICB0aGlzLm5leHQoKTtcbiAgICBpZiAoY3JlYXRlTmV3TGV4aWNhbFNjb3BlKSB7IHRoaXMuZXhpdFNjb3BlKCk7IH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiQmxvY2tTdGF0ZW1lbnRcIilcbiAgfTtcblxuICAvLyBQYXJzZSBhIHJlZ3VsYXIgYGZvcmAgbG9vcC4gVGhlIGRpc2FtYmlndWF0aW9uIGNvZGUgaW5cbiAgLy8gYHBhcnNlU3RhdGVtZW50YCB3aWxsIGFscmVhZHkgaGF2ZSBwYXJzZWQgdGhlIGluaXQgc3RhdGVtZW50IG9yXG4gIC8vIGV4cHJlc3Npb24uXG5cbiAgcHAkOC5wYXJzZUZvciA9IGZ1bmN0aW9uKG5vZGUsIGluaXQpIHtcbiAgICBub2RlLmluaXQgPSBpbml0O1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuc2VtaSk7XG4gICAgbm9kZS50ZXN0ID0gdGhpcy50eXBlID09PSB0eXBlcyQxLnNlbWkgPyBudWxsIDogdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLnNlbWkpO1xuICAgIG5vZGUudXBkYXRlID0gdGhpcy50eXBlID09PSB0eXBlcyQxLnBhcmVuUiA/IG51bGwgOiB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEucGFyZW5SKTtcbiAgICBub2RlLmJvZHkgPSB0aGlzLnBhcnNlU3RhdGVtZW50KFwiZm9yXCIpO1xuICAgIHRoaXMuZXhpdFNjb3BlKCk7XG4gICAgdGhpcy5sYWJlbHMucG9wKCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkZvclN0YXRlbWVudFwiKVxuICB9O1xuXG4gIC8vIFBhcnNlIGEgYGZvcmAvYGluYCBhbmQgYGZvcmAvYG9mYCBsb29wLCB3aGljaCBhcmUgYWxtb3N0XG4gIC8vIHNhbWUgZnJvbSBwYXJzZXIncyBwZXJzcGVjdGl2ZS5cblxuICBwcCQ4LnBhcnNlRm9ySW4gPSBmdW5jdGlvbihub2RlLCBpbml0KSB7XG4gICAgdmFyIGlzRm9ySW4gPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEuX2luO1xuICAgIHRoaXMubmV4dCgpO1xuXG4gICAgaWYgKFxuICAgICAgaW5pdC50eXBlID09PSBcIlZhcmlhYmxlRGVjbGFyYXRpb25cIiAmJlxuICAgICAgaW5pdC5kZWNsYXJhdGlvbnNbMF0uaW5pdCAhPSBudWxsICYmXG4gICAgICAoXG4gICAgICAgICFpc0ZvckluIHx8XG4gICAgICAgIHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA8IDggfHxcbiAgICAgICAgdGhpcy5zdHJpY3QgfHxcbiAgICAgICAgaW5pdC5raW5kICE9PSBcInZhclwiIHx8XG4gICAgICAgIGluaXQuZGVjbGFyYXRpb25zWzBdLmlkLnR5cGUgIT09IFwiSWRlbnRpZmllclwiXG4gICAgICApXG4gICAgKSB7XG4gICAgICB0aGlzLnJhaXNlKFxuICAgICAgICBpbml0LnN0YXJ0LFxuICAgICAgICAoKGlzRm9ySW4gPyBcImZvci1pblwiIDogXCJmb3Itb2ZcIikgKyBcIiBsb29wIHZhcmlhYmxlIGRlY2xhcmF0aW9uIG1heSBub3QgaGF2ZSBhbiBpbml0aWFsaXplclwiKVxuICAgICAgKTtcbiAgICB9XG4gICAgbm9kZS5sZWZ0ID0gaW5pdDtcbiAgICBub2RlLnJpZ2h0ID0gaXNGb3JJbiA/IHRoaXMucGFyc2VFeHByZXNzaW9uKCkgOiB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oKTtcbiAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLnBhcmVuUik7XG4gICAgbm9kZS5ib2R5ID0gdGhpcy5wYXJzZVN0YXRlbWVudChcImZvclwiKTtcbiAgICB0aGlzLmV4aXRTY29wZSgpO1xuICAgIHRoaXMubGFiZWxzLnBvcCgpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgaXNGb3JJbiA/IFwiRm9ySW5TdGF0ZW1lbnRcIiA6IFwiRm9yT2ZTdGF0ZW1lbnRcIilcbiAgfTtcblxuICAvLyBQYXJzZSBhIGxpc3Qgb2YgdmFyaWFibGUgZGVjbGFyYXRpb25zLlxuXG4gIHBwJDgucGFyc2VWYXIgPSBmdW5jdGlvbihub2RlLCBpc0Zvciwga2luZCwgYWxsb3dNaXNzaW5nSW5pdGlhbGl6ZXIpIHtcbiAgICBub2RlLmRlY2xhcmF0aW9ucyA9IFtdO1xuICAgIG5vZGUua2luZCA9IGtpbmQ7XG4gICAgZm9yICg7Oykge1xuICAgICAgdmFyIGRlY2wgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgICAgdGhpcy5wYXJzZVZhcklkKGRlY2wsIGtpbmQpO1xuICAgICAgaWYgKHRoaXMuZWF0KHR5cGVzJDEuZXEpKSB7XG4gICAgICAgIGRlY2wuaW5pdCA9IHRoaXMucGFyc2VNYXliZUFzc2lnbihpc0Zvcik7XG4gICAgICB9IGVsc2UgaWYgKCFhbGxvd01pc3NpbmdJbml0aWFsaXplciAmJiBraW5kID09PSBcImNvbnN0XCIgJiYgISh0aGlzLnR5cGUgPT09IHR5cGVzJDEuX2luIHx8ICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNiAmJiB0aGlzLmlzQ29udGV4dHVhbChcIm9mXCIpKSkpIHtcbiAgICAgICAgdGhpcy51bmV4cGVjdGVkKCk7XG4gICAgICB9IGVsc2UgaWYgKCFhbGxvd01pc3NpbmdJbml0aWFsaXplciAmJiBkZWNsLmlkLnR5cGUgIT09IFwiSWRlbnRpZmllclwiICYmICEoaXNGb3IgJiYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5faW4gfHwgdGhpcy5pc0NvbnRleHR1YWwoXCJvZlwiKSkpKSB7XG4gICAgICAgIHRoaXMucmFpc2UodGhpcy5sYXN0VG9rRW5kLCBcIkNvbXBsZXggYmluZGluZyBwYXR0ZXJucyByZXF1aXJlIGFuIGluaXRpYWxpemF0aW9uIHZhbHVlXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVjbC5pbml0ID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIG5vZGUuZGVjbGFyYXRpb25zLnB1c2godGhpcy5maW5pc2hOb2RlKGRlY2wsIFwiVmFyaWFibGVEZWNsYXJhdG9yXCIpKTtcbiAgICAgIGlmICghdGhpcy5lYXQodHlwZXMkMS5jb21tYSkpIHsgYnJlYWsgfVxuICAgIH1cbiAgICByZXR1cm4gbm9kZVxuICB9O1xuXG4gIHBwJDgucGFyc2VWYXJJZCA9IGZ1bmN0aW9uKGRlY2wsIGtpbmQpIHtcbiAgICBkZWNsLmlkID0gdGhpcy5wYXJzZUJpbmRpbmdBdG9tKCk7XG4gICAgdGhpcy5jaGVja0xWYWxQYXR0ZXJuKGRlY2wuaWQsIGtpbmQgPT09IFwidmFyXCIgPyBCSU5EX1ZBUiA6IEJJTkRfTEVYSUNBTCwgZmFsc2UpO1xuICB9O1xuXG4gIHZhciBGVU5DX1NUQVRFTUVOVCA9IDEsIEZVTkNfSEFOR0lOR19TVEFURU1FTlQgPSAyLCBGVU5DX05VTExBQkxFX0lEID0gNDtcblxuICAvLyBQYXJzZSBhIGZ1bmN0aW9uIGRlY2xhcmF0aW9uIG9yIGxpdGVyYWwgKGRlcGVuZGluZyBvbiB0aGVcbiAgLy8gYHN0YXRlbWVudCAmIEZVTkNfU1RBVEVNRU5UYCkuXG5cbiAgLy8gUmVtb3ZlIGBhbGxvd0V4cHJlc3Npb25Cb2R5YCBmb3IgNy4wLjAsIGFzIGl0IGlzIG9ubHkgY2FsbGVkIHdpdGggZmFsc2VcbiAgcHAkOC5wYXJzZUZ1bmN0aW9uID0gZnVuY3Rpb24obm9kZSwgc3RhdGVtZW50LCBhbGxvd0V4cHJlc3Npb25Cb2R5LCBpc0FzeW5jLCBmb3JJbml0KSB7XG4gICAgdGhpcy5pbml0RnVuY3Rpb24obm9kZSk7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5IHx8IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ICYmICFpc0FzeW5jKSB7XG4gICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnN0YXIgJiYgKHN0YXRlbWVudCAmIEZVTkNfSEFOR0lOR19TVEFURU1FTlQpKVxuICAgICAgICB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICBub2RlLmdlbmVyYXRvciA9IHRoaXMuZWF0KHR5cGVzJDEuc3Rhcik7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOClcbiAgICAgIHsgbm9kZS5hc3luYyA9ICEhaXNBc3luYzsgfVxuXG4gICAgaWYgKHN0YXRlbWVudCAmIEZVTkNfU1RBVEVNRU5UKSB7XG4gICAgICBub2RlLmlkID0gKHN0YXRlbWVudCAmIEZVTkNfTlVMTEFCTEVfSUQpICYmIHRoaXMudHlwZSAhPT0gdHlwZXMkMS5uYW1lID8gbnVsbCA6IHRoaXMucGFyc2VJZGVudCgpO1xuICAgICAgaWYgKG5vZGUuaWQgJiYgIShzdGF0ZW1lbnQgJiBGVU5DX0hBTkdJTkdfU1RBVEVNRU5UKSlcbiAgICAgICAgLy8gSWYgaXQgaXMgYSByZWd1bGFyIGZ1bmN0aW9uIGRlY2xhcmF0aW9uIGluIHNsb3BweSBtb2RlLCB0aGVuIGl0IGlzXG4gICAgICAgIC8vIHN1YmplY3QgdG8gQW5uZXggQiBzZW1hbnRpY3MgKEJJTkRfRlVOQ1RJT04pLiBPdGhlcndpc2UsIHRoZSBiaW5kaW5nXG4gICAgICAgIC8vIG1vZGUgZGVwZW5kcyBvbiBwcm9wZXJ0aWVzIG9mIHRoZSBjdXJyZW50IHNjb3BlIChzZWVcbiAgICAgICAgLy8gdHJlYXRGdW5jdGlvbnNBc1ZhcikuXG4gICAgICAgIHsgdGhpcy5jaGVja0xWYWxTaW1wbGUobm9kZS5pZCwgKHRoaXMuc3RyaWN0IHx8IG5vZGUuZ2VuZXJhdG9yIHx8IG5vZGUuYXN5bmMpID8gdGhpcy50cmVhdEZ1bmN0aW9uc0FzVmFyID8gQklORF9WQVIgOiBCSU5EX0xFWElDQUwgOiBCSU5EX0ZVTkNUSU9OKTsgfVxuICAgIH1cblxuICAgIHZhciBvbGRZaWVsZFBvcyA9IHRoaXMueWllbGRQb3MsIG9sZEF3YWl0UG9zID0gdGhpcy5hd2FpdFBvcywgb2xkQXdhaXRJZGVudFBvcyA9IHRoaXMuYXdhaXRJZGVudFBvcztcbiAgICB0aGlzLnlpZWxkUG9zID0gMDtcbiAgICB0aGlzLmF3YWl0UG9zID0gMDtcbiAgICB0aGlzLmF3YWl0SWRlbnRQb3MgPSAwO1xuICAgIHRoaXMuZW50ZXJTY29wZShmdW5jdGlvbkZsYWdzKG5vZGUuYXN5bmMsIG5vZGUuZ2VuZXJhdG9yKSk7XG5cbiAgICBpZiAoIShzdGF0ZW1lbnQgJiBGVU5DX1NUQVRFTUVOVCkpXG4gICAgICB7IG5vZGUuaWQgPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEubmFtZSA/IHRoaXMucGFyc2VJZGVudCgpIDogbnVsbDsgfVxuXG4gICAgdGhpcy5wYXJzZUZ1bmN0aW9uUGFyYW1zKG5vZGUpO1xuICAgIHRoaXMucGFyc2VGdW5jdGlvbkJvZHkobm9kZSwgYWxsb3dFeHByZXNzaW9uQm9keSwgZmFsc2UsIGZvckluaXQpO1xuXG4gICAgdGhpcy55aWVsZFBvcyA9IG9sZFlpZWxkUG9zO1xuICAgIHRoaXMuYXdhaXRQb3MgPSBvbGRBd2FpdFBvcztcbiAgICB0aGlzLmF3YWl0SWRlbnRQb3MgPSBvbGRBd2FpdElkZW50UG9zO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgKHN0YXRlbWVudCAmIEZVTkNfU1RBVEVNRU5UKSA/IFwiRnVuY3Rpb25EZWNsYXJhdGlvblwiIDogXCJGdW5jdGlvbkV4cHJlc3Npb25cIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlRnVuY3Rpb25QYXJhbXMgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5wYXJlbkwpO1xuICAgIG5vZGUucGFyYW1zID0gdGhpcy5wYXJzZUJpbmRpbmdMaXN0KHR5cGVzJDEucGFyZW5SLCBmYWxzZSwgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDgpO1xuICAgIHRoaXMuY2hlY2tZaWVsZEF3YWl0SW5EZWZhdWx0UGFyYW1zKCk7XG4gIH07XG5cbiAgLy8gUGFyc2UgYSBjbGFzcyBkZWNsYXJhdGlvbiBvciBsaXRlcmFsIChkZXBlbmRpbmcgb24gdGhlXG4gIC8vIGBpc1N0YXRlbWVudGAgcGFyYW1ldGVyKS5cblxuICBwcCQ4LnBhcnNlQ2xhc3MgPSBmdW5jdGlvbihub2RlLCBpc1N0YXRlbWVudCkge1xuICAgIHRoaXMubmV4dCgpO1xuXG4gICAgLy8gZWNtYS0yNjIgMTQuNiBDbGFzcyBEZWZpbml0aW9uc1xuICAgIC8vIEEgY2xhc3MgZGVmaW5pdGlvbiBpcyBhbHdheXMgc3RyaWN0IG1vZGUgY29kZS5cbiAgICB2YXIgb2xkU3RyaWN0ID0gdGhpcy5zdHJpY3Q7XG4gICAgdGhpcy5zdHJpY3QgPSB0cnVlO1xuXG4gICAgdGhpcy5wYXJzZUNsYXNzSWQobm9kZSwgaXNTdGF0ZW1lbnQpO1xuICAgIHRoaXMucGFyc2VDbGFzc1N1cGVyKG5vZGUpO1xuICAgIHZhciBwcml2YXRlTmFtZU1hcCA9IHRoaXMuZW50ZXJDbGFzc0JvZHkoKTtcbiAgICB2YXIgY2xhc3NCb2R5ID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICB2YXIgaGFkQ29uc3RydWN0b3IgPSBmYWxzZTtcbiAgICBjbGFzc0JvZHkuYm9keSA9IFtdO1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuYnJhY2VMKTtcbiAgICB3aGlsZSAodGhpcy50eXBlICE9PSB0eXBlcyQxLmJyYWNlUikge1xuICAgICAgdmFyIGVsZW1lbnQgPSB0aGlzLnBhcnNlQ2xhc3NFbGVtZW50KG5vZGUuc3VwZXJDbGFzcyAhPT0gbnVsbCk7XG4gICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICBjbGFzc0JvZHkuYm9keS5wdXNoKGVsZW1lbnQpO1xuICAgICAgICBpZiAoZWxlbWVudC50eXBlID09PSBcIk1ldGhvZERlZmluaXRpb25cIiAmJiBlbGVtZW50LmtpbmQgPT09IFwiY29uc3RydWN0b3JcIikge1xuICAgICAgICAgIGlmIChoYWRDb25zdHJ1Y3RvcikgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoZWxlbWVudC5zdGFydCwgXCJEdXBsaWNhdGUgY29uc3RydWN0b3IgaW4gdGhlIHNhbWUgY2xhc3NcIik7IH1cbiAgICAgICAgICBoYWRDb25zdHJ1Y3RvciA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudC5rZXkgJiYgZWxlbWVudC5rZXkudHlwZSA9PT0gXCJQcml2YXRlSWRlbnRpZmllclwiICYmIGlzUHJpdmF0ZU5hbWVDb25mbGljdGVkKHByaXZhdGVOYW1lTWFwLCBlbGVtZW50KSkge1xuICAgICAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZShlbGVtZW50LmtleS5zdGFydCwgKFwiSWRlbnRpZmllciAnI1wiICsgKGVsZW1lbnQua2V5Lm5hbWUpICsgXCInIGhhcyBhbHJlYWR5IGJlZW4gZGVjbGFyZWRcIikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc3RyaWN0ID0gb2xkU3RyaWN0O1xuICAgIHRoaXMubmV4dCgpO1xuICAgIG5vZGUuYm9keSA9IHRoaXMuZmluaXNoTm9kZShjbGFzc0JvZHksIFwiQ2xhc3NCb2R5XCIpO1xuICAgIHRoaXMuZXhpdENsYXNzQm9keSgpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgaXNTdGF0ZW1lbnQgPyBcIkNsYXNzRGVjbGFyYXRpb25cIiA6IFwiQ2xhc3NFeHByZXNzaW9uXCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUNsYXNzRWxlbWVudCA9IGZ1bmN0aW9uKGNvbnN0cnVjdG9yQWxsb3dzU3VwZXIpIHtcbiAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5zZW1pKSkgeyByZXR1cm4gbnVsbCB9XG5cbiAgICB2YXIgZWNtYVZlcnNpb24gPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb247XG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIHZhciBrZXlOYW1lID0gXCJcIjtcbiAgICB2YXIgaXNHZW5lcmF0b3IgPSBmYWxzZTtcbiAgICB2YXIgaXNBc3luYyA9IGZhbHNlO1xuICAgIHZhciBraW5kID0gXCJtZXRob2RcIjtcbiAgICB2YXIgaXNTdGF0aWMgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLmVhdENvbnRleHR1YWwoXCJzdGF0aWNcIikpIHtcbiAgICAgIC8vIFBhcnNlIHN0YXRpYyBpbml0IGJsb2NrXG4gICAgICBpZiAoZWNtYVZlcnNpb24gPj0gMTMgJiYgdGhpcy5lYXQodHlwZXMkMS5icmFjZUwpKSB7XG4gICAgICAgIHRoaXMucGFyc2VDbGFzc1N0YXRpY0Jsb2NrKG5vZGUpO1xuICAgICAgICByZXR1cm4gbm9kZVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMuaXNDbGFzc0VsZW1lbnROYW1lU3RhcnQoKSB8fCB0aGlzLnR5cGUgPT09IHR5cGVzJDEuc3Rhcikge1xuICAgICAgICBpc1N0YXRpYyA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBrZXlOYW1lID0gXCJzdGF0aWNcIjtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZS5zdGF0aWMgPSBpc1N0YXRpYztcbiAgICBpZiAoIWtleU5hbWUgJiYgZWNtYVZlcnNpb24gPj0gOCAmJiB0aGlzLmVhdENvbnRleHR1YWwoXCJhc3luY1wiKSkge1xuICAgICAgaWYgKCh0aGlzLmlzQ2xhc3NFbGVtZW50TmFtZVN0YXJ0KCkgfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLnN0YXIpICYmICF0aGlzLmNhbkluc2VydFNlbWljb2xvbigpKSB7XG4gICAgICAgIGlzQXN5bmMgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAga2V5TmFtZSA9IFwiYXN5bmNcIjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFrZXlOYW1lICYmIChlY21hVmVyc2lvbiA+PSA5IHx8ICFpc0FzeW5jKSAmJiB0aGlzLmVhdCh0eXBlcyQxLnN0YXIpKSB7XG4gICAgICBpc0dlbmVyYXRvciA9IHRydWU7XG4gICAgfVxuICAgIGlmICgha2V5TmFtZSAmJiAhaXNBc3luYyAmJiAhaXNHZW5lcmF0b3IpIHtcbiAgICAgIHZhciBsYXN0VmFsdWUgPSB0aGlzLnZhbHVlO1xuICAgICAgaWYgKHRoaXMuZWF0Q29udGV4dHVhbChcImdldFwiKSB8fCB0aGlzLmVhdENvbnRleHR1YWwoXCJzZXRcIikpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNDbGFzc0VsZW1lbnROYW1lU3RhcnQoKSkge1xuICAgICAgICAgIGtpbmQgPSBsYXN0VmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAga2V5TmFtZSA9IGxhc3RWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFBhcnNlIGVsZW1lbnQgbmFtZVxuICAgIGlmIChrZXlOYW1lKSB7XG4gICAgICAvLyAnYXN5bmMnLCAnZ2V0JywgJ3NldCcsIG9yICdzdGF0aWMnIHdlcmUgbm90IGEga2V5d29yZCBjb250ZXh0dWFsbHkuXG4gICAgICAvLyBUaGUgbGFzdCB0b2tlbiBpcyBhbnkgb2YgdGhvc2UuIE1ha2UgaXQgdGhlIGVsZW1lbnQgbmFtZS5cbiAgICAgIG5vZGUuY29tcHV0ZWQgPSBmYWxzZTtcbiAgICAgIG5vZGUua2V5ID0gdGhpcy5zdGFydE5vZGVBdCh0aGlzLmxhc3RUb2tTdGFydCwgdGhpcy5sYXN0VG9rU3RhcnRMb2MpO1xuICAgICAgbm9kZS5rZXkubmFtZSA9IGtleU5hbWU7XG4gICAgICB0aGlzLmZpbmlzaE5vZGUobm9kZS5rZXksIFwiSWRlbnRpZmllclwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXJzZUNsYXNzRWxlbWVudE5hbWUobm9kZSk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgZWxlbWVudCB2YWx1ZVxuICAgIGlmIChlY21hVmVyc2lvbiA8IDEzIHx8IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5wYXJlbkwgfHwga2luZCAhPT0gXCJtZXRob2RcIiB8fCBpc0dlbmVyYXRvciB8fCBpc0FzeW5jKSB7XG4gICAgICB2YXIgaXNDb25zdHJ1Y3RvciA9ICFub2RlLnN0YXRpYyAmJiBjaGVja0tleU5hbWUobm9kZSwgXCJjb25zdHJ1Y3RvclwiKTtcbiAgICAgIHZhciBhbGxvd3NEaXJlY3RTdXBlciA9IGlzQ29uc3RydWN0b3IgJiYgY29uc3RydWN0b3JBbGxvd3NTdXBlcjtcbiAgICAgIC8vIENvdWxkbid0IG1vdmUgdGhpcyBjaGVjayBpbnRvIHRoZSAncGFyc2VDbGFzc01ldGhvZCcgbWV0aG9kIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5LlxuICAgICAgaWYgKGlzQ29uc3RydWN0b3IgJiYga2luZCAhPT0gXCJtZXRob2RcIikgeyB0aGlzLnJhaXNlKG5vZGUua2V5LnN0YXJ0LCBcIkNvbnN0cnVjdG9yIGNhbid0IGhhdmUgZ2V0L3NldCBtb2RpZmllclwiKTsgfVxuICAgICAgbm9kZS5raW5kID0gaXNDb25zdHJ1Y3RvciA/IFwiY29uc3RydWN0b3JcIiA6IGtpbmQ7XG4gICAgICB0aGlzLnBhcnNlQ2xhc3NNZXRob2Qobm9kZSwgaXNHZW5lcmF0b3IsIGlzQXN5bmMsIGFsbG93c0RpcmVjdFN1cGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXJzZUNsYXNzRmllbGQobm9kZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVcbiAgfTtcblxuICBwcCQ4LmlzQ2xhc3NFbGVtZW50TmFtZVN0YXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5uYW1lIHx8XG4gICAgICB0aGlzLnR5cGUgPT09IHR5cGVzJDEucHJpdmF0ZUlkIHx8XG4gICAgICB0aGlzLnR5cGUgPT09IHR5cGVzJDEubnVtIHx8XG4gICAgICB0aGlzLnR5cGUgPT09IHR5cGVzJDEuc3RyaW5nIHx8XG4gICAgICB0aGlzLnR5cGUgPT09IHR5cGVzJDEuYnJhY2tldEwgfHxcbiAgICAgIHRoaXMudHlwZS5rZXl3b3JkXG4gICAgKVxuICB9O1xuXG4gIHBwJDgucGFyc2VDbGFzc0VsZW1lbnROYW1lID0gZnVuY3Rpb24oZWxlbWVudCkge1xuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEucHJpdmF0ZUlkKSB7XG4gICAgICBpZiAodGhpcy52YWx1ZSA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG4gICAgICAgIHRoaXMucmFpc2UodGhpcy5zdGFydCwgXCJDbGFzc2VzIGNhbid0IGhhdmUgYW4gZWxlbWVudCBuYW1lZCAnI2NvbnN0cnVjdG9yJ1wiKTtcbiAgICAgIH1cbiAgICAgIGVsZW1lbnQuY29tcHV0ZWQgPSBmYWxzZTtcbiAgICAgIGVsZW1lbnQua2V5ID0gdGhpcy5wYXJzZVByaXZhdGVJZGVudCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBhcnNlUHJvcGVydHlOYW1lKGVsZW1lbnQpO1xuICAgIH1cbiAgfTtcblxuICBwcCQ4LnBhcnNlQ2xhc3NNZXRob2QgPSBmdW5jdGlvbihtZXRob2QsIGlzR2VuZXJhdG9yLCBpc0FzeW5jLCBhbGxvd3NEaXJlY3RTdXBlcikge1xuICAgIC8vIENoZWNrIGtleSBhbmQgZmxhZ3NcbiAgICB2YXIga2V5ID0gbWV0aG9kLmtleTtcbiAgICBpZiAobWV0aG9kLmtpbmQgPT09IFwiY29uc3RydWN0b3JcIikge1xuICAgICAgaWYgKGlzR2VuZXJhdG9yKSB7IHRoaXMucmFpc2Uoa2V5LnN0YXJ0LCBcIkNvbnN0cnVjdG9yIGNhbid0IGJlIGEgZ2VuZXJhdG9yXCIpOyB9XG4gICAgICBpZiAoaXNBc3luYykgeyB0aGlzLnJhaXNlKGtleS5zdGFydCwgXCJDb25zdHJ1Y3RvciBjYW4ndCBiZSBhbiBhc3luYyBtZXRob2RcIik7IH1cbiAgICB9IGVsc2UgaWYgKG1ldGhvZC5zdGF0aWMgJiYgY2hlY2tLZXlOYW1lKG1ldGhvZCwgXCJwcm90b3R5cGVcIikpIHtcbiAgICAgIHRoaXMucmFpc2Uoa2V5LnN0YXJ0LCBcIkNsYXNzZXMgbWF5IG5vdCBoYXZlIGEgc3RhdGljIHByb3BlcnR5IG5hbWVkIHByb3RvdHlwZVwiKTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSB2YWx1ZVxuICAgIHZhciB2YWx1ZSA9IG1ldGhvZC52YWx1ZSA9IHRoaXMucGFyc2VNZXRob2QoaXNHZW5lcmF0b3IsIGlzQXN5bmMsIGFsbG93c0RpcmVjdFN1cGVyKTtcblxuICAgIC8vIENoZWNrIHZhbHVlXG4gICAgaWYgKG1ldGhvZC5raW5kID09PSBcImdldFwiICYmIHZhbHVlLnBhcmFtcy5sZW5ndGggIT09IDApXG4gICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZSh2YWx1ZS5zdGFydCwgXCJnZXR0ZXIgc2hvdWxkIGhhdmUgbm8gcGFyYW1zXCIpOyB9XG4gICAgaWYgKG1ldGhvZC5raW5kID09PSBcInNldFwiICYmIHZhbHVlLnBhcmFtcy5sZW5ndGggIT09IDEpXG4gICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZSh2YWx1ZS5zdGFydCwgXCJzZXR0ZXIgc2hvdWxkIGhhdmUgZXhhY3RseSBvbmUgcGFyYW1cIik7IH1cbiAgICBpZiAobWV0aG9kLmtpbmQgPT09IFwic2V0XCIgJiYgdmFsdWUucGFyYW1zWzBdLnR5cGUgPT09IFwiUmVzdEVsZW1lbnRcIilcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHZhbHVlLnBhcmFtc1swXS5zdGFydCwgXCJTZXR0ZXIgY2Fubm90IHVzZSByZXN0IHBhcmFtc1wiKTsgfVxuXG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShtZXRob2QsIFwiTWV0aG9kRGVmaW5pdGlvblwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VDbGFzc0ZpZWxkID0gZnVuY3Rpb24oZmllbGQpIHtcbiAgICBpZiAoY2hlY2tLZXlOYW1lKGZpZWxkLCBcImNvbnN0cnVjdG9yXCIpKSB7XG4gICAgICB0aGlzLnJhaXNlKGZpZWxkLmtleS5zdGFydCwgXCJDbGFzc2VzIGNhbid0IGhhdmUgYSBmaWVsZCBuYW1lZCAnY29uc3RydWN0b3InXCIpO1xuICAgIH0gZWxzZSBpZiAoZmllbGQuc3RhdGljICYmIGNoZWNrS2V5TmFtZShmaWVsZCwgXCJwcm90b3R5cGVcIikpIHtcbiAgICAgIHRoaXMucmFpc2UoZmllbGQua2V5LnN0YXJ0LCBcIkNsYXNzZXMgY2FuJ3QgaGF2ZSBhIHN0YXRpYyBmaWVsZCBuYW1lZCAncHJvdG90eXBlJ1wiKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5lcSkpIHtcbiAgICAgIC8vIFRvIHJhaXNlIFN5bnRheEVycm9yIGlmICdhcmd1bWVudHMnIGV4aXN0cyBpbiB0aGUgaW5pdGlhbGl6ZXIuXG4gICAgICB2YXIgc2NvcGUgPSB0aGlzLmN1cnJlbnRUaGlzU2NvcGUoKTtcbiAgICAgIHZhciBpbkNsYXNzRmllbGRJbml0ID0gc2NvcGUuaW5DbGFzc0ZpZWxkSW5pdDtcbiAgICAgIHNjb3BlLmluQ2xhc3NGaWVsZEluaXQgPSB0cnVlO1xuICAgICAgZmllbGQudmFsdWUgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oKTtcbiAgICAgIHNjb3BlLmluQ2xhc3NGaWVsZEluaXQgPSBpbkNsYXNzRmllbGRJbml0O1xuICAgIH0gZWxzZSB7XG4gICAgICBmaWVsZC52YWx1ZSA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuc2VtaWNvbG9uKCk7XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKGZpZWxkLCBcIlByb3BlcnR5RGVmaW5pdGlvblwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VDbGFzc1N0YXRpY0Jsb2NrID0gZnVuY3Rpb24obm9kZSkge1xuICAgIG5vZGUuYm9keSA9IFtdO1xuXG4gICAgdmFyIG9sZExhYmVscyA9IHRoaXMubGFiZWxzO1xuICAgIHRoaXMubGFiZWxzID0gW107XG4gICAgdGhpcy5lbnRlclNjb3BlKFNDT1BFX0NMQVNTX1NUQVRJQ19CTE9DSyB8IFNDT1BFX1NVUEVSKTtcbiAgICB3aGlsZSAodGhpcy50eXBlICE9PSB0eXBlcyQxLmJyYWNlUikge1xuICAgICAgdmFyIHN0bXQgPSB0aGlzLnBhcnNlU3RhdGVtZW50KG51bGwpO1xuICAgICAgbm9kZS5ib2R5LnB1c2goc3RtdCk7XG4gICAgfVxuICAgIHRoaXMubmV4dCgpO1xuICAgIHRoaXMuZXhpdFNjb3BlKCk7XG4gICAgdGhpcy5sYWJlbHMgPSBvbGRMYWJlbHM7XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiU3RhdGljQmxvY2tcIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlQ2xhc3NJZCA9IGZ1bmN0aW9uKG5vZGUsIGlzU3RhdGVtZW50KSB7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5uYW1lKSB7XG4gICAgICBub2RlLmlkID0gdGhpcy5wYXJzZUlkZW50KCk7XG4gICAgICBpZiAoaXNTdGF0ZW1lbnQpXG4gICAgICAgIHsgdGhpcy5jaGVja0xWYWxTaW1wbGUobm9kZS5pZCwgQklORF9MRVhJQ0FMLCBmYWxzZSk7IH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlzU3RhdGVtZW50ID09PSB0cnVlKVxuICAgICAgICB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICBub2RlLmlkID0gbnVsbDtcbiAgICB9XG4gIH07XG5cbiAgcHAkOC5wYXJzZUNsYXNzU3VwZXIgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgbm9kZS5zdXBlckNsYXNzID0gdGhpcy5lYXQodHlwZXMkMS5fZXh0ZW5kcykgPyB0aGlzLnBhcnNlRXhwclN1YnNjcmlwdHMobnVsbCwgZmFsc2UpIDogbnVsbDtcbiAgfTtcblxuICBwcCQ4LmVudGVyQ2xhc3NCb2R5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVsZW1lbnQgPSB7ZGVjbGFyZWQ6IE9iamVjdC5jcmVhdGUobnVsbCksIHVzZWQ6IFtdfTtcbiAgICB0aGlzLnByaXZhdGVOYW1lU3RhY2sucHVzaChlbGVtZW50KTtcbiAgICByZXR1cm4gZWxlbWVudC5kZWNsYXJlZFxuICB9O1xuXG4gIHBwJDguZXhpdENsYXNzQm9keSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZWYgPSB0aGlzLnByaXZhdGVOYW1lU3RhY2sucG9wKCk7XG4gICAgdmFyIGRlY2xhcmVkID0gcmVmLmRlY2xhcmVkO1xuICAgIHZhciB1c2VkID0gcmVmLnVzZWQ7XG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuY2hlY2tQcml2YXRlRmllbGRzKSB7IHJldHVybiB9XG4gICAgdmFyIGxlbiA9IHRoaXMucHJpdmF0ZU5hbWVTdGFjay5sZW5ndGg7XG4gICAgdmFyIHBhcmVudCA9IGxlbiA9PT0gMCA/IG51bGwgOiB0aGlzLnByaXZhdGVOYW1lU3RhY2tbbGVuIC0gMV07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1c2VkLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgaWQgPSB1c2VkW2ldO1xuICAgICAgaWYgKCFoYXNPd24oZGVjbGFyZWQsIGlkLm5hbWUpKSB7XG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICBwYXJlbnQudXNlZC5wdXNoKGlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoaWQuc3RhcnQsIChcIlByaXZhdGUgZmllbGQgJyNcIiArIChpZC5uYW1lKSArIFwiJyBtdXN0IGJlIGRlY2xhcmVkIGluIGFuIGVuY2xvc2luZyBjbGFzc1wiKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgZnVuY3Rpb24gaXNQcml2YXRlTmFtZUNvbmZsaWN0ZWQocHJpdmF0ZU5hbWVNYXAsIGVsZW1lbnQpIHtcbiAgICB2YXIgbmFtZSA9IGVsZW1lbnQua2V5Lm5hbWU7XG4gICAgdmFyIGN1cnIgPSBwcml2YXRlTmFtZU1hcFtuYW1lXTtcblxuICAgIHZhciBuZXh0ID0gXCJ0cnVlXCI7XG4gICAgaWYgKGVsZW1lbnQudHlwZSA9PT0gXCJNZXRob2REZWZpbml0aW9uXCIgJiYgKGVsZW1lbnQua2luZCA9PT0gXCJnZXRcIiB8fCBlbGVtZW50LmtpbmQgPT09IFwic2V0XCIpKSB7XG4gICAgICBuZXh0ID0gKGVsZW1lbnQuc3RhdGljID8gXCJzXCIgOiBcImlcIikgKyBlbGVtZW50LmtpbmQ7XG4gICAgfVxuXG4gICAgLy8gYGNsYXNzIHsgZ2V0ICNhKCl7fTsgc3RhdGljIHNldCAjYShfKXt9IH1gIGlzIGFsc28gY29uZmxpY3QuXG4gICAgaWYgKFxuICAgICAgY3VyciA9PT0gXCJpZ2V0XCIgJiYgbmV4dCA9PT0gXCJpc2V0XCIgfHxcbiAgICAgIGN1cnIgPT09IFwiaXNldFwiICYmIG5leHQgPT09IFwiaWdldFwiIHx8XG4gICAgICBjdXJyID09PSBcInNnZXRcIiAmJiBuZXh0ID09PSBcInNzZXRcIiB8fFxuICAgICAgY3VyciA9PT0gXCJzc2V0XCIgJiYgbmV4dCA9PT0gXCJzZ2V0XCJcbiAgICApIHtcbiAgICAgIHByaXZhdGVOYW1lTWFwW25hbWVdID0gXCJ0cnVlXCI7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9IGVsc2UgaWYgKCFjdXJyKSB7XG4gICAgICBwcml2YXRlTmFtZU1hcFtuYW1lXSA9IG5leHQ7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjaGVja0tleU5hbWUobm9kZSwgbmFtZSkge1xuICAgIHZhciBjb21wdXRlZCA9IG5vZGUuY29tcHV0ZWQ7XG4gICAgdmFyIGtleSA9IG5vZGUua2V5O1xuICAgIHJldHVybiAhY29tcHV0ZWQgJiYgKFxuICAgICAga2V5LnR5cGUgPT09IFwiSWRlbnRpZmllclwiICYmIGtleS5uYW1lID09PSBuYW1lIHx8XG4gICAgICBrZXkudHlwZSA9PT0gXCJMaXRlcmFsXCIgJiYga2V5LnZhbHVlID09PSBuYW1lXG4gICAgKVxuICB9XG5cbiAgLy8gUGFyc2VzIG1vZHVsZSBleHBvcnQgZGVjbGFyYXRpb24uXG5cbiAgcHAkOC5wYXJzZUV4cG9ydEFsbERlY2xhcmF0aW9uID0gZnVuY3Rpb24obm9kZSwgZXhwb3J0cykge1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTEpIHtcbiAgICAgIGlmICh0aGlzLmVhdENvbnRleHR1YWwoXCJhc1wiKSkge1xuICAgICAgICBub2RlLmV4cG9ydGVkID0gdGhpcy5wYXJzZU1vZHVsZUV4cG9ydE5hbWUoKTtcbiAgICAgICAgdGhpcy5jaGVja0V4cG9ydChleHBvcnRzLCBub2RlLmV4cG9ydGVkLCB0aGlzLmxhc3RUb2tTdGFydCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub2RlLmV4cG9ydGVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5leHBlY3RDb250ZXh0dWFsKFwiZnJvbVwiKTtcbiAgICBpZiAodGhpcy50eXBlICE9PSB0eXBlcyQxLnN0cmluZykgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgIG5vZGUuc291cmNlID0gdGhpcy5wYXJzZUV4cHJBdG9tKCk7XG4gICAgdGhpcy5zZW1pY29sb24oKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiRXhwb3J0QWxsRGVjbGFyYXRpb25cIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlRXhwb3J0ID0gZnVuY3Rpb24obm9kZSwgZXhwb3J0cykge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIC8vIGV4cG9ydCAqIGZyb20gJy4uLidcbiAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5zdGFyKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VFeHBvcnRBbGxEZWNsYXJhdGlvbihub2RlLCBleHBvcnRzKVxuICAgIH1cbiAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5fZGVmYXVsdCkpIHsgLy8gZXhwb3J0IGRlZmF1bHQgLi4uXG4gICAgICB0aGlzLmNoZWNrRXhwb3J0KGV4cG9ydHMsIFwiZGVmYXVsdFwiLCB0aGlzLmxhc3RUb2tTdGFydCk7XG4gICAgICBub2RlLmRlY2xhcmF0aW9uID0gdGhpcy5wYXJzZUV4cG9ydERlZmF1bHREZWNsYXJhdGlvbigpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkV4cG9ydERlZmF1bHREZWNsYXJhdGlvblwiKVxuICAgIH1cbiAgICAvLyBleHBvcnQgdmFyfGNvbnN0fGxldHxmdW5jdGlvbnxjbGFzcyAuLi5cbiAgICBpZiAodGhpcy5zaG91bGRQYXJzZUV4cG9ydFN0YXRlbWVudCgpKSB7XG4gICAgICBub2RlLmRlY2xhcmF0aW9uID0gdGhpcy5wYXJzZUV4cG9ydERlY2xhcmF0aW9uKG5vZGUpO1xuICAgICAgaWYgKG5vZGUuZGVjbGFyYXRpb24udHlwZSA9PT0gXCJWYXJpYWJsZURlY2xhcmF0aW9uXCIpXG4gICAgICAgIHsgdGhpcy5jaGVja1ZhcmlhYmxlRXhwb3J0KGV4cG9ydHMsIG5vZGUuZGVjbGFyYXRpb24uZGVjbGFyYXRpb25zKTsgfVxuICAgICAgZWxzZVxuICAgICAgICB7IHRoaXMuY2hlY2tFeHBvcnQoZXhwb3J0cywgbm9kZS5kZWNsYXJhdGlvbi5pZCwgbm9kZS5kZWNsYXJhdGlvbi5pZC5zdGFydCk7IH1cbiAgICAgIG5vZGUuc3BlY2lmaWVycyA9IFtdO1xuICAgICAgbm9kZS5zb3VyY2UgPSBudWxsO1xuICAgIH0gZWxzZSB7IC8vIGV4cG9ydCB7IHgsIHkgYXMgeiB9IFtmcm9tICcuLi4nXVxuICAgICAgbm9kZS5kZWNsYXJhdGlvbiA9IG51bGw7XG4gICAgICBub2RlLnNwZWNpZmllcnMgPSB0aGlzLnBhcnNlRXhwb3J0U3BlY2lmaWVycyhleHBvcnRzKTtcbiAgICAgIGlmICh0aGlzLmVhdENvbnRleHR1YWwoXCJmcm9tXCIpKSB7XG4gICAgICAgIGlmICh0aGlzLnR5cGUgIT09IHR5cGVzJDEuc3RyaW5nKSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICAgIG5vZGUuc291cmNlID0gdGhpcy5wYXJzZUV4cHJBdG9tKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGlzdCA9IG5vZGUuc3BlY2lmaWVyczsgaSA8IGxpc3QubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAvLyBjaGVjayBmb3Iga2V5d29yZHMgdXNlZCBhcyBsb2NhbCBuYW1lc1xuICAgICAgICAgIHZhciBzcGVjID0gbGlzdFtpXTtcblxuICAgICAgICAgIHRoaXMuY2hlY2tVbnJlc2VydmVkKHNwZWMubG9jYWwpO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGV4cG9ydCBpcyBkZWZpbmVkXG4gICAgICAgICAgdGhpcy5jaGVja0xvY2FsRXhwb3J0KHNwZWMubG9jYWwpO1xuXG4gICAgICAgICAgaWYgKHNwZWMubG9jYWwudHlwZSA9PT0gXCJMaXRlcmFsXCIpIHtcbiAgICAgICAgICAgIHRoaXMucmFpc2Uoc3BlYy5sb2NhbC5zdGFydCwgXCJBIHN0cmluZyBsaXRlcmFsIGNhbm5vdCBiZSB1c2VkIGFzIGFuIGV4cG9ydGVkIGJpbmRpbmcgd2l0aG91dCBgZnJvbWAuXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG5vZGUuc291cmNlID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2VtaWNvbG9uKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJFeHBvcnROYW1lZERlY2xhcmF0aW9uXCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUV4cG9ydERlY2xhcmF0aW9uID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiB0aGlzLnBhcnNlU3RhdGVtZW50KG51bGwpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUV4cG9ydERlZmF1bHREZWNsYXJhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpc0FzeW5jO1xuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuX2Z1bmN0aW9uIHx8IChpc0FzeW5jID0gdGhpcy5pc0FzeW5jRnVuY3Rpb24oKSkpIHtcbiAgICAgIHZhciBmTm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgICB0aGlzLm5leHQoKTtcbiAgICAgIGlmIChpc0FzeW5jKSB7IHRoaXMubmV4dCgpOyB9XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUZ1bmN0aW9uKGZOb2RlLCBGVU5DX1NUQVRFTUVOVCB8IEZVTkNfTlVMTEFCTEVfSUQsIGZhbHNlLCBpc0FzeW5jKVxuICAgIH0gZWxzZSBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLl9jbGFzcykge1xuICAgICAgdmFyIGNOb2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlQ2xhc3MoY05vZGUsIFwibnVsbGFibGVJRFwiKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZGVjbGFyYXRpb24gPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oKTtcbiAgICAgIHRoaXMuc2VtaWNvbG9uKCk7XG4gICAgICByZXR1cm4gZGVjbGFyYXRpb25cbiAgICB9XG4gIH07XG5cbiAgcHAkOC5jaGVja0V4cG9ydCA9IGZ1bmN0aW9uKGV4cG9ydHMsIG5hbWUsIHBvcykge1xuICAgIGlmICghZXhwb3J0cykgeyByZXR1cm4gfVxuICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gXCJzdHJpbmdcIilcbiAgICAgIHsgbmFtZSA9IG5hbWUudHlwZSA9PT0gXCJJZGVudGlmaWVyXCIgPyBuYW1lLm5hbWUgOiBuYW1lLnZhbHVlOyB9XG4gICAgaWYgKGhhc093bihleHBvcnRzLCBuYW1lKSlcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHBvcywgXCJEdXBsaWNhdGUgZXhwb3J0ICdcIiArIG5hbWUgKyBcIidcIik7IH1cbiAgICBleHBvcnRzW25hbWVdID0gdHJ1ZTtcbiAgfTtcblxuICBwcCQ4LmNoZWNrUGF0dGVybkV4cG9ydCA9IGZ1bmN0aW9uKGV4cG9ydHMsIHBhdCkge1xuICAgIHZhciB0eXBlID0gcGF0LnR5cGU7XG4gICAgaWYgKHR5cGUgPT09IFwiSWRlbnRpZmllclwiKVxuICAgICAgeyB0aGlzLmNoZWNrRXhwb3J0KGV4cG9ydHMsIHBhdCwgcGF0LnN0YXJ0KTsgfVxuICAgIGVsc2UgaWYgKHR5cGUgPT09IFwiT2JqZWN0UGF0dGVyblwiKVxuICAgICAgeyBmb3IgKHZhciBpID0gMCwgbGlzdCA9IHBhdC5wcm9wZXJ0aWVzOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gMSlcbiAgICAgICAge1xuICAgICAgICAgIHZhciBwcm9wID0gbGlzdFtpXTtcblxuICAgICAgICAgIHRoaXMuY2hlY2tQYXR0ZXJuRXhwb3J0KGV4cG9ydHMsIHByb3ApO1xuICAgICAgICB9IH1cbiAgICBlbHNlIGlmICh0eXBlID09PSBcIkFycmF5UGF0dGVyblwiKVxuICAgICAgeyBmb3IgKHZhciBpJDEgPSAwLCBsaXN0JDEgPSBwYXQuZWxlbWVudHM7IGkkMSA8IGxpc3QkMS5sZW5ndGg7IGkkMSArPSAxKSB7XG4gICAgICAgIHZhciBlbHQgPSBsaXN0JDFbaSQxXTtcblxuICAgICAgICAgIGlmIChlbHQpIHsgdGhpcy5jaGVja1BhdHRlcm5FeHBvcnQoZXhwb3J0cywgZWx0KTsgfVxuICAgICAgfSB9XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gXCJQcm9wZXJ0eVwiKVxuICAgICAgeyB0aGlzLmNoZWNrUGF0dGVybkV4cG9ydChleHBvcnRzLCBwYXQudmFsdWUpOyB9XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gXCJBc3NpZ25tZW50UGF0dGVyblwiKVxuICAgICAgeyB0aGlzLmNoZWNrUGF0dGVybkV4cG9ydChleHBvcnRzLCBwYXQubGVmdCk7IH1cbiAgICBlbHNlIGlmICh0eXBlID09PSBcIlJlc3RFbGVtZW50XCIpXG4gICAgICB7IHRoaXMuY2hlY2tQYXR0ZXJuRXhwb3J0KGV4cG9ydHMsIHBhdC5hcmd1bWVudCk7IH1cbiAgICBlbHNlIGlmICh0eXBlID09PSBcIlBhcmVudGhlc2l6ZWRFeHByZXNzaW9uXCIpXG4gICAgICB7IHRoaXMuY2hlY2tQYXR0ZXJuRXhwb3J0KGV4cG9ydHMsIHBhdC5leHByZXNzaW9uKTsgfVxuICB9O1xuXG4gIHBwJDguY2hlY2tWYXJpYWJsZUV4cG9ydCA9IGZ1bmN0aW9uKGV4cG9ydHMsIGRlY2xzKSB7XG4gICAgaWYgKCFleHBvcnRzKSB7IHJldHVybiB9XG4gICAgZm9yICh2YXIgaSA9IDAsIGxpc3QgPSBkZWNsczsgaSA8IGxpc3QubGVuZ3RoOyBpICs9IDEpXG4gICAgICB7XG4gICAgICB2YXIgZGVjbCA9IGxpc3RbaV07XG5cbiAgICAgIHRoaXMuY2hlY2tQYXR0ZXJuRXhwb3J0KGV4cG9ydHMsIGRlY2wuaWQpO1xuICAgIH1cbiAgfTtcblxuICBwcCQ4LnNob3VsZFBhcnNlRXhwb3J0U3RhdGVtZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZS5rZXl3b3JkID09PSBcInZhclwiIHx8XG4gICAgICB0aGlzLnR5cGUua2V5d29yZCA9PT0gXCJjb25zdFwiIHx8XG4gICAgICB0aGlzLnR5cGUua2V5d29yZCA9PT0gXCJjbGFzc1wiIHx8XG4gICAgICB0aGlzLnR5cGUua2V5d29yZCA9PT0gXCJmdW5jdGlvblwiIHx8XG4gICAgICB0aGlzLmlzTGV0KCkgfHxcbiAgICAgIHRoaXMuaXNBc3luY0Z1bmN0aW9uKClcbiAgfTtcblxuICAvLyBQYXJzZXMgYSBjb21tYS1zZXBhcmF0ZWQgbGlzdCBvZiBtb2R1bGUgZXhwb3J0cy5cblxuICBwcCQ4LnBhcnNlRXhwb3J0U3BlY2lmaWVyID0gZnVuY3Rpb24oZXhwb3J0cykge1xuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICBub2RlLmxvY2FsID0gdGhpcy5wYXJzZU1vZHVsZUV4cG9ydE5hbWUoKTtcblxuICAgIG5vZGUuZXhwb3J0ZWQgPSB0aGlzLmVhdENvbnRleHR1YWwoXCJhc1wiKSA/IHRoaXMucGFyc2VNb2R1bGVFeHBvcnROYW1lKCkgOiBub2RlLmxvY2FsO1xuICAgIHRoaXMuY2hlY2tFeHBvcnQoXG4gICAgICBleHBvcnRzLFxuICAgICAgbm9kZS5leHBvcnRlZCxcbiAgICAgIG5vZGUuZXhwb3J0ZWQuc3RhcnRcbiAgICApO1xuXG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkV4cG9ydFNwZWNpZmllclwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VFeHBvcnRTcGVjaWZpZXJzID0gZnVuY3Rpb24oZXhwb3J0cykge1xuICAgIHZhciBub2RlcyA9IFtdLCBmaXJzdCA9IHRydWU7XG4gICAgLy8gZXhwb3J0IHsgeCwgeSBhcyB6IH0gW2Zyb20gJy4uLiddXG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5icmFjZUwpO1xuICAgIHdoaWxlICghdGhpcy5lYXQodHlwZXMkMS5icmFjZVIpKSB7XG4gICAgICBpZiAoIWZpcnN0KSB7XG4gICAgICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuY29tbWEpO1xuICAgICAgICBpZiAodGhpcy5hZnRlclRyYWlsaW5nQ29tbWEodHlwZXMkMS5icmFjZVIpKSB7IGJyZWFrIH1cbiAgICAgIH0gZWxzZSB7IGZpcnN0ID0gZmFsc2U7IH1cblxuICAgICAgbm9kZXMucHVzaCh0aGlzLnBhcnNlRXhwb3J0U3BlY2lmaWVyKGV4cG9ydHMpKTtcbiAgICB9XG4gICAgcmV0dXJuIG5vZGVzXG4gIH07XG5cbiAgLy8gUGFyc2VzIGltcG9ydCBkZWNsYXJhdGlvbi5cblxuICBwcCQ4LnBhcnNlSW1wb3J0ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpO1xuXG4gICAgLy8gaW1wb3J0ICcuLi4nXG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5zdHJpbmcpIHtcbiAgICAgIG5vZGUuc3BlY2lmaWVycyA9IGVtcHR5JDE7XG4gICAgICBub2RlLnNvdXJjZSA9IHRoaXMucGFyc2VFeHByQXRvbSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBub2RlLnNwZWNpZmllcnMgPSB0aGlzLnBhcnNlSW1wb3J0U3BlY2lmaWVycygpO1xuICAgICAgdGhpcy5leHBlY3RDb250ZXh0dWFsKFwiZnJvbVwiKTtcbiAgICAgIG5vZGUuc291cmNlID0gdGhpcy50eXBlID09PSB0eXBlcyQxLnN0cmluZyA/IHRoaXMucGFyc2VFeHByQXRvbSgpIDogdGhpcy51bmV4cGVjdGVkKCk7XG4gICAgfVxuICAgIHRoaXMuc2VtaWNvbG9uKCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkltcG9ydERlY2xhcmF0aW9uXCIpXG4gIH07XG5cbiAgLy8gUGFyc2VzIGEgY29tbWEtc2VwYXJhdGVkIGxpc3Qgb2YgbW9kdWxlIGltcG9ydHMuXG5cbiAgcHAkOC5wYXJzZUltcG9ydFNwZWNpZmllciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICBub2RlLmltcG9ydGVkID0gdGhpcy5wYXJzZU1vZHVsZUV4cG9ydE5hbWUoKTtcblxuICAgIGlmICh0aGlzLmVhdENvbnRleHR1YWwoXCJhc1wiKSkge1xuICAgICAgbm9kZS5sb2NhbCA9IHRoaXMucGFyc2VJZGVudCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNoZWNrVW5yZXNlcnZlZChub2RlLmltcG9ydGVkKTtcbiAgICAgIG5vZGUubG9jYWwgPSBub2RlLmltcG9ydGVkO1xuICAgIH1cbiAgICB0aGlzLmNoZWNrTFZhbFNpbXBsZShub2RlLmxvY2FsLCBCSU5EX0xFWElDQUwpO1xuXG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkltcG9ydFNwZWNpZmllclwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VJbXBvcnREZWZhdWx0U3BlY2lmaWVyID0gZnVuY3Rpb24oKSB7XG4gICAgLy8gaW1wb3J0IGRlZmF1bHRPYmosIHsgeCwgeSBhcyB6IH0gZnJvbSAnLi4uJ1xuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICBub2RlLmxvY2FsID0gdGhpcy5wYXJzZUlkZW50KCk7XG4gICAgdGhpcy5jaGVja0xWYWxTaW1wbGUobm9kZS5sb2NhbCwgQklORF9MRVhJQ0FMKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiSW1wb3J0RGVmYXVsdFNwZWNpZmllclwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgdGhpcy5leHBlY3RDb250ZXh0dWFsKFwiYXNcIik7XG4gICAgbm9kZS5sb2NhbCA9IHRoaXMucGFyc2VJZGVudCgpO1xuICAgIHRoaXMuY2hlY2tMVmFsU2ltcGxlKG5vZGUubG9jYWwsIEJJTkRfTEVYSUNBTCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkltcG9ydE5hbWVzcGFjZVNwZWNpZmllclwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VJbXBvcnRTcGVjaWZpZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG5vZGVzID0gW10sIGZpcnN0ID0gdHJ1ZTtcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLm5hbWUpIHtcbiAgICAgIG5vZGVzLnB1c2godGhpcy5wYXJzZUltcG9ydERlZmF1bHRTcGVjaWZpZXIoKSk7XG4gICAgICBpZiAoIXRoaXMuZWF0KHR5cGVzJDEuY29tbWEpKSB7IHJldHVybiBub2RlcyB9XG4gICAgfVxuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuc3Rhcikge1xuICAgICAgbm9kZXMucHVzaCh0aGlzLnBhcnNlSW1wb3J0TmFtZXNwYWNlU3BlY2lmaWVyKCkpO1xuICAgICAgcmV0dXJuIG5vZGVzXG4gICAgfVxuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuYnJhY2VMKTtcbiAgICB3aGlsZSAoIXRoaXMuZWF0KHR5cGVzJDEuYnJhY2VSKSkge1xuICAgICAgaWYgKCFmaXJzdCkge1xuICAgICAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmNvbW1hKTtcbiAgICAgICAgaWYgKHRoaXMuYWZ0ZXJUcmFpbGluZ0NvbW1hKHR5cGVzJDEuYnJhY2VSKSkgeyBicmVhayB9XG4gICAgICB9IGVsc2UgeyBmaXJzdCA9IGZhbHNlOyB9XG5cbiAgICAgIG5vZGVzLnB1c2godGhpcy5wYXJzZUltcG9ydFNwZWNpZmllcigpKTtcbiAgICB9XG4gICAgcmV0dXJuIG5vZGVzXG4gIH07XG5cbiAgcHAkOC5wYXJzZU1vZHVsZUV4cG9ydE5hbWUgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDEzICYmIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5zdHJpbmcpIHtcbiAgICAgIHZhciBzdHJpbmdMaXRlcmFsID0gdGhpcy5wYXJzZUxpdGVyYWwodGhpcy52YWx1ZSk7XG4gICAgICBpZiAobG9uZVN1cnJvZ2F0ZS50ZXN0KHN0cmluZ0xpdGVyYWwudmFsdWUpKSB7XG4gICAgICAgIHRoaXMucmFpc2Uoc3RyaW5nTGl0ZXJhbC5zdGFydCwgXCJBbiBleHBvcnQgbmFtZSBjYW5ub3QgaW5jbHVkZSBhIGxvbmUgc3Vycm9nYXRlLlwiKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdHJpbmdMaXRlcmFsXG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBhcnNlSWRlbnQodHJ1ZSlcbiAgfTtcblxuICAvLyBTZXQgYEV4cHJlc3Npb25TdGF0ZW1lbnQjZGlyZWN0aXZlYCBwcm9wZXJ0eSBmb3IgZGlyZWN0aXZlIHByb2xvZ3Vlcy5cbiAgcHAkOC5hZGFwdERpcmVjdGl2ZVByb2xvZ3VlID0gZnVuY3Rpb24oc3RhdGVtZW50cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RhdGVtZW50cy5sZW5ndGggJiYgdGhpcy5pc0RpcmVjdGl2ZUNhbmRpZGF0ZShzdGF0ZW1lbnRzW2ldKTsgKytpKSB7XG4gICAgICBzdGF0ZW1lbnRzW2ldLmRpcmVjdGl2ZSA9IHN0YXRlbWVudHNbaV0uZXhwcmVzc2lvbi5yYXcuc2xpY2UoMSwgLTEpO1xuICAgIH1cbiAgfTtcbiAgcHAkOC5pc0RpcmVjdGl2ZUNhbmRpZGF0ZSA9IGZ1bmN0aW9uKHN0YXRlbWVudCkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNSAmJlxuICAgICAgc3RhdGVtZW50LnR5cGUgPT09IFwiRXhwcmVzc2lvblN0YXRlbWVudFwiICYmXG4gICAgICBzdGF0ZW1lbnQuZXhwcmVzc2lvbi50eXBlID09PSBcIkxpdGVyYWxcIiAmJlxuICAgICAgdHlwZW9mIHN0YXRlbWVudC5leHByZXNzaW9uLnZhbHVlID09PSBcInN0cmluZ1wiICYmXG4gICAgICAvLyBSZWplY3QgcGFyZW50aGVzaXplZCBzdHJpbmdzLlxuICAgICAgKHRoaXMuaW5wdXRbc3RhdGVtZW50LnN0YXJ0XSA9PT0gXCJcXFwiXCIgfHwgdGhpcy5pbnB1dFtzdGF0ZW1lbnQuc3RhcnRdID09PSBcIidcIilcbiAgICApXG4gIH07XG5cbiAgdmFyIHBwJDcgPSBQYXJzZXIucHJvdG90eXBlO1xuXG4gIC8vIENvbnZlcnQgZXhpc3RpbmcgZXhwcmVzc2lvbiBhdG9tIHRvIGFzc2lnbmFibGUgcGF0dGVyblxuICAvLyBpZiBwb3NzaWJsZS5cblxuICBwcCQ3LnRvQXNzaWduYWJsZSA9IGZ1bmN0aW9uKG5vZGUsIGlzQmluZGluZywgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykge1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNiAmJiBub2RlKSB7XG4gICAgICBzd2l0Y2ggKG5vZGUudHlwZSkge1xuICAgICAgY2FzZSBcIklkZW50aWZpZXJcIjpcbiAgICAgICAgaWYgKHRoaXMuaW5Bc3luYyAmJiBub2RlLm5hbWUgPT09IFwiYXdhaXRcIilcbiAgICAgICAgICB7IHRoaXMucmFpc2Uobm9kZS5zdGFydCwgXCJDYW5ub3QgdXNlICdhd2FpdCcgYXMgaWRlbnRpZmllciBpbnNpZGUgYW4gYXN5bmMgZnVuY3Rpb25cIik7IH1cbiAgICAgICAgYnJlYWtcblxuICAgICAgY2FzZSBcIk9iamVjdFBhdHRlcm5cIjpcbiAgICAgIGNhc2UgXCJBcnJheVBhdHRlcm5cIjpcbiAgICAgIGNhc2UgXCJBc3NpZ25tZW50UGF0dGVyblwiOlxuICAgICAgY2FzZSBcIlJlc3RFbGVtZW50XCI6XG4gICAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgXCJPYmplY3RFeHByZXNzaW9uXCI6XG4gICAgICAgIG5vZGUudHlwZSA9IFwiT2JqZWN0UGF0dGVyblwiO1xuICAgICAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykgeyB0aGlzLmNoZWNrUGF0dGVybkVycm9ycyhyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCB0cnVlKTsgfVxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGlzdCA9IG5vZGUucHJvcGVydGllczsgaSA8IGxpc3QubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICB2YXIgcHJvcCA9IGxpc3RbaV07XG5cbiAgICAgICAgdGhpcy50b0Fzc2lnbmFibGUocHJvcCwgaXNCaW5kaW5nKTtcbiAgICAgICAgICAvLyBFYXJseSBlcnJvcjpcbiAgICAgICAgICAvLyAgIEFzc2lnbm1lbnRSZXN0UHJvcGVydHlbWWllbGQsIEF3YWl0XSA6XG4gICAgICAgICAgLy8gICAgIGAuLi5gIERlc3RydWN0dXJpbmdBc3NpZ25tZW50VGFyZ2V0W1lpZWxkLCBBd2FpdF1cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vICAgSXQgaXMgYSBTeW50YXggRXJyb3IgaWYgfERlc3RydWN0dXJpbmdBc3NpZ25tZW50VGFyZ2V0fCBpcyBhbiB8QXJyYXlMaXRlcmFsfCBvciBhbiB8T2JqZWN0TGl0ZXJhbHwuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgcHJvcC50eXBlID09PSBcIlJlc3RFbGVtZW50XCIgJiZcbiAgICAgICAgICAgIChwcm9wLmFyZ3VtZW50LnR5cGUgPT09IFwiQXJyYXlQYXR0ZXJuXCIgfHwgcHJvcC5hcmd1bWVudC50eXBlID09PSBcIk9iamVjdFBhdHRlcm5cIilcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHRoaXMucmFpc2UocHJvcC5hcmd1bWVudC5zdGFydCwgXCJVbmV4cGVjdGVkIHRva2VuXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVha1xuXG4gICAgICBjYXNlIFwiUHJvcGVydHlcIjpcbiAgICAgICAgLy8gQXNzaWdubWVudFByb3BlcnR5IGhhcyB0eXBlID09PSBcIlByb3BlcnR5XCJcbiAgICAgICAgaWYgKG5vZGUua2luZCAhPT0gXCJpbml0XCIpIHsgdGhpcy5yYWlzZShub2RlLmtleS5zdGFydCwgXCJPYmplY3QgcGF0dGVybiBjYW4ndCBjb250YWluIGdldHRlciBvciBzZXR0ZXJcIik7IH1cbiAgICAgICAgdGhpcy50b0Fzc2lnbmFibGUobm9kZS52YWx1ZSwgaXNCaW5kaW5nKTtcbiAgICAgICAgYnJlYWtcblxuICAgICAgY2FzZSBcIkFycmF5RXhwcmVzc2lvblwiOlxuICAgICAgICBub2RlLnR5cGUgPSBcIkFycmF5UGF0dGVyblwiO1xuICAgICAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykgeyB0aGlzLmNoZWNrUGF0dGVybkVycm9ycyhyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCB0cnVlKTsgfVxuICAgICAgICB0aGlzLnRvQXNzaWduYWJsZUxpc3Qobm9kZS5lbGVtZW50cywgaXNCaW5kaW5nKTtcbiAgICAgICAgYnJlYWtcblxuICAgICAgY2FzZSBcIlNwcmVhZEVsZW1lbnRcIjpcbiAgICAgICAgbm9kZS50eXBlID0gXCJSZXN0RWxlbWVudFwiO1xuICAgICAgICB0aGlzLnRvQXNzaWduYWJsZShub2RlLmFyZ3VtZW50LCBpc0JpbmRpbmcpO1xuICAgICAgICBpZiAobm9kZS5hcmd1bWVudC50eXBlID09PSBcIkFzc2lnbm1lbnRQYXR0ZXJuXCIpXG4gICAgICAgICAgeyB0aGlzLnJhaXNlKG5vZGUuYXJndW1lbnQuc3RhcnQsIFwiUmVzdCBlbGVtZW50cyBjYW5ub3QgaGF2ZSBhIGRlZmF1bHQgdmFsdWVcIik7IH1cbiAgICAgICAgYnJlYWtcblxuICAgICAgY2FzZSBcIkFzc2lnbm1lbnRFeHByZXNzaW9uXCI6XG4gICAgICAgIGlmIChub2RlLm9wZXJhdG9yICE9PSBcIj1cIikgeyB0aGlzLnJhaXNlKG5vZGUubGVmdC5lbmQsIFwiT25seSAnPScgb3BlcmF0b3IgY2FuIGJlIHVzZWQgZm9yIHNwZWNpZnlpbmcgZGVmYXVsdCB2YWx1ZS5cIik7IH1cbiAgICAgICAgbm9kZS50eXBlID0gXCJBc3NpZ25tZW50UGF0dGVyblwiO1xuICAgICAgICBkZWxldGUgbm9kZS5vcGVyYXRvcjtcbiAgICAgICAgdGhpcy50b0Fzc2lnbmFibGUobm9kZS5sZWZ0LCBpc0JpbmRpbmcpO1xuICAgICAgICBicmVha1xuXG4gICAgICBjYXNlIFwiUGFyZW50aGVzaXplZEV4cHJlc3Npb25cIjpcbiAgICAgICAgdGhpcy50b0Fzc2lnbmFibGUobm9kZS5leHByZXNzaW9uLCBpc0JpbmRpbmcsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpO1xuICAgICAgICBicmVha1xuXG4gICAgICBjYXNlIFwiQ2hhaW5FeHByZXNzaW9uXCI6XG4gICAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZShub2RlLnN0YXJ0LCBcIk9wdGlvbmFsIGNoYWluaW5nIGNhbm5vdCBhcHBlYXIgaW4gbGVmdC1oYW5kIHNpZGVcIik7XG4gICAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgXCJNZW1iZXJFeHByZXNzaW9uXCI6XG4gICAgICAgIGlmICghaXNCaW5kaW5nKSB7IGJyZWFrIH1cblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhpcy5yYWlzZShub2RlLnN0YXJ0LCBcIkFzc2lnbmluZyB0byBydmFsdWVcIik7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7IHRoaXMuY2hlY2tQYXR0ZXJuRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIHRydWUpOyB9XG4gICAgcmV0dXJuIG5vZGVcbiAgfTtcblxuICAvLyBDb252ZXJ0IGxpc3Qgb2YgZXhwcmVzc2lvbiBhdG9tcyB0byBiaW5kaW5nIGxpc3QuXG5cbiAgcHAkNy50b0Fzc2lnbmFibGVMaXN0ID0gZnVuY3Rpb24oZXhwckxpc3QsIGlzQmluZGluZykge1xuICAgIHZhciBlbmQgPSBleHByTGlzdC5sZW5ndGg7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdmFyIGVsdCA9IGV4cHJMaXN0W2ldO1xuICAgICAgaWYgKGVsdCkgeyB0aGlzLnRvQXNzaWduYWJsZShlbHQsIGlzQmluZGluZyk7IH1cbiAgICB9XG4gICAgaWYgKGVuZCkge1xuICAgICAgdmFyIGxhc3QgPSBleHByTGlzdFtlbmQgLSAxXTtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPT09IDYgJiYgaXNCaW5kaW5nICYmIGxhc3QgJiYgbGFzdC50eXBlID09PSBcIlJlc3RFbGVtZW50XCIgJiYgbGFzdC5hcmd1bWVudC50eXBlICE9PSBcIklkZW50aWZpZXJcIilcbiAgICAgICAgeyB0aGlzLnVuZXhwZWN0ZWQobGFzdC5hcmd1bWVudC5zdGFydCk7IH1cbiAgICB9XG4gICAgcmV0dXJuIGV4cHJMaXN0XG4gIH07XG5cbiAgLy8gUGFyc2VzIHNwcmVhZCBlbGVtZW50LlxuXG4gIHBwJDcucGFyc2VTcHJlYWQgPSBmdW5jdGlvbihyZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIHRoaXMubmV4dCgpO1xuICAgIG5vZGUuYXJndW1lbnQgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oZmFsc2UsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJTcHJlYWRFbGVtZW50XCIpXG4gIH07XG5cbiAgcHAkNy5wYXJzZVJlc3RCaW5kaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIHRoaXMubmV4dCgpO1xuXG4gICAgLy8gUmVzdEVsZW1lbnQgaW5zaWRlIG9mIGEgZnVuY3Rpb24gcGFyYW1ldGVyIG11c3QgYmUgYW4gaWRlbnRpZmllclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPT09IDYgJiYgdGhpcy50eXBlICE9PSB0eXBlcyQxLm5hbWUpXG4gICAgICB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG5cbiAgICBub2RlLmFyZ3VtZW50ID0gdGhpcy5wYXJzZUJpbmRpbmdBdG9tKCk7XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiUmVzdEVsZW1lbnRcIilcbiAgfTtcblxuICAvLyBQYXJzZXMgbHZhbHVlIChhc3NpZ25hYmxlKSBhdG9tLlxuXG4gIHBwJDcucGFyc2VCaW5kaW5nQXRvbSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNikge1xuICAgICAgc3dpdGNoICh0aGlzLnR5cGUpIHtcbiAgICAgIGNhc2UgdHlwZXMkMS5icmFja2V0TDpcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgICAgICB0aGlzLm5leHQoKTtcbiAgICAgICAgbm9kZS5lbGVtZW50cyA9IHRoaXMucGFyc2VCaW5kaW5nTGlzdCh0eXBlcyQxLmJyYWNrZXRSLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkFycmF5UGF0dGVyblwiKVxuXG4gICAgICBjYXNlIHR5cGVzJDEuYnJhY2VMOlxuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZU9iaih0cnVlKVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYXJzZUlkZW50KClcbiAgfTtcblxuICBwcCQ3LnBhcnNlQmluZGluZ0xpc3QgPSBmdW5jdGlvbihjbG9zZSwgYWxsb3dFbXB0eSwgYWxsb3dUcmFpbGluZ0NvbW1hLCBhbGxvd01vZGlmaWVycykge1xuICAgIHZhciBlbHRzID0gW10sIGZpcnN0ID0gdHJ1ZTtcbiAgICB3aGlsZSAoIXRoaXMuZWF0KGNsb3NlKSkge1xuICAgICAgaWYgKGZpcnN0KSB7IGZpcnN0ID0gZmFsc2U7IH1cbiAgICAgIGVsc2UgeyB0aGlzLmV4cGVjdCh0eXBlcyQxLmNvbW1hKTsgfVxuICAgICAgaWYgKGFsbG93RW1wdHkgJiYgdGhpcy50eXBlID09PSB0eXBlcyQxLmNvbW1hKSB7XG4gICAgICAgIGVsdHMucHVzaChudWxsKTtcbiAgICAgIH0gZWxzZSBpZiAoYWxsb3dUcmFpbGluZ0NvbW1hICYmIHRoaXMuYWZ0ZXJUcmFpbGluZ0NvbW1hKGNsb3NlKSkge1xuICAgICAgICBicmVha1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuZWxsaXBzaXMpIHtcbiAgICAgICAgdmFyIHJlc3QgPSB0aGlzLnBhcnNlUmVzdEJpbmRpbmcoKTtcbiAgICAgICAgdGhpcy5wYXJzZUJpbmRpbmdMaXN0SXRlbShyZXN0KTtcbiAgICAgICAgZWx0cy5wdXNoKHJlc3QpO1xuICAgICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmNvbW1hKSB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZSh0aGlzLnN0YXJ0LCBcIkNvbW1hIGlzIG5vdCBwZXJtaXR0ZWQgYWZ0ZXIgdGhlIHJlc3QgZWxlbWVudFwiKTsgfVxuICAgICAgICB0aGlzLmV4cGVjdChjbG9zZSk7XG4gICAgICAgIGJyZWFrXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbHRzLnB1c2godGhpcy5wYXJzZUFzc2lnbmFibGVMaXN0SXRlbShhbGxvd01vZGlmaWVycykpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZWx0c1xuICB9O1xuXG4gIHBwJDcucGFyc2VBc3NpZ25hYmxlTGlzdEl0ZW0gPSBmdW5jdGlvbihhbGxvd01vZGlmaWVycykge1xuICAgIHZhciBlbGVtID0gdGhpcy5wYXJzZU1heWJlRGVmYXVsdCh0aGlzLnN0YXJ0LCB0aGlzLnN0YXJ0TG9jKTtcbiAgICB0aGlzLnBhcnNlQmluZGluZ0xpc3RJdGVtKGVsZW0pO1xuICAgIHJldHVybiBlbGVtXG4gIH07XG5cbiAgcHAkNy5wYXJzZUJpbmRpbmdMaXN0SXRlbSA9IGZ1bmN0aW9uKHBhcmFtKSB7XG4gICAgcmV0dXJuIHBhcmFtXG4gIH07XG5cbiAgLy8gUGFyc2VzIGFzc2lnbm1lbnQgcGF0dGVybiBhcm91bmQgZ2l2ZW4gYXRvbSBpZiBwb3NzaWJsZS5cblxuICBwcCQ3LnBhcnNlTWF5YmVEZWZhdWx0ID0gZnVuY3Rpb24oc3RhcnRQb3MsIHN0YXJ0TG9jLCBsZWZ0KSB7XG4gICAgbGVmdCA9IGxlZnQgfHwgdGhpcy5wYXJzZUJpbmRpbmdBdG9tKCk7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA8IDYgfHwgIXRoaXMuZWF0KHR5cGVzJDEuZXEpKSB7IHJldHVybiBsZWZ0IH1cbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICBub2RlLmxlZnQgPSBsZWZ0O1xuICAgIG5vZGUucmlnaHQgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiQXNzaWdubWVudFBhdHRlcm5cIilcbiAgfTtcblxuICAvLyBUaGUgZm9sbG93aW5nIHRocmVlIGZ1bmN0aW9ucyBhbGwgdmVyaWZ5IHRoYXQgYSBub2RlIGlzIGFuIGx2YWx1ZSDigJRcbiAgLy8gc29tZXRoaW5nIHRoYXQgY2FuIGJlIGJvdW5kLCBvciBhc3NpZ25lZCB0by4gSW4gb3JkZXIgdG8gZG8gc28sIHRoZXkgcGVyZm9ybVxuICAvLyBhIHZhcmlldHkgb2YgY2hlY2tzOlxuICAvL1xuICAvLyAtIENoZWNrIHRoYXQgbm9uZSBvZiB0aGUgYm91bmQvYXNzaWduZWQtdG8gaWRlbnRpZmllcnMgYXJlIHJlc2VydmVkIHdvcmRzLlxuICAvLyAtIFJlY29yZCBuYW1lIGRlY2xhcmF0aW9ucyBmb3IgYmluZGluZ3MgaW4gdGhlIGFwcHJvcHJpYXRlIHNjb3BlLlxuICAvLyAtIENoZWNrIGR1cGxpY2F0ZSBhcmd1bWVudCBuYW1lcywgaWYgY2hlY2tDbGFzaGVzIGlzIHNldC5cbiAgLy9cbiAgLy8gSWYgYSBjb21wbGV4IGJpbmRpbmcgcGF0dGVybiBpcyBlbmNvdW50ZXJlZCAoZS5nLiwgb2JqZWN0IGFuZCBhcnJheVxuICAvLyBkZXN0cnVjdHVyaW5nKSwgdGhlIGVudGlyZSBwYXR0ZXJuIGlzIHJlY3Vyc2l2ZWx5IGNoZWNrZWQuXG4gIC8vXG4gIC8vIFRoZXJlIGFyZSB0aHJlZSB2ZXJzaW9ucyBvZiBjaGVja0xWYWwqKCkgYXBwcm9wcmlhdGUgZm9yIGRpZmZlcmVudFxuICAvLyBjaXJjdW1zdGFuY2VzOlxuICAvL1xuICAvLyAtIGNoZWNrTFZhbFNpbXBsZSgpIHNoYWxsIGJlIHVzZWQgaWYgdGhlIHN5bnRhY3RpYyBjb25zdHJ1Y3Qgc3VwcG9ydHNcbiAgLy8gICBub3RoaW5nIG90aGVyIHRoYW4gaWRlbnRpZmllcnMgYW5kIG1lbWJlciBleHByZXNzaW9ucy4gUGFyZW50aGVzaXplZFxuICAvLyAgIGV4cHJlc3Npb25zIGFyZSBhbHNvIGNvcnJlY3RseSBoYW5kbGVkLiBUaGlzIGlzIGdlbmVyYWxseSBhcHByb3ByaWF0ZSBmb3JcbiAgLy8gICBjb25zdHJ1Y3RzIGZvciB3aGljaCB0aGUgc3BlYyBzYXlzXG4gIC8vXG4gIC8vICAgPiBJdCBpcyBhIFN5bnRheCBFcnJvciBpZiBBc3NpZ25tZW50VGFyZ2V0VHlwZSBvZiBbdGhlIHByb2R1Y3Rpb25dIGlzIG5vdFxuICAvLyAgID4gc2ltcGxlLlxuICAvL1xuICAvLyAgIEl0IGlzIGFsc28gYXBwcm9wcmlhdGUgZm9yIGNoZWNraW5nIGlmIGFuIGlkZW50aWZpZXIgaXMgdmFsaWQgYW5kIG5vdFxuICAvLyAgIGRlZmluZWQgZWxzZXdoZXJlLCBsaWtlIGltcG9ydCBkZWNsYXJhdGlvbnMgb3IgZnVuY3Rpb24vY2xhc3MgaWRlbnRpZmllcnMuXG4gIC8vXG4gIC8vICAgRXhhbXBsZXMgd2hlcmUgdGhpcyBpcyB1c2VkIGluY2x1ZGU6XG4gIC8vICAgICBhICs9IOKApjtcbiAgLy8gICAgIGltcG9ydCBhIGZyb20gJ+KApic7XG4gIC8vICAgd2hlcmUgYSBpcyB0aGUgbm9kZSB0byBiZSBjaGVja2VkLlxuICAvL1xuICAvLyAtIGNoZWNrTFZhbFBhdHRlcm4oKSBzaGFsbCBiZSB1c2VkIGlmIHRoZSBzeW50YWN0aWMgY29uc3RydWN0IHN1cHBvcnRzXG4gIC8vICAgYW55dGhpbmcgY2hlY2tMVmFsU2ltcGxlKCkgc3VwcG9ydHMsIGFzIHdlbGwgYXMgb2JqZWN0IGFuZCBhcnJheVxuICAvLyAgIGRlc3RydWN0dXJpbmcgcGF0dGVybnMuIFRoaXMgaXMgZ2VuZXJhbGx5IGFwcHJvcHJpYXRlIGZvciBjb25zdHJ1Y3RzIGZvclxuICAvLyAgIHdoaWNoIHRoZSBzcGVjIHNheXNcbiAgLy9cbiAgLy8gICA+IEl0IGlzIGEgU3ludGF4IEVycm9yIGlmIFt0aGUgcHJvZHVjdGlvbl0gaXMgbmVpdGhlciBhbiBPYmplY3RMaXRlcmFsIG5vclxuICAvLyAgID4gYW4gQXJyYXlMaXRlcmFsIGFuZCBBc3NpZ25tZW50VGFyZ2V0VHlwZSBvZiBbdGhlIHByb2R1Y3Rpb25dIGlzIG5vdFxuICAvLyAgID4gc2ltcGxlLlxuICAvL1xuICAvLyAgIEV4YW1wbGVzIHdoZXJlIHRoaXMgaXMgdXNlZCBpbmNsdWRlOlxuICAvLyAgICAgKGEgPSDigKYpO1xuICAvLyAgICAgY29uc3QgYSA9IOKApjtcbiAgLy8gICAgIHRyeSB7IOKApiB9IGNhdGNoIChhKSB7IOKApiB9XG4gIC8vICAgd2hlcmUgYSBpcyB0aGUgbm9kZSB0byBiZSBjaGVja2VkLlxuICAvL1xuICAvLyAtIGNoZWNrTFZhbElubmVyUGF0dGVybigpIHNoYWxsIGJlIHVzZWQgaWYgdGhlIHN5bnRhY3RpYyBjb25zdHJ1Y3Qgc3VwcG9ydHNcbiAgLy8gICBhbnl0aGluZyBjaGVja0xWYWxQYXR0ZXJuKCkgc3VwcG9ydHMsIGFzIHdlbGwgYXMgZGVmYXVsdCBhc3NpZ25tZW50XG4gIC8vICAgcGF0dGVybnMsIHJlc3QgZWxlbWVudHMsIGFuZCBvdGhlciBjb25zdHJ1Y3RzIHRoYXQgbWF5IGFwcGVhciB3aXRoaW4gYW5cbiAgLy8gICBvYmplY3Qgb3IgYXJyYXkgZGVzdHJ1Y3R1cmluZyBwYXR0ZXJuLlxuICAvL1xuICAvLyAgIEFzIGEgc3BlY2lhbCBjYXNlLCBmdW5jdGlvbiBwYXJhbWV0ZXJzIGFsc28gdXNlIGNoZWNrTFZhbElubmVyUGF0dGVybigpLFxuICAvLyAgIGFzIHRoZXkgYWxzbyBzdXBwb3J0IGRlZmF1bHRzIGFuZCByZXN0IGNvbnN0cnVjdHMuXG4gIC8vXG4gIC8vIFRoZXNlIGZ1bmN0aW9ucyBkZWxpYmVyYXRlbHkgc3VwcG9ydCBib3RoIGFzc2lnbm1lbnQgYW5kIGJpbmRpbmcgY29uc3RydWN0cyxcbiAgLy8gYXMgdGhlIGxvZ2ljIGZvciBib3RoIGlzIGV4Y2VlZGluZ2x5IHNpbWlsYXIuIElmIHRoZSBub2RlIGlzIHRoZSB0YXJnZXQgb2ZcbiAgLy8gYW4gYXNzaWdubWVudCwgdGhlbiBiaW5kaW5nVHlwZSBzaG91bGQgYmUgc2V0IHRvIEJJTkRfTk9ORS4gT3RoZXJ3aXNlLCBpdFxuICAvLyBzaG91bGQgYmUgc2V0IHRvIHRoZSBhcHByb3ByaWF0ZSBCSU5EXyogY29uc3RhbnQsIGxpa2UgQklORF9WQVIgb3JcbiAgLy8gQklORF9MRVhJQ0FMLlxuICAvL1xuICAvLyBJZiB0aGUgZnVuY3Rpb24gaXMgY2FsbGVkIHdpdGggYSBub24tQklORF9OT05FIGJpbmRpbmdUeXBlLCB0aGVuXG4gIC8vIGFkZGl0aW9uYWxseSBhIGNoZWNrQ2xhc2hlcyBvYmplY3QgbWF5IGJlIHNwZWNpZmllZCB0byBhbGxvdyBjaGVja2luZyBmb3JcbiAgLy8gZHVwbGljYXRlIGFyZ3VtZW50IG5hbWVzLiBjaGVja0NsYXNoZXMgaXMgaWdub3JlZCBpZiB0aGUgcHJvdmlkZWQgY29uc3RydWN0XG4gIC8vIGlzIGFuIGFzc2lnbm1lbnQgKGkuZS4sIGJpbmRpbmdUeXBlIGlzIEJJTkRfTk9ORSkuXG5cbiAgcHAkNy5jaGVja0xWYWxTaW1wbGUgPSBmdW5jdGlvbihleHByLCBiaW5kaW5nVHlwZSwgY2hlY2tDbGFzaGVzKSB7XG4gICAgaWYgKCBiaW5kaW5nVHlwZSA9PT0gdm9pZCAwICkgYmluZGluZ1R5cGUgPSBCSU5EX05PTkU7XG5cbiAgICB2YXIgaXNCaW5kID0gYmluZGluZ1R5cGUgIT09IEJJTkRfTk9ORTtcblxuICAgIHN3aXRjaCAoZXhwci50eXBlKSB7XG4gICAgY2FzZSBcIklkZW50aWZpZXJcIjpcbiAgICAgIGlmICh0aGlzLnN0cmljdCAmJiB0aGlzLnJlc2VydmVkV29yZHNTdHJpY3RCaW5kLnRlc3QoZXhwci5uYW1lKSlcbiAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoZXhwci5zdGFydCwgKGlzQmluZCA/IFwiQmluZGluZyBcIiA6IFwiQXNzaWduaW5nIHRvIFwiKSArIGV4cHIubmFtZSArIFwiIGluIHN0cmljdCBtb2RlXCIpOyB9XG4gICAgICBpZiAoaXNCaW5kKSB7XG4gICAgICAgIGlmIChiaW5kaW5nVHlwZSA9PT0gQklORF9MRVhJQ0FMICYmIGV4cHIubmFtZSA9PT0gXCJsZXRcIilcbiAgICAgICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShleHByLnN0YXJ0LCBcImxldCBpcyBkaXNhbGxvd2VkIGFzIGEgbGV4aWNhbGx5IGJvdW5kIG5hbWVcIik7IH1cbiAgICAgICAgaWYgKGNoZWNrQ2xhc2hlcykge1xuICAgICAgICAgIGlmIChoYXNPd24oY2hlY2tDbGFzaGVzLCBleHByLm5hbWUpKVxuICAgICAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoZXhwci5zdGFydCwgXCJBcmd1bWVudCBuYW1lIGNsYXNoXCIpOyB9XG4gICAgICAgICAgY2hlY2tDbGFzaGVzW2V4cHIubmFtZV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChiaW5kaW5nVHlwZSAhPT0gQklORF9PVVRTSURFKSB7IHRoaXMuZGVjbGFyZU5hbWUoZXhwci5uYW1lLCBiaW5kaW5nVHlwZSwgZXhwci5zdGFydCk7IH1cbiAgICAgIH1cbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlIFwiQ2hhaW5FeHByZXNzaW9uXCI6XG4gICAgICB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoZXhwci5zdGFydCwgXCJPcHRpb25hbCBjaGFpbmluZyBjYW5ub3QgYXBwZWFyIGluIGxlZnQtaGFuZCBzaWRlXCIpO1xuICAgICAgYnJlYWtcblxuICAgIGNhc2UgXCJNZW1iZXJFeHByZXNzaW9uXCI6XG4gICAgICBpZiAoaXNCaW5kKSB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShleHByLnN0YXJ0LCBcIkJpbmRpbmcgbWVtYmVyIGV4cHJlc3Npb25cIik7IH1cbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlIFwiUGFyZW50aGVzaXplZEV4cHJlc3Npb25cIjpcbiAgICAgIGlmIChpc0JpbmQpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKGV4cHIuc3RhcnQsIFwiQmluZGluZyBwYXJlbnRoZXNpemVkIGV4cHJlc3Npb25cIik7IH1cbiAgICAgIHJldHVybiB0aGlzLmNoZWNrTFZhbFNpbXBsZShleHByLmV4cHJlc3Npb24sIGJpbmRpbmdUeXBlLCBjaGVja0NsYXNoZXMpXG5cbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy5yYWlzZShleHByLnN0YXJ0LCAoaXNCaW5kID8gXCJCaW5kaW5nXCIgOiBcIkFzc2lnbmluZyB0b1wiKSArIFwiIHJ2YWx1ZVwiKTtcbiAgICB9XG4gIH07XG5cbiAgcHAkNy5jaGVja0xWYWxQYXR0ZXJuID0gZnVuY3Rpb24oZXhwciwgYmluZGluZ1R5cGUsIGNoZWNrQ2xhc2hlcykge1xuICAgIGlmICggYmluZGluZ1R5cGUgPT09IHZvaWQgMCApIGJpbmRpbmdUeXBlID0gQklORF9OT05FO1xuXG4gICAgc3dpdGNoIChleHByLnR5cGUpIHtcbiAgICBjYXNlIFwiT2JqZWN0UGF0dGVyblwiOlxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxpc3QgPSBleHByLnByb3BlcnRpZXM7IGkgPCBsaXN0Lmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIHZhciBwcm9wID0gbGlzdFtpXTtcblxuICAgICAgdGhpcy5jaGVja0xWYWxJbm5lclBhdHRlcm4ocHJvcCwgYmluZGluZ1R5cGUsIGNoZWNrQ2xhc2hlcyk7XG4gICAgICB9XG4gICAgICBicmVha1xuXG4gICAgY2FzZSBcIkFycmF5UGF0dGVyblwiOlxuICAgICAgZm9yICh2YXIgaSQxID0gMCwgbGlzdCQxID0gZXhwci5lbGVtZW50czsgaSQxIDwgbGlzdCQxLmxlbmd0aDsgaSQxICs9IDEpIHtcbiAgICAgICAgdmFyIGVsZW0gPSBsaXN0JDFbaSQxXTtcblxuICAgICAgaWYgKGVsZW0pIHsgdGhpcy5jaGVja0xWYWxJbm5lclBhdHRlcm4oZWxlbSwgYmluZGluZ1R5cGUsIGNoZWNrQ2xhc2hlcyk7IH1cbiAgICAgIH1cbiAgICAgIGJyZWFrXG5cbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy5jaGVja0xWYWxTaW1wbGUoZXhwciwgYmluZGluZ1R5cGUsIGNoZWNrQ2xhc2hlcyk7XG4gICAgfVxuICB9O1xuXG4gIHBwJDcuY2hlY2tMVmFsSW5uZXJQYXR0ZXJuID0gZnVuY3Rpb24oZXhwciwgYmluZGluZ1R5cGUsIGNoZWNrQ2xhc2hlcykge1xuICAgIGlmICggYmluZGluZ1R5cGUgPT09IHZvaWQgMCApIGJpbmRpbmdUeXBlID0gQklORF9OT05FO1xuXG4gICAgc3dpdGNoIChleHByLnR5cGUpIHtcbiAgICBjYXNlIFwiUHJvcGVydHlcIjpcbiAgICAgIC8vIEFzc2lnbm1lbnRQcm9wZXJ0eSBoYXMgdHlwZSA9PT0gXCJQcm9wZXJ0eVwiXG4gICAgICB0aGlzLmNoZWNrTFZhbElubmVyUGF0dGVybihleHByLnZhbHVlLCBiaW5kaW5nVHlwZSwgY2hlY2tDbGFzaGVzKTtcbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlIFwiQXNzaWdubWVudFBhdHRlcm5cIjpcbiAgICAgIHRoaXMuY2hlY2tMVmFsUGF0dGVybihleHByLmxlZnQsIGJpbmRpbmdUeXBlLCBjaGVja0NsYXNoZXMpO1xuICAgICAgYnJlYWtcblxuICAgIGNhc2UgXCJSZXN0RWxlbWVudFwiOlxuICAgICAgdGhpcy5jaGVja0xWYWxQYXR0ZXJuKGV4cHIuYXJndW1lbnQsIGJpbmRpbmdUeXBlLCBjaGVja0NsYXNoZXMpO1xuICAgICAgYnJlYWtcblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aGlzLmNoZWNrTFZhbFBhdHRlcm4oZXhwciwgYmluZGluZ1R5cGUsIGNoZWNrQ2xhc2hlcyk7XG4gICAgfVxuICB9O1xuXG4gIC8vIFRoZSBhbGdvcml0aG0gdXNlZCB0byBkZXRlcm1pbmUgd2hldGhlciBhIHJlZ2V4cCBjYW4gYXBwZWFyIGF0IGFcbiAgLy8gZ2l2ZW4gcG9pbnQgaW4gdGhlIHByb2dyYW0gaXMgbG9vc2VseSBiYXNlZCBvbiBzd2VldC5qcycgYXBwcm9hY2guXG4gIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbW96aWxsYS9zd2VldC5qcy93aWtpL2Rlc2lnblxuXG5cbiAgdmFyIFRva0NvbnRleHQgPSBmdW5jdGlvbiBUb2tDb250ZXh0KHRva2VuLCBpc0V4cHIsIHByZXNlcnZlU3BhY2UsIG92ZXJyaWRlLCBnZW5lcmF0b3IpIHtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5pc0V4cHIgPSAhIWlzRXhwcjtcbiAgICB0aGlzLnByZXNlcnZlU3BhY2UgPSAhIXByZXNlcnZlU3BhY2U7XG4gICAgdGhpcy5vdmVycmlkZSA9IG92ZXJyaWRlO1xuICAgIHRoaXMuZ2VuZXJhdG9yID0gISFnZW5lcmF0b3I7XG4gIH07XG5cbiAgdmFyIHR5cGVzID0ge1xuICAgIGJfc3RhdDogbmV3IFRva0NvbnRleHQoXCJ7XCIsIGZhbHNlKSxcbiAgICBiX2V4cHI6IG5ldyBUb2tDb250ZXh0KFwie1wiLCB0cnVlKSxcbiAgICBiX3RtcGw6IG5ldyBUb2tDb250ZXh0KFwiJHtcIiwgZmFsc2UpLFxuICAgIHBfc3RhdDogbmV3IFRva0NvbnRleHQoXCIoXCIsIGZhbHNlKSxcbiAgICBwX2V4cHI6IG5ldyBUb2tDb250ZXh0KFwiKFwiLCB0cnVlKSxcbiAgICBxX3RtcGw6IG5ldyBUb2tDb250ZXh0KFwiYFwiLCB0cnVlLCB0cnVlLCBmdW5jdGlvbiAocCkgeyByZXR1cm4gcC50cnlSZWFkVGVtcGxhdGVUb2tlbigpOyB9KSxcbiAgICBmX3N0YXQ6IG5ldyBUb2tDb250ZXh0KFwiZnVuY3Rpb25cIiwgZmFsc2UpLFxuICAgIGZfZXhwcjogbmV3IFRva0NvbnRleHQoXCJmdW5jdGlvblwiLCB0cnVlKSxcbiAgICBmX2V4cHJfZ2VuOiBuZXcgVG9rQ29udGV4dChcImZ1bmN0aW9uXCIsIHRydWUsIGZhbHNlLCBudWxsLCB0cnVlKSxcbiAgICBmX2dlbjogbmV3IFRva0NvbnRleHQoXCJmdW5jdGlvblwiLCBmYWxzZSwgZmFsc2UsIG51bGwsIHRydWUpXG4gIH07XG5cbiAgdmFyIHBwJDYgPSBQYXJzZXIucHJvdG90eXBlO1xuXG4gIHBwJDYuaW5pdGlhbENvbnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gW3R5cGVzLmJfc3RhdF1cbiAgfTtcblxuICBwcCQ2LmN1ckNvbnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5jb250ZXh0W3RoaXMuY29udGV4dC5sZW5ndGggLSAxXVxuICB9O1xuXG4gIHBwJDYuYnJhY2VJc0Jsb2NrID0gZnVuY3Rpb24ocHJldlR5cGUpIHtcbiAgICB2YXIgcGFyZW50ID0gdGhpcy5jdXJDb250ZXh0KCk7XG4gICAgaWYgKHBhcmVudCA9PT0gdHlwZXMuZl9leHByIHx8IHBhcmVudCA9PT0gdHlwZXMuZl9zdGF0KVxuICAgICAgeyByZXR1cm4gdHJ1ZSB9XG4gICAgaWYgKHByZXZUeXBlID09PSB0eXBlcyQxLmNvbG9uICYmIChwYXJlbnQgPT09IHR5cGVzLmJfc3RhdCB8fCBwYXJlbnQgPT09IHR5cGVzLmJfZXhwcikpXG4gICAgICB7IHJldHVybiAhcGFyZW50LmlzRXhwciB9XG5cbiAgICAvLyBUaGUgY2hlY2sgZm9yIGB0dC5uYW1lICYmIGV4cHJBbGxvd2VkYCBkZXRlY3RzIHdoZXRoZXIgd2UgYXJlXG4gICAgLy8gYWZ0ZXIgYSBgeWllbGRgIG9yIGBvZmAgY29uc3RydWN0LiBTZWUgdGhlIGB1cGRhdGVDb250ZXh0YCBmb3JcbiAgICAvLyBgdHQubmFtZWAuXG4gICAgaWYgKHByZXZUeXBlID09PSB0eXBlcyQxLl9yZXR1cm4gfHwgcHJldlR5cGUgPT09IHR5cGVzJDEubmFtZSAmJiB0aGlzLmV4cHJBbGxvd2VkKVxuICAgICAgeyByZXR1cm4gbGluZUJyZWFrLnRlc3QodGhpcy5pbnB1dC5zbGljZSh0aGlzLmxhc3RUb2tFbmQsIHRoaXMuc3RhcnQpKSB9XG4gICAgaWYgKHByZXZUeXBlID09PSB0eXBlcyQxLl9lbHNlIHx8IHByZXZUeXBlID09PSB0eXBlcyQxLnNlbWkgfHwgcHJldlR5cGUgPT09IHR5cGVzJDEuZW9mIHx8IHByZXZUeXBlID09PSB0eXBlcyQxLnBhcmVuUiB8fCBwcmV2VHlwZSA9PT0gdHlwZXMkMS5hcnJvdylcbiAgICAgIHsgcmV0dXJuIHRydWUgfVxuICAgIGlmIChwcmV2VHlwZSA9PT0gdHlwZXMkMS5icmFjZUwpXG4gICAgICB7IHJldHVybiBwYXJlbnQgPT09IHR5cGVzLmJfc3RhdCB9XG4gICAgaWYgKHByZXZUeXBlID09PSB0eXBlcyQxLl92YXIgfHwgcHJldlR5cGUgPT09IHR5cGVzJDEuX2NvbnN0IHx8IHByZXZUeXBlID09PSB0eXBlcyQxLm5hbWUpXG4gICAgICB7IHJldHVybiBmYWxzZSB9XG4gICAgcmV0dXJuICF0aGlzLmV4cHJBbGxvd2VkXG4gIH07XG5cbiAgcHAkNi5pbkdlbmVyYXRvckNvbnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5jb250ZXh0Lmxlbmd0aCAtIDE7IGkgPj0gMTsgaS0tKSB7XG4gICAgICB2YXIgY29udGV4dCA9IHRoaXMuY29udGV4dFtpXTtcbiAgICAgIGlmIChjb250ZXh0LnRva2VuID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgIHsgcmV0dXJuIGNvbnRleHQuZ2VuZXJhdG9yIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgcHAkNi51cGRhdGVDb250ZXh0ID0gZnVuY3Rpb24ocHJldlR5cGUpIHtcbiAgICB2YXIgdXBkYXRlLCB0eXBlID0gdGhpcy50eXBlO1xuICAgIGlmICh0eXBlLmtleXdvcmQgJiYgcHJldlR5cGUgPT09IHR5cGVzJDEuZG90KVxuICAgICAgeyB0aGlzLmV4cHJBbGxvd2VkID0gZmFsc2U7IH1cbiAgICBlbHNlIGlmICh1cGRhdGUgPSB0eXBlLnVwZGF0ZUNvbnRleHQpXG4gICAgICB7IHVwZGF0ZS5jYWxsKHRoaXMsIHByZXZUeXBlKTsgfVxuICAgIGVsc2VcbiAgICAgIHsgdGhpcy5leHByQWxsb3dlZCA9IHR5cGUuYmVmb3JlRXhwcjsgfVxuICB9O1xuXG4gIC8vIFVzZWQgdG8gaGFuZGxlIGVnZGUgY2FzZXMgd2hlbiB0b2tlbiBjb250ZXh0IGNvdWxkIG5vdCBiZSBpbmZlcnJlZCBjb3JyZWN0bHkgZHVyaW5nIHRva2VuaXphdGlvbiBwaGFzZVxuXG4gIHBwJDYub3ZlcnJpZGVDb250ZXh0ID0gZnVuY3Rpb24odG9rZW5DdHgpIHtcbiAgICBpZiAodGhpcy5jdXJDb250ZXh0KCkgIT09IHRva2VuQ3R4KSB7XG4gICAgICB0aGlzLmNvbnRleHRbdGhpcy5jb250ZXh0Lmxlbmd0aCAtIDFdID0gdG9rZW5DdHg7XG4gICAgfVxuICB9O1xuXG4gIC8vIFRva2VuLXNwZWNpZmljIGNvbnRleHQgdXBkYXRlIGNvZGVcblxuICB0eXBlcyQxLnBhcmVuUi51cGRhdGVDb250ZXh0ID0gdHlwZXMkMS5icmFjZVIudXBkYXRlQ29udGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLmNvbnRleHQubGVuZ3RoID09PSAxKSB7XG4gICAgICB0aGlzLmV4cHJBbGxvd2VkID0gdHJ1ZTtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICB2YXIgb3V0ID0gdGhpcy5jb250ZXh0LnBvcCgpO1xuICAgIGlmIChvdXQgPT09IHR5cGVzLmJfc3RhdCAmJiB0aGlzLmN1ckNvbnRleHQoKS50b2tlbiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBvdXQgPSB0aGlzLmNvbnRleHQucG9wKCk7XG4gICAgfVxuICAgIHRoaXMuZXhwckFsbG93ZWQgPSAhb3V0LmlzRXhwcjtcbiAgfTtcblxuICB0eXBlcyQxLmJyYWNlTC51cGRhdGVDb250ZXh0ID0gZnVuY3Rpb24ocHJldlR5cGUpIHtcbiAgICB0aGlzLmNvbnRleHQucHVzaCh0aGlzLmJyYWNlSXNCbG9jayhwcmV2VHlwZSkgPyB0eXBlcy5iX3N0YXQgOiB0eXBlcy5iX2V4cHIpO1xuICAgIHRoaXMuZXhwckFsbG93ZWQgPSB0cnVlO1xuICB9O1xuXG4gIHR5cGVzJDEuZG9sbGFyQnJhY2VMLnVwZGF0ZUNvbnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNvbnRleHQucHVzaCh0eXBlcy5iX3RtcGwpO1xuICAgIHRoaXMuZXhwckFsbG93ZWQgPSB0cnVlO1xuICB9O1xuXG4gIHR5cGVzJDEucGFyZW5MLnVwZGF0ZUNvbnRleHQgPSBmdW5jdGlvbihwcmV2VHlwZSkge1xuICAgIHZhciBzdGF0ZW1lbnRQYXJlbnMgPSBwcmV2VHlwZSA9PT0gdHlwZXMkMS5faWYgfHwgcHJldlR5cGUgPT09IHR5cGVzJDEuX2ZvciB8fCBwcmV2VHlwZSA9PT0gdHlwZXMkMS5fd2l0aCB8fCBwcmV2VHlwZSA9PT0gdHlwZXMkMS5fd2hpbGU7XG4gICAgdGhpcy5jb250ZXh0LnB1c2goc3RhdGVtZW50UGFyZW5zID8gdHlwZXMucF9zdGF0IDogdHlwZXMucF9leHByKTtcbiAgICB0aGlzLmV4cHJBbGxvd2VkID0gdHJ1ZTtcbiAgfTtcblxuICB0eXBlcyQxLmluY0RlYy51cGRhdGVDb250ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgLy8gdG9rRXhwckFsbG93ZWQgc3RheXMgdW5jaGFuZ2VkXG4gIH07XG5cbiAgdHlwZXMkMS5fZnVuY3Rpb24udXBkYXRlQ29udGV4dCA9IHR5cGVzJDEuX2NsYXNzLnVwZGF0ZUNvbnRleHQgPSBmdW5jdGlvbihwcmV2VHlwZSkge1xuICAgIGlmIChwcmV2VHlwZS5iZWZvcmVFeHByICYmIHByZXZUeXBlICE9PSB0eXBlcyQxLl9lbHNlICYmXG4gICAgICAgICEocHJldlR5cGUgPT09IHR5cGVzJDEuc2VtaSAmJiB0aGlzLmN1ckNvbnRleHQoKSAhPT0gdHlwZXMucF9zdGF0KSAmJlxuICAgICAgICAhKHByZXZUeXBlID09PSB0eXBlcyQxLl9yZXR1cm4gJiYgbGluZUJyZWFrLnRlc3QodGhpcy5pbnB1dC5zbGljZSh0aGlzLmxhc3RUb2tFbmQsIHRoaXMuc3RhcnQpKSkgJiZcbiAgICAgICAgISgocHJldlR5cGUgPT09IHR5cGVzJDEuY29sb24gfHwgcHJldlR5cGUgPT09IHR5cGVzJDEuYnJhY2VMKSAmJiB0aGlzLmN1ckNvbnRleHQoKSA9PT0gdHlwZXMuYl9zdGF0KSlcbiAgICAgIHsgdGhpcy5jb250ZXh0LnB1c2godHlwZXMuZl9leHByKTsgfVxuICAgIGVsc2VcbiAgICAgIHsgdGhpcy5jb250ZXh0LnB1c2godHlwZXMuZl9zdGF0KTsgfVxuICAgIHRoaXMuZXhwckFsbG93ZWQgPSBmYWxzZTtcbiAgfTtcblxuICB0eXBlcyQxLmJhY2tRdW90ZS51cGRhdGVDb250ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuY3VyQ29udGV4dCgpID09PSB0eXBlcy5xX3RtcGwpXG4gICAgICB7IHRoaXMuY29udGV4dC5wb3AoKTsgfVxuICAgIGVsc2VcbiAgICAgIHsgdGhpcy5jb250ZXh0LnB1c2godHlwZXMucV90bXBsKTsgfVxuICAgIHRoaXMuZXhwckFsbG93ZWQgPSBmYWxzZTtcbiAgfTtcblxuICB0eXBlcyQxLnN0YXIudXBkYXRlQ29udGV4dCA9IGZ1bmN0aW9uKHByZXZUeXBlKSB7XG4gICAgaWYgKHByZXZUeXBlID09PSB0eXBlcyQxLl9mdW5jdGlvbikge1xuICAgICAgdmFyIGluZGV4ID0gdGhpcy5jb250ZXh0Lmxlbmd0aCAtIDE7XG4gICAgICBpZiAodGhpcy5jb250ZXh0W2luZGV4XSA9PT0gdHlwZXMuZl9leHByKVxuICAgICAgICB7IHRoaXMuY29udGV4dFtpbmRleF0gPSB0eXBlcy5mX2V4cHJfZ2VuOyB9XG4gICAgICBlbHNlXG4gICAgICAgIHsgdGhpcy5jb250ZXh0W2luZGV4XSA9IHR5cGVzLmZfZ2VuOyB9XG4gICAgfVxuICAgIHRoaXMuZXhwckFsbG93ZWQgPSB0cnVlO1xuICB9O1xuXG4gIHR5cGVzJDEubmFtZS51cGRhdGVDb250ZXh0ID0gZnVuY3Rpb24ocHJldlR5cGUpIHtcbiAgICB2YXIgYWxsb3dlZCA9IGZhbHNlO1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNiAmJiBwcmV2VHlwZSAhPT0gdHlwZXMkMS5kb3QpIHtcbiAgICAgIGlmICh0aGlzLnZhbHVlID09PSBcIm9mXCIgJiYgIXRoaXMuZXhwckFsbG93ZWQgfHxcbiAgICAgICAgICB0aGlzLnZhbHVlID09PSBcInlpZWxkXCIgJiYgdGhpcy5pbkdlbmVyYXRvckNvbnRleHQoKSlcbiAgICAgICAgeyBhbGxvd2VkID0gdHJ1ZTsgfVxuICAgIH1cbiAgICB0aGlzLmV4cHJBbGxvd2VkID0gYWxsb3dlZDtcbiAgfTtcblxuICAvLyBBIHJlY3Vyc2l2ZSBkZXNjZW50IHBhcnNlciBvcGVyYXRlcyBieSBkZWZpbmluZyBmdW5jdGlvbnMgZm9yIGFsbFxuICAvLyBzeW50YWN0aWMgZWxlbWVudHMsIGFuZCByZWN1cnNpdmVseSBjYWxsaW5nIHRob3NlLCBlYWNoIGZ1bmN0aW9uXG4gIC8vIGFkdmFuY2luZyB0aGUgaW5wdXQgc3RyZWFtIGFuZCByZXR1cm5pbmcgYW4gQVNUIG5vZGUuIFByZWNlZGVuY2VcbiAgLy8gb2YgY29uc3RydWN0cyAoZm9yIGV4YW1wbGUsIHRoZSBmYWN0IHRoYXQgYCF4WzFdYCBtZWFucyBgISh4WzFdKWBcbiAgLy8gaW5zdGVhZCBvZiBgKCF4KVsxXWAgaXMgaGFuZGxlZCBieSB0aGUgZmFjdCB0aGF0IHRoZSBwYXJzZXJcbiAgLy8gZnVuY3Rpb24gdGhhdCBwYXJzZXMgdW5hcnkgcHJlZml4IG9wZXJhdG9ycyBpcyBjYWxsZWQgZmlyc3QsIGFuZFxuICAvLyBpbiB0dXJuIGNhbGxzIHRoZSBmdW5jdGlvbiB0aGF0IHBhcnNlcyBgW11gIHN1YnNjcmlwdHMg4oCUIHRoYXRcbiAgLy8gd2F5LCBpdCdsbCByZWNlaXZlIHRoZSBub2RlIGZvciBgeFsxXWAgYWxyZWFkeSBwYXJzZWQsIGFuZCB3cmFwc1xuICAvLyAqdGhhdCogaW4gdGhlIHVuYXJ5IG9wZXJhdG9yIG5vZGUuXG4gIC8vXG4gIC8vIEFjb3JuIHVzZXMgYW4gW29wZXJhdG9yIHByZWNlZGVuY2UgcGFyc2VyXVtvcHBdIHRvIGhhbmRsZSBiaW5hcnlcbiAgLy8gb3BlcmF0b3IgcHJlY2VkZW5jZSwgYmVjYXVzZSBpdCBpcyBtdWNoIG1vcmUgY29tcGFjdCB0aGFuIHVzaW5nXG4gIC8vIHRoZSB0ZWNobmlxdWUgb3V0bGluZWQgYWJvdmUsIHdoaWNoIHVzZXMgZGlmZmVyZW50LCBuZXN0aW5nXG4gIC8vIGZ1bmN0aW9ucyB0byBzcGVjaWZ5IHByZWNlZGVuY2UsIGZvciBhbGwgb2YgdGhlIHRlbiBiaW5hcnlcbiAgLy8gcHJlY2VkZW5jZSBsZXZlbHMgdGhhdCBKYXZhU2NyaXB0IGRlZmluZXMuXG4gIC8vXG4gIC8vIFtvcHBdOiBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL09wZXJhdG9yLXByZWNlZGVuY2VfcGFyc2VyXG5cblxuICB2YXIgcHAkNSA9IFBhcnNlci5wcm90b3R5cGU7XG5cbiAgLy8gQ2hlY2sgaWYgcHJvcGVydHkgbmFtZSBjbGFzaGVzIHdpdGggYWxyZWFkeSBhZGRlZC5cbiAgLy8gT2JqZWN0L2NsYXNzIGdldHRlcnMgYW5kIHNldHRlcnMgYXJlIG5vdCBhbGxvd2VkIHRvIGNsYXNoIOKAlFxuICAvLyBlaXRoZXIgd2l0aCBlYWNoIG90aGVyIG9yIHdpdGggYW4gaW5pdCBwcm9wZXJ0eSDigJQgYW5kIGluXG4gIC8vIHN0cmljdCBtb2RlLCBpbml0IHByb3BlcnRpZXMgYXJlIGFsc28gbm90IGFsbG93ZWQgdG8gYmUgcmVwZWF0ZWQuXG5cbiAgcHAkNS5jaGVja1Byb3BDbGFzaCA9IGZ1bmN0aW9uKHByb3AsIHByb3BIYXNoLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5ICYmIHByb3AudHlwZSA9PT0gXCJTcHJlYWRFbGVtZW50XCIpXG4gICAgICB7IHJldHVybiB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ICYmIChwcm9wLmNvbXB1dGVkIHx8IHByb3AubWV0aG9kIHx8IHByb3Auc2hvcnRoYW5kKSlcbiAgICAgIHsgcmV0dXJuIH1cbiAgICB2YXIga2V5ID0gcHJvcC5rZXk7XG4gICAgdmFyIG5hbWU7XG4gICAgc3dpdGNoIChrZXkudHlwZSkge1xuICAgIGNhc2UgXCJJZGVudGlmaWVyXCI6IG5hbWUgPSBrZXkubmFtZTsgYnJlYWtcbiAgICBjYXNlIFwiTGl0ZXJhbFwiOiBuYW1lID0gU3RyaW5nKGtleS52YWx1ZSk7IGJyZWFrXG4gICAgZGVmYXVsdDogcmV0dXJuXG4gICAgfVxuICAgIHZhciBraW5kID0gcHJvcC5raW5kO1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNikge1xuICAgICAgaWYgKG5hbWUgPT09IFwiX19wcm90b19fXCIgJiYga2luZCA9PT0gXCJpbml0XCIpIHtcbiAgICAgICAgaWYgKHByb3BIYXNoLnByb3RvKSB7XG4gICAgICAgICAgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICAgICAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLmRvdWJsZVByb3RvIDwgMCkge1xuICAgICAgICAgICAgICByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLmRvdWJsZVByb3RvID0ga2V5LnN0YXJ0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoa2V5LnN0YXJ0LCBcIlJlZGVmaW5pdGlvbiBvZiBfX3Byb3RvX18gcHJvcGVydHlcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHByb3BIYXNoLnByb3RvID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBuYW1lID0gXCIkXCIgKyBuYW1lO1xuICAgIHZhciBvdGhlciA9IHByb3BIYXNoW25hbWVdO1xuICAgIGlmIChvdGhlcikge1xuICAgICAgdmFyIHJlZGVmaW5pdGlvbjtcbiAgICAgIGlmIChraW5kID09PSBcImluaXRcIikge1xuICAgICAgICByZWRlZmluaXRpb24gPSB0aGlzLnN0cmljdCAmJiBvdGhlci5pbml0IHx8IG90aGVyLmdldCB8fCBvdGhlci5zZXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWRlZmluaXRpb24gPSBvdGhlci5pbml0IHx8IG90aGVyW2tpbmRdO1xuICAgICAgfVxuICAgICAgaWYgKHJlZGVmaW5pdGlvbilcbiAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoa2V5LnN0YXJ0LCBcIlJlZGVmaW5pdGlvbiBvZiBwcm9wZXJ0eVwiKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlciA9IHByb3BIYXNoW25hbWVdID0ge1xuICAgICAgICBpbml0OiBmYWxzZSxcbiAgICAgICAgZ2V0OiBmYWxzZSxcbiAgICAgICAgc2V0OiBmYWxzZVxuICAgICAgfTtcbiAgICB9XG4gICAgb3RoZXJba2luZF0gPSB0cnVlO1xuICB9O1xuXG4gIC8vICMjIyBFeHByZXNzaW9uIHBhcnNpbmdcblxuICAvLyBUaGVzZSBuZXN0LCBmcm9tIHRoZSBtb3N0IGdlbmVyYWwgZXhwcmVzc2lvbiB0eXBlIGF0IHRoZSB0b3AgdG9cbiAgLy8gJ2F0b21pYycsIG5vbmRpdmlzaWJsZSBleHByZXNzaW9uIHR5cGVzIGF0IHRoZSBib3R0b20uIE1vc3Qgb2ZcbiAgLy8gdGhlIGZ1bmN0aW9ucyB3aWxsIHNpbXBseSBsZXQgdGhlIGZ1bmN0aW9uKHMpIGJlbG93IHRoZW0gcGFyc2UsXG4gIC8vIGFuZCwgKmlmKiB0aGUgc3ludGFjdGljIGNvbnN0cnVjdCB0aGV5IGhhbmRsZSBpcyBwcmVzZW50LCB3cmFwXG4gIC8vIHRoZSBBU1Qgbm9kZSB0aGF0IHRoZSBpbm5lciBwYXJzZXIgZ2F2ZSB0aGVtIGluIGFub3RoZXIgbm9kZS5cblxuICAvLyBQYXJzZSBhIGZ1bGwgZXhwcmVzc2lvbi4gVGhlIG9wdGlvbmFsIGFyZ3VtZW50cyBhcmUgdXNlZCB0b1xuICAvLyBmb3JiaWQgdGhlIGBpbmAgb3BlcmF0b3IgKGluIGZvciBsb29wcyBpbml0YWxpemF0aW9uIGV4cHJlc3Npb25zKVxuICAvLyBhbmQgcHJvdmlkZSByZWZlcmVuY2UgZm9yIHN0b3JpbmcgJz0nIG9wZXJhdG9yIGluc2lkZSBzaG9ydGhhbmRcbiAgLy8gcHJvcGVydHkgYXNzaWdubWVudCBpbiBjb250ZXh0cyB3aGVyZSBib3RoIG9iamVjdCBleHByZXNzaW9uXG4gIC8vIGFuZCBvYmplY3QgcGF0dGVybiBtaWdodCBhcHBlYXIgKHNvIGl0J3MgcG9zc2libGUgdG8gcmFpc2VcbiAgLy8gZGVsYXllZCBzeW50YXggZXJyb3IgYXQgY29ycmVjdCBwb3NpdGlvbikuXG5cbiAgcHAkNS5wYXJzZUV4cHJlc3Npb24gPSBmdW5jdGlvbihmb3JJbml0LCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7XG4gICAgdmFyIHN0YXJ0UG9zID0gdGhpcy5zdGFydCwgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jO1xuICAgIHZhciBleHByID0gdGhpcy5wYXJzZU1heWJlQXNzaWduKGZvckluaXQsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpO1xuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29tbWEpIHtcbiAgICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgbm9kZS5leHByZXNzaW9ucyA9IFtleHByXTtcbiAgICAgIHdoaWxlICh0aGlzLmVhdCh0eXBlcyQxLmNvbW1hKSkgeyBub2RlLmV4cHJlc3Npb25zLnB1c2godGhpcy5wYXJzZU1heWJlQXNzaWduKGZvckluaXQsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpKTsgfVxuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlNlcXVlbmNlRXhwcmVzc2lvblwiKVxuICAgIH1cbiAgICByZXR1cm4gZXhwclxuICB9O1xuXG4gIC8vIFBhcnNlIGFuIGFzc2lnbm1lbnQgZXhwcmVzc2lvbi4gVGhpcyBpbmNsdWRlcyBhcHBsaWNhdGlvbnMgb2ZcbiAgLy8gb3BlcmF0b3JzIGxpa2UgYCs9YC5cblxuICBwcCQ1LnBhcnNlTWF5YmVBc3NpZ24gPSBmdW5jdGlvbihmb3JJbml0LCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCBhZnRlckxlZnRQYXJzZSkge1xuICAgIGlmICh0aGlzLmlzQ29udGV4dHVhbChcInlpZWxkXCIpKSB7XG4gICAgICBpZiAodGhpcy5pbkdlbmVyYXRvcikgeyByZXR1cm4gdGhpcy5wYXJzZVlpZWxkKGZvckluaXQpIH1cbiAgICAgIC8vIFRoZSB0b2tlbml6ZXIgd2lsbCBhc3N1bWUgYW4gZXhwcmVzc2lvbiBpcyBhbGxvd2VkIGFmdGVyXG4gICAgICAvLyBgeWllbGRgLCBidXQgdGhpcyBpc24ndCB0aGF0IGtpbmQgb2YgeWllbGRcbiAgICAgIGVsc2UgeyB0aGlzLmV4cHJBbGxvd2VkID0gZmFsc2U7IH1cbiAgICB9XG5cbiAgICB2YXIgb3duRGVzdHJ1Y3R1cmluZ0Vycm9ycyA9IGZhbHNlLCBvbGRQYXJlbkFzc2lnbiA9IC0xLCBvbGRUcmFpbGluZ0NvbW1hID0gLTEsIG9sZERvdWJsZVByb3RvID0gLTE7XG4gICAgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICAgIG9sZFBhcmVuQXNzaWduID0gcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQXNzaWduO1xuICAgICAgb2xkVHJhaWxpbmdDb21tYSA9IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMudHJhaWxpbmdDb21tYTtcbiAgICAgIG9sZERvdWJsZVByb3RvID0gcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5kb3VibGVQcm90bztcbiAgICAgIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMucGFyZW50aGVzaXplZEFzc2lnbiA9IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMudHJhaWxpbmdDb21tYSA9IC0xO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWZEZXN0cnVjdHVyaW5nRXJyb3JzID0gbmV3IERlc3RydWN0dXJpbmdFcnJvcnM7XG4gICAgICBvd25EZXN0cnVjdHVyaW5nRXJyb3JzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB2YXIgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5wYXJlbkwgfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLm5hbWUpIHtcbiAgICAgIHRoaXMucG90ZW50aWFsQXJyb3dBdCA9IHRoaXMuc3RhcnQ7XG4gICAgICB0aGlzLnBvdGVudGlhbEFycm93SW5Gb3JBd2FpdCA9IGZvckluaXQgPT09IFwiYXdhaXRcIjtcbiAgICB9XG4gICAgdmFyIGxlZnQgPSB0aGlzLnBhcnNlTWF5YmVDb25kaXRpb25hbChmb3JJbml0LCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTtcbiAgICBpZiAoYWZ0ZXJMZWZ0UGFyc2UpIHsgbGVmdCA9IGFmdGVyTGVmdFBhcnNlLmNhbGwodGhpcywgbGVmdCwgc3RhcnRQb3MsIHN0YXJ0TG9jKTsgfVxuICAgIGlmICh0aGlzLnR5cGUuaXNBc3NpZ24pIHtcbiAgICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgbm9kZS5vcGVyYXRvciA9IHRoaXMudmFsdWU7XG4gICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmVxKVxuICAgICAgICB7IGxlZnQgPSB0aGlzLnRvQXNzaWduYWJsZShsZWZ0LCBmYWxzZSwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7IH1cbiAgICAgIGlmICghb3duRGVzdHJ1Y3R1cmluZ0Vycm9ycykge1xuICAgICAgICByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRBc3NpZ24gPSByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnRyYWlsaW5nQ29tbWEgPSByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLmRvdWJsZVByb3RvID0gLTE7XG4gICAgICB9XG4gICAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5zaG9ydGhhbmRBc3NpZ24gPj0gbGVmdC5zdGFydClcbiAgICAgICAgeyByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnNob3J0aGFuZEFzc2lnbiA9IC0xOyB9IC8vIHJlc2V0IGJlY2F1c2Ugc2hvcnRoYW5kIGRlZmF1bHQgd2FzIHVzZWQgY29ycmVjdGx5XG4gICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmVxKVxuICAgICAgICB7IHRoaXMuY2hlY2tMVmFsUGF0dGVybihsZWZ0KTsgfVxuICAgICAgZWxzZVxuICAgICAgICB7IHRoaXMuY2hlY2tMVmFsU2ltcGxlKGxlZnQpOyB9XG4gICAgICBub2RlLmxlZnQgPSBsZWZ0O1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICBub2RlLnJpZ2h0ID0gdGhpcy5wYXJzZU1heWJlQXNzaWduKGZvckluaXQpO1xuICAgICAgaWYgKG9sZERvdWJsZVByb3RvID4gLTEpIHsgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5kb3VibGVQcm90byA9IG9sZERvdWJsZVByb3RvOyB9XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiQXNzaWdubWVudEV4cHJlc3Npb25cIilcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG93bkRlc3RydWN0dXJpbmdFcnJvcnMpIHsgdGhpcy5jaGVja0V4cHJlc3Npb25FcnJvcnMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgdHJ1ZSk7IH1cbiAgICB9XG4gICAgaWYgKG9sZFBhcmVuQXNzaWduID4gLTEpIHsgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQXNzaWduID0gb2xkUGFyZW5Bc3NpZ247IH1cbiAgICBpZiAob2xkVHJhaWxpbmdDb21tYSA+IC0xKSB7IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMudHJhaWxpbmdDb21tYSA9IG9sZFRyYWlsaW5nQ29tbWE7IH1cbiAgICByZXR1cm4gbGVmdFxuICB9O1xuXG4gIC8vIFBhcnNlIGEgdGVybmFyeSBjb25kaXRpb25hbCAoYD86YCkgb3BlcmF0b3IuXG5cbiAgcHAkNS5wYXJzZU1heWJlQ29uZGl0aW9uYWwgPSBmdW5jdGlvbihmb3JJbml0LCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7XG4gICAgdmFyIHN0YXJ0UG9zID0gdGhpcy5zdGFydCwgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jO1xuICAgIHZhciBleHByID0gdGhpcy5wYXJzZUV4cHJPcHMoZm9ySW5pdCwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgaWYgKHRoaXMuY2hlY2tFeHByZXNzaW9uRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpKSB7IHJldHVybiBleHByIH1cbiAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5xdWVzdGlvbikpIHtcbiAgICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgbm9kZS50ZXN0ID0gZXhwcjtcbiAgICAgIG5vZGUuY29uc2VxdWVudCA9IHRoaXMucGFyc2VNYXliZUFzc2lnbigpO1xuICAgICAgdGhpcy5leHBlY3QodHlwZXMkMS5jb2xvbik7XG4gICAgICBub2RlLmFsdGVybmF0ZSA9IHRoaXMucGFyc2VNYXliZUFzc2lnbihmb3JJbml0KTtcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJDb25kaXRpb25hbEV4cHJlc3Npb25cIilcbiAgICB9XG4gICAgcmV0dXJuIGV4cHJcbiAgfTtcblxuICAvLyBTdGFydCB0aGUgcHJlY2VkZW5jZSBwYXJzZXIuXG5cbiAgcHAkNS5wYXJzZUV4cHJPcHMgPSBmdW5jdGlvbihmb3JJbml0LCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7XG4gICAgdmFyIHN0YXJ0UG9zID0gdGhpcy5zdGFydCwgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jO1xuICAgIHZhciBleHByID0gdGhpcy5wYXJzZU1heWJlVW5hcnkocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgZmFsc2UsIGZhbHNlLCBmb3JJbml0KTtcbiAgICBpZiAodGhpcy5jaGVja0V4cHJlc3Npb25FcnJvcnMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykpIHsgcmV0dXJuIGV4cHIgfVxuICAgIHJldHVybiBleHByLnN0YXJ0ID09PSBzdGFydFBvcyAmJiBleHByLnR5cGUgPT09IFwiQXJyb3dGdW5jdGlvbkV4cHJlc3Npb25cIiA/IGV4cHIgOiB0aGlzLnBhcnNlRXhwck9wKGV4cHIsIHN0YXJ0UG9zLCBzdGFydExvYywgLTEsIGZvckluaXQpXG4gIH07XG5cbiAgLy8gUGFyc2UgYmluYXJ5IG9wZXJhdG9ycyB3aXRoIHRoZSBvcGVyYXRvciBwcmVjZWRlbmNlIHBhcnNpbmdcbiAgLy8gYWxnb3JpdGhtLiBgbGVmdGAgaXMgdGhlIGxlZnQtaGFuZCBzaWRlIG9mIHRoZSBvcGVyYXRvci5cbiAgLy8gYG1pblByZWNgIHByb3ZpZGVzIGNvbnRleHQgdGhhdCBhbGxvd3MgdGhlIGZ1bmN0aW9uIHRvIHN0b3AgYW5kXG4gIC8vIGRlZmVyIGZ1cnRoZXIgcGFyc2VyIHRvIG9uZSBvZiBpdHMgY2FsbGVycyB3aGVuIGl0IGVuY291bnRlcnMgYW5cbiAgLy8gb3BlcmF0b3IgdGhhdCBoYXMgYSBsb3dlciBwcmVjZWRlbmNlIHRoYW4gdGhlIHNldCBpdCBpcyBwYXJzaW5nLlxuXG4gIHBwJDUucGFyc2VFeHByT3AgPSBmdW5jdGlvbihsZWZ0LCBsZWZ0U3RhcnRQb3MsIGxlZnRTdGFydExvYywgbWluUHJlYywgZm9ySW5pdCkge1xuICAgIHZhciBwcmVjID0gdGhpcy50eXBlLmJpbm9wO1xuICAgIGlmIChwcmVjICE9IG51bGwgJiYgKCFmb3JJbml0IHx8IHRoaXMudHlwZSAhPT0gdHlwZXMkMS5faW4pKSB7XG4gICAgICBpZiAocHJlYyA+IG1pblByZWMpIHtcbiAgICAgICAgdmFyIGxvZ2ljYWwgPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEubG9naWNhbE9SIHx8IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5sb2dpY2FsQU5EO1xuICAgICAgICB2YXIgY29hbGVzY2UgPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29hbGVzY2U7XG4gICAgICAgIGlmIChjb2FsZXNjZSkge1xuICAgICAgICAgIC8vIEhhbmRsZSB0aGUgcHJlY2VkZW5jZSBvZiBgdHQuY29hbGVzY2VgIGFzIGVxdWFsIHRvIHRoZSByYW5nZSBvZiBsb2dpY2FsIGV4cHJlc3Npb25zLlxuICAgICAgICAgIC8vIEluIG90aGVyIHdvcmRzLCBgbm9kZS5yaWdodGAgc2hvdWxkbid0IGNvbnRhaW4gbG9naWNhbCBleHByZXNzaW9ucyBpbiBvcmRlciB0byBjaGVjayB0aGUgbWl4ZWQgZXJyb3IuXG4gICAgICAgICAgcHJlYyA9IHR5cGVzJDEubG9naWNhbEFORC5iaW5vcDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgb3AgPSB0aGlzLnZhbHVlO1xuICAgICAgICB0aGlzLm5leHQoKTtcbiAgICAgICAgdmFyIHN0YXJ0UG9zID0gdGhpcy5zdGFydCwgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jO1xuICAgICAgICB2YXIgcmlnaHQgPSB0aGlzLnBhcnNlRXhwck9wKHRoaXMucGFyc2VNYXliZVVuYXJ5KG51bGwsIGZhbHNlLCBmYWxzZSwgZm9ySW5pdCksIHN0YXJ0UG9zLCBzdGFydExvYywgcHJlYywgZm9ySW5pdCk7XG4gICAgICAgIHZhciBub2RlID0gdGhpcy5idWlsZEJpbmFyeShsZWZ0U3RhcnRQb3MsIGxlZnRTdGFydExvYywgbGVmdCwgcmlnaHQsIG9wLCBsb2dpY2FsIHx8IGNvYWxlc2NlKTtcbiAgICAgICAgaWYgKChsb2dpY2FsICYmIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5jb2FsZXNjZSkgfHwgKGNvYWxlc2NlICYmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEubG9naWNhbE9SIHx8IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5sb2dpY2FsQU5EKSkpIHtcbiAgICAgICAgICB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5zdGFydCwgXCJMb2dpY2FsIGV4cHJlc3Npb25zIGFuZCBjb2FsZXNjZSBleHByZXNzaW9ucyBjYW5ub3QgYmUgbWl4ZWQuIFdyYXAgZWl0aGVyIGJ5IHBhcmVudGhlc2VzXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlRXhwck9wKG5vZGUsIGxlZnRTdGFydFBvcywgbGVmdFN0YXJ0TG9jLCBtaW5QcmVjLCBmb3JJbml0KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbGVmdFxuICB9O1xuXG4gIHBwJDUuYnVpbGRCaW5hcnkgPSBmdW5jdGlvbihzdGFydFBvcywgc3RhcnRMb2MsIGxlZnQsIHJpZ2h0LCBvcCwgbG9naWNhbCkge1xuICAgIGlmIChyaWdodC50eXBlID09PSBcIlByaXZhdGVJZGVudGlmaWVyXCIpIHsgdGhpcy5yYWlzZShyaWdodC5zdGFydCwgXCJQcml2YXRlIGlkZW50aWZpZXIgY2FuIG9ubHkgYmUgbGVmdCBzaWRlIG9mIGJpbmFyeSBleHByZXNzaW9uXCIpOyB9XG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgbm9kZS5sZWZ0ID0gbGVmdDtcbiAgICBub2RlLm9wZXJhdG9yID0gb3A7XG4gICAgbm9kZS5yaWdodCA9IHJpZ2h0O1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgbG9naWNhbCA/IFwiTG9naWNhbEV4cHJlc3Npb25cIiA6IFwiQmluYXJ5RXhwcmVzc2lvblwiKVxuICB9O1xuXG4gIC8vIFBhcnNlIHVuYXJ5IG9wZXJhdG9ycywgYm90aCBwcmVmaXggYW5kIHBvc3RmaXguXG5cbiAgcHAkNS5wYXJzZU1heWJlVW5hcnkgPSBmdW5jdGlvbihyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCBzYXdVbmFyeSwgaW5jRGVjLCBmb3JJbml0KSB7XG4gICAgdmFyIHN0YXJ0UG9zID0gdGhpcy5zdGFydCwgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jLCBleHByO1xuICAgIGlmICh0aGlzLmlzQ29udGV4dHVhbChcImF3YWl0XCIpICYmIHRoaXMuY2FuQXdhaXQpIHtcbiAgICAgIGV4cHIgPSB0aGlzLnBhcnNlQXdhaXQoZm9ySW5pdCk7XG4gICAgICBzYXdVbmFyeSA9IHRydWU7XG4gICAgfSBlbHNlIGlmICh0aGlzLnR5cGUucHJlZml4KSB7XG4gICAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCksIHVwZGF0ZSA9IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5pbmNEZWM7XG4gICAgICBub2RlLm9wZXJhdG9yID0gdGhpcy52YWx1ZTtcbiAgICAgIG5vZGUucHJlZml4ID0gdHJ1ZTtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgbm9kZS5hcmd1bWVudCA9IHRoaXMucGFyc2VNYXliZVVuYXJ5KG51bGwsIHRydWUsIHVwZGF0ZSwgZm9ySW5pdCk7XG4gICAgICB0aGlzLmNoZWNrRXhwcmVzc2lvbkVycm9ycyhyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCB0cnVlKTtcbiAgICAgIGlmICh1cGRhdGUpIHsgdGhpcy5jaGVja0xWYWxTaW1wbGUobm9kZS5hcmd1bWVudCk7IH1cbiAgICAgIGVsc2UgaWYgKHRoaXMuc3RyaWN0ICYmIG5vZGUub3BlcmF0b3IgPT09IFwiZGVsZXRlXCIgJiZcbiAgICAgICAgICAgICAgIG5vZGUuYXJndW1lbnQudHlwZSA9PT0gXCJJZGVudGlmaWVyXCIpXG4gICAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKG5vZGUuc3RhcnQsIFwiRGVsZXRpbmcgbG9jYWwgdmFyaWFibGUgaW4gc3RyaWN0IG1vZGVcIik7IH1cbiAgICAgIGVsc2UgaWYgKG5vZGUub3BlcmF0b3IgPT09IFwiZGVsZXRlXCIgJiYgaXNQcml2YXRlRmllbGRBY2Nlc3Mobm9kZS5hcmd1bWVudCkpXG4gICAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKG5vZGUuc3RhcnQsIFwiUHJpdmF0ZSBmaWVsZHMgY2FuIG5vdCBiZSBkZWxldGVkXCIpOyB9XG4gICAgICBlbHNlIHsgc2F3VW5hcnkgPSB0cnVlOyB9XG4gICAgICBleHByID0gdGhpcy5maW5pc2hOb2RlKG5vZGUsIHVwZGF0ZSA/IFwiVXBkYXRlRXhwcmVzc2lvblwiIDogXCJVbmFyeUV4cHJlc3Npb25cIik7XG4gICAgfSBlbHNlIGlmICghc2F3VW5hcnkgJiYgdGhpcy50eXBlID09PSB0eXBlcyQxLnByaXZhdGVJZCkge1xuICAgICAgaWYgKChmb3JJbml0IHx8IHRoaXMucHJpdmF0ZU5hbWVTdGFjay5sZW5ndGggPT09IDApICYmIHRoaXMub3B0aW9ucy5jaGVja1ByaXZhdGVGaWVsZHMpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgIGV4cHIgPSB0aGlzLnBhcnNlUHJpdmF0ZUlkZW50KCk7XG4gICAgICAvLyBvbmx5IGNvdWxkIGJlIHByaXZhdGUgZmllbGRzIGluICdpbicsIHN1Y2ggYXMgI3ggaW4gb2JqXG4gICAgICBpZiAodGhpcy50eXBlICE9PSB0eXBlcyQxLl9pbikgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBleHByID0gdGhpcy5wYXJzZUV4cHJTdWJzY3JpcHRzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIGZvckluaXQpO1xuICAgICAgaWYgKHRoaXMuY2hlY2tFeHByZXNzaW9uRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpKSB7IHJldHVybiBleHByIH1cbiAgICAgIHdoaWxlICh0aGlzLnR5cGUucG9zdGZpeCAmJiAhdGhpcy5jYW5JbnNlcnRTZW1pY29sb24oKSkge1xuICAgICAgICB2YXIgbm9kZSQxID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgICBub2RlJDEub3BlcmF0b3IgPSB0aGlzLnZhbHVlO1xuICAgICAgICBub2RlJDEucHJlZml4ID0gZmFsc2U7XG4gICAgICAgIG5vZGUkMS5hcmd1bWVudCA9IGV4cHI7XG4gICAgICAgIHRoaXMuY2hlY2tMVmFsU2ltcGxlKGV4cHIpO1xuICAgICAgICB0aGlzLm5leHQoKTtcbiAgICAgICAgZXhwciA9IHRoaXMuZmluaXNoTm9kZShub2RlJDEsIFwiVXBkYXRlRXhwcmVzc2lvblwiKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWluY0RlYyAmJiB0aGlzLmVhdCh0eXBlcyQxLnN0YXJzdGFyKSkge1xuICAgICAgaWYgKHNhd1VuYXJ5KVxuICAgICAgICB7IHRoaXMudW5leHBlY3RlZCh0aGlzLmxhc3RUb2tTdGFydCk7IH1cbiAgICAgIGVsc2VcbiAgICAgICAgeyByZXR1cm4gdGhpcy5idWlsZEJpbmFyeShzdGFydFBvcywgc3RhcnRMb2MsIGV4cHIsIHRoaXMucGFyc2VNYXliZVVuYXJ5KG51bGwsIGZhbHNlLCBmYWxzZSwgZm9ySW5pdCksIFwiKipcIiwgZmFsc2UpIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGV4cHJcbiAgICB9XG4gIH07XG5cbiAgZnVuY3Rpb24gaXNQcml2YXRlRmllbGRBY2Nlc3Mobm9kZSkge1xuICAgIHJldHVybiAoXG4gICAgICBub2RlLnR5cGUgPT09IFwiTWVtYmVyRXhwcmVzc2lvblwiICYmIG5vZGUucHJvcGVydHkudHlwZSA9PT0gXCJQcml2YXRlSWRlbnRpZmllclwiIHx8XG4gICAgICBub2RlLnR5cGUgPT09IFwiQ2hhaW5FeHByZXNzaW9uXCIgJiYgaXNQcml2YXRlRmllbGRBY2Nlc3Mobm9kZS5leHByZXNzaW9uKVxuICAgIClcbiAgfVxuXG4gIC8vIFBhcnNlIGNhbGwsIGRvdCwgYW5kIGBbXWAtc3Vic2NyaXB0IGV4cHJlc3Npb25zLlxuXG4gIHBwJDUucGFyc2VFeHByU3Vic2NyaXB0cyA9IGZ1bmN0aW9uKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIGZvckluaXQpIHtcbiAgICB2YXIgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgdmFyIGV4cHIgPSB0aGlzLnBhcnNlRXhwckF0b20ocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgZm9ySW5pdCk7XG4gICAgaWYgKGV4cHIudHlwZSA9PT0gXCJBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvblwiICYmIHRoaXMuaW5wdXQuc2xpY2UodGhpcy5sYXN0VG9rU3RhcnQsIHRoaXMubGFzdFRva0VuZCkgIT09IFwiKVwiKVxuICAgICAgeyByZXR1cm4gZXhwciB9XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMucGFyc2VTdWJzY3JpcHRzKGV4cHIsIHN0YXJ0UG9zLCBzdGFydExvYywgZmFsc2UsIGZvckluaXQpO1xuICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzICYmIHJlc3VsdC50eXBlID09PSBcIk1lbWJlckV4cHJlc3Npb25cIikge1xuICAgICAgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMucGFyZW50aGVzaXplZEFzc2lnbiA+PSByZXN1bHQuc3RhcnQpIHsgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQXNzaWduID0gLTE7IH1cbiAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRCaW5kID49IHJlc3VsdC5zdGFydCkgeyByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRCaW5kID0gLTE7IH1cbiAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnRyYWlsaW5nQ29tbWEgPj0gcmVzdWx0LnN0YXJ0KSB7IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMudHJhaWxpbmdDb21tYSA9IC0xOyB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRcbiAgfTtcblxuICBwcCQ1LnBhcnNlU3Vic2NyaXB0cyA9IGZ1bmN0aW9uKGJhc2UsIHN0YXJ0UG9zLCBzdGFydExvYywgbm9DYWxscywgZm9ySW5pdCkge1xuICAgIHZhciBtYXliZUFzeW5jQXJyb3cgPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOCAmJiBiYXNlLnR5cGUgPT09IFwiSWRlbnRpZmllclwiICYmIGJhc2UubmFtZSA9PT0gXCJhc3luY1wiICYmXG4gICAgICAgIHRoaXMubGFzdFRva0VuZCA9PT0gYmFzZS5lbmQgJiYgIXRoaXMuY2FuSW5zZXJ0U2VtaWNvbG9uKCkgJiYgYmFzZS5lbmQgLSBiYXNlLnN0YXJ0ID09PSA1ICYmXG4gICAgICAgIHRoaXMucG90ZW50aWFsQXJyb3dBdCA9PT0gYmFzZS5zdGFydDtcbiAgICB2YXIgb3B0aW9uYWxDaGFpbmVkID0gZmFsc2U7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgdmFyIGVsZW1lbnQgPSB0aGlzLnBhcnNlU3Vic2NyaXB0KGJhc2UsIHN0YXJ0UG9zLCBzdGFydExvYywgbm9DYWxscywgbWF5YmVBc3luY0Fycm93LCBvcHRpb25hbENoYWluZWQsIGZvckluaXQpO1xuXG4gICAgICBpZiAoZWxlbWVudC5vcHRpb25hbCkgeyBvcHRpb25hbENoYWluZWQgPSB0cnVlOyB9XG4gICAgICBpZiAoZWxlbWVudCA9PT0gYmFzZSB8fCBlbGVtZW50LnR5cGUgPT09IFwiQXJyb3dGdW5jdGlvbkV4cHJlc3Npb25cIikge1xuICAgICAgICBpZiAob3B0aW9uYWxDaGFpbmVkKSB7XG4gICAgICAgICAgdmFyIGNoYWluTm9kZSA9IHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICAgICAgICBjaGFpbk5vZGUuZXhwcmVzc2lvbiA9IGVsZW1lbnQ7XG4gICAgICAgICAgZWxlbWVudCA9IHRoaXMuZmluaXNoTm9kZShjaGFpbk5vZGUsIFwiQ2hhaW5FeHByZXNzaW9uXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlbGVtZW50XG4gICAgICB9XG5cbiAgICAgIGJhc2UgPSBlbGVtZW50O1xuICAgIH1cbiAgfTtcblxuICBwcCQ1LnNob3VsZFBhcnNlQXN5bmNBcnJvdyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAhdGhpcy5jYW5JbnNlcnRTZW1pY29sb24oKSAmJiB0aGlzLmVhdCh0eXBlcyQxLmFycm93KVxuICB9O1xuXG4gIHBwJDUucGFyc2VTdWJzY3JpcHRBc3luY0Fycm93ID0gZnVuY3Rpb24oc3RhcnRQb3MsIHN0YXJ0TG9jLCBleHByTGlzdCwgZm9ySW5pdCkge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQXJyb3dFeHByZXNzaW9uKHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKSwgZXhwckxpc3QsIHRydWUsIGZvckluaXQpXG4gIH07XG5cbiAgcHAkNS5wYXJzZVN1YnNjcmlwdCA9IGZ1bmN0aW9uKGJhc2UsIHN0YXJ0UG9zLCBzdGFydExvYywgbm9DYWxscywgbWF5YmVBc3luY0Fycm93LCBvcHRpb25hbENoYWluZWQsIGZvckluaXQpIHtcbiAgICB2YXIgb3B0aW9uYWxTdXBwb3J0ZWQgPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTE7XG4gICAgdmFyIG9wdGlvbmFsID0gb3B0aW9uYWxTdXBwb3J0ZWQgJiYgdGhpcy5lYXQodHlwZXMkMS5xdWVzdGlvbkRvdCk7XG4gICAgaWYgKG5vQ2FsbHMgJiYgb3B0aW9uYWwpIHsgdGhpcy5yYWlzZSh0aGlzLmxhc3RUb2tTdGFydCwgXCJPcHRpb25hbCBjaGFpbmluZyBjYW5ub3QgYXBwZWFyIGluIHRoZSBjYWxsZWUgb2YgbmV3IGV4cHJlc3Npb25zXCIpOyB9XG5cbiAgICB2YXIgY29tcHV0ZWQgPSB0aGlzLmVhdCh0eXBlcyQxLmJyYWNrZXRMKTtcbiAgICBpZiAoY29tcHV0ZWQgfHwgKG9wdGlvbmFsICYmIHRoaXMudHlwZSAhPT0gdHlwZXMkMS5wYXJlbkwgJiYgdGhpcy50eXBlICE9PSB0eXBlcyQxLmJhY2tRdW90ZSkgfHwgdGhpcy5lYXQodHlwZXMkMS5kb3QpKSB7XG4gICAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICAgIG5vZGUub2JqZWN0ID0gYmFzZTtcbiAgICAgIGlmIChjb21wdXRlZCkge1xuICAgICAgICBub2RlLnByb3BlcnR5ID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICAgICAgdGhpcy5leHBlY3QodHlwZXMkMS5icmFja2V0Uik7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5wcml2YXRlSWQgJiYgYmFzZS50eXBlICE9PSBcIlN1cGVyXCIpIHtcbiAgICAgICAgbm9kZS5wcm9wZXJ0eSA9IHRoaXMucGFyc2VQcml2YXRlSWRlbnQoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vZGUucHJvcGVydHkgPSB0aGlzLnBhcnNlSWRlbnQodGhpcy5vcHRpb25zLmFsbG93UmVzZXJ2ZWQgIT09IFwibmV2ZXJcIik7XG4gICAgICB9XG4gICAgICBub2RlLmNvbXB1dGVkID0gISFjb21wdXRlZDtcbiAgICAgIGlmIChvcHRpb25hbFN1cHBvcnRlZCkge1xuICAgICAgICBub2RlLm9wdGlvbmFsID0gb3B0aW9uYWw7XG4gICAgICB9XG4gICAgICBiYXNlID0gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiTWVtYmVyRXhwcmVzc2lvblwiKTtcbiAgICB9IGVsc2UgaWYgKCFub0NhbGxzICYmIHRoaXMuZWF0KHR5cGVzJDEucGFyZW5MKSkge1xuICAgICAgdmFyIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMgPSBuZXcgRGVzdHJ1Y3R1cmluZ0Vycm9ycywgb2xkWWllbGRQb3MgPSB0aGlzLnlpZWxkUG9zLCBvbGRBd2FpdFBvcyA9IHRoaXMuYXdhaXRQb3MsIG9sZEF3YWl0SWRlbnRQb3MgPSB0aGlzLmF3YWl0SWRlbnRQb3M7XG4gICAgICB0aGlzLnlpZWxkUG9zID0gMDtcbiAgICAgIHRoaXMuYXdhaXRQb3MgPSAwO1xuICAgICAgdGhpcy5hd2FpdElkZW50UG9zID0gMDtcbiAgICAgIHZhciBleHByTGlzdCA9IHRoaXMucGFyc2VFeHByTGlzdCh0eXBlcyQxLnBhcmVuUiwgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDgsIGZhbHNlLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTtcbiAgICAgIGlmIChtYXliZUFzeW5jQXJyb3cgJiYgIW9wdGlvbmFsICYmIHRoaXMuc2hvdWxkUGFyc2VBc3luY0Fycm93KCkpIHtcbiAgICAgICAgdGhpcy5jaGVja1BhdHRlcm5FcnJvcnMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgZmFsc2UpO1xuICAgICAgICB0aGlzLmNoZWNrWWllbGRBd2FpdEluRGVmYXVsdFBhcmFtcygpO1xuICAgICAgICBpZiAodGhpcy5hd2FpdElkZW50UG9zID4gMClcbiAgICAgICAgICB7IHRoaXMucmFpc2UodGhpcy5hd2FpdElkZW50UG9zLCBcIkNhbm5vdCB1c2UgJ2F3YWl0JyBhcyBpZGVudGlmaWVyIGluc2lkZSBhbiBhc3luYyBmdW5jdGlvblwiKTsgfVxuICAgICAgICB0aGlzLnlpZWxkUG9zID0gb2xkWWllbGRQb3M7XG4gICAgICAgIHRoaXMuYXdhaXRQb3MgPSBvbGRBd2FpdFBvcztcbiAgICAgICAgdGhpcy5hd2FpdElkZW50UG9zID0gb2xkQXdhaXRJZGVudFBvcztcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VTdWJzY3JpcHRBc3luY0Fycm93KHN0YXJ0UG9zLCBzdGFydExvYywgZXhwckxpc3QsIGZvckluaXQpXG4gICAgICB9XG4gICAgICB0aGlzLmNoZWNrRXhwcmVzc2lvbkVycm9ycyhyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCB0cnVlKTtcbiAgICAgIHRoaXMueWllbGRQb3MgPSBvbGRZaWVsZFBvcyB8fCB0aGlzLnlpZWxkUG9zO1xuICAgICAgdGhpcy5hd2FpdFBvcyA9IG9sZEF3YWl0UG9zIHx8IHRoaXMuYXdhaXRQb3M7XG4gICAgICB0aGlzLmF3YWl0SWRlbnRQb3MgPSBvbGRBd2FpdElkZW50UG9zIHx8IHRoaXMuYXdhaXRJZGVudFBvcztcbiAgICAgIHZhciBub2RlJDEgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICBub2RlJDEuY2FsbGVlID0gYmFzZTtcbiAgICAgIG5vZGUkMS5hcmd1bWVudHMgPSBleHByTGlzdDtcbiAgICAgIGlmIChvcHRpb25hbFN1cHBvcnRlZCkge1xuICAgICAgICBub2RlJDEub3B0aW9uYWwgPSBvcHRpb25hbDtcbiAgICAgIH1cbiAgICAgIGJhc2UgPSB0aGlzLmZpbmlzaE5vZGUobm9kZSQxLCBcIkNhbGxFeHByZXNzaW9uXCIpO1xuICAgIH0gZWxzZSBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmJhY2tRdW90ZSkge1xuICAgICAgaWYgKG9wdGlvbmFsIHx8IG9wdGlvbmFsQ2hhaW5lZCkge1xuICAgICAgICB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsIFwiT3B0aW9uYWwgY2hhaW5pbmcgY2Fubm90IGFwcGVhciBpbiB0aGUgdGFnIG9mIHRhZ2dlZCB0ZW1wbGF0ZSBleHByZXNzaW9uc1wiKTtcbiAgICAgIH1cbiAgICAgIHZhciBub2RlJDIgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICBub2RlJDIudGFnID0gYmFzZTtcbiAgICAgIG5vZGUkMi5xdWFzaSA9IHRoaXMucGFyc2VUZW1wbGF0ZSh7aXNUYWdnZWQ6IHRydWV9KTtcbiAgICAgIGJhc2UgPSB0aGlzLmZpbmlzaE5vZGUobm9kZSQyLCBcIlRhZ2dlZFRlbXBsYXRlRXhwcmVzc2lvblwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGJhc2VcbiAgfTtcblxuICAvLyBQYXJzZSBhbiBhdG9taWMgZXhwcmVzc2lvbiDigJQgZWl0aGVyIGEgc2luZ2xlIHRva2VuIHRoYXQgaXMgYW5cbiAgLy8gZXhwcmVzc2lvbiwgYW4gZXhwcmVzc2lvbiBzdGFydGVkIGJ5IGEga2V5d29yZCBsaWtlIGBmdW5jdGlvbmAgb3JcbiAgLy8gYG5ld2AsIG9yIGFuIGV4cHJlc3Npb24gd3JhcHBlZCBpbiBwdW5jdHVhdGlvbiBsaWtlIGAoKWAsIGBbXWAsXG4gIC8vIG9yIGB7fWAuXG5cbiAgcHAkNS5wYXJzZUV4cHJBdG9tID0gZnVuY3Rpb24ocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgZm9ySW5pdCwgZm9yTmV3KSB7XG4gICAgLy8gSWYgYSBkaXZpc2lvbiBvcGVyYXRvciBhcHBlYXJzIGluIGFuIGV4cHJlc3Npb24gcG9zaXRpb24sIHRoZVxuICAgIC8vIHRva2VuaXplciBnb3QgY29uZnVzZWQsIGFuZCB3ZSBmb3JjZSBpdCB0byByZWFkIGEgcmVnZXhwIGluc3RlYWQuXG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5zbGFzaCkgeyB0aGlzLnJlYWRSZWdleHAoKTsgfVxuXG4gICAgdmFyIG5vZGUsIGNhbkJlQXJyb3cgPSB0aGlzLnBvdGVudGlhbEFycm93QXQgPT09IHRoaXMuc3RhcnQ7XG4gICAgc3dpdGNoICh0aGlzLnR5cGUpIHtcbiAgICBjYXNlIHR5cGVzJDEuX3N1cGVyOlxuICAgICAgaWYgKCF0aGlzLmFsbG93U3VwZXIpXG4gICAgICAgIHsgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCBcIidzdXBlcicga2V5d29yZCBvdXRzaWRlIGEgbWV0aG9kXCIpOyB9XG4gICAgICBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5wYXJlbkwgJiYgIXRoaXMuYWxsb3dEaXJlY3RTdXBlcilcbiAgICAgICAgeyB0aGlzLnJhaXNlKG5vZGUuc3RhcnQsIFwic3VwZXIoKSBjYWxsIG91dHNpZGUgY29uc3RydWN0b3Igb2YgYSBzdWJjbGFzc1wiKTsgfVxuICAgICAgLy8gVGhlIGBzdXBlcmAga2V5d29yZCBjYW4gYXBwZWFyIGF0IGJlbG93OlxuICAgICAgLy8gU3VwZXJQcm9wZXJ0eTpcbiAgICAgIC8vICAgICBzdXBlciBbIEV4cHJlc3Npb24gXVxuICAgICAgLy8gICAgIHN1cGVyIC4gSWRlbnRpZmllck5hbWVcbiAgICAgIC8vIFN1cGVyQ2FsbDpcbiAgICAgIC8vICAgICBzdXBlciAoIEFyZ3VtZW50cyApXG4gICAgICBpZiAodGhpcy50eXBlICE9PSB0eXBlcyQxLmRvdCAmJiB0aGlzLnR5cGUgIT09IHR5cGVzJDEuYnJhY2tldEwgJiYgdGhpcy50eXBlICE9PSB0eXBlcyQxLnBhcmVuTClcbiAgICAgICAgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlN1cGVyXCIpXG5cbiAgICBjYXNlIHR5cGVzJDEuX3RoaXM6XG4gICAgICBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlRoaXNFeHByZXNzaW9uXCIpXG5cbiAgICBjYXNlIHR5cGVzJDEubmFtZTpcbiAgICAgIHZhciBzdGFydFBvcyA9IHRoaXMuc3RhcnQsIHN0YXJ0TG9jID0gdGhpcy5zdGFydExvYywgY29udGFpbnNFc2MgPSB0aGlzLmNvbnRhaW5zRXNjO1xuICAgICAgdmFyIGlkID0gdGhpcy5wYXJzZUlkZW50KGZhbHNlKTtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOCAmJiAhY29udGFpbnNFc2MgJiYgaWQubmFtZSA9PT0gXCJhc3luY1wiICYmICF0aGlzLmNhbkluc2VydFNlbWljb2xvbigpICYmIHRoaXMuZWF0KHR5cGVzJDEuX2Z1bmN0aW9uKSkge1xuICAgICAgICB0aGlzLm92ZXJyaWRlQ29udGV4dCh0eXBlcy5mX2V4cHIpO1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZUZ1bmN0aW9uKHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKSwgMCwgZmFsc2UsIHRydWUsIGZvckluaXQpXG4gICAgICB9XG4gICAgICBpZiAoY2FuQmVBcnJvdyAmJiAhdGhpcy5jYW5JbnNlcnRTZW1pY29sb24oKSkge1xuICAgICAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5hcnJvdykpXG4gICAgICAgICAgeyByZXR1cm4gdGhpcy5wYXJzZUFycm93RXhwcmVzc2lvbih0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyksIFtpZF0sIGZhbHNlLCBmb3JJbml0KSB9XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOCAmJiBpZC5uYW1lID09PSBcImFzeW5jXCIgJiYgdGhpcy50eXBlID09PSB0eXBlcyQxLm5hbWUgJiYgIWNvbnRhaW5zRXNjICYmXG4gICAgICAgICAgICAoIXRoaXMucG90ZW50aWFsQXJyb3dJbkZvckF3YWl0IHx8IHRoaXMudmFsdWUgIT09IFwib2ZcIiB8fCB0aGlzLmNvbnRhaW5zRXNjKSkge1xuICAgICAgICAgIGlkID0gdGhpcy5wYXJzZUlkZW50KGZhbHNlKTtcbiAgICAgICAgICBpZiAodGhpcy5jYW5JbnNlcnRTZW1pY29sb24oKSB8fCAhdGhpcy5lYXQodHlwZXMkMS5hcnJvdykpXG4gICAgICAgICAgICB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VBcnJvd0V4cHJlc3Npb24odGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpLCBbaWRdLCB0cnVlLCBmb3JJbml0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gaWRcblxuICAgIGNhc2UgdHlwZXMkMS5yZWdleHA6XG4gICAgICB2YXIgdmFsdWUgPSB0aGlzLnZhbHVlO1xuICAgICAgbm9kZSA9IHRoaXMucGFyc2VMaXRlcmFsKHZhbHVlLnZhbHVlKTtcbiAgICAgIG5vZGUucmVnZXggPSB7cGF0dGVybjogdmFsdWUucGF0dGVybiwgZmxhZ3M6IHZhbHVlLmZsYWdzfTtcbiAgICAgIHJldHVybiBub2RlXG5cbiAgICBjYXNlIHR5cGVzJDEubnVtOiBjYXNlIHR5cGVzJDEuc3RyaW5nOlxuICAgICAgcmV0dXJuIHRoaXMucGFyc2VMaXRlcmFsKHRoaXMudmFsdWUpXG5cbiAgICBjYXNlIHR5cGVzJDEuX251bGw6IGNhc2UgdHlwZXMkMS5fdHJ1ZTogY2FzZSB0eXBlcyQxLl9mYWxzZTpcbiAgICAgIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgICAgbm9kZS52YWx1ZSA9IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5fbnVsbCA/IG51bGwgOiB0aGlzLnR5cGUgPT09IHR5cGVzJDEuX3RydWU7XG4gICAgICBub2RlLnJhdyA9IHRoaXMudHlwZS5rZXl3b3JkO1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiTGl0ZXJhbFwiKVxuXG4gICAgY2FzZSB0eXBlcyQxLnBhcmVuTDpcbiAgICAgIHZhciBzdGFydCA9IHRoaXMuc3RhcnQsIGV4cHIgPSB0aGlzLnBhcnNlUGFyZW5BbmREaXN0aW5ndWlzaEV4cHJlc3Npb24oY2FuQmVBcnJvdywgZm9ySW5pdCk7XG4gICAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykge1xuICAgICAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQXNzaWduIDwgMCAmJiAhdGhpcy5pc1NpbXBsZUFzc2lnblRhcmdldChleHByKSlcbiAgICAgICAgICB7IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMucGFyZW50aGVzaXplZEFzc2lnbiA9IHN0YXJ0OyB9XG4gICAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRCaW5kIDwgMClcbiAgICAgICAgICB7IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMucGFyZW50aGVzaXplZEJpbmQgPSBzdGFydDsgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGV4cHJcblxuICAgIGNhc2UgdHlwZXMkMS5icmFja2V0TDpcbiAgICAgIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICBub2RlLmVsZW1lbnRzID0gdGhpcy5wYXJzZUV4cHJMaXN0KHR5cGVzJDEuYnJhY2tldFIsIHRydWUsIHRydWUsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkFycmF5RXhwcmVzc2lvblwiKVxuXG4gICAgY2FzZSB0eXBlcyQxLmJyYWNlTDpcbiAgICAgIHRoaXMub3ZlcnJpZGVDb250ZXh0KHR5cGVzLmJfZXhwcik7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZU9iaihmYWxzZSwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycylcblxuICAgIGNhc2UgdHlwZXMkMS5fZnVuY3Rpb246XG4gICAgICBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VGdW5jdGlvbihub2RlLCAwKVxuXG4gICAgY2FzZSB0eXBlcyQxLl9jbGFzczpcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlQ2xhc3ModGhpcy5zdGFydE5vZGUoKSwgZmFsc2UpXG5cbiAgICBjYXNlIHR5cGVzJDEuX25ldzpcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlTmV3KClcblxuICAgIGNhc2UgdHlwZXMkMS5iYWNrUXVvdGU6XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZVRlbXBsYXRlKClcblxuICAgIGNhc2UgdHlwZXMkMS5faW1wb3J0OlxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSAxMSkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZUV4cHJJbXBvcnQoZm9yTmV3KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5leHBlY3RlZCgpXG4gICAgICB9XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHRoaXMucGFyc2VFeHByQXRvbURlZmF1bHQoKVxuICAgIH1cbiAgfTtcblxuICBwcCQ1LnBhcnNlRXhwckF0b21EZWZhdWx0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy51bmV4cGVjdGVkKCk7XG4gIH07XG5cbiAgcHAkNS5wYXJzZUV4cHJJbXBvcnQgPSBmdW5jdGlvbihmb3JOZXcpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG5cbiAgICAvLyBDb25zdW1lIGBpbXBvcnRgIGFzIGFuIGlkZW50aWZpZXIgZm9yIGBpbXBvcnQubWV0YWAuXG4gICAgLy8gQmVjYXVzZSBgdGhpcy5wYXJzZUlkZW50KHRydWUpYCBkb2Vzbid0IGNoZWNrIGVzY2FwZSBzZXF1ZW5jZXMsIGl0IG5lZWRzIHRoZSBjaGVjayBvZiBgdGhpcy5jb250YWluc0VzY2AuXG4gICAgaWYgKHRoaXMuY29udGFpbnNFc2MpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMuc3RhcnQsIFwiRXNjYXBlIHNlcXVlbmNlIGluIGtleXdvcmQgaW1wb3J0XCIpOyB9XG4gICAgdmFyIG1ldGEgPSB0aGlzLnBhcnNlSWRlbnQodHJ1ZSk7XG5cbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnBhcmVuTCAmJiAhZm9yTmV3KSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUR5bmFtaWNJbXBvcnQobm9kZSlcbiAgICB9IGVsc2UgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5kb3QpIHtcbiAgICAgIG5vZGUubWV0YSA9IG1ldGE7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUltcG9ydE1ldGEobm9kZSlcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51bmV4cGVjdGVkKCk7XG4gICAgfVxuICB9O1xuXG4gIHBwJDUucGFyc2VEeW5hbWljSW1wb3J0ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpOyAvLyBza2lwIGAoYFxuXG4gICAgLy8gUGFyc2Ugbm9kZS5zb3VyY2UuXG4gICAgbm9kZS5zb3VyY2UgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oKTtcblxuICAgIC8vIFZlcmlmeSBlbmRpbmcuXG4gICAgaWYgKCF0aGlzLmVhdCh0eXBlcyQxLnBhcmVuUikpIHtcbiAgICAgIHZhciBlcnJvclBvcyA9IHRoaXMuc3RhcnQ7XG4gICAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5jb21tYSkgJiYgdGhpcy5lYXQodHlwZXMkMS5wYXJlblIpKSB7XG4gICAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZShlcnJvclBvcywgXCJUcmFpbGluZyBjb21tYSBpcyBub3QgYWxsb3dlZCBpbiBpbXBvcnQoKVwiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudW5leHBlY3RlZChlcnJvclBvcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkltcG9ydEV4cHJlc3Npb25cIilcbiAgfTtcblxuICBwcCQ1LnBhcnNlSW1wb3J0TWV0YSA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB0aGlzLm5leHQoKTsgLy8gc2tpcCBgLmBcblxuICAgIHZhciBjb250YWluc0VzYyA9IHRoaXMuY29udGFpbnNFc2M7XG4gICAgbm9kZS5wcm9wZXJ0eSA9IHRoaXMucGFyc2VJZGVudCh0cnVlKTtcblxuICAgIGlmIChub2RlLnByb3BlcnR5Lm5hbWUgIT09IFwibWV0YVwiKVxuICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUobm9kZS5wcm9wZXJ0eS5zdGFydCwgXCJUaGUgb25seSB2YWxpZCBtZXRhIHByb3BlcnR5IGZvciBpbXBvcnQgaXMgJ2ltcG9ydC5tZXRhJ1wiKTsgfVxuICAgIGlmIChjb250YWluc0VzYylcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKG5vZGUuc3RhcnQsIFwiJ2ltcG9ydC5tZXRhJyBtdXN0IG5vdCBjb250YWluIGVzY2FwZWQgY2hhcmFjdGVyc1wiKTsgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuc291cmNlVHlwZSAhPT0gXCJtb2R1bGVcIiAmJiAhdGhpcy5vcHRpb25zLmFsbG93SW1wb3J0RXhwb3J0RXZlcnl3aGVyZSlcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKG5vZGUuc3RhcnQsIFwiQ2Fubm90IHVzZSAnaW1wb3J0Lm1ldGEnIG91dHNpZGUgYSBtb2R1bGVcIik7IH1cblxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJNZXRhUHJvcGVydHlcIilcbiAgfTtcblxuICBwcCQ1LnBhcnNlTGl0ZXJhbCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICBub2RlLnJhdyA9IHRoaXMuaW5wdXQuc2xpY2UodGhpcy5zdGFydCwgdGhpcy5lbmQpO1xuICAgIGlmIChub2RlLnJhdy5jaGFyQ29kZUF0KG5vZGUucmF3Lmxlbmd0aCAtIDEpID09PSAxMTApIHsgbm9kZS5iaWdpbnQgPSBub2RlLnJhdy5zbGljZSgwLCAtMSkucmVwbGFjZSgvXy9nLCBcIlwiKTsgfVxuICAgIHRoaXMubmV4dCgpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJMaXRlcmFsXCIpXG4gIH07XG5cbiAgcHAkNS5wYXJzZVBhcmVuRXhwcmVzc2lvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEucGFyZW5MKTtcbiAgICB2YXIgdmFsID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLnBhcmVuUik7XG4gICAgcmV0dXJuIHZhbFxuICB9O1xuXG4gIHBwJDUuc2hvdWxkUGFyc2VBcnJvdyA9IGZ1bmN0aW9uKGV4cHJMaXN0KSB7XG4gICAgcmV0dXJuICF0aGlzLmNhbkluc2VydFNlbWljb2xvbigpXG4gIH07XG5cbiAgcHAkNS5wYXJzZVBhcmVuQW5kRGlzdGluZ3Vpc2hFeHByZXNzaW9uID0gZnVuY3Rpb24oY2FuQmVBcnJvdywgZm9ySW5pdCkge1xuICAgIHZhciBzdGFydFBvcyA9IHRoaXMuc3RhcnQsIHN0YXJ0TG9jID0gdGhpcy5zdGFydExvYywgdmFsLCBhbGxvd1RyYWlsaW5nQ29tbWEgPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gODtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpIHtcbiAgICAgIHRoaXMubmV4dCgpO1xuXG4gICAgICB2YXIgaW5uZXJTdGFydFBvcyA9IHRoaXMuc3RhcnQsIGlubmVyU3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jO1xuICAgICAgdmFyIGV4cHJMaXN0ID0gW10sIGZpcnN0ID0gdHJ1ZSwgbGFzdElzQ29tbWEgPSBmYWxzZTtcbiAgICAgIHZhciByZWZEZXN0cnVjdHVyaW5nRXJyb3JzID0gbmV3IERlc3RydWN0dXJpbmdFcnJvcnMsIG9sZFlpZWxkUG9zID0gdGhpcy55aWVsZFBvcywgb2xkQXdhaXRQb3MgPSB0aGlzLmF3YWl0UG9zLCBzcHJlYWRTdGFydDtcbiAgICAgIHRoaXMueWllbGRQb3MgPSAwO1xuICAgICAgdGhpcy5hd2FpdFBvcyA9IDA7XG4gICAgICAvLyBEbyBub3Qgc2F2ZSBhd2FpdElkZW50UG9zIHRvIGFsbG93IGNoZWNraW5nIGF3YWl0cyBuZXN0ZWQgaW4gcGFyYW1ldGVyc1xuICAgICAgd2hpbGUgKHRoaXMudHlwZSAhPT0gdHlwZXMkMS5wYXJlblIpIHtcbiAgICAgICAgZmlyc3QgPyBmaXJzdCA9IGZhbHNlIDogdGhpcy5leHBlY3QodHlwZXMkMS5jb21tYSk7XG4gICAgICAgIGlmIChhbGxvd1RyYWlsaW5nQ29tbWEgJiYgdGhpcy5hZnRlclRyYWlsaW5nQ29tbWEodHlwZXMkMS5wYXJlblIsIHRydWUpKSB7XG4gICAgICAgICAgbGFzdElzQ29tbWEgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmVsbGlwc2lzKSB7XG4gICAgICAgICAgc3ByZWFkU3RhcnQgPSB0aGlzLnN0YXJ0O1xuICAgICAgICAgIGV4cHJMaXN0LnB1c2godGhpcy5wYXJzZVBhcmVuSXRlbSh0aGlzLnBhcnNlUmVzdEJpbmRpbmcoKSkpO1xuICAgICAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29tbWEpIHtcbiAgICAgICAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZShcbiAgICAgICAgICAgICAgdGhpcy5zdGFydCxcbiAgICAgICAgICAgICAgXCJDb21tYSBpcyBub3QgcGVybWl0dGVkIGFmdGVyIHRoZSByZXN0IGVsZW1lbnRcIlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBleHByTGlzdC5wdXNoKHRoaXMucGFyc2VNYXliZUFzc2lnbihmYWxzZSwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgdGhpcy5wYXJzZVBhcmVuSXRlbSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB2YXIgaW5uZXJFbmRQb3MgPSB0aGlzLmxhc3RUb2tFbmQsIGlubmVyRW5kTG9jID0gdGhpcy5sYXN0VG9rRW5kTG9jO1xuICAgICAgdGhpcy5leHBlY3QodHlwZXMkMS5wYXJlblIpO1xuXG4gICAgICBpZiAoY2FuQmVBcnJvdyAmJiB0aGlzLnNob3VsZFBhcnNlQXJyb3coZXhwckxpc3QpICYmIHRoaXMuZWF0KHR5cGVzJDEuYXJyb3cpKSB7XG4gICAgICAgIHRoaXMuY2hlY2tQYXR0ZXJuRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5jaGVja1lpZWxkQXdhaXRJbkRlZmF1bHRQYXJhbXMoKTtcbiAgICAgICAgdGhpcy55aWVsZFBvcyA9IG9sZFlpZWxkUG9zO1xuICAgICAgICB0aGlzLmF3YWl0UG9zID0gb2xkQXdhaXRQb3M7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlUGFyZW5BcnJvd0xpc3Qoc3RhcnRQb3MsIHN0YXJ0TG9jLCBleHByTGlzdCwgZm9ySW5pdClcbiAgICAgIH1cblxuICAgICAgaWYgKCFleHByTGlzdC5sZW5ndGggfHwgbGFzdElzQ29tbWEpIHsgdGhpcy51bmV4cGVjdGVkKHRoaXMubGFzdFRva1N0YXJ0KTsgfVxuICAgICAgaWYgKHNwcmVhZFN0YXJ0KSB7IHRoaXMudW5leHBlY3RlZChzcHJlYWRTdGFydCk7IH1cbiAgICAgIHRoaXMuY2hlY2tFeHByZXNzaW9uRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIHRydWUpO1xuICAgICAgdGhpcy55aWVsZFBvcyA9IG9sZFlpZWxkUG9zIHx8IHRoaXMueWllbGRQb3M7XG4gICAgICB0aGlzLmF3YWl0UG9zID0gb2xkQXdhaXRQb3MgfHwgdGhpcy5hd2FpdFBvcztcblxuICAgICAgaWYgKGV4cHJMaXN0Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdmFsID0gdGhpcy5zdGFydE5vZGVBdChpbm5lclN0YXJ0UG9zLCBpbm5lclN0YXJ0TG9jKTtcbiAgICAgICAgdmFsLmV4cHJlc3Npb25zID0gZXhwckxpc3Q7XG4gICAgICAgIHRoaXMuZmluaXNoTm9kZUF0KHZhbCwgXCJTZXF1ZW5jZUV4cHJlc3Npb25cIiwgaW5uZXJFbmRQb3MsIGlubmVyRW5kTG9jKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbCA9IGV4cHJMaXN0WzBdO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YWwgPSB0aGlzLnBhcnNlUGFyZW5FeHByZXNzaW9uKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5wcmVzZXJ2ZVBhcmVucykge1xuICAgICAgdmFyIHBhciA9IHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICAgIHBhci5leHByZXNzaW9uID0gdmFsO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShwYXIsIFwiUGFyZW50aGVzaXplZEV4cHJlc3Npb25cIilcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbFxuICAgIH1cbiAgfTtcblxuICBwcCQ1LnBhcnNlUGFyZW5JdGVtID0gZnVuY3Rpb24oaXRlbSkge1xuICAgIHJldHVybiBpdGVtXG4gIH07XG5cbiAgcHAkNS5wYXJzZVBhcmVuQXJyb3dMaXN0ID0gZnVuY3Rpb24oc3RhcnRQb3MsIHN0YXJ0TG9jLCBleHByTGlzdCwgZm9ySW5pdCkge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQXJyb3dFeHByZXNzaW9uKHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKSwgZXhwckxpc3QsIGZhbHNlLCBmb3JJbml0KVxuICB9O1xuXG4gIC8vIE5ldydzIHByZWNlZGVuY2UgaXMgc2xpZ2h0bHkgdHJpY2t5LiBJdCBtdXN0IGFsbG93IGl0cyBhcmd1bWVudCB0b1xuICAvLyBiZSBhIGBbXWAgb3IgZG90IHN1YnNjcmlwdCBleHByZXNzaW9uLCBidXQgbm90IGEgY2FsbCDigJQgYXQgbGVhc3QsXG4gIC8vIG5vdCB3aXRob3V0IHdyYXBwaW5nIGl0IGluIHBhcmVudGhlc2VzLiBUaHVzLCBpdCB1c2VzIHRoZSBub0NhbGxzXG4gIC8vIGFyZ3VtZW50IHRvIHBhcnNlU3Vic2NyaXB0cyB0byBwcmV2ZW50IGl0IGZyb20gY29uc3VtaW5nIHRoZVxuICAvLyBhcmd1bWVudCBsaXN0LlxuXG4gIHZhciBlbXB0eSA9IFtdO1xuXG4gIHBwJDUucGFyc2VOZXcgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5jb250YWluc0VzYykgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5zdGFydCwgXCJFc2NhcGUgc2VxdWVuY2UgaW4ga2V5d29yZCBuZXdcIik7IH1cbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgdmFyIG1ldGEgPSB0aGlzLnBhcnNlSWRlbnQodHJ1ZSk7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ICYmIHRoaXMuZWF0KHR5cGVzJDEuZG90KSkge1xuICAgICAgbm9kZS5tZXRhID0gbWV0YTtcbiAgICAgIHZhciBjb250YWluc0VzYyA9IHRoaXMuY29udGFpbnNFc2M7XG4gICAgICBub2RlLnByb3BlcnR5ID0gdGhpcy5wYXJzZUlkZW50KHRydWUpO1xuICAgICAgaWYgKG5vZGUucHJvcGVydHkubmFtZSAhPT0gXCJ0YXJnZXRcIilcbiAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUobm9kZS5wcm9wZXJ0eS5zdGFydCwgXCJUaGUgb25seSB2YWxpZCBtZXRhIHByb3BlcnR5IGZvciBuZXcgaXMgJ25ldy50YXJnZXQnXCIpOyB9XG4gICAgICBpZiAoY29udGFpbnNFc2MpXG4gICAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKG5vZGUuc3RhcnQsIFwiJ25ldy50YXJnZXQnIG11c3Qgbm90IGNvbnRhaW4gZXNjYXBlZCBjaGFyYWN0ZXJzXCIpOyB9XG4gICAgICBpZiAoIXRoaXMuYWxsb3dOZXdEb3RUYXJnZXQpXG4gICAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKG5vZGUuc3RhcnQsIFwiJ25ldy50YXJnZXQnIGNhbiBvbmx5IGJlIHVzZWQgaW4gZnVuY3Rpb25zIGFuZCBjbGFzcyBzdGF0aWMgYmxvY2tcIik7IH1cbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJNZXRhUHJvcGVydHlcIilcbiAgICB9XG4gICAgdmFyIHN0YXJ0UG9zID0gdGhpcy5zdGFydCwgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jO1xuICAgIG5vZGUuY2FsbGVlID0gdGhpcy5wYXJzZVN1YnNjcmlwdHModGhpcy5wYXJzZUV4cHJBdG9tKG51bGwsIGZhbHNlLCB0cnVlKSwgc3RhcnRQb3MsIHN0YXJ0TG9jLCB0cnVlLCBmYWxzZSk7XG4gICAgaWYgKHRoaXMuZWF0KHR5cGVzJDEucGFyZW5MKSkgeyBub2RlLmFyZ3VtZW50cyA9IHRoaXMucGFyc2VFeHByTGlzdCh0eXBlcyQxLnBhcmVuUiwgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDgsIGZhbHNlKTsgfVxuICAgIGVsc2UgeyBub2RlLmFyZ3VtZW50cyA9IGVtcHR5OyB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIk5ld0V4cHJlc3Npb25cIilcbiAgfTtcblxuICAvLyBQYXJzZSB0ZW1wbGF0ZSBleHByZXNzaW9uLlxuXG4gIHBwJDUucGFyc2VUZW1wbGF0ZUVsZW1lbnQgPSBmdW5jdGlvbihyZWYpIHtcbiAgICB2YXIgaXNUYWdnZWQgPSByZWYuaXNUYWdnZWQ7XG5cbiAgICB2YXIgZWxlbSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5pbnZhbGlkVGVtcGxhdGUpIHtcbiAgICAgIGlmICghaXNUYWdnZWQpIHtcbiAgICAgICAgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMuc3RhcnQsIFwiQmFkIGVzY2FwZSBzZXF1ZW5jZSBpbiB1bnRhZ2dlZCB0ZW1wbGF0ZSBsaXRlcmFsXCIpO1xuICAgICAgfVxuICAgICAgZWxlbS52YWx1ZSA9IHtcbiAgICAgICAgcmF3OiB0aGlzLnZhbHVlLFxuICAgICAgICBjb29rZWQ6IG51bGxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsZW0udmFsdWUgPSB7XG4gICAgICAgIHJhdzogdGhpcy5pbnB1dC5zbGljZSh0aGlzLnN0YXJ0LCB0aGlzLmVuZCkucmVwbGFjZSgvXFxyXFxuPy9nLCBcIlxcblwiKSxcbiAgICAgICAgY29va2VkOiB0aGlzLnZhbHVlXG4gICAgICB9O1xuICAgIH1cbiAgICB0aGlzLm5leHQoKTtcbiAgICBlbGVtLnRhaWwgPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEuYmFja1F1b3RlO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUoZWxlbSwgXCJUZW1wbGF0ZUVsZW1lbnRcIilcbiAgfTtcblxuICBwcCQ1LnBhcnNlVGVtcGxhdGUgPSBmdW5jdGlvbihyZWYpIHtcbiAgICBpZiAoIHJlZiA9PT0gdm9pZCAwICkgcmVmID0ge307XG4gICAgdmFyIGlzVGFnZ2VkID0gcmVmLmlzVGFnZ2VkOyBpZiAoIGlzVGFnZ2VkID09PSB2b2lkIDAgKSBpc1RhZ2dlZCA9IGZhbHNlO1xuXG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIHRoaXMubmV4dCgpO1xuICAgIG5vZGUuZXhwcmVzc2lvbnMgPSBbXTtcbiAgICB2YXIgY3VyRWx0ID0gdGhpcy5wYXJzZVRlbXBsYXRlRWxlbWVudCh7aXNUYWdnZWQ6IGlzVGFnZ2VkfSk7XG4gICAgbm9kZS5xdWFzaXMgPSBbY3VyRWx0XTtcbiAgICB3aGlsZSAoIWN1ckVsdC50YWlsKSB7XG4gICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmVvZikgeyB0aGlzLnJhaXNlKHRoaXMucG9zLCBcIlVudGVybWluYXRlZCB0ZW1wbGF0ZSBsaXRlcmFsXCIpOyB9XG4gICAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmRvbGxhckJyYWNlTCk7XG4gICAgICBub2RlLmV4cHJlc3Npb25zLnB1c2godGhpcy5wYXJzZUV4cHJlc3Npb24oKSk7XG4gICAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmJyYWNlUik7XG4gICAgICBub2RlLnF1YXNpcy5wdXNoKGN1ckVsdCA9IHRoaXMucGFyc2VUZW1wbGF0ZUVsZW1lbnQoe2lzVGFnZ2VkOiBpc1RhZ2dlZH0pKTtcbiAgICB9XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlRlbXBsYXRlTGl0ZXJhbFwiKVxuICB9O1xuXG4gIHBwJDUuaXNBc3luY1Byb3AgPSBmdW5jdGlvbihwcm9wKSB7XG4gICAgcmV0dXJuICFwcm9wLmNvbXB1dGVkICYmIHByb3Aua2V5LnR5cGUgPT09IFwiSWRlbnRpZmllclwiICYmIHByb3Aua2V5Lm5hbWUgPT09IFwiYXN5bmNcIiAmJlxuICAgICAgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5uYW1lIHx8IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5udW0gfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLnN0cmluZyB8fCB0aGlzLnR5cGUgPT09IHR5cGVzJDEuYnJhY2tldEwgfHwgdGhpcy50eXBlLmtleXdvcmQgfHwgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5ICYmIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5zdGFyKSkgJiZcbiAgICAgICFsaW5lQnJlYWsudGVzdCh0aGlzLmlucHV0LnNsaWNlKHRoaXMubGFzdFRva0VuZCwgdGhpcy5zdGFydCkpXG4gIH07XG5cbiAgLy8gUGFyc2UgYW4gb2JqZWN0IGxpdGVyYWwgb3IgYmluZGluZyBwYXR0ZXJuLlxuXG4gIHBwJDUucGFyc2VPYmogPSBmdW5jdGlvbihpc1BhdHRlcm4sIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCksIGZpcnN0ID0gdHJ1ZSwgcHJvcEhhc2ggPSB7fTtcbiAgICBub2RlLnByb3BlcnRpZXMgPSBbXTtcbiAgICB0aGlzLm5leHQoKTtcbiAgICB3aGlsZSAoIXRoaXMuZWF0KHR5cGVzJDEuYnJhY2VSKSkge1xuICAgICAgaWYgKCFmaXJzdCkge1xuICAgICAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmNvbW1hKTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA1ICYmIHRoaXMuYWZ0ZXJUcmFpbGluZ0NvbW1hKHR5cGVzJDEuYnJhY2VSKSkgeyBicmVhayB9XG4gICAgICB9IGVsc2UgeyBmaXJzdCA9IGZhbHNlOyB9XG5cbiAgICAgIHZhciBwcm9wID0gdGhpcy5wYXJzZVByb3BlcnR5KGlzUGF0dGVybiwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgICBpZiAoIWlzUGF0dGVybikgeyB0aGlzLmNoZWNrUHJvcENsYXNoKHByb3AsIHByb3BIYXNoLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTsgfVxuICAgICAgbm9kZS5wcm9wZXJ0aWVzLnB1c2gocHJvcCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgaXNQYXR0ZXJuID8gXCJPYmplY3RQYXR0ZXJuXCIgOiBcIk9iamVjdEV4cHJlc3Npb25cIilcbiAgfTtcblxuICBwcCQ1LnBhcnNlUHJvcGVydHkgPSBmdW5jdGlvbihpc1BhdHRlcm4sIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICB2YXIgcHJvcCA9IHRoaXMuc3RhcnROb2RlKCksIGlzR2VuZXJhdG9yLCBpc0FzeW5jLCBzdGFydFBvcywgc3RhcnRMb2M7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5ICYmIHRoaXMuZWF0KHR5cGVzJDEuZWxsaXBzaXMpKSB7XG4gICAgICBpZiAoaXNQYXR0ZXJuKSB7XG4gICAgICAgIHByb3AuYXJndW1lbnQgPSB0aGlzLnBhcnNlSWRlbnQoZmFsc2UpO1xuICAgICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmNvbW1hKSB7XG4gICAgICAgICAgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMuc3RhcnQsIFwiQ29tbWEgaXMgbm90IHBlcm1pdHRlZCBhZnRlciB0aGUgcmVzdCBlbGVtZW50XCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUocHJvcCwgXCJSZXN0RWxlbWVudFwiKVxuICAgICAgfVxuICAgICAgLy8gUGFyc2UgYXJndW1lbnQuXG4gICAgICBwcm9wLmFyZ3VtZW50ID0gdGhpcy5wYXJzZU1heWJlQXNzaWduKGZhbHNlLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTtcbiAgICAgIC8vIFRvIGRpc2FsbG93IHRyYWlsaW5nIGNvbW1hIHZpYSBgdGhpcy50b0Fzc2lnbmFibGUoKWAuXG4gICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmNvbW1hICYmIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMgJiYgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy50cmFpbGluZ0NvbW1hIDwgMCkge1xuICAgICAgICByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnRyYWlsaW5nQ29tbWEgPSB0aGlzLnN0YXJ0O1xuICAgICAgfVxuICAgICAgLy8gRmluaXNoXG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKHByb3AsIFwiU3ByZWFkRWxlbWVudFwiKVxuICAgIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpIHtcbiAgICAgIHByb3AubWV0aG9kID0gZmFsc2U7XG4gICAgICBwcm9wLnNob3J0aGFuZCA9IGZhbHNlO1xuICAgICAgaWYgKGlzUGF0dGVybiB8fCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7XG4gICAgICAgIHN0YXJ0UG9zID0gdGhpcy5zdGFydDtcbiAgICAgICAgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jO1xuICAgICAgfVxuICAgICAgaWYgKCFpc1BhdHRlcm4pXG4gICAgICAgIHsgaXNHZW5lcmF0b3IgPSB0aGlzLmVhdCh0eXBlcyQxLnN0YXIpOyB9XG4gICAgfVxuICAgIHZhciBjb250YWluc0VzYyA9IHRoaXMuY29udGFpbnNFc2M7XG4gICAgdGhpcy5wYXJzZVByb3BlcnR5TmFtZShwcm9wKTtcbiAgICBpZiAoIWlzUGF0dGVybiAmJiAhY29udGFpbnNFc2MgJiYgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDggJiYgIWlzR2VuZXJhdG9yICYmIHRoaXMuaXNBc3luY1Byb3AocHJvcCkpIHtcbiAgICAgIGlzQXN5bmMgPSB0cnVlO1xuICAgICAgaXNHZW5lcmF0b3IgPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOSAmJiB0aGlzLmVhdCh0eXBlcyQxLnN0YXIpO1xuICAgICAgdGhpcy5wYXJzZVByb3BlcnR5TmFtZShwcm9wKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaXNBc3luYyA9IGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLnBhcnNlUHJvcGVydHlWYWx1ZShwcm9wLCBpc1BhdHRlcm4sIGlzR2VuZXJhdG9yLCBpc0FzeW5jLCBzdGFydFBvcywgc3RhcnRMb2MsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIGNvbnRhaW5zRXNjKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKHByb3AsIFwiUHJvcGVydHlcIilcbiAgfTtcblxuICBwcCQ1LnBhcnNlR2V0dGVyU2V0dGVyID0gZnVuY3Rpb24ocHJvcCkge1xuICAgIHByb3Aua2luZCA9IHByb3Aua2V5Lm5hbWU7XG4gICAgdGhpcy5wYXJzZVByb3BlcnR5TmFtZShwcm9wKTtcbiAgICBwcm9wLnZhbHVlID0gdGhpcy5wYXJzZU1ldGhvZChmYWxzZSk7XG4gICAgdmFyIHBhcmFtQ291bnQgPSBwcm9wLmtpbmQgPT09IFwiZ2V0XCIgPyAwIDogMTtcbiAgICBpZiAocHJvcC52YWx1ZS5wYXJhbXMubGVuZ3RoICE9PSBwYXJhbUNvdW50KSB7XG4gICAgICB2YXIgc3RhcnQgPSBwcm9wLnZhbHVlLnN0YXJ0O1xuICAgICAgaWYgKHByb3Aua2luZCA9PT0gXCJnZXRcIilcbiAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoc3RhcnQsIFwiZ2V0dGVyIHNob3VsZCBoYXZlIG5vIHBhcmFtc1wiKTsgfVxuICAgICAgZWxzZVxuICAgICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShzdGFydCwgXCJzZXR0ZXIgc2hvdWxkIGhhdmUgZXhhY3RseSBvbmUgcGFyYW1cIik7IH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHByb3Aua2luZCA9PT0gXCJzZXRcIiAmJiBwcm9wLnZhbHVlLnBhcmFtc1swXS50eXBlID09PSBcIlJlc3RFbGVtZW50XCIpXG4gICAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHByb3AudmFsdWUucGFyYW1zWzBdLnN0YXJ0LCBcIlNldHRlciBjYW5ub3QgdXNlIHJlc3QgcGFyYW1zXCIpOyB9XG4gICAgfVxuICB9O1xuXG4gIHBwJDUucGFyc2VQcm9wZXJ0eVZhbHVlID0gZnVuY3Rpb24ocHJvcCwgaXNQYXR0ZXJuLCBpc0dlbmVyYXRvciwgaXNBc3luYywgc3RhcnRQb3MsIHN0YXJ0TG9jLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCBjb250YWluc0VzYykge1xuICAgIGlmICgoaXNHZW5lcmF0b3IgfHwgaXNBc3luYykgJiYgdGhpcy50eXBlID09PSB0eXBlcyQxLmNvbG9uKVxuICAgICAgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuXG4gICAgaWYgKHRoaXMuZWF0KHR5cGVzJDEuY29sb24pKSB7XG4gICAgICBwcm9wLnZhbHVlID0gaXNQYXR0ZXJuID8gdGhpcy5wYXJzZU1heWJlRGVmYXVsdCh0aGlzLnN0YXJ0LCB0aGlzLnN0YXJ0TG9jKSA6IHRoaXMucGFyc2VNYXliZUFzc2lnbihmYWxzZSwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgICBwcm9wLmtpbmQgPSBcImluaXRcIjtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ICYmIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5wYXJlbkwpIHtcbiAgICAgIGlmIChpc1BhdHRlcm4pIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgIHByb3Aua2luZCA9IFwiaW5pdFwiO1xuICAgICAgcHJvcC5tZXRob2QgPSB0cnVlO1xuICAgICAgcHJvcC52YWx1ZSA9IHRoaXMucGFyc2VNZXRob2QoaXNHZW5lcmF0b3IsIGlzQXN5bmMpO1xuICAgIH0gZWxzZSBpZiAoIWlzUGF0dGVybiAmJiAhY29udGFpbnNFc2MgJiZcbiAgICAgICAgICAgICAgIHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA1ICYmICFwcm9wLmNvbXB1dGVkICYmIHByb3Aua2V5LnR5cGUgPT09IFwiSWRlbnRpZmllclwiICYmXG4gICAgICAgICAgICAgICAocHJvcC5rZXkubmFtZSA9PT0gXCJnZXRcIiB8fCBwcm9wLmtleS5uYW1lID09PSBcInNldFwiKSAmJlxuICAgICAgICAgICAgICAgKHRoaXMudHlwZSAhPT0gdHlwZXMkMS5jb21tYSAmJiB0aGlzLnR5cGUgIT09IHR5cGVzJDEuYnJhY2VSICYmIHRoaXMudHlwZSAhPT0gdHlwZXMkMS5lcSkpIHtcbiAgICAgIGlmIChpc0dlbmVyYXRvciB8fCBpc0FzeW5jKSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICB0aGlzLnBhcnNlR2V0dGVyU2V0dGVyKHByb3ApO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYgJiYgIXByb3AuY29tcHV0ZWQgJiYgcHJvcC5rZXkudHlwZSA9PT0gXCJJZGVudGlmaWVyXCIpIHtcbiAgICAgIGlmIChpc0dlbmVyYXRvciB8fCBpc0FzeW5jKSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICB0aGlzLmNoZWNrVW5yZXNlcnZlZChwcm9wLmtleSk7XG4gICAgICBpZiAocHJvcC5rZXkubmFtZSA9PT0gXCJhd2FpdFwiICYmICF0aGlzLmF3YWl0SWRlbnRQb3MpXG4gICAgICAgIHsgdGhpcy5hd2FpdElkZW50UG9zID0gc3RhcnRQb3M7IH1cbiAgICAgIHByb3Aua2luZCA9IFwiaW5pdFwiO1xuICAgICAgaWYgKGlzUGF0dGVybikge1xuICAgICAgICBwcm9wLnZhbHVlID0gdGhpcy5wYXJzZU1heWJlRGVmYXVsdChzdGFydFBvcywgc3RhcnRMb2MsIHRoaXMuY29weU5vZGUocHJvcC5rZXkpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmVxICYmIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICAgICAgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMuc2hvcnRoYW5kQXNzaWduIDwgMClcbiAgICAgICAgICB7IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMuc2hvcnRoYW5kQXNzaWduID0gdGhpcy5zdGFydDsgfVxuICAgICAgICBwcm9wLnZhbHVlID0gdGhpcy5wYXJzZU1heWJlRGVmYXVsdChzdGFydFBvcywgc3RhcnRMb2MsIHRoaXMuY29weU5vZGUocHJvcC5rZXkpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByb3AudmFsdWUgPSB0aGlzLmNvcHlOb2RlKHByb3Aua2V5KTtcbiAgICAgIH1cbiAgICAgIHByb3Auc2hvcnRoYW5kID0gdHJ1ZTtcbiAgICB9IGVsc2UgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICB9O1xuXG4gIHBwJDUucGFyc2VQcm9wZXJ0eU5hbWUgPSBmdW5jdGlvbihwcm9wKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2KSB7XG4gICAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5icmFja2V0TCkpIHtcbiAgICAgICAgcHJvcC5jb21wdXRlZCA9IHRydWU7XG4gICAgICAgIHByb3Aua2V5ID0gdGhpcy5wYXJzZU1heWJlQXNzaWduKCk7XG4gICAgICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuYnJhY2tldFIpO1xuICAgICAgICByZXR1cm4gcHJvcC5rZXlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByb3AuY29tcHV0ZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHByb3Aua2V5ID0gdGhpcy50eXBlID09PSB0eXBlcyQxLm51bSB8fCB0aGlzLnR5cGUgPT09IHR5cGVzJDEuc3RyaW5nID8gdGhpcy5wYXJzZUV4cHJBdG9tKCkgOiB0aGlzLnBhcnNlSWRlbnQodGhpcy5vcHRpb25zLmFsbG93UmVzZXJ2ZWQgIT09IFwibmV2ZXJcIilcbiAgfTtcblxuICAvLyBJbml0aWFsaXplIGVtcHR5IGZ1bmN0aW9uIG5vZGUuXG5cbiAgcHAkNS5pbml0RnVuY3Rpb24gPSBmdW5jdGlvbihub2RlKSB7XG4gICAgbm9kZS5pZCA9IG51bGw7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2KSB7IG5vZGUuZ2VuZXJhdG9yID0gbm9kZS5leHByZXNzaW9uID0gZmFsc2U7IH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDgpIHsgbm9kZS5hc3luYyA9IGZhbHNlOyB9XG4gIH07XG5cbiAgLy8gUGFyc2Ugb2JqZWN0IG9yIGNsYXNzIG1ldGhvZC5cblxuICBwcCQ1LnBhcnNlTWV0aG9kID0gZnVuY3Rpb24oaXNHZW5lcmF0b3IsIGlzQXN5bmMsIGFsbG93RGlyZWN0U3VwZXIpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCksIG9sZFlpZWxkUG9zID0gdGhpcy55aWVsZFBvcywgb2xkQXdhaXRQb3MgPSB0aGlzLmF3YWl0UG9zLCBvbGRBd2FpdElkZW50UG9zID0gdGhpcy5hd2FpdElkZW50UG9zO1xuXG4gICAgdGhpcy5pbml0RnVuY3Rpb24obm9kZSk7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2KVxuICAgICAgeyBub2RlLmdlbmVyYXRvciA9IGlzR2VuZXJhdG9yOyB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA4KVxuICAgICAgeyBub2RlLmFzeW5jID0gISFpc0FzeW5jOyB9XG5cbiAgICB0aGlzLnlpZWxkUG9zID0gMDtcbiAgICB0aGlzLmF3YWl0UG9zID0gMDtcbiAgICB0aGlzLmF3YWl0SWRlbnRQb3MgPSAwO1xuICAgIHRoaXMuZW50ZXJTY29wZShmdW5jdGlvbkZsYWdzKGlzQXN5bmMsIG5vZGUuZ2VuZXJhdG9yKSB8IFNDT1BFX1NVUEVSIHwgKGFsbG93RGlyZWN0U3VwZXIgPyBTQ09QRV9ESVJFQ1RfU1VQRVIgOiAwKSk7XG5cbiAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLnBhcmVuTCk7XG4gICAgbm9kZS5wYXJhbXMgPSB0aGlzLnBhcnNlQmluZGluZ0xpc3QodHlwZXMkMS5wYXJlblIsIGZhbHNlLCB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOCk7XG4gICAgdGhpcy5jaGVja1lpZWxkQXdhaXRJbkRlZmF1bHRQYXJhbXMoKTtcbiAgICB0aGlzLnBhcnNlRnVuY3Rpb25Cb2R5KG5vZGUsIGZhbHNlLCB0cnVlLCBmYWxzZSk7XG5cbiAgICB0aGlzLnlpZWxkUG9zID0gb2xkWWllbGRQb3M7XG4gICAgdGhpcy5hd2FpdFBvcyA9IG9sZEF3YWl0UG9zO1xuICAgIHRoaXMuYXdhaXRJZGVudFBvcyA9IG9sZEF3YWl0SWRlbnRQb3M7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkZ1bmN0aW9uRXhwcmVzc2lvblwiKVxuICB9O1xuXG4gIC8vIFBhcnNlIGFycm93IGZ1bmN0aW9uIGV4cHJlc3Npb24gd2l0aCBnaXZlbiBwYXJhbWV0ZXJzLlxuXG4gIHBwJDUucGFyc2VBcnJvd0V4cHJlc3Npb24gPSBmdW5jdGlvbihub2RlLCBwYXJhbXMsIGlzQXN5bmMsIGZvckluaXQpIHtcbiAgICB2YXIgb2xkWWllbGRQb3MgPSB0aGlzLnlpZWxkUG9zLCBvbGRBd2FpdFBvcyA9IHRoaXMuYXdhaXRQb3MsIG9sZEF3YWl0SWRlbnRQb3MgPSB0aGlzLmF3YWl0SWRlbnRQb3M7XG5cbiAgICB0aGlzLmVudGVyU2NvcGUoZnVuY3Rpb25GbGFncyhpc0FzeW5jLCBmYWxzZSkgfCBTQ09QRV9BUlJPVyk7XG4gICAgdGhpcy5pbml0RnVuY3Rpb24obm9kZSk7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA4KSB7IG5vZGUuYXN5bmMgPSAhIWlzQXN5bmM7IH1cblxuICAgIHRoaXMueWllbGRQb3MgPSAwO1xuICAgIHRoaXMuYXdhaXRQb3MgPSAwO1xuICAgIHRoaXMuYXdhaXRJZGVudFBvcyA9IDA7XG5cbiAgICBub2RlLnBhcmFtcyA9IHRoaXMudG9Bc3NpZ25hYmxlTGlzdChwYXJhbXMsIHRydWUpO1xuICAgIHRoaXMucGFyc2VGdW5jdGlvbkJvZHkobm9kZSwgdHJ1ZSwgZmFsc2UsIGZvckluaXQpO1xuXG4gICAgdGhpcy55aWVsZFBvcyA9IG9sZFlpZWxkUG9zO1xuICAgIHRoaXMuYXdhaXRQb3MgPSBvbGRBd2FpdFBvcztcbiAgICB0aGlzLmF3YWl0SWRlbnRQb3MgPSBvbGRBd2FpdElkZW50UG9zO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvblwiKVxuICB9O1xuXG4gIC8vIFBhcnNlIGZ1bmN0aW9uIGJvZHkgYW5kIGNoZWNrIHBhcmFtZXRlcnMuXG5cbiAgcHAkNS5wYXJzZUZ1bmN0aW9uQm9keSA9IGZ1bmN0aW9uKG5vZGUsIGlzQXJyb3dGdW5jdGlvbiwgaXNNZXRob2QsIGZvckluaXQpIHtcbiAgICB2YXIgaXNFeHByZXNzaW9uID0gaXNBcnJvd0Z1bmN0aW9uICYmIHRoaXMudHlwZSAhPT0gdHlwZXMkMS5icmFjZUw7XG4gICAgdmFyIG9sZFN0cmljdCA9IHRoaXMuc3RyaWN0LCB1c2VTdHJpY3QgPSBmYWxzZTtcblxuICAgIGlmIChpc0V4cHJlc3Npb24pIHtcbiAgICAgIG5vZGUuYm9keSA9IHRoaXMucGFyc2VNYXliZUFzc2lnbihmb3JJbml0KTtcbiAgICAgIG5vZGUuZXhwcmVzc2lvbiA9IHRydWU7XG4gICAgICB0aGlzLmNoZWNrUGFyYW1zKG5vZGUsIGZhbHNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG5vblNpbXBsZSA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA3ICYmICF0aGlzLmlzU2ltcGxlUGFyYW1MaXN0KG5vZGUucGFyYW1zKTtcbiAgICAgIGlmICghb2xkU3RyaWN0IHx8IG5vblNpbXBsZSkge1xuICAgICAgICB1c2VTdHJpY3QgPSB0aGlzLnN0cmljdERpcmVjdGl2ZSh0aGlzLmVuZCk7XG4gICAgICAgIC8vIElmIHRoaXMgaXMgYSBzdHJpY3QgbW9kZSBmdW5jdGlvbiwgdmVyaWZ5IHRoYXQgYXJndW1lbnQgbmFtZXNcbiAgICAgICAgLy8gYXJlIG5vdCByZXBlYXRlZCwgYW5kIGl0IGRvZXMgbm90IHRyeSB0byBiaW5kIHRoZSB3b3JkcyBgZXZhbGBcbiAgICAgICAgLy8gb3IgYGFyZ3VtZW50c2AuXG4gICAgICAgIGlmICh1c2VTdHJpY3QgJiYgbm9uU2ltcGxlKVxuICAgICAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKG5vZGUuc3RhcnQsIFwiSWxsZWdhbCAndXNlIHN0cmljdCcgZGlyZWN0aXZlIGluIGZ1bmN0aW9uIHdpdGggbm9uLXNpbXBsZSBwYXJhbWV0ZXIgbGlzdFwiKTsgfVxuICAgICAgfVxuICAgICAgLy8gU3RhcnQgYSBuZXcgc2NvcGUgd2l0aCByZWdhcmQgdG8gbGFiZWxzIGFuZCB0aGUgYGluRnVuY3Rpb25gXG4gICAgICAvLyBmbGFnIChyZXN0b3JlIHRoZW0gdG8gdGhlaXIgb2xkIHZhbHVlIGFmdGVyd2FyZHMpLlxuICAgICAgdmFyIG9sZExhYmVscyA9IHRoaXMubGFiZWxzO1xuICAgICAgdGhpcy5sYWJlbHMgPSBbXTtcbiAgICAgIGlmICh1c2VTdHJpY3QpIHsgdGhpcy5zdHJpY3QgPSB0cnVlOyB9XG5cbiAgICAgIC8vIEFkZCB0aGUgcGFyYW1zIHRvIHZhckRlY2xhcmVkTmFtZXMgdG8gZW5zdXJlIHRoYXQgYW4gZXJyb3IgaXMgdGhyb3duXG4gICAgICAvLyBpZiBhIGxldC9jb25zdCBkZWNsYXJhdGlvbiBpbiB0aGUgZnVuY3Rpb24gY2xhc2hlcyB3aXRoIG9uZSBvZiB0aGUgcGFyYW1zLlxuICAgICAgdGhpcy5jaGVja1BhcmFtcyhub2RlLCAhb2xkU3RyaWN0ICYmICF1c2VTdHJpY3QgJiYgIWlzQXJyb3dGdW5jdGlvbiAmJiAhaXNNZXRob2QgJiYgdGhpcy5pc1NpbXBsZVBhcmFtTGlzdChub2RlLnBhcmFtcykpO1xuICAgICAgLy8gRW5zdXJlIHRoZSBmdW5jdGlvbiBuYW1lIGlzbid0IGEgZm9yYmlkZGVuIGlkZW50aWZpZXIgaW4gc3RyaWN0IG1vZGUsIGUuZy4gJ2V2YWwnXG4gICAgICBpZiAodGhpcy5zdHJpY3QgJiYgbm9kZS5pZCkgeyB0aGlzLmNoZWNrTFZhbFNpbXBsZShub2RlLmlkLCBCSU5EX09VVFNJREUpOyB9XG4gICAgICBub2RlLmJvZHkgPSB0aGlzLnBhcnNlQmxvY2soZmFsc2UsIHVuZGVmaW5lZCwgdXNlU3RyaWN0ICYmICFvbGRTdHJpY3QpO1xuICAgICAgbm9kZS5leHByZXNzaW9uID0gZmFsc2U7XG4gICAgICB0aGlzLmFkYXB0RGlyZWN0aXZlUHJvbG9ndWUobm9kZS5ib2R5LmJvZHkpO1xuICAgICAgdGhpcy5sYWJlbHMgPSBvbGRMYWJlbHM7XG4gICAgfVxuICAgIHRoaXMuZXhpdFNjb3BlKCk7XG4gIH07XG5cbiAgcHAkNS5pc1NpbXBsZVBhcmFtTGlzdCA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICAgIGZvciAodmFyIGkgPSAwLCBsaXN0ID0gcGFyYW1zOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gMSlcbiAgICAgIHtcbiAgICAgIHZhciBwYXJhbSA9IGxpc3RbaV07XG5cbiAgICAgIGlmIChwYXJhbS50eXBlICE9PSBcIklkZW50aWZpZXJcIikgeyByZXR1cm4gZmFsc2VcbiAgICB9IH1cbiAgICByZXR1cm4gdHJ1ZVxuICB9O1xuXG4gIC8vIENoZWNrcyBmdW5jdGlvbiBwYXJhbXMgZm9yIHZhcmlvdXMgZGlzYWxsb3dlZCBwYXR0ZXJucyBzdWNoIGFzIHVzaW5nIFwiZXZhbFwiXG4gIC8vIG9yIFwiYXJndW1lbnRzXCIgYW5kIGR1cGxpY2F0ZSBwYXJhbWV0ZXJzLlxuXG4gIHBwJDUuY2hlY2tQYXJhbXMgPSBmdW5jdGlvbihub2RlLCBhbGxvd0R1cGxpY2F0ZXMpIHtcbiAgICB2YXIgbmFtZUhhc2ggPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGZvciAodmFyIGkgPSAwLCBsaXN0ID0gbm9kZS5wYXJhbXM7IGkgPCBsaXN0Lmxlbmd0aDsgaSArPSAxKVxuICAgICAge1xuICAgICAgdmFyIHBhcmFtID0gbGlzdFtpXTtcblxuICAgICAgdGhpcy5jaGVja0xWYWxJbm5lclBhdHRlcm4ocGFyYW0sIEJJTkRfVkFSLCBhbGxvd0R1cGxpY2F0ZXMgPyBudWxsIDogbmFtZUhhc2gpO1xuICAgIH1cbiAgfTtcblxuICAvLyBQYXJzZXMgYSBjb21tYS1zZXBhcmF0ZWQgbGlzdCBvZiBleHByZXNzaW9ucywgYW5kIHJldHVybnMgdGhlbSBhc1xuICAvLyBhbiBhcnJheS4gYGNsb3NlYCBpcyB0aGUgdG9rZW4gdHlwZSB0aGF0IGVuZHMgdGhlIGxpc3QsIGFuZFxuICAvLyBgYWxsb3dFbXB0eWAgY2FuIGJlIHR1cm5lZCBvbiB0byBhbGxvdyBzdWJzZXF1ZW50IGNvbW1hcyB3aXRoXG4gIC8vIG5vdGhpbmcgaW4gYmV0d2VlbiB0aGVtIHRvIGJlIHBhcnNlZCBhcyBgbnVsbGAgKHdoaWNoIGlzIG5lZWRlZFxuICAvLyBmb3IgYXJyYXkgbGl0ZXJhbHMpLlxuXG4gIHBwJDUucGFyc2VFeHByTGlzdCA9IGZ1bmN0aW9uKGNsb3NlLCBhbGxvd1RyYWlsaW5nQ29tbWEsIGFsbG93RW1wdHksIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICB2YXIgZWx0cyA9IFtdLCBmaXJzdCA9IHRydWU7XG4gICAgd2hpbGUgKCF0aGlzLmVhdChjbG9zZSkpIHtcbiAgICAgIGlmICghZmlyc3QpIHtcbiAgICAgICAgdGhpcy5leHBlY3QodHlwZXMkMS5jb21tYSk7XG4gICAgICAgIGlmIChhbGxvd1RyYWlsaW5nQ29tbWEgJiYgdGhpcy5hZnRlclRyYWlsaW5nQ29tbWEoY2xvc2UpKSB7IGJyZWFrIH1cbiAgICAgIH0gZWxzZSB7IGZpcnN0ID0gZmFsc2U7IH1cblxuICAgICAgdmFyIGVsdCA9ICh2b2lkIDApO1xuICAgICAgaWYgKGFsbG93RW1wdHkgJiYgdGhpcy50eXBlID09PSB0eXBlcyQxLmNvbW1hKVxuICAgICAgICB7IGVsdCA9IG51bGw7IH1cbiAgICAgIGVsc2UgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5lbGxpcHNpcykge1xuICAgICAgICBlbHQgPSB0aGlzLnBhcnNlU3ByZWFkKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpO1xuICAgICAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyAmJiB0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29tbWEgJiYgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy50cmFpbGluZ0NvbW1hIDwgMClcbiAgICAgICAgICB7IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMudHJhaWxpbmdDb21tYSA9IHRoaXMuc3RhcnQ7IH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsdCA9IHRoaXMucGFyc2VNYXliZUFzc2lnbihmYWxzZSwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgICB9XG4gICAgICBlbHRzLnB1c2goZWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIGVsdHNcbiAgfTtcblxuICBwcCQ1LmNoZWNrVW5yZXNlcnZlZCA9IGZ1bmN0aW9uKHJlZikge1xuICAgIHZhciBzdGFydCA9IHJlZi5zdGFydDtcbiAgICB2YXIgZW5kID0gcmVmLmVuZDtcbiAgICB2YXIgbmFtZSA9IHJlZi5uYW1lO1xuXG4gICAgaWYgKHRoaXMuaW5HZW5lcmF0b3IgJiYgbmFtZSA9PT0gXCJ5aWVsZFwiKVxuICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoc3RhcnQsIFwiQ2Fubm90IHVzZSAneWllbGQnIGFzIGlkZW50aWZpZXIgaW5zaWRlIGEgZ2VuZXJhdG9yXCIpOyB9XG4gICAgaWYgKHRoaXMuaW5Bc3luYyAmJiBuYW1lID09PSBcImF3YWl0XCIpXG4gICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShzdGFydCwgXCJDYW5ub3QgdXNlICdhd2FpdCcgYXMgaWRlbnRpZmllciBpbnNpZGUgYW4gYXN5bmMgZnVuY3Rpb25cIik7IH1cbiAgICBpZiAodGhpcy5jdXJyZW50VGhpc1Njb3BlKCkuaW5DbGFzc0ZpZWxkSW5pdCAmJiBuYW1lID09PSBcImFyZ3VtZW50c1wiKVxuICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoc3RhcnQsIFwiQ2Fubm90IHVzZSAnYXJndW1lbnRzJyBpbiBjbGFzcyBmaWVsZCBpbml0aWFsaXplclwiKTsgfVxuICAgIGlmICh0aGlzLmluQ2xhc3NTdGF0aWNCbG9jayAmJiAobmFtZSA9PT0gXCJhcmd1bWVudHNcIiB8fCBuYW1lID09PSBcImF3YWl0XCIpKVxuICAgICAgeyB0aGlzLnJhaXNlKHN0YXJ0LCAoXCJDYW5ub3QgdXNlIFwiICsgbmFtZSArIFwiIGluIGNsYXNzIHN0YXRpYyBpbml0aWFsaXphdGlvbiBibG9ja1wiKSk7IH1cbiAgICBpZiAodGhpcy5rZXl3b3Jkcy50ZXN0KG5hbWUpKVxuICAgICAgeyB0aGlzLnJhaXNlKHN0YXJ0LCAoXCJVbmV4cGVjdGVkIGtleXdvcmQgJ1wiICsgbmFtZSArIFwiJ1wiKSk7IH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uIDwgNiAmJlxuICAgICAgdGhpcy5pbnB1dC5zbGljZShzdGFydCwgZW5kKS5pbmRleE9mKFwiXFxcXFwiKSAhPT0gLTEpIHsgcmV0dXJuIH1cbiAgICB2YXIgcmUgPSB0aGlzLnN0cmljdCA/IHRoaXMucmVzZXJ2ZWRXb3Jkc1N0cmljdCA6IHRoaXMucmVzZXJ2ZWRXb3JkcztcbiAgICBpZiAocmUudGVzdChuYW1lKSkge1xuICAgICAgaWYgKCF0aGlzLmluQXN5bmMgJiYgbmFtZSA9PT0gXCJhd2FpdFwiKVxuICAgICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShzdGFydCwgXCJDYW5ub3QgdXNlIGtleXdvcmQgJ2F3YWl0JyBvdXRzaWRlIGFuIGFzeW5jIGZ1bmN0aW9uXCIpOyB9XG4gICAgICB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoc3RhcnQsIChcIlRoZSBrZXl3b3JkICdcIiArIG5hbWUgKyBcIicgaXMgcmVzZXJ2ZWRcIikpO1xuICAgIH1cbiAgfTtcblxuICAvLyBQYXJzZSB0aGUgbmV4dCB0b2tlbiBhcyBhbiBpZGVudGlmaWVyLiBJZiBgbGliZXJhbGAgaXMgdHJ1ZSAodXNlZFxuICAvLyB3aGVuIHBhcnNpbmcgcHJvcGVydGllcyksIGl0IHdpbGwgYWxzbyBjb252ZXJ0IGtleXdvcmRzIGludG9cbiAgLy8gaWRlbnRpZmllcnMuXG5cbiAgcHAkNS5wYXJzZUlkZW50ID0gZnVuY3Rpb24obGliZXJhbCkge1xuICAgIHZhciBub2RlID0gdGhpcy5wYXJzZUlkZW50Tm9kZSgpO1xuICAgIHRoaXMubmV4dCghIWxpYmVyYWwpO1xuICAgIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIklkZW50aWZpZXJcIik7XG4gICAgaWYgKCFsaWJlcmFsKSB7XG4gICAgICB0aGlzLmNoZWNrVW5yZXNlcnZlZChub2RlKTtcbiAgICAgIGlmIChub2RlLm5hbWUgPT09IFwiYXdhaXRcIiAmJiAhdGhpcy5hd2FpdElkZW50UG9zKVxuICAgICAgICB7IHRoaXMuYXdhaXRJZGVudFBvcyA9IG5vZGUuc3RhcnQ7IH1cbiAgICB9XG4gICAgcmV0dXJuIG5vZGVcbiAgfTtcblxuICBwcCQ1LnBhcnNlSWRlbnROb2RlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEubmFtZSkge1xuICAgICAgbm9kZS5uYW1lID0gdGhpcy52YWx1ZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMudHlwZS5rZXl3b3JkKSB7XG4gICAgICBub2RlLm5hbWUgPSB0aGlzLnR5cGUua2V5d29yZDtcblxuICAgICAgLy8gVG8gZml4IGh0dHBzOi8vZ2l0aHViLmNvbS9hY29ybmpzL2Fjb3JuL2lzc3Vlcy81NzVcbiAgICAgIC8vIGBjbGFzc2AgYW5kIGBmdW5jdGlvbmAga2V5d29yZHMgcHVzaCBuZXcgY29udGV4dCBpbnRvIHRoaXMuY29udGV4dC5cbiAgICAgIC8vIEJ1dCB0aGVyZSBpcyBubyBjaGFuY2UgdG8gcG9wIHRoZSBjb250ZXh0IGlmIHRoZSBrZXl3b3JkIGlzIGNvbnN1bWVkIGFzIGFuIGlkZW50aWZpZXIgc3VjaCBhcyBhIHByb3BlcnR5IG5hbWUuXG4gICAgICAvLyBJZiB0aGUgcHJldmlvdXMgdG9rZW4gaXMgYSBkb3QsIHRoaXMgZG9lcyBub3QgYXBwbHkgYmVjYXVzZSB0aGUgY29udGV4dC1tYW5hZ2luZyBjb2RlIGFscmVhZHkgaWdub3JlZCB0aGUga2V5d29yZFxuICAgICAgaWYgKChub2RlLm5hbWUgPT09IFwiY2xhc3NcIiB8fCBub2RlLm5hbWUgPT09IFwiZnVuY3Rpb25cIikgJiZcbiAgICAgICAgKHRoaXMubGFzdFRva0VuZCAhPT0gdGhpcy5sYXN0VG9rU3RhcnQgKyAxIHx8IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLmxhc3RUb2tTdGFydCkgIT09IDQ2KSkge1xuICAgICAgICB0aGlzLmNvbnRleHQucG9wKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudW5leHBlY3RlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZVxuICB9O1xuXG4gIHBwJDUucGFyc2VQcml2YXRlSWRlbnQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5wcml2YXRlSWQpIHtcbiAgICAgIG5vZGUubmFtZSA9IHRoaXMudmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudW5leHBlY3RlZCgpO1xuICAgIH1cbiAgICB0aGlzLm5leHQoKTtcbiAgICB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJQcml2YXRlSWRlbnRpZmllclwiKTtcblxuICAgIC8vIEZvciB2YWxpZGF0aW5nIGV4aXN0ZW5jZVxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2hlY2tQcml2YXRlRmllbGRzKSB7XG4gICAgICBpZiAodGhpcy5wcml2YXRlTmFtZVN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLnJhaXNlKG5vZGUuc3RhcnQsIChcIlByaXZhdGUgZmllbGQgJyNcIiArIChub2RlLm5hbWUpICsgXCInIG11c3QgYmUgZGVjbGFyZWQgaW4gYW4gZW5jbG9zaW5nIGNsYXNzXCIpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucHJpdmF0ZU5hbWVTdGFja1t0aGlzLnByaXZhdGVOYW1lU3RhY2subGVuZ3RoIC0gMV0udXNlZC5wdXNoKG5vZGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2RlXG4gIH07XG5cbiAgLy8gUGFyc2VzIHlpZWxkIGV4cHJlc3Npb24gaW5zaWRlIGdlbmVyYXRvci5cblxuICBwcCQ1LnBhcnNlWWllbGQgPSBmdW5jdGlvbihmb3JJbml0KSB7XG4gICAgaWYgKCF0aGlzLnlpZWxkUG9zKSB7IHRoaXMueWllbGRQb3MgPSB0aGlzLnN0YXJ0OyB9XG5cbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5zZW1pIHx8IHRoaXMuY2FuSW5zZXJ0U2VtaWNvbG9uKCkgfHwgKHRoaXMudHlwZSAhPT0gdHlwZXMkMS5zdGFyICYmICF0aGlzLnR5cGUuc3RhcnRzRXhwcikpIHtcbiAgICAgIG5vZGUuZGVsZWdhdGUgPSBmYWxzZTtcbiAgICAgIG5vZGUuYXJndW1lbnQgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICBub2RlLmRlbGVnYXRlID0gdGhpcy5lYXQodHlwZXMkMS5zdGFyKTtcbiAgICAgIG5vZGUuYXJndW1lbnQgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oZm9ySW5pdCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJZaWVsZEV4cHJlc3Npb25cIilcbiAgfTtcblxuICBwcCQ1LnBhcnNlQXdhaXQgPSBmdW5jdGlvbihmb3JJbml0KSB7XG4gICAgaWYgKCF0aGlzLmF3YWl0UG9zKSB7IHRoaXMuYXdhaXRQb3MgPSB0aGlzLnN0YXJ0OyB9XG5cbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgbm9kZS5hcmd1bWVudCA9IHRoaXMucGFyc2VNYXliZVVuYXJ5KG51bGwsIHRydWUsIGZhbHNlLCBmb3JJbml0KTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiQXdhaXRFeHByZXNzaW9uXCIpXG4gIH07XG5cbiAgdmFyIHBwJDQgPSBQYXJzZXIucHJvdG90eXBlO1xuXG4gIC8vIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byByYWlzZSBleGNlcHRpb25zIG9uIHBhcnNlIGVycm9ycy4gSXRcbiAgLy8gdGFrZXMgYW4gb2Zmc2V0IGludGVnZXIgKGludG8gdGhlIGN1cnJlbnQgYGlucHV0YCkgdG8gaW5kaWNhdGVcbiAgLy8gdGhlIGxvY2F0aW9uIG9mIHRoZSBlcnJvciwgYXR0YWNoZXMgdGhlIHBvc2l0aW9uIHRvIHRoZSBlbmRcbiAgLy8gb2YgdGhlIGVycm9yIG1lc3NhZ2UsIGFuZCB0aGVuIHJhaXNlcyBhIGBTeW50YXhFcnJvcmAgd2l0aCB0aGF0XG4gIC8vIG1lc3NhZ2UuXG5cbiAgcHAkNC5yYWlzZSA9IGZ1bmN0aW9uKHBvcywgbWVzc2FnZSkge1xuICAgIHZhciBsb2MgPSBnZXRMaW5lSW5mbyh0aGlzLmlucHV0LCBwb3MpO1xuICAgIG1lc3NhZ2UgKz0gXCIgKFwiICsgbG9jLmxpbmUgKyBcIjpcIiArIGxvYy5jb2x1bW4gKyBcIilcIjtcbiAgICB2YXIgZXJyID0gbmV3IFN5bnRheEVycm9yKG1lc3NhZ2UpO1xuICAgIGVyci5wb3MgPSBwb3M7IGVyci5sb2MgPSBsb2M7IGVyci5yYWlzZWRBdCA9IHRoaXMucG9zO1xuICAgIHRocm93IGVyclxuICB9O1xuXG4gIHBwJDQucmFpc2VSZWNvdmVyYWJsZSA9IHBwJDQucmFpc2U7XG5cbiAgcHAkNC5jdXJQb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb25zKSB7XG4gICAgICByZXR1cm4gbmV3IFBvc2l0aW9uKHRoaXMuY3VyTGluZSwgdGhpcy5wb3MgLSB0aGlzLmxpbmVTdGFydClcbiAgICB9XG4gIH07XG5cbiAgdmFyIHBwJDMgPSBQYXJzZXIucHJvdG90eXBlO1xuXG4gIHZhciBTY29wZSA9IGZ1bmN0aW9uIFNjb3BlKGZsYWdzKSB7XG4gICAgdGhpcy5mbGFncyA9IGZsYWdzO1xuICAgIC8vIEEgbGlzdCBvZiB2YXItZGVjbGFyZWQgbmFtZXMgaW4gdGhlIGN1cnJlbnQgbGV4aWNhbCBzY29wZVxuICAgIHRoaXMudmFyID0gW107XG4gICAgLy8gQSBsaXN0IG9mIGxleGljYWxseS1kZWNsYXJlZCBuYW1lcyBpbiB0aGUgY3VycmVudCBsZXhpY2FsIHNjb3BlXG4gICAgdGhpcy5sZXhpY2FsID0gW107XG4gICAgLy8gQSBsaXN0IG9mIGxleGljYWxseS1kZWNsYXJlZCBGdW5jdGlvbkRlY2xhcmF0aW9uIG5hbWVzIGluIHRoZSBjdXJyZW50IGxleGljYWwgc2NvcGVcbiAgICB0aGlzLmZ1bmN0aW9ucyA9IFtdO1xuICAgIC8vIEEgc3dpdGNoIHRvIGRpc2FsbG93IHRoZSBpZGVudGlmaWVyIHJlZmVyZW5jZSAnYXJndW1lbnRzJ1xuICAgIHRoaXMuaW5DbGFzc0ZpZWxkSW5pdCA9IGZhbHNlO1xuICB9O1xuXG4gIC8vIFRoZSBmdW5jdGlvbnMgaW4gdGhpcyBtb2R1bGUga2VlcCB0cmFjayBvZiBkZWNsYXJlZCB2YXJpYWJsZXMgaW4gdGhlIGN1cnJlbnQgc2NvcGUgaW4gb3JkZXIgdG8gZGV0ZWN0IGR1cGxpY2F0ZSB2YXJpYWJsZSBuYW1lcy5cblxuICBwcCQzLmVudGVyU2NvcGUgPSBmdW5jdGlvbihmbGFncykge1xuICAgIHRoaXMuc2NvcGVTdGFjay5wdXNoKG5ldyBTY29wZShmbGFncykpO1xuICB9O1xuXG4gIHBwJDMuZXhpdFNjb3BlID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zY29wZVN0YWNrLnBvcCgpO1xuICB9O1xuXG4gIC8vIFRoZSBzcGVjIHNheXM6XG4gIC8vID4gQXQgdGhlIHRvcCBsZXZlbCBvZiBhIGZ1bmN0aW9uLCBvciBzY3JpcHQsIGZ1bmN0aW9uIGRlY2xhcmF0aW9ucyBhcmVcbiAgLy8gPiB0cmVhdGVkIGxpa2UgdmFyIGRlY2xhcmF0aW9ucyByYXRoZXIgdGhhbiBsaWtlIGxleGljYWwgZGVjbGFyYXRpb25zLlxuICBwcCQzLnRyZWF0RnVuY3Rpb25zQXNWYXJJblNjb3BlID0gZnVuY3Rpb24oc2NvcGUpIHtcbiAgICByZXR1cm4gKHNjb3BlLmZsYWdzICYgU0NPUEVfRlVOQ1RJT04pIHx8ICF0aGlzLmluTW9kdWxlICYmIChzY29wZS5mbGFncyAmIFNDT1BFX1RPUClcbiAgfTtcblxuICBwcCQzLmRlY2xhcmVOYW1lID0gZnVuY3Rpb24obmFtZSwgYmluZGluZ1R5cGUsIHBvcykge1xuICAgIHZhciByZWRlY2xhcmVkID0gZmFsc2U7XG4gICAgaWYgKGJpbmRpbmdUeXBlID09PSBCSU5EX0xFWElDQUwpIHtcbiAgICAgIHZhciBzY29wZSA9IHRoaXMuY3VycmVudFNjb3BlKCk7XG4gICAgICByZWRlY2xhcmVkID0gc2NvcGUubGV4aWNhbC5pbmRleE9mKG5hbWUpID4gLTEgfHwgc2NvcGUuZnVuY3Rpb25zLmluZGV4T2YobmFtZSkgPiAtMSB8fCBzY29wZS52YXIuaW5kZXhPZihuYW1lKSA+IC0xO1xuICAgICAgc2NvcGUubGV4aWNhbC5wdXNoKG5hbWUpO1xuICAgICAgaWYgKHRoaXMuaW5Nb2R1bGUgJiYgKHNjb3BlLmZsYWdzICYgU0NPUEVfVE9QKSlcbiAgICAgICAgeyBkZWxldGUgdGhpcy51bmRlZmluZWRFeHBvcnRzW25hbWVdOyB9XG4gICAgfSBlbHNlIGlmIChiaW5kaW5nVHlwZSA9PT0gQklORF9TSU1QTEVfQ0FUQ0gpIHtcbiAgICAgIHZhciBzY29wZSQxID0gdGhpcy5jdXJyZW50U2NvcGUoKTtcbiAgICAgIHNjb3BlJDEubGV4aWNhbC5wdXNoKG5hbWUpO1xuICAgIH0gZWxzZSBpZiAoYmluZGluZ1R5cGUgPT09IEJJTkRfRlVOQ1RJT04pIHtcbiAgICAgIHZhciBzY29wZSQyID0gdGhpcy5jdXJyZW50U2NvcGUoKTtcbiAgICAgIGlmICh0aGlzLnRyZWF0RnVuY3Rpb25zQXNWYXIpXG4gICAgICAgIHsgcmVkZWNsYXJlZCA9IHNjb3BlJDIubGV4aWNhbC5pbmRleE9mKG5hbWUpID4gLTE7IH1cbiAgICAgIGVsc2VcbiAgICAgICAgeyByZWRlY2xhcmVkID0gc2NvcGUkMi5sZXhpY2FsLmluZGV4T2YobmFtZSkgPiAtMSB8fCBzY29wZSQyLnZhci5pbmRleE9mKG5hbWUpID4gLTE7IH1cbiAgICAgIHNjb3BlJDIuZnVuY3Rpb25zLnB1c2gobmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAodmFyIGkgPSB0aGlzLnNjb3BlU3RhY2subGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgdmFyIHNjb3BlJDMgPSB0aGlzLnNjb3BlU3RhY2tbaV07XG4gICAgICAgIGlmIChzY29wZSQzLmxleGljYWwuaW5kZXhPZihuYW1lKSA+IC0xICYmICEoKHNjb3BlJDMuZmxhZ3MgJiBTQ09QRV9TSU1QTEVfQ0FUQ0gpICYmIHNjb3BlJDMubGV4aWNhbFswXSA9PT0gbmFtZSkgfHxcbiAgICAgICAgICAgICF0aGlzLnRyZWF0RnVuY3Rpb25zQXNWYXJJblNjb3BlKHNjb3BlJDMpICYmIHNjb3BlJDMuZnVuY3Rpb25zLmluZGV4T2YobmFtZSkgPiAtMSkge1xuICAgICAgICAgIHJlZGVjbGFyZWQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgICAgc2NvcGUkMy52YXIucHVzaChuYW1lKTtcbiAgICAgICAgaWYgKHRoaXMuaW5Nb2R1bGUgJiYgKHNjb3BlJDMuZmxhZ3MgJiBTQ09QRV9UT1ApKVxuICAgICAgICAgIHsgZGVsZXRlIHRoaXMudW5kZWZpbmVkRXhwb3J0c1tuYW1lXTsgfVxuICAgICAgICBpZiAoc2NvcGUkMy5mbGFncyAmIFNDT1BFX1ZBUikgeyBicmVhayB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChyZWRlY2xhcmVkKSB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShwb3MsIChcIklkZW50aWZpZXIgJ1wiICsgbmFtZSArIFwiJyBoYXMgYWxyZWFkeSBiZWVuIGRlY2xhcmVkXCIpKTsgfVxuICB9O1xuXG4gIHBwJDMuY2hlY2tMb2NhbEV4cG9ydCA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgLy8gc2NvcGUuZnVuY3Rpb25zIG11c3QgYmUgZW1wdHkgYXMgTW9kdWxlIGNvZGUgaXMgYWx3YXlzIHN0cmljdC5cbiAgICBpZiAodGhpcy5zY29wZVN0YWNrWzBdLmxleGljYWwuaW5kZXhPZihpZC5uYW1lKSA9PT0gLTEgJiZcbiAgICAgICAgdGhpcy5zY29wZVN0YWNrWzBdLnZhci5pbmRleE9mKGlkLm5hbWUpID09PSAtMSkge1xuICAgICAgdGhpcy51bmRlZmluZWRFeHBvcnRzW2lkLm5hbWVdID0gaWQ7XG4gICAgfVxuICB9O1xuXG4gIHBwJDMuY3VycmVudFNjb3BlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc2NvcGVTdGFja1t0aGlzLnNjb3BlU3RhY2subGVuZ3RoIC0gMV1cbiAgfTtcblxuICBwcCQzLmN1cnJlbnRWYXJTY29wZSA9IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnNjb3BlU3RhY2subGVuZ3RoIC0gMTs7IGktLSkge1xuICAgICAgdmFyIHNjb3BlID0gdGhpcy5zY29wZVN0YWNrW2ldO1xuICAgICAgaWYgKHNjb3BlLmZsYWdzICYgU0NPUEVfVkFSKSB7IHJldHVybiBzY29wZSB9XG4gICAgfVxuICB9O1xuXG4gIC8vIENvdWxkIGJlIHVzZWZ1bCBmb3IgYHRoaXNgLCBgbmV3LnRhcmdldGAsIGBzdXBlcigpYCwgYHN1cGVyLnByb3BlcnR5YCwgYW5kIGBzdXBlcltwcm9wZXJ0eV1gLlxuICBwcCQzLmN1cnJlbnRUaGlzU2NvcGUgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5zY29wZVN0YWNrLmxlbmd0aCAtIDE7OyBpLS0pIHtcbiAgICAgIHZhciBzY29wZSA9IHRoaXMuc2NvcGVTdGFja1tpXTtcbiAgICAgIGlmIChzY29wZS5mbGFncyAmIFNDT1BFX1ZBUiAmJiAhKHNjb3BlLmZsYWdzICYgU0NPUEVfQVJST1cpKSB7IHJldHVybiBzY29wZSB9XG4gICAgfVxuICB9O1xuXG4gIHZhciBOb2RlID0gZnVuY3Rpb24gTm9kZShwYXJzZXIsIHBvcywgbG9jKSB7XG4gICAgdGhpcy50eXBlID0gXCJcIjtcbiAgICB0aGlzLnN0YXJ0ID0gcG9zO1xuICAgIHRoaXMuZW5kID0gMDtcbiAgICBpZiAocGFyc2VyLm9wdGlvbnMubG9jYXRpb25zKVxuICAgICAgeyB0aGlzLmxvYyA9IG5ldyBTb3VyY2VMb2NhdGlvbihwYXJzZXIsIGxvYyk7IH1cbiAgICBpZiAocGFyc2VyLm9wdGlvbnMuZGlyZWN0U291cmNlRmlsZSlcbiAgICAgIHsgdGhpcy5zb3VyY2VGaWxlID0gcGFyc2VyLm9wdGlvbnMuZGlyZWN0U291cmNlRmlsZTsgfVxuICAgIGlmIChwYXJzZXIub3B0aW9ucy5yYW5nZXMpXG4gICAgICB7IHRoaXMucmFuZ2UgPSBbcG9zLCAwXTsgfVxuICB9O1xuXG4gIC8vIFN0YXJ0IGFuIEFTVCBub2RlLCBhdHRhY2hpbmcgYSBzdGFydCBvZmZzZXQuXG5cbiAgdmFyIHBwJDIgPSBQYXJzZXIucHJvdG90eXBlO1xuXG4gIHBwJDIuc3RhcnROb2RlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBOb2RlKHRoaXMsIHRoaXMuc3RhcnQsIHRoaXMuc3RhcnRMb2MpXG4gIH07XG5cbiAgcHAkMi5zdGFydE5vZGVBdCA9IGZ1bmN0aW9uKHBvcywgbG9jKSB7XG4gICAgcmV0dXJuIG5ldyBOb2RlKHRoaXMsIHBvcywgbG9jKVxuICB9O1xuXG4gIC8vIEZpbmlzaCBhbiBBU1Qgbm9kZSwgYWRkaW5nIGB0eXBlYCBhbmQgYGVuZGAgcHJvcGVydGllcy5cblxuICBmdW5jdGlvbiBmaW5pc2hOb2RlQXQobm9kZSwgdHlwZSwgcG9zLCBsb2MpIHtcbiAgICBub2RlLnR5cGUgPSB0eXBlO1xuICAgIG5vZGUuZW5kID0gcG9zO1xuICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb25zKVxuICAgICAgeyBub2RlLmxvYy5lbmQgPSBsb2M7IH1cbiAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcylcbiAgICAgIHsgbm9kZS5yYW5nZVsxXSA9IHBvczsgfVxuICAgIHJldHVybiBub2RlXG4gIH1cblxuICBwcCQyLmZpbmlzaE5vZGUgPSBmdW5jdGlvbihub2RlLCB0eXBlKSB7XG4gICAgcmV0dXJuIGZpbmlzaE5vZGVBdC5jYWxsKHRoaXMsIG5vZGUsIHR5cGUsIHRoaXMubGFzdFRva0VuZCwgdGhpcy5sYXN0VG9rRW5kTG9jKVxuICB9O1xuXG4gIC8vIEZpbmlzaCBub2RlIGF0IGdpdmVuIHBvc2l0aW9uXG5cbiAgcHAkMi5maW5pc2hOb2RlQXQgPSBmdW5jdGlvbihub2RlLCB0eXBlLCBwb3MsIGxvYykge1xuICAgIHJldHVybiBmaW5pc2hOb2RlQXQuY2FsbCh0aGlzLCBub2RlLCB0eXBlLCBwb3MsIGxvYylcbiAgfTtcblxuICBwcCQyLmNvcHlOb2RlID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuZXdOb2RlID0gbmV3IE5vZGUodGhpcywgbm9kZS5zdGFydCwgdGhpcy5zdGFydExvYyk7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBub2RlKSB7IG5ld05vZGVbcHJvcF0gPSBub2RlW3Byb3BdOyB9XG4gICAgcmV0dXJuIG5ld05vZGVcbiAgfTtcblxuICAvLyBUaGlzIGZpbGUgY29udGFpbnMgVW5pY29kZSBwcm9wZXJ0aWVzIGV4dHJhY3RlZCBmcm9tIHRoZSBFQ01BU2NyaXB0IHNwZWNpZmljYXRpb24uXG4gIC8vIFRoZSBsaXN0cyBhcmUgZXh0cmFjdGVkIGxpa2Ugc286XG4gIC8vICQkKCcjdGFibGUtYmluYXJ5LXVuaWNvZGUtcHJvcGVydGllcyA+IGZpZ3VyZSA+IHRhYmxlID4gdGJvZHkgPiB0ciA+IHRkOm50aC1jaGlsZCgxKSBjb2RlJykubWFwKGVsID0+IGVsLmlubmVyVGV4dClcblxuICAvLyAjdGFibGUtYmluYXJ5LXVuaWNvZGUtcHJvcGVydGllc1xuICB2YXIgZWNtYTlCaW5hcnlQcm9wZXJ0aWVzID0gXCJBU0NJSSBBU0NJSV9IZXhfRGlnaXQgQUhleCBBbHBoYWJldGljIEFscGhhIEFueSBBc3NpZ25lZCBCaWRpX0NvbnRyb2wgQmlkaV9DIEJpZGlfTWlycm9yZWQgQmlkaV9NIENhc2VfSWdub3JhYmxlIENJIENhc2VkIENoYW5nZXNfV2hlbl9DYXNlZm9sZGVkIENXQ0YgQ2hhbmdlc19XaGVuX0Nhc2VtYXBwZWQgQ1dDTSBDaGFuZ2VzX1doZW5fTG93ZXJjYXNlZCBDV0wgQ2hhbmdlc19XaGVuX05GS0NfQ2FzZWZvbGRlZCBDV0tDRiBDaGFuZ2VzX1doZW5fVGl0bGVjYXNlZCBDV1QgQ2hhbmdlc19XaGVuX1VwcGVyY2FzZWQgQ1dVIERhc2ggRGVmYXVsdF9JZ25vcmFibGVfQ29kZV9Qb2ludCBESSBEZXByZWNhdGVkIERlcCBEaWFjcml0aWMgRGlhIEVtb2ppIEVtb2ppX0NvbXBvbmVudCBFbW9qaV9Nb2RpZmllciBFbW9qaV9Nb2RpZmllcl9CYXNlIEVtb2ppX1ByZXNlbnRhdGlvbiBFeHRlbmRlciBFeHQgR3JhcGhlbWVfQmFzZSBHcl9CYXNlIEdyYXBoZW1lX0V4dGVuZCBHcl9FeHQgSGV4X0RpZ2l0IEhleCBJRFNfQmluYXJ5X09wZXJhdG9yIElEU0IgSURTX1RyaW5hcnlfT3BlcmF0b3IgSURTVCBJRF9Db250aW51ZSBJREMgSURfU3RhcnQgSURTIElkZW9ncmFwaGljIElkZW8gSm9pbl9Db250cm9sIEpvaW5fQyBMb2dpY2FsX09yZGVyX0V4Y2VwdGlvbiBMT0UgTG93ZXJjYXNlIExvd2VyIE1hdGggTm9uY2hhcmFjdGVyX0NvZGVfUG9pbnQgTkNoYXIgUGF0dGVybl9TeW50YXggUGF0X1N5biBQYXR0ZXJuX1doaXRlX1NwYWNlIFBhdF9XUyBRdW90YXRpb25fTWFyayBRTWFyayBSYWRpY2FsIFJlZ2lvbmFsX0luZGljYXRvciBSSSBTZW50ZW5jZV9UZXJtaW5hbCBTVGVybSBTb2Z0X0RvdHRlZCBTRCBUZXJtaW5hbF9QdW5jdHVhdGlvbiBUZXJtIFVuaWZpZWRfSWRlb2dyYXBoIFVJZGVvIFVwcGVyY2FzZSBVcHBlciBWYXJpYXRpb25fU2VsZWN0b3IgVlMgV2hpdGVfU3BhY2Ugc3BhY2UgWElEX0NvbnRpbnVlIFhJREMgWElEX1N0YXJ0IFhJRFNcIjtcbiAgdmFyIGVjbWExMEJpbmFyeVByb3BlcnRpZXMgPSBlY21hOUJpbmFyeVByb3BlcnRpZXMgKyBcIiBFeHRlbmRlZF9QaWN0b2dyYXBoaWNcIjtcbiAgdmFyIGVjbWExMUJpbmFyeVByb3BlcnRpZXMgPSBlY21hMTBCaW5hcnlQcm9wZXJ0aWVzO1xuICB2YXIgZWNtYTEyQmluYXJ5UHJvcGVydGllcyA9IGVjbWExMUJpbmFyeVByb3BlcnRpZXMgKyBcIiBFQmFzZSBFQ29tcCBFTW9kIEVQcmVzIEV4dFBpY3RcIjtcbiAgdmFyIGVjbWExM0JpbmFyeVByb3BlcnRpZXMgPSBlY21hMTJCaW5hcnlQcm9wZXJ0aWVzO1xuICB2YXIgZWNtYTE0QmluYXJ5UHJvcGVydGllcyA9IGVjbWExM0JpbmFyeVByb3BlcnRpZXM7XG5cbiAgdmFyIHVuaWNvZGVCaW5hcnlQcm9wZXJ0aWVzID0ge1xuICAgIDk6IGVjbWE5QmluYXJ5UHJvcGVydGllcyxcbiAgICAxMDogZWNtYTEwQmluYXJ5UHJvcGVydGllcyxcbiAgICAxMTogZWNtYTExQmluYXJ5UHJvcGVydGllcyxcbiAgICAxMjogZWNtYTEyQmluYXJ5UHJvcGVydGllcyxcbiAgICAxMzogZWNtYTEzQmluYXJ5UHJvcGVydGllcyxcbiAgICAxNDogZWNtYTE0QmluYXJ5UHJvcGVydGllc1xuICB9O1xuXG4gIC8vICN0YWJsZS1iaW5hcnktdW5pY29kZS1wcm9wZXJ0aWVzLW9mLXN0cmluZ3NcbiAgdmFyIGVjbWExNEJpbmFyeVByb3BlcnRpZXNPZlN0cmluZ3MgPSBcIkJhc2ljX0Vtb2ppIEVtb2ppX0tleWNhcF9TZXF1ZW5jZSBSR0lfRW1vamlfTW9kaWZpZXJfU2VxdWVuY2UgUkdJX0Vtb2ppX0ZsYWdfU2VxdWVuY2UgUkdJX0Vtb2ppX1RhZ19TZXF1ZW5jZSBSR0lfRW1vamlfWldKX1NlcXVlbmNlIFJHSV9FbW9qaVwiO1xuXG4gIHZhciB1bmljb2RlQmluYXJ5UHJvcGVydGllc09mU3RyaW5ncyA9IHtcbiAgICA5OiBcIlwiLFxuICAgIDEwOiBcIlwiLFxuICAgIDExOiBcIlwiLFxuICAgIDEyOiBcIlwiLFxuICAgIDEzOiBcIlwiLFxuICAgIDE0OiBlY21hMTRCaW5hcnlQcm9wZXJ0aWVzT2ZTdHJpbmdzXG4gIH07XG5cbiAgLy8gI3RhYmxlLXVuaWNvZGUtZ2VuZXJhbC1jYXRlZ29yeS12YWx1ZXNcbiAgdmFyIHVuaWNvZGVHZW5lcmFsQ2F0ZWdvcnlWYWx1ZXMgPSBcIkNhc2VkX0xldHRlciBMQyBDbG9zZV9QdW5jdHVhdGlvbiBQZSBDb25uZWN0b3JfUHVuY3R1YXRpb24gUGMgQ29udHJvbCBDYyBjbnRybCBDdXJyZW5jeV9TeW1ib2wgU2MgRGFzaF9QdW5jdHVhdGlvbiBQZCBEZWNpbWFsX051bWJlciBOZCBkaWdpdCBFbmNsb3NpbmdfTWFyayBNZSBGaW5hbF9QdW5jdHVhdGlvbiBQZiBGb3JtYXQgQ2YgSW5pdGlhbF9QdW5jdHVhdGlvbiBQaSBMZXR0ZXIgTCBMZXR0ZXJfTnVtYmVyIE5sIExpbmVfU2VwYXJhdG9yIFpsIExvd2VyY2FzZV9MZXR0ZXIgTGwgTWFyayBNIENvbWJpbmluZ19NYXJrIE1hdGhfU3ltYm9sIFNtIE1vZGlmaWVyX0xldHRlciBMbSBNb2RpZmllcl9TeW1ib2wgU2sgTm9uc3BhY2luZ19NYXJrIE1uIE51bWJlciBOIE9wZW5fUHVuY3R1YXRpb24gUHMgT3RoZXIgQyBPdGhlcl9MZXR0ZXIgTG8gT3RoZXJfTnVtYmVyIE5vIE90aGVyX1B1bmN0dWF0aW9uIFBvIE90aGVyX1N5bWJvbCBTbyBQYXJhZ3JhcGhfU2VwYXJhdG9yIFpwIFByaXZhdGVfVXNlIENvIFB1bmN0dWF0aW9uIFAgcHVuY3QgU2VwYXJhdG9yIFogU3BhY2VfU2VwYXJhdG9yIFpzIFNwYWNpbmdfTWFyayBNYyBTdXJyb2dhdGUgQ3MgU3ltYm9sIFMgVGl0bGVjYXNlX0xldHRlciBMdCBVbmFzc2lnbmVkIENuIFVwcGVyY2FzZV9MZXR0ZXIgTHVcIjtcblxuICAvLyAjdGFibGUtdW5pY29kZS1zY3JpcHQtdmFsdWVzXG4gIHZhciBlY21hOVNjcmlwdFZhbHVlcyA9IFwiQWRsYW0gQWRsbSBBaG9tIEFuYXRvbGlhbl9IaWVyb2dseXBocyBIbHV3IEFyYWJpYyBBcmFiIEFybWVuaWFuIEFybW4gQXZlc3RhbiBBdnN0IEJhbGluZXNlIEJhbGkgQmFtdW0gQmFtdSBCYXNzYV9WYWggQmFzcyBCYXRhayBCYXRrIEJlbmdhbGkgQmVuZyBCaGFpa3N1a2kgQmhrcyBCb3BvbW9mbyBCb3BvIEJyYWhtaSBCcmFoIEJyYWlsbGUgQnJhaSBCdWdpbmVzZSBCdWdpIEJ1aGlkIEJ1aGQgQ2FuYWRpYW5fQWJvcmlnaW5hbCBDYW5zIENhcmlhbiBDYXJpIENhdWNhc2lhbl9BbGJhbmlhbiBBZ2hiIENoYWttYSBDYWttIENoYW0gQ2hhbSBDaGVyb2tlZSBDaGVyIENvbW1vbiBaeXl5IENvcHRpYyBDb3B0IFFhYWMgQ3VuZWlmb3JtIFhzdXggQ3lwcmlvdCBDcHJ0IEN5cmlsbGljIEN5cmwgRGVzZXJldCBEc3J0IERldmFuYWdhcmkgRGV2YSBEdXBsb3lhbiBEdXBsIEVneXB0aWFuX0hpZXJvZ2x5cGhzIEVneXAgRWxiYXNhbiBFbGJhIEV0aGlvcGljIEV0aGkgR2VvcmdpYW4gR2VvciBHbGFnb2xpdGljIEdsYWcgR290aGljIEdvdGggR3JhbnRoYSBHcmFuIEdyZWVrIEdyZWsgR3VqYXJhdGkgR3VqciBHdXJtdWtoaSBHdXJ1IEhhbiBIYW5pIEhhbmd1bCBIYW5nIEhhbnVub28gSGFubyBIYXRyYW4gSGF0ciBIZWJyZXcgSGViciBIaXJhZ2FuYSBIaXJhIEltcGVyaWFsX0FyYW1haWMgQXJtaSBJbmhlcml0ZWQgWmluaCBRYWFpIEluc2NyaXB0aW9uYWxfUGFobGF2aSBQaGxpIEluc2NyaXB0aW9uYWxfUGFydGhpYW4gUHJ0aSBKYXZhbmVzZSBKYXZhIEthaXRoaSBLdGhpIEthbm5hZGEgS25kYSBLYXRha2FuYSBLYW5hIEtheWFoX0xpIEthbGkgS2hhcm9zaHRoaSBLaGFyIEtobWVyIEtobXIgS2hvamtpIEtob2ogS2h1ZGF3YWRpIFNpbmQgTGFvIExhb28gTGF0aW4gTGF0biBMZXBjaGEgTGVwYyBMaW1idSBMaW1iIExpbmVhcl9BIExpbmEgTGluZWFyX0IgTGluYiBMaXN1IExpc3UgTHljaWFuIEx5Y2kgTHlkaWFuIEx5ZGkgTWFoYWphbmkgTWFoaiBNYWxheWFsYW0gTWx5bSBNYW5kYWljIE1hbmQgTWFuaWNoYWVhbiBNYW5pIE1hcmNoZW4gTWFyYyBNYXNhcmFtX0dvbmRpIEdvbm0gTWVldGVpX01heWVrIE10ZWkgTWVuZGVfS2lrYWt1aSBNZW5kIE1lcm9pdGljX0N1cnNpdmUgTWVyYyBNZXJvaXRpY19IaWVyb2dseXBocyBNZXJvIE1pYW8gUGxyZCBNb2RpIE1vbmdvbGlhbiBNb25nIE1ybyBNcm9vIE11bHRhbmkgTXVsdCBNeWFubWFyIE15bXIgTmFiYXRhZWFuIE5iYXQgTmV3X1RhaV9MdWUgVGFsdSBOZXdhIE5ld2EgTmtvIE5rb28gTnVzaHUgTnNodSBPZ2hhbSBPZ2FtIE9sX0NoaWtpIE9sY2sgT2xkX0h1bmdhcmlhbiBIdW5nIE9sZF9JdGFsaWMgSXRhbCBPbGRfTm9ydGhfQXJhYmlhbiBOYXJiIE9sZF9QZXJtaWMgUGVybSBPbGRfUGVyc2lhbiBYcGVvIE9sZF9Tb3V0aF9BcmFiaWFuIFNhcmIgT2xkX1R1cmtpYyBPcmtoIE9yaXlhIE9yeWEgT3NhZ2UgT3NnZSBPc21hbnlhIE9zbWEgUGFoYXdoX0htb25nIEhtbmcgUGFsbXlyZW5lIFBhbG0gUGF1X0Npbl9IYXUgUGF1YyBQaGFnc19QYSBQaGFnIFBob2VuaWNpYW4gUGhueCBQc2FsdGVyX1BhaGxhdmkgUGhscCBSZWphbmcgUmpuZyBSdW5pYyBSdW5yIFNhbWFyaXRhbiBTYW1yIFNhdXJhc2h0cmEgU2F1ciBTaGFyYWRhIFNocmQgU2hhdmlhbiBTaGF3IFNpZGRoYW0gU2lkZCBTaWduV3JpdGluZyBTZ253IFNpbmhhbGEgU2luaCBTb3JhX1NvbXBlbmcgU29yYSBTb3lvbWJvIFNveW8gU3VuZGFuZXNlIFN1bmQgU3lsb3RpX05hZ3JpIFN5bG8gU3lyaWFjIFN5cmMgVGFnYWxvZyBUZ2xnIFRhZ2JhbndhIFRhZ2IgVGFpX0xlIFRhbGUgVGFpX1RoYW0gTGFuYSBUYWlfVmlldCBUYXZ0IFRha3JpIFRha3IgVGFtaWwgVGFtbCBUYW5ndXQgVGFuZyBUZWx1Z3UgVGVsdSBUaGFhbmEgVGhhYSBUaGFpIFRoYWkgVGliZXRhbiBUaWJ0IFRpZmluYWdoIFRmbmcgVGlyaHV0YSBUaXJoIFVnYXJpdGljIFVnYXIgVmFpIFZhaWkgV2FyYW5nX0NpdGkgV2FyYSBZaSBZaWlpIFphbmFiYXphcl9TcXVhcmUgWmFuYlwiO1xuICB2YXIgZWNtYTEwU2NyaXB0VmFsdWVzID0gZWNtYTlTY3JpcHRWYWx1ZXMgKyBcIiBEb2dyYSBEb2dyIEd1bmphbGFfR29uZGkgR29uZyBIYW5pZmlfUm9oaW5neWEgUm9oZyBNYWthc2FyIE1ha2EgTWVkZWZhaWRyaW4gTWVkZiBPbGRfU29nZGlhbiBTb2dvIFNvZ2RpYW4gU29nZFwiO1xuICB2YXIgZWNtYTExU2NyaXB0VmFsdWVzID0gZWNtYTEwU2NyaXB0VmFsdWVzICsgXCIgRWx5bWFpYyBFbHltIE5hbmRpbmFnYXJpIE5hbmQgTnlpYWtlbmdfUHVhY2h1ZV9IbW9uZyBIbW5wIFdhbmNobyBXY2hvXCI7XG4gIHZhciBlY21hMTJTY3JpcHRWYWx1ZXMgPSBlY21hMTFTY3JpcHRWYWx1ZXMgKyBcIiBDaG9yYXNtaWFuIENocnMgRGlhayBEaXZlc19Ba3VydSBLaGl0YW5fU21hbGxfU2NyaXB0IEtpdHMgWWV6aSBZZXppZGlcIjtcbiAgdmFyIGVjbWExM1NjcmlwdFZhbHVlcyA9IGVjbWExMlNjcmlwdFZhbHVlcyArIFwiIEN5cHJvX01pbm9hbiBDcG1uIE9sZF9VeWdodXIgT3VnciBUYW5nc2EgVG5zYSBUb3RvIFZpdGhrdXFpIFZpdGhcIjtcbiAgdmFyIGVjbWExNFNjcmlwdFZhbHVlcyA9IGVjbWExM1NjcmlwdFZhbHVlcyArIFwiIEhya3QgS2F0YWthbmFfT3JfSGlyYWdhbmEgS2F3aSBOYWdfTXVuZGFyaSBOYWdtIFVua25vd24gWnp6elwiO1xuXG4gIHZhciB1bmljb2RlU2NyaXB0VmFsdWVzID0ge1xuICAgIDk6IGVjbWE5U2NyaXB0VmFsdWVzLFxuICAgIDEwOiBlY21hMTBTY3JpcHRWYWx1ZXMsXG4gICAgMTE6IGVjbWExMVNjcmlwdFZhbHVlcyxcbiAgICAxMjogZWNtYTEyU2NyaXB0VmFsdWVzLFxuICAgIDEzOiBlY21hMTNTY3JpcHRWYWx1ZXMsXG4gICAgMTQ6IGVjbWExNFNjcmlwdFZhbHVlc1xuICB9O1xuXG4gIHZhciBkYXRhID0ge307XG4gIGZ1bmN0aW9uIGJ1aWxkVW5pY29kZURhdGEoZWNtYVZlcnNpb24pIHtcbiAgICB2YXIgZCA9IGRhdGFbZWNtYVZlcnNpb25dID0ge1xuICAgICAgYmluYXJ5OiB3b3Jkc1JlZ2V4cCh1bmljb2RlQmluYXJ5UHJvcGVydGllc1tlY21hVmVyc2lvbl0gKyBcIiBcIiArIHVuaWNvZGVHZW5lcmFsQ2F0ZWdvcnlWYWx1ZXMpLFxuICAgICAgYmluYXJ5T2ZTdHJpbmdzOiB3b3Jkc1JlZ2V4cCh1bmljb2RlQmluYXJ5UHJvcGVydGllc09mU3RyaW5nc1tlY21hVmVyc2lvbl0pLFxuICAgICAgbm9uQmluYXJ5OiB7XG4gICAgICAgIEdlbmVyYWxfQ2F0ZWdvcnk6IHdvcmRzUmVnZXhwKHVuaWNvZGVHZW5lcmFsQ2F0ZWdvcnlWYWx1ZXMpLFxuICAgICAgICBTY3JpcHQ6IHdvcmRzUmVnZXhwKHVuaWNvZGVTY3JpcHRWYWx1ZXNbZWNtYVZlcnNpb25dKVxuICAgICAgfVxuICAgIH07XG4gICAgZC5ub25CaW5hcnkuU2NyaXB0X0V4dGVuc2lvbnMgPSBkLm5vbkJpbmFyeS5TY3JpcHQ7XG5cbiAgICBkLm5vbkJpbmFyeS5nYyA9IGQubm9uQmluYXJ5LkdlbmVyYWxfQ2F0ZWdvcnk7XG4gICAgZC5ub25CaW5hcnkuc2MgPSBkLm5vbkJpbmFyeS5TY3JpcHQ7XG4gICAgZC5ub25CaW5hcnkuc2N4ID0gZC5ub25CaW5hcnkuU2NyaXB0X0V4dGVuc2lvbnM7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMCwgbGlzdCA9IFs5LCAxMCwgMTEsIDEyLCAxMywgMTRdOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gMSkge1xuICAgIHZhciBlY21hVmVyc2lvbiA9IGxpc3RbaV07XG5cbiAgICBidWlsZFVuaWNvZGVEYXRhKGVjbWFWZXJzaW9uKTtcbiAgfVxuXG4gIHZhciBwcCQxID0gUGFyc2VyLnByb3RvdHlwZTtcblxuICB2YXIgUmVnRXhwVmFsaWRhdGlvblN0YXRlID0gZnVuY3Rpb24gUmVnRXhwVmFsaWRhdGlvblN0YXRlKHBhcnNlcikge1xuICAgIHRoaXMucGFyc2VyID0gcGFyc2VyO1xuICAgIHRoaXMudmFsaWRGbGFncyA9IFwiZ2ltXCIgKyAocGFyc2VyLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNiA/IFwidXlcIiA6IFwiXCIpICsgKHBhcnNlci5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkgPyBcInNcIiA6IFwiXCIpICsgKHBhcnNlci5vcHRpb25zLmVjbWFWZXJzaW9uID49IDEzID8gXCJkXCIgOiBcIlwiKSArIChwYXJzZXIub3B0aW9ucy5lY21hVmVyc2lvbiA+PSAxNSA/IFwidlwiIDogXCJcIik7XG4gICAgdGhpcy51bmljb2RlUHJvcGVydGllcyA9IGRhdGFbcGFyc2VyLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTQgPyAxNCA6IHBhcnNlci5vcHRpb25zLmVjbWFWZXJzaW9uXTtcbiAgICB0aGlzLnNvdXJjZSA9IFwiXCI7XG4gICAgdGhpcy5mbGFncyA9IFwiXCI7XG4gICAgdGhpcy5zdGFydCA9IDA7XG4gICAgdGhpcy5zd2l0Y2hVID0gZmFsc2U7XG4gICAgdGhpcy5zd2l0Y2hWID0gZmFsc2U7XG4gICAgdGhpcy5zd2l0Y2hOID0gZmFsc2U7XG4gICAgdGhpcy5wb3MgPSAwO1xuICAgIHRoaXMubGFzdEludFZhbHVlID0gMDtcbiAgICB0aGlzLmxhc3RTdHJpbmdWYWx1ZSA9IFwiXCI7XG4gICAgdGhpcy5sYXN0QXNzZXJ0aW9uSXNRdWFudGlmaWFibGUgPSBmYWxzZTtcbiAgICB0aGlzLm51bUNhcHR1cmluZ1BhcmVucyA9IDA7XG4gICAgdGhpcy5tYXhCYWNrUmVmZXJlbmNlID0gMDtcbiAgICB0aGlzLmdyb3VwTmFtZXMgPSBbXTtcbiAgICB0aGlzLmJhY2tSZWZlcmVuY2VOYW1lcyA9IFtdO1xuICB9O1xuXG4gIFJlZ0V4cFZhbGlkYXRpb25TdGF0ZS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiByZXNldCAoc3RhcnQsIHBhdHRlcm4sIGZsYWdzKSB7XG4gICAgdmFyIHVuaWNvZGVTZXRzID0gZmxhZ3MuaW5kZXhPZihcInZcIikgIT09IC0xO1xuICAgIHZhciB1bmljb2RlID0gZmxhZ3MuaW5kZXhPZihcInVcIikgIT09IC0xO1xuICAgIHRoaXMuc3RhcnQgPSBzdGFydCB8IDA7XG4gICAgdGhpcy5zb3VyY2UgPSBwYXR0ZXJuICsgXCJcIjtcbiAgICB0aGlzLmZsYWdzID0gZmxhZ3M7XG4gICAgaWYgKHVuaWNvZGVTZXRzICYmIHRoaXMucGFyc2VyLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTUpIHtcbiAgICAgIHRoaXMuc3dpdGNoVSA9IHRydWU7XG4gICAgICB0aGlzLnN3aXRjaFYgPSB0cnVlO1xuICAgICAgdGhpcy5zd2l0Y2hOID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zd2l0Y2hVID0gdW5pY29kZSAmJiB0aGlzLnBhcnNlci5vcHRpb25zLmVjbWFWZXJzaW9uID49IDY7XG4gICAgICB0aGlzLnN3aXRjaFYgPSBmYWxzZTtcbiAgICAgIHRoaXMuc3dpdGNoTiA9IHVuaWNvZGUgJiYgdGhpcy5wYXJzZXIub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5O1xuICAgIH1cbiAgfTtcblxuICBSZWdFeHBWYWxpZGF0aW9uU3RhdGUucHJvdG90eXBlLnJhaXNlID0gZnVuY3Rpb24gcmFpc2UgKG1lc3NhZ2UpIHtcbiAgICB0aGlzLnBhcnNlci5yYWlzZVJlY292ZXJhYmxlKHRoaXMuc3RhcnQsIChcIkludmFsaWQgcmVndWxhciBleHByZXNzaW9uOiAvXCIgKyAodGhpcy5zb3VyY2UpICsgXCIvOiBcIiArIG1lc3NhZ2UpKTtcbiAgfTtcblxuICAvLyBJZiB1IGZsYWcgaXMgZ2l2ZW4sIHRoaXMgcmV0dXJucyB0aGUgY29kZSBwb2ludCBhdCB0aGUgaW5kZXggKGl0IGNvbWJpbmVzIGEgc3Vycm9nYXRlIHBhaXIpLlxuICAvLyBPdGhlcndpc2UsIHRoaXMgcmV0dXJucyB0aGUgY29kZSB1bml0IG9mIHRoZSBpbmRleCAoY2FuIGJlIGEgcGFydCBvZiBhIHN1cnJvZ2F0ZSBwYWlyKS5cbiAgUmVnRXhwVmFsaWRhdGlvblN0YXRlLnByb3RvdHlwZS5hdCA9IGZ1bmN0aW9uIGF0IChpLCBmb3JjZVUpIHtcbiAgICAgIGlmICggZm9yY2VVID09PSB2b2lkIDAgKSBmb3JjZVUgPSBmYWxzZTtcblxuICAgIHZhciBzID0gdGhpcy5zb3VyY2U7XG4gICAgdmFyIGwgPSBzLmxlbmd0aDtcbiAgICBpZiAoaSA+PSBsKSB7XG4gICAgICByZXR1cm4gLTFcbiAgICB9XG4gICAgdmFyIGMgPSBzLmNoYXJDb2RlQXQoaSk7XG4gICAgaWYgKCEoZm9yY2VVIHx8IHRoaXMuc3dpdGNoVSkgfHwgYyA8PSAweEQ3RkYgfHwgYyA+PSAweEUwMDAgfHwgaSArIDEgPj0gbCkge1xuICAgICAgcmV0dXJuIGNcbiAgICB9XG4gICAgdmFyIG5leHQgPSBzLmNoYXJDb2RlQXQoaSArIDEpO1xuICAgIHJldHVybiBuZXh0ID49IDB4REMwMCAmJiBuZXh0IDw9IDB4REZGRiA/IChjIDw8IDEwKSArIG5leHQgLSAweDM1RkRDMDAgOiBjXG4gIH07XG5cbiAgUmVnRXhwVmFsaWRhdGlvblN0YXRlLnByb3RvdHlwZS5uZXh0SW5kZXggPSBmdW5jdGlvbiBuZXh0SW5kZXggKGksIGZvcmNlVSkge1xuICAgICAgaWYgKCBmb3JjZVUgPT09IHZvaWQgMCApIGZvcmNlVSA9IGZhbHNlO1xuXG4gICAgdmFyIHMgPSB0aGlzLnNvdXJjZTtcbiAgICB2YXIgbCA9IHMubGVuZ3RoO1xuICAgIGlmIChpID49IGwpIHtcbiAgICAgIHJldHVybiBsXG4gICAgfVxuICAgIHZhciBjID0gcy5jaGFyQ29kZUF0KGkpLCBuZXh0O1xuICAgIGlmICghKGZvcmNlVSB8fCB0aGlzLnN3aXRjaFUpIHx8IGMgPD0gMHhEN0ZGIHx8IGMgPj0gMHhFMDAwIHx8IGkgKyAxID49IGwgfHxcbiAgICAgICAgKG5leHQgPSBzLmNoYXJDb2RlQXQoaSArIDEpKSA8IDB4REMwMCB8fCBuZXh0ID4gMHhERkZGKSB7XG4gICAgICByZXR1cm4gaSArIDFcbiAgICB9XG4gICAgcmV0dXJuIGkgKyAyXG4gIH07XG5cbiAgUmVnRXhwVmFsaWRhdGlvblN0YXRlLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24gY3VycmVudCAoZm9yY2VVKSB7XG4gICAgICBpZiAoIGZvcmNlVSA9PT0gdm9pZCAwICkgZm9yY2VVID0gZmFsc2U7XG5cbiAgICByZXR1cm4gdGhpcy5hdCh0aGlzLnBvcywgZm9yY2VVKVxuICB9O1xuXG4gIFJlZ0V4cFZhbGlkYXRpb25TdGF0ZS5wcm90b3R5cGUubG9va2FoZWFkID0gZnVuY3Rpb24gbG9va2FoZWFkIChmb3JjZVUpIHtcbiAgICAgIGlmICggZm9yY2VVID09PSB2b2lkIDAgKSBmb3JjZVUgPSBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzLmF0KHRoaXMubmV4dEluZGV4KHRoaXMucG9zLCBmb3JjZVUpLCBmb3JjZVUpXG4gIH07XG5cbiAgUmVnRXhwVmFsaWRhdGlvblN0YXRlLnByb3RvdHlwZS5hZHZhbmNlID0gZnVuY3Rpb24gYWR2YW5jZSAoZm9yY2VVKSB7XG4gICAgICBpZiAoIGZvcmNlVSA9PT0gdm9pZCAwICkgZm9yY2VVID0gZmFsc2U7XG5cbiAgICB0aGlzLnBvcyA9IHRoaXMubmV4dEluZGV4KHRoaXMucG9zLCBmb3JjZVUpO1xuICB9O1xuXG4gIFJlZ0V4cFZhbGlkYXRpb25TdGF0ZS5wcm90b3R5cGUuZWF0ID0gZnVuY3Rpb24gZWF0IChjaCwgZm9yY2VVKSB7XG4gICAgICBpZiAoIGZvcmNlVSA9PT0gdm9pZCAwICkgZm9yY2VVID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5jdXJyZW50KGZvcmNlVSkgPT09IGNoKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoZm9yY2VVKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIFJlZ0V4cFZhbGlkYXRpb25TdGF0ZS5wcm90b3R5cGUuZWF0Q2hhcnMgPSBmdW5jdGlvbiBlYXRDaGFycyAoY2hzLCBmb3JjZVUpIHtcbiAgICAgIGlmICggZm9yY2VVID09PSB2b2lkIDAgKSBmb3JjZVUgPSBmYWxzZTtcblxuICAgIHZhciBwb3MgPSB0aGlzLnBvcztcbiAgICBmb3IgKHZhciBpID0gMCwgbGlzdCA9IGNoczsgaSA8IGxpc3QubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgIHZhciBjaCA9IGxpc3RbaV07XG5cbiAgICAgICAgdmFyIGN1cnJlbnQgPSB0aGlzLmF0KHBvcywgZm9yY2VVKTtcbiAgICAgIGlmIChjdXJyZW50ID09PSAtMSB8fCBjdXJyZW50ICE9PSBjaCkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICAgIHBvcyA9IHRoaXMubmV4dEluZGV4KHBvcywgZm9yY2VVKTtcbiAgICB9XG4gICAgdGhpcy5wb3MgPSBwb3M7XG4gICAgcmV0dXJuIHRydWVcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgdGhlIGZsYWdzIHBhcnQgb2YgYSBnaXZlbiBSZWdFeHBMaXRlcmFsLlxuICAgKlxuICAgKiBAcGFyYW0ge1JlZ0V4cFZhbGlkYXRpb25TdGF0ZX0gc3RhdGUgVGhlIHN0YXRlIHRvIHZhbGlkYXRlIFJlZ0V4cC5cbiAgICogQHJldHVybnMge3ZvaWR9XG4gICAqL1xuICBwcCQxLnZhbGlkYXRlUmVnRXhwRmxhZ3MgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciB2YWxpZEZsYWdzID0gc3RhdGUudmFsaWRGbGFncztcbiAgICB2YXIgZmxhZ3MgPSBzdGF0ZS5mbGFncztcblxuICAgIHZhciB1ID0gZmFsc2U7XG4gICAgdmFyIHYgPSBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmxhZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBmbGFnID0gZmxhZ3MuY2hhckF0KGkpO1xuICAgICAgaWYgKHZhbGlkRmxhZ3MuaW5kZXhPZihmbGFnKSA9PT0gLTEpIHtcbiAgICAgICAgdGhpcy5yYWlzZShzdGF0ZS5zdGFydCwgXCJJbnZhbGlkIHJlZ3VsYXIgZXhwcmVzc2lvbiBmbGFnXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGZsYWdzLmluZGV4T2YoZmxhZywgaSArIDEpID4gLTEpIHtcbiAgICAgICAgdGhpcy5yYWlzZShzdGF0ZS5zdGFydCwgXCJEdXBsaWNhdGUgcmVndWxhciBleHByZXNzaW9uIGZsYWdcIik7XG4gICAgICB9XG4gICAgICBpZiAoZmxhZyA9PT0gXCJ1XCIpIHsgdSA9IHRydWU7IH1cbiAgICAgIGlmIChmbGFnID09PSBcInZcIikgeyB2ID0gdHJ1ZTsgfVxuICAgIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDE1ICYmIHUgJiYgdikge1xuICAgICAgdGhpcy5yYWlzZShzdGF0ZS5zdGFydCwgXCJJbnZhbGlkIHJlZ3VsYXIgZXhwcmVzc2lvbiBmbGFnXCIpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgdGhlIHBhdHRlcm4gcGFydCBvZiBhIGdpdmVuIFJlZ0V4cExpdGVyYWwuXG4gICAqXG4gICAqIEBwYXJhbSB7UmVnRXhwVmFsaWRhdGlvblN0YXRlfSBzdGF0ZSBUaGUgc3RhdGUgdG8gdmFsaWRhdGUgUmVnRXhwLlxuICAgKiBAcmV0dXJucyB7dm9pZH1cbiAgICovXG4gIHBwJDEudmFsaWRhdGVSZWdFeHBQYXR0ZXJuID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB0aGlzLnJlZ2V4cF9wYXR0ZXJuKHN0YXRlKTtcblxuICAgIC8vIFRoZSBnb2FsIHN5bWJvbCBmb3IgdGhlIHBhcnNlIGlzIHxQYXR0ZXJuW35VLCB+Tl18LiBJZiB0aGUgcmVzdWx0IG9mXG4gICAgLy8gcGFyc2luZyBjb250YWlucyBhIHxHcm91cE5hbWV8LCByZXBhcnNlIHdpdGggdGhlIGdvYWwgc3ltYm9sXG4gICAgLy8gfFBhdHRlcm5bflUsICtOXXwgYW5kIHVzZSB0aGlzIHJlc3VsdCBpbnN0ZWFkLiBUaHJvdyBhICpTeW50YXhFcnJvcipcbiAgICAvLyBleGNlcHRpb24gaWYgX1BfIGRpZCBub3QgY29uZm9ybSB0byB0aGUgZ3JhbW1hciwgaWYgYW55IGVsZW1lbnRzIG9mIF9QX1xuICAgIC8vIHdlcmUgbm90IG1hdGNoZWQgYnkgdGhlIHBhcnNlLCBvciBpZiBhbnkgRWFybHkgRXJyb3IgY29uZGl0aW9ucyBleGlzdC5cbiAgICBpZiAoIXN0YXRlLnN3aXRjaE4gJiYgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkgJiYgc3RhdGUuZ3JvdXBOYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZS5zd2l0Y2hOID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVnZXhwX3BhdHRlcm4oc3RhdGUpO1xuICAgIH1cbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1QYXR0ZXJuXG4gIHBwJDEucmVnZXhwX3BhdHRlcm4gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHN0YXRlLnBvcyA9IDA7XG4gICAgc3RhdGUubGFzdEludFZhbHVlID0gMDtcbiAgICBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgPSBcIlwiO1xuICAgIHN0YXRlLmxhc3RBc3NlcnRpb25Jc1F1YW50aWZpYWJsZSA9IGZhbHNlO1xuICAgIHN0YXRlLm51bUNhcHR1cmluZ1BhcmVucyA9IDA7XG4gICAgc3RhdGUubWF4QmFja1JlZmVyZW5jZSA9IDA7XG4gICAgc3RhdGUuZ3JvdXBOYW1lcy5sZW5ndGggPSAwO1xuICAgIHN0YXRlLmJhY2tSZWZlcmVuY2VOYW1lcy5sZW5ndGggPSAwO1xuXG4gICAgdGhpcy5yZWdleHBfZGlzanVuY3Rpb24oc3RhdGUpO1xuXG4gICAgaWYgKHN0YXRlLnBvcyAhPT0gc3RhdGUuc291cmNlLmxlbmd0aCkge1xuICAgICAgLy8gTWFrZSB0aGUgc2FtZSBtZXNzYWdlcyBhcyBWOC5cbiAgICAgIGlmIChzdGF0ZS5lYXQoMHgyOSAvKiApICovKSkge1xuICAgICAgICBzdGF0ZS5yYWlzZShcIlVubWF0Y2hlZCAnKSdcIik7XG4gICAgICB9XG4gICAgICBpZiAoc3RhdGUuZWF0KDB4NUQgLyogXSAqLykgfHwgc3RhdGUuZWF0KDB4N0QgLyogfSAqLykpIHtcbiAgICAgICAgc3RhdGUucmFpc2UoXCJMb25lIHF1YW50aWZpZXIgYnJhY2tldHNcIik7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChzdGF0ZS5tYXhCYWNrUmVmZXJlbmNlID4gc3RhdGUubnVtQ2FwdHVyaW5nUGFyZW5zKSB7XG4gICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgZXNjYXBlXCIpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMCwgbGlzdCA9IHN0YXRlLmJhY2tSZWZlcmVuY2VOYW1lczsgaSA8IGxpc3QubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgIHZhciBuYW1lID0gbGlzdFtpXTtcblxuICAgICAgaWYgKHN0YXRlLmdyb3VwTmFtZXMuaW5kZXhPZihuYW1lKSA9PT0gLTEpIHtcbiAgICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIG5hbWVkIGNhcHR1cmUgcmVmZXJlbmNlZFwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtRGlzanVuY3Rpb25cbiAgcHAkMS5yZWdleHBfZGlzanVuY3Rpb24gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHRoaXMucmVnZXhwX2FsdGVybmF0aXZlKHN0YXRlKTtcbiAgICB3aGlsZSAoc3RhdGUuZWF0KDB4N0MgLyogfCAqLykpIHtcbiAgICAgIHRoaXMucmVnZXhwX2FsdGVybmF0aXZlKHN0YXRlKTtcbiAgICB9XG5cbiAgICAvLyBNYWtlIHRoZSBzYW1lIG1lc3NhZ2UgYXMgVjguXG4gICAgaWYgKHRoaXMucmVnZXhwX2VhdFF1YW50aWZpZXIoc3RhdGUsIHRydWUpKSB7XG4gICAgICBzdGF0ZS5yYWlzZShcIk5vdGhpbmcgdG8gcmVwZWF0XCIpO1xuICAgIH1cbiAgICBpZiAoc3RhdGUuZWF0KDB4N0IgLyogeyAqLykpIHtcbiAgICAgIHN0YXRlLnJhaXNlKFwiTG9uZSBxdWFudGlmaWVyIGJyYWNrZXRzXCIpO1xuICAgIH1cbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1BbHRlcm5hdGl2ZVxuICBwcCQxLnJlZ2V4cF9hbHRlcm5hdGl2ZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgd2hpbGUgKHN0YXRlLnBvcyA8IHN0YXRlLnNvdXJjZS5sZW5ndGggJiYgdGhpcy5yZWdleHBfZWF0VGVybShzdGF0ZSkpXG4gICAgICB7IH1cbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1hbm5leEItVGVybVxuICBwcCQxLnJlZ2V4cF9lYXRUZXJtID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAodGhpcy5yZWdleHBfZWF0QXNzZXJ0aW9uKHN0YXRlKSkge1xuICAgICAgLy8gSGFuZGxlIGBRdWFudGlmaWFibGVBc3NlcnRpb24gUXVhbnRpZmllcmAgYWx0ZXJuYXRpdmUuXG4gICAgICAvLyBgc3RhdGUubGFzdEFzc2VydGlvbklzUXVhbnRpZmlhYmxlYCBpcyB0cnVlIGlmIHRoZSBsYXN0IGVhdGVuIEFzc2VydGlvblxuICAgICAgLy8gaXMgYSBRdWFudGlmaWFibGVBc3NlcnRpb24uXG4gICAgICBpZiAoc3RhdGUubGFzdEFzc2VydGlvbklzUXVhbnRpZmlhYmxlICYmIHRoaXMucmVnZXhwX2VhdFF1YW50aWZpZXIoc3RhdGUpKSB7XG4gICAgICAgIC8vIE1ha2UgdGhlIHNhbWUgbWVzc2FnZSBhcyBWOC5cbiAgICAgICAgaWYgKHN0YXRlLnN3aXRjaFUpIHtcbiAgICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgcXVhbnRpZmllclwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICBpZiAoc3RhdGUuc3dpdGNoVSA/IHRoaXMucmVnZXhwX2VhdEF0b20oc3RhdGUpIDogdGhpcy5yZWdleHBfZWF0RXh0ZW5kZWRBdG9tKHN0YXRlKSkge1xuICAgICAgdGhpcy5yZWdleHBfZWF0UXVhbnRpZmllcihzdGF0ZSk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLWFubmV4Qi1Bc3NlcnRpb25cbiAgcHAkMS5yZWdleHBfZWF0QXNzZXJ0aW9uID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgc3RhdGUubGFzdEFzc2VydGlvbklzUXVhbnRpZmlhYmxlID0gZmFsc2U7XG5cbiAgICAvLyBeLCAkXG4gICAgaWYgKHN0YXRlLmVhdCgweDVFIC8qIF4gKi8pIHx8IHN0YXRlLmVhdCgweDI0IC8qICQgKi8pKSB7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8vIFxcYiBcXEJcbiAgICBpZiAoc3RhdGUuZWF0KDB4NUMgLyogXFwgKi8pKSB7XG4gICAgICBpZiAoc3RhdGUuZWF0KDB4NDIgLyogQiAqLykgfHwgc3RhdGUuZWF0KDB4NjIgLyogYiAqLykpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cblxuICAgIC8vIExvb2thaGVhZCAvIExvb2tiZWhpbmRcbiAgICBpZiAoc3RhdGUuZWF0KDB4MjggLyogKCAqLykgJiYgc3RhdGUuZWF0KDB4M0YgLyogPyAqLykpIHtcbiAgICAgIHZhciBsb29rYmVoaW5kID0gZmFsc2U7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkpIHtcbiAgICAgICAgbG9va2JlaGluZCA9IHN0YXRlLmVhdCgweDNDIC8qIDwgKi8pO1xuICAgICAgfVxuICAgICAgaWYgKHN0YXRlLmVhdCgweDNEIC8qID0gKi8pIHx8IHN0YXRlLmVhdCgweDIxIC8qICEgKi8pKSB7XG4gICAgICAgIHRoaXMucmVnZXhwX2Rpc2p1bmN0aW9uKHN0YXRlKTtcbiAgICAgICAgaWYgKCFzdGF0ZS5lYXQoMHgyOSAvKiApICovKSkge1xuICAgICAgICAgIHN0YXRlLnJhaXNlKFwiVW50ZXJtaW5hdGVkIGdyb3VwXCIpO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmxhc3RBc3NlcnRpb25Jc1F1YW50aWZpYWJsZSA9ICFsb29rYmVoaW5kO1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLVF1YW50aWZpZXJcbiAgcHAkMS5yZWdleHBfZWF0UXVhbnRpZmllciA9IGZ1bmN0aW9uKHN0YXRlLCBub0Vycm9yKSB7XG4gICAgaWYgKCBub0Vycm9yID09PSB2b2lkIDAgKSBub0Vycm9yID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5yZWdleHBfZWF0UXVhbnRpZmllclByZWZpeChzdGF0ZSwgbm9FcnJvcikpIHtcbiAgICAgIHN0YXRlLmVhdCgweDNGIC8qID8gKi8pO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtUXVhbnRpZmllclByZWZpeFxuICBwcCQxLnJlZ2V4cF9lYXRRdWFudGlmaWVyUHJlZml4ID0gZnVuY3Rpb24oc3RhdGUsIG5vRXJyb3IpIHtcbiAgICByZXR1cm4gKFxuICAgICAgc3RhdGUuZWF0KDB4MkEgLyogKiAqLykgfHxcbiAgICAgIHN0YXRlLmVhdCgweDJCIC8qICsgKi8pIHx8XG4gICAgICBzdGF0ZS5lYXQoMHgzRiAvKiA/ICovKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0QnJhY2VkUXVhbnRpZmllcihzdGF0ZSwgbm9FcnJvcilcbiAgICApXG4gIH07XG4gIHBwJDEucmVnZXhwX2VhdEJyYWNlZFF1YW50aWZpZXIgPSBmdW5jdGlvbihzdGF0ZSwgbm9FcnJvcikge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICBpZiAoc3RhdGUuZWF0KDB4N0IgLyogeyAqLykpIHtcbiAgICAgIHZhciBtaW4gPSAwLCBtYXggPSAtMTtcbiAgICAgIGlmICh0aGlzLnJlZ2V4cF9lYXREZWNpbWFsRGlnaXRzKHN0YXRlKSkge1xuICAgICAgICBtaW4gPSBzdGF0ZS5sYXN0SW50VmFsdWU7XG4gICAgICAgIGlmIChzdGF0ZS5lYXQoMHgyQyAvKiAsICovKSAmJiB0aGlzLnJlZ2V4cF9lYXREZWNpbWFsRGlnaXRzKHN0YXRlKSkge1xuICAgICAgICAgIG1heCA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUuZWF0KDB4N0QgLyogfSAqLykpIHtcbiAgICAgICAgICAvLyBTeW50YXhFcnJvciBpbiBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jc2VjLXRlcm1cbiAgICAgICAgICBpZiAobWF4ICE9PSAtMSAmJiBtYXggPCBtaW4gJiYgIW5vRXJyb3IpIHtcbiAgICAgICAgICAgIHN0YXRlLnJhaXNlKFwibnVtYmVycyBvdXQgb2Ygb3JkZXIgaW4ge30gcXVhbnRpZmllclwiKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHN0YXRlLnN3aXRjaFUgJiYgIW5vRXJyb3IpIHtcbiAgICAgICAgc3RhdGUucmFpc2UoXCJJbmNvbXBsZXRlIHF1YW50aWZpZXJcIik7XG4gICAgICB9XG4gICAgICBzdGF0ZS5wb3MgPSBzdGFydDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtQXRvbVxuICBwcCQxLnJlZ2V4cF9lYXRBdG9tID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5yZWdleHBfZWF0UGF0dGVybkNoYXJhY3RlcnMoc3RhdGUpIHx8XG4gICAgICBzdGF0ZS5lYXQoMHgyRSAvKiAuICovKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0UmV2ZXJzZVNvbGlkdXNBdG9tRXNjYXBlKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0Q2hhcmFjdGVyQ2xhc3Moc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRVbmNhcHR1cmluZ0dyb3VwKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0Q2FwdHVyaW5nR3JvdXAoc3RhdGUpXG4gICAgKVxuICB9O1xuICBwcCQxLnJlZ2V4cF9lYXRSZXZlcnNlU29saWR1c0F0b21Fc2NhcGUgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICBpZiAoc3RhdGUuZWF0KDB4NUMgLyogXFwgKi8pKSB7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0QXRvbUVzY2FwZShzdGF0ZSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcbiAgcHAkMS5yZWdleHBfZWF0VW5jYXB0dXJpbmdHcm91cCA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIGlmIChzdGF0ZS5lYXQoMHgyOCAvKiAoICovKSkge1xuICAgICAgaWYgKHN0YXRlLmVhdCgweDNGIC8qID8gKi8pICYmIHN0YXRlLmVhdCgweDNBIC8qIDogKi8pKSB7XG4gICAgICAgIHRoaXMucmVnZXhwX2Rpc2p1bmN0aW9uKHN0YXRlKTtcbiAgICAgICAgaWYgKHN0YXRlLmVhdCgweDI5IC8qICkgKi8pKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5yYWlzZShcIlVudGVybWluYXRlZCBncm91cFwiKTtcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcbiAgcHAkMS5yZWdleHBfZWF0Q2FwdHVyaW5nR3JvdXAgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5lYXQoMHgyOCAvKiAoICovKSkge1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5KSB7XG4gICAgICAgIHRoaXMucmVnZXhwX2dyb3VwU3BlY2lmaWVyKHN0YXRlKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUuY3VycmVudCgpID09PSAweDNGIC8qID8gKi8pIHtcbiAgICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIGdyb3VwXCIpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZWdleHBfZGlzanVuY3Rpb24oc3RhdGUpO1xuICAgICAgaWYgKHN0YXRlLmVhdCgweDI5IC8qICkgKi8pKSB7XG4gICAgICAgIHN0YXRlLm51bUNhcHR1cmluZ1BhcmVucyArPSAxO1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgc3RhdGUucmFpc2UoXCJVbnRlcm1pbmF0ZWQgZ3JvdXBcIik7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLWFubmV4Qi1FeHRlbmRlZEF0b21cbiAgcHAkMS5yZWdleHBfZWF0RXh0ZW5kZWRBdG9tID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICByZXR1cm4gKFxuICAgICAgc3RhdGUuZWF0KDB4MkUgLyogLiAqLykgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdFJldmVyc2VTb2xpZHVzQXRvbUVzY2FwZShzdGF0ZSkgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdENoYXJhY3RlckNsYXNzKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0VW5jYXB0dXJpbmdHcm91cChzdGF0ZSkgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdENhcHR1cmluZ0dyb3VwKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0SW52YWxpZEJyYWNlZFF1YW50aWZpZXIoc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRFeHRlbmRlZFBhdHRlcm5DaGFyYWN0ZXIoc3RhdGUpXG4gICAgKVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLWFubmV4Qi1JbnZhbGlkQnJhY2VkUXVhbnRpZmllclxuICBwcCQxLnJlZ2V4cF9lYXRJbnZhbGlkQnJhY2VkUXVhbnRpZmllciA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHRoaXMucmVnZXhwX2VhdEJyYWNlZFF1YW50aWZpZXIoc3RhdGUsIHRydWUpKSB7XG4gICAgICBzdGF0ZS5yYWlzZShcIk5vdGhpbmcgdG8gcmVwZWF0XCIpO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1TeW50YXhDaGFyYWN0ZXJcbiAgcHAkMS5yZWdleHBfZWF0U3ludGF4Q2hhcmFjdGVyID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgaWYgKGlzU3ludGF4Q2hhcmFjdGVyKGNoKSkge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gY2g7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcbiAgZnVuY3Rpb24gaXNTeW50YXhDaGFyYWN0ZXIoY2gpIHtcbiAgICByZXR1cm4gKFxuICAgICAgY2ggPT09IDB4MjQgLyogJCAqLyB8fFxuICAgICAgY2ggPj0gMHgyOCAvKiAoICovICYmIGNoIDw9IDB4MkIgLyogKyAqLyB8fFxuICAgICAgY2ggPT09IDB4MkUgLyogLiAqLyB8fFxuICAgICAgY2ggPT09IDB4M0YgLyogPyAqLyB8fFxuICAgICAgY2ggPj0gMHg1QiAvKiBbICovICYmIGNoIDw9IDB4NUUgLyogXiAqLyB8fFxuICAgICAgY2ggPj0gMHg3QiAvKiB7ICovICYmIGNoIDw9IDB4N0QgLyogfSAqL1xuICAgIClcbiAgfVxuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLVBhdHRlcm5DaGFyYWN0ZXJcbiAgLy8gQnV0IGVhdCBlYWdlci5cbiAgcHAkMS5yZWdleHBfZWF0UGF0dGVybkNoYXJhY3RlcnMgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICB2YXIgY2ggPSAwO1xuICAgIHdoaWxlICgoY2ggPSBzdGF0ZS5jdXJyZW50KCkpICE9PSAtMSAmJiAhaXNTeW50YXhDaGFyYWN0ZXIoY2gpKSB7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0ZS5wb3MgIT09IHN0YXJ0XG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUV4dGVuZGVkUGF0dGVybkNoYXJhY3RlclxuICBwcCQxLnJlZ2V4cF9lYXRFeHRlbmRlZFBhdHRlcm5DaGFyYWN0ZXIgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICBpZiAoXG4gICAgICBjaCAhPT0gLTEgJiZcbiAgICAgIGNoICE9PSAweDI0IC8qICQgKi8gJiZcbiAgICAgICEoY2ggPj0gMHgyOCAvKiAoICovICYmIGNoIDw9IDB4MkIgLyogKyAqLykgJiZcbiAgICAgIGNoICE9PSAweDJFIC8qIC4gKi8gJiZcbiAgICAgIGNoICE9PSAweDNGIC8qID8gKi8gJiZcbiAgICAgIGNoICE9PSAweDVCIC8qIFsgKi8gJiZcbiAgICAgIGNoICE9PSAweDVFIC8qIF4gKi8gJiZcbiAgICAgIGNoICE9PSAweDdDIC8qIHwgKi9cbiAgICApIHtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIEdyb3VwU3BlY2lmaWVyIDo6XG4gIC8vICAgW2VtcHR5XVxuICAvLyAgIGA/YCBHcm91cE5hbWVcbiAgcHAkMS5yZWdleHBfZ3JvdXBTcGVjaWZpZXIgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5lYXQoMHgzRiAvKiA/ICovKSkge1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdEdyb3VwTmFtZShzdGF0ZSkpIHtcbiAgICAgICAgaWYgKHN0YXRlLmdyb3VwTmFtZXMuaW5kZXhPZihzdGF0ZS5sYXN0U3RyaW5nVmFsdWUpICE9PSAtMSkge1xuICAgICAgICAgIHN0YXRlLnJhaXNlKFwiRHVwbGljYXRlIGNhcHR1cmUgZ3JvdXAgbmFtZVwiKTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5ncm91cE5hbWVzLnB1c2goc3RhdGUubGFzdFN0cmluZ1ZhbHVlKTtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgZ3JvdXBcIik7XG4gICAgfVxuICB9O1xuXG4gIC8vIEdyb3VwTmFtZSA6OlxuICAvLyAgIGA8YCBSZWdFeHBJZGVudGlmaWVyTmFtZSBgPmBcbiAgLy8gTm90ZTogdGhpcyB1cGRhdGVzIGBzdGF0ZS5sYXN0U3RyaW5nVmFsdWVgIHByb3BlcnR5IHdpdGggdGhlIGVhdGVuIG5hbWUuXG4gIHBwJDEucmVnZXhwX2VhdEdyb3VwTmFtZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgc3RhdGUubGFzdFN0cmluZ1ZhbHVlID0gXCJcIjtcbiAgICBpZiAoc3RhdGUuZWF0KDB4M0MgLyogPCAqLykpIHtcbiAgICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRSZWdFeHBJZGVudGlmaWVyTmFtZShzdGF0ZSkgJiYgc3RhdGUuZWF0KDB4M0UgLyogPiAqLykpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBjYXB0dXJlIGdyb3VwIG5hbWVcIik7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIFJlZ0V4cElkZW50aWZpZXJOYW1lIDo6XG4gIC8vICAgUmVnRXhwSWRlbnRpZmllclN0YXJ0XG4gIC8vICAgUmVnRXhwSWRlbnRpZmllck5hbWUgUmVnRXhwSWRlbnRpZmllclBhcnRcbiAgLy8gTm90ZTogdGhpcyB1cGRhdGVzIGBzdGF0ZS5sYXN0U3RyaW5nVmFsdWVgIHByb3BlcnR5IHdpdGggdGhlIGVhdGVuIG5hbWUuXG4gIHBwJDEucmVnZXhwX2VhdFJlZ0V4cElkZW50aWZpZXJOYW1lID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgPSBcIlwiO1xuICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRSZWdFeHBJZGVudGlmaWVyU3RhcnQoc3RhdGUpKSB7XG4gICAgICBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgKz0gY29kZVBvaW50VG9TdHJpbmcoc3RhdGUubGFzdEludFZhbHVlKTtcbiAgICAgIHdoaWxlICh0aGlzLnJlZ2V4cF9lYXRSZWdFeHBJZGVudGlmaWVyUGFydChzdGF0ZSkpIHtcbiAgICAgICAgc3RhdGUubGFzdFN0cmluZ1ZhbHVlICs9IGNvZGVQb2ludFRvU3RyaW5nKHN0YXRlLmxhc3RJbnRWYWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBSZWdFeHBJZGVudGlmaWVyU3RhcnQgOjpcbiAgLy8gICBVbmljb2RlSURTdGFydFxuICAvLyAgIGAkYFxuICAvLyAgIGBfYFxuICAvLyAgIGBcXGAgUmVnRXhwVW5pY29kZUVzY2FwZVNlcXVlbmNlWytVXVxuICBwcCQxLnJlZ2V4cF9lYXRSZWdFeHBJZGVudGlmaWVyU3RhcnQgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICB2YXIgZm9yY2VVID0gdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDExO1xuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoZm9yY2VVKTtcbiAgICBzdGF0ZS5hZHZhbmNlKGZvcmNlVSk7XG5cbiAgICBpZiAoY2ggPT09IDB4NUMgLyogXFwgKi8gJiYgdGhpcy5yZWdleHBfZWF0UmVnRXhwVW5pY29kZUVzY2FwZVNlcXVlbmNlKHN0YXRlLCBmb3JjZVUpKSB7XG4gICAgICBjaCA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwSWRlbnRpZmllclN0YXJ0KGNoKSkge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gY2g7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIHJldHVybiBmYWxzZVxuICB9O1xuICBmdW5jdGlvbiBpc1JlZ0V4cElkZW50aWZpZXJTdGFydChjaCkge1xuICAgIHJldHVybiBpc0lkZW50aWZpZXJTdGFydChjaCwgdHJ1ZSkgfHwgY2ggPT09IDB4MjQgLyogJCAqLyB8fCBjaCA9PT0gMHg1RiAvKiBfICovXG4gIH1cblxuICAvLyBSZWdFeHBJZGVudGlmaWVyUGFydCA6OlxuICAvLyAgIFVuaWNvZGVJRENvbnRpbnVlXG4gIC8vICAgYCRgXG4gIC8vICAgYF9gXG4gIC8vICAgYFxcYCBSZWdFeHBVbmljb2RlRXNjYXBlU2VxdWVuY2VbK1VdXG4gIC8vICAgPFpXTko+XG4gIC8vICAgPFpXSj5cbiAgcHAkMS5yZWdleHBfZWF0UmVnRXhwSWRlbnRpZmllclBhcnQgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICB2YXIgZm9yY2VVID0gdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDExO1xuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoZm9yY2VVKTtcbiAgICBzdGF0ZS5hZHZhbmNlKGZvcmNlVSk7XG5cbiAgICBpZiAoY2ggPT09IDB4NUMgLyogXFwgKi8gJiYgdGhpcy5yZWdleHBfZWF0UmVnRXhwVW5pY29kZUVzY2FwZVNlcXVlbmNlKHN0YXRlLCBmb3JjZVUpKSB7XG4gICAgICBjaCA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwSWRlbnRpZmllclBhcnQoY2gpKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBjaDtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG4gIGZ1bmN0aW9uIGlzUmVnRXhwSWRlbnRpZmllclBhcnQoY2gpIHtcbiAgICByZXR1cm4gaXNJZGVudGlmaWVyQ2hhcihjaCwgdHJ1ZSkgfHwgY2ggPT09IDB4MjQgLyogJCAqLyB8fCBjaCA9PT0gMHg1RiAvKiBfICovIHx8IGNoID09PSAweDIwMEMgLyogPFpXTko+ICovIHx8IGNoID09PSAweDIwMEQgLyogPFpXSj4gKi9cbiAgfVxuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLWFubmV4Qi1BdG9tRXNjYXBlXG4gIHBwJDEucmVnZXhwX2VhdEF0b21Fc2NhcGUgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmIChcbiAgICAgIHRoaXMucmVnZXhwX2VhdEJhY2tSZWZlcmVuY2Uoc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRDaGFyYWN0ZXJDbGFzc0VzY2FwZShzdGF0ZSkgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdENoYXJhY3RlckVzY2FwZShzdGF0ZSkgfHxcbiAgICAgIChzdGF0ZS5zd2l0Y2hOICYmIHRoaXMucmVnZXhwX2VhdEtHcm91cE5hbWUoc3RhdGUpKVxuICAgICkge1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgaWYgKHN0YXRlLnN3aXRjaFUpIHtcbiAgICAgIC8vIE1ha2UgdGhlIHNhbWUgbWVzc2FnZSBhcyBWOC5cbiAgICAgIGlmIChzdGF0ZS5jdXJyZW50KCkgPT09IDB4NjMgLyogYyAqLykge1xuICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgdW5pY29kZSBlc2NhcGVcIik7XG4gICAgICB9XG4gICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgZXNjYXBlXCIpO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcbiAgcHAkMS5yZWdleHBfZWF0QmFja1JlZmVyZW5jZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIGlmICh0aGlzLnJlZ2V4cF9lYXREZWNpbWFsRXNjYXBlKHN0YXRlKSkge1xuICAgICAgdmFyIG4gPSBzdGF0ZS5sYXN0SW50VmFsdWU7XG4gICAgICBpZiAoc3RhdGUuc3dpdGNoVSkge1xuICAgICAgICAvLyBGb3IgU3ludGF4RXJyb3IgaW4gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3NlYy1hdG9tZXNjYXBlXG4gICAgICAgIGlmIChuID4gc3RhdGUubWF4QmFja1JlZmVyZW5jZSkge1xuICAgICAgICAgIHN0YXRlLm1heEJhY2tSZWZlcmVuY2UgPSBuO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBpZiAobiA8PSBzdGF0ZS5udW1DYXB0dXJpbmdQYXJlbnMpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcbiAgcHAkMS5yZWdleHBfZWF0S0dyb3VwTmFtZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLmVhdCgweDZCIC8qIGsgKi8pKSB7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0R3JvdXBOYW1lKHN0YXRlKSkge1xuICAgICAgICBzdGF0ZS5iYWNrUmVmZXJlbmNlTmFtZXMucHVzaChzdGF0ZS5sYXN0U3RyaW5nVmFsdWUpO1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIG5hbWVkIHJlZmVyZW5jZVwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUNoYXJhY3RlckVzY2FwZVxuICBwcCQxLnJlZ2V4cF9lYXRDaGFyYWN0ZXJFc2NhcGUgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLnJlZ2V4cF9lYXRDb250cm9sRXNjYXBlKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0Q0NvbnRyb2xMZXR0ZXIoc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRaZXJvKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0SGV4RXNjYXBlU2VxdWVuY2Uoc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRSZWdFeHBVbmljb2RlRXNjYXBlU2VxdWVuY2Uoc3RhdGUsIGZhbHNlKSB8fFxuICAgICAgKCFzdGF0ZS5zd2l0Y2hVICYmIHRoaXMucmVnZXhwX2VhdExlZ2FjeU9jdGFsRXNjYXBlU2VxdWVuY2Uoc3RhdGUpKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0SWRlbnRpdHlFc2NhcGUoc3RhdGUpXG4gICAgKVxuICB9O1xuICBwcCQxLnJlZ2V4cF9lYXRDQ29udHJvbExldHRlciA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIGlmIChzdGF0ZS5lYXQoMHg2MyAvKiBjICovKSkge1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdENvbnRyb2xMZXR0ZXIoc3RhdGUpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBzdGF0ZS5wb3MgPSBzdGFydDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG4gIHBwJDEucmVnZXhwX2VhdFplcm8gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5jdXJyZW50KCkgPT09IDB4MzAgLyogMCAqLyAmJiAhaXNEZWNpbWFsRGlnaXQoc3RhdGUubG9va2FoZWFkKCkpKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAwO1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtQ29udHJvbEVzY2FwZVxuICBwcCQxLnJlZ2V4cF9lYXRDb250cm9sRXNjYXBlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgaWYgKGNoID09PSAweDc0IC8qIHQgKi8pIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDB4MDk7IC8qIFxcdCAqL1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgaWYgKGNoID09PSAweDZFIC8qIG4gKi8pIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDB4MEE7IC8qIFxcbiAqL1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgaWYgKGNoID09PSAweDc2IC8qIHYgKi8pIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDB4MEI7IC8qIFxcdiAqL1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgaWYgKGNoID09PSAweDY2IC8qIGYgKi8pIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDB4MEM7IC8qIFxcZiAqL1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgaWYgKGNoID09PSAweDcyIC8qIHIgKi8pIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDB4MEQ7IC8qIFxcciAqL1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtQ29udHJvbExldHRlclxuICBwcCQxLnJlZ2V4cF9lYXRDb250cm9sTGV0dGVyID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgaWYgKGlzQ29udHJvbExldHRlcihjaCkpIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IGNoICUgMHgyMDtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuICBmdW5jdGlvbiBpc0NvbnRyb2xMZXR0ZXIoY2gpIHtcbiAgICByZXR1cm4gKFxuICAgICAgKGNoID49IDB4NDEgLyogQSAqLyAmJiBjaCA8PSAweDVBIC8qIFogKi8pIHx8XG4gICAgICAoY2ggPj0gMHg2MSAvKiBhICovICYmIGNoIDw9IDB4N0EgLyogeiAqLylcbiAgICApXG4gIH1cblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1SZWdFeHBVbmljb2RlRXNjYXBlU2VxdWVuY2VcbiAgcHAkMS5yZWdleHBfZWF0UmVnRXhwVW5pY29kZUVzY2FwZVNlcXVlbmNlID0gZnVuY3Rpb24oc3RhdGUsIGZvcmNlVSkge1xuICAgIGlmICggZm9yY2VVID09PSB2b2lkIDAgKSBmb3JjZVUgPSBmYWxzZTtcblxuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICB2YXIgc3dpdGNoVSA9IGZvcmNlVSB8fCBzdGF0ZS5zd2l0Y2hVO1xuXG4gICAgaWYgKHN0YXRlLmVhdCgweDc1IC8qIHUgKi8pKSB7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0Rml4ZWRIZXhEaWdpdHMoc3RhdGUsIDQpKSB7XG4gICAgICAgIHZhciBsZWFkID0gc3RhdGUubGFzdEludFZhbHVlO1xuICAgICAgICBpZiAoc3dpdGNoVSAmJiBsZWFkID49IDB4RDgwMCAmJiBsZWFkIDw9IDB4REJGRikge1xuICAgICAgICAgIHZhciBsZWFkU3Vycm9nYXRlRW5kID0gc3RhdGUucG9zO1xuICAgICAgICAgIGlmIChzdGF0ZS5lYXQoMHg1QyAvKiBcXCAqLykgJiYgc3RhdGUuZWF0KDB4NzUgLyogdSAqLykgJiYgdGhpcy5yZWdleHBfZWF0Rml4ZWRIZXhEaWdpdHMoc3RhdGUsIDQpKSB7XG4gICAgICAgICAgICB2YXIgdHJhaWwgPSBzdGF0ZS5sYXN0SW50VmFsdWU7XG4gICAgICAgICAgICBpZiAodHJhaWwgPj0gMHhEQzAwICYmIHRyYWlsIDw9IDB4REZGRikge1xuICAgICAgICAgICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAobGVhZCAtIDB4RDgwMCkgKiAweDQwMCArICh0cmFpbCAtIDB4REMwMCkgKyAweDEwMDAwO1xuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBzdGF0ZS5wb3MgPSBsZWFkU3Vycm9nYXRlRW5kO1xuICAgICAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IGxlYWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIGlmIChcbiAgICAgICAgc3dpdGNoVSAmJlxuICAgICAgICBzdGF0ZS5lYXQoMHg3QiAvKiB7ICovKSAmJlxuICAgICAgICB0aGlzLnJlZ2V4cF9lYXRIZXhEaWdpdHMoc3RhdGUpICYmXG4gICAgICAgIHN0YXRlLmVhdCgweDdEIC8qIH0gKi8pICYmXG4gICAgICAgIGlzVmFsaWRVbmljb2RlKHN0YXRlLmxhc3RJbnRWYWx1ZSlcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgaWYgKHN3aXRjaFUpIHtcbiAgICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIHVuaWNvZGUgZXNjYXBlXCIpO1xuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG4gIGZ1bmN0aW9uIGlzVmFsaWRVbmljb2RlKGNoKSB7XG4gICAgcmV0dXJuIGNoID49IDAgJiYgY2ggPD0gMHgxMEZGRkZcbiAgfVxuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLWFubmV4Qi1JZGVudGl0eUVzY2FwZVxuICBwcCQxLnJlZ2V4cF9lYXRJZGVudGl0eUVzY2FwZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLnN3aXRjaFUpIHtcbiAgICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRTeW50YXhDaGFyYWN0ZXIoc3RhdGUpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBpZiAoc3RhdGUuZWF0KDB4MkYgLyogLyAqLykpIHtcbiAgICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMHgyRjsgLyogLyAqL1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgdmFyIGNoID0gc3RhdGUuY3VycmVudCgpO1xuICAgIGlmIChjaCAhPT0gMHg2MyAvKiBjICovICYmICghc3RhdGUuc3dpdGNoTiB8fCBjaCAhPT0gMHg2QiAvKiBrICovKSkge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gY2g7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLURlY2ltYWxFc2NhcGVcbiAgcHAkMS5yZWdleHBfZWF0RGVjaW1hbEVzY2FwZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgc3RhdGUubGFzdEludFZhbHVlID0gMDtcbiAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgaWYgKGNoID49IDB4MzEgLyogMSAqLyAmJiBjaCA8PSAweDM5IC8qIDkgKi8pIHtcbiAgICAgIGRvIHtcbiAgICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMTAgKiBzdGF0ZS5sYXN0SW50VmFsdWUgKyAoY2ggLSAweDMwIC8qIDAgKi8pO1xuICAgICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICB9IHdoaWxlICgoY2ggPSBzdGF0ZS5jdXJyZW50KCkpID49IDB4MzAgLyogMCAqLyAmJiBjaCA8PSAweDM5IC8qIDkgKi8pXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBSZXR1cm4gdmFsdWVzIHVzZWQgYnkgY2hhcmFjdGVyIHNldCBwYXJzaW5nIG1ldGhvZHMsIG5lZWRlZCB0b1xuICAvLyBmb3JiaWQgbmVnYXRpb24gb2Ygc2V0cyB0aGF0IGNhbiBtYXRjaCBzdHJpbmdzLlxuICB2YXIgQ2hhclNldE5vbmUgPSAwOyAvLyBOb3RoaW5nIHBhcnNlZFxuICB2YXIgQ2hhclNldE9rID0gMTsgLy8gQ29uc3RydWN0IHBhcnNlZCwgY2Fubm90IGNvbnRhaW4gc3RyaW5nc1xuICB2YXIgQ2hhclNldFN0cmluZyA9IDI7IC8vIENvbnN0cnVjdCBwYXJzZWQsIGNhbiBjb250YWluIHN0cmluZ3NcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1DaGFyYWN0ZXJDbGFzc0VzY2FwZVxuICBwcCQxLnJlZ2V4cF9lYXRDaGFyYWN0ZXJDbGFzc0VzY2FwZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIGNoID0gc3RhdGUuY3VycmVudCgpO1xuXG4gICAgaWYgKGlzQ2hhcmFjdGVyQ2xhc3NFc2NhcGUoY2gpKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAtMTtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBDaGFyU2V0T2tcbiAgICB9XG5cbiAgICB2YXIgbmVnYXRlID0gZmFsc2U7XG4gICAgaWYgKFxuICAgICAgc3RhdGUuc3dpdGNoVSAmJlxuICAgICAgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkgJiZcbiAgICAgICgobmVnYXRlID0gY2ggPT09IDB4NTAgLyogUCAqLykgfHwgY2ggPT09IDB4NzAgLyogcCAqLylcbiAgICApIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IC0xO1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgdmFyIHJlc3VsdDtcbiAgICAgIGlmIChcbiAgICAgICAgc3RhdGUuZWF0KDB4N0IgLyogeyAqLykgJiZcbiAgICAgICAgKHJlc3VsdCA9IHRoaXMucmVnZXhwX2VhdFVuaWNvZGVQcm9wZXJ0eVZhbHVlRXhwcmVzc2lvbihzdGF0ZSkpICYmXG4gICAgICAgIHN0YXRlLmVhdCgweDdEIC8qIH0gKi8pXG4gICAgICApIHtcbiAgICAgICAgaWYgKG5lZ2F0ZSAmJiByZXN1bHQgPT09IENoYXJTZXRTdHJpbmcpIHsgc3RhdGUucmFpc2UoXCJJbnZhbGlkIHByb3BlcnR5IG5hbWVcIik7IH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgfVxuICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIHByb3BlcnR5IG5hbWVcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIENoYXJTZXROb25lXG4gIH07XG5cbiAgZnVuY3Rpb24gaXNDaGFyYWN0ZXJDbGFzc0VzY2FwZShjaCkge1xuICAgIHJldHVybiAoXG4gICAgICBjaCA9PT0gMHg2NCAvKiBkICovIHx8XG4gICAgICBjaCA9PT0gMHg0NCAvKiBEICovIHx8XG4gICAgICBjaCA9PT0gMHg3MyAvKiBzICovIHx8XG4gICAgICBjaCA9PT0gMHg1MyAvKiBTICovIHx8XG4gICAgICBjaCA9PT0gMHg3NyAvKiB3ICovIHx8XG4gICAgICBjaCA9PT0gMHg1NyAvKiBXICovXG4gICAgKVxuICB9XG5cbiAgLy8gVW5pY29kZVByb3BlcnR5VmFsdWVFeHByZXNzaW9uIDo6XG4gIC8vICAgVW5pY29kZVByb3BlcnR5TmFtZSBgPWAgVW5pY29kZVByb3BlcnR5VmFsdWVcbiAgLy8gICBMb25lVW5pY29kZVByb3BlcnR5TmFtZU9yVmFsdWVcbiAgcHAkMS5yZWdleHBfZWF0VW5pY29kZVByb3BlcnR5VmFsdWVFeHByZXNzaW9uID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG5cbiAgICAvLyBVbmljb2RlUHJvcGVydHlOYW1lIGA9YCBVbmljb2RlUHJvcGVydHlWYWx1ZVxuICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRVbmljb2RlUHJvcGVydHlOYW1lKHN0YXRlKSAmJiBzdGF0ZS5lYXQoMHgzRCAvKiA9ICovKSkge1xuICAgICAgdmFyIG5hbWUgPSBzdGF0ZS5sYXN0U3RyaW5nVmFsdWU7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0VW5pY29kZVByb3BlcnR5VmFsdWUoc3RhdGUpKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHN0YXRlLmxhc3RTdHJpbmdWYWx1ZTtcbiAgICAgICAgdGhpcy5yZWdleHBfdmFsaWRhdGVVbmljb2RlUHJvcGVydHlOYW1lQW5kVmFsdWUoc3RhdGUsIG5hbWUsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIENoYXJTZXRPa1xuICAgICAgfVxuICAgIH1cbiAgICBzdGF0ZS5wb3MgPSBzdGFydDtcblxuICAgIC8vIExvbmVVbmljb2RlUHJvcGVydHlOYW1lT3JWYWx1ZVxuICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRMb25lVW5pY29kZVByb3BlcnR5TmFtZU9yVmFsdWUoc3RhdGUpKSB7XG4gICAgICB2YXIgbmFtZU9yVmFsdWUgPSBzdGF0ZS5sYXN0U3RyaW5nVmFsdWU7XG4gICAgICByZXR1cm4gdGhpcy5yZWdleHBfdmFsaWRhdGVVbmljb2RlUHJvcGVydHlOYW1lT3JWYWx1ZShzdGF0ZSwgbmFtZU9yVmFsdWUpXG4gICAgfVxuICAgIHJldHVybiBDaGFyU2V0Tm9uZVxuICB9O1xuXG4gIHBwJDEucmVnZXhwX3ZhbGlkYXRlVW5pY29kZVByb3BlcnR5TmFtZUFuZFZhbHVlID0gZnVuY3Rpb24oc3RhdGUsIG5hbWUsIHZhbHVlKSB7XG4gICAgaWYgKCFoYXNPd24oc3RhdGUudW5pY29kZVByb3BlcnRpZXMubm9uQmluYXJ5LCBuYW1lKSlcbiAgICAgIHsgc3RhdGUucmFpc2UoXCJJbnZhbGlkIHByb3BlcnR5IG5hbWVcIik7IH1cbiAgICBpZiAoIXN0YXRlLnVuaWNvZGVQcm9wZXJ0aWVzLm5vbkJpbmFyeVtuYW1lXS50ZXN0KHZhbHVlKSlcbiAgICAgIHsgc3RhdGUucmFpc2UoXCJJbnZhbGlkIHByb3BlcnR5IHZhbHVlXCIpOyB9XG4gIH07XG5cbiAgcHAkMS5yZWdleHBfdmFsaWRhdGVVbmljb2RlUHJvcGVydHlOYW1lT3JWYWx1ZSA9IGZ1bmN0aW9uKHN0YXRlLCBuYW1lT3JWYWx1ZSkge1xuICAgIGlmIChzdGF0ZS51bmljb2RlUHJvcGVydGllcy5iaW5hcnkudGVzdChuYW1lT3JWYWx1ZSkpIHsgcmV0dXJuIENoYXJTZXRPayB9XG4gICAgaWYgKHN0YXRlLnN3aXRjaFYgJiYgc3RhdGUudW5pY29kZVByb3BlcnRpZXMuYmluYXJ5T2ZTdHJpbmdzLnRlc3QobmFtZU9yVmFsdWUpKSB7IHJldHVybiBDaGFyU2V0U3RyaW5nIH1cbiAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgcHJvcGVydHkgbmFtZVwiKTtcbiAgfTtcblxuICAvLyBVbmljb2RlUHJvcGVydHlOYW1lIDo6XG4gIC8vICAgVW5pY29kZVByb3BlcnR5TmFtZUNoYXJhY3RlcnNcbiAgcHAkMS5yZWdleHBfZWF0VW5pY29kZVByb3BlcnR5TmFtZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIGNoID0gMDtcbiAgICBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgPSBcIlwiO1xuICAgIHdoaWxlIChpc1VuaWNvZGVQcm9wZXJ0eU5hbWVDaGFyYWN0ZXIoY2ggPSBzdGF0ZS5jdXJyZW50KCkpKSB7XG4gICAgICBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgKz0gY29kZVBvaW50VG9TdHJpbmcoY2gpO1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdGUubGFzdFN0cmluZ1ZhbHVlICE9PSBcIlwiXG4gIH07XG5cbiAgZnVuY3Rpb24gaXNVbmljb2RlUHJvcGVydHlOYW1lQ2hhcmFjdGVyKGNoKSB7XG4gICAgcmV0dXJuIGlzQ29udHJvbExldHRlcihjaCkgfHwgY2ggPT09IDB4NUYgLyogXyAqL1xuICB9XG5cbiAgLy8gVW5pY29kZVByb3BlcnR5VmFsdWUgOjpcbiAgLy8gICBVbmljb2RlUHJvcGVydHlWYWx1ZUNoYXJhY3RlcnNcbiAgcHAkMS5yZWdleHBfZWF0VW5pY29kZVByb3BlcnR5VmFsdWUgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBjaCA9IDA7XG4gICAgc3RhdGUubGFzdFN0cmluZ1ZhbHVlID0gXCJcIjtcbiAgICB3aGlsZSAoaXNVbmljb2RlUHJvcGVydHlWYWx1ZUNoYXJhY3RlcihjaCA9IHN0YXRlLmN1cnJlbnQoKSkpIHtcbiAgICAgIHN0YXRlLmxhc3RTdHJpbmdWYWx1ZSArPSBjb2RlUG9pbnRUb1N0cmluZyhjaCk7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgIT09IFwiXCJcbiAgfTtcbiAgZnVuY3Rpb24gaXNVbmljb2RlUHJvcGVydHlWYWx1ZUNoYXJhY3RlcihjaCkge1xuICAgIHJldHVybiBpc1VuaWNvZGVQcm9wZXJ0eU5hbWVDaGFyYWN0ZXIoY2gpIHx8IGlzRGVjaW1hbERpZ2l0KGNoKVxuICB9XG5cbiAgLy8gTG9uZVVuaWNvZGVQcm9wZXJ0eU5hbWVPclZhbHVlIDo6XG4gIC8vICAgVW5pY29kZVByb3BlcnR5VmFsdWVDaGFyYWN0ZXJzXG4gIHBwJDEucmVnZXhwX2VhdExvbmVVbmljb2RlUHJvcGVydHlOYW1lT3JWYWx1ZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgcmV0dXJuIHRoaXMucmVnZXhwX2VhdFVuaWNvZGVQcm9wZXJ0eVZhbHVlKHN0YXRlKVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUNoYXJhY3RlckNsYXNzXG4gIHBwJDEucmVnZXhwX2VhdENoYXJhY3RlckNsYXNzID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoc3RhdGUuZWF0KDB4NUIgLyogWyAqLykpIHtcbiAgICAgIHZhciBuZWdhdGUgPSBzdGF0ZS5lYXQoMHg1RSAvKiBeICovKTtcbiAgICAgIHZhciByZXN1bHQgPSB0aGlzLnJlZ2V4cF9jbGFzc0NvbnRlbnRzKHN0YXRlKTtcbiAgICAgIGlmICghc3RhdGUuZWF0KDB4NUQgLyogXSAqLykpXG4gICAgICAgIHsgc3RhdGUucmFpc2UoXCJVbnRlcm1pbmF0ZWQgY2hhcmFjdGVyIGNsYXNzXCIpOyB9XG4gICAgICBpZiAobmVnYXRlICYmIHJlc3VsdCA9PT0gQ2hhclNldFN0cmluZylcbiAgICAgICAgeyBzdGF0ZS5yYWlzZShcIk5lZ2F0ZWQgY2hhcmFjdGVyIGNsYXNzIG1heSBjb250YWluIHN0cmluZ3NcIik7IH1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzQ29udGVudHNcbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtQ2xhc3NSYW5nZXNcbiAgcHAkMS5yZWdleHBfY2xhc3NDb250ZW50cyA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLmN1cnJlbnQoKSA9PT0gMHg1RCAvKiBdICovKSB7IHJldHVybiBDaGFyU2V0T2sgfVxuICAgIGlmIChzdGF0ZS5zd2l0Y2hWKSB7IHJldHVybiB0aGlzLnJlZ2V4cF9jbGFzc1NldEV4cHJlc3Npb24oc3RhdGUpIH1cbiAgICB0aGlzLnJlZ2V4cF9ub25FbXB0eUNsYXNzUmFuZ2VzKHN0YXRlKTtcbiAgICByZXR1cm4gQ2hhclNldE9rXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtTm9uZW1wdHlDbGFzc1Jhbmdlc1xuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1Ob25lbXB0eUNsYXNzUmFuZ2VzTm9EYXNoXG4gIHBwJDEucmVnZXhwX25vbkVtcHR5Q2xhc3NSYW5nZXMgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHdoaWxlICh0aGlzLnJlZ2V4cF9lYXRDbGFzc0F0b20oc3RhdGUpKSB7XG4gICAgICB2YXIgbGVmdCA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICAgIGlmIChzdGF0ZS5lYXQoMHgyRCAvKiAtICovKSAmJiB0aGlzLnJlZ2V4cF9lYXRDbGFzc0F0b20oc3RhdGUpKSB7XG4gICAgICAgIHZhciByaWdodCA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICAgICAgaWYgKHN0YXRlLnN3aXRjaFUgJiYgKGxlZnQgPT09IC0xIHx8IHJpZ2h0ID09PSAtMSkpIHtcbiAgICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgY2hhcmFjdGVyIGNsYXNzXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsZWZ0ICE9PSAtMSAmJiByaWdodCAhPT0gLTEgJiYgbGVmdCA+IHJpZ2h0KSB7XG4gICAgICAgICAgc3RhdGUucmFpc2UoXCJSYW5nZSBvdXQgb2Ygb3JkZXIgaW4gY2hhcmFjdGVyIGNsYXNzXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUNsYXNzQXRvbVxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1DbGFzc0F0b21Ob0Rhc2hcbiAgcHAkMS5yZWdleHBfZWF0Q2xhc3NBdG9tID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG5cbiAgICBpZiAoc3RhdGUuZWF0KDB4NUMgLyogXFwgKi8pKSB7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0Q2xhc3NFc2NhcGUoc3RhdGUpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBpZiAoc3RhdGUuc3dpdGNoVSkge1xuICAgICAgICAvLyBNYWtlIHRoZSBzYW1lIG1lc3NhZ2UgYXMgVjguXG4gICAgICAgIHZhciBjaCQxID0gc3RhdGUuY3VycmVudCgpO1xuICAgICAgICBpZiAoY2gkMSA9PT0gMHg2MyAvKiBjICovIHx8IGlzT2N0YWxEaWdpdChjaCQxKSkge1xuICAgICAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBjbGFzcyBlc2NhcGVcIik7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIGVzY2FwZVwiKTtcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cblxuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICBpZiAoY2ggIT09IDB4NUQgLyogXSAqLykge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gY2g7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLWFubmV4Qi1DbGFzc0VzY2FwZVxuICBwcCQxLnJlZ2V4cF9lYXRDbGFzc0VzY2FwZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuXG4gICAgaWYgKHN0YXRlLmVhdCgweDYyIC8qIGIgKi8pKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAweDA4OyAvKiA8QlM+ICovXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIGlmIChzdGF0ZS5zd2l0Y2hVICYmIHN0YXRlLmVhdCgweDJEIC8qIC0gKi8pKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAweDJEOyAvKiAtICovXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIGlmICghc3RhdGUuc3dpdGNoVSAmJiBzdGF0ZS5lYXQoMHg2MyAvKiBjICovKSkge1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdENsYXNzQ29udHJvbExldHRlcihzdGF0ZSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICB0aGlzLnJlZ2V4cF9lYXRDaGFyYWN0ZXJDbGFzc0VzY2FwZShzdGF0ZSkgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdENoYXJhY3RlckVzY2FwZShzdGF0ZSlcbiAgICApXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NTZXRFeHByZXNzaW9uXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzVW5pb25cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NJbnRlcnNlY3Rpb25cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NTdWJ0cmFjdGlvblxuICBwcCQxLnJlZ2V4cF9jbGFzc1NldEV4cHJlc3Npb24gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciByZXN1bHQgPSBDaGFyU2V0T2ssIHN1YlJlc3VsdDtcbiAgICBpZiAodGhpcy5yZWdleHBfZWF0Q2xhc3NTZXRSYW5nZShzdGF0ZSkpIDsgZWxzZSBpZiAoc3ViUmVzdWx0ID0gdGhpcy5yZWdleHBfZWF0Q2xhc3NTZXRPcGVyYW5kKHN0YXRlKSkge1xuICAgICAgaWYgKHN1YlJlc3VsdCA9PT0gQ2hhclNldFN0cmluZykgeyByZXN1bHQgPSBDaGFyU2V0U3RyaW5nOyB9XG4gICAgICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc0ludGVyc2VjdGlvblxuICAgICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgICAgd2hpbGUgKHN0YXRlLmVhdENoYXJzKFsweDI2LCAweDI2XSAvKiAmJiAqLykpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHN0YXRlLmN1cnJlbnQoKSAhPT0gMHgyNiAvKiAmICovICYmXG4gICAgICAgICAgKHN1YlJlc3VsdCA9IHRoaXMucmVnZXhwX2VhdENsYXNzU2V0T3BlcmFuZChzdGF0ZSkpXG4gICAgICAgICkge1xuICAgICAgICAgIGlmIChzdWJSZXN1bHQgIT09IENoYXJTZXRTdHJpbmcpIHsgcmVzdWx0ID0gQ2hhclNldE9rOyB9XG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgY2hhcmFjdGVyIGluIGNoYXJhY3RlciBjbGFzc1wiKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdGFydCAhPT0gc3RhdGUucG9zKSB7IHJldHVybiByZXN1bHQgfVxuICAgICAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NTdWJ0cmFjdGlvblxuICAgICAgd2hpbGUgKHN0YXRlLmVhdENoYXJzKFsweDJELCAweDJEXSAvKiAtLSAqLykpIHtcbiAgICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdENsYXNzU2V0T3BlcmFuZChzdGF0ZSkpIHsgY29udGludWUgfVxuICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgY2hhcmFjdGVyIGluIGNoYXJhY3RlciBjbGFzc1wiKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdGFydCAhPT0gc3RhdGUucG9zKSB7IHJldHVybiByZXN1bHQgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgY2hhcmFjdGVyIGluIGNoYXJhY3RlciBjbGFzc1wiKTtcbiAgICB9XG4gICAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NVbmlvblxuICAgIGZvciAoOzspIHtcbiAgICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRDbGFzc1NldFJhbmdlKHN0YXRlKSkgeyBjb250aW51ZSB9XG4gICAgICBzdWJSZXN1bHQgPSB0aGlzLnJlZ2V4cF9lYXRDbGFzc1NldE9wZXJhbmQoc3RhdGUpO1xuICAgICAgaWYgKCFzdWJSZXN1bHQpIHsgcmV0dXJuIHJlc3VsdCB9XG4gICAgICBpZiAoc3ViUmVzdWx0ID09PSBDaGFyU2V0U3RyaW5nKSB7IHJlc3VsdCA9IENoYXJTZXRTdHJpbmc7IH1cbiAgICB9XG4gIH07XG5cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NTZXRSYW5nZVxuICBwcCQxLnJlZ2V4cF9lYXRDbGFzc1NldFJhbmdlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgaWYgKHRoaXMucmVnZXhwX2VhdENsYXNzU2V0Q2hhcmFjdGVyKHN0YXRlKSkge1xuICAgICAgdmFyIGxlZnQgPSBzdGF0ZS5sYXN0SW50VmFsdWU7XG4gICAgICBpZiAoc3RhdGUuZWF0KDB4MkQgLyogLSAqLykgJiYgdGhpcy5yZWdleHBfZWF0Q2xhc3NTZXRDaGFyYWN0ZXIoc3RhdGUpKSB7XG4gICAgICAgIHZhciByaWdodCA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICAgICAgaWYgKGxlZnQgIT09IC0xICYmIHJpZ2h0ICE9PSAtMSAmJiBsZWZ0ID4gcmlnaHQpIHtcbiAgICAgICAgICBzdGF0ZS5yYWlzZShcIlJhbmdlIG91dCBvZiBvcmRlciBpbiBjaGFyYWN0ZXIgY2xhc3NcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1NldE9wZXJhbmRcbiAgcHAkMS5yZWdleHBfZWF0Q2xhc3NTZXRPcGVyYW5kID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAodGhpcy5yZWdleHBfZWF0Q2xhc3NTZXRDaGFyYWN0ZXIoc3RhdGUpKSB7IHJldHVybiBDaGFyU2V0T2sgfVxuICAgIHJldHVybiB0aGlzLnJlZ2V4cF9lYXRDbGFzc1N0cmluZ0Rpc2p1bmN0aW9uKHN0YXRlKSB8fCB0aGlzLnJlZ2V4cF9lYXROZXN0ZWRDbGFzcyhzdGF0ZSlcbiAgfTtcblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1OZXN0ZWRDbGFzc1xuICBwcCQxLnJlZ2V4cF9lYXROZXN0ZWRDbGFzcyA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIGlmIChzdGF0ZS5lYXQoMHg1QiAvKiBbICovKSkge1xuICAgICAgdmFyIG5lZ2F0ZSA9IHN0YXRlLmVhdCgweDVFIC8qIF4gKi8pO1xuICAgICAgdmFyIHJlc3VsdCA9IHRoaXMucmVnZXhwX2NsYXNzQ29udGVudHMoc3RhdGUpO1xuICAgICAgaWYgKHN0YXRlLmVhdCgweDVEIC8qIF0gKi8pKSB7XG4gICAgICAgIGlmIChuZWdhdGUgJiYgcmVzdWx0ID09PSBDaGFyU2V0U3RyaW5nKSB7XG4gICAgICAgICAgc3RhdGUucmFpc2UoXCJOZWdhdGVkIGNoYXJhY3RlciBjbGFzcyBtYXkgY29udGFpbiBzdHJpbmdzXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICBpZiAoc3RhdGUuZWF0KDB4NUMgLyogXFwgKi8pKSB7XG4gICAgICB2YXIgcmVzdWx0JDEgPSB0aGlzLnJlZ2V4cF9lYXRDaGFyYWN0ZXJDbGFzc0VzY2FwZShzdGF0ZSk7XG4gICAgICBpZiAocmVzdWx0JDEpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCQxXG4gICAgICB9XG4gICAgICBzdGF0ZS5wb3MgPSBzdGFydDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGxcbiAgfTtcblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1N0cmluZ0Rpc2p1bmN0aW9uXG4gIHBwJDEucmVnZXhwX2VhdENsYXNzU3RyaW5nRGlzanVuY3Rpb24gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICBpZiAoc3RhdGUuZWF0Q2hhcnMoWzB4NUMsIDB4NzFdIC8qIFxccSAqLykpIHtcbiAgICAgIGlmIChzdGF0ZS5lYXQoMHg3QiAvKiB7ICovKSkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gdGhpcy5yZWdleHBfY2xhc3NTdHJpbmdEaXNqdW5jdGlvbkNvbnRlbnRzKHN0YXRlKTtcbiAgICAgICAgaWYgKHN0YXRlLmVhdCgweDdEIC8qIH0gKi8pKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBNYWtlIHRoZSBzYW1lIG1lc3NhZ2UgYXMgVjguXG4gICAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBlc2NhcGVcIik7XG4gICAgICB9XG4gICAgICBzdGF0ZS5wb3MgPSBzdGFydDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGxcbiAgfTtcblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1N0cmluZ0Rpc2p1bmN0aW9uQ29udGVudHNcbiAgcHAkMS5yZWdleHBfY2xhc3NTdHJpbmdEaXNqdW5jdGlvbkNvbnRlbnRzID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5yZWdleHBfY2xhc3NTdHJpbmcoc3RhdGUpO1xuICAgIHdoaWxlIChzdGF0ZS5lYXQoMHg3QyAvKiB8ICovKSkge1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2NsYXNzU3RyaW5nKHN0YXRlKSA9PT0gQ2hhclNldFN0cmluZykgeyByZXN1bHQgPSBDaGFyU2V0U3RyaW5nOyB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRcbiAgfTtcblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1N0cmluZ1xuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1Ob25FbXB0eUNsYXNzU3RyaW5nXG4gIHBwJDEucmVnZXhwX2NsYXNzU3RyaW5nID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgY291bnQgPSAwO1xuICAgIHdoaWxlICh0aGlzLnJlZ2V4cF9lYXRDbGFzc1NldENoYXJhY3RlcihzdGF0ZSkpIHsgY291bnQrKzsgfVxuICAgIHJldHVybiBjb3VudCA9PT0gMSA/IENoYXJTZXRPayA6IENoYXJTZXRTdHJpbmdcbiAgfTtcblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1NldENoYXJhY3RlclxuICBwcCQxLnJlZ2V4cF9lYXRDbGFzc1NldENoYXJhY3RlciA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIGlmIChzdGF0ZS5lYXQoMHg1QyAvKiBcXCAqLykpIHtcbiAgICAgIGlmIChcbiAgICAgICAgdGhpcy5yZWdleHBfZWF0Q2hhcmFjdGVyRXNjYXBlKHN0YXRlKSB8fFxuICAgICAgICB0aGlzLnJlZ2V4cF9lYXRDbGFzc1NldFJlc2VydmVkUHVuY3R1YXRvcihzdGF0ZSlcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgaWYgKHN0YXRlLmVhdCgweDYyIC8qIGIgKi8pKSB7XG4gICAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDB4MDg7IC8qIDxCUz4gKi9cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICBpZiAoY2ggPCAwIHx8IGNoID09PSBzdGF0ZS5sb29rYWhlYWQoKSAmJiBpc0NsYXNzU2V0UmVzZXJ2ZWREb3VibGVQdW5jdHVhdG9yQ2hhcmFjdGVyKGNoKSkgeyByZXR1cm4gZmFsc2UgfVxuICAgIGlmIChpc0NsYXNzU2V0U3ludGF4Q2hhcmFjdGVyKGNoKSkgeyByZXR1cm4gZmFsc2UgfVxuICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBjaDtcbiAgICByZXR1cm4gdHJ1ZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzU2V0UmVzZXJ2ZWREb3VibGVQdW5jdHVhdG9yXG4gIGZ1bmN0aW9uIGlzQ2xhc3NTZXRSZXNlcnZlZERvdWJsZVB1bmN0dWF0b3JDaGFyYWN0ZXIoY2gpIHtcbiAgICByZXR1cm4gKFxuICAgICAgY2ggPT09IDB4MjEgLyogISAqLyB8fFxuICAgICAgY2ggPj0gMHgyMyAvKiAjICovICYmIGNoIDw9IDB4MjYgLyogJiAqLyB8fFxuICAgICAgY2ggPj0gMHgyQSAvKiAqICovICYmIGNoIDw9IDB4MkMgLyogLCAqLyB8fFxuICAgICAgY2ggPT09IDB4MkUgLyogLiAqLyB8fFxuICAgICAgY2ggPj0gMHgzQSAvKiA6ICovICYmIGNoIDw9IDB4NDAgLyogQCAqLyB8fFxuICAgICAgY2ggPT09IDB4NUUgLyogXiAqLyB8fFxuICAgICAgY2ggPT09IDB4NjAgLyogYCAqLyB8fFxuICAgICAgY2ggPT09IDB4N0UgLyogfiAqL1xuICAgIClcbiAgfVxuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzU2V0U3ludGF4Q2hhcmFjdGVyXG4gIGZ1bmN0aW9uIGlzQ2xhc3NTZXRTeW50YXhDaGFyYWN0ZXIoY2gpIHtcbiAgICByZXR1cm4gKFxuICAgICAgY2ggPT09IDB4MjggLyogKCAqLyB8fFxuICAgICAgY2ggPT09IDB4MjkgLyogKSAqLyB8fFxuICAgICAgY2ggPT09IDB4MkQgLyogLSAqLyB8fFxuICAgICAgY2ggPT09IDB4MkYgLyogLyAqLyB8fFxuICAgICAgY2ggPj0gMHg1QiAvKiBbICovICYmIGNoIDw9IDB4NUQgLyogXSAqLyB8fFxuICAgICAgY2ggPj0gMHg3QiAvKiB7ICovICYmIGNoIDw9IDB4N0QgLyogfSAqL1xuICAgIClcbiAgfVxuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzU2V0UmVzZXJ2ZWRQdW5jdHVhdG9yXG4gIHBwJDEucmVnZXhwX2VhdENsYXNzU2V0UmVzZXJ2ZWRQdW5jdHVhdG9yID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgaWYgKGlzQ2xhc3NTZXRSZXNlcnZlZFB1bmN0dWF0b3IoY2gpKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBjaDtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzU2V0UmVzZXJ2ZWRQdW5jdHVhdG9yXG4gIGZ1bmN0aW9uIGlzQ2xhc3NTZXRSZXNlcnZlZFB1bmN0dWF0b3IoY2gpIHtcbiAgICByZXR1cm4gKFxuICAgICAgY2ggPT09IDB4MjEgLyogISAqLyB8fFxuICAgICAgY2ggPT09IDB4MjMgLyogIyAqLyB8fFxuICAgICAgY2ggPT09IDB4MjUgLyogJSAqLyB8fFxuICAgICAgY2ggPT09IDB4MjYgLyogJiAqLyB8fFxuICAgICAgY2ggPT09IDB4MkMgLyogLCAqLyB8fFxuICAgICAgY2ggPT09IDB4MkQgLyogLSAqLyB8fFxuICAgICAgY2ggPj0gMHgzQSAvKiA6ICovICYmIGNoIDw9IDB4M0UgLyogPiAqLyB8fFxuICAgICAgY2ggPT09IDB4NDAgLyogQCAqLyB8fFxuICAgICAgY2ggPT09IDB4NjAgLyogYCAqLyB8fFxuICAgICAgY2ggPT09IDB4N0UgLyogfiAqL1xuICAgIClcbiAgfVxuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLWFubmV4Qi1DbGFzc0NvbnRyb2xMZXR0ZXJcbiAgcHAkMS5yZWdleHBfZWF0Q2xhc3NDb250cm9sTGV0dGVyID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgaWYgKGlzRGVjaW1hbERpZ2l0KGNoKSB8fCBjaCA9PT0gMHg1RiAvKiBfICovKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBjaCAlIDB4MjA7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1IZXhFc2NhcGVTZXF1ZW5jZVxuICBwcCQxLnJlZ2V4cF9lYXRIZXhFc2NhcGVTZXF1ZW5jZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIGlmIChzdGF0ZS5lYXQoMHg3OCAvKiB4ICovKSkge1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdEZpeGVkSGV4RGlnaXRzKHN0YXRlLCAyKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgaWYgKHN0YXRlLnN3aXRjaFUpIHtcbiAgICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIGVzY2FwZVwiKTtcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1EZWNpbWFsRGlnaXRzXG4gIHBwJDEucmVnZXhwX2VhdERlY2ltYWxEaWdpdHMgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICB2YXIgY2ggPSAwO1xuICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDA7XG4gICAgd2hpbGUgKGlzRGVjaW1hbERpZ2l0KGNoID0gc3RhdGUuY3VycmVudCgpKSkge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMTAgKiBzdGF0ZS5sYXN0SW50VmFsdWUgKyAoY2ggLSAweDMwIC8qIDAgKi8pO1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdGUucG9zICE9PSBzdGFydFxuICB9O1xuICBmdW5jdGlvbiBpc0RlY2ltYWxEaWdpdChjaCkge1xuICAgIHJldHVybiBjaCA+PSAweDMwIC8qIDAgKi8gJiYgY2ggPD0gMHgzOSAvKiA5ICovXG4gIH1cblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1IZXhEaWdpdHNcbiAgcHAkMS5yZWdleHBfZWF0SGV4RGlnaXRzID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgdmFyIGNoID0gMDtcbiAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAwO1xuICAgIHdoaWxlIChpc0hleERpZ2l0KGNoID0gc3RhdGUuY3VycmVudCgpKSkge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMTYgKiBzdGF0ZS5sYXN0SW50VmFsdWUgKyBoZXhUb0ludChjaCk7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0ZS5wb3MgIT09IHN0YXJ0XG4gIH07XG4gIGZ1bmN0aW9uIGlzSGV4RGlnaXQoY2gpIHtcbiAgICByZXR1cm4gKFxuICAgICAgKGNoID49IDB4MzAgLyogMCAqLyAmJiBjaCA8PSAweDM5IC8qIDkgKi8pIHx8XG4gICAgICAoY2ggPj0gMHg0MSAvKiBBICovICYmIGNoIDw9IDB4NDYgLyogRiAqLykgfHxcbiAgICAgIChjaCA+PSAweDYxIC8qIGEgKi8gJiYgY2ggPD0gMHg2NiAvKiBmICovKVxuICAgIClcbiAgfVxuICBmdW5jdGlvbiBoZXhUb0ludChjaCkge1xuICAgIGlmIChjaCA+PSAweDQxIC8qIEEgKi8gJiYgY2ggPD0gMHg0NiAvKiBGICovKSB7XG4gICAgICByZXR1cm4gMTAgKyAoY2ggLSAweDQxIC8qIEEgKi8pXG4gICAgfVxuICAgIGlmIChjaCA+PSAweDYxIC8qIGEgKi8gJiYgY2ggPD0gMHg2NiAvKiBmICovKSB7XG4gICAgICByZXR1cm4gMTAgKyAoY2ggLSAweDYxIC8qIGEgKi8pXG4gICAgfVxuICAgIHJldHVybiBjaCAtIDB4MzAgLyogMCAqL1xuICB9XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUxlZ2FjeU9jdGFsRXNjYXBlU2VxdWVuY2VcbiAgLy8gQWxsb3dzIG9ubHkgMC0zNzcob2N0YWwpIGkuZS4gMC0yNTUoZGVjaW1hbCkuXG4gIHBwJDEucmVnZXhwX2VhdExlZ2FjeU9jdGFsRXNjYXBlU2VxdWVuY2UgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRPY3RhbERpZ2l0KHN0YXRlKSkge1xuICAgICAgdmFyIG4xID0gc3RhdGUubGFzdEludFZhbHVlO1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdE9jdGFsRGlnaXQoc3RhdGUpKSB7XG4gICAgICAgIHZhciBuMiA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICAgICAgaWYgKG4xIDw9IDMgJiYgdGhpcy5yZWdleHBfZWF0T2N0YWxEaWdpdChzdGF0ZSkpIHtcbiAgICAgICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBuMSAqIDY0ICsgbjIgKiA4ICsgc3RhdGUubGFzdEludFZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IG4xICogOCArIG4yO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBuMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLU9jdGFsRGlnaXRcbiAgcHAkMS5yZWdleHBfZWF0T2N0YWxEaWdpdCA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIGNoID0gc3RhdGUuY3VycmVudCgpO1xuICAgIGlmIChpc09jdGFsRGlnaXQoY2gpKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBjaCAtIDB4MzA7IC8qIDAgKi9cbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDA7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG4gIGZ1bmN0aW9uIGlzT2N0YWxEaWdpdChjaCkge1xuICAgIHJldHVybiBjaCA+PSAweDMwIC8qIDAgKi8gJiYgY2ggPD0gMHgzNyAvKiA3ICovXG4gIH1cblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1IZXg0RGlnaXRzXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUhleERpZ2l0XG4gIC8vIEFuZCBIZXhEaWdpdCBIZXhEaWdpdCBpbiBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1IZXhFc2NhcGVTZXF1ZW5jZVxuICBwcCQxLnJlZ2V4cF9lYXRGaXhlZEhleERpZ2l0cyA9IGZ1bmN0aW9uKHN0YXRlLCBsZW5ndGgpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgc3RhdGUubGFzdEludFZhbHVlID0gMDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgICBpZiAoIWlzSGV4RGlnaXQoY2gpKSB7XG4gICAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDE2ICogc3RhdGUubGFzdEludFZhbHVlICsgaGV4VG9JbnQoY2gpO1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZVxuICB9O1xuXG4gIC8vIE9iamVjdCB0eXBlIHVzZWQgdG8gcmVwcmVzZW50IHRva2Vucy4gTm90ZSB0aGF0IG5vcm1hbGx5LCB0b2tlbnNcbiAgLy8gc2ltcGx5IGV4aXN0IGFzIHByb3BlcnRpZXMgb24gdGhlIHBhcnNlciBvYmplY3QuIFRoaXMgaXMgb25seVxuICAvLyB1c2VkIGZvciB0aGUgb25Ub2tlbiBjYWxsYmFjayBhbmQgdGhlIGV4dGVybmFsIHRva2VuaXplci5cblxuICB2YXIgVG9rZW4gPSBmdW5jdGlvbiBUb2tlbihwKSB7XG4gICAgdGhpcy50eXBlID0gcC50eXBlO1xuICAgIHRoaXMudmFsdWUgPSBwLnZhbHVlO1xuICAgIHRoaXMuc3RhcnQgPSBwLnN0YXJ0O1xuICAgIHRoaXMuZW5kID0gcC5lbmQ7XG4gICAgaWYgKHAub3B0aW9ucy5sb2NhdGlvbnMpXG4gICAgICB7IHRoaXMubG9jID0gbmV3IFNvdXJjZUxvY2F0aW9uKHAsIHAuc3RhcnRMb2MsIHAuZW5kTG9jKTsgfVxuICAgIGlmIChwLm9wdGlvbnMucmFuZ2VzKVxuICAgICAgeyB0aGlzLnJhbmdlID0gW3Auc3RhcnQsIHAuZW5kXTsgfVxuICB9O1xuXG4gIC8vICMjIFRva2VuaXplclxuXG4gIHZhciBwcCA9IFBhcnNlci5wcm90b3R5cGU7XG5cbiAgLy8gTW92ZSB0byB0aGUgbmV4dCB0b2tlblxuXG4gIHBwLm5leHQgPSBmdW5jdGlvbihpZ25vcmVFc2NhcGVTZXF1ZW5jZUluS2V5d29yZCkge1xuICAgIGlmICghaWdub3JlRXNjYXBlU2VxdWVuY2VJbktleXdvcmQgJiYgdGhpcy50eXBlLmtleXdvcmQgJiYgdGhpcy5jb250YWluc0VzYylcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMuc3RhcnQsIFwiRXNjYXBlIHNlcXVlbmNlIGluIGtleXdvcmQgXCIgKyB0aGlzLnR5cGUua2V5d29yZCk7IH1cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uVG9rZW4pXG4gICAgICB7IHRoaXMub3B0aW9ucy5vblRva2VuKG5ldyBUb2tlbih0aGlzKSk7IH1cblxuICAgIHRoaXMubGFzdFRva0VuZCA9IHRoaXMuZW5kO1xuICAgIHRoaXMubGFzdFRva1N0YXJ0ID0gdGhpcy5zdGFydDtcbiAgICB0aGlzLmxhc3RUb2tFbmRMb2MgPSB0aGlzLmVuZExvYztcbiAgICB0aGlzLmxhc3RUb2tTdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgdGhpcy5uZXh0VG9rZW4oKTtcbiAgfTtcblxuICBwcC5nZXRUb2tlbiA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIHJldHVybiBuZXcgVG9rZW4odGhpcylcbiAgfTtcblxuICAvLyBJZiB3ZSdyZSBpbiBhbiBFUzYgZW52aXJvbm1lbnQsIG1ha2UgcGFyc2VycyBpdGVyYWJsZVxuICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gXCJ1bmRlZmluZWRcIilcbiAgICB7IHBwW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciB0aGlzJDEkMSA9IHRoaXM7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgdG9rZW4gPSB0aGlzJDEkMS5nZXRUb2tlbigpO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBkb25lOiB0b2tlbi50eXBlID09PSB0eXBlcyQxLmVvZixcbiAgICAgICAgICAgIHZhbHVlOiB0b2tlblxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07IH1cblxuICAvLyBUb2dnbGUgc3RyaWN0IG1vZGUuIFJlLXJlYWRzIHRoZSBuZXh0IG51bWJlciBvciBzdHJpbmcgdG8gcGxlYXNlXG4gIC8vIHBlZGFudGljIHRlc3RzIChgXCJ1c2Ugc3RyaWN0XCI7IDAxMDtgIHNob3VsZCBmYWlsKS5cblxuICAvLyBSZWFkIGEgc2luZ2xlIHRva2VuLCB1cGRhdGluZyB0aGUgcGFyc2VyIG9iamVjdCdzIHRva2VuLXJlbGF0ZWRcbiAgLy8gcHJvcGVydGllcy5cblxuICBwcC5uZXh0VG9rZW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY3VyQ29udGV4dCA9IHRoaXMuY3VyQ29udGV4dCgpO1xuICAgIGlmICghY3VyQ29udGV4dCB8fCAhY3VyQ29udGV4dC5wcmVzZXJ2ZVNwYWNlKSB7IHRoaXMuc2tpcFNwYWNlKCk7IH1cblxuICAgIHRoaXMuc3RhcnQgPSB0aGlzLnBvcztcbiAgICBpZiAodGhpcy5vcHRpb25zLmxvY2F0aW9ucykgeyB0aGlzLnN0YXJ0TG9jID0gdGhpcy5jdXJQb3NpdGlvbigpOyB9XG4gICAgaWYgKHRoaXMucG9zID49IHRoaXMuaW5wdXQubGVuZ3RoKSB7IHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuZW9mKSB9XG5cbiAgICBpZiAoY3VyQ29udGV4dC5vdmVycmlkZSkgeyByZXR1cm4gY3VyQ29udGV4dC5vdmVycmlkZSh0aGlzKSB9XG4gICAgZWxzZSB7IHRoaXMucmVhZFRva2VuKHRoaXMuZnVsbENoYXJDb2RlQXRQb3MoKSk7IH1cbiAgfTtcblxuICBwcC5yZWFkVG9rZW4gPSBmdW5jdGlvbihjb2RlKSB7XG4gICAgLy8gSWRlbnRpZmllciBvciBrZXl3b3JkLiAnXFx1WFhYWCcgc2VxdWVuY2VzIGFyZSBhbGxvd2VkIGluXG4gICAgLy8gaWRlbnRpZmllcnMsIHNvICdcXCcgYWxzbyBkaXNwYXRjaGVzIHRvIHRoYXQuXG4gICAgaWYgKGlzSWRlbnRpZmllclN0YXJ0KGNvZGUsIHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2KSB8fCBjb2RlID09PSA5MiAvKiAnXFwnICovKVxuICAgICAgeyByZXR1cm4gdGhpcy5yZWFkV29yZCgpIH1cblxuICAgIHJldHVybiB0aGlzLmdldFRva2VuRnJvbUNvZGUoY29kZSlcbiAgfTtcblxuICBwcC5mdWxsQ2hhckNvZGVBdFBvcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb2RlID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKTtcbiAgICBpZiAoY29kZSA8PSAweGQ3ZmYgfHwgY29kZSA+PSAweGRjMDApIHsgcmV0dXJuIGNvZGUgfVxuICAgIHZhciBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSk7XG4gICAgcmV0dXJuIG5leHQgPD0gMHhkYmZmIHx8IG5leHQgPj0gMHhlMDAwID8gY29kZSA6IChjb2RlIDw8IDEwKSArIG5leHQgLSAweDM1ZmRjMDBcbiAgfTtcblxuICBwcC5za2lwQmxvY2tDb21tZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHN0YXJ0TG9jID0gdGhpcy5vcHRpb25zLm9uQ29tbWVudCAmJiB0aGlzLmN1clBvc2l0aW9uKCk7XG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5wb3MsIGVuZCA9IHRoaXMuaW5wdXQuaW5kZXhPZihcIiovXCIsIHRoaXMucG9zICs9IDIpO1xuICAgIGlmIChlbmQgPT09IC0xKSB7IHRoaXMucmFpc2UodGhpcy5wb3MgLSAyLCBcIlVudGVybWluYXRlZCBjb21tZW50XCIpOyB9XG4gICAgdGhpcy5wb3MgPSBlbmQgKyAyO1xuICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb25zKSB7XG4gICAgICBmb3IgKHZhciBuZXh0QnJlYWsgPSAodm9pZCAwKSwgcG9zID0gc3RhcnQ7IChuZXh0QnJlYWsgPSBuZXh0TGluZUJyZWFrKHRoaXMuaW5wdXQsIHBvcywgdGhpcy5wb3MpKSA+IC0xOykge1xuICAgICAgICArK3RoaXMuY3VyTGluZTtcbiAgICAgICAgcG9zID0gdGhpcy5saW5lU3RhcnQgPSBuZXh0QnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMub25Db21tZW50KVxuICAgICAgeyB0aGlzLm9wdGlvbnMub25Db21tZW50KHRydWUsIHRoaXMuaW5wdXQuc2xpY2Uoc3RhcnQgKyAyLCBlbmQpLCBzdGFydCwgdGhpcy5wb3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0TG9jLCB0aGlzLmN1clBvc2l0aW9uKCkpOyB9XG4gIH07XG5cbiAgcHAuc2tpcExpbmVDb21tZW50ID0gZnVuY3Rpb24oc3RhcnRTa2lwKSB7XG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5wb3M7XG4gICAgdmFyIHN0YXJ0TG9jID0gdGhpcy5vcHRpb25zLm9uQ29tbWVudCAmJiB0aGlzLmN1clBvc2l0aW9uKCk7XG4gICAgdmFyIGNoID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICs9IHN0YXJ0U2tpcCk7XG4gICAgd2hpbGUgKHRoaXMucG9zIDwgdGhpcy5pbnB1dC5sZW5ndGggJiYgIWlzTmV3TGluZShjaCkpIHtcbiAgICAgIGNoID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KCsrdGhpcy5wb3MpO1xuICAgIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQ29tbWVudClcbiAgICAgIHsgdGhpcy5vcHRpb25zLm9uQ29tbWVudChmYWxzZSwgdGhpcy5pbnB1dC5zbGljZShzdGFydCArIHN0YXJ0U2tpcCwgdGhpcy5wb3MpLCBzdGFydCwgdGhpcy5wb3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0TG9jLCB0aGlzLmN1clBvc2l0aW9uKCkpOyB9XG4gIH07XG5cbiAgLy8gQ2FsbGVkIGF0IHRoZSBzdGFydCBvZiB0aGUgcGFyc2UgYW5kIGFmdGVyIGV2ZXJ5IHRva2VuLiBTa2lwc1xuICAvLyB3aGl0ZXNwYWNlIGFuZCBjb21tZW50cywgYW5kLlxuXG4gIHBwLnNraXBTcGFjZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvb3A6IHdoaWxlICh0aGlzLnBvcyA8IHRoaXMuaW5wdXQubGVuZ3RoKSB7XG4gICAgICB2YXIgY2ggPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpO1xuICAgICAgc3dpdGNoIChjaCkge1xuICAgICAgY2FzZSAzMjogY2FzZSAxNjA6IC8vICcgJ1xuICAgICAgICArK3RoaXMucG9zO1xuICAgICAgICBicmVha1xuICAgICAgY2FzZSAxMzpcbiAgICAgICAgaWYgKHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDEpID09PSAxMCkge1xuICAgICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgIH1cbiAgICAgIGNhc2UgMTA6IGNhc2UgODIzMjogY2FzZSA4MjMzOlxuICAgICAgICArK3RoaXMucG9zO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmxvY2F0aW9ucykge1xuICAgICAgICAgICsrdGhpcy5jdXJMaW5lO1xuICAgICAgICAgIHRoaXMubGluZVN0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgNDc6IC8vICcvJ1xuICAgICAgICBzd2l0Y2ggKHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDEpKSB7XG4gICAgICAgIGNhc2UgNDI6IC8vICcqJ1xuICAgICAgICAgIHRoaXMuc2tpcEJsb2NrQ29tbWVudCgpO1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDc6XG4gICAgICAgICAgdGhpcy5za2lwTGluZUNvbW1lbnQoMik7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhayBsb29wXG4gICAgICAgIH1cbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChjaCA+IDggJiYgY2ggPCAxNCB8fCBjaCA+PSA1NzYwICYmIG5vbkFTQ0lJd2hpdGVzcGFjZS50ZXN0KFN0cmluZy5mcm9tQ2hhckNvZGUoY2gpKSkge1xuICAgICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYnJlYWsgbG9vcFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8vIENhbGxlZCBhdCB0aGUgZW5kIG9mIGV2ZXJ5IHRva2VuLiBTZXRzIGBlbmRgLCBgdmFsYCwgYW5kXG4gIC8vIG1haW50YWlucyBgY29udGV4dGAgYW5kIGBleHByQWxsb3dlZGAsIGFuZCBza2lwcyB0aGUgc3BhY2UgYWZ0ZXJcbiAgLy8gdGhlIHRva2VuLCBzbyB0aGF0IHRoZSBuZXh0IG9uZSdzIGBzdGFydGAgd2lsbCBwb2ludCBhdCB0aGVcbiAgLy8gcmlnaHQgcG9zaXRpb24uXG5cbiAgcHAuZmluaXNoVG9rZW4gPSBmdW5jdGlvbih0eXBlLCB2YWwpIHtcbiAgICB0aGlzLmVuZCA9IHRoaXMucG9zO1xuICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb25zKSB7IHRoaXMuZW5kTG9jID0gdGhpcy5jdXJQb3NpdGlvbigpOyB9XG4gICAgdmFyIHByZXZUeXBlID0gdGhpcy50eXBlO1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy52YWx1ZSA9IHZhbDtcblxuICAgIHRoaXMudXBkYXRlQ29udGV4dChwcmV2VHlwZSk7XG4gIH07XG5cbiAgLy8gIyMjIFRva2VuIHJlYWRpbmdcblxuICAvLyBUaGlzIGlzIHRoZSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB0byBmZXRjaCB0aGUgbmV4dCB0b2tlbi4gSXRcbiAgLy8gaXMgc29tZXdoYXQgb2JzY3VyZSwgYmVjYXVzZSBpdCB3b3JrcyBpbiBjaGFyYWN0ZXIgY29kZXMgcmF0aGVyXG4gIC8vIHRoYW4gY2hhcmFjdGVycywgYW5kIGJlY2F1c2Ugb3BlcmF0b3IgcGFyc2luZyBoYXMgYmVlbiBpbmxpbmVkXG4gIC8vIGludG8gaXQuXG4gIC8vXG4gIC8vIEFsbCBpbiB0aGUgbmFtZSBvZiBzcGVlZC5cbiAgLy9cbiAgcHAucmVhZFRva2VuX2RvdCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSk7XG4gICAgaWYgKG5leHQgPj0gNDggJiYgbmV4dCA8PSA1NykgeyByZXR1cm4gdGhpcy5yZWFkTnVtYmVyKHRydWUpIH1cbiAgICB2YXIgbmV4dDIgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAyKTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYgJiYgbmV4dCA9PT0gNDYgJiYgbmV4dDIgPT09IDQ2KSB7IC8vIDQ2ID0gZG90ICcuJ1xuICAgICAgdGhpcy5wb3MgKz0gMztcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuZWxsaXBzaXMpXG4gICAgfSBlbHNlIHtcbiAgICAgICsrdGhpcy5wb3M7XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLmRvdClcbiAgICB9XG4gIH07XG5cbiAgcHAucmVhZFRva2VuX3NsYXNoID0gZnVuY3Rpb24oKSB7IC8vICcvJ1xuICAgIHZhciBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSk7XG4gICAgaWYgKHRoaXMuZXhwckFsbG93ZWQpIHsgKyt0aGlzLnBvczsgcmV0dXJuIHRoaXMucmVhZFJlZ2V4cCgpIH1cbiAgICBpZiAobmV4dCA9PT0gNjEpIHsgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5hc3NpZ24sIDIpIH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLnNsYXNoLCAxKVxuICB9O1xuXG4gIHBwLnJlYWRUb2tlbl9tdWx0X21vZHVsb19leHAgPSBmdW5jdGlvbihjb2RlKSB7IC8vICclKidcbiAgICB2YXIgbmV4dCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDEpO1xuICAgIHZhciBzaXplID0gMTtcbiAgICB2YXIgdG9rZW50eXBlID0gY29kZSA9PT0gNDIgPyB0eXBlcyQxLnN0YXIgOiB0eXBlcyQxLm1vZHVsbztcblxuICAgIC8vIGV4cG9uZW50aWF0aW9uIG9wZXJhdG9yICoqIGFuZCAqKj1cbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDcgJiYgY29kZSA9PT0gNDIgJiYgbmV4dCA9PT0gNDIpIHtcbiAgICAgICsrc2l6ZTtcbiAgICAgIHRva2VudHlwZSA9IHR5cGVzJDEuc3RhcnN0YXI7XG4gICAgICBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMik7XG4gICAgfVxuXG4gICAgaWYgKG5leHQgPT09IDYxKSB7IHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEuYXNzaWduLCBzaXplICsgMSkgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE9wKHRva2VudHlwZSwgc2l6ZSlcbiAgfTtcblxuICBwcC5yZWFkVG9rZW5fcGlwZV9hbXAgPSBmdW5jdGlvbihjb2RlKSB7IC8vICd8JidcbiAgICB2YXIgbmV4dCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDEpO1xuICAgIGlmIChuZXh0ID09PSBjb2RlKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDEyKSB7XG4gICAgICAgIHZhciBuZXh0MiA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDIpO1xuICAgICAgICBpZiAobmV4dDIgPT09IDYxKSB7IHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEuYXNzaWduLCAzKSB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hPcChjb2RlID09PSAxMjQgPyB0eXBlcyQxLmxvZ2ljYWxPUiA6IHR5cGVzJDEubG9naWNhbEFORCwgMilcbiAgICB9XG4gICAgaWYgKG5leHQgPT09IDYxKSB7IHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEuYXNzaWduLCAyKSB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoT3AoY29kZSA9PT0gMTI0ID8gdHlwZXMkMS5iaXR3aXNlT1IgOiB0eXBlcyQxLmJpdHdpc2VBTkQsIDEpXG4gIH07XG5cbiAgcHAucmVhZFRva2VuX2NhcmV0ID0gZnVuY3Rpb24oKSB7IC8vICdeJ1xuICAgIHZhciBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSk7XG4gICAgaWYgKG5leHQgPT09IDYxKSB7IHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEuYXNzaWduLCAyKSB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5iaXR3aXNlWE9SLCAxKVxuICB9O1xuXG4gIHBwLnJlYWRUb2tlbl9wbHVzX21pbiA9IGZ1bmN0aW9uKGNvZGUpIHsgLy8gJystJ1xuICAgIHZhciBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSk7XG4gICAgaWYgKG5leHQgPT09IGNvZGUpIHtcbiAgICAgIGlmIChuZXh0ID09PSA0NSAmJiAhdGhpcy5pbk1vZHVsZSAmJiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAyKSA9PT0gNjIgJiZcbiAgICAgICAgICAodGhpcy5sYXN0VG9rRW5kID09PSAwIHx8IGxpbmVCcmVhay50ZXN0KHRoaXMuaW5wdXQuc2xpY2UodGhpcy5sYXN0VG9rRW5kLCB0aGlzLnBvcykpKSkge1xuICAgICAgICAvLyBBIGAtLT5gIGxpbmUgY29tbWVudFxuICAgICAgICB0aGlzLnNraXBMaW5lQ29tbWVudCgzKTtcbiAgICAgICAgdGhpcy5za2lwU3BhY2UoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMubmV4dFRva2VuKClcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEuaW5jRGVjLCAyKVxuICAgIH1cbiAgICBpZiAobmV4dCA9PT0gNjEpIHsgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5hc3NpZ24sIDIpIH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLnBsdXNNaW4sIDEpXG4gIH07XG5cbiAgcHAucmVhZFRva2VuX2x0X2d0ID0gZnVuY3Rpb24oY29kZSkgeyAvLyAnPD4nXG4gICAgdmFyIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKTtcbiAgICB2YXIgc2l6ZSA9IDE7XG4gICAgaWYgKG5leHQgPT09IGNvZGUpIHtcbiAgICAgIHNpemUgPSBjb2RlID09PSA2MiAmJiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAyKSA9PT0gNjIgPyAzIDogMjtcbiAgICAgIGlmICh0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyBzaXplKSA9PT0gNjEpIHsgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5hc3NpZ24sIHNpemUgKyAxKSB9XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLmJpdFNoaWZ0LCBzaXplKVxuICAgIH1cbiAgICBpZiAobmV4dCA9PT0gMzMgJiYgY29kZSA9PT0gNjAgJiYgIXRoaXMuaW5Nb2R1bGUgJiYgdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMikgPT09IDQ1ICYmXG4gICAgICAgIHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDMpID09PSA0NSkge1xuICAgICAgLy8gYDwhLS1gLCBhbiBYTUwtc3R5bGUgY29tbWVudCB0aGF0IHNob3VsZCBiZSBpbnRlcnByZXRlZCBhcyBhIGxpbmUgY29tbWVudFxuICAgICAgdGhpcy5za2lwTGluZUNvbW1lbnQoNCk7XG4gICAgICB0aGlzLnNraXBTcGFjZSgpO1xuICAgICAgcmV0dXJuIHRoaXMubmV4dFRva2VuKClcbiAgICB9XG4gICAgaWYgKG5leHQgPT09IDYxKSB7IHNpemUgPSAyOyB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5yZWxhdGlvbmFsLCBzaXplKVxuICB9O1xuXG4gIHBwLnJlYWRUb2tlbl9lcV9leGNsID0gZnVuY3Rpb24oY29kZSkgeyAvLyAnPSEnXG4gICAgdmFyIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKTtcbiAgICBpZiAobmV4dCA9PT0gNjEpIHsgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5lcXVhbGl0eSwgdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMikgPT09IDYxID8gMyA6IDIpIH1cbiAgICBpZiAoY29kZSA9PT0gNjEgJiYgbmV4dCA9PT0gNjIgJiYgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpIHsgLy8gJz0+J1xuICAgICAgdGhpcy5wb3MgKz0gMjtcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuYXJyb3cpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE9wKGNvZGUgPT09IDYxID8gdHlwZXMkMS5lcSA6IHR5cGVzJDEucHJlZml4LCAxKVxuICB9O1xuXG4gIHBwLnJlYWRUb2tlbl9xdWVzdGlvbiA9IGZ1bmN0aW9uKCkgeyAvLyAnPydcbiAgICB2YXIgZWNtYVZlcnNpb24gPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb247XG4gICAgaWYgKGVjbWFWZXJzaW9uID49IDExKSB7XG4gICAgICB2YXIgbmV4dCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDEpO1xuICAgICAgaWYgKG5leHQgPT09IDQ2KSB7XG4gICAgICAgIHZhciBuZXh0MiA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDIpO1xuICAgICAgICBpZiAobmV4dDIgPCA0OCB8fCBuZXh0MiA+IDU3KSB7IHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEucXVlc3Rpb25Eb3QsIDIpIH1cbiAgICAgIH1cbiAgICAgIGlmIChuZXh0ID09PSA2Mykge1xuICAgICAgICBpZiAoZWNtYVZlcnNpb24gPj0gMTIpIHtcbiAgICAgICAgICB2YXIgbmV4dDIkMSA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDIpO1xuICAgICAgICAgIGlmIChuZXh0MiQxID09PSA2MSkgeyByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLmFzc2lnbiwgMykgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEuY29hbGVzY2UsIDIpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEucXVlc3Rpb24sIDEpXG4gIH07XG5cbiAgcHAucmVhZFRva2VuX251bWJlclNpZ24gPSBmdW5jdGlvbigpIHsgLy8gJyMnXG4gICAgdmFyIGVjbWFWZXJzaW9uID0gdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uO1xuICAgIHZhciBjb2RlID0gMzU7IC8vICcjJ1xuICAgIGlmIChlY21hVmVyc2lvbiA+PSAxMykge1xuICAgICAgKyt0aGlzLnBvcztcbiAgICAgIGNvZGUgPSB0aGlzLmZ1bGxDaGFyQ29kZUF0UG9zKCk7XG4gICAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQoY29kZSwgdHJ1ZSkgfHwgY29kZSA9PT0gOTIgLyogJ1xcJyAqLykge1xuICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLnByaXZhdGVJZCwgdGhpcy5yZWFkV29yZDEoKSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnJhaXNlKHRoaXMucG9zLCBcIlVuZXhwZWN0ZWQgY2hhcmFjdGVyICdcIiArIGNvZGVQb2ludFRvU3RyaW5nKGNvZGUpICsgXCInXCIpO1xuICB9O1xuXG4gIHBwLmdldFRva2VuRnJvbUNvZGUgPSBmdW5jdGlvbihjb2RlKSB7XG4gICAgc3dpdGNoIChjb2RlKSB7XG4gICAgLy8gVGhlIGludGVycHJldGF0aW9uIG9mIGEgZG90IGRlcGVuZHMgb24gd2hldGhlciBpdCBpcyBmb2xsb3dlZFxuICAgIC8vIGJ5IGEgZGlnaXQgb3IgYW5vdGhlciB0d28gZG90cy5cbiAgICBjYXNlIDQ2OiAvLyAnLidcbiAgICAgIHJldHVybiB0aGlzLnJlYWRUb2tlbl9kb3QoKVxuXG4gICAgLy8gUHVuY3R1YXRpb24gdG9rZW5zLlxuICAgIGNhc2UgNDA6ICsrdGhpcy5wb3M7IHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEucGFyZW5MKVxuICAgIGNhc2UgNDE6ICsrdGhpcy5wb3M7IHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEucGFyZW5SKVxuICAgIGNhc2UgNTk6ICsrdGhpcy5wb3M7IHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuc2VtaSlcbiAgICBjYXNlIDQ0OiArK3RoaXMucG9zOyByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLmNvbW1hKVxuICAgIGNhc2UgOTE6ICsrdGhpcy5wb3M7IHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuYnJhY2tldEwpXG4gICAgY2FzZSA5MzogKyt0aGlzLnBvczsgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5icmFja2V0UilcbiAgICBjYXNlIDEyMzogKyt0aGlzLnBvczsgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5icmFjZUwpXG4gICAgY2FzZSAxMjU6ICsrdGhpcy5wb3M7IHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuYnJhY2VSKVxuICAgIGNhc2UgNTg6ICsrdGhpcy5wb3M7IHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuY29sb24pXG5cbiAgICBjYXNlIDk2OiAvLyAnYCdcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPCA2KSB7IGJyZWFrIH1cbiAgICAgICsrdGhpcy5wb3M7XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLmJhY2tRdW90ZSlcblxuICAgIGNhc2UgNDg6IC8vICcwJ1xuICAgICAgdmFyIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKTtcbiAgICAgIGlmIChuZXh0ID09PSAxMjAgfHwgbmV4dCA9PT0gODgpIHsgcmV0dXJuIHRoaXMucmVhZFJhZGl4TnVtYmVyKDE2KSB9IC8vICcweCcsICcwWCcgLSBoZXggbnVtYmVyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpIHtcbiAgICAgICAgaWYgKG5leHQgPT09IDExMSB8fCBuZXh0ID09PSA3OSkgeyByZXR1cm4gdGhpcy5yZWFkUmFkaXhOdW1iZXIoOCkgfSAvLyAnMG8nLCAnME8nIC0gb2N0YWwgbnVtYmVyXG4gICAgICAgIGlmIChuZXh0ID09PSA5OCB8fCBuZXh0ID09PSA2NikgeyByZXR1cm4gdGhpcy5yZWFkUmFkaXhOdW1iZXIoMikgfSAvLyAnMGInLCAnMEInIC0gYmluYXJ5IG51bWJlclxuICAgICAgfVxuXG4gICAgLy8gQW55dGhpbmcgZWxzZSBiZWdpbm5pbmcgd2l0aCBhIGRpZ2l0IGlzIGFuIGludGVnZXIsIG9jdGFsXG4gICAgLy8gbnVtYmVyLCBvciBmbG9hdC5cbiAgICBjYXNlIDQ5OiBjYXNlIDUwOiBjYXNlIDUxOiBjYXNlIDUyOiBjYXNlIDUzOiBjYXNlIDU0OiBjYXNlIDU1OiBjYXNlIDU2OiBjYXNlIDU3OiAvLyAxLTlcbiAgICAgIHJldHVybiB0aGlzLnJlYWROdW1iZXIoZmFsc2UpXG5cbiAgICAvLyBRdW90ZXMgcHJvZHVjZSBzdHJpbmdzLlxuICAgIGNhc2UgMzQ6IGNhc2UgMzk6IC8vICdcIicsIFwiJ1wiXG4gICAgICByZXR1cm4gdGhpcy5yZWFkU3RyaW5nKGNvZGUpXG5cbiAgICAvLyBPcGVyYXRvcnMgYXJlIHBhcnNlZCBpbmxpbmUgaW4gdGlueSBzdGF0ZSBtYWNoaW5lcy4gJz0nICg2MSkgaXNcbiAgICAvLyBvZnRlbiByZWZlcnJlZCB0by4gYGZpbmlzaE9wYCBzaW1wbHkgc2tpcHMgdGhlIGFtb3VudCBvZlxuICAgIC8vIGNoYXJhY3RlcnMgaXQgaXMgZ2l2ZW4gYXMgc2Vjb25kIGFyZ3VtZW50LCBhbmQgcmV0dXJucyBhIHRva2VuXG4gICAgLy8gb2YgdGhlIHR5cGUgZ2l2ZW4gYnkgaXRzIGZpcnN0IGFyZ3VtZW50LlxuICAgIGNhc2UgNDc6IC8vICcvJ1xuICAgICAgcmV0dXJuIHRoaXMucmVhZFRva2VuX3NsYXNoKClcblxuICAgIGNhc2UgMzc6IGNhc2UgNDI6IC8vICclKidcbiAgICAgIHJldHVybiB0aGlzLnJlYWRUb2tlbl9tdWx0X21vZHVsb19leHAoY29kZSlcblxuICAgIGNhc2UgMTI0OiBjYXNlIDM4OiAvLyAnfCYnXG4gICAgICByZXR1cm4gdGhpcy5yZWFkVG9rZW5fcGlwZV9hbXAoY29kZSlcblxuICAgIGNhc2UgOTQ6IC8vICdeJ1xuICAgICAgcmV0dXJuIHRoaXMucmVhZFRva2VuX2NhcmV0KClcblxuICAgIGNhc2UgNDM6IGNhc2UgNDU6IC8vICcrLSdcbiAgICAgIHJldHVybiB0aGlzLnJlYWRUb2tlbl9wbHVzX21pbihjb2RlKVxuXG4gICAgY2FzZSA2MDogY2FzZSA2MjogLy8gJzw+J1xuICAgICAgcmV0dXJuIHRoaXMucmVhZFRva2VuX2x0X2d0KGNvZGUpXG5cbiAgICBjYXNlIDYxOiBjYXNlIDMzOiAvLyAnPSEnXG4gICAgICByZXR1cm4gdGhpcy5yZWFkVG9rZW5fZXFfZXhjbChjb2RlKVxuXG4gICAgY2FzZSA2MzogLy8gJz8nXG4gICAgICByZXR1cm4gdGhpcy5yZWFkVG9rZW5fcXVlc3Rpb24oKVxuXG4gICAgY2FzZSAxMjY6IC8vICd+J1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5wcmVmaXgsIDEpXG5cbiAgICBjYXNlIDM1OiAvLyAnIydcbiAgICAgIHJldHVybiB0aGlzLnJlYWRUb2tlbl9udW1iZXJTaWduKClcbiAgICB9XG5cbiAgICB0aGlzLnJhaXNlKHRoaXMucG9zLCBcIlVuZXhwZWN0ZWQgY2hhcmFjdGVyICdcIiArIGNvZGVQb2ludFRvU3RyaW5nKGNvZGUpICsgXCInXCIpO1xuICB9O1xuXG4gIHBwLmZpbmlzaE9wID0gZnVuY3Rpb24odHlwZSwgc2l6ZSkge1xuICAgIHZhciBzdHIgPSB0aGlzLmlucHV0LnNsaWNlKHRoaXMucG9zLCB0aGlzLnBvcyArIHNpemUpO1xuICAgIHRoaXMucG9zICs9IHNpemU7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZSwgc3RyKVxuICB9O1xuXG4gIHBwLnJlYWRSZWdleHAgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZXNjYXBlZCwgaW5DbGFzcywgc3RhcnQgPSB0aGlzLnBvcztcbiAgICBmb3IgKDs7KSB7XG4gICAgICBpZiAodGhpcy5wb3MgPj0gdGhpcy5pbnB1dC5sZW5ndGgpIHsgdGhpcy5yYWlzZShzdGFydCwgXCJVbnRlcm1pbmF0ZWQgcmVndWxhciBleHByZXNzaW9uXCIpOyB9XG4gICAgICB2YXIgY2ggPSB0aGlzLmlucHV0LmNoYXJBdCh0aGlzLnBvcyk7XG4gICAgICBpZiAobGluZUJyZWFrLnRlc3QoY2gpKSB7IHRoaXMucmFpc2Uoc3RhcnQsIFwiVW50ZXJtaW5hdGVkIHJlZ3VsYXIgZXhwcmVzc2lvblwiKTsgfVxuICAgICAgaWYgKCFlc2NhcGVkKSB7XG4gICAgICAgIGlmIChjaCA9PT0gXCJbXCIpIHsgaW5DbGFzcyA9IHRydWU7IH1cbiAgICAgICAgZWxzZSBpZiAoY2ggPT09IFwiXVwiICYmIGluQ2xhc3MpIHsgaW5DbGFzcyA9IGZhbHNlOyB9XG4gICAgICAgIGVsc2UgaWYgKGNoID09PSBcIi9cIiAmJiAhaW5DbGFzcykgeyBicmVhayB9XG4gICAgICAgIGVzY2FwZWQgPSBjaCA9PT0gXCJcXFxcXCI7XG4gICAgICB9IGVsc2UgeyBlc2NhcGVkID0gZmFsc2U7IH1cbiAgICAgICsrdGhpcy5wb3M7XG4gICAgfVxuICAgIHZhciBwYXR0ZXJuID0gdGhpcy5pbnB1dC5zbGljZShzdGFydCwgdGhpcy5wb3MpO1xuICAgICsrdGhpcy5wb3M7XG4gICAgdmFyIGZsYWdzU3RhcnQgPSB0aGlzLnBvcztcbiAgICB2YXIgZmxhZ3MgPSB0aGlzLnJlYWRXb3JkMSgpO1xuICAgIGlmICh0aGlzLmNvbnRhaW5zRXNjKSB7IHRoaXMudW5leHBlY3RlZChmbGFnc1N0YXJ0KTsgfVxuXG4gICAgLy8gVmFsaWRhdGUgcGF0dGVyblxuICAgIHZhciBzdGF0ZSA9IHRoaXMucmVnZXhwU3RhdGUgfHwgKHRoaXMucmVnZXhwU3RhdGUgPSBuZXcgUmVnRXhwVmFsaWRhdGlvblN0YXRlKHRoaXMpKTtcbiAgICBzdGF0ZS5yZXNldChzdGFydCwgcGF0dGVybiwgZmxhZ3MpO1xuICAgIHRoaXMudmFsaWRhdGVSZWdFeHBGbGFncyhzdGF0ZSk7XG4gICAgdGhpcy52YWxpZGF0ZVJlZ0V4cFBhdHRlcm4oc3RhdGUpO1xuXG4gICAgLy8gQ3JlYXRlIExpdGVyYWwjdmFsdWUgcHJvcGVydHkgdmFsdWUuXG4gICAgdmFyIHZhbHVlID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgdmFsdWUgPSBuZXcgUmVnRXhwKHBhdHRlcm4sIGZsYWdzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBFU1RyZWUgcmVxdWlyZXMgbnVsbCBpZiBpdCBmYWlsZWQgdG8gaW5zdGFudGlhdGUgUmVnRXhwIG9iamVjdC5cbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9lc3RyZWUvZXN0cmVlL2Jsb2IvYTI3MDAzYWRmNGZkN2JmYWQ0NGRlOWNlZjM3MmEyZWFjZDUyN2IxYy9lczUubWQjcmVnZXhwbGl0ZXJhbFxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEucmVnZXhwLCB7cGF0dGVybjogcGF0dGVybiwgZmxhZ3M6IGZsYWdzLCB2YWx1ZTogdmFsdWV9KVxuICB9O1xuXG4gIC8vIFJlYWQgYW4gaW50ZWdlciBpbiB0aGUgZ2l2ZW4gcmFkaXguIFJldHVybiBudWxsIGlmIHplcm8gZGlnaXRzXG4gIC8vIHdlcmUgcmVhZCwgdGhlIGludGVnZXIgdmFsdWUgb3RoZXJ3aXNlLiBXaGVuIGBsZW5gIGlzIGdpdmVuLCB0aGlzXG4gIC8vIHdpbGwgcmV0dXJuIGBudWxsYCB1bmxlc3MgdGhlIGludGVnZXIgaGFzIGV4YWN0bHkgYGxlbmAgZGlnaXRzLlxuXG4gIHBwLnJlYWRJbnQgPSBmdW5jdGlvbihyYWRpeCwgbGVuLCBtYXliZUxlZ2FjeU9jdGFsTnVtZXJpY0xpdGVyYWwpIHtcbiAgICAvLyBgbGVuYCBpcyB1c2VkIGZvciBjaGFyYWN0ZXIgZXNjYXBlIHNlcXVlbmNlcy4gSW4gdGhhdCBjYXNlLCBkaXNhbGxvdyBzZXBhcmF0b3JzLlxuICAgIHZhciBhbGxvd1NlcGFyYXRvcnMgPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTIgJiYgbGVuID09PSB1bmRlZmluZWQ7XG5cbiAgICAvLyBgbWF5YmVMZWdhY3lPY3RhbE51bWVyaWNMaXRlcmFsYCBpcyB0cnVlIGlmIGl0IGRvZXNuJ3QgaGF2ZSBwcmVmaXggKDB4LDBvLDBiKVxuICAgIC8vIGFuZCBpc24ndCBmcmFjdGlvbiBwYXJ0IG5vciBleHBvbmVudCBwYXJ0LiBJbiB0aGF0IGNhc2UsIGlmIHRoZSBmaXJzdCBkaWdpdFxuICAgIC8vIGlzIHplcm8gdGhlbiBkaXNhbGxvdyBzZXBhcmF0b3JzLlxuICAgIHZhciBpc0xlZ2FjeU9jdGFsTnVtZXJpY0xpdGVyYWwgPSBtYXliZUxlZ2FjeU9jdGFsTnVtZXJpY0xpdGVyYWwgJiYgdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKSA9PT0gNDg7XG5cbiAgICB2YXIgc3RhcnQgPSB0aGlzLnBvcywgdG90YWwgPSAwLCBsYXN0Q29kZSA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDAsIGUgPSBsZW4gPT0gbnVsbCA/IEluZmluaXR5IDogbGVuOyBpIDwgZTsgKytpLCArK3RoaXMucG9zKSB7XG4gICAgICB2YXIgY29kZSA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyksIHZhbCA9ICh2b2lkIDApO1xuXG4gICAgICBpZiAoYWxsb3dTZXBhcmF0b3JzICYmIGNvZGUgPT09IDk1KSB7XG4gICAgICAgIGlmIChpc0xlZ2FjeU9jdGFsTnVtZXJpY0xpdGVyYWwpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMucG9zLCBcIk51bWVyaWMgc2VwYXJhdG9yIGlzIG5vdCBhbGxvd2VkIGluIGxlZ2FjeSBvY3RhbCBudW1lcmljIGxpdGVyYWxzXCIpOyB9XG4gICAgICAgIGlmIChsYXN0Q29kZSA9PT0gOTUpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMucG9zLCBcIk51bWVyaWMgc2VwYXJhdG9yIG11c3QgYmUgZXhhY3RseSBvbmUgdW5kZXJzY29yZVwiKTsgfVxuICAgICAgICBpZiAoaSA9PT0gMCkgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5wb3MsIFwiTnVtZXJpYyBzZXBhcmF0b3IgaXMgbm90IGFsbG93ZWQgYXQgdGhlIGZpcnN0IG9mIGRpZ2l0c1wiKTsgfVxuICAgICAgICBsYXN0Q29kZSA9IGNvZGU7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmIChjb2RlID49IDk3KSB7IHZhbCA9IGNvZGUgLSA5NyArIDEwOyB9IC8vIGFcbiAgICAgIGVsc2UgaWYgKGNvZGUgPj0gNjUpIHsgdmFsID0gY29kZSAtIDY1ICsgMTA7IH0gLy8gQVxuICAgICAgZWxzZSBpZiAoY29kZSA+PSA0OCAmJiBjb2RlIDw9IDU3KSB7IHZhbCA9IGNvZGUgLSA0ODsgfSAvLyAwLTlcbiAgICAgIGVsc2UgeyB2YWwgPSBJbmZpbml0eTsgfVxuICAgICAgaWYgKHZhbCA+PSByYWRpeCkgeyBicmVhayB9XG4gICAgICBsYXN0Q29kZSA9IGNvZGU7XG4gICAgICB0b3RhbCA9IHRvdGFsICogcmFkaXggKyB2YWw7XG4gICAgfVxuXG4gICAgaWYgKGFsbG93U2VwYXJhdG9ycyAmJiBsYXN0Q29kZSA9PT0gOTUpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMucG9zIC0gMSwgXCJOdW1lcmljIHNlcGFyYXRvciBpcyBub3QgYWxsb3dlZCBhdCB0aGUgbGFzdCBvZiBkaWdpdHNcIik7IH1cbiAgICBpZiAodGhpcy5wb3MgPT09IHN0YXJ0IHx8IGxlbiAhPSBudWxsICYmIHRoaXMucG9zIC0gc3RhcnQgIT09IGxlbikgeyByZXR1cm4gbnVsbCB9XG5cbiAgICByZXR1cm4gdG90YWxcbiAgfTtcblxuICBmdW5jdGlvbiBzdHJpbmdUb051bWJlcihzdHIsIGlzTGVnYWN5T2N0YWxOdW1lcmljTGl0ZXJhbCkge1xuICAgIGlmIChpc0xlZ2FjeU9jdGFsTnVtZXJpY0xpdGVyYWwpIHtcbiAgICAgIHJldHVybiBwYXJzZUludChzdHIsIDgpXG4gICAgfVxuXG4gICAgLy8gYHBhcnNlRmxvYXQodmFsdWUpYCBzdG9wcyBwYXJzaW5nIGF0IHRoZSBmaXJzdCBudW1lcmljIHNlcGFyYXRvciB0aGVuIHJldHVybnMgYSB3cm9uZyB2YWx1ZS5cbiAgICByZXR1cm4gcGFyc2VGbG9hdChzdHIucmVwbGFjZSgvXy9nLCBcIlwiKSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0cmluZ1RvQmlnSW50KHN0cikge1xuICAgIGlmICh0eXBlb2YgQmlnSW50ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgLy8gYEJpZ0ludCh2YWx1ZSlgIHRocm93cyBzeW50YXggZXJyb3IgaWYgdGhlIHN0cmluZyBjb250YWlucyBudW1lcmljIHNlcGFyYXRvcnMuXG4gICAgcmV0dXJuIEJpZ0ludChzdHIucmVwbGFjZSgvXy9nLCBcIlwiKSlcbiAgfVxuXG4gIHBwLnJlYWRSYWRpeE51bWJlciA9IGZ1bmN0aW9uKHJhZGl4KSB7XG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5wb3M7XG4gICAgdGhpcy5wb3MgKz0gMjsgLy8gMHhcbiAgICB2YXIgdmFsID0gdGhpcy5yZWFkSW50KHJhZGl4KTtcbiAgICBpZiAodmFsID09IG51bGwpIHsgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0ICsgMiwgXCJFeHBlY3RlZCBudW1iZXIgaW4gcmFkaXggXCIgKyByYWRpeCk7IH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDExICYmIHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcykgPT09IDExMCkge1xuICAgICAgdmFsID0gc3RyaW5nVG9CaWdJbnQodGhpcy5pbnB1dC5zbGljZShzdGFydCwgdGhpcy5wb3MpKTtcbiAgICAgICsrdGhpcy5wb3M7XG4gICAgfSBlbHNlIGlmIChpc0lkZW50aWZpZXJTdGFydCh0aGlzLmZ1bGxDaGFyQ29kZUF0UG9zKCkpKSB7IHRoaXMucmFpc2UodGhpcy5wb3MsIFwiSWRlbnRpZmllciBkaXJlY3RseSBhZnRlciBudW1iZXJcIik7IH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLm51bSwgdmFsKVxuICB9O1xuXG4gIC8vIFJlYWQgYW4gaW50ZWdlciwgb2N0YWwgaW50ZWdlciwgb3IgZmxvYXRpbmctcG9pbnQgbnVtYmVyLlxuXG4gIHBwLnJlYWROdW1iZXIgPSBmdW5jdGlvbihzdGFydHNXaXRoRG90KSB7XG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5wb3M7XG4gICAgaWYgKCFzdGFydHNXaXRoRG90ICYmIHRoaXMucmVhZEludCgxMCwgdW5kZWZpbmVkLCB0cnVlKSA9PT0gbnVsbCkgeyB0aGlzLnJhaXNlKHN0YXJ0LCBcIkludmFsaWQgbnVtYmVyXCIpOyB9XG4gICAgdmFyIG9jdGFsID0gdGhpcy5wb3MgLSBzdGFydCA+PSAyICYmIHRoaXMuaW5wdXQuY2hhckNvZGVBdChzdGFydCkgPT09IDQ4O1xuICAgIGlmIChvY3RhbCAmJiB0aGlzLnN0cmljdCkgeyB0aGlzLnJhaXNlKHN0YXJ0LCBcIkludmFsaWQgbnVtYmVyXCIpOyB9XG4gICAgdmFyIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpO1xuICAgIGlmICghb2N0YWwgJiYgIXN0YXJ0c1dpdGhEb3QgJiYgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDExICYmIG5leHQgPT09IDExMCkge1xuICAgICAgdmFyIHZhbCQxID0gc3RyaW5nVG9CaWdJbnQodGhpcy5pbnB1dC5zbGljZShzdGFydCwgdGhpcy5wb3MpKTtcbiAgICAgICsrdGhpcy5wb3M7XG4gICAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQodGhpcy5mdWxsQ2hhckNvZGVBdFBvcygpKSkgeyB0aGlzLnJhaXNlKHRoaXMucG9zLCBcIklkZW50aWZpZXIgZGlyZWN0bHkgYWZ0ZXIgbnVtYmVyXCIpOyB9XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLm51bSwgdmFsJDEpXG4gICAgfVxuICAgIGlmIChvY3RhbCAmJiAvWzg5XS8udGVzdCh0aGlzLmlucHV0LnNsaWNlKHN0YXJ0LCB0aGlzLnBvcykpKSB7IG9jdGFsID0gZmFsc2U7IH1cbiAgICBpZiAobmV4dCA9PT0gNDYgJiYgIW9jdGFsKSB7IC8vICcuJ1xuICAgICAgKyt0aGlzLnBvcztcbiAgICAgIHRoaXMucmVhZEludCgxMCk7XG4gICAgICBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKTtcbiAgICB9XG4gICAgaWYgKChuZXh0ID09PSA2OSB8fCBuZXh0ID09PSAxMDEpICYmICFvY3RhbCkgeyAvLyAnZUUnXG4gICAgICBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KCsrdGhpcy5wb3MpO1xuICAgICAgaWYgKG5leHQgPT09IDQzIHx8IG5leHQgPT09IDQ1KSB7ICsrdGhpcy5wb3M7IH0gLy8gJystJ1xuICAgICAgaWYgKHRoaXMucmVhZEludCgxMCkgPT09IG51bGwpIHsgdGhpcy5yYWlzZShzdGFydCwgXCJJbnZhbGlkIG51bWJlclwiKTsgfVxuICAgIH1cbiAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQodGhpcy5mdWxsQ2hhckNvZGVBdFBvcygpKSkgeyB0aGlzLnJhaXNlKHRoaXMucG9zLCBcIklkZW50aWZpZXIgZGlyZWN0bHkgYWZ0ZXIgbnVtYmVyXCIpOyB9XG5cbiAgICB2YXIgdmFsID0gc3RyaW5nVG9OdW1iZXIodGhpcy5pbnB1dC5zbGljZShzdGFydCwgdGhpcy5wb3MpLCBvY3RhbCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5udW0sIHZhbClcbiAgfTtcblxuICAvLyBSZWFkIGEgc3RyaW5nIHZhbHVlLCBpbnRlcnByZXRpbmcgYmFja3NsYXNoLWVzY2FwZXMuXG5cbiAgcHAucmVhZENvZGVQb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyksIGNvZGU7XG5cbiAgICBpZiAoY2ggPT09IDEyMykgeyAvLyAneydcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPCA2KSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICB2YXIgY29kZVBvcyA9ICsrdGhpcy5wb3M7XG4gICAgICBjb2RlID0gdGhpcy5yZWFkSGV4Q2hhcih0aGlzLmlucHV0LmluZGV4T2YoXCJ9XCIsIHRoaXMucG9zKSAtIHRoaXMucG9zKTtcbiAgICAgICsrdGhpcy5wb3M7XG4gICAgICBpZiAoY29kZSA+IDB4MTBGRkZGKSB7IHRoaXMuaW52YWxpZFN0cmluZ1Rva2VuKGNvZGVQb3MsIFwiQ29kZSBwb2ludCBvdXQgb2YgYm91bmRzXCIpOyB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvZGUgPSB0aGlzLnJlYWRIZXhDaGFyKDQpO1xuICAgIH1cbiAgICByZXR1cm4gY29kZVxuICB9O1xuXG4gIHBwLnJlYWRTdHJpbmcgPSBmdW5jdGlvbihxdW90ZSkge1xuICAgIHZhciBvdXQgPSBcIlwiLCBjaHVua1N0YXJ0ID0gKyt0aGlzLnBvcztcbiAgICBmb3IgKDs7KSB7XG4gICAgICBpZiAodGhpcy5wb3MgPj0gdGhpcy5pbnB1dC5sZW5ndGgpIHsgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCBcIlVudGVybWluYXRlZCBzdHJpbmcgY29uc3RhbnRcIik7IH1cbiAgICAgIHZhciBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyk7XG4gICAgICBpZiAoY2ggPT09IHF1b3RlKSB7IGJyZWFrIH1cbiAgICAgIGlmIChjaCA9PT0gOTIpIHsgLy8gJ1xcJ1xuICAgICAgICBvdXQgKz0gdGhpcy5pbnB1dC5zbGljZShjaHVua1N0YXJ0LCB0aGlzLnBvcyk7XG4gICAgICAgIG91dCArPSB0aGlzLnJlYWRFc2NhcGVkQ2hhcihmYWxzZSk7XG4gICAgICAgIGNodW5rU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgIH0gZWxzZSBpZiAoY2ggPT09IDB4MjAyOCB8fCBjaCA9PT0gMHgyMDI5KSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPCAxMCkgeyB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsIFwiVW50ZXJtaW5hdGVkIHN0cmluZyBjb25zdGFudFwiKTsgfVxuICAgICAgICArK3RoaXMucG9zO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmxvY2F0aW9ucykge1xuICAgICAgICAgIHRoaXMuY3VyTGluZSsrO1xuICAgICAgICAgIHRoaXMubGluZVN0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpc05ld0xpbmUoY2gpKSB7IHRoaXMucmFpc2UodGhpcy5zdGFydCwgXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGNvbnN0YW50XCIpOyB9XG4gICAgICAgICsrdGhpcy5wb3M7XG4gICAgICB9XG4gICAgfVxuICAgIG91dCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKyspO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuc3RyaW5nLCBvdXQpXG4gIH07XG5cbiAgLy8gUmVhZHMgdGVtcGxhdGUgc3RyaW5nIHRva2Vucy5cblxuICB2YXIgSU5WQUxJRF9URU1QTEFURV9FU0NBUEVfRVJST1IgPSB7fTtcblxuICBwcC50cnlSZWFkVGVtcGxhdGVUb2tlbiA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaW5UZW1wbGF0ZUVsZW1lbnQgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnJlYWRUbXBsVG9rZW4oKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIgPT09IElOVkFMSURfVEVNUExBVEVfRVNDQVBFX0VSUk9SKSB7XG4gICAgICAgIHRoaXMucmVhZEludmFsaWRUZW1wbGF0ZVRva2VuKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlcnJcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmluVGVtcGxhdGVFbGVtZW50ID0gZmFsc2U7XG4gIH07XG5cbiAgcHAuaW52YWxpZFN0cmluZ1Rva2VuID0gZnVuY3Rpb24ocG9zaXRpb24sIG1lc3NhZ2UpIHtcbiAgICBpZiAodGhpcy5pblRlbXBsYXRlRWxlbWVudCAmJiB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOSkge1xuICAgICAgdGhyb3cgSU5WQUxJRF9URU1QTEFURV9FU0NBUEVfRVJST1JcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yYWlzZShwb3NpdGlvbiwgbWVzc2FnZSk7XG4gICAgfVxuICB9O1xuXG4gIHBwLnJlYWRUbXBsVG9rZW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgb3V0ID0gXCJcIiwgY2h1bmtTdGFydCA9IHRoaXMucG9zO1xuICAgIGZvciAoOzspIHtcbiAgICAgIGlmICh0aGlzLnBvcyA+PSB0aGlzLmlucHV0Lmxlbmd0aCkgeyB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsIFwiVW50ZXJtaW5hdGVkIHRlbXBsYXRlXCIpOyB9XG4gICAgICB2YXIgY2ggPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpO1xuICAgICAgaWYgKGNoID09PSA5NiB8fCBjaCA9PT0gMzYgJiYgdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSkgPT09IDEyMykgeyAvLyAnYCcsICckeydcbiAgICAgICAgaWYgKHRoaXMucG9zID09PSB0aGlzLnN0YXJ0ICYmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEudGVtcGxhdGUgfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLmludmFsaWRUZW1wbGF0ZSkpIHtcbiAgICAgICAgICBpZiAoY2ggPT09IDM2KSB7XG4gICAgICAgICAgICB0aGlzLnBvcyArPSAyO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5kb2xsYXJCcmFjZUwpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLmJhY2tRdW90ZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb3V0ICs9IHRoaXMuaW5wdXQuc2xpY2UoY2h1bmtTdGFydCwgdGhpcy5wb3MpO1xuICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLnRlbXBsYXRlLCBvdXQpXG4gICAgICB9XG4gICAgICBpZiAoY2ggPT09IDkyKSB7IC8vICdcXCdcbiAgICAgICAgb3V0ICs9IHRoaXMuaW5wdXQuc2xpY2UoY2h1bmtTdGFydCwgdGhpcy5wb3MpO1xuICAgICAgICBvdXQgKz0gdGhpcy5yZWFkRXNjYXBlZENoYXIodHJ1ZSk7XG4gICAgICAgIGNodW5rU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgIH0gZWxzZSBpZiAoaXNOZXdMaW5lKGNoKSkge1xuICAgICAgICBvdXQgKz0gdGhpcy5pbnB1dC5zbGljZShjaHVua1N0YXJ0LCB0aGlzLnBvcyk7XG4gICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgIHN3aXRjaCAoY2gpIHtcbiAgICAgICAgY2FzZSAxMzpcbiAgICAgICAgICBpZiAodGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKSA9PT0gMTApIHsgKyt0aGlzLnBvczsgfVxuICAgICAgICBjYXNlIDEwOlxuICAgICAgICAgIG91dCArPSBcIlxcblwiO1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgb3V0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoY2gpO1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5sb2NhdGlvbnMpIHtcbiAgICAgICAgICArK3RoaXMuY3VyTGluZTtcbiAgICAgICAgICB0aGlzLmxpbmVTdGFydCA9IHRoaXMucG9zO1xuICAgICAgICB9XG4gICAgICAgIGNodW5rU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICsrdGhpcy5wb3M7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8vIFJlYWRzIGEgdGVtcGxhdGUgdG9rZW4gdG8gc2VhcmNoIGZvciB0aGUgZW5kLCB3aXRob3V0IHZhbGlkYXRpbmcgYW55IGVzY2FwZSBzZXF1ZW5jZXNcbiAgcHAucmVhZEludmFsaWRUZW1wbGF0ZVRva2VuID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICg7IHRoaXMucG9zIDwgdGhpcy5pbnB1dC5sZW5ndGg7IHRoaXMucG9zKyspIHtcbiAgICAgIHN3aXRjaCAodGhpcy5pbnB1dFt0aGlzLnBvc10pIHtcbiAgICAgIGNhc2UgXCJcXFxcXCI6XG4gICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgXCIkXCI6XG4gICAgICAgIGlmICh0aGlzLmlucHV0W3RoaXMucG9zICsgMV0gIT09IFwie1wiKSB7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuXG4gICAgICAvLyBmYWxscyB0aHJvdWdoXG4gICAgICBjYXNlIFwiYFwiOlxuICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLmludmFsaWRUZW1wbGF0ZSwgdGhpcy5pbnB1dC5zbGljZSh0aGlzLnN0YXJ0LCB0aGlzLnBvcykpXG5cbiAgICAgIC8vIG5vIGRlZmF1bHRcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCBcIlVudGVybWluYXRlZCB0ZW1wbGF0ZVwiKTtcbiAgfTtcblxuICAvLyBVc2VkIHRvIHJlYWQgZXNjYXBlZCBjaGFyYWN0ZXJzXG5cbiAgcHAucmVhZEVzY2FwZWRDaGFyID0gZnVuY3Rpb24oaW5UZW1wbGF0ZSkge1xuICAgIHZhciBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCgrK3RoaXMucG9zKTtcbiAgICArK3RoaXMucG9zO1xuICAgIHN3aXRjaCAoY2gpIHtcbiAgICBjYXNlIDExMDogcmV0dXJuIFwiXFxuXCIgLy8gJ24nIC0+ICdcXG4nXG4gICAgY2FzZSAxMTQ6IHJldHVybiBcIlxcclwiIC8vICdyJyAtPiAnXFxyJ1xuICAgIGNhc2UgMTIwOiByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnJlYWRIZXhDaGFyKDIpKSAvLyAneCdcbiAgICBjYXNlIDExNzogcmV0dXJuIGNvZGVQb2ludFRvU3RyaW5nKHRoaXMucmVhZENvZGVQb2ludCgpKSAvLyAndSdcbiAgICBjYXNlIDExNjogcmV0dXJuIFwiXFx0XCIgLy8gJ3QnIC0+ICdcXHQnXG4gICAgY2FzZSA5ODogcmV0dXJuIFwiXFxiXCIgLy8gJ2InIC0+ICdcXGInXG4gICAgY2FzZSAxMTg6IHJldHVybiBcIlxcdTAwMGJcIiAvLyAndicgLT4gJ1xcdTAwMGInXG4gICAgY2FzZSAxMDI6IHJldHVybiBcIlxcZlwiIC8vICdmJyAtPiAnXFxmJ1xuICAgIGNhc2UgMTM6IGlmICh0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpID09PSAxMCkgeyArK3RoaXMucG9zOyB9IC8vICdcXHJcXG4nXG4gICAgY2FzZSAxMDogLy8gJyBcXG4nXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmxvY2F0aW9ucykgeyB0aGlzLmxpbmVTdGFydCA9IHRoaXMucG9zOyArK3RoaXMuY3VyTGluZTsgfVxuICAgICAgcmV0dXJuIFwiXCJcbiAgICBjYXNlIDU2OlxuICAgIGNhc2UgNTc6XG4gICAgICBpZiAodGhpcy5zdHJpY3QpIHtcbiAgICAgICAgdGhpcy5pbnZhbGlkU3RyaW5nVG9rZW4oXG4gICAgICAgICAgdGhpcy5wb3MgLSAxLFxuICAgICAgICAgIFwiSW52YWxpZCBlc2NhcGUgc2VxdWVuY2VcIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKGluVGVtcGxhdGUpIHtcbiAgICAgICAgdmFyIGNvZGVQb3MgPSB0aGlzLnBvcyAtIDE7XG5cbiAgICAgICAgdGhpcy5pbnZhbGlkU3RyaW5nVG9rZW4oXG4gICAgICAgICAgY29kZVBvcyxcbiAgICAgICAgICBcIkludmFsaWQgZXNjYXBlIHNlcXVlbmNlIGluIHRlbXBsYXRlIHN0cmluZ1wiXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgZGVmYXVsdDpcbiAgICAgIGlmIChjaCA+PSA0OCAmJiBjaCA8PSA1NSkge1xuICAgICAgICB2YXIgb2N0YWxTdHIgPSB0aGlzLmlucHV0LnN1YnN0cih0aGlzLnBvcyAtIDEsIDMpLm1hdGNoKC9eWzAtN10rLylbMF07XG4gICAgICAgIHZhciBvY3RhbCA9IHBhcnNlSW50KG9jdGFsU3RyLCA4KTtcbiAgICAgICAgaWYgKG9jdGFsID4gMjU1KSB7XG4gICAgICAgICAgb2N0YWxTdHIgPSBvY3RhbFN0ci5zbGljZSgwLCAtMSk7XG4gICAgICAgICAgb2N0YWwgPSBwYXJzZUludChvY3RhbFN0ciwgOCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wb3MgKz0gb2N0YWxTdHIubGVuZ3RoIC0gMTtcbiAgICAgICAgY2ggPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpO1xuICAgICAgICBpZiAoKG9jdGFsU3RyICE9PSBcIjBcIiB8fCBjaCA9PT0gNTYgfHwgY2ggPT09IDU3KSAmJiAodGhpcy5zdHJpY3QgfHwgaW5UZW1wbGF0ZSkpIHtcbiAgICAgICAgICB0aGlzLmludmFsaWRTdHJpbmdUb2tlbihcbiAgICAgICAgICAgIHRoaXMucG9zIC0gMSAtIG9jdGFsU3RyLmxlbmd0aCxcbiAgICAgICAgICAgIGluVGVtcGxhdGVcbiAgICAgICAgICAgICAgPyBcIk9jdGFsIGxpdGVyYWwgaW4gdGVtcGxhdGUgc3RyaW5nXCJcbiAgICAgICAgICAgICAgOiBcIk9jdGFsIGxpdGVyYWwgaW4gc3RyaWN0IG1vZGVcIlxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUob2N0YWwpXG4gICAgICB9XG4gICAgICBpZiAoaXNOZXdMaW5lKGNoKSkge1xuICAgICAgICAvLyBVbmljb2RlIG5ldyBsaW5lIGNoYXJhY3RlcnMgYWZ0ZXIgXFwgZ2V0IHJlbW92ZWQgZnJvbSBvdXRwdXQgaW4gYm90aFxuICAgICAgICAvLyB0ZW1wbGF0ZSBsaXRlcmFscyBhbmQgc3RyaW5nc1xuICAgICAgICByZXR1cm4gXCJcIlxuICAgICAgfVxuICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoY2gpXG4gICAgfVxuICB9O1xuXG4gIC8vIFVzZWQgdG8gcmVhZCBjaGFyYWN0ZXIgZXNjYXBlIHNlcXVlbmNlcyAoJ1xceCcsICdcXHUnLCAnXFxVJykuXG5cbiAgcHAucmVhZEhleENoYXIgPSBmdW5jdGlvbihsZW4pIHtcbiAgICB2YXIgY29kZVBvcyA9IHRoaXMucG9zO1xuICAgIHZhciBuID0gdGhpcy5yZWFkSW50KDE2LCBsZW4pO1xuICAgIGlmIChuID09PSBudWxsKSB7IHRoaXMuaW52YWxpZFN0cmluZ1Rva2VuKGNvZGVQb3MsIFwiQmFkIGNoYXJhY3RlciBlc2NhcGUgc2VxdWVuY2VcIik7IH1cbiAgICByZXR1cm4gblxuICB9O1xuXG4gIC8vIFJlYWQgYW4gaWRlbnRpZmllciwgYW5kIHJldHVybiBpdCBhcyBhIHN0cmluZy4gU2V0cyBgdGhpcy5jb250YWluc0VzY2BcbiAgLy8gdG8gd2hldGhlciB0aGUgd29yZCBjb250YWluZWQgYSAnXFx1JyBlc2NhcGUuXG4gIC8vXG4gIC8vIEluY3JlbWVudGFsbHkgYWRkcyBvbmx5IGVzY2FwZWQgY2hhcnMsIGFkZGluZyBvdGhlciBjaHVua3MgYXMtaXNcbiAgLy8gYXMgYSBtaWNyby1vcHRpbWl6YXRpb24uXG5cbiAgcHAucmVhZFdvcmQxID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jb250YWluc0VzYyA9IGZhbHNlO1xuICAgIHZhciB3b3JkID0gXCJcIiwgZmlyc3QgPSB0cnVlLCBjaHVua1N0YXJ0ID0gdGhpcy5wb3M7XG4gICAgdmFyIGFzdHJhbCA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2O1xuICAgIHdoaWxlICh0aGlzLnBvcyA8IHRoaXMuaW5wdXQubGVuZ3RoKSB7XG4gICAgICB2YXIgY2ggPSB0aGlzLmZ1bGxDaGFyQ29kZUF0UG9zKCk7XG4gICAgICBpZiAoaXNJZGVudGlmaWVyQ2hhcihjaCwgYXN0cmFsKSkge1xuICAgICAgICB0aGlzLnBvcyArPSBjaCA8PSAweGZmZmYgPyAxIDogMjtcbiAgICAgIH0gZWxzZSBpZiAoY2ggPT09IDkyKSB7IC8vIFwiXFxcIlxuICAgICAgICB0aGlzLmNvbnRhaW5zRXNjID0gdHJ1ZTtcbiAgICAgICAgd29yZCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKTtcbiAgICAgICAgdmFyIGVzY1N0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICAgIGlmICh0aGlzLmlucHV0LmNoYXJDb2RlQXQoKyt0aGlzLnBvcykgIT09IDExNykgLy8gXCJ1XCJcbiAgICAgICAgICB7IHRoaXMuaW52YWxpZFN0cmluZ1Rva2VuKHRoaXMucG9zLCBcIkV4cGVjdGluZyBVbmljb2RlIGVzY2FwZSBzZXF1ZW5jZSBcXFxcdVhYWFhcIik7IH1cbiAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgICAgdmFyIGVzYyA9IHRoaXMucmVhZENvZGVQb2ludCgpO1xuICAgICAgICBpZiAoIShmaXJzdCA/IGlzSWRlbnRpZmllclN0YXJ0IDogaXNJZGVudGlmaWVyQ2hhcikoZXNjLCBhc3RyYWwpKVxuICAgICAgICAgIHsgdGhpcy5pbnZhbGlkU3RyaW5nVG9rZW4oZXNjU3RhcnQsIFwiSW52YWxpZCBVbmljb2RlIGVzY2FwZVwiKTsgfVxuICAgICAgICB3b3JkICs9IGNvZGVQb2ludFRvU3RyaW5nKGVzYyk7XG4gICAgICAgIGNodW5rU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBmaXJzdCA9IGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gd29yZCArIHRoaXMuaW5wdXQuc2xpY2UoY2h1bmtTdGFydCwgdGhpcy5wb3MpXG4gIH07XG5cbiAgLy8gUmVhZCBhbiBpZGVudGlmaWVyIG9yIGtleXdvcmQgdG9rZW4uIFdpbGwgY2hlY2sgZm9yIHJlc2VydmVkXG4gIC8vIHdvcmRzIHdoZW4gbmVjZXNzYXJ5LlxuXG4gIHBwLnJlYWRXb3JkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHdvcmQgPSB0aGlzLnJlYWRXb3JkMSgpO1xuICAgIHZhciB0eXBlID0gdHlwZXMkMS5uYW1lO1xuICAgIGlmICh0aGlzLmtleXdvcmRzLnRlc3Qod29yZCkpIHtcbiAgICAgIHR5cGUgPSBrZXl3b3Jkc1t3b3JkXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZSwgd29yZClcbiAgfTtcblxuICAvLyBBY29ybiBpcyBhIHRpbnksIGZhc3QgSmF2YVNjcmlwdCBwYXJzZXIgd3JpdHRlbiBpbiBKYXZhU2NyaXB0LlxuICAvL1xuICAvLyBBY29ybiB3YXMgd3JpdHRlbiBieSBNYXJpam4gSGF2ZXJiZWtlLCBJbmd2YXIgU3RlcGFueWFuLCBhbmRcbiAgLy8gdmFyaW91cyBjb250cmlidXRvcnMgYW5kIHJlbGVhc2VkIHVuZGVyIGFuIE1JVCBsaWNlbnNlLlxuICAvL1xuICAvLyBHaXQgcmVwb3NpdG9yaWVzIGZvciBBY29ybiBhcmUgYXZhaWxhYmxlIGF0XG4gIC8vXG4gIC8vICAgICBodHRwOi8vbWFyaWpuaGF2ZXJiZWtlLm5sL2dpdC9hY29yblxuICAvLyAgICAgaHR0cHM6Ly9naXRodWIuY29tL2Fjb3JuanMvYWNvcm4uZ2l0XG4gIC8vXG4gIC8vIFBsZWFzZSB1c2UgdGhlIFtnaXRodWIgYnVnIHRyYWNrZXJdW2doYnRdIHRvIHJlcG9ydCBpc3N1ZXMuXG4gIC8vXG4gIC8vIFtnaGJ0XTogaHR0cHM6Ly9naXRodWIuY29tL2Fjb3JuanMvYWNvcm4vaXNzdWVzXG4gIC8vXG4gIC8vIFt3YWxrXTogdXRpbC93YWxrLmpzXG5cblxuICB2YXIgdmVyc2lvbiA9IFwiOC4xMC4wXCI7XG5cbiAgUGFyc2VyLmFjb3JuID0ge1xuICAgIFBhcnNlcjogUGFyc2VyLFxuICAgIHZlcnNpb246IHZlcnNpb24sXG4gICAgZGVmYXVsdE9wdGlvbnM6IGRlZmF1bHRPcHRpb25zLFxuICAgIFBvc2l0aW9uOiBQb3NpdGlvbixcbiAgICBTb3VyY2VMb2NhdGlvbjogU291cmNlTG9jYXRpb24sXG4gICAgZ2V0TGluZUluZm86IGdldExpbmVJbmZvLFxuICAgIE5vZGU6IE5vZGUsXG4gICAgVG9rZW5UeXBlOiBUb2tlblR5cGUsXG4gICAgdG9rVHlwZXM6IHR5cGVzJDEsXG4gICAga2V5d29yZFR5cGVzOiBrZXl3b3JkcyxcbiAgICBUb2tDb250ZXh0OiBUb2tDb250ZXh0LFxuICAgIHRva0NvbnRleHRzOiB0eXBlcyxcbiAgICBpc0lkZW50aWZpZXJDaGFyOiBpc0lkZW50aWZpZXJDaGFyLFxuICAgIGlzSWRlbnRpZmllclN0YXJ0OiBpc0lkZW50aWZpZXJTdGFydCxcbiAgICBUb2tlbjogVG9rZW4sXG4gICAgaXNOZXdMaW5lOiBpc05ld0xpbmUsXG4gICAgbGluZUJyZWFrOiBsaW5lQnJlYWssXG4gICAgbGluZUJyZWFrRzogbGluZUJyZWFrRyxcbiAgICBub25BU0NJSXdoaXRlc3BhY2U6IG5vbkFTQ0lJd2hpdGVzcGFjZVxuICB9O1xuXG4gIC8vIFRoZSBtYWluIGV4cG9ydGVkIGludGVyZmFjZSAodW5kZXIgYHNlbGYuYWNvcm5gIHdoZW4gaW4gdGhlXG4gIC8vIGJyb3dzZXIpIGlzIGEgYHBhcnNlYCBmdW5jdGlvbiB0aGF0IHRha2VzIGEgY29kZSBzdHJpbmcgYW5kXG4gIC8vIHJldHVybnMgYW4gYWJzdHJhY3Qgc3ludGF4IHRyZWUgYXMgc3BlY2lmaWVkIGJ5IFtNb3ppbGxhIHBhcnNlclxuICAvLyBBUEldW2FwaV0uXG4gIC8vXG4gIC8vIFthcGldOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1NwaWRlck1vbmtleS9QYXJzZXJfQVBJXG5cbiAgZnVuY3Rpb24gcGFyc2UoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gUGFyc2VyLnBhcnNlKGlucHV0LCBvcHRpb25zKVxuICB9XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiB0cmllcyB0byBwYXJzZSBhIHNpbmdsZSBleHByZXNzaW9uIGF0IGEgZ2l2ZW5cbiAgLy8gb2Zmc2V0IGluIGEgc3RyaW5nLiBVc2VmdWwgZm9yIHBhcnNpbmcgbWl4ZWQtbGFuZ3VhZ2UgZm9ybWF0c1xuICAvLyB0aGF0IGVtYmVkIEphdmFTY3JpcHQgZXhwcmVzc2lvbnMuXG5cbiAgZnVuY3Rpb24gcGFyc2VFeHByZXNzaW9uQXQoaW5wdXQsIHBvcywgb3B0aW9ucykge1xuICAgIHJldHVybiBQYXJzZXIucGFyc2VFeHByZXNzaW9uQXQoaW5wdXQsIHBvcywgb3B0aW9ucylcbiAgfVxuXG4gIC8vIEFjb3JuIGlzIG9yZ2FuaXplZCBhcyBhIHRva2VuaXplciBhbmQgYSByZWN1cnNpdmUtZGVzY2VudCBwYXJzZXIuXG4gIC8vIFRoZSBgdG9rZW5pemVyYCBleHBvcnQgcHJvdmlkZXMgYW4gaW50ZXJmYWNlIHRvIHRoZSB0b2tlbml6ZXIuXG5cbiAgZnVuY3Rpb24gdG9rZW5pemVyKGlucHV0LCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIFBhcnNlci50b2tlbml6ZXIoaW5wdXQsIG9wdGlvbnMpXG4gIH1cblxuICBleHBvcnRzLk5vZGUgPSBOb2RlO1xuICBleHBvcnRzLlBhcnNlciA9IFBhcnNlcjtcbiAgZXhwb3J0cy5Qb3NpdGlvbiA9IFBvc2l0aW9uO1xuICBleHBvcnRzLlNvdXJjZUxvY2F0aW9uID0gU291cmNlTG9jYXRpb247XG4gIGV4cG9ydHMuVG9rQ29udGV4dCA9IFRva0NvbnRleHQ7XG4gIGV4cG9ydHMuVG9rZW4gPSBUb2tlbjtcbiAgZXhwb3J0cy5Ub2tlblR5cGUgPSBUb2tlblR5cGU7XG4gIGV4cG9ydHMuZGVmYXVsdE9wdGlvbnMgPSBkZWZhdWx0T3B0aW9ucztcbiAgZXhwb3J0cy5nZXRMaW5lSW5mbyA9IGdldExpbmVJbmZvO1xuICBleHBvcnRzLmlzSWRlbnRpZmllckNoYXIgPSBpc0lkZW50aWZpZXJDaGFyO1xuICBleHBvcnRzLmlzSWRlbnRpZmllclN0YXJ0ID0gaXNJZGVudGlmaWVyU3RhcnQ7XG4gIGV4cG9ydHMuaXNOZXdMaW5lID0gaXNOZXdMaW5lO1xuICBleHBvcnRzLmtleXdvcmRUeXBlcyA9IGtleXdvcmRzO1xuICBleHBvcnRzLmxpbmVCcmVhayA9IGxpbmVCcmVhaztcbiAgZXhwb3J0cy5saW5lQnJlYWtHID0gbGluZUJyZWFrRztcbiAgZXhwb3J0cy5ub25BU0NJSXdoaXRlc3BhY2UgPSBub25BU0NJSXdoaXRlc3BhY2U7XG4gIGV4cG9ydHMucGFyc2UgPSBwYXJzZTtcbiAgZXhwb3J0cy5wYXJzZUV4cHJlc3Npb25BdCA9IHBhcnNlRXhwcmVzc2lvbkF0O1xuICBleHBvcnRzLnRva0NvbnRleHRzID0gdHlwZXM7XG4gIGV4cG9ydHMudG9rVHlwZXMgPSB0eXBlcyQxO1xuICBleHBvcnRzLnRva2VuaXplciA9IHRva2VuaXplcjtcbiAgZXhwb3J0cy52ZXJzaW9uID0gdmVyc2lvbjtcblxufSkpO1xuIiwiXG5pbXBvcnQgTW9kdWxlIGZyb20gJy4vTW9kdWxlJ1xuaW1wb3J0IFV0aWxzIGZyb20gJy4vdXRpbHMvaW5kZXgnXG5pbXBvcnQgSU5hdGl2ZSBmcm9tICcuL0lOYXRpdmUnXG5pbXBvcnQgQ3JlYXR1cmUgZnJvbSAnLi9DcmVhdHVyZSdcbmltcG9ydCBCYXNlRWxlbWVudCBmcm9tICcuL2VsZW1lbnRzL0Jhc2VFbGVtZW50J1xuXG5leHBvcnQgY2xhc3MgUnVubmFibGUge1xuXG4gICAgcm9vdDogQmFzZUVsZW1lbnRcbiAgICBtb3VudDogKCkgPT4gdm9pZFxuXG4gICAgY29uc3RydWN0b3Iocm9vdDogQmFzZUVsZW1lbnQsIG1vdW50OiAoKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMucm9vdCA9IHJvb3RcbiAgICAgICAgdGhpcy5tb3VudCA9IG1vdW50XG4gICAgfVxufVxuXG5jbGFzcyBBcHBsZXQge1xuXG4gICAgX2tleTogc3RyaW5nXG4gICAgcHVibGljIGdldCBrZXkoKSB7IHJldHVybiB0aGlzLl9rZXkgfVxuXG4gICAgX2dlbmVzaXNDcmVhdHVyZTogQ3JlYXR1cmVcblxuICAgIF9uYXRpdmVCdWlsZGVyOiAobW9kOiBNb2R1bGUpID0+IElOYXRpdmVcblxuICAgIHByaXZhdGUgX21vZHVsZXM6IHsgW2lkOiBzdHJpbmddOiBNb2R1bGUgfVxuICAgIHB1YmxpYyBmaW5kTW9kdWxlKGlkOiBzdHJpbmcpIHsgcmV0dXJuIHRoaXMuX21vZHVsZXNbaWRdIH1cbiAgICBwdWJsaWMgcHV0TW9kdWxlKG1vZHVsZTogTW9kdWxlKSB7XG4gICAgICAgIG1vZHVsZS5zZXRBcHBsZXQodGhpcylcbiAgICAgICAgdGhpcy5fbW9kdWxlc1ttb2R1bGUua2V5XSA9IG1vZHVsZVxuICAgIH1cbiAgICBwdWJsaWMgcmVtb3ZlTW9kdWxlKGtleTogc3RyaW5nKSB7IGRlbGV0ZSB0aGlzLl9tb2R1bGVzW2tleV0gfVxuXG4gICAgbWlkZGxlQ29kZTogYW55XG5cbiAgICBwdWJsaWMgZmlsbChqc3hDb2RlOiBhbnkpIHtcbiAgICAgICAgdGhpcy5taWRkbGVDb2RlID0gVXRpbHMuY29tcGlsZXIucGFyc2UoanN4Q29kZSlcbiAgICAgICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkodGhpcy5taWRkbGVDb2RlKSlcbiAgICAgICAgbGV0IHIgPSBVdGlscy5jb21waWxlci5leHRyYWN0TW9kdWxlcyh0aGlzLm1pZGRsZUNvZGUsIHRoaXMpO1xuICAgICAgICByLmZvckVhY2goKG1vZHVsZTogTW9kdWxlKSA9PiB0aGlzLnB1dE1vZHVsZShtb2R1bGUpKVxuICAgIH1cblxuICAgIGNhY2hlID0ge1xuICAgICAgICBlbGVtZW50czoge30sXG4gICAgICAgIG1vdW50czogW11cbiAgICB9XG5cbiAgICBvbGRWZXJzaW9ucyA9IHt9XG5cbiAgICBvbkNyZWF0dXJlU3RhdGVDaGFuZ2UoY3JlYXR1cmU6IENyZWF0dXJlLCBuZXdWZXJzaW9uOiBCYXNlRWxlbWVudCkge1xuICAgICAgICBsZXQgb2xkVmVyc2lvbiA9IHRoaXMub2xkVmVyc2lvbnNbY3JlYXR1cmUuX2tleV1cbiAgICAgICAgdGhpcy5vbGRWZXJzaW9uc1tjcmVhdHVyZS5fa2V5XSA9IG5ld1ZlcnNpb25cbiAgICAgICAgbGV0IHVwZGF0ZXMgPSBVdGlscy5qc29uLmRpZmYob2xkVmVyc2lvbiwgbmV3VmVyc2lvbilcbiAgICAgICAgdXBkYXRlcy5mb3JFYWNoKCh1OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmICh1Ll9fYWN0aW9uX18gPT09ICdlbGVtZW50X2RlbGV0ZWQnKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuY2FjaGUuZWxlbWVudHNbdS5fX2tleV9fXVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLnVwZGF0ZShvbGRWZXJzaW9uLl9rZXksIHVwZGF0ZXMpXG4gICAgfVxuXG4gICAgdXBkYXRlOiAoa2V5OiBzdHJpbmcsIHU6IGFueSkgPT4gdm9pZFxuICAgIGZpcnN0TW91bnQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIHB1YmxpYyBydW4oZ2VuZXNpczogc3RyaW5nLCBuYXRpdmVCdWlsZGVyOiAobW9kOiBNb2R1bGUpID0+IElOYXRpdmUsIHVwZGF0ZTogKGtleTogc3RyaW5nLCB1OiBhbnkpID0+IHZvaWQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgdGhpcy5fbmF0aXZlQnVpbGRlciA9IG5hdGl2ZUJ1aWxkZXJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlID0gdXBkYXRlXG4gICAgICAgICAgICB0aGlzLmZpcnN0TW91bnQgPSBmYWxzZVxuICAgICAgICAgICAgdGhpcy5jYWNoZS5lbGVtZW50cyA9IHt9XG4gICAgICAgICAgICB0aGlzLmNhY2hlLm1vdW50cyA9IFtdXG4gICAgICAgICAgICBsZXQgZ2VuZXNpc01vZCA9IHRoaXMuX21vZHVsZXNbZ2VuZXNpc11cbiAgICAgICAgICAgIHRoaXMuX2dlbmVzaXNDcmVhdHVyZSA9IGdlbmVzaXNNb2QuaW5zdGFudGlhdGUoKVxuICAgICAgICAgICAgbGV0IGdlbmVzaXNNZXRhQ29udGV4dCA9IFV0aWxzLmdlbmVyYXRvci5uZXN0ZWRDb250ZXh0KHRoaXMuX2dlbmVzaXNDcmVhdHVyZSlcbiAgICAgICAgICAgIHRoaXMuY2FjaGUubW91bnRzLnB1c2goKCkgPT4gdGhpcy5fZ2VuZXNpc0NyZWF0dXJlLmdldEJhc2VNZXRob2QoJ29uTW91bnQnKShnZW5lc2lzTWV0YUNvbnRleHQpKVxuICAgICAgICAgICAgdGhpcy5fZ2VuZXNpc0NyZWF0dXJlLmdldEJhc2VNZXRob2QoJ2NvbnN0cnVjdG9yJykoZ2VuZXNpc01ldGFDb250ZXh0KVxuICAgICAgICAgICAgbGV0IHZpZXcgPSB0aGlzLl9nZW5lc2lzQ3JlYXR1cmUuZ2V0QmFzZU1ldGhvZCgncmVuZGVyJykoZ2VuZXNpc01ldGFDb250ZXh0KVxuICAgICAgICAgICAgdGhpcy5vbGRWZXJzaW9uc1t0aGlzLl9nZW5lc2lzQ3JlYXR1cmUuX2tleV0gPSB2aWV3XG4gICAgICAgICAgICByZXNvbHZlKFxuICAgICAgICAgICAgICAgIG5ldyBSdW5uYWJsZShcbiAgICAgICAgICAgICAgICAgICAgdmlldyxcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJzdE1vdW50ID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jYWNoZS5tb3VudHMucmV2ZXJzZSgpLmZvckVhY2goKG9uTW91bnQ6IGFueSkgPT4gb25Nb3VudCgpKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKGtleTogc3RyaW5nLCBtb2R1bGVzPzogeyBbaWQ6IHN0cmluZ106IE1vZHVsZSB9KSB7XG4gICAgICAgIHRoaXMuX2tleSA9IGtleVxuICAgICAgICB0aGlzLl9tb2R1bGVzID0gbW9kdWxlcyA/IG1vZHVsZXMgOiB7fVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXBwbGV0XG4iLCJcbmltcG9ydCBET00gZnJvbSBcIi4vRE9NXCJcbmltcG9ydCBFeGVjdXRpb25NZXRhIGZyb20gXCIuL0V4ZWN1dGlvbk1ldGFcIlxuaW1wb3J0IE1vZHVsZSBmcm9tIFwiLi9Nb2R1bGVcIlxuaW1wb3J0IFJ1bnRpbWUgZnJvbSBcIi4vUnVudGltZVwiXG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSBcIi4vZWxlbWVudHMvQmFzZUVsZW1lbnRcIlxuaW1wb3J0IFV0aWxzIGZyb20gJy4vdXRpbHMnXG5cbmNsYXNzIENyZWF0dXJlIHtcblxuICAgIHB1YmxpYyBfa2V5OiBzdHJpbmdcbiAgICBwdWJsaWMgZ2V0IGtleSgpIHsgcmV0dXJuIHRoaXMuX2tleSB9XG5cbiAgICBwcml2YXRlIF9jb3Ntb0lkOiBzdHJpbmdcbiAgICBwdWJsaWMgZ2V0IGNvc21vSWQoKSB7IHJldHVybiB0aGlzLl9jb3Ntb0lkIH1cbiAgICBwdWJsaWMgc2V0Q29zbW9JZChjb3Ntb0lkOiBzdHJpbmcpIHsgdGhpcy5fY29zbW9JZCA9IGNvc21vSWQgfVxuXG4gICAgcHJpdmF0ZSBfbW9kdWxlOiBNb2R1bGVcbiAgICBwdWJsaWMgZ2V0IG1vZHVsZSgpIHsgcmV0dXJuIHRoaXMuX21vZHVsZSB9XG5cbiAgICBwdWJsaWMgX3J1bnRpbWU6IFJ1bnRpbWVcbiAgICBwdWJsaWMgZ2V0IHJ1bnRpbWUoKSB7IHJldHVybiB0aGlzLl9ydW50aW1lIH1cblxuICAgIHB1YmxpYyBfZG9tOiBET01cbiAgICBwdWJsaWMgZ2V0IGRvbSgpIHsgcmV0dXJuIHRoaXMuX2RvbSB9XG5cbiAgICBwdWJsaWMgdGhpc09iajogeyBbaWQ6IHN0cmluZ106IGFueSB9XG5cbiAgICBwdWJsaWMgZ2V0QmFzZU1ldGhvZChtZXRob2RJZDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ydW50aW1lLnN0YWNrWzBdLmZpbmRVbml0KG1ldGhvZElkKVxuICAgIH1cblxuICAgIHB1YmxpYyB1cGRhdGUocHJvcHM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0sIHN0eWxlcz86IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgY2hpbGRyZW4/OiBBcnJheTxCYXNlRWxlbWVudD4pIHtcbiAgICAgICAgdGhpcy50aGlzT2JqID0ge1xuICAgICAgICAgICAgLi4udGhpcy50aGlzT2JqLFxuICAgICAgICAgICAgcHJvcHMsXG4gICAgICAgICAgICBzdHlsZXMsXG4gICAgICAgICAgICBjaGlsZHJlblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGZpbGxDaGlsZHJlbihjaGlsZHJlbjogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIHRoaXMudGhpc09iai5jaGlsZHJlbiA9IGNoaWxkcmVuXG4gICAgfVxuXG4gICAgY29uc3RydWN0b3IobW9kdWxlOiBNb2R1bGUsIGRlZmF1bHRWYWx1ZXM/OiBhbnkpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0gZGVmYXVsdFZhbHVlcz8uX2tleSA/IGRlZmF1bHRWYWx1ZXMuX2tleSA6IFV0aWxzLmdlbmVyYXRvci5nZW5lcmF0ZUtleSgpXG4gICAgICAgIHRoaXMuX2Nvc21vSWQgPSBkZWZhdWx0VmFsdWVzPy5jb3Ntb0lkXG4gICAgICAgIHRoaXMuX21vZHVsZSA9IG1vZHVsZVxuICAgICAgICB0aGlzLl9kb20gPSBkZWZhdWx0VmFsdWVzPy5kb20gPyBkZWZhdWx0VmFsdWVzLmRvbSA6IG5ldyBET00odGhpcy5fbW9kdWxlLCB0aGlzKVxuICAgICAgICB0aGlzLl9ydW50aW1lID0gZGVmYXVsdFZhbHVlcz8ucnVudGltZSA/IGRlZmF1bHRWYWx1ZXMucnVudGltZSA6IG5ldyBSdW50aW1lKHRoaXMuX21vZHVsZSwgdGhpcylcbiAgICAgICAgdGhpcy50aGlzT2JqID0gZGVmYXVsdFZhbHVlcz8udGhpc09ialxuICAgICAgICBpZiAoIWRlZmF1bHRWYWx1ZXM/LnJ1bnRpbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3J1bnRpbWUubG9hZCgpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLnRoaXNPYmopIHtcbiAgICAgICAgICAgIHRoaXMudGhpc09iaiA9IHt9XG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0aGlzLl9ydW50aW1lLnN0YWNrWzBdLnVuaXRzKS5mb3JFYWNoKGsgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fcnVudGltZS5uYXRpdmVba10gfHwgKGsgPT09ICdjb25zdHJ1Y3RvcicpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGhpc09ialtrXSA9IHRoaXMuX3J1bnRpbWUuc3RhY2tbMF0udW5pdHNba11cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgdGhpcy50aGlzT2JqID0ge31cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnRoaXNPYmpbJ3NldFN0YXRlJ10gPSAoc3RhdGVVcGRhdGU6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSkgPT4ge1xuICAgICAgICAgICAgdGhpcy50aGlzT2JqWydzdGF0ZSddID0geyAuLi50aGlzLnRoaXNPYmpbJ3N0YXRlJ10sIC4uLnN0YXRlVXBkYXRlIH1cbiAgICAgICAgICAgIGxldCBuZXdNZXRhQnJhbmNoID0gbmV3IEV4ZWN1dGlvbk1ldGEoeyBjcmVhdHVyZTogdGhpcywgcGFyZW50SnN4S2V5OiB0aGlzLnRoaXNPYmpbJ3BhcmVudEpzeEtleSddIH0pXG4gICAgICAgICAgICBsZXQgbmV3UmVuZGVyID0gdGhpcy5nZXRCYXNlTWV0aG9kKCdyZW5kZXInKShuZXdNZXRhQnJhbmNoKVxuICAgICAgICAgICAgdGhpcy5fbW9kdWxlLmFwcGxldC5vbkNyZWF0dXJlU3RhdGVDaGFuZ2UodGhpcywgbmV3UmVuZGVyKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDcmVhdHVyZVxuIiwiXG5pbXBvcnQgQ3JlYXR1cmUgZnJvbSBcIi4vQ3JlYXR1cmVcIlxuaW1wb3J0IEZ1bmMgZnJvbSBcIi4vRnVuY1wiXG5cbmNsYXNzIENyZWF0dXJlU3RvcmUge1xuXG4gICAgcHJpdmF0ZSBfc3RvcmU6IHsgW2lkOiBzdHJpbmddOiBDcmVhdHVyZSB9XG4gICAgcHVibGljIHB1dENyZWF0dXJlKGNyZWF0dXJlOiBDcmVhdHVyZSkgeyB0aGlzLl9zdG9yZVtjcmVhdHVyZS5rZXldID0gY3JlYXR1cmUgfVxuICAgIHB1YmxpYyByZW1vdmVDcmVhdHVyZShrZXk6IHN0cmluZykgeyBkZWxldGUgdGhpcy5fc3RvcmVba2V5XSB9XG4gICAgcHVibGljIGZpbmRDcmVhdHVyZShrZXk6IHN0cmluZykgeyByZXR1cm4gdGhpcy5fc3RvcmVba2V5XSB9XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5fc3RvcmUgPSB7fVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ3JlYXR1cmVTdG9yZVxuIiwiXG5pbXBvcnQgQ3JlYXR1cmUgZnJvbSAnLi9DcmVhdHVyZSdcbmltcG9ydCBNb2R1bGUgZnJvbSAnLi9Nb2R1bGUnXG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSAnLi9lbGVtZW50cy9CYXNlRWxlbWVudCdcblxuY2xhc3MgRE9NIHtcblxuICAgIHByaXZhdGUgX21vZHVsZTogTW9kdWxlXG4gICAgcHVibGljIGdldCBtb2R1bGUoKSB7IHJldHVybiB0aGlzLl9tb2R1bGUgfVxuXG4gICAgcHJpdmF0ZSBfY3JlYXR1cmU6IENyZWF0dXJlXG4gICAgcHVibGljIGdldCBjcmVhdHVyZSgpIHsgcmV0dXJuIHRoaXMuX2NyZWF0dXJlIH1cblxuICAgIHByaXZhdGUgX3Jvb3Q/OiBCYXNlRWxlbWVudFxuICAgIHB1YmxpYyBnZXQgcm9vdCgpIHsgcmV0dXJuIHRoaXMuX3Jvb3QgfVxuICAgIHB1YmxpYyBzZXRSb290KHJvb3Q6IEJhc2VFbGVtZW50KSB7IHRoaXMuX3Jvb3QgPSByb290IH1cblxuICAgIGNvbnN0cnVjdG9yKG1vZHVsZTogTW9kdWxlLCBjcmVhdHVyZT86IENyZWF0dXJlLCByb290PzogQmFzZUVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5fbW9kdWxlID0gbW9kdWxlXG4gICAgICAgIHRoaXMuX2NyZWF0dXJlID0gY3JlYXR1cmVcbiAgICAgICAgdGhpcy5fcm9vdCA9IHJvb3RcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERPTVxuIiwiaW1wb3J0IENyZWF0dXJlIGZyb20gXCIuL0NyZWF0dXJlXCJcblxuY2xhc3MgRXhlY3V0aW9uTWV0YSB7XG5cbiAgICBjcmVhdHVyZTogQ3JlYXR1cmVcbiAgICBkZWNsYXJhdGlvbj86IGJvb2xlYW5cbiAgICBkZWNsYXJhdGlvblR5cGU/OiBzdHJpbmdcbiAgICByZXR1cm5JZFBhcmVudD86IGJvb2xlYW5cbiAgICBpc0Fub3RoZXJDcmVhdHVyZT86IGJvb2xlYW5cbiAgICBwYXJlbnRKc3hLZXk6IHN0cmluZ1xuXG4gICAgY29uc3RydWN0b3IobWV0YURpY3Q6IGFueSkge1xuICAgICAgICB0aGlzLmNyZWF0dXJlID0gbWV0YURpY3QuY3JlYXR1cmVcbiAgICAgICAgdGhpcy5kZWNsYXJhdGlvbiA9IChtZXRhRGljdC5kZWNsYXJhdGlvbiA9PT0gdHJ1ZSlcbiAgICAgICAgdGhpcy5kZWNsYXJhdGlvblR5cGUgPSBtZXRhRGljdC5kZWNsYXJhdGlvblR5cGVcbiAgICAgICAgdGhpcy5yZXR1cm5JZFBhcmVudCA9IG1ldGFEaWN0LnJldHVybklkUGFyZW50XG4gICAgICAgIHRoaXMuaXNBbm90aGVyQ3JlYXR1cmUgPSBtZXRhRGljdC5pc0Fub3RoZXJDcmVhdHVyZVxuICAgICAgICB0aGlzLnBhcmVudEpzeEtleSA9IG1ldGFEaWN0LnBhcmVudEpzeEtleVxuICAgICAgICBpZiAodGhpcy5kZWNsYXJhdGlvbiAmJiAhdGhpcy5kZWNsYXJhdGlvblR5cGUpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IHRocm93IGludmFsaWQgZXhlY3V0aW9uIG1ldGFkYXRhIGV4Y2VwdGlvblxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeGVjdXRpb25NZXRhXG4iLCJpbXBvcnQgRnVuYyBmcm9tIFwiLi9GdW5jXCJcblxuY2xhc3MgRnVuY1N0b3JlIHtcblxuICAgIHByaXZhdGUgX3N0b3JlOiB7IFtpZDogc3RyaW5nXTogRnVuYyB9XG4gICAgcHVibGljIGdldCBzdG9yZSgpIHsgcmV0dXJuIHRoaXMuX3N0b3JlIH1cbiAgICBwdWJsaWMgcHV0RnVuYyhmdW5jOiBGdW5jKSB7IHRoaXMuX3N0b3JlW2Z1bmMua2V5XSA9IGZ1bmMgfVxuICAgIHB1YmxpYyByZW1vdmVGdW5jKGtleTogc3RyaW5nKSB7IGRlbGV0ZSB0aGlzLl9zdG9yZVtrZXldIH1cbiAgICBwdWJsaWMgZmluZEZ1bmMoa2V5OiBzdHJpbmcpIHsgcmV0dXJuIHRoaXMuX3N0b3JlW2tleV0gfVxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuX3N0b3JlID0ge31cbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZ1bmNTdG9yZVxuIiwiXG5pbXBvcnQgRnVuYyBmcm9tIFwiLi9GdW5jXCJcblxuY2xhc3MgTWVtb3J5TGF5ZXIge1xuXG4gICAgcHJpdmF0ZSBfdW5pdHM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfVxuICAgIHB1YmxpYyBnZXQgdW5pdHMoKSB7IHJldHVybiB0aGlzLl91bml0cyB9XG4gICAgcHVibGljIGZpbmRVbml0KGtleTogc3RyaW5nKSB7IHJldHVybiB0aGlzLl91bml0c1trZXldIH1cbiAgICBwdWJsaWMgcHV0VW5pdChrZXk6IHN0cmluZywgdW5pdDogYW55KSB7IHRoaXMuX3VuaXRzW2tleV0gPSB1bml0IH1cbiAgICBwdWJsaWMgcmVtb3ZlVW5pdChrZXk6IHN0cmluZykgeyBkZWxldGUgdGhpcy5fdW5pdHNba2V5XSB9XG5cbiAgICBjb25zdHJ1Y3Rvcihpbml0aWFsVW5pdHM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0pIHtcbiAgICAgICAgdGhpcy5fdW5pdHMgPSBpbml0aWFsVW5pdHMgPyBpbml0aWFsVW5pdHMgOiB7fVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWVtb3J5TGF5ZXJcbiIsIlxuaW1wb3J0IEFwcGxldCBmcm9tIFwiLi9BcHBsZXRcIlxuaW1wb3J0IENyZWF0dXJlIGZyb20gXCIuL0NyZWF0dXJlXCJcbmltcG9ydCBDcmVhdHVyZVN0b3JlIGZyb20gXCIuL0NyZWF0dXJlU3RvcmVcIlxuaW1wb3J0IERPTSBmcm9tIFwiLi9ET01cIlxuaW1wb3J0IEZ1bmNTdG9yZSBmcm9tIFwiLi9GdW5jU3RvcmVcIlxuaW1wb3J0IFJ1bnRpbWUgZnJvbSBcIi4vUnVudGltZVwiXG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSBcIi4vZWxlbWVudHMvQmFzZUVsZW1lbnRcIlxuaW1wb3J0IFV0aWxzIGZyb20gJy4vdXRpbHMnXG5cbmNsYXNzIE1vZHVsZSB7XG5cbiAgICBwcml2YXRlIF9hcHBsZXQ6IEFwcGxldFxuICAgIHB1YmxpYyBnZXQgYXBwbGV0KCkgeyByZXR1cm4gdGhpcy5fYXBwbGV0IH1cbiAgICBwdWJsaWMgc2V0QXBwbGV0KGFwcGxldDogQXBwbGV0KSB7IHRoaXMuX2FwcGxldCA9IGFwcGxldCB9XG5cbiAgICBwcml2YXRlIF9jcmVhdHVyZXM6IENyZWF0dXJlU3RvcmVcbiAgICBwdWJsaWMgZ2V0IGNyZWF0dXJlcygpIHsgcmV0dXJuIHRoaXMuX2NyZWF0dXJlcyB9XG5cbiAgICBwcml2YXRlIF9rZXk6IHN0cmluZ1xuICAgIGdldCBrZXkoKSB7IHJldHVybiB0aGlzLl9rZXkgfVxuXG4gICAgcHJpdmF0ZSBfZnVuY3M6IEZ1bmNTdG9yZVxuICAgIHB1YmxpYyBnZXQgZnVuY3MoKSB7IHJldHVybiB0aGlzLl9mdW5jcyB9XG5cbiAgICBwcml2YXRlIF9kb206IERPTVxuICAgIHB1YmxpYyBnZXQgZG9tKCkgeyByZXR1cm4gdGhpcy5fZG9tIH1cblxuICAgIHByaXZhdGUgX2FzdD86IGFueVxuICAgIHB1YmxpYyBnZXQgYXN0KCkgeyByZXR1cm4gdGhpcy5fYXN0IH1cbiAgICBwdWJsaWMgc2V0QXN0KGFzdDogYW55KSB7IHRoaXMuX2FzdCA9IGFzdCB9XG5cbiAgICBwdWJsaWMgaW5zdGFudGlhdGUocHJvcHM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0sIHN0eWxlcz86IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgY2hpbGRyZW4/OiBBcnJheTxCYXNlRWxlbWVudD4sIHRoaXNPYmo/OiBhbnkpIHtcbiAgICAgICAgbGV0IGNyZWF0dXJlID0gbmV3IENyZWF0dXJlKFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb3Ntb0lkOiBwcm9wcz8ua2V5LFxuICAgICAgICAgICAgICAgIHRoaXNPYmo6IHRoaXNPYmogP1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi50aGlzT2JqLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHM6IHByb3BzID8gcHJvcHMgOiB7fSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlczogc3R5bGVzID8gc3R5bGVzIDoge30sXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogY2hpbGRyZW4gPyBjaGlsZHJlbiA6IFtdXG4gICAgICAgICAgICAgICAgICAgIH0gOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wczogcHJvcHMgPyBwcm9wcyA6IHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGVzOiBzdHlsZXMgPyBzdHlsZXMgOiB7fSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBjaGlsZHJlbiA/IGNoaWxkcmVuIDogW11cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICApXG4gICAgICAgIHRoaXMuX2NyZWF0dXJlcy5wdXRDcmVhdHVyZShjcmVhdHVyZSlcbiAgICAgICAgcmV0dXJuIGNyZWF0dXJlXG4gICAgfVxuXG4gICAgY29uc3RydWN0b3Ioa2V5OiBzdHJpbmcsIGFwcGxldDogQXBwbGV0LCBhc3Q/OiBhbnkpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0ga2V5XG4gICAgICAgIHRoaXMuX2FwcGxldCA9IGFwcGxldFxuICAgICAgICB0aGlzLl9hc3QgPSBhc3RcbiAgICAgICAgdGhpcy5fY3JlYXR1cmVzID0gbmV3IENyZWF0dXJlU3RvcmUoKVxuICAgICAgICB0aGlzLl9mdW5jcyA9IG5ldyBGdW5jU3RvcmUoKVxuICAgICAgICB0aGlzLl9kb20gPSBuZXcgRE9NKHRoaXMpXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNb2R1bGVcbiIsIlxuaW1wb3J0IENyZWF0dXJlIGZyb20gJy4vQ3JlYXR1cmUnXG5pbXBvcnQgSU5hdGl2ZSBmcm9tICcuL0lOYXRpdmUnXG5pbXBvcnQgTWVtb3J5TGF5ZXIgZnJvbSAnLi9NZW1vcnlMYXllcidcbmltcG9ydCBNZW1vcnkgZnJvbSAnLi9NZW1vcnlMYXllcidcbmltcG9ydCBNb2R1bGUgZnJvbSAnLi9Nb2R1bGUnXG5pbXBvcnQgVXRpbHMgZnJvbSAnLi91dGlscydcblxuY2xhc3MgUnVudGltZSB7XG5cbiAgICBwcml2YXRlIF9tb2R1bGU6IE1vZHVsZVxuICAgIHB1YmxpYyBnZXQgbW9kdWxlKCkgeyByZXR1cm4gdGhpcy5fbW9kdWxlIH1cblxuICAgIHByaXZhdGUgX2NyZWF0dXJlOiBDcmVhdHVyZVxuICAgIHB1YmxpYyBnZXQgY3JlYXR1cmUoKSB7IHJldHVybiB0aGlzLl9jcmVhdHVyZSB9XG5cbiAgICBwcml2YXRlIF9uYXRpdmU6IElOYXRpdmVcbiAgICBwdWJsaWMgZ2V0IG5hdGl2ZSgpIHsgcmV0dXJuIHRoaXMuX25hdGl2ZSB9XG5cbiAgICBwdWJsaWMgc3RhY2s6IEFycmF5PE1lbW9yeT4gPSBbXVxuICAgIHB1YmxpYyBwdXNoT25TdGFjayhpbml0aWFsVW5pdHM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0pIHsgdGhpcy5zdGFjay5wdXNoKG5ldyBNZW1vcnlMYXllcihpbml0aWFsVW5pdHMpKSB9XG4gICAgcHVibGljIHBvcEZyb21TdGFjaygpIHsgdGhpcy5zdGFjay5wb3AoKSB9XG4gICAgcHVibGljIGdldCBzdGFja1RvcCgpIHsgcmV0dXJuIHRoaXMuc3RhY2tbdGhpcy5zdGFjay5sZW5ndGggLSAxXSB9XG4gICAgcHVibGljIHJlc2V0U3RhY2soKSB7XG4gICAgICAgIHRoaXMuc3RhY2sgPSBbXVxuICAgICAgICB0aGlzLnB1c2hPblN0YWNrKHsgLi4udGhpcy5fbmF0aXZlIH0pXG4gICAgfVxuXG4gICAgcHVibGljIHJlc2V0KCkge1xuICAgICAgICB0aGlzLnJlc2V0U3RhY2soKVxuICAgIH1cblxuICAgIHB1YmxpYyBleGVjdXRlKGFzdDogYW55KSB7XG4gICAgICAgIFV0aWxzLmV4ZWN1dG9yLmV4ZWN1dGVCbG9jayhhc3QsIG5ldyBVdGlscy5leGVjdXRvci5FeGVjdXRpb25NZXRhKHsgY3JlYXR1cmU6IHRoaXMuX2NyZWF0dXJlIH0pKVxuICAgIH1cblxuICAgIHB1YmxpYyBsb2FkKCkge1xuICAgICAgICB0aGlzLmV4ZWN1dGUodGhpcy5tb2R1bGUuYXN0LmJvZHkuYm9keSlcbiAgICB9XG5cbiAgICBwdWJsaWMgY2xvbmUoKSB7XG4gICAgICAgIGxldCBjb3B5ID0gbmV3IFJ1bnRpbWUodGhpcy5tb2R1bGUsIHRoaXMuY3JlYXR1cmUsIHsgbmF0aXZlOiB0aGlzLm5hdGl2ZSwgc3RhY2s6IG5ldyBBcnJheSguLi50aGlzLnN0YWNrKSB9KVxuICAgICAgICByZXR1cm4gY29weVxuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKG1vZHVsZTogTW9kdWxlLCBjcmVhdHVyZT86IENyZWF0dXJlLCByZXVzYWJsZVRvb2xzPzogYW55KSB7XG4gICAgICAgIHRoaXMuX21vZHVsZSA9IG1vZHVsZVxuICAgICAgICB0aGlzLl9jcmVhdHVyZSA9IGNyZWF0dXJlXG4gICAgICAgIHRoaXMuX25hdGl2ZSA9IHJldXNhYmxlVG9vbHM/Lm5hdGl2ZSA/IHJldXNhYmxlVG9vbHMubmF0aXZlIDogdGhpcy5fbW9kdWxlLmFwcGxldC5fbmF0aXZlQnVpbGRlcih0aGlzLl9tb2R1bGUpXG4gICAgICAgIGlmIChyZXVzYWJsZVRvb2xzPy5zdGFjaykge1xuICAgICAgICAgICAgdGhpcy5zdGFjayA9IHJldXNhYmxlVG9vbHMuc3RhY2tcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IFJ1bnRpbWVcbiIsIlxuY2xhc3MgQmFzZUNvbnRyb2wge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEJhc2VDb250cm9sXG4iLCJcbmltcG9ydCBCYXNlQ29udHJvbCBmcm9tICcuL0Jhc2VDb250cm9sJztcbmltcG9ydCBVdGlscyBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSAnLi4vZWxlbWVudHMvQmFzZUVsZW1lbnQnO1xuXG5jbGFzcyBCb3hDb250cm9sIGV4dGVuZHMgQmFzZUNvbnRyb2wge1xuXG4gICAgcHVibGljIHN0YXRpYyByZWFkb25seSBUWVBFID0gJ2JveCdcbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRQcm9wcyA9IHtcbiAgICAgICAgXG4gICAgfVxuICAgIHB1YmxpYyBzdGF0aWMgZGVmYXVsdFN0eWxlcyA9IHtcbiAgICAgICAgd2lkdGg6IDIwMCxcbiAgICAgICAgaGVpZ2h0OiAyMDBcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGluc3RhbnRpYXRlKG92ZXJyaWRlblByb3BzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sIG92ZXJyaWRlblN0eWxlczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBjaGlsZHJlbjogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIHJldHVybiBVdGlscy5nZW5lcmF0b3IucHJlcGFyZUVsZW1lbnQoQm94Q29udHJvbC5UWVBFLCB0aGlzLmRlZmF1bHRQcm9wcywgb3ZlcnJpZGVuUHJvcHMsIHRoaXMuZGVmYXVsdFN0eWxlcywgb3ZlcnJpZGVuU3R5bGVzLCBjaGlsZHJlbilcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJveENvbnRyb2xcbiIsIlxuaW1wb3J0IEJhc2VDb250cm9sIGZyb20gJy4vQmFzZUNvbnRyb2wnO1xuaW1wb3J0IFN0cmluZ1Byb3AgZnJvbSAnLi4vcHJvcHMvU3RyaW5nUHJvcCdcbmltcG9ydCBVdGlscyBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSAnLi4vZWxlbWVudHMvQmFzZUVsZW1lbnQnO1xuaW1wb3J0IEZ1bmNQcm9wIGZyb20gJy4uL3Byb3BzL0Z1bmNQcm9wJztcblxuY2xhc3MgQnV0dG9uQ29udHJvbCBleHRlbmRzIEJhc2VDb250cm9sIHtcblxuICAgIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgVFlQRSA9ICdidXR0b24nXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0UHJvcHMgPSB7XG4gICAgICAgIGNhcHRpb246IG5ldyBTdHJpbmdQcm9wKCcnKSxcbiAgICAgICAgdmFyaWFudDogbmV3IFN0cmluZ1Byb3AoJ2ZpbGxlZCcpLFxuICAgICAgICBvbkNsaWNrOiBuZXcgRnVuY1Byb3AodW5kZWZpbmVkKVxuICAgIH1cbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRTdHlsZXMgPSB7XG4gICAgICAgIHdpZHRoOiAxNTAsXG4gICAgICAgIGhlaWdodDogJ2F1dG8nXG4gICAgfVxuXG4gICAgc3RhdGljIGluc3RhbnRpYXRlKG92ZXJyaWRlblByb3BzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sIG92ZXJyaWRlblN0eWxlczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBjaGlsZHJlbjogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIHJldHVybiBVdGlscy5nZW5lcmF0b3IucHJlcGFyZUVsZW1lbnQoQnV0dG9uQ29udHJvbC5UWVBFLCB0aGlzLmRlZmF1bHRQcm9wcywgb3ZlcnJpZGVuUHJvcHMsIHRoaXMuZGVmYXVsdFN0eWxlcywgb3ZlcnJpZGVuU3R5bGVzLCBjaGlsZHJlbilcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1dHRvbkNvbnRyb2xcbiIsIlxuaW1wb3J0IEJhc2VDb250cm9sIGZyb20gJy4vQmFzZUNvbnRyb2wnO1xuaW1wb3J0IFV0aWxzIGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCBCYXNlRWxlbWVudCBmcm9tICcuLi9lbGVtZW50cy9CYXNlRWxlbWVudCc7XG5cbmNsYXNzIENhcmRDb250cm9sIGV4dGVuZHMgQmFzZUNvbnRyb2wge1xuXG4gICAgcHVibGljIHN0YXRpYyByZWFkb25seSBUWVBFID0gJ2NhcmQnXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0UHJvcHMgPSB7XG4gICAgICAgIFxuICAgIH1cbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRTdHlsZXMgPSB7XG4gICAgICAgIHdpZHRoOiAyMDAsXG4gICAgICAgIGhlaWdodDogMjAwLFxuICAgICAgICBib3hTaGFkb3c6ICdyZ2JhKDAsIDAsIDAsIDAuMjQpIDBweCAzcHggOHB4JyxcbiAgICAgICAgYmFja2dyb3VuZENvbG9yOiAnI2ZmZicsXG4gICAgICAgIGJvcmRlclJhZGl1czogNFxuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgaW5zdGFudGlhdGUob3ZlcnJpZGVuUHJvcHM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgb3ZlcnJpZGVuU3R5bGVzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sIGNoaWxkcmVuOiBBcnJheTxCYXNlRWxlbWVudD4pIHtcbiAgICAgICAgcmV0dXJuIFV0aWxzLmdlbmVyYXRvci5wcmVwYXJlRWxlbWVudChDYXJkQ29udHJvbC5UWVBFLCB0aGlzLmRlZmF1bHRQcm9wcywgb3ZlcnJpZGVuUHJvcHMsIHRoaXMuZGVmYXVsdFN0eWxlcywgb3ZlcnJpZGVuU3R5bGVzLCBjaGlsZHJlbilcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IENhcmRDb250cm9sXG4iLCJcbmltcG9ydCBCYXNlQ29udHJvbCBmcm9tICcuL0Jhc2VDb250cm9sJztcbmltcG9ydCBVdGlscyBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSAnLi4vZWxlbWVudHMvQmFzZUVsZW1lbnQnO1xuXG5jbGFzcyBQcmltYXJ5VGFiQ29udHJvbCBleHRlbmRzIEJhc2VDb250cm9sIHtcblxuICAgIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgVFlQRSA9ICdwcmltYXJ5LXRhYidcbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRQcm9wcyA9IHtcbiAgICAgICAgXG4gICAgfVxuICAgIHB1YmxpYyBzdGF0aWMgZGVmYXVsdFN0eWxlcyA9IHtcbiAgICAgICAgXG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBpbnN0YW50aWF0ZShvdmVycmlkZW5Qcm9wczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBvdmVycmlkZW5TdHlsZXM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgY2hpbGRyZW46IEFycmF5PEJhc2VFbGVtZW50Pikge1xuICAgICAgICByZXR1cm4gVXRpbHMuZ2VuZXJhdG9yLnByZXBhcmVFbGVtZW50KFByaW1hcnlUYWJDb250cm9sLlRZUEUsIHRoaXMuZGVmYXVsdFByb3BzLCBvdmVycmlkZW5Qcm9wcywgdGhpcy5kZWZhdWx0U3R5bGVzLCBvdmVycmlkZW5TdHlsZXMsIGNoaWxkcmVuKVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJpbWFyeVRhYkNvbnRyb2xcbiIsIlxuaW1wb3J0IEJhc2VDb250cm9sIGZyb20gJy4vQmFzZUNvbnRyb2wnO1xuaW1wb3J0IFV0aWxzIGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCBCYXNlRWxlbWVudCBmcm9tICcuLi9lbGVtZW50cy9CYXNlRWxlbWVudCc7XG5pbXBvcnQgRnVuY1Byb3AgZnJvbSAnLi4vcHJvcHMvRnVuY1Byb3AnO1xuXG5jbGFzcyBUYWJzQ29udHJvbCBleHRlbmRzIEJhc2VDb250cm9sIHtcblxuICAgIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgVFlQRSA9ICd0YWJzJ1xuICAgIHB1YmxpYyBzdGF0aWMgZGVmYXVsdFByb3BzID0ge1xuICAgICAgICBvbkNoYW5nZTogbmV3IEZ1bmNQcm9wKHVuZGVmaW5lZClcbiAgICB9XG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0U3R5bGVzID0ge1xuICAgICAgICBcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGluc3RhbnRpYXRlKG92ZXJyaWRlblByb3BzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sIG92ZXJyaWRlblN0eWxlczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBjaGlsZHJlbjogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIHJldHVybiBVdGlscy5nZW5lcmF0b3IucHJlcGFyZUVsZW1lbnQoVGFic0NvbnRyb2wuVFlQRSwgdGhpcy5kZWZhdWx0UHJvcHMsIG92ZXJyaWRlblByb3BzLCB0aGlzLmRlZmF1bHRTdHlsZXMsIG92ZXJyaWRlblN0eWxlcywgY2hpbGRyZW4pXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUYWJzQ29udHJvbFxuIiwiXG5pbXBvcnQgQmFzZUNvbnRyb2wgZnJvbSAnLi9CYXNlQ29udHJvbCc7XG5pbXBvcnQgU3RyaW5nUHJvcCBmcm9tICcuLi9wcm9wcy9TdHJpbmdQcm9wJ1xuaW1wb3J0IFV0aWxzIGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCBCYXNlRWxlbWVudCBmcm9tICcuLi9lbGVtZW50cy9CYXNlRWxlbWVudCc7XG5cbmNsYXNzIFRleHRDb250cm9sIGV4dGVuZHMgQmFzZUNvbnRyb2wge1xuXG4gICAgcHVibGljIHN0YXRpYyByZWFkb25seSBUWVBFID0gJ3RleHQnXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0UHJvcHMgPSB7XG4gICAgICAgIHRleHQ6IG5ldyBTdHJpbmdQcm9wKCcnKVxuICAgIH1cbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRTdHlsZXMgPSB7XG4gICAgICAgIHdpZHRoOiAxNTAsXG4gICAgICAgIGhlaWdodDogJ2F1dG8nXG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBpbnN0YW50aWF0ZShvdmVycmlkZW5Qcm9wczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBvdmVycmlkZW5TdHlsZXM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgY2hpbGRyZW46IEFycmF5PEJhc2VFbGVtZW50Pikge1xuICAgICAgICByZXR1cm4gVXRpbHMuZ2VuZXJhdG9yLnByZXBhcmVFbGVtZW50KFRleHRDb250cm9sLlRZUEUsIHRoaXMuZGVmYXVsdFByb3BzLCBvdmVycmlkZW5Qcm9wcywgdGhpcy5kZWZhdWx0U3R5bGVzLCBvdmVycmlkZW5TdHlsZXMsIGNoaWxkcmVuKVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGV4dENvbnRyb2xcbiIsIlxuaW1wb3J0IEJveENvbnRyb2wgZnJvbSBcIi4vQm94Q29udHJvbFwiXG5pbXBvcnQgQnV0dG9uQ29udHJvbCBmcm9tIFwiLi9CdXR0b25Db250cm9sXCJcbmltcG9ydCBDYXJkQ29udHJvbCBmcm9tIFwiLi9DYXJkQ29udHJvbFwiXG5pbXBvcnQgVGFic0NvbnRyb2wgZnJvbSBcIi4vVGFic0NvbnRyb2xcIlxuaW1wb3J0IFByaW1hcnlUYWJDb250cm9sIGZyb20gXCIuL1ByaW1hcnlUYWJDb250cm9sXCJcbmltcG9ydCBUZXh0Q29udHJvbCBmcm9tIFwiLi9UZXh0Q29udHJvbFwiXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgICBbVGV4dENvbnRyb2wuVFlQRV06IFRleHRDb250cm9sLFxuICAgIFtCdXR0b25Db250cm9sLlRZUEVdOiBCdXR0b25Db250cm9sLFxuICAgIFtCb3hDb250cm9sLlRZUEVdOiBCb3hDb250cm9sLFxuICAgIFtDYXJkQ29udHJvbC5UWVBFXTogQ2FyZENvbnRyb2wsXG4gICAgW1RhYnNDb250cm9sLlRZUEVdOiBUYWJzQ29udHJvbCxcbiAgICBbUHJpbWFyeVRhYkNvbnRyb2wuVFlQRV06IFByaW1hcnlUYWJDb250cm9sXG59XG4iLCJpbXBvcnQgQmFzZVByb3AgZnJvbSBcIi4uL3Byb3BzL0Jhc2VQcm9wXCI7XG5cbmNsYXNzIEJhc2VFbGVtZW50IHtcblxuICAgIHB1YmxpYyBfa2V5OiBzdHJpbmdcbiAgICBwdWJsaWMgZ2V0IGtleSgpIHsgcmV0dXJuIHRoaXMuX2tleSB9XG5cbiAgICBwcml2YXRlIF9jb250cm9sVHlwZTogc3RyaW5nXG4gICAgcHVibGljIGdldCBjb250cm9sVHlwZSgpIHsgcmV0dXJuIHRoaXMuX2NvbnRyb2xUeXBlIH1cblxuICAgIHB1YmxpYyBfcHJvcHM6IHsgW2tleTogc3RyaW5nXTogQmFzZVByb3AgfVxuICAgIGdldCBwcm9wcygpIHsgcmV0dXJuIHRoaXMuX3Byb3BzIH1cblxuICAgIHB1YmxpYyBfc3R5bGVzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9XG4gICAgZ2V0IHN0eWxlcygpIHsgcmV0dXJuIHRoaXMuX3N0eWxlcyB9XG5cbiAgICBwdWJsaWMgX2NoaWxkcmVuOiBBcnJheTxCYXNlRWxlbWVudD5cbiAgICBnZXQgY2hpbGRyZW4oKSB7IHJldHVybiB0aGlzLl9jaGlsZHJlbiB9XG5cbiAgICBwdWJsaWMgdXBkYXRlKHByb3BzPzogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBzdHlsZXM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0sIGNoaWxkcmVuPzogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIGlmIChwcm9wcykgdGhpcy5fcHJvcHMgPSBwcm9wc1xuICAgICAgICBpZiAoc3R5bGVzKSB0aGlzLl9zdHlsZXMgPSBzdHlsZXNcbiAgICAgICAgaWYgKGNoaWxkcmVuKSB0aGlzLl9jaGlsZHJlbiA9IGNoaWxkcmVuXG4gICAgfVxuXG4gICAgY29uc3RydWN0b3IoXG4gICAgICAgIGtleTogc3RyaW5nLFxuICAgICAgICBjb250cm9sVHlwZTogc3RyaW5nLFxuICAgICAgICBwcm9wczogeyBba2V5OiBzdHJpbmddOiBCYXNlUHJvcCB9LFxuICAgICAgICBzdHlsZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sXG4gICAgICAgIGNoaWxkcmVuPzogQXJyYXk8QmFzZUVsZW1lbnQ+XG4gICAgKSB7XG4gICAgICAgIHRoaXMuX2tleSA9IGtleVxuICAgICAgICB0aGlzLl9jb250cm9sVHlwZSA9IGNvbnRyb2xUeXBlXG4gICAgICAgIHRoaXMuX3Byb3BzID0gcHJvcHM7XG4gICAgICAgIHRoaXMuX3N0eWxlcyA9IHN0eWxlc1xuICAgICAgICB0aGlzLl9jaGlsZHJlbiA9IGNoaWxkcmVuID8gY2hpbGRyZW4gOiBbXVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQmFzZUVsZW1lbnRcbiIsIlxuYWJzdHJhY3QgY2xhc3MgQmFzZVByb3Age1xuXG4gICAgX3R5cGU6IHN0cmluZ1xuICAgIHB1YmxpYyBnZXQgdHlwZSgpIHsgcmV0dXJuIHRoaXMuX3R5cGUgfVxuXG4gICAgcHVibGljIGFic3RyYWN0IHNldFZhbHVlKHZhbHVlOiBhbnkpOiB2b2lkXG4gICAgcHVibGljIGFic3RyYWN0IGdldFZhbHVlKCk6IGFueVxuXG4gICAgY29uc3RydWN0b3IodHlwZTogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuX3R5cGUgPSB0eXBlXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCYXNlUHJvcFxuIiwiXG5pbXBvcnQgQmFzZVByb3AgZnJvbSAnLi9CYXNlUHJvcCdcblxuY2xhc3MgRnVuY1Byb3AgZXh0ZW5kcyBCYXNlUHJvcCB7XG5cbiAgICBfdmFsdWU/OiAoKSA9PiB2b2lkXG4gICAgcHVibGljIGdldCB2YWx1ZSgpIHsgcmV0dXJuIHRoaXMuX3ZhbHVlIH1cbiAgICBwdWJsaWMgc2V0VmFsdWUodjogYW55KSB7IHRoaXMuX3ZhbHVlID0gdn1cbiAgICBwdWJsaWMgZ2V0VmFsdWUoKSB7IHJldHVybiB0aGlzLl92YWx1ZX1cblxuICAgIF9kZWZhdWx0VmFsdWU/OiAoKSA9PiB2b2lkXG4gICAgcHVibGljIGdldCBkZWZhdWx0VmFsdWUoKSB7IHJldHVybiB0aGlzLl9kZWZhdWx0VmFsdWUgfVxuXG4gICAgY29uc3RydWN0b3IoZGVmYXVsdFZhbHVlPzogKCkgPT4gdm9pZCkge1xuICAgICAgICBzdXBlcignZnVuY3Rpb24nKVxuICAgICAgICB0aGlzLl92YWx1ZSA9IGRlZmF1bHRWYWx1ZVxuICAgICAgICB0aGlzLl9kZWZhdWx0VmFsdWUgPSBkZWZhdWx0VmFsdWVcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZ1bmNQcm9wXG4iLCJcbmltcG9ydCBCYXNlUHJvcCBmcm9tICcuL0Jhc2VQcm9wJ1xuXG5jbGFzcyBTdHJpbmdQcm9wIGV4dGVuZHMgQmFzZVByb3Age1xuXG4gICAgX3ZhbHVlPzogc3RyaW5nXG4gICAgcHVibGljIGdldCB2YWx1ZSgpIHsgcmV0dXJuIHRoaXMuX3ZhbHVlIH1cbiAgICBwdWJsaWMgc2V0VmFsdWUodjogYW55KSB7IHRoaXMuX3ZhbHVlID0gdn1cbiAgICBwdWJsaWMgZ2V0VmFsdWUoKSB7IHJldHVybiB0aGlzLl92YWx1ZX1cblxuICAgIF9kZWZhdWx0VmFsdWU6IHN0cmluZ1xuICAgIHB1YmxpYyBnZXQgZGVmYXVsdFZhbHVlKCkgeyByZXR1cm4gdGhpcy5fZGVmYXVsdFZhbHVlIH1cblxuICAgIGNvbnN0cnVjdG9yKGRlZmF1bHRWYWx1ZTogc3RyaW5nKSB7XG4gICAgICAgIHN1cGVyKCdzdHJpbmcnKVxuICAgICAgICB0aGlzLl92YWx1ZSA9IGRlZmF1bHRWYWx1ZVxuICAgICAgICB0aGlzLl9kZWZhdWx0VmFsdWUgPSBkZWZhdWx0VmFsdWVcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ1Byb3BcbiIsIlxuaW1wb3J0IHsgUGFyc2VyIGFzIEFjb3JuUGFyc2VyIH0gZnJvbSAnYWNvcm4nO1xuaW1wb3J0ICogYXMganN4IGZyb20gJ2Fjb3JuLWpzeCc7XG5pbXBvcnQgQXBwbGV0IGZyb20gJy4uL0FwcGxldCc7XG5pbXBvcnQgTW9kdWxlIGZyb20gJy4uL01vZHVsZSc7XG5pbXBvcnQgY3NzUHJvcGVydHkgZnJvbSAnLi9jc3NQcm9wZXJ0eSc7XG5pbXBvcnQgaHlwaGVuYXRlU3R5bGVOYW1lIGZyb20gJy4vaHlwaGVuYXRlU3R5bGVOYW1lJztcblxubGV0IHsgaXNVbml0bGVzc051bWJlciB9ID0gY3NzUHJvcGVydHlcblxubGV0IGpzeENvbXBpbGVyID0gQWNvcm5QYXJzZXIuZXh0ZW5kKGpzeCgpKTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xudmFyIGtleXMgPSBPYmplY3Qua2V5cztcblxudmFyIGNvdW50ZXIgPSAxO1xuLy8gRm9sbG93cyBzeW50YXggYXQgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL2NvbnRlbnQsXG4vLyBpbmNsdWRpbmcgbXVsdGlwbGUgc3BhY2Ugc2VwYXJhdGVkIHZhbHVlcy5cbnZhciB1bnF1b3RlZENvbnRlbnRWYWx1ZVJlZ2V4ID0gL14obm9ybWFsfG5vbmV8KFxcYih1cmxcXChbXildKlxcKXxjaGFwdGVyX2NvdW50ZXJ8YXR0clxcKFteKV0qXFwpfChuby0pPyhvcGVufGNsb3NlKS1xdW90ZXxpbmhlcml0KSgoXFxiXFxzKil8JHxcXHMrKSkrKSQvO1xuXG5mdW5jdGlvbiBidWlsZFJ1bGUoa2V5LCB2YWx1ZSkge1xuICAgIGlmICghaXNVbml0bGVzc051bWJlcltrZXldICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdmFsdWUgPSAnJyArIHZhbHVlICsgJ3B4JztcbiAgICB9XG4gICAgZWxzZSBpZiAoa2V5ID09PSAnY29udGVudCcgJiYgIXVucXVvdGVkQ29udGVudFZhbHVlUmVnZXgudGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgdmFsdWUgPSBcIidcIiArIHZhbHVlLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKSArIFwiJ1wiO1xuICAgIH1cblxuICAgIHJldHVybiBoeXBoZW5hdGVTdHlsZU5hbWUoa2V5KSArICc6ICcgKyB2YWx1ZSArICc7ICAnO1xufVxuXG5mdW5jdGlvbiBidWlsZFZhbHVlKGtleSwgdmFsdWUpIHtcbiAgICBpZiAoIWlzVW5pdGxlc3NOdW1iZXJba2V5XSAmJiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHZhbHVlID0gJycgKyB2YWx1ZSArICdweCc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGtleSA9PT0gJ2NvbnRlbnQnICYmICF1bnF1b3RlZENvbnRlbnRWYWx1ZVJlZ2V4LnRlc3QodmFsdWUpKSB7XG4gICAgICAgIHZhbHVlID0gXCInXCIgKyB2YWx1ZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIikgKyBcIidcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWUgKyAnJztcbn1cblxuZnVuY3Rpb24gc3R5bGVUb0Nzc1N0cmluZyhydWxlcykge1xuICAgIHZhciByZXN1bHQgPSAnJ1xuICAgIGlmICghcnVsZXMgfHwga2V5cyhydWxlcykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIHZhciBzdHlsZUtleXMgPSBrZXlzKHJ1bGVzKTtcbiAgICBmb3IgKHZhciBqID0gMCwgbCA9IHN0eWxlS2V5cy5sZW5ndGg7IGogPCBsOyBqKyspIHtcbiAgICAgICAgdmFyIHN0eWxlS2V5ID0gc3R5bGVLZXlzW2pdO1xuICAgICAgICB2YXIgdmFsdWUgPSBydWxlc1tzdHlsZUtleV07XG5cbiAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gYnVpbGRSdWxlKHN0eWxlS2V5LCB2YWx1ZVtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gYnVpbGRSdWxlKHN0eWxlS2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxubGV0IHBhcnNlID0gKGpzeENvZGU6IHN0cmluZykgPT4ge1xuICAgIHJldHVybiBqc3hDb21waWxlci5wYXJzZShqc3hDb2RlLCB7IHNvdXJjZVR5cGU6ICdtb2R1bGUnLCBlY21hVmVyc2lvbjogJ2xhdGVzdCcgfSk7XG59XG5cbmxldCBleHRyYWN0TW9kdWxlcyA9IChtaWRkbGVDb2RlOiBhbnksIGFwcGxldDogQXBwbGV0KSA9PiB7XG4gICAgcmV0dXJuIG1pZGRsZUNvZGUuYm9keVxuICAgICAgICAuZmlsdGVyKChkZWNsYXJhdGlvbjogYW55KSA9PiBkZWNsYXJhdGlvbi50eXBlID09PSAnQ2xhc3NEZWNsYXJhdGlvbicpXG4gICAgICAgIC5tYXAoKGRlY2xhcmF0aW9uOiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTW9kdWxlKGRlY2xhcmF0aW9uLmlkLm5hbWUsIGFwcGxldCwgZGVjbGFyYXRpb24pXG4gICAgICAgIH0pXG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgcGFyc2UsIGV4dHJhY3RNb2R1bGVzLCBzdHlsZVRvQ3NzU3RyaW5nLCBidWlsZFJ1bGUsIGJ1aWxkVmFsdWUgfVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENTUyBwcm9wZXJ0aWVzIHdoaWNoIGFjY2VwdCBudW1iZXJzIGJ1dCBhcmUgbm90IGluIHVuaXRzIG9mIFwicHhcIi5cbiAqL1xudmFyIGlzVW5pdGxlc3NOdW1iZXIgPSB7XG4gIGJveEZsZXg6IHRydWUsXG4gIGJveEZsZXhHcm91cDogdHJ1ZSxcbiAgY29sdW1uQ291bnQ6IHRydWUsXG4gIGZsZXg6IHRydWUsXG4gIGZsZXhHcm93OiB0cnVlLFxuICBmbGV4UG9zaXRpdmU6IHRydWUsXG4gIGZsZXhTaHJpbms6IHRydWUsXG4gIGZsZXhOZWdhdGl2ZTogdHJ1ZSxcbiAgZm9udFdlaWdodDogdHJ1ZSxcbiAgbGluZUNsYW1wOiB0cnVlLFxuICBsaW5lSGVpZ2h0OiB0cnVlLFxuICBvcGFjaXR5OiB0cnVlLFxuICBvcmRlcjogdHJ1ZSxcbiAgb3JwaGFuczogdHJ1ZSxcbiAgd2lkb3dzOiB0cnVlLFxuICB6SW5kZXg6IHRydWUsXG4gIHpvb206IHRydWUsXG5cbiAgLy8gU1ZHLXJlbGF0ZWQgcHJvcGVydGllc1xuICBmaWxsT3BhY2l0eTogdHJ1ZSxcbiAgc3Ryb2tlRGFzaG9mZnNldDogdHJ1ZSxcbiAgc3Ryb2tlT3BhY2l0eTogdHJ1ZSxcbiAgc3Ryb2tlV2lkdGg6IHRydWVcbn07XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IHByZWZpeCB2ZW5kb3Itc3BlY2lmaWMgcHJlZml4LCBlZzogV2Via2l0XG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IHN0eWxlIG5hbWUsIGVnOiB0cmFuc2l0aW9uRHVyYXRpb25cbiAqIEByZXR1cm4ge3N0cmluZ30gc3R5bGUgbmFtZSBwcmVmaXhlZCB3aXRoIGBwcmVmaXhgLCBwcm9wZXJseSBjYW1lbENhc2VkLCBlZzpcbiAqIFdlYmtpdFRyYW5zaXRpb25EdXJhdGlvblxuICovXG5mdW5jdGlvbiBwcmVmaXhLZXkocHJlZml4LCBrZXkpIHtcbiAgcmV0dXJuIHByZWZpeCArIGtleS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGtleS5zdWJzdHJpbmcoMSk7XG59XG5cbi8qKlxuICogU3VwcG9ydCBzdHlsZSBuYW1lcyB0aGF0IG1heSBjb21lIHBhc3NlZCBpbiBwcmVmaXhlZCBieSBhZGRpbmcgcGVybXV0YXRpb25zXG4gKiBvZiB2ZW5kb3IgcHJlZml4ZXMuXG4gKi9cbnZhciBwcmVmaXhlcyA9IFsnV2Via2l0JywgJ21zJywgJ01veicsICdPJ107XG5cbi8vIFVzaW5nIE9iamVjdC5rZXlzIGhlcmUsIG9yIGVsc2UgdGhlIHZhbmlsbGEgZm9yLWluIGxvb3AgbWFrZXMgSUU4IGdvIGludG8gYW5cbi8vIGluZmluaXRlIGxvb3AsIGJlY2F1c2UgaXQgaXRlcmF0ZXMgb3ZlciB0aGUgbmV3bHkgYWRkZWQgcHJvcHMgdG9vLlxuT2JqZWN0LmtleXMoaXNVbml0bGVzc051bWJlcikuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkge1xuICBwcmVmaXhlcy5mb3JFYWNoKGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICBpc1VuaXRsZXNzTnVtYmVyW3ByZWZpeEtleShwcmVmaXgsIHByb3ApXSA9IGlzVW5pdGxlc3NOdW1iZXJbcHJvcF07XG4gIH0pO1xufSk7XG5cbi8qKlxuICogTW9zdCBzdHlsZSBwcm9wZXJ0aWVzIGNhbiBiZSB1bnNldCBieSBkb2luZyAuc3R5bGVbcHJvcF0gPSAnJyBidXQgSUU4XG4gKiBkb2Vzbid0IGxpa2UgZG9pbmcgdGhhdCB3aXRoIHNob3J0aGFuZCBwcm9wZXJ0aWVzIHNvIGZvciB0aGUgcHJvcGVydGllcyB0aGF0XG4gKiBJRTggYnJlYWtzIG9uLCB3aGljaCBhcmUgbGlzdGVkIGhlcmUsIHdlIGluc3RlYWQgdW5zZXQgZWFjaCBvZiB0aGVcbiAqIGluZGl2aWR1YWwgcHJvcGVydGllcy4gU2VlIGh0dHA6Ly9idWdzLmpxdWVyeS5jb20vdGlja2V0LzEyMzg1LlxuICogVGhlIDQtdmFsdWUgJ2Nsb2NrJyBwcm9wZXJ0aWVzIGxpa2UgbWFyZ2luLCBwYWRkaW5nLCBib3JkZXItd2lkdGggc2VlbSB0b1xuICogYmVoYXZlIHdpdGhvdXQgYW55IHByb2JsZW1zLiBDdXJpb3VzbHksIGxpc3Qtc3R5bGUgd29ya3MgdG9vIHdpdGhvdXQgYW55XG4gKiBzcGVjaWFsIHByb2RkaW5nLlxuICovXG52YXIgc2hvcnRoYW5kUHJvcGVydHlFeHBhbnNpb25zID0ge1xuICBiYWNrZ3JvdW5kOiB7XG4gICAgYmFja2dyb3VuZEltYWdlOiB0cnVlLFxuICAgIGJhY2tncm91bmRQb3NpdGlvbjogdHJ1ZSxcbiAgICBiYWNrZ3JvdW5kUmVwZWF0OiB0cnVlLFxuICAgIGJhY2tncm91bmRDb2xvcjogdHJ1ZVxuICB9LFxuICBib3JkZXI6IHtcbiAgICBib3JkZXJXaWR0aDogdHJ1ZSxcbiAgICBib3JkZXJTdHlsZTogdHJ1ZSxcbiAgICBib3JkZXJDb2xvcjogdHJ1ZVxuICB9LFxuICBib3JkZXJCb3R0b206IHtcbiAgICBib3JkZXJCb3R0b21XaWR0aDogdHJ1ZSxcbiAgICBib3JkZXJCb3R0b21TdHlsZTogdHJ1ZSxcbiAgICBib3JkZXJCb3R0b21Db2xvcjogdHJ1ZVxuICB9LFxuICBib3JkZXJMZWZ0OiB7XG4gICAgYm9yZGVyTGVmdFdpZHRoOiB0cnVlLFxuICAgIGJvcmRlckxlZnRTdHlsZTogdHJ1ZSxcbiAgICBib3JkZXJMZWZ0Q29sb3I6IHRydWVcbiAgfSxcbiAgYm9yZGVyUmlnaHQ6IHtcbiAgICBib3JkZXJSaWdodFdpZHRoOiB0cnVlLFxuICAgIGJvcmRlclJpZ2h0U3R5bGU6IHRydWUsXG4gICAgYm9yZGVyUmlnaHRDb2xvcjogdHJ1ZVxuICB9LFxuICBib3JkZXJUb3A6IHtcbiAgICBib3JkZXJUb3BXaWR0aDogdHJ1ZSxcbiAgICBib3JkZXJUb3BTdHlsZTogdHJ1ZSxcbiAgICBib3JkZXJUb3BDb2xvcjogdHJ1ZVxuICB9LFxuICBmb250OiB7XG4gICAgZm9udFN0eWxlOiB0cnVlLFxuICAgIGZvbnRWYXJpYW50OiB0cnVlLFxuICAgIGZvbnRXZWlnaHQ6IHRydWUsXG4gICAgZm9udFNpemU6IHRydWUsXG4gICAgbGluZUhlaWdodDogdHJ1ZSxcbiAgICBmb250RmFtaWx5OiB0cnVlXG4gIH1cbn07XG5cbnZhciBDU1NQcm9wZXJ0eSA9IHtcbiAgaXNVbml0bGVzc051bWJlcjogaXNVbml0bGVzc051bWJlcixcbiAgc2hvcnRoYW5kUHJvcGVydHlFeHBhbnNpb25zOiBzaG9ydGhhbmRQcm9wZXJ0eUV4cGFuc2lvbnNcbn07XG5cbmV4cG9ydCBkZWZhdWx0IENTU1Byb3BlcnR5XG4iLCJcbmltcG9ydCBCYXNlRWxlbWVudCBmcm9tIFwiLi4vZWxlbWVudHMvQmFzZUVsZW1lbnRcIlxuaW1wb3J0IENyZWF0dXJlIGZyb20gXCIuLi9DcmVhdHVyZVwiXG5pbXBvcnQgQ29udHJvbHMgZnJvbSAnLi4vY29udHJvbHMvaW5kZXgnXG5pbXBvcnQgRXhlY3V0aW9uTWV0YSBmcm9tIFwiLi4vRXhlY3V0aW9uTWV0YVwiXG5pbXBvcnQgVXRpbHMgZnJvbSAnLidcblxubGV0IGV4ZWN1dGVTaW5nbGUgPSAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgbGV0IGNhbGxiYWNrID0gY29kZUNhbGxiYWNrc1tjb2RlLnR5cGVdXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGxldCByID0gY2FsbGJhY2soY29kZSwgbWV0YSlcbiAgICAgICAgcmV0dXJuIHJcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY29kZVxuICAgIH1cbn1cblxubGV0IGV4ZWN1dGVCbG9jayA9IChjb2RlczogQXJyYXk8YW55PiwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IGNvZGUgPSBjb2Rlc1tpXVxuICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY29kZSwgbWV0YSlcbiAgICAgICAgaWYgKHI/LnJldHVybkZpcmVkKSByZXR1cm4gclxuICAgIH1cbn1cblxubGV0IGZpbmRMYXllciA9IChtZXRhOiBFeGVjdXRpb25NZXRhLCBpZDogc3RyaW5nKSA9PiB7XG4gICAgZm9yIChsZXQgaSA9IG1ldGEuY3JlYXR1cmUucnVudGltZS5zdGFjay5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBsZXQgciA9IG1ldGEuY3JlYXR1cmUuX3J1bnRpbWUuc3RhY2tbaV0uZmluZFVuaXQoaWQpXG4gICAgICAgIGlmIChyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuc3RhY2tbaV1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgZ2VuZXJhdGVDYWxsYmFja0Z1bmN0aW9uID0gKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgIGxldCBuZXdNZXRhQnJhbmNoID0gbWV0YVxuICAgIHJldHVybiAoLi4uYXJnczogQXJyYXk8YW55PikgPT4ge1xuICAgICAgICBsZXQgcGFyYW1ldGVycyA9IHt9XG4gICAgICAgIGNvZGUucGFyYW1zLmZvckVhY2goKHBhcmFtOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIHBhcmFtZXRlcnNbcGFyYW0ubmFtZV0gPSBhcmdzW2luZGV4XVxuICAgICAgICB9KVxuICAgICAgICBsZXQgZmlyc3RQYXJhbSA9IGFyZ3NbMF1cbiAgICAgICAgaWYgKGZpcnN0UGFyYW0gJiYgKGZpcnN0UGFyYW0gaW5zdGFuY2VvZiBFeGVjdXRpb25NZXRhKSAmJiBmaXJzdFBhcmFtLmlzQW5vdGhlckNyZWF0dXJlKSB7XG4gICAgICAgICAgICBuZXdNZXRhQnJhbmNoID0gZmlyc3RQYXJhbVxuICAgICAgICB9XG4gICAgICAgIG5ld01ldGFCcmFuY2guY3JlYXR1cmUucnVudGltZS5wdXNoT25TdGFjayhwYXJhbWV0ZXJzKVxuICAgICAgICBsZXQgcmVzdWx0ID0gZXhlY3V0ZVNpbmdsZShjb2RlLmJvZHksIG5ld01ldGFCcmFuY2gpXG4gICAgICAgIG5ld01ldGFCcmFuY2guY3JlYXR1cmUucnVudGltZS5wb3BGcm9tU3RhY2soKVxuICAgICAgICByZXR1cm4gcmVzdWx0Py52YWx1ZVxuICAgIH1cbn1cblxubGV0IGNvZGVDYWxsYmFja3MgPSB7XG4gICAgVW5hcnlFeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGlmIChjb2RlLm9wZXJhdG9yID09PSAnIScpIHtcbiAgICAgICAgICAgIHJldHVybiAhZXhlY3V0ZVNpbmdsZShjb2RlLmFyZ3VtZW50LCBtZXRhKVxuICAgICAgICB9XG4gICAgfSxcbiAgICBMb2dpY2FsRXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBpZiAoY29kZS5vcGVyYXRvciA9PT0gJyYmJykge1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSAmJiBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJ3x8Jykge1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSB8fCBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH1cbiAgICB9LFxuICAgIENvbmRpdGlvbmFsRXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLnRlc3QsIG1ldGEpID8gZXhlY3V0ZVNpbmdsZShjb2RlLmNvbnNlcXVlbnQsIG1ldGEpIDogZXhlY3V0ZVNpbmdsZShjb2RlLmFsdGVybmF0ZSwgbWV0YSlcbiAgICB9LFxuICAgIFRoaXNFeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIHJldHVybiBtZXRhLmNyZWF0dXJlLnRoaXNPYmpcbiAgICB9LFxuICAgIEpTWEV4cHJlc3Npb25Db250YWluZXI6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5leHByZXNzaW9uLCBtZXRhKVxuICAgIH0sXG4gICAgSlNYVGV4dDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICByZXR1cm4gY29kZS52YWx1ZS50cmltKCk7XG4gICAgfSxcbiAgICBKU1hFbGVtZW50OiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGlmICghY29kZS5jb3Ntb0lkKSBjb2RlLmNvc21vSWQgPSBVdGlscy5nZW5lcmF0b3IuZ2VuZXJhdGVLZXkoKVxuICAgICAgICBsZXQgQ29udHJvbCA9IG1ldGEuY3JlYXR1cmUubW9kdWxlLmFwcGxldC5maW5kTW9kdWxlKGNvZGUub3BlbmluZ0VsZW1lbnQubmFtZS5uYW1lKVxuICAgICAgICBsZXQgYXR0cnMgPSB7fVxuICAgICAgICBjb2RlLm9wZW5pbmdFbGVtZW50LmF0dHJpYnV0ZXMuZm9yRWFjaCgoYXR0cjogYW55KSA9PiB7XG4gICAgICAgICAgICBhdHRyc1thdHRyLm5hbWUubmFtZV0gPSBleGVjdXRlU2luZ2xlKGF0dHIudmFsdWUsIG1ldGEpXG4gICAgICAgIH0pXG4gICBcbiAgICAgICAgbGV0IGtleSA9IGF0dHJzWydrZXknXVxuICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGtleSA9IGNvZGUuY29zbW9JZFxuICAgICAgICB9XG4gICAgICAgIGlmIChtZXRhLnBhcmVudEpzeEtleSkga2V5ID0gbWV0YS5wYXJlbnRKc3hLZXkgKyAnLScgKyBrZXlcbiAgICAgICAgYXR0cnNbJ2tleSddID0ga2V5XG5cbiAgICAgICAgbGV0IGM6IENyZWF0dXJlID0gbWV0YS5jcmVhdHVyZS5tb2R1bGUuYXBwbGV0LmNhY2hlLmVsZW1lbnRzW2tleV07XG4gICAgICAgIGxldCBpc05ldyA9IChjID09PSB1bmRlZmluZWQpXG5cbiAgICAgICAgYyA9IENvbnRyb2wuaW5zdGFudGlhdGUoYXR0cnMsIGF0dHJzWydzdHlsZSddLCBbXSwgYz8udGhpc09iailcblxuICAgICAgICBsZXQgY2hpbGRNZXRhID0gbmV3IEV4ZWN1dGlvbk1ldGEoeyAuLi5tZXRhLCBwYXJlbnRKc3hLZXk6IGtleSB9KVxuICAgICAgICBsZXQgY2hpbGRyZW4gPSBjb2RlLmNoaWxkcmVuLm1hcCgoY2hpbGQ6IGFueSkgPT4gZXhlY3V0ZVNpbmdsZShjaGlsZCwgY2hpbGRNZXRhKSlcbiAgICAgICAgICAgIC5mbGF0KEluZmluaXR5KS5maWx0ZXIoKGNoaWxkOiBhbnkpID0+IChjaGlsZCAhPT0gJycpKVxuICAgICAgICBjLmZpbGxDaGlsZHJlbihjaGlsZHJlbilcbiAgICAgICAgaWYgKG1ldGEucGFyZW50SnN4S2V5KSBjLnRoaXNPYmoucGFyZW50SnN4S2V5ID0gbWV0YS5wYXJlbnRKc3hLZXlcblxuICAgICAgICBsZXQgbmV3TWV0YUJyYW5jaCA9IFV0aWxzLmdlbmVyYXRvci5uZXN0ZWRDb250ZXh0KGMsIHsgLi4ubWV0YSwgcGFyZW50SnN4S2V5OiBrZXkgfSlcbiAgICAgICAgbWV0YS5jcmVhdHVyZS5tb2R1bGUuYXBwbGV0LmNhY2hlLmVsZW1lbnRzW2tleV0gPSBjXG4gICAgICAgIGlmIChpc05ldykgYy5nZXRCYXNlTWV0aG9kKCdjb25zdHJ1Y3RvcicpKG5ld01ldGFCcmFuY2gpXG4gICAgICAgIGlmIChtZXRhLmNyZWF0dXJlLm1vZHVsZS5hcHBsZXQuZmlyc3RNb3VudCkge1xuICAgICAgICAgICAgYy5nZXRCYXNlTWV0aG9kKCdvbk1vdW50JykobmV3TWV0YUJyYW5jaClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1ldGEuY3JlYXR1cmUubW9kdWxlLmFwcGxldC5jYWNoZS5tb3VudHMucHVzaCgoKSA9PiBjLmdldEJhc2VNZXRob2QoJ29uTW91bnQnKShuZXdNZXRhQnJhbmNoKSlcbiAgICAgICAgfVxuICAgICAgICBsZXQgciA9IGMuZ2V0QmFzZU1ldGhvZCgncmVuZGVyJykobmV3TWV0YUJyYW5jaClcbiAgICAgICAgaWYgKCFtZXRhLmNyZWF0dXJlLm1vZHVsZS5hcHBsZXQub2xkVmVyc2lvbnNbYy5fa2V5XSkge1xuICAgICAgICAgICAgbWV0YS5jcmVhdHVyZS5tb2R1bGUuYXBwbGV0Lm9sZFZlcnNpb25zW2MuX2tleV0gPSByXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJcbiAgICB9LFxuICAgIFByb2dyYW06IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgY29kZS5ib2R5LmZvckVhY2goKGNoaWxkOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGV4ZWN1dGVTaW5nbGUoY2hpbGQsIG1ldGEpXG4gICAgICAgIH0pXG4gICAgfSxcbiAgICBMaXRlcmFsOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIHJldHVybiBjb2RlLnZhbHVlXG4gICAgfSxcbiAgICBGdW5jdGlvbkV4cHJlc3Npb246IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgbGV0IG5ld0NyZWF0dXJlQnJhbmNoID0gbmV3IENyZWF0dXJlKG1ldGEuY3JlYXR1cmUubW9kdWxlLCB7IC4uLm1ldGEuY3JlYXR1cmUsIHJ1bnRpbWU6IG1ldGEuY3JlYXR1cmUucnVudGltZS5jbG9uZSgpIH0pXG4gICAgICAgIGxldCBuZXdNZXRhQnJhbmNoID0gbmV3IEV4ZWN1dGlvbk1ldGEoeyAuLi5tZXRhLCBjcmVhdHVyZTogbmV3Q3JlYXR1cmVCcmFuY2ggfSlcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlQ2FsbGJhY2tGdW5jdGlvbihjb2RlLCBuZXdNZXRhQnJhbmNoKVxuICAgIH0sXG4gICAgRnVuY3Rpb25EZWNsYXJhdGlvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBsZXQgbmV3Q3JlYXR1cmVCcmFuY2ggPSBuZXcgQ3JlYXR1cmUobWV0YS5jcmVhdHVyZS5tb2R1bGUsIHsgLi4ubWV0YS5jcmVhdHVyZSwgcnVudGltZTogbWV0YS5jcmVhdHVyZS5ydW50aW1lLmNsb25lKCkgfSlcbiAgICAgICAgbGV0IG5ld01ldGFCcmFuY2ggPSBuZXcgRXhlY3V0aW9uTWV0YSh7IC4uLm1ldGEsIGNyZWF0dXJlOiBuZXdDcmVhdHVyZUJyYW5jaCB9KVxuICAgICAgICBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuc3RhY2tUb3AucHV0VW5pdChjb2RlLmlkLm5hbWUsIGdlbmVyYXRlQ2FsbGJhY2tGdW5jdGlvbihjb2RlLCBuZXdNZXRhQnJhbmNoKSlcbiAgICB9LFxuICAgIE1ldGhvZERlZmluaXRpb246IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgbWV0YS5jcmVhdHVyZS5ydW50aW1lLnN0YWNrVG9wLnB1dFVuaXQoY29kZS5rZXkubmFtZSwgZXhlY3V0ZVNpbmdsZShjb2RlLnZhbHVlLCBtZXRhKSlcbiAgICB9LFxuICAgIFZhcmlhYmxlRGVjbGFyYXRpb246IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgaWYgKGNvZGUua2luZCA9PT0gJ2xldCcpIHtcbiAgICAgICAgICAgIGNvZGUuZGVjbGFyYXRpb25zLmZvckVhY2goKGQ6IGFueSkgPT4gZXhlY3V0ZVNpbmdsZShkLCBuZXcgRXhlY3V0aW9uTWV0YSh7IC4uLm1ldGEsIGRlY2xhcmF0aW9uOiB0cnVlLCBkZWNsYXJhdGlvblR5cGU6ICdsZXQnIH0pKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5raW5kID09PSAnY29uc3QnKSB7XG4gICAgICAgICAgICBjb2RlLmRlY2xhcmF0aW9ucy5mb3JFYWNoKChkOiBhbnkpID0+IGV4ZWN1dGVTaW5nbGUoZCwgbmV3IEV4ZWN1dGlvbk1ldGEoeyAuLi5tZXRhLCBkZWNsYXJhdGlvbjogdHJ1ZSwgZGVjbGFyYXRpb25UeXBlOiAnY29uc3QnIH0pKSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIFZhcmlhYmxlRGVjbGFyYXRvcjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBpZiAobWV0YT8uZGVjbGFyYXRpb24pIHtcbiAgICAgICAgICAgIGxldCB2YWwgPSBleGVjdXRlU2luZ2xlKGNvZGUuaW5pdCwgbWV0YSlcbiAgICAgICAgICAgIGlmIChjb2RlLmlkLnR5cGUgPT09ICdPYmplY3RQYXR0ZXJuJykge1xuICAgICAgICAgICAgICAgIGNvZGUuaWQucHJvcGVydGllcy5mb3JFYWNoKChwcm9wZXJ0eTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGEuY3JlYXR1cmUucnVudGltZS5zdGFja1RvcC5wdXRVbml0KHByb3BlcnR5LmtleS5uYW1lLCB2YWxbcHJvcGVydHkua2V5Lm5hbWVdKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuc3RhY2tUb3AucHV0VW5pdChjb2RlLmlkLm5hbWUsIHZhbClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgSWRlbnRpZmllcjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBpZiAobWV0YS5yZXR1cm5JZFBhcmVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IG1ldGEuY3JlYXR1cmUucnVudGltZS5zdGFjay5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgICAgIGxldCB3cmFwcGVyID0gZmluZExheWVyKG1ldGEsIGNvZGUubmFtZSlcbiAgICAgICAgICAgICAgICBpZiAod3JhcHBlcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBwYXJlbnQ6IHdyYXBwZXIudW5pdHMsIGlkOiBjb2RlLm5hbWUgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuc3RhY2subGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICBsZXQgciA9IG1ldGEuY3JlYXR1cmUucnVudGltZS5zdGFja1tpXS5maW5kVW5pdChjb2RlLm5hbWUpXG4gICAgICAgICAgICAgICAgaWYgKHIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgQmluYXJ5RXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBpZiAoY29kZS5vcGVyYXRvciA9PT0gJysnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLmxlZnQsIG1ldGEpICsgZXhlY3V0ZVNpbmdsZShjb2RlLnJpZ2h0LCBtZXRhKVxuICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICctJykge1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSAtIGV4ZWN1dGVTaW5nbGUoY29kZS5yaWdodCwgbWV0YSlcbiAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnKicpIHtcbiAgICAgICAgICAgIHJldHVybiBleGVjdXRlU2luZ2xlKGNvZGUubGVmdCwgbWV0YSkgKiBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJy8nKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLmxlZnQsIG1ldGEpIC8gZXhlY3V0ZVNpbmdsZShjb2RlLnJpZ2h0LCBtZXRhKVxuICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICdeJykge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGgucG93KGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSwgZXhlY3V0ZVNpbmdsZShjb2RlLnJpZ2h0LCBtZXRhKSlcbiAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnJScpIHtcbiAgICAgICAgICAgIHJldHVybiBleGVjdXRlU2luZ2xlKGNvZGUubGVmdCwgbWV0YSkgJSBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJz09PScpIHtcbiAgICAgICAgICAgIHJldHVybiBleGVjdXRlU2luZ2xlKGNvZGUubGVmdCwgbWV0YSkgPT09IGV4ZWN1dGVTaW5nbGUoY29kZS5yaWdodCwgbWV0YSlcbiAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnPCcpIHtcbiAgICAgICAgICAgIHJldHVybiBleGVjdXRlU2luZ2xlKGNvZGUubGVmdCwgbWV0YSkgPCBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJz4nKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLmxlZnQsIG1ldGEpID4gZXhlY3V0ZVNpbmdsZShjb2RlLnJpZ2h0LCBtZXRhKVxuICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICcmJykge1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSAmIGV4ZWN1dGVTaW5nbGUoY29kZS5yaWdodCwgbWV0YSlcbiAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnfCcpIHtcbiAgICAgICAgICAgIHJldHVybiBleGVjdXRlU2luZ2xlKGNvZGUubGVmdCwgbWV0YSkgfCBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH1cbiAgICB9LFxuICAgIElmU3RhdGVtZW50OiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGlmIChleGVjdXRlU2luZ2xlKGNvZGUudGVzdCwgbWV0YSkpIHtcbiAgICAgICAgICAgIGxldCByID0gZXhlY3V0ZVNpbmdsZShjb2RlLmNvbnNlcXVlbnQsIG1ldGEpXG4gICAgICAgICAgICBpZiAocj8uYnJlYWtGaXJlZCkgcmV0dXJuIHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHI/LnJldHVybkZpcmVkKSByZXR1cm4gclxuICAgICAgICB9IGVsc2UgaWYgKGNvZGUuYWx0ZXJuYXRlKSB7XG4gICAgICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY29kZS5hbHRlcm5hdGUsIG1ldGEpXG4gICAgICAgICAgICBpZiAocj8uYnJlYWtGaXJlZCkgcmV0dXJuIHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHI/LnJldHVybkZpcmVkKSByZXR1cm4gclxuICAgICAgICB9XG4gICAgfSxcbiAgICBCcmVha1N0YXRlbWVudDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICByZXR1cm4geyBicmVha0ZpcmVkOiB0cnVlIH07XG4gICAgfSxcbiAgICBXaGlsZVN0YXRlbWVudDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICB3aGlsZSAoZXhlY3V0ZVNpbmdsZShjb2RlLnRlc3QsIG1ldGEpKSB7XG4gICAgICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY29kZS5ib2R5LCBtZXRhKVxuICAgICAgICAgICAgaWYgKHI/LmJyZWFrRmlyZWQpIGJyZWFrXG4gICAgICAgICAgICBlbHNlIGlmIChyPy5yZXR1cm5GaXJlZCkgcmV0dXJuIHJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgQmxvY2tTdGF0ZW1lbnQ6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb2RlLmJvZHk/Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY29kZS5ib2R5W2ldLCBtZXRhKVxuICAgICAgICAgICAgaWYgKHI/LmJyZWFrRmlyZWQpIHJldHVybiByXG4gICAgICAgICAgICBlbHNlIGlmIChyPy5yZXR1cm5GaXJlZCkgcmV0dXJuIHJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgRXhwcmVzc2lvblN0YXRlbWVudDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLmV4cHJlc3Npb24sIG1ldGEpXG4gICAgfSxcbiAgICBBc3NpZ25tZW50RXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBsZXQgcmlnaHQgPSBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIGxldCB3cmFwcGVyID0gZXhlY3V0ZVNpbmdsZShjb2RlLmxlZnQsIHsgLi4ubWV0YSwgcmV0dXJuSWRQYXJlbnQ6IHRydWUgfSlcbiAgICAgICAgaWYgKHdyYXBwZXIpIHtcbiAgICAgICAgICAgIGlmICh3cmFwcGVyLnBhcmVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbGV0IGJlZm9yZSA9IHdyYXBwZXIucGFyZW50W3dyYXBwZXIuaWRdXG4gICAgICAgICAgICAgICAgaWYgKGNvZGUub3BlcmF0b3IgPT09ICc9Jykge1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnBhcmVudFt3cmFwcGVyLmlkXSA9IHJpZ2h0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnKz0nKSB7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZXIucGFyZW50W3dyYXBwZXIuaWRdID0gYmVmb3JlICsgcmlnaHRcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICctPScpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlci5wYXJlbnRbd3JhcHBlci5pZF0gPSBiZWZvcmUgLSByaWdodFxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJyo9Jykge1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnBhcmVudFt3cmFwcGVyLmlkXSA9IGJlZm9yZSAqIHJpZ2h0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnLz0nKSB7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZXIucGFyZW50W3dyYXBwZXIuaWRdID0gYmVmb3JlIC8gcmlnaHRcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICdePScpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlci5wYXJlbnRbd3JhcHBlci5pZF0gPSBNYXRoLnBvdyhiZWZvcmUsIHJpZ2h0KVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJyU9Jykge1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnBhcmVudFt3cmFwcGVyLmlkXSA9IGJlZm9yZSAlIHJpZ2h0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgbGF5ZXIgPSBmaW5kTGF5ZXIobWV0YSwgd3JhcHBlci5pZClcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHIgPSBsYXllci5maW5kVW5pdCh3cmFwcGVyLmlkKVxuICAgICAgICAgICAgICAgICAgICBpZiAocikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvZGUub3BlcmF0b3IgPT09ICc9Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHIgPSByaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnKz0nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgciArPSByaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnLT0nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgciAtPSByaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnKj0nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgciAqPSByaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnLz0nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgciAvPSByaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnXj0nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgciA9IE1hdGgucG93KHIsIHJpZ2h0KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnJT0nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgciAlPSByaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIucHV0VW5pdChjb2RlLm5hbWUsIHIpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIEZvclN0YXRlbWVudDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBmb3IgKGV4ZWN1dGVTaW5nbGUoY29kZS5pbml0LCBtZXRhKTsgZXhlY3V0ZVNpbmdsZShjb2RlLnRlc3QsIG1ldGEpOyBleGVjdXRlU2luZ2xlKGNvZGUudXBkYXRlLCBtZXRhKSkge1xuICAgICAgICAgICAgbGV0IHIgPSBleGVjdXRlU2luZ2xlKGNvZGUuYm9keSwgbWV0YSlcbiAgICAgICAgICAgIGlmIChyPy5icmVha0ZpcmVkKSBicmVha1xuICAgICAgICAgICAgZWxzZSBpZiAocj8ucmV0dXJuRmlyZWQpIHJldHVybiByXG4gICAgICAgIH1cbiAgICB9LFxuICAgIFVwZGF0ZUV4cHJlc3Npb246IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgaWYgKFsnKysnLCAnLS0nXS5pbmNsdWRlcyhjb2RlLm9wZXJhdG9yKSkge1xuICAgICAgICAgICAgbGV0IHdyYXBwZXIgPSBleGVjdXRlU2luZ2xlKGNvZGUuYXJndW1lbnQsIHsgLi4ubWV0YSwgcmV0dXJuSWRQYXJlbnQ6IHRydWUgfSlcbiAgICAgICAgICAgIGlmICh3cmFwcGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKHdyYXBwZXIucGFyZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJlZm9yZSA9IHdyYXBwZXIucGFyZW50W3dyYXBwZXIuaWRdXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYmVmb3JlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvZGUub3BlcmF0b3IgPT09ICcrKycpIGJlZm9yZSsrXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnLS0nKSBiZWZvcmUtLVxuICAgICAgICAgICAgICAgICAgICAgICAgd3JhcHBlci5wYXJlbnRbd3JhcHBlci5pZF0gPSBiZWZvcmVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBsYXllciA9IGZpbmRMYXllcihtZXRhLCB3cmFwcGVyLmlkKVxuICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByID0gbGF5ZXIuZmluZFVuaXQod3JhcHBlci5pZClcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiByID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29kZS5vcGVyYXRvciA9PT0gJysrJykgcisrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICctLScpIHItLVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5wdXRVbml0KGNvZGUubmFtZSwgcilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIENhbGxFeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGxldCBwcm9wID0gdW5kZWZpbmVkXG4gICAgICAgIGlmIChjb2RlLnByb3BlcnR5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGxldCByID0gZXhlY3V0ZVNpbmdsZShjb2RlLmNhbGxlZSwgbWV0YSk7XG4gICAgICAgICAgICByZXR1cm4gciguLi5jb2RlLmFyZ3VtZW50cy5tYXAoKGM6IGFueSkgPT4gZXhlY3V0ZVNpbmdsZShjLCBtZXRhKSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGNvZGUuY2FsbGVlLnByb3BlcnR5LnR5cGUgPT09ICdJZGVudGlmaWVyJykge1xuICAgICAgICAgICAgICAgIHByb3AgPSBjb2RlLmNhbGxlZS5wcm9wZXJ0eS5uYW1lXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY29kZS5jYWxsZWUub2JqZWN0LCBtZXRhKTtcbiAgICAgICAgICAgIHJldHVybiByW3Byb3BdKC4uLmNvZGUuYXJndW1lbnRzLm1hcCgoYzogYW55KSA9PiBleGVjdXRlU2luZ2xlKGMsIG1ldGEpKSlcbiAgICAgICAgfVxuICAgIH0sXG4gICAgTWVtYmVyRXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBsZXQgcHJvcCA9IHVuZGVmaW5lZFxuICAgICAgICBpZiAoY29kZS5wcm9wZXJ0eSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY29kZS5vYmplY3QsIG1ldGEpO1xuICAgICAgICAgICAgaWYgKG1ldGEucmV0dXJuSWRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBwYXJlbnQ6IHVuZGVmaW5lZCwgaWQ6IGNvZGUubmFtZSB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGNvZGUuY29tcHV0ZWQpIHtcbiAgICAgICAgICAgICAgICBwcm9wID0gZXhlY3V0ZVNpbmdsZShjb2RlLnByb3BlcnR5LCBtZXRhKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvZGUucHJvcGVydHkudHlwZSA9PT0gJ0lkZW50aWZpZXInKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3AgPSBjb2RlLnByb3BlcnR5Lm5hbWVcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvZGUucHJvcGVydHkudHlwZSA9PT0gJ0xpdGVyYWwnKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3AgPSBjb2RlLnByb3BlcnR5LnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBmaWx0ZXJlZE1ldGEgPSB7IC4uLm1ldGEgfVxuICAgICAgICAgICAgZGVsZXRlIGZpbHRlcmVkTWV0YVsncmV0dXJuSWRQYXJlbnQnXVxuICAgICAgICAgICAgbGV0IHIgPSBleGVjdXRlU2luZ2xlKGNvZGUub2JqZWN0LCBmaWx0ZXJlZE1ldGEpO1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocikpIHtcbiAgICAgICAgICAgICAgICBsZXQgcCA9IHJbcHJvcF07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAoLi4uYXJnczogQXJyYXk8YW55PikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChwcm9wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAncHVzaCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHIucHVzaCguLi5hcmdzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdtYXAnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByLm1hcCguLi5hcmdzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdmb3JFYWNoJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gci5mb3JFYWNoKC4uLmFyZ3MpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtZXRhLnJldHVybklkUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBwYXJlbnQ6IHIsIGlkOiBwcm9wIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByW3Byb3BdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobWV0YS5yZXR1cm5JZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBwYXJlbnQ6IHIsIGlkOiBwcm9wIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcltwcm9wXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIFN3aXRjaFN0YXRlbWVudDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBsZXQgZGlzYyA9IGV4ZWN1dGVTaW5nbGUoY29kZS5kaXNjcmltaW5hbnQsIG1ldGEpXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29kZS5jYXNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IGMgPSBjb2RlLmNhc2VzW2ldXG4gICAgICAgICAgICBpZiAoYy50eXBlID09PSAnU3dpdGNoQ2FzZScpIHtcbiAgICAgICAgICAgICAgICBsZXQgY2FzZUNvbmQgPSBleGVjdXRlU2luZ2xlKGMudGVzdCwgbWV0YSk7XG4gICAgICAgICAgICAgICAgaWYgKGRpc2MgPT09IGNhc2VDb25kKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYy5jb25zZXF1ZW50Lmxlbmd0aGw7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNvID0gYy5jb25zZXF1ZW50W2pdXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY28sIG1ldGEpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocj8ucmV0dXJuRmlyZWQpIHJldHVybiByXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIEFycm93RnVuY3Rpb25FeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGxldCBuZXdDcmVhdHVyZUJyYW5jaCA9IG5ldyBDcmVhdHVyZShtZXRhLmNyZWF0dXJlLm1vZHVsZSwgeyAuLi5tZXRhLmNyZWF0dXJlLCBydW50aW1lOiBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuY2xvbmUoKSB9KVxuICAgICAgICBsZXQgbmV3TWV0YUJyYW5jaCA9IG5ldyBFeGVjdXRpb25NZXRhKHsgLi4ubWV0YSwgY3JlYXR1cmU6IG5ld0NyZWF0dXJlQnJhbmNoIH0pXG4gICAgICAgIHJldHVybiBnZW5lcmF0ZUNhbGxiYWNrRnVuY3Rpb24oY29kZSwgbmV3TWV0YUJyYW5jaClcbiAgICB9LFxuICAgIE9iamVjdEV4cHJlc3Npb246IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgbGV0IG9iaiA9IHt9XG4gICAgICAgIGNvZGUucHJvcGVydGllcy5mb3JFYWNoKChwcm9wZXJ0eTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAocHJvcGVydHkudHlwZSA9PT0gJ1Byb3BlcnR5Jykge1xuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eS5rZXkudHlwZSA9PT0gJ0lkZW50aWZpZXInKSB7XG4gICAgICAgICAgICAgICAgICAgIG9ialtwcm9wZXJ0eS5rZXkubmFtZV0gPSBleGVjdXRlU2luZ2xlKHByb3BlcnR5LnZhbHVlLCBtZXRhKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5LnR5cGUgPT09ICdTcHJlYWRFbGVtZW50Jykge1xuICAgICAgICAgICAgICAgICAgICBvYmpbcHJvcGVydHkuYXJndW1lbnQubmFtZV0gPSBleGVjdXRlU2luZ2xlKHByb3BlcnR5LCBtZXRhKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIG9ialxuICAgIH0sXG4gICAgQXJyYXlFeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGxldCByZXN1bHQgPSBbXVxuICAgICAgICBjb2RlLmVsZW1lbnRzLmZvckVhY2goKGFyckVsOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGxldCByID0gZXhlY3V0ZVNpbmdsZShhcnJFbCwgbWV0YSlcbiAgICAgICAgICAgIGlmICgoYXJyRWwudHlwZSA9PT0gJ1NwcmVhZEVsZW1lbnQnKSAmJiBBcnJheS5pc0FycmF5KHIpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goLi4ucilcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gocilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH0sXG4gICAgU3ByZWFkRWxlbWVudDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBsZXQgc291cmNlID0gZXhlY3V0ZVNpbmdsZShjb2RlLmFyZ3VtZW50LCBtZXRhKVxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShzb3VyY2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gWy4uLnNvdXJjZV1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB7IC4uLnNvdXJjZSB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIFJldHVyblN0YXRlbWVudDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICByZXR1cm4geyB2YWx1ZTogZXhlY3V0ZVNpbmdsZShjb2RlLmFyZ3VtZW50LCBtZXRhKSwgcmV0dXJuRmlyZWQ6IHRydWUgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgeyBleGVjdXRlU2luZ2xlLCBleGVjdXRlQmxvY2ssIEV4ZWN1dGlvbk1ldGEgfVxuIiwiXG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSBcIi4uL2VsZW1lbnRzL0Jhc2VFbGVtZW50XCI7XG5pbXBvcnQgQmFzZVByb3AgZnJvbSBcIi4uL3Byb3BzL0Jhc2VQcm9wXCI7XG5pbXBvcnQgRXhlY3V0aW9uTWV0YSBmcm9tIFwiLi4vRXhlY3V0aW9uTWV0YVwiO1xuaW1wb3J0IENyZWF0dXJlIGZyb20gXCIuLi9DcmVhdHVyZVwiO1xuXG5sZXQgZ2VuZXJhdGVLZXkgPSAoKSA9PiB7XG4gICAgcmV0dXJuIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoKS5zdWJzdHJpbmcoMilcbn1cblxuZnVuY3Rpb24gY2xvbmU8VD4oaW5zdGFuY2U6IFQpOiBUIHtcbiAgICBjb25zdCBjb3B5ID0gbmV3IChpbnN0YW5jZS5jb25zdHJ1Y3RvciBhcyB7IG5ldygpOiBUIH0pKCk7XG4gICAgT2JqZWN0LmFzc2lnbihjb3B5LCBpbnN0YW5jZSk7XG4gICAgcmV0dXJuIGNvcHk7XG59XG5cbmNvbnN0IHByZXBhcmVFbGVtZW50ID0gKFxuICAgIHR5cGVOYW1lOiBzdHJpbmcsXG4gICAgZGVmYXVsdFByb3BzOiB7IFtpZDogc3RyaW5nXTogQmFzZVByb3AgfSxcbiAgICBvdmVycmlkZW5Qcm9wczogeyBbaWQ6IHN0cmluZ106IGFueSB9LFxuICAgIGRlZmF1bHRTdHlsZXM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSxcbiAgICBvdmVycmlkZW5TdHlsZXM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSxcbiAgICBjaGlsZHJlbjogQXJyYXk8QmFzZUVsZW1lbnQ+XG4pID0+IHtcbiAgICBsZXQgZmluYWxQcm9wcyA9IHt9XG4gICAgT2JqZWN0LmtleXMoZGVmYXVsdFByb3BzKS5mb3JFYWNoKHByb3BLZXkgPT4ge1xuICAgICAgICBpZiAob3ZlcnJpZGVuUHJvcHNbcHJvcEtleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGV0IGJwUHJvcCA9IGRlZmF1bHRQcm9wc1twcm9wS2V5XVxuICAgICAgICAgICAgbGV0IGNvcGllZFByb3AgPSBjbG9uZShicFByb3ApXG4gICAgICAgICAgICBjb3BpZWRQcm9wLnNldFZhbHVlKG92ZXJyaWRlblByb3BzW3Byb3BLZXldKVxuICAgICAgICAgICAgZmluYWxQcm9wc1twcm9wS2V5XSA9IGNvcGllZFByb3BcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGxldCBmaW5hbFN0eWxlcyA9IHsgLi4uZGVmYXVsdFN0eWxlcyB9XG4gICAgaWYgKG92ZXJyaWRlblN0eWxlcykgZmluYWxTdHlsZXMgPSB7IC4uLmZpbmFsU3R5bGVzLCAuLi5vdmVycmlkZW5TdHlsZXMgfVxuICAgIHJldHVybiBuZXcgQmFzZUVsZW1lbnQob3ZlcnJpZGVuUHJvcHNbJ2tleSddLCB0eXBlTmFtZSwgZmluYWxQcm9wcywgZmluYWxTdHlsZXMsIGNoaWxkcmVuKVxufVxuXG5jb25zdCBuZXN0ZWRDb250ZXh0ID0gKGNyZWF0dXJlOiBDcmVhdHVyZSwgb3RoZXJNZXRhcz86IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICBpZiAob3RoZXJNZXRhcykge1xuICAgICAgICByZXR1cm4gbmV3IEV4ZWN1dGlvbk1ldGEoeyAuLi5vdGhlck1ldGFzLCBjcmVhdHVyZSwgaXNBbm90aGVyQ3JlYXR1cmU6IHRydWUgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IEV4ZWN1dGlvbk1ldGEoeyBjcmVhdHVyZSwgaXNBbm90aGVyQ3JlYXR1cmU6IHRydWUgfSlcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgZ2VuZXJhdGVLZXksIHByZXBhcmVFbGVtZW50LCBuZXN0ZWRDb250ZXh0IH1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgbXNQYXR0ZXJuID0gL15tcy0vO1xuXG52YXIgX3VwcGVyY2FzZVBhdHRlcm4gPSAvKFtBLVpdKS9nO1xuXG4vKipcbiAqIEh5cGhlbmF0ZXMgYSBjYW1lbGNhc2VkIHN0cmluZywgZm9yIGV4YW1wbGU6XG4gKlxuICogICA+IGh5cGhlbmF0ZSgnYmFja2dyb3VuZENvbG9yJylcbiAqICAgPCBcImJhY2tncm91bmQtY29sb3JcIlxuICpcbiAqIEZvciBDU1Mgc3R5bGUgbmFtZXMsIHVzZSBgaHlwaGVuYXRlU3R5bGVOYW1lYCBpbnN0ZWFkIHdoaWNoIHdvcmtzIHByb3Blcmx5XG4gKiB3aXRoIGFsbCB2ZW5kb3IgcHJlZml4ZXMsIGluY2x1ZGluZyBgbXNgLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHJpbmdcbiAqIEByZXR1cm4ge3N0cmluZ31cbiAqL1xuZnVuY3Rpb24gaHlwaGVuYXRlKHN0cmluZykge1xuICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoX3VwcGVyY2FzZVBhdHRlcm4sICctJDEnKS50b0xvd2VyQ2FzZSgpO1xufVxuXG4vKipcbiAqIEh5cGhlbmF0ZXMgYSBjYW1lbGNhc2VkIENTUyBwcm9wZXJ0eSBuYW1lLCBmb3IgZXhhbXBsZTpcbiAqXG4gKiAgID4gaHlwaGVuYXRlU3R5bGVOYW1lKCdiYWNrZ3JvdW5kQ29sb3InKVxuICogICA8IFwiYmFja2dyb3VuZC1jb2xvclwiXG4gKiAgID4gaHlwaGVuYXRlU3R5bGVOYW1lKCdNb3pUcmFuc2l0aW9uJylcbiAqICAgPCBcIi1tb3otdHJhbnNpdGlvblwiXG4gKiAgID4gaHlwaGVuYXRlU3R5bGVOYW1lKCdtc1RyYW5zaXRpb24nKVxuICogICA8IFwiLW1zLXRyYW5zaXRpb25cIlxuICpcbiAqIEFzIE1vZGVybml6ciBzdWdnZXN0cyAoaHR0cDovL21vZGVybml6ci5jb20vZG9jcy8jcHJlZml4ZWQpLCBhbiBgbXNgIHByZWZpeFxuICogaXMgY29udmVydGVkIHRvIGAtbXMtYC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nXG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGh5cGhlbmF0ZVN0eWxlTmFtZShzdHJpbmcpIHtcbiAgcmV0dXJuIGh5cGhlbmF0ZShzdHJpbmcpLnJlcGxhY2UobXNQYXR0ZXJuLCAnLW1zLScpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBoeXBoZW5hdGVTdHlsZU5hbWVcbiIsIlxuaW1wb3J0IGdlbmVyYXRvciBmcm9tICcuL2dlbmVyYXRvcidcbmltcG9ydCBjb21waWxlciBmcm9tICcuL2NvbXBpbGVyJ1xuaW1wb3J0IGpzb24gZnJvbSAnLi9qc29uJ1xuaW1wb3J0IGV4ZWN1dG9yIGZyb20gJy4vZXhlY3V0b3InXG5cbmV4cG9ydCBkZWZhdWx0IHsgZ2VuZXJhdG9yLCBjb21waWxlciwganNvbiwgZXhlY3V0b3IgfVxuIiwiXG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSBcIi4uL2VsZW1lbnRzL0Jhc2VFbGVtZW50XCJcblxubGV0IHByZXR0aWZ5ID0gKG9iajogYW55KSA9PiB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG9iaiwgdW5kZWZpbmVkLCA0KVxufVxuXG5sZXQgdXBkYXRlcyA9IFtdXG5cbmxldCBmaW5kQ2hhbmdlcyA9IChwYXJlbnRLZXk6IHN0cmluZywgZWwxOiBCYXNlRWxlbWVudCwgZWwyOiBCYXNlRWxlbWVudCkgPT4ge1xuICAgIGlmIChlbDEuX2tleSAhPT0gZWwyLl9rZXkpIHtcbiAgICAgICAgdXBkYXRlcy5wdXNoKFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIF9fYWN0aW9uX186ICdlbGVtZW50X2RlbGV0ZWQnLFxuICAgICAgICAgICAgICAgIF9fa2V5X186IGVsMS5fa2V5LFxuICAgICAgICAgICAgICAgIF9fcGFyZW50S2V5X186IHBhcmVudEtleVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBfX2FjdGlvbl9fOiAnZWxlbWVudF9jcmVhdGVkJyxcbiAgICAgICAgICAgICAgICBfX2tleV9fOiBlbDIuX2tleSxcbiAgICAgICAgICAgICAgICBfX2VsZW1lbnRfXzogSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShlbDIpKSxcbiAgICAgICAgICAgICAgICBfX3BhcmVudEtleV9fOiBwYXJlbnRLZXlcbiAgICAgICAgICAgIH1cbiAgICAgICAgKVxuICAgICAgICByZXR1cm5cbiAgICB9XG4gICAgbGV0IHByb3BzQ2hhbmdlcyA9IHsgX19hY3Rpb25fXzogJ3Byb3BzX3VwZGF0ZWQnLCBfX2tleV9fOiBlbDIuX2tleSwgX19jcmVhdGVkX186IHt9LCBfX2RlbGV0ZWRfXzoge30sIF9fdXBkYXRlZF9fOiB7fSB9XG4gICAgZm9yIChsZXQgcEtleSBpbiBlbDIuX3Byb3BzKSB7XG4gICAgICAgIGlmIChlbDEuX3Byb3BzW3BLZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHByb3BzQ2hhbmdlcy5fX2NyZWF0ZWRfX1twS2V5XSA9IGVsMi5fcHJvcHNbcEtleV0uZ2V0VmFsdWUoKVxuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAobGV0IHBLZXkgaW4gZWwxLl9wcm9wcykge1xuICAgICAgICBpZiAoZWwyLl9wcm9wc1twS2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBwcm9wc0NoYW5nZXMuX19kZWxldGVkX19bcEtleV0gPSBlbDIuX3Byb3BzW3BLZXldLmdldFZhbHVlKClcbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGxldCBwS2V5IGluIGVsMi5fcHJvcHMpIHtcbiAgICAgICAgaWYgKGVsMS5fcHJvcHNbcEtleV0gIT09IHVuZGVmaW5lZCAmJiBlbDIuX3Byb3BzW3BLZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChlbDEuX3Byb3BzW3BLZXldLmdldFZhbHVlKCkgIT09IGVsMi5fcHJvcHNbcEtleV0uZ2V0VmFsdWUoKSkge1xuICAgICAgICAgICAgICAgIHByb3BzQ2hhbmdlcy5fX3VwZGF0ZWRfX1twS2V5XSA9IGVsMi5fcHJvcHNbcEtleV0uZ2V0VmFsdWUoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcbiAgICAgICAgKE9iamVjdC5rZXlzKHByb3BzQ2hhbmdlcy5fX2NyZWF0ZWRfXykubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgKE9iamVjdC5rZXlzKHByb3BzQ2hhbmdlcy5fX2RlbGV0ZWRfXykubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgKE9iamVjdC5rZXlzKHByb3BzQ2hhbmdlcy5fX3VwZGF0ZWRfXykubGVuZ3RoID4gMClcbiAgICApIHtcbiAgICAgICAgdXBkYXRlcy5wdXNoKHByb3BzQ2hhbmdlcylcbiAgICB9XG4gICAgbGV0IHN0eWxlc0NoYW5nZXMgPSB7IF9fYWN0aW9uX186ICdzdHlsZXNfdXBkYXRlZCcsIF9fa2V5X186IGVsMi5fa2V5LCBfX2NyZWF0ZWRfXzoge30sIF9fZGVsZXRlZF9fOiB7fSwgX191cGRhdGVkX186IHt9IH1cbiAgICBmb3IgKGxldCBzS2V5IGluIGVsMi5fc3R5bGVzKSB7XG4gICAgICAgIGlmIChlbDEuX3N0eWxlc1tzS2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdHlsZXNDaGFuZ2VzLl9fY3JlYXRlZF9fW3NLZXldID0gZWwyLl9zdHlsZXNbc0tleV1cbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGxldCBzS2V5IGluIGVsMS5fc3R5bGVzKSB7XG4gICAgICAgIGlmIChlbDIuX3N0eWxlc1tzS2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdHlsZXNDaGFuZ2VzLl9fZGVsZXRlZF9fW3NLZXldID0gZWwyLl9zdHlsZXNbc0tleV1cbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGxldCBzS2V5IGluIGVsMi5fc3R5bGVzKSB7XG4gICAgICAgIGlmIChlbDEuX3N0eWxlc1tzS2V5XSAhPT0gdW5kZWZpbmVkICYmIGVsMi5fc3R5bGVzW3NLZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChlbDEuX3N0eWxlc1tzS2V5XSAhPT0gZWwyLl9zdHlsZXNbc0tleV0pIHtcbiAgICAgICAgICAgICAgICBzdHlsZXNDaGFuZ2VzLl9fdXBkYXRlZF9fW3NLZXldID0gZWwyLl9zdHlsZXNbc0tleV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoXG4gICAgICAgIChPYmplY3Qua2V5cyhzdHlsZXNDaGFuZ2VzLl9fY3JlYXRlZF9fKS5sZW5ndGggPiAwKSB8fFxuICAgICAgICAoT2JqZWN0LmtleXMoc3R5bGVzQ2hhbmdlcy5fX2RlbGV0ZWRfXykubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgKE9iamVjdC5rZXlzKHN0eWxlc0NoYW5nZXMuX191cGRhdGVkX18pLmxlbmd0aCA+IDApXG4gICAgKSB7XG4gICAgICAgIHVwZGF0ZXMucHVzaChzdHlsZXNDaGFuZ2VzKVxuICAgIH1cbiAgICBsZXQgY3MgPSB7fVxuICAgIGVsMi5fY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiB7IGNzW2NoaWxkLl9rZXldID0gY2hpbGQgfSlcbiAgICBlbDEuX2NoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xuICAgICAgICBpZiAoY3NbY2hpbGQuX2tleV0pIHtcbiAgICAgICAgICAgIGZpbmRDaGFuZ2VzKGVsMS5fa2V5LCBjaGlsZCwgY3NbY2hpbGQuX2tleV0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1cGRhdGVzLnB1c2goXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBfX2FjdGlvbl9fOiAnZWxlbWVudF9kZWxldGVkJyxcbiAgICAgICAgICAgICAgICAgICAgX19rZXlfXzogY2hpbGQuX2tleSxcbiAgICAgICAgICAgICAgICAgICAgX19wYXJlbnRLZXlfXzogZWwxLl9rZXlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApXG4gICAgICAgIH1cbiAgICB9KVxuICAgIGNzID0ge31cbiAgICBlbDEuX2NoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4geyBjc1tjaGlsZC5fa2V5XSA9IGNoaWxkIH0pXG4gICAgZWwyLl9jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgICAgaWYgKCFjc1tjaGlsZC5fa2V5XSkge1xuICAgICAgICAgICAgdXBkYXRlcy5wdXNoKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgX19hY3Rpb25fXzogJ2VsZW1lbnRfY3JlYXRlZCcsXG4gICAgICAgICAgICAgICAgICAgIF9fa2V5X186IGNoaWxkLl9rZXksXG4gICAgICAgICAgICAgICAgICAgIF9fZWxlbWVudF9fOiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGNoaWxkKSksXG4gICAgICAgICAgICAgICAgICAgIF9fcGFyZW50S2V5X186IGVsMi5fa2V5XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKVxuICAgICAgICB9XG4gICAgfSlcbn1cblxubGV0IGRpZmYgPSAoZWwxOiBCYXNlRWxlbWVudCwgZWwyOiBCYXNlRWxlbWVudCkgPT4ge1xuICAgIHVwZGF0ZXMgPSBbXVxuICAgIGZpbmRDaGFuZ2VzKHVuZGVmaW5lZCwgZWwxLCBlbDIpXG4gICAgcmV0dXJuIHVwZGF0ZXNcbn1cblxuZXhwb3J0IGRlZmF1bHQgeyBwcmV0dGlmeSwgZGlmZiB9XG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiXG5pbXBvcnQgTW9kdWxlIGZyb20gJy4vd2lkZ2V0L01vZHVsZSdcbmltcG9ydCBBcHBsZXQsIHsgUnVubmFibGUgfSBmcm9tICcuL3dpZGdldC9BcHBsZXQnXG5pbXBvcnQgVXRpbHMgZnJvbSAnLi93aWRnZXQvdXRpbHMnXG5pbXBvcnQgQ29udHJvbHMgZnJvbSAnLi93aWRnZXQvY29udHJvbHMnXG5cbmV4cG9ydCB7XG4gICAgQXBwbGV0LFxuICAgIFJ1bm5hYmxlLFxuICAgIE1vZHVsZSxcbiAgICBVdGlscyxcbiAgICBDb250cm9sc1xufSJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==
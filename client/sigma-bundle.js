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
                let keys = Object.keys(this.cache.elements).filter(k => {
                    if (k.startsWith(u.__key__)) {
                        delete this.cache.elements[k];
                        return true;
                    }
                    else {
                        return false;
                    }
                });
                if (keys.length > 0) {
                    let temp = keys[keys.length - 1].split('-');
                    if (temp.length > 1) {
                        let temp2 = temp.slice(0, temp.length - 1).join('-');
                        console.log('temp 2', temp2);
                        delete this.cache.elements[temp2];
                    }
                }
                console.log('after', this.cache.elements);
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
            console.log(stateUpdate);
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
        console.log(meta.parentJsxKey, key, code.cosmoId);
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
            __element__: el2,
            __parentKey__: parentKey
        });
        return;
    }
    let propsChanges = { __action__: 'props_updated', __key__: el2._key, __created__: {}, __deleted__: {}, __updated__: {} };
    for (let pKey in el2._props) {
        if (el1._props[pKey] === undefined) {
            propsChanges.__created__[pKey] = el2._props[pKey];
        }
    }
    for (let pKey in el1._props) {
        if (el2._props[pKey] === undefined) {
            propsChanges.__deleted__[pKey] = el2._props[pKey];
        }
    }
    for (let pKey in el2._props) {
        if (el1._props[pKey] !== undefined && el2._props[pKey] !== undefined) {
            if (el1._props[pKey].getValue() !== el2._props[pKey].getValue()) {
                propsChanges.__updated__[pKey] = el2._props[pKey];
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
                __element__: child,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lnbWEtYnVuZGxlLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBYTs7QUFFYixzQkFBc0IsbUJBQU8sQ0FBQyxrREFBUzs7QUFFdkM7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlDQUF5QyxpQkFBaUI7QUFDMUQsaURBQWlELGlCQUFpQjtBQUNsRTtBQUNBOztBQUVBO0FBQ0Esa0NBQWtDO0FBQ2xDLGtDQUFrQztBQUNsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBO0FBQ0E7O0FBRUEsaUJBQWlCO0FBQ2pCO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQSxtREFBa0Q7QUFDbEQ7QUFDQSx3QkFBd0IsbUJBQU8sQ0FBQyxpREFBTztBQUN2QyxHQUFHO0FBQ0g7QUFDQTtBQUNBLENBQUMsRUFBQzs7QUFFRjtBQUNBLGdDQUFnQyxtQkFBTyxDQUFDLGlEQUFPO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsdUJBQXVCO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsdUJBQXVCO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBLGdDQUFnQyxhQUFhLGtCQUFrQixpQ0FBaUM7QUFDaEc7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVk7QUFDWjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5QkFBeUI7QUFDekI7QUFDQTtBQUNBO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQjtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYztBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBWTtBQUNaO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRLDJDQUEyQztBQUNuRDtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLHlCQUF5QjtBQUN6QjtBQUNBO0FBQ0EsbUNBQW1DO0FBQ25DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSLGtDQUFrQztBQUNsQyxvQ0FBb0M7QUFDcEM7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7QUN2ZUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSxRQUFROztBQUVSO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBOztBQUVBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBLFFBQVE7O0FBRVI7QUFDQTtBQUNBLDJDQUEyQztBQUMzQztBQUNBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHdCQUF3Qjs7QUFFeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw2Q0FBNkM7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esd0NBQXdDLGNBQWM7QUFDdEQ7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLDZC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eUMsUUFBUTtBQUNqRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUSxPQUFPO0FBQ2Y7QUFDQSxzQkFBc0Isd0RBQXdEO0FBQzlFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxpQ0FBaUM7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0I7QUFDdEI7QUFDQSxpQ0FBaUM7QUFDakM7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxXQUFXO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBO0FBQ0Esc0NBQXNDO0FBQ3RDO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsUUFBUTs7QUFFUjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7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QUFFQSxrQkFBa0I7QUFDbEI7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsNkJBQTZCO0FBQzdCLDZCQUE2QjtBQUM3Qiw4QkFBOEI7QUFDOUI7QUFDQTtBQUNBLDJEQUEyRCxrQ0FBa0M7QUFDN0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7O0FBRVI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQTs7QUFFQTtBQUNBLDBDQUEwQyxRQUFRO0FBQ2xEO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBLFFBQVE7QUFDUjtBQUNBOztBQUVBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBLFVB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O0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSw0QkFBNEI7QUFDNUI7O0FBRUE7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLGlCQUFpQjs7QUFFakI7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0EsaUJBQWlCOztBQUVqQjtBQUNBOztBQUVBO0FBQ0EsUUFBUTtBQUNSO0FBQ0EsUUFBUTtBQUNSO0FBQ0EsUUFBUTs7QUFFUjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsNERBQTREO0FBQzVEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsNkNBQTZDO0FBQzdDLHlCQUF5QjtBQUN6QjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQSw0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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvRUFBb0U7QUFDcEUsUUFBUSxPQUFPOztBQUVmO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0EsWUFBWTtBQUNaLFFBQVE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSxRQUFRO0FBQ1I7QUFDQSwyREFBMkQ7QUFDM0Q7QUFDQTtBQUNBO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQSwwQkFBMEI7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDBCQUEwQjs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLGVBQWU7QUFDbEM7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFD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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQixzQkFBc0I7QUFDNUM7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMkRBQTJELGNBQWM7QUFDekU7QUFDQSxvQ0FBb0MsMkJBQTJCO0FBQy9EO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQjtBQUN0QjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVEsc0JBQXNCO0FBQzlCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBWTtBQUNaO0FBQ0E7QUFDQTtBQUNBLFlBQVk7QUFDWjtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLENBQUM7Ozs7Ozs7Ozs7Ozs7OztBQ24yTEQsd0ZBQWlDO0FBS2pDLE1BQWEsUUFBUTtJQUtqQixZQUFZLElBQWlCLEVBQUUsS0FBaUI7UUFDNUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJO1FBQ2hCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN0QixDQUFDO0NBQ0o7QUFURCw0QkFTQztBQUVELE1BQU0sTUFBTTtJQUdSLElBQVcsR0FBRyxLQUFLLE9BQU8sSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDO0lBTzlCLFVBQVUsQ0FBQyxFQUFVLElBQUksT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUM7SUFDbkQsU0FBUyxDQUFDLE1BQWM7UUFDM0IsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTTtJQUN0QyxDQUFDO0lBQ00sWUFBWSxDQUFDLEdBQVcsSUFBSSxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQztJQUl2RCxJQUFJLENBQUMsT0FBWTtRQUNwQixJQUFJLENBQUMsVUFBVSxHQUFHLGVBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUMvQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzVDLElBQUksQ0FBQyxHQUFHLGVBQUssQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDN0QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQWMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBU0QscUJBQXFCLENBQUMsUUFBa0IsRUFBRSxVQUF1QjtRQUM3RCxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7UUFDaEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsVUFBVTtRQUM1QyxJQUFJLE9BQU8sR0FBRyxlQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDO1FBQ3JELE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFNLEVBQUUsRUFBRTtZQUN2QixJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUssaUJBQWlCLEVBQUU7Z0JBQ3BDLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUU7b0JBQ25ELElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUU7d0JBQ3pCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO3dCQUM3QixPQUFPLElBQUk7cUJBQ2Q7eUJBQU07d0JBQ0gsT0FBTyxLQUFLO3FCQUNmO2dCQUNMLENBQUMsQ0FBQztnQkFDRixJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO29CQUNqQixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO29CQUMzQyxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO3dCQUNqQixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7d0JBQ3BELE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQzt3QkFDNUIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7cUJBQ3BDO2lCQUNKO2dCQUNELE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO2FBQzVDO1FBQ0wsQ0FBQyxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQztJQUN6QyxDQUFDO0lBS00sR0FBRyxDQUFDLE9BQWUsRUFBRSxhQUF1QyxFQUFFLE1BQXFDO1FBQ3RHLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDekIsSUFBSSxDQUFDLGNBQWMsR0FBRyxhQUFhO1lBQ25DLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTTtZQUNwQixJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUs7WUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsRUFBRTtZQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxFQUFFO1lBQ3RCLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsV0FBVyxFQUFFO1lBQ2hELElBQUksa0JBQWtCLEdBQUcsZUFBSyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDO1lBQzdFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUM7WUFDaEcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQztZQUN0RSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLGtCQUFrQixDQUFDO1lBQzVFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLElBQUk7WUFDbkQsT0FBTyxDQUNILElBQUksUUFBUSxDQUNSLElBQUksRUFDSixHQUFHLEVBQUU7Z0JBQ0QsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJO2dCQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFZLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3BFLENBQUMsQ0FDSixDQUNKO1FBQ0wsQ0FBQyxDQUFDO0lBQ04sQ0FBQztJQUVELFlBQVksR0FBVyxFQUFFLE9BQWtDO1FBaEUzRCxVQUFLLEdBQUc7WUFDSixRQUFRLEVBQUUsRUFBRTtZQUNaLE1BQU0sRUFBRSxFQUFFO1NBQ2I7UUFFRCxnQkFBVyxHQUFHLEVBQUU7UUErQmhCLGVBQVUsR0FBWSxLQUFLLENBQUM7UUE2QnhCLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRztRQUNmLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDMUMsQ0FBQztDQUNKO0FBRUQscUJBQWUsTUFBTTs7Ozs7Ozs7Ozs7Ozs7QUNqSHJCLHNFQUF1QjtBQUN2QixvR0FBMkM7QUFFM0Msa0ZBQStCO0FBRS9CLGtGQUEyQjtBQUUzQixNQUFNLFFBQVE7SUFHVixJQUFXLEdBQUcsS0FBSyxPQUFPLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQztJQUdyQyxJQUFXLE9BQU8sS0FBSyxPQUFPLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQztJQUN0QyxVQUFVLENBQUMsT0FBZSxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxFQUFDLENBQUM7SUFHOUQsSUFBVyxNQUFNLEtBQUssT0FBTyxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUM7SUFHM0MsSUFBVyxPQUFPLEtBQUssT0FBTyxJQUFJLENBQUMsUUFBUSxFQUFDLENBQUM7SUFHN0MsSUFBVyxHQUFHLEtBQUssT0FBTyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUM7SUFJOUIsYUFBYSxDQUFDLFFBQWdCO1FBQ2pDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQztJQUNwRCxDQUFDO0lBRU0sTUFBTSxDQUFDLEtBQTZCLEVBQUUsTUFBOEIsRUFBRSxRQUE2QjtRQUN0RyxJQUFJLENBQUMsT0FBTyxtQ0FDTCxJQUFJLENBQUMsT0FBTyxLQUNmLEtBQUs7WUFDTCxNQUFNO1lBQ04sUUFBUSxHQUNYO0lBQ0wsQ0FBQztJQUVNLFlBQVksQ0FBQyxRQUE0QjtRQUM1QyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsR0FBRyxRQUFRO0lBQ3BDLENBQUM7SUFFRCxZQUFZLE1BQWMsRUFBRSxhQUFtQjtRQUMzQyxJQUFJLENBQUMsSUFBSSxHQUFHLGNBQWEsYUFBYixhQUFhLHVCQUFiLGFBQWEsQ0FBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGVBQUssQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFO1FBQ3BGLElBQUksQ0FBQyxRQUFRLEdBQUcsYUFBYSxhQUFiLGFBQWEsdUJBQWIsYUFBYSxDQUFFLE9BQU87UUFDdEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsY0FBYSxhQUFiLGFBQWEsdUJBQWIsYUFBYSxDQUFFLEdBQUcsRUFBQyxDQUFDLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxhQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUM7UUFDaEYsSUFBSSxDQUFDLFFBQVEsR0FBRyxjQUFhLGFBQWIsYUFBYSx1QkFBYixhQUFhLENBQUUsT0FBTyxFQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLGlCQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUM7UUFDaEcsSUFBSSxDQUFDLE9BQU8sR0FBRyxhQUFhLGFBQWIsYUFBYSx1QkFBYixhQUFhLENBQUUsT0FBTztRQUNyQyxJQUFJLENBQUMsY0FBYSxhQUFiLGFBQWEsdUJBQWIsYUFBYSxDQUFFLE9BQU8sR0FBRTtZQUN6QixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRTtTQUN2QjtRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2YsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ2pCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUNsRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssYUFBYSxDQUFDLEVBQUU7b0JBQ25ELElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztpQkFDcEQ7WUFDTCxDQUFDLENBQUM7WUFDRixJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUU7U0FDcEI7UUFDRCxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsV0FBa0MsRUFBRSxFQUFFO1lBQzlELE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDO1lBQ3hCLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG1DQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUssV0FBVyxDQUFFO1lBQ3BFLElBQUksYUFBYSxHQUFHLElBQUksdUJBQWEsQ0FBQyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQztZQUNyRyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLGFBQWEsQ0FBQztZQUMzRCxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDO1FBQzlELENBQUM7SUFDTCxDQUFDO0NBQ0o7QUFFRCxxQkFBZSxRQUFROzs7Ozs7Ozs7Ozs7OztBQ3RFdkIsTUFBTSxhQUFhO0lBR1IsV0FBVyxDQUFDLFFBQWtCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUSxFQUFDLENBQUM7SUFDeEUsY0FBYyxDQUFDLEdBQVcsSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQztJQUN2RCxZQUFZLENBQUMsR0FBVyxJQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDO0lBRTVEO1FBQ0ksSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFO0lBQ3BCLENBQUM7Q0FDSjtBQUVELHFCQUFlLGFBQWE7Ozs7Ozs7Ozs7Ozs7O0FDWDVCLE1BQU0sR0FBRztJQUdMLElBQVcsTUFBTSxLQUFLLE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBQyxDQUFDO0lBRzNDLElBQVcsUUFBUSxLQUFLLE9BQU8sSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDO0lBRy9DLElBQVcsSUFBSSxLQUFLLE9BQU8sSUFBSSxDQUFDLEtBQUssRUFBQyxDQUFDO0lBQ2hDLE9BQU8sQ0FBQyxJQUFpQixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxFQUFDLENBQUM7SUFFdkQsWUFBWSxNQUFjLEVBQUUsUUFBbUIsRUFBRSxJQUFrQjtRQUMvRCxJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU07UUFDckIsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRO1FBQ3pCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUNyQixDQUFDO0NBQ0o7QUFFRCxxQkFBZSxHQUFHOzs7Ozs7Ozs7Ozs7OztBQ3RCbEIsTUFBTSxhQUFhO0lBU2YsWUFBWSxRQUFhO1FBQ3JCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLFFBQVE7UUFDakMsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEtBQUssSUFBSSxDQUFDO1FBQ2xELElBQUksQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDLGVBQWU7UUFDL0MsSUFBSSxDQUFDLGNBQWMsR0FBRyxRQUFRLENBQUMsY0FBYztRQUM3QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsUUFBUSxDQUFDLGlCQUFpQjtRQUNuRCxJQUFJLENBQUMsWUFBWSxHQUFHLFFBQVEsQ0FBQyxZQUFZO1FBQ3pDLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUU7U0FFOUM7SUFDTCxDQUFDO0NBQ0o7QUFFRCxxQkFBZSxhQUFhOzs7Ozs7Ozs7Ozs7OztBQ3RCNUIsTUFBTSxTQUFTO0lBR1gsSUFBVyxLQUFLLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFDLENBQUM7SUFDbEMsT0FBTyxDQUFDLElBQVUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEVBQUMsQ0FBQztJQUNwRCxVQUFVLENBQUMsR0FBVyxJQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDO0lBQ25ELFFBQVEsQ0FBQyxHQUFXLElBQUksT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFDLENBQUM7SUFFeEQ7UUFDSSxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUU7SUFDcEIsQ0FBQztDQUNKO0FBRUQscUJBQWUsU0FBUzs7Ozs7Ozs7Ozs7Ozs7QUNaeEIsTUFBTSxXQUFXO0lBR2IsSUFBVyxLQUFLLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFDLENBQUM7SUFDbEMsUUFBUSxDQUFDLEdBQVcsSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQztJQUNqRCxPQUFPLENBQUMsR0FBVyxFQUFFLElBQVMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksRUFBQyxDQUFDO0lBQzNELFVBQVUsQ0FBQyxHQUFXLElBQUksT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFDLENBQUM7SUFFMUQsWUFBWSxZQUFvQztRQUM1QyxJQUFJLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ2xELENBQUM7Q0FDSjtBQUVELHFCQUFlLFdBQVc7Ozs7Ozs7Ozs7Ozs7O0FDZDFCLHFGQUFpQztBQUNqQyxvR0FBMkM7QUFDM0Msc0VBQXVCO0FBQ3ZCLHdGQUFtQztBQUtuQyxNQUFNLE1BQU07SUFHUixJQUFXLE1BQU0sS0FBSyxPQUFPLElBQUksQ0FBQyxPQUFPLEVBQUMsQ0FBQztJQUNwQyxTQUFTLENBQUMsTUFBYyxJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxFQUFDLENBQUM7SUFHMUQsSUFBVyxTQUFTLEtBQUssT0FBTyxJQUFJLENBQUMsVUFBVSxFQUFDLENBQUM7SUFHakQsSUFBSSxHQUFHLEtBQUssT0FBTyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUM7SUFHOUIsSUFBVyxLQUFLLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFDLENBQUM7SUFHekMsSUFBVyxHQUFHLEtBQUssT0FBTyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUM7SUFHckMsSUFBVyxHQUFHLEtBQUssT0FBTyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUM7SUFDOUIsTUFBTSxDQUFDLEdBQVEsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUcsRUFBQyxDQUFDO0lBRXBDLFdBQVcsQ0FBQyxLQUE2QixFQUFFLE1BQThCLEVBQUUsUUFBNkIsRUFBRSxPQUFhO1FBQzFILElBQUksUUFBUSxHQUFHLElBQUksa0JBQVEsQ0FDdkIsSUFBSSxFQUNKO1lBQ0ksT0FBTyxFQUFFLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxHQUFHO1lBQ25CLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQyxpQ0FFUCxPQUFPLEtBQ1YsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQ3pCLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUM1QixRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFDcEMsQ0FBQyxDQUFDO2dCQUNBLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDekIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUM1QixRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUU7YUFDckM7U0FDUixDQUNKO1FBQ0QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDO1FBQ3JDLE9BQU8sUUFBUTtJQUNuQixDQUFDO0lBRUQsWUFBWSxHQUFXLEVBQUUsTUFBYyxFQUFFLEdBQVM7UUFDOUMsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHO1FBQ2YsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRztRQUNmLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSx1QkFBYSxFQUFFO1FBQ3JDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxtQkFBUyxFQUFFO1FBQzdCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxhQUFHLENBQUMsSUFBSSxDQUFDO0lBQzdCLENBQUM7Q0FDSjtBQUVELHFCQUFlLE1BQU07Ozs7Ozs7Ozs7Ozs7O0FDN0RyQiw4RkFBdUM7QUFHdkMsa0ZBQTJCO0FBRTNCLE1BQU0sT0FBTztJQUdULElBQVcsTUFBTSxLQUFLLE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBQyxDQUFDO0lBRzNDLElBQVcsUUFBUSxLQUFLLE9BQU8sSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDO0lBRy9DLElBQVcsTUFBTSxLQUFLLE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBQyxDQUFDO0lBR3BDLFdBQVcsQ0FBQyxZQUFvQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUkscUJBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFDLENBQUM7SUFDcEcsWUFBWSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEVBQUMsQ0FBQztJQUMxQyxJQUFXLFFBQVEsS0FBSyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUMsQ0FBQztJQUMzRCxVQUFVO1FBQ2IsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFO1FBQ2YsSUFBSSxDQUFDLFdBQVcsbUJBQU0sSUFBSSxDQUFDLE9BQU8sRUFBRztJQUN6QyxDQUFDO0lBRU0sS0FBSztRQUNSLElBQUksQ0FBQyxVQUFVLEVBQUU7SUFDckIsQ0FBQztJQUVNLE9BQU8sQ0FBQyxHQUFRO1FBQ25CLGVBQUssQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxJQUFJLGVBQUssQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ3BHLENBQUM7SUFFTSxJQUFJO1FBQ1AsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQzNDLENBQUM7SUFFTSxLQUFLO1FBQ1IsSUFBSSxJQUFJLEdBQUcsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDNUcsT0FBTyxJQUFJO0lBQ2YsQ0FBQztJQUVELFlBQVksTUFBYyxFQUFFLFFBQW1CLEVBQUUsYUFBbUI7UUExQjdELFVBQUssR0FBa0IsRUFBRTtRQTJCNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNO1FBQ3JCLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUTtRQUN6QixJQUFJLENBQUMsT0FBTyxHQUFHLGNBQWEsYUFBYixhQUFhLHVCQUFiLGFBQWEsQ0FBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQzlHLElBQUksYUFBYSxhQUFiLGFBQWEsdUJBQWIsYUFBYSxDQUFFLEtBQUssRUFBRTtZQUN0QixJQUFJLENBQUMsS0FBSyxHQUFHLGFBQWEsQ0FBQyxLQUFLO1NBQ25DO2FBQU07WUFDSCxJQUFJLENBQUMsS0FBSyxFQUFFO1NBQ2Y7SUFDTCxDQUFDO0NBQ0o7QUFHRCxxQkFBZSxPQUFPOzs7Ozs7Ozs7Ozs7OztBQ3pEdEIsTUFBTSxXQUFXO0NBRWhCO0FBRUQscUJBQWUsV0FBVzs7Ozs7Ozs7Ozs7Ozs7QUNKMUIsdUdBQXdDO0FBQ3hDLG1GQUE2QjtBQUc3QixNQUFNLFVBQVcsU0FBUSxxQkFBVztJQVd6QixNQUFNLENBQUMsV0FBVyxDQUFDLGNBQXFDLEVBQUUsZUFBc0MsRUFBRSxRQUE0QjtRQUNqSSxPQUFPLGVBQUssQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxlQUFlLEVBQUUsUUFBUSxDQUFDO0lBQzVJLENBQUM7O0FBWHNCLGVBQUksR0FBRyxLQUFLO0FBQ3JCLHVCQUFZLEdBQUcsRUFFNUI7QUFDYSx3QkFBYSxHQUFHO0lBQzFCLEtBQUssRUFBRSxHQUFHO0lBQ1YsTUFBTSxFQUFFLEdBQUc7Q0FDZDtBQU9MLHFCQUFlLFVBQVU7Ozs7Ozs7Ozs7Ozs7O0FDcEJ6Qix1R0FBd0M7QUFDeEMsd0dBQTRDO0FBQzVDLG1GQUE2QjtBQUU3QixrR0FBeUM7QUFFekMsTUFBTSxhQUFjLFNBQVEscUJBQVc7SUFhbkMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxjQUFxQyxFQUFFLGVBQXNDLEVBQUUsUUFBNEI7UUFDMUgsT0FBTyxlQUFLLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsZUFBZSxFQUFFLFFBQVEsQ0FBQztJQUMvSSxDQUFDOztBQWJzQixrQkFBSSxHQUFHLFFBQVE7QUFDeEIsMEJBQVksR0FBRztJQUN6QixPQUFPLEVBQUUsSUFBSSxvQkFBVSxDQUFDLEVBQUUsQ0FBQztJQUMzQixPQUFPLEVBQUUsSUFBSSxvQkFBVSxDQUFDLFFBQVEsQ0FBQztJQUNqQyxPQUFPLEVBQUUsSUFBSSxrQkFBUSxDQUFDLFNBQVMsQ0FBQztDQUNuQztBQUNhLDJCQUFhLEdBQUc7SUFDMUIsS0FBSyxFQUFFLEdBQUc7SUFDVixNQUFNLEVBQUUsTUFBTTtDQUNqQjtBQU9MLHFCQUFlLGFBQWE7Ozs7Ozs7Ozs7Ozs7O0FDeEI1Qix1R0FBd0M7QUFDeEMsbUZBQTZCO0FBRzdCLE1BQU0sV0FBWSxTQUFRLHFCQUFXO0lBYzFCLE1BQU0sQ0FBQyxXQUFXLENBQUMsY0FBcUMsRUFBRSxlQUFzQyxFQUFFLFFBQTRCO1FBQ2pJLE9BQU8sZUFBSyxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUM7SUFDN0ksQ0FBQzs7QUFkc0IsZ0JBQUksR0FBRyxNQUFNO0FBQ3RCLHdCQUFZLEdBQUcsRUFFNUI7QUFDYSx5QkFBYSxHQUFHO0lBQzFCLEtBQUssRUFBRSxHQUFHO0lBQ1YsTUFBTSxFQUFFLEdBQUc7SUFDWCxTQUFTLEVBQUUsaUNBQWlDO0lBQzVDLGVBQWUsRUFBRSxNQUFNO0lBQ3ZCLFlBQVksRUFBRSxDQUFDO0NBQ2xCO0FBT0wscUJBQWUsV0FBVzs7Ozs7Ozs7Ozs7Ozs7QUN2QjFCLHVHQUF3QztBQUN4QyxtRkFBNkI7QUFHN0IsTUFBTSxpQkFBa0IsU0FBUSxxQkFBVztJQVVoQyxNQUFNLENBQUMsV0FBVyxDQUFDLGNBQXFDLEVBQUUsZUFBc0MsRUFBRSxRQUE0QjtRQUNqSSxPQUFPLGVBQUssQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUM7SUFDbkosQ0FBQzs7QUFWc0Isc0JBQUksR0FBRyxhQUFhO0FBQzdCLDhCQUFZLEdBQUcsRUFFNUI7QUFDYSwrQkFBYSxHQUFHLEVBRTdCO0FBT0wscUJBQWUsaUJBQWlCOzs7Ozs7Ozs7Ozs7OztBQ25CaEMsdUdBQXdDO0FBQ3hDLG1GQUE2QjtBQUU3QixrR0FBeUM7QUFFekMsTUFBTSxXQUFZLFNBQVEscUJBQVc7SUFVMUIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxjQUFxQyxFQUFFLGVBQXNDLEVBQUUsUUFBNEI7UUFDakksT0FBTyxlQUFLLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsZUFBZSxFQUFFLFFBQVEsQ0FBQztJQUM3SSxDQUFDOztBQVZzQixnQkFBSSxHQUFHLE1BQU07QUFDdEIsd0JBQVksR0FBRztJQUN6QixRQUFRLEVBQUUsSUFBSSxrQkFBUSxDQUFDLFNBQVMsQ0FBQztDQUNwQztBQUNhLHlCQUFhLEdBQUcsRUFFN0I7QUFPTCxxQkFBZSxXQUFXOzs7Ozs7Ozs7Ozs7OztBQ3BCMUIsdUdBQXdDO0FBQ3hDLHdHQUE0QztBQUM1QyxtRkFBNkI7QUFHN0IsTUFBTSxXQUFZLFNBQVEscUJBQVc7SUFXMUIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxjQUFxQyxFQUFFLGVBQXNDLEVBQUUsUUFBNEI7UUFDakksT0FBTyxlQUFLLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsZUFBZSxFQUFFLFFBQVEsQ0FBQztJQUM3SSxDQUFDOztBQVhzQixnQkFBSSxHQUFHLE1BQU07QUFDdEIsd0JBQVksR0FBRztJQUN6QixJQUFJLEVBQUUsSUFBSSxvQkFBVSxDQUFDLEVBQUUsQ0FBQztDQUMzQjtBQUNhLHlCQUFhLEdBQUc7SUFDMUIsS0FBSyxFQUFFLEdBQUc7SUFDVixNQUFNLEVBQUUsTUFBTTtDQUNqQjtBQU9MLHFCQUFlLFdBQVc7Ozs7Ozs7Ozs7Ozs7O0FDckIxQixvR0FBcUM7QUFDckMsNkdBQTJDO0FBQzNDLHVHQUF1QztBQUN2Qyx1R0FBdUM7QUFDdkMseUhBQW1EO0FBQ25ELHVHQUF1QztBQUV2QyxxQkFBZTtJQUNYLENBQUMscUJBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxxQkFBVztJQUMvQixDQUFDLHVCQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsdUJBQWE7SUFDbkMsQ0FBQyxvQkFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLG9CQUFVO0lBQzdCLENBQUMscUJBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxxQkFBVztJQUMvQixDQUFDLHFCQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUscUJBQVc7SUFDL0IsQ0FBQywyQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRSwyQkFBaUI7Q0FDOUM7Ozs7Ozs7Ozs7Ozs7O0FDYkQsTUFBTSxXQUFXO0lBR2IsSUFBVyxHQUFHLEtBQUssT0FBTyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUM7SUFHckMsSUFBVyxXQUFXLEtBQUssT0FBTyxJQUFJLENBQUMsWUFBWSxFQUFDLENBQUM7SUFHckQsSUFBSSxLQUFLLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFDLENBQUM7SUFHbEMsSUFBSSxNQUFNLEtBQUssT0FBTyxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUM7SUFHcEMsSUFBSSxRQUFRLEtBQUssT0FBTyxJQUFJLENBQUMsU0FBUyxFQUFDLENBQUM7SUFFakMsTUFBTSxDQUFDLEtBQTZCLEVBQUUsTUFBOEIsRUFBRSxRQUE2QjtRQUN0RyxJQUFJLEtBQUs7WUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7UUFDOUIsSUFBSSxNQUFNO1lBQUUsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNO1FBQ2pDLElBQUksUUFBUTtZQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUTtJQUMzQyxDQUFDO0lBRUQsWUFDSSxHQUFXLEVBQ1gsV0FBbUIsRUFDbkIsS0FBa0MsRUFDbEMsTUFBOEIsRUFDOUIsUUFBNkI7UUFFN0IsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHO1FBQ2YsSUFBSSxDQUFDLFlBQVksR0FBRyxXQUFXO1FBQy9CLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTTtRQUNyQixJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQzdDLENBQUM7Q0FDSjtBQUVELHFCQUFlLFdBQVc7Ozs7Ozs7Ozs7Ozs7O0FDdkMxQixNQUFlLFFBQVE7SUFHbkIsSUFBVyxJQUFJLEtBQUssT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFDLENBQUM7SUFLdkMsWUFBWSxJQUFZO1FBQ3BCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUNyQixDQUFDO0NBQ0o7QUFFRCxxQkFBZSxRQUFROzs7Ozs7Ozs7Ozs7OztBQ2J2QiwyRkFBaUM7QUFFakMsTUFBTSxRQUFTLFNBQVEsa0JBQVE7SUFHM0IsSUFBVyxLQUFLLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFDLENBQUM7SUFDbEMsUUFBUSxDQUFDLENBQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBQztJQUNuQyxRQUFRLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxHQUFDO0lBR3ZDLElBQVcsWUFBWSxLQUFLLE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBQyxDQUFDO0lBRXZELFlBQVksWUFBeUI7UUFDakMsS0FBSyxDQUFDLFVBQVUsQ0FBQztRQUNqQixJQUFJLENBQUMsTUFBTSxHQUFHLFlBQVk7UUFDMUIsSUFBSSxDQUFDLGFBQWEsR0FBRyxZQUFZO0lBQ3JDLENBQUM7Q0FDSjtBQUVELHFCQUFlLFFBQVE7Ozs7Ozs7Ozs7Ozs7O0FDbkJ2QiwyRkFBaUM7QUFFakMsTUFBTSxVQUFXLFNBQVEsa0JBQVE7SUFHN0IsSUFBVyxLQUFLLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFDLENBQUM7SUFDbEMsUUFBUSxDQUFDLENBQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBQztJQUNuQyxRQUFRLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxHQUFDO0lBR3ZDLElBQVcsWUFBWSxLQUFLLE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBQyxDQUFDO0lBRXZELFlBQVksWUFBb0I7UUFDNUIsS0FBSyxDQUFDLFFBQVEsQ0FBQztRQUNmLElBQUksQ0FBQyxNQUFNLEdBQUcsWUFBWTtRQUMxQixJQUFJLENBQUMsYUFBYSxHQUFHLFlBQVk7SUFDckMsQ0FBQztDQUNKO0FBRUQscUJBQWUsVUFBVTs7Ozs7Ozs7Ozs7Ozs7QUNuQnpCLHVGQUE4QztBQUM5QyxzRkFBaUM7QUFFakMsZ0ZBQStCO0FBQy9CLG9HQUF3QztBQUN4Qyx5SEFBc0Q7QUFFdEQsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEdBQUcscUJBQVc7QUFFdEMsSUFBSSxXQUFXLEdBQUcsY0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBRTVDLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDNUIsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztBQUV2QixJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFHaEIsSUFBSSx5QkFBeUIsR0FBRyxtSEFBbUgsQ0FBQztBQUVwSixTQUFTLFNBQVMsQ0FBQyxHQUFHLEVBQUUsS0FBSztJQUN6QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO1FBQ3JELEtBQUssR0FBRyxFQUFFLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQztLQUM3QjtTQUNJLElBQUksR0FBRyxLQUFLLFNBQVMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNsRSxLQUFLLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxHQUFHLEdBQUcsQ0FBQztLQUNsRDtJQUVELE9BQU8sZ0NBQWtCLEVBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxHQUFHLEtBQUssR0FBRyxLQUFLLENBQUM7QUFDMUQsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEdBQUcsRUFBRSxLQUFLO0lBQzFCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7UUFDckQsS0FBSyxHQUFHLEVBQUUsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDO0tBQzdCO1NBQ0ksSUFBSSxHQUFHLEtBQUssU0FBUyxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ2xFLEtBQUssR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDO0tBQ2xEO0lBRUQsT0FBTyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ3RCLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLEtBQUs7SUFDM0IsSUFBSSxNQUFNLEdBQUcsRUFBRTtJQUNmLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDcEMsT0FBTyxNQUFNLENBQUM7S0FDakI7SUFDRCxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUM5QyxJQUFJLFFBQVEsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUIsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRTVCLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ2hCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQzlDLE1BQU0sSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzNDO1NBQ0o7YUFDSTtZQUNELE1BQU0sSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3hDO0tBQ0o7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNsQixDQUFDO0FBRUQsSUFBSSxLQUFLLEdBQUcsQ0FBQyxPQUFlLEVBQUUsRUFBRTtJQUM1QixPQUFPLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUN2RixDQUFDO0FBRUQsSUFBSSxjQUFjLEdBQUcsQ0FBQyxVQUFlLEVBQUUsTUFBYyxFQUFFLEVBQUU7SUFDckQsT0FBTyxVQUFVLENBQUMsSUFBSTtTQUNqQixNQUFNLENBQUMsQ0FBQyxXQUFnQixFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxLQUFLLGtCQUFrQixDQUFDO1NBQ3JFLEdBQUcsQ0FBQyxDQUFDLFdBQWdCLEVBQUUsRUFBRTtRQUN0QixPQUFPLElBQUksZ0JBQU0sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsV0FBVyxDQUFDO0lBQy9ELENBQUMsQ0FBQztBQUNWLENBQUM7QUFFRCxxQkFBZSxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRTs7Ozs7Ozs7Ozs7O0FDNUVwRTs7QUFLYixJQUFJLGdCQUFnQixHQUFHO0lBQ3JCLE9BQU8sRUFBRSxJQUFJO0lBQ2IsWUFBWSxFQUFFLElBQUk7SUFDbEIsV0FBVyxFQUFFLElBQUk7SUFDakIsSUFBSSxFQUFFLElBQUk7SUFDVixRQUFRLEVBQUUsSUFBSTtJQUNkLFlBQVksRUFBRSxJQUFJO0lBQ2xCLFVBQVUsRUFBRSxJQUFJO0lBQ2hCLFlBQVksRUFBRSxJQUFJO0lBQ2xCLFVBQVUsRUFBRSxJQUFJO0lBQ2hCLFNBQVMsRUFBRSxJQUFJO0lBQ2YsVUFBVSxFQUFFLElBQUk7SUFDaEIsT0FBTyxFQUFFLElBQUk7SUFDYixLQUFLLEVBQUUsSUFBSTtJQUNYLE9BQU8sRUFBRSxJQUFJO0lBQ2IsTUFBTSxFQUFFLElBQUk7SUFDWixNQUFNLEVBQUUsSUFBSTtJQUNaLElBQUksRUFBRSxJQUFJO0lBR1YsV0FBVyxFQUFFLElBQUk7SUFDakIsZ0JBQWdCLEVBQUUsSUFBSTtJQUN0QixhQUFhLEVBQUUsSUFBSTtJQUNuQixXQUFXLEVBQUUsSUFBSTtDQUNsQixDQUFDO0FBUUYsU0FBUyxTQUFTLENBQUMsTUFBTSxFQUFFLEdBQUc7SUFDNUIsT0FBTyxNQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pFLENBQUM7QUFNRCxJQUFJLFFBQVEsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBSTVDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJO0lBQ2xELFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBVSxNQUFNO1FBQy9CLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyRSxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBV0gsSUFBSSwyQkFBMkIsR0FBRztJQUNoQyxVQUFVLEVBQUU7UUFDVixlQUFlLEVBQUUsSUFBSTtRQUNyQixrQkFBa0IsRUFBRSxJQUFJO1FBQ3hCLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsZUFBZSxFQUFFLElBQUk7S0FDdEI7SUFDRCxNQUFNLEVBQUU7UUFDTixXQUFXLEVBQUUsSUFBSTtRQUNqQixXQUFXLEVBQUUsSUFBSTtRQUNqQixXQUFXLEVBQUUsSUFBSTtLQUNsQjtJQUNELFlBQVksRUFBRTtRQUNaLGlCQUFpQixFQUFFLElBQUk7UUFDdkIsaUJBQWlCLEVBQUUsSUFBSTtRQUN2QixpQkFBaUIsRUFBRSxJQUFJO0tBQ3hCO0lBQ0QsVUFBVSxFQUFFO1FBQ1YsZUFBZSxFQUFFLElBQUk7UUFDckIsZUFBZSxFQUFFLElBQUk7UUFDckIsZUFBZSxFQUFFLElBQUk7S0FDdEI7SUFDRCxXQUFXLEVBQUU7UUFDWCxnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsZ0JBQWdCLEVBQUUsSUFBSTtLQUN2QjtJQUNELFNBQVMsRUFBRTtRQUNULGNBQWMsRUFBRSxJQUFJO1FBQ3BCLGNBQWMsRUFBRSxJQUFJO1FBQ3BCLGNBQWMsRUFBRSxJQUFJO0tBQ3JCO0lBQ0QsSUFBSSxFQUFFO1FBQ0osU0FBUyxFQUFFLElBQUk7UUFDZixXQUFXLEVBQUUsSUFBSTtRQUNqQixVQUFVLEVBQUUsSUFBSTtRQUNoQixRQUFRLEVBQUUsSUFBSTtRQUNkLFVBQVUsRUFBRSxJQUFJO1FBQ2hCLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0NBQ0YsQ0FBQztBQUVGLElBQUksV0FBVyxHQUFHO0lBQ2hCLGdCQUFnQixFQUFFLGdCQUFnQjtJQUNsQywyQkFBMkIsRUFBRSwyQkFBMkI7Q0FDekQsQ0FBQztBQUVGLHFCQUFlLFdBQVc7Ozs7Ozs7Ozs7Ozs7O0FDN0cxQixzRkFBa0M7QUFFbEMscUdBQTRDO0FBQzVDLHVFQUFxQjtBQUVyQixJQUFJLGFBQWEsR0FBRyxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7SUFDbkQsSUFBSSxRQUFRLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDdkMsSUFBSSxRQUFRLEVBQUU7UUFDVixJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztRQUM1QixPQUFPLENBQUM7S0FDWDtTQUFNO1FBQ0gsT0FBTyxJQUFJO0tBQ2Q7QUFDTCxDQUFDO0FBRUQsSUFBSSxZQUFZLEdBQUcsQ0FBQyxLQUFpQixFQUFFLElBQW1CLEVBQUUsRUFBRTtJQUMxRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNuQyxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxhQUFELENBQUMsdUJBQUQsQ0FBQyxDQUFFLFdBQVc7WUFBRSxPQUFPLENBQUM7S0FDL0I7QUFDTCxDQUFDO0FBRUQsSUFBSSxTQUFTLEdBQUcsQ0FBQyxJQUFtQixFQUFFLEVBQVUsRUFBRSxFQUFFO0lBQ2hELEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUM5RCxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztRQUNwRCxJQUFJLENBQUMsS0FBSyxTQUFTLEVBQUU7WUFDakIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQ3hDO0tBQ0o7QUFDTCxDQUFDO0FBRUQsTUFBTSx3QkFBd0IsR0FBRyxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7SUFDaEUsSUFBSSxhQUFhLEdBQUcsSUFBSTtJQUN4QixPQUFPLENBQUMsR0FBRyxJQUFnQixFQUFFLEVBQUU7UUFDM0IsSUFBSSxVQUFVLEdBQUcsRUFBRTtRQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQVUsRUFBRSxLQUFhLEVBQUUsRUFBRTtZQUM5QyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDeEMsQ0FBQyxDQUFDO1FBQ0YsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN4QixJQUFJLFVBQVUsSUFBSSxDQUFDLFVBQVUsWUFBWSx1QkFBYSxDQUFDLElBQUksVUFBVSxDQUFDLGlCQUFpQixFQUFFO1lBQ3JGLGFBQWEsR0FBRyxVQUFVO1NBQzdCO1FBQ0QsYUFBYSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQztRQUN0RCxJQUFJLE1BQU0sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxhQUFhLENBQUM7UUFDcEQsYUFBYSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFO1FBQzdDLE9BQU8sTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLEtBQUs7SUFDeEIsQ0FBQztBQUNMLENBQUM7QUFFRCxJQUFJLGFBQWEsR0FBRztJQUNoQixlQUFlLEVBQUUsQ0FBQyxJQUFTLEVBQUUsSUFBbUIsRUFBRSxFQUFFO1FBQ2hELElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxHQUFHLEVBQUU7WUFDdkIsT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQztTQUM3QztJQUNMLENBQUM7SUFDRCxpQkFBaUIsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDbEQsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtZQUN4QixPQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztTQUMzRTthQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7WUFDL0IsT0FBTyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7U0FDM0U7SUFDTCxDQUFDO0lBQ0QscUJBQXFCLEVBQUUsQ0FBQyxJQUFTLEVBQUUsSUFBbUIsRUFBRSxFQUFFO1FBQ3RELE9BQU8sYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUM7SUFDdEgsQ0FBQztJQUNELGNBQWMsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDL0MsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU87SUFDaEMsQ0FBQztJQUNELHNCQUFzQixFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUN2RCxPQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQztJQUMvQyxDQUFDO0lBQ0QsT0FBTyxFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUN4QyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDN0IsQ0FBQztJQUNELFVBQVUsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPO1lBQUUsSUFBSSxDQUFDLE9BQU8sR0FBRyxVQUFLLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRTtRQUMvRCxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNuRixJQUFJLEtBQUssR0FBRyxFQUFFO1FBQ2QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUU7WUFDakQsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDO1FBQzNELENBQUMsQ0FBQztRQUVGLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDdEIsSUFBSSxHQUFHLEtBQUssU0FBUyxFQUFFO1lBQ25CLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTztTQUNyQjtRQUNELE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNqRCxJQUFJLElBQUksQ0FBQyxZQUFZO1lBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsR0FBRyxHQUFHLEdBQUc7UUFDMUQsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUc7UUFFbEIsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEQsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDO1FBRTdCLENBQUMsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsYUFBRCxDQUFDLHVCQUFELENBQUMsQ0FBRSxPQUFPLENBQUM7UUFFOUQsSUFBSSxTQUFTLEdBQUcsSUFBSSx1QkFBYSxpQ0FBTSxJQUFJLEtBQUUsWUFBWSxFQUFFLEdBQUcsSUFBRztRQUNqRSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQVUsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQzthQUM1RSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQztRQUMxRCxDQUFDLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztRQUN4QixJQUFJLElBQUksQ0FBQyxZQUFZO1lBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVk7UUFFakUsSUFBSSxhQUFhLEdBQUcsVUFBSyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxrQ0FBTyxJQUFJLEtBQUUsWUFBWSxFQUFFLEdBQUcsSUFBRztRQUNwRixJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO1FBQ25ELElBQUksS0FBSztZQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsYUFBYSxDQUFDO1FBQ3hELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRTtZQUN4QyxDQUFDLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLGFBQWEsQ0FBQztTQUM1QzthQUFNO1lBQ0gsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7U0FDakc7UUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLGFBQWEsQ0FBQztRQUNoRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDbEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztTQUN0RDtRQUNELE9BQU8sQ0FBQztJQUNaLENBQUM7SUFDRCxPQUFPLEVBQUUsQ0FBQyxJQUFTLEVBQUUsSUFBbUIsRUFBRSxFQUFFO1FBQ3hDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBVSxFQUFFLEVBQUU7WUFDN0IsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7UUFDOUIsQ0FBQyxDQUFDO0lBQ04sQ0FBQztJQUNELE9BQU8sRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDeEMsT0FBTyxJQUFJLENBQUMsS0FBSztJQUNyQixDQUFDO0lBQ0Qsa0JBQWtCLEVBQUUsQ0FBQyxJQUFTLEVBQUUsSUFBbUIsRUFBRSxFQUFFO1FBQ25ELElBQUksaUJBQWlCLEdBQUcsSUFBSSxrQkFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxrQ0FBTyxJQUFJLENBQUMsUUFBUSxLQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBRztRQUN4SCxJQUFJLGFBQWEsR0FBRyxJQUFJLHVCQUFhLGlDQUFNLElBQUksS0FBRSxRQUFRLEVBQUUsaUJBQWlCLElBQUc7UUFDL0UsT0FBTyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDO0lBQ3hELENBQUM7SUFDRCxtQkFBbUIsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDcEQsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLGtCQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLGtDQUFPLElBQUksQ0FBQyxRQUFRLEtBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFHO1FBQ3hILElBQUksYUFBYSxHQUFHLElBQUksdUJBQWEsaUNBQU0sSUFBSSxLQUFFLFFBQVEsRUFBRSxpQkFBaUIsSUFBRztRQUMvRSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLHdCQUF3QixDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztJQUN2RyxDQUFDO0lBQ0QsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFTLEVBQUUsSUFBbUIsRUFBRSxFQUFFO1FBQ2pELElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDMUYsQ0FBQztJQUNELG1CQUFtQixFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUNwRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxFQUFFO1lBQ3JCLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBTSxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxFQUFFLElBQUksdUJBQWEsaUNBQU0sSUFBSSxLQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLEtBQUssSUFBRyxDQUFDLENBQUMsQ0FBQztTQUN0STthQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7WUFDOUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFNLEVBQUUsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUUsSUFBSSx1QkFBYSxpQ0FBTSxJQUFJLEtBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsT0FBTyxJQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ3hJO0lBQ0wsQ0FBQztJQUNELGtCQUFrQixFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUNuRCxJQUFJLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxXQUFXLEVBQUU7WUFDbkIsSUFBSSxHQUFHLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDO1lBQ3hDLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssZUFBZSxFQUFFO2dCQUNsQyxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFhLEVBQUUsRUFBRTtvQkFDekMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDckYsQ0FBQyxDQUFDLENBQUM7YUFDTjtpQkFBTTtnQkFDSCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQzthQUM1RDtTQUNKO0lBQ0wsQ0FBQztJQUNELFVBQVUsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDM0MsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO1lBQ3JCLEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDOUQsSUFBSSxPQUFPLEdBQUcsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUN4QyxJQUFJLE9BQU8sRUFBRTtvQkFDVCxPQUFPLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUU7aUJBQ2xEO2FBQ0o7U0FDSjthQUFNO1lBQ0gsS0FBSyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUM5RCxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQzFELElBQUksQ0FBQyxLQUFLLFNBQVMsRUFBRTtvQkFDakIsT0FBTyxDQUFDO2lCQUNYO2FBQ0o7U0FDSjtJQUNMLENBQUM7SUFDRCxnQkFBZ0IsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDakQsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLEdBQUcsRUFBRTtZQUN2QixPQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztTQUMxRTthQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxHQUFHLEVBQUU7WUFDOUIsT0FBTyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7U0FDMUU7YUFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssR0FBRyxFQUFFO1lBQzlCLE9BQU8sYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDO1NBQzFFO2FBQU0sSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLEdBQUcsRUFBRTtZQUM5QixPQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztTQUMxRTthQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxHQUFHLEVBQUU7WUFDOUIsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ25GO2FBQU0sSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLEdBQUcsRUFBRTtZQUM5QixPQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztTQUMxRTthQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxLQUFLLEVBQUU7WUFDaEMsT0FBTyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7U0FDNUU7YUFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssR0FBRyxFQUFFO1lBQzlCLE9BQU8sYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDO1NBQzFFO2FBQU0sSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLEdBQUcsRUFBRTtZQUM5QixPQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztTQUMxRTthQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxHQUFHLEVBQUU7WUFDOUIsT0FBTyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7U0FDMUU7YUFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssR0FBRyxFQUFFO1lBQzlCLE9BQU8sYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDO1NBQzFFO0lBQ0wsQ0FBQztJQUNELFdBQVcsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDNUMsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRTtZQUNoQyxJQUFJLENBQUMsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUM7WUFDNUMsSUFBSSxDQUFDLGFBQUQsQ0FBQyx1QkFBRCxDQUFDLENBQUUsVUFBVTtnQkFBRSxPQUFPLENBQUM7aUJBQ3RCLElBQUksQ0FBQyxhQUFELENBQUMsdUJBQUQsQ0FBQyxDQUFFLFdBQVc7Z0JBQUUsT0FBTyxDQUFDO1NBQ3BDO2FBQU0sSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQztZQUMzQyxJQUFJLENBQUMsYUFBRCxDQUFDLHVCQUFELENBQUMsQ0FBRSxVQUFVO2dCQUFFLE9BQU8sQ0FBQztpQkFDdEIsSUFBSSxDQUFDLGFBQUQsQ0FBQyx1QkFBRCxDQUFDLENBQUUsV0FBVztnQkFBRSxPQUFPLENBQUM7U0FDcEM7SUFDTCxDQUFDO0lBQ0QsY0FBYyxFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUMvQyxPQUFPLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFDRCxjQUFjLEVBQUUsQ0FBQyxJQUFTLEVBQUUsSUFBbUIsRUFBRSxFQUFFO1FBQy9DLE9BQU8sYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDbkMsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDO1lBQ3RDLElBQUksQ0FBQyxhQUFELENBQUMsdUJBQUQsQ0FBQyxDQUFFLFVBQVU7Z0JBQUUsTUFBSztpQkFDbkIsSUFBSSxDQUFDLGFBQUQsQ0FBQyx1QkFBRCxDQUFDLENBQUUsV0FBVztnQkFBRSxPQUFPLENBQUM7U0FDcEM7SUFDTCxDQUFDO0lBQ0QsY0FBYyxFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTs7UUFDL0MsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFHLFVBQUksQ0FBQyxJQUFJLDBDQUFFLE1BQU0sR0FBRSxDQUFDLEVBQUUsRUFBRTtZQUN4QyxJQUFJLENBQUMsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUM7WUFDekMsSUFBSSxDQUFDLGFBQUQsQ0FBQyx1QkFBRCxDQUFDLENBQUUsVUFBVTtnQkFBRSxPQUFPLENBQUM7aUJBQ3RCLElBQUksQ0FBQyxhQUFELENBQUMsdUJBQUQsQ0FBQyxDQUFFLFdBQVc7Z0JBQUUsT0FBTyxDQUFDO1NBQ3BDO0lBQ0wsQ0FBQztJQUNELG1CQUFtQixFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUNwRCxPQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQztJQUMvQyxDQUFDO0lBQ0Qsb0JBQW9CLEVBQUUsQ0FBQyxJQUFTLEVBQUUsSUFBbUIsRUFBRSxFQUFFO1FBQ3JELElBQUksS0FBSyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztRQUMzQyxJQUFJLE9BQU8sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksa0NBQU8sSUFBSSxLQUFFLGNBQWMsRUFBRSxJQUFJLElBQUc7UUFDekUsSUFBSSxPQUFPLEVBQUU7WUFDVCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFO2dCQUM5QixJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ3ZDLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxHQUFHLEVBQUU7b0JBQ3ZCLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUs7aUJBQ3JDO3FCQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7b0JBQy9CLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sR0FBRyxLQUFLO2lCQUM5QztxQkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFO29CQUMvQixPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEdBQUcsS0FBSztpQkFDOUM7cUJBQU0sSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtvQkFDL0IsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxHQUFHLEtBQUs7aUJBQzlDO3FCQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7b0JBQy9CLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sR0FBRyxLQUFLO2lCQUM5QztxQkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFO29CQUMvQixPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUM7aUJBQ3ZEO3FCQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7b0JBQy9CLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sR0FBRyxLQUFLO2lCQUM5QzthQUNKO2lCQUFNO2dCQUNILElBQUksS0FBSyxHQUFHLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDdkMsSUFBSSxLQUFLLEVBQUU7b0JBQ1AsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO29CQUNsQyxJQUFJLENBQUMsRUFBRTt3QkFDSCxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssR0FBRyxFQUFFOzRCQUN2QixDQUFDLEdBQUcsS0FBSzt5QkFDWjs2QkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFOzRCQUMvQixDQUFDLElBQUksS0FBSzt5QkFDYjs2QkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFOzRCQUMvQixDQUFDLElBQUksS0FBSzt5QkFDYjs2QkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFOzRCQUMvQixDQUFDLElBQUksS0FBSzt5QkFDYjs2QkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFOzRCQUMvQixDQUFDLElBQUksS0FBSzt5QkFDYjs2QkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFOzRCQUMvQixDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDO3lCQUN6Qjs2QkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFOzRCQUMvQixDQUFDLElBQUksS0FBSzt5QkFDYjt3QkFDRCxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO3FCQUM5QjtpQkFDSjthQUNKO1NBQ0o7SUFDTCxDQUFDO0lBQ0QsWUFBWSxFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUM3QyxLQUFLLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ25HLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztZQUN0QyxJQUFJLENBQUMsYUFBRCxDQUFDLHVCQUFELENBQUMsQ0FBRSxVQUFVO2dCQUFFLE1BQUs7aUJBQ25CLElBQUksQ0FBQyxhQUFELENBQUMsdUJBQUQsQ0FBQyxDQUFFLFdBQVc7Z0JBQUUsT0FBTyxDQUFDO1NBQ3BDO0lBQ0wsQ0FBQztJQUNELGdCQUFnQixFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUNqRCxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDdEMsSUFBSSxPQUFPLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLGtDQUFPLElBQUksS0FBRSxjQUFjLEVBQUUsSUFBSSxJQUFHO1lBQzdFLElBQUksT0FBTyxFQUFFO2dCQUNULElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQUU7b0JBQzlCLElBQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztvQkFDdkMsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7d0JBQzVCLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJOzRCQUFFLE1BQU0sRUFBRTs2QkFDL0IsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUk7NEJBQUUsTUFBTSxFQUFFO3dCQUN6QyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNO3FCQUN0QztpQkFDSjtxQkFBTTtvQkFDSCxJQUFJLEtBQUssR0FBRyxTQUFTLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0JBQ3ZDLElBQUksS0FBSyxFQUFFO3dCQUNQLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQzt3QkFDbEMsSUFBSSxDQUFDLEVBQUU7NEJBQ0gsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLEVBQUU7Z0NBQ3ZCLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJO29DQUFFLENBQUMsRUFBRTtxQ0FDMUIsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUk7b0NBQUUsQ0FBQyxFQUFFO2dDQUNwQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDOzZCQUM5Qjt5QkFDSjtxQkFDSjtpQkFDSjthQUNKO1NBQ0o7SUFDTCxDQUFDO0lBQ0QsY0FBYyxFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUMvQyxJQUFJLElBQUksR0FBRyxTQUFTO1FBQ3BCLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDN0IsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekMsT0FBTyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDdkU7YUFBTTtZQUNILElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLFlBQVksRUFBRTtnQkFDNUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUk7YUFDbkM7WUFDRCxJQUFJLENBQUMsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDaEQsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQzVFO0lBQ0wsQ0FBQztJQUNELGdCQUFnQixFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUNqRCxJQUFJLElBQUksR0FBRyxTQUFTO1FBQ3BCLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDN0IsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekMsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO2dCQUNyQixPQUFPLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRTthQUM5QztpQkFBTTtnQkFDSCxPQUFPLENBQUMsQ0FBQzthQUNaO1NBQ0o7YUFBTTtZQUNILElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtnQkFDZixJQUFJLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDN0M7aUJBQU07Z0JBQ0gsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxZQUFZLEVBQUU7b0JBQ3JDLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7aUJBQzVCO3FCQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO29CQUN6QyxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7aUJBQzlCO2FBQ0o7WUFDRCxJQUFJLFlBQVkscUJBQVEsSUFBSSxDQUFFO1lBQzlCLE9BQU8sWUFBWSxDQUFDLGdCQUFnQixDQUFDO1lBQ3JDLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ2pELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDbEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNoQixJQUFJLE9BQU8sQ0FBQyxLQUFLLFVBQVUsRUFBRTtvQkFDekIsT0FBTyxDQUFDLEdBQUcsSUFBZ0IsRUFBRSxFQUFFO3dCQUMzQixRQUFRLElBQUksRUFBRTs0QkFDVixLQUFLLE1BQU0sQ0FBQyxDQUFDO2dDQUNULE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQzs2QkFDekI7NEJBQ0QsS0FBSyxLQUFLLENBQUMsQ0FBQztnQ0FDUixPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUM7NkJBQ3hCOzRCQUNELEtBQUssU0FBUyxDQUFDLENBQUM7Z0NBQ1osT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDOzZCQUM1Qjs0QkFDRCxPQUFPLENBQUMsQ0FBQzs2QkFFUjt5QkFDSjtvQkFDTCxDQUFDO2lCQUNKO3FCQUFNO29CQUNILElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRTt3QkFDckIsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRTtxQkFDakM7eUJBQU07d0JBQ0gsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7cUJBQ2xCO2lCQUNKO2FBQ0o7aUJBQU07Z0JBQ0gsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO29CQUNyQixPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFO2lCQUNqQztxQkFBTTtvQkFDSCxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDbEI7YUFDSjtTQUNKO0lBQ0wsQ0FBQztJQUNELGVBQWUsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDaEQsSUFBSSxJQUFJLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDO1FBQ2pELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN4QyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNyQixJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssWUFBWSxFQUFFO2dCQUN6QixJQUFJLFFBQVEsR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDM0MsSUFBSSxJQUFJLEtBQUssUUFBUSxFQUFFO29CQUNuQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUU7d0JBQzNDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO3dCQUN4QixJQUFJLENBQUMsR0FBRyxhQUFhLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQzt3QkFDL0IsSUFBSSxDQUFDLGFBQUQsQ0FBQyx1QkFBRCxDQUFDLENBQUUsV0FBVzs0QkFBRSxPQUFPLENBQUM7cUJBQy9CO2lCQUNKO2FBQ0o7U0FDSjtJQUNMLENBQUM7SUFDRCx1QkFBdUIsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDeEQsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLGtCQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLGtDQUFPLElBQUksQ0FBQyxRQUFRLEtBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFHO1FBQ3hILElBQUksYUFBYSxHQUFHLElBQUksdUJBQWEsaUNBQU0sSUFBSSxLQUFFLFFBQVEsRUFBRSxpQkFBaUIsSUFBRztRQUMvRSxPQUFPLHdCQUF3QixDQUFDLElBQUksRUFBRSxhQUFhLENBQUM7SUFDeEQsQ0FBQztJQUNELGdCQUFnQixFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUNqRCxJQUFJLEdBQUcsR0FBRyxFQUFFO1FBQ1osSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFhLEVBQUUsRUFBRTtZQUN0QyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFO2dCQUM5QixJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLFlBQVksRUFBRTtvQkFDcEMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDO2lCQUMvRDthQUNKO2lCQUFNO2dCQUNILElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxlQUFlLEVBQUU7b0JBQ25DLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDO2lCQUM5RDthQUNKO1FBQ0wsQ0FBQyxDQUFDO1FBQ0YsT0FBTyxHQUFHO0lBQ2QsQ0FBQztJQUNELGVBQWUsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDaEQsSUFBSSxNQUFNLEdBQUcsRUFBRTtRQUNmLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBVSxFQUFFLEVBQUU7WUFDakMsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7WUFDbEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssZUFBZSxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDdEQsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUNwQjtpQkFBTTtnQkFDSCxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzthQUNqQjtRQUNMLENBQUMsQ0FBQztRQUNGLE9BQU8sTUFBTTtJQUNqQixDQUFDO0lBQ0QsYUFBYSxFQUFFLENBQUMsSUFBUyxFQUFFLElBQW1CLEVBQUUsRUFBRTtRQUM5QyxJQUFJLE1BQU0sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM7UUFDL0MsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3ZCLE9BQU8sQ0FBQyxHQUFHLE1BQU0sQ0FBQztTQUNyQjthQUFNO1lBQ0gseUJBQVksTUFBTSxFQUFFO1NBQ3ZCO0lBQ0wsQ0FBQztJQUNELGVBQWUsRUFBRSxDQUFDLElBQVMsRUFBRSxJQUFtQixFQUFFLEVBQUU7UUFDaEQsT0FBTyxFQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO0lBQzNFLENBQUM7Q0FDSjtBQUVELHFCQUFlLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQWIsdUJBQWEsRUFBRTs7Ozs7Ozs7Ozs7Ozs7QUMxYjdELGlIQUFrRDtBQUVsRCxxR0FBNkM7QUFHN0MsSUFBSSxXQUFXLEdBQUcsR0FBRyxFQUFFO0lBQ25CLE9BQU8sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDaEQsQ0FBQztBQUVELFNBQVMsS0FBSyxDQUFJLFFBQVc7SUFDekIsTUFBTSxJQUFJLEdBQUcsSUFBSyxRQUFRLENBQUMsV0FBNEIsRUFBRSxDQUFDO0lBQzFELE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzlCLE9BQU8sSUFBSSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxNQUFNLGNBQWMsR0FBRyxDQUNuQixRQUFnQixFQUNoQixZQUF3QyxFQUN4QyxjQUFxQyxFQUNyQyxhQUFvQyxFQUNwQyxlQUFzQyxFQUN0QyxRQUE0QixFQUM5QixFQUFFO0lBQ0EsSUFBSSxVQUFVLEdBQUcsRUFBRTtJQUNuQixNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUN4QyxJQUFJLGNBQWMsQ0FBQyxPQUFPLENBQUMsS0FBSyxTQUFTLEVBQUU7WUFDdkMsSUFBSSxNQUFNLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQztZQUNsQyxJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO1lBQzlCLFVBQVUsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzVDLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxVQUFVO1NBQ25DO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDSCxJQUFJLFdBQVcscUJBQVEsYUFBYSxDQUFFO0lBQ3RDLElBQUksZUFBZTtRQUFFLFdBQVcsbUNBQVEsV0FBVyxHQUFLLGVBQWUsQ0FBRTtJQUN6RSxPQUFPLElBQUkscUJBQVcsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDO0FBQzlGLENBQUM7QUFFRCxNQUFNLGFBQWEsR0FBRyxDQUFDLFFBQWtCLEVBQUUsVUFBMEIsRUFBRSxFQUFFO0lBQ3JFLElBQUksVUFBVSxFQUFFO1FBQ1osT0FBTyxJQUFJLHVCQUFhLGlDQUFNLFVBQVUsS0FBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxJQUFHO0tBQ2pGO1NBQU07UUFDSCxPQUFPLElBQUksdUJBQWEsQ0FBQyxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQztLQUNsRTtBQUNMLENBQUM7QUFFRCxxQkFBZSxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsYUFBYSxFQUFFOzs7Ozs7Ozs7Ozs7QUM5Q2hEOztBQUViLElBQUksU0FBUyxHQUFHLE1BQU0sQ0FBQztBQUV2QixJQUFJLGlCQUFpQixHQUFHLFVBQVUsQ0FBQztBQWNuQyxTQUFTLFNBQVMsQ0FBQyxNQUFNO0lBQ3ZCLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxLQUFLLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUNoRSxDQUFDO0FBa0JELFNBQVMsa0JBQWtCLENBQUMsTUFBTTtJQUNoQyxPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3RELENBQUM7QUFFRCxxQkFBZSxrQkFBa0I7Ozs7Ozs7Ozs7Ozs7O0FDekNqQyw4RkFBbUM7QUFDbkMsMkZBQWlDO0FBQ2pDLCtFQUF5QjtBQUN6QiwyRkFBaUM7QUFFakMscUJBQWUsRUFBRSxTQUFTLEVBQVQsbUJBQVMsRUFBRSxRQUFRLEVBQVIsa0JBQVEsRUFBRSxJQUFJLEVBQUosY0FBSSxFQUFFLFFBQVEsRUFBUixrQkFBUSxFQUFFOzs7Ozs7Ozs7Ozs7OztBQ0h0RCxJQUFJLFFBQVEsR0FBRyxDQUFDLEdBQVEsRUFBRSxFQUFFO0lBQ3hCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztBQUM1QyxDQUFDO0FBRUQsSUFBSSxPQUFPLEdBQUcsRUFBRTtBQUVoQixJQUFJLFdBQVcsR0FBRyxDQUFDLFNBQWlCLEVBQUUsR0FBZ0IsRUFBRSxHQUFnQixFQUFFLEVBQUU7SUFDeEUsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEVBQUU7UUFDdkIsT0FBTyxDQUFDLElBQUksQ0FDUjtZQUNJLFVBQVUsRUFBRSxpQkFBaUI7WUFDN0IsT0FBTyxFQUFFLEdBQUcsQ0FBQyxJQUFJO1lBQ2pCLGFBQWEsRUFBRSxTQUFTO1NBQzNCLEVBQ0Q7WUFDSSxVQUFVLEVBQUUsaUJBQWlCO1lBQzdCLE9BQU8sRUFBRSxHQUFHLENBQUMsSUFBSTtZQUNqQixXQUFXLEVBQUUsR0FBRztZQUNoQixhQUFhLEVBQUUsU0FBUztTQUMzQixDQUNKO1FBQ0QsT0FBTTtLQUNUO0lBQ0QsSUFBSSxZQUFZLEdBQUcsRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO0lBQ3hILEtBQUssSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRTtRQUN6QixJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFO1lBQ2hDLFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7U0FDcEQ7S0FDSjtJQUNELEtBQUssSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRTtRQUN6QixJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFO1lBQ2hDLFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7U0FDcEQ7S0FDSjtJQUNELEtBQUssSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRTtRQUN6QixJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFO1lBQ2xFLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsS0FBSyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFO2dCQUM3RCxZQUFZLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2FBQ3BEO1NBQ0o7S0FDSjtJQUNELElBQ0ksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ2xELENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNsRCxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFDcEQ7UUFDRSxPQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQztLQUM3QjtJQUNELElBQUksYUFBYSxHQUFHLEVBQUUsVUFBVSxFQUFFLGdCQUFnQixFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO0lBQzFILEtBQUssSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRTtRQUMxQixJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFO1lBQ2pDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7U0FDdEQ7S0FDSjtJQUNELEtBQUssSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRTtRQUMxQixJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFO1lBQ2pDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7U0FDdEQ7S0FDSjtJQUNELEtBQUssSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRTtRQUMxQixJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFO1lBQ3BFLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN6QyxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO2FBQ3REO1NBQ0o7S0FDSjtJQUNELElBQ0ksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ25ELENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNuRCxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFDckQ7UUFDRSxPQUFPLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztLQUM5QjtJQUNELElBQUksRUFBRSxHQUFHLEVBQUU7SUFDWCxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxFQUFDLENBQUMsQ0FBQztJQUMxRCxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUMxQixJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDaEIsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDL0M7YUFBTTtZQUNILE9BQU8sQ0FBQyxJQUFJLENBQ1I7Z0JBQ0ksVUFBVSxFQUFFLGlCQUFpQjtnQkFDN0IsT0FBTyxFQUFFLEtBQUssQ0FBQyxJQUFJO2dCQUNuQixhQUFhLEVBQUUsR0FBRyxDQUFDLElBQUk7YUFDMUIsQ0FDSjtTQUNKO0lBQ0wsQ0FBQyxDQUFDO0lBQ0YsRUFBRSxHQUFHLEVBQUU7SUFDUCxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxFQUFDLENBQUMsQ0FBQztJQUMxRCxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUMxQixJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNqQixPQUFPLENBQUMsSUFBSSxDQUNSO2dCQUNJLFVBQVUsRUFBRSxpQkFBaUI7Z0JBQzdCLE9BQU8sRUFBRSxLQUFLLENBQUMsSUFBSTtnQkFDbkIsV0FBVyxFQUFFLEtBQUs7Z0JBQ2xCLGFBQWEsRUFBRSxHQUFHLENBQUMsSUFBSTthQUMxQixDQUNKO1NBQ0o7SUFDTCxDQUFDLENBQUM7QUFDTixDQUFDO0FBRUQsSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFnQixFQUFFLEdBQWdCLEVBQUUsRUFBRTtJQUM5QyxPQUFPLEdBQUcsRUFBRTtJQUNaLFdBQVcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztJQUNoQyxPQUFPLE9BQU87QUFDbEIsQ0FBQztBQUVELHFCQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTs7Ozs7OztVQ2pIakM7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTs7VUFFQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTs7Ozs7Ozs7Ozs7Ozs7QUNyQkEsc0ZBQW9DO0FBNkpoQyxpQkE3SkcsZ0JBQU0sQ0E2Skg7QUE1SlYsc0ZBQWtEO0FBMEo5QyxpQkExSkcsZ0JBQU0sQ0EwSkg7QUFDTiwwRkEzSmEsaUJBQVEsUUEySmI7QUExSloseUZBQWtDO0FBNEo5QixnQkE1SkcsZUFBSyxDQTRKSDtBQTNKVCxrR0FBd0M7QUE0SnBDLG1CQTVKRyxrQkFBUSxDQTRKSCIsInNvdXJjZXMiOlsid2VicGFjazovL3ZtZW5naW5lLy4vbm9kZV9tb2R1bGVzL2Fjb3JuLWpzeC9pbmRleC5qcyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL25vZGVfbW9kdWxlcy9hY29ybi1qc3gveGh0bWwuanMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9ub2RlX21vZHVsZXMvYWNvcm4vZGlzdC9hY29ybi5qcyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvQXBwbGV0LnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9DcmVhdHVyZS50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvQ3JlYXR1cmVTdG9yZS50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvRE9NLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9FeGVjdXRpb25NZXRhLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9GdW5jU3RvcmUudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L01lbW9yeUxheWVyLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9Nb2R1bGUudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L1J1bnRpbWUudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L2NvbnRyb2xzL0Jhc2VDb250cm9sLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9jb250cm9scy9Cb3hDb250cm9sLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9jb250cm9scy9CdXR0b25Db250cm9sLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9jb250cm9scy9DYXJkQ29udHJvbC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvY29udHJvbHMvUHJpbWFyeVRhYkNvbnRyb2wudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L2NvbnRyb2xzL1RhYnNDb250cm9sLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9jb250cm9scy9UZXh0Q29udHJvbC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvY29udHJvbHMvaW5kZXgudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L2VsZW1lbnRzL0Jhc2VFbGVtZW50LnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC9wcm9wcy9CYXNlUHJvcC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvcHJvcHMvRnVuY1Byb3AudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L3Byb3BzL1N0cmluZ1Byb3AudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L3V0aWxzL2NvbXBpbGVyLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC91dGlscy9jc3NQcm9wZXJ0eS50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvdXRpbHMvZXhlY3V0b3IudHMiLCJ3ZWJwYWNrOi8vdm1lbmdpbmUvLi9zcmMvd2lkZ2V0L3V0aWxzL2dlbmVyYXRvci50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvdXRpbHMvaHlwaGVuYXRlU3R5bGVOYW1lLnRzIiwid2VicGFjazovL3ZtZW5naW5lLy4vc3JjL3dpZGdldC91dGlscy9pbmRleC50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy93aWRnZXQvdXRpbHMvanNvbi50cyIsIndlYnBhY2s6Ly92bWVuZ2luZS93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly92bWVuZ2luZS8uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmNvbnN0IFhIVE1MRW50aXRpZXMgPSByZXF1aXJlKCcuL3hodG1sJyk7XG5cbmNvbnN0IGhleE51bWJlciA9IC9eW1xcZGEtZkEtRl0rJC87XG5jb25zdCBkZWNpbWFsTnVtYmVyID0gL15cXGQrJC87XG5cbi8vIFRoZSBtYXAgdG8gYGFjb3JuLWpzeGAgdG9rZW5zIGZyb20gYGFjb3JuYCBuYW1lc3BhY2Ugb2JqZWN0cy5cbmNvbnN0IGFjb3JuSnN4TWFwID0gbmV3IFdlYWtNYXAoKTtcblxuLy8gR2V0IHRoZSBvcmlnaW5hbCB0b2tlbnMgZm9yIHRoZSBnaXZlbiBgYWNvcm5gIG5hbWVzcGFjZSBvYmplY3QuXG5mdW5jdGlvbiBnZXRKc3hUb2tlbnMoYWNvcm4pIHtcbiAgYWNvcm4gPSBhY29ybi5QYXJzZXIuYWNvcm4gfHwgYWNvcm47XG4gIGxldCBhY29ybkpzeCA9IGFjb3JuSnN4TWFwLmdldChhY29ybik7XG4gIGlmICghYWNvcm5Kc3gpIHtcbiAgICBjb25zdCB0dCA9IGFjb3JuLnRva1R5cGVzO1xuICAgIGNvbnN0IFRva0NvbnRleHQgPSBhY29ybi5Ub2tDb250ZXh0O1xuICAgIGNvbnN0IFRva2VuVHlwZSA9IGFjb3JuLlRva2VuVHlwZTtcbiAgICBjb25zdCB0Y19vVGFnID0gbmV3IFRva0NvbnRleHQoJzx0YWcnLCBmYWxzZSk7XG4gICAgY29uc3QgdGNfY1RhZyA9IG5ldyBUb2tDb250ZXh0KCc8L3RhZycsIGZhbHNlKTtcbiAgICBjb25zdCB0Y19leHByID0gbmV3IFRva0NvbnRleHQoJzx0YWc+Li4uPC90YWc+JywgdHJ1ZSwgdHJ1ZSk7XG4gICAgY29uc3QgdG9rQ29udGV4dHMgPSB7XG4gICAgICB0Y19vVGFnOiB0Y19vVGFnLFxuICAgICAgdGNfY1RhZzogdGNfY1RhZyxcbiAgICAgIHRjX2V4cHI6IHRjX2V4cHJcbiAgICB9O1xuICAgIGNvbnN0IHRva1R5cGVzID0ge1xuICAgICAganN4TmFtZTogbmV3IFRva2VuVHlwZSgnanN4TmFtZScpLFxuICAgICAganN4VGV4dDogbmV3IFRva2VuVHlwZSgnanN4VGV4dCcsIHtiZWZvcmVFeHByOiB0cnVlfSksXG4gICAgICBqc3hUYWdTdGFydDogbmV3IFRva2VuVHlwZSgnanN4VGFnU3RhcnQnLCB7c3RhcnRzRXhwcjogdHJ1ZX0pLFxuICAgICAganN4VGFnRW5kOiBuZXcgVG9rZW5UeXBlKCdqc3hUYWdFbmQnKVxuICAgIH07XG5cbiAgICB0b2tUeXBlcy5qc3hUYWdTdGFydC51cGRhdGVDb250ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNvbnRleHQucHVzaCh0Y19leHByKTsgLy8gdHJlYXQgYXMgYmVnaW5uaW5nIG9mIEpTWCBleHByZXNzaW9uXG4gICAgICB0aGlzLmNvbnRleHQucHVzaCh0Y19vVGFnKTsgLy8gc3RhcnQgb3BlbmluZyB0YWcgY29udGV4dFxuICAgICAgdGhpcy5leHByQWxsb3dlZCA9IGZhbHNlO1xuICAgIH07XG4gICAgdG9rVHlwZXMuanN4VGFnRW5kLnVwZGF0ZUNvbnRleHQgPSBmdW5jdGlvbihwcmV2VHlwZSkge1xuICAgICAgbGV0IG91dCA9IHRoaXMuY29udGV4dC5wb3AoKTtcbiAgICAgIGlmIChvdXQgPT09IHRjX29UYWcgJiYgcHJldlR5cGUgPT09IHR0LnNsYXNoIHx8IG91dCA9PT0gdGNfY1RhZykge1xuICAgICAgICB0aGlzLmNvbnRleHQucG9wKCk7XG4gICAgICAgIHRoaXMuZXhwckFsbG93ZWQgPSB0aGlzLmN1ckNvbnRleHQoKSA9PT0gdGNfZXhwcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZXhwckFsbG93ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBhY29ybkpzeCA9IHsgdG9rQ29udGV4dHM6IHRva0NvbnRleHRzLCB0b2tUeXBlczogdG9rVHlwZXMgfTtcbiAgICBhY29ybkpzeE1hcC5zZXQoYWNvcm4sIGFjb3JuSnN4KTtcbiAgfVxuXG4gIHJldHVybiBhY29ybkpzeDtcbn1cblxuLy8gVHJhbnNmb3JtcyBKU1ggZWxlbWVudCBuYW1lIHRvIHN0cmluZy5cblxuZnVuY3Rpb24gZ2V0UXVhbGlmaWVkSlNYTmFtZShvYmplY3QpIHtcbiAgaWYgKCFvYmplY3QpXG4gICAgcmV0dXJuIG9iamVjdDtcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdKU1hJZGVudGlmaWVyJylcbiAgICByZXR1cm4gb2JqZWN0Lm5hbWU7XG5cbiAgaWYgKG9iamVjdC50eXBlID09PSAnSlNYTmFtZXNwYWNlZE5hbWUnKVxuICAgIHJldHVybiBvYmplY3QubmFtZXNwYWNlLm5hbWUgKyAnOicgKyBvYmplY3QubmFtZS5uYW1lO1xuXG4gIGlmIChvYmplY3QudHlwZSA9PT0gJ0pTWE1lbWJlckV4cHJlc3Npb24nKVxuICAgIHJldHVybiBnZXRRdWFsaWZpZWRKU1hOYW1lKG9iamVjdC5vYmplY3QpICsgJy4nICtcbiAgICBnZXRRdWFsaWZpZWRKU1hOYW1lKG9iamVjdC5wcm9wZXJ0eSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgcmV0dXJuIGZ1bmN0aW9uKFBhcnNlcikge1xuICAgIHJldHVybiBwbHVnaW4oe1xuICAgICAgYWxsb3dOYW1lc3BhY2VzOiBvcHRpb25zLmFsbG93TmFtZXNwYWNlcyAhPT0gZmFsc2UsXG4gICAgICBhbGxvd05hbWVzcGFjZWRPYmplY3RzOiAhIW9wdGlvbnMuYWxsb3dOYW1lc3BhY2VkT2JqZWN0c1xuICAgIH0sIFBhcnNlcik7XG4gIH07XG59O1xuXG4vLyBUaGlzIGlzIGB0b2tUeXBlc2Agb2YgdGhlIHBlZXIgZGVwLlxuLy8gVGhpcyBjYW4gYmUgZGlmZmVyZW50IGluc3RhbmNlcyBmcm9tIHRoZSBhY3R1YWwgYHRva1R5cGVzYCB0aGlzIHBsdWdpbiB1c2VzLlxuT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZHVsZS5leHBvcnRzLCBcInRva1R5cGVzXCIsIHtcbiAgZ2V0OiBmdW5jdGlvbiBnZXRfdG9rVHlwZXMoKSB7XG4gICAgcmV0dXJuIGdldEpzeFRva2VucyhyZXF1aXJlKFwiYWNvcm5cIikpLnRva1R5cGVzO1xuICB9LFxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGVudW1lcmFibGU6IHRydWVcbn0pO1xuXG5mdW5jdGlvbiBwbHVnaW4ob3B0aW9ucywgUGFyc2VyKSB7XG4gIGNvbnN0IGFjb3JuID0gUGFyc2VyLmFjb3JuIHx8IHJlcXVpcmUoXCJhY29yblwiKTtcbiAgY29uc3QgYWNvcm5Kc3ggPSBnZXRKc3hUb2tlbnMoYWNvcm4pO1xuICBjb25zdCB0dCA9IGFjb3JuLnRva1R5cGVzO1xuICBjb25zdCB0b2sgPSBhY29ybkpzeC50b2tUeXBlcztcbiAgY29uc3QgdG9rQ29udGV4dHMgPSBhY29ybi50b2tDb250ZXh0cztcbiAgY29uc3QgdGNfb1RhZyA9IGFjb3JuSnN4LnRva0NvbnRleHRzLnRjX29UYWc7XG4gIGNvbnN0IHRjX2NUYWcgPSBhY29ybkpzeC50b2tDb250ZXh0cy50Y19jVGFnO1xuICBjb25zdCB0Y19leHByID0gYWNvcm5Kc3gudG9rQ29udGV4dHMudGNfZXhwcjtcbiAgY29uc3QgaXNOZXdMaW5lID0gYWNvcm4uaXNOZXdMaW5lO1xuICBjb25zdCBpc0lkZW50aWZpZXJTdGFydCA9IGFjb3JuLmlzSWRlbnRpZmllclN0YXJ0O1xuICBjb25zdCBpc0lkZW50aWZpZXJDaGFyID0gYWNvcm4uaXNJZGVudGlmaWVyQ2hhcjtcblxuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBQYXJzZXIge1xuICAgIC8vIEV4cG9zZSBhY3R1YWwgYHRva1R5cGVzYCBhbmQgYHRva0NvbnRleHRzYCB0byBvdGhlciBwbHVnaW5zLlxuICAgIHN0YXRpYyBnZXQgYWNvcm5Kc3goKSB7XG4gICAgICByZXR1cm4gYWNvcm5Kc3g7XG4gICAgfVxuXG4gICAgLy8gUmVhZHMgaW5saW5lIEpTWCBjb250ZW50cyB0b2tlbi5cbiAgICBqc3hfcmVhZFRva2VuKCkge1xuICAgICAgbGV0IG91dCA9ICcnLCBjaHVua1N0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICBmb3IgKDs7KSB7XG4gICAgICAgIGlmICh0aGlzLnBvcyA+PSB0aGlzLmlucHV0Lmxlbmd0aClcbiAgICAgICAgICB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsICdVbnRlcm1pbmF0ZWQgSlNYIGNvbnRlbnRzJyk7XG4gICAgICAgIGxldCBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyk7XG5cbiAgICAgICAgc3dpdGNoIChjaCkge1xuICAgICAgICBjYXNlIDYwOiAvLyAnPCdcbiAgICAgICAgY2FzZSAxMjM6IC8vICd7J1xuICAgICAgICAgIGlmICh0aGlzLnBvcyA9PT0gdGhpcy5zdGFydCkge1xuICAgICAgICAgICAgaWYgKGNoID09PSA2MCAmJiB0aGlzLmV4cHJBbGxvd2VkKSB7XG4gICAgICAgICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHRvay5qc3hUYWdTdGFydCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRUb2tlbkZyb21Db2RlKGNoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgb3V0ICs9IHRoaXMuaW5wdXQuc2xpY2UoY2h1bmtTdGFydCwgdGhpcy5wb3MpO1xuICAgICAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHRvay5qc3hUZXh0LCBvdXQpO1xuXG4gICAgICAgIGNhc2UgMzg6IC8vICcmJ1xuICAgICAgICAgIG91dCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKTtcbiAgICAgICAgICBvdXQgKz0gdGhpcy5qc3hfcmVhZEVudGl0eSgpO1xuICAgICAgICAgIGNodW5rU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIDYyOiAvLyAnPidcbiAgICAgICAgY2FzZSAxMjU6IC8vICd9J1xuICAgICAgICAgIHRoaXMucmFpc2UoXG4gICAgICAgICAgICB0aGlzLnBvcyxcbiAgICAgICAgICAgIFwiVW5leHBlY3RlZCB0b2tlbiBgXCIgKyB0aGlzLmlucHV0W3RoaXMucG9zXSArIFwiYC4gRGlkIHlvdSBtZWFuIGBcIiArXG4gICAgICAgICAgICAgIChjaCA9PT0gNjIgPyBcIiZndDtcIiA6IFwiJnJicmFjZTtcIikgKyBcImAgb3IgXCIgKyBcImB7XFxcIlwiICsgdGhpcy5pbnB1dFt0aGlzLnBvc10gKyBcIlxcXCJ9XCIgKyBcImA/XCJcbiAgICAgICAgICApO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKGlzTmV3TGluZShjaCkpIHtcbiAgICAgICAgICAgIG91dCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKTtcbiAgICAgICAgICAgIG91dCArPSB0aGlzLmpzeF9yZWFkTmV3TGluZSh0cnVlKTtcbiAgICAgICAgICAgIGNodW5rU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBqc3hfcmVhZE5ld0xpbmUobm9ybWFsaXplQ1JMRikge1xuICAgICAgbGV0IGNoID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKTtcbiAgICAgIGxldCBvdXQ7XG4gICAgICArK3RoaXMucG9zO1xuICAgICAgaWYgKGNoID09PSAxMyAmJiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpID09PSAxMCkge1xuICAgICAgICArK3RoaXMucG9zO1xuICAgICAgICBvdXQgPSBub3JtYWxpemVDUkxGID8gJ1xcbicgOiAnXFxyXFxuJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoY2gpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5sb2NhdGlvbnMpIHtcbiAgICAgICAgKyt0aGlzLmN1ckxpbmU7XG4gICAgICAgIHRoaXMubGluZVN0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBvdXQ7XG4gICAgfVxuXG4gICAganN4X3JlYWRTdHJpbmcocXVvdGUpIHtcbiAgICAgIGxldCBvdXQgPSAnJywgY2h1bmtTdGFydCA9ICsrdGhpcy5wb3M7XG4gICAgICBmb3IgKDs7KSB7XG4gICAgICAgIGlmICh0aGlzLnBvcyA+PSB0aGlzLmlucHV0Lmxlbmd0aClcbiAgICAgICAgICB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsICdVbnRlcm1pbmF0ZWQgc3RyaW5nIGNvbnN0YW50Jyk7XG4gICAgICAgIGxldCBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyk7XG4gICAgICAgIGlmIChjaCA9PT0gcXVvdGUpIGJyZWFrO1xuICAgICAgICBpZiAoY2ggPT09IDM4KSB7IC8vICcmJ1xuICAgICAgICAgIG91dCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKTtcbiAgICAgICAgICBvdXQgKz0gdGhpcy5qc3hfcmVhZEVudGl0eSgpO1xuICAgICAgICAgIGNodW5rU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgICAgfSBlbHNlIGlmIChpc05ld0xpbmUoY2gpKSB7XG4gICAgICAgICAgb3V0ICs9IHRoaXMuaW5wdXQuc2xpY2UoY2h1bmtTdGFydCwgdGhpcy5wb3MpO1xuICAgICAgICAgIG91dCArPSB0aGlzLmpzeF9yZWFkTmV3TGluZShmYWxzZSk7XG4gICAgICAgICAgY2h1bmtTdGFydCA9IHRoaXMucG9zO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG91dCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKyspO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHQuc3RyaW5nLCBvdXQpO1xuICAgIH1cblxuICAgIGpzeF9yZWFkRW50aXR5KCkge1xuICAgICAgbGV0IHN0ciA9ICcnLCBjb3VudCA9IDAsIGVudGl0eTtcbiAgICAgIGxldCBjaCA9IHRoaXMuaW5wdXRbdGhpcy5wb3NdO1xuICAgICAgaWYgKGNoICE9PSAnJicpXG4gICAgICAgIHRoaXMucmFpc2UodGhpcy5wb3MsICdFbnRpdHkgbXVzdCBzdGFydCB3aXRoIGFuIGFtcGVyc2FuZCcpO1xuICAgICAgbGV0IHN0YXJ0UG9zID0gKyt0aGlzLnBvcztcbiAgICAgIHdoaWxlICh0aGlzLnBvcyA8IHRoaXMuaW5wdXQubGVuZ3RoICYmIGNvdW50KysgPCAxMCkge1xuICAgICAgICBjaCA9IHRoaXMuaW5wdXRbdGhpcy5wb3MrK107XG4gICAgICAgIGlmIChjaCA9PT0gJzsnKSB7XG4gICAgICAgICAgaWYgKHN0clswXSA9PT0gJyMnKSB7XG4gICAgICAgICAgICBpZiAoc3RyWzFdID09PSAneCcpIHtcbiAgICAgICAgICAgICAgc3RyID0gc3RyLnN1YnN0cigyKTtcbiAgICAgICAgICAgICAgaWYgKGhleE51bWJlci50ZXN0KHN0cikpXG4gICAgICAgICAgICAgICAgZW50aXR5ID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJzZUludChzdHIsIDE2KSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzdHIgPSBzdHIuc3Vic3RyKDEpO1xuICAgICAgICAgICAgICBpZiAoZGVjaW1hbE51bWJlci50ZXN0KHN0cikpXG4gICAgICAgICAgICAgICAgZW50aXR5ID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJzZUludChzdHIsIDEwKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVudGl0eSA9IFhIVE1MRW50aXRpZXNbc3RyXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgc3RyICs9IGNoO1xuICAgICAgfVxuICAgICAgaWYgKCFlbnRpdHkpIHtcbiAgICAgICAgdGhpcy5wb3MgPSBzdGFydFBvcztcbiAgICAgICAgcmV0dXJuICcmJztcbiAgICAgIH1cbiAgICAgIHJldHVybiBlbnRpdHk7XG4gICAgfVxuXG4gICAgLy8gUmVhZCBhIEpTWCBpZGVudGlmaWVyICh2YWxpZCB0YWcgb3IgYXR0cmlidXRlIG5hbWUpLlxuICAgIC8vXG4gICAgLy8gT3B0aW1pemVkIHZlcnNpb24gc2luY2UgSlNYIGlkZW50aWZpZXJzIGNhbid0IGNvbnRhaW5cbiAgICAvLyBlc2NhcGUgY2hhcmFjdGVycyBhbmQgc28gY2FuIGJlIHJlYWQgYXMgc2luZ2xlIHNsaWNlLlxuICAgIC8vIEFsc28gYXNzdW1lcyB0aGF0IGZpcnN0IGNoYXJhY3RlciB3YXMgYWxyZWFkeSBjaGVja2VkXG4gICAgLy8gYnkgaXNJZGVudGlmaWVyU3RhcnQgaW4gcmVhZFRva2VuLlxuXG4gICAganN4X3JlYWRXb3JkKCkge1xuICAgICAgbGV0IGNoLCBzdGFydCA9IHRoaXMucG9zO1xuICAgICAgZG8ge1xuICAgICAgICBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCgrK3RoaXMucG9zKTtcbiAgICAgIH0gd2hpbGUgKGlzSWRlbnRpZmllckNoYXIoY2gpIHx8IGNoID09PSA0NSk7IC8vICctJ1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odG9rLmpzeE5hbWUsIHRoaXMuaW5wdXQuc2xpY2Uoc3RhcnQsIHRoaXMucG9zKSk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgbmV4dCB0b2tlbiBhcyBKU1ggaWRlbnRpZmllclxuXG4gICAganN4X3BhcnNlSWRlbnRpZmllcigpIHtcbiAgICAgIGxldCBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHRvay5qc3hOYW1lKVxuICAgICAgICBub2RlLm5hbWUgPSB0aGlzLnZhbHVlO1xuICAgICAgZWxzZSBpZiAodGhpcy50eXBlLmtleXdvcmQpXG4gICAgICAgIG5vZGUubmFtZSA9IHRoaXMudHlwZS5rZXl3b3JkO1xuICAgICAgZWxzZVxuICAgICAgICB0aGlzLnVuZXhwZWN0ZWQoKTtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCAnSlNYSWRlbnRpZmllcicpO1xuICAgIH1cblxuICAgIC8vIFBhcnNlIG5hbWVzcGFjZWQgaWRlbnRpZmllci5cblxuICAgIGpzeF9wYXJzZU5hbWVzcGFjZWROYW1lKCkge1xuICAgICAgbGV0IHN0YXJ0UG9zID0gdGhpcy5zdGFydCwgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jO1xuICAgICAgbGV0IG5hbWUgPSB0aGlzLmpzeF9wYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgIGlmICghb3B0aW9ucy5hbGxvd05hbWVzcGFjZXMgfHwgIXRoaXMuZWF0KHR0LmNvbG9uKSkgcmV0dXJuIG5hbWU7XG4gICAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICAgIG5vZGUubmFtZXNwYWNlID0gbmFtZTtcbiAgICAgIG5vZGUubmFtZSA9IHRoaXMuanN4X3BhcnNlSWRlbnRpZmllcigpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCAnSlNYTmFtZXNwYWNlZE5hbWUnKTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZXMgZWxlbWVudCBuYW1lIGluIGFueSBmb3JtIC0gbmFtZXNwYWNlZCwgbWVtYmVyXG4gICAgLy8gb3Igc2luZ2xlIGlkZW50aWZpZXIuXG5cbiAgICBqc3hfcGFyc2VFbGVtZW50TmFtZSgpIHtcbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHRvay5qc3hUYWdFbmQpIHJldHVybiAnJztcbiAgICAgIGxldCBzdGFydFBvcyA9IHRoaXMuc3RhcnQsIHN0YXJ0TG9jID0gdGhpcy5zdGFydExvYztcbiAgICAgIGxldCBub2RlID0gdGhpcy5qc3hfcGFyc2VOYW1lc3BhY2VkTmFtZSgpO1xuICAgICAgaWYgKHRoaXMudHlwZSA9PT0gdHQuZG90ICYmIG5vZGUudHlwZSA9PT0gJ0pTWE5hbWVzcGFjZWROYW1lJyAmJiAhb3B0aW9ucy5hbGxvd05hbWVzcGFjZWRPYmplY3RzKSB7XG4gICAgICAgIHRoaXMudW5leHBlY3RlZCgpO1xuICAgICAgfVxuICAgICAgd2hpbGUgKHRoaXMuZWF0KHR0LmRvdCkpIHtcbiAgICAgICAgbGV0IG5ld05vZGUgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICAgIG5ld05vZGUub2JqZWN0ID0gbm9kZTtcbiAgICAgICAgbmV3Tm9kZS5wcm9wZXJ0eSA9IHRoaXMuanN4X3BhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICBub2RlID0gdGhpcy5maW5pc2hOb2RlKG5ld05vZGUsICdKU1hNZW1iZXJFeHByZXNzaW9uJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZXMgYW55IHR5cGUgb2YgSlNYIGF0dHJpYnV0ZSB2YWx1ZS5cblxuICAgIGpzeF9wYXJzZUF0dHJpYnV0ZVZhbHVlKCkge1xuICAgICAgc3dpdGNoICh0aGlzLnR5cGUpIHtcbiAgICAgIGNhc2UgdHQuYnJhY2VMOlxuICAgICAgICBsZXQgbm9kZSA9IHRoaXMuanN4X3BhcnNlRXhwcmVzc2lvbkNvbnRhaW5lcigpO1xuICAgICAgICBpZiAobm9kZS5leHByZXNzaW9uLnR5cGUgPT09ICdKU1hFbXB0eUV4cHJlc3Npb24nKVxuICAgICAgICAgIHRoaXMucmFpc2Uobm9kZS5zdGFydCwgJ0pTWCBhdHRyaWJ1dGVzIG11c3Qgb25seSBiZSBhc3NpZ25lZCBhIG5vbi1lbXB0eSBleHByZXNzaW9uJyk7XG4gICAgICAgIHJldHVybiBub2RlO1xuXG4gICAgICBjYXNlIHRvay5qc3hUYWdTdGFydDpcbiAgICAgIGNhc2UgdHQuc3RyaW5nOlxuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZUV4cHJBdG9tKCk7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMucmFpc2UodGhpcy5zdGFydCwgJ0pTWCB2YWx1ZSBzaG91bGQgYmUgZWl0aGVyIGFuIGV4cHJlc3Npb24gb3IgYSBxdW90ZWQgSlNYIHRleHQnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBKU1hFbXB0eUV4cHJlc3Npb24gaXMgdW5pcXVlIHR5cGUgc2luY2UgaXQgZG9lc24ndCBhY3R1YWxseSBwYXJzZSBhbnl0aGluZyxcbiAgICAvLyBhbmQgc28gaXQgc2hvdWxkIHN0YXJ0IGF0IHRoZSBlbmQgb2YgbGFzdCByZWFkIHRva2VuIChsZWZ0IGJyYWNlKSBhbmQgZmluaXNoXG4gICAgLy8gYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgbmV4dCBvbmUgKHJpZ2h0IGJyYWNlKS5cblxuICAgIGpzeF9wYXJzZUVtcHR5RXhwcmVzc2lvbigpIHtcbiAgICAgIGxldCBub2RlID0gdGhpcy5zdGFydE5vZGVBdCh0aGlzLmxhc3RUb2tFbmQsIHRoaXMubGFzdFRva0VuZExvYyk7XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlQXQobm9kZSwgJ0pTWEVtcHR5RXhwcmVzc2lvbicsIHRoaXMuc3RhcnQsIHRoaXMuc3RhcnRMb2MpO1xuICAgIH1cblxuICAgIC8vIFBhcnNlcyBKU1ggZXhwcmVzc2lvbiBlbmNsb3NlZCBpbnRvIGN1cmx5IGJyYWNrZXRzLlxuXG4gICAganN4X3BhcnNlRXhwcmVzc2lvbkNvbnRhaW5lcigpIHtcbiAgICAgIGxldCBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgbm9kZS5leHByZXNzaW9uID0gdGhpcy50eXBlID09PSB0dC5icmFjZVJcbiAgICAgICAgPyB0aGlzLmpzeF9wYXJzZUVtcHR5RXhwcmVzc2lvbigpXG4gICAgICAgIDogdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICAgIHRoaXMuZXhwZWN0KHR0LmJyYWNlUik7XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsICdKU1hFeHByZXNzaW9uQ29udGFpbmVyJyk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2VzIGZvbGxvd2luZyBKU1ggYXR0cmlidXRlIG5hbWUtdmFsdWUgcGFpci5cblxuICAgIGpzeF9wYXJzZUF0dHJpYnV0ZSgpIHtcbiAgICAgIGxldCBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICAgIGlmICh0aGlzLmVhdCh0dC5icmFjZUwpKSB7XG4gICAgICAgIHRoaXMuZXhwZWN0KHR0LmVsbGlwc2lzKTtcbiAgICAgICAgbm9kZS5hcmd1bWVudCA9IHRoaXMucGFyc2VNYXliZUFzc2lnbigpO1xuICAgICAgICB0aGlzLmV4cGVjdCh0dC5icmFjZVIpO1xuICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsICdKU1hTcHJlYWRBdHRyaWJ1dGUnKTtcbiAgICAgIH1cbiAgICAgIG5vZGUubmFtZSA9IHRoaXMuanN4X3BhcnNlTmFtZXNwYWNlZE5hbWUoKTtcbiAgICAgIG5vZGUudmFsdWUgPSB0aGlzLmVhdCh0dC5lcSkgPyB0aGlzLmpzeF9wYXJzZUF0dHJpYnV0ZVZhbHVlKCkgOiBudWxsO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCAnSlNYQXR0cmlidXRlJyk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2VzIEpTWCBvcGVuaW5nIHRhZyBzdGFydGluZyBhZnRlciAnPCcuXG5cbiAgICBqc3hfcGFyc2VPcGVuaW5nRWxlbWVudEF0KHN0YXJ0UG9zLCBzdGFydExvYykge1xuICAgICAgbGV0IG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICBub2RlLmF0dHJpYnV0ZXMgPSBbXTtcbiAgICAgIGxldCBub2RlTmFtZSA9IHRoaXMuanN4X3BhcnNlRWxlbWVudE5hbWUoKTtcbiAgICAgIGlmIChub2RlTmFtZSkgbm9kZS5uYW1lID0gbm9kZU5hbWU7XG4gICAgICB3aGlsZSAodGhpcy50eXBlICE9PSB0dC5zbGFzaCAmJiB0aGlzLnR5cGUgIT09IHRvay5qc3hUYWdFbmQpXG4gICAgICAgIG5vZGUuYXR0cmlidXRlcy5wdXNoKHRoaXMuanN4X3BhcnNlQXR0cmlidXRlKCkpO1xuICAgICAgbm9kZS5zZWxmQ2xvc2luZyA9IHRoaXMuZWF0KHR0LnNsYXNoKTtcbiAgICAgIHRoaXMuZXhwZWN0KHRvay5qc3hUYWdFbmQpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBub2RlTmFtZSA/ICdKU1hPcGVuaW5nRWxlbWVudCcgOiAnSlNYT3BlbmluZ0ZyYWdtZW50Jyk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2VzIEpTWCBjbG9zaW5nIHRhZyBzdGFydGluZyBhZnRlciAnPC8nLlxuXG4gICAganN4X3BhcnNlQ2xvc2luZ0VsZW1lbnRBdChzdGFydFBvcywgc3RhcnRMb2MpIHtcbiAgICAgIGxldCBub2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgbGV0IG5vZGVOYW1lID0gdGhpcy5qc3hfcGFyc2VFbGVtZW50TmFtZSgpO1xuICAgICAgaWYgKG5vZGVOYW1lKSBub2RlLm5hbWUgPSBub2RlTmFtZTtcbiAgICAgIHRoaXMuZXhwZWN0KHRvay5qc3hUYWdFbmQpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBub2RlTmFtZSA/ICdKU1hDbG9zaW5nRWxlbWVudCcgOiAnSlNYQ2xvc2luZ0ZyYWdtZW50Jyk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2VzIGVudGlyZSBKU1ggZWxlbWVudCwgaW5jbHVkaW5nIGl0J3Mgb3BlbmluZyB0YWdcbiAgICAvLyAoc3RhcnRpbmcgYWZ0ZXIgJzwnKSwgYXR0cmlidXRlcywgY29udGVudHMgYW5kIGNsb3NpbmcgdGFnLlxuXG4gICAganN4X3BhcnNlRWxlbWVudEF0KHN0YXJ0UG9zLCBzdGFydExvYykge1xuICAgICAgbGV0IG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICBsZXQgY2hpbGRyZW4gPSBbXTtcbiAgICAgIGxldCBvcGVuaW5nRWxlbWVudCA9IHRoaXMuanN4X3BhcnNlT3BlbmluZ0VsZW1lbnRBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgbGV0IGNsb3NpbmdFbGVtZW50ID0gbnVsbDtcblxuICAgICAgaWYgKCFvcGVuaW5nRWxlbWVudC5zZWxmQ2xvc2luZykge1xuICAgICAgICBjb250ZW50czogZm9yICg7Oykge1xuICAgICAgICAgIHN3aXRjaCAodGhpcy50eXBlKSB7XG4gICAgICAgICAgY2FzZSB0b2suanN4VGFnU3RhcnQ6XG4gICAgICAgICAgICBzdGFydFBvcyA9IHRoaXMuc3RhcnQ7IHN0YXJ0TG9jID0gdGhpcy5zdGFydExvYztcbiAgICAgICAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZWF0KHR0LnNsYXNoKSkge1xuICAgICAgICAgICAgICBjbG9zaW5nRWxlbWVudCA9IHRoaXMuanN4X3BhcnNlQ2xvc2luZ0VsZW1lbnRBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgICAgICAgICBicmVhayBjb250ZW50cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNoaWxkcmVuLnB1c2godGhpcy5qc3hfcGFyc2VFbGVtZW50QXQoc3RhcnRQb3MsIHN0YXJ0TG9jKSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgdG9rLmpzeFRleHQ6XG4gICAgICAgICAgICBjaGlsZHJlbi5wdXNoKHRoaXMucGFyc2VFeHByQXRvbSgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSB0dC5icmFjZUw6XG4gICAgICAgICAgICBjaGlsZHJlbi5wdXNoKHRoaXMuanN4X3BhcnNlRXhwcmVzc2lvbkNvbnRhaW5lcigpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRoaXMudW5leHBlY3RlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZ2V0UXVhbGlmaWVkSlNYTmFtZShjbG9zaW5nRWxlbWVudC5uYW1lKSAhPT0gZ2V0UXVhbGlmaWVkSlNYTmFtZShvcGVuaW5nRWxlbWVudC5uYW1lKSkge1xuICAgICAgICAgIHRoaXMucmFpc2UoXG4gICAgICAgICAgICBjbG9zaW5nRWxlbWVudC5zdGFydCxcbiAgICAgICAgICAgICdFeHBlY3RlZCBjb3JyZXNwb25kaW5nIEpTWCBjbG9zaW5nIHRhZyBmb3IgPCcgKyBnZXRRdWFsaWZpZWRKU1hOYW1lKG9wZW5pbmdFbGVtZW50Lm5hbWUpICsgJz4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IGZyYWdtZW50T3JFbGVtZW50ID0gb3BlbmluZ0VsZW1lbnQubmFtZSA/ICdFbGVtZW50JyA6ICdGcmFnbWVudCc7XG5cbiAgICAgIG5vZGVbJ29wZW5pbmcnICsgZnJhZ21lbnRPckVsZW1lbnRdID0gb3BlbmluZ0VsZW1lbnQ7XG4gICAgICBub2RlWydjbG9zaW5nJyArIGZyYWdtZW50T3JFbGVtZW50XSA9IGNsb3NpbmdFbGVtZW50O1xuICAgICAgbm9kZS5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICAgICAgaWYgKHRoaXMudHlwZSA9PT0gdHQucmVsYXRpb25hbCAmJiB0aGlzLnZhbHVlID09PSBcIjxcIikge1xuICAgICAgICB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsIFwiQWRqYWNlbnQgSlNYIGVsZW1lbnRzIG11c3QgYmUgd3JhcHBlZCBpbiBhbiBlbmNsb3NpbmcgdGFnXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCAnSlNYJyArIGZyYWdtZW50T3JFbGVtZW50KTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSBKU1ggdGV4dFxuXG4gICAganN4X3BhcnNlVGV4dCgpIHtcbiAgICAgIGxldCBub2RlID0gdGhpcy5wYXJzZUxpdGVyYWwodGhpcy52YWx1ZSk7XG4gICAgICBub2RlLnR5cGUgPSBcIkpTWFRleHRcIjtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIC8vIFBhcnNlcyBlbnRpcmUgSlNYIGVsZW1lbnQgZnJvbSBjdXJyZW50IHBvc2l0aW9uLlxuXG4gICAganN4X3BhcnNlRWxlbWVudCgpIHtcbiAgICAgIGxldCBzdGFydFBvcyA9IHRoaXMuc3RhcnQsIHN0YXJ0TG9jID0gdGhpcy5zdGFydExvYztcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgcmV0dXJuIHRoaXMuanN4X3BhcnNlRWxlbWVudEF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgfVxuXG4gICAgcGFyc2VFeHByQXRvbShyZWZTaG9ydEhhbmREZWZhdWx0UG9zKSB7XG4gICAgICBpZiAodGhpcy50eXBlID09PSB0b2suanN4VGV4dClcbiAgICAgICAgcmV0dXJuIHRoaXMuanN4X3BhcnNlVGV4dCgpO1xuICAgICAgZWxzZSBpZiAodGhpcy50eXBlID09PSB0b2suanN4VGFnU3RhcnQpXG4gICAgICAgIHJldHVybiB0aGlzLmpzeF9wYXJzZUVsZW1lbnQoKTtcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIHN1cGVyLnBhcnNlRXhwckF0b20ocmVmU2hvcnRIYW5kRGVmYXVsdFBvcyk7XG4gICAgfVxuXG4gICAgcmVhZFRva2VuKGNvZGUpIHtcbiAgICAgIGxldCBjb250ZXh0ID0gdGhpcy5jdXJDb250ZXh0KCk7XG5cbiAgICAgIGlmIChjb250ZXh0ID09PSB0Y19leHByKSByZXR1cm4gdGhpcy5qc3hfcmVhZFRva2VuKCk7XG5cbiAgICAgIGlmIChjb250ZXh0ID09PSB0Y19vVGFnIHx8IGNvbnRleHQgPT09IHRjX2NUYWcpIHtcbiAgICAgICAgaWYgKGlzSWRlbnRpZmllclN0YXJ0KGNvZGUpKSByZXR1cm4gdGhpcy5qc3hfcmVhZFdvcmQoKTtcblxuICAgICAgICBpZiAoY29kZSA9PSA2Mikge1xuICAgICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odG9rLmpzeFRhZ0VuZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKGNvZGUgPT09IDM0IHx8IGNvZGUgPT09IDM5KSAmJiBjb250ZXh0ID09IHRjX29UYWcpXG4gICAgICAgICAgcmV0dXJuIHRoaXMuanN4X3JlYWRTdHJpbmcoY29kZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb2RlID09PSA2MCAmJiB0aGlzLmV4cHJBbGxvd2VkICYmIHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDEpICE9PSAzMykge1xuICAgICAgICArK3RoaXMucG9zO1xuICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0b2suanN4VGFnU3RhcnQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN1cGVyLnJlYWRUb2tlbihjb2RlKTtcbiAgICB9XG5cbiAgICB1cGRhdGVDb250ZXh0KHByZXZUeXBlKSB7XG4gICAgICBpZiAodGhpcy50eXBlID09IHR0LmJyYWNlTCkge1xuICAgICAgICB2YXIgY3VyQ29udGV4dCA9IHRoaXMuY3VyQ29udGV4dCgpO1xuICAgICAgICBpZiAoY3VyQ29udGV4dCA9PSB0Y19vVGFnKSB0aGlzLmNvbnRleHQucHVzaCh0b2tDb250ZXh0cy5iX2V4cHIpO1xuICAgICAgICBlbHNlIGlmIChjdXJDb250ZXh0ID09IHRjX2V4cHIpIHRoaXMuY29udGV4dC5wdXNoKHRva0NvbnRleHRzLmJfdG1wbCk7XG4gICAgICAgIGVsc2Ugc3VwZXIudXBkYXRlQ29udGV4dChwcmV2VHlwZSk7XG4gICAgICAgIHRoaXMuZXhwckFsbG93ZWQgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnR5cGUgPT09IHR0LnNsYXNoICYmIHByZXZUeXBlID09PSB0b2suanN4VGFnU3RhcnQpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0Lmxlbmd0aCAtPSAyOyAvLyBkbyBub3QgY29uc2lkZXIgSlNYIGV4cHIgLT4gSlNYIG9wZW4gdGFnIC0+IC4uLiBhbnltb3JlXG4gICAgICAgIHRoaXMuY29udGV4dC5wdXNoKHRjX2NUYWcpOyAvLyByZWNvbnNpZGVyIGFzIGNsb3NpbmcgdGFnIGNvbnRleHRcbiAgICAgICAgdGhpcy5leHByQWxsb3dlZCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHN1cGVyLnVwZGF0ZUNvbnRleHQocHJldlR5cGUpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBxdW90OiAnXFx1MDAyMicsXG4gIGFtcDogJyYnLFxuICBhcG9zOiAnXFx1MDAyNycsXG4gIGx0OiAnPCcsXG4gIGd0OiAnPicsXG4gIG5ic3A6ICdcXHUwMEEwJyxcbiAgaWV4Y2w6ICdcXHUwMEExJyxcbiAgY2VudDogJ1xcdTAwQTInLFxuICBwb3VuZDogJ1xcdTAwQTMnLFxuICBjdXJyZW46ICdcXHUwMEE0JyxcbiAgeWVuOiAnXFx1MDBBNScsXG4gIGJydmJhcjogJ1xcdTAwQTYnLFxuICBzZWN0OiAnXFx1MDBBNycsXG4gIHVtbDogJ1xcdTAwQTgnLFxuICBjb3B5OiAnXFx1MDBBOScsXG4gIG9yZGY6ICdcXHUwMEFBJyxcbiAgbGFxdW86ICdcXHUwMEFCJyxcbiAgbm90OiAnXFx1MDBBQycsXG4gIHNoeTogJ1xcdTAwQUQnLFxuICByZWc6ICdcXHUwMEFFJyxcbiAgbWFjcjogJ1xcdTAwQUYnLFxuICBkZWc6ICdcXHUwMEIwJyxcbiAgcGx1c21uOiAnXFx1MDBCMScsXG4gIHN1cDI6ICdcXHUwMEIyJyxcbiAgc3VwMzogJ1xcdTAwQjMnLFxuICBhY3V0ZTogJ1xcdTAwQjQnLFxuICBtaWNybzogJ1xcdTAwQjUnLFxuICBwYXJhOiAnXFx1MDBCNicsXG4gIG1pZGRvdDogJ1xcdTAwQjcnLFxuICBjZWRpbDogJ1xcdTAwQjgnLFxuICBzdXAxOiAnXFx1MDBCOScsXG4gIG9yZG06ICdcXHUwMEJBJyxcbiAgcmFxdW86ICdcXHUwMEJCJyxcbiAgZnJhYzE0OiAnXFx1MDBCQycsXG4gIGZyYWMxMjogJ1xcdTAwQkQnLFxuICBmcmFjMzQ6ICdcXHUwMEJFJyxcbiAgaXF1ZXN0OiAnXFx1MDBCRicsXG4gIEFncmF2ZTogJ1xcdTAwQzAnLFxuICBBYWN1dGU6ICdcXHUwMEMxJyxcbiAgQWNpcmM6ICdcXHUwMEMyJyxcbiAgQXRpbGRlOiAnXFx1MDBDMycsXG4gIEF1bWw6ICdcXHUwMEM0JyxcbiAgQXJpbmc6ICdcXHUwMEM1JyxcbiAgQUVsaWc6ICdcXHUwMEM2JyxcbiAgQ2NlZGlsOiAnXFx1MDBDNycsXG4gIEVncmF2ZTogJ1xcdTAwQzgnLFxuICBFYWN1dGU6ICdcXHUwMEM5JyxcbiAgRWNpcmM6ICdcXHUwMENBJyxcbiAgRXVtbDogJ1xcdTAwQ0InLFxuICBJZ3JhdmU6ICdcXHUwMENDJyxcbiAgSWFjdXRlOiAnXFx1MDBDRCcsXG4gIEljaXJjOiAnXFx1MDBDRScsXG4gIEl1bWw6ICdcXHUwMENGJyxcbiAgRVRIOiAnXFx1MDBEMCcsXG4gIE50aWxkZTogJ1xcdTAwRDEnLFxuICBPZ3JhdmU6ICdcXHUwMEQyJyxcbiAgT2FjdXRlOiAnXFx1MDBEMycsXG4gIE9jaXJjOiAnXFx1MDBENCcsXG4gIE90aWxkZTogJ1xcdTAwRDUnLFxuICBPdW1sOiAnXFx1MDBENicsXG4gIHRpbWVzOiAnXFx1MDBENycsXG4gIE9zbGFzaDogJ1xcdTAwRDgnLFxuICBVZ3JhdmU6ICdcXHUwMEQ5JyxcbiAgVWFjdXRlOiAnXFx1MDBEQScsXG4gIFVjaXJjOiAnXFx1MDBEQicsXG4gIFV1bWw6ICdcXHUwMERDJyxcbiAgWWFjdXRlOiAnXFx1MDBERCcsXG4gIFRIT1JOOiAnXFx1MDBERScsXG4gIHN6bGlnOiAnXFx1MDBERicsXG4gIGFncmF2ZTogJ1xcdTAwRTAnLFxuICBhYWN1dGU6ICdcXHUwMEUxJyxcbiAgYWNpcmM6ICdcXHUwMEUyJyxcbiAgYXRpbGRlOiAnXFx1MDBFMycsXG4gIGF1bWw6ICdcXHUwMEU0JyxcbiAgYXJpbmc6ICdcXHUwMEU1JyxcbiAgYWVsaWc6ICdcXHUwMEU2JyxcbiAgY2NlZGlsOiAnXFx1MDBFNycsXG4gIGVncmF2ZTogJ1xcdTAwRTgnLFxuICBlYWN1dGU6ICdcXHUwMEU5JyxcbiAgZWNpcmM6ICdcXHUwMEVBJyxcbiAgZXVtbDogJ1xcdTAwRUInLFxuICBpZ3JhdmU6ICdcXHUwMEVDJyxcbiAgaWFjdXRlOiAnXFx1MDBFRCcsXG4gIGljaXJjOiAnXFx1MDBFRScsXG4gIGl1bWw6ICdcXHUwMEVGJyxcbiAgZXRoOiAnXFx1MDBGMCcsXG4gIG50aWxkZTogJ1xcdTAwRjEnLFxuICBvZ3JhdmU6ICdcXHUwMEYyJyxcbiAgb2FjdXRlOiAnXFx1MDBGMycsXG4gIG9jaXJjOiAnXFx1MDBGNCcsXG4gIG90aWxkZTogJ1xcdTAwRjUnLFxuICBvdW1sOiAnXFx1MDBGNicsXG4gIGRpdmlkZTogJ1xcdTAwRjcnLFxuICBvc2xhc2g6ICdcXHUwMEY4JyxcbiAgdWdyYXZlOiAnXFx1MDBGOScsXG4gIHVhY3V0ZTogJ1xcdTAwRkEnLFxuICB1Y2lyYzogJ1xcdTAwRkInLFxuICB1dW1sOiAnXFx1MDBGQycsXG4gIHlhY3V0ZTogJ1xcdTAwRkQnLFxuICB0aG9ybjogJ1xcdTAwRkUnLFxuICB5dW1sOiAnXFx1MDBGRicsXG4gIE9FbGlnOiAnXFx1MDE1MicsXG4gIG9lbGlnOiAnXFx1MDE1MycsXG4gIFNjYXJvbjogJ1xcdTAxNjAnLFxuICBzY2Fyb246ICdcXHUwMTYxJyxcbiAgWXVtbDogJ1xcdTAxNzgnLFxuICBmbm9mOiAnXFx1MDE5MicsXG4gIGNpcmM6ICdcXHUwMkM2JyxcbiAgdGlsZGU6ICdcXHUwMkRDJyxcbiAgQWxwaGE6ICdcXHUwMzkxJyxcbiAgQmV0YTogJ1xcdTAzOTInLFxuICBHYW1tYTogJ1xcdTAzOTMnLFxuICBEZWx0YTogJ1xcdTAzOTQnLFxuICBFcHNpbG9uOiAnXFx1MDM5NScsXG4gIFpldGE6ICdcXHUwMzk2JyxcbiAgRXRhOiAnXFx1MDM5NycsXG4gIFRoZXRhOiAnXFx1MDM5OCcsXG4gIElvdGE6ICdcXHUwMzk5JyxcbiAgS2FwcGE6ICdcXHUwMzlBJyxcbiAgTGFtYmRhOiAnXFx1MDM5QicsXG4gIE11OiAnXFx1MDM5QycsXG4gIE51OiAnXFx1MDM5RCcsXG4gIFhpOiAnXFx1MDM5RScsXG4gIE9taWNyb246ICdcXHUwMzlGJyxcbiAgUGk6ICdcXHUwM0EwJyxcbiAgUmhvOiAnXFx1MDNBMScsXG4gIFNpZ21hOiAnXFx1MDNBMycsXG4gIFRhdTogJ1xcdTAzQTQnLFxuICBVcHNpbG9uOiAnXFx1MDNBNScsXG4gIFBoaTogJ1xcdTAzQTYnLFxuICBDaGk6ICdcXHUwM0E3JyxcbiAgUHNpOiAnXFx1MDNBOCcsXG4gIE9tZWdhOiAnXFx1MDNBOScsXG4gIGFscGhhOiAnXFx1MDNCMScsXG4gIGJldGE6ICdcXHUwM0IyJyxcbiAgZ2FtbWE6ICdcXHUwM0IzJyxcbiAgZGVsdGE6ICdcXHUwM0I0JyxcbiAgZXBzaWxvbjogJ1xcdTAzQjUnLFxuICB6ZXRhOiAnXFx1MDNCNicsXG4gIGV0YTogJ1xcdTAzQjcnLFxuICB0aGV0YTogJ1xcdTAzQjgnLFxuICBpb3RhOiAnXFx1MDNCOScsXG4gIGthcHBhOiAnXFx1MDNCQScsXG4gIGxhbWJkYTogJ1xcdTAzQkInLFxuICBtdTogJ1xcdTAzQkMnLFxuICBudTogJ1xcdTAzQkQnLFxuICB4aTogJ1xcdTAzQkUnLFxuICBvbWljcm9uOiAnXFx1MDNCRicsXG4gIHBpOiAnXFx1MDNDMCcsXG4gIHJobzogJ1xcdTAzQzEnLFxuICBzaWdtYWY6ICdcXHUwM0MyJyxcbiAgc2lnbWE6ICdcXHUwM0MzJyxcbiAgdGF1OiAnXFx1MDNDNCcsXG4gIHVwc2lsb246ICdcXHUwM0M1JyxcbiAgcGhpOiAnXFx1MDNDNicsXG4gIGNoaTogJ1xcdTAzQzcnLFxuICBwc2k6ICdcXHUwM0M4JyxcbiAgb21lZ2E6ICdcXHUwM0M5JyxcbiAgdGhldGFzeW06ICdcXHUwM0QxJyxcbiAgdXBzaWg6ICdcXHUwM0QyJyxcbiAgcGl2OiAnXFx1MDNENicsXG4gIGVuc3A6ICdcXHUyMDAyJyxcbiAgZW1zcDogJ1xcdTIwMDMnLFxuICB0aGluc3A6ICdcXHUyMDA5JyxcbiAgenduajogJ1xcdTIwMEMnLFxuICB6d2o6ICdcXHUyMDBEJyxcbiAgbHJtOiAnXFx1MjAwRScsXG4gIHJsbTogJ1xcdTIwMEYnLFxuICBuZGFzaDogJ1xcdTIwMTMnLFxuICBtZGFzaDogJ1xcdTIwMTQnLFxuICBsc3F1bzogJ1xcdTIwMTgnLFxuICByc3F1bzogJ1xcdTIwMTknLFxuICBzYnF1bzogJ1xcdTIwMUEnLFxuICBsZHF1bzogJ1xcdTIwMUMnLFxuICByZHF1bzogJ1xcdTIwMUQnLFxuICBiZHF1bzogJ1xcdTIwMUUnLFxuICBkYWdnZXI6ICdcXHUyMDIwJyxcbiAgRGFnZ2VyOiAnXFx1MjAyMScsXG4gIGJ1bGw6ICdcXHUyMDIyJyxcbiAgaGVsbGlwOiAnXFx1MjAyNicsXG4gIHBlcm1pbDogJ1xcdTIwMzAnLFxuICBwcmltZTogJ1xcdTIwMzInLFxuICBQcmltZTogJ1xcdTIwMzMnLFxuICBsc2FxdW86ICdcXHUyMDM5JyxcbiAgcnNhcXVvOiAnXFx1MjAzQScsXG4gIG9saW5lOiAnXFx1MjAzRScsXG4gIGZyYXNsOiAnXFx1MjA0NCcsXG4gIGV1cm86ICdcXHUyMEFDJyxcbiAgaW1hZ2U6ICdcXHUyMTExJyxcbiAgd2VpZXJwOiAnXFx1MjExOCcsXG4gIHJlYWw6ICdcXHUyMTFDJyxcbiAgdHJhZGU6ICdcXHUyMTIyJyxcbiAgYWxlZnN5bTogJ1xcdTIxMzUnLFxuICBsYXJyOiAnXFx1MjE5MCcsXG4gIHVhcnI6ICdcXHUyMTkxJyxcbiAgcmFycjogJ1xcdTIxOTInLFxuICBkYXJyOiAnXFx1MjE5MycsXG4gIGhhcnI6ICdcXHUyMTk0JyxcbiAgY3JhcnI6ICdcXHUyMUI1JyxcbiAgbEFycjogJ1xcdTIxRDAnLFxuICB1QXJyOiAnXFx1MjFEMScsXG4gIHJBcnI6ICdcXHUyMUQyJyxcbiAgZEFycjogJ1xcdTIxRDMnLFxuICBoQXJyOiAnXFx1MjFENCcsXG4gIGZvcmFsbDogJ1xcdTIyMDAnLFxuICBwYXJ0OiAnXFx1MjIwMicsXG4gIGV4aXN0OiAnXFx1MjIwMycsXG4gIGVtcHR5OiAnXFx1MjIwNScsXG4gIG5hYmxhOiAnXFx1MjIwNycsXG4gIGlzaW46ICdcXHUyMjA4JyxcbiAgbm90aW46ICdcXHUyMjA5JyxcbiAgbmk6ICdcXHUyMjBCJyxcbiAgcHJvZDogJ1xcdTIyMEYnLFxuICBzdW06ICdcXHUyMjExJyxcbiAgbWludXM6ICdcXHUyMjEyJyxcbiAgbG93YXN0OiAnXFx1MjIxNycsXG4gIHJhZGljOiAnXFx1MjIxQScsXG4gIHByb3A6ICdcXHUyMjFEJyxcbiAgaW5maW46ICdcXHUyMjFFJyxcbiAgYW5nOiAnXFx1MjIyMCcsXG4gIGFuZDogJ1xcdTIyMjcnLFxuICBvcjogJ1xcdTIyMjgnLFxuICBjYXA6ICdcXHUyMjI5JyxcbiAgY3VwOiAnXFx1MjIyQScsXG4gICdpbnQnOiAnXFx1MjIyQicsXG4gIHRoZXJlNDogJ1xcdTIyMzQnLFxuICBzaW06ICdcXHUyMjNDJyxcbiAgY29uZzogJ1xcdTIyNDUnLFxuICBhc3ltcDogJ1xcdTIyNDgnLFxuICBuZTogJ1xcdTIyNjAnLFxuICBlcXVpdjogJ1xcdTIyNjEnLFxuICBsZTogJ1xcdTIyNjQnLFxuICBnZTogJ1xcdTIyNjUnLFxuICBzdWI6ICdcXHUyMjgyJyxcbiAgc3VwOiAnXFx1MjI4MycsXG4gIG5zdWI6ICdcXHUyMjg0JyxcbiAgc3ViZTogJ1xcdTIyODYnLFxuICBzdXBlOiAnXFx1MjI4NycsXG4gIG9wbHVzOiAnXFx1MjI5NScsXG4gIG90aW1lczogJ1xcdTIyOTcnLFxuICBwZXJwOiAnXFx1MjJBNScsXG4gIHNkb3Q6ICdcXHUyMkM1JyxcbiAgbGNlaWw6ICdcXHUyMzA4JyxcbiAgcmNlaWw6ICdcXHUyMzA5JyxcbiAgbGZsb29yOiAnXFx1MjMwQScsXG4gIHJmbG9vcjogJ1xcdTIzMEInLFxuICBsYW5nOiAnXFx1MjMyOScsXG4gIHJhbmc6ICdcXHUyMzJBJyxcbiAgbG96OiAnXFx1MjVDQScsXG4gIHNwYWRlczogJ1xcdTI2NjAnLFxuICBjbHViczogJ1xcdTI2NjMnLFxuICBoZWFydHM6ICdcXHUyNjY1JyxcbiAgZGlhbXM6ICdcXHUyNjY2J1xufTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG4gIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IGZhY3RvcnkoZXhwb3J0cykgOlxuICB0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoWydleHBvcnRzJ10sIGZhY3RvcnkpIDpcbiAgKGdsb2JhbCA9IHR5cGVvZiBnbG9iYWxUaGlzICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbFRoaXMgOiBnbG9iYWwgfHwgc2VsZiwgZmFjdG9yeShnbG9iYWwuYWNvcm4gPSB7fSkpO1xufSkodGhpcywgKGZ1bmN0aW9uIChleHBvcnRzKSB7ICd1c2Ugc3RyaWN0JztcblxuICAvLyBUaGlzIGZpbGUgd2FzIGdlbmVyYXRlZC4gRG8gbm90IG1vZGlmeSBtYW51YWxseSFcbiAgdmFyIGFzdHJhbElkZW50aWZpZXJDb2RlcyA9IFs1MDksIDAsIDIyNywgMCwgMTUwLCA0LCAyOTQsIDksIDEzNjgsIDIsIDIsIDEsIDYsIDMsIDQxLCAyLCA1LCAwLCAxNjYsIDEsIDU3NCwgMywgOSwgOSwgMzcwLCAxLCA4MSwgMiwgNzEsIDEwLCA1MCwgMywgMTIzLCAyLCA1NCwgMTQsIDMyLCAxMCwgMywgMSwgMTEsIDMsIDQ2LCAxMCwgOCwgMCwgNDYsIDksIDcsIDIsIDM3LCAxMywgMiwgOSwgNiwgMSwgNDUsIDAsIDEzLCAyLCA0OSwgMTMsIDksIDMsIDIsIDExLCA4MywgMTEsIDcsIDAsIDMsIDAsIDE1OCwgMTEsIDYsIDksIDcsIDMsIDU2LCAxLCAyLCA2LCAzLCAxLCAzLCAyLCAxMCwgMCwgMTEsIDEsIDMsIDYsIDQsIDQsIDE5MywgMTcsIDEwLCA5LCA1LCAwLCA4MiwgMTksIDEzLCA5LCAyMTQsIDYsIDMsIDgsIDI4LCAxLCA4MywgMTYsIDE2LCA5LCA4MiwgMTIsIDksIDksIDg0LCAxNCwgNSwgOSwgMjQzLCAxNCwgMTY2LCA5LCA3MSwgNSwgMiwgMSwgMywgMywgMiwgMCwgMiwgMSwgMTMsIDksIDEyMCwgNiwgMywgNiwgNCwgMCwgMjksIDksIDQxLCA2LCAyLCAzLCA5LCAwLCAxMCwgMTAsIDQ3LCAxNSwgNDA2LCA3LCAyLCA3LCAxNywgOSwgNTcsIDIxLCAyLCAxMywgMTIzLCA1LCA0LCAwLCAyLCAxLCAyLCA2LCAyLCAwLCA5LCA5LCA0OSwgNCwgMiwgMSwgMiwgNCwgOSwgOSwgMzMwLCAzLCAxMCwgMSwgMiwgMCwgNDksIDYsIDQsIDQsIDE0LCA5LCA1MzUxLCAwLCA3LCAxNCwgMTM4MzUsIDksIDg3LCA5LCAzOSwgNCwgNjAsIDYsIDI2LCA5LCAxMDE0LCAwLCAyLCA1NCwgOCwgMywgODIsIDAsIDEyLCAxLCAxOTYyOCwgMSwgNDcwNiwgNDUsIDMsIDIyLCA1NDMsIDQsIDQsIDUsIDksIDcsIDMsIDYsIDMxLCAzLCAxNDksIDIsIDE0MTgsIDQ5LCA1MTMsIDU0LCA1LCA0OSwgOSwgMCwgMTUsIDAsIDIzLCA0LCAyLCAxNCwgMTM2MSwgNiwgMiwgMTYsIDMsIDYsIDIsIDEsIDIsIDQsIDEwMSwgMCwgMTYxLCA2LCAxMCwgOSwgMzU3LCAwLCA2MiwgMTMsIDQ5OSwgMTMsIDk4MywgNiwgMTEwLCA2LCA2LCA5LCA0NzU5LCA5LCA3ODc3MTksIDIzOV07XG5cbiAgLy8gVGhpcyBmaWxlIHdhcyBnZW5lcmF0ZWQuIERvIG5vdCBtb2RpZnkgbWFudWFsbHkhXG4gIHZhciBhc3RyYWxJZGVudGlmaWVyU3RhcnRDb2RlcyA9IFswLCAxMSwgMiwgMjUsIDIsIDE4LCAyLCAxLCAyLCAxNCwgMywgMTMsIDM1LCAxMjIsIDcwLCA1MiwgMjY4LCAyOCwgNCwgNDgsIDQ4LCAzMSwgMTQsIDI5LCA2LCAzNywgMTEsIDI5LCAzLCAzNSwgNSwgNywgMiwgNCwgNDMsIDE1NywgMTksIDM1LCA1LCAzNSwgNSwgMzksIDksIDUxLCAxMywgMTAsIDIsIDE0LCAyLCA2LCAyLCAxLCAyLCAxMCwgMiwgMTQsIDIsIDYsIDIsIDEsIDY4LCAzMTAsIDEwLCAyMSwgMTEsIDcsIDI1LCA1LCAyLCA0MSwgMiwgOCwgNzAsIDUsIDMsIDAsIDIsIDQzLCAyLCAxLCA0LCAwLCAzLCAyMiwgMTEsIDIyLCAxMCwgMzAsIDY2LCAxOCwgMiwgMSwgMTEsIDIxLCAxMSwgMjUsIDcxLCA1NSwgNywgMSwgNjUsIDAsIDE2LCAzLCAyLCAyLCAyLCAyOCwgNDMsIDI4LCA0LCAyOCwgMzYsIDcsIDIsIDI3LCAyOCwgNTMsIDExLCAyMSwgMTEsIDE4LCAxNCwgMTcsIDExMSwgNzIsIDU2LCA1MCwgMTQsIDUwLCAxNCwgMzUsIDM0OSwgNDEsIDcsIDEsIDc5LCAyOCwgMTEsIDAsIDksIDIxLCA0MywgMTcsIDQ3LCAyMCwgMjgsIDIyLCAxMywgNTIsIDU4LCAxLCAzLCAwLCAxNCwgNDQsIDMzLCAyNCwgMjcsIDM1LCAzMCwgMCwgMywgMCwgOSwgMzQsIDQsIDAsIDEzLCA0NywgMTUsIDMsIDIyLCAwLCAyLCAwLCAzNiwgMTcsIDIsIDI0LCAyMCwgMSwgNjQsIDYsIDIsIDAsIDIsIDMsIDIsIDE0LCAyLCA5LCA4LCA0NiwgMzksIDcsIDMsIDEsIDMsIDIxLCAyLCA2LCAyLCAxLCAyLCA0LCA0LCAwLCAxOSwgMCwgMTMsIDQsIDE1OSwgNTIsIDE5LCAzLCAyMSwgMiwgMzEsIDQ3LCAyMSwgMSwgMiwgMCwgMTg1LCA0NiwgNDIsIDMsIDM3LCA0NywgMjEsIDAsIDYwLCA0MiwgMTQsIDAsIDcyLCAyNiwgMzgsIDYsIDE4NiwgNDMsIDExNywgNjMsIDMyLCA3LCAzLCAwLCAzLCA3LCAyLCAxLCAyLCAyMywgMTYsIDAsIDIsIDAsIDk1LCA3LCAzLCAzOCwgMTcsIDAsIDIsIDAsIDI5LCAwLCAxMSwgMzksIDgsIDAsIDIyLCAwLCAxMiwgNDUsIDIwLCAwLCAxOSwgNzIsIDI2NCwgOCwgMiwgMzYsIDE4LCAwLCA1MCwgMjksIDExMywgNiwgMiwgMSwgMiwgMzcsIDIyLCAwLCAyNiwgNSwgMiwgMSwgMiwgMzEsIDE1LCAwLCAzMjgsIDE4LCAxNiwgMCwgMiwgMTIsIDIsIDMzLCAxMjUsIDAsIDgwLCA5MjEsIDEwMywgMTEwLCAxOCwgMTk1LCAyNjM3LCA5NiwgMTYsIDEwNzEsIDE4LCA1LCA0MDI2LCA1ODIsIDg2MzQsIDU2OCwgOCwgMzAsIDE4LCA3OCwgMTgsIDI5LCAxOSwgNDcsIDE3LCAzLCAzMiwgMjAsIDYsIDE4LCA2ODksIDYzLCAxMjksIDc0LCA2LCAwLCA2NywgMTIsIDY1LCAxLCAyLCAwLCAyOSwgNjEzNSwgOSwgMTIzNywgNDMsIDgsIDg5MzYsIDMsIDIsIDYsIDIsIDEsIDIsIDI5MCwgMTYsIDAsIDMwLCAyLCAzLCAwLCAxNSwgMywgOSwgMzk1LCAyMzA5LCAxMDYsIDYsIDEyLCA0LCA4LCA4LCA5LCA1OTkxLCA4NCwgMiwgNzAsIDIsIDEsIDMsIDAsIDMsIDEsIDMsIDMsIDIsIDExLCAyLCAwLCAyLCA2LCAyLCA2NCwgMiwgMywgMywgNywgMiwgNiwgMiwgMjcsIDIsIDMsIDIsIDQsIDIsIDAsIDQsIDYsIDIsIDMzOSwgMywgMjQsIDIsIDI0LCAyLCAzMCwgMiwgMjQsIDIsIDMwLCAyLCAyNCwgMiwgMzAsIDIsIDI0LCAyLCAzMCwgMiwgMjQsIDIsIDcsIDE4NDUsIDMwLCA3LCA1LCAyNjIsIDYxLCAxNDcsIDQ0LCAxMSwgNiwgMTcsIDAsIDMyMiwgMjksIDE5LCA0MywgNDg1LCAyNywgNzU3LCA2LCAyLCAzLCAyLCAxLCAyLCAxNCwgMiwgMTk2LCA2MCwgNjcsIDgsIDAsIDEyMDUsIDMsIDIsIDI2LCAyLCAxLCAyLCAwLCAzLCAwLCAyLCA5LCAyLCAzLCAyLCAwLCAyLCAwLCA3LCAwLCA1LCAwLCAyLCAwLCAyLCAwLCAyLCAyLCAyLCAxLCAyLCAwLCAzLCAwLCAyLCAwLCAyLCAwLCAyLCAwLCAyLCAwLCAyLCAxLCAyLCAwLCAzLCAzLCAyLCA2LCAyLCAzLCAyLCAzLCAyLCAwLCAyLCA5LCAyLCAxNiwgNiwgMiwgMiwgNCwgMiwgMTYsIDQ0MjEsIDQyNzE5LCAzMywgNDE1MywgNywgMjIxLCAzLCA1NzYxLCAxNSwgNzQ3MiwgMzEwNCwgNTQxLCAxNTA3LCA0OTM4LCA2LCA0MTkxXTtcblxuICAvLyBUaGlzIGZpbGUgd2FzIGdlbmVyYXRlZC4gRG8gbm90IG1vZGlmeSBtYW51YWxseSFcbiAgdmFyIG5vbkFTQ0lJaWRlbnRpZmllckNoYXJzID0gXCJcXHUyMDBjXFx1MjAwZFxceGI3XFx1MDMwMC1cXHUwMzZmXFx1MDM4N1xcdTA0ODMtXFx1MDQ4N1xcdTA1OTEtXFx1MDViZFxcdTA1YmZcXHUwNWMxXFx1MDVjMlxcdTA1YzRcXHUwNWM1XFx1MDVjN1xcdTA2MTAtXFx1MDYxYVxcdTA2NGItXFx1MDY2OVxcdTA2NzBcXHUwNmQ2LVxcdTA2ZGNcXHUwNmRmLVxcdTA2ZTRcXHUwNmU3XFx1MDZlOFxcdTA2ZWEtXFx1MDZlZFxcdTA2ZjAtXFx1MDZmOVxcdTA3MTFcXHUwNzMwLVxcdTA3NGFcXHUwN2E2LVxcdTA3YjBcXHUwN2MwLVxcdTA3YzlcXHUwN2ViLVxcdTA3ZjNcXHUwN2ZkXFx1MDgxNi1cXHUwODE5XFx1MDgxYi1cXHUwODIzXFx1MDgyNS1cXHUwODI3XFx1MDgyOS1cXHUwODJkXFx1MDg1OS1cXHUwODViXFx1MDg5OC1cXHUwODlmXFx1MDhjYS1cXHUwOGUxXFx1MDhlMy1cXHUwOTAzXFx1MDkzYS1cXHUwOTNjXFx1MDkzZS1cXHUwOTRmXFx1MDk1MS1cXHUwOTU3XFx1MDk2MlxcdTA5NjNcXHUwOTY2LVxcdTA5NmZcXHUwOTgxLVxcdTA5ODNcXHUwOWJjXFx1MDliZS1cXHUwOWM0XFx1MDljN1xcdTA5YzhcXHUwOWNiLVxcdTA5Y2RcXHUwOWQ3XFx1MDllMlxcdTA5ZTNcXHUwOWU2LVxcdTA5ZWZcXHUwOWZlXFx1MGEwMS1cXHUwYTAzXFx1MGEzY1xcdTBhM2UtXFx1MGE0MlxcdTBhNDdcXHUwYTQ4XFx1MGE0Yi1cXHUwYTRkXFx1MGE1MVxcdTBhNjYtXFx1MGE3MVxcdTBhNzVcXHUwYTgxLVxcdTBhODNcXHUwYWJjXFx1MGFiZS1cXHUwYWM1XFx1MGFjNy1cXHUwYWM5XFx1MGFjYi1cXHUwYWNkXFx1MGFlMlxcdTBhZTNcXHUwYWU2LVxcdTBhZWZcXHUwYWZhLVxcdTBhZmZcXHUwYjAxLVxcdTBiMDNcXHUwYjNjXFx1MGIzZS1cXHUwYjQ0XFx1MGI0N1xcdTBiNDhcXHUwYjRiLVxcdTBiNGRcXHUwYjU1LVxcdTBiNTdcXHUwYjYyXFx1MGI2M1xcdTBiNjYtXFx1MGI2ZlxcdTBiODJcXHUwYmJlLVxcdTBiYzJcXHUwYmM2LVxcdTBiYzhcXHUwYmNhLVxcdTBiY2RcXHUwYmQ3XFx1MGJlNi1cXHUwYmVmXFx1MGMwMC1cXHUwYzA0XFx1MGMzY1xcdTBjM2UtXFx1MGM0NFxcdTBjNDYtXFx1MGM0OFxcdTBjNGEtXFx1MGM0ZFxcdTBjNTVcXHUwYzU2XFx1MGM2MlxcdTBjNjNcXHUwYzY2LVxcdTBjNmZcXHUwYzgxLVxcdTBjODNcXHUwY2JjXFx1MGNiZS1cXHUwY2M0XFx1MGNjNi1cXHUwY2M4XFx1MGNjYS1cXHUwY2NkXFx1MGNkNVxcdTBjZDZcXHUwY2UyXFx1MGNlM1xcdTBjZTYtXFx1MGNlZlxcdTBjZjNcXHUwZDAwLVxcdTBkMDNcXHUwZDNiXFx1MGQzY1xcdTBkM2UtXFx1MGQ0NFxcdTBkNDYtXFx1MGQ0OFxcdTBkNGEtXFx1MGQ0ZFxcdTBkNTdcXHUwZDYyXFx1MGQ2M1xcdTBkNjYtXFx1MGQ2ZlxcdTBkODEtXFx1MGQ4M1xcdTBkY2FcXHUwZGNmLVxcdTBkZDRcXHUwZGQ2XFx1MGRkOC1cXHUwZGRmXFx1MGRlNi1cXHUwZGVmXFx1MGRmMlxcdTBkZjNcXHUwZTMxXFx1MGUzNC1cXHUwZTNhXFx1MGU0Ny1cXHUwZTRlXFx1MGU1MC1cXHUwZTU5XFx1MGViMVxcdTBlYjQtXFx1MGViY1xcdTBlYzgtXFx1MGVjZVxcdTBlZDAtXFx1MGVkOVxcdTBmMThcXHUwZjE5XFx1MGYyMC1cXHUwZjI5XFx1MGYzNVxcdTBmMzdcXHUwZjM5XFx1MGYzZVxcdTBmM2ZcXHUwZjcxLVxcdTBmODRcXHUwZjg2XFx1MGY4N1xcdTBmOGQtXFx1MGY5N1xcdTBmOTktXFx1MGZiY1xcdTBmYzZcXHUxMDJiLVxcdTEwM2VcXHUxMDQwLVxcdTEwNDlcXHUxMDU2LVxcdTEwNTlcXHUxMDVlLVxcdTEwNjBcXHUxMDYyLVxcdTEwNjRcXHUxMDY3LVxcdTEwNmRcXHUxMDcxLVxcdTEwNzRcXHUxMDgyLVxcdTEwOGRcXHUxMDhmLVxcdTEwOWRcXHUxMzVkLVxcdTEzNWZcXHUxMzY5LVxcdTEzNzFcXHUxNzEyLVxcdTE3MTVcXHUxNzMyLVxcdTE3MzRcXHUxNzUyXFx1MTc1M1xcdTE3NzJcXHUxNzczXFx1MTdiNC1cXHUxN2QzXFx1MTdkZFxcdTE3ZTAtXFx1MTdlOVxcdTE4MGItXFx1MTgwZFxcdTE4MGYtXFx1MTgxOVxcdTE4YTlcXHUxOTIwLVxcdTE5MmJcXHUxOTMwLVxcdTE5M2JcXHUxOTQ2LVxcdTE5NGZcXHUxOWQwLVxcdTE5ZGFcXHUxYTE3LVxcdTFhMWJcXHUxYTU1LVxcdTFhNWVcXHUxYTYwLVxcdTFhN2NcXHUxYTdmLVxcdTFhODlcXHUxYTkwLVxcdTFhOTlcXHUxYWIwLVxcdTFhYmRcXHUxYWJmLVxcdTFhY2VcXHUxYjAwLVxcdTFiMDRcXHUxYjM0LVxcdTFiNDRcXHUxYjUwLVxcdTFiNTlcXHUxYjZiLVxcdTFiNzNcXHUxYjgwLVxcdTFiODJcXHUxYmExLVxcdTFiYWRcXHUxYmIwLVxcdTFiYjlcXHUxYmU2LVxcdTFiZjNcXHUxYzI0LVxcdTFjMzdcXHUxYzQwLVxcdTFjNDlcXHUxYzUwLVxcdTFjNTlcXHUxY2QwLVxcdTFjZDJcXHUxY2Q0LVxcdTFjZThcXHUxY2VkXFx1MWNmNFxcdTFjZjctXFx1MWNmOVxcdTFkYzAtXFx1MWRmZlxcdTIwM2ZcXHUyMDQwXFx1MjA1NFxcdTIwZDAtXFx1MjBkY1xcdTIwZTFcXHUyMGU1LVxcdTIwZjBcXHUyY2VmLVxcdTJjZjFcXHUyZDdmXFx1MmRlMC1cXHUyZGZmXFx1MzAyYS1cXHUzMDJmXFx1MzA5OVxcdTMwOWFcXHVhNjIwLVxcdWE2MjlcXHVhNjZmXFx1YTY3NC1cXHVhNjdkXFx1YTY5ZVxcdWE2OWZcXHVhNmYwXFx1YTZmMVxcdWE4MDJcXHVhODA2XFx1YTgwYlxcdWE4MjMtXFx1YTgyN1xcdWE4MmNcXHVhODgwXFx1YTg4MVxcdWE4YjQtXFx1YThjNVxcdWE4ZDAtXFx1YThkOVxcdWE4ZTAtXFx1YThmMVxcdWE4ZmYtXFx1YTkwOVxcdWE5MjYtXFx1YTkyZFxcdWE5NDctXFx1YTk1M1xcdWE5ODAtXFx1YTk4M1xcdWE5YjMtXFx1YTljMFxcdWE5ZDAtXFx1YTlkOVxcdWE5ZTVcXHVhOWYwLVxcdWE5ZjlcXHVhYTI5LVxcdWFhMzZcXHVhYTQzXFx1YWE0Y1xcdWFhNGRcXHVhYTUwLVxcdWFhNTlcXHVhYTdiLVxcdWFhN2RcXHVhYWIwXFx1YWFiMi1cXHVhYWI0XFx1YWFiN1xcdWFhYjhcXHVhYWJlXFx1YWFiZlxcdWFhYzFcXHVhYWViLVxcdWFhZWZcXHVhYWY1XFx1YWFmNlxcdWFiZTMtXFx1YWJlYVxcdWFiZWNcXHVhYmVkXFx1YWJmMC1cXHVhYmY5XFx1ZmIxZVxcdWZlMDAtXFx1ZmUwZlxcdWZlMjAtXFx1ZmUyZlxcdWZlMzNcXHVmZTM0XFx1ZmU0ZC1cXHVmZTRmXFx1ZmYxMC1cXHVmZjE5XFx1ZmYzZlwiO1xuXG4gIC8vIFRoaXMgZmlsZSB3YXMgZ2VuZXJhdGVkLiBEbyBub3QgbW9kaWZ5IG1hbnVhbGx5IVxuICB2YXIgbm9uQVNDSUlpZGVudGlmaWVyU3RhcnRDaGFycyA9IFwiXFx4YWFcXHhiNVxceGJhXFx4YzAtXFx4ZDZcXHhkOC1cXHhmNlxceGY4LVxcdTAyYzFcXHUwMmM2LVxcdTAyZDFcXHUwMmUwLVxcdTAyZTRcXHUwMmVjXFx1MDJlZVxcdTAzNzAtXFx1MDM3NFxcdTAzNzZcXHUwMzc3XFx1MDM3YS1cXHUwMzdkXFx1MDM3ZlxcdTAzODZcXHUwMzg4LVxcdTAzOGFcXHUwMzhjXFx1MDM4ZS1cXHUwM2ExXFx1MDNhMy1cXHUwM2Y1XFx1MDNmNy1cXHUwNDgxXFx1MDQ4YS1cXHUwNTJmXFx1MDUzMS1cXHUwNTU2XFx1MDU1OVxcdTA1NjAtXFx1MDU4OFxcdTA1ZDAtXFx1MDVlYVxcdTA1ZWYtXFx1MDVmMlxcdTA2MjAtXFx1MDY0YVxcdTA2NmVcXHUwNjZmXFx1MDY3MS1cXHUwNmQzXFx1MDZkNVxcdTA2ZTVcXHUwNmU2XFx1MDZlZVxcdTA2ZWZcXHUwNmZhLVxcdTA2ZmNcXHUwNmZmXFx1MDcxMFxcdTA3MTItXFx1MDcyZlxcdTA3NGQtXFx1MDdhNVxcdTA3YjFcXHUwN2NhLVxcdTA3ZWFcXHUwN2Y0XFx1MDdmNVxcdTA3ZmFcXHUwODAwLVxcdTA4MTVcXHUwODFhXFx1MDgyNFxcdTA4MjhcXHUwODQwLVxcdTA4NThcXHUwODYwLVxcdTA4NmFcXHUwODcwLVxcdTA4ODdcXHUwODg5LVxcdTA4OGVcXHUwOGEwLVxcdTA4YzlcXHUwOTA0LVxcdTA5MzlcXHUwOTNkXFx1MDk1MFxcdTA5NTgtXFx1MDk2MVxcdTA5NzEtXFx1MDk4MFxcdTA5ODUtXFx1MDk4Y1xcdTA5OGZcXHUwOTkwXFx1MDk5My1cXHUwOWE4XFx1MDlhYS1cXHUwOWIwXFx1MDliMlxcdTA5YjYtXFx1MDliOVxcdTA5YmRcXHUwOWNlXFx1MDlkY1xcdTA5ZGRcXHUwOWRmLVxcdTA5ZTFcXHUwOWYwXFx1MDlmMVxcdTA5ZmNcXHUwYTA1LVxcdTBhMGFcXHUwYTBmXFx1MGExMFxcdTBhMTMtXFx1MGEyOFxcdTBhMmEtXFx1MGEzMFxcdTBhMzJcXHUwYTMzXFx1MGEzNVxcdTBhMzZcXHUwYTM4XFx1MGEzOVxcdTBhNTktXFx1MGE1Y1xcdTBhNWVcXHUwYTcyLVxcdTBhNzRcXHUwYTg1LVxcdTBhOGRcXHUwYThmLVxcdTBhOTFcXHUwYTkzLVxcdTBhYThcXHUwYWFhLVxcdTBhYjBcXHUwYWIyXFx1MGFiM1xcdTBhYjUtXFx1MGFiOVxcdTBhYmRcXHUwYWQwXFx1MGFlMFxcdTBhZTFcXHUwYWY5XFx1MGIwNS1cXHUwYjBjXFx1MGIwZlxcdTBiMTBcXHUwYjEzLVxcdTBiMjhcXHUwYjJhLVxcdTBiMzBcXHUwYjMyXFx1MGIzM1xcdTBiMzUtXFx1MGIzOVxcdTBiM2RcXHUwYjVjXFx1MGI1ZFxcdTBiNWYtXFx1MGI2MVxcdTBiNzFcXHUwYjgzXFx1MGI4NS1cXHUwYjhhXFx1MGI4ZS1cXHUwYjkwXFx1MGI5Mi1cXHUwYjk1XFx1MGI5OVxcdTBiOWFcXHUwYjljXFx1MGI5ZVxcdTBiOWZcXHUwYmEzXFx1MGJhNFxcdTBiYTgtXFx1MGJhYVxcdTBiYWUtXFx1MGJiOVxcdTBiZDBcXHUwYzA1LVxcdTBjMGNcXHUwYzBlLVxcdTBjMTBcXHUwYzEyLVxcdTBjMjhcXHUwYzJhLVxcdTBjMzlcXHUwYzNkXFx1MGM1OC1cXHUwYzVhXFx1MGM1ZFxcdTBjNjBcXHUwYzYxXFx1MGM4MFxcdTBjODUtXFx1MGM4Y1xcdTBjOGUtXFx1MGM5MFxcdTBjOTItXFx1MGNhOFxcdTBjYWEtXFx1MGNiM1xcdTBjYjUtXFx1MGNiOVxcdTBjYmRcXHUwY2RkXFx1MGNkZVxcdTBjZTBcXHUwY2UxXFx1MGNmMVxcdTBjZjJcXHUwZDA0LVxcdTBkMGNcXHUwZDBlLVxcdTBkMTBcXHUwZDEyLVxcdTBkM2FcXHUwZDNkXFx1MGQ0ZVxcdTBkNTQtXFx1MGQ1NlxcdTBkNWYtXFx1MGQ2MVxcdTBkN2EtXFx1MGQ3ZlxcdTBkODUtXFx1MGQ5NlxcdTBkOWEtXFx1MGRiMVxcdTBkYjMtXFx1MGRiYlxcdTBkYmRcXHUwZGMwLVxcdTBkYzZcXHUwZTAxLVxcdTBlMzBcXHUwZTMyXFx1MGUzM1xcdTBlNDAtXFx1MGU0NlxcdTBlODFcXHUwZTgyXFx1MGU4NFxcdTBlODYtXFx1MGU4YVxcdTBlOGMtXFx1MGVhM1xcdTBlYTVcXHUwZWE3LVxcdTBlYjBcXHUwZWIyXFx1MGViM1xcdTBlYmRcXHUwZWMwLVxcdTBlYzRcXHUwZWM2XFx1MGVkYy1cXHUwZWRmXFx1MGYwMFxcdTBmNDAtXFx1MGY0N1xcdTBmNDktXFx1MGY2Y1xcdTBmODgtXFx1MGY4Y1xcdTEwMDAtXFx1MTAyYVxcdTEwM2ZcXHUxMDUwLVxcdTEwNTVcXHUxMDVhLVxcdTEwNWRcXHUxMDYxXFx1MTA2NVxcdTEwNjZcXHUxMDZlLVxcdTEwNzBcXHUxMDc1LVxcdTEwODFcXHUxMDhlXFx1MTBhMC1cXHUxMGM1XFx1MTBjN1xcdTEwY2RcXHUxMGQwLVxcdTEwZmFcXHUxMGZjLVxcdTEyNDhcXHUxMjRhLVxcdTEyNGRcXHUxMjUwLVxcdTEyNTZcXHUxMjU4XFx1MTI1YS1cXHUxMjVkXFx1MTI2MC1cXHUxMjg4XFx1MTI4YS1cXHUxMjhkXFx1MTI5MC1cXHUxMmIwXFx1MTJiMi1cXHUxMmI1XFx1MTJiOC1cXHUxMmJlXFx1MTJjMFxcdTEyYzItXFx1MTJjNVxcdTEyYzgtXFx1MTJkNlxcdTEyZDgtXFx1MTMxMFxcdTEzMTItXFx1MTMxNVxcdTEzMTgtXFx1MTM1YVxcdTEzODAtXFx1MTM4ZlxcdTEzYTAtXFx1MTNmNVxcdTEzZjgtXFx1MTNmZFxcdTE0MDEtXFx1MTY2Y1xcdTE2NmYtXFx1MTY3ZlxcdTE2ODEtXFx1MTY5YVxcdTE2YTAtXFx1MTZlYVxcdTE2ZWUtXFx1MTZmOFxcdTE3MDAtXFx1MTcxMVxcdTE3MWYtXFx1MTczMVxcdTE3NDAtXFx1MTc1MVxcdTE3NjAtXFx1MTc2Y1xcdTE3NmUtXFx1MTc3MFxcdTE3ODAtXFx1MTdiM1xcdTE3ZDdcXHUxN2RjXFx1MTgyMC1cXHUxODc4XFx1MTg4MC1cXHUxOGE4XFx1MThhYVxcdTE4YjAtXFx1MThmNVxcdTE5MDAtXFx1MTkxZVxcdTE5NTAtXFx1MTk2ZFxcdTE5NzAtXFx1MTk3NFxcdTE5ODAtXFx1MTlhYlxcdTE5YjAtXFx1MTljOVxcdTFhMDAtXFx1MWExNlxcdTFhMjAtXFx1MWE1NFxcdTFhYTdcXHUxYjA1LVxcdTFiMzNcXHUxYjQ1LVxcdTFiNGNcXHUxYjgzLVxcdTFiYTBcXHUxYmFlXFx1MWJhZlxcdTFiYmEtXFx1MWJlNVxcdTFjMDAtXFx1MWMyM1xcdTFjNGQtXFx1MWM0ZlxcdTFjNWEtXFx1MWM3ZFxcdTFjODAtXFx1MWM4OFxcdTFjOTAtXFx1MWNiYVxcdTFjYmQtXFx1MWNiZlxcdTFjZTktXFx1MWNlY1xcdTFjZWUtXFx1MWNmM1xcdTFjZjVcXHUxY2Y2XFx1MWNmYVxcdTFkMDAtXFx1MWRiZlxcdTFlMDAtXFx1MWYxNVxcdTFmMTgtXFx1MWYxZFxcdTFmMjAtXFx1MWY0NVxcdTFmNDgtXFx1MWY0ZFxcdTFmNTAtXFx1MWY1N1xcdTFmNTlcXHUxZjViXFx1MWY1ZFxcdTFmNWYtXFx1MWY3ZFxcdTFmODAtXFx1MWZiNFxcdTFmYjYtXFx1MWZiY1xcdTFmYmVcXHUxZmMyLVxcdTFmYzRcXHUxZmM2LVxcdTFmY2NcXHUxZmQwLVxcdTFmZDNcXHUxZmQ2LVxcdTFmZGJcXHUxZmUwLVxcdTFmZWNcXHUxZmYyLVxcdTFmZjRcXHUxZmY2LVxcdTFmZmNcXHUyMDcxXFx1MjA3ZlxcdTIwOTAtXFx1MjA5Y1xcdTIxMDJcXHUyMTA3XFx1MjEwYS1cXHUyMTEzXFx1MjExNVxcdTIxMTgtXFx1MjExZFxcdTIxMjRcXHUyMTI2XFx1MjEyOFxcdTIxMmEtXFx1MjEzOVxcdTIxM2MtXFx1MjEzZlxcdTIxNDUtXFx1MjE0OVxcdTIxNGVcXHUyMTYwLVxcdTIxODhcXHUyYzAwLVxcdTJjZTRcXHUyY2ViLVxcdTJjZWVcXHUyY2YyXFx1MmNmM1xcdTJkMDAtXFx1MmQyNVxcdTJkMjdcXHUyZDJkXFx1MmQzMC1cXHUyZDY3XFx1MmQ2ZlxcdTJkODAtXFx1MmQ5NlxcdTJkYTAtXFx1MmRhNlxcdTJkYTgtXFx1MmRhZVxcdTJkYjAtXFx1MmRiNlxcdTJkYjgtXFx1MmRiZVxcdTJkYzAtXFx1MmRjNlxcdTJkYzgtXFx1MmRjZVxcdTJkZDAtXFx1MmRkNlxcdTJkZDgtXFx1MmRkZVxcdTMwMDUtXFx1MzAwN1xcdTMwMjEtXFx1MzAyOVxcdTMwMzEtXFx1MzAzNVxcdTMwMzgtXFx1MzAzY1xcdTMwNDEtXFx1MzA5NlxcdTMwOWItXFx1MzA5ZlxcdTMwYTEtXFx1MzBmYVxcdTMwZmMtXFx1MzBmZlxcdTMxMDUtXFx1MzEyZlxcdTMxMzEtXFx1MzE4ZVxcdTMxYTAtXFx1MzFiZlxcdTMxZjAtXFx1MzFmZlxcdTM0MDAtXFx1NGRiZlxcdTRlMDAtXFx1YTQ4Y1xcdWE0ZDAtXFx1YTRmZFxcdWE1MDAtXFx1YTYwY1xcdWE2MTAtXFx1YTYxZlxcdWE2MmFcXHVhNjJiXFx1YTY0MC1cXHVhNjZlXFx1YTY3Zi1cXHVhNjlkXFx1YTZhMC1cXHVhNmVmXFx1YTcxNy1cXHVhNzFmXFx1YTcyMi1cXHVhNzg4XFx1YTc4Yi1cXHVhN2NhXFx1YTdkMFxcdWE3ZDFcXHVhN2QzXFx1YTdkNS1cXHVhN2Q5XFx1YTdmMi1cXHVhODAxXFx1YTgwMy1cXHVhODA1XFx1YTgwNy1cXHVhODBhXFx1YTgwYy1cXHVhODIyXFx1YTg0MC1cXHVhODczXFx1YTg4Mi1cXHVhOGIzXFx1YThmMi1cXHVhOGY3XFx1YThmYlxcdWE4ZmRcXHVhOGZlXFx1YTkwYS1cXHVhOTI1XFx1YTkzMC1cXHVhOTQ2XFx1YTk2MC1cXHVhOTdjXFx1YTk4NC1cXHVhOWIyXFx1YTljZlxcdWE5ZTAtXFx1YTllNFxcdWE5ZTYtXFx1YTllZlxcdWE5ZmEtXFx1YTlmZVxcdWFhMDAtXFx1YWEyOFxcdWFhNDAtXFx1YWE0MlxcdWFhNDQtXFx1YWE0YlxcdWFhNjAtXFx1YWE3NlxcdWFhN2FcXHVhYTdlLVxcdWFhYWZcXHVhYWIxXFx1YWFiNVxcdWFhYjZcXHVhYWI5LVxcdWFhYmRcXHVhYWMwXFx1YWFjMlxcdWFhZGItXFx1YWFkZFxcdWFhZTAtXFx1YWFlYVxcdWFhZjItXFx1YWFmNFxcdWFiMDEtXFx1YWIwNlxcdWFiMDktXFx1YWIwZVxcdWFiMTEtXFx1YWIxNlxcdWFiMjAtXFx1YWIyNlxcdWFiMjgtXFx1YWIyZVxcdWFiMzAtXFx1YWI1YVxcdWFiNWMtXFx1YWI2OVxcdWFiNzAtXFx1YWJlMlxcdWFjMDAtXFx1ZDdhM1xcdWQ3YjAtXFx1ZDdjNlxcdWQ3Y2ItXFx1ZDdmYlxcdWY5MDAtXFx1ZmE2ZFxcdWZhNzAtXFx1ZmFkOVxcdWZiMDAtXFx1ZmIwNlxcdWZiMTMtXFx1ZmIxN1xcdWZiMWRcXHVmYjFmLVxcdWZiMjhcXHVmYjJhLVxcdWZiMzZcXHVmYjM4LVxcdWZiM2NcXHVmYjNlXFx1ZmI0MFxcdWZiNDFcXHVmYjQzXFx1ZmI0NFxcdWZiNDYtXFx1ZmJiMVxcdWZiZDMtXFx1ZmQzZFxcdWZkNTAtXFx1ZmQ4ZlxcdWZkOTItXFx1ZmRjN1xcdWZkZjAtXFx1ZmRmYlxcdWZlNzAtXFx1ZmU3NFxcdWZlNzYtXFx1ZmVmY1xcdWZmMjEtXFx1ZmYzYVxcdWZmNDEtXFx1ZmY1YVxcdWZmNjYtXFx1ZmZiZVxcdWZmYzItXFx1ZmZjN1xcdWZmY2EtXFx1ZmZjZlxcdWZmZDItXFx1ZmZkN1xcdWZmZGEtXFx1ZmZkY1wiO1xuXG4gIC8vIFRoZXNlIGFyZSBhIHJ1bi1sZW5ndGggYW5kIG9mZnNldCBlbmNvZGVkIHJlcHJlc2VudGF0aW9uIG9mIHRoZVxuICAvLyA+MHhmZmZmIGNvZGUgcG9pbnRzIHRoYXQgYXJlIGEgdmFsaWQgcGFydCBvZiBpZGVudGlmaWVycy4gVGhlXG4gIC8vIG9mZnNldCBzdGFydHMgYXQgMHgxMDAwMCwgYW5kIGVhY2ggcGFpciBvZiBudW1iZXJzIHJlcHJlc2VudHMgYW5cbiAgLy8gb2Zmc2V0IHRvIHRoZSBuZXh0IHJhbmdlLCBhbmQgdGhlbiBhIHNpemUgb2YgdGhlIHJhbmdlLlxuXG4gIC8vIFJlc2VydmVkIHdvcmQgbGlzdHMgZm9yIHZhcmlvdXMgZGlhbGVjdHMgb2YgdGhlIGxhbmd1YWdlXG5cbiAgdmFyIHJlc2VydmVkV29yZHMgPSB7XG4gICAgMzogXCJhYnN0cmFjdCBib29sZWFuIGJ5dGUgY2hhciBjbGFzcyBkb3VibGUgZW51bSBleHBvcnQgZXh0ZW5kcyBmaW5hbCBmbG9hdCBnb3RvIGltcGxlbWVudHMgaW1wb3J0IGludCBpbnRlcmZhY2UgbG9uZyBuYXRpdmUgcGFja2FnZSBwcml2YXRlIHByb3RlY3RlZCBwdWJsaWMgc2hvcnQgc3RhdGljIHN1cGVyIHN5bmNocm9uaXplZCB0aHJvd3MgdHJhbnNpZW50IHZvbGF0aWxlXCIsXG4gICAgNTogXCJjbGFzcyBlbnVtIGV4dGVuZHMgc3VwZXIgY29uc3QgZXhwb3J0IGltcG9ydFwiLFxuICAgIDY6IFwiZW51bVwiLFxuICAgIHN0cmljdDogXCJpbXBsZW1lbnRzIGludGVyZmFjZSBsZXQgcGFja2FnZSBwcml2YXRlIHByb3RlY3RlZCBwdWJsaWMgc3RhdGljIHlpZWxkXCIsXG4gICAgc3RyaWN0QmluZDogXCJldmFsIGFyZ3VtZW50c1wiXG4gIH07XG5cbiAgLy8gQW5kIHRoZSBrZXl3b3Jkc1xuXG4gIHZhciBlY21hNUFuZExlc3NLZXl3b3JkcyA9IFwiYnJlYWsgY2FzZSBjYXRjaCBjb250aW51ZSBkZWJ1Z2dlciBkZWZhdWx0IGRvIGVsc2UgZmluYWxseSBmb3IgZnVuY3Rpb24gaWYgcmV0dXJuIHN3aXRjaCB0aHJvdyB0cnkgdmFyIHdoaWxlIHdpdGggbnVsbCB0cnVlIGZhbHNlIGluc3RhbmNlb2YgdHlwZW9mIHZvaWQgZGVsZXRlIG5ldyBpbiB0aGlzXCI7XG5cbiAgdmFyIGtleXdvcmRzJDEgPSB7XG4gICAgNTogZWNtYTVBbmRMZXNzS2V5d29yZHMsXG4gICAgXCI1bW9kdWxlXCI6IGVjbWE1QW5kTGVzc0tleXdvcmRzICsgXCIgZXhwb3J0IGltcG9ydFwiLFxuICAgIDY6IGVjbWE1QW5kTGVzc0tleXdvcmRzICsgXCIgY29uc3QgY2xhc3MgZXh0ZW5kcyBleHBvcnQgaW1wb3J0IHN1cGVyXCJcbiAgfTtcblxuICB2YXIga2V5d29yZFJlbGF0aW9uYWxPcGVyYXRvciA9IC9eaW4oc3RhbmNlb2YpPyQvO1xuXG4gIC8vICMjIENoYXJhY3RlciBjYXRlZ29yaWVzXG5cbiAgdmFyIG5vbkFTQ0lJaWRlbnRpZmllclN0YXJ0ID0gbmV3IFJlZ0V4cChcIltcIiArIG5vbkFTQ0lJaWRlbnRpZmllclN0YXJ0Q2hhcnMgKyBcIl1cIik7XG4gIHZhciBub25BU0NJSWlkZW50aWZpZXIgPSBuZXcgUmVnRXhwKFwiW1wiICsgbm9uQVNDSUlpZGVudGlmaWVyU3RhcnRDaGFycyArIG5vbkFTQ0lJaWRlbnRpZmllckNoYXJzICsgXCJdXCIpO1xuXG4gIC8vIFRoaXMgaGFzIGEgY29tcGxleGl0eSBsaW5lYXIgdG8gdGhlIHZhbHVlIG9mIHRoZSBjb2RlLiBUaGVcbiAgLy8gYXNzdW1wdGlvbiBpcyB0aGF0IGxvb2tpbmcgdXAgYXN0cmFsIGlkZW50aWZpZXIgY2hhcmFjdGVycyBpc1xuICAvLyByYXJlLlxuICBmdW5jdGlvbiBpc0luQXN0cmFsU2V0KGNvZGUsIHNldCkge1xuICAgIHZhciBwb3MgPSAweDEwMDAwO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2V0Lmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICBwb3MgKz0gc2V0W2ldO1xuICAgICAgaWYgKHBvcyA+IGNvZGUpIHsgcmV0dXJuIGZhbHNlIH1cbiAgICAgIHBvcyArPSBzZXRbaSArIDFdO1xuICAgICAgaWYgKHBvcyA+PSBjb2RlKSB7IHJldHVybiB0cnVlIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICAvLyBUZXN0IHdoZXRoZXIgYSBnaXZlbiBjaGFyYWN0ZXIgY29kZSBzdGFydHMgYW4gaWRlbnRpZmllci5cblxuICBmdW5jdGlvbiBpc0lkZW50aWZpZXJTdGFydChjb2RlLCBhc3RyYWwpIHtcbiAgICBpZiAoY29kZSA8IDY1KSB7IHJldHVybiBjb2RlID09PSAzNiB9XG4gICAgaWYgKGNvZGUgPCA5MSkgeyByZXR1cm4gdHJ1ZSB9XG4gICAgaWYgKGNvZGUgPCA5NykgeyByZXR1cm4gY29kZSA9PT0gOTUgfVxuICAgIGlmIChjb2RlIDwgMTIzKSB7IHJldHVybiB0cnVlIH1cbiAgICBpZiAoY29kZSA8PSAweGZmZmYpIHsgcmV0dXJuIGNvZGUgPj0gMHhhYSAmJiBub25BU0NJSWlkZW50aWZpZXJTdGFydC50ZXN0KFN0cmluZy5mcm9tQ2hhckNvZGUoY29kZSkpIH1cbiAgICBpZiAoYXN0cmFsID09PSBmYWxzZSkgeyByZXR1cm4gZmFsc2UgfVxuICAgIHJldHVybiBpc0luQXN0cmFsU2V0KGNvZGUsIGFzdHJhbElkZW50aWZpZXJTdGFydENvZGVzKVxuICB9XG5cbiAgLy8gVGVzdCB3aGV0aGVyIGEgZ2l2ZW4gY2hhcmFjdGVyIGlzIHBhcnQgb2YgYW4gaWRlbnRpZmllci5cblxuICBmdW5jdGlvbiBpc0lkZW50aWZpZXJDaGFyKGNvZGUsIGFzdHJhbCkge1xuICAgIGlmIChjb2RlIDwgNDgpIHsgcmV0dXJuIGNvZGUgPT09IDM2IH1cbiAgICBpZiAoY29kZSA8IDU4KSB7IHJldHVybiB0cnVlIH1cbiAgICBpZiAoY29kZSA8IDY1KSB7IHJldHVybiBmYWxzZSB9XG4gICAgaWYgKGNvZGUgPCA5MSkgeyByZXR1cm4gdHJ1ZSB9XG4gICAgaWYgKGNvZGUgPCA5NykgeyByZXR1cm4gY29kZSA9PT0gOTUgfVxuICAgIGlmIChjb2RlIDwgMTIzKSB7IHJldHVybiB0cnVlIH1cbiAgICBpZiAoY29kZSA8PSAweGZmZmYpIHsgcmV0dXJuIGNvZGUgPj0gMHhhYSAmJiBub25BU0NJSWlkZW50aWZpZXIudGVzdChTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpKSB9XG4gICAgaWYgKGFzdHJhbCA9PT0gZmFsc2UpIHsgcmV0dXJuIGZhbHNlIH1cbiAgICByZXR1cm4gaXNJbkFzdHJhbFNldChjb2RlLCBhc3RyYWxJZGVudGlmaWVyU3RhcnRDb2RlcykgfHwgaXNJbkFzdHJhbFNldChjb2RlLCBhc3RyYWxJZGVudGlmaWVyQ29kZXMpXG4gIH1cblxuICAvLyAjIyBUb2tlbiB0eXBlc1xuXG4gIC8vIFRoZSBhc3NpZ25tZW50IG9mIGZpbmUtZ3JhaW5lZCwgaW5mb3JtYXRpb24tY2FycnlpbmcgdHlwZSBvYmplY3RzXG4gIC8vIGFsbG93cyB0aGUgdG9rZW5pemVyIHRvIHN0b3JlIHRoZSBpbmZvcm1hdGlvbiBpdCBoYXMgYWJvdXQgYVxuICAvLyB0b2tlbiBpbiBhIHdheSB0aGF0IGlzIHZlcnkgY2hlYXAgZm9yIHRoZSBwYXJzZXIgdG8gbG9vayB1cC5cblxuICAvLyBBbGwgdG9rZW4gdHlwZSB2YXJpYWJsZXMgc3RhcnQgd2l0aCBhbiB1bmRlcnNjb3JlLCB0byBtYWtlIHRoZW1cbiAgLy8gZWFzeSB0byByZWNvZ25pemUuXG5cbiAgLy8gVGhlIGBiZWZvcmVFeHByYCBwcm9wZXJ0eSBpcyB1c2VkIHRvIGRpc2FtYmlndWF0ZSBiZXR3ZWVuIHJlZ3VsYXJcbiAgLy8gZXhwcmVzc2lvbnMgYW5kIGRpdmlzaW9ucy4gSXQgaXMgc2V0IG9uIGFsbCB0b2tlbiB0eXBlcyB0aGF0IGNhblxuICAvLyBiZSBmb2xsb3dlZCBieSBhbiBleHByZXNzaW9uICh0aHVzLCBhIHNsYXNoIGFmdGVyIHRoZW0gd291bGQgYmUgYVxuICAvLyByZWd1bGFyIGV4cHJlc3Npb24pLlxuICAvL1xuICAvLyBUaGUgYHN0YXJ0c0V4cHJgIHByb3BlcnR5IGlzIHVzZWQgdG8gY2hlY2sgaWYgdGhlIHRva2VuIGVuZHMgYVxuICAvLyBgeWllbGRgIGV4cHJlc3Npb24uIEl0IGlzIHNldCBvbiBhbGwgdG9rZW4gdHlwZXMgdGhhdCBlaXRoZXIgY2FuXG4gIC8vIGRpcmVjdGx5IHN0YXJ0IGFuIGV4cHJlc3Npb24gKGxpa2UgYSBxdW90YXRpb24gbWFyaykgb3IgY2FuXG4gIC8vIGNvbnRpbnVlIGFuIGV4cHJlc3Npb24gKGxpa2UgdGhlIGJvZHkgb2YgYSBzdHJpbmcpLlxuICAvL1xuICAvLyBgaXNMb29wYCBtYXJrcyBhIGtleXdvcmQgYXMgc3RhcnRpbmcgYSBsb29wLCB3aGljaCBpcyBpbXBvcnRhbnRcbiAgLy8gdG8ga25vdyB3aGVuIHBhcnNpbmcgYSBsYWJlbCwgaW4gb3JkZXIgdG8gYWxsb3cgb3IgZGlzYWxsb3dcbiAgLy8gY29udGludWUganVtcHMgdG8gdGhhdCBsYWJlbC5cblxuICB2YXIgVG9rZW5UeXBlID0gZnVuY3Rpb24gVG9rZW5UeXBlKGxhYmVsLCBjb25mKSB7XG4gICAgaWYgKCBjb25mID09PSB2b2lkIDAgKSBjb25mID0ge307XG5cbiAgICB0aGlzLmxhYmVsID0gbGFiZWw7XG4gICAgdGhpcy5rZXl3b3JkID0gY29uZi5rZXl3b3JkO1xuICAgIHRoaXMuYmVmb3JlRXhwciA9ICEhY29uZi5iZWZvcmVFeHByO1xuICAgIHRoaXMuc3RhcnRzRXhwciA9ICEhY29uZi5zdGFydHNFeHByO1xuICAgIHRoaXMuaXNMb29wID0gISFjb25mLmlzTG9vcDtcbiAgICB0aGlzLmlzQXNzaWduID0gISFjb25mLmlzQXNzaWduO1xuICAgIHRoaXMucHJlZml4ID0gISFjb25mLnByZWZpeDtcbiAgICB0aGlzLnBvc3RmaXggPSAhIWNvbmYucG9zdGZpeDtcbiAgICB0aGlzLmJpbm9wID0gY29uZi5iaW5vcCB8fCBudWxsO1xuICAgIHRoaXMudXBkYXRlQ29udGV4dCA9IG51bGw7XG4gIH07XG5cbiAgZnVuY3Rpb24gYmlub3AobmFtZSwgcHJlYykge1xuICAgIHJldHVybiBuZXcgVG9rZW5UeXBlKG5hbWUsIHtiZWZvcmVFeHByOiB0cnVlLCBiaW5vcDogcHJlY30pXG4gIH1cbiAgdmFyIGJlZm9yZUV4cHIgPSB7YmVmb3JlRXhwcjogdHJ1ZX0sIHN0YXJ0c0V4cHIgPSB7c3RhcnRzRXhwcjogdHJ1ZX07XG5cbiAgLy8gTWFwIGtleXdvcmQgbmFtZXMgdG8gdG9rZW4gdHlwZXMuXG5cbiAgdmFyIGtleXdvcmRzID0ge307XG5cbiAgLy8gU3VjY2luY3QgZGVmaW5pdGlvbnMgb2Yga2V5d29yZCB0b2tlbiB0eXBlc1xuICBmdW5jdGlvbiBrdyhuYW1lLCBvcHRpb25zKSB7XG4gICAgaWYgKCBvcHRpb25zID09PSB2b2lkIDAgKSBvcHRpb25zID0ge307XG5cbiAgICBvcHRpb25zLmtleXdvcmQgPSBuYW1lO1xuICAgIHJldHVybiBrZXl3b3Jkc1tuYW1lXSA9IG5ldyBUb2tlblR5cGUobmFtZSwgb3B0aW9ucylcbiAgfVxuXG4gIHZhciB0eXBlcyQxID0ge1xuICAgIG51bTogbmV3IFRva2VuVHlwZShcIm51bVwiLCBzdGFydHNFeHByKSxcbiAgICByZWdleHA6IG5ldyBUb2tlblR5cGUoXCJyZWdleHBcIiwgc3RhcnRzRXhwciksXG4gICAgc3RyaW5nOiBuZXcgVG9rZW5UeXBlKFwic3RyaW5nXCIsIHN0YXJ0c0V4cHIpLFxuICAgIG5hbWU6IG5ldyBUb2tlblR5cGUoXCJuYW1lXCIsIHN0YXJ0c0V4cHIpLFxuICAgIHByaXZhdGVJZDogbmV3IFRva2VuVHlwZShcInByaXZhdGVJZFwiLCBzdGFydHNFeHByKSxcbiAgICBlb2Y6IG5ldyBUb2tlblR5cGUoXCJlb2ZcIiksXG5cbiAgICAvLyBQdW5jdHVhdGlvbiB0b2tlbiB0eXBlcy5cbiAgICBicmFja2V0TDogbmV3IFRva2VuVHlwZShcIltcIiwge2JlZm9yZUV4cHI6IHRydWUsIHN0YXJ0c0V4cHI6IHRydWV9KSxcbiAgICBicmFja2V0UjogbmV3IFRva2VuVHlwZShcIl1cIiksXG4gICAgYnJhY2VMOiBuZXcgVG9rZW5UeXBlKFwie1wiLCB7YmVmb3JlRXhwcjogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pLFxuICAgIGJyYWNlUjogbmV3IFRva2VuVHlwZShcIn1cIiksXG4gICAgcGFyZW5MOiBuZXcgVG9rZW5UeXBlKFwiKFwiLCB7YmVmb3JlRXhwcjogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pLFxuICAgIHBhcmVuUjogbmV3IFRva2VuVHlwZShcIilcIiksXG4gICAgY29tbWE6IG5ldyBUb2tlblR5cGUoXCIsXCIsIGJlZm9yZUV4cHIpLFxuICAgIHNlbWk6IG5ldyBUb2tlblR5cGUoXCI7XCIsIGJlZm9yZUV4cHIpLFxuICAgIGNvbG9uOiBuZXcgVG9rZW5UeXBlKFwiOlwiLCBiZWZvcmVFeHByKSxcbiAgICBkb3Q6IG5ldyBUb2tlblR5cGUoXCIuXCIpLFxuICAgIHF1ZXN0aW9uOiBuZXcgVG9rZW5UeXBlKFwiP1wiLCBiZWZvcmVFeHByKSxcbiAgICBxdWVzdGlvbkRvdDogbmV3IFRva2VuVHlwZShcIj8uXCIpLFxuICAgIGFycm93OiBuZXcgVG9rZW5UeXBlKFwiPT5cIiwgYmVmb3JlRXhwciksXG4gICAgdGVtcGxhdGU6IG5ldyBUb2tlblR5cGUoXCJ0ZW1wbGF0ZVwiKSxcbiAgICBpbnZhbGlkVGVtcGxhdGU6IG5ldyBUb2tlblR5cGUoXCJpbnZhbGlkVGVtcGxhdGVcIiksXG4gICAgZWxsaXBzaXM6IG5ldyBUb2tlblR5cGUoXCIuLi5cIiwgYmVmb3JlRXhwciksXG4gICAgYmFja1F1b3RlOiBuZXcgVG9rZW5UeXBlKFwiYFwiLCBzdGFydHNFeHByKSxcbiAgICBkb2xsYXJCcmFjZUw6IG5ldyBUb2tlblR5cGUoXCIke1wiLCB7YmVmb3JlRXhwcjogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pLFxuXG4gICAgLy8gT3BlcmF0b3JzLiBUaGVzZSBjYXJyeSBzZXZlcmFsIGtpbmRzIG9mIHByb3BlcnRpZXMgdG8gaGVscCB0aGVcbiAgICAvLyBwYXJzZXIgdXNlIHRoZW0gcHJvcGVybHkgKHRoZSBwcmVzZW5jZSBvZiB0aGVzZSBwcm9wZXJ0aWVzIGlzXG4gICAgLy8gd2hhdCBjYXRlZ29yaXplcyB0aGVtIGFzIG9wZXJhdG9ycykuXG4gICAgLy9cbiAgICAvLyBgYmlub3BgLCB3aGVuIHByZXNlbnQsIHNwZWNpZmllcyB0aGF0IHRoaXMgb3BlcmF0b3IgaXMgYSBiaW5hcnlcbiAgICAvLyBvcGVyYXRvciwgYW5kIHdpbGwgcmVmZXIgdG8gaXRzIHByZWNlZGVuY2UuXG4gICAgLy9cbiAgICAvLyBgcHJlZml4YCBhbmQgYHBvc3RmaXhgIG1hcmsgdGhlIG9wZXJhdG9yIGFzIGEgcHJlZml4IG9yIHBvc3RmaXhcbiAgICAvLyB1bmFyeSBvcGVyYXRvci5cbiAgICAvL1xuICAgIC8vIGBpc0Fzc2lnbmAgbWFya3MgYWxsIG9mIGA9YCwgYCs9YCwgYC09YCBldGNldGVyYSwgd2hpY2ggYWN0IGFzXG4gICAgLy8gYmluYXJ5IG9wZXJhdG9ycyB3aXRoIGEgdmVyeSBsb3cgcHJlY2VkZW5jZSwgdGhhdCBzaG91bGQgcmVzdWx0XG4gICAgLy8gaW4gQXNzaWdubWVudEV4cHJlc3Npb24gbm9kZXMuXG5cbiAgICBlcTogbmV3IFRva2VuVHlwZShcIj1cIiwge2JlZm9yZUV4cHI6IHRydWUsIGlzQXNzaWduOiB0cnVlfSksXG4gICAgYXNzaWduOiBuZXcgVG9rZW5UeXBlKFwiXz1cIiwge2JlZm9yZUV4cHI6IHRydWUsIGlzQXNzaWduOiB0cnVlfSksXG4gICAgaW5jRGVjOiBuZXcgVG9rZW5UeXBlKFwiKysvLS1cIiwge3ByZWZpeDogdHJ1ZSwgcG9zdGZpeDogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pLFxuICAgIHByZWZpeDogbmV3IFRva2VuVHlwZShcIiEvflwiLCB7YmVmb3JlRXhwcjogdHJ1ZSwgcHJlZml4OiB0cnVlLCBzdGFydHNFeHByOiB0cnVlfSksXG4gICAgbG9naWNhbE9SOiBiaW5vcChcInx8XCIsIDEpLFxuICAgIGxvZ2ljYWxBTkQ6IGJpbm9wKFwiJiZcIiwgMiksXG4gICAgYml0d2lzZU9SOiBiaW5vcChcInxcIiwgMyksXG4gICAgYml0d2lzZVhPUjogYmlub3AoXCJeXCIsIDQpLFxuICAgIGJpdHdpc2VBTkQ6IGJpbm9wKFwiJlwiLCA1KSxcbiAgICBlcXVhbGl0eTogYmlub3AoXCI9PS8hPS89PT0vIT09XCIsIDYpLFxuICAgIHJlbGF0aW9uYWw6IGJpbm9wKFwiPC8+Lzw9Lz49XCIsIDcpLFxuICAgIGJpdFNoaWZ0OiBiaW5vcChcIjw8Lz4+Lz4+PlwiLCA4KSxcbiAgICBwbHVzTWluOiBuZXcgVG9rZW5UeXBlKFwiKy8tXCIsIHtiZWZvcmVFeHByOiB0cnVlLCBiaW5vcDogOSwgcHJlZml4OiB0cnVlLCBzdGFydHNFeHByOiB0cnVlfSksXG4gICAgbW9kdWxvOiBiaW5vcChcIiVcIiwgMTApLFxuICAgIHN0YXI6IGJpbm9wKFwiKlwiLCAxMCksXG4gICAgc2xhc2g6IGJpbm9wKFwiL1wiLCAxMCksXG4gICAgc3RhcnN0YXI6IG5ldyBUb2tlblR5cGUoXCIqKlwiLCB7YmVmb3JlRXhwcjogdHJ1ZX0pLFxuICAgIGNvYWxlc2NlOiBiaW5vcChcIj8/XCIsIDEpLFxuXG4gICAgLy8gS2V5d29yZCB0b2tlbiB0eXBlcy5cbiAgICBfYnJlYWs6IGt3KFwiYnJlYWtcIiksXG4gICAgX2Nhc2U6IGt3KFwiY2FzZVwiLCBiZWZvcmVFeHByKSxcbiAgICBfY2F0Y2g6IGt3KFwiY2F0Y2hcIiksXG4gICAgX2NvbnRpbnVlOiBrdyhcImNvbnRpbnVlXCIpLFxuICAgIF9kZWJ1Z2dlcjoga3coXCJkZWJ1Z2dlclwiKSxcbiAgICBfZGVmYXVsdDoga3coXCJkZWZhdWx0XCIsIGJlZm9yZUV4cHIpLFxuICAgIF9kbzoga3coXCJkb1wiLCB7aXNMb29wOiB0cnVlLCBiZWZvcmVFeHByOiB0cnVlfSksXG4gICAgX2Vsc2U6IGt3KFwiZWxzZVwiLCBiZWZvcmVFeHByKSxcbiAgICBfZmluYWxseToga3coXCJmaW5hbGx5XCIpLFxuICAgIF9mb3I6IGt3KFwiZm9yXCIsIHtpc0xvb3A6IHRydWV9KSxcbiAgICBfZnVuY3Rpb246IGt3KFwiZnVuY3Rpb25cIiwgc3RhcnRzRXhwciksXG4gICAgX2lmOiBrdyhcImlmXCIpLFxuICAgIF9yZXR1cm46IGt3KFwicmV0dXJuXCIsIGJlZm9yZUV4cHIpLFxuICAgIF9zd2l0Y2g6IGt3KFwic3dpdGNoXCIpLFxuICAgIF90aHJvdzoga3coXCJ0aHJvd1wiLCBiZWZvcmVFeHByKSxcbiAgICBfdHJ5OiBrdyhcInRyeVwiKSxcbiAgICBfdmFyOiBrdyhcInZhclwiKSxcbiAgICBfY29uc3Q6IGt3KFwiY29uc3RcIiksXG4gICAgX3doaWxlOiBrdyhcIndoaWxlXCIsIHtpc0xvb3A6IHRydWV9KSxcbiAgICBfd2l0aDoga3coXCJ3aXRoXCIpLFxuICAgIF9uZXc6IGt3KFwibmV3XCIsIHtiZWZvcmVFeHByOiB0cnVlLCBzdGFydHNFeHByOiB0cnVlfSksXG4gICAgX3RoaXM6IGt3KFwidGhpc1wiLCBzdGFydHNFeHByKSxcbiAgICBfc3VwZXI6IGt3KFwic3VwZXJcIiwgc3RhcnRzRXhwciksXG4gICAgX2NsYXNzOiBrdyhcImNsYXNzXCIsIHN0YXJ0c0V4cHIpLFxuICAgIF9leHRlbmRzOiBrdyhcImV4dGVuZHNcIiwgYmVmb3JlRXhwciksXG4gICAgX2V4cG9ydDoga3coXCJleHBvcnRcIiksXG4gICAgX2ltcG9ydDoga3coXCJpbXBvcnRcIiwgc3RhcnRzRXhwciksXG4gICAgX251bGw6IGt3KFwibnVsbFwiLCBzdGFydHNFeHByKSxcbiAgICBfdHJ1ZToga3coXCJ0cnVlXCIsIHN0YXJ0c0V4cHIpLFxuICAgIF9mYWxzZToga3coXCJmYWxzZVwiLCBzdGFydHNFeHByKSxcbiAgICBfaW46IGt3KFwiaW5cIiwge2JlZm9yZUV4cHI6IHRydWUsIGJpbm9wOiA3fSksXG4gICAgX2luc3RhbmNlb2Y6IGt3KFwiaW5zdGFuY2VvZlwiLCB7YmVmb3JlRXhwcjogdHJ1ZSwgYmlub3A6IDd9KSxcbiAgICBfdHlwZW9mOiBrdyhcInR5cGVvZlwiLCB7YmVmb3JlRXhwcjogdHJ1ZSwgcHJlZml4OiB0cnVlLCBzdGFydHNFeHByOiB0cnVlfSksXG4gICAgX3ZvaWQ6IGt3KFwidm9pZFwiLCB7YmVmb3JlRXhwcjogdHJ1ZSwgcHJlZml4OiB0cnVlLCBzdGFydHNFeHByOiB0cnVlfSksXG4gICAgX2RlbGV0ZToga3coXCJkZWxldGVcIiwge2JlZm9yZUV4cHI6IHRydWUsIHByZWZpeDogdHJ1ZSwgc3RhcnRzRXhwcjogdHJ1ZX0pXG4gIH07XG5cbiAgLy8gTWF0Y2hlcyBhIHdob2xlIGxpbmUgYnJlYWsgKHdoZXJlIENSTEYgaXMgY29uc2lkZXJlZCBhIHNpbmdsZVxuICAvLyBsaW5lIGJyZWFrKS4gVXNlZCB0byBjb3VudCBsaW5lcy5cblxuICB2YXIgbGluZUJyZWFrID0gL1xcclxcbj98XFxufFxcdTIwMjh8XFx1MjAyOS87XG4gIHZhciBsaW5lQnJlYWtHID0gbmV3IFJlZ0V4cChsaW5lQnJlYWsuc291cmNlLCBcImdcIik7XG5cbiAgZnVuY3Rpb24gaXNOZXdMaW5lKGNvZGUpIHtcbiAgICByZXR1cm4gY29kZSA9PT0gMTAgfHwgY29kZSA9PT0gMTMgfHwgY29kZSA9PT0gMHgyMDI4IHx8IGNvZGUgPT09IDB4MjAyOVxuICB9XG5cbiAgZnVuY3Rpb24gbmV4dExpbmVCcmVhayhjb2RlLCBmcm9tLCBlbmQpIHtcbiAgICBpZiAoIGVuZCA9PT0gdm9pZCAwICkgZW5kID0gY29kZS5sZW5ndGg7XG5cbiAgICBmb3IgKHZhciBpID0gZnJvbTsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB2YXIgbmV4dCA9IGNvZGUuY2hhckNvZGVBdChpKTtcbiAgICAgIGlmIChpc05ld0xpbmUobmV4dCkpXG4gICAgICAgIHsgcmV0dXJuIGkgPCBlbmQgLSAxICYmIG5leHQgPT09IDEzICYmIGNvZGUuY2hhckNvZGVBdChpICsgMSkgPT09IDEwID8gaSArIDIgOiBpICsgMSB9XG4gICAgfVxuICAgIHJldHVybiAtMVxuICB9XG5cbiAgdmFyIG5vbkFTQ0lJd2hpdGVzcGFjZSA9IC9bXFx1MTY4MFxcdTIwMDAtXFx1MjAwYVxcdTIwMmZcXHUyMDVmXFx1MzAwMFxcdWZlZmZdLztcblxuICB2YXIgc2tpcFdoaXRlU3BhY2UgPSAvKD86XFxzfFxcL1xcLy4qfFxcL1xcKlteXSo/XFwqXFwvKSovZztcblxuICB2YXIgcmVmID0gT2JqZWN0LnByb3RvdHlwZTtcbiAgdmFyIGhhc093blByb3BlcnR5ID0gcmVmLmhhc093blByb3BlcnR5O1xuICB2YXIgdG9TdHJpbmcgPSByZWYudG9TdHJpbmc7XG5cbiAgdmFyIGhhc093biA9IE9iamVjdC5oYXNPd24gfHwgKGZ1bmN0aW9uIChvYmosIHByb3BOYW1lKSB7IHJldHVybiAoXG4gICAgaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3BOYW1lKVxuICApOyB9KTtcblxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgKGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIChcbiAgICB0b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIlxuICApOyB9KTtcblxuICBmdW5jdGlvbiB3b3Jkc1JlZ2V4cCh3b3Jkcykge1xuICAgIHJldHVybiBuZXcgUmVnRXhwKFwiXig/OlwiICsgd29yZHMucmVwbGFjZSgvIC9nLCBcInxcIikgKyBcIikkXCIpXG4gIH1cblxuICBmdW5jdGlvbiBjb2RlUG9pbnRUb1N0cmluZyhjb2RlKSB7XG4gICAgLy8gVVRGLTE2IERlY29kaW5nXG4gICAgaWYgKGNvZGUgPD0gMHhGRkZGKSB7IHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpIH1cbiAgICBjb2RlIC09IDB4MTAwMDA7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoKGNvZGUgPj4gMTApICsgMHhEODAwLCAoY29kZSAmIDEwMjMpICsgMHhEQzAwKVxuICB9XG5cbiAgdmFyIGxvbmVTdXJyb2dhdGUgPSAvKD86W1xcdUQ4MDAtXFx1REJGRl0oPyFbXFx1REMwMC1cXHVERkZGXSl8KD86W15cXHVEODAwLVxcdURCRkZdfF4pW1xcdURDMDAtXFx1REZGRl0pLztcblxuICAvLyBUaGVzZSBhcmUgdXNlZCB3aGVuIGBvcHRpb25zLmxvY2F0aW9uc2AgaXMgb24sIGZvciB0aGVcbiAgLy8gYHN0YXJ0TG9jYCBhbmQgYGVuZExvY2AgcHJvcGVydGllcy5cblxuICB2YXIgUG9zaXRpb24gPSBmdW5jdGlvbiBQb3NpdGlvbihsaW5lLCBjb2wpIHtcbiAgICB0aGlzLmxpbmUgPSBsaW5lO1xuICAgIHRoaXMuY29sdW1uID0gY29sO1xuICB9O1xuXG4gIFBvc2l0aW9uLnByb3RvdHlwZS5vZmZzZXQgPSBmdW5jdGlvbiBvZmZzZXQgKG4pIHtcbiAgICByZXR1cm4gbmV3IFBvc2l0aW9uKHRoaXMubGluZSwgdGhpcy5jb2x1bW4gKyBuKVxuICB9O1xuXG4gIHZhciBTb3VyY2VMb2NhdGlvbiA9IGZ1bmN0aW9uIFNvdXJjZUxvY2F0aW9uKHAsIHN0YXJ0LCBlbmQpIHtcbiAgICB0aGlzLnN0YXJ0ID0gc3RhcnQ7XG4gICAgdGhpcy5lbmQgPSBlbmQ7XG4gICAgaWYgKHAuc291cmNlRmlsZSAhPT0gbnVsbCkgeyB0aGlzLnNvdXJjZSA9IHAuc291cmNlRmlsZTsgfVxuICB9O1xuXG4gIC8vIFRoZSBgZ2V0TGluZUluZm9gIGZ1bmN0aW9uIGlzIG1vc3RseSB1c2VmdWwgd2hlbiB0aGVcbiAgLy8gYGxvY2F0aW9uc2Agb3B0aW9uIGlzIG9mZiAoZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMpIGFuZCB5b3VcbiAgLy8gd2FudCB0byBmaW5kIHRoZSBsaW5lL2NvbHVtbiBwb3NpdGlvbiBmb3IgYSBnaXZlbiBjaGFyYWN0ZXJcbiAgLy8gb2Zmc2V0LiBgaW5wdXRgIHNob3VsZCBiZSB0aGUgY29kZSBzdHJpbmcgdGhhdCB0aGUgb2Zmc2V0IHJlZmVyc1xuICAvLyBpbnRvLlxuXG4gIGZ1bmN0aW9uIGdldExpbmVJbmZvKGlucHV0LCBvZmZzZXQpIHtcbiAgICBmb3IgKHZhciBsaW5lID0gMSwgY3VyID0gMDs7KSB7XG4gICAgICB2YXIgbmV4dEJyZWFrID0gbmV4dExpbmVCcmVhayhpbnB1dCwgY3VyLCBvZmZzZXQpO1xuICAgICAgaWYgKG5leHRCcmVhayA8IDApIHsgcmV0dXJuIG5ldyBQb3NpdGlvbihsaW5lLCBvZmZzZXQgLSBjdXIpIH1cbiAgICAgICsrbGluZTtcbiAgICAgIGN1ciA9IG5leHRCcmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBBIHNlY29uZCBhcmd1bWVudCBtdXN0IGJlIGdpdmVuIHRvIGNvbmZpZ3VyZSB0aGUgcGFyc2VyIHByb2Nlc3MuXG4gIC8vIFRoZXNlIG9wdGlvbnMgYXJlIHJlY29nbml6ZWQgKG9ubHkgYGVjbWFWZXJzaW9uYCBpcyByZXF1aXJlZCk6XG5cbiAgdmFyIGRlZmF1bHRPcHRpb25zID0ge1xuICAgIC8vIGBlY21hVmVyc2lvbmAgaW5kaWNhdGVzIHRoZSBFQ01BU2NyaXB0IHZlcnNpb24gdG8gcGFyc2UuIE11c3QgYmVcbiAgICAvLyBlaXRoZXIgMywgNSwgNiAob3IgMjAxNSksIDcgKDIwMTYpLCA4ICgyMDE3KSwgOSAoMjAxOCksIDEwXG4gICAgLy8gKDIwMTkpLCAxMSAoMjAyMCksIDEyICgyMDIxKSwgMTMgKDIwMjIpLCAxNCAoMjAyMyksIG9yIGBcImxhdGVzdFwiYFxuICAgIC8vICh0aGUgbGF0ZXN0IHZlcnNpb24gdGhlIGxpYnJhcnkgc3VwcG9ydHMpLiBUaGlzIGluZmx1ZW5jZXNcbiAgICAvLyBzdXBwb3J0IGZvciBzdHJpY3QgbW9kZSwgdGhlIHNldCBvZiByZXNlcnZlZCB3b3JkcywgYW5kIHN1cHBvcnRcbiAgICAvLyBmb3IgbmV3IHN5bnRheCBmZWF0dXJlcy5cbiAgICBlY21hVmVyc2lvbjogbnVsbCxcbiAgICAvLyBgc291cmNlVHlwZWAgaW5kaWNhdGVzIHRoZSBtb2RlIHRoZSBjb2RlIHNob3VsZCBiZSBwYXJzZWQgaW4uXG4gICAgLy8gQ2FuIGJlIGVpdGhlciBgXCJzY3JpcHRcImAgb3IgYFwibW9kdWxlXCJgLiBUaGlzIGluZmx1ZW5jZXMgZ2xvYmFsXG4gICAgLy8gc3RyaWN0IG1vZGUgYW5kIHBhcnNpbmcgb2YgYGltcG9ydGAgYW5kIGBleHBvcnRgIGRlY2xhcmF0aW9ucy5cbiAgICBzb3VyY2VUeXBlOiBcInNjcmlwdFwiLFxuICAgIC8vIGBvbkluc2VydGVkU2VtaWNvbG9uYCBjYW4gYmUgYSBjYWxsYmFjayB0aGF0IHdpbGwgYmUgY2FsbGVkXG4gICAgLy8gd2hlbiBhIHNlbWljb2xvbiBpcyBhdXRvbWF0aWNhbGx5IGluc2VydGVkLiBJdCB3aWxsIGJlIHBhc3NlZFxuICAgIC8vIHRoZSBwb3NpdGlvbiBvZiB0aGUgY29tbWEgYXMgYW4gb2Zmc2V0LCBhbmQgaWYgYGxvY2F0aW9uc2AgaXNcbiAgICAvLyBlbmFibGVkLCBpdCBpcyBnaXZlbiB0aGUgbG9jYXRpb24gYXMgYSBge2xpbmUsIGNvbHVtbn1gIG9iamVjdFxuICAgIC8vIGFzIHNlY29uZCBhcmd1bWVudC5cbiAgICBvbkluc2VydGVkU2VtaWNvbG9uOiBudWxsLFxuICAgIC8vIGBvblRyYWlsaW5nQ29tbWFgIGlzIHNpbWlsYXIgdG8gYG9uSW5zZXJ0ZWRTZW1pY29sb25gLCBidXQgZm9yXG4gICAgLy8gdHJhaWxpbmcgY29tbWFzLlxuICAgIG9uVHJhaWxpbmdDb21tYTogbnVsbCxcbiAgICAvLyBCeSBkZWZhdWx0LCByZXNlcnZlZCB3b3JkcyBhcmUgb25seSBlbmZvcmNlZCBpZiBlY21hVmVyc2lvbiA+PSA1LlxuICAgIC8vIFNldCBgYWxsb3dSZXNlcnZlZGAgdG8gYSBib29sZWFuIHZhbHVlIHRvIGV4cGxpY2l0bHkgdHVybiB0aGlzIG9uXG4gICAgLy8gYW4gb2ZmLiBXaGVuIHRoaXMgb3B0aW9uIGhhcyB0aGUgdmFsdWUgXCJuZXZlclwiLCByZXNlcnZlZCB3b3Jkc1xuICAgIC8vIGFuZCBrZXl3b3JkcyBjYW4gYWxzbyBub3QgYmUgdXNlZCBhcyBwcm9wZXJ0eSBuYW1lcy5cbiAgICBhbGxvd1Jlc2VydmVkOiBudWxsLFxuICAgIC8vIFdoZW4gZW5hYmxlZCwgYSByZXR1cm4gYXQgdGhlIHRvcCBsZXZlbCBpcyBub3QgY29uc2lkZXJlZCBhblxuICAgIC8vIGVycm9yLlxuICAgIGFsbG93UmV0dXJuT3V0c2lkZUZ1bmN0aW9uOiBmYWxzZSxcbiAgICAvLyBXaGVuIGVuYWJsZWQsIGltcG9ydC9leHBvcnQgc3RhdGVtZW50cyBhcmUgbm90IGNvbnN0cmFpbmVkIHRvXG4gICAgLy8gYXBwZWFyaW5nIGF0IHRoZSB0b3Agb2YgdGhlIHByb2dyYW0sIGFuZCBhbiBpbXBvcnQubWV0YSBleHByZXNzaW9uXG4gICAgLy8gaW4gYSBzY3JpcHQgaXNuJ3QgY29uc2lkZXJlZCBhbiBlcnJvci5cbiAgICBhbGxvd0ltcG9ydEV4cG9ydEV2ZXJ5d2hlcmU6IGZhbHNlLFxuICAgIC8vIEJ5IGRlZmF1bHQsIGF3YWl0IGlkZW50aWZpZXJzIGFyZSBhbGxvd2VkIHRvIGFwcGVhciBhdCB0aGUgdG9wLWxldmVsIHNjb3BlIG9ubHkgaWYgZWNtYVZlcnNpb24gPj0gMjAyMi5cbiAgICAvLyBXaGVuIGVuYWJsZWQsIGF3YWl0IGlkZW50aWZpZXJzIGFyZSBhbGxvd2VkIHRvIGFwcGVhciBhdCB0aGUgdG9wLWxldmVsIHNjb3BlLFxuICAgIC8vIGJ1dCB0aGV5IGFyZSBzdGlsbCBub3QgYWxsb3dlZCBpbiBub24tYXN5bmMgZnVuY3Rpb25zLlxuICAgIGFsbG93QXdhaXRPdXRzaWRlRnVuY3Rpb246IG51bGwsXG4gICAgLy8gV2hlbiBlbmFibGVkLCBzdXBlciBpZGVudGlmaWVycyBhcmUgbm90IGNvbnN0cmFpbmVkIHRvXG4gICAgLy8gYXBwZWFyaW5nIGluIG1ldGhvZHMgYW5kIGRvIG5vdCByYWlzZSBhbiBlcnJvciB3aGVuIHRoZXkgYXBwZWFyIGVsc2V3aGVyZS5cbiAgICBhbGxvd1N1cGVyT3V0c2lkZU1ldGhvZDogbnVsbCxcbiAgICAvLyBXaGVuIGVuYWJsZWQsIGhhc2hiYW5nIGRpcmVjdGl2ZSBpbiB0aGUgYmVnaW5uaW5nIG9mIGZpbGUgaXNcbiAgICAvLyBhbGxvd2VkIGFuZCB0cmVhdGVkIGFzIGEgbGluZSBjb21tZW50LiBFbmFibGVkIGJ5IGRlZmF1bHQgd2hlblxuICAgIC8vIGBlY21hVmVyc2lvbmAgPj0gMjAyMy5cbiAgICBhbGxvd0hhc2hCYW5nOiBmYWxzZSxcbiAgICAvLyBCeSBkZWZhdWx0LCB0aGUgcGFyc2VyIHdpbGwgdmVyaWZ5IHRoYXQgcHJpdmF0ZSBwcm9wZXJ0aWVzIGFyZVxuICAgIC8vIG9ubHkgdXNlZCBpbiBwbGFjZXMgd2hlcmUgdGhleSBhcmUgdmFsaWQgYW5kIGhhdmUgYmVlbiBkZWNsYXJlZC5cbiAgICAvLyBTZXQgdGhpcyB0byBmYWxzZSB0byB0dXJuIHN1Y2ggY2hlY2tzIG9mZi5cbiAgICBjaGVja1ByaXZhdGVGaWVsZHM6IHRydWUsXG4gICAgLy8gV2hlbiBgbG9jYXRpb25zYCBpcyBvbiwgYGxvY2AgcHJvcGVydGllcyBob2xkaW5nIG9iamVjdHMgd2l0aFxuICAgIC8vIGBzdGFydGAgYW5kIGBlbmRgIHByb3BlcnRpZXMgaW4gYHtsaW5lLCBjb2x1bW59YCBmb3JtICh3aXRoXG4gICAgLy8gbGluZSBiZWluZyAxLWJhc2VkIGFuZCBjb2x1bW4gMC1iYXNlZCkgd2lsbCBiZSBhdHRhY2hlZCB0byB0aGVcbiAgICAvLyBub2Rlcy5cbiAgICBsb2NhdGlvbnM6IGZhbHNlLFxuICAgIC8vIEEgZnVuY3Rpb24gY2FuIGJlIHBhc3NlZCBhcyBgb25Ub2tlbmAgb3B0aW9uLCB3aGljaCB3aWxsXG4gICAgLy8gY2F1c2UgQWNvcm4gdG8gY2FsbCB0aGF0IGZ1bmN0aW9uIHdpdGggb2JqZWN0IGluIHRoZSBzYW1lXG4gICAgLy8gZm9ybWF0IGFzIHRva2VucyByZXR1cm5lZCBmcm9tIGB0b2tlbml6ZXIoKS5nZXRUb2tlbigpYC4gTm90ZVxuICAgIC8vIHRoYXQgeW91IGFyZSBub3QgYWxsb3dlZCB0byBjYWxsIHRoZSBwYXJzZXIgZnJvbSB0aGVcbiAgICAvLyBjYWxsYmFja+KAlHRoYXQgd2lsbCBjb3JydXB0IGl0cyBpbnRlcm5hbCBzdGF0ZS5cbiAgICBvblRva2VuOiBudWxsLFxuICAgIC8vIEEgZnVuY3Rpb24gY2FuIGJlIHBhc3NlZCBhcyBgb25Db21tZW50YCBvcHRpb24sIHdoaWNoIHdpbGxcbiAgICAvLyBjYXVzZSBBY29ybiB0byBjYWxsIHRoYXQgZnVuY3Rpb24gd2l0aCBgKGJsb2NrLCB0ZXh0LCBzdGFydCxcbiAgICAvLyBlbmQpYCBwYXJhbWV0ZXJzIHdoZW5ldmVyIGEgY29tbWVudCBpcyBza2lwcGVkLiBgYmxvY2tgIGlzIGFcbiAgICAvLyBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIGEgYmxvY2sgKGAvKiAqL2ApIGNvbW1lbnQsXG4gICAgLy8gYHRleHRgIGlzIHRoZSBjb250ZW50IG9mIHRoZSBjb21tZW50LCBhbmQgYHN0YXJ0YCBhbmQgYGVuZGAgYXJlXG4gICAgLy8gY2hhcmFjdGVyIG9mZnNldHMgdGhhdCBkZW5vdGUgdGhlIHN0YXJ0IGFuZCBlbmQgb2YgdGhlIGNvbW1lbnQuXG4gICAgLy8gV2hlbiB0aGUgYGxvY2F0aW9uc2Agb3B0aW9uIGlzIG9uLCB0d28gbW9yZSBwYXJhbWV0ZXJzIGFyZVxuICAgIC8vIHBhc3NlZCwgdGhlIGZ1bGwgYHtsaW5lLCBjb2x1bW59YCBsb2NhdGlvbnMgb2YgdGhlIHN0YXJ0IGFuZFxuICAgIC8vIGVuZCBvZiB0aGUgY29tbWVudHMuIE5vdGUgdGhhdCB5b3UgYXJlIG5vdCBhbGxvd2VkIHRvIGNhbGwgdGhlXG4gICAgLy8gcGFyc2VyIGZyb20gdGhlIGNhbGxiYWNr4oCUdGhhdCB3aWxsIGNvcnJ1cHQgaXRzIGludGVybmFsIHN0YXRlLlxuICAgIG9uQ29tbWVudDogbnVsbCxcbiAgICAvLyBOb2RlcyBoYXZlIHRoZWlyIHN0YXJ0IGFuZCBlbmQgY2hhcmFjdGVycyBvZmZzZXRzIHJlY29yZGVkIGluXG4gICAgLy8gYHN0YXJ0YCBhbmQgYGVuZGAgcHJvcGVydGllcyAoZGlyZWN0bHkgb24gdGhlIG5vZGUsIHJhdGhlciB0aGFuXG4gICAgLy8gdGhlIGBsb2NgIG9iamVjdCwgd2hpY2ggaG9sZHMgbGluZS9jb2x1bW4gZGF0YS4gVG8gYWxzbyBhZGQgYVxuICAgIC8vIFtzZW1pLXN0YW5kYXJkaXplZF1bcmFuZ2VdIGByYW5nZWAgcHJvcGVydHkgaG9sZGluZyBhIGBbc3RhcnQsXG4gICAgLy8gZW5kXWAgYXJyYXkgd2l0aCB0aGUgc2FtZSBudW1iZXJzLCBzZXQgdGhlIGByYW5nZXNgIG9wdGlvbiB0b1xuICAgIC8vIGB0cnVlYC5cbiAgICAvL1xuICAgIC8vIFtyYW5nZV06IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTc0NTY3OFxuICAgIHJhbmdlczogZmFsc2UsXG4gICAgLy8gSXQgaXMgcG9zc2libGUgdG8gcGFyc2UgbXVsdGlwbGUgZmlsZXMgaW50byBhIHNpbmdsZSBBU1QgYnlcbiAgICAvLyBwYXNzaW5nIHRoZSB0cmVlIHByb2R1Y2VkIGJ5IHBhcnNpbmcgdGhlIGZpcnN0IGZpbGUgYXNcbiAgICAvLyBgcHJvZ3JhbWAgb3B0aW9uIGluIHN1YnNlcXVlbnQgcGFyc2VzLiBUaGlzIHdpbGwgYWRkIHRoZVxuICAgIC8vIHRvcGxldmVsIGZvcm1zIG9mIHRoZSBwYXJzZWQgZmlsZSB0byB0aGUgYFByb2dyYW1gICh0b3ApIG5vZGVcbiAgICAvLyBvZiBhbiBleGlzdGluZyBwYXJzZSB0cmVlLlxuICAgIHByb2dyYW06IG51bGwsXG4gICAgLy8gV2hlbiBgbG9jYXRpb25zYCBpcyBvbiwgeW91IGNhbiBwYXNzIHRoaXMgdG8gcmVjb3JkIHRoZSBzb3VyY2VcbiAgICAvLyBmaWxlIGluIGV2ZXJ5IG5vZGUncyBgbG9jYCBvYmplY3QuXG4gICAgc291cmNlRmlsZTogbnVsbCxcbiAgICAvLyBUaGlzIHZhbHVlLCBpZiBnaXZlbiwgaXMgc3RvcmVkIGluIGV2ZXJ5IG5vZGUsIHdoZXRoZXJcbiAgICAvLyBgbG9jYXRpb25zYCBpcyBvbiBvciBvZmYuXG4gICAgZGlyZWN0U291cmNlRmlsZTogbnVsbCxcbiAgICAvLyBXaGVuIGVuYWJsZWQsIHBhcmVudGhlc2l6ZWQgZXhwcmVzc2lvbnMgYXJlIHJlcHJlc2VudGVkIGJ5XG4gICAgLy8gKG5vbi1zdGFuZGFyZCkgUGFyZW50aGVzaXplZEV4cHJlc3Npb24gbm9kZXNcbiAgICBwcmVzZXJ2ZVBhcmVuczogZmFsc2VcbiAgfTtcblxuICAvLyBJbnRlcnByZXQgYW5kIGRlZmF1bHQgYW4gb3B0aW9ucyBvYmplY3RcblxuICB2YXIgd2FybmVkQWJvdXRFY21hVmVyc2lvbiA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGdldE9wdGlvbnMob3B0cykge1xuICAgIHZhciBvcHRpb25zID0ge307XG5cbiAgICBmb3IgKHZhciBvcHQgaW4gZGVmYXVsdE9wdGlvbnMpXG4gICAgICB7IG9wdGlvbnNbb3B0XSA9IG9wdHMgJiYgaGFzT3duKG9wdHMsIG9wdCkgPyBvcHRzW29wdF0gOiBkZWZhdWx0T3B0aW9uc1tvcHRdOyB9XG5cbiAgICBpZiAob3B0aW9ucy5lY21hVmVyc2lvbiA9PT0gXCJsYXRlc3RcIikge1xuICAgICAgb3B0aW9ucy5lY21hVmVyc2lvbiA9IDFlODtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuZWNtYVZlcnNpb24gPT0gbnVsbCkge1xuICAgICAgaWYgKCF3YXJuZWRBYm91dEVjbWFWZXJzaW9uICYmIHR5cGVvZiBjb25zb2xlID09PSBcIm9iamVjdFwiICYmIGNvbnNvbGUud2Fybikge1xuICAgICAgICB3YXJuZWRBYm91dEVjbWFWZXJzaW9uID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS53YXJuKFwiU2luY2UgQWNvcm4gOC4wLjAsIG9wdGlvbnMuZWNtYVZlcnNpb24gaXMgcmVxdWlyZWQuXFxuRGVmYXVsdGluZyB0byAyMDIwLCBidXQgdGhpcyB3aWxsIHN0b3Agd29ya2luZyBpbiB0aGUgZnV0dXJlLlwiKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMuZWNtYVZlcnNpb24gPSAxMTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMjAxNSkge1xuICAgICAgb3B0aW9ucy5lY21hVmVyc2lvbiAtPSAyMDA5O1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmFsbG93UmVzZXJ2ZWQgPT0gbnVsbClcbiAgICAgIHsgb3B0aW9ucy5hbGxvd1Jlc2VydmVkID0gb3B0aW9ucy5lY21hVmVyc2lvbiA8IDU7IH1cblxuICAgIGlmICghb3B0cyB8fCBvcHRzLmFsbG93SGFzaEJhbmcgPT0gbnVsbClcbiAgICAgIHsgb3B0aW9ucy5hbGxvd0hhc2hCYW5nID0gb3B0aW9ucy5lY21hVmVyc2lvbiA+PSAxNDsgfVxuXG4gICAgaWYgKGlzQXJyYXkob3B0aW9ucy5vblRva2VuKSkge1xuICAgICAgdmFyIHRva2VucyA9IG9wdGlvbnMub25Ub2tlbjtcbiAgICAgIG9wdGlvbnMub25Ub2tlbiA9IGZ1bmN0aW9uICh0b2tlbikgeyByZXR1cm4gdG9rZW5zLnB1c2godG9rZW4pOyB9O1xuICAgIH1cbiAgICBpZiAoaXNBcnJheShvcHRpb25zLm9uQ29tbWVudCkpXG4gICAgICB7IG9wdGlvbnMub25Db21tZW50ID0gcHVzaENvbW1lbnQob3B0aW9ucywgb3B0aW9ucy5vbkNvbW1lbnQpOyB9XG5cbiAgICByZXR1cm4gb3B0aW9uc1xuICB9XG5cbiAgZnVuY3Rpb24gcHVzaENvbW1lbnQob3B0aW9ucywgYXJyYXkpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oYmxvY2ssIHRleHQsIHN0YXJ0LCBlbmQsIHN0YXJ0TG9jLCBlbmRMb2MpIHtcbiAgICAgIHZhciBjb21tZW50ID0ge1xuICAgICAgICB0eXBlOiBibG9jayA/IFwiQmxvY2tcIiA6IFwiTGluZVwiLFxuICAgICAgICB2YWx1ZTogdGV4dCxcbiAgICAgICAgc3RhcnQ6IHN0YXJ0LFxuICAgICAgICBlbmQ6IGVuZFxuICAgICAgfTtcbiAgICAgIGlmIChvcHRpb25zLmxvY2F0aW9ucylcbiAgICAgICAgeyBjb21tZW50LmxvYyA9IG5ldyBTb3VyY2VMb2NhdGlvbih0aGlzLCBzdGFydExvYywgZW5kTG9jKTsgfVxuICAgICAgaWYgKG9wdGlvbnMucmFuZ2VzKVxuICAgICAgICB7IGNvbW1lbnQucmFuZ2UgPSBbc3RhcnQsIGVuZF07IH1cbiAgICAgIGFycmF5LnB1c2goY29tbWVudCk7XG4gICAgfVxuICB9XG5cbiAgLy8gRWFjaCBzY29wZSBnZXRzIGEgYml0c2V0IHRoYXQgbWF5IGNvbnRhaW4gdGhlc2UgZmxhZ3NcbiAgdmFyXG4gICAgICBTQ09QRV9UT1AgPSAxLFxuICAgICAgU0NPUEVfRlVOQ1RJT04gPSAyLFxuICAgICAgU0NPUEVfQVNZTkMgPSA0LFxuICAgICAgU0NPUEVfR0VORVJBVE9SID0gOCxcbiAgICAgIFNDT1BFX0FSUk9XID0gMTYsXG4gICAgICBTQ09QRV9TSU1QTEVfQ0FUQ0ggPSAzMixcbiAgICAgIFNDT1BFX1NVUEVSID0gNjQsXG4gICAgICBTQ09QRV9ESVJFQ1RfU1VQRVIgPSAxMjgsXG4gICAgICBTQ09QRV9DTEFTU19TVEFUSUNfQkxPQ0sgPSAyNTYsXG4gICAgICBTQ09QRV9WQVIgPSBTQ09QRV9UT1AgfCBTQ09QRV9GVU5DVElPTiB8IFNDT1BFX0NMQVNTX1NUQVRJQ19CTE9DSztcblxuICBmdW5jdGlvbiBmdW5jdGlvbkZsYWdzKGFzeW5jLCBnZW5lcmF0b3IpIHtcbiAgICByZXR1cm4gU0NPUEVfRlVOQ1RJT04gfCAoYXN5bmMgPyBTQ09QRV9BU1lOQyA6IDApIHwgKGdlbmVyYXRvciA/IFNDT1BFX0dFTkVSQVRPUiA6IDApXG4gIH1cblxuICAvLyBVc2VkIGluIGNoZWNrTFZhbCogYW5kIGRlY2xhcmVOYW1lIHRvIGRldGVybWluZSB0aGUgdHlwZSBvZiBhIGJpbmRpbmdcbiAgdmFyXG4gICAgICBCSU5EX05PTkUgPSAwLCAvLyBOb3QgYSBiaW5kaW5nXG4gICAgICBCSU5EX1ZBUiA9IDEsIC8vIFZhci1zdHlsZSBiaW5kaW5nXG4gICAgICBCSU5EX0xFWElDQUwgPSAyLCAvLyBMZXQtIG9yIGNvbnN0LXN0eWxlIGJpbmRpbmdcbiAgICAgIEJJTkRfRlVOQ1RJT04gPSAzLCAvLyBGdW5jdGlvbiBkZWNsYXJhdGlvblxuICAgICAgQklORF9TSU1QTEVfQ0FUQ0ggPSA0LCAvLyBTaW1wbGUgKGlkZW50aWZpZXIgcGF0dGVybikgY2F0Y2ggYmluZGluZ1xuICAgICAgQklORF9PVVRTSURFID0gNTsgLy8gU3BlY2lhbCBjYXNlIGZvciBmdW5jdGlvbiBuYW1lcyBhcyBib3VuZCBpbnNpZGUgdGhlIGZ1bmN0aW9uXG5cbiAgdmFyIFBhcnNlciA9IGZ1bmN0aW9uIFBhcnNlcihvcHRpb25zLCBpbnB1dCwgc3RhcnRQb3MpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zID0gZ2V0T3B0aW9ucyhvcHRpb25zKTtcbiAgICB0aGlzLnNvdXJjZUZpbGUgPSBvcHRpb25zLnNvdXJjZUZpbGU7XG4gICAgdGhpcy5rZXl3b3JkcyA9IHdvcmRzUmVnZXhwKGtleXdvcmRzJDFbb3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ID8gNiA6IG9wdGlvbnMuc291cmNlVHlwZSA9PT0gXCJtb2R1bGVcIiA/IFwiNW1vZHVsZVwiIDogNV0pO1xuICAgIHZhciByZXNlcnZlZCA9IFwiXCI7XG4gICAgaWYgKG9wdGlvbnMuYWxsb3dSZXNlcnZlZCAhPT0gdHJ1ZSkge1xuICAgICAgcmVzZXJ2ZWQgPSByZXNlcnZlZFdvcmRzW29wdGlvbnMuZWNtYVZlcnNpb24gPj0gNiA/IDYgOiBvcHRpb25zLmVjbWFWZXJzaW9uID09PSA1ID8gNSA6IDNdO1xuICAgICAgaWYgKG9wdGlvbnMuc291cmNlVHlwZSA9PT0gXCJtb2R1bGVcIikgeyByZXNlcnZlZCArPSBcIiBhd2FpdFwiOyB9XG4gICAgfVxuICAgIHRoaXMucmVzZXJ2ZWRXb3JkcyA9IHdvcmRzUmVnZXhwKHJlc2VydmVkKTtcbiAgICB2YXIgcmVzZXJ2ZWRTdHJpY3QgPSAocmVzZXJ2ZWQgPyByZXNlcnZlZCArIFwiIFwiIDogXCJcIikgKyByZXNlcnZlZFdvcmRzLnN0cmljdDtcbiAgICB0aGlzLnJlc2VydmVkV29yZHNTdHJpY3QgPSB3b3Jkc1JlZ2V4cChyZXNlcnZlZFN0cmljdCk7XG4gICAgdGhpcy5yZXNlcnZlZFdvcmRzU3RyaWN0QmluZCA9IHdvcmRzUmVnZXhwKHJlc2VydmVkU3RyaWN0ICsgXCIgXCIgKyByZXNlcnZlZFdvcmRzLnN0cmljdEJpbmQpO1xuICAgIHRoaXMuaW5wdXQgPSBTdHJpbmcoaW5wdXQpO1xuXG4gICAgLy8gVXNlZCB0byBzaWduYWwgdG8gY2FsbGVycyBvZiBgcmVhZFdvcmQxYCB3aGV0aGVyIHRoZSB3b3JkXG4gICAgLy8gY29udGFpbmVkIGFueSBlc2NhcGUgc2VxdWVuY2VzLiBUaGlzIGlzIG5lZWRlZCBiZWNhdXNlIHdvcmRzIHdpdGhcbiAgICAvLyBlc2NhcGUgc2VxdWVuY2VzIG11c3Qgbm90IGJlIGludGVycHJldGVkIGFzIGtleXdvcmRzLlxuICAgIHRoaXMuY29udGFpbnNFc2MgPSBmYWxzZTtcblxuICAgIC8vIFNldCB1cCB0b2tlbiBzdGF0ZVxuXG4gICAgLy8gVGhlIGN1cnJlbnQgcG9zaXRpb24gb2YgdGhlIHRva2VuaXplciBpbiB0aGUgaW5wdXQuXG4gICAgaWYgKHN0YXJ0UG9zKSB7XG4gICAgICB0aGlzLnBvcyA9IHN0YXJ0UG9zO1xuICAgICAgdGhpcy5saW5lU3RhcnQgPSB0aGlzLmlucHV0Lmxhc3RJbmRleE9mKFwiXFxuXCIsIHN0YXJ0UG9zIC0gMSkgKyAxO1xuICAgICAgdGhpcy5jdXJMaW5lID0gdGhpcy5pbnB1dC5zbGljZSgwLCB0aGlzLmxpbmVTdGFydCkuc3BsaXQobGluZUJyZWFrKS5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucG9zID0gdGhpcy5saW5lU3RhcnQgPSAwO1xuICAgICAgdGhpcy5jdXJMaW5lID0gMTtcbiAgICB9XG5cbiAgICAvLyBQcm9wZXJ0aWVzIG9mIHRoZSBjdXJyZW50IHRva2VuOlxuICAgIC8vIEl0cyB0eXBlXG4gICAgdGhpcy50eXBlID0gdHlwZXMkMS5lb2Y7XG4gICAgLy8gRm9yIHRva2VucyB0aGF0IGluY2x1ZGUgbW9yZSBpbmZvcm1hdGlvbiB0aGFuIHRoZWlyIHR5cGUsIHRoZSB2YWx1ZVxuICAgIHRoaXMudmFsdWUgPSBudWxsO1xuICAgIC8vIEl0cyBzdGFydCBhbmQgZW5kIG9mZnNldFxuICAgIHRoaXMuc3RhcnQgPSB0aGlzLmVuZCA9IHRoaXMucG9zO1xuICAgIC8vIEFuZCwgaWYgbG9jYXRpb25zIGFyZSB1c2VkLCB0aGUge2xpbmUsIGNvbHVtbn0gb2JqZWN0XG4gICAgLy8gY29ycmVzcG9uZGluZyB0byB0aG9zZSBvZmZzZXRzXG4gICAgdGhpcy5zdGFydExvYyA9IHRoaXMuZW5kTG9jID0gdGhpcy5jdXJQb3NpdGlvbigpO1xuXG4gICAgLy8gUG9zaXRpb24gaW5mb3JtYXRpb24gZm9yIHRoZSBwcmV2aW91cyB0b2tlblxuICAgIHRoaXMubGFzdFRva0VuZExvYyA9IHRoaXMubGFzdFRva1N0YXJ0TG9jID0gbnVsbDtcbiAgICB0aGlzLmxhc3RUb2tTdGFydCA9IHRoaXMubGFzdFRva0VuZCA9IHRoaXMucG9zO1xuXG4gICAgLy8gVGhlIGNvbnRleHQgc3RhY2sgaXMgdXNlZCB0byBzdXBlcmZpY2lhbGx5IHRyYWNrIHN5bnRhY3RpY1xuICAgIC8vIGNvbnRleHQgdG8gcHJlZGljdCB3aGV0aGVyIGEgcmVndWxhciBleHByZXNzaW9uIGlzIGFsbG93ZWQgaW4gYVxuICAgIC8vIGdpdmVuIHBvc2l0aW9uLlxuICAgIHRoaXMuY29udGV4dCA9IHRoaXMuaW5pdGlhbENvbnRleHQoKTtcbiAgICB0aGlzLmV4cHJBbGxvd2VkID0gdHJ1ZTtcblxuICAgIC8vIEZpZ3VyZSBvdXQgaWYgaXQncyBhIG1vZHVsZSBjb2RlLlxuICAgIHRoaXMuaW5Nb2R1bGUgPSBvcHRpb25zLnNvdXJjZVR5cGUgPT09IFwibW9kdWxlXCI7XG4gICAgdGhpcy5zdHJpY3QgPSB0aGlzLmluTW9kdWxlIHx8IHRoaXMuc3RyaWN0RGlyZWN0aXZlKHRoaXMucG9zKTtcblxuICAgIC8vIFVzZWQgdG8gc2lnbmlmeSB0aGUgc3RhcnQgb2YgYSBwb3RlbnRpYWwgYXJyb3cgZnVuY3Rpb25cbiAgICB0aGlzLnBvdGVudGlhbEFycm93QXQgPSAtMTtcbiAgICB0aGlzLnBvdGVudGlhbEFycm93SW5Gb3JBd2FpdCA9IGZhbHNlO1xuXG4gICAgLy8gUG9zaXRpb25zIHRvIGRlbGF5ZWQtY2hlY2sgdGhhdCB5aWVsZC9hd2FpdCBkb2VzIG5vdCBleGlzdCBpbiBkZWZhdWx0IHBhcmFtZXRlcnMuXG4gICAgdGhpcy55aWVsZFBvcyA9IHRoaXMuYXdhaXRQb3MgPSB0aGlzLmF3YWl0SWRlbnRQb3MgPSAwO1xuICAgIC8vIExhYmVscyBpbiBzY29wZS5cbiAgICB0aGlzLmxhYmVscyA9IFtdO1xuICAgIC8vIFRodXMtZmFyIHVuZGVmaW5lZCBleHBvcnRzLlxuICAgIHRoaXMudW5kZWZpbmVkRXhwb3J0cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBJZiBlbmFibGVkLCBza2lwIGxlYWRpbmcgaGFzaGJhbmcgbGluZS5cbiAgICBpZiAodGhpcy5wb3MgPT09IDAgJiYgb3B0aW9ucy5hbGxvd0hhc2hCYW5nICYmIHRoaXMuaW5wdXQuc2xpY2UoMCwgMikgPT09IFwiIyFcIilcbiAgICAgIHsgdGhpcy5za2lwTGluZUNvbW1lbnQoMik7IH1cblxuICAgIC8vIFNjb3BlIHRyYWNraW5nIGZvciBkdXBsaWNhdGUgdmFyaWFibGUgbmFtZXMgKHNlZSBzY29wZS5qcylcbiAgICB0aGlzLnNjb3BlU3RhY2sgPSBbXTtcbiAgICB0aGlzLmVudGVyU2NvcGUoU0NPUEVfVE9QKTtcblxuICAgIC8vIEZvciBSZWdFeHAgdmFsaWRhdGlvblxuICAgIHRoaXMucmVnZXhwU3RhdGUgPSBudWxsO1xuXG4gICAgLy8gVGhlIHN0YWNrIG9mIHByaXZhdGUgbmFtZXMuXG4gICAgLy8gRWFjaCBlbGVtZW50IGhhcyB0d28gcHJvcGVydGllczogJ2RlY2xhcmVkJyBhbmQgJ3VzZWQnLlxuICAgIC8vIFdoZW4gaXQgZXhpdGVkIGZyb20gdGhlIG91dGVybW9zdCBjbGFzcyBkZWZpbml0aW9uLCBhbGwgdXNlZCBwcml2YXRlIG5hbWVzIG11c3QgYmUgZGVjbGFyZWQuXG4gICAgdGhpcy5wcml2YXRlTmFtZVN0YWNrID0gW107XG4gIH07XG5cbiAgdmFyIHByb3RvdHlwZUFjY2Vzc29ycyA9IHsgaW5GdW5jdGlvbjogeyBjb25maWd1cmFibGU6IHRydWUgfSxpbkdlbmVyYXRvcjogeyBjb25maWd1cmFibGU6IHRydWUgfSxpbkFzeW5jOiB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSB9LGNhbkF3YWl0OiB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSB9LGFsbG93U3VwZXI6IHsgY29uZmlndXJhYmxlOiB0cnVlIH0sYWxsb3dEaXJlY3RTdXBlcjogeyBjb25maWd1cmFibGU6IHRydWUgfSx0cmVhdEZ1bmN0aW9uc0FzVmFyOiB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSB9LGFsbG93TmV3RG90VGFyZ2V0OiB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSB9LGluQ2xhc3NTdGF0aWNCbG9jazogeyBjb25maWd1cmFibGU6IHRydWUgfSB9O1xuXG4gIFBhcnNlci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiBwYXJzZSAoKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLm9wdGlvbnMucHJvZ3JhbSB8fCB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIHRoaXMubmV4dFRva2VuKCk7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VUb3BMZXZlbChub2RlKVxuICB9O1xuXG4gIHByb3RvdHlwZUFjY2Vzc29ycy5pbkZ1bmN0aW9uLmdldCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICh0aGlzLmN1cnJlbnRWYXJTY29wZSgpLmZsYWdzICYgU0NPUEVfRlVOQ1RJT04pID4gMCB9O1xuXG4gIHByb3RvdHlwZUFjY2Vzc29ycy5pbkdlbmVyYXRvci5nZXQgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAodGhpcy5jdXJyZW50VmFyU2NvcGUoKS5mbGFncyAmIFNDT1BFX0dFTkVSQVRPUikgPiAwICYmICF0aGlzLmN1cnJlbnRWYXJTY29wZSgpLmluQ2xhc3NGaWVsZEluaXQgfTtcblxuICBwcm90b3R5cGVBY2Nlc3NvcnMuaW5Bc3luYy5nZXQgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAodGhpcy5jdXJyZW50VmFyU2NvcGUoKS5mbGFncyAmIFNDT1BFX0FTWU5DKSA+IDAgJiYgIXRoaXMuY3VycmVudFZhclNjb3BlKCkuaW5DbGFzc0ZpZWxkSW5pdCB9O1xuXG4gIHByb3RvdHlwZUFjY2Vzc29ycy5jYW5Bd2FpdC5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuc2NvcGVTdGFjay5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdmFyIHNjb3BlID0gdGhpcy5zY29wZVN0YWNrW2ldO1xuICAgICAgaWYgKHNjb3BlLmluQ2xhc3NGaWVsZEluaXQgfHwgc2NvcGUuZmxhZ3MgJiBTQ09QRV9DTEFTU19TVEFUSUNfQkxPQ0spIHsgcmV0dXJuIGZhbHNlIH1cbiAgICAgIGlmIChzY29wZS5mbGFncyAmIFNDT1BFX0ZVTkNUSU9OKSB7IHJldHVybiAoc2NvcGUuZmxhZ3MgJiBTQ09QRV9BU1lOQykgPiAwIH1cbiAgICB9XG4gICAgcmV0dXJuICh0aGlzLmluTW9kdWxlICYmIHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSAxMykgfHwgdGhpcy5vcHRpb25zLmFsbG93QXdhaXRPdXRzaWRlRnVuY3Rpb25cbiAgfTtcblxuICBwcm90b3R5cGVBY2Nlc3NvcnMuYWxsb3dTdXBlci5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlZiA9IHRoaXMuY3VycmVudFRoaXNTY29wZSgpO1xuICAgICAgdmFyIGZsYWdzID0gcmVmLmZsYWdzO1xuICAgICAgdmFyIGluQ2xhc3NGaWVsZEluaXQgPSByZWYuaW5DbGFzc0ZpZWxkSW5pdDtcbiAgICByZXR1cm4gKGZsYWdzICYgU0NPUEVfU1VQRVIpID4gMCB8fCBpbkNsYXNzRmllbGRJbml0IHx8IHRoaXMub3B0aW9ucy5hbGxvd1N1cGVyT3V0c2lkZU1ldGhvZFxuICB9O1xuXG4gIHByb3RvdHlwZUFjY2Vzc29ycy5hbGxvd0RpcmVjdFN1cGVyLmdldCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICh0aGlzLmN1cnJlbnRUaGlzU2NvcGUoKS5mbGFncyAmIFNDT1BFX0RJUkVDVF9TVVBFUikgPiAwIH07XG5cbiAgcHJvdG90eXBlQWNjZXNzb3JzLnRyZWF0RnVuY3Rpb25zQXNWYXIuZ2V0ID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpcy50cmVhdEZ1bmN0aW9uc0FzVmFySW5TY29wZSh0aGlzLmN1cnJlbnRTY29wZSgpKSB9O1xuXG4gIHByb3RvdHlwZUFjY2Vzc29ycy5hbGxvd05ld0RvdFRhcmdldC5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlZiA9IHRoaXMuY3VycmVudFRoaXNTY29wZSgpO1xuICAgICAgdmFyIGZsYWdzID0gcmVmLmZsYWdzO1xuICAgICAgdmFyIGluQ2xhc3NGaWVsZEluaXQgPSByZWYuaW5DbGFzc0ZpZWxkSW5pdDtcbiAgICByZXR1cm4gKGZsYWdzICYgKFNDT1BFX0ZVTkNUSU9OIHwgU0NPUEVfQ0xBU1NfU1RBVElDX0JMT0NLKSkgPiAwIHx8IGluQ2xhc3NGaWVsZEluaXRcbiAgfTtcblxuICBwcm90b3R5cGVBY2Nlc3NvcnMuaW5DbGFzc1N0YXRpY0Jsb2NrLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gKHRoaXMuY3VycmVudFZhclNjb3BlKCkuZmxhZ3MgJiBTQ09QRV9DTEFTU19TVEFUSUNfQkxPQ0spID4gMFxuICB9O1xuXG4gIFBhcnNlci5leHRlbmQgPSBmdW5jdGlvbiBleHRlbmQgKCkge1xuICAgICAgdmFyIHBsdWdpbnMgPSBbXSwgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIHdoaWxlICggbGVuLS0gKSBwbHVnaW5zWyBsZW4gXSA9IGFyZ3VtZW50c1sgbGVuIF07XG5cbiAgICB2YXIgY2xzID0gdGhpcztcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBsdWdpbnMubGVuZ3RoOyBpKyspIHsgY2xzID0gcGx1Z2luc1tpXShjbHMpOyB9XG4gICAgcmV0dXJuIGNsc1xuICB9O1xuXG4gIFBhcnNlci5wYXJzZSA9IGZ1bmN0aW9uIHBhcnNlIChpbnB1dCwgb3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcyhvcHRpb25zLCBpbnB1dCkucGFyc2UoKVxuICB9O1xuXG4gIFBhcnNlci5wYXJzZUV4cHJlc3Npb25BdCA9IGZ1bmN0aW9uIHBhcnNlRXhwcmVzc2lvbkF0IChpbnB1dCwgcG9zLCBvcHRpb25zKSB7XG4gICAgdmFyIHBhcnNlciA9IG5ldyB0aGlzKG9wdGlvbnMsIGlucHV0LCBwb3MpO1xuICAgIHBhcnNlci5uZXh0VG9rZW4oKTtcbiAgICByZXR1cm4gcGFyc2VyLnBhcnNlRXhwcmVzc2lvbigpXG4gIH07XG5cbiAgUGFyc2VyLnRva2VuaXplciA9IGZ1bmN0aW9uIHRva2VuaXplciAoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMob3B0aW9ucywgaW5wdXQpXG4gIH07XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoIFBhcnNlci5wcm90b3R5cGUsIHByb3RvdHlwZUFjY2Vzc29ycyApO1xuXG4gIHZhciBwcCQ5ID0gUGFyc2VyLnByb3RvdHlwZTtcblxuICAvLyAjIyBQYXJzZXIgdXRpbGl0aWVzXG5cbiAgdmFyIGxpdGVyYWwgPSAvXig/OicoKD86XFxcXC58W14nXFxcXF0pKj8pJ3xcIigoPzpcXFxcLnxbXlwiXFxcXF0pKj8pXCIpLztcbiAgcHAkOS5zdHJpY3REaXJlY3RpdmUgPSBmdW5jdGlvbihzdGFydCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPCA1KSB7IHJldHVybiBmYWxzZSB9XG4gICAgZm9yICg7Oykge1xuICAgICAgLy8gVHJ5IHRvIGZpbmQgc3RyaW5nIGxpdGVyYWwuXG4gICAgICBza2lwV2hpdGVTcGFjZS5sYXN0SW5kZXggPSBzdGFydDtcbiAgICAgIHN0YXJ0ICs9IHNraXBXaGl0ZVNwYWNlLmV4ZWModGhpcy5pbnB1dClbMF0ubGVuZ3RoO1xuICAgICAgdmFyIG1hdGNoID0gbGl0ZXJhbC5leGVjKHRoaXMuaW5wdXQuc2xpY2Uoc3RhcnQpKTtcbiAgICAgIGlmICghbWF0Y2gpIHsgcmV0dXJuIGZhbHNlIH1cbiAgICAgIGlmICgobWF0Y2hbMV0gfHwgbWF0Y2hbMl0pID09PSBcInVzZSBzdHJpY3RcIikge1xuICAgICAgICBza2lwV2hpdGVTcGFjZS5sYXN0SW5kZXggPSBzdGFydCArIG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgICAgdmFyIHNwYWNlQWZ0ZXIgPSBza2lwV2hpdGVTcGFjZS5leGVjKHRoaXMuaW5wdXQpLCBlbmQgPSBzcGFjZUFmdGVyLmluZGV4ICsgc3BhY2VBZnRlclswXS5sZW5ndGg7XG4gICAgICAgIHZhciBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQXQoZW5kKTtcbiAgICAgICAgcmV0dXJuIG5leHQgPT09IFwiO1wiIHx8IG5leHQgPT09IFwifVwiIHx8XG4gICAgICAgICAgKGxpbmVCcmVhay50ZXN0KHNwYWNlQWZ0ZXJbMF0pICYmXG4gICAgICAgICAgICEoL1soYC5bK1xcLS8qJTw+PSw/XiZdLy50ZXN0KG5leHQpIHx8IG5leHQgPT09IFwiIVwiICYmIHRoaXMuaW5wdXQuY2hhckF0KGVuZCArIDEpID09PSBcIj1cIikpXG4gICAgICB9XG4gICAgICBzdGFydCArPSBtYXRjaFswXS5sZW5ndGg7XG5cbiAgICAgIC8vIFNraXAgc2VtaWNvbG9uLCBpZiBhbnkuXG4gICAgICBza2lwV2hpdGVTcGFjZS5sYXN0SW5kZXggPSBzdGFydDtcbiAgICAgIHN0YXJ0ICs9IHNraXBXaGl0ZVNwYWNlLmV4ZWModGhpcy5pbnB1dClbMF0ubGVuZ3RoO1xuICAgICAgaWYgKHRoaXMuaW5wdXRbc3RhcnRdID09PSBcIjtcIilcbiAgICAgICAgeyBzdGFydCsrOyB9XG4gICAgfVxuICB9O1xuXG4gIC8vIFByZWRpY2F0ZSB0aGF0IHRlc3RzIHdoZXRoZXIgdGhlIG5leHQgdG9rZW4gaXMgb2YgdGhlIGdpdmVuXG4gIC8vIHR5cGUsIGFuZCBpZiB5ZXMsIGNvbnN1bWVzIGl0IGFzIGEgc2lkZSBlZmZlY3QuXG5cbiAgcHAkOS5lYXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZSkge1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH07XG5cbiAgLy8gVGVzdHMgd2hldGhlciBwYXJzZWQgdG9rZW4gaXMgYSBjb250ZXh0dWFsIGtleXdvcmQuXG5cbiAgcHAkOS5pc0NvbnRleHR1YWwgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5uYW1lICYmIHRoaXMudmFsdWUgPT09IG5hbWUgJiYgIXRoaXMuY29udGFpbnNFc2NcbiAgfTtcblxuICAvLyBDb25zdW1lcyBjb250ZXh0dWFsIGtleXdvcmQgaWYgcG9zc2libGUuXG5cbiAgcHAkOS5lYXRDb250ZXh0dWFsID0gZnVuY3Rpb24obmFtZSkge1xuICAgIGlmICghdGhpcy5pc0NvbnRleHR1YWwobmFtZSkpIHsgcmV0dXJuIGZhbHNlIH1cbiAgICB0aGlzLm5leHQoKTtcbiAgICByZXR1cm4gdHJ1ZVxuICB9O1xuXG4gIC8vIEFzc2VydHMgdGhhdCBmb2xsb3dpbmcgdG9rZW4gaXMgZ2l2ZW4gY29udGV4dHVhbCBrZXl3b3JkLlxuXG4gIHBwJDkuZXhwZWN0Q29udGV4dHVhbCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZiAoIXRoaXMuZWF0Q29udGV4dHVhbChuYW1lKSkgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICB9O1xuXG4gIC8vIFRlc3Qgd2hldGhlciBhIHNlbWljb2xvbiBjYW4gYmUgaW5zZXJ0ZWQgYXQgdGhlIGN1cnJlbnQgcG9zaXRpb24uXG5cbiAgcHAkOS5jYW5JbnNlcnRTZW1pY29sb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSB0eXBlcyQxLmVvZiB8fFxuICAgICAgdGhpcy50eXBlID09PSB0eXBlcyQxLmJyYWNlUiB8fFxuICAgICAgbGluZUJyZWFrLnRlc3QodGhpcy5pbnB1dC5zbGljZSh0aGlzLmxhc3RUb2tFbmQsIHRoaXMuc3RhcnQpKVxuICB9O1xuXG4gIHBwJDkuaW5zZXJ0U2VtaWNvbG9uID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuY2FuSW5zZXJ0U2VtaWNvbG9uKCkpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMub25JbnNlcnRlZFNlbWljb2xvbilcbiAgICAgICAgeyB0aGlzLm9wdGlvbnMub25JbnNlcnRlZFNlbWljb2xvbih0aGlzLmxhc3RUb2tFbmQsIHRoaXMubGFzdFRva0VuZExvYyk7IH1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9O1xuXG4gIC8vIENvbnN1bWUgYSBzZW1pY29sb24sIG9yLCBmYWlsaW5nIHRoYXQsIHNlZSBpZiB3ZSBhcmUgYWxsb3dlZCB0b1xuICAvLyBwcmV0ZW5kIHRoYXQgdGhlcmUgaXMgYSBzZW1pY29sb24gYXQgdGhpcyBwb3NpdGlvbi5cblxuICBwcCQ5LnNlbWljb2xvbiA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5lYXQodHlwZXMkMS5zZW1pKSAmJiAhdGhpcy5pbnNlcnRTZW1pY29sb24oKSkgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICB9O1xuXG4gIHBwJDkuYWZ0ZXJUcmFpbGluZ0NvbW1hID0gZnVuY3Rpb24odG9rVHlwZSwgbm90TmV4dCkge1xuICAgIGlmICh0aGlzLnR5cGUgPT09IHRva1R5cGUpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMub25UcmFpbGluZ0NvbW1hKVxuICAgICAgICB7IHRoaXMub3B0aW9ucy5vblRyYWlsaW5nQ29tbWEodGhpcy5sYXN0VG9rU3RhcnQsIHRoaXMubGFzdFRva1N0YXJ0TG9jKTsgfVxuICAgICAgaWYgKCFub3ROZXh0KVxuICAgICAgICB7IHRoaXMubmV4dCgpOyB9XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfTtcblxuICAvLyBFeHBlY3QgYSB0b2tlbiBvZiBhIGdpdmVuIHR5cGUuIElmIGZvdW5kLCBjb25zdW1lIGl0LCBvdGhlcndpc2UsXG4gIC8vIHJhaXNlIGFuIHVuZXhwZWN0ZWQgdG9rZW4gZXJyb3IuXG5cbiAgcHAkOS5leHBlY3QgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgdGhpcy5lYXQodHlwZSkgfHwgdGhpcy51bmV4cGVjdGVkKCk7XG4gIH07XG5cbiAgLy8gUmFpc2UgYW4gdW5leHBlY3RlZCB0b2tlbiBlcnJvci5cblxuICBwcCQ5LnVuZXhwZWN0ZWQgPSBmdW5jdGlvbihwb3MpIHtcbiAgICB0aGlzLnJhaXNlKHBvcyAhPSBudWxsID8gcG9zIDogdGhpcy5zdGFydCwgXCJVbmV4cGVjdGVkIHRva2VuXCIpO1xuICB9O1xuXG4gIHZhciBEZXN0cnVjdHVyaW5nRXJyb3JzID0gZnVuY3Rpb24gRGVzdHJ1Y3R1cmluZ0Vycm9ycygpIHtcbiAgICB0aGlzLnNob3J0aGFuZEFzc2lnbiA9XG4gICAgdGhpcy50cmFpbGluZ0NvbW1hID1cbiAgICB0aGlzLnBhcmVudGhlc2l6ZWRBc3NpZ24gPVxuICAgIHRoaXMucGFyZW50aGVzaXplZEJpbmQgPVxuICAgIHRoaXMuZG91YmxlUHJvdG8gPVxuICAgICAgLTE7XG4gIH07XG5cbiAgcHAkOS5jaGVja1BhdHRlcm5FcnJvcnMgPSBmdW5jdGlvbihyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCBpc0Fzc2lnbikge1xuICAgIGlmICghcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykgeyByZXR1cm4gfVxuICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnRyYWlsaW5nQ29tbWEgPiAtMSlcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMudHJhaWxpbmdDb21tYSwgXCJDb21tYSBpcyBub3QgcGVybWl0dGVkIGFmdGVyIHRoZSByZXN0IGVsZW1lbnRcIik7IH1cbiAgICB2YXIgcGFyZW5zID0gaXNBc3NpZ24gPyByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRBc3NpZ24gOiByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRCaW5kO1xuICAgIGlmIChwYXJlbnMgPiAtMSkgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUocGFyZW5zLCBpc0Fzc2lnbiA/IFwiQXNzaWduaW5nIHRvIHJ2YWx1ZVwiIDogXCJQYXJlbnRoZXNpemVkIHBhdHRlcm5cIik7IH1cbiAgfTtcblxuICBwcCQ5LmNoZWNrRXhwcmVzc2lvbkVycm9ycyA9IGZ1bmN0aW9uKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIGFuZFRocm93KSB7XG4gICAgaWYgKCFyZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7IHJldHVybiBmYWxzZSB9XG4gICAgdmFyIHNob3J0aGFuZEFzc2lnbiA9IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMuc2hvcnRoYW5kQXNzaWduO1xuICAgIHZhciBkb3VibGVQcm90byA9IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMuZG91YmxlUHJvdG87XG4gICAgaWYgKCFhbmRUaHJvdykgeyByZXR1cm4gc2hvcnRoYW5kQXNzaWduID49IDAgfHwgZG91YmxlUHJvdG8gPj0gMCB9XG4gICAgaWYgKHNob3J0aGFuZEFzc2lnbiA+PSAwKVxuICAgICAgeyB0aGlzLnJhaXNlKHNob3J0aGFuZEFzc2lnbiwgXCJTaG9ydGhhbmQgcHJvcGVydHkgYXNzaWdubWVudHMgYXJlIHZhbGlkIG9ubHkgaW4gZGVzdHJ1Y3R1cmluZyBwYXR0ZXJuc1wiKTsgfVxuICAgIGlmIChkb3VibGVQcm90byA+PSAwKVxuICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoZG91YmxlUHJvdG8sIFwiUmVkZWZpbml0aW9uIG9mIF9fcHJvdG9fXyBwcm9wZXJ0eVwiKTsgfVxuICB9O1xuXG4gIHBwJDkuY2hlY2tZaWVsZEF3YWl0SW5EZWZhdWx0UGFyYW1zID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMueWllbGRQb3MgJiYgKCF0aGlzLmF3YWl0UG9zIHx8IHRoaXMueWllbGRQb3MgPCB0aGlzLmF3YWl0UG9zKSlcbiAgICAgIHsgdGhpcy5yYWlzZSh0aGlzLnlpZWxkUG9zLCBcIllpZWxkIGV4cHJlc3Npb24gY2Fubm90IGJlIGEgZGVmYXVsdCB2YWx1ZVwiKTsgfVxuICAgIGlmICh0aGlzLmF3YWl0UG9zKVxuICAgICAgeyB0aGlzLnJhaXNlKHRoaXMuYXdhaXRQb3MsIFwiQXdhaXQgZXhwcmVzc2lvbiBjYW5ub3QgYmUgYSBkZWZhdWx0IHZhbHVlXCIpOyB9XG4gIH07XG5cbiAgcHAkOS5pc1NpbXBsZUFzc2lnblRhcmdldCA9IGZ1bmN0aW9uKGV4cHIpIHtcbiAgICBpZiAoZXhwci50eXBlID09PSBcIlBhcmVudGhlc2l6ZWRFeHByZXNzaW9uXCIpXG4gICAgICB7IHJldHVybiB0aGlzLmlzU2ltcGxlQXNzaWduVGFyZ2V0KGV4cHIuZXhwcmVzc2lvbikgfVxuICAgIHJldHVybiBleHByLnR5cGUgPT09IFwiSWRlbnRpZmllclwiIHx8IGV4cHIudHlwZSA9PT0gXCJNZW1iZXJFeHByZXNzaW9uXCJcbiAgfTtcblxuICB2YXIgcHAkOCA9IFBhcnNlci5wcm90b3R5cGU7XG5cbiAgLy8gIyMjIFN0YXRlbWVudCBwYXJzaW5nXG5cbiAgLy8gUGFyc2UgYSBwcm9ncmFtLiBJbml0aWFsaXplcyB0aGUgcGFyc2VyLCByZWFkcyBhbnkgbnVtYmVyIG9mXG4gIC8vIHN0YXRlbWVudHMsIGFuZCB3cmFwcyB0aGVtIGluIGEgUHJvZ3JhbSBub2RlLiAgT3B0aW9uYWxseSB0YWtlcyBhXG4gIC8vIGBwcm9ncmFtYCBhcmd1bWVudC4gIElmIHByZXNlbnQsIHRoZSBzdGF0ZW1lbnRzIHdpbGwgYmUgYXBwZW5kZWRcbiAgLy8gdG8gaXRzIGJvZHkgaW5zdGVhZCBvZiBjcmVhdGluZyBhIG5ldyBub2RlLlxuXG4gIHBwJDgucGFyc2VUb3BMZXZlbCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgZXhwb3J0cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgaWYgKCFub2RlLmJvZHkpIHsgbm9kZS5ib2R5ID0gW107IH1cbiAgICB3aGlsZSAodGhpcy50eXBlICE9PSB0eXBlcyQxLmVvZikge1xuICAgICAgdmFyIHN0bXQgPSB0aGlzLnBhcnNlU3RhdGVtZW50KG51bGwsIHRydWUsIGV4cG9ydHMpO1xuICAgICAgbm9kZS5ib2R5LnB1c2goc3RtdCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmluTW9kdWxlKVxuICAgICAgeyBmb3IgKHZhciBpID0gMCwgbGlzdCA9IE9iamVjdC5rZXlzKHRoaXMudW5kZWZpbmVkRXhwb3J0cyk7IGkgPCBsaXN0Lmxlbmd0aDsgaSArPSAxKVxuICAgICAgICB7XG4gICAgICAgICAgdmFyIG5hbWUgPSBsaXN0W2ldO1xuXG4gICAgICAgICAgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMudW5kZWZpbmVkRXhwb3J0c1tuYW1lXS5zdGFydCwgKFwiRXhwb3J0ICdcIiArIG5hbWUgKyBcIicgaXMgbm90IGRlZmluZWRcIikpO1xuICAgICAgICB9IH1cbiAgICB0aGlzLmFkYXB0RGlyZWN0aXZlUHJvbG9ndWUobm9kZS5ib2R5KTtcbiAgICB0aGlzLm5leHQoKTtcbiAgICBub2RlLnNvdXJjZVR5cGUgPSB0aGlzLm9wdGlvbnMuc291cmNlVHlwZTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiUHJvZ3JhbVwiKVxuICB9O1xuXG4gIHZhciBsb29wTGFiZWwgPSB7a2luZDogXCJsb29wXCJ9LCBzd2l0Y2hMYWJlbCA9IHtraW5kOiBcInN3aXRjaFwifTtcblxuICBwcCQ4LmlzTGV0ID0gZnVuY3Rpb24oY29udGV4dCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPCA2IHx8ICF0aGlzLmlzQ29udGV4dHVhbChcImxldFwiKSkgeyByZXR1cm4gZmFsc2UgfVxuICAgIHNraXBXaGl0ZVNwYWNlLmxhc3RJbmRleCA9IHRoaXMucG9zO1xuICAgIHZhciBza2lwID0gc2tpcFdoaXRlU3BhY2UuZXhlYyh0aGlzLmlucHV0KTtcbiAgICB2YXIgbmV4dCA9IHRoaXMucG9zICsgc2tpcFswXS5sZW5ndGgsIG5leHRDaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdChuZXh0KTtcbiAgICAvLyBGb3IgYW1iaWd1b3VzIGNhc2VzLCBkZXRlcm1pbmUgaWYgYSBMZXhpY2FsRGVjbGFyYXRpb24gKG9yIG9ubHkgYVxuICAgIC8vIFN0YXRlbWVudCkgaXMgYWxsb3dlZCBoZXJlLiBJZiBjb250ZXh0IGlzIG5vdCBlbXB0eSB0aGVuIG9ubHkgYSBTdGF0ZW1lbnRcbiAgICAvLyBpcyBhbGxvd2VkLiBIb3dldmVyLCBgbGV0IFtgIGlzIGFuIGV4cGxpY2l0IG5lZ2F0aXZlIGxvb2thaGVhZCBmb3JcbiAgICAvLyBFeHByZXNzaW9uU3RhdGVtZW50LCBzbyBzcGVjaWFsLWNhc2UgaXQgZmlyc3QuXG4gICAgaWYgKG5leHRDaCA9PT0gOTEgfHwgbmV4dENoID09PSA5MikgeyByZXR1cm4gdHJ1ZSB9IC8vICdbJywgJy8nXG4gICAgaWYgKGNvbnRleHQpIHsgcmV0dXJuIGZhbHNlIH1cblxuICAgIGlmIChuZXh0Q2ggPT09IDEyMyB8fCBuZXh0Q2ggPiAweGQ3ZmYgJiYgbmV4dENoIDwgMHhkYzAwKSB7IHJldHVybiB0cnVlIH0gLy8gJ3snLCBhc3RyYWxcbiAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQobmV4dENoLCB0cnVlKSkge1xuICAgICAgdmFyIHBvcyA9IG5leHQgKyAxO1xuICAgICAgd2hpbGUgKGlzSWRlbnRpZmllckNoYXIobmV4dENoID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHBvcyksIHRydWUpKSB7ICsrcG9zOyB9XG4gICAgICBpZiAobmV4dENoID09PSA5MiB8fCBuZXh0Q2ggPiAweGQ3ZmYgJiYgbmV4dENoIDwgMHhkYzAwKSB7IHJldHVybiB0cnVlIH1cbiAgICAgIHZhciBpZGVudCA9IHRoaXMuaW5wdXQuc2xpY2UobmV4dCwgcG9zKTtcbiAgICAgIGlmICgha2V5d29yZFJlbGF0aW9uYWxPcGVyYXRvci50ZXN0KGlkZW50KSkgeyByZXR1cm4gdHJ1ZSB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGNoZWNrICdhc3luYyBbbm8gTGluZVRlcm1pbmF0b3IgaGVyZV0gZnVuY3Rpb24nXG4gIC8vIC0gJ2FzeW5jIC8qZm9vKi8gZnVuY3Rpb24nIGlzIE9LLlxuICAvLyAtICdhc3luYyAvKlxcbiovIGZ1bmN0aW9uJyBpcyBpbnZhbGlkLlxuICBwcCQ4LmlzQXN5bmNGdW5jdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPCA4IHx8ICF0aGlzLmlzQ29udGV4dHVhbChcImFzeW5jXCIpKVxuICAgICAgeyByZXR1cm4gZmFsc2UgfVxuXG4gICAgc2tpcFdoaXRlU3BhY2UubGFzdEluZGV4ID0gdGhpcy5wb3M7XG4gICAgdmFyIHNraXAgPSBza2lwV2hpdGVTcGFjZS5leGVjKHRoaXMuaW5wdXQpO1xuICAgIHZhciBuZXh0ID0gdGhpcy5wb3MgKyBza2lwWzBdLmxlbmd0aCwgYWZ0ZXI7XG4gICAgcmV0dXJuICFsaW5lQnJlYWsudGVzdCh0aGlzLmlucHV0LnNsaWNlKHRoaXMucG9zLCBuZXh0KSkgJiZcbiAgICAgIHRoaXMuaW5wdXQuc2xpY2UobmV4dCwgbmV4dCArIDgpID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgICAgIChuZXh0ICsgOCA9PT0gdGhpcy5pbnB1dC5sZW5ndGggfHxcbiAgICAgICAhKGlzSWRlbnRpZmllckNoYXIoYWZ0ZXIgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQobmV4dCArIDgpKSB8fCBhZnRlciA+IDB4ZDdmZiAmJiBhZnRlciA8IDB4ZGMwMCkpXG4gIH07XG5cbiAgLy8gUGFyc2UgYSBzaW5nbGUgc3RhdGVtZW50LlxuICAvL1xuICAvLyBJZiBleHBlY3RpbmcgYSBzdGF0ZW1lbnQgYW5kIGZpbmRpbmcgYSBzbGFzaCBvcGVyYXRvciwgcGFyc2UgYVxuICAvLyByZWd1bGFyIGV4cHJlc3Npb24gbGl0ZXJhbC4gVGhpcyBpcyB0byBoYW5kbGUgY2FzZXMgbGlrZVxuICAvLyBgaWYgKGZvbykgL2JsYWgvLmV4ZWMoZm9vKWAsIHdoZXJlIGxvb2tpbmcgYXQgdGhlIHByZXZpb3VzIHRva2VuXG4gIC8vIGRvZXMgbm90IGhlbHAuXG5cbiAgcHAkOC5wYXJzZVN0YXRlbWVudCA9IGZ1bmN0aW9uKGNvbnRleHQsIHRvcExldmVsLCBleHBvcnRzKSB7XG4gICAgdmFyIHN0YXJ0dHlwZSA9IHRoaXMudHlwZSwgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCksIGtpbmQ7XG5cbiAgICBpZiAodGhpcy5pc0xldChjb250ZXh0KSkge1xuICAgICAgc3RhcnR0eXBlID0gdHlwZXMkMS5fdmFyO1xuICAgICAga2luZCA9IFwibGV0XCI7XG4gICAgfVxuXG4gICAgLy8gTW9zdCB0eXBlcyBvZiBzdGF0ZW1lbnRzIGFyZSByZWNvZ25pemVkIGJ5IHRoZSBrZXl3b3JkIHRoZXlcbiAgICAvLyBzdGFydCB3aXRoLiBNYW55IGFyZSB0cml2aWFsIHRvIHBhcnNlLCBzb21lIHJlcXVpcmUgYSBiaXQgb2ZcbiAgICAvLyBjb21wbGV4aXR5LlxuXG4gICAgc3dpdGNoIChzdGFydHR5cGUpIHtcbiAgICBjYXNlIHR5cGVzJDEuX2JyZWFrOiBjYXNlIHR5cGVzJDEuX2NvbnRpbnVlOiByZXR1cm4gdGhpcy5wYXJzZUJyZWFrQ29udGludWVTdGF0ZW1lbnQobm9kZSwgc3RhcnR0eXBlLmtleXdvcmQpXG4gICAgY2FzZSB0eXBlcyQxLl9kZWJ1Z2dlcjogcmV0dXJuIHRoaXMucGFyc2VEZWJ1Z2dlclN0YXRlbWVudChub2RlKVxuICAgIGNhc2UgdHlwZXMkMS5fZG86IHJldHVybiB0aGlzLnBhcnNlRG9TdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX2ZvcjogcmV0dXJuIHRoaXMucGFyc2VGb3JTdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX2Z1bmN0aW9uOlxuICAgICAgLy8gRnVuY3Rpb24gYXMgc29sZSBib2R5IG9mIGVpdGhlciBhbiBpZiBzdGF0ZW1lbnQgb3IgYSBsYWJlbGVkIHN0YXRlbWVudFxuICAgICAgLy8gd29ya3MsIGJ1dCBub3Qgd2hlbiBpdCBpcyBwYXJ0IG9mIGEgbGFiZWxlZCBzdGF0ZW1lbnQgdGhhdCBpcyB0aGUgc29sZVxuICAgICAgLy8gYm9keSBvZiBhbiBpZiBzdGF0ZW1lbnQuXG4gICAgICBpZiAoKGNvbnRleHQgJiYgKHRoaXMuc3RyaWN0IHx8IGNvbnRleHQgIT09IFwiaWZcIiAmJiBjb250ZXh0ICE9PSBcImxhYmVsXCIpKSAmJiB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNikgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgICAgcmV0dXJuIHRoaXMucGFyc2VGdW5jdGlvblN0YXRlbWVudChub2RlLCBmYWxzZSwgIWNvbnRleHQpXG4gICAgY2FzZSB0eXBlcyQxLl9jbGFzczpcbiAgICAgIGlmIChjb250ZXh0KSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUNsYXNzKG5vZGUsIHRydWUpXG4gICAgY2FzZSB0eXBlcyQxLl9pZjogcmV0dXJuIHRoaXMucGFyc2VJZlN0YXRlbWVudChub2RlKVxuICAgIGNhc2UgdHlwZXMkMS5fcmV0dXJuOiByZXR1cm4gdGhpcy5wYXJzZVJldHVyblN0YXRlbWVudChub2RlKVxuICAgIGNhc2UgdHlwZXMkMS5fc3dpdGNoOiByZXR1cm4gdGhpcy5wYXJzZVN3aXRjaFN0YXRlbWVudChub2RlKVxuICAgIGNhc2UgdHlwZXMkMS5fdGhyb3c6IHJldHVybiB0aGlzLnBhcnNlVGhyb3dTdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX3RyeTogcmV0dXJuIHRoaXMucGFyc2VUcnlTdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX2NvbnN0OiBjYXNlIHR5cGVzJDEuX3ZhcjpcbiAgICAgIGtpbmQgPSBraW5kIHx8IHRoaXMudmFsdWU7XG4gICAgICBpZiAoY29udGV4dCAmJiBraW5kICE9PSBcInZhclwiKSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZVZhclN0YXRlbWVudChub2RlLCBraW5kKVxuICAgIGNhc2UgdHlwZXMkMS5fd2hpbGU6IHJldHVybiB0aGlzLnBhcnNlV2hpbGVTdGF0ZW1lbnQobm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuX3dpdGg6IHJldHVybiB0aGlzLnBhcnNlV2l0aFN0YXRlbWVudChub2RlKVxuICAgIGNhc2UgdHlwZXMkMS5icmFjZUw6IHJldHVybiB0aGlzLnBhcnNlQmxvY2sodHJ1ZSwgbm9kZSlcbiAgICBjYXNlIHR5cGVzJDEuc2VtaTogcmV0dXJuIHRoaXMucGFyc2VFbXB0eVN0YXRlbWVudChub2RlKVxuICAgIGNhc2UgdHlwZXMkMS5fZXhwb3J0OlxuICAgIGNhc2UgdHlwZXMkMS5faW1wb3J0OlxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+IDEwICYmIHN0YXJ0dHlwZSA9PT0gdHlwZXMkMS5faW1wb3J0KSB7XG4gICAgICAgIHNraXBXaGl0ZVNwYWNlLmxhc3RJbmRleCA9IHRoaXMucG9zO1xuICAgICAgICB2YXIgc2tpcCA9IHNraXBXaGl0ZVNwYWNlLmV4ZWModGhpcy5pbnB1dCk7XG4gICAgICAgIHZhciBuZXh0ID0gdGhpcy5wb3MgKyBza2lwWzBdLmxlbmd0aCwgbmV4dENoID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KG5leHQpO1xuICAgICAgICBpZiAobmV4dENoID09PSA0MCB8fCBuZXh0Q2ggPT09IDQ2KSAvLyAnKCcgb3IgJy4nXG4gICAgICAgICAgeyByZXR1cm4gdGhpcy5wYXJzZUV4cHJlc3Npb25TdGF0ZW1lbnQobm9kZSwgdGhpcy5wYXJzZUV4cHJlc3Npb24oKSkgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMub3B0aW9ucy5hbGxvd0ltcG9ydEV4cG9ydEV2ZXJ5d2hlcmUpIHtcbiAgICAgICAgaWYgKCF0b3BMZXZlbClcbiAgICAgICAgICB7IHRoaXMucmFpc2UodGhpcy5zdGFydCwgXCInaW1wb3J0JyBhbmQgJ2V4cG9ydCcgbWF5IG9ubHkgYXBwZWFyIGF0IHRoZSB0b3AgbGV2ZWxcIik7IH1cbiAgICAgICAgaWYgKCF0aGlzLmluTW9kdWxlKVxuICAgICAgICAgIHsgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCBcIidpbXBvcnQnIGFuZCAnZXhwb3J0JyBtYXkgYXBwZWFyIG9ubHkgd2l0aCAnc291cmNlVHlwZTogbW9kdWxlJ1wiKTsgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXJ0dHlwZSA9PT0gdHlwZXMkMS5faW1wb3J0ID8gdGhpcy5wYXJzZUltcG9ydChub2RlKSA6IHRoaXMucGFyc2VFeHBvcnQobm9kZSwgZXhwb3J0cylcblxuICAgICAgLy8gSWYgdGhlIHN0YXRlbWVudCBkb2VzIG5vdCBzdGFydCB3aXRoIGEgc3RhdGVtZW50IGtleXdvcmQgb3IgYVxuICAgICAgLy8gYnJhY2UsIGl0J3MgYW4gRXhwcmVzc2lvblN0YXRlbWVudCBvciBMYWJlbGVkU3RhdGVtZW50LiBXZVxuICAgICAgLy8gc2ltcGx5IHN0YXJ0IHBhcnNpbmcgYW4gZXhwcmVzc2lvbiwgYW5kIGFmdGVyd2FyZHMsIGlmIHRoZVxuICAgICAgLy8gbmV4dCB0b2tlbiBpcyBhIGNvbG9uIGFuZCB0aGUgZXhwcmVzc2lvbiB3YXMgYSBzaW1wbGVcbiAgICAgIC8vIElkZW50aWZpZXIgbm9kZSwgd2Ugc3dpdGNoIHRvIGludGVycHJldGluZyBpdCBhcyBhIGxhYmVsLlxuICAgIGRlZmF1bHQ6XG4gICAgICBpZiAodGhpcy5pc0FzeW5jRnVuY3Rpb24oKSkge1xuICAgICAgICBpZiAoY29udGV4dCkgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgICAgICB0aGlzLm5leHQoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VGdW5jdGlvblN0YXRlbWVudChub2RlLCB0cnVlLCAhY29udGV4dClcbiAgICAgIH1cblxuICAgICAgdmFyIG1heWJlTmFtZSA9IHRoaXMudmFsdWUsIGV4cHIgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHN0YXJ0dHlwZSA9PT0gdHlwZXMkMS5uYW1lICYmIGV4cHIudHlwZSA9PT0gXCJJZGVudGlmaWVyXCIgJiYgdGhpcy5lYXQodHlwZXMkMS5jb2xvbikpXG4gICAgICAgIHsgcmV0dXJuIHRoaXMucGFyc2VMYWJlbGVkU3RhdGVtZW50KG5vZGUsIG1heWJlTmFtZSwgZXhwciwgY29udGV4dCkgfVxuICAgICAgZWxzZSB7IHJldHVybiB0aGlzLnBhcnNlRXhwcmVzc2lvblN0YXRlbWVudChub2RlLCBleHByKSB9XG4gICAgfVxuICB9O1xuXG4gIHBwJDgucGFyc2VCcmVha0NvbnRpbnVlU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSwga2V5d29yZCkge1xuICAgIHZhciBpc0JyZWFrID0ga2V5d29yZCA9PT0gXCJicmVha1wiO1xuICAgIHRoaXMubmV4dCgpO1xuICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLnNlbWkpIHx8IHRoaXMuaW5zZXJ0U2VtaWNvbG9uKCkpIHsgbm9kZS5sYWJlbCA9IG51bGw7IH1cbiAgICBlbHNlIGlmICh0aGlzLnR5cGUgIT09IHR5cGVzJDEubmFtZSkgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgIGVsc2Uge1xuICAgICAgbm9kZS5sYWJlbCA9IHRoaXMucGFyc2VJZGVudCgpO1xuICAgICAgdGhpcy5zZW1pY29sb24oKTtcbiAgICB9XG5cbiAgICAvLyBWZXJpZnkgdGhhdCB0aGVyZSBpcyBhbiBhY3R1YWwgZGVzdGluYXRpb24gdG8gYnJlYWsgb3JcbiAgICAvLyBjb250aW51ZSB0by5cbiAgICB2YXIgaSA9IDA7XG4gICAgZm9yICg7IGkgPCB0aGlzLmxhYmVscy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGxhYiA9IHRoaXMubGFiZWxzW2ldO1xuICAgICAgaWYgKG5vZGUubGFiZWwgPT0gbnVsbCB8fCBsYWIubmFtZSA9PT0gbm9kZS5sYWJlbC5uYW1lKSB7XG4gICAgICAgIGlmIChsYWIua2luZCAhPSBudWxsICYmIChpc0JyZWFrIHx8IGxhYi5raW5kID09PSBcImxvb3BcIikpIHsgYnJlYWsgfVxuICAgICAgICBpZiAobm9kZS5sYWJlbCAmJiBpc0JyZWFrKSB7IGJyZWFrIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGkgPT09IHRoaXMubGFiZWxzLmxlbmd0aCkgeyB0aGlzLnJhaXNlKG5vZGUuc3RhcnQsIFwiVW5zeW50YWN0aWMgXCIgKyBrZXl3b3JkKTsgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgaXNCcmVhayA/IFwiQnJlYWtTdGF0ZW1lbnRcIiA6IFwiQ29udGludWVTdGF0ZW1lbnRcIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlRGVidWdnZXJTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgdGhpcy5zZW1pY29sb24oKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiRGVidWdnZXJTdGF0ZW1lbnRcIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlRG9TdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgdGhpcy5sYWJlbHMucHVzaChsb29wTGFiZWwpO1xuICAgIG5vZGUuYm9keSA9IHRoaXMucGFyc2VTdGF0ZW1lbnQoXCJkb1wiKTtcbiAgICB0aGlzLmxhYmVscy5wb3AoKTtcbiAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLl93aGlsZSk7XG4gICAgbm9kZS50ZXN0ID0gdGhpcy5wYXJzZVBhcmVuRXhwcmVzc2lvbigpO1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNilcbiAgICAgIHsgdGhpcy5lYXQodHlwZXMkMS5zZW1pKTsgfVxuICAgIGVsc2VcbiAgICAgIHsgdGhpcy5zZW1pY29sb24oKTsgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJEb1doaWxlU3RhdGVtZW50XCIpXG4gIH07XG5cbiAgLy8gRGlzYW1iaWd1YXRpbmcgYmV0d2VlbiBhIGBmb3JgIGFuZCBhIGBmb3JgL2BpbmAgb3IgYGZvcmAvYG9mYFxuICAvLyBsb29wIGlzIG5vbi10cml2aWFsLiBCYXNpY2FsbHksIHdlIGhhdmUgdG8gcGFyc2UgdGhlIGluaXQgYHZhcmBcbiAgLy8gc3RhdGVtZW50IG9yIGV4cHJlc3Npb24sIGRpc2FsbG93aW5nIHRoZSBgaW5gIG9wZXJhdG9yIChzZWVcbiAgLy8gdGhlIHNlY29uZCBwYXJhbWV0ZXIgdG8gYHBhcnNlRXhwcmVzc2lvbmApLCBhbmQgdGhlbiBjaGVja1xuICAvLyB3aGV0aGVyIHRoZSBuZXh0IHRva2VuIGlzIGBpbmAgb3IgYG9mYC4gV2hlbiB0aGVyZSBpcyBubyBpbml0XG4gIC8vIHBhcnQgKHNlbWljb2xvbiBpbW1lZGlhdGVseSBhZnRlciB0aGUgb3BlbmluZyBwYXJlbnRoZXNpcyksIGl0XG4gIC8vIGlzIGEgcmVndWxhciBgZm9yYCBsb29wLlxuXG4gIHBwJDgucGFyc2VGb3JTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgdmFyIGF3YWl0QXQgPSAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkgJiYgdGhpcy5jYW5Bd2FpdCAmJiB0aGlzLmVhdENvbnRleHR1YWwoXCJhd2FpdFwiKSkgPyB0aGlzLmxhc3RUb2tTdGFydCA6IC0xO1xuICAgIHRoaXMubGFiZWxzLnB1c2gobG9vcExhYmVsKTtcbiAgICB0aGlzLmVudGVyU2NvcGUoMCk7XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5wYXJlbkwpO1xuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuc2VtaSkge1xuICAgICAgaWYgKGF3YWl0QXQgPiAtMSkgeyB0aGlzLnVuZXhwZWN0ZWQoYXdhaXRBdCk7IH1cbiAgICAgIHJldHVybiB0aGlzLnBhcnNlRm9yKG5vZGUsIG51bGwpXG4gICAgfVxuICAgIHZhciBpc0xldCA9IHRoaXMuaXNMZXQoKTtcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLl92YXIgfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLl9jb25zdCB8fCBpc0xldCkge1xuICAgICAgdmFyIGluaXQkMSA9IHRoaXMuc3RhcnROb2RlKCksIGtpbmQgPSBpc0xldCA/IFwibGV0XCIgOiB0aGlzLnZhbHVlO1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICB0aGlzLnBhcnNlVmFyKGluaXQkMSwgdHJ1ZSwga2luZCk7XG4gICAgICB0aGlzLmZpbmlzaE5vZGUoaW5pdCQxLCBcIlZhcmlhYmxlRGVjbGFyYXRpb25cIik7XG4gICAgICBpZiAoKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5faW4gfHwgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ICYmIHRoaXMuaXNDb250ZXh0dWFsKFwib2ZcIikpKSAmJiBpbml0JDEuZGVjbGFyYXRpb25zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkpIHtcbiAgICAgICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLl9pbikge1xuICAgICAgICAgICAgaWYgKGF3YWl0QXQgPiAtMSkgeyB0aGlzLnVuZXhwZWN0ZWQoYXdhaXRBdCk7IH1cbiAgICAgICAgICB9IGVsc2UgeyBub2RlLmF3YWl0ID0gYXdhaXRBdCA+IC0xOyB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VGb3JJbihub2RlLCBpbml0JDEpXG4gICAgICB9XG4gICAgICBpZiAoYXdhaXRBdCA+IC0xKSB7IHRoaXMudW5leHBlY3RlZChhd2FpdEF0KTsgfVxuICAgICAgcmV0dXJuIHRoaXMucGFyc2VGb3Iobm9kZSwgaW5pdCQxKVxuICAgIH1cbiAgICB2YXIgc3RhcnRzV2l0aExldCA9IHRoaXMuaXNDb250ZXh0dWFsKFwibGV0XCIpLCBpc0Zvck9mID0gZmFsc2U7XG4gICAgdmFyIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMgPSBuZXcgRGVzdHJ1Y3R1cmluZ0Vycm9ycztcbiAgICB2YXIgaW5pdCA9IHRoaXMucGFyc2VFeHByZXNzaW9uKGF3YWl0QXQgPiAtMSA/IFwiYXdhaXRcIiA6IHRydWUsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpO1xuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuX2luIHx8IChpc0Zvck9mID0gdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYgJiYgdGhpcy5pc0NvbnRleHR1YWwoXCJvZlwiKSkpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOSkge1xuICAgICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLl9pbikge1xuICAgICAgICAgIGlmIChhd2FpdEF0ID4gLTEpIHsgdGhpcy51bmV4cGVjdGVkKGF3YWl0QXQpOyB9XG4gICAgICAgIH0gZWxzZSB7IG5vZGUuYXdhaXQgPSBhd2FpdEF0ID4gLTE7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzdGFydHNXaXRoTGV0ICYmIGlzRm9yT2YpIHsgdGhpcy5yYWlzZShpbml0LnN0YXJ0LCBcIlRoZSBsZWZ0LWhhbmQgc2lkZSBvZiBhIGZvci1vZiBsb29wIG1heSBub3Qgc3RhcnQgd2l0aCAnbGV0Jy5cIik7IH1cbiAgICAgIHRoaXMudG9Bc3NpZ25hYmxlKGluaXQsIGZhbHNlLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTtcbiAgICAgIHRoaXMuY2hlY2tMVmFsUGF0dGVybihpbml0KTtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlRm9ySW4obm9kZSwgaW5pdClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jaGVja0V4cHJlc3Npb25FcnJvcnMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgdHJ1ZSk7XG4gICAgfVxuICAgIGlmIChhd2FpdEF0ID4gLTEpIHsgdGhpcy51bmV4cGVjdGVkKGF3YWl0QXQpOyB9XG4gICAgcmV0dXJuIHRoaXMucGFyc2VGb3Iobm9kZSwgaW5pdClcbiAgfTtcblxuICBwcCQ4LnBhcnNlRnVuY3Rpb25TdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlLCBpc0FzeW5jLCBkZWNsYXJhdGlvblBvc2l0aW9uKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VGdW5jdGlvbihub2RlLCBGVU5DX1NUQVRFTUVOVCB8IChkZWNsYXJhdGlvblBvc2l0aW9uID8gMCA6IEZVTkNfSEFOR0lOR19TVEFURU1FTlQpLCBmYWxzZSwgaXNBc3luYylcbiAgfTtcblxuICBwcCQ4LnBhcnNlSWZTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgbm9kZS50ZXN0ID0gdGhpcy5wYXJzZVBhcmVuRXhwcmVzc2lvbigpO1xuICAgIC8vIGFsbG93IGZ1bmN0aW9uIGRlY2xhcmF0aW9ucyBpbiBicmFuY2hlcywgYnV0IG9ubHkgaW4gbm9uLXN0cmljdCBtb2RlXG4gICAgbm9kZS5jb25zZXF1ZW50ID0gdGhpcy5wYXJzZVN0YXRlbWVudChcImlmXCIpO1xuICAgIG5vZGUuYWx0ZXJuYXRlID0gdGhpcy5lYXQodHlwZXMkMS5fZWxzZSkgPyB0aGlzLnBhcnNlU3RhdGVtZW50KFwiaWZcIikgOiBudWxsO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJJZlN0YXRlbWVudFwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VSZXR1cm5TdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgaWYgKCF0aGlzLmluRnVuY3Rpb24gJiYgIXRoaXMub3B0aW9ucy5hbGxvd1JldHVybk91dHNpZGVGdW5jdGlvbilcbiAgICAgIHsgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCBcIidyZXR1cm4nIG91dHNpZGUgb2YgZnVuY3Rpb25cIik7IH1cbiAgICB0aGlzLm5leHQoKTtcblxuICAgIC8vIEluIGByZXR1cm5gIChhbmQgYGJyZWFrYC9gY29udGludWVgKSwgdGhlIGtleXdvcmRzIHdpdGhcbiAgICAvLyBvcHRpb25hbCBhcmd1bWVudHMsIHdlIGVhZ2VybHkgbG9vayBmb3IgYSBzZW1pY29sb24gb3IgdGhlXG4gICAgLy8gcG9zc2liaWxpdHkgdG8gaW5zZXJ0IG9uZS5cblxuICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLnNlbWkpIHx8IHRoaXMuaW5zZXJ0U2VtaWNvbG9uKCkpIHsgbm9kZS5hcmd1bWVudCA9IG51bGw7IH1cbiAgICBlbHNlIHsgbm9kZS5hcmd1bWVudCA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7IHRoaXMuc2VtaWNvbG9uKCk7IH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiUmV0dXJuU3RhdGVtZW50XCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZVN3aXRjaFN0YXRlbWVudCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB0aGlzLm5leHQoKTtcbiAgICBub2RlLmRpc2NyaW1pbmFudCA9IHRoaXMucGFyc2VQYXJlbkV4cHJlc3Npb24oKTtcbiAgICBub2RlLmNhc2VzID0gW107XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5icmFjZUwpO1xuICAgIHRoaXMubGFiZWxzLnB1c2goc3dpdGNoTGFiZWwpO1xuICAgIHRoaXMuZW50ZXJTY29wZSgwKTtcblxuICAgIC8vIFN0YXRlbWVudHMgdW5kZXIgbXVzdCBiZSBncm91cGVkIChieSBsYWJlbCkgaW4gU3dpdGNoQ2FzZVxuICAgIC8vIG5vZGVzLiBgY3VyYCBpcyB1c2VkIHRvIGtlZXAgdGhlIG5vZGUgdGhhdCB3ZSBhcmUgY3VycmVudGx5XG4gICAgLy8gYWRkaW5nIHN0YXRlbWVudHMgdG8uXG5cbiAgICB2YXIgY3VyO1xuICAgIGZvciAodmFyIHNhd0RlZmF1bHQgPSBmYWxzZTsgdGhpcy50eXBlICE9PSB0eXBlcyQxLmJyYWNlUjspIHtcbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuX2Nhc2UgfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLl9kZWZhdWx0KSB7XG4gICAgICAgIHZhciBpc0Nhc2UgPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEuX2Nhc2U7XG4gICAgICAgIGlmIChjdXIpIHsgdGhpcy5maW5pc2hOb2RlKGN1ciwgXCJTd2l0Y2hDYXNlXCIpOyB9XG4gICAgICAgIG5vZGUuY2FzZXMucHVzaChjdXIgPSB0aGlzLnN0YXJ0Tm9kZSgpKTtcbiAgICAgICAgY3VyLmNvbnNlcXVlbnQgPSBbXTtcbiAgICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICAgIGlmIChpc0Nhc2UpIHtcbiAgICAgICAgICBjdXIudGVzdCA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHNhd0RlZmF1bHQpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMubGFzdFRva1N0YXJ0LCBcIk11bHRpcGxlIGRlZmF1bHQgY2xhdXNlc1wiKTsgfVxuICAgICAgICAgIHNhd0RlZmF1bHQgPSB0cnVlO1xuICAgICAgICAgIGN1ci50ZXN0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmNvbG9uKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghY3VyKSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICAgIGN1ci5jb25zZXF1ZW50LnB1c2godGhpcy5wYXJzZVN0YXRlbWVudChudWxsKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuZXhpdFNjb3BlKCk7XG4gICAgaWYgKGN1cikgeyB0aGlzLmZpbmlzaE5vZGUoY3VyLCBcIlN3aXRjaENhc2VcIik7IH1cbiAgICB0aGlzLm5leHQoKTsgLy8gQ2xvc2luZyBicmFjZVxuICAgIHRoaXMubGFiZWxzLnBvcCgpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJTd2l0Y2hTdGF0ZW1lbnRcIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlVGhyb3dTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgaWYgKGxpbmVCcmVhay50ZXN0KHRoaXMuaW5wdXQuc2xpY2UodGhpcy5sYXN0VG9rRW5kLCB0aGlzLnN0YXJ0KSkpXG4gICAgICB7IHRoaXMucmFpc2UodGhpcy5sYXN0VG9rRW5kLCBcIklsbGVnYWwgbmV3bGluZSBhZnRlciB0aHJvd1wiKTsgfVxuICAgIG5vZGUuYXJndW1lbnQgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgIHRoaXMuc2VtaWNvbG9uKCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlRocm93U3RhdGVtZW50XCIpXG4gIH07XG5cbiAgLy8gUmV1c2VkIGVtcHR5IGFycmF5IGFkZGVkIGZvciBub2RlIGZpZWxkcyB0aGF0IGFyZSBhbHdheXMgZW1wdHkuXG5cbiAgdmFyIGVtcHR5JDEgPSBbXTtcblxuICBwcCQ4LnBhcnNlQ2F0Y2hDbGF1c2VQYXJhbSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBwYXJhbSA9IHRoaXMucGFyc2VCaW5kaW5nQXRvbSgpO1xuICAgIHZhciBzaW1wbGUgPSBwYXJhbS50eXBlID09PSBcIklkZW50aWZpZXJcIjtcbiAgICB0aGlzLmVudGVyU2NvcGUoc2ltcGxlID8gU0NPUEVfU0lNUExFX0NBVENIIDogMCk7XG4gICAgdGhpcy5jaGVja0xWYWxQYXR0ZXJuKHBhcmFtLCBzaW1wbGUgPyBCSU5EX1NJTVBMRV9DQVRDSCA6IEJJTkRfTEVYSUNBTCk7XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5wYXJlblIpO1xuXG4gICAgcmV0dXJuIHBhcmFtXG4gIH07XG5cbiAgcHAkOC5wYXJzZVRyeVN0YXRlbWVudCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB0aGlzLm5leHQoKTtcbiAgICBub2RlLmJsb2NrID0gdGhpcy5wYXJzZUJsb2NrKCk7XG4gICAgbm9kZS5oYW5kbGVyID0gbnVsbDtcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLl9jYXRjaCkge1xuICAgICAgdmFyIGNsYXVzZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgICB0aGlzLm5leHQoKTtcbiAgICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLnBhcmVuTCkpIHtcbiAgICAgICAgY2xhdXNlLnBhcmFtID0gdGhpcy5wYXJzZUNhdGNoQ2xhdXNlUGFyYW0oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPCAxMCkgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgICAgICBjbGF1c2UucGFyYW0gPSBudWxsO1xuICAgICAgICB0aGlzLmVudGVyU2NvcGUoMCk7XG4gICAgICB9XG4gICAgICBjbGF1c2UuYm9keSA9IHRoaXMucGFyc2VCbG9jayhmYWxzZSk7XG4gICAgICB0aGlzLmV4aXRTY29wZSgpO1xuICAgICAgbm9kZS5oYW5kbGVyID0gdGhpcy5maW5pc2hOb2RlKGNsYXVzZSwgXCJDYXRjaENsYXVzZVwiKTtcbiAgICB9XG4gICAgbm9kZS5maW5hbGl6ZXIgPSB0aGlzLmVhdCh0eXBlcyQxLl9maW5hbGx5KSA/IHRoaXMucGFyc2VCbG9jaygpIDogbnVsbDtcbiAgICBpZiAoIW5vZGUuaGFuZGxlciAmJiAhbm9kZS5maW5hbGl6ZXIpXG4gICAgICB7IHRoaXMucmFpc2Uobm9kZS5zdGFydCwgXCJNaXNzaW5nIGNhdGNoIG9yIGZpbmFsbHkgY2xhdXNlXCIpOyB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlRyeVN0YXRlbWVudFwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VWYXJTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlLCBraW5kLCBhbGxvd01pc3NpbmdJbml0aWFsaXplcikge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIHRoaXMucGFyc2VWYXIobm9kZSwgZmFsc2UsIGtpbmQsIGFsbG93TWlzc2luZ0luaXRpYWxpemVyKTtcbiAgICB0aGlzLnNlbWljb2xvbigpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJWYXJpYWJsZURlY2xhcmF0aW9uXCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZVdoaWxlU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpO1xuICAgIG5vZGUudGVzdCA9IHRoaXMucGFyc2VQYXJlbkV4cHJlc3Npb24oKTtcbiAgICB0aGlzLmxhYmVscy5wdXNoKGxvb3BMYWJlbCk7XG4gICAgbm9kZS5ib2R5ID0gdGhpcy5wYXJzZVN0YXRlbWVudChcIndoaWxlXCIpO1xuICAgIHRoaXMubGFiZWxzLnBvcCgpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJXaGlsZVN0YXRlbWVudFwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VXaXRoU3RhdGVtZW50ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIGlmICh0aGlzLnN0cmljdCkgeyB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsIFwiJ3dpdGgnIGluIHN0cmljdCBtb2RlXCIpOyB9XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgbm9kZS5vYmplY3QgPSB0aGlzLnBhcnNlUGFyZW5FeHByZXNzaW9uKCk7XG4gICAgbm9kZS5ib2R5ID0gdGhpcy5wYXJzZVN0YXRlbWVudChcIndpdGhcIik7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIldpdGhTdGF0ZW1lbnRcIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlRW1wdHlTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkVtcHR5U3RhdGVtZW50XCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUxhYmVsZWRTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlLCBtYXliZU5hbWUsIGV4cHIsIGNvbnRleHQpIHtcbiAgICBmb3IgKHZhciBpJDEgPSAwLCBsaXN0ID0gdGhpcy5sYWJlbHM7IGkkMSA8IGxpc3QubGVuZ3RoOyBpJDEgKz0gMSlcbiAgICAgIHtcbiAgICAgIHZhciBsYWJlbCA9IGxpc3RbaSQxXTtcblxuICAgICAgaWYgKGxhYmVsLm5hbWUgPT09IG1heWJlTmFtZSlcbiAgICAgICAgeyB0aGlzLnJhaXNlKGV4cHIuc3RhcnQsIFwiTGFiZWwgJ1wiICsgbWF5YmVOYW1lICsgXCInIGlzIGFscmVhZHkgZGVjbGFyZWRcIik7XG4gICAgfSB9XG4gICAgdmFyIGtpbmQgPSB0aGlzLnR5cGUuaXNMb29wID8gXCJsb29wXCIgOiB0aGlzLnR5cGUgPT09IHR5cGVzJDEuX3N3aXRjaCA/IFwic3dpdGNoXCIgOiBudWxsO1xuICAgIGZvciAodmFyIGkgPSB0aGlzLmxhYmVscy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdmFyIGxhYmVsJDEgPSB0aGlzLmxhYmVsc1tpXTtcbiAgICAgIGlmIChsYWJlbCQxLnN0YXRlbWVudFN0YXJ0ID09PSBub2RlLnN0YXJ0KSB7XG4gICAgICAgIC8vIFVwZGF0ZSBpbmZvcm1hdGlvbiBhYm91dCBwcmV2aW91cyBsYWJlbHMgb24gdGhpcyBub2RlXG4gICAgICAgIGxhYmVsJDEuc3RhdGVtZW50U3RhcnQgPSB0aGlzLnN0YXJ0O1xuICAgICAgICBsYWJlbCQxLmtpbmQgPSBraW5kO1xuICAgICAgfSBlbHNlIHsgYnJlYWsgfVxuICAgIH1cbiAgICB0aGlzLmxhYmVscy5wdXNoKHtuYW1lOiBtYXliZU5hbWUsIGtpbmQ6IGtpbmQsIHN0YXRlbWVudFN0YXJ0OiB0aGlzLnN0YXJ0fSk7XG4gICAgbm9kZS5ib2R5ID0gdGhpcy5wYXJzZVN0YXRlbWVudChjb250ZXh0ID8gY29udGV4dC5pbmRleE9mKFwibGFiZWxcIikgPT09IC0xID8gY29udGV4dCArIFwibGFiZWxcIiA6IGNvbnRleHQgOiBcImxhYmVsXCIpO1xuICAgIHRoaXMubGFiZWxzLnBvcCgpO1xuICAgIG5vZGUubGFiZWwgPSBleHByO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJMYWJlbGVkU3RhdGVtZW50XCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUV4cHJlc3Npb25TdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlLCBleHByKSB7XG4gICAgbm9kZS5leHByZXNzaW9uID0gZXhwcjtcbiAgICB0aGlzLnNlbWljb2xvbigpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJFeHByZXNzaW9uU3RhdGVtZW50XCIpXG4gIH07XG5cbiAgLy8gUGFyc2UgYSBzZW1pY29sb24tZW5jbG9zZWQgYmxvY2sgb2Ygc3RhdGVtZW50cywgaGFuZGxpbmcgYFwidXNlXG4gIC8vIHN0cmljdFwiYCBkZWNsYXJhdGlvbnMgd2hlbiBgYWxsb3dTdHJpY3RgIGlzIHRydWUgKHVzZWQgZm9yXG4gIC8vIGZ1bmN0aW9uIGJvZGllcykuXG5cbiAgcHAkOC5wYXJzZUJsb2NrID0gZnVuY3Rpb24oY3JlYXRlTmV3TGV4aWNhbFNjb3BlLCBub2RlLCBleGl0U3RyaWN0KSB7XG4gICAgaWYgKCBjcmVhdGVOZXdMZXhpY2FsU2NvcGUgPT09IHZvaWQgMCApIGNyZWF0ZU5ld0xleGljYWxTY29wZSA9IHRydWU7XG4gICAgaWYgKCBub2RlID09PSB2b2lkIDAgKSBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcblxuICAgIG5vZGUuYm9keSA9IFtdO1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuYnJhY2VMKTtcbiAgICBpZiAoY3JlYXRlTmV3TGV4aWNhbFNjb3BlKSB7IHRoaXMuZW50ZXJTY29wZSgwKTsgfVxuICAgIHdoaWxlICh0aGlzLnR5cGUgIT09IHR5cGVzJDEuYnJhY2VSKSB7XG4gICAgICB2YXIgc3RtdCA9IHRoaXMucGFyc2VTdGF0ZW1lbnQobnVsbCk7XG4gICAgICBub2RlLmJvZHkucHVzaChzdG10KTtcbiAgICB9XG4gICAgaWYgKGV4aXRTdHJpY3QpIHsgdGhpcy5zdHJpY3QgPSBmYWxzZTsgfVxuICAgIHRoaXMubmV4dCgpO1xuICAgIGlmIChjcmVhdGVOZXdMZXhpY2FsU2NvcGUpIHsgdGhpcy5leGl0U2NvcGUoKTsgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJCbG9ja1N0YXRlbWVudFwiKVxuICB9O1xuXG4gIC8vIFBhcnNlIGEgcmVndWxhciBgZm9yYCBsb29wLiBUaGUgZGlzYW1iaWd1YXRpb24gY29kZSBpblxuICAvLyBgcGFyc2VTdGF0ZW1lbnRgIHdpbGwgYWxyZWFkeSBoYXZlIHBhcnNlZCB0aGUgaW5pdCBzdGF0ZW1lbnQgb3JcbiAgLy8gZXhwcmVzc2lvbi5cblxuICBwcCQ4LnBhcnNlRm9yID0gZnVuY3Rpb24obm9kZSwgaW5pdCkge1xuICAgIG5vZGUuaW5pdCA9IGluaXQ7XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5zZW1pKTtcbiAgICBub2RlLnRlc3QgPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEuc2VtaSA/IG51bGwgOiB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuc2VtaSk7XG4gICAgbm9kZS51cGRhdGUgPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEucGFyZW5SID8gbnVsbCA6IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5wYXJlblIpO1xuICAgIG5vZGUuYm9keSA9IHRoaXMucGFyc2VTdGF0ZW1lbnQoXCJmb3JcIik7XG4gICAgdGhpcy5leGl0U2NvcGUoKTtcbiAgICB0aGlzLmxhYmVscy5wb3AoKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiRm9yU3RhdGVtZW50XCIpXG4gIH07XG5cbiAgLy8gUGFyc2UgYSBgZm9yYC9gaW5gIGFuZCBgZm9yYC9gb2ZgIGxvb3AsIHdoaWNoIGFyZSBhbG1vc3RcbiAgLy8gc2FtZSBmcm9tIHBhcnNlcidzIHBlcnNwZWN0aXZlLlxuXG4gIHBwJDgucGFyc2VGb3JJbiA9IGZ1bmN0aW9uKG5vZGUsIGluaXQpIHtcbiAgICB2YXIgaXNGb3JJbiA9IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5faW47XG4gICAgdGhpcy5uZXh0KCk7XG5cbiAgICBpZiAoXG4gICAgICBpbml0LnR5cGUgPT09IFwiVmFyaWFibGVEZWNsYXJhdGlvblwiICYmXG4gICAgICBpbml0LmRlY2xhcmF0aW9uc1swXS5pbml0ICE9IG51bGwgJiZcbiAgICAgIChcbiAgICAgICAgIWlzRm9ySW4gfHxcbiAgICAgICAgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uIDwgOCB8fFxuICAgICAgICB0aGlzLnN0cmljdCB8fFxuICAgICAgICBpbml0LmtpbmQgIT09IFwidmFyXCIgfHxcbiAgICAgICAgaW5pdC5kZWNsYXJhdGlvbnNbMF0uaWQudHlwZSAhPT0gXCJJZGVudGlmaWVyXCJcbiAgICAgIClcbiAgICApIHtcbiAgICAgIHRoaXMucmFpc2UoXG4gICAgICAgIGluaXQuc3RhcnQsXG4gICAgICAgICgoaXNGb3JJbiA/IFwiZm9yLWluXCIgOiBcImZvci1vZlwiKSArIFwiIGxvb3AgdmFyaWFibGUgZGVjbGFyYXRpb24gbWF5IG5vdCBoYXZlIGFuIGluaXRpYWxpemVyXCIpXG4gICAgICApO1xuICAgIH1cbiAgICBub2RlLmxlZnQgPSBpbml0O1xuICAgIG5vZGUucmlnaHQgPSBpc0ZvckluID8gdGhpcy5wYXJzZUV4cHJlc3Npb24oKSA6IHRoaXMucGFyc2VNYXliZUFzc2lnbigpO1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEucGFyZW5SKTtcbiAgICBub2RlLmJvZHkgPSB0aGlzLnBhcnNlU3RhdGVtZW50KFwiZm9yXCIpO1xuICAgIHRoaXMuZXhpdFNjb3BlKCk7XG4gICAgdGhpcy5sYWJlbHMucG9wKCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBpc0ZvckluID8gXCJGb3JJblN0YXRlbWVudFwiIDogXCJGb3JPZlN0YXRlbWVudFwiKVxuICB9O1xuXG4gIC8vIFBhcnNlIGEgbGlzdCBvZiB2YXJpYWJsZSBkZWNsYXJhdGlvbnMuXG5cbiAgcHAkOC5wYXJzZVZhciA9IGZ1bmN0aW9uKG5vZGUsIGlzRm9yLCBraW5kLCBhbGxvd01pc3NpbmdJbml0aWFsaXplcikge1xuICAgIG5vZGUuZGVjbGFyYXRpb25zID0gW107XG4gICAgbm9kZS5raW5kID0ga2luZDtcbiAgICBmb3IgKDs7KSB7XG4gICAgICB2YXIgZGVjbCA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgICB0aGlzLnBhcnNlVmFySWQoZGVjbCwga2luZCk7XG4gICAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5lcSkpIHtcbiAgICAgICAgZGVjbC5pbml0ID0gdGhpcy5wYXJzZU1heWJlQXNzaWduKGlzRm9yKTtcbiAgICAgIH0gZWxzZSBpZiAoIWFsbG93TWlzc2luZ0luaXRpYWxpemVyICYmIGtpbmQgPT09IFwiY29uc3RcIiAmJiAhKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5faW4gfHwgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ICYmIHRoaXMuaXNDb250ZXh0dWFsKFwib2ZcIikpKSkge1xuICAgICAgICB0aGlzLnVuZXhwZWN0ZWQoKTtcbiAgICAgIH0gZWxzZSBpZiAoIWFsbG93TWlzc2luZ0luaXRpYWxpemVyICYmIGRlY2wuaWQudHlwZSAhPT0gXCJJZGVudGlmaWVyXCIgJiYgIShpc0ZvciAmJiAodGhpcy50eXBlID09PSB0eXBlcyQxLl9pbiB8fCB0aGlzLmlzQ29udGV4dHVhbChcIm9mXCIpKSkpIHtcbiAgICAgICAgdGhpcy5yYWlzZSh0aGlzLmxhc3RUb2tFbmQsIFwiQ29tcGxleCBiaW5kaW5nIHBhdHRlcm5zIHJlcXVpcmUgYW4gaW5pdGlhbGl6YXRpb24gdmFsdWVcIik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWNsLmluaXQgPSBudWxsO1xuICAgICAgfVxuICAgICAgbm9kZS5kZWNsYXJhdGlvbnMucHVzaCh0aGlzLmZpbmlzaE5vZGUoZGVjbCwgXCJWYXJpYWJsZURlY2xhcmF0b3JcIikpO1xuICAgICAgaWYgKCF0aGlzLmVhdCh0eXBlcyQxLmNvbW1hKSkgeyBicmVhayB9XG4gICAgfVxuICAgIHJldHVybiBub2RlXG4gIH07XG5cbiAgcHAkOC5wYXJzZVZhcklkID0gZnVuY3Rpb24oZGVjbCwga2luZCkge1xuICAgIGRlY2wuaWQgPSB0aGlzLnBhcnNlQmluZGluZ0F0b20oKTtcbiAgICB0aGlzLmNoZWNrTFZhbFBhdHRlcm4oZGVjbC5pZCwga2luZCA9PT0gXCJ2YXJcIiA/IEJJTkRfVkFSIDogQklORF9MRVhJQ0FMLCBmYWxzZSk7XG4gIH07XG5cbiAgdmFyIEZVTkNfU1RBVEVNRU5UID0gMSwgRlVOQ19IQU5HSU5HX1NUQVRFTUVOVCA9IDIsIEZVTkNfTlVMTEFCTEVfSUQgPSA0O1xuXG4gIC8vIFBhcnNlIGEgZnVuY3Rpb24gZGVjbGFyYXRpb24gb3IgbGl0ZXJhbCAoZGVwZW5kaW5nIG9uIHRoZVxuICAvLyBgc3RhdGVtZW50ICYgRlVOQ19TVEFURU1FTlRgKS5cblxuICAvLyBSZW1vdmUgYGFsbG93RXhwcmVzc2lvbkJvZHlgIGZvciA3LjAuMCwgYXMgaXQgaXMgb25seSBjYWxsZWQgd2l0aCBmYWxzZVxuICBwcCQ4LnBhcnNlRnVuY3Rpb24gPSBmdW5jdGlvbihub2RlLCBzdGF0ZW1lbnQsIGFsbG93RXhwcmVzc2lvbkJvZHksIGlzQXN5bmMsIGZvckluaXQpIHtcbiAgICB0aGlzLmluaXRGdW5jdGlvbihub2RlKTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkgfHwgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYgJiYgIWlzQXN5bmMpIHtcbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuc3RhciAmJiAoc3RhdGVtZW50ICYgRlVOQ19IQU5HSU5HX1NUQVRFTUVOVCkpXG4gICAgICAgIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgIG5vZGUuZ2VuZXJhdG9yID0gdGhpcy5lYXQodHlwZXMkMS5zdGFyKTtcbiAgICB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA4KVxuICAgICAgeyBub2RlLmFzeW5jID0gISFpc0FzeW5jOyB9XG5cbiAgICBpZiAoc3RhdGVtZW50ICYgRlVOQ19TVEFURU1FTlQpIHtcbiAgICAgIG5vZGUuaWQgPSAoc3RhdGVtZW50ICYgRlVOQ19OVUxMQUJMRV9JRCkgJiYgdGhpcy50eXBlICE9PSB0eXBlcyQxLm5hbWUgPyBudWxsIDogdGhpcy5wYXJzZUlkZW50KCk7XG4gICAgICBpZiAobm9kZS5pZCAmJiAhKHN0YXRlbWVudCAmIEZVTkNfSEFOR0lOR19TVEFURU1FTlQpKVxuICAgICAgICAvLyBJZiBpdCBpcyBhIHJlZ3VsYXIgZnVuY3Rpb24gZGVjbGFyYXRpb24gaW4gc2xvcHB5IG1vZGUsIHRoZW4gaXQgaXNcbiAgICAgICAgLy8gc3ViamVjdCB0byBBbm5leCBCIHNlbWFudGljcyAoQklORF9GVU5DVElPTikuIE90aGVyd2lzZSwgdGhlIGJpbmRpbmdcbiAgICAgICAgLy8gbW9kZSBkZXBlbmRzIG9uIHByb3BlcnRpZXMgb2YgdGhlIGN1cnJlbnQgc2NvcGUgKHNlZVxuICAgICAgICAvLyB0cmVhdEZ1bmN0aW9uc0FzVmFyKS5cbiAgICAgICAgeyB0aGlzLmNoZWNrTFZhbFNpbXBsZShub2RlLmlkLCAodGhpcy5zdHJpY3QgfHwgbm9kZS5nZW5lcmF0b3IgfHwgbm9kZS5hc3luYykgPyB0aGlzLnRyZWF0RnVuY3Rpb25zQXNWYXIgPyBCSU5EX1ZBUiA6IEJJTkRfTEVYSUNBTCA6IEJJTkRfRlVOQ1RJT04pOyB9XG4gICAgfVxuXG4gICAgdmFyIG9sZFlpZWxkUG9zID0gdGhpcy55aWVsZFBvcywgb2xkQXdhaXRQb3MgPSB0aGlzLmF3YWl0UG9zLCBvbGRBd2FpdElkZW50UG9zID0gdGhpcy5hd2FpdElkZW50UG9zO1xuICAgIHRoaXMueWllbGRQb3MgPSAwO1xuICAgIHRoaXMuYXdhaXRQb3MgPSAwO1xuICAgIHRoaXMuYXdhaXRJZGVudFBvcyA9IDA7XG4gICAgdGhpcy5lbnRlclNjb3BlKGZ1bmN0aW9uRmxhZ3Mobm9kZS5hc3luYywgbm9kZS5nZW5lcmF0b3IpKTtcblxuICAgIGlmICghKHN0YXRlbWVudCAmIEZVTkNfU1RBVEVNRU5UKSlcbiAgICAgIHsgbm9kZS5pZCA9IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5uYW1lID8gdGhpcy5wYXJzZUlkZW50KCkgOiBudWxsOyB9XG5cbiAgICB0aGlzLnBhcnNlRnVuY3Rpb25QYXJhbXMobm9kZSk7XG4gICAgdGhpcy5wYXJzZUZ1bmN0aW9uQm9keShub2RlLCBhbGxvd0V4cHJlc3Npb25Cb2R5LCBmYWxzZSwgZm9ySW5pdCk7XG5cbiAgICB0aGlzLnlpZWxkUG9zID0gb2xkWWllbGRQb3M7XG4gICAgdGhpcy5hd2FpdFBvcyA9IG9sZEF3YWl0UG9zO1xuICAgIHRoaXMuYXdhaXRJZGVudFBvcyA9IG9sZEF3YWl0SWRlbnRQb3M7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCAoc3RhdGVtZW50ICYgRlVOQ19TVEFURU1FTlQpID8gXCJGdW5jdGlvbkRlY2xhcmF0aW9uXCIgOiBcIkZ1bmN0aW9uRXhwcmVzc2lvblwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VGdW5jdGlvblBhcmFtcyA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLnBhcmVuTCk7XG4gICAgbm9kZS5wYXJhbXMgPSB0aGlzLnBhcnNlQmluZGluZ0xpc3QodHlwZXMkMS5wYXJlblIsIGZhbHNlLCB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOCk7XG4gICAgdGhpcy5jaGVja1lpZWxkQXdhaXRJbkRlZmF1bHRQYXJhbXMoKTtcbiAgfTtcblxuICAvLyBQYXJzZSBhIGNsYXNzIGRlY2xhcmF0aW9uIG9yIGxpdGVyYWwgKGRlcGVuZGluZyBvbiB0aGVcbiAgLy8gYGlzU3RhdGVtZW50YCBwYXJhbWV0ZXIpLlxuXG4gIHBwJDgucGFyc2VDbGFzcyA9IGZ1bmN0aW9uKG5vZGUsIGlzU3RhdGVtZW50KSB7XG4gICAgdGhpcy5uZXh0KCk7XG5cbiAgICAvLyBlY21hLTI2MiAxNC42IENsYXNzIERlZmluaXRpb25zXG4gICAgLy8gQSBjbGFzcyBkZWZpbml0aW9uIGlzIGFsd2F5cyBzdHJpY3QgbW9kZSBjb2RlLlxuICAgIHZhciBvbGRTdHJpY3QgPSB0aGlzLnN0cmljdDtcbiAgICB0aGlzLnN0cmljdCA9IHRydWU7XG5cbiAgICB0aGlzLnBhcnNlQ2xhc3NJZChub2RlLCBpc1N0YXRlbWVudCk7XG4gICAgdGhpcy5wYXJzZUNsYXNzU3VwZXIobm9kZSk7XG4gICAgdmFyIHByaXZhdGVOYW1lTWFwID0gdGhpcy5lbnRlckNsYXNzQm9keSgpO1xuICAgIHZhciBjbGFzc0JvZHkgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIHZhciBoYWRDb25zdHJ1Y3RvciA9IGZhbHNlO1xuICAgIGNsYXNzQm9keS5ib2R5ID0gW107XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5icmFjZUwpO1xuICAgIHdoaWxlICh0aGlzLnR5cGUgIT09IHR5cGVzJDEuYnJhY2VSKSB7XG4gICAgICB2YXIgZWxlbWVudCA9IHRoaXMucGFyc2VDbGFzc0VsZW1lbnQobm9kZS5zdXBlckNsYXNzICE9PSBudWxsKTtcbiAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgIGNsYXNzQm9keS5ib2R5LnB1c2goZWxlbWVudCk7XG4gICAgICAgIGlmIChlbGVtZW50LnR5cGUgPT09IFwiTWV0aG9kRGVmaW5pdGlvblwiICYmIGVsZW1lbnQua2luZCA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG4gICAgICAgICAgaWYgKGhhZENvbnN0cnVjdG9yKSB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShlbGVtZW50LnN0YXJ0LCBcIkR1cGxpY2F0ZSBjb25zdHJ1Y3RvciBpbiB0aGUgc2FtZSBjbGFzc1wiKTsgfVxuICAgICAgICAgIGhhZENvbnN0cnVjdG9yID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50LmtleSAmJiBlbGVtZW50LmtleS50eXBlID09PSBcIlByaXZhdGVJZGVudGlmaWVyXCIgJiYgaXNQcml2YXRlTmFtZUNvbmZsaWN0ZWQocHJpdmF0ZU5hbWVNYXAsIGVsZW1lbnQpKSB7XG4gICAgICAgICAgdGhpcy5yYWlzZVJlY292ZXJhYmxlKGVsZW1lbnQua2V5LnN0YXJ0LCAoXCJJZGVudGlmaWVyICcjXCIgKyAoZWxlbWVudC5rZXkubmFtZSkgKyBcIicgaGFzIGFscmVhZHkgYmVlbiBkZWNsYXJlZFwiKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5zdHJpY3QgPSBvbGRTdHJpY3Q7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgbm9kZS5ib2R5ID0gdGhpcy5maW5pc2hOb2RlKGNsYXNzQm9keSwgXCJDbGFzc0JvZHlcIik7XG4gICAgdGhpcy5leGl0Q2xhc3NCb2R5KCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBpc1N0YXRlbWVudCA/IFwiQ2xhc3NEZWNsYXJhdGlvblwiIDogXCJDbGFzc0V4cHJlc3Npb25cIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlQ2xhc3NFbGVtZW50ID0gZnVuY3Rpb24oY29uc3RydWN0b3JBbGxvd3NTdXBlcikge1xuICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLnNlbWkpKSB7IHJldHVybiBudWxsIH1cblxuICAgIHZhciBlY21hVmVyc2lvbiA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbjtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgdmFyIGtleU5hbWUgPSBcIlwiO1xuICAgIHZhciBpc0dlbmVyYXRvciA9IGZhbHNlO1xuICAgIHZhciBpc0FzeW5jID0gZmFsc2U7XG4gICAgdmFyIGtpbmQgPSBcIm1ldGhvZFwiO1xuICAgIHZhciBpc1N0YXRpYyA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMuZWF0Q29udGV4dHVhbChcInN0YXRpY1wiKSkge1xuICAgICAgLy8gUGFyc2Ugc3RhdGljIGluaXQgYmxvY2tcbiAgICAgIGlmIChlY21hVmVyc2lvbiA+PSAxMyAmJiB0aGlzLmVhdCh0eXBlcyQxLmJyYWNlTCkpIHtcbiAgICAgICAgdGhpcy5wYXJzZUNsYXNzU3RhdGljQmxvY2sobm9kZSk7XG4gICAgICAgIHJldHVybiBub2RlXG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc0NsYXNzRWxlbWVudE5hbWVTdGFydCgpIHx8IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5zdGFyKSB7XG4gICAgICAgIGlzU3RhdGljID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGtleU5hbWUgPSBcInN0YXRpY1wiO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlLnN0YXRpYyA9IGlzU3RhdGljO1xuICAgIGlmICgha2V5TmFtZSAmJiBlY21hVmVyc2lvbiA+PSA4ICYmIHRoaXMuZWF0Q29udGV4dHVhbChcImFzeW5jXCIpKSB7XG4gICAgICBpZiAoKHRoaXMuaXNDbGFzc0VsZW1lbnROYW1lU3RhcnQoKSB8fCB0aGlzLnR5cGUgPT09IHR5cGVzJDEuc3RhcikgJiYgIXRoaXMuY2FuSW5zZXJ0U2VtaWNvbG9uKCkpIHtcbiAgICAgICAgaXNBc3luYyA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBrZXlOYW1lID0gXCJhc3luY1wiO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWtleU5hbWUgJiYgKGVjbWFWZXJzaW9uID49IDkgfHwgIWlzQXN5bmMpICYmIHRoaXMuZWF0KHR5cGVzJDEuc3RhcikpIHtcbiAgICAgIGlzR2VuZXJhdG9yID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKCFrZXlOYW1lICYmICFpc0FzeW5jICYmICFpc0dlbmVyYXRvcikge1xuICAgICAgdmFyIGxhc3RWYWx1ZSA9IHRoaXMudmFsdWU7XG4gICAgICBpZiAodGhpcy5lYXRDb250ZXh0dWFsKFwiZ2V0XCIpIHx8IHRoaXMuZWF0Q29udGV4dHVhbChcInNldFwiKSkge1xuICAgICAgICBpZiAodGhpcy5pc0NsYXNzRWxlbWVudE5hbWVTdGFydCgpKSB7XG4gICAgICAgICAga2luZCA9IGxhc3RWYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBrZXlOYW1lID0gbGFzdFZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgZWxlbWVudCBuYW1lXG4gICAgaWYgKGtleU5hbWUpIHtcbiAgICAgIC8vICdhc3luYycsICdnZXQnLCAnc2V0Jywgb3IgJ3N0YXRpYycgd2VyZSBub3QgYSBrZXl3b3JkIGNvbnRleHR1YWxseS5cbiAgICAgIC8vIFRoZSBsYXN0IHRva2VuIGlzIGFueSBvZiB0aG9zZS4gTWFrZSBpdCB0aGUgZWxlbWVudCBuYW1lLlxuICAgICAgbm9kZS5jb21wdXRlZCA9IGZhbHNlO1xuICAgICAgbm9kZS5rZXkgPSB0aGlzLnN0YXJ0Tm9kZUF0KHRoaXMubGFzdFRva1N0YXJ0LCB0aGlzLmxhc3RUb2tTdGFydExvYyk7XG4gICAgICBub2RlLmtleS5uYW1lID0ga2V5TmFtZTtcbiAgICAgIHRoaXMuZmluaXNoTm9kZShub2RlLmtleSwgXCJJZGVudGlmaWVyXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBhcnNlQ2xhc3NFbGVtZW50TmFtZShub2RlKTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSBlbGVtZW50IHZhbHVlXG4gICAgaWYgKGVjbWFWZXJzaW9uIDwgMTMgfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLnBhcmVuTCB8fCBraW5kICE9PSBcIm1ldGhvZFwiIHx8IGlzR2VuZXJhdG9yIHx8IGlzQXN5bmMpIHtcbiAgICAgIHZhciBpc0NvbnN0cnVjdG9yID0gIW5vZGUuc3RhdGljICYmIGNoZWNrS2V5TmFtZShub2RlLCBcImNvbnN0cnVjdG9yXCIpO1xuICAgICAgdmFyIGFsbG93c0RpcmVjdFN1cGVyID0gaXNDb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3RvckFsbG93c1N1cGVyO1xuICAgICAgLy8gQ291bGRuJ3QgbW92ZSB0aGlzIGNoZWNrIGludG8gdGhlICdwYXJzZUNsYXNzTWV0aG9kJyBtZXRob2QgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkuXG4gICAgICBpZiAoaXNDb25zdHJ1Y3RvciAmJiBraW5kICE9PSBcIm1ldGhvZFwiKSB7IHRoaXMucmFpc2Uobm9kZS5rZXkuc3RhcnQsIFwiQ29uc3RydWN0b3IgY2FuJ3QgaGF2ZSBnZXQvc2V0IG1vZGlmaWVyXCIpOyB9XG4gICAgICBub2RlLmtpbmQgPSBpc0NvbnN0cnVjdG9yID8gXCJjb25zdHJ1Y3RvclwiIDoga2luZDtcbiAgICAgIHRoaXMucGFyc2VDbGFzc01ldGhvZChub2RlLCBpc0dlbmVyYXRvciwgaXNBc3luYywgYWxsb3dzRGlyZWN0U3VwZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBhcnNlQ2xhc3NGaWVsZChub2RlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZVxuICB9O1xuXG4gIHBwJDguaXNDbGFzc0VsZW1lbnROYW1lU3RhcnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy50eXBlID09PSB0eXBlcyQxLm5hbWUgfHxcbiAgICAgIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5wcml2YXRlSWQgfHxcbiAgICAgIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5udW0gfHxcbiAgICAgIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5zdHJpbmcgfHxcbiAgICAgIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5icmFja2V0TCB8fFxuICAgICAgdGhpcy50eXBlLmtleXdvcmRcbiAgICApXG4gIH07XG5cbiAgcHAkOC5wYXJzZUNsYXNzRWxlbWVudE5hbWUgPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5wcml2YXRlSWQpIHtcbiAgICAgIGlmICh0aGlzLnZhbHVlID09PSBcImNvbnN0cnVjdG9yXCIpIHtcbiAgICAgICAgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCBcIkNsYXNzZXMgY2FuJ3QgaGF2ZSBhbiBlbGVtZW50IG5hbWVkICcjY29uc3RydWN0b3InXCIpO1xuICAgICAgfVxuICAgICAgZWxlbWVudC5jb21wdXRlZCA9IGZhbHNlO1xuICAgICAgZWxlbWVudC5rZXkgPSB0aGlzLnBhcnNlUHJpdmF0ZUlkZW50KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGFyc2VQcm9wZXJ0eU5hbWUoZWxlbWVudCk7XG4gICAgfVxuICB9O1xuXG4gIHBwJDgucGFyc2VDbGFzc01ldGhvZCA9IGZ1bmN0aW9uKG1ldGhvZCwgaXNHZW5lcmF0b3IsIGlzQXN5bmMsIGFsbG93c0RpcmVjdFN1cGVyKSB7XG4gICAgLy8gQ2hlY2sga2V5IGFuZCBmbGFnc1xuICAgIHZhciBrZXkgPSBtZXRob2Qua2V5O1xuICAgIGlmIChtZXRob2Qua2luZCA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG4gICAgICBpZiAoaXNHZW5lcmF0b3IpIHsgdGhpcy5yYWlzZShrZXkuc3RhcnQsIFwiQ29uc3RydWN0b3IgY2FuJ3QgYmUgYSBnZW5lcmF0b3JcIik7IH1cbiAgICAgIGlmIChpc0FzeW5jKSB7IHRoaXMucmFpc2Uoa2V5LnN0YXJ0LCBcIkNvbnN0cnVjdG9yIGNhbid0IGJlIGFuIGFzeW5jIG1ldGhvZFwiKTsgfVxuICAgIH0gZWxzZSBpZiAobWV0aG9kLnN0YXRpYyAmJiBjaGVja0tleU5hbWUobWV0aG9kLCBcInByb3RvdHlwZVwiKSkge1xuICAgICAgdGhpcy5yYWlzZShrZXkuc3RhcnQsIFwiQ2xhc3NlcyBtYXkgbm90IGhhdmUgYSBzdGF0aWMgcHJvcGVydHkgbmFtZWQgcHJvdG90eXBlXCIpO1xuICAgIH1cblxuICAgIC8vIFBhcnNlIHZhbHVlXG4gICAgdmFyIHZhbHVlID0gbWV0aG9kLnZhbHVlID0gdGhpcy5wYXJzZU1ldGhvZChpc0dlbmVyYXRvciwgaXNBc3luYywgYWxsb3dzRGlyZWN0U3VwZXIpO1xuXG4gICAgLy8gQ2hlY2sgdmFsdWVcbiAgICBpZiAobWV0aG9kLmtpbmQgPT09IFwiZ2V0XCIgJiYgdmFsdWUucGFyYW1zLmxlbmd0aCAhPT0gMClcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHZhbHVlLnN0YXJ0LCBcImdldHRlciBzaG91bGQgaGF2ZSBubyBwYXJhbXNcIik7IH1cbiAgICBpZiAobWV0aG9kLmtpbmQgPT09IFwic2V0XCIgJiYgdmFsdWUucGFyYW1zLmxlbmd0aCAhPT0gMSlcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHZhbHVlLnN0YXJ0LCBcInNldHRlciBzaG91bGQgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbVwiKTsgfVxuICAgIGlmIChtZXRob2Qua2luZCA9PT0gXCJzZXRcIiAmJiB2YWx1ZS5wYXJhbXNbMF0udHlwZSA9PT0gXCJSZXN0RWxlbWVudFwiKVxuICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodmFsdWUucGFyYW1zWzBdLnN0YXJ0LCBcIlNldHRlciBjYW5ub3QgdXNlIHJlc3QgcGFyYW1zXCIpOyB9XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG1ldGhvZCwgXCJNZXRob2REZWZpbml0aW9uXCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUNsYXNzRmllbGQgPSBmdW5jdGlvbihmaWVsZCkge1xuICAgIGlmIChjaGVja0tleU5hbWUoZmllbGQsIFwiY29uc3RydWN0b3JcIikpIHtcbiAgICAgIHRoaXMucmFpc2UoZmllbGQua2V5LnN0YXJ0LCBcIkNsYXNzZXMgY2FuJ3QgaGF2ZSBhIGZpZWxkIG5hbWVkICdjb25zdHJ1Y3RvcidcIik7XG4gICAgfSBlbHNlIGlmIChmaWVsZC5zdGF0aWMgJiYgY2hlY2tLZXlOYW1lKGZpZWxkLCBcInByb3RvdHlwZVwiKSkge1xuICAgICAgdGhpcy5yYWlzZShmaWVsZC5rZXkuc3RhcnQsIFwiQ2xhc3NlcyBjYW4ndCBoYXZlIGEgc3RhdGljIGZpZWxkIG5hbWVkICdwcm90b3R5cGUnXCIpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLmVxKSkge1xuICAgICAgLy8gVG8gcmFpc2UgU3ludGF4RXJyb3IgaWYgJ2FyZ3VtZW50cycgZXhpc3RzIGluIHRoZSBpbml0aWFsaXplci5cbiAgICAgIHZhciBzY29wZSA9IHRoaXMuY3VycmVudFRoaXNTY29wZSgpO1xuICAgICAgdmFyIGluQ2xhc3NGaWVsZEluaXQgPSBzY29wZS5pbkNsYXNzRmllbGRJbml0O1xuICAgICAgc2NvcGUuaW5DbGFzc0ZpZWxkSW5pdCA9IHRydWU7XG4gICAgICBmaWVsZC52YWx1ZSA9IHRoaXMucGFyc2VNYXliZUFzc2lnbigpO1xuICAgICAgc2NvcGUuaW5DbGFzc0ZpZWxkSW5pdCA9IGluQ2xhc3NGaWVsZEluaXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpZWxkLnZhbHVlID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zZW1pY29sb24oKTtcblxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUoZmllbGQsIFwiUHJvcGVydHlEZWZpbml0aW9uXCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUNsYXNzU3RhdGljQmxvY2sgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgbm9kZS5ib2R5ID0gW107XG5cbiAgICB2YXIgb2xkTGFiZWxzID0gdGhpcy5sYWJlbHM7XG4gICAgdGhpcy5sYWJlbHMgPSBbXTtcbiAgICB0aGlzLmVudGVyU2NvcGUoU0NPUEVfQ0xBU1NfU1RBVElDX0JMT0NLIHwgU0NPUEVfU1VQRVIpO1xuICAgIHdoaWxlICh0aGlzLnR5cGUgIT09IHR5cGVzJDEuYnJhY2VSKSB7XG4gICAgICB2YXIgc3RtdCA9IHRoaXMucGFyc2VTdGF0ZW1lbnQobnVsbCk7XG4gICAgICBub2RlLmJvZHkucHVzaChzdG10KTtcbiAgICB9XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgdGhpcy5leGl0U2NvcGUoKTtcbiAgICB0aGlzLmxhYmVscyA9IG9sZExhYmVscztcblxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJTdGF0aWNCbG9ja1wiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VDbGFzc0lkID0gZnVuY3Rpb24obm9kZSwgaXNTdGF0ZW1lbnQpIHtcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLm5hbWUpIHtcbiAgICAgIG5vZGUuaWQgPSB0aGlzLnBhcnNlSWRlbnQoKTtcbiAgICAgIGlmIChpc1N0YXRlbWVudClcbiAgICAgICAgeyB0aGlzLmNoZWNrTFZhbFNpbXBsZShub2RlLmlkLCBCSU5EX0xFWElDQUwsIGZhbHNlKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaXNTdGF0ZW1lbnQgPT09IHRydWUpXG4gICAgICAgIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgIG5vZGUuaWQgPSBudWxsO1xuICAgIH1cbiAgfTtcblxuICBwcCQ4LnBhcnNlQ2xhc3NTdXBlciA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBub2RlLnN1cGVyQ2xhc3MgPSB0aGlzLmVhdCh0eXBlcyQxLl9leHRlbmRzKSA/IHRoaXMucGFyc2VFeHByU3Vic2NyaXB0cyhudWxsLCBmYWxzZSkgOiBudWxsO1xuICB9O1xuXG4gIHBwJDguZW50ZXJDbGFzc0JvZHkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZWxlbWVudCA9IHtkZWNsYXJlZDogT2JqZWN0LmNyZWF0ZShudWxsKSwgdXNlZDogW119O1xuICAgIHRoaXMucHJpdmF0ZU5hbWVTdGFjay5wdXNoKGVsZW1lbnQpO1xuICAgIHJldHVybiBlbGVtZW50LmRlY2xhcmVkXG4gIH07XG5cbiAgcHAkOC5leGl0Q2xhc3NCb2R5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlZiA9IHRoaXMucHJpdmF0ZU5hbWVTdGFjay5wb3AoKTtcbiAgICB2YXIgZGVjbGFyZWQgPSByZWYuZGVjbGFyZWQ7XG4gICAgdmFyIHVzZWQgPSByZWYudXNlZDtcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5jaGVja1ByaXZhdGVGaWVsZHMpIHsgcmV0dXJuIH1cbiAgICB2YXIgbGVuID0gdGhpcy5wcml2YXRlTmFtZVN0YWNrLmxlbmd0aDtcbiAgICB2YXIgcGFyZW50ID0gbGVuID09PSAwID8gbnVsbCA6IHRoaXMucHJpdmF0ZU5hbWVTdGFja1tsZW4gLSAxXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVzZWQubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBpZCA9IHVzZWRbaV07XG4gICAgICBpZiAoIWhhc093bihkZWNsYXJlZCwgaWQubmFtZSkpIHtcbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgIHBhcmVudC51c2VkLnB1c2goaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZShpZC5zdGFydCwgKFwiUHJpdmF0ZSBmaWVsZCAnI1wiICsgKGlkLm5hbWUpICsgXCInIG11c3QgYmUgZGVjbGFyZWQgaW4gYW4gZW5jbG9zaW5nIGNsYXNzXCIpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBmdW5jdGlvbiBpc1ByaXZhdGVOYW1lQ29uZmxpY3RlZChwcml2YXRlTmFtZU1hcCwgZWxlbWVudCkge1xuICAgIHZhciBuYW1lID0gZWxlbWVudC5rZXkubmFtZTtcbiAgICB2YXIgY3VyciA9IHByaXZhdGVOYW1lTWFwW25hbWVdO1xuXG4gICAgdmFyIG5leHQgPSBcInRydWVcIjtcbiAgICBpZiAoZWxlbWVudC50eXBlID09PSBcIk1ldGhvZERlZmluaXRpb25cIiAmJiAoZWxlbWVudC5raW5kID09PSBcImdldFwiIHx8IGVsZW1lbnQua2luZCA9PT0gXCJzZXRcIikpIHtcbiAgICAgIG5leHQgPSAoZWxlbWVudC5zdGF0aWMgPyBcInNcIiA6IFwiaVwiKSArIGVsZW1lbnQua2luZDtcbiAgICB9XG5cbiAgICAvLyBgY2xhc3MgeyBnZXQgI2EoKXt9OyBzdGF0aWMgc2V0ICNhKF8pe30gfWAgaXMgYWxzbyBjb25mbGljdC5cbiAgICBpZiAoXG4gICAgICBjdXJyID09PSBcImlnZXRcIiAmJiBuZXh0ID09PSBcImlzZXRcIiB8fFxuICAgICAgY3VyciA9PT0gXCJpc2V0XCIgJiYgbmV4dCA9PT0gXCJpZ2V0XCIgfHxcbiAgICAgIGN1cnIgPT09IFwic2dldFwiICYmIG5leHQgPT09IFwic3NldFwiIHx8XG4gICAgICBjdXJyID09PSBcInNzZXRcIiAmJiBuZXh0ID09PSBcInNnZXRcIlxuICAgICkge1xuICAgICAgcHJpdmF0ZU5hbWVNYXBbbmFtZV0gPSBcInRydWVcIjtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH0gZWxzZSBpZiAoIWN1cnIpIHtcbiAgICAgIHByaXZhdGVOYW1lTWFwW25hbWVdID0gbmV4dDtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNoZWNrS2V5TmFtZShub2RlLCBuYW1lKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gbm9kZS5jb21wdXRlZDtcbiAgICB2YXIga2V5ID0gbm9kZS5rZXk7XG4gICAgcmV0dXJuICFjb21wdXRlZCAmJiAoXG4gICAgICBrZXkudHlwZSA9PT0gXCJJZGVudGlmaWVyXCIgJiYga2V5Lm5hbWUgPT09IG5hbWUgfHxcbiAgICAgIGtleS50eXBlID09PSBcIkxpdGVyYWxcIiAmJiBrZXkudmFsdWUgPT09IG5hbWVcbiAgICApXG4gIH1cblxuICAvLyBQYXJzZXMgbW9kdWxlIGV4cG9ydCBkZWNsYXJhdGlvbi5cblxuICBwcCQ4LnBhcnNlRXhwb3J0QWxsRGVjbGFyYXRpb24gPSBmdW5jdGlvbihub2RlLCBleHBvcnRzKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSAxMSkge1xuICAgICAgaWYgKHRoaXMuZWF0Q29udGV4dHVhbChcImFzXCIpKSB7XG4gICAgICAgIG5vZGUuZXhwb3J0ZWQgPSB0aGlzLnBhcnNlTW9kdWxlRXhwb3J0TmFtZSgpO1xuICAgICAgICB0aGlzLmNoZWNrRXhwb3J0KGV4cG9ydHMsIG5vZGUuZXhwb3J0ZWQsIHRoaXMubGFzdFRva1N0YXJ0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vZGUuZXhwb3J0ZWQgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmV4cGVjdENvbnRleHR1YWwoXCJmcm9tXCIpO1xuICAgIGlmICh0aGlzLnR5cGUgIT09IHR5cGVzJDEuc3RyaW5nKSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgbm9kZS5zb3VyY2UgPSB0aGlzLnBhcnNlRXhwckF0b20oKTtcbiAgICB0aGlzLnNlbWljb2xvbigpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJFeHBvcnRBbGxEZWNsYXJhdGlvblwiKVxuICB9O1xuXG4gIHBwJDgucGFyc2VFeHBvcnQgPSBmdW5jdGlvbihub2RlLCBleHBvcnRzKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgLy8gZXhwb3J0ICogZnJvbSAnLi4uJ1xuICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLnN0YXIpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUV4cG9ydEFsbERlY2xhcmF0aW9uKG5vZGUsIGV4cG9ydHMpXG4gICAgfVxuICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLl9kZWZhdWx0KSkgeyAvLyBleHBvcnQgZGVmYXVsdCAuLi5cbiAgICAgIHRoaXMuY2hlY2tFeHBvcnQoZXhwb3J0cywgXCJkZWZhdWx0XCIsIHRoaXMubGFzdFRva1N0YXJ0KTtcbiAgICAgIG5vZGUuZGVjbGFyYXRpb24gPSB0aGlzLnBhcnNlRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uKCk7XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uXCIpXG4gICAgfVxuICAgIC8vIGV4cG9ydCB2YXJ8Y29uc3R8bGV0fGZ1bmN0aW9ufGNsYXNzIC4uLlxuICAgIGlmICh0aGlzLnNob3VsZFBhcnNlRXhwb3J0U3RhdGVtZW50KCkpIHtcbiAgICAgIG5vZGUuZGVjbGFyYXRpb24gPSB0aGlzLnBhcnNlRXhwb3J0RGVjbGFyYXRpb24obm9kZSk7XG4gICAgICBpZiAobm9kZS5kZWNsYXJhdGlvbi50eXBlID09PSBcIlZhcmlhYmxlRGVjbGFyYXRpb25cIilcbiAgICAgICAgeyB0aGlzLmNoZWNrVmFyaWFibGVFeHBvcnQoZXhwb3J0cywgbm9kZS5kZWNsYXJhdGlvbi5kZWNsYXJhdGlvbnMpOyB9XG4gICAgICBlbHNlXG4gICAgICAgIHsgdGhpcy5jaGVja0V4cG9ydChleHBvcnRzLCBub2RlLmRlY2xhcmF0aW9uLmlkLCBub2RlLmRlY2xhcmF0aW9uLmlkLnN0YXJ0KTsgfVxuICAgICAgbm9kZS5zcGVjaWZpZXJzID0gW107XG4gICAgICBub2RlLnNvdXJjZSA9IG51bGw7XG4gICAgfSBlbHNlIHsgLy8gZXhwb3J0IHsgeCwgeSBhcyB6IH0gW2Zyb20gJy4uLiddXG4gICAgICBub2RlLmRlY2xhcmF0aW9uID0gbnVsbDtcbiAgICAgIG5vZGUuc3BlY2lmaWVycyA9IHRoaXMucGFyc2VFeHBvcnRTcGVjaWZpZXJzKGV4cG9ydHMpO1xuICAgICAgaWYgKHRoaXMuZWF0Q29udGV4dHVhbChcImZyb21cIikpIHtcbiAgICAgICAgaWYgKHRoaXMudHlwZSAhPT0gdHlwZXMkMS5zdHJpbmcpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgICAgbm9kZS5zb3VyY2UgPSB0aGlzLnBhcnNlRXhwckF0b20oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsaXN0ID0gbm9kZS5zcGVjaWZpZXJzOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgIC8vIGNoZWNrIGZvciBrZXl3b3JkcyB1c2VkIGFzIGxvY2FsIG5hbWVzXG4gICAgICAgICAgdmFyIHNwZWMgPSBsaXN0W2ldO1xuXG4gICAgICAgICAgdGhpcy5jaGVja1VucmVzZXJ2ZWQoc3BlYy5sb2NhbCk7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgZXhwb3J0IGlzIGRlZmluZWRcbiAgICAgICAgICB0aGlzLmNoZWNrTG9jYWxFeHBvcnQoc3BlYy5sb2NhbCk7XG5cbiAgICAgICAgICBpZiAoc3BlYy5sb2NhbC50eXBlID09PSBcIkxpdGVyYWxcIikge1xuICAgICAgICAgICAgdGhpcy5yYWlzZShzcGVjLmxvY2FsLnN0YXJ0LCBcIkEgc3RyaW5nIGxpdGVyYWwgY2Fubm90IGJlIHVzZWQgYXMgYW4gZXhwb3J0ZWQgYmluZGluZyB3aXRob3V0IGBmcm9tYC5cIik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbm9kZS5zb3VyY2UgPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5zZW1pY29sb24oKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkV4cG9ydE5hbWVkRGVjbGFyYXRpb25cIilcbiAgfTtcblxuICBwcCQ4LnBhcnNlRXhwb3J0RGVjbGFyYXRpb24gPSBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VTdGF0ZW1lbnQobnVsbClcbiAgfTtcblxuICBwcCQ4LnBhcnNlRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGlzQXN5bmM7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5fZnVuY3Rpb24gfHwgKGlzQXN5bmMgPSB0aGlzLmlzQXN5bmNGdW5jdGlvbigpKSkge1xuICAgICAgdmFyIGZOb2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgaWYgKGlzQXN5bmMpIHsgdGhpcy5uZXh0KCk7IH1cbiAgICAgIHJldHVybiB0aGlzLnBhcnNlRnVuY3Rpb24oZk5vZGUsIEZVTkNfU1RBVEVNRU5UIHwgRlVOQ19OVUxMQUJMRV9JRCwgZmFsc2UsIGlzQXN5bmMpXG4gICAgfSBlbHNlIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuX2NsYXNzKSB7XG4gICAgICB2YXIgY05vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VDbGFzcyhjTm9kZSwgXCJudWxsYWJsZUlEXCIpXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBkZWNsYXJhdGlvbiA9IHRoaXMucGFyc2VNYXliZUFzc2lnbigpO1xuICAgICAgdGhpcy5zZW1pY29sb24oKTtcbiAgICAgIHJldHVybiBkZWNsYXJhdGlvblxuICAgIH1cbiAgfTtcblxuICBwcCQ4LmNoZWNrRXhwb3J0ID0gZnVuY3Rpb24oZXhwb3J0cywgbmFtZSwgcG9zKSB7XG4gICAgaWYgKCFleHBvcnRzKSB7IHJldHVybiB9XG4gICAgaWYgKHR5cGVvZiBuYW1lICE9PSBcInN0cmluZ1wiKVxuICAgICAgeyBuYW1lID0gbmFtZS50eXBlID09PSBcIklkZW50aWZpZXJcIiA/IG5hbWUubmFtZSA6IG5hbWUudmFsdWU7IH1cbiAgICBpZiAoaGFzT3duKGV4cG9ydHMsIG5hbWUpKVxuICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUocG9zLCBcIkR1cGxpY2F0ZSBleHBvcnQgJ1wiICsgbmFtZSArIFwiJ1wiKTsgfVxuICAgIGV4cG9ydHNbbmFtZV0gPSB0cnVlO1xuICB9O1xuXG4gIHBwJDguY2hlY2tQYXR0ZXJuRXhwb3J0ID0gZnVuY3Rpb24oZXhwb3J0cywgcGF0KSB7XG4gICAgdmFyIHR5cGUgPSBwYXQudHlwZTtcbiAgICBpZiAodHlwZSA9PT0gXCJJZGVudGlmaWVyXCIpXG4gICAgICB7IHRoaXMuY2hlY2tFeHBvcnQoZXhwb3J0cywgcGF0LCBwYXQuc3RhcnQpOyB9XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gXCJPYmplY3RQYXR0ZXJuXCIpXG4gICAgICB7IGZvciAodmFyIGkgPSAwLCBsaXN0ID0gcGF0LnByb3BlcnRpZXM7IGkgPCBsaXN0Lmxlbmd0aDsgaSArPSAxKVxuICAgICAgICB7XG4gICAgICAgICAgdmFyIHByb3AgPSBsaXN0W2ldO1xuXG4gICAgICAgICAgdGhpcy5jaGVja1BhdHRlcm5FeHBvcnQoZXhwb3J0cywgcHJvcCk7XG4gICAgICAgIH0gfVxuICAgIGVsc2UgaWYgKHR5cGUgPT09IFwiQXJyYXlQYXR0ZXJuXCIpXG4gICAgICB7IGZvciAodmFyIGkkMSA9IDAsIGxpc3QkMSA9IHBhdC5lbGVtZW50czsgaSQxIDwgbGlzdCQxLmxlbmd0aDsgaSQxICs9IDEpIHtcbiAgICAgICAgdmFyIGVsdCA9IGxpc3QkMVtpJDFdO1xuXG4gICAgICAgICAgaWYgKGVsdCkgeyB0aGlzLmNoZWNrUGF0dGVybkV4cG9ydChleHBvcnRzLCBlbHQpOyB9XG4gICAgICB9IH1cbiAgICBlbHNlIGlmICh0eXBlID09PSBcIlByb3BlcnR5XCIpXG4gICAgICB7IHRoaXMuY2hlY2tQYXR0ZXJuRXhwb3J0KGV4cG9ydHMsIHBhdC52YWx1ZSk7IH1cbiAgICBlbHNlIGlmICh0eXBlID09PSBcIkFzc2lnbm1lbnRQYXR0ZXJuXCIpXG4gICAgICB7IHRoaXMuY2hlY2tQYXR0ZXJuRXhwb3J0KGV4cG9ydHMsIHBhdC5sZWZ0KTsgfVxuICAgIGVsc2UgaWYgKHR5cGUgPT09IFwiUmVzdEVsZW1lbnRcIilcbiAgICAgIHsgdGhpcy5jaGVja1BhdHRlcm5FeHBvcnQoZXhwb3J0cywgcGF0LmFyZ3VtZW50KTsgfVxuICAgIGVsc2UgaWYgKHR5cGUgPT09IFwiUGFyZW50aGVzaXplZEV4cHJlc3Npb25cIilcbiAgICAgIHsgdGhpcy5jaGVja1BhdHRlcm5FeHBvcnQoZXhwb3J0cywgcGF0LmV4cHJlc3Npb24pOyB9XG4gIH07XG5cbiAgcHAkOC5jaGVja1ZhcmlhYmxlRXhwb3J0ID0gZnVuY3Rpb24oZXhwb3J0cywgZGVjbHMpIHtcbiAgICBpZiAoIWV4cG9ydHMpIHsgcmV0dXJuIH1cbiAgICBmb3IgKHZhciBpID0gMCwgbGlzdCA9IGRlY2xzOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gMSlcbiAgICAgIHtcbiAgICAgIHZhciBkZWNsID0gbGlzdFtpXTtcblxuICAgICAgdGhpcy5jaGVja1BhdHRlcm5FeHBvcnQoZXhwb3J0cywgZGVjbC5pZCk7XG4gICAgfVxuICB9O1xuXG4gIHBwJDguc2hvdWxkUGFyc2VFeHBvcnRTdGF0ZW1lbnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLmtleXdvcmQgPT09IFwidmFyXCIgfHxcbiAgICAgIHRoaXMudHlwZS5rZXl3b3JkID09PSBcImNvbnN0XCIgfHxcbiAgICAgIHRoaXMudHlwZS5rZXl3b3JkID09PSBcImNsYXNzXCIgfHxcbiAgICAgIHRoaXMudHlwZS5rZXl3b3JkID09PSBcImZ1bmN0aW9uXCIgfHxcbiAgICAgIHRoaXMuaXNMZXQoKSB8fFxuICAgICAgdGhpcy5pc0FzeW5jRnVuY3Rpb24oKVxuICB9O1xuXG4gIC8vIFBhcnNlcyBhIGNvbW1hLXNlcGFyYXRlZCBsaXN0IG9mIG1vZHVsZSBleHBvcnRzLlxuXG4gIHBwJDgucGFyc2VFeHBvcnRTcGVjaWZpZXIgPSBmdW5jdGlvbihleHBvcnRzKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIG5vZGUubG9jYWwgPSB0aGlzLnBhcnNlTW9kdWxlRXhwb3J0TmFtZSgpO1xuXG4gICAgbm9kZS5leHBvcnRlZCA9IHRoaXMuZWF0Q29udGV4dHVhbChcImFzXCIpID8gdGhpcy5wYXJzZU1vZHVsZUV4cG9ydE5hbWUoKSA6IG5vZGUubG9jYWw7XG4gICAgdGhpcy5jaGVja0V4cG9ydChcbiAgICAgIGV4cG9ydHMsXG4gICAgICBub2RlLmV4cG9ydGVkLFxuICAgICAgbm9kZS5leHBvcnRlZC5zdGFydFxuICAgICk7XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiRXhwb3J0U3BlY2lmaWVyXCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUV4cG9ydFNwZWNpZmllcnMgPSBmdW5jdGlvbihleHBvcnRzKSB7XG4gICAgdmFyIG5vZGVzID0gW10sIGZpcnN0ID0gdHJ1ZTtcbiAgICAvLyBleHBvcnQgeyB4LCB5IGFzIHogfSBbZnJvbSAnLi4uJ11cbiAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmJyYWNlTCk7XG4gICAgd2hpbGUgKCF0aGlzLmVhdCh0eXBlcyQxLmJyYWNlUikpIHtcbiAgICAgIGlmICghZmlyc3QpIHtcbiAgICAgICAgdGhpcy5leHBlY3QodHlwZXMkMS5jb21tYSk7XG4gICAgICAgIGlmICh0aGlzLmFmdGVyVHJhaWxpbmdDb21tYSh0eXBlcyQxLmJyYWNlUikpIHsgYnJlYWsgfVxuICAgICAgfSBlbHNlIHsgZmlyc3QgPSBmYWxzZTsgfVxuXG4gICAgICBub2Rlcy5wdXNoKHRoaXMucGFyc2VFeHBvcnRTcGVjaWZpZXIoZXhwb3J0cykpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZXNcbiAgfTtcblxuICAvLyBQYXJzZXMgaW1wb3J0IGRlY2xhcmF0aW9uLlxuXG4gIHBwJDgucGFyc2VJbXBvcnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7XG5cbiAgICAvLyBpbXBvcnQgJy4uLidcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnN0cmluZykge1xuICAgICAgbm9kZS5zcGVjaWZpZXJzID0gZW1wdHkkMTtcbiAgICAgIG5vZGUuc291cmNlID0gdGhpcy5wYXJzZUV4cHJBdG9tKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGUuc3BlY2lmaWVycyA9IHRoaXMucGFyc2VJbXBvcnRTcGVjaWZpZXJzKCk7XG4gICAgICB0aGlzLmV4cGVjdENvbnRleHR1YWwoXCJmcm9tXCIpO1xuICAgICAgbm9kZS5zb3VyY2UgPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEuc3RyaW5nID8gdGhpcy5wYXJzZUV4cHJBdG9tKCkgOiB0aGlzLnVuZXhwZWN0ZWQoKTtcbiAgICB9XG4gICAgdGhpcy5zZW1pY29sb24oKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiSW1wb3J0RGVjbGFyYXRpb25cIilcbiAgfTtcblxuICAvLyBQYXJzZXMgYSBjb21tYS1zZXBhcmF0ZWQgbGlzdCBvZiBtb2R1bGUgaW1wb3J0cy5cblxuICBwcCQ4LnBhcnNlSW1wb3J0U3BlY2lmaWVyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIG5vZGUuaW1wb3J0ZWQgPSB0aGlzLnBhcnNlTW9kdWxlRXhwb3J0TmFtZSgpO1xuXG4gICAgaWYgKHRoaXMuZWF0Q29udGV4dHVhbChcImFzXCIpKSB7XG4gICAgICBub2RlLmxvY2FsID0gdGhpcy5wYXJzZUlkZW50KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY2hlY2tVbnJlc2VydmVkKG5vZGUuaW1wb3J0ZWQpO1xuICAgICAgbm9kZS5sb2NhbCA9IG5vZGUuaW1wb3J0ZWQ7XG4gICAgfVxuICAgIHRoaXMuY2hlY2tMVmFsU2ltcGxlKG5vZGUubG9jYWwsIEJJTkRfTEVYSUNBTCk7XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiSW1wb3J0U3BlY2lmaWVyXCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUltcG9ydERlZmF1bHRTcGVjaWZpZXIgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBpbXBvcnQgZGVmYXVsdE9iaiwgeyB4LCB5IGFzIHogfSBmcm9tICcuLi4nXG4gICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgIG5vZGUubG9jYWwgPSB0aGlzLnBhcnNlSWRlbnQoKTtcbiAgICB0aGlzLmNoZWNrTFZhbFNpbXBsZShub2RlLmxvY2FsLCBCSU5EX0xFWElDQUwpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJJbXBvcnREZWZhdWx0U3BlY2lmaWVyXCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUltcG9ydE5hbWVzcGFjZVNwZWNpZmllciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICB0aGlzLm5leHQoKTtcbiAgICB0aGlzLmV4cGVjdENvbnRleHR1YWwoXCJhc1wiKTtcbiAgICBub2RlLmxvY2FsID0gdGhpcy5wYXJzZUlkZW50KCk7XG4gICAgdGhpcy5jaGVja0xWYWxTaW1wbGUobm9kZS5sb2NhbCwgQklORF9MRVhJQ0FMKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiSW1wb3J0TmFtZXNwYWNlU3BlY2lmaWVyXCIpXG4gIH07XG5cbiAgcHAkOC5wYXJzZUltcG9ydFNwZWNpZmllcnMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbm9kZXMgPSBbXSwgZmlyc3QgPSB0cnVlO1xuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEubmFtZSkge1xuICAgICAgbm9kZXMucHVzaCh0aGlzLnBhcnNlSW1wb3J0RGVmYXVsdFNwZWNpZmllcigpKTtcbiAgICAgIGlmICghdGhpcy5lYXQodHlwZXMkMS5jb21tYSkpIHsgcmV0dXJuIG5vZGVzIH1cbiAgICB9XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5zdGFyKSB7XG4gICAgICBub2Rlcy5wdXNoKHRoaXMucGFyc2VJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXIoKSk7XG4gICAgICByZXR1cm4gbm9kZXNcbiAgICB9XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5icmFjZUwpO1xuICAgIHdoaWxlICghdGhpcy5lYXQodHlwZXMkMS5icmFjZVIpKSB7XG4gICAgICBpZiAoIWZpcnN0KSB7XG4gICAgICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuY29tbWEpO1xuICAgICAgICBpZiAodGhpcy5hZnRlclRyYWlsaW5nQ29tbWEodHlwZXMkMS5icmFjZVIpKSB7IGJyZWFrIH1cbiAgICAgIH0gZWxzZSB7IGZpcnN0ID0gZmFsc2U7IH1cblxuICAgICAgbm9kZXMucHVzaCh0aGlzLnBhcnNlSW1wb3J0U3BlY2lmaWVyKCkpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZXNcbiAgfTtcblxuICBwcCQ4LnBhcnNlTW9kdWxlRXhwb3J0TmFtZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTMgJiYgdGhpcy50eXBlID09PSB0eXBlcyQxLnN0cmluZykge1xuICAgICAgdmFyIHN0cmluZ0xpdGVyYWwgPSB0aGlzLnBhcnNlTGl0ZXJhbCh0aGlzLnZhbHVlKTtcbiAgICAgIGlmIChsb25lU3Vycm9nYXRlLnRlc3Qoc3RyaW5nTGl0ZXJhbC52YWx1ZSkpIHtcbiAgICAgICAgdGhpcy5yYWlzZShzdHJpbmdMaXRlcmFsLnN0YXJ0LCBcIkFuIGV4cG9ydCBuYW1lIGNhbm5vdCBpbmNsdWRlIGEgbG9uZSBzdXJyb2dhdGUuXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0cmluZ0xpdGVyYWxcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFyc2VJZGVudCh0cnVlKVxuICB9O1xuXG4gIC8vIFNldCBgRXhwcmVzc2lvblN0YXRlbWVudCNkaXJlY3RpdmVgIHByb3BlcnR5IGZvciBkaXJlY3RpdmUgcHJvbG9ndWVzLlxuICBwcCQ4LmFkYXB0RGlyZWN0aXZlUHJvbG9ndWUgPSBmdW5jdGlvbihzdGF0ZW1lbnRzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdGF0ZW1lbnRzLmxlbmd0aCAmJiB0aGlzLmlzRGlyZWN0aXZlQ2FuZGlkYXRlKHN0YXRlbWVudHNbaV0pOyArK2kpIHtcbiAgICAgIHN0YXRlbWVudHNbaV0uZGlyZWN0aXZlID0gc3RhdGVtZW50c1tpXS5leHByZXNzaW9uLnJhdy5zbGljZSgxLCAtMSk7XG4gICAgfVxuICB9O1xuICBwcCQ4LmlzRGlyZWN0aXZlQ2FuZGlkYXRlID0gZnVuY3Rpb24oc3RhdGVtZW50KSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA1ICYmXG4gICAgICBzdGF0ZW1lbnQudHlwZSA9PT0gXCJFeHByZXNzaW9uU3RhdGVtZW50XCIgJiZcbiAgICAgIHN0YXRlbWVudC5leHByZXNzaW9uLnR5cGUgPT09IFwiTGl0ZXJhbFwiICYmXG4gICAgICB0eXBlb2Ygc3RhdGVtZW50LmV4cHJlc3Npb24udmFsdWUgPT09IFwic3RyaW5nXCIgJiZcbiAgICAgIC8vIFJlamVjdCBwYXJlbnRoZXNpemVkIHN0cmluZ3MuXG4gICAgICAodGhpcy5pbnB1dFtzdGF0ZW1lbnQuc3RhcnRdID09PSBcIlxcXCJcIiB8fCB0aGlzLmlucHV0W3N0YXRlbWVudC5zdGFydF0gPT09IFwiJ1wiKVxuICAgIClcbiAgfTtcblxuICB2YXIgcHAkNyA9IFBhcnNlci5wcm90b3R5cGU7XG5cbiAgLy8gQ29udmVydCBleGlzdGluZyBleHByZXNzaW9uIGF0b20gdG8gYXNzaWduYWJsZSBwYXR0ZXJuXG4gIC8vIGlmIHBvc3NpYmxlLlxuXG4gIHBwJDcudG9Bc3NpZ25hYmxlID0gZnVuY3Rpb24obm9kZSwgaXNCaW5kaW5nLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ICYmIG5vZGUpIHtcbiAgICAgIHN3aXRjaCAobm9kZS50eXBlKSB7XG4gICAgICBjYXNlIFwiSWRlbnRpZmllclwiOlxuICAgICAgICBpZiAodGhpcy5pbkFzeW5jICYmIG5vZGUubmFtZSA9PT0gXCJhd2FpdFwiKVxuICAgICAgICAgIHsgdGhpcy5yYWlzZShub2RlLnN0YXJ0LCBcIkNhbm5vdCB1c2UgJ2F3YWl0JyBhcyBpZGVudGlmaWVyIGluc2lkZSBhbiBhc3luYyBmdW5jdGlvblwiKTsgfVxuICAgICAgICBicmVha1xuXG4gICAgICBjYXNlIFwiT2JqZWN0UGF0dGVyblwiOlxuICAgICAgY2FzZSBcIkFycmF5UGF0dGVyblwiOlxuICAgICAgY2FzZSBcIkFzc2lnbm1lbnRQYXR0ZXJuXCI6XG4gICAgICBjYXNlIFwiUmVzdEVsZW1lbnRcIjpcbiAgICAgICAgYnJlYWtcblxuICAgICAgY2FzZSBcIk9iamVjdEV4cHJlc3Npb25cIjpcbiAgICAgICAgbm9kZS50eXBlID0gXCJPYmplY3RQYXR0ZXJuXCI7XG4gICAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7IHRoaXMuY2hlY2tQYXR0ZXJuRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIHRydWUpOyB9XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsaXN0ID0gbm9kZS5wcm9wZXJ0aWVzOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgIHZhciBwcm9wID0gbGlzdFtpXTtcblxuICAgICAgICB0aGlzLnRvQXNzaWduYWJsZShwcm9wLCBpc0JpbmRpbmcpO1xuICAgICAgICAgIC8vIEVhcmx5IGVycm9yOlxuICAgICAgICAgIC8vICAgQXNzaWdubWVudFJlc3RQcm9wZXJ0eVtZaWVsZCwgQXdhaXRdIDpcbiAgICAgICAgICAvLyAgICAgYC4uLmAgRGVzdHJ1Y3R1cmluZ0Fzc2lnbm1lbnRUYXJnZXRbWWllbGQsIEF3YWl0XVxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gICBJdCBpcyBhIFN5bnRheCBFcnJvciBpZiB8RGVzdHJ1Y3R1cmluZ0Fzc2lnbm1lbnRUYXJnZXR8IGlzIGFuIHxBcnJheUxpdGVyYWx8IG9yIGFuIHxPYmplY3RMaXRlcmFsfC5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBwcm9wLnR5cGUgPT09IFwiUmVzdEVsZW1lbnRcIiAmJlxuICAgICAgICAgICAgKHByb3AuYXJndW1lbnQudHlwZSA9PT0gXCJBcnJheVBhdHRlcm5cIiB8fCBwcm9wLmFyZ3VtZW50LnR5cGUgPT09IFwiT2JqZWN0UGF0dGVyblwiKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgdGhpcy5yYWlzZShwcm9wLmFyZ3VtZW50LnN0YXJ0LCBcIlVuZXhwZWN0ZWQgdG9rZW5cIik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgXCJQcm9wZXJ0eVwiOlxuICAgICAgICAvLyBBc3NpZ25tZW50UHJvcGVydHkgaGFzIHR5cGUgPT09IFwiUHJvcGVydHlcIlxuICAgICAgICBpZiAobm9kZS5raW5kICE9PSBcImluaXRcIikgeyB0aGlzLnJhaXNlKG5vZGUua2V5LnN0YXJ0LCBcIk9iamVjdCBwYXR0ZXJuIGNhbid0IGNvbnRhaW4gZ2V0dGVyIG9yIHNldHRlclwiKTsgfVxuICAgICAgICB0aGlzLnRvQXNzaWduYWJsZShub2RlLnZhbHVlLCBpc0JpbmRpbmcpO1xuICAgICAgICBicmVha1xuXG4gICAgICBjYXNlIFwiQXJyYXlFeHByZXNzaW9uXCI6XG4gICAgICAgIG5vZGUudHlwZSA9IFwiQXJyYXlQYXR0ZXJuXCI7XG4gICAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7IHRoaXMuY2hlY2tQYXR0ZXJuRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIHRydWUpOyB9XG4gICAgICAgIHRoaXMudG9Bc3NpZ25hYmxlTGlzdChub2RlLmVsZW1lbnRzLCBpc0JpbmRpbmcpO1xuICAgICAgICBicmVha1xuXG4gICAgICBjYXNlIFwiU3ByZWFkRWxlbWVudFwiOlxuICAgICAgICBub2RlLnR5cGUgPSBcIlJlc3RFbGVtZW50XCI7XG4gICAgICAgIHRoaXMudG9Bc3NpZ25hYmxlKG5vZGUuYXJndW1lbnQsIGlzQmluZGluZyk7XG4gICAgICAgIGlmIChub2RlLmFyZ3VtZW50LnR5cGUgPT09IFwiQXNzaWdubWVudFBhdHRlcm5cIilcbiAgICAgICAgICB7IHRoaXMucmFpc2Uobm9kZS5hcmd1bWVudC5zdGFydCwgXCJSZXN0IGVsZW1lbnRzIGNhbm5vdCBoYXZlIGEgZGVmYXVsdCB2YWx1ZVwiKTsgfVxuICAgICAgICBicmVha1xuXG4gICAgICBjYXNlIFwiQXNzaWdubWVudEV4cHJlc3Npb25cIjpcbiAgICAgICAgaWYgKG5vZGUub3BlcmF0b3IgIT09IFwiPVwiKSB7IHRoaXMucmFpc2Uobm9kZS5sZWZ0LmVuZCwgXCJPbmx5ICc9JyBvcGVyYXRvciBjYW4gYmUgdXNlZCBmb3Igc3BlY2lmeWluZyBkZWZhdWx0IHZhbHVlLlwiKTsgfVxuICAgICAgICBub2RlLnR5cGUgPSBcIkFzc2lnbm1lbnRQYXR0ZXJuXCI7XG4gICAgICAgIGRlbGV0ZSBub2RlLm9wZXJhdG9yO1xuICAgICAgICB0aGlzLnRvQXNzaWduYWJsZShub2RlLmxlZnQsIGlzQmluZGluZyk7XG4gICAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgXCJQYXJlbnRoZXNpemVkRXhwcmVzc2lvblwiOlxuICAgICAgICB0aGlzLnRvQXNzaWduYWJsZShub2RlLmV4cHJlc3Npb24sIGlzQmluZGluZywgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgXCJDaGFpbkV4cHJlc3Npb25cIjpcbiAgICAgICAgdGhpcy5yYWlzZVJlY292ZXJhYmxlKG5vZGUuc3RhcnQsIFwiT3B0aW9uYWwgY2hhaW5pbmcgY2Fubm90IGFwcGVhciBpbiBsZWZ0LWhhbmQgc2lkZVwiKTtcbiAgICAgICAgYnJlYWtcblxuICAgICAgY2FzZSBcIk1lbWJlckV4cHJlc3Npb25cIjpcbiAgICAgICAgaWYgKCFpc0JpbmRpbmcpIHsgYnJlYWsgfVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLnJhaXNlKG5vZGUuc3RhcnQsIFwiQXNzaWduaW5nIHRvIHJ2YWx1ZVwiKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHsgdGhpcy5jaGVja1BhdHRlcm5FcnJvcnMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgdHJ1ZSk7IH1cbiAgICByZXR1cm4gbm9kZVxuICB9O1xuXG4gIC8vIENvbnZlcnQgbGlzdCBvZiBleHByZXNzaW9uIGF0b21zIHRvIGJpbmRpbmcgbGlzdC5cblxuICBwcCQ3LnRvQXNzaWduYWJsZUxpc3QgPSBmdW5jdGlvbihleHByTGlzdCwgaXNCaW5kaW5nKSB7XG4gICAgdmFyIGVuZCA9IGV4cHJMaXN0Lmxlbmd0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB2YXIgZWx0ID0gZXhwckxpc3RbaV07XG4gICAgICBpZiAoZWx0KSB7IHRoaXMudG9Bc3NpZ25hYmxlKGVsdCwgaXNCaW5kaW5nKTsgfVxuICAgIH1cbiAgICBpZiAoZW5kKSB7XG4gICAgICB2YXIgbGFzdCA9IGV4cHJMaXN0W2VuZCAtIDFdO1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA9PT0gNiAmJiBpc0JpbmRpbmcgJiYgbGFzdCAmJiBsYXN0LnR5cGUgPT09IFwiUmVzdEVsZW1lbnRcIiAmJiBsYXN0LmFyZ3VtZW50LnR5cGUgIT09IFwiSWRlbnRpZmllclwiKVxuICAgICAgICB7IHRoaXMudW5leHBlY3RlZChsYXN0LmFyZ3VtZW50LnN0YXJ0KTsgfVxuICAgIH1cbiAgICByZXR1cm4gZXhwckxpc3RcbiAgfTtcblxuICAvLyBQYXJzZXMgc3ByZWFkIGVsZW1lbnQuXG5cbiAgcHAkNy5wYXJzZVNwcmVhZCA9IGZ1bmN0aW9uKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgbm9kZS5hcmd1bWVudCA9IHRoaXMucGFyc2VNYXliZUFzc2lnbihmYWxzZSwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlNwcmVhZEVsZW1lbnRcIilcbiAgfTtcblxuICBwcCQ3LnBhcnNlUmVzdEJpbmRpbmcgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgdGhpcy5uZXh0KCk7XG5cbiAgICAvLyBSZXN0RWxlbWVudCBpbnNpZGUgb2YgYSBmdW5jdGlvbiBwYXJhbWV0ZXIgbXVzdCBiZSBhbiBpZGVudGlmaWVyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA9PT0gNiAmJiB0aGlzLnR5cGUgIT09IHR5cGVzJDEubmFtZSlcbiAgICAgIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cblxuICAgIG5vZGUuYXJndW1lbnQgPSB0aGlzLnBhcnNlQmluZGluZ0F0b20oKTtcblxuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJSZXN0RWxlbWVudFwiKVxuICB9O1xuXG4gIC8vIFBhcnNlcyBsdmFsdWUgKGFzc2lnbmFibGUpIGF0b20uXG5cbiAgcHAkNy5wYXJzZUJpbmRpbmdBdG9tID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2KSB7XG4gICAgICBzd2l0Y2ggKHRoaXMudHlwZSkge1xuICAgICAgY2FzZSB0eXBlcyQxLmJyYWNrZXRMOlxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgICBub2RlLmVsZW1lbnRzID0gdGhpcy5wYXJzZUJpbmRpbmdMaXN0KHR5cGVzJDEuYnJhY2tldFIsIHRydWUsIHRydWUpO1xuICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiQXJyYXlQYXR0ZXJuXCIpXG5cbiAgICAgIGNhc2UgdHlwZXMkMS5icmFjZUw6XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlT2JqKHRydWUpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBhcnNlSWRlbnQoKVxuICB9O1xuXG4gIHBwJDcucGFyc2VCaW5kaW5nTGlzdCA9IGZ1bmN0aW9uKGNsb3NlLCBhbGxvd0VtcHR5LCBhbGxvd1RyYWlsaW5nQ29tbWEsIGFsbG93TW9kaWZpZXJzKSB7XG4gICAgdmFyIGVsdHMgPSBbXSwgZmlyc3QgPSB0cnVlO1xuICAgIHdoaWxlICghdGhpcy5lYXQoY2xvc2UpKSB7XG4gICAgICBpZiAoZmlyc3QpIHsgZmlyc3QgPSBmYWxzZTsgfVxuICAgICAgZWxzZSB7IHRoaXMuZXhwZWN0KHR5cGVzJDEuY29tbWEpOyB9XG4gICAgICBpZiAoYWxsb3dFbXB0eSAmJiB0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29tbWEpIHtcbiAgICAgICAgZWx0cy5wdXNoKG51bGwpO1xuICAgICAgfSBlbHNlIGlmIChhbGxvd1RyYWlsaW5nQ29tbWEgJiYgdGhpcy5hZnRlclRyYWlsaW5nQ29tbWEoY2xvc2UpKSB7XG4gICAgICAgIGJyZWFrXG4gICAgICB9IGVsc2UgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5lbGxpcHNpcykge1xuICAgICAgICB2YXIgcmVzdCA9IHRoaXMucGFyc2VSZXN0QmluZGluZygpO1xuICAgICAgICB0aGlzLnBhcnNlQmluZGluZ0xpc3RJdGVtKHJlc3QpO1xuICAgICAgICBlbHRzLnB1c2gocmVzdCk7XG4gICAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29tbWEpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHRoaXMuc3RhcnQsIFwiQ29tbWEgaXMgbm90IHBlcm1pdHRlZCBhZnRlciB0aGUgcmVzdCBlbGVtZW50XCIpOyB9XG4gICAgICAgIHRoaXMuZXhwZWN0KGNsb3NlKTtcbiAgICAgICAgYnJlYWtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsdHMucHVzaCh0aGlzLnBhcnNlQXNzaWduYWJsZUxpc3RJdGVtKGFsbG93TW9kaWZpZXJzKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBlbHRzXG4gIH07XG5cbiAgcHAkNy5wYXJzZUFzc2lnbmFibGVMaXN0SXRlbSA9IGZ1bmN0aW9uKGFsbG93TW9kaWZpZXJzKSB7XG4gICAgdmFyIGVsZW0gPSB0aGlzLnBhcnNlTWF5YmVEZWZhdWx0KHRoaXMuc3RhcnQsIHRoaXMuc3RhcnRMb2MpO1xuICAgIHRoaXMucGFyc2VCaW5kaW5nTGlzdEl0ZW0oZWxlbSk7XG4gICAgcmV0dXJuIGVsZW1cbiAgfTtcblxuICBwcCQ3LnBhcnNlQmluZGluZ0xpc3RJdGVtID0gZnVuY3Rpb24ocGFyYW0pIHtcbiAgICByZXR1cm4gcGFyYW1cbiAgfTtcblxuICAvLyBQYXJzZXMgYXNzaWdubWVudCBwYXR0ZXJuIGFyb3VuZCBnaXZlbiBhdG9tIGlmIHBvc3NpYmxlLlxuXG4gIHBwJDcucGFyc2VNYXliZURlZmF1bHQgPSBmdW5jdGlvbihzdGFydFBvcywgc3RhcnRMb2MsIGxlZnQpIHtcbiAgICBsZWZ0ID0gbGVmdCB8fCB0aGlzLnBhcnNlQmluZGluZ0F0b20oKTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uIDwgNiB8fCAhdGhpcy5lYXQodHlwZXMkMS5lcSkpIHsgcmV0dXJuIGxlZnQgfVxuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgIG5vZGUubGVmdCA9IGxlZnQ7XG4gICAgbm9kZS5yaWdodCA9IHRoaXMucGFyc2VNYXliZUFzc2lnbigpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJBc3NpZ25tZW50UGF0dGVyblwiKVxuICB9O1xuXG4gIC8vIFRoZSBmb2xsb3dpbmcgdGhyZWUgZnVuY3Rpb25zIGFsbCB2ZXJpZnkgdGhhdCBhIG5vZGUgaXMgYW4gbHZhbHVlIOKAlFxuICAvLyBzb21ldGhpbmcgdGhhdCBjYW4gYmUgYm91bmQsIG9yIGFzc2lnbmVkIHRvLiBJbiBvcmRlciB0byBkbyBzbywgdGhleSBwZXJmb3JtXG4gIC8vIGEgdmFyaWV0eSBvZiBjaGVja3M6XG4gIC8vXG4gIC8vIC0gQ2hlY2sgdGhhdCBub25lIG9mIHRoZSBib3VuZC9hc3NpZ25lZC10byBpZGVudGlmaWVycyBhcmUgcmVzZXJ2ZWQgd29yZHMuXG4gIC8vIC0gUmVjb3JkIG5hbWUgZGVjbGFyYXRpb25zIGZvciBiaW5kaW5ncyBpbiB0aGUgYXBwcm9wcmlhdGUgc2NvcGUuXG4gIC8vIC0gQ2hlY2sgZHVwbGljYXRlIGFyZ3VtZW50IG5hbWVzLCBpZiBjaGVja0NsYXNoZXMgaXMgc2V0LlxuICAvL1xuICAvLyBJZiBhIGNvbXBsZXggYmluZGluZyBwYXR0ZXJuIGlzIGVuY291bnRlcmVkIChlLmcuLCBvYmplY3QgYW5kIGFycmF5XG4gIC8vIGRlc3RydWN0dXJpbmcpLCB0aGUgZW50aXJlIHBhdHRlcm4gaXMgcmVjdXJzaXZlbHkgY2hlY2tlZC5cbiAgLy9cbiAgLy8gVGhlcmUgYXJlIHRocmVlIHZlcnNpb25zIG9mIGNoZWNrTFZhbCooKSBhcHByb3ByaWF0ZSBmb3IgZGlmZmVyZW50XG4gIC8vIGNpcmN1bXN0YW5jZXM6XG4gIC8vXG4gIC8vIC0gY2hlY2tMVmFsU2ltcGxlKCkgc2hhbGwgYmUgdXNlZCBpZiB0aGUgc3ludGFjdGljIGNvbnN0cnVjdCBzdXBwb3J0c1xuICAvLyAgIG5vdGhpbmcgb3RoZXIgdGhhbiBpZGVudGlmaWVycyBhbmQgbWVtYmVyIGV4cHJlc3Npb25zLiBQYXJlbnRoZXNpemVkXG4gIC8vICAgZXhwcmVzc2lvbnMgYXJlIGFsc28gY29ycmVjdGx5IGhhbmRsZWQuIFRoaXMgaXMgZ2VuZXJhbGx5IGFwcHJvcHJpYXRlIGZvclxuICAvLyAgIGNvbnN0cnVjdHMgZm9yIHdoaWNoIHRoZSBzcGVjIHNheXNcbiAgLy9cbiAgLy8gICA+IEl0IGlzIGEgU3ludGF4IEVycm9yIGlmIEFzc2lnbm1lbnRUYXJnZXRUeXBlIG9mIFt0aGUgcHJvZHVjdGlvbl0gaXMgbm90XG4gIC8vICAgPiBzaW1wbGUuXG4gIC8vXG4gIC8vICAgSXQgaXMgYWxzbyBhcHByb3ByaWF0ZSBmb3IgY2hlY2tpbmcgaWYgYW4gaWRlbnRpZmllciBpcyB2YWxpZCBhbmQgbm90XG4gIC8vICAgZGVmaW5lZCBlbHNld2hlcmUsIGxpa2UgaW1wb3J0IGRlY2xhcmF0aW9ucyBvciBmdW5jdGlvbi9jbGFzcyBpZGVudGlmaWVycy5cbiAgLy9cbiAgLy8gICBFeGFtcGxlcyB3aGVyZSB0aGlzIGlzIHVzZWQgaW5jbHVkZTpcbiAgLy8gICAgIGEgKz0g4oCmO1xuICAvLyAgICAgaW1wb3J0IGEgZnJvbSAn4oCmJztcbiAgLy8gICB3aGVyZSBhIGlzIHRoZSBub2RlIHRvIGJlIGNoZWNrZWQuXG4gIC8vXG4gIC8vIC0gY2hlY2tMVmFsUGF0dGVybigpIHNoYWxsIGJlIHVzZWQgaWYgdGhlIHN5bnRhY3RpYyBjb25zdHJ1Y3Qgc3VwcG9ydHNcbiAgLy8gICBhbnl0aGluZyBjaGVja0xWYWxTaW1wbGUoKSBzdXBwb3J0cywgYXMgd2VsbCBhcyBvYmplY3QgYW5kIGFycmF5XG4gIC8vICAgZGVzdHJ1Y3R1cmluZyBwYXR0ZXJucy4gVGhpcyBpcyBnZW5lcmFsbHkgYXBwcm9wcmlhdGUgZm9yIGNvbnN0cnVjdHMgZm9yXG4gIC8vICAgd2hpY2ggdGhlIHNwZWMgc2F5c1xuICAvL1xuICAvLyAgID4gSXQgaXMgYSBTeW50YXggRXJyb3IgaWYgW3RoZSBwcm9kdWN0aW9uXSBpcyBuZWl0aGVyIGFuIE9iamVjdExpdGVyYWwgbm9yXG4gIC8vICAgPiBhbiBBcnJheUxpdGVyYWwgYW5kIEFzc2lnbm1lbnRUYXJnZXRUeXBlIG9mIFt0aGUgcHJvZHVjdGlvbl0gaXMgbm90XG4gIC8vICAgPiBzaW1wbGUuXG4gIC8vXG4gIC8vICAgRXhhbXBsZXMgd2hlcmUgdGhpcyBpcyB1c2VkIGluY2x1ZGU6XG4gIC8vICAgICAoYSA9IOKApik7XG4gIC8vICAgICBjb25zdCBhID0g4oCmO1xuICAvLyAgICAgdHJ5IHsg4oCmIH0gY2F0Y2ggKGEpIHsg4oCmIH1cbiAgLy8gICB3aGVyZSBhIGlzIHRoZSBub2RlIHRvIGJlIGNoZWNrZWQuXG4gIC8vXG4gIC8vIC0gY2hlY2tMVmFsSW5uZXJQYXR0ZXJuKCkgc2hhbGwgYmUgdXNlZCBpZiB0aGUgc3ludGFjdGljIGNvbnN0cnVjdCBzdXBwb3J0c1xuICAvLyAgIGFueXRoaW5nIGNoZWNrTFZhbFBhdHRlcm4oKSBzdXBwb3J0cywgYXMgd2VsbCBhcyBkZWZhdWx0IGFzc2lnbm1lbnRcbiAgLy8gICBwYXR0ZXJucywgcmVzdCBlbGVtZW50cywgYW5kIG90aGVyIGNvbnN0cnVjdHMgdGhhdCBtYXkgYXBwZWFyIHdpdGhpbiBhblxuICAvLyAgIG9iamVjdCBvciBhcnJheSBkZXN0cnVjdHVyaW5nIHBhdHRlcm4uXG4gIC8vXG4gIC8vICAgQXMgYSBzcGVjaWFsIGNhc2UsIGZ1bmN0aW9uIHBhcmFtZXRlcnMgYWxzbyB1c2UgY2hlY2tMVmFsSW5uZXJQYXR0ZXJuKCksXG4gIC8vICAgYXMgdGhleSBhbHNvIHN1cHBvcnQgZGVmYXVsdHMgYW5kIHJlc3QgY29uc3RydWN0cy5cbiAgLy9cbiAgLy8gVGhlc2UgZnVuY3Rpb25zIGRlbGliZXJhdGVseSBzdXBwb3J0IGJvdGggYXNzaWdubWVudCBhbmQgYmluZGluZyBjb25zdHJ1Y3RzLFxuICAvLyBhcyB0aGUgbG9naWMgZm9yIGJvdGggaXMgZXhjZWVkaW5nbHkgc2ltaWxhci4gSWYgdGhlIG5vZGUgaXMgdGhlIHRhcmdldCBvZlxuICAvLyBhbiBhc3NpZ25tZW50LCB0aGVuIGJpbmRpbmdUeXBlIHNob3VsZCBiZSBzZXQgdG8gQklORF9OT05FLiBPdGhlcndpc2UsIGl0XG4gIC8vIHNob3VsZCBiZSBzZXQgdG8gdGhlIGFwcHJvcHJpYXRlIEJJTkRfKiBjb25zdGFudCwgbGlrZSBCSU5EX1ZBUiBvclxuICAvLyBCSU5EX0xFWElDQUwuXG4gIC8vXG4gIC8vIElmIHRoZSBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCBhIG5vbi1CSU5EX05PTkUgYmluZGluZ1R5cGUsIHRoZW5cbiAgLy8gYWRkaXRpb25hbGx5IGEgY2hlY2tDbGFzaGVzIG9iamVjdCBtYXkgYmUgc3BlY2lmaWVkIHRvIGFsbG93IGNoZWNraW5nIGZvclxuICAvLyBkdXBsaWNhdGUgYXJndW1lbnQgbmFtZXMuIGNoZWNrQ2xhc2hlcyBpcyBpZ25vcmVkIGlmIHRoZSBwcm92aWRlZCBjb25zdHJ1Y3RcbiAgLy8gaXMgYW4gYXNzaWdubWVudCAoaS5lLiwgYmluZGluZ1R5cGUgaXMgQklORF9OT05FKS5cblxuICBwcCQ3LmNoZWNrTFZhbFNpbXBsZSA9IGZ1bmN0aW9uKGV4cHIsIGJpbmRpbmdUeXBlLCBjaGVja0NsYXNoZXMpIHtcbiAgICBpZiAoIGJpbmRpbmdUeXBlID09PSB2b2lkIDAgKSBiaW5kaW5nVHlwZSA9IEJJTkRfTk9ORTtcblxuICAgIHZhciBpc0JpbmQgPSBiaW5kaW5nVHlwZSAhPT0gQklORF9OT05FO1xuXG4gICAgc3dpdGNoIChleHByLnR5cGUpIHtcbiAgICBjYXNlIFwiSWRlbnRpZmllclwiOlxuICAgICAgaWYgKHRoaXMuc3RyaWN0ICYmIHRoaXMucmVzZXJ2ZWRXb3Jkc1N0cmljdEJpbmQudGVzdChleHByLm5hbWUpKVxuICAgICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShleHByLnN0YXJ0LCAoaXNCaW5kID8gXCJCaW5kaW5nIFwiIDogXCJBc3NpZ25pbmcgdG8gXCIpICsgZXhwci5uYW1lICsgXCIgaW4gc3RyaWN0IG1vZGVcIik7IH1cbiAgICAgIGlmIChpc0JpbmQpIHtcbiAgICAgICAgaWYgKGJpbmRpbmdUeXBlID09PSBCSU5EX0xFWElDQUwgJiYgZXhwci5uYW1lID09PSBcImxldFwiKVxuICAgICAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKGV4cHIuc3RhcnQsIFwibGV0IGlzIGRpc2FsbG93ZWQgYXMgYSBsZXhpY2FsbHkgYm91bmQgbmFtZVwiKTsgfVxuICAgICAgICBpZiAoY2hlY2tDbGFzaGVzKSB7XG4gICAgICAgICAgaWYgKGhhc093bihjaGVja0NsYXNoZXMsIGV4cHIubmFtZSkpXG4gICAgICAgICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShleHByLnN0YXJ0LCBcIkFyZ3VtZW50IG5hbWUgY2xhc2hcIik7IH1cbiAgICAgICAgICBjaGVja0NsYXNoZXNbZXhwci5uYW1lXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJpbmRpbmdUeXBlICE9PSBCSU5EX09VVFNJREUpIHsgdGhpcy5kZWNsYXJlTmFtZShleHByLm5hbWUsIGJpbmRpbmdUeXBlLCBleHByLnN0YXJ0KTsgfVxuICAgICAgfVxuICAgICAgYnJlYWtcblxuICAgIGNhc2UgXCJDaGFpbkV4cHJlc3Npb25cIjpcbiAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZShleHByLnN0YXJ0LCBcIk9wdGlvbmFsIGNoYWluaW5nIGNhbm5vdCBhcHBlYXIgaW4gbGVmdC1oYW5kIHNpZGVcIik7XG4gICAgICBicmVha1xuXG4gICAgY2FzZSBcIk1lbWJlckV4cHJlc3Npb25cIjpcbiAgICAgIGlmIChpc0JpbmQpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKGV4cHIuc3RhcnQsIFwiQmluZGluZyBtZW1iZXIgZXhwcmVzc2lvblwiKTsgfVxuICAgICAgYnJlYWtcblxuICAgIGNhc2UgXCJQYXJlbnRoZXNpemVkRXhwcmVzc2lvblwiOlxuICAgICAgaWYgKGlzQmluZCkgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUoZXhwci5zdGFydCwgXCJCaW5kaW5nIHBhcmVudGhlc2l6ZWQgZXhwcmVzc2lvblwiKTsgfVxuICAgICAgcmV0dXJuIHRoaXMuY2hlY2tMVmFsU2ltcGxlKGV4cHIuZXhwcmVzc2lvbiwgYmluZGluZ1R5cGUsIGNoZWNrQ2xhc2hlcylcblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aGlzLnJhaXNlKGV4cHIuc3RhcnQsIChpc0JpbmQgPyBcIkJpbmRpbmdcIiA6IFwiQXNzaWduaW5nIHRvXCIpICsgXCIgcnZhbHVlXCIpO1xuICAgIH1cbiAgfTtcblxuICBwcCQ3LmNoZWNrTFZhbFBhdHRlcm4gPSBmdW5jdGlvbihleHByLCBiaW5kaW5nVHlwZSwgY2hlY2tDbGFzaGVzKSB7XG4gICAgaWYgKCBiaW5kaW5nVHlwZSA9PT0gdm9pZCAwICkgYmluZGluZ1R5cGUgPSBCSU5EX05PTkU7XG5cbiAgICBzd2l0Y2ggKGV4cHIudHlwZSkge1xuICAgIGNhc2UgXCJPYmplY3RQYXR0ZXJuXCI6XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGlzdCA9IGV4cHIucHJvcGVydGllczsgaSA8IGxpc3QubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgdmFyIHByb3AgPSBsaXN0W2ldO1xuXG4gICAgICB0aGlzLmNoZWNrTFZhbElubmVyUGF0dGVybihwcm9wLCBiaW5kaW5nVHlwZSwgY2hlY2tDbGFzaGVzKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlIFwiQXJyYXlQYXR0ZXJuXCI6XG4gICAgICBmb3IgKHZhciBpJDEgPSAwLCBsaXN0JDEgPSBleHByLmVsZW1lbnRzOyBpJDEgPCBsaXN0JDEubGVuZ3RoOyBpJDEgKz0gMSkge1xuICAgICAgICB2YXIgZWxlbSA9IGxpc3QkMVtpJDFdO1xuXG4gICAgICBpZiAoZWxlbSkgeyB0aGlzLmNoZWNrTFZhbElubmVyUGF0dGVybihlbGVtLCBiaW5kaW5nVHlwZSwgY2hlY2tDbGFzaGVzKTsgfVxuICAgICAgfVxuICAgICAgYnJlYWtcblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aGlzLmNoZWNrTFZhbFNpbXBsZShleHByLCBiaW5kaW5nVHlwZSwgY2hlY2tDbGFzaGVzKTtcbiAgICB9XG4gIH07XG5cbiAgcHAkNy5jaGVja0xWYWxJbm5lclBhdHRlcm4gPSBmdW5jdGlvbihleHByLCBiaW5kaW5nVHlwZSwgY2hlY2tDbGFzaGVzKSB7XG4gICAgaWYgKCBiaW5kaW5nVHlwZSA9PT0gdm9pZCAwICkgYmluZGluZ1R5cGUgPSBCSU5EX05PTkU7XG5cbiAgICBzd2l0Y2ggKGV4cHIudHlwZSkge1xuICAgIGNhc2UgXCJQcm9wZXJ0eVwiOlxuICAgICAgLy8gQXNzaWdubWVudFByb3BlcnR5IGhhcyB0eXBlID09PSBcIlByb3BlcnR5XCJcbiAgICAgIHRoaXMuY2hlY2tMVmFsSW5uZXJQYXR0ZXJuKGV4cHIudmFsdWUsIGJpbmRpbmdUeXBlLCBjaGVja0NsYXNoZXMpO1xuICAgICAgYnJlYWtcblxuICAgIGNhc2UgXCJBc3NpZ25tZW50UGF0dGVyblwiOlxuICAgICAgdGhpcy5jaGVja0xWYWxQYXR0ZXJuKGV4cHIubGVmdCwgYmluZGluZ1R5cGUsIGNoZWNrQ2xhc2hlcyk7XG4gICAgICBicmVha1xuXG4gICAgY2FzZSBcIlJlc3RFbGVtZW50XCI6XG4gICAgICB0aGlzLmNoZWNrTFZhbFBhdHRlcm4oZXhwci5hcmd1bWVudCwgYmluZGluZ1R5cGUsIGNoZWNrQ2xhc2hlcyk7XG4gICAgICBicmVha1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHRoaXMuY2hlY2tMVmFsUGF0dGVybihleHByLCBiaW5kaW5nVHlwZSwgY2hlY2tDbGFzaGVzKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gVGhlIGFsZ29yaXRobSB1c2VkIHRvIGRldGVybWluZSB3aGV0aGVyIGEgcmVnZXhwIGNhbiBhcHBlYXIgYXQgYVxuICAvLyBnaXZlbiBwb2ludCBpbiB0aGUgcHJvZ3JhbSBpcyBsb29zZWx5IGJhc2VkIG9uIHN3ZWV0LmpzJyBhcHByb2FjaC5cbiAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhL3N3ZWV0LmpzL3dpa2kvZGVzaWduXG5cblxuICB2YXIgVG9rQ29udGV4dCA9IGZ1bmN0aW9uIFRva0NvbnRleHQodG9rZW4sIGlzRXhwciwgcHJlc2VydmVTcGFjZSwgb3ZlcnJpZGUsIGdlbmVyYXRvcikge1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLmlzRXhwciA9ICEhaXNFeHByO1xuICAgIHRoaXMucHJlc2VydmVTcGFjZSA9ICEhcHJlc2VydmVTcGFjZTtcbiAgICB0aGlzLm92ZXJyaWRlID0gb3ZlcnJpZGU7XG4gICAgdGhpcy5nZW5lcmF0b3IgPSAhIWdlbmVyYXRvcjtcbiAgfTtcblxuICB2YXIgdHlwZXMgPSB7XG4gICAgYl9zdGF0OiBuZXcgVG9rQ29udGV4dChcIntcIiwgZmFsc2UpLFxuICAgIGJfZXhwcjogbmV3IFRva0NvbnRleHQoXCJ7XCIsIHRydWUpLFxuICAgIGJfdG1wbDogbmV3IFRva0NvbnRleHQoXCIke1wiLCBmYWxzZSksXG4gICAgcF9zdGF0OiBuZXcgVG9rQ29udGV4dChcIihcIiwgZmFsc2UpLFxuICAgIHBfZXhwcjogbmV3IFRva0NvbnRleHQoXCIoXCIsIHRydWUpLFxuICAgIHFfdG1wbDogbmV3IFRva0NvbnRleHQoXCJgXCIsIHRydWUsIHRydWUsIGZ1bmN0aW9uIChwKSB7IHJldHVybiBwLnRyeVJlYWRUZW1wbGF0ZVRva2VuKCk7IH0pLFxuICAgIGZfc3RhdDogbmV3IFRva0NvbnRleHQoXCJmdW5jdGlvblwiLCBmYWxzZSksXG4gICAgZl9leHByOiBuZXcgVG9rQ29udGV4dChcImZ1bmN0aW9uXCIsIHRydWUpLFxuICAgIGZfZXhwcl9nZW46IG5ldyBUb2tDb250ZXh0KFwiZnVuY3Rpb25cIiwgdHJ1ZSwgZmFsc2UsIG51bGwsIHRydWUpLFxuICAgIGZfZ2VuOiBuZXcgVG9rQ29udGV4dChcImZ1bmN0aW9uXCIsIGZhbHNlLCBmYWxzZSwgbnVsbCwgdHJ1ZSlcbiAgfTtcblxuICB2YXIgcHAkNiA9IFBhcnNlci5wcm90b3R5cGU7XG5cbiAgcHAkNi5pbml0aWFsQ29udGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBbdHlwZXMuYl9zdGF0XVxuICB9O1xuXG4gIHBwJDYuY3VyQ29udGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnRleHRbdGhpcy5jb250ZXh0Lmxlbmd0aCAtIDFdXG4gIH07XG5cbiAgcHAkNi5icmFjZUlzQmxvY2sgPSBmdW5jdGlvbihwcmV2VHlwZSkge1xuICAgIHZhciBwYXJlbnQgPSB0aGlzLmN1ckNvbnRleHQoKTtcbiAgICBpZiAocGFyZW50ID09PSB0eXBlcy5mX2V4cHIgfHwgcGFyZW50ID09PSB0eXBlcy5mX3N0YXQpXG4gICAgICB7IHJldHVybiB0cnVlIH1cbiAgICBpZiAocHJldlR5cGUgPT09IHR5cGVzJDEuY29sb24gJiYgKHBhcmVudCA9PT0gdHlwZXMuYl9zdGF0IHx8IHBhcmVudCA9PT0gdHlwZXMuYl9leHByKSlcbiAgICAgIHsgcmV0dXJuICFwYXJlbnQuaXNFeHByIH1cblxuICAgIC8vIFRoZSBjaGVjayBmb3IgYHR0Lm5hbWUgJiYgZXhwckFsbG93ZWRgIGRldGVjdHMgd2hldGhlciB3ZSBhcmVcbiAgICAvLyBhZnRlciBhIGB5aWVsZGAgb3IgYG9mYCBjb25zdHJ1Y3QuIFNlZSB0aGUgYHVwZGF0ZUNvbnRleHRgIGZvclxuICAgIC8vIGB0dC5uYW1lYC5cbiAgICBpZiAocHJldlR5cGUgPT09IHR5cGVzJDEuX3JldHVybiB8fCBwcmV2VHlwZSA9PT0gdHlwZXMkMS5uYW1lICYmIHRoaXMuZXhwckFsbG93ZWQpXG4gICAgICB7IHJldHVybiBsaW5lQnJlYWsudGVzdCh0aGlzLmlucHV0LnNsaWNlKHRoaXMubGFzdFRva0VuZCwgdGhpcy5zdGFydCkpIH1cbiAgICBpZiAocHJldlR5cGUgPT09IHR5cGVzJDEuX2Vsc2UgfHwgcHJldlR5cGUgPT09IHR5cGVzJDEuc2VtaSB8fCBwcmV2VHlwZSA9PT0gdHlwZXMkMS5lb2YgfHwgcHJldlR5cGUgPT09IHR5cGVzJDEucGFyZW5SIHx8IHByZXZUeXBlID09PSB0eXBlcyQxLmFycm93KVxuICAgICAgeyByZXR1cm4gdHJ1ZSB9XG4gICAgaWYgKHByZXZUeXBlID09PSB0eXBlcyQxLmJyYWNlTClcbiAgICAgIHsgcmV0dXJuIHBhcmVudCA9PT0gdHlwZXMuYl9zdGF0IH1cbiAgICBpZiAocHJldlR5cGUgPT09IHR5cGVzJDEuX3ZhciB8fCBwcmV2VHlwZSA9PT0gdHlwZXMkMS5fY29uc3QgfHwgcHJldlR5cGUgPT09IHR5cGVzJDEubmFtZSlcbiAgICAgIHsgcmV0dXJuIGZhbHNlIH1cbiAgICByZXR1cm4gIXRoaXMuZXhwckFsbG93ZWRcbiAgfTtcblxuICBwcCQ2LmluR2VuZXJhdG9yQ29udGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLmNvbnRleHQubGVuZ3RoIC0gMTsgaSA+PSAxOyBpLS0pIHtcbiAgICAgIHZhciBjb250ZXh0ID0gdGhpcy5jb250ZXh0W2ldO1xuICAgICAgaWYgKGNvbnRleHQudG9rZW4gPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgeyByZXR1cm4gY29udGV4dC5nZW5lcmF0b3IgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICBwcCQ2LnVwZGF0ZUNvbnRleHQgPSBmdW5jdGlvbihwcmV2VHlwZSkge1xuICAgIHZhciB1cGRhdGUsIHR5cGUgPSB0aGlzLnR5cGU7XG4gICAgaWYgKHR5cGUua2V5d29yZCAmJiBwcmV2VHlwZSA9PT0gdHlwZXMkMS5kb3QpXG4gICAgICB7IHRoaXMuZXhwckFsbG93ZWQgPSBmYWxzZTsgfVxuICAgIGVsc2UgaWYgKHVwZGF0ZSA9IHR5cGUudXBkYXRlQ29udGV4dClcbiAgICAgIHsgdXBkYXRlLmNhbGwodGhpcywgcHJldlR5cGUpOyB9XG4gICAgZWxzZVxuICAgICAgeyB0aGlzLmV4cHJBbGxvd2VkID0gdHlwZS5iZWZvcmVFeHByOyB9XG4gIH07XG5cbiAgLy8gVXNlZCB0byBoYW5kbGUgZWdkZSBjYXNlcyB3aGVuIHRva2VuIGNvbnRleHQgY291bGQgbm90IGJlIGluZmVycmVkIGNvcnJlY3RseSBkdXJpbmcgdG9rZW5pemF0aW9uIHBoYXNlXG5cbiAgcHAkNi5vdmVycmlkZUNvbnRleHQgPSBmdW5jdGlvbih0b2tlbkN0eCkge1xuICAgIGlmICh0aGlzLmN1ckNvbnRleHQoKSAhPT0gdG9rZW5DdHgpIHtcbiAgICAgIHRoaXMuY29udGV4dFt0aGlzLmNvbnRleHQubGVuZ3RoIC0gMV0gPSB0b2tlbkN0eDtcbiAgICB9XG4gIH07XG5cbiAgLy8gVG9rZW4tc3BlY2lmaWMgY29udGV4dCB1cGRhdGUgY29kZVxuXG4gIHR5cGVzJDEucGFyZW5SLnVwZGF0ZUNvbnRleHQgPSB0eXBlcyQxLmJyYWNlUi51cGRhdGVDb250ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuY29udGV4dC5sZW5ndGggPT09IDEpIHtcbiAgICAgIHRoaXMuZXhwckFsbG93ZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHZhciBvdXQgPSB0aGlzLmNvbnRleHQucG9wKCk7XG4gICAgaWYgKG91dCA9PT0gdHlwZXMuYl9zdGF0ICYmIHRoaXMuY3VyQ29udGV4dCgpLnRva2VuID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIG91dCA9IHRoaXMuY29udGV4dC5wb3AoKTtcbiAgICB9XG4gICAgdGhpcy5leHByQWxsb3dlZCA9ICFvdXQuaXNFeHByO1xuICB9O1xuXG4gIHR5cGVzJDEuYnJhY2VMLnVwZGF0ZUNvbnRleHQgPSBmdW5jdGlvbihwcmV2VHlwZSkge1xuICAgIHRoaXMuY29udGV4dC5wdXNoKHRoaXMuYnJhY2VJc0Jsb2NrKHByZXZUeXBlKSA/IHR5cGVzLmJfc3RhdCA6IHR5cGVzLmJfZXhwcik7XG4gICAgdGhpcy5leHByQWxsb3dlZCA9IHRydWU7XG4gIH07XG5cbiAgdHlwZXMkMS5kb2xsYXJCcmFjZUwudXBkYXRlQ29udGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGV4dC5wdXNoKHR5cGVzLmJfdG1wbCk7XG4gICAgdGhpcy5leHByQWxsb3dlZCA9IHRydWU7XG4gIH07XG5cbiAgdHlwZXMkMS5wYXJlbkwudXBkYXRlQ29udGV4dCA9IGZ1bmN0aW9uKHByZXZUeXBlKSB7XG4gICAgdmFyIHN0YXRlbWVudFBhcmVucyA9IHByZXZUeXBlID09PSB0eXBlcyQxLl9pZiB8fCBwcmV2VHlwZSA9PT0gdHlwZXMkMS5fZm9yIHx8IHByZXZUeXBlID09PSB0eXBlcyQxLl93aXRoIHx8IHByZXZUeXBlID09PSB0eXBlcyQxLl93aGlsZTtcbiAgICB0aGlzLmNvbnRleHQucHVzaChzdGF0ZW1lbnRQYXJlbnMgPyB0eXBlcy5wX3N0YXQgOiB0eXBlcy5wX2V4cHIpO1xuICAgIHRoaXMuZXhwckFsbG93ZWQgPSB0cnVlO1xuICB9O1xuXG4gIHR5cGVzJDEuaW5jRGVjLnVwZGF0ZUNvbnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICAvLyB0b2tFeHByQWxsb3dlZCBzdGF5cyB1bmNoYW5nZWRcbiAgfTtcblxuICB0eXBlcyQxLl9mdW5jdGlvbi51cGRhdGVDb250ZXh0ID0gdHlwZXMkMS5fY2xhc3MudXBkYXRlQ29udGV4dCA9IGZ1bmN0aW9uKHByZXZUeXBlKSB7XG4gICAgaWYgKHByZXZUeXBlLmJlZm9yZUV4cHIgJiYgcHJldlR5cGUgIT09IHR5cGVzJDEuX2Vsc2UgJiZcbiAgICAgICAgIShwcmV2VHlwZSA9PT0gdHlwZXMkMS5zZW1pICYmIHRoaXMuY3VyQ29udGV4dCgpICE9PSB0eXBlcy5wX3N0YXQpICYmXG4gICAgICAgICEocHJldlR5cGUgPT09IHR5cGVzJDEuX3JldHVybiAmJiBsaW5lQnJlYWsudGVzdCh0aGlzLmlucHV0LnNsaWNlKHRoaXMubGFzdFRva0VuZCwgdGhpcy5zdGFydCkpKSAmJlxuICAgICAgICAhKChwcmV2VHlwZSA9PT0gdHlwZXMkMS5jb2xvbiB8fCBwcmV2VHlwZSA9PT0gdHlwZXMkMS5icmFjZUwpICYmIHRoaXMuY3VyQ29udGV4dCgpID09PSB0eXBlcy5iX3N0YXQpKVxuICAgICAgeyB0aGlzLmNvbnRleHQucHVzaCh0eXBlcy5mX2V4cHIpOyB9XG4gICAgZWxzZVxuICAgICAgeyB0aGlzLmNvbnRleHQucHVzaCh0eXBlcy5mX3N0YXQpOyB9XG4gICAgdGhpcy5leHByQWxsb3dlZCA9IGZhbHNlO1xuICB9O1xuXG4gIHR5cGVzJDEuYmFja1F1b3RlLnVwZGF0ZUNvbnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5jdXJDb250ZXh0KCkgPT09IHR5cGVzLnFfdG1wbClcbiAgICAgIHsgdGhpcy5jb250ZXh0LnBvcCgpOyB9XG4gICAgZWxzZVxuICAgICAgeyB0aGlzLmNvbnRleHQucHVzaCh0eXBlcy5xX3RtcGwpOyB9XG4gICAgdGhpcy5leHByQWxsb3dlZCA9IGZhbHNlO1xuICB9O1xuXG4gIHR5cGVzJDEuc3Rhci51cGRhdGVDb250ZXh0ID0gZnVuY3Rpb24ocHJldlR5cGUpIHtcbiAgICBpZiAocHJldlR5cGUgPT09IHR5cGVzJDEuX2Z1bmN0aW9uKSB7XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLmNvbnRleHQubGVuZ3RoIC0gMTtcbiAgICAgIGlmICh0aGlzLmNvbnRleHRbaW5kZXhdID09PSB0eXBlcy5mX2V4cHIpXG4gICAgICAgIHsgdGhpcy5jb250ZXh0W2luZGV4XSA9IHR5cGVzLmZfZXhwcl9nZW47IH1cbiAgICAgIGVsc2VcbiAgICAgICAgeyB0aGlzLmNvbnRleHRbaW5kZXhdID0gdHlwZXMuZl9nZW47IH1cbiAgICB9XG4gICAgdGhpcy5leHByQWxsb3dlZCA9IHRydWU7XG4gIH07XG5cbiAgdHlwZXMkMS5uYW1lLnVwZGF0ZUNvbnRleHQgPSBmdW5jdGlvbihwcmV2VHlwZSkge1xuICAgIHZhciBhbGxvd2VkID0gZmFsc2U7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ICYmIHByZXZUeXBlICE9PSB0eXBlcyQxLmRvdCkge1xuICAgICAgaWYgKHRoaXMudmFsdWUgPT09IFwib2ZcIiAmJiAhdGhpcy5leHByQWxsb3dlZCB8fFxuICAgICAgICAgIHRoaXMudmFsdWUgPT09IFwieWllbGRcIiAmJiB0aGlzLmluR2VuZXJhdG9yQ29udGV4dCgpKVxuICAgICAgICB7IGFsbG93ZWQgPSB0cnVlOyB9XG4gICAgfVxuICAgIHRoaXMuZXhwckFsbG93ZWQgPSBhbGxvd2VkO1xuICB9O1xuXG4gIC8vIEEgcmVjdXJzaXZlIGRlc2NlbnQgcGFyc2VyIG9wZXJhdGVzIGJ5IGRlZmluaW5nIGZ1bmN0aW9ucyBmb3IgYWxsXG4gIC8vIHN5bnRhY3RpYyBlbGVtZW50cywgYW5kIHJlY3Vyc2l2ZWx5IGNhbGxpbmcgdGhvc2UsIGVhY2ggZnVuY3Rpb25cbiAgLy8gYWR2YW5jaW5nIHRoZSBpbnB1dCBzdHJlYW0gYW5kIHJldHVybmluZyBhbiBBU1Qgbm9kZS4gUHJlY2VkZW5jZVxuICAvLyBvZiBjb25zdHJ1Y3RzIChmb3IgZXhhbXBsZSwgdGhlIGZhY3QgdGhhdCBgIXhbMV1gIG1lYW5zIGAhKHhbMV0pYFxuICAvLyBpbnN0ZWFkIG9mIGAoIXgpWzFdYCBpcyBoYW5kbGVkIGJ5IHRoZSBmYWN0IHRoYXQgdGhlIHBhcnNlclxuICAvLyBmdW5jdGlvbiB0aGF0IHBhcnNlcyB1bmFyeSBwcmVmaXggb3BlcmF0b3JzIGlzIGNhbGxlZCBmaXJzdCwgYW5kXG4gIC8vIGluIHR1cm4gY2FsbHMgdGhlIGZ1bmN0aW9uIHRoYXQgcGFyc2VzIGBbXWAgc3Vic2NyaXB0cyDigJQgdGhhdFxuICAvLyB3YXksIGl0J2xsIHJlY2VpdmUgdGhlIG5vZGUgZm9yIGB4WzFdYCBhbHJlYWR5IHBhcnNlZCwgYW5kIHdyYXBzXG4gIC8vICp0aGF0KiBpbiB0aGUgdW5hcnkgb3BlcmF0b3Igbm9kZS5cbiAgLy9cbiAgLy8gQWNvcm4gdXNlcyBhbiBbb3BlcmF0b3IgcHJlY2VkZW5jZSBwYXJzZXJdW29wcF0gdG8gaGFuZGxlIGJpbmFyeVxuICAvLyBvcGVyYXRvciBwcmVjZWRlbmNlLCBiZWNhdXNlIGl0IGlzIG11Y2ggbW9yZSBjb21wYWN0IHRoYW4gdXNpbmdcbiAgLy8gdGhlIHRlY2huaXF1ZSBvdXRsaW5lZCBhYm92ZSwgd2hpY2ggdXNlcyBkaWZmZXJlbnQsIG5lc3RpbmdcbiAgLy8gZnVuY3Rpb25zIHRvIHNwZWNpZnkgcHJlY2VkZW5jZSwgZm9yIGFsbCBvZiB0aGUgdGVuIGJpbmFyeVxuICAvLyBwcmVjZWRlbmNlIGxldmVscyB0aGF0IEphdmFTY3JpcHQgZGVmaW5lcy5cbiAgLy9cbiAgLy8gW29wcF06IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvT3BlcmF0b3ItcHJlY2VkZW5jZV9wYXJzZXJcblxuXG4gIHZhciBwcCQ1ID0gUGFyc2VyLnByb3RvdHlwZTtcblxuICAvLyBDaGVjayBpZiBwcm9wZXJ0eSBuYW1lIGNsYXNoZXMgd2l0aCBhbHJlYWR5IGFkZGVkLlxuICAvLyBPYmplY3QvY2xhc3MgZ2V0dGVycyBhbmQgc2V0dGVycyBhcmUgbm90IGFsbG93ZWQgdG8gY2xhc2gg4oCUXG4gIC8vIGVpdGhlciB3aXRoIGVhY2ggb3RoZXIgb3Igd2l0aCBhbiBpbml0IHByb3BlcnR5IOKAlCBhbmQgaW5cbiAgLy8gc3RyaWN0IG1vZGUsIGluaXQgcHJvcGVydGllcyBhcmUgYWxzbyBub3QgYWxsb3dlZCB0byBiZSByZXBlYXRlZC5cblxuICBwcCQ1LmNoZWNrUHJvcENsYXNoID0gZnVuY3Rpb24ocHJvcCwgcHJvcEhhc2gsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkgJiYgcHJvcC50eXBlID09PSBcIlNwcmVhZEVsZW1lbnRcIilcbiAgICAgIHsgcmV0dXJuIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYgJiYgKHByb3AuY29tcHV0ZWQgfHwgcHJvcC5tZXRob2QgfHwgcHJvcC5zaG9ydGhhbmQpKVxuICAgICAgeyByZXR1cm4gfVxuICAgIHZhciBrZXkgPSBwcm9wLmtleTtcbiAgICB2YXIgbmFtZTtcbiAgICBzd2l0Y2ggKGtleS50eXBlKSB7XG4gICAgY2FzZSBcIklkZW50aWZpZXJcIjogbmFtZSA9IGtleS5uYW1lOyBicmVha1xuICAgIGNhc2UgXCJMaXRlcmFsXCI6IG5hbWUgPSBTdHJpbmcoa2V5LnZhbHVlKTsgYnJlYWtcbiAgICBkZWZhdWx0OiByZXR1cm5cbiAgICB9XG4gICAgdmFyIGtpbmQgPSBwcm9wLmtpbmQ7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2KSB7XG4gICAgICBpZiAobmFtZSA9PT0gXCJfX3Byb3RvX19cIiAmJiBraW5kID09PSBcImluaXRcIikge1xuICAgICAgICBpZiAocHJvcEhhc2gucHJvdG8pIHtcbiAgICAgICAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykge1xuICAgICAgICAgICAgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMuZG91YmxlUHJvdG8gPCAwKSB7XG4gICAgICAgICAgICAgIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMuZG91YmxlUHJvdG8gPSBrZXkuc3RhcnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZShrZXkuc3RhcnQsIFwiUmVkZWZpbml0aW9uIG9mIF9fcHJvdG9fXyBwcm9wZXJ0eVwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcHJvcEhhc2gucHJvdG8gPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIG5hbWUgPSBcIiRcIiArIG5hbWU7XG4gICAgdmFyIG90aGVyID0gcHJvcEhhc2hbbmFtZV07XG4gICAgaWYgKG90aGVyKSB7XG4gICAgICB2YXIgcmVkZWZpbml0aW9uO1xuICAgICAgaWYgKGtpbmQgPT09IFwiaW5pdFwiKSB7XG4gICAgICAgIHJlZGVmaW5pdGlvbiA9IHRoaXMuc3RyaWN0ICYmIG90aGVyLmluaXQgfHwgb3RoZXIuZ2V0IHx8IG90aGVyLnNldDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlZGVmaW5pdGlvbiA9IG90aGVyLmluaXQgfHwgb3RoZXJba2luZF07XG4gICAgICB9XG4gICAgICBpZiAocmVkZWZpbml0aW9uKVxuICAgICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShrZXkuc3RhcnQsIFwiUmVkZWZpbml0aW9uIG9mIHByb3BlcnR5XCIpOyB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVyID0gcHJvcEhhc2hbbmFtZV0gPSB7XG4gICAgICAgIGluaXQ6IGZhbHNlLFxuICAgICAgICBnZXQ6IGZhbHNlLFxuICAgICAgICBzZXQ6IGZhbHNlXG4gICAgICB9O1xuICAgIH1cbiAgICBvdGhlcltraW5kXSA9IHRydWU7XG4gIH07XG5cbiAgLy8gIyMjIEV4cHJlc3Npb24gcGFyc2luZ1xuXG4gIC8vIFRoZXNlIG5lc3QsIGZyb20gdGhlIG1vc3QgZ2VuZXJhbCBleHByZXNzaW9uIHR5cGUgYXQgdGhlIHRvcCB0b1xuICAvLyAnYXRvbWljJywgbm9uZGl2aXNpYmxlIGV4cHJlc3Npb24gdHlwZXMgYXQgdGhlIGJvdHRvbS4gTW9zdCBvZlxuICAvLyB0aGUgZnVuY3Rpb25zIHdpbGwgc2ltcGx5IGxldCB0aGUgZnVuY3Rpb24ocykgYmVsb3cgdGhlbSBwYXJzZSxcbiAgLy8gYW5kLCAqaWYqIHRoZSBzeW50YWN0aWMgY29uc3RydWN0IHRoZXkgaGFuZGxlIGlzIHByZXNlbnQsIHdyYXBcbiAgLy8gdGhlIEFTVCBub2RlIHRoYXQgdGhlIGlubmVyIHBhcnNlciBnYXZlIHRoZW0gaW4gYW5vdGhlciBub2RlLlxuXG4gIC8vIFBhcnNlIGEgZnVsbCBleHByZXNzaW9uLiBUaGUgb3B0aW9uYWwgYXJndW1lbnRzIGFyZSB1c2VkIHRvXG4gIC8vIGZvcmJpZCB0aGUgYGluYCBvcGVyYXRvciAoaW4gZm9yIGxvb3BzIGluaXRhbGl6YXRpb24gZXhwcmVzc2lvbnMpXG4gIC8vIGFuZCBwcm92aWRlIHJlZmVyZW5jZSBmb3Igc3RvcmluZyAnPScgb3BlcmF0b3IgaW5zaWRlIHNob3J0aGFuZFxuICAvLyBwcm9wZXJ0eSBhc3NpZ25tZW50IGluIGNvbnRleHRzIHdoZXJlIGJvdGggb2JqZWN0IGV4cHJlc3Npb25cbiAgLy8gYW5kIG9iamVjdCBwYXR0ZXJuIG1pZ2h0IGFwcGVhciAoc28gaXQncyBwb3NzaWJsZSB0byByYWlzZVxuICAvLyBkZWxheWVkIHN5bnRheCBlcnJvciBhdCBjb3JyZWN0IHBvc2l0aW9uKS5cblxuICBwcCQ1LnBhcnNlRXhwcmVzc2lvbiA9IGZ1bmN0aW9uKGZvckluaXQsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICB2YXIgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgdmFyIGV4cHIgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oZm9ySW5pdCwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5jb21tYSkge1xuICAgICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICBub2RlLmV4cHJlc3Npb25zID0gW2V4cHJdO1xuICAgICAgd2hpbGUgKHRoaXMuZWF0KHR5cGVzJDEuY29tbWEpKSB7IG5vZGUuZXhwcmVzc2lvbnMucHVzaCh0aGlzLnBhcnNlTWF5YmVBc3NpZ24oZm9ySW5pdCwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykpOyB9XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiU2VxdWVuY2VFeHByZXNzaW9uXCIpXG4gICAgfVxuICAgIHJldHVybiBleHByXG4gIH07XG5cbiAgLy8gUGFyc2UgYW4gYXNzaWdubWVudCBleHByZXNzaW9uLiBUaGlzIGluY2x1ZGVzIGFwcGxpY2F0aW9ucyBvZlxuICAvLyBvcGVyYXRvcnMgbGlrZSBgKz1gLlxuXG4gIHBwJDUucGFyc2VNYXliZUFzc2lnbiA9IGZ1bmN0aW9uKGZvckluaXQsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIGFmdGVyTGVmdFBhcnNlKSB7XG4gICAgaWYgKHRoaXMuaXNDb250ZXh0dWFsKFwieWllbGRcIikpIHtcbiAgICAgIGlmICh0aGlzLmluR2VuZXJhdG9yKSB7IHJldHVybiB0aGlzLnBhcnNlWWllbGQoZm9ySW5pdCkgfVxuICAgICAgLy8gVGhlIHRva2VuaXplciB3aWxsIGFzc3VtZSBhbiBleHByZXNzaW9uIGlzIGFsbG93ZWQgYWZ0ZXJcbiAgICAgIC8vIGB5aWVsZGAsIGJ1dCB0aGlzIGlzbid0IHRoYXQga2luZCBvZiB5aWVsZFxuICAgICAgZWxzZSB7IHRoaXMuZXhwckFsbG93ZWQgPSBmYWxzZTsgfVxuICAgIH1cblxuICAgIHZhciBvd25EZXN0cnVjdHVyaW5nRXJyb3JzID0gZmFsc2UsIG9sZFBhcmVuQXNzaWduID0gLTEsIG9sZFRyYWlsaW5nQ29tbWEgPSAtMSwgb2xkRG91YmxlUHJvdG8gPSAtMTtcbiAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykge1xuICAgICAgb2xkUGFyZW5Bc3NpZ24gPSByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRBc3NpZ247XG4gICAgICBvbGRUcmFpbGluZ0NvbW1hID0gcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy50cmFpbGluZ0NvbW1hO1xuICAgICAgb2xkRG91YmxlUHJvdG8gPSByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLmRvdWJsZVByb3RvO1xuICAgICAgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQXNzaWduID0gcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy50cmFpbGluZ0NvbW1hID0gLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMgPSBuZXcgRGVzdHJ1Y3R1cmluZ0Vycm9ycztcbiAgICAgIG93bkRlc3RydWN0dXJpbmdFcnJvcnMgPSB0cnVlO1xuICAgIH1cblxuICAgIHZhciBzdGFydFBvcyA9IHRoaXMuc3RhcnQsIHN0YXJ0TG9jID0gdGhpcy5zdGFydExvYztcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnBhcmVuTCB8fCB0aGlzLnR5cGUgPT09IHR5cGVzJDEubmFtZSkge1xuICAgICAgdGhpcy5wb3RlbnRpYWxBcnJvd0F0ID0gdGhpcy5zdGFydDtcbiAgICAgIHRoaXMucG90ZW50aWFsQXJyb3dJbkZvckF3YWl0ID0gZm9ySW5pdCA9PT0gXCJhd2FpdFwiO1xuICAgIH1cbiAgICB2YXIgbGVmdCA9IHRoaXMucGFyc2VNYXliZUNvbmRpdGlvbmFsKGZvckluaXQsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpO1xuICAgIGlmIChhZnRlckxlZnRQYXJzZSkgeyBsZWZ0ID0gYWZ0ZXJMZWZ0UGFyc2UuY2FsbCh0aGlzLCBsZWZ0LCBzdGFydFBvcywgc3RhcnRMb2MpOyB9XG4gICAgaWYgKHRoaXMudHlwZS5pc0Fzc2lnbikge1xuICAgICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICBub2RlLm9wZXJhdG9yID0gdGhpcy52YWx1ZTtcbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuZXEpXG4gICAgICAgIHsgbGVmdCA9IHRoaXMudG9Bc3NpZ25hYmxlKGxlZnQsIGZhbHNlLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTsgfVxuICAgICAgaWYgKCFvd25EZXN0cnVjdHVyaW5nRXJyb3JzKSB7XG4gICAgICAgIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMucGFyZW50aGVzaXplZEFzc2lnbiA9IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMudHJhaWxpbmdDb21tYSA9IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMuZG91YmxlUHJvdG8gPSAtMTtcbiAgICAgIH1cbiAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnNob3J0aGFuZEFzc2lnbiA+PSBsZWZ0LnN0YXJ0KVxuICAgICAgICB7IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMuc2hvcnRoYW5kQXNzaWduID0gLTE7IH0gLy8gcmVzZXQgYmVjYXVzZSBzaG9ydGhhbmQgZGVmYXVsdCB3YXMgdXNlZCBjb3JyZWN0bHlcbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuZXEpXG4gICAgICAgIHsgdGhpcy5jaGVja0xWYWxQYXR0ZXJuKGxlZnQpOyB9XG4gICAgICBlbHNlXG4gICAgICAgIHsgdGhpcy5jaGVja0xWYWxTaW1wbGUobGVmdCk7IH1cbiAgICAgIG5vZGUubGVmdCA9IGxlZnQ7XG4gICAgICB0aGlzLm5leHQoKTtcbiAgICAgIG5vZGUucmlnaHQgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oZm9ySW5pdCk7XG4gICAgICBpZiAob2xkRG91YmxlUHJvdG8gPiAtMSkgeyByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLmRvdWJsZVByb3RvID0gb2xkRG91YmxlUHJvdG87IH1cbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJBc3NpZ25tZW50RXhwcmVzc2lvblwiKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3duRGVzdHJ1Y3R1cmluZ0Vycm9ycykgeyB0aGlzLmNoZWNrRXhwcmVzc2lvbkVycm9ycyhyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCB0cnVlKTsgfVxuICAgIH1cbiAgICBpZiAob2xkUGFyZW5Bc3NpZ24gPiAtMSkgeyByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRBc3NpZ24gPSBvbGRQYXJlbkFzc2lnbjsgfVxuICAgIGlmIChvbGRUcmFpbGluZ0NvbW1hID4gLTEpIHsgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy50cmFpbGluZ0NvbW1hID0gb2xkVHJhaWxpbmdDb21tYTsgfVxuICAgIHJldHVybiBsZWZ0XG4gIH07XG5cbiAgLy8gUGFyc2UgYSB0ZXJuYXJ5IGNvbmRpdGlvbmFsIChgPzpgKSBvcGVyYXRvci5cblxuICBwcCQ1LnBhcnNlTWF5YmVDb25kaXRpb25hbCA9IGZ1bmN0aW9uKGZvckluaXQsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICB2YXIgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgdmFyIGV4cHIgPSB0aGlzLnBhcnNlRXhwck9wcyhmb3JJbml0LCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTtcbiAgICBpZiAodGhpcy5jaGVja0V4cHJlc3Npb25FcnJvcnMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykpIHsgcmV0dXJuIGV4cHIgfVxuICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLnF1ZXN0aW9uKSkge1xuICAgICAgdmFyIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICBub2RlLnRlc3QgPSBleHByO1xuICAgICAgbm9kZS5jb25zZXF1ZW50ID0gdGhpcy5wYXJzZU1heWJlQXNzaWduKCk7XG4gICAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmNvbG9uKTtcbiAgICAgIG5vZGUuYWx0ZXJuYXRlID0gdGhpcy5wYXJzZU1heWJlQXNzaWduKGZvckluaXQpO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkNvbmRpdGlvbmFsRXhwcmVzc2lvblwiKVxuICAgIH1cbiAgICByZXR1cm4gZXhwclxuICB9O1xuXG4gIC8vIFN0YXJ0IHRoZSBwcmVjZWRlbmNlIHBhcnNlci5cblxuICBwcCQ1LnBhcnNlRXhwck9wcyA9IGZ1bmN0aW9uKGZvckluaXQsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICB2YXIgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgdmFyIGV4cHIgPSB0aGlzLnBhcnNlTWF5YmVVbmFyeShyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCBmYWxzZSwgZmFsc2UsIGZvckluaXQpO1xuICAgIGlmICh0aGlzLmNoZWNrRXhwcmVzc2lvbkVycm9ycyhyZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSkgeyByZXR1cm4gZXhwciB9XG4gICAgcmV0dXJuIGV4cHIuc3RhcnQgPT09IHN0YXJ0UG9zICYmIGV4cHIudHlwZSA9PT0gXCJBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvblwiID8gZXhwciA6IHRoaXMucGFyc2VFeHByT3AoZXhwciwgc3RhcnRQb3MsIHN0YXJ0TG9jLCAtMSwgZm9ySW5pdClcbiAgfTtcblxuICAvLyBQYXJzZSBiaW5hcnkgb3BlcmF0b3JzIHdpdGggdGhlIG9wZXJhdG9yIHByZWNlZGVuY2UgcGFyc2luZ1xuICAvLyBhbGdvcml0aG0uIGBsZWZ0YCBpcyB0aGUgbGVmdC1oYW5kIHNpZGUgb2YgdGhlIG9wZXJhdG9yLlxuICAvLyBgbWluUHJlY2AgcHJvdmlkZXMgY29udGV4dCB0aGF0IGFsbG93cyB0aGUgZnVuY3Rpb24gdG8gc3RvcCBhbmRcbiAgLy8gZGVmZXIgZnVydGhlciBwYXJzZXIgdG8gb25lIG9mIGl0cyBjYWxsZXJzIHdoZW4gaXQgZW5jb3VudGVycyBhblxuICAvLyBvcGVyYXRvciB0aGF0IGhhcyBhIGxvd2VyIHByZWNlZGVuY2UgdGhhbiB0aGUgc2V0IGl0IGlzIHBhcnNpbmcuXG5cbiAgcHAkNS5wYXJzZUV4cHJPcCA9IGZ1bmN0aW9uKGxlZnQsIGxlZnRTdGFydFBvcywgbGVmdFN0YXJ0TG9jLCBtaW5QcmVjLCBmb3JJbml0KSB7XG4gICAgdmFyIHByZWMgPSB0aGlzLnR5cGUuYmlub3A7XG4gICAgaWYgKHByZWMgIT0gbnVsbCAmJiAoIWZvckluaXQgfHwgdGhpcy50eXBlICE9PSB0eXBlcyQxLl9pbikpIHtcbiAgICAgIGlmIChwcmVjID4gbWluUHJlYykge1xuICAgICAgICB2YXIgbG9naWNhbCA9IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5sb2dpY2FsT1IgfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLmxvZ2ljYWxBTkQ7XG4gICAgICAgIHZhciBjb2FsZXNjZSA9IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5jb2FsZXNjZTtcbiAgICAgICAgaWYgKGNvYWxlc2NlKSB7XG4gICAgICAgICAgLy8gSGFuZGxlIHRoZSBwcmVjZWRlbmNlIG9mIGB0dC5jb2FsZXNjZWAgYXMgZXF1YWwgdG8gdGhlIHJhbmdlIG9mIGxvZ2ljYWwgZXhwcmVzc2lvbnMuXG4gICAgICAgICAgLy8gSW4gb3RoZXIgd29yZHMsIGBub2RlLnJpZ2h0YCBzaG91bGRuJ3QgY29udGFpbiBsb2dpY2FsIGV4cHJlc3Npb25zIGluIG9yZGVyIHRvIGNoZWNrIHRoZSBtaXhlZCBlcnJvci5cbiAgICAgICAgICBwcmVjID0gdHlwZXMkMS5sb2dpY2FsQU5ELmJpbm9wO1xuICAgICAgICB9XG4gICAgICAgIHZhciBvcCA9IHRoaXMudmFsdWU7XG4gICAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgICB2YXIgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgICAgIHZhciByaWdodCA9IHRoaXMucGFyc2VFeHByT3AodGhpcy5wYXJzZU1heWJlVW5hcnkobnVsbCwgZmFsc2UsIGZhbHNlLCBmb3JJbml0KSwgc3RhcnRQb3MsIHN0YXJ0TG9jLCBwcmVjLCBmb3JJbml0KTtcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmJ1aWxkQmluYXJ5KGxlZnRTdGFydFBvcywgbGVmdFN0YXJ0TG9jLCBsZWZ0LCByaWdodCwgb3AsIGxvZ2ljYWwgfHwgY29hbGVzY2UpO1xuICAgICAgICBpZiAoKGxvZ2ljYWwgJiYgdGhpcy50eXBlID09PSB0eXBlcyQxLmNvYWxlc2NlKSB8fCAoY29hbGVzY2UgJiYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5sb2dpY2FsT1IgfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLmxvZ2ljYWxBTkQpKSkge1xuICAgICAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZSh0aGlzLnN0YXJ0LCBcIkxvZ2ljYWwgZXhwcmVzc2lvbnMgYW5kIGNvYWxlc2NlIGV4cHJlc3Npb25zIGNhbm5vdCBiZSBtaXhlZC4gV3JhcCBlaXRoZXIgYnkgcGFyZW50aGVzZXNcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VFeHByT3Aobm9kZSwgbGVmdFN0YXJ0UG9zLCBsZWZ0U3RhcnRMb2MsIG1pblByZWMsIGZvckluaXQpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBsZWZ0XG4gIH07XG5cbiAgcHAkNS5idWlsZEJpbmFyeSA9IGZ1bmN0aW9uKHN0YXJ0UG9zLCBzdGFydExvYywgbGVmdCwgcmlnaHQsIG9wLCBsb2dpY2FsKSB7XG4gICAgaWYgKHJpZ2h0LnR5cGUgPT09IFwiUHJpdmF0ZUlkZW50aWZpZXJcIikgeyB0aGlzLnJhaXNlKHJpZ2h0LnN0YXJ0LCBcIlByaXZhdGUgaWRlbnRpZmllciBjYW4gb25seSBiZSBsZWZ0IHNpZGUgb2YgYmluYXJ5IGV4cHJlc3Npb25cIik7IH1cbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICBub2RlLmxlZnQgPSBsZWZ0O1xuICAgIG5vZGUub3BlcmF0b3IgPSBvcDtcbiAgICBub2RlLnJpZ2h0ID0gcmlnaHQ7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBsb2dpY2FsID8gXCJMb2dpY2FsRXhwcmVzc2lvblwiIDogXCJCaW5hcnlFeHByZXNzaW9uXCIpXG4gIH07XG5cbiAgLy8gUGFyc2UgdW5hcnkgb3BlcmF0b3JzLCBib3RoIHByZWZpeCBhbmQgcG9zdGZpeC5cblxuICBwcCQ1LnBhcnNlTWF5YmVVbmFyeSA9IGZ1bmN0aW9uKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIHNhd1VuYXJ5LCBpbmNEZWMsIGZvckluaXQpIHtcbiAgICB2YXIgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2MsIGV4cHI7XG4gICAgaWYgKHRoaXMuaXNDb250ZXh0dWFsKFwiYXdhaXRcIikgJiYgdGhpcy5jYW5Bd2FpdCkge1xuICAgICAgZXhwciA9IHRoaXMucGFyc2VBd2FpdChmb3JJbml0KTtcbiAgICAgIHNhd1VuYXJ5ID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMudHlwZS5wcmVmaXgpIHtcbiAgICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKSwgdXBkYXRlID0gdGhpcy50eXBlID09PSB0eXBlcyQxLmluY0RlYztcbiAgICAgIG5vZGUub3BlcmF0b3IgPSB0aGlzLnZhbHVlO1xuICAgICAgbm9kZS5wcmVmaXggPSB0cnVlO1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICBub2RlLmFyZ3VtZW50ID0gdGhpcy5wYXJzZU1heWJlVW5hcnkobnVsbCwgdHJ1ZSwgdXBkYXRlLCBmb3JJbml0KTtcbiAgICAgIHRoaXMuY2hlY2tFeHByZXNzaW9uRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIHRydWUpO1xuICAgICAgaWYgKHVwZGF0ZSkgeyB0aGlzLmNoZWNrTFZhbFNpbXBsZShub2RlLmFyZ3VtZW50KTsgfVxuICAgICAgZWxzZSBpZiAodGhpcy5zdHJpY3QgJiYgbm9kZS5vcGVyYXRvciA9PT0gXCJkZWxldGVcIiAmJlxuICAgICAgICAgICAgICAgbm9kZS5hcmd1bWVudC50eXBlID09PSBcIklkZW50aWZpZXJcIilcbiAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUobm9kZS5zdGFydCwgXCJEZWxldGluZyBsb2NhbCB2YXJpYWJsZSBpbiBzdHJpY3QgbW9kZVwiKTsgfVxuICAgICAgZWxzZSBpZiAobm9kZS5vcGVyYXRvciA9PT0gXCJkZWxldGVcIiAmJiBpc1ByaXZhdGVGaWVsZEFjY2Vzcyhub2RlLmFyZ3VtZW50KSlcbiAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUobm9kZS5zdGFydCwgXCJQcml2YXRlIGZpZWxkcyBjYW4gbm90IGJlIGRlbGV0ZWRcIik7IH1cbiAgICAgIGVsc2UgeyBzYXdVbmFyeSA9IHRydWU7IH1cbiAgICAgIGV4cHIgPSB0aGlzLmZpbmlzaE5vZGUobm9kZSwgdXBkYXRlID8gXCJVcGRhdGVFeHByZXNzaW9uXCIgOiBcIlVuYXJ5RXhwcmVzc2lvblwiKTtcbiAgICB9IGVsc2UgaWYgKCFzYXdVbmFyeSAmJiB0aGlzLnR5cGUgPT09IHR5cGVzJDEucHJpdmF0ZUlkKSB7XG4gICAgICBpZiAoKGZvckluaXQgfHwgdGhpcy5wcml2YXRlTmFtZVN0YWNrLmxlbmd0aCA9PT0gMCkgJiYgdGhpcy5vcHRpb25zLmNoZWNrUHJpdmF0ZUZpZWxkcykgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgICAgZXhwciA9IHRoaXMucGFyc2VQcml2YXRlSWRlbnQoKTtcbiAgICAgIC8vIG9ubHkgY291bGQgYmUgcHJpdmF0ZSBmaWVsZHMgaW4gJ2luJywgc3VjaCBhcyAjeCBpbiBvYmpcbiAgICAgIGlmICh0aGlzLnR5cGUgIT09IHR5cGVzJDEuX2luKSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cHIgPSB0aGlzLnBhcnNlRXhwclN1YnNjcmlwdHMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgZm9ySW5pdCk7XG4gICAgICBpZiAodGhpcy5jaGVja0V4cHJlc3Npb25FcnJvcnMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykpIHsgcmV0dXJuIGV4cHIgfVxuICAgICAgd2hpbGUgKHRoaXMudHlwZS5wb3N0Zml4ICYmICF0aGlzLmNhbkluc2VydFNlbWljb2xvbigpKSB7XG4gICAgICAgIHZhciBub2RlJDEgPSB0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyk7XG4gICAgICAgIG5vZGUkMS5vcGVyYXRvciA9IHRoaXMudmFsdWU7XG4gICAgICAgIG5vZGUkMS5wcmVmaXggPSBmYWxzZTtcbiAgICAgICAgbm9kZSQxLmFyZ3VtZW50ID0gZXhwcjtcbiAgICAgICAgdGhpcy5jaGVja0xWYWxTaW1wbGUoZXhwcik7XG4gICAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgICBleHByID0gdGhpcy5maW5pc2hOb2RlKG5vZGUkMSwgXCJVcGRhdGVFeHByZXNzaW9uXCIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaW5jRGVjICYmIHRoaXMuZWF0KHR5cGVzJDEuc3RhcnN0YXIpKSB7XG4gICAgICBpZiAoc2F3VW5hcnkpXG4gICAgICAgIHsgdGhpcy51bmV4cGVjdGVkKHRoaXMubGFzdFRva1N0YXJ0KTsgfVxuICAgICAgZWxzZVxuICAgICAgICB7IHJldHVybiB0aGlzLmJ1aWxkQmluYXJ5KHN0YXJ0UG9zLCBzdGFydExvYywgZXhwciwgdGhpcy5wYXJzZU1heWJlVW5hcnkobnVsbCwgZmFsc2UsIGZhbHNlLCBmb3JJbml0KSwgXCIqKlwiLCBmYWxzZSkgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZXhwclxuICAgIH1cbiAgfTtcblxuICBmdW5jdGlvbiBpc1ByaXZhdGVGaWVsZEFjY2Vzcyhub2RlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIG5vZGUudHlwZSA9PT0gXCJNZW1iZXJFeHByZXNzaW9uXCIgJiYgbm9kZS5wcm9wZXJ0eS50eXBlID09PSBcIlByaXZhdGVJZGVudGlmaWVyXCIgfHxcbiAgICAgIG5vZGUudHlwZSA9PT0gXCJDaGFpbkV4cHJlc3Npb25cIiAmJiBpc1ByaXZhdGVGaWVsZEFjY2Vzcyhub2RlLmV4cHJlc3Npb24pXG4gICAgKVxuICB9XG5cbiAgLy8gUGFyc2UgY2FsbCwgZG90LCBhbmQgYFtdYC1zdWJzY3JpcHQgZXhwcmVzc2lvbnMuXG5cbiAgcHAkNS5wYXJzZUV4cHJTdWJzY3JpcHRzID0gZnVuY3Rpb24ocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgZm9ySW5pdCkge1xuICAgIHZhciBzdGFydFBvcyA9IHRoaXMuc3RhcnQsIHN0YXJ0TG9jID0gdGhpcy5zdGFydExvYztcbiAgICB2YXIgZXhwciA9IHRoaXMucGFyc2VFeHByQXRvbShyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCBmb3JJbml0KTtcbiAgICBpZiAoZXhwci50eXBlID09PSBcIkFycm93RnVuY3Rpb25FeHByZXNzaW9uXCIgJiYgdGhpcy5pbnB1dC5zbGljZSh0aGlzLmxhc3RUb2tTdGFydCwgdGhpcy5sYXN0VG9rRW5kKSAhPT0gXCIpXCIpXG4gICAgICB7IHJldHVybiBleHByIH1cbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZVN1YnNjcmlwdHMoZXhwciwgc3RhcnRQb3MsIHN0YXJ0TG9jLCBmYWxzZSwgZm9ySW5pdCk7XG4gICAgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMgJiYgcmVzdWx0LnR5cGUgPT09IFwiTWVtYmVyRXhwcmVzc2lvblwiKSB7XG4gICAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQXNzaWduID49IHJlc3VsdC5zdGFydCkgeyByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRBc3NpZ24gPSAtMTsgfVxuICAgICAgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMucGFyZW50aGVzaXplZEJpbmQgPj0gcmVzdWx0LnN0YXJ0KSB7IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMucGFyZW50aGVzaXplZEJpbmQgPSAtMTsgfVxuICAgICAgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMudHJhaWxpbmdDb21tYSA+PSByZXN1bHQuc3RhcnQpIHsgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy50cmFpbGluZ0NvbW1hID0gLTE7IH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdFxuICB9O1xuXG4gIHBwJDUucGFyc2VTdWJzY3JpcHRzID0gZnVuY3Rpb24oYmFzZSwgc3RhcnRQb3MsIHN0YXJ0TG9jLCBub0NhbGxzLCBmb3JJbml0KSB7XG4gICAgdmFyIG1heWJlQXN5bmNBcnJvdyA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA4ICYmIGJhc2UudHlwZSA9PT0gXCJJZGVudGlmaWVyXCIgJiYgYmFzZS5uYW1lID09PSBcImFzeW5jXCIgJiZcbiAgICAgICAgdGhpcy5sYXN0VG9rRW5kID09PSBiYXNlLmVuZCAmJiAhdGhpcy5jYW5JbnNlcnRTZW1pY29sb24oKSAmJiBiYXNlLmVuZCAtIGJhc2Uuc3RhcnQgPT09IDUgJiZcbiAgICAgICAgdGhpcy5wb3RlbnRpYWxBcnJvd0F0ID09PSBiYXNlLnN0YXJ0O1xuICAgIHZhciBvcHRpb25hbENoYWluZWQgPSBmYWxzZTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICB2YXIgZWxlbWVudCA9IHRoaXMucGFyc2VTdWJzY3JpcHQoYmFzZSwgc3RhcnRQb3MsIHN0YXJ0TG9jLCBub0NhbGxzLCBtYXliZUFzeW5jQXJyb3csIG9wdGlvbmFsQ2hhaW5lZCwgZm9ySW5pdCk7XG5cbiAgICAgIGlmIChlbGVtZW50Lm9wdGlvbmFsKSB7IG9wdGlvbmFsQ2hhaW5lZCA9IHRydWU7IH1cbiAgICAgIGlmIChlbGVtZW50ID09PSBiYXNlIHx8IGVsZW1lbnQudHlwZSA9PT0gXCJBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvblwiKSB7XG4gICAgICAgIGlmIChvcHRpb25hbENoYWluZWQpIHtcbiAgICAgICAgICB2YXIgY2hhaW5Ob2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgICAgIGNoYWluTm9kZS5leHByZXNzaW9uID0gZWxlbWVudDtcbiAgICAgICAgICBlbGVtZW50ID0gdGhpcy5maW5pc2hOb2RlKGNoYWluTm9kZSwgXCJDaGFpbkV4cHJlc3Npb25cIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVsZW1lbnRcbiAgICAgIH1cblxuICAgICAgYmFzZSA9IGVsZW1lbnQ7XG4gICAgfVxuICB9O1xuXG4gIHBwJDUuc2hvdWxkUGFyc2VBc3luY0Fycm93ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICF0aGlzLmNhbkluc2VydFNlbWljb2xvbigpICYmIHRoaXMuZWF0KHR5cGVzJDEuYXJyb3cpXG4gIH07XG5cbiAgcHAkNS5wYXJzZVN1YnNjcmlwdEFzeW5jQXJyb3cgPSBmdW5jdGlvbihzdGFydFBvcywgc3RhcnRMb2MsIGV4cHJMaXN0LCBmb3JJbml0KSB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VBcnJvd0V4cHJlc3Npb24odGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpLCBleHByTGlzdCwgdHJ1ZSwgZm9ySW5pdClcbiAgfTtcblxuICBwcCQ1LnBhcnNlU3Vic2NyaXB0ID0gZnVuY3Rpb24oYmFzZSwgc3RhcnRQb3MsIHN0YXJ0TG9jLCBub0NhbGxzLCBtYXliZUFzeW5jQXJyb3csIG9wdGlvbmFsQ2hhaW5lZCwgZm9ySW5pdCkge1xuICAgIHZhciBvcHRpb25hbFN1cHBvcnRlZCA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSAxMTtcbiAgICB2YXIgb3B0aW9uYWwgPSBvcHRpb25hbFN1cHBvcnRlZCAmJiB0aGlzLmVhdCh0eXBlcyQxLnF1ZXN0aW9uRG90KTtcbiAgICBpZiAobm9DYWxscyAmJiBvcHRpb25hbCkgeyB0aGlzLnJhaXNlKHRoaXMubGFzdFRva1N0YXJ0LCBcIk9wdGlvbmFsIGNoYWluaW5nIGNhbm5vdCBhcHBlYXIgaW4gdGhlIGNhbGxlZSBvZiBuZXcgZXhwcmVzc2lvbnNcIik7IH1cblxuICAgIHZhciBjb21wdXRlZCA9IHRoaXMuZWF0KHR5cGVzJDEuYnJhY2tldEwpO1xuICAgIGlmIChjb21wdXRlZCB8fCAob3B0aW9uYWwgJiYgdGhpcy50eXBlICE9PSB0eXBlcyQxLnBhcmVuTCAmJiB0aGlzLnR5cGUgIT09IHR5cGVzJDEuYmFja1F1b3RlKSB8fCB0aGlzLmVhdCh0eXBlcyQxLmRvdCkpIHtcbiAgICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgbm9kZS5vYmplY3QgPSBiYXNlO1xuICAgICAgaWYgKGNvbXB1dGVkKSB7XG4gICAgICAgIG5vZGUucHJvcGVydHkgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgICAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmJyYWNrZXRSKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnByaXZhdGVJZCAmJiBiYXNlLnR5cGUgIT09IFwiU3VwZXJcIikge1xuICAgICAgICBub2RlLnByb3BlcnR5ID0gdGhpcy5wYXJzZVByaXZhdGVJZGVudCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZS5wcm9wZXJ0eSA9IHRoaXMucGFyc2VJZGVudCh0aGlzLm9wdGlvbnMuYWxsb3dSZXNlcnZlZCAhPT0gXCJuZXZlclwiKTtcbiAgICAgIH1cbiAgICAgIG5vZGUuY29tcHV0ZWQgPSAhIWNvbXB1dGVkO1xuICAgICAgaWYgKG9wdGlvbmFsU3VwcG9ydGVkKSB7XG4gICAgICAgIG5vZGUub3B0aW9uYWwgPSBvcHRpb25hbDtcbiAgICAgIH1cbiAgICAgIGJhc2UgPSB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJNZW1iZXJFeHByZXNzaW9uXCIpO1xuICAgIH0gZWxzZSBpZiAoIW5vQ2FsbHMgJiYgdGhpcy5lYXQodHlwZXMkMS5wYXJlbkwpKSB7XG4gICAgICB2YXIgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyA9IG5ldyBEZXN0cnVjdHVyaW5nRXJyb3JzLCBvbGRZaWVsZFBvcyA9IHRoaXMueWllbGRQb3MsIG9sZEF3YWl0UG9zID0gdGhpcy5hd2FpdFBvcywgb2xkQXdhaXRJZGVudFBvcyA9IHRoaXMuYXdhaXRJZGVudFBvcztcbiAgICAgIHRoaXMueWllbGRQb3MgPSAwO1xuICAgICAgdGhpcy5hd2FpdFBvcyA9IDA7XG4gICAgICB0aGlzLmF3YWl0SWRlbnRQb3MgPSAwO1xuICAgICAgdmFyIGV4cHJMaXN0ID0gdGhpcy5wYXJzZUV4cHJMaXN0KHR5cGVzJDEucGFyZW5SLCB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOCwgZmFsc2UsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpO1xuICAgICAgaWYgKG1heWJlQXN5bmNBcnJvdyAmJiAhb3B0aW9uYWwgJiYgdGhpcy5zaG91bGRQYXJzZUFzeW5jQXJyb3coKSkge1xuICAgICAgICB0aGlzLmNoZWNrUGF0dGVybkVycm9ycyhyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCBmYWxzZSk7XG4gICAgICAgIHRoaXMuY2hlY2tZaWVsZEF3YWl0SW5EZWZhdWx0UGFyYW1zKCk7XG4gICAgICAgIGlmICh0aGlzLmF3YWl0SWRlbnRQb3MgPiAwKVxuICAgICAgICAgIHsgdGhpcy5yYWlzZSh0aGlzLmF3YWl0SWRlbnRQb3MsIFwiQ2Fubm90IHVzZSAnYXdhaXQnIGFzIGlkZW50aWZpZXIgaW5zaWRlIGFuIGFzeW5jIGZ1bmN0aW9uXCIpOyB9XG4gICAgICAgIHRoaXMueWllbGRQb3MgPSBvbGRZaWVsZFBvcztcbiAgICAgICAgdGhpcy5hd2FpdFBvcyA9IG9sZEF3YWl0UG9zO1xuICAgICAgICB0aGlzLmF3YWl0SWRlbnRQb3MgPSBvbGRBd2FpdElkZW50UG9zO1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZVN1YnNjcmlwdEFzeW5jQXJyb3coc3RhcnRQb3MsIHN0YXJ0TG9jLCBleHByTGlzdCwgZm9ySW5pdClcbiAgICAgIH1cbiAgICAgIHRoaXMuY2hlY2tFeHByZXNzaW9uRXJyb3JzKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIHRydWUpO1xuICAgICAgdGhpcy55aWVsZFBvcyA9IG9sZFlpZWxkUG9zIHx8IHRoaXMueWllbGRQb3M7XG4gICAgICB0aGlzLmF3YWl0UG9zID0gb2xkQXdhaXRQb3MgfHwgdGhpcy5hd2FpdFBvcztcbiAgICAgIHRoaXMuYXdhaXRJZGVudFBvcyA9IG9sZEF3YWl0SWRlbnRQb3MgfHwgdGhpcy5hd2FpdElkZW50UG9zO1xuICAgICAgdmFyIG5vZGUkMSA9IHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICAgIG5vZGUkMS5jYWxsZWUgPSBiYXNlO1xuICAgICAgbm9kZSQxLmFyZ3VtZW50cyA9IGV4cHJMaXN0O1xuICAgICAgaWYgKG9wdGlvbmFsU3VwcG9ydGVkKSB7XG4gICAgICAgIG5vZGUkMS5vcHRpb25hbCA9IG9wdGlvbmFsO1xuICAgICAgfVxuICAgICAgYmFzZSA9IHRoaXMuZmluaXNoTm9kZShub2RlJDEsIFwiQ2FsbEV4cHJlc3Npb25cIik7XG4gICAgfSBlbHNlIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuYmFja1F1b3RlKSB7XG4gICAgICBpZiAob3B0aW9uYWwgfHwgb3B0aW9uYWxDaGFpbmVkKSB7XG4gICAgICAgIHRoaXMucmFpc2UodGhpcy5zdGFydCwgXCJPcHRpb25hbCBjaGFpbmluZyBjYW5ub3QgYXBwZWFyIGluIHRoZSB0YWcgb2YgdGFnZ2VkIHRlbXBsYXRlIGV4cHJlc3Npb25zXCIpO1xuICAgICAgfVxuICAgICAgdmFyIG5vZGUkMiA9IHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKTtcbiAgICAgIG5vZGUkMi50YWcgPSBiYXNlO1xuICAgICAgbm9kZSQyLnF1YXNpID0gdGhpcy5wYXJzZVRlbXBsYXRlKHtpc1RhZ2dlZDogdHJ1ZX0pO1xuICAgICAgYmFzZSA9IHRoaXMuZmluaXNoTm9kZShub2RlJDIsIFwiVGFnZ2VkVGVtcGxhdGVFeHByZXNzaW9uXCIpO1xuICAgIH1cbiAgICByZXR1cm4gYmFzZVxuICB9O1xuXG4gIC8vIFBhcnNlIGFuIGF0b21pYyBleHByZXNzaW9uIOKAlCBlaXRoZXIgYSBzaW5nbGUgdG9rZW4gdGhhdCBpcyBhblxuICAvLyBleHByZXNzaW9uLCBhbiBleHByZXNzaW9uIHN0YXJ0ZWQgYnkgYSBrZXl3b3JkIGxpa2UgYGZ1bmN0aW9uYCBvclxuICAvLyBgbmV3YCwgb3IgYW4gZXhwcmVzc2lvbiB3cmFwcGVkIGluIHB1bmN0dWF0aW9uIGxpa2UgYCgpYCwgYFtdYCxcbiAgLy8gb3IgYHt9YC5cblxuICBwcCQ1LnBhcnNlRXhwckF0b20gPSBmdW5jdGlvbihyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCBmb3JJbml0LCBmb3JOZXcpIHtcbiAgICAvLyBJZiBhIGRpdmlzaW9uIG9wZXJhdG9yIGFwcGVhcnMgaW4gYW4gZXhwcmVzc2lvbiBwb3NpdGlvbiwgdGhlXG4gICAgLy8gdG9rZW5pemVyIGdvdCBjb25mdXNlZCwgYW5kIHdlIGZvcmNlIGl0IHRvIHJlYWQgYSByZWdleHAgaW5zdGVhZC5cbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnNsYXNoKSB7IHRoaXMucmVhZFJlZ2V4cCgpOyB9XG5cbiAgICB2YXIgbm9kZSwgY2FuQmVBcnJvdyA9IHRoaXMucG90ZW50aWFsQXJyb3dBdCA9PT0gdGhpcy5zdGFydDtcbiAgICBzd2l0Y2ggKHRoaXMudHlwZSkge1xuICAgIGNhc2UgdHlwZXMkMS5fc3VwZXI6XG4gICAgICBpZiAoIXRoaXMuYWxsb3dTdXBlcilcbiAgICAgICAgeyB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsIFwiJ3N1cGVyJyBrZXl3b3JkIG91dHNpZGUgYSBtZXRob2RcIik7IH1cbiAgICAgIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnBhcmVuTCAmJiAhdGhpcy5hbGxvd0RpcmVjdFN1cGVyKVxuICAgICAgICB7IHRoaXMucmFpc2Uobm9kZS5zdGFydCwgXCJzdXBlcigpIGNhbGwgb3V0c2lkZSBjb25zdHJ1Y3RvciBvZiBhIHN1YmNsYXNzXCIpOyB9XG4gICAgICAvLyBUaGUgYHN1cGVyYCBrZXl3b3JkIGNhbiBhcHBlYXIgYXQgYmVsb3c6XG4gICAgICAvLyBTdXBlclByb3BlcnR5OlxuICAgICAgLy8gICAgIHN1cGVyIFsgRXhwcmVzc2lvbiBdXG4gICAgICAvLyAgICAgc3VwZXIgLiBJZGVudGlmaWVyTmFtZVxuICAgICAgLy8gU3VwZXJDYWxsOlxuICAgICAgLy8gICAgIHN1cGVyICggQXJndW1lbnRzIClcbiAgICAgIGlmICh0aGlzLnR5cGUgIT09IHR5cGVzJDEuZG90ICYmIHRoaXMudHlwZSAhPT0gdHlwZXMkMS5icmFja2V0TCAmJiB0aGlzLnR5cGUgIT09IHR5cGVzJDEucGFyZW5MKVxuICAgICAgICB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiU3VwZXJcIilcblxuICAgIGNhc2UgdHlwZXMkMS5fdGhpczpcbiAgICAgIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiVGhpc0V4cHJlc3Npb25cIilcblxuICAgIGNhc2UgdHlwZXMkMS5uYW1lOlxuICAgICAgdmFyIHN0YXJ0UG9zID0gdGhpcy5zdGFydCwgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jLCBjb250YWluc0VzYyA9IHRoaXMuY29udGFpbnNFc2M7XG4gICAgICB2YXIgaWQgPSB0aGlzLnBhcnNlSWRlbnQoZmFsc2UpO1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA4ICYmICFjb250YWluc0VzYyAmJiBpZC5uYW1lID09PSBcImFzeW5jXCIgJiYgIXRoaXMuY2FuSW5zZXJ0U2VtaWNvbG9uKCkgJiYgdGhpcy5lYXQodHlwZXMkMS5fZnVuY3Rpb24pKSB7XG4gICAgICAgIHRoaXMub3ZlcnJpZGVDb250ZXh0KHR5cGVzLmZfZXhwcik7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlRnVuY3Rpb24odGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpLCAwLCBmYWxzZSwgdHJ1ZSwgZm9ySW5pdClcbiAgICAgIH1cbiAgICAgIGlmIChjYW5CZUFycm93ICYmICF0aGlzLmNhbkluc2VydFNlbWljb2xvbigpKSB7XG4gICAgICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLmFycm93KSlcbiAgICAgICAgICB7IHJldHVybiB0aGlzLnBhcnNlQXJyb3dFeHByZXNzaW9uKHRoaXMuc3RhcnROb2RlQXQoc3RhcnRQb3MsIHN0YXJ0TG9jKSwgW2lkXSwgZmFsc2UsIGZvckluaXQpIH1cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA4ICYmIGlkLm5hbWUgPT09IFwiYXN5bmNcIiAmJiB0aGlzLnR5cGUgPT09IHR5cGVzJDEubmFtZSAmJiAhY29udGFpbnNFc2MgJiZcbiAgICAgICAgICAgICghdGhpcy5wb3RlbnRpYWxBcnJvd0luRm9yQXdhaXQgfHwgdGhpcy52YWx1ZSAhPT0gXCJvZlwiIHx8IHRoaXMuY29udGFpbnNFc2MpKSB7XG4gICAgICAgICAgaWQgPSB0aGlzLnBhcnNlSWRlbnQoZmFsc2UpO1xuICAgICAgICAgIGlmICh0aGlzLmNhbkluc2VydFNlbWljb2xvbigpIHx8ICF0aGlzLmVhdCh0eXBlcyQxLmFycm93KSlcbiAgICAgICAgICAgIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZUFycm93RXhwcmVzc2lvbih0aGlzLnN0YXJ0Tm9kZUF0KHN0YXJ0UG9zLCBzdGFydExvYyksIFtpZF0sIHRydWUsIGZvckluaXQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBpZFxuXG4gICAgY2FzZSB0eXBlcyQxLnJlZ2V4cDpcbiAgICAgIHZhciB2YWx1ZSA9IHRoaXMudmFsdWU7XG4gICAgICBub2RlID0gdGhpcy5wYXJzZUxpdGVyYWwodmFsdWUudmFsdWUpO1xuICAgICAgbm9kZS5yZWdleCA9IHtwYXR0ZXJuOiB2YWx1ZS5wYXR0ZXJuLCBmbGFnczogdmFsdWUuZmxhZ3N9O1xuICAgICAgcmV0dXJuIG5vZGVcblxuICAgIGNhc2UgdHlwZXMkMS5udW06IGNhc2UgdHlwZXMkMS5zdHJpbmc6XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUxpdGVyYWwodGhpcy52YWx1ZSlcblxuICAgIGNhc2UgdHlwZXMkMS5fbnVsbDogY2FzZSB0eXBlcyQxLl90cnVlOiBjYXNlIHR5cGVzJDEuX2ZhbHNlOlxuICAgICAgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgICBub2RlLnZhbHVlID0gdGhpcy50eXBlID09PSB0eXBlcyQxLl9udWxsID8gbnVsbCA6IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5fdHJ1ZTtcbiAgICAgIG5vZGUucmF3ID0gdGhpcy50eXBlLmtleXdvcmQ7XG4gICAgICB0aGlzLm5leHQoKTtcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJMaXRlcmFsXCIpXG5cbiAgICBjYXNlIHR5cGVzJDEucGFyZW5MOlxuICAgICAgdmFyIHN0YXJ0ID0gdGhpcy5zdGFydCwgZXhwciA9IHRoaXMucGFyc2VQYXJlbkFuZERpc3Rpbmd1aXNoRXhwcmVzc2lvbihjYW5CZUFycm93LCBmb3JJbml0KTtcbiAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzKSB7XG4gICAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnBhcmVudGhlc2l6ZWRBc3NpZ24gPCAwICYmICF0aGlzLmlzU2ltcGxlQXNzaWduVGFyZ2V0KGV4cHIpKVxuICAgICAgICAgIHsgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQXNzaWduID0gc3RhcnQ7IH1cbiAgICAgICAgaWYgKHJlZkRlc3RydWN0dXJpbmdFcnJvcnMucGFyZW50aGVzaXplZEJpbmQgPCAwKVxuICAgICAgICAgIHsgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5wYXJlbnRoZXNpemVkQmluZCA9IHN0YXJ0OyB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZXhwclxuXG4gICAgY2FzZSB0eXBlcyQxLmJyYWNrZXRMOlxuICAgICAgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgICB0aGlzLm5leHQoKTtcbiAgICAgIG5vZGUuZWxlbWVudHMgPSB0aGlzLnBhcnNlRXhwckxpc3QodHlwZXMkMS5icmFja2V0UiwgdHJ1ZSwgdHJ1ZSwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiQXJyYXlFeHByZXNzaW9uXCIpXG5cbiAgICBjYXNlIHR5cGVzJDEuYnJhY2VMOlxuICAgICAgdGhpcy5vdmVycmlkZUNvbnRleHQodHlwZXMuYl9leHByKTtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlT2JqKGZhbHNlLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKVxuXG4gICAgY2FzZSB0eXBlcyQxLl9mdW5jdGlvbjpcbiAgICAgIG5vZGUgPSB0aGlzLnN0YXJ0Tm9kZSgpO1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUZ1bmN0aW9uKG5vZGUsIDApXG5cbiAgICBjYXNlIHR5cGVzJDEuX2NsYXNzOlxuICAgICAgcmV0dXJuIHRoaXMucGFyc2VDbGFzcyh0aGlzLnN0YXJ0Tm9kZSgpLCBmYWxzZSlcblxuICAgIGNhc2UgdHlwZXMkMS5fbmV3OlxuICAgICAgcmV0dXJuIHRoaXMucGFyc2VOZXcoKVxuXG4gICAgY2FzZSB0eXBlcyQxLmJhY2tRdW90ZTpcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlVGVtcGxhdGUoKVxuXG4gICAgY2FzZSB0eXBlcyQxLl9pbXBvcnQ6XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDExKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlRXhwckltcG9ydChmb3JOZXcpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy51bmV4cGVjdGVkKClcbiAgICAgIH1cblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUV4cHJBdG9tRGVmYXVsdCgpXG4gICAgfVxuICB9O1xuXG4gIHBwJDUucGFyc2VFeHByQXRvbURlZmF1bHQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnVuZXhwZWN0ZWQoKTtcbiAgfTtcblxuICBwcCQ1LnBhcnNlRXhwckltcG9ydCA9IGZ1bmN0aW9uKGZvck5ldykge1xuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcblxuICAgIC8vIENvbnN1bWUgYGltcG9ydGAgYXMgYW4gaWRlbnRpZmllciBmb3IgYGltcG9ydC5tZXRhYC5cbiAgICAvLyBCZWNhdXNlIGB0aGlzLnBhcnNlSWRlbnQodHJ1ZSlgIGRvZXNuJ3QgY2hlY2sgZXNjYXBlIHNlcXVlbmNlcywgaXQgbmVlZHMgdGhlIGNoZWNrIG9mIGB0aGlzLmNvbnRhaW5zRXNjYC5cbiAgICBpZiAodGhpcy5jb250YWluc0VzYykgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5zdGFydCwgXCJFc2NhcGUgc2VxdWVuY2UgaW4ga2V5d29yZCBpbXBvcnRcIik7IH1cbiAgICB2YXIgbWV0YSA9IHRoaXMucGFyc2VJZGVudCh0cnVlKTtcblxuICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEucGFyZW5MICYmICFmb3JOZXcpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlRHluYW1pY0ltcG9ydChub2RlKVxuICAgIH0gZWxzZSBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmRvdCkge1xuICAgICAgbm9kZS5tZXRhID0gbWV0YTtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlSW1wb3J0TWV0YShub2RlKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVuZXhwZWN0ZWQoKTtcbiAgICB9XG4gIH07XG5cbiAgcHAkNS5wYXJzZUR5bmFtaWNJbXBvcnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdGhpcy5uZXh0KCk7IC8vIHNraXAgYChgXG5cbiAgICAvLyBQYXJzZSBub2RlLnNvdXJjZS5cbiAgICBub2RlLnNvdXJjZSA9IHRoaXMucGFyc2VNYXliZUFzc2lnbigpO1xuXG4gICAgLy8gVmVyaWZ5IGVuZGluZy5cbiAgICBpZiAoIXRoaXMuZWF0KHR5cGVzJDEucGFyZW5SKSkge1xuICAgICAgdmFyIGVycm9yUG9zID0gdGhpcy5zdGFydDtcbiAgICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLmNvbW1hKSAmJiB0aGlzLmVhdCh0eXBlcyQxLnBhcmVuUikpIHtcbiAgICAgICAgdGhpcy5yYWlzZVJlY292ZXJhYmxlKGVycm9yUG9zLCBcIlRyYWlsaW5nIGNvbW1hIGlzIG5vdCBhbGxvd2VkIGluIGltcG9ydCgpXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy51bmV4cGVjdGVkKGVycm9yUG9zKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiSW1wb3J0RXhwcmVzc2lvblwiKVxuICB9O1xuXG4gIHBwJDUucGFyc2VJbXBvcnRNZXRhID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHRoaXMubmV4dCgpOyAvLyBza2lwIGAuYFxuXG4gICAgdmFyIGNvbnRhaW5zRXNjID0gdGhpcy5jb250YWluc0VzYztcbiAgICBub2RlLnByb3BlcnR5ID0gdGhpcy5wYXJzZUlkZW50KHRydWUpO1xuXG4gICAgaWYgKG5vZGUucHJvcGVydHkubmFtZSAhPT0gXCJtZXRhXCIpXG4gICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShub2RlLnByb3BlcnR5LnN0YXJ0LCBcIlRoZSBvbmx5IHZhbGlkIG1ldGEgcHJvcGVydHkgZm9yIGltcG9ydCBpcyAnaW1wb3J0Lm1ldGEnXCIpOyB9XG4gICAgaWYgKGNvbnRhaW5zRXNjKVxuICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUobm9kZS5zdGFydCwgXCInaW1wb3J0Lm1ldGEnIG11c3Qgbm90IGNvbnRhaW4gZXNjYXBlZCBjaGFyYWN0ZXJzXCIpOyB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5zb3VyY2VUeXBlICE9PSBcIm1vZHVsZVwiICYmICF0aGlzLm9wdGlvbnMuYWxsb3dJbXBvcnRFeHBvcnRFdmVyeXdoZXJlKVxuICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUobm9kZS5zdGFydCwgXCJDYW5ub3QgdXNlICdpbXBvcnQubWV0YScgb3V0c2lkZSBhIG1vZHVsZVwiKTsgfVxuXG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIk1ldGFQcm9wZXJ0eVwiKVxuICB9O1xuXG4gIHBwJDUucGFyc2VMaXRlcmFsID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIG5vZGUucmF3ID0gdGhpcy5pbnB1dC5zbGljZSh0aGlzLnN0YXJ0LCB0aGlzLmVuZCk7XG4gICAgaWYgKG5vZGUucmF3LmNoYXJDb2RlQXQobm9kZS5yYXcubGVuZ3RoIC0gMSkgPT09IDExMCkgeyBub2RlLmJpZ2ludCA9IG5vZGUucmF3LnNsaWNlKDAsIC0xKS5yZXBsYWNlKC9fL2csIFwiXCIpOyB9XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkxpdGVyYWxcIilcbiAgfTtcblxuICBwcCQ1LnBhcnNlUGFyZW5FeHByZXNzaW9uID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5leHBlY3QodHlwZXMkMS5wYXJlbkwpO1xuICAgIHZhciB2YWwgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEucGFyZW5SKTtcbiAgICByZXR1cm4gdmFsXG4gIH07XG5cbiAgcHAkNS5zaG91bGRQYXJzZUFycm93ID0gZnVuY3Rpb24oZXhwckxpc3QpIHtcbiAgICByZXR1cm4gIXRoaXMuY2FuSW5zZXJ0U2VtaWNvbG9uKClcbiAgfTtcblxuICBwcCQ1LnBhcnNlUGFyZW5BbmREaXN0aW5ndWlzaEV4cHJlc3Npb24gPSBmdW5jdGlvbihjYW5CZUFycm93LCBmb3JJbml0KSB7XG4gICAgdmFyIHN0YXJ0UG9zID0gdGhpcy5zdGFydCwgc3RhcnRMb2MgPSB0aGlzLnN0YXJ0TG9jLCB2YWwsIGFsbG93VHJhaWxpbmdDb21tYSA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA4O1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNikge1xuICAgICAgdGhpcy5uZXh0KCk7XG5cbiAgICAgIHZhciBpbm5lclN0YXJ0UG9zID0gdGhpcy5zdGFydCwgaW5uZXJTdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgICB2YXIgZXhwckxpc3QgPSBbXSwgZmlyc3QgPSB0cnVlLCBsYXN0SXNDb21tYSA9IGZhbHNlO1xuICAgICAgdmFyIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMgPSBuZXcgRGVzdHJ1Y3R1cmluZ0Vycm9ycywgb2xkWWllbGRQb3MgPSB0aGlzLnlpZWxkUG9zLCBvbGRBd2FpdFBvcyA9IHRoaXMuYXdhaXRQb3MsIHNwcmVhZFN0YXJ0O1xuICAgICAgdGhpcy55aWVsZFBvcyA9IDA7XG4gICAgICB0aGlzLmF3YWl0UG9zID0gMDtcbiAgICAgIC8vIERvIG5vdCBzYXZlIGF3YWl0SWRlbnRQb3MgdG8gYWxsb3cgY2hlY2tpbmcgYXdhaXRzIG5lc3RlZCBpbiBwYXJhbWV0ZXJzXG4gICAgICB3aGlsZSAodGhpcy50eXBlICE9PSB0eXBlcyQxLnBhcmVuUikge1xuICAgICAgICBmaXJzdCA/IGZpcnN0ID0gZmFsc2UgOiB0aGlzLmV4cGVjdCh0eXBlcyQxLmNvbW1hKTtcbiAgICAgICAgaWYgKGFsbG93VHJhaWxpbmdDb21tYSAmJiB0aGlzLmFmdGVyVHJhaWxpbmdDb21tYSh0eXBlcyQxLnBhcmVuUiwgdHJ1ZSkpIHtcbiAgICAgICAgICBsYXN0SXNDb21tYSA9IHRydWU7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuZWxsaXBzaXMpIHtcbiAgICAgICAgICBzcHJlYWRTdGFydCA9IHRoaXMuc3RhcnQ7XG4gICAgICAgICAgZXhwckxpc3QucHVzaCh0aGlzLnBhcnNlUGFyZW5JdGVtKHRoaXMucGFyc2VSZXN0QmluZGluZygpKSk7XG4gICAgICAgICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5jb21tYSkge1xuICAgICAgICAgICAgdGhpcy5yYWlzZVJlY292ZXJhYmxlKFxuICAgICAgICAgICAgICB0aGlzLnN0YXJ0LFxuICAgICAgICAgICAgICBcIkNvbW1hIGlzIG5vdCBwZXJtaXR0ZWQgYWZ0ZXIgdGhlIHJlc3QgZWxlbWVudFwiXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4cHJMaXN0LnB1c2godGhpcy5wYXJzZU1heWJlQXNzaWduKGZhbHNlLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLCB0aGlzLnBhcnNlUGFyZW5JdGVtKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHZhciBpbm5lckVuZFBvcyA9IHRoaXMubGFzdFRva0VuZCwgaW5uZXJFbmRMb2MgPSB0aGlzLmxhc3RUb2tFbmRMb2M7XG4gICAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLnBhcmVuUik7XG5cbiAgICAgIGlmIChjYW5CZUFycm93ICYmIHRoaXMuc2hvdWxkUGFyc2VBcnJvdyhleHByTGlzdCkgJiYgdGhpcy5lYXQodHlwZXMkMS5hcnJvdykpIHtcbiAgICAgICAgdGhpcy5jaGVja1BhdHRlcm5FcnJvcnMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgZmFsc2UpO1xuICAgICAgICB0aGlzLmNoZWNrWWllbGRBd2FpdEluRGVmYXVsdFBhcmFtcygpO1xuICAgICAgICB0aGlzLnlpZWxkUG9zID0gb2xkWWllbGRQb3M7XG4gICAgICAgIHRoaXMuYXdhaXRQb3MgPSBvbGRBd2FpdFBvcztcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VQYXJlbkFycm93TGlzdChzdGFydFBvcywgc3RhcnRMb2MsIGV4cHJMaXN0LCBmb3JJbml0KVxuICAgICAgfVxuXG4gICAgICBpZiAoIWV4cHJMaXN0Lmxlbmd0aCB8fCBsYXN0SXNDb21tYSkgeyB0aGlzLnVuZXhwZWN0ZWQodGhpcy5sYXN0VG9rU3RhcnQpOyB9XG4gICAgICBpZiAoc3ByZWFkU3RhcnQpIHsgdGhpcy51bmV4cGVjdGVkKHNwcmVhZFN0YXJ0KTsgfVxuICAgICAgdGhpcy5jaGVja0V4cHJlc3Npb25FcnJvcnMocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgdHJ1ZSk7XG4gICAgICB0aGlzLnlpZWxkUG9zID0gb2xkWWllbGRQb3MgfHwgdGhpcy55aWVsZFBvcztcbiAgICAgIHRoaXMuYXdhaXRQb3MgPSBvbGRBd2FpdFBvcyB8fCB0aGlzLmF3YWl0UG9zO1xuXG4gICAgICBpZiAoZXhwckxpc3QubGVuZ3RoID4gMSkge1xuICAgICAgICB2YWwgPSB0aGlzLnN0YXJ0Tm9kZUF0KGlubmVyU3RhcnRQb3MsIGlubmVyU3RhcnRMb2MpO1xuICAgICAgICB2YWwuZXhwcmVzc2lvbnMgPSBleHByTGlzdDtcbiAgICAgICAgdGhpcy5maW5pc2hOb2RlQXQodmFsLCBcIlNlcXVlbmNlRXhwcmVzc2lvblwiLCBpbm5lckVuZFBvcywgaW5uZXJFbmRMb2MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsID0gZXhwckxpc3RbMF07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbCA9IHRoaXMucGFyc2VQYXJlbkV4cHJlc3Npb24oKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnByZXNlcnZlUGFyZW5zKSB7XG4gICAgICB2YXIgcGFyID0gdGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpO1xuICAgICAgcGFyLmV4cHJlc3Npb24gPSB2YWw7XG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKHBhciwgXCJQYXJlbnRoZXNpemVkRXhwcmVzc2lvblwiKVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdmFsXG4gICAgfVxuICB9O1xuXG4gIHBwJDUucGFyc2VQYXJlbkl0ZW0gPSBmdW5jdGlvbihpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW1cbiAgfTtcblxuICBwcCQ1LnBhcnNlUGFyZW5BcnJvd0xpc3QgPSBmdW5jdGlvbihzdGFydFBvcywgc3RhcnRMb2MsIGV4cHJMaXN0LCBmb3JJbml0KSB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VBcnJvd0V4cHJlc3Npb24odGhpcy5zdGFydE5vZGVBdChzdGFydFBvcywgc3RhcnRMb2MpLCBleHByTGlzdCwgZmFsc2UsIGZvckluaXQpXG4gIH07XG5cbiAgLy8gTmV3J3MgcHJlY2VkZW5jZSBpcyBzbGlnaHRseSB0cmlja3kuIEl0IG11c3QgYWxsb3cgaXRzIGFyZ3VtZW50IHRvXG4gIC8vIGJlIGEgYFtdYCBvciBkb3Qgc3Vic2NyaXB0IGV4cHJlc3Npb24sIGJ1dCBub3QgYSBjYWxsIOKAlCBhdCBsZWFzdCxcbiAgLy8gbm90IHdpdGhvdXQgd3JhcHBpbmcgaXQgaW4gcGFyZW50aGVzZXMuIFRodXMsIGl0IHVzZXMgdGhlIG5vQ2FsbHNcbiAgLy8gYXJndW1lbnQgdG8gcGFyc2VTdWJzY3JpcHRzIHRvIHByZXZlbnQgaXQgZnJvbSBjb25zdW1pbmcgdGhlXG4gIC8vIGFyZ3VtZW50IGxpc3QuXG5cbiAgdmFyIGVtcHR5ID0gW107XG5cbiAgcHAkNS5wYXJzZU5ldyA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLmNvbnRhaW5zRXNjKSB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZSh0aGlzLnN0YXJ0LCBcIkVzY2FwZSBzZXF1ZW5jZSBpbiBrZXl3b3JkIG5ld1wiKTsgfVxuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICB2YXIgbWV0YSA9IHRoaXMucGFyc2VJZGVudCh0cnVlKTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYgJiYgdGhpcy5lYXQodHlwZXMkMS5kb3QpKSB7XG4gICAgICBub2RlLm1ldGEgPSBtZXRhO1xuICAgICAgdmFyIGNvbnRhaW5zRXNjID0gdGhpcy5jb250YWluc0VzYztcbiAgICAgIG5vZGUucHJvcGVydHkgPSB0aGlzLnBhcnNlSWRlbnQodHJ1ZSk7XG4gICAgICBpZiAobm9kZS5wcm9wZXJ0eS5uYW1lICE9PSBcInRhcmdldFwiKVxuICAgICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShub2RlLnByb3BlcnR5LnN0YXJ0LCBcIlRoZSBvbmx5IHZhbGlkIG1ldGEgcHJvcGVydHkgZm9yIG5ldyBpcyAnbmV3LnRhcmdldCdcIik7IH1cbiAgICAgIGlmIChjb250YWluc0VzYylcbiAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUobm9kZS5zdGFydCwgXCInbmV3LnRhcmdldCcgbXVzdCBub3QgY29udGFpbiBlc2NhcGVkIGNoYXJhY3RlcnNcIik7IH1cbiAgICAgIGlmICghdGhpcy5hbGxvd05ld0RvdFRhcmdldClcbiAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUobm9kZS5zdGFydCwgXCInbmV3LnRhcmdldCcgY2FuIG9ubHkgYmUgdXNlZCBpbiBmdW5jdGlvbnMgYW5kIGNsYXNzIHN0YXRpYyBibG9ja1wiKTsgfVxuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIk1ldGFQcm9wZXJ0eVwiKVxuICAgIH1cbiAgICB2YXIgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0LCBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgbm9kZS5jYWxsZWUgPSB0aGlzLnBhcnNlU3Vic2NyaXB0cyh0aGlzLnBhcnNlRXhwckF0b20obnVsbCwgZmFsc2UsIHRydWUpLCBzdGFydFBvcywgc3RhcnRMb2MsIHRydWUsIGZhbHNlKTtcbiAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5wYXJlbkwpKSB7IG5vZGUuYXJndW1lbnRzID0gdGhpcy5wYXJzZUV4cHJMaXN0KHR5cGVzJDEucGFyZW5SLCB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOCwgZmFsc2UpOyB9XG4gICAgZWxzZSB7IG5vZGUuYXJndW1lbnRzID0gZW1wdHk7IH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiTmV3RXhwcmVzc2lvblwiKVxuICB9O1xuXG4gIC8vIFBhcnNlIHRlbXBsYXRlIGV4cHJlc3Npb24uXG5cbiAgcHAkNS5wYXJzZVRlbXBsYXRlRWxlbWVudCA9IGZ1bmN0aW9uKHJlZikge1xuICAgIHZhciBpc1RhZ2dlZCA9IHJlZi5pc1RhZ2dlZDtcblxuICAgIHZhciBlbGVtID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmludmFsaWRUZW1wbGF0ZSkge1xuICAgICAgaWYgKCFpc1RhZ2dlZCkge1xuICAgICAgICB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5zdGFydCwgXCJCYWQgZXNjYXBlIHNlcXVlbmNlIGluIHVudGFnZ2VkIHRlbXBsYXRlIGxpdGVyYWxcIik7XG4gICAgICB9XG4gICAgICBlbGVtLnZhbHVlID0ge1xuICAgICAgICByYXc6IHRoaXMudmFsdWUsXG4gICAgICAgIGNvb2tlZDogbnVsbFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWxlbS52YWx1ZSA9IHtcbiAgICAgICAgcmF3OiB0aGlzLmlucHV0LnNsaWNlKHRoaXMuc3RhcnQsIHRoaXMuZW5kKS5yZXBsYWNlKC9cXHJcXG4/L2csIFwiXFxuXCIpLFxuICAgICAgICBjb29rZWQ6IHRoaXMudmFsdWVcbiAgICAgIH07XG4gICAgfVxuICAgIHRoaXMubmV4dCgpO1xuICAgIGVsZW0udGFpbCA9IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5iYWNrUXVvdGU7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShlbGVtLCBcIlRlbXBsYXRlRWxlbWVudFwiKVxuICB9O1xuXG4gIHBwJDUucGFyc2VUZW1wbGF0ZSA9IGZ1bmN0aW9uKHJlZikge1xuICAgIGlmICggcmVmID09PSB2b2lkIDAgKSByZWYgPSB7fTtcbiAgICB2YXIgaXNUYWdnZWQgPSByZWYuaXNUYWdnZWQ7IGlmICggaXNUYWdnZWQgPT09IHZvaWQgMCApIGlzVGFnZ2VkID0gZmFsc2U7XG5cbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgbm9kZS5leHByZXNzaW9ucyA9IFtdO1xuICAgIHZhciBjdXJFbHQgPSB0aGlzLnBhcnNlVGVtcGxhdGVFbGVtZW50KHtpc1RhZ2dlZDogaXNUYWdnZWR9KTtcbiAgICBub2RlLnF1YXNpcyA9IFtjdXJFbHRdO1xuICAgIHdoaWxlICghY3VyRWx0LnRhaWwpIHtcbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuZW9mKSB7IHRoaXMucmFpc2UodGhpcy5wb3MsIFwiVW50ZXJtaW5hdGVkIHRlbXBsYXRlIGxpdGVyYWxcIik7IH1cbiAgICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuZG9sbGFyQnJhY2VMKTtcbiAgICAgIG5vZGUuZXhwcmVzc2lvbnMucHVzaCh0aGlzLnBhcnNlRXhwcmVzc2lvbigpKTtcbiAgICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuYnJhY2VSKTtcbiAgICAgIG5vZGUucXVhc2lzLnB1c2goY3VyRWx0ID0gdGhpcy5wYXJzZVRlbXBsYXRlRWxlbWVudCh7aXNUYWdnZWQ6IGlzVGFnZ2VkfSkpO1xuICAgIH1cbiAgICB0aGlzLm5leHQoKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiVGVtcGxhdGVMaXRlcmFsXCIpXG4gIH07XG5cbiAgcHAkNS5pc0FzeW5jUHJvcCA9IGZ1bmN0aW9uKHByb3ApIHtcbiAgICByZXR1cm4gIXByb3AuY29tcHV0ZWQgJiYgcHJvcC5rZXkudHlwZSA9PT0gXCJJZGVudGlmaWVyXCIgJiYgcHJvcC5rZXkubmFtZSA9PT0gXCJhc3luY1wiICYmXG4gICAgICAodGhpcy50eXBlID09PSB0eXBlcyQxLm5hbWUgfHwgdGhpcy50eXBlID09PSB0eXBlcyQxLm51bSB8fCB0aGlzLnR5cGUgPT09IHR5cGVzJDEuc3RyaW5nIHx8IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5icmFja2V0TCB8fCB0aGlzLnR5cGUua2V5d29yZCB8fCAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkgJiYgdGhpcy50eXBlID09PSB0eXBlcyQxLnN0YXIpKSAmJlxuICAgICAgIWxpbmVCcmVhay50ZXN0KHRoaXMuaW5wdXQuc2xpY2UodGhpcy5sYXN0VG9rRW5kLCB0aGlzLnN0YXJ0KSlcbiAgfTtcblxuICAvLyBQYXJzZSBhbiBvYmplY3QgbGl0ZXJhbCBvciBiaW5kaW5nIHBhdHRlcm4uXG5cbiAgcHAkNS5wYXJzZU9iaiA9IGZ1bmN0aW9uKGlzUGF0dGVybiwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykge1xuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKSwgZmlyc3QgPSB0cnVlLCBwcm9wSGFzaCA9IHt9O1xuICAgIG5vZGUucHJvcGVydGllcyA9IFtdO1xuICAgIHRoaXMubmV4dCgpO1xuICAgIHdoaWxlICghdGhpcy5lYXQodHlwZXMkMS5icmFjZVIpKSB7XG4gICAgICBpZiAoIWZpcnN0KSB7XG4gICAgICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEuY29tbWEpO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDUgJiYgdGhpcy5hZnRlclRyYWlsaW5nQ29tbWEodHlwZXMkMS5icmFjZVIpKSB7IGJyZWFrIH1cbiAgICAgIH0gZWxzZSB7IGZpcnN0ID0gZmFsc2U7IH1cblxuICAgICAgdmFyIHByb3AgPSB0aGlzLnBhcnNlUHJvcGVydHkoaXNQYXR0ZXJuLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTtcbiAgICAgIGlmICghaXNQYXR0ZXJuKSB7IHRoaXMuY2hlY2tQcm9wQ2xhc2gocHJvcCwgcHJvcEhhc2gsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpOyB9XG4gICAgICBub2RlLnByb3BlcnRpZXMucHVzaChwcm9wKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBpc1BhdHRlcm4gPyBcIk9iamVjdFBhdHRlcm5cIiA6IFwiT2JqZWN0RXhwcmVzc2lvblwiKVxuICB9O1xuXG4gIHBwJDUucGFyc2VQcm9wZXJ0eSA9IGZ1bmN0aW9uKGlzUGF0dGVybiwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykge1xuICAgIHZhciBwcm9wID0gdGhpcy5zdGFydE5vZGUoKSwgaXNHZW5lcmF0b3IsIGlzQXN5bmMsIHN0YXJ0UG9zLCBzdGFydExvYztcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkgJiYgdGhpcy5lYXQodHlwZXMkMS5lbGxpcHNpcykpIHtcbiAgICAgIGlmIChpc1BhdHRlcm4pIHtcbiAgICAgICAgcHJvcC5hcmd1bWVudCA9IHRoaXMucGFyc2VJZGVudChmYWxzZSk7XG4gICAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29tbWEpIHtcbiAgICAgICAgICB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5zdGFydCwgXCJDb21tYSBpcyBub3QgcGVybWl0dGVkIGFmdGVyIHRoZSByZXN0IGVsZW1lbnRcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShwcm9wLCBcIlJlc3RFbGVtZW50XCIpXG4gICAgICB9XG4gICAgICAvLyBQYXJzZSBhcmd1bWVudC5cbiAgICAgIHByb3AuYXJndW1lbnQgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oZmFsc2UsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpO1xuICAgICAgLy8gVG8gZGlzYWxsb3cgdHJhaWxpbmcgY29tbWEgdmlhIGB0aGlzLnRvQXNzaWduYWJsZSgpYC5cbiAgICAgIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29tbWEgJiYgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyAmJiByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnRyYWlsaW5nQ29tbWEgPCAwKSB7XG4gICAgICAgIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMudHJhaWxpbmdDb21tYSA9IHRoaXMuc3RhcnQ7XG4gICAgICB9XG4gICAgICAvLyBGaW5pc2hcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUocHJvcCwgXCJTcHJlYWRFbGVtZW50XCIpXG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNikge1xuICAgICAgcHJvcC5tZXRob2QgPSBmYWxzZTtcbiAgICAgIHByb3Auc2hvcnRoYW5kID0gZmFsc2U7XG4gICAgICBpZiAoaXNQYXR0ZXJuIHx8IHJlZkRlc3RydWN0dXJpbmdFcnJvcnMpIHtcbiAgICAgICAgc3RhcnRQb3MgPSB0aGlzLnN0YXJ0O1xuICAgICAgICBzdGFydExvYyA9IHRoaXMuc3RhcnRMb2M7XG4gICAgICB9XG4gICAgICBpZiAoIWlzUGF0dGVybilcbiAgICAgICAgeyBpc0dlbmVyYXRvciA9IHRoaXMuZWF0KHR5cGVzJDEuc3Rhcik7IH1cbiAgICB9XG4gICAgdmFyIGNvbnRhaW5zRXNjID0gdGhpcy5jb250YWluc0VzYztcbiAgICB0aGlzLnBhcnNlUHJvcGVydHlOYW1lKHByb3ApO1xuICAgIGlmICghaXNQYXR0ZXJuICYmICFjb250YWluc0VzYyAmJiB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOCAmJiAhaXNHZW5lcmF0b3IgJiYgdGhpcy5pc0FzeW5jUHJvcChwcm9wKSkge1xuICAgICAgaXNBc3luYyA9IHRydWU7XG4gICAgICBpc0dlbmVyYXRvciA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5ICYmIHRoaXMuZWF0KHR5cGVzJDEuc3Rhcik7XG4gICAgICB0aGlzLnBhcnNlUHJvcGVydHlOYW1lKHByb3ApO1xuICAgIH0gZWxzZSB7XG4gICAgICBpc0FzeW5jID0gZmFsc2U7XG4gICAgfVxuICAgIHRoaXMucGFyc2VQcm9wZXJ0eVZhbHVlKHByb3AsIGlzUGF0dGVybiwgaXNHZW5lcmF0b3IsIGlzQXN5bmMsIHN0YXJ0UG9zLCBzdGFydExvYywgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycywgY29udGFpbnNFc2MpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUocHJvcCwgXCJQcm9wZXJ0eVwiKVxuICB9O1xuXG4gIHBwJDUucGFyc2VHZXR0ZXJTZXR0ZXIgPSBmdW5jdGlvbihwcm9wKSB7XG4gICAgcHJvcC5raW5kID0gcHJvcC5rZXkubmFtZTtcbiAgICB0aGlzLnBhcnNlUHJvcGVydHlOYW1lKHByb3ApO1xuICAgIHByb3AudmFsdWUgPSB0aGlzLnBhcnNlTWV0aG9kKGZhbHNlKTtcbiAgICB2YXIgcGFyYW1Db3VudCA9IHByb3Aua2luZCA9PT0gXCJnZXRcIiA/IDAgOiAxO1xuICAgIGlmIChwcm9wLnZhbHVlLnBhcmFtcy5sZW5ndGggIT09IHBhcmFtQ291bnQpIHtcbiAgICAgIHZhciBzdGFydCA9IHByb3AudmFsdWUuc3RhcnQ7XG4gICAgICBpZiAocHJvcC5raW5kID09PSBcImdldFwiKVxuICAgICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShzdGFydCwgXCJnZXR0ZXIgc2hvdWxkIGhhdmUgbm8gcGFyYW1zXCIpOyB9XG4gICAgICBlbHNlXG4gICAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHN0YXJ0LCBcInNldHRlciBzaG91bGQgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbVwiKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocHJvcC5raW5kID09PSBcInNldFwiICYmIHByb3AudmFsdWUucGFyYW1zWzBdLnR5cGUgPT09IFwiUmVzdEVsZW1lbnRcIilcbiAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUocHJvcC52YWx1ZS5wYXJhbXNbMF0uc3RhcnQsIFwiU2V0dGVyIGNhbm5vdCB1c2UgcmVzdCBwYXJhbXNcIik7IH1cbiAgICB9XG4gIH07XG5cbiAgcHAkNS5wYXJzZVByb3BlcnR5VmFsdWUgPSBmdW5jdGlvbihwcm9wLCBpc1BhdHRlcm4sIGlzR2VuZXJhdG9yLCBpc0FzeW5jLCBzdGFydFBvcywgc3RhcnRMb2MsIHJlZkRlc3RydWN0dXJpbmdFcnJvcnMsIGNvbnRhaW5zRXNjKSB7XG4gICAgaWYgKChpc0dlbmVyYXRvciB8fCBpc0FzeW5jKSAmJiB0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29sb24pXG4gICAgICB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG5cbiAgICBpZiAodGhpcy5lYXQodHlwZXMkMS5jb2xvbikpIHtcbiAgICAgIHByb3AudmFsdWUgPSBpc1BhdHRlcm4gPyB0aGlzLnBhcnNlTWF5YmVEZWZhdWx0KHRoaXMuc3RhcnQsIHRoaXMuc3RhcnRMb2MpIDogdGhpcy5wYXJzZU1heWJlQXNzaWduKGZhbHNlLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTtcbiAgICAgIHByb3Aua2luZCA9IFwiaW5pdFwiO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYgJiYgdGhpcy50eXBlID09PSB0eXBlcyQxLnBhcmVuTCkge1xuICAgICAgaWYgKGlzUGF0dGVybikgeyB0aGlzLnVuZXhwZWN0ZWQoKTsgfVxuICAgICAgcHJvcC5raW5kID0gXCJpbml0XCI7XG4gICAgICBwcm9wLm1ldGhvZCA9IHRydWU7XG4gICAgICBwcm9wLnZhbHVlID0gdGhpcy5wYXJzZU1ldGhvZChpc0dlbmVyYXRvciwgaXNBc3luYyk7XG4gICAgfSBlbHNlIGlmICghaXNQYXR0ZXJuICYmICFjb250YWluc0VzYyAmJlxuICAgICAgICAgICAgICAgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDUgJiYgIXByb3AuY29tcHV0ZWQgJiYgcHJvcC5rZXkudHlwZSA9PT0gXCJJZGVudGlmaWVyXCIgJiZcbiAgICAgICAgICAgICAgIChwcm9wLmtleS5uYW1lID09PSBcImdldFwiIHx8IHByb3Aua2V5Lm5hbWUgPT09IFwic2V0XCIpICYmXG4gICAgICAgICAgICAgICAodGhpcy50eXBlICE9PSB0eXBlcyQxLmNvbW1hICYmIHRoaXMudHlwZSAhPT0gdHlwZXMkMS5icmFjZVIgJiYgdGhpcy50eXBlICE9PSB0eXBlcyQxLmVxKSkge1xuICAgICAgaWYgKGlzR2VuZXJhdG9yIHx8IGlzQXN5bmMpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgIHRoaXMucGFyc2VHZXR0ZXJTZXR0ZXIocHJvcCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNiAmJiAhcHJvcC5jb21wdXRlZCAmJiBwcm9wLmtleS50eXBlID09PSBcIklkZW50aWZpZXJcIikge1xuICAgICAgaWYgKGlzR2VuZXJhdG9yIHx8IGlzQXN5bmMpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgIHRoaXMuY2hlY2tVbnJlc2VydmVkKHByb3Aua2V5KTtcbiAgICAgIGlmIChwcm9wLmtleS5uYW1lID09PSBcImF3YWl0XCIgJiYgIXRoaXMuYXdhaXRJZGVudFBvcylcbiAgICAgICAgeyB0aGlzLmF3YWl0SWRlbnRQb3MgPSBzdGFydFBvczsgfVxuICAgICAgcHJvcC5raW5kID0gXCJpbml0XCI7XG4gICAgICBpZiAoaXNQYXR0ZXJuKSB7XG4gICAgICAgIHByb3AudmFsdWUgPSB0aGlzLnBhcnNlTWF5YmVEZWZhdWx0KHN0YXJ0UG9zLCBzdGFydExvYywgdGhpcy5jb3B5Tm9kZShwcm9wLmtleSkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnR5cGUgPT09IHR5cGVzJDEuZXEgJiYgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykge1xuICAgICAgICBpZiAocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5zaG9ydGhhbmRBc3NpZ24gPCAwKVxuICAgICAgICAgIHsgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy5zaG9ydGhhbmRBc3NpZ24gPSB0aGlzLnN0YXJ0OyB9XG4gICAgICAgIHByb3AudmFsdWUgPSB0aGlzLnBhcnNlTWF5YmVEZWZhdWx0KHN0YXJ0UG9zLCBzdGFydExvYywgdGhpcy5jb3B5Tm9kZShwcm9wLmtleSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJvcC52YWx1ZSA9IHRoaXMuY29weU5vZGUocHJvcC5rZXkpO1xuICAgICAgfVxuICAgICAgcHJvcC5zaG9ydGhhbmQgPSB0cnVlO1xuICAgIH0gZWxzZSB7IHRoaXMudW5leHBlY3RlZCgpOyB9XG4gIH07XG5cbiAgcHAkNS5wYXJzZVByb3BlcnR5TmFtZSA9IGZ1bmN0aW9uKHByb3ApIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpIHtcbiAgICAgIGlmICh0aGlzLmVhdCh0eXBlcyQxLmJyYWNrZXRMKSkge1xuICAgICAgICBwcm9wLmNvbXB1dGVkID0gdHJ1ZTtcbiAgICAgICAgcHJvcC5rZXkgPSB0aGlzLnBhcnNlTWF5YmVBc3NpZ24oKTtcbiAgICAgICAgdGhpcy5leHBlY3QodHlwZXMkMS5icmFja2V0Uik7XG4gICAgICAgIHJldHVybiBwcm9wLmtleVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJvcC5jb21wdXRlZCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcHJvcC5rZXkgPSB0aGlzLnR5cGUgPT09IHR5cGVzJDEubnVtIHx8IHRoaXMudHlwZSA9PT0gdHlwZXMkMS5zdHJpbmcgPyB0aGlzLnBhcnNlRXhwckF0b20oKSA6IHRoaXMucGFyc2VJZGVudCh0aGlzLm9wdGlvbnMuYWxsb3dSZXNlcnZlZCAhPT0gXCJuZXZlclwiKVxuICB9O1xuXG4gIC8vIEluaXRpYWxpemUgZW1wdHkgZnVuY3Rpb24gbm9kZS5cblxuICBwcCQ1LmluaXRGdW5jdGlvbiA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBub2RlLmlkID0gbnVsbDtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpIHsgbm9kZS5nZW5lcmF0b3IgPSBub2RlLmV4cHJlc3Npb24gPSBmYWxzZTsgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOCkgeyBub2RlLmFzeW5jID0gZmFsc2U7IH1cbiAgfTtcblxuICAvLyBQYXJzZSBvYmplY3Qgb3IgY2xhc3MgbWV0aG9kLlxuXG4gIHBwJDUucGFyc2VNZXRob2QgPSBmdW5jdGlvbihpc0dlbmVyYXRvciwgaXNBc3luYywgYWxsb3dEaXJlY3RTdXBlcikge1xuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKSwgb2xkWWllbGRQb3MgPSB0aGlzLnlpZWxkUG9zLCBvbGRBd2FpdFBvcyA9IHRoaXMuYXdhaXRQb3MsIG9sZEF3YWl0SWRlbnRQb3MgPSB0aGlzLmF3YWl0SWRlbnRQb3M7XG5cbiAgICB0aGlzLmluaXRGdW5jdGlvbihub2RlKTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpXG4gICAgICB7IG5vZGUuZ2VuZXJhdG9yID0gaXNHZW5lcmF0b3I7IH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDgpXG4gICAgICB7IG5vZGUuYXN5bmMgPSAhIWlzQXN5bmM7IH1cblxuICAgIHRoaXMueWllbGRQb3MgPSAwO1xuICAgIHRoaXMuYXdhaXRQb3MgPSAwO1xuICAgIHRoaXMuYXdhaXRJZGVudFBvcyA9IDA7XG4gICAgdGhpcy5lbnRlclNjb3BlKGZ1bmN0aW9uRmxhZ3MoaXNBc3luYywgbm9kZS5nZW5lcmF0b3IpIHwgU0NPUEVfU1VQRVIgfCAoYWxsb3dEaXJlY3RTdXBlciA/IFNDT1BFX0RJUkVDVF9TVVBFUiA6IDApKTtcblxuICAgIHRoaXMuZXhwZWN0KHR5cGVzJDEucGFyZW5MKTtcbiAgICBub2RlLnBhcmFtcyA9IHRoaXMucGFyc2VCaW5kaW5nTGlzdCh0eXBlcyQxLnBhcmVuUiwgZmFsc2UsIHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA4KTtcbiAgICB0aGlzLmNoZWNrWWllbGRBd2FpdEluRGVmYXVsdFBhcmFtcygpO1xuICAgIHRoaXMucGFyc2VGdW5jdGlvbkJvZHkobm9kZSwgZmFsc2UsIHRydWUsIGZhbHNlKTtcblxuICAgIHRoaXMueWllbGRQb3MgPSBvbGRZaWVsZFBvcztcbiAgICB0aGlzLmF3YWl0UG9zID0gb2xkQXdhaXRQb3M7XG4gICAgdGhpcy5hd2FpdElkZW50UG9zID0gb2xkQXdhaXRJZGVudFBvcztcbiAgICByZXR1cm4gdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiRnVuY3Rpb25FeHByZXNzaW9uXCIpXG4gIH07XG5cbiAgLy8gUGFyc2UgYXJyb3cgZnVuY3Rpb24gZXhwcmVzc2lvbiB3aXRoIGdpdmVuIHBhcmFtZXRlcnMuXG5cbiAgcHAkNS5wYXJzZUFycm93RXhwcmVzc2lvbiA9IGZ1bmN0aW9uKG5vZGUsIHBhcmFtcywgaXNBc3luYywgZm9ySW5pdCkge1xuICAgIHZhciBvbGRZaWVsZFBvcyA9IHRoaXMueWllbGRQb3MsIG9sZEF3YWl0UG9zID0gdGhpcy5hd2FpdFBvcywgb2xkQXdhaXRJZGVudFBvcyA9IHRoaXMuYXdhaXRJZGVudFBvcztcblxuICAgIHRoaXMuZW50ZXJTY29wZShmdW5jdGlvbkZsYWdzKGlzQXN5bmMsIGZhbHNlKSB8IFNDT1BFX0FSUk9XKTtcbiAgICB0aGlzLmluaXRGdW5jdGlvbihub2RlKTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDgpIHsgbm9kZS5hc3luYyA9ICEhaXNBc3luYzsgfVxuXG4gICAgdGhpcy55aWVsZFBvcyA9IDA7XG4gICAgdGhpcy5hd2FpdFBvcyA9IDA7XG4gICAgdGhpcy5hd2FpdElkZW50UG9zID0gMDtcblxuICAgIG5vZGUucGFyYW1zID0gdGhpcy50b0Fzc2lnbmFibGVMaXN0KHBhcmFtcywgdHJ1ZSk7XG4gICAgdGhpcy5wYXJzZUZ1bmN0aW9uQm9keShub2RlLCB0cnVlLCBmYWxzZSwgZm9ySW5pdCk7XG5cbiAgICB0aGlzLnlpZWxkUG9zID0gb2xkWWllbGRQb3M7XG4gICAgdGhpcy5hd2FpdFBvcyA9IG9sZEF3YWl0UG9zO1xuICAgIHRoaXMuYXdhaXRJZGVudFBvcyA9IG9sZEF3YWl0SWRlbnRQb3M7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIkFycm93RnVuY3Rpb25FeHByZXNzaW9uXCIpXG4gIH07XG5cbiAgLy8gUGFyc2UgZnVuY3Rpb24gYm9keSBhbmQgY2hlY2sgcGFyYW1ldGVycy5cblxuICBwcCQ1LnBhcnNlRnVuY3Rpb25Cb2R5ID0gZnVuY3Rpb24obm9kZSwgaXNBcnJvd0Z1bmN0aW9uLCBpc01ldGhvZCwgZm9ySW5pdCkge1xuICAgIHZhciBpc0V4cHJlc3Npb24gPSBpc0Fycm93RnVuY3Rpb24gJiYgdGhpcy50eXBlICE9PSB0eXBlcyQxLmJyYWNlTDtcbiAgICB2YXIgb2xkU3RyaWN0ID0gdGhpcy5zdHJpY3QsIHVzZVN0cmljdCA9IGZhbHNlO1xuXG4gICAgaWYgKGlzRXhwcmVzc2lvbikge1xuICAgICAgbm9kZS5ib2R5ID0gdGhpcy5wYXJzZU1heWJlQXNzaWduKGZvckluaXQpO1xuICAgICAgbm9kZS5leHByZXNzaW9uID0gdHJ1ZTtcbiAgICAgIHRoaXMuY2hlY2tQYXJhbXMobm9kZSwgZmFsc2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgbm9uU2ltcGxlID0gdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDcgJiYgIXRoaXMuaXNTaW1wbGVQYXJhbUxpc3Qobm9kZS5wYXJhbXMpO1xuICAgICAgaWYgKCFvbGRTdHJpY3QgfHwgbm9uU2ltcGxlKSB7XG4gICAgICAgIHVzZVN0cmljdCA9IHRoaXMuc3RyaWN0RGlyZWN0aXZlKHRoaXMuZW5kKTtcbiAgICAgICAgLy8gSWYgdGhpcyBpcyBhIHN0cmljdCBtb2RlIGZ1bmN0aW9uLCB2ZXJpZnkgdGhhdCBhcmd1bWVudCBuYW1lc1xuICAgICAgICAvLyBhcmUgbm90IHJlcGVhdGVkLCBhbmQgaXQgZG9lcyBub3QgdHJ5IHRvIGJpbmQgdGhlIHdvcmRzIGBldmFsYFxuICAgICAgICAvLyBvciBgYXJndW1lbnRzYC5cbiAgICAgICAgaWYgKHVzZVN0cmljdCAmJiBub25TaW1wbGUpXG4gICAgICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUobm9kZS5zdGFydCwgXCJJbGxlZ2FsICd1c2Ugc3RyaWN0JyBkaXJlY3RpdmUgaW4gZnVuY3Rpb24gd2l0aCBub24tc2ltcGxlIHBhcmFtZXRlciBsaXN0XCIpOyB9XG4gICAgICB9XG4gICAgICAvLyBTdGFydCBhIG5ldyBzY29wZSB3aXRoIHJlZ2FyZCB0byBsYWJlbHMgYW5kIHRoZSBgaW5GdW5jdGlvbmBcbiAgICAgIC8vIGZsYWcgKHJlc3RvcmUgdGhlbSB0byB0aGVpciBvbGQgdmFsdWUgYWZ0ZXJ3YXJkcykuXG4gICAgICB2YXIgb2xkTGFiZWxzID0gdGhpcy5sYWJlbHM7XG4gICAgICB0aGlzLmxhYmVscyA9IFtdO1xuICAgICAgaWYgKHVzZVN0cmljdCkgeyB0aGlzLnN0cmljdCA9IHRydWU7IH1cblxuICAgICAgLy8gQWRkIHRoZSBwYXJhbXMgdG8gdmFyRGVjbGFyZWROYW1lcyB0byBlbnN1cmUgdGhhdCBhbiBlcnJvciBpcyB0aHJvd25cbiAgICAgIC8vIGlmIGEgbGV0L2NvbnN0IGRlY2xhcmF0aW9uIGluIHRoZSBmdW5jdGlvbiBjbGFzaGVzIHdpdGggb25lIG9mIHRoZSBwYXJhbXMuXG4gICAgICB0aGlzLmNoZWNrUGFyYW1zKG5vZGUsICFvbGRTdHJpY3QgJiYgIXVzZVN0cmljdCAmJiAhaXNBcnJvd0Z1bmN0aW9uICYmICFpc01ldGhvZCAmJiB0aGlzLmlzU2ltcGxlUGFyYW1MaXN0KG5vZGUucGFyYW1zKSk7XG4gICAgICAvLyBFbnN1cmUgdGhlIGZ1bmN0aW9uIG5hbWUgaXNuJ3QgYSBmb3JiaWRkZW4gaWRlbnRpZmllciBpbiBzdHJpY3QgbW9kZSwgZS5nLiAnZXZhbCdcbiAgICAgIGlmICh0aGlzLnN0cmljdCAmJiBub2RlLmlkKSB7IHRoaXMuY2hlY2tMVmFsU2ltcGxlKG5vZGUuaWQsIEJJTkRfT1VUU0lERSk7IH1cbiAgICAgIG5vZGUuYm9keSA9IHRoaXMucGFyc2VCbG9jayhmYWxzZSwgdW5kZWZpbmVkLCB1c2VTdHJpY3QgJiYgIW9sZFN0cmljdCk7XG4gICAgICBub2RlLmV4cHJlc3Npb24gPSBmYWxzZTtcbiAgICAgIHRoaXMuYWRhcHREaXJlY3RpdmVQcm9sb2d1ZShub2RlLmJvZHkuYm9keSk7XG4gICAgICB0aGlzLmxhYmVscyA9IG9sZExhYmVscztcbiAgICB9XG4gICAgdGhpcy5leGl0U2NvcGUoKTtcbiAgfTtcblxuICBwcCQ1LmlzU2ltcGxlUGFyYW1MaXN0ID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxpc3QgPSBwYXJhbXM7IGkgPCBsaXN0Lmxlbmd0aDsgaSArPSAxKVxuICAgICAge1xuICAgICAgdmFyIHBhcmFtID0gbGlzdFtpXTtcblxuICAgICAgaWYgKHBhcmFtLnR5cGUgIT09IFwiSWRlbnRpZmllclwiKSB7IHJldHVybiBmYWxzZVxuICAgIH0gfVxuICAgIHJldHVybiB0cnVlXG4gIH07XG5cbiAgLy8gQ2hlY2tzIGZ1bmN0aW9uIHBhcmFtcyBmb3IgdmFyaW91cyBkaXNhbGxvd2VkIHBhdHRlcm5zIHN1Y2ggYXMgdXNpbmcgXCJldmFsXCJcbiAgLy8gb3IgXCJhcmd1bWVudHNcIiBhbmQgZHVwbGljYXRlIHBhcmFtZXRlcnMuXG5cbiAgcHAkNS5jaGVja1BhcmFtcyA9IGZ1bmN0aW9uKG5vZGUsIGFsbG93RHVwbGljYXRlcykge1xuICAgIHZhciBuYW1lSGFzaCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxpc3QgPSBub2RlLnBhcmFtczsgaSA8IGxpc3QubGVuZ3RoOyBpICs9IDEpXG4gICAgICB7XG4gICAgICB2YXIgcGFyYW0gPSBsaXN0W2ldO1xuXG4gICAgICB0aGlzLmNoZWNrTFZhbElubmVyUGF0dGVybihwYXJhbSwgQklORF9WQVIsIGFsbG93RHVwbGljYXRlcyA/IG51bGwgOiBuYW1lSGFzaCk7XG4gICAgfVxuICB9O1xuXG4gIC8vIFBhcnNlcyBhIGNvbW1hLXNlcGFyYXRlZCBsaXN0IG9mIGV4cHJlc3Npb25zLCBhbmQgcmV0dXJucyB0aGVtIGFzXG4gIC8vIGFuIGFycmF5LiBgY2xvc2VgIGlzIHRoZSB0b2tlbiB0eXBlIHRoYXQgZW5kcyB0aGUgbGlzdCwgYW5kXG4gIC8vIGBhbGxvd0VtcHR5YCBjYW4gYmUgdHVybmVkIG9uIHRvIGFsbG93IHN1YnNlcXVlbnQgY29tbWFzIHdpdGhcbiAgLy8gbm90aGluZyBpbiBiZXR3ZWVuIHRoZW0gdG8gYmUgcGFyc2VkIGFzIGBudWxsYCAod2hpY2ggaXMgbmVlZGVkXG4gIC8vIGZvciBhcnJheSBsaXRlcmFscykuXG5cbiAgcHAkNS5wYXJzZUV4cHJMaXN0ID0gZnVuY3Rpb24oY2xvc2UsIGFsbG93VHJhaWxpbmdDb21tYSwgYWxsb3dFbXB0eSwgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycykge1xuICAgIHZhciBlbHRzID0gW10sIGZpcnN0ID0gdHJ1ZTtcbiAgICB3aGlsZSAoIXRoaXMuZWF0KGNsb3NlKSkge1xuICAgICAgaWYgKCFmaXJzdCkge1xuICAgICAgICB0aGlzLmV4cGVjdCh0eXBlcyQxLmNvbW1hKTtcbiAgICAgICAgaWYgKGFsbG93VHJhaWxpbmdDb21tYSAmJiB0aGlzLmFmdGVyVHJhaWxpbmdDb21tYShjbG9zZSkpIHsgYnJlYWsgfVxuICAgICAgfSBlbHNlIHsgZmlyc3QgPSBmYWxzZTsgfVxuXG4gICAgICB2YXIgZWx0ID0gKHZvaWQgMCk7XG4gICAgICBpZiAoYWxsb3dFbXB0eSAmJiB0aGlzLnR5cGUgPT09IHR5cGVzJDEuY29tbWEpXG4gICAgICAgIHsgZWx0ID0gbnVsbDsgfVxuICAgICAgZWxzZSBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLmVsbGlwc2lzKSB7XG4gICAgICAgIGVsdCA9IHRoaXMucGFyc2VTcHJlYWQocmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycyk7XG4gICAgICAgIGlmIChyZWZEZXN0cnVjdHVyaW5nRXJyb3JzICYmIHRoaXMudHlwZSA9PT0gdHlwZXMkMS5jb21tYSAmJiByZWZEZXN0cnVjdHVyaW5nRXJyb3JzLnRyYWlsaW5nQ29tbWEgPCAwKVxuICAgICAgICAgIHsgcmVmRGVzdHJ1Y3R1cmluZ0Vycm9ycy50cmFpbGluZ0NvbW1hID0gdGhpcy5zdGFydDsgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWx0ID0gdGhpcy5wYXJzZU1heWJlQXNzaWduKGZhbHNlLCByZWZEZXN0cnVjdHVyaW5nRXJyb3JzKTtcbiAgICAgIH1cbiAgICAgIGVsdHMucHVzaChlbHQpO1xuICAgIH1cbiAgICByZXR1cm4gZWx0c1xuICB9O1xuXG4gIHBwJDUuY2hlY2tVbnJlc2VydmVkID0gZnVuY3Rpb24ocmVmKSB7XG4gICAgdmFyIHN0YXJ0ID0gcmVmLnN0YXJ0O1xuICAgIHZhciBlbmQgPSByZWYuZW5kO1xuICAgIHZhciBuYW1lID0gcmVmLm5hbWU7XG5cbiAgICBpZiAodGhpcy5pbkdlbmVyYXRvciAmJiBuYW1lID09PSBcInlpZWxkXCIpXG4gICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShzdGFydCwgXCJDYW5ub3QgdXNlICd5aWVsZCcgYXMgaWRlbnRpZmllciBpbnNpZGUgYSBnZW5lcmF0b3JcIik7IH1cbiAgICBpZiAodGhpcy5pbkFzeW5jICYmIG5hbWUgPT09IFwiYXdhaXRcIilcbiAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHN0YXJ0LCBcIkNhbm5vdCB1c2UgJ2F3YWl0JyBhcyBpZGVudGlmaWVyIGluc2lkZSBhbiBhc3luYyBmdW5jdGlvblwiKTsgfVxuICAgIGlmICh0aGlzLmN1cnJlbnRUaGlzU2NvcGUoKS5pbkNsYXNzRmllbGRJbml0ICYmIG5hbWUgPT09IFwiYXJndW1lbnRzXCIpXG4gICAgICB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZShzdGFydCwgXCJDYW5ub3QgdXNlICdhcmd1bWVudHMnIGluIGNsYXNzIGZpZWxkIGluaXRpYWxpemVyXCIpOyB9XG4gICAgaWYgKHRoaXMuaW5DbGFzc1N0YXRpY0Jsb2NrICYmIChuYW1lID09PSBcImFyZ3VtZW50c1wiIHx8IG5hbWUgPT09IFwiYXdhaXRcIikpXG4gICAgICB7IHRoaXMucmFpc2Uoc3RhcnQsIChcIkNhbm5vdCB1c2UgXCIgKyBuYW1lICsgXCIgaW4gY2xhc3Mgc3RhdGljIGluaXRpYWxpemF0aW9uIGJsb2NrXCIpKTsgfVxuICAgIGlmICh0aGlzLmtleXdvcmRzLnRlc3QobmFtZSkpXG4gICAgICB7IHRoaXMucmFpc2Uoc3RhcnQsIChcIlVuZXhwZWN0ZWQga2V5d29yZCAnXCIgKyBuYW1lICsgXCInXCIpKTsgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPCA2ICYmXG4gICAgICB0aGlzLmlucHV0LnNsaWNlKHN0YXJ0LCBlbmQpLmluZGV4T2YoXCJcXFxcXCIpICE9PSAtMSkgeyByZXR1cm4gfVxuICAgIHZhciByZSA9IHRoaXMuc3RyaWN0ID8gdGhpcy5yZXNlcnZlZFdvcmRzU3RyaWN0IDogdGhpcy5yZXNlcnZlZFdvcmRzO1xuICAgIGlmIChyZS50ZXN0KG5hbWUpKSB7XG4gICAgICBpZiAoIXRoaXMuaW5Bc3luYyAmJiBuYW1lID09PSBcImF3YWl0XCIpXG4gICAgICAgIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHN0YXJ0LCBcIkNhbm5vdCB1c2Uga2V5d29yZCAnYXdhaXQnIG91dHNpZGUgYW4gYXN5bmMgZnVuY3Rpb25cIik7IH1cbiAgICAgIHRoaXMucmFpc2VSZWNvdmVyYWJsZShzdGFydCwgKFwiVGhlIGtleXdvcmQgJ1wiICsgbmFtZSArIFwiJyBpcyByZXNlcnZlZFwiKSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIFBhcnNlIHRoZSBuZXh0IHRva2VuIGFzIGFuIGlkZW50aWZpZXIuIElmIGBsaWJlcmFsYCBpcyB0cnVlICh1c2VkXG4gIC8vIHdoZW4gcGFyc2luZyBwcm9wZXJ0aWVzKSwgaXQgd2lsbCBhbHNvIGNvbnZlcnQga2V5d29yZHMgaW50b1xuICAvLyBpZGVudGlmaWVycy5cblxuICBwcCQ1LnBhcnNlSWRlbnQgPSBmdW5jdGlvbihsaWJlcmFsKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLnBhcnNlSWRlbnROb2RlKCk7XG4gICAgdGhpcy5uZXh0KCEhbGliZXJhbCk7XG4gICAgdGhpcy5maW5pc2hOb2RlKG5vZGUsIFwiSWRlbnRpZmllclwiKTtcbiAgICBpZiAoIWxpYmVyYWwpIHtcbiAgICAgIHRoaXMuY2hlY2tVbnJlc2VydmVkKG5vZGUpO1xuICAgICAgaWYgKG5vZGUubmFtZSA9PT0gXCJhd2FpdFwiICYmICF0aGlzLmF3YWl0SWRlbnRQb3MpXG4gICAgICAgIHsgdGhpcy5hd2FpdElkZW50UG9zID0gbm9kZS5zdGFydDsgfVxuICAgIH1cbiAgICByZXR1cm4gbm9kZVxuICB9O1xuXG4gIHBwJDUucGFyc2VJZGVudE5vZGUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuc3RhcnROb2RlKCk7XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS5uYW1lKSB7XG4gICAgICBub2RlLm5hbWUgPSB0aGlzLnZhbHVlO1xuICAgIH0gZWxzZSBpZiAodGhpcy50eXBlLmtleXdvcmQpIHtcbiAgICAgIG5vZGUubmFtZSA9IHRoaXMudHlwZS5rZXl3b3JkO1xuXG4gICAgICAvLyBUbyBmaXggaHR0cHM6Ly9naXRodWIuY29tL2Fjb3JuanMvYWNvcm4vaXNzdWVzLzU3NVxuICAgICAgLy8gYGNsYXNzYCBhbmQgYGZ1bmN0aW9uYCBrZXl3b3JkcyBwdXNoIG5ldyBjb250ZXh0IGludG8gdGhpcy5jb250ZXh0LlxuICAgICAgLy8gQnV0IHRoZXJlIGlzIG5vIGNoYW5jZSB0byBwb3AgdGhlIGNvbnRleHQgaWYgdGhlIGtleXdvcmQgaXMgY29uc3VtZWQgYXMgYW4gaWRlbnRpZmllciBzdWNoIGFzIGEgcHJvcGVydHkgbmFtZS5cbiAgICAgIC8vIElmIHRoZSBwcmV2aW91cyB0b2tlbiBpcyBhIGRvdCwgdGhpcyBkb2VzIG5vdCBhcHBseSBiZWNhdXNlIHRoZSBjb250ZXh0LW1hbmFnaW5nIGNvZGUgYWxyZWFkeSBpZ25vcmVkIHRoZSBrZXl3b3JkXG4gICAgICBpZiAoKG5vZGUubmFtZSA9PT0gXCJjbGFzc1wiIHx8IG5vZGUubmFtZSA9PT0gXCJmdW5jdGlvblwiKSAmJlxuICAgICAgICAodGhpcy5sYXN0VG9rRW5kICE9PSB0aGlzLmxhc3RUb2tTdGFydCArIDEgfHwgdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMubGFzdFRva1N0YXJ0KSAhPT0gNDYpKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5wb3AoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51bmV4cGVjdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiBub2RlXG4gIH07XG5cbiAgcHAkNS5wYXJzZVByaXZhdGVJZGVudCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnByaXZhdGVJZCkge1xuICAgICAgbm9kZS5uYW1lID0gdGhpcy52YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51bmV4cGVjdGVkKCk7XG4gICAgfVxuICAgIHRoaXMubmV4dCgpO1xuICAgIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIlByaXZhdGVJZGVudGlmaWVyXCIpO1xuXG4gICAgLy8gRm9yIHZhbGlkYXRpbmcgZXhpc3RlbmNlXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jaGVja1ByaXZhdGVGaWVsZHMpIHtcbiAgICAgIGlmICh0aGlzLnByaXZhdGVOYW1lU3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMucmFpc2Uobm9kZS5zdGFydCwgKFwiUHJpdmF0ZSBmaWVsZCAnI1wiICsgKG5vZGUubmFtZSkgKyBcIicgbXVzdCBiZSBkZWNsYXJlZCBpbiBhbiBlbmNsb3NpbmcgY2xhc3NcIikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wcml2YXRlTmFtZVN0YWNrW3RoaXMucHJpdmF0ZU5hbWVTdGFjay5sZW5ndGggLSAxXS51c2VkLnB1c2gobm9kZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVcbiAgfTtcblxuICAvLyBQYXJzZXMgeWllbGQgZXhwcmVzc2lvbiBpbnNpZGUgZ2VuZXJhdG9yLlxuXG4gIHBwJDUucGFyc2VZaWVsZCA9IGZ1bmN0aW9uKGZvckluaXQpIHtcbiAgICBpZiAoIXRoaXMueWllbGRQb3MpIHsgdGhpcy55aWVsZFBvcyA9IHRoaXMuc3RhcnQ7IH1cblxuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICB0aGlzLm5leHQoKTtcbiAgICBpZiAodGhpcy50eXBlID09PSB0eXBlcyQxLnNlbWkgfHwgdGhpcy5jYW5JbnNlcnRTZW1pY29sb24oKSB8fCAodGhpcy50eXBlICE9PSB0eXBlcyQxLnN0YXIgJiYgIXRoaXMudHlwZS5zdGFydHNFeHByKSkge1xuICAgICAgbm9kZS5kZWxlZ2F0ZSA9IGZhbHNlO1xuICAgICAgbm9kZS5hcmd1bWVudCA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGUuZGVsZWdhdGUgPSB0aGlzLmVhdCh0eXBlcyQxLnN0YXIpO1xuICAgICAgbm9kZS5hcmd1bWVudCA9IHRoaXMucGFyc2VNYXliZUFzc2lnbihmb3JJbml0KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoTm9kZShub2RlLCBcIllpZWxkRXhwcmVzc2lvblwiKVxuICB9O1xuXG4gIHBwJDUucGFyc2VBd2FpdCA9IGZ1bmN0aW9uKGZvckluaXQpIHtcbiAgICBpZiAoIXRoaXMuYXdhaXRQb3MpIHsgdGhpcy5hd2FpdFBvcyA9IHRoaXMuc3RhcnQ7IH1cblxuICAgIHZhciBub2RlID0gdGhpcy5zdGFydE5vZGUoKTtcbiAgICB0aGlzLm5leHQoKTtcbiAgICBub2RlLmFyZ3VtZW50ID0gdGhpcy5wYXJzZU1heWJlVW5hcnkobnVsbCwgdHJ1ZSwgZmFsc2UsIGZvckluaXQpO1xuICAgIHJldHVybiB0aGlzLmZpbmlzaE5vZGUobm9kZSwgXCJBd2FpdEV4cHJlc3Npb25cIilcbiAgfTtcblxuICB2YXIgcHAkNCA9IFBhcnNlci5wcm90b3R5cGU7XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIHJhaXNlIGV4Y2VwdGlvbnMgb24gcGFyc2UgZXJyb3JzLiBJdFxuICAvLyB0YWtlcyBhbiBvZmZzZXQgaW50ZWdlciAoaW50byB0aGUgY3VycmVudCBgaW5wdXRgKSB0byBpbmRpY2F0ZVxuICAvLyB0aGUgbG9jYXRpb24gb2YgdGhlIGVycm9yLCBhdHRhY2hlcyB0aGUgcG9zaXRpb24gdG8gdGhlIGVuZFxuICAvLyBvZiB0aGUgZXJyb3IgbWVzc2FnZSwgYW5kIHRoZW4gcmFpc2VzIGEgYFN5bnRheEVycm9yYCB3aXRoIHRoYXRcbiAgLy8gbWVzc2FnZS5cblxuICBwcCQ0LnJhaXNlID0gZnVuY3Rpb24ocG9zLCBtZXNzYWdlKSB7XG4gICAgdmFyIGxvYyA9IGdldExpbmVJbmZvKHRoaXMuaW5wdXQsIHBvcyk7XG4gICAgbWVzc2FnZSArPSBcIiAoXCIgKyBsb2MubGluZSArIFwiOlwiICsgbG9jLmNvbHVtbiArIFwiKVwiO1xuICAgIHZhciBlcnIgPSBuZXcgU3ludGF4RXJyb3IobWVzc2FnZSk7XG4gICAgZXJyLnBvcyA9IHBvczsgZXJyLmxvYyA9IGxvYzsgZXJyLnJhaXNlZEF0ID0gdGhpcy5wb3M7XG4gICAgdGhyb3cgZXJyXG4gIH07XG5cbiAgcHAkNC5yYWlzZVJlY292ZXJhYmxlID0gcHAkNC5yYWlzZTtcblxuICBwcCQ0LmN1clBvc2l0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5sb2NhdGlvbnMpIHtcbiAgICAgIHJldHVybiBuZXcgUG9zaXRpb24odGhpcy5jdXJMaW5lLCB0aGlzLnBvcyAtIHRoaXMubGluZVN0YXJ0KVxuICAgIH1cbiAgfTtcblxuICB2YXIgcHAkMyA9IFBhcnNlci5wcm90b3R5cGU7XG5cbiAgdmFyIFNjb3BlID0gZnVuY3Rpb24gU2NvcGUoZmxhZ3MpIHtcbiAgICB0aGlzLmZsYWdzID0gZmxhZ3M7XG4gICAgLy8gQSBsaXN0IG9mIHZhci1kZWNsYXJlZCBuYW1lcyBpbiB0aGUgY3VycmVudCBsZXhpY2FsIHNjb3BlXG4gICAgdGhpcy52YXIgPSBbXTtcbiAgICAvLyBBIGxpc3Qgb2YgbGV4aWNhbGx5LWRlY2xhcmVkIG5hbWVzIGluIHRoZSBjdXJyZW50IGxleGljYWwgc2NvcGVcbiAgICB0aGlzLmxleGljYWwgPSBbXTtcbiAgICAvLyBBIGxpc3Qgb2YgbGV4aWNhbGx5LWRlY2xhcmVkIEZ1bmN0aW9uRGVjbGFyYXRpb24gbmFtZXMgaW4gdGhlIGN1cnJlbnQgbGV4aWNhbCBzY29wZVxuICAgIHRoaXMuZnVuY3Rpb25zID0gW107XG4gICAgLy8gQSBzd2l0Y2ggdG8gZGlzYWxsb3cgdGhlIGlkZW50aWZpZXIgcmVmZXJlbmNlICdhcmd1bWVudHMnXG4gICAgdGhpcy5pbkNsYXNzRmllbGRJbml0ID0gZmFsc2U7XG4gIH07XG5cbiAgLy8gVGhlIGZ1bmN0aW9ucyBpbiB0aGlzIG1vZHVsZSBrZWVwIHRyYWNrIG9mIGRlY2xhcmVkIHZhcmlhYmxlcyBpbiB0aGUgY3VycmVudCBzY29wZSBpbiBvcmRlciB0byBkZXRlY3QgZHVwbGljYXRlIHZhcmlhYmxlIG5hbWVzLlxuXG4gIHBwJDMuZW50ZXJTY29wZSA9IGZ1bmN0aW9uKGZsYWdzKSB7XG4gICAgdGhpcy5zY29wZVN0YWNrLnB1c2gobmV3IFNjb3BlKGZsYWdzKSk7XG4gIH07XG5cbiAgcHAkMy5leGl0U2NvcGUgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnNjb3BlU3RhY2sucG9wKCk7XG4gIH07XG5cbiAgLy8gVGhlIHNwZWMgc2F5czpcbiAgLy8gPiBBdCB0aGUgdG9wIGxldmVsIG9mIGEgZnVuY3Rpb24sIG9yIHNjcmlwdCwgZnVuY3Rpb24gZGVjbGFyYXRpb25zIGFyZVxuICAvLyA+IHRyZWF0ZWQgbGlrZSB2YXIgZGVjbGFyYXRpb25zIHJhdGhlciB0aGFuIGxpa2UgbGV4aWNhbCBkZWNsYXJhdGlvbnMuXG4gIHBwJDMudHJlYXRGdW5jdGlvbnNBc1ZhckluU2NvcGUgPSBmdW5jdGlvbihzY29wZSkge1xuICAgIHJldHVybiAoc2NvcGUuZmxhZ3MgJiBTQ09QRV9GVU5DVElPTikgfHwgIXRoaXMuaW5Nb2R1bGUgJiYgKHNjb3BlLmZsYWdzICYgU0NPUEVfVE9QKVxuICB9O1xuXG4gIHBwJDMuZGVjbGFyZU5hbWUgPSBmdW5jdGlvbihuYW1lLCBiaW5kaW5nVHlwZSwgcG9zKSB7XG4gICAgdmFyIHJlZGVjbGFyZWQgPSBmYWxzZTtcbiAgICBpZiAoYmluZGluZ1R5cGUgPT09IEJJTkRfTEVYSUNBTCkge1xuICAgICAgdmFyIHNjb3BlID0gdGhpcy5jdXJyZW50U2NvcGUoKTtcbiAgICAgIHJlZGVjbGFyZWQgPSBzY29wZS5sZXhpY2FsLmluZGV4T2YobmFtZSkgPiAtMSB8fCBzY29wZS5mdW5jdGlvbnMuaW5kZXhPZihuYW1lKSA+IC0xIHx8IHNjb3BlLnZhci5pbmRleE9mKG5hbWUpID4gLTE7XG4gICAgICBzY29wZS5sZXhpY2FsLnB1c2gobmFtZSk7XG4gICAgICBpZiAodGhpcy5pbk1vZHVsZSAmJiAoc2NvcGUuZmxhZ3MgJiBTQ09QRV9UT1ApKVxuICAgICAgICB7IGRlbGV0ZSB0aGlzLnVuZGVmaW5lZEV4cG9ydHNbbmFtZV07IH1cbiAgICB9IGVsc2UgaWYgKGJpbmRpbmdUeXBlID09PSBCSU5EX1NJTVBMRV9DQVRDSCkge1xuICAgICAgdmFyIHNjb3BlJDEgPSB0aGlzLmN1cnJlbnRTY29wZSgpO1xuICAgICAgc2NvcGUkMS5sZXhpY2FsLnB1c2gobmFtZSk7XG4gICAgfSBlbHNlIGlmIChiaW5kaW5nVHlwZSA9PT0gQklORF9GVU5DVElPTikge1xuICAgICAgdmFyIHNjb3BlJDIgPSB0aGlzLmN1cnJlbnRTY29wZSgpO1xuICAgICAgaWYgKHRoaXMudHJlYXRGdW5jdGlvbnNBc1ZhcilcbiAgICAgICAgeyByZWRlY2xhcmVkID0gc2NvcGUkMi5sZXhpY2FsLmluZGV4T2YobmFtZSkgPiAtMTsgfVxuICAgICAgZWxzZVxuICAgICAgICB7IHJlZGVjbGFyZWQgPSBzY29wZSQyLmxleGljYWwuaW5kZXhPZihuYW1lKSA+IC0xIHx8IHNjb3BlJDIudmFyLmluZGV4T2YobmFtZSkgPiAtMTsgfVxuICAgICAgc2NvcGUkMi5mdW5jdGlvbnMucHVzaChuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yICh2YXIgaSA9IHRoaXMuc2NvcGVTdGFjay5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICB2YXIgc2NvcGUkMyA9IHRoaXMuc2NvcGVTdGFja1tpXTtcbiAgICAgICAgaWYgKHNjb3BlJDMubGV4aWNhbC5pbmRleE9mKG5hbWUpID4gLTEgJiYgISgoc2NvcGUkMy5mbGFncyAmIFNDT1BFX1NJTVBMRV9DQVRDSCkgJiYgc2NvcGUkMy5sZXhpY2FsWzBdID09PSBuYW1lKSB8fFxuICAgICAgICAgICAgIXRoaXMudHJlYXRGdW5jdGlvbnNBc1ZhckluU2NvcGUoc2NvcGUkMykgJiYgc2NvcGUkMy5mdW5jdGlvbnMuaW5kZXhPZihuYW1lKSA+IC0xKSB7XG4gICAgICAgICAgcmVkZWNsYXJlZCA9IHRydWU7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgICBzY29wZSQzLnZhci5wdXNoKG5hbWUpO1xuICAgICAgICBpZiAodGhpcy5pbk1vZHVsZSAmJiAoc2NvcGUkMy5mbGFncyAmIFNDT1BFX1RPUCkpXG4gICAgICAgICAgeyBkZWxldGUgdGhpcy51bmRlZmluZWRFeHBvcnRzW25hbWVdOyB9XG4gICAgICAgIGlmIChzY29wZSQzLmZsYWdzICYgU0NPUEVfVkFSKSB7IGJyZWFrIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHJlZGVjbGFyZWQpIHsgdGhpcy5yYWlzZVJlY292ZXJhYmxlKHBvcywgKFwiSWRlbnRpZmllciAnXCIgKyBuYW1lICsgXCInIGhhcyBhbHJlYWR5IGJlZW4gZGVjbGFyZWRcIikpOyB9XG4gIH07XG5cbiAgcHAkMy5jaGVja0xvY2FsRXhwb3J0ID0gZnVuY3Rpb24oaWQpIHtcbiAgICAvLyBzY29wZS5mdW5jdGlvbnMgbXVzdCBiZSBlbXB0eSBhcyBNb2R1bGUgY29kZSBpcyBhbHdheXMgc3RyaWN0LlxuICAgIGlmICh0aGlzLnNjb3BlU3RhY2tbMF0ubGV4aWNhbC5pbmRleE9mKGlkLm5hbWUpID09PSAtMSAmJlxuICAgICAgICB0aGlzLnNjb3BlU3RhY2tbMF0udmFyLmluZGV4T2YoaWQubmFtZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLnVuZGVmaW5lZEV4cG9ydHNbaWQubmFtZV0gPSBpZDtcbiAgICB9XG4gIH07XG5cbiAgcHAkMy5jdXJyZW50U2NvcGUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zY29wZVN0YWNrW3RoaXMuc2NvcGVTdGFjay5sZW5ndGggLSAxXVxuICB9O1xuXG4gIHBwJDMuY3VycmVudFZhclNjb3BlID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuc2NvcGVTdGFjay5sZW5ndGggLSAxOzsgaS0tKSB7XG4gICAgICB2YXIgc2NvcGUgPSB0aGlzLnNjb3BlU3RhY2tbaV07XG4gICAgICBpZiAoc2NvcGUuZmxhZ3MgJiBTQ09QRV9WQVIpIHsgcmV0dXJuIHNjb3BlIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gQ291bGQgYmUgdXNlZnVsIGZvciBgdGhpc2AsIGBuZXcudGFyZ2V0YCwgYHN1cGVyKClgLCBgc3VwZXIucHJvcGVydHlgLCBhbmQgYHN1cGVyW3Byb3BlcnR5XWAuXG4gIHBwJDMuY3VycmVudFRoaXNTY29wZSA9IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnNjb3BlU3RhY2subGVuZ3RoIC0gMTs7IGktLSkge1xuICAgICAgdmFyIHNjb3BlID0gdGhpcy5zY29wZVN0YWNrW2ldO1xuICAgICAgaWYgKHNjb3BlLmZsYWdzICYgU0NPUEVfVkFSICYmICEoc2NvcGUuZmxhZ3MgJiBTQ09QRV9BUlJPVykpIHsgcmV0dXJuIHNjb3BlIH1cbiAgICB9XG4gIH07XG5cbiAgdmFyIE5vZGUgPSBmdW5jdGlvbiBOb2RlKHBhcnNlciwgcG9zLCBsb2MpIHtcbiAgICB0aGlzLnR5cGUgPSBcIlwiO1xuICAgIHRoaXMuc3RhcnQgPSBwb3M7XG4gICAgdGhpcy5lbmQgPSAwO1xuICAgIGlmIChwYXJzZXIub3B0aW9ucy5sb2NhdGlvbnMpXG4gICAgICB7IHRoaXMubG9jID0gbmV3IFNvdXJjZUxvY2F0aW9uKHBhcnNlciwgbG9jKTsgfVxuICAgIGlmIChwYXJzZXIub3B0aW9ucy5kaXJlY3RTb3VyY2VGaWxlKVxuICAgICAgeyB0aGlzLnNvdXJjZUZpbGUgPSBwYXJzZXIub3B0aW9ucy5kaXJlY3RTb3VyY2VGaWxlOyB9XG4gICAgaWYgKHBhcnNlci5vcHRpb25zLnJhbmdlcylcbiAgICAgIHsgdGhpcy5yYW5nZSA9IFtwb3MsIDBdOyB9XG4gIH07XG5cbiAgLy8gU3RhcnQgYW4gQVNUIG5vZGUsIGF0dGFjaGluZyBhIHN0YXJ0IG9mZnNldC5cblxuICB2YXIgcHAkMiA9IFBhcnNlci5wcm90b3R5cGU7XG5cbiAgcHAkMi5zdGFydE5vZGUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IE5vZGUodGhpcywgdGhpcy5zdGFydCwgdGhpcy5zdGFydExvYylcbiAgfTtcblxuICBwcCQyLnN0YXJ0Tm9kZUF0ID0gZnVuY3Rpb24ocG9zLCBsb2MpIHtcbiAgICByZXR1cm4gbmV3IE5vZGUodGhpcywgcG9zLCBsb2MpXG4gIH07XG5cbiAgLy8gRmluaXNoIGFuIEFTVCBub2RlLCBhZGRpbmcgYHR5cGVgIGFuZCBgZW5kYCBwcm9wZXJ0aWVzLlxuXG4gIGZ1bmN0aW9uIGZpbmlzaE5vZGVBdChub2RlLCB0eXBlLCBwb3MsIGxvYykge1xuICAgIG5vZGUudHlwZSA9IHR5cGU7XG4gICAgbm9kZS5lbmQgPSBwb3M7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5sb2NhdGlvbnMpXG4gICAgICB7IG5vZGUubG9jLmVuZCA9IGxvYzsgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMucmFuZ2VzKVxuICAgICAgeyBub2RlLnJhbmdlWzFdID0gcG9zOyB9XG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIHBwJDIuZmluaXNoTm9kZSA9IGZ1bmN0aW9uKG5vZGUsIHR5cGUpIHtcbiAgICByZXR1cm4gZmluaXNoTm9kZUF0LmNhbGwodGhpcywgbm9kZSwgdHlwZSwgdGhpcy5sYXN0VG9rRW5kLCB0aGlzLmxhc3RUb2tFbmRMb2MpXG4gIH07XG5cbiAgLy8gRmluaXNoIG5vZGUgYXQgZ2l2ZW4gcG9zaXRpb25cblxuICBwcCQyLmZpbmlzaE5vZGVBdCA9IGZ1bmN0aW9uKG5vZGUsIHR5cGUsIHBvcywgbG9jKSB7XG4gICAgcmV0dXJuIGZpbmlzaE5vZGVBdC5jYWxsKHRoaXMsIG5vZGUsIHR5cGUsIHBvcywgbG9jKVxuICB9O1xuXG4gIHBwJDIuY29weU5vZGUgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5ld05vZGUgPSBuZXcgTm9kZSh0aGlzLCBub2RlLnN0YXJ0LCB0aGlzLnN0YXJ0TG9jKTtcbiAgICBmb3IgKHZhciBwcm9wIGluIG5vZGUpIHsgbmV3Tm9kZVtwcm9wXSA9IG5vZGVbcHJvcF07IH1cbiAgICByZXR1cm4gbmV3Tm9kZVxuICB9O1xuXG4gIC8vIFRoaXMgZmlsZSBjb250YWlucyBVbmljb2RlIHByb3BlcnRpZXMgZXh0cmFjdGVkIGZyb20gdGhlIEVDTUFTY3JpcHQgc3BlY2lmaWNhdGlvbi5cbiAgLy8gVGhlIGxpc3RzIGFyZSBleHRyYWN0ZWQgbGlrZSBzbzpcbiAgLy8gJCQoJyN0YWJsZS1iaW5hcnktdW5pY29kZS1wcm9wZXJ0aWVzID4gZmlndXJlID4gdGFibGUgPiB0Ym9keSA+IHRyID4gdGQ6bnRoLWNoaWxkKDEpIGNvZGUnKS5tYXAoZWwgPT4gZWwuaW5uZXJUZXh0KVxuXG4gIC8vICN0YWJsZS1iaW5hcnktdW5pY29kZS1wcm9wZXJ0aWVzXG4gIHZhciBlY21hOUJpbmFyeVByb3BlcnRpZXMgPSBcIkFTQ0lJIEFTQ0lJX0hleF9EaWdpdCBBSGV4IEFscGhhYmV0aWMgQWxwaGEgQW55IEFzc2lnbmVkIEJpZGlfQ29udHJvbCBCaWRpX0MgQmlkaV9NaXJyb3JlZCBCaWRpX00gQ2FzZV9JZ25vcmFibGUgQ0kgQ2FzZWQgQ2hhbmdlc19XaGVuX0Nhc2Vmb2xkZWQgQ1dDRiBDaGFuZ2VzX1doZW5fQ2FzZW1hcHBlZCBDV0NNIENoYW5nZXNfV2hlbl9Mb3dlcmNhc2VkIENXTCBDaGFuZ2VzX1doZW5fTkZLQ19DYXNlZm9sZGVkIENXS0NGIENoYW5nZXNfV2hlbl9UaXRsZWNhc2VkIENXVCBDaGFuZ2VzX1doZW5fVXBwZXJjYXNlZCBDV1UgRGFzaCBEZWZhdWx0X0lnbm9yYWJsZV9Db2RlX1BvaW50IERJIERlcHJlY2F0ZWQgRGVwIERpYWNyaXRpYyBEaWEgRW1vamkgRW1vamlfQ29tcG9uZW50IEVtb2ppX01vZGlmaWVyIEVtb2ppX01vZGlmaWVyX0Jhc2UgRW1vamlfUHJlc2VudGF0aW9uIEV4dGVuZGVyIEV4dCBHcmFwaGVtZV9CYXNlIEdyX0Jhc2UgR3JhcGhlbWVfRXh0ZW5kIEdyX0V4dCBIZXhfRGlnaXQgSGV4IElEU19CaW5hcnlfT3BlcmF0b3IgSURTQiBJRFNfVHJpbmFyeV9PcGVyYXRvciBJRFNUIElEX0NvbnRpbnVlIElEQyBJRF9TdGFydCBJRFMgSWRlb2dyYXBoaWMgSWRlbyBKb2luX0NvbnRyb2wgSm9pbl9DIExvZ2ljYWxfT3JkZXJfRXhjZXB0aW9uIExPRSBMb3dlcmNhc2UgTG93ZXIgTWF0aCBOb25jaGFyYWN0ZXJfQ29kZV9Qb2ludCBOQ2hhciBQYXR0ZXJuX1N5bnRheCBQYXRfU3luIFBhdHRlcm5fV2hpdGVfU3BhY2UgUGF0X1dTIFF1b3RhdGlvbl9NYXJrIFFNYXJrIFJhZGljYWwgUmVnaW9uYWxfSW5kaWNhdG9yIFJJIFNlbnRlbmNlX1Rlcm1pbmFsIFNUZXJtIFNvZnRfRG90dGVkIFNEIFRlcm1pbmFsX1B1bmN0dWF0aW9uIFRlcm0gVW5pZmllZF9JZGVvZ3JhcGggVUlkZW8gVXBwZXJjYXNlIFVwcGVyIFZhcmlhdGlvbl9TZWxlY3RvciBWUyBXaGl0ZV9TcGFjZSBzcGFjZSBYSURfQ29udGludWUgWElEQyBYSURfU3RhcnQgWElEU1wiO1xuICB2YXIgZWNtYTEwQmluYXJ5UHJvcGVydGllcyA9IGVjbWE5QmluYXJ5UHJvcGVydGllcyArIFwiIEV4dGVuZGVkX1BpY3RvZ3JhcGhpY1wiO1xuICB2YXIgZWNtYTExQmluYXJ5UHJvcGVydGllcyA9IGVjbWExMEJpbmFyeVByb3BlcnRpZXM7XG4gIHZhciBlY21hMTJCaW5hcnlQcm9wZXJ0aWVzID0gZWNtYTExQmluYXJ5UHJvcGVydGllcyArIFwiIEVCYXNlIEVDb21wIEVNb2QgRVByZXMgRXh0UGljdFwiO1xuICB2YXIgZWNtYTEzQmluYXJ5UHJvcGVydGllcyA9IGVjbWExMkJpbmFyeVByb3BlcnRpZXM7XG4gIHZhciBlY21hMTRCaW5hcnlQcm9wZXJ0aWVzID0gZWNtYTEzQmluYXJ5UHJvcGVydGllcztcblxuICB2YXIgdW5pY29kZUJpbmFyeVByb3BlcnRpZXMgPSB7XG4gICAgOTogZWNtYTlCaW5hcnlQcm9wZXJ0aWVzLFxuICAgIDEwOiBlY21hMTBCaW5hcnlQcm9wZXJ0aWVzLFxuICAgIDExOiBlY21hMTFCaW5hcnlQcm9wZXJ0aWVzLFxuICAgIDEyOiBlY21hMTJCaW5hcnlQcm9wZXJ0aWVzLFxuICAgIDEzOiBlY21hMTNCaW5hcnlQcm9wZXJ0aWVzLFxuICAgIDE0OiBlY21hMTRCaW5hcnlQcm9wZXJ0aWVzXG4gIH07XG5cbiAgLy8gI3RhYmxlLWJpbmFyeS11bmljb2RlLXByb3BlcnRpZXMtb2Ytc3RyaW5nc1xuICB2YXIgZWNtYTE0QmluYXJ5UHJvcGVydGllc09mU3RyaW5ncyA9IFwiQmFzaWNfRW1vamkgRW1vamlfS2V5Y2FwX1NlcXVlbmNlIFJHSV9FbW9qaV9Nb2RpZmllcl9TZXF1ZW5jZSBSR0lfRW1vamlfRmxhZ19TZXF1ZW5jZSBSR0lfRW1vamlfVGFnX1NlcXVlbmNlIFJHSV9FbW9qaV9aV0pfU2VxdWVuY2UgUkdJX0Vtb2ppXCI7XG5cbiAgdmFyIHVuaWNvZGVCaW5hcnlQcm9wZXJ0aWVzT2ZTdHJpbmdzID0ge1xuICAgIDk6IFwiXCIsXG4gICAgMTA6IFwiXCIsXG4gICAgMTE6IFwiXCIsXG4gICAgMTI6IFwiXCIsXG4gICAgMTM6IFwiXCIsXG4gICAgMTQ6IGVjbWExNEJpbmFyeVByb3BlcnRpZXNPZlN0cmluZ3NcbiAgfTtcblxuICAvLyAjdGFibGUtdW5pY29kZS1nZW5lcmFsLWNhdGVnb3J5LXZhbHVlc1xuICB2YXIgdW5pY29kZUdlbmVyYWxDYXRlZ29yeVZhbHVlcyA9IFwiQ2FzZWRfTGV0dGVyIExDIENsb3NlX1B1bmN0dWF0aW9uIFBlIENvbm5lY3Rvcl9QdW5jdHVhdGlvbiBQYyBDb250cm9sIENjIGNudHJsIEN1cnJlbmN5X1N5bWJvbCBTYyBEYXNoX1B1bmN0dWF0aW9uIFBkIERlY2ltYWxfTnVtYmVyIE5kIGRpZ2l0IEVuY2xvc2luZ19NYXJrIE1lIEZpbmFsX1B1bmN0dWF0aW9uIFBmIEZvcm1hdCBDZiBJbml0aWFsX1B1bmN0dWF0aW9uIFBpIExldHRlciBMIExldHRlcl9OdW1iZXIgTmwgTGluZV9TZXBhcmF0b3IgWmwgTG93ZXJjYXNlX0xldHRlciBMbCBNYXJrIE0gQ29tYmluaW5nX01hcmsgTWF0aF9TeW1ib2wgU20gTW9kaWZpZXJfTGV0dGVyIExtIE1vZGlmaWVyX1N5bWJvbCBTayBOb25zcGFjaW5nX01hcmsgTW4gTnVtYmVyIE4gT3Blbl9QdW5jdHVhdGlvbiBQcyBPdGhlciBDIE90aGVyX0xldHRlciBMbyBPdGhlcl9OdW1iZXIgTm8gT3RoZXJfUHVuY3R1YXRpb24gUG8gT3RoZXJfU3ltYm9sIFNvIFBhcmFncmFwaF9TZXBhcmF0b3IgWnAgUHJpdmF0ZV9Vc2UgQ28gUHVuY3R1YXRpb24gUCBwdW5jdCBTZXBhcmF0b3IgWiBTcGFjZV9TZXBhcmF0b3IgWnMgU3BhY2luZ19NYXJrIE1jIFN1cnJvZ2F0ZSBDcyBTeW1ib2wgUyBUaXRsZWNhc2VfTGV0dGVyIEx0IFVuYXNzaWduZWQgQ24gVXBwZXJjYXNlX0xldHRlciBMdVwiO1xuXG4gIC8vICN0YWJsZS11bmljb2RlLXNjcmlwdC12YWx1ZXNcbiAgdmFyIGVjbWE5U2NyaXB0VmFsdWVzID0gXCJBZGxhbSBBZGxtIEFob20gQW5hdG9saWFuX0hpZXJvZ2x5cGhzIEhsdXcgQXJhYmljIEFyYWIgQXJtZW5pYW4gQXJtbiBBdmVzdGFuIEF2c3QgQmFsaW5lc2UgQmFsaSBCYW11bSBCYW11IEJhc3NhX1ZhaCBCYXNzIEJhdGFrIEJhdGsgQmVuZ2FsaSBCZW5nIEJoYWlrc3VraSBCaGtzIEJvcG9tb2ZvIEJvcG8gQnJhaG1pIEJyYWggQnJhaWxsZSBCcmFpIEJ1Z2luZXNlIEJ1Z2kgQnVoaWQgQnVoZCBDYW5hZGlhbl9BYm9yaWdpbmFsIENhbnMgQ2FyaWFuIENhcmkgQ2F1Y2FzaWFuX0FsYmFuaWFuIEFnaGIgQ2hha21hIENha20gQ2hhbSBDaGFtIENoZXJva2VlIENoZXIgQ29tbW9uIFp5eXkgQ29wdGljIENvcHQgUWFhYyBDdW5laWZvcm0gWHN1eCBDeXByaW90IENwcnQgQ3lyaWxsaWMgQ3lybCBEZXNlcmV0IERzcnQgRGV2YW5hZ2FyaSBEZXZhIER1cGxveWFuIER1cGwgRWd5cHRpYW5fSGllcm9nbHlwaHMgRWd5cCBFbGJhc2FuIEVsYmEgRXRoaW9waWMgRXRoaSBHZW9yZ2lhbiBHZW9yIEdsYWdvbGl0aWMgR2xhZyBHb3RoaWMgR290aCBHcmFudGhhIEdyYW4gR3JlZWsgR3JlayBHdWphcmF0aSBHdWpyIEd1cm11a2hpIEd1cnUgSGFuIEhhbmkgSGFuZ3VsIEhhbmcgSGFudW5vbyBIYW5vIEhhdHJhbiBIYXRyIEhlYnJldyBIZWJyIEhpcmFnYW5hIEhpcmEgSW1wZXJpYWxfQXJhbWFpYyBBcm1pIEluaGVyaXRlZCBaaW5oIFFhYWkgSW5zY3JpcHRpb25hbF9QYWhsYXZpIFBobGkgSW5zY3JpcHRpb25hbF9QYXJ0aGlhbiBQcnRpIEphdmFuZXNlIEphdmEgS2FpdGhpIEt0aGkgS2FubmFkYSBLbmRhIEthdGFrYW5hIEthbmEgS2F5YWhfTGkgS2FsaSBLaGFyb3NodGhpIEtoYXIgS2htZXIgS2htciBLaG9qa2kgS2hvaiBLaHVkYXdhZGkgU2luZCBMYW8gTGFvbyBMYXRpbiBMYXRuIExlcGNoYSBMZXBjIExpbWJ1IExpbWIgTGluZWFyX0EgTGluYSBMaW5lYXJfQiBMaW5iIExpc3UgTGlzdSBMeWNpYW4gTHljaSBMeWRpYW4gTHlkaSBNYWhhamFuaSBNYWhqIE1hbGF5YWxhbSBNbHltIE1hbmRhaWMgTWFuZCBNYW5pY2hhZWFuIE1hbmkgTWFyY2hlbiBNYXJjIE1hc2FyYW1fR29uZGkgR29ubSBNZWV0ZWlfTWF5ZWsgTXRlaSBNZW5kZV9LaWtha3VpIE1lbmQgTWVyb2l0aWNfQ3Vyc2l2ZSBNZXJjIE1lcm9pdGljX0hpZXJvZ2x5cGhzIE1lcm8gTWlhbyBQbHJkIE1vZGkgTW9uZ29saWFuIE1vbmcgTXJvIE1yb28gTXVsdGFuaSBNdWx0IE15YW5tYXIgTXltciBOYWJhdGFlYW4gTmJhdCBOZXdfVGFpX0x1ZSBUYWx1IE5ld2EgTmV3YSBOa28gTmtvbyBOdXNodSBOc2h1IE9naGFtIE9nYW0gT2xfQ2hpa2kgT2xjayBPbGRfSHVuZ2FyaWFuIEh1bmcgT2xkX0l0YWxpYyBJdGFsIE9sZF9Ob3J0aF9BcmFiaWFuIE5hcmIgT2xkX1Blcm1pYyBQZXJtIE9sZF9QZXJzaWFuIFhwZW8gT2xkX1NvdXRoX0FyYWJpYW4gU2FyYiBPbGRfVHVya2ljIE9ya2ggT3JpeWEgT3J5YSBPc2FnZSBPc2dlIE9zbWFueWEgT3NtYSBQYWhhd2hfSG1vbmcgSG1uZyBQYWxteXJlbmUgUGFsbSBQYXVfQ2luX0hhdSBQYXVjIFBoYWdzX1BhIFBoYWcgUGhvZW5pY2lhbiBQaG54IFBzYWx0ZXJfUGFobGF2aSBQaGxwIFJlamFuZyBSam5nIFJ1bmljIFJ1bnIgU2FtYXJpdGFuIFNhbXIgU2F1cmFzaHRyYSBTYXVyIFNoYXJhZGEgU2hyZCBTaGF2aWFuIFNoYXcgU2lkZGhhbSBTaWRkIFNpZ25Xcml0aW5nIFNnbncgU2luaGFsYSBTaW5oIFNvcmFfU29tcGVuZyBTb3JhIFNveW9tYm8gU295byBTdW5kYW5lc2UgU3VuZCBTeWxvdGlfTmFncmkgU3lsbyBTeXJpYWMgU3lyYyBUYWdhbG9nIFRnbGcgVGFnYmFud2EgVGFnYiBUYWlfTGUgVGFsZSBUYWlfVGhhbSBMYW5hIFRhaV9WaWV0IFRhdnQgVGFrcmkgVGFrciBUYW1pbCBUYW1sIFRhbmd1dCBUYW5nIFRlbHVndSBUZWx1IFRoYWFuYSBUaGFhIFRoYWkgVGhhaSBUaWJldGFuIFRpYnQgVGlmaW5hZ2ggVGZuZyBUaXJodXRhIFRpcmggVWdhcml0aWMgVWdhciBWYWkgVmFpaSBXYXJhbmdfQ2l0aSBXYXJhIFlpIFlpaWkgWmFuYWJhemFyX1NxdWFyZSBaYW5iXCI7XG4gIHZhciBlY21hMTBTY3JpcHRWYWx1ZXMgPSBlY21hOVNjcmlwdFZhbHVlcyArIFwiIERvZ3JhIERvZ3IgR3VuamFsYV9Hb25kaSBHb25nIEhhbmlmaV9Sb2hpbmd5YSBSb2hnIE1ha2FzYXIgTWFrYSBNZWRlZmFpZHJpbiBNZWRmIE9sZF9Tb2dkaWFuIFNvZ28gU29nZGlhbiBTb2dkXCI7XG4gIHZhciBlY21hMTFTY3JpcHRWYWx1ZXMgPSBlY21hMTBTY3JpcHRWYWx1ZXMgKyBcIiBFbHltYWljIEVseW0gTmFuZGluYWdhcmkgTmFuZCBOeWlha2VuZ19QdWFjaHVlX0htb25nIEhtbnAgV2FuY2hvIFdjaG9cIjtcbiAgdmFyIGVjbWExMlNjcmlwdFZhbHVlcyA9IGVjbWExMVNjcmlwdFZhbHVlcyArIFwiIENob3Jhc21pYW4gQ2hycyBEaWFrIERpdmVzX0FrdXJ1IEtoaXRhbl9TbWFsbF9TY3JpcHQgS2l0cyBZZXppIFllemlkaVwiO1xuICB2YXIgZWNtYTEzU2NyaXB0VmFsdWVzID0gZWNtYTEyU2NyaXB0VmFsdWVzICsgXCIgQ3lwcm9fTWlub2FuIENwbW4gT2xkX1V5Z2h1ciBPdWdyIFRhbmdzYSBUbnNhIFRvdG8gVml0aGt1cWkgVml0aFwiO1xuICB2YXIgZWNtYTE0U2NyaXB0VmFsdWVzID0gZWNtYTEzU2NyaXB0VmFsdWVzICsgXCIgSHJrdCBLYXRha2FuYV9Pcl9IaXJhZ2FuYSBLYXdpIE5hZ19NdW5kYXJpIE5hZ20gVW5rbm93biBaenp6XCI7XG5cbiAgdmFyIHVuaWNvZGVTY3JpcHRWYWx1ZXMgPSB7XG4gICAgOTogZWNtYTlTY3JpcHRWYWx1ZXMsXG4gICAgMTA6IGVjbWExMFNjcmlwdFZhbHVlcyxcbiAgICAxMTogZWNtYTExU2NyaXB0VmFsdWVzLFxuICAgIDEyOiBlY21hMTJTY3JpcHRWYWx1ZXMsXG4gICAgMTM6IGVjbWExM1NjcmlwdFZhbHVlcyxcbiAgICAxNDogZWNtYTE0U2NyaXB0VmFsdWVzXG4gIH07XG5cbiAgdmFyIGRhdGEgPSB7fTtcbiAgZnVuY3Rpb24gYnVpbGRVbmljb2RlRGF0YShlY21hVmVyc2lvbikge1xuICAgIHZhciBkID0gZGF0YVtlY21hVmVyc2lvbl0gPSB7XG4gICAgICBiaW5hcnk6IHdvcmRzUmVnZXhwKHVuaWNvZGVCaW5hcnlQcm9wZXJ0aWVzW2VjbWFWZXJzaW9uXSArIFwiIFwiICsgdW5pY29kZUdlbmVyYWxDYXRlZ29yeVZhbHVlcyksXG4gICAgICBiaW5hcnlPZlN0cmluZ3M6IHdvcmRzUmVnZXhwKHVuaWNvZGVCaW5hcnlQcm9wZXJ0aWVzT2ZTdHJpbmdzW2VjbWFWZXJzaW9uXSksXG4gICAgICBub25CaW5hcnk6IHtcbiAgICAgICAgR2VuZXJhbF9DYXRlZ29yeTogd29yZHNSZWdleHAodW5pY29kZUdlbmVyYWxDYXRlZ29yeVZhbHVlcyksXG4gICAgICAgIFNjcmlwdDogd29yZHNSZWdleHAodW5pY29kZVNjcmlwdFZhbHVlc1tlY21hVmVyc2lvbl0pXG4gICAgICB9XG4gICAgfTtcbiAgICBkLm5vbkJpbmFyeS5TY3JpcHRfRXh0ZW5zaW9ucyA9IGQubm9uQmluYXJ5LlNjcmlwdDtcblxuICAgIGQubm9uQmluYXJ5LmdjID0gZC5ub25CaW5hcnkuR2VuZXJhbF9DYXRlZ29yeTtcbiAgICBkLm5vbkJpbmFyeS5zYyA9IGQubm9uQmluYXJ5LlNjcmlwdDtcbiAgICBkLm5vbkJpbmFyeS5zY3ggPSBkLm5vbkJpbmFyeS5TY3JpcHRfRXh0ZW5zaW9ucztcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwLCBsaXN0ID0gWzksIDEwLCAxMSwgMTIsIDEzLCAxNF07IGkgPCBsaXN0Lmxlbmd0aDsgaSArPSAxKSB7XG4gICAgdmFyIGVjbWFWZXJzaW9uID0gbGlzdFtpXTtcblxuICAgIGJ1aWxkVW5pY29kZURhdGEoZWNtYVZlcnNpb24pO1xuICB9XG5cbiAgdmFyIHBwJDEgPSBQYXJzZXIucHJvdG90eXBlO1xuXG4gIHZhciBSZWdFeHBWYWxpZGF0aW9uU3RhdGUgPSBmdW5jdGlvbiBSZWdFeHBWYWxpZGF0aW9uU3RhdGUocGFyc2VyKSB7XG4gICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XG4gICAgdGhpcy52YWxpZEZsYWdzID0gXCJnaW1cIiArIChwYXJzZXIub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA2ID8gXCJ1eVwiIDogXCJcIikgKyAocGFyc2VyLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOSA/IFwic1wiIDogXCJcIikgKyAocGFyc2VyLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTMgPyBcImRcIiA6IFwiXCIpICsgKHBhcnNlci5vcHRpb25zLmVjbWFWZXJzaW9uID49IDE1ID8gXCJ2XCIgOiBcIlwiKTtcbiAgICB0aGlzLnVuaWNvZGVQcm9wZXJ0aWVzID0gZGF0YVtwYXJzZXIub3B0aW9ucy5lY21hVmVyc2lvbiA+PSAxNCA/IDE0IDogcGFyc2VyLm9wdGlvbnMuZWNtYVZlcnNpb25dO1xuICAgIHRoaXMuc291cmNlID0gXCJcIjtcbiAgICB0aGlzLmZsYWdzID0gXCJcIjtcbiAgICB0aGlzLnN0YXJ0ID0gMDtcbiAgICB0aGlzLnN3aXRjaFUgPSBmYWxzZTtcbiAgICB0aGlzLnN3aXRjaFYgPSBmYWxzZTtcbiAgICB0aGlzLnN3aXRjaE4gPSBmYWxzZTtcbiAgICB0aGlzLnBvcyA9IDA7XG4gICAgdGhpcy5sYXN0SW50VmFsdWUgPSAwO1xuICAgIHRoaXMubGFzdFN0cmluZ1ZhbHVlID0gXCJcIjtcbiAgICB0aGlzLmxhc3RBc3NlcnRpb25Jc1F1YW50aWZpYWJsZSA9IGZhbHNlO1xuICAgIHRoaXMubnVtQ2FwdHVyaW5nUGFyZW5zID0gMDtcbiAgICB0aGlzLm1heEJhY2tSZWZlcmVuY2UgPSAwO1xuICAgIHRoaXMuZ3JvdXBOYW1lcyA9IFtdO1xuICAgIHRoaXMuYmFja1JlZmVyZW5jZU5hbWVzID0gW107XG4gIH07XG5cbiAgUmVnRXhwVmFsaWRhdGlvblN0YXRlLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uIHJlc2V0IChzdGFydCwgcGF0dGVybiwgZmxhZ3MpIHtcbiAgICB2YXIgdW5pY29kZVNldHMgPSBmbGFncy5pbmRleE9mKFwidlwiKSAhPT0gLTE7XG4gICAgdmFyIHVuaWNvZGUgPSBmbGFncy5pbmRleE9mKFwidVwiKSAhPT0gLTE7XG4gICAgdGhpcy5zdGFydCA9IHN0YXJ0IHwgMDtcbiAgICB0aGlzLnNvdXJjZSA9IHBhdHRlcm4gKyBcIlwiO1xuICAgIHRoaXMuZmxhZ3MgPSBmbGFncztcbiAgICBpZiAodW5pY29kZVNldHMgJiYgdGhpcy5wYXJzZXIub3B0aW9ucy5lY21hVmVyc2lvbiA+PSAxNSkge1xuICAgICAgdGhpcy5zd2l0Y2hVID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3dpdGNoViA9IHRydWU7XG4gICAgICB0aGlzLnN3aXRjaE4gPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnN3aXRjaFUgPSB1bmljb2RlICYmIHRoaXMucGFyc2VyLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNjtcbiAgICAgIHRoaXMuc3dpdGNoViA9IGZhbHNlO1xuICAgICAgdGhpcy5zd2l0Y2hOID0gdW5pY29kZSAmJiB0aGlzLnBhcnNlci5vcHRpb25zLmVjbWFWZXJzaW9uID49IDk7XG4gICAgfVxuICB9O1xuXG4gIFJlZ0V4cFZhbGlkYXRpb25TdGF0ZS5wcm90b3R5cGUucmFpc2UgPSBmdW5jdGlvbiByYWlzZSAobWVzc2FnZSkge1xuICAgIHRoaXMucGFyc2VyLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5zdGFydCwgKFwiSW52YWxpZCByZWd1bGFyIGV4cHJlc3Npb246IC9cIiArICh0aGlzLnNvdXJjZSkgKyBcIi86IFwiICsgbWVzc2FnZSkpO1xuICB9O1xuXG4gIC8vIElmIHUgZmxhZyBpcyBnaXZlbiwgdGhpcyByZXR1cm5zIHRoZSBjb2RlIHBvaW50IGF0IHRoZSBpbmRleCAoaXQgY29tYmluZXMgYSBzdXJyb2dhdGUgcGFpcikuXG4gIC8vIE90aGVyd2lzZSwgdGhpcyByZXR1cm5zIHRoZSBjb2RlIHVuaXQgb2YgdGhlIGluZGV4IChjYW4gYmUgYSBwYXJ0IG9mIGEgc3Vycm9nYXRlIHBhaXIpLlxuICBSZWdFeHBWYWxpZGF0aW9uU3RhdGUucHJvdG90eXBlLmF0ID0gZnVuY3Rpb24gYXQgKGksIGZvcmNlVSkge1xuICAgICAgaWYgKCBmb3JjZVUgPT09IHZvaWQgMCApIGZvcmNlVSA9IGZhbHNlO1xuXG4gICAgdmFyIHMgPSB0aGlzLnNvdXJjZTtcbiAgICB2YXIgbCA9IHMubGVuZ3RoO1xuICAgIGlmIChpID49IGwpIHtcbiAgICAgIHJldHVybiAtMVxuICAgIH1cbiAgICB2YXIgYyA9IHMuY2hhckNvZGVBdChpKTtcbiAgICBpZiAoIShmb3JjZVUgfHwgdGhpcy5zd2l0Y2hVKSB8fCBjIDw9IDB4RDdGRiB8fCBjID49IDB4RTAwMCB8fCBpICsgMSA+PSBsKSB7XG4gICAgICByZXR1cm4gY1xuICAgIH1cbiAgICB2YXIgbmV4dCA9IHMuY2hhckNvZGVBdChpICsgMSk7XG4gICAgcmV0dXJuIG5leHQgPj0gMHhEQzAwICYmIG5leHQgPD0gMHhERkZGID8gKGMgPDwgMTApICsgbmV4dCAtIDB4MzVGREMwMCA6IGNcbiAgfTtcblxuICBSZWdFeHBWYWxpZGF0aW9uU3RhdGUucHJvdG90eXBlLm5leHRJbmRleCA9IGZ1bmN0aW9uIG5leHRJbmRleCAoaSwgZm9yY2VVKSB7XG4gICAgICBpZiAoIGZvcmNlVSA9PT0gdm9pZCAwICkgZm9yY2VVID0gZmFsc2U7XG5cbiAgICB2YXIgcyA9IHRoaXMuc291cmNlO1xuICAgIHZhciBsID0gcy5sZW5ndGg7XG4gICAgaWYgKGkgPj0gbCkge1xuICAgICAgcmV0dXJuIGxcbiAgICB9XG4gICAgdmFyIGMgPSBzLmNoYXJDb2RlQXQoaSksIG5leHQ7XG4gICAgaWYgKCEoZm9yY2VVIHx8IHRoaXMuc3dpdGNoVSkgfHwgYyA8PSAweEQ3RkYgfHwgYyA+PSAweEUwMDAgfHwgaSArIDEgPj0gbCB8fFxuICAgICAgICAobmV4dCA9IHMuY2hhckNvZGVBdChpICsgMSkpIDwgMHhEQzAwIHx8IG5leHQgPiAweERGRkYpIHtcbiAgICAgIHJldHVybiBpICsgMVxuICAgIH1cbiAgICByZXR1cm4gaSArIDJcbiAgfTtcblxuICBSZWdFeHBWYWxpZGF0aW9uU3RhdGUucHJvdG90eXBlLmN1cnJlbnQgPSBmdW5jdGlvbiBjdXJyZW50IChmb3JjZVUpIHtcbiAgICAgIGlmICggZm9yY2VVID09PSB2b2lkIDAgKSBmb3JjZVUgPSBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzLmF0KHRoaXMucG9zLCBmb3JjZVUpXG4gIH07XG5cbiAgUmVnRXhwVmFsaWRhdGlvblN0YXRlLnByb3RvdHlwZS5sb29rYWhlYWQgPSBmdW5jdGlvbiBsb29rYWhlYWQgKGZvcmNlVSkge1xuICAgICAgaWYgKCBmb3JjZVUgPT09IHZvaWQgMCApIGZvcmNlVSA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIHRoaXMuYXQodGhpcy5uZXh0SW5kZXgodGhpcy5wb3MsIGZvcmNlVSksIGZvcmNlVSlcbiAgfTtcblxuICBSZWdFeHBWYWxpZGF0aW9uU3RhdGUucHJvdG90eXBlLmFkdmFuY2UgPSBmdW5jdGlvbiBhZHZhbmNlIChmb3JjZVUpIHtcbiAgICAgIGlmICggZm9yY2VVID09PSB2b2lkIDAgKSBmb3JjZVUgPSBmYWxzZTtcblxuICAgIHRoaXMucG9zID0gdGhpcy5uZXh0SW5kZXgodGhpcy5wb3MsIGZvcmNlVSk7XG4gIH07XG5cbiAgUmVnRXhwVmFsaWRhdGlvblN0YXRlLnByb3RvdHlwZS5lYXQgPSBmdW5jdGlvbiBlYXQgKGNoLCBmb3JjZVUpIHtcbiAgICAgIGlmICggZm9yY2VVID09PSB2b2lkIDAgKSBmb3JjZVUgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLmN1cnJlbnQoZm9yY2VVKSA9PT0gY2gpIHtcbiAgICAgIHRoaXMuYWR2YW5jZShmb3JjZVUpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgUmVnRXhwVmFsaWRhdGlvblN0YXRlLnByb3RvdHlwZS5lYXRDaGFycyA9IGZ1bmN0aW9uIGVhdENoYXJzIChjaHMsIGZvcmNlVSkge1xuICAgICAgaWYgKCBmb3JjZVUgPT09IHZvaWQgMCApIGZvcmNlVSA9IGZhbHNlO1xuXG4gICAgdmFyIHBvcyA9IHRoaXMucG9zO1xuICAgIGZvciAodmFyIGkgPSAwLCBsaXN0ID0gY2hzOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgdmFyIGNoID0gbGlzdFtpXTtcblxuICAgICAgICB2YXIgY3VycmVudCA9IHRoaXMuYXQocG9zLCBmb3JjZVUpO1xuICAgICAgaWYgKGN1cnJlbnQgPT09IC0xIHx8IGN1cnJlbnQgIT09IGNoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgICAgcG9zID0gdGhpcy5uZXh0SW5kZXgocG9zLCBmb3JjZVUpO1xuICAgIH1cbiAgICB0aGlzLnBvcyA9IHBvcztcbiAgICByZXR1cm4gdHJ1ZVxuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSB0aGUgZmxhZ3MgcGFydCBvZiBhIGdpdmVuIFJlZ0V4cExpdGVyYWwuXG4gICAqXG4gICAqIEBwYXJhbSB7UmVnRXhwVmFsaWRhdGlvblN0YXRlfSBzdGF0ZSBUaGUgc3RhdGUgdG8gdmFsaWRhdGUgUmVnRXhwLlxuICAgKiBAcmV0dXJucyB7dm9pZH1cbiAgICovXG4gIHBwJDEudmFsaWRhdGVSZWdFeHBGbGFncyA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHZhbGlkRmxhZ3MgPSBzdGF0ZS52YWxpZEZsYWdzO1xuICAgIHZhciBmbGFncyA9IHN0YXRlLmZsYWdzO1xuXG4gICAgdmFyIHUgPSBmYWxzZTtcbiAgICB2YXIgdiA9IGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmbGFncy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGZsYWcgPSBmbGFncy5jaGFyQXQoaSk7XG4gICAgICBpZiAodmFsaWRGbGFncy5pbmRleE9mKGZsYWcpID09PSAtMSkge1xuICAgICAgICB0aGlzLnJhaXNlKHN0YXRlLnN0YXJ0LCBcIkludmFsaWQgcmVndWxhciBleHByZXNzaW9uIGZsYWdcIik7XG4gICAgICB9XG4gICAgICBpZiAoZmxhZ3MuaW5kZXhPZihmbGFnLCBpICsgMSkgPiAtMSkge1xuICAgICAgICB0aGlzLnJhaXNlKHN0YXRlLnN0YXJ0LCBcIkR1cGxpY2F0ZSByZWd1bGFyIGV4cHJlc3Npb24gZmxhZ1wiKTtcbiAgICAgIH1cbiAgICAgIGlmIChmbGFnID09PSBcInVcIikgeyB1ID0gdHJ1ZTsgfVxuICAgICAgaWYgKGZsYWcgPT09IFwidlwiKSB7IHYgPSB0cnVlOyB9XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTUgJiYgdSAmJiB2KSB7XG4gICAgICB0aGlzLnJhaXNlKHN0YXRlLnN0YXJ0LCBcIkludmFsaWQgcmVndWxhciBleHByZXNzaW9uIGZsYWdcIik7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSB0aGUgcGF0dGVybiBwYXJ0IG9mIGEgZ2l2ZW4gUmVnRXhwTGl0ZXJhbC5cbiAgICpcbiAgICogQHBhcmFtIHtSZWdFeHBWYWxpZGF0aW9uU3RhdGV9IHN0YXRlIFRoZSBzdGF0ZSB0byB2YWxpZGF0ZSBSZWdFeHAuXG4gICAqIEByZXR1cm5zIHt2b2lkfVxuICAgKi9cbiAgcHAkMS52YWxpZGF0ZVJlZ0V4cFBhdHRlcm4gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHRoaXMucmVnZXhwX3BhdHRlcm4oc3RhdGUpO1xuXG4gICAgLy8gVGhlIGdvYWwgc3ltYm9sIGZvciB0aGUgcGFyc2UgaXMgfFBhdHRlcm5bflUsIH5OXXwuIElmIHRoZSByZXN1bHQgb2ZcbiAgICAvLyBwYXJzaW5nIGNvbnRhaW5zIGEgfEdyb3VwTmFtZXwsIHJlcGFyc2Ugd2l0aCB0aGUgZ29hbCBzeW1ib2xcbiAgICAvLyB8UGF0dGVyblt+VSwgK05dfCBhbmQgdXNlIHRoaXMgcmVzdWx0IGluc3RlYWQuIFRocm93IGEgKlN5bnRheEVycm9yKlxuICAgIC8vIGV4Y2VwdGlvbiBpZiBfUF8gZGlkIG5vdCBjb25mb3JtIHRvIHRoZSBncmFtbWFyLCBpZiBhbnkgZWxlbWVudHMgb2YgX1BfXG4gICAgLy8gd2VyZSBub3QgbWF0Y2hlZCBieSB0aGUgcGFyc2UsIG9yIGlmIGFueSBFYXJseSBFcnJvciBjb25kaXRpb25zIGV4aXN0LlxuICAgIGlmICghc3RhdGUuc3dpdGNoTiAmJiB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOSAmJiBzdGF0ZS5ncm91cE5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlLnN3aXRjaE4gPSB0cnVlO1xuICAgICAgdGhpcy5yZWdleHBfcGF0dGVybihzdGF0ZSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLVBhdHRlcm5cbiAgcHAkMS5yZWdleHBfcGF0dGVybiA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgc3RhdGUucG9zID0gMDtcbiAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAwO1xuICAgIHN0YXRlLmxhc3RTdHJpbmdWYWx1ZSA9IFwiXCI7XG4gICAgc3RhdGUubGFzdEFzc2VydGlvbklzUXVhbnRpZmlhYmxlID0gZmFsc2U7XG4gICAgc3RhdGUubnVtQ2FwdHVyaW5nUGFyZW5zID0gMDtcbiAgICBzdGF0ZS5tYXhCYWNrUmVmZXJlbmNlID0gMDtcbiAgICBzdGF0ZS5ncm91cE5hbWVzLmxlbmd0aCA9IDA7XG4gICAgc3RhdGUuYmFja1JlZmVyZW5jZU5hbWVzLmxlbmd0aCA9IDA7XG5cbiAgICB0aGlzLnJlZ2V4cF9kaXNqdW5jdGlvbihzdGF0ZSk7XG5cbiAgICBpZiAoc3RhdGUucG9zICE9PSBzdGF0ZS5zb3VyY2UubGVuZ3RoKSB7XG4gICAgICAvLyBNYWtlIHRoZSBzYW1lIG1lc3NhZ2VzIGFzIFY4LlxuICAgICAgaWYgKHN0YXRlLmVhdCgweDI5IC8qICkgKi8pKSB7XG4gICAgICAgIHN0YXRlLnJhaXNlKFwiVW5tYXRjaGVkICcpJ1wiKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdGF0ZS5lYXQoMHg1RCAvKiBdICovKSB8fCBzdGF0ZS5lYXQoMHg3RCAvKiB9ICovKSkge1xuICAgICAgICBzdGF0ZS5yYWlzZShcIkxvbmUgcXVhbnRpZmllciBicmFja2V0c1wiKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHN0YXRlLm1heEJhY2tSZWZlcmVuY2UgPiBzdGF0ZS5udW1DYXB0dXJpbmdQYXJlbnMpIHtcbiAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBlc2NhcGVcIik7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwLCBsaXN0ID0gc3RhdGUuYmFja1JlZmVyZW5jZU5hbWVzOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgdmFyIG5hbWUgPSBsaXN0W2ldO1xuXG4gICAgICBpZiAoc3RhdGUuZ3JvdXBOYW1lcy5pbmRleE9mKG5hbWUpID09PSAtMSkge1xuICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgbmFtZWQgY2FwdHVyZSByZWZlcmVuY2VkXCIpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1EaXNqdW5jdGlvblxuICBwcCQxLnJlZ2V4cF9kaXNqdW5jdGlvbiA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdGhpcy5yZWdleHBfYWx0ZXJuYXRpdmUoc3RhdGUpO1xuICAgIHdoaWxlIChzdGF0ZS5lYXQoMHg3QyAvKiB8ICovKSkge1xuICAgICAgdGhpcy5yZWdleHBfYWx0ZXJuYXRpdmUoc3RhdGUpO1xuICAgIH1cblxuICAgIC8vIE1ha2UgdGhlIHNhbWUgbWVzc2FnZSBhcyBWOC5cbiAgICBpZiAodGhpcy5yZWdleHBfZWF0UXVhbnRpZmllcihzdGF0ZSwgdHJ1ZSkpIHtcbiAgICAgIHN0YXRlLnJhaXNlKFwiTm90aGluZyB0byByZXBlYXRcIik7XG4gICAgfVxuICAgIGlmIChzdGF0ZS5lYXQoMHg3QiAvKiB7ICovKSkge1xuICAgICAgc3RhdGUucmFpc2UoXCJMb25lIHF1YW50aWZpZXIgYnJhY2tldHNcIik7XG4gICAgfVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUFsdGVybmF0aXZlXG4gIHBwJDEucmVnZXhwX2FsdGVybmF0aXZlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB3aGlsZSAoc3RhdGUucG9zIDwgc3RhdGUuc291cmNlLmxlbmd0aCAmJiB0aGlzLnJlZ2V4cF9lYXRUZXJtKHN0YXRlKSlcbiAgICAgIHsgfVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLWFubmV4Qi1UZXJtXG4gIHBwJDEucmVnZXhwX2VhdFRlcm0gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRBc3NlcnRpb24oc3RhdGUpKSB7XG4gICAgICAvLyBIYW5kbGUgYFF1YW50aWZpYWJsZUFzc2VydGlvbiBRdWFudGlmaWVyYCBhbHRlcm5hdGl2ZS5cbiAgICAgIC8vIGBzdGF0ZS5sYXN0QXNzZXJ0aW9uSXNRdWFudGlmaWFibGVgIGlzIHRydWUgaWYgdGhlIGxhc3QgZWF0ZW4gQXNzZXJ0aW9uXG4gICAgICAvLyBpcyBhIFF1YW50aWZpYWJsZUFzc2VydGlvbi5cbiAgICAgIGlmIChzdGF0ZS5sYXN0QXNzZXJ0aW9uSXNRdWFudGlmaWFibGUgJiYgdGhpcy5yZWdleHBfZWF0UXVhbnRpZmllcihzdGF0ZSkpIHtcbiAgICAgICAgLy8gTWFrZSB0aGUgc2FtZSBtZXNzYWdlIGFzIFY4LlxuICAgICAgICBpZiAoc3RhdGUuc3dpdGNoVSkge1xuICAgICAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBxdWFudGlmaWVyXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIGlmIChzdGF0ZS5zd2l0Y2hVID8gdGhpcy5yZWdleHBfZWF0QXRvbShzdGF0ZSkgOiB0aGlzLnJlZ2V4cF9lYXRFeHRlbmRlZEF0b20oc3RhdGUpKSB7XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRRdWFudGlmaWVyKHN0YXRlKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUFzc2VydGlvblxuICBwcCQxLnJlZ2V4cF9lYXRBc3NlcnRpb24gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICBzdGF0ZS5sYXN0QXNzZXJ0aW9uSXNRdWFudGlmaWFibGUgPSBmYWxzZTtcblxuICAgIC8vIF4sICRcbiAgICBpZiAoc3RhdGUuZWF0KDB4NUUgLyogXiAqLykgfHwgc3RhdGUuZWF0KDB4MjQgLyogJCAqLykpIHtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgLy8gXFxiIFxcQlxuICAgIGlmIChzdGF0ZS5lYXQoMHg1QyAvKiBcXCAqLykpIHtcbiAgICAgIGlmIChzdGF0ZS5lYXQoMHg0MiAvKiBCICovKSB8fCBzdGF0ZS5lYXQoMHg2MiAvKiBiICovKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuXG4gICAgLy8gTG9va2FoZWFkIC8gTG9va2JlaGluZFxuICAgIGlmIChzdGF0ZS5lYXQoMHgyOCAvKiAoICovKSAmJiBzdGF0ZS5lYXQoMHgzRiAvKiA/ICovKSkge1xuICAgICAgdmFyIGxvb2tiZWhpbmQgPSBmYWxzZTtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOSkge1xuICAgICAgICBsb29rYmVoaW5kID0gc3RhdGUuZWF0KDB4M0MgLyogPCAqLyk7XG4gICAgICB9XG4gICAgICBpZiAoc3RhdGUuZWF0KDB4M0QgLyogPSAqLykgfHwgc3RhdGUuZWF0KDB4MjEgLyogISAqLykpIHtcbiAgICAgICAgdGhpcy5yZWdleHBfZGlzanVuY3Rpb24oc3RhdGUpO1xuICAgICAgICBpZiAoIXN0YXRlLmVhdCgweDI5IC8qICkgKi8pKSB7XG4gICAgICAgICAgc3RhdGUucmFpc2UoXCJVbnRlcm1pbmF0ZWQgZ3JvdXBcIik7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUubGFzdEFzc2VydGlvbklzUXVhbnRpZmlhYmxlID0gIWxvb2tiZWhpbmQ7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtUXVhbnRpZmllclxuICBwcCQxLnJlZ2V4cF9lYXRRdWFudGlmaWVyID0gZnVuY3Rpb24oc3RhdGUsIG5vRXJyb3IpIHtcbiAgICBpZiAoIG5vRXJyb3IgPT09IHZvaWQgMCApIG5vRXJyb3IgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRRdWFudGlmaWVyUHJlZml4KHN0YXRlLCBub0Vycm9yKSkge1xuICAgICAgc3RhdGUuZWF0KDB4M0YgLyogPyAqLyk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1RdWFudGlmaWVyUHJlZml4XG4gIHBwJDEucmVnZXhwX2VhdFF1YW50aWZpZXJQcmVmaXggPSBmdW5jdGlvbihzdGF0ZSwgbm9FcnJvcikge1xuICAgIHJldHVybiAoXG4gICAgICBzdGF0ZS5lYXQoMHgyQSAvKiAqICovKSB8fFxuICAgICAgc3RhdGUuZWF0KDB4MkIgLyogKyAqLykgfHxcbiAgICAgIHN0YXRlLmVhdCgweDNGIC8qID8gKi8pIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRCcmFjZWRRdWFudGlmaWVyKHN0YXRlLCBub0Vycm9yKVxuICAgIClcbiAgfTtcbiAgcHAkMS5yZWdleHBfZWF0QnJhY2VkUXVhbnRpZmllciA9IGZ1bmN0aW9uKHN0YXRlLCBub0Vycm9yKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIGlmIChzdGF0ZS5lYXQoMHg3QiAvKiB7ICovKSkge1xuICAgICAgdmFyIG1pbiA9IDAsIG1heCA9IC0xO1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdERlY2ltYWxEaWdpdHMoc3RhdGUpKSB7XG4gICAgICAgIG1pbiA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICAgICAgaWYgKHN0YXRlLmVhdCgweDJDIC8qICwgKi8pICYmIHRoaXMucmVnZXhwX2VhdERlY2ltYWxEaWdpdHMoc3RhdGUpKSB7XG4gICAgICAgICAgbWF4ID0gc3RhdGUubGFzdEludFZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5lYXQoMHg3RCAvKiB9ICovKSkge1xuICAgICAgICAgIC8vIFN5bnRheEVycm9yIGluIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNzZWMtdGVybVxuICAgICAgICAgIGlmIChtYXggIT09IC0xICYmIG1heCA8IG1pbiAmJiAhbm9FcnJvcikge1xuICAgICAgICAgICAgc3RhdGUucmFpc2UoXCJudW1iZXJzIG91dCBvZiBvcmRlciBpbiB7fSBxdWFudGlmaWVyXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc3RhdGUuc3dpdGNoVSAmJiAhbm9FcnJvcikge1xuICAgICAgICBzdGF0ZS5yYWlzZShcIkluY29tcGxldGUgcXVhbnRpZmllclwiKTtcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1BdG9tXG4gIHBwJDEucmVnZXhwX2VhdEF0b20gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLnJlZ2V4cF9lYXRQYXR0ZXJuQ2hhcmFjdGVycyhzdGF0ZSkgfHxcbiAgICAgIHN0YXRlLmVhdCgweDJFIC8qIC4gKi8pIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRSZXZlcnNlU29saWR1c0F0b21Fc2NhcGUoc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRDaGFyYWN0ZXJDbGFzcyhzdGF0ZSkgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdFVuY2FwdHVyaW5nR3JvdXAoc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRDYXB0dXJpbmdHcm91cChzdGF0ZSlcbiAgICApXG4gIH07XG4gIHBwJDEucmVnZXhwX2VhdFJldmVyc2VTb2xpZHVzQXRvbUVzY2FwZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIGlmIChzdGF0ZS5lYXQoMHg1QyAvKiBcXCAqLykpIHtcbiAgICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRBdG9tRXNjYXBlKHN0YXRlKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuICBwcCQxLnJlZ2V4cF9lYXRVbmNhcHR1cmluZ0dyb3VwID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgaWYgKHN0YXRlLmVhdCgweDI4IC8qICggKi8pKSB7XG4gICAgICBpZiAoc3RhdGUuZWF0KDB4M0YgLyogPyAqLykgJiYgc3RhdGUuZWF0KDB4M0EgLyogOiAqLykpIHtcbiAgICAgICAgdGhpcy5yZWdleHBfZGlzanVuY3Rpb24oc3RhdGUpO1xuICAgICAgICBpZiAoc3RhdGUuZWF0KDB4MjkgLyogKSAqLykpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgICAgIHN0YXRlLnJhaXNlKFwiVW50ZXJtaW5hdGVkIGdyb3VwXCIpO1xuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuICBwcCQxLnJlZ2V4cF9lYXRDYXB0dXJpbmdHcm91cCA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLmVhdCgweDI4IC8qICggKi8pKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDkpIHtcbiAgICAgICAgdGhpcy5yZWdleHBfZ3JvdXBTcGVjaWZpZXIoc3RhdGUpO1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZS5jdXJyZW50KCkgPT09IDB4M0YgLyogPyAqLykge1xuICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgZ3JvdXBcIik7XG4gICAgICB9XG4gICAgICB0aGlzLnJlZ2V4cF9kaXNqdW5jdGlvbihzdGF0ZSk7XG4gICAgICBpZiAoc3RhdGUuZWF0KDB4MjkgLyogKSAqLykpIHtcbiAgICAgICAgc3RhdGUubnVtQ2FwdHVyaW5nUGFyZW5zICs9IDE7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBzdGF0ZS5yYWlzZShcIlVudGVybWluYXRlZCBncm91cFwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUV4dGVuZGVkQXRvbVxuICBwcCQxLnJlZ2V4cF9lYXRFeHRlbmRlZEF0b20gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHJldHVybiAoXG4gICAgICBzdGF0ZS5lYXQoMHgyRSAvKiAuICovKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0UmV2ZXJzZVNvbGlkdXNBdG9tRXNjYXBlKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0Q2hhcmFjdGVyQ2xhc3Moc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRVbmNhcHR1cmluZ0dyb3VwKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0Q2FwdHVyaW5nR3JvdXAoc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRJbnZhbGlkQnJhY2VkUXVhbnRpZmllcihzdGF0ZSkgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdEV4dGVuZGVkUGF0dGVybkNoYXJhY3RlcihzdGF0ZSlcbiAgICApXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUludmFsaWRCcmFjZWRRdWFudGlmaWVyXG4gIHBwJDEucmVnZXhwX2VhdEludmFsaWRCcmFjZWRRdWFudGlmaWVyID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAodGhpcy5yZWdleHBfZWF0QnJhY2VkUXVhbnRpZmllcihzdGF0ZSwgdHJ1ZSkpIHtcbiAgICAgIHN0YXRlLnJhaXNlKFwiTm90aGluZyB0byByZXBlYXRcIik7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLVN5bnRheENoYXJhY3RlclxuICBwcCQxLnJlZ2V4cF9lYXRTeW50YXhDaGFyYWN0ZXIgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICBpZiAoaXNTeW50YXhDaGFyYWN0ZXIoY2gpKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBjaDtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuICBmdW5jdGlvbiBpc1N5bnRheENoYXJhY3RlcihjaCkge1xuICAgIHJldHVybiAoXG4gICAgICBjaCA9PT0gMHgyNCAvKiAkICovIHx8XG4gICAgICBjaCA+PSAweDI4IC8qICggKi8gJiYgY2ggPD0gMHgyQiAvKiArICovIHx8XG4gICAgICBjaCA9PT0gMHgyRSAvKiAuICovIHx8XG4gICAgICBjaCA9PT0gMHgzRiAvKiA/ICovIHx8XG4gICAgICBjaCA+PSAweDVCIC8qIFsgKi8gJiYgY2ggPD0gMHg1RSAvKiBeICovIHx8XG4gICAgICBjaCA+PSAweDdCIC8qIHsgKi8gJiYgY2ggPD0gMHg3RCAvKiB9ICovXG4gICAgKVxuICB9XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtUGF0dGVybkNoYXJhY3RlclxuICAvLyBCdXQgZWF0IGVhZ2VyLlxuICBwcCQxLnJlZ2V4cF9lYXRQYXR0ZXJuQ2hhcmFjdGVycyA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIHZhciBjaCA9IDA7XG4gICAgd2hpbGUgKChjaCA9IHN0YXRlLmN1cnJlbnQoKSkgIT09IC0xICYmICFpc1N5bnRheENoYXJhY3RlcihjaCkpIHtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRlLnBvcyAhPT0gc3RhcnRcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1hbm5leEItRXh0ZW5kZWRQYXR0ZXJuQ2hhcmFjdGVyXG4gIHBwJDEucmVnZXhwX2VhdEV4dGVuZGVkUGF0dGVybkNoYXJhY3RlciA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIGNoID0gc3RhdGUuY3VycmVudCgpO1xuICAgIGlmIChcbiAgICAgIGNoICE9PSAtMSAmJlxuICAgICAgY2ggIT09IDB4MjQgLyogJCAqLyAmJlxuICAgICAgIShjaCA+PSAweDI4IC8qICggKi8gJiYgY2ggPD0gMHgyQiAvKiArICovKSAmJlxuICAgICAgY2ggIT09IDB4MkUgLyogLiAqLyAmJlxuICAgICAgY2ggIT09IDB4M0YgLyogPyAqLyAmJlxuICAgICAgY2ggIT09IDB4NUIgLyogWyAqLyAmJlxuICAgICAgY2ggIT09IDB4NUUgLyogXiAqLyAmJlxuICAgICAgY2ggIT09IDB4N0MgLyogfCAqL1xuICAgICkge1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gR3JvdXBTcGVjaWZpZXIgOjpcbiAgLy8gICBbZW1wdHldXG4gIC8vICAgYD9gIEdyb3VwTmFtZVxuICBwcCQxLnJlZ2V4cF9ncm91cFNwZWNpZmllciA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLmVhdCgweDNGIC8qID8gKi8pKSB7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0R3JvdXBOYW1lKHN0YXRlKSkge1xuICAgICAgICBpZiAoc3RhdGUuZ3JvdXBOYW1lcy5pbmRleE9mKHN0YXRlLmxhc3RTdHJpbmdWYWx1ZSkgIT09IC0xKSB7XG4gICAgICAgICAgc3RhdGUucmFpc2UoXCJEdXBsaWNhdGUgY2FwdHVyZSBncm91cCBuYW1lXCIpO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmdyb3VwTmFtZXMucHVzaChzdGF0ZS5sYXN0U3RyaW5nVmFsdWUpO1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBncm91cFwiKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gR3JvdXBOYW1lIDo6XG4gIC8vICAgYDxgIFJlZ0V4cElkZW50aWZpZXJOYW1lIGA+YFxuICAvLyBOb3RlOiB0aGlzIHVwZGF0ZXMgYHN0YXRlLmxhc3RTdHJpbmdWYWx1ZWAgcHJvcGVydHkgd2l0aCB0aGUgZWF0ZW4gbmFtZS5cbiAgcHAkMS5yZWdleHBfZWF0R3JvdXBOYW1lID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgPSBcIlwiO1xuICAgIGlmIChzdGF0ZS5lYXQoMHgzQyAvKiA8ICovKSkge1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdFJlZ0V4cElkZW50aWZpZXJOYW1lKHN0YXRlKSAmJiBzdGF0ZS5lYXQoMHgzRSAvKiA+ICovKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIGNhcHR1cmUgZ3JvdXAgbmFtZVwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gUmVnRXhwSWRlbnRpZmllck5hbWUgOjpcbiAgLy8gICBSZWdFeHBJZGVudGlmaWVyU3RhcnRcbiAgLy8gICBSZWdFeHBJZGVudGlmaWVyTmFtZSBSZWdFeHBJZGVudGlmaWVyUGFydFxuICAvLyBOb3RlOiB0aGlzIHVwZGF0ZXMgYHN0YXRlLmxhc3RTdHJpbmdWYWx1ZWAgcHJvcGVydHkgd2l0aCB0aGUgZWF0ZW4gbmFtZS5cbiAgcHAkMS5yZWdleHBfZWF0UmVnRXhwSWRlbnRpZmllck5hbWUgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHN0YXRlLmxhc3RTdHJpbmdWYWx1ZSA9IFwiXCI7XG4gICAgaWYgKHRoaXMucmVnZXhwX2VhdFJlZ0V4cElkZW50aWZpZXJTdGFydChzdGF0ZSkpIHtcbiAgICAgIHN0YXRlLmxhc3RTdHJpbmdWYWx1ZSArPSBjb2RlUG9pbnRUb1N0cmluZyhzdGF0ZS5sYXN0SW50VmFsdWUpO1xuICAgICAgd2hpbGUgKHRoaXMucmVnZXhwX2VhdFJlZ0V4cElkZW50aWZpZXJQYXJ0KHN0YXRlKSkge1xuICAgICAgICBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgKz0gY29kZVBvaW50VG9TdHJpbmcoc3RhdGUubGFzdEludFZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIFJlZ0V4cElkZW50aWZpZXJTdGFydCA6OlxuICAvLyAgIFVuaWNvZGVJRFN0YXJ0XG4gIC8vICAgYCRgXG4gIC8vICAgYF9gXG4gIC8vICAgYFxcYCBSZWdFeHBVbmljb2RlRXNjYXBlU2VxdWVuY2VbK1VdXG4gIHBwJDEucmVnZXhwX2VhdFJlZ0V4cElkZW50aWZpZXJTdGFydCA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIHZhciBmb3JjZVUgPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTE7XG4gICAgdmFyIGNoID0gc3RhdGUuY3VycmVudChmb3JjZVUpO1xuICAgIHN0YXRlLmFkdmFuY2UoZm9yY2VVKTtcblxuICAgIGlmIChjaCA9PT0gMHg1QyAvKiBcXCAqLyAmJiB0aGlzLnJlZ2V4cF9lYXRSZWdFeHBVbmljb2RlRXNjYXBlU2VxdWVuY2Uoc3RhdGUsIGZvcmNlVSkpIHtcbiAgICAgIGNoID0gc3RhdGUubGFzdEludFZhbHVlO1xuICAgIH1cbiAgICBpZiAoaXNSZWdFeHBJZGVudGlmaWVyU3RhcnQoY2gpKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBjaDtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG4gIGZ1bmN0aW9uIGlzUmVnRXhwSWRlbnRpZmllclN0YXJ0KGNoKSB7XG4gICAgcmV0dXJuIGlzSWRlbnRpZmllclN0YXJ0KGNoLCB0cnVlKSB8fCBjaCA9PT0gMHgyNCAvKiAkICovIHx8IGNoID09PSAweDVGIC8qIF8gKi9cbiAgfVxuXG4gIC8vIFJlZ0V4cElkZW50aWZpZXJQYXJ0IDo6XG4gIC8vICAgVW5pY29kZUlEQ29udGludWVcbiAgLy8gICBgJGBcbiAgLy8gICBgX2BcbiAgLy8gICBgXFxgIFJlZ0V4cFVuaWNvZGVFc2NhcGVTZXF1ZW5jZVsrVV1cbiAgLy8gICA8WldOSj5cbiAgLy8gICA8WldKPlxuICBwcCQxLnJlZ2V4cF9lYXRSZWdFeHBJZGVudGlmaWVyUGFydCA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIHZhciBmb3JjZVUgPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTE7XG4gICAgdmFyIGNoID0gc3RhdGUuY3VycmVudChmb3JjZVUpO1xuICAgIHN0YXRlLmFkdmFuY2UoZm9yY2VVKTtcblxuICAgIGlmIChjaCA9PT0gMHg1QyAvKiBcXCAqLyAmJiB0aGlzLnJlZ2V4cF9lYXRSZWdFeHBVbmljb2RlRXNjYXBlU2VxdWVuY2Uoc3RhdGUsIGZvcmNlVSkpIHtcbiAgICAgIGNoID0gc3RhdGUubGFzdEludFZhbHVlO1xuICAgIH1cbiAgICBpZiAoaXNSZWdFeHBJZGVudGlmaWVyUGFydChjaCkpIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IGNoO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICBzdGF0ZS5wb3MgPSBzdGFydDtcbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcbiAgZnVuY3Rpb24gaXNSZWdFeHBJZGVudGlmaWVyUGFydChjaCkge1xuICAgIHJldHVybiBpc0lkZW50aWZpZXJDaGFyKGNoLCB0cnVlKSB8fCBjaCA9PT0gMHgyNCAvKiAkICovIHx8IGNoID09PSAweDVGIC8qIF8gKi8gfHwgY2ggPT09IDB4MjAwQyAvKiA8WldOSj4gKi8gfHwgY2ggPT09IDB4MjAwRCAvKiA8WldKPiAqL1xuICB9XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUF0b21Fc2NhcGVcbiAgcHAkMS5yZWdleHBfZWF0QXRvbUVzY2FwZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKFxuICAgICAgdGhpcy5yZWdleHBfZWF0QmFja1JlZmVyZW5jZShzdGF0ZSkgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdENoYXJhY3RlckNsYXNzRXNjYXBlKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0Q2hhcmFjdGVyRXNjYXBlKHN0YXRlKSB8fFxuICAgICAgKHN0YXRlLnN3aXRjaE4gJiYgdGhpcy5yZWdleHBfZWF0S0dyb3VwTmFtZShzdGF0ZSkpXG4gICAgKSB7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICBpZiAoc3RhdGUuc3dpdGNoVSkge1xuICAgICAgLy8gTWFrZSB0aGUgc2FtZSBtZXNzYWdlIGFzIFY4LlxuICAgICAgaWYgKHN0YXRlLmN1cnJlbnQoKSA9PT0gMHg2MyAvKiBjICovKSB7XG4gICAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCB1bmljb2RlIGVzY2FwZVwiKTtcbiAgICAgIH1cbiAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBlc2NhcGVcIik7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuICBwcCQxLnJlZ2V4cF9lYXRCYWNrUmVmZXJlbmNlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgaWYgKHRoaXMucmVnZXhwX2VhdERlY2ltYWxFc2NhcGUoc3RhdGUpKSB7XG4gICAgICB2YXIgbiA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICAgIGlmIChzdGF0ZS5zd2l0Y2hVKSB7XG4gICAgICAgIC8vIEZvciBTeW50YXhFcnJvciBpbiBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jc2VjLWF0b21lc2NhcGVcbiAgICAgICAgaWYgKG4gPiBzdGF0ZS5tYXhCYWNrUmVmZXJlbmNlKSB7XG4gICAgICAgICAgc3RhdGUubWF4QmFja1JlZmVyZW5jZSA9IG47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIGlmIChuIDw9IHN0YXRlLm51bUNhcHR1cmluZ1BhcmVucykge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuICBwcCQxLnJlZ2V4cF9lYXRLR3JvdXBOYW1lID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoc3RhdGUuZWF0KDB4NkIgLyogayAqLykpIHtcbiAgICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRHcm91cE5hbWUoc3RhdGUpKSB7XG4gICAgICAgIHN0YXRlLmJhY2tSZWZlcmVuY2VOYW1lcy5wdXNoKHN0YXRlLmxhc3RTdHJpbmdWYWx1ZSk7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgbmFtZWQgcmVmZXJlbmNlXCIpO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1hbm5leEItQ2hhcmFjdGVyRXNjYXBlXG4gIHBwJDEucmVnZXhwX2VhdENoYXJhY3RlckVzY2FwZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMucmVnZXhwX2VhdENvbnRyb2xFc2NhcGUoc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRDQ29udHJvbExldHRlcihzdGF0ZSkgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdFplcm8oc3RhdGUpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRIZXhFc2NhcGVTZXF1ZW5jZShzdGF0ZSkgfHxcbiAgICAgIHRoaXMucmVnZXhwX2VhdFJlZ0V4cFVuaWNvZGVFc2NhcGVTZXF1ZW5jZShzdGF0ZSwgZmFsc2UpIHx8XG4gICAgICAoIXN0YXRlLnN3aXRjaFUgJiYgdGhpcy5yZWdleHBfZWF0TGVnYWN5T2N0YWxFc2NhcGVTZXF1ZW5jZShzdGF0ZSkpIHx8XG4gICAgICB0aGlzLnJlZ2V4cF9lYXRJZGVudGl0eUVzY2FwZShzdGF0ZSlcbiAgICApXG4gIH07XG4gIHBwJDEucmVnZXhwX2VhdENDb250cm9sTGV0dGVyID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgaWYgKHN0YXRlLmVhdCgweDYzIC8qIGMgKi8pKSB7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0Q29udHJvbExldHRlcihzdGF0ZSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcbiAgcHAkMS5yZWdleHBfZWF0WmVybyA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLmN1cnJlbnQoKSA9PT0gMHgzMCAvKiAwICovICYmICFpc0RlY2ltYWxEaWdpdChzdGF0ZS5sb29rYWhlYWQoKSkpIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDA7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1Db250cm9sRXNjYXBlXG4gIHBwJDEucmVnZXhwX2VhdENvbnRyb2xFc2NhcGUgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICBpZiAoY2ggPT09IDB4NzQgLyogdCAqLykge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMHgwOTsgLyogXFx0ICovXG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICBpZiAoY2ggPT09IDB4NkUgLyogbiAqLykge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMHgwQTsgLyogXFxuICovXG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICBpZiAoY2ggPT09IDB4NzYgLyogdiAqLykge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMHgwQjsgLyogXFx2ICovXG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICBpZiAoY2ggPT09IDB4NjYgLyogZiAqLykge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMHgwQzsgLyogXFxmICovXG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICBpZiAoY2ggPT09IDB4NzIgLyogciAqLykge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMHgwRDsgLyogXFxyICovXG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1Db250cm9sTGV0dGVyXG4gIHBwJDEucmVnZXhwX2VhdENvbnRyb2xMZXR0ZXIgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICBpZiAoaXNDb250cm9sTGV0dGVyKGNoKSkge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gY2ggJSAweDIwO1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG4gIGZ1bmN0aW9uIGlzQ29udHJvbExldHRlcihjaCkge1xuICAgIHJldHVybiAoXG4gICAgICAoY2ggPj0gMHg0MSAvKiBBICovICYmIGNoIDw9IDB4NUEgLyogWiAqLykgfHxcbiAgICAgIChjaCA+PSAweDYxIC8qIGEgKi8gJiYgY2ggPD0gMHg3QSAvKiB6ICovKVxuICAgIClcbiAgfVxuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLVJlZ0V4cFVuaWNvZGVFc2NhcGVTZXF1ZW5jZVxuICBwcCQxLnJlZ2V4cF9lYXRSZWdFeHBVbmljb2RlRXNjYXBlU2VxdWVuY2UgPSBmdW5jdGlvbihzdGF0ZSwgZm9yY2VVKSB7XG4gICAgaWYgKCBmb3JjZVUgPT09IHZvaWQgMCApIGZvcmNlVSA9IGZhbHNlO1xuXG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIHZhciBzd2l0Y2hVID0gZm9yY2VVIHx8IHN0YXRlLnN3aXRjaFU7XG5cbiAgICBpZiAoc3RhdGUuZWF0KDB4NzUgLyogdSAqLykpIHtcbiAgICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRGaXhlZEhleERpZ2l0cyhzdGF0ZSwgNCkpIHtcbiAgICAgICAgdmFyIGxlYWQgPSBzdGF0ZS5sYXN0SW50VmFsdWU7XG4gICAgICAgIGlmIChzd2l0Y2hVICYmIGxlYWQgPj0gMHhEODAwICYmIGxlYWQgPD0gMHhEQkZGKSB7XG4gICAgICAgICAgdmFyIGxlYWRTdXJyb2dhdGVFbmQgPSBzdGF0ZS5wb3M7XG4gICAgICAgICAgaWYgKHN0YXRlLmVhdCgweDVDIC8qIFxcICovKSAmJiBzdGF0ZS5lYXQoMHg3NSAvKiB1ICovKSAmJiB0aGlzLnJlZ2V4cF9lYXRGaXhlZEhleERpZ2l0cyhzdGF0ZSwgNCkpIHtcbiAgICAgICAgICAgIHZhciB0cmFpbCA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICAgICAgICAgIGlmICh0cmFpbCA+PSAweERDMDAgJiYgdHJhaWwgPD0gMHhERkZGKSB7XG4gICAgICAgICAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IChsZWFkIC0gMHhEODAwKSAqIDB4NDAwICsgKHRyYWlsIC0gMHhEQzAwKSArIDB4MTAwMDA7XG4gICAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHN0YXRlLnBvcyA9IGxlYWRTdXJyb2dhdGVFbmQ7XG4gICAgICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gbGVhZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgaWYgKFxuICAgICAgICBzd2l0Y2hVICYmXG4gICAgICAgIHN0YXRlLmVhdCgweDdCIC8qIHsgKi8pICYmXG4gICAgICAgIHRoaXMucmVnZXhwX2VhdEhleERpZ2l0cyhzdGF0ZSkgJiZcbiAgICAgICAgc3RhdGUuZWF0KDB4N0QgLyogfSAqLykgJiZcbiAgICAgICAgaXNWYWxpZFVuaWNvZGUoc3RhdGUubGFzdEludFZhbHVlKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBpZiAoc3dpdGNoVSkge1xuICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgdW5pY29kZSBlc2NhcGVcIik7XG4gICAgICB9XG4gICAgICBzdGF0ZS5wb3MgPSBzdGFydDtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcbiAgZnVuY3Rpb24gaXNWYWxpZFVuaWNvZGUoY2gpIHtcbiAgICByZXR1cm4gY2ggPj0gMCAmJiBjaCA8PSAweDEwRkZGRlxuICB9XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUlkZW50aXR5RXNjYXBlXG4gIHBwJDEucmVnZXhwX2VhdElkZW50aXR5RXNjYXBlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoc3RhdGUuc3dpdGNoVSkge1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdFN5bnRheENoYXJhY3RlcihzdGF0ZSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIGlmIChzdGF0ZS5lYXQoMHgyRiAvKiAvICovKSkge1xuICAgICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAweDJGOyAvKiAvICovXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgaWYgKGNoICE9PSAweDYzIC8qIGMgKi8gJiYgKCFzdGF0ZS5zd2l0Y2hOIHx8IGNoICE9PSAweDZCIC8qIGsgKi8pKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBjaDtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtRGVjaW1hbEVzY2FwZVxuICBwcCQxLnJlZ2V4cF9lYXREZWNpbWFsRXNjYXBlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAwO1xuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICBpZiAoY2ggPj0gMHgzMSAvKiAxICovICYmIGNoIDw9IDB4MzkgLyogOSAqLykge1xuICAgICAgZG8ge1xuICAgICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAxMCAqIHN0YXRlLmxhc3RJbnRWYWx1ZSArIChjaCAtIDB4MzAgLyogMCAqLyk7XG4gICAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIH0gd2hpbGUgKChjaCA9IHN0YXRlLmN1cnJlbnQoKSkgPj0gMHgzMCAvKiAwICovICYmIGNoIDw9IDB4MzkgLyogOSAqLylcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIFJldHVybiB2YWx1ZXMgdXNlZCBieSBjaGFyYWN0ZXIgc2V0IHBhcnNpbmcgbWV0aG9kcywgbmVlZGVkIHRvXG4gIC8vIGZvcmJpZCBuZWdhdGlvbiBvZiBzZXRzIHRoYXQgY2FuIG1hdGNoIHN0cmluZ3MuXG4gIHZhciBDaGFyU2V0Tm9uZSA9IDA7IC8vIE5vdGhpbmcgcGFyc2VkXG4gIHZhciBDaGFyU2V0T2sgPSAxOyAvLyBDb25zdHJ1Y3QgcGFyc2VkLCBjYW5ub3QgY29udGFpbiBzdHJpbmdzXG4gIHZhciBDaGFyU2V0U3RyaW5nID0gMjsgLy8gQ29uc3RydWN0IHBhcnNlZCwgY2FuIGNvbnRhaW4gc3RyaW5nc1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUNoYXJhY3RlckNsYXNzRXNjYXBlXG4gIHBwJDEucmVnZXhwX2VhdENoYXJhY3RlckNsYXNzRXNjYXBlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICBpZiAoaXNDaGFyYWN0ZXJDbGFzc0VzY2FwZShjaCkpIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IC0xO1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIENoYXJTZXRPa1xuICAgIH1cblxuICAgIHZhciBuZWdhdGUgPSBmYWxzZTtcbiAgICBpZiAoXG4gICAgICBzdGF0ZS5zd2l0Y2hVICYmXG4gICAgICB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gOSAmJlxuICAgICAgKChuZWdhdGUgPSBjaCA9PT0gMHg1MCAvKiBQICovKSB8fCBjaCA9PT0gMHg3MCAvKiBwICovKVxuICAgICkge1xuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gLTE7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgICB2YXIgcmVzdWx0O1xuICAgICAgaWYgKFxuICAgICAgICBzdGF0ZS5lYXQoMHg3QiAvKiB7ICovKSAmJlxuICAgICAgICAocmVzdWx0ID0gdGhpcy5yZWdleHBfZWF0VW5pY29kZVByb3BlcnR5VmFsdWVFeHByZXNzaW9uKHN0YXRlKSkgJiZcbiAgICAgICAgc3RhdGUuZWF0KDB4N0QgLyogfSAqLylcbiAgICAgICkge1xuICAgICAgICBpZiAobmVnYXRlICYmIHJlc3VsdCA9PT0gQ2hhclNldFN0cmluZykgeyBzdGF0ZS5yYWlzZShcIkludmFsaWQgcHJvcGVydHkgbmFtZVwiKTsgfVxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICB9XG4gICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgcHJvcGVydHkgbmFtZVwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gQ2hhclNldE5vbmVcbiAgfTtcblxuICBmdW5jdGlvbiBpc0NoYXJhY3RlckNsYXNzRXNjYXBlKGNoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGNoID09PSAweDY0IC8qIGQgKi8gfHxcbiAgICAgIGNoID09PSAweDQ0IC8qIEQgKi8gfHxcbiAgICAgIGNoID09PSAweDczIC8qIHMgKi8gfHxcbiAgICAgIGNoID09PSAweDUzIC8qIFMgKi8gfHxcbiAgICAgIGNoID09PSAweDc3IC8qIHcgKi8gfHxcbiAgICAgIGNoID09PSAweDU3IC8qIFcgKi9cbiAgICApXG4gIH1cblxuICAvLyBVbmljb2RlUHJvcGVydHlWYWx1ZUV4cHJlc3Npb24gOjpcbiAgLy8gICBVbmljb2RlUHJvcGVydHlOYW1lIGA9YCBVbmljb2RlUHJvcGVydHlWYWx1ZVxuICAvLyAgIExvbmVVbmljb2RlUHJvcGVydHlOYW1lT3JWYWx1ZVxuICBwcCQxLnJlZ2V4cF9lYXRVbmljb2RlUHJvcGVydHlWYWx1ZUV4cHJlc3Npb24gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcblxuICAgIC8vIFVuaWNvZGVQcm9wZXJ0eU5hbWUgYD1gIFVuaWNvZGVQcm9wZXJ0eVZhbHVlXG4gICAgaWYgKHRoaXMucmVnZXhwX2VhdFVuaWNvZGVQcm9wZXJ0eU5hbWUoc3RhdGUpICYmIHN0YXRlLmVhdCgweDNEIC8qID0gKi8pKSB7XG4gICAgICB2YXIgbmFtZSA9IHN0YXRlLmxhc3RTdHJpbmdWYWx1ZTtcbiAgICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRVbmljb2RlUHJvcGVydHlWYWx1ZShzdGF0ZSkpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gc3RhdGUubGFzdFN0cmluZ1ZhbHVlO1xuICAgICAgICB0aGlzLnJlZ2V4cF92YWxpZGF0ZVVuaWNvZGVQcm9wZXJ0eU5hbWVBbmRWYWx1ZShzdGF0ZSwgbmFtZSwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gQ2hhclNldE9rXG4gICAgICB9XG4gICAgfVxuICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuXG4gICAgLy8gTG9uZVVuaWNvZGVQcm9wZXJ0eU5hbWVPclZhbHVlXG4gICAgaWYgKHRoaXMucmVnZXhwX2VhdExvbmVVbmljb2RlUHJvcGVydHlOYW1lT3JWYWx1ZShzdGF0ZSkpIHtcbiAgICAgIHZhciBuYW1lT3JWYWx1ZSA9IHN0YXRlLmxhc3RTdHJpbmdWYWx1ZTtcbiAgICAgIHJldHVybiB0aGlzLnJlZ2V4cF92YWxpZGF0ZVVuaWNvZGVQcm9wZXJ0eU5hbWVPclZhbHVlKHN0YXRlLCBuYW1lT3JWYWx1ZSlcbiAgICB9XG4gICAgcmV0dXJuIENoYXJTZXROb25lXG4gIH07XG5cbiAgcHAkMS5yZWdleHBfdmFsaWRhdGVVbmljb2RlUHJvcGVydHlOYW1lQW5kVmFsdWUgPSBmdW5jdGlvbihzdGF0ZSwgbmFtZSwgdmFsdWUpIHtcbiAgICBpZiAoIWhhc093bihzdGF0ZS51bmljb2RlUHJvcGVydGllcy5ub25CaW5hcnksIG5hbWUpKVxuICAgICAgeyBzdGF0ZS5yYWlzZShcIkludmFsaWQgcHJvcGVydHkgbmFtZVwiKTsgfVxuICAgIGlmICghc3RhdGUudW5pY29kZVByb3BlcnRpZXMubm9uQmluYXJ5W25hbWVdLnRlc3QodmFsdWUpKVxuICAgICAgeyBzdGF0ZS5yYWlzZShcIkludmFsaWQgcHJvcGVydHkgdmFsdWVcIik7IH1cbiAgfTtcblxuICBwcCQxLnJlZ2V4cF92YWxpZGF0ZVVuaWNvZGVQcm9wZXJ0eU5hbWVPclZhbHVlID0gZnVuY3Rpb24oc3RhdGUsIG5hbWVPclZhbHVlKSB7XG4gICAgaWYgKHN0YXRlLnVuaWNvZGVQcm9wZXJ0aWVzLmJpbmFyeS50ZXN0KG5hbWVPclZhbHVlKSkgeyByZXR1cm4gQ2hhclNldE9rIH1cbiAgICBpZiAoc3RhdGUuc3dpdGNoViAmJiBzdGF0ZS51bmljb2RlUHJvcGVydGllcy5iaW5hcnlPZlN0cmluZ3MudGVzdChuYW1lT3JWYWx1ZSkpIHsgcmV0dXJuIENoYXJTZXRTdHJpbmcgfVxuICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBwcm9wZXJ0eSBuYW1lXCIpO1xuICB9O1xuXG4gIC8vIFVuaWNvZGVQcm9wZXJ0eU5hbWUgOjpcbiAgLy8gICBVbmljb2RlUHJvcGVydHlOYW1lQ2hhcmFjdGVyc1xuICBwcCQxLnJlZ2V4cF9lYXRVbmljb2RlUHJvcGVydHlOYW1lID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgY2ggPSAwO1xuICAgIHN0YXRlLmxhc3RTdHJpbmdWYWx1ZSA9IFwiXCI7XG4gICAgd2hpbGUgKGlzVW5pY29kZVByb3BlcnR5TmFtZUNoYXJhY3RlcihjaCA9IHN0YXRlLmN1cnJlbnQoKSkpIHtcbiAgICAgIHN0YXRlLmxhc3RTdHJpbmdWYWx1ZSArPSBjb2RlUG9pbnRUb1N0cmluZyhjaCk7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgIT09IFwiXCJcbiAgfTtcblxuICBmdW5jdGlvbiBpc1VuaWNvZGVQcm9wZXJ0eU5hbWVDaGFyYWN0ZXIoY2gpIHtcbiAgICByZXR1cm4gaXNDb250cm9sTGV0dGVyKGNoKSB8fCBjaCA9PT0gMHg1RiAvKiBfICovXG4gIH1cblxuICAvLyBVbmljb2RlUHJvcGVydHlWYWx1ZSA6OlxuICAvLyAgIFVuaWNvZGVQcm9wZXJ0eVZhbHVlQ2hhcmFjdGVyc1xuICBwcCQxLnJlZ2V4cF9lYXRVbmljb2RlUHJvcGVydHlWYWx1ZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIGNoID0gMDtcbiAgICBzdGF0ZS5sYXN0U3RyaW5nVmFsdWUgPSBcIlwiO1xuICAgIHdoaWxlIChpc1VuaWNvZGVQcm9wZXJ0eVZhbHVlQ2hhcmFjdGVyKGNoID0gc3RhdGUuY3VycmVudCgpKSkge1xuICAgICAgc3RhdGUubGFzdFN0cmluZ1ZhbHVlICs9IGNvZGVQb2ludFRvU3RyaW5nKGNoKTtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRlLmxhc3RTdHJpbmdWYWx1ZSAhPT0gXCJcIlxuICB9O1xuICBmdW5jdGlvbiBpc1VuaWNvZGVQcm9wZXJ0eVZhbHVlQ2hhcmFjdGVyKGNoKSB7XG4gICAgcmV0dXJuIGlzVW5pY29kZVByb3BlcnR5TmFtZUNoYXJhY3RlcihjaCkgfHwgaXNEZWNpbWFsRGlnaXQoY2gpXG4gIH1cblxuICAvLyBMb25lVW5pY29kZVByb3BlcnR5TmFtZU9yVmFsdWUgOjpcbiAgLy8gICBVbmljb2RlUHJvcGVydHlWYWx1ZUNoYXJhY3RlcnNcbiAgcHAkMS5yZWdleHBfZWF0TG9uZVVuaWNvZGVQcm9wZXJ0eU5hbWVPclZhbHVlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICByZXR1cm4gdGhpcy5yZWdleHBfZWF0VW5pY29kZVByb3BlcnR5VmFsdWUoc3RhdGUpXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtQ2hhcmFjdGVyQ2xhc3NcbiAgcHAkMS5yZWdleHBfZWF0Q2hhcmFjdGVyQ2xhc3MgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5lYXQoMHg1QiAvKiBbICovKSkge1xuICAgICAgdmFyIG5lZ2F0ZSA9IHN0YXRlLmVhdCgweDVFIC8qIF4gKi8pO1xuICAgICAgdmFyIHJlc3VsdCA9IHRoaXMucmVnZXhwX2NsYXNzQ29udGVudHMoc3RhdGUpO1xuICAgICAgaWYgKCFzdGF0ZS5lYXQoMHg1RCAvKiBdICovKSlcbiAgICAgICAgeyBzdGF0ZS5yYWlzZShcIlVudGVybWluYXRlZCBjaGFyYWN0ZXIgY2xhc3NcIik7IH1cbiAgICAgIGlmIChuZWdhdGUgJiYgcmVzdWx0ID09PSBDaGFyU2V0U3RyaW5nKVxuICAgICAgICB7IHN0YXRlLnJhaXNlKFwiTmVnYXRlZCBjaGFyYWN0ZXIgY2xhc3MgbWF5IGNvbnRhaW4gc3RyaW5nc1wiKTsgfVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NDb250ZW50c1xuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1DbGFzc1Jhbmdlc1xuICBwcCQxLnJlZ2V4cF9jbGFzc0NvbnRlbnRzID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoc3RhdGUuY3VycmVudCgpID09PSAweDVEIC8qIF0gKi8pIHsgcmV0dXJuIENoYXJTZXRPayB9XG4gICAgaWYgKHN0YXRlLnN3aXRjaFYpIHsgcmV0dXJuIHRoaXMucmVnZXhwX2NsYXNzU2V0RXhwcmVzc2lvbihzdGF0ZSkgfVxuICAgIHRoaXMucmVnZXhwX25vbkVtcHR5Q2xhc3NSYW5nZXMoc3RhdGUpO1xuICAgIHJldHVybiBDaGFyU2V0T2tcbiAgfTtcblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1Ob25lbXB0eUNsYXNzUmFuZ2VzXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLU5vbmVtcHR5Q2xhc3NSYW5nZXNOb0Rhc2hcbiAgcHAkMS5yZWdleHBfbm9uRW1wdHlDbGFzc1JhbmdlcyA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgd2hpbGUgKHRoaXMucmVnZXhwX2VhdENsYXNzQXRvbShzdGF0ZSkpIHtcbiAgICAgIHZhciBsZWZ0ID0gc3RhdGUubGFzdEludFZhbHVlO1xuICAgICAgaWYgKHN0YXRlLmVhdCgweDJEIC8qIC0gKi8pICYmIHRoaXMucmVnZXhwX2VhdENsYXNzQXRvbShzdGF0ZSkpIHtcbiAgICAgICAgdmFyIHJpZ2h0ID0gc3RhdGUubGFzdEludFZhbHVlO1xuICAgICAgICBpZiAoc3RhdGUuc3dpdGNoVSAmJiAobGVmdCA9PT0gLTEgfHwgcmlnaHQgPT09IC0xKSkge1xuICAgICAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBjaGFyYWN0ZXIgY2xhc3NcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxlZnQgIT09IC0xICYmIHJpZ2h0ICE9PSAtMSAmJiBsZWZ0ID4gcmlnaHQpIHtcbiAgICAgICAgICBzdGF0ZS5yYWlzZShcIlJhbmdlIG91dCBvZiBvcmRlciBpbiBjaGFyYWN0ZXIgY2xhc3NcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtQ2xhc3NBdG9tXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUNsYXNzQXRvbU5vRGFzaFxuICBwcCQxLnJlZ2V4cF9lYXRDbGFzc0F0b20gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcblxuICAgIGlmIChzdGF0ZS5lYXQoMHg1QyAvKiBcXCAqLykpIHtcbiAgICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRDbGFzc0VzY2FwZShzdGF0ZSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIGlmIChzdGF0ZS5zd2l0Y2hVKSB7XG4gICAgICAgIC8vIE1ha2UgdGhlIHNhbWUgbWVzc2FnZSBhcyBWOC5cbiAgICAgICAgdmFyIGNoJDEgPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgICAgIGlmIChjaCQxID09PSAweDYzIC8qIGMgKi8gfHwgaXNPY3RhbERpZ2l0KGNoJDEpKSB7XG4gICAgICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIGNsYXNzIGVzY2FwZVwiKTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgZXNjYXBlXCIpO1xuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuXG4gICAgdmFyIGNoID0gc3RhdGUuY3VycmVudCgpO1xuICAgIGlmIChjaCAhPT0gMHg1RCAvKiBdICovKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSBjaDtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUNsYXNzRXNjYXBlXG4gIHBwJDEucmVnZXhwX2VhdENsYXNzRXNjYXBlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG5cbiAgICBpZiAoc3RhdGUuZWF0KDB4NjIgLyogYiAqLykpIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDB4MDg7IC8qIDxCUz4gKi9cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgaWYgKHN0YXRlLnN3aXRjaFUgJiYgc3RhdGUuZWF0KDB4MkQgLyogLSAqLykpIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDB4MkQ7IC8qIC0gKi9cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgaWYgKCFzdGF0ZS5zd2l0Y2hVICYmIHN0YXRlLmVhdCgweDYzIC8qIGMgKi8pKSB7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0Q2xhc3NDb250cm9sTGV0dGVyKHN0YXRlKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMucmVnZXhwX2VhdENoYXJhY3RlckNsYXNzRXNjYXBlKHN0YXRlKSB8fFxuICAgICAgdGhpcy5yZWdleHBfZWF0Q2hhcmFjdGVyRXNjYXBlKHN0YXRlKVxuICAgIClcbiAgfTtcblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1NldEV4cHJlc3Npb25cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NVbmlvblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc0ludGVyc2VjdGlvblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1N1YnRyYWN0aW9uXG4gIHBwJDEucmVnZXhwX2NsYXNzU2V0RXhwcmVzc2lvbiA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHJlc3VsdCA9IENoYXJTZXRPaywgc3ViUmVzdWx0O1xuICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRDbGFzc1NldFJhbmdlKHN0YXRlKSkgOyBlbHNlIGlmIChzdWJSZXN1bHQgPSB0aGlzLnJlZ2V4cF9lYXRDbGFzc1NldE9wZXJhbmQoc3RhdGUpKSB7XG4gICAgICBpZiAoc3ViUmVzdWx0ID09PSBDaGFyU2V0U3RyaW5nKSB7IHJlc3VsdCA9IENoYXJTZXRTdHJpbmc7IH1cbiAgICAgIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzSW50ZXJzZWN0aW9uXG4gICAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgICB3aGlsZSAoc3RhdGUuZWF0Q2hhcnMoWzB4MjYsIDB4MjZdIC8qICYmICovKSkge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc3RhdGUuY3VycmVudCgpICE9PSAweDI2IC8qICYgKi8gJiZcbiAgICAgICAgICAoc3ViUmVzdWx0ID0gdGhpcy5yZWdleHBfZWF0Q2xhc3NTZXRPcGVyYW5kKHN0YXRlKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgaWYgKHN1YlJlc3VsdCAhPT0gQ2hhclNldFN0cmluZykgeyByZXN1bHQgPSBDaGFyU2V0T2s7IH1cbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBjaGFyYWN0ZXIgaW4gY2hhcmFjdGVyIGNsYXNzXCIpO1xuICAgICAgfVxuICAgICAgaWYgKHN0YXJ0ICE9PSBzdGF0ZS5wb3MpIHsgcmV0dXJuIHJlc3VsdCB9XG4gICAgICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1N1YnRyYWN0aW9uXG4gICAgICB3aGlsZSAoc3RhdGUuZWF0Q2hhcnMoWzB4MkQsIDB4MkRdIC8qIC0tICovKSkge1xuICAgICAgICBpZiAodGhpcy5yZWdleHBfZWF0Q2xhc3NTZXRPcGVyYW5kKHN0YXRlKSkgeyBjb250aW51ZSB9XG4gICAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBjaGFyYWN0ZXIgaW4gY2hhcmFjdGVyIGNsYXNzXCIpO1xuICAgICAgfVxuICAgICAgaWYgKHN0YXJ0ICE9PSBzdGF0ZS5wb3MpIHsgcmV0dXJuIHJlc3VsdCB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlLnJhaXNlKFwiSW52YWxpZCBjaGFyYWN0ZXIgaW4gY2hhcmFjdGVyIGNsYXNzXCIpO1xuICAgIH1cbiAgICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1VuaW9uXG4gICAgZm9yICg7Oykge1xuICAgICAgaWYgKHRoaXMucmVnZXhwX2VhdENsYXNzU2V0UmFuZ2Uoc3RhdGUpKSB7IGNvbnRpbnVlIH1cbiAgICAgIHN1YlJlc3VsdCA9IHRoaXMucmVnZXhwX2VhdENsYXNzU2V0T3BlcmFuZChzdGF0ZSk7XG4gICAgICBpZiAoIXN1YlJlc3VsdCkgeyByZXR1cm4gcmVzdWx0IH1cbiAgICAgIGlmIChzdWJSZXN1bHQgPT09IENoYXJTZXRTdHJpbmcpIHsgcmVzdWx0ID0gQ2hhclNldFN0cmluZzsgfVxuICAgIH1cbiAgfTtcblxuICAvLyBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jcHJvZC1DbGFzc1NldFJhbmdlXG4gIHBwJDEucmVnZXhwX2VhdENsYXNzU2V0UmFuZ2UgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICBpZiAodGhpcy5yZWdleHBfZWF0Q2xhc3NTZXRDaGFyYWN0ZXIoc3RhdGUpKSB7XG4gICAgICB2YXIgbGVmdCA9IHN0YXRlLmxhc3RJbnRWYWx1ZTtcbiAgICAgIGlmIChzdGF0ZS5lYXQoMHgyRCAvKiAtICovKSAmJiB0aGlzLnJlZ2V4cF9lYXRDbGFzc1NldENoYXJhY3RlcihzdGF0ZSkpIHtcbiAgICAgICAgdmFyIHJpZ2h0ID0gc3RhdGUubGFzdEludFZhbHVlO1xuICAgICAgICBpZiAobGVmdCAhPT0gLTEgJiYgcmlnaHQgIT09IC0xICYmIGxlZnQgPiByaWdodCkge1xuICAgICAgICAgIHN0YXRlLnJhaXNlKFwiUmFuZ2Ugb3V0IG9mIG9yZGVyIGluIGNoYXJhY3RlciBjbGFzc1wiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzU2V0T3BlcmFuZFxuICBwcCQxLnJlZ2V4cF9lYXRDbGFzc1NldE9wZXJhbmQgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmICh0aGlzLnJlZ2V4cF9lYXRDbGFzc1NldENoYXJhY3RlcihzdGF0ZSkpIHsgcmV0dXJuIENoYXJTZXRPayB9XG4gICAgcmV0dXJuIHRoaXMucmVnZXhwX2VhdENsYXNzU3RyaW5nRGlzanVuY3Rpb24oc3RhdGUpIHx8IHRoaXMucmVnZXhwX2VhdE5lc3RlZENsYXNzKHN0YXRlKVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLU5lc3RlZENsYXNzXG4gIHBwJDEucmVnZXhwX2VhdE5lc3RlZENsYXNzID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgaWYgKHN0YXRlLmVhdCgweDVCIC8qIFsgKi8pKSB7XG4gICAgICB2YXIgbmVnYXRlID0gc3RhdGUuZWF0KDB4NUUgLyogXiAqLyk7XG4gICAgICB2YXIgcmVzdWx0ID0gdGhpcy5yZWdleHBfY2xhc3NDb250ZW50cyhzdGF0ZSk7XG4gICAgICBpZiAoc3RhdGUuZWF0KDB4NUQgLyogXSAqLykpIHtcbiAgICAgICAgaWYgKG5lZ2F0ZSAmJiByZXN1bHQgPT09IENoYXJTZXRTdHJpbmcpIHtcbiAgICAgICAgICBzdGF0ZS5yYWlzZShcIk5lZ2F0ZWQgY2hhcmFjdGVyIGNsYXNzIG1heSBjb250YWluIHN0cmluZ3NcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuICAgIGlmIChzdGF0ZS5lYXQoMHg1QyAvKiBcXCAqLykpIHtcbiAgICAgIHZhciByZXN1bHQkMSA9IHRoaXMucmVnZXhwX2VhdENoYXJhY3RlckNsYXNzRXNjYXBlKHN0YXRlKTtcbiAgICAgIGlmIChyZXN1bHQkMSkge1xuICAgICAgICByZXR1cm4gcmVzdWx0JDFcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbFxuICB9O1xuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzU3RyaW5nRGlzanVuY3Rpb25cbiAgcHAkMS5yZWdleHBfZWF0Q2xhc3NTdHJpbmdEaXNqdW5jdGlvbiA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIGlmIChzdGF0ZS5lYXRDaGFycyhbMHg1QywgMHg3MV0gLyogXFxxICovKSkge1xuICAgICAgaWYgKHN0YXRlLmVhdCgweDdCIC8qIHsgKi8pKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSB0aGlzLnJlZ2V4cF9jbGFzc1N0cmluZ0Rpc2p1bmN0aW9uQ29udGVudHMoc3RhdGUpO1xuICAgICAgICBpZiAoc3RhdGUuZWF0KDB4N0QgLyogfSAqLykpIHtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE1ha2UgdGhlIHNhbWUgbWVzc2FnZSBhcyBWOC5cbiAgICAgICAgc3RhdGUucmFpc2UoXCJJbnZhbGlkIGVzY2FwZVwiKTtcbiAgICAgIH1cbiAgICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbFxuICB9O1xuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzU3RyaW5nRGlzanVuY3Rpb25Db250ZW50c1xuICBwcCQxLnJlZ2V4cF9jbGFzc1N0cmluZ0Rpc2p1bmN0aW9uQ29udGVudHMgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnJlZ2V4cF9jbGFzc1N0cmluZyhzdGF0ZSk7XG4gICAgd2hpbGUgKHN0YXRlLmVhdCgweDdDIC8qIHwgKi8pKSB7XG4gICAgICBpZiAodGhpcy5yZWdleHBfY2xhc3NTdHJpbmcoc3RhdGUpID09PSBDaGFyU2V0U3RyaW5nKSB7IHJlc3VsdCA9IENoYXJTZXRTdHJpbmc7IH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdFxuICB9O1xuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzU3RyaW5nXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLU5vbkVtcHR5Q2xhc3NTdHJpbmdcbiAgcHAkMS5yZWdleHBfY2xhc3NTdHJpbmcgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBjb3VudCA9IDA7XG4gICAgd2hpbGUgKHRoaXMucmVnZXhwX2VhdENsYXNzU2V0Q2hhcmFjdGVyKHN0YXRlKSkgeyBjb3VudCsrOyB9XG4gICAgcmV0dXJuIGNvdW50ID09PSAxID8gQ2hhclNldE9rIDogQ2hhclNldFN0cmluZ1xuICB9O1xuXG4gIC8vIGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNwcm9kLUNsYXNzU2V0Q2hhcmFjdGVyXG4gIHBwJDEucmVnZXhwX2VhdENsYXNzU2V0Q2hhcmFjdGVyID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgaWYgKHN0YXRlLmVhdCgweDVDIC8qIFxcICovKSkge1xuICAgICAgaWYgKFxuICAgICAgICB0aGlzLnJlZ2V4cF9lYXRDaGFyYWN0ZXJFc2NhcGUoc3RhdGUpIHx8XG4gICAgICAgIHRoaXMucmVnZXhwX2VhdENsYXNzU2V0UmVzZXJ2ZWRQdW5jdHVhdG9yKHN0YXRlKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBpZiAoc3RhdGUuZWF0KDB4NjIgLyogYiAqLykpIHtcbiAgICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMHgwODsgLyogPEJTPiAqL1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgdmFyIGNoID0gc3RhdGUuY3VycmVudCgpO1xuICAgIGlmIChjaCA8IDAgfHwgY2ggPT09IHN0YXRlLmxvb2thaGVhZCgpICYmIGlzQ2xhc3NTZXRSZXNlcnZlZERvdWJsZVB1bmN0dWF0b3JDaGFyYWN0ZXIoY2gpKSB7IHJldHVybiBmYWxzZSB9XG4gICAgaWYgKGlzQ2xhc3NTZXRTeW50YXhDaGFyYWN0ZXIoY2gpKSB7IHJldHVybiBmYWxzZSB9XG4gICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IGNoO1xuICAgIHJldHVybiB0cnVlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NTZXRSZXNlcnZlZERvdWJsZVB1bmN0dWF0b3JcbiAgZnVuY3Rpb24gaXNDbGFzc1NldFJlc2VydmVkRG91YmxlUHVuY3R1YXRvckNoYXJhY3RlcihjaCkge1xuICAgIHJldHVybiAoXG4gICAgICBjaCA9PT0gMHgyMSAvKiAhICovIHx8XG4gICAgICBjaCA+PSAweDIzIC8qICMgKi8gJiYgY2ggPD0gMHgyNiAvKiAmICovIHx8XG4gICAgICBjaCA+PSAweDJBIC8qICogKi8gJiYgY2ggPD0gMHgyQyAvKiAsICovIHx8XG4gICAgICBjaCA9PT0gMHgyRSAvKiAuICovIHx8XG4gICAgICBjaCA+PSAweDNBIC8qIDogKi8gJiYgY2ggPD0gMHg0MCAvKiBAICovIHx8XG4gICAgICBjaCA9PT0gMHg1RSAvKiBeICovIHx8XG4gICAgICBjaCA9PT0gMHg2MCAvKiBgICovIHx8XG4gICAgICBjaCA9PT0gMHg3RSAvKiB+ICovXG4gICAgKVxuICB9XG5cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NTZXRTeW50YXhDaGFyYWN0ZXJcbiAgZnVuY3Rpb24gaXNDbGFzc1NldFN5bnRheENoYXJhY3RlcihjaCkge1xuICAgIHJldHVybiAoXG4gICAgICBjaCA9PT0gMHgyOCAvKiAoICovIHx8XG4gICAgICBjaCA9PT0gMHgyOSAvKiApICovIHx8XG4gICAgICBjaCA9PT0gMHgyRCAvKiAtICovIHx8XG4gICAgICBjaCA9PT0gMHgyRiAvKiAvICovIHx8XG4gICAgICBjaCA+PSAweDVCIC8qIFsgKi8gJiYgY2ggPD0gMHg1RCAvKiBdICovIHx8XG4gICAgICBjaCA+PSAweDdCIC8qIHsgKi8gJiYgY2ggPD0gMHg3RCAvKiB9ICovXG4gICAgKVxuICB9XG5cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NTZXRSZXNlcnZlZFB1bmN0dWF0b3JcbiAgcHAkMS5yZWdleHBfZWF0Q2xhc3NTZXRSZXNlcnZlZFB1bmN0dWF0b3IgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICBpZiAoaXNDbGFzc1NldFJlc2VydmVkUHVuY3R1YXRvcihjaCkpIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IGNoO1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvI3Byb2QtQ2xhc3NTZXRSZXNlcnZlZFB1bmN0dWF0b3JcbiAgZnVuY3Rpb24gaXNDbGFzc1NldFJlc2VydmVkUHVuY3R1YXRvcihjaCkge1xuICAgIHJldHVybiAoXG4gICAgICBjaCA9PT0gMHgyMSAvKiAhICovIHx8XG4gICAgICBjaCA9PT0gMHgyMyAvKiAjICovIHx8XG4gICAgICBjaCA9PT0gMHgyNSAvKiAlICovIHx8XG4gICAgICBjaCA9PT0gMHgyNiAvKiAmICovIHx8XG4gICAgICBjaCA9PT0gMHgyQyAvKiAsICovIHx8XG4gICAgICBjaCA9PT0gMHgyRCAvKiAtICovIHx8XG4gICAgICBjaCA+PSAweDNBIC8qIDogKi8gJiYgY2ggPD0gMHgzRSAvKiA+ICovIHx8XG4gICAgICBjaCA9PT0gMHg0MCAvKiBAICovIHx8XG4gICAgICBjaCA9PT0gMHg2MCAvKiBgICovIHx8XG4gICAgICBjaCA9PT0gMHg3RSAvKiB+ICovXG4gICAgKVxuICB9XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtYW5uZXhCLUNsYXNzQ29udHJvbExldHRlclxuICBwcCQxLnJlZ2V4cF9lYXRDbGFzc0NvbnRyb2xMZXR0ZXIgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICBpZiAoaXNEZWNpbWFsRGlnaXQoY2gpIHx8IGNoID09PSAweDVGIC8qIF8gKi8pIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IGNoICUgMHgyMDtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUhleEVzY2FwZVNlcXVlbmNlXG4gIHBwJDEucmVnZXhwX2VhdEhleEVzY2FwZVNlcXVlbmNlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgc3RhcnQgPSBzdGF0ZS5wb3M7XG4gICAgaWYgKHN0YXRlLmVhdCgweDc4IC8qIHggKi8pKSB7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0Rml4ZWRIZXhEaWdpdHMoc3RhdGUsIDIpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBpZiAoc3RhdGUuc3dpdGNoVSkge1xuICAgICAgICBzdGF0ZS5yYWlzZShcIkludmFsaWQgZXNjYXBlXCIpO1xuICAgICAgfVxuICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9O1xuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLURlY2ltYWxEaWdpdHNcbiAgcHAkMS5yZWdleHBfZWF0RGVjaW1hbERpZ2l0cyA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUucG9zO1xuICAgIHZhciBjaCA9IDA7XG4gICAgc3RhdGUubGFzdEludFZhbHVlID0gMDtcbiAgICB3aGlsZSAoaXNEZWNpbWFsRGlnaXQoY2ggPSBzdGF0ZS5jdXJyZW50KCkpKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAxMCAqIHN0YXRlLmxhc3RJbnRWYWx1ZSArIChjaCAtIDB4MzAgLyogMCAqLyk7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0ZS5wb3MgIT09IHN0YXJ0XG4gIH07XG4gIGZ1bmN0aW9uIGlzRGVjaW1hbERpZ2l0KGNoKSB7XG4gICAgcmV0dXJuIGNoID49IDB4MzAgLyogMCAqLyAmJiBjaCA8PSAweDM5IC8qIDkgKi9cbiAgfVxuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUhleERpZ2l0c1xuICBwcCQxLnJlZ2V4cF9lYXRIZXhEaWdpdHMgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICB2YXIgY2ggPSAwO1xuICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IDA7XG4gICAgd2hpbGUgKGlzSGV4RGlnaXQoY2ggPSBzdGF0ZS5jdXJyZW50KCkpKSB7XG4gICAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAxNiAqIHN0YXRlLmxhc3RJbnRWYWx1ZSArIGhleFRvSW50KGNoKTtcbiAgICAgIHN0YXRlLmFkdmFuY2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRlLnBvcyAhPT0gc3RhcnRcbiAgfTtcbiAgZnVuY3Rpb24gaXNIZXhEaWdpdChjaCkge1xuICAgIHJldHVybiAoXG4gICAgICAoY2ggPj0gMHgzMCAvKiAwICovICYmIGNoIDw9IDB4MzkgLyogOSAqLykgfHxcbiAgICAgIChjaCA+PSAweDQxIC8qIEEgKi8gJiYgY2ggPD0gMHg0NiAvKiBGICovKSB8fFxuICAgICAgKGNoID49IDB4NjEgLyogYSAqLyAmJiBjaCA8PSAweDY2IC8qIGYgKi8pXG4gICAgKVxuICB9XG4gIGZ1bmN0aW9uIGhleFRvSW50KGNoKSB7XG4gICAgaWYgKGNoID49IDB4NDEgLyogQSAqLyAmJiBjaCA8PSAweDQ2IC8qIEYgKi8pIHtcbiAgICAgIHJldHVybiAxMCArIChjaCAtIDB4NDEgLyogQSAqLylcbiAgICB9XG4gICAgaWYgKGNoID49IDB4NjEgLyogYSAqLyAmJiBjaCA8PSAweDY2IC8qIGYgKi8pIHtcbiAgICAgIHJldHVybiAxMCArIChjaCAtIDB4NjEgLyogYSAqLylcbiAgICB9XG4gICAgcmV0dXJuIGNoIC0gMHgzMCAvKiAwICovXG4gIH1cblxuICAvLyBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzguMC8jcHJvZC1hbm5leEItTGVnYWN5T2N0YWxFc2NhcGVTZXF1ZW5jZVxuICAvLyBBbGxvd3Mgb25seSAwLTM3NyhvY3RhbCkgaS5lLiAwLTI1NShkZWNpbWFsKS5cbiAgcHAkMS5yZWdleHBfZWF0TGVnYWN5T2N0YWxFc2NhcGVTZXF1ZW5jZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHRoaXMucmVnZXhwX2VhdE9jdGFsRGlnaXQoc3RhdGUpKSB7XG4gICAgICB2YXIgbjEgPSBzdGF0ZS5sYXN0SW50VmFsdWU7XG4gICAgICBpZiAodGhpcy5yZWdleHBfZWF0T2N0YWxEaWdpdChzdGF0ZSkpIHtcbiAgICAgICAgdmFyIG4yID0gc3RhdGUubGFzdEludFZhbHVlO1xuICAgICAgICBpZiAobjEgPD0gMyAmJiB0aGlzLnJlZ2V4cF9lYXRPY3RhbERpZ2l0KHN0YXRlKSkge1xuICAgICAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IG4xICogNjQgKyBuMiAqIDggKyBzdGF0ZS5sYXN0SW50VmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gbjEgKiA4ICsgbjI7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IG4xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH07XG5cbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtT2N0YWxEaWdpdFxuICBwcCQxLnJlZ2V4cF9lYXRPY3RhbERpZ2l0ID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB2YXIgY2ggPSBzdGF0ZS5jdXJyZW50KCk7XG4gICAgaWYgKGlzT2N0YWxEaWdpdChjaCkpIHtcbiAgICAgIHN0YXRlLmxhc3RJbnRWYWx1ZSA9IGNoIC0gMHgzMDsgLyogMCAqL1xuICAgICAgc3RhdGUuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgc3RhdGUubGFzdEludFZhbHVlID0gMDtcbiAgICByZXR1cm4gZmFsc2VcbiAgfTtcbiAgZnVuY3Rpb24gaXNPY3RhbERpZ2l0KGNoKSB7XG4gICAgcmV0dXJuIGNoID49IDB4MzAgLyogMCAqLyAmJiBjaCA8PSAweDM3IC8qIDcgKi9cbiAgfVxuXG4gIC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUhleDREaWdpdHNcbiAgLy8gaHR0cHM6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi84LjAvI3Byb2QtSGV4RGlnaXRcbiAgLy8gQW5kIEhleERpZ2l0IEhleERpZ2l0IGluIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvOC4wLyNwcm9kLUhleEVzY2FwZVNlcXVlbmNlXG4gIHBwJDEucmVnZXhwX2VhdEZpeGVkSGV4RGlnaXRzID0gZnVuY3Rpb24oc3RhdGUsIGxlbmd0aCkge1xuICAgIHZhciBzdGFydCA9IHN0YXRlLnBvcztcbiAgICBzdGF0ZS5sYXN0SW50VmFsdWUgPSAwO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBjaCA9IHN0YXRlLmN1cnJlbnQoKTtcbiAgICAgIGlmICghaXNIZXhEaWdpdChjaCkpIHtcbiAgICAgICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgICAgc3RhdGUubGFzdEludFZhbHVlID0gMTYgKiBzdGF0ZS5sYXN0SW50VmFsdWUgKyBoZXhUb0ludChjaCk7XG4gICAgICBzdGF0ZS5hZHZhbmNlKCk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlXG4gIH07XG5cbiAgLy8gT2JqZWN0IHR5cGUgdXNlZCB0byByZXByZXNlbnQgdG9rZW5zLiBOb3RlIHRoYXQgbm9ybWFsbHksIHRva2Vuc1xuICAvLyBzaW1wbHkgZXhpc3QgYXMgcHJvcGVydGllcyBvbiB0aGUgcGFyc2VyIG9iamVjdC4gVGhpcyBpcyBvbmx5XG4gIC8vIHVzZWQgZm9yIHRoZSBvblRva2VuIGNhbGxiYWNrIGFuZCB0aGUgZXh0ZXJuYWwgdG9rZW5pemVyLlxuXG4gIHZhciBUb2tlbiA9IGZ1bmN0aW9uIFRva2VuKHApIHtcbiAgICB0aGlzLnR5cGUgPSBwLnR5cGU7XG4gICAgdGhpcy52YWx1ZSA9IHAudmFsdWU7XG4gICAgdGhpcy5zdGFydCA9IHAuc3RhcnQ7XG4gICAgdGhpcy5lbmQgPSBwLmVuZDtcbiAgICBpZiAocC5vcHRpb25zLmxvY2F0aW9ucylcbiAgICAgIHsgdGhpcy5sb2MgPSBuZXcgU291cmNlTG9jYXRpb24ocCwgcC5zdGFydExvYywgcC5lbmRMb2MpOyB9XG4gICAgaWYgKHAub3B0aW9ucy5yYW5nZXMpXG4gICAgICB7IHRoaXMucmFuZ2UgPSBbcC5zdGFydCwgcC5lbmRdOyB9XG4gIH07XG5cbiAgLy8gIyMgVG9rZW5pemVyXG5cbiAgdmFyIHBwID0gUGFyc2VyLnByb3RvdHlwZTtcblxuICAvLyBNb3ZlIHRvIHRoZSBuZXh0IHRva2VuXG5cbiAgcHAubmV4dCA9IGZ1bmN0aW9uKGlnbm9yZUVzY2FwZVNlcXVlbmNlSW5LZXl3b3JkKSB7XG4gICAgaWYgKCFpZ25vcmVFc2NhcGVTZXF1ZW5jZUluS2V5d29yZCAmJiB0aGlzLnR5cGUua2V5d29yZCAmJiB0aGlzLmNvbnRhaW5zRXNjKVxuICAgICAgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5zdGFydCwgXCJFc2NhcGUgc2VxdWVuY2UgaW4ga2V5d29yZCBcIiArIHRoaXMudHlwZS5rZXl3b3JkKTsgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMub25Ub2tlbilcbiAgICAgIHsgdGhpcy5vcHRpb25zLm9uVG9rZW4obmV3IFRva2VuKHRoaXMpKTsgfVxuXG4gICAgdGhpcy5sYXN0VG9rRW5kID0gdGhpcy5lbmQ7XG4gICAgdGhpcy5sYXN0VG9rU3RhcnQgPSB0aGlzLnN0YXJ0O1xuICAgIHRoaXMubGFzdFRva0VuZExvYyA9IHRoaXMuZW5kTG9jO1xuICAgIHRoaXMubGFzdFRva1N0YXJ0TG9jID0gdGhpcy5zdGFydExvYztcbiAgICB0aGlzLm5leHRUb2tlbigpO1xuICB9O1xuXG4gIHBwLmdldFRva2VuID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5uZXh0KCk7XG4gICAgcmV0dXJuIG5ldyBUb2tlbih0aGlzKVxuICB9O1xuXG4gIC8vIElmIHdlJ3JlIGluIGFuIEVTNiBlbnZpcm9ubWVudCwgbWFrZSBwYXJzZXJzIGl0ZXJhYmxlXG4gIGlmICh0eXBlb2YgU3ltYm9sICE9PSBcInVuZGVmaW5lZFwiKVxuICAgIHsgcHBbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHRoaXMkMSQxID0gdGhpcztcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmV4dDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciB0b2tlbiA9IHRoaXMkMSQxLmdldFRva2VuKCk7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGRvbmU6IHRva2VuLnR5cGUgPT09IHR5cGVzJDEuZW9mLFxuICAgICAgICAgICAgdmFsdWU6IHRva2VuXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfTsgfVxuXG4gIC8vIFRvZ2dsZSBzdHJpY3QgbW9kZS4gUmUtcmVhZHMgdGhlIG5leHQgbnVtYmVyIG9yIHN0cmluZyB0byBwbGVhc2VcbiAgLy8gcGVkYW50aWMgdGVzdHMgKGBcInVzZSBzdHJpY3RcIjsgMDEwO2Agc2hvdWxkIGZhaWwpLlxuXG4gIC8vIFJlYWQgYSBzaW5nbGUgdG9rZW4sIHVwZGF0aW5nIHRoZSBwYXJzZXIgb2JqZWN0J3MgdG9rZW4tcmVsYXRlZFxuICAvLyBwcm9wZXJ0aWVzLlxuXG4gIHBwLm5leHRUb2tlbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjdXJDb250ZXh0ID0gdGhpcy5jdXJDb250ZXh0KCk7XG4gICAgaWYgKCFjdXJDb250ZXh0IHx8ICFjdXJDb250ZXh0LnByZXNlcnZlU3BhY2UpIHsgdGhpcy5za2lwU3BhY2UoKTsgfVxuXG4gICAgdGhpcy5zdGFydCA9IHRoaXMucG9zO1xuICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb25zKSB7IHRoaXMuc3RhcnRMb2MgPSB0aGlzLmN1clBvc2l0aW9uKCk7IH1cbiAgICBpZiAodGhpcy5wb3MgPj0gdGhpcy5pbnB1dC5sZW5ndGgpIHsgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5lb2YpIH1cblxuICAgIGlmIChjdXJDb250ZXh0Lm92ZXJyaWRlKSB7IHJldHVybiBjdXJDb250ZXh0Lm92ZXJyaWRlKHRoaXMpIH1cbiAgICBlbHNlIHsgdGhpcy5yZWFkVG9rZW4odGhpcy5mdWxsQ2hhckNvZGVBdFBvcygpKTsgfVxuICB9O1xuXG4gIHBwLnJlYWRUb2tlbiA9IGZ1bmN0aW9uKGNvZGUpIHtcbiAgICAvLyBJZGVudGlmaWVyIG9yIGtleXdvcmQuICdcXHVYWFhYJyBzZXF1ZW5jZXMgYXJlIGFsbG93ZWQgaW5cbiAgICAvLyBpZGVudGlmaWVycywgc28gJ1xcJyBhbHNvIGRpc3BhdGNoZXMgdG8gdGhhdC5cbiAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQoY29kZSwgdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDYpIHx8IGNvZGUgPT09IDkyIC8qICdcXCcgKi8pXG4gICAgICB7IHJldHVybiB0aGlzLnJlYWRXb3JkKCkgfVxuXG4gICAgcmV0dXJuIHRoaXMuZ2V0VG9rZW5Gcm9tQ29kZShjb2RlKVxuICB9O1xuXG4gIHBwLmZ1bGxDaGFyQ29kZUF0UG9zID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNvZGUgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpO1xuICAgIGlmIChjb2RlIDw9IDB4ZDdmZiB8fCBjb2RlID49IDB4ZGMwMCkgeyByZXR1cm4gY29kZSB9XG4gICAgdmFyIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKTtcbiAgICByZXR1cm4gbmV4dCA8PSAweGRiZmYgfHwgbmV4dCA+PSAweGUwMDAgPyBjb2RlIDogKGNvZGUgPDwgMTApICsgbmV4dCAtIDB4MzVmZGMwMFxuICB9O1xuXG4gIHBwLnNraXBCbG9ja0NvbW1lbnQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhcnRMb2MgPSB0aGlzLm9wdGlvbnMub25Db21tZW50ICYmIHRoaXMuY3VyUG9zaXRpb24oKTtcbiAgICB2YXIgc3RhcnQgPSB0aGlzLnBvcywgZW5kID0gdGhpcy5pbnB1dC5pbmRleE9mKFwiKi9cIiwgdGhpcy5wb3MgKz0gMik7XG4gICAgaWYgKGVuZCA9PT0gLTEpIHsgdGhpcy5yYWlzZSh0aGlzLnBvcyAtIDIsIFwiVW50ZXJtaW5hdGVkIGNvbW1lbnRcIik7IH1cbiAgICB0aGlzLnBvcyA9IGVuZCArIDI7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5sb2NhdGlvbnMpIHtcbiAgICAgIGZvciAodmFyIG5leHRCcmVhayA9ICh2b2lkIDApLCBwb3MgPSBzdGFydDsgKG5leHRCcmVhayA9IG5leHRMaW5lQnJlYWsodGhpcy5pbnB1dCwgcG9zLCB0aGlzLnBvcykpID4gLTE7KSB7XG4gICAgICAgICsrdGhpcy5jdXJMaW5lO1xuICAgICAgICBwb3MgPSB0aGlzLmxpbmVTdGFydCA9IG5leHRCcmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkNvbW1lbnQpXG4gICAgICB7IHRoaXMub3B0aW9ucy5vbkNvbW1lbnQodHJ1ZSwgdGhpcy5pbnB1dC5zbGljZShzdGFydCArIDIsIGVuZCksIHN0YXJ0LCB0aGlzLnBvcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRMb2MsIHRoaXMuY3VyUG9zaXRpb24oKSk7IH1cbiAgfTtcblxuICBwcC5za2lwTGluZUNvbW1lbnQgPSBmdW5jdGlvbihzdGFydFNraXApIHtcbiAgICB2YXIgc3RhcnQgPSB0aGlzLnBvcztcbiAgICB2YXIgc3RhcnRMb2MgPSB0aGlzLm9wdGlvbnMub25Db21tZW50ICYmIHRoaXMuY3VyUG9zaXRpb24oKTtcbiAgICB2YXIgY2ggPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKz0gc3RhcnRTa2lwKTtcbiAgICB3aGlsZSAodGhpcy5wb3MgPCB0aGlzLmlucHV0Lmxlbmd0aCAmJiAhaXNOZXdMaW5lKGNoKSkge1xuICAgICAgY2ggPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQoKyt0aGlzLnBvcyk7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMub25Db21tZW50KVxuICAgICAgeyB0aGlzLm9wdGlvbnMub25Db21tZW50KGZhbHNlLCB0aGlzLmlucHV0LnNsaWNlKHN0YXJ0ICsgc3RhcnRTa2lwLCB0aGlzLnBvcyksIHN0YXJ0LCB0aGlzLnBvcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRMb2MsIHRoaXMuY3VyUG9zaXRpb24oKSk7IH1cbiAgfTtcblxuICAvLyBDYWxsZWQgYXQgdGhlIHN0YXJ0IG9mIHRoZSBwYXJzZSBhbmQgYWZ0ZXIgZXZlcnkgdG9rZW4uIFNraXBzXG4gIC8vIHdoaXRlc3BhY2UgYW5kIGNvbW1lbnRzLCBhbmQuXG5cbiAgcHAuc2tpcFNwYWNlID0gZnVuY3Rpb24oKSB7XG4gICAgbG9vcDogd2hpbGUgKHRoaXMucG9zIDwgdGhpcy5pbnB1dC5sZW5ndGgpIHtcbiAgICAgIHZhciBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyk7XG4gICAgICBzd2l0Y2ggKGNoKSB7XG4gICAgICBjYXNlIDMyOiBjYXNlIDE2MDogLy8gJyAnXG4gICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDEzOlxuICAgICAgICBpZiAodGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSkgPT09IDEwKSB7XG4gICAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgICAgfVxuICAgICAgY2FzZSAxMDogY2FzZSA4MjMyOiBjYXNlIDgyMzM6XG4gICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb25zKSB7XG4gICAgICAgICAgKyt0aGlzLmN1ckxpbmU7XG4gICAgICAgICAgdGhpcy5saW5lU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgICAgfVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA0NzogLy8gJy8nXG4gICAgICAgIHN3aXRjaCAodGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSkpIHtcbiAgICAgICAgY2FzZSA0MjogLy8gJyonXG4gICAgICAgICAgdGhpcy5za2lwQmxvY2tDb21tZW50KCk7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0NzpcbiAgICAgICAgICB0aGlzLnNraXBMaW5lQ29tbWVudCgyKTtcbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrIGxvb3BcbiAgICAgICAgfVxuICAgICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGNoID4gOCAmJiBjaCA8IDE0IHx8IGNoID49IDU3NjAgJiYgbm9uQVNDSUl3aGl0ZXNwYWNlLnRlc3QoU3RyaW5nLmZyb21DaGFyQ29kZShjaCkpKSB7XG4gICAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBicmVhayBsb29wXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gQ2FsbGVkIGF0IHRoZSBlbmQgb2YgZXZlcnkgdG9rZW4uIFNldHMgYGVuZGAsIGB2YWxgLCBhbmRcbiAgLy8gbWFpbnRhaW5zIGBjb250ZXh0YCBhbmQgYGV4cHJBbGxvd2VkYCwgYW5kIHNraXBzIHRoZSBzcGFjZSBhZnRlclxuICAvLyB0aGUgdG9rZW4sIHNvIHRoYXQgdGhlIG5leHQgb25lJ3MgYHN0YXJ0YCB3aWxsIHBvaW50IGF0IHRoZVxuICAvLyByaWdodCBwb3NpdGlvbi5cblxuICBwcC5maW5pc2hUb2tlbiA9IGZ1bmN0aW9uKHR5cGUsIHZhbCkge1xuICAgIHRoaXMuZW5kID0gdGhpcy5wb3M7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5sb2NhdGlvbnMpIHsgdGhpcy5lbmRMb2MgPSB0aGlzLmN1clBvc2l0aW9uKCk7IH1cbiAgICB2YXIgcHJldlR5cGUgPSB0aGlzLnR5cGU7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLnZhbHVlID0gdmFsO1xuXG4gICAgdGhpcy51cGRhdGVDb250ZXh0KHByZXZUeXBlKTtcbiAgfTtcblxuICAvLyAjIyMgVG9rZW4gcmVhZGluZ1xuXG4gIC8vIFRoaXMgaXMgdGhlIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHRvIGZldGNoIHRoZSBuZXh0IHRva2VuLiBJdFxuICAvLyBpcyBzb21ld2hhdCBvYnNjdXJlLCBiZWNhdXNlIGl0IHdvcmtzIGluIGNoYXJhY3RlciBjb2RlcyByYXRoZXJcbiAgLy8gdGhhbiBjaGFyYWN0ZXJzLCBhbmQgYmVjYXVzZSBvcGVyYXRvciBwYXJzaW5nIGhhcyBiZWVuIGlubGluZWRcbiAgLy8gaW50byBpdC5cbiAgLy9cbiAgLy8gQWxsIGluIHRoZSBuYW1lIG9mIHNwZWVkLlxuICAvL1xuICBwcC5yZWFkVG9rZW5fZG90ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKTtcbiAgICBpZiAobmV4dCA+PSA0OCAmJiBuZXh0IDw9IDU3KSB7IHJldHVybiB0aGlzLnJlYWROdW1iZXIodHJ1ZSkgfVxuICAgIHZhciBuZXh0MiA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDIpO1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNiAmJiBuZXh0ID09PSA0NiAmJiBuZXh0MiA9PT0gNDYpIHsgLy8gNDYgPSBkb3QgJy4nXG4gICAgICB0aGlzLnBvcyArPSAzO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5lbGxpcHNpcylcbiAgICB9IGVsc2Uge1xuICAgICAgKyt0aGlzLnBvcztcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuZG90KVxuICAgIH1cbiAgfTtcblxuICBwcC5yZWFkVG9rZW5fc2xhc2ggPSBmdW5jdGlvbigpIHsgLy8gJy8nXG4gICAgdmFyIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKTtcbiAgICBpZiAodGhpcy5leHByQWxsb3dlZCkgeyArK3RoaXMucG9zOyByZXR1cm4gdGhpcy5yZWFkUmVnZXhwKCkgfVxuICAgIGlmIChuZXh0ID09PSA2MSkgeyByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLmFzc2lnbiwgMikgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEuc2xhc2gsIDEpXG4gIH07XG5cbiAgcHAucmVhZFRva2VuX211bHRfbW9kdWxvX2V4cCA9IGZ1bmN0aW9uKGNvZGUpIHsgLy8gJyUqJ1xuICAgIHZhciBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSk7XG4gICAgdmFyIHNpemUgPSAxO1xuICAgIHZhciB0b2tlbnR5cGUgPSBjb2RlID09PSA0MiA/IHR5cGVzJDEuc3RhciA6IHR5cGVzJDEubW9kdWxvO1xuXG4gICAgLy8gZXhwb25lbnRpYXRpb24gb3BlcmF0b3IgKiogYW5kICoqPVxuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNyAmJiBjb2RlID09PSA0MiAmJiBuZXh0ID09PSA0Mikge1xuICAgICAgKytzaXplO1xuICAgICAgdG9rZW50eXBlID0gdHlwZXMkMS5zdGFyc3RhcjtcbiAgICAgIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAyKTtcbiAgICB9XG5cbiAgICBpZiAobmV4dCA9PT0gNjEpIHsgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5hc3NpZ24sIHNpemUgKyAxKSB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoT3AodG9rZW50eXBlLCBzaXplKVxuICB9O1xuXG4gIHBwLnJlYWRUb2tlbl9waXBlX2FtcCA9IGZ1bmN0aW9uKGNvZGUpIHsgLy8gJ3wmJ1xuICAgIHZhciBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSk7XG4gICAgaWYgKG5leHQgPT09IGNvZGUpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTIpIHtcbiAgICAgICAgdmFyIG5leHQyID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMik7XG4gICAgICAgIGlmIChuZXh0MiA9PT0gNjEpIHsgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5hc3NpZ24sIDMpIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE9wKGNvZGUgPT09IDEyNCA/IHR5cGVzJDEubG9naWNhbE9SIDogdHlwZXMkMS5sb2dpY2FsQU5ELCAyKVxuICAgIH1cbiAgICBpZiAobmV4dCA9PT0gNjEpIHsgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5hc3NpZ24sIDIpIH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hPcChjb2RlID09PSAxMjQgPyB0eXBlcyQxLmJpdHdpc2VPUiA6IHR5cGVzJDEuYml0d2lzZUFORCwgMSlcbiAgfTtcblxuICBwcC5yZWFkVG9rZW5fY2FyZXQgPSBmdW5jdGlvbigpIHsgLy8gJ14nXG4gICAgdmFyIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKTtcbiAgICBpZiAobmV4dCA9PT0gNjEpIHsgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5hc3NpZ24sIDIpIH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLmJpdHdpc2VYT1IsIDEpXG4gIH07XG5cbiAgcHAucmVhZFRva2VuX3BsdXNfbWluID0gZnVuY3Rpb24oY29kZSkgeyAvLyAnKy0nXG4gICAgdmFyIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKTtcbiAgICBpZiAobmV4dCA9PT0gY29kZSkge1xuICAgICAgaWYgKG5leHQgPT09IDQ1ICYmICF0aGlzLmluTW9kdWxlICYmIHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDIpID09PSA2MiAmJlxuICAgICAgICAgICh0aGlzLmxhc3RUb2tFbmQgPT09IDAgfHwgbGluZUJyZWFrLnRlc3QodGhpcy5pbnB1dC5zbGljZSh0aGlzLmxhc3RUb2tFbmQsIHRoaXMucG9zKSkpKSB7XG4gICAgICAgIC8vIEEgYC0tPmAgbGluZSBjb21tZW50XG4gICAgICAgIHRoaXMuc2tpcExpbmVDb21tZW50KDMpO1xuICAgICAgICB0aGlzLnNraXBTcGFjZSgpO1xuICAgICAgICByZXR1cm4gdGhpcy5uZXh0VG9rZW4oKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5pbmNEZWMsIDIpXG4gICAgfVxuICAgIGlmIChuZXh0ID09PSA2MSkgeyByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLmFzc2lnbiwgMikgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEucGx1c01pbiwgMSlcbiAgfTtcblxuICBwcC5yZWFkVG9rZW5fbHRfZ3QgPSBmdW5jdGlvbihjb2RlKSB7IC8vICc8PidcbiAgICB2YXIgbmV4dCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDEpO1xuICAgIHZhciBzaXplID0gMTtcbiAgICBpZiAobmV4dCA9PT0gY29kZSkge1xuICAgICAgc2l6ZSA9IGNvZGUgPT09IDYyICYmIHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDIpID09PSA2MiA/IDMgOiAyO1xuICAgICAgaWYgKHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIHNpemUpID09PSA2MSkgeyByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLmFzc2lnbiwgc2l6ZSArIDEpIH1cbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEuYml0U2hpZnQsIHNpemUpXG4gICAgfVxuICAgIGlmIChuZXh0ID09PSAzMyAmJiBjb2RlID09PSA2MCAmJiAhdGhpcy5pbk1vZHVsZSAmJiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAyKSA9PT0gNDUgJiZcbiAgICAgICAgdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMykgPT09IDQ1KSB7XG4gICAgICAvLyBgPCEtLWAsIGFuIFhNTC1zdHlsZSBjb21tZW50IHRoYXQgc2hvdWxkIGJlIGludGVycHJldGVkIGFzIGEgbGluZSBjb21tZW50XG4gICAgICB0aGlzLnNraXBMaW5lQ29tbWVudCg0KTtcbiAgICAgIHRoaXMuc2tpcFNwYWNlKCk7XG4gICAgICByZXR1cm4gdGhpcy5uZXh0VG9rZW4oKVxuICAgIH1cbiAgICBpZiAobmV4dCA9PT0gNjEpIHsgc2l6ZSA9IDI7IH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLnJlbGF0aW9uYWwsIHNpemUpXG4gIH07XG5cbiAgcHAucmVhZFRva2VuX2VxX2V4Y2wgPSBmdW5jdGlvbihjb2RlKSB7IC8vICc9ISdcbiAgICB2YXIgbmV4dCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDEpO1xuICAgIGlmIChuZXh0ID09PSA2MSkgeyByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLmVxdWFsaXR5LCB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAyKSA9PT0gNjEgPyAzIDogMikgfVxuICAgIGlmIChjb2RlID09PSA2MSAmJiBuZXh0ID09PSA2MiAmJiB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNikgeyAvLyAnPT4nXG4gICAgICB0aGlzLnBvcyArPSAyO1xuICAgICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5hcnJvdylcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoT3AoY29kZSA9PT0gNjEgPyB0eXBlcyQxLmVxIDogdHlwZXMkMS5wcmVmaXgsIDEpXG4gIH07XG5cbiAgcHAucmVhZFRva2VuX3F1ZXN0aW9uID0gZnVuY3Rpb24oKSB7IC8vICc/J1xuICAgIHZhciBlY21hVmVyc2lvbiA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbjtcbiAgICBpZiAoZWNtYVZlcnNpb24gPj0gMTEpIHtcbiAgICAgIHZhciBuZXh0ID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMSk7XG4gICAgICBpZiAobmV4dCA9PT0gNDYpIHtcbiAgICAgICAgdmFyIG5leHQyID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMik7XG4gICAgICAgIGlmIChuZXh0MiA8IDQ4IHx8IG5leHQyID4gNTcpIHsgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5xdWVzdGlvbkRvdCwgMikgfVxuICAgICAgfVxuICAgICAgaWYgKG5leHQgPT09IDYzKSB7XG4gICAgICAgIGlmIChlY21hVmVyc2lvbiA+PSAxMikge1xuICAgICAgICAgIHZhciBuZXh0MiQxID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zICsgMik7XG4gICAgICAgICAgaWYgKG5leHQyJDEgPT09IDYxKSB7IHJldHVybiB0aGlzLmZpbmlzaE9wKHR5cGVzJDEuYXNzaWduLCAzKSB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5jb2FsZXNjZSwgMilcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoT3AodHlwZXMkMS5xdWVzdGlvbiwgMSlcbiAgfTtcblxuICBwcC5yZWFkVG9rZW5fbnVtYmVyU2lnbiA9IGZ1bmN0aW9uKCkgeyAvLyAnIydcbiAgICB2YXIgZWNtYVZlcnNpb24gPSB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb247XG4gICAgdmFyIGNvZGUgPSAzNTsgLy8gJyMnXG4gICAgaWYgKGVjbWFWZXJzaW9uID49IDEzKSB7XG4gICAgICArK3RoaXMucG9zO1xuICAgICAgY29kZSA9IHRoaXMuZnVsbENoYXJDb2RlQXRQb3MoKTtcbiAgICAgIGlmIChpc0lkZW50aWZpZXJTdGFydChjb2RlLCB0cnVlKSB8fCBjb2RlID09PSA5MiAvKiAnXFwnICovKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEucHJpdmF0ZUlkLCB0aGlzLnJlYWRXb3JkMSgpKVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMucmFpc2UodGhpcy5wb3MsIFwiVW5leHBlY3RlZCBjaGFyYWN0ZXIgJ1wiICsgY29kZVBvaW50VG9TdHJpbmcoY29kZSkgKyBcIidcIik7XG4gIH07XG5cbiAgcHAuZ2V0VG9rZW5Gcm9tQ29kZSA9IGZ1bmN0aW9uKGNvZGUpIHtcbiAgICBzd2l0Y2ggKGNvZGUpIHtcbiAgICAvLyBUaGUgaW50ZXJwcmV0YXRpb24gb2YgYSBkb3QgZGVwZW5kcyBvbiB3aGV0aGVyIGl0IGlzIGZvbGxvd2VkXG4gICAgLy8gYnkgYSBkaWdpdCBvciBhbm90aGVyIHR3byBkb3RzLlxuICAgIGNhc2UgNDY6IC8vICcuJ1xuICAgICAgcmV0dXJuIHRoaXMucmVhZFRva2VuX2RvdCgpXG5cbiAgICAvLyBQdW5jdHVhdGlvbiB0b2tlbnMuXG4gICAgY2FzZSA0MDogKyt0aGlzLnBvczsgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5wYXJlbkwpXG4gICAgY2FzZSA0MTogKyt0aGlzLnBvczsgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5wYXJlblIpXG4gICAgY2FzZSA1OTogKyt0aGlzLnBvczsgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5zZW1pKVxuICAgIGNhc2UgNDQ6ICsrdGhpcy5wb3M7IHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuY29tbWEpXG4gICAgY2FzZSA5MTogKyt0aGlzLnBvczsgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5icmFja2V0TClcbiAgICBjYXNlIDkzOiArK3RoaXMucG9zOyByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLmJyYWNrZXRSKVxuICAgIGNhc2UgMTIzOiArK3RoaXMucG9zOyByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLmJyYWNlTClcbiAgICBjYXNlIDEyNTogKyt0aGlzLnBvczsgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5icmFjZVIpXG4gICAgY2FzZSA1ODogKyt0aGlzLnBvczsgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5jb2xvbilcblxuICAgIGNhc2UgOTY6IC8vICdgJ1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA8IDYpIHsgYnJlYWsgfVxuICAgICAgKyt0aGlzLnBvcztcbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuYmFja1F1b3RlKVxuXG4gICAgY2FzZSA0ODogLy8gJzAnXG4gICAgICB2YXIgbmV4dCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyArIDEpO1xuICAgICAgaWYgKG5leHQgPT09IDEyMCB8fCBuZXh0ID09PSA4OCkgeyByZXR1cm4gdGhpcy5yZWFkUmFkaXhOdW1iZXIoMTYpIH0gLy8gJzB4JywgJzBYJyAtIGhleCBudW1iZXJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gNikge1xuICAgICAgICBpZiAobmV4dCA9PT0gMTExIHx8IG5leHQgPT09IDc5KSB7IHJldHVybiB0aGlzLnJlYWRSYWRpeE51bWJlcig4KSB9IC8vICcwbycsICcwTycgLSBvY3RhbCBudW1iZXJcbiAgICAgICAgaWYgKG5leHQgPT09IDk4IHx8IG5leHQgPT09IDY2KSB7IHJldHVybiB0aGlzLnJlYWRSYWRpeE51bWJlcigyKSB9IC8vICcwYicsICcwQicgLSBiaW5hcnkgbnVtYmVyXG4gICAgICB9XG5cbiAgICAvLyBBbnl0aGluZyBlbHNlIGJlZ2lubmluZyB3aXRoIGEgZGlnaXQgaXMgYW4gaW50ZWdlciwgb2N0YWxcbiAgICAvLyBudW1iZXIsIG9yIGZsb2F0LlxuICAgIGNhc2UgNDk6IGNhc2UgNTA6IGNhc2UgNTE6IGNhc2UgNTI6IGNhc2UgNTM6IGNhc2UgNTQ6IGNhc2UgNTU6IGNhc2UgNTY6IGNhc2UgNTc6IC8vIDEtOVxuICAgICAgcmV0dXJuIHRoaXMucmVhZE51bWJlcihmYWxzZSlcblxuICAgIC8vIFF1b3RlcyBwcm9kdWNlIHN0cmluZ3MuXG4gICAgY2FzZSAzNDogY2FzZSAzOTogLy8gJ1wiJywgXCInXCJcbiAgICAgIHJldHVybiB0aGlzLnJlYWRTdHJpbmcoY29kZSlcblxuICAgIC8vIE9wZXJhdG9ycyBhcmUgcGFyc2VkIGlubGluZSBpbiB0aW55IHN0YXRlIG1hY2hpbmVzLiAnPScgKDYxKSBpc1xuICAgIC8vIG9mdGVuIHJlZmVycmVkIHRvLiBgZmluaXNoT3BgIHNpbXBseSBza2lwcyB0aGUgYW1vdW50IG9mXG4gICAgLy8gY2hhcmFjdGVycyBpdCBpcyBnaXZlbiBhcyBzZWNvbmQgYXJndW1lbnQsIGFuZCByZXR1cm5zIGEgdG9rZW5cbiAgICAvLyBvZiB0aGUgdHlwZSBnaXZlbiBieSBpdHMgZmlyc3QgYXJndW1lbnQuXG4gICAgY2FzZSA0NzogLy8gJy8nXG4gICAgICByZXR1cm4gdGhpcy5yZWFkVG9rZW5fc2xhc2goKVxuXG4gICAgY2FzZSAzNzogY2FzZSA0MjogLy8gJyUqJ1xuICAgICAgcmV0dXJuIHRoaXMucmVhZFRva2VuX211bHRfbW9kdWxvX2V4cChjb2RlKVxuXG4gICAgY2FzZSAxMjQ6IGNhc2UgMzg6IC8vICd8JidcbiAgICAgIHJldHVybiB0aGlzLnJlYWRUb2tlbl9waXBlX2FtcChjb2RlKVxuXG4gICAgY2FzZSA5NDogLy8gJ14nXG4gICAgICByZXR1cm4gdGhpcy5yZWFkVG9rZW5fY2FyZXQoKVxuXG4gICAgY2FzZSA0MzogY2FzZSA0NTogLy8gJystJ1xuICAgICAgcmV0dXJuIHRoaXMucmVhZFRva2VuX3BsdXNfbWluKGNvZGUpXG5cbiAgICBjYXNlIDYwOiBjYXNlIDYyOiAvLyAnPD4nXG4gICAgICByZXR1cm4gdGhpcy5yZWFkVG9rZW5fbHRfZ3QoY29kZSlcblxuICAgIGNhc2UgNjE6IGNhc2UgMzM6IC8vICc9ISdcbiAgICAgIHJldHVybiB0aGlzLnJlYWRUb2tlbl9lcV9leGNsKGNvZGUpXG5cbiAgICBjYXNlIDYzOiAvLyAnPydcbiAgICAgIHJldHVybiB0aGlzLnJlYWRUb2tlbl9xdWVzdGlvbigpXG5cbiAgICBjYXNlIDEyNjogLy8gJ34nXG4gICAgICByZXR1cm4gdGhpcy5maW5pc2hPcCh0eXBlcyQxLnByZWZpeCwgMSlcblxuICAgIGNhc2UgMzU6IC8vICcjJ1xuICAgICAgcmV0dXJuIHRoaXMucmVhZFRva2VuX251bWJlclNpZ24oKVxuICAgIH1cblxuICAgIHRoaXMucmFpc2UodGhpcy5wb3MsIFwiVW5leHBlY3RlZCBjaGFyYWN0ZXIgJ1wiICsgY29kZVBvaW50VG9TdHJpbmcoY29kZSkgKyBcIidcIik7XG4gIH07XG5cbiAgcHAuZmluaXNoT3AgPSBmdW5jdGlvbih0eXBlLCBzaXplKSB7XG4gICAgdmFyIHN0ciA9IHRoaXMuaW5wdXQuc2xpY2UodGhpcy5wb3MsIHRoaXMucG9zICsgc2l6ZSk7XG4gICAgdGhpcy5wb3MgKz0gc2l6ZTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlLCBzdHIpXG4gIH07XG5cbiAgcHAucmVhZFJlZ2V4cCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBlc2NhcGVkLCBpbkNsYXNzLCBzdGFydCA9IHRoaXMucG9zO1xuICAgIGZvciAoOzspIHtcbiAgICAgIGlmICh0aGlzLnBvcyA+PSB0aGlzLmlucHV0Lmxlbmd0aCkgeyB0aGlzLnJhaXNlKHN0YXJ0LCBcIlVudGVybWluYXRlZCByZWd1bGFyIGV4cHJlc3Npb25cIik7IH1cbiAgICAgIHZhciBjaCA9IHRoaXMuaW5wdXQuY2hhckF0KHRoaXMucG9zKTtcbiAgICAgIGlmIChsaW5lQnJlYWsudGVzdChjaCkpIHsgdGhpcy5yYWlzZShzdGFydCwgXCJVbnRlcm1pbmF0ZWQgcmVndWxhciBleHByZXNzaW9uXCIpOyB9XG4gICAgICBpZiAoIWVzY2FwZWQpIHtcbiAgICAgICAgaWYgKGNoID09PSBcIltcIikgeyBpbkNsYXNzID0gdHJ1ZTsgfVxuICAgICAgICBlbHNlIGlmIChjaCA9PT0gXCJdXCIgJiYgaW5DbGFzcykgeyBpbkNsYXNzID0gZmFsc2U7IH1cbiAgICAgICAgZWxzZSBpZiAoY2ggPT09IFwiL1wiICYmICFpbkNsYXNzKSB7IGJyZWFrIH1cbiAgICAgICAgZXNjYXBlZCA9IGNoID09PSBcIlxcXFxcIjtcbiAgICAgIH0gZWxzZSB7IGVzY2FwZWQgPSBmYWxzZTsgfVxuICAgICAgKyt0aGlzLnBvcztcbiAgICB9XG4gICAgdmFyIHBhdHRlcm4gPSB0aGlzLmlucHV0LnNsaWNlKHN0YXJ0LCB0aGlzLnBvcyk7XG4gICAgKyt0aGlzLnBvcztcbiAgICB2YXIgZmxhZ3NTdGFydCA9IHRoaXMucG9zO1xuICAgIHZhciBmbGFncyA9IHRoaXMucmVhZFdvcmQxKCk7XG4gICAgaWYgKHRoaXMuY29udGFpbnNFc2MpIHsgdGhpcy51bmV4cGVjdGVkKGZsYWdzU3RhcnQpOyB9XG5cbiAgICAvLyBWYWxpZGF0ZSBwYXR0ZXJuXG4gICAgdmFyIHN0YXRlID0gdGhpcy5yZWdleHBTdGF0ZSB8fCAodGhpcy5yZWdleHBTdGF0ZSA9IG5ldyBSZWdFeHBWYWxpZGF0aW9uU3RhdGUodGhpcykpO1xuICAgIHN0YXRlLnJlc2V0KHN0YXJ0LCBwYXR0ZXJuLCBmbGFncyk7XG4gICAgdGhpcy52YWxpZGF0ZVJlZ0V4cEZsYWdzKHN0YXRlKTtcbiAgICB0aGlzLnZhbGlkYXRlUmVnRXhwUGF0dGVybihzdGF0ZSk7XG5cbiAgICAvLyBDcmVhdGUgTGl0ZXJhbCN2YWx1ZSBwcm9wZXJ0eSB2YWx1ZS5cbiAgICB2YXIgdmFsdWUgPSBudWxsO1xuICAgIHRyeSB7XG4gICAgICB2YWx1ZSA9IG5ldyBSZWdFeHAocGF0dGVybiwgZmxhZ3MpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIEVTVHJlZSByZXF1aXJlcyBudWxsIGlmIGl0IGZhaWxlZCB0byBpbnN0YW50aWF0ZSBSZWdFeHAgb2JqZWN0LlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2VzdHJlZS9lc3RyZWUvYmxvYi9hMjcwMDNhZGY0ZmQ3YmZhZDQ0ZGU5Y2VmMzcyYTJlYWNkNTI3YjFjL2VzNS5tZCNyZWdleHBsaXRlcmFsXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5yZWdleHAsIHtwYXR0ZXJuOiBwYXR0ZXJuLCBmbGFnczogZmxhZ3MsIHZhbHVlOiB2YWx1ZX0pXG4gIH07XG5cbiAgLy8gUmVhZCBhbiBpbnRlZ2VyIGluIHRoZSBnaXZlbiByYWRpeC4gUmV0dXJuIG51bGwgaWYgemVybyBkaWdpdHNcbiAgLy8gd2VyZSByZWFkLCB0aGUgaW50ZWdlciB2YWx1ZSBvdGhlcndpc2UuIFdoZW4gYGxlbmAgaXMgZ2l2ZW4sIHRoaXNcbiAgLy8gd2lsbCByZXR1cm4gYG51bGxgIHVubGVzcyB0aGUgaW50ZWdlciBoYXMgZXhhY3RseSBgbGVuYCBkaWdpdHMuXG5cbiAgcHAucmVhZEludCA9IGZ1bmN0aW9uKHJhZGl4LCBsZW4sIG1heWJlTGVnYWN5T2N0YWxOdW1lcmljTGl0ZXJhbCkge1xuICAgIC8vIGBsZW5gIGlzIHVzZWQgZm9yIGNoYXJhY3RlciBlc2NhcGUgc2VxdWVuY2VzLiBJbiB0aGF0IGNhc2UsIGRpc2FsbG93IHNlcGFyYXRvcnMuXG4gICAgdmFyIGFsbG93U2VwYXJhdG9ycyA9IHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSAxMiAmJiBsZW4gPT09IHVuZGVmaW5lZDtcblxuICAgIC8vIGBtYXliZUxlZ2FjeU9jdGFsTnVtZXJpY0xpdGVyYWxgIGlzIHRydWUgaWYgaXQgZG9lc24ndCBoYXZlIHByZWZpeCAoMHgsMG8sMGIpXG4gICAgLy8gYW5kIGlzbid0IGZyYWN0aW9uIHBhcnQgbm9yIGV4cG9uZW50IHBhcnQuIEluIHRoYXQgY2FzZSwgaWYgdGhlIGZpcnN0IGRpZ2l0XG4gICAgLy8gaXMgemVybyB0aGVuIGRpc2FsbG93IHNlcGFyYXRvcnMuXG4gICAgdmFyIGlzTGVnYWN5T2N0YWxOdW1lcmljTGl0ZXJhbCA9IG1heWJlTGVnYWN5T2N0YWxOdW1lcmljTGl0ZXJhbCAmJiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpID09PSA0ODtcblxuICAgIHZhciBzdGFydCA9IHRoaXMucG9zLCB0b3RhbCA9IDAsIGxhc3RDb2RlID0gMDtcbiAgICBmb3IgKHZhciBpID0gMCwgZSA9IGxlbiA9PSBudWxsID8gSW5maW5pdHkgOiBsZW47IGkgPCBlOyArK2ksICsrdGhpcy5wb3MpIHtcbiAgICAgIHZhciBjb2RlID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKSwgdmFsID0gKHZvaWQgMCk7XG5cbiAgICAgIGlmIChhbGxvd1NlcGFyYXRvcnMgJiYgY29kZSA9PT0gOTUpIHtcbiAgICAgICAgaWYgKGlzTGVnYWN5T2N0YWxOdW1lcmljTGl0ZXJhbCkgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5wb3MsIFwiTnVtZXJpYyBzZXBhcmF0b3IgaXMgbm90IGFsbG93ZWQgaW4gbGVnYWN5IG9jdGFsIG51bWVyaWMgbGl0ZXJhbHNcIik7IH1cbiAgICAgICAgaWYgKGxhc3RDb2RlID09PSA5NSkgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5wb3MsIFwiTnVtZXJpYyBzZXBhcmF0b3IgbXVzdCBiZSBleGFjdGx5IG9uZSB1bmRlcnNjb3JlXCIpOyB9XG4gICAgICAgIGlmIChpID09PSAwKSB7IHRoaXMucmFpc2VSZWNvdmVyYWJsZSh0aGlzLnBvcywgXCJOdW1lcmljIHNlcGFyYXRvciBpcyBub3QgYWxsb3dlZCBhdCB0aGUgZmlyc3Qgb2YgZGlnaXRzXCIpOyB9XG4gICAgICAgIGxhc3RDb2RlID0gY29kZTtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKGNvZGUgPj0gOTcpIHsgdmFsID0gY29kZSAtIDk3ICsgMTA7IH0gLy8gYVxuICAgICAgZWxzZSBpZiAoY29kZSA+PSA2NSkgeyB2YWwgPSBjb2RlIC0gNjUgKyAxMDsgfSAvLyBBXG4gICAgICBlbHNlIGlmIChjb2RlID49IDQ4ICYmIGNvZGUgPD0gNTcpIHsgdmFsID0gY29kZSAtIDQ4OyB9IC8vIDAtOVxuICAgICAgZWxzZSB7IHZhbCA9IEluZmluaXR5OyB9XG4gICAgICBpZiAodmFsID49IHJhZGl4KSB7IGJyZWFrIH1cbiAgICAgIGxhc3RDb2RlID0gY29kZTtcbiAgICAgIHRvdGFsID0gdG90YWwgKiByYWRpeCArIHZhbDtcbiAgICB9XG5cbiAgICBpZiAoYWxsb3dTZXBhcmF0b3JzICYmIGxhc3RDb2RlID09PSA5NSkgeyB0aGlzLnJhaXNlUmVjb3ZlcmFibGUodGhpcy5wb3MgLSAxLCBcIk51bWVyaWMgc2VwYXJhdG9yIGlzIG5vdCBhbGxvd2VkIGF0IHRoZSBsYXN0IG9mIGRpZ2l0c1wiKTsgfVxuICAgIGlmICh0aGlzLnBvcyA9PT0gc3RhcnQgfHwgbGVuICE9IG51bGwgJiYgdGhpcy5wb3MgLSBzdGFydCAhPT0gbGVuKSB7IHJldHVybiBudWxsIH1cblxuICAgIHJldHVybiB0b3RhbFxuICB9O1xuXG4gIGZ1bmN0aW9uIHN0cmluZ1RvTnVtYmVyKHN0ciwgaXNMZWdhY3lPY3RhbE51bWVyaWNMaXRlcmFsKSB7XG4gICAgaWYgKGlzTGVnYWN5T2N0YWxOdW1lcmljTGl0ZXJhbCkge1xuICAgICAgcmV0dXJuIHBhcnNlSW50KHN0ciwgOClcbiAgICB9XG5cbiAgICAvLyBgcGFyc2VGbG9hdCh2YWx1ZSlgIHN0b3BzIHBhcnNpbmcgYXQgdGhlIGZpcnN0IG51bWVyaWMgc2VwYXJhdG9yIHRoZW4gcmV0dXJucyBhIHdyb25nIHZhbHVlLlxuICAgIHJldHVybiBwYXJzZUZsb2F0KHN0ci5yZXBsYWNlKC9fL2csIFwiXCIpKVxuICB9XG5cbiAgZnVuY3Rpb24gc3RyaW5nVG9CaWdJbnQoc3RyKSB7XG4gICAgaWYgKHR5cGVvZiBCaWdJbnQgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICAvLyBgQmlnSW50KHZhbHVlKWAgdGhyb3dzIHN5bnRheCBlcnJvciBpZiB0aGUgc3RyaW5nIGNvbnRhaW5zIG51bWVyaWMgc2VwYXJhdG9ycy5cbiAgICByZXR1cm4gQmlnSW50KHN0ci5yZXBsYWNlKC9fL2csIFwiXCIpKVxuICB9XG5cbiAgcHAucmVhZFJhZGl4TnVtYmVyID0gZnVuY3Rpb24ocmFkaXgpIHtcbiAgICB2YXIgc3RhcnQgPSB0aGlzLnBvcztcbiAgICB0aGlzLnBvcyArPSAyOyAvLyAweFxuICAgIHZhciB2YWwgPSB0aGlzLnJlYWRJbnQocmFkaXgpO1xuICAgIGlmICh2YWwgPT0gbnVsbCkgeyB0aGlzLnJhaXNlKHRoaXMuc3RhcnQgKyAyLCBcIkV4cGVjdGVkIG51bWJlciBpbiByYWRpeCBcIiArIHJhZGl4KTsgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTEgJiYgdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKSA9PT0gMTEwKSB7XG4gICAgICB2YWwgPSBzdHJpbmdUb0JpZ0ludCh0aGlzLmlucHV0LnNsaWNlKHN0YXJ0LCB0aGlzLnBvcykpO1xuICAgICAgKyt0aGlzLnBvcztcbiAgICB9IGVsc2UgaWYgKGlzSWRlbnRpZmllclN0YXJ0KHRoaXMuZnVsbENoYXJDb2RlQXRQb3MoKSkpIHsgdGhpcy5yYWlzZSh0aGlzLnBvcywgXCJJZGVudGlmaWVyIGRpcmVjdGx5IGFmdGVyIG51bWJlclwiKTsgfVxuICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEubnVtLCB2YWwpXG4gIH07XG5cbiAgLy8gUmVhZCBhbiBpbnRlZ2VyLCBvY3RhbCBpbnRlZ2VyLCBvciBmbG9hdGluZy1wb2ludCBudW1iZXIuXG5cbiAgcHAucmVhZE51bWJlciA9IGZ1bmN0aW9uKHN0YXJ0c1dpdGhEb3QpIHtcbiAgICB2YXIgc3RhcnQgPSB0aGlzLnBvcztcbiAgICBpZiAoIXN0YXJ0c1dpdGhEb3QgJiYgdGhpcy5yZWFkSW50KDEwLCB1bmRlZmluZWQsIHRydWUpID09PSBudWxsKSB7IHRoaXMucmFpc2Uoc3RhcnQsIFwiSW52YWxpZCBudW1iZXJcIik7IH1cbiAgICB2YXIgb2N0YWwgPSB0aGlzLnBvcyAtIHN0YXJ0ID49IDIgJiYgdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHN0YXJ0KSA9PT0gNDg7XG4gICAgaWYgKG9jdGFsICYmIHRoaXMuc3RyaWN0KSB7IHRoaXMucmFpc2Uoc3RhcnQsIFwiSW52YWxpZCBudW1iZXJcIik7IH1cbiAgICB2YXIgbmV4dCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyk7XG4gICAgaWYgKCFvY3RhbCAmJiAhc3RhcnRzV2l0aERvdCAmJiB0aGlzLm9wdGlvbnMuZWNtYVZlcnNpb24gPj0gMTEgJiYgbmV4dCA9PT0gMTEwKSB7XG4gICAgICB2YXIgdmFsJDEgPSBzdHJpbmdUb0JpZ0ludCh0aGlzLmlucHV0LnNsaWNlKHN0YXJ0LCB0aGlzLnBvcykpO1xuICAgICAgKyt0aGlzLnBvcztcbiAgICAgIGlmIChpc0lkZW50aWZpZXJTdGFydCh0aGlzLmZ1bGxDaGFyQ29kZUF0UG9zKCkpKSB7IHRoaXMucmFpc2UodGhpcy5wb3MsIFwiSWRlbnRpZmllciBkaXJlY3RseSBhZnRlciBudW1iZXJcIik7IH1cbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEubnVtLCB2YWwkMSlcbiAgICB9XG4gICAgaWYgKG9jdGFsICYmIC9bODldLy50ZXN0KHRoaXMuaW5wdXQuc2xpY2Uoc3RhcnQsIHRoaXMucG9zKSkpIHsgb2N0YWwgPSBmYWxzZTsgfVxuICAgIGlmIChuZXh0ID09PSA0NiAmJiAhb2N0YWwpIHsgLy8gJy4nXG4gICAgICArK3RoaXMucG9zO1xuICAgICAgdGhpcy5yZWFkSW50KDEwKTtcbiAgICAgIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpO1xuICAgIH1cbiAgICBpZiAoKG5leHQgPT09IDY5IHx8IG5leHQgPT09IDEwMSkgJiYgIW9jdGFsKSB7IC8vICdlRSdcbiAgICAgIG5leHQgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQoKyt0aGlzLnBvcyk7XG4gICAgICBpZiAobmV4dCA9PT0gNDMgfHwgbmV4dCA9PT0gNDUpIHsgKyt0aGlzLnBvczsgfSAvLyAnKy0nXG4gICAgICBpZiAodGhpcy5yZWFkSW50KDEwKSA9PT0gbnVsbCkgeyB0aGlzLnJhaXNlKHN0YXJ0LCBcIkludmFsaWQgbnVtYmVyXCIpOyB9XG4gICAgfVxuICAgIGlmIChpc0lkZW50aWZpZXJTdGFydCh0aGlzLmZ1bGxDaGFyQ29kZUF0UG9zKCkpKSB7IHRoaXMucmFpc2UodGhpcy5wb3MsIFwiSWRlbnRpZmllciBkaXJlY3RseSBhZnRlciBudW1iZXJcIik7IH1cblxuICAgIHZhciB2YWwgPSBzdHJpbmdUb051bWJlcih0aGlzLmlucHV0LnNsaWNlKHN0YXJ0LCB0aGlzLnBvcyksIG9jdGFsKTtcbiAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLm51bSwgdmFsKVxuICB9O1xuXG4gIC8vIFJlYWQgYSBzdHJpbmcgdmFsdWUsIGludGVycHJldGluZyBiYWNrc2xhc2gtZXNjYXBlcy5cblxuICBwcC5yZWFkQ29kZVBvaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNoID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKSwgY29kZTtcblxuICAgIGlmIChjaCA9PT0gMTIzKSB7IC8vICd7J1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA8IDYpIHsgdGhpcy51bmV4cGVjdGVkKCk7IH1cbiAgICAgIHZhciBjb2RlUG9zID0gKyt0aGlzLnBvcztcbiAgICAgIGNvZGUgPSB0aGlzLnJlYWRIZXhDaGFyKHRoaXMuaW5wdXQuaW5kZXhPZihcIn1cIiwgdGhpcy5wb3MpIC0gdGhpcy5wb3MpO1xuICAgICAgKyt0aGlzLnBvcztcbiAgICAgIGlmIChjb2RlID4gMHgxMEZGRkYpIHsgdGhpcy5pbnZhbGlkU3RyaW5nVG9rZW4oY29kZVBvcywgXCJDb2RlIHBvaW50IG91dCBvZiBib3VuZHNcIik7IH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29kZSA9IHRoaXMucmVhZEhleENoYXIoNCk7XG4gICAgfVxuICAgIHJldHVybiBjb2RlXG4gIH07XG5cbiAgcHAucmVhZFN0cmluZyA9IGZ1bmN0aW9uKHF1b3RlKSB7XG4gICAgdmFyIG91dCA9IFwiXCIsIGNodW5rU3RhcnQgPSArK3RoaXMucG9zO1xuICAgIGZvciAoOzspIHtcbiAgICAgIGlmICh0aGlzLnBvcyA+PSB0aGlzLmlucHV0Lmxlbmd0aCkgeyB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsIFwiVW50ZXJtaW5hdGVkIHN0cmluZyBjb25zdGFudFwiKTsgfVxuICAgICAgdmFyIGNoID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMucG9zKTtcbiAgICAgIGlmIChjaCA9PT0gcXVvdGUpIHsgYnJlYWsgfVxuICAgICAgaWYgKGNoID09PSA5MikgeyAvLyAnXFwnXG4gICAgICAgIG91dCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKTtcbiAgICAgICAgb3V0ICs9IHRoaXMucmVhZEVzY2FwZWRDaGFyKGZhbHNlKTtcbiAgICAgICAgY2h1bmtTdGFydCA9IHRoaXMucG9zO1xuICAgICAgfSBlbHNlIGlmIChjaCA9PT0gMHgyMDI4IHx8IGNoID09PSAweDIwMjkpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA8IDEwKSB7IHRoaXMucmFpc2UodGhpcy5zdGFydCwgXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGNvbnN0YW50XCIpOyB9XG4gICAgICAgICsrdGhpcy5wb3M7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb25zKSB7XG4gICAgICAgICAgdGhpcy5jdXJMaW5lKys7XG4gICAgICAgICAgdGhpcy5saW5lU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzTmV3TGluZShjaCkpIHsgdGhpcy5yYWlzZSh0aGlzLnN0YXJ0LCBcIlVudGVybWluYXRlZCBzdHJpbmcgY29uc3RhbnRcIik7IH1cbiAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgIH1cbiAgICB9XG4gICAgb3V0ICs9IHRoaXMuaW5wdXQuc2xpY2UoY2h1bmtTdGFydCwgdGhpcy5wb3MrKyk7XG4gICAgcmV0dXJuIHRoaXMuZmluaXNoVG9rZW4odHlwZXMkMS5zdHJpbmcsIG91dClcbiAgfTtcblxuICAvLyBSZWFkcyB0ZW1wbGF0ZSBzdHJpbmcgdG9rZW5zLlxuXG4gIHZhciBJTlZBTElEX1RFTVBMQVRFX0VTQ0FQRV9FUlJPUiA9IHt9O1xuXG4gIHBwLnRyeVJlYWRUZW1wbGF0ZVRva2VuID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5pblRlbXBsYXRlRWxlbWVudCA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucmVhZFRtcGxUb2tlbigpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVyciA9PT0gSU5WQUxJRF9URU1QTEFURV9FU0NBUEVfRVJST1IpIHtcbiAgICAgICAgdGhpcy5yZWFkSW52YWxpZFRlbXBsYXRlVG9rZW4oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVyclxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuaW5UZW1wbGF0ZUVsZW1lbnQgPSBmYWxzZTtcbiAgfTtcblxuICBwcC5pbnZhbGlkU3RyaW5nVG9rZW4gPSBmdW5jdGlvbihwb3NpdGlvbiwgbWVzc2FnZSkge1xuICAgIGlmICh0aGlzLmluVGVtcGxhdGVFbGVtZW50ICYmIHRoaXMub3B0aW9ucy5lY21hVmVyc2lvbiA+PSA5KSB7XG4gICAgICB0aHJvdyBJTlZBTElEX1RFTVBMQVRFX0VTQ0FQRV9FUlJPUlxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJhaXNlKHBvc2l0aW9uLCBtZXNzYWdlKTtcbiAgICB9XG4gIH07XG5cbiAgcHAucmVhZFRtcGxUb2tlbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvdXQgPSBcIlwiLCBjaHVua1N0YXJ0ID0gdGhpcy5wb3M7XG4gICAgZm9yICg7Oykge1xuICAgICAgaWYgKHRoaXMucG9zID49IHRoaXMuaW5wdXQubGVuZ3RoKSB7IHRoaXMucmFpc2UodGhpcy5zdGFydCwgXCJVbnRlcm1pbmF0ZWQgdGVtcGxhdGVcIik7IH1cbiAgICAgIHZhciBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyk7XG4gICAgICBpZiAoY2ggPT09IDk2IHx8IGNoID09PSAzNiAmJiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MgKyAxKSA9PT0gMTIzKSB7IC8vICdgJywgJyR7J1xuICAgICAgICBpZiAodGhpcy5wb3MgPT09IHRoaXMuc3RhcnQgJiYgKHRoaXMudHlwZSA9PT0gdHlwZXMkMS50ZW1wbGF0ZSB8fCB0aGlzLnR5cGUgPT09IHR5cGVzJDEuaW52YWxpZFRlbXBsYXRlKSkge1xuICAgICAgICAgIGlmIChjaCA9PT0gMzYpIHtcbiAgICAgICAgICAgIHRoaXMucG9zICs9IDI7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlcyQxLmRvbGxhckJyYWNlTClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuYmFja1F1b3RlKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvdXQgKz0gdGhpcy5pbnB1dC5zbGljZShjaHVua1N0YXJ0LCB0aGlzLnBvcyk7XG4gICAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEudGVtcGxhdGUsIG91dClcbiAgICAgIH1cbiAgICAgIGlmIChjaCA9PT0gOTIpIHsgLy8gJ1xcJ1xuICAgICAgICBvdXQgKz0gdGhpcy5pbnB1dC5zbGljZShjaHVua1N0YXJ0LCB0aGlzLnBvcyk7XG4gICAgICAgIG91dCArPSB0aGlzLnJlYWRFc2NhcGVkQ2hhcih0cnVlKTtcbiAgICAgICAgY2h1bmtTdGFydCA9IHRoaXMucG9zO1xuICAgICAgfSBlbHNlIGlmIChpc05ld0xpbmUoY2gpKSB7XG4gICAgICAgIG91dCArPSB0aGlzLmlucHV0LnNsaWNlKGNodW5rU3RhcnQsIHRoaXMucG9zKTtcbiAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgICAgc3dpdGNoIChjaCkge1xuICAgICAgICBjYXNlIDEzOlxuICAgICAgICAgIGlmICh0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5wb3MpID09PSAxMCkgeyArK3RoaXMucG9zOyB9XG4gICAgICAgIGNhc2UgMTA6XG4gICAgICAgICAgb3V0ICs9IFwiXFxuXCI7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBvdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShjaCk7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmxvY2F0aW9ucykge1xuICAgICAgICAgICsrdGhpcy5jdXJMaW5lO1xuICAgICAgICAgIHRoaXMubGluZVN0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICAgIH1cbiAgICAgICAgY2h1bmtTdGFydCA9IHRoaXMucG9zO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gUmVhZHMgYSB0ZW1wbGF0ZSB0b2tlbiB0byBzZWFyY2ggZm9yIHRoZSBlbmQsIHdpdGhvdXQgdmFsaWRhdGluZyBhbnkgZXNjYXBlIHNlcXVlbmNlc1xuICBwcC5yZWFkSW52YWxpZFRlbXBsYXRlVG9rZW4gPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKDsgdGhpcy5wb3MgPCB0aGlzLmlucHV0Lmxlbmd0aDsgdGhpcy5wb3MrKykge1xuICAgICAgc3dpdGNoICh0aGlzLmlucHV0W3RoaXMucG9zXSkge1xuICAgICAgY2FzZSBcIlxcXFxcIjpcbiAgICAgICAgKyt0aGlzLnBvcztcbiAgICAgICAgYnJlYWtcblxuICAgICAgY2FzZSBcIiRcIjpcbiAgICAgICAgaWYgKHRoaXMuaW5wdXRbdGhpcy5wb3MgKyAxXSAhPT0gXCJ7XCIpIHtcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG5cbiAgICAgIC8vIGZhbGxzIHRocm91Z2hcbiAgICAgIGNhc2UgXCJgXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZpbmlzaFRva2VuKHR5cGVzJDEuaW52YWxpZFRlbXBsYXRlLCB0aGlzLmlucHV0LnNsaWNlKHRoaXMuc3RhcnQsIHRoaXMucG9zKSlcblxuICAgICAgLy8gbm8gZGVmYXVsdFxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnJhaXNlKHRoaXMuc3RhcnQsIFwiVW50ZXJtaW5hdGVkIHRlbXBsYXRlXCIpO1xuICB9O1xuXG4gIC8vIFVzZWQgdG8gcmVhZCBlc2NhcGVkIGNoYXJhY3RlcnNcblxuICBwcC5yZWFkRXNjYXBlZENoYXIgPSBmdW5jdGlvbihpblRlbXBsYXRlKSB7XG4gICAgdmFyIGNoID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KCsrdGhpcy5wb3MpO1xuICAgICsrdGhpcy5wb3M7XG4gICAgc3dpdGNoIChjaCkge1xuICAgIGNhc2UgMTEwOiByZXR1cm4gXCJcXG5cIiAvLyAnbicgLT4gJ1xcbidcbiAgICBjYXNlIDExNDogcmV0dXJuIFwiXFxyXCIgLy8gJ3InIC0+ICdcXHInXG4gICAgY2FzZSAxMjA6IHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMucmVhZEhleENoYXIoMikpIC8vICd4J1xuICAgIGNhc2UgMTE3OiByZXR1cm4gY29kZVBvaW50VG9TdHJpbmcodGhpcy5yZWFkQ29kZVBvaW50KCkpIC8vICd1J1xuICAgIGNhc2UgMTE2OiByZXR1cm4gXCJcXHRcIiAvLyAndCcgLT4gJ1xcdCdcbiAgICBjYXNlIDk4OiByZXR1cm4gXCJcXGJcIiAvLyAnYicgLT4gJ1xcYidcbiAgICBjYXNlIDExODogcmV0dXJuIFwiXFx1MDAwYlwiIC8vICd2JyAtPiAnXFx1MDAwYidcbiAgICBjYXNlIDEwMjogcmV0dXJuIFwiXFxmXCIgLy8gJ2YnIC0+ICdcXGYnXG4gICAgY2FzZSAxMzogaWYgKHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcykgPT09IDEwKSB7ICsrdGhpcy5wb3M7IH0gLy8gJ1xcclxcbidcbiAgICBjYXNlIDEwOiAvLyAnIFxcbidcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb25zKSB7IHRoaXMubGluZVN0YXJ0ID0gdGhpcy5wb3M7ICsrdGhpcy5jdXJMaW5lOyB9XG4gICAgICByZXR1cm4gXCJcIlxuICAgIGNhc2UgNTY6XG4gICAgY2FzZSA1NzpcbiAgICAgIGlmICh0aGlzLnN0cmljdCkge1xuICAgICAgICB0aGlzLmludmFsaWRTdHJpbmdUb2tlbihcbiAgICAgICAgICB0aGlzLnBvcyAtIDEsXG4gICAgICAgICAgXCJJbnZhbGlkIGVzY2FwZSBzZXF1ZW5jZVwiXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoaW5UZW1wbGF0ZSkge1xuICAgICAgICB2YXIgY29kZVBvcyA9IHRoaXMucG9zIC0gMTtcblxuICAgICAgICB0aGlzLmludmFsaWRTdHJpbmdUb2tlbihcbiAgICAgICAgICBjb2RlUG9zLFxuICAgICAgICAgIFwiSW52YWxpZCBlc2NhcGUgc2VxdWVuY2UgaW4gdGVtcGxhdGUgc3RyaW5nXCJcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICBkZWZhdWx0OlxuICAgICAgaWYgKGNoID49IDQ4ICYmIGNoIDw9IDU1KSB7XG4gICAgICAgIHZhciBvY3RhbFN0ciA9IHRoaXMuaW5wdXQuc3Vic3RyKHRoaXMucG9zIC0gMSwgMykubWF0Y2goL15bMC03XSsvKVswXTtcbiAgICAgICAgdmFyIG9jdGFsID0gcGFyc2VJbnQob2N0YWxTdHIsIDgpO1xuICAgICAgICBpZiAob2N0YWwgPiAyNTUpIHtcbiAgICAgICAgICBvY3RhbFN0ciA9IG9jdGFsU3RyLnNsaWNlKDAsIC0xKTtcbiAgICAgICAgICBvY3RhbCA9IHBhcnNlSW50KG9jdGFsU3RyLCA4KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBvcyArPSBvY3RhbFN0ci5sZW5ndGggLSAxO1xuICAgICAgICBjaCA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLnBvcyk7XG4gICAgICAgIGlmICgob2N0YWxTdHIgIT09IFwiMFwiIHx8IGNoID09PSA1NiB8fCBjaCA9PT0gNTcpICYmICh0aGlzLnN0cmljdCB8fCBpblRlbXBsYXRlKSkge1xuICAgICAgICAgIHRoaXMuaW52YWxpZFN0cmluZ1Rva2VuKFxuICAgICAgICAgICAgdGhpcy5wb3MgLSAxIC0gb2N0YWxTdHIubGVuZ3RoLFxuICAgICAgICAgICAgaW5UZW1wbGF0ZVxuICAgICAgICAgICAgICA/IFwiT2N0YWwgbGl0ZXJhbCBpbiB0ZW1wbGF0ZSBzdHJpbmdcIlxuICAgICAgICAgICAgICA6IFwiT2N0YWwgbGl0ZXJhbCBpbiBzdHJpY3QgbW9kZVwiXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShvY3RhbClcbiAgICAgIH1cbiAgICAgIGlmIChpc05ld0xpbmUoY2gpKSB7XG4gICAgICAgIC8vIFVuaWNvZGUgbmV3IGxpbmUgY2hhcmFjdGVycyBhZnRlciBcXCBnZXQgcmVtb3ZlZCBmcm9tIG91dHB1dCBpbiBib3RoXG4gICAgICAgIC8vIHRlbXBsYXRlIGxpdGVyYWxzIGFuZCBzdHJpbmdzXG4gICAgICAgIHJldHVybiBcIlwiXG4gICAgICB9XG4gICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShjaClcbiAgICB9XG4gIH07XG5cbiAgLy8gVXNlZCB0byByZWFkIGNoYXJhY3RlciBlc2NhcGUgc2VxdWVuY2VzICgnXFx4JywgJ1xcdScsICdcXFUnKS5cblxuICBwcC5yZWFkSGV4Q2hhciA9IGZ1bmN0aW9uKGxlbikge1xuICAgIHZhciBjb2RlUG9zID0gdGhpcy5wb3M7XG4gICAgdmFyIG4gPSB0aGlzLnJlYWRJbnQoMTYsIGxlbik7XG4gICAgaWYgKG4gPT09IG51bGwpIHsgdGhpcy5pbnZhbGlkU3RyaW5nVG9rZW4oY29kZVBvcywgXCJCYWQgY2hhcmFjdGVyIGVzY2FwZSBzZXF1ZW5jZVwiKTsgfVxuICAgIHJldHVybiBuXG4gIH07XG5cbiAgLy8gUmVhZCBhbiBpZGVudGlmaWVyLCBhbmQgcmV0dXJuIGl0IGFzIGEgc3RyaW5nLiBTZXRzIGB0aGlzLmNvbnRhaW5zRXNjYFxuICAvLyB0byB3aGV0aGVyIHRoZSB3b3JkIGNvbnRhaW5lZCBhICdcXHUnIGVzY2FwZS5cbiAgLy9cbiAgLy8gSW5jcmVtZW50YWxseSBhZGRzIG9ubHkgZXNjYXBlZCBjaGFycywgYWRkaW5nIG90aGVyIGNodW5rcyBhcy1pc1xuICAvLyBhcyBhIG1pY3JvLW9wdGltaXphdGlvbi5cblxuICBwcC5yZWFkV29yZDEgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNvbnRhaW5zRXNjID0gZmFsc2U7XG4gICAgdmFyIHdvcmQgPSBcIlwiLCBmaXJzdCA9IHRydWUsIGNodW5rU3RhcnQgPSB0aGlzLnBvcztcbiAgICB2YXIgYXN0cmFsID0gdGhpcy5vcHRpb25zLmVjbWFWZXJzaW9uID49IDY7XG4gICAgd2hpbGUgKHRoaXMucG9zIDwgdGhpcy5pbnB1dC5sZW5ndGgpIHtcbiAgICAgIHZhciBjaCA9IHRoaXMuZnVsbENoYXJDb2RlQXRQb3MoKTtcbiAgICAgIGlmIChpc0lkZW50aWZpZXJDaGFyKGNoLCBhc3RyYWwpKSB7XG4gICAgICAgIHRoaXMucG9zICs9IGNoIDw9IDB4ZmZmZiA/IDEgOiAyO1xuICAgICAgfSBlbHNlIGlmIChjaCA9PT0gOTIpIHsgLy8gXCJcXFwiXG4gICAgICAgIHRoaXMuY29udGFpbnNFc2MgPSB0cnVlO1xuICAgICAgICB3b3JkICs9IHRoaXMuaW5wdXQuc2xpY2UoY2h1bmtTdGFydCwgdGhpcy5wb3MpO1xuICAgICAgICB2YXIgZXNjU3RhcnQgPSB0aGlzLnBvcztcbiAgICAgICAgaWYgKHRoaXMuaW5wdXQuY2hhckNvZGVBdCgrK3RoaXMucG9zKSAhPT0gMTE3KSAvLyBcInVcIlxuICAgICAgICAgIHsgdGhpcy5pbnZhbGlkU3RyaW5nVG9rZW4odGhpcy5wb3MsIFwiRXhwZWN0aW5nIFVuaWNvZGUgZXNjYXBlIHNlcXVlbmNlIFxcXFx1WFhYWFwiKTsgfVxuICAgICAgICArK3RoaXMucG9zO1xuICAgICAgICB2YXIgZXNjID0gdGhpcy5yZWFkQ29kZVBvaW50KCk7XG4gICAgICAgIGlmICghKGZpcnN0ID8gaXNJZGVudGlmaWVyU3RhcnQgOiBpc0lkZW50aWZpZXJDaGFyKShlc2MsIGFzdHJhbCkpXG4gICAgICAgICAgeyB0aGlzLmludmFsaWRTdHJpbmdUb2tlbihlc2NTdGFydCwgXCJJbnZhbGlkIFVuaWNvZGUgZXNjYXBlXCIpOyB9XG4gICAgICAgIHdvcmQgKz0gY29kZVBvaW50VG9TdHJpbmcoZXNjKTtcbiAgICAgICAgY2h1bmtTdGFydCA9IHRoaXMucG9zO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB3b3JkICsgdGhpcy5pbnB1dC5zbGljZShjaHVua1N0YXJ0LCB0aGlzLnBvcylcbiAgfTtcblxuICAvLyBSZWFkIGFuIGlkZW50aWZpZXIgb3Iga2V5d29yZCB0b2tlbi4gV2lsbCBjaGVjayBmb3IgcmVzZXJ2ZWRcbiAgLy8gd29yZHMgd2hlbiBuZWNlc3NhcnkuXG5cbiAgcHAucmVhZFdvcmQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgd29yZCA9IHRoaXMucmVhZFdvcmQxKCk7XG4gICAgdmFyIHR5cGUgPSB0eXBlcyQxLm5hbWU7XG4gICAgaWYgKHRoaXMua2V5d29yZHMudGVzdCh3b3JkKSkge1xuICAgICAgdHlwZSA9IGtleXdvcmRzW3dvcmRdO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5maW5pc2hUb2tlbih0eXBlLCB3b3JkKVxuICB9O1xuXG4gIC8vIEFjb3JuIGlzIGEgdGlueSwgZmFzdCBKYXZhU2NyaXB0IHBhcnNlciB3cml0dGVuIGluIEphdmFTY3JpcHQuXG4gIC8vXG4gIC8vIEFjb3JuIHdhcyB3cml0dGVuIGJ5IE1hcmlqbiBIYXZlcmJla2UsIEluZ3ZhciBTdGVwYW55YW4sIGFuZFxuICAvLyB2YXJpb3VzIGNvbnRyaWJ1dG9ycyBhbmQgcmVsZWFzZWQgdW5kZXIgYW4gTUlUIGxpY2Vuc2UuXG4gIC8vXG4gIC8vIEdpdCByZXBvc2l0b3JpZXMgZm9yIEFjb3JuIGFyZSBhdmFpbGFibGUgYXRcbiAgLy9cbiAgLy8gICAgIGh0dHA6Ly9tYXJpam5oYXZlcmJla2UubmwvZ2l0L2Fjb3JuXG4gIC8vICAgICBodHRwczovL2dpdGh1Yi5jb20vYWNvcm5qcy9hY29ybi5naXRcbiAgLy9cbiAgLy8gUGxlYXNlIHVzZSB0aGUgW2dpdGh1YiBidWcgdHJhY2tlcl1bZ2hidF0gdG8gcmVwb3J0IGlzc3Vlcy5cbiAgLy9cbiAgLy8gW2doYnRdOiBodHRwczovL2dpdGh1Yi5jb20vYWNvcm5qcy9hY29ybi9pc3N1ZXNcbiAgLy9cbiAgLy8gW3dhbGtdOiB1dGlsL3dhbGsuanNcblxuXG4gIHZhciB2ZXJzaW9uID0gXCI4LjEwLjBcIjtcblxuICBQYXJzZXIuYWNvcm4gPSB7XG4gICAgUGFyc2VyOiBQYXJzZXIsXG4gICAgdmVyc2lvbjogdmVyc2lvbixcbiAgICBkZWZhdWx0T3B0aW9uczogZGVmYXVsdE9wdGlvbnMsXG4gICAgUG9zaXRpb246IFBvc2l0aW9uLFxuICAgIFNvdXJjZUxvY2F0aW9uOiBTb3VyY2VMb2NhdGlvbixcbiAgICBnZXRMaW5lSW5mbzogZ2V0TGluZUluZm8sXG4gICAgTm9kZTogTm9kZSxcbiAgICBUb2tlblR5cGU6IFRva2VuVHlwZSxcbiAgICB0b2tUeXBlczogdHlwZXMkMSxcbiAgICBrZXl3b3JkVHlwZXM6IGtleXdvcmRzLFxuICAgIFRva0NvbnRleHQ6IFRva0NvbnRleHQsXG4gICAgdG9rQ29udGV4dHM6IHR5cGVzLFxuICAgIGlzSWRlbnRpZmllckNoYXI6IGlzSWRlbnRpZmllckNoYXIsXG4gICAgaXNJZGVudGlmaWVyU3RhcnQ6IGlzSWRlbnRpZmllclN0YXJ0LFxuICAgIFRva2VuOiBUb2tlbixcbiAgICBpc05ld0xpbmU6IGlzTmV3TGluZSxcbiAgICBsaW5lQnJlYWs6IGxpbmVCcmVhayxcbiAgICBsaW5lQnJlYWtHOiBsaW5lQnJlYWtHLFxuICAgIG5vbkFTQ0lJd2hpdGVzcGFjZTogbm9uQVNDSUl3aGl0ZXNwYWNlXG4gIH07XG5cbiAgLy8gVGhlIG1haW4gZXhwb3J0ZWQgaW50ZXJmYWNlICh1bmRlciBgc2VsZi5hY29ybmAgd2hlbiBpbiB0aGVcbiAgLy8gYnJvd3NlcikgaXMgYSBgcGFyc2VgIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYSBjb2RlIHN0cmluZyBhbmRcbiAgLy8gcmV0dXJucyBhbiBhYnN0cmFjdCBzeW50YXggdHJlZSBhcyBzcGVjaWZpZWQgYnkgW01vemlsbGEgcGFyc2VyXG4gIC8vIEFQSV1bYXBpXS5cbiAgLy9cbiAgLy8gW2FwaV06IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvU3BpZGVyTW9ua2V5L1BhcnNlcl9BUElcblxuICBmdW5jdGlvbiBwYXJzZShpbnB1dCwgb3B0aW9ucykge1xuICAgIHJldHVybiBQYXJzZXIucGFyc2UoaW5wdXQsIG9wdGlvbnMpXG4gIH1cblxuICAvLyBUaGlzIGZ1bmN0aW9uIHRyaWVzIHRvIHBhcnNlIGEgc2luZ2xlIGV4cHJlc3Npb24gYXQgYSBnaXZlblxuICAvLyBvZmZzZXQgaW4gYSBzdHJpbmcuIFVzZWZ1bCBmb3IgcGFyc2luZyBtaXhlZC1sYW5ndWFnZSBmb3JtYXRzXG4gIC8vIHRoYXQgZW1iZWQgSmF2YVNjcmlwdCBleHByZXNzaW9ucy5cblxuICBmdW5jdGlvbiBwYXJzZUV4cHJlc3Npb25BdChpbnB1dCwgcG9zLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIFBhcnNlci5wYXJzZUV4cHJlc3Npb25BdChpbnB1dCwgcG9zLCBvcHRpb25zKVxuICB9XG5cbiAgLy8gQWNvcm4gaXMgb3JnYW5pemVkIGFzIGEgdG9rZW5pemVyIGFuZCBhIHJlY3Vyc2l2ZS1kZXNjZW50IHBhcnNlci5cbiAgLy8gVGhlIGB0b2tlbml6ZXJgIGV4cG9ydCBwcm92aWRlcyBhbiBpbnRlcmZhY2UgdG8gdGhlIHRva2VuaXplci5cblxuICBmdW5jdGlvbiB0b2tlbml6ZXIoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gUGFyc2VyLnRva2VuaXplcihpbnB1dCwgb3B0aW9ucylcbiAgfVxuXG4gIGV4cG9ydHMuTm9kZSA9IE5vZGU7XG4gIGV4cG9ydHMuUGFyc2VyID0gUGFyc2VyO1xuICBleHBvcnRzLlBvc2l0aW9uID0gUG9zaXRpb247XG4gIGV4cG9ydHMuU291cmNlTG9jYXRpb24gPSBTb3VyY2VMb2NhdGlvbjtcbiAgZXhwb3J0cy5Ub2tDb250ZXh0ID0gVG9rQ29udGV4dDtcbiAgZXhwb3J0cy5Ub2tlbiA9IFRva2VuO1xuICBleHBvcnRzLlRva2VuVHlwZSA9IFRva2VuVHlwZTtcbiAgZXhwb3J0cy5kZWZhdWx0T3B0aW9ucyA9IGRlZmF1bHRPcHRpb25zO1xuICBleHBvcnRzLmdldExpbmVJbmZvID0gZ2V0TGluZUluZm87XG4gIGV4cG9ydHMuaXNJZGVudGlmaWVyQ2hhciA9IGlzSWRlbnRpZmllckNoYXI7XG4gIGV4cG9ydHMuaXNJZGVudGlmaWVyU3RhcnQgPSBpc0lkZW50aWZpZXJTdGFydDtcbiAgZXhwb3J0cy5pc05ld0xpbmUgPSBpc05ld0xpbmU7XG4gIGV4cG9ydHMua2V5d29yZFR5cGVzID0ga2V5d29yZHM7XG4gIGV4cG9ydHMubGluZUJyZWFrID0gbGluZUJyZWFrO1xuICBleHBvcnRzLmxpbmVCcmVha0cgPSBsaW5lQnJlYWtHO1xuICBleHBvcnRzLm5vbkFTQ0lJd2hpdGVzcGFjZSA9IG5vbkFTQ0lJd2hpdGVzcGFjZTtcbiAgZXhwb3J0cy5wYXJzZSA9IHBhcnNlO1xuICBleHBvcnRzLnBhcnNlRXhwcmVzc2lvbkF0ID0gcGFyc2VFeHByZXNzaW9uQXQ7XG4gIGV4cG9ydHMudG9rQ29udGV4dHMgPSB0eXBlcztcbiAgZXhwb3J0cy50b2tUeXBlcyA9IHR5cGVzJDE7XG4gIGV4cG9ydHMudG9rZW5pemVyID0gdG9rZW5pemVyO1xuICBleHBvcnRzLnZlcnNpb24gPSB2ZXJzaW9uO1xuXG59KSk7XG4iLCJcbmltcG9ydCBNb2R1bGUgZnJvbSAnLi9Nb2R1bGUnXG5pbXBvcnQgVXRpbHMgZnJvbSAnLi91dGlscy9pbmRleCdcbmltcG9ydCBJTmF0aXZlIGZyb20gJy4vSU5hdGl2ZSdcbmltcG9ydCBDcmVhdHVyZSBmcm9tICcuL0NyZWF0dXJlJ1xuaW1wb3J0IEJhc2VFbGVtZW50IGZyb20gJy4vZWxlbWVudHMvQmFzZUVsZW1lbnQnXG5cbmV4cG9ydCBjbGFzcyBSdW5uYWJsZSB7XG5cbiAgICByb290OiBCYXNlRWxlbWVudFxuICAgIG1vdW50OiAoKSA9PiB2b2lkXG5cbiAgICBjb25zdHJ1Y3Rvcihyb290OiBCYXNlRWxlbWVudCwgbW91bnQ6ICgpID0+IHZvaWQpIHtcbiAgICAgICAgdGhpcy5yb290ID0gcm9vdFxuICAgICAgICB0aGlzLm1vdW50ID0gbW91bnRcbiAgICB9XG59XG5cbmNsYXNzIEFwcGxldCB7XG5cbiAgICBfa2V5OiBzdHJpbmdcbiAgICBwdWJsaWMgZ2V0IGtleSgpIHsgcmV0dXJuIHRoaXMuX2tleSB9XG5cbiAgICBfZ2VuZXNpc0NyZWF0dXJlOiBDcmVhdHVyZVxuXG4gICAgX25hdGl2ZUJ1aWxkZXI6IChtb2Q6IE1vZHVsZSkgPT4gSU5hdGl2ZVxuXG4gICAgcHJpdmF0ZSBfbW9kdWxlczogeyBbaWQ6IHN0cmluZ106IE1vZHVsZSB9XG4gICAgcHVibGljIGZpbmRNb2R1bGUoaWQ6IHN0cmluZykgeyByZXR1cm4gdGhpcy5fbW9kdWxlc1tpZF0gfVxuICAgIHB1YmxpYyBwdXRNb2R1bGUobW9kdWxlOiBNb2R1bGUpIHtcbiAgICAgICAgbW9kdWxlLnNldEFwcGxldCh0aGlzKVxuICAgICAgICB0aGlzLl9tb2R1bGVzW21vZHVsZS5rZXldID0gbW9kdWxlXG4gICAgfVxuICAgIHB1YmxpYyByZW1vdmVNb2R1bGUoa2V5OiBzdHJpbmcpIHsgZGVsZXRlIHRoaXMuX21vZHVsZXNba2V5XSB9XG5cbiAgICBtaWRkbGVDb2RlOiBhbnlcblxuICAgIHB1YmxpYyBmaWxsKGpzeENvZGU6IGFueSkge1xuICAgICAgICB0aGlzLm1pZGRsZUNvZGUgPSBVdGlscy5jb21waWxlci5wYXJzZShqc3hDb2RlKVxuICAgICAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeSh0aGlzLm1pZGRsZUNvZGUpKVxuICAgICAgICBsZXQgciA9IFV0aWxzLmNvbXBpbGVyLmV4dHJhY3RNb2R1bGVzKHRoaXMubWlkZGxlQ29kZSwgdGhpcyk7XG4gICAgICAgIHIuZm9yRWFjaCgobW9kdWxlOiBNb2R1bGUpID0+IHRoaXMucHV0TW9kdWxlKG1vZHVsZSkpXG4gICAgfVxuXG4gICAgY2FjaGUgPSB7XG4gICAgICAgIGVsZW1lbnRzOiB7fSxcbiAgICAgICAgbW91bnRzOiBbXVxuICAgIH1cblxuICAgIG9sZFZlcnNpb25zID0ge31cblxuICAgIG9uQ3JlYXR1cmVTdGF0ZUNoYW5nZShjcmVhdHVyZTogQ3JlYXR1cmUsIG5ld1ZlcnNpb246IEJhc2VFbGVtZW50KSB7XG4gICAgICAgIGxldCBvbGRWZXJzaW9uID0gdGhpcy5vbGRWZXJzaW9uc1tjcmVhdHVyZS5fa2V5XVxuICAgICAgICB0aGlzLm9sZFZlcnNpb25zW2NyZWF0dXJlLl9rZXldID0gbmV3VmVyc2lvblxuICAgICAgICBsZXQgdXBkYXRlcyA9IFV0aWxzLmpzb24uZGlmZihvbGRWZXJzaW9uLCBuZXdWZXJzaW9uKVxuICAgICAgICB1cGRhdGVzLmZvckVhY2goKHU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHUuX19hY3Rpb25fXyA9PT0gJ2VsZW1lbnRfZGVsZXRlZCcpIHtcbiAgICAgICAgICAgICAgICBsZXQga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuY2FjaGUuZWxlbWVudHMpLmZpbHRlcihrID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGsuc3RhcnRzV2l0aCh1Ll9fa2V5X18pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5jYWNoZS5lbGVtZW50c1trXVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICBpZiAoa2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCB0ZW1wID0ga2V5c1trZXlzLmxlbmd0aCAtIDFdLnNwbGl0KCctJylcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRlbXAubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRlbXAyID0gdGVtcC5zbGljZSgwLCB0ZW1wLmxlbmd0aCAtIDEpLmpvaW4oJy0nKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3RlbXAgMicsIHRlbXAyKVxuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuY2FjaGUuZWxlbWVudHNbdGVtcDJdXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2FmdGVyJywgdGhpcy5jYWNoZS5lbGVtZW50cylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy51cGRhdGUob2xkVmVyc2lvbi5fa2V5LCB1cGRhdGVzKVxuICAgIH1cblxuICAgIHVwZGF0ZTogKGtleTogc3RyaW5nLCB1OiBhbnkpID0+IHZvaWRcbiAgICBmaXJzdE1vdW50OiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBwdWJsaWMgcnVuKGdlbmVzaXM6IHN0cmluZywgbmF0aXZlQnVpbGRlcjogKG1vZDogTW9kdWxlKSA9PiBJTmF0aXZlLCB1cGRhdGU6IChrZXk6IHN0cmluZywgdTogYW55KSA9PiB2b2lkKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgIHRoaXMuX25hdGl2ZUJ1aWxkZXIgPSBuYXRpdmVCdWlsZGVyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZSA9IHVwZGF0ZVxuICAgICAgICAgICAgdGhpcy5maXJzdE1vdW50ID0gZmFsc2VcbiAgICAgICAgICAgIHRoaXMuY2FjaGUuZWxlbWVudHMgPSB7fVxuICAgICAgICAgICAgdGhpcy5jYWNoZS5tb3VudHMgPSBbXVxuICAgICAgICAgICAgbGV0IGdlbmVzaXNNb2QgPSB0aGlzLl9tb2R1bGVzW2dlbmVzaXNdXG4gICAgICAgICAgICB0aGlzLl9nZW5lc2lzQ3JlYXR1cmUgPSBnZW5lc2lzTW9kLmluc3RhbnRpYXRlKClcbiAgICAgICAgICAgIGxldCBnZW5lc2lzTWV0YUNvbnRleHQgPSBVdGlscy5nZW5lcmF0b3IubmVzdGVkQ29udGV4dCh0aGlzLl9nZW5lc2lzQ3JlYXR1cmUpXG4gICAgICAgICAgICB0aGlzLmNhY2hlLm1vdW50cy5wdXNoKCgpID0+IHRoaXMuX2dlbmVzaXNDcmVhdHVyZS5nZXRCYXNlTWV0aG9kKCdvbk1vdW50JykoZ2VuZXNpc01ldGFDb250ZXh0KSlcbiAgICAgICAgICAgIHRoaXMuX2dlbmVzaXNDcmVhdHVyZS5nZXRCYXNlTWV0aG9kKCdjb25zdHJ1Y3RvcicpKGdlbmVzaXNNZXRhQ29udGV4dClcbiAgICAgICAgICAgIGxldCB2aWV3ID0gdGhpcy5fZ2VuZXNpc0NyZWF0dXJlLmdldEJhc2VNZXRob2QoJ3JlbmRlcicpKGdlbmVzaXNNZXRhQ29udGV4dClcbiAgICAgICAgICAgIHRoaXMub2xkVmVyc2lvbnNbdGhpcy5fZ2VuZXNpc0NyZWF0dXJlLl9rZXldID0gdmlld1xuICAgICAgICAgICAgcmVzb2x2ZShcbiAgICAgICAgICAgICAgICBuZXcgUnVubmFibGUoXG4gICAgICAgICAgICAgICAgICAgIHZpZXcsXG4gICAgICAgICAgICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RNb3VudCA9IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2FjaGUubW91bnRzLnJldmVyc2UoKS5mb3JFYWNoKChvbk1vdW50OiBhbnkpID0+IG9uTW91bnQoKSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIClcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBjb25zdHJ1Y3RvcihrZXk6IHN0cmluZywgbW9kdWxlcz86IHsgW2lkOiBzdHJpbmddOiBNb2R1bGUgfSkge1xuICAgICAgICB0aGlzLl9rZXkgPSBrZXlcbiAgICAgICAgdGhpcy5fbW9kdWxlcyA9IG1vZHVsZXMgPyBtb2R1bGVzIDoge31cbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFwcGxldFxuIiwiXG5pbXBvcnQgRE9NIGZyb20gXCIuL0RPTVwiXG5pbXBvcnQgRXhlY3V0aW9uTWV0YSBmcm9tIFwiLi9FeGVjdXRpb25NZXRhXCJcbmltcG9ydCBNb2R1bGUgZnJvbSBcIi4vTW9kdWxlXCJcbmltcG9ydCBSdW50aW1lIGZyb20gXCIuL1J1bnRpbWVcIlxuaW1wb3J0IEJhc2VFbGVtZW50IGZyb20gXCIuL2VsZW1lbnRzL0Jhc2VFbGVtZW50XCJcbmltcG9ydCBVdGlscyBmcm9tICcuL3V0aWxzJ1xuXG5jbGFzcyBDcmVhdHVyZSB7XG5cbiAgICBwdWJsaWMgX2tleTogc3RyaW5nXG4gICAgcHVibGljIGdldCBrZXkoKSB7IHJldHVybiB0aGlzLl9rZXkgfVxuXG4gICAgcHJpdmF0ZSBfY29zbW9JZDogc3RyaW5nXG4gICAgcHVibGljIGdldCBjb3Ntb0lkKCkgeyByZXR1cm4gdGhpcy5fY29zbW9JZCB9XG4gICAgcHVibGljIHNldENvc21vSWQoY29zbW9JZDogc3RyaW5nKSB7IHRoaXMuX2Nvc21vSWQgPSBjb3Ntb0lkIH1cblxuICAgIHByaXZhdGUgX21vZHVsZTogTW9kdWxlXG4gICAgcHVibGljIGdldCBtb2R1bGUoKSB7IHJldHVybiB0aGlzLl9tb2R1bGUgfVxuXG4gICAgcHVibGljIF9ydW50aW1lOiBSdW50aW1lXG4gICAgcHVibGljIGdldCBydW50aW1lKCkgeyByZXR1cm4gdGhpcy5fcnVudGltZSB9XG5cbiAgICBwdWJsaWMgX2RvbTogRE9NXG4gICAgcHVibGljIGdldCBkb20oKSB7IHJldHVybiB0aGlzLl9kb20gfVxuXG4gICAgcHVibGljIHRoaXNPYmo6IHsgW2lkOiBzdHJpbmddOiBhbnkgfVxuXG4gICAgcHVibGljIGdldEJhc2VNZXRob2QobWV0aG9kSWQ6IHN0cmluZykge1xuICAgICAgICByZXR1cm4gdGhpcy5fcnVudGltZS5zdGFja1swXS5maW5kVW5pdChtZXRob2RJZClcbiAgICB9XG5cbiAgICBwdWJsaWMgdXBkYXRlKHByb3BzPzogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBzdHlsZXM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0sIGNoaWxkcmVuPzogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIHRoaXMudGhpc09iaiA9IHtcbiAgICAgICAgICAgIC4uLnRoaXMudGhpc09iaixcbiAgICAgICAgICAgIHByb3BzLFxuICAgICAgICAgICAgc3R5bGVzLFxuICAgICAgICAgICAgY2hpbGRyZW5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBmaWxsQ2hpbGRyZW4oY2hpbGRyZW46IEFycmF5PEJhc2VFbGVtZW50Pikge1xuICAgICAgICB0aGlzLnRoaXNPYmouY2hpbGRyZW4gPSBjaGlsZHJlblxuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKG1vZHVsZTogTW9kdWxlLCBkZWZhdWx0VmFsdWVzPzogYW55KSB7XG4gICAgICAgIHRoaXMuX2tleSA9IGRlZmF1bHRWYWx1ZXM/Ll9rZXkgPyBkZWZhdWx0VmFsdWVzLl9rZXkgOiBVdGlscy5nZW5lcmF0b3IuZ2VuZXJhdGVLZXkoKVxuICAgICAgICB0aGlzLl9jb3Ntb0lkID0gZGVmYXVsdFZhbHVlcz8uY29zbW9JZFxuICAgICAgICB0aGlzLl9tb2R1bGUgPSBtb2R1bGVcbiAgICAgICAgdGhpcy5fZG9tID0gZGVmYXVsdFZhbHVlcz8uZG9tID8gZGVmYXVsdFZhbHVlcy5kb20gOiBuZXcgRE9NKHRoaXMuX21vZHVsZSwgdGhpcylcbiAgICAgICAgdGhpcy5fcnVudGltZSA9IGRlZmF1bHRWYWx1ZXM/LnJ1bnRpbWUgPyBkZWZhdWx0VmFsdWVzLnJ1bnRpbWUgOiBuZXcgUnVudGltZSh0aGlzLl9tb2R1bGUsIHRoaXMpXG4gICAgICAgIHRoaXMudGhpc09iaiA9IGRlZmF1bHRWYWx1ZXM/LnRoaXNPYmpcbiAgICAgICAgaWYgKCFkZWZhdWx0VmFsdWVzPy5ydW50aW1lKSB7XG4gICAgICAgICAgICB0aGlzLl9ydW50aW1lLmxvYWQoKVxuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy50aGlzT2JqKSB7XG4gICAgICAgICAgICB0aGlzLnRoaXNPYmogPSB7fVxuICAgICAgICAgICAgT2JqZWN0LmtleXModGhpcy5fcnVudGltZS5zdGFja1swXS51bml0cykuZm9yRWFjaChrID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX3J1bnRpbWUubmF0aXZlW2tdIHx8IChrID09PSAnY29uc3RydWN0b3InKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRoaXNPYmpba10gPSB0aGlzLl9ydW50aW1lLnN0YWNrWzBdLnVuaXRzW2tdXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHRoaXMudGhpc09iaiA9IHt9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50aGlzT2JqWydzZXRTdGF0ZSddID0gKHN0YXRlVXBkYXRlOiB7IFtpZDogc3RyaW5nXTogYW55IH0pID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHN0YXRlVXBkYXRlKVxuICAgICAgICAgICAgdGhpcy50aGlzT2JqWydzdGF0ZSddID0geyAuLi50aGlzLnRoaXNPYmpbJ3N0YXRlJ10sIC4uLnN0YXRlVXBkYXRlIH1cbiAgICAgICAgICAgIGxldCBuZXdNZXRhQnJhbmNoID0gbmV3IEV4ZWN1dGlvbk1ldGEoeyBjcmVhdHVyZTogdGhpcywgcGFyZW50SnN4S2V5OiB0aGlzLnRoaXNPYmpbJ3BhcmVudEpzeEtleSddIH0pXG4gICAgICAgICAgICBsZXQgbmV3UmVuZGVyID0gdGhpcy5nZXRCYXNlTWV0aG9kKCdyZW5kZXInKShuZXdNZXRhQnJhbmNoKVxuICAgICAgICAgICAgdGhpcy5fbW9kdWxlLmFwcGxldC5vbkNyZWF0dXJlU3RhdGVDaGFuZ2UodGhpcywgbmV3UmVuZGVyKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDcmVhdHVyZVxuIiwiXG5pbXBvcnQgQ3JlYXR1cmUgZnJvbSBcIi4vQ3JlYXR1cmVcIlxuaW1wb3J0IEZ1bmMgZnJvbSBcIi4vRnVuY1wiXG5cbmNsYXNzIENyZWF0dXJlU3RvcmUge1xuXG4gICAgcHJpdmF0ZSBfc3RvcmU6IHsgW2lkOiBzdHJpbmddOiBDcmVhdHVyZSB9XG4gICAgcHVibGljIHB1dENyZWF0dXJlKGNyZWF0dXJlOiBDcmVhdHVyZSkgeyB0aGlzLl9zdG9yZVtjcmVhdHVyZS5rZXldID0gY3JlYXR1cmUgfVxuICAgIHB1YmxpYyByZW1vdmVDcmVhdHVyZShrZXk6IHN0cmluZykgeyBkZWxldGUgdGhpcy5fc3RvcmVba2V5XSB9XG4gICAgcHVibGljIGZpbmRDcmVhdHVyZShrZXk6IHN0cmluZykgeyByZXR1cm4gdGhpcy5fc3RvcmVba2V5XSB9XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5fc3RvcmUgPSB7fVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ3JlYXR1cmVTdG9yZVxuIiwiXG5pbXBvcnQgQ3JlYXR1cmUgZnJvbSAnLi9DcmVhdHVyZSdcbmltcG9ydCBNb2R1bGUgZnJvbSAnLi9Nb2R1bGUnXG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSAnLi9lbGVtZW50cy9CYXNlRWxlbWVudCdcblxuY2xhc3MgRE9NIHtcblxuICAgIHByaXZhdGUgX21vZHVsZTogTW9kdWxlXG4gICAgcHVibGljIGdldCBtb2R1bGUoKSB7IHJldHVybiB0aGlzLl9tb2R1bGUgfVxuXG4gICAgcHJpdmF0ZSBfY3JlYXR1cmU6IENyZWF0dXJlXG4gICAgcHVibGljIGdldCBjcmVhdHVyZSgpIHsgcmV0dXJuIHRoaXMuX2NyZWF0dXJlIH1cblxuICAgIHByaXZhdGUgX3Jvb3Q/OiBCYXNlRWxlbWVudFxuICAgIHB1YmxpYyBnZXQgcm9vdCgpIHsgcmV0dXJuIHRoaXMuX3Jvb3QgfVxuICAgIHB1YmxpYyBzZXRSb290KHJvb3Q6IEJhc2VFbGVtZW50KSB7IHRoaXMuX3Jvb3QgPSByb290IH1cblxuICAgIGNvbnN0cnVjdG9yKG1vZHVsZTogTW9kdWxlLCBjcmVhdHVyZT86IENyZWF0dXJlLCByb290PzogQmFzZUVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5fbW9kdWxlID0gbW9kdWxlXG4gICAgICAgIHRoaXMuX2NyZWF0dXJlID0gY3JlYXR1cmVcbiAgICAgICAgdGhpcy5fcm9vdCA9IHJvb3RcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERPTVxuIiwiaW1wb3J0IENyZWF0dXJlIGZyb20gXCIuL0NyZWF0dXJlXCJcblxuY2xhc3MgRXhlY3V0aW9uTWV0YSB7XG5cbiAgICBjcmVhdHVyZTogQ3JlYXR1cmVcbiAgICBkZWNsYXJhdGlvbj86IGJvb2xlYW5cbiAgICBkZWNsYXJhdGlvblR5cGU/OiBzdHJpbmdcbiAgICByZXR1cm5JZFBhcmVudD86IGJvb2xlYW5cbiAgICBpc0Fub3RoZXJDcmVhdHVyZT86IGJvb2xlYW5cbiAgICBwYXJlbnRKc3hLZXk6IHN0cmluZ1xuXG4gICAgY29uc3RydWN0b3IobWV0YURpY3Q6IGFueSkge1xuICAgICAgICB0aGlzLmNyZWF0dXJlID0gbWV0YURpY3QuY3JlYXR1cmVcbiAgICAgICAgdGhpcy5kZWNsYXJhdGlvbiA9IChtZXRhRGljdC5kZWNsYXJhdGlvbiA9PT0gdHJ1ZSlcbiAgICAgICAgdGhpcy5kZWNsYXJhdGlvblR5cGUgPSBtZXRhRGljdC5kZWNsYXJhdGlvblR5cGVcbiAgICAgICAgdGhpcy5yZXR1cm5JZFBhcmVudCA9IG1ldGFEaWN0LnJldHVybklkUGFyZW50XG4gICAgICAgIHRoaXMuaXNBbm90aGVyQ3JlYXR1cmUgPSBtZXRhRGljdC5pc0Fub3RoZXJDcmVhdHVyZVxuICAgICAgICB0aGlzLnBhcmVudEpzeEtleSA9IG1ldGFEaWN0LnBhcmVudEpzeEtleVxuICAgICAgICBpZiAodGhpcy5kZWNsYXJhdGlvbiAmJiAhdGhpcy5kZWNsYXJhdGlvblR5cGUpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IHRocm93IGludmFsaWQgZXhlY3V0aW9uIG1ldGFkYXRhIGV4Y2VwdGlvblxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeGVjdXRpb25NZXRhXG4iLCJpbXBvcnQgRnVuYyBmcm9tIFwiLi9GdW5jXCJcblxuY2xhc3MgRnVuY1N0b3JlIHtcblxuICAgIHByaXZhdGUgX3N0b3JlOiB7IFtpZDogc3RyaW5nXTogRnVuYyB9XG4gICAgcHVibGljIGdldCBzdG9yZSgpIHsgcmV0dXJuIHRoaXMuX3N0b3JlIH1cbiAgICBwdWJsaWMgcHV0RnVuYyhmdW5jOiBGdW5jKSB7IHRoaXMuX3N0b3JlW2Z1bmMua2V5XSA9IGZ1bmMgfVxuICAgIHB1YmxpYyByZW1vdmVGdW5jKGtleTogc3RyaW5nKSB7IGRlbGV0ZSB0aGlzLl9zdG9yZVtrZXldIH1cbiAgICBwdWJsaWMgZmluZEZ1bmMoa2V5OiBzdHJpbmcpIHsgcmV0dXJuIHRoaXMuX3N0b3JlW2tleV0gfVxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuX3N0b3JlID0ge31cbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZ1bmNTdG9yZVxuIiwiXG5pbXBvcnQgRnVuYyBmcm9tIFwiLi9GdW5jXCJcblxuY2xhc3MgTWVtb3J5TGF5ZXIge1xuXG4gICAgcHJpdmF0ZSBfdW5pdHM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfVxuICAgIHB1YmxpYyBnZXQgdW5pdHMoKSB7IHJldHVybiB0aGlzLl91bml0cyB9XG4gICAgcHVibGljIGZpbmRVbml0KGtleTogc3RyaW5nKSB7IHJldHVybiB0aGlzLl91bml0c1trZXldIH1cbiAgICBwdWJsaWMgcHV0VW5pdChrZXk6IHN0cmluZywgdW5pdDogYW55KSB7IHRoaXMuX3VuaXRzW2tleV0gPSB1bml0IH1cbiAgICBwdWJsaWMgcmVtb3ZlVW5pdChrZXk6IHN0cmluZykgeyBkZWxldGUgdGhpcy5fdW5pdHNba2V5XSB9XG5cbiAgICBjb25zdHJ1Y3Rvcihpbml0aWFsVW5pdHM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0pIHtcbiAgICAgICAgdGhpcy5fdW5pdHMgPSBpbml0aWFsVW5pdHMgPyBpbml0aWFsVW5pdHMgOiB7fVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWVtb3J5TGF5ZXJcbiIsIlxuaW1wb3J0IEFwcGxldCBmcm9tIFwiLi9BcHBsZXRcIlxuaW1wb3J0IENyZWF0dXJlIGZyb20gXCIuL0NyZWF0dXJlXCJcbmltcG9ydCBDcmVhdHVyZVN0b3JlIGZyb20gXCIuL0NyZWF0dXJlU3RvcmVcIlxuaW1wb3J0IERPTSBmcm9tIFwiLi9ET01cIlxuaW1wb3J0IEZ1bmNTdG9yZSBmcm9tIFwiLi9GdW5jU3RvcmVcIlxuaW1wb3J0IFJ1bnRpbWUgZnJvbSBcIi4vUnVudGltZVwiXG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSBcIi4vZWxlbWVudHMvQmFzZUVsZW1lbnRcIlxuaW1wb3J0IFV0aWxzIGZyb20gJy4vdXRpbHMnXG5cbmNsYXNzIE1vZHVsZSB7XG5cbiAgICBwcml2YXRlIF9hcHBsZXQ6IEFwcGxldFxuICAgIHB1YmxpYyBnZXQgYXBwbGV0KCkgeyByZXR1cm4gdGhpcy5fYXBwbGV0IH1cbiAgICBwdWJsaWMgc2V0QXBwbGV0KGFwcGxldDogQXBwbGV0KSB7IHRoaXMuX2FwcGxldCA9IGFwcGxldCB9XG5cbiAgICBwcml2YXRlIF9jcmVhdHVyZXM6IENyZWF0dXJlU3RvcmVcbiAgICBwdWJsaWMgZ2V0IGNyZWF0dXJlcygpIHsgcmV0dXJuIHRoaXMuX2NyZWF0dXJlcyB9XG5cbiAgICBwcml2YXRlIF9rZXk6IHN0cmluZ1xuICAgIGdldCBrZXkoKSB7IHJldHVybiB0aGlzLl9rZXkgfVxuXG4gICAgcHJpdmF0ZSBfZnVuY3M6IEZ1bmNTdG9yZVxuICAgIHB1YmxpYyBnZXQgZnVuY3MoKSB7IHJldHVybiB0aGlzLl9mdW5jcyB9XG5cbiAgICBwcml2YXRlIF9kb206IERPTVxuICAgIHB1YmxpYyBnZXQgZG9tKCkgeyByZXR1cm4gdGhpcy5fZG9tIH1cblxuICAgIHByaXZhdGUgX2FzdD86IGFueVxuICAgIHB1YmxpYyBnZXQgYXN0KCkgeyByZXR1cm4gdGhpcy5fYXN0IH1cbiAgICBwdWJsaWMgc2V0QXN0KGFzdDogYW55KSB7IHRoaXMuX2FzdCA9IGFzdCB9XG5cbiAgICBwdWJsaWMgaW5zdGFudGlhdGUocHJvcHM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0sIHN0eWxlcz86IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgY2hpbGRyZW4/OiBBcnJheTxCYXNlRWxlbWVudD4sIHRoaXNPYmo/OiBhbnkpIHtcbiAgICAgICAgbGV0IGNyZWF0dXJlID0gbmV3IENyZWF0dXJlKFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb3Ntb0lkOiBwcm9wcz8ua2V5LFxuICAgICAgICAgICAgICAgIHRoaXNPYmo6IHRoaXNPYmogP1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi50aGlzT2JqLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHM6IHByb3BzID8gcHJvcHMgOiB7fSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlczogc3R5bGVzID8gc3R5bGVzIDoge30sXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogY2hpbGRyZW4gPyBjaGlsZHJlbiA6IFtdXG4gICAgICAgICAgICAgICAgICAgIH0gOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wczogcHJvcHMgPyBwcm9wcyA6IHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGVzOiBzdHlsZXMgPyBzdHlsZXMgOiB7fSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBjaGlsZHJlbiA/IGNoaWxkcmVuIDogW11cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICApXG4gICAgICAgIHRoaXMuX2NyZWF0dXJlcy5wdXRDcmVhdHVyZShjcmVhdHVyZSlcbiAgICAgICAgcmV0dXJuIGNyZWF0dXJlXG4gICAgfVxuXG4gICAgY29uc3RydWN0b3Ioa2V5OiBzdHJpbmcsIGFwcGxldDogQXBwbGV0LCBhc3Q/OiBhbnkpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0ga2V5XG4gICAgICAgIHRoaXMuX2FwcGxldCA9IGFwcGxldFxuICAgICAgICB0aGlzLl9hc3QgPSBhc3RcbiAgICAgICAgdGhpcy5fY3JlYXR1cmVzID0gbmV3IENyZWF0dXJlU3RvcmUoKVxuICAgICAgICB0aGlzLl9mdW5jcyA9IG5ldyBGdW5jU3RvcmUoKVxuICAgICAgICB0aGlzLl9kb20gPSBuZXcgRE9NKHRoaXMpXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNb2R1bGVcbiIsIlxuaW1wb3J0IENyZWF0dXJlIGZyb20gJy4vQ3JlYXR1cmUnXG5pbXBvcnQgSU5hdGl2ZSBmcm9tICcuL0lOYXRpdmUnXG5pbXBvcnQgTWVtb3J5TGF5ZXIgZnJvbSAnLi9NZW1vcnlMYXllcidcbmltcG9ydCBNZW1vcnkgZnJvbSAnLi9NZW1vcnlMYXllcidcbmltcG9ydCBNb2R1bGUgZnJvbSAnLi9Nb2R1bGUnXG5pbXBvcnQgVXRpbHMgZnJvbSAnLi91dGlscydcblxuY2xhc3MgUnVudGltZSB7XG5cbiAgICBwcml2YXRlIF9tb2R1bGU6IE1vZHVsZVxuICAgIHB1YmxpYyBnZXQgbW9kdWxlKCkgeyByZXR1cm4gdGhpcy5fbW9kdWxlIH1cblxuICAgIHByaXZhdGUgX2NyZWF0dXJlOiBDcmVhdHVyZVxuICAgIHB1YmxpYyBnZXQgY3JlYXR1cmUoKSB7IHJldHVybiB0aGlzLl9jcmVhdHVyZSB9XG5cbiAgICBwcml2YXRlIF9uYXRpdmU6IElOYXRpdmVcbiAgICBwdWJsaWMgZ2V0IG5hdGl2ZSgpIHsgcmV0dXJuIHRoaXMuX25hdGl2ZSB9XG5cbiAgICBwdWJsaWMgc3RhY2s6IEFycmF5PE1lbW9yeT4gPSBbXVxuICAgIHB1YmxpYyBwdXNoT25TdGFjayhpbml0aWFsVW5pdHM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0pIHsgdGhpcy5zdGFjay5wdXNoKG5ldyBNZW1vcnlMYXllcihpbml0aWFsVW5pdHMpKSB9XG4gICAgcHVibGljIHBvcEZyb21TdGFjaygpIHsgdGhpcy5zdGFjay5wb3AoKSB9XG4gICAgcHVibGljIGdldCBzdGFja1RvcCgpIHsgcmV0dXJuIHRoaXMuc3RhY2tbdGhpcy5zdGFjay5sZW5ndGggLSAxXSB9XG4gICAgcHVibGljIHJlc2V0U3RhY2soKSB7XG4gICAgICAgIHRoaXMuc3RhY2sgPSBbXVxuICAgICAgICB0aGlzLnB1c2hPblN0YWNrKHsgLi4udGhpcy5fbmF0aXZlIH0pXG4gICAgfVxuXG4gICAgcHVibGljIHJlc2V0KCkge1xuICAgICAgICB0aGlzLnJlc2V0U3RhY2soKVxuICAgIH1cblxuICAgIHB1YmxpYyBleGVjdXRlKGFzdDogYW55KSB7XG4gICAgICAgIFV0aWxzLmV4ZWN1dG9yLmV4ZWN1dGVCbG9jayhhc3QsIG5ldyBVdGlscy5leGVjdXRvci5FeGVjdXRpb25NZXRhKHsgY3JlYXR1cmU6IHRoaXMuX2NyZWF0dXJlIH0pKVxuICAgIH1cblxuICAgIHB1YmxpYyBsb2FkKCkge1xuICAgICAgICB0aGlzLmV4ZWN1dGUodGhpcy5tb2R1bGUuYXN0LmJvZHkuYm9keSlcbiAgICB9XG5cbiAgICBwdWJsaWMgY2xvbmUoKSB7XG4gICAgICAgIGxldCBjb3B5ID0gbmV3IFJ1bnRpbWUodGhpcy5tb2R1bGUsIHRoaXMuY3JlYXR1cmUsIHsgbmF0aXZlOiB0aGlzLm5hdGl2ZSwgc3RhY2s6IG5ldyBBcnJheSguLi50aGlzLnN0YWNrKSB9KVxuICAgICAgICByZXR1cm4gY29weVxuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKG1vZHVsZTogTW9kdWxlLCBjcmVhdHVyZT86IENyZWF0dXJlLCByZXVzYWJsZVRvb2xzPzogYW55KSB7XG4gICAgICAgIHRoaXMuX21vZHVsZSA9IG1vZHVsZVxuICAgICAgICB0aGlzLl9jcmVhdHVyZSA9IGNyZWF0dXJlXG4gICAgICAgIHRoaXMuX25hdGl2ZSA9IHJldXNhYmxlVG9vbHM/Lm5hdGl2ZSA/IHJldXNhYmxlVG9vbHMubmF0aXZlIDogdGhpcy5fbW9kdWxlLmFwcGxldC5fbmF0aXZlQnVpbGRlcih0aGlzLl9tb2R1bGUpXG4gICAgICAgIGlmIChyZXVzYWJsZVRvb2xzPy5zdGFjaykge1xuICAgICAgICAgICAgdGhpcy5zdGFjayA9IHJldXNhYmxlVG9vbHMuc3RhY2tcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IFJ1bnRpbWVcbiIsIlxuY2xhc3MgQmFzZUNvbnRyb2wge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEJhc2VDb250cm9sXG4iLCJcbmltcG9ydCBCYXNlQ29udHJvbCBmcm9tICcuL0Jhc2VDb250cm9sJztcbmltcG9ydCBVdGlscyBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSAnLi4vZWxlbWVudHMvQmFzZUVsZW1lbnQnO1xuXG5jbGFzcyBCb3hDb250cm9sIGV4dGVuZHMgQmFzZUNvbnRyb2wge1xuXG4gICAgcHVibGljIHN0YXRpYyByZWFkb25seSBUWVBFID0gJ2JveCdcbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRQcm9wcyA9IHtcbiAgICAgICAgXG4gICAgfVxuICAgIHB1YmxpYyBzdGF0aWMgZGVmYXVsdFN0eWxlcyA9IHtcbiAgICAgICAgd2lkdGg6IDIwMCxcbiAgICAgICAgaGVpZ2h0OiAyMDBcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGluc3RhbnRpYXRlKG92ZXJyaWRlblByb3BzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sIG92ZXJyaWRlblN0eWxlczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBjaGlsZHJlbjogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIHJldHVybiBVdGlscy5nZW5lcmF0b3IucHJlcGFyZUVsZW1lbnQoQm94Q29udHJvbC5UWVBFLCB0aGlzLmRlZmF1bHRQcm9wcywgb3ZlcnJpZGVuUHJvcHMsIHRoaXMuZGVmYXVsdFN0eWxlcywgb3ZlcnJpZGVuU3R5bGVzLCBjaGlsZHJlbilcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJveENvbnRyb2xcbiIsIlxuaW1wb3J0IEJhc2VDb250cm9sIGZyb20gJy4vQmFzZUNvbnRyb2wnO1xuaW1wb3J0IFN0cmluZ1Byb3AgZnJvbSAnLi4vcHJvcHMvU3RyaW5nUHJvcCdcbmltcG9ydCBVdGlscyBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSAnLi4vZWxlbWVudHMvQmFzZUVsZW1lbnQnO1xuaW1wb3J0IEZ1bmNQcm9wIGZyb20gJy4uL3Byb3BzL0Z1bmNQcm9wJztcblxuY2xhc3MgQnV0dG9uQ29udHJvbCBleHRlbmRzIEJhc2VDb250cm9sIHtcblxuICAgIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgVFlQRSA9ICdidXR0b24nXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0UHJvcHMgPSB7XG4gICAgICAgIGNhcHRpb246IG5ldyBTdHJpbmdQcm9wKCcnKSxcbiAgICAgICAgdmFyaWFudDogbmV3IFN0cmluZ1Byb3AoJ2ZpbGxlZCcpLFxuICAgICAgICBvbkNsaWNrOiBuZXcgRnVuY1Byb3AodW5kZWZpbmVkKVxuICAgIH1cbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRTdHlsZXMgPSB7XG4gICAgICAgIHdpZHRoOiAxNTAsXG4gICAgICAgIGhlaWdodDogJ2F1dG8nXG4gICAgfVxuXG4gICAgc3RhdGljIGluc3RhbnRpYXRlKG92ZXJyaWRlblByb3BzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sIG92ZXJyaWRlblN0eWxlczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBjaGlsZHJlbjogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIHJldHVybiBVdGlscy5nZW5lcmF0b3IucHJlcGFyZUVsZW1lbnQoQnV0dG9uQ29udHJvbC5UWVBFLCB0aGlzLmRlZmF1bHRQcm9wcywgb3ZlcnJpZGVuUHJvcHMsIHRoaXMuZGVmYXVsdFN0eWxlcywgb3ZlcnJpZGVuU3R5bGVzLCBjaGlsZHJlbilcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1dHRvbkNvbnRyb2xcbiIsIlxuaW1wb3J0IEJhc2VDb250cm9sIGZyb20gJy4vQmFzZUNvbnRyb2wnO1xuaW1wb3J0IFV0aWxzIGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCBCYXNlRWxlbWVudCBmcm9tICcuLi9lbGVtZW50cy9CYXNlRWxlbWVudCc7XG5cbmNsYXNzIENhcmRDb250cm9sIGV4dGVuZHMgQmFzZUNvbnRyb2wge1xuXG4gICAgcHVibGljIHN0YXRpYyByZWFkb25seSBUWVBFID0gJ2NhcmQnXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0UHJvcHMgPSB7XG4gICAgICAgIFxuICAgIH1cbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRTdHlsZXMgPSB7XG4gICAgICAgIHdpZHRoOiAyMDAsXG4gICAgICAgIGhlaWdodDogMjAwLFxuICAgICAgICBib3hTaGFkb3c6ICdyZ2JhKDAsIDAsIDAsIDAuMjQpIDBweCAzcHggOHB4JyxcbiAgICAgICAgYmFja2dyb3VuZENvbG9yOiAnI2ZmZicsXG4gICAgICAgIGJvcmRlclJhZGl1czogNFxuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgaW5zdGFudGlhdGUob3ZlcnJpZGVuUHJvcHM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgb3ZlcnJpZGVuU3R5bGVzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sIGNoaWxkcmVuOiBBcnJheTxCYXNlRWxlbWVudD4pIHtcbiAgICAgICAgcmV0dXJuIFV0aWxzLmdlbmVyYXRvci5wcmVwYXJlRWxlbWVudChDYXJkQ29udHJvbC5UWVBFLCB0aGlzLmRlZmF1bHRQcm9wcywgb3ZlcnJpZGVuUHJvcHMsIHRoaXMuZGVmYXVsdFN0eWxlcywgb3ZlcnJpZGVuU3R5bGVzLCBjaGlsZHJlbilcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IENhcmRDb250cm9sXG4iLCJcbmltcG9ydCBCYXNlQ29udHJvbCBmcm9tICcuL0Jhc2VDb250cm9sJztcbmltcG9ydCBVdGlscyBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgQmFzZUVsZW1lbnQgZnJvbSAnLi4vZWxlbWVudHMvQmFzZUVsZW1lbnQnO1xuXG5jbGFzcyBQcmltYXJ5VGFiQ29udHJvbCBleHRlbmRzIEJhc2VDb250cm9sIHtcblxuICAgIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgVFlQRSA9ICdwcmltYXJ5LXRhYidcbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRQcm9wcyA9IHtcbiAgICAgICAgXG4gICAgfVxuICAgIHB1YmxpYyBzdGF0aWMgZGVmYXVsdFN0eWxlcyA9IHtcbiAgICAgICAgXG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBpbnN0YW50aWF0ZShvdmVycmlkZW5Qcm9wczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBvdmVycmlkZW5TdHlsZXM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgY2hpbGRyZW46IEFycmF5PEJhc2VFbGVtZW50Pikge1xuICAgICAgICByZXR1cm4gVXRpbHMuZ2VuZXJhdG9yLnByZXBhcmVFbGVtZW50KFByaW1hcnlUYWJDb250cm9sLlRZUEUsIHRoaXMuZGVmYXVsdFByb3BzLCBvdmVycmlkZW5Qcm9wcywgdGhpcy5kZWZhdWx0U3R5bGVzLCBvdmVycmlkZW5TdHlsZXMsIGNoaWxkcmVuKVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJpbWFyeVRhYkNvbnRyb2xcbiIsIlxuaW1wb3J0IEJhc2VDb250cm9sIGZyb20gJy4vQmFzZUNvbnRyb2wnO1xuaW1wb3J0IFV0aWxzIGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCBCYXNlRWxlbWVudCBmcm9tICcuLi9lbGVtZW50cy9CYXNlRWxlbWVudCc7XG5pbXBvcnQgRnVuY1Byb3AgZnJvbSAnLi4vcHJvcHMvRnVuY1Byb3AnO1xuXG5jbGFzcyBUYWJzQ29udHJvbCBleHRlbmRzIEJhc2VDb250cm9sIHtcblxuICAgIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgVFlQRSA9ICd0YWJzJ1xuICAgIHB1YmxpYyBzdGF0aWMgZGVmYXVsdFByb3BzID0ge1xuICAgICAgICBvbkNoYW5nZTogbmV3IEZ1bmNQcm9wKHVuZGVmaW5lZClcbiAgICB9XG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0U3R5bGVzID0ge1xuICAgICAgICBcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGluc3RhbnRpYXRlKG92ZXJyaWRlblByb3BzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sIG92ZXJyaWRlblN0eWxlczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBjaGlsZHJlbjogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIHJldHVybiBVdGlscy5nZW5lcmF0b3IucHJlcGFyZUVsZW1lbnQoVGFic0NvbnRyb2wuVFlQRSwgdGhpcy5kZWZhdWx0UHJvcHMsIG92ZXJyaWRlblByb3BzLCB0aGlzLmRlZmF1bHRTdHlsZXMsIG92ZXJyaWRlblN0eWxlcywgY2hpbGRyZW4pXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUYWJzQ29udHJvbFxuIiwiXG5pbXBvcnQgQmFzZUNvbnRyb2wgZnJvbSAnLi9CYXNlQ29udHJvbCc7XG5pbXBvcnQgU3RyaW5nUHJvcCBmcm9tICcuLi9wcm9wcy9TdHJpbmdQcm9wJ1xuaW1wb3J0IFV0aWxzIGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCBCYXNlRWxlbWVudCBmcm9tICcuLi9lbGVtZW50cy9CYXNlRWxlbWVudCc7XG5cbmNsYXNzIFRleHRDb250cm9sIGV4dGVuZHMgQmFzZUNvbnRyb2wge1xuXG4gICAgcHVibGljIHN0YXRpYyByZWFkb25seSBUWVBFID0gJ3RleHQnXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0UHJvcHMgPSB7XG4gICAgICAgIHRleHQ6IG5ldyBTdHJpbmdQcm9wKCcnKVxuICAgIH1cbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRTdHlsZXMgPSB7XG4gICAgICAgIHdpZHRoOiAxNTAsXG4gICAgICAgIGhlaWdodDogJ2F1dG8nXG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBpbnN0YW50aWF0ZShvdmVycmlkZW5Qcm9wczogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBvdmVycmlkZW5TdHlsZXM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSwgY2hpbGRyZW46IEFycmF5PEJhc2VFbGVtZW50Pikge1xuICAgICAgICByZXR1cm4gVXRpbHMuZ2VuZXJhdG9yLnByZXBhcmVFbGVtZW50KFRleHRDb250cm9sLlRZUEUsIHRoaXMuZGVmYXVsdFByb3BzLCBvdmVycmlkZW5Qcm9wcywgdGhpcy5kZWZhdWx0U3R5bGVzLCBvdmVycmlkZW5TdHlsZXMsIGNoaWxkcmVuKVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGV4dENvbnRyb2xcbiIsIlxuaW1wb3J0IEJveENvbnRyb2wgZnJvbSBcIi4vQm94Q29udHJvbFwiXG5pbXBvcnQgQnV0dG9uQ29udHJvbCBmcm9tIFwiLi9CdXR0b25Db250cm9sXCJcbmltcG9ydCBDYXJkQ29udHJvbCBmcm9tIFwiLi9DYXJkQ29udHJvbFwiXG5pbXBvcnQgVGFic0NvbnRyb2wgZnJvbSBcIi4vVGFic0NvbnRyb2xcIlxuaW1wb3J0IFByaW1hcnlUYWJDb250cm9sIGZyb20gXCIuL1ByaW1hcnlUYWJDb250cm9sXCJcbmltcG9ydCBUZXh0Q29udHJvbCBmcm9tIFwiLi9UZXh0Q29udHJvbFwiXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgICBbVGV4dENvbnRyb2wuVFlQRV06IFRleHRDb250cm9sLFxuICAgIFtCdXR0b25Db250cm9sLlRZUEVdOiBCdXR0b25Db250cm9sLFxuICAgIFtCb3hDb250cm9sLlRZUEVdOiBCb3hDb250cm9sLFxuICAgIFtDYXJkQ29udHJvbC5UWVBFXTogQ2FyZENvbnRyb2wsXG4gICAgW1RhYnNDb250cm9sLlRZUEVdOiBUYWJzQ29udHJvbCxcbiAgICBbUHJpbWFyeVRhYkNvbnRyb2wuVFlQRV06IFByaW1hcnlUYWJDb250cm9sXG59XG4iLCJpbXBvcnQgQmFzZVByb3AgZnJvbSBcIi4uL3Byb3BzL0Jhc2VQcm9wXCI7XG5cbmNsYXNzIEJhc2VFbGVtZW50IHtcblxuICAgIHB1YmxpYyBfa2V5OiBzdHJpbmdcbiAgICBwdWJsaWMgZ2V0IGtleSgpIHsgcmV0dXJuIHRoaXMuX2tleSB9XG5cbiAgICBwcml2YXRlIF9jb250cm9sVHlwZTogc3RyaW5nXG4gICAgcHVibGljIGdldCBjb250cm9sVHlwZSgpIHsgcmV0dXJuIHRoaXMuX2NvbnRyb2xUeXBlIH1cblxuICAgIHB1YmxpYyBfcHJvcHM6IHsgW2tleTogc3RyaW5nXTogQmFzZVByb3AgfVxuICAgIGdldCBwcm9wcygpIHsgcmV0dXJuIHRoaXMuX3Byb3BzIH1cblxuICAgIHB1YmxpYyBfc3R5bGVzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9XG4gICAgZ2V0IHN0eWxlcygpIHsgcmV0dXJuIHRoaXMuX3N0eWxlcyB9XG5cbiAgICBwdWJsaWMgX2NoaWxkcmVuOiBBcnJheTxCYXNlRWxlbWVudD5cbiAgICBnZXQgY2hpbGRyZW4oKSB7IHJldHVybiB0aGlzLl9jaGlsZHJlbiB9XG5cbiAgICBwdWJsaWMgdXBkYXRlKHByb3BzPzogeyBbaWQ6IHN0cmluZ106IGFueSB9LCBzdHlsZXM/OiB7IFtpZDogc3RyaW5nXTogYW55IH0sIGNoaWxkcmVuPzogQXJyYXk8QmFzZUVsZW1lbnQ+KSB7XG4gICAgICAgIGlmIChwcm9wcykgdGhpcy5fcHJvcHMgPSBwcm9wc1xuICAgICAgICBpZiAoc3R5bGVzKSB0aGlzLl9zdHlsZXMgPSBzdHlsZXNcbiAgICAgICAgaWYgKGNoaWxkcmVuKSB0aGlzLl9jaGlsZHJlbiA9IGNoaWxkcmVuXG4gICAgfVxuXG4gICAgY29uc3RydWN0b3IoXG4gICAgICAgIGtleTogc3RyaW5nLFxuICAgICAgICBjb250cm9sVHlwZTogc3RyaW5nLFxuICAgICAgICBwcm9wczogeyBba2V5OiBzdHJpbmddOiBCYXNlUHJvcCB9LFxuICAgICAgICBzdHlsZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sXG4gICAgICAgIGNoaWxkcmVuPzogQXJyYXk8QmFzZUVsZW1lbnQ+XG4gICAgKSB7XG4gICAgICAgIHRoaXMuX2tleSA9IGtleVxuICAgICAgICB0aGlzLl9jb250cm9sVHlwZSA9IGNvbnRyb2xUeXBlXG4gICAgICAgIHRoaXMuX3Byb3BzID0gcHJvcHM7XG4gICAgICAgIHRoaXMuX3N0eWxlcyA9IHN0eWxlc1xuICAgICAgICB0aGlzLl9jaGlsZHJlbiA9IGNoaWxkcmVuID8gY2hpbGRyZW4gOiBbXVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQmFzZUVsZW1lbnRcbiIsIlxuYWJzdHJhY3QgY2xhc3MgQmFzZVByb3Age1xuXG4gICAgX3R5cGU6IHN0cmluZ1xuICAgIHB1YmxpYyBnZXQgdHlwZSgpIHsgcmV0dXJuIHRoaXMuX3R5cGUgfVxuXG4gICAgcHVibGljIGFic3RyYWN0IHNldFZhbHVlKHZhbHVlOiBhbnkpOiB2b2lkXG4gICAgcHVibGljIGFic3RyYWN0IGdldFZhbHVlKCk6IGFueVxuXG4gICAgY29uc3RydWN0b3IodHlwZTogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuX3R5cGUgPSB0eXBlXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCYXNlUHJvcFxuIiwiXG5pbXBvcnQgQmFzZVByb3AgZnJvbSAnLi9CYXNlUHJvcCdcblxuY2xhc3MgRnVuY1Byb3AgZXh0ZW5kcyBCYXNlUHJvcCB7XG5cbiAgICBfdmFsdWU/OiAoKSA9PiB2b2lkXG4gICAgcHVibGljIGdldCB2YWx1ZSgpIHsgcmV0dXJuIHRoaXMuX3ZhbHVlIH1cbiAgICBwdWJsaWMgc2V0VmFsdWUodjogYW55KSB7IHRoaXMuX3ZhbHVlID0gdn1cbiAgICBwdWJsaWMgZ2V0VmFsdWUoKSB7IHJldHVybiB0aGlzLl92YWx1ZX1cblxuICAgIF9kZWZhdWx0VmFsdWU/OiAoKSA9PiB2b2lkXG4gICAgcHVibGljIGdldCBkZWZhdWx0VmFsdWUoKSB7IHJldHVybiB0aGlzLl9kZWZhdWx0VmFsdWUgfVxuXG4gICAgY29uc3RydWN0b3IoZGVmYXVsdFZhbHVlPzogKCkgPT4gdm9pZCkge1xuICAgICAgICBzdXBlcignZnVuY3Rpb24nKVxuICAgICAgICB0aGlzLl92YWx1ZSA9IGRlZmF1bHRWYWx1ZVxuICAgICAgICB0aGlzLl9kZWZhdWx0VmFsdWUgPSBkZWZhdWx0VmFsdWVcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZ1bmNQcm9wXG4iLCJcbmltcG9ydCBCYXNlUHJvcCBmcm9tICcuL0Jhc2VQcm9wJ1xuXG5jbGFzcyBTdHJpbmdQcm9wIGV4dGVuZHMgQmFzZVByb3Age1xuXG4gICAgX3ZhbHVlPzogc3RyaW5nXG4gICAgcHVibGljIGdldCB2YWx1ZSgpIHsgcmV0dXJuIHRoaXMuX3ZhbHVlIH1cbiAgICBwdWJsaWMgc2V0VmFsdWUodjogYW55KSB7IHRoaXMuX3ZhbHVlID0gdn1cbiAgICBwdWJsaWMgZ2V0VmFsdWUoKSB7IHJldHVybiB0aGlzLl92YWx1ZX1cblxuICAgIF9kZWZhdWx0VmFsdWU6IHN0cmluZ1xuICAgIHB1YmxpYyBnZXQgZGVmYXVsdFZhbHVlKCkgeyByZXR1cm4gdGhpcy5fZGVmYXVsdFZhbHVlIH1cblxuICAgIGNvbnN0cnVjdG9yKGRlZmF1bHRWYWx1ZTogc3RyaW5nKSB7XG4gICAgICAgIHN1cGVyKCdzdHJpbmcnKVxuICAgICAgICB0aGlzLl92YWx1ZSA9IGRlZmF1bHRWYWx1ZVxuICAgICAgICB0aGlzLl9kZWZhdWx0VmFsdWUgPSBkZWZhdWx0VmFsdWVcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ1Byb3BcbiIsIlxuaW1wb3J0IHsgUGFyc2VyIGFzIEFjb3JuUGFyc2VyIH0gZnJvbSAnYWNvcm4nO1xuaW1wb3J0ICogYXMganN4IGZyb20gJ2Fjb3JuLWpzeCc7XG5pbXBvcnQgQXBwbGV0IGZyb20gJy4uL0FwcGxldCc7XG5pbXBvcnQgTW9kdWxlIGZyb20gJy4uL01vZHVsZSc7XG5pbXBvcnQgY3NzUHJvcGVydHkgZnJvbSAnLi9jc3NQcm9wZXJ0eSc7XG5pbXBvcnQgaHlwaGVuYXRlU3R5bGVOYW1lIGZyb20gJy4vaHlwaGVuYXRlU3R5bGVOYW1lJztcblxubGV0IHsgaXNVbml0bGVzc051bWJlciB9ID0gY3NzUHJvcGVydHlcblxubGV0IGpzeENvbXBpbGVyID0gQWNvcm5QYXJzZXIuZXh0ZW5kKGpzeCgpKTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xudmFyIGtleXMgPSBPYmplY3Qua2V5cztcblxudmFyIGNvdW50ZXIgPSAxO1xuLy8gRm9sbG93cyBzeW50YXggYXQgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL2NvbnRlbnQsXG4vLyBpbmNsdWRpbmcgbXVsdGlwbGUgc3BhY2Ugc2VwYXJhdGVkIHZhbHVlcy5cbnZhciB1bnF1b3RlZENvbnRlbnRWYWx1ZVJlZ2V4ID0gL14obm9ybWFsfG5vbmV8KFxcYih1cmxcXChbXildKlxcKXxjaGFwdGVyX2NvdW50ZXJ8YXR0clxcKFteKV0qXFwpfChuby0pPyhvcGVufGNsb3NlKS1xdW90ZXxpbmhlcml0KSgoXFxiXFxzKil8JHxcXHMrKSkrKSQvO1xuXG5mdW5jdGlvbiBidWlsZFJ1bGUoa2V5LCB2YWx1ZSkge1xuICAgIGlmICghaXNVbml0bGVzc051bWJlcltrZXldICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdmFsdWUgPSAnJyArIHZhbHVlICsgJ3B4JztcbiAgICB9XG4gICAgZWxzZSBpZiAoa2V5ID09PSAnY29udGVudCcgJiYgIXVucXVvdGVkQ29udGVudFZhbHVlUmVnZXgudGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgdmFsdWUgPSBcIidcIiArIHZhbHVlLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKSArIFwiJ1wiO1xuICAgIH1cblxuICAgIHJldHVybiBoeXBoZW5hdGVTdHlsZU5hbWUoa2V5KSArICc6ICcgKyB2YWx1ZSArICc7ICAnO1xufVxuXG5mdW5jdGlvbiBidWlsZFZhbHVlKGtleSwgdmFsdWUpIHtcbiAgICBpZiAoIWlzVW5pdGxlc3NOdW1iZXJba2V5XSAmJiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHZhbHVlID0gJycgKyB2YWx1ZSArICdweCc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGtleSA9PT0gJ2NvbnRlbnQnICYmICF1bnF1b3RlZENvbnRlbnRWYWx1ZVJlZ2V4LnRlc3QodmFsdWUpKSB7XG4gICAgICAgIHZhbHVlID0gXCInXCIgKyB2YWx1ZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIikgKyBcIidcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWUgKyAnJztcbn1cblxuZnVuY3Rpb24gc3R5bGVUb0Nzc1N0cmluZyhydWxlcykge1xuICAgIHZhciByZXN1bHQgPSAnJ1xuICAgIGlmICghcnVsZXMgfHwga2V5cyhydWxlcykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIHZhciBzdHlsZUtleXMgPSBrZXlzKHJ1bGVzKTtcbiAgICBmb3IgKHZhciBqID0gMCwgbCA9IHN0eWxlS2V5cy5sZW5ndGg7IGogPCBsOyBqKyspIHtcbiAgICAgICAgdmFyIHN0eWxlS2V5ID0gc3R5bGVLZXlzW2pdO1xuICAgICAgICB2YXIgdmFsdWUgPSBydWxlc1tzdHlsZUtleV07XG5cbiAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gYnVpbGRSdWxlKHN0eWxlS2V5LCB2YWx1ZVtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gYnVpbGRSdWxlKHN0eWxlS2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxubGV0IHBhcnNlID0gKGpzeENvZGU6IHN0cmluZykgPT4ge1xuICAgIHJldHVybiBqc3hDb21waWxlci5wYXJzZShqc3hDb2RlLCB7IHNvdXJjZVR5cGU6ICdtb2R1bGUnLCBlY21hVmVyc2lvbjogJ2xhdGVzdCcgfSk7XG59XG5cbmxldCBleHRyYWN0TW9kdWxlcyA9IChtaWRkbGVDb2RlOiBhbnksIGFwcGxldDogQXBwbGV0KSA9PiB7XG4gICAgcmV0dXJuIG1pZGRsZUNvZGUuYm9keVxuICAgICAgICAuZmlsdGVyKChkZWNsYXJhdGlvbjogYW55KSA9PiBkZWNsYXJhdGlvbi50eXBlID09PSAnQ2xhc3NEZWNsYXJhdGlvbicpXG4gICAgICAgIC5tYXAoKGRlY2xhcmF0aW9uOiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTW9kdWxlKGRlY2xhcmF0aW9uLmlkLm5hbWUsIGFwcGxldCwgZGVjbGFyYXRpb24pXG4gICAgICAgIH0pXG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgcGFyc2UsIGV4dHJhY3RNb2R1bGVzLCBzdHlsZVRvQ3NzU3RyaW5nLCBidWlsZFJ1bGUsIGJ1aWxkVmFsdWUgfVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENTUyBwcm9wZXJ0aWVzIHdoaWNoIGFjY2VwdCBudW1iZXJzIGJ1dCBhcmUgbm90IGluIHVuaXRzIG9mIFwicHhcIi5cbiAqL1xudmFyIGlzVW5pdGxlc3NOdW1iZXIgPSB7XG4gIGJveEZsZXg6IHRydWUsXG4gIGJveEZsZXhHcm91cDogdHJ1ZSxcbiAgY29sdW1uQ291bnQ6IHRydWUsXG4gIGZsZXg6IHRydWUsXG4gIGZsZXhHcm93OiB0cnVlLFxuICBmbGV4UG9zaXRpdmU6IHRydWUsXG4gIGZsZXhTaHJpbms6IHRydWUsXG4gIGZsZXhOZWdhdGl2ZTogdHJ1ZSxcbiAgZm9udFdlaWdodDogdHJ1ZSxcbiAgbGluZUNsYW1wOiB0cnVlLFxuICBsaW5lSGVpZ2h0OiB0cnVlLFxuICBvcGFjaXR5OiB0cnVlLFxuICBvcmRlcjogdHJ1ZSxcbiAgb3JwaGFuczogdHJ1ZSxcbiAgd2lkb3dzOiB0cnVlLFxuICB6SW5kZXg6IHRydWUsXG4gIHpvb206IHRydWUsXG5cbiAgLy8gU1ZHLXJlbGF0ZWQgcHJvcGVydGllc1xuICBmaWxsT3BhY2l0eTogdHJ1ZSxcbiAgc3Ryb2tlRGFzaG9mZnNldDogdHJ1ZSxcbiAgc3Ryb2tlT3BhY2l0eTogdHJ1ZSxcbiAgc3Ryb2tlV2lkdGg6IHRydWVcbn07XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IHByZWZpeCB2ZW5kb3Itc3BlY2lmaWMgcHJlZml4LCBlZzogV2Via2l0XG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IHN0eWxlIG5hbWUsIGVnOiB0cmFuc2l0aW9uRHVyYXRpb25cbiAqIEByZXR1cm4ge3N0cmluZ30gc3R5bGUgbmFtZSBwcmVmaXhlZCB3aXRoIGBwcmVmaXhgLCBwcm9wZXJseSBjYW1lbENhc2VkLCBlZzpcbiAqIFdlYmtpdFRyYW5zaXRpb25EdXJhdGlvblxuICovXG5mdW5jdGlvbiBwcmVmaXhLZXkocHJlZml4LCBrZXkpIHtcbiAgcmV0dXJuIHByZWZpeCArIGtleS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGtleS5zdWJzdHJpbmcoMSk7XG59XG5cbi8qKlxuICogU3VwcG9ydCBzdHlsZSBuYW1lcyB0aGF0IG1heSBjb21lIHBhc3NlZCBpbiBwcmVmaXhlZCBieSBhZGRpbmcgcGVybXV0YXRpb25zXG4gKiBvZiB2ZW5kb3IgcHJlZml4ZXMuXG4gKi9cbnZhciBwcmVmaXhlcyA9IFsnV2Via2l0JywgJ21zJywgJ01veicsICdPJ107XG5cbi8vIFVzaW5nIE9iamVjdC5rZXlzIGhlcmUsIG9yIGVsc2UgdGhlIHZhbmlsbGEgZm9yLWluIGxvb3AgbWFrZXMgSUU4IGdvIGludG8gYW5cbi8vIGluZmluaXRlIGxvb3AsIGJlY2F1c2UgaXQgaXRlcmF0ZXMgb3ZlciB0aGUgbmV3bHkgYWRkZWQgcHJvcHMgdG9vLlxuT2JqZWN0LmtleXMoaXNVbml0bGVzc051bWJlcikuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkge1xuICBwcmVmaXhlcy5mb3JFYWNoKGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICBpc1VuaXRsZXNzTnVtYmVyW3ByZWZpeEtleShwcmVmaXgsIHByb3ApXSA9IGlzVW5pdGxlc3NOdW1iZXJbcHJvcF07XG4gIH0pO1xufSk7XG5cbi8qKlxuICogTW9zdCBzdHlsZSBwcm9wZXJ0aWVzIGNhbiBiZSB1bnNldCBieSBkb2luZyAuc3R5bGVbcHJvcF0gPSAnJyBidXQgSUU4XG4gKiBkb2Vzbid0IGxpa2UgZG9pbmcgdGhhdCB3aXRoIHNob3J0aGFuZCBwcm9wZXJ0aWVzIHNvIGZvciB0aGUgcHJvcGVydGllcyB0aGF0XG4gKiBJRTggYnJlYWtzIG9uLCB3aGljaCBhcmUgbGlzdGVkIGhlcmUsIHdlIGluc3RlYWQgdW5zZXQgZWFjaCBvZiB0aGVcbiAqIGluZGl2aWR1YWwgcHJvcGVydGllcy4gU2VlIGh0dHA6Ly9idWdzLmpxdWVyeS5jb20vdGlja2V0LzEyMzg1LlxuICogVGhlIDQtdmFsdWUgJ2Nsb2NrJyBwcm9wZXJ0aWVzIGxpa2UgbWFyZ2luLCBwYWRkaW5nLCBib3JkZXItd2lkdGggc2VlbSB0b1xuICogYmVoYXZlIHdpdGhvdXQgYW55IHByb2JsZW1zLiBDdXJpb3VzbHksIGxpc3Qtc3R5bGUgd29ya3MgdG9vIHdpdGhvdXQgYW55XG4gKiBzcGVjaWFsIHByb2RkaW5nLlxuICovXG52YXIgc2hvcnRoYW5kUHJvcGVydHlFeHBhbnNpb25zID0ge1xuICBiYWNrZ3JvdW5kOiB7XG4gICAgYmFja2dyb3VuZEltYWdlOiB0cnVlLFxuICAgIGJhY2tncm91bmRQb3NpdGlvbjogdHJ1ZSxcbiAgICBiYWNrZ3JvdW5kUmVwZWF0OiB0cnVlLFxuICAgIGJhY2tncm91bmRDb2xvcjogdHJ1ZVxuICB9LFxuICBib3JkZXI6IHtcbiAgICBib3JkZXJXaWR0aDogdHJ1ZSxcbiAgICBib3JkZXJTdHlsZTogdHJ1ZSxcbiAgICBib3JkZXJDb2xvcjogdHJ1ZVxuICB9LFxuICBib3JkZXJCb3R0b206IHtcbiAgICBib3JkZXJCb3R0b21XaWR0aDogdHJ1ZSxcbiAgICBib3JkZXJCb3R0b21TdHlsZTogdHJ1ZSxcbiAgICBib3JkZXJCb3R0b21Db2xvcjogdHJ1ZVxuICB9LFxuICBib3JkZXJMZWZ0OiB7XG4gICAgYm9yZGVyTGVmdFdpZHRoOiB0cnVlLFxuICAgIGJvcmRlckxlZnRTdHlsZTogdHJ1ZSxcbiAgICBib3JkZXJMZWZ0Q29sb3I6IHRydWVcbiAgfSxcbiAgYm9yZGVyUmlnaHQ6IHtcbiAgICBib3JkZXJSaWdodFdpZHRoOiB0cnVlLFxuICAgIGJvcmRlclJpZ2h0U3R5bGU6IHRydWUsXG4gICAgYm9yZGVyUmlnaHRDb2xvcjogdHJ1ZVxuICB9LFxuICBib3JkZXJUb3A6IHtcbiAgICBib3JkZXJUb3BXaWR0aDogdHJ1ZSxcbiAgICBib3JkZXJUb3BTdHlsZTogdHJ1ZSxcbiAgICBib3JkZXJUb3BDb2xvcjogdHJ1ZVxuICB9LFxuICBmb250OiB7XG4gICAgZm9udFN0eWxlOiB0cnVlLFxuICAgIGZvbnRWYXJpYW50OiB0cnVlLFxuICAgIGZvbnRXZWlnaHQ6IHRydWUsXG4gICAgZm9udFNpemU6IHRydWUsXG4gICAgbGluZUhlaWdodDogdHJ1ZSxcbiAgICBmb250RmFtaWx5OiB0cnVlXG4gIH1cbn07XG5cbnZhciBDU1NQcm9wZXJ0eSA9IHtcbiAgaXNVbml0bGVzc051bWJlcjogaXNVbml0bGVzc051bWJlcixcbiAgc2hvcnRoYW5kUHJvcGVydHlFeHBhbnNpb25zOiBzaG9ydGhhbmRQcm9wZXJ0eUV4cGFuc2lvbnNcbn07XG5cbmV4cG9ydCBkZWZhdWx0IENTU1Byb3BlcnR5XG4iLCJcbmltcG9ydCBCYXNlRWxlbWVudCBmcm9tIFwiLi4vZWxlbWVudHMvQmFzZUVsZW1lbnRcIlxuaW1wb3J0IENyZWF0dXJlIGZyb20gXCIuLi9DcmVhdHVyZVwiXG5pbXBvcnQgQ29udHJvbHMgZnJvbSAnLi4vY29udHJvbHMvaW5kZXgnXG5pbXBvcnQgRXhlY3V0aW9uTWV0YSBmcm9tIFwiLi4vRXhlY3V0aW9uTWV0YVwiXG5pbXBvcnQgVXRpbHMgZnJvbSAnLidcblxubGV0IGV4ZWN1dGVTaW5nbGUgPSAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgbGV0IGNhbGxiYWNrID0gY29kZUNhbGxiYWNrc1tjb2RlLnR5cGVdXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGxldCByID0gY2FsbGJhY2soY29kZSwgbWV0YSlcbiAgICAgICAgcmV0dXJuIHJcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY29kZVxuICAgIH1cbn1cblxubGV0IGV4ZWN1dGVCbG9jayA9IChjb2RlczogQXJyYXk8YW55PiwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IGNvZGUgPSBjb2Rlc1tpXVxuICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY29kZSwgbWV0YSlcbiAgICAgICAgaWYgKHI/LnJldHVybkZpcmVkKSByZXR1cm4gclxuICAgIH1cbn1cblxubGV0IGZpbmRMYXllciA9IChtZXRhOiBFeGVjdXRpb25NZXRhLCBpZDogc3RyaW5nKSA9PiB7XG4gICAgZm9yIChsZXQgaSA9IG1ldGEuY3JlYXR1cmUucnVudGltZS5zdGFjay5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBsZXQgciA9IG1ldGEuY3JlYXR1cmUuX3J1bnRpbWUuc3RhY2tbaV0uZmluZFVuaXQoaWQpXG4gICAgICAgIGlmIChyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuc3RhY2tbaV1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgZ2VuZXJhdGVDYWxsYmFja0Z1bmN0aW9uID0gKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgIGxldCBuZXdNZXRhQnJhbmNoID0gbWV0YVxuICAgIHJldHVybiAoLi4uYXJnczogQXJyYXk8YW55PikgPT4ge1xuICAgICAgICBsZXQgcGFyYW1ldGVycyA9IHt9XG4gICAgICAgIGNvZGUucGFyYW1zLmZvckVhY2goKHBhcmFtOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIHBhcmFtZXRlcnNbcGFyYW0ubmFtZV0gPSBhcmdzW2luZGV4XVxuICAgICAgICB9KVxuICAgICAgICBsZXQgZmlyc3RQYXJhbSA9IGFyZ3NbMF1cbiAgICAgICAgaWYgKGZpcnN0UGFyYW0gJiYgKGZpcnN0UGFyYW0gaW5zdGFuY2VvZiBFeGVjdXRpb25NZXRhKSAmJiBmaXJzdFBhcmFtLmlzQW5vdGhlckNyZWF0dXJlKSB7XG4gICAgICAgICAgICBuZXdNZXRhQnJhbmNoID0gZmlyc3RQYXJhbVxuICAgICAgICB9XG4gICAgICAgIG5ld01ldGFCcmFuY2guY3JlYXR1cmUucnVudGltZS5wdXNoT25TdGFjayhwYXJhbWV0ZXJzKVxuICAgICAgICBsZXQgcmVzdWx0ID0gZXhlY3V0ZVNpbmdsZShjb2RlLmJvZHksIG5ld01ldGFCcmFuY2gpXG4gICAgICAgIG5ld01ldGFCcmFuY2guY3JlYXR1cmUucnVudGltZS5wb3BGcm9tU3RhY2soKVxuICAgICAgICByZXR1cm4gcmVzdWx0Py52YWx1ZVxuICAgIH1cbn1cblxubGV0IGNvZGVDYWxsYmFja3MgPSB7XG4gICAgVW5hcnlFeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGlmIChjb2RlLm9wZXJhdG9yID09PSAnIScpIHtcbiAgICAgICAgICAgIHJldHVybiAhZXhlY3V0ZVNpbmdsZShjb2RlLmFyZ3VtZW50LCBtZXRhKVxuICAgICAgICB9XG4gICAgfSxcbiAgICBMb2dpY2FsRXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBpZiAoY29kZS5vcGVyYXRvciA9PT0gJyYmJykge1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSAmJiBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJ3x8Jykge1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSB8fCBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH1cbiAgICB9LFxuICAgIENvbmRpdGlvbmFsRXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLnRlc3QsIG1ldGEpID8gZXhlY3V0ZVNpbmdsZShjb2RlLmNvbnNlcXVlbnQsIG1ldGEpIDogZXhlY3V0ZVNpbmdsZShjb2RlLmFsdGVybmF0ZSwgbWV0YSlcbiAgICB9LFxuICAgIFRoaXNFeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIHJldHVybiBtZXRhLmNyZWF0dXJlLnRoaXNPYmpcbiAgICB9LFxuICAgIEpTWEV4cHJlc3Npb25Db250YWluZXI6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5leHByZXNzaW9uLCBtZXRhKVxuICAgIH0sXG4gICAgSlNYVGV4dDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICByZXR1cm4gY29kZS52YWx1ZS50cmltKCk7XG4gICAgfSxcbiAgICBKU1hFbGVtZW50OiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGlmICghY29kZS5jb3Ntb0lkKSBjb2RlLmNvc21vSWQgPSBVdGlscy5nZW5lcmF0b3IuZ2VuZXJhdGVLZXkoKVxuICAgICAgICBsZXQgQ29udHJvbCA9IG1ldGEuY3JlYXR1cmUubW9kdWxlLmFwcGxldC5maW5kTW9kdWxlKGNvZGUub3BlbmluZ0VsZW1lbnQubmFtZS5uYW1lKVxuICAgICAgICBsZXQgYXR0cnMgPSB7fVxuICAgICAgICBjb2RlLm9wZW5pbmdFbGVtZW50LmF0dHJpYnV0ZXMuZm9yRWFjaCgoYXR0cjogYW55KSA9PiB7XG4gICAgICAgICAgICBhdHRyc1thdHRyLm5hbWUubmFtZV0gPSBleGVjdXRlU2luZ2xlKGF0dHIudmFsdWUsIG1ldGEpXG4gICAgICAgIH0pXG4gICBcbiAgICAgICAgbGV0IGtleSA9IGF0dHJzWydrZXknXVxuICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGtleSA9IGNvZGUuY29zbW9JZFxuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKG1ldGEucGFyZW50SnN4S2V5LCBrZXksIGNvZGUuY29zbW9JZClcbiAgICAgICAgaWYgKG1ldGEucGFyZW50SnN4S2V5KSBrZXkgPSBtZXRhLnBhcmVudEpzeEtleSArICctJyArIGtleVxuICAgICAgICBhdHRyc1sna2V5J10gPSBrZXlcblxuICAgICAgICBsZXQgYyA9IG1ldGEuY3JlYXR1cmUubW9kdWxlLmFwcGxldC5jYWNoZS5lbGVtZW50c1trZXldO1xuICAgICAgICBsZXQgaXNOZXcgPSAoYyA9PT0gdW5kZWZpbmVkKVxuXG4gICAgICAgIGMgPSBDb250cm9sLmluc3RhbnRpYXRlKGF0dHJzLCBhdHRyc1snc3R5bGUnXSwgW10sIGM/LnRoaXNPYmopXG5cbiAgICAgICAgbGV0IGNoaWxkTWV0YSA9IG5ldyBFeGVjdXRpb25NZXRhKHsgLi4ubWV0YSwgcGFyZW50SnN4S2V5OiBrZXkgfSlcbiAgICAgICAgbGV0IGNoaWxkcmVuID0gY29kZS5jaGlsZHJlbi5tYXAoKGNoaWxkOiBhbnkpID0+IGV4ZWN1dGVTaW5nbGUoY2hpbGQsIGNoaWxkTWV0YSkpXG4gICAgICAgICAgICAuZmxhdChJbmZpbml0eSkuZmlsdGVyKChjaGlsZDogYW55KSA9PiAoY2hpbGQgIT09ICcnKSlcbiAgICAgICAgYy5maWxsQ2hpbGRyZW4oY2hpbGRyZW4pXG4gICAgICAgIGlmIChtZXRhLnBhcmVudEpzeEtleSkgYy50aGlzT2JqLnBhcmVudEpzeEtleSA9IG1ldGEucGFyZW50SnN4S2V5XG5cbiAgICAgICAgbGV0IG5ld01ldGFCcmFuY2ggPSBVdGlscy5nZW5lcmF0b3IubmVzdGVkQ29udGV4dChjLCB7IC4uLm1ldGEsIHBhcmVudEpzeEtleToga2V5IH0pXG4gICAgICAgIG1ldGEuY3JlYXR1cmUubW9kdWxlLmFwcGxldC5jYWNoZS5lbGVtZW50c1trZXldID0gY1xuICAgICAgICBpZiAoaXNOZXcpIGMuZ2V0QmFzZU1ldGhvZCgnY29uc3RydWN0b3InKShuZXdNZXRhQnJhbmNoKVxuICAgICAgICBpZiAobWV0YS5jcmVhdHVyZS5tb2R1bGUuYXBwbGV0LmZpcnN0TW91bnQpIHtcbiAgICAgICAgICAgIGMuZ2V0QmFzZU1ldGhvZCgnb25Nb3VudCcpKG5ld01ldGFCcmFuY2gpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtZXRhLmNyZWF0dXJlLm1vZHVsZS5hcHBsZXQuY2FjaGUubW91bnRzLnB1c2goKCkgPT4gYy5nZXRCYXNlTWV0aG9kKCdvbk1vdW50JykobmV3TWV0YUJyYW5jaCkpXG4gICAgICAgIH1cbiAgICAgICAgbGV0IHIgPSBjLmdldEJhc2VNZXRob2QoJ3JlbmRlcicpKG5ld01ldGFCcmFuY2gpXG4gICAgICAgIGlmICghbWV0YS5jcmVhdHVyZS5tb2R1bGUuYXBwbGV0Lm9sZFZlcnNpb25zW2MuX2tleV0pIHtcbiAgICAgICAgICAgIG1ldGEuY3JlYXR1cmUubW9kdWxlLmFwcGxldC5vbGRWZXJzaW9uc1tjLl9rZXldID0gclxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByXG4gICAgfSxcbiAgICBQcm9ncmFtOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGNvZGUuYm9keS5mb3JFYWNoKChjaGlsZDogYW55KSA9PiB7XG4gICAgICAgICAgICBleGVjdXRlU2luZ2xlKGNoaWxkLCBtZXRhKVxuICAgICAgICB9KVxuICAgIH0sXG4gICAgTGl0ZXJhbDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICByZXR1cm4gY29kZS52YWx1ZVxuICAgIH0sXG4gICAgRnVuY3Rpb25FeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGxldCBuZXdDcmVhdHVyZUJyYW5jaCA9IG5ldyBDcmVhdHVyZShtZXRhLmNyZWF0dXJlLm1vZHVsZSwgeyAuLi5tZXRhLmNyZWF0dXJlLCBydW50aW1lOiBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuY2xvbmUoKSB9KVxuICAgICAgICBsZXQgbmV3TWV0YUJyYW5jaCA9IG5ldyBFeGVjdXRpb25NZXRhKHsgLi4ubWV0YSwgY3JlYXR1cmU6IG5ld0NyZWF0dXJlQnJhbmNoIH0pXG4gICAgICAgIHJldHVybiBnZW5lcmF0ZUNhbGxiYWNrRnVuY3Rpb24oY29kZSwgbmV3TWV0YUJyYW5jaClcbiAgICB9LFxuICAgIEZ1bmN0aW9uRGVjbGFyYXRpb246IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgbGV0IG5ld0NyZWF0dXJlQnJhbmNoID0gbmV3IENyZWF0dXJlKG1ldGEuY3JlYXR1cmUubW9kdWxlLCB7IC4uLm1ldGEuY3JlYXR1cmUsIHJ1bnRpbWU6IG1ldGEuY3JlYXR1cmUucnVudGltZS5jbG9uZSgpIH0pXG4gICAgICAgIGxldCBuZXdNZXRhQnJhbmNoID0gbmV3IEV4ZWN1dGlvbk1ldGEoeyAuLi5tZXRhLCBjcmVhdHVyZTogbmV3Q3JlYXR1cmVCcmFuY2ggfSlcbiAgICAgICAgbWV0YS5jcmVhdHVyZS5ydW50aW1lLnN0YWNrVG9wLnB1dFVuaXQoY29kZS5pZC5uYW1lLCBnZW5lcmF0ZUNhbGxiYWNrRnVuY3Rpb24oY29kZSwgbmV3TWV0YUJyYW5jaCkpXG4gICAgfSxcbiAgICBNZXRob2REZWZpbml0aW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIG1ldGEuY3JlYXR1cmUucnVudGltZS5zdGFja1RvcC5wdXRVbml0KGNvZGUua2V5Lm5hbWUsIGV4ZWN1dGVTaW5nbGUoY29kZS52YWx1ZSwgbWV0YSkpXG4gICAgfSxcbiAgICBWYXJpYWJsZURlY2xhcmF0aW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGlmIChjb2RlLmtpbmQgPT09ICdsZXQnKSB7XG4gICAgICAgICAgICBjb2RlLmRlY2xhcmF0aW9ucy5mb3JFYWNoKChkOiBhbnkpID0+IGV4ZWN1dGVTaW5nbGUoZCwgbmV3IEV4ZWN1dGlvbk1ldGEoeyAuLi5tZXRhLCBkZWNsYXJhdGlvbjogdHJ1ZSwgZGVjbGFyYXRpb25UeXBlOiAnbGV0JyB9KSkpO1xuICAgICAgICB9IGVsc2UgaWYgKGNvZGUua2luZCA9PT0gJ2NvbnN0Jykge1xuICAgICAgICAgICAgY29kZS5kZWNsYXJhdGlvbnMuZm9yRWFjaCgoZDogYW55KSA9PiBleGVjdXRlU2luZ2xlKGQsIG5ldyBFeGVjdXRpb25NZXRhKHsgLi4ubWV0YSwgZGVjbGFyYXRpb246IHRydWUsIGRlY2xhcmF0aW9uVHlwZTogJ2NvbnN0JyB9KSkpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBWYXJpYWJsZURlY2xhcmF0b3I6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgaWYgKG1ldGE/LmRlY2xhcmF0aW9uKSB7XG4gICAgICAgICAgICBsZXQgdmFsID0gZXhlY3V0ZVNpbmdsZShjb2RlLmluaXQsIG1ldGEpXG4gICAgICAgICAgICBpZiAoY29kZS5pZC50eXBlID09PSAnT2JqZWN0UGF0dGVybicpIHtcbiAgICAgICAgICAgICAgICBjb2RlLmlkLnByb3BlcnRpZXMuZm9yRWFjaCgocHJvcGVydHk6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuc3RhY2tUb3AucHV0VW5pdChwcm9wZXJ0eS5rZXkubmFtZSwgdmFsW3Byb3BlcnR5LmtleS5uYW1lXSlcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWV0YS5jcmVhdHVyZS5ydW50aW1lLnN0YWNrVG9wLnB1dFVuaXQoY29kZS5pZC5uYW1lLCB2YWwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIElkZW50aWZpZXI6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgaWYgKG1ldGEucmV0dXJuSWRQYXJlbnQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuc3RhY2subGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICBsZXQgd3JhcHBlciA9IGZpbmRMYXllcihtZXRhLCBjb2RlLm5hbWUpXG4gICAgICAgICAgICAgICAgaWYgKHdyYXBwZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgcGFyZW50OiB3cmFwcGVyLnVuaXRzLCBpZDogY29kZS5uYW1lIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gbWV0YS5jcmVhdHVyZS5ydW50aW1lLnN0YWNrLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgbGV0IHIgPSBtZXRhLmNyZWF0dXJlLnJ1bnRpbWUuc3RhY2tbaV0uZmluZFVuaXQoY29kZS5uYW1lKVxuICAgICAgICAgICAgICAgIGlmIChyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIEJpbmFyeUV4cHJlc3Npb246IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgaWYgKGNvZGUub3BlcmF0b3IgPT09ICcrJykge1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSArIGV4ZWN1dGVTaW5nbGUoY29kZS5yaWdodCwgbWV0YSlcbiAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnLScpIHtcbiAgICAgICAgICAgIHJldHVybiBleGVjdXRlU2luZ2xlKGNvZGUubGVmdCwgbWV0YSkgLSBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJyonKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLmxlZnQsIG1ldGEpICogZXhlY3V0ZVNpbmdsZShjb2RlLnJpZ2h0LCBtZXRhKVxuICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICcvJykge1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSAvIGV4ZWN1dGVTaW5nbGUoY29kZS5yaWdodCwgbWV0YSlcbiAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnXicpIHtcbiAgICAgICAgICAgIHJldHVybiBNYXRoLnBvdyhleGVjdXRlU2luZ2xlKGNvZGUubGVmdCwgbWV0YSksIGV4ZWN1dGVTaW5nbGUoY29kZS5yaWdodCwgbWV0YSkpXG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJyUnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLmxlZnQsIG1ldGEpICUgZXhlY3V0ZVNpbmdsZShjb2RlLnJpZ2h0LCBtZXRhKVxuICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICc9PT0nKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLmxlZnQsIG1ldGEpID09PSBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJzwnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLmxlZnQsIG1ldGEpIDwgZXhlY3V0ZVNpbmdsZShjb2RlLnJpZ2h0LCBtZXRhKVxuICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICc+Jykge1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCBtZXRhKSA+IGV4ZWN1dGVTaW5nbGUoY29kZS5yaWdodCwgbWV0YSlcbiAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnJicpIHtcbiAgICAgICAgICAgIHJldHVybiBleGVjdXRlU2luZ2xlKGNvZGUubGVmdCwgbWV0YSkgJiBleGVjdXRlU2luZ2xlKGNvZGUucmlnaHQsIG1ldGEpXG4gICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJ3wnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhlY3V0ZVNpbmdsZShjb2RlLmxlZnQsIG1ldGEpIHwgZXhlY3V0ZVNpbmdsZShjb2RlLnJpZ2h0LCBtZXRhKVxuICAgICAgICB9XG4gICAgfSxcbiAgICBJZlN0YXRlbWVudDogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBpZiAoZXhlY3V0ZVNpbmdsZShjb2RlLnRlc3QsIG1ldGEpKSB7XG4gICAgICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY29kZS5jb25zZXF1ZW50LCBtZXRhKVxuICAgICAgICAgICAgaWYgKHI/LmJyZWFrRmlyZWQpIHJldHVybiByXG4gICAgICAgICAgICBlbHNlIGlmIChyPy5yZXR1cm5GaXJlZCkgcmV0dXJuIHJcbiAgICAgICAgfSBlbHNlIGlmIChjb2RlLmFsdGVybmF0ZSkge1xuICAgICAgICAgICAgbGV0IHIgPSBleGVjdXRlU2luZ2xlKGNvZGUuYWx0ZXJuYXRlLCBtZXRhKVxuICAgICAgICAgICAgaWYgKHI/LmJyZWFrRmlyZWQpIHJldHVybiByXG4gICAgICAgICAgICBlbHNlIGlmIChyPy5yZXR1cm5GaXJlZCkgcmV0dXJuIHJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgQnJlYWtTdGF0ZW1lbnQ6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgcmV0dXJuIHsgYnJlYWtGaXJlZDogdHJ1ZSB9O1xuICAgIH0sXG4gICAgV2hpbGVTdGF0ZW1lbnQ6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgd2hpbGUgKGV4ZWN1dGVTaW5nbGUoY29kZS50ZXN0LCBtZXRhKSkge1xuICAgICAgICAgICAgbGV0IHIgPSBleGVjdXRlU2luZ2xlKGNvZGUuYm9keSwgbWV0YSlcbiAgICAgICAgICAgIGlmIChyPy5icmVha0ZpcmVkKSBicmVha1xuICAgICAgICAgICAgZWxzZSBpZiAocj8ucmV0dXJuRmlyZWQpIHJldHVybiByXG4gICAgICAgIH1cbiAgICB9LFxuICAgIEJsb2NrU3RhdGVtZW50OiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29kZS5ib2R5Py5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IHIgPSBleGVjdXRlU2luZ2xlKGNvZGUuYm9keVtpXSwgbWV0YSlcbiAgICAgICAgICAgIGlmIChyPy5icmVha0ZpcmVkKSByZXR1cm4gclxuICAgICAgICAgICAgZWxzZSBpZiAocj8ucmV0dXJuRmlyZWQpIHJldHVybiByXG4gICAgICAgIH1cbiAgICB9LFxuICAgIEV4cHJlc3Npb25TdGF0ZW1lbnQ6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgcmV0dXJuIGV4ZWN1dGVTaW5nbGUoY29kZS5leHByZXNzaW9uLCBtZXRhKVxuICAgIH0sXG4gICAgQXNzaWdubWVudEV4cHJlc3Npb246IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgbGV0IHJpZ2h0ID0gZXhlY3V0ZVNpbmdsZShjb2RlLnJpZ2h0LCBtZXRhKVxuICAgICAgICBsZXQgd3JhcHBlciA9IGV4ZWN1dGVTaW5nbGUoY29kZS5sZWZ0LCB7IC4uLm1ldGEsIHJldHVybklkUGFyZW50OiB0cnVlIH0pXG4gICAgICAgIGlmICh3cmFwcGVyKSB7XG4gICAgICAgICAgICBpZiAod3JhcHBlci5wYXJlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGxldCBiZWZvcmUgPSB3cmFwcGVyLnBhcmVudFt3cmFwcGVyLmlkXVxuICAgICAgICAgICAgICAgIGlmIChjb2RlLm9wZXJhdG9yID09PSAnPScpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlci5wYXJlbnRbd3JhcHBlci5pZF0gPSByaWdodFxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJys9Jykge1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnBhcmVudFt3cmFwcGVyLmlkXSA9IGJlZm9yZSArIHJpZ2h0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnLT0nKSB7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZXIucGFyZW50W3dyYXBwZXIuaWRdID0gYmVmb3JlIC0gcmlnaHRcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICcqPScpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlci5wYXJlbnRbd3JhcHBlci5pZF0gPSBiZWZvcmUgKiByaWdodFxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJy89Jykge1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnBhcmVudFt3cmFwcGVyLmlkXSA9IGJlZm9yZSAvIHJpZ2h0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnXj0nKSB7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZXIucGFyZW50W3dyYXBwZXIuaWRdID0gTWF0aC5wb3coYmVmb3JlLCByaWdodClcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvZGUub3BlcmF0b3IgPT09ICclPScpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlci5wYXJlbnRbd3JhcHBlci5pZF0gPSBiZWZvcmUgJSByaWdodFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGxheWVyID0gZmluZExheWVyKG1ldGEsIHdyYXBwZXIuaWQpXG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCByID0gbGF5ZXIuZmluZFVuaXQod3JhcHBlci5pZClcbiAgICAgICAgICAgICAgICAgICAgaWYgKHIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2RlLm9wZXJhdG9yID09PSAnPScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByID0gcmlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJys9Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHIgKz0gcmlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJy09Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHIgLT0gcmlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJyo9Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHIgKj0gcmlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJy89Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHIgLz0gcmlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJ149Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHIgPSBNYXRoLnBvdyhyLCByaWdodClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJyU9Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHIgJT0gcmlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnB1dFVuaXQoY29kZS5uYW1lLCByKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBGb3JTdGF0ZW1lbnQ6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgZm9yIChleGVjdXRlU2luZ2xlKGNvZGUuaW5pdCwgbWV0YSk7IGV4ZWN1dGVTaW5nbGUoY29kZS50ZXN0LCBtZXRhKTsgZXhlY3V0ZVNpbmdsZShjb2RlLnVwZGF0ZSwgbWV0YSkpIHtcbiAgICAgICAgICAgIGxldCByID0gZXhlY3V0ZVNpbmdsZShjb2RlLmJvZHksIG1ldGEpXG4gICAgICAgICAgICBpZiAocj8uYnJlYWtGaXJlZCkgYnJlYWtcbiAgICAgICAgICAgIGVsc2UgaWYgKHI/LnJldHVybkZpcmVkKSByZXR1cm4gclxuICAgICAgICB9XG4gICAgfSxcbiAgICBVcGRhdGVFeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGlmIChbJysrJywgJy0tJ10uaW5jbHVkZXMoY29kZS5vcGVyYXRvcikpIHtcbiAgICAgICAgICAgIGxldCB3cmFwcGVyID0gZXhlY3V0ZVNpbmdsZShjb2RlLmFyZ3VtZW50LCB7IC4uLm1ldGEsIHJldHVybklkUGFyZW50OiB0cnVlIH0pXG4gICAgICAgICAgICBpZiAod3JhcHBlcikge1xuICAgICAgICAgICAgICAgIGlmICh3cmFwcGVyLnBhcmVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBiZWZvcmUgPSB3cmFwcGVyLnBhcmVudFt3cmFwcGVyLmlkXVxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGJlZm9yZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2RlLm9wZXJhdG9yID09PSAnKysnKSBiZWZvcmUrK1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoY29kZS5vcGVyYXRvciA9PT0gJy0tJykgYmVmb3JlLS1cbiAgICAgICAgICAgICAgICAgICAgICAgIHdyYXBwZXIucGFyZW50W3dyYXBwZXIuaWRdID0gYmVmb3JlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsZXQgbGF5ZXIgPSBmaW5kTGF5ZXIobWV0YSwgd3JhcHBlci5pZClcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgciA9IGxheWVyLmZpbmRVbml0KHdyYXBwZXIuaWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgciA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvZGUub3BlcmF0b3IgPT09ICcrKycpIHIrK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChjb2RlLm9wZXJhdG9yID09PSAnLS0nKSByLS1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIucHV0VW5pdChjb2RlLm5hbWUsIHIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBDYWxsRXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBsZXQgcHJvcCA9IHVuZGVmaW5lZFxuICAgICAgICBpZiAoY29kZS5wcm9wZXJ0eSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoY29kZS5jYWxsZWUsIG1ldGEpO1xuICAgICAgICAgICAgcmV0dXJuIHIoLi4uY29kZS5hcmd1bWVudHMubWFwKChjOiBhbnkpID0+IGV4ZWN1dGVTaW5nbGUoYywgbWV0YSkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChjb2RlLmNhbGxlZS5wcm9wZXJ0eS50eXBlID09PSAnSWRlbnRpZmllcicpIHtcbiAgICAgICAgICAgICAgICBwcm9wID0gY29kZS5jYWxsZWUucHJvcGVydHkubmFtZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHIgPSBleGVjdXRlU2luZ2xlKGNvZGUuY2FsbGVlLm9iamVjdCwgbWV0YSk7XG4gICAgICAgICAgICByZXR1cm4gcltwcm9wXSguLi5jb2RlLmFyZ3VtZW50cy5tYXAoKGM6IGFueSkgPT4gZXhlY3V0ZVNpbmdsZShjLCBtZXRhKSkpXG4gICAgICAgIH1cbiAgICB9LFxuICAgIE1lbWJlckV4cHJlc3Npb246IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgbGV0IHByb3AgPSB1bmRlZmluZWRcbiAgICAgICAgaWYgKGNvZGUucHJvcGVydHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGV0IHIgPSBleGVjdXRlU2luZ2xlKGNvZGUub2JqZWN0LCBtZXRhKTtcbiAgICAgICAgICAgIGlmIChtZXRhLnJldHVybklkUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgcGFyZW50OiB1bmRlZmluZWQsIGlkOiBjb2RlLm5hbWUgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChjb2RlLmNvbXB1dGVkKSB7XG4gICAgICAgICAgICAgICAgcHJvcCA9IGV4ZWN1dGVTaW5nbGUoY29kZS5wcm9wZXJ0eSwgbWV0YSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChjb2RlLnByb3BlcnR5LnR5cGUgPT09ICdJZGVudGlmaWVyJykge1xuICAgICAgICAgICAgICAgICAgICBwcm9wID0gY29kZS5wcm9wZXJ0eS5uYW1lXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlLnByb3BlcnR5LnR5cGUgPT09ICdMaXRlcmFsJykge1xuICAgICAgICAgICAgICAgICAgICBwcm9wID0gY29kZS5wcm9wZXJ0eS52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgZmlsdGVyZWRNZXRhID0geyAuLi5tZXRhIH1cbiAgICAgICAgICAgIGRlbGV0ZSBmaWx0ZXJlZE1ldGFbJ3JldHVybklkUGFyZW50J11cbiAgICAgICAgICAgIGxldCByID0gZXhlY3V0ZVNpbmdsZShjb2RlLm9iamVjdCwgZmlsdGVyZWRNZXRhKTtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHIpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHAgPSByW3Byb3BdO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKC4uLmFyZ3M6IEFycmF5PGFueT4pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAocHJvcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3B1c2gnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByLnB1c2goLi4uYXJncylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnbWFwJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gci5tYXAoLi4uYXJncylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnZm9yRWFjaCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHIuZm9yRWFjaCguLi5hcmdzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWV0YS5yZXR1cm5JZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgcGFyZW50OiByLCBpZDogcHJvcCB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcltwcm9wXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG1ldGEucmV0dXJuSWRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgcGFyZW50OiByLCBpZDogcHJvcCB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJbcHJvcF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBTd2l0Y2hTdGF0ZW1lbnQ6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgbGV0IGRpc2MgPSBleGVjdXRlU2luZ2xlKGNvZGUuZGlzY3JpbWluYW50LCBtZXRhKVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvZGUuY2FzZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBjID0gY29kZS5jYXNlc1tpXVxuICAgICAgICAgICAgaWYgKGMudHlwZSA9PT0gJ1N3aXRjaENhc2UnKSB7XG4gICAgICAgICAgICAgICAgbGV0IGNhc2VDb25kID0gZXhlY3V0ZVNpbmdsZShjLnRlc3QsIG1ldGEpO1xuICAgICAgICAgICAgICAgIGlmIChkaXNjID09PSBjYXNlQ29uZCkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGMuY29uc2VxdWVudC5sZW5ndGhsOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBjbyA9IGMuY29uc2VxdWVudFtqXVxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHIgPSBleGVjdXRlU2luZ2xlKGNvLCBtZXRhKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHI/LnJldHVybkZpcmVkKSByZXR1cm4gclxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBsZXQgbmV3Q3JlYXR1cmVCcmFuY2ggPSBuZXcgQ3JlYXR1cmUobWV0YS5jcmVhdHVyZS5tb2R1bGUsIHsgLi4ubWV0YS5jcmVhdHVyZSwgcnVudGltZTogbWV0YS5jcmVhdHVyZS5ydW50aW1lLmNsb25lKCkgfSlcbiAgICAgICAgbGV0IG5ld01ldGFCcmFuY2ggPSBuZXcgRXhlY3V0aW9uTWV0YSh7IC4uLm1ldGEsIGNyZWF0dXJlOiBuZXdDcmVhdHVyZUJyYW5jaCB9KVxuICAgICAgICByZXR1cm4gZ2VuZXJhdGVDYWxsYmFja0Z1bmN0aW9uKGNvZGUsIG5ld01ldGFCcmFuY2gpXG4gICAgfSxcbiAgICBPYmplY3RFeHByZXNzaW9uOiAoY29kZTogYW55LCBtZXRhOiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgICAgIGxldCBvYmogPSB7fVxuICAgICAgICBjb2RlLnByb3BlcnRpZXMuZm9yRWFjaCgocHJvcGVydHk6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5LnR5cGUgPT09ICdQcm9wZXJ0eScpIHtcbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkua2V5LnR5cGUgPT09ICdJZGVudGlmaWVyJykge1xuICAgICAgICAgICAgICAgICAgICBvYmpbcHJvcGVydHkua2V5Lm5hbWVdID0gZXhlY3V0ZVNpbmdsZShwcm9wZXJ0eS52YWx1ZSwgbWV0YSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eS50eXBlID09PSAnU3ByZWFkRWxlbWVudCcpIHtcbiAgICAgICAgICAgICAgICAgICAgb2JqW3Byb3BlcnR5LmFyZ3VtZW50Lm5hbWVdID0gZXhlY3V0ZVNpbmdsZShwcm9wZXJ0eSwgbWV0YSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBvYmpcbiAgICB9LFxuICAgIEFycmF5RXhwcmVzc2lvbjogKGNvZGU6IGFueSwgbWV0YTogRXhlY3V0aW9uTWV0YSkgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0ID0gW11cbiAgICAgICAgY29kZS5lbGVtZW50cy5mb3JFYWNoKChhcnJFbDogYW55KSA9PiB7XG4gICAgICAgICAgICBsZXQgciA9IGV4ZWN1dGVTaW5nbGUoYXJyRWwsIG1ldGEpXG4gICAgICAgICAgICBpZiAoKGFyckVsLnR5cGUgPT09ICdTcHJlYWRFbGVtZW50JykgJiYgQXJyYXkuaXNBcnJheShyKSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKC4uLnIpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiByZXN1bHRcbiAgICB9LFxuICAgIFNwcmVhZEVsZW1lbnQ6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgbGV0IHNvdXJjZSA9IGV4ZWN1dGVTaW5nbGUoY29kZS5hcmd1bWVudCwgbWV0YSlcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoc291cmNlKSkge1xuICAgICAgICAgICAgcmV0dXJuIFsuLi5zb3VyY2VdXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4geyAuLi5zb3VyY2UgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBSZXR1cm5TdGF0ZW1lbnQ6IChjb2RlOiBhbnksIG1ldGE6IEV4ZWN1dGlvbk1ldGEpID0+IHtcbiAgICAgICAgcmV0dXJuIHsgdmFsdWU6IGV4ZWN1dGVTaW5nbGUoY29kZS5hcmd1bWVudCwgbWV0YSksIHJldHVybkZpcmVkOiB0cnVlIH1cbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgZXhlY3V0ZVNpbmdsZSwgZXhlY3V0ZUJsb2NrLCBFeGVjdXRpb25NZXRhIH1cbiIsIlxuaW1wb3J0IEJhc2VFbGVtZW50IGZyb20gXCIuLi9lbGVtZW50cy9CYXNlRWxlbWVudFwiO1xuaW1wb3J0IEJhc2VQcm9wIGZyb20gXCIuLi9wcm9wcy9CYXNlUHJvcFwiO1xuaW1wb3J0IEV4ZWN1dGlvbk1ldGEgZnJvbSBcIi4uL0V4ZWN1dGlvbk1ldGFcIjtcbmltcG9ydCBDcmVhdHVyZSBmcm9tIFwiLi4vQ3JlYXR1cmVcIjtcblxubGV0IGdlbmVyYXRlS2V5ID0gKCkgPT4ge1xuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCkuc3Vic3RyaW5nKDIpXG59XG5cbmZ1bmN0aW9uIGNsb25lPFQ+KGluc3RhbmNlOiBUKTogVCB7XG4gICAgY29uc3QgY29weSA9IG5ldyAoaW5zdGFuY2UuY29uc3RydWN0b3IgYXMgeyBuZXcoKTogVCB9KSgpO1xuICAgIE9iamVjdC5hc3NpZ24oY29weSwgaW5zdGFuY2UpO1xuICAgIHJldHVybiBjb3B5O1xufVxuXG5jb25zdCBwcmVwYXJlRWxlbWVudCA9IChcbiAgICB0eXBlTmFtZTogc3RyaW5nLFxuICAgIGRlZmF1bHRQcm9wczogeyBbaWQ6IHN0cmluZ106IEJhc2VQcm9wIH0sXG4gICAgb3ZlcnJpZGVuUHJvcHM6IHsgW2lkOiBzdHJpbmddOiBhbnkgfSxcbiAgICBkZWZhdWx0U3R5bGVzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sXG4gICAgb3ZlcnJpZGVuU3R5bGVzOiB7IFtpZDogc3RyaW5nXTogYW55IH0sXG4gICAgY2hpbGRyZW46IEFycmF5PEJhc2VFbGVtZW50PlxuKSA9PiB7XG4gICAgbGV0IGZpbmFsUHJvcHMgPSB7fVxuICAgIE9iamVjdC5rZXlzKGRlZmF1bHRQcm9wcykuZm9yRWFjaChwcm9wS2V5ID0+IHtcbiAgICAgICAgaWYgKG92ZXJyaWRlblByb3BzW3Byb3BLZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGxldCBicFByb3AgPSBkZWZhdWx0UHJvcHNbcHJvcEtleV1cbiAgICAgICAgICAgIGxldCBjb3BpZWRQcm9wID0gY2xvbmUoYnBQcm9wKVxuICAgICAgICAgICAgY29waWVkUHJvcC5zZXRWYWx1ZShvdmVycmlkZW5Qcm9wc1twcm9wS2V5XSlcbiAgICAgICAgICAgIGZpbmFsUHJvcHNbcHJvcEtleV0gPSBjb3BpZWRQcm9wXG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBsZXQgZmluYWxTdHlsZXMgPSB7IC4uLmRlZmF1bHRTdHlsZXMgfVxuICAgIGlmIChvdmVycmlkZW5TdHlsZXMpIGZpbmFsU3R5bGVzID0geyAuLi5maW5hbFN0eWxlcywgLi4ub3ZlcnJpZGVuU3R5bGVzIH1cbiAgICByZXR1cm4gbmV3IEJhc2VFbGVtZW50KG92ZXJyaWRlblByb3BzWydrZXknXSwgdHlwZU5hbWUsIGZpbmFsUHJvcHMsIGZpbmFsU3R5bGVzLCBjaGlsZHJlbilcbn1cblxuY29uc3QgbmVzdGVkQ29udGV4dCA9IChjcmVhdHVyZTogQ3JlYXR1cmUsIG90aGVyTWV0YXM/OiBFeGVjdXRpb25NZXRhKSA9PiB7XG4gICAgaWYgKG90aGVyTWV0YXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBFeGVjdXRpb25NZXRhKHsgLi4ub3RoZXJNZXRhcywgY3JlYXR1cmUsIGlzQW5vdGhlckNyZWF0dXJlOiB0cnVlIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5ldyBFeGVjdXRpb25NZXRhKHsgY3JlYXR1cmUsIGlzQW5vdGhlckNyZWF0dXJlOiB0cnVlIH0pXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCB7IGdlbmVyYXRlS2V5LCBwcmVwYXJlRWxlbWVudCwgbmVzdGVkQ29udGV4dCB9XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIG1zUGF0dGVybiA9IC9ebXMtLztcblxudmFyIF91cHBlcmNhc2VQYXR0ZXJuID0gLyhbQS1aXSkvZztcblxuLyoqXG4gKiBIeXBoZW5hdGVzIGEgY2FtZWxjYXNlZCBzdHJpbmcsIGZvciBleGFtcGxlOlxuICpcbiAqICAgPiBoeXBoZW5hdGUoJ2JhY2tncm91bmRDb2xvcicpXG4gKiAgIDwgXCJiYWNrZ3JvdW5kLWNvbG9yXCJcbiAqXG4gKiBGb3IgQ1NTIHN0eWxlIG5hbWVzLCB1c2UgYGh5cGhlbmF0ZVN0eWxlTmFtZWAgaW5zdGVhZCB3aGljaCB3b3JrcyBwcm9wZXJseVxuICogd2l0aCBhbGwgdmVuZG9yIHByZWZpeGVzLCBpbmNsdWRpbmcgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nXG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGh5cGhlbmF0ZShzdHJpbmcpIHtcbiAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKF91cHBlcmNhc2VQYXR0ZXJuLCAnLSQxJykudG9Mb3dlckNhc2UoKTtcbn1cblxuLyoqXG4gKiBIeXBoZW5hdGVzIGEgY2FtZWxjYXNlZCBDU1MgcHJvcGVydHkgbmFtZSwgZm9yIGV4YW1wbGU6XG4gKlxuICogICA+IGh5cGhlbmF0ZVN0eWxlTmFtZSgnYmFja2dyb3VuZENvbG9yJylcbiAqICAgPCBcImJhY2tncm91bmQtY29sb3JcIlxuICogICA+IGh5cGhlbmF0ZVN0eWxlTmFtZSgnTW96VHJhbnNpdGlvbicpXG4gKiAgIDwgXCItbW96LXRyYW5zaXRpb25cIlxuICogICA+IGh5cGhlbmF0ZVN0eWxlTmFtZSgnbXNUcmFuc2l0aW9uJylcbiAqICAgPCBcIi1tcy10cmFuc2l0aW9uXCJcbiAqXG4gKiBBcyBNb2Rlcm5penIgc3VnZ2VzdHMgKGh0dHA6Ly9tb2Rlcm5penIuY29tL2RvY3MvI3ByZWZpeGVkKSwgYW4gYG1zYCBwcmVmaXhcbiAqIGlzIGNvbnZlcnRlZCB0byBgLW1zLWAuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0cmluZ1xuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5mdW5jdGlvbiBoeXBoZW5hdGVTdHlsZU5hbWUoc3RyaW5nKSB7XG4gIHJldHVybiBoeXBoZW5hdGUoc3RyaW5nKS5yZXBsYWNlKG1zUGF0dGVybiwgJy1tcy0nKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgaHlwaGVuYXRlU3R5bGVOYW1lXG4iLCJcbmltcG9ydCBnZW5lcmF0b3IgZnJvbSAnLi9nZW5lcmF0b3InXG5pbXBvcnQgY29tcGlsZXIgZnJvbSAnLi9jb21waWxlcidcbmltcG9ydCBqc29uIGZyb20gJy4vanNvbidcbmltcG9ydCBleGVjdXRvciBmcm9tICcuL2V4ZWN1dG9yJ1xuXG5leHBvcnQgZGVmYXVsdCB7IGdlbmVyYXRvciwgY29tcGlsZXIsIGpzb24sIGV4ZWN1dG9yIH1cbiIsIlxuaW1wb3J0IEJhc2VFbGVtZW50IGZyb20gXCIuLi9lbGVtZW50cy9CYXNlRWxlbWVudFwiXG5cbmxldCBwcmV0dGlmeSA9IChvYmo6IGFueSkgPT4ge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShvYmosIHVuZGVmaW5lZCwgNClcbn1cblxubGV0IHVwZGF0ZXMgPSBbXVxuXG5sZXQgZmluZENoYW5nZXMgPSAocGFyZW50S2V5OiBzdHJpbmcsIGVsMTogQmFzZUVsZW1lbnQsIGVsMjogQmFzZUVsZW1lbnQpID0+IHtcbiAgICBpZiAoZWwxLl9rZXkgIT09IGVsMi5fa2V5KSB7XG4gICAgICAgIHVwZGF0ZXMucHVzaChcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBfX2FjdGlvbl9fOiAnZWxlbWVudF9kZWxldGVkJyxcbiAgICAgICAgICAgICAgICBfX2tleV9fOiBlbDEuX2tleSxcbiAgICAgICAgICAgICAgICBfX3BhcmVudEtleV9fOiBwYXJlbnRLZXlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgX19hY3Rpb25fXzogJ2VsZW1lbnRfY3JlYXRlZCcsXG4gICAgICAgICAgICAgICAgX19rZXlfXzogZWwyLl9rZXksXG4gICAgICAgICAgICAgICAgX19lbGVtZW50X186IGVsMixcbiAgICAgICAgICAgICAgICBfX3BhcmVudEtleV9fOiBwYXJlbnRLZXlcbiAgICAgICAgICAgIH1cbiAgICAgICAgKVxuICAgICAgICByZXR1cm5cbiAgICB9XG4gICAgbGV0IHByb3BzQ2hhbmdlcyA9IHsgX19hY3Rpb25fXzogJ3Byb3BzX3VwZGF0ZWQnLCBfX2tleV9fOiBlbDIuX2tleSwgX19jcmVhdGVkX186IHt9LCBfX2RlbGV0ZWRfXzoge30sIF9fdXBkYXRlZF9fOiB7fSB9XG4gICAgZm9yIChsZXQgcEtleSBpbiBlbDIuX3Byb3BzKSB7XG4gICAgICAgIGlmIChlbDEuX3Byb3BzW3BLZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHByb3BzQ2hhbmdlcy5fX2NyZWF0ZWRfX1twS2V5XSA9IGVsMi5fcHJvcHNbcEtleV1cbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGxldCBwS2V5IGluIGVsMS5fcHJvcHMpIHtcbiAgICAgICAgaWYgKGVsMi5fcHJvcHNbcEtleV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcHJvcHNDaGFuZ2VzLl9fZGVsZXRlZF9fW3BLZXldID0gZWwyLl9wcm9wc1twS2V5XVxuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAobGV0IHBLZXkgaW4gZWwyLl9wcm9wcykge1xuICAgICAgICBpZiAoZWwxLl9wcm9wc1twS2V5XSAhPT0gdW5kZWZpbmVkICYmIGVsMi5fcHJvcHNbcEtleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGVsMS5fcHJvcHNbcEtleV0uZ2V0VmFsdWUoKSAhPT0gZWwyLl9wcm9wc1twS2V5XS5nZXRWYWx1ZSgpKSB7XG4gICAgICAgICAgICAgICAgcHJvcHNDaGFuZ2VzLl9fdXBkYXRlZF9fW3BLZXldID0gZWwyLl9wcm9wc1twS2V5XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcbiAgICAgICAgKE9iamVjdC5rZXlzKHByb3BzQ2hhbmdlcy5fX2NyZWF0ZWRfXykubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgKE9iamVjdC5rZXlzKHByb3BzQ2hhbmdlcy5fX2RlbGV0ZWRfXykubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgKE9iamVjdC5rZXlzKHByb3BzQ2hhbmdlcy5fX3VwZGF0ZWRfXykubGVuZ3RoID4gMClcbiAgICApIHtcbiAgICAgICAgdXBkYXRlcy5wdXNoKHByb3BzQ2hhbmdlcylcbiAgICB9XG4gICAgbGV0IHN0eWxlc0NoYW5nZXMgPSB7IF9fYWN0aW9uX186ICdzdHlsZXNfdXBkYXRlZCcsIF9fa2V5X186IGVsMi5fa2V5LCBfX2NyZWF0ZWRfXzoge30sIF9fZGVsZXRlZF9fOiB7fSwgX191cGRhdGVkX186IHt9IH1cbiAgICBmb3IgKGxldCBzS2V5IGluIGVsMi5fc3R5bGVzKSB7XG4gICAgICAgIGlmIChlbDEuX3N0eWxlc1tzS2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdHlsZXNDaGFuZ2VzLl9fY3JlYXRlZF9fW3NLZXldID0gZWwyLl9zdHlsZXNbc0tleV1cbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGxldCBzS2V5IGluIGVsMS5fc3R5bGVzKSB7XG4gICAgICAgIGlmIChlbDIuX3N0eWxlc1tzS2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdHlsZXNDaGFuZ2VzLl9fZGVsZXRlZF9fW3NLZXldID0gZWwyLl9zdHlsZXNbc0tleV1cbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGxldCBzS2V5IGluIGVsMi5fc3R5bGVzKSB7XG4gICAgICAgIGlmIChlbDEuX3N0eWxlc1tzS2V5XSAhPT0gdW5kZWZpbmVkICYmIGVsMi5fc3R5bGVzW3NLZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChlbDEuX3N0eWxlc1tzS2V5XSAhPT0gZWwyLl9zdHlsZXNbc0tleV0pIHtcbiAgICAgICAgICAgICAgICBzdHlsZXNDaGFuZ2VzLl9fdXBkYXRlZF9fW3NLZXldID0gZWwyLl9zdHlsZXNbc0tleV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoXG4gICAgICAgIChPYmplY3Qua2V5cyhzdHlsZXNDaGFuZ2VzLl9fY3JlYXRlZF9fKS5sZW5ndGggPiAwKSB8fFxuICAgICAgICAoT2JqZWN0LmtleXMoc3R5bGVzQ2hhbmdlcy5fX2RlbGV0ZWRfXykubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgKE9iamVjdC5rZXlzKHN0eWxlc0NoYW5nZXMuX191cGRhdGVkX18pLmxlbmd0aCA+IDApXG4gICAgKSB7XG4gICAgICAgIHVwZGF0ZXMucHVzaChzdHlsZXNDaGFuZ2VzKVxuICAgIH1cbiAgICBsZXQgY3MgPSB7fVxuICAgIGVsMi5fY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiB7IGNzW2NoaWxkLl9rZXldID0gY2hpbGQgfSlcbiAgICBlbDEuX2NoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xuICAgICAgICBpZiAoY3NbY2hpbGQuX2tleV0pIHtcbiAgICAgICAgICAgIGZpbmRDaGFuZ2VzKGVsMS5fa2V5LCBjaGlsZCwgY3NbY2hpbGQuX2tleV0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1cGRhdGVzLnB1c2goXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBfX2FjdGlvbl9fOiAnZWxlbWVudF9kZWxldGVkJyxcbiAgICAgICAgICAgICAgICAgICAgX19rZXlfXzogY2hpbGQuX2tleSxcbiAgICAgICAgICAgICAgICAgICAgX19wYXJlbnRLZXlfXzogZWwxLl9rZXlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApXG4gICAgICAgIH1cbiAgICB9KVxuICAgIGNzID0ge31cbiAgICBlbDEuX2NoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4geyBjc1tjaGlsZC5fa2V5XSA9IGNoaWxkIH0pXG4gICAgZWwyLl9jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgICAgaWYgKCFjc1tjaGlsZC5fa2V5XSkge1xuICAgICAgICAgICAgdXBkYXRlcy5wdXNoKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgX19hY3Rpb25fXzogJ2VsZW1lbnRfY3JlYXRlZCcsXG4gICAgICAgICAgICAgICAgICAgIF9fa2V5X186IGNoaWxkLl9rZXksXG4gICAgICAgICAgICAgICAgICAgIF9fZWxlbWVudF9fOiBjaGlsZCxcbiAgICAgICAgICAgICAgICAgICAgX19wYXJlbnRLZXlfXzogZWwyLl9rZXlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApXG4gICAgICAgIH1cbiAgICB9KVxufVxuXG5sZXQgZGlmZiA9IChlbDE6IEJhc2VFbGVtZW50LCBlbDI6IEJhc2VFbGVtZW50KSA9PiB7XG4gICAgdXBkYXRlcyA9IFtdXG4gICAgZmluZENoYW5nZXModW5kZWZpbmVkLCBlbDEsIGVsMilcbiAgICByZXR1cm4gdXBkYXRlc1xufVxuXG5leHBvcnQgZGVmYXVsdCB7IHByZXR0aWZ5LCBkaWZmIH1cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCJcbmltcG9ydCBNb2R1bGUgZnJvbSAnLi93aWRnZXQvTW9kdWxlJ1xuaW1wb3J0IEFwcGxldCwgeyBSdW5uYWJsZSB9IGZyb20gJy4vd2lkZ2V0L0FwcGxldCdcbmltcG9ydCBVdGlscyBmcm9tICcuL3dpZGdldC91dGlscydcbmltcG9ydCBDb250cm9scyBmcm9tICcuL3dpZGdldC9jb250cm9scydcbi8vIGltcG9ydCBOYXRpdmUgZnJvbSAnLi9uYXRpdmUnXG5cbi8vIGxldCBhcHBsZXQgPSBuZXcgQXBwbGV0KCdmcmFtZScpXG4vLyBhcHBsZXQuZmlsbChgXG4vLyBjbGFzcyBCb3gge1xuLy8gICAgIGNvbnN0cnVjdG9yKCkge1xuXG4vLyAgICAgfVxuLy8gICAgIG9uTW91bnQoKSB7XG5cbi8vICAgICB9XG4vLyAgICAgcmVuZGVyKCkge1xuLy8gICAgICAgICByZXR1cm4gbmF0aXZlRWxlbWVudCgnYm94JywgdGhpcy5wcm9wcywgdGhpcy5zdHlsZXMsIHRoaXMuY2hpbGRyZW4pXG4vLyAgICAgfVxuLy8gfVxuLy8gY2xhc3MgVGV4dCB7XG4vLyAgICAgY29uc3RydWN0b3IoKSB7XG5cbi8vICAgICB9XG4vLyAgICAgb25Nb3VudCgpIHtcblxuLy8gICAgIH1cbi8vICAgICByZW5kZXIoKSB7XG4vLyAgICAgICAgIHJldHVybiBuYXRpdmVFbGVtZW50KCd0ZXh0JywgdGhpcy5wcm9wcywgdGhpcy5zdHlsZXMsIFtdKVxuLy8gICAgIH1cbi8vIH1cbi8vIGNsYXNzIEJ1dHRvbiB7XG4vLyAgICAgY29uc3RydWN0b3IoKSB7XG5cbi8vICAgICB9XG4vLyAgICAgb25Nb3VudCgpIHtcblxuLy8gICAgIH1cbi8vICAgICByZW5kZXIoKSB7XG4vLyAgICAgICAgIHJldHVybiBuYXRpdmVFbGVtZW50KCdidXR0b24nLCB0aGlzLnByb3BzLCB0aGlzLnN0eWxlcywgW10pXG4vLyAgICAgfVxuLy8gfVxuLy8gY2xhc3MgVGFicyB7XG4vLyAgICAgY29uc3RydWN0b3IoKSB7XG5cbi8vICAgICB9XG4vLyAgICAgb25Nb3VudCgpIHtcblxuLy8gICAgIH1cbi8vICAgICByZW5kZXIoKSB7XG4vLyAgICAgICAgIHJldHVybiBuYXRpdmVFbGVtZW50KCd0YWJzJywgdGhpcy5wcm9wcywgdGhpcy5zdHlsZXMsIHRoaXMuY2hpbGRyZW4pXG4vLyAgICAgfVxuLy8gfVxuLy8gY2xhc3MgUHJpbWFyeVRhYiB7XG4vLyAgICAgY29uc3RydWN0b3IoKSB7XG5cbi8vICAgICB9XG4vLyAgICAgb25Nb3VudCgpIHtcblxuLy8gICAgIH1cbi8vICAgICByZW5kZXIoKSB7XG4vLyAgICAgICAgIHJldHVybiBuYXRpdmVFbGVtZW50KCdwcmltYXJ5LXRhYicsIHRoaXMucHJvcHMsIHRoaXMuc3R5bGVzLCB0aGlzLmNoaWxkcmVuKVxuLy8gICAgIH1cbi8vIH1cbi8vIGNsYXNzIEZvb2Qge1xuLy8gICAgIGNvbnN0cnVjdG9yKCkge1xuLy8gICAgICAgICB0aGlzLnN0YXRlID0ge1xuLy8gICAgICAgICAgICAgY291bnQ6IDBcbi8vICAgICAgICAgfVxuLy8gICAgIH1cbi8vICAgICBvbk1vdW50KCkge1xuICAgICAgICBcbi8vICAgICB9XG4vLyAgICAgcmVuZGVyKCkge1xuLy8gICAgICAgICBsZXQgeyBmb29kIH0gPSB0aGlzLnByb3BzXG4vLyAgICAgICAgIGxldCB7IGNvdW50IH0gPSB0aGlzLnN0YXRlXG4vLyAgICAgICAgIHJldHVybiAoXG4vLyAgICAgICAgICAgICA8Qm94IGtleT17Zm9vZC5pZH0gc3R5bGU9e3sgbWFyZ2luOiA4LCB3aWR0aDogMTAwLCBoZWlnaHQ6IDEwMCwgYmFja2dyb3VuZENvbG9yOiAnI2ZmZicgfX0+XG4vLyAgICAgICAgICAgICAgICAgPFRleHQgdGV4dD17Zm9vZC5pZH0gc3R5bGU9e3sgd2lkdGg6ICcxMDAlJywgaGVpZ2h0OiAnNTAlJywgZGlzcGxheTogJ2ZsZXgnLCB2ZXJ0aWNhbEFsaWduOiAnbWlkZGxlJywgdGV4dEFsaWduOiAnY2VudGVyJywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJyB9fSAvPlxuLy8gICAgICAgICAgICAgICAgIDxUZXh0IHRleHQ9e2NvdW50fSBzdHlsZT17eyB3aWR0aDogJzEwMCUnLCBoZWlnaHQ6ICc1MCUnLCBkaXNwbGF5OiAnZmxleCcsIHZlcnRpY2FsQWxpZ246ICdtaWRkbGUnLCB0ZXh0QWxpZ246ICdjZW50ZXInLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInIH19IC8+XG4vLyAgICAgICAgICAgICAgICAgPEJveCBzdHlsZT17eyB3aWR0aDogJzEwMCUnLCBoZWlnaHQ6IDMyLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLCB0ZXh0QWxpZ246ICdjZW50ZXInLCBkaXNwbGF5OiAnZmxleCcgfX0+XG4vLyAgICAgICAgICAgICAgICAgICAgIDxCdXR0b24gc3R5bGU9e3sgd2lkdGg6IDMyLCBoZWlnaHQ6IDMyIH19IGNhcHRpb249Jy0nIG9uQ2xpY2s9eygpID0+IHRoaXMuc2V0U3RhdGUoeyBjb3VudDogY291bnQgKyAxIH0pfSAvPlxuLy8gICAgICAgICAgICAgICAgICAgICA8QnV0dG9uIHN0eWxlPXt7IHdpZHRoOiAzMiwgaGVpZ2h0OiAzMiB9fSBjYXB0aW9uPScrJyAvPlxuLy8gICAgICAgICAgICAgICAgIDwvQm94PlxuLy8gICAgICAgICAgICAgPC9Cb3g+XG4vLyAgICAgICAgIClcbi8vICAgICB9XG4vLyB9XG4vLyBjbGFzcyBUZXN0IHtcbi8vICAgICBjb25zdHJ1Y3RvcigpIHtcbi8vICAgICAgICAgdGhpcy5zdGF0ZSA9IHtcbi8vICAgICAgICAgICAgIHNlbGVjdGVkQ2F0ZWdvcnlJZDogJ3BpenphJyxcbi8vICAgICAgICAgICAgIG1lbnU6IHtcbi8vICAgICAgICAgICAgICAgICBwaXp6YTogW1xuLy8gICAgICAgICAgICAgICAgICAgICB7XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICBpZDogJ3BpenphIDEnLFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IDBcbi8vICAgICAgICAgICAgICAgICAgICAgfSxcbi8vICAgICAgICAgICAgICAgICAgICAge1xuLy8gICAgICAgICAgICAgICAgICAgICAgICAgaWQ6ICdwaXp6YSAyJyxcbi8vICAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiAwXG4vLyAgICAgICAgICAgICAgICAgICAgIH1cbi8vICAgICAgICAgICAgICAgICBdLFxuLy8gICAgICAgICAgICAgICAgIHBhc3RhOiBbXG4vLyAgICAgICAgICAgICAgICAgICAgIHtcbi8vICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiAncGFzdGEgMScsXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogMFxuLy8gICAgICAgICAgICAgICAgICAgICB9LFxuLy8gICAgICAgICAgICAgICAgICAgICB7XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICBpZDogJ3Bhc3RhIDInLFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IDBcbi8vICAgICAgICAgICAgICAgICAgICAgfVxuLy8gICAgICAgICAgICAgICAgIF1cbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgfVxuLy8gICAgIH1cbi8vICAgICBvbk1vdW50KCkge1xuLy8gICAgICAgICB0aGlzLnNldFN0YXRlKHsgLi4udGhpcy5zdGF0ZSwgc2VsZWN0ZWRDYXRlZ29yeUlkOiBjYXRzW2UudGFyZ2V0LmFjdGl2ZVRhYkluZGV4XSB9KVxuLy8gICAgIH1cbi8vICAgICByZW5kZXIoKSB7XG4vLyAgICAgICAgIGxldCBjYXRzID0gT2JqZWN0LmtleXModGhpcy5zdGF0ZS5tZW51KVxuLy8gICAgICAgICByZXR1cm4gKFxuLy8gICAgICAgICAgICAgPEJveCBzdHlsZT17eyB3aWR0aDogJzEwMCUnLCBoZWlnaHQ6ICcxMDAlJywgYmFja2dyb3VuZENvbG9yOiAnI2VlZScgfX0+XG4vLyAgICAgICAgICAgICAgICAgPFRhYnMgb25DaGFuZ2U9e2UgPT4ge1xuLy8gICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFN0YXRlKHsgLi4udGhpcy5zdGF0ZSwgc2VsZWN0ZWRDYXRlZ29yeUlkOiBjYXRzW2UudGFyZ2V0LmFjdGl2ZVRhYkluZGV4XSB9KVxuLy8gICAgICAgICAgICAgICAgIH19PlxuLy8gICAgICAgICAgICAgICAgICAgICB7XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICBjYXRzLm1hcChjYXQgPT4ge1xuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiA8UHJpbWFyeVRhYj48VGV4dCBzdHlsZT17eyB3aWR0aDogJzEwMCUnLCB0ZXh0QWxpZ246ICdjZW50ZXInIH19IHRleHQ9e2NhdH0gLz48L1ByaW1hcnlUYWI+XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuLy8gICAgICAgICAgICAgICAgICAgICB9XG4vLyAgICAgICAgICAgICAgICAgPC9UYWJzPlxuLy8gICAgICAgICAgICAgICAgIDxCb3ggc3R5bGU9e3sgd2lkdGg6ICcxMDAlJywgaGVpZ2h0OiAnY2FsYygxMDAlIC0gNTBweCknLCBvdmVyZmxvd1k6ICdhdXRvJywgZGlzcGxheTogJ2ZsZXgnLCBmbGV4V3JhcDogJ3dyYXAnIH19PlxuLy8gICAgICAgICAgICAgICAgICAgICB7XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRlLm1lbnVbdGhpcy5zdGF0ZS5zZWxlY3RlZENhdGVnb3J5SWRdLm1hcChmb29kID0+IHtcbi8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Rm9vZCBrZXk9e2Zvb2QuaWR9IGZvb2Q9e2Zvb2R9IC8+XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgfSlcbi8vICAgICAgICAgICAgICAgICAgICAgfVxuLy8gICAgICAgICAgICAgICAgIDwvQm94PlxuLy8gICAgICAgICAgICAgPC9Cb3g+XG4vLyAgICAgICAgIClcbi8vICAgICB9XG4vLyB9XG4vLyBgKVxuXG4vLyBjb25zdCB1cGRhdGUgPSAoa2V5LCB1cGRhdGVzKSA9PiB7XG4vLyAgICAgY29uc29sZS5sb2coVXRpbHMuanNvbi5wcmV0dGlmeSh1cGRhdGVzKSlcbi8vIH1cbi8vIGFwcGxldC5ydW4oJ1Rlc3QnLCBtb2QgPT4gbmV3IE5hdGl2ZShtb2QsIENvbnRyb2xzKSwgdXBkYXRlKS50aGVuKChydW5uYWJsZTogYW55KSA9PiB7XG4vLyAgICAgY29uc29sZS5sb2coVXRpbHMuanNvbi5wcmV0dGlmeShydW5uYWJsZS5yb290KSlcbi8vICAgICBydW5uYWJsZS5tb3VudCgpXG4vLyB9KVxuXG5leHBvcnQge1xuICAgIEFwcGxldCxcbiAgICBSdW5uYWJsZSxcbiAgICBNb2R1bGUsXG4gICAgVXRpbHMsXG4gICAgQ29udHJvbHNcbn0iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=
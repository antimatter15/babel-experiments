// i know that syntax extensions without extensive
// vetting by mystical committees is evil, but this 
// isn't some plugin available in the wild (ie. 
// outside carbide) to poison the babel ecosystem
// or some shit like that

// This whole file is pretty nasty and hacky
// in large part because of how much the syntax
// has evolved over the past few days. It's 
// long overdue for a rewrite, and I'd really
// appreciate it if anyone would undertake
// this effort.

// particularly hairy bits are how it parses matrices
// (rather than adding new tokens and syntax elements
// to represent matrix expressions, it just transforms
// them into CallExpressions)

// also the handling of subscript assignments is not exactly 
// satisfying

// not really unexpected for something named watlab though

// KNOWN PROBLEMS:
// The matrix syntax fucks up the placement of comments and stuff

import { TokenType, types as tt } from "babylon/lib/tokenizer/types";
import { plugins, prototype as pp } from "babylon/lib/parser";

tt.transpose = new TokenType("transpose", {prefix: false, postfix: false, startsExpr: false});
tt.matrix = new TokenType('matrix', {beforeExpr: true, startsExpr: true})
tt.matsub = new TokenType(".[", {beforeExpr: true, startsExpr: true})
tt.apply = new TokenType("@@", {beforeExpr: true, binop: 12 })

plugins.WATLab = function (instance) {
  instance.extend("getTokenFromCode", function(inner){
    return function(code){
      var elmops = {
        "+": tt.plusMin,
        "-": tt.plusMin,
        "*": tt.star,
        "%": tt.modulo, 
        "^": tt.exponent, 
        "|": tt.bitwiseOR,
        "/": tt.slash,
        "\\": tt.slash,
        "<": tt.relational,
        ">": tt.relational,
        ">=": tt.relational,
        "<=": tt.relational,
        "=": tt.equality,
        "[": tt.matsub, 
      }
      var matops = {
        "*": tt.star, // matrix multiply
        "+": tt.plusMin,
        "-": tt.plusMin,
        "^": tt.exponent, // matrix exponentiation
        "\\": tt.slash, // matrix backsolve
        "/": tt.slash, // matrix divide

        "@": tt.apply, // function application
        ".": tt.apply, // function mapping
      }
      var next = this.input[this.state.pos + 1],
          next2 = this.input.substr(this.state.pos, 2)
      if(code == 46){ // .
        if(next in elmops){
          this.state.pos += 2;
          return this.finishToken(elmops[next], '.' + next)
        }else if(next2 in elmops){
          this.state.pos += 3;
          return this.finishToken(elmops[next], '.' + next)
        }
      }else{
        if(code == 64 && next == '['){
          // why the @ symbol? 
          
          // because @ means matrix, and . means elementwise
          // also, it allows you to have a matrix at the beginning
          // of a line and you don't have to worry about dangling
          // unsemicoloned [] or () from the previous line

          this.state.pos += 2;
          return this.finishToken(tt.matrix, '@[')
        }
        var lastTT = this.state.tokens[this.state.tokens.length - 1];
        // console.log(lastTT && lastTT.type)
        if(lastTT && (lastTT.type == tt.name 
          || lastTT.type == tt.bracketR
          || lastTT.type == tt.string
          || lastTT.type == tt.backQuote
          || lastTT.type == tt.regexp
          || lastTT.type == tt.num
          || lastTT.type == tt.transpose
          || lastTT.type == tt.parenR)){
          // console.log('parental units', code)
          if(code == 64){ // @
            this.state.pos++
            if(next in matops){
              this.state.pos++;
              return this.finishToken(matops[next], '@' + next)
            }
            // return this.finishToken(tt.star, '@')
          }else if(code == 39 
            && this.state.curLine === lastTT.loc.end.line // dont accept transpose beginning a line
          ){ // '
            this.state.pos++
            return this.finishToken(tt.transpose, "'")  
          }
        }
      } 
      return inner.call(this, code)
    }
  })
  instance.extend("parseExprAtom", function(inner){
    return function(refShorthandDefaultPos){
      if(this.state.type == tt.matrix){
        let node = this.startNode();
        let mat = this.startNode();
        this.next();
        // let elements = this.parseMatrix() //this.parseExprList(tt.bracketR, true, true, refShorthandDefaultPos)
        let elements = this.parseSimpleMatrix()
        let id = this.startNode();
        id.name = '@matrix'
        mat.callee = this.finishNode(id, 'Identifier');
        mat.arguments = elements.map(row => {
          let node = this.startNode();
          node.elements = row;
          this.toReferencedList(node.elements);
          return this.finishNode(node, "ArrayExpression")
        })
        return this.finishNode(mat, "CallExpression")

      }
      return inner.call(this, refShorthandDefaultPos)
    }
  })

  instance.extend('parseSimpleMatrix', function(){
    return function(){
      let allowTrailingComma = true;
      let allowEmpty = true;
      let close = tt.bracketR;

      let rows = [[]];
      let elts = rows[0], first = true;
      while (!this.eat(close)) {
        if (first) {
          first = false;
        } else {
          if(this.eat(tt.semi)){
            elts = []
            rows.push(elts)
          }else{
            // allow space delimiters sometimes
            if(this.state.type != tt.num){
              this.expect(tt.comma);  
            }else{
              this.eat(tt.comma)
            }
          }
          if (allowTrailingComma && this.eat(close)) break;
        }
        elts.push(this.parseExprListItem(allowEmpty, null));
      }
      return rows
    }
  })

  instance.extend('parseMatrix', function(){
    return function(){
      let allowTrailingComma = true;
      let allowEmpty = true;
      let close = tt.bracketR;

      let rows = [[]];
      let elts = rows[0], first = true;
      while (!this.eat(close)) {
        if (first) {
          first = false;
        } else {
          if(this.eat(tt.semi)){
            elts = []
            rows.push(elts)
          }else{
            this.eat(tt.comma)
          }
          if (allowTrailingComma && this.eat(close)) break;
        }
        if(this.match(tt.plusMin)){
          let node = this.startNode();
          node.prefix = true;
          node.operator = this.state.value;
          this.expect(tt.plusMin)
          // node.argument = this.parseExprAtom(null);
          node.argument = this.parseNoCallExpr()
          elts.push(this.finishNode(node, 'UnaryExpression'))
        }else{
          // elts.push(this.parseExprAtom(null));  
          elts.push(this.parseNoCallExpr())
        }
      }
      return rows
    }
  })

  instance.extend("parseMatrixSubscript", function(){
    return function(){
      let close = tt.bracketR;
      let elts = [], first = true;
      do {
        if(first){
          first = false
        }else{
          this.expect(tt.comma)
          if(this.eat(close)) break;
        }
        // [:]
        // [:,:]
        // [1:]
        // [:1]
        // [1:2]

        let left = this.finishNode(this.startNode(), "NullLiteral"),
            right = this.finishNode(this.startNode(), "NullLiteral"),
            singular = false;

        // ugh i'm sorry

        if(this.eat(tt.colon)){
          // skip the left side
          if(this.match(tt.comma) || this.match(close)){
            // skip right side
          }else{
            // read in right side
            right = this.parseMaybeAssign(false, null)
          }
        }else{
          // read in left side
          left = this.parseMaybeAssign(false, null)
          if(this.eat(tt.colon)){
            if(this.match(tt.comma) || this.match(close)){
              // skip the right side
            }else{
              // read in right side
              right = this.parseMaybeAssign(false, null)
            }
          }else{
            singular = true;
          }
        }
        if(singular){
          elts.push(left)
        }else{
          let node = this.startNode();
          node.elements = [left, right];
          this.toReferencedList(node.elements);
          elts.push(this.finishNode(node, "ArrayExpression"))
        }
      } while (!this.eat(close));
      return elts;
    }
  })

  // I don't really want to create a new type of expression
  // so here we're parsing a transpost postfix operator as a callexpression
  instance.extend("parseSubscripts", function(inner){
    return function (base, startPos, startLoc, noCalls) {
      for (;;) {
        if(this.eat(tt.matsub)){
          
          var sel = this.startNode();
          let id = this.startNode();
          id.name = '@select'
          id.isInternal = true;
          sel.callee = this.finishNode(id, 'Identifier');
          sel.isInternal = true;

          // let elements = this.parseExprList(tt.bracketR, true, true, null)
          let elements = this.parseMatrixSubscript()
          sel.arguments = elements
          // node.arguments = [base].concat(elements)
          // base = this.finishNode(node, "CallExpression");

          let node = this.startNodeAt(startPos, startLoc);
          node.object = base;
          // node.property = this.parseExpression();
          // node.property = this.finishNode(id, 'Identifier');
          node.property = this.finishNode(sel, "CallExpression");

          node.computed = true;
          // this.expect(tt.bracketR);
          base = this.finishNode(node, "MemberExpression");

          // the babel post-transform is pretty fragile
          // and doesn't support chained matrix selections
          // return base;
        }else if(this.eat(tt.transpose)){
          var node = this.startNodeAt(startPos, startLoc);
          let id = this.startNode();
          id.name = '@transpose'
          node.callee = this.finishNode(id, 'Identifier');
          node.arguments = [base]
          base = this.finishNode(node, "CallExpression");
        }else if (!noCalls && this.eat(tt.doubleColon)) {
          let node = this.startNodeAt(startPos, startLoc);
          node.object = base;
          node.callee = this.parseNoCallExpr();
          return this.parseSubscripts(this.finishNode(node, "BindExpression"), startPos, startLoc, noCalls);
        } else if (this.eat(tt.dot)) {
          // vectorized function apply
          if(this.eat(tt.parenL)){
            // console.log('omg vectorized function apply')
            let node = this.startNodeAt(startPos, startLoc);
            node.callee = base;
            node.arguments = this.parseCallExpressionArguments(tt.parenR, this.hasPlugin("trailingFunctionCommas"), false);
            base = this.finishNode(node, "CallExpression");
            base.vectorized = true;
            this.toReferencedList(node.arguments);
          }else{

            let node = this.startNodeAt(startPos, startLoc);
            node.object = base;
            node.property = this.parseIdentifier(true);
            node.computed = false;
            base = this.finishNode(node, "MemberExpression");
          }
        } else if (this.eat(tt.bracketL)) {
          let node = this.startNodeAt(startPos, startLoc);
          node.object = base;
          node.property = this.parseExpression();
          node.computed = true;
          this.expect(tt.bracketR);
          base = this.finishNode(node, "MemberExpression");
        } else if (!noCalls && this.match(tt.parenL)) {
          let possibleAsync = this.state.potentialArrowAt === base.start && base.type === "Identifier" && base.name === "async" && !this.canInsertSemicolon();
          this.next();

          let node = this.startNodeAt(startPos, startLoc);
          node.callee = base;
          node.arguments = this.parseCallExpressionArguments(tt.parenR, this.hasPlugin("trailingFunctionCommas"), possibleAsync);
          base = this.finishNode(node, "CallExpression");

          if (possibleAsync && this.shouldParseAsyncArrow()) {
            return this.parseAsyncArrowFromCallExpression(this.startNodeAt(startPos, startLoc), node);
          } else {
            this.toReferencedList(node.arguments);
          }
        } else if (this.match(tt.backQuote)) {
          let node = this.startNodeAt(startPos, startLoc);
          node.tag = base;
          node.quasi = this.parseTemplate();
          base = this.finishNode(node, "TaggedTemplateExpression");
        } else {
          return base;
        }
      }
    }
  })
}


export default function({ types: t }) {
  function wat(name){
    return t.memberExpression(t.identifier('__watlab'), t.identifier(name))
  }
  return {
    manipulateOptions(opts, parserOpts) {
        parserOpts.plugins.push("WATLab");
    },
    visitor: {
      AssignmentExpression(path) {
        var {left, right} = path.node;

        if(t.isMemberExpression(left) &&
          t.isCallExpression(left.property) &&
          t.isIdentifier(left.property.callee, { name: '@select'})){
          path.replaceWith(
            t.callExpression(
              wat('assign'),
              [t.stringLiteral(path.node.operator), left.object, right].concat(left.property.arguments)
            )
          )
        }
      },
      MemberExpression(path){
        if(t.isCallExpression(path.node.property) &&
          t.isIdentifier(path.node.property.callee, { name: '@select'})){
          path.replaceWith(
            t.callExpression(
              wat('select'),
              [path.node.object].concat(path.node.property.arguments)
            )
          )
        }
      },
      CallExpression(path){
        if(t.isIdentifier(path.node.callee, { name: '@matrix' })){
          path.node.callee = wat('vcat')
          path.node.isMatrix = true;
        }else if(t.isIdentifier(path.node.callee, { name: '@transpose' })){
          path.node.callee = wat('transpose')
        }else if(path.node.vectorized){
          // pow.([42, -1], 2) => __watlab.map(pow, [42, -1], 2)
          path.replaceWith(t.callExpression(
            wat('map'), [path.node.callee].concat(path.node.arguments)
          ))
        }
      },
      UnaryExpression(path) {
        var replace = {
          ".+": "matrix2d", 
          ".-": "negate"
        }
        if(path.node.operator in replace){
          path.replaceWith(
            t.callExpression(
              wat(replace[path.node.operator]), [path.node.argument]
            )
          )
        }
      },
      BinaryExpression(path) {
        var replace = {
          ".+": "add", 
          ".-": "sub", 
          ".^": "exp", 
          ".*": "mul", 
          "@*": "mmul",
          "@^": "mexp",
          "@+": "madd", 
          "@-": "msub", 
          "@\\": "mldiv",
          "@/": "mdiv",
          "./": "div",
          ".\\": "ldiv",
          ".'": "tr",
          ".<": "lt",
          ".>": "gt",
          ".=": "eq",
          ".<=": "lte",
          ".>=": "gte",
        }
        if(path.node.operator in replace){
          path.replaceWith(
            t.callExpression(
              wat(replace[path.node.operator]), [
                path.node.left,
                path.node.right
              ]
            )
          )

        }else if(path.node.operator === '@@'){
          // postfix function application 

          if(t.isCallExpression(path.node.right)){
            path.replaceWith(t.callExpression(path.node.right.callee, 
              [path.node.left].concat(path.node.right.arguments)))
          }else{
            path.replaceWith(t.callExpression(path.node.right, [path.node.left]))
          }
        }else if(path.node.operator === '@.'){
          // function mapping
          if(t.isCallExpression(path.node.right)){
            path.replaceWith(t.callExpression(wat('map'), [
              path.node.right.callee,
              path.node.left
            ].concat(path.node.right.arguments)))
          }else{
            path.replaceWith(t.callExpression(wat('map'), [path.node.right, path.node.left]))
          }
        }
      },
    },
    // manipulateOptions(opts, parserOpts) {
    //   parserOpts.plugins.push("WATLab");
    // }
  };
}
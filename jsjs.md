# What is JSJS?

**JSJS**, or **JankyScript** as I like to call it, is arguably the ~~best~~ ~~worst~~ most interesting part of Bismuth.

Essentially, it's an extension to JavaScript syntax that allows you to generate [ESTree ASTs](https://github.com/estree/estree/) in JavaScript.

Bismuth's code generator generates JavaScript from an AST. But creating that AST is a challenge.

## But why?

In previous versions of Bismuth, ASTs were written by hand; if you wanted to write a function that returned an AST fragment, you'd type out the AST by hand, e.g.:

```js
function generateVariableDeclaration(value) {
    return {
        "type": "VariableDeclaration",
        "declarations": [
            {
                "type": "VariableDeclarator",
                "id": {
                    "type": "Identifier",
                    "name": "x"
                },
                "init": value
            }
        ],
        "kind": "var"
    };
}
```

This was made easier by `estree-builder`, a package which provided convenient shorthands for ESTree nodes:

```js
function generateVariableDeclaration(value) {
    return e['var'](e['id']('x'), value);
}
```

Still, this syntax is verbose and unwieldy, and for more complex code, required accompanying comments detailing the code that the AST actually compiled down to.

## Enter JSJS

JSJS provides a much more concise way of writing these ASTs:

```js
function generateVariableDeclaration(value) {
    return {{
        var x = ${value};
    }}
}
```

The above example compiles to the first one. It's essentially template strings, but for ESTree ASTs.

## Syntax

Because of lexical ambiguity, there are two different types of JSJS expressions: those which define statements and those which define expressions.

`{{...}}` (double braces) define a statement. For example:
```js
const five = {{5}};
```
compiles to:
```js
const five = {
    "type": "ExpressionStatement",
    "expression": {
        "type": "Literal",
        "value": 5
    }
};
```

`::{...}` ([turbo](https://github.com/jplatte/turbo.fish) braces) define an expression. For example:
```js
const five = ::{5};
```
compiles to:
```js
const five = {
    "type": "Literal",
    "value": 5
};
```

Inserting your own elements into the generated AST is done in much the same way as in template strings, with `${...}`. Note that whatever's inside the dollar-braces will *not* be modified in any way. It must *already* evaluate to a valid ESTree AST node. For instance, this will *not* compile down to a valid AST:
```js
const varXEqualsFive = {{
    var x = ${5};
}};
```
It will compile to:
```js
const varXEqualsFive = {
    "type": "VariableDeclaration",
    "declarations": [
        {
            "type": "VariableDeclarator",
            "id": {
                "type": "Identifier",
                "name": "x"
            },
            "init": 5
        }
    ],
    "kind": "var"
}
```
Note that `5` is not, by itself, a valid ESTree node. If you want to generate a valid AST, you'll need to ensure your template inputs are *also* ESTree nodes:

```js
const varXEqualsFive = {{
    var x = ${ {type: 'Literal', value: 5} };
}};
```

## Notes on jankiness
This is the first time I've touched `acorn`, the JS parsing library used to parse JSJS. As such, there are some things to be aware of:

* Two closing braces in a row (`}}`) will currently always be interpreted as a "close JSJS statement" token. So you can't do this, for example:
  * ```js
    const myExpression = ::{2 * ${myNumber}};
    --------------------------------------^ uh oh!
    ```
* ESLint sometimes gives incorrect linting errors. In particular, it will give "unexpected token" errors in weird places if you omit a semicolon.
* ESLint's internal state will occasionally get messed up and give linting errors for correct syntax. In VS Code, you can fix this by using `Ctrl+Shift+P` to open the command console then `Ctrl+R` to reload the window and reset ESLint.
* I have not implemented syntax highlighting for JSJS files. If you tell your editor it's a regular JS file, it looks quite weird but it's better than staring at a wall of code in one color.
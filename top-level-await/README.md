# Top Level Await

https://github.com/tc39/ecmascript-asyncawait/issues/9

The general approach is to throw stuff into a big async function.

	await fetch('http://www.google.com/')

Turns into:

	(async function(){
		await fetch('http://www.google.com/')
	})()

It's (probably) nontrivial to get this approach to work with import/exports, as you'll probably need some way to hoist imports and exports


	import _ from "lodash";
	await fetch('http://www.example.com/')
	export function derp(){
		alert('yolo')
	}

This would probably be converted into something like

	import _ from "lodash";
	export var derp;

	;(async function(){
		derp = function derp(){
			alert('yolo')
		}
	})()

https://github.com/thejameskyle/babel-handbook/blob/master/translations/en/plugin-handbook.md

https://github.com/babel/babel/blob/master/packages/babel-helper-hoist-variables/src/index.js

It seems like there's a path.hoist() method


# To Run:

	babel-node --presets es2015 transform.js

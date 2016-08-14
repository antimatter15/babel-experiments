# Top Level Await

https://github.com/tc39/ecmascript-asyncawait/issues/9

The general approach is to throw stuff into a big async function.

	await fetch('http://www.google.com/')

Turns into:

	(async function(){
		await fetch('http://www.google.com/')
	})()

It's (probably) nontrivial to get this approach to work with import/exports, as you'll probably need some way to hoist imports and exports


	await fetch('http://www.example.com/')
	export function derp(){
		alert('yolo')
	}

This would probably be converted into something like

	export var derp;

	;(async function(){
		derp = function derp(){
			alert('yolo')
		}
	})()
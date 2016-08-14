# Constant Inlining

This was used for unobfuscating some code.

	const x = "hello",
		  y = "world",
		  z = "derp";

	x + y + z


This get transformed into

	
	"hello" + "world" + "derp"

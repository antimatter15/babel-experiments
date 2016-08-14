# WATlab

Like MATLAB, but with more WAT: Matrix literal syntax for Javascript.


### Syntax
	
	@[1, 2; 3, 4]      Matrix Literal Syntax
	@[1, 2, 3]         Horizontal Matrix Concatenation
	@[1; 2; 3]         Vertical Matrix Concatenation

	data @@ f          Postfix Function Application

		lena @@ luminance @@ rotate(0.5)

	arr  @. f          Postfix Map

		zeros(30, 30) @. ((x, i, j) => i + j)
		[1, -4, 27, 5] @. Math.exp

	f.(arr)            Prefix Map

		Math.pow.([1, -4, 27, 5], 2)

	arr .+ arr         Elementwise addition
	arr .- arr         Elementwise subtraction
	arr .* arr         Elementwise multiplication
	arr ./ arr         Elementwise division
	arr .^ arr         Elementwise power

	arr .< arr         Elementwise comparison
	arr .> arr
	arr .= arr

	mat @* mat         Matrix multiplication
	mat @/ mat         Matrix right-division
	mat @\ mat         Matrix left-division
	mat @^ num         Matrix exponentiation
	mat @+ num         A + s * I
	mat @- num         A - s * I

	arr.[x, y]         Get element at indices x, y
	arr.[x, :]         Get entire row
	arr.[:, y]         Get entire column
	arr.[a:b, c:d]     Get slice of array

	arr.[:,:] += arr   Elementwise update array
	arr.[:,:] -= arr   
	arr.[:,:] *= arr
	arr.[:,:] /= arr


Lets design a language which lays out subject, verb, and object in a way which is easy to read, but being able to write in any order that makes sense.




	lena @@ luminance 
	// => luminance(lena)

	lena @@ luminance()
	// => luminance(lena)

	cameraman @@ rotate(0.5)
	// rotate(cameraman, 0.5)

	lena @@ luminance @@ rotate(0.5)
	// rotate(luminance(lena), 0.5)


	matrix @. Math.sin
	// elementwise sin of matrix
	// __watlab.map(matrix, Math.sin)


	Math.sin.(matrix)
	// elementwise sin of matrix


	matrix @. Math.pow(2)
	// elementwise square of matrix?

	Math.pow.(matrix, 2)
	// elementwise square of matrix
	// __watlab.map





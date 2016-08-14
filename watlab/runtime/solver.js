import ndtrsv from 'ndarray-blas-trsv'
import ndlup from "ndarray-lup-factorization"
import ndqr from 'ndarray-householder-qr'
import ndsolve from "ndarray-lup-solve"
import ndpool from "ndarray-scratch"
import * as ndops from "ndarray-ops" 
import ndblas1 from "ndarray-blas-level1"
import ndtest from "ndarray-tests"

// http://stackoverflow.com/a/18553768/205784
// http://www.mathworks.com/help/matlab/ref/mldivide.html

// this stuff should really be tested or something
// it's semi-definitely HIV-positive

export function solve(ac, bc){
	if(ac.dimension != 2){
        throw new TypeError('mldiv():: Dimension of A must be 2');
    }
    if(bc.shape[0] != ac.shape[0]){
        throw new TypeError('mldiv():: Matrix dimensions must agree')
    }
    if(ac.shape[0] == ac.shape[1]){ // check square matrix
        return solve_square(ac, bc)
    }else{ // nonsquare, do qr solver
        return solve_rectangular(ac, bc)
    }
}


export function invert(ac){
    var n = ac.shape[0];
    var P = [];
    ndlup(ac, ac, P)
    var work = ndpool.malloc([n])
    var inv = ndpool.eye([n, n])
    for(var i = 0; i < n; i++){
        ndsolve(ac, ac, P, inv.pick(null, i), work)    
    }
    ndpool.free(work)
    return inv;
}


function solve_square(ac, bc){
	// honestly this was a bit of premature optimization
    // because just using the LU solver is almost certainly
    // sufficient, and having these additional solvers only
    // serves to make this code more likely to fail unexpectedly

    // also it makes sense to benchmark how much (if at all)
    // these implementations of cholesky/trsv are faster than
    // the LUP solver, rather than naively doing what matlab
    // does because it's fucking matlab.

    if(ndtest.matrixIsUpperTriangular(ac)){ // upper triangular: backward substitution
        console.log('upper triangular: backward substitution')
        ndtrsv(ac, bc, 'up');
        return bc
    }else if(ndtest.matrixIsLowerTriangular(ac)){ // lower triangular: forward substitution
        console.log('lower triangular: forward substitution')
        ndtrsv(ac, bc, 'lo');
        return bc
    }else if(ndtest.matrixIsSymmetric(ac)){ // symmetric matrix: perhaps cholesky?
        var L = ndpool.zeros(ac.shape)
        if(cholesky(ac, L)){
            console.log('cholesky solver')
            ndtrsv(L, bc, 'lo');
            ndtrsv(L.transpose(1, 0), bc, 'up'); 
            ndpool.free(L)
            return bc
        }
        ndpool.free(L)
    }
    console.log('LUP solver')
    // square, use LU decomposition
    var P = [];
    ndlup(ac, ac, P)
    ndsolve(ac, ac, P, bc)
    return bc
}



function solve_rectangular(ac, bc){
	var [m, n] = ac.shape;
    if(m < n){ // underdetermined
        console.log('underdetermined qr solver')
        var d = ndpool.zeros([n]),
            R = ac.transpose(1, 0);
        ndqr.factor(R, d);
        // Construct R1 out of upper triangular + diagonal
        var R1 = ndpool.zeros([m, m])
        for(var i = 0; i < m; i++){
            for(var j = i + 1; j < m; j++)
                R1.set(i, j, R.get(i, j));
            R1.set(i, i, d.get(i))
        }
        // forward substitution to compute (R1')^-1 * b
        ndtrsv(R1.transpose(1, 0), bc, 'lo');
        ndpool.free(d)
        ndpool.free(R1)
        // pad bc with zeros as appropriate
        var t = ndpool.zeros([n])
        ndops.assign(t.hi(m), bc)
        ndqr.multiplyByQ(R, t)
        // ndpool.free(t)
        // return matrix(t).transpose(1, 0)
        return t
    }else{ // use householder qr solver for overdetermined systems
        console.log('overdetermined qr solver')

        var d = ndpool.zeros([n])
        ndqr.factor(ac, d);
        ndqr.solve(ac, d, bc);
        ndpool.free(d)
        // return matrix(bc).hi(null, n).transpose(1, 0)
        // console.log(require('ndarray-unpack')(bc.hi(n)))

        return bc.hi(n);
    }
}



// slightly modified version of 
// https://github.com/scijs/ndarray-cholesky-factorization/blob/master/index.js
// which returns false when the matrix is not positive semidefinite
// also without dimensionality checks

function cholesky(A, L) {
    var n = A.shape[0];
    for ( var i = 0; i < n; i++ ) {
        for ( var j = 0; j < (i+1); j++ ) {
            var s = ndblas1.dot(L.pick(i,null).hi(j), L.pick(j,null).hi(j));
            if(i === j){
                var val = A.get(i, i) - s
                if(val < 0) return false;
                L.set(i, j, Math.sqrt(val));
            }else{
                L.set(i, j, (1 / L.get(j, j) * (A.get(i, j) - s)));
            }
        }
    }
    return true;
};

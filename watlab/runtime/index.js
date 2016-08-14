// matricies and other crazy shit for javascript

import _ from "lodash"
import * as ndops from "ndarray-ops"
import ndgemm from "ndarray-gemm"
import ndarray from "ndarray"
import ndzeros from "zeros"
import ndfill from "ndarray-fill"

import ndpack from "ndarray-pack"
import ndunpack from "ndarray-unpack"
import ndpool from "ndarray-scratch"

import unsqueeze from 'ndarray-unsqueeze'
import squeeze from 'ndarray-squeeze'
import rowcat from 'ndarray-concat-rows'

import { solve, invert } from "./solver"


function colcat(a){
    // what we really want to do is to concat along the second dimension
    // not to concat along the last dimension
    return rowcat(a.map(k => k.transpose(1, 0))).transpose(1, 0)
}

export function matrix2d(a){
    a = matrix(a)
    if(a.dimension == 1){
        return unsqueeze(a, 0)
    }
    return a;
}

export function matrix(a){
    if(a.shape) return a;
    if(Array.isArray(a)){
        if(a.every(k => typeof k == 'number')){
            return ndarray(a, [1, a.length]);
        }
        return colcat(a.map(matrix2d));
    }

    if(typeof a === 'number') return ndarray([a], [1, 1]);

    // automatically convert canvas/ctx to ndarray
    if(a.canvas) a = a.canvas;
    if(a.getContext){
        return ndarray(a.getContext('2d').getImageData(0, 0, a.width, a.height).data, 
            [ a.height, a.width, 4])
    }

    console.warn('unhandled', a)
    throw new Error('Could not cast input type "' + (typeof a) + '" as ndarray')
    
}

export function vcat(...a){
    if(a.length == 0) return ndarray([], [0, 0]);
    return rowcat(a.map(matrix2d))
}

export function transpose(a){
    return matrix2d(a).transpose(1, 0)
}


export function mmul(a, b){
    var ma = matrix(a),
        mb = matrix(b),
        mc = ndzeros([ma.shape[0], mb.shape[1]]);
    ndgemm(mc, ma, mb)
    return mc
}


export function add(a, b){
    if(typeof a == 'number' && typeof b == 'number'){
        return a + b
    }else if(typeof a == 'string' || typeof b == 'string'){
        return a + b
    }else if(Array.isArray(a) && Array.isArray(b)){
        return a.map((k, i) => k + b[i])
    }else if(is_scalar(b)){
        var ma = matrix(a),
            out = ndzeros(ma.shape);
        ndops.adds(out, ma, scalar(b))
        return out;
    }else if(is_scalar(a)){
        return add(b, a);
    }else{
        var ma = matrix(a),
            mb = matrix(b),
            out = ndzeros(ma.shape);
        ndops.add(out, ma, mb)
        return out;
    }
    throw new Error("Elementwise Addition Error: Not implemented for these types")
}

export function madd(a, b){
    var mat = matrix2d(a)
    return add(mat, mul(ndpool.eye(mat.shape), b))
}

export function msub(a, b){
    var mat = matrix2d(a)
    return sub(mat, mul(ndpool.eye(mat.shape), b))
}


export function sub(a, b){
    if(typeof a == 'number' && typeof b == 'number'){
        return a - b
    }else if(Array.isArray(a) && Array.isArray(b)){
        return a.map((k, i) => k - b[i])
    }else if(is_scalar(b)){
        var ma = matrix(a),
            out = ndzeros(ma.shape);
        ndops.subs(out, ma, scalar(b))
        return out;
    }else if(is_scalar(a)){
        var mb = matrix(b),
            out = ndzeros(mb.shape);
        ndops.assigns(out, scalar(a))
        ndops.sub(out, out, mb)
        return out;
    }else{
        var ma = matrix(a),
            mb = matrix(b),
            out = ndzeros(ma.shape);
        ndops.sub(out, ma, mb)
        return out;
    }
    throw new Error("Elementwise Addition Error: Not implemented for these types")
}



function scalar(x){
    if(typeof x == 'number'){
        return x
    }else if(x.shape && x.shape.every(k => k == 1)){
        return x.get(0, 0)
    }
    throw new Error("Tried to retrieve scalar value of non-scalar object")
}

function is_scalar(x){
    if(typeof x == 'number'){
        return true
    }else if(x.shape && x.shape.every(k => k == 1)){
        return true
    }
    return false
}

export function mul(a, b){
    if(typeof a == 'number' && typeof b == 'number'){
        return a * b
    }else if(typeof a == 'string' && typeof b == 'number'){
        return a.repeat(b)
    }else if(is_scalar(b)){
        var ma = matrix(a),
            out = ndzeros(ma.shape);
        ndops.muls(out, ma, scalar(b))
        return out;
    }else if(is_scalar(a)){
        return mul(b, a);
    }else{
        var ma = matrix(a),
            mb = matrix(b),
            out = ndzeros(ma.shape);
        ndops.mul(out, ma, mb)
        return out;
    }
    throw new Error("Elementwise Multiplication Error: Not implemented for these types")
}


export function div(a, b){
    if(typeof a == 'number' && typeof b == 'number'){
        return a / b
    }else if(is_scalar(b)){
        var ma = matrix2d(a),
            out = ndzeros(ma.shape);
        ndops.divs(out, ma, scalar(b))
        return out;
    }else if(is_scalar(a)){
        // TODO: figure out if there's a better
        // way to do this with a closer reading
        // of https://github.com/scijs/ndarray-ops
        var mb = matrix2d(b),
            out = ndzeros(mb.shape);
        // ndops.pows(out, mb, -1)
        ndops.recip(out, mb)
        return mul(out, a);
    }else{
        var ma = matrix2d(a),
            mb = matrix2d(b),
            out = ndzeros(ma.shape);
        ndops.div(out, ma, mb)
        return out;
    }
    throw new Error("Elementwise Division Error: Not implemented for these types")
}

export function ldiv(a, b){
    return div(b, a)   
}

export function mldiv(a, b){
    var ac = ndpool.clone(matrix2d(a)),
        // we flatten b into a vector and ignore its shape
        // TODO: find a better way to do it
        // bc = ndpool.clone(squeeze(matrix(a)))
        bc = ndpool.clone(ndarray(_.flattenDeep(ndunpack(matrix(b)))));

    // console.log(bc)
    return matrix2d(solve(ac, bc)).transpose(1, 0)

}

// import numeric from 'numeric'
export function mdiv(a, b){
    if(is_scalar(a)){
        var bc = ndpool.clone(matrix2d(b))
        var inv = invert(bc)
        ndpool.free(bc)
        return inv;
        // var mat = ndunpack(matrix(b))
        // if(Math.abs(numeric.det(mat)) < 1e-8){
        //     console.warn('matrix is close to singular')
        // }
        // return ndpack(numeric.inv(mat))
    }
    return mldiv(b, a)
}



export function mexp(a, b){
    if(!is_scalar(b)){
        throw new Error("mexp():: second argument must be a scalar")
    }
    let mat = ndpool.clone(a),
        N = scalar(b) - 1;
    for(var i = 0; i < N; i++){
        mat = mmul(mat, a)
    }
    return mat
}
export function exp(a, b){
    if(typeof a == 'number' && typeof b == 'number'){
        return Math.pow(a, b)
    }else if(is_scalar(b)){
        var ma = matrix(a),
            out = ndzeros(ma.shape);
        ndops.pows(out, ma, scalar(b))
        return out;
    }else if(is_scalar(a)){
        return exp(b, a);
    }
    throw new Error("Elementwise Power Error: Not implemented for these types")
}


export function gt(a, b){
    if(is_scalar(b)){
        var out = ndzeros(a.shape)
        ndops.gts(out, a, scalar(b))
        return out;
    }
    throw new Error('elementwise greater than not implemented')
}


export function lt(a, b){
    if(is_scalar(b)){
        var out = ndzeros(a.shape)
        ndops.lts(out, a, scalar(b))
        return out;
    }
    throw new Error('elementwise greater than not implemented')
}

export function select(arr, ...args){
    var highs = args.map(k => Array.isArray(k) ? k[1] : null),
        lows = args.map(k => Array.isArray(k) ? k[0] : null),
        fixed = args.map(k => Array.isArray(k) ? null : k)

    if(args.every(k => !Array.isArray(k))){
        // coordinates are fully defined, return the element at a position
        return arr.get(...args)
    }else{
        // console.log(highs, lows, fixed)
        return arr.hi(...highs).lo(...lows).pick(...fixed)
    }    
}

export function negate(arr){
    return sub(0, arr)
}

export function assign(op, arr, val, ...args){
    var highs = args.map(k => Array.isArray(k) ? k[1] : null),
        lows = args.map(k => Array.isArray(k) ? k[0] : null),
        fixed = args.map(k => Array.isArray(k) ? null : k)

    var obj = arr.hi(...highs).lo(...lows).pick(...fixed);
    // cwise-compiler seems to fail when it comes to 
    // 0d arrays
    if(obj.dimension == 0) obj = unsqueeze(obj);

    if(op == '='){
        if(is_scalar(val)){
            ndops.assigns(obj, scalar(val))
        }else{
            ndops.assign(obj, (val))
        }
    }else if(op == '+='){
        if(is_scalar(val)){
            ndops.adds(obj, obj, scalar(val))
        }else{
            ndops.add(obj, obj, (val))
        }
    }else if(op == '-='){
        if(is_scalar(val)){
            ndops.subs(obj, obj, scalar(val))
        }else{
            ndops.sub(obj, obj, (val))
        }
    }else if(op == '+='){
        if(is_scalar(val)){
            ndops.adds(obj, obj, scalar(val))
        }else{
            ndops.add(obj, obj, (val))
        }
    }else if(op == '/='){
        if(is_scalar(val)){
            ndops.divs(obj, obj, scalar(val))
        }else{
            ndops.div(obj, obj, (val))
        }
    }else{
        throw new Error('assignment operator not implemented')
    }
    return obj
}

export function map(func, over, ...args){
    if(Array.isArray(over)){
        return over.map((k, i) => func(k, ...args, i))
    }else{
        // return map(func, [over], ...args)
        var arr = matrix(over)
        return ndfill(ndzeros(arr.shape), (...indices) => 
            func(arr.get(...indices), ...args, ...indices))
    }
}




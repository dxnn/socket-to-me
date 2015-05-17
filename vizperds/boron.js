/*
    boron: some utilities for immutability
*/


B = {} 

B.persistent_merge = function(props, data) {
    /// merges a 'flattened' data array into props in a persistent fashion
    /// the new object reuses old data where possible, so requires ~log N additional space
    
    /// given props {fun: {yay:123, ok:123}, cat:{dog:123}}    
    ///   and  data {'fun.yay':0, 'cat.ant.bear':0}}          
    ///     returns {fun: {yay:0, ok:123}, cat:{ant:{bear:0}}}
    
    data = data || []
    
    if(Array.isArray(data) || Array.isArray(data)) {
        // THINK: what do we do with arrays?
        if(Array.isArray(data) !== Array.isArray(props)) {
            // THINK: how to deal with array / object mismatch?
        }
    }
    
    // THINK: what about when data is {cat:{'ant.bear':0}} ?
    
    return Object.keys(data).reduce(function(props, key) {              // OPT: combine these instead of doing them separately
        return B.set_deep_value(props, key, data[key])
    }, props)
}

B.set_deep_value = function(props, path, value) {
    /// set a value from a flattened path
    
    /// given props {fun: {yay:123, ok:123}, cat:{dog:123}}
    ///   and  path 'fun.ok' 
    ///   and value 456
    ///     returns {fun: {yay:123, ok:456}, cat:{dog:123}}
    
    var segs = path.split('.')
    var last = segs.pop()
    var final = next = B.shallow_copy(props)

    segs.forEach(function(seg) {
        next[seg] = B.shallow_copy(next[seg])
        next = next[seg]
    })

    next[last] = value
    return final
}

B.shallow_copy = function(obj) {
    if(Array.isArray(obj)) return obj.slice()
    return Object.keys(obj || {}).reduce(function(acc, key) {acc[key] = obj[key]; return acc}, {})
}

B.flatten = function(obj, prefix) {
    /// convert {fun: {yay: 123}} into {'fun.yay': 123}
    
    if(!B.proper_object(obj)) return {}
    
    var newobj = {}
    prefix = prefix ? prefix + '.' : ''
    
    for(var key in obj) {
        if(!B.proper_object(obj[key])) {
            newobj[prefix+key] = obj[key]
        } else {
            newobj = B.extend(newobj, B.flatten(obj[key], prefix+key)) // OPT: lotsa GC here
        }
    }
    
    return newobj
}

B.unflatten = function(obj) {
    /// convert {'fun.yay': 123} into {fun: {yay: 123}}
    
    return B.persistent_merge({}, obj) // OPT: GC
    // return Object.keys(obj||{}).reduce(function(acc, key) {return B.set_deep_value(acc, key, obj[key])}, {}) // OPT: GC
}

B.proper_object = function(obj) { return typeof obj == 'object' && !Array.isArray(obj) } 

B.extend = function() {
    /// given ({fun:123, yay:123}, {yay:456, ok:789}) as args, returns a new object {fun:123, yay:456, ok:789}
    
    var newobj = {}
    Array.prototype.slice.call(arguments).forEach(function(arg) {
        for(var prop in arg) {
            newobj[prop] = arg[prop] } })
    return newobj
}


B.memoize = function(f) {
    var table = {}
    return function() {
        var args = Array.prototype.slice.call(arguments)
        var key = args.toString()
        return table[key] ? table[key] : (table[key] = f.apply(null, args))
    } 
}







////////////// stealing a few items from Ramda (consider importing whole lib) ///////////////

R = {}

R.prop = function (p, obj) {
    return arguments.length < 2 ? function (obj) { return obj[p]; } : obj[p]
}






/*
  The basic process:
  - pass a string to run()
    - which passes it to parse()
      - which converts the string to array format
    - pass that value to compile()
      - pipeline? pass to make_pipe_fun()
      - non-command obj? recursively compile()
      - non-obj? return value
      - command: 
        - recursively compile() on params
        - wrap params with typefuns
        - return thunk
        


*/ 

DAML = {}

/*
  If we make the event log a little stronger, can we use it to update local stores? 
  example: Bowser is auditing in his browser. He pulls up an audit and gets to work. This loads up all the audit data, but it also subscribes to the update channels for those _things_. Then Peach loads the same audit and makes some changes. 
  - Bowser's browser receives those events and updates the cached audit data accordingly (and hence the display).
  - Any queries to loaded objects can just hit the local cache, because it's automatically kept in sync.
 implies the local commands understand how to modify local cache based on events... hmmm.
 
 Log commands as a 3-element list: [H, M, P], with H&M as strings and P as a param map. this is canonical. also log time and user id. 
 thing: this is findable if it matches H+P.id. some commands might affect multiple things (but most don't). so... always log thing? never log thing? if the command is atomic, then the command is the bottom, not the thing. so changes on a thing are found via command search? need to list use cases. 
 
 there will be lots of 'standard form' commands, like {noun add} and {noun set-type} and {my set collection :nouns}. can we do something useful with them? 
 
 {my set} becomes a fauxcommand which includes a call to {attr set} and has user:* exec perms.
 {attr set} allows setting of a things' attributes if you have perms on that thing. (superdo can bypass, natch)
 so... how do you know what a thing's schema is? for example, given @thing, is it @thing.name or @thing.my.name?
 is it {thing set-name} or {my set attr :name}? are these formally defined somewhere or ad hoc? 
 defined: discoverable, programatically constrained, but requires locking in the schema before building
 ad hoc: flexible, friendly, but difficult to generate knowledge of thing structure -- leading to confusion and "sample querying"
 we have a fixed mechanical schema. that exists, if only in our heads. why not make it formal? could aid in migration, also, when needed.
 then anything not covered in the schema is available for attr'ing. so you can have super-friendly attrs like @thing.name, without having to specify anything (by simply *not* putting them in the formal schema).
 so a {name set} fauxcommand and the ilk for things in general? and {my set} for user-created ad hoc attrs?
 
 commands are the atomic bottom. things are underneath that. most commands change one attr on one thing at a time. but some more complex ones might change many attrs on several things at once. we want to:
 - track changes to a thing over time
 - see the system at a particular moment in time
 - rewind and fast forward through time
 - allow unlimited undoability
 complex commands are like a transaction. so maybe commands are 'simple' (one thing/attr, undo means redo prior command w/ same params (id, maybe collection for {attr set}) but different value). 
 whereas a 'complex' command requires a custom 'undo' function as part of the command definition. so the bottom command itself contains information on the collection+attr. (automated for set-* style commands)
 
 also need to allow custom events in the event log, not just commands. this is important for... i don't know what. maybe those go in a different collection. command log for commands. error log for errors. event log for other things. maybe the event log is just there for attaching listeners? but if you're using a command for firing an event then that's going to go in the command log. so you could just trigger off of that...
 
 
 
*/

if (typeof exports !== 'undefined') {
  var _ = require('underscore')
  //     mmh = require('murmurhash3')
  // 
  // var murmurhash = mmh.murmur128HexSync
     
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = DAML
  }
  exports.DAML = DAML
}



DAML.terminators = {}
DAML.import_terminator = function(ch, obj) {
  if(typeof ch != 'string') return DAML.onerror('Terminator character must be a string')
  ch = ch[0] // only first char matters
  if(!DAML.terminators[ch]) DAML.terminators[ch] = []
  DAML.terminators[ch].push(obj)
}

// TODO: these should do more than just return a fancy parser...

DAML.terminate = function(ch, verb, params) {
  if(!DAML.terminators[ch]) return false
  var fun, terminators = DAML.terminators[ch]
  
  for(var i=0, l=terminators.length; i < l; i++) {
    fun = terminators[i][verb]
    if(typeof fun != 'function') continue
    fun.apply(terminators[i], params)
  }
}

DAML.import_terminator('|', { // pipe
  eat: function(stream, state) {
    stream.next()
    return 'bracket'
  }
})

DAML.import_terminator('^', { // lift
  eat: function(stream, state) {
    stream.next()
    return 'bracket'
  }
})

DAML.import_terminator('/', { // comment
  eat: function(stream, state) {
    while(stream.peek() === '/') stream.next()
    state.commentLevel++
    state.stack[state.stack.length-1].onTerminate.commentLevel-- // set parent's onTerminate
    // state.stack[state.stack.length-1].onClose.commentLevel-- // set parent's onClose
    return 'comment'
  }
})



function murmurhash(key, seed) {
	var remainder, bytes, h1, h1b, c1, c1b, c2, c2b, k1, i;

	remainder = key.length & 3; // key.length % 4
	bytes = key.length - remainder;
	h1 = seed;
	c1 = 0xcc9e2d51;
	c2 = 0x1b873593;
	i = 0;

	while (i < bytes) {
	  	k1 = 
	  	  ((key.charCodeAt(i) & 0xff)) |
	  	  ((key.charCodeAt(++i) & 0xff) << 8) |
	  	  ((key.charCodeAt(++i) & 0xff) << 16) |
	  	  ((key.charCodeAt(++i) & 0xff) << 24);
		++i;

		k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
		k1 = (k1 << 15) | (k1 >>> 17);
		k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

		h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
		h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
		h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
	}

	k1 = 0;

	switch (remainder) {
		case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
		case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
		case 1: k1 ^= (key.charCodeAt(i) & 0xff);

		k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
		k1 = (k1 << 15) | (k1 >>> 17);
		k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
		h1 ^= k1;
	}

	h1 ^= key.length;

	h1 ^= h1 >>> 16;
	h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
	h1 ^= h1 >>> 13;
	h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
	h1 ^= h1 >>> 16;

	return h1 >>> 0;
}

// FIXME: STUPID HACKY RE THINGS
var ObCh = String.fromCharCode(27)
var CbCh = String.fromCharCode(7)
var ExObRe = new RegExp('{', 'g')
var ExCbRe = new RegExp('}', 'g')
var UnExObRe = new RegExp(ObCh, 'g')
var UnExCbRe = new RegExp(CbCh, 'g')




// DAML

DAML.CONSTANTS = {}
/*
  CONSTANTSFRY
  - OpenBrace
  - CloseBrace
  - OpenAngle
  - CloseAngle
*/



DAML.ETC = {}
DAML.FINGS = {}
DAML.queue = []
DAML.__compiler = {}

DAML.command_open = '{'
DAML.command_closed = '}'
DAML.list_open = '('
DAML.list_closed = ')'
DAML.quote = '"'

DAML.VARS = {}
DAML.Vstack = []
DAML.Vglobals = {}
DAML.Vtypes = {}


DAML.models = {}
DAML.import_models = function(new_models) {
  _.each(new_models, function(model, model_key) {
    if(!DAML.models[model_key]) {
      DAML.models[model_key] = model
    } else {
      _.extend(DAML.models[model_key]['methods'], model['methods'])
    }
  })
}

DAML.aliases = {};
DAML.import_aliases = function(values) {
  _.each(values, function(value, key) {
    DAML.aliases[key] = value // do some checking or something
  })
}

DAML.import_aliases({
  '>': 'variable set path',
  'grep': 'string grep on',
  
  'run': 'daml run',
  'quote': 'daml quote',
  'unquote': 'daml unquote',
  
  '*': 'list pair value',
  'merge': 'list merge',
  'each': 'list each',
  'map': 'list map',
  'sort': 'list sort',
  'ZZZgroup': 'list group',
  'prune': 'list prune daml',
  'extract': 'list extract daml',
  'count': 'list count value',
  'union': 'list union value',
  
  // '%': 'content get value',
  
  'eq': 'logic is like',
  'is': 'logic is', // for 'is in'
  'if': 'logic if value',
  'then': 'logic if value __ then',
  'else': 'logic if value __ then __ else',
  'and': 'logic and value',
  'or': 'logic or value',
  'not': 'logic not value',
  'cond': 'logic cond value',
  
  'add': 'math add value',
  'subtract': 'math subtract value', // 'minus' is sometimes better, but with constants we'll use 'add -N'
  'multiply': 'math multiply value',
  'divide': 'math divide', // careful, this one is different
  'round': 'math round',
  'mod': 'math mod by',
  'less': 'math less',
  
  'log': 'process log value',
  'tap': 'process log passthru 1 value',
})

// DAML's type system is dynamic, weak, and latent, with implicit user-definable casting via type methods.
DAML.add_type = function(key, fun) {
  // TODO: add some type checking
  DAML.Vtypes[key] = fun
};

// primitive (number, string, fing, list of primitives) <- is this anything??
// array / object / list [can be either]
// flat (number, string)
// number
// string
// fing


DAML.add_type('fallback', function(value) { // this is the default type parser
  return DAML.recursive_run(value)
})

DAML.add_type('string', function(value) {
  return DAML.stringify(value)
})

DAML.add_type('number', function(value) {
  value = DAML.recursive_run(value)

  if(typeof value == 'number') value = value
  else if(typeof value == 'string') value = +value
  else if(typeof value == 'object') value = Object.keys(value).length // THINK: this is a little weird
  else value = 0

  return value
})

DAML.add_type('integer', function(value) {
  value = DAML.Vtypes['number'](value) // TODO: make a simpler way to call these
  
  return Math.round(value)
})

DAML.add_type('anything', function(value) {
  return value
})

DAML.add_type('primitive', function(value) {
  return DAML.toPrimitive(value)
})

DAML.add_type('hash', function(value) {
  value = DAML.defunctionize(value)
  return typeof value == 'object' ? value : [value] // TODO: this doesn't always return a proper JS 'hash', which is likely very bad. Find a better way.
})

DAML.add_type('list', function(value) {
  return DAML.toArray(DAML.defunctionize(value))
})

DAML.add_type('rawlist', function(value) {
  return DAML.toArray(value)
})

DAML.add_type('template', function(value) {
  // TODO: add some checking here to ensure value isn't barfable.
  return DAML.fingify(value)
})

DAML.add_type('string_or_fing', function(value) {
  if(DAML.isFing(value)) return value
  return DAML.stringify(value)
})

DAML.some_type_coercion = function() {
  // keeps the webkit debugger happy.
}


DAML.__compiler.make_fing = function(params) {
  if(params.string.indexOf(ObCh) == -1) return params.string
  
  var string = params.string.replace(UnExObRe, '{').replace(UnExCbRe, '}')
  var ptree = DAML.wrap_command('string', 'join', {value: params.ptree, on: ''})
  var fun = DAML.compile(ptree)
  
  return DAML.fingify(string, ptree, fun)
}



// TODO: fix this:
if(typeof now === 'undefined' || now.fake) {
  
  // STANDARD ENQUEUE:
  DAML.enqueue = function(command) {
    if(!command) {return false}
  
    if(typeof command !== 'function') {
      command = DAML.compile(command)
    }
  
    return DAML.queue.unshift(command)
    // OPT: use push/pop instead of unshift/shift
  }

} else {
  
  // NEWFANGLED MULTIQUEUE:
  DAML.enqueue = function(command) {
    if(now.enqueueOnServer) {
      now.enqueueOnServer(command)
    } else {
      setTimeout(function() {DAML.enqueue(command)}, 500)
    }
  }

  now.enqueueOnClient = function(command) {
    if(!command) {return false}

    if(typeof command !== 'function') {
      command = DAML.compile(command)
    }

    if(typeof command !== 'function') {
      return false
    }

    return DAML.queue.unshift(command)
    // OPT: use push/pop instead of unshift/shift
  }

  // NEWFANGLED PLAYER ADDER
  now.addPlayerOnClient = function(id, thing_key, x, y) {
    Katsu.participants++
    Katsu.things[id] = Katsu.Thing.spawn(thing_key, x, y, id)
  }
  
  now.removePlayerOnClient = function(id) {
    Katsu.participants--
    Katsu.things[id].destroy()
  }
}


DAML.run_queue = function() {
  var count = DAML.queue.length
  for(var i=0; i < count; i++) {
    DAML.queue.pop()()
  }
  return count
}


// use this to set simple errors
DAML.setError = function(error) {
  return DAML.onerror('', error)
}

// use this to report errors in low-level daml processes
DAML.onerror = function(command, error) {
  return console.log('error: ' + error, command)
}


// add a new global read-only variable
DAML.add_global = function(key, value) {
  if(!/^[A-Z]+$/.test(key)) return DAML.setError('Read-only globals are UPPERCASE')
  DAML.Vglobals[key] = value
}


/* we have a few different processing stages: 
  parse: string -> ptree
  compile: string or ptree -> function
  run: parse, then compile, then call the function and return results
*/

DAML.run = function(daml, data) {
  if(!daml) return ""
  // if(typeof daml == 'string') console.log(daml)
  if(data) DAML.execute('variable', 'set', ['this', data]) // set 'this' data...
  return DAML.defunctionize(DAML.compile(daml)) // THINK: should we stringify this??
}


// whatever -> function
DAML.compile = function(daml, pipe_count) {
  var model, method, params, fun, thunk, falsies = []
  
  // TODO: this pipe_count stuff is totally wonky. fix it!
  
  if(DAML.isFing(daml)) return daml // already fing
  
  if(typeof daml == 'function') return daml // it's already processed
  
  if(typeof daml == 'string') {
    daml = DAML.parse_deep(daml)
  }
  
  /*
    Essentially, we recursively walk the structure looking for MFPs to consume. 
    When we find one we convert it to a function call.
    If the outer-most layer is a list (e.g., the daml is {(:foo :baz)} ) then we ... return a list?
  */

  if(!daml || typeof daml != 'object') {
    return daml
  }

  if(!daml['m'] || !daml['f'] || !daml['p'] || Object.keys(daml).length != 3) {
    // a list or hash, so compile the innards
    return DAML.walk_it_off(daml, pipe_count)
  }
  
  // compiler directives
  if(daml['m'] == '__compiler') {
    var funk = DAML.__compiler[daml['f']]
    if(funk) {
      return funk(daml['p'])
    }
  }
  
  // ceci est une pipe
  if(daml['m'] == 'process' && daml['f'] == 'pipe') {
    pipe_count = 1
  }
    
  // have daml, will travel.
  model = DAML.models[daml.m]
  if(!model) {
    return DAML.onerror(daml, 'Invalid model')
  }
  
  method = model.methods[daml.f]
  if(!method) {
    return DAML.onerror(daml, 'Invalid method')
  }
  
  fun = method.fun
  if(typeof fun != 'function') return DAML.onerror(daml, 'Invalid fun')
  
  params = DAML.fix_params(method, daml.p, pipe_count) // returns a list of values, each wrapped in a type function
  if(!params) return false // error inside fix_params
  
  var pkeys = []
  for(var i=0, l=method.params.length; i < l; i++) {
    pkeys.push(method.params[i].key)
  }
  
  for(var i=0, l=pkeys.length; i < l; i++) {
    falsies[i] = method.params[i].falsy === false
  }
  
  thunk = function() {
    var output, done = false, values = [], pval
    
    // we have to process the params at call-time to catch all the variably goodness
    for(var i=0, l=params.length; i < l; i++) {
      if(typeof params[i] == 'function') {
        pval = params[i]() // params[i] should be a var type wrapper function
        values.push(pval) 
        if(!pval && falsies[i]) {
          DAML.onerror('Invalidly false parameter for command: ' + daml.m + ' ' + daml.f)
          return false
        }
      } else {
        values.push(params[i]) // this probably only pushes undefined, but you never know
      }
    }
    
    // THINK: What should the 'this' context be? Using model is ok (allows setting properties shared across methods), but maybe something else is better?
    try {
      output = fun.apply(model, values)
    } catch(e) {
      // TODO: put the *actual* command into the message... somehow
      DAML.onerror(e, 'Error in command: ' + daml.m + ' ' + daml.f + '; message: ', e.message)
      return false
    }
    
    return output
  }
  
  return thunk
}


// compile elements of a list or object
DAML.walk_it_off = function(obj, pipe_count) {
  var output = (Array.isArray(obj) ? [] : {}),
      keys = _.keys(obj);
  
  for(var key in obj) {
    output[key] = DAML.compile(obj[key], pipe_count);
  }

  return output;
};


// TODO: make block vars use a sigil of some type -- otherwise there's just too many collisions.
// TODO: {daml import} should be *compile time*, not runtime. 


// wrap params in type funs and order them properly
DAML.fix_params = function(method, params, pipe_count) {
  var pobj, pkeys, pkey, failure, have_piped, type, typefun, value, 
      values = [], clean_params = {};
  
  // fix params
  var pkeys = [];
  method.params = method.params || [];
  for(var i=0, l=method.params.length; i < l; i++) {
    pkeys.push(method.params[i].key);
  }
  
  // NOTE: we're using a for loop here instead of _.each to reduce the call stack and closure var stack overhead.
  for(var i=0, l=pkeys.length; i < l; i++) {
    pkey = pkeys[i];
    pobj = method.params[i]; 

    // add pipability
    // TODO: soooo... this is weird. if we're looking at the params of a pipe's params and not the first param and we haven't piped yet and there's no pkey (pause for breath), then pipe. sheesh!
    if(pipe_count >= 2 && !have_piped && !params.hasOwnProperty(pkey)) {
      clean_params[pkey] = DAML.wrap_var('__');
      have_piped = true;
    } else {
      clean_params[pkey] = params[pkey];
    }
    
    // check typing
    if(pobj.type && DAML.Vtypes[pobj.type]) {
      typefun = DAML.Vtypes[pobj.type];
    } else if(DAML.Vtypes.fallback) {
      typefun = DAML.Vtypes.fallback;
    } else {
      typefun = function(value) {return DAML.recursive_run(value);}; // this shouldn't ever happen, but just in case.
    }
    
    // compile value
    if(clean_params[pkey] && typeof clean_params[pkey] == 'object') {
      value = DAML.compile(clean_params[pkey], (pipe_count == 1 ? 2 : 0));
    } else {
      value = clean_params[pkey];
    }
    
    // build value list
    if(DAML.isNice(value)) {
      values.push(typefun.bind(typefun, value));
      // THINK: f.bind.apply(f, [f,2,5,3]) ?
    }
    else if(pobj.hasOwnProperty('fallback')) {
      values.push(typefun.bind(typefun, pobj.fallback));
    }
    else if(pobj.required) {
      failure = true; // wait until all params have been checked, in case there's more errors.
      DAML.onerror(params, 'Missing required parameter: ' + pkey);
    }
    else {
      values.push(undefined);
    }
  }
  
  return failure ? false : values;
};

// THINK: combine this with the parser?
// ptree -> set of fing stacks
DAML.flatten = function(daml) {
  if(!daml || typeof daml != 'object') {
    return daml;
  }

  // if it's a list then flatten the innards
  if(!daml['m'] || !daml['f'] || !daml['p'] || Object.keys(daml).length != 3) {
    var output = (Array.isArray(daml) ? [] : {}),
        keys = _.keys(daml);

    for(var key in daml) {
      output[key] = DAML.flatten(daml[key]);
    }

    return output;
  }
  
  // compiler directives
  if(daml['m'] == '__compiler') {
    // var funk = DAML.__compiler[daml['f']];
    // if(funk) {
    //   return funk(daml['p']);
    // }
    
    // make a fing
    var params = daml['p'];
    if(params.string.indexOf(ObCh) == -1) return params.string;

    var string = params.string.replace(UnExObRe, '{').replace(UnExCbRe, '}');
    var ptree = DAML.wrap_command('string', 'join', {value: params.ptree, on: ''});
    var fun = DAML.compile(ptree);

    return DAML.fingify(string, ptree, fun);
    
  }
  
  // ceci est une pipe
  if(daml['m'] == 'process' && daml['f'] == 'pipe') {
    pipe_count = 1;
  }
    
  // have daml, will travel.
  model = DAML.models[daml.m];
  if(!model) {
    return DAML.onerror(daml, 'Invalid model');
  }
  
  method = model.methods[daml.f];
  if(!method) {
    return DAML.onerror(daml, 'Invalid method');
  }
  
  fun = method.fun;
  if(typeof fun != 'function') return DAML.onerror(daml, 'Invalid fun');
  
  params = DAML.fix_params(method, daml.p, pipe_count); // returns a list of values, each wrapped in a type function
  if(!params) return false; // error inside fix_params
  
  var pkeys = [];
  for(var i=0, l=method.params.length; i < l; i++) {
    pkeys.push(method.params[i].key);
  }
  
  for(var i=0, l=pkeys.length; i < l; i++) {
    falsies[i] = method.params[i].falsy === false;
  }
  
  thunk = function() {
    var output, done = false, values = [], pval;
    
    // we have to process the params at call-time to catch all the variably goodness
    for(var i=0, l=params.length; i < l; i++) {
      if(typeof params[i] == 'function') {
        pval = params[i](); // params[i] should be a var type wrapper function
        values.push(pval); 
        if(!pval && falsies[i]) {
          DAML.onerror('Invalidly false parameter for command: ' + daml.m + ' ' + daml.f);
          return false;
        }
      } else {
        values.push(params[i]); // this probably only pushes undefined, but you never know
      }
    }
    
    // THINK: What should the 'this' context be? Using model is ok (allows setting properties shared across methods), but maybe something else is better?
    try {
      output = fun.apply(model, values); 
    } catch(e) {
      // TODO: put the *actual* command into the message... somehow
      DAML.onerror(e, 'Error in command: ' + daml.m + ' ' + daml.f + '; message: ', e.message);
      return false;
    }
    
    return output;
  };
  
  return thunk;  
};


// string -> ptree 
// returns a canonical DAML object. use DAML.run(string) if you just want to run it.
DAML.parse = function(string, fing_flag) {
  var thing, temp, output=[];
  
  if(typeof string == 'number') return string;
  if(typeof string != 'string') return '';
  
  // THINK: if we're here and the string ends in String.fromCharCode(8), we should do something fancy...
  // FIXME: this is really hacky, using fing_flag instead
  var this_was_a_string_thing_fing_bing = false;
  if(string.slice(-1) == String.fromCharCode(8)) {
    string = string.slice(0, -1);
    if(string.indexOf(DAML.command_open) !== -1) {
      this_was_a_string_thing_fing_bing = true;
    }
  }
  
  var old_string = string;
  
  while(thing = DAML.get_next_thing(string)) {
    if(thing.start) output.push(string.slice(0, thing.start)); // add prologue
    
    switch(thing.type) {
      case 'command':
        temp = DAML.command_parser(thing.command);
        if(DAML.isNice(temp)) output.push(temp);
      break;
      
      case 'block':
        temp = DAML.block_parser(thing);
        if(DAML.isNice(temp)) output.push(temp);
      break;
      
      case 'comment':
      break;
    }
    
    string = string.slice(thing.end);
  }
  
  if(string) output.push(string); // add epilogue
  
  // if there's multiple things in the daml string, join them all together
  if(output.length > 1 || this_was_a_string_thing_fing_bing) { // FIXME: really hacky
    // if(DAML.in_fing) {
    //   output = DAML.wrap_command('string', 'join', {value: output});
    // } else {
      
      // if(typeof output[output.length - 1] == 'string' && output[output.length - 1].slice(-1) == String.fromCharCode(8)) {
      //   output[output.length - 1] = output[output.length - 1].slice(0, -1);
      // }
      // 
      // FIXME: super DUPER haxzor pooper
      old_string = old_string.replace(ExObRe, ObCh).replace(ExCbRe, CbCh);
      output = DAML.wrap_command('__compiler', 'make_fing', {string: old_string, ptree: output});
    // }
  } 
  else if(!output.length) {
    output = '';
  }
  else {
    output = output[0]; // raw params

    // if(typeof output == 'string' && output.slice(-1) == String.fromCharCode(8)) {
    //   output = output.slice(0, -1);
    // }
  }
  
  
  return output;
};

// dives in to strings-in-strings, so {"{:asdf}"} -> asdf instead of {:asdf}
// THINK: the above comment is kind of wrong...
DAML.parse_deep = function(string) {
  var i = 0, output = string, old_output = '';
  
  do {
    if(output.m == '__compiler') break;
    
    if(old_output == output) break;
    old_output = output;
    
    if(typeof output == 'number') {
      return output;
    } 
    else if(typeof output == 'string') {
      output = DAML.parse(output);
    }
    else {
      output = DAML.recursive_leaves(output, DAML.parse);
    }
  } while(i++ < 1000); // prevents infinite loops if things go awry
  
  return output;
};


/**
* fetch the next interesting thing  
* @param string  
* @return array 
*/ 
// get the next interesting thing from this string
DAML.get_next_thing = function(string) {
  // TODO: aliases, pipe support, block support, param entities (quotes, lists, embedded commands...)
  
  // string parsing... ugh.
  
  // TODO: handle escaped braces, somehow
  
  var first_open, next_open, next_closed, end_tag, end_begin, end_end, block_name, thing = {};
  
  first_open = next_open = next_closed = string.indexOf(DAML.command_open);
  if(first_open == -1) return false; // nothing to do

  do {
    next_open = string.indexOf(DAML.command_open, next_open + 1);
    next_closed = string.indexOf(DAML.command_closed, next_closed) + 1;
  } while(next_closed && next_open != -1 && next_closed > next_open);

  // TODO: add a different mode that returns the unfulfilled model / method etc (for autocomplete)
  if(!next_closed) return DAML.onerror("No closing brace for '" + string + "'");

  thing = {
    start: first_open,
    end: next_closed,
    command: string.slice(first_open, next_closed),
    type: string.slice(first_open+1, first_open+2) == '/' ? 'comment' : 'command'
  };

  if(thing.command.slice(0,7) != '{begin ') return thing; // return if it's not a block
  
  // handle blocks
  thing.type = 'block';

  block_name = thing.command.match(/^\{begin (\w+)/);
  if(!block_name) return DAML.onerror(string, 'Something weird happened');
  block_name = block_name[1];
  
  end_end = '{end ' + block_name + '}';
  end_begin = string.indexOf(end_end);
  if(!end_begin) {
    DAML.onerror(string, "No end tag for block '" + block_name + "'");
    thing.type = 'comment';
    return thing;
  }
  
  end_end = end_begin + end_end.length;
  thing.innards = string.slice(next_closed, end_begin);
  thing.string = string.slice(first_open, end_end);
  thing.end = end_end;
  thing.name = block_name;

  return thing;
};


/**
* parse a command  
* @param string 
* @return object 
*/ 
DAML.command_parser = function(string) {
  var command, output = [], commands = DAML.get_commands_from_string(string);
  if(!commands) return false;

  for(var i=0, l=commands.length; i < l; i++) {
    command = DAML.command_helper(commands[i]);
    
    if(!command.f) { // if there's no method process it as a param
      command = DAML.param_parser(command.m);
      // value = DAML.param_parser(command.m);
      // output.push(value); // THINK: is this right?
      // continue;
    }
    
    // NOTE: we're leaving the params in their object form, to be dealt with by the compiler.
    // NOTE: the param_parser has already put param values into canonical form
    
    output.push(command);
  }
  
  if(!output.length) return false;
  if(output.length == 1) return output[0];

  return DAML.wrap_pipe(output);
};


/**
* parse a block
* @param array  
* @return string 
*/ 
DAML.block_parser = function(block) {
  var setvar, command, innards = DAML.parse(block.innards);

  command = block.command.slice(7, -1).replace(/^\w+\s*/, ''); // chop '{begin ', '}' and block name
  setvar = DAML.wrap_command('variable', 'set', {path: block.name, value: innards});
  
  if(command && command.match(/^\|\s*$/)) { // just a single pipe
    command = setvar;
  }
  else if(command) {
    // trim initial pipe
    // command = command.slice(1); // NOTE: keeping a pipe in the front forces a pipeline with "" as segment 0.
    
    // there's a command following the block
    command = DAML.command_parser(command); // always returns a pipeline
    
    // if(!(command.m == 'process' && !command.f == 'pipe')) {
    //   command = DAML.wrap_pipe([command]); // convert command to pipeline
    // }
    
    command.p.value[0] = setvar;
  } 
  else {
    // command = innards;
    // command = '';
    // command = setvar;
    command = DAML.wrap_pipe([setvar, ""]);
  }
  
  // NOTE: these unshifts are ordered from last-called to first-called:
  
  // and finally put innards back in front of the command
  // command.pipe.unshift({m: 'variable', f: 'get', p: {path: block.name}}); 
  
  // then make a new var context
  // command.p.value.unshift(DAML.wrap_command('variable', 'push_context'));
  
  // first set the block var
  // command.p.value.unshift(DAML.wrap_command('variable', 'set', {path: block.name, value: innards}));
  
  // NOTE: done with reverse ordering now
  
  // pop off our new var context
  // command.p.value.unshift(DAML.wrap_command('variable', 'pop_context'));
  
  // THINK: why does this happen here? why not embed it in the pipeline? And where's the push_context call??
  // DAML.call('variable', 'set', [block.name, innards]); 
  
  // DAML.models.variable.methods.set.fun(block.name, innards);
  
  return command;
  
  //   // add to block vars
  //   $GLOBALS['X']['VARS']['BLOCK'][$block_name] = $thing['innards'];

  //   // return data only if there's a command
};


/**
* return an array of commands from a pipeline string
* @param string  
* @return string 
*/ 
DAML.get_commands_from_string = function(string) {
  var first_pipe, open_brace_count, closed_brace_count, quote_count, substring, commands=[];
  
  if(string[0] == DAML.command_open && string.slice(-1) == DAML.command_closed) {
    string = string.slice(1, -1); // trim designators
  }
  
  if(!string.length) return []; // THINK: what's the null return from here?

  // for each command in the string
  do {
    // TODO: unpaired braces inside quotes need to be escaped!
    // find a pipe that isn't in {...} or "..."
    do { 
      first_pipe = string.indexOf('|', first_pipe + 1);
      if(first_pipe == -1) break;
      substring = string.slice(0, first_pipe);
      open_brace_count = substring.split(DAML.command_open).length - 1;
      closed_brace_count = substring.split(DAML.command_closed).length - 1;
      quote_count = substring.split(DAML.quote).length - 1;
    } while (first_pipe != -1 && (open_brace_count != closed_brace_count || quote_count % 2 !== 0));
  
    if(first_pipe == -1)
    {
      if(string !== '') {
        commands.push(string.trim());
      }
      string = false;
    }
    else
    {
      // if(string.slice(0, first_pipe).trim() !== '') {
        commands.push(string.slice(0, first_pipe).trim());
      // }
      string = string.slice(first_pipe + 1);
      first_pipe = -1;
    }
    
  } while (string.length);
  
  return commands;
};


/**
* get the handler, method, and param array from a command  
* @param string  
* @return string 
*/ 
DAML.command_helper = function(string) {
  var open_paren_count, closed_paren_count, open_brace_count, closed_brace_count, quote_count, first_word, substring, param_key, param_value, first_space=0, words=[], params=[], command={}, match;
  
  // find the first word
  match = (string + ' ').match(/^(\S+)\s/);
  if(match === null) {
    return DAML.wrap_command(''); // empty command
  } else {
    first_word = match[1];
  }
  
  // search for word in the aliases array
  if(first_word && DAML.aliases[first_word]) {
    string = DAML.aliases[first_word] + ' ' + string.slice(first_word.length + 1);
  }
  
  // for each "word" in the string
  do {
    // TODO: unmatched single braces or parens or brackets inside quotes
    // find a space that isn't in {...} or "..." or (...)
    do { 
      first_space = string.indexOf(' ', first_space + 1);
      if(first_space == -1) break;
      substring = string.slice(0, first_space);
      quote_count = substring.split('"').length - 1;
      open_paren_count = substring.split('(').length - 1;
      closed_paren_count = substring.split(')').length - 1;
      open_brace_count = substring.split(DAML.command_open).length - 1;
      closed_brace_count = substring.split(DAML.command_closed).length - 1;
    } while (first_space != -1 && (open_paren_count != closed_paren_count || open_brace_count != closed_brace_count || quote_count % 2 !== 0));
  
    if(first_space == -1)
    {
      words.push(string.trim());
      string = false;
    }
    else
    {
      words.push(string.slice(0, first_space).trim());
      string = string.slice(first_space).trim();
      first_space = 0;
    }
    
  } while(string.length);
  
  // organize array
  command.m = words.shift();
  if(words.length) {
    command.f = words.shift();
  }
  
  if(!command.p) command.p = {};
  
  while(words.length)
  {
    param_key = words.shift();
    param_value = words.length ? words.shift() : false;
    if(param_value || param_value.toString() === "0" || param_value === '') { // the is_true function, hard-coded for speed
      // TODO: revise the above "is_true" function...
      command.p[param_key] = DAML.param_parser(param_value);
    }
  }
  
  return command;
};


/**
* figure out what to do with a param string  
* @param string  
* @return string 
*/ 
DAML.param_parser = function(string) {
  var temp, value;
  
  // :word => literal keyword (one-word string)
  if(string[0] == ':') value = string.slice(1);
  
  // "..." => literal string (actually a fing)
  else if(string[0] == DAML.quote && string.slice(-1) == DAML.quote) value = DAML.parse_deep(string.slice(1, -1) + String.fromCharCode(8)); // FIXME: really hacky!
  
  // {...} => command string
  else if(string[0] == DAML.command_open && string.slice(-1) == DAML.command_closed) value = DAML.parse_deep(string);
  
  // (...) => list param, convert to array
  else if(string[0] == '(' && string.slice(-1) == ')') value = DAML.list_parser(string);
  
  // digits => number
  else if(+string || string === "0") value = +string;

  // bareword => local var
  // @var => global var
  // VAR => read-only global var
  else if(string.match(/^@?\w+/)) value = DAML.wrap_var(string);

  // bareword.foo => local var subitem
  // else if(string.match(/^\w+\..*/))
  //   value = DAML.get_nested_param_value(string.match(/^\w+\..*/)[0], DAML.VARS.LOCAL);

  // #var => request item
  else if(string.match(/^#[-]?\w+/))
    value = DAML.wrap_var('REQUEST.' + string.slice(1));
  
  // #var.foo => request item subitem
  // else if(string.match(/^#/))
  //   value = DAML.get_nested_param_value(string.slice(1), DAML.VARS.REQUEST);
  
  // var => block var
  // else if(string.match(/^\$(\w+)$/))
  //   value = DAML.VARS.BLOCK[string.slice(1)];
  
  // @var => static var (includes @var.foo too)
  // else if(preg_match('/^@(.+)/', string, matches))
  //   value = Processor::get_variable_value(matches[1]);
  
  // %var => content item
  // else if(preg_match('/^%([a-zA-Z_][\/:a-zA-Z0-9_-]+)/', string, matches))
  //   value = ContentLib::get_value_from_handle(matches[1]);
    
  // it doesn't match, so just return it
  // else value = string;
  // return false, since we couldn't find this value 
  else value = false;
  
  // NOTE: make a list of acceptable word characters... delineate the limits for variable names, content keywords, request keywords, etc. (e.g., can they have '-'?) 
  
  // return false instead of NULL to allow differentiation of params that exist (but might be false) from absent params
  value = value === null ? false : value; // THINK: do we need this? what params can return a NULL value? [vars that haven't been initialized can...]
  
  return value;
};


/**
* return some daml (in array form) that grabs the variable value
* @param string 
* @return mixed 
*/ 
DAML.wrap_var = function(path) {
  return DAML.wrap_command('variable', 'get', {path: path});
};



/**
* build an array of parameters  
* @param string  
* @return array 
*/ 
DAML.list_parser = function(string) {
  var open_paren_count, closed_paren_count, open_brace_count, closed_brace_count, quote_count, first_word, substring, param_key, param_value, value_array=[], first_space=0, first_newline=0, words=[], params=[], command={};
  
  // strip ( and )
  if(string[0] == '(' && string.slice(-1) == ')') string = string.slice(1, -1).trim();
  
  if(!string) return [];
  
  // for each "word" in the string
  do {
    // find a space or newline that isn't in {...} or "..." or (...) or [...]
    do { 
      first_newline = string.indexOf("\n", first_space + 1);
      first_space = string.indexOf(' ', first_space + 1);
      if(first_newline != -1 && (first_newline < first_space || first_space == -1)) {
        first_space = first_newline;
      }
      if(first_space == -1) break;
      substring = string.slice(0, first_space);
      quote_count = substring.split('"').length - 1;
      open_paren_count = substring.split('(').length - 1;
      closed_paren_count = substring.split(')').length - 1;
      open_brace_count = substring.split(DAML.command_open).length - 1;
      closed_brace_count = substring.split(DAML.command_closed).length - 1;
    } while (first_space != -1 && (open_paren_count != closed_paren_count || open_brace_count != closed_brace_count || quote_count % 2 != 0));
  
    if(first_space == -1)
    {
      words.push(string.trim());
      string = '';
    }
    else
    {
      words.push(string.slice(0, first_space).trim());
      string = string.slice(first_space).trim();
      first_space = 0;
    }
    
  } while (string !== '');
  
  // process each param // THINK: we're adding words that don't have values for the logic methods, but this might mess up other things. make sure you check for empty words when you eat lists
  for(var i=0, l=words.length; i < l; i++) {
    value_array.push(DAML.param_parser(words[i]));
  }

  return value_array;
};


// Find some values for a variable path
DAML.resolve_path = function(path, base) {
  var words, word, value, index, temp, flat_value;
  
  if(path.indexOf(DAML.command_open) != -1) path = DAML.run(path);
  
  if(!path) return base;
  
  if(path.indexOf('.') == -1) return DAML.isNice(base[path]) ? base[path] : false;
  
  words = path.split('.');
  value = base[words.shift()]; // THINK: this is by reference...
  
  for(var i=0, l=words.length; i < l; i++) {
    word = words[i];
    
    if(!value) return value; // value == false, so return it
    
    if(typeof value == 'function') value = value();
    
    // value is scalar, but there's more words to parse... so return false.
    if((/boolean|number|string/).test(typeof value)) return false;
    
    // unpack objects // THINK: why do we need this?
    // if(!(value instanceof Array)) value = value ? [value] : []; // THINK: value === 0?
    
    // for a hash, substitute value
    if(value.hasOwnProperty(word)) {
      value = value[word];
    }
    
    // for #-X, return the Xth item from the end
    else if(word[0] == '#' && word[1] == '-' && +word.slice(2)) {
      flat_value = _.toArray(value);
      index = flat_value.length - +word.slice(2);
      value = flat_value[index];
    }
    
    // for #X, return the Xth item
    else if(word[0] == '#' && +word.slice(1)) {
      // OPT: use a for-in here and shortcut it
      flat_value = _.toArray(value);
      value = flat_value[+word.slice(1) - 1];
    }
    
    // just in case we want every value of an array moved up a slot
    else if(word == '*') {
      temp = {};
      _.each(value, function(item, key) {
        if(typeof item == 'object') {
          _.each(item, function(inner_item, inner_key) {
            if(temp[inner_key]) temp[temp.length - 1] = inner_item;
            else temp[inner_key] = inner_item;
          });
        }
      });
      value = temp ? temp : false;
    }
    
    // for AoH, build new AoH
    else if(!+word && ( // THINK: no digits... something happens with integer ids, or something.
             typeof value[Object.keys(value)[0]] == 'object' ||
             (typeof value[Object.keys(value)[0]] == 'function' &&
               typeof value[Object.keys(value)[0]]() == 'object' 
             ) // yeah, this is kind of awful. but we have to check inside the array, and it might be full of funs.
           )) { // OPT: cache the above stuff for things and stuff.
      temp = [];
      _.each(value, function(item, key) {
        if(typeof item == 'function') item = item();
        if(typeof item == 'object' && word in item) {
          if(item[word] instanceof Array) { // item[word] is AoH, so pop H's
            for(var i=0, l=item[word].length; i < l; i++) {
              temp.push(item[word][i]);
            }
          }
          else { // item[word] is H
            temp.push(item[word]);
          }            
        }
      });

      // THINK: if word is bad should we return value? null? set a warning? -- this seems to work for now, but probably requires a lot more testing / use cases.
      if(temp) value = temp;
      else value = false;
    }
    
    // just give up
    else {
      value = false;
    }
  }

  return DAML.isNice(value) ? value : false;
};

// NOTE: this set of tests allows us to confirm non-string return values, which we can't do in the html test suite. 
test_strings = [
  '{123}', 123,
  '{123} baz', '123 baz',
  '{:foo}', 'foo',
  '{:foo} baz', 'foo baz',
  '{(:foo :bat)}', ["foo","bat"],
  '{(:foo :bat)} bar', '["foo","bat"] bar',
  '{foo asdf}', false,
  '{foo asdf} bax', ' bax',
  '{string split value "foo baz" on " "}', ["foo","baz"],
  '{string split value "foo bat" on " "} baz', '["foo","bat"] baz',
  '{string grep value "hello world" on :llo}', ["hello world"],
  '{string grep value (:hello :world) on :llo}', ["hello"],
  '{string grep value (:hello :world) on "/.llo/"}', ["hello"],
  '{string grep value {string split value "foo baz bat bar" on " "} on :oo}', ['foo'],
  '{(:hello :world) | string grep on :llo}', ["hello"],
  '{(:hello :world) | grep :llo}', ["hello"],
  '{begin foo}hello{end foo}', 'hello',
  '{begin foo | ""}hello{end foo}', '',
  '{begin foo | grep :llo}hello{end foo}', ["hello"],
  '{begin foo | string split on " " | grep :h}hello how are you?{end foo}', ["hello", "how"],

  // variables
  '{begin foo | ""}hello{end foo}{foo | grep :llo}', '["hello"]',
  '{> :x value (:foo :buzz :bizz :bazz) | grep :zz value x}', ["buzz", "bizz", "bazz"],
  '{begin foo | string split on " " | > :x}hello hey zebra squid{end foo}{x | grep :h}', '["hello","hey"]',

  // TODO: more value check, and unclosed-block

  undefined, undefined,
  '', false, // THINK: is this correct?
  false, false,
  null, null,
  0, 0,
  '0', '0',
];





// run_tests = function() {
//   var fails = 0;
//   for(var i=0, l=test_strings.length; i < l; i=i+2) {
//     if(JSON.stringify(DAML.run(test_strings[i])) != JSON.stringify(test_strings[i+1])) {
//       console.log('test ' + i/2 + ': ', test_strings[i]);
//       console.log('expected: ', test_strings[i+1]);
//       console.log('output: ', DAML.run(test_strings[i]));
//       console.log('ptree: ', DAML.parse(test_strings[i]));
//       fails++;
//     }
//   }
//   
//   return fails ? 'There were ' + fails + ' errors.' : 'You win!!!!!';
// };


DAML.execute = function(model, method, params) {
  // TODO: add some error checking
  // TODO: make another version that uses the type system instead of slamming params straight in.
  return DAML.models[model].methods[method].fun.apply(DAML.models[model], params);
};

// apply a function to every leaf of a tree
DAML.recursive_leaves = function(values, fun, seen) {
  if(!values || typeof values != 'object') return fun(values);

  // FIXME: THIS IS A TERRIBLE HACK!
  // if(values.__proto__ != Object.prototype)  return values; 
  
  seen = seen || []; // only YOU can prevent infinite recursion...
  if(seen.indexOf(values) !== -1) return values;
  seen.push(values);
  
  for(var key in values) {
    if(typeof values[key] == 'object') values[key] = DAML.recursive_leaves(values[key], fun, seen);
    else values[key] = fun(values[key]);
  }

  return values;
};

// apply a function to every leaf of a tree, but generate a new copy of it as we go
DAML.recursive_leaves_copy = function(values, fun, seen) {
  if(!values || typeof values != 'object') return fun(values);

  seen = seen || []; // only YOU can prevent infinite recursion...
  if(seen.indexOf(values) !== -1) return values;
  seen.push(values);
  
  var new_values = (Array.isArray(values) ? [] : {}); // NOTE: using new_values in the parse phase (rebuilding the object each time we hit this function) causes an order-of-magnitude slowdown. zoiks, indeed.
  
  for(var key in values) {
    // this is only called from toPrimitive and deep_copy, which both want fings
    if(DAML.isFing(values[key])) {
      new_values[key] = fun(values[key]); // fings are immutable
    } else if(typeof values[key] == 'object') {
      new_values[key] = DAML.recursive_leaves_copy(values[key], fun, seen);
    } else {
      new_values[key] = fun(values[key]);
    }
  }

  return new_values;
};

// apply a function to every branch of a tree
// DAML.recursive_walk = function(values, fun, seen) {
//   if(!values || typeof values != 'object') return values;
// 
//   seen = seen || []; // only YOU can prevent infinite recursion...
//   if(seen.indexOf(values) !== -1) return values;
//   seen.push(values);
//   
//   for(var key in values) {
//     var value = values[key];
//     if(typeof value == 'object') values[key] = fun(DAML.recursive_walk(value, fun, seen))
//     else values[key] = value;
//   }
//   return values;
// };

// run every function in a tree (but not funs funs return)
DAML.recursive_run = function(values, seen) {
  if(DAML.isFing(values)) return values;
  if(typeof values == 'function') return values();
  if(!values || typeof values != 'object') return values;
  
  seen = seen || []; // only YOU can prevent infinite recursion...
  if(seen.indexOf(values) !== -1) return values;
  seen.push(values);

  var new_values = (Array.isArray(values) ? [] : {});
  
  for(var key in values) {
    var value = values[key];
    if(typeof value == 'function') {
      new_values[key] = value();
    }
    else if(typeof value == 'object') {
      new_values[key] = DAML.recursive_run(value, seen);
    }
    else {
      new_values[key] = value;
    }
  }
  return new_values;
};

// NOTE: defunctionize does a deep clone of 'values', so the value returned does not == (pointers don't match)
// THINK: there may be cases where this doesn't actually deep clone...

// run functions in a tree until there aren't any left (runs funs funs return)
DAML.defunctionize = function(values) {
  if(!values) return values; // THINK: should we purge this of nasties first?

  if(values.__nodefunc) return values;
  
  if(DAML.isFing(values)) return values.run(); // THINK: DAML.defunctionize(values.run()) ??  
  if(typeof values == 'function') return DAML.defunctionize(values());
  if(typeof values != 'object') return values;
  
  var new_values = (Array.isArray(values) ? [] : {});

  // this is a) a little weird b) probably slow and c) probably borked in old browsers.
  Object.defineProperties(new_values, {
    __nodefunc: {
      value: true, 
      enumerable:false
    }
  });
  
  for(var key in values) {
    var value = values[key];
    if(typeof value == 'function') new_values[key] = DAML.defunctionize(value());
    else if(typeof value == 'object') new_values[key] = DAML.defunctionize(value); 
    else new_values[key] = value;
  }
  
  return new_values;
};

// walk down into a list following the path, running a callback on each end-of-path item
DAML.recursive_path_walk = function(list, path, callback, parent) {
  if(typeof list != 'object') {
    if(!path) callback(list, parent); // done walking, let's eat
    return; 
  }

  // parents for child items
  // THINK: this is inefficient and stupid...
  var this_parent = {'parent': parent};
  for(var key in list) {
    this_parent[key] = list[key];
  }

  // end of the path?
  if(!path) {
    for(var key in list) {
      callback(list[key], this_parent);
    }
    return; // out of gas, going home
  }

  var first_dot = path.indexOf('.') >= 0 ? path.indexOf('.') : path.length;
  var part = path.slice(0, first_dot); // the first bit
  path = path.slice(first_dot + 1); // the remainder

  if(part == '*') {
    for(var key in list) {
      DAML.recursive_path_walk(list[key], path, callback, this_parent);
    }
  } else {
    if(typeof list[part] != 'undefined') {
      DAML.recursive_path_walk(list[part], path, callback, this_parent);
    }
  }
};

// DAML.recursive_merge = function(into, from) {
//   // THINK: we're not blocking infinite recursion here -- is it ever likely to happen? [also, this fun isn't used]
//   
//   if(!into || typeof into != 'object') into = {};
//   
//   if(from) {
//     _.each(from, function(value, key) {
//       into[key] = typeof value != 'object' ? value : DAML.recursive_merge(into[key], value);
//     });
//   }
//   else {
//     into = from;
//   }
//   
//   return into; // THINK: pass-by-ref...
// };

// this is different from recursive_merge, because it replaces subvalues instead of merging
DAML.recursive_insert = function(into, keys, value) {
  // THINK: we're not blocking infinite recursion here -- is it likely to ever happen?
  if(!into || typeof into != 'object') into = {};
  
  if(typeof keys == 'string') keys = keys.split('.');
  
  if(keys.length) {
    var key = keys.shift();
    into[key] = DAML.recursive_insert(into[key], keys, value);
  }
  else {
    into = value;
  }
  
  return into;
};


DAML.isNice = function(value) {
  return !!value || value == false; // not NaN, null, or undefined
  // return (!!value || (value === value && value !== null && value !== void 0)); // not NaN, null, or undefined
};

DAML.wrap_command = function(model, fun, params) {
  if(!params) params = {};
  var output = {m: model, p: params};
  if(fun) output.f = fun;
  return output;
};

DAML.wrap_pipe = function(commands) {
  commands = commands ? commands : [];
  return DAML.wrap_command('process', 'pipe', {value: commands});
};

// this converts non-iterable items into a single-element array
DAML.toArray = function(value) {
  if(Array.isArray(value)) return Array.prototype.slice.call(value);
  if(typeof value == 'object') return DAML.obj_to_array(value);
  if(value === false) return []; // hmmm...
  return [value];
};

DAML.obj_to_array = function(obj) {
  var arr = [];
  for(key in obj) {
    arr.push(obj[key]);
  }
  return arr;
};

// DAML.makefun = function(value) {
//   if(typeof value == 'function') return value;
// 
//   value = DAML.compile(value);
//   if(typeof value == 'function') return value;
//   
//   return function() {return value};
// };


// this is guaranteed to return a string. 
// [actually, this isn't true...] it's used for final output, among other things.
DAML.stringify = function(value) {
  if(DAML.isFing(value)) return value.toString();
  
  if(typeof value == 'function') {
    if(DAML.isFing(value())) return value().toString(); // handles wrapped fings // THINK: is this enough?
    // THINK: this is really nasty, if the value() isn't a fing, because it actually processes it twice.
  }
  
  value = DAML.defunctionize(value);

  if(typeof value == 'string') value = value;
  else if(typeof value == 'number') value = value + "";
  else if(typeof value == 'boolean') value = ""; // THINK: we should only cast like this on output...
  else if(typeof value == 'object') value = JSON.stringify(value);
  else if(value && value.toString) value = value.toString();
  else value = '';
  
  // TODO: consider making all falsy values (false, NaN, undefined, null) go to "", and have "" e.g. disappear from toArray etc. maybe an isFalse function that compares to "". might simplify stuff...
  
  // OR... maybe 'false' is an allowed value, but stringify and toPrimitive convert it to ''. The empty string is a legitimate value, so it doesn't really mean false. So we use 'false' internally, and expose it to the models, but not directly to the output.

  return value; // on output, this should go to '' (instead of, like, undefined)
};


// DAML primitives are numbers, strings, lists, hashes (simple key/value pair objects), and fings. boolean false is used internally to denote nasty values and failures, but generally converted to '' on output.
DAML.toPrimitive = function(value) {
  if(!DAML.isNice(value)) return false;
  if(DAML.isFing(value)) return value; // fings are immutable, so pass-by-ref is ok.
  if(typeof value == 'object') return DAML.recursive_leaves_copy(value, DAML.toPrimitive);
  if(typeof value == 'function') return DAML.toPrimitive(value());
  return value; // string, number, boolean
};

// import a variable from the outside world, deep copying and removing most gunky gunk
DAML.import_var = function(path, value) {
  DAML.execute('variable', 'set', [path, DAML.scrub_var(value)]);
};

// deep copy an internal variable (primitives and fings only)
// NOTE: this is basically toPrimitive, for things that are already primitives. 
DAML.deep_copy = function(value) {
  if(!value || typeof value != 'object') return value; // number, string, or boolean
  if(DAML.isFing(value)) return value; // fings are immutable, so pass-by-ref is ok.
  return DAML.recursive_leaves_copy(value, DAML.deep_copy);
};

// copy and scrub a variable from the outside world
DAML.scrub_var = function(value) {
  try {
    return JSON.parse(JSON.stringify(value)); // this style of copying is A) the fastest deep copy on most platforms and B) gets rid of functions, which in this case is good (because we're importing from the outside world) and C) ignores prototypes (also good).
  } catch (e) {
    DAML.onerror('Your object has circular references');
    value = DAML.mean_defunctionize(value);
    if(value === null) value = false;
    return value;
  }
};

// this is like defunc, but not as nice -- it trashes funcs and snips circular refs
DAML.mean_defunctionize = function(values, seen) {
  if(!DAML.isNice(values)) return false;
  if(!values) return values;

  if(typeof values == 'function') return null;
  if(typeof values != 'object') return values; // number, string, or boolean

  seen = seen || []; // only YOU can prevent infinite recursion...
  if(seen.indexOf(values) !== -1) return null;
  seen.push(values);

  var new_values = (Array.isArray(values) ? [] : {});
  
  for(var key in values) { // list or hash: lish
    var new_value, value = values[key];
    new_value = DAML.mean_defunctionize(value, seen);
    if(new_value === null) continue;
    new_values[key] = new_value;
  }
  
  return new_values;
};



// FING STUFF HERE

// DAML.get_fing = function(string) {
//   var hash = murmurhash(DAML.stringify(string));
//   return DAML.FINGS[hash] ? DAML.FINGS[hash] : false;
// };

DAML.isFing = function(value) {
  if(typeof value != 'object') return false;
  return !!value // && !!value.toPtree;
};

DAML.fingify = function(string, ptree, fun) {
  // if string is a fing, return it
  if(DAML.isFing(string)) return string;
  
  // THINK: what becomes of objects? like, how should we handle an array?
  
  // if string isn't a string, stringify it
  if(typeof string != 'string') string = DAML.stringify(string);
  
  // existing fing?
  var hash = murmurhash(string);
  // OPT: speed test murmurhash implementations -- this takes awhile if you're doing a lot of compiling
  if(!DAML.FINGS[hash]) {
    DAML.FINGS[hash] = DAML.Fing.spawn({}, string, ptree, fun);
  }
  
  return DAML.FINGS[hash];
};

// DAML.run_if_fun = function(value) {
//   return (typeof value == 'function') ? value() : value;
// };

DAML.fun_run = function(value) {
  return (typeof value == 'function') ? DAML.fun_run(value()) : value;
};


/* 
    A Fing is a 'function/string'. It's an object that can behave as a regular old string or as a DAML function. 
    
    Make a new Fing:
    DAML.Fing.spawn({}, string);
    
    // A fing is run when:
    // - coerced by a type function [does this really happen?]
    // - executed inside e.g. {process each}
    // - explicitly 'run' via {process run}
    // - end of command reached 
    //   - (== string join type coercion) [this is explicit in {string join} ... ??]
    
    when are fings run?
    - when explicitly {process run}'d
    - {process each} as a template eg -- ie inside commands
    - at the end of a pipeline, like the trivial one {fing} -- but if you do anything to it, like {fing | string transform old " " new "_"} then you have to {process run} or {process unquote} it, because the transformed value is dead. 
      - also, {fing | (__)} is converted into json, with the fing as an unprocessed string. You'd have to explicitly use {run} on the items in the aray, or use a command that processes everything in an array -- otherwise your nested fings just end up in string form via JSON conversion.
      - but, for reference, {fing | (__) | __.#1} is run, as is {fing | > :var} and {(fing 2) | > :var | __.#1}
    
    Fings contained in a list will be coerced to the fing's string form, instead of being run prior to stringification. To explicitly run all fings in a list use the 'run' command.
    
    Fings have access to the entire environment in which they are run. They can also output directly into that environment. This makes for highly modular templates, but it can also lead to nasty surprises if that local environment isn't what you were expecting. 
    
    Importing a fing into a DAML command wraps it in a protective blanket -- the only inputs available are the parameters it takes, and the only output is stdout. [make stdout better]
    
    
    
    
  our 'string -> ptree -> compiled' might not apply anymore. the string is still parsed, but what comes out of that isn't really a tree, it's a stack. and it might as well be a full-fledged function stack. what good is a ptree? if we unroll everything as we parse, we don't really need one, since our end goal isn't a tree but a stack.
  is this reasonable? it's going to require a lot of fiddly array splicing. would it be better to make a tree and then flatten that?
  i currently see no disadvantage in pushing the flattening straight into the parse return. lets do that for now.
    
    
*/
DAML.Fing = {
  init: function(string, flags) {
    // parse and compile to stack 
    var ptree = DAML.parse(string),
        stack = DAML.compile(ptree)
    
    // add immutable props
    Object.defineProperties(this, {
      hash: {
        value: murmurhash(string), 
        enumerable:true
      },
      string: {
        value: string, 
        enumerable:true
      },
      flags: {
        value: flags ? flags : {}, 
        enumerable:true
      },
      ptree: {
        value: ptree, 
        enumerable:true
      },
      stack: {
        value: stack, 
        enumerable:true
      }
    });
    
    return this;
  },
  
  // getters:
  toString: function() {
    return this.string;
  },
  
  toJSON: function() {
    return this.string; // because nested fings are jsonified in escaped form [oh, but not transfered that way through vars. shucks.] meaning, on output the fing is quoted, not run. but in/out of vars, the fing needs to retain its finginess. if we use JSON.stringify for both, this gives troubles.
  },
  
  spawn: function(overwriter) {
    var key, newobj = Object.create(this)

    for(key in overwriter)
      if(overwriter.hasOwnProperty(key)) 
        newobj[key] = overwriter[key]

    if(newobj.init) 
      newobj = newobj.init.apply(newobj, Array.prototype.slice.call(arguments, 1))

    return newobj
  }
}


// ok some new experimental stuff 
// var stack = new Stacker(fing, function (val) {console.log(val)})
// stack.run()

DAML.Stacker = function(fing, when_done) {
  this.last_value = null
  this.pcounter = 0
  this.size = fing.stack.length
  this.fing = fing
  this.when_done = when_done
  
  // before, amidst, after? maybe we don't need those...
}

DAML.Stacker.prototype.next = function(cb) {
  var self = this

  if(this.pcounter > this.size) return false  // TODO: self-destruct, somehow? this stacker is D-U-N.
  
  if(this.pcounter == this.size) {
    this.when_done(this.last_value) 
    this.pcounter++
    // this can't return anything interesting, right? i mean, our callstack is shot. there's nothing to return to.
    return false
  }
  
  var funitem = this.fing.stack[this.pcounter]
  this.pcounter++
  
  // ... param fiddling
  var params = funitem.params
  for(var i=0, l=params.length; i < l; i++) {
    if(typeof params[i] == 'function') params[i] = params[i](self)
    // or something to that effect...
    // __?: param[1] = function() {return self.last_value}
    // these functions are only for type system dealings with static values and grabbing out past values.
    // and it turns out we need all the values for this stack recorded, because if we have a command with a lot of params that are functions (e.g. vars or fings) we'll need to reference each of those lines
    
  }
  
  // async case
  if(funitem.flags.async) { 
    var new_cb = function(val) {
      self.last_value = val 
      cb(val)
    }
    params.push(new_cb)
    // return funitem.fun.apply(funitem.model, params)
  }
  
  // either way
  // this last_value assignment is overridden in new_cb by async
  self.last_value = funitem.fun.apply(funitem.model, params)
  
  return !!funitem.flags.async
}

DAML.Stacker.prototype.bound_next = function() {
  return this.next.bind(this)
} 

DAML.Stacker.prototype.reset = function() {
  // THINK: this is probably a bad idea, but it makes debugging easier... can we reuse stacks?
  this.last_value = null
  this.pcounter = 0
} 

DAML.Stacker.prototype.run = function() {
  var self = this
  var my_cb = function() {self.run()}
  while(this.pcounter <= this.size) {
    this.next(my_cb)
  }
  return this.last_value
} 

function asdf() {
  ding = {flags: [], stack: []}
  ding.stack[0] = {params: [100, function(stacker) {return 1}], flags: {}, fun: function(p, q) {console.log(p, q, 100); return p + q} }
  ding.stack[1] = {params: [200, function(stacker) {return stacker.last_value}], flags: {}, fun: function(p, q) {console.log(p, q, 111); return p + q} }
  ding.stack[2] = {params: [300, function(stacker) {return stacker.last_value}], flags: {}, fun: function(p, q) {console.log(p, q, 222); return p + q} }

  stack = new DAML.Stacker(ding, function (val) {console.log(val, 12345)})
  
  
  fing = {flags: [], stack: []}
  fing.stack[0] = {params: [], flags: {async: true}, fun: function(cb) {
    var x = new DAML.Stacker(ding, function (val) {cb(val)}) 
    x.run()
  }}
  fing.stack[1] = {params: [7200, function(stacker) {return stacker.last_value}], flags: {}, fun: function(p, q) {console.log(p, q, 111); return p + q} }
  fing.stack[2] = {params: [7300, function(stacker) {return stacker.last_value}], flags: {}, fun: function(p, q) {console.log(p, q, 222); return p + q} }

  fstack = new DAML.Stacker(fing, function (val) {console.log(val, 777)})
}


// er...
// A Fing has a command stack, that's part of it.
// the Stacker takes a fing and a cb, runs the fing, then calls the cb with its value
// stacker needs last_value, pcounter, next function... maybe that's it
// cb will usually be another stacker's bound next fun, but at the top level it's run or something.




/////// SOME HELPER METHODS PUUKE ///////////

DAML.ETC.isNumeric = function(value) {
  return (typeof(value) === 'number' || typeof(value) === 'string') && value !== '' && !isNaN(value)
}

DAML.ETC.toNumeric = function(value) {
  if(value === '0') return 0
  if(typeof value == 'number') return value
  if(typeof value == 'string') return +value ? +value : 0
  return 0
}

DAML.ETC.first = function(value) {
  if(typeof value != 'object') return false;
  for(var key in value) {
    return value[key]
  }
}

DAML.ETC.regex_escape = function(str) {
  var specials = /[.*+?|()\[\]{}\\$^]/g // .*+?|()[]{}\$^
  return str.replace(specials, "\\$&")
}

DAML.ETC.flag_checker_regex = /\/(g|i|gi|m|gm|im|gim)?$/

DAML.ETC.string_to_regex = function(string, global) {
  if(string[0] !== '/' || !DAML.ETC.flag_checker_regex.test(string)) {
    return RegExp(DAML.ETC.regex_escape(string), (global ? 'g' : ''))
  }
  
  var flags = string.slice(string.lastIndexOf('/') + 1)
  string = string.slice(1, string.lastIndexOf('/'))
  
  return RegExp(string, flags)
}

DAML.ETC.is_false = function(value) {
  if(!value) return true // '', 0, false, NaN, null, undefined
  if(typeof value == 'object' && _.isEmpty(value)) return true // empty lists too
}


// via https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/bind
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }
 
    var aArgs = Array.prototype.slice.call(arguments, 1), 
        fToBind = this, 
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply((this instanceof fNOP && oThis) ? this: oThis,
                               aArgs.concat(Array.prototype.slice.call(arguments)));
        };
 
    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();
 
    return fBound;
  };
}

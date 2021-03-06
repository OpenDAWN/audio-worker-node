(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.AudioWorkerNode = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
"use strict";

/**
 *  AudioParamImpl
 *  +-----------------+
 *  | GainNode(inlet) |
 *  | gain: value     |
 *  +-----------------+
 *    |
 *  +-----------------------------+
 *  | ScriptProcessorNode(outlet) |
 *  +-----------------------------+
 */
function AudioParamImpl(audioContext, defaultValue, bufferSize) {
  this.inlet = audioContext.createGain();
  this.outlet = audioContext.createScriptProcessor(bufferSize, 1, 1);

  this.param = this.inlet.gain;
  this.param.value = defaultValue;
  this.array = new Float32Array(bufferSize);

  this.inlet.connect(this.outlet);

  var array = this.array;
  this.outlet.onaudioprocess = function(e) {
    array.set(e.inputBuffer.getChannelData(0));
  };
}

AudioParamImpl.prototype.connect = function(destination) {
  global.AudioNode.prototype.connect.call(this.outlet, destination);
};

AudioParamImpl.prototype.disconnect = function() {
  global.AudioNode.prototype.disconnect.call(this.outlet);
};

module.exports = AudioParamImpl;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(require,module,exports){
"use strict";

var AudioParamImpl = require("./audio-param-impl");

function AudioParamNode(audioContext, defaultValue, bufferSize) {
  var impl = new AudioParamImpl(audioContext, defaultValue, bufferSize);

  Object.defineProperties(impl.inlet, {
    param: {
      value: impl.param,
      enumerable: true
    },
    array: {
      value: impl.array,
      enumerable: true
    },
    connect: {
      value: function(destination) {
        impl.connect(destination);
      }
    },
    disconnect: {
      value: function() {
        impl.disconnect();
      }
    }
  });

  return impl.inlet;
}

module.exports = AudioParamNode;

},{"./audio-param-impl":1}],3:[function(require,module,exports){
"use strict";

var AudioProcessBuilder = {};

AudioProcessBuilder.build = function(opts) {
  var numOfInput = opts.numOfInput;
  var numOfOutput = opts.numOfOutput;

  if (numOfInput === 1 && numOfOutput === 1) {
    return build_onaudioprocess_1(opts);
  }
  if (numOfInput === 2 && numOfOutput === 2) {
    return build_onaudioprocess_2(opts);
  }
  return build_onaudioprocess_n(opts);
};

function build_onaudioprocess_1(opts) {
  var func = opts.func;
  var scope = opts.scope;
  var parameters = opts.parameters;

  return function(e) {
    e.inputBuffers = [
      e.inputBuffer.getChannelData(0)
    ];
    e.outputBuffers = [
      e.outputBuffer.getChannelData(0)
    ];
    e.parameters = parameters;

    func.call(scope, e);
  };
}

function build_onaudioprocess_2(opts) {
  var func = opts.func;
  var scope = opts.scope;
  var parameters = opts.parameters;

  return function(e) {
    var inp = e.inputBuffer;
    var out = e.outputBuffer;
    e.inputBuffers = [
      inp.getChannelData(0),
      inp.getChannelData(1)
    ];
    e.outputBuffers = [
      out.getChannelData(0),
      out.getChannelData(1)
    ];
    e.parameters = parameters;

    func.call(scope, e);
  };
}

function build_onaudioprocess_n(opts) {
  var func = opts.func;
  var scope = opts.scope;
  var numOfInput = opts.numOfInput;
  var numOfOutput = opts.numOfOutput;
  var parameters = opts.parameters;

  return function(e) {
    var inputBuffers = new Array(numOfInput);
    var outputBuffers = new Array(numOfOutput);
    var i;

    for (i = 0; i < numOfInput; i++) {
      inputBuffers[i] = e.inputBuffer.getChannelData(i);
    }
    for (i = 0; i < numOfOutput; i++) {
      outputBuffers[i] = e.outputBuffer.getChannelData(i);
    }

    e.inputBuffers = inputBuffers;
    e.outputBuffers = outputBuffers;
    e.parameters = parameters;

    func.call(scope, e);
  };
}

module.exports = AudioProcessBuilder;

},{}],4:[function(require,module,exports){
"use strict";

var WORKER_ATTRS = [
  "onaudioprocess",
  "sampleRate",
  "self",
  "onmessage",
  "postMessage",
  "close",
  "importScripts",
];

var AudioWorkerCode = {};

AudioWorkerCode.tokens = function(src) {
  var pos = 0;
  var tokens = [];

  function eat(re) {
    while (pos < src.length) {
      var ch = src.charAt(pos);
      if (!re.test(ch)) {
        break;
      }
      pos += 1;
    }
  }

  function eatString(quote) {
    while (pos < src.length) {
      var ch = src.charAt(pos++);
      if (ch === quote) {
        return;
      }
      if (ch === "\\") {
        pos += 1;
      }
    }
    // istanbul ignore next
    throw new SyntaxError("Unexpected token ILLEGAL");
  }

  function eatMultiLineComment() {
    pos += 1;
    while (pos < src.length) {
      var ch = src.charAt(pos++);
      if (ch === "*" && src.charAt(pos) === "/") {
        pos += 1;
        return;
      }
    }
    // istanbul ignore next
    throw new SyntaxError("Unexpected token ILLEGAL");
  }

  while (pos < src.length) {
    var begin = pos;
    var ch = src.charAt(pos++);

    if (/\s/.test(ch)) {
      eat(/\s/);
    } else if (/[a-zA-Z_$]/.test(ch)) {
      eat(/[\w$]/);
    } else if (/\d/.test(ch)) {
      eat(/[.\d]/);
    } else if (/['"]/.test(ch)) {
      eatString(ch);
    } else if (ch === "/") {
      ch = src.charAt(pos);
      if (ch === "/") {
        eat(/[^\n]/);
      } else if (ch === "*") {
        eatMultiLineComment();
      }
    }

    tokens.push(src.slice(begin, pos));
  }

  return tokens;
};

AudioWorkerCode.filter = function(src) {
  var tokens = AudioWorkerCode.tokens(src);

  function prevToken(index) {
    while (index--) {
      if (/[\S/]/.test(tokens[index].charAt(0))) {
        return tokens[index];
      }
    }
    return "";
  }

  WORKER_ATTRS.forEach(function(attr) {
    var pos = 0;
    var index;

    while ((index = tokens.indexOf(attr, pos)) !== -1) {
      if (prevToken(index) !== ".") {
        tokens[index] = "__self." + tokens[index];
      }
      pos = index + 1;
    }
  });

  return tokens.join("");
};

AudioWorkerCode.compile = function(src) {
  var code = [
    "(function(__self) { 'use strict';",
    AudioWorkerCode.filter(src),
    "})"
  ].join("\n");
  return eval.call(null, code);
};

module.exports = AudioWorkerCode;

},{}],5:[function(require,module,exports){
"use strict";

function AudioWorkerGlobalScope(node) {
  var onaudioprocess = null;

  Object.defineProperties(this, {
    self: {
      value: this,
      enumerable: true
    },
    sampleRate: {
      value: node.sampleRate,
      enumerable: true
    },
    onaudioprocess: {
      set: function(value) {
        if (typeof value !== "function") {
          value = null;
        }
        node.onaudioprocess(value);
        onaudioprocess = value;
      },
      get: function() {
        return onaudioprocess;
      },
      enumerable: true
    },
    onmessage: {
      set: function(value) {
        if (typeof value === "function") {
          value = value.bind(this);
        } else {
          value = null;
        }
        node.port2.onmessage = value;
      },
      get: function() {
        return node.port2.onmessage;
      },
      enumerable: true
    },
    postMessage: {
      value: function() {
        node.port2.postMessage.apply(node.port2, arguments);
      }
    },
    close: {
      value: function() {
        node.close.apply(node, arguments);
      }
    },
    importScripts: {
      value: function() {
        node.importScripts.apply(node, arguments);
      }
    }
  });
}

module.exports = AudioWorkerGlobalScope;

},{}],6:[function(require,module,exports){
(function (global){
"use strict";

var AudioParamNode = require("./audio-param-node");
var AudioWorkerGlobalScope = require("./audio-worker-global-scope");
var AudioProcessBuilder = require("./audio-process-builder");
var ScriptLoader = require("./script-loader");
var AudioWorkerCode = require("./audio-worker-code");
var MessageChannel = require("./message-channel");

var BUFFER_SIZE = 1024;

function AudioWorkerNodeImpl(audioContext, scriptURL, numOfInput, numOfOutput) {
  var ch = new MessageChannel();

  this.audioContext = audioContext;
  this.sampleRate = audioContext.sampleRate;
  this.inlet = audioContext.createScriptProcessor(BUFFER_SIZE, numOfInput, numOfOutput);
  this.outlet = this.inlet;
  this.port1 = ch.port1;
  this.port2 = ch.port2;
  this.scope = new AudioWorkerGlobalScope(this);

  this._numOfInput = numOfInput;
  this._numOfOutput = numOfOutput;
  this._isConnected = false;
  this._isTerminated = false;
  this._silencer = null;
  this._dc1buffer = null;
  this._dc1 = null;
  this._params = {};
  this._parameters = {};

  var scope = this.scope;
  ScriptLoader.load(scriptURL, function(script) {
    try {
      AudioWorkerCode.compile(script).call(scope, scope);
    } catch (e) {}
  });
}

AudioWorkerNodeImpl.prototype.connect = function(destination) {
  var audioContext = this.audioContext;

  if (!this._isConnected) {
    this._dc1buffer = audioContext.createBuffer(1, 2, audioContext.sampleRate);
    this._dc1buffer.getChannelData(0).set([ 1, 1 ]);

    this._dc1 = audioContext.createBufferSource();
    this._dc1.buffer = this._dc1buffer;
    this._dc1.loop = true;
    this._dc1.start(audioContext.currentTime);

    Object.keys(this._params).forEach(function(name) {
      this._dc1.connect(this._params[name]);
    }, this);

    this._isConnected = true;
  }

  global.AudioNode.prototype.connect.call(this.inlet, destination);
};

AudioWorkerNodeImpl.prototype.disconnect = function() {
  var audioContext = this.audioContext;

  if (this._isConnected) {
    this._dc1.stop(audioContext.currentTime);
    this._dc1.disconnect();

    this._dc1buffer = null;
    this._dc1 = null;
    this._isConnected = false;
  }

  global.AudioNode.prototype.disconnect.call(this.outlet);
};

AudioWorkerNodeImpl.prototype.terminate = function() {
  if (!this._isTerminated) {
    this.inlet.onaudioprocess = null;
    this.port1.close();
    this.port2.close();
    this._isTerminated = true;
  }
};

AudioWorkerNodeImpl.prototype.addParameter = function(name, defaultValue) {
  var audioContext = this.audioContext;

  if (this._params.hasOwnProperty(name)) {
    return this._params[name].param;
  }

  if (this._silencer === null) {
    this._silencer = audioContext.createGain();
    this._silencer.gain.value = 0;
    this._silencer.connect(this.outlet);
  }

  var paramNode = new AudioParamNode(audioContext, defaultValue, BUFFER_SIZE);

  paramNode.connect(this._silencer);

  if (this._isConnected) {
    this._dc1.connect(paramNode);
  }

  this._params[name] = paramNode;
  this._parameters[name] = paramNode.array;

  return paramNode.param;
};

AudioWorkerNodeImpl.prototype.getParameter = function(name) {
  return this._params[name] && this._params[name].param;
};

AudioWorkerNodeImpl.prototype.removeParameter = function(name) {
  if (!this._params.hasOwnProperty(name)) {
    return;
  }

  this._params[name].disconnect();

  delete this._params[name];
  delete this._parameters[name];

  if (Object.keys(this._params).length === 0) {
    this._silencer.disconnect();
    this._silencer = null;
  }
};

AudioWorkerNodeImpl.prototype.onaudioprocess = function(func) {
  if (this._isTerminated || typeof func !== "function") {
    this.inlet.onaudioprocess = null;
  } else {
    this.inlet.onaudioprocess = AudioProcessBuilder.build({
      func: func,
      scope: this.scope,
      numOfInput: this._numOfInput,
      numOfOutput: this._numOfOutput,
      parameters: this._parameters,
    });
  }
};

AudioWorkerNodeImpl.prototype.close = function() {
  this.terminate();
};

AudioWorkerNodeImpl.prototype.importScripts = function() {
  throw new Error("Not Supported: importScripts");
};

module.exports = AudioWorkerNodeImpl;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./audio-param-node":2,"./audio-process-builder":3,"./audio-worker-code":4,"./audio-worker-global-scope":5,"./message-channel":8,"./script-loader":9}],7:[function(require,module,exports){
"use strict";

var utils = require("./utils");
var AudioWorkerImpl = require("./audio-worker-impl");

function AudioWorkerNode(audioContext, scriptURL, numberOfInputChannels, numberOfOutputChannels) {
  numberOfInputChannels = utils.defaults(numberOfInputChannels, 2);
  numberOfOutputChannels = utils.defaults(numberOfOutputChannels, 2);

  var impl = new AudioWorkerImpl(audioContext, scriptURL, numberOfInputChannels, numberOfOutputChannels);

  Object.defineProperties(impl.inlet, {
    onmessage: {
      set: function(value) {
        if (typeof value !== "function") {
          value = null;
        }
        impl.port1.onmessage = value;
      },
      get: function() {
        return impl.port1.onmessage;
      },
      enumerable: true
    },
    connect: {
      value: function(destination) {
        return impl.connect(destination);
      }
    },
    disconnect: {
      value: function() {
        return impl.disconnect();
      }
    },
    postMessage: {
      value: function() {
        return impl.port1.postMessage.apply(impl.port1, arguments);
      }
    },
    addParameter: {
      value: function(name, defaultValue) {
        defaultValue = utils.defaults(defaultValue, 0);
        if (!Object.getOwnPropertyDescriptor(impl.inlet, name)) {
          Object.defineProperty(impl.inlet, name, {
            get: function() {
              return impl.getParameter(name);
            },
            configurable: true,
            enumerable: true
          });
        }
        return impl.addParameter(name, defaultValue);
      }
    },
    removeParameter: {
      value: function(name) {
        if (Object.getOwnPropertyDescriptor(impl.inlet, name)) {
          delete impl.inlet[name];
        }
        return impl.removeParameter(name);
      }
    },
    terminate: {
      value: function() {
        return impl.terminate();
      }
    }
  });

  return impl.inlet;
}
module.exports = AudioWorkerNode;

},{"./audio-worker-impl":6,"./utils":10}],8:[function(require,module,exports){
(function (global){
"use strict";

function MessageChannelShim() {
  this.port1 = new MessagePort();
  this.port2 = new MessagePort();
  this.port1._target = this.port2;
  this.port2._target = this.port1;
}

function MessagePort() {
  this._onmessage = null;
  this._target = null;
  this._isClosed = false;
  this._pendings = [];

  Object.defineProperties(this, {
    onmessage: {
      set: function(value) {
        var _this = this;
        this._onmessage = value;
        if (this._pendings.length) {
          setTimeout(function() {
            _this._pendings.splice(0).forEach(function(e) {
              _this._onmessage(e);
            });
          }, 0);
        }
      },
      get: function() {
        return this._onmessage;
      },
      enumerable: true
    }
  });
}

MessagePort.prototype.postMessage = function(message) {
  var target = this._target;
  if (!this._isClosed) {
    var e = {
      type: "message",
      data: message
    };
    if (typeof target._onmessage === "function") {
      setTimeout(function() {
        target._onmessage(e);
      }, 0);
    } else {
      target._pendings.push(e);
    }
  }
};

MessagePort.prototype.close = function() {
  this._isClosed = true;
  this._pendings.splice(0);
};

module.exports = global.MessageChannel || MessageChannelShim;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],9:[function(require,module,exports){
(function (global){
"use strict";

var ScriptLoader = {};

ScriptLoader.load = function(scriptURL, callback) {
  var xhr = new global.XMLHttpRequest();
  xhr.open("GET", scriptURL);
  xhr.onload = function() {
    if (xhr.status === 200) {
      callback(xhr.response);
    }
  };
  xhr.send();
};

module.exports = ScriptLoader;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],10:[function(require,module,exports){
"use strict";

function defaults(value, defaultValue) {
  return value !== undefined ? value : defaultValue;
}

module.exports = {
  defaults: defaults
};

},{}]},{},[7])(7)
});
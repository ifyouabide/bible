export function $id(id) {
  return document.getElementById(id);
}

export function exportDebug(name, value) {
  setIfUnset(window, 'dbg', {})[name] = value;
}

export function setIfUnset(o, key, initialValue) {
  if (!(key in o)) {
    o[key] = initialValue;
  }
  if (o[key] instanceof Object) {
    return o[key];
  }
  return o;
}

let g_debug = new URLSearchParams(window.location.search).has('debug');

export function setDebugEnabled(enabled) {
  g_debug = enabled;
}

export function ifDebug(fn) {
  if (g_debug) fn();
}
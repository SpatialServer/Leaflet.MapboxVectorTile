(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/index.js":[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","ieee754":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","is-array":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js":[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js":[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js":[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/leaflet/dist/leaflet-src.js":[function(require,module,exports){
/*
 Leaflet, a JavaScript library for mobile-friendly interactive maps. http://leafletjs.com
 (c) 2010-2013, Vladimir Agafonkin
 (c) 2010-2011, CloudMade
*/
(function (window, document, undefined) {
var oldL = window.L,
    L = {};

L.version = '0.7.2';

// define Leaflet for Node module pattern loaders, including Browserify
if (typeof module === 'object' && typeof module.exports === 'object') {
	module.exports = L;

// define Leaflet as an AMD module
} else if (typeof define === 'function' && define.amd) {
	define(L);
}

// define Leaflet as a global L variable, saving the original L to restore later if needed

L.noConflict = function () {
	window.L = oldL;
	return this;
};

window.L = L;


/*
 * L.Util contains various utility functions used throughout Leaflet code.
 */

L.Util = {
	extend: function (dest) { // (Object[, Object, ...]) ->
		var sources = Array.prototype.slice.call(arguments, 1),
		    i, j, len, src;

		for (j = 0, len = sources.length; j < len; j++) {
			src = sources[j] || {};
			for (i in src) {
				if (src.hasOwnProperty(i)) {
					dest[i] = src[i];
				}
			}
		}
		return dest;
	},

	bind: function (fn, obj) { // (Function, Object) -> Function
		var args = arguments.length > 2 ? Array.prototype.slice.call(arguments, 2) : null;
		return function () {
			return fn.apply(obj, args || arguments);
		};
	},

	stamp: (function () {
		var lastId = 0,
		    key = '_leaflet_id';
		return function (obj) {
			obj[key] = obj[key] || ++lastId;
			return obj[key];
		};
	}()),

	invokeEach: function (obj, method, context) {
		var i, args;

		if (typeof obj === 'object') {
			args = Array.prototype.slice.call(arguments, 3);

			for (i in obj) {
				method.apply(context, [i, obj[i]].concat(args));
			}
			return true;
		}

		return false;
	},

	limitExecByInterval: function (fn, time, context) {
		var lock, execOnUnlock;

		return function wrapperFn() {
			var args = arguments;

			if (lock) {
				execOnUnlock = true;
				return;
			}

			lock = true;

			setTimeout(function () {
				lock = false;

				if (execOnUnlock) {
					wrapperFn.apply(context, args);
					execOnUnlock = false;
				}
			}, time);

			fn.apply(context, args);
		};
	},

	falseFn: function () {
		return false;
	},

	formatNum: function (num, digits) {
		var pow = Math.pow(10, digits || 5);
		return Math.round(num * pow) / pow;
	},

	trim: function (str) {
		return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
	},

	splitWords: function (str) {
		return L.Util.trim(str).split(/\s+/);
	},

	setOptions: function (obj, options) {
		obj.options = L.extend({}, obj.options, options);
		return obj.options;
	},

	getParamString: function (obj, existingUrl, uppercase) {
		var params = [];
		for (var i in obj) {
			params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' + encodeURIComponent(obj[i]));
		}
		return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') + params.join('&');
	},
	template: function (str, data) {
		return str.replace(/\{ *([\w_]+) *\}/g, function (str, key) {
			var value = data[key];
			if (value === undefined) {
				throw new Error('No value provided for variable ' + str);
			} else if (typeof value === 'function') {
				value = value(data);
			}
			return value;
		});
	},

	isArray: Array.isArray || function (obj) {
		return (Object.prototype.toString.call(obj) === '[object Array]');
	},

	emptyImageUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
};

(function () {

	// inspired by http://paulirish.com/2011/requestanimationframe-for-smart-animating/

	function getPrefixed(name) {
		var i, fn,
		    prefixes = ['webkit', 'moz', 'o', 'ms'];

		for (i = 0; i < prefixes.length && !fn; i++) {
			fn = window[prefixes[i] + name];
		}

		return fn;
	}

	var lastTime = 0;

	function timeoutDefer(fn) {
		var time = +new Date(),
		    timeToCall = Math.max(0, 16 - (time - lastTime));

		lastTime = time + timeToCall;
		return window.setTimeout(fn, timeToCall);
	}

	var requestFn = window.requestAnimationFrame ||
	        getPrefixed('RequestAnimationFrame') || timeoutDefer;

	var cancelFn = window.cancelAnimationFrame ||
	        getPrefixed('CancelAnimationFrame') ||
	        getPrefixed('CancelRequestAnimationFrame') ||
	        function (id) { window.clearTimeout(id); };


	L.Util.requestAnimFrame = function (fn, context, immediate, element) {
		fn = L.bind(fn, context);

		if (immediate && requestFn === timeoutDefer) {
			fn();
		} else {
			return requestFn.call(window, fn, element);
		}
	};

	L.Util.cancelAnimFrame = function (id) {
		if (id) {
			cancelFn.call(window, id);
		}
	};

}());

// shortcuts for most used utility functions
L.extend = L.Util.extend;
L.bind = L.Util.bind;
L.stamp = L.Util.stamp;
L.setOptions = L.Util.setOptions;


/*
 * L.Class powers the OOP facilities of the library.
 * Thanks to John Resig and Dean Edwards for inspiration!
 */

L.Class = function () {};

L.Class.extend = function (props) {

	// extended class with the new prototype
	var NewClass = function () {

		// call the constructor
		if (this.initialize) {
			this.initialize.apply(this, arguments);
		}

		// call all constructor hooks
		if (this._initHooks) {
			this.callInitHooks();
		}
	};

	// instantiate class without calling constructor
	var F = function () {};
	F.prototype = this.prototype;

	var proto = new F();
	proto.constructor = NewClass;

	NewClass.prototype = proto;

	//inherit parent's statics
	for (var i in this) {
		if (this.hasOwnProperty(i) && i !== 'prototype') {
			NewClass[i] = this[i];
		}
	}

	// mix static properties into the class
	if (props.statics) {
		L.extend(NewClass, props.statics);
		delete props.statics;
	}

	// mix includes into the prototype
	if (props.includes) {
		L.Util.extend.apply(null, [proto].concat(props.includes));
		delete props.includes;
	}

	// merge options
	if (props.options && proto.options) {
		props.options = L.extend({}, proto.options, props.options);
	}

	// mix given properties into the prototype
	L.extend(proto, props);

	proto._initHooks = [];

	var parent = this;
	// jshint camelcase: false
	NewClass.__super__ = parent.prototype;

	// add method for calling all hooks
	proto.callInitHooks = function () {

		if (this._initHooksCalled) { return; }

		if (parent.prototype.callInitHooks) {
			parent.prototype.callInitHooks.call(this);
		}

		this._initHooksCalled = true;

		for (var i = 0, len = proto._initHooks.length; i < len; i++) {
			proto._initHooks[i].call(this);
		}
	};

	return NewClass;
};


// method for adding properties to prototype
L.Class.include = function (props) {
	L.extend(this.prototype, props);
};

// merge new default options to the Class
L.Class.mergeOptions = function (options) {
	L.extend(this.prototype.options, options);
};

// add a constructor hook
L.Class.addInitHook = function (fn) { // (Function) || (String, args...)
	var args = Array.prototype.slice.call(arguments, 1);

	var init = typeof fn === 'function' ? fn : function () {
		this[fn].apply(this, args);
	};

	this.prototype._initHooks = this.prototype._initHooks || [];
	this.prototype._initHooks.push(init);
};


/*
 * L.Mixin.Events is used to add custom events functionality to Leaflet classes.
 */

var eventsKey = '_leaflet_events';

L.Mixin = {};

L.Mixin.Events = {

	addEventListener: function (types, fn, context) { // (String, Function[, Object]) or (Object[, Object])

		// types can be a map of types/handlers
		if (L.Util.invokeEach(types, this.addEventListener, this, fn, context)) { return this; }

		var events = this[eventsKey] = this[eventsKey] || {},
		    contextId = context && context !== this && L.stamp(context),
		    i, len, event, type, indexKey, indexLenKey, typeIndex;

		// types can be a string of space-separated words
		types = L.Util.splitWords(types);

		for (i = 0, len = types.length; i < len; i++) {
			event = {
				action: fn,
				context: context || this
			};
			type = types[i];

			if (contextId) {
				// store listeners of a particular context in a separate hash (if it has an id)
				// gives a major performance boost when removing thousands of map layers

				indexKey = type + '_idx';
				indexLenKey = indexKey + '_len';

				typeIndex = events[indexKey] = events[indexKey] || {};

				if (!typeIndex[contextId]) {
					typeIndex[contextId] = [];

					// keep track of the number of keys in the index to quickly check if it's empty
					events[indexLenKey] = (events[indexLenKey] || 0) + 1;
				}

				typeIndex[contextId].push(event);


			} else {
				events[type] = events[type] || [];
				events[type].push(event);
			}
		}

		return this;
	},

	hasEventListeners: function (type) { // (String) -> Boolean
		var events = this[eventsKey];
		return !!events && ((type in events && events[type].length > 0) ||
		                    (type + '_idx' in events && events[type + '_idx_len'] > 0));
	},

	removeEventListener: function (types, fn, context) { // ([String, Function, Object]) or (Object[, Object])

		if (!this[eventsKey]) {
			return this;
		}

		if (!types) {
			return this.clearAllEventListeners();
		}

		if (L.Util.invokeEach(types, this.removeEventListener, this, fn, context)) { return this; }

		var events = this[eventsKey],
		    contextId = context && context !== this && L.stamp(context),
		    i, len, type, listeners, j, indexKey, indexLenKey, typeIndex, removed;

		types = L.Util.splitWords(types);

		for (i = 0, len = types.length; i < len; i++) {
			type = types[i];
			indexKey = type + '_idx';
			indexLenKey = indexKey + '_len';

			typeIndex = events[indexKey];

			if (!fn) {
				// clear all listeners for a type if function isn't specified
				delete events[type];
				delete events[indexKey];
				delete events[indexLenKey];

			} else {
				listeners = contextId && typeIndex ? typeIndex[contextId] : events[type];

				if (listeners) {
					for (j = listeners.length - 1; j >= 0; j--) {
						if ((listeners[j].action === fn) && (!context || (listeners[j].context === context))) {
							removed = listeners.splice(j, 1);
							// set the old action to a no-op, because it is possible
							// that the listener is being iterated over as part of a dispatch
							removed[0].action = L.Util.falseFn;
						}
					}

					if (context && typeIndex && (listeners.length === 0)) {
						delete typeIndex[contextId];
						events[indexLenKey]--;
					}
				}
			}
		}

		return this;
	},

	clearAllEventListeners: function () {
		delete this[eventsKey];
		return this;
	},

	fireEvent: function (type, data) { // (String[, Object])
		if (!this.hasEventListeners(type)) {
			return this;
		}

		var event = L.Util.extend({}, data, { type: type, target: this });

		var events = this[eventsKey],
		    listeners, i, len, typeIndex, contextId;

		if (events[type]) {
			// make sure adding/removing listeners inside other listeners won't cause infinite loop
			listeners = events[type].slice();

			for (i = 0, len = listeners.length; i < len; i++) {
				listeners[i].action.call(listeners[i].context, event);
			}
		}

		// fire event for the context-indexed listeners as well
		typeIndex = events[type + '_idx'];

		for (contextId in typeIndex) {
			listeners = typeIndex[contextId].slice();

			if (listeners) {
				for (i = 0, len = listeners.length; i < len; i++) {
					listeners[i].action.call(listeners[i].context, event);
				}
			}
		}

		return this;
	},

	addOneTimeEventListener: function (types, fn, context) {

		if (L.Util.invokeEach(types, this.addOneTimeEventListener, this, fn, context)) { return this; }

		var handler = L.bind(function () {
			this
			    .removeEventListener(types, fn, context)
			    .removeEventListener(types, handler, context);
		}, this);

		return this
		    .addEventListener(types, fn, context)
		    .addEventListener(types, handler, context);
	}
};

L.Mixin.Events.on = L.Mixin.Events.addEventListener;
L.Mixin.Events.off = L.Mixin.Events.removeEventListener;
L.Mixin.Events.once = L.Mixin.Events.addOneTimeEventListener;
L.Mixin.Events.fire = L.Mixin.Events.fireEvent;


/*
 * L.Browser handles different browser and feature detections for internal Leaflet use.
 */

(function () {

	var ie = 'ActiveXObject' in window,
		ielt9 = ie && !document.addEventListener,

	    // terrible browser detection to work around Safari / iOS / Android browser bugs
	    ua = navigator.userAgent.toLowerCase(),
	    webkit = ua.indexOf('webkit') !== -1,
	    chrome = ua.indexOf('chrome') !== -1,
	    phantomjs = ua.indexOf('phantom') !== -1,
	    android = ua.indexOf('android') !== -1,
	    android23 = ua.search('android [23]') !== -1,
		gecko = ua.indexOf('gecko') !== -1,

	    mobile = typeof orientation !== undefined + '',
	    msPointer = window.navigator && window.navigator.msPointerEnabled &&
	              window.navigator.msMaxTouchPoints && !window.PointerEvent,
		pointer = (window.PointerEvent && window.navigator.pointerEnabled && window.navigator.maxTouchPoints) ||
				  msPointer,
	    retina = ('devicePixelRatio' in window && window.devicePixelRatio > 1) ||
	             ('matchMedia' in window && window.matchMedia('(min-resolution:144dpi)') &&
	              window.matchMedia('(min-resolution:144dpi)').matches),

	    doc = document.documentElement,
	    ie3d = ie && ('transition' in doc.style),
	    webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23,
	    gecko3d = 'MozPerspective' in doc.style,
	    opera3d = 'OTransition' in doc.style,
	    any3d = !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d || opera3d) && !phantomjs;


	// PhantomJS has 'ontouchstart' in document.documentElement, but doesn't actually support touch.
	// https://github.com/Leaflet/Leaflet/pull/1434#issuecomment-13843151

	var touch = !window.L_NO_TOUCH && !phantomjs && (function () {

		var startName = 'ontouchstart';

		// IE10+ (We simulate these into touch* events in L.DomEvent and L.DomEvent.Pointer) or WebKit, etc.
		if (pointer || (startName in doc)) {
			return true;
		}

		// Firefox/Gecko
		var div = document.createElement('div'),
		    supported = false;

		if (!div.setAttribute) {
			return false;
		}
		div.setAttribute(startName, 'return;');

		if (typeof div[startName] === 'function') {
			supported = true;
		}

		div.removeAttribute(startName);
		div = null;

		return supported;
	}());


	L.Browser = {
		ie: ie,
		ielt9: ielt9,
		webkit: webkit,
		gecko: gecko && !webkit && !window.opera && !ie,

		android: android,
		android23: android23,

		chrome: chrome,

		ie3d: ie3d,
		webkit3d: webkit3d,
		gecko3d: gecko3d,
		opera3d: opera3d,
		any3d: any3d,

		mobile: mobile,
		mobileWebkit: mobile && webkit,
		mobileWebkit3d: mobile && webkit3d,
		mobileOpera: mobile && window.opera,

		touch: touch,
		msPointer: msPointer,
		pointer: pointer,

		retina: retina
	};

}());


/*
 * L.Point represents a point with x and y coordinates.
 */

L.Point = function (/*Number*/ x, /*Number*/ y, /*Boolean*/ round) {
	this.x = (round ? Math.round(x) : x);
	this.y = (round ? Math.round(y) : y);
};

L.Point.prototype = {

	clone: function () {
		return new L.Point(this.x, this.y);
	},

	// non-destructive, returns a new point
	add: function (point) {
		return this.clone()._add(L.point(point));
	},

	// destructive, used directly for performance in situations where it's safe to modify existing point
	_add: function (point) {
		this.x += point.x;
		this.y += point.y;
		return this;
	},

	subtract: function (point) {
		return this.clone()._subtract(L.point(point));
	},

	_subtract: function (point) {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	},

	divideBy: function (num) {
		return this.clone()._divideBy(num);
	},

	_divideBy: function (num) {
		this.x /= num;
		this.y /= num;
		return this;
	},

	multiplyBy: function (num) {
		return this.clone()._multiplyBy(num);
	},

	_multiplyBy: function (num) {
		this.x *= num;
		this.y *= num;
		return this;
	},

	round: function () {
		return this.clone()._round();
	},

	_round: function () {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	},

	floor: function () {
		return this.clone()._floor();
	},

	_floor: function () {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	},

	distanceTo: function (point) {
		point = L.point(point);

		var x = point.x - this.x,
		    y = point.y - this.y;

		return Math.sqrt(x * x + y * y);
	},

	equals: function (point) {
		point = L.point(point);

		return point.x === this.x &&
		       point.y === this.y;
	},

	contains: function (point) {
		point = L.point(point);

		return Math.abs(point.x) <= Math.abs(this.x) &&
		       Math.abs(point.y) <= Math.abs(this.y);
	},

	toString: function () {
		return 'Point(' +
		        L.Util.formatNum(this.x) + ', ' +
		        L.Util.formatNum(this.y) + ')';
	}
};

L.point = function (x, y, round) {
	if (x instanceof L.Point) {
		return x;
	}
	if (L.Util.isArray(x)) {
		return new L.Point(x[0], x[1]);
	}
	if (x === undefined || x === null) {
		return x;
	}
	return new L.Point(x, y, round);
};


/*
 * L.Bounds represents a rectangular area on the screen in pixel coordinates.
 */

L.Bounds = function (a, b) { //(Point, Point) or Point[]
	if (!a) { return; }

	var points = b ? [a, b] : a;

	for (var i = 0, len = points.length; i < len; i++) {
		this.extend(points[i]);
	}
};

L.Bounds.prototype = {
	// extend the bounds to contain the given point
	extend: function (point) { // (Point)
		point = L.point(point);

		if (!this.min && !this.max) {
			this.min = point.clone();
			this.max = point.clone();
		} else {
			this.min.x = Math.min(point.x, this.min.x);
			this.max.x = Math.max(point.x, this.max.x);
			this.min.y = Math.min(point.y, this.min.y);
			this.max.y = Math.max(point.y, this.max.y);
		}
		return this;
	},

	getCenter: function (round) { // (Boolean) -> Point
		return new L.Point(
		        (this.min.x + this.max.x) / 2,
		        (this.min.y + this.max.y) / 2, round);
	},

	getBottomLeft: function () { // -> Point
		return new L.Point(this.min.x, this.max.y);
	},

	getTopRight: function () { // -> Point
		return new L.Point(this.max.x, this.min.y);
	},

	getSize: function () {
		return this.max.subtract(this.min);
	},

	contains: function (obj) { // (Bounds) or (Point) -> Boolean
		var min, max;

		if (typeof obj[0] === 'number' || obj instanceof L.Point) {
			obj = L.point(obj);
		} else {
			obj = L.bounds(obj);
		}

		if (obj instanceof L.Bounds) {
			min = obj.min;
			max = obj.max;
		} else {
			min = max = obj;
		}

		return (min.x >= this.min.x) &&
		       (max.x <= this.max.x) &&
		       (min.y >= this.min.y) &&
		       (max.y <= this.max.y);
	},

	intersects: function (bounds) { // (Bounds) -> Boolean
		bounds = L.bounds(bounds);

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
		    yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	},

	isValid: function () {
		return !!(this.min && this.max);
	}
};

L.bounds = function (a, b) { // (Bounds) or (Point, Point) or (Point[])
	if (!a || a instanceof L.Bounds) {
		return a;
	}
	return new L.Bounds(a, b);
};


/*
 * L.Transformation is an utility class to perform simple point transformations through a 2d-matrix.
 */

L.Transformation = function (a, b, c, d) {
	this._a = a;
	this._b = b;
	this._c = c;
	this._d = d;
};

L.Transformation.prototype = {
	transform: function (point, scale) { // (Point, Number) -> Point
		return this._transform(point.clone(), scale);
	},

	// destructive transform (faster)
	_transform: function (point, scale) {
		scale = scale || 1;
		point.x = scale * (this._a * point.x + this._b);
		point.y = scale * (this._c * point.y + this._d);
		return point;
	},

	untransform: function (point, scale) {
		scale = scale || 1;
		return new L.Point(
		        (point.x / scale - this._b) / this._a,
		        (point.y / scale - this._d) / this._c);
	}
};


/*
 * L.DomUtil contains various utility functions for working with DOM.
 */

L.DomUtil = {
	get: function (id) {
		return (typeof id === 'string' ? document.getElementById(id) : id);
	},

	getStyle: function (el, style) {

		var value = el.style[style];

		if (!value && el.currentStyle) {
			value = el.currentStyle[style];
		}

		if ((!value || value === 'auto') && document.defaultView) {
			var css = document.defaultView.getComputedStyle(el, null);
			value = css ? css[style] : null;
		}

		return value === 'auto' ? null : value;
	},

	getViewportOffset: function (element) {

		var top = 0,
		    left = 0,
		    el = element,
		    docBody = document.body,
		    docEl = document.documentElement,
		    pos;

		do {
			top  += el.offsetTop  || 0;
			left += el.offsetLeft || 0;

			//add borders
			top += parseInt(L.DomUtil.getStyle(el, 'borderTopWidth'), 10) || 0;
			left += parseInt(L.DomUtil.getStyle(el, 'borderLeftWidth'), 10) || 0;

			pos = L.DomUtil.getStyle(el, 'position');

			if (el.offsetParent === docBody && pos === 'absolute') { break; }

			if (pos === 'fixed') {
				top  += docBody.scrollTop  || docEl.scrollTop  || 0;
				left += docBody.scrollLeft || docEl.scrollLeft || 0;
				break;
			}

			if (pos === 'relative' && !el.offsetLeft) {
				var width = L.DomUtil.getStyle(el, 'width'),
				    maxWidth = L.DomUtil.getStyle(el, 'max-width'),
				    r = el.getBoundingClientRect();

				if (width !== 'none' || maxWidth !== 'none') {
					left += r.left + el.clientLeft;
				}

				//calculate full y offset since we're breaking out of the loop
				top += r.top + (docBody.scrollTop  || docEl.scrollTop  || 0);

				break;
			}

			el = el.offsetParent;

		} while (el);

		el = element;

		do {
			if (el === docBody) { break; }

			top  -= el.scrollTop  || 0;
			left -= el.scrollLeft || 0;

			el = el.parentNode;
		} while (el);

		return new L.Point(left, top);
	},

	documentIsLtr: function () {
		if (!L.DomUtil._docIsLtrCached) {
			L.DomUtil._docIsLtrCached = true;
			L.DomUtil._docIsLtr = L.DomUtil.getStyle(document.body, 'direction') === 'ltr';
		}
		return L.DomUtil._docIsLtr;
	},

	create: function (tagName, className, container) {

		var el = document.createElement(tagName);
		el.className = className;

		if (container) {
			container.appendChild(el);
		}

		return el;
	},

	hasClass: function (el, name) {
		if (el.classList !== undefined) {
			return el.classList.contains(name);
		}
		var className = L.DomUtil._getClass(el);
		return className.length > 0 && new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
	},

	addClass: function (el, name) {
		if (el.classList !== undefined) {
			var classes = L.Util.splitWords(name);
			for (var i = 0, len = classes.length; i < len; i++) {
				el.classList.add(classes[i]);
			}
		} else if (!L.DomUtil.hasClass(el, name)) {
			var className = L.DomUtil._getClass(el);
			L.DomUtil._setClass(el, (className ? className + ' ' : '') + name);
		}
	},

	removeClass: function (el, name) {
		if (el.classList !== undefined) {
			el.classList.remove(name);
		} else {
			L.DomUtil._setClass(el, L.Util.trim((' ' + L.DomUtil._getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
		}
	},

	_setClass: function (el, name) {
		if (el.className.baseVal === undefined) {
			el.className = name;
		} else {
			// in case of SVG element
			el.className.baseVal = name;
		}
	},

	_getClass: function (el) {
		return el.className.baseVal === undefined ? el.className : el.className.baseVal;
	},

	setOpacity: function (el, value) {

		if ('opacity' in el.style) {
			el.style.opacity = value;

		} else if ('filter' in el.style) {

			var filter = false,
			    filterName = 'DXImageTransform.Microsoft.Alpha';

			// filters collection throws an error if we try to retrieve a filter that doesn't exist
			try {
				filter = el.filters.item(filterName);
			} catch (e) {
				// don't set opacity to 1 if we haven't already set an opacity,
				// it isn't needed and breaks transparent pngs.
				if (value === 1) { return; }
			}

			value = Math.round(value * 100);

			if (filter) {
				filter.Enabled = (value !== 100);
				filter.Opacity = value;
			} else {
				el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
			}
		}
	},

	testProp: function (props) {

		var style = document.documentElement.style;

		for (var i = 0; i < props.length; i++) {
			if (props[i] in style) {
				return props[i];
			}
		}
		return false;
	},

	getTranslateString: function (point) {
		// on WebKit browsers (Chrome/Safari/iOS Safari/Android) using translate3d instead of translate
		// makes animation smoother as it ensures HW accel is used. Firefox 13 doesn't care
		// (same speed either way), Opera 12 doesn't support translate3d

		var is3d = L.Browser.webkit3d,
		    open = 'translate' + (is3d ? '3d' : '') + '(',
		    close = (is3d ? ',0' : '') + ')';

		return open + point.x + 'px,' + point.y + 'px' + close;
	},

	getScaleString: function (scale, origin) {

		var preTranslateStr = L.DomUtil.getTranslateString(origin.add(origin.multiplyBy(-1 * scale))),
		    scaleStr = ' scale(' + scale + ') ';

		return preTranslateStr + scaleStr;
	},

	setPosition: function (el, point, disable3D) { // (HTMLElement, Point[, Boolean])

		// jshint camelcase: false
		el._leaflet_pos = point;

		if (!disable3D && L.Browser.any3d) {
			el.style[L.DomUtil.TRANSFORM] =  L.DomUtil.getTranslateString(point);
		} else {
			el.style.left = point.x + 'px';
			el.style.top = point.y + 'px';
		}
	},

	getPosition: function (el) {
		// this method is only used for elements previously positioned using setPosition,
		// so it's safe to cache the position for performance

		// jshint camelcase: false
		return el._leaflet_pos;
	}
};


// prefix style property names

L.DomUtil.TRANSFORM = L.DomUtil.testProp(
        ['transform', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform']);

// webkitTransition comes first because some browser versions that drop vendor prefix don't do
// the same for the transitionend event, in particular the Android 4.1 stock browser

L.DomUtil.TRANSITION = L.DomUtil.testProp(
        ['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);

L.DomUtil.TRANSITION_END =
        L.DomUtil.TRANSITION === 'webkitTransition' || L.DomUtil.TRANSITION === 'OTransition' ?
        L.DomUtil.TRANSITION + 'End' : 'transitionend';

(function () {
    if ('onselectstart' in document) {
        L.extend(L.DomUtil, {
            disableTextSelection: function () {
                L.DomEvent.on(window, 'selectstart', L.DomEvent.preventDefault);
            },

            enableTextSelection: function () {
                L.DomEvent.off(window, 'selectstart', L.DomEvent.preventDefault);
            }
        });
    } else {
        var userSelectProperty = L.DomUtil.testProp(
            ['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);

        L.extend(L.DomUtil, {
            disableTextSelection: function () {
                if (userSelectProperty) {
                    var style = document.documentElement.style;
                    this._userSelect = style[userSelectProperty];
                    style[userSelectProperty] = 'none';
                }
            },

            enableTextSelection: function () {
                if (userSelectProperty) {
                    document.documentElement.style[userSelectProperty] = this._userSelect;
                    delete this._userSelect;
                }
            }
        });
    }

	L.extend(L.DomUtil, {
		disableImageDrag: function () {
			L.DomEvent.on(window, 'dragstart', L.DomEvent.preventDefault);
		},

		enableImageDrag: function () {
			L.DomEvent.off(window, 'dragstart', L.DomEvent.preventDefault);
		}
	});
})();


/*
 * L.LatLng represents a geographical point with latitude and longitude coordinates.
 */

L.LatLng = function (lat, lng, alt) { // (Number, Number, Number)
	lat = parseFloat(lat);
	lng = parseFloat(lng);

	if (isNaN(lat) || isNaN(lng)) {
		throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
	}

	this.lat = lat;
	this.lng = lng;

	if (alt !== undefined) {
		this.alt = parseFloat(alt);
	}
};

L.extend(L.LatLng, {
	DEG_TO_RAD: Math.PI / 180,
	RAD_TO_DEG: 180 / Math.PI,
	MAX_MARGIN: 1.0E-9 // max margin of error for the "equals" check
});

L.LatLng.prototype = {
	equals: function (obj) { // (LatLng) -> Boolean
		if (!obj) { return false; }

		obj = L.latLng(obj);

		var margin = Math.max(
		        Math.abs(this.lat - obj.lat),
		        Math.abs(this.lng - obj.lng));

		return margin <= L.LatLng.MAX_MARGIN;
	},

	toString: function (precision) { // (Number) -> String
		return 'LatLng(' +
		        L.Util.formatNum(this.lat, precision) + ', ' +
		        L.Util.formatNum(this.lng, precision) + ')';
	},

	// Haversine distance formula, see http://en.wikipedia.org/wiki/Haversine_formula
	// TODO move to projection code, LatLng shouldn't know about Earth
	distanceTo: function (other) { // (LatLng) -> Number
		other = L.latLng(other);

		var R = 6378137, // earth radius in meters
		    d2r = L.LatLng.DEG_TO_RAD,
		    dLat = (other.lat - this.lat) * d2r,
		    dLon = (other.lng - this.lng) * d2r,
		    lat1 = this.lat * d2r,
		    lat2 = other.lat * d2r,
		    sin1 = Math.sin(dLat / 2),
		    sin2 = Math.sin(dLon / 2);

		var a = sin1 * sin1 + sin2 * sin2 * Math.cos(lat1) * Math.cos(lat2);

		return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	},

	wrap: function (a, b) { // (Number, Number) -> LatLng
		var lng = this.lng;

		a = a || -180;
		b = b ||  180;

		lng = (lng + b) % (b - a) + (lng < a || lng === b ? b : a);

		return new L.LatLng(this.lat, lng);
	}
};

L.latLng = function (a, b) { // (LatLng) or ([Number, Number]) or (Number, Number)
	if (a instanceof L.LatLng) {
		return a;
	}
	if (L.Util.isArray(a)) {
		if (typeof a[0] === 'number' || typeof a[0] === 'string') {
			return new L.LatLng(a[0], a[1], a[2]);
		} else {
			return null;
		}
	}
	if (a === undefined || a === null) {
		return a;
	}
	if (typeof a === 'object' && 'lat' in a) {
		return new L.LatLng(a.lat, 'lng' in a ? a.lng : a.lon);
	}
	if (b === undefined) {
		return null;
	}
	return new L.LatLng(a, b);
};



/*
 * L.LatLngBounds represents a rectangular area on the map in geographical coordinates.
 */

L.LatLngBounds = function (southWest, northEast) { // (LatLng, LatLng) or (LatLng[])
	if (!southWest) { return; }

	var latlngs = northEast ? [southWest, northEast] : southWest;

	for (var i = 0, len = latlngs.length; i < len; i++) {
		this.extend(latlngs[i]);
	}
};

L.LatLngBounds.prototype = {
	// extend the bounds to contain the given point or bounds
	extend: function (obj) { // (LatLng) or (LatLngBounds)
		if (!obj) { return this; }

		var latLng = L.latLng(obj);
		if (latLng !== null) {
			obj = latLng;
		} else {
			obj = L.latLngBounds(obj);
		}

		if (obj instanceof L.LatLng) {
			if (!this._southWest && !this._northEast) {
				this._southWest = new L.LatLng(obj.lat, obj.lng);
				this._northEast = new L.LatLng(obj.lat, obj.lng);
			} else {
				this._southWest.lat = Math.min(obj.lat, this._southWest.lat);
				this._southWest.lng = Math.min(obj.lng, this._southWest.lng);

				this._northEast.lat = Math.max(obj.lat, this._northEast.lat);
				this._northEast.lng = Math.max(obj.lng, this._northEast.lng);
			}
		} else if (obj instanceof L.LatLngBounds) {
			this.extend(obj._southWest);
			this.extend(obj._northEast);
		}
		return this;
	},

	// extend the bounds by a percentage
	pad: function (bufferRatio) { // (Number) -> LatLngBounds
		var sw = this._southWest,
		    ne = this._northEast,
		    heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
		    widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

		return new L.LatLngBounds(
		        new L.LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
		        new L.LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
	},

	getCenter: function () { // -> LatLng
		return new L.LatLng(
		        (this._southWest.lat + this._northEast.lat) / 2,
		        (this._southWest.lng + this._northEast.lng) / 2);
	},

	getSouthWest: function () {
		return this._southWest;
	},

	getNorthEast: function () {
		return this._northEast;
	},

	getNorthWest: function () {
		return new L.LatLng(this.getNorth(), this.getWest());
	},

	getSouthEast: function () {
		return new L.LatLng(this.getSouth(), this.getEast());
	},

	getWest: function () {
		return this._southWest.lng;
	},

	getSouth: function () {
		return this._southWest.lat;
	},

	getEast: function () {
		return this._northEast.lng;
	},

	getNorth: function () {
		return this._northEast.lat;
	},

	contains: function (obj) { // (LatLngBounds) or (LatLng) -> Boolean
		if (typeof obj[0] === 'number' || obj instanceof L.LatLng) {
			obj = L.latLng(obj);
		} else {
			obj = L.latLngBounds(obj);
		}

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2, ne2;

		if (obj instanceof L.LatLngBounds) {
			sw2 = obj.getSouthWest();
			ne2 = obj.getNorthEast();
		} else {
			sw2 = ne2 = obj;
		}

		return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
		       (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
	},

	intersects: function (bounds) { // (LatLngBounds)
		bounds = L.latLngBounds(bounds);

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2 = bounds.getSouthWest(),
		    ne2 = bounds.getNorthEast(),

		    latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
		    lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

		return latIntersects && lngIntersects;
	},

	toBBoxString: function () {
		return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
	},

	equals: function (bounds) { // (LatLngBounds)
		if (!bounds) { return false; }

		bounds = L.latLngBounds(bounds);

		return this._southWest.equals(bounds.getSouthWest()) &&
		       this._northEast.equals(bounds.getNorthEast());
	},

	isValid: function () {
		return !!(this._southWest && this._northEast);
	}
};

//TODO International date line?

L.latLngBounds = function (a, b) { // (LatLngBounds) or (LatLng, LatLng)
	if (!a || a instanceof L.LatLngBounds) {
		return a;
	}
	return new L.LatLngBounds(a, b);
};


/*
 * L.Projection contains various geographical projections used by CRS classes.
 */

L.Projection = {};


/*
 * Spherical Mercator is the most popular map projection, used by EPSG:3857 CRS used by default.
 */

L.Projection.SphericalMercator = {
	MAX_LATITUDE: 85.0511287798,

	project: function (latlng) { // (LatLng) -> Point
		var d = L.LatLng.DEG_TO_RAD,
		    max = this.MAX_LATITUDE,
		    lat = Math.max(Math.min(max, latlng.lat), -max),
		    x = latlng.lng * d,
		    y = lat * d;

		y = Math.log(Math.tan((Math.PI / 4) + (y / 2)));

		return new L.Point(x, y);
	},

	unproject: function (point) { // (Point, Boolean) -> LatLng
		var d = L.LatLng.RAD_TO_DEG,
		    lng = point.x * d,
		    lat = (2 * Math.atan(Math.exp(point.y)) - (Math.PI / 2)) * d;

		return new L.LatLng(lat, lng);
	}
};


/*
 * Simple equirectangular (Plate Carree) projection, used by CRS like EPSG:4326 and Simple.
 */

L.Projection.LonLat = {
	project: function (latlng) {
		return new L.Point(latlng.lng, latlng.lat);
	},

	unproject: function (point) {
		return new L.LatLng(point.y, point.x);
	}
};


/*
 * L.CRS is a base object for all defined CRS (Coordinate Reference Systems) in Leaflet.
 */

L.CRS = {
	latLngToPoint: function (latlng, zoom) { // (LatLng, Number) -> Point
		var projectedPoint = this.projection.project(latlng),
		    scale = this.scale(zoom);

		return this.transformation._transform(projectedPoint, scale);
	},

	pointToLatLng: function (point, zoom) { // (Point, Number[, Boolean]) -> LatLng
		var scale = this.scale(zoom),
		    untransformedPoint = this.transformation.untransform(point, scale);

		return this.projection.unproject(untransformedPoint);
	},

	project: function (latlng) {
		return this.projection.project(latlng);
	},

	scale: function (zoom) {
		return 256 * Math.pow(2, zoom);
	},

	getSize: function (zoom) {
		var s = this.scale(zoom);
		return L.point(s, s);
	}
};


/*
 * A simple CRS that can be used for flat non-Earth maps like panoramas or game maps.
 */

L.CRS.Simple = L.extend({}, L.CRS, {
	projection: L.Projection.LonLat,
	transformation: new L.Transformation(1, 0, -1, 0),

	scale: function (zoom) {
		return Math.pow(2, zoom);
	}
});


/*
 * L.CRS.EPSG3857 (Spherical Mercator) is the most common CRS for web mapping
 * and is used by Leaflet by default.
 */

L.CRS.EPSG3857 = L.extend({}, L.CRS, {
	code: 'EPSG:3857',

	projection: L.Projection.SphericalMercator,
	transformation: new L.Transformation(0.5 / Math.PI, 0.5, -0.5 / Math.PI, 0.5),

	project: function (latlng) { // (LatLng) -> Point
		var projectedPoint = this.projection.project(latlng),
		    earthRadius = 6378137;
		return projectedPoint.multiplyBy(earthRadius);
	}
});

L.CRS.EPSG900913 = L.extend({}, L.CRS.EPSG3857, {
	code: 'EPSG:900913'
});


/*
 * L.CRS.EPSG4326 is a CRS popular among advanced GIS specialists.
 */

L.CRS.EPSG4326 = L.extend({}, L.CRS, {
	code: 'EPSG:4326',

	projection: L.Projection.LonLat,
	transformation: new L.Transformation(1 / 360, 0.5, -1 / 360, 0.5)
});


/*
 * L.Map is the central class of the API - it is used to create a map.
 */

L.Map = L.Class.extend({

	includes: L.Mixin.Events,

	options: {
		crs: L.CRS.EPSG3857,

		/*
		center: LatLng,
		zoom: Number,
		layers: Array,
		*/

		fadeAnimation: L.DomUtil.TRANSITION && !L.Browser.android23,
		trackResize: true,
		markerZoomAnimation: L.DomUtil.TRANSITION && L.Browser.any3d
	},

	initialize: function (id, options) { // (HTMLElement or String, Object)
		options = L.setOptions(this, options);


		this._initContainer(id);
		this._initLayout();

		// hack for https://github.com/Leaflet/Leaflet/issues/1980
		this._onResize = L.bind(this._onResize, this);

		this._initEvents();

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		if (options.center && options.zoom !== undefined) {
			this.setView(L.latLng(options.center), options.zoom, {reset: true});
		}

		this._handlers = [];

		this._layers = {};
		this._zoomBoundLayers = {};
		this._tileLayersNum = 0;

		this.callInitHooks();

		this._addLayers(options.layers);
	},


	// public methods that modify map state

	// replaced by animation-powered implementation in Map.PanAnimation.js
	setView: function (center, zoom) {
		zoom = zoom === undefined ? this.getZoom() : zoom;
		this._resetView(L.latLng(center), this._limitZoom(zoom));
		return this;
	},

	setZoom: function (zoom, options) {
		if (!this._loaded) {
			this._zoom = this._limitZoom(zoom);
			return this;
		}
		return this.setView(this.getCenter(), zoom, {zoom: options});
	},

	zoomIn: function (delta, options) {
		return this.setZoom(this._zoom + (delta || 1), options);
	},

	zoomOut: function (delta, options) {
		return this.setZoom(this._zoom - (delta || 1), options);
	},

	setZoomAround: function (latlng, zoom, options) {
		var scale = this.getZoomScale(zoom),
		    viewHalf = this.getSize().divideBy(2),
		    containerPoint = latlng instanceof L.Point ? latlng : this.latLngToContainerPoint(latlng),

		    centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
		    newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

		return this.setView(newCenter, zoom, {zoom: options});
	},

	fitBounds: function (bounds, options) {

		options = options || {};
		bounds = bounds.getBounds ? bounds.getBounds() : L.latLngBounds(bounds);

		var paddingTL = L.point(options.paddingTopLeft || options.padding || [0, 0]),
		    paddingBR = L.point(options.paddingBottomRight || options.padding || [0, 0]),

		    zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR)),
		    paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),

		    swPoint = this.project(bounds.getSouthWest(), zoom),
		    nePoint = this.project(bounds.getNorthEast(), zoom),
		    center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

		zoom = options && options.maxZoom ? Math.min(options.maxZoom, zoom) : zoom;

		return this.setView(center, zoom, options);
	},

	fitWorld: function (options) {
		return this.fitBounds([[-90, -180], [90, 180]], options);
	},

	panTo: function (center, options) { // (LatLng)
		return this.setView(center, this._zoom, {pan: options});
	},

	panBy: function (offset) { // (Point)
		// replaced with animated panBy in Map.PanAnimation.js
		this.fire('movestart');

		this._rawPanBy(L.point(offset));

		this.fire('move');
		return this.fire('moveend');
	},

	setMaxBounds: function (bounds) {
		bounds = L.latLngBounds(bounds);

		this.options.maxBounds = bounds;

		if (!bounds) {
			return this.off('moveend', this._panInsideMaxBounds, this);
		}

		if (this._loaded) {
			this._panInsideMaxBounds();
		}

		return this.on('moveend', this._panInsideMaxBounds, this);
	},

	panInsideBounds: function (bounds, options) {
		var center = this.getCenter(),
			newCenter = this._limitCenter(center, this._zoom, bounds);

		if (center.equals(newCenter)) { return this; }

		return this.panTo(newCenter, options);
	},

	addLayer: function (layer) {
		// TODO method is too big, refactor

		var id = L.stamp(layer);

		if (this._layers[id]) { return this; }

		this._layers[id] = layer;

		// TODO getMaxZoom, getMinZoom in ILayer (instead of options)
		if (layer.options && (!isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom))) {
			this._zoomBoundLayers[id] = layer;
			this._updateZoomLevels();
		}

		// TODO looks ugly, refactor!!!
		if (this.options.zoomAnimation && L.TileLayer && (layer instanceof L.TileLayer)) {
			this._tileLayersNum++;
			this._tileLayersToLoad++;
			layer.on('load', this._onTileLayerLoad, this);
		}

		if (this._loaded) {
			this._layerAdd(layer);
		}

		return this;
	},

	removeLayer: function (layer) {
		var id = L.stamp(layer);

		if (!this._layers[id]) { return this; }

		if (this._loaded) {
			layer.onRemove(this);
		}

		delete this._layers[id];

		if (this._loaded) {
			this.fire('layerremove', {layer: layer});
		}

		if (this._zoomBoundLayers[id]) {
			delete this._zoomBoundLayers[id];
			this._updateZoomLevels();
		}

		// TODO looks ugly, refactor
		if (this.options.zoomAnimation && L.TileLayer && (layer instanceof L.TileLayer)) {
			this._tileLayersNum--;
			this._tileLayersToLoad--;
			layer.off('load', this._onTileLayerLoad, this);
		}

		return this;
	},

	hasLayer: function (layer) {
		if (!layer) { return false; }

		return (L.stamp(layer) in this._layers);
	},

	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	invalidateSize: function (options) {
		if (!this._loaded) { return this; }

		options = L.extend({
			animate: false,
			pan: true
		}, options === true ? {animate: true} : options);

		var oldSize = this.getSize();
		this._sizeChanged = true;
		this._initialCenter = null;

		var newSize = this.getSize(),
		    oldCenter = oldSize.divideBy(2).round(),
		    newCenter = newSize.divideBy(2).round(),
		    offset = oldCenter.subtract(newCenter);

		if (!offset.x && !offset.y) { return this; }

		if (options.animate && options.pan) {
			this.panBy(offset);

		} else {
			if (options.pan) {
				this._rawPanBy(offset);
			}

			this.fire('move');

			if (options.debounceMoveend) {
				clearTimeout(this._sizeTimer);
				this._sizeTimer = setTimeout(L.bind(this.fire, this, 'moveend'), 200);
			} else {
				this.fire('moveend');
			}
		}

		return this.fire('resize', {
			oldSize: oldSize,
			newSize: newSize
		});
	},

	// TODO handler.addTo
	addHandler: function (name, HandlerClass) {
		if (!HandlerClass) { return this; }

		var handler = this[name] = new HandlerClass(this);

		this._handlers.push(handler);

		if (this.options[name]) {
			handler.enable();
		}

		return this;
	},

	remove: function () {
		if (this._loaded) {
			this.fire('unload');
		}

		this._initEvents('off');

		try {
			// throws error in IE6-8
			delete this._container._leaflet;
		} catch (e) {
			this._container._leaflet = undefined;
		}

		this._clearPanes();
		if (this._clearControlPos) {
			this._clearControlPos();
		}

		this._clearHandlers();

		return this;
	},


	// public methods for getting map state

	getCenter: function () { // (Boolean) -> LatLng
		this._checkIfLoaded();

		if (this._initialCenter && !this._moved()) {
			return this._initialCenter;
		}
		return this.layerPointToLatLng(this._getCenterLayerPoint());
	},

	getZoom: function () {
		return this._zoom;
	},

	getBounds: function () {
		var bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new L.LatLngBounds(sw, ne);
	},

	getMinZoom: function () {
		return this.options.minZoom === undefined ?
			(this._layersMinZoom === undefined ? 0 : this._layersMinZoom) :
			this.options.minZoom;
	},

	getMaxZoom: function () {
		return this.options.maxZoom === undefined ?
			(this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
			this.options.maxZoom;
	},

	getBoundsZoom: function (bounds, inside, padding) { // (LatLngBounds[, Boolean, Point]) -> Number
		bounds = L.latLngBounds(bounds);

		var zoom = this.getMinZoom() - (inside ? 1 : 0),
		    maxZoom = this.getMaxZoom(),
		    size = this.getSize(),

		    nw = bounds.getNorthWest(),
		    se = bounds.getSouthEast(),

		    zoomNotFound = true,
		    boundsSize;

		padding = L.point(padding || [0, 0]);

		do {
			zoom++;
			boundsSize = this.project(se, zoom).subtract(this.project(nw, zoom)).add(padding);
			zoomNotFound = !inside ? size.contains(boundsSize) : boundsSize.x < size.x || boundsSize.y < size.y;

		} while (zoomNotFound && zoom <= maxZoom);

		if (zoomNotFound && inside) {
			return null;
		}

		return inside ? zoom : zoom - 1;
	},

	getSize: function () {
		if (!this._size || this._sizeChanged) {
			this._size = new L.Point(
				this._container.clientWidth,
				this._container.clientHeight);

			this._sizeChanged = false;
		}
		return this._size.clone();
	},

	getPixelBounds: function () {
		var topLeftPoint = this._getTopLeftPoint();
		return new L.Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	},

	getPixelOrigin: function () {
		this._checkIfLoaded();
		return this._initialTopLeftPoint;
	},

	getPanes: function () {
		return this._panes;
	},

	getContainer: function () {
		return this._container;
	},


	// TODO replace with universal implementation after refactoring projections

	getZoomScale: function (toZoom) {
		var crs = this.options.crs;
		return crs.scale(toZoom) / crs.scale(this._zoom);
	},

	getScaleZoom: function (scale) {
		return this._zoom + (Math.log(scale) / Math.LN2);
	},


	// conversion methods

	project: function (latlng, zoom) { // (LatLng[, Number]) -> Point
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.latLngToPoint(L.latLng(latlng), zoom);
	},

	unproject: function (point, zoom) { // (Point[, Number]) -> LatLng
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.pointToLatLng(L.point(point), zoom);
	},

	layerPointToLatLng: function (point) { // (Point)
		var projectedPoint = L.point(point).add(this.getPixelOrigin());
		return this.unproject(projectedPoint);
	},

	latLngToLayerPoint: function (latlng) { // (LatLng)
		var projectedPoint = this.project(L.latLng(latlng))._round();
		return projectedPoint._subtract(this.getPixelOrigin());
	},

	containerPointToLayerPoint: function (point) { // (Point)
		return L.point(point).subtract(this._getMapPanePos());
	},

	layerPointToContainerPoint: function (point) { // (Point)
		return L.point(point).add(this._getMapPanePos());
	},

	containerPointToLatLng: function (point) {
		var layerPoint = this.containerPointToLayerPoint(L.point(point));
		return this.layerPointToLatLng(layerPoint);
	},

	latLngToContainerPoint: function (latlng) {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(L.latLng(latlng)));
	},

	mouseEventToContainerPoint: function (e) { // (MouseEvent)
		return L.DomEvent.getMousePosition(e, this._container);
	},

	mouseEventToLayerPoint: function (e) { // (MouseEvent)
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	},

	mouseEventToLatLng: function (e) { // (MouseEvent)
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	},


	// map initialization methods

	_initContainer: function (id) {
		var container = this._container = L.DomUtil.get(id);

		if (!container) {
			throw new Error('Map container not found.');
		} else if (container._leaflet) {
			throw new Error('Map container is already initialized.');
		}

		container._leaflet = true;
	},

	_initLayout: function () {
		var container = this._container;

		L.DomUtil.addClass(container, 'leaflet-container' +
			(L.Browser.touch ? ' leaflet-touch' : '') +
			(L.Browser.retina ? ' leaflet-retina' : '') +
			(L.Browser.ielt9 ? ' leaflet-oldie' : '') +
			(this.options.fadeAnimation ? ' leaflet-fade-anim' : ''));

		var position = L.DomUtil.getStyle(container, 'position');

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed') {
			container.style.position = 'relative';
		}

		this._initPanes();

		if (this._initControlPos) {
			this._initControlPos();
		}
	},

	_initPanes: function () {
		var panes = this._panes = {};

		this._mapPane = panes.mapPane = this._createPane('leaflet-map-pane', this._container);

		this._tilePane = panes.tilePane = this._createPane('leaflet-tile-pane', this._mapPane);
		panes.objectsPane = this._createPane('leaflet-objects-pane', this._mapPane);
		panes.shadowPane = this._createPane('leaflet-shadow-pane');
		panes.overlayPane = this._createPane('leaflet-overlay-pane');
		panes.markerPane = this._createPane('leaflet-marker-pane');
		panes.popupPane = this._createPane('leaflet-popup-pane');

		var zoomHide = ' leaflet-zoom-hide';

		if (!this.options.markerZoomAnimation) {
			L.DomUtil.addClass(panes.markerPane, zoomHide);
			L.DomUtil.addClass(panes.shadowPane, zoomHide);
			L.DomUtil.addClass(panes.popupPane, zoomHide);
		}
	},

	_createPane: function (className, container) {
		return L.DomUtil.create('div', className, container || this._panes.objectsPane);
	},

	_clearPanes: function () {
		this._container.removeChild(this._mapPane);
	},

	_addLayers: function (layers) {
		layers = layers ? (L.Util.isArray(layers) ? layers : [layers]) : [];

		for (var i = 0, len = layers.length; i < len; i++) {
			this.addLayer(layers[i]);
		}
	},


	// private methods that modify map state

	_resetView: function (center, zoom, preserveMapOffset, afterZoomAnim) {

		var zoomChanged = (this._zoom !== zoom);

		if (!afterZoomAnim) {
			this.fire('movestart');

			if (zoomChanged) {
				this.fire('zoomstart');
			}
		}

		this._zoom = zoom;
		this._initialCenter = center;

		this._initialTopLeftPoint = this._getNewTopLeftPoint(center);

		if (!preserveMapOffset) {
			L.DomUtil.setPosition(this._mapPane, new L.Point(0, 0));
		} else {
			this._initialTopLeftPoint._add(this._getMapPanePos());
		}

		this._tileLayersToLoad = this._tileLayersNum;

		var loading = !this._loaded;
		this._loaded = true;

		this.fire('viewreset', {hard: !preserveMapOffset});

		if (loading) {
			this.fire('load');
			this.eachLayer(this._layerAdd, this);
		}

		this.fire('move');

		if (zoomChanged || afterZoomAnim) {
			this.fire('zoomend');
		}

		this.fire('moveend', {hard: !preserveMapOffset});
	},

	_rawPanBy: function (offset) {
		L.DomUtil.setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
	},

	_getZoomSpan: function () {
		return this.getMaxZoom() - this.getMinZoom();
	},

	_updateZoomLevels: function () {
		var i,
			minZoom = Infinity,
			maxZoom = -Infinity,
			oldZoomSpan = this._getZoomSpan();

		for (i in this._zoomBoundLayers) {
			var layer = this._zoomBoundLayers[i];
			if (!isNaN(layer.options.minZoom)) {
				minZoom = Math.min(minZoom, layer.options.minZoom);
			}
			if (!isNaN(layer.options.maxZoom)) {
				maxZoom = Math.max(maxZoom, layer.options.maxZoom);
			}
		}

		if (i === undefined) { // we have no tilelayers
			this._layersMaxZoom = this._layersMinZoom = undefined;
		} else {
			this._layersMaxZoom = maxZoom;
			this._layersMinZoom = minZoom;
		}

		if (oldZoomSpan !== this._getZoomSpan()) {
			this.fire('zoomlevelschange');
		}
	},

	_panInsideMaxBounds: function () {
		this.panInsideBounds(this.options.maxBounds);
	},

	_checkIfLoaded: function () {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}
	},

	// map events

	_initEvents: function (onOff) {
		if (!L.DomEvent) { return; }

		onOff = onOff || 'on';

		L.DomEvent[onOff](this._container, 'click', this._onMouseClick, this);

		var events = ['dblclick', 'mousedown', 'mouseup', 'mouseenter',
		              'mouseleave', 'mousemove', 'contextmenu'],
		    i, len;

		for (i = 0, len = events.length; i < len; i++) {
			L.DomEvent[onOff](this._container, events[i], this._fireMouseEvent, this);
		}

		if (this.options.trackResize) {
			L.DomEvent[onOff](window, 'resize', this._onResize, this);
		}
	},

	_onResize: function () {
		L.Util.cancelAnimFrame(this._resizeRequest);
		this._resizeRequest = L.Util.requestAnimFrame(
		        function () { this.invalidateSize({debounceMoveend: true}); }, this, false, this._container);
	},

	_onMouseClick: function (e) {
		if (!this._loaded || (!e._simulated &&
		        ((this.dragging && this.dragging.moved()) ||
		         (this.boxZoom  && this.boxZoom.moved()))) ||
		            L.DomEvent._skipped(e)) { return; }

		this.fire('preclick');
		this._fireMouseEvent(e);
	},

	_fireMouseEvent: function (e) {
		if (!this._loaded || L.DomEvent._skipped(e)) { return; }

		var type = e.type;

		type = (type === 'mouseenter' ? 'mouseover' : (type === 'mouseleave' ? 'mouseout' : type));

		if (!this.hasEventListeners(type)) { return; }

		if (type === 'contextmenu') {
			L.DomEvent.preventDefault(e);
		}

		var containerPoint = this.mouseEventToContainerPoint(e),
		    layerPoint = this.containerPointToLayerPoint(containerPoint),
		    latlng = this.layerPointToLatLng(layerPoint);

		this.fire(type, {
			latlng: latlng,
			layerPoint: layerPoint,
			containerPoint: containerPoint,
			originalEvent: e
		});
	},

	_onTileLayerLoad: function () {
		this._tileLayersToLoad--;
		if (this._tileLayersNum && !this._tileLayersToLoad) {
			this.fire('tilelayersload');
		}
	},

	_clearHandlers: function () {
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			this._handlers[i].disable();
		}
	},

	whenReady: function (callback, context) {
		if (this._loaded) {
			callback.call(context || this, this);
		} else {
			this.on('load', callback, context);
		}
		return this;
	},

	_layerAdd: function (layer) {
		layer.onAdd(this);
		this.fire('layeradd', {layer: layer});
	},


	// private methods for getting map state

	_getMapPanePos: function () {
		return L.DomUtil.getPosition(this._mapPane);
	},

	_moved: function () {
		var pos = this._getMapPanePos();
		return pos && !pos.equals([0, 0]);
	},

	_getTopLeftPoint: function () {
		return this.getPixelOrigin().subtract(this._getMapPanePos());
	},

	_getNewTopLeftPoint: function (center, zoom) {
		var viewHalf = this.getSize()._divideBy(2);
		// TODO round on display, not calculation to increase precision?
		return this.project(center, zoom)._subtract(viewHalf)._round();
	},

	_latLngToNewLayerPoint: function (latlng, newZoom, newCenter) {
		var topLeft = this._getNewTopLeftPoint(newCenter, newZoom).add(this._getMapPanePos());
		return this.project(latlng, newZoom)._subtract(topLeft);
	},

	// layer point of the current center
	_getCenterLayerPoint: function () {
		return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
	},

	// offset of the specified place to the current center in pixels
	_getCenterOffset: function (latlng) {
		return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
	},

	// adjust center for view to get inside bounds
	_limitCenter: function (center, zoom, bounds) {

		if (!bounds) { return center; }

		var centerPoint = this.project(center, zoom),
		    viewHalf = this.getSize().divideBy(2),
		    viewBounds = new L.Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
		    offset = this._getBoundsOffset(viewBounds, bounds, zoom);

		return this.unproject(centerPoint.add(offset), zoom);
	},

	// adjust offset for view to get inside bounds
	_limitOffset: function (offset, bounds) {
		if (!bounds) { return offset; }

		var viewBounds = this.getPixelBounds(),
		    newBounds = new L.Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

		return offset.add(this._getBoundsOffset(newBounds, bounds));
	},

	// returns offset needed for pxBounds to get inside maxBounds at a specified zoom
	_getBoundsOffset: function (pxBounds, maxBounds, zoom) {
		var nwOffset = this.project(maxBounds.getNorthWest(), zoom).subtract(pxBounds.min),
		    seOffset = this.project(maxBounds.getSouthEast(), zoom).subtract(pxBounds.max),

		    dx = this._rebound(nwOffset.x, -seOffset.x),
		    dy = this._rebound(nwOffset.y, -seOffset.y);

		return new L.Point(dx, dy);
	},

	_rebound: function (left, right) {
		return left + right > 0 ?
			Math.round(left - right) / 2 :
			Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
	},

	_limitZoom: function (zoom) {
		var min = this.getMinZoom(),
		    max = this.getMaxZoom();

		return Math.max(min, Math.min(max, zoom));
	}
});

L.map = function (id, options) {
	return new L.Map(id, options);
};


/*
 * Mercator projection that takes into account that the Earth is not a perfect sphere.
 * Less popular than spherical mercator; used by projections like EPSG:3395.
 */

L.Projection.Mercator = {
	MAX_LATITUDE: 85.0840591556,

	R_MINOR: 6356752.314245179,
	R_MAJOR: 6378137,

	project: function (latlng) { // (LatLng) -> Point
		var d = L.LatLng.DEG_TO_RAD,
		    max = this.MAX_LATITUDE,
		    lat = Math.max(Math.min(max, latlng.lat), -max),
		    r = this.R_MAJOR,
		    r2 = this.R_MINOR,
		    x = latlng.lng * d * r,
		    y = lat * d,
		    tmp = r2 / r,
		    eccent = Math.sqrt(1.0 - tmp * tmp),
		    con = eccent * Math.sin(y);

		con = Math.pow((1 - con) / (1 + con), eccent * 0.5);

		var ts = Math.tan(0.5 * ((Math.PI * 0.5) - y)) / con;
		y = -r * Math.log(ts);

		return new L.Point(x, y);
	},

	unproject: function (point) { // (Point, Boolean) -> LatLng
		var d = L.LatLng.RAD_TO_DEG,
		    r = this.R_MAJOR,
		    r2 = this.R_MINOR,
		    lng = point.x * d / r,
		    tmp = r2 / r,
		    eccent = Math.sqrt(1 - (tmp * tmp)),
		    ts = Math.exp(- point.y / r),
		    phi = (Math.PI / 2) - 2 * Math.atan(ts),
		    numIter = 15,
		    tol = 1e-7,
		    i = numIter,
		    dphi = 0.1,
		    con;

		while ((Math.abs(dphi) > tol) && (--i > 0)) {
			con = eccent * Math.sin(phi);
			dphi = (Math.PI / 2) - 2 * Math.atan(ts *
			            Math.pow((1.0 - con) / (1.0 + con), 0.5 * eccent)) - phi;
			phi += dphi;
		}

		return new L.LatLng(phi * d, lng);
	}
};



L.CRS.EPSG3395 = L.extend({}, L.CRS, {
	code: 'EPSG:3395',

	projection: L.Projection.Mercator,

	transformation: (function () {
		var m = L.Projection.Mercator,
		    r = m.R_MAJOR,
		    scale = 0.5 / (Math.PI * r);

		return new L.Transformation(scale, 0.5, -scale, 0.5);
	}())
});


/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

L.TileLayer = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		minZoom: 0,
		maxZoom: 18,
		tileSize: 256,
		subdomains: 'abc',
		errorTileUrl: '',
		attribution: '',
		zoomOffset: 0,
		opacity: 1,
		/*
		maxNativeZoom: null,
		zIndex: null,
		tms: false,
		continuousWorld: false,
		noWrap: false,
		zoomReverse: false,
		detectRetina: false,
		reuseTiles: false,
		bounds: false,
		*/
		unloadInvisibleTiles: L.Browser.mobile,
		updateWhenIdle: L.Browser.mobile
	},

	initialize: function (url, options) {
		options = L.setOptions(this, options);

		// detecting retina displays, adjusting tileSize and zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {

			options.tileSize = Math.floor(options.tileSize / 2);
			options.zoomOffset++;

			if (options.minZoom > 0) {
				options.minZoom--;
			}
			this.options.maxZoom--;
		}

		if (options.bounds) {
			options.bounds = L.latLngBounds(options.bounds);
		}

		this._url = url;

		var subdomains = this.options.subdomains;

		if (typeof subdomains === 'string') {
			this.options.subdomains = subdomains.split('');
		}
	},

	onAdd: function (map) {
		this._map = map;
		this._animated = map._zoomAnimated;

		// create a container div for tiles
		this._initContainer();

		// set up events
		map.on({
			'viewreset': this._reset,
			'moveend': this._update
		}, this);

		if (this._animated) {
			map.on({
				'zoomanim': this._animateZoom,
				'zoomend': this._endZoomAnim
			}, this);
		}

		if (!this.options.updateWhenIdle) {
			this._limitedUpdate = L.Util.limitExecByInterval(this._update, 150, this);
			map.on('move', this._limitedUpdate, this);
		}

		this._reset();
		this._update();
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
		this._container.parentNode.removeChild(this._container);

		map.off({
			'viewreset': this._reset,
			'moveend': this._update
		}, this);

		if (this._animated) {
			map.off({
				'zoomanim': this._animateZoom,
				'zoomend': this._endZoomAnim
			}, this);
		}

		if (!this.options.updateWhenIdle) {
			map.off('move', this._limitedUpdate, this);
		}

		this._container = null;
		this._map = null;
	},

	bringToFront: function () {
		var pane = this._map._panes.tilePane;

		if (this._container) {
			pane.appendChild(this._container);
			this._setAutoZIndex(pane, Math.max);
		}

		return this;
	},

	bringToBack: function () {
		var pane = this._map._panes.tilePane;

		if (this._container) {
			pane.insertBefore(this._container, pane.firstChild);
			this._setAutoZIndex(pane, Math.min);
		}

		return this;
	},

	getAttribution: function () {
		return this.options.attribution;
	},

	getContainer: function () {
		return this._container;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	setZIndex: function (zIndex) {
		this.options.zIndex = zIndex;
		this._updateZIndex();

		return this;
	},

	setUrl: function (url, noRedraw) {
		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	},

	redraw: function () {
		if (this._map) {
			this._reset({hard: true});
			this._update();
		}
		return this;
	},

	_updateZIndex: function () {
		if (this._container && this.options.zIndex !== undefined) {
			this._container.style.zIndex = this.options.zIndex;
		}
	},

	_setAutoZIndex: function (pane, compare) {

		var layers = pane.children,
		    edgeZIndex = -compare(Infinity, -Infinity), // -Infinity for max, Infinity for min
		    zIndex, i, len;

		for (i = 0, len = layers.length; i < len; i++) {

			if (layers[i] !== this._container) {
				zIndex = parseInt(layers[i].style.zIndex, 10);

				if (!isNaN(zIndex)) {
					edgeZIndex = compare(edgeZIndex, zIndex);
				}
			}
		}

		this.options.zIndex = this._container.style.zIndex =
		        (isFinite(edgeZIndex) ? edgeZIndex : 0) + compare(1, -1);
	},

	_updateOpacity: function () {
		var i,
		    tiles = this._tiles;

		if (L.Browser.ielt9) {
			for (i in tiles) {
				L.DomUtil.setOpacity(tiles[i], this.options.opacity);
			}
		} else {
			L.DomUtil.setOpacity(this._container, this.options.opacity);
		}
	},

	_initContainer: function () {
		var tilePane = this._map._panes.tilePane;

		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-layer');

			this._updateZIndex();

			if (this._animated) {
				var className = 'leaflet-tile-container';

				this._bgBuffer = L.DomUtil.create('div', className, this._container);
				this._tileContainer = L.DomUtil.create('div', className, this._container);

			} else {
				this._tileContainer = this._container;
			}

			tilePane.appendChild(this._container);

			if (this.options.opacity < 1) {
				this._updateOpacity();
			}
		}
	},

	_reset: function (e) {
		for (var key in this._tiles) {
			this.fire('tileunload', {tile: this._tiles[key]});
		}

		this._tiles = {};
		this._tilesToLoad = 0;

		if (this.options.reuseTiles) {
			this._unusedTiles = [];
		}

		this._tileContainer.innerHTML = '';

		if (this._animated && e && e.hard) {
			this._clearBgBuffer();
		}

		this._initContainer();
	},

	_getTileSize: function () {
		var map = this._map,
		    zoom = map.getZoom() + this.options.zoomOffset,
		    zoomN = this.options.maxNativeZoom,
		    tileSize = this.options.tileSize;

		if (zoomN && zoom > zoomN) {
			tileSize = Math.round(map.getZoomScale(zoom) / map.getZoomScale(zoomN) * tileSize);
		}

		return tileSize;
	},

	_update: function () {

		if (!this._map) { return; }

		var map = this._map,
		    bounds = map.getPixelBounds(),
		    zoom = map.getZoom(),
		    tileSize = this._getTileSize();

		if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
			return;
		}

		var tileBounds = L.bounds(
		        bounds.min.divideBy(tileSize)._floor(),
		        bounds.max.divideBy(tileSize)._floor());

		this._addTilesFromCenterOut(tileBounds);

		if (this.options.unloadInvisibleTiles || this.options.reuseTiles) {
			this._removeOtherTiles(tileBounds);
		}
	},

	_addTilesFromCenterOut: function (bounds) {
		var queue = [],
		    center = bounds.getCenter();

		var j, i, point;

		for (j = bounds.min.y; j <= bounds.max.y; j++) {
			for (i = bounds.min.x; i <= bounds.max.x; i++) {
				point = new L.Point(i, j);

				if (this._tileShouldBeLoaded(point)) {
					queue.push(point);
				}
			}
		}

		var tilesToLoad = queue.length;

		if (tilesToLoad === 0) { return; }

		// load tiles in order of their distance to center
		queue.sort(function (a, b) {
			return a.distanceTo(center) - b.distanceTo(center);
		});

		var fragment = document.createDocumentFragment();

		// if its the first batch of tiles to load
		if (!this._tilesToLoad) {
			this.fire('loading');
		}

		this._tilesToLoad += tilesToLoad;

		for (i = 0; i < tilesToLoad; i++) {
			this._addTile(queue[i], fragment);
		}

		this._tileContainer.appendChild(fragment);
	},

	_tileShouldBeLoaded: function (tilePoint) {
		if ((tilePoint.x + ':' + tilePoint.y) in this._tiles) {
			return false; // already loaded
		}

		var options = this.options;

		if (!options.continuousWorld) {
			var limit = this._getWrapTileNum();

			// don't load if exceeds world bounds
			if ((options.noWrap && (tilePoint.x < 0 || tilePoint.x >= limit.x)) ||
				tilePoint.y < 0 || tilePoint.y >= limit.y) { return false; }
		}

		if (options.bounds) {
			var tileSize = options.tileSize,
			    nwPoint = tilePoint.multiplyBy(tileSize),
			    sePoint = nwPoint.add([tileSize, tileSize]),
			    nw = this._map.unproject(nwPoint),
			    se = this._map.unproject(sePoint);

			// TODO temporary hack, will be removed after refactoring projections
			// https://github.com/Leaflet/Leaflet/issues/1618
			if (!options.continuousWorld && !options.noWrap) {
				nw = nw.wrap();
				se = se.wrap();
			}

			if (!options.bounds.intersects([nw, se])) { return false; }
		}

		return true;
	},

	_removeOtherTiles: function (bounds) {
		var kArr, x, y, key;

		for (key in this._tiles) {
			kArr = key.split(':');
			x = parseInt(kArr[0], 10);
			y = parseInt(kArr[1], 10);

			// remove tile if it's out of bounds
			if (x < bounds.min.x || x > bounds.max.x || y < bounds.min.y || y > bounds.max.y) {
				this._removeTile(key);
			}
		}
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];

		this.fire('tileunload', {tile: tile, url: tile.src});

		if (this.options.reuseTiles) {
			L.DomUtil.removeClass(tile, 'leaflet-tile-loaded');
			this._unusedTiles.push(tile);

		} else if (tile.parentNode === this._tileContainer) {
			this._tileContainer.removeChild(tile);
		}

		// for https://github.com/CloudMade/Leaflet/issues/137
		if (!L.Browser.android) {
			tile.onload = null;
			tile.src = L.Util.emptyImageUrl;
		}

		delete this._tiles[key];
	},

	_addTile: function (tilePoint, container) {
		var tilePos = this._getTilePos(tilePoint);

		// get unused tile - or create a new tile
		var tile = this._getTile();

		/*
		Chrome 20 layouts much faster with top/left (verify with timeline, frames)
		Android 4 browser has display issues with top/left and requires transform instead
		(other browsers don't currently care) - see debug/hacks/jitter.html for an example
		*/
		L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome);

		this._tiles[tilePoint.x + ':' + tilePoint.y] = tile;

		this._loadTile(tile, tilePoint);

		if (tile.parentNode !== this._tileContainer) {
			container.appendChild(tile);
		}
	},

	_getZoomForUrl: function () {

		var options = this.options,
		    zoom = this._map.getZoom();

		if (options.zoomReverse) {
			zoom = options.maxZoom - zoom;
		}

		zoom += options.zoomOffset;

		return options.maxNativeZoom ? Math.min(zoom, options.maxNativeZoom) : zoom;
	},

	_getTilePos: function (tilePoint) {
		var origin = this._map.getPixelOrigin(),
		    tileSize = this._getTileSize();

		return tilePoint.multiplyBy(tileSize).subtract(origin);
	},

	// image-specific code (override to implement e.g. Canvas or SVG tile layer)

	getTileUrl: function (tilePoint) {
		return L.Util.template(this._url, L.extend({
			s: this._getSubdomain(tilePoint),
			z: tilePoint.z,
			x: tilePoint.x,
			y: tilePoint.y
		}, this.options));
	},

	_getWrapTileNum: function () {
		var crs = this._map.options.crs,
		    size = crs.getSize(this._map.getZoom());
		return size.divideBy(this._getTileSize())._floor();
	},

	_adjustTilePoint: function (tilePoint) {

		var limit = this._getWrapTileNum();

		// wrap tile coordinates
		if (!this.options.continuousWorld && !this.options.noWrap) {
			tilePoint.x = ((tilePoint.x % limit.x) + limit.x) % limit.x;
		}

		if (this.options.tms) {
			tilePoint.y = limit.y - tilePoint.y - 1;
		}

		tilePoint.z = this._getZoomForUrl();
	},

	_getSubdomain: function (tilePoint) {
		var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
		return this.options.subdomains[index];
	},

	_getTile: function () {
		if (this.options.reuseTiles && this._unusedTiles.length > 0) {
			var tile = this._unusedTiles.pop();
			this._resetTile(tile);
			return tile;
		}
		return this._createTile();
	},

	// Override if data stored on a tile needs to be cleaned up before reuse
	_resetTile: function (/*tile*/) {},

	_createTile: function () {
		var tile = L.DomUtil.create('img', 'leaflet-tile');
		tile.style.width = tile.style.height = this._getTileSize() + 'px';
		tile.galleryimg = 'no';

		tile.onselectstart = tile.onmousemove = L.Util.falseFn;

		if (L.Browser.ielt9 && this.options.opacity !== undefined) {
			L.DomUtil.setOpacity(tile, this.options.opacity);
		}
		// without this hack, tiles disappear after zoom on Chrome for Android
		// https://github.com/Leaflet/Leaflet/issues/2078
		if (L.Browser.mobileWebkit3d) {
			tile.style.WebkitBackfaceVisibility = 'hidden';
		}
		return tile;
	},

	_loadTile: function (tile, tilePoint) {
		tile._layer  = this;
		tile.onload  = this._tileOnLoad;
		tile.onerror = this._tileOnError;

		this._adjustTilePoint(tilePoint);
		tile.src     = this.getTileUrl(tilePoint);

		this.fire('tileloadstart', {
			tile: tile,
			url: tile.src
		});
	},

	_tileLoaded: function () {
		this._tilesToLoad--;

		if (this._animated) {
			L.DomUtil.addClass(this._tileContainer, 'leaflet-zoom-animated');
		}

		if (!this._tilesToLoad) {
			this.fire('load');

			if (this._animated) {
				// clear scaled tiles after all new tiles are loaded (for performance)
				clearTimeout(this._clearBgBufferTimer);
				this._clearBgBufferTimer = setTimeout(L.bind(this._clearBgBuffer, this), 500);
			}
		}
	},

	_tileOnLoad: function () {
		var layer = this._layer;

		//Only if we are loading an actual image
		if (this.src !== L.Util.emptyImageUrl) {
			L.DomUtil.addClass(this, 'leaflet-tile-loaded');

			layer.fire('tileload', {
				tile: this,
				url: this.src
			});
		}

		layer._tileLoaded();
	},

	_tileOnError: function () {
		var layer = this._layer;

		layer.fire('tileerror', {
			tile: this,
			url: this.src
		});

		var newUrl = layer.options.errorTileUrl;
		if (newUrl) {
			this.src = newUrl;
		}

		layer._tileLoaded();
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};


/*
 * L.TileLayer.WMS is used for putting WMS tile layers on the map.
 */

L.TileLayer.WMS = L.TileLayer.extend({

	defaultWmsParams: {
		service: 'WMS',
		request: 'GetMap',
		version: '1.1.1',
		layers: '',
		styles: '',
		format: 'image/jpeg',
		transparent: false
	},

	initialize: function (url, options) { // (String, Object)

		this._url = url;

		var wmsParams = L.extend({}, this.defaultWmsParams),
		    tileSize = options.tileSize || this.options.tileSize;

		if (options.detectRetina && L.Browser.retina) {
			wmsParams.width = wmsParams.height = tileSize * 2;
		} else {
			wmsParams.width = wmsParams.height = tileSize;
		}

		for (var i in options) {
			// all keys that are not TileLayer options go to WMS params
			if (!this.options.hasOwnProperty(i) && i !== 'crs') {
				wmsParams[i] = options[i];
			}
		}

		this.wmsParams = wmsParams;

		L.setOptions(this, options);
	},

	onAdd: function (map) {

		this._crs = this.options.crs || map.options.crs;

		this._wmsVersion = parseFloat(this.wmsParams.version);

		var projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
		this.wmsParams[projectionKey] = this._crs.code;

		L.TileLayer.prototype.onAdd.call(this, map);
	},

	getTileUrl: function (tilePoint) { // (Point, Number) -> String

		var map = this._map,
		    tileSize = this.options.tileSize,

		    nwPoint = tilePoint.multiplyBy(tileSize),
		    sePoint = nwPoint.add([tileSize, tileSize]),

		    nw = this._crs.project(map.unproject(nwPoint, tilePoint.z)),
		    se = this._crs.project(map.unproject(sePoint, tilePoint.z)),
		    bbox = this._wmsVersion >= 1.3 && this._crs === L.CRS.EPSG4326 ?
		        [se.y, nw.x, nw.y, se.x].join(',') :
		        [nw.x, se.y, se.x, nw.y].join(','),

		    url = L.Util.template(this._url, {s: this._getSubdomain(tilePoint)});

		return url + L.Util.getParamString(this.wmsParams, url, true) + '&BBOX=' + bbox;
	},

	setParams: function (params, noRedraw) {

		L.extend(this.wmsParams, params);

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	}
});

L.tileLayer.wms = function (url, options) {
	return new L.TileLayer.WMS(url, options);
};


/*
 * L.TileLayer.Canvas is a class that you can use as a base for creating
 * dynamically drawn Canvas-based tile layers.
 */

L.TileLayer.Canvas = L.TileLayer.extend({
	options: {
		async: false
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	redraw: function () {
		if (this._map) {
			this._reset({hard: true});
			this._update();
		}

		for (var i in this._tiles) {
			this._redrawTile(this._tiles[i]);
		}
		return this;
	},

	_redrawTile: function (tile) {
		this.drawTile(tile, tile._tilePoint, this._map._zoom);
	},

	_createTile: function () {
		var tile = L.DomUtil.create('canvas', 'leaflet-tile');
		tile.width = tile.height = this.options.tileSize;
		tile.onselectstart = tile.onmousemove = L.Util.falseFn;
		return tile;
	},

	_loadTile: function (tile, tilePoint) {
		tile._layer = this;
		tile._tilePoint = tilePoint;

		this._redrawTile(tile);

		if (!this.options.async) {
			this.tileDrawn(tile);
		}
	},

	drawTile: function (/*tile, tilePoint*/) {
		// override with rendering code
	},

	tileDrawn: function (tile) {
		this._tileOnLoad.call(tile);
	}
});


L.tileLayer.canvas = function (options) {
	return new L.TileLayer.Canvas(options);
};


/*
 * L.ImageOverlay is used to overlay images over the map (to specific geographical bounds).
 */

L.ImageOverlay = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		opacity: 1
	},

	initialize: function (url, bounds, options) { // (String, LatLngBounds, Object)
		this._url = url;
		this._bounds = L.latLngBounds(bounds);

		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._map = map;

		if (!this._image) {
			this._initImage();
		}

		map._panes.overlayPane.appendChild(this._image);

		map.on('viewreset', this._reset, this);

		if (map.options.zoomAnimation && L.Browser.any3d) {
			map.on('zoomanim', this._animateZoom, this);
		}

		this._reset();
	},

	onRemove: function (map) {
		map.getPanes().overlayPane.removeChild(this._image);

		map.off('viewreset', this._reset, this);

		if (map.options.zoomAnimation) {
			map.off('zoomanim', this._animateZoom, this);
		}
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	},

	// TODO remove bringToFront/bringToBack duplication from TileLayer/Path
	bringToFront: function () {
		if (this._image) {
			this._map._panes.overlayPane.appendChild(this._image);
		}
		return this;
	},

	bringToBack: function () {
		var pane = this._map._panes.overlayPane;
		if (this._image) {
			pane.insertBefore(this._image, pane.firstChild);
		}
		return this;
	},

	setUrl: function (url) {
		this._url = url;
		this._image.src = this._url;
	},

	getAttribution: function () {
		return this.options.attribution;
	},

	_initImage: function () {
		this._image = L.DomUtil.create('img', 'leaflet-image-layer');

		if (this._map.options.zoomAnimation && L.Browser.any3d) {
			L.DomUtil.addClass(this._image, 'leaflet-zoom-animated');
		} else {
			L.DomUtil.addClass(this._image, 'leaflet-zoom-hide');
		}

		this._updateOpacity();

		//TODO createImage util method to remove duplication
		L.extend(this._image, {
			galleryimg: 'no',
			onselectstart: L.Util.falseFn,
			onmousemove: L.Util.falseFn,
			onload: L.bind(this._onImageLoad, this),
			src: this._url
		});
	},

	_animateZoom: function (e) {
		var map = this._map,
		    image = this._image,
		    scale = map.getZoomScale(e.zoom),
		    nw = this._bounds.getNorthWest(),
		    se = this._bounds.getSouthEast(),

		    topLeft = map._latLngToNewLayerPoint(nw, e.zoom, e.center),
		    size = map._latLngToNewLayerPoint(se, e.zoom, e.center)._subtract(topLeft),
		    origin = topLeft._add(size._multiplyBy((1 / 2) * (1 - 1 / scale)));

		image.style[L.DomUtil.TRANSFORM] =
		        L.DomUtil.getTranslateString(origin) + ' scale(' + scale + ') ';
	},

	_reset: function () {
		var image   = this._image,
		    topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
		    size = this._map.latLngToLayerPoint(this._bounds.getSouthEast())._subtract(topLeft);

		L.DomUtil.setPosition(image, topLeft);

		image.style.width  = size.x + 'px';
		image.style.height = size.y + 'px';
	},

	_onImageLoad: function () {
		this.fire('load');
	},

	_updateOpacity: function () {
		L.DomUtil.setOpacity(this._image, this.options.opacity);
	}
});

L.imageOverlay = function (url, bounds, options) {
	return new L.ImageOverlay(url, bounds, options);
};


/*
 * L.Icon is an image-based icon class that you can use with L.Marker for custom markers.
 */

L.Icon = L.Class.extend({
	options: {
		/*
		iconUrl: (String) (required)
		iconRetinaUrl: (String) (optional, used for retina devices if detected)
		iconSize: (Point) (can be set through CSS)
		iconAnchor: (Point) (centered by default, can be set in CSS with negative margins)
		popupAnchor: (Point) (if not specified, popup opens in the anchor point)
		shadowUrl: (String) (no shadow by default)
		shadowRetinaUrl: (String) (optional, used for retina devices if detected)
		shadowSize: (Point)
		shadowAnchor: (Point)
		*/
		className: ''
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	createIcon: function (oldIcon) {
		return this._createIcon('icon', oldIcon);
	},

	createShadow: function (oldIcon) {
		return this._createIcon('shadow', oldIcon);
	},

	_createIcon: function (name, oldIcon) {
		var src = this._getIconUrl(name);

		if (!src) {
			if (name === 'icon') {
				throw new Error('iconUrl not set in Icon options (see the docs).');
			}
			return null;
		}

		var img;
		if (!oldIcon || oldIcon.tagName !== 'IMG') {
			img = this._createImg(src);
		} else {
			img = this._createImg(src, oldIcon);
		}
		this._setIconStyles(img, name);

		return img;
	},

	_setIconStyles: function (img, name) {
		var options = this.options,
		    size = L.point(options[name + 'Size']),
		    anchor;

		if (name === 'shadow') {
			anchor = L.point(options.shadowAnchor || options.iconAnchor);
		} else {
			anchor = L.point(options.iconAnchor);
		}

		if (!anchor && size) {
			anchor = size.divideBy(2, true);
		}

		img.className = 'leaflet-marker-' + name + ' ' + options.className;

		if (anchor) {
			img.style.marginLeft = (-anchor.x) + 'px';
			img.style.marginTop  = (-anchor.y) + 'px';
		}

		if (size) {
			img.style.width  = size.x + 'px';
			img.style.height = size.y + 'px';
		}
	},

	_createImg: function (src, el) {
		el = el || document.createElement('img');
		el.src = src;
		return el;
	},

	_getIconUrl: function (name) {
		if (L.Browser.retina && this.options[name + 'RetinaUrl']) {
			return this.options[name + 'RetinaUrl'];
		}
		return this.options[name + 'Url'];
	}
});

L.icon = function (options) {
	return new L.Icon(options);
};


/*
 * L.Icon.Default is the blue marker icon used by default in Leaflet.
 */

L.Icon.Default = L.Icon.extend({

	options: {
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],

		shadowSize: [41, 41]
	},

	_getIconUrl: function (name) {
		var key = name + 'Url';

		if (this.options[key]) {
			return this.options[key];
		}

		if (L.Browser.retina && name === 'icon') {
			name += '-2x';
		}

		var path = L.Icon.Default.imagePath;

		if (!path) {
			throw new Error('Couldn\'t autodetect L.Icon.Default.imagePath, set it manually.');
		}

		return path + '/marker-' + name + '.png';
	}
});

L.Icon.Default.imagePath = (function () {
	var scripts = document.getElementsByTagName('script'),
	    leafletRe = /[\/^]leaflet[\-\._]?([\w\-\._]*)\.js\??/;

	var i, len, src, matches, path;

	for (i = 0, len = scripts.length; i < len; i++) {
		src = scripts[i].src;
		matches = src.match(leafletRe);

		if (matches) {
			path = src.split(leafletRe)[0];
			return (path ? path + '/' : '') + 'images';
		}
	}
}());


/*
 * L.Marker is used to display clickable/draggable icons on the map.
 */

L.Marker = L.Class.extend({

	includes: L.Mixin.Events,

	options: {
		icon: new L.Icon.Default(),
		title: '',
		alt: '',
		clickable: true,
		draggable: false,
		keyboard: true,
		zIndexOffset: 0,
		opacity: 1,
		riseOnHover: false,
		riseOffset: 250
	},

	initialize: function (latlng, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
	},

	onAdd: function (map) {
		this._map = map;

		map.on('viewreset', this.update, this);

		this._initIcon();
		this.update();
		this.fire('add');

		if (map.options.zoomAnimation && map.options.markerZoomAnimation) {
			map.on('zoomanim', this._animateZoom, this);
		}
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
		if (this.dragging) {
			this.dragging.disable();
		}

		this._removeIcon();
		this._removeShadow();

		this.fire('remove');

		map.off({
			'viewreset': this.update,
			'zoomanim': this._animateZoom
		}, this);

		this._map = null;
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);

		this.update();

		return this.fire('move', { latlng: this._latlng });
	},

	setZIndexOffset: function (offset) {
		this.options.zIndexOffset = offset;
		this.update();

		return this;
	},

	setIcon: function (icon) {

		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		if (this._popup) {
			this.bindPopup(this._popup);
		}

		return this;
	},

	update: function () {
		if (this._icon) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}

		return this;
	},

	_initIcon: function () {
		var options = this.options,
		    map = this._map,
		    animation = (map.options.zoomAnimation && map.options.markerZoomAnimation),
		    classToAdd = animation ? 'leaflet-zoom-animated' : 'leaflet-zoom-hide';

		var icon = options.icon.createIcon(this._icon),
			addIcon = false;

		// if we're not reusing the icon, remove the old one and init new one
		if (icon !== this._icon) {
			if (this._icon) {
				this._removeIcon();
			}
			addIcon = true;

			if (options.title) {
				icon.title = options.title;
			}
			
			if (options.alt) {
				icon.alt = options.alt;
			}
		}

		L.DomUtil.addClass(icon, classToAdd);

		if (options.keyboard) {
			icon.tabIndex = '0';
		}

		this._icon = icon;

		this._initInteraction();

		if (options.riseOnHover) {
			L.DomEvent
				.on(icon, 'mouseover', this._bringToFront, this)
				.on(icon, 'mouseout', this._resetZIndex, this);
		}

		var newShadow = options.icon.createShadow(this._shadow),
			addShadow = false;

		if (newShadow !== this._shadow) {
			this._removeShadow();
			addShadow = true;
		}

		if (newShadow) {
			L.DomUtil.addClass(newShadow, classToAdd);
		}
		this._shadow = newShadow;


		if (options.opacity < 1) {
			this._updateOpacity();
		}


		var panes = this._map._panes;

		if (addIcon) {
			panes.markerPane.appendChild(this._icon);
		}

		if (newShadow && addShadow) {
			panes.shadowPane.appendChild(this._shadow);
		}
	},

	_removeIcon: function () {
		if (this.options.riseOnHover) {
			L.DomEvent
			    .off(this._icon, 'mouseover', this._bringToFront)
			    .off(this._icon, 'mouseout', this._resetZIndex);
		}

		this._map._panes.markerPane.removeChild(this._icon);

		this._icon = null;
	},

	_removeShadow: function () {
		if (this._shadow) {
			this._map._panes.shadowPane.removeChild(this._shadow);
		}
		this._shadow = null;
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._icon, pos);

		if (this._shadow) {
			L.DomUtil.setPosition(this._shadow, pos);
		}

		this._zIndex = pos.y + this.options.zIndexOffset;

		this._resetZIndex();
	},

	_updateZIndex: function (offset) {
		this._icon.style.zIndex = this._zIndex + offset;
	},

	_animateZoom: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

		this._setPos(pos);
	},

	_initInteraction: function () {

		if (!this.options.clickable) { return; }

		// TODO refactor into something shared with Map/Path/etc. to DRY it up

		var icon = this._icon,
		    events = ['dblclick', 'mousedown', 'mouseover', 'mouseout', 'contextmenu'];

		L.DomUtil.addClass(icon, 'leaflet-clickable');
		L.DomEvent.on(icon, 'click', this._onMouseClick, this);
		L.DomEvent.on(icon, 'keypress', this._onKeyPress, this);

		for (var i = 0; i < events.length; i++) {
			L.DomEvent.on(icon, events[i], this._fireMouseEvent, this);
		}

		if (L.Handler.MarkerDrag) {
			this.dragging = new L.Handler.MarkerDrag(this);

			if (this.options.draggable) {
				this.dragging.enable();
			}
		}
	},

	_onMouseClick: function (e) {
		var wasDragged = this.dragging && this.dragging.moved();

		if (this.hasEventListeners(e.type) || wasDragged) {
			L.DomEvent.stopPropagation(e);
		}

		if (wasDragged) { return; }

		if ((!this.dragging || !this.dragging._enabled) && this._map.dragging && this._map.dragging.moved()) { return; }

		this.fire(e.type, {
			originalEvent: e,
			latlng: this._latlng
		});
	},

	_onKeyPress: function (e) {
		if (e.keyCode === 13) {
			this.fire('click', {
				originalEvent: e,
				latlng: this._latlng
			});
		}
	},

	_fireMouseEvent: function (e) {

		this.fire(e.type, {
			originalEvent: e,
			latlng: this._latlng
		});

		// TODO proper custom event propagation
		// this line will always be called if marker is in a FeatureGroup
		if (e.type === 'contextmenu' && this.hasEventListeners(e.type)) {
			L.DomEvent.preventDefault(e);
		}
		if (e.type !== 'mousedown') {
			L.DomEvent.stopPropagation(e);
		} else {
			L.DomEvent.preventDefault(e);
		}
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	_updateOpacity: function () {
		L.DomUtil.setOpacity(this._icon, this.options.opacity);
		if (this._shadow) {
			L.DomUtil.setOpacity(this._shadow, this.options.opacity);
		}
	},

	_bringToFront: function () {
		this._updateZIndex(this.options.riseOffset);
	},

	_resetZIndex: function () {
		this._updateZIndex(0);
	}
});

L.marker = function (latlng, options) {
	return new L.Marker(latlng, options);
};


/*
 * L.DivIcon is a lightweight HTML-based icon class (as opposed to the image-based L.Icon)
 * to use with L.Marker.
 */

L.DivIcon = L.Icon.extend({
	options: {
		iconSize: [12, 12], // also can be set through CSS
		/*
		iconAnchor: (Point)
		popupAnchor: (Point)
		html: (String)
		bgPos: (Point)
		*/
		className: 'leaflet-div-icon',
		html: false
	},

	createIcon: function (oldIcon) {
		var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div'),
		    options = this.options;

		if (options.html !== false) {
			div.innerHTML = options.html;
		} else {
			div.innerHTML = '';
		}

		if (options.bgPos) {
			div.style.backgroundPosition =
			        (-options.bgPos.x) + 'px ' + (-options.bgPos.y) + 'px';
		}

		this._setIconStyles(div, 'icon');
		return div;
	},

	createShadow: function () {
		return null;
	}
});

L.divIcon = function (options) {
	return new L.DivIcon(options);
};


/*
 * L.Popup is used for displaying popups on the map.
 */

L.Map.mergeOptions({
	closePopupOnClick: true
});

L.Popup = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		minWidth: 50,
		maxWidth: 300,
		// maxHeight: null,
		autoPan: true,
		closeButton: true,
		offset: [0, 7],
		autoPanPadding: [5, 5],
		// autoPanPaddingTopLeft: null,
		// autoPanPaddingBottomRight: null,
		keepInView: false,
		className: '',
		zoomAnimation: true
	},

	initialize: function (options, source) {
		L.setOptions(this, options);

		this._source = source;
		this._animated = L.Browser.any3d && this.options.zoomAnimation;
		this._isOpen = false;
	},

	onAdd: function (map) {
		this._map = map;

		if (!this._container) {
			this._initLayout();
		}

		var animFade = map.options.fadeAnimation;

		if (animFade) {
			L.DomUtil.setOpacity(this._container, 0);
		}
		map._panes.popupPane.appendChild(this._container);

		map.on(this._getEvents(), this);

		this.update();

		if (animFade) {
			L.DomUtil.setOpacity(this._container, 1);
		}

		this.fire('open');

		map.fire('popupopen', {popup: this});

		if (this._source) {
			this._source.fire('popupopen', {popup: this});
		}
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	openOn: function (map) {
		map.openPopup(this);
		return this;
	},

	onRemove: function (map) {
		map._panes.popupPane.removeChild(this._container);

		L.Util.falseFn(this._container.offsetWidth); // force reflow

		map.off(this._getEvents(), this);

		if (map.options.fadeAnimation) {
			L.DomUtil.setOpacity(this._container, 0);
		}

		this._map = null;

		this.fire('close');

		map.fire('popupclose', {popup: this});

		if (this._source) {
			this._source.fire('popupclose', {popup: this});
		}
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);
		if (this._map) {
			this._updatePosition();
			this._adjustPan();
		}
		return this;
	},

	getContent: function () {
		return this._content;
	},

	setContent: function (content) {
		this._content = content;
		this.update();
		return this;
	},

	update: function () {
		if (!this._map) { return; }

		this._container.style.visibility = 'hidden';

		this._updateContent();
		this._updateLayout();
		this._updatePosition();

		this._container.style.visibility = '';

		this._adjustPan();
	},

	_getEvents: function () {
		var events = {
			viewreset: this._updatePosition
		};

		if (this._animated) {
			events.zoomanim = this._zoomAnimation;
		}
		if ('closeOnClick' in this.options ? this.options.closeOnClick : this._map.options.closePopupOnClick) {
			events.preclick = this._close;
		}
		if (this.options.keepInView) {
			events.moveend = this._adjustPan;
		}

		return events;
	},

	_close: function () {
		if (this._map) {
			this._map.closePopup(this);
		}
	},

	_initLayout: function () {
		var prefix = 'leaflet-popup',
			containerClass = prefix + ' ' + this.options.className + ' leaflet-zoom-' +
			        (this._animated ? 'animated' : 'hide'),
			container = this._container = L.DomUtil.create('div', containerClass),
			closeButton;

		if (this.options.closeButton) {
			closeButton = this._closeButton =
			        L.DomUtil.create('a', prefix + '-close-button', container);
			closeButton.href = '#close';
			closeButton.innerHTML = '&#215;';
			L.DomEvent.disableClickPropagation(closeButton);

			L.DomEvent.on(closeButton, 'click', this._onCloseButtonClick, this);
		}

		var wrapper = this._wrapper =
		        L.DomUtil.create('div', prefix + '-content-wrapper', container);
		L.DomEvent.disableClickPropagation(wrapper);

		this._contentNode = L.DomUtil.create('div', prefix + '-content', wrapper);

		L.DomEvent.disableScrollPropagation(this._contentNode);
		L.DomEvent.on(wrapper, 'contextmenu', L.DomEvent.stopPropagation);

		this._tipContainer = L.DomUtil.create('div', prefix + '-tip-container', container);
		this._tip = L.DomUtil.create('div', prefix + '-tip', this._tipContainer);
	},

	_updateContent: function () {
		if (!this._content) { return; }

		if (typeof this._content === 'string') {
			this._contentNode.innerHTML = this._content;
		} else {
			while (this._contentNode.hasChildNodes()) {
				this._contentNode.removeChild(this._contentNode.firstChild);
			}
			this._contentNode.appendChild(this._content);
		}
		this.fire('contentupdate');
	},

	_updateLayout: function () {
		var container = this._contentNode,
		    style = container.style;

		style.width = '';
		style.whiteSpace = 'nowrap';

		var width = container.offsetWidth;
		width = Math.min(width, this.options.maxWidth);
		width = Math.max(width, this.options.minWidth);

		style.width = (width + 1) + 'px';
		style.whiteSpace = '';

		style.height = '';

		var height = container.offsetHeight,
		    maxHeight = this.options.maxHeight,
		    scrolledClass = 'leaflet-popup-scrolled';

		if (maxHeight && height > maxHeight) {
			style.height = maxHeight + 'px';
			L.DomUtil.addClass(container, scrolledClass);
		} else {
			L.DomUtil.removeClass(container, scrolledClass);
		}

		this._containerWidth = this._container.offsetWidth;
	},

	_updatePosition: function () {
		if (!this._map) { return; }

		var pos = this._map.latLngToLayerPoint(this._latlng),
		    animated = this._animated,
		    offset = L.point(this.options.offset);

		if (animated) {
			L.DomUtil.setPosition(this._container, pos);
		}

		this._containerBottom = -offset.y - (animated ? 0 : pos.y);
		this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x + (animated ? 0 : pos.x);

		// bottom position the popup in case the height of the popup changes (images loading etc)
		this._container.style.bottom = this._containerBottom + 'px';
		this._container.style.left = this._containerLeft + 'px';
	},

	_zoomAnimation: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center);

		L.DomUtil.setPosition(this._container, pos);
	},

	_adjustPan: function () {
		if (!this.options.autoPan) { return; }

		var map = this._map,
		    containerHeight = this._container.offsetHeight,
		    containerWidth = this._containerWidth,

		    layerPos = new L.Point(this._containerLeft, -containerHeight - this._containerBottom);

		if (this._animated) {
			layerPos._add(L.DomUtil.getPosition(this._container));
		}

		var containerPos = map.layerPointToContainerPoint(layerPos),
		    padding = L.point(this.options.autoPanPadding),
		    paddingTL = L.point(this.options.autoPanPaddingTopLeft || padding),
		    paddingBR = L.point(this.options.autoPanPaddingBottomRight || padding),
		    size = map.getSize(),
		    dx = 0,
		    dy = 0;

		if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
			dx = containerPos.x + containerWidth - size.x + paddingBR.x;
		}
		if (containerPos.x - dx - paddingTL.x < 0) { // left
			dx = containerPos.x - paddingTL.x;
		}
		if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
			dy = containerPos.y + containerHeight - size.y + paddingBR.y;
		}
		if (containerPos.y - dy - paddingTL.y < 0) { // top
			dy = containerPos.y - paddingTL.y;
		}

		if (dx || dy) {
			map
			    .fire('autopanstart')
			    .panBy([dx, dy]);
		}
	},

	_onCloseButtonClick: function (e) {
		this._close();
		L.DomEvent.stop(e);
	}
});

L.popup = function (options, source) {
	return new L.Popup(options, source);
};


L.Map.include({
	openPopup: function (popup, latlng, options) { // (Popup) or (String || HTMLElement, LatLng[, Object])
		this.closePopup();

		if (!(popup instanceof L.Popup)) {
			var content = popup;

			popup = new L.Popup(options)
			    .setLatLng(latlng)
			    .setContent(content);
		}
		popup._isOpen = true;

		this._popup = popup;
		return this.addLayer(popup);
	},

	closePopup: function (popup) {
		if (!popup || popup === this._popup) {
			popup = this._popup;
			this._popup = null;
		}
		if (popup) {
			this.removeLayer(popup);
			popup._isOpen = false;
		}
		return this;
	}
});


/*
 * Popup extension to L.Marker, adding popup-related methods.
 */

L.Marker.include({
	openPopup: function () {
		if (this._popup && this._map && !this._map.hasLayer(this._popup)) {
			this._popup.setLatLng(this._latlng);
			this._map.openPopup(this._popup);
		}

		return this;
	},

	closePopup: function () {
		if (this._popup) {
			this._popup._close();
		}
		return this;
	},

	togglePopup: function () {
		if (this._popup) {
			if (this._popup._isOpen) {
				this.closePopup();
			} else {
				this.openPopup();
			}
		}
		return this;
	},

	bindPopup: function (content, options) {
		var anchor = L.point(this.options.icon.options.popupAnchor || [0, 0]);

		anchor = anchor.add(L.Popup.prototype.options.offset);

		if (options && options.offset) {
			anchor = anchor.add(options.offset);
		}

		options = L.extend({offset: anchor}, options);

		if (!this._popupHandlersAdded) {
			this
			    .on('click', this.togglePopup, this)
			    .on('remove', this.closePopup, this)
			    .on('move', this._movePopup, this);
			this._popupHandlersAdded = true;
		}

		if (content instanceof L.Popup) {
			L.setOptions(content, options);
			this._popup = content;
		} else {
			this._popup = new L.Popup(options, this)
				.setContent(content);
		}

		return this;
	},

	setPopupContent: function (content) {
		if (this._popup) {
			this._popup.setContent(content);
		}
		return this;
	},

	unbindPopup: function () {
		if (this._popup) {
			this._popup = null;
			this
			    .off('click', this.togglePopup, this)
			    .off('remove', this.closePopup, this)
			    .off('move', this._movePopup, this);
			this._popupHandlersAdded = false;
		}
		return this;
	},

	getPopup: function () {
		return this._popup;
	},

	_movePopup: function (e) {
		this._popup.setLatLng(e.latlng);
	}
});


/*
 * L.LayerGroup is a class to combine several layers into one so that
 * you can manipulate the group (e.g. add/remove it) as one layer.
 */

L.LayerGroup = L.Class.extend({
	initialize: function (layers) {
		this._layers = {};

		var i, len;

		if (layers) {
			for (i = 0, len = layers.length; i < len; i++) {
				this.addLayer(layers[i]);
			}
		}
	},

	addLayer: function (layer) {
		var id = this.getLayerId(layer);

		this._layers[id] = layer;

		if (this._map) {
			this._map.addLayer(layer);
		}

		return this;
	},

	removeLayer: function (layer) {
		var id = layer in this._layers ? layer : this.getLayerId(layer);

		if (this._map && this._layers[id]) {
			this._map.removeLayer(this._layers[id]);
		}

		delete this._layers[id];

		return this;
	},

	hasLayer: function (layer) {
		if (!layer) { return false; }

		return (layer in this._layers || this.getLayerId(layer) in this._layers);
	},

	clearLayers: function () {
		this.eachLayer(this.removeLayer, this);
		return this;
	},

	invoke: function (methodName) {
		var args = Array.prototype.slice.call(arguments, 1),
		    i, layer;

		for (i in this._layers) {
			layer = this._layers[i];

			if (layer[methodName]) {
				layer[methodName].apply(layer, args);
			}
		}

		return this;
	},

	onAdd: function (map) {
		this._map = map;
		this.eachLayer(map.addLayer, map);
	},

	onRemove: function (map) {
		this.eachLayer(map.removeLayer, map);
		this._map = null;
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	getLayer: function (id) {
		return this._layers[id];
	},

	getLayers: function () {
		var layers = [];

		for (var i in this._layers) {
			layers.push(this._layers[i]);
		}
		return layers;
	},

	setZIndex: function (zIndex) {
		return this.invoke('setZIndex', zIndex);
	},

	getLayerId: function (layer) {
		return L.stamp(layer);
	}
});

L.layerGroup = function (layers) {
	return new L.LayerGroup(layers);
};


/*
 * L.FeatureGroup extends L.LayerGroup by introducing mouse events and additional methods
 * shared between a group of interactive layers (like vectors or markers).
 */

L.FeatureGroup = L.LayerGroup.extend({
	includes: L.Mixin.Events,

	statics: {
		EVENTS: 'click dblclick mouseover mouseout mousemove contextmenu popupopen popupclose'
	},

	addLayer: function (layer) {
		if (this.hasLayer(layer)) {
			return this;
		}

		if ('on' in layer) {
			layer.on(L.FeatureGroup.EVENTS, this._propagateEvent, this);
		}

		L.LayerGroup.prototype.addLayer.call(this, layer);

		if (this._popupContent && layer.bindPopup) {
			layer.bindPopup(this._popupContent, this._popupOptions);
		}

		return this.fire('layeradd', {layer: layer});
	},

	removeLayer: function (layer) {
		if (!this.hasLayer(layer)) {
			return this;
		}
		if (layer in this._layers) {
			layer = this._layers[layer];
		}

		layer.off(L.FeatureGroup.EVENTS, this._propagateEvent, this);

		L.LayerGroup.prototype.removeLayer.call(this, layer);

		if (this._popupContent) {
			this.invoke('unbindPopup');
		}

		return this.fire('layerremove', {layer: layer});
	},

	bindPopup: function (content, options) {
		this._popupContent = content;
		this._popupOptions = options;
		return this.invoke('bindPopup', content, options);
	},

	openPopup: function (latlng) {
		// open popup on the first layer
		for (var id in this._layers) {
			this._layers[id].openPopup(latlng);
			break;
		}
		return this;
	},

	setStyle: function (style) {
		return this.invoke('setStyle', style);
	},

	bringToFront: function () {
		return this.invoke('bringToFront');
	},

	bringToBack: function () {
		return this.invoke('bringToBack');
	},

	getBounds: function () {
		var bounds = new L.LatLngBounds();

		this.eachLayer(function (layer) {
			bounds.extend(layer instanceof L.Marker ? layer.getLatLng() : layer.getBounds());
		});

		return bounds;
	},

	_propagateEvent: function (e) {
		e = L.extend({
			layer: e.target,
			target: this
		}, e);
		this.fire(e.type, e);
	}
});

L.featureGroup = function (layers) {
	return new L.FeatureGroup(layers);
};


/*
 * L.Path is a base class for rendering vector paths on a map. Inherited by Polyline, Circle, etc.
 */

L.Path = L.Class.extend({
	includes: [L.Mixin.Events],

	statics: {
		// how much to extend the clip area around the map view
		// (relative to its size, e.g. 0.5 is half the screen in each direction)
		// set it so that SVG element doesn't exceed 1280px (vectors flicker on dragend if it is)
		CLIP_PADDING: (function () {
			var max = L.Browser.mobile ? 1280 : 2000,
			    target = (max / Math.max(window.outerWidth, window.outerHeight) - 1) / 2;
			return Math.max(0, Math.min(0.5, target));
		})()
	},

	options: {
		stroke: true,
		color: '#0033ff',
		dashArray: null,
		lineCap: null,
		lineJoin: null,
		weight: 5,
		opacity: 0.5,

		fill: false,
		fillColor: null, //same as color by default
		fillOpacity: 0.2,

		clickable: true
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._map = map;

		if (!this._container) {
			this._initElements();
			this._initEvents();
		}

		this.projectLatlngs();
		this._updatePath();

		if (this._container) {
			this._map._pathRoot.appendChild(this._container);
		}

		this.fire('add');

		map.on({
			'viewreset': this.projectLatlngs,
			'moveend': this._updatePath
		}, this);
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
		map._pathRoot.removeChild(this._container);

		// Need to fire remove event before we set _map to null as the event hooks might need the object
		this.fire('remove');
		this._map = null;

		if (L.Browser.vml) {
			this._container = null;
			this._stroke = null;
			this._fill = null;
		}

		map.off({
			'viewreset': this.projectLatlngs,
			'moveend': this._updatePath
		}, this);
	},

	projectLatlngs: function () {
		// do all projection stuff here
	},

	setStyle: function (style) {
		L.setOptions(this, style);

		if (this._container) {
			this._updateStyle();
		}

		return this;
	},

	redraw: function () {
		if (this._map) {
			this.projectLatlngs();
			this._updatePath();
		}
		return this;
	}
});

L.Map.include({
	_updatePathViewport: function () {
		var p = L.Path.CLIP_PADDING,
		    size = this.getSize(),
		    panePos = L.DomUtil.getPosition(this._mapPane),
		    min = panePos.multiplyBy(-1)._subtract(size.multiplyBy(p)._round()),
		    max = min.add(size.multiplyBy(1 + p * 2)._round());

		this._pathViewport = new L.Bounds(min, max);
	}
});


/*
 * Extends L.Path with SVG-specific rendering code.
 */

L.Path.SVG_NS = 'http://www.w3.org/2000/svg';

L.Browser.svg = !!(document.createElementNS && document.createElementNS(L.Path.SVG_NS, 'svg').createSVGRect);

L.Path = L.Path.extend({
	statics: {
		SVG: L.Browser.svg
	},

	bringToFront: function () {
		var root = this._map._pathRoot,
		    path = this._container;

		if (path && root.lastChild !== path) {
			root.appendChild(path);
		}
		return this;
	},

	bringToBack: function () {
		var root = this._map._pathRoot,
		    path = this._container,
		    first = root.firstChild;

		if (path && first !== path) {
			root.insertBefore(path, first);
		}
		return this;
	},

	getPathString: function () {
		// form path string here
	},

	_createElement: function (name) {
		return document.createElementNS(L.Path.SVG_NS, name);
	},

	_initElements: function () {
		this._map._initPathRoot();
		this._initPath();
		this._initStyle();
	},

	_initPath: function () {
		this._container = this._createElement('g');

		this._path = this._createElement('path');

		if (this.options.className) {
			L.DomUtil.addClass(this._path, this.options.className);
		}

		this._container.appendChild(this._path);
	},

	_initStyle: function () {
		if (this.options.stroke) {
			this._path.setAttribute('stroke-linejoin', 'round');
			this._path.setAttribute('stroke-linecap', 'round');
		}
		if (this.options.fill) {
			this._path.setAttribute('fill-rule', 'evenodd');
		}
		if (this.options.pointerEvents) {
			this._path.setAttribute('pointer-events', this.options.pointerEvents);
		}
		if (!this.options.clickable && !this.options.pointerEvents) {
			this._path.setAttribute('pointer-events', 'none');
		}
		this._updateStyle();
	},

	_updateStyle: function () {
		if (this.options.stroke) {
			this._path.setAttribute('stroke', this.options.color);
			this._path.setAttribute('stroke-opacity', this.options.opacity);
			this._path.setAttribute('stroke-width', this.options.weight);
			if (this.options.dashArray) {
				this._path.setAttribute('stroke-dasharray', this.options.dashArray);
			} else {
				this._path.removeAttribute('stroke-dasharray');
			}
			if (this.options.lineCap) {
				this._path.setAttribute('stroke-linecap', this.options.lineCap);
			}
			if (this.options.lineJoin) {
				this._path.setAttribute('stroke-linejoin', this.options.lineJoin);
			}
		} else {
			this._path.setAttribute('stroke', 'none');
		}
		if (this.options.fill) {
			this._path.setAttribute('fill', this.options.fillColor || this.options.color);
			this._path.setAttribute('fill-opacity', this.options.fillOpacity);
		} else {
			this._path.setAttribute('fill', 'none');
		}
	},

	_updatePath: function () {
		var str = this.getPathString();
		if (!str) {
			// fix webkit empty string parsing bug
			str = 'M0 0';
		}
		this._path.setAttribute('d', str);
	},

	// TODO remove duplication with L.Map
	_initEvents: function () {
		if (this.options.clickable) {
			if (L.Browser.svg || !L.Browser.vml) {
				L.DomUtil.addClass(this._path, 'leaflet-clickable');
			}

			L.DomEvent.on(this._container, 'click', this._onMouseClick, this);

			var events = ['dblclick', 'mousedown', 'mouseover',
			              'mouseout', 'mousemove', 'contextmenu'];
			for (var i = 0; i < events.length; i++) {
				L.DomEvent.on(this._container, events[i], this._fireMouseEvent, this);
			}
		}
	},

	_onMouseClick: function (e) {
		if (this._map.dragging && this._map.dragging.moved()) { return; }

		this._fireMouseEvent(e);
	},

	_fireMouseEvent: function (e) {
		if (!this.hasEventListeners(e.type)) { return; }

		var map = this._map,
		    containerPoint = map.mouseEventToContainerPoint(e),
		    layerPoint = map.containerPointToLayerPoint(containerPoint),
		    latlng = map.layerPointToLatLng(layerPoint);

		this.fire(e.type, {
			latlng: latlng,
			layerPoint: layerPoint,
			containerPoint: containerPoint,
			originalEvent: e
		});

		if (e.type === 'contextmenu') {
			L.DomEvent.preventDefault(e);
		}
		if (e.type !== 'mousemove') {
			L.DomEvent.stopPropagation(e);
		}
	}
});

L.Map.include({
	_initPathRoot: function () {
		if (!this._pathRoot) {
			this._pathRoot = L.Path.prototype._createElement('svg');
			this._panes.overlayPane.appendChild(this._pathRoot);

			if (this.options.zoomAnimation && L.Browser.any3d) {
				L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-animated');

				this.on({
					'zoomanim': this._animatePathZoom,
					'zoomend': this._endPathZoom
				});
			} else {
				L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-hide');
			}

			this.on('moveend', this._updateSvgViewport);
			this._updateSvgViewport();
		}
	},

	_animatePathZoom: function (e) {
		var scale = this.getZoomScale(e.zoom),
		    offset = this._getCenterOffset(e.center)._multiplyBy(-scale)._add(this._pathViewport.min);

		this._pathRoot.style[L.DomUtil.TRANSFORM] =
		        L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ') ';

		this._pathZooming = true;
	},

	_endPathZoom: function () {
		this._pathZooming = false;
	},

	_updateSvgViewport: function () {

		if (this._pathZooming) {
			// Do not update SVGs while a zoom animation is going on otherwise the animation will break.
			// When the zoom animation ends we will be updated again anyway
			// This fixes the case where you do a momentum move and zoom while the move is still ongoing.
			return;
		}

		this._updatePathViewport();

		var vp = this._pathViewport,
		    min = vp.min,
		    max = vp.max,
		    width = max.x - min.x,
		    height = max.y - min.y,
		    root = this._pathRoot,
		    pane = this._panes.overlayPane;

		// Hack to make flicker on drag end on mobile webkit less irritating
		if (L.Browser.mobileWebkit) {
			pane.removeChild(root);
		}

		L.DomUtil.setPosition(root, min);
		root.setAttribute('width', width);
		root.setAttribute('height', height);
		root.setAttribute('viewBox', [min.x, min.y, width, height].join(' '));

		if (L.Browser.mobileWebkit) {
			pane.appendChild(root);
		}
	}
});


/*
 * Popup extension to L.Path (polylines, polygons, circles), adding popup-related methods.
 */

L.Path.include({

	bindPopup: function (content, options) {

		if (content instanceof L.Popup) {
			this._popup = content;
		} else {
			if (!this._popup || options) {
				this._popup = new L.Popup(options, this);
			}
			this._popup.setContent(content);
		}

		if (!this._popupHandlersAdded) {
			this
			    .on('click', this._openPopup, this)
			    .on('remove', this.closePopup, this);

			this._popupHandlersAdded = true;
		}

		return this;
	},

	unbindPopup: function () {
		if (this._popup) {
			this._popup = null;
			this
			    .off('click', this._openPopup)
			    .off('remove', this.closePopup);

			this._popupHandlersAdded = false;
		}
		return this;
	},

	openPopup: function (latlng) {

		if (this._popup) {
			// open the popup from one of the path's points if not specified
			latlng = latlng || this._latlng ||
			         this._latlngs[Math.floor(this._latlngs.length / 2)];

			this._openPopup({latlng: latlng});
		}

		return this;
	},

	closePopup: function () {
		if (this._popup) {
			this._popup._close();
		}
		return this;
	},

	_openPopup: function (e) {
		this._popup.setLatLng(e.latlng);
		this._map.openPopup(this._popup);
	}
});


/*
 * Vector rendering for IE6-8 through VML.
 * Thanks to Dmitry Baranovsky and his Raphael library for inspiration!
 */

L.Browser.vml = !L.Browser.svg && (function () {
	try {
		var div = document.createElement('div');
		div.innerHTML = '<v:shape adj="1"/>';

		var shape = div.firstChild;
		shape.style.behavior = 'url(#default#VML)';

		return shape && (typeof shape.adj === 'object');

	} catch (e) {
		return false;
	}
}());

L.Path = L.Browser.svg || !L.Browser.vml ? L.Path : L.Path.extend({
	statics: {
		VML: true,
		CLIP_PADDING: 0.02
	},

	_createElement: (function () {
		try {
			document.namespaces.add('lvml', 'urn:schemas-microsoft-com:vml');
			return function (name) {
				return document.createElement('<lvml:' + name + ' class="lvml">');
			};
		} catch (e) {
			return function (name) {
				return document.createElement(
				        '<' + name + ' xmlns="urn:schemas-microsoft.com:vml" class="lvml">');
			};
		}
	}()),

	_initPath: function () {
		var container = this._container = this._createElement('shape');

		L.DomUtil.addClass(container, 'leaflet-vml-shape' +
			(this.options.className ? ' ' + this.options.className : ''));

		if (this.options.clickable) {
			L.DomUtil.addClass(container, 'leaflet-clickable');
		}

		container.coordsize = '1 1';

		this._path = this._createElement('path');
		container.appendChild(this._path);

		this._map._pathRoot.appendChild(container);
	},

	_initStyle: function () {
		this._updateStyle();
	},

	_updateStyle: function () {
		var stroke = this._stroke,
		    fill = this._fill,
		    options = this.options,
		    container = this._container;

		container.stroked = options.stroke;
		container.filled = options.fill;

		if (options.stroke) {
			if (!stroke) {
				stroke = this._stroke = this._createElement('stroke');
				stroke.endcap = 'round';
				container.appendChild(stroke);
			}
			stroke.weight = options.weight + 'px';
			stroke.color = options.color;
			stroke.opacity = options.opacity;

			if (options.dashArray) {
				stroke.dashStyle = L.Util.isArray(options.dashArray) ?
				    options.dashArray.join(' ') :
				    options.dashArray.replace(/( *, *)/g, ' ');
			} else {
				stroke.dashStyle = '';
			}
			if (options.lineCap) {
				stroke.endcap = options.lineCap.replace('butt', 'flat');
			}
			if (options.lineJoin) {
				stroke.joinstyle = options.lineJoin;
			}

		} else if (stroke) {
			container.removeChild(stroke);
			this._stroke = null;
		}

		if (options.fill) {
			if (!fill) {
				fill = this._fill = this._createElement('fill');
				container.appendChild(fill);
			}
			fill.color = options.fillColor || options.color;
			fill.opacity = options.fillOpacity;

		} else if (fill) {
			container.removeChild(fill);
			this._fill = null;
		}
	},

	_updatePath: function () {
		var style = this._container.style;

		style.display = 'none';
		this._path.v = this.getPathString() + ' '; // the space fixes IE empty path string bug
		style.display = '';
	}
});

L.Map.include(L.Browser.svg || !L.Browser.vml ? {} : {
	_initPathRoot: function () {
		if (this._pathRoot) { return; }

		var root = this._pathRoot = document.createElement('div');
		root.className = 'leaflet-vml-container';
		this._panes.overlayPane.appendChild(root);

		this.on('moveend', this._updatePathViewport);
		this._updatePathViewport();
	}
});


/*
 * Vector rendering for all browsers that support canvas.
 */

L.Browser.canvas = (function () {
	return !!document.createElement('canvas').getContext;
}());

L.Path = (L.Path.SVG && !window.L_PREFER_CANVAS) || !L.Browser.canvas ? L.Path : L.Path.extend({
	statics: {
		//CLIP_PADDING: 0.02, // not sure if there's a need to set it to a small value
		CANVAS: true,
		SVG: false
	},

	redraw: function () {
		if (this._map) {
			this.projectLatlngs();
			this._requestUpdate();
		}
		return this;
	},

	setStyle: function (style) {
		L.setOptions(this, style);

		if (this._map) {
			this._updateStyle();
			this._requestUpdate();
		}
		return this;
	},

	onRemove: function (map) {
		map
		    .off('viewreset', this.projectLatlngs, this)
		    .off('moveend', this._updatePath, this);

		if (this.options.clickable) {
			this._map.off('click', this._onClick, this);
			this._map.off('mousemove', this._onMouseMove, this);
		}

		this._requestUpdate();
		
		this.fire('remove');
		this._map = null;
	},

	_requestUpdate: function () {
		if (this._map && !L.Path._updateRequest) {
			L.Path._updateRequest = L.Util.requestAnimFrame(this._fireMapMoveEnd, this._map);
		}
	},

	_fireMapMoveEnd: function () {
		L.Path._updateRequest = null;
		this.fire('moveend');
	},

	_initElements: function () {
		this._map._initPathRoot();
		this._ctx = this._map._canvasCtx;
	},

	_updateStyle: function () {
		var options = this.options;

		if (options.stroke) {
			this._ctx.lineWidth = options.weight;
			this._ctx.strokeStyle = options.color;
		}
		if (options.fill) {
			this._ctx.fillStyle = options.fillColor || options.color;
		}
	},

	_drawPath: function () {
		var i, j, len, len2, point, drawMethod;

		this._ctx.beginPath();

		for (i = 0, len = this._parts.length; i < len; i++) {
			for (j = 0, len2 = this._parts[i].length; j < len2; j++) {
				point = this._parts[i][j];
				drawMethod = (j === 0 ? 'move' : 'line') + 'To';

				this._ctx[drawMethod](point.x, point.y);
			}
			// TODO refactor ugly hack
			if (this instanceof L.Polygon) {
				this._ctx.closePath();
			}
		}
	},

	_checkIfEmpty: function () {
		return !this._parts.length;
	},

	_updatePath: function () {
		if (this._checkIfEmpty()) { return; }

		var ctx = this._ctx,
		    options = this.options;

		this._drawPath();
		ctx.save();
		this._updateStyle();

		if (options.fill) {
			ctx.globalAlpha = options.fillOpacity;
			ctx.fill();
		}

		if (options.stroke) {
			ctx.globalAlpha = options.opacity;
			ctx.stroke();
		}

		ctx.restore();

		// TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
	},

	_initEvents: function () {
		if (this.options.clickable) {
			// TODO dblclick
			this._map.on('mousemove', this._onMouseMove, this);
			this._map.on('click', this._onClick, this);
		}
	},

	_onClick: function (e) {
		if (this._containsPoint(e.layerPoint)) {
			this.fire('click', e);
		}
	},

	_onMouseMove: function (e) {
		if (!this._map || this._map._animatingZoom) { return; }

		// TODO don't do on each move
		if (this._containsPoint(e.layerPoint)) {
			this._ctx.canvas.style.cursor = 'pointer';
			this._mouseInside = true;
			this.fire('mouseover', e);

		} else if (this._mouseInside) {
			this._ctx.canvas.style.cursor = '';
			this._mouseInside = false;
			this.fire('mouseout', e);
		}
	}
});

L.Map.include((L.Path.SVG && !window.L_PREFER_CANVAS) || !L.Browser.canvas ? {} : {
	_initPathRoot: function () {
		var root = this._pathRoot,
		    ctx;

		if (!root) {
			root = this._pathRoot = document.createElement('canvas');
			root.style.position = 'absolute';
			ctx = this._canvasCtx = root.getContext('2d');

			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			this._panes.overlayPane.appendChild(root);

			if (this.options.zoomAnimation) {
				this._pathRoot.className = 'leaflet-zoom-animated';
				this.on('zoomanim', this._animatePathZoom);
				this.on('zoomend', this._endPathZoom);
			}
			this.on('moveend', this._updateCanvasViewport);
			this._updateCanvasViewport();
		}
	},

	_updateCanvasViewport: function () {
		// don't redraw while zooming. See _updateSvgViewport for more details
		if (this._pathZooming) { return; }
		this._updatePathViewport();

		var vp = this._pathViewport,
		    min = vp.min,
		    size = vp.max.subtract(min),
		    root = this._pathRoot;

		//TODO check if this works properly on mobile webkit
		L.DomUtil.setPosition(root, min);
		root.width = size.x;
		root.height = size.y;
		root.getContext('2d').translate(-min.x, -min.y);
	}
});


/*
 * L.LineUtil contains different utility functions for line segments
 * and polylines (clipping, simplification, distances, etc.)
 */

/*jshint bitwise:false */ // allow bitwise operations for this file

L.LineUtil = {

	// Simplify polyline with vertex reduction and Douglas-Peucker simplification.
	// Improves rendering performance dramatically by lessening the number of points to draw.

	simplify: function (/*Point[]*/ points, /*Number*/ tolerance) {
		if (!tolerance || !points.length) {
			return points.slice();
		}

		var sqTolerance = tolerance * tolerance;

		// stage 1: vertex reduction
		points = this._reducePoints(points, sqTolerance);

		// stage 2: Douglas-Peucker simplification
		points = this._simplifyDP(points, sqTolerance);

		return points;
	},

	// distance from a point to a segment between two points
	pointToSegmentDistance:  function (/*Point*/ p, /*Point*/ p1, /*Point*/ p2) {
		return Math.sqrt(this._sqClosestPointOnSegment(p, p1, p2, true));
	},

	closestPointOnSegment: function (/*Point*/ p, /*Point*/ p1, /*Point*/ p2) {
		return this._sqClosestPointOnSegment(p, p1, p2);
	},

	// Douglas-Peucker simplification, see http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm
	_simplifyDP: function (points, sqTolerance) {

		var len = points.length,
		    ArrayConstructor = typeof Uint8Array !== undefined + '' ? Uint8Array : Array,
		    markers = new ArrayConstructor(len);

		markers[0] = markers[len - 1] = 1;

		this._simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

		var i,
		    newPoints = [];

		for (i = 0; i < len; i++) {
			if (markers[i]) {
				newPoints.push(points[i]);
			}
		}

		return newPoints;
	},

	_simplifyDPStep: function (points, markers, sqTolerance, first, last) {

		var maxSqDist = 0,
		    index, i, sqDist;

		for (i = first + 1; i <= last - 1; i++) {
			sqDist = this._sqClosestPointOnSegment(points[i], points[first], points[last], true);

			if (sqDist > maxSqDist) {
				index = i;
				maxSqDist = sqDist;
			}
		}

		if (maxSqDist > sqTolerance) {
			markers[index] = 1;

			this._simplifyDPStep(points, markers, sqTolerance, first, index);
			this._simplifyDPStep(points, markers, sqTolerance, index, last);
		}
	},

	// reduce points that are too close to each other to a single point
	_reducePoints: function (points, sqTolerance) {
		var reducedPoints = [points[0]];

		for (var i = 1, prev = 0, len = points.length; i < len; i++) {
			if (this._sqDist(points[i], points[prev]) > sqTolerance) {
				reducedPoints.push(points[i]);
				prev = i;
			}
		}
		if (prev < len - 1) {
			reducedPoints.push(points[len - 1]);
		}
		return reducedPoints;
	},

	// Cohen-Sutherland line clipping algorithm.
	// Used to avoid rendering parts of a polyline that are not currently visible.

	clipSegment: function (a, b, bounds, useLastCode) {
		var codeA = useLastCode ? this._lastCode : this._getBitCode(a, bounds),
		    codeB = this._getBitCode(b, bounds),

		    codeOut, p, newCode;

		// save 2nd code to avoid calculating it on the next segment
		this._lastCode = codeB;

		while (true) {
			// if a,b is inside the clip window (trivial accept)
			if (!(codeA | codeB)) {
				return [a, b];
			// if a,b is outside the clip window (trivial reject)
			} else if (codeA & codeB) {
				return false;
			// other cases
			} else {
				codeOut = codeA || codeB;
				p = this._getEdgeIntersection(a, b, codeOut, bounds);
				newCode = this._getBitCode(p, bounds);

				if (codeOut === codeA) {
					a = p;
					codeA = newCode;
				} else {
					b = p;
					codeB = newCode;
				}
			}
		}
	},

	_getEdgeIntersection: function (a, b, code, bounds) {
		var dx = b.x - a.x,
		    dy = b.y - a.y,
		    min = bounds.min,
		    max = bounds.max;

		if (code & 8) { // top
			return new L.Point(a.x + dx * (max.y - a.y) / dy, max.y);
		} else if (code & 4) { // bottom
			return new L.Point(a.x + dx * (min.y - a.y) / dy, min.y);
		} else if (code & 2) { // right
			return new L.Point(max.x, a.y + dy * (max.x - a.x) / dx);
		} else if (code & 1) { // left
			return new L.Point(min.x, a.y + dy * (min.x - a.x) / dx);
		}
	},

	_getBitCode: function (/*Point*/ p, bounds) {
		var code = 0;

		if (p.x < bounds.min.x) { // left
			code |= 1;
		} else if (p.x > bounds.max.x) { // right
			code |= 2;
		}
		if (p.y < bounds.min.y) { // bottom
			code |= 4;
		} else if (p.y > bounds.max.y) { // top
			code |= 8;
		}

		return code;
	},

	// square distance (to avoid unnecessary Math.sqrt calls)
	_sqDist: function (p1, p2) {
		var dx = p2.x - p1.x,
		    dy = p2.y - p1.y;
		return dx * dx + dy * dy;
	},

	// return closest point on segment or distance to that point
	_sqClosestPointOnSegment: function (p, p1, p2, sqDist) {
		var x = p1.x,
		    y = p1.y,
		    dx = p2.x - x,
		    dy = p2.y - y,
		    dot = dx * dx + dy * dy,
		    t;

		if (dot > 0) {
			t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

			if (t > 1) {
				x = p2.x;
				y = p2.y;
			} else if (t > 0) {
				x += dx * t;
				y += dy * t;
			}
		}

		dx = p.x - x;
		dy = p.y - y;

		return sqDist ? dx * dx + dy * dy : new L.Point(x, y);
	}
};


/*
 * L.Polyline is used to display polylines on a map.
 */

L.Polyline = L.Path.extend({
	initialize: function (latlngs, options) {
		L.Path.prototype.initialize.call(this, options);

		this._latlngs = this._convertLatLngs(latlngs);
	},

	options: {
		// how much to simplify the polyline on each zoom level
		// more = better performance and smoother look, less = more accurate
		smoothFactor: 1.0,
		noClip: false
	},

	projectLatlngs: function () {
		this._originalPoints = [];

		for (var i = 0, len = this._latlngs.length; i < len; i++) {
			this._originalPoints[i] = this._map.latLngToLayerPoint(this._latlngs[i]);
		}
	},

	getPathString: function () {
		for (var i = 0, len = this._parts.length, str = ''; i < len; i++) {
			str += this._getPathPartStr(this._parts[i]);
		}
		return str;
	},

	getLatLngs: function () {
		return this._latlngs;
	},

	setLatLngs: function (latlngs) {
		this._latlngs = this._convertLatLngs(latlngs);
		return this.redraw();
	},

	addLatLng: function (latlng) {
		this._latlngs.push(L.latLng(latlng));
		return this.redraw();
	},

	spliceLatLngs: function () { // (Number index, Number howMany)
		var removed = [].splice.apply(this._latlngs, arguments);
		this._convertLatLngs(this._latlngs, true);
		this.redraw();
		return removed;
	},

	closestLayerPoint: function (p) {
		var minDistance = Infinity, parts = this._parts, p1, p2, minPoint = null;

		for (var j = 0, jLen = parts.length; j < jLen; j++) {
			var points = parts[j];
			for (var i = 1, len = points.length; i < len; i++) {
				p1 = points[i - 1];
				p2 = points[i];
				var sqDist = L.LineUtil._sqClosestPointOnSegment(p, p1, p2, true);
				if (sqDist < minDistance) {
					minDistance = sqDist;
					minPoint = L.LineUtil._sqClosestPointOnSegment(p, p1, p2);
				}
			}
		}
		if (minPoint) {
			minPoint.distance = Math.sqrt(minDistance);
		}
		return minPoint;
	},

	getBounds: function () {
		return new L.LatLngBounds(this.getLatLngs());
	},

	_convertLatLngs: function (latlngs, overwrite) {
		var i, len, target = overwrite ? latlngs : [];

		for (i = 0, len = latlngs.length; i < len; i++) {
			if (L.Util.isArray(latlngs[i]) && typeof latlngs[i][0] !== 'number') {
				return;
			}
			target[i] = L.latLng(latlngs[i]);
		}
		return target;
	},

	_initEvents: function () {
		L.Path.prototype._initEvents.call(this);
	},

	_getPathPartStr: function (points) {
		var round = L.Path.VML;

		for (var j = 0, len2 = points.length, str = '', p; j < len2; j++) {
			p = points[j];
			if (round) {
				p._round();
			}
			str += (j ? 'L' : 'M') + p.x + ' ' + p.y;
		}
		return str;
	},

	_clipPoints: function () {
		var points = this._originalPoints,
		    len = points.length,
		    i, k, segment;

		if (this.options.noClip) {
			this._parts = [points];
			return;
		}

		this._parts = [];

		var parts = this._parts,
		    vp = this._map._pathViewport,
		    lu = L.LineUtil;

		for (i = 0, k = 0; i < len - 1; i++) {
			segment = lu.clipSegment(points[i], points[i + 1], vp, i);
			if (!segment) {
				continue;
			}

			parts[k] = parts[k] || [];
			parts[k].push(segment[0]);

			// if segment goes out of screen, or it's the last one, it's the end of the line part
			if ((segment[1] !== points[i + 1]) || (i === len - 2)) {
				parts[k].push(segment[1]);
				k++;
			}
		}
	},

	// simplify each clipped part of the polyline
	_simplifyPoints: function () {
		var parts = this._parts,
		    lu = L.LineUtil;

		for (var i = 0, len = parts.length; i < len; i++) {
			parts[i] = lu.simplify(parts[i], this.options.smoothFactor);
		}
	},

	_updatePath: function () {
		if (!this._map) { return; }

		this._clipPoints();
		this._simplifyPoints();

		L.Path.prototype._updatePath.call(this);
	}
});

L.polyline = function (latlngs, options) {
	return new L.Polyline(latlngs, options);
};


/*
 * L.PolyUtil contains utility functions for polygons (clipping, etc.).
 */

/*jshint bitwise:false */ // allow bitwise operations here

L.PolyUtil = {};

/*
 * Sutherland-Hodgeman polygon clipping algorithm.
 * Used to avoid rendering parts of a polygon that are not currently visible.
 */
L.PolyUtil.clipPolygon = function (points, bounds) {
	var clippedPoints,
	    edges = [1, 4, 2, 8],
	    i, j, k,
	    a, b,
	    len, edge, p,
	    lu = L.LineUtil;

	for (i = 0, len = points.length; i < len; i++) {
		points[i]._code = lu._getBitCode(points[i], bounds);
	}

	// for each edge (left, bottom, right, top)
	for (k = 0; k < 4; k++) {
		edge = edges[k];
		clippedPoints = [];

		for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			a = points[i];
			b = points[j];

			// if a is inside the clip window
			if (!(a._code & edge)) {
				// if b is outside the clip window (a->b goes out of screen)
				if (b._code & edge) {
					p = lu._getEdgeIntersection(b, a, edge, bounds);
					p._code = lu._getBitCode(p, bounds);
					clippedPoints.push(p);
				}
				clippedPoints.push(a);

			// else if b is inside the clip window (a->b enters the screen)
			} else if (!(b._code & edge)) {
				p = lu._getEdgeIntersection(b, a, edge, bounds);
				p._code = lu._getBitCode(p, bounds);
				clippedPoints.push(p);
			}
		}
		points = clippedPoints;
	}

	return points;
};


/*
 * L.Polygon is used to display polygons on a map.
 */

L.Polygon = L.Polyline.extend({
	options: {
		fill: true
	},

	initialize: function (latlngs, options) {
		L.Polyline.prototype.initialize.call(this, latlngs, options);
		this._initWithHoles(latlngs);
	},

	_initWithHoles: function (latlngs) {
		var i, len, hole;
		if (latlngs && L.Util.isArray(latlngs[0]) && (typeof latlngs[0][0] !== 'number')) {
			this._latlngs = this._convertLatLngs(latlngs[0]);
			this._holes = latlngs.slice(1);

			for (i = 0, len = this._holes.length; i < len; i++) {
				hole = this._holes[i] = this._convertLatLngs(this._holes[i]);
				if (hole[0].equals(hole[hole.length - 1])) {
					hole.pop();
				}
			}
		}

		// filter out last point if its equal to the first one
		latlngs = this._latlngs;

		if (latlngs.length >= 2 && latlngs[0].equals(latlngs[latlngs.length - 1])) {
			latlngs.pop();
		}
	},

	projectLatlngs: function () {
		L.Polyline.prototype.projectLatlngs.call(this);

		// project polygon holes points
		// TODO move this logic to Polyline to get rid of duplication
		this._holePoints = [];

		if (!this._holes) { return; }

		var i, j, len, len2;

		for (i = 0, len = this._holes.length; i < len; i++) {
			this._holePoints[i] = [];

			for (j = 0, len2 = this._holes[i].length; j < len2; j++) {
				this._holePoints[i][j] = this._map.latLngToLayerPoint(this._holes[i][j]);
			}
		}
	},

	setLatLngs: function (latlngs) {
		if (latlngs && L.Util.isArray(latlngs[0]) && (typeof latlngs[0][0] !== 'number')) {
			this._initWithHoles(latlngs);
			return this.redraw();
		} else {
			return L.Polyline.prototype.setLatLngs.call(this, latlngs);
		}
	},

	_clipPoints: function () {
		var points = this._originalPoints,
		    newParts = [];

		this._parts = [points].concat(this._holePoints);

		if (this.options.noClip) { return; }

		for (var i = 0, len = this._parts.length; i < len; i++) {
			var clipped = L.PolyUtil.clipPolygon(this._parts[i], this._map._pathViewport);
			if (clipped.length) {
				newParts.push(clipped);
			}
		}

		this._parts = newParts;
	},

	_getPathPartStr: function (points) {
		var str = L.Polyline.prototype._getPathPartStr.call(this, points);
		return str + (L.Browser.svg ? 'z' : 'x');
	}
});

L.polygon = function (latlngs, options) {
	return new L.Polygon(latlngs, options);
};


/*
 * Contains L.MultiPolyline and L.MultiPolygon layers.
 */

(function () {
	function createMulti(Klass) {

		return L.FeatureGroup.extend({

			initialize: function (latlngs, options) {
				this._layers = {};
				this._options = options;
				this.setLatLngs(latlngs);
			},

			setLatLngs: function (latlngs) {
				var i = 0,
				    len = latlngs.length;

				this.eachLayer(function (layer) {
					if (i < len) {
						layer.setLatLngs(latlngs[i++]);
					} else {
						this.removeLayer(layer);
					}
				}, this);

				while (i < len) {
					this.addLayer(new Klass(latlngs[i++], this._options));
				}

				return this;
			},

			getLatLngs: function () {
				var latlngs = [];

				this.eachLayer(function (layer) {
					latlngs.push(layer.getLatLngs());
				});

				return latlngs;
			}
		});
	}

	L.MultiPolyline = createMulti(L.Polyline);
	L.MultiPolygon = createMulti(L.Polygon);

	L.multiPolyline = function (latlngs, options) {
		return new L.MultiPolyline(latlngs, options);
	};

	L.multiPolygon = function (latlngs, options) {
		return new L.MultiPolygon(latlngs, options);
	};
}());


/*
 * L.Rectangle extends Polygon and creates a rectangle when passed a LatLngBounds object.
 */

L.Rectangle = L.Polygon.extend({
	initialize: function (latLngBounds, options) {
		L.Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
	},

	setBounds: function (latLngBounds) {
		this.setLatLngs(this._boundsToLatLngs(latLngBounds));
	},

	_boundsToLatLngs: function (latLngBounds) {
		latLngBounds = L.latLngBounds(latLngBounds);
		return [
			latLngBounds.getSouthWest(),
			latLngBounds.getNorthWest(),
			latLngBounds.getNorthEast(),
			latLngBounds.getSouthEast()
		];
	}
});

L.rectangle = function (latLngBounds, options) {
	return new L.Rectangle(latLngBounds, options);
};


/*
 * L.Circle is a circle overlay (with a certain radius in meters).
 */

L.Circle = L.Path.extend({
	initialize: function (latlng, radius, options) {
		L.Path.prototype.initialize.call(this, options);

		this._latlng = L.latLng(latlng);
		this._mRadius = radius;
	},

	options: {
		fill: true
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);
		return this.redraw();
	},

	setRadius: function (radius) {
		this._mRadius = radius;
		return this.redraw();
	},

	projectLatlngs: function () {
		var lngRadius = this._getLngRadius(),
		    latlng = this._latlng,
		    pointLeft = this._map.latLngToLayerPoint([latlng.lat, latlng.lng - lngRadius]);

		this._point = this._map.latLngToLayerPoint(latlng);
		this._radius = Math.max(this._point.x - pointLeft.x, 1);
	},

	getBounds: function () {
		var lngRadius = this._getLngRadius(),
		    latRadius = (this._mRadius / 40075017) * 360,
		    latlng = this._latlng;

		return new L.LatLngBounds(
		        [latlng.lat - latRadius, latlng.lng - lngRadius],
		        [latlng.lat + latRadius, latlng.lng + lngRadius]);
	},

	getLatLng: function () {
		return this._latlng;
	},

	getPathString: function () {
		var p = this._point,
		    r = this._radius;

		if (this._checkIfEmpty()) {
			return '';
		}

		if (L.Browser.svg) {
			return 'M' + p.x + ',' + (p.y - r) +
			       'A' + r + ',' + r + ',0,1,1,' +
			       (p.x - 0.1) + ',' + (p.y - r) + ' z';
		} else {
			p._round();
			r = Math.round(r);
			return 'AL ' + p.x + ',' + p.y + ' ' + r + ',' + r + ' 0,' + (65535 * 360);
		}
	},

	getRadius: function () {
		return this._mRadius;
	},

	// TODO Earth hardcoded, move into projection code!

	_getLatRadius: function () {
		return (this._mRadius / 40075017) * 360;
	},

	_getLngRadius: function () {
		return this._getLatRadius() / Math.cos(L.LatLng.DEG_TO_RAD * this._latlng.lat);
	},

	_checkIfEmpty: function () {
		if (!this._map) {
			return false;
		}
		var vp = this._map._pathViewport,
		    r = this._radius,
		    p = this._point;

		return p.x - r > vp.max.x || p.y - r > vp.max.y ||
		       p.x + r < vp.min.x || p.y + r < vp.min.y;
	}
});

L.circle = function (latlng, radius, options) {
	return new L.Circle(latlng, radius, options);
};


/*
 * L.CircleMarker is a circle overlay with a permanent pixel radius.
 */

L.CircleMarker = L.Circle.extend({
	options: {
		radius: 10,
		weight: 2
	},

	initialize: function (latlng, options) {
		L.Circle.prototype.initialize.call(this, latlng, null, options);
		this._radius = this.options.radius;
	},

	projectLatlngs: function () {
		this._point = this._map.latLngToLayerPoint(this._latlng);
	},

	_updateStyle : function () {
		L.Circle.prototype._updateStyle.call(this);
		this.setRadius(this.options.radius);
	},

	setLatLng: function (latlng) {
		L.Circle.prototype.setLatLng.call(this, latlng);
		if (this._popup && this._popup._isOpen) {
			this._popup.setLatLng(latlng);
		}
		return this;
	},

	setRadius: function (radius) {
		this.options.radius = this._radius = radius;
		return this.redraw();
	},

	getRadius: function () {
		return this._radius;
	}
});

L.circleMarker = function (latlng, options) {
	return new L.CircleMarker(latlng, options);
};


/*
 * Extends L.Polyline to be able to manually detect clicks on Canvas-rendered polylines.
 */

L.Polyline.include(!L.Path.CANVAS ? {} : {
	_containsPoint: function (p, closed) {
		var i, j, k, len, len2, dist, part,
		    w = this.options.weight / 2;

		if (L.Browser.touch) {
			w += 10; // polyline click tolerance on touch devices
		}

		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];
			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				if (!closed && (j === 0)) {
					continue;
				}

				dist = L.LineUtil.pointToSegmentDistance(p, part[k], part[j]);

				if (dist <= w) {
					return true;
				}
			}
		}
		return false;
	}
});


/*
 * Extends L.Polygon to be able to manually detect clicks on Canvas-rendered polygons.
 */

L.Polygon.include(!L.Path.CANVAS ? {} : {
	_containsPoint: function (p) {
		var inside = false,
		    part, p1, p2,
		    i, j, k,
		    len, len2;

		// TODO optimization: check if within bounds first

		if (L.Polyline.prototype._containsPoint.call(this, p, true)) {
			// click on polygon border
			return true;
		}

		// ray casting algorithm for detecting if point is in polygon

		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];

			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				p1 = part[j];
				p2 = part[k];

				if (((p1.y > p.y) !== (p2.y > p.y)) &&
						(p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
					inside = !inside;
				}
			}
		}

		return inside;
	}
});


/*
 * Extends L.Circle with Canvas-specific code.
 */

L.Circle.include(!L.Path.CANVAS ? {} : {
	_drawPath: function () {
		var p = this._point;
		this._ctx.beginPath();
		this._ctx.arc(p.x, p.y, this._radius, 0, Math.PI * 2, false);
	},

	_containsPoint: function (p) {
		var center = this._point,
		    w2 = this.options.stroke ? this.options.weight / 2 : 0;

		return (p.distanceTo(center) <= this._radius + w2);
	}
});


/*
 * CircleMarker canvas specific drawing parts.
 */

L.CircleMarker.include(!L.Path.CANVAS ? {} : {
	_updateStyle: function () {
		L.Path.prototype._updateStyle.call(this);
	}
});


/*
 * L.GeoJSON turns any GeoJSON data into a Leaflet layer.
 */

L.GeoJSON = L.FeatureGroup.extend({

	initialize: function (geojson, options) {
		L.setOptions(this, options);

		this._layers = {};

		if (geojson) {
			this.addData(geojson);
		}
	},

	addData: function (geojson) {
		var features = L.Util.isArray(geojson) ? geojson : geojson.features,
		    i, len, feature;

		if (features) {
			for (i = 0, len = features.length; i < len; i++) {
				// Only add this if geometry or geometries are set and not null
				feature = features[i];
				if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
					this.addData(features[i]);
				}
			}
			return this;
		}

		var options = this.options;

		if (options.filter && !options.filter(geojson)) { return; }

		var layer = L.GeoJSON.geometryToLayer(geojson, options.pointToLayer, options.coordsToLatLng, options);
		layer.feature = L.GeoJSON.asFeature(geojson);

		layer.defaultOptions = layer.options;
		this.resetStyle(layer);

		if (options.onEachFeature) {
			options.onEachFeature(geojson, layer);
		}

		return this.addLayer(layer);
	},

	resetStyle: function (layer) {
		var style = this.options.style;
		if (style) {
			// reset any custom styles
			L.Util.extend(layer.options, layer.defaultOptions);

			this._setLayerStyle(layer, style);
		}
	},

	setStyle: function (style) {
		this.eachLayer(function (layer) {
			this._setLayerStyle(layer, style);
		}, this);
	},

	_setLayerStyle: function (layer, style) {
		if (typeof style === 'function') {
			style = style(layer.feature);
		}
		if (layer.setStyle) {
			layer.setStyle(style);
		}
	}
});

L.extend(L.GeoJSON, {
	geometryToLayer: function (geojson, pointToLayer, coordsToLatLng, vectorOptions) {
		var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
		    coords = geometry.coordinates,
		    layers = [],
		    latlng, latlngs, i, len;

		coordsToLatLng = coordsToLatLng || this.coordsToLatLng;

		switch (geometry.type) {
		case 'Point':
			latlng = coordsToLatLng(coords);
			return pointToLayer ? pointToLayer(geojson, latlng) : new L.Marker(latlng);

		case 'MultiPoint':
			for (i = 0, len = coords.length; i < len; i++) {
				latlng = coordsToLatLng(coords[i]);
				layers.push(pointToLayer ? pointToLayer(geojson, latlng) : new L.Marker(latlng));
			}
			return new L.FeatureGroup(layers);

		case 'LineString':
			latlngs = this.coordsToLatLngs(coords, 0, coordsToLatLng);
			return new L.Polyline(latlngs, vectorOptions);

		case 'Polygon':
			if (coords.length === 2 && !coords[1].length) {
				throw new Error('Invalid GeoJSON object.');
			}
			latlngs = this.coordsToLatLngs(coords, 1, coordsToLatLng);
			return new L.Polygon(latlngs, vectorOptions);

		case 'MultiLineString':
			latlngs = this.coordsToLatLngs(coords, 1, coordsToLatLng);
			return new L.MultiPolyline(latlngs, vectorOptions);

		case 'MultiPolygon':
			latlngs = this.coordsToLatLngs(coords, 2, coordsToLatLng);
			return new L.MultiPolygon(latlngs, vectorOptions);

		case 'GeometryCollection':
			for (i = 0, len = geometry.geometries.length; i < len; i++) {

				layers.push(this.geometryToLayer({
					geometry: geometry.geometries[i],
					type: 'Feature',
					properties: geojson.properties
				}, pointToLayer, coordsToLatLng, vectorOptions));
			}
			return new L.FeatureGroup(layers);

		default:
			throw new Error('Invalid GeoJSON object.');
		}
	},

	coordsToLatLng: function (coords) { // (Array[, Boolean]) -> LatLng
		return new L.LatLng(coords[1], coords[0], coords[2]);
	},

	coordsToLatLngs: function (coords, levelsDeep, coordsToLatLng) { // (Array[, Number, Function]) -> Array
		var latlng, i, len,
		    latlngs = [];

		for (i = 0, len = coords.length; i < len; i++) {
			latlng = levelsDeep ?
			        this.coordsToLatLngs(coords[i], levelsDeep - 1, coordsToLatLng) :
			        (coordsToLatLng || this.coordsToLatLng)(coords[i]);

			latlngs.push(latlng);
		}

		return latlngs;
	},

	latLngToCoords: function (latlng) {
		var coords = [latlng.lng, latlng.lat];

		if (latlng.alt !== undefined) {
			coords.push(latlng.alt);
		}
		return coords;
	},

	latLngsToCoords: function (latLngs) {
		var coords = [];

		for (var i = 0, len = latLngs.length; i < len; i++) {
			coords.push(L.GeoJSON.latLngToCoords(latLngs[i]));
		}

		return coords;
	},

	getFeature: function (layer, newGeometry) {
		return layer.feature ? L.extend({}, layer.feature, {geometry: newGeometry}) : L.GeoJSON.asFeature(newGeometry);
	},

	asFeature: function (geoJSON) {
		if (geoJSON.type === 'Feature') {
			return geoJSON;
		}

		return {
			type: 'Feature',
			properties: {},
			geometry: geoJSON
		};
	}
});

var PointToGeoJSON = {
	toGeoJSON: function () {
		return L.GeoJSON.getFeature(this, {
			type: 'Point',
			coordinates: L.GeoJSON.latLngToCoords(this.getLatLng())
		});
	}
};

L.Marker.include(PointToGeoJSON);
L.Circle.include(PointToGeoJSON);
L.CircleMarker.include(PointToGeoJSON);

L.Polyline.include({
	toGeoJSON: function () {
		return L.GeoJSON.getFeature(this, {
			type: 'LineString',
			coordinates: L.GeoJSON.latLngsToCoords(this.getLatLngs())
		});
	}
});

L.Polygon.include({
	toGeoJSON: function () {
		var coords = [L.GeoJSON.latLngsToCoords(this.getLatLngs())],
		    i, len, hole;

		coords[0].push(coords[0][0]);

		if (this._holes) {
			for (i = 0, len = this._holes.length; i < len; i++) {
				hole = L.GeoJSON.latLngsToCoords(this._holes[i]);
				hole.push(hole[0]);
				coords.push(hole);
			}
		}

		return L.GeoJSON.getFeature(this, {
			type: 'Polygon',
			coordinates: coords
		});
	}
});

(function () {
	function multiToGeoJSON(type) {
		return function () {
			var coords = [];

			this.eachLayer(function (layer) {
				coords.push(layer.toGeoJSON().geometry.coordinates);
			});

			return L.GeoJSON.getFeature(this, {
				type: type,
				coordinates: coords
			});
		};
	}

	L.MultiPolyline.include({toGeoJSON: multiToGeoJSON('MultiLineString')});
	L.MultiPolygon.include({toGeoJSON: multiToGeoJSON('MultiPolygon')});

	L.LayerGroup.include({
		toGeoJSON: function () {

			var geometry = this.feature && this.feature.geometry,
				jsons = [],
				json;

			if (geometry && geometry.type === 'MultiPoint') {
				return multiToGeoJSON('MultiPoint').call(this);
			}

			var isGeometryCollection = geometry && geometry.type === 'GeometryCollection';

			this.eachLayer(function (layer) {
				if (layer.toGeoJSON) {
					json = layer.toGeoJSON();
					jsons.push(isGeometryCollection ? json.geometry : L.GeoJSON.asFeature(json));
				}
			});

			if (isGeometryCollection) {
				return L.GeoJSON.getFeature(this, {
					geometries: jsons,
					type: 'GeometryCollection'
				});
			}

			return {
				type: 'FeatureCollection',
				features: jsons
			};
		}
	});
}());

L.geoJson = function (geojson, options) {
	return new L.GeoJSON(geojson, options);
};


/*
 * L.DomEvent contains functions for working with DOM events.
 */

L.DomEvent = {
	/* inspired by John Resig, Dean Edwards and YUI addEvent implementations */
	addListener: function (obj, type, fn, context) { // (HTMLElement, String, Function[, Object])

		var id = L.stamp(fn),
		    key = '_leaflet_' + type + id,
		    handler, originalHandler, newType;

		if (obj[key]) { return this; }

		handler = function (e) {
			return fn.call(context || obj, e || L.DomEvent._getEvent());
		};

		if (L.Browser.pointer && type.indexOf('touch') === 0) {
			return this.addPointerListener(obj, type, handler, id);
		}
		if (L.Browser.touch && (type === 'dblclick') && this.addDoubleTapListener) {
			this.addDoubleTapListener(obj, handler, id);
		}

		if ('addEventListener' in obj) {

			if (type === 'mousewheel') {
				obj.addEventListener('DOMMouseScroll', handler, false);
				obj.addEventListener(type, handler, false);

			} else if ((type === 'mouseenter') || (type === 'mouseleave')) {

				originalHandler = handler;
				newType = (type === 'mouseenter' ? 'mouseover' : 'mouseout');

				handler = function (e) {
					if (!L.DomEvent._checkMouse(obj, e)) { return; }
					return originalHandler(e);
				};

				obj.addEventListener(newType, handler, false);

			} else if (type === 'click' && L.Browser.android) {
				originalHandler = handler;
				handler = function (e) {
					return L.DomEvent._filterClick(e, originalHandler);
				};

				obj.addEventListener(type, handler, false);
			} else {
				obj.addEventListener(type, handler, false);
			}

		} else if ('attachEvent' in obj) {
			obj.attachEvent('on' + type, handler);
		}

		obj[key] = handler;

		return this;
	},

	removeListener: function (obj, type, fn) {  // (HTMLElement, String, Function)

		var id = L.stamp(fn),
		    key = '_leaflet_' + type + id,
		    handler = obj[key];

		if (!handler) { return this; }

		if (L.Browser.pointer && type.indexOf('touch') === 0) {
			this.removePointerListener(obj, type, id);
		} else if (L.Browser.touch && (type === 'dblclick') && this.removeDoubleTapListener) {
			this.removeDoubleTapListener(obj, id);

		} else if ('removeEventListener' in obj) {

			if (type === 'mousewheel') {
				obj.removeEventListener('DOMMouseScroll', handler, false);
				obj.removeEventListener(type, handler, false);

			} else if ((type === 'mouseenter') || (type === 'mouseleave')) {
				obj.removeEventListener((type === 'mouseenter' ? 'mouseover' : 'mouseout'), handler, false);
			} else {
				obj.removeEventListener(type, handler, false);
			}
		} else if ('detachEvent' in obj) {
			obj.detachEvent('on' + type, handler);
		}

		obj[key] = null;

		return this;
	},

	stopPropagation: function (e) {

		if (e.stopPropagation) {
			e.stopPropagation();
		} else {
			e.cancelBubble = true;
		}
		L.DomEvent._skipped(e);

		return this;
	},

	disableScrollPropagation: function (el) {
		var stop = L.DomEvent.stopPropagation;

		return L.DomEvent
			.on(el, 'mousewheel', stop)
			.on(el, 'MozMousePixelScroll', stop);
	},

	disableClickPropagation: function (el) {
		var stop = L.DomEvent.stopPropagation;

		for (var i = L.Draggable.START.length - 1; i >= 0; i--) {
			L.DomEvent.on(el, L.Draggable.START[i], stop);
		}

		return L.DomEvent
			.on(el, 'click', L.DomEvent._fakeStop)
			.on(el, 'dblclick', stop);
	},

	preventDefault: function (e) {

		if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
		return this;
	},

	stop: function (e) {
		return L.DomEvent
			.preventDefault(e)
			.stopPropagation(e);
	},

	getMousePosition: function (e, container) {
		if (!container) {
			return new L.Point(e.clientX, e.clientY);
		}

		var rect = container.getBoundingClientRect();

		return new L.Point(
			e.clientX - rect.left - container.clientLeft,
			e.clientY - rect.top - container.clientTop);
	},

	getWheelDelta: function (e) {

		var delta = 0;

		if (e.wheelDelta) {
			delta = e.wheelDelta / 120;
		}
		if (e.detail) {
			delta = -e.detail / 3;
		}
		return delta;
	},

	_skipEvents: {},

	_fakeStop: function (e) {
		// fakes stopPropagation by setting a special event flag, checked/reset with L.DomEvent._skipped(e)
		L.DomEvent._skipEvents[e.type] = true;
	},

	_skipped: function (e) {
		var skipped = this._skipEvents[e.type];
		// reset when checking, as it's only used in map container and propagates outside of the map
		this._skipEvents[e.type] = false;
		return skipped;
	},

	// check if element really left/entered the event target (for mouseenter/mouseleave)
	_checkMouse: function (el, e) {

		var related = e.relatedTarget;

		if (!related) { return true; }

		try {
			while (related && (related !== el)) {
				related = related.parentNode;
			}
		} catch (err) {
			return false;
		}
		return (related !== el);
	},

	_getEvent: function () { // evil magic for IE
		/*jshint noarg:false */
		var e = window.event;
		if (!e) {
			var caller = arguments.callee.caller;
			while (caller) {
				e = caller['arguments'][0];
				if (e && window.Event === e.constructor) {
					break;
				}
				caller = caller.caller;
			}
		}
		return e;
	},

	// this is a horrible workaround for a bug in Android where a single touch triggers two click events
	_filterClick: function (e, handler) {
		var timeStamp = (e.timeStamp || e.originalEvent.timeStamp),
			elapsed = L.DomEvent._lastClick && (timeStamp - L.DomEvent._lastClick);

		// are they closer together than 500ms yet more than 100ms?
		// Android typically triggers them ~300ms apart while multiple listeners
		// on the same event should be triggered far faster;
		// or check if click is simulated on the element, and if it is, reject any non-simulated events

		if ((elapsed && elapsed > 100 && elapsed < 500) || (e.target._simulatedClick && !e._simulated)) {
			L.DomEvent.stop(e);
			return;
		}
		L.DomEvent._lastClick = timeStamp;

		return handler(e);
	}
};

L.DomEvent.on = L.DomEvent.addListener;
L.DomEvent.off = L.DomEvent.removeListener;


/*
 * L.Draggable allows you to add dragging capabilities to any element. Supports mobile devices too.
 */

L.Draggable = L.Class.extend({
	includes: L.Mixin.Events,

	statics: {
		START: L.Browser.touch ? ['touchstart', 'mousedown'] : ['mousedown'],
		END: {
			mousedown: 'mouseup',
			touchstart: 'touchend',
			pointerdown: 'touchend',
			MSPointerDown: 'touchend'
		},
		MOVE: {
			mousedown: 'mousemove',
			touchstart: 'touchmove',
			pointerdown: 'touchmove',
			MSPointerDown: 'touchmove'
		}
	},

	initialize: function (element, dragStartTarget) {
		this._element = element;
		this._dragStartTarget = dragStartTarget || element;
	},

	enable: function () {
		if (this._enabled) { return; }

		for (var i = L.Draggable.START.length - 1; i >= 0; i--) {
			L.DomEvent.on(this._dragStartTarget, L.Draggable.START[i], this._onDown, this);
		}

		this._enabled = true;
	},

	disable: function () {
		if (!this._enabled) { return; }

		for (var i = L.Draggable.START.length - 1; i >= 0; i--) {
			L.DomEvent.off(this._dragStartTarget, L.Draggable.START[i], this._onDown, this);
		}

		this._enabled = false;
		this._moved = false;
	},

	_onDown: function (e) {
		this._moved = false;

		if (e.shiftKey || ((e.which !== 1) && (e.button !== 1) && !e.touches)) { return; }

		L.DomEvent.stopPropagation(e);

		if (L.Draggable._disabled) { return; }

		L.DomUtil.disableImageDrag();
		L.DomUtil.disableTextSelection();

		if (this._moving) { return; }

		var first = e.touches ? e.touches[0] : e;

		this._startPoint = new L.Point(first.clientX, first.clientY);
		this._startPos = this._newPos = L.DomUtil.getPosition(this._element);

		L.DomEvent
		    .on(document, L.Draggable.MOVE[e.type], this._onMove, this)
		    .on(document, L.Draggable.END[e.type], this._onUp, this);
	},

	_onMove: function (e) {
		if (e.touches && e.touches.length > 1) {
			this._moved = true;
			return;
		}

		var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
		    newPoint = new L.Point(first.clientX, first.clientY),
		    offset = newPoint.subtract(this._startPoint);

		if (!offset.x && !offset.y) { return; }
		if (L.Browser.touch && Math.abs(offset.x) + Math.abs(offset.y) < 3) { return; }

		L.DomEvent.preventDefault(e);

		if (!this._moved) {
			this.fire('dragstart');

			this._moved = true;
			this._startPos = L.DomUtil.getPosition(this._element).subtract(offset);

			L.DomUtil.addClass(document.body, 'leaflet-dragging');
			this._lastTarget = e.target || e.srcElement;
			L.DomUtil.addClass(this._lastTarget, 'leaflet-drag-target');
		}

		this._newPos = this._startPos.add(offset);
		this._moving = true;

		L.Util.cancelAnimFrame(this._animRequest);
		this._animRequest = L.Util.requestAnimFrame(this._updatePosition, this, true, this._dragStartTarget);
	},

	_updatePosition: function () {
		this.fire('predrag');
		L.DomUtil.setPosition(this._element, this._newPos);
		this.fire('drag');
	},

	_onUp: function () {
		L.DomUtil.removeClass(document.body, 'leaflet-dragging');

		if (this._lastTarget) {
			L.DomUtil.removeClass(this._lastTarget, 'leaflet-drag-target');
			this._lastTarget = null;
		}

		for (var i in L.Draggable.MOVE) {
			L.DomEvent
			    .off(document, L.Draggable.MOVE[i], this._onMove)
			    .off(document, L.Draggable.END[i], this._onUp);
		}

		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		if (this._moved && this._moving) {
			// ensure drag is not fired after dragend
			L.Util.cancelAnimFrame(this._animRequest);

			this.fire('dragend', {
				distance: this._newPos.distanceTo(this._startPos)
			});
		}

		this._moving = false;
	}
});


/*
	L.Handler is a base class for handler classes that are used internally to inject
	interaction features like dragging to classes like Map and Marker.
*/

L.Handler = L.Class.extend({
	initialize: function (map) {
		this._map = map;
	},

	enable: function () {
		if (this._enabled) { return; }

		this._enabled = true;
		this.addHooks();
	},

	disable: function () {
		if (!this._enabled) { return; }

		this._enabled = false;
		this.removeHooks();
	},

	enabled: function () {
		return !!this._enabled;
	}
});


/*
 * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
 */

L.Map.mergeOptions({
	dragging: true,

	inertia: !L.Browser.android23,
	inertiaDeceleration: 3400, // px/s^2
	inertiaMaxSpeed: Infinity, // px/s
	inertiaThreshold: L.Browser.touch ? 32 : 18, // ms
	easeLinearity: 0.25,

	// TODO refactor, move to CRS
	worldCopyJump: false
});

L.Map.Drag = L.Handler.extend({
	addHooks: function () {
		if (!this._draggable) {
			var map = this._map;

			this._draggable = new L.Draggable(map._mapPane, map._container);

			this._draggable.on({
				'dragstart': this._onDragStart,
				'drag': this._onDrag,
				'dragend': this._onDragEnd
			}, this);

			if (map.options.worldCopyJump) {
				this._draggable.on('predrag', this._onPreDrag, this);
				map.on('viewreset', this._onViewReset, this);

				map.whenReady(this._onViewReset, this);
			}
		}
		this._draggable.enable();
	},

	removeHooks: function () {
		this._draggable.disable();
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_onDragStart: function () {
		var map = this._map;

		if (map._panAnim) {
			map._panAnim.stop();
		}

		map
		    .fire('movestart')
		    .fire('dragstart');

		if (map.options.inertia) {
			this._positions = [];
			this._times = [];
		}
	},

	_onDrag: function () {
		if (this._map.options.inertia) {
			var time = this._lastTime = +new Date(),
			    pos = this._lastPos = this._draggable._newPos;

			this._positions.push(pos);
			this._times.push(time);

			if (time - this._times[0] > 200) {
				this._positions.shift();
				this._times.shift();
			}
		}

		this._map
		    .fire('move')
		    .fire('drag');
	},

	_onViewReset: function () {
		// TODO fix hardcoded Earth values
		var pxCenter = this._map.getSize()._divideBy(2),
		    pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);

		this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
		this._worldWidth = this._map.project([0, 180]).x;
	},

	_onPreDrag: function () {
		// TODO refactor to be able to adjust map pane position after zoom
		var worldWidth = this._worldWidth,
		    halfWidth = Math.round(worldWidth / 2),
		    dx = this._initialWorldOffset,
		    x = this._draggable._newPos.x,
		    newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
		    newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
		    newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

		this._draggable._newPos.x = newX;
	},

	_onDragEnd: function (e) {
		var map = this._map,
		    options = map.options,
		    delay = +new Date() - this._lastTime,

		    noInertia = !options.inertia || delay > options.inertiaThreshold || !this._positions[0];

		map.fire('dragend', e);

		if (noInertia) {
			map.fire('moveend');

		} else {

			var direction = this._lastPos.subtract(this._positions[0]),
			    duration = (this._lastTime + delay - this._times[0]) / 1000,
			    ease = options.easeLinearity,

			    speedVector = direction.multiplyBy(ease / duration),
			    speed = speedVector.distanceTo([0, 0]),

			    limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
			    limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),

			    decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease),
			    offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

			if (!offset.x || !offset.y) {
				map.fire('moveend');

			} else {
				offset = map._limitOffset(offset, map.options.maxBounds);

				L.Util.requestAnimFrame(function () {
					map.panBy(offset, {
						duration: decelerationDuration,
						easeLinearity: ease,
						noMoveStart: true
					});
				});
			}
		}
	}
});

L.Map.addInitHook('addHandler', 'dragging', L.Map.Drag);


/*
 * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
 */

L.Map.mergeOptions({
	doubleClickZoom: true
});

L.Map.DoubleClickZoom = L.Handler.extend({
	addHooks: function () {
		this._map.on('dblclick', this._onDoubleClick, this);
	},

	removeHooks: function () {
		this._map.off('dblclick', this._onDoubleClick, this);
	},

	_onDoubleClick: function (e) {
		var map = this._map,
		    zoom = map.getZoom() + (e.originalEvent.shiftKey ? -1 : 1);

		if (map.options.doubleClickZoom === 'center') {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}
});

L.Map.addInitHook('addHandler', 'doubleClickZoom', L.Map.DoubleClickZoom);


/*
 * L.Handler.ScrollWheelZoom is used by L.Map to enable mouse scroll wheel zoom on the map.
 */

L.Map.mergeOptions({
	scrollWheelZoom: true
});

L.Map.ScrollWheelZoom = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, 'mousewheel', this._onWheelScroll, this);
		L.DomEvent.on(this._map._container, 'MozMousePixelScroll', L.DomEvent.preventDefault);
		this._delta = 0;
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, 'mousewheel', this._onWheelScroll);
		L.DomEvent.off(this._map._container, 'MozMousePixelScroll', L.DomEvent.preventDefault);
	},

	_onWheelScroll: function (e) {
		var delta = L.DomEvent.getWheelDelta(e);

		this._delta += delta;
		this._lastMousePos = this._map.mouseEventToContainerPoint(e);

		if (!this._startTime) {
			this._startTime = +new Date();
		}

		var left = Math.max(40 - (+new Date() - this._startTime), 0);

		clearTimeout(this._timer);
		this._timer = setTimeout(L.bind(this._performZoom, this), left);

		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
	},

	_performZoom: function () {
		var map = this._map,
		    delta = this._delta,
		    zoom = map.getZoom();

		delta = delta > 0 ? Math.ceil(delta) : Math.floor(delta);
		delta = Math.max(Math.min(delta, 4), -4);
		delta = map._limitZoom(zoom + delta) - zoom;

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }

		if (map.options.scrollWheelZoom === 'center') {
			map.setZoom(zoom + delta);
		} else {
			map.setZoomAround(this._lastMousePos, zoom + delta);
		}
	}
});

L.Map.addInitHook('addHandler', 'scrollWheelZoom', L.Map.ScrollWheelZoom);


/*
 * Extends the event handling code with double tap support for mobile browsers.
 */

L.extend(L.DomEvent, {

	_touchstart: L.Browser.msPointer ? 'MSPointerDown' : L.Browser.pointer ? 'pointerdown' : 'touchstart',
	_touchend: L.Browser.msPointer ? 'MSPointerUp' : L.Browser.pointer ? 'pointerup' : 'touchend',

	// inspired by Zepto touch code by Thomas Fuchs
	addDoubleTapListener: function (obj, handler, id) {
		var last,
		    doubleTap = false,
		    delay = 250,
		    touch,
		    pre = '_leaflet_',
		    touchstart = this._touchstart,
		    touchend = this._touchend,
		    trackedTouches = [];

		function onTouchStart(e) {
			var count;

			if (L.Browser.pointer) {
				trackedTouches.push(e.pointerId);
				count = trackedTouches.length;
			} else {
				count = e.touches.length;
			}
			if (count > 1) {
				return;
			}

			var now = Date.now(),
				delta = now - (last || now);

			touch = e.touches ? e.touches[0] : e;
			doubleTap = (delta > 0 && delta <= delay);
			last = now;
		}

		function onTouchEnd(e) {
			if (L.Browser.pointer) {
				var idx = trackedTouches.indexOf(e.pointerId);
				if (idx === -1) {
					return;
				}
				trackedTouches.splice(idx, 1);
			}

			if (doubleTap) {
				if (L.Browser.pointer) {
					// work around .type being readonly with MSPointer* events
					var newTouch = { },
						prop;

					// jshint forin:false
					for (var i in touch) {
						prop = touch[i];
						if (typeof prop === 'function') {
							newTouch[i] = prop.bind(touch);
						} else {
							newTouch[i] = prop;
						}
					}
					touch = newTouch;
				}
				touch.type = 'dblclick';
				handler(touch);
				last = null;
			}
		}
		obj[pre + touchstart + id] = onTouchStart;
		obj[pre + touchend + id] = onTouchEnd;

		// on pointer we need to listen on the document, otherwise a drag starting on the map and moving off screen
		// will not come through to us, so we will lose track of how many touches are ongoing
		var endElement = L.Browser.pointer ? document.documentElement : obj;

		obj.addEventListener(touchstart, onTouchStart, false);
		endElement.addEventListener(touchend, onTouchEnd, false);

		if (L.Browser.pointer) {
			endElement.addEventListener(L.DomEvent.POINTER_CANCEL, onTouchEnd, false);
		}

		return this;
	},

	removeDoubleTapListener: function (obj, id) {
		var pre = '_leaflet_';

		obj.removeEventListener(this._touchstart, obj[pre + this._touchstart + id], false);
		(L.Browser.pointer ? document.documentElement : obj).removeEventListener(
		        this._touchend, obj[pre + this._touchend + id], false);

		if (L.Browser.pointer) {
			document.documentElement.removeEventListener(L.DomEvent.POINTER_CANCEL, obj[pre + this._touchend + id],
				false);
		}

		return this;
	}
});


/*
 * Extends L.DomEvent to provide touch support for Internet Explorer and Windows-based devices.
 */

L.extend(L.DomEvent, {

	//static
	POINTER_DOWN: L.Browser.msPointer ? 'MSPointerDown' : 'pointerdown',
	POINTER_MOVE: L.Browser.msPointer ? 'MSPointerMove' : 'pointermove',
	POINTER_UP: L.Browser.msPointer ? 'MSPointerUp' : 'pointerup',
	POINTER_CANCEL: L.Browser.msPointer ? 'MSPointerCancel' : 'pointercancel',

	_pointers: [],
	_pointerDocumentListener: false,

	// Provides a touch events wrapper for (ms)pointer events.
	// Based on changes by veproza https://github.com/CloudMade/Leaflet/pull/1019
	//ref http://www.w3.org/TR/pointerevents/ https://www.w3.org/Bugs/Public/show_bug.cgi?id=22890

	addPointerListener: function (obj, type, handler, id) {

		switch (type) {
		case 'touchstart':
			return this.addPointerListenerStart(obj, type, handler, id);
		case 'touchend':
			return this.addPointerListenerEnd(obj, type, handler, id);
		case 'touchmove':
			return this.addPointerListenerMove(obj, type, handler, id);
		default:
			throw 'Unknown touch event type';
		}
	},

	addPointerListenerStart: function (obj, type, handler, id) {
		var pre = '_leaflet_',
		    pointers = this._pointers;

		var cb = function (e) {

			L.DomEvent.preventDefault(e);

			var alreadyInArray = false;
			for (var i = 0; i < pointers.length; i++) {
				if (pointers[i].pointerId === e.pointerId) {
					alreadyInArray = true;
					break;
				}
			}
			if (!alreadyInArray) {
				pointers.push(e);
			}

			e.touches = pointers.slice();
			e.changedTouches = [e];

			handler(e);
		};

		obj[pre + 'touchstart' + id] = cb;
		obj.addEventListener(this.POINTER_DOWN, cb, false);

		// need to also listen for end events to keep the _pointers list accurate
		// this needs to be on the body and never go away
		if (!this._pointerDocumentListener) {
			var internalCb = function (e) {
				for (var i = 0; i < pointers.length; i++) {
					if (pointers[i].pointerId === e.pointerId) {
						pointers.splice(i, 1);
						break;
					}
				}
			};
			//We listen on the documentElement as any drags that end by moving the touch off the screen get fired there
			document.documentElement.addEventListener(this.POINTER_UP, internalCb, false);
			document.documentElement.addEventListener(this.POINTER_CANCEL, internalCb, false);

			this._pointerDocumentListener = true;
		}

		return this;
	},

	addPointerListenerMove: function (obj, type, handler, id) {
		var pre = '_leaflet_',
		    touches = this._pointers;

		function cb(e) {

			// don't fire touch moves when mouse isn't down
			if ((e.pointerType === e.MSPOINTER_TYPE_MOUSE || e.pointerType === 'mouse') && e.buttons === 0) { return; }

			for (var i = 0; i < touches.length; i++) {
				if (touches[i].pointerId === e.pointerId) {
					touches[i] = e;
					break;
				}
			}

			e.touches = touches.slice();
			e.changedTouches = [e];

			handler(e);
		}

		obj[pre + 'touchmove' + id] = cb;
		obj.addEventListener(this.POINTER_MOVE, cb, false);

		return this;
	},

	addPointerListenerEnd: function (obj, type, handler, id) {
		var pre = '_leaflet_',
		    touches = this._pointers;

		var cb = function (e) {
			for (var i = 0; i < touches.length; i++) {
				if (touches[i].pointerId === e.pointerId) {
					touches.splice(i, 1);
					break;
				}
			}

			e.touches = touches.slice();
			e.changedTouches = [e];

			handler(e);
		};

		obj[pre + 'touchend' + id] = cb;
		obj.addEventListener(this.POINTER_UP, cb, false);
		obj.addEventListener(this.POINTER_CANCEL, cb, false);

		return this;
	},

	removePointerListener: function (obj, type, id) {
		var pre = '_leaflet_',
		    cb = obj[pre + type + id];

		switch (type) {
		case 'touchstart':
			obj.removeEventListener(this.POINTER_DOWN, cb, false);
			break;
		case 'touchmove':
			obj.removeEventListener(this.POINTER_MOVE, cb, false);
			break;
		case 'touchend':
			obj.removeEventListener(this.POINTER_UP, cb, false);
			obj.removeEventListener(this.POINTER_CANCEL, cb, false);
			break;
		}

		return this;
	}
});


/*
 * L.Handler.TouchZoom is used by L.Map to add pinch zoom on supported mobile browsers.
 */

L.Map.mergeOptions({
	touchZoom: L.Browser.touch && !L.Browser.android23,
	bounceAtZoomLimits: true
});

L.Map.TouchZoom = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	_onTouchStart: function (e) {
		var map = this._map;

		if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

		var p1 = map.mouseEventToLayerPoint(e.touches[0]),
		    p2 = map.mouseEventToLayerPoint(e.touches[1]),
		    viewCenter = map._getCenterLayerPoint();

		this._startCenter = p1.add(p2)._divideBy(2);
		this._startDist = p1.distanceTo(p2);

		this._moved = false;
		this._zooming = true;

		this._centerOffset = viewCenter.subtract(this._startCenter);

		if (map._panAnim) {
			map._panAnim.stop();
		}

		L.DomEvent
		    .on(document, 'touchmove', this._onTouchMove, this)
		    .on(document, 'touchend', this._onTouchEnd, this);

		L.DomEvent.preventDefault(e);
	},

	_onTouchMove: function (e) {
		var map = this._map;

		if (!e.touches || e.touches.length !== 2 || !this._zooming) { return; }

		var p1 = map.mouseEventToLayerPoint(e.touches[0]),
		    p2 = map.mouseEventToLayerPoint(e.touches[1]);

		this._scale = p1.distanceTo(p2) / this._startDist;
		this._delta = p1._add(p2)._divideBy(2)._subtract(this._startCenter);

		if (this._scale === 1) { return; }

		if (!map.options.bounceAtZoomLimits) {
			if ((map.getZoom() === map.getMinZoom() && this._scale < 1) ||
			    (map.getZoom() === map.getMaxZoom() && this._scale > 1)) { return; }
		}

		if (!this._moved) {
			L.DomUtil.addClass(map._mapPane, 'leaflet-touching');

			map
			    .fire('movestart')
			    .fire('zoomstart');

			this._moved = true;
		}

		L.Util.cancelAnimFrame(this._animRequest);
		this._animRequest = L.Util.requestAnimFrame(
		        this._updateOnMove, this, true, this._map._container);

		L.DomEvent.preventDefault(e);
	},

	_updateOnMove: function () {
		var map = this._map,
		    origin = this._getScaleOrigin(),
		    center = map.layerPointToLatLng(origin),
		    zoom = map.getScaleZoom(this._scale);

		map._animateZoom(center, zoom, this._startCenter, this._scale, this._delta, false, true);
	},

	_onTouchEnd: function () {
		if (!this._moved || !this._zooming) {
			this._zooming = false;
			return;
		}

		var map = this._map;

		this._zooming = false;
		L.DomUtil.removeClass(map._mapPane, 'leaflet-touching');
		L.Util.cancelAnimFrame(this._animRequest);

		L.DomEvent
		    .off(document, 'touchmove', this._onTouchMove)
		    .off(document, 'touchend', this._onTouchEnd);

		var origin = this._getScaleOrigin(),
		    center = map.layerPointToLatLng(origin),

		    oldZoom = map.getZoom(),
		    floatZoomDelta = map.getScaleZoom(this._scale) - oldZoom,
		    roundZoomDelta = (floatZoomDelta > 0 ?
		            Math.ceil(floatZoomDelta) : Math.floor(floatZoomDelta)),

		    zoom = map._limitZoom(oldZoom + roundZoomDelta),
		    scale = map.getZoomScale(zoom) / this._scale;

		map._animateZoom(center, zoom, origin, scale);
	},

	_getScaleOrigin: function () {
		var centerOffset = this._centerOffset.subtract(this._delta).divideBy(this._scale);
		return this._startCenter.add(centerOffset);
	}
});

L.Map.addInitHook('addHandler', 'touchZoom', L.Map.TouchZoom);


/*
 * L.Map.Tap is used to enable mobile hacks like quick taps and long hold.
 */

L.Map.mergeOptions({
	tap: true,
	tapTolerance: 15
});

L.Map.Tap = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, 'touchstart', this._onDown, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, 'touchstart', this._onDown, this);
	},

	_onDown: function (e) {
		if (!e.touches) { return; }

		L.DomEvent.preventDefault(e);

		this._fireClick = true;

		// don't simulate click or track longpress if more than 1 touch
		if (e.touches.length > 1) {
			this._fireClick = false;
			clearTimeout(this._holdTimeout);
			return;
		}

		var first = e.touches[0],
		    el = first.target;

		this._startPos = this._newPos = new L.Point(first.clientX, first.clientY);

		// if touching a link, highlight it
		if (el.tagName && el.tagName.toLowerCase() === 'a') {
			L.DomUtil.addClass(el, 'leaflet-active');
		}

		// simulate long hold but setting a timeout
		this._holdTimeout = setTimeout(L.bind(function () {
			if (this._isTapValid()) {
				this._fireClick = false;
				this._onUp();
				this._simulateEvent('contextmenu', first);
			}
		}, this), 1000);

		L.DomEvent
			.on(document, 'touchmove', this._onMove, this)
			.on(document, 'touchend', this._onUp, this);
	},

	_onUp: function (e) {
		clearTimeout(this._holdTimeout);

		L.DomEvent
			.off(document, 'touchmove', this._onMove, this)
			.off(document, 'touchend', this._onUp, this);

		if (this._fireClick && e && e.changedTouches) {

			var first = e.changedTouches[0],
			    el = first.target;

			if (el && el.tagName && el.tagName.toLowerCase() === 'a') {
				L.DomUtil.removeClass(el, 'leaflet-active');
			}

			// simulate click if the touch didn't move too much
			if (this._isTapValid()) {
				this._simulateEvent('click', first);
			}
		}
	},

	_isTapValid: function () {
		return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
	},

	_onMove: function (e) {
		var first = e.touches[0];
		this._newPos = new L.Point(first.clientX, first.clientY);
	},

	_simulateEvent: function (type, e) {
		var simulatedEvent = document.createEvent('MouseEvents');

		simulatedEvent._simulated = true;
		e.target._simulatedClick = true;

		simulatedEvent.initMouseEvent(
		        type, true, true, window, 1,
		        e.screenX, e.screenY,
		        e.clientX, e.clientY,
		        false, false, false, false, 0, null);

		e.target.dispatchEvent(simulatedEvent);
	}
});

if (L.Browser.touch && !L.Browser.pointer) {
	L.Map.addInitHook('addHandler', 'tap', L.Map.Tap);
}


/*
 * L.Handler.ShiftDragZoom is used to add shift-drag zoom interaction to the map
  * (zoom to a selected bounding box), enabled by default.
 */

L.Map.mergeOptions({
	boxZoom: true
});

L.Map.BoxZoom = L.Handler.extend({
	initialize: function (map) {
		this._map = map;
		this._container = map._container;
		this._pane = map._panes.overlayPane;
		this._moved = false;
	},

	addHooks: function () {
		L.DomEvent.on(this._container, 'mousedown', this._onMouseDown, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._container, 'mousedown', this._onMouseDown);
		this._moved = false;
	},

	moved: function () {
		return this._moved;
	},

	_onMouseDown: function (e) {
		this._moved = false;

		if (!e.shiftKey || ((e.which !== 1) && (e.button !== 1))) { return false; }

		L.DomUtil.disableTextSelection();
		L.DomUtil.disableImageDrag();

		this._startLayerPoint = this._map.mouseEventToLayerPoint(e);

		L.DomEvent
		    .on(document, 'mousemove', this._onMouseMove, this)
		    .on(document, 'mouseup', this._onMouseUp, this)
		    .on(document, 'keydown', this._onKeyDown, this);
	},

	_onMouseMove: function (e) {
		if (!this._moved) {
			this._box = L.DomUtil.create('div', 'leaflet-zoom-box', this._pane);
			L.DomUtil.setPosition(this._box, this._startLayerPoint);

			//TODO refactor: move cursor to styles
			this._container.style.cursor = 'crosshair';
			this._map.fire('boxzoomstart');
		}

		var startPoint = this._startLayerPoint,
		    box = this._box,

		    layerPoint = this._map.mouseEventToLayerPoint(e),
		    offset = layerPoint.subtract(startPoint),

		    newPos = new L.Point(
		        Math.min(layerPoint.x, startPoint.x),
		        Math.min(layerPoint.y, startPoint.y));

		L.DomUtil.setPosition(box, newPos);

		this._moved = true;

		// TODO refactor: remove hardcoded 4 pixels
		box.style.width  = (Math.max(0, Math.abs(offset.x) - 4)) + 'px';
		box.style.height = (Math.max(0, Math.abs(offset.y) - 4)) + 'px';
	},

	_finish: function () {
		if (this._moved) {
			this._pane.removeChild(this._box);
			this._container.style.cursor = '';
		}

		L.DomUtil.enableTextSelection();
		L.DomUtil.enableImageDrag();

		L.DomEvent
		    .off(document, 'mousemove', this._onMouseMove)
		    .off(document, 'mouseup', this._onMouseUp)
		    .off(document, 'keydown', this._onKeyDown);
	},

	_onMouseUp: function (e) {

		this._finish();

		var map = this._map,
		    layerPoint = map.mouseEventToLayerPoint(e);

		if (this._startLayerPoint.equals(layerPoint)) { return; }

		var bounds = new L.LatLngBounds(
		        map.layerPointToLatLng(this._startLayerPoint),
		        map.layerPointToLatLng(layerPoint));

		map.fitBounds(bounds);

		map.fire('boxzoomend', {
			boxZoomBounds: bounds
		});
	},

	_onKeyDown: function (e) {
		if (e.keyCode === 27) {
			this._finish();
		}
	}
});

L.Map.addInitHook('addHandler', 'boxZoom', L.Map.BoxZoom);


/*
 * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
 */

L.Map.mergeOptions({
	keyboard: true,
	keyboardPanOffset: 80,
	keyboardZoomOffset: 1
});

L.Map.Keyboard = L.Handler.extend({

	keyCodes: {
		left:    [37],
		right:   [39],
		down:    [40],
		up:      [38],
		zoomIn:  [187, 107, 61, 171],
		zoomOut: [189, 109, 173]
	},

	initialize: function (map) {
		this._map = map;

		this._setPanOffset(map.options.keyboardPanOffset);
		this._setZoomOffset(map.options.keyboardZoomOffset);
	},

	addHooks: function () {
		var container = this._map._container;

		// make the container focusable by tabbing
		if (container.tabIndex === -1) {
			container.tabIndex = '0';
		}

		L.DomEvent
		    .on(container, 'focus', this._onFocus, this)
		    .on(container, 'blur', this._onBlur, this)
		    .on(container, 'mousedown', this._onMouseDown, this);

		this._map
		    .on('focus', this._addHooks, this)
		    .on('blur', this._removeHooks, this);
	},

	removeHooks: function () {
		this._removeHooks();

		var container = this._map._container;

		L.DomEvent
		    .off(container, 'focus', this._onFocus, this)
		    .off(container, 'blur', this._onBlur, this)
		    .off(container, 'mousedown', this._onMouseDown, this);

		this._map
		    .off('focus', this._addHooks, this)
		    .off('blur', this._removeHooks, this);
	},

	_onMouseDown: function () {
		if (this._focused) { return; }

		var body = document.body,
		    docEl = document.documentElement,
		    top = body.scrollTop || docEl.scrollTop,
		    left = body.scrollLeft || docEl.scrollLeft;

		this._map._container.focus();

		window.scrollTo(left, top);
	},

	_onFocus: function () {
		this._focused = true;
		this._map.fire('focus');
	},

	_onBlur: function () {
		this._focused = false;
		this._map.fire('blur');
	},

	_setPanOffset: function (pan) {
		var keys = this._panKeys = {},
		    codes = this.keyCodes,
		    i, len;

		for (i = 0, len = codes.left.length; i < len; i++) {
			keys[codes.left[i]] = [-1 * pan, 0];
		}
		for (i = 0, len = codes.right.length; i < len; i++) {
			keys[codes.right[i]] = [pan, 0];
		}
		for (i = 0, len = codes.down.length; i < len; i++) {
			keys[codes.down[i]] = [0, pan];
		}
		for (i = 0, len = codes.up.length; i < len; i++) {
			keys[codes.up[i]] = [0, -1 * pan];
		}
	},

	_setZoomOffset: function (zoom) {
		var keys = this._zoomKeys = {},
		    codes = this.keyCodes,
		    i, len;

		for (i = 0, len = codes.zoomIn.length; i < len; i++) {
			keys[codes.zoomIn[i]] = zoom;
		}
		for (i = 0, len = codes.zoomOut.length; i < len; i++) {
			keys[codes.zoomOut[i]] = -zoom;
		}
	},

	_addHooks: function () {
		L.DomEvent.on(document, 'keydown', this._onKeyDown, this);
	},

	_removeHooks: function () {
		L.DomEvent.off(document, 'keydown', this._onKeyDown, this);
	},

	_onKeyDown: function (e) {
		var key = e.keyCode,
		    map = this._map;

		if (key in this._panKeys) {

			if (map._panAnim && map._panAnim._inProgress) { return; }

			map.panBy(this._panKeys[key]);

			if (map.options.maxBounds) {
				map.panInsideBounds(map.options.maxBounds);
			}

		} else if (key in this._zoomKeys) {
			map.setZoom(map.getZoom() + this._zoomKeys[key]);

		} else {
			return;
		}

		L.DomEvent.stop(e);
	}
});

L.Map.addInitHook('addHandler', 'keyboard', L.Map.Keyboard);


/*
 * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
 */

L.Handler.MarkerDrag = L.Handler.extend({
	initialize: function (marker) {
		this._marker = marker;
	},

	addHooks: function () {
		var icon = this._marker._icon;
		if (!this._draggable) {
			this._draggable = new L.Draggable(icon, icon);
		}

		this._draggable
			.on('dragstart', this._onDragStart, this)
			.on('drag', this._onDrag, this)
			.on('dragend', this._onDragEnd, this);
		this._draggable.enable();
		L.DomUtil.addClass(this._marker._icon, 'leaflet-marker-draggable');
	},

	removeHooks: function () {
		this._draggable
			.off('dragstart', this._onDragStart, this)
			.off('drag', this._onDrag, this)
			.off('dragend', this._onDragEnd, this);

		this._draggable.disable();
		L.DomUtil.removeClass(this._marker._icon, 'leaflet-marker-draggable');
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_onDragStart: function () {
		this._marker
		    .closePopup()
		    .fire('movestart')
		    .fire('dragstart');
	},

	_onDrag: function () {
		var marker = this._marker,
		    shadow = marker._shadow,
		    iconPos = L.DomUtil.getPosition(marker._icon),
		    latlng = marker._map.layerPointToLatLng(iconPos);

		// update shadow position
		if (shadow) {
			L.DomUtil.setPosition(shadow, iconPos);
		}

		marker._latlng = latlng;

		marker
		    .fire('move', {latlng: latlng})
		    .fire('drag');
	},

	_onDragEnd: function (e) {
		this._marker
		    .fire('moveend')
		    .fire('dragend', e);
	}
});


/*
 * L.Control is a base class for implementing map controls. Handles positioning.
 * All other controls extend from this class.
 */

L.Control = L.Class.extend({
	options: {
		position: 'topright'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	getPosition: function () {
		return this.options.position;
	},

	setPosition: function (position) {
		var map = this._map;

		if (map) {
			map.removeControl(this);
		}

		this.options.position = position;

		if (map) {
			map.addControl(this);
		}

		return this;
	},

	getContainer: function () {
		return this._container;
	},

	addTo: function (map) {
		this._map = map;

		var container = this._container = this.onAdd(map),
		    pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		L.DomUtil.addClass(container, 'leaflet-control');

		if (pos.indexOf('bottom') !== -1) {
			corner.insertBefore(container, corner.firstChild);
		} else {
			corner.appendChild(container);
		}

		return this;
	},

	removeFrom: function (map) {
		var pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		corner.removeChild(this._container);
		this._map = null;

		if (this.onRemove) {
			this.onRemove(map);
		}

		return this;
	},

	_refocusOnMap: function () {
		if (this._map) {
			this._map.getContainer().focus();
		}
	}
});

L.control = function (options) {
	return new L.Control(options);
};


// adds control-related methods to L.Map

L.Map.include({
	addControl: function (control) {
		control.addTo(this);
		return this;
	},

	removeControl: function (control) {
		control.removeFrom(this);
		return this;
	},

	_initControlPos: function () {
		var corners = this._controlCorners = {},
		    l = 'leaflet-',
		    container = this._controlContainer =
		            L.DomUtil.create('div', l + 'control-container', this._container);

		function createCorner(vSide, hSide) {
			var className = l + vSide + ' ' + l + hSide;

			corners[vSide + hSide] = L.DomUtil.create('div', className, container);
		}

		createCorner('top', 'left');
		createCorner('top', 'right');
		createCorner('bottom', 'left');
		createCorner('bottom', 'right');
	},

	_clearControlPos: function () {
		this._container.removeChild(this._controlContainer);
	}
});


/*
 * L.Control.Zoom is used for the default zoom buttons on the map.
 */

L.Control.Zoom = L.Control.extend({
	options: {
		position: 'topleft',
		zoomInText: '+',
		zoomInTitle: 'Zoom in',
		zoomOutText: '-',
		zoomOutTitle: 'Zoom out'
	},

	onAdd: function (map) {
		var zoomName = 'leaflet-control-zoom',
		    container = L.DomUtil.create('div', zoomName + ' leaflet-bar');

		this._map = map;

		this._zoomInButton  = this._createButton(
		        this.options.zoomInText, this.options.zoomInTitle,
		        zoomName + '-in',  container, this._zoomIn,  this);
		this._zoomOutButton = this._createButton(
		        this.options.zoomOutText, this.options.zoomOutTitle,
		        zoomName + '-out', container, this._zoomOut, this);

		this._updateDisabled();
		map.on('zoomend zoomlevelschange', this._updateDisabled, this);

		return container;
	},

	onRemove: function (map) {
		map.off('zoomend zoomlevelschange', this._updateDisabled, this);
	},

	_zoomIn: function (e) {
		this._map.zoomIn(e.shiftKey ? 3 : 1);
	},

	_zoomOut: function (e) {
		this._map.zoomOut(e.shiftKey ? 3 : 1);
	},

	_createButton: function (html, title, className, container, fn, context) {
		var link = L.DomUtil.create('a', className, container);
		link.innerHTML = html;
		link.href = '#';
		link.title = title;

		var stop = L.DomEvent.stopPropagation;

		L.DomEvent
		    .on(link, 'click', stop)
		    .on(link, 'mousedown', stop)
		    .on(link, 'dblclick', stop)
		    .on(link, 'click', L.DomEvent.preventDefault)
		    .on(link, 'click', fn, context)
		    .on(link, 'click', this._refocusOnMap, context);

		return link;
	},

	_updateDisabled: function () {
		var map = this._map,
			className = 'leaflet-disabled';

		L.DomUtil.removeClass(this._zoomInButton, className);
		L.DomUtil.removeClass(this._zoomOutButton, className);

		if (map._zoom === map.getMinZoom()) {
			L.DomUtil.addClass(this._zoomOutButton, className);
		}
		if (map._zoom === map.getMaxZoom()) {
			L.DomUtil.addClass(this._zoomInButton, className);
		}
	}
});

L.Map.mergeOptions({
	zoomControl: true
});

L.Map.addInitHook(function () {
	if (this.options.zoomControl) {
		this.zoomControl = new L.Control.Zoom();
		this.addControl(this.zoomControl);
	}
});

L.control.zoom = function (options) {
	return new L.Control.Zoom(options);
};



/*
 * L.Control.Attribution is used for displaying attribution on the map (added by default).
 */

L.Control.Attribution = L.Control.extend({
	options: {
		position: 'bottomright',
		prefix: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a>'
	},

	initialize: function (options) {
		L.setOptions(this, options);

		this._attributions = {};
	},

	onAdd: function (map) {
		this._container = L.DomUtil.create('div', 'leaflet-control-attribution');
		L.DomEvent.disableClickPropagation(this._container);

		for (var i in map._layers) {
			if (map._layers[i].getAttribution) {
				this.addAttribution(map._layers[i].getAttribution());
			}
		}
		
		map
		    .on('layeradd', this._onLayerAdd, this)
		    .on('layerremove', this._onLayerRemove, this);

		this._update();

		return this._container;
	},

	onRemove: function (map) {
		map
		    .off('layeradd', this._onLayerAdd)
		    .off('layerremove', this._onLayerRemove);

	},

	setPrefix: function (prefix) {
		this.options.prefix = prefix;
		this._update();
		return this;
	},

	addAttribution: function (text) {
		if (!text) { return; }

		if (!this._attributions[text]) {
			this._attributions[text] = 0;
		}
		this._attributions[text]++;

		this._update();

		return this;
	},

	removeAttribution: function (text) {
		if (!text) { return; }

		if (this._attributions[text]) {
			this._attributions[text]--;
			this._update();
		}

		return this;
	},

	_update: function () {
		if (!this._map) { return; }

		var attribs = [];

		for (var i in this._attributions) {
			if (this._attributions[i]) {
				attribs.push(i);
			}
		}

		var prefixAndAttribs = [];

		if (this.options.prefix) {
			prefixAndAttribs.push(this.options.prefix);
		}
		if (attribs.length) {
			prefixAndAttribs.push(attribs.join(', '));
		}

		this._container.innerHTML = prefixAndAttribs.join(' | ');
	},

	_onLayerAdd: function (e) {
		if (e.layer.getAttribution) {
			this.addAttribution(e.layer.getAttribution());
		}
	},

	_onLayerRemove: function (e) {
		if (e.layer.getAttribution) {
			this.removeAttribution(e.layer.getAttribution());
		}
	}
});

L.Map.mergeOptions({
	attributionControl: true
});

L.Map.addInitHook(function () {
	if (this.options.attributionControl) {
		this.attributionControl = (new L.Control.Attribution()).addTo(this);
	}
});

L.control.attribution = function (options) {
	return new L.Control.Attribution(options);
};


/*
 * L.Control.Scale is used for displaying metric/imperial scale on the map.
 */

L.Control.Scale = L.Control.extend({
	options: {
		position: 'bottomleft',
		maxWidth: 100,
		metric: true,
		imperial: true,
		updateWhenIdle: false
	},

	onAdd: function (map) {
		this._map = map;

		var className = 'leaflet-control-scale',
		    container = L.DomUtil.create('div', className),
		    options = this.options;

		this._addScales(options, className, container);

		map.on(options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
		map.whenReady(this._update, this);

		return container;
	},

	onRemove: function (map) {
		map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
	},

	_addScales: function (options, className, container) {
		if (options.metric) {
			this._mScale = L.DomUtil.create('div', className + '-line', container);
		}
		if (options.imperial) {
			this._iScale = L.DomUtil.create('div', className + '-line', container);
		}
	},

	_update: function () {
		var bounds = this._map.getBounds(),
		    centerLat = bounds.getCenter().lat,
		    halfWorldMeters = 6378137 * Math.PI * Math.cos(centerLat * Math.PI / 180),
		    dist = halfWorldMeters * (bounds.getNorthEast().lng - bounds.getSouthWest().lng) / 180,

		    size = this._map.getSize(),
		    options = this.options,
		    maxMeters = 0;

		if (size.x > 0) {
			maxMeters = dist * (options.maxWidth / size.x);
		}

		this._updateScales(options, maxMeters);
	},

	_updateScales: function (options, maxMeters) {
		if (options.metric && maxMeters) {
			this._updateMetric(maxMeters);
		}

		if (options.imperial && maxMeters) {
			this._updateImperial(maxMeters);
		}
	},

	_updateMetric: function (maxMeters) {
		var meters = this._getRoundNum(maxMeters);

		this._mScale.style.width = this._getScaleWidth(meters / maxMeters) + 'px';
		this._mScale.innerHTML = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';
	},

	_updateImperial: function (maxMeters) {
		var maxFeet = maxMeters * 3.2808399,
		    scale = this._iScale,
		    maxMiles, miles, feet;

		if (maxFeet > 5280) {
			maxMiles = maxFeet / 5280;
			miles = this._getRoundNum(maxMiles);

			scale.style.width = this._getScaleWidth(miles / maxMiles) + 'px';
			scale.innerHTML = miles + ' mi';

		} else {
			feet = this._getRoundNum(maxFeet);

			scale.style.width = this._getScaleWidth(feet / maxFeet) + 'px';
			scale.innerHTML = feet + ' ft';
		}
	},

	_getScaleWidth: function (ratio) {
		return Math.round(this.options.maxWidth * ratio) - 10;
	},

	_getRoundNum: function (num) {
		var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
		    d = num / pow10;

		d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;

		return pow10 * d;
	}
});

L.control.scale = function (options) {
	return new L.Control.Scale(options);
};


/*
 * L.Control.Layers is a control to allow users to switch between different layers on the map.
 */

L.Control.Layers = L.Control.extend({
	options: {
		collapsed: true,
		position: 'topright',
		autoZIndex: true
	},

	initialize: function (baseLayers, overlays, options) {
		L.setOptions(this, options);

		this._layers = {};
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (var i in baseLayers) {
			this._addLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this._addLayer(overlays[i], i, true);
		}
	},

	onAdd: function (map) {
		this._initLayout();
		this._update();

		map
		    .on('layeradd', this._onLayerChange, this)
		    .on('layerremove', this._onLayerChange, this);

		return this._container;
	},

	onRemove: function (map) {
		map
		    .off('layeradd', this._onLayerChange, this)
		    .off('layerremove', this._onLayerChange, this);
	},

	addBaseLayer: function (layer, name) {
		this._addLayer(layer, name);
		this._update();
		return this;
	},

	addOverlay: function (layer, name) {
		this._addLayer(layer, name, true);
		this._update();
		return this;
	},

	removeLayer: function (layer) {
		var id = L.stamp(layer);
		delete this._layers[id];
		this._update();
		return this;
	},

	_initLayout: function () {
		var className = 'leaflet-control-layers',
		    container = this._container = L.DomUtil.create('div', className);

		//Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
		container.setAttribute('aria-haspopup', true);

		if (!L.Browser.touch) {
			L.DomEvent
				.disableClickPropagation(container)
				.disableScrollPropagation(container);
		} else {
			L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
		}

		var form = this._form = L.DomUtil.create('form', className + '-list');

		if (this.options.collapsed) {
			if (!L.Browser.android) {
				L.DomEvent
				    .on(container, 'mouseover', this._expand, this)
				    .on(container, 'mouseout', this._collapse, this);
			}
			var link = this._layersLink = L.DomUtil.create('a', className + '-toggle', container);
			link.href = '#';
			link.title = 'Layers';

			if (L.Browser.touch) {
				L.DomEvent
				    .on(link, 'click', L.DomEvent.stop)
				    .on(link, 'click', this._expand, this);
			}
			else {
				L.DomEvent.on(link, 'focus', this._expand, this);
			}
			//Work around for Firefox android issue https://github.com/Leaflet/Leaflet/issues/2033
			L.DomEvent.on(form, 'click', function () {
				setTimeout(L.bind(this._onInputClick, this), 0);
			}, this);

			this._map.on('click', this._collapse, this);
			// TODO keyboard accessibility
		} else {
			this._expand();
		}

		this._baseLayersList = L.DomUtil.create('div', className + '-base', form);
		this._separator = L.DomUtil.create('div', className + '-separator', form);
		this._overlaysList = L.DomUtil.create('div', className + '-overlays', form);

		container.appendChild(form);
	},

	_addLayer: function (layer, name, overlay) {
		var id = L.stamp(layer);

		this._layers[id] = {
			layer: layer,
			name: name,
			overlay: overlay
		};

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}
	},

	_update: function () {
		if (!this._container) {
			return;
		}

		this._baseLayersList.innerHTML = '';
		this._overlaysList.innerHTML = '';

		var baseLayersPresent = false,
		    overlaysPresent = false,
		    i, obj;

		for (i in this._layers) {
			obj = this._layers[i];
			this._addItem(obj);
			overlaysPresent = overlaysPresent || obj.overlay;
			baseLayersPresent = baseLayersPresent || !obj.overlay;
		}

		this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
	},

	_onLayerChange: function (e) {
		var obj = this._layers[L.stamp(e.layer)];

		if (!obj) { return; }

		if (!this._handlingClick) {
			this._update();
		}

		var type = obj.overlay ?
			(e.type === 'layeradd' ? 'overlayadd' : 'overlayremove') :
			(e.type === 'layeradd' ? 'baselayerchange' : null);

		if (type) {
			this._map.fire(type, obj);
		}
	},

	// IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
	_createRadioElement: function (name, checked) {

		var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' + name + '"';
		if (checked) {
			radioHtml += ' checked="checked"';
		}
		radioHtml += '/>';

		var radioFragment = document.createElement('div');
		radioFragment.innerHTML = radioHtml;

		return radioFragment.firstChild;
	},

	_addItem: function (obj) {
		var label = document.createElement('label'),
		    input,
		    checked = this._map.hasLayer(obj.layer);

		if (obj.overlay) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'leaflet-control-layers-selector';
			input.defaultChecked = checked;
		} else {
			input = this._createRadioElement('leaflet-base-layers', checked);
		}

		input.layerId = L.stamp(obj.layer);

		L.DomEvent.on(input, 'click', this._onInputClick, this);

		var name = document.createElement('span');
		name.innerHTML = ' ' + obj.name;

		label.appendChild(input);
		label.appendChild(name);

		var container = obj.overlay ? this._overlaysList : this._baseLayersList;
		container.appendChild(label);

		return label;
	},

	_onInputClick: function () {
		var i, input, obj,
		    inputs = this._form.getElementsByTagName('input'),
		    inputsLen = inputs.length;

		this._handlingClick = true;

		for (i = 0; i < inputsLen; i++) {
			input = inputs[i];
			obj = this._layers[input.layerId];

			if (input.checked && !this._map.hasLayer(obj.layer)) {
				this._map.addLayer(obj.layer);

			} else if (!input.checked && this._map.hasLayer(obj.layer)) {
				this._map.removeLayer(obj.layer);
			}
		}

		this._handlingClick = false;

		this._refocusOnMap();
	},

	_expand: function () {
		L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
	},

	_collapse: function () {
		this._container.className = this._container.className.replace(' leaflet-control-layers-expanded', '');
	}
});

L.control.layers = function (baseLayers, overlays, options) {
	return new L.Control.Layers(baseLayers, overlays, options);
};


/*
 * L.PosAnimation is used by Leaflet internally for pan animations.
 */

L.PosAnimation = L.Class.extend({
	includes: L.Mixin.Events,

	run: function (el, newPos, duration, easeLinearity) { // (HTMLElement, Point[, Number, Number])
		this.stop();

		this._el = el;
		this._inProgress = true;
		this._newPos = newPos;

		this.fire('start');

		el.style[L.DomUtil.TRANSITION] = 'all ' + (duration || 0.25) +
		        's cubic-bezier(0,0,' + (easeLinearity || 0.5) + ',1)';

		L.DomEvent.on(el, L.DomUtil.TRANSITION_END, this._onTransitionEnd, this);
		L.DomUtil.setPosition(el, newPos);

		// toggle reflow, Chrome flickers for some reason if you don't do this
		L.Util.falseFn(el.offsetWidth);

		// there's no native way to track value updates of transitioned properties, so we imitate this
		this._stepTimer = setInterval(L.bind(this._onStep, this), 50);
	},

	stop: function () {
		if (!this._inProgress) { return; }

		// if we just removed the transition property, the element would jump to its final position,
		// so we need to make it stay at the current position

		L.DomUtil.setPosition(this._el, this._getPos());
		this._onTransitionEnd();
		L.Util.falseFn(this._el.offsetWidth); // force reflow in case we are about to start a new animation
	},

	_onStep: function () {
		var stepPos = this._getPos();
		if (!stepPos) {
			this._onTransitionEnd();
			return;
		}
		// jshint camelcase: false
		// make L.DomUtil.getPosition return intermediate position value during animation
		this._el._leaflet_pos = stepPos;

		this.fire('step');
	},

	// you can't easily get intermediate values of properties animated with CSS3 Transitions,
	// we need to parse computed style (in case of transform it returns matrix string)

	_transformRe: /([-+]?(?:\d*\.)?\d+)\D*, ([-+]?(?:\d*\.)?\d+)\D*\)/,

	_getPos: function () {
		var left, top, matches,
		    el = this._el,
		    style = window.getComputedStyle(el);

		if (L.Browser.any3d) {
			matches = style[L.DomUtil.TRANSFORM].match(this._transformRe);
			if (!matches) { return; }
			left = parseFloat(matches[1]);
			top  = parseFloat(matches[2]);
		} else {
			left = parseFloat(style.left);
			top  = parseFloat(style.top);
		}

		return new L.Point(left, top, true);
	},

	_onTransitionEnd: function () {
		L.DomEvent.off(this._el, L.DomUtil.TRANSITION_END, this._onTransitionEnd, this);

		if (!this._inProgress) { return; }
		this._inProgress = false;

		this._el.style[L.DomUtil.TRANSITION] = '';

		// jshint camelcase: false
		// make sure L.DomUtil.getPosition returns the final position value after animation
		this._el._leaflet_pos = this._newPos;

		clearInterval(this._stepTimer);

		this.fire('step').fire('end');
	}

});


/*
 * Extends L.Map to handle panning animations.
 */

L.Map.include({

	setView: function (center, zoom, options) {

		zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
		center = this._limitCenter(L.latLng(center), zoom, this.options.maxBounds);
		options = options || {};

		if (this._panAnim) {
			this._panAnim.stop();
		}

		if (this._loaded && !options.reset && options !== true) {

			if (options.animate !== undefined) {
				options.zoom = L.extend({animate: options.animate}, options.zoom);
				options.pan = L.extend({animate: options.animate}, options.pan);
			}

			// try animating pan or zoom
			var animated = (this._zoom !== zoom) ?
				this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom, options.zoom) :
				this._tryAnimatedPan(center, options.pan);

			if (animated) {
				// prevent resize handler call, the view will refresh after animation anyway
				clearTimeout(this._sizeTimer);
				return this;
			}
		}

		// animation didn't start, just reset the map view
		this._resetView(center, zoom);

		return this;
	},

	panBy: function (offset, options) {
		offset = L.point(offset).round();
		options = options || {};

		if (!offset.x && !offset.y) {
			return this;
		}

		if (!this._panAnim) {
			this._panAnim = new L.PosAnimation();

			this._panAnim.on({
				'step': this._onPanTransitionStep,
				'end': this._onPanTransitionEnd
			}, this);
		}

		// don't fire movestart if animating inertia
		if (!options.noMoveStart) {
			this.fire('movestart');
		}

		// animate pan unless animate: false specified
		if (options.animate !== false) {
			L.DomUtil.addClass(this._mapPane, 'leaflet-pan-anim');

			var newPos = this._getMapPanePos().subtract(offset);
			this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
		} else {
			this._rawPanBy(offset);
			this.fire('move').fire('moveend');
		}

		return this;
	},

	_onPanTransitionStep: function () {
		this.fire('move');
	},

	_onPanTransitionEnd: function () {
		L.DomUtil.removeClass(this._mapPane, 'leaflet-pan-anim');
		this.fire('moveend');
	},

	_tryAnimatedPan: function (center, options) {
		// difference between the new and current centers in pixels
		var offset = this._getCenterOffset(center)._floor();

		// don't animate too far unless animate: true specified in options
		if ((options && options.animate) !== true && !this.getSize().contains(offset)) { return false; }

		this.panBy(offset, options);

		return true;
	}
});


/*
 * L.PosAnimation fallback implementation that powers Leaflet pan animations
 * in browsers that don't support CSS3 Transitions.
 */

L.PosAnimation = L.DomUtil.TRANSITION ? L.PosAnimation : L.PosAnimation.extend({

	run: function (el, newPos, duration, easeLinearity) { // (HTMLElement, Point[, Number, Number])
		this.stop();

		this._el = el;
		this._inProgress = true;
		this._duration = duration || 0.25;
		this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);

		this._startPos = L.DomUtil.getPosition(el);
		this._offset = newPos.subtract(this._startPos);
		this._startTime = +new Date();

		this.fire('start');

		this._animate();
	},

	stop: function () {
		if (!this._inProgress) { return; }

		this._step();
		this._complete();
	},

	_animate: function () {
		// animation loop
		this._animId = L.Util.requestAnimFrame(this._animate, this);
		this._step();
	},

	_step: function () {
		var elapsed = (+new Date()) - this._startTime,
		    duration = this._duration * 1000;

		if (elapsed < duration) {
			this._runFrame(this._easeOut(elapsed / duration));
		} else {
			this._runFrame(1);
			this._complete();
		}
	},

	_runFrame: function (progress) {
		var pos = this._startPos.add(this._offset.multiplyBy(progress));
		L.DomUtil.setPosition(this._el, pos);

		this.fire('step');
	},

	_complete: function () {
		L.Util.cancelAnimFrame(this._animId);

		this._inProgress = false;
		this.fire('end');
	},

	_easeOut: function (t) {
		return 1 - Math.pow(1 - t, this._easeOutPower);
	}
});


/*
 * Extends L.Map to handle zoom animations.
 */

L.Map.mergeOptions({
	zoomAnimation: true,
	zoomAnimationThreshold: 4
});

if (L.DomUtil.TRANSITION) {

	L.Map.addInitHook(function () {
		// don't animate on browsers without hardware-accelerated transitions or old Android/Opera
		this._zoomAnimated = this.options.zoomAnimation && L.DomUtil.TRANSITION &&
				L.Browser.any3d && !L.Browser.android23 && !L.Browser.mobileOpera;

		// zoom transitions run with the same duration for all layers, so if one of transitionend events
		// happens after starting zoom animation (propagating to the map pane), we know that it ended globally
		if (this._zoomAnimated) {
			L.DomEvent.on(this._mapPane, L.DomUtil.TRANSITION_END, this._catchTransitionEnd, this);
		}
	});
}

L.Map.include(!L.DomUtil.TRANSITION ? {} : {

	_catchTransitionEnd: function (e) {
		if (this._animatingZoom && e.propertyName.indexOf('transform') >= 0) {
			this._onZoomTransitionEnd();
		}
	},

	_nothingToAnimate: function () {
		return !this._container.getElementsByClassName('leaflet-zoom-animated').length;
	},

	_tryAnimatedZoom: function (center, zoom, options) {

		if (this._animatingZoom) { return true; }

		options = options || {};

		// don't animate if disabled, not supported or zoom difference is too large
		if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() ||
		        Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold) { return false; }

		// offset is the pixel coords of the zoom origin relative to the current center
		var scale = this.getZoomScale(zoom),
		    offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale),
			origin = this._getCenterLayerPoint()._add(offset);

		// don't animate if the zoom origin isn't within one screen from the current center, unless forced
		if (options.animate !== true && !this.getSize().contains(offset)) { return false; }

		this
		    .fire('movestart')
		    .fire('zoomstart');

		this._animateZoom(center, zoom, origin, scale, null, true);

		return true;
	},

	_animateZoom: function (center, zoom, origin, scale, delta, backwards, forTouchZoom) {

		if (!forTouchZoom) {
			this._animatingZoom = true;
		}

		// put transform transition on all layers with leaflet-zoom-animated class
		L.DomUtil.addClass(this._mapPane, 'leaflet-zoom-anim');

		// remember what center/zoom to set after animation
		this._animateToCenter = center;
		this._animateToZoom = zoom;

		// disable any dragging during animation
		if (L.Draggable) {
			L.Draggable._disabled = true;
		}

		L.Util.requestAnimFrame(function () {
			this.fire('zoomanim', {
				center: center,
				zoom: zoom,
				origin: origin,
				scale: scale,
				delta: delta,
				backwards: backwards
			});
		}, this);
	},

	_onZoomTransitionEnd: function () {

		this._animatingZoom = false;

		L.DomUtil.removeClass(this._mapPane, 'leaflet-zoom-anim');

		this._resetView(this._animateToCenter, this._animateToZoom, true, true);

		if (L.Draggable) {
			L.Draggable._disabled = false;
		}
	}
});


/*
	Zoom animation logic for L.TileLayer.
*/

L.TileLayer.include({
	_animateZoom: function (e) {
		if (!this._animating) {
			this._animating = true;
			this._prepareBgBuffer();
		}

		var bg = this._bgBuffer,
		    transform = L.DomUtil.TRANSFORM,
		    initialTransform = e.delta ? L.DomUtil.getTranslateString(e.delta) : bg.style[transform],
		    scaleStr = L.DomUtil.getScaleString(e.scale, e.origin);

		bg.style[transform] = e.backwards ?
				scaleStr + ' ' + initialTransform :
				initialTransform + ' ' + scaleStr;
	},

	_endZoomAnim: function () {
		var front = this._tileContainer,
		    bg = this._bgBuffer;

		front.style.visibility = '';
		front.parentNode.appendChild(front); // Bring to fore

		// force reflow
		L.Util.falseFn(bg.offsetWidth);

		this._animating = false;
	},

	_clearBgBuffer: function () {
		var map = this._map;

		if (map && !map._animatingZoom && !map.touchZoom._zooming) {
			this._bgBuffer.innerHTML = '';
			this._bgBuffer.style[L.DomUtil.TRANSFORM] = '';
		}
	},

	_prepareBgBuffer: function () {

		var front = this._tileContainer,
		    bg = this._bgBuffer;

		// if foreground layer doesn't have many tiles but bg layer does,
		// keep the existing bg layer and just zoom it some more

		var bgLoaded = this._getLoadedTilesPercentage(bg),
		    frontLoaded = this._getLoadedTilesPercentage(front);

		if (bg && bgLoaded > 0.5 && frontLoaded < 0.5) {

			front.style.visibility = 'hidden';
			this._stopLoadingImages(front);
			return;
		}

		// prepare the buffer to become the front tile pane
		bg.style.visibility = 'hidden';
		bg.style[L.DomUtil.TRANSFORM] = '';

		// switch out the current layer to be the new bg layer (and vice-versa)
		this._tileContainer = bg;
		bg = this._bgBuffer = front;

		this._stopLoadingImages(bg);

		//prevent bg buffer from clearing right after zoom
		clearTimeout(this._clearBgBufferTimer);
	},

	_getLoadedTilesPercentage: function (container) {
		var tiles = container.getElementsByTagName('img'),
		    i, len, count = 0;

		for (i = 0, len = tiles.length; i < len; i++) {
			if (tiles[i].complete) {
				count++;
			}
		}
		return count / len;
	},

	// stops loading all tiles in the background layer
	_stopLoadingImages: function (container) {
		var tiles = Array.prototype.slice.call(container.getElementsByTagName('img')),
		    i, len, tile;

		for (i = 0, len = tiles.length; i < len; i++) {
			tile = tiles[i];

			if (!tile.complete) {
				tile.onload = L.Util.falseFn;
				tile.onerror = L.Util.falseFn;
				tile.src = L.Util.emptyImageUrl;

				tile.parentNode.removeChild(tile);
			}
		}
	}
});


/*
 * Provides L.Map with convenient shortcuts for using browser geolocation features.
 */

L.Map.include({
	_defaultLocateOptions: {
		watch: false,
		setView: false,
		maxZoom: Infinity,
		timeout: 10000,
		maximumAge: 0,
		enableHighAccuracy: false
	},

	locate: function (/*Object*/ options) {

		options = this._locateOptions = L.extend(this._defaultLocateOptions, options);

		if (!navigator.geolocation) {
			this._handleGeolocationError({
				code: 0,
				message: 'Geolocation not supported.'
			});
			return this;
		}

		var onResponse = L.bind(this._handleGeolocationResponse, this),
			onError = L.bind(this._handleGeolocationError, this);

		if (options.watch) {
			this._locationWatchId =
			        navigator.geolocation.watchPosition(onResponse, onError, options);
		} else {
			navigator.geolocation.getCurrentPosition(onResponse, onError, options);
		}
		return this;
	},

	stopLocate: function () {
		if (navigator.geolocation) {
			navigator.geolocation.clearWatch(this._locationWatchId);
		}
		if (this._locateOptions) {
			this._locateOptions.setView = false;
		}
		return this;
	},

	_handleGeolocationError: function (error) {
		var c = error.code,
		    message = error.message ||
		            (c === 1 ? 'permission denied' :
		            (c === 2 ? 'position unavailable' : 'timeout'));

		if (this._locateOptions.setView && !this._loaded) {
			this.fitWorld();
		}

		this.fire('locationerror', {
			code: c,
			message: 'Geolocation error: ' + message + '.'
		});
	},

	_handleGeolocationResponse: function (pos) {
		var lat = pos.coords.latitude,
		    lng = pos.coords.longitude,
		    latlng = new L.LatLng(lat, lng),

		    latAccuracy = 180 * pos.coords.accuracy / 40075017,
		    lngAccuracy = latAccuracy / Math.cos(L.LatLng.DEG_TO_RAD * lat),

		    bounds = L.latLngBounds(
		            [lat - latAccuracy, lng - lngAccuracy],
		            [lat + latAccuracy, lng + lngAccuracy]),

		    options = this._locateOptions;

		if (options.setView) {
			var zoom = Math.min(this.getBoundsZoom(bounds), options.maxZoom);
			this.setView(latlng, zoom);
		}

		var data = {
			latlng: latlng,
			bounds: bounds,
			timestamp: pos.timestamp
		};

		for (var i in pos.coords) {
			if (typeof pos.coords[i] === 'number') {
				data[i] = pos.coords[i];
			}
		}

		this.fire('locationfound', data);
	}
});


}(window, document));
},{}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/pbf/index.js":[function(require,module,exports){
(function (Buffer){
'use strict';

var ieee754 = require('ieee754');

module.exports = Protobuf;
function Protobuf(buf) {
    this.buf = buf;
    this.pos = 0;
}

Protobuf.prototype = {
    get length() { return this.buf.length; }
};

Protobuf.Varint = 0;
Protobuf.Int64 = 1;
Protobuf.Message = 2;
Protobuf.String = 2;
Protobuf.Packed = 2;
Protobuf.Int32 = 5;

Protobuf.prototype.destroy = function() {
    this.buf = null;
};

// === READING =================================================================

Protobuf.prototype.readUInt32 = function() {
    var val = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return val;
};

Protobuf.prototype.readUInt64 = function() {
    var val = this.buf.readUInt64LE(this.pos);
    this.pos += 8;
    return val;
};

Protobuf.prototype.readDouble = function() {
    var val = ieee754.read(this.buf, this.pos, true, 52, 8);
    this.pos += 8;
    return val;
};

Protobuf.prototype.readVarint = function() {
    // TODO: bounds checking
    var pos = this.pos;
    if (this.buf[pos] <= 0x7f) {
        this.pos++;
        return this.buf[pos];
    } else if (this.buf[pos + 1] <= 0x7f) {
        this.pos += 2;
        return (this.buf[pos] & 0x7f) | (this.buf[pos + 1] << 7);
    } else if (this.buf[pos + 2] <= 0x7f) {
        this.pos += 3;
        return (this.buf[pos] & 0x7f) | (this.buf[pos + 1] & 0x7f) << 7 | (this.buf[pos + 2]) << 14;
    } else if (this.buf[pos + 3] <= 0x7f) {
        this.pos += 4;
        return (this.buf[pos] & 0x7f) | (this.buf[pos + 1] & 0x7f) << 7 | (this.buf[pos + 2] & 0x7f) << 14 | (this.buf[pos + 3]) << 21;
    } else if (this.buf[pos + 4] <= 0x7f) {
        this.pos += 5;
        return ((this.buf[pos] & 0x7f) | (this.buf[pos + 1] & 0x7f) << 7 | (this.buf[pos + 2] & 0x7f) << 14 | (this.buf[pos + 3]) << 21) + (this.buf[pos + 4] * 268435456);
    } else {
        this.skip(Protobuf.Varint);
        return 0;
        // throw new Error("TODO: Handle 6+ byte varints");
    }
};

Protobuf.prototype.readSVarint = function() {
    var num = this.readVarint();
    if (num > 2147483647) throw new Error('TODO: Handle numbers >= 2^30');
    // zigzag encoding
    return ((num >> 1) ^ -(num & 1));
};

Protobuf.prototype.readString = function() {
    var bytes = this.readVarint();
    // TODO: bounds checking
    var chr = String.fromCharCode;
    var b = this.buf;
    var p = this.pos;
    var end = this.pos + bytes;
    var str = '';
    while (p < end) {
        if (b[p] <= 0x7F) str += chr(b[p++]);
        else if (b[p] <= 0xBF) throw new Error('Invalid UTF-8 codepoint: ' + b[p]);
        else if (b[p] <= 0xDF) str += chr((b[p++] & 0x1F) << 6 | (b[p++] & 0x3F));
        else if (b[p] <= 0xEF) str += chr((b[p++] & 0x1F) << 12 | (b[p++] & 0x3F) << 6 | (b[p++] & 0x3F));
        else if (b[p] <= 0xF7) p += 4; // We can't handle these codepoints in JS, so skip.
        else if (b[p] <= 0xFB) p += 5;
        else if (b[p] <= 0xFD) p += 6;
        else throw new Error('Invalid UTF-8 codepoint: ' + b[p]);
    }
    this.pos += bytes;
    return str;
};

Protobuf.prototype.readBuffer = function() {
    var bytes = this.readVarint();
    var buffer = this.buf.subarray(this.pos, this.pos + bytes);
    this.pos += bytes;
    return buffer;
};

Protobuf.prototype.readPacked = function(type) {
    // TODO: bounds checking
    var bytes = this.readVarint();
    var end = this.pos + bytes;
    var array = [];
    while (this.pos < end) {
        array.push(this['read' + type]());
    }
    return array;
};

Protobuf.prototype.skip = function(val) {
    // TODO: bounds checking
    var type = val & 0x7;
    switch (type) {
        /* varint */ case Protobuf.Varint: while (this.buf[this.pos++] > 0x7f); break;
        /* 64 bit */ case Protobuf.Int64: this.pos += 8; break;
        /* length */ case Protobuf.Message: var bytes = this.readVarint(); this.pos += bytes; break;
        /* 32 bit */ case Protobuf.Int32: this.pos += 4; break;
        default: throw new Error('Unimplemented type: ' + type);
    }
};

// === WRITING =================================================================

Protobuf.prototype.writeTag = function(tag, type) {
    this.writeVarint((tag << 3) | type);
};

Protobuf.prototype.realloc = function(min) {
    var length = this.buf.length;
    while (length < this.pos + min) length *= 2;
    if (length != this.buf.length) {
        var buf = new Buffer(length);
        this.buf.copy(buf);
        this.buf = buf;
    }
};

Protobuf.prototype.finish = function() {
    return this.buf.slice(0, this.pos);
};

Protobuf.prototype.writePacked = function(type, tag, items) {
    if (!items.length) return;

    var message = new Protobuf();
    for (var i = 0; i < items.length; i++) {
        message['write' + type](items[i]);
    }
    var data = message.finish();

    this.writeTag(tag, Protobuf.Packed);
    this.writeBuffer(data);
};

Protobuf.prototype.writeUInt32 = function(val) {
    this.realloc(4);
    this.buf.writeUInt32LE(val, this.pos);
    this.pos += 4;
};

Protobuf.prototype.writeTaggedUInt32 = function(tag, val) {
    this.writeTag(tag, Protobuf.Int32);
    this.writeUInt32(val);
};

Protobuf.prototype.writeVarint = function(val) {
    val = Number(val);
    if (isNaN(val)) {
        val = 0;
    }

    if (val <= 0x7f) {
        this.realloc(1);
        this.buf[this.pos++] = val;
    } else if (val <= 0x3fff) {
        this.realloc(2);
        this.buf[this.pos++] = 0x80 | ((val >>> 0) & 0x7f);
        this.buf[this.pos++] = 0x00 | ((val >>> 7) & 0x7f);
    } else if (val <= 0x1ffffff) {
        this.realloc(3);
        this.buf[this.pos++] = 0x80 | ((val >>> 0) & 0x7f);
        this.buf[this.pos++] = 0x80 | ((val >>> 7) & 0x7f);
        this.buf[this.pos++] = 0x00 | ((val >>> 14) & 0x7f);
    } else if (val <= 0xfffffff) {
        this.realloc(4);
        this.buf[this.pos++] = 0x80 | ((val >>> 0) & 0x7f);
        this.buf[this.pos++] = 0x80 | ((val >>> 7) & 0x7f);
        this.buf[this.pos++] = 0x80 | ((val >>> 14) & 0x7f);
        this.buf[this.pos++] = 0x00 | ((val >>> 21) & 0x7f);
    } else {
        while (val > 0) {
            var b = val & 0x7f;
            val = Math.floor(val / 128);
            if (val > 0) b |= 0x80
            this.realloc(1);
            this.buf[this.pos++] = b;
        }
    }
};

Protobuf.prototype.writeTaggedVarint = function(tag, val) {
    this.writeTag(tag, Protobuf.Varint);
    this.writeVarint(val);
};

Protobuf.prototype.writeSVarint = function(val) {
    if (val >= 0) {
        this.writeVarint(val * 2);
    } else {
        this.writeVarint(val * -2 - 1);
    }
};

Protobuf.prototype.writeTaggedSVarint = function(tag, val) {
    this.writeTag(tag, Protobuf.Varint);
    this.writeSVarint(val);
};

Protobuf.prototype.writeBoolean = function(val) {
    this.writeVarint(Boolean(val));
};

Protobuf.prototype.writeTaggedBoolean = function(tag, val) {
    this.writeTaggedVarint(tag, Boolean(val));
};

Protobuf.prototype.writeString = function(str) {
    str = String(str);
    var bytes = Buffer.byteLength(str);
    this.writeVarint(bytes);
    this.realloc(bytes);
    this.buf.write(str, this.pos);
    this.pos += bytes;
};

Protobuf.prototype.writeTaggedString = function(tag, str) {
    this.writeTag(tag, Protobuf.String);
    this.writeString(str);
};

Protobuf.prototype.writeFloat = function(val) {
    this.realloc(4);
    this.buf.writeFloatLE(val, this.pos);
    this.pos += 4;
};

Protobuf.prototype.writeTaggedFloat = function(tag, val) {
    this.writeTag(tag, Protobuf.Int32);
    this.writeFloat(val);
};

Protobuf.prototype.writeDouble = function(val) {
    this.realloc(8);
    this.buf.writeDoubleLE(val, this.pos);
    this.pos += 8;
};

Protobuf.prototype.writeTaggedDouble = function(tag, val) {
    this.writeTag(tag, Protobuf.Int64);
    this.writeDouble(val);
};

Protobuf.prototype.writeBuffer = function(buffer) {
    var bytes = buffer.length;
    this.writeVarint(bytes);
    this.realloc(bytes);
    buffer.copy(this.buf, this.pos);
    this.pos += bytes;
};

Protobuf.prototype.writeTaggedBuffer = function(tag, buffer) {
    this.writeTag(tag, Protobuf.String);
    this.writeBuffer(buffer);
};

Protobuf.prototype.writeMessage = function(tag, protobuf) {
    var buffer = protobuf.finish();
    this.writeTag(tag, Protobuf.Message);
    this.writeBuffer(buffer);
};

}).call(this,require("buffer").Buffer)
},{"buffer":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/index.js","ieee754":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/pbf/node_modules/ieee754/index.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/pbf/node_modules/ieee754/index.js":[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/point-geometry/index.js":[function(require,module,exports){
'use strict';

module.exports = Point;

function Point(x, y) {
    this.x = x;
    this.y = y;
}

Point.prototype = {
    clone: function() { return new Point(this.x, this.y); },

    add:     function(p) { return this.clone()._add(p);     },
    sub:     function(p) { return this.clone()._sub(p);     },
    mult:    function(k) { return this.clone()._mult(k);    },
    div:     function(k) { return this.clone()._div(k);     },
    rotate:  function(a) { return this.clone()._rotate(a);  },
    matMult: function(m) { return this.clone()._matMult(m); },
    unit:    function() { return this.clone()._unit(); },
    perp:    function() { return this.clone()._perp(); },
    round:   function() { return this.clone()._round(); },

    mag: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    },

    equals: function(p) {
        return this.x === p.x &&
               this.y === p.y;
    },

    dist: function(p) {
        return Math.sqrt(this.distSqr(p));
    },

    distSqr: function(p) {
        var dx = p.x - this.x,
            dy = p.y - this.y;
        return dx * dx + dy * dy;
    },

    angle: function() {
        return Math.atan2(this.y, this.x);
    },

    angleTo: function(b) {
        return Math.atan2(this.y - b.y, this.x - b.x);
    },

    angleWith: function(b) {
        return this.angleWithSep(b.x, b.y);
    },

    // Find the angle of the two vectors, solving the formula for the cross product a x b = |a||b|sin(θ) for θ.
    angleWithSep: function(x, y) {
        return Math.atan2(
            this.x * y - this.y * x,
            this.x * x + this.y * y);
    },

    _matMult: function(m) {
        var x = m[0] * this.x + m[1] * this.y,
            y = m[2] * this.x + m[3] * this.y;
        this.x = x;
        this.y = y;
        return this;
    },

    _add: function(p) {
        this.x += p.x;
        this.y += p.y;
        return this;
    },

    _sub: function(p) {
        this.x -= p.x;
        this.y -= p.y;
        return this;
    },

    _mult: function(k) {
        this.x *= k;
        this.y *= k;
        return this;
    },

    _div: function(k) {
        this.x /= k;
        this.y /= k;
        return this;
    },

    _unit: function() {
        this._div(this.mag());
        return this;
    },

    _perp: function() {
        var y = this.y;
        this.y = this.x;
        this.x = -y;
        return this;
    },

    _rotate: function(angle) {
        var cos = Math.cos(angle),
            sin = Math.sin(angle),
            x = cos * this.x - sin * this.y,
            y = sin * this.x + cos * this.y;
        this.x = x;
        this.y = y;
        return this;
    },

    _round: function() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    }
};

// constructs Point from an array if necessary
Point.convert = function (a) {
    if (a instanceof Point) {
        return a;
    }
    if (Array.isArray(a)) {
        return new Point(a[0], a[1]);
    }
    return a;
};

},{}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/index.js":[function(require,module,exports){
module.exports.VectorTile = require('./lib/vectortile.js');
module.exports.VectorTileFeature = require('./lib/vectortilefeature.js');
module.exports.VectorTileLayer = require('./lib/vectortilelayer.js');

},{"./lib/vectortile.js":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortile.js","./lib/vectortilefeature.js":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilefeature.js","./lib/vectortilelayer.js":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilelayer.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortile.js":[function(require,module,exports){
'use strict';

var VectorTileLayer = require('./vectortilelayer');

module.exports = VectorTile;

function VectorTile(buffer, end) {

    this.layers = {};
    this._buffer = buffer;

    end = end || buffer.length;

    while (buffer.pos < end) {
        var val = buffer.readVarint(),
            tag = val >> 3;

        if (tag == 3) {
            var layer = this.readLayer();
            if (layer.length) this.layers[layer.name] = layer;
        } else {
            buffer.skip(val);
        }
    }
}

VectorTile.prototype.readLayer = function() {
    var buffer = this._buffer,
        bytes = buffer.readVarint(),
        end = buffer.pos + bytes,
        layer = new VectorTileLayer(buffer, end);

    buffer.pos = end;

    return layer;
};

},{"./vectortilelayer":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilelayer.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilefeature.js":[function(require,module,exports){
'use strict';

var Point = require('point-geometry');

module.exports = VectorTileFeature;

function VectorTileFeature(buffer, end, extent, keys, values) {

    this.properties = {};

    // Public
    this.extent = extent;
    this.type = 0;

    // Private
    this._buffer = buffer;
    this._geometry = -1;

    end = end || buffer.length;

    while (buffer.pos < end) {
        var val = buffer.readVarint(),
            tag = val >> 3;

        if (tag == 1) {
            this._id = buffer.readVarint();

        } else if (tag == 2) {
            var tagEnd = buffer.pos + buffer.readVarint();

            while (buffer.pos < tagEnd) {
                var key = keys[buffer.readVarint()];
                var value = values[buffer.readVarint()];
                this.properties[key] = value;
            }

        } else if (tag == 3) {
            this.type = buffer.readVarint();

        } else if (tag == 4) {
            this._geometry = buffer.pos;
            buffer.skip(val);

        } else {
            buffer.skip(val);
        }
    }
}

VectorTileFeature.types = ['Unknown', 'Point', 'LineString', 'Polygon'];

VectorTileFeature.prototype.loadGeometry = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint(),
        end = buffer.pos + bytes,
        cmd = 1,
        length = 0,
        x = 0,
        y = 0,
        lines = [],
        line;

    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd === 1 || cmd === 2) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();

            if (cmd === 1) {
                // moveTo
                if (line) {
                    lines.push(line);
                }
                line = [];
            }

            line.push(new Point(x, y));
        } else if (cmd === 7) {
            // closePolygon
            line.push(line[0].clone());
        } else {
            throw new Error('unknown command ' + cmd);
        }
    }

    if (line) lines.push(line);

    return lines;
};

VectorTileFeature.prototype.bbox = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint(),
        end = buffer.pos + bytes,

        cmd = 1,
        length = 0,
        x = 0,
        y = 0,
        x1 = Infinity,
        x2 = -Infinity,
        y1 = Infinity,
        y2 = -Infinity;

    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd === 1 || cmd === 2) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();
            if (x < x1) x1 = x;
            if (x > x2) x2 = x;
            if (y < y1) y1 = y;
            if (y > y2) y2 = y;

        } else if (cmd !== 7) {
            throw new Error('unknown command ' + cmd);
        }
    }

    return [x1, y1, x2, y2];
};

},{"point-geometry":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/point-geometry/index.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilelayer.js":[function(require,module,exports){
'use strict';

var VectorTileFeature = require('./vectortilefeature.js');

module.exports = VectorTileLayer;
function VectorTileLayer(buffer, end) {
    // Public
    this.version = 1;
    this.name = null;
    this.extent = 4096;
    this.length = 0;

    // Private
    this._buffer = buffer;
    this._keys = [];
    this._values = [];
    this._features = [];

    var val, tag;

    end = end || buffer.length;

    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag === 15) {
            this.version = buffer.readVarint();
        } else if (tag === 1) {
            this.name = buffer.readString();
        } else if (tag === 5) {
            this.extent = buffer.readVarint();
        } else if (tag === 2) {
            this.length++;
            this._features.push(buffer.pos);
            buffer.skip(val);

        } else if (tag === 3) {
            this._keys.push(buffer.readString());
        } else if (tag === 4) {
            this._values.push(this.readFeatureValue());
        } else {
            buffer.skip(val);
        }
    }
}

VectorTileLayer.prototype.readFeatureValue = function() {
    var buffer = this._buffer,
        value = null,
        bytes = buffer.readVarint(),
        end = buffer.pos + bytes,
        val, tag;

    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            value = buffer.readString();
        } else if (tag == 2) {
            throw new Error('read float');
        } else if (tag == 3) {
            value = buffer.readDouble();
        } else if (tag == 4) {
            value = buffer.readVarint();
        } else if (tag == 5) {
            throw new Error('read uint');
        } else if (tag == 6) {
            value = buffer.readSVarint();
        } else if (tag == 7) {
            value = Boolean(buffer.readVarint());
        } else {
            buffer.skip(val);
        }
    }

    return value;
};

// return feature `i` from this layer as a `VectorTileFeature`
VectorTileLayer.prototype.feature = function(i) {
    if (i < 0 || i >= this._features.length) throw new Error('feature index out of bounds');

    this._buffer.pos = this._features[i];
    var end = this._buffer.readVarint() + this._buffer.pos;

    return new VectorTileFeature(this._buffer, end, this.extent, this._keys, this._values);
};

},{"./vectortilefeature.js":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilefeature.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTFeature.js":[function(require,module,exports){
/**
 * Created by Ryan Whitley, Daniel Duarte, and Nicholas Hallahan
 *    on 6/03/14.
 */

var StaticLabel = require('./StaticLabel/StaticLabel.js');

module.exports = MVTFeature;

function MVTFeature(mvtLayer, vtf, ctx, id, style) {
  if (!vtf) return null;

  for (var key in vtf) {
    this[key] = vtf[key];
  }

  this.mvtLayer = mvtLayer;
  this.mvtSource = mvtLayer.mvtSource;
  this.map = mvtLayer.mvtSource._map;

  this.id = id;

  this.layerLink = this.mvtSource.layerLink;
  this.toggleEnabled = true;
  this.selected = false;

  // how much we divide the coordinate from the vector tile
  this.divisor = vtf.extent / ctx.tileSize;
  this.extent = vtf.extent;
  this.tileSize = ctx.tileSize;

  //An object to store the paths and contexts for this feature
  this.tiles = {};

  if (!this.tiles[ctx.zoom]) this.tiles[ctx.zoom] = {};

  this.style = style;

  this._canvasIDToFeaturesForZoom = {};
  this._eventHandlers = {};

  //Add to the collection
  this.addTileFeature(vtf, ctx);

  if (typeof style.dynamicLabel === 'function') {
    this.featureLabel = this.mvtSource.dynamicLabel.createFeature(this);
  }
}

MVTFeature.prototype.draw = function(vtf, ctx) {
  if (this.selected) {
    var style = this.style.selected || this.style;
  } else {
    var style = this.style;
  }

  switch (vtf.type) {
    case 1: //Point
      this._drawPoint(ctx, vtf.coordinates, style);
      if (typeof this.style.staticLabel === 'function') {
        this._drawStaticLabel(ctx, vtf.coordinates, style);
      }
      break;

    case 2: //LineString
      this._drawLineString(ctx, vtf.coordinates, style);
      break;

    case 3: //Polygon
      this._drawPolygon(ctx, vtf.coordinates, style);
      break;

    default:
      throw new Error('Unmanaged type: ' + vtf.type);
  }

};

MVTFeature.prototype.getPathsForTile = function(canvasID, zoom) {
  //Get the info from the parts list
  return this.tiles[zoom][canvasID].paths;
};

MVTFeature.prototype.addTileFeature = function(vtf, ctx) {

  //Store the parts of the feature for a particular zoom level
  var zoom = ctx.zoom;
  if (!this.tiles[ctx.zoom]) this.tiles[ctx.zoom] = {};

  //Store the important items in the parts list
  this.tiles[zoom][ctx.id] = {
    ctx: ctx,
    vtf: vtf,
    paths: []
  };
};


MVTFeature.prototype.getTileInfo = function(canvasID, zoom) {
  //Get the info from the parts list
  return this.tiles[zoom][canvasID];
};

MVTFeature.prototype.setStyle = function(style) {
  //Set this feature's style and redraw all canvases that this thing is a part of
  this.style = style;
  this._eventHandlers["styleChanged"](this.tiles);
};

MVTFeature.prototype.toggle = function() {
  if (this.selected) {
    this.deselect();
  } else {
    this.select();
  }
};

MVTFeature.prototype.select = function() {
  this.selected = true;
  this._eventHandlers["styleChanged"](this.tiles);
  var linkedFeature = this.linkedFeature();
  if (linkedFeature.staticLabel && !linkedFeature.staticLabel.selected) {
    linkedFeature.staticLabel.select();
  }
};

MVTFeature.prototype.deselect = function() {
  this.selected = false;
  this._eventHandlers["styleChanged"](this.tiles);
  var linkedFeature = this.linkedFeature();
  if (linkedFeature.staticLabel && linkedFeature.staticLabel.selected) {
    linkedFeature.staticLabel.deselect();
  }
};

MVTFeature.prototype.on = function(eventType, callback) {
  this._eventHandlers[eventType] = callback;
};

MVTFeature.prototype._drawPoint = function(ctx, coordsArray, style) {
  if (!style) return;

  var part = this.tiles[ctx.zoom][ctx.id];

  var radius = 1;
  if (typeof style.radius === 'function') {
    radius = style.radius(ctx.zoom); //Allows for scale dependent rednering
  }
  else{
    radius = style.radius;
  }

  var p = this._tilePoint(coordsArray[0][0]);
  var c = ctx.canvas;
  var g = c.getContext('2d');
  g.beginPath();
  g.fillStyle = style.color;
  g.arc(p.x, p.y, radius, 0, Math.PI * 2);
  g.closePath();
  g.fill();
  g.restore();
  part.paths.push([p]);
};

MVTFeature.prototype._drawStaticLabel = function(ctx, coordsArray, style) {
  if (!style) return;

  var vecPt = this._tilePoint(coordsArray[0][0]);

  // We're making a standard Leaflet Marker for this label.
  var p = this._project(vecPt, ctx.tile.x, ctx.tile.y, this.extent, this.tileSize); //vectile pt to merc pt
  var mercPt = L.point(p.x, p.y); // make into leaflet obj
  var latLng = this.map.unproject(mercPt); // merc pt to latlng

  this.staticLabel = new StaticLabel(this, ctx, latLng, style);
};



/**
 * Projects a vector tile point to the Spherical Mercator pixel space for a given zoom level.
 *
 * @param vecPt
 * @param tileX
 * @param tileY
 * @param extent
 * @param tileSize
 */
MVTFeature.prototype._project = function(vecPt, tileX, tileY, extent, tileSize) {
  var xOffset = tileX * tileSize;
  var yOffset = tileY * tileSize;
  return {
    x: Math.floor(vecPt.x + xOffset),
    y: Math.floor(vecPt.y + yOffset)
  };
};

MVTFeature.prototype._drawLineString = function(ctx, coordsArray, style) {
  if (!style) return;

  var g = ctx.canvas.getContext('2d');
  g.strokeStyle = style.color;
  g.lineWidth = style.size;
  g.beginPath();

  var projCoords = [];
  var part = this.tiles[ctx.zoom][ctx.id];

  for (var gidx in coordsArray) {
    var coords = coordsArray[gidx];

    for (i = 0; i < coords.length; i++) {
      var method = (i === 0 ? 'move' : 'line') + 'To';
      var proj = this._tilePoint(coords[i]);
      projCoords.push(proj);
      g[method](proj.x, proj.y);
    }
  }

  g.stroke();
  g.restore();

  part.paths.push(projCoords);
};

MVTFeature.prototype._drawPolygon = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx.canvas) return;

  var g = ctx.canvas.getContext('2d');
  var outline = style.outline;
  g.fillStyle = style.color;
  if (outline) {
    g.strokeStyle = outline.color;
    g.lineWidth = outline.size;
  }
  g.beginPath();

  var projCoords = [];
  var part = this.tiles[ctx.zoom][ctx.id];

  var featureLabel = this.featureLabel;
  if (featureLabel) {
    featureLabel.addTilePolys(ctx, coordsArray);
  }

  for (var gidx = 0, len = coordsArray.length; gidx < len; gidx++) {
    var coords = coordsArray[gidx];

    for (var i = 0; i < coords.length; i++) {
      var coord = coords[i];
      var method = (i === 0 ? 'move' : 'line') + 'To';
      var proj = this._tilePoint(coords[i]);
      projCoords.push(proj);
      g[method](proj.x, proj.y);
    }
  }

  g.closePath();
  g.fill();
  if (outline) {
    g.stroke();
  }

  part.paths.push(projCoords);

};

/**
 * Takes a coordinate from a vector tile and turns it into a Leaflet Point.
 *
 * @param ctx
 * @param coords
 * @returns {eGeomType.Point}
 * @private
 */
MVTFeature.prototype._tilePoint = function(coords) {
  return new L.Point(coords.x / this.divisor, coords.y / this.divisor);
};

MVTFeature.prototype.linkedFeature = function() {
  var linkedLayer = this.mvtLayer.linkedLayer();
  var linkedFeature = linkedLayer.features[this.id];
  return linkedFeature;
};
},{"./StaticLabel/StaticLabel.js":"/Users/nick/Public/Leaflet.MapboxVectorTile/src/StaticLabel/StaticLabel.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTLayer.js":[function(require,module,exports){
/**
 * Created by Ryan Whitley on 5/17/14.
 */
/** Forked from https://gist.github.com/DGuidi/1716010 **/
var L = require('leaflet');
var MVTFeature = require('./MVTFeature');
var Util = require('./MVTUtil');

module.exports = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    isHiddenLayer: false,
    getIDForLayerFeature: function() {},
    tileSize: 256
  },

  _featureIsClicked: {},

  _isPointInPoly: function(pt, poly) {
    if(poly && poly.length) {
      for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
        ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
        && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
        && (c = !c);
      return c;
    }
  },

  initialize: function(mvtSource, options) {
    var self = this;
    self.mvtSource = mvtSource;
    L.Util.setOptions(this, options);

    this.styleFor = options.styleFor;
    this.name = options.name;
    this._canvasIDToFeaturesForZoom = {};
    this.visible = true;
    this.features = {};
    this.featuresWithLabels = [];
  },

  drawTile: function(canvas, tilePoint, zoom) {

    var ctx = {
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    ctx.id = Util.getContextID(ctx);

    if (!this._canvasIDToFeaturesForZoom[ctx.id]) {
      this._canvasIDToFeaturesForZoom[ctx.id] = {};
      this._canvasIDToFeaturesForZoom[ctx.id]['features'] = [];
      this._canvasIDToFeaturesForZoom[ctx.id]['canvas'] = canvas;
    }
    if (!this.features) {
      this.features = {};
    }



    //this._resetCanvasIDToFeaturesForZoomState(ctx.id, canvas, zoom);
  },

  _draw: function(ctx) {
    //Draw is handled by the parent MVTSource object
  },
  getCanvas: function(parentCtx){
    //This gets called if a vector tile feature has already been parsed.
    //We've already got the geom, just get on with the drawing.
    //Need a way to pluck a canvas element from this layer given the parent layer's id.
    //Wait for it to get loaded before proceeding.
    var tilePoint = parentCtx.tile;
    var ctx = this._tiles[tilePoint.x + ":" + tilePoint.y];

    if(ctx){
      parentCtx.canvas = ctx;
      this.redrawTile(parentCtx.id, parentCtx.zoom);
      return;
    }

    var self = this;

    //This is a timer that will wait for a criterion to return true.
    //If not true within the timeout duration, it will move on.
    waitFor(function () {
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        if(ctx) {
          return true;
        }
      },
      function(){
        //When it finishes, do this.
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        parentCtx.canvas = ctx;
        self.redrawTile(parentCtx.id, parentCtx.zoom, parentCtx);

      }, //when done, go to next flow
      2000); //The Timeout milliseconds.  After this, give up and move on

  },

  parseVectorTileLayer: function(vtl, ctx) {
    var self = this;
    var tilePoint = ctx.tile;

    //See if we can pluck the child tile from this PBF tile layer based on the master layer's tile id.
    ctx.canvas = self._tiles[tilePoint.x + ":" + tilePoint.y];

    //Clear tile -- TODO: Add flag so this only happens when a layer is being turned back on after being hidden
    if(ctx.canvas) ctx.canvas.width = ctx.canvas.width;

    var features = vtl.parsedFeatures;
    for (var i = 0, len = features.length; i < len; i++) {
      var vtf = features[i]; //vector tile feature
      vtf.layer = vtl;

      /**
       * Apply filter on feature if there is one. Defined in the options object
       * of TileLayer.MVTSource.js
       */
      var filter = self.options.filter;
      if (typeof filter === 'function') {
        if ( filter(vtf, ctx) === false ) continue;
      }

      var getIDForLayerFeature;
      if (typeof self.options.getIDForLayerFeature === 'function') {
        getIDForLayerFeature = self.options.getIDForLayerFeature;
      } else {
        getIDForLayerFeature = Util.getIDForLayerFeature;
      }
      var uniqueID = self.options.getIDForLayerFeature(vtf) || i;
      var mvtFeature = self.features[uniqueID];

      //Create a new MVTFeature if one doesn't already exist for this feature.
      if (!mvtFeature) {
        //Get a style for the feature - set it just once for each new MVTFeature
        var style = self.styleFor(vtf);

        //create a new feature
        self.features[uniqueID] = mvtFeature = new MVTFeature(self, vtf, ctx, uniqueID, style, this._map);
        if (typeof style.dynamicLabel === 'function') {
          self.featuresWithLabels.push(mvtFeature);
        }
      } else {
        //Add the new part to the existing feature
        mvtFeature.addTileFeature(vtf, ctx);
      }

      //Associate & Save this feature with this tile for later
      if(ctx && ctx.id) self._canvasIDToFeaturesForZoom[ctx.id]['features'].push(mvtFeature);

      //Subscribe to style changes for feature
      mvtFeature.on("styleChanged", function(parts) {
        //Redraw the whole tile, not just this vtf
        var zoom = self._map._zoom;

        for (var id in parts[zoom]) {
          var part = parts[zoom][id];
          //Clear the tile
          self.clearTile(part.ctx);

          //Redraw the tile
          self.redrawTile(id, part.ctx.zoom, part.ctx);
        }

      });

      //Tell it to draw
      //mvtFeature.draw(vtf, ctx);
    }

    //If a z-order function is specified, wait unitl all features have been iterated over until drawing (here)
    self.redrawTile(ctx.id, ctx.zoom, ctx);


    for (var j = 0, len = self.featuresWithLabels.length; j < len; j++) {
      var feat = self.featuresWithLabels[j];
      debug.feat = feat;

    }
  },

  // NOTE: a placeholder for a function that, given a feature, returns a style object used to render the feature itself
  styleFor: function(feature) {
    // override with your code
  },

  //This is the old way.  It works, but is slow for mouseover events.  Fine for click events.
  handleClickEvent: function(evt, cb) {
    //Click happened on the GroupLayer (Manager) and passed it here
    var tileID = evt.tileID.split(":").slice(1, 3).join(":");
    var canvas = this._tiles[tileID];
    if(!canvas) (cb(evt)); //break out
    var x = evt.layerPoint.x - canvas._leaflet_pos.x;
    var y = evt.layerPoint.y - canvas._leaflet_pos.y;

    var tilePoint = {x: x, y: y};
    var features = this._canvasIDToFeaturesForZoom[evt.tileID].features;
    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      var paths = feature.getPathsForTile(evt.tileID, this._map.getZoom());
      for (var j = 0; j < paths.length; j++) {
        if (this._isPointInPoly(tilePoint, paths[j])) {
          if (feature.toggleEnabled) {
            feature.toggle();
          }
          evt.feature = feature;
          cb(evt);
          return;
        }
      }
    }
    //no match
    //return evt with empty feature
    evt.feature = null;
    cb(evt);
  },

  clearTile: function(ctx) {
    ctx.canvas.width = ctx.canvas.width;
  },

  redrawTile: function(canvasID, zoom, ctx) {
    //Get the features for this tile, and redraw them.
    var features = this._canvasIDToFeaturesForZoom[canvasID]['features'];

    //if z-index function is specified, sort the features so they draw in the correct order, bottom points draw first.

    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      var tileInfo = feature.getTileInfo(canvasID, zoom);
      feature.draw(tileInfo.vtf, ctx);
    }


  },

  _resetCanvasIDToFeaturesForZoomState: function(canvasID, canvas, zoom) {

    this._canvasIDToFeaturesForZoom[canvasID] = {};
    this._canvasIDToFeaturesForZoom[canvasID]['features'] = [];
    this._canvasIDToFeaturesForZoom[canvasID]['canvas'] = canvas;

  },

  linkedLayer: function() {
    var linkName = this.mvtSource.layerLink(this.name);
    return this.mvtSource.layers[linkName];
  }

});

/**
 * See https://github.com/ariya/phantomjs/blob/master/examples/waitfor.js
 *
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 */
function waitFor(testFx, onReady, timeOutMillis) {
  var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
    start = new Date().getTime(),
    condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()), //< defensive code
    interval = setInterval(function () {
      if ((new Date().getTime() - start < maxtimeOutMillis) && !condition) {
        // If not time-out yet and condition not yet fulfilled
        condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
      } else {
        if (!condition) {
          // If condition still not fulfilled (timeout but condition is 'false')
          console.log("'waitFor()' timeout");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('timeout'); //< Do what it's supposed to do once the condition is fulfilled
        } else {
          // Condition fulfilled (timeout and/or condition is 'true')
          console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('success'); //< Do what it's supposed to do once the condition is fulfilled
        }
      }
    }, 50); //< repeat check every 50ms
};
},{"./MVTFeature":"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTFeature.js","./MVTUtil":"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTUtil.js","leaflet":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/leaflet/dist/leaflet-src.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTPointLayer.js":[function(require,module,exports){
/**
 * Created by Ryan Whitley on 9/8/14.
 */
/** Forked from https://gist.github.com/DGuidi/1716010 **/
var L = require('leaflet');
var Util = require('./MVTUtil');

module.exports = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    isHiddenLayer: false,
    getIDForLayerFeature: function() {},
    tileSize: 256
  },

  _featureIsClicked: {},

  _isPointInPoly: function(pt, poly) {
    if(poly && poly.length) {
      for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
        ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
        && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
        && (c = !c);
      return c;
    }
  },

  initialize: function(mvtSource, options) {
    var self = this;
    self.mvtSource = mvtSource;
    L.Util.setOptions(this, options);

    this.styleFor = options.styleFor;
    this.name = options.name;

    this.visible = true;
    this.features = {};
    this.featuresWithLabels = [];
    this.zIndexSortOrder = [];
  },

  drawTile: function(canvas, tilePoint, zoom) {

    var ctx = {
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    ctx.id = Util.getContextID(ctx);

    if (!this.features) {
      this.features = {};
    }

  },

  _draw: function(ctx) {
    //Draw is handled by the parent MVTSource object
  },
  getCanvas: function(parentCtx, vtl){
    //Need a way to pluck a canvas element from this layer given the parent layer's id.
    //Wait for it to get loaded before proceeding.
    var tilePoint = parentCtx.tile;
    var ctx = this._tiles[tilePoint.x + ":" + tilePoint.y];

    if(ctx){
      parentCtx.canvas = ctx;
      this.parseVectorTileLayer(vtl, parentCtx);
      return;
    }

    var self = this;

    //This is a timer that will wait for a criterion to return true.
    //If not true within the timeout duration, it will move on.
    waitFor(function () {
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        if(ctx) {
          return true;
        }
      },
      function(){
        //When it finishes, do this.
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        parentCtx.canvas = ctx;
        self.parseVectorTileLayer(vtl, parentCtx);

      }, //when done, go to next flow
      2000); //The Timeout milliseconds.  After this, give up and move on

  },

  parseVectorTileLayer: function(vtl, ctx) {
    var self = this;
    var tilePoint = ctx.tile;

    //See if we can pluck the same tile from this local tile layer
    ctx.canvas = self._tiles[tilePoint.x + ":" + tilePoint.y];

    //Clear tile -- TODO: Add flag so this only happens when a layer is being turned back on after being hidden
    if(ctx.canvas) ctx.canvas.width = ctx.canvas.width;

    var features = this.features = vtl.parsedFeatures;
    for (var i = 0, len = features.length; i < len; i++) {
      var vtf = features[i] //vector tile feature

      if(i === 0){
        // how much we divide the coordinate from the vector tile
        this.divisor = vtf.extent / ctx.tileSize;
        this.extent = vtf.extent;
        this.tileSize = ctx.tileSize;
      }

      /**
       * Apply filter on feature if there is one. Defined in the options object
       * of TileLayer.MVTSource.js
       */
      var filter = self.options.filter;
      if (typeof filter === 'function') {
        if ( filter(vtf, ctx) === false ) continue;
      }

      var layerOrdering = self.options.layerOrdering;
      if (typeof layerOrdering === 'function') {
        layerOrdering(vtf, ctx); //Applies a custom property to the feature, which is used after we're thru iterating to sort
      }
    }

    //If a z-order function is specified, wait unitl all features have been iterated over until drawing (here)
    /**
     * Apply sorting (zIndex) on feature if there is a function defined in the options object
     * of TileLayer.MVTSource.js
     */
    var layerOrdering = self.options.layerOrdering;
    if (layerOrdering) {
      //We've assigned the custom zIndex property when iterating above.  Now just sort.
      self.zIndexSortOrder = Object.keys(this.features).sort(function(a, b) {
        return -(self.features[b].properties.zIndex - self.features[a].properties.zIndex)
      });
    }

    self.redrawTile(ctx.id, ctx.zoom, ctx);

    for (var j = 0, len = self.featuresWithLabels.length; j < len; j++) {
      var feat = self.featuresWithLabels[j];
      debug.feat = feat;

    }
  },

  // NOTE: a placeholder for a function that, given a feature, returns a style object used to render the feature itself
  styleFor: function(feature) {
    // override with your code
  },

  //This is the old way.  It works, but is slow for mouseover events.  Fine for click events.
  handleClickEvent: function(evt, cb) {
    //Click happened on the GroupLayer (Manager) and passed it here
    var tileID = evt.tileID.split(":").slice(1, 3).join(":");
    var canvas = this._tiles[tileID];
    if(!canvas) (cb(evt)); //break out
    var x = evt.layerPoint.x - canvas._leaflet_pos.x;
    var y = evt.layerPoint.y - canvas._leaflet_pos.y;

    var tilePoint = {x: x, y: y};
    var features = this._canvasIDToFeaturesForZoom[evt.tileID].features; //Switch this.  Not storing this for point.
    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      var paths = feature.getPathsForTile(evt.tileID, this._map.getZoom());
      for (var j = 0; j < paths.length; j++) {
        if (this._isPointInPoly(tilePoint, paths[j])) {
          if (feature.toggleEnabled) {
            feature.toggle();
          }
          evt.feature = feature;
          cb(evt);
          return;
        }
      }
    }
    //no match
    //return evt with empty feature
    evt.feature = null;
    cb(evt);
  },

  clearTile: function(ctx) {
    ctx.canvas.width = ctx.canvas.width;
  },

  redrawTile: function(canvasID, zoom, ctx) {
    //Get the features for this tile, and redraw them.
    var features = this.features;

    //if z-index function is specified, sort the features so they draw in the correct order, bottom points draw first.
    if(this.zIndexSortOrder && this.zIndexSortOrder.length > 0){
      //Loop in specific order
      for (var i = 0; i < this.zIndexSortOrder.length; i++) {
        var id = this.zIndexSortOrder[i];
        var feature = features[id];
        if(feature){
          this.drawPoint(ctx, feature.coordinates, this.styleFor(feature));
        }
      }
    }
    else{
      //Just loop already
      for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        this.drawPoint(ctx, feature.coordinates, this.styleFor(feature));
      }
    }

    //Remove features
    this.features = {};
  },

  linkedLayer: function() {
    var linkName = this.mvtSource.layerLink(this.name);
    return this.mvtSource.layers[linkName];
  },

  drawPoint: function(ctx, coordsArray, style) {
    if (!style) return;

    var radius = 1;
    if (typeof style.radius === 'function') {
      radius = style.radius(ctx.zoom); //Allows for scale dependent rednering
    }
    else {
      radius = style.radius;
    }

    var p = this._tilePoint(coordsArray[0][0]);
    var c = ctx.canvas;
    var g = c.getContext('2d');
    g.beginPath();
    g.fillStyle = style.color;
    g.arc(p.x, p.y, radius, 0, Math.PI * 2);
    g.closePath();
    g.fill();
    g.restore();
  },
  /**
   * Takes a coordinate from a vector tile and turns it into a Leaflet Point.
   *
   * @param ctx
   * @param coords
   * @returns {eGeomType.Point}
   * @private
   */
  _tilePoint: function(coords) {
    return new L.Point(coords.x / this.divisor, coords.y / this.divisor);
  }

});

/**
 * See https://github.com/ariya/phantomjs/blob/master/examples/waitfor.js
 *
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 */
function waitFor(testFx, onReady, timeOutMillis) {
  var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
    start = new Date().getTime(),
    condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()), //< defensive code
    interval = setInterval(function () {
      if ((new Date().getTime() - start < maxtimeOutMillis) && !condition) {
        // If not time-out yet and condition not yet fulfilled
        condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
      } else {
        if (!condition) {
          // If condition still not fulfilled (timeout but condition is 'false')
          console.log("'waitFor()' timeout");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('timeout'); //< Do what it's supposed to do once the condition is fulfilled
        } else {
          // Condition fulfilled (timeout and/or condition is 'true')
          console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('success'); //< Do what it's supposed to do once the condition is fulfilled
        }
      }
    }, 50); //< repeat check every 50ms
};
},{"./MVTUtil":"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTUtil.js","leaflet":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/leaflet/dist/leaflet-src.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTSource.js":[function(require,module,exports){
var L = require('leaflet');
var VectorTile = require('vector-tile').VectorTile;
var Protobuf = require('pbf');
var Point = require('point-geometry');

var Util = require('./MVTUtil');
var MVTLayer = require('./MVTLayer');
var MVTPointLayer = require('./MVTPointLayer');


module.exports = L.TileLayer.MVTSource = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    url: "", //URL TO Vector Tile Source,
    clickableLayers: [], //which layers inside the vector tile should have click events?
    getIDForLayerFeature: function() {},
    tileSize: 256
  },
  layers: {}, //Keep a list of the layers contained in the PBFs
  processedTiles: {}, //Keep a list of tiles that have been processed already
  _eventHandlers: {},
  styleFor: function() {},


  initialize: function(options) {
    L.Util.setOptions(this, options);

    //a list of the layers contained in the PBFs
    this.layers = {};

    // tiles currently in the viewport
    this.activeTiles = {};

    // thats that have been loaded and drawn
    this.loadedTiles = {};

    this.styleFor = options.styleFor;

    this.layerLink = options.layerLink;

    this._eventHandlers = {};

    this._tilesToProcess = 0; //store the max number of tiles to be loaded.  Later, we can use this count to count down PBF loading.

  },

  onAdd: function(map) {
    var self = this;
    L.TileLayer.Canvas.prototype.onAdd.call(this, map);

//    determineActiveTiles(self, map);
//    map.on('moveend', function(evt) {
//      determineActiveTiles(self, map);
//    });

    if (typeof DynamicLabel === 'function' ) {
      this.dynamicLabel = new DynamicLabel(map, this, {});
    }

  },

  drawTile: function(canvas, tilePoint, zoom) {
    var ctx = {
      id: [zoom, tilePoint.x, tilePoint.y].join(":"),
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    //Capture the max number of the tiles to load here. this._tilesToProcess is an internal number we use to know when we've finished requesting PBFs.
    if(this._tilesToProcess < this._tilesToLoad) this._tilesToProcess = this._tilesToLoad;

    var id = ctx.id = Util.getContextID(ctx);
    this.activeTiles[id] = ctx;

    if(!this.processedTiles[ctx.zoom]) this.processedTiles[ctx.zoom] = {};

    if (this.options.debug) {
      this._drawDebugInfo(ctx);
    }
    this._draw(ctx);
  },

  setOpacity:function(opacity) {
    this._setVisibleLayersStyle('opacity',opacity);
  },

  setZIndex:function(zIndex) {
    this._setVisibleLayersStyle('zIndex',zIndex);
  },

  _setVisibleLayersStyle:function(style, value) {
    for(var key in this.layers) {
      this.layers[key]._tileContainer.style[style] = value;
    }
  },

  _drawDebugInfo: function(ctx) {
    var max = this.options.tileSize;
    var g = ctx.canvas.getContext('2d');
    g.strokeStyle = '#000000';
    g.fillStyle = '#FFFF00';
    g.strokeRect(0, 0, max, max);
    g.font = "12px Arial";
    g.fillRect(0, 0, 5, 5);
    g.fillRect(0, max - 5, 5, 5);
    g.fillRect(max - 5, 0, 5, 5);
    g.fillRect(max - 5, max - 5, 5, 5);
    g.fillRect(max / 2 - 5, max / 2 - 5, 10, 10);
    g.strokeText(ctx.zoom + ' ' + ctx.tile.x + ' ' + ctx.tile.y, max / 2 - 30, max / 2 - 10);
  },

  _draw: function(ctx) {
    var self = this;

    //This works to skip fetching and processing tiles if they've already been processed.
    var vectorTile = this.processedTiles[ctx.zoom][ctx.id];
    //if we've already parsed it, don't get it again.
    if(vectorTile){
      console.log("Skipping fetching " + ctx.id);
      self.parseVectorTile(parseVT(vectorTile), ctx, true);
      self.reduceTilesToProcessCount();
      return;
    }

    if (!this.options.url) return;
    var url = self.options.url.replace("{z}", ctx.zoom).replace("{x}", ctx.tile.x).replace("{y}", ctx.tile.y);

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      if (xhr.status == "200") {

        if(!xhr.response) return;

        var arrayBuffer = new Uint8Array(xhr.response);
        var buf = new Protobuf(arrayBuffer);
        var vt = new VectorTile(buf);
        self.parseVectorTile(parseVT(vt), ctx);
        tileLoaded(self, ctx);
      }
      else {
        console.log("xhr.status = " + xhr.status);
      }
    };

    xhr.onerror = function() {
      console.log("xhr error: " + xhr.errorCode)
    };

    xhr.open('GET', url, true); //async is true
    xhr.responseType = 'arraybuffer';
    xhr.send();

    //either way, reduce the count of tilesToProcess tiles here
    self.reduceTilesToProcessCount();
  },

  reduceTilesToProcessCount: function(){
    this._tilesToProcess--;
    if(!this._tilesToProcess){
      //Trigger event letting us know that all PBFs have been loaded and processed (or 404'd).
      if(this._eventHandlers["PBFLoad"]) this._eventHandlers["PBFLoad"]();
    }
  },

  parseVectorTile: function(vt, ctx, parsed) {
    var self = this;

    for (var key in vt.layers) {
      var lyr = vt.layers[key];
      if (!self.layers[key]) {
        //Create MVTLayer or MVTPointLayer for user
        self.layers[key] = self.createPBFLayer(key, lyr.parsedFeatures[0].type || null);
      }

      //If layer is marked as visible, examine the contents.
      if (self.layers[key].visible === true) {
        if(parsed){
          //We've already parsed it.  Go get canvas and draw.
          self.layers[key].getCanvas(ctx, lyr);
        }else{
          self.layers[key].parseVectorTileLayer(lyr, ctx);

          //if we have a reasonable amount of features inside, lets store it in memory.  Otherwise, fetch every time to avoid memory pileup.
          if(lyr.parsedFeatures.length < 25){
            this.processedTiles[ctx.zoom][ctx.id] = vt;
          }
        }
      }
    }

    //Make sure manager layer is always in front
    this.bringToFront();
  },

  createPBFLayer: function(key, type) {
    var self = this;

    var getIDForLayerFeature;
    if (typeof self.options.getIDForLayerFeature === 'function') {
      getIDForLayerFeature = self.options.getIDForLayerFeature;
    } else {
      getIDForLayerFeature = Util.getIDForLayerFeature;
    }

    //Take the layer and create a new MVTLayer or MVTPointLayer if one doesn't exist.
    var layer;

//    if(type === 1){
//      //Point Layer
//      layer = new L.TileLayer.MVTPointLayer(self, {
//        getIDForLayerFeature: getIDForLayerFeature,
//        filter: self.options.filter,
//        layerOrdering: self.options.layerOrdering,
//        styleFor: self.styleFor,
//        name: key,
//        asynch: true
//      }).addTo(self._map);
//    }else{
      //Polygon/Line Layer
      layer = new MVTLayer(self, {
        getIDForLayerFeature: getIDForLayerFeature,
        filter: self.options.filter,
        layerOrdering: self.options.layerOrdering,
        styleFor: self.styleFor,
        name: key,
        asynch: true
      }).addTo(self._map);
    //}

    return layer;
  },

  getLayers: function() {
    return this.layers;
  },

  hideLayer: function(id) {
    if (this.layers[id]) {
      this._map.removeLayer(this.layers[id]);
      this.layers[id].visible = false;
    }
  },

  showLayer: function(id) {
    if (this.layers[id]) {
      this.layers[id].visible = true;
      this._map.addLayer(this.layers[id]);
    }
    //Make sure manager layer is always in front
    this.bringToFront();
  },

  removeChildLayers: function(map){
    //Remove child layers of this group layer
    for (var key in this.layers) {
      var layer = this.layers[key];
      map.removeLayer(layer);
    }
  },

  bind: function(eventType, callback) {
    this._eventHandlers[eventType] = callback;
  },

  onClick: function(evt, cb) {
    //Here, pass the event on to the child MVTLayer and have it do the hit test and handle the result.
    var self = this;

    evt.tileID =  getTileURL(evt.latlng.lat, evt.latlng.lng, this._map.getZoom());

    //If no layer is specified as clickable, just use the 1st one.
    if(this.options.clickableLayers.length == 0) {
      var names = Object.keys(self.layers);
      self.layers[names[0]].handleClickEvent(evt, function (evt) {
        cb(evt);
      });
    }
    else{
      for (var key in this.layers) {
        var layer = this.layers[key];
        if(self.options.clickableLayers.indexOf(key) > -1){
          layer.handleClickEvent(evt, function(evt) {
            cb(evt);
          });
        }
      }
    }
  }
});


if (typeof(Number.prototype.toRad) === "undefined") {
  Number.prototype.toRad = function() {
    return this * Math.PI / 180;
  }
}

function getTileURL(lat, lon, zoom) {
  var xtile = parseInt(Math.floor( (lon + 180) / 360 * (1<<zoom) ));
  var ytile = parseInt(Math.floor( (1 - Math.log(Math.tan(lat.toRad()) + 1 / Math.cos(lat.toRad())) / Math.PI) / 2 * (1<<zoom) ));
  return "" + zoom + ":" + xtile + ":" + ytile;
}

function tileLoaded(pbfSource, ctx) {
  pbfSource.loadedTiles[ctx.id] = ctx;
}

function parseVT(vt){
  for (var key in vt.layers) {
    var lyr = vt.layers[key];
    parseVTFeatures(lyr);
  }
  return vt;
}

function parseVTFeatures(vtl){
  vtl.parsedFeatures = [];
  var features = vtl._features;
  for (var i = 0, len = features.length; i < len; i++) {
    var vtf = vtl.feature(i);
    vtf.coordinates = vtf.loadGeometry();
    vtl.parsedFeatures.push(vtf);
  }
  return vtl;
}

},{"./MVTLayer":"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTLayer.js","./MVTPointLayer":"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTPointLayer.js","./MVTUtil":"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTUtil.js","leaflet":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/leaflet/dist/leaflet-src.js","pbf":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/pbf/index.js","point-geometry":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/point-geometry/index.js","vector-tile":"/Users/nick/Public/Leaflet.MapboxVectorTile/node_modules/vector-tile/index.js"}],"/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTUtil.js":[function(require,module,exports){
/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 8/15/14.
 */

var Util = module.exports = {};

Util.getContextID = function(ctx) {
  return [ctx.zoom, ctx.tile.x, ctx.tile.y].join(":");
};

/**
 * Default function that gets the id for a layer feature.
 * Sometimes this needs to be done in a different way and
 * can be specified by the user in the options for L.TileLayer.MVTSource.
 *
 * @param feature
 * @returns {ctx.id|*|id|string|jsts.index.chain.MonotoneChain.id|number}
 */
Util.getIDForLayerFeature = function(feature) {
  return feature.properties.id;
};

},{}],"/Users/nick/Public/Leaflet.MapboxVectorTile/src/StaticLabel/StaticLabel.js":[function(require,module,exports){
/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 7/31/14.
 */

module.exports = StaticLabel;

function StaticLabel(pbfFeature, ctx, latLng, style) {
  var self = this;
  this.pbfFeature = pbfFeature;
  this.map = pbfFeature.map;
  this.zoom = ctx.zoom;
  this.latLng = latLng;
  var sty = this.style = style.staticLabel();
  this.selected = false;

  var icon = this.icon = L.divIcon({
    className: sty.cssClass || 'label-icon-text',
    html: sty.html || 'No Label',
    iconSize: sty.iconSize || [50,50]
  });

  this.marker = L.marker(latLng, {icon: icon}).addTo(this.map);

  this.marker.on('click', function(e) {
    self.toggle();
  });

  this.map.on('zoomend', function(e) {
    var newZoom = e.target.getZoom();
    if (self.zoom !== newZoom) {
      self.map.removeLayer(self.marker);
    }
  });
}

StaticLabel.prototype.toggle = function() {
  if (this.selected) {
    this.deselect();
  } else {
    this.select();
  }
};

StaticLabel.prototype.select = function() {
  this.selected = true;
  this.marker._icon.classList.add('label-icon-text-selected');
  var linkedFeature = this.pbfFeature.linkedFeature();
  if (!linkedFeature.selected) linkedFeature.select();
};

StaticLabel.prototype.deselect = function() {
  this.selected = false;
  this.marker._icon.classList.remove('label-icon-text-selected');
  var linkedFeature = this.pbfFeature.linkedFeature();
  if (linkedFeature.selected) linkedFeature.deselect();
};

},{}]},{},["/Users/nick/Public/Leaflet.MapboxVectorTile/src/MVTSource.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9uaWNrL1B1YmxpYy9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9uaWNrL1B1YmxpYy9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi9Vc2Vycy9uaWNrL1B1YmxpYy9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCIvVXNlcnMvbmljay9QdWJsaWMvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCIvVXNlcnMvbmljay9QdWJsaWMvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2lzLWFycmF5L2luZGV4LmpzIiwiL1VzZXJzL25pY2svUHVibGljL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvbGVhZmxldC9kaXN0L2xlYWZsZXQtc3JjLmpzIiwiL1VzZXJzL25pY2svUHVibGljL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvcGJmL2luZGV4LmpzIiwiL1VzZXJzL25pY2svUHVibGljL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvcGJmL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiL1VzZXJzL25pY2svUHVibGljL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvcG9pbnQtZ2VvbWV0cnkvaW5kZXguanMiLCIvVXNlcnMvbmljay9QdWJsaWMvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL25vZGVfbW9kdWxlcy92ZWN0b3ItdGlsZS9pbmRleC5qcyIsIi9Vc2Vycy9uaWNrL1B1YmxpYy9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL3ZlY3Rvci10aWxlL2xpYi92ZWN0b3J0aWxlLmpzIiwiL1VzZXJzL25pY2svUHVibGljL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvdmVjdG9yLXRpbGUvbGliL3ZlY3RvcnRpbGVmZWF0dXJlLmpzIiwiL1VzZXJzL25pY2svUHVibGljL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvdmVjdG9yLXRpbGUvbGliL3ZlY3RvcnRpbGVsYXllci5qcyIsIi9Vc2Vycy9uaWNrL1B1YmxpYy9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL01WVEZlYXR1cmUuanMiLCIvVXNlcnMvbmljay9QdWJsaWMvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL3NyYy9NVlRMYXllci5qcyIsIi9Vc2Vycy9uaWNrL1B1YmxpYy9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL01WVFBvaW50TGF5ZXIuanMiLCIvVXNlcnMvbmljay9QdWJsaWMvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL3NyYy9NVlRTb3VyY2UuanMiLCIvVXNlcnMvbmljay9QdWJsaWMvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL3NyYy9NVlRVdGlsLmpzIiwiL1VzZXJzL25pY2svUHVibGljL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9zcmMvU3RhdGljTGFiZWwvU3RhdGljTGFiZWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzOVJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSUE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4VUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzLWFycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIGtNYXhMZW5ndGggPSAweDNmZmZmZmZmXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIE5vdGU6XG4gKlxuICogLSBJbXBsZW1lbnRhdGlvbiBtdXN0IHN1cHBvcnQgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMuXG4gKiAgIEZpcmVmb3ggNC0yOSBsYWNrZWQgc3VwcG9ydCwgZml4ZWQgaW4gRmlyZWZveCAzMCsuXG4gKiAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG4gKlxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXkgd2lsbFxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgd2lsbCB3b3JrIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSAoZnVuY3Rpb24gKCkge1xuICB0cnkge1xuICAgIHZhciBidWYgPSBuZXcgQXJyYXlCdWZmZXIoMClcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIDQyID09PSBhcnIuZm9vKCkgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgbmV3IFVpbnQ4QXJyYXkoMSkuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gc3ViamVjdCA+IDAgPyBzdWJqZWN0ID4+PiAwIDogMFxuICBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGlmIChlbmNvZGluZyA9PT0gJ2Jhc2U2NCcpXG4gICAgICBzdWJqZWN0ID0gYmFzZTY0Y2xlYW4oc3ViamVjdClcbiAgICBsZW5ndGggPSBCdWZmZXIuYnl0ZUxlbmd0aChzdWJqZWN0LCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JyAmJiBzdWJqZWN0ICE9PSBudWxsKSB7IC8vIGFzc3VtZSBvYmplY3QgaXMgYXJyYXktbGlrZVxuICAgIGlmIChzdWJqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkoc3ViamVjdC5kYXRhKSlcbiAgICAgIHN1YmplY3QgPSBzdWJqZWN0LmRhdGFcbiAgICBsZW5ndGggPSArc3ViamVjdC5sZW5ndGggPiAwID8gTWF0aC5mbG9vcigrc3ViamVjdC5sZW5ndGgpIDogMFxuICB9IGVsc2VcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG5cbiAgaWYgKHRoaXMubGVuZ3RoID4ga01heExlbmd0aClcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuXG4gIHZhciBidWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIHR5cGVvZiBzdWJqZWN0LmJ5dGVMZW5ndGggPT09ICdudW1iZXInKSB7XG4gICAgLy8gU3BlZWQgb3B0aW1pemF0aW9uIC0tIHVzZSBzZXQgaWYgd2UncmUgY29weWluZyBmcm9tIGEgdHlwZWQgYXJyYXlcbiAgICBidWYuX3NldChzdWJqZWN0KVxuICB9IGVsc2UgaWYgKGlzQXJyYXlpc2goc3ViamVjdCkpIHtcbiAgICAvLyBUcmVhdCBhcnJheS1pc2ggb2JqZWN0cyBhcyBhIGJ5dGUgYXJyYXlcbiAgICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpKSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3QucmVhZFVJbnQ4KGkpXG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKylcbiAgICAgICAgYnVmW2ldID0gKChzdWJqZWN0W2ldICUgMjU2KSArIDI1NikgJSAyNTZcbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBidWYud3JpdGUoc3ViamVjdCwgMCwgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicgJiYgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmICFub1plcm8pIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGJ1ZltpXSA9IDBcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSlcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuICYmIGFbaV0gPT09IGJbaV07IGkrKykge31cbiAgaWYgKGkgIT09IGxlbikge1xuICAgIHggPSBhW2ldXG4gICAgeSA9IGJbaV1cbiAgfVxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gKGxpc3QsIHRvdGFsTGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVXNhZ2U6IEJ1ZmZlci5jb25jYXQobGlzdFssIGxlbmd0aF0pJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9IGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGxpc3RbMF1cbiAgfVxuXG4gIHZhciBpXG4gIGlmICh0b3RhbExlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdG90YWxMZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRvdGFsTGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIodG90YWxMZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAncmF3JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggKiAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoID4+PiAxXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG4vLyBwcmUtc2V0IGZvciB2YWx1ZXMgdGhhdCBtYXkgZXhpc3QgaW4gdGhlIGZ1dHVyZVxuQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbkJ1ZmZlci5wcm90b3R5cGUucGFyZW50ID0gdW5kZWZpbmVkXG5cbi8vIHRvU3RyaW5nKGVuY29kaW5nLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICBzdGFydCA9IHN0YXJ0ID4+PiAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCA+Pj4gMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSlcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKGIpIHtcbiAgaWYoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpXG4gICAgICBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbi8vIGBnZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihieXRlKSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gdXRmMTZsZVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSB1dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHJldHVybiBhc2NpaVNsaWNlKGJ1Ziwgc3RhcnQsIGVuZClcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuO1xuICAgIGlmIChzdGFydCA8IDApXG4gICAgICBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMClcbiAgICAgIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydClcbiAgICBlbmQgPSBzdGFydFxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHJldHVybiBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIHZhciBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQsIHRydWUpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0J1ZlxuICB9XG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpXG4gICAgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdidWZmZXIgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzb3VyY2VFbmQgPCBzb3VyY2VTdGFydCcpXG4gIGlmICh0YXJnZXRfc3RhcnQgPCAwIHx8IHRhcmdldF9zdGFydCA+PSB0YXJnZXQubGVuZ3RoKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHNvdXJjZS5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiBzb3VyY2UubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGFyZ2V0Ll9zZXQodGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLCB0YXJnZXRfc3RhcnQpXG4gIH1cbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IHZhbHVlXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IHV0ZjhUb0J5dGVzKHZhbHVlLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlCdWZmZXJgIHdpdGggdGhlICpjb3BpZWQqIG1lbW9yeSBvZiB0aGUgYnVmZmVyIGluc3RhbmNlLlxuICogQWRkZWQgaW4gTm9kZSAwLjEyLiBPbmx5IGF2YWlsYWJsZSBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgQXJyYXlCdWZmZXIuXG4gKi9cbkJ1ZmZlci5wcm90b3R5cGUudG9BcnJheUJ1ZmZlciA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICB9XG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5lcXVhbHMgPSBCUC5lcXVhbHNcbiAgYXJyLmNvbXBhcmUgPSBCUC5jb21wYXJlXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS16XS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gaXNBcnJheWlzaCAoc3ViamVjdCkge1xuICByZXR1cm4gaXNBcnJheShzdWJqZWN0KSB8fCBCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkgfHxcbiAgICAgIHN1YmplY3QgJiYgdHlwZW9mIHN1YmplY3QgPT09ICdvYmplY3QnICYmXG4gICAgICB0eXBlb2Ygc3ViamVjdC5sZW5ndGggPT09ICdudW1iZXInXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYiA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaWYgKGIgPD0gMHg3Rikge1xuICAgICAgYnl0ZUFycmF5LnB1c2goYilcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHN0YXJ0ID0gaVxuICAgICAgaWYgKGIgPj0gMHhEODAwICYmIGIgPD0gMHhERkZGKSBpKytcbiAgICAgIHZhciBoID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0ci5zbGljZShzdGFydCwgaSsxKSkuc3Vic3RyKDEpLnNwbGl0KCclJylcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgaC5sZW5ndGg7IGorKykge1xuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpXG4gICAgICBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGRlY29kZVV0ZjhDaGFyIChzdHIpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0cilcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoMHhGRkZEKSAvLyBVVEYgOCBpbnZhbGlkIGNoYXJcbiAgfVxufVxuIiwidmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJztcblxuOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuXHQndXNlIHN0cmljdCc7XG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG5cdHZhciBQTFVTICAgPSAnKycuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0ggID0gJy8nLmNoYXJDb2RlQXQoMClcblx0dmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBMT1dFUiAgPSAnYScuY2hhckNvZGVBdCgwKVxuXHR2YXIgVVBQRVIgID0gJ0EnLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUylcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0gpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgbkJpdHMgPSAtNyxcbiAgICAgIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMCxcbiAgICAgIGQgPSBpc0xFID8gLTEgOiAxLFxuICAgICAgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXTtcblxuICBpICs9IGQ7XG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIHMgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBlTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgZSA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IG1MZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhcztcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpO1xuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbik7XG4gICAgZSA9IGUgLSBlQmlhcztcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKTtcbn07XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbihidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgYyxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMCksXG4gICAgICBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSksXG4gICAgICBkID0gaXNMRSA/IDEgOiAtMSxcbiAgICAgIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDA7XG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSk7XG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDA7XG4gICAgZSA9IGVNYXg7XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpO1xuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLTtcbiAgICAgIGMgKj0gMjtcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKTtcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKys7XG4gICAgICBjIC89IDI7XG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMDtcbiAgICAgIGUgPSBlTWF4O1xuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSBlICsgZUJpYXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpO1xuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG07XG4gIGVMZW4gKz0gbUxlbjtcbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KTtcblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjg7XG59O1xuIiwiXG4vKipcbiAqIGlzQXJyYXlcbiAqL1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG5cbi8qKlxuICogdG9TdHJpbmdcbiAqL1xuXG52YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBXaGV0aGVyIG9yIG5vdCB0aGUgZ2l2ZW4gYHZhbGBcbiAqIGlzIGFuIGFycmF5LlxuICpcbiAqIGV4YW1wbGU6XG4gKlxuICogICAgICAgIGlzQXJyYXkoW10pO1xuICogICAgICAgIC8vID4gdHJ1ZVxuICogICAgICAgIGlzQXJyYXkoYXJndW1lbnRzKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKiAgICAgICAgaXNBcnJheSgnJyk7XG4gKiAgICAgICAgLy8gPiBmYWxzZVxuICpcbiAqIEBwYXJhbSB7bWl4ZWR9IHZhbFxuICogQHJldHVybiB7Ym9vbH1cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXkgfHwgZnVuY3Rpb24gKHZhbCkge1xuICByZXR1cm4gISEgdmFsICYmICdbb2JqZWN0IEFycmF5XScgPT0gc3RyLmNhbGwodmFsKTtcbn07XG4iLCIvKlxuIExlYWZsZXQsIGEgSmF2YVNjcmlwdCBsaWJyYXJ5IGZvciBtb2JpbGUtZnJpZW5kbHkgaW50ZXJhY3RpdmUgbWFwcy4gaHR0cDovL2xlYWZsZXRqcy5jb21cbiAoYykgMjAxMC0yMDEzLCBWbGFkaW1pciBBZ2Fmb25raW5cbiAoYykgMjAxMC0yMDExLCBDbG91ZE1hZGVcbiovXG4oZnVuY3Rpb24gKHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG52YXIgb2xkTCA9IHdpbmRvdy5MLFxyXG4gICAgTCA9IHt9O1xyXG5cclxuTC52ZXJzaW9uID0gJzAuNy4yJztcclxuXHJcbi8vIGRlZmluZSBMZWFmbGV0IGZvciBOb2RlIG1vZHVsZSBwYXR0ZXJuIGxvYWRlcnMsIGluY2x1ZGluZyBCcm93c2VyaWZ5XHJcbmlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09ICdvYmplY3QnKSB7XHJcblx0bW9kdWxlLmV4cG9ydHMgPSBMO1xyXG5cclxuLy8gZGVmaW5lIExlYWZsZXQgYXMgYW4gQU1EIG1vZHVsZVxyXG59IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xyXG5cdGRlZmluZShMKTtcclxufVxyXG5cclxuLy8gZGVmaW5lIExlYWZsZXQgYXMgYSBnbG9iYWwgTCB2YXJpYWJsZSwgc2F2aW5nIHRoZSBvcmlnaW5hbCBMIHRvIHJlc3RvcmUgbGF0ZXIgaWYgbmVlZGVkXHJcblxyXG5MLm5vQ29uZmxpY3QgPSBmdW5jdGlvbiAoKSB7XHJcblx0d2luZG93LkwgPSBvbGRMO1xyXG5cdHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxud2luZG93LkwgPSBMO1xyXG5cblxuLypcclxuICogTC5VdGlsIGNvbnRhaW5zIHZhcmlvdXMgdXRpbGl0eSBmdW5jdGlvbnMgdXNlZCB0aHJvdWdob3V0IExlYWZsZXQgY29kZS5cclxuICovXHJcblxyXG5MLlV0aWwgPSB7XHJcblx0ZXh0ZW5kOiBmdW5jdGlvbiAoZGVzdCkgeyAvLyAoT2JqZWN0WywgT2JqZWN0LCAuLi5dKSAtPlxyXG5cdFx0dmFyIHNvdXJjZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxyXG5cdFx0ICAgIGksIGosIGxlbiwgc3JjO1xyXG5cclxuXHRcdGZvciAoaiA9IDAsIGxlbiA9IHNvdXJjZXMubGVuZ3RoOyBqIDwgbGVuOyBqKyspIHtcclxuXHRcdFx0c3JjID0gc291cmNlc1tqXSB8fCB7fTtcclxuXHRcdFx0Zm9yIChpIGluIHNyYykge1xyXG5cdFx0XHRcdGlmIChzcmMuaGFzT3duUHJvcGVydHkoaSkpIHtcclxuXHRcdFx0XHRcdGRlc3RbaV0gPSBzcmNbaV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZGVzdDtcclxuXHR9LFxyXG5cclxuXHRiaW5kOiBmdW5jdGlvbiAoZm4sIG9iaikgeyAvLyAoRnVuY3Rpb24sIE9iamVjdCkgLT4gRnVuY3Rpb25cclxuXHRcdHZhciBhcmdzID0gYXJndW1lbnRzLmxlbmd0aCA+IDIgPyBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpIDogbnVsbDtcclxuXHRcdHJldHVybiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHJldHVybiBmbi5hcHBseShvYmosIGFyZ3MgfHwgYXJndW1lbnRzKTtcclxuXHRcdH07XHJcblx0fSxcclxuXHJcblx0c3RhbXA6IChmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgbGFzdElkID0gMCxcclxuXHRcdCAgICBrZXkgPSAnX2xlYWZsZXRfaWQnO1xyXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcclxuXHRcdFx0b2JqW2tleV0gPSBvYmpba2V5XSB8fCArK2xhc3RJZDtcclxuXHRcdFx0cmV0dXJuIG9ialtrZXldO1xyXG5cdFx0fTtcclxuXHR9KCkpLFxyXG5cclxuXHRpbnZva2VFYWNoOiBmdW5jdGlvbiAob2JqLCBtZXRob2QsIGNvbnRleHQpIHtcclxuXHRcdHZhciBpLCBhcmdzO1xyXG5cclxuXHRcdGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xyXG5cdFx0XHRhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcclxuXHJcblx0XHRcdGZvciAoaSBpbiBvYmopIHtcclxuXHRcdFx0XHRtZXRob2QuYXBwbHkoY29udGV4dCwgW2ksIG9ialtpXV0uY29uY2F0KGFyZ3MpKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fSxcclxuXHJcblx0bGltaXRFeGVjQnlJbnRlcnZhbDogZnVuY3Rpb24gKGZuLCB0aW1lLCBjb250ZXh0KSB7XHJcblx0XHR2YXIgbG9jaywgZXhlY09uVW5sb2NrO1xyXG5cclxuXHRcdHJldHVybiBmdW5jdGlvbiB3cmFwcGVyRm4oKSB7XHJcblx0XHRcdHZhciBhcmdzID0gYXJndW1lbnRzO1xyXG5cclxuXHRcdFx0aWYgKGxvY2spIHtcclxuXHRcdFx0XHRleGVjT25VbmxvY2sgPSB0cnVlO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bG9jayA9IHRydWU7XHJcblxyXG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRsb2NrID0gZmFsc2U7XHJcblxyXG5cdFx0XHRcdGlmIChleGVjT25VbmxvY2spIHtcclxuXHRcdFx0XHRcdHdyYXBwZXJGbi5hcHBseShjb250ZXh0LCBhcmdzKTtcclxuXHRcdFx0XHRcdGV4ZWNPblVubG9jayA9IGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGltZSk7XHJcblxyXG5cdFx0XHRmbi5hcHBseShjb250ZXh0LCBhcmdzKTtcclxuXHRcdH07XHJcblx0fSxcclxuXHJcblx0ZmFsc2VGbjogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH0sXHJcblxyXG5cdGZvcm1hdE51bTogZnVuY3Rpb24gKG51bSwgZGlnaXRzKSB7XHJcblx0XHR2YXIgcG93ID0gTWF0aC5wb3coMTAsIGRpZ2l0cyB8fCA1KTtcclxuXHRcdHJldHVybiBNYXRoLnJvdW5kKG51bSAqIHBvdykgLyBwb3c7XHJcblx0fSxcclxuXHJcblx0dHJpbTogZnVuY3Rpb24gKHN0cikge1xyXG5cdFx0cmV0dXJuIHN0ci50cmltID8gc3RyLnRyaW0oKSA6IHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJyk7XHJcblx0fSxcclxuXHJcblx0c3BsaXRXb3JkczogZnVuY3Rpb24gKHN0cikge1xyXG5cdFx0cmV0dXJuIEwuVXRpbC50cmltKHN0cikuc3BsaXQoL1xccysvKTtcclxuXHR9LFxyXG5cclxuXHRzZXRPcHRpb25zOiBmdW5jdGlvbiAob2JqLCBvcHRpb25zKSB7XHJcblx0XHRvYmoub3B0aW9ucyA9IEwuZXh0ZW5kKHt9LCBvYmoub3B0aW9ucywgb3B0aW9ucyk7XHJcblx0XHRyZXR1cm4gb2JqLm9wdGlvbnM7XHJcblx0fSxcclxuXHJcblx0Z2V0UGFyYW1TdHJpbmc6IGZ1bmN0aW9uIChvYmosIGV4aXN0aW5nVXJsLCB1cHBlcmNhc2UpIHtcclxuXHRcdHZhciBwYXJhbXMgPSBbXTtcclxuXHRcdGZvciAodmFyIGkgaW4gb2JqKSB7XHJcblx0XHRcdHBhcmFtcy5wdXNoKGVuY29kZVVSSUNvbXBvbmVudCh1cHBlcmNhc2UgPyBpLnRvVXBwZXJDYXNlKCkgOiBpKSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChvYmpbaV0pKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiAoKCFleGlzdGluZ1VybCB8fCBleGlzdGluZ1VybC5pbmRleE9mKCc/JykgPT09IC0xKSA/ICc/JyA6ICcmJykgKyBwYXJhbXMuam9pbignJicpO1xyXG5cdH0sXHJcblx0dGVtcGxhdGU6IGZ1bmN0aW9uIChzdHIsIGRhdGEpIHtcclxuXHRcdHJldHVybiBzdHIucmVwbGFjZSgvXFx7ICooW1xcd19dKykgKlxcfS9nLCBmdW5jdGlvbiAoc3RyLCBrZXkpIHtcclxuXHRcdFx0dmFyIHZhbHVlID0gZGF0YVtrZXldO1xyXG5cdFx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gdmFsdWUgcHJvdmlkZWQgZm9yIHZhcmlhYmxlICcgKyBzdHIpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdHZhbHVlID0gdmFsdWUoZGF0YSk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHZhbHVlO1xyXG5cdFx0fSk7XHJcblx0fSxcclxuXHJcblx0aXNBcnJheTogQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAob2JqKSB7XHJcblx0XHRyZXR1cm4gKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nKTtcclxuXHR9LFxyXG5cclxuXHRlbXB0eUltYWdlVXJsOiAnZGF0YTppbWFnZS9naWY7YmFzZTY0LFIwbEdPRGxoQVFBQkFBRC9BQ3dBQUFBQUFRQUJBQUFDQURzPSdcclxufTtcclxuXHJcbihmdW5jdGlvbiAoKSB7XHJcblxyXG5cdC8vIGluc3BpcmVkIGJ5IGh0dHA6Ly9wYXVsaXJpc2guY29tLzIwMTEvcmVxdWVzdGFuaW1hdGlvbmZyYW1lLWZvci1zbWFydC1hbmltYXRpbmcvXHJcblxyXG5cdGZ1bmN0aW9uIGdldFByZWZpeGVkKG5hbWUpIHtcclxuXHRcdHZhciBpLCBmbixcclxuXHRcdCAgICBwcmVmaXhlcyA9IFsnd2Via2l0JywgJ21veicsICdvJywgJ21zJ107XHJcblxyXG5cdFx0Zm9yIChpID0gMDsgaSA8IHByZWZpeGVzLmxlbmd0aCAmJiAhZm47IGkrKykge1xyXG5cdFx0XHRmbiA9IHdpbmRvd1twcmVmaXhlc1tpXSArIG5hbWVdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmbjtcclxuXHR9XHJcblxyXG5cdHZhciBsYXN0VGltZSA9IDA7XHJcblxyXG5cdGZ1bmN0aW9uIHRpbWVvdXREZWZlcihmbikge1xyXG5cdFx0dmFyIHRpbWUgPSArbmV3IERhdGUoKSxcclxuXHRcdCAgICB0aW1lVG9DYWxsID0gTWF0aC5tYXgoMCwgMTYgLSAodGltZSAtIGxhc3RUaW1lKSk7XHJcblxyXG5cdFx0bGFzdFRpbWUgPSB0aW1lICsgdGltZVRvQ2FsbDtcclxuXHRcdHJldHVybiB3aW5kb3cuc2V0VGltZW91dChmbiwgdGltZVRvQ2FsbCk7XHJcblx0fVxyXG5cclxuXHR2YXIgcmVxdWVzdEZuID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG5cdCAgICAgICAgZ2V0UHJlZml4ZWQoJ1JlcXVlc3RBbmltYXRpb25GcmFtZScpIHx8IHRpbWVvdXREZWZlcjtcclxuXHJcblx0dmFyIGNhbmNlbEZuID0gd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lIHx8XHJcblx0ICAgICAgICBnZXRQcmVmaXhlZCgnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnKSB8fFxyXG5cdCAgICAgICAgZ2V0UHJlZml4ZWQoJ0NhbmNlbFJlcXVlc3RBbmltYXRpb25GcmFtZScpIHx8XHJcblx0ICAgICAgICBmdW5jdGlvbiAoaWQpIHsgd2luZG93LmNsZWFyVGltZW91dChpZCk7IH07XHJcblxyXG5cclxuXHRMLlV0aWwucmVxdWVzdEFuaW1GcmFtZSA9IGZ1bmN0aW9uIChmbiwgY29udGV4dCwgaW1tZWRpYXRlLCBlbGVtZW50KSB7XHJcblx0XHRmbiA9IEwuYmluZChmbiwgY29udGV4dCk7XHJcblxyXG5cdFx0aWYgKGltbWVkaWF0ZSAmJiByZXF1ZXN0Rm4gPT09IHRpbWVvdXREZWZlcikge1xyXG5cdFx0XHRmbigpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIHJlcXVlc3RGbi5jYWxsKHdpbmRvdywgZm4sIGVsZW1lbnQpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdEwuVXRpbC5jYW5jZWxBbmltRnJhbWUgPSBmdW5jdGlvbiAoaWQpIHtcclxuXHRcdGlmIChpZCkge1xyXG5cdFx0XHRjYW5jZWxGbi5jYWxsKHdpbmRvdywgaWQpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG59KCkpO1xyXG5cclxuLy8gc2hvcnRjdXRzIGZvciBtb3N0IHVzZWQgdXRpbGl0eSBmdW5jdGlvbnNcclxuTC5leHRlbmQgPSBMLlV0aWwuZXh0ZW5kO1xyXG5MLmJpbmQgPSBMLlV0aWwuYmluZDtcclxuTC5zdGFtcCA9IEwuVXRpbC5zdGFtcDtcclxuTC5zZXRPcHRpb25zID0gTC5VdGlsLnNldE9wdGlvbnM7XHJcblxuXG4vKlxyXG4gKiBMLkNsYXNzIHBvd2VycyB0aGUgT09QIGZhY2lsaXRpZXMgb2YgdGhlIGxpYnJhcnkuXHJcbiAqIFRoYW5rcyB0byBKb2huIFJlc2lnIGFuZCBEZWFuIEVkd2FyZHMgZm9yIGluc3BpcmF0aW9uIVxyXG4gKi9cclxuXHJcbkwuQ2xhc3MgPSBmdW5jdGlvbiAoKSB7fTtcclxuXHJcbkwuQ2xhc3MuZXh0ZW5kID0gZnVuY3Rpb24gKHByb3BzKSB7XHJcblxyXG5cdC8vIGV4dGVuZGVkIGNsYXNzIHdpdGggdGhlIG5ldyBwcm90b3R5cGVcclxuXHR2YXIgTmV3Q2xhc3MgPSBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0Ly8gY2FsbCB0aGUgY29uc3RydWN0b3JcclxuXHRcdGlmICh0aGlzLmluaXRpYWxpemUpIHtcclxuXHRcdFx0dGhpcy5pbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gY2FsbCBhbGwgY29uc3RydWN0b3IgaG9va3NcclxuXHRcdGlmICh0aGlzLl9pbml0SG9va3MpIHtcclxuXHRcdFx0dGhpcy5jYWxsSW5pdEhvb2tzKCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0Ly8gaW5zdGFudGlhdGUgY2xhc3Mgd2l0aG91dCBjYWxsaW5nIGNvbnN0cnVjdG9yXHJcblx0dmFyIEYgPSBmdW5jdGlvbiAoKSB7fTtcclxuXHRGLnByb3RvdHlwZSA9IHRoaXMucHJvdG90eXBlO1xyXG5cclxuXHR2YXIgcHJvdG8gPSBuZXcgRigpO1xyXG5cdHByb3RvLmNvbnN0cnVjdG9yID0gTmV3Q2xhc3M7XHJcblxyXG5cdE5ld0NsYXNzLnByb3RvdHlwZSA9IHByb3RvO1xyXG5cclxuXHQvL2luaGVyaXQgcGFyZW50J3Mgc3RhdGljc1xyXG5cdGZvciAodmFyIGkgaW4gdGhpcykge1xyXG5cdFx0aWYgKHRoaXMuaGFzT3duUHJvcGVydHkoaSkgJiYgaSAhPT0gJ3Byb3RvdHlwZScpIHtcclxuXHRcdFx0TmV3Q2xhc3NbaV0gPSB0aGlzW2ldO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gbWl4IHN0YXRpYyBwcm9wZXJ0aWVzIGludG8gdGhlIGNsYXNzXHJcblx0aWYgKHByb3BzLnN0YXRpY3MpIHtcclxuXHRcdEwuZXh0ZW5kKE5ld0NsYXNzLCBwcm9wcy5zdGF0aWNzKTtcclxuXHRcdGRlbGV0ZSBwcm9wcy5zdGF0aWNzO1xyXG5cdH1cclxuXHJcblx0Ly8gbWl4IGluY2x1ZGVzIGludG8gdGhlIHByb3RvdHlwZVxyXG5cdGlmIChwcm9wcy5pbmNsdWRlcykge1xyXG5cdFx0TC5VdGlsLmV4dGVuZC5hcHBseShudWxsLCBbcHJvdG9dLmNvbmNhdChwcm9wcy5pbmNsdWRlcykpO1xyXG5cdFx0ZGVsZXRlIHByb3BzLmluY2x1ZGVzO1xyXG5cdH1cclxuXHJcblx0Ly8gbWVyZ2Ugb3B0aW9uc1xyXG5cdGlmIChwcm9wcy5vcHRpb25zICYmIHByb3RvLm9wdGlvbnMpIHtcclxuXHRcdHByb3BzLm9wdGlvbnMgPSBMLmV4dGVuZCh7fSwgcHJvdG8ub3B0aW9ucywgcHJvcHMub3B0aW9ucyk7XHJcblx0fVxyXG5cclxuXHQvLyBtaXggZ2l2ZW4gcHJvcGVydGllcyBpbnRvIHRoZSBwcm90b3R5cGVcclxuXHRMLmV4dGVuZChwcm90bywgcHJvcHMpO1xyXG5cclxuXHRwcm90by5faW5pdEhvb2tzID0gW107XHJcblxyXG5cdHZhciBwYXJlbnQgPSB0aGlzO1xyXG5cdC8vIGpzaGludCBjYW1lbGNhc2U6IGZhbHNlXHJcblx0TmV3Q2xhc3MuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTtcclxuXHJcblx0Ly8gYWRkIG1ldGhvZCBmb3IgY2FsbGluZyBhbGwgaG9va3NcclxuXHRwcm90by5jYWxsSW5pdEhvb2tzID0gZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGlmICh0aGlzLl9pbml0SG9va3NDYWxsZWQpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0aWYgKHBhcmVudC5wcm90b3R5cGUuY2FsbEluaXRIb29rcykge1xyXG5cdFx0XHRwYXJlbnQucHJvdG90eXBlLmNhbGxJbml0SG9va3MuY2FsbCh0aGlzKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9pbml0SG9va3NDYWxsZWQgPSB0cnVlO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsZW4gPSBwcm90by5faW5pdEhvb2tzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdHByb3RvLl9pbml0SG9va3NbaV0uY2FsbCh0aGlzKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHRyZXR1cm4gTmV3Q2xhc3M7XHJcbn07XHJcblxyXG5cclxuLy8gbWV0aG9kIGZvciBhZGRpbmcgcHJvcGVydGllcyB0byBwcm90b3R5cGVcclxuTC5DbGFzcy5pbmNsdWRlID0gZnVuY3Rpb24gKHByb3BzKSB7XHJcblx0TC5leHRlbmQodGhpcy5wcm90b3R5cGUsIHByb3BzKTtcclxufTtcclxuXHJcbi8vIG1lcmdlIG5ldyBkZWZhdWx0IG9wdGlvbnMgdG8gdGhlIENsYXNzXHJcbkwuQ2xhc3MubWVyZ2VPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuXHRMLmV4dGVuZCh0aGlzLnByb3RvdHlwZS5vcHRpb25zLCBvcHRpb25zKTtcclxufTtcclxuXHJcbi8vIGFkZCBhIGNvbnN0cnVjdG9yIGhvb2tcclxuTC5DbGFzcy5hZGRJbml0SG9vayA9IGZ1bmN0aW9uIChmbikgeyAvLyAoRnVuY3Rpb24pIHx8IChTdHJpbmcsIGFyZ3MuLi4pXHJcblx0dmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xyXG5cclxuXHR2YXIgaW5pdCA9IHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJyA/IGZuIDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dGhpc1tmbl0uYXBwbHkodGhpcywgYXJncyk7XHJcblx0fTtcclxuXHJcblx0dGhpcy5wcm90b3R5cGUuX2luaXRIb29rcyA9IHRoaXMucHJvdG90eXBlLl9pbml0SG9va3MgfHwgW107XHJcblx0dGhpcy5wcm90b3R5cGUuX2luaXRIb29rcy5wdXNoKGluaXQpO1xyXG59O1xyXG5cblxuLypcclxuICogTC5NaXhpbi5FdmVudHMgaXMgdXNlZCB0byBhZGQgY3VzdG9tIGV2ZW50cyBmdW5jdGlvbmFsaXR5IHRvIExlYWZsZXQgY2xhc3Nlcy5cclxuICovXHJcblxyXG52YXIgZXZlbnRzS2V5ID0gJ19sZWFmbGV0X2V2ZW50cyc7XHJcblxyXG5MLk1peGluID0ge307XHJcblxyXG5MLk1peGluLkV2ZW50cyA9IHtcclxuXHJcblx0YWRkRXZlbnRMaXN0ZW5lcjogZnVuY3Rpb24gKHR5cGVzLCBmbiwgY29udGV4dCkgeyAvLyAoU3RyaW5nLCBGdW5jdGlvblssIE9iamVjdF0pIG9yIChPYmplY3RbLCBPYmplY3RdKVxyXG5cclxuXHRcdC8vIHR5cGVzIGNhbiBiZSBhIG1hcCBvZiB0eXBlcy9oYW5kbGVyc1xyXG5cdFx0aWYgKEwuVXRpbC5pbnZva2VFYWNoKHR5cGVzLCB0aGlzLmFkZEV2ZW50TGlzdGVuZXIsIHRoaXMsIGZuLCBjb250ZXh0KSkgeyByZXR1cm4gdGhpczsgfVxyXG5cclxuXHRcdHZhciBldmVudHMgPSB0aGlzW2V2ZW50c0tleV0gPSB0aGlzW2V2ZW50c0tleV0gfHwge30sXHJcblx0XHQgICAgY29udGV4dElkID0gY29udGV4dCAmJiBjb250ZXh0ICE9PSB0aGlzICYmIEwuc3RhbXAoY29udGV4dCksXHJcblx0XHQgICAgaSwgbGVuLCBldmVudCwgdHlwZSwgaW5kZXhLZXksIGluZGV4TGVuS2V5LCB0eXBlSW5kZXg7XHJcblxyXG5cdFx0Ly8gdHlwZXMgY2FuIGJlIGEgc3RyaW5nIG9mIHNwYWNlLXNlcGFyYXRlZCB3b3Jkc1xyXG5cdFx0dHlwZXMgPSBMLlV0aWwuc3BsaXRXb3Jkcyh0eXBlcyk7XHJcblxyXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gdHlwZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0ZXZlbnQgPSB7XHJcblx0XHRcdFx0YWN0aW9uOiBmbixcclxuXHRcdFx0XHRjb250ZXh0OiBjb250ZXh0IHx8IHRoaXNcclxuXHRcdFx0fTtcclxuXHRcdFx0dHlwZSA9IHR5cGVzW2ldO1xyXG5cclxuXHRcdFx0aWYgKGNvbnRleHRJZCkge1xyXG5cdFx0XHRcdC8vIHN0b3JlIGxpc3RlbmVycyBvZiBhIHBhcnRpY3VsYXIgY29udGV4dCBpbiBhIHNlcGFyYXRlIGhhc2ggKGlmIGl0IGhhcyBhbiBpZClcclxuXHRcdFx0XHQvLyBnaXZlcyBhIG1ham9yIHBlcmZvcm1hbmNlIGJvb3N0IHdoZW4gcmVtb3ZpbmcgdGhvdXNhbmRzIG9mIG1hcCBsYXllcnNcclxuXHJcblx0XHRcdFx0aW5kZXhLZXkgPSB0eXBlICsgJ19pZHgnO1xyXG5cdFx0XHRcdGluZGV4TGVuS2V5ID0gaW5kZXhLZXkgKyAnX2xlbic7XHJcblxyXG5cdFx0XHRcdHR5cGVJbmRleCA9IGV2ZW50c1tpbmRleEtleV0gPSBldmVudHNbaW5kZXhLZXldIHx8IHt9O1xyXG5cclxuXHRcdFx0XHRpZiAoIXR5cGVJbmRleFtjb250ZXh0SWRdKSB7XHJcblx0XHRcdFx0XHR0eXBlSW5kZXhbY29udGV4dElkXSA9IFtdO1xyXG5cclxuXHRcdFx0XHRcdC8vIGtlZXAgdHJhY2sgb2YgdGhlIG51bWJlciBvZiBrZXlzIGluIHRoZSBpbmRleCB0byBxdWlja2x5IGNoZWNrIGlmIGl0J3MgZW1wdHlcclxuXHRcdFx0XHRcdGV2ZW50c1tpbmRleExlbktleV0gPSAoZXZlbnRzW2luZGV4TGVuS2V5XSB8fCAwKSArIDE7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR0eXBlSW5kZXhbY29udGV4dElkXS5wdXNoKGV2ZW50KTtcclxuXHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGV2ZW50c1t0eXBlXSA9IGV2ZW50c1t0eXBlXSB8fCBbXTtcclxuXHRcdFx0XHRldmVudHNbdHlwZV0ucHVzaChldmVudCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRoYXNFdmVudExpc3RlbmVyczogZnVuY3Rpb24gKHR5cGUpIHsgLy8gKFN0cmluZykgLT4gQm9vbGVhblxyXG5cdFx0dmFyIGV2ZW50cyA9IHRoaXNbZXZlbnRzS2V5XTtcclxuXHRcdHJldHVybiAhIWV2ZW50cyAmJiAoKHR5cGUgaW4gZXZlbnRzICYmIGV2ZW50c1t0eXBlXS5sZW5ndGggPiAwKSB8fFxyXG5cdFx0ICAgICAgICAgICAgICAgICAgICAodHlwZSArICdfaWR4JyBpbiBldmVudHMgJiYgZXZlbnRzW3R5cGUgKyAnX2lkeF9sZW4nXSA+IDApKTtcclxuXHR9LFxyXG5cclxuXHRyZW1vdmVFdmVudExpc3RlbmVyOiBmdW5jdGlvbiAodHlwZXMsIGZuLCBjb250ZXh0KSB7IC8vIChbU3RyaW5nLCBGdW5jdGlvbiwgT2JqZWN0XSkgb3IgKE9iamVjdFssIE9iamVjdF0pXHJcblxyXG5cdFx0aWYgKCF0aGlzW2V2ZW50c0tleV0pIHtcclxuXHRcdFx0cmV0dXJuIHRoaXM7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCF0eXBlcykge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5jbGVhckFsbEV2ZW50TGlzdGVuZXJzKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKEwuVXRpbC5pbnZva2VFYWNoKHR5cGVzLCB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIsIHRoaXMsIGZuLCBjb250ZXh0KSkgeyByZXR1cm4gdGhpczsgfVxyXG5cclxuXHRcdHZhciBldmVudHMgPSB0aGlzW2V2ZW50c0tleV0sXHJcblx0XHQgICAgY29udGV4dElkID0gY29udGV4dCAmJiBjb250ZXh0ICE9PSB0aGlzICYmIEwuc3RhbXAoY29udGV4dCksXHJcblx0XHQgICAgaSwgbGVuLCB0eXBlLCBsaXN0ZW5lcnMsIGosIGluZGV4S2V5LCBpbmRleExlbktleSwgdHlwZUluZGV4LCByZW1vdmVkO1xyXG5cclxuXHRcdHR5cGVzID0gTC5VdGlsLnNwbGl0V29yZHModHlwZXMpO1xyXG5cclxuXHRcdGZvciAoaSA9IDAsIGxlbiA9IHR5cGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdHR5cGUgPSB0eXBlc1tpXTtcclxuXHRcdFx0aW5kZXhLZXkgPSB0eXBlICsgJ19pZHgnO1xyXG5cdFx0XHRpbmRleExlbktleSA9IGluZGV4S2V5ICsgJ19sZW4nO1xyXG5cclxuXHRcdFx0dHlwZUluZGV4ID0gZXZlbnRzW2luZGV4S2V5XTtcclxuXHJcblx0XHRcdGlmICghZm4pIHtcclxuXHRcdFx0XHQvLyBjbGVhciBhbGwgbGlzdGVuZXJzIGZvciBhIHR5cGUgaWYgZnVuY3Rpb24gaXNuJ3Qgc3BlY2lmaWVkXHJcblx0XHRcdFx0ZGVsZXRlIGV2ZW50c1t0eXBlXTtcclxuXHRcdFx0XHRkZWxldGUgZXZlbnRzW2luZGV4S2V5XTtcclxuXHRcdFx0XHRkZWxldGUgZXZlbnRzW2luZGV4TGVuS2V5XTtcclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0bGlzdGVuZXJzID0gY29udGV4dElkICYmIHR5cGVJbmRleCA/IHR5cGVJbmRleFtjb250ZXh0SWRdIDogZXZlbnRzW3R5cGVdO1xyXG5cclxuXHRcdFx0XHRpZiAobGlzdGVuZXJzKSB7XHJcblx0XHRcdFx0XHRmb3IgKGogPSBsaXN0ZW5lcnMubGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcclxuXHRcdFx0XHRcdFx0aWYgKChsaXN0ZW5lcnNbal0uYWN0aW9uID09PSBmbikgJiYgKCFjb250ZXh0IHx8IChsaXN0ZW5lcnNbal0uY29udGV4dCA9PT0gY29udGV4dCkpKSB7XHJcblx0XHRcdFx0XHRcdFx0cmVtb3ZlZCA9IGxpc3RlbmVycy5zcGxpY2UoaiwgMSk7XHJcblx0XHRcdFx0XHRcdFx0Ly8gc2V0IHRoZSBvbGQgYWN0aW9uIHRvIGEgbm8tb3AsIGJlY2F1c2UgaXQgaXMgcG9zc2libGVcclxuXHRcdFx0XHRcdFx0XHQvLyB0aGF0IHRoZSBsaXN0ZW5lciBpcyBiZWluZyBpdGVyYXRlZCBvdmVyIGFzIHBhcnQgb2YgYSBkaXNwYXRjaFxyXG5cdFx0XHRcdFx0XHRcdHJlbW92ZWRbMF0uYWN0aW9uID0gTC5VdGlsLmZhbHNlRm47XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoY29udGV4dCAmJiB0eXBlSW5kZXggJiYgKGxpc3RlbmVycy5sZW5ndGggPT09IDApKSB7XHJcblx0XHRcdFx0XHRcdGRlbGV0ZSB0eXBlSW5kZXhbY29udGV4dElkXTtcclxuXHRcdFx0XHRcdFx0ZXZlbnRzW2luZGV4TGVuS2V5XS0tO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGNsZWFyQWxsRXZlbnRMaXN0ZW5lcnM6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGRlbGV0ZSB0aGlzW2V2ZW50c0tleV07XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRmaXJlRXZlbnQ6IGZ1bmN0aW9uICh0eXBlLCBkYXRhKSB7IC8vIChTdHJpbmdbLCBPYmplY3RdKVxyXG5cdFx0aWYgKCF0aGlzLmhhc0V2ZW50TGlzdGVuZXJzKHR5cGUpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBldmVudCA9IEwuVXRpbC5leHRlbmQoe30sIGRhdGEsIHsgdHlwZTogdHlwZSwgdGFyZ2V0OiB0aGlzIH0pO1xyXG5cclxuXHRcdHZhciBldmVudHMgPSB0aGlzW2V2ZW50c0tleV0sXHJcblx0XHQgICAgbGlzdGVuZXJzLCBpLCBsZW4sIHR5cGVJbmRleCwgY29udGV4dElkO1xyXG5cclxuXHRcdGlmIChldmVudHNbdHlwZV0pIHtcclxuXHRcdFx0Ly8gbWFrZSBzdXJlIGFkZGluZy9yZW1vdmluZyBsaXN0ZW5lcnMgaW5zaWRlIG90aGVyIGxpc3RlbmVycyB3b24ndCBjYXVzZSBpbmZpbml0ZSBsb29wXHJcblx0XHRcdGxpc3RlbmVycyA9IGV2ZW50c1t0eXBlXS5zbGljZSgpO1xyXG5cclxuXHRcdFx0Zm9yIChpID0gMCwgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdFx0bGlzdGVuZXJzW2ldLmFjdGlvbi5jYWxsKGxpc3RlbmVyc1tpXS5jb250ZXh0LCBldmVudCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBmaXJlIGV2ZW50IGZvciB0aGUgY29udGV4dC1pbmRleGVkIGxpc3RlbmVycyBhcyB3ZWxsXHJcblx0XHR0eXBlSW5kZXggPSBldmVudHNbdHlwZSArICdfaWR4J107XHJcblxyXG5cdFx0Zm9yIChjb250ZXh0SWQgaW4gdHlwZUluZGV4KSB7XHJcblx0XHRcdGxpc3RlbmVycyA9IHR5cGVJbmRleFtjb250ZXh0SWRdLnNsaWNlKCk7XHJcblxyXG5cdFx0XHRpZiAobGlzdGVuZXJzKSB7XHJcblx0XHRcdFx0Zm9yIChpID0gMCwgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdFx0XHRsaXN0ZW5lcnNbaV0uYWN0aW9uLmNhbGwobGlzdGVuZXJzW2ldLmNvbnRleHQsIGV2ZW50KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRhZGRPbmVUaW1lRXZlbnRMaXN0ZW5lcjogZnVuY3Rpb24gKHR5cGVzLCBmbiwgY29udGV4dCkge1xyXG5cclxuXHRcdGlmIChMLlV0aWwuaW52b2tlRWFjaCh0eXBlcywgdGhpcy5hZGRPbmVUaW1lRXZlbnRMaXN0ZW5lciwgdGhpcywgZm4sIGNvbnRleHQpKSB7IHJldHVybiB0aGlzOyB9XHJcblxyXG5cdFx0dmFyIGhhbmRsZXIgPSBMLmJpbmQoZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR0aGlzXHJcblx0XHRcdCAgICAucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlcywgZm4sIGNvbnRleHQpXHJcblx0XHRcdCAgICAucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlcywgaGFuZGxlciwgY29udGV4dCk7XHJcblx0XHR9LCB0aGlzKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpc1xyXG5cdFx0ICAgIC5hZGRFdmVudExpc3RlbmVyKHR5cGVzLCBmbiwgY29udGV4dClcclxuXHRcdCAgICAuYWRkRXZlbnRMaXN0ZW5lcih0eXBlcywgaGFuZGxlciwgY29udGV4dCk7XHJcblx0fVxyXG59O1xyXG5cclxuTC5NaXhpbi5FdmVudHMub24gPSBMLk1peGluLkV2ZW50cy5hZGRFdmVudExpc3RlbmVyO1xyXG5MLk1peGluLkV2ZW50cy5vZmYgPSBMLk1peGluLkV2ZW50cy5yZW1vdmVFdmVudExpc3RlbmVyO1xyXG5MLk1peGluLkV2ZW50cy5vbmNlID0gTC5NaXhpbi5FdmVudHMuYWRkT25lVGltZUV2ZW50TGlzdGVuZXI7XHJcbkwuTWl4aW4uRXZlbnRzLmZpcmUgPSBMLk1peGluLkV2ZW50cy5maXJlRXZlbnQ7XHJcblxuXG4vKlxyXG4gKiBMLkJyb3dzZXIgaGFuZGxlcyBkaWZmZXJlbnQgYnJvd3NlciBhbmQgZmVhdHVyZSBkZXRlY3Rpb25zIGZvciBpbnRlcm5hbCBMZWFmbGV0IHVzZS5cclxuICovXHJcblxyXG4oZnVuY3Rpb24gKCkge1xyXG5cclxuXHR2YXIgaWUgPSAnQWN0aXZlWE9iamVjdCcgaW4gd2luZG93LFxyXG5cdFx0aWVsdDkgPSBpZSAmJiAhZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcixcclxuXHJcblx0ICAgIC8vIHRlcnJpYmxlIGJyb3dzZXIgZGV0ZWN0aW9uIHRvIHdvcmsgYXJvdW5kIFNhZmFyaSAvIGlPUyAvIEFuZHJvaWQgYnJvd3NlciBidWdzXHJcblx0ICAgIHVhID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLFxyXG5cdCAgICB3ZWJraXQgPSB1YS5pbmRleE9mKCd3ZWJraXQnKSAhPT0gLTEsXHJcblx0ICAgIGNocm9tZSA9IHVhLmluZGV4T2YoJ2Nocm9tZScpICE9PSAtMSxcclxuXHQgICAgcGhhbnRvbWpzID0gdWEuaW5kZXhPZigncGhhbnRvbScpICE9PSAtMSxcclxuXHQgICAgYW5kcm9pZCA9IHVhLmluZGV4T2YoJ2FuZHJvaWQnKSAhPT0gLTEsXHJcblx0ICAgIGFuZHJvaWQyMyA9IHVhLnNlYXJjaCgnYW5kcm9pZCBbMjNdJykgIT09IC0xLFxyXG5cdFx0Z2Vja28gPSB1YS5pbmRleE9mKCdnZWNrbycpICE9PSAtMSxcclxuXHJcblx0ICAgIG1vYmlsZSA9IHR5cGVvZiBvcmllbnRhdGlvbiAhPT0gdW5kZWZpbmVkICsgJycsXHJcblx0ICAgIG1zUG9pbnRlciA9IHdpbmRvdy5uYXZpZ2F0b3IgJiYgd2luZG93Lm5hdmlnYXRvci5tc1BvaW50ZXJFbmFibGVkICYmXHJcblx0ICAgICAgICAgICAgICB3aW5kb3cubmF2aWdhdG9yLm1zTWF4VG91Y2hQb2ludHMgJiYgIXdpbmRvdy5Qb2ludGVyRXZlbnQsXHJcblx0XHRwb2ludGVyID0gKHdpbmRvdy5Qb2ludGVyRXZlbnQgJiYgd2luZG93Lm5hdmlnYXRvci5wb2ludGVyRW5hYmxlZCAmJiB3aW5kb3cubmF2aWdhdG9yLm1heFRvdWNoUG9pbnRzKSB8fFxyXG5cdFx0XHRcdCAgbXNQb2ludGVyLFxyXG5cdCAgICByZXRpbmEgPSAoJ2RldmljZVBpeGVsUmF0aW8nIGluIHdpbmRvdyAmJiB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyA+IDEpIHx8XHJcblx0ICAgICAgICAgICAgICgnbWF0Y2hNZWRpYScgaW4gd2luZG93ICYmIHdpbmRvdy5tYXRjaE1lZGlhKCcobWluLXJlc29sdXRpb246MTQ0ZHBpKScpICYmXHJcblx0ICAgICAgICAgICAgICB3aW5kb3cubWF0Y2hNZWRpYSgnKG1pbi1yZXNvbHV0aW9uOjE0NGRwaSknKS5tYXRjaGVzKSxcclxuXHJcblx0ICAgIGRvYyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCxcclxuXHQgICAgaWUzZCA9IGllICYmICgndHJhbnNpdGlvbicgaW4gZG9jLnN0eWxlKSxcclxuXHQgICAgd2Via2l0M2QgPSAoJ1dlYktpdENTU01hdHJpeCcgaW4gd2luZG93KSAmJiAoJ20xMScgaW4gbmV3IHdpbmRvdy5XZWJLaXRDU1NNYXRyaXgoKSkgJiYgIWFuZHJvaWQyMyxcclxuXHQgICAgZ2Vja28zZCA9ICdNb3pQZXJzcGVjdGl2ZScgaW4gZG9jLnN0eWxlLFxyXG5cdCAgICBvcGVyYTNkID0gJ09UcmFuc2l0aW9uJyBpbiBkb2Muc3R5bGUsXHJcblx0ICAgIGFueTNkID0gIXdpbmRvdy5MX0RJU0FCTEVfM0QgJiYgKGllM2QgfHwgd2Via2l0M2QgfHwgZ2Vja28zZCB8fCBvcGVyYTNkKSAmJiAhcGhhbnRvbWpzO1xyXG5cclxuXHJcblx0Ly8gUGhhbnRvbUpTIGhhcyAnb250b3VjaHN0YXJ0JyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIGJ1dCBkb2Vzbid0IGFjdHVhbGx5IHN1cHBvcnQgdG91Y2guXHJcblx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL0xlYWZsZXQvTGVhZmxldC9wdWxsLzE0MzQjaXNzdWVjb21tZW50LTEzODQzMTUxXHJcblxyXG5cdHZhciB0b3VjaCA9ICF3aW5kb3cuTF9OT19UT1VDSCAmJiAhcGhhbnRvbWpzICYmIChmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0dmFyIHN0YXJ0TmFtZSA9ICdvbnRvdWNoc3RhcnQnO1xyXG5cclxuXHRcdC8vIElFMTArIChXZSBzaW11bGF0ZSB0aGVzZSBpbnRvIHRvdWNoKiBldmVudHMgaW4gTC5Eb21FdmVudCBhbmQgTC5Eb21FdmVudC5Qb2ludGVyKSBvciBXZWJLaXQsIGV0Yy5cclxuXHRcdGlmIChwb2ludGVyIHx8IChzdGFydE5hbWUgaW4gZG9jKSkge1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBGaXJlZm94L0dlY2tvXHJcblx0XHR2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcblx0XHQgICAgc3VwcG9ydGVkID0gZmFsc2U7XHJcblxyXG5cdFx0aWYgKCFkaXYuc2V0QXR0cmlidXRlKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHRcdGRpdi5zZXRBdHRyaWJ1dGUoc3RhcnROYW1lLCAncmV0dXJuOycpO1xyXG5cclxuXHRcdGlmICh0eXBlb2YgZGl2W3N0YXJ0TmFtZV0gPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0c3VwcG9ydGVkID0gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRkaXYucmVtb3ZlQXR0cmlidXRlKHN0YXJ0TmFtZSk7XHJcblx0XHRkaXYgPSBudWxsO1xyXG5cclxuXHRcdHJldHVybiBzdXBwb3J0ZWQ7XHJcblx0fSgpKTtcclxuXHJcblxyXG5cdEwuQnJvd3NlciA9IHtcclxuXHRcdGllOiBpZSxcclxuXHRcdGllbHQ5OiBpZWx0OSxcclxuXHRcdHdlYmtpdDogd2Via2l0LFxyXG5cdFx0Z2Vja286IGdlY2tvICYmICF3ZWJraXQgJiYgIXdpbmRvdy5vcGVyYSAmJiAhaWUsXHJcblxyXG5cdFx0YW5kcm9pZDogYW5kcm9pZCxcclxuXHRcdGFuZHJvaWQyMzogYW5kcm9pZDIzLFxyXG5cclxuXHRcdGNocm9tZTogY2hyb21lLFxyXG5cclxuXHRcdGllM2Q6IGllM2QsXHJcblx0XHR3ZWJraXQzZDogd2Via2l0M2QsXHJcblx0XHRnZWNrbzNkOiBnZWNrbzNkLFxyXG5cdFx0b3BlcmEzZDogb3BlcmEzZCxcclxuXHRcdGFueTNkOiBhbnkzZCxcclxuXHJcblx0XHRtb2JpbGU6IG1vYmlsZSxcclxuXHRcdG1vYmlsZVdlYmtpdDogbW9iaWxlICYmIHdlYmtpdCxcclxuXHRcdG1vYmlsZVdlYmtpdDNkOiBtb2JpbGUgJiYgd2Via2l0M2QsXHJcblx0XHRtb2JpbGVPcGVyYTogbW9iaWxlICYmIHdpbmRvdy5vcGVyYSxcclxuXHJcblx0XHR0b3VjaDogdG91Y2gsXHJcblx0XHRtc1BvaW50ZXI6IG1zUG9pbnRlcixcclxuXHRcdHBvaW50ZXI6IHBvaW50ZXIsXHJcblxyXG5cdFx0cmV0aW5hOiByZXRpbmFcclxuXHR9O1xyXG5cclxufSgpKTtcclxuXG5cbi8qXHJcbiAqIEwuUG9pbnQgcmVwcmVzZW50cyBhIHBvaW50IHdpdGggeCBhbmQgeSBjb29yZGluYXRlcy5cclxuICovXHJcblxyXG5MLlBvaW50ID0gZnVuY3Rpb24gKC8qTnVtYmVyKi8geCwgLypOdW1iZXIqLyB5LCAvKkJvb2xlYW4qLyByb3VuZCkge1xyXG5cdHRoaXMueCA9IChyb3VuZCA/IE1hdGgucm91bmQoeCkgOiB4KTtcclxuXHR0aGlzLnkgPSAocm91bmQgPyBNYXRoLnJvdW5kKHkpIDogeSk7XHJcbn07XHJcblxyXG5MLlBvaW50LnByb3RvdHlwZSA9IHtcclxuXHJcblx0Y2xvbmU6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBuZXcgTC5Qb2ludCh0aGlzLngsIHRoaXMueSk7XHJcblx0fSxcclxuXHJcblx0Ly8gbm9uLWRlc3RydWN0aXZlLCByZXR1cm5zIGEgbmV3IHBvaW50XHJcblx0YWRkOiBmdW5jdGlvbiAocG9pbnQpIHtcclxuXHRcdHJldHVybiB0aGlzLmNsb25lKCkuX2FkZChMLnBvaW50KHBvaW50KSk7XHJcblx0fSxcclxuXHJcblx0Ly8gZGVzdHJ1Y3RpdmUsIHVzZWQgZGlyZWN0bHkgZm9yIHBlcmZvcm1hbmNlIGluIHNpdHVhdGlvbnMgd2hlcmUgaXQncyBzYWZlIHRvIG1vZGlmeSBleGlzdGluZyBwb2ludFxyXG5cdF9hZGQ6IGZ1bmN0aW9uIChwb2ludCkge1xyXG5cdFx0dGhpcy54ICs9IHBvaW50Lng7XHJcblx0XHR0aGlzLnkgKz0gcG9pbnQueTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdHN1YnRyYWN0OiBmdW5jdGlvbiAocG9pbnQpIHtcclxuXHRcdHJldHVybiB0aGlzLmNsb25lKCkuX3N1YnRyYWN0KEwucG9pbnQocG9pbnQpKTtcclxuXHR9LFxyXG5cclxuXHRfc3VidHJhY3Q6IGZ1bmN0aW9uIChwb2ludCkge1xyXG5cdFx0dGhpcy54IC09IHBvaW50Lng7XHJcblx0XHR0aGlzLnkgLT0gcG9pbnQueTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGRpdmlkZUJ5OiBmdW5jdGlvbiAobnVtKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jbG9uZSgpLl9kaXZpZGVCeShudW0pO1xyXG5cdH0sXHJcblxyXG5cdF9kaXZpZGVCeTogZnVuY3Rpb24gKG51bSkge1xyXG5cdFx0dGhpcy54IC89IG51bTtcclxuXHRcdHRoaXMueSAvPSBudW07XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRtdWx0aXBseUJ5OiBmdW5jdGlvbiAobnVtKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jbG9uZSgpLl9tdWx0aXBseUJ5KG51bSk7XHJcblx0fSxcclxuXHJcblx0X211bHRpcGx5Qnk6IGZ1bmN0aW9uIChudW0pIHtcclxuXHRcdHRoaXMueCAqPSBudW07XHJcblx0XHR0aGlzLnkgKj0gbnVtO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0cm91bmQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLmNsb25lKCkuX3JvdW5kKCk7XHJcblx0fSxcclxuXHJcblx0X3JvdW5kOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLnggPSBNYXRoLnJvdW5kKHRoaXMueCk7XHJcblx0XHR0aGlzLnkgPSBNYXRoLnJvdW5kKHRoaXMueSk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRmbG9vcjogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY2xvbmUoKS5fZmxvb3IoKTtcclxuXHR9LFxyXG5cclxuXHRfZmxvb3I6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHRoaXMueCA9IE1hdGguZmxvb3IodGhpcy54KTtcclxuXHRcdHRoaXMueSA9IE1hdGguZmxvb3IodGhpcy55KTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGRpc3RhbmNlVG86IGZ1bmN0aW9uIChwb2ludCkge1xyXG5cdFx0cG9pbnQgPSBMLnBvaW50KHBvaW50KTtcclxuXHJcblx0XHR2YXIgeCA9IHBvaW50LnggLSB0aGlzLngsXHJcblx0XHQgICAgeSA9IHBvaW50LnkgLSB0aGlzLnk7XHJcblxyXG5cdFx0cmV0dXJuIE1hdGguc3FydCh4ICogeCArIHkgKiB5KTtcclxuXHR9LFxyXG5cclxuXHRlcXVhbHM6IGZ1bmN0aW9uIChwb2ludCkge1xyXG5cdFx0cG9pbnQgPSBMLnBvaW50KHBvaW50KTtcclxuXHJcblx0XHRyZXR1cm4gcG9pbnQueCA9PT0gdGhpcy54ICYmXHJcblx0XHQgICAgICAgcG9pbnQueSA9PT0gdGhpcy55O1xyXG5cdH0sXHJcblxyXG5cdGNvbnRhaW5zOiBmdW5jdGlvbiAocG9pbnQpIHtcclxuXHRcdHBvaW50ID0gTC5wb2ludChwb2ludCk7XHJcblxyXG5cdFx0cmV0dXJuIE1hdGguYWJzKHBvaW50LngpIDw9IE1hdGguYWJzKHRoaXMueCkgJiZcclxuXHRcdCAgICAgICBNYXRoLmFicyhwb2ludC55KSA8PSBNYXRoLmFicyh0aGlzLnkpO1xyXG5cdH0sXHJcblxyXG5cdHRvU3RyaW5nOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gJ1BvaW50KCcgK1xyXG5cdFx0ICAgICAgICBMLlV0aWwuZm9ybWF0TnVtKHRoaXMueCkgKyAnLCAnICtcclxuXHRcdCAgICAgICAgTC5VdGlsLmZvcm1hdE51bSh0aGlzLnkpICsgJyknO1xyXG5cdH1cclxufTtcclxuXHJcbkwucG9pbnQgPSBmdW5jdGlvbiAoeCwgeSwgcm91bmQpIHtcclxuXHRpZiAoeCBpbnN0YW5jZW9mIEwuUG9pbnQpIHtcclxuXHRcdHJldHVybiB4O1xyXG5cdH1cclxuXHRpZiAoTC5VdGlsLmlzQXJyYXkoeCkpIHtcclxuXHRcdHJldHVybiBuZXcgTC5Qb2ludCh4WzBdLCB4WzFdKTtcclxuXHR9XHJcblx0aWYgKHggPT09IHVuZGVmaW5lZCB8fCB4ID09PSBudWxsKSB7XHJcblx0XHRyZXR1cm4geDtcclxuXHR9XHJcblx0cmV0dXJuIG5ldyBMLlBvaW50KHgsIHksIHJvdW5kKTtcclxufTtcclxuXG5cbi8qXHJcbiAqIEwuQm91bmRzIHJlcHJlc2VudHMgYSByZWN0YW5ndWxhciBhcmVhIG9uIHRoZSBzY3JlZW4gaW4gcGl4ZWwgY29vcmRpbmF0ZXMuXHJcbiAqL1xyXG5cclxuTC5Cb3VuZHMgPSBmdW5jdGlvbiAoYSwgYikgeyAvLyhQb2ludCwgUG9pbnQpIG9yIFBvaW50W11cclxuXHRpZiAoIWEpIHsgcmV0dXJuOyB9XHJcblxyXG5cdHZhciBwb2ludHMgPSBiID8gW2EsIGJdIDogYTtcclxuXHJcblx0Zm9yICh2YXIgaSA9IDAsIGxlbiA9IHBvaW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0dGhpcy5leHRlbmQocG9pbnRzW2ldKTtcclxuXHR9XHJcbn07XHJcblxyXG5MLkJvdW5kcy5wcm90b3R5cGUgPSB7XHJcblx0Ly8gZXh0ZW5kIHRoZSBib3VuZHMgdG8gY29udGFpbiB0aGUgZ2l2ZW4gcG9pbnRcclxuXHRleHRlbmQ6IGZ1bmN0aW9uIChwb2ludCkgeyAvLyAoUG9pbnQpXHJcblx0XHRwb2ludCA9IEwucG9pbnQocG9pbnQpO1xyXG5cclxuXHRcdGlmICghdGhpcy5taW4gJiYgIXRoaXMubWF4KSB7XHJcblx0XHRcdHRoaXMubWluID0gcG9pbnQuY2xvbmUoKTtcclxuXHRcdFx0dGhpcy5tYXggPSBwb2ludC5jbG9uZSgpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5taW4ueCA9IE1hdGgubWluKHBvaW50LngsIHRoaXMubWluLngpO1xyXG5cdFx0XHR0aGlzLm1heC54ID0gTWF0aC5tYXgocG9pbnQueCwgdGhpcy5tYXgueCk7XHJcblx0XHRcdHRoaXMubWluLnkgPSBNYXRoLm1pbihwb2ludC55LCB0aGlzLm1pbi55KTtcclxuXHRcdFx0dGhpcy5tYXgueSA9IE1hdGgubWF4KHBvaW50LnksIHRoaXMubWF4LnkpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0Z2V0Q2VudGVyOiBmdW5jdGlvbiAocm91bmQpIHsgLy8gKEJvb2xlYW4pIC0+IFBvaW50XHJcblx0XHRyZXR1cm4gbmV3IEwuUG9pbnQoXHJcblx0XHQgICAgICAgICh0aGlzLm1pbi54ICsgdGhpcy5tYXgueCkgLyAyLFxyXG5cdFx0ICAgICAgICAodGhpcy5taW4ueSArIHRoaXMubWF4LnkpIC8gMiwgcm91bmQpO1xyXG5cdH0sXHJcblxyXG5cdGdldEJvdHRvbUxlZnQ6IGZ1bmN0aW9uICgpIHsgLy8gLT4gUG9pbnRcclxuXHRcdHJldHVybiBuZXcgTC5Qb2ludCh0aGlzLm1pbi54LCB0aGlzLm1heC55KTtcclxuXHR9LFxyXG5cclxuXHRnZXRUb3BSaWdodDogZnVuY3Rpb24gKCkgeyAvLyAtPiBQb2ludFxyXG5cdFx0cmV0dXJuIG5ldyBMLlBvaW50KHRoaXMubWF4LngsIHRoaXMubWluLnkpO1xyXG5cdH0sXHJcblxyXG5cdGdldFNpemU6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLm1heC5zdWJ0cmFjdCh0aGlzLm1pbik7XHJcblx0fSxcclxuXHJcblx0Y29udGFpbnM6IGZ1bmN0aW9uIChvYmopIHsgLy8gKEJvdW5kcykgb3IgKFBvaW50KSAtPiBCb29sZWFuXHJcblx0XHR2YXIgbWluLCBtYXg7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBvYmpbMF0gPT09ICdudW1iZXInIHx8IG9iaiBpbnN0YW5jZW9mIEwuUG9pbnQpIHtcclxuXHRcdFx0b2JqID0gTC5wb2ludChvYmopO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0b2JqID0gTC5ib3VuZHMob2JqKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAob2JqIGluc3RhbmNlb2YgTC5Cb3VuZHMpIHtcclxuXHRcdFx0bWluID0gb2JqLm1pbjtcclxuXHRcdFx0bWF4ID0gb2JqLm1heDtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG1pbiA9IG1heCA9IG9iajtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gKG1pbi54ID49IHRoaXMubWluLngpICYmXHJcblx0XHQgICAgICAgKG1heC54IDw9IHRoaXMubWF4LngpICYmXHJcblx0XHQgICAgICAgKG1pbi55ID49IHRoaXMubWluLnkpICYmXHJcblx0XHQgICAgICAgKG1heC55IDw9IHRoaXMubWF4LnkpO1xyXG5cdH0sXHJcblxyXG5cdGludGVyc2VjdHM6IGZ1bmN0aW9uIChib3VuZHMpIHsgLy8gKEJvdW5kcykgLT4gQm9vbGVhblxyXG5cdFx0Ym91bmRzID0gTC5ib3VuZHMoYm91bmRzKTtcclxuXHJcblx0XHR2YXIgbWluID0gdGhpcy5taW4sXHJcblx0XHQgICAgbWF4ID0gdGhpcy5tYXgsXHJcblx0XHQgICAgbWluMiA9IGJvdW5kcy5taW4sXHJcblx0XHQgICAgbWF4MiA9IGJvdW5kcy5tYXgsXHJcblx0XHQgICAgeEludGVyc2VjdHMgPSAobWF4Mi54ID49IG1pbi54KSAmJiAobWluMi54IDw9IG1heC54KSxcclxuXHRcdCAgICB5SW50ZXJzZWN0cyA9IChtYXgyLnkgPj0gbWluLnkpICYmIChtaW4yLnkgPD0gbWF4LnkpO1xyXG5cclxuXHRcdHJldHVybiB4SW50ZXJzZWN0cyAmJiB5SW50ZXJzZWN0cztcclxuXHR9LFxyXG5cclxuXHRpc1ZhbGlkOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gISEodGhpcy5taW4gJiYgdGhpcy5tYXgpO1xyXG5cdH1cclxufTtcclxuXHJcbkwuYm91bmRzID0gZnVuY3Rpb24gKGEsIGIpIHsgLy8gKEJvdW5kcykgb3IgKFBvaW50LCBQb2ludCkgb3IgKFBvaW50W10pXHJcblx0aWYgKCFhIHx8IGEgaW5zdGFuY2VvZiBMLkJvdW5kcykge1xyXG5cdFx0cmV0dXJuIGE7XHJcblx0fVxyXG5cdHJldHVybiBuZXcgTC5Cb3VuZHMoYSwgYik7XHJcbn07XHJcblxuXG4vKlxyXG4gKiBMLlRyYW5zZm9ybWF0aW9uIGlzIGFuIHV0aWxpdHkgY2xhc3MgdG8gcGVyZm9ybSBzaW1wbGUgcG9pbnQgdHJhbnNmb3JtYXRpb25zIHRocm91Z2ggYSAyZC1tYXRyaXguXHJcbiAqL1xyXG5cclxuTC5UcmFuc2Zvcm1hdGlvbiA9IGZ1bmN0aW9uIChhLCBiLCBjLCBkKSB7XHJcblx0dGhpcy5fYSA9IGE7XHJcblx0dGhpcy5fYiA9IGI7XHJcblx0dGhpcy5fYyA9IGM7XHJcblx0dGhpcy5fZCA9IGQ7XHJcbn07XHJcblxyXG5MLlRyYW5zZm9ybWF0aW9uLnByb3RvdHlwZSA9IHtcclxuXHR0cmFuc2Zvcm06IGZ1bmN0aW9uIChwb2ludCwgc2NhbGUpIHsgLy8gKFBvaW50LCBOdW1iZXIpIC0+IFBvaW50XHJcblx0XHRyZXR1cm4gdGhpcy5fdHJhbnNmb3JtKHBvaW50LmNsb25lKCksIHNjYWxlKTtcclxuXHR9LFxyXG5cclxuXHQvLyBkZXN0cnVjdGl2ZSB0cmFuc2Zvcm0gKGZhc3RlcilcclxuXHRfdHJhbnNmb3JtOiBmdW5jdGlvbiAocG9pbnQsIHNjYWxlKSB7XHJcblx0XHRzY2FsZSA9IHNjYWxlIHx8IDE7XHJcblx0XHRwb2ludC54ID0gc2NhbGUgKiAodGhpcy5fYSAqIHBvaW50LnggKyB0aGlzLl9iKTtcclxuXHRcdHBvaW50LnkgPSBzY2FsZSAqICh0aGlzLl9jICogcG9pbnQueSArIHRoaXMuX2QpO1xyXG5cdFx0cmV0dXJuIHBvaW50O1xyXG5cdH0sXHJcblxyXG5cdHVudHJhbnNmb3JtOiBmdW5jdGlvbiAocG9pbnQsIHNjYWxlKSB7XHJcblx0XHRzY2FsZSA9IHNjYWxlIHx8IDE7XHJcblx0XHRyZXR1cm4gbmV3IEwuUG9pbnQoXHJcblx0XHQgICAgICAgIChwb2ludC54IC8gc2NhbGUgLSB0aGlzLl9iKSAvIHRoaXMuX2EsXHJcblx0XHQgICAgICAgIChwb2ludC55IC8gc2NhbGUgLSB0aGlzLl9kKSAvIHRoaXMuX2MpO1xyXG5cdH1cclxufTtcclxuXG5cbi8qXHJcbiAqIEwuRG9tVXRpbCBjb250YWlucyB2YXJpb3VzIHV0aWxpdHkgZnVuY3Rpb25zIGZvciB3b3JraW5nIHdpdGggRE9NLlxyXG4gKi9cclxuXHJcbkwuRG9tVXRpbCA9IHtcclxuXHRnZXQ6IGZ1bmN0aW9uIChpZCkge1xyXG5cdFx0cmV0dXJuICh0eXBlb2YgaWQgPT09ICdzdHJpbmcnID8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpIDogaWQpO1xyXG5cdH0sXHJcblxyXG5cdGdldFN0eWxlOiBmdW5jdGlvbiAoZWwsIHN0eWxlKSB7XHJcblxyXG5cdFx0dmFyIHZhbHVlID0gZWwuc3R5bGVbc3R5bGVdO1xyXG5cclxuXHRcdGlmICghdmFsdWUgJiYgZWwuY3VycmVudFN0eWxlKSB7XHJcblx0XHRcdHZhbHVlID0gZWwuY3VycmVudFN0eWxlW3N0eWxlXTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoKCF2YWx1ZSB8fCB2YWx1ZSA9PT0gJ2F1dG8nKSAmJiBkb2N1bWVudC5kZWZhdWx0Vmlldykge1xyXG5cdFx0XHR2YXIgY3NzID0gZG9jdW1lbnQuZGVmYXVsdFZpZXcuZ2V0Q29tcHV0ZWRTdHlsZShlbCwgbnVsbCk7XHJcblx0XHRcdHZhbHVlID0gY3NzID8gY3NzW3N0eWxlXSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHZhbHVlID09PSAnYXV0bycgPyBudWxsIDogdmFsdWU7XHJcblx0fSxcclxuXHJcblx0Z2V0Vmlld3BvcnRPZmZzZXQ6IGZ1bmN0aW9uIChlbGVtZW50KSB7XHJcblxyXG5cdFx0dmFyIHRvcCA9IDAsXHJcblx0XHQgICAgbGVmdCA9IDAsXHJcblx0XHQgICAgZWwgPSBlbGVtZW50LFxyXG5cdFx0ICAgIGRvY0JvZHkgPSBkb2N1bWVudC5ib2R5LFxyXG5cdFx0ICAgIGRvY0VsID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LFxyXG5cdFx0ICAgIHBvcztcclxuXHJcblx0XHRkbyB7XHJcblx0XHRcdHRvcCAgKz0gZWwub2Zmc2V0VG9wICB8fCAwO1xyXG5cdFx0XHRsZWZ0ICs9IGVsLm9mZnNldExlZnQgfHwgMDtcclxuXHJcblx0XHRcdC8vYWRkIGJvcmRlcnNcclxuXHRcdFx0dG9wICs9IHBhcnNlSW50KEwuRG9tVXRpbC5nZXRTdHlsZShlbCwgJ2JvcmRlclRvcFdpZHRoJyksIDEwKSB8fCAwO1xyXG5cdFx0XHRsZWZ0ICs9IHBhcnNlSW50KEwuRG9tVXRpbC5nZXRTdHlsZShlbCwgJ2JvcmRlckxlZnRXaWR0aCcpLCAxMCkgfHwgMDtcclxuXHJcblx0XHRcdHBvcyA9IEwuRG9tVXRpbC5nZXRTdHlsZShlbCwgJ3Bvc2l0aW9uJyk7XHJcblxyXG5cdFx0XHRpZiAoZWwub2Zmc2V0UGFyZW50ID09PSBkb2NCb2R5ICYmIHBvcyA9PT0gJ2Fic29sdXRlJykgeyBicmVhazsgfVxyXG5cclxuXHRcdFx0aWYgKHBvcyA9PT0gJ2ZpeGVkJykge1xyXG5cdFx0XHRcdHRvcCAgKz0gZG9jQm9keS5zY3JvbGxUb3AgIHx8IGRvY0VsLnNjcm9sbFRvcCAgfHwgMDtcclxuXHRcdFx0XHRsZWZ0ICs9IGRvY0JvZHkuc2Nyb2xsTGVmdCB8fCBkb2NFbC5zY3JvbGxMZWZ0IHx8IDA7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChwb3MgPT09ICdyZWxhdGl2ZScgJiYgIWVsLm9mZnNldExlZnQpIHtcclxuXHRcdFx0XHR2YXIgd2lkdGggPSBMLkRvbVV0aWwuZ2V0U3R5bGUoZWwsICd3aWR0aCcpLFxyXG5cdFx0XHRcdCAgICBtYXhXaWR0aCA9IEwuRG9tVXRpbC5nZXRTdHlsZShlbCwgJ21heC13aWR0aCcpLFxyXG5cdFx0XHRcdCAgICByID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblxyXG5cdFx0XHRcdGlmICh3aWR0aCAhPT0gJ25vbmUnIHx8IG1heFdpZHRoICE9PSAnbm9uZScpIHtcclxuXHRcdFx0XHRcdGxlZnQgKz0gci5sZWZ0ICsgZWwuY2xpZW50TGVmdDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vY2FsY3VsYXRlIGZ1bGwgeSBvZmZzZXQgc2luY2Ugd2UncmUgYnJlYWtpbmcgb3V0IG9mIHRoZSBsb29wXHJcblx0XHRcdFx0dG9wICs9IHIudG9wICsgKGRvY0JvZHkuc2Nyb2xsVG9wICB8fCBkb2NFbC5zY3JvbGxUb3AgIHx8IDApO1xyXG5cclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZWwgPSBlbC5vZmZzZXRQYXJlbnQ7XHJcblxyXG5cdFx0fSB3aGlsZSAoZWwpO1xyXG5cclxuXHRcdGVsID0gZWxlbWVudDtcclxuXHJcblx0XHRkbyB7XHJcblx0XHRcdGlmIChlbCA9PT0gZG9jQm9keSkgeyBicmVhazsgfVxyXG5cclxuXHRcdFx0dG9wICAtPSBlbC5zY3JvbGxUb3AgIHx8IDA7XHJcblx0XHRcdGxlZnQgLT0gZWwuc2Nyb2xsTGVmdCB8fCAwO1xyXG5cclxuXHRcdFx0ZWwgPSBlbC5wYXJlbnROb2RlO1xyXG5cdFx0fSB3aGlsZSAoZWwpO1xyXG5cclxuXHRcdHJldHVybiBuZXcgTC5Qb2ludChsZWZ0LCB0b3ApO1xyXG5cdH0sXHJcblxyXG5cdGRvY3VtZW50SXNMdHI6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICghTC5Eb21VdGlsLl9kb2NJc0x0ckNhY2hlZCkge1xyXG5cdFx0XHRMLkRvbVV0aWwuX2RvY0lzTHRyQ2FjaGVkID0gdHJ1ZTtcclxuXHRcdFx0TC5Eb21VdGlsLl9kb2NJc0x0ciA9IEwuRG9tVXRpbC5nZXRTdHlsZShkb2N1bWVudC5ib2R5LCAnZGlyZWN0aW9uJykgPT09ICdsdHInO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIEwuRG9tVXRpbC5fZG9jSXNMdHI7XHJcblx0fSxcclxuXHJcblx0Y3JlYXRlOiBmdW5jdGlvbiAodGFnTmFtZSwgY2xhc3NOYW1lLCBjb250YWluZXIpIHtcclxuXHJcblx0XHR2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xyXG5cdFx0ZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xyXG5cclxuXHRcdGlmIChjb250YWluZXIpIHtcclxuXHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGVsKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZWw7XHJcblx0fSxcclxuXHJcblx0aGFzQ2xhc3M6IGZ1bmN0aW9uIChlbCwgbmFtZSkge1xyXG5cdFx0aWYgKGVsLmNsYXNzTGlzdCAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHJldHVybiBlbC5jbGFzc0xpc3QuY29udGFpbnMobmFtZSk7XHJcblx0XHR9XHJcblx0XHR2YXIgY2xhc3NOYW1lID0gTC5Eb21VdGlsLl9nZXRDbGFzcyhlbCk7XHJcblx0XHRyZXR1cm4gY2xhc3NOYW1lLmxlbmd0aCA+IDAgJiYgbmV3IFJlZ0V4cCgnKF58XFxcXHMpJyArIG5hbWUgKyAnKFxcXFxzfCQpJykudGVzdChjbGFzc05hbWUpO1xyXG5cdH0sXHJcblxyXG5cdGFkZENsYXNzOiBmdW5jdGlvbiAoZWwsIG5hbWUpIHtcclxuXHRcdGlmIChlbC5jbGFzc0xpc3QgIT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHR2YXIgY2xhc3NlcyA9IEwuVXRpbC5zcGxpdFdvcmRzKG5hbWUpO1xyXG5cdFx0XHRmb3IgKHZhciBpID0gMCwgbGVuID0gY2xhc3Nlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0XHRcdGVsLmNsYXNzTGlzdC5hZGQoY2xhc3Nlc1tpXSk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAoIUwuRG9tVXRpbC5oYXNDbGFzcyhlbCwgbmFtZSkpIHtcclxuXHRcdFx0dmFyIGNsYXNzTmFtZSA9IEwuRG9tVXRpbC5fZ2V0Q2xhc3MoZWwpO1xyXG5cdFx0XHRMLkRvbVV0aWwuX3NldENsYXNzKGVsLCAoY2xhc3NOYW1lID8gY2xhc3NOYW1lICsgJyAnIDogJycpICsgbmFtZSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0cmVtb3ZlQ2xhc3M6IGZ1bmN0aW9uIChlbCwgbmFtZSkge1xyXG5cdFx0aWYgKGVsLmNsYXNzTGlzdCAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdGVsLmNsYXNzTGlzdC5yZW1vdmUobmFtZSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRMLkRvbVV0aWwuX3NldENsYXNzKGVsLCBMLlV0aWwudHJpbSgoJyAnICsgTC5Eb21VdGlsLl9nZXRDbGFzcyhlbCkgKyAnICcpLnJlcGxhY2UoJyAnICsgbmFtZSArICcgJywgJyAnKSkpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9zZXRDbGFzczogZnVuY3Rpb24gKGVsLCBuYW1lKSB7XHJcblx0XHRpZiAoZWwuY2xhc3NOYW1lLmJhc2VWYWwgPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRlbC5jbGFzc05hbWUgPSBuYW1lO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Ly8gaW4gY2FzZSBvZiBTVkcgZWxlbWVudFxyXG5cdFx0XHRlbC5jbGFzc05hbWUuYmFzZVZhbCA9IG5hbWU7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X2dldENsYXNzOiBmdW5jdGlvbiAoZWwpIHtcclxuXHRcdHJldHVybiBlbC5jbGFzc05hbWUuYmFzZVZhbCA9PT0gdW5kZWZpbmVkID8gZWwuY2xhc3NOYW1lIDogZWwuY2xhc3NOYW1lLmJhc2VWYWw7XHJcblx0fSxcclxuXHJcblx0c2V0T3BhY2l0eTogZnVuY3Rpb24gKGVsLCB2YWx1ZSkge1xyXG5cclxuXHRcdGlmICgnb3BhY2l0eScgaW4gZWwuc3R5bGUpIHtcclxuXHRcdFx0ZWwuc3R5bGUub3BhY2l0eSA9IHZhbHVlO1xyXG5cclxuXHRcdH0gZWxzZSBpZiAoJ2ZpbHRlcicgaW4gZWwuc3R5bGUpIHtcclxuXHJcblx0XHRcdHZhciBmaWx0ZXIgPSBmYWxzZSxcclxuXHRcdFx0ICAgIGZpbHRlck5hbWUgPSAnRFhJbWFnZVRyYW5zZm9ybS5NaWNyb3NvZnQuQWxwaGEnO1xyXG5cclxuXHRcdFx0Ly8gZmlsdGVycyBjb2xsZWN0aW9uIHRocm93cyBhbiBlcnJvciBpZiB3ZSB0cnkgdG8gcmV0cmlldmUgYSBmaWx0ZXIgdGhhdCBkb2Vzbid0IGV4aXN0XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0ZmlsdGVyID0gZWwuZmlsdGVycy5pdGVtKGZpbHRlck5hbWUpO1xyXG5cdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdFx0Ly8gZG9uJ3Qgc2V0IG9wYWNpdHkgdG8gMSBpZiB3ZSBoYXZlbid0IGFscmVhZHkgc2V0IGFuIG9wYWNpdHksXHJcblx0XHRcdFx0Ly8gaXQgaXNuJ3QgbmVlZGVkIGFuZCBicmVha3MgdHJhbnNwYXJlbnQgcG5ncy5cclxuXHRcdFx0XHRpZiAodmFsdWUgPT09IDEpIHsgcmV0dXJuOyB9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhbHVlID0gTWF0aC5yb3VuZCh2YWx1ZSAqIDEwMCk7XHJcblxyXG5cdFx0XHRpZiAoZmlsdGVyKSB7XHJcblx0XHRcdFx0ZmlsdGVyLkVuYWJsZWQgPSAodmFsdWUgIT09IDEwMCk7XHJcblx0XHRcdFx0ZmlsdGVyLk9wYWNpdHkgPSB2YWx1ZTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRlbC5zdHlsZS5maWx0ZXIgKz0gJyBwcm9naWQ6JyArIGZpbHRlck5hbWUgKyAnKG9wYWNpdHk9JyArIHZhbHVlICsgJyknO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0dGVzdFByb3A6IGZ1bmN0aW9uIChwcm9wcykge1xyXG5cclxuXHRcdHZhciBzdHlsZSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGlmIChwcm9wc1tpXSBpbiBzdHlsZSkge1xyXG5cdFx0XHRcdHJldHVybiBwcm9wc1tpXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH0sXHJcblxyXG5cdGdldFRyYW5zbGF0ZVN0cmluZzogZnVuY3Rpb24gKHBvaW50KSB7XHJcblx0XHQvLyBvbiBXZWJLaXQgYnJvd3NlcnMgKENocm9tZS9TYWZhcmkvaU9TIFNhZmFyaS9BbmRyb2lkKSB1c2luZyB0cmFuc2xhdGUzZCBpbnN0ZWFkIG9mIHRyYW5zbGF0ZVxyXG5cdFx0Ly8gbWFrZXMgYW5pbWF0aW9uIHNtb290aGVyIGFzIGl0IGVuc3VyZXMgSFcgYWNjZWwgaXMgdXNlZC4gRmlyZWZveCAxMyBkb2Vzbid0IGNhcmVcclxuXHRcdC8vIChzYW1lIHNwZWVkIGVpdGhlciB3YXkpLCBPcGVyYSAxMiBkb2Vzbid0IHN1cHBvcnQgdHJhbnNsYXRlM2RcclxuXHJcblx0XHR2YXIgaXMzZCA9IEwuQnJvd3Nlci53ZWJraXQzZCxcclxuXHRcdCAgICBvcGVuID0gJ3RyYW5zbGF0ZScgKyAoaXMzZCA/ICczZCcgOiAnJykgKyAnKCcsXHJcblx0XHQgICAgY2xvc2UgPSAoaXMzZCA/ICcsMCcgOiAnJykgKyAnKSc7XHJcblxyXG5cdFx0cmV0dXJuIG9wZW4gKyBwb2ludC54ICsgJ3B4LCcgKyBwb2ludC55ICsgJ3B4JyArIGNsb3NlO1xyXG5cdH0sXHJcblxyXG5cdGdldFNjYWxlU3RyaW5nOiBmdW5jdGlvbiAoc2NhbGUsIG9yaWdpbikge1xyXG5cclxuXHRcdHZhciBwcmVUcmFuc2xhdGVTdHIgPSBMLkRvbVV0aWwuZ2V0VHJhbnNsYXRlU3RyaW5nKG9yaWdpbi5hZGQob3JpZ2luLm11bHRpcGx5QnkoLTEgKiBzY2FsZSkpKSxcclxuXHRcdCAgICBzY2FsZVN0ciA9ICcgc2NhbGUoJyArIHNjYWxlICsgJykgJztcclxuXHJcblx0XHRyZXR1cm4gcHJlVHJhbnNsYXRlU3RyICsgc2NhbGVTdHI7XHJcblx0fSxcclxuXHJcblx0c2V0UG9zaXRpb246IGZ1bmN0aW9uIChlbCwgcG9pbnQsIGRpc2FibGUzRCkgeyAvLyAoSFRNTEVsZW1lbnQsIFBvaW50WywgQm9vbGVhbl0pXHJcblxyXG5cdFx0Ly8ganNoaW50IGNhbWVsY2FzZTogZmFsc2VcclxuXHRcdGVsLl9sZWFmbGV0X3BvcyA9IHBvaW50O1xyXG5cclxuXHRcdGlmICghZGlzYWJsZTNEICYmIEwuQnJvd3Nlci5hbnkzZCkge1xyXG5cdFx0XHRlbC5zdHlsZVtMLkRvbVV0aWwuVFJBTlNGT1JNXSA9ICBMLkRvbVV0aWwuZ2V0VHJhbnNsYXRlU3RyaW5nKHBvaW50KTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGVsLnN0eWxlLmxlZnQgPSBwb2ludC54ICsgJ3B4JztcclxuXHRcdFx0ZWwuc3R5bGUudG9wID0gcG9pbnQueSArICdweCc7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0Z2V0UG9zaXRpb246IGZ1bmN0aW9uIChlbCkge1xyXG5cdFx0Ly8gdGhpcyBtZXRob2QgaXMgb25seSB1c2VkIGZvciBlbGVtZW50cyBwcmV2aW91c2x5IHBvc2l0aW9uZWQgdXNpbmcgc2V0UG9zaXRpb24sXHJcblx0XHQvLyBzbyBpdCdzIHNhZmUgdG8gY2FjaGUgdGhlIHBvc2l0aW9uIGZvciBwZXJmb3JtYW5jZVxyXG5cclxuXHRcdC8vIGpzaGludCBjYW1lbGNhc2U6IGZhbHNlXHJcblx0XHRyZXR1cm4gZWwuX2xlYWZsZXRfcG9zO1xyXG5cdH1cclxufTtcclxuXHJcblxyXG4vLyBwcmVmaXggc3R5bGUgcHJvcGVydHkgbmFtZXNcclxuXHJcbkwuRG9tVXRpbC5UUkFOU0ZPUk0gPSBMLkRvbVV0aWwudGVzdFByb3AoXHJcbiAgICAgICAgWyd0cmFuc2Zvcm0nLCAnV2Via2l0VHJhbnNmb3JtJywgJ09UcmFuc2Zvcm0nLCAnTW96VHJhbnNmb3JtJywgJ21zVHJhbnNmb3JtJ10pO1xyXG5cclxuLy8gd2Via2l0VHJhbnNpdGlvbiBjb21lcyBmaXJzdCBiZWNhdXNlIHNvbWUgYnJvd3NlciB2ZXJzaW9ucyB0aGF0IGRyb3AgdmVuZG9yIHByZWZpeCBkb24ndCBkb1xyXG4vLyB0aGUgc2FtZSBmb3IgdGhlIHRyYW5zaXRpb25lbmQgZXZlbnQsIGluIHBhcnRpY3VsYXIgdGhlIEFuZHJvaWQgNC4xIHN0b2NrIGJyb3dzZXJcclxuXHJcbkwuRG9tVXRpbC5UUkFOU0lUSU9OID0gTC5Eb21VdGlsLnRlc3RQcm9wKFxyXG4gICAgICAgIFsnd2Via2l0VHJhbnNpdGlvbicsICd0cmFuc2l0aW9uJywgJ09UcmFuc2l0aW9uJywgJ01velRyYW5zaXRpb24nLCAnbXNUcmFuc2l0aW9uJ10pO1xyXG5cclxuTC5Eb21VdGlsLlRSQU5TSVRJT05fRU5EID1cclxuICAgICAgICBMLkRvbVV0aWwuVFJBTlNJVElPTiA9PT0gJ3dlYmtpdFRyYW5zaXRpb24nIHx8IEwuRG9tVXRpbC5UUkFOU0lUSU9OID09PSAnT1RyYW5zaXRpb24nID9cclxuICAgICAgICBMLkRvbVV0aWwuVFJBTlNJVElPTiArICdFbmQnIDogJ3RyYW5zaXRpb25lbmQnO1xyXG5cclxuKGZ1bmN0aW9uICgpIHtcclxuICAgIGlmICgnb25zZWxlY3RzdGFydCcgaW4gZG9jdW1lbnQpIHtcclxuICAgICAgICBMLmV4dGVuZChMLkRvbVV0aWwsIHtcclxuICAgICAgICAgICAgZGlzYWJsZVRleHRTZWxlY3Rpb246IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIEwuRG9tRXZlbnQub24od2luZG93LCAnc2VsZWN0c3RhcnQnLCBMLkRvbUV2ZW50LnByZXZlbnREZWZhdWx0KTtcclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIGVuYWJsZVRleHRTZWxlY3Rpb246IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIEwuRG9tRXZlbnQub2ZmKHdpbmRvdywgJ3NlbGVjdHN0YXJ0JywgTC5Eb21FdmVudC5wcmV2ZW50RGVmYXVsdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFyIHVzZXJTZWxlY3RQcm9wZXJ0eSA9IEwuRG9tVXRpbC50ZXN0UHJvcChcclxuICAgICAgICAgICAgWyd1c2VyU2VsZWN0JywgJ1dlYmtpdFVzZXJTZWxlY3QnLCAnT1VzZXJTZWxlY3QnLCAnTW96VXNlclNlbGVjdCcsICdtc1VzZXJTZWxlY3QnXSk7XHJcblxyXG4gICAgICAgIEwuZXh0ZW5kKEwuRG9tVXRpbCwge1xyXG4gICAgICAgICAgICBkaXNhYmxlVGV4dFNlbGVjdGlvbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHVzZXJTZWxlY3RQcm9wZXJ0eSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzdHlsZSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl91c2VyU2VsZWN0ID0gc3R5bGVbdXNlclNlbGVjdFByb3BlcnR5XTtcclxuICAgICAgICAgICAgICAgICAgICBzdHlsZVt1c2VyU2VsZWN0UHJvcGVydHldID0gJ25vbmUnO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG5cclxuICAgICAgICAgICAgZW5hYmxlVGV4dFNlbGVjdGlvbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHVzZXJTZWxlY3RQcm9wZXJ0eSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZVt1c2VyU2VsZWN0UHJvcGVydHldID0gdGhpcy5fdXNlclNlbGVjdDtcclxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fdXNlclNlbGVjdDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuXHRMLmV4dGVuZChMLkRvbVV0aWwsIHtcclxuXHRcdGRpc2FibGVJbWFnZURyYWc6IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0TC5Eb21FdmVudC5vbih3aW5kb3csICdkcmFnc3RhcnQnLCBMLkRvbUV2ZW50LnByZXZlbnREZWZhdWx0KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0ZW5hYmxlSW1hZ2VEcmFnOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdEwuRG9tRXZlbnQub2ZmKHdpbmRvdywgJ2RyYWdzdGFydCcsIEwuRG9tRXZlbnQucHJldmVudERlZmF1bHQpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59KSgpO1xyXG5cblxuLypcclxuICogTC5MYXRMbmcgcmVwcmVzZW50cyBhIGdlb2dyYXBoaWNhbCBwb2ludCB3aXRoIGxhdGl0dWRlIGFuZCBsb25naXR1ZGUgY29vcmRpbmF0ZXMuXHJcbiAqL1xyXG5cclxuTC5MYXRMbmcgPSBmdW5jdGlvbiAobGF0LCBsbmcsIGFsdCkgeyAvLyAoTnVtYmVyLCBOdW1iZXIsIE51bWJlcilcclxuXHRsYXQgPSBwYXJzZUZsb2F0KGxhdCk7XHJcblx0bG5nID0gcGFyc2VGbG9hdChsbmcpO1xyXG5cclxuXHRpZiAoaXNOYU4obGF0KSB8fCBpc05hTihsbmcpKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgTGF0TG5nIG9iamVjdDogKCcgKyBsYXQgKyAnLCAnICsgbG5nICsgJyknKTtcclxuXHR9XHJcblxyXG5cdHRoaXMubGF0ID0gbGF0O1xyXG5cdHRoaXMubG5nID0gbG5nO1xyXG5cclxuXHRpZiAoYWx0ICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdHRoaXMuYWx0ID0gcGFyc2VGbG9hdChhbHQpO1xyXG5cdH1cclxufTtcclxuXHJcbkwuZXh0ZW5kKEwuTGF0TG5nLCB7XHJcblx0REVHX1RPX1JBRDogTWF0aC5QSSAvIDE4MCxcclxuXHRSQURfVE9fREVHOiAxODAgLyBNYXRoLlBJLFxyXG5cdE1BWF9NQVJHSU46IDEuMEUtOSAvLyBtYXggbWFyZ2luIG9mIGVycm9yIGZvciB0aGUgXCJlcXVhbHNcIiBjaGVja1xyXG59KTtcclxuXHJcbkwuTGF0TG5nLnByb3RvdHlwZSA9IHtcclxuXHRlcXVhbHM6IGZ1bmN0aW9uIChvYmopIHsgLy8gKExhdExuZykgLT4gQm9vbGVhblxyXG5cdFx0aWYgKCFvYmopIHsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cdFx0b2JqID0gTC5sYXRMbmcob2JqKTtcclxuXHJcblx0XHR2YXIgbWFyZ2luID0gTWF0aC5tYXgoXHJcblx0XHQgICAgICAgIE1hdGguYWJzKHRoaXMubGF0IC0gb2JqLmxhdCksXHJcblx0XHQgICAgICAgIE1hdGguYWJzKHRoaXMubG5nIC0gb2JqLmxuZykpO1xyXG5cclxuXHRcdHJldHVybiBtYXJnaW4gPD0gTC5MYXRMbmcuTUFYX01BUkdJTjtcclxuXHR9LFxyXG5cclxuXHR0b1N0cmluZzogZnVuY3Rpb24gKHByZWNpc2lvbikgeyAvLyAoTnVtYmVyKSAtPiBTdHJpbmdcclxuXHRcdHJldHVybiAnTGF0TG5nKCcgK1xyXG5cdFx0ICAgICAgICBMLlV0aWwuZm9ybWF0TnVtKHRoaXMubGF0LCBwcmVjaXNpb24pICsgJywgJyArXHJcblx0XHQgICAgICAgIEwuVXRpbC5mb3JtYXROdW0odGhpcy5sbmcsIHByZWNpc2lvbikgKyAnKSc7XHJcblx0fSxcclxuXHJcblx0Ly8gSGF2ZXJzaW5lIGRpc3RhbmNlIGZvcm11bGEsIHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0hhdmVyc2luZV9mb3JtdWxhXHJcblx0Ly8gVE9ETyBtb3ZlIHRvIHByb2plY3Rpb24gY29kZSwgTGF0TG5nIHNob3VsZG4ndCBrbm93IGFib3V0IEVhcnRoXHJcblx0ZGlzdGFuY2VUbzogZnVuY3Rpb24gKG90aGVyKSB7IC8vIChMYXRMbmcpIC0+IE51bWJlclxyXG5cdFx0b3RoZXIgPSBMLmxhdExuZyhvdGhlcik7XHJcblxyXG5cdFx0dmFyIFIgPSA2Mzc4MTM3LCAvLyBlYXJ0aCByYWRpdXMgaW4gbWV0ZXJzXHJcblx0XHQgICAgZDJyID0gTC5MYXRMbmcuREVHX1RPX1JBRCxcclxuXHRcdCAgICBkTGF0ID0gKG90aGVyLmxhdCAtIHRoaXMubGF0KSAqIGQycixcclxuXHRcdCAgICBkTG9uID0gKG90aGVyLmxuZyAtIHRoaXMubG5nKSAqIGQycixcclxuXHRcdCAgICBsYXQxID0gdGhpcy5sYXQgKiBkMnIsXHJcblx0XHQgICAgbGF0MiA9IG90aGVyLmxhdCAqIGQycixcclxuXHRcdCAgICBzaW4xID0gTWF0aC5zaW4oZExhdCAvIDIpLFxyXG5cdFx0ICAgIHNpbjIgPSBNYXRoLnNpbihkTG9uIC8gMik7XHJcblxyXG5cdFx0dmFyIGEgPSBzaW4xICogc2luMSArIHNpbjIgKiBzaW4yICogTWF0aC5jb3MobGF0MSkgKiBNYXRoLmNvcyhsYXQyKTtcclxuXHJcblx0XHRyZXR1cm4gUiAqIDIgKiBNYXRoLmF0YW4yKE1hdGguc3FydChhKSwgTWF0aC5zcXJ0KDEgLSBhKSk7XHJcblx0fSxcclxuXHJcblx0d3JhcDogZnVuY3Rpb24gKGEsIGIpIHsgLy8gKE51bWJlciwgTnVtYmVyKSAtPiBMYXRMbmdcclxuXHRcdHZhciBsbmcgPSB0aGlzLmxuZztcclxuXHJcblx0XHRhID0gYSB8fCAtMTgwO1xyXG5cdFx0YiA9IGIgfHwgIDE4MDtcclxuXHJcblx0XHRsbmcgPSAobG5nICsgYikgJSAoYiAtIGEpICsgKGxuZyA8IGEgfHwgbG5nID09PSBiID8gYiA6IGEpO1xyXG5cclxuXHRcdHJldHVybiBuZXcgTC5MYXRMbmcodGhpcy5sYXQsIGxuZyk7XHJcblx0fVxyXG59O1xyXG5cclxuTC5sYXRMbmcgPSBmdW5jdGlvbiAoYSwgYikgeyAvLyAoTGF0TG5nKSBvciAoW051bWJlciwgTnVtYmVyXSkgb3IgKE51bWJlciwgTnVtYmVyKVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTC5MYXRMbmcpIHtcclxuXHRcdHJldHVybiBhO1xyXG5cdH1cclxuXHRpZiAoTC5VdGlsLmlzQXJyYXkoYSkpIHtcclxuXHRcdGlmICh0eXBlb2YgYVswXSA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGFbMF0gPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdHJldHVybiBuZXcgTC5MYXRMbmcoYVswXSwgYVsxXSwgYVsyXSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHR9XHJcblx0aWYgKGEgPT09IHVuZGVmaW5lZCB8fCBhID09PSBudWxsKSB7XHJcblx0XHRyZXR1cm4gYTtcclxuXHR9XHJcblx0aWYgKHR5cGVvZiBhID09PSAnb2JqZWN0JyAmJiAnbGF0JyBpbiBhKSB7XHJcblx0XHRyZXR1cm4gbmV3IEwuTGF0TG5nKGEubGF0LCAnbG5nJyBpbiBhID8gYS5sbmcgOiBhLmxvbik7XHJcblx0fVxyXG5cdGlmIChiID09PSB1bmRlZmluZWQpIHtcclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHRyZXR1cm4gbmV3IEwuTGF0TG5nKGEsIGIpO1xyXG59O1xyXG5cclxuXG5cbi8qXHJcbiAqIEwuTGF0TG5nQm91bmRzIHJlcHJlc2VudHMgYSByZWN0YW5ndWxhciBhcmVhIG9uIHRoZSBtYXAgaW4gZ2VvZ3JhcGhpY2FsIGNvb3JkaW5hdGVzLlxyXG4gKi9cclxuXHJcbkwuTGF0TG5nQm91bmRzID0gZnVuY3Rpb24gKHNvdXRoV2VzdCwgbm9ydGhFYXN0KSB7IC8vIChMYXRMbmcsIExhdExuZykgb3IgKExhdExuZ1tdKVxyXG5cdGlmICghc291dGhXZXN0KSB7IHJldHVybjsgfVxyXG5cclxuXHR2YXIgbGF0bG5ncyA9IG5vcnRoRWFzdCA/IFtzb3V0aFdlc3QsIG5vcnRoRWFzdF0gOiBzb3V0aFdlc3Q7XHJcblxyXG5cdGZvciAodmFyIGkgPSAwLCBsZW4gPSBsYXRsbmdzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHR0aGlzLmV4dGVuZChsYXRsbmdzW2ldKTtcclxuXHR9XHJcbn07XHJcblxyXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUgPSB7XHJcblx0Ly8gZXh0ZW5kIHRoZSBib3VuZHMgdG8gY29udGFpbiB0aGUgZ2l2ZW4gcG9pbnQgb3IgYm91bmRzXHJcblx0ZXh0ZW5kOiBmdW5jdGlvbiAob2JqKSB7IC8vIChMYXRMbmcpIG9yIChMYXRMbmdCb3VuZHMpXHJcblx0XHRpZiAoIW9iaikgeyByZXR1cm4gdGhpczsgfVxyXG5cclxuXHRcdHZhciBsYXRMbmcgPSBMLmxhdExuZyhvYmopO1xyXG5cdFx0aWYgKGxhdExuZyAhPT0gbnVsbCkge1xyXG5cdFx0XHRvYmogPSBsYXRMbmc7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRvYmogPSBMLmxhdExuZ0JvdW5kcyhvYmopO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChvYmogaW5zdGFuY2VvZiBMLkxhdExuZykge1xyXG5cdFx0XHRpZiAoIXRoaXMuX3NvdXRoV2VzdCAmJiAhdGhpcy5fbm9ydGhFYXN0KSB7XHJcblx0XHRcdFx0dGhpcy5fc291dGhXZXN0ID0gbmV3IEwuTGF0TG5nKG9iai5sYXQsIG9iai5sbmcpO1xyXG5cdFx0XHRcdHRoaXMuX25vcnRoRWFzdCA9IG5ldyBMLkxhdExuZyhvYmoubGF0LCBvYmoubG5nKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl9zb3V0aFdlc3QubGF0ID0gTWF0aC5taW4ob2JqLmxhdCwgdGhpcy5fc291dGhXZXN0LmxhdCk7XHJcblx0XHRcdFx0dGhpcy5fc291dGhXZXN0LmxuZyA9IE1hdGgubWluKG9iai5sbmcsIHRoaXMuX3NvdXRoV2VzdC5sbmcpO1xyXG5cclxuXHRcdFx0XHR0aGlzLl9ub3J0aEVhc3QubGF0ID0gTWF0aC5tYXgob2JqLmxhdCwgdGhpcy5fbm9ydGhFYXN0LmxhdCk7XHJcblx0XHRcdFx0dGhpcy5fbm9ydGhFYXN0LmxuZyA9IE1hdGgubWF4KG9iai5sbmcsIHRoaXMuX25vcnRoRWFzdC5sbmcpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKG9iaiBpbnN0YW5jZW9mIEwuTGF0TG5nQm91bmRzKSB7XHJcblx0XHRcdHRoaXMuZXh0ZW5kKG9iai5fc291dGhXZXN0KTtcclxuXHRcdFx0dGhpcy5leHRlbmQob2JqLl9ub3J0aEVhc3QpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0Ly8gZXh0ZW5kIHRoZSBib3VuZHMgYnkgYSBwZXJjZW50YWdlXHJcblx0cGFkOiBmdW5jdGlvbiAoYnVmZmVyUmF0aW8pIHsgLy8gKE51bWJlcikgLT4gTGF0TG5nQm91bmRzXHJcblx0XHR2YXIgc3cgPSB0aGlzLl9zb3V0aFdlc3QsXHJcblx0XHQgICAgbmUgPSB0aGlzLl9ub3J0aEVhc3QsXHJcblx0XHQgICAgaGVpZ2h0QnVmZmVyID0gTWF0aC5hYnMoc3cubGF0IC0gbmUubGF0KSAqIGJ1ZmZlclJhdGlvLFxyXG5cdFx0ICAgIHdpZHRoQnVmZmVyID0gTWF0aC5hYnMoc3cubG5nIC0gbmUubG5nKSAqIGJ1ZmZlclJhdGlvO1xyXG5cclxuXHRcdHJldHVybiBuZXcgTC5MYXRMbmdCb3VuZHMoXHJcblx0XHQgICAgICAgIG5ldyBMLkxhdExuZyhzdy5sYXQgLSBoZWlnaHRCdWZmZXIsIHN3LmxuZyAtIHdpZHRoQnVmZmVyKSxcclxuXHRcdCAgICAgICAgbmV3IEwuTGF0TG5nKG5lLmxhdCArIGhlaWdodEJ1ZmZlciwgbmUubG5nICsgd2lkdGhCdWZmZXIpKTtcclxuXHR9LFxyXG5cclxuXHRnZXRDZW50ZXI6IGZ1bmN0aW9uICgpIHsgLy8gLT4gTGF0TG5nXHJcblx0XHRyZXR1cm4gbmV3IEwuTGF0TG5nKFxyXG5cdFx0ICAgICAgICAodGhpcy5fc291dGhXZXN0LmxhdCArIHRoaXMuX25vcnRoRWFzdC5sYXQpIC8gMixcclxuXHRcdCAgICAgICAgKHRoaXMuX3NvdXRoV2VzdC5sbmcgKyB0aGlzLl9ub3J0aEVhc3QubG5nKSAvIDIpO1xyXG5cdH0sXHJcblxyXG5cdGdldFNvdXRoV2VzdDogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX3NvdXRoV2VzdDtcclxuXHR9LFxyXG5cclxuXHRnZXROb3J0aEVhc3Q6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9ub3J0aEVhc3Q7XHJcblx0fSxcclxuXHJcblx0Z2V0Tm9ydGhXZXN0OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gbmV3IEwuTGF0TG5nKHRoaXMuZ2V0Tm9ydGgoKSwgdGhpcy5nZXRXZXN0KCkpO1xyXG5cdH0sXHJcblxyXG5cdGdldFNvdXRoRWFzdDogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIG5ldyBMLkxhdExuZyh0aGlzLmdldFNvdXRoKCksIHRoaXMuZ2V0RWFzdCgpKTtcclxuXHR9LFxyXG5cclxuXHRnZXRXZXN0OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fc291dGhXZXN0LmxuZztcclxuXHR9LFxyXG5cclxuXHRnZXRTb3V0aDogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX3NvdXRoV2VzdC5sYXQ7XHJcblx0fSxcclxuXHJcblx0Z2V0RWFzdDogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX25vcnRoRWFzdC5sbmc7XHJcblx0fSxcclxuXHJcblx0Z2V0Tm9ydGg6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9ub3J0aEVhc3QubGF0O1xyXG5cdH0sXHJcblxyXG5cdGNvbnRhaW5zOiBmdW5jdGlvbiAob2JqKSB7IC8vIChMYXRMbmdCb3VuZHMpIG9yIChMYXRMbmcpIC0+IEJvb2xlYW5cclxuXHRcdGlmICh0eXBlb2Ygb2JqWzBdID09PSAnbnVtYmVyJyB8fCBvYmogaW5zdGFuY2VvZiBMLkxhdExuZykge1xyXG5cdFx0XHRvYmogPSBMLmxhdExuZyhvYmopO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0b2JqID0gTC5sYXRMbmdCb3VuZHMob2JqKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgc3cgPSB0aGlzLl9zb3V0aFdlc3QsXHJcblx0XHQgICAgbmUgPSB0aGlzLl9ub3J0aEVhc3QsXHJcblx0XHQgICAgc3cyLCBuZTI7XHJcblxyXG5cdFx0aWYgKG9iaiBpbnN0YW5jZW9mIEwuTGF0TG5nQm91bmRzKSB7XHJcblx0XHRcdHN3MiA9IG9iai5nZXRTb3V0aFdlc3QoKTtcclxuXHRcdFx0bmUyID0gb2JqLmdldE5vcnRoRWFzdCgpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0c3cyID0gbmUyID0gb2JqO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAoc3cyLmxhdCA+PSBzdy5sYXQpICYmIChuZTIubGF0IDw9IG5lLmxhdCkgJiZcclxuXHRcdCAgICAgICAoc3cyLmxuZyA+PSBzdy5sbmcpICYmIChuZTIubG5nIDw9IG5lLmxuZyk7XHJcblx0fSxcclxuXHJcblx0aW50ZXJzZWN0czogZnVuY3Rpb24gKGJvdW5kcykgeyAvLyAoTGF0TG5nQm91bmRzKVxyXG5cdFx0Ym91bmRzID0gTC5sYXRMbmdCb3VuZHMoYm91bmRzKTtcclxuXHJcblx0XHR2YXIgc3cgPSB0aGlzLl9zb3V0aFdlc3QsXHJcblx0XHQgICAgbmUgPSB0aGlzLl9ub3J0aEVhc3QsXHJcblx0XHQgICAgc3cyID0gYm91bmRzLmdldFNvdXRoV2VzdCgpLFxyXG5cdFx0ICAgIG5lMiA9IGJvdW5kcy5nZXROb3J0aEVhc3QoKSxcclxuXHJcblx0XHQgICAgbGF0SW50ZXJzZWN0cyA9IChuZTIubGF0ID49IHN3LmxhdCkgJiYgKHN3Mi5sYXQgPD0gbmUubGF0KSxcclxuXHRcdCAgICBsbmdJbnRlcnNlY3RzID0gKG5lMi5sbmcgPj0gc3cubG5nKSAmJiAoc3cyLmxuZyA8PSBuZS5sbmcpO1xyXG5cclxuXHRcdHJldHVybiBsYXRJbnRlcnNlY3RzICYmIGxuZ0ludGVyc2VjdHM7XHJcblx0fSxcclxuXHJcblx0dG9CQm94U3RyaW5nOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gW3RoaXMuZ2V0V2VzdCgpLCB0aGlzLmdldFNvdXRoKCksIHRoaXMuZ2V0RWFzdCgpLCB0aGlzLmdldE5vcnRoKCldLmpvaW4oJywnKTtcclxuXHR9LFxyXG5cclxuXHRlcXVhbHM6IGZ1bmN0aW9uIChib3VuZHMpIHsgLy8gKExhdExuZ0JvdW5kcylcclxuXHRcdGlmICghYm91bmRzKSB7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuXHRcdGJvdW5kcyA9IEwubGF0TG5nQm91bmRzKGJvdW5kcyk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuX3NvdXRoV2VzdC5lcXVhbHMoYm91bmRzLmdldFNvdXRoV2VzdCgpKSAmJlxyXG5cdFx0ICAgICAgIHRoaXMuX25vcnRoRWFzdC5lcXVhbHMoYm91bmRzLmdldE5vcnRoRWFzdCgpKTtcclxuXHR9LFxyXG5cclxuXHRpc1ZhbGlkOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gISEodGhpcy5fc291dGhXZXN0ICYmIHRoaXMuX25vcnRoRWFzdCk7XHJcblx0fVxyXG59O1xyXG5cclxuLy9UT0RPIEludGVybmF0aW9uYWwgZGF0ZSBsaW5lP1xyXG5cclxuTC5sYXRMbmdCb3VuZHMgPSBmdW5jdGlvbiAoYSwgYikgeyAvLyAoTGF0TG5nQm91bmRzKSBvciAoTGF0TG5nLCBMYXRMbmcpXHJcblx0aWYgKCFhIHx8IGEgaW5zdGFuY2VvZiBMLkxhdExuZ0JvdW5kcykge1xyXG5cdFx0cmV0dXJuIGE7XHJcblx0fVxyXG5cdHJldHVybiBuZXcgTC5MYXRMbmdCb3VuZHMoYSwgYik7XHJcbn07XHJcblxuXG4vKlxyXG4gKiBMLlByb2plY3Rpb24gY29udGFpbnMgdmFyaW91cyBnZW9ncmFwaGljYWwgcHJvamVjdGlvbnMgdXNlZCBieSBDUlMgY2xhc3Nlcy5cclxuICovXHJcblxyXG5MLlByb2plY3Rpb24gPSB7fTtcclxuXG5cbi8qXHJcbiAqIFNwaGVyaWNhbCBNZXJjYXRvciBpcyB0aGUgbW9zdCBwb3B1bGFyIG1hcCBwcm9qZWN0aW9uLCB1c2VkIGJ5IEVQU0c6Mzg1NyBDUlMgdXNlZCBieSBkZWZhdWx0LlxyXG4gKi9cclxuXHJcbkwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvciA9IHtcclxuXHRNQVhfTEFUSVRVREU6IDg1LjA1MTEyODc3OTgsXHJcblxyXG5cdHByb2plY3Q6IGZ1bmN0aW9uIChsYXRsbmcpIHsgLy8gKExhdExuZykgLT4gUG9pbnRcclxuXHRcdHZhciBkID0gTC5MYXRMbmcuREVHX1RPX1JBRCxcclxuXHRcdCAgICBtYXggPSB0aGlzLk1BWF9MQVRJVFVERSxcclxuXHRcdCAgICBsYXQgPSBNYXRoLm1heChNYXRoLm1pbihtYXgsIGxhdGxuZy5sYXQpLCAtbWF4KSxcclxuXHRcdCAgICB4ID0gbGF0bG5nLmxuZyAqIGQsXHJcblx0XHQgICAgeSA9IGxhdCAqIGQ7XHJcblxyXG5cdFx0eSA9IE1hdGgubG9nKE1hdGgudGFuKChNYXRoLlBJIC8gNCkgKyAoeSAvIDIpKSk7XHJcblxyXG5cdFx0cmV0dXJuIG5ldyBMLlBvaW50KHgsIHkpO1xyXG5cdH0sXHJcblxyXG5cdHVucHJvamVjdDogZnVuY3Rpb24gKHBvaW50KSB7IC8vIChQb2ludCwgQm9vbGVhbikgLT4gTGF0TG5nXHJcblx0XHR2YXIgZCA9IEwuTGF0TG5nLlJBRF9UT19ERUcsXHJcblx0XHQgICAgbG5nID0gcG9pbnQueCAqIGQsXHJcblx0XHQgICAgbGF0ID0gKDIgKiBNYXRoLmF0YW4oTWF0aC5leHAocG9pbnQueSkpIC0gKE1hdGguUEkgLyAyKSkgKiBkO1xyXG5cclxuXHRcdHJldHVybiBuZXcgTC5MYXRMbmcobGF0LCBsbmcpO1xyXG5cdH1cclxufTtcclxuXG5cbi8qXHJcbiAqIFNpbXBsZSBlcXVpcmVjdGFuZ3VsYXIgKFBsYXRlIENhcnJlZSkgcHJvamVjdGlvbiwgdXNlZCBieSBDUlMgbGlrZSBFUFNHOjQzMjYgYW5kIFNpbXBsZS5cclxuICovXHJcblxyXG5MLlByb2plY3Rpb24uTG9uTGF0ID0ge1xyXG5cdHByb2plY3Q6IGZ1bmN0aW9uIChsYXRsbmcpIHtcclxuXHRcdHJldHVybiBuZXcgTC5Qb2ludChsYXRsbmcubG5nLCBsYXRsbmcubGF0KTtcclxuXHR9LFxyXG5cclxuXHR1bnByb2plY3Q6IGZ1bmN0aW9uIChwb2ludCkge1xyXG5cdFx0cmV0dXJuIG5ldyBMLkxhdExuZyhwb2ludC55LCBwb2ludC54KTtcclxuXHR9XHJcbn07XHJcblxuXG4vKlxyXG4gKiBMLkNSUyBpcyBhIGJhc2Ugb2JqZWN0IGZvciBhbGwgZGVmaW5lZCBDUlMgKENvb3JkaW5hdGUgUmVmZXJlbmNlIFN5c3RlbXMpIGluIExlYWZsZXQuXHJcbiAqL1xyXG5cclxuTC5DUlMgPSB7XHJcblx0bGF0TG5nVG9Qb2ludDogZnVuY3Rpb24gKGxhdGxuZywgem9vbSkgeyAvLyAoTGF0TG5nLCBOdW1iZXIpIC0+IFBvaW50XHJcblx0XHR2YXIgcHJvamVjdGVkUG9pbnQgPSB0aGlzLnByb2plY3Rpb24ucHJvamVjdChsYXRsbmcpLFxyXG5cdFx0ICAgIHNjYWxlID0gdGhpcy5zY2FsZSh6b29tKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy50cmFuc2Zvcm1hdGlvbi5fdHJhbnNmb3JtKHByb2plY3RlZFBvaW50LCBzY2FsZSk7XHJcblx0fSxcclxuXHJcblx0cG9pbnRUb0xhdExuZzogZnVuY3Rpb24gKHBvaW50LCB6b29tKSB7IC8vIChQb2ludCwgTnVtYmVyWywgQm9vbGVhbl0pIC0+IExhdExuZ1xyXG5cdFx0dmFyIHNjYWxlID0gdGhpcy5zY2FsZSh6b29tKSxcclxuXHRcdCAgICB1bnRyYW5zZm9ybWVkUG9pbnQgPSB0aGlzLnRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHBvaW50LCBzY2FsZSk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMucHJvamVjdGlvbi51bnByb2plY3QodW50cmFuc2Zvcm1lZFBvaW50KTtcclxuXHR9LFxyXG5cclxuXHRwcm9qZWN0OiBmdW5jdGlvbiAobGF0bG5nKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5wcm9qZWN0aW9uLnByb2plY3QobGF0bG5nKTtcclxuXHR9LFxyXG5cclxuXHRzY2FsZTogZnVuY3Rpb24gKHpvb20pIHtcclxuXHRcdHJldHVybiAyNTYgKiBNYXRoLnBvdygyLCB6b29tKTtcclxuXHR9LFxyXG5cclxuXHRnZXRTaXplOiBmdW5jdGlvbiAoem9vbSkge1xyXG5cdFx0dmFyIHMgPSB0aGlzLnNjYWxlKHpvb20pO1xyXG5cdFx0cmV0dXJuIEwucG9pbnQocywgcyk7XHJcblx0fVxyXG59O1xyXG5cblxuLypcbiAqIEEgc2ltcGxlIENSUyB0aGF0IGNhbiBiZSB1c2VkIGZvciBmbGF0IG5vbi1FYXJ0aCBtYXBzIGxpa2UgcGFub3JhbWFzIG9yIGdhbWUgbWFwcy5cbiAqL1xuXG5MLkNSUy5TaW1wbGUgPSBMLmV4dGVuZCh7fSwgTC5DUlMsIHtcblx0cHJvamVjdGlvbjogTC5Qcm9qZWN0aW9uLkxvbkxhdCxcblx0dHJhbnNmb3JtYXRpb246IG5ldyBMLlRyYW5zZm9ybWF0aW9uKDEsIDAsIC0xLCAwKSxcblxuXHRzY2FsZTogZnVuY3Rpb24gKHpvb20pIHtcblx0XHRyZXR1cm4gTWF0aC5wb3coMiwgem9vbSk7XG5cdH1cbn0pO1xuXG5cbi8qXHJcbiAqIEwuQ1JTLkVQU0czODU3IChTcGhlcmljYWwgTWVyY2F0b3IpIGlzIHRoZSBtb3N0IGNvbW1vbiBDUlMgZm9yIHdlYiBtYXBwaW5nXHJcbiAqIGFuZCBpcyB1c2VkIGJ5IExlYWZsZXQgYnkgZGVmYXVsdC5cclxuICovXHJcblxyXG5MLkNSUy5FUFNHMzg1NyA9IEwuZXh0ZW5kKHt9LCBMLkNSUywge1xyXG5cdGNvZGU6ICdFUFNHOjM4NTcnLFxyXG5cclxuXHRwcm9qZWN0aW9uOiBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IsXHJcblx0dHJhbnNmb3JtYXRpb246IG5ldyBMLlRyYW5zZm9ybWF0aW9uKDAuNSAvIE1hdGguUEksIDAuNSwgLTAuNSAvIE1hdGguUEksIDAuNSksXHJcblxyXG5cdHByb2plY3Q6IGZ1bmN0aW9uIChsYXRsbmcpIHsgLy8gKExhdExuZykgLT4gUG9pbnRcclxuXHRcdHZhciBwcm9qZWN0ZWRQb2ludCA9IHRoaXMucHJvamVjdGlvbi5wcm9qZWN0KGxhdGxuZyksXHJcblx0XHQgICAgZWFydGhSYWRpdXMgPSA2Mzc4MTM3O1xyXG5cdFx0cmV0dXJuIHByb2plY3RlZFBvaW50Lm11bHRpcGx5QnkoZWFydGhSYWRpdXMpO1xyXG5cdH1cclxufSk7XHJcblxyXG5MLkNSUy5FUFNHOTAwOTEzID0gTC5leHRlbmQoe30sIEwuQ1JTLkVQU0czODU3LCB7XHJcblx0Y29kZTogJ0VQU0c6OTAwOTEzJ1xyXG59KTtcclxuXG5cbi8qXHJcbiAqIEwuQ1JTLkVQU0c0MzI2IGlzIGEgQ1JTIHBvcHVsYXIgYW1vbmcgYWR2YW5jZWQgR0lTIHNwZWNpYWxpc3RzLlxyXG4gKi9cclxuXHJcbkwuQ1JTLkVQU0c0MzI2ID0gTC5leHRlbmQoe30sIEwuQ1JTLCB7XHJcblx0Y29kZTogJ0VQU0c6NDMyNicsXHJcblxyXG5cdHByb2plY3Rpb246IEwuUHJvamVjdGlvbi5Mb25MYXQsXHJcblx0dHJhbnNmb3JtYXRpb246IG5ldyBMLlRyYW5zZm9ybWF0aW9uKDEgLyAzNjAsIDAuNSwgLTEgLyAzNjAsIDAuNSlcclxufSk7XHJcblxuXG4vKlxyXG4gKiBMLk1hcCBpcyB0aGUgY2VudHJhbCBjbGFzcyBvZiB0aGUgQVBJIC0gaXQgaXMgdXNlZCB0byBjcmVhdGUgYSBtYXAuXHJcbiAqL1xyXG5cclxuTC5NYXAgPSBMLkNsYXNzLmV4dGVuZCh7XHJcblxyXG5cdGluY2x1ZGVzOiBMLk1peGluLkV2ZW50cyxcclxuXHJcblx0b3B0aW9uczoge1xyXG5cdFx0Y3JzOiBMLkNSUy5FUFNHMzg1NyxcclxuXHJcblx0XHQvKlxyXG5cdFx0Y2VudGVyOiBMYXRMbmcsXHJcblx0XHR6b29tOiBOdW1iZXIsXHJcblx0XHRsYXllcnM6IEFycmF5LFxyXG5cdFx0Ki9cclxuXHJcblx0XHRmYWRlQW5pbWF0aW9uOiBMLkRvbVV0aWwuVFJBTlNJVElPTiAmJiAhTC5Ccm93c2VyLmFuZHJvaWQyMyxcclxuXHRcdHRyYWNrUmVzaXplOiB0cnVlLFxyXG5cdFx0bWFya2VyWm9vbUFuaW1hdGlvbjogTC5Eb21VdGlsLlRSQU5TSVRJT04gJiYgTC5Ccm93c2VyLmFueTNkXHJcblx0fSxcclxuXHJcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKGlkLCBvcHRpb25zKSB7IC8vIChIVE1MRWxlbWVudCBvciBTdHJpbmcsIE9iamVjdClcclxuXHRcdG9wdGlvbnMgPSBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblxyXG5cclxuXHRcdHRoaXMuX2luaXRDb250YWluZXIoaWQpO1xyXG5cdFx0dGhpcy5faW5pdExheW91dCgpO1xyXG5cclxuXHRcdC8vIGhhY2sgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9MZWFmbGV0L0xlYWZsZXQvaXNzdWVzLzE5ODBcclxuXHRcdHRoaXMuX29uUmVzaXplID0gTC5iaW5kKHRoaXMuX29uUmVzaXplLCB0aGlzKTtcclxuXHJcblx0XHR0aGlzLl9pbml0RXZlbnRzKCk7XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMubWF4Qm91bmRzKSB7XHJcblx0XHRcdHRoaXMuc2V0TWF4Qm91bmRzKG9wdGlvbnMubWF4Qm91bmRzKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAob3B0aW9ucy5jZW50ZXIgJiYgb3B0aW9ucy56b29tICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0dGhpcy5zZXRWaWV3KEwubGF0TG5nKG9wdGlvbnMuY2VudGVyKSwgb3B0aW9ucy56b29tLCB7cmVzZXQ6IHRydWV9KTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9oYW5kbGVycyA9IFtdO1xyXG5cclxuXHRcdHRoaXMuX2xheWVycyA9IHt9O1xyXG5cdFx0dGhpcy5fem9vbUJvdW5kTGF5ZXJzID0ge307XHJcblx0XHR0aGlzLl90aWxlTGF5ZXJzTnVtID0gMDtcclxuXHJcblx0XHR0aGlzLmNhbGxJbml0SG9va3MoKTtcclxuXHJcblx0XHR0aGlzLl9hZGRMYXllcnMob3B0aW9ucy5sYXllcnMpO1xyXG5cdH0sXHJcblxyXG5cclxuXHQvLyBwdWJsaWMgbWV0aG9kcyB0aGF0IG1vZGlmeSBtYXAgc3RhdGVcclxuXHJcblx0Ly8gcmVwbGFjZWQgYnkgYW5pbWF0aW9uLXBvd2VyZWQgaW1wbGVtZW50YXRpb24gaW4gTWFwLlBhbkFuaW1hdGlvbi5qc1xyXG5cdHNldFZpZXc6IGZ1bmN0aW9uIChjZW50ZXIsIHpvb20pIHtcclxuXHRcdHpvb20gPSB6b29tID09PSB1bmRlZmluZWQgPyB0aGlzLmdldFpvb20oKSA6IHpvb207XHJcblx0XHR0aGlzLl9yZXNldFZpZXcoTC5sYXRMbmcoY2VudGVyKSwgdGhpcy5fbGltaXRab29tKHpvb20pKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdHNldFpvb206IGZ1bmN0aW9uICh6b29tLCBvcHRpb25zKSB7XHJcblx0XHRpZiAoIXRoaXMuX2xvYWRlZCkge1xyXG5cdFx0XHR0aGlzLl96b29tID0gdGhpcy5fbGltaXRab29tKHpvb20pO1xyXG5cdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzLnNldFZpZXcodGhpcy5nZXRDZW50ZXIoKSwgem9vbSwge3pvb206IG9wdGlvbnN9KTtcclxuXHR9LFxyXG5cclxuXHR6b29tSW46IGZ1bmN0aW9uIChkZWx0YSwgb3B0aW9ucykge1xyXG5cdFx0cmV0dXJuIHRoaXMuc2V0Wm9vbSh0aGlzLl96b29tICsgKGRlbHRhIHx8IDEpLCBvcHRpb25zKTtcclxuXHR9LFxyXG5cclxuXHR6b29tT3V0OiBmdW5jdGlvbiAoZGVsdGEsIG9wdGlvbnMpIHtcclxuXHRcdHJldHVybiB0aGlzLnNldFpvb20odGhpcy5fem9vbSAtIChkZWx0YSB8fCAxKSwgb3B0aW9ucyk7XHJcblx0fSxcclxuXHJcblx0c2V0Wm9vbUFyb3VuZDogZnVuY3Rpb24gKGxhdGxuZywgem9vbSwgb3B0aW9ucykge1xyXG5cdFx0dmFyIHNjYWxlID0gdGhpcy5nZXRab29tU2NhbGUoem9vbSksXHJcblx0XHQgICAgdmlld0hhbGYgPSB0aGlzLmdldFNpemUoKS5kaXZpZGVCeSgyKSxcclxuXHRcdCAgICBjb250YWluZXJQb2ludCA9IGxhdGxuZyBpbnN0YW5jZW9mIEwuUG9pbnQgPyBsYXRsbmcgOiB0aGlzLmxhdExuZ1RvQ29udGFpbmVyUG9pbnQobGF0bG5nKSxcclxuXHJcblx0XHQgICAgY2VudGVyT2Zmc2V0ID0gY29udGFpbmVyUG9pbnQuc3VidHJhY3Qodmlld0hhbGYpLm11bHRpcGx5QnkoMSAtIDEgLyBzY2FsZSksXHJcblx0XHQgICAgbmV3Q2VudGVyID0gdGhpcy5jb250YWluZXJQb2ludFRvTGF0TG5nKHZpZXdIYWxmLmFkZChjZW50ZXJPZmZzZXQpKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy5zZXRWaWV3KG5ld0NlbnRlciwgem9vbSwge3pvb206IG9wdGlvbnN9KTtcclxuXHR9LFxyXG5cclxuXHRmaXRCb3VuZHM6IGZ1bmN0aW9uIChib3VuZHMsIG9wdGlvbnMpIHtcclxuXHJcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuXHRcdGJvdW5kcyA9IGJvdW5kcy5nZXRCb3VuZHMgPyBib3VuZHMuZ2V0Qm91bmRzKCkgOiBMLmxhdExuZ0JvdW5kcyhib3VuZHMpO1xyXG5cclxuXHRcdHZhciBwYWRkaW5nVEwgPSBMLnBvaW50KG9wdGlvbnMucGFkZGluZ1RvcExlZnQgfHwgb3B0aW9ucy5wYWRkaW5nIHx8IFswLCAwXSksXHJcblx0XHQgICAgcGFkZGluZ0JSID0gTC5wb2ludChvcHRpb25zLnBhZGRpbmdCb3R0b21SaWdodCB8fCBvcHRpb25zLnBhZGRpbmcgfHwgWzAsIDBdKSxcclxuXHJcblx0XHQgICAgem9vbSA9IHRoaXMuZ2V0Qm91bmRzWm9vbShib3VuZHMsIGZhbHNlLCBwYWRkaW5nVEwuYWRkKHBhZGRpbmdCUikpLFxyXG5cdFx0ICAgIHBhZGRpbmdPZmZzZXQgPSBwYWRkaW5nQlIuc3VidHJhY3QocGFkZGluZ1RMKS5kaXZpZGVCeSgyKSxcclxuXHJcblx0XHQgICAgc3dQb2ludCA9IHRoaXMucHJvamVjdChib3VuZHMuZ2V0U291dGhXZXN0KCksIHpvb20pLFxyXG5cdFx0ICAgIG5lUG9pbnQgPSB0aGlzLnByb2plY3QoYm91bmRzLmdldE5vcnRoRWFzdCgpLCB6b29tKSxcclxuXHRcdCAgICBjZW50ZXIgPSB0aGlzLnVucHJvamVjdChzd1BvaW50LmFkZChuZVBvaW50KS5kaXZpZGVCeSgyKS5hZGQocGFkZGluZ09mZnNldCksIHpvb20pO1xyXG5cclxuXHRcdHpvb20gPSBvcHRpb25zICYmIG9wdGlvbnMubWF4Wm9vbSA/IE1hdGgubWluKG9wdGlvbnMubWF4Wm9vbSwgem9vbSkgOiB6b29tO1xyXG5cclxuXHRcdHJldHVybiB0aGlzLnNldFZpZXcoY2VudGVyLCB6b29tLCBvcHRpb25zKTtcclxuXHR9LFxyXG5cclxuXHRmaXRXb3JsZDogZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuXHRcdHJldHVybiB0aGlzLmZpdEJvdW5kcyhbWy05MCwgLTE4MF0sIFs5MCwgMTgwXV0sIG9wdGlvbnMpO1xyXG5cdH0sXHJcblxyXG5cdHBhblRvOiBmdW5jdGlvbiAoY2VudGVyLCBvcHRpb25zKSB7IC8vIChMYXRMbmcpXHJcblx0XHRyZXR1cm4gdGhpcy5zZXRWaWV3KGNlbnRlciwgdGhpcy5fem9vbSwge3Bhbjogb3B0aW9uc30pO1xyXG5cdH0sXHJcblxyXG5cdHBhbkJ5OiBmdW5jdGlvbiAob2Zmc2V0KSB7IC8vIChQb2ludClcclxuXHRcdC8vIHJlcGxhY2VkIHdpdGggYW5pbWF0ZWQgcGFuQnkgaW4gTWFwLlBhbkFuaW1hdGlvbi5qc1xyXG5cdFx0dGhpcy5maXJlKCdtb3Zlc3RhcnQnKTtcclxuXHJcblx0XHR0aGlzLl9yYXdQYW5CeShMLnBvaW50KG9mZnNldCkpO1xyXG5cclxuXHRcdHRoaXMuZmlyZSgnbW92ZScpO1xyXG5cdFx0cmV0dXJuIHRoaXMuZmlyZSgnbW92ZWVuZCcpO1xyXG5cdH0sXHJcblxyXG5cdHNldE1heEJvdW5kczogZnVuY3Rpb24gKGJvdW5kcykge1xyXG5cdFx0Ym91bmRzID0gTC5sYXRMbmdCb3VuZHMoYm91bmRzKTtcclxuXHJcblx0XHR0aGlzLm9wdGlvbnMubWF4Qm91bmRzID0gYm91bmRzO1xyXG5cclxuXHRcdGlmICghYm91bmRzKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLm9mZignbW92ZWVuZCcsIHRoaXMuX3Bhbkluc2lkZU1heEJvdW5kcywgdGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuX2xvYWRlZCkge1xyXG5cdFx0XHR0aGlzLl9wYW5JbnNpZGVNYXhCb3VuZHMoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5vbignbW92ZWVuZCcsIHRoaXMuX3Bhbkluc2lkZU1heEJvdW5kcywgdGhpcyk7XHJcblx0fSxcclxuXHJcblx0cGFuSW5zaWRlQm91bmRzOiBmdW5jdGlvbiAoYm91bmRzLCBvcHRpb25zKSB7XHJcblx0XHR2YXIgY2VudGVyID0gdGhpcy5nZXRDZW50ZXIoKSxcclxuXHRcdFx0bmV3Q2VudGVyID0gdGhpcy5fbGltaXRDZW50ZXIoY2VudGVyLCB0aGlzLl96b29tLCBib3VuZHMpO1xyXG5cclxuXHRcdGlmIChjZW50ZXIuZXF1YWxzKG5ld0NlbnRlcikpIHsgcmV0dXJuIHRoaXM7IH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5wYW5UbyhuZXdDZW50ZXIsIG9wdGlvbnMpO1xyXG5cdH0sXHJcblxyXG5cdGFkZExheWVyOiBmdW5jdGlvbiAobGF5ZXIpIHtcclxuXHRcdC8vIFRPRE8gbWV0aG9kIGlzIHRvbyBiaWcsIHJlZmFjdG9yXHJcblxyXG5cdFx0dmFyIGlkID0gTC5zdGFtcChsYXllcik7XHJcblxyXG5cdFx0aWYgKHRoaXMuX2xheWVyc1tpZF0pIHsgcmV0dXJuIHRoaXM7IH1cclxuXHJcblx0XHR0aGlzLl9sYXllcnNbaWRdID0gbGF5ZXI7XHJcblxyXG5cdFx0Ly8gVE9ETyBnZXRNYXhab29tLCBnZXRNaW5ab29tIGluIElMYXllciAoaW5zdGVhZCBvZiBvcHRpb25zKVxyXG5cdFx0aWYgKGxheWVyLm9wdGlvbnMgJiYgKCFpc05hTihsYXllci5vcHRpb25zLm1heFpvb20pIHx8ICFpc05hTihsYXllci5vcHRpb25zLm1pblpvb20pKSkge1xyXG5cdFx0XHR0aGlzLl96b29tQm91bmRMYXllcnNbaWRdID0gbGF5ZXI7XHJcblx0XHRcdHRoaXMuX3VwZGF0ZVpvb21MZXZlbHMoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBUT0RPIGxvb2tzIHVnbHksIHJlZmFjdG9yISEhXHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnpvb21BbmltYXRpb24gJiYgTC5UaWxlTGF5ZXIgJiYgKGxheWVyIGluc3RhbmNlb2YgTC5UaWxlTGF5ZXIpKSB7XHJcblx0XHRcdHRoaXMuX3RpbGVMYXllcnNOdW0rKztcclxuXHRcdFx0dGhpcy5fdGlsZUxheWVyc1RvTG9hZCsrO1xyXG5cdFx0XHRsYXllci5vbignbG9hZCcsIHRoaXMuX29uVGlsZUxheWVyTG9hZCwgdGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuX2xvYWRlZCkge1xyXG5cdFx0XHR0aGlzLl9sYXllckFkZChsYXllcik7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0cmVtb3ZlTGF5ZXI6IGZ1bmN0aW9uIChsYXllcikge1xyXG5cdFx0dmFyIGlkID0gTC5zdGFtcChsYXllcik7XHJcblxyXG5cdFx0aWYgKCF0aGlzLl9sYXllcnNbaWRdKSB7IHJldHVybiB0aGlzOyB9XHJcblxyXG5cdFx0aWYgKHRoaXMuX2xvYWRlZCkge1xyXG5cdFx0XHRsYXllci5vblJlbW92ZSh0aGlzKTtcclxuXHRcdH1cclxuXHJcblx0XHRkZWxldGUgdGhpcy5fbGF5ZXJzW2lkXTtcclxuXHJcblx0XHRpZiAodGhpcy5fbG9hZGVkKSB7XHJcblx0XHRcdHRoaXMuZmlyZSgnbGF5ZXJyZW1vdmUnLCB7bGF5ZXI6IGxheWVyfSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuX3pvb21Cb3VuZExheWVyc1tpZF0pIHtcclxuXHRcdFx0ZGVsZXRlIHRoaXMuX3pvb21Cb3VuZExheWVyc1tpZF07XHJcblx0XHRcdHRoaXMuX3VwZGF0ZVpvb21MZXZlbHMoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBUT0RPIGxvb2tzIHVnbHksIHJlZmFjdG9yXHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnpvb21BbmltYXRpb24gJiYgTC5UaWxlTGF5ZXIgJiYgKGxheWVyIGluc3RhbmNlb2YgTC5UaWxlTGF5ZXIpKSB7XHJcblx0XHRcdHRoaXMuX3RpbGVMYXllcnNOdW0tLTtcclxuXHRcdFx0dGhpcy5fdGlsZUxheWVyc1RvTG9hZC0tO1xyXG5cdFx0XHRsYXllci5vZmYoJ2xvYWQnLCB0aGlzLl9vblRpbGVMYXllckxvYWQsIHRoaXMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGhhc0xheWVyOiBmdW5jdGlvbiAobGF5ZXIpIHtcclxuXHRcdGlmICghbGF5ZXIpIHsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cdFx0cmV0dXJuIChMLnN0YW1wKGxheWVyKSBpbiB0aGlzLl9sYXllcnMpO1xyXG5cdH0sXHJcblxyXG5cdGVhY2hMYXllcjogZnVuY3Rpb24gKG1ldGhvZCwgY29udGV4dCkge1xyXG5cdFx0Zm9yICh2YXIgaSBpbiB0aGlzLl9sYXllcnMpIHtcclxuXHRcdFx0bWV0aG9kLmNhbGwoY29udGV4dCwgdGhpcy5fbGF5ZXJzW2ldKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGludmFsaWRhdGVTaXplOiBmdW5jdGlvbiAob3B0aW9ucykge1xyXG5cdFx0aWYgKCF0aGlzLl9sb2FkZWQpIHsgcmV0dXJuIHRoaXM7IH1cclxuXHJcblx0XHRvcHRpb25zID0gTC5leHRlbmQoe1xyXG5cdFx0XHRhbmltYXRlOiBmYWxzZSxcclxuXHRcdFx0cGFuOiB0cnVlXHJcblx0XHR9LCBvcHRpb25zID09PSB0cnVlID8ge2FuaW1hdGU6IHRydWV9IDogb3B0aW9ucyk7XHJcblxyXG5cdFx0dmFyIG9sZFNpemUgPSB0aGlzLmdldFNpemUoKTtcclxuXHRcdHRoaXMuX3NpemVDaGFuZ2VkID0gdHJ1ZTtcclxuXHRcdHRoaXMuX2luaXRpYWxDZW50ZXIgPSBudWxsO1xyXG5cclxuXHRcdHZhciBuZXdTaXplID0gdGhpcy5nZXRTaXplKCksXHJcblx0XHQgICAgb2xkQ2VudGVyID0gb2xkU2l6ZS5kaXZpZGVCeSgyKS5yb3VuZCgpLFxyXG5cdFx0ICAgIG5ld0NlbnRlciA9IG5ld1NpemUuZGl2aWRlQnkoMikucm91bmQoKSxcclxuXHRcdCAgICBvZmZzZXQgPSBvbGRDZW50ZXIuc3VidHJhY3QobmV3Q2VudGVyKTtcclxuXHJcblx0XHRpZiAoIW9mZnNldC54ICYmICFvZmZzZXQueSkgeyByZXR1cm4gdGhpczsgfVxyXG5cclxuXHRcdGlmIChvcHRpb25zLmFuaW1hdGUgJiYgb3B0aW9ucy5wYW4pIHtcclxuXHRcdFx0dGhpcy5wYW5CeShvZmZzZXQpO1xyXG5cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGlmIChvcHRpb25zLnBhbikge1xyXG5cdFx0XHRcdHRoaXMuX3Jhd1BhbkJ5KG9mZnNldCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZmlyZSgnbW92ZScpO1xyXG5cclxuXHRcdFx0aWYgKG9wdGlvbnMuZGVib3VuY2VNb3ZlZW5kKSB7XHJcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX3NpemVUaW1lcik7XHJcblx0XHRcdFx0dGhpcy5fc2l6ZVRpbWVyID0gc2V0VGltZW91dChMLmJpbmQodGhpcy5maXJlLCB0aGlzLCAnbW92ZWVuZCcpLCAyMDApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRoaXMuZmlyZSgnbW92ZWVuZCcpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuZmlyZSgncmVzaXplJywge1xyXG5cdFx0XHRvbGRTaXplOiBvbGRTaXplLFxyXG5cdFx0XHRuZXdTaXplOiBuZXdTaXplXHJcblx0XHR9KTtcclxuXHR9LFxyXG5cclxuXHQvLyBUT0RPIGhhbmRsZXIuYWRkVG9cclxuXHRhZGRIYW5kbGVyOiBmdW5jdGlvbiAobmFtZSwgSGFuZGxlckNsYXNzKSB7XHJcblx0XHRpZiAoIUhhbmRsZXJDbGFzcykgeyByZXR1cm4gdGhpczsgfVxyXG5cclxuXHRcdHZhciBoYW5kbGVyID0gdGhpc1tuYW1lXSA9IG5ldyBIYW5kbGVyQ2xhc3ModGhpcyk7XHJcblxyXG5cdFx0dGhpcy5faGFuZGxlcnMucHVzaChoYW5kbGVyKTtcclxuXHJcblx0XHRpZiAodGhpcy5vcHRpb25zW25hbWVdKSB7XHJcblx0XHRcdGhhbmRsZXIuZW5hYmxlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0cmVtb3ZlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fbG9hZGVkKSB7XHJcblx0XHRcdHRoaXMuZmlyZSgndW5sb2FkJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5faW5pdEV2ZW50cygnb2ZmJyk7XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Ly8gdGhyb3dzIGVycm9yIGluIElFNi04XHJcblx0XHRcdGRlbGV0ZSB0aGlzLl9jb250YWluZXIuX2xlYWZsZXQ7XHJcblx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdHRoaXMuX2NvbnRhaW5lci5fbGVhZmxldCA9IHVuZGVmaW5lZDtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9jbGVhclBhbmVzKCk7XHJcblx0XHRpZiAodGhpcy5fY2xlYXJDb250cm9sUG9zKSB7XHJcblx0XHRcdHRoaXMuX2NsZWFyQ29udHJvbFBvcygpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2NsZWFySGFuZGxlcnMoKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHJcblx0Ly8gcHVibGljIG1ldGhvZHMgZm9yIGdldHRpbmcgbWFwIHN0YXRlXHJcblxyXG5cdGdldENlbnRlcjogZnVuY3Rpb24gKCkgeyAvLyAoQm9vbGVhbikgLT4gTGF0TG5nXHJcblx0XHR0aGlzLl9jaGVja0lmTG9hZGVkKCk7XHJcblxyXG5cdFx0aWYgKHRoaXMuX2luaXRpYWxDZW50ZXIgJiYgIXRoaXMuX21vdmVkKCkpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2luaXRpYWxDZW50ZXI7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcy5sYXllclBvaW50VG9MYXRMbmcodGhpcy5fZ2V0Q2VudGVyTGF5ZXJQb2ludCgpKTtcclxuXHR9LFxyXG5cclxuXHRnZXRab29tOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fem9vbTtcclxuXHR9LFxyXG5cclxuXHRnZXRCb3VuZHM6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBib3VuZHMgPSB0aGlzLmdldFBpeGVsQm91bmRzKCksXHJcblx0XHQgICAgc3cgPSB0aGlzLnVucHJvamVjdChib3VuZHMuZ2V0Qm90dG9tTGVmdCgpKSxcclxuXHRcdCAgICBuZSA9IHRoaXMudW5wcm9qZWN0KGJvdW5kcy5nZXRUb3BSaWdodCgpKTtcclxuXHJcblx0XHRyZXR1cm4gbmV3IEwuTGF0TG5nQm91bmRzKHN3LCBuZSk7XHJcblx0fSxcclxuXHJcblx0Z2V0TWluWm9vbTogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMub3B0aW9ucy5taW5ab29tID09PSB1bmRlZmluZWQgP1xyXG5cdFx0XHQodGhpcy5fbGF5ZXJzTWluWm9vbSA9PT0gdW5kZWZpbmVkID8gMCA6IHRoaXMuX2xheWVyc01pblpvb20pIDpcclxuXHRcdFx0dGhpcy5vcHRpb25zLm1pblpvb207XHJcblx0fSxcclxuXHJcblx0Z2V0TWF4Wm9vbTogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMub3B0aW9ucy5tYXhab29tID09PSB1bmRlZmluZWQgP1xyXG5cdFx0XHQodGhpcy5fbGF5ZXJzTWF4Wm9vbSA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiB0aGlzLl9sYXllcnNNYXhab29tKSA6XHJcblx0XHRcdHRoaXMub3B0aW9ucy5tYXhab29tO1xyXG5cdH0sXHJcblxyXG5cdGdldEJvdW5kc1pvb206IGZ1bmN0aW9uIChib3VuZHMsIGluc2lkZSwgcGFkZGluZykgeyAvLyAoTGF0TG5nQm91bmRzWywgQm9vbGVhbiwgUG9pbnRdKSAtPiBOdW1iZXJcclxuXHRcdGJvdW5kcyA9IEwubGF0TG5nQm91bmRzKGJvdW5kcyk7XHJcblxyXG5cdFx0dmFyIHpvb20gPSB0aGlzLmdldE1pblpvb20oKSAtIChpbnNpZGUgPyAxIDogMCksXHJcblx0XHQgICAgbWF4Wm9vbSA9IHRoaXMuZ2V0TWF4Wm9vbSgpLFxyXG5cdFx0ICAgIHNpemUgPSB0aGlzLmdldFNpemUoKSxcclxuXHJcblx0XHQgICAgbncgPSBib3VuZHMuZ2V0Tm9ydGhXZXN0KCksXHJcblx0XHQgICAgc2UgPSBib3VuZHMuZ2V0U291dGhFYXN0KCksXHJcblxyXG5cdFx0ICAgIHpvb21Ob3RGb3VuZCA9IHRydWUsXHJcblx0XHQgICAgYm91bmRzU2l6ZTtcclxuXHJcblx0XHRwYWRkaW5nID0gTC5wb2ludChwYWRkaW5nIHx8IFswLCAwXSk7XHJcblxyXG5cdFx0ZG8ge1xyXG5cdFx0XHR6b29tKys7XHJcblx0XHRcdGJvdW5kc1NpemUgPSB0aGlzLnByb2plY3Qoc2UsIHpvb20pLnN1YnRyYWN0KHRoaXMucHJvamVjdChudywgem9vbSkpLmFkZChwYWRkaW5nKTtcclxuXHRcdFx0em9vbU5vdEZvdW5kID0gIWluc2lkZSA/IHNpemUuY29udGFpbnMoYm91bmRzU2l6ZSkgOiBib3VuZHNTaXplLnggPCBzaXplLnggfHwgYm91bmRzU2l6ZS55IDwgc2l6ZS55O1xyXG5cclxuXHRcdH0gd2hpbGUgKHpvb21Ob3RGb3VuZCAmJiB6b29tIDw9IG1heFpvb20pO1xyXG5cclxuXHRcdGlmICh6b29tTm90Rm91bmQgJiYgaW5zaWRlKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBpbnNpZGUgPyB6b29tIDogem9vbSAtIDE7XHJcblx0fSxcclxuXHJcblx0Z2V0U2l6ZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKCF0aGlzLl9zaXplIHx8IHRoaXMuX3NpemVDaGFuZ2VkKSB7XHJcblx0XHRcdHRoaXMuX3NpemUgPSBuZXcgTC5Qb2ludChcclxuXHRcdFx0XHR0aGlzLl9jb250YWluZXIuY2xpZW50V2lkdGgsXHJcblx0XHRcdFx0dGhpcy5fY29udGFpbmVyLmNsaWVudEhlaWdodCk7XHJcblxyXG5cdFx0XHR0aGlzLl9zaXplQ2hhbmdlZCA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXMuX3NpemUuY2xvbmUoKTtcclxuXHR9LFxyXG5cclxuXHRnZXRQaXhlbEJvdW5kczogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHRvcExlZnRQb2ludCA9IHRoaXMuX2dldFRvcExlZnRQb2ludCgpO1xyXG5cdFx0cmV0dXJuIG5ldyBMLkJvdW5kcyh0b3BMZWZ0UG9pbnQsIHRvcExlZnRQb2ludC5hZGQodGhpcy5nZXRTaXplKCkpKTtcclxuXHR9LFxyXG5cclxuXHRnZXRQaXhlbE9yaWdpbjogZnVuY3Rpb24gKCkge1xyXG5cdFx0dGhpcy5fY2hlY2tJZkxvYWRlZCgpO1xyXG5cdFx0cmV0dXJuIHRoaXMuX2luaXRpYWxUb3BMZWZ0UG9pbnQ7XHJcblx0fSxcclxuXHJcblx0Z2V0UGFuZXM6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9wYW5lcztcclxuXHR9LFxyXG5cclxuXHRnZXRDb250YWluZXI6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9jb250YWluZXI7XHJcblx0fSxcclxuXHJcblxyXG5cdC8vIFRPRE8gcmVwbGFjZSB3aXRoIHVuaXZlcnNhbCBpbXBsZW1lbnRhdGlvbiBhZnRlciByZWZhY3RvcmluZyBwcm9qZWN0aW9uc1xyXG5cclxuXHRnZXRab29tU2NhbGU6IGZ1bmN0aW9uICh0b1pvb20pIHtcclxuXHRcdHZhciBjcnMgPSB0aGlzLm9wdGlvbnMuY3JzO1xyXG5cdFx0cmV0dXJuIGNycy5zY2FsZSh0b1pvb20pIC8gY3JzLnNjYWxlKHRoaXMuX3pvb20pO1xyXG5cdH0sXHJcblxyXG5cdGdldFNjYWxlWm9vbTogZnVuY3Rpb24gKHNjYWxlKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fem9vbSArIChNYXRoLmxvZyhzY2FsZSkgLyBNYXRoLkxOMik7XHJcblx0fSxcclxuXHJcblxyXG5cdC8vIGNvbnZlcnNpb24gbWV0aG9kc1xyXG5cclxuXHRwcm9qZWN0OiBmdW5jdGlvbiAobGF0bG5nLCB6b29tKSB7IC8vIChMYXRMbmdbLCBOdW1iZXJdKSAtPiBQb2ludFxyXG5cdFx0em9vbSA9IHpvb20gPT09IHVuZGVmaW5lZCA/IHRoaXMuX3pvb20gOiB6b29tO1xyXG5cdFx0cmV0dXJuIHRoaXMub3B0aW9ucy5jcnMubGF0TG5nVG9Qb2ludChMLmxhdExuZyhsYXRsbmcpLCB6b29tKTtcclxuXHR9LFxyXG5cclxuXHR1bnByb2plY3Q6IGZ1bmN0aW9uIChwb2ludCwgem9vbSkgeyAvLyAoUG9pbnRbLCBOdW1iZXJdKSAtPiBMYXRMbmdcclxuXHRcdHpvb20gPSB6b29tID09PSB1bmRlZmluZWQgPyB0aGlzLl96b29tIDogem9vbTtcclxuXHRcdHJldHVybiB0aGlzLm9wdGlvbnMuY3JzLnBvaW50VG9MYXRMbmcoTC5wb2ludChwb2ludCksIHpvb20pO1xyXG5cdH0sXHJcblxyXG5cdGxheWVyUG9pbnRUb0xhdExuZzogZnVuY3Rpb24gKHBvaW50KSB7IC8vIChQb2ludClcclxuXHRcdHZhciBwcm9qZWN0ZWRQb2ludCA9IEwucG9pbnQocG9pbnQpLmFkZCh0aGlzLmdldFBpeGVsT3JpZ2luKCkpO1xyXG5cdFx0cmV0dXJuIHRoaXMudW5wcm9qZWN0KHByb2plY3RlZFBvaW50KTtcclxuXHR9LFxyXG5cclxuXHRsYXRMbmdUb0xheWVyUG9pbnQ6IGZ1bmN0aW9uIChsYXRsbmcpIHsgLy8gKExhdExuZylcclxuXHRcdHZhciBwcm9qZWN0ZWRQb2ludCA9IHRoaXMucHJvamVjdChMLmxhdExuZyhsYXRsbmcpKS5fcm91bmQoKTtcclxuXHRcdHJldHVybiBwcm9qZWN0ZWRQb2ludC5fc3VidHJhY3QodGhpcy5nZXRQaXhlbE9yaWdpbigpKTtcclxuXHR9LFxyXG5cclxuXHRjb250YWluZXJQb2ludFRvTGF5ZXJQb2ludDogZnVuY3Rpb24gKHBvaW50KSB7IC8vIChQb2ludClcclxuXHRcdHJldHVybiBMLnBvaW50KHBvaW50KS5zdWJ0cmFjdCh0aGlzLl9nZXRNYXBQYW5lUG9zKCkpO1xyXG5cdH0sXHJcblxyXG5cdGxheWVyUG9pbnRUb0NvbnRhaW5lclBvaW50OiBmdW5jdGlvbiAocG9pbnQpIHsgLy8gKFBvaW50KVxyXG5cdFx0cmV0dXJuIEwucG9pbnQocG9pbnQpLmFkZCh0aGlzLl9nZXRNYXBQYW5lUG9zKCkpO1xyXG5cdH0sXHJcblxyXG5cdGNvbnRhaW5lclBvaW50VG9MYXRMbmc6IGZ1bmN0aW9uIChwb2ludCkge1xyXG5cdFx0dmFyIGxheWVyUG9pbnQgPSB0aGlzLmNvbnRhaW5lclBvaW50VG9MYXllclBvaW50KEwucG9pbnQocG9pbnQpKTtcclxuXHRcdHJldHVybiB0aGlzLmxheWVyUG9pbnRUb0xhdExuZyhsYXllclBvaW50KTtcclxuXHR9LFxyXG5cclxuXHRsYXRMbmdUb0NvbnRhaW5lclBvaW50OiBmdW5jdGlvbiAobGF0bG5nKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5sYXllclBvaW50VG9Db250YWluZXJQb2ludCh0aGlzLmxhdExuZ1RvTGF5ZXJQb2ludChMLmxhdExuZyhsYXRsbmcpKSk7XHJcblx0fSxcclxuXHJcblx0bW91c2VFdmVudFRvQ29udGFpbmVyUG9pbnQ6IGZ1bmN0aW9uIChlKSB7IC8vIChNb3VzZUV2ZW50KVxyXG5cdFx0cmV0dXJuIEwuRG9tRXZlbnQuZ2V0TW91c2VQb3NpdGlvbihlLCB0aGlzLl9jb250YWluZXIpO1xyXG5cdH0sXHJcblxyXG5cdG1vdXNlRXZlbnRUb0xheWVyUG9pbnQ6IGZ1bmN0aW9uIChlKSB7IC8vIChNb3VzZUV2ZW50KVxyXG5cdFx0cmV0dXJuIHRoaXMuY29udGFpbmVyUG9pbnRUb0xheWVyUG9pbnQodGhpcy5tb3VzZUV2ZW50VG9Db250YWluZXJQb2ludChlKSk7XHJcblx0fSxcclxuXHJcblx0bW91c2VFdmVudFRvTGF0TG5nOiBmdW5jdGlvbiAoZSkgeyAvLyAoTW91c2VFdmVudClcclxuXHRcdHJldHVybiB0aGlzLmxheWVyUG9pbnRUb0xhdExuZyh0aGlzLm1vdXNlRXZlbnRUb0xheWVyUG9pbnQoZSkpO1xyXG5cdH0sXHJcblxyXG5cclxuXHQvLyBtYXAgaW5pdGlhbGl6YXRpb24gbWV0aG9kc1xyXG5cclxuXHRfaW5pdENvbnRhaW5lcjogZnVuY3Rpb24gKGlkKSB7XHJcblx0XHR2YXIgY29udGFpbmVyID0gdGhpcy5fY29udGFpbmVyID0gTC5Eb21VdGlsLmdldChpZCk7XHJcblxyXG5cdFx0aWYgKCFjb250YWluZXIpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdNYXAgY29udGFpbmVyIG5vdCBmb3VuZC4nKTtcclxuXHRcdH0gZWxzZSBpZiAoY29udGFpbmVyLl9sZWFmbGV0KSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignTWFwIGNvbnRhaW5lciBpcyBhbHJlYWR5IGluaXRpYWxpemVkLicpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnRhaW5lci5fbGVhZmxldCA9IHRydWU7XHJcblx0fSxcclxuXHJcblx0X2luaXRMYXlvdXQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBjb250YWluZXIgPSB0aGlzLl9jb250YWluZXI7XHJcblxyXG5cdFx0TC5Eb21VdGlsLmFkZENsYXNzKGNvbnRhaW5lciwgJ2xlYWZsZXQtY29udGFpbmVyJyArXHJcblx0XHRcdChMLkJyb3dzZXIudG91Y2ggPyAnIGxlYWZsZXQtdG91Y2gnIDogJycpICtcclxuXHRcdFx0KEwuQnJvd3Nlci5yZXRpbmEgPyAnIGxlYWZsZXQtcmV0aW5hJyA6ICcnKSArXHJcblx0XHRcdChMLkJyb3dzZXIuaWVsdDkgPyAnIGxlYWZsZXQtb2xkaWUnIDogJycpICtcclxuXHRcdFx0KHRoaXMub3B0aW9ucy5mYWRlQW5pbWF0aW9uID8gJyBsZWFmbGV0LWZhZGUtYW5pbScgOiAnJykpO1xyXG5cclxuXHRcdHZhciBwb3NpdGlvbiA9IEwuRG9tVXRpbC5nZXRTdHlsZShjb250YWluZXIsICdwb3NpdGlvbicpO1xyXG5cclxuXHRcdGlmIChwb3NpdGlvbiAhPT0gJ2Fic29sdXRlJyAmJiBwb3NpdGlvbiAhPT0gJ3JlbGF0aXZlJyAmJiBwb3NpdGlvbiAhPT0gJ2ZpeGVkJykge1xyXG5cdFx0XHRjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2luaXRQYW5lcygpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9pbml0Q29udHJvbFBvcykge1xyXG5cdFx0XHR0aGlzLl9pbml0Q29udHJvbFBvcygpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9pbml0UGFuZXM6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBwYW5lcyA9IHRoaXMuX3BhbmVzID0ge307XHJcblxyXG5cdFx0dGhpcy5fbWFwUGFuZSA9IHBhbmVzLm1hcFBhbmUgPSB0aGlzLl9jcmVhdGVQYW5lKCdsZWFmbGV0LW1hcC1wYW5lJywgdGhpcy5fY29udGFpbmVyKTtcclxuXHJcblx0XHR0aGlzLl90aWxlUGFuZSA9IHBhbmVzLnRpbGVQYW5lID0gdGhpcy5fY3JlYXRlUGFuZSgnbGVhZmxldC10aWxlLXBhbmUnLCB0aGlzLl9tYXBQYW5lKTtcclxuXHRcdHBhbmVzLm9iamVjdHNQYW5lID0gdGhpcy5fY3JlYXRlUGFuZSgnbGVhZmxldC1vYmplY3RzLXBhbmUnLCB0aGlzLl9tYXBQYW5lKTtcclxuXHRcdHBhbmVzLnNoYWRvd1BhbmUgPSB0aGlzLl9jcmVhdGVQYW5lKCdsZWFmbGV0LXNoYWRvdy1wYW5lJyk7XHJcblx0XHRwYW5lcy5vdmVybGF5UGFuZSA9IHRoaXMuX2NyZWF0ZVBhbmUoJ2xlYWZsZXQtb3ZlcmxheS1wYW5lJyk7XHJcblx0XHRwYW5lcy5tYXJrZXJQYW5lID0gdGhpcy5fY3JlYXRlUGFuZSgnbGVhZmxldC1tYXJrZXItcGFuZScpO1xyXG5cdFx0cGFuZXMucG9wdXBQYW5lID0gdGhpcy5fY3JlYXRlUGFuZSgnbGVhZmxldC1wb3B1cC1wYW5lJyk7XHJcblxyXG5cdFx0dmFyIHpvb21IaWRlID0gJyBsZWFmbGV0LXpvb20taGlkZSc7XHJcblxyXG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMubWFya2VyWm9vbUFuaW1hdGlvbikge1xyXG5cdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3MocGFuZXMubWFya2VyUGFuZSwgem9vbUhpZGUpO1xyXG5cdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3MocGFuZXMuc2hhZG93UGFuZSwgem9vbUhpZGUpO1xyXG5cdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3MocGFuZXMucG9wdXBQYW5lLCB6b29tSGlkZSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X2NyZWF0ZVBhbmU6IGZ1bmN0aW9uIChjbGFzc05hbWUsIGNvbnRhaW5lcikge1xyXG5cdFx0cmV0dXJuIEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsIGNsYXNzTmFtZSwgY29udGFpbmVyIHx8IHRoaXMuX3BhbmVzLm9iamVjdHNQYW5lKTtcclxuXHR9LFxyXG5cclxuXHRfY2xlYXJQYW5lczogZnVuY3Rpb24gKCkge1xyXG5cdFx0dGhpcy5fY29udGFpbmVyLnJlbW92ZUNoaWxkKHRoaXMuX21hcFBhbmUpO1xyXG5cdH0sXHJcblxyXG5cdF9hZGRMYXllcnM6IGZ1bmN0aW9uIChsYXllcnMpIHtcclxuXHRcdGxheWVycyA9IGxheWVycyA/IChMLlV0aWwuaXNBcnJheShsYXllcnMpID8gbGF5ZXJzIDogW2xheWVyc10pIDogW107XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IDAsIGxlbiA9IGxheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0XHR0aGlzLmFkZExheWVyKGxheWVyc1tpXSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblxyXG5cdC8vIHByaXZhdGUgbWV0aG9kcyB0aGF0IG1vZGlmeSBtYXAgc3RhdGVcclxuXHJcblx0X3Jlc2V0VmlldzogZnVuY3Rpb24gKGNlbnRlciwgem9vbSwgcHJlc2VydmVNYXBPZmZzZXQsIGFmdGVyWm9vbUFuaW0pIHtcclxuXHJcblx0XHR2YXIgem9vbUNoYW5nZWQgPSAodGhpcy5fem9vbSAhPT0gem9vbSk7XHJcblxyXG5cdFx0aWYgKCFhZnRlclpvb21BbmltKSB7XHJcblx0XHRcdHRoaXMuZmlyZSgnbW92ZXN0YXJ0Jyk7XHJcblxyXG5cdFx0XHRpZiAoem9vbUNoYW5nZWQpIHtcclxuXHRcdFx0XHR0aGlzLmZpcmUoJ3pvb21zdGFydCcpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fem9vbSA9IHpvb207XHJcblx0XHR0aGlzLl9pbml0aWFsQ2VudGVyID0gY2VudGVyO1xyXG5cclxuXHRcdHRoaXMuX2luaXRpYWxUb3BMZWZ0UG9pbnQgPSB0aGlzLl9nZXROZXdUb3BMZWZ0UG9pbnQoY2VudGVyKTtcclxuXHJcblx0XHRpZiAoIXByZXNlcnZlTWFwT2Zmc2V0KSB7XHJcblx0XHRcdEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9tYXBQYW5lLCBuZXcgTC5Qb2ludCgwLCAwKSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLl9pbml0aWFsVG9wTGVmdFBvaW50Ll9hZGQodGhpcy5fZ2V0TWFwUGFuZVBvcygpKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl90aWxlTGF5ZXJzVG9Mb2FkID0gdGhpcy5fdGlsZUxheWVyc051bTtcclxuXHJcblx0XHR2YXIgbG9hZGluZyA9ICF0aGlzLl9sb2FkZWQ7XHJcblx0XHR0aGlzLl9sb2FkZWQgPSB0cnVlO1xyXG5cclxuXHRcdHRoaXMuZmlyZSgndmlld3Jlc2V0Jywge2hhcmQ6ICFwcmVzZXJ2ZU1hcE9mZnNldH0pO1xyXG5cclxuXHRcdGlmIChsb2FkaW5nKSB7XHJcblx0XHRcdHRoaXMuZmlyZSgnbG9hZCcpO1xyXG5cdFx0XHR0aGlzLmVhY2hMYXllcih0aGlzLl9sYXllckFkZCwgdGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5maXJlKCdtb3ZlJyk7XHJcblxyXG5cdFx0aWYgKHpvb21DaGFuZ2VkIHx8IGFmdGVyWm9vbUFuaW0pIHtcclxuXHRcdFx0dGhpcy5maXJlKCd6b29tZW5kJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5maXJlKCdtb3ZlZW5kJywge2hhcmQ6ICFwcmVzZXJ2ZU1hcE9mZnNldH0pO1xyXG5cdH0sXHJcblxyXG5cdF9yYXdQYW5CeTogZnVuY3Rpb24gKG9mZnNldCkge1xyXG5cdFx0TC5Eb21VdGlsLnNldFBvc2l0aW9uKHRoaXMuX21hcFBhbmUsIHRoaXMuX2dldE1hcFBhbmVQb3MoKS5zdWJ0cmFjdChvZmZzZXQpKTtcclxuXHR9LFxyXG5cclxuXHRfZ2V0Wm9vbVNwYW46IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLmdldE1heFpvb20oKSAtIHRoaXMuZ2V0TWluWm9vbSgpO1xyXG5cdH0sXHJcblxyXG5cdF91cGRhdGVab29tTGV2ZWxzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgaSxcclxuXHRcdFx0bWluWm9vbSA9IEluZmluaXR5LFxyXG5cdFx0XHRtYXhab29tID0gLUluZmluaXR5LFxyXG5cdFx0XHRvbGRab29tU3BhbiA9IHRoaXMuX2dldFpvb21TcGFuKCk7XHJcblxyXG5cdFx0Zm9yIChpIGluIHRoaXMuX3pvb21Cb3VuZExheWVycykge1xyXG5cdFx0XHR2YXIgbGF5ZXIgPSB0aGlzLl96b29tQm91bmRMYXllcnNbaV07XHJcblx0XHRcdGlmICghaXNOYU4obGF5ZXIub3B0aW9ucy5taW5ab29tKSkge1xyXG5cdFx0XHRcdG1pblpvb20gPSBNYXRoLm1pbihtaW5ab29tLCBsYXllci5vcHRpb25zLm1pblpvb20pO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICghaXNOYU4obGF5ZXIub3B0aW9ucy5tYXhab29tKSkge1xyXG5cdFx0XHRcdG1heFpvb20gPSBNYXRoLm1heChtYXhab29tLCBsYXllci5vcHRpb25zLm1heFpvb20pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGkgPT09IHVuZGVmaW5lZCkgeyAvLyB3ZSBoYXZlIG5vIHRpbGVsYXllcnNcclxuXHRcdFx0dGhpcy5fbGF5ZXJzTWF4Wm9vbSA9IHRoaXMuX2xheWVyc01pblpvb20gPSB1bmRlZmluZWQ7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLl9sYXllcnNNYXhab29tID0gbWF4Wm9vbTtcclxuXHRcdFx0dGhpcy5fbGF5ZXJzTWluWm9vbSA9IG1pblpvb207XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKG9sZFpvb21TcGFuICE9PSB0aGlzLl9nZXRab29tU3BhbigpKSB7XHJcblx0XHRcdHRoaXMuZmlyZSgnem9vbWxldmVsc2NoYW5nZScpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9wYW5JbnNpZGVNYXhCb3VuZHM6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHRoaXMucGFuSW5zaWRlQm91bmRzKHRoaXMub3B0aW9ucy5tYXhCb3VuZHMpO1xyXG5cdH0sXHJcblxyXG5cdF9jaGVja0lmTG9hZGVkOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAoIXRoaXMuX2xvYWRlZCkge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1NldCBtYXAgY2VudGVyIGFuZCB6b29tIGZpcnN0LicpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdC8vIG1hcCBldmVudHNcclxuXHJcblx0X2luaXRFdmVudHM6IGZ1bmN0aW9uIChvbk9mZikge1xyXG5cdFx0aWYgKCFMLkRvbUV2ZW50KSB7IHJldHVybjsgfVxyXG5cclxuXHRcdG9uT2ZmID0gb25PZmYgfHwgJ29uJztcclxuXHJcblx0XHRMLkRvbUV2ZW50W29uT2ZmXSh0aGlzLl9jb250YWluZXIsICdjbGljaycsIHRoaXMuX29uTW91c2VDbGljaywgdGhpcyk7XHJcblxyXG5cdFx0dmFyIGV2ZW50cyA9IFsnZGJsY2xpY2snLCAnbW91c2Vkb3duJywgJ21vdXNldXAnLCAnbW91c2VlbnRlcicsXHJcblx0XHQgICAgICAgICAgICAgICdtb3VzZWxlYXZlJywgJ21vdXNlbW92ZScsICdjb250ZXh0bWVudSddLFxyXG5cdFx0ICAgIGksIGxlbjtcclxuXHJcblx0XHRmb3IgKGkgPSAwLCBsZW4gPSBldmVudHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0TC5Eb21FdmVudFtvbk9mZl0odGhpcy5fY29udGFpbmVyLCBldmVudHNbaV0sIHRoaXMuX2ZpcmVNb3VzZUV2ZW50LCB0aGlzKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnRyYWNrUmVzaXplKSB7XHJcblx0XHRcdEwuRG9tRXZlbnRbb25PZmZdKHdpbmRvdywgJ3Jlc2l6ZScsIHRoaXMuX29uUmVzaXplLCB0aGlzKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfb25SZXNpemU6IGZ1bmN0aW9uICgpIHtcclxuXHRcdEwuVXRpbC5jYW5jZWxBbmltRnJhbWUodGhpcy5fcmVzaXplUmVxdWVzdCk7XHJcblx0XHR0aGlzLl9yZXNpemVSZXF1ZXN0ID0gTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUoXHJcblx0XHQgICAgICAgIGZ1bmN0aW9uICgpIHsgdGhpcy5pbnZhbGlkYXRlU2l6ZSh7ZGVib3VuY2VNb3ZlZW5kOiB0cnVlfSk7IH0sIHRoaXMsIGZhbHNlLCB0aGlzLl9jb250YWluZXIpO1xyXG5cdH0sXHJcblxyXG5cdF9vbk1vdXNlQ2xpY2s6IGZ1bmN0aW9uIChlKSB7XHJcblx0XHRpZiAoIXRoaXMuX2xvYWRlZCB8fCAoIWUuX3NpbXVsYXRlZCAmJlxyXG5cdFx0ICAgICAgICAoKHRoaXMuZHJhZ2dpbmcgJiYgdGhpcy5kcmFnZ2luZy5tb3ZlZCgpKSB8fFxyXG5cdFx0ICAgICAgICAgKHRoaXMuYm94Wm9vbSAgJiYgdGhpcy5ib3hab29tLm1vdmVkKCkpKSkgfHxcclxuXHRcdCAgICAgICAgICAgIEwuRG9tRXZlbnQuX3NraXBwZWQoZSkpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dGhpcy5maXJlKCdwcmVjbGljaycpO1xyXG5cdFx0dGhpcy5fZmlyZU1vdXNlRXZlbnQoZSk7XHJcblx0fSxcclxuXHJcblx0X2ZpcmVNb3VzZUV2ZW50OiBmdW5jdGlvbiAoZSkge1xyXG5cdFx0aWYgKCF0aGlzLl9sb2FkZWQgfHwgTC5Eb21FdmVudC5fc2tpcHBlZChlKSkgeyByZXR1cm47IH1cclxuXHJcblx0XHR2YXIgdHlwZSA9IGUudHlwZTtcclxuXHJcblx0XHR0eXBlID0gKHR5cGUgPT09ICdtb3VzZWVudGVyJyA/ICdtb3VzZW92ZXInIDogKHR5cGUgPT09ICdtb3VzZWxlYXZlJyA/ICdtb3VzZW91dCcgOiB0eXBlKSk7XHJcblxyXG5cdFx0aWYgKCF0aGlzLmhhc0V2ZW50TGlzdGVuZXJzKHR5cGUpKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGlmICh0eXBlID09PSAnY29udGV4dG1lbnUnKSB7XHJcblx0XHRcdEwuRG9tRXZlbnQucHJldmVudERlZmF1bHQoZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGNvbnRhaW5lclBvaW50ID0gdGhpcy5tb3VzZUV2ZW50VG9Db250YWluZXJQb2ludChlKSxcclxuXHRcdCAgICBsYXllclBvaW50ID0gdGhpcy5jb250YWluZXJQb2ludFRvTGF5ZXJQb2ludChjb250YWluZXJQb2ludCksXHJcblx0XHQgICAgbGF0bG5nID0gdGhpcy5sYXllclBvaW50VG9MYXRMbmcobGF5ZXJQb2ludCk7XHJcblxyXG5cdFx0dGhpcy5maXJlKHR5cGUsIHtcclxuXHRcdFx0bGF0bG5nOiBsYXRsbmcsXHJcblx0XHRcdGxheWVyUG9pbnQ6IGxheWVyUG9pbnQsXHJcblx0XHRcdGNvbnRhaW5lclBvaW50OiBjb250YWluZXJQb2ludCxcclxuXHRcdFx0b3JpZ2luYWxFdmVudDogZVxyXG5cdFx0fSk7XHJcblx0fSxcclxuXHJcblx0X29uVGlsZUxheWVyTG9hZDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dGhpcy5fdGlsZUxheWVyc1RvTG9hZC0tO1xyXG5cdFx0aWYgKHRoaXMuX3RpbGVMYXllcnNOdW0gJiYgIXRoaXMuX3RpbGVMYXllcnNUb0xvYWQpIHtcclxuXHRcdFx0dGhpcy5maXJlKCd0aWxlbGF5ZXJzbG9hZCcpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9jbGVhckhhbmRsZXJzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5faGFuZGxlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0dGhpcy5faGFuZGxlcnNbaV0uZGlzYWJsZSgpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdHdoZW5SZWFkeTogZnVuY3Rpb24gKGNhbGxiYWNrLCBjb250ZXh0KSB7XHJcblx0XHRpZiAodGhpcy5fbG9hZGVkKSB7XHJcblx0XHRcdGNhbGxiYWNrLmNhbGwoY29udGV4dCB8fCB0aGlzLCB0aGlzKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMub24oJ2xvYWQnLCBjYWxsYmFjaywgY29udGV4dCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRfbGF5ZXJBZGQ6IGZ1bmN0aW9uIChsYXllcikge1xyXG5cdFx0bGF5ZXIub25BZGQodGhpcyk7XHJcblx0XHR0aGlzLmZpcmUoJ2xheWVyYWRkJywge2xheWVyOiBsYXllcn0pO1xyXG5cdH0sXHJcblxyXG5cclxuXHQvLyBwcml2YXRlIG1ldGhvZHMgZm9yIGdldHRpbmcgbWFwIHN0YXRlXHJcblxyXG5cdF9nZXRNYXBQYW5lUG9zOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gTC5Eb21VdGlsLmdldFBvc2l0aW9uKHRoaXMuX21hcFBhbmUpO1xyXG5cdH0sXHJcblxyXG5cdF9tb3ZlZDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHBvcyA9IHRoaXMuX2dldE1hcFBhbmVQb3MoKTtcclxuXHRcdHJldHVybiBwb3MgJiYgIXBvcy5lcXVhbHMoWzAsIDBdKTtcclxuXHR9LFxyXG5cclxuXHRfZ2V0VG9wTGVmdFBvaW50OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5nZXRQaXhlbE9yaWdpbigpLnN1YnRyYWN0KHRoaXMuX2dldE1hcFBhbmVQb3MoKSk7XHJcblx0fSxcclxuXHJcblx0X2dldE5ld1RvcExlZnRQb2ludDogZnVuY3Rpb24gKGNlbnRlciwgem9vbSkge1xyXG5cdFx0dmFyIHZpZXdIYWxmID0gdGhpcy5nZXRTaXplKCkuX2RpdmlkZUJ5KDIpO1xyXG5cdFx0Ly8gVE9ETyByb3VuZCBvbiBkaXNwbGF5LCBub3QgY2FsY3VsYXRpb24gdG8gaW5jcmVhc2UgcHJlY2lzaW9uP1xyXG5cdFx0cmV0dXJuIHRoaXMucHJvamVjdChjZW50ZXIsIHpvb20pLl9zdWJ0cmFjdCh2aWV3SGFsZikuX3JvdW5kKCk7XHJcblx0fSxcclxuXHJcblx0X2xhdExuZ1RvTmV3TGF5ZXJQb2ludDogZnVuY3Rpb24gKGxhdGxuZywgbmV3Wm9vbSwgbmV3Q2VudGVyKSB7XHJcblx0XHR2YXIgdG9wTGVmdCA9IHRoaXMuX2dldE5ld1RvcExlZnRQb2ludChuZXdDZW50ZXIsIG5ld1pvb20pLmFkZCh0aGlzLl9nZXRNYXBQYW5lUG9zKCkpO1xyXG5cdFx0cmV0dXJuIHRoaXMucHJvamVjdChsYXRsbmcsIG5ld1pvb20pLl9zdWJ0cmFjdCh0b3BMZWZ0KTtcclxuXHR9LFxyXG5cclxuXHQvLyBsYXllciBwb2ludCBvZiB0aGUgY3VycmVudCBjZW50ZXJcclxuXHRfZ2V0Q2VudGVyTGF5ZXJQb2ludDogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29udGFpbmVyUG9pbnRUb0xheWVyUG9pbnQodGhpcy5nZXRTaXplKCkuX2RpdmlkZUJ5KDIpKTtcclxuXHR9LFxyXG5cclxuXHQvLyBvZmZzZXQgb2YgdGhlIHNwZWNpZmllZCBwbGFjZSB0byB0aGUgY3VycmVudCBjZW50ZXIgaW4gcGl4ZWxzXHJcblx0X2dldENlbnRlck9mZnNldDogZnVuY3Rpb24gKGxhdGxuZykge1xyXG5cdFx0cmV0dXJuIHRoaXMubGF0TG5nVG9MYXllclBvaW50KGxhdGxuZykuc3VidHJhY3QodGhpcy5fZ2V0Q2VudGVyTGF5ZXJQb2ludCgpKTtcclxuXHR9LFxyXG5cclxuXHQvLyBhZGp1c3QgY2VudGVyIGZvciB2aWV3IHRvIGdldCBpbnNpZGUgYm91bmRzXHJcblx0X2xpbWl0Q2VudGVyOiBmdW5jdGlvbiAoY2VudGVyLCB6b29tLCBib3VuZHMpIHtcclxuXHJcblx0XHRpZiAoIWJvdW5kcykgeyByZXR1cm4gY2VudGVyOyB9XHJcblxyXG5cdFx0dmFyIGNlbnRlclBvaW50ID0gdGhpcy5wcm9qZWN0KGNlbnRlciwgem9vbSksXHJcblx0XHQgICAgdmlld0hhbGYgPSB0aGlzLmdldFNpemUoKS5kaXZpZGVCeSgyKSxcclxuXHRcdCAgICB2aWV3Qm91bmRzID0gbmV3IEwuQm91bmRzKGNlbnRlclBvaW50LnN1YnRyYWN0KHZpZXdIYWxmKSwgY2VudGVyUG9pbnQuYWRkKHZpZXdIYWxmKSksXHJcblx0XHQgICAgb2Zmc2V0ID0gdGhpcy5fZ2V0Qm91bmRzT2Zmc2V0KHZpZXdCb3VuZHMsIGJvdW5kcywgem9vbSk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMudW5wcm9qZWN0KGNlbnRlclBvaW50LmFkZChvZmZzZXQpLCB6b29tKTtcclxuXHR9LFxyXG5cclxuXHQvLyBhZGp1c3Qgb2Zmc2V0IGZvciB2aWV3IHRvIGdldCBpbnNpZGUgYm91bmRzXHJcblx0X2xpbWl0T2Zmc2V0OiBmdW5jdGlvbiAob2Zmc2V0LCBib3VuZHMpIHtcclxuXHRcdGlmICghYm91bmRzKSB7IHJldHVybiBvZmZzZXQ7IH1cclxuXHJcblx0XHR2YXIgdmlld0JvdW5kcyA9IHRoaXMuZ2V0UGl4ZWxCb3VuZHMoKSxcclxuXHRcdCAgICBuZXdCb3VuZHMgPSBuZXcgTC5Cb3VuZHModmlld0JvdW5kcy5taW4uYWRkKG9mZnNldCksIHZpZXdCb3VuZHMubWF4LmFkZChvZmZzZXQpKTtcclxuXHJcblx0XHRyZXR1cm4gb2Zmc2V0LmFkZCh0aGlzLl9nZXRCb3VuZHNPZmZzZXQobmV3Qm91bmRzLCBib3VuZHMpKTtcclxuXHR9LFxyXG5cclxuXHQvLyByZXR1cm5zIG9mZnNldCBuZWVkZWQgZm9yIHB4Qm91bmRzIHRvIGdldCBpbnNpZGUgbWF4Qm91bmRzIGF0IGEgc3BlY2lmaWVkIHpvb21cclxuXHRfZ2V0Qm91bmRzT2Zmc2V0OiBmdW5jdGlvbiAocHhCb3VuZHMsIG1heEJvdW5kcywgem9vbSkge1xyXG5cdFx0dmFyIG53T2Zmc2V0ID0gdGhpcy5wcm9qZWN0KG1heEJvdW5kcy5nZXROb3J0aFdlc3QoKSwgem9vbSkuc3VidHJhY3QocHhCb3VuZHMubWluKSxcclxuXHRcdCAgICBzZU9mZnNldCA9IHRoaXMucHJvamVjdChtYXhCb3VuZHMuZ2V0U291dGhFYXN0KCksIHpvb20pLnN1YnRyYWN0KHB4Qm91bmRzLm1heCksXHJcblxyXG5cdFx0ICAgIGR4ID0gdGhpcy5fcmVib3VuZChud09mZnNldC54LCAtc2VPZmZzZXQueCksXHJcblx0XHQgICAgZHkgPSB0aGlzLl9yZWJvdW5kKG53T2Zmc2V0LnksIC1zZU9mZnNldC55KTtcclxuXHJcblx0XHRyZXR1cm4gbmV3IEwuUG9pbnQoZHgsIGR5KTtcclxuXHR9LFxyXG5cclxuXHRfcmVib3VuZDogZnVuY3Rpb24gKGxlZnQsIHJpZ2h0KSB7XHJcblx0XHRyZXR1cm4gbGVmdCArIHJpZ2h0ID4gMCA/XHJcblx0XHRcdE1hdGgucm91bmQobGVmdCAtIHJpZ2h0KSAvIDIgOlxyXG5cdFx0XHRNYXRoLm1heCgwLCBNYXRoLmNlaWwobGVmdCkpIC0gTWF0aC5tYXgoMCwgTWF0aC5mbG9vcihyaWdodCkpO1xyXG5cdH0sXHJcblxyXG5cdF9saW1pdFpvb206IGZ1bmN0aW9uICh6b29tKSB7XHJcblx0XHR2YXIgbWluID0gdGhpcy5nZXRNaW5ab29tKCksXHJcblx0XHQgICAgbWF4ID0gdGhpcy5nZXRNYXhab29tKCk7XHJcblxyXG5cdFx0cmV0dXJuIE1hdGgubWF4KG1pbiwgTWF0aC5taW4obWF4LCB6b29tKSk7XHJcblx0fVxyXG59KTtcclxuXHJcbkwubWFwID0gZnVuY3Rpb24gKGlkLCBvcHRpb25zKSB7XHJcblx0cmV0dXJuIG5ldyBMLk1hcChpZCwgb3B0aW9ucyk7XHJcbn07XHJcblxuXG4vKlxyXG4gKiBNZXJjYXRvciBwcm9qZWN0aW9uIHRoYXQgdGFrZXMgaW50byBhY2NvdW50IHRoYXQgdGhlIEVhcnRoIGlzIG5vdCBhIHBlcmZlY3Qgc3BoZXJlLlxyXG4gKiBMZXNzIHBvcHVsYXIgdGhhbiBzcGhlcmljYWwgbWVyY2F0b3I7IHVzZWQgYnkgcHJvamVjdGlvbnMgbGlrZSBFUFNHOjMzOTUuXHJcbiAqL1xyXG5cclxuTC5Qcm9qZWN0aW9uLk1lcmNhdG9yID0ge1xyXG5cdE1BWF9MQVRJVFVERTogODUuMDg0MDU5MTU1NixcclxuXHJcblx0Ul9NSU5PUjogNjM1Njc1Mi4zMTQyNDUxNzksXHJcblx0Ul9NQUpPUjogNjM3ODEzNyxcclxuXHJcblx0cHJvamVjdDogZnVuY3Rpb24gKGxhdGxuZykgeyAvLyAoTGF0TG5nKSAtPiBQb2ludFxyXG5cdFx0dmFyIGQgPSBMLkxhdExuZy5ERUdfVE9fUkFELFxyXG5cdFx0ICAgIG1heCA9IHRoaXMuTUFYX0xBVElUVURFLFxyXG5cdFx0ICAgIGxhdCA9IE1hdGgubWF4KE1hdGgubWluKG1heCwgbGF0bG5nLmxhdCksIC1tYXgpLFxyXG5cdFx0ICAgIHIgPSB0aGlzLlJfTUFKT1IsXHJcblx0XHQgICAgcjIgPSB0aGlzLlJfTUlOT1IsXHJcblx0XHQgICAgeCA9IGxhdGxuZy5sbmcgKiBkICogcixcclxuXHRcdCAgICB5ID0gbGF0ICogZCxcclxuXHRcdCAgICB0bXAgPSByMiAvIHIsXHJcblx0XHQgICAgZWNjZW50ID0gTWF0aC5zcXJ0KDEuMCAtIHRtcCAqIHRtcCksXHJcblx0XHQgICAgY29uID0gZWNjZW50ICogTWF0aC5zaW4oeSk7XHJcblxyXG5cdFx0Y29uID0gTWF0aC5wb3coKDEgLSBjb24pIC8gKDEgKyBjb24pLCBlY2NlbnQgKiAwLjUpO1xyXG5cclxuXHRcdHZhciB0cyA9IE1hdGgudGFuKDAuNSAqICgoTWF0aC5QSSAqIDAuNSkgLSB5KSkgLyBjb247XHJcblx0XHR5ID0gLXIgKiBNYXRoLmxvZyh0cyk7XHJcblxyXG5cdFx0cmV0dXJuIG5ldyBMLlBvaW50KHgsIHkpO1xyXG5cdH0sXHJcblxyXG5cdHVucHJvamVjdDogZnVuY3Rpb24gKHBvaW50KSB7IC8vIChQb2ludCwgQm9vbGVhbikgLT4gTGF0TG5nXHJcblx0XHR2YXIgZCA9IEwuTGF0TG5nLlJBRF9UT19ERUcsXHJcblx0XHQgICAgciA9IHRoaXMuUl9NQUpPUixcclxuXHRcdCAgICByMiA9IHRoaXMuUl9NSU5PUixcclxuXHRcdCAgICBsbmcgPSBwb2ludC54ICogZCAvIHIsXHJcblx0XHQgICAgdG1wID0gcjIgLyByLFxyXG5cdFx0ICAgIGVjY2VudCA9IE1hdGguc3FydCgxIC0gKHRtcCAqIHRtcCkpLFxyXG5cdFx0ICAgIHRzID0gTWF0aC5leHAoLSBwb2ludC55IC8gciksXHJcblx0XHQgICAgcGhpID0gKE1hdGguUEkgLyAyKSAtIDIgKiBNYXRoLmF0YW4odHMpLFxyXG5cdFx0ICAgIG51bUl0ZXIgPSAxNSxcclxuXHRcdCAgICB0b2wgPSAxZS03LFxyXG5cdFx0ICAgIGkgPSBudW1JdGVyLFxyXG5cdFx0ICAgIGRwaGkgPSAwLjEsXHJcblx0XHQgICAgY29uO1xyXG5cclxuXHRcdHdoaWxlICgoTWF0aC5hYnMoZHBoaSkgPiB0b2wpICYmICgtLWkgPiAwKSkge1xyXG5cdFx0XHRjb24gPSBlY2NlbnQgKiBNYXRoLnNpbihwaGkpO1xyXG5cdFx0XHRkcGhpID0gKE1hdGguUEkgLyAyKSAtIDIgKiBNYXRoLmF0YW4odHMgKlxyXG5cdFx0XHQgICAgICAgICAgICBNYXRoLnBvdygoMS4wIC0gY29uKSAvICgxLjAgKyBjb24pLCAwLjUgKiBlY2NlbnQpKSAtIHBoaTtcclxuXHRcdFx0cGhpICs9IGRwaGk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG5ldyBMLkxhdExuZyhwaGkgKiBkLCBsbmcpO1xyXG5cdH1cclxufTtcclxuXG5cblxyXG5MLkNSUy5FUFNHMzM5NSA9IEwuZXh0ZW5kKHt9LCBMLkNSUywge1xyXG5cdGNvZGU6ICdFUFNHOjMzOTUnLFxyXG5cclxuXHRwcm9qZWN0aW9uOiBMLlByb2plY3Rpb24uTWVyY2F0b3IsXHJcblxyXG5cdHRyYW5zZm9ybWF0aW9uOiAoZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIG0gPSBMLlByb2plY3Rpb24uTWVyY2F0b3IsXHJcblx0XHQgICAgciA9IG0uUl9NQUpPUixcclxuXHRcdCAgICBzY2FsZSA9IDAuNSAvIChNYXRoLlBJICogcik7XHJcblxyXG5cdFx0cmV0dXJuIG5ldyBMLlRyYW5zZm9ybWF0aW9uKHNjYWxlLCAwLjUsIC1zY2FsZSwgMC41KTtcclxuXHR9KCkpXHJcbn0pO1xyXG5cblxuLypcclxuICogTC5UaWxlTGF5ZXIgaXMgdXNlZCBmb3Igc3RhbmRhcmQgeHl6LW51bWJlcmVkIHRpbGUgbGF5ZXJzLlxyXG4gKi9cclxuXHJcbkwuVGlsZUxheWVyID0gTC5DbGFzcy5leHRlbmQoe1xyXG5cdGluY2x1ZGVzOiBMLk1peGluLkV2ZW50cyxcclxuXHJcblx0b3B0aW9uczoge1xyXG5cdFx0bWluWm9vbTogMCxcclxuXHRcdG1heFpvb206IDE4LFxyXG5cdFx0dGlsZVNpemU6IDI1NixcclxuXHRcdHN1YmRvbWFpbnM6ICdhYmMnLFxyXG5cdFx0ZXJyb3JUaWxlVXJsOiAnJyxcclxuXHRcdGF0dHJpYnV0aW9uOiAnJyxcclxuXHRcdHpvb21PZmZzZXQ6IDAsXHJcblx0XHRvcGFjaXR5OiAxLFxyXG5cdFx0LypcclxuXHRcdG1heE5hdGl2ZVpvb206IG51bGwsXHJcblx0XHR6SW5kZXg6IG51bGwsXHJcblx0XHR0bXM6IGZhbHNlLFxyXG5cdFx0Y29udGludW91c1dvcmxkOiBmYWxzZSxcclxuXHRcdG5vV3JhcDogZmFsc2UsXHJcblx0XHR6b29tUmV2ZXJzZTogZmFsc2UsXHJcblx0XHRkZXRlY3RSZXRpbmE6IGZhbHNlLFxyXG5cdFx0cmV1c2VUaWxlczogZmFsc2UsXHJcblx0XHRib3VuZHM6IGZhbHNlLFxyXG5cdFx0Ki9cclxuXHRcdHVubG9hZEludmlzaWJsZVRpbGVzOiBMLkJyb3dzZXIubW9iaWxlLFxyXG5cdFx0dXBkYXRlV2hlbklkbGU6IEwuQnJvd3Nlci5tb2JpbGVcclxuXHR9LFxyXG5cclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAodXJsLCBvcHRpb25zKSB7XHJcblx0XHRvcHRpb25zID0gTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuXHRcdC8vIGRldGVjdGluZyByZXRpbmEgZGlzcGxheXMsIGFkanVzdGluZyB0aWxlU2l6ZSBhbmQgem9vbSBsZXZlbHNcclxuXHRcdGlmIChvcHRpb25zLmRldGVjdFJldGluYSAmJiBMLkJyb3dzZXIucmV0aW5hICYmIG9wdGlvbnMubWF4Wm9vbSA+IDApIHtcclxuXHJcblx0XHRcdG9wdGlvbnMudGlsZVNpemUgPSBNYXRoLmZsb29yKG9wdGlvbnMudGlsZVNpemUgLyAyKTtcclxuXHRcdFx0b3B0aW9ucy56b29tT2Zmc2V0Kys7XHJcblxyXG5cdFx0XHRpZiAob3B0aW9ucy5taW5ab29tID4gMCkge1xyXG5cdFx0XHRcdG9wdGlvbnMubWluWm9vbS0tO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMub3B0aW9ucy5tYXhab29tLS07XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMuYm91bmRzKSB7XHJcblx0XHRcdG9wdGlvbnMuYm91bmRzID0gTC5sYXRMbmdCb3VuZHMob3B0aW9ucy5ib3VuZHMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3VybCA9IHVybDtcclxuXHJcblx0XHR2YXIgc3ViZG9tYWlucyA9IHRoaXMub3B0aW9ucy5zdWJkb21haW5zO1xyXG5cclxuXHRcdGlmICh0eXBlb2Ygc3ViZG9tYWlucyA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0dGhpcy5vcHRpb25zLnN1YmRvbWFpbnMgPSBzdWJkb21haW5zLnNwbGl0KCcnKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRvbkFkZDogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0dGhpcy5fbWFwID0gbWFwO1xyXG5cdFx0dGhpcy5fYW5pbWF0ZWQgPSBtYXAuX3pvb21BbmltYXRlZDtcclxuXHJcblx0XHQvLyBjcmVhdGUgYSBjb250YWluZXIgZGl2IGZvciB0aWxlc1xyXG5cdFx0dGhpcy5faW5pdENvbnRhaW5lcigpO1xyXG5cclxuXHRcdC8vIHNldCB1cCBldmVudHNcclxuXHRcdG1hcC5vbih7XHJcblx0XHRcdCd2aWV3cmVzZXQnOiB0aGlzLl9yZXNldCxcclxuXHRcdFx0J21vdmVlbmQnOiB0aGlzLl91cGRhdGVcclxuXHRcdH0sIHRoaXMpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9hbmltYXRlZCkge1xyXG5cdFx0XHRtYXAub24oe1xyXG5cdFx0XHRcdCd6b29tYW5pbSc6IHRoaXMuX2FuaW1hdGVab29tLFxyXG5cdFx0XHRcdCd6b29tZW5kJzogdGhpcy5fZW5kWm9vbUFuaW1cclxuXHRcdFx0fSwgdGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMudXBkYXRlV2hlbklkbGUpIHtcclxuXHRcdFx0dGhpcy5fbGltaXRlZFVwZGF0ZSA9IEwuVXRpbC5saW1pdEV4ZWNCeUludGVydmFsKHRoaXMuX3VwZGF0ZSwgMTUwLCB0aGlzKTtcclxuXHRcdFx0bWFwLm9uKCdtb3ZlJywgdGhpcy5fbGltaXRlZFVwZGF0ZSwgdGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fcmVzZXQoKTtcclxuXHRcdHRoaXMuX3VwZGF0ZSgpO1xyXG5cdH0sXHJcblxyXG5cdGFkZFRvOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHRtYXAuYWRkTGF5ZXIodGhpcyk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRvblJlbW92ZTogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0dGhpcy5fY29udGFpbmVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcclxuXHJcblx0XHRtYXAub2ZmKHtcclxuXHRcdFx0J3ZpZXdyZXNldCc6IHRoaXMuX3Jlc2V0LFxyXG5cdFx0XHQnbW92ZWVuZCc6IHRoaXMuX3VwZGF0ZVxyXG5cdFx0fSwgdGhpcyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuX2FuaW1hdGVkKSB7XHJcblx0XHRcdG1hcC5vZmYoe1xyXG5cdFx0XHRcdCd6b29tYW5pbSc6IHRoaXMuX2FuaW1hdGVab29tLFxyXG5cdFx0XHRcdCd6b29tZW5kJzogdGhpcy5fZW5kWm9vbUFuaW1cclxuXHRcdFx0fSwgdGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMudXBkYXRlV2hlbklkbGUpIHtcclxuXHRcdFx0bWFwLm9mZignbW92ZScsIHRoaXMuX2xpbWl0ZWRVcGRhdGUsIHRoaXMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2NvbnRhaW5lciA9IG51bGw7XHJcblx0XHR0aGlzLl9tYXAgPSBudWxsO1xyXG5cdH0sXHJcblxyXG5cdGJyaW5nVG9Gcm9udDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHBhbmUgPSB0aGlzLl9tYXAuX3BhbmVzLnRpbGVQYW5lO1xyXG5cclxuXHRcdGlmICh0aGlzLl9jb250YWluZXIpIHtcclxuXHRcdFx0cGFuZS5hcHBlbmRDaGlsZCh0aGlzLl9jb250YWluZXIpO1xyXG5cdFx0XHR0aGlzLl9zZXRBdXRvWkluZGV4KHBhbmUsIE1hdGgubWF4KTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRicmluZ1RvQmFjazogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHBhbmUgPSB0aGlzLl9tYXAuX3BhbmVzLnRpbGVQYW5lO1xyXG5cclxuXHRcdGlmICh0aGlzLl9jb250YWluZXIpIHtcclxuXHRcdFx0cGFuZS5pbnNlcnRCZWZvcmUodGhpcy5fY29udGFpbmVyLCBwYW5lLmZpcnN0Q2hpbGQpO1xyXG5cdFx0XHR0aGlzLl9zZXRBdXRvWkluZGV4KHBhbmUsIE1hdGgubWluKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRnZXRBdHRyaWJ1dGlvbjogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMub3B0aW9ucy5hdHRyaWJ1dGlvbjtcclxuXHR9LFxyXG5cclxuXHRnZXRDb250YWluZXI6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9jb250YWluZXI7XHJcblx0fSxcclxuXHJcblx0c2V0T3BhY2l0eTogZnVuY3Rpb24gKG9wYWNpdHkpIHtcclxuXHRcdHRoaXMub3B0aW9ucy5vcGFjaXR5ID0gb3BhY2l0eTtcclxuXHJcblx0XHRpZiAodGhpcy5fbWFwKSB7XHJcblx0XHRcdHRoaXMuX3VwZGF0ZU9wYWNpdHkoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRzZXRaSW5kZXg6IGZ1bmN0aW9uICh6SW5kZXgpIHtcclxuXHRcdHRoaXMub3B0aW9ucy56SW5kZXggPSB6SW5kZXg7XHJcblx0XHR0aGlzLl91cGRhdGVaSW5kZXgoKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRzZXRVcmw6IGZ1bmN0aW9uICh1cmwsIG5vUmVkcmF3KSB7XHJcblx0XHR0aGlzLl91cmwgPSB1cmw7XHJcblxyXG5cdFx0aWYgKCFub1JlZHJhdykge1xyXG5cdFx0XHR0aGlzLnJlZHJhdygpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdHJlZHJhdzogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKHRoaXMuX21hcCkge1xyXG5cdFx0XHR0aGlzLl9yZXNldCh7aGFyZDogdHJ1ZX0pO1xyXG5cdFx0XHR0aGlzLl91cGRhdGUoKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdF91cGRhdGVaSW5kZXg6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICh0aGlzLl9jb250YWluZXIgJiYgdGhpcy5vcHRpb25zLnpJbmRleCAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHRoaXMuX2NvbnRhaW5lci5zdHlsZS56SW5kZXggPSB0aGlzLm9wdGlvbnMuekluZGV4O1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9zZXRBdXRvWkluZGV4OiBmdW5jdGlvbiAocGFuZSwgY29tcGFyZSkge1xyXG5cclxuXHRcdHZhciBsYXllcnMgPSBwYW5lLmNoaWxkcmVuLFxyXG5cdFx0ICAgIGVkZ2VaSW5kZXggPSAtY29tcGFyZShJbmZpbml0eSwgLUluZmluaXR5KSwgLy8gLUluZmluaXR5IGZvciBtYXgsIEluZmluaXR5IGZvciBtaW5cclxuXHRcdCAgICB6SW5kZXgsIGksIGxlbjtcclxuXHJcblx0XHRmb3IgKGkgPSAwLCBsZW4gPSBsYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHJcblx0XHRcdGlmIChsYXllcnNbaV0gIT09IHRoaXMuX2NvbnRhaW5lcikge1xyXG5cdFx0XHRcdHpJbmRleCA9IHBhcnNlSW50KGxheWVyc1tpXS5zdHlsZS56SW5kZXgsIDEwKTtcclxuXHJcblx0XHRcdFx0aWYgKCFpc05hTih6SW5kZXgpKSB7XHJcblx0XHRcdFx0XHRlZGdlWkluZGV4ID0gY29tcGFyZShlZGdlWkluZGV4LCB6SW5kZXgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMub3B0aW9ucy56SW5kZXggPSB0aGlzLl9jb250YWluZXIuc3R5bGUuekluZGV4ID1cclxuXHRcdCAgICAgICAgKGlzRmluaXRlKGVkZ2VaSW5kZXgpID8gZWRnZVpJbmRleCA6IDApICsgY29tcGFyZSgxLCAtMSk7XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZU9wYWNpdHk6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBpLFxyXG5cdFx0ICAgIHRpbGVzID0gdGhpcy5fdGlsZXM7XHJcblxyXG5cdFx0aWYgKEwuQnJvd3Nlci5pZWx0OSkge1xyXG5cdFx0XHRmb3IgKGkgaW4gdGlsZXMpIHtcclxuXHRcdFx0XHRMLkRvbVV0aWwuc2V0T3BhY2l0eSh0aWxlc1tpXSwgdGhpcy5vcHRpb25zLm9wYWNpdHkpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRMLkRvbVV0aWwuc2V0T3BhY2l0eSh0aGlzLl9jb250YWluZXIsIHRoaXMub3B0aW9ucy5vcGFjaXR5KTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfaW5pdENvbnRhaW5lcjogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHRpbGVQYW5lID0gdGhpcy5fbWFwLl9wYW5lcy50aWxlUGFuZTtcclxuXHJcblx0XHRpZiAoIXRoaXMuX2NvbnRhaW5lcikge1xyXG5cdFx0XHR0aGlzLl9jb250YWluZXIgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnbGVhZmxldC1sYXllcicpO1xyXG5cclxuXHRcdFx0dGhpcy5fdXBkYXRlWkluZGV4KCk7XHJcblxyXG5cdFx0XHRpZiAodGhpcy5fYW5pbWF0ZWQpIHtcclxuXHRcdFx0XHR2YXIgY2xhc3NOYW1lID0gJ2xlYWZsZXQtdGlsZS1jb250YWluZXInO1xyXG5cclxuXHRcdFx0XHR0aGlzLl9iZ0J1ZmZlciA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsIGNsYXNzTmFtZSwgdGhpcy5fY29udGFpbmVyKTtcclxuXHRcdFx0XHR0aGlzLl90aWxlQ29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgY2xhc3NOYW1lLCB0aGlzLl9jb250YWluZXIpO1xyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl90aWxlQ29udGFpbmVyID0gdGhpcy5fY29udGFpbmVyO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aWxlUGFuZS5hcHBlbmRDaGlsZCh0aGlzLl9jb250YWluZXIpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5vcGFjaXR5IDwgMSkge1xyXG5cdFx0XHRcdHRoaXMuX3VwZGF0ZU9wYWNpdHkoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9yZXNldDogZnVuY3Rpb24gKGUpIHtcclxuXHRcdGZvciAodmFyIGtleSBpbiB0aGlzLl90aWxlcykge1xyXG5cdFx0XHR0aGlzLmZpcmUoJ3RpbGV1bmxvYWQnLCB7dGlsZTogdGhpcy5fdGlsZXNba2V5XX0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3RpbGVzID0ge307XHJcblx0XHR0aGlzLl90aWxlc1RvTG9hZCA9IDA7XHJcblxyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5yZXVzZVRpbGVzKSB7XHJcblx0XHRcdHRoaXMuX3VudXNlZFRpbGVzID0gW107XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fdGlsZUNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuXHJcblx0XHRpZiAodGhpcy5fYW5pbWF0ZWQgJiYgZSAmJiBlLmhhcmQpIHtcclxuXHRcdFx0dGhpcy5fY2xlYXJCZ0J1ZmZlcigpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2luaXRDb250YWluZXIoKTtcclxuXHR9LFxyXG5cclxuXHRfZ2V0VGlsZVNpemU6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXAsXHJcblx0XHQgICAgem9vbSA9IG1hcC5nZXRab29tKCkgKyB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCxcclxuXHRcdCAgICB6b29tTiA9IHRoaXMub3B0aW9ucy5tYXhOYXRpdmVab29tLFxyXG5cdFx0ICAgIHRpbGVTaXplID0gdGhpcy5vcHRpb25zLnRpbGVTaXplO1xyXG5cclxuXHRcdGlmICh6b29tTiAmJiB6b29tID4gem9vbU4pIHtcclxuXHRcdFx0dGlsZVNpemUgPSBNYXRoLnJvdW5kKG1hcC5nZXRab29tU2NhbGUoem9vbSkgLyBtYXAuZ2V0Wm9vbVNjYWxlKHpvb21OKSAqIHRpbGVTaXplKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGlsZVNpemU7XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGlmICghdGhpcy5fbWFwKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXAsXHJcblx0XHQgICAgYm91bmRzID0gbWFwLmdldFBpeGVsQm91bmRzKCksXHJcblx0XHQgICAgem9vbSA9IG1hcC5nZXRab29tKCksXHJcblx0XHQgICAgdGlsZVNpemUgPSB0aGlzLl9nZXRUaWxlU2l6ZSgpO1xyXG5cclxuXHRcdGlmICh6b29tID4gdGhpcy5vcHRpb25zLm1heFpvb20gfHwgem9vbSA8IHRoaXMub3B0aW9ucy5taW5ab29tKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgdGlsZUJvdW5kcyA9IEwuYm91bmRzKFxyXG5cdFx0ICAgICAgICBib3VuZHMubWluLmRpdmlkZUJ5KHRpbGVTaXplKS5fZmxvb3IoKSxcclxuXHRcdCAgICAgICAgYm91bmRzLm1heC5kaXZpZGVCeSh0aWxlU2l6ZSkuX2Zsb29yKCkpO1xyXG5cclxuXHRcdHRoaXMuX2FkZFRpbGVzRnJvbUNlbnRlck91dCh0aWxlQm91bmRzKTtcclxuXHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnVubG9hZEludmlzaWJsZVRpbGVzIHx8IHRoaXMub3B0aW9ucy5yZXVzZVRpbGVzKSB7XHJcblx0XHRcdHRoaXMuX3JlbW92ZU90aGVyVGlsZXModGlsZUJvdW5kcyk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X2FkZFRpbGVzRnJvbUNlbnRlck91dDogZnVuY3Rpb24gKGJvdW5kcykge1xyXG5cdFx0dmFyIHF1ZXVlID0gW10sXHJcblx0XHQgICAgY2VudGVyID0gYm91bmRzLmdldENlbnRlcigpO1xyXG5cclxuXHRcdHZhciBqLCBpLCBwb2ludDtcclxuXHJcblx0XHRmb3IgKGogPSBib3VuZHMubWluLnk7IGogPD0gYm91bmRzLm1heC55OyBqKyspIHtcclxuXHRcdFx0Zm9yIChpID0gYm91bmRzLm1pbi54OyBpIDw9IGJvdW5kcy5tYXgueDsgaSsrKSB7XHJcblx0XHRcdFx0cG9pbnQgPSBuZXcgTC5Qb2ludChpLCBqKTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3RpbGVTaG91bGRCZUxvYWRlZChwb2ludCkpIHtcclxuXHRcdFx0XHRcdHF1ZXVlLnB1c2gocG9pbnQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHZhciB0aWxlc1RvTG9hZCA9IHF1ZXVlLmxlbmd0aDtcclxuXHJcblx0XHRpZiAodGlsZXNUb0xvYWQgPT09IDApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0Ly8gbG9hZCB0aWxlcyBpbiBvcmRlciBvZiB0aGVpciBkaXN0YW5jZSB0byBjZW50ZXJcclxuXHRcdHF1ZXVlLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuXHRcdFx0cmV0dXJuIGEuZGlzdGFuY2VUbyhjZW50ZXIpIC0gYi5kaXN0YW5jZVRvKGNlbnRlcik7XHJcblx0XHR9KTtcclxuXHJcblx0XHR2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XHJcblxyXG5cdFx0Ly8gaWYgaXRzIHRoZSBmaXJzdCBiYXRjaCBvZiB0aWxlcyB0byBsb2FkXHJcblx0XHRpZiAoIXRoaXMuX3RpbGVzVG9Mb2FkKSB7XHJcblx0XHRcdHRoaXMuZmlyZSgnbG9hZGluZycpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3RpbGVzVG9Mb2FkICs9IHRpbGVzVG9Mb2FkO1xyXG5cclxuXHRcdGZvciAoaSA9IDA7IGkgPCB0aWxlc1RvTG9hZDsgaSsrKSB7XHJcblx0XHRcdHRoaXMuX2FkZFRpbGUocXVldWVbaV0sIGZyYWdtZW50KTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl90aWxlQ29udGFpbmVyLmFwcGVuZENoaWxkKGZyYWdtZW50KTtcclxuXHR9LFxyXG5cclxuXHRfdGlsZVNob3VsZEJlTG9hZGVkOiBmdW5jdGlvbiAodGlsZVBvaW50KSB7XHJcblx0XHRpZiAoKHRpbGVQb2ludC54ICsgJzonICsgdGlsZVBvaW50LnkpIGluIHRoaXMuX3RpbGVzKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gYWxyZWFkeSBsb2FkZWRcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcclxuXHJcblx0XHRpZiAoIW9wdGlvbnMuY29udGludW91c1dvcmxkKSB7XHJcblx0XHRcdHZhciBsaW1pdCA9IHRoaXMuX2dldFdyYXBUaWxlTnVtKCk7XHJcblxyXG5cdFx0XHQvLyBkb24ndCBsb2FkIGlmIGV4Y2VlZHMgd29ybGQgYm91bmRzXHJcblx0XHRcdGlmICgob3B0aW9ucy5ub1dyYXAgJiYgKHRpbGVQb2ludC54IDwgMCB8fCB0aWxlUG9pbnQueCA+PSBsaW1pdC54KSkgfHxcclxuXHRcdFx0XHR0aWxlUG9pbnQueSA8IDAgfHwgdGlsZVBvaW50LnkgPj0gbGltaXQueSkgeyByZXR1cm4gZmFsc2U7IH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAob3B0aW9ucy5ib3VuZHMpIHtcclxuXHRcdFx0dmFyIHRpbGVTaXplID0gb3B0aW9ucy50aWxlU2l6ZSxcclxuXHRcdFx0ICAgIG53UG9pbnQgPSB0aWxlUG9pbnQubXVsdGlwbHlCeSh0aWxlU2l6ZSksXHJcblx0XHRcdCAgICBzZVBvaW50ID0gbndQb2ludC5hZGQoW3RpbGVTaXplLCB0aWxlU2l6ZV0pLFxyXG5cdFx0XHQgICAgbncgPSB0aGlzLl9tYXAudW5wcm9qZWN0KG53UG9pbnQpLFxyXG5cdFx0XHQgICAgc2UgPSB0aGlzLl9tYXAudW5wcm9qZWN0KHNlUG9pbnQpO1xyXG5cclxuXHRcdFx0Ly8gVE9ETyB0ZW1wb3JhcnkgaGFjaywgd2lsbCBiZSByZW1vdmVkIGFmdGVyIHJlZmFjdG9yaW5nIHByb2plY3Rpb25zXHJcblx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9MZWFmbGV0L0xlYWZsZXQvaXNzdWVzLzE2MThcclxuXHRcdFx0aWYgKCFvcHRpb25zLmNvbnRpbnVvdXNXb3JsZCAmJiAhb3B0aW9ucy5ub1dyYXApIHtcclxuXHRcdFx0XHRudyA9IG53LndyYXAoKTtcclxuXHRcdFx0XHRzZSA9IHNlLndyYXAoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCFvcHRpb25zLmJvdW5kcy5pbnRlcnNlY3RzKFtudywgc2VdKSkgeyByZXR1cm4gZmFsc2U7IH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9LFxyXG5cclxuXHRfcmVtb3ZlT3RoZXJUaWxlczogZnVuY3Rpb24gKGJvdW5kcykge1xyXG5cdFx0dmFyIGtBcnIsIHgsIHksIGtleTtcclxuXHJcblx0XHRmb3IgKGtleSBpbiB0aGlzLl90aWxlcykge1xyXG5cdFx0XHRrQXJyID0ga2V5LnNwbGl0KCc6Jyk7XHJcblx0XHRcdHggPSBwYXJzZUludChrQXJyWzBdLCAxMCk7XHJcblx0XHRcdHkgPSBwYXJzZUludChrQXJyWzFdLCAxMCk7XHJcblxyXG5cdFx0XHQvLyByZW1vdmUgdGlsZSBpZiBpdCdzIG91dCBvZiBib3VuZHNcclxuXHRcdFx0aWYgKHggPCBib3VuZHMubWluLnggfHwgeCA+IGJvdW5kcy5tYXgueCB8fCB5IDwgYm91bmRzLm1pbi55IHx8IHkgPiBib3VuZHMubWF4LnkpIHtcclxuXHRcdFx0XHR0aGlzLl9yZW1vdmVUaWxlKGtleSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfcmVtb3ZlVGlsZTogZnVuY3Rpb24gKGtleSkge1xyXG5cdFx0dmFyIHRpbGUgPSB0aGlzLl90aWxlc1trZXldO1xyXG5cclxuXHRcdHRoaXMuZmlyZSgndGlsZXVubG9hZCcsIHt0aWxlOiB0aWxlLCB1cmw6IHRpbGUuc3JjfSk7XHJcblxyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5yZXVzZVRpbGVzKSB7XHJcblx0XHRcdEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aWxlLCAnbGVhZmxldC10aWxlLWxvYWRlZCcpO1xyXG5cdFx0XHR0aGlzLl91bnVzZWRUaWxlcy5wdXNoKHRpbGUpO1xyXG5cclxuXHRcdH0gZWxzZSBpZiAodGlsZS5wYXJlbnROb2RlID09PSB0aGlzLl90aWxlQ29udGFpbmVyKSB7XHJcblx0XHRcdHRoaXMuX3RpbGVDb250YWluZXIucmVtb3ZlQ2hpbGQodGlsZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9DbG91ZE1hZGUvTGVhZmxldC9pc3N1ZXMvMTM3XHJcblx0XHRpZiAoIUwuQnJvd3Nlci5hbmRyb2lkKSB7XHJcblx0XHRcdHRpbGUub25sb2FkID0gbnVsbDtcclxuXHRcdFx0dGlsZS5zcmMgPSBMLlV0aWwuZW1wdHlJbWFnZVVybDtcclxuXHRcdH1cclxuXHJcblx0XHRkZWxldGUgdGhpcy5fdGlsZXNba2V5XTtcclxuXHR9LFxyXG5cclxuXHRfYWRkVGlsZTogZnVuY3Rpb24gKHRpbGVQb2ludCwgY29udGFpbmVyKSB7XHJcblx0XHR2YXIgdGlsZVBvcyA9IHRoaXMuX2dldFRpbGVQb3ModGlsZVBvaW50KTtcclxuXHJcblx0XHQvLyBnZXQgdW51c2VkIHRpbGUgLSBvciBjcmVhdGUgYSBuZXcgdGlsZVxyXG5cdFx0dmFyIHRpbGUgPSB0aGlzLl9nZXRUaWxlKCk7XHJcblxyXG5cdFx0LypcclxuXHRcdENocm9tZSAyMCBsYXlvdXRzIG11Y2ggZmFzdGVyIHdpdGggdG9wL2xlZnQgKHZlcmlmeSB3aXRoIHRpbWVsaW5lLCBmcmFtZXMpXHJcblx0XHRBbmRyb2lkIDQgYnJvd3NlciBoYXMgZGlzcGxheSBpc3N1ZXMgd2l0aCB0b3AvbGVmdCBhbmQgcmVxdWlyZXMgdHJhbnNmb3JtIGluc3RlYWRcclxuXHRcdChvdGhlciBicm93c2VycyBkb24ndCBjdXJyZW50bHkgY2FyZSkgLSBzZWUgZGVidWcvaGFja3Mvaml0dGVyLmh0bWwgZm9yIGFuIGV4YW1wbGVcclxuXHRcdCovXHJcblx0XHRMLkRvbVV0aWwuc2V0UG9zaXRpb24odGlsZSwgdGlsZVBvcywgTC5Ccm93c2VyLmNocm9tZSk7XHJcblxyXG5cdFx0dGhpcy5fdGlsZXNbdGlsZVBvaW50LnggKyAnOicgKyB0aWxlUG9pbnQueV0gPSB0aWxlO1xyXG5cclxuXHRcdHRoaXMuX2xvYWRUaWxlKHRpbGUsIHRpbGVQb2ludCk7XHJcblxyXG5cdFx0aWYgKHRpbGUucGFyZW50Tm9kZSAhPT0gdGhpcy5fdGlsZUNvbnRhaW5lcikge1xyXG5cdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGlsZSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X2dldFpvb21Gb3JVcmw6IGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHR2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucyxcclxuXHRcdCAgICB6b29tID0gdGhpcy5fbWFwLmdldFpvb20oKTtcclxuXHJcblx0XHRpZiAob3B0aW9ucy56b29tUmV2ZXJzZSkge1xyXG5cdFx0XHR6b29tID0gb3B0aW9ucy5tYXhab29tIC0gem9vbTtcclxuXHRcdH1cclxuXHJcblx0XHR6b29tICs9IG9wdGlvbnMuem9vbU9mZnNldDtcclxuXHJcblx0XHRyZXR1cm4gb3B0aW9ucy5tYXhOYXRpdmVab29tID8gTWF0aC5taW4oem9vbSwgb3B0aW9ucy5tYXhOYXRpdmVab29tKSA6IHpvb207XHJcblx0fSxcclxuXHJcblx0X2dldFRpbGVQb3M6IGZ1bmN0aW9uICh0aWxlUG9pbnQpIHtcclxuXHRcdHZhciBvcmlnaW4gPSB0aGlzLl9tYXAuZ2V0UGl4ZWxPcmlnaW4oKSxcclxuXHRcdCAgICB0aWxlU2l6ZSA9IHRoaXMuX2dldFRpbGVTaXplKCk7XHJcblxyXG5cdFx0cmV0dXJuIHRpbGVQb2ludC5tdWx0aXBseUJ5KHRpbGVTaXplKS5zdWJ0cmFjdChvcmlnaW4pO1xyXG5cdH0sXHJcblxyXG5cdC8vIGltYWdlLXNwZWNpZmljIGNvZGUgKG92ZXJyaWRlIHRvIGltcGxlbWVudCBlLmcuIENhbnZhcyBvciBTVkcgdGlsZSBsYXllcilcclxuXHJcblx0Z2V0VGlsZVVybDogZnVuY3Rpb24gKHRpbGVQb2ludCkge1xyXG5cdFx0cmV0dXJuIEwuVXRpbC50ZW1wbGF0ZSh0aGlzLl91cmwsIEwuZXh0ZW5kKHtcclxuXHRcdFx0czogdGhpcy5fZ2V0U3ViZG9tYWluKHRpbGVQb2ludCksXHJcblx0XHRcdHo6IHRpbGVQb2ludC56LFxyXG5cdFx0XHR4OiB0aWxlUG9pbnQueCxcclxuXHRcdFx0eTogdGlsZVBvaW50LnlcclxuXHRcdH0sIHRoaXMub3B0aW9ucykpO1xyXG5cdH0sXHJcblxyXG5cdF9nZXRXcmFwVGlsZU51bTogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIGNycyA9IHRoaXMuX21hcC5vcHRpb25zLmNycyxcclxuXHRcdCAgICBzaXplID0gY3JzLmdldFNpemUodGhpcy5fbWFwLmdldFpvb20oKSk7XHJcblx0XHRyZXR1cm4gc2l6ZS5kaXZpZGVCeSh0aGlzLl9nZXRUaWxlU2l6ZSgpKS5fZmxvb3IoKTtcclxuXHR9LFxyXG5cclxuXHRfYWRqdXN0VGlsZVBvaW50OiBmdW5jdGlvbiAodGlsZVBvaW50KSB7XHJcblxyXG5cdFx0dmFyIGxpbWl0ID0gdGhpcy5fZ2V0V3JhcFRpbGVOdW0oKTtcclxuXHJcblx0XHQvLyB3cmFwIHRpbGUgY29vcmRpbmF0ZXNcclxuXHRcdGlmICghdGhpcy5vcHRpb25zLmNvbnRpbnVvdXNXb3JsZCAmJiAhdGhpcy5vcHRpb25zLm5vV3JhcCkge1xyXG5cdFx0XHR0aWxlUG9pbnQueCA9ICgodGlsZVBvaW50LnggJSBsaW1pdC54KSArIGxpbWl0LngpICUgbGltaXQueDtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnRtcykge1xyXG5cdFx0XHR0aWxlUG9pbnQueSA9IGxpbWl0LnkgLSB0aWxlUG9pbnQueSAtIDE7XHJcblx0XHR9XHJcblxyXG5cdFx0dGlsZVBvaW50LnogPSB0aGlzLl9nZXRab29tRm9yVXJsKCk7XHJcblx0fSxcclxuXHJcblx0X2dldFN1YmRvbWFpbjogZnVuY3Rpb24gKHRpbGVQb2ludCkge1xyXG5cdFx0dmFyIGluZGV4ID0gTWF0aC5hYnModGlsZVBvaW50LnggKyB0aWxlUG9pbnQueSkgJSB0aGlzLm9wdGlvbnMuc3ViZG9tYWlucy5sZW5ndGg7XHJcblx0XHRyZXR1cm4gdGhpcy5vcHRpb25zLnN1YmRvbWFpbnNbaW5kZXhdO1xyXG5cdH0sXHJcblxyXG5cdF9nZXRUaWxlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnJldXNlVGlsZXMgJiYgdGhpcy5fdW51c2VkVGlsZXMubGVuZ3RoID4gMCkge1xyXG5cdFx0XHR2YXIgdGlsZSA9IHRoaXMuX3VudXNlZFRpbGVzLnBvcCgpO1xyXG5cdFx0XHR0aGlzLl9yZXNldFRpbGUodGlsZSk7XHJcblx0XHRcdHJldHVybiB0aWxlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZVRpbGUoKTtcclxuXHR9LFxyXG5cclxuXHQvLyBPdmVycmlkZSBpZiBkYXRhIHN0b3JlZCBvbiBhIHRpbGUgbmVlZHMgdG8gYmUgY2xlYW5lZCB1cCBiZWZvcmUgcmV1c2VcclxuXHRfcmVzZXRUaWxlOiBmdW5jdGlvbiAoLyp0aWxlKi8pIHt9LFxyXG5cclxuXHRfY3JlYXRlVGlsZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHRpbGUgPSBMLkRvbVV0aWwuY3JlYXRlKCdpbWcnLCAnbGVhZmxldC10aWxlJyk7XHJcblx0XHR0aWxlLnN0eWxlLndpZHRoID0gdGlsZS5zdHlsZS5oZWlnaHQgPSB0aGlzLl9nZXRUaWxlU2l6ZSgpICsgJ3B4JztcclxuXHRcdHRpbGUuZ2FsbGVyeWltZyA9ICdubyc7XHJcblxyXG5cdFx0dGlsZS5vbnNlbGVjdHN0YXJ0ID0gdGlsZS5vbm1vdXNlbW92ZSA9IEwuVXRpbC5mYWxzZUZuO1xyXG5cclxuXHRcdGlmIChMLkJyb3dzZXIuaWVsdDkgJiYgdGhpcy5vcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRMLkRvbVV0aWwuc2V0T3BhY2l0eSh0aWxlLCB0aGlzLm9wdGlvbnMub3BhY2l0eSk7XHJcblx0XHR9XHJcblx0XHQvLyB3aXRob3V0IHRoaXMgaGFjaywgdGlsZXMgZGlzYXBwZWFyIGFmdGVyIHpvb20gb24gQ2hyb21lIGZvciBBbmRyb2lkXHJcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vTGVhZmxldC9MZWFmbGV0L2lzc3Vlcy8yMDc4XHJcblx0XHRpZiAoTC5Ccm93c2VyLm1vYmlsZVdlYmtpdDNkKSB7XHJcblx0XHRcdHRpbGUuc3R5bGUuV2Via2l0QmFja2ZhY2VWaXNpYmlsaXR5ID0gJ2hpZGRlbic7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGlsZTtcclxuXHR9LFxyXG5cclxuXHRfbG9hZFRpbGU6IGZ1bmN0aW9uICh0aWxlLCB0aWxlUG9pbnQpIHtcclxuXHRcdHRpbGUuX2xheWVyICA9IHRoaXM7XHJcblx0XHR0aWxlLm9ubG9hZCAgPSB0aGlzLl90aWxlT25Mb2FkO1xyXG5cdFx0dGlsZS5vbmVycm9yID0gdGhpcy5fdGlsZU9uRXJyb3I7XHJcblxyXG5cdFx0dGhpcy5fYWRqdXN0VGlsZVBvaW50KHRpbGVQb2ludCk7XHJcblx0XHR0aWxlLnNyYyAgICAgPSB0aGlzLmdldFRpbGVVcmwodGlsZVBvaW50KTtcclxuXHJcblx0XHR0aGlzLmZpcmUoJ3RpbGVsb2Fkc3RhcnQnLCB7XHJcblx0XHRcdHRpbGU6IHRpbGUsXHJcblx0XHRcdHVybDogdGlsZS5zcmNcclxuXHRcdH0pO1xyXG5cdH0sXHJcblxyXG5cdF90aWxlTG9hZGVkOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLl90aWxlc1RvTG9hZC0tO1xyXG5cclxuXHRcdGlmICh0aGlzLl9hbmltYXRlZCkge1xyXG5cdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fdGlsZUNvbnRhaW5lciwgJ2xlYWZsZXQtem9vbS1hbmltYXRlZCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghdGhpcy5fdGlsZXNUb0xvYWQpIHtcclxuXHRcdFx0dGhpcy5maXJlKCdsb2FkJyk7XHJcblxyXG5cdFx0XHRpZiAodGhpcy5fYW5pbWF0ZWQpIHtcclxuXHRcdFx0XHQvLyBjbGVhciBzY2FsZWQgdGlsZXMgYWZ0ZXIgYWxsIG5ldyB0aWxlcyBhcmUgbG9hZGVkIChmb3IgcGVyZm9ybWFuY2UpXHJcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX2NsZWFyQmdCdWZmZXJUaW1lcik7XHJcblx0XHRcdFx0dGhpcy5fY2xlYXJCZ0J1ZmZlclRpbWVyID0gc2V0VGltZW91dChMLmJpbmQodGhpcy5fY2xlYXJCZ0J1ZmZlciwgdGhpcyksIDUwMCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfdGlsZU9uTG9hZDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIGxheWVyID0gdGhpcy5fbGF5ZXI7XHJcblxyXG5cdFx0Ly9Pbmx5IGlmIHdlIGFyZSBsb2FkaW5nIGFuIGFjdHVhbCBpbWFnZVxyXG5cdFx0aWYgKHRoaXMuc3JjICE9PSBMLlV0aWwuZW1wdHlJbWFnZVVybCkge1xyXG5cdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcywgJ2xlYWZsZXQtdGlsZS1sb2FkZWQnKTtcclxuXHJcblx0XHRcdGxheWVyLmZpcmUoJ3RpbGVsb2FkJywge1xyXG5cdFx0XHRcdHRpbGU6IHRoaXMsXHJcblx0XHRcdFx0dXJsOiB0aGlzLnNyY1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHRsYXllci5fdGlsZUxvYWRlZCgpO1xyXG5cdH0sXHJcblxyXG5cdF90aWxlT25FcnJvcjogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIGxheWVyID0gdGhpcy5fbGF5ZXI7XHJcblxyXG5cdFx0bGF5ZXIuZmlyZSgndGlsZWVycm9yJywge1xyXG5cdFx0XHR0aWxlOiB0aGlzLFxyXG5cdFx0XHR1cmw6IHRoaXMuc3JjXHJcblx0XHR9KTtcclxuXHJcblx0XHR2YXIgbmV3VXJsID0gbGF5ZXIub3B0aW9ucy5lcnJvclRpbGVVcmw7XHJcblx0XHRpZiAobmV3VXJsKSB7XHJcblx0XHRcdHRoaXMuc3JjID0gbmV3VXJsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxheWVyLl90aWxlTG9hZGVkKCk7XHJcblx0fVxyXG59KTtcclxuXHJcbkwudGlsZUxheWVyID0gZnVuY3Rpb24gKHVybCwgb3B0aW9ucykge1xyXG5cdHJldHVybiBuZXcgTC5UaWxlTGF5ZXIodXJsLCBvcHRpb25zKTtcclxufTtcclxuXG5cbi8qXHJcbiAqIEwuVGlsZUxheWVyLldNUyBpcyB1c2VkIGZvciBwdXR0aW5nIFdNUyB0aWxlIGxheWVycyBvbiB0aGUgbWFwLlxyXG4gKi9cclxuXHJcbkwuVGlsZUxheWVyLldNUyA9IEwuVGlsZUxheWVyLmV4dGVuZCh7XHJcblxyXG5cdGRlZmF1bHRXbXNQYXJhbXM6IHtcclxuXHRcdHNlcnZpY2U6ICdXTVMnLFxyXG5cdFx0cmVxdWVzdDogJ0dldE1hcCcsXHJcblx0XHR2ZXJzaW9uOiAnMS4xLjEnLFxyXG5cdFx0bGF5ZXJzOiAnJyxcclxuXHRcdHN0eWxlczogJycsXHJcblx0XHRmb3JtYXQ6ICdpbWFnZS9qcGVnJyxcclxuXHRcdHRyYW5zcGFyZW50OiBmYWxzZVxyXG5cdH0sXHJcblxyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uICh1cmwsIG9wdGlvbnMpIHsgLy8gKFN0cmluZywgT2JqZWN0KVxyXG5cclxuXHRcdHRoaXMuX3VybCA9IHVybDtcclxuXHJcblx0XHR2YXIgd21zUGFyYW1zID0gTC5leHRlbmQoe30sIHRoaXMuZGVmYXVsdFdtc1BhcmFtcyksXHJcblx0XHQgICAgdGlsZVNpemUgPSBvcHRpb25zLnRpbGVTaXplIHx8IHRoaXMub3B0aW9ucy50aWxlU2l6ZTtcclxuXHJcblx0XHRpZiAob3B0aW9ucy5kZXRlY3RSZXRpbmEgJiYgTC5Ccm93c2VyLnJldGluYSkge1xyXG5cdFx0XHR3bXNQYXJhbXMud2lkdGggPSB3bXNQYXJhbXMuaGVpZ2h0ID0gdGlsZVNpemUgKiAyO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0d21zUGFyYW1zLndpZHRoID0gd21zUGFyYW1zLmhlaWdodCA9IHRpbGVTaXplO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAodmFyIGkgaW4gb3B0aW9ucykge1xyXG5cdFx0XHQvLyBhbGwga2V5cyB0aGF0IGFyZSBub3QgVGlsZUxheWVyIG9wdGlvbnMgZ28gdG8gV01TIHBhcmFtc1xyXG5cdFx0XHRpZiAoIXRoaXMub3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShpKSAmJiBpICE9PSAnY3JzJykge1xyXG5cdFx0XHRcdHdtc1BhcmFtc1tpXSA9IG9wdGlvbnNbaV07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLndtc1BhcmFtcyA9IHdtc1BhcmFtcztcclxuXHJcblx0XHRMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblx0fSxcclxuXHJcblx0b25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcclxuXHJcblx0XHR0aGlzLl9jcnMgPSB0aGlzLm9wdGlvbnMuY3JzIHx8IG1hcC5vcHRpb25zLmNycztcclxuXHJcblx0XHR0aGlzLl93bXNWZXJzaW9uID0gcGFyc2VGbG9hdCh0aGlzLndtc1BhcmFtcy52ZXJzaW9uKTtcclxuXHJcblx0XHR2YXIgcHJvamVjdGlvbktleSA9IHRoaXMuX3dtc1ZlcnNpb24gPj0gMS4zID8gJ2NycycgOiAnc3JzJztcclxuXHRcdHRoaXMud21zUGFyYW1zW3Byb2plY3Rpb25LZXldID0gdGhpcy5fY3JzLmNvZGU7XHJcblxyXG5cdFx0TC5UaWxlTGF5ZXIucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcclxuXHR9LFxyXG5cclxuXHRnZXRUaWxlVXJsOiBmdW5jdGlvbiAodGlsZVBvaW50KSB7IC8vIChQb2ludCwgTnVtYmVyKSAtPiBTdHJpbmdcclxuXHJcblx0XHR2YXIgbWFwID0gdGhpcy5fbWFwLFxyXG5cdFx0ICAgIHRpbGVTaXplID0gdGhpcy5vcHRpb25zLnRpbGVTaXplLFxyXG5cclxuXHRcdCAgICBud1BvaW50ID0gdGlsZVBvaW50Lm11bHRpcGx5QnkodGlsZVNpemUpLFxyXG5cdFx0ICAgIHNlUG9pbnQgPSBud1BvaW50LmFkZChbdGlsZVNpemUsIHRpbGVTaXplXSksXHJcblxyXG5cdFx0ICAgIG53ID0gdGhpcy5fY3JzLnByb2plY3QobWFwLnVucHJvamVjdChud1BvaW50LCB0aWxlUG9pbnQueikpLFxyXG5cdFx0ICAgIHNlID0gdGhpcy5fY3JzLnByb2plY3QobWFwLnVucHJvamVjdChzZVBvaW50LCB0aWxlUG9pbnQueikpLFxyXG5cdFx0ICAgIGJib3ggPSB0aGlzLl93bXNWZXJzaW9uID49IDEuMyAmJiB0aGlzLl9jcnMgPT09IEwuQ1JTLkVQU0c0MzI2ID9cclxuXHRcdCAgICAgICAgW3NlLnksIG53LngsIG53LnksIHNlLnhdLmpvaW4oJywnKSA6XHJcblx0XHQgICAgICAgIFtudy54LCBzZS55LCBzZS54LCBudy55XS5qb2luKCcsJyksXHJcblxyXG5cdFx0ICAgIHVybCA9IEwuVXRpbC50ZW1wbGF0ZSh0aGlzLl91cmwsIHtzOiB0aGlzLl9nZXRTdWJkb21haW4odGlsZVBvaW50KX0pO1xyXG5cclxuXHRcdHJldHVybiB1cmwgKyBMLlV0aWwuZ2V0UGFyYW1TdHJpbmcodGhpcy53bXNQYXJhbXMsIHVybCwgdHJ1ZSkgKyAnJkJCT1g9JyArIGJib3g7XHJcblx0fSxcclxuXHJcblx0c2V0UGFyYW1zOiBmdW5jdGlvbiAocGFyYW1zLCBub1JlZHJhdykge1xyXG5cclxuXHRcdEwuZXh0ZW5kKHRoaXMud21zUGFyYW1zLCBwYXJhbXMpO1xyXG5cclxuXHRcdGlmICghbm9SZWRyYXcpIHtcclxuXHRcdFx0dGhpcy5yZWRyYXcoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcbn0pO1xyXG5cclxuTC50aWxlTGF5ZXIud21zID0gZnVuY3Rpb24gKHVybCwgb3B0aW9ucykge1xyXG5cdHJldHVybiBuZXcgTC5UaWxlTGF5ZXIuV01TKHVybCwgb3B0aW9ucyk7XHJcbn07XHJcblxuXG4vKlxyXG4gKiBMLlRpbGVMYXllci5DYW52YXMgaXMgYSBjbGFzcyB0aGF0IHlvdSBjYW4gdXNlIGFzIGEgYmFzZSBmb3IgY3JlYXRpbmdcclxuICogZHluYW1pY2FsbHkgZHJhd24gQ2FudmFzLWJhc2VkIHRpbGUgbGF5ZXJzLlxyXG4gKi9cclxuXHJcbkwuVGlsZUxheWVyLkNhbnZhcyA9IEwuVGlsZUxheWVyLmV4dGVuZCh7XHJcblx0b3B0aW9uczoge1xyXG5cdFx0YXN5bmM6IGZhbHNlXHJcblx0fSxcclxuXHJcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuXHRcdEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuXHR9LFxyXG5cclxuXHRyZWRyYXc6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICh0aGlzLl9tYXApIHtcclxuXHRcdFx0dGhpcy5fcmVzZXQoe2hhcmQ6IHRydWV9KTtcclxuXHRcdFx0dGhpcy5fdXBkYXRlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yICh2YXIgaSBpbiB0aGlzLl90aWxlcykge1xyXG5cdFx0XHR0aGlzLl9yZWRyYXdUaWxlKHRoaXMuX3RpbGVzW2ldKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdF9yZWRyYXdUaWxlOiBmdW5jdGlvbiAodGlsZSkge1xyXG5cdFx0dGhpcy5kcmF3VGlsZSh0aWxlLCB0aWxlLl90aWxlUG9pbnQsIHRoaXMuX21hcC5fem9vbSk7XHJcblx0fSxcclxuXHJcblx0X2NyZWF0ZVRpbGU6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciB0aWxlID0gTC5Eb21VdGlsLmNyZWF0ZSgnY2FudmFzJywgJ2xlYWZsZXQtdGlsZScpO1xyXG5cdFx0dGlsZS53aWR0aCA9IHRpbGUuaGVpZ2h0ID0gdGhpcy5vcHRpb25zLnRpbGVTaXplO1xyXG5cdFx0dGlsZS5vbnNlbGVjdHN0YXJ0ID0gdGlsZS5vbm1vdXNlbW92ZSA9IEwuVXRpbC5mYWxzZUZuO1xyXG5cdFx0cmV0dXJuIHRpbGU7XHJcblx0fSxcclxuXHJcblx0X2xvYWRUaWxlOiBmdW5jdGlvbiAodGlsZSwgdGlsZVBvaW50KSB7XHJcblx0XHR0aWxlLl9sYXllciA9IHRoaXM7XHJcblx0XHR0aWxlLl90aWxlUG9pbnQgPSB0aWxlUG9pbnQ7XHJcblxyXG5cdFx0dGhpcy5fcmVkcmF3VGlsZSh0aWxlKTtcclxuXHJcblx0XHRpZiAoIXRoaXMub3B0aW9ucy5hc3luYykge1xyXG5cdFx0XHR0aGlzLnRpbGVEcmF3bih0aWxlKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRkcmF3VGlsZTogZnVuY3Rpb24gKC8qdGlsZSwgdGlsZVBvaW50Ki8pIHtcclxuXHRcdC8vIG92ZXJyaWRlIHdpdGggcmVuZGVyaW5nIGNvZGVcclxuXHR9LFxyXG5cclxuXHR0aWxlRHJhd246IGZ1bmN0aW9uICh0aWxlKSB7XHJcblx0XHR0aGlzLl90aWxlT25Mb2FkLmNhbGwodGlsZSk7XHJcblx0fVxyXG59KTtcclxuXHJcblxyXG5MLnRpbGVMYXllci5jYW52YXMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xyXG5cdHJldHVybiBuZXcgTC5UaWxlTGF5ZXIuQ2FudmFzKG9wdGlvbnMpO1xyXG59O1xyXG5cblxuLypcclxuICogTC5JbWFnZU92ZXJsYXkgaXMgdXNlZCB0byBvdmVybGF5IGltYWdlcyBvdmVyIHRoZSBtYXAgKHRvIHNwZWNpZmljIGdlb2dyYXBoaWNhbCBib3VuZHMpLlxyXG4gKi9cclxuXHJcbkwuSW1hZ2VPdmVybGF5ID0gTC5DbGFzcy5leHRlbmQoe1xyXG5cdGluY2x1ZGVzOiBMLk1peGluLkV2ZW50cyxcclxuXHJcblx0b3B0aW9uczoge1xyXG5cdFx0b3BhY2l0eTogMVxyXG5cdH0sXHJcblxyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uICh1cmwsIGJvdW5kcywgb3B0aW9ucykgeyAvLyAoU3RyaW5nLCBMYXRMbmdCb3VuZHMsIE9iamVjdClcclxuXHRcdHRoaXMuX3VybCA9IHVybDtcclxuXHRcdHRoaXMuX2JvdW5kcyA9IEwubGF0TG5nQm91bmRzKGJvdW5kcyk7XHJcblxyXG5cdFx0TC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cdH0sXHJcblxyXG5cdG9uQWRkOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHR0aGlzLl9tYXAgPSBtYXA7XHJcblxyXG5cdFx0aWYgKCF0aGlzLl9pbWFnZSkge1xyXG5cdFx0XHR0aGlzLl9pbml0SW1hZ2UoKTtcclxuXHRcdH1cclxuXHJcblx0XHRtYXAuX3BhbmVzLm92ZXJsYXlQYW5lLmFwcGVuZENoaWxkKHRoaXMuX2ltYWdlKTtcclxuXHJcblx0XHRtYXAub24oJ3ZpZXdyZXNldCcsIHRoaXMuX3Jlc2V0LCB0aGlzKTtcclxuXHJcblx0XHRpZiAobWFwLm9wdGlvbnMuem9vbUFuaW1hdGlvbiAmJiBMLkJyb3dzZXIuYW55M2QpIHtcclxuXHRcdFx0bWFwLm9uKCd6b29tYW5pbScsIHRoaXMuX2FuaW1hdGVab29tLCB0aGlzKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9yZXNldCgpO1xyXG5cdH0sXHJcblxyXG5cdG9uUmVtb3ZlOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHRtYXAuZ2V0UGFuZXMoKS5vdmVybGF5UGFuZS5yZW1vdmVDaGlsZCh0aGlzLl9pbWFnZSk7XHJcblxyXG5cdFx0bWFwLm9mZigndmlld3Jlc2V0JywgdGhpcy5fcmVzZXQsIHRoaXMpO1xyXG5cclxuXHRcdGlmIChtYXAub3B0aW9ucy56b29tQW5pbWF0aW9uKSB7XHJcblx0XHRcdG1hcC5vZmYoJ3pvb21hbmltJywgdGhpcy5fYW5pbWF0ZVpvb20sIHRoaXMpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGFkZFRvOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHRtYXAuYWRkTGF5ZXIodGhpcyk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRzZXRPcGFjaXR5OiBmdW5jdGlvbiAob3BhY2l0eSkge1xyXG5cdFx0dGhpcy5vcHRpb25zLm9wYWNpdHkgPSBvcGFjaXR5O1xyXG5cdFx0dGhpcy5fdXBkYXRlT3BhY2l0eSgpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0Ly8gVE9ETyByZW1vdmUgYnJpbmdUb0Zyb250L2JyaW5nVG9CYWNrIGR1cGxpY2F0aW9uIGZyb20gVGlsZUxheWVyL1BhdGhcclxuXHRicmluZ1RvRnJvbnQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICh0aGlzLl9pbWFnZSkge1xyXG5cdFx0XHR0aGlzLl9tYXAuX3BhbmVzLm92ZXJsYXlQYW5lLmFwcGVuZENoaWxkKHRoaXMuX2ltYWdlKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGJyaW5nVG9CYWNrOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgcGFuZSA9IHRoaXMuX21hcC5fcGFuZXMub3ZlcmxheVBhbmU7XHJcblx0XHRpZiAodGhpcy5faW1hZ2UpIHtcclxuXHRcdFx0cGFuZS5pbnNlcnRCZWZvcmUodGhpcy5faW1hZ2UsIHBhbmUuZmlyc3RDaGlsZCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRzZXRVcmw6IGZ1bmN0aW9uICh1cmwpIHtcclxuXHRcdHRoaXMuX3VybCA9IHVybDtcclxuXHRcdHRoaXMuX2ltYWdlLnNyYyA9IHRoaXMuX3VybDtcclxuXHR9LFxyXG5cclxuXHRnZXRBdHRyaWJ1dGlvbjogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMub3B0aW9ucy5hdHRyaWJ1dGlvbjtcclxuXHR9LFxyXG5cclxuXHRfaW5pdEltYWdlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLl9pbWFnZSA9IEwuRG9tVXRpbC5jcmVhdGUoJ2ltZycsICdsZWFmbGV0LWltYWdlLWxheWVyJyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuX21hcC5vcHRpb25zLnpvb21BbmltYXRpb24gJiYgTC5Ccm93c2VyLmFueTNkKSB7XHJcblx0XHRcdEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9pbWFnZSwgJ2xlYWZsZXQtem9vbS1hbmltYXRlZCcpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0TC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2ltYWdlLCAnbGVhZmxldC16b29tLWhpZGUnKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl91cGRhdGVPcGFjaXR5KCk7XHJcblxyXG5cdFx0Ly9UT0RPIGNyZWF0ZUltYWdlIHV0aWwgbWV0aG9kIHRvIHJlbW92ZSBkdXBsaWNhdGlvblxyXG5cdFx0TC5leHRlbmQodGhpcy5faW1hZ2UsIHtcclxuXHRcdFx0Z2FsbGVyeWltZzogJ25vJyxcclxuXHRcdFx0b25zZWxlY3RzdGFydDogTC5VdGlsLmZhbHNlRm4sXHJcblx0XHRcdG9ubW91c2Vtb3ZlOiBMLlV0aWwuZmFsc2VGbixcclxuXHRcdFx0b25sb2FkOiBMLmJpbmQodGhpcy5fb25JbWFnZUxvYWQsIHRoaXMpLFxyXG5cdFx0XHRzcmM6IHRoaXMuX3VybFxyXG5cdFx0fSk7XHJcblx0fSxcclxuXHJcblx0X2FuaW1hdGVab29tOiBmdW5jdGlvbiAoZSkge1xyXG5cdFx0dmFyIG1hcCA9IHRoaXMuX21hcCxcclxuXHRcdCAgICBpbWFnZSA9IHRoaXMuX2ltYWdlLFxyXG5cdFx0ICAgIHNjYWxlID0gbWFwLmdldFpvb21TY2FsZShlLnpvb20pLFxyXG5cdFx0ICAgIG53ID0gdGhpcy5fYm91bmRzLmdldE5vcnRoV2VzdCgpLFxyXG5cdFx0ICAgIHNlID0gdGhpcy5fYm91bmRzLmdldFNvdXRoRWFzdCgpLFxyXG5cclxuXHRcdCAgICB0b3BMZWZ0ID0gbWFwLl9sYXRMbmdUb05ld0xheWVyUG9pbnQobncsIGUuem9vbSwgZS5jZW50ZXIpLFxyXG5cdFx0ICAgIHNpemUgPSBtYXAuX2xhdExuZ1RvTmV3TGF5ZXJQb2ludChzZSwgZS56b29tLCBlLmNlbnRlcikuX3N1YnRyYWN0KHRvcExlZnQpLFxyXG5cdFx0ICAgIG9yaWdpbiA9IHRvcExlZnQuX2FkZChzaXplLl9tdWx0aXBseUJ5KCgxIC8gMikgKiAoMSAtIDEgLyBzY2FsZSkpKTtcclxuXHJcblx0XHRpbWFnZS5zdHlsZVtMLkRvbVV0aWwuVFJBTlNGT1JNXSA9XHJcblx0XHQgICAgICAgIEwuRG9tVXRpbC5nZXRUcmFuc2xhdGVTdHJpbmcob3JpZ2luKSArICcgc2NhbGUoJyArIHNjYWxlICsgJykgJztcclxuXHR9LFxyXG5cclxuXHRfcmVzZXQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBpbWFnZSAgID0gdGhpcy5faW1hZ2UsXHJcblx0XHQgICAgdG9wTGVmdCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKSxcclxuXHRcdCAgICBzaXplID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9ib3VuZHMuZ2V0U291dGhFYXN0KCkpLl9zdWJ0cmFjdCh0b3BMZWZ0KTtcclxuXHJcblx0XHRMLkRvbVV0aWwuc2V0UG9zaXRpb24oaW1hZ2UsIHRvcExlZnQpO1xyXG5cclxuXHRcdGltYWdlLnN0eWxlLndpZHRoICA9IHNpemUueCArICdweCc7XHJcblx0XHRpbWFnZS5zdHlsZS5oZWlnaHQgPSBzaXplLnkgKyAncHgnO1xyXG5cdH0sXHJcblxyXG5cdF9vbkltYWdlTG9hZDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dGhpcy5maXJlKCdsb2FkJyk7XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZU9wYWNpdHk6IGZ1bmN0aW9uICgpIHtcclxuXHRcdEwuRG9tVXRpbC5zZXRPcGFjaXR5KHRoaXMuX2ltYWdlLCB0aGlzLm9wdGlvbnMub3BhY2l0eSk7XHJcblx0fVxyXG59KTtcclxuXHJcbkwuaW1hZ2VPdmVybGF5ID0gZnVuY3Rpb24gKHVybCwgYm91bmRzLCBvcHRpb25zKSB7XHJcblx0cmV0dXJuIG5ldyBMLkltYWdlT3ZlcmxheSh1cmwsIGJvdW5kcywgb3B0aW9ucyk7XHJcbn07XHJcblxuXG4vKlxyXG4gKiBMLkljb24gaXMgYW4gaW1hZ2UtYmFzZWQgaWNvbiBjbGFzcyB0aGF0IHlvdSBjYW4gdXNlIHdpdGggTC5NYXJrZXIgZm9yIGN1c3RvbSBtYXJrZXJzLlxyXG4gKi9cclxuXHJcbkwuSWNvbiA9IEwuQ2xhc3MuZXh0ZW5kKHtcclxuXHRvcHRpb25zOiB7XHJcblx0XHQvKlxyXG5cdFx0aWNvblVybDogKFN0cmluZykgKHJlcXVpcmVkKVxyXG5cdFx0aWNvblJldGluYVVybDogKFN0cmluZykgKG9wdGlvbmFsLCB1c2VkIGZvciByZXRpbmEgZGV2aWNlcyBpZiBkZXRlY3RlZClcclxuXHRcdGljb25TaXplOiAoUG9pbnQpIChjYW4gYmUgc2V0IHRocm91Z2ggQ1NTKVxyXG5cdFx0aWNvbkFuY2hvcjogKFBvaW50KSAoY2VudGVyZWQgYnkgZGVmYXVsdCwgY2FuIGJlIHNldCBpbiBDU1Mgd2l0aCBuZWdhdGl2ZSBtYXJnaW5zKVxyXG5cdFx0cG9wdXBBbmNob3I6IChQb2ludCkgKGlmIG5vdCBzcGVjaWZpZWQsIHBvcHVwIG9wZW5zIGluIHRoZSBhbmNob3IgcG9pbnQpXHJcblx0XHRzaGFkb3dVcmw6IChTdHJpbmcpIChubyBzaGFkb3cgYnkgZGVmYXVsdClcclxuXHRcdHNoYWRvd1JldGluYVVybDogKFN0cmluZykgKG9wdGlvbmFsLCB1c2VkIGZvciByZXRpbmEgZGV2aWNlcyBpZiBkZXRlY3RlZClcclxuXHRcdHNoYWRvd1NpemU6IChQb2ludClcclxuXHRcdHNoYWRvd0FuY2hvcjogKFBvaW50KVxyXG5cdFx0Ki9cclxuXHRcdGNsYXNzTmFtZTogJydcclxuXHR9LFxyXG5cclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAob3B0aW9ucykge1xyXG5cdFx0TC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cdH0sXHJcblxyXG5cdGNyZWF0ZUljb246IGZ1bmN0aW9uIChvbGRJY29uKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlSWNvbignaWNvbicsIG9sZEljb24pO1xyXG5cdH0sXHJcblxyXG5cdGNyZWF0ZVNoYWRvdzogZnVuY3Rpb24gKG9sZEljb24pIHtcclxuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVJY29uKCdzaGFkb3cnLCBvbGRJY29uKTtcclxuXHR9LFxyXG5cclxuXHRfY3JlYXRlSWNvbjogZnVuY3Rpb24gKG5hbWUsIG9sZEljb24pIHtcclxuXHRcdHZhciBzcmMgPSB0aGlzLl9nZXRJY29uVXJsKG5hbWUpO1xyXG5cclxuXHRcdGlmICghc3JjKSB7XHJcblx0XHRcdGlmIChuYW1lID09PSAnaWNvbicpIHtcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ljb25Vcmwgbm90IHNldCBpbiBJY29uIG9wdGlvbnMgKHNlZSB0aGUgZG9jcykuJyk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGltZztcclxuXHRcdGlmICghb2xkSWNvbiB8fCBvbGRJY29uLnRhZ05hbWUgIT09ICdJTUcnKSB7XHJcblx0XHRcdGltZyA9IHRoaXMuX2NyZWF0ZUltZyhzcmMpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aW1nID0gdGhpcy5fY3JlYXRlSW1nKHNyYywgb2xkSWNvbik7XHJcblx0XHR9XHJcblx0XHR0aGlzLl9zZXRJY29uU3R5bGVzKGltZywgbmFtZSk7XHJcblxyXG5cdFx0cmV0dXJuIGltZztcclxuXHR9LFxyXG5cclxuXHRfc2V0SWNvblN0eWxlczogZnVuY3Rpb24gKGltZywgbmFtZSkge1xyXG5cdFx0dmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnMsXHJcblx0XHQgICAgc2l6ZSA9IEwucG9pbnQob3B0aW9uc1tuYW1lICsgJ1NpemUnXSksXHJcblx0XHQgICAgYW5jaG9yO1xyXG5cclxuXHRcdGlmIChuYW1lID09PSAnc2hhZG93Jykge1xyXG5cdFx0XHRhbmNob3IgPSBMLnBvaW50KG9wdGlvbnMuc2hhZG93QW5jaG9yIHx8IG9wdGlvbnMuaWNvbkFuY2hvcik7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRhbmNob3IgPSBMLnBvaW50KG9wdGlvbnMuaWNvbkFuY2hvcik7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCFhbmNob3IgJiYgc2l6ZSkge1xyXG5cdFx0XHRhbmNob3IgPSBzaXplLmRpdmlkZUJ5KDIsIHRydWUpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGltZy5jbGFzc05hbWUgPSAnbGVhZmxldC1tYXJrZXItJyArIG5hbWUgKyAnICcgKyBvcHRpb25zLmNsYXNzTmFtZTtcclxuXHJcblx0XHRpZiAoYW5jaG9yKSB7XHJcblx0XHRcdGltZy5zdHlsZS5tYXJnaW5MZWZ0ID0gKC1hbmNob3IueCkgKyAncHgnO1xyXG5cdFx0XHRpbWcuc3R5bGUubWFyZ2luVG9wICA9ICgtYW5jaG9yLnkpICsgJ3B4JztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoc2l6ZSkge1xyXG5cdFx0XHRpbWcuc3R5bGUud2lkdGggID0gc2l6ZS54ICsgJ3B4JztcclxuXHRcdFx0aW1nLnN0eWxlLmhlaWdodCA9IHNpemUueSArICdweCc7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X2NyZWF0ZUltZzogZnVuY3Rpb24gKHNyYywgZWwpIHtcclxuXHRcdGVsID0gZWwgfHwgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XHJcblx0XHRlbC5zcmMgPSBzcmM7XHJcblx0XHRyZXR1cm4gZWw7XHJcblx0fSxcclxuXHJcblx0X2dldEljb25Vcmw6IGZ1bmN0aW9uIChuYW1lKSB7XHJcblx0XHRpZiAoTC5Ccm93c2VyLnJldGluYSAmJiB0aGlzLm9wdGlvbnNbbmFtZSArICdSZXRpbmFVcmwnXSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5vcHRpb25zW25hbWUgKyAnUmV0aW5hVXJsJ107XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcy5vcHRpb25zW25hbWUgKyAnVXJsJ107XHJcblx0fVxyXG59KTtcclxuXHJcbkwuaWNvbiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcblx0cmV0dXJuIG5ldyBMLkljb24ob3B0aW9ucyk7XHJcbn07XHJcblxuXG4vKlxuICogTC5JY29uLkRlZmF1bHQgaXMgdGhlIGJsdWUgbWFya2VyIGljb24gdXNlZCBieSBkZWZhdWx0IGluIExlYWZsZXQuXG4gKi9cblxuTC5JY29uLkRlZmF1bHQgPSBMLkljb24uZXh0ZW5kKHtcblxuXHRvcHRpb25zOiB7XG5cdFx0aWNvblNpemU6IFsyNSwgNDFdLFxuXHRcdGljb25BbmNob3I6IFsxMiwgNDFdLFxuXHRcdHBvcHVwQW5jaG9yOiBbMSwgLTM0XSxcblxuXHRcdHNoYWRvd1NpemU6IFs0MSwgNDFdXG5cdH0sXG5cblx0X2dldEljb25Vcmw6IGZ1bmN0aW9uIChuYW1lKSB7XG5cdFx0dmFyIGtleSA9IG5hbWUgKyAnVXJsJztcblxuXHRcdGlmICh0aGlzLm9wdGlvbnNba2V5XSkge1xuXHRcdFx0cmV0dXJuIHRoaXMub3B0aW9uc1trZXldO1xuXHRcdH1cblxuXHRcdGlmIChMLkJyb3dzZXIucmV0aW5hICYmIG5hbWUgPT09ICdpY29uJykge1xuXHRcdFx0bmFtZSArPSAnLTJ4Jztcblx0XHR9XG5cblx0XHR2YXIgcGF0aCA9IEwuSWNvbi5EZWZhdWx0LmltYWdlUGF0aDtcblxuXHRcdGlmICghcGF0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDb3VsZG5cXCd0IGF1dG9kZXRlY3QgTC5JY29uLkRlZmF1bHQuaW1hZ2VQYXRoLCBzZXQgaXQgbWFudWFsbHkuJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBhdGggKyAnL21hcmtlci0nICsgbmFtZSArICcucG5nJztcblx0fVxufSk7XG5cbkwuSWNvbi5EZWZhdWx0LmltYWdlUGF0aCA9IChmdW5jdGlvbiAoKSB7XG5cdHZhciBzY3JpcHRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpLFxuXHQgICAgbGVhZmxldFJlID0gL1tcXC9eXWxlYWZsZXRbXFwtXFwuX10/KFtcXHdcXC1cXC5fXSopXFwuanNcXD8/LztcblxuXHR2YXIgaSwgbGVuLCBzcmMsIG1hdGNoZXMsIHBhdGg7XG5cblx0Zm9yIChpID0gMCwgbGVuID0gc2NyaXB0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdHNyYyA9IHNjcmlwdHNbaV0uc3JjO1xuXHRcdG1hdGNoZXMgPSBzcmMubWF0Y2gobGVhZmxldFJlKTtcblxuXHRcdGlmIChtYXRjaGVzKSB7XG5cdFx0XHRwYXRoID0gc3JjLnNwbGl0KGxlYWZsZXRSZSlbMF07XG5cdFx0XHRyZXR1cm4gKHBhdGggPyBwYXRoICsgJy8nIDogJycpICsgJ2ltYWdlcyc7XG5cdFx0fVxuXHR9XG59KCkpO1xuXG5cbi8qXHJcbiAqIEwuTWFya2VyIGlzIHVzZWQgdG8gZGlzcGxheSBjbGlja2FibGUvZHJhZ2dhYmxlIGljb25zIG9uIHRoZSBtYXAuXHJcbiAqL1xyXG5cclxuTC5NYXJrZXIgPSBMLkNsYXNzLmV4dGVuZCh7XHJcblxyXG5cdGluY2x1ZGVzOiBMLk1peGluLkV2ZW50cyxcclxuXHJcblx0b3B0aW9uczoge1xyXG5cdFx0aWNvbjogbmV3IEwuSWNvbi5EZWZhdWx0KCksXHJcblx0XHR0aXRsZTogJycsXHJcblx0XHRhbHQ6ICcnLFxyXG5cdFx0Y2xpY2thYmxlOiB0cnVlLFxyXG5cdFx0ZHJhZ2dhYmxlOiBmYWxzZSxcclxuXHRcdGtleWJvYXJkOiB0cnVlLFxyXG5cdFx0ekluZGV4T2Zmc2V0OiAwLFxyXG5cdFx0b3BhY2l0eTogMSxcclxuXHRcdHJpc2VPbkhvdmVyOiBmYWxzZSxcclxuXHRcdHJpc2VPZmZzZXQ6IDI1MFxyXG5cdH0sXHJcblxyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRsbmcsIG9wdGlvbnMpIHtcclxuXHRcdEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuXHRcdHRoaXMuX2xhdGxuZyA9IEwubGF0TG5nKGxhdGxuZyk7XHJcblx0fSxcclxuXHJcblx0b25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcclxuXHRcdHRoaXMuX21hcCA9IG1hcDtcclxuXHJcblx0XHRtYXAub24oJ3ZpZXdyZXNldCcsIHRoaXMudXBkYXRlLCB0aGlzKTtcclxuXHJcblx0XHR0aGlzLl9pbml0SWNvbigpO1xyXG5cdFx0dGhpcy51cGRhdGUoKTtcclxuXHRcdHRoaXMuZmlyZSgnYWRkJyk7XHJcblxyXG5cdFx0aWYgKG1hcC5vcHRpb25zLnpvb21BbmltYXRpb24gJiYgbWFwLm9wdGlvbnMubWFya2VyWm9vbUFuaW1hdGlvbikge1xyXG5cdFx0XHRtYXAub24oJ3pvb21hbmltJywgdGhpcy5fYW5pbWF0ZVpvb20sIHRoaXMpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGFkZFRvOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHRtYXAuYWRkTGF5ZXIodGhpcyk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRvblJlbW92ZTogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0aWYgKHRoaXMuZHJhZ2dpbmcpIHtcclxuXHRcdFx0dGhpcy5kcmFnZ2luZy5kaXNhYmxlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fcmVtb3ZlSWNvbigpO1xyXG5cdFx0dGhpcy5fcmVtb3ZlU2hhZG93KCk7XHJcblxyXG5cdFx0dGhpcy5maXJlKCdyZW1vdmUnKTtcclxuXHJcblx0XHRtYXAub2ZmKHtcclxuXHRcdFx0J3ZpZXdyZXNldCc6IHRoaXMudXBkYXRlLFxyXG5cdFx0XHQnem9vbWFuaW0nOiB0aGlzLl9hbmltYXRlWm9vbVxyXG5cdFx0fSwgdGhpcyk7XHJcblxyXG5cdFx0dGhpcy5fbWFwID0gbnVsbDtcclxuXHR9LFxyXG5cclxuXHRnZXRMYXRMbmc6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9sYXRsbmc7XHJcblx0fSxcclxuXHJcblx0c2V0TGF0TG5nOiBmdW5jdGlvbiAobGF0bG5nKSB7XHJcblx0XHR0aGlzLl9sYXRsbmcgPSBMLmxhdExuZyhsYXRsbmcpO1xyXG5cclxuXHRcdHRoaXMudXBkYXRlKCk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuZmlyZSgnbW92ZScsIHsgbGF0bG5nOiB0aGlzLl9sYXRsbmcgfSk7XHJcblx0fSxcclxuXHJcblx0c2V0WkluZGV4T2Zmc2V0OiBmdW5jdGlvbiAob2Zmc2V0KSB7XHJcblx0XHR0aGlzLm9wdGlvbnMuekluZGV4T2Zmc2V0ID0gb2Zmc2V0O1xyXG5cdFx0dGhpcy51cGRhdGUoKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRzZXRJY29uOiBmdW5jdGlvbiAoaWNvbikge1xyXG5cclxuXHRcdHRoaXMub3B0aW9ucy5pY29uID0gaWNvbjtcclxuXHJcblx0XHRpZiAodGhpcy5fbWFwKSB7XHJcblx0XHRcdHRoaXMuX2luaXRJY29uKCk7XHJcblx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuX3BvcHVwKSB7XHJcblx0XHRcdHRoaXMuYmluZFBvcHVwKHRoaXMuX3BvcHVwKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHR1cGRhdGU6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICh0aGlzLl9pY29uKSB7XHJcblx0XHRcdHZhciBwb3MgPSB0aGlzLl9tYXAubGF0TG5nVG9MYXllclBvaW50KHRoaXMuX2xhdGxuZykucm91bmQoKTtcclxuXHRcdFx0dGhpcy5fc2V0UG9zKHBvcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0X2luaXRJY29uOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucyxcclxuXHRcdCAgICBtYXAgPSB0aGlzLl9tYXAsXHJcblx0XHQgICAgYW5pbWF0aW9uID0gKG1hcC5vcHRpb25zLnpvb21BbmltYXRpb24gJiYgbWFwLm9wdGlvbnMubWFya2VyWm9vbUFuaW1hdGlvbiksXHJcblx0XHQgICAgY2xhc3NUb0FkZCA9IGFuaW1hdGlvbiA/ICdsZWFmbGV0LXpvb20tYW5pbWF0ZWQnIDogJ2xlYWZsZXQtem9vbS1oaWRlJztcclxuXHJcblx0XHR2YXIgaWNvbiA9IG9wdGlvbnMuaWNvbi5jcmVhdGVJY29uKHRoaXMuX2ljb24pLFxyXG5cdFx0XHRhZGRJY29uID0gZmFsc2U7XHJcblxyXG5cdFx0Ly8gaWYgd2UncmUgbm90IHJldXNpbmcgdGhlIGljb24sIHJlbW92ZSB0aGUgb2xkIG9uZSBhbmQgaW5pdCBuZXcgb25lXHJcblx0XHRpZiAoaWNvbiAhPT0gdGhpcy5faWNvbikge1xyXG5cdFx0XHRpZiAodGhpcy5faWNvbikge1xyXG5cdFx0XHRcdHRoaXMuX3JlbW92ZUljb24oKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRhZGRJY29uID0gdHJ1ZTtcclxuXHJcblx0XHRcdGlmIChvcHRpb25zLnRpdGxlKSB7XHJcblx0XHRcdFx0aWNvbi50aXRsZSA9IG9wdGlvbnMudGl0bGU7XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdGlmIChvcHRpb25zLmFsdCkge1xyXG5cdFx0XHRcdGljb24uYWx0ID0gb3B0aW9ucy5hbHQ7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRMLkRvbVV0aWwuYWRkQ2xhc3MoaWNvbiwgY2xhc3NUb0FkZCk7XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMua2V5Ym9hcmQpIHtcclxuXHRcdFx0aWNvbi50YWJJbmRleCA9ICcwJztcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9pY29uID0gaWNvbjtcclxuXHJcblx0XHR0aGlzLl9pbml0SW50ZXJhY3Rpb24oKTtcclxuXHJcblx0XHRpZiAob3B0aW9ucy5yaXNlT25Ib3Zlcikge1xyXG5cdFx0XHRMLkRvbUV2ZW50XHJcblx0XHRcdFx0Lm9uKGljb24sICdtb3VzZW92ZXInLCB0aGlzLl9icmluZ1RvRnJvbnQsIHRoaXMpXHJcblx0XHRcdFx0Lm9uKGljb24sICdtb3VzZW91dCcsIHRoaXMuX3Jlc2V0WkluZGV4LCB0aGlzKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgbmV3U2hhZG93ID0gb3B0aW9ucy5pY29uLmNyZWF0ZVNoYWRvdyh0aGlzLl9zaGFkb3cpLFxyXG5cdFx0XHRhZGRTaGFkb3cgPSBmYWxzZTtcclxuXHJcblx0XHRpZiAobmV3U2hhZG93ICE9PSB0aGlzLl9zaGFkb3cpIHtcclxuXHRcdFx0dGhpcy5fcmVtb3ZlU2hhZG93KCk7XHJcblx0XHRcdGFkZFNoYWRvdyA9IHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKG5ld1NoYWRvdykge1xyXG5cdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3MobmV3U2hhZG93LCBjbGFzc1RvQWRkKTtcclxuXHRcdH1cclxuXHRcdHRoaXMuX3NoYWRvdyA9IG5ld1NoYWRvdztcclxuXHJcblxyXG5cdFx0aWYgKG9wdGlvbnMub3BhY2l0eSA8IDEpIHtcclxuXHRcdFx0dGhpcy5fdXBkYXRlT3BhY2l0eSgpO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHR2YXIgcGFuZXMgPSB0aGlzLl9tYXAuX3BhbmVzO1xyXG5cclxuXHRcdGlmIChhZGRJY29uKSB7XHJcblx0XHRcdHBhbmVzLm1hcmtlclBhbmUuYXBwZW5kQ2hpbGQodGhpcy5faWNvbik7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKG5ld1NoYWRvdyAmJiBhZGRTaGFkb3cpIHtcclxuXHRcdFx0cGFuZXMuc2hhZG93UGFuZS5hcHBlbmRDaGlsZCh0aGlzLl9zaGFkb3cpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9yZW1vdmVJY29uOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnJpc2VPbkhvdmVyKSB7XHJcblx0XHRcdEwuRG9tRXZlbnRcclxuXHRcdFx0ICAgIC5vZmYodGhpcy5faWNvbiwgJ21vdXNlb3ZlcicsIHRoaXMuX2JyaW5nVG9Gcm9udClcclxuXHRcdFx0ICAgIC5vZmYodGhpcy5faWNvbiwgJ21vdXNlb3V0JywgdGhpcy5fcmVzZXRaSW5kZXgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX21hcC5fcGFuZXMubWFya2VyUGFuZS5yZW1vdmVDaGlsZCh0aGlzLl9pY29uKTtcclxuXHJcblx0XHR0aGlzLl9pY29uID0gbnVsbDtcclxuXHR9LFxyXG5cclxuXHRfcmVtb3ZlU2hhZG93OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fc2hhZG93KSB7XHJcblx0XHRcdHRoaXMuX21hcC5fcGFuZXMuc2hhZG93UGFuZS5yZW1vdmVDaGlsZCh0aGlzLl9zaGFkb3cpO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5fc2hhZG93ID0gbnVsbDtcclxuXHR9LFxyXG5cclxuXHRfc2V0UG9zOiBmdW5jdGlvbiAocG9zKSB7XHJcblx0XHRMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5faWNvbiwgcG9zKTtcclxuXHJcblx0XHRpZiAodGhpcy5fc2hhZG93KSB7XHJcblx0XHRcdEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9zaGFkb3csIHBvcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fekluZGV4ID0gcG9zLnkgKyB0aGlzLm9wdGlvbnMuekluZGV4T2Zmc2V0O1xyXG5cclxuXHRcdHRoaXMuX3Jlc2V0WkluZGV4KCk7XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZVpJbmRleDogZnVuY3Rpb24gKG9mZnNldCkge1xyXG5cdFx0dGhpcy5faWNvbi5zdHlsZS56SW5kZXggPSB0aGlzLl96SW5kZXggKyBvZmZzZXQ7XHJcblx0fSxcclxuXHJcblx0X2FuaW1hdGVab29tOiBmdW5jdGlvbiAob3B0KSB7XHJcblx0XHR2YXIgcG9zID0gdGhpcy5fbWFwLl9sYXRMbmdUb05ld0xheWVyUG9pbnQodGhpcy5fbGF0bG5nLCBvcHQuem9vbSwgb3B0LmNlbnRlcikucm91bmQoKTtcclxuXHJcblx0XHR0aGlzLl9zZXRQb3MocG9zKTtcclxuXHR9LFxyXG5cclxuXHRfaW5pdEludGVyYWN0aW9uOiBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMuY2xpY2thYmxlKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdC8vIFRPRE8gcmVmYWN0b3IgaW50byBzb21ldGhpbmcgc2hhcmVkIHdpdGggTWFwL1BhdGgvZXRjLiB0byBEUlkgaXQgdXBcclxuXHJcblx0XHR2YXIgaWNvbiA9IHRoaXMuX2ljb24sXHJcblx0XHQgICAgZXZlbnRzID0gWydkYmxjbGljaycsICdtb3VzZWRvd24nLCAnbW91c2VvdmVyJywgJ21vdXNlb3V0JywgJ2NvbnRleHRtZW51J107XHJcblxyXG5cdFx0TC5Eb21VdGlsLmFkZENsYXNzKGljb24sICdsZWFmbGV0LWNsaWNrYWJsZScpO1xyXG5cdFx0TC5Eb21FdmVudC5vbihpY29uLCAnY2xpY2snLCB0aGlzLl9vbk1vdXNlQ2xpY2ssIHRoaXMpO1xyXG5cdFx0TC5Eb21FdmVudC5vbihpY29uLCAna2V5cHJlc3MnLCB0aGlzLl9vbktleVByZXNzLCB0aGlzKTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRMLkRvbUV2ZW50Lm9uKGljb24sIGV2ZW50c1tpXSwgdGhpcy5fZmlyZU1vdXNlRXZlbnQsIHRoaXMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChMLkhhbmRsZXIuTWFya2VyRHJhZykge1xyXG5cdFx0XHR0aGlzLmRyYWdnaW5nID0gbmV3IEwuSGFuZGxlci5NYXJrZXJEcmFnKHRoaXMpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGUpIHtcclxuXHRcdFx0XHR0aGlzLmRyYWdnaW5nLmVuYWJsZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X29uTW91c2VDbGljazogZnVuY3Rpb24gKGUpIHtcclxuXHRcdHZhciB3YXNEcmFnZ2VkID0gdGhpcy5kcmFnZ2luZyAmJiB0aGlzLmRyYWdnaW5nLm1vdmVkKCk7XHJcblxyXG5cdFx0aWYgKHRoaXMuaGFzRXZlbnRMaXN0ZW5lcnMoZS50eXBlKSB8fCB3YXNEcmFnZ2VkKSB7XHJcblx0XHRcdEwuRG9tRXZlbnQuc3RvcFByb3BhZ2F0aW9uKGUpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh3YXNEcmFnZ2VkKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGlmICgoIXRoaXMuZHJhZ2dpbmcgfHwgIXRoaXMuZHJhZ2dpbmcuX2VuYWJsZWQpICYmIHRoaXMuX21hcC5kcmFnZ2luZyAmJiB0aGlzLl9tYXAuZHJhZ2dpbmcubW92ZWQoKSkgeyByZXR1cm47IH1cclxuXHJcblx0XHR0aGlzLmZpcmUoZS50eXBlLCB7XHJcblx0XHRcdG9yaWdpbmFsRXZlbnQ6IGUsXHJcblx0XHRcdGxhdGxuZzogdGhpcy5fbGF0bG5nXHJcblx0XHR9KTtcclxuXHR9LFxyXG5cclxuXHRfb25LZXlQcmVzczogZnVuY3Rpb24gKGUpIHtcclxuXHRcdGlmIChlLmtleUNvZGUgPT09IDEzKSB7XHJcblx0XHRcdHRoaXMuZmlyZSgnY2xpY2snLCB7XHJcblx0XHRcdFx0b3JpZ2luYWxFdmVudDogZSxcclxuXHRcdFx0XHRsYXRsbmc6IHRoaXMuX2xhdGxuZ1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfZmlyZU1vdXNlRXZlbnQ6IGZ1bmN0aW9uIChlKSB7XHJcblxyXG5cdFx0dGhpcy5maXJlKGUudHlwZSwge1xyXG5cdFx0XHRvcmlnaW5hbEV2ZW50OiBlLFxyXG5cdFx0XHRsYXRsbmc6IHRoaXMuX2xhdGxuZ1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gVE9ETyBwcm9wZXIgY3VzdG9tIGV2ZW50IHByb3BhZ2F0aW9uXHJcblx0XHQvLyB0aGlzIGxpbmUgd2lsbCBhbHdheXMgYmUgY2FsbGVkIGlmIG1hcmtlciBpcyBpbiBhIEZlYXR1cmVHcm91cFxyXG5cdFx0aWYgKGUudHlwZSA9PT0gJ2NvbnRleHRtZW51JyAmJiB0aGlzLmhhc0V2ZW50TGlzdGVuZXJzKGUudHlwZSkpIHtcclxuXHRcdFx0TC5Eb21FdmVudC5wcmV2ZW50RGVmYXVsdChlKTtcclxuXHRcdH1cclxuXHRcdGlmIChlLnR5cGUgIT09ICdtb3VzZWRvd24nKSB7XHJcblx0XHRcdEwuRG9tRXZlbnQuc3RvcFByb3BhZ2F0aW9uKGUpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0TC5Eb21FdmVudC5wcmV2ZW50RGVmYXVsdChlKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRzZXRPcGFjaXR5OiBmdW5jdGlvbiAob3BhY2l0eSkge1xyXG5cdFx0dGhpcy5vcHRpb25zLm9wYWNpdHkgPSBvcGFjaXR5O1xyXG5cdFx0aWYgKHRoaXMuX21hcCkge1xyXG5cdFx0XHR0aGlzLl91cGRhdGVPcGFjaXR5KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZU9wYWNpdHk6IGZ1bmN0aW9uICgpIHtcclxuXHRcdEwuRG9tVXRpbC5zZXRPcGFjaXR5KHRoaXMuX2ljb24sIHRoaXMub3B0aW9ucy5vcGFjaXR5KTtcclxuXHRcdGlmICh0aGlzLl9zaGFkb3cpIHtcclxuXHRcdFx0TC5Eb21VdGlsLnNldE9wYWNpdHkodGhpcy5fc2hhZG93LCB0aGlzLm9wdGlvbnMub3BhY2l0eSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X2JyaW5nVG9Gcm9udDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dGhpcy5fdXBkYXRlWkluZGV4KHRoaXMub3B0aW9ucy5yaXNlT2Zmc2V0KTtcclxuXHR9LFxyXG5cclxuXHRfcmVzZXRaSW5kZXg6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHRoaXMuX3VwZGF0ZVpJbmRleCgwKTtcclxuXHR9XHJcbn0pO1xyXG5cclxuTC5tYXJrZXIgPSBmdW5jdGlvbiAobGF0bG5nLCBvcHRpb25zKSB7XHJcblx0cmV0dXJuIG5ldyBMLk1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xyXG59O1xyXG5cblxuLypcbiAqIEwuRGl2SWNvbiBpcyBhIGxpZ2h0d2VpZ2h0IEhUTUwtYmFzZWQgaWNvbiBjbGFzcyAoYXMgb3Bwb3NlZCB0byB0aGUgaW1hZ2UtYmFzZWQgTC5JY29uKVxuICogdG8gdXNlIHdpdGggTC5NYXJrZXIuXG4gKi9cblxuTC5EaXZJY29uID0gTC5JY29uLmV4dGVuZCh7XG5cdG9wdGlvbnM6IHtcblx0XHRpY29uU2l6ZTogWzEyLCAxMl0sIC8vIGFsc28gY2FuIGJlIHNldCB0aHJvdWdoIENTU1xuXHRcdC8qXG5cdFx0aWNvbkFuY2hvcjogKFBvaW50KVxuXHRcdHBvcHVwQW5jaG9yOiAoUG9pbnQpXG5cdFx0aHRtbDogKFN0cmluZylcblx0XHRiZ1BvczogKFBvaW50KVxuXHRcdCovXG5cdFx0Y2xhc3NOYW1lOiAnbGVhZmxldC1kaXYtaWNvbicsXG5cdFx0aHRtbDogZmFsc2Vcblx0fSxcblxuXHRjcmVhdGVJY29uOiBmdW5jdGlvbiAob2xkSWNvbikge1xuXHRcdHZhciBkaXYgPSAob2xkSWNvbiAmJiBvbGRJY29uLnRhZ05hbWUgPT09ICdESVYnKSA/IG9sZEljb24gOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcblx0XHQgICAgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcblxuXHRcdGlmIChvcHRpb25zLmh0bWwgIT09IGZhbHNlKSB7XG5cdFx0XHRkaXYuaW5uZXJIVE1MID0gb3B0aW9ucy5odG1sO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkaXYuaW5uZXJIVE1MID0gJyc7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMuYmdQb3MpIHtcblx0XHRcdGRpdi5zdHlsZS5iYWNrZ3JvdW5kUG9zaXRpb24gPVxuXHRcdFx0ICAgICAgICAoLW9wdGlvbnMuYmdQb3MueCkgKyAncHggJyArICgtb3B0aW9ucy5iZ1Bvcy55KSArICdweCc7XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2V0SWNvblN0eWxlcyhkaXYsICdpY29uJyk7XG5cdFx0cmV0dXJuIGRpdjtcblx0fSxcblxuXHRjcmVhdGVTaGFkb3c6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufSk7XG5cbkwuZGl2SWNvbiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG5cdHJldHVybiBuZXcgTC5EaXZJY29uKG9wdGlvbnMpO1xufTtcblxuXG4vKlxyXG4gKiBMLlBvcHVwIGlzIHVzZWQgZm9yIGRpc3BsYXlpbmcgcG9wdXBzIG9uIHRoZSBtYXAuXHJcbiAqL1xyXG5cclxuTC5NYXAubWVyZ2VPcHRpb25zKHtcclxuXHRjbG9zZVBvcHVwT25DbGljazogdHJ1ZVxyXG59KTtcclxuXHJcbkwuUG9wdXAgPSBMLkNsYXNzLmV4dGVuZCh7XHJcblx0aW5jbHVkZXM6IEwuTWl4aW4uRXZlbnRzLFxyXG5cclxuXHRvcHRpb25zOiB7XHJcblx0XHRtaW5XaWR0aDogNTAsXHJcblx0XHRtYXhXaWR0aDogMzAwLFxyXG5cdFx0Ly8gbWF4SGVpZ2h0OiBudWxsLFxyXG5cdFx0YXV0b1BhbjogdHJ1ZSxcclxuXHRcdGNsb3NlQnV0dG9uOiB0cnVlLFxyXG5cdFx0b2Zmc2V0OiBbMCwgN10sXHJcblx0XHRhdXRvUGFuUGFkZGluZzogWzUsIDVdLFxyXG5cdFx0Ly8gYXV0b1BhblBhZGRpbmdUb3BMZWZ0OiBudWxsLFxyXG5cdFx0Ly8gYXV0b1BhblBhZGRpbmdCb3R0b21SaWdodDogbnVsbCxcclxuXHRcdGtlZXBJblZpZXc6IGZhbHNlLFxyXG5cdFx0Y2xhc3NOYW1lOiAnJyxcclxuXHRcdHpvb21BbmltYXRpb246IHRydWVcclxuXHR9LFxyXG5cclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAob3B0aW9ucywgc291cmNlKSB7XHJcblx0XHRMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblxyXG5cdFx0dGhpcy5fc291cmNlID0gc291cmNlO1xyXG5cdFx0dGhpcy5fYW5pbWF0ZWQgPSBMLkJyb3dzZXIuYW55M2QgJiYgdGhpcy5vcHRpb25zLnpvb21BbmltYXRpb247XHJcblx0XHR0aGlzLl9pc09wZW4gPSBmYWxzZTtcclxuXHR9LFxyXG5cclxuXHRvbkFkZDogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0dGhpcy5fbWFwID0gbWFwO1xyXG5cclxuXHRcdGlmICghdGhpcy5fY29udGFpbmVyKSB7XHJcblx0XHRcdHRoaXMuX2luaXRMYXlvdXQoKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgYW5pbUZhZGUgPSBtYXAub3B0aW9ucy5mYWRlQW5pbWF0aW9uO1xyXG5cclxuXHRcdGlmIChhbmltRmFkZSkge1xyXG5cdFx0XHRMLkRvbVV0aWwuc2V0T3BhY2l0eSh0aGlzLl9jb250YWluZXIsIDApO1xyXG5cdFx0fVxyXG5cdFx0bWFwLl9wYW5lcy5wb3B1cFBhbmUuYXBwZW5kQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcclxuXHJcblx0XHRtYXAub24odGhpcy5fZ2V0RXZlbnRzKCksIHRoaXMpO1xyXG5cclxuXHRcdHRoaXMudXBkYXRlKCk7XHJcblxyXG5cdFx0aWYgKGFuaW1GYWRlKSB7XHJcblx0XHRcdEwuRG9tVXRpbC5zZXRPcGFjaXR5KHRoaXMuX2NvbnRhaW5lciwgMSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5maXJlKCdvcGVuJyk7XHJcblxyXG5cdFx0bWFwLmZpcmUoJ3BvcHVwb3BlbicsIHtwb3B1cDogdGhpc30pO1xyXG5cclxuXHRcdGlmICh0aGlzLl9zb3VyY2UpIHtcclxuXHRcdFx0dGhpcy5fc291cmNlLmZpcmUoJ3BvcHVwb3BlbicsIHtwb3B1cDogdGhpc30pO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGFkZFRvOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHRtYXAuYWRkTGF5ZXIodGhpcyk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRvcGVuT246IGZ1bmN0aW9uIChtYXApIHtcclxuXHRcdG1hcC5vcGVuUG9wdXAodGhpcyk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRvblJlbW92ZTogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0bWFwLl9wYW5lcy5wb3B1cFBhbmUucmVtb3ZlQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcclxuXHJcblx0XHRMLlV0aWwuZmFsc2VGbih0aGlzLl9jb250YWluZXIub2Zmc2V0V2lkdGgpOyAvLyBmb3JjZSByZWZsb3dcclxuXHJcblx0XHRtYXAub2ZmKHRoaXMuX2dldEV2ZW50cygpLCB0aGlzKTtcclxuXHJcblx0XHRpZiAobWFwLm9wdGlvbnMuZmFkZUFuaW1hdGlvbikge1xyXG5cdFx0XHRMLkRvbVV0aWwuc2V0T3BhY2l0eSh0aGlzLl9jb250YWluZXIsIDApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX21hcCA9IG51bGw7XHJcblxyXG5cdFx0dGhpcy5maXJlKCdjbG9zZScpO1xyXG5cclxuXHRcdG1hcC5maXJlKCdwb3B1cGNsb3NlJywge3BvcHVwOiB0aGlzfSk7XHJcblxyXG5cdFx0aWYgKHRoaXMuX3NvdXJjZSkge1xyXG5cdFx0XHR0aGlzLl9zb3VyY2UuZmlyZSgncG9wdXBjbG9zZScsIHtwb3B1cDogdGhpc30pO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGdldExhdExuZzogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX2xhdGxuZztcclxuXHR9LFxyXG5cclxuXHRzZXRMYXRMbmc6IGZ1bmN0aW9uIChsYXRsbmcpIHtcclxuXHRcdHRoaXMuX2xhdGxuZyA9IEwubGF0TG5nKGxhdGxuZyk7XHJcblx0XHRpZiAodGhpcy5fbWFwKSB7XHJcblx0XHRcdHRoaXMuX3VwZGF0ZVBvc2l0aW9uKCk7XHJcblx0XHRcdHRoaXMuX2FkanVzdFBhbigpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0Z2V0Q29udGVudDogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnQ7XHJcblx0fSxcclxuXHJcblx0c2V0Q29udGVudDogZnVuY3Rpb24gKGNvbnRlbnQpIHtcclxuXHRcdHRoaXMuX2NvbnRlbnQgPSBjb250ZW50O1xyXG5cdFx0dGhpcy51cGRhdGUoKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdHVwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKCF0aGlzLl9tYXApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dGhpcy5fY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcclxuXHJcblx0XHR0aGlzLl91cGRhdGVDb250ZW50KCk7XHJcblx0XHR0aGlzLl91cGRhdGVMYXlvdXQoKTtcclxuXHRcdHRoaXMuX3VwZGF0ZVBvc2l0aW9uKCk7XHJcblxyXG5cdFx0dGhpcy5fY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnJztcclxuXHJcblx0XHR0aGlzLl9hZGp1c3RQYW4oKTtcclxuXHR9LFxyXG5cclxuXHRfZ2V0RXZlbnRzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgZXZlbnRzID0ge1xyXG5cdFx0XHR2aWV3cmVzZXQ6IHRoaXMuX3VwZGF0ZVBvc2l0aW9uXHJcblx0XHR9O1xyXG5cclxuXHRcdGlmICh0aGlzLl9hbmltYXRlZCkge1xyXG5cdFx0XHRldmVudHMuem9vbWFuaW0gPSB0aGlzLl96b29tQW5pbWF0aW9uO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCdjbG9zZU9uQ2xpY2snIGluIHRoaXMub3B0aW9ucyA/IHRoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2sgOiB0aGlzLl9tYXAub3B0aW9ucy5jbG9zZVBvcHVwT25DbGljaykge1xyXG5cdFx0XHRldmVudHMucHJlY2xpY2sgPSB0aGlzLl9jbG9zZTtcclxuXHRcdH1cclxuXHRcdGlmICh0aGlzLm9wdGlvbnMua2VlcEluVmlldykge1xyXG5cdFx0XHRldmVudHMubW92ZWVuZCA9IHRoaXMuX2FkanVzdFBhbjtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZXZlbnRzO1xyXG5cdH0sXHJcblxyXG5cdF9jbG9zZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKHRoaXMuX21hcCkge1xyXG5cdFx0XHR0aGlzLl9tYXAuY2xvc2VQb3B1cCh0aGlzKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfaW5pdExheW91dDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHByZWZpeCA9ICdsZWFmbGV0LXBvcHVwJyxcclxuXHRcdFx0Y29udGFpbmVyQ2xhc3MgPSBwcmVmaXggKyAnICcgKyB0aGlzLm9wdGlvbnMuY2xhc3NOYW1lICsgJyBsZWFmbGV0LXpvb20tJyArXHJcblx0XHRcdCAgICAgICAgKHRoaXMuX2FuaW1hdGVkID8gJ2FuaW1hdGVkJyA6ICdoaWRlJyksXHJcblx0XHRcdGNvbnRhaW5lciA9IHRoaXMuX2NvbnRhaW5lciA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsIGNvbnRhaW5lckNsYXNzKSxcclxuXHRcdFx0Y2xvc2VCdXR0b247XHJcblxyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5jbG9zZUJ1dHRvbikge1xyXG5cdFx0XHRjbG9zZUJ1dHRvbiA9IHRoaXMuX2Nsb3NlQnV0dG9uID1cclxuXHRcdFx0ICAgICAgICBMLkRvbVV0aWwuY3JlYXRlKCdhJywgcHJlZml4ICsgJy1jbG9zZS1idXR0b24nLCBjb250YWluZXIpO1xyXG5cdFx0XHRjbG9zZUJ1dHRvbi5ocmVmID0gJyNjbG9zZSc7XHJcblx0XHRcdGNsb3NlQnV0dG9uLmlubmVySFRNTCA9ICcmIzIxNTsnO1xyXG5cdFx0XHRMLkRvbUV2ZW50LmRpc2FibGVDbGlja1Byb3BhZ2F0aW9uKGNsb3NlQnV0dG9uKTtcclxuXHJcblx0XHRcdEwuRG9tRXZlbnQub24oY2xvc2VCdXR0b24sICdjbGljaycsIHRoaXMuX29uQ2xvc2VCdXR0b25DbGljaywgdGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHdyYXBwZXIgPSB0aGlzLl93cmFwcGVyID1cclxuXHRcdCAgICAgICAgTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgcHJlZml4ICsgJy1jb250ZW50LXdyYXBwZXInLCBjb250YWluZXIpO1xyXG5cdFx0TC5Eb21FdmVudC5kaXNhYmxlQ2xpY2tQcm9wYWdhdGlvbih3cmFwcGVyKTtcclxuXHJcblx0XHR0aGlzLl9jb250ZW50Tm9kZSA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsIHByZWZpeCArICctY29udGVudCcsIHdyYXBwZXIpO1xyXG5cclxuXHRcdEwuRG9tRXZlbnQuZGlzYWJsZVNjcm9sbFByb3BhZ2F0aW9uKHRoaXMuX2NvbnRlbnROb2RlKTtcclxuXHRcdEwuRG9tRXZlbnQub24od3JhcHBlciwgJ2NvbnRleHRtZW51JywgTC5Eb21FdmVudC5zdG9wUHJvcGFnYXRpb24pO1xyXG5cclxuXHRcdHRoaXMuX3RpcENvbnRhaW5lciA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsIHByZWZpeCArICctdGlwLWNvbnRhaW5lcicsIGNvbnRhaW5lcik7XHJcblx0XHR0aGlzLl90aXAgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCBwcmVmaXggKyAnLXRpcCcsIHRoaXMuX3RpcENvbnRhaW5lcik7XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZUNvbnRlbnQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICghdGhpcy5fY29udGVudCkgeyByZXR1cm47IH1cclxuXHJcblx0XHRpZiAodHlwZW9mIHRoaXMuX2NvbnRlbnQgPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdHRoaXMuX2NvbnRlbnROb2RlLmlubmVySFRNTCA9IHRoaXMuX2NvbnRlbnQ7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR3aGlsZSAodGhpcy5fY29udGVudE5vZGUuaGFzQ2hpbGROb2RlcygpKSB7XHJcblx0XHRcdFx0dGhpcy5fY29udGVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fY29udGVudE5vZGUuZmlyc3RDaGlsZCk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5fY29udGVudE5vZGUuYXBwZW5kQ2hpbGQodGhpcy5fY29udGVudCk7XHJcblx0XHR9XHJcblx0XHR0aGlzLmZpcmUoJ2NvbnRlbnR1cGRhdGUnKTtcclxuXHR9LFxyXG5cclxuXHRfdXBkYXRlTGF5b3V0OiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgY29udGFpbmVyID0gdGhpcy5fY29udGVudE5vZGUsXHJcblx0XHQgICAgc3R5bGUgPSBjb250YWluZXIuc3R5bGU7XHJcblxyXG5cdFx0c3R5bGUud2lkdGggPSAnJztcclxuXHRcdHN0eWxlLndoaXRlU3BhY2UgPSAnbm93cmFwJztcclxuXHJcblx0XHR2YXIgd2lkdGggPSBjb250YWluZXIub2Zmc2V0V2lkdGg7XHJcblx0XHR3aWR0aCA9IE1hdGgubWluKHdpZHRoLCB0aGlzLm9wdGlvbnMubWF4V2lkdGgpO1xyXG5cdFx0d2lkdGggPSBNYXRoLm1heCh3aWR0aCwgdGhpcy5vcHRpb25zLm1pbldpZHRoKTtcclxuXHJcblx0XHRzdHlsZS53aWR0aCA9ICh3aWR0aCArIDEpICsgJ3B4JztcclxuXHRcdHN0eWxlLndoaXRlU3BhY2UgPSAnJztcclxuXHJcblx0XHRzdHlsZS5oZWlnaHQgPSAnJztcclxuXHJcblx0XHR2YXIgaGVpZ2h0ID0gY29udGFpbmVyLm9mZnNldEhlaWdodCxcclxuXHRcdCAgICBtYXhIZWlnaHQgPSB0aGlzLm9wdGlvbnMubWF4SGVpZ2h0LFxyXG5cdFx0ICAgIHNjcm9sbGVkQ2xhc3MgPSAnbGVhZmxldC1wb3B1cC1zY3JvbGxlZCc7XHJcblxyXG5cdFx0aWYgKG1heEhlaWdodCAmJiBoZWlnaHQgPiBtYXhIZWlnaHQpIHtcclxuXHRcdFx0c3R5bGUuaGVpZ2h0ID0gbWF4SGVpZ2h0ICsgJ3B4JztcclxuXHRcdFx0TC5Eb21VdGlsLmFkZENsYXNzKGNvbnRhaW5lciwgc2Nyb2xsZWRDbGFzcyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRMLkRvbVV0aWwucmVtb3ZlQ2xhc3MoY29udGFpbmVyLCBzY3JvbGxlZENsYXNzKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9jb250YWluZXJXaWR0aCA9IHRoaXMuX2NvbnRhaW5lci5vZmZzZXRXaWR0aDtcclxuXHR9LFxyXG5cclxuXHRfdXBkYXRlUG9zaXRpb246IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICghdGhpcy5fbWFwKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBwb3MgPSB0aGlzLl9tYXAubGF0TG5nVG9MYXllclBvaW50KHRoaXMuX2xhdGxuZyksXHJcblx0XHQgICAgYW5pbWF0ZWQgPSB0aGlzLl9hbmltYXRlZCxcclxuXHRcdCAgICBvZmZzZXQgPSBMLnBvaW50KHRoaXMub3B0aW9ucy5vZmZzZXQpO1xyXG5cclxuXHRcdGlmIChhbmltYXRlZCkge1xyXG5cdFx0XHRMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fY29udGFpbmVyLCBwb3MpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2NvbnRhaW5lckJvdHRvbSA9IC1vZmZzZXQueSAtIChhbmltYXRlZCA/IDAgOiBwb3MueSk7XHJcblx0XHR0aGlzLl9jb250YWluZXJMZWZ0ID0gLU1hdGgucm91bmQodGhpcy5fY29udGFpbmVyV2lkdGggLyAyKSArIG9mZnNldC54ICsgKGFuaW1hdGVkID8gMCA6IHBvcy54KTtcclxuXHJcblx0XHQvLyBib3R0b20gcG9zaXRpb24gdGhlIHBvcHVwIGluIGNhc2UgdGhlIGhlaWdodCBvZiB0aGUgcG9wdXAgY2hhbmdlcyAoaW1hZ2VzIGxvYWRpbmcgZXRjKVxyXG5cdFx0dGhpcy5fY29udGFpbmVyLnN0eWxlLmJvdHRvbSA9IHRoaXMuX2NvbnRhaW5lckJvdHRvbSArICdweCc7XHJcblx0XHR0aGlzLl9jb250YWluZXIuc3R5bGUubGVmdCA9IHRoaXMuX2NvbnRhaW5lckxlZnQgKyAncHgnO1xyXG5cdH0sXHJcblxyXG5cdF96b29tQW5pbWF0aW9uOiBmdW5jdGlvbiAob3B0KSB7XHJcblx0XHR2YXIgcG9zID0gdGhpcy5fbWFwLl9sYXRMbmdUb05ld0xheWVyUG9pbnQodGhpcy5fbGF0bG5nLCBvcHQuem9vbSwgb3B0LmNlbnRlcik7XHJcblxyXG5cdFx0TC5Eb21VdGlsLnNldFBvc2l0aW9uKHRoaXMuX2NvbnRhaW5lciwgcG9zKTtcclxuXHR9LFxyXG5cclxuXHRfYWRqdXN0UGFuOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAoIXRoaXMub3B0aW9ucy5hdXRvUGFuKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXAsXHJcblx0XHQgICAgY29udGFpbmVySGVpZ2h0ID0gdGhpcy5fY29udGFpbmVyLm9mZnNldEhlaWdodCxcclxuXHRcdCAgICBjb250YWluZXJXaWR0aCA9IHRoaXMuX2NvbnRhaW5lcldpZHRoLFxyXG5cclxuXHRcdCAgICBsYXllclBvcyA9IG5ldyBMLlBvaW50KHRoaXMuX2NvbnRhaW5lckxlZnQsIC1jb250YWluZXJIZWlnaHQgLSB0aGlzLl9jb250YWluZXJCb3R0b20pO1xyXG5cclxuXHRcdGlmICh0aGlzLl9hbmltYXRlZCkge1xyXG5cdFx0XHRsYXllclBvcy5fYWRkKEwuRG9tVXRpbC5nZXRQb3NpdGlvbih0aGlzLl9jb250YWluZXIpKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgY29udGFpbmVyUG9zID0gbWFwLmxheWVyUG9pbnRUb0NvbnRhaW5lclBvaW50KGxheWVyUG9zKSxcclxuXHRcdCAgICBwYWRkaW5nID0gTC5wb2ludCh0aGlzLm9wdGlvbnMuYXV0b1BhblBhZGRpbmcpLFxyXG5cdFx0ICAgIHBhZGRpbmdUTCA9IEwucG9pbnQodGhpcy5vcHRpb25zLmF1dG9QYW5QYWRkaW5nVG9wTGVmdCB8fCBwYWRkaW5nKSxcclxuXHRcdCAgICBwYWRkaW5nQlIgPSBMLnBvaW50KHRoaXMub3B0aW9ucy5hdXRvUGFuUGFkZGluZ0JvdHRvbVJpZ2h0IHx8IHBhZGRpbmcpLFxyXG5cdFx0ICAgIHNpemUgPSBtYXAuZ2V0U2l6ZSgpLFxyXG5cdFx0ICAgIGR4ID0gMCxcclxuXHRcdCAgICBkeSA9IDA7XHJcblxyXG5cdFx0aWYgKGNvbnRhaW5lclBvcy54ICsgY29udGFpbmVyV2lkdGggKyBwYWRkaW5nQlIueCA+IHNpemUueCkgeyAvLyByaWdodFxyXG5cdFx0XHRkeCA9IGNvbnRhaW5lclBvcy54ICsgY29udGFpbmVyV2lkdGggLSBzaXplLnggKyBwYWRkaW5nQlIueDtcclxuXHRcdH1cclxuXHRcdGlmIChjb250YWluZXJQb3MueCAtIGR4IC0gcGFkZGluZ1RMLnggPCAwKSB7IC8vIGxlZnRcclxuXHRcdFx0ZHggPSBjb250YWluZXJQb3MueCAtIHBhZGRpbmdUTC54O1xyXG5cdFx0fVxyXG5cdFx0aWYgKGNvbnRhaW5lclBvcy55ICsgY29udGFpbmVySGVpZ2h0ICsgcGFkZGluZ0JSLnkgPiBzaXplLnkpIHsgLy8gYm90dG9tXHJcblx0XHRcdGR5ID0gY29udGFpbmVyUG9zLnkgKyBjb250YWluZXJIZWlnaHQgLSBzaXplLnkgKyBwYWRkaW5nQlIueTtcclxuXHRcdH1cclxuXHRcdGlmIChjb250YWluZXJQb3MueSAtIGR5IC0gcGFkZGluZ1RMLnkgPCAwKSB7IC8vIHRvcFxyXG5cdFx0XHRkeSA9IGNvbnRhaW5lclBvcy55IC0gcGFkZGluZ1RMLnk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGR4IHx8IGR5KSB7XHJcblx0XHRcdG1hcFxyXG5cdFx0XHQgICAgLmZpcmUoJ2F1dG9wYW5zdGFydCcpXHJcblx0XHRcdCAgICAucGFuQnkoW2R4LCBkeV0pO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9vbkNsb3NlQnV0dG9uQ2xpY2s6IGZ1bmN0aW9uIChlKSB7XHJcblx0XHR0aGlzLl9jbG9zZSgpO1xyXG5cdFx0TC5Eb21FdmVudC5zdG9wKGUpO1xyXG5cdH1cclxufSk7XHJcblxyXG5MLnBvcHVwID0gZnVuY3Rpb24gKG9wdGlvbnMsIHNvdXJjZSkge1xyXG5cdHJldHVybiBuZXcgTC5Qb3B1cChvcHRpb25zLCBzb3VyY2UpO1xyXG59O1xyXG5cclxuXHJcbkwuTWFwLmluY2x1ZGUoe1xyXG5cdG9wZW5Qb3B1cDogZnVuY3Rpb24gKHBvcHVwLCBsYXRsbmcsIG9wdGlvbnMpIHsgLy8gKFBvcHVwKSBvciAoU3RyaW5nIHx8IEhUTUxFbGVtZW50LCBMYXRMbmdbLCBPYmplY3RdKVxyXG5cdFx0dGhpcy5jbG9zZVBvcHVwKCk7XHJcblxyXG5cdFx0aWYgKCEocG9wdXAgaW5zdGFuY2VvZiBMLlBvcHVwKSkge1xyXG5cdFx0XHR2YXIgY29udGVudCA9IHBvcHVwO1xyXG5cclxuXHRcdFx0cG9wdXAgPSBuZXcgTC5Qb3B1cChvcHRpb25zKVxyXG5cdFx0XHQgICAgLnNldExhdExuZyhsYXRsbmcpXHJcblx0XHRcdCAgICAuc2V0Q29udGVudChjb250ZW50KTtcclxuXHRcdH1cclxuXHRcdHBvcHVwLl9pc09wZW4gPSB0cnVlO1xyXG5cclxuXHRcdHRoaXMuX3BvcHVwID0gcG9wdXA7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMYXllcihwb3B1cCk7XHJcblx0fSxcclxuXHJcblx0Y2xvc2VQb3B1cDogZnVuY3Rpb24gKHBvcHVwKSB7XHJcblx0XHRpZiAoIXBvcHVwIHx8IHBvcHVwID09PSB0aGlzLl9wb3B1cCkge1xyXG5cdFx0XHRwb3B1cCA9IHRoaXMuX3BvcHVwO1xyXG5cdFx0XHR0aGlzLl9wb3B1cCA9IG51bGw7XHJcblx0XHR9XHJcblx0XHRpZiAocG9wdXApIHtcclxuXHRcdFx0dGhpcy5yZW1vdmVMYXllcihwb3B1cCk7XHJcblx0XHRcdHBvcHVwLl9pc09wZW4gPSBmYWxzZTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxufSk7XHJcblxuXG4vKlxyXG4gKiBQb3B1cCBleHRlbnNpb24gdG8gTC5NYXJrZXIsIGFkZGluZyBwb3B1cC1yZWxhdGVkIG1ldGhvZHMuXHJcbiAqL1xyXG5cclxuTC5NYXJrZXIuaW5jbHVkZSh7XHJcblx0b3BlblBvcHVwOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fcG9wdXAgJiYgdGhpcy5fbWFwICYmICF0aGlzLl9tYXAuaGFzTGF5ZXIodGhpcy5fcG9wdXApKSB7XHJcblx0XHRcdHRoaXMuX3BvcHVwLnNldExhdExuZyh0aGlzLl9sYXRsbmcpO1xyXG5cdFx0XHR0aGlzLl9tYXAub3BlblBvcHVwKHRoaXMuX3BvcHVwKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRjbG9zZVBvcHVwOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fcG9wdXApIHtcclxuXHRcdFx0dGhpcy5fcG9wdXAuX2Nsb3NlKCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHR0b2dnbGVQb3B1cDogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKHRoaXMuX3BvcHVwKSB7XHJcblx0XHRcdGlmICh0aGlzLl9wb3B1cC5faXNPcGVuKSB7XHJcblx0XHRcdFx0dGhpcy5jbG9zZVBvcHVwKCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhpcy5vcGVuUG9wdXAoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0YmluZFBvcHVwOiBmdW5jdGlvbiAoY29udGVudCwgb3B0aW9ucykge1xyXG5cdFx0dmFyIGFuY2hvciA9IEwucG9pbnQodGhpcy5vcHRpb25zLmljb24ub3B0aW9ucy5wb3B1cEFuY2hvciB8fCBbMCwgMF0pO1xyXG5cclxuXHRcdGFuY2hvciA9IGFuY2hvci5hZGQoTC5Qb3B1cC5wcm90b3R5cGUub3B0aW9ucy5vZmZzZXQpO1xyXG5cclxuXHRcdGlmIChvcHRpb25zICYmIG9wdGlvbnMub2Zmc2V0KSB7XHJcblx0XHRcdGFuY2hvciA9IGFuY2hvci5hZGQob3B0aW9ucy5vZmZzZXQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdG9wdGlvbnMgPSBMLmV4dGVuZCh7b2Zmc2V0OiBhbmNob3J9LCBvcHRpb25zKTtcclxuXHJcblx0XHRpZiAoIXRoaXMuX3BvcHVwSGFuZGxlcnNBZGRlZCkge1xyXG5cdFx0XHR0aGlzXHJcblx0XHRcdCAgICAub24oJ2NsaWNrJywgdGhpcy50b2dnbGVQb3B1cCwgdGhpcylcclxuXHRcdFx0ICAgIC5vbigncmVtb3ZlJywgdGhpcy5jbG9zZVBvcHVwLCB0aGlzKVxyXG5cdFx0XHQgICAgLm9uKCdtb3ZlJywgdGhpcy5fbW92ZVBvcHVwLCB0aGlzKTtcclxuXHRcdFx0dGhpcy5fcG9wdXBIYW5kbGVyc0FkZGVkID0gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoY29udGVudCBpbnN0YW5jZW9mIEwuUG9wdXApIHtcclxuXHRcdFx0TC5zZXRPcHRpb25zKGNvbnRlbnQsIG9wdGlvbnMpO1xyXG5cdFx0XHR0aGlzLl9wb3B1cCA9IGNvbnRlbnQ7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLl9wb3B1cCA9IG5ldyBMLlBvcHVwKG9wdGlvbnMsIHRoaXMpXHJcblx0XHRcdFx0LnNldENvbnRlbnQoY29udGVudCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0c2V0UG9wdXBDb250ZW50OiBmdW5jdGlvbiAoY29udGVudCkge1xyXG5cdFx0aWYgKHRoaXMuX3BvcHVwKSB7XHJcblx0XHRcdHRoaXMuX3BvcHVwLnNldENvbnRlbnQoY29udGVudCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHR1bmJpbmRQb3B1cDogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKHRoaXMuX3BvcHVwKSB7XHJcblx0XHRcdHRoaXMuX3BvcHVwID0gbnVsbDtcclxuXHRcdFx0dGhpc1xyXG5cdFx0XHQgICAgLm9mZignY2xpY2snLCB0aGlzLnRvZ2dsZVBvcHVwLCB0aGlzKVxyXG5cdFx0XHQgICAgLm9mZigncmVtb3ZlJywgdGhpcy5jbG9zZVBvcHVwLCB0aGlzKVxyXG5cdFx0XHQgICAgLm9mZignbW92ZScsIHRoaXMuX21vdmVQb3B1cCwgdGhpcyk7XHJcblx0XHRcdHRoaXMuX3BvcHVwSGFuZGxlcnNBZGRlZCA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0Z2V0UG9wdXA6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9wb3B1cDtcclxuXHR9LFxyXG5cclxuXHRfbW92ZVBvcHVwOiBmdW5jdGlvbiAoZSkge1xyXG5cdFx0dGhpcy5fcG9wdXAuc2V0TGF0TG5nKGUubGF0bG5nKTtcclxuXHR9XHJcbn0pO1xyXG5cblxuLypcclxuICogTC5MYXllckdyb3VwIGlzIGEgY2xhc3MgdG8gY29tYmluZSBzZXZlcmFsIGxheWVycyBpbnRvIG9uZSBzbyB0aGF0XHJcbiAqIHlvdSBjYW4gbWFuaXB1bGF0ZSB0aGUgZ3JvdXAgKGUuZy4gYWRkL3JlbW92ZSBpdCkgYXMgb25lIGxheWVyLlxyXG4gKi9cclxuXHJcbkwuTGF5ZXJHcm91cCA9IEwuQ2xhc3MuZXh0ZW5kKHtcclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAobGF5ZXJzKSB7XHJcblx0XHR0aGlzLl9sYXllcnMgPSB7fTtcclxuXHJcblx0XHR2YXIgaSwgbGVuO1xyXG5cclxuXHRcdGlmIChsYXllcnMpIHtcclxuXHRcdFx0Zm9yIChpID0gMCwgbGVuID0gbGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdFx0dGhpcy5hZGRMYXllcihsYXllcnNbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0YWRkTGF5ZXI6IGZ1bmN0aW9uIChsYXllcikge1xyXG5cdFx0dmFyIGlkID0gdGhpcy5nZXRMYXllcklkKGxheWVyKTtcclxuXHJcblx0XHR0aGlzLl9sYXllcnNbaWRdID0gbGF5ZXI7XHJcblxyXG5cdFx0aWYgKHRoaXMuX21hcCkge1xyXG5cdFx0XHR0aGlzLl9tYXAuYWRkTGF5ZXIobGF5ZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdHJlbW92ZUxheWVyOiBmdW5jdGlvbiAobGF5ZXIpIHtcclxuXHRcdHZhciBpZCA9IGxheWVyIGluIHRoaXMuX2xheWVycyA/IGxheWVyIDogdGhpcy5nZXRMYXllcklkKGxheWVyKTtcclxuXHJcblx0XHRpZiAodGhpcy5fbWFwICYmIHRoaXMuX2xheWVyc1tpZF0pIHtcclxuXHRcdFx0dGhpcy5fbWFwLnJlbW92ZUxheWVyKHRoaXMuX2xheWVyc1tpZF0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRlbGV0ZSB0aGlzLl9sYXllcnNbaWRdO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGhhc0xheWVyOiBmdW5jdGlvbiAobGF5ZXIpIHtcclxuXHRcdGlmICghbGF5ZXIpIHsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cdFx0cmV0dXJuIChsYXllciBpbiB0aGlzLl9sYXllcnMgfHwgdGhpcy5nZXRMYXllcklkKGxheWVyKSBpbiB0aGlzLl9sYXllcnMpO1xyXG5cdH0sXHJcblxyXG5cdGNsZWFyTGF5ZXJzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLmVhY2hMYXllcih0aGlzLnJlbW92ZUxheWVyLCB0aGlzKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGludm9rZTogZnVuY3Rpb24gKG1ldGhvZE5hbWUpIHtcclxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcclxuXHRcdCAgICBpLCBsYXllcjtcclxuXHJcblx0XHRmb3IgKGkgaW4gdGhpcy5fbGF5ZXJzKSB7XHJcblx0XHRcdGxheWVyID0gdGhpcy5fbGF5ZXJzW2ldO1xyXG5cclxuXHRcdFx0aWYgKGxheWVyW21ldGhvZE5hbWVdKSB7XHJcblx0XHRcdFx0bGF5ZXJbbWV0aG9kTmFtZV0uYXBwbHkobGF5ZXIsIGFyZ3MpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0b25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcclxuXHRcdHRoaXMuX21hcCA9IG1hcDtcclxuXHRcdHRoaXMuZWFjaExheWVyKG1hcC5hZGRMYXllciwgbWFwKTtcclxuXHR9LFxyXG5cclxuXHRvblJlbW92ZTogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0dGhpcy5lYWNoTGF5ZXIobWFwLnJlbW92ZUxheWVyLCBtYXApO1xyXG5cdFx0dGhpcy5fbWFwID0gbnVsbDtcclxuXHR9LFxyXG5cclxuXHRhZGRUbzogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0bWFwLmFkZExheWVyKHRoaXMpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0ZWFjaExheWVyOiBmdW5jdGlvbiAobWV0aG9kLCBjb250ZXh0KSB7XHJcblx0XHRmb3IgKHZhciBpIGluIHRoaXMuX2xheWVycykge1xyXG5cdFx0XHRtZXRob2QuY2FsbChjb250ZXh0LCB0aGlzLl9sYXllcnNbaV0pO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0Z2V0TGF5ZXI6IGZ1bmN0aW9uIChpZCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX2xheWVyc1tpZF07XHJcblx0fSxcclxuXHJcblx0Z2V0TGF5ZXJzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgbGF5ZXJzID0gW107XHJcblxyXG5cdFx0Zm9yICh2YXIgaSBpbiB0aGlzLl9sYXllcnMpIHtcclxuXHRcdFx0bGF5ZXJzLnB1c2godGhpcy5fbGF5ZXJzW2ldKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBsYXllcnM7XHJcblx0fSxcclxuXHJcblx0c2V0WkluZGV4OiBmdW5jdGlvbiAoekluZGV4KSB7XHJcblx0XHRyZXR1cm4gdGhpcy5pbnZva2UoJ3NldFpJbmRleCcsIHpJbmRleCk7XHJcblx0fSxcclxuXHJcblx0Z2V0TGF5ZXJJZDogZnVuY3Rpb24gKGxheWVyKSB7XHJcblx0XHRyZXR1cm4gTC5zdGFtcChsYXllcik7XHJcblx0fVxyXG59KTtcclxuXHJcbkwubGF5ZXJHcm91cCA9IGZ1bmN0aW9uIChsYXllcnMpIHtcclxuXHRyZXR1cm4gbmV3IEwuTGF5ZXJHcm91cChsYXllcnMpO1xyXG59O1xyXG5cblxuLypcclxuICogTC5GZWF0dXJlR3JvdXAgZXh0ZW5kcyBMLkxheWVyR3JvdXAgYnkgaW50cm9kdWNpbmcgbW91c2UgZXZlbnRzIGFuZCBhZGRpdGlvbmFsIG1ldGhvZHNcclxuICogc2hhcmVkIGJldHdlZW4gYSBncm91cCBvZiBpbnRlcmFjdGl2ZSBsYXllcnMgKGxpa2UgdmVjdG9ycyBvciBtYXJrZXJzKS5cclxuICovXHJcblxyXG5MLkZlYXR1cmVHcm91cCA9IEwuTGF5ZXJHcm91cC5leHRlbmQoe1xyXG5cdGluY2x1ZGVzOiBMLk1peGluLkV2ZW50cyxcclxuXHJcblx0c3RhdGljczoge1xyXG5cdFx0RVZFTlRTOiAnY2xpY2sgZGJsY2xpY2sgbW91c2VvdmVyIG1vdXNlb3V0IG1vdXNlbW92ZSBjb250ZXh0bWVudSBwb3B1cG9wZW4gcG9wdXBjbG9zZSdcclxuXHR9LFxyXG5cclxuXHRhZGRMYXllcjogZnVuY3Rpb24gKGxheWVyKSB7XHJcblx0XHRpZiAodGhpcy5oYXNMYXllcihsYXllcikpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXM7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCdvbicgaW4gbGF5ZXIpIHtcclxuXHRcdFx0bGF5ZXIub24oTC5GZWF0dXJlR3JvdXAuRVZFTlRTLCB0aGlzLl9wcm9wYWdhdGVFdmVudCwgdGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0TC5MYXllckdyb3VwLnByb3RvdHlwZS5hZGRMYXllci5jYWxsKHRoaXMsIGxheWVyKTtcclxuXHJcblx0XHRpZiAodGhpcy5fcG9wdXBDb250ZW50ICYmIGxheWVyLmJpbmRQb3B1cCkge1xyXG5cdFx0XHRsYXllci5iaW5kUG9wdXAodGhpcy5fcG9wdXBDb250ZW50LCB0aGlzLl9wb3B1cE9wdGlvbnMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLmZpcmUoJ2xheWVyYWRkJywge2xheWVyOiBsYXllcn0pO1xyXG5cdH0sXHJcblxyXG5cdHJlbW92ZUxheWVyOiBmdW5jdGlvbiAobGF5ZXIpIHtcclxuXHRcdGlmICghdGhpcy5oYXNMYXllcihsYXllcikpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXM7XHJcblx0XHR9XHJcblx0XHRpZiAobGF5ZXIgaW4gdGhpcy5fbGF5ZXJzKSB7XHJcblx0XHRcdGxheWVyID0gdGhpcy5fbGF5ZXJzW2xheWVyXTtcclxuXHRcdH1cclxuXHJcblx0XHRsYXllci5vZmYoTC5GZWF0dXJlR3JvdXAuRVZFTlRTLCB0aGlzLl9wcm9wYWdhdGVFdmVudCwgdGhpcyk7XHJcblxyXG5cdFx0TC5MYXllckdyb3VwLnByb3RvdHlwZS5yZW1vdmVMYXllci5jYWxsKHRoaXMsIGxheWVyKTtcclxuXHJcblx0XHRpZiAodGhpcy5fcG9wdXBDb250ZW50KSB7XHJcblx0XHRcdHRoaXMuaW52b2tlKCd1bmJpbmRQb3B1cCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLmZpcmUoJ2xheWVycmVtb3ZlJywge2xheWVyOiBsYXllcn0pO1xyXG5cdH0sXHJcblxyXG5cdGJpbmRQb3B1cDogZnVuY3Rpb24gKGNvbnRlbnQsIG9wdGlvbnMpIHtcclxuXHRcdHRoaXMuX3BvcHVwQ29udGVudCA9IGNvbnRlbnQ7XHJcblx0XHR0aGlzLl9wb3B1cE9wdGlvbnMgPSBvcHRpb25zO1xyXG5cdFx0cmV0dXJuIHRoaXMuaW52b2tlKCdiaW5kUG9wdXAnLCBjb250ZW50LCBvcHRpb25zKTtcclxuXHR9LFxyXG5cclxuXHRvcGVuUG9wdXA6IGZ1bmN0aW9uIChsYXRsbmcpIHtcclxuXHRcdC8vIG9wZW4gcG9wdXAgb24gdGhlIGZpcnN0IGxheWVyXHJcblx0XHRmb3IgKHZhciBpZCBpbiB0aGlzLl9sYXllcnMpIHtcclxuXHRcdFx0dGhpcy5fbGF5ZXJzW2lkXS5vcGVuUG9wdXAobGF0bG5nKTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRzZXRTdHlsZTogZnVuY3Rpb24gKHN0eWxlKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5pbnZva2UoJ3NldFN0eWxlJywgc3R5bGUpO1xyXG5cdH0sXHJcblxyXG5cdGJyaW5nVG9Gcm9udDogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuaW52b2tlKCdicmluZ1RvRnJvbnQnKTtcclxuXHR9LFxyXG5cclxuXHRicmluZ1RvQmFjazogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuaW52b2tlKCdicmluZ1RvQmFjaycpO1xyXG5cdH0sXHJcblxyXG5cdGdldEJvdW5kczogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIGJvdW5kcyA9IG5ldyBMLkxhdExuZ0JvdW5kcygpO1xyXG5cclxuXHRcdHRoaXMuZWFjaExheWVyKGZ1bmN0aW9uIChsYXllcikge1xyXG5cdFx0XHRib3VuZHMuZXh0ZW5kKGxheWVyIGluc3RhbmNlb2YgTC5NYXJrZXIgPyBsYXllci5nZXRMYXRMbmcoKSA6IGxheWVyLmdldEJvdW5kcygpKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiBib3VuZHM7XHJcblx0fSxcclxuXHJcblx0X3Byb3BhZ2F0ZUV2ZW50OiBmdW5jdGlvbiAoZSkge1xyXG5cdFx0ZSA9IEwuZXh0ZW5kKHtcclxuXHRcdFx0bGF5ZXI6IGUudGFyZ2V0LFxyXG5cdFx0XHR0YXJnZXQ6IHRoaXNcclxuXHRcdH0sIGUpO1xyXG5cdFx0dGhpcy5maXJlKGUudHlwZSwgZSk7XHJcblx0fVxyXG59KTtcclxuXHJcbkwuZmVhdHVyZUdyb3VwID0gZnVuY3Rpb24gKGxheWVycykge1xyXG5cdHJldHVybiBuZXcgTC5GZWF0dXJlR3JvdXAobGF5ZXJzKTtcclxufTtcclxuXG5cbi8qXHJcbiAqIEwuUGF0aCBpcyBhIGJhc2UgY2xhc3MgZm9yIHJlbmRlcmluZyB2ZWN0b3IgcGF0aHMgb24gYSBtYXAuIEluaGVyaXRlZCBieSBQb2x5bGluZSwgQ2lyY2xlLCBldGMuXHJcbiAqL1xyXG5cclxuTC5QYXRoID0gTC5DbGFzcy5leHRlbmQoe1xyXG5cdGluY2x1ZGVzOiBbTC5NaXhpbi5FdmVudHNdLFxyXG5cclxuXHRzdGF0aWNzOiB7XHJcblx0XHQvLyBob3cgbXVjaCB0byBleHRlbmQgdGhlIGNsaXAgYXJlYSBhcm91bmQgdGhlIG1hcCB2aWV3XHJcblx0XHQvLyAocmVsYXRpdmUgdG8gaXRzIHNpemUsIGUuZy4gMC41IGlzIGhhbGYgdGhlIHNjcmVlbiBpbiBlYWNoIGRpcmVjdGlvbilcclxuXHRcdC8vIHNldCBpdCBzbyB0aGF0IFNWRyBlbGVtZW50IGRvZXNuJ3QgZXhjZWVkIDEyODBweCAodmVjdG9ycyBmbGlja2VyIG9uIGRyYWdlbmQgaWYgaXQgaXMpXHJcblx0XHRDTElQX1BBRERJTkc6IChmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciBtYXggPSBMLkJyb3dzZXIubW9iaWxlID8gMTI4MCA6IDIwMDAsXHJcblx0XHRcdCAgICB0YXJnZXQgPSAobWF4IC8gTWF0aC5tYXgod2luZG93Lm91dGVyV2lkdGgsIHdpbmRvdy5vdXRlckhlaWdodCkgLSAxKSAvIDI7XHJcblx0XHRcdHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbigwLjUsIHRhcmdldCkpO1xyXG5cdFx0fSkoKVxyXG5cdH0sXHJcblxyXG5cdG9wdGlvbnM6IHtcclxuXHRcdHN0cm9rZTogdHJ1ZSxcclxuXHRcdGNvbG9yOiAnIzAwMzNmZicsXHJcblx0XHRkYXNoQXJyYXk6IG51bGwsXHJcblx0XHRsaW5lQ2FwOiBudWxsLFxyXG5cdFx0bGluZUpvaW46IG51bGwsXHJcblx0XHR3ZWlnaHQ6IDUsXHJcblx0XHRvcGFjaXR5OiAwLjUsXHJcblxyXG5cdFx0ZmlsbDogZmFsc2UsXHJcblx0XHRmaWxsQ29sb3I6IG51bGwsIC8vc2FtZSBhcyBjb2xvciBieSBkZWZhdWx0XHJcblx0XHRmaWxsT3BhY2l0eTogMC4yLFxyXG5cclxuXHRcdGNsaWNrYWJsZTogdHJ1ZVxyXG5cdH0sXHJcblxyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcblx0XHRMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblx0fSxcclxuXHJcblx0b25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcclxuXHRcdHRoaXMuX21hcCA9IG1hcDtcclxuXHJcblx0XHRpZiAoIXRoaXMuX2NvbnRhaW5lcikge1xyXG5cdFx0XHR0aGlzLl9pbml0RWxlbWVudHMoKTtcclxuXHRcdFx0dGhpcy5faW5pdEV2ZW50cygpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMucHJvamVjdExhdGxuZ3MoKTtcclxuXHRcdHRoaXMuX3VwZGF0ZVBhdGgoKTtcclxuXHJcblx0XHRpZiAodGhpcy5fY29udGFpbmVyKSB7XHJcblx0XHRcdHRoaXMuX21hcC5fcGF0aFJvb3QuYXBwZW5kQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmZpcmUoJ2FkZCcpO1xyXG5cclxuXHRcdG1hcC5vbih7XHJcblx0XHRcdCd2aWV3cmVzZXQnOiB0aGlzLnByb2plY3RMYXRsbmdzLFxyXG5cdFx0XHQnbW92ZWVuZCc6IHRoaXMuX3VwZGF0ZVBhdGhcclxuXHRcdH0sIHRoaXMpO1xyXG5cdH0sXHJcblxyXG5cdGFkZFRvOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHRtYXAuYWRkTGF5ZXIodGhpcyk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRvblJlbW92ZTogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0bWFwLl9wYXRoUm9vdC5yZW1vdmVDaGlsZCh0aGlzLl9jb250YWluZXIpO1xyXG5cclxuXHRcdC8vIE5lZWQgdG8gZmlyZSByZW1vdmUgZXZlbnQgYmVmb3JlIHdlIHNldCBfbWFwIHRvIG51bGwgYXMgdGhlIGV2ZW50IGhvb2tzIG1pZ2h0IG5lZWQgdGhlIG9iamVjdFxyXG5cdFx0dGhpcy5maXJlKCdyZW1vdmUnKTtcclxuXHRcdHRoaXMuX21hcCA9IG51bGw7XHJcblxyXG5cdFx0aWYgKEwuQnJvd3Nlci52bWwpIHtcclxuXHRcdFx0dGhpcy5fY29udGFpbmVyID0gbnVsbDtcclxuXHRcdFx0dGhpcy5fc3Ryb2tlID0gbnVsbDtcclxuXHRcdFx0dGhpcy5fZmlsbCA9IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0bWFwLm9mZih7XHJcblx0XHRcdCd2aWV3cmVzZXQnOiB0aGlzLnByb2plY3RMYXRsbmdzLFxyXG5cdFx0XHQnbW92ZWVuZCc6IHRoaXMuX3VwZGF0ZVBhdGhcclxuXHRcdH0sIHRoaXMpO1xyXG5cdH0sXHJcblxyXG5cdHByb2plY3RMYXRsbmdzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHQvLyBkbyBhbGwgcHJvamVjdGlvbiBzdHVmZiBoZXJlXHJcblx0fSxcclxuXHJcblx0c2V0U3R5bGU6IGZ1bmN0aW9uIChzdHlsZSkge1xyXG5cdFx0TC5zZXRPcHRpb25zKHRoaXMsIHN0eWxlKTtcclxuXHJcblx0XHRpZiAodGhpcy5fY29udGFpbmVyKSB7XHJcblx0XHRcdHRoaXMuX3VwZGF0ZVN0eWxlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0cmVkcmF3OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fbWFwKSB7XHJcblx0XHRcdHRoaXMucHJvamVjdExhdGxuZ3MoKTtcclxuXHRcdFx0dGhpcy5fdXBkYXRlUGF0aCgpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG59KTtcclxuXHJcbkwuTWFwLmluY2x1ZGUoe1xyXG5cdF91cGRhdGVQYXRoVmlld3BvcnQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBwID0gTC5QYXRoLkNMSVBfUEFERElORyxcclxuXHRcdCAgICBzaXplID0gdGhpcy5nZXRTaXplKCksXHJcblx0XHQgICAgcGFuZVBvcyA9IEwuRG9tVXRpbC5nZXRQb3NpdGlvbih0aGlzLl9tYXBQYW5lKSxcclxuXHRcdCAgICBtaW4gPSBwYW5lUG9zLm11bHRpcGx5QnkoLTEpLl9zdWJ0cmFjdChzaXplLm11bHRpcGx5QnkocCkuX3JvdW5kKCkpLFxyXG5cdFx0ICAgIG1heCA9IG1pbi5hZGQoc2l6ZS5tdWx0aXBseUJ5KDEgKyBwICogMikuX3JvdW5kKCkpO1xyXG5cclxuXHRcdHRoaXMuX3BhdGhWaWV3cG9ydCA9IG5ldyBMLkJvdW5kcyhtaW4sIG1heCk7XHJcblx0fVxyXG59KTtcclxuXG5cbi8qXHJcbiAqIEV4dGVuZHMgTC5QYXRoIHdpdGggU1ZHLXNwZWNpZmljIHJlbmRlcmluZyBjb2RlLlxyXG4gKi9cclxuXHJcbkwuUGF0aC5TVkdfTlMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xyXG5cclxuTC5Ccm93c2VyLnN2ZyA9ICEhKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyAmJiBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoTC5QYXRoLlNWR19OUywgJ3N2ZycpLmNyZWF0ZVNWR1JlY3QpO1xyXG5cclxuTC5QYXRoID0gTC5QYXRoLmV4dGVuZCh7XHJcblx0c3RhdGljczoge1xyXG5cdFx0U1ZHOiBMLkJyb3dzZXIuc3ZnXHJcblx0fSxcclxuXHJcblx0YnJpbmdUb0Zyb250OiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgcm9vdCA9IHRoaXMuX21hcC5fcGF0aFJvb3QsXHJcblx0XHQgICAgcGF0aCA9IHRoaXMuX2NvbnRhaW5lcjtcclxuXHJcblx0XHRpZiAocGF0aCAmJiByb290Lmxhc3RDaGlsZCAhPT0gcGF0aCkge1xyXG5cdFx0XHRyb290LmFwcGVuZENoaWxkKHBhdGgpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0YnJpbmdUb0JhY2s6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciByb290ID0gdGhpcy5fbWFwLl9wYXRoUm9vdCxcclxuXHRcdCAgICBwYXRoID0gdGhpcy5fY29udGFpbmVyLFxyXG5cdFx0ICAgIGZpcnN0ID0gcm9vdC5maXJzdENoaWxkO1xyXG5cclxuXHRcdGlmIChwYXRoICYmIGZpcnN0ICE9PSBwYXRoKSB7XHJcblx0XHRcdHJvb3QuaW5zZXJ0QmVmb3JlKHBhdGgsIGZpcnN0KTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGdldFBhdGhTdHJpbmc6IGZ1bmN0aW9uICgpIHtcclxuXHRcdC8vIGZvcm0gcGF0aCBzdHJpbmcgaGVyZVxyXG5cdH0sXHJcblxyXG5cdF9jcmVhdGVFbGVtZW50OiBmdW5jdGlvbiAobmFtZSkge1xyXG5cdFx0cmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhMLlBhdGguU1ZHX05TLCBuYW1lKTtcclxuXHR9LFxyXG5cclxuXHRfaW5pdEVsZW1lbnRzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLl9tYXAuX2luaXRQYXRoUm9vdCgpO1xyXG5cdFx0dGhpcy5faW5pdFBhdGgoKTtcclxuXHRcdHRoaXMuX2luaXRTdHlsZSgpO1xyXG5cdH0sXHJcblxyXG5cdF9pbml0UGF0aDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dGhpcy5fY29udGFpbmVyID0gdGhpcy5fY3JlYXRlRWxlbWVudCgnZycpO1xyXG5cclxuXHRcdHRoaXMuX3BhdGggPSB0aGlzLl9jcmVhdGVFbGVtZW50KCdwYXRoJyk7XHJcblxyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5jbGFzc05hbWUpIHtcclxuXHRcdFx0TC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGgsIHRoaXMub3B0aW9ucy5jbGFzc05hbWUpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl9wYXRoKTtcclxuXHR9LFxyXG5cclxuXHRfaW5pdFN0eWxlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnN0cm9rZSkge1xyXG5cdFx0XHR0aGlzLl9wYXRoLnNldEF0dHJpYnV0ZSgnc3Ryb2tlLWxpbmVqb2luJywgJ3JvdW5kJyk7XHJcblx0XHRcdHRoaXMuX3BhdGguc2V0QXR0cmlidXRlKCdzdHJva2UtbGluZWNhcCcsICdyb3VuZCcpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5maWxsKSB7XHJcblx0XHRcdHRoaXMuX3BhdGguc2V0QXR0cmlidXRlKCdmaWxsLXJ1bGUnLCAnZXZlbm9kZCcpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5wb2ludGVyRXZlbnRzKSB7XHJcblx0XHRcdHRoaXMuX3BhdGguc2V0QXR0cmlidXRlKCdwb2ludGVyLWV2ZW50cycsIHRoaXMub3B0aW9ucy5wb2ludGVyRXZlbnRzKTtcclxuXHRcdH1cclxuXHRcdGlmICghdGhpcy5vcHRpb25zLmNsaWNrYWJsZSAmJiAhdGhpcy5vcHRpb25zLnBvaW50ZXJFdmVudHMpIHtcclxuXHRcdFx0dGhpcy5fcGF0aC5zZXRBdHRyaWJ1dGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKTtcclxuXHRcdH1cclxuXHRcdHRoaXMuX3VwZGF0ZVN0eWxlKCk7XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZVN0eWxlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnN0cm9rZSkge1xyXG5cdFx0XHR0aGlzLl9wYXRoLnNldEF0dHJpYnV0ZSgnc3Ryb2tlJywgdGhpcy5vcHRpb25zLmNvbG9yKTtcclxuXHRcdFx0dGhpcy5fcGF0aC5zZXRBdHRyaWJ1dGUoJ3N0cm9rZS1vcGFjaXR5JywgdGhpcy5vcHRpb25zLm9wYWNpdHkpO1xyXG5cdFx0XHR0aGlzLl9wYXRoLnNldEF0dHJpYnV0ZSgnc3Ryb2tlLXdpZHRoJywgdGhpcy5vcHRpb25zLndlaWdodCk7XHJcblx0XHRcdGlmICh0aGlzLm9wdGlvbnMuZGFzaEFycmF5KSB7XHJcblx0XHRcdFx0dGhpcy5fcGF0aC5zZXRBdHRyaWJ1dGUoJ3N0cm9rZS1kYXNoYXJyYXknLCB0aGlzLm9wdGlvbnMuZGFzaEFycmF5KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl9wYXRoLnJlbW92ZUF0dHJpYnV0ZSgnc3Ryb2tlLWRhc2hhcnJheScpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICh0aGlzLm9wdGlvbnMubGluZUNhcCkge1xyXG5cdFx0XHRcdHRoaXMuX3BhdGguc2V0QXR0cmlidXRlKCdzdHJva2UtbGluZWNhcCcsIHRoaXMub3B0aW9ucy5saW5lQ2FwKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAodGhpcy5vcHRpb25zLmxpbmVKb2luKSB7XHJcblx0XHRcdFx0dGhpcy5fcGF0aC5zZXRBdHRyaWJ1dGUoJ3N0cm9rZS1saW5lam9pbicsIHRoaXMub3B0aW9ucy5saW5lSm9pbik7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuX3BhdGguc2V0QXR0cmlidXRlKCdzdHJva2UnLCAnbm9uZScpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5maWxsKSB7XHJcblx0XHRcdHRoaXMuX3BhdGguc2V0QXR0cmlidXRlKCdmaWxsJywgdGhpcy5vcHRpb25zLmZpbGxDb2xvciB8fCB0aGlzLm9wdGlvbnMuY29sb3IpO1xyXG5cdFx0XHR0aGlzLl9wYXRoLnNldEF0dHJpYnV0ZSgnZmlsbC1vcGFjaXR5JywgdGhpcy5vcHRpb25zLmZpbGxPcGFjaXR5KTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuX3BhdGguc2V0QXR0cmlidXRlKCdmaWxsJywgJ25vbmUnKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHN0ciA9IHRoaXMuZ2V0UGF0aFN0cmluZygpO1xyXG5cdFx0aWYgKCFzdHIpIHtcclxuXHRcdFx0Ly8gZml4IHdlYmtpdCBlbXB0eSBzdHJpbmcgcGFyc2luZyBidWdcclxuXHRcdFx0c3RyID0gJ00wIDAnO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5fcGF0aC5zZXRBdHRyaWJ1dGUoJ2QnLCBzdHIpO1xyXG5cdH0sXHJcblxyXG5cdC8vIFRPRE8gcmVtb3ZlIGR1cGxpY2F0aW9uIHdpdGggTC5NYXBcclxuXHRfaW5pdEV2ZW50czogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5jbGlja2FibGUpIHtcclxuXHRcdFx0aWYgKEwuQnJvd3Nlci5zdmcgfHwgIUwuQnJvd3Nlci52bWwpIHtcclxuXHRcdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aCwgJ2xlYWZsZXQtY2xpY2thYmxlJyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdEwuRG9tRXZlbnQub24odGhpcy5fY29udGFpbmVyLCAnY2xpY2snLCB0aGlzLl9vbk1vdXNlQ2xpY2ssIHRoaXMpO1xyXG5cclxuXHRcdFx0dmFyIGV2ZW50cyA9IFsnZGJsY2xpY2snLCAnbW91c2Vkb3duJywgJ21vdXNlb3ZlcicsXHJcblx0XHRcdCAgICAgICAgICAgICAgJ21vdXNlb3V0JywgJ21vdXNlbW92ZScsICdjb250ZXh0bWVudSddO1xyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdEwuRG9tRXZlbnQub24odGhpcy5fY29udGFpbmVyLCBldmVudHNbaV0sIHRoaXMuX2ZpcmVNb3VzZUV2ZW50LCB0aGlzKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9vbk1vdXNlQ2xpY2s6IGZ1bmN0aW9uIChlKSB7XHJcblx0XHRpZiAodGhpcy5fbWFwLmRyYWdnaW5nICYmIHRoaXMuX21hcC5kcmFnZ2luZy5tb3ZlZCgpKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHRoaXMuX2ZpcmVNb3VzZUV2ZW50KGUpO1xyXG5cdH0sXHJcblxyXG5cdF9maXJlTW91c2VFdmVudDogZnVuY3Rpb24gKGUpIHtcclxuXHRcdGlmICghdGhpcy5oYXNFdmVudExpc3RlbmVycyhlLnR5cGUpKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXAsXHJcblx0XHQgICAgY29udGFpbmVyUG9pbnQgPSBtYXAubW91c2VFdmVudFRvQ29udGFpbmVyUG9pbnQoZSksXHJcblx0XHQgICAgbGF5ZXJQb2ludCA9IG1hcC5jb250YWluZXJQb2ludFRvTGF5ZXJQb2ludChjb250YWluZXJQb2ludCksXHJcblx0XHQgICAgbGF0bG5nID0gbWFwLmxheWVyUG9pbnRUb0xhdExuZyhsYXllclBvaW50KTtcclxuXHJcblx0XHR0aGlzLmZpcmUoZS50eXBlLCB7XHJcblx0XHRcdGxhdGxuZzogbGF0bG5nLFxyXG5cdFx0XHRsYXllclBvaW50OiBsYXllclBvaW50LFxyXG5cdFx0XHRjb250YWluZXJQb2ludDogY29udGFpbmVyUG9pbnQsXHJcblx0XHRcdG9yaWdpbmFsRXZlbnQ6IGVcclxuXHRcdH0pO1xyXG5cclxuXHRcdGlmIChlLnR5cGUgPT09ICdjb250ZXh0bWVudScpIHtcclxuXHRcdFx0TC5Eb21FdmVudC5wcmV2ZW50RGVmYXVsdChlKTtcclxuXHRcdH1cclxuXHRcdGlmIChlLnR5cGUgIT09ICdtb3VzZW1vdmUnKSB7XHJcblx0XHRcdEwuRG9tRXZlbnQuc3RvcFByb3BhZ2F0aW9uKGUpO1xyXG5cdFx0fVxyXG5cdH1cclxufSk7XHJcblxyXG5MLk1hcC5pbmNsdWRlKHtcclxuXHRfaW5pdFBhdGhSb290OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAoIXRoaXMuX3BhdGhSb290KSB7XHJcblx0XHRcdHRoaXMuX3BhdGhSb290ID0gTC5QYXRoLnByb3RvdHlwZS5fY3JlYXRlRWxlbWVudCgnc3ZnJyk7XHJcblx0XHRcdHRoaXMuX3BhbmVzLm92ZXJsYXlQYW5lLmFwcGVuZENoaWxkKHRoaXMuX3BhdGhSb290KTtcclxuXHJcblx0XHRcdGlmICh0aGlzLm9wdGlvbnMuem9vbUFuaW1hdGlvbiAmJiBMLkJyb3dzZXIuYW55M2QpIHtcclxuXHRcdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aFJvb3QsICdsZWFmbGV0LXpvb20tYW5pbWF0ZWQnKTtcclxuXHJcblx0XHRcdFx0dGhpcy5vbih7XHJcblx0XHRcdFx0XHQnem9vbWFuaW0nOiB0aGlzLl9hbmltYXRlUGF0aFpvb20sXHJcblx0XHRcdFx0XHQnem9vbWVuZCc6IHRoaXMuX2VuZFBhdGhab29tXHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0TC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGhSb290LCAnbGVhZmxldC16b29tLWhpZGUnKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5vbignbW92ZWVuZCcsIHRoaXMuX3VwZGF0ZVN2Z1ZpZXdwb3J0KTtcclxuXHRcdFx0dGhpcy5fdXBkYXRlU3ZnVmlld3BvcnQoKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfYW5pbWF0ZVBhdGhab29tOiBmdW5jdGlvbiAoZSkge1xyXG5cdFx0dmFyIHNjYWxlID0gdGhpcy5nZXRab29tU2NhbGUoZS56b29tKSxcclxuXHRcdCAgICBvZmZzZXQgPSB0aGlzLl9nZXRDZW50ZXJPZmZzZXQoZS5jZW50ZXIpLl9tdWx0aXBseUJ5KC1zY2FsZSkuX2FkZCh0aGlzLl9wYXRoVmlld3BvcnQubWluKTtcclxuXHJcblx0XHR0aGlzLl9wYXRoUm9vdC5zdHlsZVtMLkRvbVV0aWwuVFJBTlNGT1JNXSA9XHJcblx0XHQgICAgICAgIEwuRG9tVXRpbC5nZXRUcmFuc2xhdGVTdHJpbmcob2Zmc2V0KSArICcgc2NhbGUoJyArIHNjYWxlICsgJykgJztcclxuXHJcblx0XHR0aGlzLl9wYXRoWm9vbWluZyA9IHRydWU7XHJcblx0fSxcclxuXHJcblx0X2VuZFBhdGhab29tOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLl9wYXRoWm9vbWluZyA9IGZhbHNlO1xyXG5cdH0sXHJcblxyXG5cdF91cGRhdGVTdmdWaWV3cG9ydDogZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGlmICh0aGlzLl9wYXRoWm9vbWluZykge1xyXG5cdFx0XHQvLyBEbyBub3QgdXBkYXRlIFNWR3Mgd2hpbGUgYSB6b29tIGFuaW1hdGlvbiBpcyBnb2luZyBvbiBvdGhlcndpc2UgdGhlIGFuaW1hdGlvbiB3aWxsIGJyZWFrLlxyXG5cdFx0XHQvLyBXaGVuIHRoZSB6b29tIGFuaW1hdGlvbiBlbmRzIHdlIHdpbGwgYmUgdXBkYXRlZCBhZ2FpbiBhbnl3YXlcclxuXHRcdFx0Ly8gVGhpcyBmaXhlcyB0aGUgY2FzZSB3aGVyZSB5b3UgZG8gYSBtb21lbnR1bSBtb3ZlIGFuZCB6b29tIHdoaWxlIHRoZSBtb3ZlIGlzIHN0aWxsIG9uZ29pbmcuXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl91cGRhdGVQYXRoVmlld3BvcnQoKTtcclxuXHJcblx0XHR2YXIgdnAgPSB0aGlzLl9wYXRoVmlld3BvcnQsXHJcblx0XHQgICAgbWluID0gdnAubWluLFxyXG5cdFx0ICAgIG1heCA9IHZwLm1heCxcclxuXHRcdCAgICB3aWR0aCA9IG1heC54IC0gbWluLngsXHJcblx0XHQgICAgaGVpZ2h0ID0gbWF4LnkgLSBtaW4ueSxcclxuXHRcdCAgICByb290ID0gdGhpcy5fcGF0aFJvb3QsXHJcblx0XHQgICAgcGFuZSA9IHRoaXMuX3BhbmVzLm92ZXJsYXlQYW5lO1xyXG5cclxuXHRcdC8vIEhhY2sgdG8gbWFrZSBmbGlja2VyIG9uIGRyYWcgZW5kIG9uIG1vYmlsZSB3ZWJraXQgbGVzcyBpcnJpdGF0aW5nXHJcblx0XHRpZiAoTC5Ccm93c2VyLm1vYmlsZVdlYmtpdCkge1xyXG5cdFx0XHRwYW5lLnJlbW92ZUNoaWxkKHJvb3QpO1xyXG5cdFx0fVxyXG5cclxuXHRcdEwuRG9tVXRpbC5zZXRQb3NpdGlvbihyb290LCBtaW4pO1xyXG5cdFx0cm9vdC5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgd2lkdGgpO1xyXG5cdFx0cm9vdC5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIGhlaWdodCk7XHJcblx0XHRyb290LnNldEF0dHJpYnV0ZSgndmlld0JveCcsIFttaW4ueCwgbWluLnksIHdpZHRoLCBoZWlnaHRdLmpvaW4oJyAnKSk7XHJcblxyXG5cdFx0aWYgKEwuQnJvd3Nlci5tb2JpbGVXZWJraXQpIHtcclxuXHRcdFx0cGFuZS5hcHBlbmRDaGlsZChyb290KTtcclxuXHRcdH1cclxuXHR9XHJcbn0pO1xyXG5cblxuLypcclxuICogUG9wdXAgZXh0ZW5zaW9uIHRvIEwuUGF0aCAocG9seWxpbmVzLCBwb2x5Z29ucywgY2lyY2xlcyksIGFkZGluZyBwb3B1cC1yZWxhdGVkIG1ldGhvZHMuXHJcbiAqL1xyXG5cclxuTC5QYXRoLmluY2x1ZGUoe1xyXG5cclxuXHRiaW5kUG9wdXA6IGZ1bmN0aW9uIChjb250ZW50LCBvcHRpb25zKSB7XHJcblxyXG5cdFx0aWYgKGNvbnRlbnQgaW5zdGFuY2VvZiBMLlBvcHVwKSB7XHJcblx0XHRcdHRoaXMuX3BvcHVwID0gY29udGVudDtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGlmICghdGhpcy5fcG9wdXAgfHwgb3B0aW9ucykge1xyXG5cdFx0XHRcdHRoaXMuX3BvcHVwID0gbmV3IEwuUG9wdXAob3B0aW9ucywgdGhpcyk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5fcG9wdXAuc2V0Q29udGVudChjb250ZW50KTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIXRoaXMuX3BvcHVwSGFuZGxlcnNBZGRlZCkge1xyXG5cdFx0XHR0aGlzXHJcblx0XHRcdCAgICAub24oJ2NsaWNrJywgdGhpcy5fb3BlblBvcHVwLCB0aGlzKVxyXG5cdFx0XHQgICAgLm9uKCdyZW1vdmUnLCB0aGlzLmNsb3NlUG9wdXAsIHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy5fcG9wdXBIYW5kbGVyc0FkZGVkID0gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHR1bmJpbmRQb3B1cDogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKHRoaXMuX3BvcHVwKSB7XHJcblx0XHRcdHRoaXMuX3BvcHVwID0gbnVsbDtcclxuXHRcdFx0dGhpc1xyXG5cdFx0XHQgICAgLm9mZignY2xpY2snLCB0aGlzLl9vcGVuUG9wdXApXHJcblx0XHRcdCAgICAub2ZmKCdyZW1vdmUnLCB0aGlzLmNsb3NlUG9wdXApO1xyXG5cclxuXHRcdFx0dGhpcy5fcG9wdXBIYW5kbGVyc0FkZGVkID0gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRvcGVuUG9wdXA6IGZ1bmN0aW9uIChsYXRsbmcpIHtcclxuXHJcblx0XHRpZiAodGhpcy5fcG9wdXApIHtcclxuXHRcdFx0Ly8gb3BlbiB0aGUgcG9wdXAgZnJvbSBvbmUgb2YgdGhlIHBhdGgncyBwb2ludHMgaWYgbm90IHNwZWNpZmllZFxyXG5cdFx0XHRsYXRsbmcgPSBsYXRsbmcgfHwgdGhpcy5fbGF0bG5nIHx8XHJcblx0XHRcdCAgICAgICAgIHRoaXMuX2xhdGxuZ3NbTWF0aC5mbG9vcih0aGlzLl9sYXRsbmdzLmxlbmd0aCAvIDIpXTtcclxuXHJcblx0XHRcdHRoaXMuX29wZW5Qb3B1cCh7bGF0bG5nOiBsYXRsbmd9KTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRjbG9zZVBvcHVwOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fcG9wdXApIHtcclxuXHRcdFx0dGhpcy5fcG9wdXAuX2Nsb3NlKCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRfb3BlblBvcHVwOiBmdW5jdGlvbiAoZSkge1xyXG5cdFx0dGhpcy5fcG9wdXAuc2V0TGF0TG5nKGUubGF0bG5nKTtcclxuXHRcdHRoaXMuX21hcC5vcGVuUG9wdXAodGhpcy5fcG9wdXApO1xyXG5cdH1cclxufSk7XHJcblxuXG4vKlxyXG4gKiBWZWN0b3IgcmVuZGVyaW5nIGZvciBJRTYtOCB0aHJvdWdoIFZNTC5cclxuICogVGhhbmtzIHRvIERtaXRyeSBCYXJhbm92c2t5IGFuZCBoaXMgUmFwaGFlbCBsaWJyYXJ5IGZvciBpbnNwaXJhdGlvbiFcclxuICovXHJcblxyXG5MLkJyb3dzZXIudm1sID0gIUwuQnJvd3Nlci5zdmcgJiYgKGZ1bmN0aW9uICgpIHtcclxuXHR0cnkge1xyXG5cdFx0dmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0ZGl2LmlubmVySFRNTCA9ICc8djpzaGFwZSBhZGo9XCIxXCIvPic7XHJcblxyXG5cdFx0dmFyIHNoYXBlID0gZGl2LmZpcnN0Q2hpbGQ7XHJcblx0XHRzaGFwZS5zdHlsZS5iZWhhdmlvciA9ICd1cmwoI2RlZmF1bHQjVk1MKSc7XHJcblxyXG5cdFx0cmV0dXJuIHNoYXBlICYmICh0eXBlb2Ygc2hhcGUuYWRqID09PSAnb2JqZWN0Jyk7XHJcblxyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn0oKSk7XHJcblxyXG5MLlBhdGggPSBMLkJyb3dzZXIuc3ZnIHx8ICFMLkJyb3dzZXIudm1sID8gTC5QYXRoIDogTC5QYXRoLmV4dGVuZCh7XHJcblx0c3RhdGljczoge1xyXG5cdFx0Vk1MOiB0cnVlLFxyXG5cdFx0Q0xJUF9QQURESU5HOiAwLjAyXHJcblx0fSxcclxuXHJcblx0X2NyZWF0ZUVsZW1lbnQ6IChmdW5jdGlvbiAoKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHRkb2N1bWVudC5uYW1lc3BhY2VzLmFkZCgnbHZtbCcsICd1cm46c2NoZW1hcy1taWNyb3NvZnQtY29tOnZtbCcpO1xyXG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24gKG5hbWUpIHtcclxuXHRcdFx0XHRyZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnPGx2bWw6JyArIG5hbWUgKyAnIGNsYXNzPVwibHZtbFwiPicpO1xyXG5cdFx0XHR9O1xyXG5cdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24gKG5hbWUpIHtcclxuXHRcdFx0XHRyZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcclxuXHRcdFx0XHQgICAgICAgICc8JyArIG5hbWUgKyAnIHhtbG5zPVwidXJuOnNjaGVtYXMtbWljcm9zb2Z0LmNvbTp2bWxcIiBjbGFzcz1cImx2bWxcIj4nKTtcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHR9KCkpLFxyXG5cclxuXHRfaW5pdFBhdGg6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBjb250YWluZXIgPSB0aGlzLl9jb250YWluZXIgPSB0aGlzLl9jcmVhdGVFbGVtZW50KCdzaGFwZScpO1xyXG5cclxuXHRcdEwuRG9tVXRpbC5hZGRDbGFzcyhjb250YWluZXIsICdsZWFmbGV0LXZtbC1zaGFwZScgK1xyXG5cdFx0XHQodGhpcy5vcHRpb25zLmNsYXNzTmFtZSA/ICcgJyArIHRoaXMub3B0aW9ucy5jbGFzc05hbWUgOiAnJykpO1xyXG5cclxuXHRcdGlmICh0aGlzLm9wdGlvbnMuY2xpY2thYmxlKSB7XHJcblx0XHRcdEwuRG9tVXRpbC5hZGRDbGFzcyhjb250YWluZXIsICdsZWFmbGV0LWNsaWNrYWJsZScpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnRhaW5lci5jb29yZHNpemUgPSAnMSAxJztcclxuXHJcblx0XHR0aGlzLl9wYXRoID0gdGhpcy5fY3JlYXRlRWxlbWVudCgncGF0aCcpO1xyXG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3BhdGgpO1xyXG5cclxuXHRcdHRoaXMuX21hcC5fcGF0aFJvb3QuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcclxuXHR9LFxyXG5cclxuXHRfaW5pdFN0eWxlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLl91cGRhdGVTdHlsZSgpO1xyXG5cdH0sXHJcblxyXG5cdF91cGRhdGVTdHlsZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHN0cm9rZSA9IHRoaXMuX3N0cm9rZSxcclxuXHRcdCAgICBmaWxsID0gdGhpcy5fZmlsbCxcclxuXHRcdCAgICBvcHRpb25zID0gdGhpcy5vcHRpb25zLFxyXG5cdFx0ICAgIGNvbnRhaW5lciA9IHRoaXMuX2NvbnRhaW5lcjtcclxuXHJcblx0XHRjb250YWluZXIuc3Ryb2tlZCA9IG9wdGlvbnMuc3Ryb2tlO1xyXG5cdFx0Y29udGFpbmVyLmZpbGxlZCA9IG9wdGlvbnMuZmlsbDtcclxuXHJcblx0XHRpZiAob3B0aW9ucy5zdHJva2UpIHtcclxuXHRcdFx0aWYgKCFzdHJva2UpIHtcclxuXHRcdFx0XHRzdHJva2UgPSB0aGlzLl9zdHJva2UgPSB0aGlzLl9jcmVhdGVFbGVtZW50KCdzdHJva2UnKTtcclxuXHRcdFx0XHRzdHJva2UuZW5kY2FwID0gJ3JvdW5kJztcclxuXHRcdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoc3Ryb2tlKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRzdHJva2Uud2VpZ2h0ID0gb3B0aW9ucy53ZWlnaHQgKyAncHgnO1xyXG5cdFx0XHRzdHJva2UuY29sb3IgPSBvcHRpb25zLmNvbG9yO1xyXG5cdFx0XHRzdHJva2Uub3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eTtcclxuXHJcblx0XHRcdGlmIChvcHRpb25zLmRhc2hBcnJheSkge1xyXG5cdFx0XHRcdHN0cm9rZS5kYXNoU3R5bGUgPSBMLlV0aWwuaXNBcnJheShvcHRpb25zLmRhc2hBcnJheSkgP1xyXG5cdFx0XHRcdCAgICBvcHRpb25zLmRhc2hBcnJheS5qb2luKCcgJykgOlxyXG5cdFx0XHRcdCAgICBvcHRpb25zLmRhc2hBcnJheS5yZXBsYWNlKC8oICosICopL2csICcgJyk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0c3Ryb2tlLmRhc2hTdHlsZSA9ICcnO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChvcHRpb25zLmxpbmVDYXApIHtcclxuXHRcdFx0XHRzdHJva2UuZW5kY2FwID0gb3B0aW9ucy5saW5lQ2FwLnJlcGxhY2UoJ2J1dHQnLCAnZmxhdCcpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChvcHRpb25zLmxpbmVKb2luKSB7XHJcblx0XHRcdFx0c3Ryb2tlLmpvaW5zdHlsZSA9IG9wdGlvbnMubGluZUpvaW47XHJcblx0XHRcdH1cclxuXHJcblx0XHR9IGVsc2UgaWYgKHN0cm9rZSkge1xyXG5cdFx0XHRjb250YWluZXIucmVtb3ZlQ2hpbGQoc3Ryb2tlKTtcclxuXHRcdFx0dGhpcy5fc3Ryb2tlID0gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAob3B0aW9ucy5maWxsKSB7XHJcblx0XHRcdGlmICghZmlsbCkge1xyXG5cdFx0XHRcdGZpbGwgPSB0aGlzLl9maWxsID0gdGhpcy5fY3JlYXRlRWxlbWVudCgnZmlsbCcpO1xyXG5cdFx0XHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChmaWxsKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRmaWxsLmNvbG9yID0gb3B0aW9ucy5maWxsQ29sb3IgfHwgb3B0aW9ucy5jb2xvcjtcclxuXHRcdFx0ZmlsbC5vcGFjaXR5ID0gb3B0aW9ucy5maWxsT3BhY2l0eTtcclxuXHJcblx0XHR9IGVsc2UgaWYgKGZpbGwpIHtcclxuXHRcdFx0Y29udGFpbmVyLnJlbW92ZUNoaWxkKGZpbGwpO1xyXG5cdFx0XHR0aGlzLl9maWxsID0gbnVsbDtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHN0eWxlID0gdGhpcy5fY29udGFpbmVyLnN0eWxlO1xyXG5cclxuXHRcdHN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcblx0XHR0aGlzLl9wYXRoLnYgPSB0aGlzLmdldFBhdGhTdHJpbmcoKSArICcgJzsgLy8gdGhlIHNwYWNlIGZpeGVzIElFIGVtcHR5IHBhdGggc3RyaW5nIGJ1Z1xyXG5cdFx0c3R5bGUuZGlzcGxheSA9ICcnO1xyXG5cdH1cclxufSk7XHJcblxyXG5MLk1hcC5pbmNsdWRlKEwuQnJvd3Nlci5zdmcgfHwgIUwuQnJvd3Nlci52bWwgPyB7fSA6IHtcclxuXHRfaW5pdFBhdGhSb290OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fcGF0aFJvb3QpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIHJvb3QgPSB0aGlzLl9wYXRoUm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0cm9vdC5jbGFzc05hbWUgPSAnbGVhZmxldC12bWwtY29udGFpbmVyJztcclxuXHRcdHRoaXMuX3BhbmVzLm92ZXJsYXlQYW5lLmFwcGVuZENoaWxkKHJvb3QpO1xyXG5cclxuXHRcdHRoaXMub24oJ21vdmVlbmQnLCB0aGlzLl91cGRhdGVQYXRoVmlld3BvcnQpO1xyXG5cdFx0dGhpcy5fdXBkYXRlUGF0aFZpZXdwb3J0KCk7XHJcblx0fVxyXG59KTtcclxuXG5cbi8qXHJcbiAqIFZlY3RvciByZW5kZXJpbmcgZm9yIGFsbCBicm93c2VycyB0aGF0IHN1cHBvcnQgY2FudmFzLlxyXG4gKi9cclxuXHJcbkwuQnJvd3Nlci5jYW52YXMgPSAoZnVuY3Rpb24gKCkge1xyXG5cdHJldHVybiAhIWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpLmdldENvbnRleHQ7XHJcbn0oKSk7XHJcblxyXG5MLlBhdGggPSAoTC5QYXRoLlNWRyAmJiAhd2luZG93LkxfUFJFRkVSX0NBTlZBUykgfHwgIUwuQnJvd3Nlci5jYW52YXMgPyBMLlBhdGggOiBMLlBhdGguZXh0ZW5kKHtcclxuXHRzdGF0aWNzOiB7XHJcblx0XHQvL0NMSVBfUEFERElORzogMC4wMiwgLy8gbm90IHN1cmUgaWYgdGhlcmUncyBhIG5lZWQgdG8gc2V0IGl0IHRvIGEgc21hbGwgdmFsdWVcclxuXHRcdENBTlZBUzogdHJ1ZSxcclxuXHRcdFNWRzogZmFsc2VcclxuXHR9LFxyXG5cclxuXHRyZWRyYXc6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICh0aGlzLl9tYXApIHtcclxuXHRcdFx0dGhpcy5wcm9qZWN0TGF0bG5ncygpO1xyXG5cdFx0XHR0aGlzLl9yZXF1ZXN0VXBkYXRlKCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRzZXRTdHlsZTogZnVuY3Rpb24gKHN0eWxlKSB7XHJcblx0XHRMLnNldE9wdGlvbnModGhpcywgc3R5bGUpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9tYXApIHtcclxuXHRcdFx0dGhpcy5fdXBkYXRlU3R5bGUoKTtcclxuXHRcdFx0dGhpcy5fcmVxdWVzdFVwZGF0ZSgpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0b25SZW1vdmU6IGZ1bmN0aW9uIChtYXApIHtcclxuXHRcdG1hcFxyXG5cdFx0ICAgIC5vZmYoJ3ZpZXdyZXNldCcsIHRoaXMucHJvamVjdExhdGxuZ3MsIHRoaXMpXHJcblx0XHQgICAgLm9mZignbW92ZWVuZCcsIHRoaXMuX3VwZGF0ZVBhdGgsIHRoaXMpO1xyXG5cclxuXHRcdGlmICh0aGlzLm9wdGlvbnMuY2xpY2thYmxlKSB7XHJcblx0XHRcdHRoaXMuX21hcC5vZmYoJ2NsaWNrJywgdGhpcy5fb25DbGljaywgdGhpcyk7XHJcblx0XHRcdHRoaXMuX21hcC5vZmYoJ21vdXNlbW92ZScsIHRoaXMuX29uTW91c2VNb3ZlLCB0aGlzKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9yZXF1ZXN0VXBkYXRlKCk7XHJcblx0XHRcclxuXHRcdHRoaXMuZmlyZSgncmVtb3ZlJyk7XHJcblx0XHR0aGlzLl9tYXAgPSBudWxsO1xyXG5cdH0sXHJcblxyXG5cdF9yZXF1ZXN0VXBkYXRlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fbWFwICYmICFMLlBhdGguX3VwZGF0ZVJlcXVlc3QpIHtcclxuXHRcdFx0TC5QYXRoLl91cGRhdGVSZXF1ZXN0ID0gTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUodGhpcy5fZmlyZU1hcE1vdmVFbmQsIHRoaXMuX21hcCk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X2ZpcmVNYXBNb3ZlRW5kOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRMLlBhdGguX3VwZGF0ZVJlcXVlc3QgPSBudWxsO1xyXG5cdFx0dGhpcy5maXJlKCdtb3ZlZW5kJyk7XHJcblx0fSxcclxuXHJcblx0X2luaXRFbGVtZW50czogZnVuY3Rpb24gKCkge1xyXG5cdFx0dGhpcy5fbWFwLl9pbml0UGF0aFJvb3QoKTtcclxuXHRcdHRoaXMuX2N0eCA9IHRoaXMuX21hcC5fY2FudmFzQ3R4O1xyXG5cdH0sXHJcblxyXG5cdF91cGRhdGVTdHlsZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMuc3Ryb2tlKSB7XHJcblx0XHRcdHRoaXMuX2N0eC5saW5lV2lkdGggPSBvcHRpb25zLndlaWdodDtcclxuXHRcdFx0dGhpcy5fY3R4LnN0cm9rZVN0eWxlID0gb3B0aW9ucy5jb2xvcjtcclxuXHRcdH1cclxuXHRcdGlmIChvcHRpb25zLmZpbGwpIHtcclxuXHRcdFx0dGhpcy5fY3R4LmZpbGxTdHlsZSA9IG9wdGlvbnMuZmlsbENvbG9yIHx8IG9wdGlvbnMuY29sb3I7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X2RyYXdQYXRoOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgaSwgaiwgbGVuLCBsZW4yLCBwb2ludCwgZHJhd01ldGhvZDtcclxuXHJcblx0XHR0aGlzLl9jdHguYmVnaW5QYXRoKCk7XHJcblxyXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gdGhpcy5fcGFydHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0Zm9yIChqID0gMCwgbGVuMiA9IHRoaXMuX3BhcnRzW2ldLmxlbmd0aDsgaiA8IGxlbjI7IGorKykge1xyXG5cdFx0XHRcdHBvaW50ID0gdGhpcy5fcGFydHNbaV1bal07XHJcblx0XHRcdFx0ZHJhd01ldGhvZCA9IChqID09PSAwID8gJ21vdmUnIDogJ2xpbmUnKSArICdUbyc7XHJcblxyXG5cdFx0XHRcdHRoaXMuX2N0eFtkcmF3TWV0aG9kXShwb2ludC54LCBwb2ludC55KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBUT0RPIHJlZmFjdG9yIHVnbHkgaGFja1xyXG5cdFx0XHRpZiAodGhpcyBpbnN0YW5jZW9mIEwuUG9seWdvbikge1xyXG5cdFx0XHRcdHRoaXMuX2N0eC5jbG9zZVBhdGgoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9jaGVja0lmRW1wdHk6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiAhdGhpcy5fcGFydHMubGVuZ3RoO1xyXG5cdH0sXHJcblxyXG5cdF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fY2hlY2tJZkVtcHR5KCkpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIGN0eCA9IHRoaXMuX2N0eCxcclxuXHRcdCAgICBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xyXG5cclxuXHRcdHRoaXMuX2RyYXdQYXRoKCk7XHJcblx0XHRjdHguc2F2ZSgpO1xyXG5cdFx0dGhpcy5fdXBkYXRlU3R5bGUoKTtcclxuXHJcblx0XHRpZiAob3B0aW9ucy5maWxsKSB7XHJcblx0XHRcdGN0eC5nbG9iYWxBbHBoYSA9IG9wdGlvbnMuZmlsbE9wYWNpdHk7XHJcblx0XHRcdGN0eC5maWxsKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMuc3Ryb2tlKSB7XHJcblx0XHRcdGN0eC5nbG9iYWxBbHBoYSA9IG9wdGlvbnMub3BhY2l0eTtcclxuXHRcdFx0Y3R4LnN0cm9rZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGN0eC5yZXN0b3JlKCk7XHJcblxyXG5cdFx0Ly8gVE9ETyBvcHRpbWl6YXRpb246IDEgZmlsbC9zdHJva2UgZm9yIGFsbCBmZWF0dXJlcyB3aXRoIGVxdWFsIHN0eWxlIGluc3RlYWQgb2YgMSBmb3IgZWFjaCBmZWF0dXJlXHJcblx0fSxcclxuXHJcblx0X2luaXRFdmVudHM6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICh0aGlzLm9wdGlvbnMuY2xpY2thYmxlKSB7XHJcblx0XHRcdC8vIFRPRE8gZGJsY2xpY2tcclxuXHRcdFx0dGhpcy5fbWFwLm9uKCdtb3VzZW1vdmUnLCB0aGlzLl9vbk1vdXNlTW92ZSwgdGhpcyk7XHJcblx0XHRcdHRoaXMuX21hcC5vbignY2xpY2snLCB0aGlzLl9vbkNsaWNrLCB0aGlzKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfb25DbGljazogZnVuY3Rpb24gKGUpIHtcclxuXHRcdGlmICh0aGlzLl9jb250YWluc1BvaW50KGUubGF5ZXJQb2ludCkpIHtcclxuXHRcdFx0dGhpcy5maXJlKCdjbGljaycsIGUpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9vbk1vdXNlTW92ZTogZnVuY3Rpb24gKGUpIHtcclxuXHRcdGlmICghdGhpcy5fbWFwIHx8IHRoaXMuX21hcC5fYW5pbWF0aW5nWm9vbSkgeyByZXR1cm47IH1cclxuXHJcblx0XHQvLyBUT0RPIGRvbid0IGRvIG9uIGVhY2ggbW92ZVxyXG5cdFx0aWYgKHRoaXMuX2NvbnRhaW5zUG9pbnQoZS5sYXllclBvaW50KSkge1xyXG5cdFx0XHR0aGlzLl9jdHguY2FudmFzLnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcclxuXHRcdFx0dGhpcy5fbW91c2VJbnNpZGUgPSB0cnVlO1xyXG5cdFx0XHR0aGlzLmZpcmUoJ21vdXNlb3ZlcicsIGUpO1xyXG5cclxuXHRcdH0gZWxzZSBpZiAodGhpcy5fbW91c2VJbnNpZGUpIHtcclxuXHRcdFx0dGhpcy5fY3R4LmNhbnZhcy5zdHlsZS5jdXJzb3IgPSAnJztcclxuXHRcdFx0dGhpcy5fbW91c2VJbnNpZGUgPSBmYWxzZTtcclxuXHRcdFx0dGhpcy5maXJlKCdtb3VzZW91dCcsIGUpO1xyXG5cdFx0fVxyXG5cdH1cclxufSk7XHJcblxyXG5MLk1hcC5pbmNsdWRlKChMLlBhdGguU1ZHICYmICF3aW5kb3cuTF9QUkVGRVJfQ0FOVkFTKSB8fCAhTC5Ccm93c2VyLmNhbnZhcyA/IHt9IDoge1xyXG5cdF9pbml0UGF0aFJvb3Q6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciByb290ID0gdGhpcy5fcGF0aFJvb3QsXHJcblx0XHQgICAgY3R4O1xyXG5cclxuXHRcdGlmICghcm9vdCkge1xyXG5cdFx0XHRyb290ID0gdGhpcy5fcGF0aFJvb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcclxuXHRcdFx0cm9vdC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XHJcblx0XHRcdGN0eCA9IHRoaXMuX2NhbnZhc0N0eCA9IHJvb3QuZ2V0Q29udGV4dCgnMmQnKTtcclxuXHJcblx0XHRcdGN0eC5saW5lQ2FwID0gJ3JvdW5kJztcclxuXHRcdFx0Y3R4LmxpbmVKb2luID0gJ3JvdW5kJztcclxuXHJcblx0XHRcdHRoaXMuX3BhbmVzLm92ZXJsYXlQYW5lLmFwcGVuZENoaWxkKHJvb3QpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy56b29tQW5pbWF0aW9uKSB7XHJcblx0XHRcdFx0dGhpcy5fcGF0aFJvb3QuY2xhc3NOYW1lID0gJ2xlYWZsZXQtem9vbS1hbmltYXRlZCc7XHJcblx0XHRcdFx0dGhpcy5vbignem9vbWFuaW0nLCB0aGlzLl9hbmltYXRlUGF0aFpvb20pO1xyXG5cdFx0XHRcdHRoaXMub24oJ3pvb21lbmQnLCB0aGlzLl9lbmRQYXRoWm9vbSk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5vbignbW92ZWVuZCcsIHRoaXMuX3VwZGF0ZUNhbnZhc1ZpZXdwb3J0KTtcclxuXHRcdFx0dGhpcy5fdXBkYXRlQ2FudmFzVmlld3BvcnQoKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfdXBkYXRlQ2FudmFzVmlld3BvcnQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdC8vIGRvbid0IHJlZHJhdyB3aGlsZSB6b29taW5nLiBTZWUgX3VwZGF0ZVN2Z1ZpZXdwb3J0IGZvciBtb3JlIGRldGFpbHNcclxuXHRcdGlmICh0aGlzLl9wYXRoWm9vbWluZykgeyByZXR1cm47IH1cclxuXHRcdHRoaXMuX3VwZGF0ZVBhdGhWaWV3cG9ydCgpO1xyXG5cclxuXHRcdHZhciB2cCA9IHRoaXMuX3BhdGhWaWV3cG9ydCxcclxuXHRcdCAgICBtaW4gPSB2cC5taW4sXHJcblx0XHQgICAgc2l6ZSA9IHZwLm1heC5zdWJ0cmFjdChtaW4pLFxyXG5cdFx0ICAgIHJvb3QgPSB0aGlzLl9wYXRoUm9vdDtcclxuXHJcblx0XHQvL1RPRE8gY2hlY2sgaWYgdGhpcyB3b3JrcyBwcm9wZXJseSBvbiBtb2JpbGUgd2Via2l0XHJcblx0XHRMLkRvbVV0aWwuc2V0UG9zaXRpb24ocm9vdCwgbWluKTtcclxuXHRcdHJvb3Qud2lkdGggPSBzaXplLng7XHJcblx0XHRyb290LmhlaWdodCA9IHNpemUueTtcclxuXHRcdHJvb3QuZ2V0Q29udGV4dCgnMmQnKS50cmFuc2xhdGUoLW1pbi54LCAtbWluLnkpO1xyXG5cdH1cclxufSk7XHJcblxuXG4vKlxyXG4gKiBMLkxpbmVVdGlsIGNvbnRhaW5zIGRpZmZlcmVudCB1dGlsaXR5IGZ1bmN0aW9ucyBmb3IgbGluZSBzZWdtZW50c1xyXG4gKiBhbmQgcG9seWxpbmVzIChjbGlwcGluZywgc2ltcGxpZmljYXRpb24sIGRpc3RhbmNlcywgZXRjLilcclxuICovXHJcblxyXG4vKmpzaGludCBiaXR3aXNlOmZhbHNlICovIC8vIGFsbG93IGJpdHdpc2Ugb3BlcmF0aW9ucyBmb3IgdGhpcyBmaWxlXHJcblxyXG5MLkxpbmVVdGlsID0ge1xyXG5cclxuXHQvLyBTaW1wbGlmeSBwb2x5bGluZSB3aXRoIHZlcnRleCByZWR1Y3Rpb24gYW5kIERvdWdsYXMtUGV1Y2tlciBzaW1wbGlmaWNhdGlvbi5cclxuXHQvLyBJbXByb3ZlcyByZW5kZXJpbmcgcGVyZm9ybWFuY2UgZHJhbWF0aWNhbGx5IGJ5IGxlc3NlbmluZyB0aGUgbnVtYmVyIG9mIHBvaW50cyB0byBkcmF3LlxyXG5cclxuXHRzaW1wbGlmeTogZnVuY3Rpb24gKC8qUG9pbnRbXSovIHBvaW50cywgLypOdW1iZXIqLyB0b2xlcmFuY2UpIHtcclxuXHRcdGlmICghdG9sZXJhbmNlIHx8ICFwb2ludHMubGVuZ3RoKSB7XHJcblx0XHRcdHJldHVybiBwb2ludHMuc2xpY2UoKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgc3FUb2xlcmFuY2UgPSB0b2xlcmFuY2UgKiB0b2xlcmFuY2U7XHJcblxyXG5cdFx0Ly8gc3RhZ2UgMTogdmVydGV4IHJlZHVjdGlvblxyXG5cdFx0cG9pbnRzID0gdGhpcy5fcmVkdWNlUG9pbnRzKHBvaW50cywgc3FUb2xlcmFuY2UpO1xyXG5cclxuXHRcdC8vIHN0YWdlIDI6IERvdWdsYXMtUGV1Y2tlciBzaW1wbGlmaWNhdGlvblxyXG5cdFx0cG9pbnRzID0gdGhpcy5fc2ltcGxpZnlEUChwb2ludHMsIHNxVG9sZXJhbmNlKTtcclxuXHJcblx0XHRyZXR1cm4gcG9pbnRzO1xyXG5cdH0sXHJcblxyXG5cdC8vIGRpc3RhbmNlIGZyb20gYSBwb2ludCB0byBhIHNlZ21lbnQgYmV0d2VlbiB0d28gcG9pbnRzXHJcblx0cG9pbnRUb1NlZ21lbnREaXN0YW5jZTogIGZ1bmN0aW9uICgvKlBvaW50Ki8gcCwgLypQb2ludCovIHAxLCAvKlBvaW50Ki8gcDIpIHtcclxuXHRcdHJldHVybiBNYXRoLnNxcnQodGhpcy5fc3FDbG9zZXN0UG9pbnRPblNlZ21lbnQocCwgcDEsIHAyLCB0cnVlKSk7XHJcblx0fSxcclxuXHJcblx0Y2xvc2VzdFBvaW50T25TZWdtZW50OiBmdW5jdGlvbiAoLypQb2ludCovIHAsIC8qUG9pbnQqLyBwMSwgLypQb2ludCovIHAyKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fc3FDbG9zZXN0UG9pbnRPblNlZ21lbnQocCwgcDEsIHAyKTtcclxuXHR9LFxyXG5cclxuXHQvLyBEb3VnbGFzLVBldWNrZXIgc2ltcGxpZmljYXRpb24sIHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0RvdWdsYXMtUGV1Y2tlcl9hbGdvcml0aG1cclxuXHRfc2ltcGxpZnlEUDogZnVuY3Rpb24gKHBvaW50cywgc3FUb2xlcmFuY2UpIHtcclxuXHJcblx0XHR2YXIgbGVuID0gcG9pbnRzLmxlbmd0aCxcclxuXHRcdCAgICBBcnJheUNvbnN0cnVjdG9yID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09IHVuZGVmaW5lZCArICcnID8gVWludDhBcnJheSA6IEFycmF5LFxyXG5cdFx0ICAgIG1hcmtlcnMgPSBuZXcgQXJyYXlDb25zdHJ1Y3RvcihsZW4pO1xyXG5cclxuXHRcdG1hcmtlcnNbMF0gPSBtYXJrZXJzW2xlbiAtIDFdID0gMTtcclxuXHJcblx0XHR0aGlzLl9zaW1wbGlmeURQU3RlcChwb2ludHMsIG1hcmtlcnMsIHNxVG9sZXJhbmNlLCAwLCBsZW4gLSAxKTtcclxuXHJcblx0XHR2YXIgaSxcclxuXHRcdCAgICBuZXdQb2ludHMgPSBbXTtcclxuXHJcblx0XHRmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0aWYgKG1hcmtlcnNbaV0pIHtcclxuXHRcdFx0XHRuZXdQb2ludHMucHVzaChwb2ludHNbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG5ld1BvaW50cztcclxuXHR9LFxyXG5cclxuXHRfc2ltcGxpZnlEUFN0ZXA6IGZ1bmN0aW9uIChwb2ludHMsIG1hcmtlcnMsIHNxVG9sZXJhbmNlLCBmaXJzdCwgbGFzdCkge1xyXG5cclxuXHRcdHZhciBtYXhTcURpc3QgPSAwLFxyXG5cdFx0ICAgIGluZGV4LCBpLCBzcURpc3Q7XHJcblxyXG5cdFx0Zm9yIChpID0gZmlyc3QgKyAxOyBpIDw9IGxhc3QgLSAxOyBpKyspIHtcclxuXHRcdFx0c3FEaXN0ID0gdGhpcy5fc3FDbG9zZXN0UG9pbnRPblNlZ21lbnQocG9pbnRzW2ldLCBwb2ludHNbZmlyc3RdLCBwb2ludHNbbGFzdF0sIHRydWUpO1xyXG5cclxuXHRcdFx0aWYgKHNxRGlzdCA+IG1heFNxRGlzdCkge1xyXG5cdFx0XHRcdGluZGV4ID0gaTtcclxuXHRcdFx0XHRtYXhTcURpc3QgPSBzcURpc3Q7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAobWF4U3FEaXN0ID4gc3FUb2xlcmFuY2UpIHtcclxuXHRcdFx0bWFya2Vyc1tpbmRleF0gPSAxO1xyXG5cclxuXHRcdFx0dGhpcy5fc2ltcGxpZnlEUFN0ZXAocG9pbnRzLCBtYXJrZXJzLCBzcVRvbGVyYW5jZSwgZmlyc3QsIGluZGV4KTtcclxuXHRcdFx0dGhpcy5fc2ltcGxpZnlEUFN0ZXAocG9pbnRzLCBtYXJrZXJzLCBzcVRvbGVyYW5jZSwgaW5kZXgsIGxhc3QpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdC8vIHJlZHVjZSBwb2ludHMgdGhhdCBhcmUgdG9vIGNsb3NlIHRvIGVhY2ggb3RoZXIgdG8gYSBzaW5nbGUgcG9pbnRcclxuXHRfcmVkdWNlUG9pbnRzOiBmdW5jdGlvbiAocG9pbnRzLCBzcVRvbGVyYW5jZSkge1xyXG5cdFx0dmFyIHJlZHVjZWRQb2ludHMgPSBbcG9pbnRzWzBdXTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMSwgcHJldiA9IDAsIGxlbiA9IHBvaW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0XHRpZiAodGhpcy5fc3FEaXN0KHBvaW50c1tpXSwgcG9pbnRzW3ByZXZdKSA+IHNxVG9sZXJhbmNlKSB7XHJcblx0XHRcdFx0cmVkdWNlZFBvaW50cy5wdXNoKHBvaW50c1tpXSk7XHJcblx0XHRcdFx0cHJldiA9IGk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGlmIChwcmV2IDwgbGVuIC0gMSkge1xyXG5cdFx0XHRyZWR1Y2VkUG9pbnRzLnB1c2gocG9pbnRzW2xlbiAtIDFdKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiByZWR1Y2VkUG9pbnRzO1xyXG5cdH0sXHJcblxyXG5cdC8vIENvaGVuLVN1dGhlcmxhbmQgbGluZSBjbGlwcGluZyBhbGdvcml0aG0uXHJcblx0Ly8gVXNlZCB0byBhdm9pZCByZW5kZXJpbmcgcGFydHMgb2YgYSBwb2x5bGluZSB0aGF0IGFyZSBub3QgY3VycmVudGx5IHZpc2libGUuXHJcblxyXG5cdGNsaXBTZWdtZW50OiBmdW5jdGlvbiAoYSwgYiwgYm91bmRzLCB1c2VMYXN0Q29kZSkge1xyXG5cdFx0dmFyIGNvZGVBID0gdXNlTGFzdENvZGUgPyB0aGlzLl9sYXN0Q29kZSA6IHRoaXMuX2dldEJpdENvZGUoYSwgYm91bmRzKSxcclxuXHRcdCAgICBjb2RlQiA9IHRoaXMuX2dldEJpdENvZGUoYiwgYm91bmRzKSxcclxuXHJcblx0XHQgICAgY29kZU91dCwgcCwgbmV3Q29kZTtcclxuXHJcblx0XHQvLyBzYXZlIDJuZCBjb2RlIHRvIGF2b2lkIGNhbGN1bGF0aW5nIGl0IG9uIHRoZSBuZXh0IHNlZ21lbnRcclxuXHRcdHRoaXMuX2xhc3RDb2RlID0gY29kZUI7XHJcblxyXG5cdFx0d2hpbGUgKHRydWUpIHtcclxuXHRcdFx0Ly8gaWYgYSxiIGlzIGluc2lkZSB0aGUgY2xpcCB3aW5kb3cgKHRyaXZpYWwgYWNjZXB0KVxyXG5cdFx0XHRpZiAoIShjb2RlQSB8IGNvZGVCKSkge1xyXG5cdFx0XHRcdHJldHVybiBbYSwgYl07XHJcblx0XHRcdC8vIGlmIGEsYiBpcyBvdXRzaWRlIHRoZSBjbGlwIHdpbmRvdyAodHJpdmlhbCByZWplY3QpXHJcblx0XHRcdH0gZWxzZSBpZiAoY29kZUEgJiBjb2RlQikge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0Ly8gb3RoZXIgY2FzZXNcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb2RlT3V0ID0gY29kZUEgfHwgY29kZUI7XHJcblx0XHRcdFx0cCA9IHRoaXMuX2dldEVkZ2VJbnRlcnNlY3Rpb24oYSwgYiwgY29kZU91dCwgYm91bmRzKTtcclxuXHRcdFx0XHRuZXdDb2RlID0gdGhpcy5fZ2V0Qml0Q29kZShwLCBib3VuZHMpO1xyXG5cclxuXHRcdFx0XHRpZiAoY29kZU91dCA9PT0gY29kZUEpIHtcclxuXHRcdFx0XHRcdGEgPSBwO1xyXG5cdFx0XHRcdFx0Y29kZUEgPSBuZXdDb2RlO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRiID0gcDtcclxuXHRcdFx0XHRcdGNvZGVCID0gbmV3Q29kZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfZ2V0RWRnZUludGVyc2VjdGlvbjogZnVuY3Rpb24gKGEsIGIsIGNvZGUsIGJvdW5kcykge1xyXG5cdFx0dmFyIGR4ID0gYi54IC0gYS54LFxyXG5cdFx0ICAgIGR5ID0gYi55IC0gYS55LFxyXG5cdFx0ICAgIG1pbiA9IGJvdW5kcy5taW4sXHJcblx0XHQgICAgbWF4ID0gYm91bmRzLm1heDtcclxuXHJcblx0XHRpZiAoY29kZSAmIDgpIHsgLy8gdG9wXHJcblx0XHRcdHJldHVybiBuZXcgTC5Qb2ludChhLnggKyBkeCAqIChtYXgueSAtIGEueSkgLyBkeSwgbWF4LnkpO1xyXG5cdFx0fSBlbHNlIGlmIChjb2RlICYgNCkgeyAvLyBib3R0b21cclxuXHRcdFx0cmV0dXJuIG5ldyBMLlBvaW50KGEueCArIGR4ICogKG1pbi55IC0gYS55KSAvIGR5LCBtaW4ueSk7XHJcblx0XHR9IGVsc2UgaWYgKGNvZGUgJiAyKSB7IC8vIHJpZ2h0XHJcblx0XHRcdHJldHVybiBuZXcgTC5Qb2ludChtYXgueCwgYS55ICsgZHkgKiAobWF4LnggLSBhLngpIC8gZHgpO1xyXG5cdFx0fSBlbHNlIGlmIChjb2RlICYgMSkgeyAvLyBsZWZ0XHJcblx0XHRcdHJldHVybiBuZXcgTC5Qb2ludChtaW4ueCwgYS55ICsgZHkgKiAobWluLnggLSBhLngpIC8gZHgpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdF9nZXRCaXRDb2RlOiBmdW5jdGlvbiAoLypQb2ludCovIHAsIGJvdW5kcykge1xyXG5cdFx0dmFyIGNvZGUgPSAwO1xyXG5cclxuXHRcdGlmIChwLnggPCBib3VuZHMubWluLngpIHsgLy8gbGVmdFxyXG5cdFx0XHRjb2RlIHw9IDE7XHJcblx0XHR9IGVsc2UgaWYgKHAueCA+IGJvdW5kcy5tYXgueCkgeyAvLyByaWdodFxyXG5cdFx0XHRjb2RlIHw9IDI7XHJcblx0XHR9XHJcblx0XHRpZiAocC55IDwgYm91bmRzLm1pbi55KSB7IC8vIGJvdHRvbVxyXG5cdFx0XHRjb2RlIHw9IDQ7XHJcblx0XHR9IGVsc2UgaWYgKHAueSA+IGJvdW5kcy5tYXgueSkgeyAvLyB0b3BcclxuXHRcdFx0Y29kZSB8PSA4O1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBjb2RlO1xyXG5cdH0sXHJcblxyXG5cdC8vIHNxdWFyZSBkaXN0YW5jZSAodG8gYXZvaWQgdW5uZWNlc3NhcnkgTWF0aC5zcXJ0IGNhbGxzKVxyXG5cdF9zcURpc3Q6IGZ1bmN0aW9uIChwMSwgcDIpIHtcclxuXHRcdHZhciBkeCA9IHAyLnggLSBwMS54LFxyXG5cdFx0ICAgIGR5ID0gcDIueSAtIHAxLnk7XHJcblx0XHRyZXR1cm4gZHggKiBkeCArIGR5ICogZHk7XHJcblx0fSxcclxuXHJcblx0Ly8gcmV0dXJuIGNsb3Nlc3QgcG9pbnQgb24gc2VnbWVudCBvciBkaXN0YW5jZSB0byB0aGF0IHBvaW50XHJcblx0X3NxQ2xvc2VzdFBvaW50T25TZWdtZW50OiBmdW5jdGlvbiAocCwgcDEsIHAyLCBzcURpc3QpIHtcclxuXHRcdHZhciB4ID0gcDEueCxcclxuXHRcdCAgICB5ID0gcDEueSxcclxuXHRcdCAgICBkeCA9IHAyLnggLSB4LFxyXG5cdFx0ICAgIGR5ID0gcDIueSAtIHksXHJcblx0XHQgICAgZG90ID0gZHggKiBkeCArIGR5ICogZHksXHJcblx0XHQgICAgdDtcclxuXHJcblx0XHRpZiAoZG90ID4gMCkge1xyXG5cdFx0XHR0ID0gKChwLnggLSB4KSAqIGR4ICsgKHAueSAtIHkpICogZHkpIC8gZG90O1xyXG5cclxuXHRcdFx0aWYgKHQgPiAxKSB7XHJcblx0XHRcdFx0eCA9IHAyLng7XHJcblx0XHRcdFx0eSA9IHAyLnk7XHJcblx0XHRcdH0gZWxzZSBpZiAodCA+IDApIHtcclxuXHRcdFx0XHR4ICs9IGR4ICogdDtcclxuXHRcdFx0XHR5ICs9IGR5ICogdDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGR4ID0gcC54IC0geDtcclxuXHRcdGR5ID0gcC55IC0geTtcclxuXHJcblx0XHRyZXR1cm4gc3FEaXN0ID8gZHggKiBkeCArIGR5ICogZHkgOiBuZXcgTC5Qb2ludCh4LCB5KTtcclxuXHR9XHJcbn07XHJcblxuXG4vKlxyXG4gKiBMLlBvbHlsaW5lIGlzIHVzZWQgdG8gZGlzcGxheSBwb2x5bGluZXMgb24gYSBtYXAuXHJcbiAqL1xyXG5cclxuTC5Qb2x5bGluZSA9IEwuUGF0aC5leHRlbmQoe1xyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRsbmdzLCBvcHRpb25zKSB7XHJcblx0XHRMLlBhdGgucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLl9sYXRsbmdzID0gdGhpcy5fY29udmVydExhdExuZ3MobGF0bG5ncyk7XHJcblx0fSxcclxuXHJcblx0b3B0aW9uczoge1xyXG5cdFx0Ly8gaG93IG11Y2ggdG8gc2ltcGxpZnkgdGhlIHBvbHlsaW5lIG9uIGVhY2ggem9vbSBsZXZlbFxyXG5cdFx0Ly8gbW9yZSA9IGJldHRlciBwZXJmb3JtYW5jZSBhbmQgc21vb3RoZXIgbG9vaywgbGVzcyA9IG1vcmUgYWNjdXJhdGVcclxuXHRcdHNtb290aEZhY3RvcjogMS4wLFxyXG5cdFx0bm9DbGlwOiBmYWxzZVxyXG5cdH0sXHJcblxyXG5cdHByb2plY3RMYXRsbmdzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLl9vcmlnaW5hbFBvaW50cyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLl9sYXRsbmdzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdHRoaXMuX29yaWdpbmFsUG9pbnRzW2ldID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9sYXRsbmdzW2ldKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRnZXRQYXRoU3RyaW5nOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5fcGFydHMubGVuZ3RoLCBzdHIgPSAnJzsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdHN0ciArPSB0aGlzLl9nZXRQYXRoUGFydFN0cih0aGlzLl9wYXJ0c1tpXSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gc3RyO1xyXG5cdH0sXHJcblxyXG5cdGdldExhdExuZ3M6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9sYXRsbmdzO1xyXG5cdH0sXHJcblxyXG5cdHNldExhdExuZ3M6IGZ1bmN0aW9uIChsYXRsbmdzKSB7XHJcblx0XHR0aGlzLl9sYXRsbmdzID0gdGhpcy5fY29udmVydExhdExuZ3MobGF0bG5ncyk7XHJcblx0XHRyZXR1cm4gdGhpcy5yZWRyYXcoKTtcclxuXHR9LFxyXG5cclxuXHRhZGRMYXRMbmc6IGZ1bmN0aW9uIChsYXRsbmcpIHtcclxuXHRcdHRoaXMuX2xhdGxuZ3MucHVzaChMLmxhdExuZyhsYXRsbmcpKTtcclxuXHRcdHJldHVybiB0aGlzLnJlZHJhdygpO1xyXG5cdH0sXHJcblxyXG5cdHNwbGljZUxhdExuZ3M6IGZ1bmN0aW9uICgpIHsgLy8gKE51bWJlciBpbmRleCwgTnVtYmVyIGhvd01hbnkpXHJcblx0XHR2YXIgcmVtb3ZlZCA9IFtdLnNwbGljZS5hcHBseSh0aGlzLl9sYXRsbmdzLCBhcmd1bWVudHMpO1xyXG5cdFx0dGhpcy5fY29udmVydExhdExuZ3ModGhpcy5fbGF0bG5ncywgdHJ1ZSk7XHJcblx0XHR0aGlzLnJlZHJhdygpO1xyXG5cdFx0cmV0dXJuIHJlbW92ZWQ7XHJcblx0fSxcclxuXHJcblx0Y2xvc2VzdExheWVyUG9pbnQ6IGZ1bmN0aW9uIChwKSB7XHJcblx0XHR2YXIgbWluRGlzdGFuY2UgPSBJbmZpbml0eSwgcGFydHMgPSB0aGlzLl9wYXJ0cywgcDEsIHAyLCBtaW5Qb2ludCA9IG51bGw7XHJcblxyXG5cdFx0Zm9yICh2YXIgaiA9IDAsIGpMZW4gPSBwYXJ0cy5sZW5ndGg7IGogPCBqTGVuOyBqKyspIHtcclxuXHRcdFx0dmFyIHBvaW50cyA9IHBhcnRzW2pdO1xyXG5cdFx0XHRmb3IgKHZhciBpID0gMSwgbGVuID0gcG9pbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdFx0cDEgPSBwb2ludHNbaSAtIDFdO1xyXG5cdFx0XHRcdHAyID0gcG9pbnRzW2ldO1xyXG5cdFx0XHRcdHZhciBzcURpc3QgPSBMLkxpbmVVdGlsLl9zcUNsb3Nlc3RQb2ludE9uU2VnbWVudChwLCBwMSwgcDIsIHRydWUpO1xyXG5cdFx0XHRcdGlmIChzcURpc3QgPCBtaW5EaXN0YW5jZSkge1xyXG5cdFx0XHRcdFx0bWluRGlzdGFuY2UgPSBzcURpc3Q7XHJcblx0XHRcdFx0XHRtaW5Qb2ludCA9IEwuTGluZVV0aWwuX3NxQ2xvc2VzdFBvaW50T25TZWdtZW50KHAsIHAxLCBwMik7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRpZiAobWluUG9pbnQpIHtcclxuXHRcdFx0bWluUG9pbnQuZGlzdGFuY2UgPSBNYXRoLnNxcnQobWluRGlzdGFuY2UpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG1pblBvaW50O1xyXG5cdH0sXHJcblxyXG5cdGdldEJvdW5kczogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIG5ldyBMLkxhdExuZ0JvdW5kcyh0aGlzLmdldExhdExuZ3MoKSk7XHJcblx0fSxcclxuXHJcblx0X2NvbnZlcnRMYXRMbmdzOiBmdW5jdGlvbiAobGF0bG5ncywgb3ZlcndyaXRlKSB7XHJcblx0XHR2YXIgaSwgbGVuLCB0YXJnZXQgPSBvdmVyd3JpdGUgPyBsYXRsbmdzIDogW107XHJcblxyXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gbGF0bG5ncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0XHRpZiAoTC5VdGlsLmlzQXJyYXkobGF0bG5nc1tpXSkgJiYgdHlwZW9mIGxhdGxuZ3NbaV1bMF0gIT09ICdudW1iZXInKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRhcmdldFtpXSA9IEwubGF0TG5nKGxhdGxuZ3NbaV0pO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRhcmdldDtcclxuXHR9LFxyXG5cclxuXHRfaW5pdEV2ZW50czogZnVuY3Rpb24gKCkge1xyXG5cdFx0TC5QYXRoLnByb3RvdHlwZS5faW5pdEV2ZW50cy5jYWxsKHRoaXMpO1xyXG5cdH0sXHJcblxyXG5cdF9nZXRQYXRoUGFydFN0cjogZnVuY3Rpb24gKHBvaW50cykge1xyXG5cdFx0dmFyIHJvdW5kID0gTC5QYXRoLlZNTDtcclxuXHJcblx0XHRmb3IgKHZhciBqID0gMCwgbGVuMiA9IHBvaW50cy5sZW5ndGgsIHN0ciA9ICcnLCBwOyBqIDwgbGVuMjsgaisrKSB7XHJcblx0XHRcdHAgPSBwb2ludHNbal07XHJcblx0XHRcdGlmIChyb3VuZCkge1xyXG5cdFx0XHRcdHAuX3JvdW5kKCk7XHJcblx0XHRcdH1cclxuXHRcdFx0c3RyICs9IChqID8gJ0wnIDogJ00nKSArIHAueCArICcgJyArIHAueTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBzdHI7XHJcblx0fSxcclxuXHJcblx0X2NsaXBQb2ludHM6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBwb2ludHMgPSB0aGlzLl9vcmlnaW5hbFBvaW50cyxcclxuXHRcdCAgICBsZW4gPSBwb2ludHMubGVuZ3RoLFxyXG5cdFx0ICAgIGksIGssIHNlZ21lbnQ7XHJcblxyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5ub0NsaXApIHtcclxuXHRcdFx0dGhpcy5fcGFydHMgPSBbcG9pbnRzXTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3BhcnRzID0gW107XHJcblxyXG5cdFx0dmFyIHBhcnRzID0gdGhpcy5fcGFydHMsXHJcblx0XHQgICAgdnAgPSB0aGlzLl9tYXAuX3BhdGhWaWV3cG9ydCxcclxuXHRcdCAgICBsdSA9IEwuTGluZVV0aWw7XHJcblxyXG5cdFx0Zm9yIChpID0gMCwgayA9IDA7IGkgPCBsZW4gLSAxOyBpKyspIHtcclxuXHRcdFx0c2VnbWVudCA9IGx1LmNsaXBTZWdtZW50KHBvaW50c1tpXSwgcG9pbnRzW2kgKyAxXSwgdnAsIGkpO1xyXG5cdFx0XHRpZiAoIXNlZ21lbnQpIHtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cGFydHNba10gPSBwYXJ0c1trXSB8fCBbXTtcclxuXHRcdFx0cGFydHNba10ucHVzaChzZWdtZW50WzBdKTtcclxuXHJcblx0XHRcdC8vIGlmIHNlZ21lbnQgZ29lcyBvdXQgb2Ygc2NyZWVuLCBvciBpdCdzIHRoZSBsYXN0IG9uZSwgaXQncyB0aGUgZW5kIG9mIHRoZSBsaW5lIHBhcnRcclxuXHRcdFx0aWYgKChzZWdtZW50WzFdICE9PSBwb2ludHNbaSArIDFdKSB8fCAoaSA9PT0gbGVuIC0gMikpIHtcclxuXHRcdFx0XHRwYXJ0c1trXS5wdXNoKHNlZ21lbnRbMV0pO1xyXG5cdFx0XHRcdGsrKztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdC8vIHNpbXBsaWZ5IGVhY2ggY2xpcHBlZCBwYXJ0IG9mIHRoZSBwb2x5bGluZVxyXG5cdF9zaW1wbGlmeVBvaW50czogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHBhcnRzID0gdGhpcy5fcGFydHMsXHJcblx0XHQgICAgbHUgPSBMLkxpbmVVdGlsO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsZW4gPSBwYXJ0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0XHRwYXJ0c1tpXSA9IGx1LnNpbXBsaWZ5KHBhcnRzW2ldLCB0aGlzLm9wdGlvbnMuc21vb3RoRmFjdG9yKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKCF0aGlzLl9tYXApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dGhpcy5fY2xpcFBvaW50cygpO1xyXG5cdFx0dGhpcy5fc2ltcGxpZnlQb2ludHMoKTtcclxuXHJcblx0XHRMLlBhdGgucHJvdG90eXBlLl91cGRhdGVQYXRoLmNhbGwodGhpcyk7XHJcblx0fVxyXG59KTtcclxuXHJcbkwucG9seWxpbmUgPSBmdW5jdGlvbiAobGF0bG5ncywgb3B0aW9ucykge1xyXG5cdHJldHVybiBuZXcgTC5Qb2x5bGluZShsYXRsbmdzLCBvcHRpb25zKTtcclxufTtcclxuXG5cbi8qXHJcbiAqIEwuUG9seVV0aWwgY29udGFpbnMgdXRpbGl0eSBmdW5jdGlvbnMgZm9yIHBvbHlnb25zIChjbGlwcGluZywgZXRjLikuXHJcbiAqL1xyXG5cclxuLypqc2hpbnQgYml0d2lzZTpmYWxzZSAqLyAvLyBhbGxvdyBiaXR3aXNlIG9wZXJhdGlvbnMgaGVyZVxyXG5cclxuTC5Qb2x5VXRpbCA9IHt9O1xyXG5cclxuLypcclxuICogU3V0aGVybGFuZC1Ib2RnZW1hbiBwb2x5Z29uIGNsaXBwaW5nIGFsZ29yaXRobS5cclxuICogVXNlZCB0byBhdm9pZCByZW5kZXJpbmcgcGFydHMgb2YgYSBwb2x5Z29uIHRoYXQgYXJlIG5vdCBjdXJyZW50bHkgdmlzaWJsZS5cclxuICovXHJcbkwuUG9seVV0aWwuY2xpcFBvbHlnb24gPSBmdW5jdGlvbiAocG9pbnRzLCBib3VuZHMpIHtcclxuXHR2YXIgY2xpcHBlZFBvaW50cyxcclxuXHQgICAgZWRnZXMgPSBbMSwgNCwgMiwgOF0sXHJcblx0ICAgIGksIGosIGssXHJcblx0ICAgIGEsIGIsXHJcblx0ICAgIGxlbiwgZWRnZSwgcCxcclxuXHQgICAgbHUgPSBMLkxpbmVVdGlsO1xyXG5cclxuXHRmb3IgKGkgPSAwLCBsZW4gPSBwb2ludHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdHBvaW50c1tpXS5fY29kZSA9IGx1Ll9nZXRCaXRDb2RlKHBvaW50c1tpXSwgYm91bmRzKTtcclxuXHR9XHJcblxyXG5cdC8vIGZvciBlYWNoIGVkZ2UgKGxlZnQsIGJvdHRvbSwgcmlnaHQsIHRvcClcclxuXHRmb3IgKGsgPSAwOyBrIDwgNDsgaysrKSB7XHJcblx0XHRlZGdlID0gZWRnZXNba107XHJcblx0XHRjbGlwcGVkUG9pbnRzID0gW107XHJcblxyXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gcG9pbnRzLmxlbmd0aCwgaiA9IGxlbiAtIDE7IGkgPCBsZW47IGogPSBpKyspIHtcclxuXHRcdFx0YSA9IHBvaW50c1tpXTtcclxuXHRcdFx0YiA9IHBvaW50c1tqXTtcclxuXHJcblx0XHRcdC8vIGlmIGEgaXMgaW5zaWRlIHRoZSBjbGlwIHdpbmRvd1xyXG5cdFx0XHRpZiAoIShhLl9jb2RlICYgZWRnZSkpIHtcclxuXHRcdFx0XHQvLyBpZiBiIGlzIG91dHNpZGUgdGhlIGNsaXAgd2luZG93IChhLT5iIGdvZXMgb3V0IG9mIHNjcmVlbilcclxuXHRcdFx0XHRpZiAoYi5fY29kZSAmIGVkZ2UpIHtcclxuXHRcdFx0XHRcdHAgPSBsdS5fZ2V0RWRnZUludGVyc2VjdGlvbihiLCBhLCBlZGdlLCBib3VuZHMpO1xyXG5cdFx0XHRcdFx0cC5fY29kZSA9IGx1Ll9nZXRCaXRDb2RlKHAsIGJvdW5kcyk7XHJcblx0XHRcdFx0XHRjbGlwcGVkUG9pbnRzLnB1c2gocCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNsaXBwZWRQb2ludHMucHVzaChhKTtcclxuXHJcblx0XHRcdC8vIGVsc2UgaWYgYiBpcyBpbnNpZGUgdGhlIGNsaXAgd2luZG93IChhLT5iIGVudGVycyB0aGUgc2NyZWVuKVxyXG5cdFx0XHR9IGVsc2UgaWYgKCEoYi5fY29kZSAmIGVkZ2UpKSB7XHJcblx0XHRcdFx0cCA9IGx1Ll9nZXRFZGdlSW50ZXJzZWN0aW9uKGIsIGEsIGVkZ2UsIGJvdW5kcyk7XHJcblx0XHRcdFx0cC5fY29kZSA9IGx1Ll9nZXRCaXRDb2RlKHAsIGJvdW5kcyk7XHJcblx0XHRcdFx0Y2xpcHBlZFBvaW50cy5wdXNoKHApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRwb2ludHMgPSBjbGlwcGVkUG9pbnRzO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHBvaW50cztcclxufTtcclxuXG5cbi8qXHJcbiAqIEwuUG9seWdvbiBpcyB1c2VkIHRvIGRpc3BsYXkgcG9seWdvbnMgb24gYSBtYXAuXHJcbiAqL1xyXG5cclxuTC5Qb2x5Z29uID0gTC5Qb2x5bGluZS5leHRlbmQoe1xyXG5cdG9wdGlvbnM6IHtcclxuXHRcdGZpbGw6IHRydWVcclxuXHR9LFxyXG5cclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5ncywgb3B0aW9ucykge1xyXG5cdFx0TC5Qb2x5bGluZS5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIGxhdGxuZ3MsIG9wdGlvbnMpO1xyXG5cdFx0dGhpcy5faW5pdFdpdGhIb2xlcyhsYXRsbmdzKTtcclxuXHR9LFxyXG5cclxuXHRfaW5pdFdpdGhIb2xlczogZnVuY3Rpb24gKGxhdGxuZ3MpIHtcclxuXHRcdHZhciBpLCBsZW4sIGhvbGU7XHJcblx0XHRpZiAobGF0bG5ncyAmJiBMLlV0aWwuaXNBcnJheShsYXRsbmdzWzBdKSAmJiAodHlwZW9mIGxhdGxuZ3NbMF1bMF0gIT09ICdudW1iZXInKSkge1xyXG5cdFx0XHR0aGlzLl9sYXRsbmdzID0gdGhpcy5fY29udmVydExhdExuZ3MobGF0bG5nc1swXSk7XHJcblx0XHRcdHRoaXMuX2hvbGVzID0gbGF0bG5ncy5zbGljZSgxKTtcclxuXHJcblx0XHRcdGZvciAoaSA9IDAsIGxlbiA9IHRoaXMuX2hvbGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdFx0aG9sZSA9IHRoaXMuX2hvbGVzW2ldID0gdGhpcy5fY29udmVydExhdExuZ3ModGhpcy5faG9sZXNbaV0pO1xyXG5cdFx0XHRcdGlmIChob2xlWzBdLmVxdWFscyhob2xlW2hvbGUubGVuZ3RoIC0gMV0pKSB7XHJcblx0XHRcdFx0XHRob2xlLnBvcCgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIGZpbHRlciBvdXQgbGFzdCBwb2ludCBpZiBpdHMgZXF1YWwgdG8gdGhlIGZpcnN0IG9uZVxyXG5cdFx0bGF0bG5ncyA9IHRoaXMuX2xhdGxuZ3M7XHJcblxyXG5cdFx0aWYgKGxhdGxuZ3MubGVuZ3RoID49IDIgJiYgbGF0bG5nc1swXS5lcXVhbHMobGF0bG5nc1tsYXRsbmdzLmxlbmd0aCAtIDFdKSkge1xyXG5cdFx0XHRsYXRsbmdzLnBvcCgpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdHByb2plY3RMYXRsbmdzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRMLlBvbHlsaW5lLnByb3RvdHlwZS5wcm9qZWN0TGF0bG5ncy5jYWxsKHRoaXMpO1xyXG5cclxuXHRcdC8vIHByb2plY3QgcG9seWdvbiBob2xlcyBwb2ludHNcclxuXHRcdC8vIFRPRE8gbW92ZSB0aGlzIGxvZ2ljIHRvIFBvbHlsaW5lIHRvIGdldCByaWQgb2YgZHVwbGljYXRpb25cclxuXHRcdHRoaXMuX2hvbGVQb2ludHMgPSBbXTtcclxuXHJcblx0XHRpZiAoIXRoaXMuX2hvbGVzKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBpLCBqLCBsZW4sIGxlbjI7XHJcblxyXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gdGhpcy5faG9sZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0dGhpcy5faG9sZVBvaW50c1tpXSA9IFtdO1xyXG5cclxuXHRcdFx0Zm9yIChqID0gMCwgbGVuMiA9IHRoaXMuX2hvbGVzW2ldLmxlbmd0aDsgaiA8IGxlbjI7IGorKykge1xyXG5cdFx0XHRcdHRoaXMuX2hvbGVQb2ludHNbaV1bal0gPSB0aGlzLl9tYXAubGF0TG5nVG9MYXllclBvaW50KHRoaXMuX2hvbGVzW2ldW2pdKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdHNldExhdExuZ3M6IGZ1bmN0aW9uIChsYXRsbmdzKSB7XHJcblx0XHRpZiAobGF0bG5ncyAmJiBMLlV0aWwuaXNBcnJheShsYXRsbmdzWzBdKSAmJiAodHlwZW9mIGxhdGxuZ3NbMF1bMF0gIT09ICdudW1iZXInKSkge1xyXG5cdFx0XHR0aGlzLl9pbml0V2l0aEhvbGVzKGxhdGxuZ3MpO1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5yZWRyYXcoKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJldHVybiBMLlBvbHlsaW5lLnByb3RvdHlwZS5zZXRMYXRMbmdzLmNhbGwodGhpcywgbGF0bG5ncyk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X2NsaXBQb2ludHM6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBwb2ludHMgPSB0aGlzLl9vcmlnaW5hbFBvaW50cyxcclxuXHRcdCAgICBuZXdQYXJ0cyA9IFtdO1xyXG5cclxuXHRcdHRoaXMuX3BhcnRzID0gW3BvaW50c10uY29uY2F0KHRoaXMuX2hvbGVQb2ludHMpO1xyXG5cclxuXHRcdGlmICh0aGlzLm9wdGlvbnMubm9DbGlwKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLl9wYXJ0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0XHR2YXIgY2xpcHBlZCA9IEwuUG9seVV0aWwuY2xpcFBvbHlnb24odGhpcy5fcGFydHNbaV0sIHRoaXMuX21hcC5fcGF0aFZpZXdwb3J0KTtcclxuXHRcdFx0aWYgKGNsaXBwZWQubGVuZ3RoKSB7XHJcblx0XHRcdFx0bmV3UGFydHMucHVzaChjbGlwcGVkKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3BhcnRzID0gbmV3UGFydHM7XHJcblx0fSxcclxuXHJcblx0X2dldFBhdGhQYXJ0U3RyOiBmdW5jdGlvbiAocG9pbnRzKSB7XHJcblx0XHR2YXIgc3RyID0gTC5Qb2x5bGluZS5wcm90b3R5cGUuX2dldFBhdGhQYXJ0U3RyLmNhbGwodGhpcywgcG9pbnRzKTtcclxuXHRcdHJldHVybiBzdHIgKyAoTC5Ccm93c2VyLnN2ZyA/ICd6JyA6ICd4Jyk7XHJcblx0fVxyXG59KTtcclxuXHJcbkwucG9seWdvbiA9IGZ1bmN0aW9uIChsYXRsbmdzLCBvcHRpb25zKSB7XHJcblx0cmV0dXJuIG5ldyBMLlBvbHlnb24obGF0bG5ncywgb3B0aW9ucyk7XHJcbn07XHJcblxuXG4vKlxyXG4gKiBDb250YWlucyBMLk11bHRpUG9seWxpbmUgYW5kIEwuTXVsdGlQb2x5Z29uIGxheWVycy5cclxuICovXHJcblxyXG4oZnVuY3Rpb24gKCkge1xyXG5cdGZ1bmN0aW9uIGNyZWF0ZU11bHRpKEtsYXNzKSB7XHJcblxyXG5cdFx0cmV0dXJuIEwuRmVhdHVyZUdyb3VwLmV4dGVuZCh7XHJcblxyXG5cdFx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5ncywgb3B0aW9ucykge1xyXG5cdFx0XHRcdHRoaXMuX2xheWVycyA9IHt9O1xyXG5cdFx0XHRcdHRoaXMuX29wdGlvbnMgPSBvcHRpb25zO1xyXG5cdFx0XHRcdHRoaXMuc2V0TGF0TG5ncyhsYXRsbmdzKTtcclxuXHRcdFx0fSxcclxuXHJcblx0XHRcdHNldExhdExuZ3M6IGZ1bmN0aW9uIChsYXRsbmdzKSB7XHJcblx0XHRcdFx0dmFyIGkgPSAwLFxyXG5cdFx0XHRcdCAgICBsZW4gPSBsYXRsbmdzLmxlbmd0aDtcclxuXHJcblx0XHRcdFx0dGhpcy5lYWNoTGF5ZXIoZnVuY3Rpb24gKGxheWVyKSB7XHJcblx0XHRcdFx0XHRpZiAoaSA8IGxlbikge1xyXG5cdFx0XHRcdFx0XHRsYXllci5zZXRMYXRMbmdzKGxhdGxuZ3NbaSsrXSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUxheWVyKGxheWVyKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LCB0aGlzKTtcclxuXHJcblx0XHRcdFx0d2hpbGUgKGkgPCBsZW4pIHtcclxuXHRcdFx0XHRcdHRoaXMuYWRkTGF5ZXIobmV3IEtsYXNzKGxhdGxuZ3NbaSsrXSwgdGhpcy5fb3B0aW9ucykpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIHRoaXM7XHJcblx0XHRcdH0sXHJcblxyXG5cdFx0XHRnZXRMYXRMbmdzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0dmFyIGxhdGxuZ3MgPSBbXTtcclxuXHJcblx0XHRcdFx0dGhpcy5lYWNoTGF5ZXIoZnVuY3Rpb24gKGxheWVyKSB7XHJcblx0XHRcdFx0XHRsYXRsbmdzLnB1c2gobGF5ZXIuZ2V0TGF0TG5ncygpKTtcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0cmV0dXJuIGxhdGxuZ3M7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0TC5NdWx0aVBvbHlsaW5lID0gY3JlYXRlTXVsdGkoTC5Qb2x5bGluZSk7XHJcblx0TC5NdWx0aVBvbHlnb24gPSBjcmVhdGVNdWx0aShMLlBvbHlnb24pO1xyXG5cclxuXHRMLm11bHRpUG9seWxpbmUgPSBmdW5jdGlvbiAobGF0bG5ncywgb3B0aW9ucykge1xyXG5cdFx0cmV0dXJuIG5ldyBMLk11bHRpUG9seWxpbmUobGF0bG5ncywgb3B0aW9ucyk7XHJcblx0fTtcclxuXHJcblx0TC5tdWx0aVBvbHlnb24gPSBmdW5jdGlvbiAobGF0bG5ncywgb3B0aW9ucykge1xyXG5cdFx0cmV0dXJuIG5ldyBMLk11bHRpUG9seWdvbihsYXRsbmdzLCBvcHRpb25zKTtcclxuXHR9O1xyXG59KCkpO1xyXG5cblxuLypcclxuICogTC5SZWN0YW5nbGUgZXh0ZW5kcyBQb2x5Z29uIGFuZCBjcmVhdGVzIGEgcmVjdGFuZ2xlIHdoZW4gcGFzc2VkIGEgTGF0TG5nQm91bmRzIG9iamVjdC5cclxuICovXHJcblxyXG5MLlJlY3RhbmdsZSA9IEwuUG9seWdvbi5leHRlbmQoe1xyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRMbmdCb3VuZHMsIG9wdGlvbnMpIHtcclxuXHRcdEwuUG9seWdvbi5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHRoaXMuX2JvdW5kc1RvTGF0TG5ncyhsYXRMbmdCb3VuZHMpLCBvcHRpb25zKTtcclxuXHR9LFxyXG5cclxuXHRzZXRCb3VuZHM6IGZ1bmN0aW9uIChsYXRMbmdCb3VuZHMpIHtcclxuXHRcdHRoaXMuc2V0TGF0TG5ncyh0aGlzLl9ib3VuZHNUb0xhdExuZ3MobGF0TG5nQm91bmRzKSk7XHJcblx0fSxcclxuXHJcblx0X2JvdW5kc1RvTGF0TG5nczogZnVuY3Rpb24gKGxhdExuZ0JvdW5kcykge1xyXG5cdFx0bGF0TG5nQm91bmRzID0gTC5sYXRMbmdCb3VuZHMobGF0TG5nQm91bmRzKTtcclxuXHRcdHJldHVybiBbXHJcblx0XHRcdGxhdExuZ0JvdW5kcy5nZXRTb3V0aFdlc3QoKSxcclxuXHRcdFx0bGF0TG5nQm91bmRzLmdldE5vcnRoV2VzdCgpLFxyXG5cdFx0XHRsYXRMbmdCb3VuZHMuZ2V0Tm9ydGhFYXN0KCksXHJcblx0XHRcdGxhdExuZ0JvdW5kcy5nZXRTb3V0aEVhc3QoKVxyXG5cdFx0XTtcclxuXHR9XHJcbn0pO1xyXG5cclxuTC5yZWN0YW5nbGUgPSBmdW5jdGlvbiAobGF0TG5nQm91bmRzLCBvcHRpb25zKSB7XHJcblx0cmV0dXJuIG5ldyBMLlJlY3RhbmdsZShsYXRMbmdCb3VuZHMsIG9wdGlvbnMpO1xyXG59O1xyXG5cblxuLypcclxuICogTC5DaXJjbGUgaXMgYSBjaXJjbGUgb3ZlcmxheSAod2l0aCBhIGNlcnRhaW4gcmFkaXVzIGluIG1ldGVycykuXHJcbiAqL1xyXG5cclxuTC5DaXJjbGUgPSBMLlBhdGguZXh0ZW5kKHtcclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCByYWRpdXMsIG9wdGlvbnMpIHtcclxuXHRcdEwuUGF0aC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuXHRcdHRoaXMuX2xhdGxuZyA9IEwubGF0TG5nKGxhdGxuZyk7XHJcblx0XHR0aGlzLl9tUmFkaXVzID0gcmFkaXVzO1xyXG5cdH0sXHJcblxyXG5cdG9wdGlvbnM6IHtcclxuXHRcdGZpbGw6IHRydWVcclxuXHR9LFxyXG5cclxuXHRzZXRMYXRMbmc6IGZ1bmN0aW9uIChsYXRsbmcpIHtcclxuXHRcdHRoaXMuX2xhdGxuZyA9IEwubGF0TG5nKGxhdGxuZyk7XHJcblx0XHRyZXR1cm4gdGhpcy5yZWRyYXcoKTtcclxuXHR9LFxyXG5cclxuXHRzZXRSYWRpdXM6IGZ1bmN0aW9uIChyYWRpdXMpIHtcclxuXHRcdHRoaXMuX21SYWRpdXMgPSByYWRpdXM7XHJcblx0XHRyZXR1cm4gdGhpcy5yZWRyYXcoKTtcclxuXHR9LFxyXG5cclxuXHRwcm9qZWN0TGF0bG5nczogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIGxuZ1JhZGl1cyA9IHRoaXMuX2dldExuZ1JhZGl1cygpLFxyXG5cdFx0ICAgIGxhdGxuZyA9IHRoaXMuX2xhdGxuZyxcclxuXHRcdCAgICBwb2ludExlZnQgPSB0aGlzLl9tYXAubGF0TG5nVG9MYXllclBvaW50KFtsYXRsbmcubGF0LCBsYXRsbmcubG5nIC0gbG5nUmFkaXVzXSk7XHJcblxyXG5cdFx0dGhpcy5fcG9pbnQgPSB0aGlzLl9tYXAubGF0TG5nVG9MYXllclBvaW50KGxhdGxuZyk7XHJcblx0XHR0aGlzLl9yYWRpdXMgPSBNYXRoLm1heCh0aGlzLl9wb2ludC54IC0gcG9pbnRMZWZ0LngsIDEpO1xyXG5cdH0sXHJcblxyXG5cdGdldEJvdW5kczogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIGxuZ1JhZGl1cyA9IHRoaXMuX2dldExuZ1JhZGl1cygpLFxyXG5cdFx0ICAgIGxhdFJhZGl1cyA9ICh0aGlzLl9tUmFkaXVzIC8gNDAwNzUwMTcpICogMzYwLFxyXG5cdFx0ICAgIGxhdGxuZyA9IHRoaXMuX2xhdGxuZztcclxuXHJcblx0XHRyZXR1cm4gbmV3IEwuTGF0TG5nQm91bmRzKFxyXG5cdFx0ICAgICAgICBbbGF0bG5nLmxhdCAtIGxhdFJhZGl1cywgbGF0bG5nLmxuZyAtIGxuZ1JhZGl1c10sXHJcblx0XHQgICAgICAgIFtsYXRsbmcubGF0ICsgbGF0UmFkaXVzLCBsYXRsbmcubG5nICsgbG5nUmFkaXVzXSk7XHJcblx0fSxcclxuXHJcblx0Z2V0TGF0TG5nOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fbGF0bG5nO1xyXG5cdH0sXHJcblxyXG5cdGdldFBhdGhTdHJpbmc6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBwID0gdGhpcy5fcG9pbnQsXHJcblx0XHQgICAgciA9IHRoaXMuX3JhZGl1cztcclxuXHJcblx0XHRpZiAodGhpcy5fY2hlY2tJZkVtcHR5KCkpIHtcclxuXHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChMLkJyb3dzZXIuc3ZnKSB7XHJcblx0XHRcdHJldHVybiAnTScgKyBwLnggKyAnLCcgKyAocC55IC0gcikgK1xyXG5cdFx0XHQgICAgICAgJ0EnICsgciArICcsJyArIHIgKyAnLDAsMSwxLCcgK1xyXG5cdFx0XHQgICAgICAgKHAueCAtIDAuMSkgKyAnLCcgKyAocC55IC0gcikgKyAnIHonO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cC5fcm91bmQoKTtcclxuXHRcdFx0ciA9IE1hdGgucm91bmQocik7XHJcblx0XHRcdHJldHVybiAnQUwgJyArIHAueCArICcsJyArIHAueSArICcgJyArIHIgKyAnLCcgKyByICsgJyAwLCcgKyAoNjU1MzUgKiAzNjApO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGdldFJhZGl1czogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX21SYWRpdXM7XHJcblx0fSxcclxuXHJcblx0Ly8gVE9ETyBFYXJ0aCBoYXJkY29kZWQsIG1vdmUgaW50byBwcm9qZWN0aW9uIGNvZGUhXHJcblxyXG5cdF9nZXRMYXRSYWRpdXM6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiAodGhpcy5fbVJhZGl1cyAvIDQwMDc1MDE3KSAqIDM2MDtcclxuXHR9LFxyXG5cclxuXHRfZ2V0TG5nUmFkaXVzOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fZ2V0TGF0UmFkaXVzKCkgLyBNYXRoLmNvcyhMLkxhdExuZy5ERUdfVE9fUkFEICogdGhpcy5fbGF0bG5nLmxhdCk7XHJcblx0fSxcclxuXHJcblx0X2NoZWNrSWZFbXB0eTogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKCF0aGlzLl9tYXApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdFx0dmFyIHZwID0gdGhpcy5fbWFwLl9wYXRoVmlld3BvcnQsXHJcblx0XHQgICAgciA9IHRoaXMuX3JhZGl1cyxcclxuXHRcdCAgICBwID0gdGhpcy5fcG9pbnQ7XHJcblxyXG5cdFx0cmV0dXJuIHAueCAtIHIgPiB2cC5tYXgueCB8fCBwLnkgLSByID4gdnAubWF4LnkgfHxcclxuXHRcdCAgICAgICBwLnggKyByIDwgdnAubWluLnggfHwgcC55ICsgciA8IHZwLm1pbi55O1xyXG5cdH1cclxufSk7XHJcblxyXG5MLmNpcmNsZSA9IGZ1bmN0aW9uIChsYXRsbmcsIHJhZGl1cywgb3B0aW9ucykge1xyXG5cdHJldHVybiBuZXcgTC5DaXJjbGUobGF0bG5nLCByYWRpdXMsIG9wdGlvbnMpO1xyXG59O1xyXG5cblxuLypcclxuICogTC5DaXJjbGVNYXJrZXIgaXMgYSBjaXJjbGUgb3ZlcmxheSB3aXRoIGEgcGVybWFuZW50IHBpeGVsIHJhZGl1cy5cclxuICovXHJcblxyXG5MLkNpcmNsZU1hcmtlciA9IEwuQ2lyY2xlLmV4dGVuZCh7XHJcblx0b3B0aW9uczoge1xyXG5cdFx0cmFkaXVzOiAxMCxcclxuXHRcdHdlaWdodDogMlxyXG5cdH0sXHJcblxyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRsbmcsIG9wdGlvbnMpIHtcclxuXHRcdEwuQ2lyY2xlLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBudWxsLCBvcHRpb25zKTtcclxuXHRcdHRoaXMuX3JhZGl1cyA9IHRoaXMub3B0aW9ucy5yYWRpdXM7XHJcblx0fSxcclxuXHJcblx0cHJvamVjdExhdGxuZ3M6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHRoaXMuX3BvaW50ID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9sYXRsbmcpO1xyXG5cdH0sXHJcblxyXG5cdF91cGRhdGVTdHlsZSA6IGZ1bmN0aW9uICgpIHtcclxuXHRcdEwuQ2lyY2xlLnByb3RvdHlwZS5fdXBkYXRlU3R5bGUuY2FsbCh0aGlzKTtcclxuXHRcdHRoaXMuc2V0UmFkaXVzKHRoaXMub3B0aW9ucy5yYWRpdXMpO1xyXG5cdH0sXHJcblxyXG5cdHNldExhdExuZzogZnVuY3Rpb24gKGxhdGxuZykge1xyXG5cdFx0TC5DaXJjbGUucHJvdG90eXBlLnNldExhdExuZy5jYWxsKHRoaXMsIGxhdGxuZyk7XHJcblx0XHRpZiAodGhpcy5fcG9wdXAgJiYgdGhpcy5fcG9wdXAuX2lzT3Blbikge1xyXG5cdFx0XHR0aGlzLl9wb3B1cC5zZXRMYXRMbmcobGF0bG5nKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdHNldFJhZGl1czogZnVuY3Rpb24gKHJhZGl1cykge1xyXG5cdFx0dGhpcy5vcHRpb25zLnJhZGl1cyA9IHRoaXMuX3JhZGl1cyA9IHJhZGl1cztcclxuXHRcdHJldHVybiB0aGlzLnJlZHJhdygpO1xyXG5cdH0sXHJcblxyXG5cdGdldFJhZGl1czogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX3JhZGl1cztcclxuXHR9XHJcbn0pO1xyXG5cclxuTC5jaXJjbGVNYXJrZXIgPSBmdW5jdGlvbiAobGF0bG5nLCBvcHRpb25zKSB7XHJcblx0cmV0dXJuIG5ldyBMLkNpcmNsZU1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xyXG59O1xyXG5cblxuLypcclxuICogRXh0ZW5kcyBMLlBvbHlsaW5lIHRvIGJlIGFibGUgdG8gbWFudWFsbHkgZGV0ZWN0IGNsaWNrcyBvbiBDYW52YXMtcmVuZGVyZWQgcG9seWxpbmVzLlxyXG4gKi9cclxuXHJcbkwuUG9seWxpbmUuaW5jbHVkZSghTC5QYXRoLkNBTlZBUyA/IHt9IDoge1xyXG5cdF9jb250YWluc1BvaW50OiBmdW5jdGlvbiAocCwgY2xvc2VkKSB7XHJcblx0XHR2YXIgaSwgaiwgaywgbGVuLCBsZW4yLCBkaXN0LCBwYXJ0LFxyXG5cdFx0ICAgIHcgPSB0aGlzLm9wdGlvbnMud2VpZ2h0IC8gMjtcclxuXHJcblx0XHRpZiAoTC5Ccm93c2VyLnRvdWNoKSB7XHJcblx0XHRcdHcgKz0gMTA7IC8vIHBvbHlsaW5lIGNsaWNrIHRvbGVyYW5jZSBvbiB0b3VjaCBkZXZpY2VzXHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gdGhpcy5fcGFydHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0cGFydCA9IHRoaXMuX3BhcnRzW2ldO1xyXG5cdFx0XHRmb3IgKGogPSAwLCBsZW4yID0gcGFydC5sZW5ndGgsIGsgPSBsZW4yIC0gMTsgaiA8IGxlbjI7IGsgPSBqKyspIHtcclxuXHRcdFx0XHRpZiAoIWNsb3NlZCAmJiAoaiA9PT0gMCkpIHtcclxuXHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZGlzdCA9IEwuTGluZVV0aWwucG9pbnRUb1NlZ21lbnREaXN0YW5jZShwLCBwYXJ0W2tdLCBwYXJ0W2pdKTtcclxuXHJcblx0XHRcdFx0aWYgKGRpc3QgPD0gdykge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59KTtcclxuXG5cbi8qXHJcbiAqIEV4dGVuZHMgTC5Qb2x5Z29uIHRvIGJlIGFibGUgdG8gbWFudWFsbHkgZGV0ZWN0IGNsaWNrcyBvbiBDYW52YXMtcmVuZGVyZWQgcG9seWdvbnMuXHJcbiAqL1xyXG5cclxuTC5Qb2x5Z29uLmluY2x1ZGUoIUwuUGF0aC5DQU5WQVMgPyB7fSA6IHtcclxuXHRfY29udGFpbnNQb2ludDogZnVuY3Rpb24gKHApIHtcclxuXHRcdHZhciBpbnNpZGUgPSBmYWxzZSxcclxuXHRcdCAgICBwYXJ0LCBwMSwgcDIsXHJcblx0XHQgICAgaSwgaiwgayxcclxuXHRcdCAgICBsZW4sIGxlbjI7XHJcblxyXG5cdFx0Ly8gVE9ETyBvcHRpbWl6YXRpb246IGNoZWNrIGlmIHdpdGhpbiBib3VuZHMgZmlyc3RcclxuXHJcblx0XHRpZiAoTC5Qb2x5bGluZS5wcm90b3R5cGUuX2NvbnRhaW5zUG9pbnQuY2FsbCh0aGlzLCBwLCB0cnVlKSkge1xyXG5cdFx0XHQvLyBjbGljayBvbiBwb2x5Z29uIGJvcmRlclxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyByYXkgY2FzdGluZyBhbGdvcml0aG0gZm9yIGRldGVjdGluZyBpZiBwb2ludCBpcyBpbiBwb2x5Z29uXHJcblxyXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gdGhpcy5fcGFydHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0cGFydCA9IHRoaXMuX3BhcnRzW2ldO1xyXG5cclxuXHRcdFx0Zm9yIChqID0gMCwgbGVuMiA9IHBhcnQubGVuZ3RoLCBrID0gbGVuMiAtIDE7IGogPCBsZW4yOyBrID0gaisrKSB7XHJcblx0XHRcdFx0cDEgPSBwYXJ0W2pdO1xyXG5cdFx0XHRcdHAyID0gcGFydFtrXTtcclxuXHJcblx0XHRcdFx0aWYgKCgocDEueSA+IHAueSkgIT09IChwMi55ID4gcC55KSkgJiZcclxuXHRcdFx0XHRcdFx0KHAueCA8IChwMi54IC0gcDEueCkgKiAocC55IC0gcDEueSkgLyAocDIueSAtIHAxLnkpICsgcDEueCkpIHtcclxuXHRcdFx0XHRcdGluc2lkZSA9ICFpbnNpZGU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGluc2lkZTtcclxuXHR9XHJcbn0pO1xyXG5cblxuLypcclxuICogRXh0ZW5kcyBMLkNpcmNsZSB3aXRoIENhbnZhcy1zcGVjaWZpYyBjb2RlLlxyXG4gKi9cclxuXHJcbkwuQ2lyY2xlLmluY2x1ZGUoIUwuUGF0aC5DQU5WQVMgPyB7fSA6IHtcclxuXHRfZHJhd1BhdGg6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBwID0gdGhpcy5fcG9pbnQ7XHJcblx0XHR0aGlzLl9jdHguYmVnaW5QYXRoKCk7XHJcblx0XHR0aGlzLl9jdHguYXJjKHAueCwgcC55LCB0aGlzLl9yYWRpdXMsIDAsIE1hdGguUEkgKiAyLCBmYWxzZSk7XHJcblx0fSxcclxuXHJcblx0X2NvbnRhaW5zUG9pbnQ6IGZ1bmN0aW9uIChwKSB7XHJcblx0XHR2YXIgY2VudGVyID0gdGhpcy5fcG9pbnQsXHJcblx0XHQgICAgdzIgPSB0aGlzLm9wdGlvbnMuc3Ryb2tlID8gdGhpcy5vcHRpb25zLndlaWdodCAvIDIgOiAwO1xyXG5cclxuXHRcdHJldHVybiAocC5kaXN0YW5jZVRvKGNlbnRlcikgPD0gdGhpcy5fcmFkaXVzICsgdzIpO1xyXG5cdH1cclxufSk7XHJcblxuXG4vKlxuICogQ2lyY2xlTWFya2VyIGNhbnZhcyBzcGVjaWZpYyBkcmF3aW5nIHBhcnRzLlxuICovXG5cbkwuQ2lyY2xlTWFya2VyLmluY2x1ZGUoIUwuUGF0aC5DQU5WQVMgPyB7fSA6IHtcblx0X3VwZGF0ZVN0eWxlOiBmdW5jdGlvbiAoKSB7XG5cdFx0TC5QYXRoLnByb3RvdHlwZS5fdXBkYXRlU3R5bGUuY2FsbCh0aGlzKTtcblx0fVxufSk7XG5cblxuLypcclxuICogTC5HZW9KU09OIHR1cm5zIGFueSBHZW9KU09OIGRhdGEgaW50byBhIExlYWZsZXQgbGF5ZXIuXHJcbiAqL1xyXG5cclxuTC5HZW9KU09OID0gTC5GZWF0dXJlR3JvdXAuZXh0ZW5kKHtcclxuXHJcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKGdlb2pzb24sIG9wdGlvbnMpIHtcclxuXHRcdEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLl9sYXllcnMgPSB7fTtcclxuXHJcblx0XHRpZiAoZ2VvanNvbikge1xyXG5cdFx0XHR0aGlzLmFkZERhdGEoZ2VvanNvbik7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0YWRkRGF0YTogZnVuY3Rpb24gKGdlb2pzb24pIHtcclxuXHRcdHZhciBmZWF0dXJlcyA9IEwuVXRpbC5pc0FycmF5KGdlb2pzb24pID8gZ2VvanNvbiA6IGdlb2pzb24uZmVhdHVyZXMsXHJcblx0XHQgICAgaSwgbGVuLCBmZWF0dXJlO1xyXG5cclxuXHRcdGlmIChmZWF0dXJlcykge1xyXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0XHRcdC8vIE9ubHkgYWRkIHRoaXMgaWYgZ2VvbWV0cnkgb3IgZ2VvbWV0cmllcyBhcmUgc2V0IGFuZCBub3QgbnVsbFxyXG5cdFx0XHRcdGZlYXR1cmUgPSBmZWF0dXJlc1tpXTtcclxuXHRcdFx0XHRpZiAoZmVhdHVyZS5nZW9tZXRyaWVzIHx8IGZlYXR1cmUuZ2VvbWV0cnkgfHwgZmVhdHVyZS5mZWF0dXJlcyB8fCBmZWF0dXJlLmNvb3JkaW5hdGVzKSB7XHJcblx0XHRcdFx0XHR0aGlzLmFkZERhdGEoZmVhdHVyZXNbaV0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcclxuXHJcblx0XHRpZiAob3B0aW9ucy5maWx0ZXIgJiYgIW9wdGlvbnMuZmlsdGVyKGdlb2pzb24pKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBsYXllciA9IEwuR2VvSlNPTi5nZW9tZXRyeVRvTGF5ZXIoZ2VvanNvbiwgb3B0aW9ucy5wb2ludFRvTGF5ZXIsIG9wdGlvbnMuY29vcmRzVG9MYXRMbmcsIG9wdGlvbnMpO1xyXG5cdFx0bGF5ZXIuZmVhdHVyZSA9IEwuR2VvSlNPTi5hc0ZlYXR1cmUoZ2VvanNvbik7XHJcblxyXG5cdFx0bGF5ZXIuZGVmYXVsdE9wdGlvbnMgPSBsYXllci5vcHRpb25zO1xyXG5cdFx0dGhpcy5yZXNldFN0eWxlKGxheWVyKTtcclxuXHJcblx0XHRpZiAob3B0aW9ucy5vbkVhY2hGZWF0dXJlKSB7XHJcblx0XHRcdG9wdGlvbnMub25FYWNoRmVhdHVyZShnZW9qc29uLCBsYXllcik7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuYWRkTGF5ZXIobGF5ZXIpO1xyXG5cdH0sXHJcblxyXG5cdHJlc2V0U3R5bGU6IGZ1bmN0aW9uIChsYXllcikge1xyXG5cdFx0dmFyIHN0eWxlID0gdGhpcy5vcHRpb25zLnN0eWxlO1xyXG5cdFx0aWYgKHN0eWxlKSB7XHJcblx0XHRcdC8vIHJlc2V0IGFueSBjdXN0b20gc3R5bGVzXHJcblx0XHRcdEwuVXRpbC5leHRlbmQobGF5ZXIub3B0aW9ucywgbGF5ZXIuZGVmYXVsdE9wdGlvbnMpO1xyXG5cclxuXHRcdFx0dGhpcy5fc2V0TGF5ZXJTdHlsZShsYXllciwgc3R5bGUpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdHNldFN0eWxlOiBmdW5jdGlvbiAoc3R5bGUpIHtcclxuXHRcdHRoaXMuZWFjaExheWVyKGZ1bmN0aW9uIChsYXllcikge1xyXG5cdFx0XHR0aGlzLl9zZXRMYXllclN0eWxlKGxheWVyLCBzdHlsZSk7XHJcblx0XHR9LCB0aGlzKTtcclxuXHR9LFxyXG5cclxuXHRfc2V0TGF5ZXJTdHlsZTogZnVuY3Rpb24gKGxheWVyLCBzdHlsZSkge1xyXG5cdFx0aWYgKHR5cGVvZiBzdHlsZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRzdHlsZSA9IHN0eWxlKGxheWVyLmZlYXR1cmUpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKGxheWVyLnNldFN0eWxlKSB7XHJcblx0XHRcdGxheWVyLnNldFN0eWxlKHN0eWxlKTtcclxuXHRcdH1cclxuXHR9XHJcbn0pO1xyXG5cclxuTC5leHRlbmQoTC5HZW9KU09OLCB7XHJcblx0Z2VvbWV0cnlUb0xheWVyOiBmdW5jdGlvbiAoZ2VvanNvbiwgcG9pbnRUb0xheWVyLCBjb29yZHNUb0xhdExuZywgdmVjdG9yT3B0aW9ucykge1xyXG5cdFx0dmFyIGdlb21ldHJ5ID0gZ2VvanNvbi50eXBlID09PSAnRmVhdHVyZScgPyBnZW9qc29uLmdlb21ldHJ5IDogZ2VvanNvbixcclxuXHRcdCAgICBjb29yZHMgPSBnZW9tZXRyeS5jb29yZGluYXRlcyxcclxuXHRcdCAgICBsYXllcnMgPSBbXSxcclxuXHRcdCAgICBsYXRsbmcsIGxhdGxuZ3MsIGksIGxlbjtcclxuXHJcblx0XHRjb29yZHNUb0xhdExuZyA9IGNvb3Jkc1RvTGF0TG5nIHx8IHRoaXMuY29vcmRzVG9MYXRMbmc7XHJcblxyXG5cdFx0c3dpdGNoIChnZW9tZXRyeS50eXBlKSB7XHJcblx0XHRjYXNlICdQb2ludCc6XHJcblx0XHRcdGxhdGxuZyA9IGNvb3Jkc1RvTGF0TG5nKGNvb3Jkcyk7XHJcblx0XHRcdHJldHVybiBwb2ludFRvTGF5ZXIgPyBwb2ludFRvTGF5ZXIoZ2VvanNvbiwgbGF0bG5nKSA6IG5ldyBMLk1hcmtlcihsYXRsbmcpO1xyXG5cclxuXHRcdGNhc2UgJ011bHRpUG9pbnQnOlxyXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW4gPSBjb29yZHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0XHRsYXRsbmcgPSBjb29yZHNUb0xhdExuZyhjb29yZHNbaV0pO1xyXG5cdFx0XHRcdGxheWVycy5wdXNoKHBvaW50VG9MYXllciA/IHBvaW50VG9MYXllcihnZW9qc29uLCBsYXRsbmcpIDogbmV3IEwuTWFya2VyKGxhdGxuZykpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBuZXcgTC5GZWF0dXJlR3JvdXAobGF5ZXJzKTtcclxuXHJcblx0XHRjYXNlICdMaW5lU3RyaW5nJzpcclxuXHRcdFx0bGF0bG5ncyA9IHRoaXMuY29vcmRzVG9MYXRMbmdzKGNvb3JkcywgMCwgY29vcmRzVG9MYXRMbmcpO1xyXG5cdFx0XHRyZXR1cm4gbmV3IEwuUG9seWxpbmUobGF0bG5ncywgdmVjdG9yT3B0aW9ucyk7XHJcblxyXG5cdFx0Y2FzZSAnUG9seWdvbic6XHJcblx0XHRcdGlmIChjb29yZHMubGVuZ3RoID09PSAyICYmICFjb29yZHNbMV0ubGVuZ3RoKSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEdlb0pTT04gb2JqZWN0LicpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGxhdGxuZ3MgPSB0aGlzLmNvb3Jkc1RvTGF0TG5ncyhjb29yZHMsIDEsIGNvb3Jkc1RvTGF0TG5nKTtcclxuXHRcdFx0cmV0dXJuIG5ldyBMLlBvbHlnb24obGF0bG5ncywgdmVjdG9yT3B0aW9ucyk7XHJcblxyXG5cdFx0Y2FzZSAnTXVsdGlMaW5lU3RyaW5nJzpcclxuXHRcdFx0bGF0bG5ncyA9IHRoaXMuY29vcmRzVG9MYXRMbmdzKGNvb3JkcywgMSwgY29vcmRzVG9MYXRMbmcpO1xyXG5cdFx0XHRyZXR1cm4gbmV3IEwuTXVsdGlQb2x5bGluZShsYXRsbmdzLCB2ZWN0b3JPcHRpb25zKTtcclxuXHJcblx0XHRjYXNlICdNdWx0aVBvbHlnb24nOlxyXG5cdFx0XHRsYXRsbmdzID0gdGhpcy5jb29yZHNUb0xhdExuZ3MoY29vcmRzLCAyLCBjb29yZHNUb0xhdExuZyk7XHJcblx0XHRcdHJldHVybiBuZXcgTC5NdWx0aVBvbHlnb24obGF0bG5ncywgdmVjdG9yT3B0aW9ucyk7XHJcblxyXG5cdFx0Y2FzZSAnR2VvbWV0cnlDb2xsZWN0aW9uJzpcclxuXHRcdFx0Zm9yIChpID0gMCwgbGVuID0gZ2VvbWV0cnkuZ2VvbWV0cmllcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cclxuXHRcdFx0XHRsYXllcnMucHVzaCh0aGlzLmdlb21ldHJ5VG9MYXllcih7XHJcblx0XHRcdFx0XHRnZW9tZXRyeTogZ2VvbWV0cnkuZ2VvbWV0cmllc1tpXSxcclxuXHRcdFx0XHRcdHR5cGU6ICdGZWF0dXJlJyxcclxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IGdlb2pzb24ucHJvcGVydGllc1xyXG5cdFx0XHRcdH0sIHBvaW50VG9MYXllciwgY29vcmRzVG9MYXRMbmcsIHZlY3Rvck9wdGlvbnMpKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gbmV3IEwuRmVhdHVyZUdyb3VwKGxheWVycyk7XHJcblxyXG5cdFx0ZGVmYXVsdDpcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEdlb0pTT04gb2JqZWN0LicpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGNvb3Jkc1RvTGF0TG5nOiBmdW5jdGlvbiAoY29vcmRzKSB7IC8vIChBcnJheVssIEJvb2xlYW5dKSAtPiBMYXRMbmdcclxuXHRcdHJldHVybiBuZXcgTC5MYXRMbmcoY29vcmRzWzFdLCBjb29yZHNbMF0sIGNvb3Jkc1syXSk7XHJcblx0fSxcclxuXHJcblx0Y29vcmRzVG9MYXRMbmdzOiBmdW5jdGlvbiAoY29vcmRzLCBsZXZlbHNEZWVwLCBjb29yZHNUb0xhdExuZykgeyAvLyAoQXJyYXlbLCBOdW1iZXIsIEZ1bmN0aW9uXSkgLT4gQXJyYXlcclxuXHRcdHZhciBsYXRsbmcsIGksIGxlbixcclxuXHRcdCAgICBsYXRsbmdzID0gW107XHJcblxyXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gY29vcmRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRcdGxhdGxuZyA9IGxldmVsc0RlZXAgP1xyXG5cdFx0XHQgICAgICAgIHRoaXMuY29vcmRzVG9MYXRMbmdzKGNvb3Jkc1tpXSwgbGV2ZWxzRGVlcCAtIDEsIGNvb3Jkc1RvTGF0TG5nKSA6XHJcblx0XHRcdCAgICAgICAgKGNvb3Jkc1RvTGF0TG5nIHx8IHRoaXMuY29vcmRzVG9MYXRMbmcpKGNvb3Jkc1tpXSk7XHJcblxyXG5cdFx0XHRsYXRsbmdzLnB1c2gobGF0bG5nKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbGF0bG5ncztcclxuXHR9LFxyXG5cclxuXHRsYXRMbmdUb0Nvb3JkczogZnVuY3Rpb24gKGxhdGxuZykge1xyXG5cdFx0dmFyIGNvb3JkcyA9IFtsYXRsbmcubG5nLCBsYXRsbmcubGF0XTtcclxuXHJcblx0XHRpZiAobGF0bG5nLmFsdCAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdGNvb3Jkcy5wdXNoKGxhdGxuZy5hbHQpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGNvb3JkcztcclxuXHR9LFxyXG5cclxuXHRsYXRMbmdzVG9Db29yZHM6IGZ1bmN0aW9uIChsYXRMbmdzKSB7XHJcblx0XHR2YXIgY29vcmRzID0gW107XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IDAsIGxlbiA9IGxhdExuZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdFx0Y29vcmRzLnB1c2goTC5HZW9KU09OLmxhdExuZ1RvQ29vcmRzKGxhdExuZ3NbaV0pKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gY29vcmRzO1xyXG5cdH0sXHJcblxyXG5cdGdldEZlYXR1cmU6IGZ1bmN0aW9uIChsYXllciwgbmV3R2VvbWV0cnkpIHtcclxuXHRcdHJldHVybiBsYXllci5mZWF0dXJlID8gTC5leHRlbmQoe30sIGxheWVyLmZlYXR1cmUsIHtnZW9tZXRyeTogbmV3R2VvbWV0cnl9KSA6IEwuR2VvSlNPTi5hc0ZlYXR1cmUobmV3R2VvbWV0cnkpO1xyXG5cdH0sXHJcblxyXG5cdGFzRmVhdHVyZTogZnVuY3Rpb24gKGdlb0pTT04pIHtcclxuXHRcdGlmIChnZW9KU09OLnR5cGUgPT09ICdGZWF0dXJlJykge1xyXG5cdFx0XHRyZXR1cm4gZ2VvSlNPTjtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHR0eXBlOiAnRmVhdHVyZScsXHJcblx0XHRcdHByb3BlcnRpZXM6IHt9LFxyXG5cdFx0XHRnZW9tZXRyeTogZ2VvSlNPTlxyXG5cdFx0fTtcclxuXHR9XHJcbn0pO1xyXG5cclxudmFyIFBvaW50VG9HZW9KU09OID0ge1xyXG5cdHRvR2VvSlNPTjogZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIEwuR2VvSlNPTi5nZXRGZWF0dXJlKHRoaXMsIHtcclxuXHRcdFx0dHlwZTogJ1BvaW50JyxcclxuXHRcdFx0Y29vcmRpbmF0ZXM6IEwuR2VvSlNPTi5sYXRMbmdUb0Nvb3Jkcyh0aGlzLmdldExhdExuZygpKVxyXG5cdFx0fSk7XHJcblx0fVxyXG59O1xyXG5cclxuTC5NYXJrZXIuaW5jbHVkZShQb2ludFRvR2VvSlNPTik7XHJcbkwuQ2lyY2xlLmluY2x1ZGUoUG9pbnRUb0dlb0pTT04pO1xyXG5MLkNpcmNsZU1hcmtlci5pbmNsdWRlKFBvaW50VG9HZW9KU09OKTtcclxuXHJcbkwuUG9seWxpbmUuaW5jbHVkZSh7XHJcblx0dG9HZW9KU09OOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xyXG5cdFx0XHR0eXBlOiAnTGluZVN0cmluZycsXHJcblx0XHRcdGNvb3JkaW5hdGVzOiBMLkdlb0pTT04ubGF0TG5nc1RvQ29vcmRzKHRoaXMuZ2V0TGF0TG5ncygpKVxyXG5cdFx0fSk7XHJcblx0fVxyXG59KTtcclxuXHJcbkwuUG9seWdvbi5pbmNsdWRlKHtcclxuXHR0b0dlb0pTT046IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBjb29yZHMgPSBbTC5HZW9KU09OLmxhdExuZ3NUb0Nvb3Jkcyh0aGlzLmdldExhdExuZ3MoKSldLFxyXG5cdFx0ICAgIGksIGxlbiwgaG9sZTtcclxuXHJcblx0XHRjb29yZHNbMF0ucHVzaChjb29yZHNbMF1bMF0pO1xyXG5cclxuXHRcdGlmICh0aGlzLl9ob2xlcykge1xyXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW4gPSB0aGlzLl9ob2xlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0XHRcdGhvbGUgPSBMLkdlb0pTT04ubGF0TG5nc1RvQ29vcmRzKHRoaXMuX2hvbGVzW2ldKTtcclxuXHRcdFx0XHRob2xlLnB1c2goaG9sZVswXSk7XHJcblx0XHRcdFx0Y29vcmRzLnB1c2goaG9sZSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xyXG5cdFx0XHR0eXBlOiAnUG9seWdvbicsXHJcblx0XHRcdGNvb3JkaW5hdGVzOiBjb29yZHNcclxuXHRcdH0pO1xyXG5cdH1cclxufSk7XHJcblxyXG4oZnVuY3Rpb24gKCkge1xyXG5cdGZ1bmN0aW9uIG11bHRpVG9HZW9KU09OKHR5cGUpIHtcclxuXHRcdHJldHVybiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciBjb29yZHMgPSBbXTtcclxuXHJcblx0XHRcdHRoaXMuZWFjaExheWVyKGZ1bmN0aW9uIChsYXllcikge1xyXG5cdFx0XHRcdGNvb3Jkcy5wdXNoKGxheWVyLnRvR2VvSlNPTigpLmdlb21ldHJ5LmNvb3JkaW5hdGVzKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xyXG5cdFx0XHRcdHR5cGU6IHR5cGUsXHJcblx0XHRcdFx0Y29vcmRpbmF0ZXM6IGNvb3Jkc1xyXG5cdFx0XHR9KTtcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRMLk11bHRpUG9seWxpbmUuaW5jbHVkZSh7dG9HZW9KU09OOiBtdWx0aVRvR2VvSlNPTignTXVsdGlMaW5lU3RyaW5nJyl9KTtcclxuXHRMLk11bHRpUG9seWdvbi5pbmNsdWRlKHt0b0dlb0pTT046IG11bHRpVG9HZW9KU09OKCdNdWx0aVBvbHlnb24nKX0pO1xyXG5cclxuXHRMLkxheWVyR3JvdXAuaW5jbHVkZSh7XHJcblx0XHR0b0dlb0pTT046IGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRcdHZhciBnZW9tZXRyeSA9IHRoaXMuZmVhdHVyZSAmJiB0aGlzLmZlYXR1cmUuZ2VvbWV0cnksXHJcblx0XHRcdFx0anNvbnMgPSBbXSxcclxuXHRcdFx0XHRqc29uO1xyXG5cclxuXHRcdFx0aWYgKGdlb21ldHJ5ICYmIGdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aVBvaW50Jykge1xyXG5cdFx0XHRcdHJldHVybiBtdWx0aVRvR2VvSlNPTignTXVsdGlQb2ludCcpLmNhbGwodGhpcyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBpc0dlb21ldHJ5Q29sbGVjdGlvbiA9IGdlb21ldHJ5ICYmIGdlb21ldHJ5LnR5cGUgPT09ICdHZW9tZXRyeUNvbGxlY3Rpb24nO1xyXG5cclxuXHRcdFx0dGhpcy5lYWNoTGF5ZXIoZnVuY3Rpb24gKGxheWVyKSB7XHJcblx0XHRcdFx0aWYgKGxheWVyLnRvR2VvSlNPTikge1xyXG5cdFx0XHRcdFx0anNvbiA9IGxheWVyLnRvR2VvSlNPTigpO1xyXG5cdFx0XHRcdFx0anNvbnMucHVzaChpc0dlb21ldHJ5Q29sbGVjdGlvbiA/IGpzb24uZ2VvbWV0cnkgOiBMLkdlb0pTT04uYXNGZWF0dXJlKGpzb24pKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0aWYgKGlzR2VvbWV0cnlDb2xsZWN0aW9uKSB7XHJcblx0XHRcdFx0cmV0dXJuIEwuR2VvSlNPTi5nZXRGZWF0dXJlKHRoaXMsIHtcclxuXHRcdFx0XHRcdGdlb21ldHJpZXM6IGpzb25zLFxyXG5cdFx0XHRcdFx0dHlwZTogJ0dlb21ldHJ5Q29sbGVjdGlvbidcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHR0eXBlOiAnRmVhdHVyZUNvbGxlY3Rpb24nLFxyXG5cdFx0XHRcdGZlYXR1cmVzOiBqc29uc1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59KCkpO1xyXG5cclxuTC5nZW9Kc29uID0gZnVuY3Rpb24gKGdlb2pzb24sIG9wdGlvbnMpIHtcclxuXHRyZXR1cm4gbmV3IEwuR2VvSlNPTihnZW9qc29uLCBvcHRpb25zKTtcclxufTtcclxuXG5cbi8qXHJcbiAqIEwuRG9tRXZlbnQgY29udGFpbnMgZnVuY3Rpb25zIGZvciB3b3JraW5nIHdpdGggRE9NIGV2ZW50cy5cclxuICovXHJcblxyXG5MLkRvbUV2ZW50ID0ge1xyXG5cdC8qIGluc3BpcmVkIGJ5IEpvaG4gUmVzaWcsIERlYW4gRWR3YXJkcyBhbmQgWVVJIGFkZEV2ZW50IGltcGxlbWVudGF0aW9ucyAqL1xyXG5cdGFkZExpc3RlbmVyOiBmdW5jdGlvbiAob2JqLCB0eXBlLCBmbiwgY29udGV4dCkgeyAvLyAoSFRNTEVsZW1lbnQsIFN0cmluZywgRnVuY3Rpb25bLCBPYmplY3RdKVxyXG5cclxuXHRcdHZhciBpZCA9IEwuc3RhbXAoZm4pLFxyXG5cdFx0ICAgIGtleSA9ICdfbGVhZmxldF8nICsgdHlwZSArIGlkLFxyXG5cdFx0ICAgIGhhbmRsZXIsIG9yaWdpbmFsSGFuZGxlciwgbmV3VHlwZTtcclxuXHJcblx0XHRpZiAob2JqW2tleV0pIHsgcmV0dXJuIHRoaXM7IH1cclxuXHJcblx0XHRoYW5kbGVyID0gZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0cmV0dXJuIGZuLmNhbGwoY29udGV4dCB8fCBvYmosIGUgfHwgTC5Eb21FdmVudC5fZ2V0RXZlbnQoKSk7XHJcblx0XHR9O1xyXG5cclxuXHRcdGlmIChMLkJyb3dzZXIucG9pbnRlciAmJiB0eXBlLmluZGV4T2YoJ3RvdWNoJykgPT09IDApIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuYWRkUG9pbnRlckxpc3RlbmVyKG9iaiwgdHlwZSwgaGFuZGxlciwgaWQpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKEwuQnJvd3Nlci50b3VjaCAmJiAodHlwZSA9PT0gJ2RibGNsaWNrJykgJiYgdGhpcy5hZGREb3VibGVUYXBMaXN0ZW5lcikge1xyXG5cdFx0XHR0aGlzLmFkZERvdWJsZVRhcExpc3RlbmVyKG9iaiwgaGFuZGxlciwgaWQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICgnYWRkRXZlbnRMaXN0ZW5lcicgaW4gb2JqKSB7XHJcblxyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ21vdXNld2hlZWwnKSB7XHJcblx0XHRcdFx0b2JqLmFkZEV2ZW50TGlzdGVuZXIoJ0RPTU1vdXNlU2Nyb2xsJywgaGFuZGxlciwgZmFsc2UpO1xyXG5cdFx0XHRcdG9iai5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGhhbmRsZXIsIGZhbHNlKTtcclxuXHJcblx0XHRcdH0gZWxzZSBpZiAoKHR5cGUgPT09ICdtb3VzZWVudGVyJykgfHwgKHR5cGUgPT09ICdtb3VzZWxlYXZlJykpIHtcclxuXHJcblx0XHRcdFx0b3JpZ2luYWxIYW5kbGVyID0gaGFuZGxlcjtcclxuXHRcdFx0XHRuZXdUeXBlID0gKHR5cGUgPT09ICdtb3VzZWVudGVyJyA/ICdtb3VzZW92ZXInIDogJ21vdXNlb3V0Jyk7XHJcblxyXG5cdFx0XHRcdGhhbmRsZXIgPSBmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHRcdFx0aWYgKCFMLkRvbUV2ZW50Ll9jaGVja01vdXNlKG9iaiwgZSkpIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0XHRyZXR1cm4gb3JpZ2luYWxIYW5kbGVyKGUpO1xyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdG9iai5hZGRFdmVudExpc3RlbmVyKG5ld1R5cGUsIGhhbmRsZXIsIGZhbHNlKTtcclxuXHJcblx0XHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gJ2NsaWNrJyAmJiBMLkJyb3dzZXIuYW5kcm9pZCkge1xyXG5cdFx0XHRcdG9yaWdpbmFsSGFuZGxlciA9IGhhbmRsZXI7XHJcblx0XHRcdFx0aGFuZGxlciA9IGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gTC5Eb21FdmVudC5fZmlsdGVyQ2xpY2soZSwgb3JpZ2luYWxIYW5kbGVyKTtcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRvYmouYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBoYW5kbGVyLCBmYWxzZSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0b2JqLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgaGFuZGxlciwgZmFsc2UpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSBlbHNlIGlmICgnYXR0YWNoRXZlbnQnIGluIG9iaikge1xyXG5cdFx0XHRvYmouYXR0YWNoRXZlbnQoJ29uJyArIHR5cGUsIGhhbmRsZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdG9ialtrZXldID0gaGFuZGxlcjtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRyZW1vdmVMaXN0ZW5lcjogZnVuY3Rpb24gKG9iaiwgdHlwZSwgZm4pIHsgIC8vIChIVE1MRWxlbWVudCwgU3RyaW5nLCBGdW5jdGlvbilcclxuXHJcblx0XHR2YXIgaWQgPSBMLnN0YW1wKGZuKSxcclxuXHRcdCAgICBrZXkgPSAnX2xlYWZsZXRfJyArIHR5cGUgKyBpZCxcclxuXHRcdCAgICBoYW5kbGVyID0gb2JqW2tleV07XHJcblxyXG5cdFx0aWYgKCFoYW5kbGVyKSB7IHJldHVybiB0aGlzOyB9XHJcblxyXG5cdFx0aWYgKEwuQnJvd3Nlci5wb2ludGVyICYmIHR5cGUuaW5kZXhPZigndG91Y2gnKSA9PT0gMCkge1xyXG5cdFx0XHR0aGlzLnJlbW92ZVBvaW50ZXJMaXN0ZW5lcihvYmosIHR5cGUsIGlkKTtcclxuXHRcdH0gZWxzZSBpZiAoTC5Ccm93c2VyLnRvdWNoICYmICh0eXBlID09PSAnZGJsY2xpY2snKSAmJiB0aGlzLnJlbW92ZURvdWJsZVRhcExpc3RlbmVyKSB7XHJcblx0XHRcdHRoaXMucmVtb3ZlRG91YmxlVGFwTGlzdGVuZXIob2JqLCBpZCk7XHJcblxyXG5cdFx0fSBlbHNlIGlmICgncmVtb3ZlRXZlbnRMaXN0ZW5lcicgaW4gb2JqKSB7XHJcblxyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ21vdXNld2hlZWwnKSB7XHJcblx0XHRcdFx0b2JqLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ0RPTU1vdXNlU2Nyb2xsJywgaGFuZGxlciwgZmFsc2UpO1xyXG5cdFx0XHRcdG9iai5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGhhbmRsZXIsIGZhbHNlKTtcclxuXHJcblx0XHRcdH0gZWxzZSBpZiAoKHR5cGUgPT09ICdtb3VzZWVudGVyJykgfHwgKHR5cGUgPT09ICdtb3VzZWxlYXZlJykpIHtcclxuXHRcdFx0XHRvYmoucmVtb3ZlRXZlbnRMaXN0ZW5lcigodHlwZSA9PT0gJ21vdXNlZW50ZXInID8gJ21vdXNlb3ZlcicgOiAnbW91c2VvdXQnKSwgaGFuZGxlciwgZmFsc2UpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG9iai5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGhhbmRsZXIsIGZhbHNlKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmICgnZGV0YWNoRXZlbnQnIGluIG9iaikge1xyXG5cdFx0XHRvYmouZGV0YWNoRXZlbnQoJ29uJyArIHR5cGUsIGhhbmRsZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdG9ialtrZXldID0gbnVsbDtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRzdG9wUHJvcGFnYXRpb246IGZ1bmN0aW9uIChlKSB7XHJcblxyXG5cdFx0aWYgKGUuc3RvcFByb3BhZ2F0aW9uKSB7XHJcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRlLmNhbmNlbEJ1YmJsZSA9IHRydWU7XHJcblx0XHR9XHJcblx0XHRMLkRvbUV2ZW50Ll9za2lwcGVkKGUpO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdGRpc2FibGVTY3JvbGxQcm9wYWdhdGlvbjogZnVuY3Rpb24gKGVsKSB7XHJcblx0XHR2YXIgc3RvcCA9IEwuRG9tRXZlbnQuc3RvcFByb3BhZ2F0aW9uO1xyXG5cclxuXHRcdHJldHVybiBMLkRvbUV2ZW50XHJcblx0XHRcdC5vbihlbCwgJ21vdXNld2hlZWwnLCBzdG9wKVxyXG5cdFx0XHQub24oZWwsICdNb3pNb3VzZVBpeGVsU2Nyb2xsJywgc3RvcCk7XHJcblx0fSxcclxuXHJcblx0ZGlzYWJsZUNsaWNrUHJvcGFnYXRpb246IGZ1bmN0aW9uIChlbCkge1xyXG5cdFx0dmFyIHN0b3AgPSBMLkRvbUV2ZW50LnN0b3BQcm9wYWdhdGlvbjtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gTC5EcmFnZ2FibGUuU1RBUlQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuXHRcdFx0TC5Eb21FdmVudC5vbihlbCwgTC5EcmFnZ2FibGUuU1RBUlRbaV0sIHN0b3ApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBMLkRvbUV2ZW50XHJcblx0XHRcdC5vbihlbCwgJ2NsaWNrJywgTC5Eb21FdmVudC5fZmFrZVN0b3ApXHJcblx0XHRcdC5vbihlbCwgJ2RibGNsaWNrJywgc3RvcCk7XHJcblx0fSxcclxuXHJcblx0cHJldmVudERlZmF1bHQ6IGZ1bmN0aW9uIChlKSB7XHJcblxyXG5cdFx0aWYgKGUucHJldmVudERlZmF1bHQpIHtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZS5yZXR1cm5WYWx1ZSA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0c3RvcDogZnVuY3Rpb24gKGUpIHtcclxuXHRcdHJldHVybiBMLkRvbUV2ZW50XHJcblx0XHRcdC5wcmV2ZW50RGVmYXVsdChlKVxyXG5cdFx0XHQuc3RvcFByb3BhZ2F0aW9uKGUpO1xyXG5cdH0sXHJcblxyXG5cdGdldE1vdXNlUG9zaXRpb246IGZ1bmN0aW9uIChlLCBjb250YWluZXIpIHtcclxuXHRcdGlmICghY29udGFpbmVyKSB7XHJcblx0XHRcdHJldHVybiBuZXcgTC5Qb2ludChlLmNsaWVudFgsIGUuY2xpZW50WSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHJlY3QgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblxyXG5cdFx0cmV0dXJuIG5ldyBMLlBvaW50KFxyXG5cdFx0XHRlLmNsaWVudFggLSByZWN0LmxlZnQgLSBjb250YWluZXIuY2xpZW50TGVmdCxcclxuXHRcdFx0ZS5jbGllbnRZIC0gcmVjdC50b3AgLSBjb250YWluZXIuY2xpZW50VG9wKTtcclxuXHR9LFxyXG5cclxuXHRnZXRXaGVlbERlbHRhOiBmdW5jdGlvbiAoZSkge1xyXG5cclxuXHRcdHZhciBkZWx0YSA9IDA7XHJcblxyXG5cdFx0aWYgKGUud2hlZWxEZWx0YSkge1xyXG5cdFx0XHRkZWx0YSA9IGUud2hlZWxEZWx0YSAvIDEyMDtcclxuXHRcdH1cclxuXHRcdGlmIChlLmRldGFpbCkge1xyXG5cdFx0XHRkZWx0YSA9IC1lLmRldGFpbCAvIDM7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZGVsdGE7XHJcblx0fSxcclxuXHJcblx0X3NraXBFdmVudHM6IHt9LFxyXG5cclxuXHRfZmFrZVN0b3A6IGZ1bmN0aW9uIChlKSB7XHJcblx0XHQvLyBmYWtlcyBzdG9wUHJvcGFnYXRpb24gYnkgc2V0dGluZyBhIHNwZWNpYWwgZXZlbnQgZmxhZywgY2hlY2tlZC9yZXNldCB3aXRoIEwuRG9tRXZlbnQuX3NraXBwZWQoZSlcclxuXHRcdEwuRG9tRXZlbnQuX3NraXBFdmVudHNbZS50eXBlXSA9IHRydWU7XHJcblx0fSxcclxuXHJcblx0X3NraXBwZWQ6IGZ1bmN0aW9uIChlKSB7XHJcblx0XHR2YXIgc2tpcHBlZCA9IHRoaXMuX3NraXBFdmVudHNbZS50eXBlXTtcclxuXHRcdC8vIHJlc2V0IHdoZW4gY2hlY2tpbmcsIGFzIGl0J3Mgb25seSB1c2VkIGluIG1hcCBjb250YWluZXIgYW5kIHByb3BhZ2F0ZXMgb3V0c2lkZSBvZiB0aGUgbWFwXHJcblx0XHR0aGlzLl9za2lwRXZlbnRzW2UudHlwZV0gPSBmYWxzZTtcclxuXHRcdHJldHVybiBza2lwcGVkO1xyXG5cdH0sXHJcblxyXG5cdC8vIGNoZWNrIGlmIGVsZW1lbnQgcmVhbGx5IGxlZnQvZW50ZXJlZCB0aGUgZXZlbnQgdGFyZ2V0IChmb3IgbW91c2VlbnRlci9tb3VzZWxlYXZlKVxyXG5cdF9jaGVja01vdXNlOiBmdW5jdGlvbiAoZWwsIGUpIHtcclxuXHJcblx0XHR2YXIgcmVsYXRlZCA9IGUucmVsYXRlZFRhcmdldDtcclxuXHJcblx0XHRpZiAoIXJlbGF0ZWQpIHsgcmV0dXJuIHRydWU7IH1cclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHR3aGlsZSAocmVsYXRlZCAmJiAocmVsYXRlZCAhPT0gZWwpKSB7XHJcblx0XHRcdFx0cmVsYXRlZCA9IHJlbGF0ZWQucGFyZW50Tm9kZTtcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoZXJyKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHRcdHJldHVybiAocmVsYXRlZCAhPT0gZWwpO1xyXG5cdH0sXHJcblxyXG5cdF9nZXRFdmVudDogZnVuY3Rpb24gKCkgeyAvLyBldmlsIG1hZ2ljIGZvciBJRVxyXG5cdFx0Lypqc2hpbnQgbm9hcmc6ZmFsc2UgKi9cclxuXHRcdHZhciBlID0gd2luZG93LmV2ZW50O1xyXG5cdFx0aWYgKCFlKSB7XHJcblx0XHRcdHZhciBjYWxsZXIgPSBhcmd1bWVudHMuY2FsbGVlLmNhbGxlcjtcclxuXHRcdFx0d2hpbGUgKGNhbGxlcikge1xyXG5cdFx0XHRcdGUgPSBjYWxsZXJbJ2FyZ3VtZW50cyddWzBdO1xyXG5cdFx0XHRcdGlmIChlICYmIHdpbmRvdy5FdmVudCA9PT0gZS5jb25zdHJ1Y3Rvcikge1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNhbGxlciA9IGNhbGxlci5jYWxsZXI7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBlO1xyXG5cdH0sXHJcblxyXG5cdC8vIHRoaXMgaXMgYSBob3JyaWJsZSB3b3JrYXJvdW5kIGZvciBhIGJ1ZyBpbiBBbmRyb2lkIHdoZXJlIGEgc2luZ2xlIHRvdWNoIHRyaWdnZXJzIHR3byBjbGljayBldmVudHNcclxuXHRfZmlsdGVyQ2xpY2s6IGZ1bmN0aW9uIChlLCBoYW5kbGVyKSB7XHJcblx0XHR2YXIgdGltZVN0YW1wID0gKGUudGltZVN0YW1wIHx8IGUub3JpZ2luYWxFdmVudC50aW1lU3RhbXApLFxyXG5cdFx0XHRlbGFwc2VkID0gTC5Eb21FdmVudC5fbGFzdENsaWNrICYmICh0aW1lU3RhbXAgLSBMLkRvbUV2ZW50Ll9sYXN0Q2xpY2spO1xyXG5cclxuXHRcdC8vIGFyZSB0aGV5IGNsb3NlciB0b2dldGhlciB0aGFuIDUwMG1zIHlldCBtb3JlIHRoYW4gMTAwbXM/XHJcblx0XHQvLyBBbmRyb2lkIHR5cGljYWxseSB0cmlnZ2VycyB0aGVtIH4zMDBtcyBhcGFydCB3aGlsZSBtdWx0aXBsZSBsaXN0ZW5lcnNcclxuXHRcdC8vIG9uIHRoZSBzYW1lIGV2ZW50IHNob3VsZCBiZSB0cmlnZ2VyZWQgZmFyIGZhc3RlcjtcclxuXHRcdC8vIG9yIGNoZWNrIGlmIGNsaWNrIGlzIHNpbXVsYXRlZCBvbiB0aGUgZWxlbWVudCwgYW5kIGlmIGl0IGlzLCByZWplY3QgYW55IG5vbi1zaW11bGF0ZWQgZXZlbnRzXHJcblxyXG5cdFx0aWYgKChlbGFwc2VkICYmIGVsYXBzZWQgPiAxMDAgJiYgZWxhcHNlZCA8IDUwMCkgfHwgKGUudGFyZ2V0Ll9zaW11bGF0ZWRDbGljayAmJiAhZS5fc2ltdWxhdGVkKSkge1xyXG5cdFx0XHRMLkRvbUV2ZW50LnN0b3AoZSk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdEwuRG9tRXZlbnQuX2xhc3RDbGljayA9IHRpbWVTdGFtcDtcclxuXHJcblx0XHRyZXR1cm4gaGFuZGxlcihlKTtcclxuXHR9XHJcbn07XHJcblxyXG5MLkRvbUV2ZW50Lm9uID0gTC5Eb21FdmVudC5hZGRMaXN0ZW5lcjtcclxuTC5Eb21FdmVudC5vZmYgPSBMLkRvbUV2ZW50LnJlbW92ZUxpc3RlbmVyO1xyXG5cblxuLypcclxuICogTC5EcmFnZ2FibGUgYWxsb3dzIHlvdSB0byBhZGQgZHJhZ2dpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBlbGVtZW50LiBTdXBwb3J0cyBtb2JpbGUgZGV2aWNlcyB0b28uXHJcbiAqL1xyXG5cclxuTC5EcmFnZ2FibGUgPSBMLkNsYXNzLmV4dGVuZCh7XHJcblx0aW5jbHVkZXM6IEwuTWl4aW4uRXZlbnRzLFxyXG5cclxuXHRzdGF0aWNzOiB7XHJcblx0XHRTVEFSVDogTC5Ccm93c2VyLnRvdWNoID8gWyd0b3VjaHN0YXJ0JywgJ21vdXNlZG93biddIDogWydtb3VzZWRvd24nXSxcclxuXHRcdEVORDoge1xyXG5cdFx0XHRtb3VzZWRvd246ICdtb3VzZXVwJyxcclxuXHRcdFx0dG91Y2hzdGFydDogJ3RvdWNoZW5kJyxcclxuXHRcdFx0cG9pbnRlcmRvd246ICd0b3VjaGVuZCcsXHJcblx0XHRcdE1TUG9pbnRlckRvd246ICd0b3VjaGVuZCdcclxuXHRcdH0sXHJcblx0XHRNT1ZFOiB7XHJcblx0XHRcdG1vdXNlZG93bjogJ21vdXNlbW92ZScsXHJcblx0XHRcdHRvdWNoc3RhcnQ6ICd0b3VjaG1vdmUnLFxyXG5cdFx0XHRwb2ludGVyZG93bjogJ3RvdWNobW92ZScsXHJcblx0XHRcdE1TUG9pbnRlckRvd246ICd0b3VjaG1vdmUnXHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKGVsZW1lbnQsIGRyYWdTdGFydFRhcmdldCkge1xyXG5cdFx0dGhpcy5fZWxlbWVudCA9IGVsZW1lbnQ7XHJcblx0XHR0aGlzLl9kcmFnU3RhcnRUYXJnZXQgPSBkcmFnU3RhcnRUYXJnZXQgfHwgZWxlbWVudDtcclxuXHR9LFxyXG5cclxuXHRlbmFibGU6IGZ1bmN0aW9uICgpIHtcclxuXHRcdGlmICh0aGlzLl9lbmFibGVkKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGZvciAodmFyIGkgPSBMLkRyYWdnYWJsZS5TVEFSVC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG5cdFx0XHRMLkRvbUV2ZW50Lm9uKHRoaXMuX2RyYWdTdGFydFRhcmdldCwgTC5EcmFnZ2FibGUuU1RBUlRbaV0sIHRoaXMuX29uRG93biwgdGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fZW5hYmxlZCA9IHRydWU7XHJcblx0fSxcclxuXHJcblx0ZGlzYWJsZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKCF0aGlzLl9lbmFibGVkKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGZvciAodmFyIGkgPSBMLkRyYWdnYWJsZS5TVEFSVC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG5cdFx0XHRMLkRvbUV2ZW50Lm9mZih0aGlzLl9kcmFnU3RhcnRUYXJnZXQsIEwuRHJhZ2dhYmxlLlNUQVJUW2ldLCB0aGlzLl9vbkRvd24sIHRoaXMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2VuYWJsZWQgPSBmYWxzZTtcclxuXHRcdHRoaXMuX21vdmVkID0gZmFsc2U7XHJcblx0fSxcclxuXHJcblx0X29uRG93bjogZnVuY3Rpb24gKGUpIHtcclxuXHRcdHRoaXMuX21vdmVkID0gZmFsc2U7XHJcblxyXG5cdFx0aWYgKGUuc2hpZnRLZXkgfHwgKChlLndoaWNoICE9PSAxKSAmJiAoZS5idXR0b24gIT09IDEpICYmICFlLnRvdWNoZXMpKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdEwuRG9tRXZlbnQuc3RvcFByb3BhZ2F0aW9uKGUpO1xyXG5cclxuXHRcdGlmIChMLkRyYWdnYWJsZS5fZGlzYWJsZWQpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0TC5Eb21VdGlsLmRpc2FibGVJbWFnZURyYWcoKTtcclxuXHRcdEwuRG9tVXRpbC5kaXNhYmxlVGV4dFNlbGVjdGlvbigpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9tb3ZpbmcpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIGZpcnN0ID0gZS50b3VjaGVzID8gZS50b3VjaGVzWzBdIDogZTtcclxuXHJcblx0XHR0aGlzLl9zdGFydFBvaW50ID0gbmV3IEwuUG9pbnQoZmlyc3QuY2xpZW50WCwgZmlyc3QuY2xpZW50WSk7XHJcblx0XHR0aGlzLl9zdGFydFBvcyA9IHRoaXMuX25ld1BvcyA9IEwuRG9tVXRpbC5nZXRQb3NpdGlvbih0aGlzLl9lbGVtZW50KTtcclxuXHJcblx0XHRMLkRvbUV2ZW50XHJcblx0XHQgICAgLm9uKGRvY3VtZW50LCBMLkRyYWdnYWJsZS5NT1ZFW2UudHlwZV0sIHRoaXMuX29uTW92ZSwgdGhpcylcclxuXHRcdCAgICAub24oZG9jdW1lbnQsIEwuRHJhZ2dhYmxlLkVORFtlLnR5cGVdLCB0aGlzLl9vblVwLCB0aGlzKTtcclxuXHR9LFxyXG5cclxuXHRfb25Nb3ZlOiBmdW5jdGlvbiAoZSkge1xyXG5cdFx0aWYgKGUudG91Y2hlcyAmJiBlLnRvdWNoZXMubGVuZ3RoID4gMSkge1xyXG5cdFx0XHR0aGlzLl9tb3ZlZCA9IHRydWU7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgZmlyc3QgPSAoZS50b3VjaGVzICYmIGUudG91Y2hlcy5sZW5ndGggPT09IDEgPyBlLnRvdWNoZXNbMF0gOiBlKSxcclxuXHRcdCAgICBuZXdQb2ludCA9IG5ldyBMLlBvaW50KGZpcnN0LmNsaWVudFgsIGZpcnN0LmNsaWVudFkpLFxyXG5cdFx0ICAgIG9mZnNldCA9IG5ld1BvaW50LnN1YnRyYWN0KHRoaXMuX3N0YXJ0UG9pbnQpO1xyXG5cclxuXHRcdGlmICghb2Zmc2V0LnggJiYgIW9mZnNldC55KSB7IHJldHVybjsgfVxyXG5cdFx0aWYgKEwuQnJvd3Nlci50b3VjaCAmJiBNYXRoLmFicyhvZmZzZXQueCkgKyBNYXRoLmFicyhvZmZzZXQueSkgPCAzKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdEwuRG9tRXZlbnQucHJldmVudERlZmF1bHQoZSk7XHJcblxyXG5cdFx0aWYgKCF0aGlzLl9tb3ZlZCkge1xyXG5cdFx0XHR0aGlzLmZpcmUoJ2RyYWdzdGFydCcpO1xyXG5cclxuXHRcdFx0dGhpcy5fbW92ZWQgPSB0cnVlO1xyXG5cdFx0XHR0aGlzLl9zdGFydFBvcyA9IEwuRG9tVXRpbC5nZXRQb3NpdGlvbih0aGlzLl9lbGVtZW50KS5zdWJ0cmFjdChvZmZzZXQpO1xyXG5cclxuXHRcdFx0TC5Eb21VdGlsLmFkZENsYXNzKGRvY3VtZW50LmJvZHksICdsZWFmbGV0LWRyYWdnaW5nJyk7XHJcblx0XHRcdHRoaXMuX2xhc3RUYXJnZXQgPSBlLnRhcmdldCB8fCBlLnNyY0VsZW1lbnQ7XHJcblx0XHRcdEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9sYXN0VGFyZ2V0LCAnbGVhZmxldC1kcmFnLXRhcmdldCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX25ld1BvcyA9IHRoaXMuX3N0YXJ0UG9zLmFkZChvZmZzZXQpO1xyXG5cdFx0dGhpcy5fbW92aW5nID0gdHJ1ZTtcclxuXHJcblx0XHRMLlV0aWwuY2FuY2VsQW5pbUZyYW1lKHRoaXMuX2FuaW1SZXF1ZXN0KTtcclxuXHRcdHRoaXMuX2FuaW1SZXF1ZXN0ID0gTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUodGhpcy5fdXBkYXRlUG9zaXRpb24sIHRoaXMsIHRydWUsIHRoaXMuX2RyYWdTdGFydFRhcmdldCk7XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZVBvc2l0aW9uOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLmZpcmUoJ3ByZWRyYWcnKTtcclxuXHRcdEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9lbGVtZW50LCB0aGlzLl9uZXdQb3MpO1xyXG5cdFx0dGhpcy5maXJlKCdkcmFnJyk7XHJcblx0fSxcclxuXHJcblx0X29uVXA6IGZ1bmN0aW9uICgpIHtcclxuXHRcdEwuRG9tVXRpbC5yZW1vdmVDbGFzcyhkb2N1bWVudC5ib2R5LCAnbGVhZmxldC1kcmFnZ2luZycpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9sYXN0VGFyZ2V0KSB7XHJcblx0XHRcdEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aGlzLl9sYXN0VGFyZ2V0LCAnbGVhZmxldC1kcmFnLXRhcmdldCcpO1xyXG5cdFx0XHR0aGlzLl9sYXN0VGFyZ2V0ID0gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRmb3IgKHZhciBpIGluIEwuRHJhZ2dhYmxlLk1PVkUpIHtcclxuXHRcdFx0TC5Eb21FdmVudFxyXG5cdFx0XHQgICAgLm9mZihkb2N1bWVudCwgTC5EcmFnZ2FibGUuTU9WRVtpXSwgdGhpcy5fb25Nb3ZlKVxyXG5cdFx0XHQgICAgLm9mZihkb2N1bWVudCwgTC5EcmFnZ2FibGUuRU5EW2ldLCB0aGlzLl9vblVwKTtcclxuXHRcdH1cclxuXHJcblx0XHRMLkRvbVV0aWwuZW5hYmxlSW1hZ2VEcmFnKCk7XHJcblx0XHRMLkRvbVV0aWwuZW5hYmxlVGV4dFNlbGVjdGlvbigpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9tb3ZlZCAmJiB0aGlzLl9tb3ZpbmcpIHtcclxuXHRcdFx0Ly8gZW5zdXJlIGRyYWcgaXMgbm90IGZpcmVkIGFmdGVyIGRyYWdlbmRcclxuXHRcdFx0TC5VdGlsLmNhbmNlbEFuaW1GcmFtZSh0aGlzLl9hbmltUmVxdWVzdCk7XHJcblxyXG5cdFx0XHR0aGlzLmZpcmUoJ2RyYWdlbmQnLCB7XHJcblx0XHRcdFx0ZGlzdGFuY2U6IHRoaXMuX25ld1Bvcy5kaXN0YW5jZVRvKHRoaXMuX3N0YXJ0UG9zKVxyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9tb3ZpbmcgPSBmYWxzZTtcclxuXHR9XHJcbn0pO1xyXG5cblxuLypcblx0TC5IYW5kbGVyIGlzIGEgYmFzZSBjbGFzcyBmb3IgaGFuZGxlciBjbGFzc2VzIHRoYXQgYXJlIHVzZWQgaW50ZXJuYWxseSB0byBpbmplY3Rcblx0aW50ZXJhY3Rpb24gZmVhdHVyZXMgbGlrZSBkcmFnZ2luZyB0byBjbGFzc2VzIGxpa2UgTWFwIGFuZCBNYXJrZXIuXG4qL1xuXG5MLkhhbmRsZXIgPSBMLkNsYXNzLmV4dGVuZCh7XG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIChtYXApIHtcblx0XHR0aGlzLl9tYXAgPSBtYXA7XG5cdH0sXG5cblx0ZW5hYmxlOiBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKHRoaXMuX2VuYWJsZWQpIHsgcmV0dXJuOyB9XG5cblx0XHR0aGlzLl9lbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLmFkZEhvb2tzKCk7XG5cdH0sXG5cblx0ZGlzYWJsZTogZnVuY3Rpb24gKCkge1xuXHRcdGlmICghdGhpcy5fZW5hYmxlZCkgeyByZXR1cm47IH1cblxuXHRcdHRoaXMuX2VuYWJsZWQgPSBmYWxzZTtcblx0XHR0aGlzLnJlbW92ZUhvb2tzKCk7XG5cdH0sXG5cblx0ZW5hYmxlZDogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiAhIXRoaXMuX2VuYWJsZWQ7XG5cdH1cbn0pO1xuXG5cbi8qXG4gKiBMLkhhbmRsZXIuTWFwRHJhZyBpcyB1c2VkIHRvIG1ha2UgdGhlIG1hcCBkcmFnZ2FibGUgKHdpdGggcGFubmluZyBpbmVydGlhKSwgZW5hYmxlZCBieSBkZWZhdWx0LlxuICovXG5cbkwuTWFwLm1lcmdlT3B0aW9ucyh7XG5cdGRyYWdnaW5nOiB0cnVlLFxuXG5cdGluZXJ0aWE6ICFMLkJyb3dzZXIuYW5kcm9pZDIzLFxuXHRpbmVydGlhRGVjZWxlcmF0aW9uOiAzNDAwLCAvLyBweC9zXjJcblx0aW5lcnRpYU1heFNwZWVkOiBJbmZpbml0eSwgLy8gcHgvc1xuXHRpbmVydGlhVGhyZXNob2xkOiBMLkJyb3dzZXIudG91Y2ggPyAzMiA6IDE4LCAvLyBtc1xuXHRlYXNlTGluZWFyaXR5OiAwLjI1LFxuXG5cdC8vIFRPRE8gcmVmYWN0b3IsIG1vdmUgdG8gQ1JTXG5cdHdvcmxkQ29weUp1bXA6IGZhbHNlXG59KTtcblxuTC5NYXAuRHJhZyA9IEwuSGFuZGxlci5leHRlbmQoe1xuXHRhZGRIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdGlmICghdGhpcy5fZHJhZ2dhYmxlKSB7XG5cdFx0XHR2YXIgbWFwID0gdGhpcy5fbWFwO1xuXG5cdFx0XHR0aGlzLl9kcmFnZ2FibGUgPSBuZXcgTC5EcmFnZ2FibGUobWFwLl9tYXBQYW5lLCBtYXAuX2NvbnRhaW5lcik7XG5cblx0XHRcdHRoaXMuX2RyYWdnYWJsZS5vbih7XG5cdFx0XHRcdCdkcmFnc3RhcnQnOiB0aGlzLl9vbkRyYWdTdGFydCxcblx0XHRcdFx0J2RyYWcnOiB0aGlzLl9vbkRyYWcsXG5cdFx0XHRcdCdkcmFnZW5kJzogdGhpcy5fb25EcmFnRW5kXG5cdFx0XHR9LCB0aGlzKTtcblxuXHRcdFx0aWYgKG1hcC5vcHRpb25zLndvcmxkQ29weUp1bXApIHtcblx0XHRcdFx0dGhpcy5fZHJhZ2dhYmxlLm9uKCdwcmVkcmFnJywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKTtcblx0XHRcdFx0bWFwLm9uKCd2aWV3cmVzZXQnLCB0aGlzLl9vblZpZXdSZXNldCwgdGhpcyk7XG5cblx0XHRcdFx0bWFwLndoZW5SZWFkeSh0aGlzLl9vblZpZXdSZXNldCwgdGhpcyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2RyYWdnYWJsZS5lbmFibGUoKTtcblx0fSxcblxuXHRyZW1vdmVIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMuX2RyYWdnYWJsZS5kaXNhYmxlKCk7XG5cdH0sXG5cblx0bW92ZWQ6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZHJhZ2dhYmxlICYmIHRoaXMuX2RyYWdnYWJsZS5fbW92ZWQ7XG5cdH0sXG5cblx0X29uRHJhZ1N0YXJ0OiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIG1hcCA9IHRoaXMuX21hcDtcblxuXHRcdGlmIChtYXAuX3BhbkFuaW0pIHtcblx0XHRcdG1hcC5fcGFuQW5pbS5zdG9wKCk7XG5cdFx0fVxuXG5cdFx0bWFwXG5cdFx0ICAgIC5maXJlKCdtb3Zlc3RhcnQnKVxuXHRcdCAgICAuZmlyZSgnZHJhZ3N0YXJ0Jyk7XG5cblx0XHRpZiAobWFwLm9wdGlvbnMuaW5lcnRpYSkge1xuXHRcdFx0dGhpcy5fcG9zaXRpb25zID0gW107XG5cdFx0XHR0aGlzLl90aW1lcyA9IFtdO1xuXHRcdH1cblx0fSxcblxuXHRfb25EcmFnOiBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKHRoaXMuX21hcC5vcHRpb25zLmluZXJ0aWEpIHtcblx0XHRcdHZhciB0aW1lID0gdGhpcy5fbGFzdFRpbWUgPSArbmV3IERhdGUoKSxcblx0XHRcdCAgICBwb3MgPSB0aGlzLl9sYXN0UG9zID0gdGhpcy5fZHJhZ2dhYmxlLl9uZXdQb3M7XG5cblx0XHRcdHRoaXMuX3Bvc2l0aW9ucy5wdXNoKHBvcyk7XG5cdFx0XHR0aGlzLl90aW1lcy5wdXNoKHRpbWUpO1xuXG5cdFx0XHRpZiAodGltZSAtIHRoaXMuX3RpbWVzWzBdID4gMjAwKSB7XG5cdFx0XHRcdHRoaXMuX3Bvc2l0aW9ucy5zaGlmdCgpO1xuXHRcdFx0XHR0aGlzLl90aW1lcy5zaGlmdCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX21hcFxuXHRcdCAgICAuZmlyZSgnbW92ZScpXG5cdFx0ICAgIC5maXJlKCdkcmFnJyk7XG5cdH0sXG5cblx0X29uVmlld1Jlc2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0Ly8gVE9ETyBmaXggaGFyZGNvZGVkIEVhcnRoIHZhbHVlc1xuXHRcdHZhciBweENlbnRlciA9IHRoaXMuX21hcC5nZXRTaXplKCkuX2RpdmlkZUJ5KDIpLFxuXHRcdCAgICBweFdvcmxkQ2VudGVyID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludChbMCwgMF0pO1xuXG5cdFx0dGhpcy5faW5pdGlhbFdvcmxkT2Zmc2V0ID0gcHhXb3JsZENlbnRlci5zdWJ0cmFjdChweENlbnRlcikueDtcblx0XHR0aGlzLl93b3JsZFdpZHRoID0gdGhpcy5fbWFwLnByb2plY3QoWzAsIDE4MF0pLng7XG5cdH0sXG5cblx0X29uUHJlRHJhZzogZnVuY3Rpb24gKCkge1xuXHRcdC8vIFRPRE8gcmVmYWN0b3IgdG8gYmUgYWJsZSB0byBhZGp1c3QgbWFwIHBhbmUgcG9zaXRpb24gYWZ0ZXIgem9vbVxuXHRcdHZhciB3b3JsZFdpZHRoID0gdGhpcy5fd29ybGRXaWR0aCxcblx0XHQgICAgaGFsZldpZHRoID0gTWF0aC5yb3VuZCh3b3JsZFdpZHRoIC8gMiksXG5cdFx0ICAgIGR4ID0gdGhpcy5faW5pdGlhbFdvcmxkT2Zmc2V0LFxuXHRcdCAgICB4ID0gdGhpcy5fZHJhZ2dhYmxlLl9uZXdQb3MueCxcblx0XHQgICAgbmV3WDEgPSAoeCAtIGhhbGZXaWR0aCArIGR4KSAlIHdvcmxkV2lkdGggKyBoYWxmV2lkdGggLSBkeCxcblx0XHQgICAgbmV3WDIgPSAoeCArIGhhbGZXaWR0aCArIGR4KSAlIHdvcmxkV2lkdGggLSBoYWxmV2lkdGggLSBkeCxcblx0XHQgICAgbmV3WCA9IE1hdGguYWJzKG5ld1gxICsgZHgpIDwgTWF0aC5hYnMobmV3WDIgKyBkeCkgPyBuZXdYMSA6IG5ld1gyO1xuXG5cdFx0dGhpcy5fZHJhZ2dhYmxlLl9uZXdQb3MueCA9IG5ld1g7XG5cdH0sXG5cblx0X29uRHJhZ0VuZDogZnVuY3Rpb24gKGUpIHtcblx0XHR2YXIgbWFwID0gdGhpcy5fbWFwLFxuXHRcdCAgICBvcHRpb25zID0gbWFwLm9wdGlvbnMsXG5cdFx0ICAgIGRlbGF5ID0gK25ldyBEYXRlKCkgLSB0aGlzLl9sYXN0VGltZSxcblxuXHRcdCAgICBub0luZXJ0aWEgPSAhb3B0aW9ucy5pbmVydGlhIHx8IGRlbGF5ID4gb3B0aW9ucy5pbmVydGlhVGhyZXNob2xkIHx8ICF0aGlzLl9wb3NpdGlvbnNbMF07XG5cblx0XHRtYXAuZmlyZSgnZHJhZ2VuZCcsIGUpO1xuXG5cdFx0aWYgKG5vSW5lcnRpYSkge1xuXHRcdFx0bWFwLmZpcmUoJ21vdmVlbmQnKTtcblxuXHRcdH0gZWxzZSB7XG5cblx0XHRcdHZhciBkaXJlY3Rpb24gPSB0aGlzLl9sYXN0UG9zLnN1YnRyYWN0KHRoaXMuX3Bvc2l0aW9uc1swXSksXG5cdFx0XHQgICAgZHVyYXRpb24gPSAodGhpcy5fbGFzdFRpbWUgKyBkZWxheSAtIHRoaXMuX3RpbWVzWzBdKSAvIDEwMDAsXG5cdFx0XHQgICAgZWFzZSA9IG9wdGlvbnMuZWFzZUxpbmVhcml0eSxcblxuXHRcdFx0ICAgIHNwZWVkVmVjdG9yID0gZGlyZWN0aW9uLm11bHRpcGx5QnkoZWFzZSAvIGR1cmF0aW9uKSxcblx0XHRcdCAgICBzcGVlZCA9IHNwZWVkVmVjdG9yLmRpc3RhbmNlVG8oWzAsIDBdKSxcblxuXHRcdFx0ICAgIGxpbWl0ZWRTcGVlZCA9IE1hdGgubWluKG9wdGlvbnMuaW5lcnRpYU1heFNwZWVkLCBzcGVlZCksXG5cdFx0XHQgICAgbGltaXRlZFNwZWVkVmVjdG9yID0gc3BlZWRWZWN0b3IubXVsdGlwbHlCeShsaW1pdGVkU3BlZWQgLyBzcGVlZCksXG5cblx0XHRcdCAgICBkZWNlbGVyYXRpb25EdXJhdGlvbiA9IGxpbWl0ZWRTcGVlZCAvIChvcHRpb25zLmluZXJ0aWFEZWNlbGVyYXRpb24gKiBlYXNlKSxcblx0XHRcdCAgICBvZmZzZXQgPSBsaW1pdGVkU3BlZWRWZWN0b3IubXVsdGlwbHlCeSgtZGVjZWxlcmF0aW9uRHVyYXRpb24gLyAyKS5yb3VuZCgpO1xuXG5cdFx0XHRpZiAoIW9mZnNldC54IHx8ICFvZmZzZXQueSkge1xuXHRcdFx0XHRtYXAuZmlyZSgnbW92ZWVuZCcpO1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvZmZzZXQgPSBtYXAuX2xpbWl0T2Zmc2V0KG9mZnNldCwgbWFwLm9wdGlvbnMubWF4Qm91bmRzKTtcblxuXHRcdFx0XHRMLlV0aWwucmVxdWVzdEFuaW1GcmFtZShmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0bWFwLnBhbkJ5KG9mZnNldCwge1xuXHRcdFx0XHRcdFx0ZHVyYXRpb246IGRlY2VsZXJhdGlvbkR1cmF0aW9uLFxuXHRcdFx0XHRcdFx0ZWFzZUxpbmVhcml0eTogZWFzZSxcblx0XHRcdFx0XHRcdG5vTW92ZVN0YXJ0OiB0cnVlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbkwuTWFwLmFkZEluaXRIb29rKCdhZGRIYW5kbGVyJywgJ2RyYWdnaW5nJywgTC5NYXAuRHJhZyk7XG5cblxuLypcbiAqIEwuSGFuZGxlci5Eb3VibGVDbGlja1pvb20gaXMgdXNlZCB0byBoYW5kbGUgZG91YmxlLWNsaWNrIHpvb20gb24gdGhlIG1hcCwgZW5hYmxlZCBieSBkZWZhdWx0LlxuICovXG5cbkwuTWFwLm1lcmdlT3B0aW9ucyh7XG5cdGRvdWJsZUNsaWNrWm9vbTogdHJ1ZVxufSk7XG5cbkwuTWFwLkRvdWJsZUNsaWNrWm9vbSA9IEwuSGFuZGxlci5leHRlbmQoe1xuXHRhZGRIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMuX21hcC5vbignZGJsY2xpY2snLCB0aGlzLl9vbkRvdWJsZUNsaWNrLCB0aGlzKTtcblx0fSxcblxuXHRyZW1vdmVIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMuX21hcC5vZmYoJ2RibGNsaWNrJywgdGhpcy5fb25Eb3VibGVDbGljaywgdGhpcyk7XG5cdH0sXG5cblx0X29uRG91YmxlQ2xpY2s6IGZ1bmN0aW9uIChlKSB7XG5cdFx0dmFyIG1hcCA9IHRoaXMuX21hcCxcblx0XHQgICAgem9vbSA9IG1hcC5nZXRab29tKCkgKyAoZS5vcmlnaW5hbEV2ZW50LnNoaWZ0S2V5ID8gLTEgOiAxKTtcblxuXHRcdGlmIChtYXAub3B0aW9ucy5kb3VibGVDbGlja1pvb20gPT09ICdjZW50ZXInKSB7XG5cdFx0XHRtYXAuc2V0Wm9vbSh6b29tKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWFwLnNldFpvb21Bcm91bmQoZS5jb250YWluZXJQb2ludCwgem9vbSk7XG5cdFx0fVxuXHR9XG59KTtcblxuTC5NYXAuYWRkSW5pdEhvb2soJ2FkZEhhbmRsZXInLCAnZG91YmxlQ2xpY2tab29tJywgTC5NYXAuRG91YmxlQ2xpY2tab29tKTtcblxuXG4vKlxuICogTC5IYW5kbGVyLlNjcm9sbFdoZWVsWm9vbSBpcyB1c2VkIGJ5IEwuTWFwIHRvIGVuYWJsZSBtb3VzZSBzY3JvbGwgd2hlZWwgem9vbSBvbiB0aGUgbWFwLlxuICovXG5cbkwuTWFwLm1lcmdlT3B0aW9ucyh7XG5cdHNjcm9sbFdoZWVsWm9vbTogdHJ1ZVxufSk7XG5cbkwuTWFwLlNjcm9sbFdoZWVsWm9vbSA9IEwuSGFuZGxlci5leHRlbmQoe1xuXHRhZGRIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdEwuRG9tRXZlbnQub24odGhpcy5fbWFwLl9jb250YWluZXIsICdtb3VzZXdoZWVsJywgdGhpcy5fb25XaGVlbFNjcm9sbCwgdGhpcyk7XG5cdFx0TC5Eb21FdmVudC5vbih0aGlzLl9tYXAuX2NvbnRhaW5lciwgJ01vek1vdXNlUGl4ZWxTY3JvbGwnLCBMLkRvbUV2ZW50LnByZXZlbnREZWZhdWx0KTtcblx0XHR0aGlzLl9kZWx0YSA9IDA7XG5cdH0sXG5cblx0cmVtb3ZlSG9va3M6IGZ1bmN0aW9uICgpIHtcblx0XHRMLkRvbUV2ZW50Lm9mZih0aGlzLl9tYXAuX2NvbnRhaW5lciwgJ21vdXNld2hlZWwnLCB0aGlzLl9vbldoZWVsU2Nyb2xsKTtcblx0XHRMLkRvbUV2ZW50Lm9mZih0aGlzLl9tYXAuX2NvbnRhaW5lciwgJ01vek1vdXNlUGl4ZWxTY3JvbGwnLCBMLkRvbUV2ZW50LnByZXZlbnREZWZhdWx0KTtcblx0fSxcblxuXHRfb25XaGVlbFNjcm9sbDogZnVuY3Rpb24gKGUpIHtcblx0XHR2YXIgZGVsdGEgPSBMLkRvbUV2ZW50LmdldFdoZWVsRGVsdGEoZSk7XG5cblx0XHR0aGlzLl9kZWx0YSArPSBkZWx0YTtcblx0XHR0aGlzLl9sYXN0TW91c2VQb3MgPSB0aGlzLl9tYXAubW91c2VFdmVudFRvQ29udGFpbmVyUG9pbnQoZSk7XG5cblx0XHRpZiAoIXRoaXMuX3N0YXJ0VGltZSkge1xuXHRcdFx0dGhpcy5fc3RhcnRUaW1lID0gK25ldyBEYXRlKCk7XG5cdFx0fVxuXG5cdFx0dmFyIGxlZnQgPSBNYXRoLm1heCg0MCAtICgrbmV3IERhdGUoKSAtIHRoaXMuX3N0YXJ0VGltZSksIDApO1xuXG5cdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVyKTtcblx0XHR0aGlzLl90aW1lciA9IHNldFRpbWVvdXQoTC5iaW5kKHRoaXMuX3BlcmZvcm1ab29tLCB0aGlzKSwgbGVmdCk7XG5cblx0XHRMLkRvbUV2ZW50LnByZXZlbnREZWZhdWx0KGUpO1xuXHRcdEwuRG9tRXZlbnQuc3RvcFByb3BhZ2F0aW9uKGUpO1xuXHR9LFxuXG5cdF9wZXJmb3JtWm9vbTogZnVuY3Rpb24gKCkge1xuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXAsXG5cdFx0ICAgIGRlbHRhID0gdGhpcy5fZGVsdGEsXG5cdFx0ICAgIHpvb20gPSBtYXAuZ2V0Wm9vbSgpO1xuXG5cdFx0ZGVsdGEgPSBkZWx0YSA+IDAgPyBNYXRoLmNlaWwoZGVsdGEpIDogTWF0aC5mbG9vcihkZWx0YSk7XG5cdFx0ZGVsdGEgPSBNYXRoLm1heChNYXRoLm1pbihkZWx0YSwgNCksIC00KTtcblx0XHRkZWx0YSA9IG1hcC5fbGltaXRab29tKHpvb20gKyBkZWx0YSkgLSB6b29tO1xuXG5cdFx0dGhpcy5fZGVsdGEgPSAwO1xuXHRcdHRoaXMuX3N0YXJ0VGltZSA9IG51bGw7XG5cblx0XHRpZiAoIWRlbHRhKSB7IHJldHVybjsgfVxuXG5cdFx0aWYgKG1hcC5vcHRpb25zLnNjcm9sbFdoZWVsWm9vbSA9PT0gJ2NlbnRlcicpIHtcblx0XHRcdG1hcC5zZXRab29tKHpvb20gKyBkZWx0YSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1hcC5zZXRab29tQXJvdW5kKHRoaXMuX2xhc3RNb3VzZVBvcywgem9vbSArIGRlbHRhKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5MLk1hcC5hZGRJbml0SG9vaygnYWRkSGFuZGxlcicsICdzY3JvbGxXaGVlbFpvb20nLCBMLk1hcC5TY3JvbGxXaGVlbFpvb20pO1xuXG5cbi8qXHJcbiAqIEV4dGVuZHMgdGhlIGV2ZW50IGhhbmRsaW5nIGNvZGUgd2l0aCBkb3VibGUgdGFwIHN1cHBvcnQgZm9yIG1vYmlsZSBicm93c2Vycy5cclxuICovXHJcblxyXG5MLmV4dGVuZChMLkRvbUV2ZW50LCB7XHJcblxyXG5cdF90b3VjaHN0YXJ0OiBMLkJyb3dzZXIubXNQb2ludGVyID8gJ01TUG9pbnRlckRvd24nIDogTC5Ccm93c2VyLnBvaW50ZXIgPyAncG9pbnRlcmRvd24nIDogJ3RvdWNoc3RhcnQnLFxyXG5cdF90b3VjaGVuZDogTC5Ccm93c2VyLm1zUG9pbnRlciA/ICdNU1BvaW50ZXJVcCcgOiBMLkJyb3dzZXIucG9pbnRlciA/ICdwb2ludGVydXAnIDogJ3RvdWNoZW5kJyxcclxuXHJcblx0Ly8gaW5zcGlyZWQgYnkgWmVwdG8gdG91Y2ggY29kZSBieSBUaG9tYXMgRnVjaHNcclxuXHRhZGREb3VibGVUYXBMaXN0ZW5lcjogZnVuY3Rpb24gKG9iaiwgaGFuZGxlciwgaWQpIHtcclxuXHRcdHZhciBsYXN0LFxyXG5cdFx0ICAgIGRvdWJsZVRhcCA9IGZhbHNlLFxyXG5cdFx0ICAgIGRlbGF5ID0gMjUwLFxyXG5cdFx0ICAgIHRvdWNoLFxyXG5cdFx0ICAgIHByZSA9ICdfbGVhZmxldF8nLFxyXG5cdFx0ICAgIHRvdWNoc3RhcnQgPSB0aGlzLl90b3VjaHN0YXJ0LFxyXG5cdFx0ICAgIHRvdWNoZW5kID0gdGhpcy5fdG91Y2hlbmQsXHJcblx0XHQgICAgdHJhY2tlZFRvdWNoZXMgPSBbXTtcclxuXHJcblx0XHRmdW5jdGlvbiBvblRvdWNoU3RhcnQoZSkge1xyXG5cdFx0XHR2YXIgY291bnQ7XHJcblxyXG5cdFx0XHRpZiAoTC5Ccm93c2VyLnBvaW50ZXIpIHtcclxuXHRcdFx0XHR0cmFja2VkVG91Y2hlcy5wdXNoKGUucG9pbnRlcklkKTtcclxuXHRcdFx0XHRjb3VudCA9IHRyYWNrZWRUb3VjaGVzLmxlbmd0aDtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb3VudCA9IGUudG91Y2hlcy5sZW5ndGg7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKGNvdW50ID4gMSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIG5vdyA9IERhdGUubm93KCksXHJcblx0XHRcdFx0ZGVsdGEgPSBub3cgLSAobGFzdCB8fCBub3cpO1xyXG5cclxuXHRcdFx0dG91Y2ggPSBlLnRvdWNoZXMgPyBlLnRvdWNoZXNbMF0gOiBlO1xyXG5cdFx0XHRkb3VibGVUYXAgPSAoZGVsdGEgPiAwICYmIGRlbHRhIDw9IGRlbGF5KTtcclxuXHRcdFx0bGFzdCA9IG5vdztcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBvblRvdWNoRW5kKGUpIHtcclxuXHRcdFx0aWYgKEwuQnJvd3Nlci5wb2ludGVyKSB7XHJcblx0XHRcdFx0dmFyIGlkeCA9IHRyYWNrZWRUb3VjaGVzLmluZGV4T2YoZS5wb2ludGVySWQpO1xyXG5cdFx0XHRcdGlmIChpZHggPT09IC0xKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRyYWNrZWRUb3VjaGVzLnNwbGljZShpZHgsIDEpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoZG91YmxlVGFwKSB7XHJcblx0XHRcdFx0aWYgKEwuQnJvd3Nlci5wb2ludGVyKSB7XHJcblx0XHRcdFx0XHQvLyB3b3JrIGFyb3VuZCAudHlwZSBiZWluZyByZWFkb25seSB3aXRoIE1TUG9pbnRlciogZXZlbnRzXHJcblx0XHRcdFx0XHR2YXIgbmV3VG91Y2ggPSB7IH0sXHJcblx0XHRcdFx0XHRcdHByb3A7XHJcblxyXG5cdFx0XHRcdFx0Ly8ganNoaW50IGZvcmluOmZhbHNlXHJcblx0XHRcdFx0XHRmb3IgKHZhciBpIGluIHRvdWNoKSB7XHJcblx0XHRcdFx0XHRcdHByb3AgPSB0b3VjaFtpXTtcclxuXHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBwcm9wID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0XHRcdFx0bmV3VG91Y2hbaV0gPSBwcm9wLmJpbmQodG91Y2gpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdG5ld1RvdWNoW2ldID0gcHJvcDtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dG91Y2ggPSBuZXdUb3VjaDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dG91Y2gudHlwZSA9ICdkYmxjbGljayc7XHJcblx0XHRcdFx0aGFuZGxlcih0b3VjaCk7XHJcblx0XHRcdFx0bGFzdCA9IG51bGw7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdG9ialtwcmUgKyB0b3VjaHN0YXJ0ICsgaWRdID0gb25Ub3VjaFN0YXJ0O1xyXG5cdFx0b2JqW3ByZSArIHRvdWNoZW5kICsgaWRdID0gb25Ub3VjaEVuZDtcclxuXHJcblx0XHQvLyBvbiBwb2ludGVyIHdlIG5lZWQgdG8gbGlzdGVuIG9uIHRoZSBkb2N1bWVudCwgb3RoZXJ3aXNlIGEgZHJhZyBzdGFydGluZyBvbiB0aGUgbWFwIGFuZCBtb3Zpbmcgb2ZmIHNjcmVlblxyXG5cdFx0Ly8gd2lsbCBub3QgY29tZSB0aHJvdWdoIHRvIHVzLCBzbyB3ZSB3aWxsIGxvc2UgdHJhY2sgb2YgaG93IG1hbnkgdG91Y2hlcyBhcmUgb25nb2luZ1xyXG5cdFx0dmFyIGVuZEVsZW1lbnQgPSBMLkJyb3dzZXIucG9pbnRlciA/IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCA6IG9iajtcclxuXHJcblx0XHRvYmouYWRkRXZlbnRMaXN0ZW5lcih0b3VjaHN0YXJ0LCBvblRvdWNoU3RhcnQsIGZhbHNlKTtcclxuXHRcdGVuZEVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcih0b3VjaGVuZCwgb25Ub3VjaEVuZCwgZmFsc2UpO1xyXG5cclxuXHRcdGlmIChMLkJyb3dzZXIucG9pbnRlcikge1xyXG5cdFx0XHRlbmRFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoTC5Eb21FdmVudC5QT0lOVEVSX0NBTkNFTCwgb25Ub3VjaEVuZCwgZmFsc2UpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdHJlbW92ZURvdWJsZVRhcExpc3RlbmVyOiBmdW5jdGlvbiAob2JqLCBpZCkge1xyXG5cdFx0dmFyIHByZSA9ICdfbGVhZmxldF8nO1xyXG5cclxuXHRcdG9iai5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMuX3RvdWNoc3RhcnQsIG9ialtwcmUgKyB0aGlzLl90b3VjaHN0YXJ0ICsgaWRdLCBmYWxzZSk7XHJcblx0XHQoTC5Ccm93c2VyLnBvaW50ZXIgPyBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgOiBvYmopLnJlbW92ZUV2ZW50TGlzdGVuZXIoXHJcblx0XHQgICAgICAgIHRoaXMuX3RvdWNoZW5kLCBvYmpbcHJlICsgdGhpcy5fdG91Y2hlbmQgKyBpZF0sIGZhbHNlKTtcclxuXHJcblx0XHRpZiAoTC5Ccm93c2VyLnBvaW50ZXIpIHtcclxuXHRcdFx0ZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoTC5Eb21FdmVudC5QT0lOVEVSX0NBTkNFTCwgb2JqW3ByZSArIHRoaXMuX3RvdWNoZW5kICsgaWRdLFxyXG5cdFx0XHRcdGZhbHNlKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcbn0pO1xyXG5cblxuLypcbiAqIEV4dGVuZHMgTC5Eb21FdmVudCB0byBwcm92aWRlIHRvdWNoIHN1cHBvcnQgZm9yIEludGVybmV0IEV4cGxvcmVyIGFuZCBXaW5kb3dzLWJhc2VkIGRldmljZXMuXG4gKi9cblxuTC5leHRlbmQoTC5Eb21FdmVudCwge1xuXG5cdC8vc3RhdGljXG5cdFBPSU5URVJfRE9XTjogTC5Ccm93c2VyLm1zUG9pbnRlciA/ICdNU1BvaW50ZXJEb3duJyA6ICdwb2ludGVyZG93bicsXG5cdFBPSU5URVJfTU9WRTogTC5Ccm93c2VyLm1zUG9pbnRlciA/ICdNU1BvaW50ZXJNb3ZlJyA6ICdwb2ludGVybW92ZScsXG5cdFBPSU5URVJfVVA6IEwuQnJvd3Nlci5tc1BvaW50ZXIgPyAnTVNQb2ludGVyVXAnIDogJ3BvaW50ZXJ1cCcsXG5cdFBPSU5URVJfQ0FOQ0VMOiBMLkJyb3dzZXIubXNQb2ludGVyID8gJ01TUG9pbnRlckNhbmNlbCcgOiAncG9pbnRlcmNhbmNlbCcsXG5cblx0X3BvaW50ZXJzOiBbXSxcblx0X3BvaW50ZXJEb2N1bWVudExpc3RlbmVyOiBmYWxzZSxcblxuXHQvLyBQcm92aWRlcyBhIHRvdWNoIGV2ZW50cyB3cmFwcGVyIGZvciAobXMpcG9pbnRlciBldmVudHMuXG5cdC8vIEJhc2VkIG9uIGNoYW5nZXMgYnkgdmVwcm96YSBodHRwczovL2dpdGh1Yi5jb20vQ2xvdWRNYWRlL0xlYWZsZXQvcHVsbC8xMDE5XG5cdC8vcmVmIGh0dHA6Ly93d3cudzMub3JnL1RSL3BvaW50ZXJldmVudHMvIGh0dHBzOi8vd3d3LnczLm9yZy9CdWdzL1B1YmxpYy9zaG93X2J1Zy5jZ2k/aWQ9MjI4OTBcblxuXHRhZGRQb2ludGVyTGlzdGVuZXI6IGZ1bmN0aW9uIChvYmosIHR5cGUsIGhhbmRsZXIsIGlkKSB7XG5cblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRjYXNlICd0b3VjaHN0YXJ0Jzpcblx0XHRcdHJldHVybiB0aGlzLmFkZFBvaW50ZXJMaXN0ZW5lclN0YXJ0KG9iaiwgdHlwZSwgaGFuZGxlciwgaWQpO1xuXHRcdGNhc2UgJ3RvdWNoZW5kJzpcblx0XHRcdHJldHVybiB0aGlzLmFkZFBvaW50ZXJMaXN0ZW5lckVuZChvYmosIHR5cGUsIGhhbmRsZXIsIGlkKTtcblx0XHRjYXNlICd0b3VjaG1vdmUnOlxuXHRcdFx0cmV0dXJuIHRoaXMuYWRkUG9pbnRlckxpc3RlbmVyTW92ZShvYmosIHR5cGUsIGhhbmRsZXIsIGlkKTtcblx0XHRkZWZhdWx0OlxuXHRcdFx0dGhyb3cgJ1Vua25vd24gdG91Y2ggZXZlbnQgdHlwZSc7XG5cdFx0fVxuXHR9LFxuXG5cdGFkZFBvaW50ZXJMaXN0ZW5lclN0YXJ0OiBmdW5jdGlvbiAob2JqLCB0eXBlLCBoYW5kbGVyLCBpZCkge1xuXHRcdHZhciBwcmUgPSAnX2xlYWZsZXRfJyxcblx0XHQgICAgcG9pbnRlcnMgPSB0aGlzLl9wb2ludGVycztcblxuXHRcdHZhciBjYiA9IGZ1bmN0aW9uIChlKSB7XG5cblx0XHRcdEwuRG9tRXZlbnQucHJldmVudERlZmF1bHQoZSk7XG5cblx0XHRcdHZhciBhbHJlYWR5SW5BcnJheSA9IGZhbHNlO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwb2ludGVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAocG9pbnRlcnNbaV0ucG9pbnRlcklkID09PSBlLnBvaW50ZXJJZCkge1xuXHRcdFx0XHRcdGFscmVhZHlJbkFycmF5ID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFhbHJlYWR5SW5BcnJheSkge1xuXHRcdFx0XHRwb2ludGVycy5wdXNoKGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRlLnRvdWNoZXMgPSBwb2ludGVycy5zbGljZSgpO1xuXHRcdFx0ZS5jaGFuZ2VkVG91Y2hlcyA9IFtlXTtcblxuXHRcdFx0aGFuZGxlcihlKTtcblx0XHR9O1xuXG5cdFx0b2JqW3ByZSArICd0b3VjaHN0YXJ0JyArIGlkXSA9IGNiO1xuXHRcdG9iai5hZGRFdmVudExpc3RlbmVyKHRoaXMuUE9JTlRFUl9ET1dOLCBjYiwgZmFsc2UpO1xuXG5cdFx0Ly8gbmVlZCB0byBhbHNvIGxpc3RlbiBmb3IgZW5kIGV2ZW50cyB0byBrZWVwIHRoZSBfcG9pbnRlcnMgbGlzdCBhY2N1cmF0ZVxuXHRcdC8vIHRoaXMgbmVlZHMgdG8gYmUgb24gdGhlIGJvZHkgYW5kIG5ldmVyIGdvIGF3YXlcblx0XHRpZiAoIXRoaXMuX3BvaW50ZXJEb2N1bWVudExpc3RlbmVyKSB7XG5cdFx0XHR2YXIgaW50ZXJuYWxDYiA9IGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcG9pbnRlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRpZiAocG9pbnRlcnNbaV0ucG9pbnRlcklkID09PSBlLnBvaW50ZXJJZCkge1xuXHRcdFx0XHRcdFx0cG9pbnRlcnMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0Ly9XZSBsaXN0ZW4gb24gdGhlIGRvY3VtZW50RWxlbWVudCBhcyBhbnkgZHJhZ3MgdGhhdCBlbmQgYnkgbW92aW5nIHRoZSB0b3VjaCBvZmYgdGhlIHNjcmVlbiBnZXQgZmlyZWQgdGhlcmVcblx0XHRcdGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hZGRFdmVudExpc3RlbmVyKHRoaXMuUE9JTlRFUl9VUCwgaW50ZXJuYWxDYiwgZmFsc2UpO1xuXHRcdFx0ZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIodGhpcy5QT0lOVEVSX0NBTkNFTCwgaW50ZXJuYWxDYiwgZmFsc2UpO1xuXG5cdFx0XHR0aGlzLl9wb2ludGVyRG9jdW1lbnRMaXN0ZW5lciA9IHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0YWRkUG9pbnRlckxpc3RlbmVyTW92ZTogZnVuY3Rpb24gKG9iaiwgdHlwZSwgaGFuZGxlciwgaWQpIHtcblx0XHR2YXIgcHJlID0gJ19sZWFmbGV0XycsXG5cdFx0ICAgIHRvdWNoZXMgPSB0aGlzLl9wb2ludGVycztcblxuXHRcdGZ1bmN0aW9uIGNiKGUpIHtcblxuXHRcdFx0Ly8gZG9uJ3QgZmlyZSB0b3VjaCBtb3ZlcyB3aGVuIG1vdXNlIGlzbid0IGRvd25cblx0XHRcdGlmICgoZS5wb2ludGVyVHlwZSA9PT0gZS5NU1BPSU5URVJfVFlQRV9NT1VTRSB8fCBlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSAmJiBlLmJ1dHRvbnMgPT09IDApIHsgcmV0dXJuOyB9XG5cblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdG91Y2hlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodG91Y2hlc1tpXS5wb2ludGVySWQgPT09IGUucG9pbnRlcklkKSB7XG5cdFx0XHRcdFx0dG91Y2hlc1tpXSA9IGU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZS50b3VjaGVzID0gdG91Y2hlcy5zbGljZSgpO1xuXHRcdFx0ZS5jaGFuZ2VkVG91Y2hlcyA9IFtlXTtcblxuXHRcdFx0aGFuZGxlcihlKTtcblx0XHR9XG5cblx0XHRvYmpbcHJlICsgJ3RvdWNobW92ZScgKyBpZF0gPSBjYjtcblx0XHRvYmouYWRkRXZlbnRMaXN0ZW5lcih0aGlzLlBPSU5URVJfTU9WRSwgY2IsIGZhbHNlKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdGFkZFBvaW50ZXJMaXN0ZW5lckVuZDogZnVuY3Rpb24gKG9iaiwgdHlwZSwgaGFuZGxlciwgaWQpIHtcblx0XHR2YXIgcHJlID0gJ19sZWFmbGV0XycsXG5cdFx0ICAgIHRvdWNoZXMgPSB0aGlzLl9wb2ludGVycztcblxuXHRcdHZhciBjYiA9IGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHRvdWNoZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHRvdWNoZXNbaV0ucG9pbnRlcklkID09PSBlLnBvaW50ZXJJZCkge1xuXHRcdFx0XHRcdHRvdWNoZXMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGUudG91Y2hlcyA9IHRvdWNoZXMuc2xpY2UoKTtcblx0XHRcdGUuY2hhbmdlZFRvdWNoZXMgPSBbZV07XG5cblx0XHRcdGhhbmRsZXIoZSk7XG5cdFx0fTtcblxuXHRcdG9ialtwcmUgKyAndG91Y2hlbmQnICsgaWRdID0gY2I7XG5cdFx0b2JqLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5QT0lOVEVSX1VQLCBjYiwgZmFsc2UpO1xuXHRcdG9iai5hZGRFdmVudExpc3RlbmVyKHRoaXMuUE9JTlRFUl9DQU5DRUwsIGNiLCBmYWxzZSk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHRyZW1vdmVQb2ludGVyTGlzdGVuZXI6IGZ1bmN0aW9uIChvYmosIHR5cGUsIGlkKSB7XG5cdFx0dmFyIHByZSA9ICdfbGVhZmxldF8nLFxuXHRcdCAgICBjYiA9IG9ialtwcmUgKyB0eXBlICsgaWRdO1xuXG5cdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0Y2FzZSAndG91Y2hzdGFydCc6XG5cdFx0XHRvYmoucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLlBPSU5URVJfRE9XTiwgY2IsIGZhbHNlKTtcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgJ3RvdWNobW92ZSc6XG5cdFx0XHRvYmoucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLlBPSU5URVJfTU9WRSwgY2IsIGZhbHNlKTtcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgJ3RvdWNoZW5kJzpcblx0XHRcdG9iai5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMuUE9JTlRFUl9VUCwgY2IsIGZhbHNlKTtcblx0XHRcdG9iai5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMuUE9JTlRFUl9DQU5DRUwsIGNiLCBmYWxzZSk7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxufSk7XG5cblxuLypcbiAqIEwuSGFuZGxlci5Ub3VjaFpvb20gaXMgdXNlZCBieSBMLk1hcCB0byBhZGQgcGluY2ggem9vbSBvbiBzdXBwb3J0ZWQgbW9iaWxlIGJyb3dzZXJzLlxuICovXG5cbkwuTWFwLm1lcmdlT3B0aW9ucyh7XG5cdHRvdWNoWm9vbTogTC5Ccm93c2VyLnRvdWNoICYmICFMLkJyb3dzZXIuYW5kcm9pZDIzLFxuXHRib3VuY2VBdFpvb21MaW1pdHM6IHRydWVcbn0pO1xuXG5MLk1hcC5Ub3VjaFpvb20gPSBMLkhhbmRsZXIuZXh0ZW5kKHtcblx0YWRkSG9va3M6IGZ1bmN0aW9uICgpIHtcblx0XHRMLkRvbUV2ZW50Lm9uKHRoaXMuX21hcC5fY29udGFpbmVyLCAndG91Y2hzdGFydCcsIHRoaXMuX29uVG91Y2hTdGFydCwgdGhpcyk7XG5cdH0sXG5cblx0cmVtb3ZlSG9va3M6IGZ1bmN0aW9uICgpIHtcblx0XHRMLkRvbUV2ZW50Lm9mZih0aGlzLl9tYXAuX2NvbnRhaW5lciwgJ3RvdWNoc3RhcnQnLCB0aGlzLl9vblRvdWNoU3RhcnQsIHRoaXMpO1xuXHR9LFxuXG5cdF9vblRvdWNoU3RhcnQ6IGZ1bmN0aW9uIChlKSB7XG5cdFx0dmFyIG1hcCA9IHRoaXMuX21hcDtcblxuXHRcdGlmICghZS50b3VjaGVzIHx8IGUudG91Y2hlcy5sZW5ndGggIT09IDIgfHwgbWFwLl9hbmltYXRpbmdab29tIHx8IHRoaXMuX3pvb21pbmcpIHsgcmV0dXJuOyB9XG5cblx0XHR2YXIgcDEgPSBtYXAubW91c2VFdmVudFRvTGF5ZXJQb2ludChlLnRvdWNoZXNbMF0pLFxuXHRcdCAgICBwMiA9IG1hcC5tb3VzZUV2ZW50VG9MYXllclBvaW50KGUudG91Y2hlc1sxXSksXG5cdFx0ICAgIHZpZXdDZW50ZXIgPSBtYXAuX2dldENlbnRlckxheWVyUG9pbnQoKTtcblxuXHRcdHRoaXMuX3N0YXJ0Q2VudGVyID0gcDEuYWRkKHAyKS5fZGl2aWRlQnkoMik7XG5cdFx0dGhpcy5fc3RhcnREaXN0ID0gcDEuZGlzdGFuY2VUbyhwMik7XG5cblx0XHR0aGlzLl9tb3ZlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX3pvb21pbmcgPSB0cnVlO1xuXG5cdFx0dGhpcy5fY2VudGVyT2Zmc2V0ID0gdmlld0NlbnRlci5zdWJ0cmFjdCh0aGlzLl9zdGFydENlbnRlcik7XG5cblx0XHRpZiAobWFwLl9wYW5BbmltKSB7XG5cdFx0XHRtYXAuX3BhbkFuaW0uc3RvcCgpO1xuXHRcdH1cblxuXHRcdEwuRG9tRXZlbnRcblx0XHQgICAgLm9uKGRvY3VtZW50LCAndG91Y2htb3ZlJywgdGhpcy5fb25Ub3VjaE1vdmUsIHRoaXMpXG5cdFx0ICAgIC5vbihkb2N1bWVudCwgJ3RvdWNoZW5kJywgdGhpcy5fb25Ub3VjaEVuZCwgdGhpcyk7XG5cblx0XHRMLkRvbUV2ZW50LnByZXZlbnREZWZhdWx0KGUpO1xuXHR9LFxuXG5cdF9vblRvdWNoTW92ZTogZnVuY3Rpb24gKGUpIHtcblx0XHR2YXIgbWFwID0gdGhpcy5fbWFwO1xuXG5cdFx0aWYgKCFlLnRvdWNoZXMgfHwgZS50b3VjaGVzLmxlbmd0aCAhPT0gMiB8fCAhdGhpcy5fem9vbWluZykgeyByZXR1cm47IH1cblxuXHRcdHZhciBwMSA9IG1hcC5tb3VzZUV2ZW50VG9MYXllclBvaW50KGUudG91Y2hlc1swXSksXG5cdFx0ICAgIHAyID0gbWFwLm1vdXNlRXZlbnRUb0xheWVyUG9pbnQoZS50b3VjaGVzWzFdKTtcblxuXHRcdHRoaXMuX3NjYWxlID0gcDEuZGlzdGFuY2VUbyhwMikgLyB0aGlzLl9zdGFydERpc3Q7XG5cdFx0dGhpcy5fZGVsdGEgPSBwMS5fYWRkKHAyKS5fZGl2aWRlQnkoMikuX3N1YnRyYWN0KHRoaXMuX3N0YXJ0Q2VudGVyKTtcblxuXHRcdGlmICh0aGlzLl9zY2FsZSA9PT0gMSkgeyByZXR1cm47IH1cblxuXHRcdGlmICghbWFwLm9wdGlvbnMuYm91bmNlQXRab29tTGltaXRzKSB7XG5cdFx0XHRpZiAoKG1hcC5nZXRab29tKCkgPT09IG1hcC5nZXRNaW5ab29tKCkgJiYgdGhpcy5fc2NhbGUgPCAxKSB8fFxuXHRcdFx0ICAgIChtYXAuZ2V0Wm9vbSgpID09PSBtYXAuZ2V0TWF4Wm9vbSgpICYmIHRoaXMuX3NjYWxlID4gMSkpIHsgcmV0dXJuOyB9XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9tb3ZlZCkge1xuXHRcdFx0TC5Eb21VdGlsLmFkZENsYXNzKG1hcC5fbWFwUGFuZSwgJ2xlYWZsZXQtdG91Y2hpbmcnKTtcblxuXHRcdFx0bWFwXG5cdFx0XHQgICAgLmZpcmUoJ21vdmVzdGFydCcpXG5cdFx0XHQgICAgLmZpcmUoJ3pvb21zdGFydCcpO1xuXG5cdFx0XHR0aGlzLl9tb3ZlZCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0TC5VdGlsLmNhbmNlbEFuaW1GcmFtZSh0aGlzLl9hbmltUmVxdWVzdCk7XG5cdFx0dGhpcy5fYW5pbVJlcXVlc3QgPSBMLlV0aWwucmVxdWVzdEFuaW1GcmFtZShcblx0XHQgICAgICAgIHRoaXMuX3VwZGF0ZU9uTW92ZSwgdGhpcywgdHJ1ZSwgdGhpcy5fbWFwLl9jb250YWluZXIpO1xuXG5cdFx0TC5Eb21FdmVudC5wcmV2ZW50RGVmYXVsdChlKTtcblx0fSxcblxuXHRfdXBkYXRlT25Nb3ZlOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIG1hcCA9IHRoaXMuX21hcCxcblx0XHQgICAgb3JpZ2luID0gdGhpcy5fZ2V0U2NhbGVPcmlnaW4oKSxcblx0XHQgICAgY2VudGVyID0gbWFwLmxheWVyUG9pbnRUb0xhdExuZyhvcmlnaW4pLFxuXHRcdCAgICB6b29tID0gbWFwLmdldFNjYWxlWm9vbSh0aGlzLl9zY2FsZSk7XG5cblx0XHRtYXAuX2FuaW1hdGVab29tKGNlbnRlciwgem9vbSwgdGhpcy5fc3RhcnRDZW50ZXIsIHRoaXMuX3NjYWxlLCB0aGlzLl9kZWx0YSwgZmFsc2UsIHRydWUpO1xuXHR9LFxuXG5cdF9vblRvdWNoRW5kOiBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCF0aGlzLl9tb3ZlZCB8fCAhdGhpcy5fem9vbWluZykge1xuXHRcdFx0dGhpcy5fem9vbWluZyA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXA7XG5cblx0XHR0aGlzLl96b29taW5nID0gZmFsc2U7XG5cdFx0TC5Eb21VdGlsLnJlbW92ZUNsYXNzKG1hcC5fbWFwUGFuZSwgJ2xlYWZsZXQtdG91Y2hpbmcnKTtcblx0XHRMLlV0aWwuY2FuY2VsQW5pbUZyYW1lKHRoaXMuX2FuaW1SZXF1ZXN0KTtcblxuXHRcdEwuRG9tRXZlbnRcblx0XHQgICAgLm9mZihkb2N1bWVudCwgJ3RvdWNobW92ZScsIHRoaXMuX29uVG91Y2hNb3ZlKVxuXHRcdCAgICAub2ZmKGRvY3VtZW50LCAndG91Y2hlbmQnLCB0aGlzLl9vblRvdWNoRW5kKTtcblxuXHRcdHZhciBvcmlnaW4gPSB0aGlzLl9nZXRTY2FsZU9yaWdpbigpLFxuXHRcdCAgICBjZW50ZXIgPSBtYXAubGF5ZXJQb2ludFRvTGF0TG5nKG9yaWdpbiksXG5cblx0XHQgICAgb2xkWm9vbSA9IG1hcC5nZXRab29tKCksXG5cdFx0ICAgIGZsb2F0Wm9vbURlbHRhID0gbWFwLmdldFNjYWxlWm9vbSh0aGlzLl9zY2FsZSkgLSBvbGRab29tLFxuXHRcdCAgICByb3VuZFpvb21EZWx0YSA9IChmbG9hdFpvb21EZWx0YSA+IDAgP1xuXHRcdCAgICAgICAgICAgIE1hdGguY2VpbChmbG9hdFpvb21EZWx0YSkgOiBNYXRoLmZsb29yKGZsb2F0Wm9vbURlbHRhKSksXG5cblx0XHQgICAgem9vbSA9IG1hcC5fbGltaXRab29tKG9sZFpvb20gKyByb3VuZFpvb21EZWx0YSksXG5cdFx0ICAgIHNjYWxlID0gbWFwLmdldFpvb21TY2FsZSh6b29tKSAvIHRoaXMuX3NjYWxlO1xuXG5cdFx0bWFwLl9hbmltYXRlWm9vbShjZW50ZXIsIHpvb20sIG9yaWdpbiwgc2NhbGUpO1xuXHR9LFxuXG5cdF9nZXRTY2FsZU9yaWdpbjogZnVuY3Rpb24gKCkge1xuXHRcdHZhciBjZW50ZXJPZmZzZXQgPSB0aGlzLl9jZW50ZXJPZmZzZXQuc3VidHJhY3QodGhpcy5fZGVsdGEpLmRpdmlkZUJ5KHRoaXMuX3NjYWxlKTtcblx0XHRyZXR1cm4gdGhpcy5fc3RhcnRDZW50ZXIuYWRkKGNlbnRlck9mZnNldCk7XG5cdH1cbn0pO1xuXG5MLk1hcC5hZGRJbml0SG9vaygnYWRkSGFuZGxlcicsICd0b3VjaFpvb20nLCBMLk1hcC5Ub3VjaFpvb20pO1xuXG5cbi8qXG4gKiBMLk1hcC5UYXAgaXMgdXNlZCB0byBlbmFibGUgbW9iaWxlIGhhY2tzIGxpa2UgcXVpY2sgdGFwcyBhbmQgbG9uZyBob2xkLlxuICovXG5cbkwuTWFwLm1lcmdlT3B0aW9ucyh7XG5cdHRhcDogdHJ1ZSxcblx0dGFwVG9sZXJhbmNlOiAxNVxufSk7XG5cbkwuTWFwLlRhcCA9IEwuSGFuZGxlci5leHRlbmQoe1xuXHRhZGRIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdEwuRG9tRXZlbnQub24odGhpcy5fbWFwLl9jb250YWluZXIsICd0b3VjaHN0YXJ0JywgdGhpcy5fb25Eb3duLCB0aGlzKTtcblx0fSxcblxuXHRyZW1vdmVIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdEwuRG9tRXZlbnQub2ZmKHRoaXMuX21hcC5fY29udGFpbmVyLCAndG91Y2hzdGFydCcsIHRoaXMuX29uRG93biwgdGhpcyk7XG5cdH0sXG5cblx0X29uRG93bjogZnVuY3Rpb24gKGUpIHtcblx0XHRpZiAoIWUudG91Y2hlcykgeyByZXR1cm47IH1cblxuXHRcdEwuRG9tRXZlbnQucHJldmVudERlZmF1bHQoZSk7XG5cblx0XHR0aGlzLl9maXJlQ2xpY2sgPSB0cnVlO1xuXG5cdFx0Ly8gZG9uJ3Qgc2ltdWxhdGUgY2xpY2sgb3IgdHJhY2sgbG9uZ3ByZXNzIGlmIG1vcmUgdGhhbiAxIHRvdWNoXG5cdFx0aWYgKGUudG91Y2hlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHR0aGlzLl9maXJlQ2xpY2sgPSBmYWxzZTtcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLl9ob2xkVGltZW91dCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dmFyIGZpcnN0ID0gZS50b3VjaGVzWzBdLFxuXHRcdCAgICBlbCA9IGZpcnN0LnRhcmdldDtcblxuXHRcdHRoaXMuX3N0YXJ0UG9zID0gdGhpcy5fbmV3UG9zID0gbmV3IEwuUG9pbnQoZmlyc3QuY2xpZW50WCwgZmlyc3QuY2xpZW50WSk7XG5cblx0XHQvLyBpZiB0b3VjaGluZyBhIGxpbmssIGhpZ2hsaWdodCBpdFxuXHRcdGlmIChlbC50YWdOYW1lICYmIGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2EnKSB7XG5cdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3MoZWwsICdsZWFmbGV0LWFjdGl2ZScpO1xuXHRcdH1cblxuXHRcdC8vIHNpbXVsYXRlIGxvbmcgaG9sZCBidXQgc2V0dGluZyBhIHRpbWVvdXRcblx0XHR0aGlzLl9ob2xkVGltZW91dCA9IHNldFRpbWVvdXQoTC5iaW5kKGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICh0aGlzLl9pc1RhcFZhbGlkKCkpIHtcblx0XHRcdFx0dGhpcy5fZmlyZUNsaWNrID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMuX29uVXAoKTtcblx0XHRcdFx0dGhpcy5fc2ltdWxhdGVFdmVudCgnY29udGV4dG1lbnUnLCBmaXJzdCk7XG5cdFx0XHR9XG5cdFx0fSwgdGhpcyksIDEwMDApO1xuXG5cdFx0TC5Eb21FdmVudFxuXHRcdFx0Lm9uKGRvY3VtZW50LCAndG91Y2htb3ZlJywgdGhpcy5fb25Nb3ZlLCB0aGlzKVxuXHRcdFx0Lm9uKGRvY3VtZW50LCAndG91Y2hlbmQnLCB0aGlzLl9vblVwLCB0aGlzKTtcblx0fSxcblxuXHRfb25VcDogZnVuY3Rpb24gKGUpIHtcblx0XHRjbGVhclRpbWVvdXQodGhpcy5faG9sZFRpbWVvdXQpO1xuXG5cdFx0TC5Eb21FdmVudFxuXHRcdFx0Lm9mZihkb2N1bWVudCwgJ3RvdWNobW92ZScsIHRoaXMuX29uTW92ZSwgdGhpcylcblx0XHRcdC5vZmYoZG9jdW1lbnQsICd0b3VjaGVuZCcsIHRoaXMuX29uVXAsIHRoaXMpO1xuXG5cdFx0aWYgKHRoaXMuX2ZpcmVDbGljayAmJiBlICYmIGUuY2hhbmdlZFRvdWNoZXMpIHtcblxuXHRcdFx0dmFyIGZpcnN0ID0gZS5jaGFuZ2VkVG91Y2hlc1swXSxcblx0XHRcdCAgICBlbCA9IGZpcnN0LnRhcmdldDtcblxuXHRcdFx0aWYgKGVsICYmIGVsLnRhZ05hbWUgJiYgZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnYScpIHtcblx0XHRcdFx0TC5Eb21VdGlsLnJlbW92ZUNsYXNzKGVsLCAnbGVhZmxldC1hY3RpdmUnKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gc2ltdWxhdGUgY2xpY2sgaWYgdGhlIHRvdWNoIGRpZG4ndCBtb3ZlIHRvbyBtdWNoXG5cdFx0XHRpZiAodGhpcy5faXNUYXBWYWxpZCgpKSB7XG5cdFx0XHRcdHRoaXMuX3NpbXVsYXRlRXZlbnQoJ2NsaWNrJywgZmlyc3QpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHRfaXNUYXBWYWxpZDogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0aGlzLl9uZXdQb3MuZGlzdGFuY2VUbyh0aGlzLl9zdGFydFBvcykgPD0gdGhpcy5fbWFwLm9wdGlvbnMudGFwVG9sZXJhbmNlO1xuXHR9LFxuXG5cdF9vbk1vdmU6IGZ1bmN0aW9uIChlKSB7XG5cdFx0dmFyIGZpcnN0ID0gZS50b3VjaGVzWzBdO1xuXHRcdHRoaXMuX25ld1BvcyA9IG5ldyBMLlBvaW50KGZpcnN0LmNsaWVudFgsIGZpcnN0LmNsaWVudFkpO1xuXHR9LFxuXG5cdF9zaW11bGF0ZUV2ZW50OiBmdW5jdGlvbiAodHlwZSwgZSkge1xuXHRcdHZhciBzaW11bGF0ZWRFdmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdNb3VzZUV2ZW50cycpO1xuXG5cdFx0c2ltdWxhdGVkRXZlbnQuX3NpbXVsYXRlZCA9IHRydWU7XG5cdFx0ZS50YXJnZXQuX3NpbXVsYXRlZENsaWNrID0gdHJ1ZTtcblxuXHRcdHNpbXVsYXRlZEV2ZW50LmluaXRNb3VzZUV2ZW50KFxuXHRcdCAgICAgICAgdHlwZSwgdHJ1ZSwgdHJ1ZSwgd2luZG93LCAxLFxuXHRcdCAgICAgICAgZS5zY3JlZW5YLCBlLnNjcmVlblksXG5cdFx0ICAgICAgICBlLmNsaWVudFgsIGUuY2xpZW50WSxcblx0XHQgICAgICAgIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCAwLCBudWxsKTtcblxuXHRcdGUudGFyZ2V0LmRpc3BhdGNoRXZlbnQoc2ltdWxhdGVkRXZlbnQpO1xuXHR9XG59KTtcblxuaWYgKEwuQnJvd3Nlci50b3VjaCAmJiAhTC5Ccm93c2VyLnBvaW50ZXIpIHtcblx0TC5NYXAuYWRkSW5pdEhvb2soJ2FkZEhhbmRsZXInLCAndGFwJywgTC5NYXAuVGFwKTtcbn1cblxuXG4vKlxuICogTC5IYW5kbGVyLlNoaWZ0RHJhZ1pvb20gaXMgdXNlZCB0byBhZGQgc2hpZnQtZHJhZyB6b29tIGludGVyYWN0aW9uIHRvIHRoZSBtYXBcbiAgKiAoem9vbSB0byBhIHNlbGVjdGVkIGJvdW5kaW5nIGJveCksIGVuYWJsZWQgYnkgZGVmYXVsdC5cbiAqL1xuXG5MLk1hcC5tZXJnZU9wdGlvbnMoe1xuXHRib3hab29tOiB0cnVlXG59KTtcblxuTC5NYXAuQm94Wm9vbSA9IEwuSGFuZGxlci5leHRlbmQoe1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAobWFwKSB7XG5cdFx0dGhpcy5fbWFwID0gbWFwO1xuXHRcdHRoaXMuX2NvbnRhaW5lciA9IG1hcC5fY29udGFpbmVyO1xuXHRcdHRoaXMuX3BhbmUgPSBtYXAuX3BhbmVzLm92ZXJsYXlQYW5lO1xuXHRcdHRoaXMuX21vdmVkID0gZmFsc2U7XG5cdH0sXG5cblx0YWRkSG9va3M6IGZ1bmN0aW9uICgpIHtcblx0XHRMLkRvbUV2ZW50Lm9uKHRoaXMuX2NvbnRhaW5lciwgJ21vdXNlZG93bicsIHRoaXMuX29uTW91c2VEb3duLCB0aGlzKTtcblx0fSxcblxuXHRyZW1vdmVIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdEwuRG9tRXZlbnQub2ZmKHRoaXMuX2NvbnRhaW5lciwgJ21vdXNlZG93bicsIHRoaXMuX29uTW91c2VEb3duKTtcblx0XHR0aGlzLl9tb3ZlZCA9IGZhbHNlO1xuXHR9LFxuXG5cdG1vdmVkOiBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21vdmVkO1xuXHR9LFxuXG5cdF9vbk1vdXNlRG93bjogZnVuY3Rpb24gKGUpIHtcblx0XHR0aGlzLl9tb3ZlZCA9IGZhbHNlO1xuXG5cdFx0aWYgKCFlLnNoaWZ0S2V5IHx8ICgoZS53aGljaCAhPT0gMSkgJiYgKGUuYnV0dG9uICE9PSAxKSkpIHsgcmV0dXJuIGZhbHNlOyB9XG5cblx0XHRMLkRvbVV0aWwuZGlzYWJsZVRleHRTZWxlY3Rpb24oKTtcblx0XHRMLkRvbVV0aWwuZGlzYWJsZUltYWdlRHJhZygpO1xuXG5cdFx0dGhpcy5fc3RhcnRMYXllclBvaW50ID0gdGhpcy5fbWFwLm1vdXNlRXZlbnRUb0xheWVyUG9pbnQoZSk7XG5cblx0XHRMLkRvbUV2ZW50XG5cdFx0ICAgIC5vbihkb2N1bWVudCwgJ21vdXNlbW92ZScsIHRoaXMuX29uTW91c2VNb3ZlLCB0aGlzKVxuXHRcdCAgICAub24oZG9jdW1lbnQsICdtb3VzZXVwJywgdGhpcy5fb25Nb3VzZVVwLCB0aGlzKVxuXHRcdCAgICAub24oZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5fb25LZXlEb3duLCB0aGlzKTtcblx0fSxcblxuXHRfb25Nb3VzZU1vdmU6IGZ1bmN0aW9uIChlKSB7XG5cdFx0aWYgKCF0aGlzLl9tb3ZlZCkge1xuXHRcdFx0dGhpcy5fYm94ID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJ2xlYWZsZXQtem9vbS1ib3gnLCB0aGlzLl9wYW5lKTtcblx0XHRcdEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9ib3gsIHRoaXMuX3N0YXJ0TGF5ZXJQb2ludCk7XG5cblx0XHRcdC8vVE9ETyByZWZhY3RvcjogbW92ZSBjdXJzb3IgdG8gc3R5bGVzXG5cdFx0XHR0aGlzLl9jb250YWluZXIuc3R5bGUuY3Vyc29yID0gJ2Nyb3NzaGFpcic7XG5cdFx0XHR0aGlzLl9tYXAuZmlyZSgnYm94em9vbXN0YXJ0Jyk7XG5cdFx0fVxuXG5cdFx0dmFyIHN0YXJ0UG9pbnQgPSB0aGlzLl9zdGFydExheWVyUG9pbnQsXG5cdFx0ICAgIGJveCA9IHRoaXMuX2JveCxcblxuXHRcdCAgICBsYXllclBvaW50ID0gdGhpcy5fbWFwLm1vdXNlRXZlbnRUb0xheWVyUG9pbnQoZSksXG5cdFx0ICAgIG9mZnNldCA9IGxheWVyUG9pbnQuc3VidHJhY3Qoc3RhcnRQb2ludCksXG5cblx0XHQgICAgbmV3UG9zID0gbmV3IEwuUG9pbnQoXG5cdFx0ICAgICAgICBNYXRoLm1pbihsYXllclBvaW50LngsIHN0YXJ0UG9pbnQueCksXG5cdFx0ICAgICAgICBNYXRoLm1pbihsYXllclBvaW50LnksIHN0YXJ0UG9pbnQueSkpO1xuXG5cdFx0TC5Eb21VdGlsLnNldFBvc2l0aW9uKGJveCwgbmV3UG9zKTtcblxuXHRcdHRoaXMuX21vdmVkID0gdHJ1ZTtcblxuXHRcdC8vIFRPRE8gcmVmYWN0b3I6IHJlbW92ZSBoYXJkY29kZWQgNCBwaXhlbHNcblx0XHRib3guc3R5bGUud2lkdGggID0gKE1hdGgubWF4KDAsIE1hdGguYWJzKG9mZnNldC54KSAtIDQpKSArICdweCc7XG5cdFx0Ym94LnN0eWxlLmhlaWdodCA9IChNYXRoLm1heCgwLCBNYXRoLmFicyhvZmZzZXQueSkgLSA0KSkgKyAncHgnO1xuXHR9LFxuXG5cdF9maW5pc2g6IGZ1bmN0aW9uICgpIHtcblx0XHRpZiAodGhpcy5fbW92ZWQpIHtcblx0XHRcdHRoaXMuX3BhbmUucmVtb3ZlQ2hpbGQodGhpcy5fYm94KTtcblx0XHRcdHRoaXMuX2NvbnRhaW5lci5zdHlsZS5jdXJzb3IgPSAnJztcblx0XHR9XG5cblx0XHRMLkRvbVV0aWwuZW5hYmxlVGV4dFNlbGVjdGlvbigpO1xuXHRcdEwuRG9tVXRpbC5lbmFibGVJbWFnZURyYWcoKTtcblxuXHRcdEwuRG9tRXZlbnRcblx0XHQgICAgLm9mZihkb2N1bWVudCwgJ21vdXNlbW92ZScsIHRoaXMuX29uTW91c2VNb3ZlKVxuXHRcdCAgICAub2ZmKGRvY3VtZW50LCAnbW91c2V1cCcsIHRoaXMuX29uTW91c2VVcClcblx0XHQgICAgLm9mZihkb2N1bWVudCwgJ2tleWRvd24nLCB0aGlzLl9vbktleURvd24pO1xuXHR9LFxuXG5cdF9vbk1vdXNlVXA6IGZ1bmN0aW9uIChlKSB7XG5cblx0XHR0aGlzLl9maW5pc2goKTtcblxuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXAsXG5cdFx0ICAgIGxheWVyUG9pbnQgPSBtYXAubW91c2VFdmVudFRvTGF5ZXJQb2ludChlKTtcblxuXHRcdGlmICh0aGlzLl9zdGFydExheWVyUG9pbnQuZXF1YWxzKGxheWVyUG9pbnQpKSB7IHJldHVybjsgfVxuXG5cdFx0dmFyIGJvdW5kcyA9IG5ldyBMLkxhdExuZ0JvdW5kcyhcblx0XHQgICAgICAgIG1hcC5sYXllclBvaW50VG9MYXRMbmcodGhpcy5fc3RhcnRMYXllclBvaW50KSxcblx0XHQgICAgICAgIG1hcC5sYXllclBvaW50VG9MYXRMbmcobGF5ZXJQb2ludCkpO1xuXG5cdFx0bWFwLmZpdEJvdW5kcyhib3VuZHMpO1xuXG5cdFx0bWFwLmZpcmUoJ2JveHpvb21lbmQnLCB7XG5cdFx0XHRib3hab29tQm91bmRzOiBib3VuZHNcblx0XHR9KTtcblx0fSxcblxuXHRfb25LZXlEb3duOiBmdW5jdGlvbiAoZSkge1xuXHRcdGlmIChlLmtleUNvZGUgPT09IDI3KSB7XG5cdFx0XHR0aGlzLl9maW5pc2goKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5MLk1hcC5hZGRJbml0SG9vaygnYWRkSGFuZGxlcicsICdib3hab29tJywgTC5NYXAuQm94Wm9vbSk7XG5cblxuLypcbiAqIEwuTWFwLktleWJvYXJkIGlzIGhhbmRsaW5nIGtleWJvYXJkIGludGVyYWN0aW9uIHdpdGggdGhlIG1hcCwgZW5hYmxlZCBieSBkZWZhdWx0LlxuICovXG5cbkwuTWFwLm1lcmdlT3B0aW9ucyh7XG5cdGtleWJvYXJkOiB0cnVlLFxuXHRrZXlib2FyZFBhbk9mZnNldDogODAsXG5cdGtleWJvYXJkWm9vbU9mZnNldDogMVxufSk7XG5cbkwuTWFwLktleWJvYXJkID0gTC5IYW5kbGVyLmV4dGVuZCh7XG5cblx0a2V5Q29kZXM6IHtcblx0XHRsZWZ0OiAgICBbMzddLFxuXHRcdHJpZ2h0OiAgIFszOV0sXG5cdFx0ZG93bjogICAgWzQwXSxcblx0XHR1cDogICAgICBbMzhdLFxuXHRcdHpvb21JbjogIFsxODcsIDEwNywgNjEsIDE3MV0sXG5cdFx0em9vbU91dDogWzE4OSwgMTA5LCAxNzNdXG5cdH0sXG5cblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKG1hcCkge1xuXHRcdHRoaXMuX21hcCA9IG1hcDtcblxuXHRcdHRoaXMuX3NldFBhbk9mZnNldChtYXAub3B0aW9ucy5rZXlib2FyZFBhbk9mZnNldCk7XG5cdFx0dGhpcy5fc2V0Wm9vbU9mZnNldChtYXAub3B0aW9ucy5rZXlib2FyZFpvb21PZmZzZXQpO1xuXHR9LFxuXG5cdGFkZEhvb2tzOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGNvbnRhaW5lciA9IHRoaXMuX21hcC5fY29udGFpbmVyO1xuXG5cdFx0Ly8gbWFrZSB0aGUgY29udGFpbmVyIGZvY3VzYWJsZSBieSB0YWJiaW5nXG5cdFx0aWYgKGNvbnRhaW5lci50YWJJbmRleCA9PT0gLTEpIHtcblx0XHRcdGNvbnRhaW5lci50YWJJbmRleCA9ICcwJztcblx0XHR9XG5cblx0XHRMLkRvbUV2ZW50XG5cdFx0ICAgIC5vbihjb250YWluZXIsICdmb2N1cycsIHRoaXMuX29uRm9jdXMsIHRoaXMpXG5cdFx0ICAgIC5vbihjb250YWluZXIsICdibHVyJywgdGhpcy5fb25CbHVyLCB0aGlzKVxuXHRcdCAgICAub24oY29udGFpbmVyLCAnbW91c2Vkb3duJywgdGhpcy5fb25Nb3VzZURvd24sIHRoaXMpO1xuXG5cdFx0dGhpcy5fbWFwXG5cdFx0ICAgIC5vbignZm9jdXMnLCB0aGlzLl9hZGRIb29rcywgdGhpcylcblx0XHQgICAgLm9uKCdibHVyJywgdGhpcy5fcmVtb3ZlSG9va3MsIHRoaXMpO1xuXHR9LFxuXG5cdHJlbW92ZUhvb2tzOiBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy5fcmVtb3ZlSG9va3MoKTtcblxuXHRcdHZhciBjb250YWluZXIgPSB0aGlzLl9tYXAuX2NvbnRhaW5lcjtcblxuXHRcdEwuRG9tRXZlbnRcblx0XHQgICAgLm9mZihjb250YWluZXIsICdmb2N1cycsIHRoaXMuX29uRm9jdXMsIHRoaXMpXG5cdFx0ICAgIC5vZmYoY29udGFpbmVyLCAnYmx1cicsIHRoaXMuX29uQmx1ciwgdGhpcylcblx0XHQgICAgLm9mZihjb250YWluZXIsICdtb3VzZWRvd24nLCB0aGlzLl9vbk1vdXNlRG93biwgdGhpcyk7XG5cblx0XHR0aGlzLl9tYXBcblx0XHQgICAgLm9mZignZm9jdXMnLCB0aGlzLl9hZGRIb29rcywgdGhpcylcblx0XHQgICAgLm9mZignYmx1cicsIHRoaXMuX3JlbW92ZUhvb2tzLCB0aGlzKTtcblx0fSxcblxuXHRfb25Nb3VzZURvd246IGZ1bmN0aW9uICgpIHtcblx0XHRpZiAodGhpcy5fZm9jdXNlZCkgeyByZXR1cm47IH1cblxuXHRcdHZhciBib2R5ID0gZG9jdW1lbnQuYm9keSxcblx0XHQgICAgZG9jRWwgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsXG5cdFx0ICAgIHRvcCA9IGJvZHkuc2Nyb2xsVG9wIHx8IGRvY0VsLnNjcm9sbFRvcCxcblx0XHQgICAgbGVmdCA9IGJvZHkuc2Nyb2xsTGVmdCB8fCBkb2NFbC5zY3JvbGxMZWZ0O1xuXG5cdFx0dGhpcy5fbWFwLl9jb250YWluZXIuZm9jdXMoKTtcblxuXHRcdHdpbmRvdy5zY3JvbGxUbyhsZWZ0LCB0b3ApO1xuXHR9LFxuXG5cdF9vbkZvY3VzOiBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy5fZm9jdXNlZCA9IHRydWU7XG5cdFx0dGhpcy5fbWFwLmZpcmUoJ2ZvY3VzJyk7XG5cdH0sXG5cblx0X29uQmx1cjogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMuX2ZvY3VzZWQgPSBmYWxzZTtcblx0XHR0aGlzLl9tYXAuZmlyZSgnYmx1cicpO1xuXHR9LFxuXG5cdF9zZXRQYW5PZmZzZXQ6IGZ1bmN0aW9uIChwYW4pIHtcblx0XHR2YXIga2V5cyA9IHRoaXMuX3BhbktleXMgPSB7fSxcblx0XHQgICAgY29kZXMgPSB0aGlzLmtleUNvZGVzLFxuXHRcdCAgICBpLCBsZW47XG5cblx0XHRmb3IgKGkgPSAwLCBsZW4gPSBjb2Rlcy5sZWZ0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRrZXlzW2NvZGVzLmxlZnRbaV1dID0gWy0xICogcGFuLCAwXTtcblx0XHR9XG5cdFx0Zm9yIChpID0gMCwgbGVuID0gY29kZXMucmlnaHQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGtleXNbY29kZXMucmlnaHRbaV1dID0gW3BhbiwgMF07XG5cdFx0fVxuXHRcdGZvciAoaSA9IDAsIGxlbiA9IGNvZGVzLmRvd24ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGtleXNbY29kZXMuZG93bltpXV0gPSBbMCwgcGFuXTtcblx0XHR9XG5cdFx0Zm9yIChpID0gMCwgbGVuID0gY29kZXMudXAubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGtleXNbY29kZXMudXBbaV1dID0gWzAsIC0xICogcGFuXTtcblx0XHR9XG5cdH0sXG5cblx0X3NldFpvb21PZmZzZXQ6IGZ1bmN0aW9uICh6b29tKSB7XG5cdFx0dmFyIGtleXMgPSB0aGlzLl96b29tS2V5cyA9IHt9LFxuXHRcdCAgICBjb2RlcyA9IHRoaXMua2V5Q29kZXMsXG5cdFx0ICAgIGksIGxlbjtcblxuXHRcdGZvciAoaSA9IDAsIGxlbiA9IGNvZGVzLnpvb21Jbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0a2V5c1tjb2Rlcy56b29tSW5baV1dID0gem9vbTtcblx0XHR9XG5cdFx0Zm9yIChpID0gMCwgbGVuID0gY29kZXMuem9vbU91dC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0a2V5c1tjb2Rlcy56b29tT3V0W2ldXSA9IC16b29tO1xuXHRcdH1cblx0fSxcblxuXHRfYWRkSG9va3M6IGZ1bmN0aW9uICgpIHtcblx0XHRMLkRvbUV2ZW50Lm9uKGRvY3VtZW50LCAna2V5ZG93bicsIHRoaXMuX29uS2V5RG93biwgdGhpcyk7XG5cdH0sXG5cblx0X3JlbW92ZUhvb2tzOiBmdW5jdGlvbiAoKSB7XG5cdFx0TC5Eb21FdmVudC5vZmYoZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5fb25LZXlEb3duLCB0aGlzKTtcblx0fSxcblxuXHRfb25LZXlEb3duOiBmdW5jdGlvbiAoZSkge1xuXHRcdHZhciBrZXkgPSBlLmtleUNvZGUsXG5cdFx0ICAgIG1hcCA9IHRoaXMuX21hcDtcblxuXHRcdGlmIChrZXkgaW4gdGhpcy5fcGFuS2V5cykge1xuXG5cdFx0XHRpZiAobWFwLl9wYW5BbmltICYmIG1hcC5fcGFuQW5pbS5faW5Qcm9ncmVzcykgeyByZXR1cm47IH1cblxuXHRcdFx0bWFwLnBhbkJ5KHRoaXMuX3BhbktleXNba2V5XSk7XG5cblx0XHRcdGlmIChtYXAub3B0aW9ucy5tYXhCb3VuZHMpIHtcblx0XHRcdFx0bWFwLnBhbkluc2lkZUJvdW5kcyhtYXAub3B0aW9ucy5tYXhCb3VuZHMpO1xuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIGlmIChrZXkgaW4gdGhpcy5fem9vbUtleXMpIHtcblx0XHRcdG1hcC5zZXRab29tKG1hcC5nZXRab29tKCkgKyB0aGlzLl96b29tS2V5c1trZXldKTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0TC5Eb21FdmVudC5zdG9wKGUpO1xuXHR9XG59KTtcblxuTC5NYXAuYWRkSW5pdEhvb2soJ2FkZEhhbmRsZXInLCAna2V5Ym9hcmQnLCBMLk1hcC5LZXlib2FyZCk7XG5cblxuLypcbiAqIEwuSGFuZGxlci5NYXJrZXJEcmFnIGlzIHVzZWQgaW50ZXJuYWxseSBieSBMLk1hcmtlciB0byBtYWtlIHRoZSBtYXJrZXJzIGRyYWdnYWJsZS5cbiAqL1xuXG5MLkhhbmRsZXIuTWFya2VyRHJhZyA9IEwuSGFuZGxlci5leHRlbmQoe1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAobWFya2VyKSB7XG5cdFx0dGhpcy5fbWFya2VyID0gbWFya2VyO1xuXHR9LFxuXG5cdGFkZEhvb2tzOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGljb24gPSB0aGlzLl9tYXJrZXIuX2ljb247XG5cdFx0aWYgKCF0aGlzLl9kcmFnZ2FibGUpIHtcblx0XHRcdHRoaXMuX2RyYWdnYWJsZSA9IG5ldyBMLkRyYWdnYWJsZShpY29uLCBpY29uKTtcblx0XHR9XG5cblx0XHR0aGlzLl9kcmFnZ2FibGVcblx0XHRcdC5vbignZHJhZ3N0YXJ0JywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpXG5cdFx0XHQub24oJ2RyYWcnLCB0aGlzLl9vbkRyYWcsIHRoaXMpXG5cdFx0XHQub24oJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXHRcdHRoaXMuX2RyYWdnYWJsZS5lbmFibGUoKTtcblx0XHRMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fbWFya2VyLl9pY29uLCAnbGVhZmxldC1tYXJrZXItZHJhZ2dhYmxlJyk7XG5cdH0sXG5cblx0cmVtb3ZlSG9va3M6IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLl9kcmFnZ2FibGVcblx0XHRcdC5vZmYoJ2RyYWdzdGFydCcsIHRoaXMuX29uRHJhZ1N0YXJ0LCB0aGlzKVxuXHRcdFx0Lm9mZignZHJhZycsIHRoaXMuX29uRHJhZywgdGhpcylcblx0XHRcdC5vZmYoJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG5cdFx0dGhpcy5fZHJhZ2dhYmxlLmRpc2FibGUoKTtcblx0XHRMLkRvbVV0aWwucmVtb3ZlQ2xhc3ModGhpcy5fbWFya2VyLl9pY29uLCAnbGVhZmxldC1tYXJrZXItZHJhZ2dhYmxlJyk7XG5cdH0sXG5cblx0bW92ZWQ6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZHJhZ2dhYmxlICYmIHRoaXMuX2RyYWdnYWJsZS5fbW92ZWQ7XG5cdH0sXG5cblx0X29uRHJhZ1N0YXJ0OiBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy5fbWFya2VyXG5cdFx0ICAgIC5jbG9zZVBvcHVwKClcblx0XHQgICAgLmZpcmUoJ21vdmVzdGFydCcpXG5cdFx0ICAgIC5maXJlKCdkcmFnc3RhcnQnKTtcblx0fSxcblxuXHRfb25EcmFnOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIG1hcmtlciA9IHRoaXMuX21hcmtlcixcblx0XHQgICAgc2hhZG93ID0gbWFya2VyLl9zaGFkb3csXG5cdFx0ICAgIGljb25Qb3MgPSBMLkRvbVV0aWwuZ2V0UG9zaXRpb24obWFya2VyLl9pY29uKSxcblx0XHQgICAgbGF0bG5nID0gbWFya2VyLl9tYXAubGF5ZXJQb2ludFRvTGF0TG5nKGljb25Qb3MpO1xuXG5cdFx0Ly8gdXBkYXRlIHNoYWRvdyBwb3NpdGlvblxuXHRcdGlmIChzaGFkb3cpIHtcblx0XHRcdEwuRG9tVXRpbC5zZXRQb3NpdGlvbihzaGFkb3csIGljb25Qb3MpO1xuXHRcdH1cblxuXHRcdG1hcmtlci5fbGF0bG5nID0gbGF0bG5nO1xuXG5cdFx0bWFya2VyXG5cdFx0ICAgIC5maXJlKCdtb3ZlJywge2xhdGxuZzogbGF0bG5nfSlcblx0XHQgICAgLmZpcmUoJ2RyYWcnKTtcblx0fSxcblxuXHRfb25EcmFnRW5kOiBmdW5jdGlvbiAoZSkge1xuXHRcdHRoaXMuX21hcmtlclxuXHRcdCAgICAuZmlyZSgnbW92ZWVuZCcpXG5cdFx0ICAgIC5maXJlKCdkcmFnZW5kJywgZSk7XG5cdH1cbn0pO1xuXG5cbi8qXHJcbiAqIEwuQ29udHJvbCBpcyBhIGJhc2UgY2xhc3MgZm9yIGltcGxlbWVudGluZyBtYXAgY29udHJvbHMuIEhhbmRsZXMgcG9zaXRpb25pbmcuXHJcbiAqIEFsbCBvdGhlciBjb250cm9scyBleHRlbmQgZnJvbSB0aGlzIGNsYXNzLlxyXG4gKi9cclxuXHJcbkwuQ29udHJvbCA9IEwuQ2xhc3MuZXh0ZW5kKHtcclxuXHRvcHRpb25zOiB7XHJcblx0XHRwb3NpdGlvbjogJ3RvcHJpZ2h0J1xyXG5cdH0sXHJcblxyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcblx0XHRMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblx0fSxcclxuXHJcblx0Z2V0UG9zaXRpb246IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiB0aGlzLm9wdGlvbnMucG9zaXRpb247XHJcblx0fSxcclxuXHJcblx0c2V0UG9zaXRpb246IGZ1bmN0aW9uIChwb3NpdGlvbikge1xyXG5cdFx0dmFyIG1hcCA9IHRoaXMuX21hcDtcclxuXHJcblx0XHRpZiAobWFwKSB7XHJcblx0XHRcdG1hcC5yZW1vdmVDb250cm9sKHRoaXMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMub3B0aW9ucy5wb3NpdGlvbiA9IHBvc2l0aW9uO1xyXG5cclxuXHRcdGlmIChtYXApIHtcclxuXHRcdFx0bWFwLmFkZENvbnRyb2wodGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0Z2V0Q29udGFpbmVyOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fY29udGFpbmVyO1xyXG5cdH0sXHJcblxyXG5cdGFkZFRvOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHR0aGlzLl9tYXAgPSBtYXA7XHJcblxyXG5cdFx0dmFyIGNvbnRhaW5lciA9IHRoaXMuX2NvbnRhaW5lciA9IHRoaXMub25BZGQobWFwKSxcclxuXHRcdCAgICBwb3MgPSB0aGlzLmdldFBvc2l0aW9uKCksXHJcblx0XHQgICAgY29ybmVyID0gbWFwLl9jb250cm9sQ29ybmVyc1twb3NdO1xyXG5cclxuXHRcdEwuRG9tVXRpbC5hZGRDbGFzcyhjb250YWluZXIsICdsZWFmbGV0LWNvbnRyb2wnKTtcclxuXHJcblx0XHRpZiAocG9zLmluZGV4T2YoJ2JvdHRvbScpICE9PSAtMSkge1xyXG5cdFx0XHRjb3JuZXIuaW5zZXJ0QmVmb3JlKGNvbnRhaW5lciwgY29ybmVyLmZpcnN0Q2hpbGQpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Y29ybmVyLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0cmVtb3ZlRnJvbTogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0dmFyIHBvcyA9IHRoaXMuZ2V0UG9zaXRpb24oKSxcclxuXHRcdCAgICBjb3JuZXIgPSBtYXAuX2NvbnRyb2xDb3JuZXJzW3Bvc107XHJcblxyXG5cdFx0Y29ybmVyLnJlbW92ZUNoaWxkKHRoaXMuX2NvbnRhaW5lcik7XHJcblx0XHR0aGlzLl9tYXAgPSBudWxsO1xyXG5cclxuXHRcdGlmICh0aGlzLm9uUmVtb3ZlKSB7XHJcblx0XHRcdHRoaXMub25SZW1vdmUobWFwKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRfcmVmb2N1c09uTWFwOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAodGhpcy5fbWFwKSB7XHJcblx0XHRcdHRoaXMuX21hcC5nZXRDb250YWluZXIoKS5mb2N1cygpO1xyXG5cdFx0fVxyXG5cdH1cclxufSk7XHJcblxyXG5MLmNvbnRyb2wgPSBmdW5jdGlvbiAob3B0aW9ucykge1xyXG5cdHJldHVybiBuZXcgTC5Db250cm9sKG9wdGlvbnMpO1xyXG59O1xyXG5cclxuXHJcbi8vIGFkZHMgY29udHJvbC1yZWxhdGVkIG1ldGhvZHMgdG8gTC5NYXBcclxuXHJcbkwuTWFwLmluY2x1ZGUoe1xyXG5cdGFkZENvbnRyb2w6IGZ1bmN0aW9uIChjb250cm9sKSB7XHJcblx0XHRjb250cm9sLmFkZFRvKHRoaXMpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0cmVtb3ZlQ29udHJvbDogZnVuY3Rpb24gKGNvbnRyb2wpIHtcclxuXHRcdGNvbnRyb2wucmVtb3ZlRnJvbSh0aGlzKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdF9pbml0Q29udHJvbFBvczogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIGNvcm5lcnMgPSB0aGlzLl9jb250cm9sQ29ybmVycyA9IHt9LFxyXG5cdFx0ICAgIGwgPSAnbGVhZmxldC0nLFxyXG5cdFx0ICAgIGNvbnRhaW5lciA9IHRoaXMuX2NvbnRyb2xDb250YWluZXIgPVxyXG5cdFx0ICAgICAgICAgICAgTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgbCArICdjb250cm9sLWNvbnRhaW5lcicsIHRoaXMuX2NvbnRhaW5lcik7XHJcblxyXG5cdFx0ZnVuY3Rpb24gY3JlYXRlQ29ybmVyKHZTaWRlLCBoU2lkZSkge1xyXG5cdFx0XHR2YXIgY2xhc3NOYW1lID0gbCArIHZTaWRlICsgJyAnICsgbCArIGhTaWRlO1xyXG5cclxuXHRcdFx0Y29ybmVyc1t2U2lkZSArIGhTaWRlXSA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsIGNsYXNzTmFtZSwgY29udGFpbmVyKTtcclxuXHRcdH1cclxuXHJcblx0XHRjcmVhdGVDb3JuZXIoJ3RvcCcsICdsZWZ0Jyk7XHJcblx0XHRjcmVhdGVDb3JuZXIoJ3RvcCcsICdyaWdodCcpO1xyXG5cdFx0Y3JlYXRlQ29ybmVyKCdib3R0b20nLCAnbGVmdCcpO1xyXG5cdFx0Y3JlYXRlQ29ybmVyKCdib3R0b20nLCAncmlnaHQnKTtcclxuXHR9LFxyXG5cclxuXHRfY2xlYXJDb250cm9sUG9zOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR0aGlzLl9jb250YWluZXIucmVtb3ZlQ2hpbGQodGhpcy5fY29udHJvbENvbnRhaW5lcik7XHJcblx0fVxyXG59KTtcclxuXG5cbi8qXHJcbiAqIEwuQ29udHJvbC5ab29tIGlzIHVzZWQgZm9yIHRoZSBkZWZhdWx0IHpvb20gYnV0dG9ucyBvbiB0aGUgbWFwLlxyXG4gKi9cclxuXHJcbkwuQ29udHJvbC5ab29tID0gTC5Db250cm9sLmV4dGVuZCh7XHJcblx0b3B0aW9uczoge1xyXG5cdFx0cG9zaXRpb246ICd0b3BsZWZ0JyxcclxuXHRcdHpvb21JblRleHQ6ICcrJyxcclxuXHRcdHpvb21JblRpdGxlOiAnWm9vbSBpbicsXHJcblx0XHR6b29tT3V0VGV4dDogJy0nLFxyXG5cdFx0em9vbU91dFRpdGxlOiAnWm9vbSBvdXQnXHJcblx0fSxcclxuXHJcblx0b25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcclxuXHRcdHZhciB6b29tTmFtZSA9ICdsZWFmbGV0LWNvbnRyb2wtem9vbScsXHJcblx0XHQgICAgY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2Jywgem9vbU5hbWUgKyAnIGxlYWZsZXQtYmFyJyk7XHJcblxyXG5cdFx0dGhpcy5fbWFwID0gbWFwO1xyXG5cclxuXHRcdHRoaXMuX3pvb21JbkJ1dHRvbiAgPSB0aGlzLl9jcmVhdGVCdXR0b24oXHJcblx0XHQgICAgICAgIHRoaXMub3B0aW9ucy56b29tSW5UZXh0LCB0aGlzLm9wdGlvbnMuem9vbUluVGl0bGUsXHJcblx0XHQgICAgICAgIHpvb21OYW1lICsgJy1pbicsICBjb250YWluZXIsIHRoaXMuX3pvb21JbiwgIHRoaXMpO1xyXG5cdFx0dGhpcy5fem9vbU91dEJ1dHRvbiA9IHRoaXMuX2NyZWF0ZUJ1dHRvbihcclxuXHRcdCAgICAgICAgdGhpcy5vcHRpb25zLnpvb21PdXRUZXh0LCB0aGlzLm9wdGlvbnMuem9vbU91dFRpdGxlLFxyXG5cdFx0ICAgICAgICB6b29tTmFtZSArICctb3V0JywgY29udGFpbmVyLCB0aGlzLl96b29tT3V0LCB0aGlzKTtcclxuXHJcblx0XHR0aGlzLl91cGRhdGVEaXNhYmxlZCgpO1xyXG5cdFx0bWFwLm9uKCd6b29tZW5kIHpvb21sZXZlbHNjaGFuZ2UnLCB0aGlzLl91cGRhdGVEaXNhYmxlZCwgdGhpcyk7XHJcblxyXG5cdFx0cmV0dXJuIGNvbnRhaW5lcjtcclxuXHR9LFxyXG5cclxuXHRvblJlbW92ZTogZnVuY3Rpb24gKG1hcCkge1xyXG5cdFx0bWFwLm9mZignem9vbWVuZCB6b29tbGV2ZWxzY2hhbmdlJywgdGhpcy5fdXBkYXRlRGlzYWJsZWQsIHRoaXMpO1xyXG5cdH0sXHJcblxyXG5cdF96b29tSW46IGZ1bmN0aW9uIChlKSB7XHJcblx0XHR0aGlzLl9tYXAuem9vbUluKGUuc2hpZnRLZXkgPyAzIDogMSk7XHJcblx0fSxcclxuXHJcblx0X3pvb21PdXQ6IGZ1bmN0aW9uIChlKSB7XHJcblx0XHR0aGlzLl9tYXAuem9vbU91dChlLnNoaWZ0S2V5ID8gMyA6IDEpO1xyXG5cdH0sXHJcblxyXG5cdF9jcmVhdGVCdXR0b246IGZ1bmN0aW9uIChodG1sLCB0aXRsZSwgY2xhc3NOYW1lLCBjb250YWluZXIsIGZuLCBjb250ZXh0KSB7XHJcblx0XHR2YXIgbGluayA9IEwuRG9tVXRpbC5jcmVhdGUoJ2EnLCBjbGFzc05hbWUsIGNvbnRhaW5lcik7XHJcblx0XHRsaW5rLmlubmVySFRNTCA9IGh0bWw7XHJcblx0XHRsaW5rLmhyZWYgPSAnIyc7XHJcblx0XHRsaW5rLnRpdGxlID0gdGl0bGU7XHJcblxyXG5cdFx0dmFyIHN0b3AgPSBMLkRvbUV2ZW50LnN0b3BQcm9wYWdhdGlvbjtcclxuXHJcblx0XHRMLkRvbUV2ZW50XHJcblx0XHQgICAgLm9uKGxpbmssICdjbGljaycsIHN0b3ApXHJcblx0XHQgICAgLm9uKGxpbmssICdtb3VzZWRvd24nLCBzdG9wKVxyXG5cdFx0ICAgIC5vbihsaW5rLCAnZGJsY2xpY2snLCBzdG9wKVxyXG5cdFx0ICAgIC5vbihsaW5rLCAnY2xpY2snLCBMLkRvbUV2ZW50LnByZXZlbnREZWZhdWx0KVxyXG5cdFx0ICAgIC5vbihsaW5rLCAnY2xpY2snLCBmbiwgY29udGV4dClcclxuXHRcdCAgICAub24obGluaywgJ2NsaWNrJywgdGhpcy5fcmVmb2N1c09uTWFwLCBjb250ZXh0KTtcclxuXHJcblx0XHRyZXR1cm4gbGluaztcclxuXHR9LFxyXG5cclxuXHRfdXBkYXRlRGlzYWJsZWQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBtYXAgPSB0aGlzLl9tYXAsXHJcblx0XHRcdGNsYXNzTmFtZSA9ICdsZWFmbGV0LWRpc2FibGVkJztcclxuXHJcblx0XHRMLkRvbVV0aWwucmVtb3ZlQ2xhc3ModGhpcy5fem9vbUluQnV0dG9uLCBjbGFzc05hbWUpO1xyXG5cdFx0TC5Eb21VdGlsLnJlbW92ZUNsYXNzKHRoaXMuX3pvb21PdXRCdXR0b24sIGNsYXNzTmFtZSk7XHJcblxyXG5cdFx0aWYgKG1hcC5fem9vbSA9PT0gbWFwLmdldE1pblpvb20oKSkge1xyXG5cdFx0XHRMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fem9vbU91dEJ1dHRvbiwgY2xhc3NOYW1lKTtcclxuXHRcdH1cclxuXHRcdGlmIChtYXAuX3pvb20gPT09IG1hcC5nZXRNYXhab29tKCkpIHtcclxuXHRcdFx0TC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3pvb21JbkJ1dHRvbiwgY2xhc3NOYW1lKTtcclxuXHRcdH1cclxuXHR9XHJcbn0pO1xyXG5cclxuTC5NYXAubWVyZ2VPcHRpb25zKHtcclxuXHR6b29tQ29udHJvbDogdHJ1ZVxyXG59KTtcclxuXHJcbkwuTWFwLmFkZEluaXRIb29rKGZ1bmN0aW9uICgpIHtcclxuXHRpZiAodGhpcy5vcHRpb25zLnpvb21Db250cm9sKSB7XHJcblx0XHR0aGlzLnpvb21Db250cm9sID0gbmV3IEwuQ29udHJvbC5ab29tKCk7XHJcblx0XHR0aGlzLmFkZENvbnRyb2wodGhpcy56b29tQ29udHJvbCk7XHJcblx0fVxyXG59KTtcclxuXHJcbkwuY29udHJvbC56b29tID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuXHRyZXR1cm4gbmV3IEwuQ29udHJvbC5ab29tKG9wdGlvbnMpO1xyXG59O1xyXG5cclxuXG5cbi8qXHJcbiAqIEwuQ29udHJvbC5BdHRyaWJ1dGlvbiBpcyB1c2VkIGZvciBkaXNwbGF5aW5nIGF0dHJpYnV0aW9uIG9uIHRoZSBtYXAgKGFkZGVkIGJ5IGRlZmF1bHQpLlxyXG4gKi9cclxuXHJcbkwuQ29udHJvbC5BdHRyaWJ1dGlvbiA9IEwuQ29udHJvbC5leHRlbmQoe1xyXG5cdG9wdGlvbnM6IHtcclxuXHRcdHBvc2l0aW9uOiAnYm90dG9tcmlnaHQnLFxyXG5cdFx0cHJlZml4OiAnPGEgaHJlZj1cImh0dHA6Ly9sZWFmbGV0anMuY29tXCIgdGl0bGU9XCJBIEpTIGxpYnJhcnkgZm9yIGludGVyYWN0aXZlIG1hcHNcIj5MZWFmbGV0PC9hPidcclxuXHR9LFxyXG5cclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAob3B0aW9ucykge1xyXG5cdFx0TC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuXHRcdHRoaXMuX2F0dHJpYnV0aW9ucyA9IHt9O1xyXG5cdH0sXHJcblxyXG5cdG9uQWRkOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHR0aGlzLl9jb250YWluZXIgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnbGVhZmxldC1jb250cm9sLWF0dHJpYnV0aW9uJyk7XHJcblx0XHRMLkRvbUV2ZW50LmRpc2FibGVDbGlja1Byb3BhZ2F0aW9uKHRoaXMuX2NvbnRhaW5lcik7XHJcblxyXG5cdFx0Zm9yICh2YXIgaSBpbiBtYXAuX2xheWVycykge1xyXG5cdFx0XHRpZiAobWFwLl9sYXllcnNbaV0uZ2V0QXR0cmlidXRpb24pIHtcclxuXHRcdFx0XHR0aGlzLmFkZEF0dHJpYnV0aW9uKG1hcC5fbGF5ZXJzW2ldLmdldEF0dHJpYnV0aW9uKCkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdG1hcFxyXG5cdFx0ICAgIC5vbignbGF5ZXJhZGQnLCB0aGlzLl9vbkxheWVyQWRkLCB0aGlzKVxyXG5cdFx0ICAgIC5vbignbGF5ZXJyZW1vdmUnLCB0aGlzLl9vbkxheWVyUmVtb3ZlLCB0aGlzKTtcclxuXHJcblx0XHR0aGlzLl91cGRhdGUoKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy5fY29udGFpbmVyO1xyXG5cdH0sXHJcblxyXG5cdG9uUmVtb3ZlOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHRtYXBcclxuXHRcdCAgICAub2ZmKCdsYXllcmFkZCcsIHRoaXMuX29uTGF5ZXJBZGQpXHJcblx0XHQgICAgLm9mZignbGF5ZXJyZW1vdmUnLCB0aGlzLl9vbkxheWVyUmVtb3ZlKTtcclxuXHJcblx0fSxcclxuXHJcblx0c2V0UHJlZml4OiBmdW5jdGlvbiAocHJlZml4KSB7XHJcblx0XHR0aGlzLm9wdGlvbnMucHJlZml4ID0gcHJlZml4O1xyXG5cdFx0dGhpcy5fdXBkYXRlKCk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRhZGRBdHRyaWJ1dGlvbjogZnVuY3Rpb24gKHRleHQpIHtcclxuXHRcdGlmICghdGV4dCkgeyByZXR1cm47IH1cclxuXHJcblx0XHRpZiAoIXRoaXMuX2F0dHJpYnV0aW9uc1t0ZXh0XSkge1xyXG5cdFx0XHR0aGlzLl9hdHRyaWJ1dGlvbnNbdGV4dF0gPSAwO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5fYXR0cmlidXRpb25zW3RleHRdKys7XHJcblxyXG5cdFx0dGhpcy5fdXBkYXRlKCk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0cmVtb3ZlQXR0cmlidXRpb246IGZ1bmN0aW9uICh0ZXh0KSB7XHJcblx0XHRpZiAoIXRleHQpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0aWYgKHRoaXMuX2F0dHJpYnV0aW9uc1t0ZXh0XSkge1xyXG5cdFx0XHR0aGlzLl9hdHRyaWJ1dGlvbnNbdGV4dF0tLTtcclxuXHRcdFx0dGhpcy5fdXBkYXRlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKCF0aGlzLl9tYXApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIGF0dHJpYnMgPSBbXTtcclxuXHJcblx0XHRmb3IgKHZhciBpIGluIHRoaXMuX2F0dHJpYnV0aW9ucykge1xyXG5cdFx0XHRpZiAodGhpcy5fYXR0cmlidXRpb25zW2ldKSB7XHJcblx0XHRcdFx0YXR0cmlicy5wdXNoKGkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHByZWZpeEFuZEF0dHJpYnMgPSBbXTtcclxuXHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnByZWZpeCkge1xyXG5cdFx0XHRwcmVmaXhBbmRBdHRyaWJzLnB1c2godGhpcy5vcHRpb25zLnByZWZpeCk7XHJcblx0XHR9XHJcblx0XHRpZiAoYXR0cmlicy5sZW5ndGgpIHtcclxuXHRcdFx0cHJlZml4QW5kQXR0cmlicy5wdXNoKGF0dHJpYnMuam9pbignLCAnKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fY29udGFpbmVyLmlubmVySFRNTCA9IHByZWZpeEFuZEF0dHJpYnMuam9pbignIHwgJyk7XHJcblx0fSxcclxuXHJcblx0X29uTGF5ZXJBZGQ6IGZ1bmN0aW9uIChlKSB7XHJcblx0XHRpZiAoZS5sYXllci5nZXRBdHRyaWJ1dGlvbikge1xyXG5cdFx0XHR0aGlzLmFkZEF0dHJpYnV0aW9uKGUubGF5ZXIuZ2V0QXR0cmlidXRpb24oKSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X29uTGF5ZXJSZW1vdmU6IGZ1bmN0aW9uIChlKSB7XHJcblx0XHRpZiAoZS5sYXllci5nZXRBdHRyaWJ1dGlvbikge1xyXG5cdFx0XHR0aGlzLnJlbW92ZUF0dHJpYnV0aW9uKGUubGF5ZXIuZ2V0QXR0cmlidXRpb24oKSk7XHJcblx0XHR9XHJcblx0fVxyXG59KTtcclxuXHJcbkwuTWFwLm1lcmdlT3B0aW9ucyh7XHJcblx0YXR0cmlidXRpb25Db250cm9sOiB0cnVlXHJcbn0pO1xyXG5cclxuTC5NYXAuYWRkSW5pdEhvb2soZnVuY3Rpb24gKCkge1xyXG5cdGlmICh0aGlzLm9wdGlvbnMuYXR0cmlidXRpb25Db250cm9sKSB7XHJcblx0XHR0aGlzLmF0dHJpYnV0aW9uQ29udHJvbCA9IChuZXcgTC5Db250cm9sLkF0dHJpYnV0aW9uKCkpLmFkZFRvKHRoaXMpO1xyXG5cdH1cclxufSk7XHJcblxyXG5MLmNvbnRyb2wuYXR0cmlidXRpb24gPSBmdW5jdGlvbiAob3B0aW9ucykge1xyXG5cdHJldHVybiBuZXcgTC5Db250cm9sLkF0dHJpYnV0aW9uKG9wdGlvbnMpO1xyXG59O1xyXG5cblxuLypcbiAqIEwuQ29udHJvbC5TY2FsZSBpcyB1c2VkIGZvciBkaXNwbGF5aW5nIG1ldHJpYy9pbXBlcmlhbCBzY2FsZSBvbiB0aGUgbWFwLlxuICovXG5cbkwuQ29udHJvbC5TY2FsZSA9IEwuQ29udHJvbC5leHRlbmQoe1xuXHRvcHRpb25zOiB7XG5cdFx0cG9zaXRpb246ICdib3R0b21sZWZ0Jyxcblx0XHRtYXhXaWR0aDogMTAwLFxuXHRcdG1ldHJpYzogdHJ1ZSxcblx0XHRpbXBlcmlhbDogdHJ1ZSxcblx0XHR1cGRhdGVXaGVuSWRsZTogZmFsc2Vcblx0fSxcblxuXHRvbkFkZDogZnVuY3Rpb24gKG1hcCkge1xuXHRcdHRoaXMuX21hcCA9IG1hcDtcblxuXHRcdHZhciBjbGFzc05hbWUgPSAnbGVhZmxldC1jb250cm9sLXNjYWxlJyxcblx0XHQgICAgY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgY2xhc3NOYW1lKSxcblx0XHQgICAgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcblxuXHRcdHRoaXMuX2FkZFNjYWxlcyhvcHRpb25zLCBjbGFzc05hbWUsIGNvbnRhaW5lcik7XG5cblx0XHRtYXAub24ob3B0aW9ucy51cGRhdGVXaGVuSWRsZSA/ICdtb3ZlZW5kJyA6ICdtb3ZlJywgdGhpcy5fdXBkYXRlLCB0aGlzKTtcblx0XHRtYXAud2hlblJlYWR5KHRoaXMuX3VwZGF0ZSwgdGhpcyk7XG5cblx0XHRyZXR1cm4gY29udGFpbmVyO1xuXHR9LFxuXG5cdG9uUmVtb3ZlOiBmdW5jdGlvbiAobWFwKSB7XG5cdFx0bWFwLm9mZih0aGlzLm9wdGlvbnMudXBkYXRlV2hlbklkbGUgPyAnbW92ZWVuZCcgOiAnbW92ZScsIHRoaXMuX3VwZGF0ZSwgdGhpcyk7XG5cdH0sXG5cblx0X2FkZFNjYWxlczogZnVuY3Rpb24gKG9wdGlvbnMsIGNsYXNzTmFtZSwgY29udGFpbmVyKSB7XG5cdFx0aWYgKG9wdGlvbnMubWV0cmljKSB7XG5cdFx0XHR0aGlzLl9tU2NhbGUgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCBjbGFzc05hbWUgKyAnLWxpbmUnLCBjb250YWluZXIpO1xuXHRcdH1cblx0XHRpZiAob3B0aW9ucy5pbXBlcmlhbCkge1xuXHRcdFx0dGhpcy5faVNjYWxlID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgY2xhc3NOYW1lICsgJy1saW5lJywgY29udGFpbmVyKTtcblx0XHR9XG5cdH0sXG5cblx0X3VwZGF0ZTogZnVuY3Rpb24gKCkge1xuXHRcdHZhciBib3VuZHMgPSB0aGlzLl9tYXAuZ2V0Qm91bmRzKCksXG5cdFx0ICAgIGNlbnRlckxhdCA9IGJvdW5kcy5nZXRDZW50ZXIoKS5sYXQsXG5cdFx0ICAgIGhhbGZXb3JsZE1ldGVycyA9IDYzNzgxMzcgKiBNYXRoLlBJICogTWF0aC5jb3MoY2VudGVyTGF0ICogTWF0aC5QSSAvIDE4MCksXG5cdFx0ICAgIGRpc3QgPSBoYWxmV29ybGRNZXRlcnMgKiAoYm91bmRzLmdldE5vcnRoRWFzdCgpLmxuZyAtIGJvdW5kcy5nZXRTb3V0aFdlc3QoKS5sbmcpIC8gMTgwLFxuXG5cdFx0ICAgIHNpemUgPSB0aGlzLl9tYXAuZ2V0U2l6ZSgpLFxuXHRcdCAgICBvcHRpb25zID0gdGhpcy5vcHRpb25zLFxuXHRcdCAgICBtYXhNZXRlcnMgPSAwO1xuXG5cdFx0aWYgKHNpemUueCA+IDApIHtcblx0XHRcdG1heE1ldGVycyA9IGRpc3QgKiAob3B0aW9ucy5tYXhXaWR0aCAvIHNpemUueCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fdXBkYXRlU2NhbGVzKG9wdGlvbnMsIG1heE1ldGVycyk7XG5cdH0sXG5cblx0X3VwZGF0ZVNjYWxlczogZnVuY3Rpb24gKG9wdGlvbnMsIG1heE1ldGVycykge1xuXHRcdGlmIChvcHRpb25zLm1ldHJpYyAmJiBtYXhNZXRlcnMpIHtcblx0XHRcdHRoaXMuX3VwZGF0ZU1ldHJpYyhtYXhNZXRlcnMpO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLmltcGVyaWFsICYmIG1heE1ldGVycykge1xuXHRcdFx0dGhpcy5fdXBkYXRlSW1wZXJpYWwobWF4TWV0ZXJzKTtcblx0XHR9XG5cdH0sXG5cblx0X3VwZGF0ZU1ldHJpYzogZnVuY3Rpb24gKG1heE1ldGVycykge1xuXHRcdHZhciBtZXRlcnMgPSB0aGlzLl9nZXRSb3VuZE51bShtYXhNZXRlcnMpO1xuXG5cdFx0dGhpcy5fbVNjYWxlLnN0eWxlLndpZHRoID0gdGhpcy5fZ2V0U2NhbGVXaWR0aChtZXRlcnMgLyBtYXhNZXRlcnMpICsgJ3B4Jztcblx0XHR0aGlzLl9tU2NhbGUuaW5uZXJIVE1MID0gbWV0ZXJzIDwgMTAwMCA/IG1ldGVycyArICcgbScgOiAobWV0ZXJzIC8gMTAwMCkgKyAnIGttJztcblx0fSxcblxuXHRfdXBkYXRlSW1wZXJpYWw6IGZ1bmN0aW9uIChtYXhNZXRlcnMpIHtcblx0XHR2YXIgbWF4RmVldCA9IG1heE1ldGVycyAqIDMuMjgwODM5OSxcblx0XHQgICAgc2NhbGUgPSB0aGlzLl9pU2NhbGUsXG5cdFx0ICAgIG1heE1pbGVzLCBtaWxlcywgZmVldDtcblxuXHRcdGlmIChtYXhGZWV0ID4gNTI4MCkge1xuXHRcdFx0bWF4TWlsZXMgPSBtYXhGZWV0IC8gNTI4MDtcblx0XHRcdG1pbGVzID0gdGhpcy5fZ2V0Um91bmROdW0obWF4TWlsZXMpO1xuXG5cdFx0XHRzY2FsZS5zdHlsZS53aWR0aCA9IHRoaXMuX2dldFNjYWxlV2lkdGgobWlsZXMgLyBtYXhNaWxlcykgKyAncHgnO1xuXHRcdFx0c2NhbGUuaW5uZXJIVE1MID0gbWlsZXMgKyAnIG1pJztcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRmZWV0ID0gdGhpcy5fZ2V0Um91bmROdW0obWF4RmVldCk7XG5cblx0XHRcdHNjYWxlLnN0eWxlLndpZHRoID0gdGhpcy5fZ2V0U2NhbGVXaWR0aChmZWV0IC8gbWF4RmVldCkgKyAncHgnO1xuXHRcdFx0c2NhbGUuaW5uZXJIVE1MID0gZmVldCArICcgZnQnO1xuXHRcdH1cblx0fSxcblxuXHRfZ2V0U2NhbGVXaWR0aDogZnVuY3Rpb24gKHJhdGlvKSB7XG5cdFx0cmV0dXJuIE1hdGgucm91bmQodGhpcy5vcHRpb25zLm1heFdpZHRoICogcmF0aW8pIC0gMTA7XG5cdH0sXG5cblx0X2dldFJvdW5kTnVtOiBmdW5jdGlvbiAobnVtKSB7XG5cdFx0dmFyIHBvdzEwID0gTWF0aC5wb3coMTAsIChNYXRoLmZsb29yKG51bSkgKyAnJykubGVuZ3RoIC0gMSksXG5cdFx0ICAgIGQgPSBudW0gLyBwb3cxMDtcblxuXHRcdGQgPSBkID49IDEwID8gMTAgOiBkID49IDUgPyA1IDogZCA+PSAzID8gMyA6IGQgPj0gMiA/IDIgOiAxO1xuXG5cdFx0cmV0dXJuIHBvdzEwICogZDtcblx0fVxufSk7XG5cbkwuY29udHJvbC5zY2FsZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG5cdHJldHVybiBuZXcgTC5Db250cm9sLlNjYWxlKG9wdGlvbnMpO1xufTtcblxuXG4vKlxyXG4gKiBMLkNvbnRyb2wuTGF5ZXJzIGlzIGEgY29udHJvbCB0byBhbGxvdyB1c2VycyB0byBzd2l0Y2ggYmV0d2VlbiBkaWZmZXJlbnQgbGF5ZXJzIG9uIHRoZSBtYXAuXHJcbiAqL1xyXG5cclxuTC5Db250cm9sLkxheWVycyA9IEwuQ29udHJvbC5leHRlbmQoe1xyXG5cdG9wdGlvbnM6IHtcclxuXHRcdGNvbGxhcHNlZDogdHJ1ZSxcclxuXHRcdHBvc2l0aW9uOiAndG9wcmlnaHQnLFxyXG5cdFx0YXV0b1pJbmRleDogdHJ1ZVxyXG5cdH0sXHJcblxyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIChiYXNlTGF5ZXJzLCBvdmVybGF5cywgb3B0aW9ucykge1xyXG5cdFx0TC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuXHRcdHRoaXMuX2xheWVycyA9IHt9O1xyXG5cdFx0dGhpcy5fbGFzdFpJbmRleCA9IDA7XHJcblx0XHR0aGlzLl9oYW5kbGluZ0NsaWNrID0gZmFsc2U7XHJcblxyXG5cdFx0Zm9yICh2YXIgaSBpbiBiYXNlTGF5ZXJzKSB7XHJcblx0XHRcdHRoaXMuX2FkZExheWVyKGJhc2VMYXllcnNbaV0sIGkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoaSBpbiBvdmVybGF5cykge1xyXG5cdFx0XHR0aGlzLl9hZGRMYXllcihvdmVybGF5c1tpXSwgaSwgdHJ1ZSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0b25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcclxuXHRcdHRoaXMuX2luaXRMYXlvdXQoKTtcclxuXHRcdHRoaXMuX3VwZGF0ZSgpO1xyXG5cclxuXHRcdG1hcFxyXG5cdFx0ICAgIC5vbignbGF5ZXJhZGQnLCB0aGlzLl9vbkxheWVyQ2hhbmdlLCB0aGlzKVxyXG5cdFx0ICAgIC5vbignbGF5ZXJyZW1vdmUnLCB0aGlzLl9vbkxheWVyQ2hhbmdlLCB0aGlzKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy5fY29udGFpbmVyO1xyXG5cdH0sXHJcblxyXG5cdG9uUmVtb3ZlOiBmdW5jdGlvbiAobWFwKSB7XHJcblx0XHRtYXBcclxuXHRcdCAgICAub2ZmKCdsYXllcmFkZCcsIHRoaXMuX29uTGF5ZXJDaGFuZ2UsIHRoaXMpXHJcblx0XHQgICAgLm9mZignbGF5ZXJyZW1vdmUnLCB0aGlzLl9vbkxheWVyQ2hhbmdlLCB0aGlzKTtcclxuXHR9LFxyXG5cclxuXHRhZGRCYXNlTGF5ZXI6IGZ1bmN0aW9uIChsYXllciwgbmFtZSkge1xyXG5cdFx0dGhpcy5fYWRkTGF5ZXIobGF5ZXIsIG5hbWUpO1xyXG5cdFx0dGhpcy5fdXBkYXRlKCk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRhZGRPdmVybGF5OiBmdW5jdGlvbiAobGF5ZXIsIG5hbWUpIHtcclxuXHRcdHRoaXMuX2FkZExheWVyKGxheWVyLCBuYW1lLCB0cnVlKTtcclxuXHRcdHRoaXMuX3VwZGF0ZSgpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0cmVtb3ZlTGF5ZXI6IGZ1bmN0aW9uIChsYXllcikge1xyXG5cdFx0dmFyIGlkID0gTC5zdGFtcChsYXllcik7XHJcblx0XHRkZWxldGUgdGhpcy5fbGF5ZXJzW2lkXTtcclxuXHRcdHRoaXMuX3VwZGF0ZSgpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fSxcclxuXHJcblx0X2luaXRMYXlvdXQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBjbGFzc05hbWUgPSAnbGVhZmxldC1jb250cm9sLWxheWVycycsXHJcblx0XHQgICAgY29udGFpbmVyID0gdGhpcy5fY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgY2xhc3NOYW1lKTtcclxuXHJcblx0XHQvL01ha2VzIHRoaXMgd29yayBvbiBJRTEwIFRvdWNoIGRldmljZXMgYnkgc3RvcHBpbmcgaXQgZnJvbSBmaXJpbmcgYSBtb3VzZW91dCBldmVudCB3aGVuIHRoZSB0b3VjaCBpcyByZWxlYXNlZFxyXG5cdFx0Y29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1oYXNwb3B1cCcsIHRydWUpO1xyXG5cclxuXHRcdGlmICghTC5Ccm93c2VyLnRvdWNoKSB7XHJcblx0XHRcdEwuRG9tRXZlbnRcclxuXHRcdFx0XHQuZGlzYWJsZUNsaWNrUHJvcGFnYXRpb24oY29udGFpbmVyKVxyXG5cdFx0XHRcdC5kaXNhYmxlU2Nyb2xsUHJvcGFnYXRpb24oY29udGFpbmVyKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdEwuRG9tRXZlbnQub24oY29udGFpbmVyLCAnY2xpY2snLCBMLkRvbUV2ZW50LnN0b3BQcm9wYWdhdGlvbik7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGZvcm0gPSB0aGlzLl9mb3JtID0gTC5Eb21VdGlsLmNyZWF0ZSgnZm9ybScsIGNsYXNzTmFtZSArICctbGlzdCcpO1xyXG5cclxuXHRcdGlmICh0aGlzLm9wdGlvbnMuY29sbGFwc2VkKSB7XHJcblx0XHRcdGlmICghTC5Ccm93c2VyLmFuZHJvaWQpIHtcclxuXHRcdFx0XHRMLkRvbUV2ZW50XHJcblx0XHRcdFx0ICAgIC5vbihjb250YWluZXIsICdtb3VzZW92ZXInLCB0aGlzLl9leHBhbmQsIHRoaXMpXHJcblx0XHRcdFx0ICAgIC5vbihjb250YWluZXIsICdtb3VzZW91dCcsIHRoaXMuX2NvbGxhcHNlLCB0aGlzKTtcclxuXHRcdFx0fVxyXG5cdFx0XHR2YXIgbGluayA9IHRoaXMuX2xheWVyc0xpbmsgPSBMLkRvbVV0aWwuY3JlYXRlKCdhJywgY2xhc3NOYW1lICsgJy10b2dnbGUnLCBjb250YWluZXIpO1xyXG5cdFx0XHRsaW5rLmhyZWYgPSAnIyc7XHJcblx0XHRcdGxpbmsudGl0bGUgPSAnTGF5ZXJzJztcclxuXHJcblx0XHRcdGlmIChMLkJyb3dzZXIudG91Y2gpIHtcclxuXHRcdFx0XHRMLkRvbUV2ZW50XHJcblx0XHRcdFx0ICAgIC5vbihsaW5rLCAnY2xpY2snLCBMLkRvbUV2ZW50LnN0b3ApXHJcblx0XHRcdFx0ICAgIC5vbihsaW5rLCAnY2xpY2snLCB0aGlzLl9leHBhbmQsIHRoaXMpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdEwuRG9tRXZlbnQub24obGluaywgJ2ZvY3VzJywgdGhpcy5fZXhwYW5kLCB0aGlzKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvL1dvcmsgYXJvdW5kIGZvciBGaXJlZm94IGFuZHJvaWQgaXNzdWUgaHR0cHM6Ly9naXRodWIuY29tL0xlYWZsZXQvTGVhZmxldC9pc3N1ZXMvMjAzM1xyXG5cdFx0XHRMLkRvbUV2ZW50Lm9uKGZvcm0sICdjbGljaycsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRzZXRUaW1lb3V0KEwuYmluZCh0aGlzLl9vbklucHV0Q2xpY2ssIHRoaXMpLCAwKTtcclxuXHRcdFx0fSwgdGhpcyk7XHJcblxyXG5cdFx0XHR0aGlzLl9tYXAub24oJ2NsaWNrJywgdGhpcy5fY29sbGFwc2UsIHRoaXMpO1xyXG5cdFx0XHQvLyBUT0RPIGtleWJvYXJkIGFjY2Vzc2liaWxpdHlcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuX2V4cGFuZCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2Jhc2VMYXllcnNMaXN0ID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgY2xhc3NOYW1lICsgJy1iYXNlJywgZm9ybSk7XHJcblx0XHR0aGlzLl9zZXBhcmF0b3IgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCBjbGFzc05hbWUgKyAnLXNlcGFyYXRvcicsIGZvcm0pO1xyXG5cdFx0dGhpcy5fb3ZlcmxheXNMaXN0ID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgY2xhc3NOYW1lICsgJy1vdmVybGF5cycsIGZvcm0pO1xyXG5cclxuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChmb3JtKTtcclxuXHR9LFxyXG5cclxuXHRfYWRkTGF5ZXI6IGZ1bmN0aW9uIChsYXllciwgbmFtZSwgb3ZlcmxheSkge1xyXG5cdFx0dmFyIGlkID0gTC5zdGFtcChsYXllcik7XHJcblxyXG5cdFx0dGhpcy5fbGF5ZXJzW2lkXSA9IHtcclxuXHRcdFx0bGF5ZXI6IGxheWVyLFxyXG5cdFx0XHRuYW1lOiBuYW1lLFxyXG5cdFx0XHRvdmVybGF5OiBvdmVybGF5XHJcblx0XHR9O1xyXG5cclxuXHRcdGlmICh0aGlzLm9wdGlvbnMuYXV0b1pJbmRleCAmJiBsYXllci5zZXRaSW5kZXgpIHtcclxuXHRcdFx0dGhpcy5fbGFzdFpJbmRleCsrO1xyXG5cdFx0XHRsYXllci5zZXRaSW5kZXgodGhpcy5fbGFzdFpJbmRleCk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0X3VwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKCF0aGlzLl9jb250YWluZXIpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2Jhc2VMYXllcnNMaXN0LmlubmVySFRNTCA9ICcnO1xyXG5cdFx0dGhpcy5fb3ZlcmxheXNMaXN0LmlubmVySFRNTCA9ICcnO1xyXG5cclxuXHRcdHZhciBiYXNlTGF5ZXJzUHJlc2VudCA9IGZhbHNlLFxyXG5cdFx0ICAgIG92ZXJsYXlzUHJlc2VudCA9IGZhbHNlLFxyXG5cdFx0ICAgIGksIG9iajtcclxuXHJcblx0XHRmb3IgKGkgaW4gdGhpcy5fbGF5ZXJzKSB7XHJcblx0XHRcdG9iaiA9IHRoaXMuX2xheWVyc1tpXTtcclxuXHRcdFx0dGhpcy5fYWRkSXRlbShvYmopO1xyXG5cdFx0XHRvdmVybGF5c1ByZXNlbnQgPSBvdmVybGF5c1ByZXNlbnQgfHwgb2JqLm92ZXJsYXk7XHJcblx0XHRcdGJhc2VMYXllcnNQcmVzZW50ID0gYmFzZUxheWVyc1ByZXNlbnQgfHwgIW9iai5vdmVybGF5O1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3NlcGFyYXRvci5zdHlsZS5kaXNwbGF5ID0gb3ZlcmxheXNQcmVzZW50ICYmIGJhc2VMYXllcnNQcmVzZW50ID8gJycgOiAnbm9uZSc7XHJcblx0fSxcclxuXHJcblx0X29uTGF5ZXJDaGFuZ2U6IGZ1bmN0aW9uIChlKSB7XHJcblx0XHR2YXIgb2JqID0gdGhpcy5fbGF5ZXJzW0wuc3RhbXAoZS5sYXllcildO1xyXG5cclxuXHRcdGlmICghb2JqKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGlmICghdGhpcy5faGFuZGxpbmdDbGljaykge1xyXG5cdFx0XHR0aGlzLl91cGRhdGUoKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgdHlwZSA9IG9iai5vdmVybGF5ID9cclxuXHRcdFx0KGUudHlwZSA9PT0gJ2xheWVyYWRkJyA/ICdvdmVybGF5YWRkJyA6ICdvdmVybGF5cmVtb3ZlJykgOlxyXG5cdFx0XHQoZS50eXBlID09PSAnbGF5ZXJhZGQnID8gJ2Jhc2VsYXllcmNoYW5nZScgOiBudWxsKTtcclxuXHJcblx0XHRpZiAodHlwZSkge1xyXG5cdFx0XHR0aGlzLl9tYXAuZmlyZSh0eXBlLCBvYmopO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdC8vIElFNyBidWdzIG91dCBpZiB5b3UgY3JlYXRlIGEgcmFkaW8gZHluYW1pY2FsbHksIHNvIHlvdSBoYXZlIHRvIGRvIGl0IHRoaXMgaGFja3kgd2F5IChzZWUgaHR0cDovL2JpdC5seS9QcVlMQmUpXHJcblx0X2NyZWF0ZVJhZGlvRWxlbWVudDogZnVuY3Rpb24gKG5hbWUsIGNoZWNrZWQpIHtcclxuXHJcblx0XHR2YXIgcmFkaW9IdG1sID0gJzxpbnB1dCB0eXBlPVwicmFkaW9cIiBjbGFzcz1cImxlYWZsZXQtY29udHJvbC1sYXllcnMtc2VsZWN0b3JcIiBuYW1lPVwiJyArIG5hbWUgKyAnXCInO1xyXG5cdFx0aWYgKGNoZWNrZWQpIHtcclxuXHRcdFx0cmFkaW9IdG1sICs9ICcgY2hlY2tlZD1cImNoZWNrZWRcIic7XHJcblx0XHR9XHJcblx0XHRyYWRpb0h0bWwgKz0gJy8+JztcclxuXHJcblx0XHR2YXIgcmFkaW9GcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0cmFkaW9GcmFnbWVudC5pbm5lckhUTUwgPSByYWRpb0h0bWw7XHJcblxyXG5cdFx0cmV0dXJuIHJhZGlvRnJhZ21lbnQuZmlyc3RDaGlsZDtcclxuXHR9LFxyXG5cclxuXHRfYWRkSXRlbTogZnVuY3Rpb24gKG9iaikge1xyXG5cdFx0dmFyIGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGFiZWwnKSxcclxuXHRcdCAgICBpbnB1dCxcclxuXHRcdCAgICBjaGVja2VkID0gdGhpcy5fbWFwLmhhc0xheWVyKG9iai5sYXllcik7XHJcblxyXG5cdFx0aWYgKG9iai5vdmVybGF5KSB7XHJcblx0XHRcdGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuXHRcdFx0aW5wdXQudHlwZSA9ICdjaGVja2JveCc7XHJcblx0XHRcdGlucHV0LmNsYXNzTmFtZSA9ICdsZWFmbGV0LWNvbnRyb2wtbGF5ZXJzLXNlbGVjdG9yJztcclxuXHRcdFx0aW5wdXQuZGVmYXVsdENoZWNrZWQgPSBjaGVja2VkO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aW5wdXQgPSB0aGlzLl9jcmVhdGVSYWRpb0VsZW1lbnQoJ2xlYWZsZXQtYmFzZS1sYXllcnMnLCBjaGVja2VkKTtcclxuXHRcdH1cclxuXHJcblx0XHRpbnB1dC5sYXllcklkID0gTC5zdGFtcChvYmoubGF5ZXIpO1xyXG5cclxuXHRcdEwuRG9tRXZlbnQub24oaW5wdXQsICdjbGljaycsIHRoaXMuX29uSW5wdXRDbGljaywgdGhpcyk7XHJcblxyXG5cdFx0dmFyIG5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcblx0XHRuYW1lLmlubmVySFRNTCA9ICcgJyArIG9iai5uYW1lO1xyXG5cclxuXHRcdGxhYmVsLmFwcGVuZENoaWxkKGlucHV0KTtcclxuXHRcdGxhYmVsLmFwcGVuZENoaWxkKG5hbWUpO1xyXG5cclxuXHRcdHZhciBjb250YWluZXIgPSBvYmoub3ZlcmxheSA/IHRoaXMuX292ZXJsYXlzTGlzdCA6IHRoaXMuX2Jhc2VMYXllcnNMaXN0O1xyXG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGxhYmVsKTtcclxuXHJcblx0XHRyZXR1cm4gbGFiZWw7XHJcblx0fSxcclxuXHJcblx0X29uSW5wdXRDbGljazogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIGksIGlucHV0LCBvYmosXHJcblx0XHQgICAgaW5wdXRzID0gdGhpcy5fZm9ybS5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW5wdXQnKSxcclxuXHRcdCAgICBpbnB1dHNMZW4gPSBpbnB1dHMubGVuZ3RoO1xyXG5cclxuXHRcdHRoaXMuX2hhbmRsaW5nQ2xpY2sgPSB0cnVlO1xyXG5cclxuXHRcdGZvciAoaSA9IDA7IGkgPCBpbnB1dHNMZW47IGkrKykge1xyXG5cdFx0XHRpbnB1dCA9IGlucHV0c1tpXTtcclxuXHRcdFx0b2JqID0gdGhpcy5fbGF5ZXJzW2lucHV0LmxheWVySWRdO1xyXG5cclxuXHRcdFx0aWYgKGlucHV0LmNoZWNrZWQgJiYgIXRoaXMuX21hcC5oYXNMYXllcihvYmoubGF5ZXIpKSB7XHJcblx0XHRcdFx0dGhpcy5fbWFwLmFkZExheWVyKG9iai5sYXllcik7XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCFpbnB1dC5jaGVja2VkICYmIHRoaXMuX21hcC5oYXNMYXllcihvYmoubGF5ZXIpKSB7XHJcblx0XHRcdFx0dGhpcy5fbWFwLnJlbW92ZUxheWVyKG9iai5sYXllcik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9oYW5kbGluZ0NsaWNrID0gZmFsc2U7XHJcblxyXG5cdFx0dGhpcy5fcmVmb2N1c09uTWFwKCk7XHJcblx0fSxcclxuXHJcblx0X2V4cGFuZDogZnVuY3Rpb24gKCkge1xyXG5cdFx0TC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2NvbnRhaW5lciwgJ2xlYWZsZXQtY29udHJvbC1sYXllcnMtZXhwYW5kZWQnKTtcclxuXHR9LFxyXG5cclxuXHRfY29sbGFwc2U6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHRoaXMuX2NvbnRhaW5lci5jbGFzc05hbWUgPSB0aGlzLl9jb250YWluZXIuY2xhc3NOYW1lLnJlcGxhY2UoJyBsZWFmbGV0LWNvbnRyb2wtbGF5ZXJzLWV4cGFuZGVkJywgJycpO1xyXG5cdH1cclxufSk7XHJcblxyXG5MLmNvbnRyb2wubGF5ZXJzID0gZnVuY3Rpb24gKGJhc2VMYXllcnMsIG92ZXJsYXlzLCBvcHRpb25zKSB7XHJcblx0cmV0dXJuIG5ldyBMLkNvbnRyb2wuTGF5ZXJzKGJhc2VMYXllcnMsIG92ZXJsYXlzLCBvcHRpb25zKTtcclxufTtcclxuXG5cbi8qXG4gKiBMLlBvc0FuaW1hdGlvbiBpcyB1c2VkIGJ5IExlYWZsZXQgaW50ZXJuYWxseSBmb3IgcGFuIGFuaW1hdGlvbnMuXG4gKi9cblxuTC5Qb3NBbmltYXRpb24gPSBMLkNsYXNzLmV4dGVuZCh7XG5cdGluY2x1ZGVzOiBMLk1peGluLkV2ZW50cyxcblxuXHRydW46IGZ1bmN0aW9uIChlbCwgbmV3UG9zLCBkdXJhdGlvbiwgZWFzZUxpbmVhcml0eSkgeyAvLyAoSFRNTEVsZW1lbnQsIFBvaW50WywgTnVtYmVyLCBOdW1iZXJdKVxuXHRcdHRoaXMuc3RvcCgpO1xuXG5cdFx0dGhpcy5fZWwgPSBlbDtcblx0XHR0aGlzLl9pblByb2dyZXNzID0gdHJ1ZTtcblx0XHR0aGlzLl9uZXdQb3MgPSBuZXdQb3M7XG5cblx0XHR0aGlzLmZpcmUoJ3N0YXJ0Jyk7XG5cblx0XHRlbC5zdHlsZVtMLkRvbVV0aWwuVFJBTlNJVElPTl0gPSAnYWxsICcgKyAoZHVyYXRpb24gfHwgMC4yNSkgK1xuXHRcdCAgICAgICAgJ3MgY3ViaWMtYmV6aWVyKDAsMCwnICsgKGVhc2VMaW5lYXJpdHkgfHwgMC41KSArICcsMSknO1xuXG5cdFx0TC5Eb21FdmVudC5vbihlbCwgTC5Eb21VdGlsLlRSQU5TSVRJT05fRU5ELCB0aGlzLl9vblRyYW5zaXRpb25FbmQsIHRoaXMpO1xuXHRcdEwuRG9tVXRpbC5zZXRQb3NpdGlvbihlbCwgbmV3UG9zKTtcblxuXHRcdC8vIHRvZ2dsZSByZWZsb3csIENocm9tZSBmbGlja2VycyBmb3Igc29tZSByZWFzb24gaWYgeW91IGRvbid0IGRvIHRoaXNcblx0XHRMLlV0aWwuZmFsc2VGbihlbC5vZmZzZXRXaWR0aCk7XG5cblx0XHQvLyB0aGVyZSdzIG5vIG5hdGl2ZSB3YXkgdG8gdHJhY2sgdmFsdWUgdXBkYXRlcyBvZiB0cmFuc2l0aW9uZWQgcHJvcGVydGllcywgc28gd2UgaW1pdGF0ZSB0aGlzXG5cdFx0dGhpcy5fc3RlcFRpbWVyID0gc2V0SW50ZXJ2YWwoTC5iaW5kKHRoaXMuX29uU3RlcCwgdGhpcyksIDUwKTtcblx0fSxcblxuXHRzdG9wOiBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCF0aGlzLl9pblByb2dyZXNzKSB7IHJldHVybjsgfVxuXG5cdFx0Ly8gaWYgd2UganVzdCByZW1vdmVkIHRoZSB0cmFuc2l0aW9uIHByb3BlcnR5LCB0aGUgZWxlbWVudCB3b3VsZCBqdW1wIHRvIGl0cyBmaW5hbCBwb3NpdGlvbixcblx0XHQvLyBzbyB3ZSBuZWVkIHRvIG1ha2UgaXQgc3RheSBhdCB0aGUgY3VycmVudCBwb3NpdGlvblxuXG5cdFx0TC5Eb21VdGlsLnNldFBvc2l0aW9uKHRoaXMuX2VsLCB0aGlzLl9nZXRQb3MoKSk7XG5cdFx0dGhpcy5fb25UcmFuc2l0aW9uRW5kKCk7XG5cdFx0TC5VdGlsLmZhbHNlRm4odGhpcy5fZWwub2Zmc2V0V2lkdGgpOyAvLyBmb3JjZSByZWZsb3cgaW4gY2FzZSB3ZSBhcmUgYWJvdXQgdG8gc3RhcnQgYSBuZXcgYW5pbWF0aW9uXG5cdH0sXG5cblx0X29uU3RlcDogZnVuY3Rpb24gKCkge1xuXHRcdHZhciBzdGVwUG9zID0gdGhpcy5fZ2V0UG9zKCk7XG5cdFx0aWYgKCFzdGVwUG9zKSB7XG5cdFx0XHR0aGlzLl9vblRyYW5zaXRpb25FbmQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8ganNoaW50IGNhbWVsY2FzZTogZmFsc2Vcblx0XHQvLyBtYWtlIEwuRG9tVXRpbC5nZXRQb3NpdGlvbiByZXR1cm4gaW50ZXJtZWRpYXRlIHBvc2l0aW9uIHZhbHVlIGR1cmluZyBhbmltYXRpb25cblx0XHR0aGlzLl9lbC5fbGVhZmxldF9wb3MgPSBzdGVwUG9zO1xuXG5cdFx0dGhpcy5maXJlKCdzdGVwJyk7XG5cdH0sXG5cblx0Ly8geW91IGNhbid0IGVhc2lseSBnZXQgaW50ZXJtZWRpYXRlIHZhbHVlcyBvZiBwcm9wZXJ0aWVzIGFuaW1hdGVkIHdpdGggQ1NTMyBUcmFuc2l0aW9ucyxcblx0Ly8gd2UgbmVlZCB0byBwYXJzZSBjb21wdXRlZCBzdHlsZSAoaW4gY2FzZSBvZiB0cmFuc2Zvcm0gaXQgcmV0dXJucyBtYXRyaXggc3RyaW5nKVxuXG5cdF90cmFuc2Zvcm1SZTogLyhbLStdPyg/OlxcZCpcXC4pP1xcZCspXFxEKiwgKFstK10/KD86XFxkKlxcLik/XFxkKylcXEQqXFwpLyxcblxuXHRfZ2V0UG9zOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGxlZnQsIHRvcCwgbWF0Y2hlcyxcblx0XHQgICAgZWwgPSB0aGlzLl9lbCxcblx0XHQgICAgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG5cblx0XHRpZiAoTC5Ccm93c2VyLmFueTNkKSB7XG5cdFx0XHRtYXRjaGVzID0gc3R5bGVbTC5Eb21VdGlsLlRSQU5TRk9STV0ubWF0Y2godGhpcy5fdHJhbnNmb3JtUmUpO1xuXHRcdFx0aWYgKCFtYXRjaGVzKSB7IHJldHVybjsgfVxuXHRcdFx0bGVmdCA9IHBhcnNlRmxvYXQobWF0Y2hlc1sxXSk7XG5cdFx0XHR0b3AgID0gcGFyc2VGbG9hdChtYXRjaGVzWzJdKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGVmdCA9IHBhcnNlRmxvYXQoc3R5bGUubGVmdCk7XG5cdFx0XHR0b3AgID0gcGFyc2VGbG9hdChzdHlsZS50b3ApO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgTC5Qb2ludChsZWZ0LCB0b3AsIHRydWUpO1xuXHR9LFxuXG5cdF9vblRyYW5zaXRpb25FbmQ6IGZ1bmN0aW9uICgpIHtcblx0XHRMLkRvbUV2ZW50Lm9mZih0aGlzLl9lbCwgTC5Eb21VdGlsLlRSQU5TSVRJT05fRU5ELCB0aGlzLl9vblRyYW5zaXRpb25FbmQsIHRoaXMpO1xuXG5cdFx0aWYgKCF0aGlzLl9pblByb2dyZXNzKSB7IHJldHVybjsgfVxuXHRcdHRoaXMuX2luUHJvZ3Jlc3MgPSBmYWxzZTtcblxuXHRcdHRoaXMuX2VsLnN0eWxlW0wuRG9tVXRpbC5UUkFOU0lUSU9OXSA9ICcnO1xuXG5cdFx0Ly8ganNoaW50IGNhbWVsY2FzZTogZmFsc2Vcblx0XHQvLyBtYWtlIHN1cmUgTC5Eb21VdGlsLmdldFBvc2l0aW9uIHJldHVybnMgdGhlIGZpbmFsIHBvc2l0aW9uIHZhbHVlIGFmdGVyIGFuaW1hdGlvblxuXHRcdHRoaXMuX2VsLl9sZWFmbGV0X3BvcyA9IHRoaXMuX25ld1BvcztcblxuXHRcdGNsZWFySW50ZXJ2YWwodGhpcy5fc3RlcFRpbWVyKTtcblxuXHRcdHRoaXMuZmlyZSgnc3RlcCcpLmZpcmUoJ2VuZCcpO1xuXHR9XG5cbn0pO1xuXG5cbi8qXG4gKiBFeHRlbmRzIEwuTWFwIHRvIGhhbmRsZSBwYW5uaW5nIGFuaW1hdGlvbnMuXG4gKi9cblxuTC5NYXAuaW5jbHVkZSh7XG5cblx0c2V0VmlldzogZnVuY3Rpb24gKGNlbnRlciwgem9vbSwgb3B0aW9ucykge1xuXG5cdFx0em9vbSA9IHpvb20gPT09IHVuZGVmaW5lZCA/IHRoaXMuX3pvb20gOiB0aGlzLl9saW1pdFpvb20oem9vbSk7XG5cdFx0Y2VudGVyID0gdGhpcy5fbGltaXRDZW50ZXIoTC5sYXRMbmcoY2VudGVyKSwgem9vbSwgdGhpcy5vcHRpb25zLm1heEJvdW5kcyk7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cblx0XHRpZiAodGhpcy5fcGFuQW5pbSkge1xuXHRcdFx0dGhpcy5fcGFuQW5pbS5zdG9wKCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2xvYWRlZCAmJiAhb3B0aW9ucy5yZXNldCAmJiBvcHRpb25zICE9PSB0cnVlKSB7XG5cblx0XHRcdGlmIChvcHRpb25zLmFuaW1hdGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRvcHRpb25zLnpvb20gPSBMLmV4dGVuZCh7YW5pbWF0ZTogb3B0aW9ucy5hbmltYXRlfSwgb3B0aW9ucy56b29tKTtcblx0XHRcdFx0b3B0aW9ucy5wYW4gPSBMLmV4dGVuZCh7YW5pbWF0ZTogb3B0aW9ucy5hbmltYXRlfSwgb3B0aW9ucy5wYW4pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB0cnkgYW5pbWF0aW5nIHBhbiBvciB6b29tXG5cdFx0XHR2YXIgYW5pbWF0ZWQgPSAodGhpcy5fem9vbSAhPT0gem9vbSkgP1xuXHRcdFx0XHR0aGlzLl90cnlBbmltYXRlZFpvb20gJiYgdGhpcy5fdHJ5QW5pbWF0ZWRab29tKGNlbnRlciwgem9vbSwgb3B0aW9ucy56b29tKSA6XG5cdFx0XHRcdHRoaXMuX3RyeUFuaW1hdGVkUGFuKGNlbnRlciwgb3B0aW9ucy5wYW4pO1xuXG5cdFx0XHRpZiAoYW5pbWF0ZWQpIHtcblx0XHRcdFx0Ly8gcHJldmVudCByZXNpemUgaGFuZGxlciBjYWxsLCB0aGUgdmlldyB3aWxsIHJlZnJlc2ggYWZ0ZXIgYW5pbWF0aW9uIGFueXdheVxuXHRcdFx0XHRjbGVhclRpbWVvdXQodGhpcy5fc2l6ZVRpbWVyKTtcblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gYW5pbWF0aW9uIGRpZG4ndCBzdGFydCwganVzdCByZXNldCB0aGUgbWFwIHZpZXdcblx0XHR0aGlzLl9yZXNldFZpZXcoY2VudGVyLCB6b29tKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdHBhbkJ5OiBmdW5jdGlvbiAob2Zmc2V0LCBvcHRpb25zKSB7XG5cdFx0b2Zmc2V0ID0gTC5wb2ludChvZmZzZXQpLnJvdW5kKCk7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cblx0XHRpZiAoIW9mZnNldC54ICYmICFvZmZzZXQueSkge1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9wYW5BbmltKSB7XG5cdFx0XHR0aGlzLl9wYW5BbmltID0gbmV3IEwuUG9zQW5pbWF0aW9uKCk7XG5cblx0XHRcdHRoaXMuX3BhbkFuaW0ub24oe1xuXHRcdFx0XHQnc3RlcCc6IHRoaXMuX29uUGFuVHJhbnNpdGlvblN0ZXAsXG5cdFx0XHRcdCdlbmQnOiB0aGlzLl9vblBhblRyYW5zaXRpb25FbmRcblx0XHRcdH0sIHRoaXMpO1xuXHRcdH1cblxuXHRcdC8vIGRvbid0IGZpcmUgbW92ZXN0YXJ0IGlmIGFuaW1hdGluZyBpbmVydGlhXG5cdFx0aWYgKCFvcHRpb25zLm5vTW92ZVN0YXJ0KSB7XG5cdFx0XHR0aGlzLmZpcmUoJ21vdmVzdGFydCcpO1xuXHRcdH1cblxuXHRcdC8vIGFuaW1hdGUgcGFuIHVubGVzcyBhbmltYXRlOiBmYWxzZSBzcGVjaWZpZWRcblx0XHRpZiAob3B0aW9ucy5hbmltYXRlICE9PSBmYWxzZSkge1xuXHRcdFx0TC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX21hcFBhbmUsICdsZWFmbGV0LXBhbi1hbmltJyk7XG5cblx0XHRcdHZhciBuZXdQb3MgPSB0aGlzLl9nZXRNYXBQYW5lUG9zKCkuc3VidHJhY3Qob2Zmc2V0KTtcblx0XHRcdHRoaXMuX3BhbkFuaW0ucnVuKHRoaXMuX21hcFBhbmUsIG5ld1Bvcywgb3B0aW9ucy5kdXJhdGlvbiB8fCAwLjI1LCBvcHRpb25zLmVhc2VMaW5lYXJpdHkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9yYXdQYW5CeShvZmZzZXQpO1xuXHRcdFx0dGhpcy5maXJlKCdtb3ZlJykuZmlyZSgnbW92ZWVuZCcpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdF9vblBhblRyYW5zaXRpb25TdGVwOiBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy5maXJlKCdtb3ZlJyk7XG5cdH0sXG5cblx0X29uUGFuVHJhbnNpdGlvbkVuZDogZnVuY3Rpb24gKCkge1xuXHRcdEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aGlzLl9tYXBQYW5lLCAnbGVhZmxldC1wYW4tYW5pbScpO1xuXHRcdHRoaXMuZmlyZSgnbW92ZWVuZCcpO1xuXHR9LFxuXG5cdF90cnlBbmltYXRlZFBhbjogZnVuY3Rpb24gKGNlbnRlciwgb3B0aW9ucykge1xuXHRcdC8vIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgbmV3IGFuZCBjdXJyZW50IGNlbnRlcnMgaW4gcGl4ZWxzXG5cdFx0dmFyIG9mZnNldCA9IHRoaXMuX2dldENlbnRlck9mZnNldChjZW50ZXIpLl9mbG9vcigpO1xuXG5cdFx0Ly8gZG9uJ3QgYW5pbWF0ZSB0b28gZmFyIHVubGVzcyBhbmltYXRlOiB0cnVlIHNwZWNpZmllZCBpbiBvcHRpb25zXG5cdFx0aWYgKChvcHRpb25zICYmIG9wdGlvbnMuYW5pbWF0ZSkgIT09IHRydWUgJiYgIXRoaXMuZ2V0U2l6ZSgpLmNvbnRhaW5zKG9mZnNldCkpIHsgcmV0dXJuIGZhbHNlOyB9XG5cblx0XHR0aGlzLnBhbkJ5KG9mZnNldCwgb3B0aW9ucyk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufSk7XG5cblxuLypcbiAqIEwuUG9zQW5pbWF0aW9uIGZhbGxiYWNrIGltcGxlbWVudGF0aW9uIHRoYXQgcG93ZXJzIExlYWZsZXQgcGFuIGFuaW1hdGlvbnNcbiAqIGluIGJyb3dzZXJzIHRoYXQgZG9uJ3Qgc3VwcG9ydCBDU1MzIFRyYW5zaXRpb25zLlxuICovXG5cbkwuUG9zQW5pbWF0aW9uID0gTC5Eb21VdGlsLlRSQU5TSVRJT04gPyBMLlBvc0FuaW1hdGlvbiA6IEwuUG9zQW5pbWF0aW9uLmV4dGVuZCh7XG5cblx0cnVuOiBmdW5jdGlvbiAoZWwsIG5ld1BvcywgZHVyYXRpb24sIGVhc2VMaW5lYXJpdHkpIHsgLy8gKEhUTUxFbGVtZW50LCBQb2ludFssIE51bWJlciwgTnVtYmVyXSlcblx0XHR0aGlzLnN0b3AoKTtcblxuXHRcdHRoaXMuX2VsID0gZWw7XG5cdFx0dGhpcy5faW5Qcm9ncmVzcyA9IHRydWU7XG5cdFx0dGhpcy5fZHVyYXRpb24gPSBkdXJhdGlvbiB8fCAwLjI1O1xuXHRcdHRoaXMuX2Vhc2VPdXRQb3dlciA9IDEgLyBNYXRoLm1heChlYXNlTGluZWFyaXR5IHx8IDAuNSwgMC4yKTtcblxuXHRcdHRoaXMuX3N0YXJ0UG9zID0gTC5Eb21VdGlsLmdldFBvc2l0aW9uKGVsKTtcblx0XHR0aGlzLl9vZmZzZXQgPSBuZXdQb3Muc3VidHJhY3QodGhpcy5fc3RhcnRQb3MpO1xuXHRcdHRoaXMuX3N0YXJ0VGltZSA9ICtuZXcgRGF0ZSgpO1xuXG5cdFx0dGhpcy5maXJlKCdzdGFydCcpO1xuXG5cdFx0dGhpcy5fYW5pbWF0ZSgpO1xuXHR9LFxuXG5cdHN0b3A6IGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoIXRoaXMuX2luUHJvZ3Jlc3MpIHsgcmV0dXJuOyB9XG5cblx0XHR0aGlzLl9zdGVwKCk7XG5cdFx0dGhpcy5fY29tcGxldGUoKTtcblx0fSxcblxuXHRfYW5pbWF0ZTogZnVuY3Rpb24gKCkge1xuXHRcdC8vIGFuaW1hdGlvbiBsb29wXG5cdFx0dGhpcy5fYW5pbUlkID0gTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUodGhpcy5fYW5pbWF0ZSwgdGhpcyk7XG5cdFx0dGhpcy5fc3RlcCgpO1xuXHR9LFxuXG5cdF9zdGVwOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGVsYXBzZWQgPSAoK25ldyBEYXRlKCkpIC0gdGhpcy5fc3RhcnRUaW1lLFxuXHRcdCAgICBkdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uICogMTAwMDtcblxuXHRcdGlmIChlbGFwc2VkIDwgZHVyYXRpb24pIHtcblx0XHRcdHRoaXMuX3J1bkZyYW1lKHRoaXMuX2Vhc2VPdXQoZWxhcHNlZCAvIGR1cmF0aW9uKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3J1bkZyYW1lKDEpO1xuXHRcdFx0dGhpcy5fY29tcGxldGUoKTtcblx0XHR9XG5cdH0sXG5cblx0X3J1bkZyYW1lOiBmdW5jdGlvbiAocHJvZ3Jlc3MpIHtcblx0XHR2YXIgcG9zID0gdGhpcy5fc3RhcnRQb3MuYWRkKHRoaXMuX29mZnNldC5tdWx0aXBseUJ5KHByb2dyZXNzKSk7XG5cdFx0TC5Eb21VdGlsLnNldFBvc2l0aW9uKHRoaXMuX2VsLCBwb3MpO1xuXG5cdFx0dGhpcy5maXJlKCdzdGVwJyk7XG5cdH0sXG5cblx0X2NvbXBsZXRlOiBmdW5jdGlvbiAoKSB7XG5cdFx0TC5VdGlsLmNhbmNlbEFuaW1GcmFtZSh0aGlzLl9hbmltSWQpO1xuXG5cdFx0dGhpcy5faW5Qcm9ncmVzcyA9IGZhbHNlO1xuXHRcdHRoaXMuZmlyZSgnZW5kJyk7XG5cdH0sXG5cblx0X2Vhc2VPdXQ6IGZ1bmN0aW9uICh0KSB7XG5cdFx0cmV0dXJuIDEgLSBNYXRoLnBvdygxIC0gdCwgdGhpcy5fZWFzZU91dFBvd2VyKTtcblx0fVxufSk7XG5cblxuLypcbiAqIEV4dGVuZHMgTC5NYXAgdG8gaGFuZGxlIHpvb20gYW5pbWF0aW9ucy5cbiAqL1xuXG5MLk1hcC5tZXJnZU9wdGlvbnMoe1xuXHR6b29tQW5pbWF0aW9uOiB0cnVlLFxuXHR6b29tQW5pbWF0aW9uVGhyZXNob2xkOiA0XG59KTtcblxuaWYgKEwuRG9tVXRpbC5UUkFOU0lUSU9OKSB7XG5cblx0TC5NYXAuYWRkSW5pdEhvb2soZnVuY3Rpb24gKCkge1xuXHRcdC8vIGRvbid0IGFuaW1hdGUgb24gYnJvd3NlcnMgd2l0aG91dCBoYXJkd2FyZS1hY2NlbGVyYXRlZCB0cmFuc2l0aW9ucyBvciBvbGQgQW5kcm9pZC9PcGVyYVxuXHRcdHRoaXMuX3pvb21BbmltYXRlZCA9IHRoaXMub3B0aW9ucy56b29tQW5pbWF0aW9uICYmIEwuRG9tVXRpbC5UUkFOU0lUSU9OICYmXG5cdFx0XHRcdEwuQnJvd3Nlci5hbnkzZCAmJiAhTC5Ccm93c2VyLmFuZHJvaWQyMyAmJiAhTC5Ccm93c2VyLm1vYmlsZU9wZXJhO1xuXG5cdFx0Ly8gem9vbSB0cmFuc2l0aW9ucyBydW4gd2l0aCB0aGUgc2FtZSBkdXJhdGlvbiBmb3IgYWxsIGxheWVycywgc28gaWYgb25lIG9mIHRyYW5zaXRpb25lbmQgZXZlbnRzXG5cdFx0Ly8gaGFwcGVucyBhZnRlciBzdGFydGluZyB6b29tIGFuaW1hdGlvbiAocHJvcGFnYXRpbmcgdG8gdGhlIG1hcCBwYW5lKSwgd2Uga25vdyB0aGF0IGl0IGVuZGVkIGdsb2JhbGx5XG5cdFx0aWYgKHRoaXMuX3pvb21BbmltYXRlZCkge1xuXHRcdFx0TC5Eb21FdmVudC5vbih0aGlzLl9tYXBQYW5lLCBMLkRvbVV0aWwuVFJBTlNJVElPTl9FTkQsIHRoaXMuX2NhdGNoVHJhbnNpdGlvbkVuZCwgdGhpcyk7XG5cdFx0fVxuXHR9KTtcbn1cblxuTC5NYXAuaW5jbHVkZSghTC5Eb21VdGlsLlRSQU5TSVRJT04gPyB7fSA6IHtcblxuXHRfY2F0Y2hUcmFuc2l0aW9uRW5kOiBmdW5jdGlvbiAoZSkge1xuXHRcdGlmICh0aGlzLl9hbmltYXRpbmdab29tICYmIGUucHJvcGVydHlOYW1lLmluZGV4T2YoJ3RyYW5zZm9ybScpID49IDApIHtcblx0XHRcdHRoaXMuX29uWm9vbVRyYW5zaXRpb25FbmQoKTtcblx0XHR9XG5cdH0sXG5cblx0X25vdGhpbmdUb0FuaW1hdGU6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gIXRoaXMuX2NvbnRhaW5lci5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdsZWFmbGV0LXpvb20tYW5pbWF0ZWQnKS5sZW5ndGg7XG5cdH0sXG5cblx0X3RyeUFuaW1hdGVkWm9vbTogZnVuY3Rpb24gKGNlbnRlciwgem9vbSwgb3B0aW9ucykge1xuXG5cdFx0aWYgKHRoaXMuX2FuaW1hdGluZ1pvb20pIHsgcmV0dXJuIHRydWU7IH1cblxuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG5cdFx0Ly8gZG9uJ3QgYW5pbWF0ZSBpZiBkaXNhYmxlZCwgbm90IHN1cHBvcnRlZCBvciB6b29tIGRpZmZlcmVuY2UgaXMgdG9vIGxhcmdlXG5cdFx0aWYgKCF0aGlzLl96b29tQW5pbWF0ZWQgfHwgb3B0aW9ucy5hbmltYXRlID09PSBmYWxzZSB8fCB0aGlzLl9ub3RoaW5nVG9BbmltYXRlKCkgfHxcblx0XHQgICAgICAgIE1hdGguYWJzKHpvb20gLSB0aGlzLl96b29tKSA+IHRoaXMub3B0aW9ucy56b29tQW5pbWF0aW9uVGhyZXNob2xkKSB7IHJldHVybiBmYWxzZTsgfVxuXG5cdFx0Ly8gb2Zmc2V0IGlzIHRoZSBwaXhlbCBjb29yZHMgb2YgdGhlIHpvb20gb3JpZ2luIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IGNlbnRlclxuXHRcdHZhciBzY2FsZSA9IHRoaXMuZ2V0Wm9vbVNjYWxlKHpvb20pLFxuXHRcdCAgICBvZmZzZXQgPSB0aGlzLl9nZXRDZW50ZXJPZmZzZXQoY2VudGVyKS5fZGl2aWRlQnkoMSAtIDEgLyBzY2FsZSksXG5cdFx0XHRvcmlnaW4gPSB0aGlzLl9nZXRDZW50ZXJMYXllclBvaW50KCkuX2FkZChvZmZzZXQpO1xuXG5cdFx0Ly8gZG9uJ3QgYW5pbWF0ZSBpZiB0aGUgem9vbSBvcmlnaW4gaXNuJ3Qgd2l0aGluIG9uZSBzY3JlZW4gZnJvbSB0aGUgY3VycmVudCBjZW50ZXIsIHVubGVzcyBmb3JjZWRcblx0XHRpZiAob3B0aW9ucy5hbmltYXRlICE9PSB0cnVlICYmICF0aGlzLmdldFNpemUoKS5jb250YWlucyhvZmZzZXQpKSB7IHJldHVybiBmYWxzZTsgfVxuXG5cdFx0dGhpc1xuXHRcdCAgICAuZmlyZSgnbW92ZXN0YXJ0Jylcblx0XHQgICAgLmZpcmUoJ3pvb21zdGFydCcpO1xuXG5cdFx0dGhpcy5fYW5pbWF0ZVpvb20oY2VudGVyLCB6b29tLCBvcmlnaW4sIHNjYWxlLCBudWxsLCB0cnVlKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9LFxuXG5cdF9hbmltYXRlWm9vbTogZnVuY3Rpb24gKGNlbnRlciwgem9vbSwgb3JpZ2luLCBzY2FsZSwgZGVsdGEsIGJhY2t3YXJkcywgZm9yVG91Y2hab29tKSB7XG5cblx0XHRpZiAoIWZvclRvdWNoWm9vbSkge1xuXHRcdFx0dGhpcy5fYW5pbWF0aW5nWm9vbSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gcHV0IHRyYW5zZm9ybSB0cmFuc2l0aW9uIG9uIGFsbCBsYXllcnMgd2l0aCBsZWFmbGV0LXpvb20tYW5pbWF0ZWQgY2xhc3Ncblx0XHRMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fbWFwUGFuZSwgJ2xlYWZsZXQtem9vbS1hbmltJyk7XG5cblx0XHQvLyByZW1lbWJlciB3aGF0IGNlbnRlci96b29tIHRvIHNldCBhZnRlciBhbmltYXRpb25cblx0XHR0aGlzLl9hbmltYXRlVG9DZW50ZXIgPSBjZW50ZXI7XG5cdFx0dGhpcy5fYW5pbWF0ZVRvWm9vbSA9IHpvb207XG5cblx0XHQvLyBkaXNhYmxlIGFueSBkcmFnZ2luZyBkdXJpbmcgYW5pbWF0aW9uXG5cdFx0aWYgKEwuRHJhZ2dhYmxlKSB7XG5cdFx0XHRMLkRyYWdnYWJsZS5fZGlzYWJsZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uICgpIHtcblx0XHRcdHRoaXMuZmlyZSgnem9vbWFuaW0nLCB7XG5cdFx0XHRcdGNlbnRlcjogY2VudGVyLFxuXHRcdFx0XHR6b29tOiB6b29tLFxuXHRcdFx0XHRvcmlnaW46IG9yaWdpbixcblx0XHRcdFx0c2NhbGU6IHNjYWxlLFxuXHRcdFx0XHRkZWx0YTogZGVsdGEsXG5cdFx0XHRcdGJhY2t3YXJkczogYmFja3dhcmRzXG5cdFx0XHR9KTtcblx0XHR9LCB0aGlzKTtcblx0fSxcblxuXHRfb25ab29tVHJhbnNpdGlvbkVuZDogZnVuY3Rpb24gKCkge1xuXG5cdFx0dGhpcy5fYW5pbWF0aW5nWm9vbSA9IGZhbHNlO1xuXG5cdFx0TC5Eb21VdGlsLnJlbW92ZUNsYXNzKHRoaXMuX21hcFBhbmUsICdsZWFmbGV0LXpvb20tYW5pbScpO1xuXG5cdFx0dGhpcy5fcmVzZXRWaWV3KHRoaXMuX2FuaW1hdGVUb0NlbnRlciwgdGhpcy5fYW5pbWF0ZVRvWm9vbSwgdHJ1ZSwgdHJ1ZSk7XG5cblx0XHRpZiAoTC5EcmFnZ2FibGUpIHtcblx0XHRcdEwuRHJhZ2dhYmxlLl9kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdH1cblx0fVxufSk7XG5cblxuLypcblx0Wm9vbSBhbmltYXRpb24gbG9naWMgZm9yIEwuVGlsZUxheWVyLlxuKi9cblxuTC5UaWxlTGF5ZXIuaW5jbHVkZSh7XG5cdF9hbmltYXRlWm9vbTogZnVuY3Rpb24gKGUpIHtcblx0XHRpZiAoIXRoaXMuX2FuaW1hdGluZykge1xuXHRcdFx0dGhpcy5fYW5pbWF0aW5nID0gdHJ1ZTtcblx0XHRcdHRoaXMuX3ByZXBhcmVCZ0J1ZmZlcigpO1xuXHRcdH1cblxuXHRcdHZhciBiZyA9IHRoaXMuX2JnQnVmZmVyLFxuXHRcdCAgICB0cmFuc2Zvcm0gPSBMLkRvbVV0aWwuVFJBTlNGT1JNLFxuXHRcdCAgICBpbml0aWFsVHJhbnNmb3JtID0gZS5kZWx0YSA/IEwuRG9tVXRpbC5nZXRUcmFuc2xhdGVTdHJpbmcoZS5kZWx0YSkgOiBiZy5zdHlsZVt0cmFuc2Zvcm1dLFxuXHRcdCAgICBzY2FsZVN0ciA9IEwuRG9tVXRpbC5nZXRTY2FsZVN0cmluZyhlLnNjYWxlLCBlLm9yaWdpbik7XG5cblx0XHRiZy5zdHlsZVt0cmFuc2Zvcm1dID0gZS5iYWNrd2FyZHMgP1xuXHRcdFx0XHRzY2FsZVN0ciArICcgJyArIGluaXRpYWxUcmFuc2Zvcm0gOlxuXHRcdFx0XHRpbml0aWFsVHJhbnNmb3JtICsgJyAnICsgc2NhbGVTdHI7XG5cdH0sXG5cblx0X2VuZFpvb21BbmltOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGZyb250ID0gdGhpcy5fdGlsZUNvbnRhaW5lcixcblx0XHQgICAgYmcgPSB0aGlzLl9iZ0J1ZmZlcjtcblxuXHRcdGZyb250LnN0eWxlLnZpc2liaWxpdHkgPSAnJztcblx0XHRmcm9udC5wYXJlbnROb2RlLmFwcGVuZENoaWxkKGZyb250KTsgLy8gQnJpbmcgdG8gZm9yZVxuXG5cdFx0Ly8gZm9yY2UgcmVmbG93XG5cdFx0TC5VdGlsLmZhbHNlRm4oYmcub2Zmc2V0V2lkdGgpO1xuXG5cdFx0dGhpcy5fYW5pbWF0aW5nID0gZmFsc2U7XG5cdH0sXG5cblx0X2NsZWFyQmdCdWZmZXI6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgbWFwID0gdGhpcy5fbWFwO1xuXG5cdFx0aWYgKG1hcCAmJiAhbWFwLl9hbmltYXRpbmdab29tICYmICFtYXAudG91Y2hab29tLl96b29taW5nKSB7XG5cdFx0XHR0aGlzLl9iZ0J1ZmZlci5pbm5lckhUTUwgPSAnJztcblx0XHRcdHRoaXMuX2JnQnVmZmVyLnN0eWxlW0wuRG9tVXRpbC5UUkFOU0ZPUk1dID0gJyc7XG5cdFx0fVxuXHR9LFxuXG5cdF9wcmVwYXJlQmdCdWZmZXI6IGZ1bmN0aW9uICgpIHtcblxuXHRcdHZhciBmcm9udCA9IHRoaXMuX3RpbGVDb250YWluZXIsXG5cdFx0ICAgIGJnID0gdGhpcy5fYmdCdWZmZXI7XG5cblx0XHQvLyBpZiBmb3JlZ3JvdW5kIGxheWVyIGRvZXNuJ3QgaGF2ZSBtYW55IHRpbGVzIGJ1dCBiZyBsYXllciBkb2VzLFxuXHRcdC8vIGtlZXAgdGhlIGV4aXN0aW5nIGJnIGxheWVyIGFuZCBqdXN0IHpvb20gaXQgc29tZSBtb3JlXG5cblx0XHR2YXIgYmdMb2FkZWQgPSB0aGlzLl9nZXRMb2FkZWRUaWxlc1BlcmNlbnRhZ2UoYmcpLFxuXHRcdCAgICBmcm9udExvYWRlZCA9IHRoaXMuX2dldExvYWRlZFRpbGVzUGVyY2VudGFnZShmcm9udCk7XG5cblx0XHRpZiAoYmcgJiYgYmdMb2FkZWQgPiAwLjUgJiYgZnJvbnRMb2FkZWQgPCAwLjUpIHtcblxuXHRcdFx0ZnJvbnQuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuXHRcdFx0dGhpcy5fc3RvcExvYWRpbmdJbWFnZXMoZnJvbnQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIHByZXBhcmUgdGhlIGJ1ZmZlciB0byBiZWNvbWUgdGhlIGZyb250IHRpbGUgcGFuZVxuXHRcdGJnLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcblx0XHRiZy5zdHlsZVtMLkRvbVV0aWwuVFJBTlNGT1JNXSA9ICcnO1xuXG5cdFx0Ly8gc3dpdGNoIG91dCB0aGUgY3VycmVudCBsYXllciB0byBiZSB0aGUgbmV3IGJnIGxheWVyIChhbmQgdmljZS12ZXJzYSlcblx0XHR0aGlzLl90aWxlQ29udGFpbmVyID0gYmc7XG5cdFx0YmcgPSB0aGlzLl9iZ0J1ZmZlciA9IGZyb250O1xuXG5cdFx0dGhpcy5fc3RvcExvYWRpbmdJbWFnZXMoYmcpO1xuXG5cdFx0Ly9wcmV2ZW50IGJnIGJ1ZmZlciBmcm9tIGNsZWFyaW5nIHJpZ2h0IGFmdGVyIHpvb21cblx0XHRjbGVhclRpbWVvdXQodGhpcy5fY2xlYXJCZ0J1ZmZlclRpbWVyKTtcblx0fSxcblxuXHRfZ2V0TG9hZGVkVGlsZXNQZXJjZW50YWdlOiBmdW5jdGlvbiAoY29udGFpbmVyKSB7XG5cdFx0dmFyIHRpbGVzID0gY29udGFpbmVyLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdpbWcnKSxcblx0XHQgICAgaSwgbGVuLCBjb3VudCA9IDA7XG5cblx0XHRmb3IgKGkgPSAwLCBsZW4gPSB0aWxlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0aWYgKHRpbGVzW2ldLmNvbXBsZXRlKSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBjb3VudCAvIGxlbjtcblx0fSxcblxuXHQvLyBzdG9wcyBsb2FkaW5nIGFsbCB0aWxlcyBpbiB0aGUgYmFja2dyb3VuZCBsYXllclxuXHRfc3RvcExvYWRpbmdJbWFnZXM6IGZ1bmN0aW9uIChjb250YWluZXIpIHtcblx0XHR2YXIgdGlsZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChjb250YWluZXIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2ltZycpKSxcblx0XHQgICAgaSwgbGVuLCB0aWxlO1xuXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gdGlsZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdHRpbGUgPSB0aWxlc1tpXTtcblxuXHRcdFx0aWYgKCF0aWxlLmNvbXBsZXRlKSB7XG5cdFx0XHRcdHRpbGUub25sb2FkID0gTC5VdGlsLmZhbHNlRm47XG5cdFx0XHRcdHRpbGUub25lcnJvciA9IEwuVXRpbC5mYWxzZUZuO1xuXHRcdFx0XHR0aWxlLnNyYyA9IEwuVXRpbC5lbXB0eUltYWdlVXJsO1xuXG5cdFx0XHRcdHRpbGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aWxlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5cbi8qXHJcbiAqIFByb3ZpZGVzIEwuTWFwIHdpdGggY29udmVuaWVudCBzaG9ydGN1dHMgZm9yIHVzaW5nIGJyb3dzZXIgZ2VvbG9jYXRpb24gZmVhdHVyZXMuXHJcbiAqL1xyXG5cclxuTC5NYXAuaW5jbHVkZSh7XHJcblx0X2RlZmF1bHRMb2NhdGVPcHRpb25zOiB7XHJcblx0XHR3YXRjaDogZmFsc2UsXHJcblx0XHRzZXRWaWV3OiBmYWxzZSxcclxuXHRcdG1heFpvb206IEluZmluaXR5LFxyXG5cdFx0dGltZW91dDogMTAwMDAsXHJcblx0XHRtYXhpbXVtQWdlOiAwLFxyXG5cdFx0ZW5hYmxlSGlnaEFjY3VyYWN5OiBmYWxzZVxyXG5cdH0sXHJcblxyXG5cdGxvY2F0ZTogZnVuY3Rpb24gKC8qT2JqZWN0Ki8gb3B0aW9ucykge1xyXG5cclxuXHRcdG9wdGlvbnMgPSB0aGlzLl9sb2NhdGVPcHRpb25zID0gTC5leHRlbmQodGhpcy5fZGVmYXVsdExvY2F0ZU9wdGlvbnMsIG9wdGlvbnMpO1xyXG5cclxuXHRcdGlmICghbmF2aWdhdG9yLmdlb2xvY2F0aW9uKSB7XHJcblx0XHRcdHRoaXMuX2hhbmRsZUdlb2xvY2F0aW9uRXJyb3Ioe1xyXG5cdFx0XHRcdGNvZGU6IDAsXHJcblx0XHRcdFx0bWVzc2FnZTogJ0dlb2xvY2F0aW9uIG5vdCBzdXBwb3J0ZWQuJ1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0cmV0dXJuIHRoaXM7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG9uUmVzcG9uc2UgPSBMLmJpbmQodGhpcy5faGFuZGxlR2VvbG9jYXRpb25SZXNwb25zZSwgdGhpcyksXHJcblx0XHRcdG9uRXJyb3IgPSBMLmJpbmQodGhpcy5faGFuZGxlR2VvbG9jYXRpb25FcnJvciwgdGhpcyk7XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMud2F0Y2gpIHtcclxuXHRcdFx0dGhpcy5fbG9jYXRpb25XYXRjaElkID1cclxuXHRcdFx0ICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24ud2F0Y2hQb3NpdGlvbihvblJlc3BvbnNlLCBvbkVycm9yLCBvcHRpb25zKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24ob25SZXNwb25zZSwgb25FcnJvciwgb3B0aW9ucyk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LFxyXG5cclxuXHRzdG9wTG9jYXRlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAobmF2aWdhdG9yLmdlb2xvY2F0aW9uKSB7XHJcblx0XHRcdG5hdmlnYXRvci5nZW9sb2NhdGlvbi5jbGVhcldhdGNoKHRoaXMuX2xvY2F0aW9uV2F0Y2hJZCk7XHJcblx0XHR9XHJcblx0XHRpZiAodGhpcy5fbG9jYXRlT3B0aW9ucykge1xyXG5cdFx0XHR0aGlzLl9sb2NhdGVPcHRpb25zLnNldFZpZXcgPSBmYWxzZTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH0sXHJcblxyXG5cdF9oYW5kbGVHZW9sb2NhdGlvbkVycm9yOiBmdW5jdGlvbiAoZXJyb3IpIHtcclxuXHRcdHZhciBjID0gZXJyb3IuY29kZSxcclxuXHRcdCAgICBtZXNzYWdlID0gZXJyb3IubWVzc2FnZSB8fFxyXG5cdFx0ICAgICAgICAgICAgKGMgPT09IDEgPyAncGVybWlzc2lvbiBkZW5pZWQnIDpcclxuXHRcdCAgICAgICAgICAgIChjID09PSAyID8gJ3Bvc2l0aW9uIHVuYXZhaWxhYmxlJyA6ICd0aW1lb3V0JykpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9sb2NhdGVPcHRpb25zLnNldFZpZXcgJiYgIXRoaXMuX2xvYWRlZCkge1xyXG5cdFx0XHR0aGlzLmZpdFdvcmxkKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5maXJlKCdsb2NhdGlvbmVycm9yJywge1xyXG5cdFx0XHRjb2RlOiBjLFxyXG5cdFx0XHRtZXNzYWdlOiAnR2VvbG9jYXRpb24gZXJyb3I6ICcgKyBtZXNzYWdlICsgJy4nXHJcblx0XHR9KTtcclxuXHR9LFxyXG5cclxuXHRfaGFuZGxlR2VvbG9jYXRpb25SZXNwb25zZTogZnVuY3Rpb24gKHBvcykge1xyXG5cdFx0dmFyIGxhdCA9IHBvcy5jb29yZHMubGF0aXR1ZGUsXHJcblx0XHQgICAgbG5nID0gcG9zLmNvb3Jkcy5sb25naXR1ZGUsXHJcblx0XHQgICAgbGF0bG5nID0gbmV3IEwuTGF0TG5nKGxhdCwgbG5nKSxcclxuXHJcblx0XHQgICAgbGF0QWNjdXJhY3kgPSAxODAgKiBwb3MuY29vcmRzLmFjY3VyYWN5IC8gNDAwNzUwMTcsXHJcblx0XHQgICAgbG5nQWNjdXJhY3kgPSBsYXRBY2N1cmFjeSAvIE1hdGguY29zKEwuTGF0TG5nLkRFR19UT19SQUQgKiBsYXQpLFxyXG5cclxuXHRcdCAgICBib3VuZHMgPSBMLmxhdExuZ0JvdW5kcyhcclxuXHRcdCAgICAgICAgICAgIFtsYXQgLSBsYXRBY2N1cmFjeSwgbG5nIC0gbG5nQWNjdXJhY3ldLFxyXG5cdFx0ICAgICAgICAgICAgW2xhdCArIGxhdEFjY3VyYWN5LCBsbmcgKyBsbmdBY2N1cmFjeV0pLFxyXG5cclxuXHRcdCAgICBvcHRpb25zID0gdGhpcy5fbG9jYXRlT3B0aW9ucztcclxuXHJcblx0XHRpZiAob3B0aW9ucy5zZXRWaWV3KSB7XHJcblx0XHRcdHZhciB6b29tID0gTWF0aC5taW4odGhpcy5nZXRCb3VuZHNab29tKGJvdW5kcyksIG9wdGlvbnMubWF4Wm9vbSk7XHJcblx0XHRcdHRoaXMuc2V0VmlldyhsYXRsbmcsIHpvb20pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBkYXRhID0ge1xyXG5cdFx0XHRsYXRsbmc6IGxhdGxuZyxcclxuXHRcdFx0Ym91bmRzOiBib3VuZHMsXHJcblx0XHRcdHRpbWVzdGFtcDogcG9zLnRpbWVzdGFtcFxyXG5cdFx0fTtcclxuXHJcblx0XHRmb3IgKHZhciBpIGluIHBvcy5jb29yZHMpIHtcclxuXHRcdFx0aWYgKHR5cGVvZiBwb3MuY29vcmRzW2ldID09PSAnbnVtYmVyJykge1xyXG5cdFx0XHRcdGRhdGFbaV0gPSBwb3MuY29vcmRzW2ldO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5maXJlKCdsb2NhdGlvbmZvdW5kJywgZGF0YSk7XHJcblx0fVxyXG59KTtcclxuXG5cbn0od2luZG93LCBkb2N1bWVudCkpOyIsIihmdW5jdGlvbiAoQnVmZmVyKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gUHJvdG9idWY7XG5mdW5jdGlvbiBQcm90b2J1ZihidWYpIHtcbiAgICB0aGlzLmJ1ZiA9IGJ1ZjtcbiAgICB0aGlzLnBvcyA9IDA7XG59XG5cblByb3RvYnVmLnByb3RvdHlwZSA9IHtcbiAgICBnZXQgbGVuZ3RoKCkgeyByZXR1cm4gdGhpcy5idWYubGVuZ3RoOyB9XG59O1xuXG5Qcm90b2J1Zi5WYXJpbnQgPSAwO1xuUHJvdG9idWYuSW50NjQgPSAxO1xuUHJvdG9idWYuTWVzc2FnZSA9IDI7XG5Qcm90b2J1Zi5TdHJpbmcgPSAyO1xuUHJvdG9idWYuUGFja2VkID0gMjtcblByb3RvYnVmLkludDMyID0gNTtcblxuUHJvdG9idWYucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmJ1ZiA9IG51bGw7XG59O1xuXG4vLyA9PT0gUkVBRElORyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFVJbnQzMiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2YWwgPSB0aGlzLmJ1Zi5yZWFkVUludDMyTEUodGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDQ7XG4gICAgcmV0dXJuIHZhbDtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkVUludDY0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHZhbCA9IHRoaXMuYnVmLnJlYWRVSW50NjRMRSh0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gODtcbiAgICByZXR1cm4gdmFsO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWREb3VibGUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmFsID0gaWVlZTc1NC5yZWFkKHRoaXMuYnVmLCB0aGlzLnBvcywgdHJ1ZSwgNTIsIDgpO1xuICAgIHRoaXMucG9zICs9IDg7XG4gICAgcmV0dXJuIHZhbDtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkVmFyaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgLy8gVE9ETzogYm91bmRzIGNoZWNraW5nXG4gICAgdmFyIHBvcyA9IHRoaXMucG9zO1xuICAgIGlmICh0aGlzLmJ1Zltwb3NdIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5wb3MrKztcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVmW3Bvc107XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ1Zltwb3MgKyAxXSA8PSAweDdmKSB7XG4gICAgICAgIHRoaXMucG9zICs9IDI7XG4gICAgICAgIHJldHVybiAodGhpcy5idWZbcG9zXSAmIDB4N2YpIHwgKHRoaXMuYnVmW3BvcyArIDFdIDw8IDcpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5idWZbcG9zICsgMl0gPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnBvcyArPSAzO1xuICAgICAgICByZXR1cm4gKHRoaXMuYnVmW3Bvc10gJiAweDdmKSB8ICh0aGlzLmJ1Zltwb3MgKyAxXSAmIDB4N2YpIDw8IDcgfCAodGhpcy5idWZbcG9zICsgMl0pIDw8IDE0O1xuICAgIH0gZWxzZSBpZiAodGhpcy5idWZbcG9zICsgM10gPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnBvcyArPSA0O1xuICAgICAgICByZXR1cm4gKHRoaXMuYnVmW3Bvc10gJiAweDdmKSB8ICh0aGlzLmJ1Zltwb3MgKyAxXSAmIDB4N2YpIDw8IDcgfCAodGhpcy5idWZbcG9zICsgMl0gJiAweDdmKSA8PCAxNCB8ICh0aGlzLmJ1Zltwb3MgKyAzXSkgPDwgMjE7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ1Zltwb3MgKyA0XSA8PSAweDdmKSB7XG4gICAgICAgIHRoaXMucG9zICs9IDU7XG4gICAgICAgIHJldHVybiAoKHRoaXMuYnVmW3Bvc10gJiAweDdmKSB8ICh0aGlzLmJ1Zltwb3MgKyAxXSAmIDB4N2YpIDw8IDcgfCAodGhpcy5idWZbcG9zICsgMl0gJiAweDdmKSA8PCAxNCB8ICh0aGlzLmJ1Zltwb3MgKyAzXSkgPDwgMjEpICsgKHRoaXMuYnVmW3BvcyArIDRdICogMjY4NDM1NDU2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNraXAoUHJvdG9idWYuVmFyaW50KTtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIC8vIHRocm93IG5ldyBFcnJvcihcIlRPRE86IEhhbmRsZSA2KyBieXRlIHZhcmludHNcIik7XG4gICAgfVxufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRTVmFyaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG51bSA9IHRoaXMucmVhZFZhcmludCgpO1xuICAgIGlmIChudW0gPiAyMTQ3NDgzNjQ3KSB0aHJvdyBuZXcgRXJyb3IoJ1RPRE86IEhhbmRsZSBudW1iZXJzID49IDJeMzAnKTtcbiAgICAvLyB6aWd6YWcgZW5jb2RpbmdcbiAgICByZXR1cm4gKChudW0gPj4gMSkgXiAtKG51bSAmIDEpKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJ5dGVzID0gdGhpcy5yZWFkVmFyaW50KCk7XG4gICAgLy8gVE9ETzogYm91bmRzIGNoZWNraW5nXG4gICAgdmFyIGNociA9IFN0cmluZy5mcm9tQ2hhckNvZGU7XG4gICAgdmFyIGIgPSB0aGlzLmJ1ZjtcbiAgICB2YXIgcCA9IHRoaXMucG9zO1xuICAgIHZhciBlbmQgPSB0aGlzLnBvcyArIGJ5dGVzO1xuICAgIHZhciBzdHIgPSAnJztcbiAgICB3aGlsZSAocCA8IGVuZCkge1xuICAgICAgICBpZiAoYltwXSA8PSAweDdGKSBzdHIgKz0gY2hyKGJbcCsrXSk7XG4gICAgICAgIGVsc2UgaWYgKGJbcF0gPD0gMHhCRikgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFVURi04IGNvZGVwb2ludDogJyArIGJbcF0pO1xuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4REYpIHN0ciArPSBjaHIoKGJbcCsrXSAmIDB4MUYpIDw8IDYgfCAoYltwKytdICYgMHgzRikpO1xuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4RUYpIHN0ciArPSBjaHIoKGJbcCsrXSAmIDB4MUYpIDw8IDEyIHwgKGJbcCsrXSAmIDB4M0YpIDw8IDYgfCAoYltwKytdICYgMHgzRikpO1xuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4RjcpIHAgKz0gNDsgLy8gV2UgY2FuJ3QgaGFuZGxlIHRoZXNlIGNvZGVwb2ludHMgaW4gSlMsIHNvIHNraXAuXG4gICAgICAgIGVsc2UgaWYgKGJbcF0gPD0gMHhGQikgcCArPSA1O1xuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4RkQpIHAgKz0gNjtcbiAgICAgICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgVVRGLTggY29kZXBvaW50OiAnICsgYltwXSk7XG4gICAgfVxuICAgIHRoaXMucG9zICs9IGJ5dGVzO1xuICAgIHJldHVybiBzdHI7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZEJ1ZmZlciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBieXRlcyA9IHRoaXMucmVhZFZhcmludCgpO1xuICAgIHZhciBidWZmZXIgPSB0aGlzLmJ1Zi5zdWJhcnJheSh0aGlzLnBvcywgdGhpcy5wb3MgKyBieXRlcyk7XG4gICAgdGhpcy5wb3MgKz0gYnl0ZXM7XG4gICAgcmV0dXJuIGJ1ZmZlcjtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkUGFja2VkID0gZnVuY3Rpb24odHlwZSkge1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciBieXRlcyA9IHRoaXMucmVhZFZhcmludCgpO1xuICAgIHZhciBlbmQgPSB0aGlzLnBvcyArIGJ5dGVzO1xuICAgIHZhciBhcnJheSA9IFtdO1xuICAgIHdoaWxlICh0aGlzLnBvcyA8IGVuZCkge1xuICAgICAgICBhcnJheS5wdXNoKHRoaXNbJ3JlYWQnICsgdHlwZV0oKSk7XG4gICAgfVxuICAgIHJldHVybiBhcnJheTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5za2lwID0gZnVuY3Rpb24odmFsKSB7XG4gICAgLy8gVE9ETzogYm91bmRzIGNoZWNraW5nXG4gICAgdmFyIHR5cGUgPSB2YWwgJiAweDc7XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIC8qIHZhcmludCAqLyBjYXNlIFByb3RvYnVmLlZhcmludDogd2hpbGUgKHRoaXMuYnVmW3RoaXMucG9zKytdID4gMHg3Zik7IGJyZWFrO1xuICAgICAgICAvKiA2NCBiaXQgKi8gY2FzZSBQcm90b2J1Zi5JbnQ2NDogdGhpcy5wb3MgKz0gODsgYnJlYWs7XG4gICAgICAgIC8qIGxlbmd0aCAqLyBjYXNlIFByb3RvYnVmLk1lc3NhZ2U6IHZhciBieXRlcyA9IHRoaXMucmVhZFZhcmludCgpOyB0aGlzLnBvcyArPSBieXRlczsgYnJlYWs7XG4gICAgICAgIC8qIDMyIGJpdCAqLyBjYXNlIFByb3RvYnVmLkludDMyOiB0aGlzLnBvcyArPSA0OyBicmVhaztcbiAgICAgICAgZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKCdVbmltcGxlbWVudGVkIHR5cGU6ICcgKyB0eXBlKTtcbiAgICB9XG59O1xuXG4vLyA9PT0gV1JJVElORyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWcgPSBmdW5jdGlvbih0YWcsIHR5cGUpIHtcbiAgICB0aGlzLndyaXRlVmFyaW50KCh0YWcgPDwgMykgfCB0eXBlKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFsbG9jID0gZnVuY3Rpb24obWluKSB7XG4gICAgdmFyIGxlbmd0aCA9IHRoaXMuYnVmLmxlbmd0aDtcbiAgICB3aGlsZSAobGVuZ3RoIDwgdGhpcy5wb3MgKyBtaW4pIGxlbmd0aCAqPSAyO1xuICAgIGlmIChsZW5ndGggIT0gdGhpcy5idWYubGVuZ3RoKSB7XG4gICAgICAgIHZhciBidWYgPSBuZXcgQnVmZmVyKGxlbmd0aCk7XG4gICAgICAgIHRoaXMuYnVmLmNvcHkoYnVmKTtcbiAgICAgICAgdGhpcy5idWYgPSBidWY7XG4gICAgfVxufTtcblxuUHJvdG9idWYucHJvdG90eXBlLmZpbmlzaCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmJ1Zi5zbGljZSgwLCB0aGlzLnBvcyk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVQYWNrZWQgPSBmdW5jdGlvbih0eXBlLCB0YWcsIGl0ZW1zKSB7XG4gICAgaWYgKCFpdGVtcy5sZW5ndGgpIHJldHVybjtcblxuICAgIHZhciBtZXNzYWdlID0gbmV3IFByb3RvYnVmKCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBtZXNzYWdlWyd3cml0ZScgKyB0eXBlXShpdGVtc1tpXSk7XG4gICAgfVxuICAgIHZhciBkYXRhID0gbWVzc2FnZS5maW5pc2goKTtcblxuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5QYWNrZWQpO1xuICAgIHRoaXMud3JpdGVCdWZmZXIoZGF0YSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVVSW50MzIgPSBmdW5jdGlvbih2YWwpIHtcbiAgICB0aGlzLnJlYWxsb2MoNCk7XG4gICAgdGhpcy5idWYud3JpdGVVSW50MzJMRSh2YWwsIHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSA0O1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkVUludDMyID0gZnVuY3Rpb24odGFnLCB2YWwpIHtcbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuSW50MzIpO1xuICAgIHRoaXMud3JpdGVVSW50MzIodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVZhcmludCA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIHZhbCA9IE51bWJlcih2YWwpO1xuICAgIGlmIChpc05hTih2YWwpKSB7XG4gICAgICAgIHZhbCA9IDA7XG4gICAgfVxuXG4gICAgaWYgKHZhbCA8PSAweDdmKSB7XG4gICAgICAgIHRoaXMucmVhbGxvYygxKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSB2YWw7XG4gICAgfSBlbHNlIGlmICh2YWwgPD0gMHgzZmZmKSB7XG4gICAgICAgIHRoaXMucmVhbGxvYygyKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDApICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHgwMCB8ICgodmFsID4+PiA3KSAmIDB4N2YpO1xuICAgIH0gZWxzZSBpZiAodmFsIDw9IDB4MWZmZmZmZikge1xuICAgICAgICB0aGlzLnJlYWxsb2MoMyk7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiAwKSAmIDB4N2YpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gNykgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDAwIHwgKCh2YWwgPj4+IDE0KSAmIDB4N2YpO1xuICAgIH0gZWxzZSBpZiAodmFsIDw9IDB4ZmZmZmZmZikge1xuICAgICAgICB0aGlzLnJlYWxsb2MoNCk7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiAwKSAmIDB4N2YpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gNykgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDE0KSAmIDB4N2YpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4MDAgfCAoKHZhbCA+Pj4gMjEpICYgMHg3Zik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgd2hpbGUgKHZhbCA+IDApIHtcbiAgICAgICAgICAgIHZhciBiID0gdmFsICYgMHg3ZjtcbiAgICAgICAgICAgIHZhbCA9IE1hdGguZmxvb3IodmFsIC8gMTI4KTtcbiAgICAgICAgICAgIGlmICh2YWwgPiAwKSBiIHw9IDB4ODBcbiAgICAgICAgICAgIHRoaXMucmVhbGxvYygxKTtcbiAgICAgICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gYjtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZFZhcmludCA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLlZhcmludCk7XG4gICAgdGhpcy53cml0ZVZhcmludCh2YWwpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlU1ZhcmludCA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIGlmICh2YWwgPj0gMCkge1xuICAgICAgICB0aGlzLndyaXRlVmFyaW50KHZhbCAqIDIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMud3JpdGVWYXJpbnQodmFsICogLTIgLSAxKTtcbiAgICB9XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRTVmFyaW50ID0gZnVuY3Rpb24odGFnLCB2YWwpIHtcbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuVmFyaW50KTtcbiAgICB0aGlzLndyaXRlU1ZhcmludCh2YWwpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlQm9vbGVhbiA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIHRoaXMud3JpdGVWYXJpbnQoQm9vbGVhbih2YWwpKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZEJvb2xlYW4gPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWdnZWRWYXJpbnQodGFnLCBCb29sZWFuKHZhbCkpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlU3RyaW5nID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgc3RyID0gU3RyaW5nKHN0cik7XG4gICAgdmFyIGJ5dGVzID0gQnVmZmVyLmJ5dGVMZW5ndGgoc3RyKTtcbiAgICB0aGlzLndyaXRlVmFyaW50KGJ5dGVzKTtcbiAgICB0aGlzLnJlYWxsb2MoYnl0ZXMpO1xuICAgIHRoaXMuYnVmLndyaXRlKHN0ciwgdGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IGJ5dGVzO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkU3RyaW5nID0gZnVuY3Rpb24odGFnLCBzdHIpIHtcbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuU3RyaW5nKTtcbiAgICB0aGlzLndyaXRlU3RyaW5nKHN0cik7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVGbG9hdCA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIHRoaXMucmVhbGxvYyg0KTtcbiAgICB0aGlzLmJ1Zi53cml0ZUZsb2F0TEUodmFsLCB0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gNDtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZEZsb2F0ID0gZnVuY3Rpb24odGFnLCB2YWwpIHtcbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuSW50MzIpO1xuICAgIHRoaXMud3JpdGVGbG9hdCh2YWwpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlRG91YmxlID0gZnVuY3Rpb24odmFsKSB7XG4gICAgdGhpcy5yZWFsbG9jKDgpO1xuICAgIHRoaXMuYnVmLndyaXRlRG91YmxlTEUodmFsLCB0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gODtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZERvdWJsZSA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLkludDY0KTtcbiAgICB0aGlzLndyaXRlRG91YmxlKHZhbCk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIpIHtcbiAgICB2YXIgYnl0ZXMgPSBidWZmZXIubGVuZ3RoO1xuICAgIHRoaXMud3JpdGVWYXJpbnQoYnl0ZXMpO1xuICAgIHRoaXMucmVhbGxvYyhieXRlcyk7XG4gICAgYnVmZmVyLmNvcHkodGhpcy5idWYsIHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSBieXRlcztcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZEJ1ZmZlciA9IGZ1bmN0aW9uKHRhZywgYnVmZmVyKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLlN0cmluZyk7XG4gICAgdGhpcy53cml0ZUJ1ZmZlcihidWZmZXIpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlTWVzc2FnZSA9IGZ1bmN0aW9uKHRhZywgcHJvdG9idWYpIHtcbiAgICB2YXIgYnVmZmVyID0gcHJvdG9idWYuZmluaXNoKCk7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLk1lc3NhZ2UpO1xuICAgIHRoaXMud3JpdGVCdWZmZXIoYnVmZmVyKTtcbn07XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcikiLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbihidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIG5CaXRzID0gLTcsXG4gICAgICBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDAsXG4gICAgICBkID0gaXNMRSA/IC0xIDogMSxcbiAgICAgIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV07XG5cbiAgaSArPSBkO1xuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpO1xuICBzID4+PSAoLW5CaXRzKTtcbiAgbkJpdHMgKz0gZUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIGUgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBtTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXM7XG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KTtcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pO1xuICAgIGUgPSBlIC0gZUJpYXM7XG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbik7XG59O1xuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGMsXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApLFxuICAgICAgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpLFxuICAgICAgZCA9IGlzTEUgPyAxIDogLTEsXG4gICAgICBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwO1xuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpO1xuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwO1xuICAgIGUgPSBlTWF4O1xuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKTtcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS07XG4gICAgICBjICo9IDI7XG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcyk7XG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrO1xuICAgICAgYyAvPSAyO1xuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDA7XG4gICAgICBlID0gZU1heDtcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gZSArIGVCaWFzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gMDtcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KTtcblxuICBlID0gKGUgPDwgbUxlbikgfCBtO1xuICBlTGVuICs9IG1MZW47XG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCk7XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBQb2ludDtcblxuZnVuY3Rpb24gUG9pbnQoeCwgeSkge1xuICAgIHRoaXMueCA9IHg7XG4gICAgdGhpcy55ID0geTtcbn1cblxuUG9pbnQucHJvdG90eXBlID0ge1xuICAgIGNsb25lOiBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBQb2ludCh0aGlzLngsIHRoaXMueSk7IH0sXG5cbiAgICBhZGQ6ICAgICBmdW5jdGlvbihwKSB7IHJldHVybiB0aGlzLmNsb25lKCkuX2FkZChwKTsgICAgIH0sXG4gICAgc3ViOiAgICAgZnVuY3Rpb24ocCkgeyByZXR1cm4gdGhpcy5jbG9uZSgpLl9zdWIocCk7ICAgICB9LFxuICAgIG11bHQ6ICAgIGZ1bmN0aW9uKGspIHsgcmV0dXJuIHRoaXMuY2xvbmUoKS5fbXVsdChrKTsgICAgfSxcbiAgICBkaXY6ICAgICBmdW5jdGlvbihrKSB7IHJldHVybiB0aGlzLmNsb25lKCkuX2RpdihrKTsgICAgIH0sXG4gICAgcm90YXRlOiAgZnVuY3Rpb24oYSkgeyByZXR1cm4gdGhpcy5jbG9uZSgpLl9yb3RhdGUoYSk7ICB9LFxuICAgIG1hdE11bHQ6IGZ1bmN0aW9uKG0pIHsgcmV0dXJuIHRoaXMuY2xvbmUoKS5fbWF0TXVsdChtKTsgfSxcbiAgICB1bml0OiAgICBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuY2xvbmUoKS5fdW5pdCgpOyB9LFxuICAgIHBlcnA6ICAgIGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5jbG9uZSgpLl9wZXJwKCk7IH0sXG4gICAgcm91bmQ6ICAgZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmNsb25lKCkuX3JvdW5kKCk7IH0sXG5cbiAgICBtYWc6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSk7XG4gICAgfSxcblxuICAgIGVxdWFsczogZnVuY3Rpb24ocCkge1xuICAgICAgICByZXR1cm4gdGhpcy54ID09PSBwLnggJiZcbiAgICAgICAgICAgICAgIHRoaXMueSA9PT0gcC55O1xuICAgIH0sXG5cbiAgICBkaXN0OiBmdW5jdGlvbihwKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy5kaXN0U3FyKHApKTtcbiAgICB9LFxuXG4gICAgZGlzdFNxcjogZnVuY3Rpb24ocCkge1xuICAgICAgICB2YXIgZHggPSBwLnggLSB0aGlzLngsXG4gICAgICAgICAgICBkeSA9IHAueSAtIHRoaXMueTtcbiAgICAgICAgcmV0dXJuIGR4ICogZHggKyBkeSAqIGR5O1xuICAgIH0sXG5cbiAgICBhbmdsZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmF0YW4yKHRoaXMueSwgdGhpcy54KTtcbiAgICB9LFxuXG4gICAgYW5nbGVUbzogZnVuY3Rpb24oYikge1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMih0aGlzLnkgLSBiLnksIHRoaXMueCAtIGIueCk7XG4gICAgfSxcblxuICAgIGFuZ2xlV2l0aDogZnVuY3Rpb24oYikge1xuICAgICAgICByZXR1cm4gdGhpcy5hbmdsZVdpdGhTZXAoYi54LCBiLnkpO1xuICAgIH0sXG5cbiAgICAvLyBGaW5kIHRoZSBhbmdsZSBvZiB0aGUgdHdvIHZlY3RvcnMsIHNvbHZpbmcgdGhlIGZvcm11bGEgZm9yIHRoZSBjcm9zcyBwcm9kdWN0IGEgeCBiID0gfGF8fGJ8c2luKM64KSBmb3IgzrguXG4gICAgYW5nbGVXaXRoU2VwOiBmdW5jdGlvbih4LCB5KSB7XG4gICAgICAgIHJldHVybiBNYXRoLmF0YW4yKFxuICAgICAgICAgICAgdGhpcy54ICogeSAtIHRoaXMueSAqIHgsXG4gICAgICAgICAgICB0aGlzLnggKiB4ICsgdGhpcy55ICogeSk7XG4gICAgfSxcblxuICAgIF9tYXRNdWx0OiBmdW5jdGlvbihtKSB7XG4gICAgICAgIHZhciB4ID0gbVswXSAqIHRoaXMueCArIG1bMV0gKiB0aGlzLnksXG4gICAgICAgICAgICB5ID0gbVsyXSAqIHRoaXMueCArIG1bM10gKiB0aGlzLnk7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfYWRkOiBmdW5jdGlvbihwKSB7XG4gICAgICAgIHRoaXMueCArPSBwLng7XG4gICAgICAgIHRoaXMueSArPSBwLnk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfc3ViOiBmdW5jdGlvbihwKSB7XG4gICAgICAgIHRoaXMueCAtPSBwLng7XG4gICAgICAgIHRoaXMueSAtPSBwLnk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfbXVsdDogZnVuY3Rpb24oaykge1xuICAgICAgICB0aGlzLnggKj0gaztcbiAgICAgICAgdGhpcy55ICo9IGs7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfZGl2OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHRoaXMueCAvPSBrO1xuICAgICAgICB0aGlzLnkgLz0gaztcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIF91bml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5fZGl2KHRoaXMubWFnKCkpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgX3BlcnA6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgeSA9IHRoaXMueTtcbiAgICAgICAgdGhpcy55ID0gdGhpcy54O1xuICAgICAgICB0aGlzLnggPSAteTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIF9yb3RhdGU6IGZ1bmN0aW9uKGFuZ2xlKSB7XG4gICAgICAgIHZhciBjb3MgPSBNYXRoLmNvcyhhbmdsZSksXG4gICAgICAgICAgICBzaW4gPSBNYXRoLnNpbihhbmdsZSksXG4gICAgICAgICAgICB4ID0gY29zICogdGhpcy54IC0gc2luICogdGhpcy55LFxuICAgICAgICAgICAgeSA9IHNpbiAqIHRoaXMueCArIGNvcyAqIHRoaXMueTtcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIF9yb3VuZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMueCA9IE1hdGgucm91bmQodGhpcy54KTtcbiAgICAgICAgdGhpcy55ID0gTWF0aC5yb3VuZCh0aGlzLnkpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG4vLyBjb25zdHJ1Y3RzIFBvaW50IGZyb20gYW4gYXJyYXkgaWYgbmVjZXNzYXJ5XG5Qb2ludC5jb252ZXJ0ID0gZnVuY3Rpb24gKGEpIHtcbiAgICBpZiAoYSBpbnN0YW5jZW9mIFBvaW50KSB7XG4gICAgICAgIHJldHVybiBhO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KGFbMF0sIGFbMV0pO1xuICAgIH1cbiAgICByZXR1cm4gYTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cy5WZWN0b3JUaWxlID0gcmVxdWlyZSgnLi9saWIvdmVjdG9ydGlsZS5qcycpO1xubW9kdWxlLmV4cG9ydHMuVmVjdG9yVGlsZUZlYXR1cmUgPSByZXF1aXJlKCcuL2xpYi92ZWN0b3J0aWxlZmVhdHVyZS5qcycpO1xubW9kdWxlLmV4cG9ydHMuVmVjdG9yVGlsZUxheWVyID0gcmVxdWlyZSgnLi9saWIvdmVjdG9ydGlsZWxheWVyLmpzJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBWZWN0b3JUaWxlTGF5ZXIgPSByZXF1aXJlKCcuL3ZlY3RvcnRpbGVsYXllcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZlY3RvclRpbGU7XG5cbmZ1bmN0aW9uIFZlY3RvclRpbGUoYnVmZmVyLCBlbmQpIHtcblxuICAgIHRoaXMubGF5ZXJzID0ge307XG4gICAgdGhpcy5fYnVmZmVyID0gYnVmZmVyO1xuXG4gICAgZW5kID0gZW5kIHx8IGJ1ZmZlci5sZW5ndGg7XG5cbiAgICB3aGlsZSAoYnVmZmVyLnBvcyA8IGVuZCkge1xuICAgICAgICB2YXIgdmFsID0gYnVmZmVyLnJlYWRWYXJpbnQoKSxcbiAgICAgICAgICAgIHRhZyA9IHZhbCA+PiAzO1xuXG4gICAgICAgIGlmICh0YWcgPT0gMykge1xuICAgICAgICAgICAgdmFyIGxheWVyID0gdGhpcy5yZWFkTGF5ZXIoKTtcbiAgICAgICAgICAgIGlmIChsYXllci5sZW5ndGgpIHRoaXMubGF5ZXJzW2xheWVyLm5hbWVdID0gbGF5ZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBidWZmZXIuc2tpcCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5WZWN0b3JUaWxlLnByb3RvdHlwZS5yZWFkTGF5ZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYnVmZmVyID0gdGhpcy5fYnVmZmVyLFxuICAgICAgICBieXRlcyA9IGJ1ZmZlci5yZWFkVmFyaW50KCksXG4gICAgICAgIGVuZCA9IGJ1ZmZlci5wb3MgKyBieXRlcyxcbiAgICAgICAgbGF5ZXIgPSBuZXcgVmVjdG9yVGlsZUxheWVyKGJ1ZmZlciwgZW5kKTtcblxuICAgIGJ1ZmZlci5wb3MgPSBlbmQ7XG5cbiAgICByZXR1cm4gbGF5ZXI7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgUG9pbnQgPSByZXF1aXJlKCdwb2ludC1nZW9tZXRyeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZlY3RvclRpbGVGZWF0dXJlO1xuXG5mdW5jdGlvbiBWZWN0b3JUaWxlRmVhdHVyZShidWZmZXIsIGVuZCwgZXh0ZW50LCBrZXlzLCB2YWx1ZXMpIHtcblxuICAgIHRoaXMucHJvcGVydGllcyA9IHt9O1xuXG4gICAgLy8gUHVibGljXG4gICAgdGhpcy5leHRlbnQgPSBleHRlbnQ7XG4gICAgdGhpcy50eXBlID0gMDtcblxuICAgIC8vIFByaXZhdGVcbiAgICB0aGlzLl9idWZmZXIgPSBidWZmZXI7XG4gICAgdGhpcy5fZ2VvbWV0cnkgPSAtMTtcblxuICAgIGVuZCA9IGVuZCB8fCBidWZmZXIubGVuZ3RoO1xuXG4gICAgd2hpbGUgKGJ1ZmZlci5wb3MgPCBlbmQpIHtcbiAgICAgICAgdmFyIHZhbCA9IGJ1ZmZlci5yZWFkVmFyaW50KCksXG4gICAgICAgICAgICB0YWcgPSB2YWwgPj4gMztcblxuICAgICAgICBpZiAodGFnID09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2lkID0gYnVmZmVyLnJlYWRWYXJpbnQoKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSAyKSB7XG4gICAgICAgICAgICB2YXIgdGFnRW5kID0gYnVmZmVyLnBvcyArIGJ1ZmZlci5yZWFkVmFyaW50KCk7XG5cbiAgICAgICAgICAgIHdoaWxlIChidWZmZXIucG9zIDwgdGFnRW5kKSB7XG4gICAgICAgICAgICAgICAgdmFyIGtleSA9IGtleXNbYnVmZmVyLnJlYWRWYXJpbnQoKV07XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gdmFsdWVzW2J1ZmZlci5yZWFkVmFyaW50KCldO1xuICAgICAgICAgICAgICAgIHRoaXMucHJvcGVydGllc1trZXldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT0gMykge1xuICAgICAgICAgICAgdGhpcy50eXBlID0gYnVmZmVyLnJlYWRWYXJpbnQoKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSA0KSB7XG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeSA9IGJ1ZmZlci5wb3M7XG4gICAgICAgICAgICBidWZmZXIuc2tpcCh2YWwpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBidWZmZXIuc2tpcCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5WZWN0b3JUaWxlRmVhdHVyZS50eXBlcyA9IFsnVW5rbm93bicsICdQb2ludCcsICdMaW5lU3RyaW5nJywgJ1BvbHlnb24nXTtcblxuVmVjdG9yVGlsZUZlYXR1cmUucHJvdG90eXBlLmxvYWRHZW9tZXRyeSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBidWZmZXIgPSB0aGlzLl9idWZmZXI7XG4gICAgYnVmZmVyLnBvcyA9IHRoaXMuX2dlb21ldHJ5O1xuXG4gICAgdmFyIGJ5dGVzID0gYnVmZmVyLnJlYWRWYXJpbnQoKSxcbiAgICAgICAgZW5kID0gYnVmZmVyLnBvcyArIGJ5dGVzLFxuICAgICAgICBjbWQgPSAxLFxuICAgICAgICBsZW5ndGggPSAwLFxuICAgICAgICB4ID0gMCxcbiAgICAgICAgeSA9IDAsXG4gICAgICAgIGxpbmVzID0gW10sXG4gICAgICAgIGxpbmU7XG5cbiAgICB3aGlsZSAoYnVmZmVyLnBvcyA8IGVuZCkge1xuICAgICAgICBpZiAoIWxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGNtZF9sZW5ndGggPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICAgICAgY21kID0gY21kX2xlbmd0aCAmIDB4NztcbiAgICAgICAgICAgIGxlbmd0aCA9IGNtZF9sZW5ndGggPj4gMztcbiAgICAgICAgfVxuXG4gICAgICAgIGxlbmd0aC0tO1xuXG4gICAgICAgIGlmIChjbWQgPT09IDEgfHwgY21kID09PSAyKSB7XG4gICAgICAgICAgICB4ICs9IGJ1ZmZlci5yZWFkU1ZhcmludCgpO1xuICAgICAgICAgICAgeSArPSBidWZmZXIucmVhZFNWYXJpbnQoKTtcblxuICAgICAgICAgICAgaWYgKGNtZCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIC8vIG1vdmVUb1xuICAgICAgICAgICAgICAgIGlmIChsaW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIGxpbmVzLnB1c2gobGluZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxpbmUgPSBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGluZS5wdXNoKG5ldyBQb2ludCh4LCB5KSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY21kID09PSA3KSB7XG4gICAgICAgICAgICAvLyBjbG9zZVBvbHlnb25cbiAgICAgICAgICAgIGxpbmUucHVzaChsaW5lWzBdLmNsb25lKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIGNvbW1hbmQgJyArIGNtZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobGluZSkgbGluZXMucHVzaChsaW5lKTtcblxuICAgIHJldHVybiBsaW5lcztcbn07XG5cblZlY3RvclRpbGVGZWF0dXJlLnByb3RvdHlwZS5iYm94ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcjtcbiAgICBidWZmZXIucG9zID0gdGhpcy5fZ2VvbWV0cnk7XG5cbiAgICB2YXIgYnl0ZXMgPSBidWZmZXIucmVhZFZhcmludCgpLFxuICAgICAgICBlbmQgPSBidWZmZXIucG9zICsgYnl0ZXMsXG5cbiAgICAgICAgY21kID0gMSxcbiAgICAgICAgbGVuZ3RoID0gMCxcbiAgICAgICAgeCA9IDAsXG4gICAgICAgIHkgPSAwLFxuICAgICAgICB4MSA9IEluZmluaXR5LFxuICAgICAgICB4MiA9IC1JbmZpbml0eSxcbiAgICAgICAgeTEgPSBJbmZpbml0eSxcbiAgICAgICAgeTIgPSAtSW5maW5pdHk7XG5cbiAgICB3aGlsZSAoYnVmZmVyLnBvcyA8IGVuZCkge1xuICAgICAgICBpZiAoIWxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGNtZF9sZW5ndGggPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICAgICAgY21kID0gY21kX2xlbmd0aCAmIDB4NztcbiAgICAgICAgICAgIGxlbmd0aCA9IGNtZF9sZW5ndGggPj4gMztcbiAgICAgICAgfVxuXG4gICAgICAgIGxlbmd0aC0tO1xuXG4gICAgICAgIGlmIChjbWQgPT09IDEgfHwgY21kID09PSAyKSB7XG4gICAgICAgICAgICB4ICs9IGJ1ZmZlci5yZWFkU1ZhcmludCgpO1xuICAgICAgICAgICAgeSArPSBidWZmZXIucmVhZFNWYXJpbnQoKTtcbiAgICAgICAgICAgIGlmICh4IDwgeDEpIHgxID0geDtcbiAgICAgICAgICAgIGlmICh4ID4geDIpIHgyID0geDtcbiAgICAgICAgICAgIGlmICh5IDwgeTEpIHkxID0geTtcbiAgICAgICAgICAgIGlmICh5ID4geTIpIHkyID0geTtcblxuICAgICAgICB9IGVsc2UgaWYgKGNtZCAhPT0gNykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIGNvbW1hbmQgJyArIGNtZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gW3gxLCB5MSwgeDIsIHkyXTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBWZWN0b3JUaWxlRmVhdHVyZSA9IHJlcXVpcmUoJy4vdmVjdG9ydGlsZWZlYXR1cmUuanMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBWZWN0b3JUaWxlTGF5ZXI7XG5mdW5jdGlvbiBWZWN0b3JUaWxlTGF5ZXIoYnVmZmVyLCBlbmQpIHtcbiAgICAvLyBQdWJsaWNcbiAgICB0aGlzLnZlcnNpb24gPSAxO1xuICAgIHRoaXMubmFtZSA9IG51bGw7XG4gICAgdGhpcy5leHRlbnQgPSA0MDk2O1xuICAgIHRoaXMubGVuZ3RoID0gMDtcblxuICAgIC8vIFByaXZhdGVcbiAgICB0aGlzLl9idWZmZXIgPSBidWZmZXI7XG4gICAgdGhpcy5fa2V5cyA9IFtdO1xuICAgIHRoaXMuX3ZhbHVlcyA9IFtdO1xuICAgIHRoaXMuX2ZlYXR1cmVzID0gW107XG5cbiAgICB2YXIgdmFsLCB0YWc7XG5cbiAgICBlbmQgPSBlbmQgfHwgYnVmZmVyLmxlbmd0aDtcblxuICAgIHdoaWxlIChidWZmZXIucG9zIDwgZW5kKSB7XG4gICAgICAgIHZhbCA9IGJ1ZmZlci5yZWFkVmFyaW50KCk7XG4gICAgICAgIHRhZyA9IHZhbCA+PiAzO1xuXG4gICAgICAgIGlmICh0YWcgPT09IDE1KSB7XG4gICAgICAgICAgICB0aGlzLnZlcnNpb24gPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gMSkge1xuICAgICAgICAgICAgdGhpcy5uYW1lID0gYnVmZmVyLnJlYWRTdHJpbmcoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT09IDUpIHtcbiAgICAgICAgICAgIHRoaXMuZXh0ZW50ID0gYnVmZmVyLnJlYWRWYXJpbnQoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT09IDIpIHtcbiAgICAgICAgICAgIHRoaXMubGVuZ3RoKys7XG4gICAgICAgICAgICB0aGlzLl9mZWF0dXJlcy5wdXNoKGJ1ZmZlci5wb3MpO1xuICAgICAgICAgICAgYnVmZmVyLnNraXAodmFsKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gMykge1xuICAgICAgICAgICAgdGhpcy5fa2V5cy5wdXNoKGJ1ZmZlci5yZWFkU3RyaW5nKCkpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gNCkge1xuICAgICAgICAgICAgdGhpcy5fdmFsdWVzLnB1c2godGhpcy5yZWFkRmVhdHVyZVZhbHVlKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnVmZmVyLnNraXAodmFsKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuVmVjdG9yVGlsZUxheWVyLnByb3RvdHlwZS5yZWFkRmVhdHVyZVZhbHVlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcixcbiAgICAgICAgdmFsdWUgPSBudWxsLFxuICAgICAgICBieXRlcyA9IGJ1ZmZlci5yZWFkVmFyaW50KCksXG4gICAgICAgIGVuZCA9IGJ1ZmZlci5wb3MgKyBieXRlcyxcbiAgICAgICAgdmFsLCB0YWc7XG5cbiAgICB3aGlsZSAoYnVmZmVyLnBvcyA8IGVuZCkge1xuICAgICAgICB2YWwgPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICB0YWcgPSB2YWwgPj4gMztcblxuICAgICAgICBpZiAodGFnID09IDEpIHtcbiAgICAgICAgICAgIHZhbHVlID0gYnVmZmVyLnJlYWRTdHJpbmcoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT0gMikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZWFkIGZsb2F0Jyk7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09IDMpIHtcbiAgICAgICAgICAgIHZhbHVlID0gYnVmZmVyLnJlYWREb3VibGUoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT0gNCkge1xuICAgICAgICAgICAgdmFsdWUgPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSA1KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlYWQgdWludCcpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSA2KSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGJ1ZmZlci5yZWFkU1ZhcmludCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSA3KSB7XG4gICAgICAgICAgICB2YWx1ZSA9IEJvb2xlYW4oYnVmZmVyLnJlYWRWYXJpbnQoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBidWZmZXIuc2tpcCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xufTtcblxuLy8gcmV0dXJuIGZlYXR1cmUgYGlgIGZyb20gdGhpcyBsYXllciBhcyBhIGBWZWN0b3JUaWxlRmVhdHVyZWBcblZlY3RvclRpbGVMYXllci5wcm90b3R5cGUuZmVhdHVyZSA9IGZ1bmN0aW9uKGkpIHtcbiAgICBpZiAoaSA8IDAgfHwgaSA+PSB0aGlzLl9mZWF0dXJlcy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcignZmVhdHVyZSBpbmRleCBvdXQgb2YgYm91bmRzJyk7XG5cbiAgICB0aGlzLl9idWZmZXIucG9zID0gdGhpcy5fZmVhdHVyZXNbaV07XG4gICAgdmFyIGVuZCA9IHRoaXMuX2J1ZmZlci5yZWFkVmFyaW50KCkgKyB0aGlzLl9idWZmZXIucG9zO1xuXG4gICAgcmV0dXJuIG5ldyBWZWN0b3JUaWxlRmVhdHVyZSh0aGlzLl9idWZmZXIsIGVuZCwgdGhpcy5leHRlbnQsIHRoaXMuX2tleXMsIHRoaXMuX3ZhbHVlcyk7XG59O1xuIiwiLyoqXG4gKiBDcmVhdGVkIGJ5IFJ5YW4gV2hpdGxleSwgRGFuaWVsIER1YXJ0ZSwgYW5kIE5pY2hvbGFzIEhhbGxhaGFuXG4gKiAgICBvbiA2LzAzLzE0LlxuICovXG5cbnZhciBTdGF0aWNMYWJlbCA9IHJlcXVpcmUoJy4vU3RhdGljTGFiZWwvU3RhdGljTGFiZWwuanMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBNVlRGZWF0dXJlO1xuXG5mdW5jdGlvbiBNVlRGZWF0dXJlKG12dExheWVyLCB2dGYsIGN0eCwgaWQsIHN0eWxlKSB7XG4gIGlmICghdnRmKSByZXR1cm4gbnVsbDtcblxuICBmb3IgKHZhciBrZXkgaW4gdnRmKSB7XG4gICAgdGhpc1trZXldID0gdnRmW2tleV07XG4gIH1cblxuICB0aGlzLm12dExheWVyID0gbXZ0TGF5ZXI7XG4gIHRoaXMubXZ0U291cmNlID0gbXZ0TGF5ZXIubXZ0U291cmNlO1xuICB0aGlzLm1hcCA9IG12dExheWVyLm12dFNvdXJjZS5fbWFwO1xuXG4gIHRoaXMuaWQgPSBpZDtcblxuICB0aGlzLmxheWVyTGluayA9IHRoaXMubXZ0U291cmNlLmxheWVyTGluaztcbiAgdGhpcy50b2dnbGVFbmFibGVkID0gdHJ1ZTtcbiAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuXG4gIC8vIGhvdyBtdWNoIHdlIGRpdmlkZSB0aGUgY29vcmRpbmF0ZSBmcm9tIHRoZSB2ZWN0b3IgdGlsZVxuICB0aGlzLmRpdmlzb3IgPSB2dGYuZXh0ZW50IC8gY3R4LnRpbGVTaXplO1xuICB0aGlzLmV4dGVudCA9IHZ0Zi5leHRlbnQ7XG4gIHRoaXMudGlsZVNpemUgPSBjdHgudGlsZVNpemU7XG5cbiAgLy9BbiBvYmplY3QgdG8gc3RvcmUgdGhlIHBhdGhzIGFuZCBjb250ZXh0cyBmb3IgdGhpcyBmZWF0dXJlXG4gIHRoaXMudGlsZXMgPSB7fTtcblxuICBpZiAoIXRoaXMudGlsZXNbY3R4Lnpvb21dKSB0aGlzLnRpbGVzW2N0eC56b29tXSA9IHt9O1xuXG4gIHRoaXMuc3R5bGUgPSBzdHlsZTtcblxuICB0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXNGb3Jab29tID0ge307XG4gIHRoaXMuX2V2ZW50SGFuZGxlcnMgPSB7fTtcblxuICAvL0FkZCB0byB0aGUgY29sbGVjdGlvblxuICB0aGlzLmFkZFRpbGVGZWF0dXJlKHZ0ZiwgY3R4KTtcblxuICBpZiAodHlwZW9mIHN0eWxlLmR5bmFtaWNMYWJlbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMuZmVhdHVyZUxhYmVsID0gdGhpcy5tdnRTb3VyY2UuZHluYW1pY0xhYmVsLmNyZWF0ZUZlYXR1cmUodGhpcyk7XG4gIH1cbn1cblxuTVZURmVhdHVyZS5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKHZ0ZiwgY3R4KSB7XG4gIGlmICh0aGlzLnNlbGVjdGVkKSB7XG4gICAgdmFyIHN0eWxlID0gdGhpcy5zdHlsZS5zZWxlY3RlZCB8fCB0aGlzLnN0eWxlO1xuICB9IGVsc2Uge1xuICAgIHZhciBzdHlsZSA9IHRoaXMuc3R5bGU7XG4gIH1cblxuICBzd2l0Y2ggKHZ0Zi50eXBlKSB7XG4gICAgY2FzZSAxOiAvL1BvaW50XG4gICAgICB0aGlzLl9kcmF3UG9pbnQoY3R4LCB2dGYuY29vcmRpbmF0ZXMsIHN0eWxlKTtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5zdHlsZS5zdGF0aWNMYWJlbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLl9kcmF3U3RhdGljTGFiZWwoY3R4LCB2dGYuY29vcmRpbmF0ZXMsIHN0eWxlKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAyOiAvL0xpbmVTdHJpbmdcbiAgICAgIHRoaXMuX2RyYXdMaW5lU3RyaW5nKGN0eCwgdnRmLmNvb3JkaW5hdGVzLCBzdHlsZSk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgMzogLy9Qb2x5Z29uXG4gICAgICB0aGlzLl9kcmF3UG9seWdvbihjdHgsIHZ0Zi5jb29yZGluYXRlcywgc3R5bGUpO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbm1hbmFnZWQgdHlwZTogJyArIHZ0Zi50eXBlKTtcbiAgfVxuXG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5nZXRQYXRoc0ZvclRpbGUgPSBmdW5jdGlvbihjYW52YXNJRCwgem9vbSkge1xuICAvL0dldCB0aGUgaW5mbyBmcm9tIHRoZSBwYXJ0cyBsaXN0XG4gIHJldHVybiB0aGlzLnRpbGVzW3pvb21dW2NhbnZhc0lEXS5wYXRocztcbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLmFkZFRpbGVGZWF0dXJlID0gZnVuY3Rpb24odnRmLCBjdHgpIHtcblxuICAvL1N0b3JlIHRoZSBwYXJ0cyBvZiB0aGUgZmVhdHVyZSBmb3IgYSBwYXJ0aWN1bGFyIHpvb20gbGV2ZWxcbiAgdmFyIHpvb20gPSBjdHguem9vbTtcbiAgaWYgKCF0aGlzLnRpbGVzW2N0eC56b29tXSkgdGhpcy50aWxlc1tjdHguem9vbV0gPSB7fTtcblxuICAvL1N0b3JlIHRoZSBpbXBvcnRhbnQgaXRlbXMgaW4gdGhlIHBhcnRzIGxpc3RcbiAgdGhpcy50aWxlc1t6b29tXVtjdHguaWRdID0ge1xuICAgIGN0eDogY3R4LFxuICAgIHZ0ZjogdnRmLFxuICAgIHBhdGhzOiBbXVxuICB9O1xufTtcblxuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5nZXRUaWxlSW5mbyA9IGZ1bmN0aW9uKGNhbnZhc0lELCB6b29tKSB7XG4gIC8vR2V0IHRoZSBpbmZvIGZyb20gdGhlIHBhcnRzIGxpc3RcbiAgcmV0dXJuIHRoaXMudGlsZXNbem9vbV1bY2FudmFzSURdO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuc2V0U3R5bGUgPSBmdW5jdGlvbihzdHlsZSkge1xuICAvL1NldCB0aGlzIGZlYXR1cmUncyBzdHlsZSBhbmQgcmVkcmF3IGFsbCBjYW52YXNlcyB0aGF0IHRoaXMgdGhpbmcgaXMgYSBwYXJ0IG9mXG4gIHRoaXMuc3R5bGUgPSBzdHlsZTtcbiAgdGhpcy5fZXZlbnRIYW5kbGVyc1tcInN0eWxlQ2hhbmdlZFwiXSh0aGlzLnRpbGVzKTtcbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5zZWxlY3RlZCkge1xuICAgIHRoaXMuZGVzZWxlY3QoKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnNlbGVjdCgpO1xuICB9XG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5zZWxlY3QgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZWxlY3RlZCA9IHRydWU7XG4gIHRoaXMuX2V2ZW50SGFuZGxlcnNbXCJzdHlsZUNoYW5nZWRcIl0odGhpcy50aWxlcyk7XG4gIHZhciBsaW5rZWRGZWF0dXJlID0gdGhpcy5saW5rZWRGZWF0dXJlKCk7XG4gIGlmIChsaW5rZWRGZWF0dXJlLnN0YXRpY0xhYmVsICYmICFsaW5rZWRGZWF0dXJlLnN0YXRpY0xhYmVsLnNlbGVjdGVkKSB7XG4gICAgbGlua2VkRmVhdHVyZS5zdGF0aWNMYWJlbC5zZWxlY3QoKTtcbiAgfVxufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuZGVzZWxlY3QgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuICB0aGlzLl9ldmVudEhhbmRsZXJzW1wic3R5bGVDaGFuZ2VkXCJdKHRoaXMudGlsZXMpO1xuICB2YXIgbGlua2VkRmVhdHVyZSA9IHRoaXMubGlua2VkRmVhdHVyZSgpO1xuICBpZiAobGlua2VkRmVhdHVyZS5zdGF0aWNMYWJlbCAmJiBsaW5rZWRGZWF0dXJlLnN0YXRpY0xhYmVsLnNlbGVjdGVkKSB7XG4gICAgbGlua2VkRmVhdHVyZS5zdGF0aWNMYWJlbC5kZXNlbGVjdCgpO1xuICB9XG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50VHlwZSwgY2FsbGJhY2spIHtcbiAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudFR5cGVdID0gY2FsbGJhY2s7XG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5fZHJhd1BvaW50ID0gZnVuY3Rpb24oY3R4LCBjb29yZHNBcnJheSwgc3R5bGUpIHtcbiAgaWYgKCFzdHlsZSkgcmV0dXJuO1xuXG4gIHZhciBwYXJ0ID0gdGhpcy50aWxlc1tjdHguem9vbV1bY3R4LmlkXTtcblxuICB2YXIgcmFkaXVzID0gMTtcbiAgaWYgKHR5cGVvZiBzdHlsZS5yYWRpdXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICByYWRpdXMgPSBzdHlsZS5yYWRpdXMoY3R4Lnpvb20pOyAvL0FsbG93cyBmb3Igc2NhbGUgZGVwZW5kZW50IHJlZG5lcmluZ1xuICB9XG4gIGVsc2V7XG4gICAgcmFkaXVzID0gc3R5bGUucmFkaXVzO1xuICB9XG5cbiAgdmFyIHAgPSB0aGlzLl90aWxlUG9pbnQoY29vcmRzQXJyYXlbMF1bMF0pO1xuICB2YXIgYyA9IGN0eC5jYW52YXM7XG4gIHZhciBnID0gYy5nZXRDb250ZXh0KCcyZCcpO1xuICBnLmJlZ2luUGF0aCgpO1xuICBnLmZpbGxTdHlsZSA9IHN0eWxlLmNvbG9yO1xuICBnLmFyYyhwLngsIHAueSwgcmFkaXVzLCAwLCBNYXRoLlBJICogMik7XG4gIGcuY2xvc2VQYXRoKCk7XG4gIGcuZmlsbCgpO1xuICBnLnJlc3RvcmUoKTtcbiAgcGFydC5wYXRocy5wdXNoKFtwXSk7XG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5fZHJhd1N0YXRpY0xhYmVsID0gZnVuY3Rpb24oY3R4LCBjb29yZHNBcnJheSwgc3R5bGUpIHtcbiAgaWYgKCFzdHlsZSkgcmV0dXJuO1xuXG4gIHZhciB2ZWNQdCA9IHRoaXMuX3RpbGVQb2ludChjb29yZHNBcnJheVswXVswXSk7XG5cbiAgLy8gV2UncmUgbWFraW5nIGEgc3RhbmRhcmQgTGVhZmxldCBNYXJrZXIgZm9yIHRoaXMgbGFiZWwuXG4gIHZhciBwID0gdGhpcy5fcHJvamVjdCh2ZWNQdCwgY3R4LnRpbGUueCwgY3R4LnRpbGUueSwgdGhpcy5leHRlbnQsIHRoaXMudGlsZVNpemUpOyAvL3ZlY3RpbGUgcHQgdG8gbWVyYyBwdFxuICB2YXIgbWVyY1B0ID0gTC5wb2ludChwLngsIHAueSk7IC8vIG1ha2UgaW50byBsZWFmbGV0IG9ialxuICB2YXIgbGF0TG5nID0gdGhpcy5tYXAudW5wcm9qZWN0KG1lcmNQdCk7IC8vIG1lcmMgcHQgdG8gbGF0bG5nXG5cbiAgdGhpcy5zdGF0aWNMYWJlbCA9IG5ldyBTdGF0aWNMYWJlbCh0aGlzLCBjdHgsIGxhdExuZywgc3R5bGUpO1xufTtcblxuXG5cbi8qKlxuICogUHJvamVjdHMgYSB2ZWN0b3IgdGlsZSBwb2ludCB0byB0aGUgU3BoZXJpY2FsIE1lcmNhdG9yIHBpeGVsIHNwYWNlIGZvciBhIGdpdmVuIHpvb20gbGV2ZWwuXG4gKlxuICogQHBhcmFtIHZlY1B0XG4gKiBAcGFyYW0gdGlsZVhcbiAqIEBwYXJhbSB0aWxlWVxuICogQHBhcmFtIGV4dGVudFxuICogQHBhcmFtIHRpbGVTaXplXG4gKi9cbk1WVEZlYXR1cmUucHJvdG90eXBlLl9wcm9qZWN0ID0gZnVuY3Rpb24odmVjUHQsIHRpbGVYLCB0aWxlWSwgZXh0ZW50LCB0aWxlU2l6ZSkge1xuICB2YXIgeE9mZnNldCA9IHRpbGVYICogdGlsZVNpemU7XG4gIHZhciB5T2Zmc2V0ID0gdGlsZVkgKiB0aWxlU2l6ZTtcbiAgcmV0dXJuIHtcbiAgICB4OiBNYXRoLmZsb29yKHZlY1B0LnggKyB4T2Zmc2V0KSxcbiAgICB5OiBNYXRoLmZsb29yKHZlY1B0LnkgKyB5T2Zmc2V0KVxuICB9O1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuX2RyYXdMaW5lU3RyaW5nID0gZnVuY3Rpb24oY3R4LCBjb29yZHNBcnJheSwgc3R5bGUpIHtcbiAgaWYgKCFzdHlsZSkgcmV0dXJuO1xuXG4gIHZhciBnID0gY3R4LmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICBnLnN0cm9rZVN0eWxlID0gc3R5bGUuY29sb3I7XG4gIGcubGluZVdpZHRoID0gc3R5bGUuc2l6ZTtcbiAgZy5iZWdpblBhdGgoKTtcblxuICB2YXIgcHJvakNvb3JkcyA9IFtdO1xuICB2YXIgcGFydCA9IHRoaXMudGlsZXNbY3R4Lnpvb21dW2N0eC5pZF07XG5cbiAgZm9yICh2YXIgZ2lkeCBpbiBjb29yZHNBcnJheSkge1xuICAgIHZhciBjb29yZHMgPSBjb29yZHNBcnJheVtnaWR4XTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBtZXRob2QgPSAoaSA9PT0gMCA/ICdtb3ZlJyA6ICdsaW5lJykgKyAnVG8nO1xuICAgICAgdmFyIHByb2ogPSB0aGlzLl90aWxlUG9pbnQoY29vcmRzW2ldKTtcbiAgICAgIHByb2pDb29yZHMucHVzaChwcm9qKTtcbiAgICAgIGdbbWV0aG9kXShwcm9qLngsIHByb2oueSk7XG4gICAgfVxuICB9XG5cbiAgZy5zdHJva2UoKTtcbiAgZy5yZXN0b3JlKCk7XG5cbiAgcGFydC5wYXRocy5wdXNoKHByb2pDb29yZHMpO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuX2RyYXdQb2x5Z29uID0gZnVuY3Rpb24oY3R4LCBjb29yZHNBcnJheSwgc3R5bGUpIHtcbiAgaWYgKCFzdHlsZSkgcmV0dXJuO1xuICBpZiAoIWN0eC5jYW52YXMpIHJldHVybjtcblxuICB2YXIgZyA9IGN0eC5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgdmFyIG91dGxpbmUgPSBzdHlsZS5vdXRsaW5lO1xuICBnLmZpbGxTdHlsZSA9IHN0eWxlLmNvbG9yO1xuICBpZiAob3V0bGluZSkge1xuICAgIGcuc3Ryb2tlU3R5bGUgPSBvdXRsaW5lLmNvbG9yO1xuICAgIGcubGluZVdpZHRoID0gb3V0bGluZS5zaXplO1xuICB9XG4gIGcuYmVnaW5QYXRoKCk7XG5cbiAgdmFyIHByb2pDb29yZHMgPSBbXTtcbiAgdmFyIHBhcnQgPSB0aGlzLnRpbGVzW2N0eC56b29tXVtjdHguaWRdO1xuXG4gIHZhciBmZWF0dXJlTGFiZWwgPSB0aGlzLmZlYXR1cmVMYWJlbDtcbiAgaWYgKGZlYXR1cmVMYWJlbCkge1xuICAgIGZlYXR1cmVMYWJlbC5hZGRUaWxlUG9seXMoY3R4LCBjb29yZHNBcnJheSk7XG4gIH1cblxuICBmb3IgKHZhciBnaWR4ID0gMCwgbGVuID0gY29vcmRzQXJyYXkubGVuZ3RoOyBnaWR4IDwgbGVuOyBnaWR4KyspIHtcbiAgICB2YXIgY29vcmRzID0gY29vcmRzQXJyYXlbZ2lkeF07XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGNvb3JkID0gY29vcmRzW2ldO1xuICAgICAgdmFyIG1ldGhvZCA9IChpID09PSAwID8gJ21vdmUnIDogJ2xpbmUnKSArICdUbyc7XG4gICAgICB2YXIgcHJvaiA9IHRoaXMuX3RpbGVQb2ludChjb29yZHNbaV0pO1xuICAgICAgcHJvakNvb3Jkcy5wdXNoKHByb2opO1xuICAgICAgZ1ttZXRob2RdKHByb2oueCwgcHJvai55KTtcbiAgICB9XG4gIH1cblxuICBnLmNsb3NlUGF0aCgpO1xuICBnLmZpbGwoKTtcbiAgaWYgKG91dGxpbmUpIHtcbiAgICBnLnN0cm9rZSgpO1xuICB9XG5cbiAgcGFydC5wYXRocy5wdXNoKHByb2pDb29yZHMpO1xuXG59O1xuXG4vKipcbiAqIFRha2VzIGEgY29vcmRpbmF0ZSBmcm9tIGEgdmVjdG9yIHRpbGUgYW5kIHR1cm5zIGl0IGludG8gYSBMZWFmbGV0IFBvaW50LlxuICpcbiAqIEBwYXJhbSBjdHhcbiAqIEBwYXJhbSBjb29yZHNcbiAqIEByZXR1cm5zIHtlR2VvbVR5cGUuUG9pbnR9XG4gKiBAcHJpdmF0ZVxuICovXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5fdGlsZVBvaW50ID0gZnVuY3Rpb24oY29vcmRzKSB7XG4gIHJldHVybiBuZXcgTC5Qb2ludChjb29yZHMueCAvIHRoaXMuZGl2aXNvciwgY29vcmRzLnkgLyB0aGlzLmRpdmlzb3IpO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUubGlua2VkRmVhdHVyZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbGlua2VkTGF5ZXIgPSB0aGlzLm12dExheWVyLmxpbmtlZExheWVyKCk7XG4gIHZhciBsaW5rZWRGZWF0dXJlID0gbGlua2VkTGF5ZXIuZmVhdHVyZXNbdGhpcy5pZF07XG4gIHJldHVybiBsaW5rZWRGZWF0dXJlO1xufTsiLCIvKipcbiAqIENyZWF0ZWQgYnkgUnlhbiBXaGl0bGV5IG9uIDUvMTcvMTQuXG4gKi9cbi8qKiBGb3JrZWQgZnJvbSBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9ER3VpZGkvMTcxNjAxMCAqKi9cbnZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xudmFyIE1WVEZlYXR1cmUgPSByZXF1aXJlKCcuL01WVEZlYXR1cmUnKTtcbnZhciBVdGlsID0gcmVxdWlyZSgnLi9NVlRVdGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5UaWxlTGF5ZXIuQ2FudmFzLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIGRlYnVnOiBmYWxzZSxcbiAgICBpc0hpZGRlbkxheWVyOiBmYWxzZSxcbiAgICBnZXRJREZvckxheWVyRmVhdHVyZTogZnVuY3Rpb24oKSB7fSxcbiAgICB0aWxlU2l6ZTogMjU2XG4gIH0sXG5cbiAgX2ZlYXR1cmVJc0NsaWNrZWQ6IHt9LFxuXG4gIF9pc1BvaW50SW5Qb2x5OiBmdW5jdGlvbihwdCwgcG9seSkge1xuICAgIGlmKHBvbHkgJiYgcG9seS5sZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGMgPSBmYWxzZSwgaSA9IC0xLCBsID0gcG9seS5sZW5ndGgsIGogPSBsIC0gMTsgKytpIDwgbDsgaiA9IGkpXG4gICAgICAgICgocG9seVtpXS55IDw9IHB0LnkgJiYgcHQueSA8IHBvbHlbal0ueSkgfHwgKHBvbHlbal0ueSA8PSBwdC55ICYmIHB0LnkgPCBwb2x5W2ldLnkpKVxuICAgICAgICAmJiAocHQueCA8IChwb2x5W2pdLnggLSBwb2x5W2ldLngpICogKHB0LnkgLSBwb2x5W2ldLnkpIC8gKHBvbHlbal0ueSAtIHBvbHlbaV0ueSkgKyBwb2x5W2ldLngpXG4gICAgICAgICYmIChjID0gIWMpO1xuICAgICAgcmV0dXJuIGM7XG4gICAgfVxuICB9LFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKG12dFNvdXJjZSwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLm12dFNvdXJjZSA9IG12dFNvdXJjZTtcbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcblxuICAgIHRoaXMuc3R5bGVGb3IgPSBvcHRpb25zLnN0eWxlRm9yO1xuICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXNGb3Jab29tID0ge307XG4gICAgdGhpcy52aXNpYmxlID0gdHJ1ZTtcbiAgICB0aGlzLmZlYXR1cmVzID0ge307XG4gICAgdGhpcy5mZWF0dXJlc1dpdGhMYWJlbHMgPSBbXTtcbiAgfSxcblxuICBkcmF3VGlsZTogZnVuY3Rpb24oY2FudmFzLCB0aWxlUG9pbnQsIHpvb20pIHtcblxuICAgIHZhciBjdHggPSB7XG4gICAgICBjYW52YXM6IGNhbnZhcyxcbiAgICAgIHRpbGU6IHRpbGVQb2ludCxcbiAgICAgIHpvb206IHpvb20sXG4gICAgICB0aWxlU2l6ZTogdGhpcy5vcHRpb25zLnRpbGVTaXplXG4gICAgfTtcblxuICAgIGN0eC5pZCA9IFV0aWwuZ2V0Q29udGV4dElEKGN0eCk7XG5cbiAgICBpZiAoIXRoaXMuX2NhbnZhc0lEVG9GZWF0dXJlc0Zvclpvb21bY3R4LmlkXSkge1xuICAgICAgdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzRm9yWm9vbVtjdHguaWRdID0ge307XG4gICAgICB0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXNGb3Jab29tW2N0eC5pZF1bJ2ZlYXR1cmVzJ10gPSBbXTtcbiAgICAgIHRoaXMuX2NhbnZhc0lEVG9GZWF0dXJlc0Zvclpvb21bY3R4LmlkXVsnY2FudmFzJ10gPSBjYW52YXM7XG4gICAgfVxuICAgIGlmICghdGhpcy5mZWF0dXJlcykge1xuICAgICAgdGhpcy5mZWF0dXJlcyA9IHt9O1xuICAgIH1cblxuXG5cbiAgICAvL3RoaXMuX3Jlc2V0Q2FudmFzSURUb0ZlYXR1cmVzRm9yWm9vbVN0YXRlKGN0eC5pZCwgY2FudmFzLCB6b29tKTtcbiAgfSxcblxuICBfZHJhdzogZnVuY3Rpb24oY3R4KSB7XG4gICAgLy9EcmF3IGlzIGhhbmRsZWQgYnkgdGhlIHBhcmVudCBNVlRTb3VyY2Ugb2JqZWN0XG4gIH0sXG4gIGdldENhbnZhczogZnVuY3Rpb24ocGFyZW50Q3R4KXtcbiAgICAvL1RoaXMgZ2V0cyBjYWxsZWQgaWYgYSB2ZWN0b3IgdGlsZSBmZWF0dXJlIGhhcyBhbHJlYWR5IGJlZW4gcGFyc2VkLlxuICAgIC8vV2UndmUgYWxyZWFkeSBnb3QgdGhlIGdlb20sIGp1c3QgZ2V0IG9uIHdpdGggdGhlIGRyYXdpbmcuXG4gICAgLy9OZWVkIGEgd2F5IHRvIHBsdWNrIGEgY2FudmFzIGVsZW1lbnQgZnJvbSB0aGlzIGxheWVyIGdpdmVuIHRoZSBwYXJlbnQgbGF5ZXIncyBpZC5cbiAgICAvL1dhaXQgZm9yIGl0IHRvIGdldCBsb2FkZWQgYmVmb3JlIHByb2NlZWRpbmcuXG4gICAgdmFyIHRpbGVQb2ludCA9IHBhcmVudEN0eC50aWxlO1xuICAgIHZhciBjdHggPSB0aGlzLl90aWxlc1t0aWxlUG9pbnQueCArIFwiOlwiICsgdGlsZVBvaW50LnldO1xuXG4gICAgaWYoY3R4KXtcbiAgICAgIHBhcmVudEN0eC5jYW52YXMgPSBjdHg7XG4gICAgICB0aGlzLnJlZHJhd1RpbGUocGFyZW50Q3R4LmlkLCBwYXJlbnRDdHguem9vbSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy9UaGlzIGlzIGEgdGltZXIgdGhhdCB3aWxsIHdhaXQgZm9yIGEgY3JpdGVyaW9uIHRvIHJldHVybiB0cnVlLlxuICAgIC8vSWYgbm90IHRydWUgd2l0aGluIHRoZSB0aW1lb3V0IGR1cmF0aW9uLCBpdCB3aWxsIG1vdmUgb24uXG4gICAgd2FpdEZvcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGN0eCA9IHNlbGYuX3RpbGVzW3RpbGVQb2ludC54ICsgXCI6XCIgKyB0aWxlUG9pbnQueV07XG4gICAgICAgIGlmKGN0eCkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24oKXtcbiAgICAgICAgLy9XaGVuIGl0IGZpbmlzaGVzLCBkbyB0aGlzLlxuICAgICAgICBjdHggPSBzZWxmLl90aWxlc1t0aWxlUG9pbnQueCArIFwiOlwiICsgdGlsZVBvaW50LnldO1xuICAgICAgICBwYXJlbnRDdHguY2FudmFzID0gY3R4O1xuICAgICAgICBzZWxmLnJlZHJhd1RpbGUocGFyZW50Q3R4LmlkLCBwYXJlbnRDdHguem9vbSwgcGFyZW50Q3R4KTtcblxuICAgICAgfSwgLy93aGVuIGRvbmUsIGdvIHRvIG5leHQgZmxvd1xuICAgICAgMjAwMCk7IC8vVGhlIFRpbWVvdXQgbWlsbGlzZWNvbmRzLiAgQWZ0ZXIgdGhpcywgZ2l2ZSB1cCBhbmQgbW92ZSBvblxuXG4gIH0sXG5cbiAgcGFyc2VWZWN0b3JUaWxlTGF5ZXI6IGZ1bmN0aW9uKHZ0bCwgY3R4KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciB0aWxlUG9pbnQgPSBjdHgudGlsZTtcblxuICAgIC8vU2VlIGlmIHdlIGNhbiBwbHVjayB0aGUgY2hpbGQgdGlsZSBmcm9tIHRoaXMgUEJGIHRpbGUgbGF5ZXIgYmFzZWQgb24gdGhlIG1hc3RlciBsYXllcidzIHRpbGUgaWQuXG4gICAgY3R4LmNhbnZhcyA9IHNlbGYuX3RpbGVzW3RpbGVQb2ludC54ICsgXCI6XCIgKyB0aWxlUG9pbnQueV07XG5cbiAgICAvL0NsZWFyIHRpbGUgLS0gVE9ETzogQWRkIGZsYWcgc28gdGhpcyBvbmx5IGhhcHBlbnMgd2hlbiBhIGxheWVyIGlzIGJlaW5nIHR1cm5lZCBiYWNrIG9uIGFmdGVyIGJlaW5nIGhpZGRlblxuICAgIGlmKGN0eC5jYW52YXMpIGN0eC5jYW52YXMud2lkdGggPSBjdHguY2FudmFzLndpZHRoO1xuXG4gICAgdmFyIGZlYXR1cmVzID0gdnRsLnBhcnNlZEZlYXR1cmVzO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgdmFyIHZ0ZiA9IGZlYXR1cmVzW2ldOyAvL3ZlY3RvciB0aWxlIGZlYXR1cmVcbiAgICAgIHZ0Zi5sYXllciA9IHZ0bDtcblxuICAgICAgLyoqXG4gICAgICAgKiBBcHBseSBmaWx0ZXIgb24gZmVhdHVyZSBpZiB0aGVyZSBpcyBvbmUuIERlZmluZWQgaW4gdGhlIG9wdGlvbnMgb2JqZWN0XG4gICAgICAgKiBvZiBUaWxlTGF5ZXIuTVZUU291cmNlLmpzXG4gICAgICAgKi9cbiAgICAgIHZhciBmaWx0ZXIgPSBzZWxmLm9wdGlvbnMuZmlsdGVyO1xuICAgICAgaWYgKHR5cGVvZiBmaWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgaWYgKCBmaWx0ZXIodnRmLCBjdHgpID09PSBmYWxzZSApIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB2YXIgZ2V0SURGb3JMYXllckZlYXR1cmU7XG4gICAgICBpZiAodHlwZW9mIHNlbGYub3B0aW9ucy5nZXRJREZvckxheWVyRmVhdHVyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBnZXRJREZvckxheWVyRmVhdHVyZSA9IHNlbGYub3B0aW9ucy5nZXRJREZvckxheWVyRmVhdHVyZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGdldElERm9yTGF5ZXJGZWF0dXJlID0gVXRpbC5nZXRJREZvckxheWVyRmVhdHVyZTtcbiAgICAgIH1cbiAgICAgIHZhciB1bmlxdWVJRCA9IHNlbGYub3B0aW9ucy5nZXRJREZvckxheWVyRmVhdHVyZSh2dGYpIHx8IGk7XG4gICAgICB2YXIgbXZ0RmVhdHVyZSA9IHNlbGYuZmVhdHVyZXNbdW5pcXVlSURdO1xuXG4gICAgICAvL0NyZWF0ZSBhIG5ldyBNVlRGZWF0dXJlIGlmIG9uZSBkb2Vzbid0IGFscmVhZHkgZXhpc3QgZm9yIHRoaXMgZmVhdHVyZS5cbiAgICAgIGlmICghbXZ0RmVhdHVyZSkge1xuICAgICAgICAvL0dldCBhIHN0eWxlIGZvciB0aGUgZmVhdHVyZSAtIHNldCBpdCBqdXN0IG9uY2UgZm9yIGVhY2ggbmV3IE1WVEZlYXR1cmVcbiAgICAgICAgdmFyIHN0eWxlID0gc2VsZi5zdHlsZUZvcih2dGYpO1xuXG4gICAgICAgIC8vY3JlYXRlIGEgbmV3IGZlYXR1cmVcbiAgICAgICAgc2VsZi5mZWF0dXJlc1t1bmlxdWVJRF0gPSBtdnRGZWF0dXJlID0gbmV3IE1WVEZlYXR1cmUoc2VsZiwgdnRmLCBjdHgsIHVuaXF1ZUlELCBzdHlsZSwgdGhpcy5fbWFwKTtcbiAgICAgICAgaWYgKHR5cGVvZiBzdHlsZS5keW5hbWljTGFiZWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBzZWxmLmZlYXR1cmVzV2l0aExhYmVscy5wdXNoKG12dEZlYXR1cmUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvL0FkZCB0aGUgbmV3IHBhcnQgdG8gdGhlIGV4aXN0aW5nIGZlYXR1cmVcbiAgICAgICAgbXZ0RmVhdHVyZS5hZGRUaWxlRmVhdHVyZSh2dGYsIGN0eCk7XG4gICAgICB9XG5cbiAgICAgIC8vQXNzb2NpYXRlICYgU2F2ZSB0aGlzIGZlYXR1cmUgd2l0aCB0aGlzIHRpbGUgZm9yIGxhdGVyXG4gICAgICBpZihjdHggJiYgY3R4LmlkKSBzZWxmLl9jYW52YXNJRFRvRmVhdHVyZXNGb3Jab29tW2N0eC5pZF1bJ2ZlYXR1cmVzJ10ucHVzaChtdnRGZWF0dXJlKTtcblxuICAgICAgLy9TdWJzY3JpYmUgdG8gc3R5bGUgY2hhbmdlcyBmb3IgZmVhdHVyZVxuICAgICAgbXZ0RmVhdHVyZS5vbihcInN0eWxlQ2hhbmdlZFwiLCBmdW5jdGlvbihwYXJ0cykge1xuICAgICAgICAvL1JlZHJhdyB0aGUgd2hvbGUgdGlsZSwgbm90IGp1c3QgdGhpcyB2dGZcbiAgICAgICAgdmFyIHpvb20gPSBzZWxmLl9tYXAuX3pvb207XG5cbiAgICAgICAgZm9yICh2YXIgaWQgaW4gcGFydHNbem9vbV0pIHtcbiAgICAgICAgICB2YXIgcGFydCA9IHBhcnRzW3pvb21dW2lkXTtcbiAgICAgICAgICAvL0NsZWFyIHRoZSB0aWxlXG4gICAgICAgICAgc2VsZi5jbGVhclRpbGUocGFydC5jdHgpO1xuXG4gICAgICAgICAgLy9SZWRyYXcgdGhlIHRpbGVcbiAgICAgICAgICBzZWxmLnJlZHJhd1RpbGUoaWQsIHBhcnQuY3R4Lnpvb20sIHBhcnQuY3R4KTtcbiAgICAgICAgfVxuXG4gICAgICB9KTtcblxuICAgICAgLy9UZWxsIGl0IHRvIGRyYXdcbiAgICAgIC8vbXZ0RmVhdHVyZS5kcmF3KHZ0ZiwgY3R4KTtcbiAgICB9XG5cbiAgICAvL0lmIGEgei1vcmRlciBmdW5jdGlvbiBpcyBzcGVjaWZpZWQsIHdhaXQgdW5pdGwgYWxsIGZlYXR1cmVzIGhhdmUgYmVlbiBpdGVyYXRlZCBvdmVyIHVudGlsIGRyYXdpbmcgKGhlcmUpXG4gICAgc2VsZi5yZWRyYXdUaWxlKGN0eC5pZCwgY3R4Lnpvb20sIGN0eCk7XG5cblxuICAgIGZvciAodmFyIGogPSAwLCBsZW4gPSBzZWxmLmZlYXR1cmVzV2l0aExhYmVscy5sZW5ndGg7IGogPCBsZW47IGorKykge1xuICAgICAgdmFyIGZlYXQgPSBzZWxmLmZlYXR1cmVzV2l0aExhYmVsc1tqXTtcbiAgICAgIGRlYnVnLmZlYXQgPSBmZWF0O1xuXG4gICAgfVxuICB9LFxuXG4gIC8vIE5PVEU6IGEgcGxhY2Vob2xkZXIgZm9yIGEgZnVuY3Rpb24gdGhhdCwgZ2l2ZW4gYSBmZWF0dXJlLCByZXR1cm5zIGEgc3R5bGUgb2JqZWN0IHVzZWQgdG8gcmVuZGVyIHRoZSBmZWF0dXJlIGl0c2VsZlxuICBzdHlsZUZvcjogZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgIC8vIG92ZXJyaWRlIHdpdGggeW91ciBjb2RlXG4gIH0sXG5cbiAgLy9UaGlzIGlzIHRoZSBvbGQgd2F5LiAgSXQgd29ya3MsIGJ1dCBpcyBzbG93IGZvciBtb3VzZW92ZXIgZXZlbnRzLiAgRmluZSBmb3IgY2xpY2sgZXZlbnRzLlxuICBoYW5kbGVDbGlja0V2ZW50OiBmdW5jdGlvbihldnQsIGNiKSB7XG4gICAgLy9DbGljayBoYXBwZW5lZCBvbiB0aGUgR3JvdXBMYXllciAoTWFuYWdlcikgYW5kIHBhc3NlZCBpdCBoZXJlXG4gICAgdmFyIHRpbGVJRCA9IGV2dC50aWxlSUQuc3BsaXQoXCI6XCIpLnNsaWNlKDEsIDMpLmpvaW4oXCI6XCIpO1xuICAgIHZhciBjYW52YXMgPSB0aGlzLl90aWxlc1t0aWxlSURdO1xuICAgIGlmKCFjYW52YXMpIChjYihldnQpKTsgLy9icmVhayBvdXRcbiAgICB2YXIgeCA9IGV2dC5sYXllclBvaW50LnggLSBjYW52YXMuX2xlYWZsZXRfcG9zLng7XG4gICAgdmFyIHkgPSBldnQubGF5ZXJQb2ludC55IC0gY2FudmFzLl9sZWFmbGV0X3Bvcy55O1xuXG4gICAgdmFyIHRpbGVQb2ludCA9IHt4OiB4LCB5OiB5fTtcbiAgICB2YXIgZmVhdHVyZXMgPSB0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXNGb3Jab29tW2V2dC50aWxlSURdLmZlYXR1cmVzO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBmZWF0dXJlID0gZmVhdHVyZXNbaV07XG4gICAgICB2YXIgcGF0aHMgPSBmZWF0dXJlLmdldFBhdGhzRm9yVGlsZShldnQudGlsZUlELCB0aGlzLl9tYXAuZ2V0Wm9vbSgpKTtcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgcGF0aHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKHRoaXMuX2lzUG9pbnRJblBvbHkodGlsZVBvaW50LCBwYXRoc1tqXSkpIHtcbiAgICAgICAgICBpZiAoZmVhdHVyZS50b2dnbGVFbmFibGVkKSB7XG4gICAgICAgICAgICBmZWF0dXJlLnRvZ2dsZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBldnQuZmVhdHVyZSA9IGZlYXR1cmU7XG4gICAgICAgICAgY2IoZXZ0KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy9ubyBtYXRjaFxuICAgIC8vcmV0dXJuIGV2dCB3aXRoIGVtcHR5IGZlYXR1cmVcbiAgICBldnQuZmVhdHVyZSA9IG51bGw7XG4gICAgY2IoZXZ0KTtcbiAgfSxcblxuICBjbGVhclRpbGU6IGZ1bmN0aW9uKGN0eCkge1xuICAgIGN0eC5jYW52YXMud2lkdGggPSBjdHguY2FudmFzLndpZHRoO1xuICB9LFxuXG4gIHJlZHJhd1RpbGU6IGZ1bmN0aW9uKGNhbnZhc0lELCB6b29tLCBjdHgpIHtcbiAgICAvL0dldCB0aGUgZmVhdHVyZXMgZm9yIHRoaXMgdGlsZSwgYW5kIHJlZHJhdyB0aGVtLlxuICAgIHZhciBmZWF0dXJlcyA9IHRoaXMuX2NhbnZhc0lEVG9GZWF0dXJlc0Zvclpvb21bY2FudmFzSURdWydmZWF0dXJlcyddO1xuXG4gICAgLy9pZiB6LWluZGV4IGZ1bmN0aW9uIGlzIHNwZWNpZmllZCwgc29ydCB0aGUgZmVhdHVyZXMgc28gdGhleSBkcmF3IGluIHRoZSBjb3JyZWN0IG9yZGVyLCBib3R0b20gcG9pbnRzIGRyYXcgZmlyc3QuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZmVhdHVyZSA9IGZlYXR1cmVzW2ldO1xuICAgICAgdmFyIHRpbGVJbmZvID0gZmVhdHVyZS5nZXRUaWxlSW5mbyhjYW52YXNJRCwgem9vbSk7XG4gICAgICBmZWF0dXJlLmRyYXcodGlsZUluZm8udnRmLCBjdHgpO1xuICAgIH1cblxuXG4gIH0sXG5cbiAgX3Jlc2V0Q2FudmFzSURUb0ZlYXR1cmVzRm9yWm9vbVN0YXRlOiBmdW5jdGlvbihjYW52YXNJRCwgY2FudmFzLCB6b29tKSB7XG5cbiAgICB0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXNGb3Jab29tW2NhbnZhc0lEXSA9IHt9O1xuICAgIHRoaXMuX2NhbnZhc0lEVG9GZWF0dXJlc0Zvclpvb21bY2FudmFzSURdWydmZWF0dXJlcyddID0gW107XG4gICAgdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzRm9yWm9vbVtjYW52YXNJRF1bJ2NhbnZhcyddID0gY2FudmFzO1xuXG4gIH0sXG5cbiAgbGlua2VkTGF5ZXI6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsaW5rTmFtZSA9IHRoaXMubXZ0U291cmNlLmxheWVyTGluayh0aGlzLm5hbWUpO1xuICAgIHJldHVybiB0aGlzLm12dFNvdXJjZS5sYXllcnNbbGlua05hbWVdO1xuICB9XG5cbn0pO1xuXG4vKipcbiAqIFNlZSBodHRwczovL2dpdGh1Yi5jb20vYXJpeWEvcGhhbnRvbWpzL2Jsb2IvbWFzdGVyL2V4YW1wbGVzL3dhaXRmb3IuanNcbiAqXG4gKiBXYWl0IHVudGlsIHRoZSB0ZXN0IGNvbmRpdGlvbiBpcyB0cnVlIG9yIGEgdGltZW91dCBvY2N1cnMuIFVzZWZ1bCBmb3Igd2FpdGluZ1xuICogb24gYSBzZXJ2ZXIgcmVzcG9uc2Ugb3IgZm9yIGEgdWkgY2hhbmdlIChmYWRlSW4sIGV0Yy4pIHRvIG9jY3VyLlxuICpcbiAqIEBwYXJhbSB0ZXN0RnggamF2YXNjcmlwdCBjb25kaXRpb24gdGhhdCBldmFsdWF0ZXMgdG8gYSBib29sZWFuLFxuICogaXQgY2FuIGJlIHBhc3NlZCBpbiBhcyBhIHN0cmluZyAoZS5nLjogXCIxID09IDFcIiBvciBcIiQoJyNiYXInKS5pcygnOnZpc2libGUnKVwiIG9yXG4gKiBhcyBhIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICogQHBhcmFtIG9uUmVhZHkgd2hhdCB0byBkbyB3aGVuIHRlc3RGeCBjb25kaXRpb24gaXMgZnVsZmlsbGVkLFxuICogaXQgY2FuIGJlIHBhc3NlZCBpbiBhcyBhIHN0cmluZyAoZS5nLjogXCIxID09IDFcIiBvciBcIiQoJyNiYXInKS5pcygnOnZpc2libGUnKVwiIG9yXG4gKiBhcyBhIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICogQHBhcmFtIHRpbWVPdXRNaWxsaXMgdGhlIG1heCBhbW91bnQgb2YgdGltZSB0byB3YWl0LiBJZiBub3Qgc3BlY2lmaWVkLCAzIHNlYyBpcyB1c2VkLlxuICovXG5mdW5jdGlvbiB3YWl0Rm9yKHRlc3RGeCwgb25SZWFkeSwgdGltZU91dE1pbGxpcykge1xuICB2YXIgbWF4dGltZU91dE1pbGxpcyA9IHRpbWVPdXRNaWxsaXMgPyB0aW1lT3V0TWlsbGlzIDogMzAwMCwgLy88IERlZmF1bHQgTWF4IFRpbW91dCBpcyAzc1xuICAgIHN0YXJ0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCksXG4gICAgY29uZGl0aW9uID0gKHR5cGVvZiAodGVzdEZ4KSA9PT0gXCJzdHJpbmdcIiA/IGV2YWwodGVzdEZ4KSA6IHRlc3RGeCgpKSwgLy88IGRlZmVuc2l2ZSBjb2RlXG4gICAgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnQgPCBtYXh0aW1lT3V0TWlsbGlzKSAmJiAhY29uZGl0aW9uKSB7XG4gICAgICAgIC8vIElmIG5vdCB0aW1lLW91dCB5ZXQgYW5kIGNvbmRpdGlvbiBub3QgeWV0IGZ1bGZpbGxlZFxuICAgICAgICBjb25kaXRpb24gPSAodHlwZW9mICh0ZXN0RngpID09PSBcInN0cmluZ1wiID8gZXZhbCh0ZXN0RngpIDogdGVzdEZ4KCkpOyAvLzwgZGVmZW5zaXZlIGNvZGVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICAgICAgLy8gSWYgY29uZGl0aW9uIHN0aWxsIG5vdCBmdWxmaWxsZWQgKHRpbWVvdXQgYnV0IGNvbmRpdGlvbiBpcyAnZmFsc2UnKVxuICAgICAgICAgIGNvbnNvbGUubG9nKFwiJ3dhaXRGb3IoKScgdGltZW91dFwiKTtcbiAgICAgICAgICBjbGVhckludGVydmFsKGludGVydmFsKTsgLy88IFN0b3AgdGhpcyBpbnRlcnZhbFxuICAgICAgICAgIHR5cGVvZiAob25SZWFkeSkgPT09IFwic3RyaW5nXCIgPyBldmFsKG9uUmVhZHkpIDogb25SZWFkeSgndGltZW91dCcpOyAvLzwgRG8gd2hhdCBpdCdzIHN1cHBvc2VkIHRvIGRvIG9uY2UgdGhlIGNvbmRpdGlvbiBpcyBmdWxmaWxsZWRcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBDb25kaXRpb24gZnVsZmlsbGVkICh0aW1lb3V0IGFuZC9vciBjb25kaXRpb24gaXMgJ3RydWUnKVxuICAgICAgICAgIGNvbnNvbGUubG9nKFwiJ3dhaXRGb3IoKScgZmluaXNoZWQgaW4gXCIgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkgLSBzdGFydCkgKyBcIm1zLlwiKTtcbiAgICAgICAgICBjbGVhckludGVydmFsKGludGVydmFsKTsgLy88IFN0b3AgdGhpcyBpbnRlcnZhbFxuICAgICAgICAgIHR5cGVvZiAob25SZWFkeSkgPT09IFwic3RyaW5nXCIgPyBldmFsKG9uUmVhZHkpIDogb25SZWFkeSgnc3VjY2VzcycpOyAvLzwgRG8gd2hhdCBpdCdzIHN1cHBvc2VkIHRvIGRvIG9uY2UgdGhlIGNvbmRpdGlvbiBpcyBmdWxmaWxsZWRcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sIDUwKTsgLy88IHJlcGVhdCBjaGVjayBldmVyeSA1MG1zXG59OyIsIi8qKlxuICogQ3JlYXRlZCBieSBSeWFuIFdoaXRsZXkgb24gOS84LzE0LlxuICovXG4vKiogRm9ya2VkIGZyb20gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vREd1aWRpLzE3MTYwMTAgKiovXG52YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcbnZhciBVdGlsID0gcmVxdWlyZSgnLi9NVlRVdGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5UaWxlTGF5ZXIuQ2FudmFzLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIGRlYnVnOiBmYWxzZSxcbiAgICBpc0hpZGRlbkxheWVyOiBmYWxzZSxcbiAgICBnZXRJREZvckxheWVyRmVhdHVyZTogZnVuY3Rpb24oKSB7fSxcbiAgICB0aWxlU2l6ZTogMjU2XG4gIH0sXG5cbiAgX2ZlYXR1cmVJc0NsaWNrZWQ6IHt9LFxuXG4gIF9pc1BvaW50SW5Qb2x5OiBmdW5jdGlvbihwdCwgcG9seSkge1xuICAgIGlmKHBvbHkgJiYgcG9seS5sZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGMgPSBmYWxzZSwgaSA9IC0xLCBsID0gcG9seS5sZW5ndGgsIGogPSBsIC0gMTsgKytpIDwgbDsgaiA9IGkpXG4gICAgICAgICgocG9seVtpXS55IDw9IHB0LnkgJiYgcHQueSA8IHBvbHlbal0ueSkgfHwgKHBvbHlbal0ueSA8PSBwdC55ICYmIHB0LnkgPCBwb2x5W2ldLnkpKVxuICAgICAgICAmJiAocHQueCA8IChwb2x5W2pdLnggLSBwb2x5W2ldLngpICogKHB0LnkgLSBwb2x5W2ldLnkpIC8gKHBvbHlbal0ueSAtIHBvbHlbaV0ueSkgKyBwb2x5W2ldLngpXG4gICAgICAgICYmIChjID0gIWMpO1xuICAgICAgcmV0dXJuIGM7XG4gICAgfVxuICB9LFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKG12dFNvdXJjZSwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLm12dFNvdXJjZSA9IG12dFNvdXJjZTtcbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcblxuICAgIHRoaXMuc3R5bGVGb3IgPSBvcHRpb25zLnN0eWxlRm9yO1xuICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcblxuICAgIHRoaXMudmlzaWJsZSA9IHRydWU7XG4gICAgdGhpcy5mZWF0dXJlcyA9IHt9O1xuICAgIHRoaXMuZmVhdHVyZXNXaXRoTGFiZWxzID0gW107XG4gICAgdGhpcy56SW5kZXhTb3J0T3JkZXIgPSBbXTtcbiAgfSxcblxuICBkcmF3VGlsZTogZnVuY3Rpb24oY2FudmFzLCB0aWxlUG9pbnQsIHpvb20pIHtcblxuICAgIHZhciBjdHggPSB7XG4gICAgICBjYW52YXM6IGNhbnZhcyxcbiAgICAgIHRpbGU6IHRpbGVQb2ludCxcbiAgICAgIHpvb206IHpvb20sXG4gICAgICB0aWxlU2l6ZTogdGhpcy5vcHRpb25zLnRpbGVTaXplXG4gICAgfTtcblxuICAgIGN0eC5pZCA9IFV0aWwuZ2V0Q29udGV4dElEKGN0eCk7XG5cbiAgICBpZiAoIXRoaXMuZmVhdHVyZXMpIHtcbiAgICAgIHRoaXMuZmVhdHVyZXMgPSB7fTtcbiAgICB9XG5cbiAgfSxcblxuICBfZHJhdzogZnVuY3Rpb24oY3R4KSB7XG4gICAgLy9EcmF3IGlzIGhhbmRsZWQgYnkgdGhlIHBhcmVudCBNVlRTb3VyY2Ugb2JqZWN0XG4gIH0sXG4gIGdldENhbnZhczogZnVuY3Rpb24ocGFyZW50Q3R4LCB2dGwpe1xuICAgIC8vTmVlZCBhIHdheSB0byBwbHVjayBhIGNhbnZhcyBlbGVtZW50IGZyb20gdGhpcyBsYXllciBnaXZlbiB0aGUgcGFyZW50IGxheWVyJ3MgaWQuXG4gICAgLy9XYWl0IGZvciBpdCB0byBnZXQgbG9hZGVkIGJlZm9yZSBwcm9jZWVkaW5nLlxuICAgIHZhciB0aWxlUG9pbnQgPSBwYXJlbnRDdHgudGlsZTtcbiAgICB2YXIgY3R4ID0gdGhpcy5fdGlsZXNbdGlsZVBvaW50LnggKyBcIjpcIiArIHRpbGVQb2ludC55XTtcblxuICAgIGlmKGN0eCl7XG4gICAgICBwYXJlbnRDdHguY2FudmFzID0gY3R4O1xuICAgICAgdGhpcy5wYXJzZVZlY3RvclRpbGVMYXllcih2dGwsIHBhcmVudEN0eCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy9UaGlzIGlzIGEgdGltZXIgdGhhdCB3aWxsIHdhaXQgZm9yIGEgY3JpdGVyaW9uIHRvIHJldHVybiB0cnVlLlxuICAgIC8vSWYgbm90IHRydWUgd2l0aGluIHRoZSB0aW1lb3V0IGR1cmF0aW9uLCBpdCB3aWxsIG1vdmUgb24uXG4gICAgd2FpdEZvcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGN0eCA9IHNlbGYuX3RpbGVzW3RpbGVQb2ludC54ICsgXCI6XCIgKyB0aWxlUG9pbnQueV07XG4gICAgICAgIGlmKGN0eCkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24oKXtcbiAgICAgICAgLy9XaGVuIGl0IGZpbmlzaGVzLCBkbyB0aGlzLlxuICAgICAgICBjdHggPSBzZWxmLl90aWxlc1t0aWxlUG9pbnQueCArIFwiOlwiICsgdGlsZVBvaW50LnldO1xuICAgICAgICBwYXJlbnRDdHguY2FudmFzID0gY3R4O1xuICAgICAgICBzZWxmLnBhcnNlVmVjdG9yVGlsZUxheWVyKHZ0bCwgcGFyZW50Q3R4KTtcblxuICAgICAgfSwgLy93aGVuIGRvbmUsIGdvIHRvIG5leHQgZmxvd1xuICAgICAgMjAwMCk7IC8vVGhlIFRpbWVvdXQgbWlsbGlzZWNvbmRzLiAgQWZ0ZXIgdGhpcywgZ2l2ZSB1cCBhbmQgbW92ZSBvblxuXG4gIH0sXG5cbiAgcGFyc2VWZWN0b3JUaWxlTGF5ZXI6IGZ1bmN0aW9uKHZ0bCwgY3R4KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciB0aWxlUG9pbnQgPSBjdHgudGlsZTtcblxuICAgIC8vU2VlIGlmIHdlIGNhbiBwbHVjayB0aGUgc2FtZSB0aWxlIGZyb20gdGhpcyBsb2NhbCB0aWxlIGxheWVyXG4gICAgY3R4LmNhbnZhcyA9IHNlbGYuX3RpbGVzW3RpbGVQb2ludC54ICsgXCI6XCIgKyB0aWxlUG9pbnQueV07XG5cbiAgICAvL0NsZWFyIHRpbGUgLS0gVE9ETzogQWRkIGZsYWcgc28gdGhpcyBvbmx5IGhhcHBlbnMgd2hlbiBhIGxheWVyIGlzIGJlaW5nIHR1cm5lZCBiYWNrIG9uIGFmdGVyIGJlaW5nIGhpZGRlblxuICAgIGlmKGN0eC5jYW52YXMpIGN0eC5jYW52YXMud2lkdGggPSBjdHguY2FudmFzLndpZHRoO1xuXG4gICAgdmFyIGZlYXR1cmVzID0gdGhpcy5mZWF0dXJlcyA9IHZ0bC5wYXJzZWRGZWF0dXJlcztcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZmVhdHVyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciB2dGYgPSBmZWF0dXJlc1tpXSAvL3ZlY3RvciB0aWxlIGZlYXR1cmVcblxuICAgICAgaWYoaSA9PT0gMCl7XG4gICAgICAgIC8vIGhvdyBtdWNoIHdlIGRpdmlkZSB0aGUgY29vcmRpbmF0ZSBmcm9tIHRoZSB2ZWN0b3IgdGlsZVxuICAgICAgICB0aGlzLmRpdmlzb3IgPSB2dGYuZXh0ZW50IC8gY3R4LnRpbGVTaXplO1xuICAgICAgICB0aGlzLmV4dGVudCA9IHZ0Zi5leHRlbnQ7XG4gICAgICAgIHRoaXMudGlsZVNpemUgPSBjdHgudGlsZVNpemU7XG4gICAgICB9XG5cbiAgICAgIC8qKlxuICAgICAgICogQXBwbHkgZmlsdGVyIG9uIGZlYXR1cmUgaWYgdGhlcmUgaXMgb25lLiBEZWZpbmVkIGluIHRoZSBvcHRpb25zIG9iamVjdFxuICAgICAgICogb2YgVGlsZUxheWVyLk1WVFNvdXJjZS5qc1xuICAgICAgICovXG4gICAgICB2YXIgZmlsdGVyID0gc2VsZi5vcHRpb25zLmZpbHRlcjtcbiAgICAgIGlmICh0eXBlb2YgZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGlmICggZmlsdGVyKHZ0ZiwgY3R4KSA9PT0gZmFsc2UgKSBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGxheWVyT3JkZXJpbmcgPSBzZWxmLm9wdGlvbnMubGF5ZXJPcmRlcmluZztcbiAgICAgIGlmICh0eXBlb2YgbGF5ZXJPcmRlcmluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBsYXllck9yZGVyaW5nKHZ0ZiwgY3R4KTsgLy9BcHBsaWVzIGEgY3VzdG9tIHByb3BlcnR5IHRvIHRoZSBmZWF0dXJlLCB3aGljaCBpcyB1c2VkIGFmdGVyIHdlJ3JlIHRocnUgaXRlcmF0aW5nIHRvIHNvcnRcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvL0lmIGEgei1vcmRlciBmdW5jdGlvbiBpcyBzcGVjaWZpZWQsIHdhaXQgdW5pdGwgYWxsIGZlYXR1cmVzIGhhdmUgYmVlbiBpdGVyYXRlZCBvdmVyIHVudGlsIGRyYXdpbmcgKGhlcmUpXG4gICAgLyoqXG4gICAgICogQXBwbHkgc29ydGluZyAoekluZGV4KSBvbiBmZWF0dXJlIGlmIHRoZXJlIGlzIGEgZnVuY3Rpb24gZGVmaW5lZCBpbiB0aGUgb3B0aW9ucyBvYmplY3RcbiAgICAgKiBvZiBUaWxlTGF5ZXIuTVZUU291cmNlLmpzXG4gICAgICovXG4gICAgdmFyIGxheWVyT3JkZXJpbmcgPSBzZWxmLm9wdGlvbnMubGF5ZXJPcmRlcmluZztcbiAgICBpZiAobGF5ZXJPcmRlcmluZykge1xuICAgICAgLy9XZSd2ZSBhc3NpZ25lZCB0aGUgY3VzdG9tIHpJbmRleCBwcm9wZXJ0eSB3aGVuIGl0ZXJhdGluZyBhYm92ZS4gIE5vdyBqdXN0IHNvcnQuXG4gICAgICBzZWxmLnpJbmRleFNvcnRPcmRlciA9IE9iamVjdC5rZXlzKHRoaXMuZmVhdHVyZXMpLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gLShzZWxmLmZlYXR1cmVzW2JdLnByb3BlcnRpZXMuekluZGV4IC0gc2VsZi5mZWF0dXJlc1thXS5wcm9wZXJ0aWVzLnpJbmRleClcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYucmVkcmF3VGlsZShjdHguaWQsIGN0eC56b29tLCBjdHgpO1xuXG4gICAgZm9yICh2YXIgaiA9IDAsIGxlbiA9IHNlbGYuZmVhdHVyZXNXaXRoTGFiZWxzLmxlbmd0aDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICB2YXIgZmVhdCA9IHNlbGYuZmVhdHVyZXNXaXRoTGFiZWxzW2pdO1xuICAgICAgZGVidWcuZmVhdCA9IGZlYXQ7XG5cbiAgICB9XG4gIH0sXG5cbiAgLy8gTk9URTogYSBwbGFjZWhvbGRlciBmb3IgYSBmdW5jdGlvbiB0aGF0LCBnaXZlbiBhIGZlYXR1cmUsIHJldHVybnMgYSBzdHlsZSBvYmplY3QgdXNlZCB0byByZW5kZXIgdGhlIGZlYXR1cmUgaXRzZWxmXG4gIHN0eWxlRm9yOiBmdW5jdGlvbihmZWF0dXJlKSB7XG4gICAgLy8gb3ZlcnJpZGUgd2l0aCB5b3VyIGNvZGVcbiAgfSxcblxuICAvL1RoaXMgaXMgdGhlIG9sZCB3YXkuICBJdCB3b3JrcywgYnV0IGlzIHNsb3cgZm9yIG1vdXNlb3ZlciBldmVudHMuICBGaW5lIGZvciBjbGljayBldmVudHMuXG4gIGhhbmRsZUNsaWNrRXZlbnQ6IGZ1bmN0aW9uKGV2dCwgY2IpIHtcbiAgICAvL0NsaWNrIGhhcHBlbmVkIG9uIHRoZSBHcm91cExheWVyIChNYW5hZ2VyKSBhbmQgcGFzc2VkIGl0IGhlcmVcbiAgICB2YXIgdGlsZUlEID0gZXZ0LnRpbGVJRC5zcGxpdChcIjpcIikuc2xpY2UoMSwgMykuam9pbihcIjpcIik7XG4gICAgdmFyIGNhbnZhcyA9IHRoaXMuX3RpbGVzW3RpbGVJRF07XG4gICAgaWYoIWNhbnZhcykgKGNiKGV2dCkpOyAvL2JyZWFrIG91dFxuICAgIHZhciB4ID0gZXZ0LmxheWVyUG9pbnQueCAtIGNhbnZhcy5fbGVhZmxldF9wb3MueDtcbiAgICB2YXIgeSA9IGV2dC5sYXllclBvaW50LnkgLSBjYW52YXMuX2xlYWZsZXRfcG9zLnk7XG5cbiAgICB2YXIgdGlsZVBvaW50ID0ge3g6IHgsIHk6IHl9O1xuICAgIHZhciBmZWF0dXJlcyA9IHRoaXMuX2NhbnZhc0lEVG9GZWF0dXJlc0Zvclpvb21bZXZ0LnRpbGVJRF0uZmVhdHVyZXM7IC8vU3dpdGNoIHRoaXMuICBOb3Qgc3RvcmluZyB0aGlzIGZvciBwb2ludC5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZmVhdHVyZSA9IGZlYXR1cmVzW2ldO1xuICAgICAgdmFyIHBhdGhzID0gZmVhdHVyZS5nZXRQYXRoc0ZvclRpbGUoZXZ0LnRpbGVJRCwgdGhpcy5fbWFwLmdldFpvb20oKSk7XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHBhdGhzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmICh0aGlzLl9pc1BvaW50SW5Qb2x5KHRpbGVQb2ludCwgcGF0aHNbal0pKSB7XG4gICAgICAgICAgaWYgKGZlYXR1cmUudG9nZ2xlRW5hYmxlZCkge1xuICAgICAgICAgICAgZmVhdHVyZS50b2dnbGUoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZXZ0LmZlYXR1cmUgPSBmZWF0dXJlO1xuICAgICAgICAgIGNiKGV2dCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vbm8gbWF0Y2hcbiAgICAvL3JldHVybiBldnQgd2l0aCBlbXB0eSBmZWF0dXJlXG4gICAgZXZ0LmZlYXR1cmUgPSBudWxsO1xuICAgIGNiKGV2dCk7XG4gIH0sXG5cbiAgY2xlYXJUaWxlOiBmdW5jdGlvbihjdHgpIHtcbiAgICBjdHguY2FudmFzLndpZHRoID0gY3R4LmNhbnZhcy53aWR0aDtcbiAgfSxcblxuICByZWRyYXdUaWxlOiBmdW5jdGlvbihjYW52YXNJRCwgem9vbSwgY3R4KSB7XG4gICAgLy9HZXQgdGhlIGZlYXR1cmVzIGZvciB0aGlzIHRpbGUsIGFuZCByZWRyYXcgdGhlbS5cbiAgICB2YXIgZmVhdHVyZXMgPSB0aGlzLmZlYXR1cmVzO1xuXG4gICAgLy9pZiB6LWluZGV4IGZ1bmN0aW9uIGlzIHNwZWNpZmllZCwgc29ydCB0aGUgZmVhdHVyZXMgc28gdGhleSBkcmF3IGluIHRoZSBjb3JyZWN0IG9yZGVyLCBib3R0b20gcG9pbnRzIGRyYXcgZmlyc3QuXG4gICAgaWYodGhpcy56SW5kZXhTb3J0T3JkZXIgJiYgdGhpcy56SW5kZXhTb3J0T3JkZXIubGVuZ3RoID4gMCl7XG4gICAgICAvL0xvb3AgaW4gc3BlY2lmaWMgb3JkZXJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy56SW5kZXhTb3J0T3JkZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGlkID0gdGhpcy56SW5kZXhTb3J0T3JkZXJbaV07XG4gICAgICAgIHZhciBmZWF0dXJlID0gZmVhdHVyZXNbaWRdO1xuICAgICAgICBpZihmZWF0dXJlKXtcbiAgICAgICAgICB0aGlzLmRyYXdQb2ludChjdHgsIGZlYXR1cmUuY29vcmRpbmF0ZXMsIHRoaXMuc3R5bGVGb3IoZmVhdHVyZSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2V7XG4gICAgICAvL0p1c3QgbG9vcCBhbHJlYWR5XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBmZWF0dXJlID0gZmVhdHVyZXNbaV07XG4gICAgICAgIHRoaXMuZHJhd1BvaW50KGN0eCwgZmVhdHVyZS5jb29yZGluYXRlcywgdGhpcy5zdHlsZUZvcihmZWF0dXJlKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy9SZW1vdmUgZmVhdHVyZXNcbiAgICB0aGlzLmZlYXR1cmVzID0ge307XG4gIH0sXG5cbiAgbGlua2VkTGF5ZXI6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsaW5rTmFtZSA9IHRoaXMubXZ0U291cmNlLmxheWVyTGluayh0aGlzLm5hbWUpO1xuICAgIHJldHVybiB0aGlzLm12dFNvdXJjZS5sYXllcnNbbGlua05hbWVdO1xuICB9LFxuXG4gIGRyYXdQb2ludDogZnVuY3Rpb24oY3R4LCBjb29yZHNBcnJheSwgc3R5bGUpIHtcbiAgICBpZiAoIXN0eWxlKSByZXR1cm47XG5cbiAgICB2YXIgcmFkaXVzID0gMTtcbiAgICBpZiAodHlwZW9mIHN0eWxlLnJhZGl1cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmFkaXVzID0gc3R5bGUucmFkaXVzKGN0eC56b29tKTsgLy9BbGxvd3MgZm9yIHNjYWxlIGRlcGVuZGVudCByZWRuZXJpbmdcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICByYWRpdXMgPSBzdHlsZS5yYWRpdXM7XG4gICAgfVxuXG4gICAgdmFyIHAgPSB0aGlzLl90aWxlUG9pbnQoY29vcmRzQXJyYXlbMF1bMF0pO1xuICAgIHZhciBjID0gY3R4LmNhbnZhcztcbiAgICB2YXIgZyA9IGMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBnLmJlZ2luUGF0aCgpO1xuICAgIGcuZmlsbFN0eWxlID0gc3R5bGUuY29sb3I7XG4gICAgZy5hcmMocC54LCBwLnksIHJhZGl1cywgMCwgTWF0aC5QSSAqIDIpO1xuICAgIGcuY2xvc2VQYXRoKCk7XG4gICAgZy5maWxsKCk7XG4gICAgZy5yZXN0b3JlKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUYWtlcyBhIGNvb3JkaW5hdGUgZnJvbSBhIHZlY3RvciB0aWxlIGFuZCB0dXJucyBpdCBpbnRvIGEgTGVhZmxldCBQb2ludC5cbiAgICpcbiAgICogQHBhcmFtIGN0eFxuICAgKiBAcGFyYW0gY29vcmRzXG4gICAqIEByZXR1cm5zIHtlR2VvbVR5cGUuUG9pbnR9XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfdGlsZVBvaW50OiBmdW5jdGlvbihjb29yZHMpIHtcbiAgICByZXR1cm4gbmV3IEwuUG9pbnQoY29vcmRzLnggLyB0aGlzLmRpdmlzb3IsIGNvb3Jkcy55IC8gdGhpcy5kaXZpc29yKTtcbiAgfVxuXG59KTtcblxuLyoqXG4gKiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2FyaXlhL3BoYW50b21qcy9ibG9iL21hc3Rlci9leGFtcGxlcy93YWl0Zm9yLmpzXG4gKlxuICogV2FpdCB1bnRpbCB0aGUgdGVzdCBjb25kaXRpb24gaXMgdHJ1ZSBvciBhIHRpbWVvdXQgb2NjdXJzLiBVc2VmdWwgZm9yIHdhaXRpbmdcbiAqIG9uIGEgc2VydmVyIHJlc3BvbnNlIG9yIGZvciBhIHVpIGNoYW5nZSAoZmFkZUluLCBldGMuKSB0byBvY2N1ci5cbiAqXG4gKiBAcGFyYW0gdGVzdEZ4IGphdmFzY3JpcHQgY29uZGl0aW9uIHRoYXQgZXZhbHVhdGVzIHRvIGEgYm9vbGVhbixcbiAqIGl0IGNhbiBiZSBwYXNzZWQgaW4gYXMgYSBzdHJpbmcgKGUuZy46IFwiMSA9PSAxXCIgb3IgXCIkKCcjYmFyJykuaXMoJzp2aXNpYmxlJylcIiBvclxuICogYXMgYSBjYWxsYmFjayBmdW5jdGlvbi5cbiAqIEBwYXJhbSBvblJlYWR5IHdoYXQgdG8gZG8gd2hlbiB0ZXN0RnggY29uZGl0aW9uIGlzIGZ1bGZpbGxlZCxcbiAqIGl0IGNhbiBiZSBwYXNzZWQgaW4gYXMgYSBzdHJpbmcgKGUuZy46IFwiMSA9PSAxXCIgb3IgXCIkKCcjYmFyJykuaXMoJzp2aXNpYmxlJylcIiBvclxuICogYXMgYSBjYWxsYmFjayBmdW5jdGlvbi5cbiAqIEBwYXJhbSB0aW1lT3V0TWlsbGlzIHRoZSBtYXggYW1vdW50IG9mIHRpbWUgdG8gd2FpdC4gSWYgbm90IHNwZWNpZmllZCwgMyBzZWMgaXMgdXNlZC5cbiAqL1xuZnVuY3Rpb24gd2FpdEZvcih0ZXN0RngsIG9uUmVhZHksIHRpbWVPdXRNaWxsaXMpIHtcbiAgdmFyIG1heHRpbWVPdXRNaWxsaXMgPSB0aW1lT3V0TWlsbGlzID8gdGltZU91dE1pbGxpcyA6IDMwMDAsIC8vPCBEZWZhdWx0IE1heCBUaW1vdXQgaXMgM3NcbiAgICBzdGFydCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgIGNvbmRpdGlvbiA9ICh0eXBlb2YgKHRlc3RGeCkgPT09IFwic3RyaW5nXCIgPyBldmFsKHRlc3RGeCkgOiB0ZXN0RngoKSksIC8vPCBkZWZlbnNpdmUgY29kZVxuICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHN0YXJ0IDwgbWF4dGltZU91dE1pbGxpcykgJiYgIWNvbmRpdGlvbikge1xuICAgICAgICAvLyBJZiBub3QgdGltZS1vdXQgeWV0IGFuZCBjb25kaXRpb24gbm90IHlldCBmdWxmaWxsZWRcbiAgICAgICAgY29uZGl0aW9uID0gKHR5cGVvZiAodGVzdEZ4KSA9PT0gXCJzdHJpbmdcIiA/IGV2YWwodGVzdEZ4KSA6IHRlc3RGeCgpKTsgLy88IGRlZmVuc2l2ZSBjb2RlXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgICAgIC8vIElmIGNvbmRpdGlvbiBzdGlsbCBub3QgZnVsZmlsbGVkICh0aW1lb3V0IGJ1dCBjb25kaXRpb24gaXMgJ2ZhbHNlJylcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIid3YWl0Rm9yKCknIHRpbWVvdXRcIik7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7IC8vPCBTdG9wIHRoaXMgaW50ZXJ2YWxcbiAgICAgICAgICB0eXBlb2YgKG9uUmVhZHkpID09PSBcInN0cmluZ1wiID8gZXZhbChvblJlYWR5KSA6IG9uUmVhZHkoJ3RpbWVvdXQnKTsgLy88IERvIHdoYXQgaXQncyBzdXBwb3NlZCB0byBkbyBvbmNlIHRoZSBjb25kaXRpb24gaXMgZnVsZmlsbGVkXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQ29uZGl0aW9uIGZ1bGZpbGxlZCAodGltZW91dCBhbmQvb3IgY29uZGl0aW9uIGlzICd0cnVlJylcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIid3YWl0Rm9yKCknIGZpbmlzaGVkIGluIFwiICsgKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnQpICsgXCJtcy5cIik7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7IC8vPCBTdG9wIHRoaXMgaW50ZXJ2YWxcbiAgICAgICAgICB0eXBlb2YgKG9uUmVhZHkpID09PSBcInN0cmluZ1wiID8gZXZhbChvblJlYWR5KSA6IG9uUmVhZHkoJ3N1Y2Nlc3MnKTsgLy88IERvIHdoYXQgaXQncyBzdXBwb3NlZCB0byBkbyBvbmNlIHRoZSBjb25kaXRpb24gaXMgZnVsZmlsbGVkXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LCA1MCk7IC8vPCByZXBlYXQgY2hlY2sgZXZlcnkgNTBtc1xufTsiLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcbnZhciBWZWN0b3JUaWxlID0gcmVxdWlyZSgndmVjdG9yLXRpbGUnKS5WZWN0b3JUaWxlO1xudmFyIFByb3RvYnVmID0gcmVxdWlyZSgncGJmJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCdwb2ludC1nZW9tZXRyeScpO1xuXG52YXIgVXRpbCA9IHJlcXVpcmUoJy4vTVZUVXRpbCcpO1xudmFyIE1WVExheWVyID0gcmVxdWlyZSgnLi9NVlRMYXllcicpO1xudmFyIE1WVFBvaW50TGF5ZXIgPSByZXF1aXJlKCcuL01WVFBvaW50TGF5ZXInKTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEwuVGlsZUxheWVyLk1WVFNvdXJjZSA9IEwuVGlsZUxheWVyLkNhbnZhcy5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBkZWJ1ZzogZmFsc2UsXG4gICAgdXJsOiBcIlwiLCAvL1VSTCBUTyBWZWN0b3IgVGlsZSBTb3VyY2UsXG4gICAgY2xpY2thYmxlTGF5ZXJzOiBbXSwgLy93aGljaCBsYXllcnMgaW5zaWRlIHRoZSB2ZWN0b3IgdGlsZSBzaG91bGQgaGF2ZSBjbGljayBldmVudHM/XG4gICAgZ2V0SURGb3JMYXllckZlYXR1cmU6IGZ1bmN0aW9uKCkge30sXG4gICAgdGlsZVNpemU6IDI1NlxuICB9LFxuICBsYXllcnM6IHt9LCAvL0tlZXAgYSBsaXN0IG9mIHRoZSBsYXllcnMgY29udGFpbmVkIGluIHRoZSBQQkZzXG4gIHByb2Nlc3NlZFRpbGVzOiB7fSwgLy9LZWVwIGEgbGlzdCBvZiB0aWxlcyB0aGF0IGhhdmUgYmVlbiBwcm9jZXNzZWQgYWxyZWFkeVxuICBfZXZlbnRIYW5kbGVyczoge30sXG4gIHN0eWxlRm9yOiBmdW5jdGlvbigpIHt9LFxuXG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgLy9hIGxpc3Qgb2YgdGhlIGxheWVycyBjb250YWluZWQgaW4gdGhlIFBCRnNcbiAgICB0aGlzLmxheWVycyA9IHt9O1xuXG4gICAgLy8gdGlsZXMgY3VycmVudGx5IGluIHRoZSB2aWV3cG9ydFxuICAgIHRoaXMuYWN0aXZlVGlsZXMgPSB7fTtcblxuICAgIC8vIHRoYXRzIHRoYXQgaGF2ZSBiZWVuIGxvYWRlZCBhbmQgZHJhd25cbiAgICB0aGlzLmxvYWRlZFRpbGVzID0ge307XG5cbiAgICB0aGlzLnN0eWxlRm9yID0gb3B0aW9ucy5zdHlsZUZvcjtcblxuICAgIHRoaXMubGF5ZXJMaW5rID0gb3B0aW9ucy5sYXllckxpbms7XG5cbiAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG5cbiAgICB0aGlzLl90aWxlc1RvUHJvY2VzcyA9IDA7IC8vc3RvcmUgdGhlIG1heCBudW1iZXIgb2YgdGlsZXMgdG8gYmUgbG9hZGVkLiAgTGF0ZXIsIHdlIGNhbiB1c2UgdGhpcyBjb3VudCB0byBjb3VudCBkb3duIFBCRiBsb2FkaW5nLlxuXG4gIH0sXG5cbiAgb25BZGQ6IGZ1bmN0aW9uKG1hcCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBMLlRpbGVMYXllci5DYW52YXMucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcblxuLy8gICAgZGV0ZXJtaW5lQWN0aXZlVGlsZXMoc2VsZiwgbWFwKTtcbi8vICAgIG1hcC5vbignbW92ZWVuZCcsIGZ1bmN0aW9uKGV2dCkge1xuLy8gICAgICBkZXRlcm1pbmVBY3RpdmVUaWxlcyhzZWxmLCBtYXApO1xuLy8gICAgfSk7XG5cbiAgICBpZiAodHlwZW9mIER5bmFtaWNMYWJlbCA9PT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgIHRoaXMuZHluYW1pY0xhYmVsID0gbmV3IER5bmFtaWNMYWJlbChtYXAsIHRoaXMsIHt9KTtcbiAgICB9XG5cbiAgfSxcblxuICBkcmF3VGlsZTogZnVuY3Rpb24oY2FudmFzLCB0aWxlUG9pbnQsIHpvb20pIHtcbiAgICB2YXIgY3R4ID0ge1xuICAgICAgaWQ6IFt6b29tLCB0aWxlUG9pbnQueCwgdGlsZVBvaW50LnldLmpvaW4oXCI6XCIpLFxuICAgICAgY2FudmFzOiBjYW52YXMsXG4gICAgICB0aWxlOiB0aWxlUG9pbnQsXG4gICAgICB6b29tOiB6b29tLFxuICAgICAgdGlsZVNpemU6IHRoaXMub3B0aW9ucy50aWxlU2l6ZVxuICAgIH07XG5cbiAgICAvL0NhcHR1cmUgdGhlIG1heCBudW1iZXIgb2YgdGhlIHRpbGVzIHRvIGxvYWQgaGVyZS4gdGhpcy5fdGlsZXNUb1Byb2Nlc3MgaXMgYW4gaW50ZXJuYWwgbnVtYmVyIHdlIHVzZSB0byBrbm93IHdoZW4gd2UndmUgZmluaXNoZWQgcmVxdWVzdGluZyBQQkZzLlxuICAgIGlmKHRoaXMuX3RpbGVzVG9Qcm9jZXNzIDwgdGhpcy5fdGlsZXNUb0xvYWQpIHRoaXMuX3RpbGVzVG9Qcm9jZXNzID0gdGhpcy5fdGlsZXNUb0xvYWQ7XG5cbiAgICB2YXIgaWQgPSBjdHguaWQgPSBVdGlsLmdldENvbnRleHRJRChjdHgpO1xuICAgIHRoaXMuYWN0aXZlVGlsZXNbaWRdID0gY3R4O1xuXG4gICAgaWYoIXRoaXMucHJvY2Vzc2VkVGlsZXNbY3R4Lnpvb21dKSB0aGlzLnByb2Nlc3NlZFRpbGVzW2N0eC56b29tXSA9IHt9O1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kZWJ1Zykge1xuICAgICAgdGhpcy5fZHJhd0RlYnVnSW5mbyhjdHgpO1xuICAgIH1cbiAgICB0aGlzLl9kcmF3KGN0eCk7XG4gIH0sXG5cbiAgc2V0T3BhY2l0eTpmdW5jdGlvbihvcGFjaXR5KSB7XG4gICAgdGhpcy5fc2V0VmlzaWJsZUxheWVyc1N0eWxlKCdvcGFjaXR5JyxvcGFjaXR5KTtcbiAgfSxcblxuICBzZXRaSW5kZXg6ZnVuY3Rpb24oekluZGV4KSB7XG4gICAgdGhpcy5fc2V0VmlzaWJsZUxheWVyc1N0eWxlKCd6SW5kZXgnLHpJbmRleCk7XG4gIH0sXG5cbiAgX3NldFZpc2libGVMYXllcnNTdHlsZTpmdW5jdGlvbihzdHlsZSwgdmFsdWUpIHtcbiAgICBmb3IodmFyIGtleSBpbiB0aGlzLmxheWVycykge1xuICAgICAgdGhpcy5sYXllcnNba2V5XS5fdGlsZUNvbnRhaW5lci5zdHlsZVtzdHlsZV0gPSB2YWx1ZTtcbiAgICB9XG4gIH0sXG5cbiAgX2RyYXdEZWJ1Z0luZm86IGZ1bmN0aW9uKGN0eCkge1xuICAgIHZhciBtYXggPSB0aGlzLm9wdGlvbnMudGlsZVNpemU7XG4gICAgdmFyIGcgPSBjdHguY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgZy5zdHJva2VTdHlsZSA9ICcjMDAwMDAwJztcbiAgICBnLmZpbGxTdHlsZSA9ICcjRkZGRjAwJztcbiAgICBnLnN0cm9rZVJlY3QoMCwgMCwgbWF4LCBtYXgpO1xuICAgIGcuZm9udCA9IFwiMTJweCBBcmlhbFwiO1xuICAgIGcuZmlsbFJlY3QoMCwgMCwgNSwgNSk7XG4gICAgZy5maWxsUmVjdCgwLCBtYXggLSA1LCA1LCA1KTtcbiAgICBnLmZpbGxSZWN0KG1heCAtIDUsIDAsIDUsIDUpO1xuICAgIGcuZmlsbFJlY3QobWF4IC0gNSwgbWF4IC0gNSwgNSwgNSk7XG4gICAgZy5maWxsUmVjdChtYXggLyAyIC0gNSwgbWF4IC8gMiAtIDUsIDEwLCAxMCk7XG4gICAgZy5zdHJva2VUZXh0KGN0eC56b29tICsgJyAnICsgY3R4LnRpbGUueCArICcgJyArIGN0eC50aWxlLnksIG1heCAvIDIgLSAzMCwgbWF4IC8gMiAtIDEwKTtcbiAgfSxcblxuICBfZHJhdzogZnVuY3Rpb24oY3R4KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy9UaGlzIHdvcmtzIHRvIHNraXAgZmV0Y2hpbmcgYW5kIHByb2Nlc3NpbmcgdGlsZXMgaWYgdGhleSd2ZSBhbHJlYWR5IGJlZW4gcHJvY2Vzc2VkLlxuICAgIHZhciB2ZWN0b3JUaWxlID0gdGhpcy5wcm9jZXNzZWRUaWxlc1tjdHguem9vbV1bY3R4LmlkXTtcbiAgICAvL2lmIHdlJ3ZlIGFscmVhZHkgcGFyc2VkIGl0LCBkb24ndCBnZXQgaXQgYWdhaW4uXG4gICAgaWYodmVjdG9yVGlsZSl7XG4gICAgICBjb25zb2xlLmxvZyhcIlNraXBwaW5nIGZldGNoaW5nIFwiICsgY3R4LmlkKTtcbiAgICAgIHNlbGYucGFyc2VWZWN0b3JUaWxlKHBhcnNlVlQodmVjdG9yVGlsZSksIGN0eCwgdHJ1ZSk7XG4gICAgICBzZWxmLnJlZHVjZVRpbGVzVG9Qcm9jZXNzQ291bnQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMub3B0aW9ucy51cmwpIHJldHVybjtcbiAgICB2YXIgdXJsID0gc2VsZi5vcHRpb25zLnVybC5yZXBsYWNlKFwie3p9XCIsIGN0eC56b29tKS5yZXBsYWNlKFwie3h9XCIsIGN0eC50aWxlLngpLnJlcGxhY2UoXCJ7eX1cIiwgY3R4LnRpbGUueSk7XG5cbiAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHhoci5zdGF0dXMgPT0gXCIyMDBcIikge1xuXG4gICAgICAgIGlmKCF4aHIucmVzcG9uc2UpIHJldHVybjtcblxuICAgICAgICB2YXIgYXJyYXlCdWZmZXIgPSBuZXcgVWludDhBcnJheSh4aHIucmVzcG9uc2UpO1xuICAgICAgICB2YXIgYnVmID0gbmV3IFByb3RvYnVmKGFycmF5QnVmZmVyKTtcbiAgICAgICAgdmFyIHZ0ID0gbmV3IFZlY3RvclRpbGUoYnVmKTtcbiAgICAgICAgc2VsZi5wYXJzZVZlY3RvclRpbGUocGFyc2VWVCh2dCksIGN0eCk7XG4gICAgICAgIHRpbGVMb2FkZWQoc2VsZiwgY3R4KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInhoci5zdGF0dXMgPSBcIiArIHhoci5zdGF0dXMpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc29sZS5sb2coXCJ4aHIgZXJyb3I6IFwiICsgeGhyLmVycm9yQ29kZSlcbiAgICB9O1xuXG4gICAgeGhyLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7IC8vYXN5bmMgaXMgdHJ1ZVxuICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgIHhoci5zZW5kKCk7XG5cbiAgICAvL2VpdGhlciB3YXksIHJlZHVjZSB0aGUgY291bnQgb2YgdGlsZXNUb1Byb2Nlc3MgdGlsZXMgaGVyZVxuICAgIHNlbGYucmVkdWNlVGlsZXNUb1Byb2Nlc3NDb3VudCgpO1xuICB9LFxuXG4gIHJlZHVjZVRpbGVzVG9Qcm9jZXNzQ291bnQ6IGZ1bmN0aW9uKCl7XG4gICAgdGhpcy5fdGlsZXNUb1Byb2Nlc3MtLTtcbiAgICBpZighdGhpcy5fdGlsZXNUb1Byb2Nlc3Mpe1xuICAgICAgLy9UcmlnZ2VyIGV2ZW50IGxldHRpbmcgdXMga25vdyB0aGF0IGFsbCBQQkZzIGhhdmUgYmVlbiBsb2FkZWQgYW5kIHByb2Nlc3NlZCAob3IgNDA0J2QpLlxuICAgICAgaWYodGhpcy5fZXZlbnRIYW5kbGVyc1tcIlBCRkxvYWRcIl0pIHRoaXMuX2V2ZW50SGFuZGxlcnNbXCJQQkZMb2FkXCJdKCk7XG4gICAgfVxuICB9LFxuXG4gIHBhcnNlVmVjdG9yVGlsZTogZnVuY3Rpb24odnQsIGN0eCwgcGFyc2VkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgZm9yICh2YXIga2V5IGluIHZ0LmxheWVycykge1xuICAgICAgdmFyIGx5ciA9IHZ0LmxheWVyc1trZXldO1xuICAgICAgaWYgKCFzZWxmLmxheWVyc1trZXldKSB7XG4gICAgICAgIC8vQ3JlYXRlIE1WVExheWVyIG9yIE1WVFBvaW50TGF5ZXIgZm9yIHVzZXJcbiAgICAgICAgc2VsZi5sYXllcnNba2V5XSA9IHNlbGYuY3JlYXRlUEJGTGF5ZXIoa2V5LCBseXIucGFyc2VkRmVhdHVyZXNbMF0udHlwZSB8fCBudWxsKTtcbiAgICAgIH1cblxuICAgICAgLy9JZiBsYXllciBpcyBtYXJrZWQgYXMgdmlzaWJsZSwgZXhhbWluZSB0aGUgY29udGVudHMuXG4gICAgICBpZiAoc2VsZi5sYXllcnNba2V5XS52aXNpYmxlID09PSB0cnVlKSB7XG4gICAgICAgIGlmKHBhcnNlZCl7XG4gICAgICAgICAgLy9XZSd2ZSBhbHJlYWR5IHBhcnNlZCBpdC4gIEdvIGdldCBjYW52YXMgYW5kIGRyYXcuXG4gICAgICAgICAgc2VsZi5sYXllcnNba2V5XS5nZXRDYW52YXMoY3R4LCBseXIpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICBzZWxmLmxheWVyc1trZXldLnBhcnNlVmVjdG9yVGlsZUxheWVyKGx5ciwgY3R4KTtcblxuICAgICAgICAgIC8vaWYgd2UgaGF2ZSBhIHJlYXNvbmFibGUgYW1vdW50IG9mIGZlYXR1cmVzIGluc2lkZSwgbGV0cyBzdG9yZSBpdCBpbiBtZW1vcnkuICBPdGhlcndpc2UsIGZldGNoIGV2ZXJ5IHRpbWUgdG8gYXZvaWQgbWVtb3J5IHBpbGV1cC5cbiAgICAgICAgICBpZihseXIucGFyc2VkRmVhdHVyZXMubGVuZ3RoIDwgMjUpe1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzZWRUaWxlc1tjdHguem9vbV1bY3R4LmlkXSA9IHZ0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vTWFrZSBzdXJlIG1hbmFnZXIgbGF5ZXIgaXMgYWx3YXlzIGluIGZyb250XG4gICAgdGhpcy5icmluZ1RvRnJvbnQoKTtcbiAgfSxcblxuICBjcmVhdGVQQkZMYXllcjogZnVuY3Rpb24oa2V5LCB0eXBlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIGdldElERm9yTGF5ZXJGZWF0dXJlO1xuICAgIGlmICh0eXBlb2Ygc2VsZi5vcHRpb25zLmdldElERm9yTGF5ZXJGZWF0dXJlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBnZXRJREZvckxheWVyRmVhdHVyZSA9IHNlbGYub3B0aW9ucy5nZXRJREZvckxheWVyRmVhdHVyZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZ2V0SURGb3JMYXllckZlYXR1cmUgPSBVdGlsLmdldElERm9yTGF5ZXJGZWF0dXJlO1xuICAgIH1cblxuICAgIC8vVGFrZSB0aGUgbGF5ZXIgYW5kIGNyZWF0ZSBhIG5ldyBNVlRMYXllciBvciBNVlRQb2ludExheWVyIGlmIG9uZSBkb2Vzbid0IGV4aXN0LlxuICAgIHZhciBsYXllcjtcblxuLy8gICAgaWYodHlwZSA9PT0gMSl7XG4vLyAgICAgIC8vUG9pbnQgTGF5ZXJcbi8vICAgICAgbGF5ZXIgPSBuZXcgTC5UaWxlTGF5ZXIuTVZUUG9pbnRMYXllcihzZWxmLCB7XG4vLyAgICAgICAgZ2V0SURGb3JMYXllckZlYXR1cmU6IGdldElERm9yTGF5ZXJGZWF0dXJlLFxuLy8gICAgICAgIGZpbHRlcjogc2VsZi5vcHRpb25zLmZpbHRlcixcbi8vICAgICAgICBsYXllck9yZGVyaW5nOiBzZWxmLm9wdGlvbnMubGF5ZXJPcmRlcmluZyxcbi8vICAgICAgICBzdHlsZUZvcjogc2VsZi5zdHlsZUZvcixcbi8vICAgICAgICBuYW1lOiBrZXksXG4vLyAgICAgICAgYXN5bmNoOiB0cnVlXG4vLyAgICAgIH0pLmFkZFRvKHNlbGYuX21hcCk7XG4vLyAgICB9ZWxzZXtcbiAgICAgIC8vUG9seWdvbi9MaW5lIExheWVyXG4gICAgICBsYXllciA9IG5ldyBNVlRMYXllcihzZWxmLCB7XG4gICAgICAgIGdldElERm9yTGF5ZXJGZWF0dXJlOiBnZXRJREZvckxheWVyRmVhdHVyZSxcbiAgICAgICAgZmlsdGVyOiBzZWxmLm9wdGlvbnMuZmlsdGVyLFxuICAgICAgICBsYXllck9yZGVyaW5nOiBzZWxmLm9wdGlvbnMubGF5ZXJPcmRlcmluZyxcbiAgICAgICAgc3R5bGVGb3I6IHNlbGYuc3R5bGVGb3IsXG4gICAgICAgIG5hbWU6IGtleSxcbiAgICAgICAgYXN5bmNoOiB0cnVlXG4gICAgICB9KS5hZGRUbyhzZWxmLl9tYXApO1xuICAgIC8vfVxuXG4gICAgcmV0dXJuIGxheWVyO1xuICB9LFxuXG4gIGdldExheWVyczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubGF5ZXJzO1xuICB9LFxuXG4gIGhpZGVMYXllcjogZnVuY3Rpb24oaWQpIHtcbiAgICBpZiAodGhpcy5sYXllcnNbaWRdKSB7XG4gICAgICB0aGlzLl9tYXAucmVtb3ZlTGF5ZXIodGhpcy5sYXllcnNbaWRdKTtcbiAgICAgIHRoaXMubGF5ZXJzW2lkXS52aXNpYmxlID0gZmFsc2U7XG4gICAgfVxuICB9LFxuXG4gIHNob3dMYXllcjogZnVuY3Rpb24oaWQpIHtcbiAgICBpZiAodGhpcy5sYXllcnNbaWRdKSB7XG4gICAgICB0aGlzLmxheWVyc1tpZF0udmlzaWJsZSA9IHRydWU7XG4gICAgICB0aGlzLl9tYXAuYWRkTGF5ZXIodGhpcy5sYXllcnNbaWRdKTtcbiAgICB9XG4gICAgLy9NYWtlIHN1cmUgbWFuYWdlciBsYXllciBpcyBhbHdheXMgaW4gZnJvbnRcbiAgICB0aGlzLmJyaW5nVG9Gcm9udCgpO1xuICB9LFxuXG4gIHJlbW92ZUNoaWxkTGF5ZXJzOiBmdW5jdGlvbihtYXApe1xuICAgIC8vUmVtb3ZlIGNoaWxkIGxheWVycyBvZiB0aGlzIGdyb3VwIGxheWVyXG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMubGF5ZXJzKSB7XG4gICAgICB2YXIgbGF5ZXIgPSB0aGlzLmxheWVyc1trZXldO1xuICAgICAgbWFwLnJlbW92ZUxheWVyKGxheWVyKTtcbiAgICB9XG4gIH0sXG5cbiAgYmluZDogZnVuY3Rpb24oZXZlbnRUeXBlLCBjYWxsYmFjaykge1xuICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRUeXBlXSA9IGNhbGxiYWNrO1xuICB9LFxuXG4gIG9uQ2xpY2s6IGZ1bmN0aW9uKGV2dCwgY2IpIHtcbiAgICAvL0hlcmUsIHBhc3MgdGhlIGV2ZW50IG9uIHRvIHRoZSBjaGlsZCBNVlRMYXllciBhbmQgaGF2ZSBpdCBkbyB0aGUgaGl0IHRlc3QgYW5kIGhhbmRsZSB0aGUgcmVzdWx0LlxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGV2dC50aWxlSUQgPSAgZ2V0VGlsZVVSTChldnQubGF0bG5nLmxhdCwgZXZ0LmxhdGxuZy5sbmcsIHRoaXMuX21hcC5nZXRab29tKCkpO1xuXG4gICAgLy9JZiBubyBsYXllciBpcyBzcGVjaWZpZWQgYXMgY2xpY2thYmxlLCBqdXN0IHVzZSB0aGUgMXN0IG9uZS5cbiAgICBpZih0aGlzLm9wdGlvbnMuY2xpY2thYmxlTGF5ZXJzLmxlbmd0aCA9PSAwKSB7XG4gICAgICB2YXIgbmFtZXMgPSBPYmplY3Qua2V5cyhzZWxmLmxheWVycyk7XG4gICAgICBzZWxmLmxheWVyc1tuYW1lc1swXV0uaGFuZGxlQ2xpY2tFdmVudChldnQsIGZ1bmN0aW9uIChldnQpIHtcbiAgICAgICAgY2IoZXZ0KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNle1xuICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMubGF5ZXJzKSB7XG4gICAgICAgIHZhciBsYXllciA9IHRoaXMubGF5ZXJzW2tleV07XG4gICAgICAgIGlmKHNlbGYub3B0aW9ucy5jbGlja2FibGVMYXllcnMuaW5kZXhPZihrZXkpID4gLTEpe1xuICAgICAgICAgIGxheWVyLmhhbmRsZUNsaWNrRXZlbnQoZXZ0LCBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgIGNiKGV2dCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG5cbmlmICh0eXBlb2YoTnVtYmVyLnByb3RvdHlwZS50b1JhZCkgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgTnVtYmVyLnByb3RvdHlwZS50b1JhZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzICogTWF0aC5QSSAvIDE4MDtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRUaWxlVVJMKGxhdCwgbG9uLCB6b29tKSB7XG4gIHZhciB4dGlsZSA9IHBhcnNlSW50KE1hdGguZmxvb3IoIChsb24gKyAxODApIC8gMzYwICogKDE8PHpvb20pICkpO1xuICB2YXIgeXRpbGUgPSBwYXJzZUludChNYXRoLmZsb29yKCAoMSAtIE1hdGgubG9nKE1hdGgudGFuKGxhdC50b1JhZCgpKSArIDEgLyBNYXRoLmNvcyhsYXQudG9SYWQoKSkpIC8gTWF0aC5QSSkgLyAyICogKDE8PHpvb20pICkpO1xuICByZXR1cm4gXCJcIiArIHpvb20gKyBcIjpcIiArIHh0aWxlICsgXCI6XCIgKyB5dGlsZTtcbn1cblxuZnVuY3Rpb24gdGlsZUxvYWRlZChwYmZTb3VyY2UsIGN0eCkge1xuICBwYmZTb3VyY2UubG9hZGVkVGlsZXNbY3R4LmlkXSA9IGN0eDtcbn1cblxuZnVuY3Rpb24gcGFyc2VWVCh2dCl7XG4gIGZvciAodmFyIGtleSBpbiB2dC5sYXllcnMpIHtcbiAgICB2YXIgbHlyID0gdnQubGF5ZXJzW2tleV07XG4gICAgcGFyc2VWVEZlYXR1cmVzKGx5cik7XG4gIH1cbiAgcmV0dXJuIHZ0O1xufVxuXG5mdW5jdGlvbiBwYXJzZVZURmVhdHVyZXModnRsKXtcbiAgdnRsLnBhcnNlZEZlYXR1cmVzID0gW107XG4gIHZhciBmZWF0dXJlcyA9IHZ0bC5fZmVhdHVyZXM7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciB2dGYgPSB2dGwuZmVhdHVyZShpKTtcbiAgICB2dGYuY29vcmRpbmF0ZXMgPSB2dGYubG9hZEdlb21ldHJ5KCk7XG4gICAgdnRsLnBhcnNlZEZlYXR1cmVzLnB1c2godnRmKTtcbiAgfVxuICByZXR1cm4gdnRsO1xufVxuIiwiLyoqXG4gKiBDcmVhdGVkIGJ5IE5pY2hvbGFzIEhhbGxhaGFuIDxuaGFsbGFoYW5Ac3BhdGlhbGRldi5jb20+XG4gKiAgICAgICBvbiA4LzE1LzE0LlxuICovXG5cbnZhciBVdGlsID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuVXRpbC5nZXRDb250ZXh0SUQgPSBmdW5jdGlvbihjdHgpIHtcbiAgcmV0dXJuIFtjdHguem9vbSwgY3R4LnRpbGUueCwgY3R4LnRpbGUueV0uam9pbihcIjpcIik7XG59O1xuXG4vKipcbiAqIERlZmF1bHQgZnVuY3Rpb24gdGhhdCBnZXRzIHRoZSBpZCBmb3IgYSBsYXllciBmZWF0dXJlLlxuICogU29tZXRpbWVzIHRoaXMgbmVlZHMgdG8gYmUgZG9uZSBpbiBhIGRpZmZlcmVudCB3YXkgYW5kXG4gKiBjYW4gYmUgc3BlY2lmaWVkIGJ5IHRoZSB1c2VyIGluIHRoZSBvcHRpb25zIGZvciBMLlRpbGVMYXllci5NVlRTb3VyY2UuXG4gKlxuICogQHBhcmFtIGZlYXR1cmVcbiAqIEByZXR1cm5zIHtjdHguaWR8KnxpZHxzdHJpbmd8anN0cy5pbmRleC5jaGFpbi5Nb25vdG9uZUNoYWluLmlkfG51bWJlcn1cbiAqL1xuVXRpbC5nZXRJREZvckxheWVyRmVhdHVyZSA9IGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy5pZDtcbn07XG4iLCIvKipcbiAqIENyZWF0ZWQgYnkgTmljaG9sYXMgSGFsbGFoYW4gPG5oYWxsYWhhbkBzcGF0aWFsZGV2LmNvbT5cbiAqICAgICAgIG9uIDcvMzEvMTQuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0aWNMYWJlbDtcblxuZnVuY3Rpb24gU3RhdGljTGFiZWwocGJmRmVhdHVyZSwgY3R4LCBsYXRMbmcsIHN0eWxlKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5wYmZGZWF0dXJlID0gcGJmRmVhdHVyZTtcbiAgdGhpcy5tYXAgPSBwYmZGZWF0dXJlLm1hcDtcbiAgdGhpcy56b29tID0gY3R4Lnpvb207XG4gIHRoaXMubGF0TG5nID0gbGF0TG5nO1xuICB2YXIgc3R5ID0gdGhpcy5zdHlsZSA9IHN0eWxlLnN0YXRpY0xhYmVsKCk7XG4gIHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcblxuICB2YXIgaWNvbiA9IHRoaXMuaWNvbiA9IEwuZGl2SWNvbih7XG4gICAgY2xhc3NOYW1lOiBzdHkuY3NzQ2xhc3MgfHwgJ2xhYmVsLWljb24tdGV4dCcsXG4gICAgaHRtbDogc3R5Lmh0bWwgfHwgJ05vIExhYmVsJyxcbiAgICBpY29uU2l6ZTogc3R5Lmljb25TaXplIHx8IFs1MCw1MF1cbiAgfSk7XG5cbiAgdGhpcy5tYXJrZXIgPSBMLm1hcmtlcihsYXRMbmcsIHtpY29uOiBpY29ufSkuYWRkVG8odGhpcy5tYXApO1xuXG4gIHRoaXMubWFya2VyLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICBzZWxmLnRvZ2dsZSgpO1xuICB9KTtcblxuICB0aGlzLm1hcC5vbignem9vbWVuZCcsIGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgbmV3Wm9vbSA9IGUudGFyZ2V0LmdldFpvb20oKTtcbiAgICBpZiAoc2VsZi56b29tICE9PSBuZXdab29tKSB7XG4gICAgICBzZWxmLm1hcC5yZW1vdmVMYXllcihzZWxmLm1hcmtlcik7XG4gICAgfVxuICB9KTtcbn1cblxuU3RhdGljTGFiZWwucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5zZWxlY3RlZCkge1xuICAgIHRoaXMuZGVzZWxlY3QoKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnNlbGVjdCgpO1xuICB9XG59O1xuXG5TdGF0aWNMYWJlbC5wcm90b3R5cGUuc2VsZWN0ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuc2VsZWN0ZWQgPSB0cnVlO1xuICB0aGlzLm1hcmtlci5faWNvbi5jbGFzc0xpc3QuYWRkKCdsYWJlbC1pY29uLXRleHQtc2VsZWN0ZWQnKTtcbiAgdmFyIGxpbmtlZEZlYXR1cmUgPSB0aGlzLnBiZkZlYXR1cmUubGlua2VkRmVhdHVyZSgpO1xuICBpZiAoIWxpbmtlZEZlYXR1cmUuc2VsZWN0ZWQpIGxpbmtlZEZlYXR1cmUuc2VsZWN0KCk7XG59O1xuXG5TdGF0aWNMYWJlbC5wcm90b3R5cGUuZGVzZWxlY3QgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuICB0aGlzLm1hcmtlci5faWNvbi5jbGFzc0xpc3QucmVtb3ZlKCdsYWJlbC1pY29uLXRleHQtc2VsZWN0ZWQnKTtcbiAgdmFyIGxpbmtlZEZlYXR1cmUgPSB0aGlzLnBiZkZlYXR1cmUubGlua2VkRmVhdHVyZSgpO1xuICBpZiAobGlua2VkRmVhdHVyZS5zZWxlY3RlZCkgbGlua2VkRmVhdHVyZS5kZXNlbGVjdCgpO1xufTtcbiJdfQ==

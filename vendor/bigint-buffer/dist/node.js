"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

function assertBuffer(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError("Expected a Buffer or Uint8Array.");
  }
}

function assertWidth(width) {
  if (!Number.isSafeInteger(width) || width < 0) {
    throw new RangeError("Buffer width must be a non-negative safe integer.");
  }
}

function toBigIntLE(value) {
  assertBuffer(value);
  const hex = Buffer.from(value).reverse().toString("hex");
  return hex ? BigInt(`0x${hex}`) : 0n;
}

function toBigIntBE(value) {
  assertBuffer(value);
  const hex = Buffer.from(value).toString("hex");
  return hex ? BigInt(`0x${hex}`) : 0n;
}

function toBufferBE(number, width) {
  assertWidth(width);
  if (typeof number !== "bigint" || number < 0n) {
    throw new TypeError("Expected a non-negative BigInt.");
  }
  const hex = number.toString(16);
  const maximumDigits = width * 2;
  if (hex.length > maximumDigits) {
    throw new RangeError("BigInt does not fit in the requested buffer width.");
  }
  if (width === 0) return Buffer.alloc(0);
  return Buffer.from(hex.padStart(maximumDigits, "0"), "hex");
}

function toBufferLE(number, width) {
  return Buffer.from(toBufferBE(number, width)).reverse();
}

exports.toBigIntLE = toBigIntLE;
exports.toBigIntBE = toBigIntBE;
exports.toBufferLE = toBufferLE;
exports.toBufferBE = toBufferBE;

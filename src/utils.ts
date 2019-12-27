import { toBigIntLE, toBufferLE } from "bigint-buffer";

export class LogTrace extends Error {
  constructor(public level: 'verbose' | 'warning', msg: string) {
    super(msg)
  }
}
export type Logger = (log: LogTrace) => void
export let logger: Logger  = (_) => {}

export const bitmask = (bits: number): bigint => {
  return ((1n << BigInt(bits))-1n)
}

// Converts bit lengths into bytelength
export function GetByteLength(bits: number): number {
  let length = bits / 8
  return Math.ceil(length)
}

export function BigIntToBuffer(value: bigint | number, bits: number): Buffer {
  let bytes: number = GetByteLength(bits);
  if (typeof value === "number") value = BigInt(value);
  if (value < 0n) value = BigInt.asUintN(bits, value); // Cast to UInt
  return toBufferLE(value, bytes);
}

export function BufferToBigInt(buffer: Buffer, unsigned = false): bigint {
  // Check if it's a standard-ish Integer (int8, int16, int32, int64, int128, etc)
  let len = buffer.byteLength;
  let value = toBigIntLE(buffer);
  if (!unsigned)
    value = BigInt.asIntN(len * 8, value); // Cast to Int
  return value;
}
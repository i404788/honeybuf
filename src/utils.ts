import { toBigIntLE, toBufferLE } from "bigint-buffer";


export class LogTrace extends Error {
  constructor(public level: 'verbose' | 'warning', msg: string) {
    super(msg)
  }
}
export type Logger = (log: LogTrace) => void
export let logger: Logger  = (_) => {}

// Converts bit lengths into bytelength
export function GetByteLength(bits: number): number {
  let length = bits / 8
  if (Math.ceil(length) !== length) logger(new LogTrace('warning', `got a ${length}-byte int, using ${Math.ceil(length)} instead`))
  return Math.ceil(length)
}

// Big Endian is possible for potential future compatibility
export function BigIntToBuffer(value: bigint | number, bits: number): Buffer {
  let bytes: number = GetByteLength(bits);
  if (!((bytes & (bytes - 1)) == 0))
    logger(new LogTrace('warning', `BigIntToBuffer(): bytes not a power of 2 but instead ${bytes} bytes`));
  if (typeof value === "number") value = BigInt(value);
  if (value < 0n) value = BigInt.asUintN(bits, value); // Cast to UInt
  return toBufferLE(value, bytes);
}

export function BufferToBigInt(buffer: Buffer, unsigned = false): bigint {
  // Check if it's a standard-ish Integer (int8, int16, int32, int64, int128, etc)
  let len = buffer.byteLength;
  if (!((len & (len - 1)) == 0)) {
    if (!unsigned) throw new Error('BufferToBigInt(): integer bigint with non-standard byte length is not supported')
    else logger(new LogTrace('warning', `BufferToBigInt(): byteLength not power of 2 but instead ${len} bytes`));
  }
  // Deserialize
  let value = toBigIntLE(buffer);
  if (!unsigned)
    value = BigInt.asIntN(len * 8, value); // Cast to Int
  return value;
}
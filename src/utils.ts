import { toBigIntLE, toBufferLE } from "bigint-buffer";

export const n = (num: number): bigint => BigInt(num)

// Converts bit lengths into bytelength
export function GetByteLength(bits : number) : number {
  let length = bits / 8
  if (Math.round(length) !== length) throw new Error("Invalid bit length")
  return length
}


// Big Endian is possible for potential future compatibility
export function BigIntToBuffer(value: bigint | number, bits: number): Buffer {
  let bytes: number
  try {
    bytes = GetByteLength(bits);
  } catch {
    throw `BigIntToBuffer(): bits is not a multiple of 8, bit-packed bigints are not (yet) supported`;
  }
  if (!((bytes & (bytes - 1)) == 0))
    console.warn(`BigIntToBuffer(): bytes not a power of 2 but instead ${bytes} bytes`);
  if (typeof value === "number") value = BigInt(value);
  if (value < n(0)) value = BigInt.asUintN(bits, value); // Cast to UInt
  return toBufferLE(value, bytes);
}

export function BufferToBigInt(buffer: Buffer, unsigned = false) : bigint {
  // Check if it's a standard-ish Integer (int8, int16, int32, int64, int128, etc)
  let len = buffer.byteLength;
  if (!((len & (len - 1)) == 0)){
    if (!unsigned) throw `BufferToBigInt(): integer bigint with non-standard byte length is not supported`
    else console.warn(`BufferToBigInt(): byteLength not power of 2 but instead ${len} bytes`);
  }
  // Deserialize
  let value = toBigIntLE(buffer);
  if (!unsigned)
    value = BigInt.asIntN(len * 8, value); // Cast to Int
  return value;
}

export enum BinaryEncoding { Binary, Base2, BasE91, Base64, Hex }

export function EncodeBuffer(buffer: Buffer, encoding: BinaryEncoding): string {
    switch (encoding) {
        case BinaryEncoding.Hex:
            return buffer.toString('hex')
        // TODO: basE91
        case BinaryEncoding.Base2:
            let str = ''
            for (const iterator of buffer)
                str += iterator.toString(2)
            return str
        case BinaryEncoding.Base64:
            return buffer.toString('base64')
        default: // Binary
            return buffer.toString('binary')
    }
}

export function DecodeBuffer(buffer: string, encoding: BinaryEncoding): Buffer {
    switch (encoding) {
        case BinaryEncoding.Hex:
            return Buffer.from(buffer, 'hex')
        // TODO: basE91
        case BinaryEncoding.Base64:
            return Buffer.from(buffer, 'base64')
        case BinaryEncoding.Base2:
            throw "BinaryString not implemented for DecodeBuffer";
        default: // Binary
            return Buffer.from(buffer, 'binary')
    }
}

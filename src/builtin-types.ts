import { Serializable, Unpacked } from "./serializer";
import { SerialStream } from "./barestream";
import { ByteToFloat16, Float16ToByte } from "./misc/float16";

interface Type<T> {
    new(...args: any[]): T;
}

interface FunctionType<T> {
    (...args: any[]): T
}

const isType = <T>(value: any, type: Type<T> | FunctionType<T>): value is T => {
    return value.constructor === type
}

/**
 * Serializes Integers between (exclusive) 2^53 and -2^53 (aka 52-bit IEE754 int).
 */
export class Integer extends Serializable<number> {
    protected base: BigInteger
    public constructor(protected args: { bits: number; unsigned?: boolean } = { bits: 256 }) {
        super()
        this.base = new BigInteger(args);
        if (this.args.bits > 52) throw new Error('Integers don\'t support higher than 52-bit, use BigIntegers instead')
    }

    public Write(stream: SerialStream, value: number) {
        // Over/underflow/truncation protection from BigInteger base
        this.base.Write(stream, BigInt(value))
    }

    public Read(stream: SerialStream): number {
        return Number(this.base.Read(stream))
    }
}

/**
 * Serializes Integers of arbitrary size using tc39 BigInt
 */
export class BigInteger extends Serializable<bigint> {
    get SafeMax() {
        return this.args.unsigned ? 2n ** BigInt(this.args.bits) : 2n ** BigInt(this.args.bits-1);
    }

    get SafeMin(){
        return this.args.unsigned ? 0 : -(2n ** BigInt(this.args.bits-1));
    }

    public constructor(protected args: { bits: number; unsigned?: boolean } = { bits: 256 }) {
        super()
    }
    public Write(stream: SerialStream, value: bigint) {
        if (isType(value, Number)) value = BigInt((value as unknown as number) | 0);
        if (!isType(value, BigInt))
            throw new Error(`BigInt Serializer: Bad type ${value}, '${typeof value}' !== 'bigint'`);
    
        // Over/underflow/truncation protection
        if (value > this.SafeMax || value < this.SafeMin) 
            throw new Error(`[Stream/Int]: Failed to serialize, ${value} out of range ${this.SafeMin}-${this.SafeMax}`)
    
        stream.WriteInt(this.args.bits, value);
    };

    public Read(stream: SerialStream): bigint {
        return stream.ReadInt(this.args.bits, this.args.unsigned || false);
    };
}

/**
 * Transmits a signle boolean (note: takes up whole byte)
 */
export class SingleBoolean extends Serializable<boolean> {
    protected base = new BigInteger({ bits: 8, unsigned: true })
    public Write(stream: SerialStream, value: boolean, args?: {}) {
        if (!isType(value, Boolean))
            throw new Error(`SignleBoolean Serializer: Bad type ${value}, '${typeof value}' !== 'boolean'`);
        this.base.Write(stream, BigInt(value))
    };
    public Read(stream: SerialStream, args?: {}): boolean {
        const val = this.base.Read(stream)
        if (val > 1n) throw new Error(`Error while decoding in [SingleBoolean], input was been corrupted or incompatible.`)
        return val > 0n;
    };
}

/**
 * Serializes a dense variably-sized boolean array
 * size: 1 + |^log256(n)^| + |^n/8^|
 */
export class DenseBooleanArray extends Serializable<boolean[]> {
    public Write(stream: SerialStream, value: boolean[], args?: {}) {
        if (typeof value === 'boolean') value = [value];
        stream.WriteVarint(value.length);
        const length = Math.ceil(value.length / 8);
        const data = Buffer.alloc(length);
        for (let i = 0; i < length; i++) {
            const offset = i * 8;
            for (let j = 0; j < 8; j++) {
                data[offset] |= Number(!!value[offset + j] || 0) << j;
            }
        }
        stream.WriteBytes(data);
    };

    public Read(stream: SerialStream, args?: {}): boolean[] {
        const arrLength = Number(stream.ReadVarint())
        const length = Math.ceil(arrLength / 8)
        const data = [];
        for (let i = 0; i < length; i++) {
            const byte = stream.ReadBytes(1)[0];
            for (let j = 0; j < 8; j++) {
                data.push(!!((byte | 0) >> j));
            }
        }
        return data.slice(0, Number(arrLength));
    };
}

/**
 * Serializes a variable-length string (utf-8)
 */
export class CharVector extends Serializable<string> {
    protected base = new BufferLike();
    public Write(stream: SerialStream, value: string, args?: {}) {
        this.base.Write(stream, Buffer.from(value));
    };
    public Read(stream: SerialStream, args?: {}): string {
        return this.base.Read(stream).toString('utf-8');
    }
}

/**
 * Serializes a buffer-like object (ArrayBuffer, SharedBuffer, Buffer, Uint8Array)
 */
export class BufferLike extends Serializable<ArrayBuffer | SharedArrayBuffer | Buffer | Uint8Array> {
    public Write(stream: SerialStream, value: Uint8Array | ArrayBuffer | SharedArrayBuffer | Buffer, args?: {}) {
        stream.WriteVarint(value.byteLength);
        stream.WriteBytes(Buffer.from(value))
    };
    public Read(stream: SerialStream, args?: {}): Buffer {
        const len = Number(stream.ReadVarint())
        return stream.ReadBytes(len)
    }
}




/**
 * (de-)Serializes the value as array of T using varint to document the array length
 * 
 * For byte-like sequences please use the `BufferLike` type
 */
export class Vector<T extends Serializable<any>> extends Serializable<Unpacked<T>[]> {
    public constructor(protected type: T) {
        super()
    }
    public Write(stream: SerialStream, value: Unpacked<T>[]) {
        stream.WriteVarint(value.length);
        for (let i = 0; i < value.length; i++) {
            this.type.Write(stream, value[i]);
        }
    };

    public Read(stream: SerialStream): Unpacked<T>[] {
        const count = stream.ReadVarint();
        const items: Unpacked<T>[] = [];
        for (let i = 0n; i < count; i++) {
            items.push(this.type.Read(stream));
        }
        return items;
    };
}

/**
 * Allows for Transformation of the output in using an arbitrary function
 * 
 * **WARNING:** this is meant for prototyping, don't use this in production
 */
export class ReadCast<T extends Serializable<S>, S, R> extends Serializable<R> {
    public constructor(protected type: T, private readCaster: (object: S) => R) {
        super();
    }
    public Write(stream: SerialStream, value: any, args?: {}) {
        this.type.Write(stream, value, args)
    };
    public Read(stream: SerialStream, args?: {}): R {
        return this.readCaster(this.type.Read(stream, args))
    };
}

type Un<T> = Unpacked<T>
export class MapLike<T extends Serializable<any>, S extends Serializable<any>> 
                extends Serializable<Map<Un<T>,Un<S>>> {
    public constructor(protected keytype: T, protected valuetype: S) {
        super()
    }
    public Write(stream: SerialStream, value: Map<Un<T>, Un<S>>): void {
        const len = value.size
        stream.WriteVarint(len)
        for (const entry of value.entries()) {
            this.keytype.Write(stream, entry[0])
            this.valuetype.Write(stream, entry[1])
        }
    }    
    public Read(stream: SerialStream): Map<Un<T>, Un<S>> {
        const len = stream.ReadVarint()
        const map = new Map<Un<T>, Un<S>>()
        for (let i = 0; i < len; i++) {
            const key = this.keytype.Read(stream)
            const value = this.valuetype.Read(stream)
            map.set(key, value)
        }
        return map
    }
}

export class Float extends Serializable<number> {
    public constructor(protected args: { bits: '16' | '32' | '64' } = { bits: '64' }) {
        super()
        if (!['16', '32', '64'].includes(this.args.bits))
            throw new Error(`the bit length of [Float] ${this.args.bits} is invalid`)
    }

    public Write(stream: SerialStream, value: number, args?: {}) {
        switch (this.args.bits) {
            case '16': // TODO: check range?
                stream.WriteInt(16, Float16ToByte(value))
                break;
            case '32':
                let tmp32 = new Float32Array(1)
                tmp32[0] = value
                stream.WriteBytes(Buffer.from(tmp32.buffer))
                break;
            case '64':
                let tmp64 = new Float64Array(1)
                tmp64[0] = value
                stream.WriteBytes(Buffer.from(tmp64.buffer))
                break;
            default:
                throw new Error('Read failed for [Float], contact maintainer')
        }
    }

    public Read(stream: SerialStream): number {
        switch (this.args.bits) {
            case '16':
                let bytes16 = Number(stream.ReadInt(16, true))
                return ByteToFloat16(bytes16)
            case '32':
                let bytes32 = stream.ReadBytes(4)
                return new Float32Array(bytes32)[0]
            case '64':
                let bytes64 = stream.ReadBytes(8)
                return new Float64Array(bytes64)[0]
            default:
                throw new Error('Read failed for [Float], contact maintainer')
        }
    }
}
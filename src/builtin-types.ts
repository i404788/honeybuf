import { SerializableValue, Unpacked } from "./serializer";
import { SerialStream } from "./barestream";

interface Type<T> {
    new(...args: any[]): T;
}

interface FunctionType<T> {
    (...args: any[]): T
}

const isType = <T>(value: any, type: Type<T> | FunctionType<T>): value is T => {
    return value.constructor === type
}

// const isISerializable = (value: any): value is SerializableClass<any> => {
//     return value && value.constructor && value.constructor.GetSerializables;
// }

/**
 * Serializes Integers between (exclusive) 2^53 and -2^53 (aka 52-bit IEE754 int).
 * 
 */
export class Integer extends SerializableValue<number> {
    protected base: BigInteger
    public constructor(protected args: { bits: number; unsigned?: boolean } = { bits: 256 }) {
        super()
        this.base = new BigInteger(args);
        if (this.args.bits > 52) throw new Error('Integers don\'t support higher than 52-bit, use BigIntegers instead')
    }

    public Write(stream: SerialStream, value: number) {
        this.base.Write(stream, BigInt(value))
    }

    public Read(stream: SerialStream): number {
        return Number(this.base.Read(stream))
    }
}

/**
 * Serializes Integers of arbitrary size using tc39 BigInt
 */
export class BigInteger extends SerializableValue<bigint> {
    public constructor(protected args: { bits: number; unsigned?: boolean } = { bits: 256 }) {
        super()
    }
    public Write(stream: SerialStream, value: bigint) {
        if (isType(value, Number)) value = BigInt((value as unknown as number) | 0);
        if (!isType(value, BigInt))
            throw new Error(`BigInt Serializer: Bad type ${value}, '${typeof value}' !== 'bigint'`);
        stream.WriteInt(this.args.bits, value);
    };

    public Read(stream: SerialStream): bigint {
        return stream.ReadInt(this.args.bits, this.args.unsigned || false);
    };
}

/**
 * Transmits a signle boolean (note: takes up whole byte)
 */
export class SingleBoolean extends SerializableValue<boolean> {
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
 * size: |^log256(n)^| + |^n/8^| + 1
 */
export class DenseBooleanArray extends SerializableValue<boolean[]> {
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
export class CharVector extends SerializableValue<string> {
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
export class BufferLike extends SerializableValue<ArrayBuffer | SharedArrayBuffer | Buffer | Uint8Array> {
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
export class Vector<T extends SerializableValue<any>> extends SerializableValue<Unpacked<T>[]> {
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
export class ReadCast<T extends SerializableValue<S>, S, R> extends SerializableValue<R> {
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


export class Float extends SerializableValue<number> {
    public constructor(protected args: { bits: '16' | '32' | '64' } = { bits: '64' }) {
        super()
        if (!['16','32','64'].includes(this.args.bits))
            throw new Error(`the bit length of [Float] ${this.args.bits} is invalid`)
    }

    public Write(stream: SerialStream, value: number, args?: {}) {
        switch(this.args.bits){
            case '16': // TODO: check range?
                stream.WriteInt(16, Float16.Float16ToByte(value))
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
        switch(this.args.bits) {
            case '16':
                let bytes16 = Number(stream.ReadInt(16, true))
                return Float16.ByteToFloat16(bytes16)
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

class Float16{
    public static ByteToFloat16(uint16:number){
        let d = uint16;
        let negative = ((d>>15) & 1) !=0;
        let mask = 0b11111;
        let exponent = (d >>10) & mask;
        let significand = d & 0b1111111111;
        if(exponent == 0 && significand == 0){
            return negative ? -0:0;
        }
        if(exponent == mask){
            if(significand == 0){
                return negative? -Infinity: Infinity;
            }
            else{
                return NaN;
            }
        }
        let f= 0;
        if(exponent == 0){
            f = significand /512.0;
        }
        else{
            f= (1.0 + significand / 1024.0);
        }
        return (negative? -1.0 :1.0) * Math.pow(2,exponent-15) * f; 
    }
    public static Float16ToByte(float16:number):number{
        let f = float16;
        if(isNaN(f)) return 0b0111110000000001;
        if(1/f === -Infinity) return 0b1000000000000000;
        if(f === 0) return 0;
        if(f === -Infinity) return 0b1111110000000000;
        if(f === Infinity) return  0b0111110000000000;
        let negative = f < 0;
        f= Math.abs(f);
        let fe = Math.floor(f);
        let e= 0;
        let si = 0;
        if(fe >0){
            while(fe >0){
                e++;
                fe = fe >> 1;
            }
            e+=14;
            let em = Math.pow(2,e-15);
            let s = f/ em -1.0;
            si = Math.round(s *1024);
        }
        else{
            let fi = f * (1<<15);
            fe = Math.floor(fi);
            if(fe >0){
                while (fe > 0) {
                    e++;
                    fe = fe >> 1;
                }
                e--;
            }
            if(e == 0){
                si = Math.round(fi *512);
            }
            else{
                let em = 1<<e;
                let s= fi/em -1.0;
                si = Math.round(s *1024);
            }
        }
        return ((e<<10) + si) + (negative? 1<<15: 0);
    }
}
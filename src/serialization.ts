import { BufferToBigInt, BigIntToBuffer, GetByteLength, n } from './utils'
import { plainToClass } from 'class-transformer'

enum ReadWriteMode {
    Read,
    ReadWrite
}

const MaxSize = 500000; // 500KB

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

const isSerializable = <T>(construct: SerializableConstructor<T> | Function): construct is SerializableConstructor<T> => {
    const con = (construct as any)
    return con._name && con.GetSerializables
}

//#region Base Stream class
export class SerialStream {
    public constructor(
        public buffer: Buffer,
        public cursor: number = 0, 
        public type?: ReadWriteMode
    ) { }

    private CheckWriteProtection(): never | void {
        if (this.type === ReadWriteMode.Read) throw new Error(`Can't write to read-only stream`);
    }

    public WriteBytes(buff: Buffer): void {
        this.CheckWriteProtection()
        if (this.cursor + buff.byteLength > MaxSize)
            throw new Error('WriteStream: Out of Bytes');
        const bytesLeft = this.buffer.byteLength - this.cursor
        if (buff.byteLength > bytesLeft) {
            this.buffer = Buffer.concat([this.buffer, Buffer.alloc(buff.byteLength - bytesLeft)])
        }
        buff.copy(this.buffer, this.cursor)
        this.cursor += buff.byteLength
    }

    public WriteInt(bits: number, value: bigint | number): void {
        this.CheckWriteProtection()
        if (typeof value === 'number') value = BigInt(value)
        const buff = BigIntToBuffer(value, bits)
        this.WriteBytes(buff.slice(0, GetByteLength(bits)))
    }

    public WriteVarint(len: bigint | number): void {
        this.CheckWriteProtection()
        if (typeof len === 'number') len = BigInt(len);
        if (len < n(0)) throw new Error(`WriteVarint(): Can't have negative length (${len})`);
        if (len > n(1) << n(64))
            throw new Error(`WriteVarint(): Can't have length higher than ${n(2) **
                n(64)} (${len})`);

        if (len < n(253))
            // Less than 253 items
            return this.WriteInt(8, len);
        if (len === n(253))
            // More than 252, 16-bit number for exact count
            return this.WriteInt(16, len);
        if (len === n(254))
            // More than 252, 32-bit number for exact count
            return this.WriteInt(32, len);
        // (has to be 255) More than 252, 64-bit number for exact count
        return this.WriteInt(64, len);
    }

    public ReadBytes(num: number): Buffer {
        if (this.cursor + num > this.buffer.length) throw new Error('Out of bytes');
        this.cursor += num;
        return this.buffer.slice(this.cursor - num, this.cursor);
    }

    // Default LE
    public ReadInt(bits: number, unsigned = false): bigint {
        return BufferToBigInt(this.ReadBytes(GetByteLength(bits)), unsigned);
    }

    public ReadVarint(): bigint {
        const n = this.ReadBytes(1)[0];
        if (n < 253)
            // Less than 253 items
            return BigInt(n);
        if (n === 253)
            // More than 252, 16-bit number for exact count
            return this.ReadInt(16, false);
        if (n === 254)
            // More than 252, 32-bit number for exact count
            return this.ReadInt(32, false);
        // (has to be 255) More than 252, 64-bit number for exact count
        return this.ReadInt(64, false);
    }
}
//#endregion

export abstract class SerializableValue<T> {
    abstract Write(stream: SerialStream, value: T, args?: {}): void;
    abstract Read(stream: SerialStream, args?: {}): T;
}

//#region Value Implementations

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
 * Serializes Integers of arbitrary size
 * Note: while it accepts `number | bigint` in the Write-mode, it will always return a `bigint` in Read-mode
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

export class SingleBoolean extends SerializableValue<boolean> {
    protected base = new BigInteger({bits: 8, unsigned: true})
    public Write(stream: SerialStream, value: boolean, args?: {}) {
        this.base.Write(stream, BigInt(value))
    };
    public Read (stream: SerialStream, args?: {}): boolean{
        return this.base.Read(stream) > 0
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
                data[offset] |= Number(value[offset + j] || 0) << j;
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
 * vec<char> AKA a String, `String` was already taken...
 * However it would be more accurate to say vec<char> since, ['a', 'b', 'c'] would be a valid value for this class
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

export class BufferLike extends SerializableValue<ArrayBuffer | SharedArrayBuffer | Buffer> {
    protected base = new Vector(new BigInteger({bits: 8, unsigned: true}));

    public Write(stream: SerialStream, value: ArrayBuffer | SharedArrayBuffer | Buffer, args?: {}) {
        this.base.Write(stream, Array.from(Buffer.from(value)).map(x => BigInt(x)));
    };
    public Read (stream: SerialStream, args?: {}): Buffer {
        return Buffer.from(this.base.Read(stream).map(x => x.toString(16)).join(''), 'hex');
    }
}


type Unpacked<T> = T extends SerializableValue<infer R> ? R : T;

/**
 * (de-)Serializes the value as array of T using varint to document the array length
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
    
    public Read (stream: SerialStream): Unpacked<T>[] {
        const count = stream.ReadVarint();
        const items: Unpacked<T>[] = [];
        for (let i = n(0); i < count; i++) {
            items.push(this.type.Read(stream));
        }
        return items;
    };
}

/**
 * Allows for Transformation of the output in using an arbitrary function
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
//#endregion

//#region SerializableClass
export interface SerializableClass<T> {
    constructor: SerializableConstructor<T> | Function;
    [key: string]: any;
}

export type SerializerMapping = Map<string, Serializable>
export interface SerializableConstructor<T> {
    new(...args: any[]): SerializableClass<T>;
    _name: string;
    GetSerializables(): SerializerMapping; // Make sure it's ordered
}

/* class decorator */
export function staticImplements<T>() {
    return <U extends T>(constructor: U) => { constructor };
}

// export function SerializableClass<T>() : (constructor: SerializableConstructor<T>) => any {
//   return (_constructor: SerializableConstructor<T>) => {}
// }
//#endregion

export type Serializable = SerializableValue<any> | SerializableConstructor<any>;

export class Serializer<T extends SerializableClass<T>> {
    public constructor(private type: SerializableConstructor<T>) {
        if (!this.type.GetSerializables)
            throw new Error(`Type ${
                this.type._name
                } doesn't implement ISerializableStatic`);
    }

    public Deserialize(stream: Buffer): T {
        return this._Deserialize(new SerialStream(stream, 0, ReadWriteMode.Read)) as T
    }

    public _Deserialize(stream: SerialStream, callees: string[] = []): SerializableClass<T> {
        // Run checks
        if (callees.includes(this.type._name))
            throw new Error(`Possible recursion in serialization, please evaluate ${callees}; ${this.type._name}`);
        callees.push(this.type._name);

        const oMap: { [field: string]: any } = {}
        const sMap = this.type.GetSerializables()
        // console.log(`Read(${this.type._name}), ${sMap.size}`)
        sMap.forEach((value, key) => {
            // const value = sMap.get(key)
            if (value instanceof SerializableValue) {
                // SerializableValue
                oMap[key] = value.Read(stream)
                // console.log(oMap[key])
            } else if (isSerializable(value)) {
                // ISerializable
                const sObj = new Serializer(value)
                // Recurse into child object
                oMap[key] = sObj._Deserialize(stream, callees)
            } else {
                throw new Error(`${callees.join('/')}/${key}: ${value} is not a Serializable object (not ISerializable<any> | SerializableValue)`);
            }
        })
        return plainToClass(this.type, oMap)
    }

    public Serialize(object: T): Buffer {
        return this._Serialize(new SerialStream(Buffer.alloc(0), 0, ReadWriteMode.ReadWrite), object)
    }

    public _Serialize(stream: SerialStream, object: T, callees: string[] = []): Buffer {
        // Run checks
        if (!isSerializable(object.constructor)) throw new Error(`${object} isn't Serializable at [${callees}]`)
        if (callees.includes(object.constructor._name))
            throw new Error(`Possible recursion in serialization, please evaluate`);
        callees.push(object.constructor._name);
        // console.log(object.constructor._name);

        const sMap = object.constructor.GetSerializables();
        // console.log(`Write(${object.constructor._name}), ${sMap.size}`)
        sMap.forEach((val, iterator) => {
            if (!object.hasOwnProperty(iterator)) throw new Error(`Field ${iterator} doesn't exist on ${(object.constructor as any)._name}`);
            // let val = sMap.get(iterator);
            if (val instanceof SerializableValue) {
                // SerializableValue
                val.Write(stream, object[iterator])
            } else {
                if (isSerializable(val)) {
                    // ISerializable
                    const serClass = new Serializer(val);
                    serClass._Serialize(stream, val, callees)
                } else {
                    throw new Error(`${callees.join('/')}/$${iterator}: ${val} is not a Serializable object (not ISerializable<any> | SerializableValue)`);
                }
            }
        })
        return stream.buffer;
    }
}

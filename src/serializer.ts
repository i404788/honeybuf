import { plainToClass } from 'class-transformer'
import { SerialStream, ReadWriteMode } from "./barestream";

const isSerializable = <T>(construct: SerializableConstructor<T> | Function): construct is SerializableConstructor<T> => {
    const con = (construct as any)
    return con._name && con.GetSerializables
}

export abstract class SerializableValue<T> {
    abstract Write(stream: SerialStream, value: T, args?: {}): void;
    abstract Read(stream: SerialStream, args?: {}): T;
}

export interface SerializableClass<T> {
    constructor: SerializableConstructor<T> | Function;
    [key: string]: any;
}

// export function SerializableClass<T>() : (constructor: SerializableConstructor<T>) => any {
//   return (_constructor: SerializableConstructor<T>) => {}
// }

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

export type Serializable = SerializableValue<any> | SerializableConstructor<any>;

export type Unpacked<T> = T extends SerializableValue<infer R> ? R : T;

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

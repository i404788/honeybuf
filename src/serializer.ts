import { plainToClass } from 'class-transformer'
import "reflect-metadata";
import { SerialStream, ReadWriteMode } from "./barestream";

export const SerializerKey = Symbol('SerializerType')
export const SelfSerialized = Symbol('SerializedClass')

const isSerializable = (construct: Function): boolean => {
    return Reflect.getMetadata(SerializerKey, construct)
}

export abstract class SerializableValue<T> {
    abstract Write(stream: SerialStream, value: T, args?: {}): void;
    abstract Read(stream: SerialStream, args?: {}): T;
}

export function staticImplements<T>() {
    return <U extends T>(constructor: U) => { 
        Reflect.metadata(SerializerKey, Symbol('UniqueSerializationID'))(constructor as unknown as Function)
        constructor 
    };
}

export function SerializableClass (constructor: Function) {
    Reflect.metadata(SerializerKey, Symbol('UniqueSerializationID'))(constructor)
}

export interface SelfAwareClass{
    constructor: ObjectConstructor | Function;
    [key: string]: any
}

export function Serialized<S>(s: SerializableValue<S>){
    return <T>(target: T, propertyKey: string | symbol) => {
        // TODO: should check `S.constructor == target[propertyKey].constructor`, but is impossible atm
        Reflect.metadata(SerializerKey, s)(target, propertyKey)
    }
}

export type Unpacked<T> = T extends SerializableValue<infer R> ? R : T;

export class Serializer<T extends SelfAwareClass> {
    protected model: T = Reflect.construct(this.type, [])

    public constructor(private type: {new(...args: any[]): T; }) {
        if (!isSerializable(type))
            throw new Error(`Type ${
                String(this.type.name)
                } doesn't implement ISerializableStatic`);
    }

    public Deserialize(stream: Buffer): T {
        return this._Deserialize(new SerialStream(stream, 0, ReadWriteMode.Read)) as T
    }

    public _Deserialize(stream: SerialStream, callees: (string | symbol)[] = []): T {
        // Run checks
        let classSymbol = Reflect.getMetadata(SerializerKey, this.type);
        if (callees.includes(classSymbol))
            throw new Error(`Possible recursion in serialization, please evaluate ${callees}; ${String(this.type.name)}`);
        callees.push(classSymbol);

        const oMap: { [field: string]: any } = {}
        const sKeys = Object.getOwnPropertyNames(this.model)
        for (const iterator of sKeys) {
            let x = Reflect.getMetadata(SerializerKey, this.type.prototype, iterator)
            console.log(x)
            if (x) {
                if (x instanceof SerializableValue) {
                    // SerializableValue
                    oMap[iterator] = x.Read(stream)
                    // console.log(oMap[key])
                } else if (isSerializable(x)) {
                    // ISerializable
                    const sObj = new Serializer(x)
                    // Recurse into child object
                    oMap[iterator] = sObj._Deserialize(stream, callees)
                } else {
                    throw new Error(`${callees.join('/')}/${iterator}: ${x} is not a Serializable object (not ISerializable<any> | SerializableValue)`);
                }
            }
        }
        return plainToClass(this.type, oMap)
    }

    public Serialize(object: T): Buffer {
        return this._Serialize(new SerialStream(Buffer.alloc(0), 0, ReadWriteMode.ReadWrite), object)
    }

    public _Serialize(stream: SerialStream, object: T, callees: (symbol | string)[] = []): Buffer {
        // Run checks
        if (!isSerializable(object.constructor)) throw new Error(`${object} isn't Serializable at [${callees}]`)
        let classSymbol = Reflect.getMetadata(SerializerKey, object.constructor);
        if (callees.includes(classSymbol))
            throw new Error(`Possible recursion in serialization, please evaluate`);
        callees.push(classSymbol);
        
        const sKeys = Object.getOwnPropertyNames(this.model)
        for (const iterator of sKeys) {
            let x = Reflect.getMetadata(SerializerKey, this.type.prototype, iterator)
            // console.log(x, iterator)
            if (x) {
                if (!object.hasOwnProperty(iterator)) throw new Error(`Field ${iterator} doesn't exist on ${(object.constructor as any)._name}`);
                if (x instanceof SerializableValue) {
                    // SerializableValue
                    x.Write(stream, object[iterator])
                } else {
                    if (isSerializable(x)) {
                        // ISerializable
                        const serClass = new Serializer(x);
                        serClass._Serialize(stream, x, callees)
                    } else {
                        throw new Error(`${callees.join('/')}/$${iterator}: ${x} is not a Serializable object (not ISerializable<any> | SerializableValue)`);
                    }
                }
            }
        }
        return stream.buffer;
    }
}

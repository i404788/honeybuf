import { plainToClass } from 'class-transformer'
import "reflect-metadata";
import { SerialStream, ReadWriteMode } from "./barestream";

export const SerializerKey = Symbol('SerializerType')
export const SelfSerialized = Symbol('SerializedClass')
export const PluginKey = Symbol('Plugins')

const isSerializableClass = (construct: Function): boolean => {
    return Reflect.getMetadata(SerializerKey, construct)
}

export abstract class Serializable<T> {
    abstract Write(stream: SerialStream, value: T, args?: {}): void;
    abstract Read(stream: SerialStream, args?: {}): T;
}

export function staticImplements<T>() {
    return <U extends T>(constructor: U) => {
        Reflect.metadata(SerializerKey, Symbol('UniqueSerializationID'))(constructor as unknown as Function)
        constructor
    };
}

export function SerializableClass(constructor: Function) {
    Reflect.metadata(SerializerKey, Symbol('UniqueSerializationID'))(constructor)
}

export interface SelfAwareClass {
    constructor: ObjectConstructor | Function;
    [key: string]: any
}

export function Serialized<S>(s: Serializable<S>) {
    return <T>(target: T, propertyKey: string | symbol) => {
        // TODO: should check `S.constructor == target[propertyKey].constructor`, but is impossible atm
        Reflect.metadata(SerializerKey, s)(target, propertyKey)
    }
}

export interface Plugin {
    onInitialize?<T extends SelfAwareClass>(ref: Serializer<T>, type: Constructor<T>, model: SelfAwareClass): void;
    onDeserializeStart?(stream: SerialStream): void
    onDeserializeEnd?(stream: SerialStream): void
    onDeserializeClass?(stream: SerialStream, obj: any): void
    onDeserializeValue?(stream: SerialStream, obj: Serializable<any>): void;
    onSerializeStart?(stream: SerialStream): void
    onSerializeEnd?(stream: SerialStream): void
    onSerializeClass?(stream: SerialStream, obj: any): void
    onSerializeValue?(stream: SerialStream, obj: Serializable<any>): void
}

export abstract class Plugin {
    public call<A extends any[], R>(func: ((this: Plugin, ...args: A) => R) | undefined, args: A): R | undefined {
        if (func) return func.apply(this, args)
        return undefined
    }
}

type PluginCollection = [Constructor<Plugin>, any[]][]

export function AddPlugin<T extends Plugin, A extends any[]>(p: StrictConstructor<T, A>, args: ConstructorParameters<StrictConstructor<T, A>>) {
    return function addPlugin(constructor: Function) {
        let plugins: PluginCollection = Reflect.getMetadata(PluginKey, constructor)
        if (!plugins) plugins = []
        plugins.push([p, args])
        Reflect.metadata(PluginKey, plugins)(constructor)
    }
}

export type Unpacked<T> = T extends Serializable<infer R> ? R : T;

export class Serializer<T extends SelfAwareClass> {
    protected model: T = Reflect.construct(this.type, [])
    protected plugins: Plugin[] = []

    public constructor(private type: Constructor<T>) {
        let pluginTypes: PluginCollection = Reflect.getMetadata(PluginKey, this.type);
        if (pluginTypes)
            this.plugins = pluginTypes.map(x => new x[0](...x[1]))

        this.plugins.forEach(x => x.call(x.onInitialize, [this, this.type, this.model]));


        if (!isSerializableClass(type))
            throw new Error(`Type ${
                String(this.type.name)
                } doesn't implement SerializableClass`);
    }

    public Deserialize(stream: Buffer): T {
        return this._Deserialize(new SerialStream(stream, 0, ReadWriteMode.Read)) as T
    }

    public _Deserialize(stream: SerialStream, callees: (string | symbol)[] = []): T {
        this.plugins.forEach(x => x.call(x.onDeserializeStart, [stream]));

        // Run checks
        let classSymbol = Reflect.getMetadata(SerializerKey, this.type);
        if (callees.includes(classSymbol))
            throw new Error(`Possible recursion in serialization, please evaluate ${callees}; ${String(this.type.name)}`);
        callees.push(classSymbol);

        const oMap: { [field: string]: any } = {}
        const sKeys = Object.getOwnPropertyNames(this.model)
        for (const iterator of sKeys) {
            let x = Reflect.getMetadata(SerializerKey, this.type.prototype, iterator)
            // console.log(x)
            if (x) {
                if (x instanceof Serializable) {
                    this.plugins.forEach(z => z.call(z.onDeserializeValue, [stream, x]));
                    // SerializableValue
                    oMap[iterator] = x.Read(stream)
                    // console.log(oMap[key])
                } else if (isSerializableClass(x)) {
                    this.plugins.forEach(z => z.call(z.onDeserializeClass, [stream, x]));
                    const sObj = new Serializer(x)
                    // Recurse into child object
                    oMap[iterator] = sObj._Deserialize(stream, callees)
                } else {
                    throw new Error(`${callees.join('/')}/${iterator}: ${x} is not a Serializable object (not ISerializable<any> | SerializableValue)`);
                }
            }
        }
        this.plugins.forEach(x => x.call(x.onDeserializeEnd, [stream]));
        return plainToClass(this.type, oMap)
    }

    public Serialize(object: T): Buffer {
        return this._Serialize(new SerialStream(Buffer.alloc(0), 0, ReadWriteMode.ReadWrite), object)
    }

    public _Serialize(stream: SerialStream, object: T, callees: (symbol | string)[] = []): Buffer {
        // Run checks
        if (!isSerializableClass(object.constructor)) throw new Error(`${object} isn't Serializable at [${callees}]`)

        this.plugins.forEach(x => x.call(x.onSerializeStart, [stream]));

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
                if (x instanceof Serializable) {
                    // SerializableValue
                    this.plugins.forEach(z => z.call(z.onSerializeValue, [stream, x]));
                    x.Write(stream, object[iterator])
                } else if (isSerializableClass(x)) {
                    this.plugins.forEach(z => z.call(z.onSerializeClass, [stream, x]));
                    const serClass = new Serializer(x);
                    serClass._Serialize(stream, x, callees)
                } else {
                    throw new Error(`${callees.join('/')}/$${iterator}: ${x} is not a Serializable object (not ISerializable<any> | SerializableValue)`);
                }
            }
        }
        this.plugins.forEach(z => z.call(z.onSerializeEnd, [stream]));
        return stream.buffer;
    }
}

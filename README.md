## Serialization
### Example:
```ts
@SerializableClass<E>()
class E {
    examplefield: number = 32
    examplearray: number[] = [1, 2]
    static _name = 'abc' // Unique name
    static GetSerializables(): Map<string, Serializable>{
        let map = new Map<string, Serializable>()
        map.set('examplefield', new Integer({..args}))
        map.set('examplearray', new Vector(new Integer({..args})))
        return map
    }
}

let interface = new Serializer(E)
let object = new E()
let serializedStream: Buffer = interface.Serialize(object)
assert(object === interface.Deserialize(serializedStream))
```

### Notes
For asymetrical serialization we recommend creating your own `SerializableValue` implementation.

All values are serialized and deserialized assuming Little Endian.

If there is a type mismatch (or other problem) the Serializer will throw an exception, so it's recommended to do serialization in a try-catch or in a seperate thread.

While the fields are read from binary there is no garantee that the retrieved classes will be equal or deepequal, this can be because some fields are not configured for serialization.

This library should mostly follow C++/C Little Endian binary representations, this is to provide as much interop as possible.

Binary serialization can currently only be done if both parties have the class definitions, Dynamic serialization may be explored in later revisions

If there is a undocumented discrepancy between this library and C++/C please file an issue with one of the maintainers 

Varints have the same encoding as bitcoin-core's varints

### Dependencies
* class-transformer
* bigint-buffer
* utils.ts 
  * Provides a wrapper on bigint-buffer which enables signed integer serialization



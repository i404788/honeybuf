# Description
### Examples
See `/examples` folrder.

### Notes
For asymetrical serialization we recommend creating your own `SerializableValue` implementation.

All values are serialized and deserialized assuming Little Endian.

If there is a type mismatch (or other problem) the Serializer will throw an exception, so it's recommended to do serialization in a try-catch or in a seperate thread.

While the fields are read from binary there is no garantee that the retrieved classes will be equal or deepequal, this can be because some fields are not configured for serialization.

This library should mostly follow C++/C Little Endian binary representations, this is to provide as much interop as possible.

Binary serialization can currently only be done if both parties have the class definitions, Dynamic serialization may be explored in later revisions

If there is a undocumented discrepancy between this library and C++/C please file an issue with one of the maintainers

Varints have the same encoding as bitcoin-core's varints

## Usage

### Designing your data class 
Before your class put the `@SerializableClass` decorator.

Then for each field you want to include in serialization add the `@Serialized(...)` decorator.
The parameter should be a `SerializableValue` which supports the field you want to serialize.

```
@SerializableClass
class TestClass {
    // Note: The <number> is optional, but should be added if you want typechecking
    // This does allow for serialized properties to be handled both loosely and strictly
    @Serialized<number>(new Integer({bits: 32}))
    int: number = 4

    @Serialized<string>(new CharVector())
    r: string
    ...
}
```

> See `examples/basic.ts` for full example

### (De-)Serializing objects
```
@SerializableClass
class TestClass {
    ...
}
let serializer = new Serializer<TestClass>(TestClass)

let object = new TestClass('abc')
let binary: Buffer = x.Serialize(object)
// <Buffer 05 00 00 00 03 61 62 63>

let newobject = serializer.Deserialize(binary)
// TestClass { int: 4, r: 'abc' }
```
> See `examples/basic.ts` for full example

### Nesting data classes
> I heard you like classes so we put classes in your classes

You can use other `SerializableClass`s in your data class by using the following the class-type as the parameter of `@Serialized(...)`. It will automatically deserialize the nested classes.

```
@SerializableClass
class WrapperClass {
    @Serialized<TestClass>(TestClass)
    base: TestClass

    ... 
}

```

> See `examples/nest.ts` for full example

## Misc

### Dependencies
We only use a few dependencies (1.2MB total).
Sorted by size (children included):
* reflect-metadata
* bigint-buffer
* xxh3-ts
* bigint-popcnt

## TODO
* Add fault tolerance extension
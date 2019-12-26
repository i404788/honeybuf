# Honeybuf
A sweet buffer allowing you to integrate serialization into your classes, while having protobuf-like control.

### Features
* Built-in types
    * BigInteger
    * Integer
    * CharVector (string)
    * Vector\<T\>
    * BufferLike
    * SingleBoolean
    * DenseBooleanArray
    * MapLike<K,V>
* Strongly typed
* Custom types
    * In as few as 12 loc
    * Fine-grained control
    * Generic type support
    * Parameterized types
* Plugins

### Examples
See `/examples` folrder.

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

## Plugins
### CompHash
The CompHash plugin allows you to validate a class for both the correct field-types (components) and versioning.
It uses a bloomfilter to check for membership of each component.

Essentially it keeps track of which components/versions are used in the object; when recieving an object you can validate that the components/versions are the same as were used to create the object.

You can configure it to be `strict` (throw error if not equal), `unversioned` (track the components by name), `versioned` (track components by version); these can be combined as seen in the examples.

This plugin will add some bytes to your binary object, expect a 1-2 bytes per component tracked (using both versioned and unversioned tracking).

**Example errors:**
```
// Versioned + Unversioned (str changed versions):
[Plugins/CompHash]: Component hashes are inequal(2), missing/changed: str-1.0

// Versioned + Unversioned (str removed/renamed):
[Plugins/CompHash]: Component hashes are inequal(2), missing/changed: str,str-1.1

// Versioned + Unversioned (components were strictly added):
[Plugins/CompHash]: Component hashes are inequal(1), missing/changed:
```

**Notes**
When changing a class' name the CompHash also changes. 

When using only `versioned` doesn't allow you to differentiate between missing and updated (think `<type>-<version>`).
While only `unversioned` doesn't allow you to verify if you are using the same version (think `<type>`).

This plugin currently doesn't allow you to detect programmatically if there was an error, although this may be added later.

```
@ComponentVersion('cde')
class str extends CharVector {}

@AddPlugin(Versioning, [VersioningFlags.Strict | VersioningFlags.Unversioned | VersioningFlags.Versioned])
@SerializableClass
class TestClass {
    ...
    @Serialized<string>(new str())
    r: string = ''
}
```

> See `examples/comp.ts` for full example

## Misc
### Notes
**This section could be outdated in some places**
For asymetrical serialization we recommend creating your own `SerializableValue` implementation.

All values are serialized and deserialized assuming Little Endian.

If there is a type mismatch (or other problem) the Serializer will throw an exception, so it's recommended to do serialization in a try-catch or in a seperate thread.

While the fields are read from binary there is no garantee that the retrieved classes will be equal or deepequal, this can be because some fields are not configured for serialization.

This library should mostly follow C++/C Little Endian binary representations, this is to provide as much interop as possible.

Binary serialization can currently only be done if both parties have the class definitions, Dynamic serialization may be explored in later revisions

If there is a undocumented discrepancy between this library and C++/C please file an issue with one of the maintainers

Varints have the same encoding as bitcoin-core's varints


### Dependencies
We only use a few dependencies (1.2MB total).
Sorted by size (children included):
* reflect-metadata
* bigint-buffer
* xxh3-ts
* bigint-popcnt

## TODO
* Add fault tolerance extension
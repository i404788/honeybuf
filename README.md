# Honeybuf
A sweet typescript serializer allowing you to integrate serialization into your classes, while having protobuf-like control.

## Features
* Built-in types
    * BigInteger (tc39 bigint)
    * Integer (1...52 bit)
    * CharVector (string)
    * Float (16,32,64 bit)
    * Vector\<T\> (T[])
    * BufferLike
    * SingleBoolean
    * DenseBooleanArray (see inline docs)
    * MapLike<K,V> ({K: V})
* Strongly typed
* Custom types
    * In as few as 12 loc
    * Fine-grained control
    * Generic type support
    * Parameterized types
* Plugins


## Index
* [Usage](#usage)
    * [Designing your data class](#designing-your-data-class)
    * [(De-)Serializing objects](#de-serializing-objects)
    * [Nesting data classes](#nesting-data-classes)
* [Plugins](#plugins)
    * [Integrity](#integrity)
    * [CompHash](#comphash)
* [Errors](#errors)
    * [Out of bytes](#out-of-bytes)
    * [Integrity check failed](#integrity-check-failed)
* [Tutorials](#tutorials)
    * [Writing your own type (SerializableValue)](#writing-your-own-type-serializableValue)
* [Misc](#misc)


### Examples
See `/examples` folder.

## Usage
### Designing your data class 
Before your class put the `@SerializableClass` decorator.

Then for each field you want to include in serialization add the `@Serialized(...)` decorator.
The parameter should be a `SerializableValue` which supports the field you want to serialize.

**The only requirement is that your class doesn't explicitly throw an error when no parameters are provided.**
You are allowed to put methods, properties, and everything else you want into your class without a problem.

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

    @Serialized<number>(new Integer({bits: 8}))
    additionalint: number = 1
    ... 
}


let object = new WrapperClass()
let binary: Buffer = x.Serialize(object)
// <Buffer <Buffer 01 04 00 00 00 03 61 62 63>
let newobject = serializer.Deserialize(binary)
// WrapperClass { additionalint: 1, base: TestClass { int: 4, r: 'abc' } }
```

> See `examples/nest.ts` for full example

## Plugins
### Integrity
The Integrity plugin allows you to validate the correctness of a binary data-struct by including a hash at the end.
It is configurable for `1 | 2 | 4 | 8 | 16` bytes, using a higher number decreases the probability of the corruption not being detected.

We use the XXH3_128 hash function to create the hash.

> See `examples/integrity.ts` for full example


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

When changing a class' name the CompHash also changes, so these should be consistent between systems.

When using only `versioned` doesn't allow you to differentiate between missing and updated (think hash of `<type>-<version>`).
While only `unversioned` doesn't allow you to verify if you are using the same version (think hash of `<type>`).

This plugin currently doesn't allow you to detect programmatically if there was an error, although this may be added later.

When using `unversioned` you still need the `@ComponentVersion` decorator, but you don't *need* to fill in a version.

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

## Errors
In most cases if there is a problem honeybuf will throw an error. 

Here are some common ones and their causes.

### Out of bytes
This is a generic error indicating that the binary you are deserializing is likely corrupted, or was serialized with different structure.
This usually happens when deserializing arrays/vectors/maps, as their dynamic-size pointer was corrupted.

Example where the binary was corrupted:
```
Error: Out of bytes
    at SerialStream.ReadBytes (barestream.js:65:19)
    at BufferLike.Read (builtin-types.js:145:23)
    at CharVector.Read (builtin-types.js:130:26)
    at Serializer._Deserialize (serializer.js:73:42)
    at Serializer.Deserialize (serializer.js:56:21)
```

### Integrity check failed
When using the Integrity plugin you are able to verify if the message was corrupted by using a hash function.
If you get this error the structure was valid, but the contents were modified.

Example where the binary was corrupted:
```
Error: Integrity check failed: 312365754742516870814534883039279513871 !== 2556109583
    at Integrity.onDeserializeEnd (plugins.js:130:19)
    at Integrity.call (serializer.js:28:25)
    at serializer.js:86:37
    at Array.forEach (<anonymous>)
    at Serializer._Deserialize (serializer.js:86:22)
    at Serializer.Deserialize (serializer.js:56:21)
```

## Tutorials
### Writing your own type (SerializableValue)
For examples look in `src/builtin-types.ts`, most are within 20 lines.

For this example, let's say you want to serialize an StringEnum where you use string values as an enum.
A string enum (in typescript) might look something like:
```
type StringEnum = 'value1' | 'value2' | 'value3'
```

If we want to convert that enum to binary form (without writing out the full string), we need to write a custom `SerializableValue`.

`SerializableValue`s are used to deserialize all non-classes; generally primitive/native javascript types.

Writing a new SerializableValue is generally pretty easy simple but there are a few things to consider.

In this example we write a verbose version of our StringEnum, with Versioning. Versioning usually a good thing to add to your type, especially if you expect it to change over time. If versioning is not used by the parent class it will be ignored, so there are no real downsides.

```
@ComponentVersion('1.0')
export class StringEnum extends Serializable<StringEnum> {
    const enumValues = ['value1', 'value2', 'value3']
    public Write(stream: SerialStream, value: StringEnum) {
        // Verify that the input is in our enum
        if (enumValues.includes(value)) {
            const indexValue = enumValues.indexOf(value)
            // 8-bit, using a single byte, sub-byte values are not recommended
            stream.WriteInt(8, indexValue);
        } else {
            // Throw an error whenever we *can't* (de-)serialize
            throw new Error('[StringEnum/Write]: Value not in enum')
        }
    };
    public Read(stream: SerialStream): StringEnum {
        // Value of `WriteInt` in the Write method
        // Returned as a BigInt
        const _val = stream.ReadInt(8, true)

        // Cast to Number so we can use it as an index
        const index = Number(_val)

        // Retrieve string value from our enum
        const retvalue = enumValues[index];

        // If value is not within our enum
        if (!retvalue) {
            throw new Error('[StringEnum/Read]: Value not in enum')
        }

        return retvalue;
    };
}
```

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
We only use a few dependencies.
* External
    * reflect-metadata
    * bigint-buffer
* Created by us
    * tiny-bloomfilter
    * xxh3-ts
    * bigint-popcnt

## TODO
* Add fault tolerance extension
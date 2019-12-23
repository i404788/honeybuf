import { isComponent, ComponentVersion, CollectionHash, ClassKey, VersionKey, ComponentID, Component } from "../src/misc/comphash";
import BloomFilter from "../src/misc/bloom";

@ComponentVersion('1.44')
class TestA {}

@ComponentVersion('0.25')
class TestB {}

@ComponentVersion('0.52')
class TestC {}

const x = new TestA()
const y = new TestB()

const test = (x: Constructor<Component>, f: BloomFilter) => console.log(`Is ${ComponentID(x)} active ${f.test(ComponentID(x))}`)

if (isComponent(x)){
    let h = CollectionHash([x, y])
    console.log(h)
    console.log(BigInt('0x' + h.toString('hex')).toString(2))
    const filter = BloomFilter.fromBuffer(h)
    // console.log(filter.filter)
    test(TestA, filter)
    test(TestB, filter)
    test(TestC, filter)
} else {
    throw new Error('Test case in not detected as compontnt')
}

// TODO: benchmark fp rate (at different debugmodes)
// TODO: test comphas plugin

import { SerializableClass, Serialized, Serializer } from "../src/serializer";
import { Integer, CharVector } from "../src/builtin-types";


@SerializableClass
class TestClass {
    // Note: The <number> is optional, but should be added if you want typechecking
    // This does allow for serialized properties to be handled both loosely and strictly
    @Serialized<number>(new Integer({bits: 32}))
    int: number = 4

    @Serialized<string>(new CharVector())
    r: string

    constructor(r: string) {
        this.r = r
    }
}

let x = new Serializer<TestClass>(TestClass)
let y = new TestClass('abc')
y.int = 5;
let z = x.Serialize(y)
console.log(z)
let a = x.Deserialize(z)
console.log(a)


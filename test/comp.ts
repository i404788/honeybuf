import { isComponent, ComponentVersion, CollectionHash, ClassKey, VersionKey, ComponentID, Component } from "../src/misc/comphash";
import BloomFilter from "../src/misc/bloom";
{
    console.log('Functionality test')
    @ComponentVersion('1.44')
    class TestA { }

    @ComponentVersion('0.25')
    class TestB { }

    @ComponentVersion('0.52')
    class TestC { }

    const x = new TestA()
    const y = new TestB()

    const test = (x: Constructor<Component>, f: BloomFilter) => console.log(`Is ${ComponentID(x)} active ${f.test(ComponentID(x))}`)

    if (isComponent(x)) {
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
}

import { SerializableClass, Serialized, Serializer, AddPlugin } from "../src/serializer";
import { Integer, CharVector } from "../src/builtin-types";
import { Versioning } from "../src/plugins";

{
    @ComponentVersion('abc')
    class int extends Integer { }

    @ComponentVersion('cde')
    class str extends CharVector {}

    @AddPlugin(Versioning, [true])
    @SerializableClass
    class TestClass {
        // Note: The <number> is optional, but should be added if you want typechecking
        // This does allow for serialized properties to be handled both loosely and strictly
        @Serialized<number>(new int({ bits: 32 }))
        int: number = 4

        @Serialized<string>(new str())
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
    // Fault injection
    console.log('\n\nFault Injection test')
    z[z.byteLength-1] = 0x00
    try {
        let a = x.Deserialize(z)
        console.log(a)
    } catch(e) {
        console.log(e)
    }

}

// TODO: benchmark fp rate (at different debugmodes)
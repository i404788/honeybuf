import { isComponent, ComponentVersion, VersionedID, Component, UnversionedID } from "../src/misc/comphash";
import BloomFilter from "tiny-bloomfilter";
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

    const test = (x: Constructor<Component>, f: BloomFilter) => console.log(`Is ${VersionedID(x)} active ${f.test(VersionedID(x))}`)

    if (isComponent(x) && isComponent(y)) {
        let ids = ([x, y] as Component[]).flatMap(x => [VersionedID(x.constructor), UnversionedID(x.constructor)])
        let bf = BloomFilter.fromCollection(ids)
        let h = bf.toBuffer()
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

import { SerializableClass, Serialized, Serializer, AddPlugin, Integer, CharVector, plugins } from "../src";
const { Versioning, VersioningFlags } = plugins;

{
    @ComponentVersion('abc')
    class int extends Integer { }

    @ComponentVersion('cde')
    class str extends CharVector {}

    @AddPlugin(Versioning, [VersioningFlags.Strict | VersioningFlags.Unversioned | VersioningFlags.Versioned])
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

    console.log('\n\nFault Injection test')
    let x = new Serializer<TestClass>(TestClass)
    let y = new TestClass('abc')
    y.int = 5;
    let z = x.Serialize(y)
    console.log(z)
    console.log(VersionedID(int), UnversionedID(int))

    // Fault injection 1: Post-serialization corruption
    // Note: might not trigger all components are distribution is random
    //  Change n in `..length-n` higher to trigger more
    z.fill(0, z.byteLength-2)

    // Fault injection 2: Version incompatibility
    // Reflect.metadata(VersionKey, 'bcd')(int)

    try {
        let a = x.Deserialize(z)
        console.log(a)
    } catch(e) {
        console.log(e)
    }

}
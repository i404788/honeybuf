import { SerializableClass, Serialized, Serializer, Integer, CharVector, plugins, AddPlugin } from "../src";


@AddPlugin(plugins.Integrity, [4])
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

// Fault injection (single byte corruption)
z[Math.floor(Math.random() * z.length)] = Math.floor(Math.random() * 255)

let a = x.Deserialize(z)
console.log(a)
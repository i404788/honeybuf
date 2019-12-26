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


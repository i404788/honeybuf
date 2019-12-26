import { SerializableClass, Serialized, Serializer, Integer, CharVector } from "../src";


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

@SerializableClass
class WrapperClass {
    @Serialized<TestClass>(TestClass)
    base: TestClass

    @Serialized<number>(new Integer({bits: 8}))
    additionalint: number = 3

    get int() {
        return this.base.int
    }

    constructor(){
        this.base = new TestClass('abc')
    }
}

let x = new Serializer<WrapperClass>(WrapperClass)
let y = new WrapperClass()
y.additionalint = 1
y.base.r = 'bcd'
let z = x.Serialize(y)
console.log(z)
let a = x.Deserialize(z)
console.log(a)


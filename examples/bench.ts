import { SerializableClass, Serialized, Serializer, Integer, CharVector, plugins, AddPlugin } from "../src";


// @AddPlugin(plugins.Integrity, [4])
@SerializableClass
class TestClass {
    // Note: The <number> is optional, but should be added if you want typechecking
    // This does allow for serialized properties to be handled both loosely and strictly
    @Serialized<number>(new Integer({bits: 8}))
    int: number = 4

    @Serialized<number>(new Integer({bits: 8}))
    exi: number = 4

    @Serialized<number>(new Integer({bits: 8}))
    past: number = 4

    @Serialized<number>(new Integer({bits: 52}))
    timestamp: number = 4

    @Serialized<string>(new CharVector())
    r: string

    constructor(r: string) {
        this.r = r
    }

    static fromJSON(args: any){
        let ret = new (TestClass as any)()
        for (const key in args) {
            if (args.hasOwnProperty(key) && ret.hasOwnProperty(key)) {
                (ret as any)[key] = args[key]
            }
        }
        return ret as TestClass
    }
}

let x = new Serializer<TestClass>(TestClass)
let y = new TestClass('abc')
y.int = 5;
debugger;

const samples = 100000
let start = Date.now()
let a, z: string | Buffer = ''
for (let i = 0; i < samples; i++) {
    z = x.Serialize(y)    
    a = x.Deserialize(z)
    if (!a) throw new Error('Class wasn\'t deserialized')
}
let span = Date.now()-start
console.log('honeybuf', a, `${z.length}bytes, ${span}ms, ${samples/span}p/ms`)
debugger;

start = Date.now()
for (let i = 0; i < samples; i++) {
    z = JSON.stringify(y)    
    a = TestClass.fromJSON(JSON.parse(z))
    if (!a) throw new Error('Class wasn\'t deserialized')
}
span = Date.now()-start
console.log('json', a, `${z.length}bytes, ${span}ms, ${samples/span}p/ms`)
debugger;
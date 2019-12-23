import { isComponent, ComponentVersion, CollectionHash, ClassKey, VersionKey } from "../src/misc/comphash";
import BloomFilter from "../src/misc/bloom";

@ComponentVersion('1.44')
class TestA {}

@ComponentVersion('0.24')
class TestB {}

const x = new TestA()
const y = new TestB()

if (isComponent(x)){
    let h = CollectionHash([x, y], 4)
    console.log(h)
    console.log(BigInt('0x' + h.toString('hex')).toString(2))
} else {
    throw new Error('Test case in not detected as compontnt')
}
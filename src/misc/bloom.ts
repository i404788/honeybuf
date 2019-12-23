import { XXH64 } from "xxh3-ts";
import { fastpopcnt } from "bigint-popcnt";

const mask64 = ((1n << 64n)-1n)
function Rotl64(a: bigint, n: bigint) {
    return (a << n) | (a >> (64n - n))
}

/**
 * Bloom filter using XXH64, enhanced double hashing, and parallel popcnt
 */
export default class BloomFilter {
    bits: number;
    k: number;
    filter: bigint = 0n;
    seed: bigint = 0x1234567890n
    popcnt: (v: bigint) => bigint

    // k is number of hashes per item
    constructor(bits: number, k: number) {
        this.bits = bits
        this.k = k;
        this.popcnt = fastpopcnt(BigInt(bits))
    }

    public add(v: string | Buffer) {
        this.filter |= BloomFilter.itemHash(v, this.bits, this.k, this.seed)
    }

    public test(v: string | Buffer) {
        let l = BloomFilter.itemHash(v, this.bits, this.k, this.seed)
        return Number(this.popcnt(this.filter & l)) >= this.k
    }

    public compare(bloom: BloomFilter) {
        if (bloom.k !== this.k || bloom.bits !== this.bits || bloom.seed !== this.seed) return -2;
        if (this.filter === bloom.filter) return 0
        if (this.filter > bloom.filter) return 1
        else return -1
    }

    public union(bloom: BloomFilter) {
        if (bloom.k !== this.k || bloom.bits !== this.bits || bloom.seed !== this.seed) throw new Error('Cannot join bloomfilters, parameters incompatible.')
        this.filter |= bloom.filter
    }

    // Estimated cardinality.
    public size() {
        return - (this.bits / this.k) * Math.log(1 - (Number(this.popcnt(this.filter)) / this.bits));
    }

    public static itemHash(v: string | Buffer, bits: number, k: number, seed: bigint = 0xf23456789n): bigint {
        let o = 0n
        let m = BigInt(bits)
        let buf = typeof v === 'string' ? Buffer.from(v) : v
        let a = BigInt(XXH64(buf, 0n))
        if (a < 0n) a *= -1n
        a ^= 0x6740bca37be0516dn

        let delta = Rotl64(a, 17n) | 1n
        let _k = BigInt(k)
        for (let i = 0n; i < _k; ++i) {
            delta += i;
            let bit = a % m;
            o |= 1n << bit;
            a = (a + delta) & mask64
        }
        // console.log(o.toString(2))
        return o
    }

    public static ExpectedFalsePositives(bits: number, n: number) {
        return 0.61285 ** (bits / n)
    }

    public static OptimalK(bits: number, n: number) {
        return (bits / n) * Math.log(2)
    }
}
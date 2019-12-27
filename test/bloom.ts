import BloomFilter from "tiny-bloomfilter";
import { forwardmask, fastpopcnt } from "bigint-popcnt";

const oldbloom = require('./oldbloom')

let bits = 8192
// let x = new oldbloom.BloomFilter(bits, 3)
let x = new BloomFilter(bits, 3)

let testSeed = 0x25e5
let falsePositives = 0
let falseNegatives = 0

const interval = 100
const testiterations = 800
const items = 1000;

for (let i = 0; i < items; i++) {
    if (i % interval === 1) {
        falsePositives = 0
        falseNegatives = 0
        for (let j = 0; j < testiterations; j++) {
            falseNegatives += Number(!x.test(Buffer.from(Math.floor(Math.random() * i).toString(16).padStart(6, '0'), 'hex')))
            falsePositives += Number(x.test(Buffer.from((i + Math.floor(Math.random() * testSeed)).toString(16).padStart(6, '0'), 'hex')))
        }
        console.log(`${i}: size ${x.size().toFixed(5)}, ${falseNegatives / testiterations}:${falsePositives / testiterations}`)
    }
    x.add(Buffer.from(i.toString(16).padStart(6, '0'), 'hex'))
}

console.log('expected false positives:', BloomFilter.ExpectedFalsePositives(bits, items))
console.log(`at optimal k: ${BloomFilter.OptimalK(bits, items)} (aka ${Math.round(BloomFilter.OptimalK(bits, items))})`)



console.log('\n\n\n\n')
console.log('Popcnt benchmark')

// O(bits)
function popcnt(v: bigint) {
    let c = 0
    for (; v; c++) {
        v &= v - 1n; // clear the least significant bit set
    }
    return c
}

// Generalization of https://stackoverflow.com/a/9830282
// Constant time (parallel) O(log2(bits))
// Long setup time, can be precalculated if we know the max bits
// bits = 2 ** n
// function fastpopcnt(bits: bigint) {
//     let mask = (1n << bits) - 1n
//     const fmask = mask
//     let masks: bigint[] = []
//     while (bits > 1) {
//         mask = ((mask << (bits >> 1n)) ^ mask) & fmask
//         masks.push(mask)
//         bits >>= 1n
//     }
//     masks = masks.reverse()
//     return (v: bigint) => { 
//         let bits = 1n
//         // bits >>= 1n
//         // console.log(bits, masks.map(x => x.toString(2)))
//         for (const mask of masks) {
//             v = (v & mask) + ((v & ~mask) >> bits)
//             bits <<= 1n
//         }
//         return v
//     }
// }

const samples = 100000
const sample = 1n
let res = 0
let start = Date.now()
for (let i = 0; i < samples; i++) res = popcnt(sample)
let time = Date.now() - start
console.log(`popcnt: ${res}, samples: ${samples}, ${time}ms, ${samples / time}p/ms`)

start = Date.now()
const max_mask = 8192n
const _popcnt = fastpopcnt(max_mask)
for (let i = 0; i < samples; i++) res = Number(_popcnt(sample))
time = Date.now() - start
console.log(`fastpopcnt(${max_mask}b): ${res}, samples: ${samples}, ${time}ms, ${samples / time}p/ms`)

console.log(forwardmask(64n).map(x => x.toString(2) + ' ' + x.toString(2).length))
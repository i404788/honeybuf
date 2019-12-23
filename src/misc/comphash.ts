/**
 * This is an extension for typescript allowing you to check compatibilty of classes across serialization.
 * We do this using decorators, allowing you to 'version' your class into major/minor revisions.
 * When using this lib a remote peer, which is able to parse the comphash,
 *  should be able to verify if 'something' is outdated; and whether it's a major or minor version
 * 
 * ComponentHashes can be recursively aggregated, however this loses the ability to track which component hash was the different one.
 * The remote validator will need to include the same components as the local 'origin' did.
 * 
 * A bloom filter is used, each element is the value `<component_uuid><version>`
 * If the version changes you will thus be able to detect which component it (likely) is.
*/
import "reflect-metadata";
import BloomFilter from "./bloom";
import { toBufferLE } from "bigint-buffer";

interface Component { 
    constructor: any
}

export const VersionKey = Symbol('VersionKey')
export const ClassKey = Symbol('VersionedClass')

export function isComponent(obj: any): obj is Component {
    return Reflect.hasMetadata(ClassKey, obj.constructor) && Reflect.hasMetadata(VersionKey, obj.constructor)
}

export function ComponentVersion(version: string){
    return function Versioned<T extends {new(...args: any[]):{}}>(constructor: T) {
        const c = constructor
        Reflect.metadata(ClassKey, c.name)(c)
        Reflect.metadata(VersionKey, version)(c)
        return c
    }
}

// debugMode is a exponentiator the amount of bits used, usually 2 or 3 is enough for all cases.
export function CollectionHash<T extends Component>(obj: T[], debugMode = 0): Buffer {
    const len = obj.length
    // Length as a power of 2
    let bits = 1 << Math.ceil(Math.log2(obj.length))
    if (debugMode) bits <<= debugMode;

    let bestK = Math.round(BloomFilter.OptimalK(bits, len)) || 1
    let filter = new BloomFilter(bits, bestK)
    // console.log(BloomFilter.ExpectedFalsePositives(bits, obj.length))

    for (const it of obj) {
        const cname: string = Reflect.getMetadata(ClassKey, it.constructor)
        const major: string = Reflect.getMetadata(VersionKey, it.constructor)
        filter.add(`${cname}${major}`)
    }
    return toBufferLE(filter.filter, bits/8)
}
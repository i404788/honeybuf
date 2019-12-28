import { Plugin, Serializable, Serializer, SerializerKey, isSerializableClass } from "./serializer";
import { SerialStream } from "./barestream";
import { Component, isComponent, VersionedID, UnversionedID } from "./misc/comphash";
import BloomFilter, { FilterComparison } from "tiny-bloomfilter";
import { Logger, logger as defaultlogger, LogTrace, bitmask } from "./utils";

export let logger: Logger = defaultlogger


export enum VersioningFlags {
    None = 0,
    Strict = 1,
    Versioned = 2,
    Unversioned = 4,
}

export class Versioning extends Plugin {
    components: Set<Constructor<Component>> = new Set()
    constructor(private flags: VersioningFlags = VersioningFlags.None) {
        super()
    }

    private getIDs(components: Array<Constructor<Component>>) {
        return components.flatMap((x) => {
            let r = []
            if (this.flags & VersioningFlags.Versioned) r.push(VersionedID(x))
            if (this.flags & VersioningFlags.Unversioned) r.push(UnversionedID(x))
            return r
        })
    }
    public onInitialize<T>(ref: Serializer<T>, type: Constructor<T>, model: T){
        this.components.clear()
        // Go through all components so we can prepend/compare a hash
        const sKeys = Object.getOwnPropertyNames(model)
        for (const key of sKeys) {
            let x = Reflect.getMetadata(SerializerKey, type.prototype, key)
            if (x) {
                if ((x instanceof Serializable || isSerializableClass(x)) && isComponent(x))
                    this.components.add((x as any).constructor)
            }
        }
    }

    public onDeserializeStart(stream: SerialStream): void {
        const len = stream.ReadVarint()
        const rhash = stream.ReadBytes(Number(len))

        const rfilter = BloomFilter.fromBuffer(rhash)
        if (rfilter.bits === 0 || rfilter.k === 0) throw new Error ('[Plugins/CompHash]: Hash was corrupted (-254)')
        const filter = new BloomFilter(rfilter.bits, rfilter.k)

        let components = Array.from(this.components)
        const ids = this.getIDs(components)
        ids.map(x => filter.add(x))

        // console.log(filter.filter.toString(2), rfilter.filter.toString(2))

        // Check bloom filter for equality
        const res = filter.compare(rfilter)
        if (res > 0) {
            // Filters aren't equal
            // Compare which components might differ
            let diff = []
            for (const item of this.components) {
                // Check and add to diff
                if ((this.flags & VersioningFlags.Versioned) && !rfilter.test(VersionedID(item)))
                    diff.push(VersionedID(item))
                if ((this.flags & VersioningFlags.Unversioned) && !rfilter.test(UnversionedID(item)))
                    diff.push(UnversionedID(item))
            }
            // Log
            const msg = `[Plugins/CompHash]: Component hashes are inequal (${res}), missing/changed: ${diff}`
            if (this.flags & VersioningFlags.Strict)
                throw new Error(msg)
            else
                logger(new LogTrace('warning', msg))
        } else if (res === FilterComparison.Incompatible) {
            const msg = `[Plugins/CompHash]: Component hashes are incompatible (${res}), might be a bug in the bloomfilters`
            throw new Error(msg)
        }
        logger(new LogTrace('verbose', '[Plugins/CompHash]: sucess ${res}'))
    }
    public onSerializeStart(stream: SerialStream): void {
        const components = Array.from(this.components)
        const ids = this.getIDs(components)
        const bfilter = BloomFilter.fromCollection(ids)
        const hash = bfilter.toBuffer()
        stream.WriteVarint(hash.byteLength)
        stream.WriteBytes(hash)
    }
}

// TODO: optimize xxh3
import { XXH3_128 } from "xxh3-ts";
export class Integrity extends Plugin {
    constructor(private bytes: 1 | 2 | 4 | 8 | 16 = 4){
        super()
    }

    private getHash(stream: SerialStream): bigint {
        const actualcursor = stream.cursor
        stream.cursor = 0
        const msg = stream.ReadBytes(actualcursor)
        stream.cursor = actualcursor

        return XXH3_128(msg, 0xa35891ca793bc50an);
    }

    public onSerializeEnd(stream: SerialStream): void {
        const hash = this.getHash(stream)
        const bits = 8 * this.bytes
        stream.WriteVarint(this.bytes)
        stream.WriteInt(bits, hash & bitmask(bits)) 
    }

    public onDeserializeEnd(stream: SerialStream): void {
        // Ordering is important because of stream.cursor
        // Don't refactor unless you know what this means
        const hash = this.getHash(stream)
        const len = stream.ReadVarint()
        const bits = 8n * len
        const rhash = stream.ReadInt(Number(bits), true)
        if ((hash & bitmask(Number(bits))) !== rhash) throw new Error(`Integrity check failed: ${hash} !== ${rhash}`)
    }
}
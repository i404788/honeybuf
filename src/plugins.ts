import { Plugin, Serializable, AddPlugin } from "./serializer";
import { SerialStream } from "./barestream";
import { Component, isComponent, CollectionHash, VerificationFilter, ComponentID } from "./misc/comphash";
import BloomFilter, { FilterComparison } from "./misc/bloom";


export class Versioning extends Plugin {
    components: Set<Constructor<Component>> = new Set()
    constructor(private strict = false) {
        super()
    }

    public onDeserializeStart(stream: SerialStream): void { this.components.clear() }
    public onDeserializeClass(stream: SerialStream, obj: any): void {
        if (isComponent(obj))
            this.components.add(obj.constructor)
    }
    public onDeserializeValue(stream: SerialStream, obj: Serializable<any>): void {
        if (isComponent(obj))
            this.components.add((obj as Component).constructor)
    }
    public onDeserializeEnd(stream: SerialStream): void {
        let components = Array.from(this.components)

        const len = stream.ReadVarint()
        const rhash = stream.ReadBytes(Number(len))

        const filter = BloomFilter.fromBuffer(rhash)
        const rfilter = VerificationFilter(components, filter.k, filter.bits)

        // Check bloom filter for equality
        const res = filter.compare(rfilter)
        if (res > 0) {
            // Filters aren't equal
            // Compare which components might differ
            let diff = []
            for (const item of this.components) {
                // Check and add to diff
                if (!rfilter.test(ComponentID(item))) diff.push(ComponentID(item))
            }

            // Log
            const msg = `[Plugins/CompHash]: Component hashes are inequal (${FilterComparison[res]}), missing/changed: ${diff}`
            if (this.strict)
                throw new Error(msg)
            else
                console.warn(msg)
        } else if (res === FilterComparison.Incompatible) {
            const msg = `[Plugins/CompHash]: Component hashes are incompatible (${FilterComparison[res]}), might be a bug in the bloomfilters`
            throw new Error(msg)
        }
        console.debug('[Plugins/CompHash]: sucess', res)
    }
    public onSerializeStart(stream: SerialStream): void { { this.components.clear() } }
    public onSerializeClass(stream: SerialStream, obj: any): void {
        if (isComponent(obj))
            this.components.add(obj.constructor)
    }
    public onSerializeValue(stream: SerialStream, obj: Serializable<any>): void {
        if (isComponent(obj))
            this.components.add((obj as Component).constructor)
    }
    public onSerializeEnd(stream: SerialStream): void {
        let components = Array.from(this.components)
        let hash = CollectionHash(components)
        // TODO: Universal identifier?
        stream.WriteVarint(hash.byteLength)
        stream.WriteBytes(hash)
    }
    public onInitialize() {
    }
}
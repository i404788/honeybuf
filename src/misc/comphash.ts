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

export interface Component { 
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

export function UnversionedID<T extends Constructor<Component>>(obj: T): string {
    return Reflect.getMetadata(ClassKey, obj)
}

// TODO: unversioned component hash for module identification
export function VersionedID<T extends Constructor<Component>>(obj: T): string {
    const cname: string = UnversionedID(obj)
    const major: string = Reflect.getMetadata(VersionKey, obj)
    return `${cname}-${major}`
}
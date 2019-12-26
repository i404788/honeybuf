/**
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
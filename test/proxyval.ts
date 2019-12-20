
import { Integer } from "../src/builtin-types";
import { Serializable } from "../src/serializer";

// Can't be used as decorator, because properties can't have things other than get()/set()
export type Proxy<T> = {
    get(): T;
    set(value: T): void;
    getType(): Serializable<T>;
    setType(type: Serializable<T>): void;
}

export function proxyifyValue<T>(t: T, s: Serializable<T>): Proxy<T> {
    return {
        get: () => t,
        set: (value: T) => t = value,
        getType: () => s,
        setType: (type: Serializable<T>) => s = type
    }
}

let x = 102
let y = new Integer({bits: 32})
let z = proxyifyValue(x, y)
z.set(120)
z.setType(new Integer({bits: 52}))
console.log(x, y, z.get(), z.getType())
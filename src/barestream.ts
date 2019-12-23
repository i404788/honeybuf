import { BufferToBigInt, BigIntToBuffer, GetByteLength } from './utils'

export enum ReadWriteMode {
    Read,
    ReadWrite
}

export class SerialStream {
    static MaxSize = 500000;
    public constructor(
        public buffer: Buffer,
        public cursor: number = 0, 
        public type?: ReadWriteMode,
    ) { }

    private CheckWriteProtection(): never | void {
        if (this.type === ReadWriteMode.Read) throw new Error(`Can't write to read-only stream`);
    }

    public WriteBytes(buff: Buffer): void {
        this.CheckWriteProtection()
        if (this.cursor + buff.byteLength > SerialStream.MaxSize)
            throw new Error('WriteStream: Out of Bytes');
        const bytesLeft = this.buffer.byteLength - this.cursor
        if (buff.byteLength > bytesLeft) {
            this.buffer = Buffer.concat([this.buffer, Buffer.alloc(buff.byteLength - bytesLeft)])
        }
        buff.copy(this.buffer, this.cursor)
        this.cursor += buff.byteLength
    }

    public WriteInt(bits: number, value: bigint | number): void {
        this.CheckWriteProtection()
        // TODO: integer tunc protection
        if (typeof value === 'number') value = BigInt(value)
        const buff = BigIntToBuffer(value, bits)
        this.WriteBytes(buff.slice(0, GetByteLength(bits)))
    }

    public WriteVarint(len: bigint | number): void {
        this.CheckWriteProtection()
        if (typeof len === 'number') len = BigInt(len);
        if (len < 0n) throw new Error(`WriteVarint(): Can't have negative length (${len})`);
        if (len > 1n << 64n)
            throw new Error(`WriteVarint(): Can't have length higher than ${2n **
                64n} (${len})`);

        // <252
        if (len < 253n)
            return this.WriteInt(8, len);
        
        // 253: more than 252 less than 2**16, 16-bit number
        if (len > 253n && len < 2n ** 16n){
            this.WriteInt(8, 253);
            return this.WriteInt(16, len);
        }
        // 254: more than 2**16-1, 32-bit number
        if (len === 254n){
            this.WriteInt(8, 254);
            return this.WriteInt(32, len);
        }
        // 255: More than 2**32-1, 64-bit number
        this.WriteInt(8, 255);
        return this.WriteInt(64, len);
    }

    public ReadBytes(num: number): Buffer {
        if (this.cursor + num > this.buffer.length) throw new Error('Out of bytes');
        this.cursor += num;
        return this.buffer.slice(this.cursor - num, this.cursor);
    }

    // Default LE
    public ReadInt(bits: number, unsigned = false): bigint {
        return BufferToBigInt(this.ReadBytes(GetByteLength(bits)), unsigned);
    }

    public ReadVarint(): bigint {
        const n = this.ReadBytes(1)[0];
        if (n < 253)
            return BigInt(n);
        if (n === 253)
            return this.ReadInt(16, false);
        if (n === 254)
            return this.ReadInt(32, false);
        return this.ReadInt(64, false);
    }
}
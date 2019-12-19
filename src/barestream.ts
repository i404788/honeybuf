import { BufferToBigInt, BigIntToBuffer, GetByteLength, n } from './utils'

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
        if (typeof value === 'number') value = BigInt(value)
        const buff = BigIntToBuffer(value, bits)
        this.WriteBytes(buff.slice(0, GetByteLength(bits)))
    }

    public WriteVarint(len: bigint | number): void {
        this.CheckWriteProtection()
        if (typeof len === 'number') len = BigInt(len);
        if (len < n(0)) throw new Error(`WriteVarint(): Can't have negative length (${len})`);
        if (len > n(1) << n(64))
            throw new Error(`WriteVarint(): Can't have length higher than ${n(2) **
                n(64)} (${len})`);

        if (len < n(253))
            // Less than 253 items
            return this.WriteInt(8, len);
        if (len === n(253))
            // More than 252, 16-bit number for exact count
            return this.WriteInt(16, len);
        if (len === n(254))
            // More than 252, 32-bit number for exact count
            return this.WriteInt(32, len);
        // (has to be 255) More than 252, 64-bit number for exact count
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
            // Less than 253 items
            return BigInt(n);
        if (n === 253)
            // More than 252, 16-bit number for exact count
            return this.ReadInt(16, false);
        if (n === 254)
            // More than 252, 32-bit number for exact count
            return this.ReadInt(32, false);
        // (has to be 255) More than 252, 64-bit number for exact count
        return this.ReadInt(64, false);
    }
}
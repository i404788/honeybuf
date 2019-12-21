const PRIME64_1 = 0x9E3779B185EBCA87n;   /* 0b1001111000110111011110011011000110000101111010111100101010000111 */
const PRIME64_2 = 0xC2B2AE3D27D4EB4Fn;   /* 0b1100001010110010101011100011110100100111110101001110101101001111 */
const PRIME64_3 = 0x165667B19E3779F9n;   /* 0b0001011001010110011001111011000110011110001101110111100111111001 */
const PRIME64_4 = 0x85EBCA77C2B2AE63n;   /* 0b1000010111101011110010100111011111000010101100101010111001100011 */
const PRIME64_5 = 0x27D4EB2F165667C5n;
const kkey = Buffer.from('b8fe6c3923a44bbe7c01812cf721ad1cded46de9839097db7240a4a4b7b3671fcb79e64eccc0e578825ad07dccff7221b8084674f743248ee03590e6813a264c3c2852bb91c300cb88d0658b1b532ea371644897a20df94e3819ef46a9deacd8a8fa763fe39c343ff9dcbbc7c70b4f1d8a51e04bcdb45931c89f7ec9d9787364eac5ac8334d3ebc3c581a0fffa1363eb170ddd51b7f0da49d316552629d4689e2b16be587d47a1fc8ff8b8d17ad031ce45cb3a8f95160428afd7fbcabb4b407e', 'hex')
const mask64 = (1n << 64n) - 1n;
const STRIPE_LEN = 64
const KEYSET_DEFAULT_SIZE = 48   /* minimum 32 */
const STRIPE_ELTS = (STRIPE_LEN / 4)
const ACC_NB = (STRIPE_LEN / 8)



// Basically (byte*)buf + offset
function getView(buf: Buffer, offset: number = 0): Buffer {
    return Buffer.from(buf.buffer, buf.byteOffset + offset, buf.length - offset)
}

const XXH_mult32to64 = (a: bigint, b: bigint) => a * b & mask64
const assert = (a: boolean) => { if (!a) throw new Error('Assert failed') }

function XXH3_accumulate_512(acc: BigUint64Array, data: Buffer, key: Buffer) {
    for (let i = 0; i < ACC_NB; i++) {
        const left = 2 * i;
        const right = 2 * i + 1;
        const dataLeft = BigInt(data.readUInt32LE(left * 4)); 
        const dataRight = BigInt(data.readUInt32LE(right * 4)); //XXH_readLE32(xdata + right);
        acc[i] += XXH_mult32to64(dataLeft + BigInt(key.readUInt32LE(left * 4)), dataRight + BigInt(key.readUInt32LE(right * 4)))
        acc[i] += dataLeft + (dataRight << 32n);
    }
}

function XXH3_accumulate(acc: BigUint64Array, data: Buffer, key: Buffer, nbStripes: number) {
    for (let n = 0, k = 0; n < nbStripes; n++) {
        XXH3_accumulate_512(acc, getView(data, n * STRIPE_LEN), getView(key, k));
        k += 2
    }
}

function XXH3_scrambleAcc(acc: BigUint64Array, key: Buffer) {
    for (let i = 0; i < ACC_NB; i++) {
        const left = 2 * i;
        const right = 2 * i + 1;
        acc[i] ^= acc[i] >> 47n;
        const p1 = XXH_mult32to64((acc[i] & 0xFFFFFFFFn), BigInt(key.readUInt32LE(left)));
        const p2 = XXH_mult32to64(acc[i] >> 32n, BigInt(key.readUInt32LE(right)));
        acc[i] = p1 ^ p2;
    }
}

function XXH3_mix2Accs(acc: BigUint64Array, acc_offset: number, key: Buffer) {
    return XXH3_mul128(
        acc[0+acc_offset] ^ key.readBigUInt64LE(0),
        acc[1+acc_offset] ^ key.readBigUInt64LE(8));
}

function XXH3_mergeAccs(acc: BigUint64Array, key: Buffer, start: bigint) {
    let result64 = start;
    
    // FIXME: 12 * 4 == 48???
    result64 += XXH3_mix2Accs(acc, 0, getView(key, 0));
    result64 += XXH3_mix2Accs(acc, 2, getView(key, 16));
    result64 += XXH3_mix2Accs(acc, 4, getView(key, 32));
    result64 += XXH3_mix2Accs(acc, 6, getView(key, 48));

    return XXH3_avalanche(result64);
}

const NB_KEYS = ((KEYSET_DEFAULT_SIZE - STRIPE_ELTS) / 2)
function XXH3_hashLong(acc: BigUint64Array, data: Buffer) {
    const block_len = STRIPE_LEN * NB_KEYS;
    const nb_blocks = data.length / block_len;

    for (let n = 0; n < nb_blocks; n++) {
        XXH3_accumulate(acc, getView(data, n * block_len), kkey, NB_KEYS);
        XXH3_scrambleAcc(acc, getView(kkey, 4 * (KEYSET_DEFAULT_SIZE - STRIPE_ELTS)))
    }

    assert(data.length > STRIPE_LEN);
    {
        const nbStripes = (data.length % block_len) / STRIPE_LEN;
        assert(nbStripes < NB_KEYS);
        XXH3_accumulate(acc, getView(data, nb_blocks * block_len), kkey, nbStripes);

        /* last stripe */
        if (data.length & (STRIPE_LEN - 1)) {
            const p = getView(data, data.length - STRIPE_LEN);
            XXH3_accumulate_512(acc, p, getView(kkey, nbStripes * 2));
        }
    }

}

function XXH3_hashLong_128b(data: Buffer, seed: bigint) {
    const acc = new BigUint64Array([seed, PRIME64_1, PRIME64_2, PRIME64_3, PRIME64_4, PRIME64_5, -seed, 0n]);
    assert(data.length > 128);

    XXH3_hashLong(acc, data);

    /* converge into final hash */
    assert(acc.length * 8 == 64);
    {
        const low64 = XXH3_mergeAccs(acc, kkey, BigInt(data.length) * PRIME64_1);
        const high64 = XXH3_mergeAccs(acc, getView(kkey, 16), BigInt(data.length+1) * PRIME64_2);
        return (high64 << 64n) | low64
    }
}


function XXH3_mul128(a: bigint, b: bigint) {
    const lll = a * b;
    return (lll + (lll >> 64n)) & mask64;
}

function XXH3_mix16B(data: Buffer, data_offset: number, key: Buffer, key_offset: number) {
    return XXH3_mul128(data.readBigUInt64LE(data_offset) ^ key.readBigUInt64LE(key_offset),
        data.readBigUInt64LE(data_offset + 8) ^ key.readBigUInt64LE(key_offset + 8));
}

function XXH3_avalanche(h64: bigint) {
    h64 ^= h64 >> 29n;
    h64 *= PRIME64_3;
    h64 &= mask64;
    h64 ^= h64 >> 32n;
    return h64;
}

export function XXH3_128bits_withSeed(data: Buffer, seed: bigint) {
    const len = data.length
    let acc1 = PRIME64_1 * (BigInt(len) + seed)
    let acc2 = 0n
    if (len > 32) {
        if (len > 64) {
            if (len > 96) {
                if (len > 128) {
                    return XXH3_hashLong_128b(data, seed);
                }
                acc1 += XXH3_mix16B(data, 48, kkey, 96);
                acc2 += XXH3_mix16B(data, len - 64, kkey, 112);
            }
            acc1 += XXH3_mix16B(data, 32, kkey, 64);
            acc2 += XXH3_mix16B(data, len - 48, kkey, 80);
        }
        acc1 += XXH3_mix16B(data, 16, kkey, 32);
        acc2 += XXH3_mix16B(data, len - 32, kkey, 48);
    }
    acc1 += XXH3_mix16B(data, 0, kkey, 0);
    acc2 += XXH3_mix16B(data, len - 16, kkey, 16);

    const part1 = (acc1 + acc2) & mask64
    const part2 = ((acc1 * PRIME64_3) + (acc2 * PRIME64_4) + ((BigInt(len) - seed) * PRIME64_2)) & mask64;

    return (XXH3_avalanche(part1) << 64n) | XXH3_avalanche(part2)
}


export function XXH3_128bits(data: Buffer) {
    return XXH3_128bits_withSeed(data, 0n)
}
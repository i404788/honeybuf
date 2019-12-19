import { CharVector, Integer } from "../src/builtin-types";
import { SerialStream } from "../src/barestream";

// Note, using BigIntegers because javascript can't use 64bit uints with the 'number' type
const uint8_t = new Integer({bits: 8, unsigned: true})
const uint16_t = new Integer({bits: 16, unsigned: true})
const uint52_t = new Integer({bits: 52, unsigned: true})
const string = new CharVector()

enum MsgType {
    Driblet = 0,
    Ping = 1,
    Register = 2,
    Goodbye = 3
    //...
}

function createBin(){
    let stream = new SerialStream(Buffer.alloc(0))
    uint8_t.Write(stream, 1);
    uint8_t.Write(stream, MsgType.Driblet);
    uint16_t.Write(stream, 0xA0);
    string.Write(stream, "12d")
    uint52_t.Write(stream, 1576776392)
    string.Write(stream, '{"uid":"Ryan"}')
    return stream.buffer
}

function decodeBin(buf: Buffer){
    let stream = new SerialStream(buf)
    const ver = uint8_t.Read(stream)
    const type = uint8_t.Read(stream)
    const ID = uint16_t.Read(stream)
    const UID = string.Read(stream)
    const timestmap = uint52_t.Read(stream)
    const body = string.Read(stream)
    console.log(ver, type, ID, UID.toString(), timestmap, body.toString())
}

const bin = createBin()
console.log(bin)
decodeBin(bin)

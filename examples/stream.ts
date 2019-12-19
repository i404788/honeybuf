import { SerialStream } from "../src/serialization";


enum MsgType {
    Driblet = 0,
    Ping = 1,
    Register = 2,
    Goodbye = 3
    //...
}

// Stream will automatically allocate new memory as needed
// 500KB max currently allowed
function createBin(){
    let stream = new SerialStream(Buffer.alloc(0))
    stream.WriteInt(8, 1)       // ver 
    stream.WriteInt(8, MsgType.Driblet) // type
    stream.WriteInt(16, 0xA0)// ID
    const BucketUID = '12d'
    stream.WriteVarint(BucketUID.length)
    stream.WriteBytes(Buffer.from(BucketUID))
    stream.WriteInt(64, 1576776392n)
    const body = '{"uid":"Ryan"}'
    stream.WriteVarint(body.length)
    stream.WriteBytes(Buffer.from(body))
    return stream.buffer
}

function decodeBin(buf: Buffer){
    let stream = new SerialStream(buf)
    const ver = stream.ReadInt(8, true)
    const type = stream.ReadInt(8, true)
    const ID = stream.ReadInt(16, true)
    const UID_len = stream.ReadVarint()
    const UID = stream.ReadBytes(Number(UID_len))
    const timestmap = stream.ReadInt(64, true)
    const body_len = stream.ReadVarint()
    const body = stream.ReadBytes(Number(body_len))
    console.log(ver, type, ID, UID.toString(), timestmap, body.toString())
}

const bin = createBin()
console.log(bin)
decodeBin(bin)

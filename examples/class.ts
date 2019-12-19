import { staticImplements, Serializable, SerializableConstructor, CharVector, Serializer, Integer } from "../src/serialization";

enum MsgType {
    Driblet = 0,
    Ping = 1,
    Register = 2,
    Goodbye = 3
    //...
}

@staticImplements<SerializableConstructor<Msg>>()
class Msg {
    procVersion: number = 1
    msgType: MsgType = MsgType.Driblet
    ID: number = 0xA0
    bucketUID: string = '12d'
    timestamp: number = 1576776392
    body: string = '{"uid":"Ryan"}'

    static _name = 'abc' // Unique name
    static GetSerializables(): Map<string, Serializable>{
        let map = new Map<string, Serializable>()
        map.set('procVersion',  new Integer({bits: 8, unsigned: true}))
        map.set('msgType',      new Integer({bits: 8, unsigned: true}))
        map.set('ID',           new Integer({bits: 16, unsigned: true}))
        map.set('bucketUID',    new CharVector())
        map.set('timestamp',    new Integer({bits: 52, unsigned: true}))
        map.set('body',         new CharVector())

        return map
    }
}

function calcOriginal(msg: Msg) {
    let str: string = '';
    str += msg.procVersion.toString() 
    str += Number(msg.msgType).toString()
    str += msg.ID.toString()
    str += msg.bucketUID.toString()
    str += msg.timestamp.toString()
    str += msg.body.toString()
    return str
}

const msg = new Msg()
msg.ID = 0x3D
msg.procVersion = 2
msg.body = "Changing the class so it's not even close to the default"
console.log(msg)
const ser = new Serializer(Msg);
const buf = ser.Serialize(msg)
console.log(buf.toString(), `   //In total ${buf.byteLength} bytes`)
console.log(calcOriginal(msg), `   //Which is ${Buffer.from(calcOriginal(msg)).byteLength} bytes`)
const omsg = ser.Deserialize(buf)
console.log(omsg)
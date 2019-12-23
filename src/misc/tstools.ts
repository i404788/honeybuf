type NonMethodKeys<T> = ({[P in keyof T]: T[P] extends Function ? never : P } & { [x: string]: never })[keyof T];  
type RemoveMethods<T> = Pick<T, NonMethodKeys<T>>; 
type RequireOne<T> = (keyof T) extends infer K ?
    K extends keyof T ?
    Required<Pick<T, K>> : never : never

type Constructor<T> = {new(...args: any): T, [key: string]: any}
type StrictConstructor<T, A extends any[]> = {new(...args: A): T, [key: string]: any}
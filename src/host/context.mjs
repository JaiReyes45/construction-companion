import {createHmac,timingSafeEqual} from 'node:crypto';
import {scopeKey,id,exact,fail} from '../contracts.mjs';
function validate(v){exact(v,['scope','turnId','expiresAt']);scopeKey(v.scope);id(v.turnId);if(!Number.isSafeInteger(v.expiresAt))fail('INVALID');}
export function signContext(value,secret){validate(value);if(Buffer.byteLength(secret)<32)fail('INVALID');const body=Buffer.from(JSON.stringify(value)).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');}
export function verifyContext(token,secret,now=Date.now()){
 if(typeof token!=='string'||token.length>4096)fail('UNAUTHORIZED');
 const [body,signature,...extra]=token.split('.');if(!body||!signature||extra.length)fail('UNAUTHORIZED');
 const expected=createHmac('sha256',secret).update(body).digest('base64url'),a=Buffer.from(signature),b=Buffer.from(expected);
 if(a.length!==b.length||!timingSafeEqual(a,b))fail('UNAUTHORIZED');
 let value;try{value=JSON.parse(Buffer.from(body,'base64url').toString());validate(value);}catch{fail('UNAUTHORIZED');}
 if(now>=value.expiresAt)fail('EXPIRED');return value;
}

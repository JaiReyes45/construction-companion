import {exact,id,fail} from '../contracts.mjs';
import {pages} from './templates.mjs';
export function validateMemoryWrite(input){
 exact(input,['page','expectedHash','operationId','content']);id(input.operationId);
 if(!Object.hasOwn(pages,input.page))fail('INVALID','Unknown project page');
 if(input.expectedHash!==null&&(typeof input.expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedHash)))fail('INVALID','Expected current page hash or null');
 if(typeof input.content!=='string'||Buffer.byteLength(input.content)>65536||input.content.includes('<!-- companion:'))fail('INVALID','Invalid memory content');
 return input;
}

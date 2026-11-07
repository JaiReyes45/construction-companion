import {fail} from '../contracts.mjs';
export function createHostClient({endpoint,token,fetchImpl=fetch}){
 const url=new URL(endpoint);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.search||url.hash)fail('INVALID','Loopback endpoint required');
 return {async call(method,input,{context,requestId,signal}={}){
  const r=await fetchImpl(new URL('/host/rpc',url),{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({method,input,context,requestId}),signal});
  const data=await r.json();if(!r.ok)fail(data.error?.code??'INVALID',data.error?.message??'Host request failed');return data;
 }};
}

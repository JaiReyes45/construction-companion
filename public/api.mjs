export function createApi({origin,token,fetchImpl=fetch}){
 let credential=token;
 async function call(route,data){
  if(!credential)throw Object.assign(Error('Connect to your local project.'),{code:'UNAUTHORIZED'});
  const response=await fetchImpl(new URL(route,origin),{method:data===undefined?'GET':'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error?.message??'Local service unavailable'),{code:result.error?.code??'UNAVAILABLE',status:response.status});return result;
 }
 return {
  sessions:()=>call('/api/sessions'),
  async load(key){const q='?sessionKey='+encodeURIComponent(key);const [scene,question,recommendations,installation,memory,bindings]=await Promise.all(['scene','question','skills','installation','memory','bindings'].map(p=>call('/api/'+p+q)));return {scene,question,recommendations,installation,memory,bindings};},
  answer:(sessionKey,reply)=>call('/api/question/answer',{sessionKey,...reply}),
  setMemoryConsent:(sessionKey,input)=>call('/api/memory/consent',{sessionKey,...input}),
  dispose(){credential=null;}
 };
}

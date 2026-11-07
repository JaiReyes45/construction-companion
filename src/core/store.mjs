import {DatabaseSync} from 'node:sqlite';
import {canonical,fail,id,scopeKey,validateEvent} from '../contracts.mjs';
export function openStore(databasePath) {
 const db=new DatabaseSync(databasePath);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 db.exec('CREATE TABLE IF NOT EXISTS events(cursor INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, UNIQUE(scope,id)); CREATE TABLE IF NOT EXISTS state(scope TEXT NOT NULL,key TEXT NOT NULL,version INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(scope,key)); PRAGMA user_version=1;');
 db.exec('CREATE INDEX IF NOT EXISTS events_scope_cursor ON events(scope,cursor);');
 let depth=0;
 const store={
  transaction(fn){
   if(fn.constructor?.name==='AsyncFunction')fail('INVALID','Transactions must be synchronous');
   const point='nested_'+depth;db.exec(depth?'SAVEPOINT '+point:'BEGIN IMMEDIATE');depth++;
   try{const result=fn();if(result?.then)fail('INVALID','Transactions must be synchronous');depth--;db.exec(depth?'RELEASE '+point:'COMMIT');return result;}
   catch(e){depth--;db.exec(depth?'ROLLBACK TO '+point:'ROLLBACK');if(depth)db.exec('RELEASE '+point);throw e;}
  },
  append(input){
   const e=validateEvent(input),scope=scopeKey(e),body=canonical(e);
   return store.transaction(()=>{
    const old=db.prepare('SELECT cursor,body FROM events WHERE scope=? AND id=?').get(scope,e.eventId);
    if(old){if(old.body!==body)fail('CONFLICT','Event ID reused with different content');return {cursor:old.cursor,duplicate:true};}
    const r=db.prepare('INSERT INTO events(scope,id,body) VALUES(?,?,?)').run(scope,e.eventId,body);
    return {cursor:Number(r.lastInsertRowid),duplicate:false};
   });
  },
  list(scope,{after=0,limit=100}={}){
   if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1)fail('INVALID','Invalid cursor');
   const rows=db.prepare('SELECT cursor,body FROM events WHERE scope=? AND cursor>? ORDER BY cursor LIMIT ?').all(scopeKey(scope),after,Math.min(limit,100));
   const out=[];let bytes=2;
   for(const row of rows){const e={...JSON.parse(row.body),cursor:row.cursor};const size=Buffer.byteLength(JSON.stringify(e))+1;if(bytes+size>786432)break;bytes+=size;out.push(e);}
   return out;
  },
  read(scope,key){const r=db.prepare('SELECT version,body FROM state WHERE scope=? AND key=?').get(scopeKey(scope),id(key));return r?{version:r.version,value:JSON.parse(r.body)}:null;},
  compareAndSet(scope,key,expectedVersion,value){
   return store.transaction(()=>{
    const old=store.read(scope,key);if((old?.version??null)!==expectedVersion)fail('CONFLICT','State version changed');
    const version=(old?.version??0)+1,body=canonical(value);if(typeof body!=='string')fail('INVALID');
    db.prepare('INSERT INTO state(scope,key,version,body) VALUES(?,?,?,?) ON CONFLICT(scope,key) DO UPDATE SET version=excluded.version,body=excluded.body').run(scopeKey(scope),key,version,body);
    return {version,value:JSON.parse(body)};
   });
  },
  // Internal enumeration is confined to registered scopes; never exposed as a browser query.
  scan(prefix=''){return db.prepare('SELECT scope,key,version,body FROM state WHERE substr(key,1,?)=?').all(prefix.length,prefix).map(r=>({scope:JSON.parse(r.scope),key:r.key,version:r.version,value:JSON.parse(r.body)}));},
  close(){db.close();}
 };
 return store;
}

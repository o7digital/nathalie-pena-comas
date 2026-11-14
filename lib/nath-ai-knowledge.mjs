import {readFile} from 'node:fs/promises';

let bundled;
export function publishedKnowledge(){
 return bundled??=readFile(new URL('./nath-ai-knowledge.generated.json',import.meta.url),'utf8').then(JSON.parse);
}

// An older preview may still be visited. It must never replace newer published facts.
export async function ensureKnowledge(upstream,manifest=undefined){
 manifest??=await publishedKnowledge();
 const current=await upstream('/knowledge/status');
 if(current.status!==200||current.data.version!=='3.6.0'||!Number.isFinite(Date.parse(current.data.publishedAt)))throw Error('Knowledge is unavailable');
 if(Date.parse(current.data.publishedAt)>=Date.parse(manifest.publishedAt)&&
    (current.data.revision===manifest.revision||Date.parse(current.data.publishedAt)>Date.parse(manifest.publishedAt)))return current.data;
 const result=await upstream('/knowledge/sync',{method:'POST',body:JSON.stringify(manifest)});
 if(result.status!==200||result.data.version!=='3.6.0'||
    !(result.data.revision===manifest.revision||result.data.superseded===true&&Date.parse(result.data.publishedAt)>Date.parse(manifest.publishedAt)))throw Error('Knowledge update failed');
 return result.data;
}

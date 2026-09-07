import {pathToFileURL} from 'node:url';
import {startFixtures} from '../test/harness.mjs';
import {startServer} from '../src/server.mjs';

export async function startDemo({port=0}={}) {
  const fixtures=await startFixtures();
  try {
    const app=await startServer({scan:input=>fixtures.scan(input),port,demo:true,targets:Object.keys(fixtures.endpoints)});
    return {...app,fixtures,close:async()=>{await app.close();await fixtures.close();}};
  }catch(error){await fixtures.close();throw error;}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=await startDemo({port:8788});
  console.log(`CONTROLLED DEMONSTRATION: ${app.url}`);
  console.log('Four task-owned loopback fixtures only. The production scanner has no private-address bypass.');
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
}

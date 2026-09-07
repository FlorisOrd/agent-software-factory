import {createPublicScanner} from './assessment.mjs';
import {startServer} from './server.mjs';

const [major,minor]=process.versions.node.split('.').map(Number);
if(major!==24 || minor<19) throw new Error('This pilot requires supported Node.js 24.19 or newer in the Node 24 line.');
const app=await startServer({scan:createPublicScanner()});
console.log(`Private quantum-readiness pilot: ${app.url}`);
console.log('Only assess a target with explicit permission. No customer target is preauthorized. Reports are local and ephemeral.');
for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await app.close();process.exit(0);});

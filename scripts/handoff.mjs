import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildPreview} from '../handoff/build.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(root,'../Frontend-Handoff');
const version='1.0.0';

async function copyTree(from,to){
  await fs.mkdir(to,{recursive:true});
  for(const entry of await fs.readdir(from,{withFileTypes:true})){
    const src=path.join(from,entry.name),dst=path.join(to,entry.name);
    if(entry.isDirectory())await copyTree(src,dst);
    else if(entry.isFile())await fs.copyFile(src,dst);
  }
}

await fs.mkdir(out,{recursive:true});
await copyTree(path.join(root,'src'),path.join(out,'src'));
for(const file of ['csv.mjs','prompt.mjs','seed.mjs','store.mjs']){
  await fs.mkdir(path.join(out,'core'),{recursive:true});
  await fs.copyFile(path.join(root,'core',file),path.join(out,'core',file));
}
for(const [from,to] of [
  ['handoff/fixture.json','demo/fixture.json'],
  ['handoff/browser.js','demo/browser.js'],
  ['handoff/build.mjs','build.mjs'],
  ['handoff/README.md','README.md'],
  ['resources/Outfit-OFL.txt','Outfit-OFL.txt'],
  ['resources/JetBrainsMono-OFL.txt','JetBrainsMono-OFL.txt']
]){
  const dest=path.join(out,to);
  await fs.mkdir(path.dirname(dest),{recursive:true});
  await fs.copyFile(path.join(root,from),dest);
}

const versionOf=async name=>JSON.parse(await fs.readFile(path.join(root,'node_modules',name,'package.json'),'utf8')).version;
const deps={react:await versionOf('react'), 'react-dom':await versionOf('react-dom'), 'lucide-react':await versionOf('lucide-react')};
const devDeps={esbuild:await versionOf('esbuild')};
await fs.writeFile(path.join(out,'package.json'),JSON.stringify({name:'cixu-frontend-handoff',version,private:true,type:'module',scripts:{build:'node build.mjs'},dependencies:deps,devDependencies:devDeps},null,2)+'\n');
execFileSync('cmd.exe',['/d','/c','npm install --package-lock-only --ignore-scripts --offline'],{cwd:out,stdio:'inherit'});

await buildPreview(out,[path.join(root,'node_modules')]);
const zip=path.join(out,`词序-前端交付-${version}.zip`);
await fs.rm(zip,{force:true});
execFileSync('tar',['-a','-c','-f',zip,'-C',out,'README.md','build.mjs','index.html','package.json','package-lock.json','core','src','demo','Outfit-OFL.txt','JetBrainsMono-OFL.txt']);
console.log(`Built ${zip}`);

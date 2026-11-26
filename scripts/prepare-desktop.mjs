import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),version=JSON.parse(await fs.readFile(path.join(root,'node_modules/electron/package.json'),'utf8')).version;
const target=path.join(root,'node_modules/electron');
const source=path.resolve(root,'../manga-studio/node_modules/electron/dist');
try{await fs.access(path.join(target,'dist/electron.exe'));console.log('Electron 运行时已就绪');}
catch{const available=(await fs.readFile(path.join(source,'version'),'utf8')).trim();if(available!==version)throw new Error('现有 Electron 运行时版本不匹配。请运行 node node_modules/electron/install.js 下载。');await fs.cp(source,path.join(target,'dist'),{recursive:true});console.log('已复制本机相同版本的 Electron 运行时，未修改源项目。');}
await fs.writeFile(path.join(target,'path.txt'),'electron.exe');

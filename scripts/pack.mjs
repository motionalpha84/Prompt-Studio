import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),cache=path.join(root,'.cache/builder');
try{await fs.access(cache);}catch{
  const available=path.resolve(root,'../manga-studio/.cache/builder');
  try{await fs.access(available);await fs.mkdir(path.dirname(cache),{recursive:true});await fs.cp(available,cache,{recursive:true});console.log('已复制本机打包工具缓存，不修改源项目。');}catch{await fs.mkdir(cache,{recursive:true});}
}
process.env.ELECTRON_BUILDER_CACHE=cache;
async function locate(base,relative){
  try{await fs.access(path.join(base,relative));return path.join(base,relative);}catch{}
  try{for(const e of await fs.readdir(base,{withFileTypes:true})){if(!e.isDirectory())continue;const p=path.join(base,e.name,relative);try{await fs.access(p);return p;}catch{}}}catch{}
  return null;
}
const nsis=await locate(path.join(cache,'nsis-3.0.4.1'),'Bin/makensis.exe');
const plugins=await locate(path.join(cache,'nsis-resources-3.4.1'),'plugins');
const zip=await locate(path.join(cache,'7zip@1.0.0'),'bin/7za.exe')||await locate(path.join(cache,'7zip@1.0.0'),'bin/7z.exe');
if(nsis){process.env.ELECTRON_BUILDER_NSIS_DIR=path.dirname(path.dirname(nsis));console.log('使用本地 NSIS：',process.env.ELECTRON_BUILDER_NSIS_DIR);}
if(plugins)process.env.ELECTRON_BUILDER_NSIS_RESOURCES_DIR=path.dirname(plugins);
if(zip){process.env.ELECTRON_BUILDER_7ZIP_PATH=zip;console.log('使用本地 7-Zip：',zip);}
const {build,Platform,Arch}=await import('electron-builder');
const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const filename='词序-Prompt-Studio-'+version+'.exe';
const cacheDir=await fs.realpath(path.join(root,'.cache'));
const staging=await fs.mkdtemp(path.join(cacheDir,'portable-'));
try{
  await build({
    targets:Platform.WINDOWS.createTarget('portable',Arch.x64),
    config:{directories:{output:staging}}
  });
  const published=path.join(root,filename);
  await fs.rename(path.join(staging,filename),published);
  console.log('正式版便携启动文件：',published);
}finally{
  const cleanup=await fs.realpath(staging);
  if(path.dirname(cleanup)!==cacheDir || cleanup!==staging)throw new Error('打包临时目录路径异常。');
  await fs.rm(cleanup,{recursive:true,force:true,maxRetries:3});
}

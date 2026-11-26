const {app,net}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const revision='b46f08e5bc5ff98063c1f955786c43850a94b7c0';
const files=[
  ['danbooru','danbooru_2026-10-01_pt20-ia-dd.csv','acdc0685c5a52ac743363adfe4d6a9b4298331d0'],
  ['gelbooru','gelbooru_tags_2026-06-11_pt20_incl_ambiguous.csv','dd25c6691951726baafb49e5725645d98fb6c7f8']
];
app.whenReady().then(async()=>{
  for(const [source,name,expected] of files){
    const url='https://raw.githubusercontent.com/DraconicDragon/dbr-e621-lists-archive/'+revision+'/tag-lists/'+source+'/'+name;
    const r=await net.fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(r.status+' '+source);
    const b=Buffer.from(await r.arrayBuffer()),hash=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
    if(hash!==expected)throw new Error(source+' 文件校验失败');
    const file=path.join(__dirname,'../resources',source+'.csv');await fs.writeFile(file+'.download',b);await fs.rename(file+'.download',file);
  }
  app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});

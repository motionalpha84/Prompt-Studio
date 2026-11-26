import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function buildPreview(root=import.meta.dirname,nodePaths=[]){
  const result=await build({
    absWorkingDir:root,
    nodePaths,
    stdin:{contents:"import './demo/browser.js';import './src/main.jsx';",resolveDir:root,loader:'jsx'},
    bundle:true,write:false,outdir:'bundle',format:'iife',minify:true,
    define:{'process.env.NODE_ENV':'"production"'},
    loader:{'.woff2':'dataurl'},
    legalComments:'inline'
  });
  const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text.replace(/<\/script/gi,'<\\/script');
  const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
  const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>词序 1.0.0 · 流萤前端</title><style>'+css+'</style></head><body><div id="root"></div><script>'+js+'</script></body></html>';
  await fs.writeFile(path.join(root,'index.html'),html);
}

if(process.argv[1] && path.resolve(process.argv[1])===path.join(import.meta.dirname,'build.mjs')) await buildPreview();

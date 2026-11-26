import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'resources');await fs.mkdir(dir,{recursive:true});
const size=256,rgba=Buffer.alloc((size*4+1)*size);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const pos=y*(size*4+1)+1+x*4;const r=51,dx=Math.max(r-x,0,x-(size-r-1)),dy=Math.max(r-y,0,y-(size-r-1));
  const inside=dx*dx+dy*dy<=r*r;
  rgba[pos]=inside?Math.round(108+30*x/size):0;rgba[pos+1]=inside?Math.round(211+15*y/size):0;rgba[pos+2]=inside?Math.round(164+12*x/size):0;rgba[pos+3]=inside?255:0;
  if(inside&&((x>=56&&x<=197&&y>=64&&y<=83)||(x>=56&&x<=160&&y>=117&&y<=136)||(x>=56&&x<=190&&y>=170&&y<=189))){rgba[pos]=16;rgba[pos+1]=38;rgba[pos+2]=31;}
}
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,crc]);}
const hdr=Buffer.alloc(13);hdr.writeUInt32BE(size,0);hdr.writeUInt32BE(size,4);hdr[8]=8;hdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',zlib.deflateSync(rgba)),chunk('IEND',Buffer.alloc(0))]);
await fs.writeFile(path.join(dir,'icon.png'),png);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);await fs.writeFile(path.join(dir,'icon.ico'),Buffer.concat([ico,png]));
console.log('已生成应用图标。');

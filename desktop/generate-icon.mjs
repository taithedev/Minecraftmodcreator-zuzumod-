import fs from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

const size = 256;
const png = new PNG({ width: size, height: size });
const clamp = (v, min = 0, max = 255) => Math.max(min, Math.min(max, v));
function distanceToSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-(ax+t*dx), y-(ay+t*dy));
}
const edges = [
  [128,44,207,90], [207,90,207,168], [207,168,128,213],
  [128,213,49,168], [49,168,49,90], [49,90,128,44],
  [49,90,128,136], [128,136,207,90], [128,136,128,213]
];
for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
  const i=(y*size+x)*4;
  const dx=Math.max(Math.abs(x-127.5)-85,0);
  const dy=Math.max(Math.abs(y-127.5)-85,0);
  const alpha=clamp((43-Math.hypot(dx,dy))*255);
  if(!alpha) continue;
  const radial=clamp(1-Math.hypot(x-89,y-65)/315,0,1);
  let r=12+radial*19,g=18+radial*14,b=32+radial*31;
  let nearest=Infinity;
  for(const edge of edges) nearest=Math.min(nearest,distanceToSegment(x,y,...edge));
  const glow=Math.exp(-nearest*nearest/(2*15*15));
  r+=47*glow;g+=29*glow;b+=93*glow;
  const stroke=clamp(5.1-nearest,0,1);
  const t=clamp((y-44)/175,0,1);
  r=r*(1-stroke)+(146+45*t)*stroke;
  g=g*(1-stroke)+(222-72*t)*stroke;
  b=b*(1-stroke)+255*stroke;
  png.data[i]=clamp(r);png.data[i+1]=clamp(g);png.data[i+2]=clamp(b);png.data[i+3]=alpha;
}
const data=PNG.sync.write(png);
const ico=Buffer.alloc(22);
ico.writeUInt16LE(1,2);
ico.writeUInt16LE(1,4);
ico.writeUInt16LE(1,10);
ico.writeUInt16LE(32,12);
ico.writeUInt32LE(data.length,14);
ico.writeUInt32LE(22,18);
const dest=path.join(import.meta.dirname,'icon.ico');
await fs.writeFile(dest,Buffer.concat([ico,data]));
console.log('Generated ZuzuMod Studio icon:',dest);

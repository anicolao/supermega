import sharp from 'sharp';
import {readFile,copyFile,mkdir,writeFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('art/generation-manifest.json','utf8'));
await mkdir('art/source',{recursive:true});await mkdir('public/assets/generated',{recursive:true});
const dimensions=[];
for(const entry of manifest){
 const source=`art/source/${entry.id}.png`;
 try{await readFile(source);}catch{await copyFile(entry.source,source);}
 const input=sharp(source), metadata=await input.metadata();
 const target=['bolt','moon','star','well'].includes(entry.id)?384:entry.id==='mat'?1800:1000;
 await input.resize({width:target,withoutEnlargement:true}).webp({quality:88,alphaQuality:100}).toFile(`public/assets/generated/${entry.id}.webp`);
 dimensions.push({id:entry.id,source:source,width:metadata.width,height:metadata.height,alpha:metadata.hasAlpha,runtime:`/assets/generated/${entry.id}.webp`});
}
await writeFile('art/assets.json',JSON.stringify(dimensions,null,2)+'\n');
console.log(`Prepared ${manifest.length} imagegen layers, with original PNGs and alpha preserved.`);

import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../validation.js';
import { refineWallWithLines } from './wall-lines.js';
import { wallCandidates } from './wall-regions.js';

export const MODEL_NAME='UPerNet / ConvNeXt-Tiny · ADE20K · CPU';
const acceptedChecksums=new Set(['fea729ab6c5d338bc79ad3d986b073e6faa12c97255eafd78a1f7145326e534e','44ac510412833bf5e3e8586e6b9cba247b94e4251894e054597ebbd02de47d3f']);
const modelPath=()=>path.resolve(process.env.WALL_MODEL_PATH||'models/wall-segmentation-int8.onnx');
let session:ort.InferenceSession|undefined;
let pending:Promise<void>|undefined;
let state:'missing'|'loading'|'ready'|'error'='missing';
export function detectorStatus(){return {available:state==='ready',state,model:MODEL_NAME};}
export function warmDetector():Promise<void>{
  if(pending)return pending;
  if(!existsSync(modelPath()))return Promise.reject(new Error('Wall model is missing. Run npm run model:fetch.'));
  state='loading';
  pending=(async()=>{
    const hash=createHash('sha256');for await(const chunk of createReadStream(modelPath()))hash.update(chunk);
    if(!acceptedChecksums.has(hash.digest('hex')))throw new Error('Wall model checksum mismatch.');
    session=await ort.InferenceSession.create(modelPath(),{executionProviders:['cpu'],intraOpNumThreads:Math.max(1,Math.min(4,Number(process.env.WALL_CPU_THREADS)||2)),interOpNumThreads:1,graphOptimizationLevel:'all'});
    await session.run({pixel_values:new ort.Tensor('float32',new Float32Array(3*512*512),[1,3,512,512])});
    state='ready';
  })().catch(error=>{state='error';pending=undefined;throw error;});
  return pending;
}

/** Semantic class 0 is wall. Abstain at ambiguous pixels instead of treating them as wall. */
export function wallMaskFromLogits(logits:Float32Array,width:number,height:number,classes:number):Uint8Array{
  const count=width*height;if(logits.length!==count*classes||classes<2)throw new Error('Unexpected model output.');
  const mask=new Uint8Array(count);
  for(let p=0;p<count;p++){
    const wall=logits[p];let strongest=-Infinity;
    for(let c=1;c<classes;c++)strongest=Math.max(strongest,logits[c*count+p]);
    if(wall>strongest+.25)mask[p]=1;
  }
  return mask;
}
export async function detectFastWall(image:string){
  const started=performance.now();
  try{await warmDetector();}catch{throw new ApiError(503,'LOCAL_MODEL_NOT_READY','The fast wall detector is not ready. Rebuild Docker or run npm run model:fetch, then restart the app.');}
  let pixels:Buffer;
  try{pixels=await sharp(Buffer.from(image.split(',')[1],'base64'),{limitInputPixels:16_000_000}).rotate().flatten({background:'#fff'}).toColourspace('srgb').removeAlpha().resize(512,512,{fit:'fill',kernel:'cubic'}).raw().toBuffer();}
  catch{throw new ApiError(400,'INVALID_PHOTO','This photo cannot be decoded. Choose a JPEG, PNG, or WebP room photo.');}
  const size=512*512, input=new Float32Array(size*3),mean=[.485,.456,.406],std=[.229,.224,.225];
  for(let p=0;p<size;p++)for(let c=0;c<3;c++)input[c*size+p]=(pixels[p*3+c]/255-mean[c])/std[c];
  const inferenceStart=performance.now();
  const output=await session!.run({pixel_values:new ort.Tensor('float32',input,[1,3,512,512])});
  const inferenceMs=performance.now()-inferenceStart;
  const tensor=output.logits;const [,classes,height,width]=tensor.dims;
  const mask=wallMaskFromLogits(tensor.data as Float32Array,width,height,classes);
  const candidates=wallCandidates(mask,width,height).map(candidate=>{const refined=refineWallWithLines(candidate.corners,pixels,512,512,3);return {...candidate,corners:refined.corners,lines:refined.lines,lineRefined:refined.refined};});
  const first=candidates[0];
  const rgba=Buffer.alloc(mask.length*4);
  for(let p=0;p<mask.length;p++)if(mask[p]){rgba[p*4]=90;rgba[p*4+1]=165;rgba[p*4+2]=110;rgba[p*4+3]=150;}
  const png=await sharp(rgba,{raw:{width,height,channels:4}}).png().toBuffer();
  return {
    corners:first?.corners||null,
    confidence:first&&first.areaFraction>.12&&first.maskCoverage>.7?'medium' as const:'low' as const,
    summary:first?'Suggested wall plane applied. Adjust its numbered corners, or redraw it if it covers the wrong surface.':'No clear wall region found. Mark four corners manually or try a clearer room photo.',
    warnings:['This outline is a semantic wall estimate, not a measured 3D plane. Adjacent walls and objects may need correction.','Use a measured reference for real-world scale.'],
    widthGuess:null,provider:'local-segmentation',
    lines:first?.lines||[],lineRefined:first?.lineRefined||false,
    candidates,wallMask:`data:image/png;base64,${png.toString('base64')}`,
    timingMs:Math.round(performance.now()-started),inferenceMs:Math.round(inferenceMs),
  };
}

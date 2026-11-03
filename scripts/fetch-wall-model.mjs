import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const fp32=process.argv.includes('--fp32');
const destination=path.resolve(fp32?'models/wall-segmentation.onnx':'models/wall-segmentation-int8.onnx');
const expected=fp32?'fea729ab6c5d338bc79ad3d986b073e6faa12c97255eafd78a1f7145326e534e':'44ac510412833bf5e3e8586e6b9cba247b94e4251894e054597ebbd02de47d3f';
const checksum=buffer=>createHash('sha256').update(buffer).digest('hex');
try{if(checksum(await readFile(destination))===expected){console.log('Wall model already verified.');process.exit(0);}}catch{}
const url=fp32?'https://huggingface.co/JElvis/upernet-convnext-tiny-ade-onnx/resolve/a8e2807c3479bc617b37d8ed53e68660b3fa1ebb/model.onnx':'https://raw.githubusercontent.com/Di77o/LIveACViewer/main/models/wall-segmentation-int8.onnx';
console.log(fp32?'Downloading verified FP32 conversion source (238 MB)…':'Downloading verified INT8 wall detector (61 MB)…');
const response=await fetch(url,{signal:AbortSignal.timeout(300_000)});
if(!response.ok)throw new Error(`Model download failed: ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());if(checksum(bytes)!==expected)throw new Error('Model checksum mismatch. Refusing to use artifact.');
await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination+'.download',bytes);await rename(destination+'.download',destination);console.log('Wall model SHA-256 verified.');

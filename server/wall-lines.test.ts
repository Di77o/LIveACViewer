import test from 'node:test';import assert from 'node:assert/strict';
import {refineWallWithLines} from './vision/wall-lines';
import {validateWallPlane,type WallPlane} from '../src/lib/wall-plane';
const w=240,h=180;
const near:WallPlane=[{x:.12,y:.18},{x:.88,y:.18},{x:.88,y:.83},{x:.12,y:.83}];
test('long seams refine nearby wall boundaries while central TV edges stay inside',()=>{const image=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let value=x>=24&&x<216&&y>=30&&y<150?180:60;if(x>75&&x<170&&y>65&&y<115)value=10;image[y*w+x]=value;}const result=refineWallWithLines(near,image,w,h,1);assert.ok(result.refined);assert.ok(result.lines.length>=3);assert.ok(validateWallPlane(result.corners));assert.ok(result.corners[0].y<near[0].y);assert.ok(result.corners[0].x<near[0].x);assert.ok(result.corners[1].x>.85);});
test('uniform walls do not invent edge guides',()=>{const result=refineWallWithLines(near,new Uint8Array(w*h).fill(128),w,h,1);assert.deepEqual(result.corners,near);assert.equal(result.refined,false);assert.equal(result.lines.length,0);});
test('strong interior furniture lines do not move unsupported wall borders',()=>{const image=new Uint8Array(w*h).fill(180);for(let y=65;y<115;y++)for(let x=75;x<170;x++)image[y*w+x]=0;const result=refineWallWithLines(near,image,w,h,1);assert.deepEqual(result.corners,near);assert.equal(result.lines.length,0);});

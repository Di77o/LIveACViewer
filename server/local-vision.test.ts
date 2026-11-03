import test from 'node:test';import assert from 'node:assert/strict';
import { wallMaskFromLogits } from './vision/fast-wall';
import { wallCandidates } from './vision/wall-regions';

test('segmentation selects class-zero wall pixels and abstains at uncertain boundaries',()=>{const logits=new Float32Array([3,1,1, 0,3,1.1, -1,0,0]);assert.deepEqual([...wallMaskFromLogits(logits,3,1,3)],[1,0,0]);assert.throws(()=>wallMaskFromLogits(logits,2,2,3));});
test('connected regions produce editable wall quads, not a full-photo fallback',()=>{const w=40,h=30,mask=new Uint8Array(w*h);for(let y=3;y<25;y++)for(let x=2;x<30;x++)mask[y*w+x]=1;const [region]=wallCandidates(mask,w,h);assert.ok(region);assert.deepEqual(region.corners,[{x:.05,y:.1},{x:.75,y:.1},{x:.75,y:25/30},{x:.05,y:25/30}]);assert.equal(region.maskCoverage,1);assert.deepEqual(wallCandidates(new Uint8Array(w*h),w,h),[]);});
test('separate wall regions remain distinct and small noise is ignored',()=>{const w=100,h=100,mask=new Uint8Array(w*h);for(let y=5;y<80;y++)for(let x=5;x<40;x++)mask[y*w+x]=1;for(let y=10;y<70;y++)for(let x=60;x<95;x++)mask[y*w+x]=1;mask[0]=1;const regions=wallCandidates(mask,w,h);assert.equal(regions.length,2);assert.ok(regions[0].corners.every(p=>p.x<=.4));assert.ok(regions[1].corners.every(p=>p.x>=.6));});
test('ambiguous triangular regions are not fabricated into rectangular walls',()=>{const w=50,h=50,mask=new Uint8Array(w*h);for(let y=0;y<40;y++)for(let x=0;x<y;x++)mask[y*w+x]=1;for(const result of wallCandidates(mask,w,h))assert.ok(result.maskCoverage>.5);});

import test from 'node:test';import assert from 'node:assert/strict';
import { widthFromReference } from './reference-scale';
import { proportionalUnit } from './proportional-unit';
import { mapFromWall, type WallPlane } from './wall-plane';
const plane:WallPlane=[{x:.1,y:.1},{x:.9,y:.18},{x:.8,y:.9},{x:.12,y:.85}];
test('a known wall segment rectifies perspective before estimating wall width',()=>{const a=mapFromWall(plane,{x:.2,y:.5}),b=mapFromWall(plane,{x:.5,y:.5});assert.equal(widthFromReference(plane,[a,b],90),300);});
test('reference rejects different wall heights and tiny or impossible spans',()=>{assert.throws(()=>widthFromReference(plane,[mapFromWall(plane,{x:.2,y:.2}),mapFromWall(plane,{x:.5,y:.6})],90));assert.throws(()=>widthFromReference(plane,[{x:.4,y:.4},{x:.401,y:.4}],90));});
test('proportional anchoring only translates rotates and uniformly scales unit artwork',()=>{const unit=proportionalUnit(plane,{x:.5,y:.5,width:.2},4/3);assert.ok(unit.width>0);assert.ok(Number.isFinite(unit.angle));assert.ok(!('height' in unit),'height comes from the unchanged manufacturer aspect ratio');});

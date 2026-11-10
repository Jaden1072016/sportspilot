import test from 'node:test';
import assert from 'node:assert/strict';
import {nbaGameStateModel,parseClock} from '../lib/model.mjs';
import {assessSingle,calculateIndependentParlay} from '../lib/value.mjs';
import {normalizeScoreboard,parseRecord} from '../lib/sports.mjs';
import {normalizeEvents,normalizeBBO} from '../lib/market.mjs';
const when='2026-11-09T20:00:00.000Z';
function game(h=90,a=85){return {league:'nba',status:'in',period:3,clock:'06:00',home:{score:h,record:{pct:0.65}},away:{score:a,record:{pct:0.45}}};}
test('independent NBA model returns probability between 0 and 1',()=>{
  const res=nbaGameStateModel(game());assert.ok(res.available);assert.ok(res.homeProbability>0.5);assert.equal(res.validated,false);assert.equal(res.calibrated,false);
});
test('model does not import odds',()=>{
  const first=nbaGameStateModel({...game(),marketPrice:0.10});
  const second=nbaGameStateModel({...game(),marketPrice:0.99});
  assert.equal(first.homeProbability,second.homeProbability);
});
test('missing records fail closed',()=>assert.equal(nbaGameStateModel({...game(),away:{score:85}}).available,false));
test('clock must be valid',()=>{assert.equal(parseClock('12:60'),null);assert.equal(parseClock('07:30'),7.5);});
test('quote/multiplier and gross EV math',()=>{
  const r=assessSingle({probability:.35,ask:.25,quoteTime:when,nowMs:Date.parse(when),feeFraction:.01});
  assert.equal(r.grossMultiplier,4); assert.ok(Math.abs(r.grossEV-0.4)<1e-10);assert.equal(r.eligible,false);
  assert.ok(r.blockers.includes('Model not historically validated and calibrated'));
});
test('never alert with stale quotes',()=>{
  const r=assessSingle({probability:.7,ask:.25,quoteTime:when,nowMs:Date.parse(when)+60000,feeFraction:0,modelValidated:true,linkVerified:true,marketOpen:true,availableDepthVerified:true});
  assert.equal(r.eligible,false);assert.ok(r.blockers.some(x=>x.includes('stale')));
});
test('missing fees fail closed',()=>{
  const r=assessSingle({probability:.7,ask:.25,quoteTime:when,nowMs:Date.parse(when),modelValidated:true,linkVerified:true,marketOpen:true,availableDepthVerified:true});
  assert.equal(r.eligible,false);assert.equal(r.netEV,null);
});
test('parlay independence warning and EV',()=>{
  const r=calculateIndependentParlay([{p:.9,multiplier:1.2},{p:.9,multiplier:1.2}]);
  assert.ok(Math.abs(r.jointP-.81)<1e-9);assert.equal(r.eligible,false);
});
test('ESPN normalize scoreboard robust and unbiased',()=>{
  const raw={events:[{id:'401000000',name:'A at B',date:when,status:{type:{state:'in',detail:'Q3'},period:3,displayClock:'06:00'},competitions:[{competitors:[{homeAway:'home',score:'90',team:{id:'1',displayName:'B',abbreviation:'B'},records:[{type:'total',summary:'15-5'}]},{homeAway:'away',score:'85',team:{id:'2',displayName:'A',abbreviation:'A'},records:[{type:'total',summary:'10-10'}]}]}]}]};
  const result=normalizeScoreboard(raw,'nba',when);assert.equal(result.games[0].home.score,90);assert.equal(result.games[0].home.record.pct,.75);assert.equal(result.games[0].status,'in');
  assert.equal(parseRecord([{type:'total',summary:'0-0'}]),null);
});
test('Polymarket event schema and book quote normalize',()=>{
  const event=normalizeEvents({events:[{id:'1',title:'Sample',markets:[{slug:'one-side',question:'Who?',active:true}]}]},'nba',when);
  assert.equal(event.events[0].markets[0].ask,null);
  const quote=normalizeBBO({marketData:{bestAsk:{value:'0.25',currency:'USD'},bestBid:{value:'0.24',currency:'USD'}}},'one-side',when);
  assert.equal(quote.bestAsk,.25);assert.equal(quote.valid,true);
});
test('schemas fail closed',()=>{
  assert.throws(()=>normalizeScoreboard({hi:true}));assert.throws(()=>normalizeEvents({random:123}));
});

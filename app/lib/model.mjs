import {clamp} from './utils.mjs';
// EXPERIMENTAL, UNCALIBRATED: illustrative research baseline, NOT a validated predictor.
// No market odds or Polymarket fields are allowed in this function.
function normalCdf(x) {
  const t=1/(1+0.2316419*Math.abs(x));
  const d=0.3989422804014327*Math.exp(-x*x/2);
  const poly=t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  const upper=1-d*poly;
  return x>=0?upper:1-upper;
}
export function parseClock(clock) {
  if(typeof clock!=='string') return null;
  const m=/^(\d{1,2}):(\d{2})$/.exec(clock);
  if(!m||+m[2]>=60) return null;
  return +m[1]+(+m[2])/60;
}
export function nbaGameStateModel(game){
  if(!game||game.league!=='nba') return {available:false,why:'NBA-only baseline'};
  if(game.status!=='in') return {available:false,why:'No live in-game state'};
  const period=game.period,clock=parseClock(game.clock);
  if(!Number.isInteger(period)||period<1||clock===null||clock<0) return {available:false,why:'Period or clock missing'};
  if(!Number.isFinite(game.home?.score)||!Number.isFinite(game.away?.score)) return {available:false,why:'Score missing'};
  if(!Number.isFinite(game.home?.record?.pct)||!Number.isFinite(game.away?.record?.pct)) return {available:false,why:'Both overall team records required'};
  const remainingMinutes=period<=4 ? (4-period)*12+Math.min(12,clock) : Math.min(5,clock);
  const possessionsPerMinute=100/48;
  const possessionsLeft=Math.max(0.1,remainingMinutes*possessionsPerMinute);
  const homeDiff=game.home.score-game.away.score;
  const recordStrength=game.home.record.pct-game.away.record.pct;
  const impliedExpectedDiff=homeDiff+(recordStrength*0.20*possessionsLeft);
  const sigma=1.85*Math.sqrt(possessionsLeft);
  const probability=clamp(normalCdf(impliedExpectedDiff/sigma),0.005,0.995);
  // Sensitivity band is NOT a statistical confidence interval.
  const scenarios=[0.75,1,1.35].flatMap(scale=>[-0.1,0,0.1].map(s=>normalCdf((homeDiff+(recordStrength+s)*0.20*possessionsLeft)/(sigma*scale))));
  return {available:true,modelId:'NBA-SCORECLOCK-BASELINE-v0.1',validated:false,calibrated:false,
    homeProbability:probability,awayProbability:1-probability,
    sensitivityLow:Math.min(...scenarios),sensitivityHigh:Math.max(...scenarios),
    inputs:{homeScore:game.home.score,awayScore:game.away.score,recordStrength,period,clock,possessionsLeft},
    rationale:[`Score differential ${homeDiff>0?'+':''}${homeDiff} for the home team`,`Est. ${possessionsLeft.toFixed(1)} possessions remaining`,`Team record difference ${(recordStrength*100).toFixed(1)} percentage points`],
    caveats:['Not trained or backtested; no automatic real-money recommendations','Does not use verified live lineups, player usage, injuries, or true team efficiency','Sensitivity range is not a confidence interval']};
}

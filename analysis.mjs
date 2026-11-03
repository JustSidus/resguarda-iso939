import {mkdirSync,writeFileSync} from 'node:fs';
import {compare,controls,sensitivity,probabilityThreshold,routeMetrics} from './src/model.js';
const plans=compare(),best=plans.toSorted((a,b)=>b.expected-a.expected)[0];
const result={createdAt:new Date().toISOString(),controls:controls(),selected:best.id,
  comparison:plans.map(x=>({id:x.id,name:x.name,config:x.config,expected:x.expected,worst:x.worst,scenarios:Object.fromEntries(Object.entries(x.runs).map(([s,r])=>[s,{...r.summary,peak:r.rows[7],events:r.events}]))})),
  sensitivity:sensitivity(best.config),probabilityThreshold:probabilityThreshold(best,plans.find(x=>x.id==='reequilibrio')),
  engineering:{six:routeMetrics(),eight:routeMetrics(8),automaticSix:routeMetrics(6,true),automaticEight:routeMetrics(8,true)}};
mkdirSync('qa',{recursive:true});writeFileSync('qa/results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({selected:result.selected,comparison:result.comparison.map(x=>({id:x.id,expected:x.expected,worst:x.worst,investment:x.scenarios.base.investment,scenarios:Object.fromEntries(Object.entries(x.scenarios).map(([s,r])=>[s,{npv:r.npv,service:r.service,lost:r.lost,peak:r.peak.sales,peakDemand:r.peak.demand,peakLost:r.peak.lost}]))})),threshold:result.probabilityThreshold,sensitivity:result.sensitivity.axes.map(x=>({label:x.label,low:x.lowValue,high:x.highValue}))},null,2));

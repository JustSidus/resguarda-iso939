import {CASE,DEFAULTS,SOURCE,STRATEGIES,SCENARIOS,LABELS,ASSUMPTIONS} from './data.js';
import {config,evaluate,compare,sensitivity,controls,CONTROL_TARGETS,routeMetrics,matureGood,probabilityThreshold,sum,dateForWeek} from './model.js';

const $=s=>document.querySelector(s);
const number=(x,d=0)=>Number.isFinite(x)?new Intl.NumberFormat('es-DO',{maximumFractionDigits:d,minimumFractionDigits:d}).format(x):'—';
const money=(x,d=0)=>`USD ${number(x,d)}`;
const compactMoney=x=>`USD ${number(x/1e6,2)} M`;
const percent=(x,d=1)=>`${number(x*100,d)}%`;
const esc=x=>String(x).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const dateText=x=>new Intl.DateTimeFormat('es-DO',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${x}T12:00:00Z`));
const form=$('#plan-form'),selectPreset=$('#preset'),settings=$('#control-panel');
const sharedKeys=['probabilities','proFirst','proSecond','cellPenalty','failStd','failPro','yield2','yield3','setup','wip'];
const state={tab:'plant',week:8,variant:'mix',scenario:'base',preset:'fases',cfg:config(STRATEGIES.find(x=>x.id==='fases').changes),evaluation:null,comparison:[],dirty:false,invalid:null,tableOpen:false,costOpen:false,plantDetailsOpen:false};
const shared=c=>Object.fromEntries(sharedKeys.map(k=>[k,c[k]]));
const field=k=>form.elements.namedItem(k);
const metric=(label,value,note='',cls='')=>`<div class="metric"><dt>${label}</dt><dd class="${cls}">${value}</dd><small>${note}</small></div>`;
const ledger=entries=>`<dl class="ledger">${entries.join('')}</dl>`;
const intro=(index,title,description,tag)=>`<div class="page-intro"><div><h1>${title}</h1><p>${description}</p></div>${tag?`<span class="period-tag">${tag}</span>`:''}</div>`;
const weekPicker=()=>`<div class="week-picker"><label for="week-range">Semana de análisis<span>${dateText(dateForWeek(state.week))}${state.week===8?' · Black Friday':state.week===33||state.week===34?' · Día de las Madres':''}</span></label><input id="week-range" type="range" min="1" max="52" step="1" value="${state.week}"><output for="week-range">S${state.week}</output></div>`;
const currentRun=()=>state.evaluation.runs[state.scenario];
const currentRow=()=>currentRun().rows[state.week-1];

selectPreset.innerHTML=STRATEGIES.map(s=>`<option value="${s.id}">${s.name[0]}. ${s.short}</option>`).join('')+'<option value="custom">Plan ajustado</option>';
function openSettings(){if(!settings.open)settings.showModal();}
function closeSettings(showResult=false){settings.close();if(showResult){$('#analysis').focus({preventScroll:true});$('#analysis').scrollIntoView({block:'start'});}}
function fillForm(c) {
  for(const k of Object.keys(DEFAULTS)) {
    const el=field(k);if(!el||k==='probabilities')continue;
    if(el.type==='checkbox')el.checked=Boolean(c[k]);
    else el.value=['proFirst','proSecond','cellPenalty','failStd','failPro','yield2','yield3'].includes(k)?Number((c[k]*100).toFixed(4)):c[k];
  }
  field('probBase').value=numberInput(c.probabilities.base*100);
  field('probOptimistic').value=numberInput(c.probabilities.optimista*100);
  field('probChannel').value=numberInput(c.probabilities.canal*100);
  selectPreset.value=state.preset;field('scenario').value=state.scenario;
  $('#preset-description').textContent=state.preset==='custom'?'Plan ajustado con los campos de este panel.':`${c.lines} líneas · ${c.operators} personas por línea · ${c.sequential?'turnos por fases':`${c.shifts} turno(s)`}`;
  syncApplicability();
}
function numberInput(n){return Number(n.toFixed(8));}
function syncApplicability() {
  const active={lineStart:Number(field('lines').value)===3,rebalanceStart:Number(field('operators').value)===8,
    shift2Start:Number(field('shifts').value)>=2,shift3Start:Number(field('shifts').value)>=3,
    cellStart:Number(field('cells').value)>0,cellWorkers:Number(field('cells').value)>0,cellPenalty:Number(field('cells').value)>0,
    automationStart:field('automation').checked,outsourceStart:field('outsource').checked};
  for(const [key,enabled] of Object.entries(active)){field(key).disabled=!enabled;$(`[data-for="${key}"]`).hidden=!enabled;}
  for(const row of form.querySelectorAll('.field-pair'))row.hidden=[...row.children].every(x=>x.hidden);
}
function syncPending() {
  $('#pending-notice').hidden=!state.dirty||Boolean(state.invalid);
  $('#download-csv').disabled=state.dirty||Boolean(state.invalid);
}
function readForm() {
  const c=config();
  for(const k of Object.keys(DEFAULTS)) {
    const el=field(k);if(!el||k==='probabilities')continue;
    if(el.disabled){c[k]=state.cfg[k];continue;}
    c[k]=el.type==='checkbox'?el.checked:el.value===''?NaN:Number(el.value);
    if(['proFirst','proSecond','cellPenalty','failStd','failPro','yield2','yield3'].includes(k))c[k]/=100;
  }
  const probability=k=>field(k).value===''?NaN:Number(field(k).value)/100;
  c.probabilities={base:probability('probBase'),optimista:probability('probOptimistic'),canal:probability('probChannel')};
  return c;
}
function errorFields(message) {
  if(message.includes('probabilidades'))return ['probBase','probOptimistic','probChannel'];
  if(message.includes('tercera línea'))return ['lineStart'];
  if(message.includes('reequilibrio'))return ['rebalanceStart'];
  if(message.includes('segundo turno'))return ['shift2Start'];
  if(message.includes('tercer turno'))return ['shift3Start','shift2Start'];
  if(message.includes('primeras células'))return ['cellStart'];
  if(message.includes('dispositivo entra'))return ['automationStart'];
  if(message.includes('subcontratación entra'))return ['outsourceStart'];
  if(message.includes('Subcontratación con dispositivo')||message.includes('subcontratación con dispositivo'))return ['outsource','automation'];
  if(message.includes('Cinco personas')||message.includes('Al subcontratar'))return ['operators','outsource'];
  if(message.includes('Inversión'))return Number(field('cells').value)>0?['cells','automation','lines','operators']:['automation','lines','operators'];
  if(message.includes('620 m²'))return ['cells','lines'];
  const key=message.split(':')[0];return field(key)?[key]:[];
}
const fieldLabel=key=>{
  const label=field(key)?.labels?.[0];
  return [...(label?.childNodes??[])].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).filter(Boolean).join(' ')||key;
};
function showErrors(errors) {
  for(const el of form.querySelectorAll('[aria-invalid]')){el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');}
  for(const el of form.querySelectorAll('.field-error'))el.remove();
  const box=$('#form-errors');box.hidden=!errors.length;
  box.innerHTML=errors.map((message,i)=>{
    const names=errorFields(message),primary=names[0];
    const friendly=message.replace(/^(\w+):/,key=>primary?`${fieldLabel(primary)}:`:key);
    if(primary){
      const id=`field-error-${i}`;
      const group=field(primary).closest('.probabilities')||field(primary).closest('.field-pair')||field(primary).closest('label');
      group.insertAdjacentHTML('afterend',`<span class="field-error" id="${id}">${esc(friendly)}</span>`);
      for(const key of names){field(key).setAttribute('aria-invalid','true');field(key).setAttribute('aria-describedby',id);}
    }
    return `<p>${esc(friendly)}${primary?` <a href="#${field(primary).id}" data-focus-field="${primary}">Revisar ${esc(fieldLabel(primary))}</a>`:''}</p>`;
  }).join('');
  if(errors.length){openSettings();box.focus();}
}
function calculate(c) {
  const result=evaluate(c);state.dirty=false;
  if(!result.valid){state.invalid=result.errors;state.dirty=true;render();showErrors(result.errors);$('#form-status').textContent='Plan sin calcular. Corrige los campos indicados.';return false;}
  state.invalid=null;showErrors([]);state.cfg=c;state.evaluation=result;state.comparison=compare(shared(c));
  $('#form-status').textContent='Plan calculado en los tres escenarios.';
  const presetConfig=config(STRATEGIES.find(x=>x.id===state.preset)?.changes);
  const decisionKeys=Object.keys(DEFAULTS).filter(k=>!sharedKeys.includes(k));
  if(state.preset!=='custom'&&decisionKeys.some(k=>c[k]!==presetConfig[k])){state.preset='custom';selectPreset.value='custom';}
  $('#preset-description').textContent=`${c.lines} líneas · ${c.operators} personas por línea · ${c.sequential?'turnos por fases':`${c.shifts} turno(s)`}`;
  render();return true;
}
function loadPreset(id,reset=false) {
  const s=STRATEGIES.find(x=>x.id===id);if(!s)return;
  const current=state.dirty?readForm():state.cfg;
  state.preset=id;const next=config({...s.changes,...(reset?{}:shared(current))});
  fillForm(next);calculate(next);
}
function renderPlant() {
  const row=currentRow(),c=state.cfg,one=row.resources.find(r=>r.type==='line');
  const ops=one?.operators??(c.outsource&&state.week>=c.outsourceStart?5:c.operators===8&&state.week>=c.rebalanceStart?8:6);
  const r=routeMetrics(ops,c.automation&&state.week>=c.automationStart,c.outsource&&state.week>=c.outsourceStart,row.mix,c.lot,c.setup);
  const fullCycle=state.variant==='std'?r.cycle[0]:state.variant==='pro'?r.cycle[1]:r.mixedCycle;
  const amounts=state.variant==='std'?r.std:state.variant==='pro'?r.pro:r.std.map((x,i)=>x*(1-row.mix)+r.pro[i]*row.mix);
  const critical=state.variant==='std'?r.bottleneck[0]:state.variant==='pro'?r.bottleneck[1]:`${r.bottleneck[0]}/${r.bottleneck[1]}`;
  const gap=row.capacityGood-row.demand;
  return intro('01 / Capacidad y flujo','Capacidad de la planta','Ciclos, ocupación y límites de las estaciones.',`${LABELS[state.scenario]} · S${state.week}`)+
    ledger([metric('Capacidad buena',number(row.capacityGood,1),'u disponibles esta semana','positive'),metric('Demanda',number(row.demand),'u solicitadas'),metric('Diferencia',`${gap>=0?'+':''}${number(gap)}`,'capacidad − demanda, sin stock',gap<0?'warning':''),metric('Entregas a tiempo',percent(row.service),'pedidos de esta semana')])+weekPicker()+
    `<div class="section-head"><div><h2>Estaciones y cuello de botella</h2><p>${ops} personas · ${number(row.mix*100)}% Pro · ${row.shifts} turno(s) programado(s)</p></div><div class="tabs" aria-label="Utilización por variante"><button type="button" data-variant="std" aria-pressed="${state.variant==='std'}">Estándar</button><button type="button" data-variant="pro" aria-pressed="${state.variant==='pro'}">Pro</button><button type="button" data-variant="mix" aria-pressed="${state.variant==='mix'}">Mezcla</button></div></div>`+
    `<div class="line-summary"><div><h3>Ciclo Estándar</h3><strong>${number(r.cycle[0],2)} min</strong><p>Cuello: ${r.bottleneck[0]}</p></div><div><h3>Ciclo Pro</h3><strong>${number(r.cycle[1],2)} min</strong><p>Cuello: ${r.bottleneck[1]}</p></div><div><h3>Ciclo de la mezcla</h3><strong>${number(r.mixedCycle,2)} min</strong><p>+ ${number(c.setup/c.lot,3)} min/u por cambios</p></div></div>`+
    `<table class="station-table"><thead><tr><th scope="col">Estación</th><th scope="col">Std, min</th><th scope="col">Pro, min</th><th scope="col">Ocupación ${state.variant==='std'?'Std':state.variant==='pro'?'Pro':'mezcla'}</th></tr></thead><tbody>${r.ids.map((id,i)=>{
      const utilization=amounts[i]/(state.variant==='mix'?r.effectiveCycle:fullCycle);
      return `<tr${critical.split('/').includes(id)?' class="bottleneck"':''}><th scope="row"><span class="station-id">${id}</span><span class="station-op">${r.names[i]}</span></th><td>${number(r.std[i],2)}</td><td>${number(r.pro[i],2)}</td><td><div class="bar-wrap"><span class="bar-track" aria-hidden="true"><span style="width:${utilization*100}%"></span></span><output>${percent(utilization,0)}</output></div></td></tr>`;
    }).join('')}</tbody></table><p class="table-note">Ocupación a capacidad madura. En la mezcla se incluyen cambios prorrateados; el cuello puede alternar entre variantes. Uso real de los recursos esta semana: <strong>${percent(row.stockUse)}</strong>. El color señala las estaciones que limitan alguna variante.</p>`+
    `<p class="plant-resources"><strong>${row.staff} personas</strong> · ${row.area} de ${row.areaAvailable} m² · Aprendizaje ${percent(row.learning)}</p><details class="plain-details" id="plant-calculations" ${state.plantDetailsOpen?'open':''}><summary>Cálculos y recursos de S${state.week}</summary><div class="facts"><div><p>Balance Estándar / Pro</p><strong>${percent(r.efficiency[0])} / ${percent(r.efficiency[1])}</strong></div><div><p>Takt por línea¹</p><strong>${number((row.shifts===3?2100:2250)*row.lines/row.demand,2)} min</strong></div><div><p>Contenido Std / Pro</p><strong>${number(r.content[0],2)} / ${number(r.content[1],2)} min</strong></div><div><p>WIP de referencia por línea²</p><strong>${number(c.wip)} u</strong></div><div><p>Flujo con ese WIP, ritmo maduro²</p><strong>${number(c.wip*r.effectiveCycle/60,2)} h</strong></div><div><p>Mano de obra / unidad buena</p><strong>${money(row.laborPerGood,2)}</strong></div></div>`+
    `<p class="table-note">¹ Primer turno; reparte toda la demanda entre las líneas, antes de la aportación de células. ² El dato observado es 46 u en la línea actual; mantenerlo en otra configuración es un supuesto editable, no una predicción de colas.</p>`+
    `<div class="insight"><p><strong>La propuesta de ocho personas no duplica la capacidad.</strong> Con el lote original de 100 y 30% Pro, el ciclo es 5,98 min y las dos líneas pasan de 537,0 a 728,2 u brutas por semana: +35,6%. El promedio de 5,0 min del informe no representa el cuello.</p></div>`+
    `<div class="two-notes"><div><h3>Efecto del dispositivo de puerta</h3><p>En seis estaciones, el ciclo Pro sigue en 8,60 min (E4). Con 30% Pro y lote 100, la capacidad aumenta 9,1%. En ocho estaciones, aumenta 1,5%.</p></div><div><h3>Personal y espacio de esta semana</h3><p>${row.staff} personas con el supervisor; ${row.hired} incorporaciones. Aprendizaje medio: ${percent(row.learning)}. Superficie ocupada: ${row.area} de ${row.areaAvailable} m².</p></div></div>`+
    `<details class="plain-details"><summary>Equipos que sí operan en S${state.week}</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>Equipo</th><th>Personas</th><th>Aprendizaje</th><th>Cap. bruta¹</th><th>Producción</th></tr></thead><tbody>${row.resources.map(x=>`<tr><th scope="row">${x.id}</th><td>${x.crew}</td><td>${percent(x.learning)}</td><td>${number(x.gross,1)}</td><td>${number(x.produced,1)}</td></tr>`).join('')}</tbody></table></div><p class="table-note">¹ Según la mezcla realmente programada (${percent(row.productionMix)} Pro); puede diferir de la mezcla de demanda por los pendientes y el inventario de cada variante.</p></details></details>`;
}
function productionChart(rows) {
  const chartWidth=Math.max(360,Math.min(1000,$('#results').clientWidth-34)),small=chartWidth<600;
  const W=chartWidth,H=small?265:325,left=small?43:49,right=small?12:18,top=25,bottom=38,max=Math.ceil(Math.max(...rows.map(r=>Math.max(r.demand,r.capacityGood)))/500)*500;
  const X=w=>left+(w-1)*(W-left-right)/51,Y=n=>H-bottom-n/max*(H-top-bottom);
  const line=k=>rows.map((r,i)=>`${i?'L':'M'}${X(r.week).toFixed(1)},${Y(r[k]).toFixed(1)}`).join(' ');
  return `<div class="chart-box"><div class="legend"><span><i class="demand"></i>Demanda</span><span><i class="capacity"></i>Capacidad buena</span><span><i class="production"></i>Producción buena</span><span><i class="selection"></i>Semana elegida</span></div><div class="chart-scroll" role="region" aria-label="Capacidad y demanda de las 52 semanas"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="chart-title chart-description"><title id="chart-title">Capacidad, demanda y producción buena por semana</title><desc id="chart-description">Las cifras exactas están en la tabla de las 52 semanas. La capacidad es disponible; la producción responde a pedidos, pendientes y colchón.</desc>${[0,.25,.5,.75,1].map(q=>`<line x1="${left}" y1="${Y(q*max)}" x2="${W-right}" y2="${Y(q*max)}" stroke="#d9ded7"/><text x="${left-8}" y="${Y(q*max)+4}" text-anchor="end">${number(q*max)}</text>`).join('')}<text x="${left}" y="14">u/semana</text>${(small?[1,13,26,39,52]:[1,8,13,26,33,39,52]).map(w=>`<text x="${X(w)}" y="${H-12}" text-anchor="middle">S${w}</text>`).join('')}<line x1="${X(state.week)}" y1="${top}" x2="${X(state.week)}" y2="${H-bottom}" stroke="#a58737" stroke-dasharray="4 4"/><path d="${line('demand')}" fill="none" stroke="#a34426" stroke-width="2.6"/><path d="${line('capacityGood')}" fill="none" stroke="#18625a" stroke-width="2.8"/><path d="${line('good')}" fill="none" stroke="#182f3a" stroke-width="2" stroke-dasharray="3 3"/>${rows.filter(r=>r.week===state.week).map(r=>`<circle cx="${X(r.week)}" cy="${Y(r.demand)}" r="4" fill="#a34426"/><circle cx="${X(r.week)}" cy="${Y(r.capacityGood)}" r="4" fill="#18625a"/>`).join('')}</svg></div></div>`;
}
function renderWeeks() {
  const run=currentRun(),r=currentRow(),s=run.summary;
  return intro('02 / Producción y servicio','Producción y demanda','Compara el año completo y elige una semana para ver entregas, inventario y costos.',LABELS[state.scenario])+
    ledger([metric('Pedidos entregados',number(s.sales),'de '+number(s.demand)+' solicitados'),metric('Servicio a tiempo',percent(s.service),'entregados en su semana de pedido','positive'),metric('Ventas perdidas',number(s.lost,1),'incluye vencimientos de pendientes','warning'),metric('VPN a 52 semanas',compactMoney(s.npv),'resultado de caja, inversión y residual')])+
    productionChart(run.rows)+`<p class="scroll-hint">El selector muestra el detalle de cada semana. La tabla completa está disponible abajo.</p>`+weekPicker()+
    `<div class="section-head"><div><h2>Qué ocurrió en S${r.week}</h2><p>${dateText(r.date)} · ${r.shifts} turno(s) · ${r.saturday?'con sábado':'sin sábado'} · ${r.staff} personas</p></div></div>`+
    `<div class="line-summary"><div><h3>Producto terminado</h3><strong>${number(r.inventory,1)} u</strong><p>Std ${number(r.inventorySKU[0],1)} · Pro ${number(r.inventorySKU[1],1)}</p></div><div><h3>Pedidos que esperan</h3><strong>${number(r.pending,1)} u</strong><p>Std ${number(r.pendingSKU[0],1)} · Pro ${number(r.pendingSKU[1],1)}</p></div><div><h3>Buenas producidas</h3><strong>${number(r.good,1)} u</strong><p>Retrabajadas ${number(r.reworked,1)} · desecho ${number(r.scrap,1)}</p></div></div>`+
    `<p class="week-cost">Costo de S${r.week}: <strong>${money(r.cost)}</strong> · Mano de obra por unidad buena: <strong>${money(r.laborPerGood,2)}</strong></p><details class="plain-details" id="week-costs" ${state.costOpen?'open':''}><summary>Costos y calidad de S${r.week}</summary><dl class="detail-list">${[
      ['Ventas / a tiempo / atrasadas',`${number(r.sales,1)} / ${number(r.onTime,1)} / ${number(r.late,1)} u`],['Ventas perdidas esta semana',`${number(r.lost,1)} u`],
      ['Capacidad bruta / buena',`${number(r.capacityGross,1)} / ${number(r.capacityGood,1)} u`],['Ingresos por ventas',money(r.revenue)],['Materiales de lo producido',money(r.materials)],['Mano de obra, con supervisor',money(r.labor)],
      ['Fijos, turnos y alquiler',money(r.fixed+r.rent)],['Formación de personal',money(r.hireCost)],['Garantía y costo de inventario',money(r.warranty+r.carry)],['Pendientes y pérdida de imagen',money(r.backlogCost+r.imageCost)],
      ['Puerta subcontratada',money(r.outsourceCost)],['Costo operativo total',money(r.cost)],['Contribución de ventas antes de MO',money(r.contribution)],['Flujo operativo de caja',money(r.operatingCash)],
      ['Inversión acumulada',money(r.investment)],['Retrabajo que queda en proceso',`${number(r.reworkPending,1)} u`],
    ].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></details>`+
    `<details class="plain-details" id="week-table" ${state.tableOpen?'open':''}><summary>Tabla de las 52 semanas</summary><p class="scroll-hint">Desplaza la tabla para ver todas las columnas. El CSV incluye los tres escenarios.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Resultados de las 52 semanas"><table class="data-table"><thead><tr><th scope="col">Semana</th><th scope="col">Demanda</th><th scope="col">Cap. buena</th><th scope="col">Producido</th><th scope="col">Entregado</th><th scope="col">A tiempo</th><th scope="col">Perdido</th><th scope="col">Pendiente</th><th scope="col">Stock</th><th scope="col">Costo, USD</th></tr></thead><tbody>${run.rows.map(x=>`<tr class="${x.week===state.week?'selected':''}"><th scope="row"><button type="button" class="text-button" data-week="${x.week}">S${x.week} · ${dateText(x.date)}</button></th><td>${number(x.demand)}</td><td>${number(x.capacityGood,1)}</td><td>${number(x.good,1)}</td><td>${number(x.sales,1)}</td><td>${percent(x.service)}</td><td>${number(x.lost,1)}</td><td>${number(x.pending,1)}</td><td>${number(x.inventory,1)}</td><td>${number(x.cost)}</td></tr>`).join('')}</tbody></table></div></details>`+
    `<p class="source-note">Conciliación anual: ${number(s.demand,1)} pedidos = ${number(s.sales,1)} entregados + ${number(s.lost,1)} perdidos + ${number(s.endingPending,1)} pendientes al cierre. Inventario final: ${number(s.endingStock,1)} u.</p><p class="source-note">Costo de oportunidad de las ventas perdidas (margen + USD 10): ${money(s.lostOpportunity)}. En caja solo se deducen los USD 10 de imagen; el margen de pedidos no vendidos ya está ausente y no se vuelve a restar.</p>`;
}
function renderStrategies() {
  const evaluation=state.evaluation,list=[...state.comparison];
  if(state.preset==='custom')list.push({id:'custom',name:'Tu plan de trabajo',description:'Configuración del panel.',...evaluation});
  const best=list.toSorted((a,b)=>b.expected-a.expected)[0],worst=SCENARIOS.reduce((a,b)=>evaluation.runs[a].summary.npv<evaluation.runs[b].summary.npv?a:b);
  return intro('03 / Decisiones de capacidad','Comparación de estrategias','Compara inversión, valor esperado y peor resultado en los tres escenarios.',SCENARIOS.map(s=>percent(state.cfg.probabilities[s],0)).join(' / '))+
    ledger([metric('Valor esperado del plan',compactMoney(evaluation.expected),'VPN ponderado de tres escenarios','positive'),metric('Peor resultado del plan',compactMoney(evaluation.worst),LABELS[worst]),metric('Inversión en equipos',money(evaluation.runs.base.summary.investment),'límite sin aprobación: USD 120.000'),metric('Mejor política comparada',best.short??'Tu plan',compactMoney(best.expected)+' de valor esperado')])+
    `<div class="section-head"><div><h2>Comparación de políticas</h2><p>VPN en USD. Desliza la tabla para consultar todos los escenarios.</p></div></div><div class="table-scroll" tabindex="0" role="region" aria-label="Comparación de estrategias en los tres escenarios"><table class="data-table strategy-table"><thead><tr><th>Política</th><th>Valor esperado</th><th>Base</th><th>Optimista</th><th>Canal</th><th>Peor VPN</th><th>Inversión</th></tr></thead><tbody>${list.map(x=>`<tr class="${x.id===state.preset?'selected':''}"><th scope="row">${x.name}${x.id===best.id?'<span class="tag">Mayor valor esperado comparado</span>':''}<p>${x.config.lines} líneas · ${x.config.operators} personas · ${x.config.shifts} turnos máx.<br>Lote ${x.config.lot} · colchón ${x.config.buffer}</p>${x.id!=='custom'?`<button type="button" data-preset="${x.id}">${x.id===state.preset?'Plan en pantalla':'Usar este plan'}</button>`:''}</th><td class="${x.id===best.id?'best':''}">${number(x.expected)}</td>${SCENARIOS.map(s=>`<td>${number(x.runs[s].summary.npv)}</td>`).join('')}<td>${number(x.worst)}</td><td>${number(x.runs.base.summary.investment)}</td></tr>`).join('')}</tbody></table></div>`+
    `<p class="scroll-hint">Desplaza la matriz para ver todos los escenarios. Las hipótesis de demanda, calidad, cambios y rendimientos del panel se comparten; cada política conserva sus decisiones de lotes, colchón y equipos.</p>`+
    `<div class="insight"><p><strong>${best.name}</strong> ofrece el mayor valor esperado entre las políticas mostradas. La planta actual queda como referencia. La tercera línea necesita ocho semanas: una orden en S0 llega en S9, después del Black Friday de S8.</p></div>`+
    `<h2>El plan en cada escenario</h2><div class="table-scroll" style="margin-top:12px"><table class="data-table"><thead><tr><th>Escenario</th><th>Prob.</th><th>Servicio a tiempo</th><th>Entregados</th><th>Perdidos</th><th>S8, entregas / pedidos</th></tr></thead><tbody>${SCENARIOS.map(s=>{const run=evaluation.runs[s],t=run.summary,r=run.rows[7];return `<tr><th scope="row">${LABELS[s]}</th><td>${percent(evaluation.config.probabilities[s],0)}</td><td>${percent(t.service,2)}</td><td>${number(t.sales,1)}</td><td>${number(t.lost,1)}</td><td>${number(r.onTime,1)} / ${number(r.demand)}</td></tr>`;}).join('')}</tbody></table></div>`+
    `<details class="plain-details"><summary>Regla de turnos y costos</summary><div class="two-notes"><div><h3>Regla por fases</h3><p>Desde S13, cada cuatro semanas se usa el promedio de pedidos de las cuatro anteriores. Un turno si cabe en 95% de su capacidad madura; dos si cabe en 95% de dos turnos; tres en otro caso. Las ampliaciones de turno llevan dos semanas de solicitud y aprendizaje nuevo.</p></div><div><h3>Qué se paga aunque no se produzca</h3><p>Las nóminas de los turnos abiertos y los costos fijos. Las inversiones se pagan al ordenar. Se recupera 80% del equipo al cierre, descontado. El supuesto de personal temporal permite reducir turnos; habría que confirmar el costo de salida antes de una decisión real.</p></div></div></details>`+
    `<details class="plain-details"><summary>Puntos de decisión aplicados · ${LABELS[state.scenario]}</summary>${currentRun().events.length?`<ol class="events">${currentRun().events.map(e=>`<li><strong>S${e.week}:</strong> ${e.text}</li>`).join('')}</ol>`:'<p class="empty">Este plan mantiene los turnos programados; no tiene revisión secuencial activada.</p>'}</details>`;
}
function renderSensitivity() {
  const result=sensitivity(state.cfg),scale=Math.max(1,...result.axes.flatMap(a=>[Math.abs(a.lowValue-result.central),Math.abs(a.highValue-result.central)]));
  const r=currentRow(),cap1=matureGood(state.cfg,state.week,r.lines,r.cells,1),cap2=matureGood(state.cfg,state.week,r.lines,r.cells,2);
  const phase=state.comparison.find(x=>x.id==='fases'),fixed=state.comparison.find(x=>x.id==='reequilibrio');
  const threshold=probabilityThreshold(phase,fixed);
  const bar=(v,high=false)=>{const delta=v-result.central,width=Math.abs(delta)/scale*49,left=delta>=0?50:50-width;return `<span class="${high?'high':''}" style="left:${left}%;width:${width}%"></span>`;};
  const zero=evaluate({...state.cfg,buffer:0}),central=evaluate(state.cfg),zeroPeak=zero.runs.optimista.rows[7];
  return intro('04 / Sensibilidad y umbrales','Sensibilidad del plan','Recalcula una variable a la vez para ver su efecto sobre el valor esperado.','VPN esperado · USD')+
    ledger([metric('Valor esperado central',compactMoney(result.central),'con las probabilidades del panel','positive'),metric('Umbral de un turno',number(cap1*.95),'pedidos/semana observados, a 95%'),metric('Umbral de dos turnos',number(cap2*.95),'pedidos/semana observados, a 95%'),metric('Inversión disponible',money(120000-central.runs.base.summary.investment),'antes de requerir aprobación')])+
    `<div class="section-head"><div><h2>Desviación del valor esperado</h2><p>Menor valor hacia la izquierda, mayor hacia la derecha. Verde: extremo inferior del parámetro; óxido: extremo superior.</p></div></div>`+
    `<div class="tornado-list">${result.axes.filter(a=>state.cfg.cells>0||!Object.hasOwn(a.a,'cellPenalty')).map(a=>`<div class="tornado"><div class="tornado-title">${a.label}<small>${a.low} → ${a.high}</small></div><div class="tornado-bar" aria-hidden="true">${bar(a.lowValue)}${bar(a.highValue,true)}</div><div class="tornado-values"><span>${a.lowValue>=result.central?'+':''}${number(a.lowValue-result.central)}</span><span>${a.highValue>=result.central?'+':''}${number(a.highValue-result.central)}</span></div></div>`).join('')}</div>`+
    `<p class="table-note">Rangos de lotes, mezcla y polivalencia: guía del caso. Fallas y rendimientos: pruebas alrededor del dato del anexo, no nuevos hechos. Con células, también se evalúa la polivalencia.</p>`+
    `<details class="plain-details"><summary>Cómo se aplican los umbrales y las probabilidades</summary><div class="thresholds"><div class="threshold"><h3>Pedidos observados antes de abrir otro turno</h3><p>Con los equipos de S${state.week}, la regla por fases utiliza <strong>${number(cap1*.95)} u</strong> para pasar de uno a dos turnos y <strong>${number(cap2*.95)} u</strong> para pasar de dos a tres. Se contrasta el promedio de cuatro semanas; no se identifica de antemano qué escenario ocurrirá.</p><p>Son umbrales operativos propuestos con una reserva de 5%; no son puntos de equilibrio de rentabilidad.</p></div><div class="threshold"><h3>Probabilidad de llenado de canal</h3><p>${threshold===null?'Con los supuestos actuales, las políticas F y C no cruzan sus valores esperados entre 0% y 100% de canal, manteniendo la proporción base:optimista en 2:1. Compara sus resultados por escenario en la matriz.':`F y C igualan su valor esperado con ${percent(threshold)} de probabilidad de canal, manteniendo base:optimista en 2:1. Revisa cuál queda por encima en la matriz antes de elegir.`}</p></div></div></details>`+
    `<div class="insight"><p><strong>El colchón tiene un costo y una función.</strong> Con cero unidades de colchón, el valor esperado sería ${money(zero.expected)} (${zero.expected>=central.expected?'+':''}${money(zero.expected-central.expected)} frente al plan). En S8 optimista se atenderían a tiempo ${number(zeroPeak.onTime,1)} de ${number(zeroPeak.demand)} pedidos. El plan actual atiende ${number(central.runs.optimista.rows[7].onTime,1)}.</p></div>`+
    `<p class="source-note">Una mayor mezcla Pro puede mejorar el margen aun cuando reduzca el ritmo. La recomendación depende de precios, demanda, costos de personal y disponibilidad real. Este análisis conserva los demás parámetros y la política de revisión del plan.</p>`;
}
function renderMethod() {
  const actual=controls();
  $('#method-content').innerHTML=`<h2>Valores de control del profesor</h2><p>Configuración actual: dos líneas, seis personas por línea, un turno, lote 100, cambio 20 minutos y 30% Pro. Es independiente del plan que estés editando.</p><div class="table-scroll"><table class="data-table"><thead><tr><th>Indicador</th><th>Caso</th><th>Modelo</th><th>Verificación</th></tr></thead><tbody>${CONTROL_TARGETS.map(([key,label,target,places,unit])=>`<tr><th scope="row">${label}</th><td>${number(target,places)} ${unit}</td><td>${number(actual[key],places)} ${unit}</td><td>${Number(actual[key].toFixed(places))===target?'Coincide':'Revisar'}</td></tr>`).join('')}</tbody></table></div><h2>Fórmulas trazables</h2><p class="formula">T = horas productivas × 60 × 5 × rendimiento × aprendizaje<br>Ciclo por variante = máximo de sus estaciones<br>Ciclo mezcla = (1 − Pro) × ciclo Std + Pro × ciclo Pro<br>Capacidad línea = T / (ciclo mezcla + cambio / lote)<br>Buenas = primera pasada + retrabajo recuperado, limitado por minutos<br>Balance = contenido / (estaciones × ciclo)<br>Flujo = WIP / ritmo de producción<br>VE = Σ probabilidad × VPN<br>i semanal = (1,12)^(1/52) − 1<br>VPN = Σ (caja operativa − inversión) / (1 + i)^semana + residual descontado</p><p>En células, la capacidad del conjunto de trabajadores es T / [contenido × (1 + polivalencia) / trabajadores efectivos + 5 / lote]. Los trabajadores efectivos incorporan la curva de aprendizaje. El cálculo de empaque usa 5 + 4/6 minutos.</p><h2>Supuestos adicionales</h2><ol>${ASSUMPTIONS.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p>La plantilla original se conserva remunerada; al subcontratar, los operadores originales liberados quedan disponibles, sin ahorro salarial por despido. No se activa la rotación opcional del 2% mensual. Los lotes no se redondean a unidades completas. Los resultados decimales expresan valores esperados.</p><h2>Fuente y uso de IA</h2><p>${SOURCE.author}. (s. f.). <em>${SOURCE.title}</em> [Caso docente, anexos 1 a 11 y guía del tablero]. UNAPEC, ISO939. <a href="${SOURCE.url}" target="_blank" rel="noreferrer">Documento en Canvas</a>.</p><p>El caso permite herramientas de IA o de BI. Se utilizó ChatGPT para programar el simulador, contrastar fórmulas y redactar los documentos. Los datos proceden del caso; las decisiones y los supuestos se identifican para revisión. </p>`;
}
function render() {
  const views={plant:renderPlant,weeks:renderWeeks,strategies:renderStrategies,sensitivity:renderSensitivity};
  if($('#week-table'))state.tableOpen=$('#week-table').open;
  if($('#week-costs'))state.costOpen=$('#week-costs').open;
  if($('#plant-calculations'))state.plantDetailsOpen=$('#plant-calculations').open;
  syncPending();
  $('#results').innerHTML=state.invalid?intro('Configuración pendiente','Revisa la configuración','Corrige los campos señalados en Configurar plan y vuelve a calcular.')+`<div class="errors">${state.invalid.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:views[state.tab]();
  $('#plan-label').textContent=`${STRATEGIES.find(s=>s.id===state.preset)?.name??'Plan de trabajo'} · ${LABELS[state.scenario]}`;
  for(const button of document.querySelectorAll('[data-view]')){if(button.dataset.view===state.tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
}
function exportCsv() {
  if(state.dirty){$('#form-status').textContent='Calcula los cambios antes de descargar.';$('#form-status').scrollIntoView({block:'nearest'});return;}
  const scalarKeys=['week','date','demand','mix','productionMix','lines','cells','shifts','saturday','capacityGross','capacityGood','gross','good','scrap','reworked','reworkPending','sales','onTime','late','lost','pending','inventory','service','staff','hired','released','learning','labor','laborPerGood','revenue','materials','outsourceCost','carry','backlogCost','imageCost','warranty','rent','fixed','hireCost','leaseLiability','cost','operatingCash','capex','investment','cumulativeNpv','area','areaAvailable','contribution','outsourcedUnits'];
  const titles=['escenario','semana','fecha','demanda_u','pro_demanda','pro_produccion','lineas','celulas','turnos','sabado','capacidad_bruta_u','capacidad_buena_u','produccion_bruta_u','produccion_buena_u','desecho_u','retrabajo_u','retrabajo_pendiente_u','entregado_u','a_tiempo_u','atrasado_u','perdido_u','pendiente_u','inventario_u','servicio_a_tiempo','personal_incl_supervisor','contrataciones','salidas','aprendizaje','mano_obra_USD','MO_por_buena_USD','ingresos_USD','materiales_USD','puerta_externa_USD','inventario_costo_USD','pendientes_costo_USD','imagen_USD','garantia_USD','alquiler_USD','fijos_USD','formacion_USD','obligacion_alquiler_USD','costo_total_USD','caja_operativa_USD','inversion_semana_USD','inversion_acumulada_USD','VPN_acumulado_sin_residual_USD','area_m2','area_disponible_m2','contribucion_antes_MO_USD','puertas_externas_u','stock_Std','stock_Pro','pendiente_Std','pendiente_Pro'];
  const rows=SCENARIOS.flatMap(s=>state.evaluation.runs[s].rows.map(r=>[LABELS[s],...scalarKeys.map(k=>r[k]),...r.inventorySKU,...r.pendingSKU]));
  const quote=x=>`"${String(typeof x==='number'?Number(x.toFixed(6)):x??'').replace(/"/g,'""')}"`;
  const text='\uFEFF'+[titles,...rows].map(row=>row.map(quote).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='Resguarda_52_semanas_3_escenarios.csv';link.click();URL.revokeObjectURL(url);
  $('#form-status').textContent='Se preparó el CSV de los tres escenarios (156 filas).';
}
form.addEventListener('submit',event=>{event.preventDefault();state.scenario=field('scenario').value;if(calculate(readForm()))closeSettings(true);});
form.addEventListener('input',event=>{if(event.target.name==='preset'||event.target.name==='scenario')return;state.dirty=true;syncApplicability();syncPending();$('#form-status').textContent='Hay cambios pendientes. Pulsa Calcular plan para ver su efecto.';});
selectPreset.addEventListener('change',()=>{if(selectPreset.value!=='custom')loadPreset(selectPreset.value);});
$('#scenario').addEventListener('change',event=>{state.scenario=event.target.value;render();});
$('#reset-plan').addEventListener('click',()=>loadPreset(state.preset==='custom'?'fases':state.preset,true));
$('#download-csv').addEventListener('click',exportCsv);
$('#open-settings').addEventListener('click',openSettings);
$('#close-settings').addEventListener('click',()=>closeSettings());
document.addEventListener('click',event=>{
  const correction=event.target.closest('[data-focus-field]');if(correction){event.preventDefault();const input=field(correction.dataset.focusField);const panel=input.closest('.more-controls');if(panel)panel.open=true;input.focus();return;}
  const view=event.target.closest('[data-view]');if(view){state.tab=view.dataset.view;render();return;}
  const variant=event.target.closest('[data-variant]');if(variant){state.variant=variant.dataset.variant;render();return;}
  const preset=event.target.closest('[data-preset]');if(preset){loadPreset(preset.dataset.preset);return;}
  const week=event.target.closest('[data-week]');if(week){state.week=Number(week.dataset.week);render();$('#week-range')?.focus();}
});
document.addEventListener('input',event=>{if(event.target.id==='week-range'){$('output[for="week-range"]').textContent=`S${event.target.value}`;}});
document.addEventListener('change',event=>{if(event.target.id==='week-range'){state.week=Number(event.target.value);const focus=event.target===document.activeElement;render();if(focus)$('#week-range')?.focus();}});
for(const input of form.querySelectorAll('input,select'))if(!input.id)input.id=input.name;
let chartResizeTimer;
window.addEventListener('resize',()=>{clearTimeout(chartResizeTimer);chartResizeTimer=setTimeout(()=>{if(state.tab==='weeks')render();},150);});
fillForm(state.cfg);renderMethod();calculate(state.cfg);

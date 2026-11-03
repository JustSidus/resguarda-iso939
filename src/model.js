import {CASE as C, DEMAND, DEFAULTS, ROUTES, SCENARIOS, STRATEGIES} from './data.js';

export const sum = a=>a.reduce((s,x)=>s+x,0);
const avg = a=>a.length ? sum(a)/a.length : 0;
const EPS=1e-7;
export const weeklyDiscount=(1+C.discountAnnual)**(1/52)-1;
export const discount=(value,week)=>value/(1+weeklyDiscount)**week;
export function config(changes={}) {return {...DEFAULTS,...changes,probabilities:{...DEFAULTS.probabilities,...changes.probabilities}};}
export function dateForWeek(w,offset=0) {
  const d=new Date(`${C.start}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+7*(w-1)+offset); return d.toISOString().slice(0,10);
}
export function mixForWeek(c,w) {return w<=26 ? c.proFirst : c.proSecond;}
export function routeMetrics(operators=6,automated=false,outsourced=false,p=.3,lot=100,setup=20) {
  const r=ROUTES[operators===8?'eight':'six'];
  let ids=[...r.ids],names=[...r.names],std=[...r.std],pro=[...r.pro];
  if(automated) {if(operators===8){std[2]=pro[2]=5.2;std[4]=pro[4]=3.3;}else{std[1]=pro[1]=5.6;std[2]=pro[2]=6;}}
  if(outsourced) {std[2]=pro[2]=7.2;[ids,names,std,pro]=[ids,names,std,pro].map(a=>a.filter((_,i)=>i!==1));}
  const content=[sum(std),sum(pro)], cycle=[Math.max(...std),Math.max(...pro)];
  const bottleneck=[ids.filter((_,i)=>Math.abs(std[i]-cycle[0])<EPS).join('/'),ids.filter((_,i)=>Math.abs(pro[i]-cycle[1])<EPS).join('/')];
  const mixedCycle=(1-p)*cycle[0]+p*cycle[1];
  return {ids,names,std,pro,content,cycle,bottleneck,mixedCycle,effectiveCycle:mixedCycle+setup/lot,
    efficiency:content.map((x,i)=>x/(ids.length*cycle[i])),
    gross:2250/(mixedCycle+setup/lot),flowHours:46*(mixedCycle+setup/lot)/60,
    stationMix:std.map((x,i)=>((1-p)*x+p*pro[i])/(mixedCycle+setup/lot))};
}
export function controls() {
  const r=routeMetrics(),gross=2*r.gross,fail=.7*.04+.3*.06,good=gross*(1-fail*.2);
  const labor=((10*6.5+2*7.5+2*7.5)*40)*1.3+1050;
  return {contentStd:r.content[0],contentPro:r.content[1],cycleStd:r.cycle[0],cyclePro:r.cycle[1],
    balanceStd:r.efficiency[0]*100,balancePro:r.efficiency[1]*100,mixedCycle:r.mixedCycle,
    grossLine:r.gross,grossPlant:gross,good,rework:gross*fail*.8,
    flowHours:r.flowHours,taktWeek8:2250/(1900/2),labor,laborPerGood:labor/good,
    margin:.7*71+.3*95,grossTwoShifts:gross*1.92};
}
export const CONTROL_TARGETS=[
  ['contentStd','Contenido Estándar',39.87,2,'min'],['contentPro','Contenido Pro',42.47,2,'min'],
  ['cycleStd','Ciclo Estándar · E3',8,2,'min'],['cyclePro','Ciclo Pro · E4',8.6,2,'min'],
  ['balanceStd','Balance Estándar',83.1,1,'%'],['balancePro','Balance Pro',82.3,1,'%'],
  ['mixedCycle','Ciclo de la mezcla',8.18,2,'min'],['grossLine','Capacidad bruta por línea',268.5,1,'u/sem'],
  ['grossPlant','Capacidad bruta de planta',537,1,'u/sem'],['good','Unidades buenas',532.1,1,'u/sem'],
  ['rework','Retrabajo',19.8,1,'u/sem'],['flowHours','Flujo por Little',6.42,2,'h'],
  ['taktWeek8','Takt S8 base, por línea',2.37,2,'min'],['labor','Mano de obra semanal',5990,0,'USD'],
  ['laborPerGood','Mano de obra por buena',11.26,2,'USD/u'],['margin','Contribución antes de MO',78.2,2,'USD/u'],
  ['grossTwoShifts','Dos turnos sin aprendizaje',1031,1,'u/sem'],
];
export function validate(c) {
  const errors=[];
  const range=(key,min,max,int=false)=>{if(!Number.isFinite(c[key])||c[key]<min||c[key]>max||(int&&!Number.isInteger(c[key])))errors.push(`${key}: usa un valor entre ${min} y ${max}${int?', entero':''}.`);};
  range('lines',2,3,true);range('shifts',1,3,true);range('saturdays',0,3,true);range('cells',0,10,true);range('cellWorkers',1,3,true);
  for(const k of ['lineStart','rebalanceStart','shift2Start','shift3Start','cellStart','automationStart','outsourceStart'])range(k,1,52,true);
  range('lot',25,400,true);range('setup',5,40);range('proFirst',.2,.5);range('proSecond',.2,.5);range('cellPenalty',0,.2);
  range('failStd',0,.15);range('failPro',0,.15);range('yield2',.5,1);range('yield3',.5,1);range('buffer',0,1500);range('wip',1,300);
  if(![5,6,8].includes(c.operators))errors.push('Selecciona 6, 8 o 5 personas por línea.');
  if(c.operators===5&&!c.outsource)errors.push('Cinco personas requieren subcontratar la puerta. Activa esa opción.');
  if(c.outsource&&c.operators!==5)errors.push('Al subcontratar, selecciona cinco personas por línea.');
  if(c.outsource&&c.automation)errors.push('El caso no define subcontratación con dispositivo. Elige una opción.');
  if(c.lines===3&&c.lineStart<9)errors.push('La tercera línea entra como mínimo en S9 (ocho semanas de plazo desde S0).');
  if(c.operators===8&&c.rebalanceStart<4)errors.push('El reequilibrio entra como mínimo en S4 (tres semanas desde S0).');
  if(c.shifts>=2&&c.shift2Start<3)errors.push('El segundo turno entra como mínimo en S3 (dos semanas de contratación).');
  if(c.shifts>=3&&(c.shift3Start<3||c.shift3Start<c.shift2Start))errors.push('El tercer turno debe comenzar desde S3, después del segundo o en la misma semana.');
  if(c.cells>0&&c.cellStart<6)errors.push('Las primeras células entran como mínimo en S6 (cinco semanas de plazo).');
  if(c.automation&&c.automationStart<11)errors.push('El dispositivo entra como mínimo en S11 (diez semanas de plazo).');
  if(c.outsource&&c.outsourceStart<5)errors.push('La subcontratación entra como mínimo en S5 (cuatro semanas de plazo).');
  if(SCENARIOS.some(k=>!Number.isFinite(c.probabilities[k])||c.probabilities[k]<0||c.probabilities[k]>1)||Math.abs(sum(SCENARIOS.map(k=>c.probabilities[k]))-1)>1e-8)errors.push('Las probabilidades deben sumar 100%, con cada valor entre 0 y 100%.');
  const investment=(c.lines-2)*48000+(c.operators===8?c.lines*9000:0)+c.cells*15000+(c.automation?c.lines*22000:0);
  if(investment>C.investmentLimit)errors.push(`Inversión de USD ${investment.toLocaleString('en-US')}: supera USD 120,000 y requiere aprobación del consejo.`);
  if(c.lines*120+c.cells*40>620)errors.push('La configuración supera 620 m² aun con la ampliación. Reduce líneas o células.');
  return {errors,investment};
}
function assets(c) {
  const list=[{id:'L1',type:'line',start:1,original:true},{id:'L2',type:'line',start:1,original:true}],orders=[];
  const add=(week,cost,label)=>orders.push({week:Math.max(0,week),cost,label});
  if(c.lines===3) {list.push({id:'L3',type:'line',start:c.lineStart});add(c.lineStart-9,48000,'Tercera línea');}
  if(c.operators===8) {add(c.rebalanceStart-4,18000,'Reequilibrio de dos líneas');if(c.lines===3)add(Math.max(c.lineStart,c.rebalanceStart)-4,9000,'Reequilibrio de tercera línea');}
  for(let i=0;i<c.cells;i++) {const start=c.cellStart+Math.floor(i/4);list.push({id:`C${i+1}`,type:'cell',start});add(start-6,15000,`Célula ${i+1}`);}
  if(c.automation) {add(c.automationStart-11,44000,'Dispositivo de dos líneas');if(c.lines===3)add(Math.max(c.lineStart,c.automationStart)-11,22000,'Dispositivo de tercera línea');}
  let leaseStart=null;
  const pending=list.filter(x=>!x.original).sort((a,b)=>a.start-b.start||(a.type==='line'?-1:1));
  let occupied=240;
  for(let w=1;w<=52;w++)for(const item of pending.filter(x=>x.actualStart===undefined&&x.start<=w)) {
    const a=item.type==='line'?120:40;
    if(occupied+a>420&&w>=11&&leaseStart===null)leaseStart=w;
    if(occupied+a<=420+(leaseStart!==null?200:0)) {item.actualStart=w;occupied+=a;}
  }
  const scheduled=list.map(x=>({...x,start:x.original?1:(x.actualStart??53)}));
  const deliveredLines=scheduled.filter(x=>x.type==='line'&&x.start<=52).length;
  const deliveredCells=scheduled.filter(x=>x.type==='cell'&&x.start<=52).length;
  const residualBasis=(deliveredLines-2)*48000+deliveredCells*15000+
    (c.operators===8?deliveredLines*9000:0)+(c.automation?deliveredLines*22000:0);
  return {list:scheduled,orders,leaseStart,residualBasis};
}
function freshRoster() {
  const r=[];
  for(const [role,n] of [['operator',10],['test',2],['handler',1],['rework',1]])for(let i=0;i<n;i++)r.push({role,shift:1,hireWeek:0,original:true});
  return r;
}
const learning=(worker,w)=>worker.original?1:C.learning[Math.min(4,Math.max(0,w-worker.hireWeek))];
function staffRequired(lines,cells,c,w,shifts) {
  const outsourced=c.outsource&&w>=c.outsourceStart;
  const ops=outsourced?4:c.operators===8&&w>=c.rebalanceStart?7:5;
  const handlers=Math.ceil(lines/3+cells/6-1e-9);
  return Array.from({length:shifts},(_,s)=>({operator:lines*ops,test:lines,cell:cells*c.cellWorkers,
    handler:Math.max(0,handlers-(s>0?1:0)),leader:s>0?1:0,rework:1}));
}
function updateRoster(roster,needs,w) {
  const keep=[];
  for(let s=1;s<=3;s++)for(const role of Object.keys(C.wages)) {
    const current=roster.filter(x=>x.shift===s&&x.role===role).sort((a,b)=>a.hireWeek-b.hireWeek);
    const original=current.filter(x=>x.original).length;
    keep.push(...current.slice(0,Math.max(original,needs[s-1]?.[role]??0)));
  }
  let hired=0;
  for(let s=1;s<=needs.length;s++)for(const role of ['leader','handler','rework','test','operator','cell']) {
    const missing=Math.max(0,needs[s-1][role]-keep.filter(x=>x.shift===s&&x.role===role).length);
    const n=Math.min(missing,12-hired);
    for(let i=0;i<n;i++)keep.push({role,shift:s,hireWeek:w,original:false});
    hired+=n;
  }
  return {roster:keep,hired,released:roster.length+hired-keep.length};
}
function resources(c,w,lineCount,cellCount,shifts,roster,p,saturday=false) {
  const out=[],prodHours=shifts===3?7:7.5;
  for(let s=1;s<=shifts;s++) {
    const workers=role=>roster.filter(x=>x.shift===s&&x.role===role).sort((a,b)=>a.hireWeek-b.hireWeek);
    const ops=workers('operator'),test=workers('test'),cw=workers('cell');
    const support=workers('handler').length+workers('leader').length;
    const y=s===1?1:s===2?c.yield2:c.yield3;
    const T=prodHours*60*5*y+(saturday&&s===1?390:0);
    const outsourced=c.outsource&&w>=c.outsourceStart;
    const opConfig=outsourced?5:c.operators===8&&w>=c.rebalanceStart?8:6;
    const nOps=opConfig-1;
    let oi=0,load=0;
    for(let l=0;l<lineCount;l++) {
      if(ops.length-oi<nOps||test.length<=l||load+1/3>support+EPS)continue;
      const crew=ops.slice(oi,oi+nOps);oi+=nOps;load+=1/3;
      const learn=Math.min(avg(crew.map(x=>learning(x,w))),learning(test[l],w));
      const r=routeMetrics(opConfig,c.automation&&w>=c.automationStart,outsourced,p,c.lot,c.setup);
      out.push({id:`L${l+1}·T${s}`,type:'line',shift:s,operators:opConfig,learning:learn,T,route:r,
        gross:T*learn/r.effectiveCycle,fail:[c.failStd,c.failPro],outsourced,crew:nOps+1});
    }
    let ci=0;
    const content=routeMetrics().content;
    for(let k=0;k<cellCount;k++) {
      const crew=cw.slice(ci,ci+c.cellWorkers);ci+=crew.length;
      if(!crew.length||load+1/6>support+EPS)continue;
      load+=1/6;
      const effectiveWorkers=sum(crew.map(x=>learning(x,w)));
      const work=((1-p)*content[0]+p*content[1])*(1+c.cellPenalty);
      out.push({id:`C${k+1}·T${s}`,type:'cell',shift:s,learning:avg(crew.map(x=>learning(x,w))),T,
        gross:T/(work/effectiveWorkers+5/c.lot),fail:[Math.max(0,c.failStd-.01),Math.max(0,c.failPro-.01)],outsourced:false,crew:crew.length});
    }
  }
  const externalGross=sum(out.filter(x=>x.outsourced).map(x=>x.gross));
  if(externalGross>C.externalDoorLimit)for(const r of out.filter(x=>x.outsourced))r.gross*=C.externalDoorLimit/externalGross;
  return out;
}
function reworkCapacity(c,w,shifts,roster,saturday) {
  return sum(roster.filter(x=>x.role==='rework').map(x=>{
    const y=x.shift===1?1:x.shift===2?c.yield2:c.yield3;
    return ((shifts===3?7:7.5)*300*y+(saturday&&x.shift===1?390:0))*learning(x,w)/15;
  }));
}
function laborCost(roster,shifts,saturday) {
  const weekday=sum(roster.map(x=>C.wages[x.role]*(shifts===3?7.5:8)*5*(x.shift===1?1:x.shift===2?1.08:1.15)))*C.benefits;
  const sat=saturday?sum(roster.filter(x=>x.shift===1).map(x=>C.wages[x.role]*7*1.5))*C.benefits:0;
  return weekday+sat+C.supervisor;
}
export function matureGood(c,w,lines,cells,n) {
  const needs=staffRequired(lines,cells,c,w,n);
  const roster=[];
  needs.forEach((roles,i)=>Object.entries(roles).forEach(([role,qty])=>{for(let j=0;j<qty;j++)roster.push({role,shift:i+1,original:true,hireWeek:0});}));
  const p=mixForWeek(c,w);
  const rs=resources(c,w,lines,cells,n,roster,p);
  const gross=sum(rs.map(r=>r.gross));
  const failed=sum(rs.map(r=>r.gross*((1-p)*r.fail[0]+p*r.fail[1])));
  return gross-failed+Math.min(failed*.8,reworkCapacity(c,w,n,roster,false));
}
export function simulate(input={},scenario='base') {
  const c=config(input),validation=validate(c);
  if(!SCENARIOS.includes(scenario))validation.errors.push('Escenario desconocido.');
  if(validation.errors.length)return {valid:false,config:c,errors:validation.errors,rows:[]};
  const plan=assets(c),rows=[],events=[],monthlySats={},backlog=[[],[]];
  let roster=freshRoster(),inv=[...C.stockInitial],rwQueue=[0,0],phaseTarget=c.shifts,pendingShift=null;
  let npv=-sum(plan.orders.filter(x=>x.week===0).map(x=>x.cost));
  let lostOpportunity=0,totalCapex=sum(plan.orders.map(x=>x.cost));
  const totals={demand:0,sales:0,onTime:0,late:0,lost:0,produced:0,gross:0,scrap:0,reworked:0,
    revenue:0,materials:0,labor:0,cost:0,operatingCash:0,hireCost:0,hired:0,saturdays:0,rent:0,
    soldSKU:[0,0],lostSKU:[0,0],goodSKU:[0,0],grossSKU:[0,0],scrapSKU:[0,0]};
  for(let w=1;w<=52;w++) {
    const p=mixForWeek(c,w),d=DEMAND[scenario][w-1],dsku=[d*(1-p),d*p];
    const active=plan.list.filter(x=>x.start<=w),lines=active.filter(x=>x.type==='line').length,cells=active.length-lines;
    if(pendingShift&&w>=pendingShift.start){phaseTarget=pendingShift.count;pendingShift=null;}
    if(c.sequential&&w>=13&&(w-13)%4===0) {
      const observed=avg(rows.slice(-4).map(x=>x.demand));
      const cap1=matureGood(c,w,lines,cells,1),cap2=matureGood(c,w,lines,cells,2);
      const selected=Math.min(c.shifts,observed<=.95*cap1?1:observed<=.95*cap2?2:3);
      if(selected>phaseTarget){pendingShift={count:selected,start:w+2};events.push({week:w,text:`Promedio observado ${observed.toFixed(0)} u: solicitar ${selected} turnos desde S${w+2}.`});}
      else {phaseTarget=selected;pendingShift=null;events.push({week:w,text:`Promedio observado ${observed.toFixed(0)} u: operar ${selected} turno(s).`});}
    }
    let shifts=1;
    if(c.shifts>=2&&w>=c.shift2Start)shifts=2;
    if(c.shifts>=3&&w>=c.shift3Start)shifts=3;
    if(c.sequential&&w>=13)shifts=Math.min(shifts,phaseTarget);
    const needs=staffRequired(lines,cells,c,w,shifts),staff=updateRoster(roster,needs,w);roster=staff.roster;
    const beginningInv=[...inv],pendingBefore=backlog.map(q=>sum(q.map(x=>x.qty))),needed=dsku.map((x,k)=>x+pendingBefore[k]);
    let target=dsku.map((_,k)=>Math.max(0,needed[k]+c.buffer*(k===0?1-p:p)-inv[k]));
    const excess=Math.max(0,sum(target)+sum(inv)-sum(needed)-C.maxFG);
    if(excess>0){const ratio=Math.max(0,(sum(target)-excess)/sum(target));target=target.map(x=>x*ratio);}
    const dayResources=resources(c,w,lines,cells,shifts,roster,p,false);
    const dayGood=sum(dayResources.map(r=>r.gross*(1-((1-p)*r.fail[0]+p*r.fail[1])*.2)));
    const satResources=resources(c,w,lines,cells,shifts,roster,p,true);
    const satGood=sum(satResources.map(r=>r.gross*(1-((1-p)*r.fail[0]+p*r.fail[1])*.2)));
    const month=dateForWeek(w,5).slice(0,7);
    const saturday=c.saturdays>0&&dateForWeek(w,5)<=C.end&&(monthlySats[month]??0)<c.saturdays&&sum(target)-sum(rwQueue)>dayGood+EPS&&satGood>dayGood+EPS;
    if(saturday){monthlySats[month]=(monthlySats[month]??0)+1;totals.saturdays++;}
    const rwCap=reworkCapacity(c,w,shifts,roster,saturday);
    const queuedRepair=Math.min(sum(rwQueue),rwCap);
    const repairRatio=sum(rwQueue)>0?queuedRepair/sum(rwQueue):0;
    target=target.map((x,k)=>Math.max(0,x-rwQueue[k]*repairRatio));
    let prodMix=p,rs=[],goodRates=[1,1],grossWanted=0;
    for(let it=0;it<4;it++) {
      rs=resources(c,w,lines,cells,shifts,roster,prodMix,saturday);
      const cap=sum(rs.map(r=>r.gross));
      goodRates=[0,1].map(k=>cap?sum(rs.map(r=>r.gross*(1-r.fail[k]*.2)))/cap:1);
      const grossTarget=target.map((x,k)=>x/goodRates[k]);grossWanted=sum(grossTarget);
      if(grossWanted>EPS)prodMix=grossTarget[1]/grossWanted;
    }
    rs=resources(c,w,lines,cells,shifts,roster,prodMix,saturday);
    const grossCapActualMix=sum(rs.map(r=>r.gross)),fraction=grossCapActualMix>0?Math.min(1,grossWanted/grossCapActualMix):0;
    const grossSKU=[0,0],firstPass=[0,0],scrapSKU=[0,0],recoverable=[0,0];
    for(const r of rs) {
      r.produced=r.gross*fraction;
      for(let k=0;k<2;k++) {
        const q=r.produced*(k===0?1-prodMix:prodMix);
        grossSKU[k]+=q;firstPass[k]+=q*(1-r.fail[k]);scrapSKU[k]+=q*r.fail[k]*.2;recoverable[k]+=q*r.fail[k]*.8;
      }
    }
    const oldRepaired=rwQueue.map(x=>x*repairRatio);
    const newRepairRatio=sum(recoverable)>0?Math.min(1,(rwCap-sum(oldRepaired))/sum(recoverable)):0;
    const repaired=oldRepaired.map((x,k)=>x+recoverable[k]*newRepairRatio),rwDone=sum(repaired);
    rwQueue=rwQueue.map((x,k)=>Math.max(0,x+recoverable[k]-repaired[k]));
    const goodSKU=firstPass.map((x,k)=>x+repaired[k]);
    const salesSKU=[0,0],lostSKU=[0,0],lateSKU=[0,0],onSKU=[0,0];
    for(let k=0;k<2;k++) {
      let stock=inv[k]+goodSKU[k];
      for(const q of backlog[k]){const served=Math.min(stock,q.qty);q.qty-=served;stock-=served;salesSKU[k]+=served;lateSKU[k]+=served;}
      const current=Math.min(stock,dsku[k]);onSKU[k]=current;salesSKU[k]+=current;stock-=current;
      const unmet=dsku[k]-current;lostSKU[k]+=unmet*.5;
      backlog[k].push({born:w,qty:unmet*.5});
      for(const q of backlog[k])if(w-q.born>=2){lostSKU[k]+=q.qty;q.qty=0;}
      backlog[k]=backlog[k].filter(x=>x.qty>EPS);
      inv[k]=Math.max(0,stock);
    }
    const pending=backlog.map(q=>sum(q.map(x=>x.qty))),sales=sum(salesSKU),lost=sum(lostSKU),good=sum(goodSKU),gross=sum(grossSKU);
    const wage=laborCost(roster,shifts,saturday),hireCost=staff.hired*C.hireCost;
    const materials=sum(grossSKU.map((x,k)=>x*C.material[k]));
    const outsourceCost=sum(rs.filter(r=>r.outsourced).map(r=>r.produced))*C.externalDoorCost;
    const carry=sum(inv.map((x,k)=>(x+beginningInv[k])/2*C.material[k]*C.carryAnnual/52));
    const backlogCost=sum(pending)*3,imageCost=lost*10,warranty=sales*C.warrantyRate*C.warrantyCost;
    const rent=plan.leaseStart!==null&&w>=plan.leaseStart?200*6:0;
    const leaseLiability=w===52&&plan.leaseStart!==null?Math.max(0,C.leaseMin-(53-plan.leaseStart))*200*6:0;
    const fixed=C.fixed+(shifts-1)*C.shiftFixed;
    const revenue=sum(salesSKU.map((x,k)=>x*C.price[k]));
    const cost=materials+outsourceCost+wage+hireCost+carry+backlogCost+imageCost+warranty+rent+fixed+leaseLiability;
    const operatingCash=revenue-cost;
    const capex=sum(plan.orders.filter(x=>x.week===w).map(x=>x.cost));
    const priorCapex=sum(plan.orders.filter(x=>x.week<=w).map(x=>x.cost));
    npv+=discount(operatingCash-capex,w);
    lostOpportunity+=sum(lostSKU.map((x,k)=>x*(C.margin[k]+10)));
    const nominal=resources(c,w,lines,cells,shifts,roster,p,saturday);
    const nominalGross=sum(nominal.map(x=>x.gross));
    const nominalFailures=sum(nominal.map(r=>r.gross*((1-p)*r.fail[0]+p*r.fail[1])));
    const nominalGood=nominalGross-nominalFailures+Math.min(nominalFailures*.8,Math.max(0,rwCap-queuedRepair));
    const row={week:w,date:dateForWeek(w),demand:d,mix:p,productionMix:prodMix,lines,cells,shifts,saturday,
      capacityGross:nominalGross,capacityGood:nominalGood,gross,good,scrap:sum(scrapSKU),reworked:rwDone,reworkPending:sum(rwQueue),
      sales,onTime:sum(onSKU),late:sum(lateSKU),lost,pending:sum(pending),inventory:sum(inv),inventorySKU:[...inv],pendingSKU:pending,
      service:sum(onSKU)/d,fulfilment:sales/d,stockUse:grossCapActualMix?gross/grossCapActualMix:0,
      staff:roster.length+1,hired:staff.hired,released:staff.released,learning:rs.length?avg(rs.map(x=>x.learning)):0,
      labor:wage,laborPerGood:good>EPS?wage/good:null,revenue,materials,outsourceCost,carry,backlogCost,imageCost,warranty,rent,fixed,hireCost,leaseLiability,
      cost,operatingCash,capex,investment:priorCapex,cumulativeNpv:npv,
      area:lines*120+cells*40,areaAvailable:420+(plan.leaseStart!==null&&w>=plan.leaseStart?200:0),
      contribution:sum(salesSKU.map((x,k)=>x*C.margin[k])),outsourcedUnits:sum(rs.filter(r=>r.outsourced).map(r=>r.produced)),
      resources:rs,goodSKU,grossSKU,salesSKU,lostSKU,scrapSKU,observedWip:lines*c.wip};
    rows.push(row);
    for(const key of ['demand','sales','onTime','late','lost','gross','scrap','revenue','materials','labor','cost','operatingCash','hireCost','rent'])totals[key]+=row[key];
    totals.produced+=good;totals.reworked+=rwDone;totals.hired+=staff.hired;
    for(let k=0;k<2;k++){totals.soldSKU[k]+=salesSKU[k];totals.lostSKU[k]+=lostSKU[k];totals.goodSKU[k]+=goodSKU[k];totals.grossSKU[k]+=grossSKU[k];totals.scrapSKU[k]+=scrapSKU[k];}
  }
  const residual=plan.residualBasis*.8;npv+=discount(residual,52);
  const endingPending=sum(backlog.map(q=>sum(q.map(x=>x.qty))));
  return {valid:true,config:c,scenario,rows,events,orders:plan.orders,leaseStart:plan.leaseStart,
    summary:{...totals,npv,investment:totalCapex,residual,service:totals.onTime/totals.demand,
      fulfilment:totals.sales/totals.demand,endingPending,endingStock:sum(inv),endingStockSKU:inv,
      endingRework:sum(rwQueue),endingReworkSKU:rwQueue,lostOpportunity,peakStaff:Math.max(...rows.map(x=>x.staff)),
      peakArea:Math.max(...rows.map(x=>x.area)),maxWeeklyHires:Math.max(...rows.map(x=>x.hired)),
      laborPerGood:totals.labor/totals.produced,monthlySats}};
}
export function evaluate(changes={}) {
  const c=config(changes),runs=Object.fromEntries(SCENARIOS.map(s=>[s,simulate(c,s)]));
  if(SCENARIOS.some(s=>!runs[s].valid))return {valid:false,errors:runs.base.errors,runs,config:c};
  return {valid:true,config:c,runs,expected:sum(SCENARIOS.map(s=>c.probabilities[s]*runs[s].summary.npv)),
    worst:Math.min(...SCENARIOS.map(s=>runs[s].summary.npv)),expectedSales:sum(SCENARIOS.map(s=>c.probabilities[s]*runs[s].summary.sales)),
    expectedService:sum(SCENARIOS.map(s=>c.probabilities[s]*runs[s].summary.service))};
}
export function compare(overrides={}) {
  return STRATEGIES.map(s=>({...s,...evaluate({...s.changes,...overrides})}));
}
export function sensitivity(input={}) {
  const c=config(input),central=evaluate(c);
  if(!central.valid)return {valid:false,errors:central.errors};
  const axes=[
    {label:'Mezcla Pro',low:'20% / 25%',high:'45% / 50%',a:{proFirst:.2,proSecond:.25},b:{proFirst:.45,proSecond:.5}},
    {label:'Lote por variante',low:'25 u',high:'400 u',a:{lot:25},b:{lot:400}},
    {label:'Cambio de variante',low:'5 min',high:'40 min',a:{setup:5},b:{setup:40}},
    {label:'Polivalencia de células',low:'0%',high:'20%',a:{cellPenalty:0},b:{cellPenalty:.2}},
    {label:'Fallas de prueba',low:'3% / 5%',high:'5% / 7%',a:{failStd:.03,failPro:.05},b:{failStd:.05,failPro:.07}},
    {label:'Rendimiento turnos 2 / 3',low:'85% / 80%',high:'100% / 95%',a:{yield2:.85,yield3:.80},b:{yield2:1,yield3:.95}},
    {label:'Colchón de terminado',low:'0 u',high:'1.200 u',a:{buffer:0},b:{buffer:1200}},
  ];
  return {valid:true,central:central.expected,axes:axes.map(x=>({...x,lowValue:evaluate({...c,...x.a}).expected,highValue:evaluate({...c,...x.b}).expected})).sort((a,b)=>Math.abs(b.highValue-b.lowValue)-Math.abs(a.highValue-a.lowValue))};
}
export function probabilityThreshold(first,second) {
  const diff=s=>first.runs[s].summary.npv-second.runs[s].summary.npv;
  const other=(2*diff('base')+diff('optimista'))/3;
  const denominator=other-diff('canal');
  const q=denominator!==0?other/denominator:null;
  return q!==null&&q>=0&&q<=1?q:null;
}

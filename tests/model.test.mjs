import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CASE,DEMAND,STRATEGIES,SCENARIOS} from '../src/data.js';
import {controls,CONTROL_TARGETS,config,simulate,compare,evaluate,routeMetrics,discount,sum,matureGood} from '../src/model.js';
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} ≠ ${b}`);

test('los 17 valores de control redondean igual al caso',()=>{
  const actual=controls();
  for(const [key,,expected,places] of CONTROL_TARGETS)assert.equal(Number(actual[key].toFixed(places)),expected,key);
});
test('52 semanas por escenario y totales del anexo 11',()=>{
  for(const [key,total] of [['base',60720],['optimista',72170],['canal',42870]]) {
    assert.equal(DEMAND[key].length,52);assert.equal(sum(DEMAND[key]),total);
  }
});
test('el máximo de estación determina el ciclo, también después de automatizar',()=>{
  const eight=routeMetrics(8);
  assert.equal(eight.cycle[0],5.8);assert.equal(eight.cycle[1],6.4);
  assert.ok((eight.gross/routeMetrics().gross-1)<.36);
  const auto=routeMetrics(6,true);
  assert.equal(auto.bottleneck[0],'E4');assert.equal(auto.bottleneck[1],'E4');
  assert.equal(auto.cycle[1],8.6);
  assert.ok(routeMetrics(8,true).gross/eight.gross<1.016);
});
test('todos los planes respetan personas, área, inventario, proveedor y conservación por variante',()=>{
  for(const strategy of STRATEGIES)for(const s of SCENARIOS) {
    const result=simulate(strategy.changes,s);assert.equal(result.valid,true);
    const t=result.summary;
    near(t.demand,t.sales+t.lost+t.endingPending);
    for(let k=0;k<2;k++) {
      near(CASE.stockInitial[k]+t.goodSKU[k],t.soldSKU[k]+t.endingStockSKU[k]);
      near(t.grossSKU[k],t.goodSKU[k]+t.scrapSKU[k]+t.endingReworkSKU[k]);
    }
    assert.ok(t.investment<=120000);
    for(const r of result.rows) {
      assert.ok(r.hired<=12);assert.ok(r.area<=r.areaAvailable);
      assert.ok(r.inventory<=1500+1e-5);assert.ok(r.inventory>=0);
      assert.ok(r.outsourcedUnits<=1200+1e-5);
      assert.ok(r.stockUse<=1+1e-5);assert.ok(r.learning<=1);
      assert.ok(r.service<=1+1e-5);assert.ok(r.good>=0);
    }
    assert.ok(Object.values(t.monthlySats).every(n=>n<=3));
  }
});
test('los escenarios con historia idéntica producen decisiones y resultados idénticos',()=>{
  const base=simulate({operators:8,shifts:3,saturdays:3,sequential:true},'base');
  const optimistic=simulate(base.config,'optimista');
  assert.deepEqual(base.rows.slice(0,4),optimistic.rows.slice(0,4));
  const channel=simulate(base.config,'canal');
  assert.deepEqual(base.rows.slice(0,10),channel.rows.slice(0,10));
  assert.equal(base.events[0].week,13);
});
test('la política por fases respeta el máximo elegido y la capacidad madura limita retrabajo',()=>{
  const one=simulate({shifts:1,sequential:true},'optimista');
  assert.ok(one.rows.every(r=>r.shifts===1));
  assert.ok(one.events.every(e=>!/[23] turno/.test(e.text)));
  const c=config({cells:8,failStd:.15,failPro:.15});
  const capacity=matureGood(c,20,2,8,1);
  const run=simulate(c,'optimista');
  assert.ok(capacity<run.rows[19].capacityGross*(1-.14*.2));
});
test('inversión y valor residual entran una sola vez, en su fecha',()=>{
  const run=simulate({operators:8,shifts:2,saturdays:3});
  const direct=-sum(run.orders.filter(o=>o.week===0).map(x=>x.cost))+
    sum(run.rows.map(r=>discount(r.operatingCash-r.capex,r.week)))+discount(run.summary.residual,52);
  near(run.summary.npv,direct);
  assert.equal(run.summary.investment,18000);assert.equal(run.summary.residual,14400);
  near(evaluate(run.config).expected,.5*run.summary.npv+.25*simulate(run.config,'optimista').summary.npv+.25*simulate(run.config,'canal').summary.npv);
});
test('no libera la tercera línea, células o dispositivo antes de su plazo y respeta el área',()=>{
  assert.equal(simulate({lines:3,lineStart:8}).valid,false);
  assert.equal(simulate({cells:1,cellStart:5}).valid,false);
  assert.equal(simulate({automation:true,automationStart:10}).valid,false);
  const run=simulate({lines:3,cells:4,shifts:2});
  assert.equal(run.valid,true);assert.equal(run.leaseStart,11);
  assert.ok(run.rows.slice(0,10).every(r=>r.area<=420));
  assert.ok(run.rows[10].area<=620);
  assert.ok(run.rows[8].hired<=12);
  const late=simulate({lines:3,lineStart:40,cells:4});
  assert.equal(late.leaseStart,40);assert.equal(late.rows.at(-1).leaseLiability,13*1200);
});
test('proveedor limitado a 1.200 puertas en todos los turnos y sábados juntos',()=>{
  const run=simulate({operators:5,outsource:true,shifts:3,saturdays:3,buffer:1500});
  assert.equal(run.valid,true);
  assert.ok(run.rows.every(r=>r.outsourcedUnits<=1200+1e-6));
  assert.ok(run.rows.some(r=>r.outsourcedUnits>1199));
});
test('no trabaja el sábado 2 de octubre, posterior al cierre del horizonte',()=>{
  const run=simulate({operators:8,shifts:2,saturdays:3},'optimista');
  assert.equal(run.rows[51].saturday,false);
  assert.ok(!Object.hasOwn(run.summary.monthlySats,'2027-10'));
});
test('rechaza combinaciones sin datos, presupuesto excedido y probabilidades inválidas',()=>{
  for(const c of [{operators:5},{operators:8,outsource:true},{operators:5,outsource:true,automation:true},{cells:9},{probabilities:{base:.8}},{lines:3,cells:4,operators:8}])assert.equal(simulate(c).valid,false,JSON.stringify(c));
});
test('no acredita residual por células que llegan después del horizonte',()=>{
  const run=simulate({cells:8,cellStart:52});
  assert.equal(run.valid,true);assert.equal(run.summary.investment,120000);
  assert.equal(run.summary.residual,48000);
});
test('aprendizaje y contratación limitada retrasan la capacidad del turno nuevo',()=>{
  const run=simulate({shifts:2});
  near(run.rows[0].labor,5990);assert.equal(run.rows[0].staff,15);
  assert.equal(run.rows[2].hired,12);assert.ok(run.rows[2].capacityGross<1031);
  near(run.rows[8].capacityGross,controls().grossTwoShifts);
});
test('FIFO: pendientes se sirven antes de pedidos nuevos y lo vencido sale del saldo',()=>{
  const run=simulate();
  const r=run.rows[3];
  assert.ok(r.late>0);assert.ok(r.pending>0);assert.ok(r.lost>0);
  const cum=run.rows.slice(0,4);
  near(sum(cum.map(x=>x.demand)),sum(cum.map(x=>x.sales))+sum(cum.map(x=>x.lost))+r.pending);
});
test('extremos válidos conservan mercancía y no sobrepasan el almacén',()=>{
  for(const cfg of [
    {cells:4,shifts:3,failStd:.15,failPro:.15,saturdays:3,lot:25},
    {operators:8,shifts:3,proFirst:.2,proSecond:.5,buffer:1500,lot:400,saturdays:3},
    {operators:5,outsource:true,lines:3,shifts:3,failStd:0,failPro:0,buffer:0},
    {cells:1,cellWorkers:1,cellPenalty:.2}
  ]) {
    const run=simulate(cfg,'optimista');assert.ok(run.valid);
    assert.ok(run.rows.every(x=>x.inventory<=1500+1e-5&&x.inventory>=0&&x.good>=0));
    near(run.summary.gross,run.summary.produced+run.summary.scrap+run.summary.endingRework);
  }
});

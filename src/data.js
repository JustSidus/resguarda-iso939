export const SOURCE = {
  title: 'Resguarda: producir al ritmo de la demanda',
  author: 'Félix J. Rodriguez P.',
  url: 'https://canvas.unapec.edu.do/courses/36755/files/11584186?wrap=1',
  assignment: 'https://canvas.unapec.edu.do/courses/36755/assignments/1858224',
  company: 'Hogar Conectado del Caribe, S.R.L. (HCC)',
  note: 'Caso docente con empresa y cifras ficticias. Datos de los anexos 1 a 11.',
};
export const DEMAND = {
  base: [700,800,950,1050,1150,1300,1550,1900,1750,1700,1650,1300,900,960,970,970,980,990,1000,1000,1010,1020,1030,1040,1050,1050,1060,1070,1080,1090,1100,1110,1280,1290,1130,1140,1150,1160,1170,1180,1190,1200,1210,1220,1230,1240,1250,1260,1270,1280,1290,1300],
  optimista: [700,800,950,1050,1380,1560,1860,2280,2100,2040,1980,1560,1080,1150,1160,1160,1180,1190,1200,1200,1210,1220,1240,1250,1260,1260,1270,1280,1300,1310,1320,1330,1540,1550,1360,1370,1380,1390,1400,1420,1430,1440,1450,1460,1480,1490,1500,1510,1520,1540,1550,1560],
  canal: [700,800,950,1050,1150,1300,1550,1900,1750,1700,1300,1000,650,650,650,660,660,660,660,660,670,670,670,670,670,680,680,680,680,680,690,690,760,760,690,700,700,700,700,700,710,710,710,710,720,720,720,720,720,730,730,730],
};
export const SCENARIOS = ['base', 'optimista', 'canal'];
export const LABELS = {base:'Base',optimista:'Optimista',canal:'Llenado de canal'};
export const CASE = {
  price:[129,169], material:[58,74], margin:[71,95],
  warrantyRate:.008, warrantyCost:85, benefits:1.30,
  wages:{operator:6.50,test:7.50,handler:7.50,rework:7.50,leader:9,cell:7.20},
  supervisor:1050, fixed:3200, shiftFixed:600, hireCost:350,
  hireLimit:12, learning:[.70,.80,.90,.95,1],
  recoverable:.80, reworkMinutes:15, stockInitial:[210,90],
  carryAnnual:.24, backlogFraction:.5, backlogPenalty:3, imageLoss:10,
  maxFG:1500, weeks:52, discountAnnual:.12, investmentLimit:120000,
  area:420, occupied:240, extraArea:200, leaseWeek:11, leaseRate:6, leaseMin:26,
  lineArea:120, cellArea:40, externalDoorCost:4.80, externalDoorLimit:1200,
  residual:.8, start:'2026-10-05', end:'2027-10-01',
};
export const ROUTES = {
  six:{ids:['E1','E2','E3','E4','E5','E6'],names:['Gabinete y soldadura','Subconjunto de puerta','Puerta y arnés','Montaje eléctrico','Inspección y pruebas','Empaque'],std:[6.5,6.2,8,7,6.5,5+4/6],pro:[6.5,6.2,8,8.6,7.5,5+4/6],cv:[.10,.18,.15,.12,.05,.08]},
  eight:{ids:['L1','L2','L3','L4','L5','L6','L7','L8'],names:['Gabinete','Soldadura','Puerta','Cableado','Instalación de puerta','Eléctrico e inspección','Pruebas','Empaque'],std:[5,5.2,5.8,4.1,4.3,4.8,5,5+4/6],pro:[5,5.2,5.8,4.1,4.3,6.4,6,5+4/6]},
};
export const DEFAULTS = {
  lines:2, lineStart:9, operators:6, rebalanceStart:4,
  shifts:1, shift2Start:3, shift3Start:5,
  saturdays:0, cells:0, cellWorkers:3, cellStart:6,
  automation:false, automationStart:11, outsource:false, outsourceStart:5,
  lot:100, setup:20, proFirst:.30, proSecond:.35,
  cellPenalty:.08, failStd:.04, failPro:.06, yield2:.92, yield3:.88,
  buffer:600, wip:46, sequential:false, reviewEvery:4,
  probabilities:{base:.50,optimista:.25,canal:.25},
};
export const STRATEGIES = [
  {id:'actual',name:'A. Planta actual',short:'Actual',description:'Dos líneas de seis personas, un turno. Referencia sin ampliar capacidad.',changes:{}},
  {id:'turnos',name:'B. Turnos y sábados',short:'Turnos',description:'Segundo turno desde S3 y tercero desde S5; hasta tres sábados al mes si hacen falta. Sin inversión en equipo.',changes:{shifts:3,saturdays:3}},
  {id:'reequilibrio',name:'C. Reequilibrio y dos turnos',short:'Reequilibrio',description:'Ocho personas por línea desde S4; segundo turno desde S3 y sábados cuando falte capacidad.',changes:{operators:8,shifts:2,saturdays:3}},
  {id:'linea',name:'D. Tercera línea y dos turnos',short:'Tercera línea',description:'Tercera línea de seis personas desde S9, dos turnos y sábados según necesidad.',changes:{lines:3,shifts:2,saturdays:3}},
  {id:'celulas',name:'E. Cuatro células y dos turnos',short:'Células',description:'Se conservan las dos líneas y se añaden cuatro células desde S6; dos turnos y sábados según necesidad.',changes:{cells:4,shifts:2,saturdays:3}},
  {id:'fases',name:'F. Reequilibrio por fases',short:'Por fases',description:'Ocho personas por línea, segundo turno S3 y tercero S5 para temporada; lote de 400 y colchón de 300. Desde S13 se revisan turnos cada cuatro semanas usando pedidos ya observados.',changes:{operators:8,shifts:3,saturdays:3,sequential:true,lot:400,buffer:300}},
];
export const ASSUMPTIONS = [
  'Modelo semanal determinista de valores esperados; se conservan decimales. No se generan distribuciones aleatorias a partir de los CV.',
  'Decisión inicial en S0, antes del 5 de octubre. Entrada mínima = semana de pedido + plazo + 1. Herramientas se preparan sin detener toda la planta. Se programa un pedido de hasta cuatro células por semana; los pedidos siguientes se escalonan.',
  'Contratación al entrar la capacidad, hasta 12 personas por semana. Se paga desde la incorporación. Aprendizaje por cohorte; la línea usa el menor rendimiento medio entre operadores y técnico. Una tripulación incompleta no opera esa línea.',
  'Los equipos de turnos adicionales son temporales. Una reducción de turno libera personal nuevo sin indemnización adicional; no se despide la plantilla original. Los costos de salida no aparecen en el caso y requieren confirmación.',
  'Producción por SKU para demanda corriente, pendientes y un colchón fijo editable (600 u por defecto), con tope de 1.500 unidades. El mix asigna el tiempo por las fórmulas del caso; cambios y lotes se prorratean, sin redondear lotes completos.',
  'Pedidos pendientes FIFO por variante, atendibles en las dos semanas siguientes. Se cobra USD 3 por cada cierre semanal pendiente; vencen al terminar la segunda semana de espera. No se sustituyen variantes.',
  'El técnico recupera 80% de fallas, limitado por sus minutos. Lo no retrabajado queda en proceso. Células reducen fallas un punto porcentual; cambio de cinco minutos por célula y lote.',
  'Para mezclar líneas y células se requiere un manipulador por cada carga equivalente de tres líneas o seis células, redondeada hacia arriba. El líder sustituye al primero en turnos 2 y 3. Se prioriza el anexo 6: una tercera línea sola no exige otro manipulador.',
  'Se reservan 180 m² para ampliar capacidad, según el anexo 10. Se alquilan los 200 m² completos solo cuando hacen falta, desde S11; se respeta el mínimo de 26 semanas, incluida la obligación posterior al horizonte.',
  'No se combinan subcontratación con ocho estaciones ni con dispositivo, porque el caso no define esos tiempos. El máximo de 1.200 puertas limita toda la producción de líneas subcontratadas por semana.',
  'Caja: ventas cobradas y materiales pagados en la misma semana; inventario inicial es hundido, sin recuperación terminal del inventario final. Se deducen USD 10 por venta perdida; el margen omitido ya está ausente de ventas y no se resta dos veces. El costo de oportunidad completo se informa aparte. El residual de 80% se aplica al equipo recibido dentro del horizonte.',
  'Desde S13, la política por fases revisa cada cuatro semanas: un turno si el promedio observado de cuatro semanas no supera 95% de su capacidad madura; dos si no supera 95% de dos; tres en otro caso. Aumentos se solicitan con dos semanas de anticipación y vuelven a aprender si se recontrata.',
  'Sábados de primer turno solo si se necesita cubrir demanda, pendientes o colchón; se programan en orden cronológico, máximo seleccionado por mes calendario. No hay costo fijo sabatino adicional definido en el caso.',
];

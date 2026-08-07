// Nexus Business — cierre de totales para Report Center
// Se mantiene separado de app.js para reducir el riesgo de afectar login/navegación.

const REPORT_TOTAL_TYPES = new Set([
  'finance','invoices','payments','receivable','services','quotes',
  'purchases','payroll','retentions','suppliers'
]);

const REPORT_HEADINGS = {
  finance:'REPORTE FINANCIERO',
  invoices:'REPORTE DE FACTURAS',
  payments:'REPORTE DE COBROS',
  receivable:'CUENTAS POR COBRAR',
  services:'REPORTE DE SERVICIOS',
  quotes:'REPORTE DE COTIZACIONES',
  purchases:'COMPRAS Y CUENTAS POR PAGAR',
  payroll:'REPORTE DE NÓMINA',
  retentions:'REPORTE DE RETENCIONES',
  suppliers:'REPORTE DE SUPLIDORES'
};

function parseMoney(text){
  const raw=String(text||'').trim();
  const negative=/^\(.*\)$/.test(raw) || raw.includes('-');
  const cleaned=raw.replace(/[^0-9.,]/g,'').replace(/,/g,'');
  const value=Number(cleaned||0);
  return negative ? -value : value;
}

function formatMoney(value){
  return Number(value||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
}

function selectedReportType(){
  return document.querySelector('.report-option.selected')?.dataset.reportType || '';
}

function previewIsReport(preview,type){
  if(!preview || !REPORT_TOTAL_TYPES.has(type)) return false;
  if(preview.querySelector('.clean-business-doc')) return false;
  const heading=(preview.querySelector('.doc-body h2')?.textContent||'').trim().toUpperCase();
  return heading===REPORT_HEADINGS[type];
}

function dataRows(table){
  if(!table) return [];
  return [...table.querySelectorAll('tr')]
    .filter(row=>row.querySelectorAll('td').length)
    .map(row=>[...row.querySelectorAll('td')].map(td=>td.textContent.trim()));
}

function sumColumn(rows,index){
  return rows.reduce((total,row)=>total+parseMoney(row[index]),0);
}

function buildTotals(type,preview){
  const tables=[...preview.querySelectorAll('.doc-table')];
  if(!tables.length) return null;

  if(type==='finance'){
    const map=new Map(dataRows(tables[0]).map(row=>[row[0],parseMoney(row[1])]));
    const expense=map.get('Gastos')||0;
    const net=map.get('Caja neta')||0;
    const income=net+expense;
    return {title:'TOTAL DEL PERIODO',rows:[['Ingresos',income],['Egresos',expense],['BALANCE NETO',net,true]]};
  }

  if(type==='invoices'){
    const rows=dataRows(tables[tables.length-1]);
    return {title:'TOTAL DEL REPORTE',rows:[
      ['Facturado',sumColumn(rows,2)],
      ['Pagado',sumColumn(rows,3)],
      ['BALANCE PENDIENTE',sumColumn(rows,4),true]
    ]};
  }

  if(type==='payments'){
    const rows=dataRows(tables[tables.length-1]);
    return {title:'TOTAL DEL REPORTE',rows:[['Total cobrado',sumColumn(rows,3),true]]};
  }

  if(type==='receivable'){
    const rows=dataRows(tables[tables.length-1]);
    return {title:'TOTAL POR COBRAR',rows:[
      ['Total facturas',sumColumn(rows,3)],
      ['Pagado',sumColumn(rows,4)],
      ['BALANCE POR COBRAR',sumColumn(rows,5),true]
    ]};
  }

  if(type==='services'){
    const rows=dataRows(tables[tables.length-1]);
    return {title:'TOTAL DEL REPORTE',rows:[['Total servicios',sumColumn(rows,4),true]]};
  }

  if(type==='quotes'){
    const rows=dataRows(tables[tables.length-1]);
    return {title:'TOTAL DEL REPORTE',rows:[['Total cotizado',sumColumn(rows,3),true]]};
  }

  if(type==='purchases'){
    const rows=dataRows(tables[tables.length-1]);
    return {title:'TOTAL DEL REPORTE',rows:[
      ['Compras',sumColumn(rows,3)],
      ['Pagado',sumColumn(rows,4)],
      ['BALANCE POR PAGAR',sumColumn(rows,5),true]
    ]};
  }

  if(type==='payroll'){
    const rows=dataRows(tables[tables.length-1]);
    return {title:'TOTAL DEL REPORTE',rows:[
      ['Total bruto',sumColumn(rows,3)],
      ['TOTAL NETO PAGADO',sumColumn(rows,6),true]
    ]};
  }

  if(type==='retentions'){
    const rows=dataRows(tables[tables.length-1]);
    let pending=0,paid=0;
    for(const row of rows){
      const amount=parseMoney(row[4]);
      const status=String(row[5]||'').toLowerCase();
      if(status.includes('pagada') || status.includes('aplicada')) paid+=amount;
      else if(!status.includes('cancelada')) pending+=amount;
    }
    return {title:'TOTAL DEL REPORTE',rows:[
      ['Retenciones pendientes',pending],
      ['Retenciones pagadas',paid],
      ['TOTAL RETENCIONES',pending+paid,true]
    ]};
  }

  if(type==='suppliers'){
    const rows=dataRows(tables[tables.length-1]);
    return {title:'TOTAL DEL REPORTE',rows:[
      ['Compras',sumColumn(rows,1)],
      ['Pagado',sumColumn(rows,2)],
      ['BALANCE SUPLIDORES',sumColumn(rows,3),true]
    ]};
  }

  return null;
}

function renderTotalsBlock(summary){
  const wrap=document.createElement('div');
  wrap.className='nexus-report-end-total';
  wrap.style.cssText='margin-top:22px;page-break-inside:avoid';
  const table=document.createElement('table');
  table.className='doc-table report-total-table';
  const head=document.createElement('tr');
  head.innerHTML=`<th colspan="2" style="text-align:left">${summary.title}</th>`;
  table.appendChild(head);
  for(const [label,value,strong] of summary.rows){
    const tr=document.createElement('tr');
    if(strong) tr.className='report-grand-total';
    tr.innerHTML=`<td><b>${label}</b></td><td style="text-align:right"><b>${formatMoney(value)}</b></td>`;
    table.appendChild(tr);
  }
  wrap.appendChild(table);
  return wrap;
}

function applyReportTotals(){
  const preview=document.getElementById('reportPreview');
  if(!preview) return;
  preview.querySelectorAll('.nexus-report-end-total').forEach(el=>el.remove());

  const type=selectedReportType();
  if(!previewIsReport(preview,type)) return;
  const summary=buildTotals(type,preview);
  if(!summary) return;

  const body=preview.querySelector('.doc-body');
  if(body) body.appendChild(renderTotalsBlock(summary));
}

function reportHtmlWithTotals(){
  applyReportTotals();
  return document.getElementById('reportPreview')?.innerHTML || '';
}

function printReportWithTotals(){
  const html=reportHtmlWithTotals();
  if(!html) return;
  const w=window.open('','_blank');
  if(!w) return;
  w.document.write(`<html><head><title>Reporte</title><link rel="stylesheet" href="styles.css"><style>@page{size:letter;margin:.45in;}html,body{margin:0!important;padding:0!important;background:#fff!important;}body{display:block!important;}.doc-page{width:100%!important;max-width:none!important;min-height:calc(11in - .9in)!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;display:flex!important;flex-direction:column!important;}.doc-body{flex:1 1 auto!important;padding:0 0 .25in 0!important;}.doc-foot{position:static!important;margin-top:auto!important;text-align:center!important;}.doc-table{width:100%!important;}</style></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(()=>{w.focus();w.print();},700);
}

function downloadReportWithTotals(){
  const html=reportHtmlWithTotals();
  if(!html || !window.jspdf?.jsPDF) return;
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  doc.html(html,{
    callback:d=>{
      const pages=d.getNumberOfPages();
      for(let n=1;n<=pages;n++){
        d.setPage(n);d.setFontSize(8);d.setTextColor(100);
        d.text(`Página ${n} de ${pages}`,d.internal.pageSize.getWidth()/2,d.internal.pageSize.getHeight()-18,{align:'center'});
      }
      d.save('nexus-reporte.pdf');
    },
    x:18,y:18,width:559,windowWidth:900,autoPaging:'text'
  });
}

function isTotalsReportVisible(){
  const preview=document.getElementById('reportPreview');
  const type=selectedReportType();
  return previewIsReport(preview,type) && REPORT_TOTAL_TYPES.has(type);
}

function installReportTotals(){
  const preview=document.getElementById('reportPreview');
  if(!preview) return;

  const observer=new MutationObserver(()=>queueMicrotask(applyReportTotals));
  observer.observe(preview,{childList:true,subtree:true});

  document.addEventListener('click',event=>{
    const target=event.target.closest('#printPreview,#downloadPreview');
    if(!target || !isTotalsReportVisible()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(target.id==='printPreview') printReportWithTotals();
    else downloadReportWithTotals();
  },true);

  document.querySelectorAll('.report-option').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(applyReportTotals,0));
  });

  applyReportTotals();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installReportTotals,{once:true});
else installReportTotals();

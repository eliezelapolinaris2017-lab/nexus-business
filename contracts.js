import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app=getApps()[0]||initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
let clients=[],contracts=[],unsubs=[];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const today=()=>new Date().toISOString().slice(0,10);
const contractCol=uid=>collection(db,'users',uid,'contracts');

function templateText(c={}){
return `CONTRATO DE PRESTACIÓN DE SERVICIOS\n\nEn ${c.place||'[LUGAR]'}, Puerto Rico, a ${c.date||'[FECHA]'}, comparecen ${c.business||'[EMPRESA / PROVEEDOR]'} y ${c.client||'[CLIENTE]'}, con dirección en ${c.address||'[DIRECCIÓN DEL CLIENTE]'}, quienes acuerdan el presente contrato de prestación de servicios.\n\nPRIMERO — SERVICIOS\nEl proveedor realizará los siguientes servicios: ${c.services||'[DESCRIPCIÓN DE LOS SERVICIOS]'}.\nLugar donde se prestarán los servicios: ${c.serviceAddress||c.address||'[LUGAR DEL SERVICIO]'}.\n\nSEGUNDO — VIGENCIA Y PROGRAMACIÓN\nEl servicio comenzará el ${c.startDate||'[FECHA DE INICIO]'} y tendrá la siguiente frecuencia o vigencia: ${c.frequency||'[FRECUENCIA / DURACIÓN]'}. Las fechas podrán coordinarse entre las partes según disponibilidad y necesidades operacionales.\n\nTERCERO — HONORARIOS Y FORMA DE PAGO\nEl cliente pagará ${c.amount||'[MONTO / TARIFA]'} bajo las siguientes condiciones: ${c.paymentTerms||'[CONDICIONES DE PAGO]'}.\n\nCUARTO — RESPONSABILIDADES Y CONDICIONES\n${c.conditions||'[CONDICIONES DEL SERVICIO, ACCESO, EQUIPOS, MATERIALES, CANCELACIONES, GARANTÍAS U OTRAS RESPONSABILIDADES]'}.\n\nQUINTO — TERMINACIÓN\nCualquiera de las partes podrá solicitar la terminación del acuerdo conforme a estas condiciones: ${c.termination||'[CONDICIONES DE CANCELACIÓN O TERMINACIÓN]'}.\n\nSEXTO — ACUERDO\nLas partes declaran haber leído y aceptado el contenido del presente contrato y sus condiciones.\n\n______________________________          ______________________________\nPROVEEDOR                                      CLIENTE\n\nFecha: _________________________          Fecha: _________________________`;
}

function installShell(){
 const sec=$('directory'); if(!sec)return;
 sec.innerHTML=`<div class="card"><div class="section-head"><div><h2>Contratos de servicios</h2><p class="muted">Redacta contratos profesionales rellenando los datos del cliente, lugar y condiciones.</p></div><button id="newContract" class="primary" type="button">Nuevo contrato</button></div><div id="contractEditor"></div><div id="contractsList"></div></div>`;
 relabelNav(); render();
}
function relabelNav(){
 document.querySelectorAll('#sideNav button,#sideNav a').forEach(el=>{if((el.dataset.view||el.getAttribute('data-view'))==='directory'||el.textContent.trim()==='Directorio')el.textContent='Contratos de servicios';});
 if(document.body.dataset.contractObserver)return; document.body.dataset.contractObserver='1';
 new MutationObserver(()=>{document.querySelectorAll('#sideNav button,#sideNav a').forEach(el=>{if((el.dataset.view||el.getAttribute('data-view'))==='directory'||el.textContent.trim()==='Directorio')el.textContent='Contratos de servicios';});if($('directory')?.classList.contains('active')){const t=$('pageTitle');if(t)t.textContent='Contratos de servicios';}}).observe($('sideNav')||document.body,{childList:true,subtree:true});
}
function clientOptions(selected=''){return `<option value="">Seleccionar cliente</option>`+clients.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es')).map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name||'Cliente')}</option>`).join('');}
function editor(data={}){
 const box=$('contractEditor'); if(!box)return;
 box.innerHTML=`<form id="contractForm" class="form-grid contract-form">
 <input id="contractId" type="hidden" value="${esc(data.id||'')}"><div><label>Cliente</label><select id="ctClient">${clientOptions(data.clientId||'')}</select></div><div><label>Fecha</label><input id="ctDate" type="date" value="${esc(data.date||today())}"></div>
 <div><label>Lugar</label><input id="ctPlace" value="${esc(data.place||'Puerto Rico')}"></div><div><label>Dirección del servicio</label><input id="ctAddress" value="${esc(data.serviceAddress||'')}"></div>
 <div class="wide"><label>Servicios contratados</label><textarea id="ctServices" rows="3">${esc(data.services||'')}</textarea></div><div><label>Fecha de inicio</label><input id="ctStart" type="date" value="${esc(data.startDate||'')}"></div><div><label>Frecuencia / duración</label><input id="ctFrequency" placeholder="Ej. cada 6 meses / 12 meses" value="${esc(data.frequency||'')}"></div>
 <div><label>Monto / tarifa</label><input id="ctAmount" placeholder="$0.00 / según cotización" value="${esc(data.amount||'')}"></div><div><label>Condiciones de pago</label><input id="ctPayment" placeholder="Ej. pago al completar el servicio" value="${esc(data.paymentTerms||'')}"></div>
 <div class="wide"><label>Condiciones del servicio</label><textarea id="ctConditions" rows="4">${esc(data.conditions||'')}</textarea></div><div class="wide"><label>Terminación / cancelación</label><textarea id="ctTermination" rows="2">${esc(data.termination||'')}</textarea></div>
 <div class="wide"><label>Vista previa / texto editable del contrato</label><textarea id="ctBody" rows="22">${esc(data.body||'')}</textarea></div>
 <button type="button" id="generateContract">Generar / actualizar texto</button><button class="primary" type="submit">Guardar contrato</button><button type="button" id="cancelContract">Cerrar editor</button></form>`;
 $('ctClient').onchange=()=>{const c=clients.find(x=>x.id===$('ctClient').value)||{};if(!$('ctAddress').value)$('ctAddress').value=c.address||'';};
 $('generateContract').onclick=()=>{$('ctBody').value=buildBody();}; $('cancelContract').onclick=()=>{box.innerHTML='';};
 $('contractForm').onsubmit=saveContract;
}
function formData(){const c=clients.find(x=>x.id===$('ctClient')?.value)||{};return {clientId:c.id||'',clientName:c.name||'',clientAddress:c.address||'',date:$('ctDate')?.value||today(),place:$('ctPlace')?.value||'',serviceAddress:$('ctAddress')?.value||'',services:$('ctServices')?.value||'',startDate:$('ctStart')?.value||'',frequency:$('ctFrequency')?.value||'',amount:$('ctAmount')?.value||'',paymentTerms:$('ctPayment')?.value||'',conditions:$('ctConditions')?.value||'',termination:$('ctTermination')?.value||''};}
function buildBody(){const d=formData();return templateText({client:d.clientName,address:d.clientAddress,date:d.date,place:d.place,serviceAddress:d.serviceAddress,services:d.services,startDate:d.startDate,frequency:d.frequency,amount:d.amount,paymentTerms:d.paymentTerms,conditions:d.conditions,termination:d.termination,business:document.getElementById('sideName')?.textContent||'Proveedor de servicios'});}
async function saveContract(e){e.preventDefault();const u=auth.currentUser;if(!u)return;const data=formData();data.body=$('ctBody').value.trim()||buildBody();data.updatedAt=serverTimestamp();const id=$('contractId').value;if(id)await updateDoc(doc(db,'users',u.uid,'contracts',id),data);else await addDoc(contractCol(u.uid),{...data,createdAt:serverTimestamp()});$('contractEditor').innerHTML='';}
function render(){const box=$('contractsList');if(!box)return;box.innerHTML=`<div class="module-search-bar"><b>Contratos guardados</b><span>${contracts.length} contratos</span></div>`+(contracts.length?`<table class="data-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th>Acción</th></tr></thead><tbody>${contracts.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(c=>`<tr><td>${esc(c.date||'')}</td><td><b>${esc(c.clientName||'')}</b><br><span class="muted">${esc(c.serviceAddress||'')}</span></td><td>${esc(c.services||'')}</td><td><div class="actions"><button data-ct-edit="${c.id}">Editar</button><button data-ct-print="${c.id}">Imprimir / PDF</button><button data-ct-delete="${c.id}">Eliminar</button></div></td></tr>`).join('')}</tbody></table>`:'<p class="muted">Aún no hay contratos guardados.</p>');
 box.querySelectorAll('[data-ct-edit]').forEach(b=>b.onclick=()=>editor(contracts.find(x=>x.id===b.dataset.ctEdit)||{}));
 box.querySelectorAll('[data-ct-print]').forEach(b=>b.onclick=()=>printContract(contracts.find(x=>x.id===b.dataset.ctPrint)||{}));
 box.querySelectorAll('[data-ct-delete]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar este contrato?'))await deleteDoc(doc(db,'users',auth.currentUser.uid,'contracts',b.dataset.ctDelete));});
 const n=$('newContract');if(n)n.onclick=()=>editor({});
}
function printContract(c){const w=window.open('','_blank');if(!w)return;w.document.write(`<html><head><title>Contrato de servicios</title><style>@page{size:letter;margin:.7in}body{font-family:Arial,sans-serif;color:#111;font-size:11pt;line-height:1.55}h1{text-align:center;font-size:15pt;text-transform:uppercase;margin-bottom:28px}.meta{text-align:center;color:#555;margin-bottom:24px}.body{white-space:pre-wrap}</style></head><body><h1>Contrato de prestación de servicios</h1><div class="meta">${esc(c.clientName||'')} · ${esc(c.date||'')}</div><div class="body">${esc(c.body||'')}</div><script>setTimeout(()=>window.print(),350)<\/script></body></html>`);w.document.close();}
function subscribe(u){unsubs.forEach(f=>f());unsubs=[];if(!u)return;unsubs.push(onSnapshot(collection(db,'users',u.uid,'clients'),s=>{clients=s.docs.map(d=>({id:d.id,...d.data()}));render();}));unsubs.push(onSnapshot(contractCol(u.uid),s=>{contracts=s.docs.map(d=>({id:d.id,...d.data()}));render();}));}
function boot(){installShell();onAuthStateChanged(auth,u=>subscribe(u));setTimeout(installShell,700);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

(() => {
  'use strict';
  const E = window.ElectroEngine;
  const STORAGE_KEY = 'elektrotoolbox_v6';
  const PREV_KEY = 'elektrotoolbox_v5';
  const PREV2_KEY = 'elektrotoolbox_v4';
  const OLD_KEY = 'elektrotoolbox_mvp_v1';
  const MAX_HISTORY = 80;
  let state;
  let activeFilter = 'all';
  let currentTool = null;
  let currentToolResult = null;
  let lastFault = null;
  let faultGuideStep = {loop:0,direct:0};
  let deferredInstallPrompt = null;
  let storageWarningShown = false;

  const $ = id => document.getElementById(id);
  const $$ = sel => [...document.querySelectorAll(sel)];
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num = v => { const x = Number(v); return Number.isFinite(x) ? x : NaN; };
  const val = id => num($(id).value);
  const fmt = (v,d=2) => Number.isFinite(v) ? v.toLocaleString('nl-NL',{maximumFractionDigits:d,minimumFractionDigits:0}) : '—';
  const dt = iso => new Date(iso).toLocaleString('nl-NL',{dateStyle:'short',timeStyle:'short'});
  const dateOnly = iso => new Date(iso).toLocaleDateString('nl-NL');

  const PHASE_COLOR_PRESETS={
    iec:{name:'IEC / CENELEC',note:'Veel Europa en IEC-projecten',L1:'#8b5a2b',L2:'#1b1d20',L3:'#8a9097',N:'#4b9eea',PE:'#63a844'},
    ukLegacy:{name:'UK legacy R/Y/B',note:'Oudere UK/RYB-installaties',L1:'#d62828',L2:'#f2c230',L3:'#2457c5',N:'#111318',PE:'#63a844'},
    canada:{name:'Canada CEC',note:'A/B/C rood-zwart-blauw',L1:'#d62828',L2:'#17191c',L3:'#2457c5',N:'#f0f2f4',PE:'#3f9b55'},
    us208:{name:'VS 120/208 V',note:'Veelgebruikte veldconventie',L1:'#17191c',L2:'#d62828',L3:'#2457c5',N:'#f0f2f4',PE:'#3f9b55'},
    us480:{name:'VS 277/480 V',note:'Veelgebruikte veldconventie',L1:'#7a4a28',L2:'#e67e22',L3:'#f1c40f',N:'#a7adb4',PE:'#3f9b55'},
    aunz:{name:'AU/NZ R-W-B',note:'Veelgebruikte/aanbevolen multiphase-kleuren',L1:'#d62828',L2:'#f0f2f4',L3:'#2457c5',N:'#17191c',PE:'#63a844'},
    ryb:{name:'R-Y-B legacy / utility',note:'Rood-geel-blauw veldschema',L1:'#d62828',L2:'#f1c40f',L3:'#2457c5',N:'#17191c',PE:'#63a844'},
    custom:{name:'Aangepast',note:'Eigen bedrijfs- of netbeheerderprofiel'}
  };
  const DEFAULT_PHASE_COLORS={
    hv:{preset:'iec',L1:PHASE_COLOR_PRESETS.iec.L1,L2:PHASE_COLOR_PRESETS.iec.L2,L3:PHASE_COLOR_PRESETS.iec.L3,N:PHASE_COLOR_PRESETS.iec.N,PE:PHASE_COLOR_PRESETS.iec.PE},
    lv:{preset:'iec',L1:PHASE_COLOR_PRESETS.iec.L1,L2:PHASE_COLOR_PRESETS.iec.L2,L3:PHASE_COLOR_PRESETS.iec.L3,N:PHASE_COLOR_PRESETS.iec.N,PE:PHASE_COLOR_PRESETS.iec.PE}
  };
  const phaseColorCopy=x=>({preset:x?.preset||'custom',L1:x?.L1||'#8b5a2b',L2:x?.L2||'#1b1d20',L3:x?.L3||'#8a9097',N:x?.N||'#4b9eea',PE:x?.PE||'#63a844'});
  state = loadState();

  function defaultState(){
    return {version:6,projects:[],activeProjectId:null,history:[],settings:{company:'',technician:'',email:'',phone:'',theme:'dark',phaseColors:{hv:phaseColorCopy(DEFAULT_PHASE_COLORS.hv),lv:phaseColorCopy(DEFAULT_PHASE_COLORS.lv)}}};
  }
  function normalizeProject(p){
    return {
      id:p.id || uid(), name:p.name || 'Project', client:p.client || '', reference:p.reference || '', location:p.location || '', asset:p.asset || '', technician:p.technician || '', note:p.note || '',
      createdAt:p.createdAt || new Date().toISOString(), updatedAt:p.updatedAt || p.createdAt || new Date().toISOString(), entries:Array.isArray(p.entries)?p.entries:[], measurements:Array.isArray(p.measurements)?p.measurements:[]
    };
  }
  function normalizeSettings(input={}){
    const base=defaultState().settings;
    const pc=input.phaseColors||{};
    return {...base,...input,phaseColors:{hv:phaseColorCopy(pc.hv||base.phaseColors.hv),lv:phaseColorCopy(pc.lv||base.phaseColors.lv)}};
  }
  function loadState(){
    try {
      for(const key of [STORAGE_KEY,PREV_KEY,PREV2_KEY,OLD_KEY]){
        const raw=JSON.parse(localStorage.getItem(key));
        if(raw && Array.isArray(raw.projects)){
          const migrated={...defaultState(),...raw,version:6};
          migrated.projects=raw.projects.map(normalizeProject); migrated.history=Array.isArray(raw.history)?raw.history:[]; migrated.settings=normalizeSettings(raw.settings||{});
          return migrated;
        }
      }
    } catch(e){ console.warn('Kon lokale data niet lezen',e); }
    return defaultState();
  }
  function persist(render=true){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){if(!storageWarningShown){storageWarningShown=true;toast('Opslag niet beschikbaar','Lokale browseropslag is in deze omgeving geblokkeerd.','warn');}}
    if(render) renderAll();
  }
  function activeProject(){return state.projects.find(p=>p.id===state.activeProjectId)||null;}
  function touchProject(p){p.updatedAt=new Date().toISOString();}
  function addHistory(kind,title,detail=''){
    state.history.unshift({id:uid(),kind,title,detail,createdAt:new Date().toISOString()}); state.history=state.history.slice(0,MAX_HISTORY); persist(false); renderDashboard();
  }
  function toast(title,message='',type='ok'){
    const wrap=$('toastStack'); const el=document.createElement('div'); el.className='toast'; el.innerHTML=`<span class="toast-icon">${type==='warn'?'!':'✓'}</span><div><b>${esc(title)}</b>${message?`<small>${esc(message)}</small>`:''}</div>`; wrap.appendChild(el); setTimeout(()=>el.remove(),3200);
  }
  function requireProject(){
    const p=activeProject(); if(p) return p; toast('Maak eerst een project','Resultaten worden per project opgeslagen.','warn'); openProjectDialog(); return null;
  }
  function openDialog(el){ if(typeof el.showModal==='function') el.showModal(); else el.setAttribute('open',''); }
  function closeDialog(el){ if(typeof el.close==='function') el.close(); else el.removeAttribute('open'); }

  function applyTheme(theme){
    const resolved=theme==='system' ? (matchMedia('(prefers-color-scheme: light)').matches?'light':'dark') : theme;
    document.documentElement.dataset.theme=resolved;
    document.querySelector('meta[name="theme-color"]').content=resolved==='light'?'#edf4f8':'#06111d';
  }
  function cycleTheme(){
    const current=state.settings.theme||'dark'; const next=current==='dark'?'light':current==='light'?'system':'dark'; state.settings.theme=next; applyTheme(next); persist(false); toast('Thema aangepast',next==='system'?'Systeeminstelling':next==='light'?'Licht':'Donker');
  }
  applyTheme(state.settings.theme||'dark');

  function showView(name){
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
    $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    if(name==='dashboard') renderDashboard(); if(name==='projects') renderProjects(); if(name==='measurements') renderMeasurements(); if(name==='report') renderReport(); if(name==='settings') renderSettings(); if(name==='transformers') updateTrafoLab(); if(name==='fault') updateFaultConnectionDiagram();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  window.ETB_showView = showView;
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $$('[data-view-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.viewJump)));


  // v5 Universal UX — command center, HUD clock and responsive helpers.
  function updateHudClock(){
    const el=$('hudClock'); if(!el) return;
    el.textContent=new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  }
  updateHudClock(); setInterval(updateHudClock,30000);

  function openCommandCenter(){
    const d=$('commandDialog'); if(!d) return;
    openDialog(d);
    const q=$('commandSearch'); if(q){q.value=''; filterCommands(''); setTimeout(()=>q.focus(),40);}
  }
  function closeCommandCenter(){const d=$('commandDialog'); if(d) closeDialog(d);}
  function filterCommands(query){
    const q=String(query||'').trim().toLowerCase();
    $$('#commandGrid button').forEach(btn=>{
      const text=btn.textContent.toLowerCase(); btn.classList.toggle('command-hidden',q && !text.includes(q));
    });
  }
  $('commandTrigger')?.addEventListener('click',openCommandCenter);
  $('mobileMoreBtn')?.addEventListener('click',openCommandCenter);
  $('commandClose')?.addEventListener('click',closeCommandCenter);
  $('commandSearch')?.addEventListener('input',e=>filterCommands(e.target.value));
  $$('[data-command-view]').forEach(btn=>btn.addEventListener('click',()=>{closeCommandCenter();showView(btn.dataset.commandView);}));
  $$('[data-command-action]').forEach(btn=>btn.addEventListener('click',()=>{
    const action=btn.dataset.commandAction; closeCommandCenter();
    if(action==='project') openProjectDialog();
    if(action==='measurement'){showView('measurements');openMeasurement();}
  }));
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandCenter();}
    if(e.key==='Escape'&&$('commandDialog')?.open) closeCommandCenter();
  });

  // Move subtle ambient highlight with pointer on capable devices.
  if(matchMedia('(pointer:fine)').matches){
    window.addEventListener('pointermove',e=>{
      document.documentElement.style.setProperty('--v5-pointer-x',`${e.clientX}px`);
      document.documentElement.style.setProperty('--v5-pointer-y',`${e.clientY}px`);
    },{passive:true});
  }

  const tools = [
    {id:'ohms',title:'Wet van Ohm',category:'basis',icon:'Ω',description:'Bereken V, I, R en P vanuit twee bekende grootheden.',formula:'V = I × R  •  P = V × I',fields:[
      {id:'knownA',label:'Bekende grootheid 1',type:'select',options:[['V','Spanning V'],['I','Stroom I'],['R','Weerstand R'],['P','Vermogen P']]},{id:'valueA',label:'Waarde 1',type:'number',value:230,step:'any'},
      {id:'knownB',label:'Bekende grootheid 2',type:'select',value:'I',options:[['I','Stroom I'],['V','Spanning V'],['R','Weerstand R'],['P','Vermogen P']]},{id:'valueB',label:'Waarde 2',type:'number',value:16,step:'any'}],run:v=>{const r=E.ohmsLaw({knownA:v.knownA,valueA:v.valueA,knownB:v.knownB,valueB:v.valueB});return {headline:`U ${fmt(r.voltage,2)} V • I ${fmt(r.current,2)} A`,detail:`R ${fmt(r.resistance,4)} Ω • P ${fmt(r.power/1000,3)} kW`};}},
    {id:'single',title:'1-fase vermogen',category:'vermogen',icon:'1φ',description:'Werkelijk en schijnbaar vermogen bij 1-fase belasting.',formula:'P = U × I × cos φ',fields:[{id:'voltage',label:'Spanning U (V)',type:'number',value:230},{id:'current',label:'Stroom I (A)',type:'number',value:16},{id:'pf',label:'cos φ',type:'number',value:.95,step:.01}],run:v=>{const r=E.singlePhasePower(v);return {headline:`P ${fmt(r.watts/1000,3)} kW`,detail:`S ${fmt(r.va/1000,3)} kVA • U ${fmt(v.voltage)} V • I ${fmt(v.current)} A • cos φ ${fmt(v.pf,3)}`};}},
    {id:'three',title:'3-fase vermogen',category:'vermogen',icon:'3φ',description:'Werkelijk en schijnbaar vermogen bij symmetrische 3-fase belasting.',formula:'P = √3 × U × I × cos φ',fields:[{id:'voltage',label:'Lijnspanning U (V)',type:'number',value:400},{id:'current',label:'Stroom I (A)',type:'number',value:63},{id:'pf',label:'cos φ',type:'number',value:.9,step:.01}],run:v=>{const r=E.threePhasePower(v);return {headline:`P ${fmt(r.watts/1000,3)} kW`,detail:`S ${fmt(r.va/1000,3)} kVA • U ${fmt(v.voltage)} V • I ${fmt(v.current)} A • cos φ ${fmt(v.pf,3)}`};}},
    {id:'resistance',title:'Geleiderweerstand',category:'kabel',icon:'R',description:'Weerstand van koper of aluminium met temperatuurcorrectie.',formula:'R = ρ₂₀ × L / A × [1 + α(T−20)]',fields:[{id:'materialKey',label:'Materiaal',type:'select',options:[['copper','Koper'],['aluminum','Aluminium']]},{id:'length',label:'Lengte (m)',type:'number',value:100},{id:'area',label:'Doorsnede (mm²)',type:'number',value:150},{id:'temp',label:'Geleidertemperatuur (°C)',type:'number',value:20}],run:v=>{const r=E.conductorResistance(v);return {headline:`R ${fmt(r.ohm,5)} Ω`,detail:`${r.material} • ${fmt(v.length)} m • ${fmt(v.area)} mm² • ${fmt(v.temp)} °C • ${fmt(r.ohm*1000,2)} mΩ`};}},
    {id:'vdrop',title:'Spanningsval — snel',category:'kabel',icon:'ΔU',description:'Snelle resistieve benadering voor 1- of 3-fase kabels.',formula:'1φ: 2 × IρL/A  •  3φ: √3 × IρL/A',fields:[{id:'phase',label:'Net',type:'select',options:[['1','1-fase'],['3','3-fase']]},{id:'materialKey',label:'Materiaal',type:'select',options:[['copper','Koper'],['aluminum','Aluminium']]},{id:'length',label:'Lengte enkele reis (m)',type:'number',value:50},{id:'current',label:'Stroom (A)',type:'number',value:32},{id:'area',label:'Doorsnede (mm²)',type:'number',value:10},{id:'nominalVoltage',label:'Nominale spanning (V)',type:'number',value:230},{id:'temp',label:'Geleidertemperatuur (°C)',type:'number',value:20}],run:v=>{v.phase=Number(v.phase);const r=E.voltageDropSimple(v);return {headline:`ΔU ${fmt(r.volts,2)} V • ${fmt(r.percent,2)}%`,detail:`${v.phase===1?'1-fase':'3-fase'} • ${r.material} • L ${fmt(v.length)} m • I ${fmt(v.current)} A • A ${fmt(v.area)} mm² • ${fmt(v.temp)} °C`};}},
    {id:'vdropac',title:'Spanningsval — R/X',category:'kabel',icon:'R/X',description:'AC-benadering met R, X en cos φ voor kabelgegevens uit jouw bron.',formula:'ΔU = k × I × L × (R cosφ + X sinφ)',fields:[{id:'phase',label:'Net',type:'select',value:'3',options:[['1','1-fase'],['3','3-fase']]},{id:'length',label:'Lengte enkele reis (m)',type:'number',value:100},{id:'current',label:'Stroom (A)',type:'number',value:160},{id:'rOhmKm',label:'R (Ω/km)',type:'number',value:.2,step:.001},{id:'xOhmKm',label:'X (Ω/km)',type:'number',value:.08,step:.001},{id:'pf',label:'cos φ',type:'number',value:.9,step:.01},{id:'nominalVoltage',label:'Nominale spanning (V)',type:'number',value:400}],run:v=>{v.phase=Number(v.phase);const r=E.voltageDropAC(v);return {headline:`ΔU ${fmt(r.volts,2)} V • ${fmt(r.percent,2)}%`,detail:`${v.phase===1?'1-fase':'3-fase'} • R ${fmt(v.rOhmKm,4)} Ω/km • X ${fmt(v.xOhmKm,4)} Ω/km • cos φ ${fmt(v.pf,3)}`};}},
    {id:'short',title:'Kortsluitstroom uit Z',category:'net',icon:'Ik',description:'Snelle foutstroom uit gemeten of bekende lusimpedantie.',formula:'Ik = U / Z',fields:[{id:'voltage',label:'Spanning U (V)',type:'number',value:230},{id:'impedance',label:'Impedantie Z (Ω)',type:'number',value:.35,step:.001}],run:v=>{const r=E.shortCircuit(v);return {headline:`Ik ${fmt(r.amps,1)} A • ${fmt(r.amps/1000,3)} kA`,detail:`U ${fmt(v.voltage)} V • Z ${fmt(v.impedance,4)} Ω`};}},
    {id:'triangle',title:'Vermogensdriehoek',category:'vermogen',icon:'△',description:'Bereken S, Q en fasehoek vanuit P en cos φ.',formula:'S = P / cosφ  •  Q = √(S²−P²)',fields:[{id:'kw',label:'Werkelijk vermogen P (kW)',type:'number',value:25},{id:'pf',label:'cos φ',type:'number',value:.85,step:.01}],run:v=>{const r=E.powerTriangle(v);return {headline:`S ${fmt(r.kva,2)} kVA • Q ${fmt(r.kvar,2)} kvar`,detail:`P ${fmt(r.kw,2)} kW • cos φ ${fmt(v.pf,3)} • φ ${fmt(r.phiDeg,1)}°`};}},
    {id:'unbalance',title:'Fase-onbalans',category:'net',icon:'≋',description:'Maximale afwijking van de gemiddelde fasestroom.',formula:'max(|Ix − Iavg|) / Iavg × 100%',fields:[{id:'l1',label:'L1 (A)',type:'number',value:42},{id:'l2',label:'L2 (A)',type:'number',value:37},{id:'l3',label:'L3 (A)',type:'number',value:46}],run:v=>{const r=E.phaseUnbalance(v);return {headline:`Onbalans ${fmt(r.percent,2)}%`,detail:`Gemiddeld ${fmt(r.average,2)} A • maximale afwijking ${fmt(r.maxDeviation,2)} A`};}},
    {id:'transformer',title:'Transformatorbelasting',category:'vermogen',icon:'TR',description:'Bereken actuele kVA en belasting ten opzichte van naamplaatvermogen.',formula:'S = √3 × U × I',fields:[{id:'nominalKva',label:'Nominaal vermogen (kVA)',type:'number',value:630},{id:'voltage',label:'Spanning (V)',type:'number',value:400},{id:'current',label:'Stroom (A)',type:'number',value:600}],run:v=>{const r=E.transformerLoading(v);return {headline:`Belasting ${fmt(r.percent,1)}%`,detail:`S ${fmt(r.kva,1)} kVA • naamplaat ${fmt(v.nominalKva)} kVA`};}},
    {id:'kvacurrent',title:'kVA ↔ stroom',category:'vermogen',icon:'A',description:'Bereken lijnstroom uit kVA en spanning bij 1- of 3-fase.',formula:'I = S / U  •  3φ: I = S / (√3 U)',fields:[{id:'phase',label:'Net',type:'select',value:'3',options:[['1','1-fase'],['3','3-fase']]},{id:'kva',label:'Schijnbaar vermogen (kVA)',type:'number',value:100},{id:'voltage',label:'Spanning (V)',type:'number',value:400}],run:v=>{v.phase=Number(v.phase);const r=E.kvaCurrent(v);return {headline:`I ${fmt(r.amps,2)} A`,detail:`${v.phase===1?'1-fase':'3-fase'} • S ${fmt(v.kva,2)} kVA • U ${fmt(v.voltage)} V`};}},
    {id:'cablelength',title:'Kabellengte uit weerstand',category:'kabel',icon:'↔',description:'Bereken fysieke geleiderlengte uit gemeten weerstand, doorsnede en materiaal.',formula:'L = R × A / ρ ÷ padfactor',fields:[{id:'materialKey',label:'Materiaal',type:'select',options:[['copper','Koper'],['aluminum','Aluminium']]},{id:'resistance',label:'Gemeten weerstand (Ω)',type:'number',value:.25,step:.001},{id:'area',label:'Doorsnede (mm²)',type:'number',value:150},{id:'temp',label:'Geleidertemperatuur (°C)',type:'number',value:20},{id:'pathFactor',label:'Padfactor',type:'select',value:'1',options:[['1','Enkele geleider'],['2','Heen + terug']] }],run:v=>{v.pathFactor=Number(v.pathFactor);const r=E.cableLengthFromResistance(v);return {headline:`Lengte ${fmt(r.length,1)} m`,detail:`Elektrische padlengte ${fmt(r.electricalLength,1)} m • ${r.material} • ρ ${fmt(r.rho,5)} Ω·mm²/m`};}},
    {id:'neutral',title:'Nulstroom uit fasebelastingen',category:'net',icon:'N',description:'Vectoriële nulstroom bij 120° fasehoek en verschillende fasestromen.',formula:'IN = |I1 + I2 + I3|',fields:[{id:'l1',label:'L1 (A)',type:'number',value:50},{id:'l2',label:'L2 (A)',type:'number',value:40},{id:'l3',label:'L3 (A)',type:'number',value:30}],run:v=>{const r=E.neutralCurrent(v);return {headline:`IN ${fmt(r.amps,2)} A`,detail:`L1 ${fmt(v.l1)} A • L2 ${fmt(v.l2)} A • L3 ${fmt(v.l3)} A`};}},
    {id:'pfc',title:'Cos φ compensatie',category:'vermogen',icon:'cos',description:'Bereken benodigde blindvermogencompensatie om cos φ te verbeteren.',formula:'Qc = P × (tan φ1 − tan φ2)',fields:[{id:'kw',label:'Werkelijk vermogen (kW)',type:'number',value:100},{id:'pfFrom',label:'Huidige cos φ',type:'number',value:.75,step:.01},{id:'pfTo',label:'Doel cos φ',type:'number',value:.95,step:.01}],run:v=>{const r=E.powerFactorCorrection(v);return {headline:`Compensatie ≈ ${fmt(r.kvar,2)} kvar`,detail:`φ ${fmt(r.phiFrom,1)}° → ${fmt(r.phiTo,1)}° • P ${fmt(v.kw)} kW`};}},
    {id:'motorcurrent',title:'3-fase motorstroom',category:'vermogen',icon:'M',description:'Schat lijnstroom uit asvermogen, rendement, cos φ en spanning.',formula:'I = P / (√3 × U × η × cosφ)',fields:[{id:'powerKw',label:'Asvermogen (kW)',type:'number',value:22},{id:'voltage',label:'Lijnspanning (V)',type:'number',value:400},{id:'pf',label:'cos φ',type:'number',value:.85,step:.01},{id:'efficiency',label:'Rendement η',type:'number',value:.92,step:.01}],run:v=>{const r=E.motorCurrent3Phase(v);return {headline:`I ${fmt(r.amps,2)} A`,detail:`Elektrisch ingangsvermogen ≈ ${fmt(r.inputKw,2)} kW • η ${fmt(v.efficiency,3)} • cos φ ${fmt(v.pf,3)}`};}},
    {id:'density',title:'Stroomdichtheid',category:'kabel',icon:'J',description:'Bereken stroom per parallelgeleider en A/mm²; geen normatieve dimensionering.',formula:'J = I / (n × A)',fields:[{id:'current',label:'Totale stroom (A)',type:'number',value:500},{id:'area',label:'Doorsnede per geleider (mm²)',type:'number',value:240},{id:'parallel',label:'Parallelgeleiders per fase',type:'number',value:1,step:1}],run:v=>{const r=E.currentDensity(v);return {headline:`J ${fmt(r.density,3)} A/mm²`,detail:`${fmt(r.perConductor,2)} A per geleider • ${fmt(v.parallel,0)} × ${fmt(v.area)} mm²`};}},
    {id:'linephase',title:'Ster/driehoek lijn ↔ fase',category:'net',icon:'YΔ',description:'Zet lijnspanning/-stroom om naar fasewaarden voor ster of driehoek.',formula:'Y: Uf = Ul/√3, If = Il • Δ: Uf = Ul, If = Il/√3',fields:[{id:'connection',label:'Schakeling',type:'select',options:[['star','Ster (Y)'],['delta','Driehoek (Δ)']]},{id:'lineVoltage',label:'Lijnspanning (V)',type:'number',value:400},{id:'lineCurrent',label:'Lijnstroom (A)',type:'number',value:100}],run:v=>{const r=E.linePhaseValues(v);return {headline:`Uf ${fmt(r.phaseVoltage,2)} V • If ${fmt(r.phaseCurrent,2)} A`,detail:`${v.connection==='star'?'Ster':'Driehoek'} • Ul ${fmt(v.lineVoltage)} V • Il ${fmt(v.lineCurrent)} A`};}},
    {id:'truk',title:'Trafo uk% → Ik',category:'net',icon:'uk',description:'Nominale stroom, equivalente impedantie en klemkortsluitstroom uit uk%.',formula:'Ik ≈ In / (uk% / 100)',fields:[{id:'kva',label:'Trafovermogen (kVA)',type:'number',value:630},{id:'voltage',label:'Zijdespanning lijn-lijn (V)',type:'number',value:400},{id:'ukPercent',label:'uk (%)',type:'number',value:6,step:.1}],run:v=>{const r=E.transformerImpedanceFromUk(v);return {headline:`In ${fmt(r.ratedCurrent,1)} A • Ik ≈ ${fmt(r.shortCircuitCurrent/1000,2)} kA`,detail:`Zeq ≈ ${fmt(r.impedance,5)} Ω • bronimpedantie buiten trafo niet meegenomen`};}},
    {id:'freq',title:'Frequentie ↔ periodetijd',category:'basis',icon:'Hz',description:'Bereken periodetijd uit frequentie.',formula:'T = 1 / f',fields:[{id:'frequency',label:'Frequentie (Hz)',type:'number',value:50,step:.01}],run:v=>{const r=E.frequencyPeriod(v);return {headline:`T ${fmt(r.periodMs,3)} ms`,detail:`${fmt(v.frequency,3)} Hz • ${fmt(r.periodSeconds,6)} s`};}},
    {id:'energy',title:'Energie uit vermogen & tijd',category:'vermogen',icon:'kWh',description:'Bereken energie en optioneel kosten uit kW en bedrijfsduur.',formula:'E = P × t',fields:[{id:'powerKw',label:'Vermogen (kW)',type:'number',value:10},{id:'hours',label:'Bedrijfsduur (uur)',type:'number',value:8,step:.1},{id:'pricePerKwh',label:'Prijs (€/kWh)',type:'number',value:.25,step:.01}],run:v=>{const r=E.energyCost(v);return {headline:`E ${fmt(r.kwh,2)} kWh`,detail:`Kosten ≈ € ${fmt(r.cost,2)} • P ${fmt(v.powerKw)} kW • t ${fmt(v.hours)} h`};}},
    {id:'tdr',title:'TDR afstand',category:'kabel',icon:'TDR',description:'Zet gemeten rondlooptijd om naar afstand met een door jou ingevoerde voortplantingssnelheid.',formula:'d = v × t / 2',fields:[{id:'roundTripTimeUs',label:'Rondlooptijd (µs)',type:'number',value:4,step:.001},{id:'velocityMPerUs',label:'Voortplantingssnelheid (m/µs)',type:'number',value:160,step:.1}],run:v=>{const r=E.tdrDistance(v);return {headline:`Reflectieafstand ${fmt(r.distance,1)} m`,detail:`t ${fmt(v.roundTripTimeUs,3)} µs • v ${fmt(v.velocityMPerUs,1)} m/µs • gebruik kabel-/meetapparaatgegevens voor v`};}},
    {id:'capbreak',title:'Aderbreuk uit capaciteit',category:'kabel',icon:'C',description:'Schat breukpositie uit capaciteit gemeten vanaf beide uiteinden bij uniforme kabel.',formula:'xA = CA / C′  •  L = (CA + CB) / C′',fields:[{id:'capA',label:'Capaciteit zijde A (nF)',type:'number',value:42,step:.01},{id:'capB',label:'Capaciteit zijde B (nF)',type:'number',value:58,step:.01},{id:'capPerKm',label:'Kabelcapaciteit (nF/km)',type:'number',value:200,step:.1}],run:v=>{const r=E.capacitanceBreak(v);return {headline:`Breuk vanaf A ≈ ${fmt(r.fromA,1)} m`,detail:`Vanaf B ${fmt(r.fromB,1)} m • totaal ≈ ${fmt(r.totalLength,1)} m • positie ${fmt(r.percent,1)}% vanaf A`};}},
    {id:'trtap',title:'Trafo tapstand → LV',category:'net',icon:'TAP',description:'Schat secundaire spanning bij een ingevoerde primaire tap-afwijking en werkelijke HV-spanning.',formula:'U₂ = U₁ / [(U₁n × (1+tap))/U₂n]',fields:[{id:'hvNominal',label:'Nominale HV (V)',type:'number',value:10000},{id:'lvNominal',label:'Nominale LV (V)',type:'number',value:400},{id:'supplyHv',label:'Werkelijke HV (V)',type:'number',value:10000},{id:'tapPercent',label:'Tap t.o.v. nominaal (%)',type:'number',value:0,step:.1}],run:v=>{const r=E.transformerTapEffect(v);return {headline:`LV ≈ ${fmt(r.lvVoltage,1)} V`,detail:`Effectieve verhouding ${fmt(r.effectiveRatio,3)} : 1 • LV afwijking ${fmt(r.deltaPercent,2)}% • conventie: positieve tap = hogere primaire nominale tapspanning`};}},
    {id:'trshare',title:'Parallel trafo load share',category:'net',icon:'∥TR',description:'Schat belastingverdeling van twee parallelle trafo’s uit kVA en uk%, bij gelijke verhouding/fasehoek en vergelijkbare X/R.',formula:'verdeling ∝ Sn / uk%',fields:[{id:'kva1',label:'Trafo A (kVA)',type:'number',value:630},{id:'uk1',label:'uk A (%)',type:'number',value:6,step:.1},{id:'kva2',label:'Trafo B (kVA)',type:'number',value:1000},{id:'uk2',label:'uk B (%)',type:'number',value:6,step:.1},{id:'totalKva',label:'Totale belasting (kVA)',type:'number',value:1000}],run:v=>{const r=E.transformerParallelShare(v);return {headline:`A ${fmt(r.share1*100,1)}% • B ${fmt(r.share2*100,1)}%`,detail:`A ≈ ${fmt(r.load1,1)} kVA (${fmt(r.loading1Percent,1)}% nom.) • B ≈ ${fmt(r.load2,1)} kVA (${fmt(r.loading2Percent,1)}% nom.) • alleen schatting bij gelijke verhouding/fasehoek en vergelijkbare impedantiehoek`};}},
    {id:'leakage',title:'Lekweerstand uit U/I',category:'basis',icon:'MΩ',description:'Bereken equivalente lekweerstand uit aangelegde spanning en gemeten lekstroom.',formula:'R = U / I',fields:[{id:'voltage',label:'Spanning (V)',type:'number',value:500},{id:'currentMilliAmp',label:'Lekstroom (mA)',type:'number',value:.5,step:.001}],run:v=>{const r=E.leakageResistance(v);return {headline:`R ${fmt(r.megaohm,3)} MΩ`,detail:`${fmt(r.ohm,0)} Ω • U ${fmt(v.voltage)} V • I ${fmt(v.currentMilliAmp,3)} mA`};}}
  ];

  function renderCalculatorGrid(){
    const q=$('calculatorSearch').value.trim().toLowerCase(); const grid=$('calculatorGrid'); grid.innerHTML='';
    const visible=tools.filter(t=>(activeFilter==='all'||t.category===activeFilter)&&(!q||`${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q)));
    visible.forEach(t=>{const el=document.createElement('article');el.className='card tool-card';el.tabIndex=0;el.innerHTML=`<div class="tool-icon">${esc(t.icon)}</div><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><div class="tool-meta"><span>${esc(t.category)}</span><span class="tool-arrow">→</span></div>`;el.addEventListener('click',()=>openTool(t.id));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTool(t.id);}});grid.appendChild(el);});
    if(!visible.length) grid.innerHTML='<div class="empty-state card" style="grid-column:1/-1"><span>⌕</span><h3>Geen calculator gevonden</h3><p>Probeer een andere zoekterm of categorie.</p></div>';
  }
  function fieldHtml(f){
    const value=f.value ?? (f.options?.[0]?.[0] ?? '');
    if(f.type==='select') return `<label class="field"><span>${esc(f.label)}</span><select data-tool-field="${esc(f.id)}">${f.options.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
    return `<label class="field"><span>${esc(f.label)}</span><input data-tool-field="${esc(f.id)}" type="number" inputmode="decimal" step="${esc(f.step??'any')}" value="${esc(value)}"></label>`;
  }
  function openTool(id){
    currentTool=tools.find(t=>t.id===id); currentToolResult=null; if(!currentTool) return;
    $('toolCategoryLabel').textContent=currentTool.category; $('toolTitle').textContent=currentTool.title; $('toolSubtitle').textContent=currentTool.description;
    $('toolContent').innerHTML=`<div class="tool-formula">${esc(currentTool.formula)}</div><div class="field-grid">${currentTool.fields.map(fieldHtml).join('')}</div>`;
    $('toolResultPanel').className='tool-result-panel'; $('toolResultPanel').innerHTML='<span>Vul waarden in en bereken.</span>'; $('toolSaveBtn').disabled=true; openDialog($('toolDialog'));
  }
  function readToolValues(){
    const out={}; $$('[data-tool-field]').forEach(el=>{ const f=currentTool.fields.find(x=>x.id===el.dataset.toolField); out[f.id]=f.type==='number'?num(el.value):el.value; }); return out;
  }
  function calculateCurrentTool(){
    if(!currentTool) return;
    try{
      const values=readToolValues(); const r=currentTool.run(values); currentToolResult={id:uid(),kind:'calculation',title:currentTool.title,text:r.headline,details:r.detail,toolId:currentTool.id,createdAt:new Date().toISOString()};
      $('toolResultPanel').className='tool-result-panel'; $('toolResultPanel').innerHTML=`<strong>${esc(r.headline)}</strong><br><span>${esc(r.detail)}</span>`; $('toolSaveBtn').disabled=false; addHistory('calculation',currentTool.title,r.headline);
    }catch(e){currentToolResult=null;$('toolSaveBtn').disabled=true;$('toolResultPanel').className='tool-result-panel error';$('toolResultPanel').textContent=e.message||'Controleer de invoer.';}
  }
  function saveCurrentTool(){
    const p=requireProject(); if(!p||!currentToolResult) return; p.entries.unshift({...currentToolResult,id:uid()}); touchProject(p); persist(); toast('Toegevoegd aan project',currentToolResult.title);
  }

  function updateUv2(){
    const uvt=val('lf_uvt'),uv1=val('lf_uv1');const uv2=Number.isFinite(uvt)&&Number.isFinite(uv1)?uvt/2-uv1:NaN;$('lf_uv2').value=Number.isFinite(uv2)?fmt(uv2,3):'';
  }
  function faultCheck(label,ok=true){return `<div class="check-row"><span class="check-icon">${ok?'✓':'!'}</span><span>${esc(label)}</span></div>`;}
  function renderFaultVisual(f){
    const pct=f.totalLength?Math.max(0,Math.min(100,f.faultDistance/f.totalLength*100)):60;
    $('cableProgress').style.width=`${pct}%`; $('faultPin').style.left=`${pct}%`; $('faultPin').style.opacity='1'; $('faultDistance').textContent=`${fmt(f.faultDistance,1)} m`; $('faultTotal').textContent=f.totalLength?`${fmt(f.totalLength,1)} m`:'Niet bepaald'; $('faultPercent').textContent=f.totalLength?`${fmt(pct,1)}%`:'—'; $('faultMaterial').textContent=f.material||'—'; $('faultMethodBadge').textContent=f.method;
    $('faultChecks').innerHTML=f.checks.map(x=>faultCheck(x.label,x.ok)).join('');
  }
  function calculateLoopFault(){
    updateUv2();
    try{
      const args={current:val('lf_i'),totalLoopVoltage:val('lf_uvt'),uv1:val('lf_uv1'),materialKey:$('lf_material').value,area:val('lf_area')}; const r=E.loopFault(args);
      const roles=selectDistinctFaultConductors(); const headline=`Foutafstand ${fmt(r.faultDistance,1)} m • totaal ${fmt(r.totalLength,1)} m`; const detail=`I ${fmt(args.current,2)} A • Uvt ${fmt(args.totalLoopVoltage,3)} V • Uv1 ${fmt(args.uv1,3)} V • Uv2 ${fmt(r.uv2,3)} V • ${r.material} ${fmt(args.area)} mm² • ${$('faultPath').selectedOptions[0].text} • lus ${roles.healthy}↔${roles.fault} • meetreferentie ${roles.ref} • meetzijde ${$('measureSide').value}`;
      lastFault={id:uid(),kind:'fault',title:'Kabelfout — Lusmethode',text:headline,details:detail,createdAt:new Date().toISOString(),method:'Lusmethode',faultDistance:r.faultDistance,totalLength:r.totalLength,material:r.material,checks:[{label:'Uv2 is positief en consistent met Uvt/2 − Uv1.',ok:r.uv2>=0},{label:'Berekening gebruikt soortelijke weerstand bij 20 °C.',ok:true},{label:'Controleer contactweerstand en daadwerkelijke meetopstelling.',ok:true}]};
      $('loopResult').className='inline-result';$('loopResult').innerHTML=`<strong>${esc(headline)}</strong><br><span>Uv2 ${fmt(r.uv2,3)} V • R ader ${fmt(r.conductorResistance,5)} Ω • positie ${fmt(r.percent,1)}%</span>`; renderFaultVisual(lastFault); addHistory('fault','Kabelfout — Lusmethode',headline);
    }catch(e){lastFault=null;$('loopResult').className='inline-result error';$('loopResult').textContent=e.message||'Controleer de invoer.';}
  }
  function calculateDirectFault(){
    try{
      const args={current:val('df_i'),u1:val('df_u1'),u2:val('df_u2'),materialKey:$('df_material').value,area:val('df_area')}; const r=E.directFault(args);
      const roles=selectDistinctFaultConductors(); const headline=`Foutafstand ${fmt(r.faultDistance,1)} m`; const detail=`I ${fmt(args.current,2)} A • U1 ${fmt(args.u1,3)} V • U2 ${fmt(args.u2,3)} V • ΔU ${fmt(r.deltaU,3)} V • ${r.material} ${fmt(args.area)} mm² • ${$('faultPath').selectedOptions[0].text} ${roles.fault}↔${roles.ref} • meetzijde ${$('measureSide').value}`;
      lastFault={id:uid(),kind:'fault',title:'Kabelfout — Directe methode',text:headline,details:detail,createdAt:new Date().toISOString(),method:'Directe methode',faultDistance:r.faultDistance,totalLength:null,material:r.material,checks:[{label:'U1 is groter dan U2.',ok:args.u1>args.u2},{label:'Tweedraads factor is toegepast in de afstandsbepaling.',ok:true},{label:'Controleer of de gekozen meetopstelling overeenkomt met deze methode.',ok:true}]};
      $('directResult').className='inline-result';$('directResult').innerHTML=`<strong>${esc(headline)}</strong><br><span>ΔU ${fmt(r.deltaU,3)} V • R ${fmt(r.resistance,5)} Ω</span>`;renderFaultVisual(lastFault);addHistory('fault','Kabelfout — Directe methode',headline);
    }catch(e){lastFault=null;$('directResult').className='inline-result error';$('directResult').textContent=e.message||'Controleer de invoer.';}
  }
  function saveFault(){
    const p=requireProject(); if(!p||!lastFault){toast('Nog geen resultaat','Bereken eerst een foutafstand.','warn');return;} p.entries.unshift({...lastFault,id:uid()});touchProject(p);persist();toast('Kabelfoutanalyse opgeslagen',lastFault.method);
  }

  function openProjectDialog(project=null){
    $('projectDialogTitle').textContent=project?'Project bewerken':'Nieuw project'; $('projectEditId').value=project?.id||''; $('p_name').value=project?.name||''; $('p_client').value=project?.client||''; $('p_reference').value=project?.reference||''; $('p_location').value=project?.location||''; $('p_asset').value=project?.asset||''; $('p_technician').value=project?.technician||state.settings.technician||''; $('p_note').value=project?.note||''; openDialog($('projectDialog')); setTimeout(()=>$('p_name').focus(),50);
  }
  function saveProjectFromForm(){
    const name=$('p_name').value.trim(); if(!name){toast('Projectnaam ontbreekt','Geef het project een naam.','warn');return;}
    const editId=$('projectEditId').value; let p=state.projects.find(x=>x.id===editId);
    if(!p){p=normalizeProject({id:uid(),name,createdAt:new Date().toISOString()});state.projects.unshift(p);state.activeProjectId=p.id;addHistory('project','Project aangemaakt',name);} else addHistory('project','Project bijgewerkt',name);
    Object.assign(p,{name,client:$('p_client').value.trim(),reference:$('p_reference').value.trim(),location:$('p_location').value.trim(),asset:$('p_asset').value.trim(),technician:$('p_technician').value.trim(),note:$('p_note').value.trim()}); touchProject(p); persist(); closeDialog($('projectDialog')); toast('Project opgeslagen',name);
  }
  function selectProject(id){state.activeProjectId=id;persist();toast('Project geselecteerd',activeProject()?.name||'');}
  function editProject(id){const p=state.projects.find(x=>x.id===id);if(p)openProjectDialog(p);}
  function duplicateProject(id){const p=state.projects.find(x=>x.id===id);if(!p)return;const copy=normalizeProject({...p,id:uid(),name:`${p.name} — kopie`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),entries:p.entries.map(e=>({...e,id:uid()})),measurements:p.measurements.map(m=>({...m,id:uid()}))});state.projects.unshift(copy);state.activeProjectId=copy.id;addHistory('project','Project gedupliceerd',copy.name);persist();toast('Project gekopieerd',copy.name);}
  function deleteProject(id){const p=state.projects.find(x=>x.id===id);if(!p||!confirm(`Project “${p.name}” definitief verwijderen?`))return;state.projects=state.projects.filter(x=>x.id!==id);if(state.activeProjectId===id)state.activeProjectId=state.projects[0]?.id||null;persist();toast('Project verwijderd',p.name,'warn');}
  function exportProject(id){const p=state.projects.find(x=>x.id===id);if(!p){toast('Geen project geselecteerd','','warn');return;}downloadJSON(p,`elektrotoolbox-${slug(p.name)}.json`);}

  function renderProjectSwitcher(){
    const sel=$('projectSwitcher'); sel.innerHTML=`<option value="">Geen actief project</option>${state.projects.map(p=>`<option value="${esc(p.id)}" ${p.id===state.activeProjectId?'selected':''}>${esc(p.name)}</option>`).join('')}`;
  }
  function renderProjects(){
    const grid=$('projectGrid'); grid.innerHTML=''; $('projectEmpty').style.display=state.projects.length?'none':'block';
    state.projects.forEach(p=>{const total=p.entries.length+p.measurements.length;const el=document.createElement('article');el.className=`card project-card ${p.id===state.activeProjectId?'active':''}`;el.innerHTML=`<div class="project-card-top"><div><span class="micro-label">${esc(p.reference||'PROJECT')}</span><h3>${esc(p.name)}</h3></div>${p.id===state.activeProjectId?'<span class="active-label">ACTIEF</span>':''}</div><p>${esc([p.client,p.location].filter(Boolean).join(' • ')||'Geen locatie of opdrachtgever ingevuld')}</p><div class="project-card-meta"><div><small>Items</small><b>${total}</b></div><div><small>Metingen</small><b>${p.measurements.length}</b></div><div><small>Bijgewerkt</small><b>${dateOnly(p.updatedAt)}</b></div></div><div class="project-card-actions"><button class="btn btn-secondary" data-action="open">Open</button><button class="btn btn-secondary" data-action="edit">Bewerk</button><button class="kebab" data-action="more" title="Meer">•••</button></div>`;
      el.querySelector('[data-action="open"]').onclick=()=>selectProject(p.id); el.querySelector('[data-action="edit"]').onclick=()=>editProject(p.id); el.querySelector('[data-action="more"]').onclick=()=>{const action=prompt('Typ: kopie, export of verwijder');if(action==='kopie')duplicateProject(p.id);if(action==='export')exportProject(p.id);if(action==='verwijder')deleteProject(p.id);}; grid.appendChild(el);});
  }

  function openMeasurement(){if(!requireProject())return;['m_value','m_point','m_instrument','m_note'].forEach(id=>$(id).value='');$('m_type').value='Spanning';$('m_status').value='info';openDialog($('measurementDialog'));}
  function saveMeasurement(){
    const p=requireProject(); if(!p)return;const value=$('m_value').value.trim();if(!value){toast('Waarde ontbreekt','Vul een meetwaarde in.','warn');return;}
    const m={id:uid(),kind:'measurement',title:$('m_type').value,text:value,details:[$('m_point').value.trim(),$('m_instrument').value.trim(),$('m_note').value.trim()].filter(Boolean).join(' • '),point:$('m_point').value.trim(),status:$('m_status').value,instrument:$('m_instrument').value.trim(),note:$('m_note').value.trim(),createdAt:new Date().toISOString()};p.measurements.unshift(m);touchProject(p);addHistory('measurement',m.title,`${value}${m.point?' • '+m.point:''}`);persist();closeDialog($('measurementDialog'));toast('Meting opgeslagen',`${m.title}: ${m.text}`);
  }
  function deleteMeasurement(id){const p=activeProject();if(!p)return;p.measurements=p.measurements.filter(m=>m.id!==id);touchProject(p);persist();}
  function statusLabel(status){return ({info:'Gemeten',ok:'Akkoord',attention:'Aandacht',fail:'Afwijking'})[status]||status;}
  function renderMeasurements(){
    const p=activeProject();$('measurementProjectLabel').textContent=p?p.name:'Geen actief project';const body=$('measurementRows');body.innerHTML='';$('measurementEmpty').style.display=p&&p.measurements.length?'none':'block';if(!p)return;
    p.measurements.forEach(m=>{const tr=document.createElement('tr');tr.innerHTML=`<td><b>${esc(m.title)}</b><small>${esc(m.instrument||'')}</small></td><td><b>${esc(m.text)}</b></td><td>${esc(m.point||'—')}</td><td><span class="tag ${esc(m.status)}">${esc(statusLabel(m.status))}</span></td><td>${dt(m.createdAt)}</td><td><div class="row-actions"><button class="mini-btn" data-del>×</button></div></td>`;tr.querySelector('[data-del]').onclick=()=>deleteMeasurement(m.id);body.appendChild(tr);});
  }

  function renderDashboard(){
    const p=activeProject();const hour=new Date().getHours();$('welcomeTitle').textContent=hour<12?'Goedemorgen':hour<18?'Goedemiddag':'Goedenavond';
    $('dashProjectName').textContent=p?p.name:'Nog geen project geselecteerd';$('dashProjectMeta').textContent=p?[p.client,p.location,p.reference].filter(Boolean).join(' • ')||'Project actief':'Maak een project om berekeningen en metingen samen te brengen.';$('dashProjectAction').textContent=p?'Project openen':'Nieuw project';
    const calcCount=p?p.entries.filter(e=>e.kind==='calculation').length:0, faultCount=p?p.entries.filter(e=>e.kind==='fault').length:0, measCount=p?p.measurements.length:0,total=calcCount+faultCount+measCount;
    $('dashEntryCount').textContent=total;$('statCalcs').textContent=calcCount;$('statFaults').textContent=faultCount;$('statMeasurements').textContent=measCount;$('statProjects').textContent=state.projects.length;$('dashLastSaved').textContent=p?dateOnly(p.updatedAt):'Nog leeg';$('scoreRing').style.setProperty('--score',`${Math.min(100,total*12)}%`);
    const list=$('recentActivity');const items=state.history.slice(0,6);list.innerHTML=items.length?items.map(h=>`<div class="activity-item"><span class="activity-dot"></span><div><b>${esc(h.title)}</b><small>${esc(h.detail||h.kind)}</small></div><time>${new Date(h.createdAt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join(''):'<div class="activity-empty">Nog geen activiteit. Start met een berekening of project.</div>';
  }

  function combinedReportItems(p){return [...p.entries,...p.measurements].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));}
  function renderReport(){
    const p=activeProject();$('reportCompany').textContent=state.settings.company||'ElektroToolbox';$('reportDate').textContent=new Date().toLocaleDateString('nl-NL');
    if(!p){$('reportReference').textContent='—';$('reportHeader').innerHTML='<div class="report-hero"><span class="report-kicker">GEEN PROJECT</span><h2>Selecteer eerst een project</h2><p>Berekeningen en metingen verschijnen daarna automatisch in dit rapport.</p></div>';$('reportSummary').innerHTML='';$('reportProjectDetails').innerHTML='';$('reportEntries').innerHTML='';$('reportEmpty').style.display='block';$('reportConclusion').textContent='—';$('reportTechnician').textContent=state.settings.technician||'—';return;}
    const items=combinedReportItems(p);const calc=p.entries.filter(e=>e.kind==='calculation').length,fault=p.entries.filter(e=>e.kind==='fault').length,meas=p.measurements.length;
    $('reportReference').textContent=p.reference||`ET-${p.id.slice(0,8).toUpperCase()}`;$('reportHeader').innerHTML=`<div class="report-hero"><span class="report-kicker">TECHNISCH MEETRAPPORT</span><h2>${esc(p.name)}</h2><p>${esc([p.client,p.location].filter(Boolean).join(' • ')||'Projectdossier')}</p></div>`;
    $('reportSummary').innerHTML=`<div><small>Berekeningen</small><b>${calc}</b></div><div><small>Metingen</small><b>${meas}</b></div><div><small>Foutanalyses</small><b>${fault}</b></div><div><small>Totaal items</small><b>${items.length}</b></div>`;
    const details=[['Opdrachtgever',p.client],['Locatie',p.location],['Referentie',p.reference],['Kabel / object',p.asset],['Technicus',p.technician||state.settings.technician],['Project gestart',dateOnly(p.createdAt)]].filter(x=>x[1]);$('reportProjectDetails').innerHTML=details.map(([k,v])=>`<div class="report-detail"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')||'<div class="report-detail"><small>Project</small><b>Geen aanvullende gegevens ingevuld</b></div>';
    $('reportEntries').innerHTML=items.map((e,i)=>`<div class="report-entry"><span class="report-index">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(e.kind==='measurement'?`Meting — ${e.title}`:e.title)}</h3><div class="result-line">${esc(e.text)}</div>${e.details?`<div class="detail-line">${esc(e.details)}</div>`:''}${e.kind==='measurement'?`<div class="detail-line">Beoordeling: ${esc(statusLabel(e.status))}</div>`:''}</div><span class="entry-time">${dt(e.createdAt)}</span></div>`).join('');$('reportEmpty').style.display=items.length?'none':'block';$('reportConclusion').textContent=p.note||'Geen conclusie of projectnotitie ingevuld.';$('reportTechnician').textContent=p.technician||state.settings.technician||'—';
  }


  function activeFaultMethod(){return document.querySelector('[data-method].active')?.dataset.method || 'loop';}
  function conductorY(name){return ({L1:72,L2:122,L3:172,N:222,PE:272})[name] ?? 122;}
  function conductorColor(name){
    const palette=state.settings.phaseColors?.lv||DEFAULT_PHASE_COLORS.lv;
    return palette[name]||({L1:'#8b5a2b',L2:'#1b1d20',L3:'#8a9097',N:'#4b9eea',PE:'#63a844'})[name]||'#7f8d99';
  }
  const FAULT_GUIDES={
    loop:[
      {title:'Kies foutpad, aders en meetzijde',text:'Leg eerst vast welke geleider de stroom-/foutader is, welke geleider als hoogohmige meetreferentie dient en welke gezonde ader de meetstroomlus sluit.',focus:'setup'},
      {title:'Sluit de meetbron aan',text:'Sluit de DC-meetbron aan de gekozen meetzijde aan tussen de gezonde lusader en de stroom-/foutader. De meetstroom hoort niet door de fout zelf te lopen.',focus:'source'},
      {title:'Maak de laagohmige lus',text:'Verbind aan de verre zijde de gezonde lusader laagohmig met de stroom-/foutader. Controleer de overgang zodat extra lusweerstand zo klein mogelijk blijft.',focus:'jumper'},
      {title:'Meet totale lusspanning Uvt',text:'Meet Uvt over de complete stroomlus aan de meetzijde. Deze app gebruikt Uvt/2 als spanningsval over één ader bij gelijke lusaders.',focus:'uvt'},
      {title:'Meet Uv1 aan de meetzijde',text:'Meet Uv1 tussen de stroom-/foutader en de meetreferentie aan de gekozen meetzijde. Dit is de spanningsval vanaf jouw meetzijde tot aan de fout.',focus:'uv1'},
      {title:'Bereken en controleer Uv2',text:'Uv2 wordt automatisch Uvt/2 − Uv1. Uv2 representeert het resterende traject van de verre zijde tot de fout en kan optioneel aan de verre zijde worden gecontroleerd tussen dezelfde foutader en meetreferentie.',focus:'uv2'}
    ],
    direct:[
      {title:'Kies foutpad en meetzijde',text:'Selecteer de twee foutbetrokken geleiders en de zijde van waaruit je de afgesproken directe tweedraadsmeting uitvoert.',focus:'setup'},
      {title:'Bouw de directe meetopstelling op',text:'Sluit de DC-bron en meetkring aan volgens jouw gevalideerde tweedraadsprocedure. Het schema markeert de gekozen geleiders en beide kabelzijden.',focus:'source'},
      {title:'Meet U1',text:'Leg U1 vast aan de gekozen meetzijde op de in het schema gemarkeerde geleidercombinatie.',focus:'uv1'},
      {title:'Meet U2',text:'Leg U2 vast aan de andere zijde op dezelfde geleidercombinatie. De rekenmethode gebruikt ΔU = U1 − U2.',focus:'uv2'},
      {title:'Bereken en plausibiliseer',text:'Bereken de foutafstand en controleer of de gebruikte directe meetopstelling, stroomrichting en aderdoorsnede exact overeenkomen met je veldprocedure.',focus:'result'}
    ]
  };
  function renderFaultGuide(){
    const method=activeFaultMethod(), steps=FAULT_GUIDES[method], idx=Math.max(0,Math.min(steps.length-1,faultGuideStep[method]||0)); faultGuideStep[method]=idx;
    const step=steps[idx]; $('faultGuideTitle').textContent=step.title; $('faultGuideText').textContent=step.text; $('faultGuideCounter').textContent=`${idx+1} / ${steps.length}`;
    $('faultGuideSteps').innerHTML=steps.map((x,i)=>`<button type="button" class="guide-step ${i===idx?'active':''} ${i<idx?'done':''}" data-guide-step="${i}" title="${esc(x.title)}"><span>${i<idx?'✓':i+1}</span><small>${esc(x.title)}</small></button>`).join('');
    $$('[data-guide-step]').forEach(b=>b.onclick=()=>{faultGuideStep[method]=Number(b.dataset.guideStep);renderFaultGuide();updateFaultConnectionDiagram();});
    $('faultGuidePrev').disabled=idx===0; $('faultGuideNext').textContent=idx===steps.length-1?'Opnieuw':'Volgende →';
  }
  function stepFaultGuide(delta){
    const method=activeFaultMethod(), steps=FAULT_GUIDES[method], idx=faultGuideStep[method]||0;
    faultGuideStep[method]=delta>0&&idx===steps.length-1?0:Math.max(0,Math.min(steps.length-1,idx+delta)); renderFaultGuide(); updateFaultConnectionDiagram();
  }
  function selectDistinctFaultConductors(){
    const path=$('faultPath').value, fault=$('faultConductor').value;
    if(path==='phase-phase'){
      let ref=$('referenceConductor').value, healthy=$('healthyConductor').value;
      const phases=['L1','L2','L3'];
      if(!phases.includes(ref)) ref=phases.find(x=>x!==fault&&x!==healthy)||phases.find(x=>x!==fault);
      if(ref===fault) ref=phases.find(x=>x!==fault&&x!==healthy)||phases.find(x=>x!==fault);
      if(healthy===fault||healthy===ref) healthy=phases.find(x=>x!==fault&&x!==ref)||phases.find(x=>x!==fault);
      $('referenceConductor').value=ref; $('healthyConductor').value=healthy;
      return {fault,ref,healthy};
    }
    const ref=path==='phase-neutral'?'N':'PE';
    let healthy=$('healthyConductor').value; if(healthy===fault) healthy=['L1','L2','L3'].find(x=>x!==fault)||'L1'; $('healthyConductor').value=healthy;
    return {fault,ref,healthy};
  }
  function measurementBracket(x,y1,y2,label,klass=''){
    const top=Math.min(y1,y2),bottom=Math.max(y1,y2),dir=x<360?1:-1,tx=x+dir*19;
    return `<g class="measure-bracket ${klass}"><path d="M ${x} ${top} h ${dir*10} M ${x+dir*10} ${top} V ${bottom} M ${x} ${bottom} h ${dir*10}"/><text x="${tx}" y="${(top+bottom)/2+4}" text-anchor="${dir>0?'start':'end'}">${label}</text></g>`;
  }
  function updateFaultConnectionDiagram(){
    const path=$('faultPath').value, method=activeFaultMethod();
    const roles=selectDistinctFaultConductors(), fault=roles.fault, ref=roles.ref, healthy=roles.healthy;
    const phasePhase=path==='phase-phase';
    $('referenceConductorWrap').style.opacity=phasePhase?'1':'.62'; $('referenceConductor').disabled=!phasePhase;
    if(!phasePhase){$('referenceConductor').innerHTML=`<option>${ref}</option>`;}
    else if($('referenceConductor').options.length!==3){$('referenceConductor').innerHTML='<option>L1</option><option>L2</option><option>L3</option>';$('referenceConductor').value=ref;}
    $('healthyConductorWrap').style.opacity=method==='loop'?'1':'.48'; $('healthyConductor').disabled=method!=='loop';
    const side=$('measureSide').value, far=side==='A'?'B':'A', step=FAULT_GUIDES[method][faultGuideStep[method]||0];
    $('schemaBadge').textContent=path==='phase-phase'?'Fase-fase':path==='phase-neutral'?'Fase-nul':'Fase-aarde/mantel';
    const labels=['L1','L2','L3','N','PE'];
    const activeSet=method==='loop'?new Set([healthy,fault,ref]):new Set([fault,ref]);
    const lines=labels.map(name=>{
      const y=conductorY(name), active=activeSet.has(name), color=conductorColor(name);
      return `<g class="${active?'schema-active':'schema-muted'}"><text x="28" y="${y+5}" class="schema-label">${name}</text><line x1="58" y1="${y}" x2="662" y2="${y}" class="schema-wire-outline"/><line x1="58" y1="${y}" x2="662" y2="${y}" class="schema-wire phase-wire" style="stroke:${color}"/></g>`;
    }).join('');
    const fy=conductorY(fault), ry=conductorY(ref), hy=conductorY(healthy), sourceX=side==='A'?94:626, farX=far==='A'?74:646;
    const sourceTop=method==='loop'?Math.min(fy,hy):Math.min(fy,ry), sourceBottom=method==='loop'?Math.max(fy,hy):Math.max(fy,ry);
    const source=`<g class="schema-source-group ${step.focus==='source'?'guide-focus':''}"><rect x="${side==='A'?70:602}" y="${sourceTop-21}" width="48" height="${sourceBottom-sourceTop+42}" rx="12" class="schema-source"/><text x="${sourceX}" y="${(sourceTop+sourceBottom)/2-2}" text-anchor="middle" class="schema-source-text">DC</text><text x="${sourceX}" y="${(sourceTop+sourceBottom)/2+14}" text-anchor="middle" class="schema-small">ZIJDE ${side}</text></g>`;
    const jumper=method==='loop'?`<g class="${step.focus==='jumper'?'guide-focus':''}"><path d="M ${farX} ${fy} C ${farX+(far==='A'?-34:34)} ${fy}, ${farX+(far==='A'?-34:34)} ${hy}, ${farX} ${hy}" class="schema-jumper"/><text x="${far==='A'?14:706}" y="${(fy+hy)/2+4}" text-anchor="middle" class="schema-small">LUS</text></g>`:'';
    const faultX=390, faultTop=Math.min(fy,ry), faultBottom=Math.max(fy,ry);
    const faultSymbol=`<g class="fault-link"><line x1="${faultX}" y1="${faultTop}" x2="${faultX}" y2="${faultBottom}" class="fault-link-line"/><g transform="translate(${faultX},${(fy+ry)/2})"><circle r="18" class="schema-fault-ring"/><path d="M -3 -13 L 7 -13 L 1 -2 L 10 -2 L -7 15 L -1 3 L -9 3 Z" class="schema-bolt"/><text x="0" y="-29" text-anchor="middle" class="schema-small">FOUT</text></g></g>`;
    const nearProbeX=side==='A'?150:570, farProbeX=far==='A'?150:570;
    const probes=method==='loop'
      ? `<g class="schema-probes ${step.focus==='uv1'?'guide-focus':''}"><circle cx="${nearProbeX}" cy="${fy}" r="6"/><circle cx="${nearProbeX}" cy="${ry}" r="6"/>${measurementBracket(nearProbeX+(side==='A'?10:-10),fy,ry,'Uv1','uv1')}</g><g class="schema-probes ${step.focus==='uv2'?'guide-focus':''}"><circle cx="${farProbeX}" cy="${fy}" r="6"/><circle cx="${farProbeX}" cy="${ry}" r="6"/>${measurementBracket(farProbeX+(far==='A'?10:-10),fy,ry,'Uv2*','uv2')}</g><g class="${step.focus==='uvt'?'guide-focus':''}">${measurementBracket(side==='A'?125:595,fy,hy,'Uvt','uvt')}</g>`
      : `<g class="schema-probes ${step.focus==='uv1'?'guide-focus':''}"><circle cx="${nearProbeX}" cy="${fy}" r="6"/><circle cx="${nearProbeX}" cy="${ry}" r="6"/>${measurementBracket(nearProbeX+(side==='A'?10:-10),fy,ry,'U1','uv1')}</g><g class="schema-probes ${step.focus==='uv2'?'guide-focus':''}"><circle cx="${farProbeX}" cy="${fy}" r="6"/><circle cx="${farProbeX}" cy="${ry}" r="6"/>${measurementBracket(farProbeX+(far==='A'?10:-10),fy,ry,'U2','uv2')}</g>`;
    const currentArrows=method==='loop'?`<g class="current-arrows"><text x="260" y="${hy-8}">I ${side==='A'?'→':'←'}</text><text x="465" y="${fy-8}">I ${side==='A'?'←':'→'}</text></g>`:'';
    const setupFocus=step.focus==='setup'?'<rect x="52" y="48" width="616" height="238" rx="18" class="guide-outline"/>':'';
    $('faultConnectionDiagram').innerHTML=`<svg viewBox="0 0 720 320" role="img" aria-label="Meetopstelling ${path}"><text x="58" y="28" class="schema-side-title">ZIJDE A</text><text x="662" y="28" text-anchor="end" class="schema-side-title">ZIJDE B</text>${setupFocus}${lines}${source}${jumper}${faultSymbol}${probes}${currentArrows}<text x="360" y="307" text-anchor="middle" class="schema-foot">Schematisch veldhulpmiddel — terminalnamen en gevalideerde werkprocedure zijn leidend</text></svg>`;
    const pathNote=path==='phase-earth'?'Meetreferentie = PE/mantel; aanwezige aard-/nulverbindingen kunnen de interpretatie beïnvloeden.':path==='phase-neutral'?'Meetreferentie = N; controleer aanwezige N/PE-koppelingen vóór interpretatie.':`Foutpaar ${fault} ↔ ${ref}; ${healthy} vormt alleen de stroomlus.`;
    $('schemaLegend').innerHTML=method==='loop'
      ? `<b>Lusmethode:</b> DC-bron tussen <b>${esc(healthy)}</b> en <b>${esc(fault)}</b> aan zijde ${side}; laagohmige lus tussen dezelfde aders aan zijde ${far}. Meet <b>Uv1</b> aan zijde ${side} tussen ${esc(fault)} en ${esc(ref)}. <b>Uv2</b> hoort bij zijde ${far} en wordt standaard berekend uit Uvt/2 − Uv1. ${esc(pathNote)}`
      : `<b>Directe methode:</b> gekozen foutpaar <b>${esc(fault)} ↔ ${esc(ref)}</b>, meten vanaf zijde ${side}. U1 staat aan de meetzijde en U2 aan de andere zijde gemarkeerd; gebruik dit alleen wanneer dit overeenkomt met je gevalideerde tweedraadsmeetprocedure. ${esc(pathNote)}`;
    $('faultMeasureMap').innerHTML=method==='loop'
      ? `<div class="measure-card ${step.focus==='uvt'?'active':''}"><b>Uvt</b><span>Totale lusspanning</span><small>${healthy} ↔ ${fault}, zijde ${side}</small></div><div class="measure-card ${step.focus==='uv1'?'active':''}"><b>Uv1</b><span>Meetzijde → fout</span><small>${fault} ↔ ${ref}, zijde ${side}</small></div><div class="measure-card ${step.focus==='uv2'?'active':''}"><b>Uv2</b><span>Verre zijde → fout</span><small>${fault} ↔ ${ref}, zijde ${far} • standaard automatisch</small></div>`
      : `<div class="measure-card ${step.focus==='uv1'?'active':''}"><b>U1</b><span>Spanning meetzijde</span><small>${fault} ↔ ${ref}, zijde ${side}</small></div><div class="measure-card ${step.focus==='uv2'?'active':''}"><b>U2</b><span>Spanning andere zijde</span><small>${fault} ↔ ${ref}, zijde ${far}</small></div>`;
    document.querySelector('.cable-end.start').textContent=`MEETZIJDE ${side}`; document.querySelector('.cable-end.end').textContent=`ZIJDE ${far}`;
    renderFaultGuide();
  }

  const VECTOR_PRESETS={
    Dyn11:{hv:'D',hvn:false,lv:'y',lvn:true,clock:11},Dyn5:{hv:'D',hvn:false,lv:'y',lvn:true,clock:5},Dyn7:{hv:'D',hvn:false,lv:'y',lvn:true,clock:7},Dyn1:{hv:'D',hvn:false,lv:'y',lvn:true,clock:1},
    YNd11:{hv:'Y',hvn:true,lv:'d',lvn:false,clock:11},YNd5:{hv:'Y',hvn:true,lv:'d',lvn:false,clock:5},Yyn0:{hv:'Y',hvn:false,lv:'y',lvn:true,clock:0},Yyn6:{hv:'Y',hvn:false,lv:'y',lvn:true,clock:6},Dd0:{hv:'D',hvn:false,lv:'d',lvn:false,clock:0},Dd6:{hv:'D',hvn:false,lv:'d',lvn:false,clock:6}
  };
  function parseVectorDesignation(name){
    const m=String(name).match(/^(D|Y|Z)(N?)(d|y|z)(n?)(\d{1,2})$/); if(!m)return null;
    return {hv:m[1],hvn:m[2]==='N',lv:m[3],lvn:m[4]==='n',clock:Number(m[5])};
  }
  function clockPoint(hour,r=118,cx=160,cy=160){const a=(-90+Number(hour)*30)*Math.PI/180;return {x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};}
  function vectorLine(hour,r,label,klass){const p=clockPoint(hour,r);return `<line x1="160" y1="160" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="${klass}" marker-end="url(#arrow-${klass})"/><text x="${(p.x+(p.x-160)*.08).toFixed(1)}" y="${(p.y+(p.y-160)*.08).toFixed(1)}" text-anchor="middle" class="vector-label ${klass}">${label}</text>`;}
  function renderVectorClock(clock){
    const ticks=Array.from({length:12},(_,i)=>{const p1=clockPoint(i,129),p2=clockPoint(i,139),pt=clockPoint(i,149);return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="clock-tick"/><text x="${pt.x}" y="${pt.y+4}" text-anchor="middle" class="clock-number">${i===0?12:i}</text>`;}).join('');
    const lv=[clock,(clock+4)%12,(clock+8)%12];
    $('vectorClock').innerHTML=`<svg viewBox="0 0 320 320" role="img" aria-label="Vectorklok klokgetal ${clock}"><defs><marker id="arrow-hv-vector" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker><marker id="arrow-lv-vector" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs><circle cx="160" cy="160" r="140" class="clock-face"/>${ticks}${vectorLine(0,108,'U','hv-vector')}${vectorLine(4,108,'V','hv-vector')}${vectorLine(8,108,'W','hv-vector')}${vectorLine(lv[0],82,'u','lv-vector')}${vectorLine(lv[1],82,'v','lv-vector')}${vectorLine(lv[2],82,'w','lv-vector')}<circle cx="160" cy="160" r="5" class="clock-center"/></svg>`;
  }
  function windingSvg(type,neutral,labelCase='upper'){
    const names=labelCase==='upper'?['U','V','W']:['u','v','w'];
    let body='';
    if(type.toLowerCase()==='d') body=`<polygon points="120,28 42,142 198,142" class="winding-line"/><circle cx="120" cy="28" r="4"/><circle cx="42" cy="142" r="4"/><circle cx="198" cy="142" r="4"/><text x="120" y="18">${names[0]}</text><text x="28" y="158">${names[1]}</text><text x="205" y="158">${names[2]}</text>`;
    else if(type.toLowerCase()==='y') body=`<line x1="120" y1="86" x2="120" y2="24" class="winding-line"/><line x1="120" y1="86" x2="48" y2="148" class="winding-line"/><line x1="120" y1="86" x2="192" y2="148" class="winding-line"/><circle cx="120" cy="86" r="5" class="winding-neutral"/><text x="120" y="16">${names[0]}</text><text x="36" y="162">${names[1]}</text><text x="202" y="162">${names[2]}</text>${neutral?`<line x1="120" y1="86" x2="120" y2="132" class="neutral-line"/><text x="128" y="128">${labelCase==='upper'?'N':'n'}</text>`:''}`;
    else body=`<path d="M120 22 L95 58 L120 86 L48 148 M120 22 L145 58 L120 86 L192 148 M48 148 L83 112 M192 148 L157 112" class="winding-line zig"/><circle cx="120" cy="86" r="5" class="winding-neutral"/><text x="120" y="14">${names[0]}</text><text x="36" y="162">${names[1]}</text><text x="202" y="162">${names[2]}</text>${neutral?`<line x1="120" y1="86" x2="120" y2="132" class="neutral-line"/><text x="128" y="128">${labelCase==='upper'?'N':'n'}</text>`:''}`;
    return `<svg viewBox="0 0 240 180" role="img">${body}</svg>`;
  }
  function applyVectorPreset(name){const p=VECTOR_PRESETS[name]||parseVectorDesignation(name);if(!p)return;$('tv_hv').value=p.hv;$('tv_hvn').value=p.hvn?'1':'0';$('tv_lv').value=p.lv;$('tv_lvn').value=p.lvn?'1':'0';$('tv_clock').value=p.clock;updateTrafoLab();}
  function updateTrafoLab(){
    let hv=$('tv_hv').value, lv=$('tv_lv').value, hvn=$('tv_hvn').value==='1', lvn=$('tv_lvn').value==='1', clock=Number($('tv_clock').value);
    if(hv==='D'){hvn=false;$('tv_hvn').value='0';$('tv_hvn').disabled=true;}else $('tv_hvn').disabled=false;
    if(lv==='d'){lvn=false;$('tv_lvn').value='0';$('tv_lvn').disabled=true;}else $('tv_lvn').disabled=false;
    const vg=E.vectorGroup({hv,hvNeutral:hvn,lv,lvNeutral:lvn,clock});
    $('vectorDesignation').textContent=vg.designation;$('clockValue').textContent=clock;$('phaseShiftBadge').textContent=`${vg.signedShift>0?'+':''}${vg.signedShift}°`;
    const desc={D:'driehoek',Y:'ster',Z:'zigzag',d:'driehoek',y:'ster',z:'zigzag'};
    $('vectorExplain').innerHTML=`<strong>${esc(vg.designation)}</strong><span>HV ${desc[hv]}${hvn?' met N':''} • LV ${desc[lv]}${lvn?' met n':''} • klok ${clock} = ${Math.abs(vg.signedShift)}° ${vg.signedShift>0?'LV vóór HV':vg.signedShift<0?'LV achter HV':'zonder faseverschuiving'}.</span><small>Kloknotatie: HV-fasor als referentie op 12 uur; elk uur = 30 elektrische graden.</small>`;
    renderVectorClock(clock);$('hvWinding').innerHTML=windingSvg(hv,hvn,'upper');$('lvWinding').innerHTML=windingSvg(lv,lvn,'lower');
    try{const r=E.transformerBasics({kva:val('tr_kva'),hvVoltage:val('tr_hv'),lvVoltage:val('tr_lv'),ukPercent:val('tr_uk')});$('trafoKpis').innerHTML=`<div><small>Overzet lijnspanning</small><strong>${fmt(r.ratio,3)} : 1</strong></div><div><small>HV In</small><strong>${fmt(r.hvCurrent,1)} A</strong></div><div><small>LV In</small><strong>${fmt(r.lvCurrent,1)} A</strong></div><div><small>LV Ik uit uk%</small><strong>${fmt(r.scLvCurrent/1000,2)} kA</strong></div><div><small>Zeq op LV-basis</small><strong>${fmt(r.zEqLv,5)} Ω</strong></div>`;}catch(e){$('trafoKpis').innerHTML=`<div class="trafo-error">${esc(e.message)}</div>`;}
    $$('#vectorPresets [data-vector]').forEach(b=>b.classList.toggle('active',b.dataset.vector===vg.designation)); updateParallelCheck(); updatePhaseSync();
  }
  function groupClock(name){const p=parseVectorDesignation(name);return p?p.clock:null;}
  function updateParallelCheck(){
    const ga=$('pa_group').value, gb=$('pb_group').value, va=val('pa_lv'),vb=val('pb_lv'),ua=val('pa_uk'),ub=val('pb_uk');
    const sameGroup=ga===gb, sameClock=groupClock(ga)===groupClock(gb), voltageDiff=(Number.isFinite(va)&&Number.isFinite(vb)&&va)?Math.abs(va-vb)/va*100:NaN, ukDiff=(Number.isFinite(ua)&&Number.isFinite(ub))?Math.abs(ua-ub):NaN;
    const rows=[['Vectorgroep',sameGroup?`${ga} = ${gb}`:`${ga} ≠ ${gb}`,sameGroup],['Klokgetal / fasehoek',sameClock?'Gelijk':'Verschillend',sameClock],['LV-spanning',Number.isFinite(voltageDiff)?`${fmt(voltageDiff,3)}% verschil`:'—',voltageDiff===0],['uk%',Number.isFinite(ukDiff)?`${fmt(ukDiff,3)} procentpunt verschil`:'—',ukDiff===0]];
    $('parallelResult').innerHTML=rows.map(([k,v,ok])=>`<div class="parallel-check ${ok?'ok':'warn'}"><span>${ok?'✓':'!'}</span><div><small>${k}</small><b>${v}</b></div></div>`).join('');
    const exact=rows.every(r=>r[2]);$('parallelBadge').textContent=exact?'Invoer identiek':'Verschillen gevonden';$('parallelBadge').classList.toggle('good',exact);
  }
  const mod=(n,m)=>((n%m)+m)%m;
  function permutationMap(sign,rotation){return [0,1,2].map(n=>mod(sign*n+rotation,3));}
  function permutationScore(map){return map.reduce((sum,x,i)=>sum+Math.abs(x-i),0);}
  function effectiveClock(clock,hvPerm,lvPerm){
    if(hvPerm.sign!==lvPerm.sign)return null;
    return hvPerm.sign===1?mod(clock+4*(lvPerm.rotation-hvPerm.rotation),12):mod(-clock+4*(hvPerm.rotation-lvPerm.rotation),12);
  }
  function solvePhaseAlignment(targetClock,candidateClock){
    return E.phaseAlignmentSolve?E.phaseAlignmentSolve({targetClock,candidateClock}):null;
  }
  function phasePermutationLabel(p,upper=true){
    const t=upper?['U','V','W']:['u','v','w'],m=p.map;
    if(m[0]===0&&m[1]===1&&m[2]===2)return 'rechtstreeks';
    if(p.sign===1)return p.rotation===1?`${t[0]}→${t[1]}→${t[2]}→${t[0]}`:`${t[0]}→${t[2]}→${t[1]}→${t[0]}`;
    const pairs=p.rotation===0?`${t[1]} ↔ ${t[2]}`:p.rotation===1?`${t[0]} ↔ ${t[1]}`:`${t[0]} ↔ ${t[2]}`;
    return `wissel ${pairs}`;
  }
  function vectorTopology(g){const p=parseVectorDesignation(g);return p?`${p.hv}${p.hvn?'N':''}/${p.lv}${p.lvn?'n':''}`:'?';}
  function colorTextContrast(hex){
    const h=String(hex||'#888').replace('#',''); if(h.length!==6)return '#fff'; const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return (r*299+g*587+b*114)/1000>150?'#08111a':'#fff';
  }
  function paletteOptions(){return Object.entries(PHASE_COLOR_PRESETS).map(([k,p])=>`<option value="${k}">${esc(p.name)}</option>`).join('');}
  function setCouplerColorInputs(side,colors){['L1','L2','L3'].forEach(k=>{$(`tc_${side}_${k.toLowerCase()}`).value=colors[k]||'#888888';});}
  function getCouplerColors(side){return {L1:$(`tc_${side}_l1`).value,L2:$(`tc_${side}_l2`).value,L3:$(`tc_${side}_l3`).value};}
  function applyCouplerPalette(side,key){
    const p=PHASE_COLOR_PRESETS[key]; if(!p||key==='custom')return; setCouplerColorInputs(side,p); updatePhaseSync();
  }
  function initPhaseColorWorkbench(){
    ['hv','lv'].forEach(side=>{const sel=$(`tc_${side}_palette`);sel.innerHTML=paletteOptions();const stored=state.settings.phaseColors?.[side]||DEFAULT_PHASE_COLORS[side];sel.value=stored.preset&&PHASE_COLOR_PRESETS[stored.preset]?stored.preset:'custom';setCouplerColorInputs(side,stored);});
  }
  function phaseColorPreviewHtml(){
    const row=(side,label)=>{const p=state.settings.phaseColors?.[side]||DEFAULT_PHASE_COLORS[side];return `<div class="phase-preview-row"><b>${label}</b>${['L1','L2','L3'].map(k=>`<span style="--sw:${p[k]};--swtext:${colorTextContrast(p[k])}">${k}</span>`).join('')}<small>${esc(PHASE_COLOR_PRESETS[p.preset]?.name||'Aangepast')}</small></div>`;};
    return row('hv','HV')+row('lv','LV');
  }
  function savePhaseColorPreference(){
    ['hv','lv'].forEach(side=>{const key=$(`tc_${side}_palette`).value,base=PHASE_COLOR_PRESETS[key]||{};state.settings.phaseColors[side]={preset:key,L1:$(`tc_${side}_l1`).value,L2:$(`tc_${side}_l2`).value,L3:$(`tc_${side}_l3`).value,N:base.N||state.settings.phaseColors[side].N,PE:base.PE||state.settings.phaseColors[side].PE};});
    persist(false); renderSettings(); toast('Fasekleuren opgeslagen','Nieuwe schema’s gebruiken voortaan deze voorkeur.');
  }
  function renderTerminalMap(containerId,mapping,colors,terminals,sideLabel){
    const ys=[48,110,172],leftX=74,rightX=526;
    const lines=mapping.map((target,i)=>{const y1=ys[i],y2=ys[target],c=colors[`L${i+1}`];return `<path d="M ${leftX+40} ${y1} C 235 ${y1},365 ${y2},${rightX-40} ${y2}" class="terminal-wire-outline"/><path d="M ${leftX+40} ${y1} C 235 ${y1},365 ${y2},${rightX-40} ${y2}" class="terminal-wire" style="stroke:${c}"/>`;}).join('');
    const left=ys.map((y,i)=>{const c=colors[`L${i+1}`];return `<g><circle cx="${leftX}" cy="${y}" r="18" fill="${c}" stroke="rgba(255,255,255,.38)"/><text x="${leftX}" y="${y+4}" text-anchor="middle" fill="${colorTextContrast(c)}" class="terminal-phase-text">L${i+1}</text></g>`;}).join('');
    const right=ys.map((y,i)=>`<g><rect x="${rightX-22}" y="${y-18}" width="44" height="36" rx="9" class="terminal-block"/><text x="${rightX}" y="${y+5}" text-anchor="middle" class="terminal-name">${terminals[i]}</text></g>`).join('');
    $(containerId).innerHTML=`<svg viewBox="0 0 600 220" role="img" aria-label="${esc(sideLabel)} faseaansluitingen"><text x="74" y="18" text-anchor="middle" class="terminal-caption">BUS</text><text x="526" y="18" text-anchor="middle" class="terminal-caption">TRAFO B</text>${lines}${left}${right}</svg>`;
  }
  function mappingChipsHtml(mapping,colors,terminals){return mapping.map((t,i)=>`<span><i style="background:${colors[`L${i+1}`]}"></i><b>L${i+1}</b> → ${terminals[t]}</span>`).join('');}
  function updateCommissioningProof(){
    const vals=[val('cp_v1'),val('cp_v2'),val('cp_v3')],tol=val('cp_tol'),rotation=$('cp_rotation').value; if(!vals.every(Number.isFinite)||!Number.isFinite(tol)){return;}
    const high=vals.some(v=>Math.abs(v)>tol),rotOk=rotation==='yes';
    let cls='warn',title='Nog niet vrijgegeven',text='Leg alle phasing-metingen en het draaiveld vast.';
    if(high){cls='danger';title='Spanningsverschil boven ingestelde tolerantie';text=`Minstens één gemeten waarde is groter dan ${fmt(tol,1)} V.`;}
    else if(!rotOk){cls='warn';title=rotation==='reverse'?'Draaiveld wijkt af':'Draaiveld nog niet bevestigd';text='Controleer de fasevolgorde voordat je een koppeling overweegt.';}
    else {cls='ok';title='Meetwaarden binnen werkinstelling';text='De drie ingevoerde spanningsverschillen vallen binnen de gekozen tolerantie en het draaiveld is als gelijk vastgelegd. Dit is registratie, geen schakelvrijgave.';}
    $('commissioningResult').className=`commissioning-result ${cls}`;$('commissioningResult').innerHTML=`<b>${title}</b><span>${text}</span>`;
  }
  function externalClockFamily(clock){
    clock=Number(clock);
    if(clock%2===1) return 'oneven klokfamilie 1/3/5/7/9/11';
    return clock%4===0?'even klokfamilie 0/4/8':'even klokfamilie 2/6/10';
  }
  function renderClockRouteMatrix(candidateClock,targetClock){
    if(!$('phaseClockMatrix'))return;
    $('phaseClockMatrix').innerHTML=Array.from({length:12},(_,clock)=>{
      const sol=solvePhaseAlignment(clock,candidateClock);
      let kind='none',label='—';
      if(sol){if(sol.hv.sign===1&&sol.hv.rotation===0&&sol.lv.rotation===0){kind='direct';label='direct';}else if(sol.hv.sign===1){kind='cyclic';label='cyclisch';}else{kind='reverse';label='omkeer';}}
      return `<div class="clock-route ${kind} ${clock===targetClock?'target':''} ${clock===candidateClock?'source':''}"><b>${clock}</b><span>${label}</span></div>`;
    }).join('');
  }

  function updatePhaseSync(){
    if(!$('tc_group_a'))return;
    const ga=$('tc_group_a').value,gb=$('tc_group_b').value,a=parseVectorDesignation(ga),b=parseVectorDesignation(gb); if(!a||!b)return;
    renderClockRouteMatrix(b.clock,a.clock);
    const solution=solvePhaseAlignment(a.clock,b.clock),hvColors=getCouplerColors('hv'),lvColors=getCouplerColors('lv'),sameTopology=vectorTopology(ga)===vectorTopology(gb);
    const familyA=externalClockFamily(a.clock),familyB=externalClockFamily(b.clock);
    if(!solution){
      $('phaseSyncBadge').textContent='Geen fasepermutatie';$('phaseSyncBadge').classList.remove('good');$('phaseSyncSummary').innerHTML=`<b>${esc(gb)} → ${esc(ga)}</b><span>Het klokverschil is niet met alleen externe 3-fasepermutaties uit te lijnen (${esc(familyB)} → ${esc(familyA)}).</span>`;$('hvTerminalMap').innerHTML='';$('lvTerminalMap').innerHTML='';$('hvMappingText').innerHTML='';$('lvMappingText').innerHTML='';$('hvPermutationBadge').textContent='—';$('lvPermutationBadge').textContent='—';
      $('phaseSyncChecks').innerHTML=`<div class="parallel-check warn"><span>!</span><div><small>Klokklasse</small><b>Geen fase-only oplossing</b></div></div>`;updateCommissioningProof();return;
    }
    const mode=solution.hv.sign===1?(solution.hv.rotation===0&&solution.lv.rotation===0?'Rechtstreeks':'Cyclische permutatie'):'Fasevolgorde aan beide zijden omkeren';
    $('phaseSyncBadge').textContent=mode;$('phaseSyncBadge').classList.add('good');$('hvPermutationBadge').textContent=phasePermutationLabel(solution.hv,true);$('lvPermutationBadge').textContent=phasePermutationLabel(solution.lv,false);
    renderTerminalMap('hvTerminalMap',solution.hv.map,hvColors,['U','V','W'],'HV');renderTerminalMap('lvTerminalMap',solution.lv.map,lvColors,['u','v','w'],'LV');$('hvMappingText').innerHTML=mappingChipsHtml(solution.hv.map,hvColors,['U','V','W']);$('lvMappingText').innerHTML=mappingChipsHtml(solution.lv.map,lvColors,['u','v','w']);
    $('phaseSyncSummary').innerHTML=`<b>${esc(gb)} → effectief klok ${solution.effective}</b><span>Doel: ${esc(ga)} (klok ${a.clock}). ${mode}. De gekleurde lijnen tonen welke busfase naar welk trafo-contact gaat.</span>`;
    const checks=[
      ['Externe permutatieklasse',familyA===familyB?familyA:`${familyB} → ${familyA}`,familyA===familyB],
      ['Fasehoek na permutatie',`klok ${solution.effective} = klok ${a.clock}`,solution.effective===a.clock],
      ['Wikkel-/nulpunttopologie',sameTopology?vectorTopology(ga):`${vectorTopology(ga)} ≠ ${vectorTopology(gb)}`,sameTopology],
      ['Fasevolgorde',solution.hv.sign===1?'Behouden':'Extern omgekeerd op HV én LV',true]
    ];
    $('phaseSyncChecks').innerHTML=checks.map(([k,v,ok])=>`<div class="parallel-check ${ok?'ok':'warn'}"><span>${ok?'✓':'!'}</span><div><small>${esc(k)}</small><b>${esc(v)}</b></div></div>`).join('');
    updateCommissioningProof();
  }
  function savePhaseSyncToProject(){
    const p=requireProject();if(!p)return;const ga=$('tc_group_a').value,gb=$('tc_group_b').value,a=parseVectorDesignation(ga),b=parseVectorDesignation(gb),sol=solvePhaseAlignment(a.clock,b.clock);if(!sol){toast('Geen koppelplan om op te slaan','','warn');return;}
    const hv=phasePermutationLabel(sol.hv,true),lv=phasePermutationLabel(sol.lv,false),v=[val('cp_v1'),val('cp_v2'),val('cp_v3')];
    const entry={id:uid(),kind:'calculation',title:`PhaseSync — ${gb} naar ${ga}`,text:`HV ${hv} • LV ${lv}`,details:`Effectief klok ${sol.effective} • phasing ${v.map(x=>fmt(x,1)+' V').join(' / ')} • draaiveld ${$('cp_rotation').selectedOptions[0].text}`,createdAt:new Date().toISOString()};p.entries.unshift(entry);touchProject(p);addHistory('calculation',entry.title,entry.text);persist();toast('Koppelplan opgeslagen',`${gb} → ${ga}`);
  }

  function saveTrafoToProject(){
    const p=requireProject();if(!p)return;const vg=E.vectorGroup({hv:$('tv_hv').value,hvNeutral:$('tv_hvn').value==='1',lv:$('tv_lv').value,lvNeutral:$('tv_lvn').value==='1',clock:Number($('tv_clock').value)});
    try{const r=E.transformerBasics({kva:val('tr_kva'),hvVoltage:val('tr_hv'),lvVoltage:val('tr_lv'),ukPercent:val('tr_uk')});const entry={id:uid(),kind:'calculation',title:`TrafoLab — ${vg.designation}`,text:`${fmt(val('tr_kva'))} kVA • ${fmt(val('tr_hv'))}/${fmt(val('tr_lv'))} V • ${vg.signedShift>0?'+':''}${vg.signedShift}°`,details:`HV In ${fmt(r.hvCurrent,1)} A • LV In ${fmt(r.lvCurrent,1)} A • uk ${fmt(val('tr_uk'),2)}% • LV Ik ≈ ${fmt(r.scLvCurrent/1000,2)} kA`,createdAt:new Date().toISOString()};p.entries.unshift(entry);touchProject(p);addHistory('calculation',entry.title,entry.text);persist();toast('TrafoLab-resultaat opgeslagen',vg.designation);}catch(e){toast('Controleer trafo-invoer',e.message,'warn');}
  }

  function renderSettings(){const s=state.settings;$('set_company').value=s.company||'';$('set_technician').value=s.technician||'';$('set_email').value=s.email||'';$('set_phone').value=s.phone||'';if($('settingsPhasePreview'))$('settingsPhasePreview').innerHTML=phaseColorPreviewHtml();}
  function saveSettings(){state.settings.company=$('set_company').value.trim();state.settings.technician=$('set_technician').value.trim();state.settings.email=$('set_email').value.trim();state.settings.phone=$('set_phone').value.trim();persist();toast('Instellingen opgeslagen');}
  function downloadJSON(data,filename){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function slug(s){return String(s||'project').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'project';}
  function exportAll(){downloadJSON(state,`elektrotoolbox-backup-${new Date().toISOString().slice(0,10)}.json`);toast('Back-up gemaakt');}
  async function importAll(file){
    try{const text=await file.text();const incoming=JSON.parse(text);if(!incoming||!Array.isArray(incoming.projects))throw new Error('Geen geldige ElektroToolbox-back-up');if(!confirm('Huidige lokale gegevens vervangen door deze back-up?'))return;state={...defaultState(),...incoming,projects:incoming.projects.map(normalizeProject),settings:normalizeSettings(incoming.settings||{})};persist();applyTheme(state.settings.theme);initPhaseColorWorkbench();updatePhaseSync();renderAll();toast('Back-up geïmporteerd');}
    catch(e){toast('Importeren mislukt',e.message,'warn');}
  }
  async function shareReport(){const p=activeProject();if(!p){toast('Geen project geselecteerd','','warn');return;}const text=`${p.name}\n${[p.client,p.location].filter(Boolean).join(' • ')}\n${combinedReportItems(p).length} rapportitems\nGegenereerd met ElektroToolbox v6.`;if(navigator.share){try{await navigator.share({title:`Meetrapport — ${p.name}`,text});}catch(e){}}else{await navigator.clipboard?.writeText(text);toast('Rapportsamenvatting gekopieerd');}}

  function renderAll(){renderProjectSwitcher();renderProjects();renderMeasurements();renderDashboard();renderReport();renderSettings();}

  $$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>{const d=b.closest('dialog');if(d)closeDialog(d);}));
  $('calculatorSearch')?.addEventListener('input',renderCalculatorGrid);$$('#calculatorFilters [data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;$$('#calculatorFilters [data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderCalculatorGrid();}));
  $('toolForm')?.addEventListener('submit',e=>{e.preventDefault();calculateCurrentTool();});$('toolSaveBtn')?.addEventListener('click',saveCurrentTool);
  $$('[data-method]').forEach(b=>b.addEventListener('click',()=>{$$('[data-method]').forEach(x=>x.classList.toggle('active',x===b));$$('.method').forEach(x=>x.classList.toggle('active',x.id===`method-${b.dataset.method}`));$('faultMethodBadge').textContent=b.dataset.method==='loop'?'Lusmethode':'Directe methode';lastFault=null;renderFaultGuide();updateFaultConnectionDiagram();}));
  ['lf_uvt','lf_uv1'].forEach(id=>$(id)?.addEventListener('input',updateUv2));$('calcLoopBtn')?.addEventListener('click',calculateLoopFault);$('calcDirectBtn')?.addEventListener('click',calculateDirectFault);$('saveLoopBtn')?.addEventListener('click',saveFault);$('saveDirectBtn')?.addEventListener('click',saveFault);$('faultHelpBtn')?.addEventListener('click',()=>openDialog($('helpDialog')));
  ['faultPath','faultConductor','referenceConductor','healthyConductor','measureSide'].forEach(id=>$(id)?.addEventListener('change',updateFaultConnectionDiagram));
  $('faultGuidePrev')?.addEventListener('click',()=>stepFaultGuide(-1));$('faultGuideNext')?.addEventListener('click',()=>stepFaultGuide(1));
  $$('#vectorPresets [data-vector]').forEach(b=>b.addEventListener('click',()=>applyVectorPreset(b.dataset.vector)));
  ['tv_hv','tv_hvn','tv_lv','tv_lvn','tv_clock','tr_kva','tr_hv','tr_lv','tr_uk'].forEach(id=>$(id)?.addEventListener(id==='tv_clock'?'input':'change',updateTrafoLab));
  ['tr_kva','tr_hv','tr_lv','tr_uk'].forEach(id=>$(id)?.addEventListener('input',updateTrafoLab));
  ['pa_group','pb_group','pa_lv','pb_lv','pa_uk','pb_uk'].forEach(id=>{$(id)?.addEventListener('input',updateParallelCheck);$(id)?.addEventListener('change',updateParallelCheck);});
  ['tc_group_a','tc_group_b'].forEach(id=>$(id)?.addEventListener('change',updatePhaseSync));
  ['cp_v1','cp_v2','cp_v3','cp_tol'].forEach(id=>$(id)?.addEventListener('input',updateCommissioningProof));$('cp_rotation')?.addEventListener('change',updateCommissioningProof);
  ['hv','lv'].forEach(side=>{const sel=$(`tc_${side}_palette`);if(!sel)return;sel.addEventListener('change',()=>applyCouplerPalette(side,sel.value));['l1','l2','l3'].forEach(k=>$(`tc_${side}_${k}`)?.addEventListener('input',()=>{sel.value='custom';updatePhaseSync();}));});
  $('savePhaseColorsBtn')?.addEventListener('click',savePhaseColorPreference);$('savePhaseSyncBtn')?.addEventListener('click',savePhaseSyncToProject);
  $('saveTrafoBtn')?.addEventListener('click',saveTrafoToProject);
  $('projectForm')?.addEventListener('submit',e=>{e.preventDefault();saveProjectFromForm();});['newProjectTop','newProjectBtn','projectEmptyCreate'].forEach(id=>$(id)?.addEventListener('click',()=>openProjectDialog()));$('dashProjectAction')?.addEventListener('click',()=>{const p=activeProject();p?showView('projects'):openProjectDialog();});$('projectSwitcher')?.addEventListener('change',e=>{state.activeProjectId=e.target.value||null;persist();});
  $('newMeasurementBtn')?.addEventListener('click',openMeasurement);$('measurementForm')?.addEventListener('submit',e=>{e.preventDefault();saveMeasurement();});
  $('printReportBtn')?.addEventListener('click',()=>{if(!activeProject())return toast('Selecteer eerst een project','','warn');window.print();});$('shareReportBtn')?.addEventListener('click',shareReport);
  $('themeToggle')?.addEventListener('click',cycleTheme);$('saveSettingsBtn')?.addEventListener('click',saveSettings);$('exportDataBtn')?.addEventListener('click',exportAll);$('importDataBtn')?.addEventListener('click',()=>$('importDataFile').click());$('importDataFile')?.addEventListener('change',e=>{if(e.target.files[0])importAll(e.target.files[0]);e.target.value='';});$('exportActiveProjectBtn')?.addEventListener('click',()=>{const p=activeProject();p?exportProject(p.id):toast('Geen project geselecteerd','','warn');});$('openPhaseSyncBtn')?.addEventListener('click',()=>{showView('transformers');setTimeout(()=>$('phaseSyncCard').scrollIntoView({behavior:'smooth',block:'start'}),100);});
  $('resetDataBtn')?.addEventListener('click',()=>{if(!confirm('Alle projecten, metingen, geschiedenis en instellingen op dit apparaat wissen?'))return;state=defaultState();persist();applyTheme('dark');initPhaseColorWorkbench();updatePhaseSync();renderAll();toast('Lokale data gewist','','warn');});$('clearHistoryBtn')?.addEventListener('click',()=>{state.history=[];persist();});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('installAppBtn').disabled=false;$('installAppBtn').textContent='Installeer ElektroToolbox';});$('installAppBtn')?.addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('installAppBtn').disabled=true;$('installAppBtn').textContent='Installatie niet beschikbaar';});
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js?v=6.1.1').then(r=>r.update()).catch(()=>{});

  initPhaseColorWorkbench();renderCalculatorGrid();updateUv2();renderFaultGuide();updateFaultConnectionDiagram();updateTrafoLab();updatePhaseSync();updateCommissioningProof();renderAll();
})();

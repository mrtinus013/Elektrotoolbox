(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const $$ = sel => [...document.querySelectorAll(sel)];
  const finePointer = matchMedia('(pointer:fine)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SETTINGS_KEY = 'elektrotoolbox_hyperfield_v6';
  let wakeLock = null;
  let fieldSettings = loadFieldSettings();
  let lastFrame = 0;

  function loadFieldSettings(){
    try{return {...{glove:false,sun:false,focus:false,motion:!reducedMotion},...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return {glove:false,sun:false,focus:false,motion:!reducedMotion}}
  }
  function saveFieldSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(fieldSettings))}catch{}}
  function notify(title,detail=''){
    const wrap=$('toastStack'); if(!wrap) return;
    const el=document.createElement('div');el.className='toast';el.innerHTML=`<span class="toast-icon">✦</span><div><b>${title}</b>${detail?`<small>${detail}</small>`:''}</div>`;wrap.appendChild(el);setTimeout(()=>el.remove(),3200);
    if(navigator.vibrate) navigator.vibrate(12);
  }
  function showView(name){ if(window.ETB_showView) window.ETB_showView(name); else {$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));} }
  function readAppState(){
    for(const key of ['elektrotoolbox_v6','elektrotoolbox_v5']){try{const s=JSON.parse(localStorage.getItem(key));if(s?.projects)return s}catch{}}
    return {projects:[],activeProjectId:null,settings:{}};
  }
  function phaseColors(side='lv'){
    const s=readAppState();const c=s?.settings?.phaseColors?.[side]||{};
    return [c.L1||'#8b5a2b',c.L2||'#1b1d20',c.L3||'#8a9097'];
  }
  function activeProject(){const s=readAppState();return s.projects?.find(p=>p.id===s.activeProjectId)||null;}

  function bootstrapVisualShell(){
    document.title='ElektroToolbox v6 — Hyperfield Edition';
    document.querySelectorAll('.brand small').forEach(x=>x.textContent='v6');
    const body=document.body;
    if(!$('hyperfieldCanvas')){
      const canvas=document.createElement('canvas');canvas.id='hyperfieldCanvas';canvas.setAttribute('aria-hidden','true');body.prepend(canvas);
      const aur=document.createElement('div');aur.className='hf-aurora';aur.setAttribute('aria-hidden','true');body.prepend(aur);
      const grid=document.createElement('div');grid.className='hf-depth-grid';grid.setAttribute('aria-hidden','true');body.prepend(grid);
      const scan=document.createElement('div');scan.className='hf-scanline';scan.setAttribute('aria-hidden','true');body.append(scan);
      initParticleField(canvas);
    }
    applyFieldModes();
    if(finePointer && !reducedMotion){
      window.addEventListener('pointermove',e=>{
        document.documentElement.style.setProperty('--hf-spot-x',`${e.clientX}px`);
        document.documentElement.style.setProperty('--hf-spot-y',`${e.clientY}px`);
      },{passive:true});
    }
  }

  function initParticleField(canvas){
    const ctx=canvas.getContext('2d',{alpha:true}); if(!ctx) return;
    let w=0,h=0,dpr=1,points=[];
    const resize=()=>{dpr=Math.min(devicePixelRatio||1,1.7);w=innerWidth;h=innerHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);const count=Math.max(24,Math.min(70,Math.round(w*h/26000)));points=Array.from({length:count},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.13,vy:(Math.random()-.5)*.13,r:.5+Math.random()*1.1,p:Math.random()*6.28}));};
    resize(); addEventListener('resize',resize,{passive:true});
    function frame(t){
      if(document.hidden){requestAnimationFrame(frame);return}
      ctx.clearRect(0,0,w,h);ctx.save();ctx.globalCompositeOperation='lighter';
      for(const p of points){p.x+=p.vx;p.y+=p.vy;p.p+=.012;if(p.x<0)p.x=w;if(p.x>w)p.x=0;if(p.y<0)p.y=h;if(p.y>h)p.y=0;const a=.12+.08*Math.sin(p.p);ctx.fillStyle=`rgba(101,238,255,${a})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
      for(let i=0;i<points.length;i++){for(let j=i+1;j<points.length;j++){const a=points[i],b=points[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d<115){ctx.strokeStyle=`rgba(94,183,255,${(1-d/115)*.04})`;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}}
      ctx.restore();requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function buildTopControls(){
    const actions=document.querySelector('.top-actions'); if(!actions||actions.querySelector('.hf-controls'))return;
    const box=document.createElement('div');box.className='hf-controls';box.innerHTML=`
      <button class="hf-control" data-hf="glove" title="Glove mode — grotere bediening" aria-label="Glove mode">◫</button>
      <button class="hf-control" data-hf="sun" title="Sunlight mode — hoog contrast" aria-label="Sunlight mode">☀</button>
      <button class="hf-control" data-hf="wake" title="Scherm wakker houden" aria-label="Wake lock">◉</button>
      <button class="hf-control" data-hf="focus" title="Focus mode" aria-label="Focus mode">⌗</button>`;
    actions.insertBefore(box,actions.firstChild);
    box.addEventListener('click',e=>{const b=e.target.closest('[data-hf]');if(b)toggleFieldMode(b.dataset.hf)});
    refreshModeButtons();
  }

  function buildHyperDock(){
    if(document.querySelector('.hf-dock')) return;
    const dock=document.createElement('div');dock.className='hf-dock';dock.innerHTML=`
      <button data-hfdock="lab" title="HyperLab">◈</button><span class="hf-dock-sep"></span>
      <button data-hfdock="glove" title="Glove mode">◫</button>
      <button data-hfdock="sun" title="Sunlight mode">☀</button>
      <button data-hfdock="wake" title="Wake lock">◉</button>
      <button data-hfdock="focus" title="Focus mode">⌗</button>`;
    document.body.append(dock);
    dock.addEventListener('click',e=>{const b=e.target.closest('[data-hfdock]');if(!b)return;const a=b.dataset.hfdock;if(a==='lab')showView('hyperlab');else toggleFieldMode(a)});
    refreshModeButtons();
  }

  async function toggleFieldMode(mode){
    if(mode==='wake'){
      if(wakeLock){try{await wakeLock.release()}catch{} wakeLock=null;notify('Wake Lock uit','Scherm mag weer automatisch uitschakelen.');}
      else if('wakeLock' in navigator){try{wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null;refreshModeButtons()});notify('Wake Lock actief','Scherm blijft wakker zolang de browser dit toestaat.');}catch{notify('Wake Lock niet beschikbaar','Browser of apparaat weigerde de aanvraag.')}}
      else notify('Wake Lock niet ondersteund','Deze browser ondersteunt Screen Wake Lock niet.');
      refreshModeButtons();return;
    }
    if(mode==='glove')fieldSettings.glove=!fieldSettings.glove;
    if(mode==='sun')fieldSettings.sun=!fieldSettings.sun;
    if(mode==='focus')fieldSettings.focus=!fieldSettings.focus;
    if(mode==='motion')fieldSettings.motion=!fieldSettings.motion;
    saveFieldSettings();applyFieldModes();refreshModeButtons();
  }
  function applyFieldModes(){
    document.body.classList.toggle('hf-glove',!!fieldSettings.glove);
    document.body.classList.toggle('hf-sunlight',!!fieldSettings.sun);
    document.body.classList.toggle('hf-focus',!!fieldSettings.focus);
    document.documentElement.classList.toggle('hf-reduced',!fieldSettings.motion);
  }
  function refreshModeButtons(){
    $$('[data-hf="glove"],[data-hfdock="glove"]').forEach(b=>b.classList.toggle('active',!!fieldSettings.glove));
    $$('[data-hf="sun"],[data-hfdock="sun"]').forEach(b=>b.classList.toggle('active',!!fieldSettings.sun));
    $$('[data-hf="focus"],[data-hfdock="focus"]').forEach(b=>b.classList.toggle('active',!!fieldSettings.focus));
    $$('[data-hf="wake"],[data-hfdock="wake"]').forEach(b=>b.classList.toggle('active',!!wakeLock));
    $$('[data-hf-toggle="motion"]').forEach(b=>b.classList.toggle('active',!!fieldSettings.motion));
  }
  document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&wakeLock&&'wakeLock'in navigator){try{wakeLock=await navigator.wakeLock.request('screen');refreshModeButtons()}catch{}}});

  function installHyperLabNav(){
    if(!document.querySelector('[data-view="hyperlab"]')){
      const nav=document.querySelector('.nav-stack');const settings=nav?.querySelector('[data-view="settings"]');
      const btn=document.createElement('button');btn.className='nav-item';btn.dataset.view='hyperlab';btn.innerHTML='<span>◈</span><b>HyperLab</b>';btn.addEventListener('click',()=>showView('hyperlab'));nav?.insertBefore(btn,settings||null);
    }
    const grid=$('commandGrid');if(grid&&!grid.querySelector('[data-command-view="hyperlab"]')){
      const btn=document.createElement('button');btn.dataset.commandView='hyperlab';btn.innerHTML='<span>◈</span><div><b>HyperLab</b><small>Phase Reactor & TDR Pulse Studio</small></div>';btn.addEventListener('click',()=>{document.getElementById('commandDialog')?.close();showView('hyperlab')});grid.prepend(btn);
    }
  }

  function installHyperLab(){
    if($('view-hyperlab'))return;
    const settings=$('view-settings');if(!settings)return;
    const sec=document.createElement('section');sec.className='view';sec.id='view-hyperlab';sec.innerHTML=`
      <div class="page-head"><div><span class="eyebrow">HYPERFIELD SYSTEMS</span><h1>HyperLab</h1><p>Interactieve signaal- en fasevisualisatie voor veldanalyse, uitleg en voorbereiding.</p></div><div class="head-actions"><button class="btn btn-secondary" id="hfMotionBtn">Motion: cinematic</button><button class="btn btn-primary" id="hfFullLab">Immersive</button></div></div>
      <section class="card hf-lab-hero hf-immersive" id="hfHeroLab">
        <div class="hf-lab-copy"><span class="micro-label">LIVE ELECTRICAL VISUAL CORE</span><h2>Zie wat normaal onzichtbaar blijft.</h2><p>HyperLab visualiseert fasehoeken, golfvormen en TDR-timing. De beweging is bewust vertraagd voor leesbaarheid en is geen realtime meetinstrument.</p><div class="hf-kpi-row"><div class="hf-kpi"><small>Netfrequentie</small><b id="hfHeroHz">50 Hz</b></div><div class="hf-kpi"><small>Fasevolgorde</small><b id="hfHeroSeq">L1 → L2 → L3</b></div><div class="hf-kpi"><small>Visual mode</small><b>× 0,002</b></div></div></div>
        <div class="hf-reactor-shell"><canvas id="hfReactor"></canvas><div class="hf-reactor-center"><b>3φ</b><small>REACTOR</small></div></div>
      </section>
      <div class="hf-lab-grid">
        <section class="card section-card hf-scope-card hf-immersive"><div class="section-card-head"><div><span class="micro-label">WAVESCOPE</span><h2>Driefasen-golfvorm</h2><p class="muted">Conceptuele sinusvisualisatie met 120° faseverschuiving.</p></div><span class="result-badge" id="hfScopeBadge">50 Hz · ABC</span></div><div class="hf-canvas-shell"><canvas id="hfWaveCanvas"></canvas></div><div class="hf-lab-controls"><label class="hf-lab-control"><span>Frequentie</span><select id="hfFreq"><option value="50">50 Hz</option><option value="60">60 Hz</option></select></label><label class="hf-lab-control"><span>Fasevolgorde</span><select id="hfSeq"><option value="abc">L1 → L2 → L3</option><option value="acb">L1 → L3 → L2</option></select></label><label class="hf-lab-control"><span>Amplitude</span><input id="hfAmp" type="range" min="35" max="95" value="70"></label><label class="hf-lab-control"><span>Timebase</span><input id="hfTimebase" type="range" min="1" max="5" value="2"></label></div></section>
        <section class="card section-card hf-tdr-card hf-immersive"><div class="section-card-head"><div><span class="micro-label">TDR PULSE STUDIO</span><h2>Reflectie visualizer</h2><p class="muted">Visualiseer puls, reflectie en rondlooptijd met jouw snelheid.</p></div><span class="result-badge" id="hfTdrBadge">— µs</span></div><div class="hf-canvas-shell"><canvas id="hfTdrCanvas"></canvas></div><div class="hf-lab-controls"><label class="hf-lab-control"><span>Kabellengte</span><div class="input-unit"><input id="hfCableLength" type="number" value="800" min="1" step="1"><em>m</em></div></label><label class="hf-lab-control"><span>Reflectieafstand</span><div class="input-unit"><input id="hfFaultDistance" type="number" value="320" min="0" step="1"><em>m</em></div></label><label class="hf-lab-control"><span>Snelheid</span><div class="input-unit"><input id="hfVelocity" type="number" value="160" min="1" step="1"><em>m/µs</em></div></label></div><div class="hf-reflection-select" id="hfReflection"><button class="active" data-ref="open">Open einde / breuk</button><button data-ref="short">Kortsluiting</button><button data-ref="soft">Impedantie-afwijking</button></div><div class="hf-kpi-row"><div class="hf-kpi"><small>Rondlooptijd</small><b id="hfRoundTrip">4,00 µs</b></div><div class="hf-kpi"><small>Positie</small><b id="hfTdrPercent">40,0%</b></div><div class="hf-kpi"><small>Reflectie</small><b id="hfReflectionText">Positief</b></div></div></section>
        <section class="card section-card hf-field-card"><div class="section-card-head"><div><span class="micro-label">FIELD CONSOLE</span><h2>Werkmodus</h2><p class="muted">Pas de interface aan de omgeving aan.</p></div></div><div class="hf-field-console"><div class="hf-field-row"><span>◫</span><div><b>Glove Mode</b><small>Grotere knoppen en invoervelden.</small></div><button class="hf-switch" data-hf-toggle="glove"><i></i></button></div><div class="hf-field-row"><span>☀</span><div><b>Sunlight Mode</b><small>Hoog contrast voor buitengebruik.</small></div><button class="hf-switch" data-hf-toggle="sun"><i></i></button></div><div class="hf-field-row"><span>◉</span><div><b>Wake Lock</b><small>Houd het scherm actief tijdens meten.</small></div><button class="hf-switch" data-hf-toggle="wake"><i></i></button></div><div class="hf-field-row"><span>⌗</span><div><b>Focus Mode</b><small>Verberg afleiding en vergroot werkruimte.</small></div><button class="hf-switch" data-hf-toggle="focus"><i></i></button></div><div class="hf-field-row"><span>≈</span><div><b>Cinematic Motion</b><small>Schakel animaties centraal aan of uit.</small></div><button class="hf-switch" data-hf-toggle="motion"><i></i></button></div></div></section>
        <section class="card section-card hf-sequence-card"><div class="section-card-head"><div><span class="micro-label">SEQUENCESCOPE</span><h2>Fasevolgorde & fasoren</h2><p class="muted">Een interactieve vectorklok die jouw fasekleuren gebruikt.</p></div><span class="result-badge" id="hfSeqBadge">ABC</span></div><div class="hf-sequence-stage"><div class="hf-seq-orbit"><canvas id="hfSequenceCanvas"></canvas></div><div class="hf-seq-info" id="hfSequenceInfo"></div></div></section>
      </div>`;
    settings.parentNode.insertBefore(sec,settings);
    bindHyperLab();
  }

  function bindHyperLab(){
    ['hfFreq','hfSeq','hfAmp','hfTimebase','hfCableLength','hfFaultDistance','hfVelocity'].forEach(id=>$(id)?.addEventListener('input',updateHyperLab));
    $('hfSeq')?.addEventListener('change',updateHyperLab);$('hfFreq')?.addEventListener('change',updateHyperLab);
    $('hfReflection')?.addEventListener('click',e=>{const b=e.target.closest('[data-ref]');if(!b)return;$$('#hfReflection button').forEach(x=>x.classList.toggle('active',x===b));updateHyperLab()});
    $$('[data-hf-toggle]').forEach(b=>b.addEventListener('click',()=>toggleFieldMode(b.dataset.hfToggle).then(()=>updateFieldConsole())));
    $('hfMotionBtn')?.addEventListener('click',()=>toggleFieldMode('motion').then(()=>{updateFieldConsole();$('hfMotionBtn').textContent=`Motion: ${fieldSettings.motion?'cinematic':'reduced'}`}));
    $('hfFullLab')?.addEventListener('click',()=>fullscreen($('view-hyperlab')));
    $('hfMotionBtn').textContent=`Motion: ${fieldSettings.motion?'cinematic':'reduced'}`;
    updateFieldConsole();updateHyperLab();
    initLabAnimation();
  }
  function updateFieldConsole(){
    $$('[data-hf-toggle="glove"]').forEach(b=>b.classList.toggle('active',!!fieldSettings.glove));
    $$('[data-hf-toggle="sun"]').forEach(b=>b.classList.toggle('active',!!fieldSettings.sun));
    $$('[data-hf-toggle="focus"]').forEach(b=>b.classList.toggle('active',!!fieldSettings.focus));
    $$('[data-hf-toggle="motion"]').forEach(b=>b.classList.toggle('active',!!fieldSettings.motion));
    $$('[data-hf-toggle="wake"]').forEach(b=>b.classList.toggle('active',!!wakeLock));
    refreshModeButtons();
  }

  function sizeCanvas(canvas){
    if(!canvas)return null;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w:rect.width,h:rect.height,dpr};
  }
  function drawGrid(ctx,w,h,step=36){ctx.save();ctx.strokeStyle='rgba(103,239,255,.045)';ctx.lineWidth=1;for(let x=0;x<w;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}ctx.restore();}
  function hexToRgba(hex,a){const x=hex.replace('#','');const n=parseInt(x.length===3?x.split('').map(c=>c+c).join(''):x,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}

  function hyperValues(){
    return {freq:Number($('hfFreq')?.value||50),seq:$('hfSeq')?.value||'abc',amp:Number($('hfAmp')?.value||70),timebase:Number($('hfTimebase')?.value||2),colors:phaseColors('lv')};
  }
  function updateHyperLab(){
    const v=hyperValues();if($('hfHeroHz'))$('hfHeroHz').textContent=`${v.freq} Hz`;if($('hfHeroSeq'))$('hfHeroSeq').textContent=v.seq==='abc'?'L1 → L2 → L3':'L1 → L3 → L2';if($('hfScopeBadge'))$('hfScopeBadge').textContent=`${v.freq} Hz · ${v.seq.toUpperCase()}`;if($('hfSeqBadge'))$('hfSeqBadge').textContent=v.seq.toUpperCase();
    updateTdr();updateSequenceInfo();
  }
  function updateSequenceInfo(){const v=hyperValues();const labels=v.seq==='abc'?['0°','−120°','+120°']:['0°','+120°','−120°'];const box=$('hfSequenceInfo');if(box)box.innerHTML=['L1','L2','L3'].map((p,i)=>`<div class="hf-phase-pill"><i style="--p:${v.colors[i]}"></i><b>${p}</b><small>${labels[i]} · ${v.colors[i].toUpperCase()}</small></div>`).join('')+`<p class="micro-note">De rotatie is visueel vertraagd. Gebruik een geschikt fasevolgordemeetinstrument voor verificatie in het veld.</p>`;}
  function tdrValues(){const length=Math.max(1,Number($('hfCableLength')?.value||800)),dist=Math.max(0,Math.min(length,Number($('hfFaultDistance')?.value||320))),vel=Math.max(.1,Number($('hfVelocity')?.value||160)),ref=document.querySelector('#hfReflection button.active')?.dataset.ref||'open';return {length,dist,vel,ref,time:2*dist/vel,pct:dist/length*100};}
  function updateTdr(){const v=tdrValues();if($('hfRoundTrip'))$('hfRoundTrip').textContent=`${v.time.toLocaleString('nl-NL',{maximumFractionDigits:3})} µs`;if($('hfTdrBadge'))$('hfTdrBadge').textContent=`${v.time.toLocaleString('nl-NL',{maximumFractionDigits:3})} µs`;if($('hfTdrPercent'))$('hfTdrPercent').textContent=`${v.pct.toLocaleString('nl-NL',{maximumFractionDigits:1})}%`;if($('hfReflectionText'))$('hfReflectionText').textContent=v.ref==='open'?'Positief':v.ref==='short'?'Negatief':'Gedeeltelijk';drawTdr();}

  function initLabAnimation(){
    let t0=performance.now();
    function loop(t){if(document.hidden){requestAnimationFrame(loop);return}const dt=Math.min(.05,(t-t0)/1000);t0=t;lastFrame+=dt*(fieldSettings.motion?1:0);drawReactor(lastFrame);drawWaveScope(lastFrame);drawSequence(lastFrame);requestAnimationFrame(loop)}requestAnimationFrame(loop);
  }
  function drawReactor(t){const c=$('hfReactor');const s=sizeCanvas(c);if(!s)return;const {ctx,w,h}=s;ctx.clearRect(0,0,w,h);const colors=phaseColors('lv'),cx=w/2,cy=h/2,r=Math.min(w,h)*.34;ctx.save();ctx.globalCompositeOperation='lighter';for(let ring=0;ring<4;ring++){ctx.strokeStyle=`rgba(${100+ring*10},${190+ring*8},255,${.045+ring*.018})`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(cx,cy,r*(.45+ring*.18),r*(.2+ring*.08),t*(ring%2?-.12:.1),0,Math.PI*2);ctx.stroke()}colors.forEach((col,i)=>{const a=t*.32+i*Math.PI*2/3;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.52;ctx.shadowColor=col;ctx.shadowBlur=22;ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle=hexToRgba(col,.26);ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke()});ctx.restore();}
  function drawWaveScope(t){const c=$('hfWaveCanvas'),s=sizeCanvas(c);if(!s)return;const {ctx,w,h}=s,v=hyperValues();ctx.clearRect(0,0,w,h);drawGrid(ctx,w,h,36);const mid=h/2,amp=Math.min(h*.38,v.amp/100*h*.42),phaseSign=v.seq==='abc'?1:-1,colors=v.colors;ctx.save();ctx.strokeStyle='rgba(130,229,255,.09)';ctx.beginPath();ctx.moveTo(0,mid);ctx.lineTo(w,mid);ctx.stroke();colors.forEach((col,i)=>{ctx.strokeStyle=col;ctx.shadowColor=col;ctx.shadowBlur=7;ctx.lineWidth=2;ctx.beginPath();for(let x=0;x<=w;x+=2){const theta=(x/w)*Math.PI*2*v.timebase + t*.75 + phaseSign*i*Math.PI*2/3;const y=mid-Math.sin(theta)*amp*.72;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke()});ctx.restore();}
  function drawSequence(t){const c=$('hfSequenceCanvas'),s=sizeCanvas(c);if(!s)return;const {ctx,w,h}=s,v=hyperValues();ctx.clearRect(0,0,w,h);const cx=w/2,cy=h/2,r=Math.min(w,h)*.34;ctx.save();ctx.strokeStyle='rgba(110,235,255,.09)';ctx.lineWidth=1;[.35,.68,1].forEach(f=>{ctx.beginPath();ctx.arc(cx,cy,r*f,0,Math.PI*2);ctx.stroke()});for(let k=0;k<12;k++){const a=-Math.PI/2+k*Math.PI/6;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.88,cy+Math.sin(a)*r*.88);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke()};const sign=v.seq==='abc'?1:-1;v.colors.forEach((col,i)=>{const a=-Math.PI/2+t*.22+sign*i*Math.PI*2/3,x=cx+Math.cos(a)*r*.82,y=cy+Math.sin(a)*r*.82;ctx.strokeStyle=col;ctx.shadowColor=col;ctx.shadowBlur=14;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#dffcff';ctx.font='700 12px system-ui';ctx.fillText(`L${i+1}`,x+8,y-7)});ctx.restore();}
  function drawTdr(){const c=$('hfTdrCanvas'),s=sizeCanvas(c);if(!s)return;const {ctx,w,h}=s,v=tdrValues();ctx.clearRect(0,0,w,h);drawGrid(ctx,w,h,36);const y=h*.58,left=30,right=w-22,use=right-left,px=left+use*v.pct/100;ctx.save();ctx.strokeStyle='rgba(113,235,255,.24)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.strokeStyle='rgba(103,247,255,.75)';ctx.shadowColor='#67f7ff';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+12,y);ctx.lineTo(left+18,y-45);ctx.lineTo(left+24,y+10);ctx.lineTo(left+30,y);ctx.lineTo(px-14,y);ctx.stroke();const sign=v.ref==='short'?-1:1,scale=v.ref==='soft'?.45:1;ctx.strokeStyle=v.ref==='short'?'#ff6d86':'#a76cff';ctx.shadowColor=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(px-14,y);ctx.lineTo(px-5,y);ctx.lineTo(px,y-sign*50*scale);ctx.lineTo(px+6,y+sign*12*scale);ctx.lineTo(px+13,y);ctx.lineTo(right,y);ctx.stroke();ctx.shadowBlur=0;ctx.setLineDash([4,5]);ctx.strokeStyle='rgba(255,255,255,.20)';ctx.beginPath();ctx.moveTo(px,28);ctx.lineTo(px,h-22);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#dffcff';ctx.font='700 12px system-ui';ctx.fillText(`${Math.round(v.dist)} m`,Math.min(px+8,w-70),36);ctx.fillStyle='rgba(164,202,216,.8)';ctx.font='11px system-ui';ctx.fillText('injectie',left, h-16);ctx.fillText('kabeleinde',Math.max(left,right-54),h-16);ctx.restore();}

  function augmentDashboard(){
    const hero=document.querySelector('.hero-dashboard');if(!hero||hero.querySelector('.hf-mini-reactor'))return;
    const reactor=document.createElement('div');reactor.className='hf-mini-reactor';reactor.innerHTML='<canvas id="hfMiniReactor"></canvas><div class="hf-mini-reactor-core"><b>LIVE</b><small>FIELD CORE</small></div>';const score=hero.querySelector('.project-score');hero.insertBefore(reactor,score||null);
    const first=hero.firstElementChild;if(first){const ready=document.createElement('div');ready.className='hf-readiness';ready.id='hfReadiness';first.append(ready);updateReadiness();}
    let t=0;function mini(){const c=$('hfMiniReactor'),s=sizeCanvas(c);if(!s)return requestAnimationFrame(mini);const {ctx,w,h}=s,colors=phaseColors('lv'),cx=w/2,cy=h/2,r=Math.min(w,h)*.39;ctx.clearRect(0,0,w,h);ctx.save();ctx.strokeStyle='rgba(103,247,255,.08)';ctx.setLineDash([4,7]);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);colors.forEach((col,i)=>{const a=t+i*2*Math.PI/3,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;ctx.strokeStyle=hexToRgba(col,.32);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0});ctx.restore();if(fieldSettings.motion)t+=.006;requestAnimationFrame(mini)}requestAnimationFrame(mini);
    setInterval(updateReadiness,2500);
  }
  function updateReadiness(){const box=$('hfReadiness');if(!box)return;const p=activeProject();let pct=0,label='Geen actief project';if(p){const meta=[p.name,p.client,p.reference,p.location,p.asset,p.technician].filter(Boolean).length;pct=Math.min(100,Math.round(meta/6*35 + Math.min(35,(p.entries?.length||0)*10) + Math.min(20,(p.measurements?.length||0)*7) + (p.note?10:0)));label=pct>=80?'Dossier sterk gevuld':pct>=45?'Dossier in opbouw':'Basisgegevens aanvullen';}box.innerHTML=`<div><b>${pct}%</b><span> dossiergereedheid</span></div><div class="hf-readiness-meter"><i style="--p:${pct}%"></i></div><span>${label}</span>`;}


  function installCableTwin(){
    const card=document.querySelector('.cable-card');if(!card||$('hfCableTwin'))return;
    const wrap=document.createElement('div');wrap.className='hf-cable-twin';wrap.innerHTML='<span class="hf-cable-twin-badge" id="hfCableTwinBadge">Geen resultaat</span><canvas id="hfCableTwin"></canvas>';
    const kpis=card.querySelector('.fault-kpis');card.insertBefore(wrap,kpis||null);
    const pct=$('faultPercent');if(pct)new MutationObserver(drawCableTwin).observe(pct,{childList:true,subtree:true,characterData:true});
    addEventListener('resize',drawCableTwin,{passive:true});drawCableTwin();
  }
  function faultPercentValue(){const t=$('faultPercent')?.textContent||'';const m=t.replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?Math.max(0,Math.min(100,Number(m[0]))):null;}
  function drawCableTwin(){
    const c=$('hfCableTwin'),s=sizeCanvas(c);if(!s)return;const {ctx,w,h}=s,pct=faultPercentValue();ctx.clearRect(0,0,w,h);
    const y=h*.57,x1=28,x2=w-28,depth=Math.min(28,h*.14);ctx.save();
    const grad=ctx.createLinearGradient(x1,0,x2,0);grad.addColorStop(0,'rgba(52,104,140,.45)');grad.addColorStop(.5,'rgba(92,176,203,.16)');grad.addColorStop(1,'rgba(52,104,140,.45)');
    for(let layer=4;layer>=0;layer--){const yy=y-layer*2,hh=16+layer*5;ctx.strokeStyle=layer===0?'rgba(108,239,255,.34)':'rgba(106,184,214,.07)';ctx.lineWidth=layer===0?1.5:1;ctx.fillStyle=layer===0?'rgba(8,32,49,.78)':grad;ctx.beginPath();ctx.rect(x1+layer*3,yy-hh/2,x2-x1-layer*6,hh);ctx.fill();ctx.stroke()}
    const phases=phaseColors('lv');phases.forEach((col,i)=>{const yy=y+(i-1)*9;ctx.strokeStyle=col;ctx.shadowColor=col;ctx.shadowBlur=7;ctx.lineWidth=2.3;ctx.beginPath();ctx.moveTo(x1+14,yy);ctx.bezierCurveTo(w*.35,yy-3,w*.65,yy+3,x2-14,yy);ctx.stroke()});ctx.shadowBlur=0;
    for(let i=0;i<18;i++){const x=x1+(x2-x1)*i/17;ctx.strokeStyle='rgba(121,226,255,.055)';ctx.beginPath();ctx.moveTo(x,y-depth);ctx.lineTo(x,y+depth);ctx.stroke()}
    if(pct!=null){const fx=x1+(x2-x1)*pct/100;ctx.strokeStyle='rgba(255,103,207,.36)';ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(fx,22);ctx.lineTo(fx,h-22);ctx.stroke();ctx.setLineDash([]);const rg=ctx.createRadialGradient(fx,y,2,fx,y,34);rg.addColorStop(0,'rgba(255,255,255,.95)');rg.addColorStop(.16,'rgba(255,103,207,.82)');rg.addColorStop(1,'rgba(255,103,207,0)');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(fx,y,34,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff9bdd';ctx.font='800 12px system-ui';ctx.fillText(`${pct.toLocaleString('nl-NL',{maximumFractionDigits:1})}%`,Math.min(fx+8,w-58),34);$('hfCableTwinBadge').textContent=`Fout @ ${pct.toLocaleString('nl-NL',{maximumFractionDigits:1})}%`; } else $('hfCableTwinBadge').textContent='Geen resultaat';
    ctx.fillStyle='rgba(151,190,204,.72)';ctx.font='700 10px system-ui';ctx.fillText('ZIJDE A',x1,h-15);ctx.textAlign='right';ctx.fillText('ZIJDE B',x2,h-15);ctx.restore();
  }

  function addImmersiveButtons(){
    const targets=['phaseSyncCard','faultConnectionDiagram'];targets.forEach(id=>{const el=$(id);if(!el||el.querySelector(':scope > .hf-immersive-btn'))return;el.classList.add('hf-immersive');const b=document.createElement('button');b.className='hf-immersive-btn';b.type='button';b.title='Volledig scherm';b.setAttribute('aria-label','Volledig scherm');b.textContent='⛶';b.addEventListener('click',()=>fullscreen(el));el.append(b)});
    document.querySelectorAll('.clock-card,.winding-card').forEach(el=>{if(el.querySelector(':scope > .hf-immersive-btn'))return;el.classList.add('hf-immersive');const b=document.createElement('button');b.className='hf-immersive-btn';b.type='button';b.title='Volledig scherm';b.textContent='⛶';b.addEventListener('click',()=>fullscreen(el));el.append(b)});
  }
  function fullscreen(el){if(!el)return;if(document.fullscreenElement){document.exitFullscreen?.();return}{const req=el.requestFullscreen?.(); if(req&&typeof req.catch==='function') req.catch(()=>notify('Fullscreen niet beschikbaar','Gebruik de browserweergave om verder in te zoomen.')); else if(!el.requestFullscreen) notify('Fullscreen niet beschikbaar','Gebruik de browserweergave om verder in te zoomen.');}}

  function enableTilt(){if(!finePointer||reducedMotion)return;const cards=$$('.card').filter(c=>!c.closest('dialog')&&!c.classList.contains('report-paper'));cards.forEach(card=>{if(card.dataset.hfTilt)return;card.dataset.hfTilt='1';card.classList.add('hf-tilt');card.addEventListener('pointermove',e=>{if(innerWidth<900||fieldSettings.sun)return;const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height,rx=(.5-y)*2.2,ry=(x-.5)*2.8;card.style.setProperty('--card-x',`${x*100}%`);card.style.setProperty('--card-y',`${y*100}%`);card.style.transform=`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-1px)`});card.addEventListener('pointerleave',()=>{card.style.transform='';card.style.removeProperty('--card-x');card.style.removeProperty('--card-y')})})}

  function addHapticUI(){document.addEventListener('click',e=>{if(!navigator.vibrate)return;const b=e.target.closest('button,.chip,.nav-item');if(b&&!b.disabled)navigator.vibrate(5)},{passive:true});}

  function updateVersionSurfaces(){
    document.querySelectorAll('.report-footer').forEach(el=>el.innerHTML=el.innerHTML.replace(/ElektroToolbox v\d+/g,'ElektroToolbox v6 · Hyperfield'));
    const foot=document.querySelector('.command-foot span:last-child');if(foot)foot.textContent='ElektroToolbox v6 · Hyperfield';
  }

  function start(){
    try{
      bootstrapVisualShell();buildTopControls();buildHyperDock();installHyperLab();installHyperLabNav();augmentDashboard();installCableTwin();addImmersiveButtons();enableTilt();addHapticUI();updateVersionSurfaces();
      const observer=new MutationObserver(()=>{try{addImmersiveButtons();enableTilt();updateReadiness()}catch(e){console.warn('Hyperfield observer',e)}});const main=$('mainPanel');if(main)observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
      addEventListener('resize',()=>{try{drawTdr();updateReadiness()}catch(e){}},{passive:true});
      document.documentElement.classList.add('hf-ready');
      notify('Hyperfield online','v6.1 visual core en veldmodi zijn geladen.');
    }catch(e){
      console.error('Hyperfield kon niet volledig starten',e);
      document.documentElement.classList.add('hf-fallback');
      // De kernapp blijft bruikbaar als een visueel extra onderdeel faalt.
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

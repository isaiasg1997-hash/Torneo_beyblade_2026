// Lógica completa: formularios, creación de rondas, avance 16->8, final 8A vs 8B, export PNG/JSON/PDF
// --- Modificado para soporte de imágenes por Isaias --- 

// --- Utilidades ---
function qs(id){return document.getElementById(id)}

// --- Inyección mínima de CSS necesaria para los avatares circulares (no editamos tu style.css) ---
(function injectAvatarCSS(){
  const css = `
  .player-card { display:flex; flex-direction:column; align-items:center; gap:6px; }
  .avatar {
    width:64px; height:64px; border-radius:50%; object-fit:cover; border:3px solid rgba(255,255,255,0.12);
    box-shadow: 0 0 8px rgba(0,0,0,0.4); background: rgba(255,255,255,0.05);
  }
  .player-name { font-size:0.95rem; font-weight:700; color:inherit; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; max-width:120px; text-align:center; }
  .form-preview { width:40px; height:40px; border-radius:6px; object-fit:cover; margin-left:8px; display:inline-block; vertical-align:middle; }
  .form-row { display:flex; align-items:center; gap:8px; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

// --- Map para guardar dataURLs de las imágenes seleccionadas (temporal mientras el usuario no exporta/reload) ---
const imagesMap = {}; // key: inputId  -> value: dataURL

// --- Generar inputs en formularios (ahora con campo file y preview) ---
function generarInputs(){
  ['A','B'].forEach(lado=>{
    const form = qs(`form${lado}`);
    for(let i=1;i<=16;i++){
      const row = document.createElement('div'); row.className='form-row';

      const input = document.createElement('input');
      input.placeholder = `${lado}${i}`; input.id=`${lado}-${i}`; input.name=`${lado}-${i}`;
      input.style.flex='0 0 160px';

      const file = document.createElement('input');
      file.type='file'; file.accept='image/*'; file.id=`${lado}-img-${i}`; file.name=`${lado}-img-${i}`;

      const prev = document.createElement('img'); prev.className='form-preview'; prev.alt='preview'; prev.src='';

      row.appendChild(input); row.appendChild(file); row.appendChild(prev);
      form.appendChild(row);

      file.addEventListener('change', ev=>{
        const f = ev.target.files && ev.target.files[0];
        if(!f){ delete imagesMap[file.id]; prev.src=''; return; }
        const reader = new FileReader();
        reader.onload = e=>{ imagesMap[file.id]=e.target.result; prev.src=e.target.result }
        reader.readAsDataURL(f);
      });
    }
  });
}

generarInputs();


// Estado global (ahora guardaremos objetos {name,img} en A y B)
let estado = { A:[], B:[], clasificadosA:[], clasificadosB:[], finalA:[], finalB:[] };


// --- Helpers para compatibilidad con strings u objetos ---
function getPlayerName(p){
  if(!p) return '';
  return (typeof p === 'string') ? p : (p.name || '');
}
function getPlayerImg(p){
  if(!p) return null;
  return (typeof p === 'string') ? null : (p.img || null);
}

// Crea el DOM de un jugador con avatar circular + nombre debajo
function createPlayerElement(playerData){
  const name = (typeof playerData==='string') ? playerData : (playerData.name||'---');
  const imgSrc = (typeof playerData==='string') ? null : playerData.img;

  const wrapper = document.createElement('div');
  wrapper.className='bracket-player';
  wrapper._player = (typeof playerData==='string') ? {name:playerData,img:null} : playerData;

  const avatar = document.createElement('div'); avatar.className='bracket-avatar';
  const img = document.createElement('img'); img.alt=name;
  if(imgSrc) img.src=imgSrc;
  else{
    const letter = name.charAt(0).toUpperCase() || '?';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%' height='100%' fill='#222'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Orbitron, sans-serif' font-size='100' fill='#fff'>${letter}</text></svg>`;
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }
  avatar.appendChild(img);

  const pname = document.createElement('div'); pname.className='bracket-name'; pname.textContent=name;

  wrapper.appendChild(avatar); wrapper.appendChild(pname);

  return wrapper;
}

// --- Crear torneos iniciales ---
function crearTorneosDesdeForm(){
  estado.A=[]; estado.B=[];
  for(let i=1;i<=16;i++){
    estado.A.push({ name: qs(`A-${i}`).value.trim()||`Jugador A${i}`, img: imagesMap[`A-img-${i}`]||null });
    estado.B.push({ name: qs(`B-${i}`).value.trim()||`Jugador B${i}`, img: imagesMap[`B-img-${i}`]||null });
  }
  crearFase('A-ronda1', estado.A, ganadores=>{ estado.clasificadosA=ganadores; renderClasificadosA(); });
  crearFase('B-ronda1', estado.B, ganadores=>{ estado.clasificadosB=ganadores; renderClasificadosB(); });
}

// Crear fase: recibe id de contenedor, arreglo jugadores (par), callback cuando termine con ganadores
// ahora acepta jugadores que sean strings o objetos {name,img}
function crearFase(contenedorId, jugadores, onFinish){
  const cont = qs(contenedorId); cont.innerHTML='';
  const ganadores=[];
  const arr = [...jugadores]; if(arr.length%2!==0) arr.push({name:'---',img:null});

  for(let i=0;i<arr.length;i+=2){
    const match = document.createElement('div'); match.className='match';
    const p1 = createPlayerElement(arr[i]); const p2=createPlayerElement(arr[i+1]);
    match.appendChild(p1); match.appendChild(p2);

    [p1,p2].forEach(p=>{
      p.addEventListener('click', ()=>{
        if(p.classList.contains('perdedor') || p.classList.contains('selected')) return;
        const otro = p===p1? p2: p1;

        const avatar = p.querySelector('.bracket-avatar');
        const avatarOtro = otro.querySelector('.bracket-avatar');

        // Colores neón futuristas
        avatar.style.boxShadow = '0 0 20px 6px rgba(0,255,0,0.85), 0 0 30px 10px rgba(0,255,0,0.45)'; // verde ganador
        avatarOtro.style.boxShadow = '0 0 20px 6px rgba(255,0,0,0.85), 0 0 30px 10px rgba(255,0,0,0.45)'; // rojo perdedor

        // Animación de parpadeo
        avatar.style.animation = 'neonPulseGreen 1s infinite alternate';
        avatarOtro.style.animation = 'neonPulseRed 1s infinite alternate';

        p.classList.add('selected','rayos');
        otro.classList.add('perdedor');

        // --- NUEVO: X de perdedor ---
        const xDiv = document.createElement('div');
        xDiv.textContent = '✖';
        xDiv.className = 'loser-x';
        avatarOtro.appendChild(xDiv);

        p.style.pointerEvents = 'none';
        otro.style.pointerEvents = 'none';

        ganadores.push(p._player);
        if(ganadores.length===Math.ceil(arr.length/2)) setTimeout(()=>onFinish(ganadores.slice()),200);
      });
    });



    cont.appendChild(match);
  }
}

(function injectLoserXCSS(){
  const css = `
  .loser-x {
    position:absolute;
    top:67%; left:56%;
    transform: translate(-50%, -50%) scale(0);
    color: #ff0033; /* rojo futurista */
    font-size: 3rem;
    text-shadow: 0 0 8px #ff0033, 0 0 16px #ff0033, 0 0 24px #ff3399;
    animation: showLoserX 0.6s forwards;
    pointer-events:none;
  }

  @keyframes showLoserX {
    0% { transform: translate(-50%, -50%) scale(0); opacity:0; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity:1; }
    100% { transform: translate(-50%, -50%) scale(1); opacity:1; }
  }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

function renderClasificadosA(){
  crearFase('F-A-1', estado.clasificadosA, gan1=>{
    crearFase('F-A-2', gan1, gan2=>{
      crearFase('F-A-3', gan2, gan3=>{
        setSuperSlot('super1', gan3[0]||{name:'Ganador A',img:null}); tryActivarSuperFinal();
      });
    });
  });
}



/* ============================================================
   LADO B INVERTIDO → desde la DERECHA hacia la IZQUIERDA
   ============================================================ */

function renderClasificadosB(){
  crearFase('F-B-1', estado.clasificadosB, gan1=>{
    crearFase('F-B-2', gan1, gan2=>{
      crearFase('F-B-3', gan2, gan3=>{
        setSuperSlot('super2', gan3[0]||{name:'Ganador B',img:null}); tryActivarSuperFinal();
      });
    });
  });
}


// Coloca un jugador (obj) en el slot de superfinal (id: 'super1' o 'super2')
function setSuperSlot(id, playerObj){
  const el = qs(id); el.innerHTML='';
  const node = createPlayerElement(playerObj);
  node.classList.add('super-slot'); el.appendChild(node); el._player=playerObj;
}

// --- Superfinal activation: si ambos slots tienen jugadores, añadimos listeners ---
function tryActivarSuperFinal(){
  const s1 = qs('super1')._player; const s2=qs('super2')._player;
  if(s1 && s2 && s1.name!=='Ganador A' && s2.name!=='Ganador B') activarSuperFinal();
}

function activarSuperFinal(){
  const slot1 = qs('super1'); const slot2=qs('super2');
  [slot1, slot2].forEach(s=>{
    s.addEventListener('click', ()=>{
      s.classList.add('selected'); efectoTruenos();
      const ganador = s._player.name; qs('superGanador').textContent=`🏆 Campeón Nacional: ${ganador} 🏆`;
      const box = qs('superGanador'); box.classList.remove("anim-ganador"); void box.offsetWidth; box.classList.add("anim-ganador");
    });
  });
}


// --- Efectos truenos (no modificado) ---
function efectoTruenos(){
  const cont = document.createElement('div'); cont.className='truenos'; document.body.appendChild(cont);
  for(let i=0;i<20;i++){
    const ch = document.createElement('div'); ch.className='chispa';
    ch.style.left=`${Math.random()*100}%`; ch.style.top=`${Math.random()*100}%`;
    ch.style.animationDelay=`${Math.random()}s`; cont.appendChild(ch);
  }
  const flash=document.createElement('div'); flash.className='flash'; document.body.appendChild(flash);
  setTimeout(()=>{cont.remove(); flash.remove();},2000);
}

// --- Exportaciones ---
// --- Export / Reset ---
function exportJSON(){ const data=JSON.stringify(estado,null,2); const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='torneo_estado.json'; a.click(); URL.revokeObjectURL(url);}
function exportPNG(){ html2canvas(qs('bracketArea'),{useCORS:true,scale:2}).then(c=>{c.toBlob(b=>{const url=URL.createObjectURL(b); const a=document.createElement('a'); a.href=url; a.download='bracket.png'; a.click(); URL.revokeObjectURL(url);})});}
async function exportPDF(){ const canvas=await html2canvas(qs('bracketArea'),{useCORS:true,scale:2}); const imgData=canvas.toDataURL('image/png'); const { jsPDF } = window.jspdf; const doc=new jsPDF({orientation:'landscape'}); const w=doc.internal.pageSize.getWidth(); const h=doc.internal.pageSize.getHeight(); doc.addImage(imgData,'PNG',5,5,w-10,h-10); doc.save('bracket.pdf');}
function resetAll(){ location.reload(); }

// --- Listeners ---
qs('crearBtn').addEventListener('click', crearTorneosDesdeForm);
qs('resetBtn').addEventListener('click', resetAll);
qs('exportJSON').addEventListener('click', exportJSON);
qs('exportPNG').addEventListener('click', exportPNG);
qs('exportPDF').addEventListener('click', exportPDF);


// --- Nota final ---
// He tratado de tocar lo mínimo necesario para mantener intactas tus funciones de export, reset y flujo.
// Las rondas ahora usan objetos {name,img} y crean DOM con avatar circular + nombre. Si quieres que las
// imágenes sean más grandes en las rondas o en la superfinal, dime y ajusto los tamaños (.avatar CSS).

(function injectSuperFinalCSS(){
  const css = `
  /* Superfinal más compacta */
  .super-slot {
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:4px; /* menos espacio entre avatar y nombre */
    transform: scale(0.8); /* achica todo el bloque */
  }
  .super-slot .bracket-avatar {
    width:48px;  /* antes 64px */
    height:48px; /* antes 64px */
  }
  .super-slot .bracket-name {
    font-size:0.85rem; /* antes 0.95rem */
  }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
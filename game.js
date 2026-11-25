'use strict';
// Kesher: state, rules and the two-phone connection. ui.js draws the screens.
const LKEY='kesher-local-v1', OKEY='kesher-online-v1', NKEY='kesher-names-v1', MKEY='kesher-myname-v1', SKEY='kesher-seen-v1', JKEY='kesher-journal-v1';
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROUND=10, MIX='LLDLDDLDDL';
const QMAP={}; QUESTIONS.forEach(q=>{ QMAP[q.i]=q; });
const app=document.getElementById('app'), layer=document.getElementById('layer');

// mode: 'local' (one phone) or 'online' (two phones). S is the shared game state.
let mode=null, S=null, session=null, screen='start', modal=null;
let unlocked=null, choice=null, draft='', qKey='', viewKey='';
let joinCode='', joinError='', leftName='';
const net={peer:null,conn:null,status:'idle',lastSeen:0,timers:{}};
let wake=null;

/* ---------- Storage and helpers ---------- */
function put(k,v){try{ if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){}}
function get(k){try{ const r=localStorage.getItem(k); return r?JSON.parse(r):null; }catch(e){ return null; }}
function putOnline(){ if(session) put(OKEY,session); }
function validState(x){ return !!x && typeof x==='object' && Array.isArray(x.names) && Array.isArray(x.deck) && typeof x.phase==='string' && !!x.ans; }
function esc(s){ return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function genCode(){ let s=''; for(let i=0;i<4;i++) s+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]; return s; }
function current(){ return S ? (QMAP[S.deck[S.pos]]||null) : null; }
function answerText(q,v){ if(v===null || v===undefined || !q) return ''; return q.k==='c' ? (q.o[v]||'') : String(v); }
function localActor(){ return S.ans.s===null ? S.subject : (S.ans.g===null ? 1-S.subject : null); }
function myRole(){ return S.subject===session.me ? 's' : 'g'; }
function isLocked(){
  if(mode!=='online' || !S || S.phase!=='answer') return false;
  const qa=session.queue;
  return S.ans[myRole()]!==null || (!!qa && qa.sid===S.sid && qa.pos===S.pos);
}

/* ---------- Questions ---------- */
function seen(){ return get(SKEY)||[]; }
function markSeen(id){ const s=seen(); if(!s.includes(id)){ s.push(id); put(SKEY,s.slice(-400)); } }
function pick(tone,exclude){
  const all=QUESTIONS.filter(q=>q.t===tone && !exclude.includes(q.i));
  const sn=seen(), fresh=all.filter(q=>!sn.includes(q.i));
  const pool=fresh.length ? fresh : all;
  return pool.length ? pool[Math.floor(Math.random()*pool.length)].i : null;
}
function buildDeck(mood){
  const deck=[];
  for(let k=0;k<ROUND;k++){
    const tone=mood==='light' ? 'l' : mood==='deep' ? 'd' : (MIX[k]==='L' ? 'l' : 'd');
    const id=pick(tone,deck); if(id) deck.push(id);
  }
  return deck;
}

/* ---------- Rules ---------- */
function newGame(names){
  S={v:1,ver:0,sid:Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36),names,mood:null,phase:'mood',deck:[],pos:0,subject:Math.random()<0.5?0:1,ans:{s:null,g:null},recap:[]};
}
function startBatch(mood){
  S.mood=mood; S.deck=buildDeck(mood); S.pos=0; S.ans={s:null,g:null}; S.recap=[];
  S.phase=S.deck.length ? 'answer' : 'end';
}
// Applies one move. "by" is the player (0 or 1) who made it. Returns true if anything changed.
function apply(a,by){
  if(!S || !a) return false;
  const q=current();
  switch(a.type){
    case 'mood':
      if((S.phase!=='mood' && S.phase!=='end') || !['light','mix','deep'].includes(a.mood)) return false;
      startBatch(a.mood); return true;
    case 'more':
      if(S.phase!=='end' || !S.mood) return false;
      startBatch(S.mood); return true;
    case 'changeMood':
      if(S.phase!=='end') return false;
      S.phase='mood'; return true;
    case 'answer': {
      if(S.phase!=='answer' || a.pos!==S.pos || !q) return false;
      const role=by===S.subject ? 's' : 'g';
      let v=a.value;
      if(q.k==='c'){ v=Number(v); if(!Number.isInteger(v) || v<0 || v>=q.o.length) return false; }
      else { v=String(v||'').trim().slice(0,140); if(!v) return false; }
      S.ans[role]=v;
      if(S.ans.s!==null && S.ans.g!==null){
        S.phase='reveal';
        S.recap.push({q:q.i,subject:S.subject,s:S.ans.s,g:S.ans.g});
      }
      return true;
    }
    case 'next':
      if(S.phase!=='reveal' || a.pos!==S.pos) return false;
      if(q) markSeen(q.i);
      S.pos+=1; S.subject=1-S.subject; S.ans={s:null,g:null};
      S.phase=S.pos>=S.deck.length ? 'end' : 'answer';
      return true;
    case 'skip': {
      if(S.phase!=='answer' || a.pos!==S.pos || !q) return false;
      markSeen(q.i);
      const id=pick(q.t,S.deck); if(!id) return false;
      S.deck[S.pos]=id; S.ans={s:null,g:null};
      return true;
    }
  }
  return false;
}
function saveJournal(){
  const q=current(); if(!q || S.phase!=='reveal') return;
  const key=S.sid+'-'+S.pos+'-'+q.i;
  const j=get(JKEY)||[];
  if(j.some(e=>e.key===key)) return;
  j.push({key,d:new Date().toISOString().slice(0,10),q:q.q,who:S.names[S.subject],by:S.names[1-S.subject],s:answerText(q,S.ans.s),g:answerText(q,S.ans.g),ws:S.subject});
  put(JKEY,j.slice(-300));
}
function afterState(){
  if(!S) return;
  saveJournal();
  if(mode==='online' && session.queue){
    const qa=session.queue;
    if(qa.sid!==S.sid || qa.pos!==S.pos || S.phase!=='answer' || S.ans[myRole()]!==null){ session.queue=null; putOnline(); }
  }
}
function commit(){
  if(mode==='online'){ S.ver=(S.ver||0)+1; session.S=S; putOnline(); send({t:'state',S}); }
  else put(LKEY,S);
  afterState(); render();
}
function buzz(){ try{ if(navigator.vibrate) navigator.vibrate(40); }catch(e){} }
// Every move goes through here. One phone and the host apply it; the joining phone sends it to the host.
function doAction(a){
  if(!S) return;
  if(mode==='local'){ if(apply(a,a.by)){ unlocked=null; choice=null; draft=''; commit(); } return; }
  if(session.role==='host'){ if(apply(a,session.me)) commit(); return; }
  if(a.type==='answer'){ session.queue=Object.assign({sid:S.sid},a); putOnline(); }
  send({t:'act',a});
  render();
}

/* ---------- Two phones: connection ---------- */
const PEER_OPTS={debug:0};
function hostId(code){ return 'kesher-game-v1-'+code; }
function later(key,fn,ms){ clearTimeout(net.timers[key]); net.timers[key]=setTimeout(fn,ms); }
function connOpen(){ return !!(net.conn && net.conn.open); }
function send(m){ if(connOpen()){ try{ net.conn.send(m); }catch(e){} } }
function teardownPeer(delay){
  const p=net.peer, c=net.conn;
  net.peer=null; net.conn=null;
  for(const k in net.timers) clearTimeout(net.timers[k]);
  net.timers={};
  const kill=()=>{ try{ c&&c.close(); }catch(e){} try{ p&&p.destroy(); }catch(e){} };
  if(delay) setTimeout(kill,delay); else kill();
}
function startNet(){
  if(!session) return;
  if(typeof window.Peer!=='function'){ setStatus('nolib'); return; }
  teardownPeer();
  const host=session.role==='host';
  let p;
  try{ p=host ? new window.Peer(hostId(session.code),PEER_OPTS) : new window.Peer(PEER_OPTS); }
  catch(e){ setStatus('reconnecting'); later('restart',startNet,4000); return; }
  net.peer=p;
  setStatus(host ? 'starting' : 'connecting');
  p.on('open',()=>{ if(net.peer!==p) return; if(host){ if(!connOpen()) setStatus('waiting'); } else connectToHost(); });
  p.on('connection',c=>{ if(net.peer!==p) return; if(!host){ try{ c.close(); }catch(e){} return; } adoptConn(c); });
  p.on('disconnected',()=>{
    if(net.peer!==p || p.destroyed) return;
    later('peerReconnect',()=>{ if(net.peer===p && !p.destroyed && p.disconnected){ try{ p.reconnect(); }catch(e){ startNet(); } } },1500);
  });
  p.on('error',err=>{
    if(net.peer!==p) return;
    const t=err && err.type;
    if(t==='peer-unavailable'){ if(!connOpen()) setStatus('nohost'); later('connect',connectToHost,3000); return; }
    if(t==='unavailable-id'){ setStatus('reconnecting'); later('restart',startNet,3000); return; }
    if(t==='browser-incompatible'){ setStatus('nolib'); return; }
    if(!connOpen()) setStatus('reconnecting');
    later('restart',()=>{
      if(net.peer!==p) return;
      if(p.destroyed || !connOpen()) startNet();
      else if(p.disconnected){ try{ p.reconnect(); }catch(e){} }
    },4000);
  });
}
function connectToHost(){
  if(!session || session.role!=='guest') return;
  const p=net.peer;
  if(!p || p.destroyed){ startNet(); return; }
  if(connOpen()) return;
  if(p.disconnected){ try{ p.reconnect(); }catch(e){} later('connect',connectToHost,2000); return; }
  if(!p.open && !p.id){ later('connect',connectToHost,1500); return; }
  let c;
  try{ c=p.connect(hostId(session.code),{reliable:true,serialization:'json'}); }catch(e){ later('connect',connectToHost,3000); return; }
  if(!c){ later('connect',connectToHost,3000); return; }
  adoptConn(c);
  later('connectTimeout',()=>{ if(net.conn===c && !c.open){ net.conn=null; try{ c.close(); }catch(e){} connectToHost(); } },10000);
}
function adoptConn(c){
  if(net.conn && net.conn!==c){ const old=net.conn; net.conn=null; try{ old.close(); }catch(e){} }
  net.conn=c;
  c.on('open',()=>{
    if(net.conn!==c) return;
    net.lastSeen=Date.now();
    setStatus('connected');
    send({t:'hello',name:session.myName});
    if(session.role==='guest' && session.queue && S && session.queue.sid===S.sid) send({t:'act',a:session.queue});
  });
  c.on('data',d=>{ if(net.conn!==c) return; net.lastSeen=Date.now(); onMsg(d); });
  const lost=()=>{
    if(net.conn!==c) return;
    net.conn=null;
    if(!session) return;
    if(session.role==='guest'){ setStatus('reconnecting'); later('connect',connectToHost,1500); }
    else setStatus('waiting');
  };
  c.on('close',lost); c.on('error',lost);
}
function onMsg(m){
  if(!m || typeof m!=='object' || !session) return;
  if(m.t==='hello'){
    if(m.name) session.oppName=String(m.name).slice(0,16);
    putOnline();
    if(session.role==='host'){
      if(!S){ newGame([session.myName, session.oppName||'Player 2']); screen='game'; commit(); }
      else send({t:'state',S});
    } else if(screen==='lobby') render();
    return;
  }
  if(m.t==='state' && session.role==='guest'){
    if(validState(m.S) && (!S || m.S.sid!==S.sid || (m.S.ver||0)>=(S.ver||0))) adopt(m.S);
    return;
  }
  if(m.t==='act' && session.role==='host'){
    const before=S ? S.phase : null;
    if(apply(m.a,1-session.me)){ commit(); if(before!=='reveal' && S.phase==='reveal') buzz(); }
    else if(S) send({t:'state',S});
    return;
  }
  if(m.t==='bye'){
    leftName=S ? S.names[1-session.me] : (session.oppName||'The other player');
    put(OKEY,null);
    teardownPeer();
    modal='left'; renderLayer();
  }
}
function adopt(ns){
  const before=S ? S.phase : null;
  S=ns; session.S=S; putOnline();
  screen='game';
  afterState();
  if(before && before!=='reveal' && S.phase==='reveal') buzz();
  render();
}
function resumeNet(){
  if(mode!=='online' || !session) return;
  const p=net.peer;
  if(!p || p.destroyed){ startNet(); return; }
  if(p.disconnected){ try{ p.reconnect(); }catch(e){ startNet(); return; } }
  if(connOpen()) send({t:'hello',name:session.myName});
  else if(session.role==='guest') later('connect',connectToHost,800);
}
setInterval(()=>{
  if(mode!=='online' || !session || !connOpen()) return;
  send({t:'ping'});
  if(Date.now()-net.lastSeen>20000){
    const c=net.conn; net.conn=null; try{ c.close(); }catch(e){}
    if(session.role==='guest'){ setStatus('reconnecting'); connectToHost(); } else setStatus('waiting');
  }
},5000);

function oppName(){ return S ? S.names[1-session.me] : (session.oppName || 'the other player'); }
function statusText(){
  const o=esc(oppName());
  switch(net.status){
    case 'nolib': return 'Playing on two phones needs an internet connection. Check your connection and open the app again.';
    case 'connected': return S ? `Connected to ${o}` : 'Connected. Getting the game ready…';
    case 'waiting': return S ? `Waiting for ${o} to reconnect…` : 'Waiting for the other phone to join…';
    case 'nohost': return S ? `Waiting for ${o} to reconnect…` : `Looking for game ${esc(session.code)}. Keep the game open on the other phone.`;
    case 'reconnecting': return 'Reconnecting…';
    default: return 'Connecting…';
  }
}
function statusHTML(){ return `<span class="dot${net.status==='connected'?' on':''}"></span><span>${statusText()}</span>`; }
function setStatus(s){ net.status=s; const el=document.getElementById('netstatus'); if(el) el.innerHTML=statusHTML(); }

async function requestWake(){
  if(wake || mode!=='online' || screen!=='game' || document.visibilityState!=='visible' || !('wakeLock' in navigator)) return;
  try{ wake=await navigator.wakeLock.request('screen'); wake.addEventListener('release',()=>{ wake=null; }); }catch(e){ wake=null; }
}
function releaseWake(){ if(wake){ try{ wake.release(); }catch(e){} wake=null; } }

function startOnline(role,name,code){
  put(MKEY,name);
  session={role,code,me:role==='host'?0:1,myName:name,oppName:null,S:null,queue:null};
  mode='online'; S=null; choice=null; draft=''; screen='lobby';
  putOnline(); render(); startNet();
}
function endOnline(sayBye){
  if(sayBye){ send({t:'bye'}); teardownPeer(400); } else teardownPeer();
  put(OKEY,null); releaseWake();
  session=null; mode=null; S=null; choice=null; draft=''; modal=null; screen='start';
  render();
}

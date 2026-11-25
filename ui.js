'use strict';
// Kesher: screens, taps and start-up. Uses the state and rules from game.js.
const KNOT='<svg class="knot" viewBox="0 0 60 48" aria-hidden="true"><circle class="ring r0" cx="22" cy="24" r="13" pathLength="100"/><circle class="ring r1" cx="38" cy="24" r="13" pathLength="100"/><path class="ring r0 over" d="M25.15 11.39A13 13 0 0 1 33.48 17.90" pathLength="100"/></svg>';

function nameTag(i){ return `<span class="who w${i}">${esc(S.names[i])}</span>`; }
function partnerText(){
  if(mode!=='online' || !S || S.phase!=='answer') return '';
  const other=1-session.me, done=S.ans[S.subject===other?'s':'g']!==null, n=esc(S.names[other]);
  if(isLocked()) return done ? `${n} is done too.` : `Waiting for ${n}…`;
  return done ? `${n} has locked in.` : '';
}

/* ---------- Start and setup screens ---------- */
function startHTML(){
  const myName=get(MKEY)||'';
  const local=get(LKEY);
  const canResume=validState(local) && local.phase!=='mood';
  const saved=(get(JKEY)||[]).length;
  return `<div class="start">
    <div class="hero">${KNOT}</div>
    <h1 class="title">Kesher</h1>
    <p class="sub"><span lang="he">קשר</span> means connection.</p>
    <p class="lede">A game for two. One of you answers a question about yourself, the other guesses what you said. Then you talk about it.</p>
    <form id="hostForm" autocomplete="off">
      <label class="field"><span>Your name</span><input id="myName" maxlength="16" placeholder="Name" value="${esc(myName)}"></label>
      <button class="btn wide" type="submit">Play on two phones</button>
    </form>
    <button class="btn ghost wide" data-act="goJoin">Join with a code</button>
    <div class="alt">
      ${canResume?'<button class="link" data-act="continueLocal">Continue the game on this phone</button>':''}
      <button class="link" data-act="goLocal">Play on one phone</button>
      ${saved?`<button class="link" data-act="journal">Look back at your answers (${saved})</button>`:''}
    </div>
  </div>`;
}
function joinHTML(){
  const myName=get(MKEY)||'';
  return `<div class="start">
    <h1 class="h1">Join a game</h1>
    <p class="lede">Enter the 4-letter code showing on the other phone.</p>
    <form id="joinForm" autocomplete="off">
      <label class="field"><span>Your name</span><input id="joinName" maxlength="16" placeholder="Name" value="${esc(myName)}"></label>
      <label class="field"><span>Game code</span><input id="joinCode" class="codeinput" maxlength="4" autocapitalize="characters" autocorrect="off" spellcheck="false" value="${esc(joinCode)}"></label>
      ${joinError?`<p class="err">${esc(joinError)}</p>`:''}
      <button class="btn wide" type="submit">Join game</button>
    </form>
    <div class="alt"><button class="link" data-act="back">Back</button></div>
  </div>`;
}
function localSetupHTML(){
  const names=get(NKEY)||['',''];
  return `<div class="start">
    <h1 class="h1">Play on one phone</h1>
    <p class="lede">You’ll pass the phone back and forth so each of you can answer in private.</p>
    <form id="setup" autocomplete="off">
      <label class="field"><span>First player</span><input id="n0" maxlength="16" placeholder="Name" value="${esc(names[0])}"></label>
      <label class="field"><span>Second player</span><input id="n1" maxlength="16" placeholder="Name" value="${esc(names[1])}"></label>
      <button class="btn wide" type="submit">Start</button>
    </form>
    <div class="alt"><button class="link" data-act="back">Back</button></div>
  </div>`;
}
function lobbyHTML(){
  const host=session.role==='host';
  return `<div class="start">
    <h1 class="h1">${host?'Your game code':'Joining game'}</h1>
    <p class="code" aria-label="Game code ${esc(session.code.split('').join(' '))}">${esc(session.code)}</p>
    ${host?'<p class="lede">On the other phone, open Kesher, tap Join with a code, and enter these four letters.</p>':''}
    <div class="netstatus" id="netstatus" role="status">${statusHTML()}</div>
    ${host && navigator.share?'<button class="btn wide" data-act="share">Send the code</button>':''}
    <button class="btn ghost wide" data-act="cancelOnline">Cancel</button>
  </div>`;
}
function journalHTML(){
  const j=(get(JKEY)||[]).slice().reverse();
  let lastDay='', out='';
  j.forEach(e=>{
    if(e.d!==lastDay){
      lastDay=e.d;
      let label=e.d;
      try{ label=new Date(e.d+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}); }catch(err){}
      out+=`<h2 class="day">${esc(label)}</h2>`;
    }
    out+=`<div class="entry"><p class="rq">${esc(e.q)}</p><p><span class="who w${e.ws===1?1:0}">${esc(e.who)}:</span> ${esc(e.s)}</p><p class="muted">${esc(e.by)} guessed: ${esc(e.g)}</p></div>`;
  });
  return `<header class="top"><span class="brand">${KNOT}<span>Kesher</span></span><button class="link" data-act="back">Back</button></header>
  <div class="stage">
    <h1 class="h1">Your answers</h1>
    ${out||'<p class="lede">Answers you reveal show up here, so you can look back on them.</p>'}
    ${j.length?'<div class="alt"><button class="link" data-act="askClear">Clear saved answers</button></div>':''}
  </div>`;
}

/* ---------- Game screens ---------- */
function headerHTML(){
  const online=mode==='online';
  const prog=(S.phase==='answer'||S.phase==='reveal') ? `<span class="prog">Question ${S.pos+1} of ${S.deck.length}</span>` : '';
  return `<header class="top"><span class="brand">${KNOT}<span>Kesher</span></span>${prog}<button class="link" data-act="${online?'askLeave':'askEnd'}">${online?'Leave':'End'}</button></header>
  ${online?`<div class="netstatus" id="netstatus" role="status">${statusHTML()}</div>`:''}`;
}
function moodHTML(){
  return `${headerHTML()}
  <div class="stage">
    <p class="kicker">${nameTag(0)} and ${nameTag(1)}</p>
    <h1 class="h1">How’s the mood tonight?</h1>
    <div class="moods">
      <button class="mood m-light" data-act="mood" data-mood="light"><b>Keep it light</b><span>Playful questions and easy laughs</span></button>
      <button class="mood m-mix" data-act="mood" data-mood="mix"><b>A bit of everything</b><span>Starts light and goes deeper as you play</span></button>
      <button class="mood m-deep" data-act="mood" data-mood="deep"><b>Let’s go deeper</b><span>Bigger questions, more to talk about</span></button>
    </div>
    <p class="fine">Ten questions a round. You take turns: one answers about themselves, the other guesses.</p>
  </div>`;
}
function answerHTML(){
  const q=current();
  const actor=mode==='online' ? session.me : localActor();
  const isSubj=actor===S.subject;
  const subj=esc(S.names[S.subject]);
  const label=isSubj ? 'Your answer' : `What will ${subj} say?`;
  const lockLabel=isSubj ? 'Lock in my answer' : 'Lock in my guess';
  let body;
  if(isLocked()){
    body=`<div class="locked"><p class="h2">Locked in.</p><p class="muted" id="partner">${partnerText()}</p></div>`;
  } else if(q.k==='c'){
    body=`<p class="ask">${label}</p>
      <div class="opts">${q.o.map((o,i)=>`<button class="opt${choice===i?' on':''}" data-act="choose" data-i="${i}" aria-pressed="${choice===i}">${esc(o)}</button>`).join('')}</div>
      <button class="btn wide" data-act="lock" ${choice===null?'disabled':''}>${lockLabel}</button>
      ${mode==='online'?`<p class="muted small" id="partner">${partnerText()}</p>`:''}`;
  } else {
    body=`<label class="ask" for="draft">${label}</label>
      <textarea id="draft" maxlength="140" rows="3" placeholder="${isSubj?'Type your answer':'Type your guess'}">${esc(draft)}</textarea>
      <button class="btn wide" data-act="lock" id="lockBtn" ${draft.trim()?'':'disabled'}>${lockLabel}</button>
      ${mode==='online'?`<p class="muted small" id="partner">${partnerText()}</p>`:''}`;
  }
  return `${headerHTML()}
  <div class="stage">
    <p class="about a${S.subject}">${isSubj?'About you':`About ${subj}`}</p>
    <h1 class="q">${esc(q.q)}</h1>
    ${body}
    ${isLocked()?'':'<div class="alt"><button class="link" data-act="skip">Skip this question</button></div>'}
  </div>`;
}
function revealHTML(){
  const q=current(), sub=S.subject, gs=1-sub;
  const match=q.k==='c' ? S.ans.s===S.ans.g : null;
  return `${headerHTML()}
  <div class="stage">
    <p class="about a${sub}">About ${esc(S.names[sub])}</p>
    <h1 class="q small">${esc(q.q)}</h1>
    <div class="pair">
      <div class="ans a${sub}"><span class="lbl">${esc(S.names[sub])} said</span><p>${esc(answerText(q,S.ans.s))}</p></div>
      <div class="ans a${gs}"><span class="lbl">${esc(S.names[gs])} guessed</span><p>${esc(answerText(q,S.ans.g))}</p></div>
    </div>
    ${match===null?'':`<p class="verdict">${match?'Same answer. Nicely done.':'Different answers. Worth a conversation.'}</p>`}
    <div class="talk"><span class="lbl">Talk about it</span><p>${esc(q.f)}</p></div>
    <button class="btn wide" data-act="next">${S.pos+1>=S.deck.length?'Finish the round':'Next question'}</button>
  </div>`;
}
function endHTML(){
  const items=S.recap.map(r=>{
    const q=QMAP[r.q]; if(!q) return '';
    return `<li class="entry"><p class="rq">${esc(q.q)}</p><p><span class="who w${r.subject}">${esc(S.names[r.subject])}:</span> ${esc(answerText(q,r.s))}</p><p class="muted">${esc(S.names[1-r.subject])} guessed: ${esc(answerText(q,r.g))}</p></li>`;
  }).join('');
  return `${headerHTML()}
  <div class="stage">
    <h1 class="h1">That’s a round.</h1>
    <p class="lede">Here’s what you talked about. It’s saved on this phone too.</p>
    <ol class="recap">${items}</ol>
    <button class="btn wide" data-act="more">Ten more questions</button>
    <button class="btn ghost wide" data-act="changeMood">Change the mood</button>
    <div class="alt"><button class="link" data-act="${mode==='online'?'askLeave':'askEnd'}">Done for tonight</button></div>
  </div>`;
}
function gameHTML(){
  if(S.phase==='mood') return moodHTML();
  if(S.phase==='answer') return answerHTML();
  if(S.phase==='reveal') return revealHTML();
  return endHTML();
}

/* ---------- Overlays ---------- */
function sheet(id,title,text,primary,secondary){
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="${id}"><div class="sheet">
    <h2 id="${id}">${title}</h2><p>${text}</p>
    <button class="btn wide" data-act="${primary[0]}">${primary[1]}</button>
    ${secondary?`<button class="btn ghost wide" data-act="${secondary[0]}" data-autofocus>${secondary[1]}</button>`:''}
  </div></div>`;
}
function passHTML(){
  const a=localActor(), n=esc(S.names[a]), sub=esc(S.names[S.subject]);
  return `<div class="overlay opaque" role="dialog" aria-modal="true" aria-labelledby="passName"><div class="sheet pass">
    <p class="kicker">Question ${S.pos+1} of ${S.deck.length}</p>
    <p class="passto">Pass the phone to</p>
    <h2 class="passname w${a}" id="passName">${n}</h2>
    <p class="muted">${a===S.subject?'This one’s about you.':`Guess what ${sub} will say.`}</p>
    <button class="btn wide" data-act="unlock" data-autofocus>I’m ${n}</button>
  </div></div>`;
}
function overlayHTML(){
  if(modal==='confirmEnd') return sheet('endT','End this game?','Your answers so far stay saved on this phone.',['confirmEnd','End game'],['close','Keep playing']);
  if(modal==='confirmLeave') return sheet('leaveT','Leave this game?','The game ends on both phones. Your answers so far stay saved.',['confirmLeave','Leave game'],['close','Keep playing']);
  if(modal==='confirmClear') return sheet('clearT','Clear saved answers?','This removes every saved answer from this phone. It can’t be undone.',['confirmClear','Clear answers'],['close','Keep them']);
  if(modal==='left') return sheet('leftT',`${esc(leftName)} left the game`,'Your answers are saved. Start a new game to play again.',['leftOk','Back to the start']);
  if(screen!=='game' || !S) return '';
  if(mode==='local' && S.phase==='answer' && localActor()!==null && unlocked!==localActor()) return passHTML();
  return '';
}
function renderLayer(){
  layer.innerHTML=overlayHTML();
  const af=layer.querySelector('[data-autofocus]');
  if(af) af.focus({preventScroll:true});
}

/* ---------- Render ---------- */
function render(){
  let moved=false;
  if(S){
    const k=[S.sid,S.pos,S.deck[S.pos],S.phase,mode==='local'?localActor():''].join('|');
    if(k!==qKey){ qKey=k; choice=null; draft=''; moved=true; }
  }
  const vk=screen+'|'+(S?qKey+'|'+isLocked():'');
  const ae=document.activeElement;
  if(vk===viewKey && screen==='game' && ae && ae.id==='draft'){
    const p=document.getElementById('partner'); if(p) p.innerHTML=partnerText();
    return;
  }
  viewKey=vk;
  if(screen==='game' && S) app.innerHTML=gameHTML();
  else if(screen==='lobby' && session) app.innerHTML=lobbyHTML();
  else if(screen==='join') app.innerHTML=joinHTML();
  else if(screen==='localSetup') app.innerHTML=localSetupHTML();
  else if(screen==='journal') app.innerHTML=journalHTML();
  else { screen='start'; app.innerHTML=startHTML(); }
  renderLayer();
  if(moved) window.scrollTo(0,0);
  if(mode==='online' && screen==='game') requestWake();
}

/* ---------- Taps and typing ---------- */
document.addEventListener('submit',e=>{
  const id=e.target.id;
  if(id==='hostForm'){
    e.preventDefault();
    startOnline('host',document.getElementById('myName').value.trim().slice(0,16)||'Player 1',genCode());
  } else if(id==='joinForm'){
    e.preventDefault();
    const name=document.getElementById('joinName').value.trim().slice(0,16)||'Player 2';
    const code=document.getElementById('joinCode').value.toUpperCase().replace(/[^A-Z]/g,'');
    joinCode=code;
    if(code.length!==4){ joinError='The code is four letters. Check it on the other phone.'; put(MKEY,name); viewKey=''; render(); return; }
    joinError='';
    startOnline('guest',name,code);
  } else if(id==='setup'){
    e.preventDefault();
    const a=document.getElementById('n0').value.trim().slice(0,16)||'Player 1';
    const b=document.getElementById('n1').value.trim().slice(0,16)||'Player 2';
    put(NKEY,[a,b]);
    mode='local'; unlocked=null; newGame([a,b]); screen='game'; commit();
  }
});
document.addEventListener('input',e=>{
  if(e.target.id==='draft'){
    draft=e.target.value;
    const b=document.getElementById('lockBtn'); if(b) b.disabled=!draft.trim();
  } else if(e.target.id==='joinCode'){
    const v=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
    if(v!==e.target.value) e.target.value=v;
  }
});
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');
  if(!t || t.disabled) return;
  const pos=S ? S.pos : 0;
  switch(t.dataset.act){
    case 'goJoin': joinError=''; screen='join'; render(); break;
    case 'goLocal': screen='localSetup'; render(); break;
    case 'journal': screen='journal'; render(); window.scrollTo(0,0); break;
    case 'back': joinError=''; screen=S&&mode?'game':'start'; render(); break;
    case 'continueLocal': {
      const s=get(LKEY);
      if(validState(s)){ mode='local'; S=s; unlocked=null; screen='game'; render(); }
      break;
    }
    case 'close': modal=null; renderLayer(); break;
    case 'askEnd': modal='confirmEnd'; renderLayer(); break;
    case 'confirmEnd': modal=null; S=null; mode=null; put(LKEY,null); screen='start'; render(); window.scrollTo(0,0); break;
    case 'askLeave': modal='confirmLeave'; renderLayer(); break;
    case 'confirmLeave': case 'cancelOnline': endOnline(true); break;
    case 'leftOk': endOnline(false); break;
    case 'askClear': modal='confirmClear'; renderLayer(); break;
    case 'confirmClear': modal=null; put(JKEY,null); viewKey=''; render(); break;
    case 'share': {
      const url=location.origin+location.pathname+'?join='+session.code;
      navigator.share({title:'Kesher',text:`Join my game of Kesher. The code is ${session.code}.`,url}).catch(()=>{});
      break;
    }
    case 'unlock': unlocked=localActor(); renderLayer(); break;
    case 'choose': choice=+t.dataset.i; viewKey=''; render(); break;
    case 'lock': {
      const q=current(); if(!q) break;
      const value=q.k==='c' ? choice : draft;
      if(value===null || value==='' ) break;
      doAction({type:'answer',pos,value,by:mode==='local'?localActor():undefined});
      break;
    }
    case 'skip': doAction({type:'skip',pos}); break;
    case 'next': doAction({type:'next',pos}); break;
    case 'mood': doAction({type:'mood',mood:t.dataset.mood}); break;
    case 'more': doAction({type:'more'}); break;
    case 'changeMood': doAction({type:'changeMood'}); break;
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && modal && modal!=='left'){ modal=null; renderLayer(); }
});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ resumeNet(); requestWake(); } });
window.addEventListener('online',resumeNet);
window.addEventListener('pageshow',e=>{ if(e.persisted) resumeNet(); });

/* ---------- Start up ---------- */
function init(){
  let j='';
  try{
    const params=new URLSearchParams(location.search);
    j=(params.get('join')||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
    if(params.has('join')) history.replaceState(null,'',location.pathname);
  }catch(e){}
  const o=get(OKEY);
  if(o && typeof o.code==='string' && (o.role==='host'||o.role==='guest')){
    session=o; mode='online'; S=validState(o.S)?o.S:null;
    screen=S?'game':'lobby';
    render(); startNet(); return;
  }
  if(j){ joinCode=j; screen='join'; }
  render();
}
if('serviceWorker' in navigator && location.protocol==='https:'){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
init();

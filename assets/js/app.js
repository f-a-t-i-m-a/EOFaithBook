/* Faithbook — app logic
   Depends on GREETING, FLOW_LAPTOP, PEOPLE, PRESETS, USER from data.js.

   Two behaviours:
   • laptop thread  → the full "Community Coordinator" scripted arc
   • other threads  → a simple, warm person hand-off
   Every thread opens with the daily gratitude greeting. */

(function(){
  'use strict';

  const stream   = document.getElementById('stream');
  const empty    = document.getElementById('empty');
  const messages = document.getElementById('messages');
  const input    = document.getElementById('input');
  const send     = document.getElementById('send');

  let activeThread = null;
  let coordThread = null;     // the chat currently running the coordinator arc
  let laptopPending = false;  // AI is working; sidebar blinks until Brian opens it
  let arrivalTimer = null;    // fires when the "two days" have passed

  // How long after Brian says "yes" the notification appears (the "two days").
  // Tune this for your demo pacing — 60000 = one minute.
  const ARRIVAL_DELAY_MS = 60 * 1000;

  // Each thread keeps its OWN persistent message log, so leaving a chat and
  // coming back later restores it exactly (history is never rebuilt).
  const logs = {};            // thread -> its <div class="log"> element
  const awaitingFirst = {};   // thread -> still waiting for Brian's first message?

  /* ── Helpers ────────────────────────────────────────── */
  function esc(s){ return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  function fmt(s){ return esc(s).replace(/\n/g, '<br>'); }
  function scrollDown(){ stream.scrollTop = stream.scrollHeight; }

  // The message container for the currently open thread.
  function container(){ return logs[activeThread] || messages; }

  /* ── Avatars (inline SVG, offline — no external images) ────────────────────
     A soft illustrated portrait per person; the EO logo for organisations;
     a count chip for "+17 anderen"; a real photo if `photo:` is provided. */
  function portraitSVG(av){
    av = av || {};
    const bg = av.bg||'#e5ded4', skin = av.skin||'#f0c6a0',
          hair = av.hair||'#3b2f2a', clothes = av.clothes||'#8b5cf6';
    const sideHair = av.style === 'long'
      ? `<ellipse cx='27' cy='60' rx='9' ry='21' fill='${hair}'/><ellipse cx='73' cy='60' rx='9' ry='21' fill='${hair}'/>`
      : '';
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
         <rect width='100' height='100' fill='${bg}'/>
         <circle cx='50' cy='97' r='30' fill='${clothes}'/>
         ${sideHair}
         <circle cx='50' cy='40' r='25' fill='${hair}'/>
         <circle cx='50' cy='49' r='21' fill='${skin}'/>
       </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  function eoLogoSVG(){
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
         <rect width='100' height='100' fill='#ffffff'/>
         <text x='50' y='67' font-family='Arial, Helvetica, sans-serif' font-size='52'
               font-weight='800' letter-spacing='-3' fill='#6d28d9' text-anchor='middle'>eo</text>
       </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  // Returns the avatar HTML for a person/org. `extra` adds a size class (e.g. 'sm').
  function avatar(p, extra){
    const cls = 'avatar' + (extra ? ' ' + extra : '');
    if(p.count) return `<div class="${cls} count">${esc(p.count)}</div>`;
    const src = p.photo ? p.photo : (p.logo === 'eo' ? eoLogoSVG() : portraitSVG(p.av));
    return `<img class="${cls}" src="${src}" alt="${esc(p.name||'')}">`;
  }

  function autosize(){
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  }

  /* ── Message primitives (append to the active thread's log) ── */
  function addUser(text){
    empty.classList.add('hidden');
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = `<img class="who-av" src="${USER.photo || portraitSVG(USER.av)}" alt="${esc(USER.name)}">
      <div class="body"><div class="txt">${fmt(text)}</div></div>`;
    container().appendChild(el);
    scrollDown();
  }

  // Creates an empty bot bubble and returns its .body element to fill in.
  function botBubble(){
    empty.classList.add('hidden');
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = `<div class="who-av">eo</div><div class="body"></div>`;
    container().appendChild(el);
    return el.querySelector('.body');
  }

  function addTyping(){
    const el = document.createElement('div');
    el.className = 'msg bot typing';
    el.innerHTML = `<div class="who-av">eo</div>
      <div class="body"><div class="dots"><i></i><i></i><i></i></div></div>`;
    container().appendChild(el);
    scrollDown();
  }
  function removeTyping(){ const t = container().querySelector('.typing'); if(t) t.remove(); }

  // Bot "says" html after a natural typing pause, then runs cb(body).
  function botSay(html, cb, delay){
    addTyping();
    setTimeout(()=>{
      removeTyping();
      const body = botBubble();
      body.innerHTML = html;
      scrollDown();
      if(cb) cb(body);
    }, delay || 1400);
  }

  /* ── Composer ───────────────────────────────────────── */
  input.addEventListener('input', ()=>{ autosize(); send.disabled = input.value.trim() === ''; });
  input.addEventListener('keydown', e=>{
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); if(!send.disabled) go(); }
  });
  send.addEventListener('click', ()=>{ if(!send.disabled) go(); });

  function go(){
    const id = activeThread;
    const text = input.value.trim();
    if(!text || !id) return;

    addUser(text);
    input.value = ''; autosize(); send.disabled = true;

    // Only a fresh chat reacts to Brian's first message; history is read-only.
    if(!awaitingFirst[id]) return;
    awaitingFirst[id] = false;

    const key = pickThread(text);
    if(key === 'laptop'){
      // The new chat becomes the coordinator arc, and names itself.
      setThreadTitle(id, 'Tweedehands laptop');
      coordThread = id;
      laptopPending = false; openQuestions = 0; clearTimeout(arrivalTimer);
      laptopReflect();
    } else {
      setThreadTitle(id, titleFor(key, text));
      simpleReply(key);
    }
  }

  /* ── Intent detection + derived chat titles ─────────── */
  function pickThread(text){
    const t = text.toLowerCase();
    if(/moeder|vader|verloren|overleden|rouw|verdriet|begrafenis/.test(t))      return 'grief';
    if(/laptop|computer|tweedehands|doneren|donatie|kinderen|school|oorlog/.test(t)) return 'laptop';
    if(/kring|aansluiten|meedoen|groep/.test(t))                                return 'kring';
    return 'default';
  }
  function titleFor(key, text){
    if(key === 'grief') return 'Rouw';
    if(key === 'kring') return 'Nieuwe kring';
    const words = text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ');
    return words.length > 34 ? words.slice(0, 34) + '…' : (words || 'Gesprek');
  }
  function simpleReply(key){
    const m = PEOPLE[key] || PEOPLE.default;
    botSay(`<div class="txt">${fmt(m.reply)}</div>` + personCardHTML(m), body=>{
      wireCardButton(body);
    });
  }
  function personCardHTML(m){
    return `<div class="person">
      <div class="top">
        ${avatar(m)}
        <div><div class="name">${m.name}</div><div class="meta">${m.meta}</div></div>
      </div>
      <div class="why"><span class="tag">${m.tag}</span>${fmt(m.why)}</div>
      <button class="cardbtn">${m.action}</button>
    </div>`;
  }
  function wireCardButton(body){
    const btn = body.querySelector('.cardbtn');
    if(btn) btn.addEventListener('click', function(){
      this.textContent = 'Berichtje verstuurd ✓'; this.disabled = true;
    });
  }

  /* ── Hero arc: laptop / Community Coordinator ───────── */
  const F = (typeof FLOW_LAPTOP !== 'undefined') ? FLOW_LAPTOP : {};

  // Step 1 — reflect the intention, ask permission.
  function laptopReflect(){
    botSay(`<div class="txt">${fmt(F.reflect)}</div>`, body=>{
      const wrap = document.createElement('div');
      wrap.className = 'permission';
      wrap.innerHTML =
        `<button class="btn primary" data-yes>${F.yesLabel}</button>
         <button class="btn ghost" data-no>${F.noLabel}</button>`;
      body.appendChild(wrap);
      scrollDown();
      wrap.querySelector('[data-yes]').addEventListener('click', ()=>{
        wrap.remove();
        addUser(F.brianYes);
        laptopWorking();
      });
      wrap.querySelector('[data-no]').addEventListener('click', ()=>{
        wrap.remove();
        botSay(`<div class="txt">Geen probleem. Ik ben er wanneer je wilt.</div>`);
      });
    });
  }

  // Step 2 — AI goes to work, then STOPS. After the "two days" (ARRIVAL_DELAY_MS)
  // the sidebar thread starts blinking. The presenter then clicks the notification.
  function laptopWorking(){
    botSay(`<div class="txt">${fmt(F.working)}</div>`, ()=>{
      clearTimeout(arrivalTimer);
      arrivalTimer = setTimeout(()=>{
        if(activeThread === coordThread){
          // Brian is watching the chat → the reply just arrives, live.
          laptopPending = false;
          laptopDonors();
        } else {
          // Brian is elsewhere → blink the thread; reveal when he opens it.
          laptopPending = true;
          markThreadUpdated(coordThread);
        }
      }, ARRIVAL_DELAY_MS);
    });
  }

  // Step 3 — triggered when Brian opens the blinking chat: good news + donors.
  function laptopDonors(){
    clearThreadUpdated(coordThread);         // Brian has now "seen" it
    botSay(`<div class="txt">${fmt(F.donorsIntro)}</div>` + donorsHTML(), ()=>{
      setTimeout(laptopTriage, 900);
    });
  }
  function donorsHTML(){
    const cards = (F.donors||[]).map(d =>
      `<div class="donor">
         ${avatar(d, 'sm')}
         <div class="d-txt"><b>${esc(d.name)}</b><span>${esc(d.note)}</span></div>
       </div>`).join('');
    return `<div class="donors">${cards}</div>`;
  }

  // Step 4 — question triage: approve / edit / reject. Humans stay in control.
  function laptopTriage(){
    botSay(`<div class="txt">${fmt(F.triageIntro)}</div>`, body=>{
      const list = document.createElement('div');
      list.className = 'qlist';
      (F.questions||[]).forEach(q => list.appendChild(qcard(q)));
      body.appendChild(list);
      scrollDown();
    });
  }

  let openQuestions = 0;
  function qcard(q){
    openQuestions++;
    const card = document.createElement('div');
    card.className = 'qcard';
    card.innerHTML =
      `<div class="q-top">
         ${avatar(q, 'sm')}
         <div><div class="name">${esc(q.name)}</div>
              <div class="q-question">"${esc(q.question)}"</div></div>
       </div>
       <div class="q-reply">
         <span class="q-label">Voorgesteld antwoord</span>
         <div class="q-text" contenteditable="false">${esc(q.suggested)}</div>
       </div>
       <div class="q-actions">
         <button class="btn primary sm" data-send>Verstuur</button>
         <button class="btn ghost sm" data-edit>Bewerk</button>
         <button class="btn ghost sm" data-reject>Afwijzen</button>
       </div>`;

    const textEl = card.querySelector('.q-text');
    const editBtn = card.querySelector('[data-edit]');

    card.querySelector('[data-send]').addEventListener('click', ()=>{
      textEl.setAttribute('contenteditable','false');
      resolveCard(card, 'Antwoord verstuurd ✓');
    });
    editBtn.addEventListener('click', ()=>{
      const on = textEl.getAttribute('contenteditable') === 'true';
      textEl.setAttribute('contenteditable', on ? 'false' : 'true');
      textEl.classList.toggle('editing', !on);
      editBtn.textContent = on ? 'Bewerk' : 'Klaar';
      if(!on){ textEl.focus(); }
    });
    card.querySelector('[data-reject]').addEventListener('click', ()=>{
      resolveCard(card, 'Afgewezen');
    });
    return card;
  }

  function resolveCard(card, label){
    card.classList.add('resolved');
    card.querySelector('.q-actions').innerHTML = `<span class="q-done">${label}</span>`;
    const textEl = card.querySelector('.q-text');
    textEl.setAttribute('contenteditable','false');
    textEl.classList.remove('editing');
    openQuestions--;
    if(openQuestions <= 0){ setTimeout(laptopCoordinate, 700); }
  }

  // Step 5 — coordinate the logistics, then close warmly.
  function laptopCoordinate(){
    botSay(`<div class="txt">${fmt(F.coordinateIntro)}</div>`, body=>{
      const wrap = document.createElement('div');
      wrap.className = 'options';
      (F.options||[]).forEach(opt=>{
        const b = document.createElement('button');
        b.className = 'option';
        b.textContent = opt;
        b.addEventListener('click', ()=>{
          addUser(opt);
          botSay(`<div class="txt">${fmt(F.done)}</div>`);
        });
        wrap.appendChild(b);
      });
      body.appendChild(wrap);
      scrollDown();
    });
  }

  /* ── Greeting + static (history) rendering ──────────── */
  function renderGreeting(){
    const body = botBubble();
    body.innerHTML = `<div class="txt greeting">${fmt(GREETING)}</div>`;
    scrollDown();
  }
  // A bot message rendered instantly, with no typing animation (used for history).
  function botStatic(html){
    const body = botBubble();
    body.innerHTML = html;
    scrollDown();
    return body;
  }

  /* ── Sidebar threads (built dynamically) ────────────── */
  const threadsToday   = document.getElementById('threads-today');
  const threadsEarlier = document.getElementById('threads-earlier');
  const threadBtns = {};   // id -> sidebar button
  const builders   = {};   // id -> function that fills the log the first time
  let newChatCounter = 0;

  function makeThreadButton(id, title, section){
    const btn = document.createElement('button');
    btn.className = 'thread';
    btn.dataset.thread = id;
    btn.textContent = title;
    btn.addEventListener('click', ()=> onThreadClick(id));
    if(section === 'today') threadsToday.prepend(btn);
    else threadsEarlier.appendChild(btn);
    threadBtns[id] = btn;
    return btn;
  }
  function setThreadTitle(id, title){ if(threadBtns[id]) threadBtns[id].textContent = title; }
  function setActive(id){
    Object.values(threadBtns).forEach(b => b.classList.remove('active'));
    if(threadBtns[id]) threadBtns[id].classList.add('active');
  }
  function markThreadUpdated(id){ if(threadBtns[id]) threadBtns[id].classList.add('has-update'); }
  function clearThreadUpdated(id){ if(threadBtns[id]) threadBtns[id].classList.remove('has-update'); }

  // Show a thread's log. Each log is built once, then persists across switches.
  function openThread(id){
    activeThread = id;
    empty.classList.add('hidden');

    let log = logs[id];
    const fresh = !log;
    if(fresh){
      log = document.createElement('div');
      log.className = 'log';
      log.dataset.log = id;
      messages.appendChild(log);
      logs[id] = log;
    }
    Object.keys(logs).forEach(k => { logs[k].style.display = (k === id) ? '' : 'none'; });

    if(fresh && builders[id]) builders[id]();   // fill it once

    input.value = ''; autosize(); send.disabled = true; input.focus();
    scrollDown();
  }

  function onThreadClick(id){
    setActive(id);
    // Opening the blinking coordinator chat: restore it, then reveal the replies.
    if(id === coordThread && laptopPending){
      laptopPending = false;
      clearThreadUpdated(id);
      openThread(id);
      laptopDonors();
      return;
    }
    openThread(id);
  }

  // A brand-new, empty chat. Titled "Nieuw gesprek" until Brian's first message.
  function newChat(){
    const id = 'chat-' + (++newChatCounter);
    makeThreadButton(id, 'Nieuw gesprek', 'today');
    builders[id] = ()=> renderGreeting();       // opens with the daily greeting
    awaitingFirst[id] = true;
    setActive(id);
    openThread(id);
  }

  // A past conversation shown under "Eerder".
  function buildHistoryThread(id){
    const h = HISTORY[id];
    makeThreadButton(id, h.title, 'earlier');
    builders[id] = ()=>{
      h.turns.forEach(t=>{
        if(t.user !== undefined){ addUser(t.user); }
        else if(t.person){
          const m = t.person;
          wireCardButton(botStatic(`<div class="txt">${fmt(m.reply)}</div>` + personCardHTML(m)));
        }
        else if(t.bot !== undefined){ botStatic(`<div class="txt">${fmt(t.bot)}</div>`); }
      });
    };
  }

  document.getElementById('newchat').addEventListener('click', newChat);

  /* ── Presenter backup hotkey (invisible): Ctrl+Shift+1 ──
     Opens a fresh chat and auto-sends the laptop intention. */
  document.addEventListener('keydown', e=>{
    if(e.ctrlKey && e.shiftKey && e.code === 'Digit1'){
      e.preventDefault();
      newChat();
      input.value = PRESETS.laptop; autosize();
      setTimeout(go, 300);
    }
  });

  /* ── Boot ───────────────────────────────────────────── */
  // Brian's own photo in the sidebar profile.
  const footAv = document.querySelector('.side .foot .av');
  if(footAv) footAv.innerHTML = `<img src="${USER.photo || portraitSVG(USER.av)}" alt="${esc(USER.name)}">`;

  Object.keys(HISTORY).forEach(buildHistoryThread);  // seed the two past chats
  newChat();                                         // open today's fresh chat
})();

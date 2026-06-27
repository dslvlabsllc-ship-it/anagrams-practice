(() => {
  const SCORE = {3:100,4:400,5:1200,6:2000,7:2200};
  const WORDS = window.TWL_WORDS || [];
  const wordSet = new Set(WORDS);
  const byLen = {5:[],6:[],7:[]};
  const playable = [];
  for (const w of WORDS) {
    if (w.length >= 3 && w.length <= 7) playable.push(w);
    if (byLen[w.length]) byLen[w.length].push(w);
  }
  const $ = id => document.getElementById(id);
  const screens = ['setup','game','results','allWords'];
  let renderScheduled = false;
  const state = {
    len: 6, time: 60, mode: 'random', letters: [], selected: [], found: new Set(),
    score: 0, remaining: 60, timerId: null, over: false, allWords: []
  };

  function show(id){ screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); }
  function pad(n){ return String(n).padStart(2,'0'); }
  function fmtScore(n){ return String(n).padStart(4,'0'); }
  function points(w){ return SCORE[w.length] || 0; }
  function canMake(word, letters){
    const counts = Object.create(null);
    for (const c of letters) counts[c] = (counts[c] || 0) + 1;
    for (const c of word) { if (!counts[c]) return false; counts[c]--; }
    return true;
  }
  function shuffleArray(a){
    for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
  function setGridCols(){
    const cols = `repeat(${state.len}, 1fr)`;
    $('selectedRow').style.gridTemplateColumns = cols;
    $('letterRow').style.gridTemplateColumns = cols;
  }
  function fullSolutions(letters, len){ return byLen[len].filter(w => canMake(w, letters)); }
  function allSolutions(letters){
    return playable.filter(w => w.length <= state.len && canMake(w, letters))
      .sort((a,b) => b.length-a.length || a.localeCompare(b));
  }
  function randomLetters(){
    const base = byLen[state.len][Math.floor(Math.random()*byLen[state.len].length)];
    const arr = base.split('');
    const last = base[base.length-1];
    let rest = arr.slice(0,-1);
    shuffleArray(rest);
    return rest.concat(last);
  }
  function startGame(){
    const err = $('setupError'); err.textContent = '';
    let letters;
    if (state.mode === 'custom') {
      const val = $('customLetters').value.toUpperCase().replace(/[^A-Z]/g,'');
      if (val.length !== state.len) { err.textContent = `Enter exactly ${state.len} letters.`; return; }
      letters = val.split('');
      if (!fullSolutions(letters, state.len).length) { err.textContent = `These letters need at least one ${state.len}-letter word.`; return; }
    } else {
      letters = randomLetters();
    }
    Object.assign(state, {letters, selected: [], found: new Set(), score:0, remaining: state.time, over:false});
    state.allWords = allSolutions(letters);
    renderGame();
    show('game');
    if (state.time === 0) { $('timer').classList.add('hidden'); $('endBtn').classList.remove('hidden'); }
    else { $('timer').classList.remove('hidden'); $('endBtn').classList.add('hidden'); tickLabel(); startTimer(); }
  }
  function startTimer(){
    clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      state.remaining--;
      tickLabel();
      if (state.remaining <= 0) finish();
    },1000);
  }
  function tickLabel(){ $('timer').textContent = `00:${pad(Math.max(0,state.remaining))}`; }

  function updateEnterButton(){
    const btn = $('enterBtn');
    btn.disabled = false;
    btn.classList.remove('soft-disabled');
    btn.style.opacity = '1';
  }
  function scheduleRender(){
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      renderGame();
    });
  }
  function renderGame(){
    setGridCols();
    $('wordCount').textContent = state.found.size;
    $('score').textContent = fmtScore(state.score);
    updateEnterButton();
    const sel = $('selectedRow'); sel.innerHTML = '';
    for (let i=0;i<state.len;i++) {
      const d = document.createElement('button');
      const item = state.selected[i];
      d.className = item ? 'tile' : 'slot ghost';
      d.textContent = item ? item.letter : '';
      if (item) d.dataset.selected = 'true';
      sel.appendChild(d);
    }
    const row = $('letterRow'); row.innerHTML = '';
    for (let i=0;i<state.letters.length;i++) {
      const used = state.selected.some(x => x.index === i);
      const cell = document.createElement('button');
      cell.className = 'letter-cell';
      cell.type = 'button';
      cell.dataset.index = String(i);

      const face = document.createElement('span');
      face.className = used ? 'slot' : 'tile';
      face.textContent = used ? '' : state.letters[i];

      cell.appendChild(face);
      if (!used) addFastTap(cell, () => selectLetter(i));
      row.appendChild(cell);
    }
    row.onGapTap = e => selectNearestLetterFromRow(e, row);
  }
  function selectLetter(i){
    if (state.over || state.selected.length >= state.len) return;
    if (state.selected.some(x => x.index === i)) return;

    state.selected.push({letter: state.letters[i], index:i});

    const selectedPos = state.selected.length - 1;

    const selectedSlots = $('selectedRow').children;
    if (selectedSlots[selectedPos]) {
      const slot = selectedSlots[selectedPos];
      slot.className = 'tile';
      slot.textContent = state.letters[i];
      slot.dataset.selected = 'true';
    }

    const letterCell = $('letterRow').children[i];
    if (letterCell) {
      const face = letterCell.firstElementChild;
      if (face) {
        face.className = 'slot';
        face.textContent = '';
      }
    }

    updateEnterButton();
  }
  function removeSelected(i){
    if (state.over) return;

    state.selected.splice(i,1);
    renderGame();
  }
  function submit(){
    if (state.over || state.selected.length < 3) return;
    const word = state.selected.map(x=>x.letter).join('');
    if (state.found.has(word)) {
      flash(`${word} (Already used)`, false);
    } else if (!wordSet.has(word)) {
      flash(`${word} (Not in the vocabulary)`, false);
    } else {
      const p = points(word);
      state.found.add(word); state.score += p;
      flash(`${word} (+${p})`, true);
    }
    state.selected = [];
    updateEnterButton();
    renderGame();
  }
  let toastTimer;
  function flash(msg, good){
    const t = $('toast');
    t.textContent = msg; t.className = `toast show ${good ? 'good':'bad'}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{t.className='toast';},700);
  }
  function shuffleLetters(){
    if (state.over) return;
    const selectedLetters = state.selected.map(x=>x.letter);
    const free = state.letters.map((l,i)=>({l,i})).filter((_,i)=>!state.selected.some(x=>x.index===i)).map(x=>x.l);
    shuffleArray(free);
    const newLetters = [];
    let f=0;
    const selectedIndexes = new Set(state.selected.map(x=>x.index));
    for (let i=0;i<state.len;i++) newLetters[i] = selectedIndexes.has(i) ? state.letters[i] : free[f++];
    state.letters = newLetters;
    state.selected = selectedLetters.map(letter => {
      const idx = state.letters.findIndex((l,i)=>l===letter && !state.selected.some(x=>x.newIndex===i));
      return {letter,index:idx,newIndex:idx};
    }).map(({letter,index})=>({letter,index}));
    renderGame();
  }
  function finish(){
    clearInterval(state.timerId); state.over = true;
    $('finalWords').textContent = state.found.size;
    $('finalScore').textContent = state.score;
    renderWordList('foundList', [...state.found].sort((a,b)=>b.length-a.length||a.localeCompare(b)), true, 14);
    show('results');
  }
  function renderWordList(id, words, cap=false, limit=9999){
    const el = $(id); el.innerHTML = '';
    const shown = words.slice(0,limit);
    for (const w of shown) {
      const row = document.createElement('div'); row.className = 'word-row' + (state.found.has(w) ? ' found':'');
      const chip = document.createElement('span'); chip.className = 'word-chip' + (state.found.has(w) ? '' : ' missed'); chip.textContent = state.found.has(w) || id === 'foundList' ? w : w;
      const pts = document.createElement('span'); pts.textContent = points(w);
      row.append(chip, pts); el.appendChild(row);
    }
    if (cap && words.length > limit) {
      const m = document.createElement('div'); m.className = 'more'; m.textContent = `(${words.length-limit} more)`; el.appendChild(m);
    }
  }
  function showAllWords(){
    renderWordList('allList', state.allWords, false);
    show('allWords');
  }

  function selectNearestLetterFromRow(e, row){
    if (e.target && e.target.closest && e.target.closest('button')) return;

    const allPositions = Array.from(row.children);
    if (!allPositions.length) return;

    const point = e.touches && e.touches[0] ? e.touches[0] : e;
    const x = point.clientX;
    const y = point.clientY;

    const rankedPositions = allPositions.map((tile, index) => {
      const rect = tile.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      return {
        tile,
        index,
        distance: dx * dx + dy * dy
      };
    }).sort((a, b) => a.distance - b.distance);

    const twoClosestPositions = rankedPositions.slice(0, 2);
    const closestAvailablePosition = twoClosestPositions.find(pos => pos.tile.querySelector('.tile'));

    if (!closestAvailablePosition) return;
    selectLetter(closestAvailablePosition.index);
  }

  function handleLetterRowTouch(e){
    if ($('game').classList.contains('hidden')) return;

    const row = $('letterRow');
    if (!row) return;

    const touch = e.touches && e.touches[0] ? e.touches[0] : null;
    if (!touch) return;

    const rect = row.getBoundingClientRect();
    const x = touch.clientX;
    const y = touch.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;

    e.preventDefault();
    e.stopPropagation();

    const cell = e.target && e.target.closest ? e.target.closest('#letterRow .letter-cell') : null;
    if (cell && cell.querySelector('.tile')) {
      const index = Number(cell.dataset.index);
      if (Number.isInteger(index) && index >= 0) selectLetter(index);
      return;
    }

    selectNearestLetterFromRow(e, row);
  }

  function handleSelectedRowTap(e){
    if (state.over) return;

    const row = $('selectedRow');
    const slot = e.target && e.target.closest ? e.target.closest('#selectedRow button') : null;
    if (!slot || !row.contains(slot)) return;

    const index = Array.from(row.children).indexOf(slot);
    if (index < 0 || index >= state.selected.length) return;

    removeSelected(index);
  }

  function addFastTap(el, handler){
    if (el._fastTapBound) return;
    el._fastTapBound = true;

    let lastTouchTime = 0;

    el.addEventListener('touchstart', e => {
      lastTouchTime = Date.now();
      handler(e);
    }, {passive:true});

    el.addEventListener('mousedown', e => {
      if (Date.now() - lastTouchTime < 600) return;
      handler(e);
    });
  }



  document.querySelectorAll('#lengthSeg button').forEach(b=>b.onclick=()=>{state.len=+b.dataset.length;document.querySelectorAll('#lengthSeg button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('customLetters').maxLength=state.len;});
  document.querySelectorAll('#timeSeg button').forEach(b=>b.onclick=()=>{state.time=+b.dataset.time;document.querySelectorAll('#timeSeg button').forEach(x=>x.classList.remove('active'));b.classList.add('active');});
  document.querySelectorAll('#modeSeg button').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;document.querySelectorAll('#modeSeg button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('customLetters').classList.toggle('show',state.mode==='custom');});
  $('startBtn').onclick=startGame;
  addFastTap($('enterBtn'), submit);
  addFastTap($('shuffleBtn'), shuffleLetters);
  addFastTap($('selectedRow'), handleSelectedRowTap);
  $('endBtn').onclick=finish;
  $('newBtn').onclick=()=>show('setup');
  $('resultsBack').onclick=()=>show('setup');
  $('viewAllBtn').onclick=showAllWords;
  $('allBack').onclick=()=>show('results');
  $('customLetters').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,state.len);});
  document.addEventListener('keydown', e => {
    if ($('game').classList.contains('hidden')) return;
    const k = e.key.toUpperCase();
    if (k === 'ENTER') submit();
    else if (k === 'BACKSPACE') { state.selected.pop(); scheduleRender(); }
    else if (/^[A-Z]$/.test(k)) {
      const idx = state.letters.findIndex((l,i)=>l===k && !state.selected.some(x=>x.index===i));
      if (idx >= 0) selectLetter(idx);
    }
  });
})();

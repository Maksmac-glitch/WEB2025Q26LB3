const SIZE = 4;
const KEY_BEST = "lb3-2048-best";
const KEY_LEADERS = "lb3-2048-leaders";

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "className") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const ch of children.flat()) { if (ch == null) continue; node.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch); }
  return node;
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); }

let board = makeEmptyBoard();
let score = 0;
let best = Number(localStorage.getItem(KEY_BEST) || 0);

const boardEl = document.getElementById("board");
const tilesLayer = document.getElementById("tiles");
const btnNew = document.getElementById("new-game");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");

const modal = document.getElementById("name-modal");
const finalScoreEl = document.getElementById("final-score");
const nameForm = document.getElementById("name-form");
const playerNameInput = document.getElementById("player-name");
const skipSaveBtn = document.getElementById("skip-save");
const leadersEl = document.getElementById("leaders");

function buildGrid() {
  if (tilesLayer.parentElement !== boardEl) boardEl.appendChild(tilesLayer);
  boardEl.querySelectorAll(".cell").forEach(n => n.remove());
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)
    boardEl.insertBefore(el("div",{className:"cell","data-row":String(r),"data-col":String(c)}), tilesLayer);
}

function makeEmptyBoard(){ return Array.from({length: SIZE}, () => Array(SIZE).fill(null)); }
function cloneBoard(b){ return b.map(row => row.map(t => t ? {...t} : null)); }
function randomEmptyCell(b){
  const empty = [];
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!b[r][c]) empty.push([r,c]);
  if(empty.length===0) return null;
  return empty[Math.floor(Math.random()*empty.length)];
}
function spawnRandom(b){
  const cell = randomEmptyCell(b);
  if(!cell) return false;
  const [r,c] = cell;
  b[r][c] = { id: uid(), v: Math.random() < 0.9 ? 2 : 4, spawn:true };
  return true;
}
function metrics(){
  const gap = parseFloat(getComputedStyle(boardEl).gap);
  const inner = tilesLayer.clientWidth;
  const size = (inner - gap*(SIZE-1)) / SIZE;
  return { gap, size };
}
const tileDom = new Map();
function renderTiles(){
  const { gap, size } = metrics();
  const seen = new Set(tileDom.keys());
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const t = board[r][c]; if (!t) continue;
    const x = c * (size + gap), y = r * (size + gap);
    let node = tileDom.get(t.id);
    if (!node) {
      node = el("div", { className: "tile v"+t.v });
      node.style.width = size + "px"; node.style.height = size + "px";
      node.style.setProperty("--x", x + "px"); node.style.setProperty("--y", y + "px");
      node.textContent = String(t.v);
      tilesLayer.appendChild(node);
      node.classList.add("spawn"); setTimeout(() => node.classList.remove("spawn"), 160);
      tileDom.set(t.id, node);
    } else {
      node.style.width = size + "px"; node.style.height = size + "px";
      node.style.setProperty("--x", x + "px"); node.style.setProperty("--y", y + "px");
      node.className = "tile v"+t.v; node.textContent = String(t.v);
    }
    seen.delete(t.id);
  }
  for (const id of seen) { const n = tileDom.get(id); if (n) n.remove(); tileDom.delete(id); }
  renderScore();
}
function renderScore(){ scoreEl.textContent = String(score); bestEl.textContent = String(best); }

function getLine(b, dir, i){
  return (dir==='left'||dir==='right') ? b[i].slice() : b.map(r=>r[i]);
}
function setLine(b, dir, i, line){
  if (dir==='left'||dir==='right') b[i] = line.slice();
  else for(let r=0;r<SIZE;r++) b[r][i] = line[r];
}
function mergeLine(line){
  const arr = line.filter(Boolean);
  const out = [];
  for (let i=0;i<arr.length;i++){
    const a = arr[i];
    if (i+1 < arr.length && arr[i+1].v === a.v){
      const nv = a.v*2;
      out.push({ id: uid(), v: nv });
      score += nv;
      i++;
    } else out.push({ id:a.id, v:a.v });
  }
  while (out.length < SIZE) out.push(null);
  return out;
}
function moveWithMerge(dir){
  let changed = false;
  for (let i=0;i<SIZE;i++){
    let line = getLine(board, dir, i);
    const rev = (dir==='right'||dir==='down');
    if (rev) line.reverse();
    const next = mergeLine(line);
    if (rev) next.reverse();
    for (let j=0;j<SIZE;j++) if ((line[j]?.id)!==(next[j]?.id) || (line[j]?.v)!==(next[j]?.v)) { changed = true; break; }
    setLine(board, dir, i, next);
  }
  return changed;
}
function canMove(b){
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!b[r][c]) return true;
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
    const t=b[r][c]; if(!t) continue;
    if(r+1<SIZE && b[r+1][c] && b[r+1][c].v===t.v) return true;
    if(c+1<SIZE && b[r][c+1] && b[r][c+1].v===t.v) return true;
  }
  return false;
}

function loadLeaders(){ try{ const raw=localStorage.getItem(KEY_LEADERS); const arr=raw?JSON.parse(raw):[]; return Array.isArray(arr)?arr:[]; }catch{ return []; } }
function saveLeader(name, points){
  const arr=loadLeaders();
  arr.push({ name:String(name||"Игрок").slice(0,24), score:Number(points)||0, ts:Date.now() });
  arr.sort((a,b)=> b.score-a.score || a.ts-b.ts);
  localStorage.setItem(KEY_LEADERS, JSON.stringify(arr.slice(0,10)));
  renderLeaders();
}
function renderLeaders(){
  while (leadersEl.firstChild) leadersEl.removeChild(leadersEl.firstChild);
  loadLeaders().slice(0,10).forEach((rec, idx) => {
    const li = el("li");
    const name = el("span", { className:"name", text: `${idx+1}. ${rec.name}` });
    const pts  = el("span", { className:"pts",  text: String(rec.score) });
    li.append(name, pts);
    leadersEl.appendChild(li);
  });
}

function finishGame(){
  finalScoreEl.textContent = String(score);
  playerNameInput.value = "";
  modal.classList.remove("hide");
  playerNameInput.focus();
}
function closeModal(){ modal.classList.add("hide"); }

function newGame(){
  board = makeEmptyBoard(); score = 0;
  spawnRandom(board); spawnRandom(board);
  renderTiles(); renderScore();
}
function handleMove(dir){
  if (!moveWithMerge(dir)) return;
  if (score > best) { best = score; localStorage.setItem(KEY_BEST, String(best)); }
  spawnRandom(board); renderTiles(); renderScore();
  if (!canMove(board)) setTimeout(finishGame, 80);
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase(); if (k.startsWith("arrow")) e.preventDefault();
  if (k==='arrowleft'||k==='a') handleMove('left');
  else if (k==='arrowright'||k==='d') handleMove('right');
  else if (k==='arrowup'||k==='w') handleMove('up');
  else if (k==='arrowdown'||k==='s') handleMove('down');
});
btnNew.addEventListener("click", newGame);

nameForm.addEventListener("submit",(e)=>{ e.preventDefault(); saveLeader((playerNameInput.value||"").trim()||"Игрок",score); closeModal(); newGame(); });
skipSaveBtn.addEventListener("click",()=>{ closeModal(); newGame(); });

buildGrid();
renderLeaders();
bestEl.textContent = String(best);
newGame();

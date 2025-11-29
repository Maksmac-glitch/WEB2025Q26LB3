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
const undoStack = [];

const boardEl = document.getElementById("board");
const tilesLayer = document.getElementById("tiles");
const btnNew = document.getElementById("new-game");
const btnUndo = document.getElementById("undo");
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
function xyFor(r,c){ const {gap,size}=metrics(); return { x:c*(size+gap), y:r*(size+gap), size }; }

const tileDom = new Map();
let animating = false;
function renderTiles(){
  const { gap, size } = metrics();
  const seen = new Set(tileDom.keys());
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const t = board[r][c]; if (!t) continue;
    const x = c * (size + gap), y = r * (size + gap);
    let node = tileDom.get(t.id);
    if (!node) {
      if (animating) continue;
      node = el("div", { className: "tile v"+t.v });
      node.style.width = size + "px"; node.style.height = size + "px";
      node.style.setProperty("--x", x + "px"); node.style.setProperty("--y", y + "px");
      node.textContent = String(t.v);
      tilesLayer.appendChild(node);
      node.classList.add(t.merge ? "merge" : "spawn"); setTimeout(() => node.classList.remove("merge","spawn"), 180);
      tileDom.set(t.id, node);
    } else {
      node.style.width = size + "px"; node.style.height = size + "px";
      node.style.setProperty("--x", x + "px"); node.style.setProperty("--y", y + "px");
      node.className = "tile v"+t.v; node.textContent = String(t.v);
    }
    if (t.merge) t.merge = false;
    seen.delete(t.id);
  }
  if (!animating) for (const id of seen) { const n = tileDom.get(id); if (n) n.remove(); tileDom.delete(id); }
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

function moveWithPlan(b, dir){
  const plan = []; let gained = 0;
  const seq = (i)=> dir==="left" ? Array.from({length:SIZE},(_,j)=>[i,j])
    : dir==="right" ? Array.from({length:SIZE},(_,j)=>[i,SIZE-1-j])
    : dir==="up" ? Array.from({length:SIZE},(_,j)=>[j,i])
    : Array.from({length:SIZE},(_,j)=>[SIZE-1-j,i]);

  for (let i=0;i<SIZE;i++){
    const coords = seq(i), tiles = [];
    for (const [r,c] of coords) if (b[r][c]) tiles.push({ t:b[r][c], r, c });
    const out = Array(SIZE).fill(null); let w=0, k=0;
    while (k < tiles.length){
      const a = tiles[k]; const hasB = k+1<tiles.length && tiles[k+1].t.v===a.t.v;
      const [wr,wc] = coords[w];
      if (hasB){
        const b2 = tiles[k+1]; const nv = a.t.v*2;
        out[w] = { id: uid(), v: nv, merge:true }; gained += nv;
        plan.push({ id:a.t.id, from:[a.r,a.c], to:[wr,wc], remove:true });
        plan.push({ id:b2.t.id, from:[b2.r,b2.c], to:[wr,wc], remove:true });
        w++; k+=2;
      } else {
        out[w] = { id:a.t.id, v:a.t.v };
        plan.push({ id:a.t.id, from:[a.r,a.c], to:[wr,wc], remove:false });
        w++; k+=1;
      }
    }
    for (let j=0;j<SIZE;j++){ const [r,c]=coords[j]; b[r][c]=out[j]; }
  }
  const moved = plan.some(m => m.from[0]!==m.to[0] || m.from[1]!==m.to[1] || m.remove);
  return { moved, gained, plan };
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
function animatePlan(plan, done){
  animating = true;
  const updates = [];
  for (const m of plan){
    const n = tileDom.get(m.id); if (!n) continue;
    const { x,y,size } = xyFor(m.to[0], m.to[1]);
    n.style.width = size + "px"; n.style.height = size + "px";
    n.style.setProperty("--x", x + "px"); n.style.setProperty("--y", y + "px");
    updates.push({ node:n, remove:m.remove });
  }
  setTimeout(() => {
    for (const u of updates) if (u.remove){
      if (u.node.parentNode) u.node.parentNode.removeChild(u.node);
      for (const [id, el] of tileDom.entries()) if (el===u.node) tileDom.delete(id);
    }
    animating = false; done();
  }, 180);
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

function pushUndo(){ undoStack.push({ b: cloneBoard(board), s: score }); if (undoStack.length>30) undoStack.shift(); btnUndo.disabled=false; }
function undo(){ if(!undoStack.length) return; const prev=undoStack.pop(); board=prev.b; score=prev.s; btnUndo.disabled=undoStack.length===0; renderTiles(); renderScore(); }

function newGame(){
  board = makeEmptyBoard(); score = 0; undoStack.length=0; btnUndo.disabled=true;
  spawnRandom(board); spawnRandom(board);
  renderTiles(); renderScore();
}
function handleMove(dir){
  pushUndo();
  const res = moveWithPlan(board, dir);
  if (!res.moved) { undoStack.pop(); btnUndo.disabled=undoStack.length===0; return; }
  animatePlan(res.plan, () => {
    score += res.gained;
    if (score > best) { best = score; localStorage.setItem(KEY_BEST, String(best)); }
    spawnRandom(board); renderTiles(); renderScore();
    if (!canMove(board)) setTimeout(finishGame, 80);
  });
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase(); if (k.startsWith("arrow")) e.preventDefault();
  if (k==='arrowleft'||k==='a') handleMove('left');
  else if (k==='arrowright'||k==='d') handleMove('right');
  else if (k==='arrowup'||k==='w') handleMove('up');
  else if (k==='arrowdown'||k==='s') handleMove('down');
});
btnNew.addEventListener("click", newGame);
btnUndo.addEventListener("click", undo);

nameForm.addEventListener("submit",(e)=>{ e.preventDefault(); saveLeader((playerNameInput.value||"").trim()||"Игрок",score); closeModal(); newGame(); });
skipSaveBtn.addEventListener("click",()=>{ closeModal(); newGame(); });

buildGrid();
renderLeaders();
bestEl.textContent = String(best);
newGame();
renderScore();

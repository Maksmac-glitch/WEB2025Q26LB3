const SIZE = 4;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "className") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const ch of children.flat()) {
    if (ch == null) continue;
    node.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch);
  }
  return node;
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); }

let board = makeEmptyBoard();

const boardEl = document.getElementById("board");
const tilesLayer = document.getElementById("tiles");
const btnNew = document.getElementById("new-game");

function buildGrid() {
  if (tilesLayer.parentElement !== boardEl) boardEl.appendChild(tilesLayer);
  boardEl.querySelectorAll(".cell").forEach(n => n.remove());
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)
    boardEl.insertBefore(el("div",{className:"cell","data-row":String(r),"data-col":String(c)}), tilesLayer);
}

function makeEmptyBoard(){ return Array.from({length: SIZE}, () => Array(SIZE).fill(null)); }
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
}

function getLine(b, dir, i){
  return (dir==='left'||dir==='right') ? b[i].slice() : b.map(r=>r[i]);
}
function setLine(b, dir, i, line){
  if (dir==='left'||dir==='right') b[i] = line.slice();
  else for(let r=0;r<SIZE;r++) b[r][i] = line[r];
}
function compact(line){
  const arr = line.filter(Boolean);
  while (arr.length < SIZE) arr.push(null);
  return arr;
}
function moveSimple(dir){
  let changed = false;
  for (let i=0;i<SIZE;i++){
    let line = getLine(board, dir, i);
    const rev = (dir==='right'||dir==='down');
    if (rev) line.reverse();
    const next = compact(line);
    if (rev) next.reverse();
    for (let j=0;j<SIZE;j++) if ((line[j]?.id)!==(next[j]?.id)) { changed = true; break; }
    setLine(board, dir, i, next);
  }
  return changed;
}

function newGame(){
  board = makeEmptyBoard();
  spawnRandom(board); spawnRandom(board);
  renderTiles();
}
function handleMove(dir){
  if (!moveSimple(dir)) return;
  spawnRandom(board); renderTiles();
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase(); if (k.startsWith("arrow")) e.preventDefault();
  if (k==='arrowleft'||k==='a') handleMove('left');
  else if (k==='arrowright'||k==='d') handleMove('right');
  else if (k==='arrowup'||k==='w') handleMove('up');
  else if (k==='arrowdown'||k==='s') handleMove('down');
});
btnNew.addEventListener("click", newGame);

buildGrid();
newGame();

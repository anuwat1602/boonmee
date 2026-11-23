const socket = io();

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");
const welcome = document.getElementById("welcome");
const releaseBtn = document.getElementById("releaseBtn");
const carryBtn = document.getElementById("carryBtn");
const carryLabel = document.getElementById("carryLabel");
const toast = document.getElementById("toast");

const WORLD_W = 1200;
const WORLD_H = 675;
const RIVER_START = 205;
const RIVER_END = 420;

let joined = false;
let carrying = false;
let selectedKrathong = null;
let soundEnabled = false;
let audioContext = null;
let ambientGain = null;
let moveTime = 0;
let lastSent = 0;
let lastMoveFrame = 0;
const keys = new Set();
const players = new Map();
const krathongs = new Map();
const fireworks = [];
const lanterns = [];
const heartBursts = [];

const me = { id: "self", name: "", outfit: "thai", prayer: "", krathongType: "lotus", x: 360, y: 390, direction: "down", carrying: false, moving: false };

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

function worldTransform() {
  const scale = Math.max(innerWidth / WORLD_W, innerHeight / WORLD_H);
  return { scale, x: (innerWidth - WORLD_W * scale) / 2, y: (innerHeight - WORLD_H * scale) / 2 };
}

function screenPoint(x, y) {
  const t = worldTransform();
  return { x: x * t.scale + t.x, y: y * t.scale + t.y };
}

function canvasPoint(clientX, clientY) {
  const t = worldTransform();
  return { x: (clientX - t.x) / t.scale, y: (clientY - t.y) / t.scale };
}

function roundedRect(context, x, y, w, h, r) {
  context.beginPath();
  context.roundRect(x, y, w, h, r);
}

function drawSkyAndBank(time) {
  const night = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  night.addColorStop(0, "#071426");
  night.addColorStop(.52, "#0b1d2c");
  night.addColorStop(1, "#142b36");
  ctx.fillStyle = night;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.fillStyle = "rgba(255,247,210,.9)";
  ctx.beginPath(); ctx.arc(1000, 75, 27, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#071426";
  ctx.beginPath(); ctx.arc(990, 68, 25, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#091c25";
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(1200, 0); ctx.lineTo(1200, RIVER_START);
  ctx.bezierCurveTo(900, 170, 340, 245, 0, RIVER_START); ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#06121b";
  ctx.beginPath();
  ctx.moveTo(0, RIVER_END); ctx.bezierCurveTo(350, 390, 920, 450, 1200, RIVER_END);
  ctx.lineTo(1200, 675); ctx.lineTo(0, 675); ctx.closePath(); ctx.fill();

  const river = ctx.createLinearGradient(0, RIVER_START, 0, RIVER_END);
  river.addColorStop(0, "#183b4a"); river.addColorStop(.5, "#1d4b5a"); river.addColorStop(1, "#112f3d");
  ctx.fillStyle = river;
  ctx.beginPath();
  ctx.moveTo(0, RIVER_START); ctx.bezierCurveTo(350, 180, 850, 250, 1200, RIVER_START);
  ctx.lineTo(1200, RIVER_END); ctx.bezierCurveTo(850, 440, 350, 390, 0, RIVER_END); ctx.closePath(); ctx.fill();

  ctx.globalAlpha = .18;
  ctx.strokeStyle = "#a7e1df"; ctx.lineWidth = 1;
  for (let y = RIVER_START + 24; y < RIVER_END; y += 24) {
    for (let x = -40; x < 1240; x += 95) {
      const shift = Math.sin(time / 1200 + x / 80 + y) * 18;
      ctx.beginPath(); ctx.moveTo(x + shift, y); ctx.bezierCurveTo(x + 25 + shift, y - 4, x + 48 + shift, y + 4, x + 75 + shift, y); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,220,142,.09)";
  ctx.beginPath(); ctx.ellipse(1000, 260, 110, 20, -.04, 0, Math.PI * 2); ctx.fill();

  drawBoatsAndBank(time);
}

function drawBoatsAndBank(time) {
  ctx.fillStyle = "#4b3427";
  ctx.fillRect(0, RIVER_START - 22, 1200, 8);
  ctx.fillStyle = "#7b6044";
  for (let x = 20; x < 1200; x += 80) ctx.fillRect(x, RIVER_START - 26, 5, 22);

  ctx.fillStyle = "#061c24";
  ctx.fillRect(0, RIVER_END - 2, 1200, 9);
  ctx.fillStyle = "#78543a";
  for (let x = 30; x < 1200; x += 75) ctx.fillRect(x, RIVER_END - 8, 5, 23);

  const stalls = [
    [90, 92, "#d36c48"], [210, 74, "#e8aa55"], [1050, 88, "#c75c65"], [1120, 112, "#d68a46"]
  ];
  stalls.forEach(([x, y, color], i) => {
    ctx.fillStyle = "#2a1d18"; ctx.fillRect(x - 54, y + 22, 108, 8);
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 58, y + 22); ctx.lineTo(x, y - 8); ctx.lineTo(x + 58, y + 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,188,92,.85)";
    ctx.beginPath(); ctx.arc(x, y + 40, 5 + Math.sin(time / 400 + i) * 1.5, 0, Math.PI * 2); ctx.fill();
  });

  drawLanternPole(180, 145, time);
  drawLanternPole(930, 132, time);
  drawLanternPole(820, 160, time);

  ctx.fillStyle = "#0a3429";
  [[25, 40], [310, 55], [710, 45], [780, 70]].forEach(([x,y]) => {
    ctx.fillRect(x - 4, y + 25, 8, 28);
    ctx.beginPath(); ctx.arc(x, y + 20, 30, 0, Math.PI*2); ctx.fill();
  });
}

function drawLanternPole(x, y, time) {
  ctx.strokeStyle = "#5c432d"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, y + 55); ctx.lineTo(x, y - 10); ctx.stroke();
  ctx.fillStyle = `rgba(255,180,85,${.7 + Math.sin(time/300+x)*.2})`;
  ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x, y - 12, x + 9, y); ctx.lineTo(x + 7, y + 20); ctx.quadraticCurveTo(x, y + 27, x - 7, y + 20); ctx.closePath(); ctx.fill();
}

function drawCharacter(player, time) {
  const bob = player.moving ? Math.sin(time / 90 + player.x) * 2 : 0;
  ctx.save(); ctx.translate(player.x, player.y + bob);
  ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(0, 12, 13, 5, 0, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = player.outfit === "thai" ? "#d8ad69" : "#6db0ba";
  ctx.beginPath(); ctx.roundRect(-10, -7, 20, 23, 5); ctx.fill();
  ctx.fillStyle = player.outfit === "thai" ? "#f0d39b" : "#b8dde2";
  ctx.beginPath(); ctx.arc(0, -12, 8, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#1b2d38";
  ctx.beginPath(); ctx.arc(0, -15, 8.5, Math.PI, Math.PI*2); ctx.fill();

  if (player.moving) {
    ctx.fillStyle = "#263847";
    ctx.fillRect(-8, 14, 5, 7 + Math.abs(Math.sin(time/90))*3);
    ctx.fillRect(3, 14, 5, 7 + Math.abs(Math.cos(time/90))*3);
  } else {
    ctx.fillStyle = "#263847"; ctx.fillRect(-8, 14, 5, 8); ctx.fillRect(3, 14, 5, 8);
  }

  if (player.carrying) drawHeldKrathong(0, -3, player.krathongType, time);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.font = "12px Kanit";
  ctx.fillStyle = "rgba(5,18,29,.78)";
  ctx.fillRect(player.x - ctx.measureText(player.name).width / 2 - 5, player.y - 40, ctx.measureText(player.name).width + 10, 19);
  ctx.fillStyle = player.id === "self" ? "#ffe09a" : "#edf7ff";
  ctx.fillText(player.name, player.x, player.y - 26);
}

function drawHeldKrathong(x, y, type, time) {
  ctx.save(); ctx.translate(x + (me.direction === "left" ? -16 : 16), y - 18);
  ctx.fillStyle = "#694f2d"; ctx.beginPath(); ctx.ellipse(0, 8, 10, 5, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = type === "lotus" ? "#db7e9a" : type === "bread" ? "#b9793d" : "#b6b85d";
  ctx.beginPath(); ctx.ellipse(0, 4, 9, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#fff2a6";
  ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawKrathong(k, time) {
  const bob = Math.sin(time / 550 + k.x / 25) * 2;
  ctx.save(); ctx.translate(k.x, k.y + bob);
  ctx.fillStyle = "rgba(2,10,18,.3)"; ctx.beginPath(); ctx.ellipse(0, 7, 21, 7, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = k.type === "bread" ? "#9f6938" : k.type === "lotus" ? "#49763f" : "#a0a84b";
  ctx.beginPath(); ctx.ellipse(0, 2, 18, 7, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = k.type === "lotus" ? "#e49aab" : k.type === "bread" ? "#d3a25c" : "#d0d29a";
  ctx.beginPath(); ctx.ellipse(0, -1, 14, 5, 0, 0, Math.PI*2); ctx.fill();

  const flicker = .8 + Math.sin(time / 70 + k.x) * .18;
  ctx.shadowColor = "#ffc75d"; ctx.shadowBlur = 14 * flicker;
  ctx.fillStyle = "#ffd66a"; ctx.beginPath(); ctx.arc(0, -7, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawFireworks(time) {
  fireworks.forEach((f, fi) => {
    f.age += 16;
    const life = f.age / 1000;
    if (life > 1.2) return;
    const color = f.color === "pink" ? "#ff86a8" : f.color === "blue" ? "#78d7ff" : "#ffd275";
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - life);
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2;
      const dist = life * 75;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(f.x + Math.cos(angle) * dist, f.y + Math.sin(angle) * dist + life * 18, 2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  });
  for (let i = fireworks.length - 1; i >= 0; i--) if (fireworks[i].age > 1500) fireworks.splice(i, 1);

  lanterns.forEach(l => {
    l.age += 16; l.y -= .24;
    ctx.save(); ctx.translate(l.x, l.y);
    ctx.shadowColor = "#ffb95a"; ctx.shadowBlur = 18;
    ctx.fillStyle = "#ff9e43"; ctx.fillRect(-7, -11, 14, 20);
    ctx.fillStyle = "#ffe6a0"; ctx.fillRect(-4, -8, 8, 14);
    ctx.restore();
  });
  for (let i = lanterns.length - 1; i >= 0; i--) if (lanterns[i].y < 20) lanterns.splice(i, 1);

  heartBursts.forEach(h => {
    h.age += 16;
    ctx.globalAlpha = Math.max(0, 1 - h.age / 900);
    ctx.fillStyle = "#ff9ba8"; ctx.font = "18px Kanit"; ctx.fillText("♡", h.x, h.y - h.age / 35);
  });
  ctx.globalAlpha = 1;
  for (let i = heartBursts.length - 1; i >= 0; i--) if (heartBursts[i].age > 900) heartBursts.splice(i, 1);
}

function render(time = 0) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const t = worldTransform();
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(t.scale, t.scale);
  drawSkyAndBank(time);

  krathongs.forEach(k => drawKrathong(k, time));
  players.forEach(p => drawCharacter(p, time));
  drawCharacter(me, time);
  drawFireworks(time);
  ctx.restore();

  requestAnimationFrame(render);
}

function updateMovement(time) {
  if (!joined) {
    lastMoveFrame = time;
    requestAnimationFrame(updateMovement);
    return;
  }
  const elapsed = Math.min(32, time - (lastMoveFrame || time));
  lastMoveFrame = time;
  const speed = elapsed * 0.14;
  let dx = 0, dy = 0;
  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;
  if (dx && dy) { dx *= .707; dy *= .707; }

  if (dx || dy) {
    me.x = Math.max(18, Math.min(WORLD_W - 18, me.x + dx * speed));
    me.y = Math.max(18, Math.min(WORLD_H - 18, me.y + dy * speed));
    me.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    me.moving = true;
  } else {
    me.moving = false;
  }

  const nearRiver = me.y >= RIVER_START - 20 && me.y <= RIVER_END + 8;
  releaseBtn.disabled = !carrying || !nearRiver;
  releaseBtn.title = !nearRiver ? "เดินมาที่ขอบแม่น้ำก่อน" : "";

  if (time - lastSent > 50) {
    lastSent = time;
    socket.emit("player:update", me);
  }
  requestAnimationFrame(updateMovement);
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 1800);
}

document.getElementById("joinBtn").addEventListener("click", () => {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) {
    document.getElementById("nameInput").focus();
    showToast("กรุณากรอกชื่อเล่น");
    return;
  }
  me.name = name;
  me.outfit = document.querySelector('input[name="outfit"]:checked').value;
  me.krathongType = document.querySelector('input[name="krathong"]:checked').value;
  me.prayer = document.getElementById("prayerInput").value.trim();
  socket.emit("player:join", me);
  joined = true;
  welcome.classList.add("hidden");
  updateOnlineCount();
  initAudio();
});

window.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"," "].includes(key)) e.preventDefault();
  keys.add(key);
});
window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());

document.querySelectorAll("#dpad button").forEach(button => {
  const keyMap = { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" };
  const add = e => { e.preventDefault(); keys.add(keyMap[button.dataset.dir]); };
  const remove = e => { e.preventDefault(); keys.delete(keyMap[button.dataset.dir]); };
  button.addEventListener("pointerdown", add);
  button.addEventListener("pointerdown", e => {
    if (button.setPointerCapture) button.setPointerCapture(e.pointerId);
  });
  button.addEventListener("pointerup", remove);
  button.addEventListener("pointercancel", remove);
  button.addEventListener("pointerleave", remove);
});

carryBtn.addEventListener("click", () => {
  if (!joined) return;
  carrying = !carrying;
  me.carrying = carrying;
  carryLabel.textContent = carrying ? "วางลง" : "ถือกระทง";
  carryBtn.classList.toggle("active", carrying);
  showToast(carrying ? "เดินไปที่ขอบแม่น้ำเพื่อลอยกระทง" : "เก็บกระทงแล้ว");
  socket.emit("player:update", me);
});

releaseBtn.addEventListener("click", () => {
  if (!carrying) return;
  const nearRiver = me.y >= RIVER_START - 20 && me.y <= RIVER_END + 8;
  if (!nearRiver) { showToast("เดินไปที่ขอบแม่น้ำก่อน"); return; }
  socket.emit("krathong:release", { x: me.x, y: me.y + 34, prayer: me.prayer });
  carrying = false;
  me.carrying = false;
  carryLabel.textContent = "ถือกระทง";
  releaseBtn.disabled = true;
  showToast("อธิษฐานลงไปกับกระแสน้ำ");
});

canvas.addEventListener("pointerdown", e => {
  const p = canvasPoint(e.clientX, e.clientY);
  let hit = null;
  krathongs.forEach(k => {
    if (Math.hypot(k.x - p.x, k.y - p.y) < 24) hit = k;
  });
  if (hit) openKrathongPanel(hit);
});

function openKrathongPanel(k) {
  selectedKrathong = k;
  document.getElementById("krathongPanel").classList.remove("hidden");
  document.getElementById("panelOwner").textContent = k.ownerName;
  document.getElementById("panelPrayer").textContent = k.prayer || "ขอพรด้วยใจบริสุทธิ์";
  document.getElementById("heartCount").textContent = k.hearts || 0;
}
document.getElementById("closePanel").addEventListener("click", () => document.getElementById("krathongPanel").classList.add("hidden"));
document.getElementById("heartBtn").addEventListener("click", () => {
  if (!selectedKrathong) return;
  socket.emit("krathong:heart", selectedKrathong.id);
  const k = selectedKrathong;
  heartBursts.push({ x: k.x, y: k.y, age: 0 });
});

document.getElementById("fireworkBtn").addEventListener("click", () => {
  if (!joined) return;
  const x = 180 + Math.random() * 840;
  const y = 70 + Math.random() * 120;
  socket.emit("effect:firework", { x, y, color: ["gold","pink","blue"][Math.floor(Math.random()*3)] });
});
document.getElementById("lanternBtn").addEventListener("click", () => {
  if (!joined) return;
  const x = 120 + Math.random() * 960;
  socket.emit("effect:lantern", { x, color: "gold" });
});

socket.on("world:init", data => {
  data.players?.forEach(p => { if (p.id !== socket.id) players.set(p.id, p); });
  data.krathongs?.forEach(k => krathongs.set(k.id, k));
  me.id = socket.id;
  updateOnlineCount();
});
socket.on("player:joined", p => { players.set(p.id, p); updateOnlineCount(); });
socket.on("player:moved", p => {
  const player = players.get(p.id);
  if (player) Object.assign(player, p);
});
socket.on("player:left", id => { players.delete(id); updateOnlineCount(); });
socket.on("krathong:released", k => krathongs.set(k.id, k));
socket.on("world:tick", list => list.forEach(k => {
  const local = krathongs.get(k.id);
  if (local) { local.x = k.x; local.y = k.y; } else krathongs.set(k.id, k);
}));
socket.on("krathong:hearted", data => {
  const k = krathongs.get(data.id);
  if (k) k.hearts = data.hearts;
  if (selectedKrathong?.id === data.id) document.getElementById("heartCount").textContent = data.hearts;
});
socket.on("effect:firework", f => fireworks.push({ ...f, age: 0 }));
socket.on("effect:lantern", l => lanterns.push({ x: l.x, y: 510, age: 0 }));

function updateOnlineCount() {
  document.getElementById("onlineCount").textContent = players.size + 1;
}

function initAudio() {
  if (audioContext) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  ambientGain = audioContext.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(audioContext.destination);

  const bufferSize = 2 * audioContext.sampleRate;
  const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * .12;
  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer; noise.loop = true;
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass"; filter.frequency.value = 700;
  noise.connect(filter); filter.connect(ambientGain); noise.start();
}

document.getElementById("soundBtn").addEventListener("click", async () => {
  initAudio();
  if (audioContext.state === "suspended") await audioContext.resume();
  soundEnabled = !soundEnabled;
  ambientGain.gain.cancelScheduledValues(audioContext.currentTime);
  ambientGain.gain.linearRampToValueAtTime(soundEnabled ? .18 : 0, audioContext.currentTime + .5);
  document.getElementById("soundBtn").textContent = soundEnabled ? "เสียงเปิด" : "เสียงปิด";
});

requestAnimationFrame(render);
requestAnimationFrame(updateMovement);

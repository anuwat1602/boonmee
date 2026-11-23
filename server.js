const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true }));

const players = new Map();
const krathongs = new Map();
const MAX_KRATHONGS = 250;

function sanitizeText(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/[\x00-\x1f\x7f]/g, "").slice(0, maxLength).trim()
    : "";
}

io.on("connection", (socket) => {
  socket.emit("world:init", {
    players: [...players.values()],
    krathongs: [...krathongs.values()],
  });

  socket.on("player:join", (profile) => {
    const player = {
      id: socket.id,
      name: sanitizeText(profile?.name, 18) || "ผู้มาเยือน",
      outfit: ["thai", "casual"].includes(profile?.outfit) ? profile.outfit : "thai",
      prayer: sanitizeText(profile?.prayer, 140),
      krathongType: ["banana", "lotus", "bread"].includes(profile?.krathongType)
        ? profile.krathongType
        : "lotus",
      x: 360,
      y: 390,
      direction: "down",
      carrying: false,
      moving: false,
    };
    players.set(socket.id, player);
    socket.broadcast.emit("player:joined", player);
  });

  socket.on("player:update", (data) => {
    const player = players.get(socket.id);
    if (!player) return;
    player.x = Math.max(20, Math.min(1180, Number(data?.x) || player.x));
    player.y = Math.max(20, Math.min(620, Number(data?.y) || player.y));
    player.direction = ["up", "down", "left", "right"].includes(data?.direction)
      ? data.direction
      : player.direction;
    player.moving = Boolean(data?.moving);
    player.carrying = Boolean(data?.carrying);
    socket.broadcast.emit("player:moved", {
      id: socket.id,
      x: player.x,
      y: player.y,
      direction: player.direction,
      moving: player.moving,
      carrying: player.carrying,
    });
  });

  socket.on("krathong:release", (data) => {
    const player = players.get(socket.id);
    if (!player) return;
    if (krathongs.size >= MAX_KRATHONGS) {
      const oldest = krathongs.keys().next().value;
      krathongs.delete(oldest);
    }
    const id = `${socket.id}-${Date.now()}`;
    const krathong = {
      id,
      ownerId: socket.id,
      ownerName: player.name,
      type: player.krathongType,
      prayer: sanitizeText(data?.prayer || player.prayer, 140),
      x: Number(data?.x) || player.x,
      y: Math.max(180, Number(data?.y) || player.y),
      hearts: 0,
      createdAt: Date.now(),
    };
    krathongs.set(id, krathong);
    player.carrying = false;
    io.emit("krathong:released", krathong);
  });

  socket.on("krathong:heart", (krathongId) => {
    const krathong = krathongs.get(sanitizeText(krathongId, 100));
    if (!krathong) return;
    krathong.hearts = Math.min(999, krathong.hearts + 1);
    io.emit("krathong:hearted", { id: krathong.id, hearts: krathong.hearts });
  });

  socket.on("effect:firework", (data) => {
    io.emit("effect:firework", {
      id: socket.id,
      x: Math.max(40, Math.min(1160, Number(data?.x) || 600)),
      y: Math.max(40, Math.min(420, Number(data?.y) || 180)),
      color: sanitizeText(data?.color, 20) || "gold",
    });
  });

  socket.on("effect:lantern", (data) => {
    io.emit("effect:lantern", {
      id: socket.id,
      x: Math.max(80, Math.min(1120, Number(data?.x) || 600)),
      color: sanitizeText(data?.color, 20) || "gold",
    });
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    io.emit("player:left", socket.id);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, krathong] of krathongs) {
    krathong.x += 0.32;
    krathong.y += Math.sin(now / 700 + krathong.x / 30) * 0.035;
    if (krathong.x > 1250) krathongs.delete(id);
  }
  io.emit("world:tick", [...krathongs.values()]);
}, 100);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Loy Krathong Virtual World listening at http://localhost:${PORT}`);
});

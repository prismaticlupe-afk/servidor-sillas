
const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer((req, res) => {
  res.write("Servidor Sillas Locas - ACTIVO");
  res.end();
});

// Configuración de CORS
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Jugador conectado:", socket.id);

  // 1. Unirse a sala
  socket.on("JOIN_ROOM", ({ room, player }) => {
    socket.join(room);
    socket.to(room).emit("PLAYER_JOINED", player);
  });

  // 2. Movimiento
  socket.on("UPDATE_POS", (data) => {
    socket.to(data.room).emit("UPDATE_POS", data);
  });

  // 3. Eventos del juego (Sillas)
  socket.on("GAME_EVENT", (data) => {
    io.in(data.room).emit("GAME_EVENT", data);
  });

  // 4. CHAT (¡ESTO ES LO NUEVO!)
  socket.on("CHAT_MESSAGE", (data) => {
    // data tiene: { room, name, text }
    // io.in envía el mensaje a TODOS en la sala (incluido tú)
    io.in(data.room).emit("CHAT_MESSAGE", data);
  });

});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});

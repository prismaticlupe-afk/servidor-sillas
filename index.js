const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer((req, res) => {
  res.write("Servidor Sillas Locas - ACTIVO");
  res.end();
});

// ESTO ES LO QUE ARREGLA TU PROBLEMA (CORS)
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Jugador conectado:", socket.id);

  socket.on("JOIN_ROOM", ({ room, player }) => {
    socket.join(room);
    socket.to(room).emit("PLAYER_JOINED", player);
  });

  socket.on("UPDATE_POS", (data) => {
    socket.to(data.room).emit("UPDATE_POS", data);
  });

  socket.on("GAME_EVENT", (data) => {
    io.in(data.room).emit("GAME_EVENT", data);
  });
});

// Render usa el puerto que le da la gana, esto lo detecta auto
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});

const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer((req, res) => {
  res.write("Servidor Sillas Locas - ACTIVO");
  res.end();
});

// Almacén de estado de jugadores en el servidor
// Formato: { socketId: { room, id, name, modelUrl, x, y, z, rot, action } }
let serverPlayers = {};

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

    // Guardar jugador en memoria del servidor con posición inicial
    serverPlayers[socket.id] = { 
        ...player, 
        room, 
        x: 0, y: 0, z: 0, rot: 0, action: 'idle' 
    };

    // A) Notificar a los demás que alguien entró
    socket.to(room).emit("PLAYER_JOINED", player);

    // B) [CORRECCIÓN] Enviar al NUEVO jugador la lista de los que ya están
    // Filtramos para enviar solo los de esta sala y que no sea él mismo
    const playersInRoom = Object.values(serverPlayers).filter(p => p.room === room && p.id !== player.id);
    socket.emit("CURRENT_PLAYERS", playersInRoom);
  });

  // 2. Movimiento
  socket.on("UPDATE_POS", (data) => {
    // Actualizar la memoria del servidor
    if (serverPlayers[socket.id]) {
        Object.assign(serverPlayers[socket.id], {
            x: data.x, 
            y: data.y, 
            z: data.z, 
            rot: data.rot, 
            action: data.action 
        });
    }
    // Reenviar a los demás
    socket.to(data.room).emit("UPDATE_POS", data);
  });

  // 3. Eventos del juego (Sillas)
  socket.on("GAME_EVENT", (data) => {
    io.in(data.room).emit("GAME_EVENT", data);
  });

  // 4. Chat
  socket.on("CHAT_MESSAGE", (data) => {
    io.in(data.room).emit("CHAT_MESSAGE", data);
  });

  // 5. Desconexión
  socket.on("disconnect", () => {
    console.log("Jugador desconectado:", socket.id);
    if (serverPlayers[socket.id]) {
        const { room, id } = serverPlayers[socket.id];
        // Avisar a la sala para borrar el avatar
        io.in(room).emit("PLAYER_LEFT", id);
        // Borrar de memoria
        delete serverPlayers[socket.id];
    }
  });

});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});

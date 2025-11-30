const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer((req, res) => {
  res.write("Servidor Sillas Locas (Multiplayer V2) - ACTIVO");
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: [
        "https://zaraprueba.unaux.com",
        "http://zaraprueba.unaux.com",
        "https://www.zaraprueba.unaux.com"
    ],
    methods: ["GET", "POST"]
  }
});

// === ESTADO DEL SERVIDOR ===
let players = {}; // Datos de jugadores: { socketId: { room, name, modelUrl, ... } }
let rooms = {};   // Datos de salas: { roomId: { name, hostId, playerCount } }

io.on("connection", (socket) => {
  console.log("Nuevo jugador conectado:", socket.id);

  // 1. ENVIAR LISTA DE SALAS (Para el menú "Unirse")
  socket.on("get_rooms", () => {
    const roomList = [];
    for (const [id, info] of Object.entries(rooms)) {
      roomList.push({ id: id, name: info.name, players: info.playerCount });
    }
    socket.emit("room_list_update", roomList);
  });

  // 2. CREAR SALA
  socket.on("create_room", (data) => {
    const roomId = Math.floor(Math.random() * 9000 + 1000).toString(); // ID de 4 dígitos
    
    rooms[roomId] = {
      name: data.roomName || `Sala ${roomId}`,
      hostId: socket.id,
      playerCount: 1
    };

    joinRoomLogic(socket, roomId, data.playerName, data.modelUrl);
  });

  // 3. UNIRSE A SALA
  socket.on("join_room", (data) => {
    if (rooms[data.roomId]) {
      if(rooms[data.roomId].playerCount >= 8) {
        return;
      }
      rooms[data.roomId].playerCount++;
      joinRoomLogic(socket, data.roomId, data.playerName, data.modelUrl);
    }
  });

  function joinRoomLogic(socket, roomId, name, modelUrl) {
    socket.join(roomId);

    // Guardar datos del jugador
    players[socket.id] = {
      id: socket.id,
      room: roomId,
      name: name,
      modelUrl: modelUrl,
      x: 0, y: 0, z: 0, rot: 0, action: 'idle'
    };

    const playersInRoom = Object.values(players).filter(p => p.room === roomId);
    socket.emit("room_joined_success", playersInRoom);

    socket.to(roomId).emit("player_joined_room", players[socket.id]);
    
    console.log(`Jugador ${name} entró a la sala ${roomId}`);
  }

  socket.on("update_transform", (data) => {
    const p = players[socket.id];
    if (p) {
      p.x = data.x; p.y = data.y; p.z = data.z; p.rot = data.rot; p.action = data.action;
      socket.to(p.room).emit("update_player_transform", { id: socket.id, ...data });
    }
  });

  socket.on("host_action", (data) => {
    const p = players[socket.id];
    if (p && rooms[p.room] && rooms[p.room].hostId === socket.id) {
      io.in(p.room).emit("game_event", data);
    }
  });

  // 6. CHAT
  socket.on("chat_msg", (data) => {
    const p = players[socket.id];
    if (p) {
      io.in(p.room).emit("chat_msg_global", data);
    }
  });

  socket.on("disconnect", () => {
    const p = players[socket.id];
    if (p) {
      const roomId = p.room;
      
      io.in(roomId).emit("player_left_room", socket.id);
      
      if (rooms[roomId]) {
        rooms[roomId].playerCount--;
        if (rooms[roomId].playerCount <= 0) {
          delete rooms[roomId]; 
        } else if (rooms[roomId].hostId === socket.id) {
        }
      }

      delete players[socket.id];
      console.log("Jugador desconectado:", socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor Sillas Locas corriendo en puerto ${PORT}`);
});

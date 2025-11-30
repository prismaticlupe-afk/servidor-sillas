const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer((req, res) => {
  res.write("Servidor Sillas Locas (Multiplayer V2) - ACTIVO");
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    // === INICIO DEL CAMBIO DE SEGURIDAD ===
    // En lugar de "*", ponemos un array con tus dominios permitidos:
    origin: [
        "https://zaraprueba.unaux.com",
        "http://zaraprueba.unaux.com",
        "https://www.zaraprueba.unaux.com"
    ],
    // === FIN DEL CAMBIO DE SEGURIDAD ===
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
      // Verificar si está llena (Max 8)
      if(rooms[data.roomId].playerCount >= 8) {
        // Opcional: Emitir error si está llena
        return;
      }
      rooms[data.roomId].playerCount++;
      joinRoomLogic(socket, data.roomId, data.playerName, data.modelUrl);
    }
  });

  // Lógica común para unirse (guardar datos y avisar)
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

    // A) Enviar al jugador la lista de quienes YA están en la sala
    const playersInRoom = Object.values(players).filter(p => p.room === roomId);
    socket.emit("room_joined_success", playersInRoom);

    // B) Avisar a los demás que entró alguien nuevo
    socket.to(roomId).emit("player_joined_room", players[socket.id]);
    
    console.log(`Jugador ${name} entró a la sala ${roomId}`);
  }

  // 4. MOVIMIENTO Y POSICIÓN
  socket.on("update_transform", (data) => {
    const p = players[socket.id];
    if (p) {
      // Actualizar memoria
      p.x = data.x; p.y = data.y; p.z = data.z; p.rot = data.rot; p.action = data.action;
      // Reenviar a la sala (menos a uno mismo)
      socket.to(p.room).emit("update_player_transform", { id: socket.id, ...data });
    }
  });

  // 5. ACCIONES DEL HOST (Iniciar juego, eliminar, sillas)
  socket.on("host_action", (data) => {
    const p = players[socket.id];
    if (p && rooms[p.room] && rooms[p.room].hostId === socket.id) {
      // Si es el host, reenviamos el evento a TODOS en la sala
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

  // 7. DESCONEXIÓN
  socket.on("disconnect", () => {
    const p = players[socket.id];
    if (p) {
      const roomId = p.room;
      
      // Avisar a la sala
      io.in(roomId).emit("player_left_room", socket.id);
      
      // Actualizar contador de sala
      if (rooms[roomId]) {
        rooms[roomId].playerCount--;
        if (rooms[roomId].playerCount <= 0) {
          delete rooms[roomId]; // Borrar sala si está vacía
        } else if (rooms[roomId].hostId === socket.id) {
            // (Opcional) Asignar nuevo host si el host se va
            // Por ahora simple: si el host se va, la sala sigue pero sin control
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

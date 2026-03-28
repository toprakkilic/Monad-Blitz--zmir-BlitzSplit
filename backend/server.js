const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
  },
});

// ============================================================
// In-memory state
// ============================================================
const activeRooms = {};

/**
 * Room structure:
 * {
 *   roomId: string,
 *   hostAddress: string,
 *   totalAmount: number,        // amount in USDC (human readable, e.g. 50)
 *   players: [
 *     {
 *       address: string,
 *       socketId: string,
 *       signatureData: { v, r, s, deadline, value, nonce } | null
 *     }
 *   ],
 *   status: 'waiting' | 'spinning' | 'settled',
 *   loser: string | null,
 *   loserSignature: object | null,
 * }
 */

// ============================================================
// Helper: Generate 5-digit room code
// ============================================================
function generateRoomCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// ============================================================
// Health check endpoint
// ============================================================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Monad SplitIt - Socket Relayer",
    activeRooms: Object.keys(activeRooms).length,
  });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = activeRooms[req.params.roomId];
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  res.json({
    roomId: room.roomId,
    hostAddress: room.hostAddress,
    totalAmount: room.totalAmount,
    players: room.players.map((p) => ({
      address: p.address,
      hasSigned: !!p.signatureData,
    })),
    status: room.status,
    loser: room.loser,
  });
});

// ============================================================
// Socket.io Events
// ============================================================
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // ----------------------------------------------------------
  // CREATE ROOM
  // ----------------------------------------------------------
  socket.on("createRoom", ({ hostAddress, totalAmount }, callback) => {
    const roomId = generateRoomCode();

    activeRooms[roomId] = {
      roomId,
      hostAddress: hostAddress.toLowerCase(),
      totalAmount: Number(totalAmount),
      players: [
        {
          address: hostAddress.toLowerCase(),
          socketId: socket.id,
          signatureData: null,
        },
      ],
      status: "waiting",
      loser: null,
      loserSignature: null,
    };

    socket.join(roomId);
    console.log(
      `🏠 Room ${roomId} created by ${hostAddress} | Amount: ${totalAmount} mUSDC`
    );

    if (callback) {
      callback({ success: true, roomId });
    }
  });

  // ----------------------------------------------------------
  // JOIN ROOM WITH SIGNATURE
  // ----------------------------------------------------------
  socket.on(
    "joinRoomWithSignature",
    ({ roomId, userAddress, signatureData }, callback) => {
      const room = activeRooms[roomId];

      if (!room) {
        if (callback) callback({ success: false, error: "Room not found" });
        return;
      }

      if (room.status !== "waiting") {
        if (callback)
          callback({ success: false, error: "Room is no longer accepting players" });
        return;
      }

      // Check if this wallet address is already in the room
      const existingPlayerIndex = room.players.findIndex(
        (p) => p.address === userAddress.toLowerCase()
      );

      if (existingPlayerIndex !== -1) {
        // This wallet is already in the room, update its socket and signature
        room.players[existingPlayerIndex].socketId = socket.id;
        room.players[existingPlayerIndex].signatureData = signatureData;
      } else {
        // NEW PLAYER: Different wallet address joined
        room.players.push({
          address: userAddress.toLowerCase(),
          socketId: socket.id,
          signatureData,
        });
      }

      socket.join(roomId);
      console.log(
        `👤 ${userAddress} joined room ${roomId} with permit signature`
      );

      // Broadcast updated room state
      io.to(roomId).emit("roomUpdated", {
        roomId: room.roomId,
        hostAddress: room.hostAddress,
        totalAmount: room.totalAmount,
        players: room.players.map((p) => ({
          address: p.address,
          hasSigned: !!p.signatureData,
        })),
        status: room.status,
      });

      if (callback) {
        callback({ success: true, roomId });
      }
    }
  );

  // ----------------------------------------------------------
  // HOST SIGNS (host also needs to provide a permit)
  // ----------------------------------------------------------
  socket.on("hostSign", ({ roomId, hostAddress, signatureData }, callback) => {
    const room = activeRooms[roomId];

    if (!room) {
      if (callback) callback({ success: false, error: "Room not found" });
      return;
    }

    const hostPlayer = room.players.find(
      (p) => p.address === hostAddress.toLowerCase()
    );
    if (hostPlayer) {
      hostPlayer.signatureData = signatureData;
    }

    io.to(roomId).emit("roomUpdated", {
      roomId: room.roomId,
      hostAddress: room.hostAddress,
      totalAmount: room.totalAmount,
      players: room.players.map((p) => ({
        address: p.address,
        hasSigned: !!p.signatureData,
      })),
      status: room.status,
    });

    if (callback) callback({ success: true });
  });

  // ----------------------------------------------------------
  // SPIN ROULETTE (Host only)
  // ----------------------------------------------------------
  socket.on("spinRoulette", ({ roomId, hostAddress }, callback) => {
    const room = activeRooms[roomId];

    if (!room) {
      if (callback) callback({ success: false, error: "Room not found" });
      return;
    }

    if (room.hostAddress !== hostAddress.toLowerCase()) {
      if (callback)
        callback({ success: false, error: "Only the host can spin" });
      return;
    }

    if (room.players.length < 2) {
      if (callback)
        callback({
          success: false,
          error: "Need at least 2 players to spin",
        });
      return;
    }

    room.status = "spinning";

    // Randomly select a loser from ALL players (including host)
    const randomIndex = Math.floor(Math.random() * room.players.length);
    const loserPlayer = room.players[randomIndex];

    room.loser = loserPlayer.address;
    room.loserSignature = loserPlayer.signatureData;

    console.log(
      `🎰 Roulette spun in room ${roomId} → Loser: ${loserPlayer.address}`
    );

    // Broadcast result to all players in the room
    io.to(roomId).emit("rouletteResult", {
      roomId: room.roomId,
      loserAddress: loserPlayer.address,
      hostAddress: room.hostAddress,
      totalAmount: room.totalAmount,
      signatureData: loserPlayer.signatureData,
      players: room.players.map((p) => p.address),
    });

    if (callback) {
      callback({
        success: true,
        loserAddress: loserPlayer.address,
        signatureData: loserPlayer.signatureData,
      });
    }
  });

  // ----------------------------------------------------------
  // SETTLE (after on-chain tx)
  // ----------------------------------------------------------
  socket.on("settlePayment", ({ roomId, txHash }, callback) => {
    const room = activeRooms[roomId];
    if (room) {
      room.status = "settled";
      io.to(roomId).emit("paymentSettled", {
        roomId,
        txHash,
        loser: room.loser,
        amount: room.totalAmount,
      });
      console.log(`✅ Room ${roomId} settled! TX: ${txHash}`);
    }
    if (callback) callback({ success: true });
  });

  // ----------------------------------------------------------
  // DISCONNECT
  // ----------------------------------------------------------
  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ============================================================
// Start Server
// ============================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   🎲 Monad SplitIt - Socket Relayer      ║
  ║   Running on port ${PORT}                    ║
  ╚═══════════════════════════════════════════╝
  `);
});

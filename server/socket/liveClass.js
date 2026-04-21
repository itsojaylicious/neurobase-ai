/**
 * Socket.io — Real-time Live Class Handler
 * Handles: live transcript push, chat, raise hand, topic detection
 */
module.exports = (io) => {
  // Track which users are in which lecture rooms
  const lectureRooms = {}; // lectureId -> Set of socket ids

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── JOIN LECTURE ROOM ─────────────────────────────────
    socket.on('join-lecture', ({ lectureId, userId, userEmail, role }) => {
      socket.join(lectureId);
      socket.lectureId  = lectureId;
      socket.userId     = userId;
      socket.userEmail  = userEmail;
      socket.userRole   = role;

      if (!lectureRooms[lectureId]) lectureRooms[lectureId] = new Set();
      lectureRooms[lectureId].add(socket.id);

      // Notify room someone joined
      socket.to(lectureId).emit('user-joined', { userId, userEmail, role });

      // Send current participant count
      io.to(lectureId).emit('participant-count', lectureRooms[lectureId].size);
      console.log(`👥 ${userEmail} joined lecture ${lectureId}`);
    });

    // ── LIVE TRANSCRIPT PUSH (Teacher → All Students instantly) ──
    socket.on('transcript-chunk', ({ lectureId, chunk, fullTranscript }) => {
      // Broadcast to everyone in the room EXCEPT sender
      socket.to(lectureId).emit('transcript-update', { chunk, fullTranscript });
    });

    // ── LIVE CHAT ─────────────────────────────────────────
    socket.on('chat-message', ({ lectureId, messageId, message, userEmail, userId, isAiResponse }) => {
      // Broadcast to everyone EXCEPT the sender (sender already has optimistic message)
      socket.to(lectureId).emit('new-chat-message', {
        id: messageId || Date.now(),
        user_email: userEmail,
        user_id: userId,
        message,
        is_ai_response: isAiResponse || false,
        created_at: new Date().toISOString()
      });
    });

    // ── RAISE HAND ────────────────────────────────────────
    socket.on('raise-hand', ({ lectureId, userId, userEmail, status }) => {
      io.to(lectureId).emit('hand-update', { userId, userEmail, status }); // 'raised' | 'lowered'
    });

    // ── AI TOPIC DETECTED ─────────────────────────────────
    socket.on('topic-detected', ({ lectureId, topic }) => {
      io.to(lectureId).emit('current-topic', { topic });
    });

    // ── TEACHER ENDS CLASS ────────────────────────────────
    socket.on('end-lecture', ({ lectureId }) => {
      io.to(lectureId).emit('lecture-ended', { message: 'The teacher has ended this class.' });
    });

    // ── DISCONNECT ────────────────────────────────────────
    socket.on('disconnect', () => {
      const { lectureId, userEmail } = socket;
      if (lectureId && lectureRooms[lectureId]) {
        lectureRooms[lectureId].delete(socket.id);
        const count = lectureRooms[lectureId].size;
        io.to(lectureId).emit('participant-count', count);
        socket.to(lectureId).emit('user-left', { userEmail });
        if (count === 0) delete lectureRooms[lectureId];
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

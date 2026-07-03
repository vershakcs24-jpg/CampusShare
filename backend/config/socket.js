const { Server } = require('socket.io');
const chatSocket = require('../sockets/chatSocket');

let io;

const initSocket = (server) => {
    const corsOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
        : '*';

    io = new Server(server, {
        cors: {
            origin: corsOrigins,
            methods: ["GET", "POST"]
        }
    });

    //chats events ko initilise krra
    chatSocket(io);

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

module.exports = { initSocket, getIO };
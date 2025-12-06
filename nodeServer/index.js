// index.js
const http = require('http');
const server = http.createServer();
const ioLib = require('socket.io');

// allow CORS and create socket.io attached to the HTTP server
const io = ioLib(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const users = {};
const groups = {};

// ----------------------
// Sanitizer code added here
// ----------------------

const bannedWords = [
  "abuse","trafficking","prostitution","escorting","heroin","cocaine",
  "methamphetamine","fentanyl","drugs","weapons","firearms","explosives",
  "bombmaking","terrorism","extremism","radicalization","threats","kidnapping",
  "arson","fraud","scam","phishing","ransomware","malware","hacking","doxxing",
  "forgery","counterfeit","laundering","bribery","grooming","rob them","killing",
  "kill","murder","trafficking (people)","escort"
];

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const sortedWordsServer = bannedWords.slice().sort((a,b)=> b.length - a.length);
const serverPattern = sortedWordsServer.map(w => escapeRegex(w)).join('|');
const bannedRegexServer = new RegExp(`\\b(?:${serverPattern})\\b`, 'gi');

function sanitizeText(text){
  if (!text || typeof text !== 'string') return text;
  return text.replace(bannedRegexServer, match => '*'.repeat(match.length));
}

// helper to get socket by id (works on various socket.io versions)
function getSocketById(id) {
  // v3+/v4:
  if (io.sockets && io.sockets.sockets && typeof io.sockets.sockets.get === 'function') {
    return io.sockets.sockets.get(id);
  }
  // v2:
  if (io.sockets && io.sockets.connected) {
    return io.sockets.connected[id];
  }
  return null;
}

// ----------------------
// Updated code with Socket.IO v4+ fixes
// ----------------------

// When a user connects
io.on('connection', socket => {
    console.log('New user connected:', socket.id);

    // Handle new user joining
    socket.on('new-user-joined', name => {
        console.log('User joined:', name);
        users[socket.id] = name;
        socket.broadcast.emit('user-joined', name);
        io.emit('user-list', users);
    });

    // Handle sending message
    socket.on('send', message => {
        socket.broadcast.emit('receive', { message: message, name: users[socket.id] });
    });

    // Handle private messaging (with sanitization) - UPDATED for Socket.IO v4+
    socket.on('private-message', ({ to, message }) => {
        const safeMessage = sanitizeText(message);
        const targetSocket = getSocketById(to); // ✅ UPDATED: Using helper function
        if (targetSocket) {
            targetSocket.emit('receive-private', { 
                message: safeMessage, 
                fromName: users[socket.id],
                from: socket.id
            });
        }
    });

    // Handle group creation - UPDATED for Socket.IO v4+
    socket.on('create-group', ({ groupName, members }) => {
        if (!groups[groupName]) groups[groupName] = [];

        members.forEach(id => {
            if (!groups[groupName].includes(id)) {
                groups[groupName].push(id);

                // ✅ UPDATED: Using helper function
                const memberSocket = getSocketById(id);
                if (memberSocket) {
                    memberSocket.join(groupName);
                }
            }
        });

        io.emit('group-list', groups);

        // Optional: Notify members
        members.forEach(id => {
            const memberSocket = getSocketById(id); // ✅ UPDATED
            if (memberSocket) {
                memberSocket.emit('receive-group', {
                    message: `You have been added to group "${groupName}"`,
                    fromName: "System",
                    groupName
                });
            }
        });
    });

    // Handle sending group message (with sanitization)
    socket.on('group-message', ({ groupName, message }) => {
        const safeMessage = sanitizeText(message);
        console.log(`Group message in ${groupName}: ${safeMessage}`);
        
        // Broadcast to the room excluding the sender
        socket.to(groupName).emit('receive-group', {
            message: safeMessage,
            fromName: users[socket.id],
            groupName
        });
    });

    // For Private File Sharing - UPDATED for Socket.IO v4+
    socket.on('private-file', ({ to, fileName, fileType, fileData }) => {
        const targetSocket = getSocketById(to); // ✅ UPDATED: Using helper function
        if (targetSocket) {
            targetSocket.emit('receive-file', {
                fromName: users[socket.id],
                fileName,
                fileType,
                fileData
            });
        }
    });

    // For Group File Sharing
    socket.on('group-file', ({ groupName, fileName, fileType, fileData }) => {
        socket.to(groupName).emit('receive-group-file', {
            fromName: users[socket.id],
            groupName,
            fileName,
            fileType,
            fileData
        });
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        socket.broadcast.emit('left', users[socket.id]);
        delete users[socket.id];
        io.emit('user-list', users);
    });
});

// finally start server listening on 0.0.0.0
const PORT = 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Socket server listening on http://0.0.0.0:${PORT}`);
});
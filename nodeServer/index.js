// index.js
const io = require('socket.io')(8000, {
    cors: {
        origin: "*",
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

// ----------------------
// Existing code continues...
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

    // Handle private messaging (with sanitization)
    socket.on('private-message', ({ to, message }) => {
        const safeMessage = sanitizeText(message);
        const targetSocket = io.sockets.connected[to];
        if (targetSocket) {
            targetSocket.emit('receive-private', { 
                message: safeMessage, 
                fromName: users[socket.id],
                from: socket.id
            });
        }
    });

    // Handle group creation
    socket.on('create-group', ({ groupName, members }) => {
        if (!groups[groupName]) groups[groupName] = [];

        members.forEach(id => {
            if (!groups[groupName].includes(id)) {
                groups[groupName].push(id);

                // ✅ Fixed for Socket.IO v2.x
                const memberSocket = io.sockets.connected[id];
                if (memberSocket) {
                    memberSocket.join(groupName);
                }
            }
        });

        io.emit('group-list', groups);

        // Optional: Notify members
        members.forEach(id => {
            const memberSocket = io.sockets.connected[id];
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

    // For Private File Sharing
    socket.on('private-file', ({ to, fileName, fileType, fileData }) => {
        const targetSocket = io.sockets.connected[to];
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
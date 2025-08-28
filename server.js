const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Predefined users
const users = {
  'manu': { username: 'manu', password: 'manu@123', online: false, ws: null },
  'ishika': { username: 'ishika', password: 'ishika@123', online: false, ws: null }
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // Serve static files
  if (req.url === '/') {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading index.html');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else if (req.url === '/style.css') {
    fs.readFile(path.join(__dirname, 'public', 'style.css'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading style.css');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(data);
      }
    });
  } else if (req.url === '/script.js') {
    fs.readFile(path.join(__dirname, 'public', 'script.js'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading script.js');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(data);
      }
    });
  } else if (req.url === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const { username, password } = JSON.parse(body);
      
      if (users[username] && users[username].password === password) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Login successful' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'login') {
        // Validate user
        if (users[data.username] && users[data.username].password === data.password) {
          users[data.username].online = true;
          users[data.username].ws = ws;
          ws.username = data.username;
          
          // Send login success
          ws.send(JSON.stringify({ type: 'login_success', username: data.username }));
          
          // Send the current user list to the newly connected client
          sendUserList(ws);
          
          // Broadcast updated user list to all clients
          broadcastUserList();
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid credentials' }));
        }
      } else if (data.type === 'message') {
        // Send message to recipient if they're online
        if (users[data.to] && users[data.to].online) {
          users[data.to].ws.send(JSON.stringify({
            type: 'message',
            from: ws.username,
            message: data.message,
            timestamp: new Date().toISOString()
          }));
        }
        
        // Also send back to sender for their own chat window
        ws.send(JSON.stringify({
          type: 'message',
          from: ws.username,
          to: data.to,
          message: data.message,
          timestamp: new Date().toISOString(),
          self: true
        }));
      } else if (data.type === 'get_user_list') {
        // Send the user list to the requesting client
        sendUserList(ws);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    if (ws.username) {
      users[ws.username].online = false;
      users[ws.username].ws = null;
      broadcastUserList();
    }
  });
});

function sendUserList(ws) {
  const onlineUsers = Object.values(users)
    .filter(user => user.online && user.username !== ws.username)
    .map(user => user.username);
  
  ws.send(JSON.stringify({
    type: 'user_list',
    users: onlineUsers
  }));
}

function broadcastUserList() {
  const onlineUsers = Object.values(users)
    .filter(user => user.online)
    .map(user => user.username);
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.username) {
      const usersToShow = onlineUsers.filter(user => user !== client.username);
      client.send(JSON.stringify({
        type: 'user_list',
        users: usersToShow
      }));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

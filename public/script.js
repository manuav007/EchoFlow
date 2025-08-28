document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    const errorMessage = document.getElementById('error-message');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const userList = document.getElementById('user-list');
    const messageArea = document.getElementById('message-area');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const currentChatUserElement = document.getElementById('current-chat-user');
    
    let ws = null;
    let currentUser = null;
    let currentChatUser = null;
    let chatHistory = {};
    
    loginBtn.addEventListener('click', handleLogin);
    
    function handleLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }
        
        // Send login request to server
        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Initialize WebSocket connection
                initializeWebSocket(username, password);
            } else {
                showError(data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('Login failed. Please try again.');
        });
    }
    
    function initializeWebSocket(username, password) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            // Send login credentials via WebSocket
            ws.send(JSON.stringify({
                type: 'login',
                username: username,
                password: password
            }));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'login_success':
                    currentUser = data.username;
                    loginContainer.classList.add('hidden');
                    chatContainer.classList.remove('hidden');
                    
                    // Request user list after successful login
                    ws.send(JSON.stringify({
                        type: 'get_user_list'
                    }));
                    break;
                    
                case 'user_list':
                    updateUserList(data.users);
                    break;
                    
                case 'message':
                    displayMessage(data);
                    break;
                    
                case 'error':
                    showError(data.message);
                    break;
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            showError('Connection error. Please try again.');
        };
        
        ws.onclose = () => {
            console.log('WebSocket connection closed');
            // Optionally, redirect to login page or show reconnect button
            showError('Connection lost. Please refresh the page.');
        };
    }
    
    function updateUserList(users) {
        userList.innerHTML = '';
        
        if (users.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No users online';
            li.style.cursor = 'default';
            li.style.color = '#999';
            userList.appendChild(li);
            return;
        }
        
        users.forEach(user => {
            if (user !== currentUser) {
                const li = document.createElement('li');
                li.textContent = user;
                li.addEventListener('click', () => {
                    // Remove active class from all users
                    document.querySelectorAll('#user-list li').forEach(item => {
                        item.classList.remove('active');
                    });
                    
                    // Add active class to clicked user
                    li.classList.add('active');
                    
                    // Set current chat user
                    currentChatUser = user;
                    currentChatUserElement.textContent = `Chat with ${user}`;
                    
                    // Enable message input and send button
                    messageInput.disabled = false;
                    sendBtn.disabled = false;
                    
                    // Focus on message input
                    messageInput.focus();
                    
                    // Display chat history
                    displayChatHistory();
                });
                
                userList.appendChild(li);
            }
        });
    }
    
    function displayMessage(data) {
        // Determine the other user in this conversation
        const otherUser = data.self ? data.to : data.from;
        
        // Store message in chat history
        if (!chatHistory[otherUser]) {
            chatHistory[otherUser] = [];
        }
        chatHistory[otherUser].push(data);
        
        // If this message is for the current chat, display it
        if (currentChatUser === otherUser) {
            addMessageToChatArea(data);
        } else {
            // Show notification for new message from another user
            showNewMessageNotification(otherUser);
        }
    }
    
    function showNewMessageNotification(username) {
        // Find the user list item and highlight it
        const userItems = document.querySelectorAll('#user-list li');
        userItems.forEach(item => {
            if (item.textContent === username) {
                item.style.backgroundColor = '#ffeb3b';
                item.style.color = '#333';
                
                // Add a notification badge
                if (!item.querySelector('.notification-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'notification-badge';
                    badge.textContent = '!';
                    badge.style.marginLeft = '10px';
                    badge.style.backgroundColor = 'red';
                    badge.style.color = 'white';
                    badge.style.borderRadius = '50%';
                    badge.style.width = '20px';
                    badge.style.height = '20px';
                    badge.style.display = 'inline-flex';
                    badge.style.justifyContent = 'center';
                    badge.style.alignItems = 'center';
                    item.appendChild(badge);
                }
            }
        });
    }
    
    function displayChatHistory() {
        messageArea.innerHTML = '';
        
        if (chatHistory[currentChatUser]) {
            chatHistory[currentChatUser].forEach(message => {
                addMessageToChatArea(message);
            });
        }
        
        // Scroll to bottom
        messageArea.scrollTop = messageArea.scrollHeight;
        
        // Remove notification from the active user
        const userItems = document.querySelectorAll('#user-list li');
        userItems.forEach(item => {
            if (item.textContent === currentChatUser) {
                item.style.backgroundColor = '';
                item.style.color = '';
                
                const badge = item.querySelector('.notification-badge');
                if (badge) {
                    item.removeChild(badge);
                }
            }
        });
    }
    
    function addMessageToChatArea(data) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(data.self ? 'self' : 'other');
        
        const timestamp = new Date(data.timestamp).toLocaleTimeString();
        messageDiv.textContent = `${data.self ? 'You' : data.from}: ${data.message} (${timestamp})`;
        
        messageArea.appendChild(messageDiv);
        
        // Scroll to bottom
        messageArea.scrollTop = messageArea.scrollHeight;
    }
    
    // Send message when Send button is clicked
    sendBtn.addEventListener('click', sendMessage);
    
    // Send message when Enter key is pressed
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    function sendMessage() {
        const message = messageInput.value.trim();
        
        if (message && currentChatUser) {
            // Send message via WebSocket
            ws.send(JSON.stringify({
                type: 'message',
                to: currentChatUser,
                message: message
            }));
            
            // Clear input
            messageInput.value = '';
        }
    }
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Hide error after 3 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 3000);
    }
});

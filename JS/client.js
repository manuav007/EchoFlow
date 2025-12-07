// IMPORTANT: Updated for EC2
const socket = io('http://56.228.33.168:8000');

const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.querySelector('.container');
const fileInput = document.getElementById('fileInput');
const fileBtn = document.getElementById('fileBtn');

var audio = new Audio('ting.mp3');

// Store chats per user
let chats = {};  
let selectedUser = null;

// Store groups and group chats
let groups = {};  
let selectedGroup = null;

// Store current users list
let users = {};

const append = (message, position, toUser = null)=>{
    const messageElement = document.createElement('div');
    messageElement.innerText = message;
    messageElement.classList.add('message');
    messageElement.classList.add(position);
    messageContainer.append(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;

    if(position === 'left'){
        console.log('sound is playing');
        audio.play();
    }

    // Save to chats (per user)
    if (toUser) {
        if (!chats[toUser]) chats[toUser] = [];
        chats[toUser].push({ message, position });
    }
};

// Function to display file/image in chat
function appendFile(sender, fileName, fileType, fileData, position) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', position);

    if (fileType.startsWith('image/')) {
        messageElement.innerHTML = `<strong>${sender}:</strong><br><img src="${fileData}" style="max-width:200px; border-radius:10px;">`;
    } else {
        messageElement.innerHTML = `<strong>${sender}:</strong> <br>
        <a href="${fileData}" download="${fileName}">📎 ${fileName} (Click to download)</a>`;
    }

    messageContainer.append(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Update users list
const updateUsers = (usersData) => {
    users = usersData; // Store users globally
    const usersList = document.getElementById('users');
    usersList.innerHTML = '';
    Object.keys(usersData).forEach(id => {
        if (id !== socket.id) {   // don't show yourself
            const li = document.createElement('li');
            li.innerText = usersData[id];
            li.onclick = () => {
                selectedUser = id;
                selectedGroup = null; 
                messageContainer.innerHTML = '';
                if (chats[selectedUser]) {
                    chats[selectedUser].forEach(chat => {
                        append(chat.message, chat.position);
                    });
                }
            };
            usersList.appendChild(li);
        }
    });
};

// Update groups list
const updateGroups = (groupsData) => {
    const groupsList = document.getElementById('groups');
    groupsList.innerHTML = '';
    Object.keys(groupsData).forEach(groupName => {
        const li = document.createElement('li');
        li.innerText = groupName;
        li.onclick = () => {
            selectedGroup = groupName;
            selectedUser = null; 
            messageContainer.innerHTML = '';
            if (groups[groupName]) {
                groups[groupName].forEach(chat => {
                    append(chat.message, chat.position);
                });
            }
        };
        groupsList.appendChild(li);
    });
};

// Handle group creation
document.getElementById('createGroupBtn').onclick = () => {
    const groupName = prompt("Enter group name:");
    if (!groupName) return;

    const userIds = Object.keys(users).filter(id => id !== socket.id); 
    if (userIds.length === 0) {
        alert("No other users online to create a group");
        return;
    }

    let selected = [socket.id]; // always include yourself

    userIds.forEach(id => {
        const include = confirm(`Add ${users[id]} to the group?`);
        if (include) selected.push(id);
    });

    socket.emit('create-group', { groupName, members: selected });
};

// Open file dialog
fileBtn.onclick = () => {
    fileInput.click();
};

// Send file to server
fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const fileData = reader.result;

        if (selectedUser) {
            socket.emit('private-file', {
                to: selectedUser,
                fileName: file.name,
                fileType: file.type,
                fileData: fileData
            });

            appendFile(`You`, file.name, file.type, fileData, 'right');
        } 
        else if (selectedGroup) {
            socket.emit('group-file', {
                groupName: selectedGroup,
                fileName: file.name,
                fileType: file.type,
                fileData: fileData
            });

            appendFile(`You (in ${selectedGroup})`, file.name, file.type, fileData, 'right');
        }
    };
    reader.readAsDataURL(file);
};

form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    if (selectedUser) {
        append(`You: ${message}`, 'right', selectedUser);
        socket.emit('private-message', { message, to: selectedUser });
    } else if (selectedGroup) {
        append(`You (in ${selectedGroup}): ${message}`, 'right');

        if (!groups[selectedGroup]) groups[selectedGroup] = [];
        groups[selectedGroup].push({ message: `You (in ${selectedGroup}): ${message}`, position: 'right' });

        socket.emit('group-message', { message, groupName: selectedGroup });
    } else {
        return alert("Select a user or group to chat with");
    }
    messageInput.value = '';
})

const name = prompt("Enter your name to join LetsChat");
socket.emit('new-user-joined', name);

socket.on('user-list', users => updateUsers(users));

socket.on('receive-private', data => {
    append(`${data.fromName}: ${data.message}`, 'left', data.from);
});

socket.on('user-left', name => {
    append(`${name} left the chat`, 'left');
});

socket.on('group-list', groupsData => updateGroups(groupsData));

socket.on('receive-group', data => {
    if (!groups[data.groupName]) groups[data.groupName] = [];
    groups[data.groupName].push({ message: `${data.fromName}: ${data.message}`, position: 'left' });

    if (selectedGroup === data.groupName) {
        append(`${data.fromName}: ${data.message}`, 'left');
    }
});

// Receive files on client side
socket.on('receive-file', data => {
    appendFile(data.fromName, data.fileName, data.fileType, data.fileData, 'left');
});

socket.on('receive-group-file', data => {
    if (selectedGroup === data.groupName) {
        appendFile(data.fromName, data.fileName, data.fileType, data.fileData, 'left');
    }
});
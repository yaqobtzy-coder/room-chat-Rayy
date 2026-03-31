// ========================================
// FURAB V14 - FULL LOGIC
// ========================================

const firebaseConfig = { databaseURL: "https://rayy-all-web-default-rtdb.asia-southeast1.firebasedatabase.app" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentUser = null;
let currentPrivateChatWith = null;
let allUsers = [];
let replyTo = null;
let currentTab = 'private';
let unreadCount = 0;
let unreadMessages = [];
let pinnedMessage = null;
let lastMessageTimestamp = 0;
let activeStatus = [];
let statusIdx = 0;
let statusTimer;

function encryptMessage(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
}

function decryptMessage(encrypted, key) {
    try {
        let decoded = atob(encrypted);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    } catch(e) { return encrypted; }
}

function getEncryptionKey() { return 'FURAB_V14_SECURE_KEY_2026'; }

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function checkAuth() {
    currentUser = localStorage.getItem('furab_user');
    if (currentUser) {
        document.getElementById('auth-view').style.display = 'none';
        document.getElementById('app-view').style.display = 'flex';
        boot();
    } else {
        document.getElementById('auth-view').style.display = 'flex';
        document.getElementById('app-view').style.display = 'none';
    }
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.toLowerCase().trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        alert("Username dan password harus diisi!");
        return;
    }
    
    const snap = await db.ref(`users/${username}`).once('value');
    
    if (snap.exists() && snap.val().password === password) {
        localStorage.setItem('furab_user', username);
        location.reload();
    } else {
        alert("Username atau password salah!");
    }
}

async function handleRegister() {
    const username = document.getElementById('login-username').value.toLowerCase().trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        alert("Username dan password harus diisi!");
        return;
    }
    
    const snap = await db.ref(`users/${username}`).once('value');
    
    if (snap.exists()) {
        alert("Username sudah terdaftar!");
        return;
    }
    
    const joinDate = new Date();
    await db.ref(`users/${username}`).set({
        password: password,
        level: username === 'rayy' ? 'owner' : 'member',
        verified: username === 'rayy' ? true : false,
        joinDate: joinDate.toLocaleDateString('id-ID'),
        joinTime: joinDate.toLocaleTimeString('id-ID')
    });
    
    const welcomeMsg = `✨ SELAMAT DATANG @${username} ✨\n📅 Bergabung: ${joinDate.toLocaleDateString('id-ID')} ${joinDate.toLocaleTimeString('id-ID')}`;
    await db.ref('messages_room').push({
        user: 'SYSTEM',
        text: welcomeMsg,
        time: joinDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ts: Date.now(),
        isWelcome: true
    });
    
    document.getElementById('welcome-username').innerText = `@${username}`;
    document.getElementById('welcome-time').innerText = joinDate.toLocaleString('id-ID');
    document.getElementById('welcome-modal').style.display = 'flex';
    
    localStorage.setItem('furab_user', username);
    setTimeout(() => location.reload(), 1500);
}

function logout() {
    localStorage.removeItem('furab_user');
    location.reload();
}

function closeWelcomeModal() {
    document.getElementById('welcome-modal').style.display = 'none';
}

function loadStory() {
    db.ref('status_room').on('value', snap => {
        activeStatus = [];
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(k => activeStatus.push(data[k]));
        }
    });
}

function openStory() {
    if (activeStatus.length === 0) return alert("Belum ada status terbaru.");
    statusIdx = 0;
    document.getElementById('story-overlay').style.display = 'flex';
    renderStatus();
}

function renderStatus() {
    const current = activeStatus[statusIdx];
    const mediaCont = document.getElementById('story-media');
    const bars = document.getElementById('story-bars');
    
    bars.innerHTML = '';
    activeStatus.forEach((_, i) => {
        const bar = document.createElement('div');
        bar.className = 'story-bar';
        bar.innerHTML = `<div class="story-progress" id="bar-${i}" style="width: ${i < statusIdx ? '100%' : '0%'}"></div>`;
        bars.appendChild(bar);
    });

    mediaCont.innerHTML = current.type === 'video' 
        ? `<video src="${current.url}" autoplay playsinline id="st-vid"></video>`
        : `<img src="${current.url}">`;
    
    document.getElementById('story-text').innerText = current.caption || '';
    document.getElementById('story-name').innerText = document.getElementById('room-name').innerText;
    document.getElementById('story-avatar').src = document.getElementById('avatar-img').src;

    const progress = document.getElementById(`bar-${statusIdx}`);
    let duration = current.type === 'video' ? 15000 : 5000; 

    progress.style.transitionDuration = '0ms';
    progress.style.width = '0%';
    
    setTimeout(() => {
        progress.style.transitionDuration = duration + 'ms';
        progress.style.width = '100%';
    }, 50);

    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
        if (statusIdx < activeStatus.length - 1) {
            statusIdx++;
            renderStatus();
        } else {
            closeStory();
        }
    }, duration);
}

function closeStory() {
    document.getElementById('story-overlay').style.display = 'none';
    document.getElementById('story-media').innerHTML = '';
    clearTimeout(statusTimer);
}

function openMemberModal() {
    const container = document.getElementById('member-list-container');
    container.innerHTML = '<div class="loading">Loading members...</div>';
    document.getElementById('member-modal').style.display = 'flex';
    
    db.ref('users').once('value', snap => {
        container.innerHTML = '';
        const users = snap.val();
        if (users) {
            Object.keys(users).sort().forEach(u => {
                const data = users[u];
                const isOwner = u === 'rayy';
                container.innerHTML += `
                    <div class="member-item">
                        <div class="member-avatar">${u.charAt(0).toUpperCase()}</div>
                        <div class="member-info">
                            <div class="member-name">
                                @${u}
                                ${isOwner ? '<span class="badge-owner" style="font-size:9px; padding:2px 6px; margin-left:6px;">👑 OWNER</span>' : ''}
                                ${data.verified ? '<span class="badge-verified" style="font-size:9px; padding:2px 6px; margin-left:6px;">✅</span>' : ''}
                            </div>
                            <div class="member-badge">Bergabung: ${data.joinDate || '-'}</div>
                        </div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<div style="text-align:center; padding:20px;">Belum ada member</div>';
        }
    });
}

function closeMemberModal() {
    document.getElementById('member-modal').style.display = 'none';
}

async function pinMessage(messageId, messageData, isRoom = true) {
    const pinData = {
        messageId: messageId,
        user: messageData.user,
        text: messageData.text.substring(0, 150),
        time: messageData.time,
        ts: Date.now(),
        isRoom: isRoom,
        fullText: messageData.text
    };
    
    await db.ref(`pinned_messages/${currentUser}`).set(pinData);
    pinnedMessage = pinData;
    showPinnedBanner(pinData);
    alert("✅ Pesan berhasil di-pin!");
}

async function unpinMessage() {
    if (confirm("Hapus pin pesan ini?")) {
        await db.ref(`pinned_messages/${currentUser}`).remove();
        pinnedMessage = null;
        document.getElementById('pinned-banner').style.display = 'none';
        alert("✅ Pin dihapus!");
    }
}

function showPinnedBanner(pinData) {
    const banner = document.getElementById('pinned-banner');
    const textEl = document.getElementById('pinned-text');
    if (banner && textEl) {
        textEl.innerHTML = `<strong>@${pinData.user}</strong>: ${escapeHtml(pinData.text)}`;
        banner.style.display = 'flex';
    }
}

function loadPinnedMessage() {
    db.ref(`pinned_messages/${currentUser}`).on('value', snap => {
        const data = snap.val();
        if (data) {
            pinnedMessage = data;
            showPinnedBanner(data);
        } else {
            pinnedMessage = null;
            const banner = document.getElementById('pinned-banner');
            if (banner) banner.style.display = 'none';
        }
    });
}

function openPinnedModal() {
    const container = document.getElementById('pinned-list-container');
    if (pinnedMessage && container) {
        container.innerHTML = `
            <div class="update-card">
                <div class="update-date">Dipin pada: ${new Date(pinnedMessage.ts).toLocaleString()}</div>
                <div class="update-title">📌 @${pinnedMessage.user}</div>
                <div class="update-desc">${escapeHtml(pinnedMessage.fullText || pinnedMessage.text)}</div>
                <button class="btn" style="margin-top: 12px; background: var(--danger);" onclick="unpinMessage(); closePinnedModal();">Hapus Pin</button>
            </div>
        `;
    } else if (container) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Belum ada pesan terpin</div>';
    }
    document.getElementById('pinned-modal').style.display = 'flex';
}

function closePinnedModal() {
    document.getElementById('pinned-modal').style.display = 'none';
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar-menu');
    if (sidebar) {
        sidebar.style.display = sidebar.style.display === 'flex' ? 'none' : 'flex';
    }
}

function openInfoModal() {
    toggleSidebar();
    loadUpdatesToModal();
    document.getElementById('info-modal').style.display = 'flex';
}
function closeInfoModal() { document.getElementById('info-modal').style.display = 'none'; }

function openDevModal() {
    toggleSidebar();
    document.getElementById('dev-modal').style.display = 'flex';
}
function closeDevModal() { document.getElementById('dev-modal').style.display = 'none'; }

function openUnreadModal() {
    toggleSidebar();
    renderUnreadList();
    document.getElementById('unread-modal').style.display = 'flex';
}
function closeUnreadModal() { document.getElementById('unread-modal').style.display = 'none'; }

function loadUpdatesToModal() {
    db.ref('info_updates').on('value', snap => {
        const container = document.getElementById('update-list-modal');
        if (!container) return;
        container.innerHTML = '';
        const data = snap.val();
        if (data) {
            Object.keys(data).reverse().forEach(id => {
                const u = data[id];
                container.innerHTML += `
                    <div class="update-card">
                        <div class="update-date">${u.date}</div>
                        <div class="update-title">${u.title}</div>
                        <div class="update-desc">${u.desc}</div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--gray);">Belum ada update</div>';
        }
    });
}

function updateUnreadCount() {
    let totalUnread = 0;
    unreadMessages = [];
    
    allUsers.forEach(user => {
        const unreadKey = `unread_${currentUser}_${user.name}`;
        const count = parseInt(localStorage.getItem(unreadKey) || '0');
        if (count > 0) {
            totalUnread += count;
            unreadMessages.push({ user: user.name, count: count });
        }
    });
    
    unreadCount = totalUnread;
    const headerBadge = document.getElementById('header-unread-badge');
    const sidebarCount = document.getElementById('sidebar-unread-count');
    
    if (headerBadge) {
        if (unreadCount > 0) {
            headerBadge.style.display = 'inline-block';
            headerBadge.innerText = unreadCount > 9 ? '9+' : unreadCount;
        } else {
            headerBadge.style.display = 'none';
        }
    }
    if (sidebarCount) {
        if (unreadCount > 0) {
            sidebarCount.style.display = 'inline-block';
            sidebarCount.innerText = unreadCount;
        } else {
            sidebarCount.style.display = 'none';
        }
    }
}

function markAsReadFromUser(username) {
    const unreadKey = `unread_${currentUser}_${username}`;
    localStorage.removeItem(unreadKey);
    updateUnreadCount();
}

function incrementUnreadCount(fromUser) {
    if (fromUser === currentUser) return;
    const unreadKey = `unread_${currentUser}_${fromUser}`;
    let current = parseInt(localStorage.getItem(unreadKey) || '0');
    localStorage.setItem(unreadKey, current + 1);
    updateUnreadCount();
    renderUserList(allUsers);
}

function renderUnreadList() {
    const container = document.getElementById('unread-list-container');
    if (!container) return;
    if (unreadMessages.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--gray);">Tidak ada pesan belum dibaca</div>';
        return;
    }
    container.innerHTML = unreadMessages.map(u => `
        <div class="user-item" onclick="openPrivateChat('${u.user}')">
            <div class="user-avatar">${u.user.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <div class="user-name">@${u.user}</div>
                <div class="user-status">${u.count} pesan belum dibaca</div>
            </div>
            <span class="unread-badge">${u.count}</span>
        </div>
    `).join('');
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`nav-${tab}`).classList.add('active');
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');
    
    if (tab === 'private') {
        if (currentPrivateChatWith) backToUserList();
        else loadUserList();
    }
}
function loadUserList() {
    db.ref('users').on('value', snap => {
        allUsers = [];
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(user => {
                if (user !== currentUser) {
                    allUsers.push({
                        name: user,
                        verified: data[user].verified || false,
                        level: data[user].level || 'member'
                    });
                }
            });
        }
        renderUserList(allUsers);
        updateUnreadCount();
    });
}

function renderUserList(users) {
    const container = document.getElementById('user-list-container');
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = '<div class="loading">Tidak ada user lain</div>';
        return;
    }
    
    container.innerHTML = users.map(u => {
        const unreadKey = `unread_${currentUser}_${u.name}`;
        const unreadCountVal = parseInt(localStorage.getItem(unreadKey) || '0');
        const unreadBadge = unreadCountVal > 0 ? `<span class="unread-badge">${unreadCountVal}</span>` : '';
        
        return `
            <div class="user-item" data-user="${u.name}" onclick="openPrivateChat('${u.name}')">
                <div class="user-avatar">${u.name.charAt(0).toUpperCase()}</div>
                <div class="user-info">
                    <div class="user-name">
                        @${u.name}
                        ${u.verified ? '<span style="color:#00d2ff;">✓</span>' : ''}
                        ${u.level === 'owner' ? '👑' : ''}
                    </div>
                    <div class="user-status"><span class="status-dot online"></span> online</div>
                </div>
                ${unreadBadge}
            </div>
        `;
    }).join('');
}

function filterUserList() {
    const search = document.getElementById('search-user').value.toLowerCase();
    const filtered = allUsers.filter(u => u.name.toLowerCase().includes(search));
    renderUserList(filtered);
}

window.openPrivateChat = function(username) {
    console.log("Opening private chat with:", username);
    if (!username) return;
    currentPrivateChatWith = username;
    markAsReadFromUser(username);
    
    const userListContainer = document.getElementById('user-list-container');
    const privateChatScreen = document.getElementById('private-chat-screen');
    const privateChatName = document.getElementById('private-chat-name');
    const privateChatStatus = document.getElementById('private-chat-status');
    
    if (userListContainer) userListContainer.style.display = 'none';
    if (privateChatScreen) privateChatScreen.style.display = 'flex';
    if (privateChatName) privateChatName.innerHTML = `@${username}`;
    if (privateChatStatus) privateChatStatus.innerHTML = 'online';
    
    loadPrivateMessages(username);
}

function backToUserList() {
    currentPrivateChatWith = null;
    const userListContainer = document.getElementById('user-list-container');
    const privateChatScreen = document.getElementById('private-chat-screen');
    
    if (userListContainer) userListContainer.style.display = 'block';
    if (privateChatScreen) privateChatScreen.style.display = 'none';
    loadUserList();
}

async function markMessageAsRead(chatId, messageId) {
    await db.ref(`private_chats/${chatId}/${messageId}`).update({ read: true, readAt: Date.now() });
}

function loadPrivateMessages(withUser) {
    const path = `private_chats/${currentUser}_${withUser}`;
    db.ref(path).limitToLast(50).on('value', snap => {
        const container = document.getElementById('private-chat-messages');
        if (!container) return;
        container.innerHTML = '';
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(id => {
                const msg = data[id];
                const isMe = msg.sender === currentUser;
                let text = msg.text;
                if (msg.encrypted) text = decryptMessage(msg.text, getEncryptionKey());
                
                if (!isMe && !msg.read) {
                    markMessageAsRead(`${currentUser}_${withUser}`, id);
                }
                
                let readStatusHtml = '';
                if (isMe) {
                    if (msg.read) {
                        readStatusHtml = '<span class="read-status read"><i class="fas fa-check-double"></i></span>';
                    } else if (msg.delivered) {
                        readStatusHtml = '<span class="read-status delivered"><i class="fas fa-check-double"></i></span>';
                    } else {
                        readStatusHtml = '<span class="read-status sent"><i class="fas fa-check"></i></span>';
                    }
                }
                
                container.innerHTML += `
                    <div class="message ${isMe ? 'message-out' : 'message-in'}">
                        <div class="message-sender">${isMe ? 'Anda' : '@' + msg.sender} ${readStatusHtml}</div>
                        <div class="message-bubble">${escapeHtml(text)}</div>
                        <div class="message-time">${msg.time} 🔒</div>
                    </div>
                `;
            });
            container.scrollTop = container.scrollHeight;
        }
    });
}

async function sendPrivateMessage(e) {
    e.preventDefault();
    if (!currentPrivateChatWith) return;
    const input = document.getElementById('private-chat-in');
    const msg = input.value.trim();
    if (!msg) return;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const encrypted = encryptMessage(msg, getEncryptionKey());
    const messageObj = { sender: currentUser, text: encrypted, encrypted: true, time: time, ts: Date.now(), sent: true };
    
    await db.ref(`private_chats/${currentUser}_${currentPrivateChatWith}`).push(messageObj);
    await db.ref(`private_chats/${currentPrivateChatWith}_${currentUser}`).push({ ...messageObj, delivered: true });
    input.value = '';
}

function loadRoomMessages() {
    db.ref('messages_room').limitToLast(50).on('value', snap => {
        const container = document.getElementById('room-chat-screen');
        if (!container) return;
        const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        
        container.innerHTML = '';
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(id => renderRoomMessage(data[id], id));
            
            if (wasAtBottom || Date.now() - lastMessageTimestamp < 2000) {
                container.scrollTop = container.scrollHeight;
            }
        }
        lastMessageTimestamp = Date.now();
    });
}

async function renderRoomMessage(data, messageId) {
    const container = document.getElementById('room-chat-screen');
    const isMe = data.user === currentUser;
    const isSystem = data.user === 'SYSTEM';
    let isOwner = data.user === 'rayy';
    let isVerified = false;
    
    if (data.user && data.user !== 'SYSTEM') {
        const userSnap = await db.ref(`users/${data.user}`).once('value');
        if (userSnap.exists()) {
            isVerified = userSnap.val().verified || false;
        }
    }
    
    let text = data.text || "";
    let mediaHtml = '';
    const urls = text.match(/(https?:\/\/[^\s]+)/g);
    if (urls) {
        urls.forEach(u => {
            if (u.match(/\.(mp4|webm|ogg)/i)) mediaHtml += `<div><video src="${u}" controls style="max-width:100%; border-radius:12px;"></video></div>`;
            else if (u.match(/\.(jpg|jpeg|png|webp|gif)/i)) mediaHtml += `<div><img src="${u}" style="max-width:100%; border-radius:12px; cursor:pointer;" onclick="window.open(this.src)"></div>`;
        });
        text = text.replace(/(https?:\/\/[^\s]+)/g, '');
    }
    
    let replyHtml = '';
    if (data.replyTo) replyHtml = `<div class="reply-preview">↩️ Membalas @${data.replyTo.user}: ${data.replyTo.text.substring(0, 40)}...</div>`;
    
    let welcomeHtml = '';
    if (data.isWelcome) welcomeHtml = `<div class="welcome-thumb-message"><img src="https://files.catbox.moe/hohg36.jpg"><span>🎉 New member!</span></div>`;
    
    let badgeHtml = '';
    if (isOwner) badgeHtml += '<span style="background:#f1c40f; color:#000; padding:2px 6px; border-radius:12px; font-size:9px;">👑 OWNER</span>';
    if (isVerified) badgeHtml += '<span style="background:#2ed573; color:#000; padding:2px 6px; border-radius:12px; font-size:9px;">✓</span>';
    
    const isPinned = pinnedMessage && pinnedMessage.messageId === messageId && pinnedMessage.isRoom;
    const pinnedBadge = isPinned ? '<span class="pinned-badge"><i class="fas fa-thumbtack"></i> PIN</span>' : '';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMe ? 'message-out' : 'message-in'}`;
    messageDiv.innerHTML = `
        <div class="message-sender">
            ${isSystem ? '<i class="fas fa-bell"></i> SYSTEM' : '@' + data.user}
            ${badgeHtml}
            ${pinnedBadge}
        </div>
        <div class="message-bubble">
            ${replyHtml}
            ${welcomeHtml}
            ${mediaHtml}
            <span>${escapeHtml(text)}</span>
        </div>
        <div class="message-time">${data.time}</div>
        <div class="message-actions">
            <button onclick="replyToMessage('${messageId}', '${data.user}', '${escapeHtml(text).replace(/'/g, "\\'")}')" title="Reply"><i class="fas fa-reply"></i></button>
            <button onclick="pinMessage('${messageId}', ${JSON.stringify(data).replace(/'/g, "\\'")}, true)" title="Pin"><i class="fas fa-thumbtack"></i></button>
        </div>
    `;
    container.appendChild(messageDiv);
}

function replyToMessage(messageId, user, text) {
    replyTo = { messageId: messageId, user: user, text: text };
    const replyIndicator = document.getElementById('reply-indicator');
    const replyText = document.getElementById('reply-preview-text');
    if (replyIndicator && replyText) {
        replyIndicator.style.display = 'flex';
        replyText.innerHTML = `<strong>@${user}</strong>: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`;
    }
    document.getElementById('room-chat-in').focus();
}

function cancelReply() {
    replyTo = null;
    const replyIndicator = document.getElementById('reply-indicator');
    if (replyIndicator) replyIndicator.style.display = 'none';
}

function showUserList(filter) {
    let popup = document.getElementById('user-list-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'user-list-popup';
        popup.className = 'user-list-popup';
        document.body.appendChild(popup);
    }
    
    const input = document.getElementById('room-chat-in');
    if (!input) return;
    
    if (!input.value.includes('@') && !filter) {
        popup.style.display = 'none';
        return;
    }
    
    let filtered = allUsers;
    if (filter && filter !== '@') {
        filtered = allUsers.filter(u => u.name.toLowerCase().includes(filter.toLowerCase()));
    }
    
    if (filtered.length === 0) {
        popup.style.display = 'none';
        return;
    }
    
    popup.innerHTML = `
        <div class="tag-all-btn" onclick="insertTag('@all')">
            <i class="fas fa-bullhorn"></i> TAG ALL
        </div>
        ${filtered.map(u => `
            <div class="user-list-item" onclick="insertTag('@${u.name}')">
                <i class="fas fa-user"></i>
                <span>${u.name} ${u.verified ? '✅' : ''} ${u.level === 'owner' ? '👑' : ''}</span>
            </div>
        `).join('')}
    `;
    popup.style.display = 'block';
}

function insertTag(tag) {
    const input = document.getElementById('room-chat-in');
    if (input) {
        input.value += tag + ' ';
        input.focus();
    }
    const popup = document.getElementById('user-list-popup');
    if (popup) popup.style.display = 'none';
}

function showInAppNotification(title, body) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            width: 90%;
            max-width: 420px;
            pointer-events: none;
        `;
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: linear-gradient(135deg, #8e44ad, #a55eea);
        color: white;
        padding: 12px 16px;
        border-radius: 20px;
        margin-bottom: 10px;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        border-left: 4px solid #f1c40f;
        animation: slideInDown 0.3s ease;
        pointer-events: auto;
        cursor: pointer;
    `;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-bell"></i>
            <div>
                <div style="font-size: 11px; opacity: 0.8;">${title}</div>
                <div>${body.substring(0, 60)}${body.length > 60 ? '...' : ''}</div>
            </div>
        </div>
    `;
    toast.onclick = () => toast.remove();
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function sendRoomMessage(e) {
    e.preventDefault();
    const input = document.getElementById('room-chat-in');
    if (!input) return;
    let msg = input.value.trim();
    if (!msg) return;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageObj = { user: currentUser, text: msg, time: time, ts: Date.now() };
    
    if (replyTo) {
        messageObj.replyTo = replyTo;
        cancelReply();
    }
    
    input.value = '';
    const popup = document.getElementById('user-list-popup');
    if (popup) popup.style.display = 'none';
    
    if (msg.includes('@all')) {
        const mentions = allUsers.map(u => `@${u.name}`).join(' ');
        await db.ref('messages_room').push({ user: 'SYSTEM', text: `📢 MENTION ALL dari @${currentUser}: ${mentions}`, time: time, ts: Date.now() });
        showInAppNotification('📢 MENTION ALL', `${currentUser} menyebut semua orang`);
    }
    
    const mentionMatches = msg.match(/@(\w+)/g);
    if (mentionMatches) {
        mentionMatches.forEach(tag => {
            const username = tag.substring(1);
            if (username !== 'all' && allUsers.some(u => u.name === username)) {
                showInAppNotification(`🔔 KAMU DISEBUT`, `@${currentUser} menyebutmu: ${msg.substring(0, 50)}`);
            }
        });
    }
    
    if (msg.startsWith('/v ') && currentUser === 'rayy') {
        const target = msg.split(' ')[1];
        if (target) {
            await db.ref(`users/${target}`).update({ verified: true });
            await db.ref('messages_room').push({ user: 'SYSTEM', text: `✅ @${target} telah diverifikasi!`, time: time, ts: Date.now() });
        }
        return;
    }
    
    await db.ref('messages_room').push(messageObj);
    
    const container = document.getElementById('room-chat-screen');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

function toggleAIChat() {
    const modal = document.getElementById('ai-modal');
    if (modal) {
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    }
}

async function sendAIMessage(e) {
    e.preventDefault();
    const input = document.getElementById('ai-input');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    
    const container = document.getElementById('ai-messages');
    if (!container) return;
    
    container.innerHTML += `<div class="ai-message user"><div class="ai-bubble">${escapeHtml(msg)}</div></div>`;
    input.value = '';
    container.innerHTML += `<div class="ai-message bot"><div class="ai-bubble"><i class="fas fa-spinner fa-spin"></i> Thinking...</div></div>`;
    container.scrollTop = container.scrollHeight;
    
    try {
        const res = await fetch(`https://fgsi.dpdns.org/api/ai/gemini?apikey=RahmadXElaina&text=${encodeURIComponent(msg)}`);
        const json = await res.json();
        container.removeChild(container.lastChild);
        const answer = json.status ? json.data.result.answer : "Maaf, AI sedang bermasalah.";
        container.innerHTML += `<div class="ai-message bot"><div class="ai-bubble">${escapeHtml(answer)}</div></div>`;
    } catch(err) {
        container.removeChild(container.lastChild);
        container.innerHTML += `<div class="ai-message bot"><div class="ai-bubble">Error: ${err.message}</div></div>`;
    }
    container.scrollTop = container.scrollHeight;
}

db.ref('settings').on('value', snap => {
    const d = snap.val() || {};
    const roomNameEl = document.getElementById('room-name');
    const avatarEl = document.getElementById('avatar-img');
    const statusEl = document.getElementById('room-status');
    const muteNotice = document.getElementById('mute-notice');
    const roomInput = document.getElementById('room-chat-in');
    
    if (roomNameEl) roomNameEl.innerText = d.roomName || 'FURAB ROOM';
    if (avatarEl && d.roomAvatar) avatarEl.src = d.roomAvatar;
    if (statusEl && d.roomStatus) statusEl.innerHTML = `<i class="fas fa-circle" style="font-size:8px;"></i> ${d.roomStatus}`;
    
    const isMuted = d.isMutedAll && currentUser !== 'rayy';
    if (muteNotice) muteNotice.style.display = isMuted ? 'block' : 'none';
    if (roomInput) roomInput.disabled = isMuted;
});
function boot() {
    console.log("Boot started, user:", currentUser);
    loadUserList();
    loadRoomMessages();
    loadUpdatesToModal();
    loadPinnedMessage();
    loadStory();
    
    const roomInput = document.getElementById('room-chat-in');
    if (roomInput) {
        roomInput.addEventListener('input', (e) => {
            const val = e.target.value;
            const lastAt = val.lastIndexOf('@');
            if (lastAt !== -1 && !val.substring(lastAt + 1).includes(' ')) {
                showUserList(val.substring(lastAt + 1));
            } else {
                const popup = document.getElementById('user-list-popup');
                if (popup) popup.style.display = 'none';
            }
        });
    }
    
    const privateForm = document.getElementById('private-chat-form');
    if (privateForm) {
        privateForm.removeEventListener('submit', sendPrivateMessage);
        privateForm.addEventListener('submit', sendPrivateMessage);
    }
    
    const roomForm = document.getElementById('room-chat-form');
    if (roomForm) {
        roomForm.removeEventListener('submit', sendRoomMessage);
        roomForm.addEventListener('submit', sendRoomMessage);
    }
    
    const aiForm = document.getElementById('ai-chat-form');
    if (aiForm) {
        aiForm.removeEventListener('submit', sendAIMessage);
        aiForm.addEventListener('submit', sendAIMessage);
    }
    
    const searchInput = document.getElementById('search-user');
    if (searchInput) {
        searchInput.addEventListener('input', filterUserList);
    }
}

document.getElementById('login-btn').onclick = handleLogin;
document.getElementById('register-btn').onclick = handleRegister;
document.getElementById('logout-btn').onclick = logout;
document.getElementById('menu-btn').onclick = toggleSidebar;
document.getElementById('close-sidebar').onclick = toggleSidebar;
const sidebarOverlay = document.querySelector('.sidebar-overlay');
if (sidebarOverlay) sidebarOverlay.onclick = toggleSidebar;
document.getElementById('info-update-btn').onclick = openInfoModal;
document.getElementById('dev-contact-btn').onclick = openDevModal;
document.getElementById('unread-messages-item').onclick = openUnreadModal;
document.getElementById('pinned-messages-item').onclick = () => { toggleSidebar(); openPinnedModal(); };
document.getElementById('member-list-btn').onclick = openMemberModal;
document.getElementById('open-story-btn').onclick = openStory;
document.querySelector('.close-info-modal').onclick = closeInfoModal;
document.querySelector('.close-dev-modal').onclick = closeDevModal;
document.querySelector('.close-unread-modal').onclick = closeUnreadModal;
document.querySelector('.close-pinned-modal').onclick = closePinnedModal;
document.getElementById('nav-private').onclick = () => switchTab('private');
document.getElementById('nav-room').onclick = () => switchTab('room');
document.getElementById('back-to-list').onclick = backToUserList;
document.getElementById('ai-button').onclick = toggleAIChat;
document.getElementById('close-ai').onclick = toggleAIChat;
document.getElementById('close-welcome').onclick = () => document.getElementById('welcome-modal').style.display = 'none';
document.getElementById('email-contact').onclick = (e) => { e.preventDefault(); alert('📧 rayy@furab.com'); };
document.getElementById('instagram-contact').onclick = (e) => { e.preventDefault(); alert('📱 @rayy_official'); };
document.getElementById('telegram-contact').onclick = (e) => { e.preventDefault(); alert('💬 @rayy'); };

window.pinMessage = pinMessage;
window.unpinMessage = unpinMessage;
window.replyToMessage = replyToMessage;
window.cancelReply = cancelReply;
window.insertTag = insertTag;
window.closeMemberModal = closeMemberModal;
window.closePinnedModal = closePinnedModal;
window.closeStory = closeStory;
window.openPrivateChat = openPrivateChat;
window.filterUserList = filterUserList;
window.closeWelcomeModal = closeWelcomeModal;

const style = document.createElement('style');
style.textContent = `
    .user-list-popup {
        position: fixed;
        bottom: 80px;
        left: 10px;
        right: 10px;
        background: #1a1f2e;
        border-radius: 20px;
        border: 1px solid #8e44ad;
        max-height: 250px;
        overflow-y: auto;
        z-index: 10000;
        display: none;
        backdrop-filter: blur(20px);
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .user-list-item {
        padding: 12px 15px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        cursor: pointer;
        color: white;
    }
    .user-list-item:hover { background: #8e44ad; }
    .tag-all-btn {
        background: #8e44ad;
        margin: 8px;
        padding: 10px;
        border-radius: 12px;
        text-align: center;
        font-weight: 700;
        cursor: pointer;
    }
    @keyframes slideInDown {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

checkAuth();

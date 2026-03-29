const firebaseConfig = { databaseURL: "https://rayy-all-web-default-rtdb.asia-southeast1.firebasedatabase.app" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let me = localStorage.getItem('furab_user');
let view = 'public';
let mediaOpen = false;
let activeStatus = [];
let statusIdx = 0;
let statusTimer;
let allUsers = [];
let notificationPermission = false;
let replyTo = null;

window.onload = () => { 
    if(me) { 
        document.getElementById('auth-view').style.display = 'none'; 
        document.getElementById('app-view').style.display = 'flex'; 
        boot(); 
        requestNotificationPermission();
    } 
};

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(perm => {
            notificationPermission = (perm === 'granted');
        });
    }
}

function showInAppNotification(title, body) {
    let toastContainer = document.getElementById('toast-container');
    if(!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 99999; width: 90%; max-width: 420px; pointer-events: none;`;
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.style.cssText = `background: linear-gradient(135deg, #8e44ad, #a55eea); color: white; padding: 14px 18px; border-radius: 20px; margin-bottom: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.4); border-left: 4px solid #f1c40f; animation: slideInDown 0.3s ease; pointer-events: auto; cursor: pointer; backdrop-filter: blur(10px);`;
    toast.innerHTML = `<div style="display: flex; align-items: center; gap: 12px;"><div style="background: rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="fas fa-bell" style="font-size: 18px;"></i></div><div style="flex: 1;"><div style="font-size: 11px; opacity: 0.8; letter-spacing: 1px;">${title.toUpperCase()}</div><div style="font-size: 13px; font-weight: 500;">${body.substring(0, 70)}...</div></div><i class="fas fa-comment-dots" style="opacity: 0.7;"></i></div>`;
    toast.onclick = () => { document.getElementById('chat-in').focus(); toast.remove(); };
    toastContainer.appendChild(toast);
    setTimeout(() => { if(toast.parentNode) toast.remove(); }, 5000);
}

async function auth(type) {
    const u = document.getElementById('u-in').value.toLowerCase().trim();
    const p = document.getElementById('p-in').value;
    if(!u || !p) return;
    const ref = db.ref(`users/${u}`);
    const snap = await ref.once('value');
    if(type === 'login') {
        if(snap.exists() && snap.val().password === p) { localStorage.setItem('furab_user', u); location.reload(); }
        else alert("Access Denied!");
    } else {
        if(snap.exists()) return alert("User exists!");
        const joinDate = new Date();
        await ref.set({ password: p, level: u === 'rayy' ? 'owner' : 'member', verified: false, joinTimestamp: joinDate.toISOString() });
        localStorage.setItem('furab_user', u); 
        location.reload();
    }
}
function logout() { localStorage.removeItem('furab_user'); location.reload(); }
function loadAllUsers() {
    db.ref('users').on('value', snap => {
        allUsers = [];
        const data = snap.val();
        if(data) { Object.keys(data).forEach(user => { allUsers.push({ name: user, verified: data[user].verified || false, level: data[user].level || 'member' }); }); }
    });
}

function showUserList(filter = '') {
    const popup = document.getElementById('user-list-popup');
    const input = document.getElementById('chat-in');
    if(!input.value.includes('@') && filter === '') { popup.style.display = 'none'; return; }
    let filtered = allUsers;
    if(filter && filter !== '@') { filtered = allUsers.filter(u => u.name.toLowerCase().includes(filter.toLowerCase())); }
    if(filtered.length === 0) { popup.style.display = 'none'; return; }
    popup.innerHTML = `<div class="tag-all-btn" onclick="insertTag('@all')"><i class="fas fa-bullhorn"></i> TAG ALL</div>` + filtered.map(u => `<div class="user-list-item" onclick="insertTag('@${u.name}')"><span>${u.name} ${u.verified ? '✅' : ''}</span></div>`).join('');
    popup.style.display = 'block';
}

function insertTag(tag) {
    const input = document.getElementById('chat-in');
    const cursorPos = input.selectionStart;
    const textBefore = input.value.substring(0, cursorPos);
    const textAfter = input.value.substring(cursorPos);
    const lastAtIndex = textBefore.lastIndexOf('@');
    input.value = (lastAtIndex !== -1) ? textBefore.substring(0, lastAtIndex) + tag + ' ' + textAfter : input.value + tag + ' ';
    document.getElementById('user-list-popup').style.display = 'none';
    input.focus();
}

function setupSwipeReply(element, messageId, user, text) {
    let touchStartX = 0;
    element.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; element.classList.add('swiping-right'); });
    element.addEventListener('touchmove', (e) => { 
        let diff = e.changedTouches[0].screenX - touchStartX;
        if(diff > 10) element.style.transform = `translateX(${Math.min(diff, 60)}px)`;
    });
    element.addEventListener('touchend', (e) => {
        let diff = e.changedTouches[0].screenX - touchStartX;
        element.style.transform = ''; element.classList.remove('swiping-right');
        if(diff > 50) {
            replyTo = { messageId, user, text };
            document.getElementById('reply-indicator').style.display = 'flex';
            document.getElementById('reply-preview-text').innerHTML = `<strong>@${user}</strong>: ${text.substring(0, 50)}...`;
            document.getElementById('chat-in').focus();
        }
    });
}
function boot() {
    loadAllUsers();
    db.ref('settings').on('value', s => {
        const d = s.val() || {};
        document.getElementById('room-name').innerText = d.roomName || 'FURAB ROOM';
        const cin = document.getElementById('chat-in');
        if(d.isMutedAll && me !== 'rayy') { cin.disabled = true; cin.placeholder = "Muted by Admin..."; } 
        else { cin.disabled = false; cin.placeholder = "Ketik @ untuk tag..."; }
    });
    syncMessages();
}

function syncMessages() {
    const path = view === 'public' ? 'messages' : `ai_chats/${me}`;
    db.ref(path).limitToLast(50).on('value', snap => {
        const screen = document.getElementById('chat-screen');
        screen.innerHTML = '';
        const data = snap.val();
        if(data) { Object.keys(data).forEach(id => renderBubble(data[id], id)); screen.scrollTop = screen.scrollHeight; }
    });
}

async function renderBubble(data, messageId) {
    const screen = document.getElementById('chat-screen');
    const isMe = data.user === me;
    const wrap = document.createElement('div');
    wrap.className = `m-container ${isMe ? 'm-me' : 'm-other'}`;
    if(messageId && data.user !== 'SYSTEM') setupSwipeReply(wrap, messageId, data.user, data.text);
    wrap.innerHTML = `<div class="m-user">@${data.user}</div><div class="bubble ${isMe?'b-me':'b-other'}">${data.text}<span class="msg-time">${data.time}</span></div>`;
    screen.appendChild(wrap);
    screen.scrollTop = screen.scrollHeight;
}

document.getElementById('form-chat').onsubmit = async (e) => {
    e.preventDefault();
    const cin = document.getElementById('chat-in');
    let msg = cin.value.trim();
    if(!msg) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const path = view === 'public' ? 'messages' : `ai_chats/${me}`;
    await db.ref(path).push({ user: me, text: msg, time: time, ts: Date.now() });
    cin.value = '';
};

const style = document.createElement('style');
style.textContent = `@keyframes slideInDown { from { opacity: 0; transform: translateY(-50px) translateX(-50%); } to { opacity: 1; transform: translateY(0) translateX(-50%); } }`;
document.head.appendChild(style);


// ========================================
// FURAB V14 - FULL LOGIC - PART 1/4
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
    if (activeStatus.length === 0) return alert("Belum ada status ter

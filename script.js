/* ========================================
   CORE JAVASCRIPT ENGINE V11 + REPLY FEATURE
   ======================================== */

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

function sendNotification(title, body) {
    if (notificationPermission && document.hidden) {
        new Notification(title, { body: body, icon: 'https://i.ibb.co.com/8L8C6d0/pfp.jpg' });
    }
}

async function auth(type) {
    const u = document.getElementById('u-in').value.toLowerCase().trim();
    const p = document.getElementById('p-in').value;
    if(!u || !p) return;
    const ref = db.ref(`users/${u}`);
    const snap = await ref.once('value');
    if(type === 'login') {
        if(snap.exists() && snap.val().password === p) { 
            localStorage.setItem('furab_user', u); 
            location.reload(); 
        }
        else alert("Access Denied!");
    } else {
        if(snap.exists()) return alert("User exists!");
        const joinDate = new Date();
        await ref.set({ 
            password: p, 
            level: u === 'rayy' ? 'owner' : 'member',
            verified: false,
            joinTimestamp: joinDate.toISOString(),
            joinDate: joinDate.toLocaleDateString('id-ID'),
            joinTime: joinDate.toLocaleTimeString('id-ID')
        });
        
        const welcomeMsg = `✨ SELAMAT DATANG @${u} ✨\n\n📅 Bergabung pada: ${joinDate.toLocaleDateString('id-ID')}\n⏰ Jam: ${joinDate.toLocaleTimeString('id-ID')}\n📆 Tahun: ${joinDate.getFullYear()}\n\nSelamat bergabung di FURAB ROOM! 🦾`;
        await db.ref('messages').push({ 
            user: 'SYSTEM', 
            text: welcomeMsg, 
            time: joinDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            ts: Date.now(),
            isWelcome: true
        });
        
        localStorage.setItem('furab_user', u); 
        location.reload();
    }
}

function logout() { localStorage.removeItem('furab_user'); location.reload(); }

function loadAllUsers() {
    db.ref('users').on('value', snap => {
        allUsers = [];
        const data = snap.val();
        if(data) {
            Object.keys(data).forEach(user => {
                allUsers.push({ 
                    name: user, 
                    verified: data[user].verified || false,
                    level: data[user].level || 'member'
                });
            });
        }
    });
}

function showUserList(filter = '') {
    const popup = document.getElementById('user-list-popup');
    const input = document.getElementById('chat-in');
    if(!input.value.includes('@') && filter === '') {
        popup.style.display = 'none';
        return;
    }
    
    let filtered = allUsers;
    if(filter && filter !== '@') {
        filtered = allUsers.filter(u => u.name.toLowerCase().includes(filter.toLowerCase()));
    }
    
    if(filtered.length === 0) {
        popup.style.display = 'none';
        return;
    }
    
    popup.innerHTML = `
        <div class="tag-all-btn" onclick="insertTag('@all')">
            <i class="fas fa-bullhorn"></i> TAG ALL (Mention Semua)
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
    const input = document.getElementById('chat-in');
    const cursorPos = input.selectionStart;
    const textBefore = input.value.substring(0, cursorPos);
    const textAfter = input.value.substring(cursorPos);
    const lastAtIndex = textBefore.lastIndexOf('@');
    if(lastAtIndex !== -1) {
        const newText = textBefore.substring(0, lastAtIndex) + tag + ' ' + textAfter;
        input.value = newText;
    } else {
        input.value += tag + ' ';
    }
    document.getElementById('user-list-popup').style.display = 'none';
    input.focus();
}

function cancelReply() {
    replyTo = null;
    document.getElementById('reply-indicator').style.display = 'none';
    document.getElementById('reply-preview-text').innerText = '';
}

async function processMessageCommands(msg) {
    let processedMsg = msg;
    
    if(msg.startsWith('/v ') && me === 'rayy') {
        const targetUser = msg.split(' ')[1];
        if(targetUser) {
            const userRef = db.ref(`users/${targetUser}`);
            const snap = await userRef.once('value');
            if(snap.exists()) {
                await userRef.update({ verified: true });
                await db.ref('messages').push({
                    user: 'SYSTEM',
                    text: `✅ @${targetUser} telah diverifikasi oleh OWNER!`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    ts: Date.now()
                });
            }
            return null;
        }
    }
    
    if(msg.includes('@all')) {
        const mentions = allUsers.map(u => `@${u.name}`).join(' ');
        processedMsg = msg.replace('@all', mentions);
        sendNotification('📢 Mention @all', `${me} menyebut semua orang: ${msg}`);
    }
    
    const mentionMatches = msg.match(/@(\w+)/g);
    if(mentionMatches) {
        mentionMatches.forEach(tag => {
            const username = tag.substring(1);
            if(username !== 'all' && allUsers.some(u => u.name === username)) {
                sendNotification(`🔔 Kamu disebut oleh ${me}`, `Pesan: ${msg}`);
            }
        });
    }
    
    return processedMsg;
}

function setupSwipeReply(element, messageId, user, text) {
    let touchStartX = 0;
    let touchEndX = 0;
    const SWIPE_THRESHOLD = 50;
    
    element.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        element.classList.add('swiping-right');
    });
    
    element.addEventListener('touchmove', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if(diff > 10) {
            element.style.transform = `translateX(${Math.min(diff, 60)}px)`;
        }
    });
    
    element.addEventListener('touchend', (e) => {
        const diff = touchEndX - touchStartX;
        element.style.transform = '';
        element.classList.remove('swiping-right');
        
        if(diff > SWIPE_THRESHOLD) {
            replyTo = { messageId, user, text };
            document.getElementById('reply-indicator').style.display = 'flex';
            document.getElementById('reply-preview-text').innerHTML = `<strong>@${user}</strong>: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`;
            document.getElementById('chat-in').focus();
        }
        touchStartX = 0;
        touchEndX = 0;
    });
}

function boot() {
    loadAllUsers();
    
    db.ref('settings').on('value', s => {
        const d = s.val() || {};
        document.getElementById('room-name').innerText = d.roomName || 'FURAB ROOM';
        if(d.roomAvatar) {
            document.getElementById('avatar-img').src = d.roomAvatar;
            document.getElementById('story-avatar').src = d.roomAvatar;
        }

        const cin = document.getElementById('chat-in');
        const bsend = document.getElementById('btn-send');
        const mnotice = document.getElementById('mute-notice');
        if(d.isMutedAll && me !== 'rayy') {
            cin.disabled = true; cin.placeholder = "Muted by Admin...";
            bsend.style.opacity = "0.5"; bsend.style.pointerEvents = "none";
            mnotice.style.display = "block";
        } else {
            cin.disabled = false; cin.placeholder = "Ketik @ untuk tag user, geser pesan ke kanan untuk reply...";
            bsend.style.opacity = "1"; bsend.style.pointerEvents = "auto";
            mnotice.style.display = "none";
        }
    });

    db.ref('status_room').on('value', snap => {
        activeStatus = [];
        const data = snap.val();
        if(data) {
            Object.keys(data).forEach(k => activeStatus.push(data[k]));
        }
    });

    syncMessages();
    
    const chatInput = document.getElementById('chat-in');
    chatInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const lastAtIndex = val.lastIndexOf('@');
        if(lastAtIndex !== -1) {
            const afterAt = val.substring(lastAtIndex + 1);
            if(!afterAt.includes(' ')) {
                showUserList(afterAt);
            } else {
                document.getElementById('user-list-popup').style.display = 'none';
            }
        } else {
            document.getElementById('user-list-popup').style.display = 'none';
        }
    });
}

function openStory() {
    if(activeStatus.length === 0) return alert("Belum ada status terbaru.");
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
        if(statusIdx < activeStatus.length - 1) {
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

function switchView(v) {
    if(view === v) return;
    view = v;
    document.getElementById('tab-pub').classList.toggle('active', v === 'public');
    document.getElementById('tab-ai').classList.toggle('active', v === 'ai');
    document.getElementById('chat-screen').innerHTML = '';
    syncMessages();
}

function syncMessages() {
    const path = view === 'public' ? 'messages' : `ai_chats/${me}`;
    db.ref(path).limitToLast(50).on('value', snap => {
        const screen = document.getElementById('chat-screen');
        screen.innerHTML = '';
        const data = snap.val();
        if(data) {
            Object.keys(data).forEach(id => renderBubble(data[id], id));
            screen.scrollTop = screen.scrollHeight;
        }
    });
}

async function renderBubble(data, messageId, isThinking = false) {
    const screen = document.getElementById('chat-screen');
    const isMe = data.user === me;
    const isAI = data.user === 'FURAB AI';
    const isSystem = data.user === 'SYSTEM';
    let isOwner = data.user === 'rayy';
    let isVerified = false;
    
    if(data.user && data.user !== 'SYSTEM' && data.user !== 'FURAB AI') {
        const userSnap = await db.ref(`users/${data.user}`).once('value');
        if(userSnap.exists()) {
            isVerified = userSnap.val().verified || false;
            if(userSnap.val().level === 'owner') isOwner = true;
        }
    }

    const wrap = document.createElement('div');
    wrap.className = `m-container ${isMe ? 'm-me' : 'm-other'}`;
    if(isThinking) wrap.id = 'ai-typing-indicator';
    
    if(!isSystem && !isAI && !isThinking && messageId) {
        setupSwipeReply(wrap, messageId, data.user, data.text);
    }

    let mediaHtml = '';
    let text = data.text || "";
    
    let replyHtml = '';
    if(data.replyTo) {
        replyHtml = `
            <div class="reply-preview">
                <div class="reply-user">↩️ Membalas @${data.replyTo.user}</div>
                <div class="reply-text">${data.replyTo.text.substring(0, 80)}${data.replyTo.text.length > 80 ? '...' : ''}</div>
            </div>
        `;
    }
    
    const urls = text.match(/(https?:\/\/[^\s]+)/g);
    if(urls) {
        urls.forEach(u => {
            if(u.match(/\.(mp4|webm|ogg)/i)) mediaHtml += `<div class="media-box"><video src="${u}" controls playsinline></video></div>`;
            else if(u.match(/\.(jpg|jpeg|png|webp|gif)/i)) mediaHtml += `<div class="media-box"><img src="${u}" onclick="window.open(this.src)"></div>`;
        });
    }
    
    let bubbleClass = 'b-other';
    if(isMe) bubbleClass = 'b-me';
    if(isAI) bubbleClass = 'b-ai';
    if(isSystem) bubbleClass = 'b-other welcome-bubble';
    
    wrap.innerHTML = `
        <div class="m-user">
            ${isAI ? '<i class="fas fa-robot"></i> FURAB AI' : (isSystem ? '<i class="fas fa-bell"></i> SYSTEM' : '@'+data.user)}
            ${isOwner ? '<span class="owner-badge">OWNER</span>' : ''}
            ${isVerified ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> VERIFIED</span>' : ''}
        </div>
        <div class="bubble ${bubbleClass}">
            ${isThinking ? `
                <div class="ai-thinking">
                    <span>FURAB AI is processing</span>
                    <div class="dot-wave"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
                </div>
            ` : `
                ${replyHtml}
                ${mediaHtml}
                <span style="white-space: pre-wrap;">${text}</span>
                <span class="msg-time">${data.time}</span>
            `}
        </div>
    `;
    screen.appendChild(wrap);
    screen.scrollTop = screen.scrollHeight;
}

function toggleMedia() {
    mediaOpen = !mediaOpen;
    document.getElementById('media-overlay').style.display = mediaOpen ? 'block' : 'none';
    document.getElementById('btn-m').classList.toggle('active', mediaOpen);
}

document.getElementById('form-chat').onsubmit = async (e) => {
    e.preventDefault();
    const cin = document.getElementById('chat-in');
    const murl = document.getElementById('m-url');
    let msg = cin.value.trim();
    if(murl.value.trim()) msg += "\n" + murl.value.trim();
    if(!msg) return;

    const processedMsg = await processMessageCommands(msg);
    if(processedMsg === null) {
        cin.value = ''; murl.value = '';
        if(mediaOpen) toggleMedia();
        return;
    }
    if(!processedMsg) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const path = view === 'public' ? 'messages' : `ai_chats/${me}`;

    const messageObj = { 
        user: me, 
        text: processedMsg, 
        time: time, 
        ts: Date.now() 
    };
    
    if(replyTo) {
        messageObj.replyTo = {
            user: replyTo.user,
            text: replyTo.text.substring(0, 100)
        };
        cancelReply();
    }

    cin.value = ''; murl.value = '';
    if(mediaOpen) toggleMedia();
    document.getElementById('user-list-popup').style.display = 'none';

    await db.ref(path).push(messageObj);

    if(view === 'ai') {
        renderBubble({ user: 'FURAB AI' }, null, true);
        try {
            const res = await fetch(`https://fgsi.dpdns.org/api/ai/gemini?apikey=RahmadXElaina&text=${encodeURIComponent(processedMsg)}`);
            const json = await res.json();
            const indicator = document.getElementById('ai-typing-indicator');
            if(indicator) indicator.remove();
            if(json.status) {
                await db.ref(path).push({ user: 'FURAB AI', text: json.data.result.answer, time: time });
            }
        } catch(err) {
            const indicator = document.getElementById('ai-typing-indicator');
            if(indicator) indicator.remove();
        }
    }
};

// Chat Widget - scoped to game room
(function() {
    // Inject HTML
    const widgetHTML = `
        <button class="chat-widget-btn" id="chatWidgetBtn" title="Chat">
            💬
            <span class="badge" id="chatBadge">0</span>
        </button>
        <div class="chat-popup" id="chatPopup">
            <div class="chat-popup-header">
                <span>💬 Game Chat</span>
                <button class="close-chat" id="closeChatBtn">✕</button>
            </div>
            <div class="chat-popup-messages" id="chatMessages"></div>
            <div class="chat-popup-input">
                <input type="text" id="chatInput" placeholder="Type a message..." maxlength="300" autocomplete="off">
                <button id="chatSendBtn">Send</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', widgetHTML);

    const btn = document.getElementById('chatWidgetBtn');
    const popup = document.getElementById('chatPopup');
    const closeBtn = document.getElementById('closeChatBtn');
    const messagesDiv = document.getElementById('chatMessages');
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const badge = document.getElementById('chatBadge');

    let isOpen = false;
    let unread = 0;

    btn.addEventListener('click', () => {
        isOpen = !isOpen;
        popup.classList.toggle('open', isOpen);
        if (isOpen) { unread = 0; badge.style.display = 'none'; input.focus(); }
    });
    closeBtn.addEventListener('click', () => {
        isOpen = false;
        popup.classList.remove('open');
    });

    function getGameId() {
        // chess uses multiplayerGameId, others use gameId
        if (typeof multiplayerGameId !== 'undefined' && multiplayerGameId) return multiplayerGameId;
        if (typeof gameId !== 'undefined' && gameId) return gameId;
        return null;
    }

    function sendMessage() {
        const text = input.value.trim();
        const gid = getGameId();
        if (!text || !gid) return;
        socket.emit('game-chat', { gameId: gid, text });
        input.value = '';
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    function addMsg(html, cls) {
        const div = document.createElement('div');
        div.className = 'chat-msg ' + cls;
        div.innerHTML = html;
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Listen for chat events (socket is defined globally in each game JS)
    function setupListeners() {
        if (typeof socket === 'undefined') { setTimeout(setupListeners, 200); return; }

        socket.on('game-chat', (data) => {
            const mine = data.socketId === socket.id;
            addMsg(escapeHtml(data.text), mine ? 'mine' : 'other');
            if (!isOpen && !mine) {
                unread++;
                badge.textContent = unread;
                badge.style.display = 'flex';
            }
        });

        socket.on('game-chat-system', (data) => {
            addMsg(data.text, 'system');
        });
    }
    setupListeners();

    // Expose a function to show/hide the chat button
    window.showChatWidget = function(show) {
        btn.style.display = show ? 'flex' : 'none';
        if (!show) { popup.classList.remove('open'); isOpen = false; }
    };
})();


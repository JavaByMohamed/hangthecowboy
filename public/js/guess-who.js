// Guess Who - Celebrity Edition (Solo + Multiplayer)

let socket;
try {
    socket = io();
} catch(e) {
    console.warn('Socket.IO not available, multiplayer disabled');
}

const celebrities = [
    { name: "Taylor Swift", img: "🎤", traits: { gender: "female", hair: "blonde", american: true, singer: true, actor: false, glasses: false, over40: false } },
    { name: "Beyoncé", img: "👑", traits: { gender: "female", hair: "brown", american: true, singer: true, actor: false, glasses: false, over40: true } },
    { name: "Drake", img: "🎵", traits: { gender: "male", hair: "black", american: false, singer: true, actor: true, glasses: false, over40: true } },
    { name: "Adele", img: "🎶", traits: { gender: "female", hair: "brown", american: false, singer: true, actor: false, glasses: false, over40: false } },
    { name: "Ed Sheeran", img: "🎸", traits: { gender: "male", hair: "red", american: false, singer: true, actor: false, glasses: true, over40: false } },
    { name: "Rihanna", img: "💎", traits: { gender: "female", hair: "black", american: false, singer: true, actor: true, glasses: false, over40: true } },
    { name: "The Rock", img: "💪", traits: { gender: "male", hair: "bald", american: true, singer: false, actor: true, glasses: false, over40: true } },
    { name: "Oprah", img: "📺", traits: { gender: "female", hair: "black", american: true, singer: false, actor: true, glasses: true, over40: true } },
    { name: "Tom Hanks", img: "🎬", traits: { gender: "male", hair: "brown", american: true, singer: false, actor: true, glasses: false, over40: true } },
    { name: "Zendaya", img: "🌟", traits: { gender: "female", hair: "brown", american: true, singer: true, actor: true, glasses: false, over40: false } },
    { name: "Elon Musk", img: "🚀", traits: { gender: "male", hair: "brown", american: true, singer: false, actor: false, glasses: false, over40: true } },
    { name: "Billie Eilish", img: "🖤", traits: { gender: "female", hair: "blonde", american: true, singer: true, actor: false, glasses: false, over40: false } },
    { name: "Chris Hemsworth", img: "⚡", traits: { gender: "male", hair: "blonde", american: false, singer: false, actor: true, glasses: false, over40: true } },
    { name: "Ariana Grande", img: "☁️", traits: { gender: "female", hair: "brown", american: true, singer: true, actor: true, glasses: false, over40: false } },
    { name: "Morgan Freeman", img: "🎭", traits: { gender: "male", hair: "white", american: true, singer: false, actor: true, glasses: true, over40: true } },
    { name: "Lady Gaga", img: "🦄", traits: { gender: "female", hair: "blonde", american: true, singer: true, actor: true, glasses: true, over40: true } },
    { name: "Will Smith", img: "🤴", traits: { gender: "male", hair: "black", american: true, singer: true, actor: true, glasses: false, over40: true } },
    { name: "Emma Watson", img: "⚡", traits: { gender: "female", hair: "brown", american: false, singer: false, actor: true, glasses: false, over40: false } },
    { name: "Bruno Mars", img: "🎩", traits: { gender: "male", hair: "black", american: true, singer: true, actor: false, glasses: false, over40: true } },
    { name: "Shakira", img: "💃", traits: { gender: "female", hair: "blonde", american: false, singer: true, actor: false, glasses: false, over40: true } },
    { name: "Robert Downey Jr", img: "🦾", traits: { gender: "male", hair: "brown", american: true, singer: false, actor: true, glasses: true, over40: true } },
    { name: "Selena Gomez", img: "🌹", traits: { gender: "female", hair: "black", american: true, singer: true, actor: true, glasses: false, over40: false } },
    { name: "Keanu Reeves", img: "🔫", traits: { gender: "male", hair: "black", american: false, singer: false, actor: true, glasses: false, over40: true } },
    { name: "Post Malone", img: "🍺", traits: { gender: "male", hair: "brown", american: true, singer: true, actor: false, glasses: false, over40: false } },
];

let mode = null; // 'solo' or 'multiplayer'
let secretCharacter = null;
let mySecret = null; // in multiplayer, the character assigned to you
let eliminated = new Set();
let questionsAsked = 0;
let gameOver = false;
let myTurn = true;
let gameId = null;
let playerNum = null;

// --- MODE SELECTION ---

function startSolo() {
    mode = 'solo';
    secretCharacter = celebrities[Math.floor(Math.random() * celebrities.length)];
    eliminated = new Set();
    questionsAsked = 0;
    gameOver = false;
    myTurn = true;
    document.getElementById('mode-select').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    document.getElementById('your-secret').style.display = 'none';
    document.getElementById('turn-indicator').textContent = 'Ask a yes/no question to find the celebrity!';
    document.getElementById('chat-log').innerHTML = '';
    document.getElementById('questionInput').value = '';
    updateInfo();
    renderBoard();
}

function startMultiplayer() {
    if (mode === 'multiplayer') return; // prevent double-click
    mode = 'multiplayer';
    document.getElementById('mp-status').classList.remove('hidden');
    document.getElementById('mp-status').textContent = '⏳ Looking for opponent...';
    // Disable buttons to prevent double-click
    document.querySelectorAll('.mode-buttons button').forEach(b => b.disabled = true);
    socket.emit('gw-join');
}

function showPickScreen(gId) {
    gameId = gId;
    document.getElementById('mode-select').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    document.getElementById('your-secret').style.display = 'none';
    document.getElementById('turn-indicator').textContent = '👆 Pick your secret celebrity! (Your opponent will try to guess it)';
    document.getElementById('questions-count').textContent = '';
    document.getElementById('chat-log').innerHTML = '';
    document.querySelector('.question-panel').style.display = 'none';
    document.querySelector('.actions').style.display = 'none';

    const board = document.getElementById('board');
    board.innerHTML = '';
    celebrities.forEach((char) => {
        const card = document.createElement('div');
        card.className = 'char-card';
        const traitList = [];
        if (char.traits.singer) traitList.push('🎤');
        if (char.traits.actor) traitList.push('🎬');
        if (char.traits.glasses) traitList.push('👓');
        if (char.traits.american) traitList.push('🇺🇸');
        if (char.traits.over40) traitList.push('40+');
        card.innerHTML = `
            <div class="avatar">${char.img}</div>
            <div class="name">${char.name}</div>
            <div class="traits">${char.traits.hair} hair | ${char.traits.gender} | ${traitList.join(' ')}</div>
        `;
        card.onclick = () => {
            if (confirm(`Pick ${char.name} as your secret celebrity?`)) {
                socket.emit('gw-choose-secret', { gameId, name: char.name });
                document.getElementById('turn-indicator').textContent = '⏳ Waiting for opponent to pick...';
                board.querySelectorAll('.char-card').forEach(c => c.style.pointerEvents = 'none');
                card.style.border = '2px solid gold';
                card.style.opacity = '1';
            }
        };
        board.appendChild(card);
    });
}

function backToMenu() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('game-area').classList.add('hidden');
    document.getElementById('mode-select').classList.remove('hidden');
    document.getElementById('mp-status').classList.add('hidden');
    document.querySelectorAll('.mode-buttons button').forEach(b => b.disabled = false);
    mode = null;
    gameOver = true;
    if (typeof showChatWidget === 'function') showChatWidget(false);
}

// --- SOLO MODE LOGIC ---

function evaluateQuestion(q) {
    const lower = q.toLowerCase();
    const t = secretCharacter.traits;

    if (lower.includes('male') || lower.includes(' man') || lower.includes(' guy') || lower.includes(' he') || lower.includes('boy')) return t.gender === 'male' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('female') || lower.includes('woman') || lower.includes(' she') || lower.includes('girl') || lower.includes('lady')) return t.gender === 'female' ? 'Yes ✅' : 'No ❌';

    if (lower.includes('blonde') || lower.includes('blond')) return t.hair === 'blonde' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('red hair') || lower.includes('ginger') || lower.includes('redhead')) return t.hair === 'red' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('brown hair')) return t.hair === 'brown' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('black hair')) return t.hair === 'black' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('white hair') || lower.includes('grey hair') || lower.includes('gray hair')) return t.hair === 'white' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('bald') || lower.includes('no hair')) return t.hair === 'bald' ? 'Yes ✅' : 'No ❌';

    if (lower.includes('american') || lower.includes('from america') || lower.includes('from the us') || lower.includes('from usa')) return t.american ? 'Yes ✅' : 'No ❌';
    if (lower.includes('singer') || lower.includes('sing') || lower.includes('music')) return t.singer ? 'Yes ✅' : 'No ❌';
    if (lower.includes('actor') || lower.includes('actress') || lower.includes('act') || lower.includes('movie') || lower.includes('film')) return t.actor ? 'Yes ✅' : 'No ❌';
    if (lower.includes('glasses') || lower.includes('wear glasses')) return t.glasses ? 'Yes ✅' : 'No ❌';
    if (lower.includes('over 40') || lower.includes('older') || lower.includes('old') || lower.includes('40')) return t.over40 ? 'Yes ✅' : 'No ❌';
    if (lower.includes('young') || lower.includes('under 40')) return !t.over40 ? 'Yes ✅' : 'No ❌';

    return "🤔 Try asking about: gender, hair color (blonde/brown/black/red/white/bald), American, singer, actor, glasses, or over 40.";
}

// --- BOARD RENDERING ---

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    celebrities.forEach((char, i) => {
        const card = document.createElement('div');
        card.className = 'char-card' + (eliminated.has(i) ? ' eliminated' : '');
        const traitList = [];
        if (char.traits.singer) traitList.push('🎤');
        if (char.traits.actor) traitList.push('🎬');
        if (char.traits.glasses) traitList.push('👓');
        if (char.traits.american) traitList.push('🇺🇸');
        if (char.traits.over40) traitList.push('40+');
        card.innerHTML = `
            <div class="avatar">${char.img}</div>
            <div class="name">${char.name}</div>
            <div class="traits">${char.traits.hair} hair | ${char.traits.gender} | ${traitList.join(' ')}</div>
        `;
        card.onclick = () => toggleEliminate(i);
        board.appendChild(card);
    });
}

function toggleEliminate(index) {
    if (gameOver) return;
    if (eliminated.has(index)) eliminated.delete(index);
    else eliminated.add(index);
    renderBoard();
}

function updateInfo() {
    document.getElementById('questions-count').textContent = `❓ Questions: ${questionsAsked}`;
}

// --- ASK QUESTION ---

function askQuestion() {
    if (gameOver) return;
    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    if (!question) return;

    if (mode === 'solo') {
        questionsAsked++;
        const answer = evaluateQuestion(question);
        addChatMsg('You: ' + question, 'question');
        addChatMsg('AI: ' + answer, 'answer');
        updateInfo();
    } else {
        if (!myTurn) {
            addChatMsg('⚠️ Wait for your turn!', 'answer');
            return;
        }
        socket.emit('gw-ask', { gameId, question });
        questionsAsked++;
        updateInfo();
    }
    input.value = '';
}

// --- MAKE GUESS ---

function makeGuess() {
    if (gameOver) return;
    if (mode === 'multiplayer' && !myTurn) {
        addChatMsg('⚠️ Wait for your turn!', 'answer');
        return;
    }

    const guess = prompt('Who do you think it is? Type the celebrity name:');
    if (!guess) return;

    if (mode === 'solo') {
        questionsAsked++;
        const normalizedGuess = guess.trim().toLowerCase();
        const normalizedAnswer = secretCharacter.name.toLowerCase();
        if (normalizedGuess === normalizedAnswer || normalizedAnswer.includes(normalizedGuess) || normalizedGuess.includes(normalizedAnswer)) {
            gameOver = true;
            showOverlay('🎉 Correct!', `It was ${secretCharacter.name} ${secretCharacter.img}! You got it in ${questionsAsked} questions.`);
        } else {
            addChatMsg('You guessed: ' + guess, 'question');
            addChatMsg('❌ Wrong! Keep trying!', 'answer');
            updateInfo();
        }
    } else {
        socket.emit('gw-guess', { gameId, guess: guess.trim() });
    }
}

function giveUp() {
    if (gameOver) return;
    gameOver = true;
    if (mode === 'solo') {
        showOverlay('😅 Gave Up', `The celebrity was ${secretCharacter.name} ${secretCharacter.img}.`);
    } else {
        socket.emit('gw-giveup', { gameId });
    }
}

// --- CHAT ---

function addChatMsg(text, type) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');
    div.className = 'msg ' + type;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

// --- OVERLAY ---

function showOverlay(title, msg) {
    document.getElementById('overlayTitle').textContent = title;
    document.getElementById('overlayMsg').textContent = msg;
    document.getElementById('overlay').classList.remove('hidden');
}

// --- MULTIPLAYER SOCKET EVENTS ---

socket.on('gw-pick', (data) => {
    showPickScreen(data.gameId);
    playerNum = data.playerNum;
    if (typeof showChatWidget === 'function') showChatWidget(true);
});

socket.on('gw-waiting-pick', () => {
    document.getElementById('turn-indicator').textContent = '⏳ Waiting for opponent to pick their celebrity...';
});

socket.on('gw-start', (data) => {
    gameId = data.gameId;
    playerNum = data.playerNum;
    mySecret = data.yourSecret;
    secretCharacter = data.opponentSecret;
    eliminated = new Set();
    questionsAsked = 0;
    gameOver = false;
    myTurn = data.yourTurn;

    document.getElementById('mode-select').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    document.querySelector('.question-panel').style.display = '';
    document.querySelector('.actions').style.display = '';
    document.getElementById('your-secret').style.display = 'block';
    document.getElementById('your-secret-name').textContent = `${mySecret.name} ${mySecret.img}`;
    document.getElementById('turn-indicator').textContent = myTurn ? "Your turn to ask!" : "Opponent's turn...";
    document.getElementById('chat-log').innerHTML = '';
    document.getElementById('questionInput').value = '';
    updateInfo();
    renderBoard();
});

socket.on('gw-question', (data) => {
    addChatMsg(`${data.from}: ${data.question}`, 'question');
    addChatMsg(`Answer: ${data.answer}`, 'answer');
    myTurn = data.yourTurn;
    document.getElementById('turn-indicator').textContent = myTurn ? "Your turn to ask!" : "Opponent's turn...";
});

socket.on('gw-win', (data) => {
    gameOver = true;
    showOverlay('🎉 You Win!', data.msg);
});

socket.on('gw-lose', (data) => {
    gameOver = true;
    showOverlay('😢 You Lose!', data.msg);
});

socket.on('gw-opponent-quit', () => {
    gameOver = true;
    showOverlay('🚪 Opponent Left', 'Your opponent disconnected. You win by default!');
});

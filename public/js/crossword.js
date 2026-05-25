const socket = io({ pingTimeout: 60000, pingInterval: 25000 });

const BOARD_SIZE = 15;
let gameId = null;
let playerId = null;
let playerNum = 0;
let selectedCell = null;
let gameMode = null; // 'solo' or 'multiplayer'
let aiDifficulty = null;

// Solo game state
let soloGame = null;

// Word list for AI (common short words)
const aiWordList = [
    'cat','dog','run','hat','sun','pen','map','red','big','top',
    'fan','bat','cup','net','box','fox','hop','dig','log','pot',
    'band','fish','lamp','tree','book','card','door','fire','gold','hand',
    'jump','king','lake','moon','nest','open','park','rain','sand','time',
    'word','zone','play','star','home','blue','dark','cold','warm','fast',
    'apple','brain','chair','dance','eagle','flame','grape','horse','ivory','juice',
    'knife','light','music','noble','ocean','plant','queen','river','stone','tower',
    'under','voice','water','youth','zebra','world','train','dream','cloud','earth',
    'place','space','frame','grain','heart','joint','kneel','learn','mount','night'
];

function selectMode(mode) {
    gameMode = mode;
    if (mode === 'solo') {
        document.getElementById('difficultySelect').classList.remove('hidden');
    } else {
        document.getElementById('difficultySelect').classList.add('hidden');
        document.getElementById('gameModePhase').classList.add('hidden');
        document.getElementById('waitingPhase').classList.remove('hidden');
        socket.emit('join-game-crossword');
    }
}

function startSolo(difficulty) {
    aiDifficulty = difficulty;
    soloGame = {
        board: Array(BOARD_SIZE * BOARD_SIZE).fill(''),
        cellOwners: Array(BOARD_SIZE * BOARD_SIZE).fill(0),
        currentTurn: 1,
        scores: [0, 0],
        isFirstMove: true,
        consecutiveSkips: 0,
        state: 'playing'
    };
    playerNum = 1;
    document.getElementById('gameModePhase').classList.add('hidden');
    document.getElementById('gamePhase').classList.remove('hidden');
    buildBoard();
    updateSoloUI();
}

function buildBoard() {
    const boardEl = document.getElementById('gameBoard');
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
    boardEl.style.display = 'grid';
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;
        cell.addEventListener('click', () => selectCellHandler(i));
        boardEl.appendChild(cell);
    }
}

function selectCellHandler(index) {
    selectedCell = index;
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.cell[data-index="${index}"]`).classList.add('selected');
    document.getElementById('hintText').textContent = `Starting at row ${Math.floor(index/BOARD_SIZE)+1}, col ${index%BOARD_SIZE+1}. Type your word and click Place.`;
}

function placeWord() {
    const word = document.getElementById('wordInput').value.trim().toLowerCase();
    const direction = document.getElementById('directionSelect').value;
    if (!word) return alert('Please type a word!');
    if (selectedCell === null) return alert('Please click a cell on the board first!');

    if (gameMode === 'solo') {
        placeSoloWord(word, selectedCell, direction, 1);
    } else {
        socket.emit('place-word-crossword', { gameId, word, startIndex: selectedCell, direction });
    }
    document.getElementById('wordInput').value = '';
}

function skipTurn() {
    if (gameMode === 'solo') {
        soloGame.consecutiveSkips++;
        soloGame.currentTurn = 2;
        updateSoloUI();
        if (soloGame.consecutiveSkips >= 2) {
            endSoloGame();
        } else {
            setTimeout(aiMove, 800);
        }
    } else {
        socket.emit('skip-turn-crossword', { gameId });
    }
}

function quitGame() {
    if (gameMode === 'multiplayer' && gameId) {
        socket.emit('quit-game-crossword', { gameId });
    }
    location.reload();
}

// --- Solo/AI Logic ---

function placeSoloWord(word, startIndex, direction, playerNumber) {
    const game = soloGame;
    const row = Math.floor(startIndex / BOARD_SIZE);
    const col = startIndex % BOARD_SIZE;

    // Validate fits
    for (let i = 0; i < word.length; i++) {
        const r = direction === 'vertical' ? row + i : row;
        const c = direction === 'horizontal' ? col + i : col;
        if (r >= BOARD_SIZE || c >= BOARD_SIZE) {
            if (playerNumber === 1) alert('Word goes off the board!');
            return false;
        }
        const idx = r * BOARD_SIZE + c;
        if (game.board[idx] && game.board[idx] !== word[i]) {
            if (playerNumber === 1) alert('Conflicts with existing letter on board!');
            return false;
        }
    }

    // Must connect (unless first move)
    if (!game.isFirstMove) {
        let connects = false;
        for (let i = 0; i < word.length; i++) {
            const r = direction === 'vertical' ? row + i : row;
            const c = direction === 'horizontal' ? col + i : col;
            const idx = r * BOARD_SIZE + c;
            if (game.board[idx] === word[i]) { connects = true; break; }
            const neighbors = [
                (r > 0) ? (r-1)*BOARD_SIZE+c : -1,
                (r < BOARD_SIZE-1) ? (r+1)*BOARD_SIZE+c : -1,
                (c > 0) ? r*BOARD_SIZE+(c-1) : -1,
                (c < BOARD_SIZE-1) ? r*BOARD_SIZE+(c+1) : -1
            ];
            for (const n of neighbors) {
                if (n >= 0 && game.board[n]) { connects = true; break; }
            }
            if (connects) break;
        }
        if (!connects) {
            if (playerNumber === 1) alert('Word must connect to existing letters!');
            return false;
        }
    }

    // Place
    let newLetters = 0;
    for (let i = 0; i < word.length; i++) {
        const r = direction === 'vertical' ? row + i : row;
        const c = direction === 'horizontal' ? col + i : col;
        const idx = r * BOARD_SIZE + c;
        if (!game.board[idx]) {
            game.board[idx] = word[i];
            game.cellOwners[idx] = playerNumber;
            newLetters++;
        }
    }

    game.scores[playerNumber - 1] += newLetters;
    game.isFirstMove = false;
    game.consecutiveSkips = 0;
    game.currentTurn = game.currentTurn === 1 ? 2 : 1;

    updateSoloUI();
    renderBoard(game.board, game.cellOwners);

    if (playerNumber === 1 && game.currentTurn === 2) {
        setTimeout(aiMove, 800);
    }
    return true;
}

function aiMove() {
    if (soloGame.state !== 'playing') return;
    const game = soloGame;

    // Try to find a valid word placement
    let attempts = aiDifficulty === 'easy' ? 50 : aiDifficulty === 'medium' ? 150 : 400;
    let wordPool = [...aiWordList];
    if (aiDifficulty === 'hard') {
        wordPool = wordPool.concat(['bridge','planet','castle','garden','silver','golden','forest','winter','summer','spring']);
    }

    for (let a = 0; a < attempts; a++) {
        const word = wordPool[Math.floor(Math.random() * wordPool.length)];
        const direction = Math.random() < 0.5 ? 'horizontal' : 'vertical';

        if (game.isFirstMove) {
            // Place in center area
            const startRow = 7;
            const startCol = Math.max(0, 7 - Math.floor(word.length / 2));
            const startIndex = startRow * BOARD_SIZE + startCol;
            const result = placeSoloWord(word, startIndex, 'horizontal', 2);
            if (result) return;
        } else {
            // Try to connect to existing letters
            for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
                if (game.board[i]) {
                    const letter = game.board[i];
                    const letterIdx = word.indexOf(letter);
                    if (letterIdx >= 0) {
                        const row = Math.floor(i / BOARD_SIZE);
                        const col = i % BOARD_SIZE;
                        let startRow, startCol;
                        if (direction === 'horizontal') {
                            startRow = row;
                            startCol = col - letterIdx;
                        } else {
                            startRow = row - letterIdx;
                            startCol = col;
                        }
                        if (startRow < 0 || startCol < 0) continue;
                        const startIndex = startRow * BOARD_SIZE + startCol;
                        const result = placeSoloWord(word, startIndex, direction, 2);
                        if (result) return;
                    }
                }
            }
        }
    }

    // AI can't find a move, skip
    game.consecutiveSkips++;
    game.currentTurn = 1;
    updateSoloUI();
    if (game.consecutiveSkips >= 2) {
        endSoloGame();
    }
}

function endSoloGame() {
    soloGame.state = 'finished';
    let msg;
    if (soloGame.scores[0] > soloGame.scores[1]) msg = '🎉 You win!';
    else if (soloGame.scores[1] > soloGame.scores[0]) msg = '🤖 AI wins!';
    else msg = "It's a draw!";
    document.getElementById('gameStatus').textContent = `Game Over! ${msg} (You: ${soloGame.scores[0]} pts, AI: ${soloGame.scores[1]} pts)`;
    document.getElementById('gameStatus').style.display = 'block';
}

function updateSoloUI() {
    document.getElementById('player1Info').textContent = `You: ${soloGame.scores[0]} pts`;
    document.getElementById('player2Info').textContent = `AI: ${soloGame.scores[1]} pts`;
    document.getElementById('turnInfo').textContent = soloGame.currentTurn === 1 ? 'Your turn!' : 'AI thinking...';
    renderBoard(soloGame.board, soloGame.cellOwners);
}

function renderBoard(board, cellOwners) {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, i) => {
        cell.textContent = board[i] ? board[i].toUpperCase() : '';
        cell.classList.remove('filled', 'filled-p1', 'filled-p2');
        if (board[i]) {
            cell.classList.add('filled');
            if (cellOwners[i] === 1) cell.classList.add('filled-p1');
            else if (cellOwners[i] === 2) cell.classList.add('filled-p2');
        }
    });
}

// --- Multiplayer Socket Events ---

socket.on('game-joined-crossword', (data) => {
    gameId = data.gameId;
    playerId = data.playerId;
});

socket.on('game-started-crossword', (data) => {
    const game = data.game;
    playerNum = game.players.findIndex(p => p.id === playerId) + 1;
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('gamePhase').classList.remove('hidden');
    buildBoard();
    updateMultiplayerUI(game);
});

socket.on('game-updated-crossword', (data) => {
    updateMultiplayerUI(data.game);
});

socket.on('game-over-crossword', (data) => {
    const game = data.game;
    updateMultiplayerUI(game);
    let msg;
    if (game.winner === playerNum) msg = '🎉 You win!';
    else if (game.winner === 0) msg = "It's a draw!";
    else msg = '😞 You lost!';
    document.getElementById('gameStatus').textContent = `Game Over! ${msg}`;
    document.getElementById('gameStatus').style.display = 'block';
});

socket.on('invalid-word-crossword', (data) => {
    alert(data.message);
});

function updateMultiplayerUI(game) {
    const isMyTurn = game.currentTurn === playerNum;
    document.getElementById('player1Info').textContent = `P1: ${game.scores[0]} pts${playerNum===1?' (You)':''}`;
    document.getElementById('player2Info').textContent = `P2: ${game.scores[1]} pts${playerNum===2?' (You)':''}`;
    document.getElementById('turnInfo').textContent = isMyTurn ? 'Your turn!' : "Opponent's turn...";
    renderBoard(game.board, game.cellOwners);
}



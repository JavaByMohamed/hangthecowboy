// Game Constants
const ROWS = 6;
const COLS = 7;
const WIN_LENGTH = 4;

// Game Variables
const socket = io();
let gameMode = null; // 'solo' or 'multiplayer'
let selectedColor = '';
let aiColor = '';
let gameId = null;
let playerId = null;
let gameState = null;
let currentPhase = 'mode-selection';
let soloCurrentTurn = 'red'; // red always goes first in solo
let soloGameOver = false;

// Board representation (0 = empty, 1 = red, 2 = yellow)
let localBoard = Array(ROWS * COLS).fill(0);

// ==================== MODE SELECTION ====================

function selectGameMode(mode) {
    gameMode = mode;
    document.getElementById('gameModePhase').classList.add('hidden');
    document.getElementById('colorSelectionPhase').classList.remove('hidden');
    if (mode === 'multiplayer') {
        updatePlayersWaiting();
    }
}

// ==================== SOCKET.IO (MULTIPLAYER) ====================

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('waiting-players', (count) => {
    updatePlayersWaiting();
});

socket.on('game-joined', (data) => {
    gameId = data.gameId;
    playerId = data.playerId;
    gameState = data.game;
    
    document.getElementById('colorSelectionPhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.remove('hidden');
    
    const emoji = selectedColor === 'red' ? '🔴' : '🟡';
    document.getElementById('waitingTitle').textContent = `${emoji} ${selectedColor.toUpperCase()} - Waiting for opponent...`;
    updatePlayersConnected();
});

socket.on('game-started', (data) => {
    gameState = data.game;
    showGamePhase();
});

socket.on('move-made', (data) => {
    gameState = data.game;
    localBoard = gameState.board;
    updateGameDisplay();
});

socket.on('game-ended', (data) => {
    gameState = data.game;
    localBoard = gameState.board;
    updateGameDisplay();
    showGameStatus();
});

socket.on('invalid-move', () => {
    alert('Invalid move! That column is full.');
});

function updatePlayersWaiting() {
    socket.emit('get-waiting-count-four', (count) => {
        document.getElementById('playersWaiting').textContent = 
            `Players waiting to join: ${count + 1}`;
    });
}

function updatePlayersConnected() {
    if (gameState && gameState.players) {
        document.getElementById('playersConnected').textContent = 
            `Players in game: ${gameState.players.length}/2`;
    }
}

// ==================== COLOR SELECTION ====================

function selectColor(color) {
    selectedColor = color;
    aiColor = color === 'red' ? 'yellow' : 'red';

    if (gameMode === 'multiplayer') {
        socket.emit('join-game-four', { color: selectedColor });
    } else {
        // Solo mode: start game immediately
        startSoloGame();
    }
}

// ==================== SOLO MODE ====================

function startSoloGame() {
    localBoard = Array(ROWS * COLS).fill(0);
    soloCurrentTurn = 'red'; // red always first
    soloGameOver = false;

    document.getElementById('colorSelectionPhase').classList.add('hidden');
    document.getElementById('gamePhase').classList.remove('hidden');

    createBoardUI();
    updateSoloDisplay();

    // If AI goes first
    if (aiColor === 'red') {
        setTimeout(aiMove, 500);
    }
}

function updateSoloDisplay() {
    // Update board
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const idx = row * COLS + col;
            const cell = document.getElementById(`cell-${row}-${col}`);
            cell.className = 'circle';
            if (localBoard[idx] === 1) cell.classList.add('red');
            else if (localBoard[idx] === 2) cell.classList.add('yellow');
        }
    }

    const player1Info = document.getElementById('player1Info');
    const player2Info = document.getElementById('player2Info');
    const turnInfo = document.getElementById('turnInfo');

    const playerEmoji = selectedColor === 'red' ? '🔴' : '🟡';
    const aiEmoji = aiColor === 'red' ? '🔴' : '🟡';

    player1Info.textContent = `${playerEmoji} You (${selectedColor.toUpperCase()})`;
    player2Info.textContent = `${aiEmoji} AI (${aiColor.toUpperCase()})`;

    player1Info.classList.remove('active');
    player2Info.classList.remove('active');

    if (soloCurrentTurn === selectedColor) {
        player1Info.classList.add('active');
        turnInfo.textContent = `${playerEmoji} Your Turn`;
    } else {
        player2Info.classList.add('active');
        turnInfo.textContent = `${aiEmoji} AI Thinking...`;
    }

    if (!soloGameOver) {
        document.getElementById('gameStatus').textContent = '🎮 Game in Progress';
        document.getElementById('gameStatus').className = 'game-status playing';
    }
}

function makeSoloMove(col) {
    if (soloGameOver || soloCurrentTurn !== selectedColor) return;

    const row = getLowestRow(localBoard, col);
    if (row === -1) return;

    const colorVal = soloCurrentTurn === 'red' ? 1 : 2;
    localBoard[row * COLS + col] = colorVal;

    if (checkWinnerLocal(localBoard, row, col, colorVal)) {
        soloGameOver = true;
        updateSoloDisplay();
        showSoloResult('win');
        return;
    }
    if (localBoard.every(c => c !== 0)) {
        soloGameOver = true;
        updateSoloDisplay();
        showSoloResult('draw');
        return;
    }

    soloCurrentTurn = soloCurrentTurn === 'red' ? 'yellow' : 'red';
    updateSoloDisplay();
    setTimeout(aiMove, 400);
}

function aiMove() {
    if (soloGameOver) return;

    const col = getBestMove(localBoard, aiColor);
    const row = getLowestRow(localBoard, col);
    if (row === -1) return;

    const colorVal = aiColor === 'red' ? 1 : 2;
    localBoard[row * COLS + col] = colorVal;

    if (checkWinnerLocal(localBoard, row, col, colorVal)) {
        soloGameOver = true;
        updateSoloDisplay();
        showSoloResult('lose');
        return;
    }
    if (localBoard.every(c => c !== 0)) {
        soloGameOver = true;
        updateSoloDisplay();
        showSoloResult('draw');
        return;
    }

    soloCurrentTurn = soloCurrentTurn === 'red' ? 'yellow' : 'red';
    updateSoloDisplay();
}

function showSoloResult(result) {
    const statusDiv = document.getElementById('gameStatus');
    if (result === 'win') {
        const emoji = selectedColor === 'red' ? '🔴' : '🟡';
        statusDiv.textContent = `🎉 You Won! ${emoji} Congratulations!`;
        statusDiv.className = 'game-status win';
    } else if (result === 'lose') {
        const emoji = aiColor === 'red' ? '🔴' : '🟡';
        statusDiv.textContent = `💀 AI Won! ${emoji} Better luck next time!`;
        statusDiv.className = 'game-status win';
    } else {
        statusDiv.textContent = `🤝 It's a Draw!`;
        statusDiv.className = 'game-status draw';
    }

    const board = document.getElementById('gameBoard');
    board.style.pointerEvents = 'none';
    board.style.opacity = '0.7';
    showPlayAgainButton();
}

// ==================== AI (Minimax with Alpha-Beta) ====================

function getLowestRow(board, col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r * COLS + col] === 0) return r;
    }
    return -1;
}

function checkWinnerLocal(board, lastRow, lastCol, player) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dRow, dCol] of directions) {
        let count = 1;
        let r = lastRow + dRow, c = lastCol + dCol;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === player) {
            count++; r += dRow; c += dCol;
        }
        r = lastRow - dRow; c = lastCol - dCol;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === player) {
            count++; r -= dRow; c -= dCol;
        }
        if (count >= WIN_LENGTH) return true;
    }
    return false;
}

function getBestMove(board, color) {
    const aiVal = color === 'red' ? 1 : 2;
    const humanVal = aiVal === 1 ? 2 : 1;
    const depth = 5;

    let bestScore = -Infinity;
    let bestCol = 3; // default to center

    // Try center columns first for better pruning
    const colOrder = [3, 2, 4, 1, 5, 0, 6];

    for (const col of colOrder) {
        const row = getLowestRow(board, col);
        if (row === -1) continue;

        const newBoard = [...board];
        newBoard[row * COLS + col] = aiVal;

        if (checkWinnerLocal(newBoard, row, col, aiVal)) return col; // instant win

        const score = minimaxFour(newBoard, depth - 1, -Infinity, Infinity, false, aiVal, humanVal);
        if (score > bestScore) {
            bestScore = score;
            bestCol = col;
        }
    }
    return bestCol;
}

function minimaxFour(board, depth, alpha, beta, maximizing, aiVal, humanVal) {
    // Check terminal
    if (depth === 0) return evaluateBoard(board, aiVal, humanVal);

    const colOrder = [3, 2, 4, 1, 5, 0, 6];

    if (maximizing) {
        let maxEval = -Infinity;
        for (const col of colOrder) {
            const row = getLowestRow(board, col);
            if (row === -1) continue;
            const newBoard = [...board];
            newBoard[row * COLS + col] = aiVal;
            if (checkWinnerLocal(newBoard, row, col, aiVal)) return 100000 + depth;
            const ev = minimaxFour(newBoard, depth - 1, alpha, beta, false, aiVal, humanVal);
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const col of colOrder) {
            const row = getLowestRow(board, col);
            if (row === -1) continue;
            const newBoard = [...board];
            newBoard[row * COLS + col] = humanVal;
            if (checkWinnerLocal(newBoard, row, col, humanVal)) return -100000 - depth;
            const ev = minimaxFour(newBoard, depth - 1, alpha, beta, true, aiVal, humanVal);
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function evaluateBoard(board, aiVal, humanVal) {
    let score = 0;
    // Evaluate all windows of 4
    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c <= COLS - 4; c++) {
            score += evaluateWindow(board, r, c, 0, 1, aiVal, humanVal);
        }
    }
    // Vertical
    for (let r = 0; r <= ROWS - 4; r++) {
        for (let c = 0; c < COLS; c++) {
            score += evaluateWindow(board, r, c, 1, 0, aiVal, humanVal);
        }
    }
    // Diagonal /
    for (let r = 0; r <= ROWS - 4; r++) {
        for (let c = 0; c <= COLS - 4; c++) {
            score += evaluateWindow(board, r, c, 1, 1, aiVal, humanVal);
        }
    }
    // Diagonal \
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c <= COLS - 4; c++) {
            score += evaluateWindow(board, r, c, -1, 1, aiVal, humanVal);
        }
    }
    // Center column preference
    for (let r = 0; r < ROWS; r++) {
        if (board[r * COLS + 3] === aiVal) score += 3;
    }
    return score;
}

function evaluateWindow(board, startR, startC, dR, dC, aiVal, humanVal) {
    let ai = 0, human = 0, empty = 0;
    for (let i = 0; i < 4; i++) {
        const val = board[(startR + i * dR) * COLS + (startC + i * dC)];
        if (val === aiVal) ai++;
        else if (val === humanVal) human++;
        else empty++;
    }
    if (ai === 4) return 1000;
    if (ai === 3 && empty === 1) return 50;
    if (ai === 2 && empty === 2) return 10;
    if (human === 3 && empty === 1) return -80;
    if (human === 2 && empty === 2) return -5;
    return 0;
}

// ==================== MULTIPLAYER GAME DISPLAY ====================

function showGamePhase() {
    currentPhase = 'game';
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('gamePhase').classList.remove('hidden');
    createBoardUI();
    updateGameDisplay();
}

function createBoardUI() {
    const board = document.getElementById('gameBoard');
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    board.style.pointerEvents = 'auto';
    board.style.opacity = '1';
    
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const circle = document.createElement('div');
            circle.className = 'circle';
            circle.id = `cell-${row}-${col}`;
            circle.onclick = () => makeMove(col);
            board.appendChild(circle);
        }
    }
}

function makeMove(col) {
    if (gameMode === 'solo') {
        makeSoloMove(col);
        return;
    }

    // Multiplayer
    const currentPlayerColor = gameState.currentTurn;
    if (selectedColor !== currentPlayerColor) {
        alert("It's not your turn!");
        return;
    }
    
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (localBoard[r * COLS + col] === 0) { row = r; break; }
    }
    if (row === -1) { alert('Column is full!'); return; }
    
    socket.emit('make-move-four', { gameId, column: col });
}

function updateGameDisplay() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const idx = row * COLS + col;
            const cell = document.getElementById(`cell-${row}-${col}`);
            cell.className = 'circle';
            if (localBoard[idx] === 1) cell.classList.add('red');
            else if (localBoard[idx] === 2) cell.classList.add('yellow');
        }
    }
    
    const player1Color = gameState.players[0]?.color || 'red';
    const player2Color = gameState.players[1]?.color || 'yellow';
    const player1Info = document.getElementById('player1Info');
    const player2Info = document.getElementById('player2Info');
    const turnInfo = document.getElementById('turnInfo');
    
    const emoji1 = player1Color === 'red' ? '🔴' : '🟡';
    const emoji2 = player2Color === 'red' ? '🔴' : '🟡';
    
    player1Info.textContent = `${emoji1} ${player1Color.toUpperCase()} Player`;
    player2Info.textContent = `${emoji2} ${player2Color.toUpperCase()} Player`;
    
    player1Info.classList.remove('active');
    player2Info.classList.remove('active');
    
    if (gameState.currentTurn === player1Color) {
        player1Info.classList.add('active');
        turnInfo.textContent = `${emoji1} Turn`;
    } else {
        player2Info.classList.add('active');
        turnInfo.textContent = `${emoji2} Turn`;
    }
    
    if (!gameState.gameEnded) {
        document.getElementById('gameStatus').textContent = '🎮 Game in Progress';
        document.getElementById('gameStatus').className = 'game-status playing';
    }
}

function showGameStatus() {
    const statusDiv = document.getElementById('gameStatus');
    
    if (gameState.winner) {
        const emoji = gameState.winner === 'red' ? '🔴' : '🟡';
        const isWinner = gameState.winner === selectedColor;
        statusDiv.textContent = isWinner
            ? `🎉 You Won! ${emoji} ${gameState.winner.toUpperCase()} gets 4 in a row!`
            : `💀 You Lost! ${emoji} ${gameState.winner.toUpperCase()} got 4 in a row!`;
        statusDiv.className = 'game-status win';
    } else if (gameState.isDraw) {
        statusDiv.textContent = `🤝 It's a Draw!`;
        statusDiv.className = 'game-status draw';
    }
    
    const board = document.getElementById('gameBoard');
    board.style.pointerEvents = 'none';
    board.style.opacity = '0.7';
    showPlayAgainButton();
}

function showPlayAgainButton() {
    const container = document.getElementById('gameButtons');
    const playAgainBtn = document.createElement('button');
    playAgainBtn.textContent = '🔄 Play Again';
    playAgainBtn.style.background = '#27ae60';
    playAgainBtn.style.marginRight = '10px';
    playAgainBtn.style.color = 'white';
    playAgainBtn.style.padding = '10px 15px';
    playAgainBtn.style.fontSize = '16px';
    playAgainBtn.style.border = 'none';
    playAgainBtn.style.borderRadius = '5px';
    playAgainBtn.style.cursor = 'pointer';
    playAgainBtn.onclick = playAgain;
    container.appendChild(playAgainBtn);
}

function playAgain() {
    if (gameMode === 'multiplayer' && gameId) {
        socket.emit('quit-game-four', { gameId });
    }
    gameId = null;
    playerId = null;
    gameState = null;
    selectedColor = '';
    localBoard = Array(ROWS * COLS).fill(0);
    soloGameOver = false;
    soloCurrentTurn = 'red';
    
    document.getElementById('gamePhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('colorSelectionPhase').classList.add('hidden');
    document.getElementById('gameModePhase').classList.remove('hidden');
    document.getElementById('gameButtons').innerHTML = '<button onclick="quitGame()" style="background: #e74c3c;">Quit Game</button>';
}

function quitGame() {
    if (gameMode === 'multiplayer' && gameId) {
        socket.emit('quit-game-four', { gameId });
    }
    window.location.href = '/';
}

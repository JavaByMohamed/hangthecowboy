// Variables
const socket = io({
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});

// Keep-alive: ping /health every 4 min to prevent hosting platform from sleeping
setInterval(() => fetch('/health').catch(() => {}), 4 * 60 * 1000);

// Reconnection overlay
(function() {
    const overlay = document.createElement('div');
    overlay.id = 'reconnect-overlay';
    overlay.innerHTML = '<div style="background:rgba(0,0,0,0.85);color:#fff;position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:99999;flex-direction:column;font-family:sans-serif"><div style="font-size:48px;margin-bottom:20px">⚡</div><div style="font-size:22px;margin-bottom:10px">Connection lost</div><div id="reconnect-status" style="font-size:16px;color:#aaa">Reconnecting...</div></div>';
    overlay.style.display = 'none';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
    socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        overlay.style.display = 'block';
        const status = document.getElementById('reconnect-status');
        if (status) status.textContent = 'Reconnecting...';
    });
    socket.io.on('reconnect_attempt', (attempt) => {
        const status = document.getElementById('reconnect-status');
        if (status) status.textContent = `Reconnecting... attempt ${attempt}`;
    });
    socket.io.on('reconnect_failed', () => {
        const status = document.getElementById('reconnect-status');
        if (status) status.textContent = 'Could not reconnect. Please refresh the page.';
    });
    socket.on('connect', () => {
        console.log('Connected:', socket.id, 'transport:', socket.io.engine.transport.name);
        overlay.style.display = 'none';
    });
})();

socket.on('connect_error', (err) => console.log('Connection error:', err.message));
let gameMode = ''; // 'solo' or 'multiplayer'
let playerSymbol = ''; // 'X' or 'O' for multiplayer, or 'X' (vs AI 'O') for solo
let gameId = null;
let playerId = null;
let gameState = null;
let currentPhase = 'mode-selection';
let gameEnded = false;

// Solo mode variables
let soloBoard = Array(9).fill('');
let soloCurrentPlayer = 'X'; // Player is always X, AI is O
let soloGameActive = true;
let soloClueShown = false;

// Timer variables
let turnTimer = null;
let turnTimeLeft = 30;

function startTurnTimer() {
    clearTurnTimer();
    turnTimeLeft = 30;
    updateTimerDisplay();
    turnTimer = setInterval(() => {
        turnTimeLeft--;
        updateTimerDisplay();
        if (turnTimeLeft <= 0) {
            clearTurnTimer();
            onTimerExpired();
        }
    }, 1000);
}

function clearTurnTimer() {
    if (turnTimer) { clearInterval(turnTimer); turnTimer = null; }
}

function updateTimerDisplay() {
    const el = document.getElementById('timerDisplay');
    if (el) {
        el.textContent = `⏱️ ${turnTimeLeft}s`;
        el.style.color = turnTimeLeft <= 10 ? '#e74c3c' : '#2c3e50';
    }
}

function onTimerExpired() {
    if (gameEnded) return;
    if (gameMode === 'solo') {
        // Skip player's turn - AI moves
        if (soloCurrentPlayer === 'X' && soloGameActive) {
            soloCurrentPlayer = 'O';
            updateGameDisplay();
            setTimeout(() => {
                makeAIMove();
                soloCurrentPlayer = 'X';
                updateGameDisplay();
                startTurnTimer();
            }, 500);
        }
    } else {
        // Multiplayer: skip turn
        if (gameState && gameState.currentPlayer === playerSymbol) {
            socket.emit('skip-turn-ttt', { gameId });
        }
    }
}

// Multiplayer socket events
socket.on('connect', () => {
    console.log('Connected to server');
    // Attempt rejoin if we were in a game
    if (gameId && gameMode === 'multiplayer') {
        socket.emit('rejoin-game', { gameId, gameType: 'ttt' });
    }
});

socket.on('game-rejoined', (data) => {
    gameId = data.gameId;
    playerId = data.playerId;
    gameState = data.game;
    console.log('Rejoined game:', gameId);
});

socket.on('rejoin-failed', () => {
    console.log('Rejoin failed — game no longer exists');
    gameId = null;
    gameState = null;
});

socket.on('opponent-temporarily-disconnected', () => {
    console.log('Opponent temporarily disconnected, waiting...');
});

socket.on('opponent-reconnected', () => {
    console.log('Opponent reconnected!');
});

socket.on('game-joined', (data) => {
    gameId = data.gameId;
    playerId = data.playerId;
    gameState = data.game;
    console.log('Joined game:', gameId);
    
    document.getElementById('symbolSelectionPhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.remove('hidden');
    
    const emoji = playerSymbol === 'X' ? '❌' : '⭕';
    document.getElementById('waitingTitle').textContent = `${emoji} You are ${playerSymbol} - Waiting for opponent...`;
    updatePlayersConnected();
});

socket.on('game-started', (data) => {
    gameState = data.game;
    showGamePhase();
    updateGameDisplay();
    startTurnTimer();
});

socket.on('move-made', (data) => {
    gameState = data.game;
    updateGameDisplay();
    if (!gameEnded) startTurnTimer();
});

socket.on('game-ended', (data) => {
    gameState = data.game;
    gameEnded = true;
    clearTurnTimer();
    updateGameDisplay();
    showPlayAgainButton();
});

socket.on('waiting-players', (count) => {
    updatePlayersWaiting();
});

socket.on('opponent-disconnected', () => {
    gameEnded = true;
    const statusEl = document.getElementById('statusDisplay');
    if (statusEl) statusEl.textContent = '⚠️ Opponent disconnected!';
});
function selectGameMode(mode) {
    gameMode = mode;
    document.getElementById('gameModePhase').classList.add('hidden');
    
    if (mode === 'solo') {
        // Start solo mode immediately
        startSoloGame();
    } else {
        // Show symbol selection for multiplayer
        document.getElementById('symbolSelectionPhase').classList.remove('hidden');
        updatePlayersWaiting();
    }
}

function selectSymbol(symbol) {
    playerSymbol = symbol;
    
    // Join multiplayer game
    socket.emit('join-game-ttt', { symbol: playerSymbol });
}

function startSoloGame() {
    currentPhase = 'game';
    gameEnded = false;
    soloBoard = Array(9).fill('');
    soloCurrentPlayer = 'X';
    soloGameActive = true;
    playerSymbol = 'X';
    
    // Create a dummy gameState for solo mode
    gameState = {
        board: soloBoard,
        currentPlayer: soloCurrentPlayer,
        gameEnded: false
    };
    
    document.getElementById('gameModePhase').classList.add('hidden');
    showGamePhase();
    updateGameDisplay();
    startTurnTimer();
}

function showGamePhase() {
    document.getElementById('symbolSelectionPhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('gamePhase').classList.remove('hidden');
}

function updatePlayersWaiting() {
    socket.emit('get-waiting-count-ttt', (count) => {
        document.getElementById('playersWaiting').textContent = `Players waiting to join: ${count + 1}`;
    });
}

function updatePlayersConnected() {
    if (gameState && gameState.players) {
        document.getElementById('playersConnected').textContent = `Players in game: ${gameState.players.length}/2`;
    }
}

function makeMove(index) {
    if (gameMode === 'solo') {
        // Solo mode move
        if (soloBoard[index] !== '' || !soloGameActive) {
            return;
        }
        
        soloBoard[index] = 'X';
        clearTurnTimer();
        
        // Check if player won
        if (checkWinner(soloBoard, 'X')) {
            soloGameActive = false;
            gameEnded = true;
            clearTurnTimer();
            updateGameDisplay();
            showPlayAgainButton();
            return;
        }
        
        // Check for draw
        if (soloBoard.every(cell => cell !== '')) {
            soloGameActive = false;
            gameEnded = true;
            clearTurnTimer();
            updateGameDisplay();
            showPlayAgainButton();
            return;
        }
        
        // AI's turn
        soloCurrentPlayer = 'O';
        updateGameDisplay();
        
        setTimeout(() => {
            makeAIMove();
            soloCurrentPlayer = 'X';
            updateGameDisplay();
            if (!gameEnded) startTurnTimer();
        }, 500);
    } else {
        // Multiplayer mode move
        if (gameState.board[index] !== '' || gameEnded) {
            return;
        }
        
        if (gameState.currentPlayer !== playerSymbol) {
            return; // Not your turn
        }
        
        socket.emit('make-move-ttt', { gameId, index });
    }
}

function makeAIMove() {
    // Simple AI - try to win, block opponent, or take center/corners
    let bestMove = -1;
    
    // 1. Try to win
    bestMove = findWinningMove(soloBoard, 'O');
    
    // 2. Block opponent
    if (bestMove === -1) {
        bestMove = findWinningMove(soloBoard, 'X');
    }
    
    // 3. Take center
    if (bestMove === -1 && soloBoard[4] === '') {
        bestMove = 4;
    }
    
    // 4. Take corners
    if (bestMove === -1) {
        const corners = [0, 2, 6, 8];
        const availableCorners = corners.filter(i => soloBoard[i] === '');
        if (availableCorners.length > 0) {
            bestMove = availableCorners[Math.floor(Math.random() * availableCorners.length)];
        }
    }
    
    // 5. Take any available space
    if (bestMove === -1) {
        const available = soloBoard.map((cell, i) => cell === '' ? i : -1).filter(i => i !== -1);
        bestMove = available[Math.floor(Math.random() * available.length)];
    }
    
    if (bestMove !== -1) {
        soloBoard[bestMove] = 'O';
        
        if (checkWinner(soloBoard, 'O')) {
            soloGameActive = false;
            gameEnded = true;
        } else if (soloBoard.every(cell => cell !== '')) {
            soloGameActive = false;
            gameEnded = true;
        }
    }
}

function findWinningMove(board, player) {
    // Check each empty cell to see if it would create a win
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = player;
            if (checkWinner(board, player)) {
                board[i] = '';
                return i;
            }
            board[i] = '';
        }
    }
    return -1;
}

function checkWinner(board, player) {
    // Winning combinations
    const winCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];
    
    return winCombinations.some(combination =>
        combination.every(index => board[index] === player)
    );
}

function updateGameDisplay() {
    // Get the current board state
    const currentBoard = gameMode === 'solo' ? soloBoard : gameState.board;
    const currentPlayer = gameMode === 'solo' ? soloCurrentPlayer : gameState.currentPlayer;
    
    // Update cells
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        const value = currentBoard[index];
        cell.textContent = value;
        cell.classList.remove('x', 'o');
        if (value === 'X') {
            cell.classList.add('x');
        } else if (value === 'O') {
            cell.classList.add('o');
        }
        
        // Disable cell if it's filled
        if (value !== '') {
            cell.classList.add('disabled');
        } else {
            cell.classList.remove('disabled');
        }
    });
    
    // Update turn indicator and player info
    const player1Info = document.getElementById('player1Info');
    const player2Info = document.getElementById('player2Info');
    const indicator = document.getElementById('turnIndicator');
    const statusDiv = document.getElementById('gameStatus');
    
    if (gameMode === 'solo') {
        player1Info.textContent = '❌ You (X)';
        player2Info.textContent = '🤖 AI (O)';
        
        if (gameEnded) {
            if (checkWinner(soloBoard, 'X')) {
                statusDiv.textContent = '🎉 You Won! The AI loses!';
                statusDiv.className = 'game-status win';
                indicator.textContent = 'Game Over';
            } else if (checkWinner(soloBoard, 'O')) {
                statusDiv.textContent = '💀 AI Won! Better luck next time!';
                statusDiv.className = 'game-status lose';
                indicator.textContent = 'Game Over';
            } else {
                statusDiv.textContent = "🤝 It's a Draw!";
                statusDiv.className = 'game-status draw';
                indicator.textContent = 'Game Over';
            }
            indicator.className = 'turn-indicator';
            player1Info.classList.remove('active');
            player2Info.classList.remove('active');
        } else {
            statusDiv.textContent = soloCurrentPlayer === 'X' ? '🎮 Your Turn!' : '🤖 AI is thinking...';
            statusDiv.className = 'game-status playing';
            indicator.textContent = soloCurrentPlayer === 'X' ? "Your Turn" : "AI's Turn";
            indicator.className = 'turn-indicator' + (soloCurrentPlayer === 'O' ? ' opponent-turn' : '');
            if (soloCurrentPlayer === 'X') {
                player1Info.classList.add('active');
                player2Info.classList.remove('active');
            } else {
                player1Info.classList.remove('active');
                player2Info.classList.add('active');
            }
        }
    } else {
        // Multiplayer mode
        const opponent = gameState.players.find(p => p.id !== playerId);
        const opponentSymbol = opponent && opponent.symbol ? opponent.symbol : (playerSymbol === 'X' ? 'O' : 'X');
        
        player1Info.textContent = `❌ You (${playerSymbol})`;
        player2Info.textContent = `⭕ Opponent (${opponentSymbol})`;
        
        if (gameEnded) {
            if (checkWinner(gameState.board, playerSymbol)) {
                statusDiv.textContent = '🎉 You Won!';
                statusDiv.className = 'game-status win';
            } else if (checkWinner(gameState.board, opponentSymbol)) {
                statusDiv.textContent = '💀 You Lost!';
                statusDiv.className = 'game-status lose';
            } else {
                statusDiv.textContent = "🤝 It's a Draw!";
                statusDiv.className = 'game-status draw';
            }
            indicator.textContent = 'Game Over';
            indicator.className = 'turn-indicator';
            player1Info.classList.remove('active');
            player2Info.classList.remove('active');
        } else {
            const isYourTurn = currentPlayer === playerSymbol;
            if (isYourTurn) {
                statusDiv.textContent = '🎮 Your Turn!';
                statusDiv.className = 'game-status playing';
                indicator.textContent = 'Your Turn';
                indicator.className = 'turn-indicator';
                player1Info.classList.add('active');
                player2Info.classList.remove('active');
            } else {
                statusDiv.textContent = "⏳ Opponent's Turn";
                statusDiv.className = 'game-status playing';
                indicator.textContent = "Opponent's Turn";
                indicator.className = 'turn-indicator opponent-turn';
                player1Info.classList.remove('active');
                player2Info.classList.add('active');
            }
        }
    }
}

function playAgain() {
    if (gameMode === 'solo') {
        startSoloGame();
    } else {
        // For multiplayer, need to create a new game session or reload
        location.reload();
    }
}

function quitGame() {
    if (gameMode === 'multiplayer' && gameId) {
        socket.emit('quit-game-ttt', { gameId });
    }
    location.href = '/';
}

function showPlayAgainButton() {
    document.getElementById('playAgainBtn').style.display = 'inline-block';
}

// Set up cell click handlers
document.addEventListener('DOMContentLoaded', () => {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.addEventListener('click', () => {
            const index = parseInt(cell.dataset.index);
            makeMove(index);
        });
    });
});


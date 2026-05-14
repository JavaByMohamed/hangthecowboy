// Variables
const socket = io();
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

// Multiplayer socket events
socket.on('connect', () => {
    console.log('Connected to server');
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
});

socket.on('move-made', (data) => {
    gameState = data.game;
    updateGameDisplay();
});

socket.on('game-ended', (data) => {
    gameState = data.game;
    gameEnded = true;
    updateGameDisplay();
    showPlayAgainButton();
});

socket.on('waiting-players', (count) => {
    updatePlayersWaiting();
});

// Functions
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
        
        // Check if player won
        if (checkWinner(soloBoard, 'X')) {
            soloGameActive = false;
            gameEnded = true;
            updateGameDisplay();
            showPlayAgainButton();
            return;
        }
        
        // Check for draw
        if (soloBoard.every(cell => cell !== '')) {
            soloGameActive = false;
            gameEnded = true;
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
    
    // Update player info
    const player1Info = document.getElementById('player1Info');
    const player2Info = document.getElementById('player2Info');
    const turnInfo = document.getElementById('turnInfo');
    const statusDiv = document.getElementById('gameStatus');
    
    if (gameMode === 'solo') {
        player1Info.textContent = '❌ You (X)';
        player2Info.textContent = '🤖 AI (O)';
        
        if (gameEnded) {
            // Determine winner
            if (checkWinner(soloBoard, 'X')) {
                statusDiv.textContent = '🎉 You Won! The AI loses!';
                statusDiv.className = 'game-status win';
                turnInfo.textContent = 'Game Over';
            } else if (checkWinner(soloBoard, 'O')) {
                statusDiv.textContent = '💀 AI Won! Better luck next time!';
                statusDiv.className = 'game-status lose';
                turnInfo.textContent = 'Game Over';
            } else {
                statusDiv.textContent = "🤝 It's a Draw!";
                statusDiv.className = 'game-status draw';
                turnInfo.textContent = 'Game Over';
            }
        } else {
            statusDiv.textContent = soloCurrentPlayer === 'X' ? '🎮 Your Turn!' : '🤖 AI is thinking...';
            statusDiv.className = 'game-status playing';
            turnInfo.textContent = soloCurrentPlayer === 'X' ? 'Your Turn' : "AI's Turn";
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
                turnInfo.textContent = 'Game Over';
            } else if (checkWinner(gameState.board, opponentSymbol)) {
                statusDiv.textContent = '💀 You Lost!';
                statusDiv.className = 'game-status lose';
                turnInfo.textContent = 'Game Over';
            } else {
                statusDiv.textContent = "🤝 It's a Draw!";
                statusDiv.className = 'game-status draw';
                turnInfo.textContent = 'Game Over';
            }
        } else {
            const isYourTurn = currentPlayer === playerSymbol;
            if (isYourTurn) {
                statusDiv.textContent = '🎮 Your Turn!';
                statusDiv.className = 'game-status playing';
                turnInfo.textContent = 'Your Turn';
                player1Info.classList.add('active');
                player2Info.classList.remove('active');
            } else {
                statusDiv.textContent = "⏳ Opponent's Turn";
                statusDiv.className = 'game-status playing';
                turnInfo.textContent = "Opponent's Turn";
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


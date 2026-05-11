// Game Constants
const ROWS = 6;
const COLS = 7;
const WIN_LENGTH = 4;

// Game Variables
const socket = io();
let gameMode = 'multiplayer';
let selectedColor = '';
let gameId = null;
let playerId = null;
let gameState = null;
let currentPhase = 'color-selection';

// Board representation (0 = empty, 1 = red, 2 = yellow)
let localBoard = Array(ROWS * COLS).fill(0);

// Socket.IO event listeners
socket.on('connect', () => {
    console.log('Connected to server');
    updatePlayersWaiting();
});

socket.on('waiting-players', (count) => {
    updatePlayersWaiting();
});

socket.on('game-joined', (data) => {
    gameId = data.gameId;
    playerId = data.playerId;
    gameState = data.game;
    console.log('Joined game:', gameId);
    
    document.getElementById('colorSelectionPhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.remove('hidden');
    
    const emoji = selectedColor === 'red' ? '🔴' : '🟡';
    document.getElementById('waitingTitle').textContent = `${emoji} ${selectedColor.toUpperCase()} - Waiting for opponent...`;
    updatePlayersConnected();
});

socket.on('game-started', (data) => {
    gameState = data.game;
    console.log('Game started:', gameState);
    showGamePhase();
});

socket.on('move-made', (data) => {
    gameState = data.game;
    localBoard = gameState.board;
    updateGameDisplay();
    
    // Check if game has ended
    if (gameState.gameEnded) {
        showGameStatus();
    }
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

// Update player counts
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

// Color selection
function selectColor(color) {
    selectedColor = color;
    socket.emit('join-game-four', { color: selectedColor });
}

// Show game phase
function showGamePhase() {
    currentPhase = 'game';
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('gamePhase').classList.remove('hidden');
    
    // Initialize board UI
    createBoardUI();
    updateGameDisplay();
}

// Create board UI
function createBoardUI() {
    const board = document.getElementById('gameBoard');
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    
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

// Make a move
function makeMove(col) {
    // Check if it's the player's turn
    const currentPlayerColor = gameState.currentTurn;
    if (selectedColor !== currentPlayerColor) {
        alert("It's not your turn!");
        return;
    }
    
    // Find the lowest empty row in the column
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
        const idx = r * COLS + col;
        if (localBoard[idx] === 0) {
            row = r;
            break;
        }
    }
    
    if (row === -1) {
        alert('Column is full!');
        return;
    }
    
    // Send move to server
    socket.emit('make-move-four', { gameId, column: col });
}

// Update game display
function updateGameDisplay() {
    // Update board UI
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const idx = row * COLS + col;
            const cell = document.getElementById(`cell-${row}-${col}`);
            const value = localBoard[idx];
            
            cell.className = 'circle';
            if (value === 1) {
                cell.classList.add('red');
            } else if (value === 2) {
                cell.classList.add('yellow');
            }
        }
    }
    
    // Update player info
    const player1Color = gameState.players[0]?.color || 'red';
    const player2Color = gameState.players[1]?.color || 'yellow';
    
    const player1Info = document.getElementById('player1Info');
    const player2Info = document.getElementById('player2Info');
    const turnInfo = document.getElementById('turnInfo');
    
    const emoji1 = player1Color === 'red' ? '🔴' : '🟡';
    const emoji2 = player2Color === 'red' ? '🔴' : '🟡';
    
    player1Info.textContent = `${emoji1} ${player1Color.toUpperCase()} Player`;
    player2Info.textContent = `${emoji2} ${player2Color.toUpperCase()} Player`;
    
    // Highlight active player
    player1Info.classList.remove('active');
    player2Info.classList.remove('active');
    
    if (gameState.currentTurn === player1Color) {
        player1Info.classList.add('active');
        turnInfo.textContent = `${emoji1} Turn`;
    } else {
        player2Info.classList.add('active');
        turnInfo.textContent = `${emoji2} Turn`;
    }
    
    // Update game status
    if (!gameState.gameEnded) {
        const statusDiv = document.getElementById('gameStatus');
        statusDiv.textContent = '🎮 Game in Progress - Make your move!';
        statusDiv.className = 'game-status playing';
    }
}

// Show game status
function showGameStatus() {
    const statusDiv = document.getElementById('gameStatus');
    
    if (gameState.winner) {
        const emoji = gameState.winner === 'red' ? '🔴' : '🟡';
        const isWinner = gameState.winner === selectedColor;
        
        if (isWinner) {
            statusDiv.textContent = `🎉 You Won! ${emoji} ${gameState.winner.toUpperCase()} player gets 4 in a row!`;
        } else {
            statusDiv.textContent = `💀 You Lost! ${emoji} ${gameState.winner.toUpperCase()} player got 4 in a row!`;
        }
        statusDiv.className = 'game-status win';
    } else if (gameState.isDraw) {
        statusDiv.textContent = `🤝 It's a Draw! The board is full!`;
        statusDiv.className = 'game-status draw';
    }
    
    // Disable board
    const board = document.getElementById('gameBoard');
    board.style.pointerEvents = 'none';
    board.style.opacity = '0.7';
    
    // Show play again button
    showPlayAgainButton();
}

// Show play again button
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

// Play again - restart the game
function playAgain() {
    if (gameMode === 'multiplayer' && gameId) {
        socket.emit('quit-game-four', { gameId });
    }
    // Reset game variables
    gameId = null;
    playerId = null;
    gameState = null;
    selectedColor = '';
    localBoard = Array(ROWS * COLS).fill(0);
    
    // Reset UI
    document.getElementById('gamePhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('colorSelectionPhase').classList.remove('hidden');
    document.getElementById('gameButtons').innerHTML = '<button onclick="quitGame()" style="background: #e74c3c;">Quit Game</button>';
    
    // Update player count
    updatePlayersWaiting();
}

// Quit game - redirect to homepage
function quitGame() {
    if (gameMode === 'multiplayer' && gameId) {
        socket.emit('quit-game-four', { gameId });
    }
    window.location.href = '/';
}


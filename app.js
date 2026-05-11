const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const englishWords = require('an-array-of-english-words');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files (CSS, JS)
app.use(session({
    secret: 'hangman-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Game manager for multiplayer sessions
const games = {};
let gameCounter = 0;

function createGameSession() {
    gameCounter++;
    const gameId = `game-${gameCounter}`;
    games[gameId] = {
        id: gameId,
        players: [],
        state: 'waiting', // waiting, word-setup, playing, finished
        word: '',
        wordTeam: null, // which team created the word
        guessedLetters: [],
        wrongGuesses: [],
        maxLives: 6
    };
    return gameId;
}

// Four in a Row game manager
const fourInARowGames = {};
let fourInARowGameCounter = 0;

function createFourInARowSession() {
    fourInARowGameCounter++;
    const gameId = `four-${fourInARowGameCounter}`;
    fourInARowGames[gameId] = {
        id: gameId,
        players: [],
        state: 'waiting', // waiting, playing, finished
        board: Array(6 * 7).fill(0), // 6x7 board (42 circles)
        currentTurn: null,
        winner: null,
        isDraw: false,
        gameEnded: false
    };
    return gameId;
}

const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'ips.txt');

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '');
}

// Middleware to get real IP (important for deployment platforms)
app.set('trust proxy', true);

// Function to normalize IPv6-mapped IPv4 addresses
function normalizeIP(ip) {
    // Extract IPv4 from IPv6-mapped format (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
    if (ip.includes('::ffff:')) {
        return ip.replace('::ffff:', '');
    }
    return ip;
}

app.get('/', (req, res) => {
    const ip = normalizeIP(req.ip);
    // Get current time in Sweden timezone (Europe/Stockholm)
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', { 
        timeZone: 'Europe/Stockholm',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const logEntry = `${timestamp} - ${ip}\n`;

    const logFilePath = path.join(__dirname, 'logs', 'ips.txt');

    // Append IP to file
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
            return res.status(500).send('Error logging IP');
        }

        console.log('Logged:', logEntry.trim());
    });

    res.send('Anyone there 👋 Your visit has been recorded, thanks for your visit!');
});

app.get('/logs', (req, res) => {
    const logFilePath = path.join(__dirname, 'logs', 'ips.txt');

    fs.readFile(logFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Could not read logs.');
        }

        const entries = data.trim().split('\n').filter(Boolean).reverse();

        const rows = entries.map(entry => {
            const [timestamp, ip] = entry.split(' - ');
            return `<tr><td>${timestamp}</td><td>${ip}</td></tr>`;
        }).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Visitor Logs</title>
                <style>
                    body { font-family: sans-serif; padding: 30px; }
                    h1 { margin-bottom: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 10px 16px; text-align: left; }
                    th { background: #f4f4f4; }
                    tr:nth-child(even) { background: #fafafa; }
                </style>
            </head>
            <body>
                <h1>Visitor Logs</h1>
                <p>${entries.length} visit(s) recorded</p>
                <table>
                    <thead><tr><th>Timestamp</th><th>IP Address</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </body>
            </html>
        `);
    });
});

// API endpoint for word library
app.get('/api/word-library', (req, res) => {
    const words = englishWords
        .filter(word => word.length >= 5 && word.length <= 12)
        .map(word => word.toUpperCase());
    res.json({ words });
});

app.get('/games', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Game Menu</title>
            <style>
                body { 
                    font-family: sans-serif; 
                    padding: 30px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    margin: 0;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                    text-align: center;
                }
                h1 {
                    color: #667eea;
                    margin-bottom: 40px;
                }
                .games-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin: 30px 0;
                }
                .game-card {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: transform 0.3s;
                    text-decoration: none;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .game-card:hover {
                    transform: scale(1.05);
                }
                .game-card h2 {
                    margin: 10px 0;
                    font-size: 24px;
                }
                .game-card p {
                    margin: 10px 0;
                    font-size: 14px;
                    opacity: 0.9;
                }
                .emoji {
                    font-size: 48px;
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎮 Game Menu</h1>
                <p style="font-size: 18px; color: #666; margin-bottom: 40px;">Choose a game to play:</p>
                
                <div class="games-grid">
                    <a href="/hangman" class="game-card">
                        <div class="emoji">🎯</div>
                        <h2>Hangman</h2>
                        <p>Solo or Multiplayer<br>Guess the word!</p>
                    </a>
                    
                    <a href="/four-in-a-row" class="game-card">
                        <div class="emoji">🔴</div>
                        <h2>Four in a Row</h2>
                        <p>Two Player<br>Connect 4 pieces!</p>
                    </a>
                </div>

                <hr style="margin: 40px 0; border: none; border-top: 1px solid #ddd;">
                <p style="color: #999; font-size: 14px;">
                    <a href="/" style="color: #667eea; text-decoration: none;">← Back to Home</a>
                </p>
            </div>
        </body>
        </html>
    `);
});

app.get('/hangman', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'hangman.html'));
});

app.get('/four-in-a-row', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'four-in-a-row.html'));
});

// OLD HTML ROUTE REMOVED - Now serving from views/hangman.html

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('get-waiting-count', (callback) => {
        const waitingGames = Object.values(games).filter(g => g.state === 'waiting');
        callback(waitingGames.length);
    });

    socket.on('join-game', (data) => {
        const team = data.team;
        let gameId = null;
        
        // Find a game waiting for a player
        for (const gId in games) {
            const game = games[gId];
            if (game.state === 'waiting' && game.players.length === 1) {
                const firstTeam = game.players[0].team;
                if (firstTeam !== team) {
                    gameId = gId;
                    break;
                }
            }
        }

        // If no game found, create a new one
        if (!gameId) {
            gameId = createGameSession();
        }

        const game = games[gameId];
        game.players.push({ id: socket.id, team });
        socket.join(gameId);

        socket.emit('game-joined', { gameId, playerId: socket.id, game });
        io.to(gameId).emit('waiting-players', game.players.length);

        // If both players have joined, start the game
        if (game.players.length === 2) {
            game.state = 'word-setup';
            game.wordTeam = 'creator'; // The 'creator' role always sets the word
            io.to(gameId).emit('game-started', { game });
        }
    });

    socket.on('submit-word', (data) => {
        const gameId = data.gameId;
        const word = data.word.toUpperCase();
        const game = games[gameId];

        if (game) {
            game.word = word;
            game.state = 'playing';
            io.to(gameId).emit('word-submitted', { game });
        }
    });

    socket.on('guess-letter', (data) => {
        const gameId = data.gameId;
        const letter = data.letter;
        const game = games[gameId];

        if (game && !game.guessedLetters.includes(letter) && !game.wrongGuesses.includes(letter)) {
            if (game.word.includes(letter)) {
                game.guessedLetters.push(letter);
            } else {
                game.wrongGuesses.push(letter);
            }

            io.to(gameId).emit('letter-guessed', { game });

            // Check if game is over
            const wordGuessed = game.word.split('').every(l => game.guessedLetters.includes(l));
            const outOfLives = game.wrongGuesses.length >= game.maxLives;

            if (wordGuessed || outOfLives) {
                game.state = 'finished';
                io.to(gameId).emit('game-ended', { game });
            }
        }
    });

    socket.on('quit-game', (data) => {
        const gameId = data.gameId;
        const game = games[gameId];

        if (game) {
            delete games[gameId];
        }
    });

    // Four in a Row handlers
    socket.on('get-waiting-count-four', (callback) => {
        const waitingGames = Object.values(fourInARowGames).filter(g => g.state === 'waiting' && g.players.length === 1);
        callback(waitingGames.length);
    });

    socket.on('join-game-four', (data) => {
        const color = data.color;
        let gameId = null;
        
        // Find a game waiting for a player
        for (const gId in fourInARowGames) {
            const game = fourInARowGames[gId];
            if (game.state === 'waiting' && game.players.length === 1) {
                const firstColor = game.players[0].color;
                if (firstColor !== color) {
                    gameId = gId;
                    break;
                }
            }
        }

        // If no game found, create a new one
        if (!gameId) {
            gameId = createFourInARowSession();
        }

        const game = fourInARowGames[gameId];
        game.players.push({ id: socket.id, color });
        socket.join(gameId);

        socket.emit('game-joined', { gameId, playerId: socket.id, game });
        io.to(gameId).emit('waiting-players', game.players.length);

        // If both players have joined, start the game
        if (game.players.length === 2) {
            game.state = 'playing';
            game.currentTurn = game.players[0].color; // Red goes first
            io.to(gameId).emit('game-started', { game });
        }
    });

    socket.on('make-move-four', (data) => {
        const gameId = data.gameId;
        const column = data.column;
        const game = fourInARowGames[gameId];

        if (!game || game.gameEnded) return;

        // Find the lowest empty row in the column
        let row = -1;
        for (let r = 5; r >= 0; r--) {
            const idx = r * 7 + column;
            if (game.board[idx] === 0) {
                row = r;
                break;
            }
        }

        if (row === -1) {
            // Column is full
            socket.emit('invalid-move');
            return;
        }

        // Place the piece
        const colorValue = game.currentTurn === 'red' ? 1 : 2;
        const idx = row * 7 + column;
        game.board[idx] = colorValue;

        // Check for winner
        const winner = checkWinner(game.board, row, column, colorValue);
        
        if (winner) {
            game.winner = game.currentTurn;
            game.gameEnded = true;
            io.to(gameId).emit('game-ended', { game });
        } else {
            // Check for draw
            if (game.board.every(cell => cell !== 0)) {
                game.isDraw = true;
                game.gameEnded = true;
                io.to(gameId).emit('game-ended', { game });
            } else {
                // Switch turn
                game.currentTurn = game.currentTurn === 'red' ? 'yellow' : 'red';
                io.to(gameId).emit('move-made', { game });
            }
        }
    });

    socket.on('quit-game-four', (data) => {
        const gameId = data.gameId;
        if (fourInARowGames[gameId]) {
            delete fourInARowGames[gameId];
        }
    });

    function checkWinner(board, lastRow, lastCol, player) {
        const ROWS = 6;
        const COLS = 7;
        const WIN_LENGTH = 4;

        // Directions: horizontal, vertical, diagonal right, diagonal left
        const directions = [
            [0, 1],   // horizontal
            [1, 0],   // vertical
            [1, 1],   // diagonal right
            [1, -1]   // diagonal left
        ];

        for (const [dRow, dCol] of directions) {
            let count = 1;

            // Check forward
            let r = lastRow + dRow;
            let c = lastCol + dCol;
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === player) {
                count++;
                r += dRow;
                c += dCol;
            }

            // Check backward
            r = lastRow - dRow;
            c = lastCol - dCol;
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === player) {
                count++;
                r -= dRow;
                c -= dCol;
            }

            if (count >= WIN_LENGTH) {
                return true;
            }
        }

        return false;
    }

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Clean up hangman games
        for (const gameId in games) {
            const game = games[gameId];
            game.players = game.players.filter(p => p.id !== socket.id);
            
            if (game.players.length === 0) {
                delete games[gameId];
            } else {
                io.to(gameId).emit('waiting-players', game.players.length);
            }
        }

        // Clean up four in a row games
        for (const gameId in fourInARowGames) {
            const game = fourInARowGames[gameId];
            game.players = game.players.filter(p => p.id !== socket.id);
            
            if (game.players.length === 0) {
                delete fourInARowGames[gameId];
            } else {
                io.to(gameId).emit('waiting-players', game.players.length);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});

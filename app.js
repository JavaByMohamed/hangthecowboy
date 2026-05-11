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

app.get('/hangman', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'hangman.html'));
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

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Clean up games
        for (const gameId in games) {
            const game = games[gameId];
            game.players = game.players.filter(p => p.id !== socket.id);
            
            if (game.players.length === 0) {
                delete games[gameId];
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

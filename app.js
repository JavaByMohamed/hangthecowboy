const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const englishWords = require('an-array-of-english-words');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    pingTimeout: 60000,      // 60 seconds before considering disconnected
    pingInterval: 25000,     // ping every 25 seconds to keep connection alive
    transports: ['websocket', 'polling'],
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 5000;
const apkOutputDir = path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk');
const apkReleaseDir = path.join(apkOutputDir, 'release');

function findLatestApkFile(baseDir) {
    if (!fs.existsSync(baseDir)) {
        return null;
    }

    let latestApk = null;
    const stack = [baseDir];

    while (stack.length > 0) {
        const currentDir = stack.pop();
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }

            if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.apk')) {
                continue;
            }

            const fileStats = fs.statSync(fullPath);
            if (!latestApk || fileStats.mtimeMs > latestApk.mtimeMs) {
                latestApk = {
                    path: fullPath,
                    fileName: entry.name,
                    mtimeMs: fileStats.mtimeMs
                };
            }
        }
    }

    return latestApk;
}

function getLatestReleaseApkMetadata() {
    const latestApk = findLatestApkFile(apkReleaseDir);
    if (!latestApk) {
        return null;
    }

    const fileStats = fs.statSync(latestApk.path);
    return {
        fileName: latestApk.fileName,
        sizeBytes: fileStats.size,
        updatedAt: new Date(fileStats.mtimeMs).toISOString()
    };
}

function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }

    const rounded = unitIndex === 0 ? value : value.toFixed(1);
    return `${rounded} ${units[unitIndex]}`;
}

function formatLatestApkStatus(metadata) {
    if (!metadata) {
        return 'Latest release APK: not available yet. Build the Android release APK first.';
    }

    const updatedAt = new Date(metadata.updatedAt).toLocaleString('en-US', {
        timeZone: 'Europe/Stockholm',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    return `Latest release APK: ${metadata.fileName} (${formatBytes(metadata.sizeBytes)}) updated ${updatedAt}`;
}

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public', { maxAge: 0, etag: false })); // Serve static files (CSS, JS) - no caching
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

// Draughts game manager
const draughtsGames = {};
let draughtsGameCounter = 0;

function createDraughtsSession() {
    draughtsGameCounter++;
    const gameId = `dr-${draughtsGameCounter}`;
    const board = [];
    for (let r = 0; r < 10; r++) {
        board[r] = [];
        for (let c = 0; c < 10; c++) {
            if ((r + c) % 2 === 1) {
                if (r < 4) board[r][c] = 'b';
                else if (r > 5) board[r][c] = 'w';
                else board[r][c] = '';
            } else {
                board[r][c] = '';
            }
        }
    }
    draughtsGames[gameId] = {
        id: gameId,
        players: [],
        state: 'waiting',
        board: board,
        currentTurn: 'white',
        winner: null,
        gameEnded: false
    };
    return gameId;
}

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

// Tic Tac Toe game manager
const ticTacToeGames = {};
let ticTacToeGameCounter = 0;

function createTicTacToeSession() {
    ticTacToeGameCounter++;
    const gameId = `ttt-${ticTacToeGameCounter}`;
    ticTacToeGames[gameId] = {
        id: gameId,
        players: [],
        state: 'waiting', // waiting, playing, finished
        board: Array(9).fill(''), // 3x3 board
        currentPlayer: 'X',
        winner: null,
        isDraw: false,
        gameEnded: false
    };
    return gameId;
}

// Crossword Puzzle game manager
const crosswordGames = {};
let crosswordGameCounter = 0;

// Chess game manager
const chessGames = {};
let chessGameCounter = 0;

// Guess Who game manager
const guessWhoGames = {};
let guessWhoGameCounter = 0;

const guessWhoCelebrities = [
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

function createChessSession() {
    chessGameCounter++;
    const gameId = `chess-${chessGameCounter}`;
    const board = [];
    const back = ['r','n','b','q','k','b','n','r'];
    for (let r = 0; r < 8; r++) {
        board[r] = [];
        for (let c = 0; c < 8; c++) {
            if (r === 0) board[r][c] = back[c];
            else if (r === 1) board[r][c] = 'p';
            else if (r === 6) board[r][c] = 'P';
            else if (r === 7) board[r][c] = back[c].toUpperCase();
            else board[r][c] = '';
        }
    }
    chessGames[gameId] = {
        id: gameId,
        players: [],
        state: 'waiting',
        board,
        currentTurn: 'white',
        castlingRights: { K: true, Q: true, k: true, q: true },
        enPassantTarget: null,
        lastMove: null,
        capturedWhite: [],
        capturedBlack: [],
        halfMoveClock: 0,
        positionHistory: [],
        gameOver: false,
        winner: null
    };
    return gameId;
}
const CROSSWORD_SIZE = 15;
const MAX_SKIPS = 2; // game ends after both players skip consecutively

function createCrosswordSession() {
    crosswordGameCounter++;
    const gameId = `cw-${crosswordGameCounter}`;
    crosswordGames[gameId] = {
        id: gameId,
        players: [],
        state: 'waiting',
        board: Array(CROSSWORD_SIZE * CROSSWORD_SIZE).fill(''),
        cellOwners: Array(CROSSWORD_SIZE * CROSSWORD_SIZE).fill(0),
        currentTurn: 1, // player 1 goes first
        scores: [0, 0],
        isFirstMove: true,
        consecutiveSkips: 0,
        winner: null
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
        } else {
            console.log('Logged:', logEntry.trim());
        }
    });

    const latestApkMetadata = getLatestReleaseApkMetadata();
    const latestApkStatus = formatLatestApkStatus(latestApkMetadata);

    // Serve the games menu page
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Game Menu</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 40px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .container {
                    max-width: 1000px;
                    width: 100%;
                    background: white;
                    padding: 50px;
                    border-radius: 15px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    text-align: center;
                }
                
                h1 {
                    color: #667eea;
                    margin-bottom: 15px;
                    font-size: 42px;
                    font-weight: bold;
                }
                
                .subtitle {
                    color: #888;
                    font-size: 18px;
                    margin-bottom: 50px;
                }
                
                .games-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 30px;
                    margin: 40px 0;
                }
                
                .game-card {
                    background: white;
                    border-radius: 15px;
                    overflow: hidden;
                    cursor: pointer;
                    text-decoration: none;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                
                .game-card:hover {
                    transform: scale(1.12) translateY(-10px);
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
                }
                
                .game-card-image {
                    width: 100%;
                    height: 200px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }
                
                .game-card:nth-child(1) .game-card-image {
                    background-image: url('/images/hangman.png');
                    background-position: center;
                    background-size: cover;
                    background-repeat: no-repeat;
                    height: 348px;
                }
                
                .game-card:nth-child(2) .game-card-image {
                    background-image: url('/images/fourinarow.png');
                    background-position: center;
                    background-size: cover;
                    background-repeat: no-repeat;
                    height: 348px;
                }
                                
                .game-card:nth-child(3) .game-card-image {
                    background-image: url('/images/tictactoe.png');
                    background-position: center;
                    background-size: cover;
                    background-repeat: no-repeat;
                    height: 435px;
                }             
                
                .game-card:nth-child(4) .game-card-image {
                    background-image: url('/images/draughts.png');
                    background-position: center;
                    background-size: cover;
                    background-repeat: no-repeat;
                    height: 435px;
                }
                             
                .game-card:nth-child(5) .game-card-image {
                    background-image: url('/images/crossword.png');
                    background-position: center;
                    background-size: cover;
                    background-repeat: no-repeat;
                    height: 435px;
                }
                             
                .game-card:nth-child(6) .game-card-image {
                    background-image: url('/images/sudoku.png');
                    background-position: center;
                    background-size: cover;
                    background-repeat: no-repeat;
                    height: 435px;
                }
                
                .game-card:nth-child(7) .game-card-image {
                    background-image: url('/images/chess.png');
                    background-position: center;
                    background-size: cover;
                    background-repeat: no-repeat;
                    height: 435px;
                }
                
                .game-card:nth-child(8) .game-card-image {
                    background-image: url('/images/guesswho.png');
                    background-position: center;
                    background-size: cover;
                    background-repeat: no-repeat;
                    height: 435px;
                }
                
                .game-card:nth-child(1) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(2) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(3) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(4) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(5) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(6) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(7) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(8) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card-icon {
                    font-size: 100px;
                    z-index: 1;
                }
                
                .game-card-content {
                    padding: 30px 20px;
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                .game-card h2 {
                    color: #333;
                    margin: 15px 0 10px;
                    font-size: 28px;
                    font-weight: bold;
                }
                
                .game-card p {
                    color: #333;
                    font-size: 15px;
                    line-height: 1.6;
                    margin: 5px 0;
                }
                
                .game-card .game-type {
                    display: inline-block;
                    background: #f0f0f0;
                    color: #667eea;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-top: 10px;
                }
                
                .game-card:nth-child(1) .game-type {
                    background: #f8efe1;
                    color: #f39c12;
                }
                
                .game-card:nth-child(2) .game-type {
                    background: #e3f2fd;
                    color: #3498db;
                }
                
                .game-card:nth-child(3) .game-type {
                    background: #f3e5f5;
                    color: #7b1fa2;
                }
                
                .footer {
                    margin-top: 50px;
                    padding-top: 30px;
                    border-top: 1px solid #eee;
                }

                .apk-download {
                    margin-top: 10px;
                    margin-bottom: 20px;
                }

                .apk-status {
                    margin-top: 10px;
                    color: #666;
                    font-size: 14px;
                }

                .apk-download-button {
                    display: inline-block;
                    background: #667eea;
                    color: #fff;
                    text-decoration: none;
                    padding: 12px 22px;
                    border-radius: 999px;
                    font-weight: 600;
                    transition: background 0.2s ease;
                }

                .apk-download-button:hover {
                    background: #5a6fd6;
                }

                .back-link {
                    color: #667eea;
                    text-decoration: none;
                    font-size: 16px;
                    transition: color 0.3s;
                }
                
                .back-link:hover {
                    color: #764ba2;
                }
                
                @media (max-width: 600px) {
                    .container {
                        padding: 30px 20px;
                    }
                    
                    h1 {
                        font-size: 32px;
                    }
                    
                    .game-card-icon {
                        font-size: 70px;
                    }
                    
                    .games-grid {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎮 Game Menu 🎮</h1>
                <p class="subtitle">Choose a game to play:</p>
                
                <div class="games-grid">
                    <!-- Hangman Card -->
                    <a href="/hangman" class="game-card">
                        <div class="game-card-image">
                        </div>
                        <div class="game-card-content">
                            <h2>Hangman</h2>
                            <p>Guess the word before you run out of lives!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🎯 Solo or Multiplayer</span>
                            </div>
                        </div>
                    </a>
                    
                    <!-- Four in a Row Card -->
                    <a href="/four-in-a-row" class="game-card">
                        <div class="game-card-image">
                        </div>
                        <div class="game-card-content">
                            <h2>Four in a Row</h2>
                            <p>Connect 4 of your pieces to win!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🤖 Solo or Multiplayer</span>
                            </div>
                        </div>
                    </a>
                  
                    <!-- Tic Tac Toe Card -->
                    <a href="/tic-tac-toe" class="game-card">
                        <div class="game-card-image">
                        </div>
                        <div class="game-card-content">
                            <h2>Tic Tac Toe</h2>
                            <p>Connect 3 of your pieces to win!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🤖 Solo or Multiplayer</span>
                            </div>
                        </div>
                    </a>

                    <!-- Draughts Card -->
                    <a href="/draughts" class="game-card">
                        <div class="game-card-image">
                        </div>
                        <div class="game-card-content">
                            <h2>Draughts</h2>
                            <p>Classic checkers — capture all opponent pieces!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🤖 Solo or Multiplayer</span>
                            </div>
                        </div>
                    </a>

                    <!-- Crossword Puzzle Card -->
                    <a href="/crossword" class="game-card">
                        <div class="game-card-image">
                        </div>
                        <div class="game-card-content">
                            <h2>Crossword Puzzle</h2>
                            <p>Build words together by connecting letters on the board!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🤖 Solo or Multiplayer</span>
                            </div>
                        </div>
                    </a>

                    <!-- Sudoku Card -->
                    <a href="/sudoku" class="game-card">
                        <div class="game-card-image">
                        </div>
                        <div class="game-card-content">
                            <h2>Sudoku</h2>
                            <p>Fill the 9×9 grid so every row, column and box has 1–9!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🧩 Solo</span>
                            </div>
                        </div>
                    </a>

                    <!-- Chess Card -->
                    <a href="/chess" class="game-card">
                        <div class="game-card-image">
                        </div>
                        <div class="game-card-content">
                            <h2>Chess</h2>
                            <p>The classic strategy game — checkmate your opponent!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🤖 Solo or Multiplayer</span>
                            </div>
                        </div>
                    </a>
                    
                    <!-- Guess Who Card -->
                    <a href="/guess-who" class="game-card">
                        <div class="game-card-image">
                        </div>
                        <div class="game-card-content">
                            <h2>Guess Who?</h2>
                            <p>Ask questions and figure out the secret celebrity!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🎯 Solo & 👥 Multiplayer</span>
                            </div>
                        </div>
                    </a>
                </div>

                <div class="apk-download">
                    <a href="/download/latest-apk" class="apk-download-button">Download Latest Release APK</a>
                    <p class="apk-status">${latestApkStatus}</p>
                </div>

                <div class="footer">
                    <p style="color: #999; font-size: 14px;">
                        Made with ❤️ for gaming
                    </p>
                </div>
            </div>
        </body>
        </html>
    `);
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
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

app.get('/api/latest-apk', (req, res) => {
    try {
        const latestApkMetadata = getLatestReleaseApkMetadata();
        if (!latestApkMetadata) {
            return res.status(404).json({ available: false });
        }

        return res.json({
            available: true,
            ...latestApkMetadata,
            sizeLabel: formatBytes(latestApkMetadata.sizeBytes)
        });
    } catch (error) {
        console.error('Error while fetching latest APK metadata:', error);
        return res.status(500).json({ available: false, error: 'Unable to read APK metadata.' });
    }
});

app.get('/download/latest-apk', (req, res) => {
    try {
        const latestApk = findLatestApkFile(apkReleaseDir);

        if (!latestApk) {
            return res.status(404).send('No release APK file found. Build the Android release APK first.');
        }

        return res.download(latestApk.path, latestApk.fileName);
    } catch (error) {
        console.error('Error while trying to download latest APK:', error);
        return res.status(500).send('Unable to download APK right now. Please try again.');
    }
});

// API endpoint for word library
app.get('/api/word-library', (req, res) => {
    const words = englishWords
        .filter(word => word.length >= 5 && word.length <= 12)
        .map(word => word.toUpperCase());
    res.json({ words });
});

app.get('/games', (req, res) => {
    const latestApkMetadata = getLatestReleaseApkMetadata();
    const latestApkStatus = formatLatestApkStatus(latestApkMetadata);

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Game Menu</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 40px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .container {
                    max-width: 1000px;
                    width: 100%;
                    background: white;
                    padding: 50px;
                    border-radius: 15px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    text-align: center;
                }
                
                h1 {
                    color: #667eea;
                    margin-bottom: 15px;
                    font-size: 42px;
                    font-weight: bold;
                }
                
                .subtitle {
                    color: #888;
                    font-size: 18px;
                    margin-bottom: 50px;
                }
                
                .games-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 30px;
                    margin: 40px 0;
                }
                
                .game-card {
                    background: white;
                    border-radius: 15px;
                    overflow: hidden;
                    cursor: pointer;
                    text-decoration: none;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                
                .game-card:hover {
                    transform: scale(1.12) translateY(-10px);
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
                }
                
                .game-card-image {
                    width: 100%;
                    height: 200px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }
                
                .game-card:nth-child(1) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(2) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(3) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(4) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(5) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(6) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card:nth-child(7) .game-card-content {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4));
                }
                
                .game-card-icon {
                    font-size: 100px;
                    z-index: 1;
                }
                
                .game-card-content {
                    padding: 30px 20px;
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                .game-card h2 {
                    color: #333;
                    margin: 15px 0 10px;
                    font-size: 28px;
                    font-weight: bold;
                }
                
                .game-card p {
                    color: #666;
                    font-size: 15px;
                    line-height: 1.6;
                    margin: 5px 0;
                }
                
                .game-card .game-type {
                    display: inline-block;
                    background: #f0f0f0;
                    color: #667eea;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-top: 10px;
                }
                
                .game-card:nth-child(1) .game-type {
                    background: #fff3e0;
                    color: #f39c12;
                }
                
                .game-card:nth-child(2) .game-type {
                    background: #e3f2fd;
                    color: #3498db;
                }
                
                .game-card:nth-child(3) .game-type {
                    background: #e3f2fd;
                    color: #3498db;
                }
                
                .footer {
                    margin-top: 50px;
                    padding-top: 30px;
                    border-top: 1px solid #eee;
                }

                .apk-download {
                    margin-top: 10px;
                    margin-bottom: 20px;
                }

                .apk-status {
                    margin-top: 10px;
                    color: #666;
                    font-size: 14px;
                }

                .apk-download-button {
                    display: inline-block;
                    background: #667eea;
                    color: #fff;
                    text-decoration: none;
                    padding: 12px 22px;
                    border-radius: 999px;
                    font-weight: 600;
                    transition: background 0.2s ease;
                }

                .apk-download-button:hover {
                    background: #5a6fd6;
                }
                
                .back-link {
                    color: #667eea;
                    text-decoration: none;
                    font-size: 16px;
                    transition: color 0.3s;
                }
                
                .back-link:hover {
                    color: #764ba2;
                }
                
                @media (max-width: 600px) {
                    .container {
                        padding: 30px 20px;
                    }
                    
                    h1 {
                        font-size: 32px;
                    }
                    
                    .game-card-icon {
                        font-size: 70px;
                    }
                    
                    .games-grid {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎮 Game Menu 🎮</h1>
                <p class="subtitle">Choose a game to play:</p>
                
                <div class="games-grid">
                    <!-- Hangman Card -->
                    <a href="/hangman" class="game-card">
                        <div class="game-card-image">
                        </div>
                        <div class="game-card-content">
                            <h2>Hangman</h2>
                            <p>Guess the word before you run out of lives!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🎯 Solo or Multiplayer</span>
                            </div>
                        </div>
                    </a>
                    
                    <!-- Four in a Row Card -->
                    <a href="/four-in-a-row" class="game-card">
                        <div class="game-card-image">
                            <div class="game-card-icon">🔴</div>
                        </div>
                        <div class="game-card-content">
                            <h2>Four in a Row</h2>
                            <p>Connect 4 of your pieces to win!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">👥 Two Player</span>
                            </div>
                        </div>
                    </a>

                    <!-- Guess Who Card -->
                    <a href="/guess-who" class="game-card">
                        <div class="game-card-image">
                            <div class="game-card-icon">🕵️</div>
                        </div>
                        <div class="game-card-content">
                            <h2>Guess Who?</h2>
                            <p>Ask questions and figure out the secret celebrity!</p>
                            <div style="margin-top: auto;">
                                <span class="game-type">🎯 Solo & 👥 Multiplayer</span>
                            </div>
                        </div>
                    </a>
                </div>

                <div class="apk-download">
                    <a href="/download/latest-apk" class="apk-download-button">Download Latest Release APK</a>
                    <p class="apk-status">${latestApkStatus}</p>
                </div>

                <div class="footer">
                    <p style="color: #999; font-size: 14px;">
                        <a href="/" class="back-link">← Back to Home</a>
                    </p>
                </div>
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

app.get('/tic-tac-toe', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'tic-tac-toe.html'));
});

app.get('/draughts', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'draughts.html'));
});

app.get('/crossword', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'crossword.html'));
});

app.get('/sudoku', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'sudoku.html'));
});

app.get('/chess', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'chess.html'));
});

app.get('/guess-who', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(__dirname, 'views', 'guess-who.html'));
});

// Health check endpoint — prevents hosting platforms from sleeping
app.get('/health', (req, res) => {
    res.status(200).send('ok');
});

// OLD HTML ROUTE REMOVED - Now serving from views/hangman.html

// Catch silent crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

// Socket.IO event handlers
// Guess Who question evaluator
function gwEvaluateQuestion(q, t) {
    const lower = q.toLowerCase();
    if (lower.includes('male') || lower.includes(' man') || lower.includes(' guy') || lower.includes(' he') || lower.includes('boy')) return t.gender === 'male' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('female') || lower.includes('woman') || lower.includes(' she') || lower.includes('girl') || lower.includes('lady')) return t.gender === 'female' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('blonde') || lower.includes('blond')) return t.hair === 'blonde' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('red hair') || lower.includes('ginger') || lower.includes('redhead')) return t.hair === 'red' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('brown hair')) return t.hair === 'brown' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('black hair')) return t.hair === 'black' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('white hair') || lower.includes('grey hair') || lower.includes('gray hair')) return t.hair === 'white' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('bald') || lower.includes('no hair')) return t.hair === 'bald' ? 'Yes ✅' : 'No ❌';
    if (lower.includes('american') || lower.includes('from america') || lower.includes('from the us')) return t.american ? 'Yes ✅' : 'No ❌';
    if (lower.includes('singer') || lower.includes('sing') || lower.includes('music')) return t.singer ? 'Yes ✅' : 'No ❌';
    if (lower.includes('actor') || lower.includes('actress') || lower.includes('act') || lower.includes('movie') || lower.includes('film')) return t.actor ? 'Yes ✅' : 'No ❌';
    if (lower.includes('glasses')) return t.glasses ? 'Yes ✅' : 'No ❌';
    if (lower.includes('over 40') || lower.includes('older') || lower.includes('old') || lower.includes('40')) return t.over40 ? 'Yes ✅' : 'No ❌';
    if (lower.includes('young') || lower.includes('under 40')) return !t.over40 ? 'Yes ✅' : 'No ❌';
    return "🤔 Try asking about: gender, hair color, American, singer, actor, glasses, or over 40.";
}

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

    socket.on('skip-turn-four', (data) => {
        const gameId = data.gameId;
        const game = fourInARowGames[gameId];
        if (!game || game.gameEnded) return;

        // Verify it's this player's turn
        const player = game.players.find(p => p.id === socket.id);
        if (!player || player.color !== game.currentTurn) return;

        // Switch turn
        game.currentTurn = game.currentTurn === 'red' ? 'yellow' : 'red';
        io.to(gameId).emit('move-made', { game });
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

    // Draughts handlers
    socket.on('join-game-draughts', (data) => {
        const color = data.color; // 'white' or 'black'
        let gameId = null;

        for (const gId in draughtsGames) {
            const game = draughtsGames[gId];
            if (game.state === 'waiting' && game.players.length === 1) {
                const firstColor = game.players[0].color;
                if (firstColor !== color) {
                    gameId = gId;
                    break;
                }
            }
        }

        if (!gameId) {
            gameId = createDraughtsSession();
        }

        const game = draughtsGames[gameId];
        game.players.push({ id: socket.id, color });
        socket.join(gameId);

        socket.emit('draughts-joined', { gameId, playerId: socket.id, color, game });

        if (game.players.length === 2) {
            game.state = 'playing';
            io.to(gameId).emit('draughts-started', { game });
        }
    });

    socket.on('draughts-move', (data) => {
        const gameId = data.gameId;
        const game = draughtsGames[gameId];
        if (!game || game.gameEnded) return;

        // Verify it's this player's turn
        const player = game.players.find(p => p.id === socket.id);
        if (!player || player.color !== game.currentTurn) return;

        // Apply the move (trust client-side validation for now, board state sent from client)
        game.board = data.board;
        game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';

        if (data.gameOver) {
            game.gameEnded = true;
            game.winner = data.winner;
            io.to(gameId).emit('draughts-game-ended', { game, winner: data.winner });
        } else {
            io.to(gameId).emit('draughts-move-made', { game });
        }
    });

    socket.on('quit-game-draughts', (data) => {
        const gameId = data.gameId;
        if (draughtsGames[gameId]) {
            socket.to(gameId).emit('draughts-opponent-quit');
            socket.leave(gameId);
            delete draughtsGames[gameId];
        }
    });

    socket.on('draughts-skip-turn', (data) => {
        const gameId = data.gameId;
        const game = draughtsGames[gameId];
        if (!game || game.gameEnded) return;

        // Verify it's this player's turn
        const player = game.players.find(p => p.id === socket.id);
        if (!player || player.color !== game.currentTurn) return;

        // Switch turn
        game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';
        io.to(gameId).emit('draughts-move-made', { game });
    });

    // Tic Tac Toe handlers
    socket.on('get-waiting-count-ttt', (callback) => {
        const waitingGames = Object.values(ticTacToeGames).filter(g => g.state === 'waiting' && g.players.length === 1);
        callback(waitingGames.length);
    });

    socket.on('join-game-ttt', (data) => {
        const symbol = data.symbol;
        let gameId = null;
        
        // Find a game waiting for a player
        for (const gId in ticTacToeGames) {
            const game = ticTacToeGames[gId];
            if (game.state === 'waiting' && game.players.length === 1) {
                const firstSymbol = game.players[0].symbol;
                if (firstSymbol !== symbol) {
                    gameId = gId;
                    break;
                }
            }
        }

        // If no game found, create a new one
        if (!gameId) {
            gameId = createTicTacToeSession();
        }

        const game = ticTacToeGames[gameId];
        game.players.push({ id: socket.id, symbol });
        socket.join(gameId);

        socket.emit('game-joined', { gameId, playerId: socket.id, game });
        io.to(gameId).emit('waiting-players', game.players.length);

        // If both players have joined, start the game
        if (game.players.length === 2) {
            game.state = 'playing';
            game.currentPlayer = 'X'; // X always goes first
            io.to(gameId).emit('game-started', { game });
        }
    });

    socket.on('make-move-ttt', (data) => {
        const gameId = data.gameId;
        const index = data.index;
        const game = ticTacToeGames[gameId];

        if (!game || game.gameEnded || game.board[index] !== '') return;

        // Place the move
        game.board[index] = game.currentPlayer;

        // Check for winner
        if (checkTicTacToeWinner(game.board, game.currentPlayer)) {
            game.winner = game.currentPlayer;
            game.gameEnded = true;
            io.to(gameId).emit('game-ended', { game });
        } else if (game.board.every(cell => cell !== '')) {
            // Check for draw
            game.isDraw = true;
            game.gameEnded = true;
            io.to(gameId).emit('game-ended', { game });
        } else {
            // Switch player
            game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
            io.to(gameId).emit('move-made', { game });
        }
    });

    function checkTicTacToeWinner(board, player) {
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

    socket.on('quit-game-ttt', (data) => {
        const gameId = data.gameId;
        if (ticTacToeGames[gameId]) {
            delete ticTacToeGames[gameId];
        }
    });

    socket.on('skip-turn-ttt', (data) => {
        const gameId = data.gameId;
        const game = ticTacToeGames[gameId];
        if (!game || game.gameEnded) return;

        // Verify it's this player's turn
        const player = game.players.find(p => p.id === socket.id);
        if (!player || player.symbol !== game.currentPlayer) return;

        // Switch player
        game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
        io.to(gameId).emit('move-made', { game });
    });

    // Crossword Puzzle handlers
    socket.on('join-game-crossword', () => {
        let gameId = null;
        for (const gId in crosswordGames) {
            const game = crosswordGames[gId];
            if (game.state === 'waiting' && game.players.length === 1) {
                gameId = gId;
                break;
            }
        }
        if (!gameId) {
            gameId = createCrosswordSession();
        }
        const game = crosswordGames[gameId];
        game.players.push({ id: socket.id });
        socket.join(gameId);
        socket.emit('game-joined-crossword', { gameId, playerId: socket.id });

        if (game.players.length === 2) {
            game.state = 'playing';
            io.to(gameId).emit('game-started-crossword', { game });
        }
    });

    socket.on('place-word-crossword', (data) => {
        const { gameId, word, startIndex, direction } = data;
        const game = crosswordGames[gameId];
        if (!game || game.state !== 'playing') return;

        const pIdx = game.players.findIndex(p => p.id === socket.id);
        const playerNum = pIdx + 1;
        if (game.currentTurn !== playerNum) return;

        const row = Math.floor(startIndex / CROSSWORD_SIZE);
        const col = startIndex % CROSSWORD_SIZE;

        // Validate placement fits on board
        for (let i = 0; i < word.length; i++) {
            const r = direction === 'vertical' ? row + i : row;
            const c = direction === 'horizontal' ? col + i : col;
            if (r >= CROSSWORD_SIZE || c >= CROSSWORD_SIZE) {
                socket.emit('invalid-word-crossword', { message: 'Word goes off the board!' });
                return;
            }
            const idx = r * CROSSWORD_SIZE + c;
            // If cell is occupied, must match the letter
            if (game.board[idx] && game.board[idx] !== word[i]) {
                socket.emit('invalid-word-crossword', { message: 'Conflicts with existing letter on board!' });
                return;
            }
        }

        // Must connect to existing letters (unless first move)
        if (!game.isFirstMove) {
            let connects = false;
            for (let i = 0; i < word.length; i++) {
                const r = direction === 'vertical' ? row + i : row;
                const c = direction === 'horizontal' ? col + i : col;
                const idx = r * CROSSWORD_SIZE + c;
                if (game.board[idx] === word[i]) {
                    connects = true;
                    break;
                }
                // Check adjacent cells
                const neighbors = [
                    (r > 0) ? (r-1)*CROSSWORD_SIZE+c : -1,
                    (r < CROSSWORD_SIZE-1) ? (r+1)*CROSSWORD_SIZE+c : -1,
                    (c > 0) ? r*CROSSWORD_SIZE+(c-1) : -1,
                    (c < CROSSWORD_SIZE-1) ? r*CROSSWORD_SIZE+(c+1) : -1
                ];
                for (const n of neighbors) {
                    if (n >= 0 && game.board[n]) {
                        connects = true;
                        break;
                    }
                }
                if (connects) break;
            }
            if (!connects) {
                socket.emit('invalid-word-crossword', { message: 'Word must connect to existing letters on the board!' });
                return;
            }
        }

        // Validate it's a real English word
        if (!englishWords.includes(word.toLowerCase())) {
            socket.emit('invalid-word-crossword', { message: `"${word}" is not a valid English word!` });
            return;
        }

        // Place the word
        let newLetters = 0;
        for (let i = 0; i < word.length; i++) {
            const r = direction === 'vertical' ? row + i : row;
            const c = direction === 'horizontal' ? col + i : col;
            const idx = r * CROSSWORD_SIZE + c;
            if (!game.board[idx]) {
                game.board[idx] = word[i];
                game.cellOwners[idx] = playerNum;
                newLetters++;
            }
        }

        // Score: 1 point per new letter placed
        game.scores[pIdx] += newLetters;
        game.isFirstMove = false;
        game.consecutiveSkips = 0;

        // Switch turn
        game.currentTurn = game.currentTurn === 1 ? 2 : 1;
        io.to(gameId).emit('game-updated-crossword', { game });
    });

    socket.on('skip-turn-crossword', (data) => {
        const { gameId } = data;
        const game = crosswordGames[gameId];
        if (!game || game.state !== 'playing') return;

        const pIdx = game.players.findIndex(p => p.id === socket.id);
        const playerNum = pIdx + 1;
        if (game.currentTurn !== playerNum) return;

        game.consecutiveSkips++;
        game.currentTurn = game.currentTurn === 1 ? 2 : 1;

        if (game.consecutiveSkips >= 2) {
            // Both players skipped - game over
            game.state = 'finished';
            if (game.scores[0] > game.scores[1]) game.winner = 1;
            else if (game.scores[1] > game.scores[0]) game.winner = 2;
            else game.winner = 0; // draw
            io.to(gameId).emit('game-over-crossword', { game });
        } else {
            io.to(gameId).emit('game-updated-crossword', { game });
        }
    });

    socket.on('quit-game-crossword', (data) => {
        const gameId = data.gameId;
        if (crosswordGames[gameId]) {
            delete crosswordGames[gameId];
        }
    });

    // Chess handlers
    socket.on('join-game-chess', (data) => {
        const color = data.color;
        let gameId = null;
        for (const gId in chessGames) {
            const game = chessGames[gId];
            if (game.state === 'waiting' && game.players.length === 1 && game.players[0].color !== color) {
                gameId = gId;
                break;
            }
        }
        if (!gameId) gameId = createChessSession();
        const game = chessGames[gameId];
        game.players.push({ id: socket.id, color });
        socket.join(gameId);
        socket.emit('chess-joined', { gameId, playerId: socket.id, color, game });
        if (game.players.length === 2) {
            game.state = 'playing';
            io.to(gameId).emit('chess-started', { game });
        }
    });

    socket.on('chess-move', (data) => {
        const gameId = data.gameId;
        const game = chessGames[gameId];
        if (!game || game.gameOver) return;
        game.board = data.board;
        game.currentTurn = data.turn;
        game.castlingRights = data.castlingRights;
        game.enPassantTarget = data.enPassantTarget;
        game.lastMove = data.lastMove;
        game.capturedWhite = data.capturedWhite;
        game.capturedBlack = data.capturedBlack;
        game.halfMoveClock = data.halfMoveClock;
        game.positionHistory = data.positionHistory;
        if (data.gameOver) {
            game.gameOver = true;
            io.to(gameId).emit('chess-game-ended', { game, winner: data.winner || 'draw' });
        } else {
            io.to(gameId).emit('chess-move-made', { game });
        }
    });

    socket.on('chess-skip-turn', (data) => {
        const gameId = data.gameId;
        const game = chessGames[gameId];
        if (!game || game.gameOver) return;
        const player = game.players.find(p => p.id === socket.id);
        if (!player || player.color !== game.currentTurn) return;
        game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';
        io.to(gameId).emit('chess-move-made', { game });
    });

    socket.on('quit-game-chess', (data) => {
        const gameId = data.gameId;
        if (chessGames[gameId]) {
            socket.to(gameId).emit('chess-opponent-quit');
            delete chessGames[gameId];
        }
    });

    // --- Game Chat: scoped to game room ---
    socket.on('game-chat', (data) => {
        const { gameId, text } = data;
        if (!gameId || !text) return;
        io.to(gameId).emit('game-chat', { text: text.substring(0, 300), socketId: socket.id });
    });

    // --- Rejoin support: client sends their old gameId after reconnecting ---
    socket.on('rejoin-game', (data) => {
        const { gameId: gId, gameType } = data;
        const gameMaps = { hangman: games, four: fourInARowGames, ttt: ticTacToeGames, draughts: draughtsGames, crossword: crosswordGames, chess: chessGames };
        const map = gameMaps[gameType];
        if (!map || !map[gId]) { socket.emit('rejoin-failed'); return; }
        const game = map[gId];
        // Find the disconnected player slot
        const slot = game.players.find(p => p.disconnected);
        if (!slot) { socket.emit('rejoin-failed'); return; }
        clearTimeout(slot.disconnectTimer);
        delete slot.disconnectTimer;
        delete slot.disconnected;
        slot.id = socket.id;
        socket.join(gId);
        console.log('Player rejoined:', socket.id, 'game:', gId);
        // Send current state back
        if (gameType === 'draughts') {
            socket.emit('draughts-rejoined', { gameId: gId, playerId: socket.id, color: slot.color, game });
        } else if (gameType === 'crossword') {
            socket.emit('crossword-rejoined', { gameId: gId, playerId: socket.id, game });
        } else if (gameType === 'chess') {
            socket.emit('chess-rejoined', { gameId: gId, playerId: socket.id, color: slot.color, game });
        } else {
            socket.emit('game-rejoined', { gameId: gId, playerId: socket.id, game });
        }
        io.to(gId).emit('opponent-reconnected');
    });

    // --- GUESS WHO MULTIPLAYER ---
    socket.on('gw-join', () => {
        // Prevent double-join
        for (const gId in guessWhoGames) {
            if (guessWhoGames[gId].players.some(p => p.id === socket.id)) return;
        }
        let gameId = null;
        for (const gId in guessWhoGames) {
            if (guessWhoGames[gId].state === 'waiting' && guessWhoGames[gId].players.length === 1) {
                gameId = gId;
                break;
            }
        }
        if (!gameId) {
            guessWhoGameCounter++;
            gameId = `gw-${guessWhoGameCounter}`;
            guessWhoGames[gameId] = { id: gameId, players: [], state: 'waiting', currentTurn: 1, secrets: [] };
        }
        const game = guessWhoGames[gameId];
        const playerNum = game.players.length + 1;
        game.players.push({ id: socket.id, num: playerNum, chosenSecret: null });
        socket.join(gameId);

        if (game.players.length === 2) {
            game.state = 'picking';
            // Tell both players to pick their secret celebrity
            io.to(game.players[0].id).emit('gw-pick', { gameId, playerNum: 1 });
            io.to(game.players[1].id).emit('gw-pick', { gameId, playerNum: 2 });
        }
    });

    socket.on('gw-choose-secret', (data) => {
        const game = guessWhoGames[data.gameId];
        if (!game || game.state !== 'picking') return;
        const player = game.players.find(p => p.id === socket.id);
        if (!player) return;

        const celeb = guessWhoCelebrities.find(c => c.name === data.name);
        if (!celeb) return;
        player.chosenSecret = celeb;

        // Check if both have picked
        if (game.players[0].chosenSecret && game.players[1].chosenSecret) {
            game.state = 'playing';
            game.secrets = [game.players[0].chosenSecret, game.players[1].chosenSecret];
            game.currentTurn = 1;

            // Player 1: your secret is secrets[0], you guess secrets[1] (player 2's pick)
            io.to(game.players[0].id).emit('gw-start', {
                gameId: data.gameId, playerNum: 1, yourSecret: game.secrets[0], opponentSecret: game.secrets[1], yourTurn: true
            });
            // Player 2: your secret is secrets[1], you guess secrets[0] (player 1's pick)
            io.to(game.players[1].id).emit('gw-start', {
                gameId: data.gameId, playerNum: 2, yourSecret: game.secrets[1], opponentSecret: game.secrets[0], yourTurn: false
            });
        } else {
            socket.emit('gw-waiting-pick');
        }
    });

    socket.on('gw-ask', (data) => {
        const game = guessWhoGames[data.gameId];
        if (!game || game.state !== 'playing') return;
        const playerIdx = game.players.findIndex(p => p.id === socket.id);
        if (playerIdx === -1) return;
        const playerNum = playerIdx + 1;
        if (game.currentTurn !== playerNum) return;

        // The asker is trying to guess the opponent's secret
        // Player 1 guesses secrets[1], Player 2 guesses secrets[0]
        const targetSecret = game.secrets[playerNum === 1 ? 1 : 0];
        const answer = gwEvaluateQuestion(data.question, targetSecret.traits);

        // Switch turn
        game.currentTurn = playerNum === 1 ? 2 : 1;

        // Notify both
        io.to(game.players[0].id).emit('gw-question', {
            from: playerNum === 1 ? 'You' : 'Opponent', question: data.question, answer, yourTurn: game.currentTurn === 1
        });
        io.to(game.players[1].id).emit('gw-question', {
            from: playerNum === 2 ? 'You' : 'Opponent', question: data.question, answer, yourTurn: game.currentTurn === 2
        });
    });

    socket.on('gw-guess', (data) => {
        const game = guessWhoGames[data.gameId];
        if (!game || game.state !== 'playing') return;
        const playerIdx = game.players.findIndex(p => p.id === socket.id);
        if (playerIdx === -1) return;
        const playerNum = playerIdx + 1;
        if (game.currentTurn !== playerNum) return;

        const targetSecret = game.secrets[playerNum === 1 ? 1 : 0];
        const normalizedGuess = data.guess.toLowerCase();
        const normalizedAnswer = targetSecret.name.toLowerCase();

        if (normalizedGuess === normalizedAnswer || normalizedAnswer.includes(normalizedGuess) || normalizedGuess.includes(normalizedAnswer)) {
            game.state = 'finished';
            io.to(socket.id).emit('gw-win', { msg: `Correct! It was ${targetSecret.name} ${targetSecret.img}!` });
            const opponentId = game.players[playerNum === 1 ? 1 : 0].id;
            io.to(opponentId).emit('gw-lose', { msg: `Opponent guessed correctly! It was ${targetSecret.name} ${targetSecret.img}.` });
            delete guessWhoGames[data.gameId];
        } else {
            // Wrong guess, switch turn
            game.currentTurn = playerNum === 1 ? 2 : 1;
            io.to(game.players[0].id).emit('gw-question', {
                from: playerNum === 1 ? 'You' : 'Opponent', question: `Guessed: ${data.guess}`, answer: '❌ Wrong!', yourTurn: game.currentTurn === 1
            });
            io.to(game.players[1].id).emit('gw-question', {
                from: playerNum === 2 ? 'You' : 'Opponent', question: `Guessed: ${data.guess}`, answer: '❌ Wrong!', yourTurn: game.currentTurn === 2
            });
        }
    });

    socket.on('gw-giveup', (data) => {
        const game = guessWhoGames[data.gameId];
        if (!game) return;
        const playerIdx = game.players.findIndex(p => p.id === socket.id);
        if (playerIdx === -1) return;
        game.state = 'finished';
        const opponentIdx = playerIdx === 0 ? 1 : 0;
        io.to(socket.id).emit('gw-lose', { msg: 'You gave up!' });
        if (game.players[opponentIdx]) {
            io.to(game.players[opponentIdx].id).emit('gw-win', { msg: 'Opponent gave up! You win!' });
        }
        delete guessWhoGames[data.gameId];
    });

    socket.on('disconnect', (reason) => {
        console.log('Player disconnected:', socket.id, 'Reason:', reason);
        const GRACE_PERIOD = 30000; // 30 seconds to reconnect

        function handleDisconnect(gameMap, gameId, cleanupEvent) {
            const game = gameMap[gameId];
            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;

            // Mark as disconnected, start grace timer
            player.disconnected = true;
            player.disconnectTimer = setTimeout(() => {
                // Grace period expired — actually remove
                game.players = game.players.filter(p => p.id !== socket.id);
                if (game.players.length === 0) {
                    delete gameMap[gameId];
                } else {
                    io.to(gameId).emit(cleanupEvent || 'opponent-disconnected');
                    if (cleanupEvent !== 'waiting-players') delete gameMap[gameId];
                }
            }, GRACE_PERIOD);

            // Notify opponent that player is temporarily away
            const remaining = game.players.filter(p => !p.disconnected);
            if (remaining.length > 0 && game.state === 'playing') {
                io.to(gameId).emit('opponent-temporarily-disconnected');
            }
        }

        for (const gameId in games) {
            if (games[gameId].players.some(p => p.id === socket.id)) {
                handleDisconnect(games, gameId, 'opponent-disconnected');
            }
        }
        for (const gameId in fourInARowGames) {
            if (fourInARowGames[gameId].players.some(p => p.id === socket.id)) {
                handleDisconnect(fourInARowGames, gameId, 'opponent-disconnected');
            }
        }
        for (const gameId in ticTacToeGames) {
            if (ticTacToeGames[gameId].players.some(p => p.id === socket.id)) {
                handleDisconnect(ticTacToeGames, gameId, 'opponent-disconnected');
            }
        }
        for (const gameId in crosswordGames) {
            if (crosswordGames[gameId].players.some(p => p.id === socket.id)) {
                handleDisconnect(crosswordGames, gameId, 'opponent-disconnected');
            }
        }
        for (const gameId in draughtsGames) {
            if (draughtsGames[gameId].players.some(p => p.id === socket.id)) {
                handleDisconnect(draughtsGames, gameId, 'draughts-opponent-quit');
            }
        }
        for (const gameId in chessGames) {
            if (chessGames[gameId].players.some(p => p.id === socket.id)) {
                handleDisconnect(chessGames, gameId, 'chess-opponent-quit');
            }
        }
        for (const gameId in guessWhoGames) {
            if (guessWhoGames[gameId].players.some(p => p.id === socket.id)) {
                const game = guessWhoGames[gameId];
                const opponentPlayer = game.players.find(p => p.id !== socket.id);
                if (opponentPlayer) {
                    io.to(opponentPlayer.id).emit('gw-opponent-quit');
                }
                delete guessWhoGames[gameId];
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

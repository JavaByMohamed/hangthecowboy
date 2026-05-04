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

    res.send('Well hello 👋 Your visit has been recorded, thanks for your visit!');
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

app.get('/hangman', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Hangman Game</title>
            <script src="/socket.io/socket.io.js"></script>
            <style>
                body { 
                    font-family: sans-serif; 
                    padding: 30px; 
                    max-width: 700px; 
                    margin: 0 auto;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    color: #333;
                }
                .container {
                    background: white;
                    border-radius: 10px;
                    padding: 30px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                }
                h1 { color: #667eea; margin-bottom: 30px; }
                .section { margin-bottom: 30px; }
                .section h2 { color: #764ba2; margin-bottom: 15px; }
                input, button { 
                    padding: 10px 15px; 
                    font-size: 16px; 
                    border: 2px solid #667eea;
                    border-radius: 5px;
                    margin-right: 10px;
                }
                button { 
                    background: #667eea; 
                    color: white; 
                    cursor: pointer;
                    border: none;
                    transition: background 0.3s;
                }
                button:hover { background: #764ba2; }
                .mode-btn {
                    padding: 20px 40px;
                    font-size: 20px;
                    margin: 10px;
                    width: 220px;
                    border-radius: 8px;
                    cursor: pointer;
                    border: none;
                    color: white;
                    font-weight: bold;
                    transition: transform 0.2s;
                }
                .mode-btn:hover { transform: scale(1.05); }
                .mode-solo { background: #f39c12; }
                .mode-solo:hover { background: #e67e22; }
                .mode-multiplayer { background: #9b59b6; }
                .mode-multiplayer:hover { background: #8e44ad; }
                .team-btn {
                    padding: 15px 30px;
                    font-size: 18px;
                    margin: 10px;
                    width: 200px;
                    border-radius: 8px;
                    cursor: pointer;
                    border: none;
                    color: white;
                    font-weight: bold;
                    transition: transform 0.2s;
                }
                .team-btn:hover { transform: scale(1.05); }
                .team-red { background: #e74c3c; }
                .team-red:hover { background: #c0392b; }
                .team-blue { background: #3498db; }
                .team-blue:hover { background: #2980b9; }
                .game-state {
                    background: #f5f5f5;
                    padding: 20px;
                    border-radius: 5px;
                    margin: 15px 0;
                }
                .word-display {
                    font-size: 28px;
                    letter-spacing: 8px;
                    font-weight: bold;
                    text-align: center;
                    font-family: monospace;
                    margin: 15px 0;
                    color: #667eea;
                }
                .guessed-letters {
                    font-size: 14px;
                    margin: 10px 0;
                }
                .letter-btn {
                    padding: 8px 12px;
                    margin: 5px;
                    font-size: 14px;
                    width: 35px;
                    height: 35px;
                    padding: 0;
                }
                .letter-btn:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }
                .status { 
                    font-size: 18px; 
                    margin: 15px 0;
                    font-weight: bold;
                }
                .win { color: #27ae60; }
                .lose { color: #e74c3c; }
                .playing { color: #f39c12; }
                .hidden { display: none; }
                .team-info {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 15px 0;
                    font-size: 16px;
                    font-weight: bold;
                }
                .team-red-info { border-left: 5px solid #e74c3c; }
                .team-blue-info { border-left: 5px solid #3498db; }
                .team-selection {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin: 30px 0;
                }
                .mode-selection {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin: 30px 0;
                    flex-wrap: wrap;
                }
                .players-status {
                    background: #e8f4f8;
                    padding: 10px;
                    border-radius: 5px;
                    margin: 10px 0;
                    font-size: 14px;
                }
                .waiting-message {
                    text-align: center;
                    color: #666;
                    font-size: 16px;
                    margin: 20px 0;
                }
                .spinner {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎮 Hangman Game</h1>
                
                <div class="section" id="modeSelectionPhase">
                    <h2>Select Game Mode</h2>
                    <p style="text-align: center; font-size: 16px; margin-bottom: 20px;">Choose how you want to play:</p>
                    <div class="mode-selection">
                        <button class="mode-btn mode-solo" onclick="selectMode('solo')">🎯 Solo Mode</button>
                        <button class="mode-btn mode-multiplayer" onclick="selectMode('multiplayer')">👥 Multiplayer</button>
                    </div>
                </div>

                <div class="section hidden" id="teamSelectionPhase">
                    <h2>Phase 1: Choose Your Team</h2>
                    <p style="text-align: center; font-size: 16px; margin-bottom: 20px;">Select which team you're playing on:</p>
                    <div class="team-selection">
                        <button class="team-btn team-red" onclick="selectTeam('red')">🔴 Team Red</button>
                        <button class="team-btn team-blue" onclick="selectTeam('blue')">🔵 Team Blue</button>
                    </div>
                    <div class="players-status" id="playersWaiting"></div>
                </div>

                <div class="section hidden" id="waitingPhase">
                    <h2 id="waitingTitle"></h2>
                    <div class="waiting-message">
                        <div class="spinner"></div>
                        <p>Waiting for another player to join...</p>
                    </div>
                    <div class="players-status" id="playersConnected"></div>
                </div>

                <div class="section hidden" id="setupPhase">
                    <div class="team-info" id="teamInfoSetup"></div>
                    <h2 id="setupTitle"></h2>
                    <input type="text" id="wordInput" placeholder="Enter a word" maxlength="20">
                    <button onclick="submitWord()">Start Game</button>
                </div>

                <div class="section hidden" id="gamePhase">
                    <div class="team-info" id="teamInfoGame"></div>
                    <h2>Guess the Word!</h2>
                    
                    <div class="game-state">
                        <div>Lives Remaining: <span id="lives">6</span>/6</div>
                        <div class="word-display" id="wordDisplay">_ _ _</div>
                        <div class="guessed-letters">Guessed Letters: <span id="guessedList"></span></div>
                        <div class="status" id="status"></div>
                    </div>

                    <div style="margin: 20px 0;">
                        <h3>Choose a letter:</h3>
                        <div id="letterButtons"></div>
                    </div>

                    <div id="gameButtons" style="text-align: center; margin-top: 20px;">
                        <button onclick="quitGame()" style="background: #e74c3c;">Quit Game</button>
                    </div>
                </div>
            </div>

            <script>
                // Word library for solo mode - filtered words suitable for hangman (5-12 letters)
                const wordLibrary = ${JSON.stringify(
                    englishWords
                        .filter(word => word.length >= 5 && word.length <= 12)
                        .map(word => word.toUpperCase())
                )};

                const socket = io();
                let gameMode = ''; // 'solo' or 'multiplayer'
                let selectedTeam = '';
                let gameId = null;
                let playerId = null;
                let gameState = null;
                let currentPhase = 'mode-selection';
                let multiplayerClueShown = false;

                // Solo mode variables
                let soloWord = '';
                let soloGuessedLetters = [];
                let soloWrongGuesses = [];
                let soloClueShown = false;
                const SOLO_MAX_LIVES = 6;

                socket.on('connect', () => {
                    console.log('Connected to server');
                    if (gameMode === 'multiplayer') {
                        updatePlayersWaiting();
                    }
                });

                socket.on('waiting-players', (count) => {
                    updatePlayersWaiting();
                });

                socket.on('game-joined', (data) => {
                    gameId = data.gameId;
                    playerId = data.playerId;
                    gameState = data.game;
                    console.log('Joined game:', gameId);
                    
                    document.getElementById('teamSelectionPhase').classList.add('hidden');
                    document.getElementById('waitingPhase').classList.remove('hidden');
                    
                    const emoji = selectedTeam === 'red' ? '🔴' : '🔵';
                    document.getElementById('waitingTitle').textContent = \`\${emoji} Waiting for opponent...\`;
                    updatePlayersConnected();
                });

                socket.on('game-started', (data) => {
                    gameState = data.game;
                    const wordTeam = data.game.wordTeam;
                    const guessTeam = wordTeam === 'red' ? 'blue' : 'red';
                    const isWordTeam = selectedTeam === wordTeam;
                    
                    if (isWordTeam) {
                        showSetupPhase();
                    } else {
                        showGamePhase(guessTeam);
                    }
                });

                socket.on('word-submitted', (data) => {
                    gameState = data.game;
                    showGamePhase(selectedTeam === 'red' ? 'blue' : 'red');
                });

                socket.on('letter-guessed', (data) => {
                    gameState = data.game;
                    updateGameDisplay();
                });

                socket.on('game-ended', (data) => {
                    gameState = data.game;
                    updateGameDisplay();
                });

                function selectMode(mode) {
                    gameMode = mode;
                    document.getElementById('modeSelectionPhase').classList.add('hidden');

                    if (mode === 'solo') {
                        startSoloMode();
                    } else {
                        document.getElementById('teamSelectionPhase').classList.remove('hidden');
                        updatePlayersWaiting();
                    }
                }

                function startSoloMode() {
                    currentPhase = 'game';
                    soloWord = wordLibrary[Math.floor(Math.random() * wordLibrary.length)];
                    soloGuessedLetters = [];
                    soloWrongGuesses = [];
                    soloClueShown = false;

                    const teamInfoGame = document.getElementById('teamInfoGame');
                    teamInfoGame.textContent = '🎯 Solo Mode - Guess the word!';
                    teamInfoGame.className = 'team-info';
                    teamInfoGame.style.background = '#fff3cd';
                    teamInfoGame.style.borderLeft = '5px solid #f39c12';

                    document.getElementById('gamePhase').classList.remove('hidden');
                    createSoloLetterButtons();
                    updateSoloGameDisplay();
                }

                function updatePlayersWaiting() {
                    socket.emit('get-waiting-count', (count) => {
                        document.getElementById('playersWaiting').textContent = 
                            \`Players waiting to join: \${count + 1}\`;
                    });
                }

                function updatePlayersConnected() {
                    if (gameState && gameState.players) {
                        document.getElementById('playersConnected').textContent = 
                            \`Players in game: \${gameState.players.length}/2\`;
                    }
                }

                function selectTeam(team) {
                    selectedTeam = team;
                    socket.emit('join-game', { team: selectedTeam });
                }

                function showSetupPhase() {
                    currentPhase = 'setup';
                    document.getElementById('waitingPhase').classList.add('hidden');
                    document.getElementById('setupPhase').classList.remove('hidden');

                    const setupTitle = document.getElementById('setupTitle');
                    const teamInfoSetup = document.getElementById('teamInfoSetup');
                    const emoji = selectedTeam === 'red' ? '🔴' : '🔵';

                    setupTitle.textContent = \`\${emoji} Enter a word for the other team to guess\`;
                    teamInfoSetup.textContent = \`\${emoji} Your team is setting the word\`;
                    teamInfoSetup.className = selectedTeam === 'red' ? 'team-info team-red-info' : 'team-info team-blue-info';
                }

                function showGamePhase(guessingTeam) {
                    currentPhase = 'game';
                    multiplayerClueShown = false;
                    document.getElementById('waitingPhase').classList.add('hidden');
                    document.getElementById('setupPhase').classList.add('hidden');
                    document.getElementById('gamePhase').classList.remove('hidden');

                    const teamInfoGame = document.getElementById('teamInfoGame');
                    const isGuessing = selectedTeam === guessingTeam;
                    const emoji = selectedTeam === 'red' ? '🔴' : '🔵';
                    const otherEmoji = selectedTeam === 'red' ? '🔵' : '🔴';

                    if (isGuessing) {
                        teamInfoGame.textContent = \`\${emoji} Your team is guessing!\`;
                        teamInfoGame.className = selectedTeam === 'red' ? 'team-info team-red-info' : 'team-info team-blue-info';
                    } else {
                        teamInfoGame.textContent = \`\${otherEmoji} The other team is guessing\`;
                        teamInfoGame.className = selectedTeam === 'red' ? 'team-info team-blue-info' : 'team-info team-red-info';
                    }

                    createLetterButtons();
                    updateGameDisplay();
                }

                function submitWord() {
                    const input = document.getElementById('wordInput');
                    const word = input.value.trim().toUpperCase();
                    
                    if (!word || word.length < 2) {
                        alert('Please enter a word with at least 2 letters!');
                        return;
                    }

                    socket.emit('submit-word', { gameId, word });
                }

                function createLetterButtons() {
                    const container = document.getElementById('letterButtons');
                    container.innerHTML = '';
                    
                    for (let i = 65; i <= 90; i++) {
                        const letter = String.fromCharCode(i);
                        const btn = document.createElement('button');
                        btn.className = 'letter-btn';
                        btn.textContent = letter;
                        btn.id = 'btn-' + letter;
                        
                        const isGuessed = gameState.guessedLetters.includes(letter) || 
                                         gameState.wrongGuesses.includes(letter);
                        if (isGuessed) {
                            btn.disabled = true;
                        }
                        
                        btn.onclick = () => guessLetter(letter);
                        container.appendChild(btn);
                    }
                }

                function createSoloLetterButtons() {
                    const container = document.getElementById('letterButtons');
                    container.innerHTML = '';
                    
                    for (let i = 65; i <= 90; i++) {
                        const letter = String.fromCharCode(i);
                        const btn = document.createElement('button');
                        btn.className = 'letter-btn';
                        btn.textContent = letter;
                        btn.id = 'btn-' + letter;
                        
                        const isGuessed = soloGuessedLetters.includes(letter) || 
                                         soloWrongGuesses.includes(letter);
                        if (isGuessed) {
                            btn.disabled = true;
                        }
                        
                        btn.onclick = () => guessSoloLetter(letter);
                        container.appendChild(btn);
                    }
                }

                function guessLetter(letter) {
                    if (!gameState.word || gameState.state !== 'playing') return;
                    
                    socket.emit('guess-letter', { gameId, letter });
                }

                function guessSoloLetter(letter) {
                    if (soloWord.includes(letter)) {
                        soloGuessedLetters.push(letter);
                    } else {
                        soloWrongGuesses.push(letter);
                    }

                    updateSoloGameDisplay();
                    createSoloLetterButtons();
                }

                function generateClue(word) {
                    const statusDiv = document.getElementById('status');
                    
                    // Fetch definition from API with timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
                    
                    fetch(\`https://api.dictionaryapi.dev/api/v2/entries/en/\${word.toLowerCase()}\`, {
                        signal: controller.signal
                    })
                        .then(response => {
                            if (!response.ok) throw new Error('API Error');
                            return response.json();
                        })
                        .then(data => {
                            clearTimeout(timeoutId);
                            if (data && data[0]) {
                                const wordData = data[0];
                                let clueText = '';
                                
                                // Try to get meaningful clue from available data
                                if (wordData.meanings && wordData.meanings.length > 0) {
                                    const meaning = wordData.meanings[0];
                                    
                                    // Option 1: Try synonyms first (EASIEST - just similar words)
                                    if (meaning.synonyms && meaning.synonyms.length > 0) {
                                        const synonyms = meaning.synonyms.slice(0, 2).join(', ');
                                        clueText = \`Similar to: \${synonyms}\`;
                                    }
                                    // Option 2: Simplified definition (first sentence only)
                                    else if (meaning.definitions && meaning.definitions.length > 0) {
                                        let definition = meaning.definitions[0].definition;
                                        // Shorten to first 100 characters for simplicity
                                        if (definition.length > 100) {
                                            definition = definition.substring(0, 100) + '...';
                                        }
                                        clueText = definition;
                                    }
                                }
                                
                                if (clueText) {
                                    displayClue(statusDiv, clueText);
                                } else {
                                    throw new Error('No suitable clue data');
                                }
                            } else {
                                throw new Error('No data found');
                            }
                        })
                        .catch((error) => {
                            clearTimeout(timeoutId);
                            // SIMPLE fallback clues - easy to understand
                            const fallbackClues = [
                                \`It's something common you know\`,
                                \`Think of something in your daily life\`,
                                \`A regular English word, not a proper noun\`,
                                \`It's not a rare or technical word\`,
                                \`Something you use or see often\`,
                                \`A simple, everyday word\`,
                            ];
                            const randomClue = fallbackClues[Math.floor(Math.random() * fallbackClues.length)];
                            displayClue(statusDiv, randomClue);
                        });
                }


                function displayClue(statusDiv, clueText) {
                    statusDiv.textContent = \`💡 Hint: \${clueText}\`;
                    statusDiv.style.background = '#fff3cd';
                    statusDiv.style.padding = '15px';
                    statusDiv.style.borderLeft = '4px solid #f39c12';
                    statusDiv.style.fontSize = '16px';
                    statusDiv.className = 'status playing';
                    // Mark that we've shown the clue to prevent overwriting
                    statusDiv.setAttribute('data-clue-shown', 'true');
                }

                function updateGameDisplay() {
                    const display = gameState.word.split('').map(letter => 
                        gameState.guessedLetters.includes(letter) ? letter : '_'
                    ).join(' ');
                    document.getElementById('wordDisplay').textContent = display;
                    document.getElementById('lives').textContent = gameState.maxLives - gameState.wrongGuesses.length;
                    document.getElementById('guessedList').textContent = 
                        [...gameState.guessedLetters, ...gameState.wrongGuesses].sort().join(', ') || 'None';

                    const statusDiv = document.getElementById('status');
                    const wordGuessed = gameState.word.split('').every(letter => gameState.guessedLetters.includes(letter));
                    const outOfLives = gameState.wrongGuesses.length >= gameState.maxLives;
                    const livesRemaining = gameState.maxLives - gameState.wrongGuesses.length;
                    
                    // Don't overwrite if clue is already showing
                    const clueAlreadyShown = statusDiv.getAttribute('data-clue-shown') === 'true';
                    
                    if (wordGuessed) {
                        const winTeam = gameState.wordTeam === 'red' ? 'blue' : 'red';
                        const emoji = winTeam === 'red' ? '🔴' : '🔵';
                        statusDiv.textContent = \`🎉 \${emoji} Team \${winTeam.toUpperCase()} Won! The word was: \${gameState.word}\`;
                        statusDiv.className = 'status win';
                        statusDiv.removeAttribute('data-clue-shown');
                        showGameButtons(true);
                        // Disable all buttons immediately
                        document.querySelectorAll('.letter-btn').forEach(btn => btn.disabled = true);
                    } else if (outOfLives) {
                        const emoji = gameState.wordTeam === 'red' ? '🔴' : '🔵';
                        statusDiv.textContent = \`💀 \${emoji} Team \${gameState.wordTeam.toUpperCase()} wins! Word was: \${gameState.word}\`;
                        statusDiv.className = 'status lose';
                        statusDiv.removeAttribute('data-clue-shown');
                        showGameButtons(true);
                        // Disable all buttons immediately
                        document.querySelectorAll('.letter-btn').forEach(btn => btn.disabled = true);
                    } else if (livesRemaining === 1 && !multiplayerClueShown && !clueAlreadyShown) {
                        // Show clue when guessing team has only 1 life left
                        multiplayerClueShown = true;
                        generateClue(gameState.word);
                        showGameButtons(false);
                    } else if (!clueAlreadyShown) {
                        statusDiv.textContent = '🤔 Keep guessing...';
                        statusDiv.className = 'status playing';
                        showGameButtons(false);
                    }
                }

                function updateSoloGameDisplay() {
                    const display = soloWord.split('').map(letter => 
                        soloGuessedLetters.includes(letter) ? letter : '_'
                    ).join(' ');
                    document.getElementById('wordDisplay').textContent = display;
                    document.getElementById('lives').textContent = SOLO_MAX_LIVES - soloWrongGuesses.length;
                    document.getElementById('guessedList').textContent = 
                        [...soloGuessedLetters, ...soloWrongGuesses].sort().join(', ') || 'None';

                    const statusDiv = document.getElementById('status');
                    const wordGuessed = soloWord.split('').every(letter => soloGuessedLetters.includes(letter));
                    const outOfLives = soloWrongGuesses.length >= SOLO_MAX_LIVES;
                    const livesRemaining = SOLO_MAX_LIVES - soloWrongGuesses.length;
                    
                    // Don't overwrite if clue is already showing
                    const clueAlreadyShown = statusDiv.getAttribute('data-clue-shown') === 'true';
                    
                    if (wordGuessed) {
                        statusDiv.textContent = \`🎉 You Won! The word was: \${soloWord}\`;
                        statusDiv.className = 'status win';
                        statusDiv.removeAttribute('data-clue-shown');
                        showGameButtons(true);
                        // Disable all buttons immediately
                        document.querySelectorAll('.letter-btn').forEach(btn => btn.disabled = true);
                    } else if (outOfLives) {
                        statusDiv.textContent = \`💀 Game Over! The word was: \${soloWord}\`;
                        statusDiv.className = 'status lose';
                        statusDiv.removeAttribute('data-clue-shown');
                        showGameButtons(true);
                        // Disable all buttons immediately
                        document.querySelectorAll('.letter-btn').forEach(btn => btn.disabled = true);
                    } else if (livesRemaining === 1 && !soloClueShown && !clueAlreadyShown) {
                        // Show clue when player has only 1 life left
                        soloClueShown = true;
                        generateClue(soloWord);
                        showGameButtons(false);
                    } else if (!clueAlreadyShown) {
                        statusDiv.textContent = '🤔 Keep guessing...';
                        statusDiv.className = 'status playing';
                        showGameButtons(false);
                    }
                }

                function quitGame() {
                    if (gameMode === 'multiplayer') {
                        socket.emit('quit-game', { gameId });
                    }
                    location.reload();
                }

                function playAgain() {
                    if (gameMode === 'solo') {
                        startSoloMode();
                    } else {
                        // For multiplayer, go back to team selection
                        document.getElementById('gamePhase').classList.add('hidden');
                        document.getElementById('teamSelectionPhase').classList.remove('hidden');
                        selectedTeam = '';
                        multiplayerClueShown = false;
                        updatePlayersWaiting();
                    }
                }

                function showGameButtons(gameEnded = false) {
                    const container = document.getElementById('gameButtons');
                    container.innerHTML = '';
                    
                    if (gameEnded) {
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
                    
                    const quitBtn = document.createElement('button');
                    quitBtn.textContent = '❌ Quit Game';
                    quitBtn.style.background = '#e74c3c';
                    quitBtn.style.color = 'white';
                    quitBtn.style.padding = '10px 15px';
                    quitBtn.style.fontSize = '16px';
                    quitBtn.style.border = 'none';
                    quitBtn.style.borderRadius = '5px';
                    quitBtn.style.cursor = 'pointer';
                    quitBtn.onclick = quitGame;
                    container.appendChild(quitBtn);
                }
            </script>
        </body>
        </html>
    `);
});

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
            game.wordTeam = game.players[0].team; // First player's team sets the word
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

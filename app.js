const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'hangman-secret-key',
    resave: false,
    saveUninitialized: true
}));

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
            <style>
                body { 
                    font-family: sans-serif; 
                    padding: 30px; 
                    max-width: 600px; 
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
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎮 Hangman Game</h1>
                
                <div class="section" id="teamSelectionPhase">
                    <h2>Phase 1: Choose Your Team</h2>
                    <p style="text-align: center; font-size: 16px; margin-bottom: 20px;">Select which team you're playing on:</p>
                    <div class="team-selection">
                        <button class="team-btn team-red" onclick="selectTeam('red')">🔴 Team Red</button>
                        <button class="team-btn team-blue" onclick="selectTeam('blue')">🔵 Team Blue</button>
                    </div>
                </div>

                <div class="section hidden" id="setupPhase">
                    <div class="team-info" id="teamInfoSetup"></div>
                    <h2 id="setupTitle"></h2>
                    <input type="text" id="wordInput" placeholder="Enter a word" maxlength="20">
                    <button onclick="startGame()">Start Game</button>
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

                    <button onclick="resetGame()" style="background: #e74c3c;">New Game</button>
                </div>
            </div>

            <script>
                let selectedTeam = '';
                let word = '';
                let guessedLetters = [];
                let wrongGuesses = [];
                let gameOver = false;
                let won = false;

                function selectTeam(team) {
                    selectedTeam = team;
                    document.getElementById('teamSelectionPhase').classList.add('hidden');
                    document.getElementById('setupPhase').classList.remove('hidden');

                    const setupTitle = document.getElementById('setupTitle');
                    const teamInfoSetup = document.getElementById('teamInfoSetup');

                    if (selectedTeam === 'blue') {
                        setupTitle.textContent = '🔵 Phase 2: Team Blue - Create a Word';
                        teamInfoSetup.textContent = '🔵 Team Blue is creating the word';
                        teamInfoSetup.className = 'team-info team-blue-info';
                    } else {
                        setupTitle.textContent = '🔴 Phase 2: Team Red - Create a Word';
                        teamInfoSetup.textContent = '🔴 Team Red is creating the word';
                        teamInfoSetup.className = 'team-info team-red-info';
                    }
                }

                function startGame() {
                    const input = document.getElementById('wordInput');
                    word = input.value.trim().toUpperCase();
                    
                    if (!word || word.length < 2) {
                        alert('Please enter a word with at least 2 letters!');
                        return;
                    }

                    guessedLetters = [];
                    wrongGuesses = [];
                    gameOver = false;
                    won = false;

                    document.getElementById('setupPhase').classList.add('hidden');
                    document.getElementById('gamePhase').classList.remove('hidden');

                    const teamInfoGame = document.getElementById('teamInfoGame');
                    const guessTeam = selectedTeam === 'blue' ? 'Team Red' : 'Team Blue';
                    const guessTeamEmoji = selectedTeam === 'blue' ? '🔴' : '🔵';
                    const guessTeamClass = selectedTeam === 'blue' ? 'team-red-info' : 'team-blue-info';

                    teamInfoGame.textContent = \`\${guessTeamEmoji} \${guessTeam} is guessing\`;
                    teamInfoGame.className = \`team-info \${guessTeamClass}\`;

                    createLetterButtons();
                    updateDisplay();
                }

                function createLetterButtons() {
                    const container = document.getElementById('letterButtons');
                    container.innerHTML = '';
                    
                    for (let i = 65; i <= 90; i++) {
                        const letter = String.fromCharCode(i);
                        const btn = document.createElement('button');
                        btn.className = 'letter-btn';
                        btn.textContent = letter;
                        btn.onclick = () => guessLetter(letter, btn);
                        container.appendChild(btn);
                    }
                }

                function guessLetter(letter, btn) {
                    if (gameOver || guessedLetters.includes(letter) || wrongGuesses.includes(letter)) {
                        return;
                    }

                    btn.disabled = true;

                    if (word.includes(letter)) {
                        guessedLetters.push(letter);
                    } else {
                        wrongGuesses.push(letter);
                    }

                    checkGameStatus();
                    updateDisplay();
                }

                function checkGameStatus() {
                    const wordGuessed = word.split('').every(letter => guessedLetters.includes(letter));
                    
                    if (wordGuessed) {
                        gameOver = true;
                        won = true;
                    } else if (wrongGuesses.length >= 6) {
                        gameOver = true;
                        won = false;
                    }
                }

                function updateDisplay() {
                    // Update word display
                    const display = word.split('').map(letter => 
                        guessedLetters.includes(letter) ? letter : '_'
                    ).join(' ');
                    document.getElementById('wordDisplay').textContent = display;

                    // Update lives
                    document.getElementById('lives').textContent = 6 - wrongGuesses.length;

                    // Update guessed letters
                    document.getElementById('guessedList').textContent = 
                        [...guessedLetters, ...wrongGuesses].sort().join(', ') || 'None';

                    // Update status
                    const statusDiv = document.getElementById('status');
                    const winTeam = selectedTeam === 'blue' ? 'Team Red' : 'Team Blue';
                    const loseTeam = selectedTeam === 'blue' ? 'Team Blue' : 'Team Red';

                    if (won) {
                        statusDiv.textContent = \`🎉 \${winTeam} Won! The word was: \${word}\`;
                        statusDiv.className = 'status win';
                    } else if (gameOver) {
                        statusDiv.textContent = \`💀 \${loseTeam} couldn't guess it! The word was: \${word}\`;
                        statusDiv.className = 'status lose';
                    } else {
                        statusDiv.textContent = '🤔 Keep guessing...';
                        statusDiv.className = 'status playing';
                    }
                }

                function resetGame() {
                    word = '';
                    guessedLetters = [];
                    wrongGuesses = [];
                    gameOver = false;
                    won = false;
                    selectedTeam = '';
                    
                    document.getElementById('wordInput').value = '';
                    document.getElementById('teamSelectionPhase').classList.remove('hidden');
                    document.getElementById('setupPhase').classList.add('hidden');
                    document.getElementById('gamePhase').classList.add('hidden');
                }
            </script>
        </body>
        </html>
    `);
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});

// Variables
let wordLibrary = [];
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

// Load word library on page load
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/word-library')
        .then(response => response.json())
        .then(data => {
            wordLibrary = data.words;
        })
        .catch(error => console.error('Error loading word library:', error));
});

// Update hangman drawing based on wrong guesses
function updateHangmanDrawing(wrongGuessCount) {
    const hangmanParts = [
        'hangman-head',
        'hangman-body',
        'hangman-left-arm',
        'hangman-right-arm',
        'hangman-left-leg',
        'hangman-right-leg'
    ];
    
    // Also show face when head is shown
    const faceParts = ['hangman-left-eye', 'hangman-right-eye', 'hangman-mouth'];
    
    // Show hangman parts up to the number of wrong guesses
    for (let i = 0; i < hangmanParts.length; i++) {
        const element = document.getElementById(hangmanParts[i]);
        if (element) {
            if (i < wrongGuessCount) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        }
    }
    
    // Show face parts when head is visible
    if (wrongGuessCount > 0) {
        faceParts.forEach(part => {
            const element = document.getElementById(part);
            if (element) {
                element.classList.remove('hidden');
            }
        });
    } else {
        faceParts.forEach(part => {
            const element = document.getElementById(part);
            if (element) {
                element.classList.add('hidden');
            }
        });
    }
}
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
    
    const emoji = selectedTeam === 'creator' ? '✍️' : '🔍';
    const roleText = selectedTeam === 'creator' ? 'Word Creator' : 'Guesser';
    document.getElementById('waitingTitle').textContent = `${emoji} ${roleText} - Waiting for opponent...`;
    updatePlayersConnected();
});

socket.on('game-started', (data) => {
    gameState = data.game;
    const wordTeam = data.game.wordTeam;
    const guessTeam = wordTeam === 'creator' ? 'guesser' : 'creator';
    const isWordTeam = selectedTeam === wordTeam;
    
    if (isWordTeam) {
        showSetupPhase();
    } else {
        showGamePhase(guessTeam);
    }
});

socket.on('word-submitted', (data) => {
    gameState = data.game;
    showGamePhase(selectedTeam === 'creator' ? 'guesser' : 'creator');
});

socket.on('letter-guessed', (data) => {
    gameState = data.game;
    updateGameDisplay();
});

socket.on('game-ended', (data) => {
    gameState = data.game;
    updateGameDisplay();
});

// Game mode selection
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

// Solo mode startup
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

// Update player counts
function updatePlayersWaiting() {
    socket.emit('get-waiting-count', (count) => {
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

// Team/Role selection
function selectTeam(team) {
    selectedTeam = team;
    socket.emit('join-game', { team: selectedTeam });
}

// Setup phase (for word creators)
function showSetupPhase() {
    currentPhase = 'setup';
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('setupPhase').classList.remove('hidden');

    const setupTitle = document.getElementById('setupTitle');
    const teamInfoSetup = document.getElementById('teamInfoSetup');
    const wordInput = document.getElementById('wordInput');
    const submitBtn = document.querySelector('#setupPhase button');
    const emoji = selectedTeam === 'creator' ? '✍️' : '🔍';
    const roleText = selectedTeam === 'creator' ? 'Word Creator' : 'Guesser';

    if (selectedTeam === 'creator') {
        // CREATOR - Show word input
        setupTitle.textContent = `${emoji} Enter a word for the other player to guess`;
        teamInfoSetup.textContent = `${emoji} Your role: ${roleText} - Setting the word`;
        wordInput.style.display = 'block';
        submitBtn.style.display = 'block';
    } else {
        // GUESSER - Show waiting message, hide input
        setupTitle.textContent = `🔍 Waiting for Word Creator`;
        teamInfoSetup.textContent = `🔍 Your role: ${roleText} - Waiting for the word creator to enter a word...`;
        wordInput.style.display = 'none';
        submitBtn.style.display = 'none';
    }
    
    teamInfoSetup.className = selectedTeam === 'creator' ? 'team-info team-red-info' : 'team-info team-blue-info';
}

// Game phase display
function showGamePhase(guessingTeam) {
    currentPhase = 'game';
    multiplayerClueShown = false;
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('setupPhase').classList.add('hidden');
    document.getElementById('gamePhase').classList.remove('hidden');

    const teamInfoGame = document.getElementById('teamInfoGame');
    const isCreator = selectedTeam === 'creator';
    const isGuessing = selectedTeam === guessingTeam;
    const emoji = isCreator ? '✍️' : '🔍';
    const otherEmoji = isCreator ? '🔍' : '✍️';
    const myRole = isCreator ? 'Word Creator' : 'Guesser';
    const otherRole = isCreator ? 'Guesser' : 'Word Creator';

    if (isGuessing) {
        teamInfoGame.textContent = `${emoji} Your role: ${myRole} - You are guessing!`;
        teamInfoGame.className = isCreator ? 'team-info team-red-info' : 'team-info team-blue-info';
    } else {
        teamInfoGame.textContent = `${otherEmoji} The ${otherRole} is guessing`;
        teamInfoGame.className = isCreator ? 'team-info team-blue-info' : 'team-info team-red-info';
    }

    createLetterButtons();
    updateGameDisplay();
}

// Submit word (multiplayer)
function submitWord() {
    const input = document.getElementById('wordInput');
    const word = input.value.trim().toUpperCase();
    
    if (!word || word.length < 2) {
        alert('Please enter a word with at least 2 letters!');
        return;
    }

    socket.emit('submit-word', { gameId, word });
}

// Create letter buttons for multiplayer
function createLetterButtons() {
    const container = document.getElementById('letterButtons');
    container.innerHTML = '';
    
    // Creators cannot guess - only show buttons to guessers
    if (gameMode === 'multiplayer' && selectedTeam === 'creator') {
        container.innerHTML = '<p style="text-align: center; color: #999; margin: 20px 0;">Waiting for the Guesser to guess letters...</p>';
        return;
    }
    
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

// Create letter buttons for solo mode
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

// Guess letter in multiplayer
function guessLetter(letter) {
    // Creators cannot guess
    if (gameMode === 'multiplayer' && selectedTeam === 'creator') {
        alert('As the Word Creator, you cannot guess! Watch the Guesser try to figure out your word.');
        return;
    }
    
    if (!gameState.word || gameState.state !== 'playing') return;
    
    socket.emit('guess-letter', { gameId, letter });
}

// Guess letter in solo mode
function guessSoloLetter(letter) {
    if (soloWord.includes(letter)) {
        soloGuessedLetters.push(letter);
    } else {
        soloWrongGuesses.push(letter);
    }

    updateSoloGameDisplay();
    createSoloLetterButtons();
}

// Generate clue from API or fallback
function generateClue(word) {
    const statusDiv = document.getElementById('status');
    
    // Fetch definition from API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`, {
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
                        clueText = `Similar to: ${synonyms}`;
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
                `It's something common you know`,
                `Think of something in your daily life`,
                `A regular English word, not a proper noun`,
                `It's not a rare or technical word`,
                `Something you use or see often`,
                `A simple, everyday word`,
            ];
            const randomClue = fallbackClues[Math.floor(Math.random() * fallbackClues.length)];
            displayClue(statusDiv, randomClue);
        });
}

// Display clue
function displayClue(statusDiv, clueText) {
    statusDiv.textContent = `💡 Hint: ${clueText}`;
    statusDiv.style.background = '#fff3cd';
    statusDiv.style.padding = '15px';
    statusDiv.style.borderLeft = '4px solid #f39c12';
    statusDiv.style.fontSize = '16px';
    statusDiv.className = 'status playing';
    // Mark that we've shown the clue to prevent overwriting
    statusDiv.setAttribute('data-clue-shown', 'true');
}

// Update multiplayer game display
function updateGameDisplay() {
    const display = gameState.word.split('').map(letter => 
        gameState.guessedLetters.includes(letter) ? letter : '_'
    ).join(' ');
    document.getElementById('wordDisplay').textContent = display;
    document.getElementById('lives').textContent = gameState.maxLives - gameState.wrongGuesses.length;
    document.getElementById('guessedList').textContent = 
        [...gameState.guessedLetters, ...gameState.wrongGuesses].sort().join(', ') || 'None';

    // Update hangman drawing
    updateHangmanDrawing(gameState.wrongGuesses.length);

    const statusDiv = document.getElementById('status');
    const wordGuessed = gameState.word.split('').every(letter => gameState.guessedLetters.includes(letter));
    const outOfLives = gameState.wrongGuesses.length >= gameState.maxLives;
    const livesRemaining = gameState.maxLives - gameState.wrongGuesses.length;
    
    // Don't overwrite if clue is already showing
    const clueAlreadyShown = statusDiv.getAttribute('data-clue-shown') === 'true';
    
    if (wordGuessed) {
        if (selectedTeam === 'guesser') {
            statusDiv.textContent = `🎉 You Won! The word was: ${gameState.word}`;
        } else {
            statusDiv.textContent = `💀 You Lost! The word was: ${gameState.word}`;
        }
        statusDiv.className = 'status win';
        statusDiv.removeAttribute('data-clue-shown');
        showGameButtons(true);
        // Disable all buttons immediately
        document.querySelectorAll('.letter-btn').forEach(btn => btn.disabled = true);
    } else if (outOfLives) {
        if (selectedTeam === 'creator') {
            statusDiv.textContent = `🎉 You Won! The word was: ${gameState.word}`;
        } else {
            statusDiv.textContent = `💀 You Lost! The word was: ${gameState.word}`;
        }
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

// Update solo game display
function updateSoloGameDisplay() {
    const display = soloWord.split('').map(letter => 
        soloGuessedLetters.includes(letter) ? letter : '_'
    ).join(' ');
    document.getElementById('wordDisplay').textContent = display;
    document.getElementById('lives').textContent = SOLO_MAX_LIVES - soloWrongGuesses.length;
    document.getElementById('guessedList').textContent = 
        [...soloGuessedLetters, ...soloWrongGuesses].sort().join(', ') || 'None';

    // Update hangman drawing
    updateHangmanDrawing(soloWrongGuesses.length);

    const statusDiv = document.getElementById('status');
    const wordGuessed = soloWord.split('').every(letter => soloGuessedLetters.includes(letter));
    const outOfLives = soloWrongGuesses.length >= SOLO_MAX_LIVES;
    const livesRemaining = SOLO_MAX_LIVES - soloWrongGuesses.length;
    
    // Don't overwrite if clue is already showing
    const clueAlreadyShown = statusDiv.getAttribute('data-clue-shown') === 'true';
    
    if (wordGuessed) {
        statusDiv.textContent = `🎉 You Won! The word was: ${soloWord}`;
        statusDiv.className = 'status win';
        statusDiv.removeAttribute('data-clue-shown');
        showGameButtons(true);
        // Disable all buttons immediately
        document.querySelectorAll('.letter-btn').forEach(btn => btn.disabled = true);
    } else if (outOfLives) {
        statusDiv.textContent = `💀 Game Over! The word was: ${soloWord}`;
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

// Play again - restart the game
function playAgain() {
    // Reset game variables
    gameMode = '';
    selectedTeam = '';
    gameId = null;
    playerId = null;
    gameState = null;
    currentPhase = 'mode-selection';
    multiplayerClueShown = false;
    soloClueShown = false;
    soloWord = '';
    soloGuessedLetters = [];
    soloWrongGuesses = [];

    // Reset UI
    document.getElementById('gamePhase').classList.add('hidden');
    document.getElementById('setupPhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('teamSelectionPhase').classList.add('hidden');
    document.getElementById('modeSelectionPhase').classList.remove('hidden');
    
    // Reset hangman drawing
    document.querySelectorAll('.hangman-part').forEach(part => {
        part.classList.add('hidden');
    });
}

// Quit game - go to homepage
function quitGame() {
    if (gameMode === 'multiplayer') {
        socket.emit('quit-game', { gameId });
    }
    window.location.href = '/';
}


// Show game buttons (play again / quit)
function showGameButtons(gameEnded = false) {
    const container = document.getElementById('gameButtons');
    container.innerHTML = '';
    
    // Hide letter buttons when game ends
    if (gameEnded) {
        document.getElementById('letterButtons').style.display = 'none';
        
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
    } else {
        // Show letter buttons if game is still playing
        document.getElementById('letterButtons').style.display = 'block';
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


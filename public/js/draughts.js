// International Draughts (FMJD Rules)
// 10x10 board, 20 pieces per side
// Flying kings, men capture backwards, maximum capture rule
// Pieces: 'w' = white man, 'b' = black man, 'W' = white king, 'B' = black king, '' = empty

const socket = io();

let gameMode = null; // 'solo' or 'multiplayer'
let playerColor = null;
let currentTurn = 'white';
let board = [];
let selectedPiece = null;
let validMoves = [];
let gameOver = false;
let gameId = null;

const BOARD_SIZE = 10;

// ==================== BOARD SETUP ====================

function initBoard() {
    board = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        board[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            if ((r + c) % 2 === 1) {
                if (r < 4) board[r][c] = 'b';
                else if (r > 5) board[r][c] = 'w';
                else board[r][c] = '';
            } else {
                board[r][c] = '';
            }
        }
    }
}

// ==================== SOCKET EVENTS (MULTIPLAYER) ====================

socket.on('draughts-joined', (data) => {
    gameId = data.gameId;
    playerColor = data.color;
    document.getElementById('colorPhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.remove('hidden');
    document.getElementById('waitingTitle').textContent =
        `You are ${playerColor === 'white' ? '⚪ White' : '⚫ Black'} - Waiting for opponent...`;
});

socket.on('draughts-started', (data) => {
    board = data.game.board;
    currentTurn = data.game.currentTurn;
    gameOver = false;
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('gamePhase').classList.remove('hidden');
    document.getElementById('gameMessage').classList.add('hidden');
    renderBoard();
    updateInfo();
});

socket.on('draughts-move-made', (data) => {
    board = data.game.board;
    currentTurn = data.game.currentTurn;
    selectedPiece = null;
    validMoves = [];
    renderBoard();
    updateInfo();
});

socket.on('draughts-game-ended', (data) => {
    board = data.game.board;
    gameOver = true;
    const msgEl = document.getElementById('gameMessage');
    msgEl.textContent = `🏆 ${data.winner} Wins!`;
    msgEl.classList.remove('hidden');
    renderBoard();
});

socket.on('draughts-opponent-quit', () => {
    gameOver = true;
    const msgEl = document.getElementById('gameMessage');
    msgEl.textContent = '⚠️ Opponent disconnected!';
    msgEl.classList.remove('hidden');
});

// ==================== UI HANDLERS ====================

function selectGameMode(mode) {
    gameMode = mode;
    document.getElementById('gameModePhase').classList.add('hidden');
    document.getElementById('colorPhase').classList.remove('hidden');
}

function selectColor(color) {
    playerColor = color;
    if (gameMode === 'solo') {
        document.getElementById('colorPhase').classList.add('hidden');
        startGame();
    } else {
        // Multiplayer: join via socket
        socket.emit('join-game-draughts', { color });
    }
}

function startGame() {
    initBoard();
    currentTurn = 'white';
    selectedPiece = null;
    validMoves = [];
    gameOver = false;
    document.getElementById('gamePhase').classList.remove('hidden');
    document.getElementById('gameMessage').classList.add('hidden');
    renderBoard();
    updateInfo();

    if (gameMode === 'solo' && playerColor !== 'white') {
        setTimeout(aiMove, 500);
    }
}

function restartGame() {
    if (gameMode === 'multiplayer') {
        quitGame();
    } else {
        startGame();
    }
}

function quitGame() {
    gameOver = true;
    if (gameMode === 'multiplayer' && gameId) {
        socket.emit('quit-game-draughts', { gameId });
        gameId = null;
    }
    document.getElementById('gamePhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('gameModePhase').classList.remove('hidden');
}

// ==================== PIECE HELPERS ====================

function getColor(piece) {
    if (piece === 'w' || piece === 'W') return 'white';
    if (piece === 'b' || piece === 'B') return 'black';
    return null;
}

function isKing(piece) {
    return piece === 'W' || piece === 'B';
}

function isMan(piece) {
    return piece === 'w' || piece === 'b';
}

function inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

// ==================== MOVE GENERATION (FMJD RULES) ====================

const ALL_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

// Get all capture sequences for a piece (FMJD: men can capture backwards, kings fly)
// Returns array of sequences: [{moves: [{from, to, captured: [{r,c},...]}], ...}]
function getCaptureSequences(r, c, brd) {
    const piece = brd[r][c];
    const color = getColor(piece);
    const sequences = [];

    function findCaptures(curR, curC, curBoard, captured, path) {
        let foundCapture = false;

        for (const [dr, dc] of ALL_DIRS) {
            if (isKing(piece)) {
                // Flying king: can move multiple squares, jump over one enemy, land on any empty beyond
                let er = curR + dr, ec = curC + dc;
                let enemyFound = null;

                while (inBounds(er, ec)) {
                    const cell = curBoard[er][ec];
                    if (cell === '') {
                        if (enemyFound) {
                            // Can land here after capturing
                            // Check if this enemy was already captured in this sequence
                            const alreadyCaptured = captured.some(cp => cp.r === enemyFound.r && cp.c === enemyFound.c);
                            if (!alreadyCaptured) {
                                foundCapture = true;
                                const newCaptured = [...captured, enemyFound];
                                const newBoard = cloneBoard(curBoard);
                                newBoard[curR][curC] = '';
                                newBoard[enemyFound.r][enemyFound.c] = ''; // temporarily remove
                                newBoard[er][ec] = piece;
                                const newPath = [...path, { from: { r: curR, c: curC }, to: { r: er, c: ec } }];
                                findCaptures(er, ec, newBoard, newCaptured, newPath);
                            }
                        }
                        er += dr;
                        ec += dc;
                    } else if (getColor(cell) !== color && !enemyFound) {
                        // Found an enemy piece (first one in this direction)
                        const alreadyCaptured = captured.some(cp => cp.r === er && cp.c === ec);
                        if (alreadyCaptured) break; // can't jump over already-captured piece
                        enemyFound = { r: er, c: ec };
                        er += dr;
                        ec += dc;
                    } else {
                        // Friendly piece or second enemy: stop
                        break;
                    }
                }
            } else {
                // Man: can capture in ALL 4 directions (FMJD rule), one square jump
                const er = curR + dr, ec = curC + dc;
                const lr = curR + 2 * dr, lc = curC + 2 * dc;

                if (!inBounds(lr, lc)) continue;
                const enemyCell = curBoard[er][ec];
                const landCell = curBoard[lr][lc];

                if (enemyCell && getColor(enemyCell) !== color && landCell === '') {
                    const alreadyCaptured = captured.some(cp => cp.r === er && cp.c === ec);
                    if (alreadyCaptured) continue;

                    foundCapture = true;
                    const newCaptured = [...captured, { r: er, c: ec }];
                    const newBoard = cloneBoard(curBoard);
                    newBoard[curR][curC] = '';
                    newBoard[er][ec] = ''; // temporarily remove captured
                    newBoard[lr][lc] = piece; // don't promote mid-sequence
                    const newPath = [...path, { from: { r: curR, c: curC }, to: { r: lr, c: lc } }];
                    findCaptures(lr, lc, newBoard, newCaptured, newPath);
                }
            }
        }

        if (!foundCapture && captured.length > 0) {
            // End of sequence
            sequences.push({ path, captured: [...captured] });
        }
    }

    findCaptures(r, c, brd, [], []);
    return sequences;
}

// Get simple (non-capture) moves for a piece
function getSimpleMoves(r, c, brd) {
    const piece = brd[r][c];
    const moves = [];

    if (isKing(piece)) {
        // Flying king: move any number of squares diagonally
        for (const [dr, dc] of ALL_DIRS) {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc) && brd[nr][nc] === '') {
                moves.push({ from: { r, c }, to: { r: nr, c: nc }, captured: [] });
                nr += dr;
                nc += dc;
            }
        }
    } else {
        // Man: move forward only (one square diagonally)
        const forwardDirs = piece === 'w' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
        for (const [dr, dc] of forwardDirs) {
            const nr = r + dr, nc = c + dc;
            if (inBounds(nr, nc) && brd[nr][nc] === '') {
                moves.push({ from: { r, c }, to: { r: nr, c: nc }, captured: [] });
            }
        }
    }
    return moves;
}

// Get all legal moves for a color (applying maximum capture rule)
function getAllLegalMoves(color, brd) {
    let allCaptures = [];
    let allSimple = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (getColor(brd[r][c]) === color) {
                const seqs = getCaptureSequences(r, c, brd);
                for (const seq of seqs) {
                    allCaptures.push({ startR: r, startC: c, ...seq });
                }
                if (seqs.length === 0) {
                    const simple = getSimpleMoves(r, c, brd);
                    allSimple.push(...simple);
                }
            }
        }
    }

    // FMJD: If captures are available, they are mandatory
    if (allCaptures.length > 0) {
        // Maximum capture rule: must choose sequence that captures the most pieces
        const maxCaptures = Math.max(...allCaptures.map(s => s.captured.length));
        allCaptures = allCaptures.filter(s => s.captured.length === maxCaptures);

        // Convert capture sequences to move format
        return allCaptures.map(seq => ({
            from: { r: seq.startR, c: seq.startC },
            to: seq.path[seq.path.length - 1].to,
            captured: seq.captured,
            path: seq.path,
            isCapture: true
        }));
    }

    return allSimple.map(m => ({ ...m, isCapture: false }));
}

// Get legal moves for a specific piece (filtered by maximum capture rule)
function getLegalMovesForPiece(r, c, brd, color) {
    const allMoves = getAllLegalMoves(color, brd);
    return allMoves.filter(m => m.from.r === r && m.from.c === c);
}

// ==================== BOARD MANIPULATION ====================

function cloneBoard(brd) {
    return brd.map(row => [...row]);
}

function applyFullMove(brd, move) {
    const nb = cloneBoard(brd);
    const piece = nb[move.from.r][move.from.c];
    nb[move.from.r][move.from.c] = '';

    // Remove all captured pieces
    for (const cap of move.captured) {
        nb[cap.r][cap.c] = '';
    }

    // Place piece at destination
    nb[move.to.r][move.to.c] = piece;

    // Promotion: man reaching the last row becomes king
    // FMJD: only promotes if landing on last row at end of move
    if (piece === 'w' && move.to.r === 0) nb[move.to.r][move.to.c] = 'W';
    if (piece === 'b' && move.to.r === 9) nb[move.to.r][move.to.c] = 'B';

    return nb;
}

function countPieces(brd) {
    let white = 0, black = 0;
    for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (getColor(brd[r][c]) === 'white') white++;
            if (getColor(brd[r][c]) === 'black') black++;
        }
    return { white, black };
}

// ==================== RENDERING ====================

function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    const canMove = !gameOver && currentTurn === playerColor;
    const legalForSelected = (canMove && selectedPiece) ? getLegalMovesForPiece(selectedPiece.r, selectedPiece.c, board, currentTurn) : [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Valid move indicator
            const vm = legalForSelected.find(m => m.to.r === r && m.to.c === c);
            if (vm) {
                cell.classList.add(vm.isCapture ? 'valid-capture' : 'valid-move');
                cell.addEventListener('click', () => executeMove(vm));
            }

            const piece = board[r][c];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = 'piece ' + getColor(piece);
                if (isKing(piece)) pieceEl.classList.add('king');
                if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                    pieceEl.classList.add('selected');
                }
                pieceEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onPieceClick(r, c);
                });
                cell.appendChild(pieceEl);
            }

            cell.addEventListener('click', () => {
                if (!vm) {
                    selectedPiece = null;
                    validMoves = [];
                    renderBoard();
                }
            });

            boardEl.appendChild(cell);
        }
    }
}

// ==================== GAME LOGIC ====================

function onPieceClick(r, c) {
    if (gameOver) return;
    const color = getColor(board[r][c]);
    if (color !== currentTurn) return;
    if (color !== playerColor) return;

    selectedPiece = { r, c };
    renderBoard();
}

function executeMove(move) {
    if (gameOver) return;
    board = applyFullMove(board, move);
    selectedPiece = null;
    validMoves = [];

    if (gameMode === 'multiplayer') {
        // Check game end
        const nextTurn = currentTurn === 'white' ? 'black' : 'white';
        const moves = getAllLegalMoves(nextTurn, board);
        const counts = countPieces(board);
        let isGameOver = false;
        let winner = null;

        if (moves.length === 0 || counts.white === 0 || counts.black === 0) {
            isGameOver = true;
            if (counts.white === 0) winner = 'Black';
            else if (counts.black === 0) winner = 'White';
            else winner = currentTurn === 'white' ? 'White' : 'Black';
        }

        socket.emit('draughts-move', {
            gameId,
            board,
            gameOver: isGameOver,
            winner
        });

        if (isGameOver) {
            gameOver = true;
            const msgEl = document.getElementById('gameMessage');
            msgEl.textContent = `🏆 ${winner} Wins!`;
            msgEl.classList.remove('hidden');
        } else {
            currentTurn = nextTurn;
            updateInfo();
            renderBoard();
        }
    } else {
        switchTurn();
    }
}

function switchTurn() {
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    updateInfo();
    renderBoard();
    checkGameEnd();

    if (!gameOver && gameMode === 'solo' && currentTurn !== playerColor) {
        setTimeout(aiMove, 500);
    }
}

function updateInfo() {
    const counts = countPieces(board);
    document.getElementById('redCount').textContent = counts.white;
    document.getElementById('blackCount').textContent = counts.black;
    const indicator = document.getElementById('turnIndicator');
    indicator.textContent = currentTurn === 'white' ? "White's Turn" : "Black's Turn";
    indicator.className = 'turn-indicator' + (currentTurn === 'black' ? ' black-turn' : '');
}

function checkGameEnd() {
    const moves = getAllLegalMoves(currentTurn, board);
    const counts = countPieces(board);
    if (moves.length === 0 || counts.white === 0 || counts.black === 0) {
        gameOver = true;
        let winner;
        if (counts.white === 0) winner = 'Black';
        else if (counts.black === 0) winner = 'White';
        else winner = currentTurn === 'white' ? 'Black' : 'White';
        const msgEl = document.getElementById('gameMessage');
        msgEl.textContent = `🏆 ${winner} Wins!`;
        msgEl.classList.remove('hidden');
    }
}

// ==================== AI (Minimax with Alpha-Beta) ====================

function aiMove() {
    if (gameOver) return;

    const aiColor = playerColor === 'white' ? 'black' : 'white';
    const bestMove = minimax(board, 4, -Infinity, Infinity, true, aiColor).move;
    if (!bestMove) {
        checkGameEnd();
        return;
    }

    board = applyFullMove(board, bestMove);
    selectedPiece = null;
    validMoves = [];
    switchTurn();
}

function evaluate(brd, aiColor) {
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = brd[r][c];
            if (!p) continue;
            const color = getColor(p);
            let val;
            if (isKing(p)) {
                val = 7; // kings are very valuable
            } else {
                val = 3;
                // Advancement bonus
                if (color === 'white') val += (9 - r) * 0.15;
                else val += r * 0.15;
            }
            // Center control bonus
            const centerDist = Math.abs(c - 4.5) + Math.abs(r - 4.5);
            val += (5 - centerDist) * 0.05;

            if (color === aiColor) score += val;
            else score -= val;
        }
    }
    return score;
}

function minimax(brd, depth, alpha, beta, maximizing, aiColor) {
    const humanColor = aiColor === 'white' ? 'black' : 'white';
    const color = maximizing ? aiColor : humanColor;
    const moves = getAllLegalMoves(color, brd);

    if (depth === 0 || moves.length === 0) {
        return { score: evaluate(brd, aiColor), move: null };
    }

    let bestMove = null;
    if (maximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const nb = applyFullMove(brd, move);
            const result = minimax(nb, depth - 1, alpha, beta, false, aiColor);
            if (result.score > maxEval) {
                maxEval = result.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, maxEval);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const nb = applyFullMove(brd, move);
            const result = minimax(nb, depth - 1, alpha, beta, true, aiColor);
            if (result.score < minEval) {
                minEval = result.score;
                bestMove = move;
            }
            beta = Math.min(beta, minEval);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove };
    }
}

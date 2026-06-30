// ============================================================
//  Chess – Full Client-Side Logic (Solo AI + Multiplayer)
// ============================================================

const socket = typeof io !== 'undefined' ? io() : null;

// ---- Piece unicode maps ----
const PIECE_SYMBOLS = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// ---- Game state ----
let gameState = null;   // authoritative state object
let gameMode = null;     // 'solo' | 'multiplayer'
let playerColor = null;
let aiDifficulty = null;
let selectedSquare = null;
let validMoves = [];
let timerInterval = null;
let timeLeft = 30;
let multiplayerGameId = null;
let multiplayerPlayerId = null;
let promotionCallback = null;
let gameStartTimeout = null;
let isPrivateGame = false;
let matchmakingType = null; // 'random' | 'create-private' | 'join-private'

// ============================================================
//  State object helpers – every search / simulation clones this
// ============================================================

function initialBoard() {
    const back = ['r','n','b','q','k','b','n','r'];
    const b = [];
    for (let r = 0; r < 8; r++) {
        b[r] = [];
        for (let c = 0; c < 8; c++) {
            if (r === 0) b[r][c] = back[c];
            else if (r === 1) b[r][c] = 'p';
            else if (r === 6) b[r][c] = 'P';
            else if (r === 7) b[r][c] = back[c].toUpperCase();
            else b[r][c] = '';
        }
    }
    return b;
}

function createState(board) {
    return {
        board: board || initialBoard(),
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
}

function cloneState(s) {
    return {
        board: s.board.map(row => row.slice()),
        currentTurn: s.currentTurn,
        castlingRights: { ...s.castlingRights },
        enPassantTarget: s.enPassantTarget ? [...s.enPassantTarget] : null,
        lastMove: s.lastMove ? { ...s.lastMove } : null,
        capturedWhite: [...s.capturedWhite],
        capturedBlack: [...s.capturedBlack],
        halfMoveClock: s.halfMoveClock,
        positionHistory: [...s.positionHistory],
        gameOver: s.gameOver,
        winner: s.winner
    };
}

// ============================================================
//  Utility
// ============================================================

function pieceColor(p) {
    if (!p) return null;
    return p === p.toUpperCase() ? 'white' : 'black';
}

function opponent(color) {
    return color === 'white' ? 'black' : 'white';
}

function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function findKing(board, color) {
    const k = color === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c] === k) return [r, c];
    return null;
}

// ============================================================
//  Move Generation – all functions take explicit state, no globals
// ============================================================

function isSquareAttacked(board, row, col, byColor) {
    // Check all pieces of byColor to see if any attack (row,col)
    const dir = byColor === 'white' ? 1 : -1;
    // Pawn attacks
    const pr = row + dir;
    if (inBounds(pr, col - 1) && board[pr][col - 1] && pieceColor(board[pr][col - 1]) === byColor && board[pr][col - 1].toLowerCase() === 'p') return true;
    if (inBounds(pr, col + 1) && board[pr][col + 1] && pieceColor(board[pr][col + 1]) === byColor && board[pr][col + 1].toLowerCase() === 'p') return true;

    // Knight
    const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightMoves) {
        const nr = row + dr, nc = col + dc;
        if (inBounds(nr, nc) && board[nr][nc] && pieceColor(board[nr][nc]) === byColor && board[nr][nc].toLowerCase() === 'n') return true;
    }

    // King
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr, nc = col + dc;
            if (inBounds(nr, nc) && board[nr][nc] && pieceColor(board[nr][nc]) === byColor && board[nr][nc].toLowerCase() === 'k') return true;
        }

    // Rook / Queen (straight lines)
    const straight = [[0,1],[0,-1],[1,0],[-1,0]];
    for (const [dr, dc] of straight) {
        let nr = row + dr, nc = col + dc;
        while (inBounds(nr, nc)) {
            if (board[nr][nc]) {
                if (pieceColor(board[nr][nc]) === byColor && (board[nr][nc].toLowerCase() === 'r' || board[nr][nc].toLowerCase() === 'q')) return true;
                break;
            }
            nr += dr; nc += dc;
        }
    }

    // Bishop / Queen (diagonals)
    const diag = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dr, dc] of diag) {
        let nr = row + dr, nc = col + dc;
        while (inBounds(nr, nc)) {
            if (board[nr][nc]) {
                if (pieceColor(board[nr][nc]) === byColor && (board[nr][nc].toLowerCase() === 'b' || board[nr][nc].toLowerCase() === 'q')) return true;
                break;
            }
            nr += dr; nc += dc;
        }
    }

    return false;
}

function isInCheck(board, color) {
    const kp = findKing(board, color);
    if (!kp) return false;
    return isSquareAttacked(board, kp[0], kp[1], opponent(color));
}

// Generate pseudo-legal moves for a piece, returns [{from, to, promotion?}]
function pseudoMovesForPiece(state, row, col) {
    const board = state.board;
    const piece = board[row][col];
    if (!piece) return [];
    const color = pieceColor(piece);
    const moves = [];
    const type = piece.toLowerCase();

    function addMove(tr, tc, promo) {
        moves.push({ from: [row, col], to: [tr, tc], promotion: promo || null });
    }

    if (type === 'p') {
        const dir = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        const promoRow = color === 'white' ? 0 : 7;
        // Forward
        if (inBounds(row + dir, col) && !board[row + dir][col]) {
            if (row + dir === promoRow) {
                ['q','r','b','n'].forEach(p => addMove(row + dir, col, p));
            } else {
                addMove(row + dir, col);
            }
            // Double push
            if (row === startRow && !board[row + 2 * dir][col]) {
                addMove(row + 2 * dir, col);
            }
        }
        // Captures
        for (const dc of [-1, 1]) {
            const tr = row + dir, tc = col + dc;
            if (!inBounds(tr, tc)) continue;
            if (board[tr][tc] && pieceColor(board[tr][tc]) !== color) {
                if (tr === promoRow) {
                    ['q','r','b','n'].forEach(p => addMove(tr, tc, p));
                } else {
                    addMove(tr, tc);
                }
            }
            // En passant
            if (state.enPassantTarget && state.enPassantTarget[0] === tr && state.enPassantTarget[1] === tc) {
                addMove(tr, tc);
            }
        }
    } else if (type === 'n') {
        const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of offsets) {
            const tr = row + dr, tc = col + dc;
            if (inBounds(tr, tc) && (!board[tr][tc] || pieceColor(board[tr][tc]) !== color)) addMove(tr, tc);
        }
    } else if (type === 'k') {
        for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const tr = row + dr, tc = col + dc;
                if (inBounds(tr, tc) && (!board[tr][tc] || pieceColor(board[tr][tc]) !== color)) addMove(tr, tc);
            }
        // Castling
        const cr = state.castlingRights;
        if (color === 'white') {
            if (cr.K && board[7][5] === '' && board[7][6] === '' && board[7][7] === 'R' && board[7][4] === 'K'
                && !isSquareAttacked(board, 7, 4, 'black') && !isSquareAttacked(board, 7, 5, 'black') && !isSquareAttacked(board, 7, 6, 'black'))
                addMove(7, 6);
            if (cr.Q && board[7][3] === '' && board[7][2] === '' && board[7][1] === '' && board[7][0] === 'R' && board[7][4] === 'K'
                && !isSquareAttacked(board, 7, 4, 'black') && !isSquareAttacked(board, 7, 3, 'black') && !isSquareAttacked(board, 7, 2, 'black'))
                addMove(7, 2);
        } else {
            if (cr.k && board[0][5] === '' && board[0][6] === '' && board[0][7] === 'r' && board[0][4] === 'k'
                && !isSquareAttacked(board, 0, 4, 'white') && !isSquareAttacked(board, 0, 5, 'white') && !isSquareAttacked(board, 0, 6, 'white'))
                addMove(0, 6);
            if (cr.q && board[0][3] === '' && board[0][2] === '' && board[0][1] === '' && board[0][0] === 'r' && board[0][4] === 'k'
                && !isSquareAttacked(board, 0, 4, 'white') && !isSquareAttacked(board, 0, 3, 'white') && !isSquareAttacked(board, 0, 2, 'white'))
                addMove(0, 2);
        }
    } else {
        // Sliding pieces
        const dirs = [];
        if (type === 'r' || type === 'q') dirs.push([0,1],[0,-1],[1,0],[-1,0]);
        if (type === 'b' || type === 'q') dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
        for (const [dr, dc] of dirs) {
            let tr = row + dr, tc = col + dc;
            while (inBounds(tr, tc)) {
                if (board[tr][tc]) {
                    if (pieceColor(board[tr][tc]) !== color) addMove(tr, tc);
                    break;
                }
                addMove(tr, tc);
                tr += dr; tc += dc;
            }
        }
    }

    return moves;
}

// Apply move on a cloned state, returns new state (no mutation)
function applyMove(state, move, promoChoice) {
    const s = cloneState(state);
    const { from, to, promotion } = move;
    const [fr, fc] = from;
    const [tr, tc] = to;
    const piece = s.board[fr][fc];
    const captured = s.board[tr][tc];
    const color = pieceColor(piece);
    const type = piece.toLowerCase();

    // Handle captures
    if (captured) {
        if (color === 'white') s.capturedBlack.push(captured);
        else s.capturedWhite.push(captured);
        s.halfMoveClock = 0;
    } else if (type === 'p') {
        s.halfMoveClock = 0;
    } else {
        s.halfMoveClock++;
    }

    // En passant capture
    if (type === 'p' && s.enPassantTarget && tr === s.enPassantTarget[0] && tc === s.enPassantTarget[1]) {
        const epRow = color === 'white' ? tr + 1 : tr - 1;
        const epPiece = s.board[epRow][tc];
        if (epPiece) {
            if (color === 'white') s.capturedBlack.push(epPiece);
            else s.capturedWhite.push(epPiece);
        }
        s.board[epRow][tc] = '';
        s.halfMoveClock = 0;
    }

    // Set en passant target
    if (type === 'p' && Math.abs(tr - fr) === 2) {
        s.enPassantTarget = [(fr + tr) / 2, fc];
    } else {
        s.enPassantTarget = null;
    }

    // Move piece
    s.board[tr][tc] = piece;
    s.board[fr][fc] = '';

    // Promotion
    if (type === 'p' && (tr === 0 || tr === 7)) {
        const promo = promotion || promoChoice || 'q';
        s.board[tr][tc] = color === 'white' ? promo.toUpperCase() : promo.toLowerCase();
    }

    // Castling – move rook
    if (type === 'k') {
        if (tc - fc === 2) { // Kingside
            s.board[tr][tc - 1] = s.board[tr][7];
            s.board[tr][7] = '';
        } else if (fc - tc === 2) { // Queenside
            s.board[tr][tc + 1] = s.board[tr][0];
            s.board[tr][0] = '';
        }
    }

    // Update castling rights
    if (type === 'k') {
        if (color === 'white') { s.castlingRights.K = false; s.castlingRights.Q = false; }
        else { s.castlingRights.k = false; s.castlingRights.q = false; }
    }
    if (type === 'r') {
        if (color === 'white') {
            if (fr === 7 && fc === 0) s.castlingRights.Q = false;
            if (fr === 7 && fc === 7) s.castlingRights.K = false;
        } else {
            if (fr === 0 && fc === 0) s.castlingRights.q = false;
            if (fr === 0 && fc === 7) s.castlingRights.k = false;
        }
    }
    // If a rook is captured
    if (captured) {
        if (tr === 0 && tc === 0) s.castlingRights.q = false;
        if (tr === 0 && tc === 7) s.castlingRights.k = false;
        if (tr === 7 && tc === 0) s.castlingRights.Q = false;
        if (tr === 7 && tc === 7) s.castlingRights.K = false;
    }

    s.lastMove = { from: [fr, fc], to: [tr, tc] };
    s.currentTurn = opponent(color);

    // Position history for draw detection
    const posKey = boardToKey(s.board) + s.currentTurn + JSON.stringify(s.castlingRights) + JSON.stringify(s.enPassantTarget);
    s.positionHistory.push(posKey);

    return s;
}

function boardToKey(board) {
    return board.map(r => r.join(',')).join(';');
}

// Generate all legal moves for current turn
function allLegalMoves(state) {
    const color = state.currentTurn;
    const legal = [];
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            if (!state.board[r][c] || pieceColor(state.board[r][c]) !== color) continue;
            const pseudo = pseudoMovesForPiece(state, r, c);
            for (const m of pseudo) {
                const ns = applyMove(state, m);
                if (!isInCheck(ns.board, color)) legal.push(m);
            }
        }
    return legal;
}

// Legal moves for a specific square
function legalMovesFrom(state, row, col) {
    const piece = state.board[row][col];
    if (!piece || pieceColor(piece) !== state.currentTurn) return [];
    const pseudo = pseudoMovesForPiece(state, row, col);
    return pseudo.filter(m => {
        const ns = applyMove(state, m);
        return !isInCheck(ns.board, pieceColor(piece));
    });
}

// Check game-over conditions
function checkGameOver(state) {
    const moves = allLegalMoves(state);
    if (moves.length === 0) {
        if (isInCheck(state.board, state.currentTurn)) {
            state.gameOver = true;
            state.winner = opponent(state.currentTurn);
        } else {
            state.gameOver = true;
            state.winner = 'draw';
        }
    }
    // 50-move rule
    if (state.halfMoveClock >= 100) {
        state.gameOver = true;
        state.winner = 'draw';
    }
    // Threefold repetition
    const last = state.positionHistory[state.positionHistory.length - 1];
    if (last && state.positionHistory.filter(p => p === last).length >= 3) {
        state.gameOver = true;
        state.winner = 'draw';
    }
    // Insufficient material
    if (isInsufficientMaterial(state.board)) {
        state.gameOver = true;
        state.winner = 'draw';
    }
}

function isInsufficientMaterial(board) {
    const pieces = [];
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c]) pieces.push(board[r][c]);
    if (pieces.length === 2) return true; // K vs K
    if (pieces.length === 3) {
        const types = pieces.map(p => p.toLowerCase());
        if (types.includes('b') || types.includes('n')) return true;
    }
    return false;
}

// ============================================================
//  AI – Minimax with alpha-beta (operates on cloned states only)
// ============================================================

function evaluateBoard(state) {
    let score = 0;
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = state.board[r][c];
            if (!p) continue;
            const val = PIECE_VALUES[p.toLowerCase()] || 0;
            const positionalBonus = getPST(p, r, c);
            if (pieceColor(p) === 'white') score += val * 100 + positionalBonus;
            else score -= val * 100 + positionalBonus;
        }
    return score;
}

// Simple piece-square tables
function getPST(piece, r, c) {
    const type = piece.toLowerCase();
    const isWhite = piece === piece.toUpperCase();
    const row = isWhite ? r : 7 - r;
    
    const pawnTable = [
        0, 0, 0, 0, 0, 0, 0, 0,
        50,50,50,50,50,50,50,50,
        10,10,20,30,30,20,10,10,
        5, 5,10,25,25,10, 5, 5,
        0, 0, 0,20,20, 0, 0, 0,
        5,-5,-10,0,0,-10,-5, 5,
        5,10,10,-20,-20,10,10, 5,
        0, 0, 0, 0, 0, 0, 0, 0
    ];
    
    const knightTable = [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50
    ];

    const tables = { p: pawnTable, n: knightTable };
    const table = tables[type];
    if (table) {
        const idx = row * 8 + c;
        return isWhite ? table[idx] : -table[idx];
    }
    return 0;
}

function minimax(state, depth, alpha, beta, maximizing) {
    if (depth === 0 || state.gameOver) return evaluateBoard(state);

    const moves = allLegalMoves(state);
    if (moves.length === 0) {
        if (isInCheck(state.board, state.currentTurn))
            return maximizing ? -99999 + (10 - depth) : 99999 - (10 - depth);
        return 0; // stalemate
    }

    // Move ordering: captures first
    moves.sort((a, b) => {
        const capA = state.board[a.to[0]][a.to[1]] ? 1 : 0;
        const capB = state.board[b.to[0]][b.to[1]] ? 1 : 0;
        return capB - capA;
    });

    if (maximizing) {
        let maxEval = -Infinity;
        for (const m of moves) {
            const ns = applyMove(state, m);
            checkGameOver(ns);
            const ev = minimax(ns, depth - 1, alpha, beta, false);
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const m of moves) {
            const ns = applyMove(state, m);
            checkGameOver(ns);
            const ev = minimax(ns, depth - 1, alpha, beta, true);
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function getAIMove(state) {
    const depthMap = { easy: 1, medium: 2, hard: 3 };
    const depth = depthMap[aiDifficulty] || 2;
    const moves = allLegalMoves(state);
    if (moves.length === 0) return null;

    const isMaximizing = state.currentTurn === 'white';
    let bestMove = null;
    let bestEval = isMaximizing ? -Infinity : Infinity;

    for (const m of moves) {
        const ns = applyMove(state, m);
        checkGameOver(ns);
        const ev = minimax(ns, depth - 1, -Infinity, Infinity, !isMaximizing);
        if (isMaximizing ? ev > bestEval : ev < bestEval) {
            bestEval = ev;
            bestMove = m;
        }
    }

    // Easy: add some randomness
    if (aiDifficulty === 'easy' && Math.random() < 0.3) {
        bestMove = moves[Math.floor(Math.random() * moves.length)];
    }

    return bestMove;
}

// ============================================================
//  UI
// ============================================================

function $(id) { return document.getElementById(id); }

function selectGameMode(mode) {
    gameMode = mode;
    $('gameModePhase').classList.add('hidden');
    if (mode === 'solo') {
        $('difficultyPhase').classList.remove('hidden');
    } else {
        $('multiplayerOptionsPhase').classList.remove('hidden');
        initInviteSystem();
    }
}

function initInviteSystem() {
    InviteSystem.init({ gameType: 'chess' });
    InviteSystem.renderInviteOptions(
        'inviteOptionsContainer',
        () => {
            matchmakingType = 'random';
            isPrivateGame = false;
            $('multiplayerOptionsPhase').classList.add('hidden');
            $('colorPhase').classList.remove('hidden');
        },
        () => {
            matchmakingType = 'create-private';
            isPrivateGame = true;
            $('multiplayerOptionsPhase').classList.add('hidden');
            $('colorPhase').classList.remove('hidden');
        },
        (code) => {
            matchmakingType = 'join-private';
            isPrivateGame = true;
            InviteSystem.joinByCode(code, {}, (response) => {
                if (!response.success) return;
                multiplayerGameId = response.gameId;
                multiplayerPlayerId = socket && socket.id ? socket.id : multiplayerPlayerId;
                playerColor = response.color || response.assignedColor || (response.game.players[0].color === 'white' ? 'black' : 'white');

                if (response.game && response.game.state === 'playing') {
                    $('waitingPhase').classList.add('hidden');
                    $('gamePhase').classList.remove('hidden');
                    gameState = createState();
                    gameState.board = response.game.board;
                    gameState.currentTurn = response.game.currentTurn;
                    renderBoard();
                    updateInfo();
                    if (typeof showChatWidget === 'function') showChatWidget(true);
                } else {
                    $('multiplayerOptionsPhase').classList.add('hidden');
                    $('waitingPhase').classList.remove('hidden');
                    const waitingTitle = $('waitingTitle');
                    if (waitingTitle) waitingTitle.textContent = `You are ${playerColor === 'white' ? '♔ White' : '♚ Black'} - Joined game!`;
                    const waitingContent = $('waitingContent');
                    if (waitingContent) waitingContent.innerHTML = '<p class="center-text">Waiting for game to start...</p>';
                }
            });
        }
    );
}

function selectDifficulty(diff) {
    aiDifficulty = diff;
    $('difficultyPhase').classList.add('hidden');
    $('colorPhase').classList.remove('hidden');
}

function selectColor(color) {
    playerColor = color;
    $('colorPhase').classList.add('hidden');
    if (gameMode === 'solo') {
        startSoloGame();
    } else {
        if (isPrivateGame && matchmakingType === 'create-private') {
            InviteSystem.createPrivateGame({ color }, (response) => {
                multiplayerGameId = response.gameId;
                multiplayerPlayerId = response.playerId;
                $('waitingPhase').classList.remove('hidden');
                const waitingTitle = $('waitingTitle');
                if (waitingTitle) waitingTitle.textContent = `You are ${playerColor === 'white' ? '♔ White' : '♚ Black'}`;
                InviteSystem.renderWaitingWithCode('waitingContent', `You are ${playerColor === 'white' ? '♔ White' : '♚ Black'}`);
            });
        } else {
            $('waitingPhase').classList.remove('hidden');
            socket.emit('join-game-chess', { color });
        }
    }
}

function startSoloGame() {
    gameState = createState();
    $('gamePhase').classList.remove('hidden');
    renderBoard();
    updateInfo();
    // Only start timer for solo mode
    startTimer();
    if (playerColor === 'black') {
        setTimeout(doAIMove, 500);
    }
}

// ============================================================
//  Board Rendering
// ============================================================

function renderBoard() {
    const boardEl = $('board');
    boardEl.innerHTML = '';
    const flipped = playerColor === 'black';

    for (let displayR = 0; displayR < 8; displayR++) {
        for (let displayC = 0; displayC < 8; displayC++) {
            const r = flipped ? 7 - displayR : displayR;
            const c = displayC; // Only flip rows, not columns
            const sq = document.createElement('div');
            sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
            sq.dataset.row = r;
            sq.dataset.col = c;

            // Last move highlight
            if (gameState.lastMove) {
                const lm = gameState.lastMove;
                if ((r === lm.from[0] && c === lm.from[1]) || (r === lm.to[0] && c === lm.to[1])) {
                    sq.classList.add('last-move');
                }
            }

            // Selected
            if (selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c) {
                sq.classList.add('selected');
            }

            // Valid move dots
            const vm = validMoves.find(m => m.to[0] === r && m.to[1] === c);
            if (vm) {
                if (gameState.board[r][c]) sq.classList.add('valid-capture');
                else sq.classList.add('valid-move');
            }

            // King in check
            if (gameState.board[r][c] && gameState.board[r][c].toLowerCase() === 'k') {
                const kColor = pieceColor(gameState.board[r][c]);
                if (isInCheck(gameState.board, kColor)) {
                    sq.classList.add('in-check');
                }
            }

            // Piece
            if (gameState.board[r][c]) {
                sq.textContent = PIECE_SYMBOLS[gameState.board[r][c]] || '';
            }

            sq.addEventListener('click', () => onSquareClick(r, c));
            boardEl.appendChild(sq);
        }
    }
}

function onSquareClick(r, c) {
    if (gameState.gameOver) return;
    if (gameMode === 'multiplayer' && gameState.currentTurn !== playerColor) return;
    if (gameMode === 'solo' && gameState.currentTurn !== playerColor) return;

    const clickedPiece = gameState.board[r][c];

    // If we have a selected piece
    if (selectedSquare) {
        // Check if clicking a valid move target
        const move = validMoves.find(m => m.to[0] === r && m.to[1] === c);
        if (move) {
            executeMove(move);
            return;
        }
        // Re-select own piece (fix: allow re-selection)
        if (clickedPiece && pieceColor(clickedPiece) === gameState.currentTurn) {
            selectedSquare = [r, c];
            validMoves = legalMovesFrom(gameState, r, c);
            renderBoard();
            return;
        }
        // Deselect
        selectedSquare = null;
        validMoves = [];
        renderBoard();
        return;
    }

    // Select a piece
    if (clickedPiece && pieceColor(clickedPiece) === gameState.currentTurn) {
        selectedSquare = [r, c];
        validMoves = legalMovesFrom(gameState, r, c);
        renderBoard();
    }
}

function executeMove(move) {
    // Check if promotion needed (pawn reaching last rank without promotion set)
    const piece = gameState.board[move.from[0]][move.from[1]];
    const isPromotion = piece.toLowerCase() === 'p' && (move.to[0] === 0 || move.to[0] === 7);

    if (isPromotion && !move.promotion) {
        showPromotionModal(gameState.currentTurn, (choice) => {
            move.promotion = choice;
            finishMove(move);
        });
        return;
    }

    finishMove(move);
}

function finishMove(move) {
    selectedSquare = null;
    validMoves = [];

    gameState = applyMove(gameState, move);
    checkGameOver(gameState);
    renderBoard();
    updateInfo();

    if (gameState.gameOver) {
        stopTimer();
        showGameResult();
        return;
    }

    // Only reset timer for solo mode
    if (gameMode === 'solo') {
        resetTimer();
    }

    if (gameMode === 'multiplayer') {
        socket.emit('chess-move', {
            gameId: multiplayerGameId,
            board: gameState.board,
            turn: gameState.currentTurn,
            castlingRights: gameState.castlingRights,
            enPassantTarget: gameState.enPassantTarget,
            lastMove: gameState.lastMove,
            capturedWhite: gameState.capturedWhite,
            capturedBlack: gameState.capturedBlack,
            halfMoveClock: gameState.halfMoveClock,
            positionHistory: gameState.positionHistory,
            gameOver: gameState.gameOver,
            winner: gameState.winner
        });
    }

    if (gameMode === 'solo' && gameState.currentTurn !== playerColor) {
        setTimeout(doAIMove, 300);
    }
}

function doAIMove() {
    if (gameState.gameOver) return;
    if (gameState.currentTurn === playerColor) return;

    const move = getAIMove(gameState);
    if (!move) return;

    gameState = applyMove(gameState, move);
    checkGameOver(gameState);

    selectedSquare = null;
    validMoves = [];
    renderBoard();
    updateInfo();

    if (gameState.gameOver) {
        stopTimer();
        showGameResult();
        return;
    }

    resetTimer();
}

// ============================================================
//  Promotion Modal
// ============================================================

function showPromotionModal(color, callback) {
    const modal = $('promotionModal');
    const options = $('promotionOptions');
    modal.classList.remove('hidden');
    options.innerHTML = '';

    const pieces = color === 'white' ? ['Q','R','B','N'] : ['q','r','b','n'];
    pieces.forEach(p => {
        const btn = document.createElement('button');
        btn.textContent = PIECE_SYMBOLS[p];
        btn.addEventListener('click', () => {
            modal.classList.add('hidden');
            callback(p.toLowerCase());
        });
        options.appendChild(btn);
    });
}

// ============================================================
//  Timer – forfeits on expiry instead of skipping
// ============================================================

function startTimer() {
    timeLeft = 30;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            stopTimer();
            // Time expired: hand over turn to opponent
            gameState.currentTurn = opponent(gameState.currentTurn);
            selectedSquare = null;
            validMoves = [];
            renderBoard();
            updateInfo();
            if (gameMode === 'multiplayer') {
                socket.emit('chess-skip-turn', { gameId: multiplayerGameId });
            }
            if (gameMode === 'solo' && gameState.currentTurn !== playerColor) {
                setTimeout(doAIMove, 300);
            } else {
                resetTimer();
            }
        }
    }, 1000);
}

function resetTimer() {
    stopTimer();
    // Only start timer for solo mode
    if (gameMode === 'solo') {
        // Don't start timer during AI turn in solo mode
        if (gameState.currentTurn !== playerColor) return;
        startTimer();
    }
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function updateTimerDisplay() {
    const el = $('timerDisplay');
    if (el) el.textContent = `⏱️ ${timeLeft}s`;
}

// ============================================================
//  Info & Messages
// ============================================================

function updateInfo() {
    const turn = gameState.currentTurn;
    const ti = $('turnIndicator');
    ti.textContent = turn === 'white' ? "White's Turn" : "Black's Turn";
    ti.className = 'turn-indicator' + (turn === 'black' ? ' black-turn' : '');

    const wi = $('whiteInfo');
    const bi = $('blackInfo');
    wi.className = 'score' + (turn === 'white' ? ' active' : '');
    bi.className = 'score' + (turn === 'black' ? ' active' : '');

    $('capturedBlack').textContent = gameState.capturedBlack.map(p => PIECE_SYMBOLS[p] || '').join(' ');
    $('capturedWhite').textContent = gameState.capturedWhite.map(p => PIECE_SYMBOLS[p] || '').join(' ');
}

function showGameResult() {
    const msg = $('gameMessage');
    msg.classList.remove('hidden', 'win', 'lose', 'draw');

    if (gameState.winner === 'draw') {
        msg.textContent = '🤝 Draw!';
        msg.classList.add('draw');
    } else if (gameState.winner === playerColor) {
        msg.textContent = '🎉 You Win!';
        msg.classList.add('win');
    } else {
        msg.textContent = gameMode === 'solo' ? '🤖 AI Wins!' : '😞 You Lose!';
        msg.classList.add('lose');
    }
}

function restartGame() {
    stopTimer();
    selectedSquare = null;
    validMoves = [];
    $('gameMessage').classList.add('hidden');

    if (gameMode === 'solo') {
        gameState = createState();
        renderBoard();
        updateInfo();
        startTimer();
        if (playerColor === 'black') setTimeout(doAIMove, 500);
    } else {
        // Multiplayer restart – go back to mode selection
        quitGame();
    }
}

function quitGame() {
    stopTimer();
    if (gameStartTimeout) clearTimeout(gameStartTimeout);
    if (gameMode === 'multiplayer' && multiplayerGameId) {
        socket.emit('quit-game-chess', { gameId: multiplayerGameId });
    }
    gameState = null;
    selectedSquare = null;
    validMoves = [];
    multiplayerGameId = null;
    $('gamePhase').classList.add('hidden');
    $('waitingPhase').classList.add('hidden');
    $('colorPhase').classList.add('hidden');
    $('difficultyPhase').classList.add('hidden');
    $('gameMessage').classList.add('hidden');
    $('gameModePhase').classList.remove('hidden');
}

// ============================================================
//  Multiplayer Socket Events
// ============================================================

if (socket) {
    socket.on('chess-joined', (data) => {
        multiplayerGameId = data.gameId;
        multiplayerPlayerId = data.playerId;
        if (data.color) playerColor = data.color;
        $('multiplayerOptionsPhase').classList.add('hidden');
        $('colorPhase').classList.add('hidden');
        $('waitingPhase').classList.remove('hidden');
        const waitingTitle = $('waitingTitle');
        if (waitingTitle) waitingTitle.textContent = `You are ${playerColor === 'white' ? '♔ White' : '♚ Black'} - Waiting for opponent...`;
        if (isPrivateGame && matchmakingType === 'create-private' && data.game && data.game.inviteCode) {
            InviteSystem.inviteCode = data.game.inviteCode;
            InviteSystem.gameId = multiplayerGameId;
            InviteSystem.renderWaitingWithCode('waitingContent', `You are ${playerColor === 'white' ? '♔ White' : '♚ Black'}`);
        } else {
            const waitingContent = $('waitingContent');
            if (waitingContent) waitingContent.innerHTML = '<p class="center-text">Waiting for opponent...</p>';
        }
        console.log('[CHESS] Joined game:', multiplayerGameId);

        // Set timeout for game to start
        gameStartTimeout = setTimeout(() => {
            console.error('[CHESS] Game start timeout - opponent may not have joined');
            const waitingPhase = $('waitingPhase');
            if (waitingPhase && !waitingPhase.classList.contains('hidden')) {
                const msg = waitingPhase.querySelector('p') || waitingPhase;
                if (msg) msg.textContent = 'Waiting for opponent... (Check connection)';
            }
        }, 10000);
    });

    socket.on('chess-started', (data) => {
        // Clear timeout since game started
        if (gameStartTimeout) clearTimeout(gameStartTimeout);

        console.log('[CHESS] Game started');
        $('multiplayerOptionsPhase').classList.add('hidden');
        $('colorPhase').classList.add('hidden');
        $('waitingPhase').classList.add('hidden');
        gameState = createState();
        // Sync from server if needed
        if (data.game && data.game.board) {
            gameState.board = data.game.board;
            gameState.currentTurn = data.game.currentTurn;
        }
        $('gamePhase').classList.remove('hidden');
        renderBoard();
        updateInfo();
        // Don't start timer for multiplayer - only render the board
        if (typeof showChatWidget === 'function') showChatWidget(true);
    });

    socket.on('chess-move-made', (data) => {
        const g = data.game;
        gameState.board = g.board;
        gameState.currentTurn = g.currentTurn;
        gameState.castlingRights = g.castlingRights || gameState.castlingRights;
        gameState.enPassantTarget = g.enPassantTarget || null;
        gameState.lastMove = g.lastMove || null;
        gameState.capturedWhite = g.capturedWhite || [];
        gameState.capturedBlack = g.capturedBlack || [];
        gameState.halfMoveClock = g.halfMoveClock || 0;
        gameState.positionHistory = g.positionHistory || [];

        selectedSquare = null;
        validMoves = [];
        renderBoard();
        updateInfo();
        // Don't use timer for multiplayer
    });

    socket.on('chess-game-ended', (data) => {
        gameState.gameOver = true;
        gameState.winner = data.winner;
        stopTimer();
        renderBoard();
        updateInfo();
        showGameResult();
    });

    socket.on('chess-opponent-quit', () => {
        stopTimer();
        gameState.gameOver = true;
        gameState.winner = playerColor;
        renderBoard();
        showGameResult();
    });
}

const CANDY_TYPES = ['🍒', '🍋', '🍇', '🍏', '🫐', '🍊'];
const ROWS = 8;
const COLS = 8;
const START_MOVES = 30;
const TARGET_SCORE = 5000;

let board = [];
let selectedCell = null;
let hintCells = null;
let score = 0;
let movesLeft = START_MOVES;
let bestCombo = 1;
let locked = false;
let suppressClickUntil = 0;
let touchStart = null;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const targetEl = document.getElementById('target');
const movesEl = document.getElementById('moves');
const comboEl = document.getElementById('combo');
const messageEl = document.getElementById('message');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayMessageEl = document.getElementById('overlayMessage');

function randomType() {
    return Math.floor(Math.random() * CANDY_TYPES.length);
}

function isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function swapCells(a, b) {
    const temp = board[a.r][a.c];
    board[a.r][a.c] = board[b.r][b.c];
    board[b.r][b.c] = temp;
}

function hasMatchAt(r, c) {
    const value = board[r][c];
    if (value === null || value === undefined) return false;

    let count = 1;
    for (let i = c - 1; i >= 0 && board[r][i] === value; i--) count++;
    for (let i = c + 1; i < COLS && board[r][i] === value; i++) count++;
    if (count >= 3) return true;

    count = 1;
    for (let i = r - 1; i >= 0 && board[i][c] === value; i--) count++;
    for (let i = r + 1; i < ROWS && board[i][c] === value; i++) count++;
    return count >= 3;
}

function findMatches() {
    const matched = new Set();

    for (let r = 0; r < ROWS; r++) {
        let runStart = 0;
        for (let c = 1; c <= COLS; c++) {
            if (c < COLS && board[r][c] === board[r][runStart] && board[r][c] !== null) continue;
            const runLen = c - runStart;
            if (board[r][runStart] !== null && runLen >= 3) {
                for (let x = runStart; x < c; x++) matched.add(`${r},${x}`);
            }
            runStart = c;
        }
    }

    for (let c = 0; c < COLS; c++) {
        let runStart = 0;
        for (let r = 1; r <= ROWS; r++) {
            if (r < ROWS && board[r][c] === board[runStart][c] && board[r][c] !== null) continue;
            const runLen = r - runStart;
            if (board[runStart][c] !== null && runLen >= 3) {
                for (let y = runStart; y < r; y++) matched.add(`${y},${c}`);
            }
            runStart = r;
        }
    }

    return [...matched].map((key) => {
        const [r, c] = key.split(',').map(Number);
        return { r, c };
    });
}

function applyGravity() {
    for (let c = 0; c < COLS; c++) {
        let writeRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] !== null) {
                board[writeRow][c] = board[r][c];
                if (writeRow !== r) board[r][c] = null;
                writeRow--;
            }
        }
        while (writeRow >= 0) {
            board[writeRow][c] = randomType();
            writeRow--;
        }
    }
}

function clearMatches(matches) {
    for (const { r, c } of matches) {
        board[r][c] = null;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function findPossibleMoves() {
    const moves = [];
    const directions = [
        [0, 1],
        [1, 0]
    ];

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            for (const [dr, dc] of directions) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= ROWS || nc >= COLS) continue;

                const a = { r, c };
                const b = { r: nr, c: nc };
                swapCells(a, b);
                const valid = hasMatchAt(r, c) || hasMatchAt(nr, nc);
                swapCells(a, b);

                if (valid) moves.push([a, b]);
            }
        }
    }

    return moves;
}

function generateStartingBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let candidate = randomType();
            while (
                (c >= 2 && board[r][c - 1] === candidate && board[r][c - 2] === candidate) ||
                (r >= 2 && board[r - 1][c] === candidate && board[r - 2][c] === candidate)
            ) {
                candidate = randomType();
            }
            board[r][c] = candidate;
        }
    }

    if (findPossibleMoves().length === 0) {
        generateStartingBoard();
    }
}

function render() {
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('button');
            cell.className = 'cell';
            cell.type = 'button';
            cell.dataset.row = String(r);
            cell.dataset.col = String(c);
            cell.textContent = CANDY_TYPES[board[r][c]];

            if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
            }

            if (hintCells && hintCells.some((h) => h.r === r && h.c === c)) {
                cell.classList.add('hint');
            }

            cell.addEventListener('click', () => onCellClick(r, c));
            boardEl.appendChild(cell);
        }
    }
}

function updateHUD() {
    scoreEl.textContent = String(score);
    targetEl.textContent = String(TARGET_SCORE);
    movesEl.textContent = String(movesLeft);
    comboEl.textContent = `x${bestCombo}`;
}

function setMessage(text) {
    messageEl.textContent = text;
}

function showOverlay(title, message) {
    overlayTitleEl.textContent = title;
    overlayMessageEl.textContent = message;
    overlayEl.classList.remove('hidden');
}

function hideOverlay() {
    overlayEl.classList.add('hidden');
}

function showInvalidMove(a, b) {
    const nodes = boardEl.querySelectorAll('.cell');
    for (const node of nodes) {
        const r = Number(node.dataset.row);
        const c = Number(node.dataset.col);
        if ((r === a.r && c === a.c) || (r === b.r && c === b.c)) {
            node.classList.add('invalid');
        }
    }
}

function clearHint() {
    hintCells = null;
}

function getCellFromElement(el) {
    if (!el) return null;
    const cell = el.closest('.cell');
    if (!cell) return null;
    return {
        r: Number(cell.dataset.row),
        c: Number(cell.dataset.col)
    };
}

async function runCascade() {
    let chain = 0;
    let totalCleared = 0;

    while (true) {
        const matches = findMatches();
        if (matches.length === 0) break;

        chain++;
        bestCombo = Math.max(bestCombo, chain);
        totalCleared += matches.length;
        score += matches.length * 60 * chain;

        clearMatches(matches);
        render();
        await sleep(120);

        applyGravity();
        render();
        await sleep(120);
    }

    return { chain, totalCleared };
}

async function trySwap(first, second) {
    if (locked || !first || !second || !isAdjacent(first, second)) return false;

    locked = true;
    selectedCell = null;
    clearHint();
    swapCells(first, second);
    render();

    const valid = hasMatchAt(first.r, first.c) || hasMatchAt(second.r, second.c);
    if (!valid) {
        await sleep(120);
        swapCells(first, second);
        render();
        showInvalidMove(first, second);
        setMessage('That swap does not create a match.');
        locked = false;
        return false;
    }

    movesLeft--;
    const { chain, totalCleared } = await runCascade();
    updateHUD();

    if (chain > 1) {
        setMessage(`Sweet! ${totalCleared} candies cleared with a x${chain} cascade.`);
    } else {
        setMessage(`${totalCleared} candies cleared.`);
    }

    if (score >= TARGET_SCORE) {
        showOverlay('🎉 You Win!', `You reached ${score} points with ${movesLeft} moves left.`);
        locked = false;
        return true;
    }

    if (movesLeft <= 0) {
        showOverlay('💔 Out of Moves', `You scored ${score}. Target was ${TARGET_SCORE}.`);
        locked = false;
        return true;
    }

    const possibleMoves = findPossibleMoves();
    if (possibleMoves.length === 0) {
        shuffleBoard(true);
    }

    locked = false;
    return true;
}

async function onCellClick(r, c) {
    if (Date.now() < suppressClickUntil) return;
    if (locked || movesLeft <= 0 || score >= TARGET_SCORE) return;

    clearHint();
    const clicked = { r, c };

    if (!selectedCell) {
        selectedCell = clicked;
        render();
        return;
    }

    if (selectedCell.r === r && selectedCell.c === c) {
        selectedCell = null;
        render();
        return;
    }

    if (!isAdjacent(selectedCell, clicked)) {
        selectedCell = clicked;
        render();
        return;
    }

    const first = selectedCell;
    await trySwap(first, clicked);
}

function onTouchStart(event) {
    if (locked || movesLeft <= 0 || score >= TARGET_SCORE) return;
    const t = event.touches[0];
    if (!t) return;
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const startCell = getCellFromElement(el);
    if (!startCell) return;
    touchStart = { ...startCell, x: t.clientX, y: t.clientY };
}

async function onTouchEnd(event) {
    if (!touchStart) return;
    const t = event.changedTouches[0];
    if (!t) {
        touchStart = null;
        return;
    }

    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const minSwipe = 18;
    const start = { r: touchStart.r, c: touchStart.c };
    touchStart = null;

    if (absX < minSwipe && absY < minSwipe) return;

    let dr = 0;
    let dc = 0;
    if (absX > absY) {
        dc = dx > 0 ? 1 : -1;
    } else {
        dr = dy > 0 ? 1 : -1;
    }

    const target = { r: start.r + dr, c: start.c + dc };
    if (target.r < 0 || target.r >= ROWS || target.c < 0 || target.c >= COLS) return;

    suppressClickUntil = Date.now() + 350;
    event.preventDefault();
    await trySwap(start, target);
}

function shuffleBoard(auto = false) {
    if (locked) return;

    const candies = board.flat();
    let attempts = 0;
    do {
        attempts++;
        for (let i = candies.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candies[i], candies[j]] = [candies[j], candies[i]];
        }
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                board[r][c] = candies[r * COLS + c];
            }
        }
    } while ((findMatches().length > 0 || findPossibleMoves().length === 0) && attempts < 40);

    clearHint();
    selectedCell = null;
    render();
    setMessage(auto ? 'No moves left on board, shuffled automatically.' : 'Board shuffled.');
}

function showHint() {
    if (locked) return;
    const possibleMoves = findPossibleMoves();
    if (possibleMoves.length === 0) {
        shuffleBoard(true);
        return;
    }

    const [a, b] = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    hintCells = [a, b];
    render();
    setMessage('Hint: try swapping the highlighted candies.');
}

function startNewGame() {
    score = 0;
    movesLeft = START_MOVES;
    bestCombo = 1;
    selectedCell = null;
    clearHint();
    locked = false;
    hideOverlay();
    generateStartingBoard();
    updateHUD();
    render();
    setMessage('Make your first swap.');
}

document.getElementById('newGameBtn').addEventListener('click', startNewGame);
document.getElementById('hintBtn').addEventListener('click', showHint);
document.getElementById('shuffleBtn').addEventListener('click', () => shuffleBoard(false));
document.getElementById('playAgainBtn').addEventListener('click', startNewGame);
boardEl.addEventListener('touchstart', onTouchStart, { passive: true });
boardEl.addEventListener('touchend', onTouchEnd, { passive: false });

startNewGame();

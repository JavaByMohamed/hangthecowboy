// ── Sudoku Generator & Game Logic ──

let solution = [];
let puzzle = [];
let notes = Array.from({ length: 81 }, () => new Set());
let selectedCell = null;
let notesMode = false;
let mistakes = 0;
const maxMistakes = 3;
let timerInterval = null;
let seconds = 0;

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function isValid(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
        if (board[row][i] === num || board[i][col] === num) return false;
    }
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++)
        for (let c = bc; c < bc + 3; c++)
            if (board[r][c] === num) return false;
    return true;
}

function solve(board) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                const nums = shuffle([1,2,3,4,5,6,7,8,9]);
                for (const n of nums) {
                    if (isValid(board, r, c, n)) {
                        board[r][c] = n;
                        if (solve(board)) return true;
                        board[r][c] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function generatePuzzle(difficulty) {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    solve(board);
    solution = board.map(r => [...r]);

    const clues = { easy: 42, medium: 32, hard: 24 }[difficulty] || 32;
    const cells = shuffle([...Array(81).keys()]);
    const remove = 81 - clues;
    const p = board.map(r => [...r]);
    for (let i = 0; i < remove; i++) {
        const idx = cells[i];
        p[Math.floor(idx / 9)][idx % 9] = 0;
    }
    return p;
}

function newGame() {
    const diff = document.getElementById('difficulty').value;
    puzzle = generatePuzzle(diff);
    notes = Array.from({ length: 81 }, () => new Set());
    mistakes = 0;
    selectedCell = null;
    notesMode = false;
    document.getElementById('notesBtn').textContent = '📝 Notes: OFF';
    document.getElementById('notesBtn').classList.remove('active');
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('mistakes').textContent = `❌ Mistakes: 0/${maxMistakes}`;
    startTimer();
    renderBoard();
}

function startTimer() {
    clearInterval(timerInterval);
    seconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => { seconds++; updateTimerDisplay(); }, 1000);
}

function updateTimerDisplay() {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    document.getElementById('timer').textContent = `⏱️ ${m}:${s}`;
}

function updateNumberPad() {
    for (let num = 1; num <= 9; num++) {
        let count = 0;
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (puzzle[r][c] === num && puzzle[r][c] === solution[r][c]) count++;
        const btn = document.querySelector(`.num-btn[data-num="${num}"]`);
        if (btn) {
            btn.disabled = count >= 9;
            btn.classList.toggle('completed', count >= 9);
        }
    }
}

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            if ((c + 1) % 3 === 0 && c < 8) cell.classList.add('border-right');
            if ((r + 1) % 3 === 0 && r < 8) cell.classList.add('border-bottom');

            const val = puzzle[r][c];
            if (val !== 0) {
                cell.textContent = val;
                cell.classList.add('given');
            } else {
                const idx = r * 9 + c;
                if (notes[idx].size > 0) {
                    const notesDiv = document.createElement('div');
                    notesDiv.className = 'notes';
                    for (let n = 1; n <= 9; n++) {
                        const span = document.createElement('span');
                        span.textContent = notes[idx].has(n) ? n : '';
                        notesDiv.appendChild(span);
                    }
                    cell.appendChild(notesDiv);
                }
            }

            cell.addEventListener('click', () => selectCell(r, c));
            board.appendChild(cell);
        }
    }
    highlightCells();
    updateNumberPad();
}

function selectCell(r, c) {
    selectedCell = { r, c };
    highlightCells();
}

function highlightCells() {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('selected', 'highlighted', 'same-number');
    });
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    const selVal = puzzle[r][c];

    document.querySelectorAll('.cell').forEach(cell => {
        const cr = +cell.dataset.row, cc = +cell.dataset.col;
        if (cr === r && cc === c) {
            cell.classList.add('selected');
        } else if (cr === r || cc === c ||
            (Math.floor(cr/3) === Math.floor(r/3) && Math.floor(cc/3) === Math.floor(c/3))) {
            cell.classList.add('highlighted');
        }
        if (selVal !== 0 && puzzle[cr][cc] === selVal && !(cr === r && cc === c)) {
            cell.classList.add('same-number');
        }
    });
}

function selectNumber(num) {
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    if (puzzle[r][c] !== 0 && document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`).classList.contains('given')) return;

    const idx = r * 9 + c;

    if (notesMode) {
        if (notes[idx].has(num)) notes[idx].delete(num);
        else notes[idx].add(num);
        puzzle[r][c] = 0;
        renderBoard();
        return;
    }

    notes[idx].clear();

    if (num === solution[r][c]) {
        puzzle[r][c] = num;
        renderBoard();
        const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        if (cell) { cell.classList.add('correct-flash'); }
        checkWin();
    } else {
        puzzle[r][c] = num;
        mistakes++;
        document.getElementById('mistakes').textContent = `❌ Mistakes: ${mistakes}/${maxMistakes}`;
        renderBoard();
        const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        if (cell) cell.classList.add('error');
        if (mistakes >= maxMistakes) {
            clearInterval(timerInterval);
            document.getElementById('overlayTitle').textContent = '😞 Game Over';
            document.getElementById('overlayMsg').textContent = 'You made too many mistakes!';
            document.getElementById('overlay').classList.remove('hidden');
        }
    }
}

function eraseCell() {
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    if (document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`)?.classList.contains('given')) return;
    puzzle[r][c] = 0;
    notes[r * 9 + c].clear();
    renderBoard();
}

function toggleNotes() {
    notesMode = !notesMode;
    const btn = document.getElementById('notesBtn');
    btn.textContent = notesMode ? '📝 Notes: ON' : '📝 Notes: OFF';
    btn.classList.toggle('active', notesMode);
}

function getHint() {
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    if (puzzle[r][c] === solution[r][c]) return;
    puzzle[r][c] = solution[r][c];
    notes[r * 9 + c].clear();
    renderBoard();
    checkWin();
}

function checkWin() {
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (puzzle[r][c] !== solution[r][c]) return;
    clearInterval(timerInterval);
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    document.getElementById('overlayTitle').textContent = '🎉 You Won!';
    document.getElementById('overlayMsg').textContent = `Completed in ${m}:${s}`;
    document.getElementById('overlay').classList.remove('hidden');
}

// Keyboard support
document.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9) selectNumber(num);
    if (e.key === 'Backspace' || e.key === 'Delete') eraseCell();
    if (e.key === 'n' || e.key === 'N') toggleNotes();
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    if (e.key === 'ArrowUp' && r > 0) selectCell(r - 1, c);
    if (e.key === 'ArrowDown' && r < 8) selectCell(r + 1, c);
    if (e.key === 'ArrowLeft' && c > 0) selectCell(r, c - 1);
    if (e.key === 'ArrowRight' && c < 8) selectCell(r, c + 1);
});

// Start on load
newGame();


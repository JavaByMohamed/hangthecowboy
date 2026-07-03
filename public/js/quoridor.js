const socket = io();

// Game state
let gameMode = null;
let myColor = null;
let gameId = null;
let isMyTurn = false;
let gameEnded = false;
let pendingWallSelection = null;
let isPrivateGame = false;
let matchmakingType = null; // 'random' | 'create-private' | 'join-private'

// Board state
let pawns = { blue: {r:0, c:4}, red: {r:8, c:4} };
let walls = [];  // Each wall: {r, c, o} - covers 2 slots
let wallsLeft = { blue: 10, red: 10 };
let currentTurn = 'blue';

// Socket events
socket.on('game-joined-quoridor', (data) => {
    gameId = data.gameId;
    if (data.assignedColor) myColor = data.assignedColor;
    if (data.game) syncState(data.game);
    document.getElementById('colorPhase').classList.add('hidden');
    document.getElementById('multiplayerOptionsPhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.remove('hidden');
    const waitingTitle = document.getElementById('waitingTitle');
    if (waitingTitle) waitingTitle.textContent = `You are ${myColor === 'blue' ? '🔵 Blue' : '🔴 Red'} - Waiting for opponent...`;
    const waitingContent = document.getElementById('waitingContent');
    if (waitingContent) {
        if (isPrivateGame && matchmakingType === 'create-private' && data.game && data.game.inviteCode) {
            InviteSystem.inviteCode = data.game.inviteCode;
            InviteSystem.gameId = data.gameId;
            InviteSystem.renderWaitingWithCode('waitingContent', `You are ${myColor === 'blue' ? '🔵 Blue' : '🔴 Red'}`);
        } else {
            waitingContent.innerHTML = '<div class="spinner"></div><p>Looking for another player to join</p>';
        }
    }
});

socket.on('game-started-quoridor', (data) => {
    document.getElementById('multiplayerOptionsPhase').classList.add('hidden');
    document.getElementById('colorPhase').classList.add('hidden');
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('gamePhase').classList.remove('hidden');
    syncState(data.game);
    render();
});

socket.on('move-made-quoridor', (data) => {
    syncState(data.game);
    render();
});

socket.on('wall-placed-quoridor', (data) => {
    syncState(data.game);
    render();
});

socket.on('game-ended-quoridor', (data) => {
    syncState(data.game);
    gameEnded = true;
    render();
    showResult(data.game.winner);
});

socket.on('opponent-quit-quoridor', () => {
    gameEnded = true;
    showResult(myColor);
});

function syncState(g) {
    pawns = g.pawns;
    walls = g.walls;
    wallsLeft = g.wallsRemaining;
    currentTurn = g.currentTurn;
    isMyTurn = currentTurn === myColor;
    gameEnded = g.gameEnded;
    pendingWallSelection = null;
}

// UI Functions
function selectMode(mode) {
    gameMode = mode;
    document.getElementById('modePhase').classList.add('hidden');
    if (mode === 'multiplayer') {
        document.getElementById('multiplayerOptionsPhase').classList.remove('hidden');
        initInviteSystem();
    } else {
        document.getElementById('colorPhase').classList.remove('hidden');
    }
}

function initInviteSystem() {
    InviteSystem.init({ gameType: 'quoridor' });
    InviteSystem.renderInviteOptions(
        'inviteOptionsContainer',
        () => {
            matchmakingType = 'random';
            isPrivateGame = false;
            document.getElementById('multiplayerOptionsPhase').classList.add('hidden');
            document.getElementById('colorPhase').classList.remove('hidden');
        },
        () => {
            matchmakingType = 'create-private';
            isPrivateGame = true;
            document.getElementById('multiplayerOptionsPhase').classList.add('hidden');
            document.getElementById('colorPhase').classList.remove('hidden');
        },
        (code) => {
            matchmakingType = 'join-private';
            isPrivateGame = true;
            InviteSystem.joinByCode(code, {}, (response) => {
                if (!response.success) return;
                gameId = response.gameId;
                myColor = response.assignedColor || (response.game.players[0].color === 'blue' ? 'red' : 'blue');
                if (response.game && response.game.state === 'playing') {
                    document.getElementById('waitingPhase').classList.add('hidden');
                    document.getElementById('multiplayerOptionsPhase').classList.add('hidden');
                    document.getElementById('colorPhase').classList.add('hidden');
                    document.getElementById('gamePhase').classList.remove('hidden');
                    syncState(response.game);
                    render();
                    if (typeof showChatWidget === 'function') showChatWidget(true);
                } else {
                    document.getElementById('multiplayerOptionsPhase').classList.add('hidden');
                    document.getElementById('waitingPhase').classList.remove('hidden');
                    const waitingTitle = document.getElementById('waitingTitle');
                    if (waitingTitle) waitingTitle.textContent = `You are ${myColor === 'blue' ? '🔵 Blue' : '🔴 Red'} - Joined game!`;
                    const waitingContent = document.getElementById('waitingContent');
                    if (waitingContent) waitingContent.innerHTML = '<div class="spinner"></div><p>Waiting for game to start...</p>';
                }
            });
        }
    );
}

function selectColor(color) {
    myColor = color;
    document.getElementById('colorPhase').classList.add('hidden');
    
    if (gameMode === 'solo') {
        document.getElementById('gamePhase').classList.remove('hidden');
        initSoloGame();
    } else {
        if (isPrivateGame && matchmakingType === 'create-private') {
            InviteSystem.createPrivateGame({ color: myColor }, (response) => {
                gameId = response.gameId;
                document.getElementById('waitingPhase').classList.remove('hidden');
                const waitingTitle = document.getElementById('waitingTitle');
                if (waitingTitle) waitingTitle.textContent = `You are ${myColor === 'blue' ? '🔵 Blue' : '🔴 Red'}`;
                InviteSystem.renderWaitingWithCode('waitingContent', `You are ${myColor === 'blue' ? '🔵 Blue' : '🔴 Red'}`);
            });
        } else {
            document.getElementById('waitingPhase').classList.remove('hidden');
            socket.emit('join-game-quoridor', { color: myColor });
        }
    }
}

function initSoloGame() {
    pawns = { blue: {r:0, c:4}, red: {r:8, c:4} };
    walls = [];
    wallsLeft = { blue: 10, red: 10 };
    currentTurn = 'blue';
    isMyTurn = myColor === 'blue';
    gameEnded = false;
    pendingWallSelection = null;
    render();
    
    if (!isMyTurn) setTimeout(aiMove, 600);
}

function quitGame() {
    if (gameId) socket.emit('quit-game-quoridor', { gameId });
    window.location.href = '/';
}

function getWallSlotIndex(slotR, slotC, orientation) {
    if (orientation === 'h') {
        return (slotR * 2 + 1) * 17 + (slotC * 2);
    }
    return (slotR * 2) * 17 + (slotC * 2 + 1);
}

function highlightWallSlot(slotR, slotC, orientation, className) {
    const board = document.getElementById('board');
    const idx = getWallSlotIndex(slotR, slotC, orientation);
    if (board.children[idx]) {
        board.children[idx].classList.add(className);
    }
}

function isAdjacentWallSegment(a, b) {
    if (a.o !== b.o) return false;

    if (a.o === 'h') {
        return a.r === b.r && Math.abs(a.c - b.c) === 1;
    }
    return a.c === b.c && Math.abs(a.r - b.r) === 1;
}

function getWallFromSegments(a, b) {
    if (a.o === 'h') {
        return { wallR: a.r, wallC: Math.min(a.c, b.c), o: 'h' };
    }
    return { wallR: Math.min(a.r, b.r), wallC: a.c, o: 'v' };
}

// Wall preview on hover
function showWallPreview(slotR, slotC, slotOrientation) {
    if (!isMyTurn || gameEnded) return;
    if (wallsLeft[currentTurn] <= 0) return;

    clearWallPreview();

    if (getWallSegmentOwner(slotR, slotC, slotOrientation) !== null) {
        highlightWallSlot(slotR, slotC, slotOrientation, 'preview-invalid');
        return;
    }

    if (!pendingWallSelection) {
        highlightWallSlot(slotR, slotC, slotOrientation, 'preview');
        return;
    }

    if (pendingWallSelection.o !== slotOrientation || !isAdjacentWallSegment(pendingWallSelection, { r: slotR, c: slotC, o: slotOrientation })) {
        highlightWallSlot(slotR, slotC, slotOrientation, 'preview-invalid');
        return;
    }

    const { wallR, wallC, o } = getWallFromSegments(pendingWallSelection, { r: slotR, c: slotC, o: slotOrientation });
    const previewClass = canPlaceWall(wallR, wallC, o) ? 'preview' : 'preview-invalid';
    highlightWallSlot(pendingWallSelection.r, pendingWallSelection.c, pendingWallSelection.o, previewClass);
    highlightWallSlot(slotR, slotC, slotOrientation, previewClass);
}

function clearWallPreview() {
    document.querySelectorAll('.preview, .preview-invalid').forEach(el => {
        el.classList.remove('preview', 'preview-invalid');
    });
}

// Check if a wall segment is covered by any wall
function getWallSegmentOwner(row, col, orientation) {
    for (const w of walls) {
        if (w.o !== orientation) continue;
        if (orientation === 'h') {
            // Horizontal wall at (w.r, w.c) covers slots (w.r, w.c) and (w.r, w.c+1)
            if (w.r === row && (w.c === col || w.c === col - 1)) return w.color || null;
        } else {
            // Vertical wall at (w.r, w.c) covers slots (w.r, w.c) and (w.r+1, w.c)
            if (w.c === col && (w.r === row || w.r === row - 1)) return w.color || null;
        }
    }
    return null;
}

// Board rendering
function render() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    for (let row = 0; row < 17; row++) {
        for (let col = 0; col < 17; col++) {
            const div = document.createElement('div');
            
            if (row % 2 === 0 && col % 2 === 0) {
                // Cell
                const r = row / 2, c = col / 2;
                div.className = 'cell';

                // Add pawn if present
                if (pawns.blue.r === r && pawns.blue.c === c) {
                    const pawn = document.createElement('div');
                    pawn.className = 'pawn blue';
                    div.appendChild(pawn);
                }
                if (pawns.red.r === r && pawns.red.c === c) {
                    const pawn = document.createElement('div');
                    pawn.className = 'pawn red';
                    div.appendChild(pawn);
                }
                
                // Highlight valid moves
                if (isMyTurn && !gameEnded) {
                    const validMoves = getValidMoves(pawns[myColor].r, pawns[myColor].c, myColor);
                    if (validMoves.some(m => m.r === r && m.c === c)) {
                        div.classList.add('valid-move');
                    }
                }

                div.onclick = () => onCellClick(r, c);

            } else if (row % 2 === 0 && col % 2 === 1) {
                // Vertical wall slot (between cells horizontally)
                div.className = 'wall-v';
                const slotR = row / 2;
                const slotC = (col - 1) / 2;

                const wallOwner = getWallSegmentOwner(slotR, slotC, 'v');
                if (wallOwner !== null) {
                    div.classList.add('placed');
                    div.classList.add(wallOwner === 'blue' ? 'placed-blue' : 'placed-red');
                }
                if (pendingWallSelection && pendingWallSelection.o === 'v' && pendingWallSelection.r === slotR && pendingWallSelection.c === slotC) {
                    div.classList.add('selected');
                }

                div.onclick = () => onWallSlotClick(slotR, slotC, 'v');
                div.onmouseenter = () => showWallPreview(slotR, slotC, 'v');
                div.onmouseleave = clearWallPreview;

            } else if (row % 2 === 1 && col % 2 === 0) {
                // Horizontal wall slot (between cells vertically)
                div.className = 'wall-h';
                const slotR = (row - 1) / 2;
                const slotC = col / 2;

                const wallOwner = getWallSegmentOwner(slotR, slotC, 'h');
                if (wallOwner !== null) {
                    div.classList.add('placed');
                    div.classList.add(wallOwner === 'blue' ? 'placed-blue' : 'placed-red');
                }
                if (pendingWallSelection && pendingWallSelection.o === 'h' && pendingWallSelection.r === slotR && pendingWallSelection.c === slotC) {
                    div.classList.add('selected');
                }

                div.onclick = () => onWallSlotClick(slotR, slotC, 'h');
                div.onmouseenter = () => showWallPreview(slotR, slotC, 'h');
                div.onmouseleave = clearWallPreview;

            } else {
                // Corner
                div.className = 'wall-corner';
                div.onmouseleave = clearWallPreview;
            }
            
            board.appendChild(div);
        }
    }
    
    // Update UI
    document.getElementById('blueWalls').textContent = `🔵 Walls: ${wallsLeft.blue}`;
    document.getElementById('redWalls').textContent = `🔴 Walls: ${wallsLeft.red}`;

    const indicator = document.getElementById('turnIndicator');
    if (gameEnded) {
        indicator.textContent = 'Game Over';
        indicator.className = 'turn-indicator';
    } else if (isMyTurn) {
        indicator.textContent = '🎯 Your Turn';
        indicator.className = 'turn-indicator your-turn';
    } else {
        indicator.textContent = '⏳ Opponent\'s Turn';
        indicator.className = 'turn-indicator opponent-turn';
    }
}

function onCellClick(r, c) {
    if (!isMyTurn || gameEnded) return;

    const validMoves = getValidMoves(pawns[myColor].r, pawns[myColor].c, myColor);
    if (!validMoves.some(m => m.r === r && m.c === c)) return;

    pendingWallSelection = null;
    clearWallPreview();

    if (gameMode === 'solo') {
        pawns[myColor] = {r, c};
        
        const goalRow = myColor === 'blue' ? 8 : 0;
        if (r === goalRow) {
            gameEnded = true;
            render();
            showResult(myColor);
            return;
        }
        
        currentTurn = currentTurn === 'blue' ? 'red' : 'blue';
        isMyTurn = false;
        render();
        setTimeout(aiMove, 600);
    } else {
        socket.emit('make-move-quoridor', { gameId, row: r, col: c });
    }
}

function onWallSlotClick(slotR, slotC, slotOrientation) {
    if (!isMyTurn || gameEnded) return;
    if (wallsLeft[currentTurn] <= 0) return;

    if (getWallSegmentOwner(slotR, slotC, slotOrientation) !== null) return;

    const clicked = { r: slotR, c: slotC, o: slotOrientation };

    // Tap again on the first selected segment to cancel.
    if (
        pendingWallSelection &&
        pendingWallSelection.r === clicked.r &&
        pendingWallSelection.c === clicked.c &&
        pendingWallSelection.o === clicked.o
    ) {
        pendingWallSelection = null;
        clearWallPreview();
        render();
        return;
    }

    if (!pendingWallSelection) {
        pendingWallSelection = clicked;
        render();
        return;
    }

    if (pendingWallSelection.o !== clicked.o || !isAdjacentWallSegment(pendingWallSelection, clicked)) {
        pendingWallSelection = clicked;
        clearWallPreview();
        render();
        return;
    }

    const { wallR, wallC, o } = getWallFromSegments(pendingWallSelection, clicked);
    pendingWallSelection = null;
    clearWallPreview();

    if (!canPlaceWall(wallR, wallC, o)) {
        render();
        return;
    }

    if (gameMode === 'solo') {
        walls.push({r: wallR, c: wallC, o, color: currentTurn});
        wallsLeft[currentTurn]--;
        currentTurn = currentTurn === 'blue' ? 'red' : 'blue';
        isMyTurn = false;
        render();
        setTimeout(aiMove, 600);
    } else {
        socket.emit('place-wall-quoridor', { gameId, row: wallR, col: wallC, orientation: o });
    }
}

function canPlaceWall(r, c, o) {
    // Boundary check - wall must fit within board
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    
    // Check exact overlap
    if (walls.some(w => w.r === r && w.c === c && w.o === o)) return false;

    // Prevent partial overlap with a same-orientation wall.
    // Example: an existing horizontal wall at c=3 occupies segments 3 and 4,
    // so another horizontal wall at c=4 would illegally overlap segment 4 and
    // visually look like a single extra segment was placed.
    if (o === 'h' && walls.some(w => w.o === 'h' && w.r === r && Math.abs(w.c - c) === 1)) return false;
    if (o === 'v' && walls.some(w => w.o === 'v' && w.c === c && Math.abs(w.r - r) === 1)) return false;

    // Check cross intersection at center point
    if (walls.some(w => w.r === r && w.c === c && w.o !== o)) return false;
    
    // Path check - both players must still be able to reach goal
    walls.push({r, c, o, color: currentTurn});
    const blueOk = canReach('blue');
    const redOk = canReach('red');
    walls.pop();
    
    return blueOk && redOk;
}

function canReach(color) {
    const start = pawns[color];
    const goalRow = color === 'blue' ? 8 : 0;
    const visited = new Set();
    const queue = [{r: start.r, c: start.c}];
    
    while (queue.length) {
        const {r, c} = queue.shift();
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        visited.add(key);
        
        if (r === goalRow) return true;
        
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && !isBlocked(r, c, nr, nc)) {
                queue.push({r: nr, c: nc});
            }
        }
    }
    return false;
}

function isBlocked(r1, c1, r2, c2) {
    const dr = r2 - r1, dc = c2 - c1;
    
    for (const w of walls) {
        if (w.o === 'h') {
            // Horizontal wall at (w.r, w.c) blocks movement between rows w.r and w.r+1
            // at columns w.c and w.c+1
            if (dr === 1 && r1 === w.r && (c1 === w.c || c1 === w.c + 1)) return true;
            if (dr === -1 && r2 === w.r && (c2 === w.c || c2 === w.c + 1)) return true;
        } else {
            // Vertical wall at (w.r, w.c) blocks movement between cols w.c and w.c+1
            // at rows w.r and w.r+1
            if (dc === 1 && c1 === w.c && (r1 === w.r || r1 === w.r + 1)) return true;
            if (dc === -1 && c2 === w.c && (r2 === w.r || r2 === w.r + 1)) return true;
        }
    }
    return false;
}

function getValidMoves(r, c, forColor) {
    const moves = [];
    const opponent = forColor === 'blue' ? 'red' : 'blue';
    
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
        if (isBlocked(r, c, nr, nc)) continue;
        
        if (pawns[opponent].r === nr && pawns[opponent].c === nc) {
            // Jump over opponent
            const jr = nr + dr, jc = nc + dc;
            if (jr >= 0 && jr <= 8 && jc >= 0 && jc <= 8 && !isBlocked(nr, nc, jr, jc)) {
                moves.push({r: jr, c: jc});
            } else {
                // Diagonal moves when can't jump straight
                for (const [ddr, ddc] of (dr === 0 ? [[-1,0],[1,0]] : [[0,-1],[0,1]])) {
                    const diagR = nr + ddr, diagC = nc + ddc;
                    if (diagR >= 0 && diagR <= 8 && diagC >= 0 && diagC <= 8 && !isBlocked(nr, nc, diagR, diagC)) {
                        moves.push({r: diagR, c: diagC});
                    }
                }
            }
        } else {
            moves.push({r: nr, c: nc});
        }
    }
    return moves;
}

// Calculate shortest path length using BFS
function pathLength(startR, startC, goalRow) {
    const visited = new Set();
    const queue = [{r: startR, c: startC, dist: 0}];
    
    while (queue.length) {
        const {r, c, dist} = queue.shift();
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        visited.add(key);
        
        if (r === goalRow) return dist;
        
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && !isBlocked(r, c, nr, nc)) {
                queue.push({r: nr, c: nc, dist: dist + 1});
            }
        }
    }
    return 999;
}

// AI with wall placement strategy
function aiMove() {
    if (gameEnded) return;
    
    const aiColor = myColor === 'blue' ? 'red' : 'blue';
    const playerColor = myColor;
    const aiPawn = pawns[aiColor];
    const playerPawn = pawns[playerColor];
    const aiGoal = aiColor === 'blue' ? 8 : 0;
    const playerGoal = playerColor === 'blue' ? 8 : 0;
    
    const aiPathLen = pathLength(aiPawn.r, aiPawn.c, aiGoal);
    const playerPathLen = pathLength(playerPawn.r, playerPawn.c, playerGoal);
    
    // AI places walls more aggressively
    // - Always consider placing walls if AI has walls left
    // - Higher chance when player is ahead or close to goal
    let wallChance = 0.3; // Base 30% chance
    if (playerPathLen < aiPathLen) wallChance = 0.6; // 60% if player ahead
    if (playerPathLen <= 3) wallChance = 0.8; // 80% if player close to winning
    
    if (wallsLeft[aiColor] > 0 && Math.random() < wallChance) {
        const bestWall = findBestWall(aiColor, playerColor);
        if (bestWall) {
            walls.push({ ...bestWall, color: aiColor });
            wallsLeft[aiColor]--;
            currentTurn = playerColor;
            isMyTurn = true;
            render();
            return;
        }
    }
    
    // Move towards goal
    const moves = getValidMoves(aiPawn.r, aiPawn.c, aiColor);
    
    let bestMove = null;
    let bestDist = Infinity;
    
    for (const m of moves) {
        const dist = pathLength(m.r, m.c, aiGoal);
        if (dist < bestDist) {
            bestDist = dist;
            bestMove = m;
        }
    }
    
    if (bestMove) {
        pawns[aiColor] = bestMove;
        
        if (bestMove.r === aiGoal) {
            gameEnded = true;
            render();
            showResult(aiColor);
            return;
        }
    }
    
    currentTurn = playerColor;
    isMyTurn = true;
    render();
}

function findBestWall(aiColor, playerColor) {
    const playerPawn = pawns[playerColor];
    const playerGoal = playerColor === 'blue' ? 8 : 0;
    const currentPlayerPath = pathLength(playerPawn.r, playerPawn.c, playerGoal);
    
    let bestWall = null;
    let bestIncrease = 0;
    
    // Try walls near the player's current position (more strategic)
    const nearbyPositions = [];
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            const r = playerPawn.r + dr;
            const c = playerPawn.c + dc;
            if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                nearbyPositions.push({r, c});
            }
        }
    }
    
    // Also add some random positions
    for (let i = 0; i < 10; i++) {
        nearbyPositions.push({
            r: Math.floor(Math.random() * 8),
            c: Math.floor(Math.random() * 8)
        });
    }
    
    // Try each position with both orientations
    for (const pos of nearbyPositions) {
        for (const o of ['h', 'v']) {
            if (!canPlaceWall(pos.r, pos.c, o)) continue;
            
            walls.push({r: pos.r, c: pos.c, o, color: aiColor});
            const newPlayerPath = pathLength(playerPawn.r, playerPawn.c, playerGoal);
            walls.pop();
            
            const increase = newPlayerPath - currentPlayerPath;
            if (increase > bestIncrease) {
                bestIncrease = increase;
                bestWall = {r: pos.r, c: pos.c, o};
            }
        }
    }
    
    // Accept any wall that increases path by at least 1
    return bestIncrease >= 1 ? bestWall : null;
}

function showResult(winner) {
    const msg = document.getElementById('statusMsg');
    msg.classList.remove('hidden');
    if (winner === myColor) {
        msg.className = 'status-msg win';
        msg.textContent = '🎉 You Win!';
    } else {
        msg.className = 'status-msg lose';
        msg.textContent = '😔 You Lose!';
    }
}

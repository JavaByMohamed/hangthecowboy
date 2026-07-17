// Paint Game Module
let gameMode = ''; // 'solo' or 'multiplayer'
let gameId = null;
let playerId = null;
let currentPhase = 'mode-selection'; // mode-selection, multiplayerOptions, game

let canvas;
let ctx;

const socket = io({
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});

// Initialize canvas when DOM is ready
function initCanvas() {
    console.log('📐 Initializing canvas...');
    canvas = document.getElementById('paintCanvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        console.log('✓ Canvas initialized with 2D context');
        attachCanvasEventListeners();
        window.addEventListener('resize', resizeCanvasToDisplay);
        window.addEventListener('orientationchange', resizeCanvasToDisplay);
        console.log('✓ Canvas event listeners attached');
    } else {
        console.error('❌ Canvas element not found!');
    }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCanvas);
} else {
    initCanvas();
}

// Keep-alive: ping /health every 4 min to prevent hosting platform from sleeping
setInterval(() => fetch('/health').catch(() => {}), 4 * 60 * 1000);

// Reconnection overlay
(function() {
    const overlay = document.createElement('div');
    overlay.id = 'reconnect-overlay';
    overlay.innerHTML = '<div style="background:rgba(0,0,0,0.85);color:#fff;position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:99999;flex-direction:column;font-family:sans-serif"><div style="font-size:48px;margin-bottom:20px">⚡</div><div style="font-size:22px;margin-bottom:10px">Connection lost</div><div id="reconnect-status" style="font-size:16px;color:#aaa">Reconnecting...</div></div>';
    overlay.style.display = 'none';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
    socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        overlay.style.display = 'block';
        const status = document.getElementById('reconnect-status');
        if (status) status.textContent = 'Reconnecting...';
    });
    socket.io.on('reconnect_attempt', (attempt) => {
        const status = document.getElementById('reconnect-status');
        if (status) status.textContent = `Reconnecting... attempt ${attempt}`;
    });
    socket.io.on('reconnect_failed', () => {
        const status = document.getElementById('reconnect-status');
        if (status) status.textContent = 'Could not reconnect. Please refresh the page.';
    });
    socket.on('connect', () => {
        console.log('Connected:', socket.id, 'transport:', socket.io.engine.transport.name);
        overlay.style.display = 'none';
    });
})();

// Game state
let gameState = {
    tool: 'brush',
    color: '#000000',
    brushSize: 5,
    isDrawing: false,
    startX: 0,
    startY: 0,
    history: [],
    maxHistory: 50,
    currentPicture: ''
};

// ==================== CANVAS DRAWING ====================

function saveState() {
    if (gameState.history.length >= gameState.maxHistory) {
        gameState.history.shift();
    }
    gameState.history.push(canvas.toDataURL());
}

function restoreState(imageData) {
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = imageData;
}

function undo() {
    if (gameState.history.length > 0) {
        restoreState(gameState.history.pop());
    }
}

function clearCanvas() {
    saveState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameMode === 'multiplayer' && gameId) {
        socket.emit('clear-canvas', { gameId });
    }
}

function drawBrush(x, y) {
    ctx.fillStyle = gameState.color;
    ctx.beginPath();
    ctx.arc(x, y, gameState.brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawEraser(x, y) {
    ctx.clearRect(x - gameState.brushSize / 2, y - gameState.brushSize / 2, gameState.brushSize, gameState.brushSize);
}

function drawLine(fromX, fromY, toX, toY) {
    ctx.strokeStyle = gameState.color;
    ctx.lineWidth = gameState.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
}

function drawCircle(centerX, centerY, radiusX, radiusY) {
    ctx.strokeStyle = gameState.color;
    ctx.lineWidth = gameState.brushSize;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, Math.abs(radiusX), Math.abs(radiusY), 0, 0, Math.PI * 2);
    ctx.stroke();
}

function drawRectangle(startX, startY, endX, endY) {
    ctx.strokeStyle = gameState.color;
    ctx.lineWidth = gameState.brushSize;
    const width = endX - startX;
    const height = endY - startY;
    ctx.strokeRect(startX, startY, width, height);
}

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY;

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function normalizeX(x) {
    return canvas.width > 0 ? x / canvas.width : 0;
}

function normalizeY(y) {
    return canvas.height > 0 ? y / canvas.height : 0;
}

function denormalizeX(normalizedX) {
    return normalizedX * canvas.width;
}

function denormalizeY(normalizedY) {
    return normalizedY * canvas.height;
}

function resizeCanvasToDisplay() {
    if (!canvas || !ctx) return;

    const phaseElement = document.getElementById('gamePhase');
    if (!phaseElement || phaseElement.classList.contains('hidden')) return;

    const rect = canvas.getBoundingClientRect();
    const targetWidth = Math.round(rect.width);
    const targetHeight = Math.round(rect.height);

    if (!targetWidth || !targetHeight) return;
    if (canvas.width === targetWidth && canvas.height === targetHeight) return;

    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx = canvas.getContext('2d');

    if (snapshot.width > 0 && snapshot.height > 0) {
        ctx.drawImage(snapshot, 0, 0, targetWidth, targetHeight);
    }
}

// ==================== CANVAS EVENTS ====================

function startDrawing(e) {
    gameState.isDrawing = true;
    const coords = getCanvasCoords(e);
    gameState.startX = coords.x;
    gameState.startY = coords.y;
    saveState();

    if (gameState.tool === 'brush') {
        drawBrush(coords.x, coords.y);
        if (gameMode === 'multiplayer' && gameId) {
            socket.emit('draw-stroke', {
                gameId,
                x: coords.x,
                y: coords.y,
                normalizedX: normalizeX(coords.x),
                normalizedY: normalizeY(coords.y),
                tool: 'brush',
                color: gameState.color,
                brushSize: gameState.brushSize
            });
        }
    } else if (gameState.tool === 'eraser') {
        drawEraser(coords.x, coords.y);
        if (gameMode === 'multiplayer' && gameId) {
            socket.emit('draw-stroke', {
                gameId,
                x: coords.x,
                y: coords.y,
                normalizedX: normalizeX(coords.x),
                normalizedY: normalizeY(coords.y),
                tool: 'eraser',
                brushSize: gameState.brushSize
            });
        }
    }
}

function continueDrawing(e) {
    if (!gameState.isDrawing) return;

    const coords = getCanvasCoords(e);

    if (gameState.tool === 'brush') {
        drawBrush(coords.x, coords.y);
        if (gameMode === 'multiplayer' && gameId) {
            socket.emit('draw-stroke', {
                gameId,
                x: coords.x,
                y: coords.y,
                normalizedX: normalizeX(coords.x),
                normalizedY: normalizeY(coords.y),
                tool: 'brush',
                color: gameState.color,
                brushSize: gameState.brushSize
            });
        }
    } else if (gameState.tool === 'eraser') {
        drawEraser(coords.x, coords.y);
        if (gameMode === 'multiplayer' && gameId) {
            socket.emit('draw-stroke', {
                gameId,
                x: coords.x,
                y: coords.y,
                normalizedX: normalizeX(coords.x),
                normalizedY: normalizeY(coords.y),
                tool: 'eraser',
                brushSize: gameState.brushSize
            });
        }
    } else if (gameState.tool === 'line' || gameState.tool === 'circle' || gameState.tool === 'rect') {
        // Preview shapes while dragging
        restoreState(gameState.history[gameState.history.length - 1]);

        if (gameState.tool === 'line') {
            drawLine(gameState.startX, gameState.startY, coords.x, coords.y);
        } else if (gameState.tool === 'circle') {
            drawCircle(gameState.startX, gameState.startY, coords.x - gameState.startX, coords.y - gameState.startY);
        } else if (gameState.tool === 'rect') {
            drawRectangle(gameState.startX, gameState.startY, coords.x, coords.y);
        }
    }
}

function endDrawing(e) {
    if (!gameState.isDrawing) return;
    gameState.isDrawing = false;

    const coords = getCanvasCoords(e);

    // Handle shape tools on draw end
    if (gameState.tool === 'line') {
        if (gameMode === 'multiplayer' && gameId) {
            socket.emit('draw-shape', {
                gameId,
                type: 'line',
                x1: gameState.startX,
                y1: gameState.startY,
                x2: coords.x,
                y2: coords.y,
                normalizedX1: normalizeX(gameState.startX),
                normalizedY1: normalizeY(gameState.startY),
                normalizedX2: normalizeX(coords.x),
                normalizedY2: normalizeY(coords.y),
                color: gameState.color,
                brushSize: gameState.brushSize
            });
        }
    } else if (gameState.tool === 'circle') {
        if (gameMode === 'multiplayer' && gameId) {
            socket.emit('draw-shape', {
                gameId,
                type: 'circle',
                centerX: gameState.startX,
                centerY: gameState.startY,
                radiusX: coords.x - gameState.startX,
                radiusY: coords.y - gameState.startY,
                normalizedCenterX: normalizeX(gameState.startX),
                normalizedCenterY: normalizeY(gameState.startY),
                normalizedRadiusX: normalizeX(coords.x - gameState.startX),
                normalizedRadiusY: normalizeY(coords.y - gameState.startY),
                color: gameState.color,
                brushSize: gameState.brushSize
            });
        }
    } else if (gameState.tool === 'rect') {
        if (gameMode === 'multiplayer' && gameId) {
            socket.emit('draw-shape', {
                gameId,
                type: 'rect',
                x1: gameState.startX,
                y1: gameState.startY,
                x2: coords.x,
                y2: coords.y,
                normalizedX1: normalizeX(gameState.startX),
                normalizedY1: normalizeY(gameState.startY),
                normalizedX2: normalizeX(coords.x),
                normalizedY2: normalizeY(coords.y),
                color: gameState.color,
                brushSize: gameState.brushSize
            });
        }
    }
}

function attachCanvasEventListeners() {
    if (!canvas) return; // Safety check

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        canvas.setPointerCapture?.(e.pointerId);
        startDrawing(e);
    });

    canvas.addEventListener('pointermove', (e) => {
        e.preventDefault();
        continueDrawing(e);
    });

    canvas.addEventListener('pointerup', (e) => {
        e.preventDefault();
        endDrawing(e);
    });

    canvas.addEventListener('pointercancel', (e) => {
        e.preventDefault();
        endDrawing(e);
    });

    canvas.addEventListener('pointerleave', (e) => {
        if (gameState.isDrawing) {
            endDrawing(e);
        }
    });
}

// ==================== UI CONTROLS ====================

function selectMode(mode) {
    console.log('🎮 Mode selected:', mode);
    gameMode = mode;
    if (mode === 'solo') {
        console.log('🎯 Entering solo mode');
        currentPhase = 'game';
        showPhase('game');
    } else if (mode === 'multiplayer') {
        console.log('👥 Entering multiplayer mode');
        currentPhase = 'multiplayerOptions';
        showPhase('multiplayerOptions');
        initInviteSystem();
    }
}

function initInviteSystem() {
    console.log('🎨 Initializing InviteSystem for paint game');
    InviteSystem.init({ gameType: 'paint' });
    InviteSystem.renderInviteOptions(
        'inviteOptionsContainer',
        () => {
            console.log('🎲 Random match clicked - joining public matchmaking');
            const container = document.getElementById('inviteOptionsContainer');
            if (container) {
                container.innerHTML = `
                    <div class="waiting-message">
                        <div class="spinner"></div>
                        <p>Waiting for another random opponent to join...</p>
                    </div>
                `;
            }
            socket.emit('join-game-paint');
            showStatus('Looking for a random opponent...', 'info');
        },
        () => {
            console.log('🔗 Create private game clicked');
            InviteSystem.createPrivateGame({}, (response) => {
                console.log('📦 Create private game response:', response);
                if (response.success) {
                    gameId = response.gameId;
                    playerId = socket.id;
                    // Show the invite code display
                    InviteSystem.renderWaitingWithCode('inviteOptionsContainer', '🎨 Paint Room');
                    showStatus('Paint room created! Share the invite code with friends.', 'success');
                } else {
                    showStatus(`Error: ${response.error}`, 'error');
                }
            });
        },
        (code) => {
            console.log('🔑 Join by code clicked with code:', code);
            InviteSystem.joinByCode(code, {}, (response) => {
                console.log('📦 Join by code response:', response);
                if (response.success) {
                    gameId = response.gameId;
                    playerId = socket.id;
                    if (response.game && response.game.state === 'playing') {
                        currentPhase = 'game';
                        showPhase('game');
                        showStatus('Joined paint room!', 'success');
                    } else {
                        const container = document.getElementById('inviteOptionsContainer');
                        if (container) {
                            container.innerHTML = `
                                <div class="waiting-message">
                                    <div class="spinner"></div>
                                    <p>Joined room. Waiting for the host...</p>
                                </div>
                            `;
                        }
                        showStatus('Joined paint room. Waiting for start...', 'info');
                    }
                } else {
                    showStatus(`Error: ${response.error}`, 'error');
                }
            });
        }
    );
}

document.getElementById('colorPicker').addEventListener('change', (e) => {
    gameState.color = e.target.value;
});

document.getElementById('brushSize').addEventListener('input', (e) => {
    gameState.brushSize = parseInt(e.target.value);
    document.getElementById('brushSizeDisplay').textContent = gameState.brushSize;
});

// Tool selection
const toolButtons = {
    brushTool: 'brush',
    eraserTool: 'eraser',
    lineTool: 'line',
    circleTool: 'circle',
    rectTool: 'rect'
};

Object.entries(toolButtons).forEach(([btnId, toolName]) => {
    document.getElementById(btnId).addEventListener('click', () => {
        gameState.tool = toolName;
        Object.keys(toolButtons).forEach(id => {
            document.getElementById(id).classList.remove('active');
        });
        document.getElementById(btnId).classList.add('active');
    });
});

document.getElementById('undoBtn').addEventListener('click', undo);

document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Clear entire canvas? This cannot be undone.')) {
        clearCanvas();
    }
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `painting-${Date.now()}.png`;
    link.click();
});

// Picture selection
document.getElementById('pictureSelect').addEventListener('change', (e) => {
    const pictureKey = e.target.value;
    gameState.currentPicture = pictureKey;
    
    if (pictureKey) {
        loadPictureOutline(pictureKey);
        document.getElementById('picturePreview').style.display = 'block';
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        gameState.history = [];
        document.getElementById('picturePreview').style.display = 'none';
    }

    if (gameMode === 'multiplayer' && gameId) {
        socket.emit('load-picture', { gameId, picture: pictureKey });
    }
});

// ==================== PICTURE TEMPLATES ====================

function loadPictureOutline(pictureKey) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gameState.history = [];

    const svgPath = `/images/paint-templates/${pictureKey}.svg`;
    const img = new Image();
    img.onload = () => {
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        saveState();
        
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 100;
        previewCanvas.height = 100;
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.drawImage(canvas, 0, 0, 100, 100);
        document.getElementById('picturePreview').src = previewCanvas.toDataURL();
    };
    img.onerror = () => {
        console.log(`Picture template ${pictureKey} not found`);
        document.getElementById('picturePreview').style.display = 'none';
    };
    img.src = svgPath;
}

// ==================== MULTIPLAYER (SOCKET.IO) ====================

socket.on('private-game-created', (data) => {
    if (data.gameType === 'paint') {
        gameId = data.gameId;
        console.log('✓ Paint game created:', gameId);
    }
});

socket.on('private-game-joined', (data) => {
    if (data.gameType === 'paint') {
        gameId = data.gameId;
        console.log('✓ Joined paint game:', gameId);
    }
});

socket.on('paint-game-joined', (data) => {
    gameId = data.gameId;
    playerId = data.playerId || socket.id;
    console.log('✓ Joined paint random matchmaking room:', gameId);
});

socket.on('paint-game-started', (data) => {
    gameId = data.gameId || gameId;
    if (gameMode === 'multiplayer' && gameId) {
        currentPhase = 'game';
        showPhase('game');
        showStatus('🎮 Opponent found! Starting game...', 'success');
    }
});

socket.on('player-joined', (data) => {
    console.log('👥 Player joined game:', data.playerId);
});

socket.on('draw-stroke', (data) => {
    const x = typeof data.normalizedX === 'number' ? denormalizeX(data.normalizedX) : data.x;
    const y = typeof data.normalizedY === 'number' ? denormalizeY(data.normalizedY) : data.y;

    ctx.fillStyle = data.color;
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.brushSize;

    if (data.tool === 'brush') {
        ctx.beginPath();
        ctx.arc(x, y, data.brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
    } else if (data.tool === 'eraser') {
        ctx.clearRect(x - data.brushSize / 2, y - data.brushSize / 2, data.brushSize, data.brushSize);
    }
});

socket.on('draw-shape', (data) => {
    const x1 = typeof data.normalizedX1 === 'number' ? denormalizeX(data.normalizedX1) : data.x1;
    const y1 = typeof data.normalizedY1 === 'number' ? denormalizeY(data.normalizedY1) : data.y1;
    const x2 = typeof data.normalizedX2 === 'number' ? denormalizeX(data.normalizedX2) : data.x2;
    const y2 = typeof data.normalizedY2 === 'number' ? denormalizeY(data.normalizedY2) : data.y2;
    const centerX = typeof data.normalizedCenterX === 'number' ? denormalizeX(data.normalizedCenterX) : data.centerX;
    const centerY = typeof data.normalizedCenterY === 'number' ? denormalizeY(data.normalizedCenterY) : data.centerY;
    const radiusX = typeof data.normalizedRadiusX === 'number' ? denormalizeX(data.normalizedRadiusX) : data.radiusX;
    const radiusY = typeof data.normalizedRadiusY === 'number' ? denormalizeY(data.normalizedRadiusY) : data.radiusY;

    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.brushSize;

    if (data.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    } else if (data.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, Math.abs(radiusX), Math.abs(radiusY), 0, 0, Math.PI * 2);
        ctx.stroke();
    } else if (data.type === 'rect') {
        const width = x2 - x1;
        const height = y2 - y1;
        ctx.strokeRect(x1, y1, width, height);
    }
});

socket.on('clear-canvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gameState.history = [];
});

socket.on('load-picture', (data) => {
    if (data.picture) {
        loadPictureOutline(data.picture);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        gameState.history = [];
    }
});

// ==================== HELPER FUNCTIONS ====================

function showPhase(phase) {
    const phases = ['modeSelectionPhase', 'multiplayerOptionsPhase', 'gamePhase'];
    phases.forEach(p => {
        document.getElementById(p).classList.add('hidden');
    });
    document.getElementById(`${phase}Phase`).classList.remove('hidden');
    if (phase === 'game') {
        requestAnimationFrame(resizeCanvasToDisplay);
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = '';
        }, 3000);
    }
}

function quitGame() {
    if (confirm('Leave the paint room?')) {
        gameMode = '';
        gameId = null;
        currentPhase = 'mode-selection';
        gameState.history = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('pictureSelect').value = '';
        showPhase('modeSelection');
    }
}

// Initialize
console.log('🎨 Paint Game initialized');

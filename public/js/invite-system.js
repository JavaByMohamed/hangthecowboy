// Invite System - Shared JavaScript Module
// Include this after socket.io in any game that supports invitations

const InviteSystem = {
    gameType: null,
    inviteCode: null,
    gameId: null,
    onGameJoined: null,
    onGameStarted: null,
    
    init: function(config) {
        this.gameType = config.gameType;
        this.onGameJoined = config.onGameJoined || function() {};
        this.onGameStarted = config.onGameStarted || function() {};
        this.checkUrlForInvite();
    },
    
    checkUrlForInvite: function() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            this.showJoinByCodeUI(code);
        }
    },
    
    createPrivateGame: function(playerData, callback) {
        socket.emit('create-private-game', {
            gameType: this.gameType,
            playerData: playerData
        }, (response) => {
            if (response.success) {
                this.inviteCode = response.inviteCode;
                this.gameId = response.gameId;
                if (callback) callback(response);
            } else {
                alert('Failed to create private game: ' + response.error);
            }
        });
    },
    
    joinByCode: function(code, playerData, callback) {
        socket.emit('join-by-invite', {
            inviteCode: code.toUpperCase().trim(),
            playerData: playerData
        }, (response) => {
            if (response.success) {
                this.gameId = response.gameId;
                if (callback) callback(response);
            } else {
                alert(response.error || 'Failed to join game');
                if (callback) callback(response);
            }
        });
    },
    
    getInviteLink: function() {
        const baseUrl = window.location.origin + window.location.pathname;
        return baseUrl + '?code=' + this.inviteCode;
    },
    
    copyToClipboard: function(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.innerHTML;
            button.innerHTML = '✓ Copied!';
            button.classList.add('copied');
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            const originalText = button.innerHTML;
            button.innerHTML = '✓ Copied!';
            button.classList.add('copied');
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('copied');
            }, 2000);
        });
    },
    
    renderInviteOptions: function(containerId, onRandomMatch, onCreatePrivate, onJoinByCode) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="invite-section">
                <h3>🎮 Choose How to Play</h3>
                <div class="invite-options">
                    <button class="invite-btn invite-btn-primary" id="btn-random-match">
                        🎲 Find Random Opponent
                    </button>
                    <button class="invite-btn invite-btn-secondary" id="btn-create-private">
                        🔗 Invite a Friend
                    </button>
                </div>
                <div class="join-code-section">
                    <p style="color: #6c757d; margin-bottom: 10px;">Have an invite code?</p>
                    <div class="join-code-input-group">
                        <input type="text" id="join-code-input" class="join-code-input" 
                               placeholder="ENTER CODE" maxlength="6" autocomplete="off">
                        <button class="invite-btn invite-btn-outline" id="btn-join-code">
                            Join Game
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('btn-random-match').onclick = onRandomMatch;
        document.getElementById('btn-create-private').onclick = onCreatePrivate;
        document.getElementById('btn-join-code').onclick = () => {
            const code = document.getElementById('join-code-input').value;
            if (code.length === 6) {
                onJoinByCode(code);
            } else {
                alert('Please enter a valid 6-character code');
            }
        };
        
        // Enter key support
        document.getElementById('join-code-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('btn-join-code').click();
            }
        });
    },
    
    renderWaitingWithCode: function(containerId, gameTitle) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const inviteLink = this.getInviteLink();
        
        container.innerHTML = `
            <div class="waiting-invite">
                <h2>${gameTitle}</h2>
                <div class="invite-code-display">
                    <h3>📤 Share this code with your friend:</h3>
                    <div class="invite-code-box" id="display-invite-code">${this.inviteCode}</div>
                    <div class="invite-link-box" id="display-invite-link">${inviteLink}</div>
                    <div class="invite-actions">
                        <button class="copy-btn copy-btn-code" id="copy-code-btn">
                            📋 Copy Code
                        </button>
                        <button class="copy-btn copy-btn-link" id="copy-link-btn">
                            🔗 Copy Link
                        </button>
                    </div>
                </div>
                <div class="waiting-message">
                    <div class="spinner"></div>
                    <p>Waiting for your friend to join...</p>
                </div>
            </div>
        `;
        
        const self = this;
        document.getElementById('copy-code-btn').onclick = function() {
            self.copyToClipboard(self.inviteCode, this);
        };
        document.getElementById('copy-link-btn').onclick = function() {
            self.copyToClipboard(inviteLink, this);
        };
    },
    
    showJoinByCodeUI: function(prefillCode) {
        // This will be called when URL has ?code=XXX
        // Games should override this or check after init
        setTimeout(() => {
            const input = document.getElementById('join-code-input');
            if (input && prefillCode) {
                input.value = prefillCode.toUpperCase();
                // Auto-focus the join button
                const joinBtn = document.getElementById('btn-join-code');
                if (joinBtn) joinBtn.focus();
            }
        }, 100);
    }
};

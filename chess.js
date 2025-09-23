document.addEventListener("DOMContentLoaded", () => {
    const chessboard = document.getElementById('chessboard');
    const gameModeSelect = document.getElementById('gameModeSelect');
    const botSelection = document.getElementById('botSelection');
    const botDifficultySelect = document.getElementById('botDifficulty');
    const customMixContainer = document.getElementById('customMixContainer');
    const customMixOptions = document.getElementById('customMixOptions');
    const customMixSummary = document.getElementById('customMixSummary');
    const customMixError = document.getElementById('customMixError');
    const gameTypeSelect = document.getElementById('gameTypeSelect');
    const customSetupContainer = document.getElementById('customSetupContainer');
    const customPiecePalette = document.getElementById('customPiecePalette');
    const customSideToMoveSelect = document.getElementById('customSideToMove');
    const customEnPassantSelect = document.getElementById('customEnPassant');
    const customFullmoveInput = document.getElementById('customFullmove');
    const customCastleWhiteKing = document.getElementById('customCastleWhiteKing');
    const customCastleWhiteQueen = document.getElementById('customCastleWhiteQueen');
    const customCastleBlackKing = document.getElementById('customCastleBlackKing');
    const customCastleBlackQueen = document.getElementById('customCastleBlackQueen');
    const customSetupError = document.getElementById('customSetupError');
    const customFenInput = document.getElementById('customFenInput');
    const customFenStatus = document.getElementById('customFenStatus');
    const loadFenButton = document.getElementById('loadFenButton');
    const clearCustomBoardButton = document.getElementById('clearCustomBoard');
    const resetCustomBoardButton = document.getElementById('resetCustomBoard');
    const enterCustomEditorButton = document.getElementById('enterCustomEditor');
    const applyCustomSetupButton = document.getElementById('applyCustomSetup');

    const botOptions = [
        { id: 'random', label: 'Random Moves' },
        { id: 'worst', label: 'Worst Moves' },
        { id: 'stockfish', label: 'Stockfish' }
    ];

    const customMixState = botOptions.reduce((acc, bot) => {
        acc[bot.id] = { selected: false, weight: 0 };
        return acc;
    }, {});
    const customMixControls = new Map();
    let lastValidCustomMix = [];
    let isUpdatingCustomMixInternally = false;

    let selectedPiece = null;
    let turn = 'w'; // 'w' for white, 'b' for black
    let lastMove = null; // To keep track of the last move
    let gameMode = 'twoPlayer'; // Default game mode
    let botDifficulty = botDifficultySelect.value;
    let fullmoveNumber = 1;
    let engine;
    let gameOver = false;
    const promMap = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };
    const moveHistoryList = document.getElementById('moveHistoryList');
    let moveHistoryEntries = [];
    let historyStates = [];
    let currentHistoryIndex = 0;
    let pendingPromotion = null;
    const fileLetters = 'abcdefgh';
    const pieceNotationMap = { pawn: '', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' };
    const editorPieces = [
        { type: 'king', color: 'w', label: 'White King' },
        { type: 'queen', color: 'w', label: 'White Queen' },
        { type: 'rook', color: 'w', label: 'White Rook' },
        { type: 'bishop', color: 'w', label: 'White Bishop' },
        { type: 'knight', color: 'w', label: 'White Knight' },
        { type: 'pawn', color: 'w', label: 'White Pawn' },
        { type: 'king', color: 'b', label: 'Black King' },
        { type: 'queen', color: 'b', label: 'Black Queen' },
        { type: 'rook', color: 'b', label: 'Black Rook' },
        { type: 'bishop', color: 'b', label: 'Black Bishop' },
        { type: 'knight', color: 'b', label: 'Black Knight' },
        { type: 'pawn', color: 'b', label: 'Black Pawn' }
    ];
    const editorPaletteButtons = [];

    let gameType = 'standard';
    let currentCastlingConfig = null;
    let forcedEnPassantTarget = null;
    let customEditorActive = false;
    let customStartingPosition = null;
    let customEditorState = null;
    let editorSelectedTool = { type: null, color: null };
    let pieceIdCounter = 0;

    gameModeSelect.addEventListener("change", () => {
        gameMode = gameModeSelect.value;
        if (gameMode === "onePlayer") {
            botSelection.style.display = "block"; // Show bot difficulty dropdown
        } else {
            botSelection.style.display = "none"; // Hide dropdown in two-player mode
        }
        updateCustomMixVisibility();
        resetGame(); // Reset the game when switching modes
    });

    botDifficultySelect.addEventListener('change', () => {
        botDifficulty = botDifficultySelect.value;
        updateCustomMixVisibility();
        evaluateBoard();
    });

    if (gameTypeSelect) {
        gameType = gameTypeSelect.value || 'standard';
        gameTypeSelect.addEventListener('change', () => {
            gameType = gameTypeSelect.value;
            updateCustomSetupVisibility();
            if (gameType === 'custom') {
                enterCustomSetupMode();
            } else {
                customEditorActive = false;
                resetGame();
            }
        });
    }

    function getSelectedCustomMixCount() {
        return botOptions.reduce((count, bot) => {
            const state = customMixState[bot.id];
            return count + (state && state.selected ? 1 : 0);
        }, 0);
    }

    function updateCustomMixError(message) {
        if (!customMixError) {
            return;
        }
        customMixError.textContent = message;
    }

    function updateCustomMixSummaryDisplay(total) {
        if (!customMixSummary) {
            return;
        }
        const roundedTotal = Number.isFinite(total) ? total : 0;
        customMixSummary.textContent = `Total: ${roundedTotal}%`;
    }

    function getCustomMixSummary() {
        const summary = {
            entries: [],
            totalWeight: 0,
            selectedCount: 0,
            valid: false
        };

        botOptions.forEach(bot => {
            const state = customMixState[bot.id];
            if (!state) {
                return;
            }
            if (state.selected) {
                summary.selectedCount += 1;
                summary.totalWeight += state.weight;
                if (state.weight > 0) {
                    summary.entries.push({ id: bot.id, weight: state.weight });
                }
            }
        });

        summary.valid = summary.selectedCount >= 2 && summary.totalWeight === 100 && summary.entries.length > 0;
        return summary;
    }

    function handleCustomMixChange() {
        const summary = getCustomMixSummary();
        updateCustomMixSummaryDisplay(summary.totalWeight);

        let message = '';
        if (summary.selectedCount < 2) {
            message = 'Select at least two bots for the mix.';
        } else if (summary.totalWeight !== 100) {
            message = `Total must equal 100% (current: ${summary.totalWeight}%).`;
        } else if (summary.entries.length === 0) {
            message = 'Assign a positive percentage to at least one bot.';
        } else {
            lastValidCustomMix = summary.entries.map(entry => ({ ...entry }));
        }

        updateCustomMixError(message);
    }

    function setCustomMixWeight(botId, weight, options = {}) {
        const { skipComplement = false, skipChangeHandler = false } = options;
        const controls = customMixControls.get(botId);
        const state = customMixState[botId];
        if (!controls || !state) {
            return;
        }

        const rounded = Math.round(weight / 5) * 5;
        const clamped = Math.max(0, Math.min(100, rounded));
        state.weight = clamped;

        isUpdatingCustomMixInternally = true;
        controls.slider.value = String(clamped);
        controls.number.value = String(clamped);
        isUpdatingCustomMixInternally = false;

        if (!skipComplement) {
            adjustComplementIfNeeded(botId);
        }

        if (!skipChangeHandler) {
            handleCustomMixChange();
        }
    }

    function adjustComplementIfNeeded(botId) {
        const selectedBots = botOptions.filter(bot => {
            const state = customMixState[bot.id];
            return state && state.selected;
        });

        if (selectedBots.length !== 2) {
            return;
        }

        const otherBot = selectedBots.find(bot => bot.id !== botId);
        if (!otherBot) {
            return;
        }

        const targetWeight = Math.max(0, 100 - customMixState[botId].weight);
        setCustomMixWeight(otherBot.id, targetWeight, { skipComplement: true, skipChangeHandler: true });
    }

    function setCustomMixSelected(botId, selected, options = {}) {
        const { skipChangeHandler = false } = options;
        const controls = customMixControls.get(botId);
        const state = customMixState[botId];
        if (!controls || !state) {
            return;
        }

        state.selected = selected;

        isUpdatingCustomMixInternally = true;
        controls.checkbox.checked = selected;
        controls.slider.disabled = !selected;
        controls.number.disabled = !selected;
        controls.slider.value = String(state.weight);
        controls.number.value = String(state.weight);
        isUpdatingCustomMixInternally = false;

        if (!selected) {
            setCustomMixWeight(botId, 0, { skipComplement: true, skipChangeHandler: true });
        }

        if (!skipChangeHandler) {
            handleCustomMixChange();
        }
    }

    function renderCustomMixOptions() {
        if (!customMixOptions) {
            return;
        }

        customMixOptions.innerHTML = '';
        customMixControls.clear();

        botOptions.forEach(bot => {
            const row = document.createElement('div');
            row.className = 'custom-mix-row';

            const header = document.createElement('div');
            header.className = 'custom-mix-row-header';

            const label = document.createElement('label');
            label.className = 'custom-mix-label';
            label.setAttribute('for', `custom-mix-${bot.id}`);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `custom-mix-${bot.id}`;
            checkbox.className = 'custom-mix-checkbox';

            const labelText = document.createElement('span');
            labelText.textContent = bot.label;

            label.appendChild(checkbox);
            label.appendChild(labelText);
            header.appendChild(label);

            const controlsWrapper = document.createElement('div');
            controlsWrapper.className = 'custom-mix-controls';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0';
            slider.max = '100';
            slider.step = '5';
            slider.value = '0';
            slider.disabled = true;

            const numberWrapper = document.createElement('div');
            numberWrapper.className = 'custom-mix-number';

            const number = document.createElement('input');
            number.type = 'number';
            number.min = '0';
            number.max = '100';
            number.step = '5';
            number.value = '0';
            number.disabled = true;

            const percentLabel = document.createElement('span');
            percentLabel.textContent = '%';

            numberWrapper.appendChild(number);
            numberWrapper.appendChild(percentLabel);

            controlsWrapper.appendChild(slider);
            controlsWrapper.appendChild(numberWrapper);

            row.appendChild(header);
            row.appendChild(controlsWrapper);
            customMixOptions.appendChild(row);

            customMixControls.set(bot.id, { checkbox, slider, number });

            checkbox.addEventListener('change', () => {
                if (isUpdatingCustomMixInternally) {
                    return;
                }

                if (!checkbox.checked) {
                    const selectedCount = getSelectedCustomMixCount();
                    if (customMixState[bot.id].selected && selectedCount <= 2) {
                        checkbox.checked = true;
                        return;
                    }
                }

                setCustomMixSelected(bot.id, checkbox.checked);
            });

            slider.addEventListener('input', () => {
                if (isUpdatingCustomMixInternally || slider.disabled) {
                    return;
                }
                setCustomMixWeight(bot.id, parseInt(slider.value, 10));
            });

            number.addEventListener('input', () => {
                if (isUpdatingCustomMixInternally || number.disabled) {
                    return;
                }
                const value = parseInt(number.value, 10);
                if (Number.isNaN(value)) {
                    return;
                }
                setCustomMixWeight(bot.id, value);
            });

            number.addEventListener('change', () => {
                if (isUpdatingCustomMixInternally || number.disabled) {
                    return;
                }
                const value = parseInt(number.value, 10);
                setCustomMixWeight(bot.id, Number.isNaN(value) ? 0 : value);
            });
        });
    }

    function initializeCustomMixDefaults() {
        if (!botOptions.length) {
            return;
        }

        botOptions.forEach(bot => {
            setCustomMixSelected(bot.id, false, { skipChangeHandler: true });
        });

        if (botOptions.length >= 2) {
            setCustomMixSelected(botOptions[0].id, true, { skipChangeHandler: true });
            setCustomMixSelected(botOptions[1].id, true, { skipChangeHandler: true });
            setCustomMixWeight(botOptions[0].id, 50, { skipComplement: true, skipChangeHandler: true });
            setCustomMixWeight(botOptions[1].id, 50, { skipComplement: true, skipChangeHandler: true });
        } else if (botOptions.length === 1) {
            setCustomMixSelected(botOptions[0].id, true, { skipChangeHandler: true });
            setCustomMixWeight(botOptions[0].id, 100, { skipComplement: true, skipChangeHandler: true });
        }

        handleCustomMixChange();
    }

    function getActiveCustomMixEntries() {
        const summary = getCustomMixSummary();
        if (summary.valid) {
            return summary.entries;
        }
        return lastValidCustomMix;
    }

    function chooseBotFromMix(entries) {
        if (!entries || !entries.length) {
            return null;
        }

        const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
        if (total <= 0) {
            return entries[0].id;
        }

        let threshold = Math.random() * total;
        for (const entry of entries) {
            threshold -= entry.weight;
            if (threshold < 0) {
                return entry.id;
            }
        }

        return entries[entries.length - 1].id;
    }

    function updateCustomMixVisibility() {
        if (!customMixContainer) {
            return;
        }

        const shouldShow = gameMode === 'onePlayer' && botDifficulty === 'custom';
        customMixContainer.style.display = shouldShow ? 'block' : 'none';
    }

    function updateCustomSetupVisibility() {
        if (!customSetupContainer) {
            return;
        }
        customSetupContainer.style.display = gameType === 'custom' ? 'block' : 'none';
    }

    function setCustomSetupMessage(message = '', options = {}) {
        if (!customSetupError) {
            return;
        }
        customSetupError.textContent = message;
        if (options.isSuccess) {
            customSetupError.style.color = '#2e7d32';
        } else {
            customSetupError.style.color = '#c0392b';
        }
    }

    function setCustomFenStatus(message = '', isError = false) {
        if (!customFenStatus) {
            return;
        }
        customFenStatus.textContent = message;
        customFenStatus.style.color = isError ? '#c0392b' : '#2e7d32';
    }

    function createEmptyBoardArray() {
        return Array.from({ length: 8 }, () => Array(8).fill(null));
    }

    function cloneBoardState(board) {
        if (!board) {
            return createEmptyBoardArray();
        }
        return board.map(row => row.map(cell => {
            if (!cell) {
                return null;
            }
            return {
                type: cell.type,
                color: cell.color,
                moved: !!cell.moved,
                id: cell.id || null
            };
        }));
    }

    function cloneCastlingConfig(config) {
        if (!config) {
            return {
                w: { row: 7, kingStartCol: 4, kingSide: { startCol: 7, targetCol: 5 }, queenSide: { startCol: 0, targetCol: 3 } },
                b: { row: 0, kingStartCol: 4, kingSide: { startCol: 7, targetCol: 5 }, queenSide: { startCol: 0, targetCol: 3 } }
            };
        }
        return {
            w: {
                row: config.w.row,
                kingStartCol: config.w.kingStartCol,
                kingSide: { startCol: config.w.kingSide.startCol, targetCol: config.w.kingSide.targetCol },
                queenSide: { startCol: config.w.queenSide.startCol, targetCol: config.w.queenSide.targetCol }
            },
            b: {
                row: config.b.row,
                kingStartCol: config.b.kingStartCol,
                kingSide: { startCol: config.b.kingSide.startCol, targetCol: config.b.kingSide.targetCol },
                queenSide: { startCol: config.b.queenSide.startCol, targetCol: config.b.queenSide.targetCol }
            }
        };
    }

    function generatePieceId() {
        pieceIdCounter += 1;
        return `piece-${pieceIdCounter}`;
    }

    function updatePieceIdCounter(boardState) {
        if (!boardState) {
            return;
        }
        let maxValue = pieceIdCounter;
        boardState.forEach(row => {
            row.forEach(cell => {
                if (cell && cell.id) {
                    const match = cell.id.match(/piece-?(\d+)/);
                    if (match) {
                        const value = parseInt(match[1], 10);
                        if (!Number.isNaN(value)) {
                            maxValue = Math.max(maxValue, value);
                        }
                    }
                }
            });
        });
        pieceIdCounter = maxValue;
    }

    function buildCastlingConfig(options = {}) {
        const white = options.w || {};
        const black = options.b || {};
        return {
            w: {
                row: white.row ?? 7,
                kingStartCol: white.kingStartCol ?? 4,
                kingSide: { startCol: white.kingSide ?? null, targetCol: 5 },
                queenSide: { startCol: white.queenSide ?? null, targetCol: 3 }
            },
            b: {
                row: black.row ?? 0,
                kingStartCol: black.kingStartCol ?? 4,
                kingSide: { startCol: black.kingSide ?? null, targetCol: 5 },
                queenSide: { startCol: black.queenSide ?? null, targetCol: 3 }
            }
        };
    }

    function createStandardPosition() {
        pieceIdCounter = 0;
        const board = createEmptyBoardArray();
        const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

        for (let col = 0; col < 8; col++) {
            board[7][col] = { type: backRank[col], color: 'w', moved: false, id: generatePieceId() };
            board[6][col] = { type: 'pawn', color: 'w', moved: false, id: generatePieceId() };
            board[1][col] = { type: 'pawn', color: 'b', moved: false, id: generatePieceId() };
            board[0][col] = { type: backRank[col], color: 'b', moved: false, id: generatePieceId() };
        }

        const castlingConfig = buildCastlingConfig({
            w: { row: 7, kingStartCol: 4, kingSide: 7, queenSide: 0 },
            b: { row: 0, kingStartCol: 4, kingSide: 7, queenSide: 0 }
        });

        return {
            board,
            turn: 'w',
            fullmoveNumber: 1,
            castlingConfig,
            forcedEnPassantTarget: null,
            lastMove: null
        };
    }

    function generateChess960BackRank() {
        const positions = Array(8).fill(null);
        const evenSquares = [0, 2, 4, 6];
        const oddSquares = [1, 3, 5, 7];

        function takeRandom(list) {
            const index = Math.floor(Math.random() * list.length);
            return list.splice(index, 1)[0];
        }

        positions[takeRandom(evenSquares)] = 'bishop';
        positions[takeRandom(oddSquares)] = 'bishop';

        const remaining = [];
        for (let i = 0; i < 8; i++) {
            if (!positions[i]) {
                remaining.push(i);
            }
        }

        const queenIndex = takeRandom(remaining);
        positions[queenIndex] = 'queen';

        const knightIndex1 = takeRandom(remaining);
        positions[knightIndex1] = 'knight';
        const knightIndex2 = takeRandom(remaining);
        positions[knightIndex2] = 'knight';

        remaining.sort((a, b) => a - b);
        positions[remaining[0]] = 'rook';
        positions[remaining[1]] = 'king';
        positions[remaining[2]] = 'rook';

        return positions;
    }

    function generateChess960Position() {
        pieceIdCounter = 0;
        const board = createEmptyBoardArray();
        const backRank = generateChess960BackRank();

        for (let col = 0; col < 8; col++) {
            const pieceType = backRank[col];
            board[7][col] = { type: pieceType, color: 'w', moved: false, id: generatePieceId() };
            board[0][col] = { type: pieceType, color: 'b', moved: false, id: generatePieceId() };
            board[6][col] = { type: 'pawn', color: 'w', moved: false, id: generatePieceId() };
            board[1][col] = { type: 'pawn', color: 'b', moved: false, id: generatePieceId() };
        }

        const kingCol = backRank.indexOf('king');
        const rookCols = [];
        backRank.forEach((value, index) => {
            if (value === 'rook') {
                rookCols.push(index);
            }
        });
        const queenSideRookCol = rookCols.filter(col => col < kingCol).sort((a, b) => b - a)[0] ?? null;
        const kingSideRookCol = rookCols.filter(col => col > kingCol).sort((a, b) => a - b)[0] ?? null;

        const castlingConfig = buildCastlingConfig({
            w: { row: 7, kingStartCol: kingCol, kingSide: kingSideRookCol, queenSide: queenSideRookCol },
            b: { row: 0, kingStartCol: kingCol, kingSide: kingSideRookCol, queenSide: queenSideRookCol }
        });

        return {
            board,
            turn: 'w',
            fullmoveNumber: 1,
            castlingConfig,
            forcedEnPassantTarget: null,
            lastMove: null
        };
    }

    function getStartingPositionForCurrentGameType() {
        if (gameType === 'chess960') {
            return generateChess960Position();
        }
        if (gameType === 'custom') {
            return customStartingPosition ? clonePosition(customStartingPosition) : null;
        }
        return createStandardPosition();
    }

    function clonePosition(position) {
        if (!position) {
            return null;
        }
        return {
            board: cloneBoardState(position.board),
            turn: position.turn,
            fullmoveNumber: position.fullmoveNumber,
            castlingConfig: cloneCastlingConfig(position.castlingConfig),
            forcedEnPassantTarget: position.forcedEnPassantTarget || null,
            lastMove: position.lastMove ? { ...position.lastMove } : null
        };
    }

    function applyPosition(position) {
        const promotionUI = document.querySelector('.promotion-ui');
        if (promotionUI) {
            promotionUI.remove();
        }
        pendingPromotion = null;
        selectedPiece = null;
        gameOver = false;

        const boardState = cloneBoardState(position.board);
        currentCastlingConfig = cloneCastlingConfig(position.castlingConfig);
        forcedEnPassantTarget = position.forcedEnPassantTarget || null;
        lastMove = position.lastMove ? { ...position.lastMove } : null;
        turn = position.turn || 'w';
        fullmoveNumber = position.fullmoveNumber || 1;

        chessboard.innerHTML = '';
        createBoard(boardState);
        updatePieceIdCounter(boardState);

        moveHistoryEntries = [];
        historyStates = [];
        currentHistoryIndex = 0;

        document.querySelectorAll('.check').forEach(square => square.classList.remove('check'));
        const popup = document.querySelector('.checkmate-popup');
        if (popup) {
            popup.remove();
        }

        historyStates.push(captureDetailedState());
        updateMoveHistoryUI();
        evaluateBoard();
    }

    const resetGame = (position = null) => {
        const startPosition = position || getStartingPositionForCurrentGameType();
        if (!startPosition) {
            enterCustomSetupMode();
            return;
        }
        exitCustomSetupMode();
        applyPosition(startPosition);
        updateEngineChess960Option();
    };

    function createBoard(boardState = null) {
        chessboard.innerHTML = '';
        chessboard.classList.toggle('editor-active', customEditorActive);
        chessboard.style.display = 'grid';
        chessboard.style.gridTemplateColumns = 'repeat(8, 70px)';
        chessboard.style.gridTemplateRows = 'repeat(8, 70px)';
        chessboard.style.width = '560px';
        chessboard.style.height = '560px';
        chessboard.style.border = '2px solid black';

        const activeBoard = boardState || createEmptyBoardArray();

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.style.width = '70px';
                square.style.height = '70px';
                square.style.display = 'flex';
                square.style.alignItems = 'center';
                square.style.justifyContent = 'center';
                square.style.position = 'relative';
                square.style.backgroundColor = (row + col) % 2 === 0 ? '#f0d9b5' : '#b58863';

                square.dataset.row = row;
                square.dataset.col = col;

                const pieceData = activeBoard[row] && activeBoard[row][col] ? { ...activeBoard[row][col] } : null;

                if (pieceData) {
                    const piece = document.createElement('img');
                    piece.src = `images/${pieceData.type}-${pieceData.color}.svg`;
                    piece.style.width = '70px';
                    piece.style.height = '70px';
                    piece.classList.add('piece');
                    piece.dataset.color = pieceData.color;
                    piece.dataset.type = pieceData.type;
                    piece.dataset.moved = pieceData.moved ? 'true' : 'false';
                    piece.id = pieceData.id || `piece${row}${col}`;
                    square.appendChild(piece);
                }

                if (row === 7) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'file-label';
                    fileLabel.textContent = fileLetters[col];
                    square.appendChild(fileLabel);
                }
                if (col === 0) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'rank-label';
                    rankLabel.textContent = 8 - row;
                    square.appendChild(rankLabel);
                }

                square.addEventListener('click', handleSquareClick);
                chessboard.appendChild(square);
            }
        }
    }

    function isStockfishEvaluationEnabled() {
        if (botDifficulty === 'stockfish') {
            return true;
        }

        if (botDifficulty === 'custom') {
            const summary = getCustomMixSummary();
            if (summary.valid) {
                return summary.entries.some(entry => entry.id === 'stockfish');
            }
            return lastValidCustomMix.some(entry => entry.id === 'stockfish');
        }

        return false;
    }
    const handleSquareClick = (event) => {
        if (customEditorActive) {
            handleEditorSquareClick(event.currentTarget);
            return;
        }

        if (gameOver || pendingPromotion) return;

        if (historyStates.length && currentHistoryIndex !== historyStates.length - 1) {
            navigateToMove(historyStates.length - 1);
            return;
        }

        const square = event.currentTarget;
        const piece = square.querySelector(".piece");

        if (gameMode === "onePlayer" && turn === "b") return; // Prevent player from moving black in bot mode

        if (selectedPiece) {
            if (selectedPiece.parentElement === square) {
                // Deselect the piece
                removeMoveDots();
                selectedPiece = null;
            } else if (!piece || piece.dataset.color !== selectedPiece.dataset.color) {
                // Check if the move is legal
                const row = parseInt(square.dataset.row);
                const col = parseInt(square.dataset.col);
                const legalMoves = getLegalMoves(
                    selectedPiece,
                    parseInt(selectedPiece.parentElement.dataset.row),
                    parseInt(selectedPiece.parentElement.dataset.col)
                );
                const isLegalMove = legalMoves.some(([r, c]) => r === row && c === col);
                if (isLegalMove) {
                    movePiece(square);
                    removeMoveDots();
                    selectedPiece = null;
                    if (gameMode === "onePlayer" && turn === "b") {
                        setTimeout(botMove, 500); // Bot moves automatically after white
                    }
                }
            } else if (piece && piece.dataset.color === selectedPiece.dataset.color) {
                // Select a different piece
                removeMoveDots();
                selectedPiece = piece;
                showLegalMoves(piece, square);
            }
        } else if (piece && piece.dataset.color === turn) {
            // Select the piece
            selectedPiece = piece;
            showLegalMoves(piece, square);
        }
    };
    function moveCastlingRook(row, startCol, targetCol) {
        if (startCol === null || targetCol === null) {
            return;
        }
        const rook = document.querySelector(`[data-row="${row}"][data-col="${startCol}"] .piece`);
        const targetSquare = document.querySelector(`[data-row="${row}"][data-col="${targetCol}"]`);
        if (!rook || !targetSquare) {
            return;
        }
        targetSquare.appendChild(rook);
        rook.dataset.moved = 'true';
    }

    const movePiece = (square) => {
        const piece = selectedPiece;
        const fromRow = parseInt(piece.parentElement.dataset.row);
        const fromCol = parseInt(piece.parentElement.dataset.col);
        const toRow = parseInt(square.dataset.row);
        const toCol = parseInt(square.dataset.col);
        const pieceType = piece.dataset.type;
        const color = piece.dataset.color;
        const disambiguation = getMoveDisambiguation(piece, fromRow, fromCol, toRow, toCol);

        let isCapture = false;
        let capturedPieceType = null;
        let capturedPieceColor = null;
        let isEnPassant = false;
        let isCastling = null;

        let targetPiece = square.querySelector('.piece');

        if (
            pieceType === 'pawn' &&
            Math.abs(fromRow - toRow) === 1 &&
            Math.abs(fromCol - toCol) === 1 &&
            !targetPiece
        ) {
            const enemyPawn = document.querySelector(`[data-row="${fromRow}"][data-col="${toCol}"] .piece`);
            if (
                enemyPawn &&
                enemyPawn.dataset.type === 'pawn' &&
                enemyPawn.dataset.color !== color &&
                lastMove &&
                lastMove.pieceType === 'pawn' &&
                Math.abs(lastMove.fromRow - lastMove.toRow) === 2 &&
                lastMove.toRow === fromRow &&
                lastMove.toCol === toCol
            ) {
                capturedPieceType = enemyPawn.dataset.type;
                capturedPieceColor = enemyPawn.dataset.color;
                isCapture = true;
                isEnPassant = true;
                enemyPawn.remove();
            }
        }

        targetPiece = square.querySelector('.piece');
        if (targetPiece) {
            capturedPieceType = targetPiece.dataset.type;
            capturedPieceColor = targetPiece.dataset.color;
            isCapture = true;
            targetPiece.remove();
        }

        square.appendChild(piece);

        if (pieceType === 'king') {
            const config = currentCastlingConfig[piece.dataset.color];
            if (config && fromRow === config.row) {
                if (toCol === 6 && config.kingSide.startCol !== null) {
                    moveCastlingRook(fromRow, config.kingSide.startCol, config.kingSide.targetCol);
                    isCastling = 'king';
                } else if (toCol === 2 && config.queenSide.startCol !== null) {
                    moveCastlingRook(fromRow, config.queenSide.startCol, config.queenSide.targetCol);
                    isCastling = 'queen';
                }
            }
        }

        piece.dataset.moved = 'true';

        const moveDetails = {
            color,
            pieceType,
            fromRow,
            fromCol,
            toRow,
            toCol,
            isCapture,
            capturedPieceType,
            capturedPieceColor,
            isEnPassant,
            isCastling,
            promotionType: null,
            disambiguation,
            pieceId: piece.id
        };

        if (pieceType === 'pawn' && (toRow === 0 || toRow === 7)) {
            pendingPromotion = { piece, moveDetails };
            promotePawn(piece);
            return;
        }

        finalizeMove(moveDetails);
    };
    const showLegalMoves = (piece, square) => {
        removeMoveDots();
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        const possibleMoves = getLegalMoves(piece, row, col);
        possibleMoves.forEach(([r, c]) => {
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const targetSquare = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
                if (!targetSquare.querySelector('.piece') || targetSquare.querySelector('.piece').dataset.color !== piece.dataset.color) {
                    const dot = document.createElement('div');
                    dot.classList.add('move-dot');
                    targetSquare.appendChild(dot);
                }
            }
        });
    };
    const getLegalMoves = (piece, row, col) => {
        const moves = [];
        const color = piece.dataset.color;
        const type = piece.dataset.type;
        switch (type) {
            case 'pawn':
                const direction = color === 'w' ? -1 : 1;
                // Move forward
                if (isEmptySquare(row + direction, col)) {
                    moves.push([row + direction, col]);
                    // Move two squares on first move
                    if (!JSON.parse(piece.dataset.moved) && isEmptySquare(row + 2 * direction, col)) {
                        moves.push([row + 2 * direction, col]);
                    }
                }
                // Capture diagonally
                if (isEnemyPiece(row + direction, col - 1, color)) {
                    moves.push([row + direction, col - 1]);
                }
                if (isEnemyPiece(row + direction, col + 1, color)) {
                    moves.push([row + direction, col + 1]);
                }
                // En passant
                if (
                    lastMove &&
                    lastMove.pieceType === 'pawn' &&
                    lastMove.color !== color &&
                    Math.abs(lastMove.fromRow - lastMove.toRow) === 2
                ) {
                    if (lastMove.toRow === row && lastMove.toCol === col - 1) {
                        moves.push([row + direction, col - 1]);
                    }
                    if (lastMove.toRow === row && lastMove.toCol === col + 1) {
                        moves.push([row + direction, col + 1]);
                    }
                }
                break;
            case 'rook':
                addLinearMoves(moves, row, col, color, 1, 0);
                addLinearMoves(moves, row, col, color, -1, 0);
                addLinearMoves(moves, row, col, color, 0, 1);
                addLinearMoves(moves, row, col, color, 0, -1);
                break;
            case 'knight':
                addKnightMoves(moves, row, col, color);
                break;
            case 'bishop':
                addDiagonalMoves(moves, row, col, color);
                break;
            case 'queen':
                addLinearMoves(moves, row, col, color, 1, 0);
                addLinearMoves(moves, row, col, color, -1, 0);
                addLinearMoves(moves, row, col, color, 0, 1);
                addLinearMoves(moves, row, col, color, 0, -1);
                addDiagonalMoves(moves, row, col, color);
                break;
            case 'king':
                addKingMoves(moves, row, col, color);
                if (piece.dataset.moved === 'false') {
                    const config = currentCastlingConfig[color];
                    if (config && col === config.kingStartCol && row === config.row) {
                        if (canCastle(color, row, 'king')) {
                            moves.push([row, 6]);
                        }
                        if (canCastle(color, row, 'queen')) {
                            moves.push([row, 2]);
                        }
                    }
                }
                break;
            }
            return filterMovesThatAvoidCheck(piece, row, col, moves);
    };
    const filterMovesThatAvoidCheck = (piece, row, col, moves) => {
        return moves.filter(([toRow, toCol]) => {
            const boardCopy = createBoardCopy();
            makeMoveOnBoardCopy(boardCopy, piece, row, col, toRow, toCol);
            return !isKingInCheck(boardCopy, piece.dataset.color);
        });
    };
    const createBoardCopy = () => {
        const boardCopy = [];
        for (let row = 0; row < 8; row++) {
            boardCopy[row] = [];
            for (let col = 0; col < 8; col++) {
                const piece = document.querySelector(`[data-row='${row}'][data-col='${col}'] .piece`);
                boardCopy[row][col] = piece ? { ...piece.dataset } : null;
            }
        }
        return boardCopy;
    };
    const makeMoveOnBoardCopy = (boardCopy, piece, fromRow, fromCol, toRow, toCol) => {
        const entry = boardCopy[fromRow][fromCol];
        boardCopy[toRow][toCol] = entry;
        boardCopy[fromRow][fromCol] = null;

        if (!entry) {
            return;
        }

        if (entry.type === 'king') {
            const color = entry.color;
            const config = currentCastlingConfig[color];
            if (config && fromRow === config.row && fromCol === config.kingStartCol) {
                if (toCol === 6 && config.kingSide.startCol !== null) {
                    boardCopy[fromRow][config.kingSide.targetCol] = boardCopy[fromRow][config.kingSide.startCol];
                    boardCopy[fromRow][config.kingSide.startCol] = null;
                } else if (toCol === 2 && config.queenSide.startCol !== null) {
                    boardCopy[fromRow][config.queenSide.targetCol] = boardCopy[fromRow][config.queenSide.startCol];
                    boardCopy[fromRow][config.queenSide.startCol] = null;
                }
            }
        }
    };

    function findKingOnBoard(board, color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = board[row][col];
                if (cell && cell.type === 'king' && cell.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    function findRookForCastling(board, kingPos, color, side) {
        const direction = side === 'king' ? 1 : -1;
        let col = kingPos.col + direction;
        while (col >= 0 && col < 8) {
            const cell = board[kingPos.row][col];
            if (cell) {
                if (cell.type === 'rook' && cell.color === color) {
                    return col;
                }
                break;
            }
            col += direction;
        }
        return null;
    }

    function parseCastlingRightsString(castling, board, whiteKingPos, blackKingPos) {
        const config = buildCastlingConfig({
            w: { row: whiteKingPos.row, kingStartCol: whiteKingPos.col, kingSide: null, queenSide: null },
            b: { row: blackKingPos.row, kingStartCol: blackKingPos.col, kingSide: null, queenSide: null }
        });

        if (!castling || castling === '-') {
            return config;
        }

        const processSymbol = (symbol, kingPos, colorKey) => {
            let fileChar;
            if (symbol === 'K' || symbol === 'k') {
                fileChar = 'h';
            } else if (symbol === 'Q' || symbol === 'q') {
                fileChar = 'a';
            } else {
                const lower = symbol.toLowerCase();
                if (!fileLetters.includes(lower)) {
                    return;
                }
                fileChar = lower;
            }
            const col = fileLetters.indexOf(fileChar);
            if (col < 0) {
                return;
            }
            const rookCell = board[kingPos.row][col];
            if (!rookCell || rookCell.type !== 'rook' || rookCell.color !== colorKey) {
                throw new Error('Invalid FEN: castling rook not found.');
            }
            if (colorKey === 'w') {
                if (col > kingPos.col) {
                    config.w.kingSide.startCol = col;
                } else {
                    config.w.queenSide.startCol = col;
                }
            } else {
                if (col > kingPos.col) {
                    config.b.kingSide.startCol = col;
                } else {
                    config.b.queenSide.startCol = col;
                }
            }
            rookCell.moved = false;
        };

        for (const char of castling) {
            if (char === char.toUpperCase()) {
                processSymbol(char, whiteKingPos, 'w');
            } else {
                processSymbol(char, blackKingPos, 'b');
            }
        }

        const whiteKingCell = board[whiteKingPos.row][whiteKingPos.col];
        if (whiteKingCell) {
            whiteKingCell.moved = !(config.w.kingSide.startCol !== null || config.w.queenSide.startCol !== null);
        }
        const blackKingCell = board[blackKingPos.row][blackKingPos.col];
        if (blackKingCell) {
            blackKingCell.moved = !(config.b.kingSide.startCol !== null || config.b.queenSide.startCol !== null);
        }

        const whiteRookCols = [];
        if (config.w.kingSide.startCol !== null) whiteRookCols.push(config.w.kingSide.startCol);
        if (config.w.queenSide.startCol !== null) whiteRookCols.push(config.w.queenSide.startCol);
        const blackRookCols = [];
        if (config.b.kingSide.startCol !== null) blackRookCols.push(config.b.kingSide.startCol);
        if (config.b.queenSide.startCol !== null) blackRookCols.push(config.b.queenSide.startCol);

        for (let col = 0; col < 8; col++) {
            const whiteCell = board[whiteKingPos.row][col];
            if (whiteCell && whiteCell.type === 'rook' && whiteCell.color === 'w' && !whiteRookCols.includes(col)) {
                whiteCell.moved = true;
            }
            const blackCell = board[blackKingPos.row][col];
            if (blackCell && blackCell.type === 'rook' && blackCell.color === 'b' && !blackRookCols.includes(col)) {
                blackCell.moved = true;
            }
        }

        return config;
    }

    function createLastMoveFromEnPassant(enPassantSquare, turn) {
        if (!enPassantSquare || enPassantSquare === '-' || enPassantSquare.length !== 2) {
            return null;
        }
        const file = enPassantSquare[0];
        const rank = parseInt(enPassantSquare[1], 10);
        if (!fileLetters.includes(file) || Number.isNaN(rank)) {
            return null;
        }
        const fileIndex = fileLetters.indexOf(file);
        const targetRow = 8 - rank;
        if (targetRow < 0 || targetRow > 7) {
            return null;
        }
        const movingColor = turn === 'w' ? 'b' : 'w';
        let fromRow;
        let toRow;
        if (movingColor === 'w') {
            fromRow = targetRow + 1;
            toRow = targetRow - 1;
        } else {
            fromRow = targetRow - 1;
            toRow = targetRow + 1;
        }
        if (fromRow < 0 || fromRow > 7 || toRow < 0 || toRow > 7) {
            return null;
        }
        return {
            color: movingColor,
            pieceType: 'pawn',
            fromRow,
            fromCol: fileIndex,
            toRow,
            toCol: fileIndex,
            resultingPieceType: 'pawn',
            isCapture: false,
            capturedPieceType: null,
            capturedPieceColor: null,
            isEnPassant: false,
            isCastling: null,
            promotionType: null
        };
    }

    function parseFENString(fen) {
        const parts = fen.trim().split(/\s+/);
        if (parts.length < 4) {
            throw new Error('FEN must have at least four fields.');
        }

        const boardPart = parts[0];
        const turnPart = parts[1];
        const castlingPart = parts[2];
        const enPassantPart = parts[3];
        const fullmovePart = parts[5] ? parseInt(parts[5], 10) : 1;

        const rows = boardPart.split('/');
        if (rows.length !== 8) {
            throw new Error('FEN board description must have 8 ranks.');
        }

        const board = createEmptyBoardArray();
        let localCounter = pieceIdCounter;
        const typeMap = { p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king' };

        for (let row = 0; row < 8; row++) {
            const rowString = rows[row];
            let col = 0;
            for (let i = 0; i < rowString.length; i++) {
                const char = rowString[i];
                if (char >= '1' && char <= '8') {
                    col += parseInt(char, 10);
                    continue;
                }
                const lower = char.toLowerCase();
                const type = typeMap[lower];
                if (!type) {
                    throw new Error('Invalid FEN: unknown piece symbol.');
                }
                const color = char === lower ? 'b' : 'w';
                if (col >= 8) {
                    throw new Error('Invalid FEN: too many squares in rank.');
                }
                localCounter += 1;
                board[row][col] = { type, color, moved: false, id: `piece-${localCounter}` };
                col += 1;
            }
            if (col !== 8) {
                throw new Error('Invalid FEN: incomplete rank description.');
            }
        }

        pieceIdCounter = localCounter;

        const whiteKingPos = findKingOnBoard(board, 'w');
        const blackKingPos = findKingOnBoard(board, 'b');
        if (!whiteKingPos || !blackKingPos) {
            throw new Error('FEN must include both kings.');
        }

        const castlingConfig = parseCastlingRightsString(castlingPart, board, whiteKingPos, blackKingPos);

        const turn = turnPart === 'b' ? 'b' : 'w';
        const fullmoveNumber = Number.isNaN(fullmovePart) || fullmovePart < 1 ? 1 : fullmovePart;
        const enPassant = enPassantPart !== '-' ? enPassantPart : null;

        updatePieceIdCounter(board);

        return {
            board,
            turn,
            fullmoveNumber,
            castlingConfig,
            forcedEnPassantTarget: enPassant,
            lastMove: createLastMoveFromEnPassant(enPassantPart, turnPart)
        };
    }

    function createEmptyEditorState() {
        return {
            board: createEmptyBoardArray(),
            turn: 'w',
            castling: {
                whiteKingSide: false,
                whiteQueenSide: false,
                blackKingSide: false,
                blackQueenSide: false
            },
            enPassant: '-',
            fullmoveNumber: 1
        };
    }

    function positionToEditorState(position) {
        const state = createEmptyEditorState();
        state.board = cloneBoardState(position.board);
        state.turn = position.turn || 'w';
        state.fullmoveNumber = position.fullmoveNumber || 1;
        state.enPassant = position.forcedEnPassantTarget || '-';
        state.castling.whiteKingSide = !!(position.castlingConfig && position.castlingConfig.w && position.castlingConfig.w.kingSide.startCol !== null);
        state.castling.whiteQueenSide = !!(position.castlingConfig && position.castlingConfig.w && position.castlingConfig.w.queenSide.startCol !== null);
        state.castling.blackKingSide = !!(position.castlingConfig && position.castlingConfig.b && position.castlingConfig.b.kingSide.startCol !== null);
        state.castling.blackQueenSide = !!(position.castlingConfig && position.castlingConfig.b && position.castlingConfig.b.queenSide.startCol !== null);
        return state;
    }

    function applyEditorState(state) {
        customEditorState = {
            board: cloneBoardState(state.board),
            turn: state.turn || 'w',
            castling: { ...state.castling },
            enPassant: state.enPassant || '-',
            fullmoveNumber: state.fullmoveNumber || 1
        };

        if (customSideToMoveSelect) {
            customSideToMoveSelect.value = customEditorState.turn;
        }
        if (customFullmoveInput) {
            customFullmoveInput.value = customEditorState.fullmoveNumber;
        }
        if (customEnPassantSelect) {
            const targetValue = customEditorState.enPassant;
            if ([...customEnPassantSelect.options].some(option => option.value === targetValue)) {
                customEnPassantSelect.value = targetValue;
            } else {
                customEnPassantSelect.value = '-';
            }
        }
        if (customCastleWhiteKing) customCastleWhiteKing.checked = !!customEditorState.castling.whiteKingSide;
        if (customCastleWhiteQueen) customCastleWhiteQueen.checked = !!customEditorState.castling.whiteQueenSide;
        if (customCastleBlackKing) customCastleBlackKing.checked = !!customEditorState.castling.blackKingSide;
        if (customCastleBlackQueen) customCastleBlackQueen.checked = !!customEditorState.castling.blackQueenSide;

        customEditorActive = true;
        gameOver = true;
        turn = customEditorState.turn;
        fullmoveNumber = customEditorState.fullmoveNumber;
        lastMove = null;
        forcedEnPassantTarget = customEditorState.enPassant !== '-' ? customEditorState.enPassant : null;

        createBoard(customEditorState.board);
        updatePieceIdCounter(customEditorState.board);
        moveHistoryEntries = [];
        historyStates = [];
        currentHistoryIndex = 0;
        updateMoveHistoryUI();
        resetEvalBar();
    }

    function recordEditorState() {
        if (!customEditorState) {
            customEditorState = createEmptyEditorState();
        }
        const board = createEmptyBoardArray();
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const pieceEl = document.querySelector(`[data-row="${row}"][data-col="${col}"] .piece`);
                if (pieceEl) {
                    board[row][col] = {
                        type: pieceEl.dataset.type,
                        color: pieceEl.dataset.color,
                        moved: pieceEl.dataset.moved === 'true',
                        id: pieceEl.id
                    };
                } else {
                    board[row][col] = null;
                }
            }
        }
        customEditorState.board = board;
        if (customSideToMoveSelect) {
            customEditorState.turn = customSideToMoveSelect.value;
        }
        if (customFullmoveInput) {
            const value = parseInt(customFullmoveInput.value, 10);
            customEditorState.fullmoveNumber = Number.isNaN(value) || value < 1 ? 1 : value;
        }
        if (customEnPassantSelect) {
            customEditorState.enPassant = customEnPassantSelect.value;
        }
        customEditorState.castling.whiteKingSide = customCastleWhiteKing ? customCastleWhiteKing.checked : false;
        customEditorState.castling.whiteQueenSide = customCastleWhiteQueen ? customCastleWhiteQueen.checked : false;
        customEditorState.castling.blackKingSide = customCastleBlackKing ? customCastleBlackKing.checked : false;
        customEditorState.castling.blackQueenSide = customCastleBlackQueen ? customCastleBlackQueen.checked : false;
        updatePieceIdCounter(board);
    }

    function handleEditorSquareClick(square) {
        if (!square) {
            return;
        }
        const existingPiece = square.querySelector('.piece');
        if (!editorSelectedTool || !editorSelectedTool.type) {
            if (existingPiece) {
                existingPiece.remove();
                recordEditorState();
            }
            return;
        }
        if (existingPiece) {
            existingPiece.remove();
        }
        const piece = document.createElement('img');
        piece.src = `images/${editorSelectedTool.type}-${editorSelectedTool.color}.svg`;
        piece.style.width = '70px';
        piece.style.height = '70px';
        piece.classList.add('piece');
        piece.dataset.type = editorSelectedTool.type;
        piece.dataset.color = editorSelectedTool.color;
        piece.dataset.moved = 'false';
        piece.id = generatePieceId();
        square.appendChild(piece);
        recordEditorState();
    }

    function renderEditorPalette() {
        if (!customPiecePalette) {
            return;
        }
        editorPaletteButtons.length = 0;
        customPiecePalette.innerHTML = '';
        editorPieces.forEach(piece => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'custom-piece-button';
            button.title = piece.label;
            const img = document.createElement('img');
            img.src = `images/${piece.type}-${piece.color}.svg`;
            img.alt = piece.label;
            button.appendChild(img);
            button.addEventListener('click', () => setEditorTool(piece));
            customPiecePalette.appendChild(button);
            editorPaletteButtons.push({ button, piece });
        });

        const eraserButton = document.createElement('button');
        eraserButton.type = 'button';
        eraserButton.className = 'custom-piece-button';
        eraserButton.textContent = 'Erase';
        eraserButton.addEventListener('click', () => setEditorTool(null));
        customPiecePalette.appendChild(eraserButton);
        editorPaletteButtons.push({ button: eraserButton, piece: null });

        const defaultTool = editorPieces.find(p => p.type === 'pawn' && p.color === 'w') || editorPieces[0] || null;
        setEditorTool(defaultTool);
    }

    function setEditorTool(piece) {
        if (piece && piece.type && piece.color) {
            editorSelectedTool = { type: piece.type, color: piece.color };
        } else {
            editorSelectedTool = { type: null, color: null };
        }
        updatePaletteSelection();
    }

    function updatePaletteSelection() {
        editorPaletteButtons.forEach(entry => {
            if (!entry || !entry.button) {
                return;
            }
            const isSelected = entry.piece
                ? editorSelectedTool.type === entry.piece.type && editorSelectedTool.color === entry.piece.color
                : !editorSelectedTool.type;
            if (isSelected) {
                entry.button.classList.add('selected');
            } else {
                entry.button.classList.remove('selected');
            }
        });
    }

    function populateEnPassantSelect() {
        if (!customEnPassantSelect) {
            return;
        }
        customEnPassantSelect.innerHTML = '';
        const noneOption = document.createElement('option');
        noneOption.value = '-';
        noneOption.textContent = 'None';
        customEnPassantSelect.appendChild(noneOption);
        for (const file of fileLetters) {
            for (const rank of [3, 6]) {
                const option = document.createElement('option');
                option.value = `${file}${rank}`;
                option.textContent = `${file}${rank}`;
                customEnPassantSelect.appendChild(option);
            }
        }
    }

    function buildPositionFromEditorState(state) {
        const board = cloneBoardState(state.board);
        let whiteKings = 0;
        let blackKings = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = board[row][col];
                if (cell && cell.type === 'king') {
                    if (cell.color === 'w') {
                        whiteKings += 1;
                    } else if (cell.color === 'b') {
                        blackKings += 1;
                    }
                }
            }
        }
        if (whiteKings !== 1 || blackKings !== 1) {
            throw new Error('Exactly one white king and one black king are required.');
        }
        const whiteKingPos = findKingOnBoard(board, 'w');
        const blackKingPos = findKingOnBoard(board, 'b');
        if (!whiteKingPos || !blackKingPos) {
            throw new Error('Both kings must be present.');
        }

        const castlingConfig = buildCastlingConfig({
            w: { row: whiteKingPos.row, kingStartCol: whiteKingPos.col, kingSide: null, queenSide: null },
            b: { row: blackKingPos.row, kingStartCol: blackKingPos.col, kingSide: null, queenSide: null }
        });

        if (state.castling.whiteKingSide) {
            const rookCol = findRookForCastling(board, { row: whiteKingPos.row, col: whiteKingPos.col }, 'w', 'king');
            if (rookCol === null) {
                throw new Error('White kingside castling selected but no rook found.');
            }
            castlingConfig.w.kingSide.startCol = rookCol;
        }
        if (state.castling.whiteQueenSide) {
            const rookCol = findRookForCastling(board, { row: whiteKingPos.row, col: whiteKingPos.col }, 'w', 'queen');
            if (rookCol === null) {
                throw new Error('White queenside castling selected but no rook found.');
            }
            castlingConfig.w.queenSide.startCol = rookCol;
        }
        if (state.castling.blackKingSide) {
            const rookCol = findRookForCastling(board, { row: blackKingPos.row, col: blackKingPos.col }, 'b', 'king');
            if (rookCol === null) {
                throw new Error('Black kingside castling selected but no rook found.');
            }
            castlingConfig.b.kingSide.startCol = rookCol;
        }
        if (state.castling.blackQueenSide) {
            const rookCol = findRookForCastling(board, { row: blackKingPos.row, col: blackKingPos.col }, 'b', 'queen');
            if (rookCol === null) {
                throw new Error('Black queenside castling selected but no rook found.');
            }
            castlingConfig.b.queenSide.startCol = rookCol;
        }

        const whiteKingCell = board[whiteKingPos.row][whiteKingPos.col];
        if (whiteKingCell) {
            whiteKingCell.moved = !(state.castling.whiteKingSide || state.castling.whiteQueenSide);
        }
        const blackKingCell = board[blackKingPos.row][blackKingPos.col];
        if (blackKingCell) {
            blackKingCell.moved = !(state.castling.blackKingSide || state.castling.blackQueenSide);
        }

        const whiteRightsCols = [];
        if (castlingConfig.w.kingSide.startCol !== null) whiteRightsCols.push(castlingConfig.w.kingSide.startCol);
        if (castlingConfig.w.queenSide.startCol !== null) whiteRightsCols.push(castlingConfig.w.queenSide.startCol);
        const blackRightsCols = [];
        if (castlingConfig.b.kingSide.startCol !== null) blackRightsCols.push(castlingConfig.b.kingSide.startCol);
        if (castlingConfig.b.queenSide.startCol !== null) blackRightsCols.push(castlingConfig.b.queenSide.startCol);

        for (let col = 0; col < 8; col++) {
            const whiteCell = board[whiteKingPos.row][col];
            if (whiteCell && whiteCell.type === 'rook' && whiteCell.color === 'w') {
                whiteCell.moved = !whiteRightsCols.includes(col);
            }
            const blackCell = board[blackKingPos.row][col];
            if (blackCell && blackCell.type === 'rook' && blackCell.color === 'b') {
                blackCell.moved = !blackRightsCols.includes(col);
            }
        }

        updatePieceIdCounter(board);

        const enPassantTarget = state.enPassant && state.enPassant !== '-' ? state.enPassant : null;

        return {
            board,
            turn: state.turn || 'w',
            fullmoveNumber: state.fullmoveNumber || 1,
            castlingConfig,
            forcedEnPassantTarget: enPassantTarget,
            lastMove: createLastMoveFromEnPassant(state.enPassant, state.turn || 'w')
        };
    }

    function applyCustomSetup() {
        try {
            recordEditorState();
            const position = buildPositionFromEditorState(customEditorState);
            customStartingPosition = clonePosition(position);
            customEditorState = positionToEditorState(position);
            setCustomSetupMessage('Custom position applied. Starting game...', { isSuccess: true });
            setCustomFenStatus('');
            resetGame(position);
        } catch (error) {
            setCustomSetupMessage(error.message || 'Unable to apply custom setup.');
        }
    }

    function loadPositionFromFen() {
        if (!customFenInput) {
            return;
        }
        const fen = customFenInput.value.trim();
        if (!fen) {
            setCustomFenStatus('Please enter a FEN string.', true);
            return;
        }
        try {
            const position = parseFENString(fen);
            const state = positionToEditorState(position);
            applyEditorState(state);
            setCustomFenStatus('FEN loaded successfully.', false);
            setCustomSetupMessage('');
        } catch (error) {
            setCustomFenStatus(error.message || 'Invalid FEN string.', true);
        }
    }

    function enterCustomSetupMode() {
        updateCustomSetupVisibility();
        if (!customEditorState) {
            customEditorState = createEmptyEditorState();
        }
        applyEditorState(customEditorState);
        setCustomSetupMessage('');
        setCustomFenStatus('');
    }

    function exitCustomSetupMode() {
        if (!customEditorActive) {
            return;
        }
        customEditorActive = false;
    }

    function initializeCustomSetupUI() {
        populateEnPassantSelect();
        renderEditorPalette();
        customEditorState = createEmptyEditorState();

        if (customSideToMoveSelect) {
            customSideToMoveSelect.addEventListener('change', () => {
                if (customEditorState) {
                    customEditorState.turn = customSideToMoveSelect.value;
                }
            });
        }
        if (customFullmoveInput) {
            customFullmoveInput.addEventListener('input', () => {
                if (customEditorState) {
                    const value = parseInt(customFullmoveInput.value, 10);
                    customEditorState.fullmoveNumber = Number.isNaN(value) || value < 1 ? 1 : value;
                }
            });
        }
        if (customEnPassantSelect) {
            customEnPassantSelect.addEventListener('change', () => {
                if (customEditorState) {
                    customEditorState.enPassant = customEnPassantSelect.value;
                }
            });
        }
        [customCastleWhiteKing, customCastleWhiteQueen, customCastleBlackKing, customCastleBlackQueen].forEach((checkbox, index) => {
            if (!checkbox) {
                return;
            }
            checkbox.addEventListener('change', () => {
                if (!customEditorState) {
                    return;
                }
                switch (index) {
                    case 0:
                        customEditorState.castling.whiteKingSide = checkbox.checked;
                        break;
                    case 1:
                        customEditorState.castling.whiteQueenSide = checkbox.checked;
                        break;
                    case 2:
                        customEditorState.castling.blackKingSide = checkbox.checked;
                        break;
                    case 3:
                        customEditorState.castling.blackQueenSide = checkbox.checked;
                        break;
                    default:
                        break;
                }
            });
        });

        if (clearCustomBoardButton) {
            clearCustomBoardButton.addEventListener('click', () => {
                customEditorState = createEmptyEditorState();
                applyEditorState(customEditorState);
                setCustomSetupMessage('');
                setCustomFenStatus('');
            });
        }
        if (resetCustomBoardButton) {
            resetCustomBoardButton.addEventListener('click', () => {
                const standardPosition = createStandardPosition();
                customEditorState = positionToEditorState(standardPosition);
                applyEditorState(customEditorState);
                setCustomSetupMessage('');
                setCustomFenStatus('');
            });
        }
        if (enterCustomEditorButton) {
            enterCustomEditorButton.addEventListener('click', () => {
                gameType = 'custom';
                if (gameTypeSelect && gameTypeSelect.value !== 'custom') {
                    gameTypeSelect.value = 'custom';
                }
                enterCustomSetupMode();
            });
        }
        if (applyCustomSetupButton) {
            applyCustomSetupButton.addEventListener('click', () => applyCustomSetup());
        }
        if (loadFenButton) {
            loadFenButton.addEventListener('click', () => loadPositionFromFen());
        }

        updateCustomSetupVisibility();
    }

    function updateEngineChess960Option() {
        if (engine && typeof engine.postMessage === 'function') {
            const value = gameType === 'standard' ? 0 : 1;
            engine.postMessage(`setoption name UCI_Chess960 value ${value}`);
        }
    }

    const initStockfish = () => {
        engine = new Worker('stockfish.js');
        engine.onmessage = (e) => {
            const line = e.data;
            const scoreMatch = line.match(/score (cp|mate) (-?\\d+)/);
            if (scoreMatch) {
                const raw = parseInt(scoreMatch[2], 10);
                if (!Number.isNaN(raw)) {
                    const value = scoreMatch[1] === 'cp' ? raw : (raw > 0 ? 10000 : -10000);
                    const perspective = engine && engine.lastEvaluationTurn ? engine.lastEvaluationTurn : 'w';
                    updateEvalBar(value, perspective);
                }
            }
            if (line.startsWith('bestmove') && engine.bestMoveCallback) {
                const move = line.split(' ')[1];
                engine.bestMoveCallback(move);
                engine.bestMoveCallback = null;
            }
        };
        updateEngineChess960Option();
    };

    const requestStockfish = (callback) => {
        if (!engine) return;
        engine.bestMoveCallback = callback || null;
        const fen = generateFEN();
        const fenParts = fen.split(' ');
        engine.lastEvaluationTurn = fenParts[1] || turn;
        engine.postMessage('position fen ' + fen);
        engine.postMessage('go depth 12');
    };

    const performStockfishBotMove = () => {
        requestStockfish(best => {
            if (!best) return;
            const fromFile = best[0];
            const fromRank = best[1];
            const toFile = best[2];
            const toRank = best[3];
            const fromRow = 8 - parseInt(fromRank, 10);
            const fromCol = fileLetters.indexOf(fromFile);
            const toRow = 8 - parseInt(toRank, 10);
            const toCol = fileLetters.indexOf(toFile);
            const piece = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"] .piece`);
            if (piece) {
                movePieceToSquare(piece, toRow, toCol, best[4]);
            }
        });
    };

    const performRandomBotMove = () => {
        const pieces = Array.from(document.querySelectorAll('.piece'))
            .filter(p => p.dataset.color === 'b');

        let allMoves = [];

        pieces.forEach(piece => {
            const row = parseInt(piece.parentElement.dataset.row, 10);
            const col = parseInt(piece.parentElement.dataset.col, 10);
            const legalMoves = getLegalMoves(piece, row, col);

            legalMoves.forEach(move => {
                allMoves.push({ piece, toRow: move[0], toCol: move[1] });
            });
        });

        if (allMoves.length === 0) {
            alert("Game over! White wins by checkmate or stalemate.");
            return;
        }

        const randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
        movePieceToSquare(randomMove.piece, randomMove.toRow, randomMove.toCol);
    };

    const pieceValuesForWorstBot = {
        pawn: 100,
        knight: 320,
        bishop: 330,
        rook: 500,
        queen: 900,
        king: 20000
    };

    const applyMoveForEvaluation = (board, fromRow, fromCol, toRow, toCol, pieceData) => {
        const movingPiece = { ...pieceData };
        board[fromRow][fromCol] = null;

        let captureRow = toRow;
        let captureCol = toCol;

        if (movingPiece.type === 'pawn' && fromCol !== toCol && !board[toRow][toCol]) {
            captureRow = fromRow;
            captureCol = toCol;
        }

        if (board[captureRow]) {
            board[captureRow][captureCol] = null;
        }

        if (movingPiece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
            const rookFromCol = toCol === 6 ? 7 : 0;
            const rookToCol = toCol === 6 ? 5 : 3;
            const rookPiece = board[fromRow][rookFromCol];
            if (rookPiece) {
                board[fromRow][rookFromCol] = null;
                board[fromRow][rookToCol] = { ...rookPiece };
            }
        }

        if (movingPiece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            movingPiece.type = 'queen';
        }

        board[toRow][toCol] = movingPiece;
    };

    const evaluateMaterialScore = (board) => {
        let score = 0;
        for (const row of board) {
            for (const cell of row) {
                if (!cell) continue;
                const value = pieceValuesForWorstBot[cell.type] || 0;
                score += cell.color === 'w' ? value : -value;
            }
        }
        return score;
    };

    const performWorstBotMove = () => {
        const pieces = Array.from(document.querySelectorAll('.piece'))
            .filter(p => p.dataset.color === 'b');

        let chosenMove = null;
        let worstScore = -Infinity;
        const baseBoard = createBoardCopy();

        pieces.forEach(piece => {
            const fromRow = parseInt(piece.parentElement.dataset.row, 10);
            const fromCol = parseInt(piece.parentElement.dataset.col, 10);
            const legalMoves = getLegalMoves(piece, fromRow, fromCol);

            legalMoves.forEach(([toRow, toCol]) => {
                const boardCopy = cloneBoardState(baseBoard);
                const pieceData = boardCopy[fromRow][fromCol];
                if (!pieceData) {
                    return;
                }
                applyMoveForEvaluation(boardCopy, fromRow, fromCol, toRow, toCol, pieceData);
                const score = evaluateMaterialScore(boardCopy);
                if (score > worstScore) {
                    worstScore = score;
                    chosenMove = { piece, toRow, toCol };
                }
            });
        });

        if (!chosenMove) {
            alert("Game over! White wins by checkmate or stalemate.");
            return;
        }

        movePieceToSquare(chosenMove.piece, chosenMove.toRow, chosenMove.toCol);
    };

    const botStrategies = {
        random: performRandomBotMove,
        worst: performWorstBotMove,
        stockfish: performStockfishBotMove
    };

    function getBotStrategyIdForTurn() {
        if (botDifficulty === 'custom') {
            const entries = getActiveCustomMixEntries();
            const chosen = chooseBotFromMix(entries);
            if (chosen && botStrategies[chosen]) {
                return chosen;
            }
            return 'random';
        }

        if (botStrategies[botDifficulty]) {
            return botDifficulty;
        }

        return 'random';
    }

    const botMove = () => {
        if (gameOver) {
            return;
        }

        if (gameMode !== "onePlayer" || turn !== "b") {
            return;
        }

        if (historyStates.length && currentHistoryIndex !== historyStates.length - 1) {
            navigateToMove(historyStates.length - 1);
        }

        const strategyId = getBotStrategyIdForTurn();
        const strategy = botStrategies[strategyId] || botStrategies.random;
        if (strategy) {
            strategy();
        }
    };

    const movePieceToSquare = (piece, toRow, toCol, promotion) => {
        if (gameOver || pendingPromotion) {
            return;
        }

        const fromSquare = piece.parentElement;
        if (!fromSquare) {
            return;
        }

        const fromRow = parseInt(fromSquare.dataset.row);
        const fromCol = parseInt(fromSquare.dataset.col);
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        if (!toSquare) {
            return;
        }

        const pieceType = piece.dataset.type;
        const color = piece.dataset.color;
        const disambiguation = getMoveDisambiguation(piece, fromRow, fromCol, toRow, toCol);

        let isCapture = false;
        let capturedPieceType = null;
        let capturedPieceColor = null;
        let isEnPassant = false;
        let isCastling = null;

        if (
            pieceType === 'pawn' &&
            Math.abs(fromRow - toRow) === 1 &&
            Math.abs(fromCol - toCol) === 1 &&
            !toSquare.querySelector('.piece')
        ) {
            const enemyPawn = document.querySelector(`[data-row="${fromRow}"][data-col="${toCol}"] .piece`);
            if (
                enemyPawn &&
                enemyPawn.dataset.type === 'pawn' &&
                enemyPawn.dataset.color !== color &&
                lastMove &&
                lastMove.pieceType === 'pawn' &&
                Math.abs(lastMove.fromRow - lastMove.toRow) === 2 &&
                lastMove.toRow === fromRow &&
                lastMove.toCol === toCol
            ) {
                capturedPieceType = enemyPawn.dataset.type;
                capturedPieceColor = enemyPawn.dataset.color;
                isCapture = true;
                isEnPassant = true;
                enemyPawn.remove();
            }
        }

        let targetPiece = toSquare.querySelector('.piece');
        if (targetPiece) {
            capturedPieceType = targetPiece.dataset.type;
            capturedPieceColor = targetPiece.dataset.color;
            isCapture = true;
            targetPiece.remove();
        }

        toSquare.appendChild(piece);

        if (pieceType === 'king') {
            const config = currentCastlingConfig[color];
            if (config && fromRow === config.row) {
                if (toCol === 6 && config.kingSide.startCol !== null) {
                    moveCastlingRook(fromRow, config.kingSide.startCol, config.kingSide.targetCol);
                    isCastling = 'king';
                } else if (toCol === 2 && config.queenSide.startCol !== null) {
                    moveCastlingRook(fromRow, config.queenSide.startCol, config.queenSide.targetCol);
                    isCastling = 'queen';
                }
            }
        }

        piece.dataset.moved = 'true';

        let promotionType = null;
        if (pieceType === 'pawn' && (toRow === 0 || toRow === 7)) {
            const newTypeKey = promotion ? promotion.toLowerCase() : 'q';
            const mappedType = promMap[newTypeKey] || 'queen';
            promotionType = mappedType;
            piece.src = `images/${mappedType}-${color}.svg`;
            piece.dataset.type = mappedType;
        }

        const moveDetails = {
            color,
            pieceType,
            fromRow,
            fromCol,
            toRow,
            toCol,
            isCapture,
            capturedPieceType,
            capturedPieceColor,
            isEnPassant,
            isCastling,
            promotionType,
            disambiguation,
            pieceId: piece.id
        };

        finalizeMove(moveDetails);
    };

    const getFileLetter = (col) => fileLetters[col];

    const getSquareNotation = (row, col) => `${fileLetters[col]}${8 - row}`;

    const getMoveDisambiguation = (piece, fromRow, fromCol, toRow, toCol) => {
        if (piece.dataset.type === 'pawn') {
            return '';
        }
        const type = piece.dataset.type;
        const color = piece.dataset.color;
        const otherPieces = Array.from(document.querySelectorAll(`.piece[data-type='${type}'][data-color='${color}']`))
            .filter(p => p !== piece);
        if (!otherPieces.length) {
            return '';
        }
        const candidates = otherPieces.filter(other => {
            const row = parseInt(other.parentElement.dataset.row);
            const col = parseInt(other.parentElement.dataset.col);
            const legalMoves = getLegalMoves(other, row, col);
            return legalMoves.some(([r, c]) => r === toRow && c === toCol);
        });
        if (!candidates.length) {
            return '';
        }
        const fromFile = getFileLetter(fromCol);
        const fromRank = 8 - fromRow;
        const sharesFile = candidates.some(other => parseInt(other.parentElement.dataset.col) === fromCol);
        const sharesRank = candidates.some(other => parseInt(other.parentElement.dataset.row) === fromRow);
        if (!sharesFile) {
            return fromFile;
        }
        if (!sharesRank) {
            return fromRank.toString();
        }
        return `${fromFile}${fromRank}`;
    };

    const formatMoveNotation = (moveDetails, { isCheck, isMate }) => {
        if (moveDetails.isCastling) {
            let notation = moveDetails.isCastling === 'king' ? 'O-O' : 'O-O-O';
            if (isMate) {
                notation += '#';
            } else if (isCheck) {
                notation += '+';
            }
            return notation;
        }

        let notation = '';
        if (moveDetails.pieceType === 'pawn') {
            if (moveDetails.isCapture) {
                notation += `${getFileLetter(moveDetails.fromCol)}x`;
            }
            notation += getSquareNotation(moveDetails.toRow, moveDetails.toCol);
        } else {
            notation += pieceNotationMap[moveDetails.pieceType] + (moveDetails.disambiguation || '');
            if (moveDetails.isCapture) {
                notation += 'x';
            }
            notation += getSquareNotation(moveDetails.toRow, moveDetails.toCol);
        }

        if (moveDetails.promotionType) {
            notation += `=${pieceNotationMap[moveDetails.promotionType]}`;
        }

        if (isMate) {
            notation += '#';
        } else if (isCheck) {
            notation += '+';
        }

        return notation;
    };

    const captureDetailedState = () => {
        const boardState = [];
        for (let row = 0; row < 8; row++) {
            boardState[row] = [];
            for (let col = 0; col < 8; col++) {
                const piece = document.querySelector(`[data-row='${row}'][data-col='${col}'] .piece`);
                if (piece) {
                    boardState[row][col] = {
                        type: piece.dataset.type,
                        color: piece.dataset.color,
                        moved: piece.dataset.moved === 'true',
                        id: piece.id
                    };
                } else {
                    boardState[row][col] = null;
                }
            }
        }
        return {
            board: boardState,
            turn,
            fullmoveNumber,
            lastMove: lastMove ? { ...lastMove } : null,
            gameOver
        };
    };

    const renderState = (state) => {
        createBoard(state.board);
        turn = state.turn;
        fullmoveNumber = state.fullmoveNumber;
        lastMove = state.lastMove ? { ...state.lastMove } : null;
        gameOver = state.gameOver;
        pendingPromotion = null;
        selectedPiece = null;
        checkForCheck();
        evaluateBoard();
    };

    const navigateToMove = (index) => {
        if (pendingPromotion || !historyStates.length) {
            return;
        }
        const clamped = Math.max(0, Math.min(index, historyStates.length - 1));
        if (clamped === currentHistoryIndex) {
            return;
        }
        currentHistoryIndex = clamped;
        const state = historyStates[clamped];
        renderState(state);
        updateMoveHistoryUI();
        const popup = document.querySelector('.checkmate-popup');
        if (popup) {
            popup.style.display = currentHistoryIndex === historyStates.length - 1 ? 'flex' : 'none';
        }
    };

    const updateMoveHistoryUI = () => {
        if (!moveHistoryList) {
            return;
        }
        moveHistoryList.innerHTML = '';

        const startEntry = document.createElement('div');
        startEntry.className = 'history-start';
        startEntry.textContent = 'Start Position';
        if (currentHistoryIndex === 0) {
            startEntry.classList.add('active');
        }
        startEntry.addEventListener('click', () => navigateToMove(0));
        moveHistoryList.appendChild(startEntry);

        const rows = [];
        moveHistoryEntries.forEach(entry => {
            let row = rows[rows.length - 1];
            if (!row || row.number !== entry.moveNumber) {
                row = { number: entry.moveNumber, white: null, black: null };
                rows.push(row);
            }
            if (entry.color === 'w') {
                row.white = entry;
            } else {
                row.black = entry;
            }
        });

        const createMoveElement = (entry, colorClass) => {
            const span = document.createElement('div');
            span.className = `move ${colorClass}`;
            if (!entry) {
                span.classList.add('empty');
                span.textContent = '—';
                return span;
            }
            span.textContent = entry.notation;
            if (entry.stateIndex === currentHistoryIndex) {
                span.classList.add('active');
            }
            span.addEventListener('click', () => navigateToMove(entry.stateIndex));
            return span;
        };

        rows.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'move-row';

            const numberEl = document.createElement('div');
            numberEl.className = 'move-number';
            numberEl.textContent = `${row.number}.`;
            rowEl.appendChild(numberEl);

            rowEl.appendChild(createMoveElement(row.white, 'white'));
            rowEl.appendChild(createMoveElement(row.black, 'black'));

            moveHistoryList.appendChild(rowEl);
        });

        if (currentHistoryIndex === historyStates.length - 1) {
            moveHistoryList.scrollTop = moveHistoryList.scrollHeight;
        }
    };

    const finalizeMove = (moveDetails) => {
        pendingPromotion = null;
        forcedEnPassantTarget = null;
        lastMove = {
            color: moveDetails.color,
            fromRow: moveDetails.fromRow,
            fromCol: moveDetails.fromCol,
            toRow: moveDetails.toRow,
            toCol: moveDetails.toCol,
            pieceType: moveDetails.pieceType,
            resultingPieceType: moveDetails.promotionType || moveDetails.pieceType,
            isCapture: moveDetails.isCapture,
            capturedPieceType: moveDetails.capturedPieceType,
            capturedPieceColor: moveDetails.capturedPieceColor,
            isEnPassant: moveDetails.isEnPassant,
            isCastling: moveDetails.isCastling,
            promotionType: moveDetails.promotionType || null
        };

        const opponent = moveDetails.color === 'w' ? 'b' : 'w';
        checkForCheck();
        const boardCopy = createBoardCopy();
        const isCheck = isKingInCheck(boardCopy, opponent);
        const isMate = isCheck && !hasAnyLegalMoves(opponent);
        const notation = formatMoveNotation(moveDetails, { isCheck, isMate });
        const stateIndex = historyStates.length;

        moveHistoryEntries.push({
            notation,
            color: moveDetails.color,
            moveNumber: fullmoveNumber,
            stateIndex
        });

        if (isMate) {
            displayCheckmatePopup();
        } else {
            switchTurn();
        }

        historyStates.push(captureDetailedState());
        currentHistoryIndex = stateIndex;
        updateMoveHistoryUI();
        evaluateBoard();
    };

    document.addEventListener('keydown', (event) => {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
            return;
        }
        if (pendingPromotion || !historyStates.length) {
            return;
        }
        if (event.key === 'ArrowLeft') {
            navigateToMove(currentHistoryIndex - 1);
            event.preventDefault();
        } else if (event.key === 'ArrowRight') {
            navigateToMove(currentHistoryIndex + 1);
            event.preventDefault();
        }
    });

    const generateFEN = () => {
        const rows = [];
        for (let r = 0; r < 8; r++) {
            let rowStr = '';
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                const sqPiece = document.querySelector(`[data-row='${r}'][data-col='${c}'] .piece`);
                if (sqPiece) {
                    if (empty > 0) {
                        rowStr += empty;
                        empty = 0;
                    }
                    const map = { pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', queen: 'q', king: 'k' };
                    let sym = map[sqPiece.dataset.type];
                    rowStr += sqPiece.dataset.color === 'w' ? sym.toUpperCase() : sym;
                } else {
                    empty++;
                }
            }
            if (empty > 0) rowStr += empty;
            rows.push(rowStr);
        }
        return rows.join('/') + ' ' + turn + ' ' + getCastlingRights() + ' ' + getEnPassantSquare() + ' 0 ' + fullmoveNumber;
    };

    const getCastlingRights = () => {
        let rights = '';
        const wk = document.querySelector('[data-type="king"][data-color="w"]');
        const bk = document.querySelector('[data-type="king"][data-color="b"]');
        if (wk && wk.dataset.moved === 'false') {
            const wrh = document.querySelector('[data-row="7"][data-col="7"] .piece');
            const wra = document.querySelector('[data-row="7"][data-col="0"] .piece');
            if (wrh && wrh.dataset.type === 'rook' && wrh.dataset.moved === 'false') rights += 'K';
            if (wra && wra.dataset.type === 'rook' && wra.dataset.moved === 'false') rights += 'Q';
        }
        if (bk && bk.dataset.moved === 'false') {
            const brh = document.querySelector('[data-row="0"][data-col="7"] .piece');
            const bra = document.querySelector('[data-row="0"][data-col="0"] .piece');
            if (brh && brh.dataset.type === 'rook' && brh.dataset.moved === 'false') rights += 'k';
            if (bra && bra.dataset.type === 'rook' && bra.dataset.moved === 'false') rights += 'q';
        }
        return rights || '-';
    };

    const getEnPassantSquare = () => {
        if (forcedEnPassantTarget) {
            return forcedEnPassantTarget;
        }
        if (!lastMove || lastMove.pieceType !== 'pawn') return '-';
        if (Math.abs(lastMove.fromRow - lastMove.toRow) !== 2) return '-';
        const file = fileLetters[lastMove.fromCol];
        const rank = (8 - Math.min(lastMove.fromRow, lastMove.toRow)).toString();
        return file + rank;
    };

    const isKingInCheck = (board, color) => {
        const kingPos = findKing(board, color);
        if (!kingPos) return false;
        return isSquareAttacked(board, kingPos.row, kingPos.col, color);
    };

    const findKing = (board, color) => {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    };

    const isSquareAttacked = (board, row, col, color) => {
        const enemyColor = color === 'w' ? 'b' : 'w';
        const directions = [
            [1, 0], [-1, 0], [0, 1], [0, -1], // Rook/Queen
            [1, 1], [1, -1], [-1, 1], [-1, -1] // Bishop/Queen
        ];
        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const piece = board[r][c];
                if (piece) {
                    if (piece.color === enemyColor &&
                        ((Math.abs(dr) === Math.abs(dc) && (piece.type === 'bishop' || piece.type === 'queen')) ||
                         (dr === 0 || dc === 0) && (piece.type === 'rook' || piece.type === 'queen'))) {
                        return true;
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }
        // Check knight attacks
        const knightMoves = [
            [2, 1], [1, 2], [-1, 2], [-2, 1],
            [-2, -1], [-1, -2], [1, -2], [2, -1]
        ];
        for (const [dr, dc] of knightMoves) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const piece = board[r][c];
                if (piece && piece.color === enemyColor && piece.type === 'knight') {
                    return true;
                }
            }
        }
        // Check pawn attacks
        const pawnDir = color === 'w' ? -1 : 1;
        for (const dc of [-1, 1]) {
            const r = row + pawnDir;
            const c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const piece = board[r][c];
                if (piece && piece.color === enemyColor && piece.type === 'pawn') {
                    return true;
                }
            }
        }
        // Check king attacks
        for (const dr of [-1, 0, 1]) {
            for (const dc of [-1, 0, 1]) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                    const piece = board[r][c];
                    if (piece && piece.color === enemyColor && piece.type === 'king') {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const updateEvalBar = (value, sideToMove = 'w') => {
        const evalFill = document.getElementById('evalFill');
        if (!evalFill) {
            return;
        }
        const adjustedValue = sideToMove === 'b' ? -value : value;
        const clamped = Math.max(-1000, Math.min(1000, adjustedValue));
        const percentage = ((clamped + 1000) / 2000) * 100;
        evalFill.style.height = percentage + '%';
    };

    const resetEvalBar = () => {
        const evalFill = document.getElementById('evalFill');
        if (evalFill) {
            evalFill.style.height = '50%';
        }
    };

    const evaluateBoard = () => {
        if (gameOver) {
            return;
        }
        if (!engine) {
            resetEvalBar();
            return;
        }
        if (!isStockfishEvaluationEnabled()) {
            resetEvalBar();
            return;
        }
        requestStockfish();
    };

    const filterMoves = (moves) => {
        return moves.filter(([r, c]) => r >= 0 && r < 8 && c >= 0 && c < 8);
    };

    const isInsideBoard = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8;

    const isEmptySquare = (row, col) => {
        if (!isInsideBoard(row, col)) {
            return false;
        }
        return !document.querySelector(`[data-row="${row}"][data-col="${col}"] .piece`);
    };

    const isEnemyPiece = (row, col, color) => {
        if (!isInsideBoard(row, col)) {
            return false;
        }
        const piece = document.querySelector(`[data-row="${row}"][data-col="${col}"] .piece`);
        return !!piece && piece.dataset.color !== color;
    };

    const addLinearMoves = (moves, row, col, color, rowStep, colStep) => {
        let r = row + rowStep;
        let c = col + colStep;
        while (isInsideBoard(r, c)) {
            if (isEmptySquare(r, c)) {
                moves.push([r, c]);
            } else {
                if (isEnemyPiece(r, c, color)) {
                    moves.push([r, c]);
                }
                break;
            }
            r += rowStep;
            c += colStep;
        }
    };

    const addDiagonalMoves = (moves, row, col, color) => {
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
            addLinearMoves(moves, row, col, color, dr, dc);
        });
    };

    const addKnightMoves = (moves, row, col, color) => {
        const knightMoves = [
            [2, 1], [1, 2], [-1, 2], [-2, 1],
            [-2, -1], [-1, -2], [1, -2], [2, -1]
        ];
        knightMoves.forEach(([dr, dc]) => {
            const r = row + dr;
            const c = col + dc;
            if (isInsideBoard(r, c) && (isEmptySquare(r, c) || isEnemyPiece(r, c, color))) {
                moves.push([r, c]);
            }
        });
    };

    const addKingMoves = (moves, row, col, color) => {
        const kingMoves = [
            [row - 1, col], [row + 1, col],
            [row, col - 1], [row, col + 1],
            [row - 1, col - 1], [row - 1, col + 1],
            [row + 1, col - 1], [row + 1, col + 1]
        ];
        kingMoves.forEach(([r, c]) => {
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                if (isEmptySquare(r, c) || isEnemyPiece(r, c, color)) {
                    moves.push([r, c]);
                }
            }
        });
    };
    const canCastle = (color, row, side) => {
        const config = currentCastlingConfig[color];
        if (!config) {
            return false;
        }

        const sideConfig = side === 'king' ? config.kingSide : config.queenSide;
        if (!sideConfig || sideConfig.startCol === null) {
            return false;
        }

        if (row !== config.row) {
            return false;
        }

        const kingSquare = document.querySelector(`[data-row="${row}"][data-col="${config.kingStartCol}"] .piece`);
        if (!kingSquare || kingSquare.dataset.moved === 'true') {
            return false;
        }

        const rookSquare = document.querySelector(`[data-row="${row}"][data-col="${sideConfig.startCol}"] .piece`);
        if (!rookSquare || rookSquare.dataset.type !== 'rook' || rookSquare.dataset.color !== color || rookSquare.dataset.moved === 'true') {
            return false;
        }

        const minCol = Math.min(config.kingStartCol, sideConfig.startCol) + 1;
        const maxCol = Math.max(config.kingStartCol, sideConfig.startCol) - 1;
        for (let c = minCol; c <= maxCol; c++) {
            if (document.querySelector(`[data-row="${row}"][data-col="${c}"] .piece`)) {
                return false;
            }
        }

        const rookTargetCol = sideConfig.targetCol;
        const rookStep = rookTargetCol > sideConfig.startCol ? 1 : -1;
        for (let c = sideConfig.startCol + rookStep; c !== rookTargetCol; c += rookStep) {
            if (c === config.kingStartCol) {
                continue;
            }
            if (document.querySelector(`[data-row="${row}"][data-col="${c}"] .piece`)) {
                return false;
            }
        }

        const baseBoard = createBoardCopy();
        if (isSquareAttacked(baseBoard, row, config.kingStartCol, color)) {
            return false;
        }

        const boardCopy = createBoardCopy();
        const kingPiece = boardCopy[row][config.kingStartCol];
        const rookPiece = boardCopy[row][sideConfig.startCol];
        if (!kingPiece || !rookPiece) {
            return false;
        }

        boardCopy[row][config.kingStartCol] = null;
        boardCopy[row][sideConfig.startCol] = null;
        boardCopy[row][sideConfig.targetCol] = { ...rookPiece };

        const kingTargetCol = side === 'king' ? 6 : 2;
        const pathCols = [];
        if (config.kingStartCol === kingTargetCol) {
            pathCols.push(kingTargetCol);
        } else {
            const step = kingTargetCol > config.kingStartCol ? 1 : -1;
            for (let c = config.kingStartCol + step; step > 0 ? c <= kingTargetCol : c >= kingTargetCol; c += step) {
                pathCols.push(c);
            }
        }

        for (const col of pathCols) {
            if (boardCopy[row][col] && col !== kingTargetCol) {
                return false;
            }
            boardCopy[row][col] = { ...kingPiece };
            if (isSquareAttacked(boardCopy, row, col, color)) {
                return false;
            }
            if (col !== kingTargetCol) {
                boardCopy[row][col] = null;
            }
        }

        boardCopy[row][kingTargetCol] = { ...kingPiece };
        if (isSquareAttacked(boardCopy, row, kingTargetCol, color)) {
            return false;
        }

        return true;
    };
    const clearCheckHighlights = () => {
        document.querySelectorAll('.check').forEach(square => square.classList.remove('check'));
    };

    const highlightKingInCheck = (color) => {
        const king = document.querySelector(`.piece[data-type="king"][data-color="${color}"]`);
        if (king) {
            king.parentElement.classList.add('check');
        }
    };

    const checkForCheck = () => {
        clearCheckHighlights();
        const boardCopy = createBoardCopy();
        if (isKingInCheck(boardCopy, 'w')) {
            highlightKingInCheck('w');
        }
        if (isKingInCheck(boardCopy, 'b')) {
            highlightKingInCheck('b');
        }
    };

    const hasAnyLegalMoves = (color) => {
        const pieces = Array.from(document.querySelectorAll(`.piece[data-color='${color}']`));
        return pieces.some(piece => {
            const row = parseInt(piece.parentElement.dataset.row);
            const col = parseInt(piece.parentElement.dataset.col);
            return getLegalMoves(piece, row, col).length > 0;
        });
    };

    const isCheckmate = () => {
        const opponent = turn === 'w' ? 'b' : 'w';
        const boardCopy = createBoardCopy();
        if (!isKingInCheck(boardCopy, opponent)) {
            return false;
        }
        return !hasAnyLegalMoves(opponent);
    };

    const displayCheckmatePopup = () => {
        gameOver = true;
        if (document.querySelector('.checkmate-popup')) {
            return;
        }
        const winner = turn === 'w' ? 'White' : 'Black';
        const overlay = document.createElement('div');
        overlay.className = 'checkmate-popup';
        overlay.innerHTML = `
            <div class="checkmate-message">
                <h2>Checkmate!</h2>
                <p>${winner} wins.</p>
                <button type="button" class="restart-button">Play Again</button>
            </div>
        `;
        overlay.querySelector('.restart-button').addEventListener('click', () => {
            overlay.remove();
            resetGame();
        });
        document.body.appendChild(overlay);
    };
    const removeMoveDots = () => {
        document.querySelectorAll('.move-dot').forEach(dot => dot.remove());
    };
    const switchTurn = () => {
        if (turn === 'w') {
            turn = 'b';
        } else {
            turn = 'w';
            fullmoveNumber++;
        }

        // If in one-player mode and it's Black's turn, make the bot move
        if (gameMode === "onePlayer" && turn === "b") {
            setTimeout(botMove, 500); // Give a delay so it’s visually clear
        }
    };

    window.toggleBotSelection = function() {
        var modeValue = document.getElementById('gameModeSelect').value;
        var botSelectionElement = document.getElementById('botSelection');
        if (botSelectionElement) {
            botSelectionElement.style.display = modeValue === 'onePlayer' ? 'block' : 'none';
        }
        var customMixElement = document.getElementById('customMixContainer');
        if (customMixElement) {
            var difficultyValue = document.getElementById('botDifficulty').value;
            const shouldShow = modeValue === 'onePlayer' && difficultyValue === 'custom';
            customMixElement.style.display = shouldShow ? 'block' : 'none';
        }
    };
    const promotePawn = (pawn) => {
        const promotionUI = document.createElement('div');
        promotionUI.setAttribute('class', 'promotion-ui');
        promotionUI.innerHTML = `
            <div class="promotion-options">
                <img src="images/queen-${pawn.dataset.color}.svg" onclick="completePromotion('${pawn.dataset.color}', 'queen', '${pawn.id}')">
                <img src="images/rook-${pawn.dataset.color}.svg" onclick="completePromotion('${pawn.dataset.color}', 'rook', '${pawn.id}')">
                <img src="images/bishop-${pawn.dataset.color}.svg" onclick="completePromotion('${pawn.dataset.color}', 'bishop', '${pawn.id}')">
                <img src="images/knight-${pawn.dataset.color}.svg" onclick="completePromotion('${pawn.dataset.color}', 'knight', '${pawn.id}')">
            </div>
        `;
        document.body.appendChild(promotionUI);
    };
    window.completePromotion = (color, type, id) => {
        const pawn = document.getElementById(id);
        if (!pawn || !pendingPromotion) {
            return;
        }
        pawn.src = `images/${type}-${color}.svg`;
        pawn.dataset.type = type;
        const ui = document.querySelector('.promotion-ui');
        if (ui) {
            ui.remove();
        }
        pendingPromotion.moveDetails.promotionType = type;
        finalizeMove(pendingPromotion.moveDetails);
    };
    renderCustomMixOptions();
    initializeCustomMixDefaults();
    updateCustomMixVisibility();
    initializeCustomSetupUI();
    updateCustomSetupVisibility();

    resetGame();
    initStockfish();
    evaluateBoard();
    toggleBotSelection();
});

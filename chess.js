document.addEventListener("DOMContentLoaded", () => {
    const chessboard = document.getElementById('chessboard');
    const gameModeSelect = document.getElementById('gameModeSelect');
    const botSelection = document.getElementById('botSelection');
    const botSelectors = {
        w: document.getElementById('whiteBotDifficulty'),
        b: document.getElementById('blackBotDifficulty')
    };
    const botSelectionGroups = {
        w: document.querySelector('.bot-selection-group[data-color="w"]'),
        b: document.querySelector('.bot-selection-group[data-color="b"]')
    };
    const gameTypeSelect = document.getElementById('gameTypeSelect');
    const editCustomSetupButton = document.getElementById('editCustomSetupButton');
    const customSetupModal = document.getElementById('customSetupModal');
    const customSetupBoard = document.getElementById('customSetupBoard');
    const customPiecePalette = document.getElementById('customPiecePalette');
    const customSetupError = document.getElementById('customSetupError');
    const customEnPassantInput = document.getElementById('customEnPassant');
    const customFullmoveInput = document.getElementById('customFullmove');
    const customFenInput = document.getElementById('customFenInput');
    const customTurnRadios = document.getElementsByName('customSetupTurn');
    const castlingCheckboxes = {
        w: {
            kingSide: document.getElementById('customCastlingWhiteK'),
            queenSide: document.getElementById('customCastlingWhiteQ')
        },
        b: {
            kingSide: document.getElementById('customCastlingBlackK'),
            queenSide: document.getElementById('customCastlingBlackQ')
        }
    };
    const clearCustomBoardButton = document.getElementById('clearCustomBoard');
    const fillStandardBoardButton = document.getElementById('fillStandardBoard');
    const loadFenButton = document.getElementById('loadFenButton');
    const cancelCustomSetupButton = document.getElementById('cancelCustomSetup');
    const applyCustomSetupButton = document.getElementById('applyCustomSetup');
    const closeCustomSetupButton = document.getElementById('closeCustomSetup');
    const zeroPlayerControls = document.getElementById('zeroPlayerControls');
    const zeroPlayerStartButton = document.getElementById('startZeroPlayerButton');
    const zeroPlayerStopButton = document.getElementById('stopZeroPlayerButton');

    const botOptions = [
        { id: 'random', label: 'Random Moves' },
        { id: 'worst', label: 'Worst Moves' },
        { id: 'stockfish', label: 'Stockfish' }
    ];

    function createInitialCustomMixState() {
        return botOptions.reduce((acc, bot) => {
            acc[bot.id] = { selected: false, weight: 0 };
            return acc;
        }, {});
    }

    function getCustomMixElements(color) {
        const container = document.querySelector(`.custom-mix-container[data-color="${color}"]`);
        return {
            container,
            options: container ? container.querySelector('.custom-mix-options') : null,
            summary: container ? container.querySelector('.custom-mix-summary') : null,
            error: container ? container.querySelector('.custom-mix-error') : null
        };
    }

    const customMixElements = {
        w: getCustomMixElements('w'),
        b: getCustomMixElements('b')
    };

    const customMixState = {
        w: createInitialCustomMixState(),
        b: createInitialCustomMixState()
    };
    const customMixControls = {
        w: new Map(),
        b: new Map()
    };
    const lastValidCustomMix = {
        w: [],
        b: []
    };
    const isUpdatingCustomMixInternally = {
        w: false,
        b: false
    };

    let selectedPiece = null;
    let turn = 'w'; // 'w' for white, 'b' for black
    let lastMove = null; // To keep track of the last move
    let gameMode = 'twoPlayer'; // Default game mode
    const botDifficulty = {
        w: botSelectors.w ? botSelectors.w.value : 'random',
        b: botSelectors.b ? botSelectors.b.value : 'random'
    };
    let fullmoveNumber = 1;
    let halfmoveClock = 0;
    let positionCounts = Object.create(null);
    let engine;
    let gameOver = false;
    let pendingBotMoveTimeout = null;
    let zeroPlayerPaused = false;
    const promMap = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };
    const moveHistoryList = document.getElementById('moveHistoryList');
    let moveHistoryEntries = [];
    let historyStates = [];
    let currentHistoryIndex = 0;
    let pendingPromotion = null;
    const fileLetters = 'abcdefgh';
    const pieceNotationMap = { pawn: '', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' };
    const CASTLING_KING_TARGET_COLUMNS = { king: 6, queen: 2 };
    const CASTLING_ROOK_TARGET_COLUMNS = { king: 5, queen: 3 };
    const whiteCapturedList = document.getElementById('whiteCapturedPieces');
    const blackCapturedList = document.getElementById('blackCapturedPieces');
    const whiteMaterialAdvantage = document.getElementById('whiteMaterialAdvantage');
    const blackMaterialAdvantage = document.getElementById('blackMaterialAdvantage');
    const capturedPieceOrder = ['queen', 'rook', 'bishop', 'knight', 'pawn'];
    const capturedPieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9 };
    const DRAW_MESSAGES = {
        stalemate: 'Draw by stalemate.',
        threefold: 'Draw by threefold repetition.',
        fiftyMove: 'Draw by fifty-move rule.',
        insufficientMaterial: 'Draw by insufficient material.'
    };

    function createEmptyCapturedPiecesState() {
        return { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0 };
    }

    let capturedPiecesState = {
        w: createEmptyCapturedPiecesState(),
        b: createEmptyCapturedPiecesState()
    };

    let gameType = gameTypeSelect ? gameTypeSelect.value : 'standard';
    let customSetup = null;
    let currentInitialSetup = null;
    let castlingRightsState = createEmptyCastlingRights();
    let castlingRookColumns = createEmptyCastlingRookColumns();
    let kingHomeRows = { w: 7, b: 0 };
    const editorState = {
        board: createEmptyBoardMatrix(),
        selectedPiece: null,
        turn: 'w',
        castling: createEmptyCastlingRights(),
        enPassant: '-',
        fullmove: 1,
        halfmove: 0
    };
    let activePaletteButton = null;

    function createEmptyCastlingRights() {
        return {
            w: { kingSide: false, queenSide: false },
            b: { kingSide: false, queenSide: false }
        };
    }

    function createEmptyCastlingRookColumns() {
        return {
            w: { kingSide: null, queenSide: null },
            b: { kingSide: null, queenSide: null }
        };
    }

    function createEmptyBoardMatrix() {
        const board = [];
        for (let row = 0; row < 8; row++) {
            board[row] = Array(8).fill(null);
        }
        return board;
    }

    function cloneCapturedPiecesState(state) {
        if (!state) {
            return {
                w: createEmptyCapturedPiecesState(),
                b: createEmptyCapturedPiecesState()
            };
        }
        return {
            w: { ...createEmptyCapturedPiecesState(), ...(state.w || {}) },
            b: { ...createEmptyCapturedPiecesState(), ...(state.b || {}) }
        };
    }

    function clonePositionCounts(source = positionCounts) {
        const clone = Object.create(null);
        if (!source) {
            return clone;
        }
        Object.keys(source).forEach(key => {
            clone[key] = source[key];
        });
        return clone;
    }

    function calculateCapturedMaterial(counts = {}) {
        return capturedPieceOrder.reduce((total, type) => {
            const amount = counts[type] || 0;
            const value = capturedPieceValues[type] || 0;
            return total + amount * value;
        }, 0);
    }

    function updateMaterialAdvantageDisplay() {
        if (!whiteMaterialAdvantage || !blackMaterialAdvantage) {
            return;
        }
        const whiteScore = calculateCapturedMaterial(capturedPiecesState.w);
        const blackScore = calculateCapturedMaterial(capturedPiecesState.b);
        const diff = whiteScore - blackScore;
        whiteMaterialAdvantage.textContent = '';
        blackMaterialAdvantage.textContent = '';
        if (diff > 0) {
            whiteMaterialAdvantage.textContent = `+${diff}`;
        } else if (diff < 0) {
            blackMaterialAdvantage.textContent = `+${Math.abs(diff)}`;
        }
    }

    function renderCapturedPiecesForColor(color) {
        const listEl = color === 'w' ? whiteCapturedList : blackCapturedList;
        if (!listEl) {
            return;
        }
        listEl.innerHTML = '';
        const counts = capturedPiecesState[color];
        if (!counts) {
            return;
        }
        const opponentColor = color === 'w' ? 'b' : 'w';
        capturedPieceOrder.forEach(type => {
            const count = counts[type] || 0;
            for (let i = 0; i < count; i++) {
                const img = document.createElement('img');
                img.src = `images/${type}-${opponentColor}.svg`;
                img.alt = `${opponentColor === 'w' ? 'White' : 'Black'} ${type}`;
                img.className = 'captured-piece-icon';
                listEl.appendChild(img);
            }
        });
    }

    function renderAllCapturedPieces() {
        renderCapturedPiecesForColor('w');
        renderCapturedPiecesForColor('b');
        updateMaterialAdvantageDisplay();
    }

    function resetCapturedPiecesTracking() {
        capturedPiecesState = {
            w: createEmptyCapturedPiecesState(),
            b: createEmptyCapturedPiecesState()
        };
        renderAllCapturedPieces();
    }

    function recordCapturedPiece(color, pieceType) {
        if (!pieceType) {
            return;
        }
        const counts = capturedPiecesState[color];
        if (!counts || !(pieceType in counts)) {
            return;
        }
        counts[pieceType] += 1;
        renderAllCapturedPieces();
    }

    function getRepetitionKey(activeColor) {
        const color = activeColor === 'b' ? 'b' : 'w';
        return generateFEN({ overrideTurn: color, includeCounters: false });
    }

    function recordPositionForRepetition(activeColor) {
        const key = getRepetitionKey(activeColor);
        if (!positionCounts[key]) {
            positionCounts[key] = 0;
        }
        positionCounts[key] += 1;
        return positionCounts[key];
    }

    function resetDrawTracking(initialHalfmove = 0) {
        halfmoveClock = Number.isFinite(initialHalfmove) && initialHalfmove >= 0 ? initialHalfmove : 0;
        positionCounts = Object.create(null);
        recordPositionForRepetition(turn);
    }

    function isInsufficientMaterial() {
        const pieces = Array.from(document.querySelectorAll('.piece'));
        const bishops = { w: [], b: [] };
        const knights = { w: 0, b: 0 };

        for (const piece of pieces) {
            const type = piece.dataset.type;
            const color = piece.dataset.color;
            if (!type || !color || type === 'king') {
                continue;
            }
            if (type === 'pawn' || type === 'rook' || type === 'queen') {
                return false;
            }
            const parent = piece.parentElement;
            if (!parent) {
                continue;
            }
            const row = parseInt(parent.dataset.row, 10);
            const col = parseInt(parent.dataset.col, 10);
            if (type === 'bishop') {
                const squareColor = ((row + col) % 2 === 0) ? 'light' : 'dark';
                bishops[color].push(squareColor);
            } else if (type === 'knight') {
                knights[color] += 1;
            } else {
                return false;
            }
        }

        const totalBishops = bishops.w.length + bishops.b.length;
        const totalKnights = knights.w + knights.b;
        const totalMinorPieces = totalBishops + totalKnights;

        if (totalMinorPieces === 0) {
            return true;
        }
        if (totalMinorPieces === 1) {
            return true;
        }
        if (totalMinorPieces === 2) {
            if (totalKnights === 2 && totalBishops === 0) {
                return true;
            }
            if (totalKnights === 0 && totalBishops === 2) {
                if (bishops.w.length === 1 && bishops.b.length === 1) {
                    if (bishops.w[0] === bishops.b[0]) {
                        return true;
                    }
                }
                if (bishops.w.length === 2 && new Set(bishops.w).size === 1 && bishops.b.length === 0) {
                    return true;
                }
                if (bishops.b.length === 2 && new Set(bishops.b).size === 1 && bishops.w.length === 0) {
                    return true;
                }
            }
        }

        return false;
    }

    function detectDrawCondition({ isCheck, opponentHasMoves, repetitionCount }) {
        if (!isCheck && !opponentHasMoves) {
            return 'stalemate';
        }
        if (halfmoveClock >= 100) {
            return 'fiftyMove';
        }
        if (repetitionCount >= 3) {
            return 'threefold';
        }
        if (isInsufficientMaterial()) {
            return 'insufficientMaterial';
        }
        return null;
    }

    function declareDraw(reason) {
        if (gameOver) {
            return;
        }
        gameOver = true;
        cancelScheduledBotMove();
        updateZeroPlayerControlsState();
        const message = DRAW_MESSAGES[reason] || 'Draw.';
        alert(`Game over! ${message}`);
    }

    gameModeSelect.addEventListener("change", () => {
        gameMode = gameModeSelect.value;
        zeroPlayerPaused = false;
        cancelScheduledBotMove();
        updateBotSelectionVisibility();
        updateCustomMixVisibility();
        updateZeroPlayerControlsState();
        resetGame(); // Reset the game when switching modes
    });

    if (gameTypeSelect) {
        gameTypeSelect.addEventListener('change', () => {
            gameType = gameTypeSelect.value;
            updateCustomSetupButtonVisibility();
            if (gameType === 'custom' && !customSetup) {
                customSetup = createStandardSetup();
            }
            resetGame();
        });
    }

    if (editCustomSetupButton) {
        editCustomSetupButton.addEventListener('click', () => {
            openCustomSetupModal();
        });
    }

    Object.entries(botSelectors).forEach(([color, select]) => {
        if (!select) {
            return;
        }
        select.addEventListener('change', () => {
            botDifficulty[color] = select.value;
            updateCustomMixVisibility();
            evaluateBoard();
            if (turn === color && isColorBotControlled(color)) {
                scheduleBotMoveIfNeeded({ force: true });
            }
        });
    });

    if (zeroPlayerStartButton) {
        zeroPlayerStartButton.addEventListener('click', () => {
            if (gameMode !== 'zeroPlayer' || gameOver || !zeroPlayerPaused) {
                return;
            }
            zeroPlayerPaused = false;
            updateZeroPlayerControlsState();
            scheduleBotMoveIfNeeded({ force: true });
        });
    }

    if (zeroPlayerStopButton) {
        zeroPlayerStopButton.addEventListener('click', () => {
            if (gameMode !== 'zeroPlayer' || zeroPlayerPaused) {
                return;
            }
            zeroPlayerPaused = true;
            cancelScheduledBotMove();
            if (engine) {
                engine.postMessage('stop');
                engine.bestMoveCallback = null;
            }
            updateZeroPlayerControlsState();
        });
    }

    function getSelectedCustomMixCount(color) {
        const state = customMixState[color];
        if (!state) {
            return 0;
        }
        return botOptions.reduce((count, bot) => {
            const entry = state[bot.id];
            return count + (entry && entry.selected ? 1 : 0);
        }, 0);
    }

    function updateCustomMixError(color, message) {
        const elements = customMixElements[color];
        if (!elements || !elements.error) {
            return;
        }
        elements.error.textContent = message;
    }

    function updateCustomMixSummaryDisplay(color, total) {
        const elements = customMixElements[color];
        if (!elements || !elements.summary) {
            return;
        }
        const roundedTotal = Number.isFinite(total) ? total : 0;
        elements.summary.textContent = `Total: ${roundedTotal}%`;
    }

    function getCustomMixSummary(color) {
        const summary = {
            entries: [],
            totalWeight: 0,
            selectedCount: 0,
            valid: false
        };

        const state = customMixState[color];
        if (!state) {
            return summary;
        }

        botOptions.forEach(bot => {
            const entry = state[bot.id];
            if (!entry) {
                return;
            }
            if (entry.selected) {
                summary.selectedCount += 1;
                summary.totalWeight += entry.weight;
                if (entry.weight > 0) {
                    summary.entries.push({ id: bot.id, weight: entry.weight });
                }
            }
        });

        summary.valid = summary.selectedCount >= 2 && summary.totalWeight === 100 && summary.entries.length > 0;
        return summary;
    }

    function handleCustomMixChange(color) {
        const summary = getCustomMixSummary(color);
        updateCustomMixSummaryDisplay(color, summary.totalWeight);

        let message = '';
        if (summary.selectedCount < 2) {
            message = 'Select at least two bots for the mix.';
        } else if (summary.totalWeight !== 100) {
            message = `Total must equal 100% (current: ${summary.totalWeight}%).`;
        } else if (summary.entries.length === 0) {
            message = 'Assign a positive percentage to at least one bot.';
        } else {
            lastValidCustomMix[color] = summary.entries.map(entry => ({ ...entry }));
        }

        updateCustomMixError(color, message);
    }

    function setCustomMixWeight(color, botId, weight, options = {}) {
        const { skipComplement = false, skipChangeHandler = false } = options;
        const controlsMap = customMixControls[color];
        const stateMap = customMixState[color];
        if (!controlsMap || !stateMap) {
            return;
        }
        const controls = controlsMap.get(botId);
        const state = stateMap[botId];
        if (!controls || !state) {
            return;
        }

        const rounded = Math.round(weight / 5) * 5;
        const clamped = Math.max(0, Math.min(100, rounded));
        state.weight = clamped;

        isUpdatingCustomMixInternally[color] = true;
        controls.slider.value = String(clamped);
        controls.number.value = String(clamped);
        isUpdatingCustomMixInternally[color] = false;

        if (!skipComplement) {
            adjustComplementIfNeeded(color, botId);
        }

        if (!skipChangeHandler) {
            handleCustomMixChange(color);
        }
    }

    function adjustComplementIfNeeded(color, botId) {
        const state = customMixState[color];
        if (!state) {
            return;
        }
        const selectedBots = botOptions.filter(bot => {
            const entry = state[bot.id];
            return entry && entry.selected;
        });

        if (selectedBots.length !== 2) {
            return;
        }

        const otherBot = selectedBots.find(bot => bot.id !== botId);
        if (!otherBot) {
            return;
        }

        const targetWeight = Math.max(0, 100 - state[botId].weight);
        setCustomMixWeight(color, otherBot.id, targetWeight, { skipComplement: true, skipChangeHandler: true });
    }

    function setCustomMixSelected(color, botId, selected, options = {}) {
        const { skipChangeHandler = false } = options;
        const controlsMap = customMixControls[color];
        const stateMap = customMixState[color];
        if (!controlsMap || !stateMap) {
            return;
        }
        const controls = controlsMap.get(botId);
        const state = stateMap[botId];
        if (!controls || !state) {
            return;
        }

        state.selected = selected;

        isUpdatingCustomMixInternally[color] = true;
        controls.checkbox.checked = selected;
        controls.slider.disabled = !selected;
        controls.number.disabled = !selected;
        controls.slider.value = String(state.weight);
        controls.number.value = String(state.weight);
        isUpdatingCustomMixInternally[color] = false;

        if (!selected) {
            setCustomMixWeight(color, botId, 0, { skipComplement: true, skipChangeHandler: true });
        }

        if (!skipChangeHandler) {
            handleCustomMixChange(color);
        }
    }

    function renderCustomMixOptions(color) {
        const elements = customMixElements[color];
        if (!elements || !elements.options) {
            return;
        }

        elements.options.innerHTML = '';
        const controlsMap = customMixControls[color];
        if (controlsMap) {
            controlsMap.clear();
        }

        botOptions.forEach(bot => {
            const row = document.createElement('div');
            row.className = 'custom-mix-row';

            const header = document.createElement('div');
            header.className = 'custom-mix-row-header';

            const label = document.createElement('label');
            label.className = 'custom-mix-label';
            label.setAttribute('for', `custom-mix-${color}-${bot.id}`);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `custom-mix-${color}-${bot.id}`;
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
            elements.options.appendChild(row);

            controlsMap.set(bot.id, { checkbox, slider, number });

            const state = customMixState[color][bot.id];

            checkbox.addEventListener('change', () => {
                if (isUpdatingCustomMixInternally[color]) {
                    return;
                }

                if (!checkbox.checked) {
                    const selectedCount = getSelectedCustomMixCount(color);
                    if (state.selected && selectedCount <= 2) {
                        checkbox.checked = true;
                        return;
                    }
                }

                setCustomMixSelected(color, bot.id, checkbox.checked);
            });

            slider.addEventListener('input', () => {
                if (isUpdatingCustomMixInternally[color] || slider.disabled) {
                    return;
                }
                setCustomMixWeight(color, bot.id, parseInt(slider.value, 10));
            });

            number.addEventListener('input', () => {
                if (isUpdatingCustomMixInternally[color] || number.disabled) {
                    return;
                }
                const value = parseInt(number.value, 10);
                if (Number.isNaN(value)) {
                    return;
                }
                setCustomMixWeight(color, bot.id, value);
            });

            number.addEventListener('change', () => {
                if (isUpdatingCustomMixInternally[color] || number.disabled) {
                    return;
                }
                const value = parseInt(number.value, 10);
                setCustomMixWeight(color, bot.id, Number.isNaN(value) ? 0 : value);
            });
        });

        botOptions.forEach(bot => {
            const state = customMixState[color][bot.id];
            if (!state) {
                return;
            }
            setCustomMixSelected(color, bot.id, state.selected, { skipChangeHandler: true });
            setCustomMixWeight(color, bot.id, state.weight, { skipComplement: true, skipChangeHandler: true });
        });

        handleCustomMixChange(color);
    }

    function initializeCustomMixDefaults(color) {
        if (!botOptions.length) {
            lastValidCustomMix[color] = [];
            return;
        }

        botOptions.forEach(bot => {
            setCustomMixSelected(color, bot.id, false, { skipChangeHandler: true });
        });

        if (botOptions.length >= 2) {
            setCustomMixSelected(color, botOptions[0].id, true, { skipChangeHandler: true });
            setCustomMixSelected(color, botOptions[1].id, true, { skipChangeHandler: true });
            setCustomMixWeight(color, botOptions[0].id, 50, { skipComplement: true, skipChangeHandler: true });
            setCustomMixWeight(color, botOptions[1].id, 50, { skipComplement: true, skipChangeHandler: true });
            lastValidCustomMix[color] = [
                { id: botOptions[0].id, weight: 50 },
                { id: botOptions[1].id, weight: 50 }
            ];
        } else if (botOptions.length === 1) {
            setCustomMixSelected(color, botOptions[0].id, true, { skipChangeHandler: true });
            setCustomMixWeight(color, botOptions[0].id, 100, { skipComplement: true, skipChangeHandler: true });
            lastValidCustomMix[color] = [{ id: botOptions[0].id, weight: 100 }];
        } else {
            lastValidCustomMix[color] = [];
        }

        handleCustomMixChange(color);
    }

    function getActiveCustomMixEntries(color) {
        const summary = getCustomMixSummary(color);
        if (summary.valid) {
            return summary.entries;
        }
        return lastValidCustomMix[color];
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

    function getBotControlledColors() {
        if (gameMode === 'onePlayer') {
            return ['b'];
        }
        if (gameMode === 'zeroPlayer') {
            return ['w', 'b'];
        }
        return [];
    }

    function isColorBotControlled(color) {
        return getBotControlledColors().includes(color);
    }

    function updateCustomMixVisibility() {
        ['w', 'b'].forEach(color => {
            const elements = customMixElements[color];
            if (!elements || !elements.container) {
                return;
            }
            const shouldShow = isColorBotControlled(color) && botDifficulty[color] === 'custom';
            elements.container.style.display = shouldShow ? 'block' : 'none';
        });
    }

    function updateBotSelectionVisibility() {
        if (!botSelection) {
            return;
        }
        const activeColors = getBotControlledColors();
        botSelection.style.display = activeColors.length ? 'flex' : 'none';
        ['w', 'b'].forEach(color => {
            const group = botSelectionGroups[color];
            if (!group) {
                return;
            }
            group.style.display = activeColors.includes(color) ? 'flex' : 'none';
        });
    }

    function isZeroPlayerAutomationPaused() {
        return gameMode === 'zeroPlayer' && zeroPlayerPaused;
    }

    function updateZeroPlayerControlsState() {
        if (!zeroPlayerControls) {
            return;
        }
        const isZeroPlayer = gameMode === 'zeroPlayer';
        zeroPlayerControls.style.display = isZeroPlayer ? 'flex' : 'none';
        if (!isZeroPlayer) {
            return;
        }
        if (zeroPlayerStartButton) {
            zeroPlayerStartButton.disabled = !zeroPlayerPaused || gameOver;
        }
        if (zeroPlayerStopButton) {
            zeroPlayerStopButton.disabled = zeroPlayerPaused || gameOver;
        }
    }

    function isStockfishEvaluationEnabled() {
        if (gameType === 'chess960') {
            return false;
        }

        return getBotControlledColors().some(color => {
            const selection = botDifficulty[color];
            if (selection === 'stockfish') {
                return true;
            }
            if (selection === 'custom') {
                const summary = getCustomMixSummary(color);
                if (summary.valid) {
                    return summary.entries.some(entry => entry.id === 'stockfish');
                }
                const lastValid = lastValidCustomMix[color] || [];
                return lastValid.some(entry => entry.id === 'stockfish');
            }
            return false;
        });
    }

    function cloneBoardMatrix(board) {
        return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
    }

    function cloneSetup(setup) {
        if (!setup) {
            return null;
        }
        return {
            board: cloneBoardMatrix(setup.board || createEmptyBoardMatrix()),
            turn: setup.turn === 'b' ? 'b' : 'w',
            castling: typeof setup.castling === 'string' ? setup.castling : '-',
            enPassant: setup.enPassant || '-',
            fullmove: Number.isFinite(setup.fullmove) && setup.fullmove > 0 ? setup.fullmove : 1,
            halfmove: Number.isFinite(setup.halfmove) && setup.halfmove >= 0 ? setup.halfmove : 0
        };
    }

    function createStandardSetup() {
        const board = createEmptyBoardMatrix();
        const whiteBack = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        const blackBack = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let col = 0; col < 8; col++) {
            board[7][col] = { type: whiteBack[col], color: 'w', moved: false };
            board[6][col] = { type: 'pawn', color: 'w', moved: false };
            board[1][col] = { type: 'pawn', color: 'b', moved: false };
            board[0][col] = { type: blackBack[col], color: 'b', moved: false };
        }
        return {
            board,
            turn: 'w',
            castling: 'KQkq',
            enPassant: '-',
            fullmove: 1,
            halfmove: 0
        };
    }

    function createChess960Setup() {
        const board = createEmptyBoardMatrix();
        const evenPositions = [0, 2, 4, 6];
        const oddPositions = [1, 3, 5, 7];
        const backRank = Array(8).fill(null);

        const darkIndex = evenPositions.splice(Math.floor(Math.random() * evenPositions.length), 1)[0];
        const lightIndex = oddPositions.splice(Math.floor(Math.random() * oddPositions.length), 1)[0];
        backRank[darkIndex] = 'bishop';
        backRank[lightIndex] = 'bishop';

        const remaining = [];
        for (let i = 0; i < 8; i++) {
            if (!backRank[i]) {
                remaining.push(i);
            }
        }

        const queenIndex = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
        backRank[queenIndex] = 'queen';

        const knightIndex1 = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
        backRank[knightIndex1] = 'knight';
        const knightIndex2 = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
        backRank[knightIndex2] = 'knight';

        remaining.sort((a, b) => a - b);
        backRank[remaining[0]] = 'rook';
        backRank[remaining[1]] = 'king';
        backRank[remaining[2]] = 'rook';

        for (let col = 0; col < 8; col++) {
            board[7][col] = { type: backRank[col], color: 'w', moved: false };
            board[6][col] = { type: 'pawn', color: 'w', moved: false };
            board[1][col] = { type: 'pawn', color: 'b', moved: false };
            board[0][col] = { type: backRank[col], color: 'b', moved: false };
        }

        return {
            board,
            turn: 'w',
            castling: 'KQkq',
            enPassant: '-',
            fullmove: 1,
            halfmove: 0
        };
    }

    function parseFEN(fen) {
        if (typeof fen !== 'string' || !fen.trim()) {
            throw new Error('FEN cannot be empty.');
        }
        const parts = fen.trim().split(/\s+/);
        if (parts.length < 4) {
            throw new Error('FEN must contain at least 4 fields.');
        }
        const [placement, activeColor, castlingRights, enPassantTarget, halfmoveStr, fullmoveStr] = parts;
        const rows = placement.split('/');
        if (rows.length !== 8) {
            throw new Error('FEN board description must have 8 ranks.');
        }

        const board = createEmptyBoardMatrix();
        let whiteKingCount = 0;
        let blackKingCount = 0;

        rows.forEach((rowStr, rowIndex) => {
            let colIndex = 0;
            for (const char of rowStr) {
                if (colIndex > 7) {
                    throw new Error('FEN rank has too many squares.');
                }
                if (/^[1-8]$/.test(char)) {
                    colIndex += parseInt(char, 10);
                    continue;
                }
                const lower = char.toLowerCase();
                const typeMap = {
                    p: 'pawn',
                    r: 'rook',
                    n: 'knight',
                    b: 'bishop',
                    q: 'queen',
                    k: 'king'
                };
                const type = typeMap[lower];
                if (!type) {
                    throw new Error(`Invalid piece character '${char}' in FEN.`);
                }
                const color = char === lower ? 'b' : 'w';
                if (type === 'king') {
                    if (color === 'w') {
                        whiteKingCount += 1;
                    } else {
                        blackKingCount += 1;
                    }
                }
                const pieceData = {
                    type,
                    color,
                    moved: false
                };
                if (type === 'pawn') {
                    const homeRow = color === 'w' ? 6 : 1;
                    pieceData.moved = rowIndex !== homeRow;
                }
                board[rowIndex][colIndex] = pieceData;
                colIndex += 1;
            }
            if (colIndex !== 8) {
                throw new Error('FEN rank does not add up to 8 squares.');
            }
        });

        if (whiteKingCount !== 1 || blackKingCount !== 1) {
            throw new Error('FEN must contain exactly one king per side.');
        }

        const turn = activeColor === 'b' ? 'b' : 'w';
        let enPassant = '-';
        if (enPassantTarget && enPassantTarget !== '-') {
            if (!/^[a-h][36]$/.test(enPassantTarget)) {
                throw new Error('Invalid en passant target square.');
            }
            enPassant = enPassantTarget;
        }

        const halfmove = Number.parseInt(halfmoveStr, 10);
        const fullmove = Number.parseInt(fullmoveStr, 10);

        return {
            board,
            turn,
            castling: castlingRights || '-',
            enPassant,
            fullmove: Number.isFinite(fullmove) && fullmove > 0 ? fullmove : 1,
            halfmove: Number.isFinite(halfmove) && halfmove >= 0 ? halfmove : 0
        };
    }

    function getSetupForCurrentGameType() {
        if (gameType === 'chess960') {
            return createChess960Setup();
        }
        if (gameType === 'custom') {
            if (!customSetup) {
                customSetup = createStandardSetup();
            }
            return cloneSetup(customSetup);
        }
        return createStandardSetup();
    }

    function inferLastMoveFromEnPassant(target, activeTurn) {
        if (!target || target === '-' || target.length !== 2) {
            return null;
        }
        const file = target[0];
        const rank = parseInt(target[1], 10);
        if (!fileLetters.includes(file) || Number.isNaN(rank)) {
            return null;
        }
        const col = fileLetters.indexOf(file);
        if (rank === 3 && activeTurn === 'b') {
            return {
                color: 'w',
                pieceType: 'pawn',
                fromRow: 6,
                fromCol: col,
                toRow: 4,
                toCol: col,
                resultingPieceType: 'pawn',
                isCapture: false,
                capturedPieceType: null,
                capturedPieceColor: null,
                isEnPassant: false,
                isCastling: null
            };
        }
        if (rank === 6 && activeTurn === 'w') {
            return {
                color: 'b',
                pieceType: 'pawn',
                fromRow: 1,
                fromCol: col,
                toRow: 3,
                toCol: col,
                resultingPieceType: 'pawn',
                isCapture: false,
                capturedPieceType: null,
                capturedPieceColor: null,
                isEnPassant: false,
                isCastling: null
            };
        }
        return null;
    }

    function computeCastlingInfo(board, rightsString = '-') {
        const rights = createEmptyCastlingRights();
        const rooks = createEmptyCastlingRookColumns();
        const homes = { w: 7, b: 0 };

        const kingPositions = { w: null, b: null };
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = board[row][col];
                if (cell && cell.type === 'king') {
                    kingPositions[cell.color] = { row, col };
                }
            }
        }

        if (kingPositions.w) {
            homes.w = kingPositions.w.row;
        }
        if (kingPositions.b) {
            homes.b = kingPositions.b.row;
        }

        const assignByDirection = (color, direction) => {
            const kingPos = kingPositions[color];
            if (!kingPos) {
                return;
            }
            let col = kingPos.col + direction;
            while (col >= 0 && col < 8) {
                const piece = board[kingPos.row][col];
                if (piece && piece.type === 'rook' && piece.color === color) {
                    const sideKey = direction > 0 ? 'kingSide' : 'queenSide';
                    rights[color][sideKey] = true;
                    rooks[color][sideKey] = col;
                    break;
                }
                col += direction;
            }
        };

        const assignByColumn = (color, column) => {
            const kingPos = kingPositions[color];
            if (!kingPos || column < 0 || column > 7) {
                return;
            }
            const piece = board[kingPos.row][column];
            if (!piece || piece.type !== 'rook' || piece.color !== color) {
                return;
            }
            const sideKey = column > kingPos.col ? 'kingSide' : 'queenSide';
            rights[color][sideKey] = true;
            rooks[color][sideKey] = column;
        };

        if (rightsString && rightsString !== '-') {
            rightsString.split('').forEach(char => {
                if (char === 'K') {
                    assignByDirection('w', 1);
                } else if (char === 'Q') {
                    assignByDirection('w', -1);
                } else if (char === 'k') {
                    assignByDirection('b', 1);
                } else if (char === 'q') {
                    assignByDirection('b', -1);
                } else if (/[A-H]/.test(char)) {
                    assignByColumn('w', fileLetters.indexOf(char.toLowerCase()));
                } else if (/[a-h]/.test(char)) {
                    assignByColumn('b', fileLetters.indexOf(char));
                }
            });
        }

        return { rights, rooks, homes };
    }

    function initializeCastlingTracking(board, rightsString = '-') {
        const info = computeCastlingInfo(board, rightsString);
        castlingRightsState = info.rights;
        castlingRookColumns = info.rooks;
        kingHomeRows = info.homes;
    }

    function disableCastlingRight(color, sideKey) {
        if (castlingRightsState[color]) {
            castlingRightsState[color][sideKey] = false;
        }
        if (castlingRookColumns[color]) {
            castlingRookColumns[color][sideKey] = null;
        }
    }

    function getCastlingSideByColumn(color, column) {
        if (!castlingRookColumns[color]) {
            return null;
        }
        if (castlingRookColumns[color].kingSide === column) {
            return 'kingSide';
        }
        if (castlingRookColumns[color].queenSide === column) {
            return 'queenSide';
        }
        return null;
    }

    function updateCastlingRightsAfterMove(moveDetails, capturedRow, capturedCol) {
        const { pieceType, color, fromCol, capturedPieceType, capturedPieceColor } = moveDetails;
        if (pieceType === 'king') {
            disableCastlingRight(color, 'kingSide');
            disableCastlingRight(color, 'queenSide');
        }
        if (pieceType === 'rook') {
            const sideKey = getCastlingSideByColumn(color, fromCol);
            if (sideKey) {
                disableCastlingRight(color, sideKey);
            }
        }
        if (capturedPieceType === 'rook' && capturedPieceColor != null && capturedCol != null) {
            const homeRow = getHomeRow(capturedPieceColor);
            if (capturedRow === homeRow) {
                const enemySide = getCastlingSideByColumn(capturedPieceColor, capturedCol);
                if (enemySide) {
                    disableCastlingRight(capturedPieceColor, enemySide);
                }
            }
        }
    }

    function getHomeRow(color) {
        if (kingHomeRows[color] !== undefined) {
            return kingHomeRows[color];
        }
        return color === 'w' ? 7 : 0;
    }

    function getCastlingSideForMove(color, toCol) {
        if (!castlingRightsState[color]) {
            return null;
        }
        if (castlingRightsState[color].kingSide && toCol === CASTLING_KING_TARGET_COLUMNS.king) {
            return 'king';
        }
        if (castlingRightsState[color].queenSide && toCol === CASTLING_KING_TARGET_COLUMNS.queen) {
            return 'queen';
        }
        return null;
    }

    function applySetupToGame(setup) {
        cancelScheduledBotMove();
        currentInitialSetup = cloneSetup(setup);
        const promotionUI = document.querySelector('.promotion-ui');
        if (promotionUI) {
            promotionUI.remove();
        }
        pendingPromotion = null;

        const board = cloneBoardMatrix(setup.board || createEmptyBoardMatrix());
        chessboard.innerHTML = '';
        createBoard(board);
        initializeCastlingTracking(board, setup.castling || '-');

        selectedPiece = null;
        turn = setup.turn === 'b' ? 'b' : 'w';
        fullmoveNumber = Number.isFinite(setup.fullmove) && setup.fullmove > 0 ? setup.fullmove : 1;
        lastMove = inferLastMoveFromEnPassant(setup.enPassant, turn);
        resetDrawTracking(Number.isFinite(setup.halfmove) && setup.halfmove >= 0 ? setup.halfmove : 0);
        gameOver = false;
        moveHistoryEntries = [];
        historyStates = [];
        currentHistoryIndex = 0;
        resetCapturedPiecesTracking();
        document.querySelectorAll('.check').forEach(square => square.classList.remove('check'));
        const popup = document.querySelector('.checkmate-popup');
        if (popup) {
            popup.remove();
        }
        historyStates.push(captureDetailedState());
        updateMoveHistoryUI();
        evaluateBoard();
        updateZeroPlayerControlsState();
        scheduleBotMoveIfNeeded({ force: true });
    }

    function sanitizeEnPassantValue(value) {
        if (!value) {
            return '-';
        }
        const trimmed = value.trim().toLowerCase();
        if (trimmed === '-') {
            return '-';
        }
        if (/^[a-h][36]$/.test(trimmed)) {
            return trimmed;
        }
        return '-';
    }

    function renderCustomSetupBoard() {
        if (!customSetupBoard) {
            return;
        }
        customSetupBoard.innerHTML = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `custom-setup-square ${((row + col) % 2 === 0) ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                const pieceData = editorState.board[row][col];
                if (pieceData) {
                    const img = document.createElement('img');
                    img.src = `images/${pieceData.type}-${pieceData.color}.svg`;
                    img.alt = `${pieceData.color} ${pieceData.type}`;
                    square.appendChild(img);
                }
                square.addEventListener('click', () => handleEditorSquareClick(row, col));
                customSetupBoard.appendChild(square);
            }
        }
    }

    function handleEditorSquareClick(row, col) {
        const selection = editorState.selectedPiece;
        if (!selection) {
            editorState.board[row][col] = null;
        } else {
            const homeRow = selection.color === 'w' ? 6 : 1;
            editorState.board[row][col] = {
                type: selection.type,
                color: selection.color,
                moved: selection.type === 'pawn' ? row !== homeRow : false
            };
        }
        renderCustomSetupBoard();
    }

    function selectPalettePiece(piece, button) {
        editorState.selectedPiece = piece;
        if (activePaletteButton) {
            activePaletteButton.classList.remove('selected');
        }
        activePaletteButton = button;
        if (activePaletteButton) {
            activePaletteButton.classList.add('selected');
        }
    }

    function renderPiecePalette() {
        if (!customPiecePalette) {
            return;
        }
        customPiecePalette.innerHTML = '';
        const palettePieces = [
            { type: 'king', color: 'w' },
            { type: 'queen', color: 'w' },
            { type: 'rook', color: 'w' },
            { type: 'bishop', color: 'w' },
            { type: 'knight', color: 'w' },
            { type: 'pawn', color: 'w' },
            { type: 'king', color: 'b' },
            { type: 'queen', color: 'b' },
            { type: 'rook', color: 'b' },
            { type: 'bishop', color: 'b' },
            { type: 'knight', color: 'b' },
            { type: 'pawn', color: 'b' }
        ];

        palettePieces.forEach(piece => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'piece-palette-button';
            button.dataset.type = piece.type;
            button.dataset.color = piece.color;
            const img = document.createElement('img');
            img.src = `images/${piece.type}-${piece.color}.svg`;
            img.alt = `${piece.color} ${piece.type}`;
            button.appendChild(img);
            button.addEventListener('click', () => selectPalettePiece({ ...piece }, button));
            customPiecePalette.appendChild(button);
        });

        const eraserButton = document.createElement('button');
        eraserButton.type = 'button';
        eraserButton.className = 'piece-palette-button erase';
        eraserButton.dataset.tool = 'erase';
        eraserButton.textContent = 'Erase';
        eraserButton.addEventListener('click', () => selectPalettePiece(null, eraserButton));
        customPiecePalette.appendChild(eraserButton);

        setPaletteSelectionFromState();
    }

    function setPaletteSelectionFromState() {
        if (!customPiecePalette) {
            return;
        }
        let targetButton = null;
        if (editorState.selectedPiece) {
            const { type, color } = editorState.selectedPiece;
            targetButton = customPiecePalette.querySelector(`.piece-palette-button[data-type='${type}'][data-color='${color}']`);
        } else {
            targetButton = customPiecePalette.querySelector('.piece-palette-button[data-tool="erase"]');
        }
        if (!targetButton) {
            targetButton = customPiecePalette.querySelector(`.piece-palette-button[data-type='pawn'][data-color='w']`);
            editorState.selectedPiece = targetButton ? { type: 'pawn', color: 'w' } : null;
        }
        if (targetButton) {
            if (activePaletteButton) {
                activePaletteButton.classList.remove('selected');
            }
            activePaletteButton = targetButton;
            activePaletteButton.classList.add('selected');
        }
    }

    function loadEditorFromSetup(setup) {
        const cloned = cloneSetup(setup) || createStandardSetup();
        editorState.board = cloneBoardMatrix(cloned.board || createEmptyBoardMatrix());
        editorState.turn = cloned.turn === 'b' ? 'b' : 'w';
        editorState.enPassant = sanitizeEnPassantValue(cloned.enPassant);
        editorState.fullmove = Number.isFinite(cloned.fullmove) && cloned.fullmove > 0 ? cloned.fullmove : 1;
        editorState.halfmove = Number.isFinite(cloned.halfmove) && cloned.halfmove >= 0 ? cloned.halfmove : 0;
        const castlingInfo = computeCastlingInfo(editorState.board, cloned.castling || '-');
        editorState.castling = createEmptyCastlingRights();
        editorState.castling.w.kingSide = castlingInfo.rights.w.kingSide;
        editorState.castling.w.queenSide = castlingInfo.rights.w.queenSide;
        editorState.castling.b.kingSide = castlingInfo.rights.b.kingSide;
        editorState.castling.b.queenSide = castlingInfo.rights.b.queenSide;
        renderCustomSetupBoard();
        updateEditorCastlingUI();
        updateEditorInputs();
        setPaletteSelectionFromState();
    }

    function updateEditorCastlingUI() {
        if (!castlingCheckboxes.w || !castlingCheckboxes.b) {
            return;
        }
        castlingCheckboxes.w.kingSide.checked = !!(editorState.castling.w && editorState.castling.w.kingSide);
        castlingCheckboxes.w.queenSide.checked = !!(editorState.castling.w && editorState.castling.w.queenSide);
        castlingCheckboxes.b.kingSide.checked = !!(editorState.castling.b && editorState.castling.b.kingSide);
        castlingCheckboxes.b.queenSide.checked = !!(editorState.castling.b && editorState.castling.b.queenSide);
    }

    function updateEditorInputs() {
        if (customEnPassantInput) {
            customEnPassantInput.value = editorState.enPassant;
        }
        if (customFullmoveInput) {
            customFullmoveInput.value = editorState.fullmove;
        }
        if (customTurnRadios && customTurnRadios.length) {
            customTurnRadios.forEach(radio => {
                radio.checked = radio.value === editorState.turn;
            });
        }
    }

    function clearEditorBoardState() {
        editorState.board = createEmptyBoardMatrix();
        editorState.castling = createEmptyCastlingRights();
        editorState.enPassant = '-';
        editorState.fullmove = 1;
        editorState.halfmove = 0;
        renderCustomSetupBoard();
        updateEditorCastlingUI();
        updateEditorInputs();
        showEditorError('');
    }

    function fillEditorWithStandard() {
        loadEditorFromSetup(createStandardSetup());
        showEditorError('');
    }

    function openCustomSetupModal() {
        if (!customSetupModal) {
            return;
        }
        showEditorError('');
        if (!customPiecePalette || !customPiecePalette.childElementCount) {
            renderPiecePalette();
        } else {
            setPaletteSelectionFromState();
        }
        const setupToLoad = customSetup ? cloneSetup(customSetup) : createStandardSetup();
        loadEditorFromSetup(setupToLoad);
        customSetupModal.classList.remove('hidden');
    }

    function closeCustomSetupModal() {
        if (!customSetupModal) {
            return;
        }
        customSetupModal.classList.add('hidden');
        showEditorError('');
    }

    function castlingFlagsToString(flags) {
        let result = '';
        if (flags.w && flags.w.kingSide) {
            result += 'K';
        }
        if (flags.w && flags.w.queenSide) {
            result += 'Q';
        }
        if (flags.b && flags.b.kingSide) {
            result += 'k';
        }
        if (flags.b && flags.b.queenSide) {
            result += 'q';
        }
        return result || '-';
    }

    function buildSetupFromEditor() {
        const board = cloneBoardMatrix(editorState.board);
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = board[row][col];
                if (cell) {
                    if (cell.type === 'pawn') {
                        const homeRow = cell.color === 'w' ? 6 : 1;
                        cell.moved = row !== homeRow;
                    } else {
                        cell.moved = cell.moved === true ? true : false;
                    }
                }
            }
        }

        return {
            board,
            turn: editorState.turn === 'b' ? 'b' : 'w',
            castling: castlingFlagsToString(editorState.castling),
            enPassant: sanitizeEnPassantValue(editorState.enPassant),
            fullmove: Number.isFinite(editorState.fullmove) && editorState.fullmove > 0 ? editorState.fullmove : 1,
            halfmove: Number.isFinite(editorState.halfmove) && editorState.halfmove >= 0 ? editorState.halfmove : 0
        };
    }

    function validateEditorSetup(setup) {
        let whiteKing = 0;
        let blackKing = 0;
        setup.board.forEach(row => {
            row.forEach(cell => {
                if (cell && cell.type === 'king') {
                    if (cell.color === 'w') {
                        whiteKing += 1;
                    } else {
                        blackKing += 1;
                    }
                }
            });
        });
        if (whiteKing !== 1 || blackKing !== 1) {
            return 'Custom setup must include exactly one white king and one black king.';
        }

        const castlingInfo = computeCastlingInfo(setup.board, setup.castling || '-');
        if (editorState.castling.w.kingSide && !castlingInfo.rights.w.kingSide) {
            return 'White O-O requires a rook on the king\'s right on the home rank.';
        }
        if (editorState.castling.w.queenSide && !castlingInfo.rights.w.queenSide) {
            return 'White O-O-O requires a rook on the king\'s left on the home rank.';
        }
        if (editorState.castling.b.kingSide && !castlingInfo.rights.b.kingSide) {
            return 'Black O-O requires a rook on the king\'s right on the home rank.';
        }
        if (editorState.castling.b.queenSide && !castlingInfo.rights.b.queenSide) {
            return 'Black O-O-O requires a rook on the king\'s left on the home rank.';
        }

        return null;
    }

    function showEditorError(message) {
        if (customSetupError) {
            customSetupError.textContent = message || '';
        }
    }

    function applyCustomSetupChanges() {
        try {
            const setup = buildSetupFromEditor();
            const validationError = validateEditorSetup(setup);
            if (validationError) {
                showEditorError(validationError);
                return;
            }
            customSetup = cloneSetup(setup);
            if (gameTypeSelect) {
                gameTypeSelect.value = 'custom';
            }
            gameType = 'custom';
            updateCustomSetupButtonVisibility();
            closeCustomSetupModal();
            resetGame();
        } catch (error) {
            showEditorError(error && error.message ? error.message : 'Unable to apply the custom setup.');
        }
    }

    function attachCastlingCheckboxHandler(color, sideKey, checkbox) {
        if (!checkbox) {
            return;
        }
        checkbox.addEventListener('change', () => {
            if (!editorState.castling[color]) {
                editorState.castling[color] = { kingSide: false, queenSide: false };
            }
            editorState.castling[color][sideKey] = checkbox.checked;
        });
    }

    if (clearCustomBoardButton) {
        clearCustomBoardButton.addEventListener('click', () => {
            clearEditorBoardState();
        });
    }

    if (fillStandardBoardButton) {
        fillStandardBoardButton.addEventListener('click', () => {
            fillEditorWithStandard();
        });
    }

    if (loadFenButton) {
        loadFenButton.addEventListener('click', () => {
            if (!customFenInput) {
                return;
            }
            const fenValue = customFenInput.value.trim();
            if (!fenValue) {
                showEditorError('Enter a FEN string to load.');
                return;
            }
            try {
                const setup = parseFEN(fenValue);
                loadEditorFromSetup(setup);
                showEditorError('');
                customFenInput.value = '';
            } catch (error) {
                showEditorError(error && error.message ? error.message : 'Invalid FEN string.');
            }
        });
    }

    if (cancelCustomSetupButton) {
        cancelCustomSetupButton.addEventListener('click', () => {
            closeCustomSetupModal();
        });
    }

    if (closeCustomSetupButton) {
        closeCustomSetupButton.addEventListener('click', () => {
            closeCustomSetupModal();
        });
    }

    if (applyCustomSetupButton) {
        applyCustomSetupButton.addEventListener('click', () => {
            applyCustomSetupChanges();
        });
    }

    if (customEnPassantInput) {
        customEnPassantInput.addEventListener('change', () => {
            editorState.enPassant = sanitizeEnPassantValue(customEnPassantInput.value);
            customEnPassantInput.value = editorState.enPassant;
        });
    }

    if (customFullmoveInput) {
        customFullmoveInput.addEventListener('change', () => {
            const parsed = parseInt(customFullmoveInput.value, 10);
            editorState.fullmove = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
            customFullmoveInput.value = editorState.fullmove;
        });
    }

    if (customTurnRadios && customTurnRadios.length) {
        customTurnRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    editorState.turn = radio.value === 'b' ? 'b' : 'w';
                }
            });
        });
    }

    attachCastlingCheckboxHandler('w', 'kingSide', castlingCheckboxes.w ? castlingCheckboxes.w.kingSide : null);
    attachCastlingCheckboxHandler('w', 'queenSide', castlingCheckboxes.w ? castlingCheckboxes.w.queenSide : null);
    attachCastlingCheckboxHandler('b', 'kingSide', castlingCheckboxes.b ? castlingCheckboxes.b.kingSide : null);
    attachCastlingCheckboxHandler('b', 'queenSide', castlingCheckboxes.b ? castlingCheckboxes.b.queenSide : null);

    function updateCustomSetupButtonVisibility() {
        if (!editCustomSetupButton) {
            return;
        }
        const shouldShow = gameType === 'custom';
        editCustomSetupButton.style.display = shouldShow ? 'inline-flex' : 'none';
    }

    // Define resetGame function if not already defined
    const resetGame = () => {
        const setup = getSetupForCurrentGameType();
        applySetupToGame(setup);
    };
    function createBoard(boardState = null) {
        const chessboard = document.getElementById('chessboard');
        chessboard.innerHTML = ''; // Clear existing board
        chessboard.style.display = "grid";
        chessboard.style.gridTemplateColumns = "repeat(8, 70px)";
        chessboard.style.gridTemplateRows = "repeat(8, 70px)";
        chessboard.style.width = "560px";
        chessboard.style.height = "560px";
        chessboard.style.border = "2px solid black";

        const initialBoard = [
            ["rook-b", "knight-b", "bishop-b", "queen-b", "king-b", "bishop-b", "knight-b", "rook-b"],
            ["pawn-b", "pawn-b", "pawn-b", "pawn-b", "pawn-b", "pawn-b", "pawn-b", "pawn-b"],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ["pawn-w", "pawn-w", "pawn-w", "pawn-w", "pawn-w", "pawn-w", "pawn-w", "pawn-w"],
            ["rook-w", "knight-w", "bishop-w", "queen-w", "king-w", "bishop-w", "knight-w", "rook-w"]
        ];

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.style.width = "70px";
                square.style.height = "70px";
                square.style.display = "flex";
                square.style.alignItems = "center";
                square.style.justifyContent = "center";
                square.style.position = "relative";
                square.style.backgroundColor = (row + col) % 2 === 0 ? "#f0d9b5" : "#b58863";

                square.dataset.row = row;
                square.dataset.col = col;

                let pieceData = null;
                if (boardState && boardState[row] && boardState[row][col]) {
                    pieceData = boardState[row][col];
                } else if (!boardState && initialBoard[row][col]) {
                    const [type, color] = initialBoard[row][col].split('-');
                    pieceData = {
                        type,
                        color,
                        moved: false,
                        id: `piece${row}${col}`
                    };
                }

                if (pieceData) {
                    const piece = document.createElement('img');
                    piece.src = `images/${pieceData.type}-${pieceData.color}.svg`;
                    piece.style.width = "70px";
                    piece.style.height = "70px";
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
    const handleSquareClick = (event) => {
        if (gameOver || pendingPromotion) return;

        if (historyStates.length && currentHistoryIndex !== historyStates.length - 1) {
            navigateToMove(historyStates.length - 1);
            return;
        }

        const square = event.currentTarget;
        const piece = square.querySelector(".piece");

        if (isColorBotControlled(turn)) return; // Prevent player from moving when bots control the turn

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
        let capturedRow = null;
        let capturedCol = null;
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
                const enemyParent = enemyPawn.parentElement;
                if (enemyParent) {
                    capturedRow = parseInt(enemyParent.dataset.row, 10);
                    capturedCol = parseInt(enemyParent.dataset.col, 10);
                }
                capturedPieceType = enemyPawn.dataset.type;
                capturedPieceColor = enemyPawn.dataset.color;
                isCapture = true;
                isEnPassant = true;
                enemyPawn.remove();
            }
        }

        targetPiece = square.querySelector('.piece');
        if (targetPiece) {
            const targetParent = targetPiece.parentElement;
            if (targetParent) {
                capturedRow = parseInt(targetParent.dataset.row, 10);
                capturedCol = parseInt(targetParent.dataset.col, 10);
            }
            capturedPieceType = targetPiece.dataset.type;
            capturedPieceColor = targetPiece.dataset.color;
            isCapture = true;
            targetPiece.remove();
        }

        square.appendChild(piece);

        if (pieceType === 'king') {
            const castlingSide = getCastlingSideForMove(color, toCol);
            if (castlingSide) {
                const sideKey = castlingSide === 'king' ? 'kingSide' : 'queenSide';
                const rookCol = castlingRookColumns[color][sideKey];
                const rookTargetCol = CASTLING_ROOK_TARGET_COLUMNS[castlingSide];
                const rook = typeof rookCol === 'number'
                    ? document.querySelector(`[data-row="${fromRow}"][data-col="${rookCol}"] .piece`)
                    : null;
                const rookTargetSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${rookTargetCol}"]`);
                if (rook && rookTargetSquare) {
                    rookTargetSquare.appendChild(rook);
                    rook.dataset.moved = 'true';
                }
                isCastling = castlingSide;
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

        updateCastlingRightsAfterMove(moveDetails, capturedRow, capturedCol);

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
                if (!JSON.parse(piece.dataset.moved)) {
                    const castlingMoves = getCastlingMoves(color, row, col);
                    castlingMoves.forEach(move => moves.push(move));
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
        boardCopy[toRow][toCol] = boardCopy[fromRow][fromCol];
        boardCopy[fromRow][fromCol] = null;
    };

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

    const performStockfishBotMove = (color) => {
        requestStockfish(best => {
            if (!best || best === '(none)' || best === '0000') {
                handleNoAvailableMoves(color);
                return;
            }

            if (turn !== color || !isColorBotControlled(color) || gameOver || isZeroPlayerAutomationPaused()) {
                return;
            }

            const fromFile = best[0];
            const fromRank = best[1];
            const toFile = best[2];
            const toRank = best[3];
            const fromRow = 8 - parseInt(fromRank, 10);
            const fromCol = fileLetters.indexOf(fromFile);
            const toRow = 8 - parseInt(toRank, 10);
            const toCol = fileLetters.indexOf(toFile);
            const piece = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"] .piece`);
            if (piece && piece.dataset.color === color) {
                movePieceToSquare(piece, toRow, toCol, best[4]);
            } else {
                scheduleBotMoveIfNeeded({ force: true });
            }
        });
    };

    function handleNoAvailableMoves(color) {
        cancelScheduledBotMove();
        if (gameOver) {
            return;
        }
        const boardCopy = createBoardCopy();
        const inCheck = isKingInCheck(boardCopy, color);
        if (inCheck) {
            gameOver = true;
            const winner = color === 'w' ? 'Black' : 'White';
            alert(`Game over! ${winner} wins by checkmate.`);
            updateZeroPlayerControlsState();
        } else {
            declareDraw('stalemate');
        }
    }

    const performRandomBotMove = (color) => {
        const pieces = Array.from(document.querySelectorAll(`.piece[data-color='${color}']`));

        const allMoves = [];

        pieces.forEach(piece => {
            const row = parseInt(piece.parentElement.dataset.row, 10);
            const col = parseInt(piece.parentElement.dataset.col, 10);
            const legalMoves = getLegalMoves(piece, row, col);

            legalMoves.forEach(move => {
                allMoves.push({ piece, toRow: move[0], toCol: move[1] });
            });
        });

        if (allMoves.length === 0) {
            handleNoAvailableMoves(color);
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

    const cloneBoardState = (board) => {
        return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
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

        if (movingPiece.type === 'king') {
            const castlingSide = getCastlingSideForMove(movingPiece.color, toCol);
            if (castlingSide) {
                const sideKey = castlingSide === 'king' ? 'kingSide' : 'queenSide';
                const rookInfo = castlingRookColumns[movingPiece.color] || {};
                const rookFromCol = rookInfo[sideKey];
                const rookTargetCol = CASTLING_ROOK_TARGET_COLUMNS[castlingSide];

                if (
                    typeof rookFromCol === 'number' &&
                    typeof rookTargetCol === 'number' &&
                    board[fromRow]
                ) {
                    const rookPiece = board[fromRow][rookFromCol];
                    if (rookPiece) {
                        board[fromRow][rookFromCol] = null;
                        board[fromRow][rookTargetCol] = { ...rookPiece };
                    }
                }
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

    const performWorstBotMove = (color) => {
        const pieces = Array.from(document.querySelectorAll(`.piece[data-color='${color}']`));

        let chosenMove = null;
        let worstScore = color === 'w' ? Infinity : -Infinity;
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
                if (color === 'w') {
                    if (score < worstScore) {
                        worstScore = score;
                        chosenMove = { piece, toRow, toCol };
                    }
                } else if (score > worstScore) {
                    worstScore = score;
                    chosenMove = { piece, toRow, toCol };
                }
            });
        });

        if (!chosenMove) {
            handleNoAvailableMoves(color);
            return;
        }

        movePieceToSquare(chosenMove.piece, chosenMove.toRow, chosenMove.toCol);
    };

    const botStrategies = {
        random: (color) => performRandomBotMove(color),
        worst: (color) => performWorstBotMove(color),
        stockfish: (color) => performStockfishBotMove(color)
    };

    function getBotStrategyIdForColor(color) {
        const selection = botDifficulty[color] || 'random';
        if (selection === 'custom') {
            const entries = getActiveCustomMixEntries(color);
            const chosen = chooseBotFromMix(entries);
            if (chosen && botStrategies[chosen]) {
                return chosen;
            }
            return 'random';
        }

        if (botStrategies[selection]) {
            return selection;
        }

        return 'random';
    }

    function cancelScheduledBotMove() {
        if (pendingBotMoveTimeout) {
            clearTimeout(pendingBotMoveTimeout);
            pendingBotMoveTimeout = null;
        }
    }

    function scheduleBotMoveIfNeeded(options = {}) {
        const { force = false } = options;
        if (pendingBotMoveTimeout) {
            if (!force) {
                return;
            }
            clearTimeout(pendingBotMoveTimeout);
            pendingBotMoveTimeout = null;
        }

        if (isZeroPlayerAutomationPaused()) {
            return;
        }

        if (!isColorBotControlled(turn) || gameOver || pendingPromotion) {
            return;
        }

        pendingBotMoveTimeout = setTimeout(() => {
            pendingBotMoveTimeout = null;
            botMove(turn);
        }, 500);
    }

    const botMove = (color = turn) => {
        if (gameOver || pendingPromotion) {
            return;
        }

        if (!isColorBotControlled(color)) {
            return;
        }

        if (isZeroPlayerAutomationPaused()) {
            return;
        }

        if (turn !== color) {
            return;
        }

        if (historyStates.length && currentHistoryIndex !== historyStates.length - 1) {
            navigateToMove(historyStates.length - 1);
            scheduleBotMoveIfNeeded({ force: true });
            return;
        }

        const strategyId = getBotStrategyIdForColor(color);
        const strategy = botStrategies[strategyId] || botStrategies.random;
        if (strategy) {
            strategy(color);
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
        let capturedRow = null;
        let capturedCol = null;
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
                const enemyParent = enemyPawn.parentElement;
                if (enemyParent) {
                    capturedRow = parseInt(enemyParent.dataset.row, 10);
                    capturedCol = parseInt(enemyParent.dataset.col, 10);
                }
                capturedPieceType = enemyPawn.dataset.type;
                capturedPieceColor = enemyPawn.dataset.color;
                isCapture = true;
                isEnPassant = true;
                enemyPawn.remove();
            }
        }

        let targetPiece = toSquare.querySelector('.piece');
        if (targetPiece) {
            const targetParent = targetPiece.parentElement;
            if (targetParent) {
                capturedRow = parseInt(targetParent.dataset.row, 10);
                capturedCol = parseInt(targetParent.dataset.col, 10);
            }
            capturedPieceType = targetPiece.dataset.type;
            capturedPieceColor = targetPiece.dataset.color;
            isCapture = true;
            targetPiece.remove();
        }

        toSquare.appendChild(piece);

        if (pieceType === 'king') {
            const castlingSide = getCastlingSideForMove(color, toCol);
            if (castlingSide) {
                const sideKey = castlingSide === 'king' ? 'kingSide' : 'queenSide';
                const rookCol = castlingRookColumns[color][sideKey];
                const rookTargetCol = CASTLING_ROOK_TARGET_COLUMNS[castlingSide];
                const rook = typeof rookCol === 'number'
                    ? document.querySelector(`[data-row="${fromRow}"][data-col="${rookCol}"] .piece`)
                    : null;
                const rookTargetSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${rookTargetCol}"]`);
                if (rook && rookTargetSquare) {
                    rookTargetSquare.appendChild(rook);
                    rook.dataset.moved = 'true';
                }
                isCastling = castlingSide;
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

        updateCastlingRightsAfterMove(moveDetails, capturedRow, capturedCol);

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
            halfmoveClock,
            lastMove: lastMove ? { ...lastMove } : null,
            gameOver,
            castlingRightsState: JSON.parse(JSON.stringify(castlingRightsState)),
            castlingRookColumns: JSON.parse(JSON.stringify(castlingRookColumns)),
            kingHomeRows: { ...kingHomeRows },
            capturedPieces: cloneCapturedPiecesState(capturedPiecesState),
            positionCounts: clonePositionCounts(positionCounts)
        };
    };

    const renderState = (state) => {
        createBoard(state.board);
        castlingRightsState = state.castlingRightsState
            ? JSON.parse(JSON.stringify(state.castlingRightsState))
            : createEmptyCastlingRights();
        castlingRookColumns = state.castlingRookColumns
            ? JSON.parse(JSON.stringify(state.castlingRookColumns))
            : createEmptyCastlingRookColumns();
        kingHomeRows = state.kingHomeRows ? { ...state.kingHomeRows } : { w: 7, b: 0 };
        turn = state.turn;
        fullmoveNumber = state.fullmoveNumber;
        halfmoveClock = typeof state.halfmoveClock === 'number' && state.halfmoveClock >= 0
            ? state.halfmoveClock
            : 0;
        lastMove = state.lastMove ? { ...state.lastMove } : null;
        gameOver = state.gameOver;
        pendingPromotion = null;
        selectedPiece = null;
        capturedPiecesState = cloneCapturedPiecesState(state.capturedPieces);
        positionCounts = clonePositionCounts(state.positionCounts);
        renderAllCapturedPieces();
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
        if (currentHistoryIndex === historyStates.length - 1) {
            scheduleBotMoveIfNeeded({ force: true });
        } else {
            cancelScheduledBotMove();
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
        if (moveDetails.isCapture && moveDetails.capturedPieceType) {
            recordCapturedPiece(moveDetails.color, moveDetails.capturedPieceType);
        }
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
        if (moveDetails.pieceType === 'pawn' || moveDetails.isCapture) {
            halfmoveClock = 0;
        } else {
            halfmoveClock += 1;
        }
        const repetitionCount = recordPositionForRepetition(opponent);
        checkForCheck();
        const boardCopy = createBoardCopy();
        const isCheck = isKingInCheck(boardCopy, opponent);
        const opponentHasMoves = hasAnyLegalMoves(opponent);
        const isMate = isCheck && !opponentHasMoves;
        const drawReason = !isMate
            ? detectDrawCondition({ isCheck, opponentHasMoves, repetitionCount })
            : null;
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
            if (drawReason) {
                declareDraw(drawReason);
            }
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

    const generateFEN = (options = {}) => {
        const { overrideTurn, includeCounters = true } = options;
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
        const activeColor = overrideTurn || turn;
        const fields = [
            rows.join('/'),
            activeColor,
            getCastlingRights(),
            getEnPassantSquare()
        ];
        if (includeCounters) {
            fields.push(halfmoveClock);
            fields.push(fullmoveNumber);
        }
        return fields.join(' ');
    };

    const getCastlingRights = () => {
        const whiteRights = [];
        const blackRights = [];

        const appendRight = (color, sideKey) => {
            if (!castlingRightsState[color] || !castlingRightsState[color][sideKey]) {
                return;
            }

            const rookColumns = castlingRookColumns[color] || {};
            const rookCol = rookColumns[sideKey];
            if (typeof rookCol !== 'number' || rookCol < 0 || rookCol > 7) {
                return;
            }

            const homeRow = getHomeRow(color);
            const rookElement = document.querySelector(`[data-row="${homeRow}"][data-col="${rookCol}"] .piece`);
            if (!rookElement || rookElement.dataset.type !== 'rook' || rookElement.dataset.color !== color) {
                return;
            }

            const fileLetter = fileLetters[rookCol];
            if (!fileLetter) {
                return;
            }

            if (color === 'w') {
                if (sideKey === 'kingSide' && rookCol === 7) {
                    whiteRights.push('K');
                } else if (sideKey === 'queenSide' && rookCol === 0) {
                    whiteRights.push('Q');
                } else {
                    whiteRights.push(fileLetter.toUpperCase());
                }
            } else if (color === 'b') {
                if (sideKey === 'kingSide' && rookCol === 7) {
                    blackRights.push('k');
                } else if (sideKey === 'queenSide' && rookCol === 0) {
                    blackRights.push('q');
                } else {
                    blackRights.push(fileLetter);
                }
            }
        };

        appendRight('w', 'kingSide');
        appendRight('w', 'queenSide');
        appendRight('b', 'kingSide');
        appendRight('b', 'queenSide');

        const rights = [...whiteRights, ...blackRights];
        return rights.length ? rights.join('') : '-';
    };

    const getEnPassantSquare = () => {
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
    const getCastlingMoves = (color, row, col) => {
        const moves = [];
        if (canCastle(color, row, col, 'king')) {
            moves.push([row, CASTLING_KING_TARGET_COLUMNS.king]);
        }
        if (canCastle(color, row, col, 'queen')) {
            moves.push([row, CASTLING_KING_TARGET_COLUMNS.queen]);
        }
        return moves;
    };
    const canCastle = (color, row, col, side) => {
        const sideKey = side === 'king' ? 'kingSide' : 'queenSide';
        if (!castlingRightsState[color] || !castlingRightsState[color][sideKey]) {
            return false;
        }
        const rookCol = castlingRookColumns[color][sideKey];
        if (rookCol === null || rookCol === undefined) {
            return false;
        }

        if (row !== getHomeRow(color)) {
            return false;
        }

        const kingSquare = document.querySelector(`[data-row="${row}"][data-col="${col}"] .piece`);
        if (!kingSquare || kingSquare.dataset.type !== 'king' || kingSquare.dataset.color !== color) {
            return false;
        }
        if (kingSquare.dataset.moved === 'true') {
            return false;
        }

        const rookSquare = document.querySelector(`[data-row="${row}"][data-col="${rookCol}"] .piece`);
        if (!rookSquare || rookSquare.dataset.type !== 'rook' || rookSquare.dataset.color !== color) {
            return false;
        }
        if (rookSquare.dataset.moved === 'true') {
            return false;
        }

        const kingTargetCol = CASTLING_KING_TARGET_COLUMNS[side];
        const rookTargetCol = CASTLING_ROOK_TARGET_COLUMNS[side];

        const step = kingTargetCol > col ? 1 : -1;
        for (let c = col + step; c !== kingTargetCol + step; c += step) {
            if (c === rookCol) {
                continue;
            }
            const occupant = document.querySelector(`[data-row="${row}"][data-col="${c}"] .piece`);
            if (occupant) {
                return false;
            }
        }

        const rookStep = rookTargetCol > rookCol ? 1 : -1;
        for (let c = rookCol + rookStep; c !== rookTargetCol + rookStep; c += rookStep) {
            if (c === col) {
                continue;
            }
            const occupant = document.querySelector(`[data-row="${row}"][data-col="${c}"] .piece`);
            if (occupant) {
                return false;
            }
        }

        const boardCopy = createBoardCopy();
        if (isSquareAttacked(boardCopy, row, col, color)) {
            return false;
        }

        let fromColSim = col;
        for (let c = col + step; c !== kingTargetCol + step; c += step) {
            makeMoveOnBoardCopy(boardCopy, null, row, fromColSim, row, c);
            fromColSim = c;
            if (isSquareAttacked(boardCopy, row, fromColSim, color)) {
                return false;
            }
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
        cancelScheduledBotMove();
        updateZeroPlayerControlsState();
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

        scheduleBotMoveIfNeeded();
    };

    window.toggleBotSelection = function() {
        updateBotSelectionVisibility();
        updateCustomMixVisibility();
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
    ['w', 'b'].forEach(color => {
        renderCustomMixOptions(color);
        initializeCustomMixDefaults(color);
    });
    updateCustomMixVisibility();
    updateBotSelectionVisibility();

    renderPiecePalette();
    updateCustomSetupButtonVisibility();
    resetGame();
    initStockfish();
    toggleBotSelection();
});

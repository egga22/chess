document.addEventListener("DOMContentLoaded", () => {
    const chessboard = document.getElementById('chessboard');
    const gameModeSelect = document.getElementById('gameModeSelect');
    const botSelection = document.getElementById('botSelection');
    const botDifficultySelect = document.getElementById('botDifficulty');

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

    gameModeSelect.addEventListener("change", () => {
        gameMode = gameModeSelect.value;
        if (gameMode === "onePlayer") {
            botSelection.style.display = "block"; // Show bot difficulty dropdown
        } else {
            botSelection.style.display = "none"; // Hide dropdown in two-player mode
        }
        resetGame(); // Reset the game when switching modes
    });

    botDifficultySelect.addEventListener('change', () => {
        botDifficulty = botDifficultySelect.value;
    });

    // Define resetGame function if not already defined
    const resetGame = () => {
        const promotionUI = document.querySelector('.promotion-ui');
        if (promotionUI) {
            promotionUI.remove();
        }
        pendingPromotion = null;
        chessboard.innerHTML = '';
        createBoard();
        selectedPiece = null;
        turn = 'w';
        lastMove = null;
        fullmoveNumber = 1;
        gameOver = false;
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

        if (pieceType === 'king' && Math.abs(fromCol - toCol) === 2) {
            const rookCol = toCol === 6 ? 7 : 0;
            const rookTargetCol = toCol === 6 ? 5 : 3;
            const rook = document.querySelector(`[data-row="${fromRow}"][data-col="${rookCol}"] .piece`);
            const rookTargetSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${rookTargetCol}"]`);
            if (rook && rookTargetSquare) {
                rookTargetSquare.appendChild(rook);
                rook.dataset.moved = 'true';
            }
            isCastling = toCol === 6 ? 'king' : 'queen';
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
                if (!JSON.parse(piece.dataset.moved)) { // Check if the king can move
                    // Castling to the right
                    if (canCastle(color, row, col, 1)) {
                        moves.push([row, col + 2]); // Add the move two squares to the right
                        }
                        // Castling to the left
                    if (canCastle(color, row, col, -1)) {
                    moves.push([row, col - 2]); // Add the move two squares to the left
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
        boardCopy[toRow][toCol] = boardCopy[fromRow][fromCol];
        boardCopy[fromRow][fromCol] = null;
    };

    const initStockfish = () => {
        engine = new Worker('stockfish.js');
        engine.onmessage = (e) => {
            const line = e.data;
            const scoreMatch = line.match(/score (cp|mate) (-?\\d+)/);
            if (scoreMatch) {
                const value = scoreMatch[1] === 'cp' ? parseInt(scoreMatch[2], 10) : (parseInt(scoreMatch[2],10) > 0 ? 10000 : -10000);
                updateEvalBar(value);
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
        engine.postMessage('position fen ' + fen);
        engine.postMessage('go depth 12');
    };

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

        if (botDifficulty === 'stockfish') {
            requestStockfish(best => {
                if (!best) return;
                const fromFile = best[0];
                const fromRank = best[1];
                const toFile = best[2];
                const toRank = best[3];
                const fromRow = 8 - parseInt(fromRank);
                const fromCol = fileLetters.indexOf(fromFile);
                const toRow = 8 - parseInt(toRank);
                const toCol = fileLetters.indexOf(toFile);
                const piece = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"] .piece`);
                if (piece) {
                    movePieceToSquare(piece, toRow, toCol, best[4]);
                }
            });
        } else {
            const pieces = Array.from(document.querySelectorAll('.piece'))
                .filter(p => p.dataset.color === 'b');

            let allMoves = [];

            pieces.forEach(piece => {
                const row = parseInt(piece.parentElement.dataset.row);
                const col = parseInt(piece.parentElement.dataset.col);
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

        if (pieceType === 'king' && Math.abs(fromCol - toCol) === 2) {
            const rookCol = toCol === 6 ? 7 : 0;
            const rookTargetCol = toCol === 6 ? 5 : 3;
            const rook = document.querySelector(`[data-row="${fromRow}"][data-col="${rookCol}"] .piece`);
            const rookTargetSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${rookTargetCol}"]`);
            if (rook && rookTargetSquare) {
                rookTargetSquare.appendChild(rook);
                rook.dataset.moved = 'true';
            }
            isCastling = toCol === 6 ? 'king' : 'queen';
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

    const updateEvalBar = (value) => {
        const evalFill = document.getElementById('evalFill');
        const clamped = Math.max(-1000, Math.min(1000, value));
        const percentage = ((clamped + 1000) / 2000) * 100;
        evalFill.style.height = percentage + '%';
    };

    const evaluateBoard = () => {
        if (gameOver) return;
        if (botDifficulty !== 'stockfish') return;
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
    const canCastle = (color, row, col, direction) => {
        const rookCol = direction === 1 ? 7 : 0; // Right rook or left rook
        const step = direction === 1 ? 1 : -1;
        let emptyCheckCol = col + step;

        // Check if the rook has moved or does not exist
        const rook = document.querySelector(`[data-row="${row}"][data-col="${rookCol}"] .piece`);
        if (!rook || rook.dataset.type !== 'rook' || JSON.parse(rook.dataset.moved)) {
            return false;
        }

        // Check if all squares between the king and rook are empty
        while (emptyCheckCol !== rookCol) {
            if (document.querySelector(`[data-row="${row}"][data-col="${emptyCheckCol}"] .piece`)) {
                return false;
            }
            emptyCheckCol += step;
        }

        // Check if the king is in check, or if it moves through check
        for (let i = 0; i <= 2; i++) {
            let tempCol = col + (i * step);
            if (isSquareAttacked(createBoardCopy(), row, tempCol, color)) {
                return false; // King cannot move through or into check
            }
        }

        return true; // Castling is allowed
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
        var gameMode = document.getElementById('gameModeSelect').value;
        var botSelection = document.getElementById('botSelection');
        botSelection.style.display = gameMode === 'onePlayer' ? 'block' : 'none';
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
    createBoard();
    historyStates.push(captureDetailedState());
    updateMoveHistoryUI();
    initStockfish();
    evaluateBoard();
    toggleBotSelection();
});

document.addEventListener("DOMContentLoaded", () => {
    const chessboard = document.getElementById('chessboard');
    const gameModeSelect = document.getElementById('gameModeSelect');
    const botSelection = document.getElementById('botSelection');
    let selectedPiece = null;
    let turn = 'w'; // 'w' for white, 'b' for black
    let lastMove = null; // To keep track of the last move
    let gameMode = 'twoPlayer'; // Default game mode

    gameModeSelect.addEventListener("change", () => {
        gameMode = gameModeSelect.value;
        if (gameMode === "onePlayer") {
            botSelection.style.display = "block"; // Show bot difficulty dropdown
        } else {
            botSelection.style.display = "none"; // Hide dropdown in two-player mode
        }
        resetGame(); // Reset the game when switching modes
    });

    // Define resetGame function if not already defined
    const resetGame = () => {
        chessboard.innerHTML = '';
        createBoard();
        selectedPiece = null;
        turn = 'w';
        lastMove = null;
    };
    function createBoard() {
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
                square.style.backgroundColor = (row + col) % 2 === 0 ? "#f0d9b5" : "#b58863";
    
                // 🔹 **Add row and column data for movement logic**
                square.dataset.row = row;
                square.dataset.col = col;
    
                if (initialBoard[row][col]) {
                    const piece = document.createElement('img');
                    piece.src = `images/${initialBoard[row][col]}.svg`;
                    piece.style.width = "70px";
                    piece.style.height = "70px";
    
                    // 🔹 **Add class and data attributes for movement logic**
                    piece.classList.add("piece");
                    piece.dataset.color = initialBoard[row][col].includes("-w") ? "w" : "b";
                    piece.dataset.type = initialBoard[row][col].split("-")[0];
    
                    square.appendChild(piece);
                }
    
                square.addEventListener('click', handleSquareClick);
                chessboard.appendChild(square);
            }
        }
    }
    const handleSquareClick = (event) => {
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
                    checkForCheck(); // Ensure this line is here
                    if (isCheckmate()) {
                        displayCheckmatePopup();
                    } else {
                        switchTurn();
                        if (gameMode === "onePlayer" && turn === "b") {
                            setTimeout(botMove, 500); // Bot moves automatically after white
                        }
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
        const targetPiece = square.querySelector('.piece');
        const fromRow = parseInt(piece.parentElement.dataset.row);
        const fromCol = parseInt(piece.parentElement.dataset.col);
        const toRow = parseInt(square.dataset.row);
        const toCol = parseInt(square.dataset.col);
        if (targetPiece) {
            targetPiece.remove();
        }
        // Handle castling
        if (piece.dataset.type === 'king' && Math.abs(fromCol - toCol) === 2) {
            const rookCol = toCol === 6 ? 7 : 0; // Rook's initial position
            const rookTargetCol = toCol === 6 ? 5 : 3; // Rook's new position after castling
            const rook = document.querySelector(`#piece${fromRow}${rookCol}`);
            const rookTargetSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${rookTargetCol}"]`);
            rookTargetSquare.appendChild(rook);
            rook.dataset.moved = "true";
        }
        // Handle en passant
        if (piece.dataset.type === 'pawn' && Math.abs(fromRow - toRow) === 1 && Math.abs(fromCol - toCol) === 1 && !targetPiece) {
            const enemyPawn = document.querySelector(`[data-row="${fromRow}"][data-col="${toCol}"] .piece`);
            if (enemyPawn && enemyPawn.dataset.type === 'pawn' && enemyPawn.dataset.color !== piece.dataset.color && lastMove && lastMove.piece === enemyPawn && Math.abs(lastMove.fromRow - lastMove.toRow) === 2) {
                enemyPawn.remove();
            }
        }
        square.appendChild(piece);
        piece.dataset.moved = "true";
        lastMove = { piece, fromRow, fromCol, toRow, toCol };
        if (piece.dataset.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            promotePawn(piece);
        } else {
            checkForCheck();
            if (isCheckmate()) {
                displayCheckmatePopup();
            } else {
                console.log("Calling switchTurn() from movePiece()"); // Debugging log
                switchTurn();
            }
        }
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
                if (lastMove && lastMove.piece.dataset.type === 'pawn' && Math.abs(lastMove.fromRow - lastMove.toRow) === 2) {
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

    const botMove = () => {
        if (gameMode !== "onePlayer" || turn !== "b") {
            console.log("Bot move skipped: gameMode =", gameMode, ", turn =", turn); // Debugging log
            return;
        }
    
        console.log("Bot move executing..."); // Debugging log
    
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
        console.log("Bot moving piece:", randomMove.piece.dataset.type, "to", randomMove.toRow, randomMove.toCol); // Debugging log
        movePieceToSquare(randomMove.piece, randomMove.toRow, randomMove.toCol);
    };
    
    const movePieceToSquare = (piece, toRow, toCol) => {
        const fromSquare = piece.parentElement;
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
    
        // Handle potential capture
        const targetPiece = toSquare.querySelector('.piece');
        if (targetPiece) {
            targetPiece.remove(); // Capture the piece
        }
    
        // Move piece to new square
        toSquare.appendChild(piece);
    
        // Post-move operations
        checkForCheck();
        if (isCheckmate()) {
            displayCheckmatePopup();
        } else {
            switchTurn(); // Change turn to white
        }
    };

    const isKingInCheck = (boardCopy, color) => {
        let kingPosition = null;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = boardCopy[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    kingPosition = [row, col];
                    break;
                }
            }
        }
        if (!kingPosition) return false;
        const [kingRow, kingCol] = kingPosition;
        return isSquareAttacked(boardCopy, kingRow, kingCol, color);
    };
    const isSquareAttacked = (boardCopy, row, col, color) => {
        const opponentColor = color === 'w' ? 'b' : 'w';
        const directions = [
            [1, 0], [-1, 0], [0, 1], [0, -1], 
            [1, 1], [-1, -1], [1, -1], [-1, 1]
        ];
        for (const [rowDir, colDir] of directions) {
            let r = row + rowDir;
            let c = col + colDir;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const piece = boardCopy[r][c];
                if (piece) {
                    if (piece.color === opponentColor && canAttack(piece, row, col, r, c)) {
                        return true;
                    }
                    break;
                }
                r += rowDir;
                c += colDir;
            }
        }
        return false;
    };
    const canAttack = (piece, toRow, toCol, fromRow, fromCol) => {
        const pieceType = piece.type;
        switch (pieceType) {
            case 'pawn':
                const direction = piece.color === 'w' ? -1 : 1;
                return (toRow === fromRow + direction && Math.abs(toCol - fromCol) === 1);
            case 'rook':
                return (toRow === fromRow || toCol === fromCol);
            case 'knight':
                return (Math.abs(toRow - fromRow) === 2 && Math.abs(toCol - fromCol) === 1) ||
                       (Math.abs(toRow - fromRow) === 1 && Math.abs(toCol - fromCol) === 2);
            case 'bishop':
                return Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol);
            case 'queen':
                return (toRow === fromRow || toCol === fromCol) || 
                       Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol);
            case 'king':
                return Math.abs(toRow - fromRow) <= 1 && Math.abs(toCol - fromCol) <= 1;
        }
        return false;
    };
    const checkForCheck = () => {
        // Remove highlights first
        removeKingInCheckHighlight('w');
        removeKingInCheckHighlight('b');
        ['w', 'b'].forEach(color => {
            const boardCopy = createBoardCopy();
            if (isKingInCheck(boardCopy, color)) {
                highlightKingInCheck(color);
            } else {
                // No need to call removeKingInCheckHighlight here as it was called earlier
            }
        });
    };
    const highlightKingInCheck = (color) => {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = document.querySelector(`[data-row='${row}'][data-col='${col}'] .piece`);
                if (piece && piece.dataset.color === color && piece.dataset.type === 'king') {
                    const parent = piece.parentElement;
                    parent.classList.add('check');
                    setTimeout(() => {
                    }, 100); // Delay to check final class list
                    return;
                }
            }
        }
    };
    const removeKingInCheckHighlight = (color) => {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.querySelector(`[data-row='${row}'][data-col='${col}']`);
                if (square.classList.contains('check')) {
                }
                square.classList.remove('check');
            }
        }
    };
    const isCheckmate = () => {
        const color = turn;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = document.querySelector(`[data-row='${row}'][data-col='${col}'] .piece`);
                if (piece && piece.dataset.color === color) {
                    const legalMoves = getLegalMoves(piece, row, col);
                    if (legalMoves.length > 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    };
    const displayCheckmatePopup = () => {
        const winner = turn === 'w' ? 'Black' : 'White';
        alert(`${winner} wins by checkmate!`);
    };
    const isEmptySquare = (row, col) => {
        const square = document.querySelector(`[data-row='${row}'][data-col='${col}']`);
        return square && !square.querySelector('.piece');
    };
    const isEnemyPiece = (row, col, color) => {
        const square = document.querySelector(`[data-row='${row}'][data-col='${col}']`);
        const piece = square ? square.querySelector('.piece') : null;
        return piece && piece.dataset.color !== color;
    };
    const addLinearMoves = (moves, row, col, color, rowDir, colDir) => {
        let r = row + rowDir;
        let c = col + colDir;
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
            if (isEmptySquare(r, c)) {
                moves.push([r, c]);
            } else if (isEnemyPiece(r, c, color)) {
                moves.push([r, c]);
                break;
            } else {
                break;
            }
            r += rowDir;
            c += colDir;
        }
    };
    const addDiagonalMoves = (moves, row, col, color) => {
        addLinearMoves(moves, row, col, color, 1, 1);
        addLinearMoves(moves, row, col, color, -1, -1);
        addLinearMoves(moves, row, col, color, 1, -1);
        addLinearMoves(moves, row, col, color, -1, 1);
    };
    const addKnightMoves = (moves, row, col, color) => {
        const knightMoves = [
            [row - 2, col - 1], [row - 2, col + 1],
            [row - 1, col - 2], [row - 1, col + 2],
            [row + 1, col - 2], [row + 1, col + 2],
            [row + 2, col - 1], [row + 2, col + 1]
        ];
        knightMoves.forEach(([r, c]) => {
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                if (isEmptySquare(r, c) || isEnemyPiece(r, c, color)) {
                    moves.push([r, c]);
                }
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
    const removeMoveDots = () => {
        document.querySelectorAll('.move-dot').forEach(dot => dot.remove());
    };
    const switchTurn = () => {
        turn = turn === 'w' ? 'b' : 'w';
        console.log("Turn switched to:", turn); // Debugging log
    
        // If in one-player mode and it's Black's turn, make the bot move
        if (gameMode === "onePlayer" && turn === "b") {
            console.log("Bot move triggered!"); // Debugging log
            setTimeout(botMove, 500); // Give a delay so it’s visually clear
        }
    };

    function toggleBotSelection() {
        var gameMode = document.getElementById('gameModeSelect').value;
        var botSelection = document.getElementById('botSelection');
        botSelection.style.display = gameMode === 'bot' ? 'block' : 'none';
    }
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
        pawn.src = `images/${type}-${color}.svg`;
        pawn.dataset.type = type;
        document.body.removeChild(document.querySelector('.promotion-ui'));
        checkForCheck(); // Add this line
        if (isCheckmate()) { // Add this block
            displayCheckmatePopup();
        } else {
            switchTurn();
        }
    };
    createBoard();
});

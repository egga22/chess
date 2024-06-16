document.addEventListener("DOMContentLoaded", () => {
    const chessboard = document.getElementById('chessboard');
    let selectedPiece = null;
    let turn = 'w'; // 'w' for white, 'b' for black
    let lastMove = null; // To keep track of the last move

    const createBoard = () => {
        const initialSetup = [
            ["rook-b", "knight-b", "bishop-b", "queen-b", "king-b", "bishop-b", "knight-b", "rook-b"],
            ["pawn-b", "pawn-b", "pawn-b", "pawn-b", "pawn-b", "pawn-b", "pawn-b", "pawn-b"],
            [],
            [],
            [],
            [],
            ["pawn-w", "pawn-w", "pawn-w", "pawn-w", "pawn-w", "pawn-w", "pawn-w", "pawn-w"],
            ["rook-w", "knight-w", "bishop-w", "queen-w", "king-w", "bishop-w", "knight-w", "rook-w"]
        ];

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.classList.add('square');
                square.classList.add((row + col) % 2 === 0 ? 'white' : 'black');
                square.dataset.row = row;
                square.dataset.col = col;
                chessboard.appendChild(square);

                if (initialSetup[row][col]) {
                    const piece = document.createElement('img');
                    piece.src = `images/${initialSetup[row][col]}.svg`;
                    piece.classList.add('piece');
                    piece.dataset.color = initialSetup[row][col].split('-')[1];
                    piece.dataset.type = initialSetup[row][col].split('-')[0];
                    piece.dataset.moved = false; // To track if a pawn has moved
                    piece.id = `piece${row}${col}`; // Assign an ID to each piece
                    square.appendChild(piece);
                }

                // Ensure event listeners are attached
                square.addEventListener('click', handleSquareClick);
            }
        }
    };

    const handleSquareClick = (event) => {
        const square = event.currentTarget;
        const piece = square.querySelector('.piece');

        if (selectedPiece) {
            if (selectedPiece.parentElement === square) {
                // Deselect the piece
                removeMoveDots();
                selectedPiece = null;
            } else if (!piece || piece.dataset.color !== selectedPiece.dataset.color) {
                // Check if the move is legal
                const row = parseInt(square.dataset.row);
                const col = parseInt(square.dataset.col);
                const legalMoves = getLegalMoves(selectedPiece, parseInt(selectedPiece.parentElement.dataset.row), parseInt(selectedPiece.parentElement.dataset.col));
                const isLegalMove = legalMoves.some(([r, c]) => r === row && c === col);

                if (isLegalMove) {
                    movePiece(square);
                    removeMoveDots();
                    selectedPiece = null;
                    checkForCheck(); // Ensure this line is here
                    if (isCheckmate()) { // Ensure this block is here
                        displayCheckmatePopup();
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
            checkForCheck(); // Ensure this line is here
            if (isCheckmate()) { // Ensure this block is here
                displayCheckmatePopup();
            } else {
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
        ['w', 'b'].forEach(color => {
            const boardCopy = createBoardCopy();
            if (isKingInCheck(boardCopy, color)) {
                highlightKingInCheck(color);
            } else {
                removeKingInCheckHighlight(color);
            }
        });
    };
    
    const highlightKingInCheck = (color) => {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = document.querySelector(`[data-row='${row}'][data-col='${col}'] .piece`);
                if (piece && piece.dataset.color === color && piece.dataset.type === 'king') {
                    piece.parentElement.classList.add('check');
                    return;
                }
            }
        }
    };
    
    const removeKingInCheckHighlight = (color) => {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.querySelector(`[data-row='${row}'][data-col='${col}']`);
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
        const rookCol = direction === 1 ? 7 : 0; // Rook's column based on direction
        const step = direction === 1 ? 1 : -1;
        let emptyCheckCol = col + step;
    
        // Check if the rook has moved or does not exist
        const rook = document.querySelector(`#piece${row}${rookCol}`);
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
    
        // Check if the king passes through or ends up in check
        // For simplicity, this example does not implement the check verification
        // You need to ensure these conditions are handled properly in your game logic
    
        return true; // All conditions met for castling
    };
    
    const removeMoveDots = () => {
        document.querySelectorAll('.move-dot').forEach(dot => dot.remove());
    };
    
    const switchTurn = () => {
        turn = turn === 'w' ? 'b' : 'w';
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

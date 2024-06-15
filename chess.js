document.addEventListener("DOMContentLoaded", () => {
    const chessboard = document.getElementById('chessboard');
    let selectedPiece = null;
    let turn = 'w'; // 'w' for white, 'b' for black

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
        console.log(`Handling click, current turn: ${turn}`);
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
                    console.log(`Move is legal, current turn before move: ${turn}`);
                    movePiece(square);
                    console.log(`Current turn after move: ${turn}`);
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
    
        square.appendChild(piece);
        piece.dataset.moved = "true";
    
        if (piece.dataset.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            promotePawn(piece);
        } else {
            switchTurn();
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
                addKingMoves(moves, row, col, color); // Existing king moves
                if (!JSON.parse(piece.dataset.moved)) { // Check if the king has not moved
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
        return moves;
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
        console.log(`Before switch: ${turn}`);  // Log before switching
        turn = turn === 'w' ? 'b' : 'w';
        console.log(`After switch: ${turn}`);  // Log after switching
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
        switchTurn();
    };
    createBoard();
    
});
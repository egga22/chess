const initialBoardSetup = [
    ['rook-b', 'knight-b', 'bishop-b', 'queen-b', 'king-b', 'bishop-b', 'knight-b', 'rook-b'],
    ['pawn-b', 'pawn-b', 'pawn-b', 'pawn-b', 'pawn-b', 'pawn-b', 'pawn-b', 'pawn-b'],
    [null, null, null, null, null, null, null, null], // Empty row
    [null, null, null, null, null, null, null, null], // Empty row
    [null, null, null, null, null, null, null, null], // Empty row
    [null, null, null, null, null, null, null, null], // Empty row
    ['pawn-w', 'pawn-w', 'pawn-w', 'pawn-w', 'pawn-w', 'pawn-w', 'pawn-w', 'pawn-w'],
    ['rook-w', 'knight-w', 'bishop-w', 'queen-w', 'king-w', 'bishop-w', 'knight-w', 'rook-w']
];
const chessboard = document.getElementById('chessboard');
let currentPlayer = 'w'; // Start the game with white's turn
let selectedPiece = null;
let legalMoves = [];
// Add this to the beginning of your script to ensure you're working with fresh event listeners
document.querySelectorAll('.square').forEach(square => {
    square.removeEventListener('click', handleSquareClick);
    square.addEventListener('click', handleSquareClick);
});
document.querySelectorAll('.piece').forEach(piece => {
    piece.removeEventListener('click', handlePieceClick);
    piece.addEventListener('click', handlePieceClick);
});

function handlePieceClick(e) {
    console.log('Piece clicked:', this.dataset.piece, 'at row:', this.dataset.row, 'col:', this.dataset.col);
    e.stopPropagation();
    clearDots();
    if (selectedPiece === this) {
        console.log('Deselecting piece:', selectedPiece.dataset.piece);
        selectedPiece = null;
    } else if (this.dataset.piece.split('-')[1] === currentPlayer) {
        console.log('Selecting new piece:', this.dataset.piece);
        selectedPiece = this;
        showLegalMoves(parseInt(this.dataset.row), parseInt(this.dataset.col));
    }
}

function handleSquareClick() {
    console.log('Square clicked:', this.dataset.row, this.dataset.col);
    if (selectedPiece) {
        const newRow = parseInt(this.dataset.row);
        const newCol = parseInt(this.dataset.col);
        console.log('Attempting to move selected piece:', selectedPiece.dataset.piece, 'to row:', newRow, 'col:', newCol);

        const legalMoveFound = legalMoves.some(move => move[0] === newRow && move[1] === newCol);
        console.log('Is move legal?', legalMoveFound);

        if (legalMoveFound) {
            const [oldRow, oldCol] = [parseInt(selectedPiece.dataset.row), parseInt(selectedPiece.dataset.col)];
            console.log('Executing move from', oldRow, oldCol, 'to', newRow, newCol);

            initialBoardSetup[newRow][newCol] = initialBoardSetup[oldRow][oldCol]; // Update the board state
            initialBoardSetup[oldRow][oldCol] = null;

            updateBoardVisuals(oldRow, oldCol, newRow, newCol); // Handle the visuals

            currentPlayer = (currentPlayer === 'w') ? 'b' : 'w'; // Switch turns
            selectedPiece = null; // Deselect the piece after moving
            clearDots(); // Clear potential move indicators
        }
    } else {
        console.log('No piece selected to move.');
    }
}

function updateBoardVisuals(oldRow, oldCol, newRow, newCol) {
    // Clear the old and new squares visually
    const oldSquare = chessboard.children[oldRow * 8 + oldCol];
    const newSquare = chessboard.children[newRow * 8 + newCol];
    oldSquare.innerHTML = '';
    newSquare.innerHTML = '';

    // Move the piece visually to the new square
    newSquare.appendChild(selectedPiece);
    selectedPiece.dataset.row = newRow;
    selectedPiece.dataset.col = newCol;
}
function clearDots() {
    const dots = document.querySelectorAll('.move-dot');
    dots.forEach(dot => dot.remove());
}
function getLegalMoves(piece, row, col) {
    const type = piece.split('-')[0];
    const color = piece.split('-')[1];
    const moves = [];
    switch (type) {
        case 'pawn':
            const direction = (color === 'w') ? -1 : 1;
            const startRow = (color === 'w') ? 6 : 1;
            // Forward movement
            if (row + direction >= 0 && row + direction < 8 && !initialBoardSetup[row + direction][col]) {
                moves.push([row + direction, col]);
                // Check for initial double move
                if (row === startRow && !initialBoardSetup[row + 2 * direction][col]) {
                    moves.push([row + 2 * direction, col]);
                }
            }
            // Diagonal captures
            if (col > 0 && row + direction >= 0 && row + direction < 8 && initialBoardSetup[row + direction][col - 1] && initialBoardSetup[row + direction][col - 1].split('-')[1] !== color) {
                moves.push([row + direction, col - 1]);
            }
            if (col < 7 && row + direction >= 0 && row + direction < 8 && initialBoardSetup[row + direction][col + 1] && initialBoardSetup[row + direction][col + 1].split('-')[1] !== color) {
                moves.push([row + direction, col + 1]);
            }
            break;
        case 'rook':
            for (let i = row + 1; i < 8 && (!initialBoardSetup[i][col] || initialBoardSetup[i][col].split('-')[1] !== color); i++) {
                moves.push([i, col]);
                if (initialBoardSetup[i][col]) break;
            }
            for (let i = row - 1; i >= 0 && (!initialBoardSetup[i][col] || initialBoardSetup[i][col].split('-')[1] !== color); i--) {
                moves.push([i, col]);
                if (initialBoardSetup[i][col]) break;
            }
            for (let i = col + 1; i < 8 && (!initialBoardSetup[row][i] || initialBoardSetup[row][i].split('-')[1] !== color); i++) {
                moves.push([row, i]);
                if (initialBoardSetup[row][i]) break;
            }
            for (let i = col - 1; i >= 0 && (!initialBoardSetup[row][i] || initialBoardSetup[row][i].split('-')[1] !== color); i--) {
                moves.push([row, i]);
                if (initialBoardSetup[row][i]) break;
            }
            break;
        case 'knight':
            const knightMoves = [
                [row + 2, col + 1], [row + 2, col - 1], [row - 2, col + 1], [row - 2, col - 1],
                [row + 1, col + 2], [row + 1, col - 2], [row - 1, col + 2], [row - 1, col - 2]
            ];
            knightMoves.forEach(move => {
                const [r, c] = move;
                if (r >= 0 && r < 8 && c >= 0 && c < 8 && (!initialBoardSetup[r][c] || initialBoardSetup[r][c].split('-')[1] !== color)) {
                    moves.push([r, c]);
                }
            });
            break;
        case 'bishop':
            for (let i = 1; row + i < 8 && col + i < 8 && (!initialBoardSetup[row + i][col + i] || initialBoardSetup[row + i][col + i].split('-')[1] !== color); i++) {
                moves.push([row + i, col + i]);
                if (initialBoardSetup[row + i][col + i]) break;
            }
            for (let i = 1; row - i >= 0 && col - i >= 0 && (!initialBoardSetup[row - i][col - i] || initialBoardSetup[row - i][col - i].split('-')[1] !== color); i++) {
                moves.push([row - i, col - i]);
                if (initialBoardSetup[row - i][col - i]) break;
            }
            for (let i = 1; row + i < 8 && col - i >= 0 && (!initialBoardSetup[row + i][col - i] || initialBoardSetup[row + i][col - i].split('-')[1] !== color); i++) {
                moves.push([row + i, col - i]);
                if (initialBoardSetup[row + i][col - i]) break;
            }
            for (let i = 1; row - i >= 0 && col + i < 8 && (!initialBoardSetup[row - i][col + i] || initialBoardSetup[row - i][col + i].split('-')[1] !== color); i++) {
                moves.push([row - i, col + i]);
                if (initialBoardSetup[row - i][col + i]) break;
            }
            break;
        case 'queen':
            // Combine rook and bishop moves
            for (let i = row + 1; i < 8 && (!initialBoardSetup[i][col] || initialBoardSetup[i][col].split('-')[1] !== color); i++) {
                moves.push([i, col]);
                if (initialBoardSetup[i][col]) break;
            }
            for (let i = row - 1; i >= 0 && (!initialBoardSetup[i][col] || initialBoardSetup[i][col].split('-')[1] !== color); i--) {
                moves.push([i, col]);
                if (initialBoardSetup[i][col]) break;
            }
            for (let i = col + 1; i < 8 && (!initialBoardSetup[row][i] || initialBoardSetup[row][i].split('-')[1] !== color); i++) {
                moves.push([row, i]);
                if (initialBoardSetup[row][i]) break;
            }
            for (let i = col - 1; i >= 0 && (!initialBoardSetup[row][i] || initialBoardSetup[row][i].split('-')[1] !== color); i--) {
                moves.push([row, i]);
                if (initialBoardSetup[row][i]) break;
            }
            for (let i = 1; row + i < 8 && col + i < 8 && (!initialBoardSetup[row + i][col + i] || initialBoardSetup[row + i][col + i].split('-')[1] !== color); i++) {
                moves.push([row + i, col + i]);
                if (initialBoardSetup[row + i][col + i]) break;
            }
            for (let i = 1; row - i >= 0 && col - i >= 0 && (!initialBoardSetup
[row - i][col - i] || initialBoardSetup[row - i][col - i].split('-')[1] !== color); i++) {
                moves.push([row - i, col - i]);
                if (initialBoardSetup[row - i][col - i]) break;
            }
            for (let i = 1; row + i < 8 && col - i >= 0 && (!initialBoardSetup[row + i][col - i] || initialBoardSetup[row + i][col - i].split('-')[1] !== color); i++) {
                moves.push([row + i, col - i]);
                if (initialBoardSetup[row + i][col - i]) break;
            }
            for (let i = 1; row - i >= 0 && col + i < 8 && (!initialBoardSetup[row - i][col + i] || initialBoardSetup[row - i][col + i].split('-')[1] !== color); i++) {
                moves.push([row - i, col + i]);
                if (initialBoardSetup[row - i][col + i]) break;
            }
            break;
        case 'king':
            const kingMoves = [
                [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1],
                [row - 1, col - 1], [row - 1, col + 1], [row + 1, col - 1], [row + 1, col + 1]
            ];
            kingMoves.forEach(move => {
                const [r, c] = move;
                if (r >= 0 && r < 8 && c >= 0 && c < 8 && (!initialBoardSetup[r][c] || initialBoardSetup[r][c].split('-')[1] !== color)) {
                    moves.push([r, c]);
                }
            });
            break;
    }
    return moves;
}
function showLegalMoves(row, col) {
    const piece = selectedPiece.dataset.piece;
    legalMoves = getLegalMoves(piece, row, col);
    legalMoves.forEach(move => {
        const [r, c] = move;
        const square = chessboard.children[r * 8 + c];
        const dot = document.createElement('div');
        dot.className = 'move-dot';
        square.appendChild(dot);
    });
}
for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
        const square = document.createElement('div');
        square.className = 'square ' + ((row + col) % 2 === 0 ? 'white' : 'black');
        square.dataset.row = row;
        square.dataset.col = col;
        if (initialBoardSetup[row][col]) {
            const piece = document.createElement('img');
            piece.src = `images/${initialBoardSetup[row][col]}.svg`;
            piece.className = 'piece';
            piece.dataset.piece = initialBoardSetup[row][col];
            piece.dataset.row = row;
            piece.dataset.col = col;
            piece.addEventListener('click', (e) => {
                console.log('Piece clicked:', piece.dataset.piece, 'at row:', piece.dataset.row, 'col:', piece.dataset.col);
                e.stopPropagation(); // Prevent the square's event from firing
                clearDots();
                if (selectedPiece === piece) {
                    console.log('Deselecting piece:', selectedPiece.dataset.piece);
                    selectedPiece = null;
                } else if (piece.dataset.piece.split('-')[1] === currentPlayer) {
                    console.log('Selecting new piece:', piece.dataset.piece);
                    selectedPiece = piece;
                    showLegalMoves(parseInt(piece.dataset.row), parseInt(piece.dataset.col));
                }
            });
            square.appendChild(piece);
        }
        square.addEventListener('click', function() {
            console.log('Square clicked:', this.dataset.row, this.dataset.col);
            if (selectedPiece) {
                console.log('Selected piece trying to move:', selectedPiece.dataset.piece);
                const newRow = parseInt(this.dataset.row);
                const newCol = parseInt(this.dataset.col);
                const legalMoveFound = legalMoves.some(move => move[0] === newRow && move[1] === newCol);
                console.log('Is move legal?', legalMoveFound);
        
                if (legalMoveFound) {
                    const [oldRow, oldCol] = [parseInt(selectedPiece.dataset.row), parseInt(selectedPiece.dataset.col)];
                    console.log('Executing move from', oldRow, oldCol, 'to', newRow, newCol);
        
                    initialBoardSetup[newRow][newCol] = initialBoardSetup[oldRow][oldCol];
                    initialBoardSetup[oldRow][oldCol] = null;
        
                    chessboard.children[oldRow * 8 + oldCol].innerHTML = ''; // Clear old square
                    chessboard.children[newRow * 8 + newCol].innerHTML = ''; // Clear target square if capturing
                    chessboard.children[newRow * 8 + newCol].appendChild(selectedPiece); // Move the piece to the new square
        
                    selectedPiece.dataset.row = newRow;
                    selectedPiece.dataset.col = newCol;
        
                    clearDots(); // Clear dots
                    selectedPiece = null; // Deselect the piece
                    currentPlayer = (currentPlayer === 'w') ? 'b' : 'w'; // Switch turns
                    console.log('Move completed to', newRow, newCol);
                } else {
                    console.log('Move not valid or no piece selected');
                    clearDots();
                    selectedPiece = null; // Deselect piece if clicked again
                }
            } else {
                console.log('No piece selected');
            }
        });
        chessboard.appendChild(square);
    }
}
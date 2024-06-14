console.log('chess.js script loaded');

const initialBoardSetup = [
    ['rook-b', 'knight-b', 'bishop-b', 'queen-b', 'king-b', 'bishop-b', 'knight-b', 'rook-b'],
    ['pawn-b', 'pawn-b', 'pawn-b', 'pawn-b', 'pawn-b', 'pawn-b', 'pawn-b', 'pawn-b'],
    [], [], [], [],
    ['pawn-w', 'pawn-w', 'pawn-w', 'pawn-w', 'pawn-w', 'pawn-w', 'pawn-w', 'pawn-w'],
    ['rook-w', 'knight-w', 'bishop-w', 'queen-w', 'king-w', 'bishop-w', 'knight-w', 'rook-w']
];

const chessboard = document.getElementById('chessboard');
console.log('Chessboard element:', chessboard);

let selectedPiece = null;
let legalMoves = [];

function clearDots() {
    const dots = document.querySelectorAll('.move-dot');
    dots.forEach(dot => dot.remove());
}

function showLegalMoves(row, col) {
    // Example: allow pieces to move one square in any direction (for demonstration purposes)
    const potentialMoves = [
        [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1],
        [row - 1, col - 1], [row - 1, col + 1], [row + 1, col - 1], [row + 1, col + 1]
    ];

    legalMoves = potentialMoves.filter(move => {
        const [r, c] = move;
        return r >= 0 && r < 8 && c >= 0 && c < 8 && (!initialBoardSetup[r][c] || initialBoardSetup[r][c][1] !== selectedPiece.dataset.piece.split('-')[1]);
    });

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
                e.stopPropagation();
                clearDots();
                if (selectedPiece === piece) {
                    selectedPiece = null;
                } else {
                    selectedPiece = piece;
                    showLegalMoves(row, col);
                }
            });
            square.appendChild(piece);
        }

        square.addEventListener('click', () => {
            if (selectedPiece && legalMoves.some(move => move[0] == square.dataset.row && move[1] == square.dataset.col)) {
                const [oldRow, oldCol] = [selectedPiece.dataset.row, selectedPiece.dataset.col];
                initialBoardSetup[square.dataset.row][square.dataset.col] = initialBoardSetup[oldRow][oldCol];
                initialBoardSetup[oldRow][oldCol] = null;
                selectedPiece.dataset.row = square.dataset.row;
                selectedPiece.dataset.col = square.dataset.col;
                square.appendChild(selectedPiece);
                selectedPiece = null;
                clearDots();
            }
        });

        chessboard.appendChild(square);
    }
}
console.log('Board setup completed');
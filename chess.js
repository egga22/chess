document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('chessboard');
    const squares = [];

    const pieceImages = {
        'r': 'images/rook-b.svg', 'n': 'images/knight-b.svg', 'b': 'images/bishop-b.svg', 'q': 'images/queen-b.svg', 'k': 'images/king-b.svg', 'p': 'images/pawn-b.svg',
        'R': 'images/rook-w.svg', 'N': 'images/knight-w.svg', 'B': 'images/bishop-w.svg', 'Q': 'images/queen-w.svg', 'K': 'images/king-w.svg', 'P': 'images/pawn-w.svg'
    };

    const initialBoardSetup = [
        'r', 'n', 'b', 'q', 'k', 'b', 'n', 'r',
        'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
        'R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'
    ];

    function createBoard() {
        for (let i = 0; i < 64; i++) {
            const square = document.createElement('div');
            square.classList.add('square');
            if ((Math.floor(i / 8) + i % 8) % 2 === 0) {
                square.classList.add('light');
            } else {
                square.classList.add('dark');
            }
            square.dataset.index = i;
            if (initialBoardSetup[i]) {
                const piece = document.createElement('div');
                piece.classList.add('piece');
                piece.style.backgroundImage = `url('${pieceImages[initialBoardSetup[i]]}')`;
                square.appendChild(piece);
            }
            boardElement.appendChild(square);
            squares.push(square);
        }
    }

    createBoard();
});
document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('chessboard');
    const squares = [];

    const pieceImages = {
        'r': 'rook-b.svg', 'n': 'knight-b.svg', 'b': 'bishop-b.svg', 'q': 'queen-b.svg', 'k': 'king-b.svg', 'p': 'pawn-b.svg',
        'R': 'rook-w.svg', 'N': 'knight-w.svg', 'B': 'bishop-w.svg', 'Q': 'queen-w.svg', 'K': 'king-w.svg', 'P': 'pawn-w.svg'
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
                piece.style.backgroundImage = `url('images/${pieceImages[initialBoardSetup[i]]}')`;
                square.appendChild(piece);
            }
            boardElement.appendChild(square);
            squares.push(square);
        }
    }

    createBoard();
});
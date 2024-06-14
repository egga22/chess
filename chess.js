document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('chessboard');
    const squares = [];

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
            square.textContent = initialBoardSetup[i];
            boardElement.appendChild(square);
            squares.push(square);
        }
    }

    createBoard();
});

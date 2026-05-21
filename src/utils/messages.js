export const DRAMATIC_TEMPLATES = [
  ({ winner, loser }) => [
    { text: 'The winner today is...', delay: 0 },
    { text: winner + '!', delay: 2000, highlight: true },
    { text: 'Congratulations!!', delay: 3200 },
  ],
  ({ winner, loser }) => [
    { text: loser + '!', delay: 0, fakeout: true },
    { text: 'Better luck next time.', delay: 1600 },
    { text: winner + ' has won this spin.', delay: 3000, highlight: true },
  ],
  ({ winner }) => [
    { text: 'And the verdict is...', delay: 0 },
    { text: winner + ' takes it!', delay: 2200, highlight: true },
  ],
  ({ winner, loser }) => [
    { text: 'Oh ' + loser + '...', delay: 0, fakeout: true },
    { text: 'so close! But no —', delay: 1800 },
    { text: winner + ' prevails today!', delay: 3200, highlight: true },
  ],
  ({ winner }) => [
    { text: 'RANDO-TRON has spoken.', delay: 0 },
    { text: '...', delay: 1400 },
    { text: winner + '!!', delay: 2600, highlight: true },
    { text: 'YOU WIN!', delay: 3600 },
  ],
  ({ winner, loser }) => [
    { text: 'After careful deliberation...', delay: 0 },
    { text: loser + ' must yield.', delay: 2000, fakeout: true },
    { text: winner + ' wins!', delay: 3600, highlight: true },
  ],
  ({ winner }) => [
    { text: 'The wheel has spoken!', delay: 0 },
    { text: winner + ' is victorious!', delay: 2000, highlight: true },
  ],
  ({ winner, loser }) => [
    { text: loser + '...', delay: 0, fakeout: true },
    { text: 'not today.', delay: 1400 },
    { text: 'Today belongs to ' + winner + '!', delay: 3000, highlight: true },
  ],
  ({ winner }) => [
    { text: 'Step forward...', delay: 0 },
    { text: winner + '!', delay: 2000, highlight: true },
    { text: 'The crown is yours.', delay: 3200 },
  ],
  ({ winner, loser }) => [
    { text: loser + ', you were so close.', delay: 0, fakeout: true },
    { text: 'Except... wait.', delay: 2000 },
    { text: winner + '! WINNER!', delay: 3400, highlight: true },
  ],
];

export function getDramaticMessage(winner, loser) {
  const template = DRAMATIC_TEMPLATES[Math.floor(Math.random() * DRAMATIC_TEMPLATES.length)];
  return template({ winner, loser });
}

// -----------------------------------------------------------------------------
// GameState — tiny state machine for the playable game.
// -----------------------------------------------------------------------------
// Possible states: 'loading' | 'playing' | 'won' | 'lost'
// 'lost' is entered when no free walkers remain AND we haven't won yet.
// The sandbox does not use this machine — it lives in its own controller.
// -----------------------------------------------------------------------------

export function createGameState() {
  return { state: 'loading', reason: null };
}

export function setState(gs, next, reason = null) {
  gs.state = next;
  gs.reason = reason;
}

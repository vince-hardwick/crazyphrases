import {
  recoverAnonymousSoloGame,
  serializeAnonymousSoloGame,
} from "./game-state.js?v=__ASSET_VERSION__";

export const LOCAL_ANONYMOUS_SOLO_GAME_KEY =
  "crazyphrases.anonymousSolo.currentGame.v1";

export function loadCurrentAnonymousSoloGame(storage) {
  try {
    return recoverAnonymousSoloGame(
      storage.getItem(LOCAL_ANONYMOUS_SOLO_GAME_KEY),
    );
  } catch {
    return null;
  }
}

export function saveCurrentAnonymousSoloGame(storage, game) {
  try {
    storage.setItem(
      LOCAL_ANONYMOUS_SOLO_GAME_KEY,
      serializeAnonymousSoloGame(game),
    );
  } catch {
    // Local storage is convenience recovery only; the game must remain playable.
  }
}

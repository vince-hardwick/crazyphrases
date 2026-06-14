export function createSignedInGameSession({ repository } = {}) {
  if (!repository || typeof repository.saveCurrentGame !== "function") {
    if (typeof repository?.saveCurrentGameRecord !== "function") {
      throw new Error("A signed-in game repository is required.");
    }
  }

  let currentRevision = null;

  async function loadCurrentGame({ accountId }) {
    if (typeof repository.loadCurrentGameRecord === "function") {
      const record = await repository.loadCurrentGameRecord({ accountId });
      currentRevision = record?.revision ?? null;
      return record?.game ?? null;
    }

    currentRevision = null;
    return repository.loadCurrentGame({ accountId });
  }

  async function saveCurrentGame({ accountId, game }) {
    if (typeof repository.saveCurrentGameRecord === "function") {
      const request = {
        accountId,
        game,
      };

      if (currentRevision !== null) {
        request.expectedRevision = currentRevision;
      }

      const record = await repository.saveCurrentGameRecord(request);
      currentRevision = record.revision;
      return record.game;
    }

    return repository.saveCurrentGame({ accountId, game });
  }

  function reset() {
    currentRevision = null;
  }

  return {
    loadCurrentGame,
    reset,
    saveCurrentGame,
  };
}

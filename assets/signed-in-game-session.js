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

  async function deleteCurrentGame({ accountId }) {
    if (typeof repository.deleteCurrentGame !== "function") {
      throw new Error("A signed-in game repository with delete support is required.");
    }

    await repository.deleteCurrentGame({ accountId });
    currentRevision = null;
  }

  function reset() {
    currentRevision = null;
  }

  return {
    deleteCurrentGame,
    loadCurrentGame,
    reset,
    saveCurrentGame,
  };
}

import {
  formatBatchCopyText,
  formatPhraseCopyText,
} from "./game-state.js?v=__ASSET_VERSION__";

const FIXED_UK_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatFavouriteSavedDate(createdAt) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return FIXED_UK_DATE_FORMATTER.format(date);
}

export function createFavouriteRowModel({ kind, record, currentGamerTag = "" }) {
  const savedDateText = formatFavouriteSavedDate(record.createdAt);
  const savedDateAccessibleText =
    savedDateText === "" ? "Saved date unavailable" : `Saved ${savedDateText}`;
  const participantIndicator = getParticipantIndicator({
    favourite: record.favourite,
    currentGamerTag,
  });

  if (kind === "phrase") {
    return {
      id: record.id,
      kind,
      primaryText: record.favourite.phraseText,
      savedDateText,
      savedDateAccessibleText,
      participantIndicator,
      accessibleLabel:
        `Phrase favourite, saved ${savedDateText}, ${participantIndicator}`,
    };
  }

  const phraseCount = record.favourite.rowCount ?? record.favourite.phrases.length;
  const phraseCountText = `${phraseCount} ${phraseCount === 1 ? "phrase" : "phrases"}`;

  return {
    id: record.id,
    kind,
    primaryText: "Batch favourite",
    detailText: phraseCountText,
    savedDateText,
    savedDateAccessibleText,
    participantIndicator,
    accessibleLabel:
      `Batch favourite, ${phraseCountText}, saved ${savedDateText}, ${participantIndicator}`,
  };
}

export function getPhraseFavouriteCopyText(record) {
  return formatPhraseCopyText(record.favourite.phraseText);
}

export function getBatchFavouriteCopyText(record) {
  return formatBatchCopyText(record.favourite.phrases);
}

function getParticipantIndicator({ favourite, currentGamerTag }) {
  if (favourite.sourceMode === "signed-in-solo") {
    return "Solo";
  }

  const participants = Array.isArray(favourite.participants)
    ? favourite.participants
    : [];

  if (participants.length === 0) {
    return "Solo";
  }

  const normalisedCurrentGamerTag = normaliseGamerTag(currentGamerTag);
  const current = participants.find(
    (participant) =>
      normaliseGamerTag(participant.gamerTag) === normalisedCurrentGamerTag,
  );
  const others = participants.filter(
    (participant) =>
      normaliseGamerTag(participant.gamerTag) !== normalisedCurrentGamerTag,
  );

  if (!current) {
    return formatParticipantList(others);
  }

  if (others.length === 0) {
    return "You";
  }

  return formatParticipantList([{ displayName: "You", gamerTag: "You" }, ...others]);
}

function formatParticipantList(participants) {
  const labels = participants.map(formatParticipantLabel).filter(Boolean);

  if (labels.length <= 2) {
    return labels.join(" + ");
  }

  return `${labels[0]} + ${labels[1]} + ${labels.length - 2}`;
}

function formatParticipantLabel(participant) {
  if (participant.displayName === "You") {
    return "You";
  }

  return String(participant.gamerTag ?? "").trim();
}

function normaliseGamerTag(gamerTag) {
  return String(gamerTag ?? "").trim().toLocaleLowerCase("en-GB");
}

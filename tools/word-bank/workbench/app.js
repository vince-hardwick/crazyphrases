const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");

const commonnessHelp = {
  common: "Familiar to a broad contemporary UK audience. ESDB sizes 35 and 40 suggest this grade but do not decide it.",
  lessCommon: "Recognisable but less familiar in everyday use. ESDB sizes 50 and 60 suggest this grade but do not decide it.",
  rare: "Unusual but still current. ESDB sizes 70 and 80 suggest this grade but do not decide it.",
};
const bandHelp = [
  ["People and Groups", "People, social roles, communities, and organised groups. Illustrative examples: teacher and choir."],
  ["Animals and Plants", "Animals, plants, fungi, and recognisable kinds of living organism. Illustrative examples: otter and oak."],
  ["Body", "Body parts, organs, and physical bodily structures. Illustrative examples: elbow and skeleton."],
  ["Food and Drink", "Foods, ingredients, prepared dishes, and drinks. Illustrative examples: biscuit and lemonade."],
  ["Places", "Locations, spaces, geographical features, and places people can occupy or visit. Illustrative examples: harbour and playground."],
  ["Made Objects", "Tangible things made or substantially shaped by people. Illustrative examples: lantern and bicycle."],
  ["Nature and Materials", "Natural objects, substances, materials, weather, and physical phenomena. Illustrative examples: granite and thunder."],
  ["Actions and Events", "Activities, processes, happenings, and occasions. Illustrative examples: collision and celebration."],
  ["Ideas and Communication", "Thoughts, knowledge, messages, reasons, and communicated concepts. Illustrative examples: rumour and promise."],
  ["Feelings and Conditions", "Emotions, qualities, states, illnesses, and other conditions. Illustrative examples: delight and illness."],
  ["Measures and Relationships", "Quantities, periods, shapes, comparisons, possession, and relationships. Illustrative examples: distance and ownership."],
];

let state = null;
let activeView = "home";
let dirty = false;
let draft = null;
let errors = [];

window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

document.addEventListener("keydown", (event) => {
  if (activeView === "review" && event.ctrlKey && event.key === "Enter") {
    event.preventDefault();
    document.querySelector("[data-save-next]")?.click();
  }
});

await refreshState();
renderHome();

async function refreshState() {
  state = await api("/api/state");
}

function renderHome({ searchResults = null, query = "" } = {}) {
  activeView = "home";
  dirty = false;
  draft = null;
  errors = [];
  const active = state.tranches.find((tranche) => tranche.lifecycle === "active");
  const planned = state.tranches.find((tranche) => tranche.lifecycle === "planned");
  const complete = state.tranches.filter((tranche) => tranche.lifecycle === "complete");

  app.innerHTML = `
    ${state.mode === "readOnly" ? `<section class="panel banner" role="status"><strong>Read-only.</strong> Another process holds the review-data write lock. Search and inspect freely; mutation controls are unavailable.</section>` : ""}
    <section class="panel">
      <div class="toolbar">
        <div>
          <h2>Review Register</h2>
          <p class="muted">Pinned noun Source Catalogue: ${escapeHtml(state.catalogue.id)} (${Number(state.catalogue.candidateCount).toLocaleString("en-GB")} candidates)</p>
        </div>
        ${active ? state.activeCandidate ? `<button data-first-pending>First pending</button>` : `<button data-open-completion>Complete Tranche</button>` : planned ? `<button data-start-next ${state.mode === "readOnly" ? "disabled" : ""}>Start next tranche</button>` : ""}
      </div>
      ${state.tranches.map(renderTrancheCard).join("")}
      ${complete.length > 0 ? `<p class="muted">Starting another tranche requires the latest completed tranche and this Register index to be committed locally. Unrelated changes do not block that checkpoint.</p>` : ""}
    </section>
    <section class="panel">
      <h2>Candidate search</h2>
      <p>Case-insensitive exact and prefix search across registered Entry Kinds. Results are read-only and never bypass sequential review.</p>
      <form data-search-form class="inline">
        <label for="candidate-search" class="sr-only">Candidate exact or prefix</label>
        <input id="candidate-search" type="search" value="${escapeAttribute(query)}" placeholder="Exact candidate or prefix" autocomplete="off" />
        <button type="submit">Search</button>
      </form>
      <div data-search-results>${searchResults ? renderSearchResults(searchResults, query, Boolean(active)) : ""}</div>
    </section>
    <div class="errors" role="alert" data-errors></div>
  `;

  document.querySelector("[data-start-next]")?.addEventListener("click", startNextTrancheAction);
  document.querySelector("[data-first-pending]")?.addEventListener("click", () => renderReview());
  document.querySelector("[data-open-completion]")?.addEventListener("click", () => renderReview());
  document.querySelector("[data-search-form]").addEventListener("submit", runSearch);
  bindSearchResultActions();
}

function renderTrancheCard(tranche) {
  return `
    <article class="result">
      <div class="progress-heading">
        <h3>${escapeHtml(tranche.id)}</h3>
        <span>${escapeHtml(tranche.entryKind)} · ${escapeHtml(tranche.lifecycle)}</span>
      </div>
      <progress value="${tranche.progress.reviewed}" max="${tranche.progress.total}" aria-label="${tranche.progress.percentage}% reviewed"></progress>
      <p>${tranche.progress.percentage}% reviewed — ${tranche.progress.reviewed} of ${tranche.progress.total}</p>
    </article>
  `;
}

async function startNextTrancheAction() {
  try {
    state = await api("/api/start-next", {
      method: "POST",
      body: { expectedIndexHash: state.hashes["register.json"] },
    });
    renderReview();
  } catch (error) {
    showErrors([error.message]);
  }
}

async function runSearch(event) {
  event.preventDefault();
  const query = document.querySelector("#candidate-search").value;

  try {
    const result = await api(`/api/search?q=${encodeURIComponent(query)}`);
    renderHome({ searchResults: result.results, query });
  } catch (error) {
    showErrors([error.message]);
  }
}

function renderSearchResults(results, query, hasActive) {
  if (results.length === 0) {
    return `<p class="muted">No registered candidate matches that exact value or prefix.</p>`;
  }

  return `
    <div class="actions">
      <button type="button" class="secondary" data-reopen-selected disabled>Reopen selected for correction</button>
    </div>
    ${results
      .map(
        (result, index) => `
          <article class="result">
            <h3>${highlightPrefix(result.canonicalText, query)}</h3>
            <p>${escapeHtml(result.entryKind)} · ${escapeHtml(result.trancheId)} · sequence ${result.sequence} · ${escapeHtml(result.lifecycle)} · ${escapeHtml(result.reviewState)}</p>
            <div class="actions">
              <button type="button" class="secondary" data-open-summary="${index}">Open read-only summary</button>
              ${result.lifecycle === "complete" && !hasActive && state.mode === "writable" ? `<label class="option"><input type="checkbox" data-correction-choice="${index}" /> Select for correction</label>` : ""}
            </div>
          </article>
        `,
      )
      .join("")}
  `;
}

function bindSearchResultActions() {
  const resultsRoot = document.querySelector("[data-search-results]");
  if (!resultsRoot) return;
  const encodedResults = [...resultsRoot.querySelectorAll("[data-open-summary]")];
  const form = document.querySelector("[data-search-form]");
  let latestResults = [];

  form?.addEventListener("submit", () => {});
  // Result data is refreshed from the server to keep summaries read-only and current.
  for (const button of encodedResults) {
    button.addEventListener("click", async () => {
      const query = document.querySelector("#candidate-search").value;
      latestResults = (await api(`/api/search?q=${encodeURIComponent(query)}`)).results;
      renderSummary(latestResults[Number(button.dataset.openSummary)]);
    });
  }

  const choices = [...resultsRoot.querySelectorAll("[data-correction-choice]")];
  const reopen = resultsRoot.querySelector("[data-reopen-selected]");
  const syncReopen = () => {
    if (reopen) reopen.disabled = !choices.some((choice) => choice.checked);
  };
  choices.forEach((choice) => choice.addEventListener("change", syncReopen));
  reopen?.addEventListener("click", async () => {
    const query = document.querySelector("#candidate-search").value;
    latestResults = (await api(`/api/search?q=${encodeURIComponent(query)}`)).results;
    const selected = choices
      .filter((choice) => choice.checked)
      .map((choice) => latestResults[Number(choice.dataset.correctionChoice)]);
    const trancheIds = new Set(selected.map((result) => result.trancheId));

    if (trancheIds.size !== 1) {
      showErrors(["Correction candidates must belong to one completed tranche."]);
      return;
    }

    const trancheId = selected[0].trancheId;
    const reference = state.tranches.find((tranche) => tranche.id === trancheId);
    try {
      state = await api("/api/reopen", {
        method: "POST",
        body: {
          trancheId,
          selectedSequences: selected.map((result) => result.sequence),
          expectedIndexHash: state.hashes["register.json"],
          expectedTrancheHash: state.hashes[reference.path],
        },
      });
      renderReview();
    } catch (error) {
      showErrors([error.message]);
    }
  });
}

function renderSummary(result) {
  activeView = "summary";
  const candidate = result.candidate;
  app.innerHTML = `
    <section class="panel">
      <button type="button" class="secondary" data-home>Back to Register</button>
      <p class="eyebrow">Read-only candidate summary</p>
      <h2 class="candidate-word">${escapeHtml(candidate.canonicalText)}</h2>
      <p>${escapeHtml(result.entryKind)} · ${escapeHtml(result.trancheId)} · sequence ${result.sequence} · ${escapeHtml(result.lifecycle)} · ${escapeHtml(result.reviewState)}</p>
      ${renderEvidence(candidate)}
      <h3>Persisted decision</h3>
      <pre>${escapeHtml(JSON.stringify(candidate.decision, null, 2))}</pre>
    </section>
  `;
  document.querySelector("[data-home]").addEventListener("click", () => renderHome());
  bindHelpButtons();
}

function renderReview() {
  activeView = "review";
  errors = [];
  const activeTranche = state.tranches.find((tranche) => tranche.lifecycle === "active");

  if (!activeTranche) {
    renderHome();
    return;
  }

  if (!state.activeCandidate) {
    app.innerHTML = `
      <section class="panel">
        <p class="eyebrow">${escapeHtml(activeTranche.id)}</p>
        <h2>Every candidate has a valid persisted decision</h2>
        ${renderProgress(activeTranche.progress)}
        <p>Completion changes curation/Register data only. It does not publish a shard, change the manifest, stage or commit Git state, or deploy.</p>
        <div class="actions">
          <button type="button" class="secondary" data-home>Back to Register</button>
          <button type="button" data-complete ${state.mode === "readOnly" ? "disabled" : ""}>Complete Tranche</button>
        </div>
        <div class="errors" role="alert" data-errors></div>
      </section>
    `;
    document.querySelector("[data-home]").addEventListener("click", () => renderHome());
    document.querySelector("[data-complete]")?.addEventListener("click", completeTrancheAction);
    return;
  }

  const candidate = state.activeCandidate;
  draft = candidate.decision
    ? structuredClone(candidate.decision)
    : {
        ukEnglishEligible: null,
        familyFriendly: null,
        curationDecision: null,
        commonnessGrade: null,
        ...(candidate.entryKind === "noun" ? { nounSemanticBand: null } : {}),
      };
  dirty = false;

  app.innerHTML = `
    <section class="panel">
      <div class="toolbar">
        <div><p class="eyebrow">${escapeHtml(candidate.trancheId)} · sequence ${candidate.sequence}</p><h2 class="candidate-word">${escapeHtml(candidate.canonicalText)}</h2></div>
        <button type="button" class="secondary" data-home>Back to Register</button>
      </div>
      ${renderProgress(activeTranche.progress)}
      ${candidate.correctionMode ? `<p class="warning">Correction queue: saved decisions are retained until you explicitly replace them.</p>` : ""}
      ${renderEvidence(candidate)}
      <form data-review-form novalidate>
        ${renderBooleanField("ukEnglishEligible", "UK-English eligibility", "Confirm whether this candidate is accepted in contemporary British English. Source spelling data is evidence only.")}
        ${renderBooleanField("familyFriendly", "Family-friendly", "Set this explicitly for every reviewed candidate. False candidates may remain in curation but cannot enter the default runtime shard.")}
        ${renderCurationDecisionField()}
        ${renderCommonnessField(candidate)}
        ${candidate.entryKind === "noun" ? renderBandField(candidate) : ""}
        <p class="warning" data-non-family ${draft.familyFriendly === false && draft.curationDecision === "Accept" ? "" : "hidden"}>Accepted but non-family-friendly candidates remain excluded from the default shard.</p>
        <div class="errors" role="alert" data-errors></div>
        <div class="actions">
          <button type="button" class="secondary" data-first-pending>First pending</button>
          <button type="submit" data-save-next ${state.mode === "readOnly" ? "disabled" : ""}>Save &amp; Next</button>
        </div>
        <p class="muted">Keyboard shortcut: Ctrl+Enter invokes Save &amp; Next.</p>
      </form>
    </section>
  `;

  bindReviewControls(candidate);
}

function renderBooleanField(field, label, helpText) {
  return `
    <fieldset>
      <legend>${escapeHtml(label)} ${helpButton(field, helpText)}</legend>
      <label class="option"><input type="radio" name="${field}" value="true" ${draft[field] === true ? "checked" : ""} /> Yes</label>
      <label class="option"><input type="radio" name="${field}" value="false" ${draft[field] === false ? "checked" : ""} /> No</label>
    </fieldset>
  `;
}

function renderCurationDecisionField() {
  return `
    <fieldset>
      <legend>Curation Decision ${helpButton("curation", "Accept or Reject is an operator decision. Source suggestions and previously published values are evidence only and never count as a decision.")}</legend>
      <label class="option"><input type="radio" name="curationDecision" value="Accept" ${draft.curationDecision === "Accept" ? "checked" : ""} /> Accept</label>
      <label class="option"><input type="radio" name="curationDecision" value="Reject" ${draft.curationDecision === "Reject" ? "checked" : ""} /> Reject</label>
    </fieldset>
  `;
}

function renderCommonnessField(candidate) {
  return `
    <fieldset data-grade-group>
      <legend>Commonness Grade ${helpButton("commonness", "This is operator-approved familiarity for a contemporary UK audience, not measured frequency or a quality score. ESDB size is only a suggestion.")}</legend>
      ${Object.entries(commonnessHelp).map(([value, help]) => `<div class="inline"><label class="option"><input type="radio" name="commonnessGrade" value="${value}" ${draft.commonnessGrade === value ? "checked" : ""} /> ${displayGrade(value)}</label>${helpButton(`grade-${value}`, help)}</div>`).join("")}
      <button type="button" class="secondary" data-use-grade-suggestion ${candidate.suggestions?.commonnessGrade ? "" : "disabled"}>Use suggestion${candidate.suggestions?.commonnessGrade ? `: ${displayGrade(candidate.suggestions.commonnessGrade)}` : " (none)"}</button>
    </fieldset>
  `;
}

function renderBandField(candidate) {
  return `
    <fieldset data-band-group>
      <legend>Noun Semantic Band ${helpButton("band", "Choose one Crazy Phrases-owned semantic flavour. Open English WordNet may suggest a band only when all exact noun senses collapse to one band; examples are illustrative, not precedents.")}</legend>
      ${bandHelp.map(([band, help]) => `<div class="band-row"><label class="option"><input type="radio" name="nounSemanticBand" value="${escapeAttribute(band)}" ${draft.nounSemanticBand === band ? "checked" : ""} /> ${escapeHtml(band)}</label>${helpButton(`band-${band}`, help)}</div>`).join("")}
      <button type="button" class="secondary" data-use-band-suggestion ${candidate.suggestions?.nounSemanticBand ? "" : "disabled"}>Use suggestion${candidate.suggestions?.nounSemanticBand ? `: ${escapeHtml(candidate.suggestions.nounSemanticBand)}` : " (unresolved)"}</button>
    </fieldset>
  `;
}

function bindReviewControls(candidate) {
  const form = document.querySelector("[data-review-form]");
  bindHelpButtons();
  form.addEventListener("change", async (event) => {
    const input = event.target;
    const field = input.name;
    if (!field) return;
    const previous = draft[field];
    const value = input.value === "true" ? true : input.value === "false" ? false : input.value;

    if (
      field === "curationDecision" &&
      value === "Reject" &&
      candidate.decision?.curationDecision === "Accept" &&
      (draft.commonnessGrade || draft.nounSemanticBand)
    ) {
      const confirmed = await showConfirmationModal({
        title: "Change Accept to Reject?",
        message:
          "This clears the saved Commonness Grade and Noun Semantic Band before the replacement decision is saved.",
        confirmLabel: "Change to Reject",
      });
      if (!confirmed) {
        input.checked = false;
        const prior = form.querySelector(`[name="curationDecision"][value="${previous}"]`);
        if (prior) prior.checked = true;
        return;
      }
      draft.commonnessGrade = null;
      draft.nounSemanticBand = null;
      form.querySelectorAll('[name="commonnessGrade"], [name="nounSemanticBand"]').forEach((control) => { control.checked = false; });
    }

    draft[field] = value;
    dirty = true;
    syncReviewControlState();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveAndAdvance();
  });
  document.querySelector("[data-use-grade-suggestion]")?.addEventListener("click", () => {
    useSuggestion("commonnessGrade", candidate.suggestions.commonnessGrade);
  });
  document.querySelector("[data-use-band-suggestion]")?.addEventListener("click", () => {
    useSuggestion("nounSemanticBand", candidate.suggestions.nounSemanticBand);
  });
  document.querySelector("[data-first-pending]").addEventListener("click", async () => {
    if (await resolveUnsavedChanges()) {
      await refreshState();
      renderReview();
    }
  });
  document.querySelector("[data-home]").addEventListener("click", async () => {
    if (await resolveUnsavedChanges()) renderHome();
  });
  syncReviewControlState();
}

function syncReviewControlState() {
  const form = document.querySelector("[data-review-form]");
  const accept = form.querySelector('[name="curationDecision"][value="Accept"]');
  accept.disabled = draft.ukEnglishEligible !== true;
  if (accept.disabled && draft.curationDecision === "Accept") {
    draft.curationDecision = null;
    accept.checked = false;
  }
  const rejected = draft.curationDecision === "Reject";
  for (const selector of ["[data-grade-group]", "[data-band-group]"]) {
    const group = form.querySelector(selector);
    if (!group) continue;
    group.classList.toggle("disabled-group", rejected);
    group.querySelectorAll("input, [data-use-grade-suggestion], [data-use-band-suggestion]").forEach((control) => {
      control.disabled = rejected || (control.dataset.useGradeSuggestion !== undefined && !state.activeCandidate.suggestions?.commonnessGrade) || (control.dataset.useBandSuggestion !== undefined && !state.activeCandidate.suggestions?.nounSemanticBand);
    });
  }
  const warning = form.querySelector("[data-non-family]");
  warning.hidden = !(draft.familyFriendly === false && draft.curationDecision === "Accept");
}

function useSuggestion(field, value) {
  if (!value || draft.curationDecision === "Reject") return;
  draft[field] = value;
  const control = document.querySelector(`[name="${field}"][value="${cssEscape(value)}"]`);
  if (control) control.checked = true;
  dirty = true;
}

async function saveAndAdvance() {
  const candidate = state.activeCandidate;
  const reference = state.tranches.find((tranche) => tranche.id === candidate.trancheId);
  try {
    state = await api("/api/save-next", {
      method: "POST",
      body: {
        trancheId: candidate.trancheId,
        sequence: candidate.sequence,
        decision: cleanDecision(draft, candidate.entryKind),
        expectedTrancheHash: state.hashes[reference.path],
      },
    });
    dirty = false;
    renderReview();
    return true;
  } catch (error) {
    errors = [error.message];
    showErrors(errors);
    return false;
  }
}

async function completeTrancheAction() {
  const active = state.tranches.find((tranche) => tranche.lifecycle === "active");
  const confirmed = await showConfirmationModal({
    title: "Complete this tranche?",
    message:
      "Completion changes curation/Register data only. It does not commit, publish, change the manifest, or deploy.",
    confirmLabel: "Complete Tranche",
  });
  if (!confirmed) return;
  try {
    state = await api("/api/complete", {
      method: "POST",
      body: {
        trancheId: active.id,
        confirmed: true,
        expectedIndexHash: state.hashes["register.json"],
        expectedTrancheHash: state.hashes[active.path],
      },
    });
    renderHome();
  } catch (error) {
    showErrors([error.message]);
  }
}

async function resolveUnsavedChanges() {
  if (!dirty) return true;
  const choice = await showUnsavedModal();
  if (choice === "cancel") return false;
  if (choice === "discard") {
    dirty = false;
    return true;
  }
  return saveAndAdvance();
}

function showUnsavedModal() {
  return new Promise((resolve) => {
    modalRoot.innerHTML = `<div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-title"><h2 id="unsaved-title">Unsaved decision</h2><p>Save this candidate, discard the unsaved changes, or cancel and keep editing.</p><div class="actions"><button data-choice="save">Save</button><button class="secondary" data-choice="discard">Discard</button><button class="secondary" data-choice="cancel">Cancel</button></div></section></div>`;
    const first = modalRoot.querySelector("[data-choice=save]");
    first.focus();
    modalRoot.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        const choice = button.dataset.choice;
        modalRoot.innerHTML = "";
        resolve(choice);
      });
    });
  });
}

function showConfirmationModal({ title, message, confirmLabel }) {
  return new Promise((resolve) => {
    modalRoot.innerHTML = `<div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="confirmation-title"><h2 id="confirmation-title">${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="actions"><button data-confirm>${escapeHtml(confirmLabel)}</button><button class="secondary" data-cancel>Cancel</button></div></section></div>`;
    const confirm = modalRoot.querySelector("[data-confirm]");
    confirm.focus();
    confirm.addEventListener("click", () => {
      modalRoot.innerHTML = "";
      resolve(true);
    });
    modalRoot.querySelector("[data-cancel]").addEventListener("click", () => {
      modalRoot.innerHTML = "";
      resolve(false);
    });
  });
}

function renderEvidence(candidate) {
  const evidence = candidate.evidence ?? {};
  const suggestion = candidate.suggestions ?? {};
  return `
    <section aria-label="Source evidence">
      <h3>Evidence and suggestions</h3>
      <div class="evidence-grid">
        <div><strong>ESDB size</strong><br />${escapeHtml(evidence.resolvedSize ?? "Missing")}${helpButton("size-evidence", "ESDB size is an approximate vocabulary-list tier, not measured frequency. Sizes 35–80 are admitted; 85 and 99 are excluded.")}</div>
        <div><strong>Spelling / variants</strong><br />${escapeHtml(formatSpellings(evidence.spellings))}${helpButton("spelling-evidence", "_ means no dialect-specific alternative. B is British -ise spelling; Z is excluded Oxford-style -ize spelling. Variant levels 0–4 are admitted automatically and describe spelling relationships, not commonness or quality.")}</div>
        <div><strong>Grade suggestion</strong><br />${escapeHtml(suggestion.commonnessGrade ? displayGrade(suggestion.commonnessGrade) : "None")}</div>
        ${candidate.entryKind === "noun" ? `<div><strong>Band suggestion</strong><br />${escapeHtml(suggestion.nounSemanticBand ?? "Unresolved")}</div>` : ""}
      </div>
      <p class="muted">Suggestions and previously published values are evidence only. Use suggestion is always explicit.</p>
    </section>
  `;
}

function renderProgress(progress) {
  return `<progress value="${progress.reviewed}" max="${progress.total}" aria-label="${progress.percentage}% reviewed"></progress><p>${progress.percentage}% reviewed — ${progress.reviewed} of ${progress.total}</p>`;
}

function helpButton(id, text) {
  const safeId = `help-${String(id).replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}`;
  return `<button type="button" class="help" aria-label="Help" aria-expanded="false" aria-controls="${safeId}" title="${escapeAttribute(text)}">?</button><span id="${safeId}" class="help-popover" role="tooltip">${escapeHtml(text)}</span>`;
}

function bindHelpButtons() {
  document.querySelectorAll("button.help").forEach((button) => {
    button.addEventListener("click", () => {
      button.setAttribute("aria-expanded", String(button.getAttribute("aria-expanded") !== "true"));
    });
  });
}

function showErrors(messages) {
  const target = document.querySelector("[data-errors]");
  if (!target) return;
  target.innerHTML = messages.map((message) => `<p>${escapeHtml(message)}</p>`).join("");
  target.focus?.();
}

async function api(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status}).`);
  return result;
}

function cleanDecision(value, entryKind) {
  const result = {
    ukEnglishEligible: value.ukEnglishEligible,
    familyFriendly: value.familyFriendly,
    curationDecision: value.curationDecision,
  };
  if (value.curationDecision === "Accept") {
    result.commonnessGrade = value.commonnessGrade;
    if (entryKind === "noun") result.nounSemanticBand = value.nounSemanticBand;
  }
  return result;
}

function formatSpellings(spellings) {
  return Array.isArray(spellings) && spellings.length > 0
    ? spellings.map(({ profile, variantLevel }) => `${profile} level ${variantLevel}`).join(", ")
    : "No resolved spelling evidence";
}

function displayGrade(value) {
  return { common: "Common", lessCommon: "Less common", rare: "Rare" }[value] ?? value;
}

function highlightPrefix(value, query) {
  const length = String(query ?? "").trim().length;
  return `<mark>${escapeHtml(value.slice(0, length))}</mark>${escapeHtml(value.slice(length))}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replaceAll('"', '\\"');
}

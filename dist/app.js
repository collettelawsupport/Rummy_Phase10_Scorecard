(function () {
  "use strict";

  const STORAGE_KEY = "family-scorecard-v1";
  const RECORD_RESET_KEY = "bo-daylene-record-reset-2026-09-17";
  const TYPES = {
    rummy: { label: "Rummy", shortRule: "First to 500" },
    phase10: { label: "Phase 10", shortRule: "Complete all 10 phases" },
  };

  const app = document.getElementById("app");
  const newGameDialog = document.getElementById("new-game-dialog");
  const savedGamesDialog = document.getElementById("saved-games-dialog");
  const confirmDialog = document.getElementById("confirm-dialog");
  const playerInputs = document.getElementById("player-inputs");
  const firstDealer = document.getElementById("first-dealer");
  const setupError = document.getElementById("setup-error");
  const toast = document.getElementById("toast");

  let setupType = "rummy";
  let toastTimer;
  let recordWasCleared = false;
  let state = loadState();

  function emptyState() {
    return {
      version: 1,
      games: [],
      activeTab: "rummy",
      activeGameIdByType: { rummy: null, phase10: null },
      record: { boWins: 0, dayleneWins: 0, boPoints: 0, daylenePoints: 0, results: [] },
      maintenanceFlags: [],
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.games)) {
        return { ...emptyState(), maintenanceFlags: [RECORD_RESET_KEY] };
      }
      const loaded = {
        ...emptyState(),
        ...parsed,
        activeGameIdByType: { ...emptyState().activeGameIdByType, ...parsed.activeGameIdByType },
        record: { ...emptyState().record, ...parsed.record },
      };
      if (!loaded.maintenanceFlags?.includes(RECORD_RESET_KEY)) {
        loaded.record = { boWins: 0, dayleneWins: 0, boPoints: 0, daylenePoints: 0, results: [] };
        loaded.maintenanceFlags = [...(loaded.maintenanceFlags || []), RECORD_RESET_KEY];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
        recordWasCleared = true;
      }
      return loaded;
    } catch (error) {
      return { ...emptyState(), maintenanceFlags: [RECORD_RESET_KEY] };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("This browser could not save the latest change.");
    }
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(timestamp) {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(timestamp),
    );
  }

  function normalizeName(name) {
    return name.trim().toLocaleLowerCase();
  }

  function getActiveGame(type = state.activeTab) {
    const gameId = state.activeGameIdByType[type];
    return state.games.find((game) => game.id === gameId) || null;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("toast--show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("toast--show"), 2200);
  }

  function typeGameCount(type) {
    return state.games.filter((game) => game.type === type).length;
  }

  function render() {
    const game = getActiveGame();
    app.innerHTML = `
      <header class="topbar">
        <div class="brand" aria-label="Family Scorecard">
          <div class="brand__mark" aria-hidden="true">+1</div>
          <div>
            <p class="brand__name">Family Scorecard</p>
            <p class="brand__note">Rounds remembered. Dealer tracked.</p>
          </div>
        </div>
        <div class="topbar__actions">
          <button class="button button--secondary" type="button" data-action="saved-games">
            <span aria-hidden="true">▤</span>
            <span class="button__label--desktop">Saved games</span>
          </button>
          <button class="button button--primary" type="button" data-action="new-game">+ New game</button>
        </div>
      </header>
      <div class="game-tabs-wrap">
        <nav class="game-tabs" role="tablist" aria-label="Game type">
          ${Object.keys(TYPES)
            .map(
              (type) => `
                <button
                  class="game-tab"
                  type="button"
                  role="tab"
                  aria-selected="${state.activeTab === type}"
                  data-tab="${type}"
                >
                  ${TYPES[type].label}<span class="game-tab__count">${typeGameCount(type)}</span>
                </button>`,
            )
            .join("")}
        </nav>
      </div>
      <main class="main">
        ${game ? renderGame(game) : renderEmpty(state.activeTab)}
      </main>`;
  }

  function renderEmpty(type) {
    const isRummy = type === "rummy";
    return `
      <section class="empty-state">
        <div class="empty-state__copy">
          <p class="eyebrow">${TYPES[type].label}</p>
          <h1>${isRummy ? "Deal. Score. Reach 500." : "Ten phases. One scorecard."}</h1>
          <p>${
            isRummy
              ? "Add or subtract every round. If the leaders tie at 500 or more, the scorecard keeps only those players in a winner-take-all finish."
              : "Track every player’s score and phase. At the end of each round, mark who completed their phase and the dealer moves automatically."
          }</p>
          <button class="button button--primary" type="button" data-action="new-game">Start ${TYPES[type].label}</button>
        </div>
        <div class="empty-state__score" aria-hidden="true">
          <div class="score-art__number">${isRummy ? "500" : "10"}</div>
          <div class="score-art__label">${isRummy ? "points to win" : "phases to finish"}</div>
        </div>
      </section>`;
  }

  function renderGame(game) {
    const dealer = game.players.find((player) => player.id === game.dealerId);
    const lastWentOut = getLastWentOut(game);
    const isComplete = game.status === "complete";
    const winnerNames = game.winnerIds
      .map((id) => game.players.find((player) => player.id === id)?.name)
      .filter(Boolean);
    const roundLabel = game.rounds.length + 1;

    return `
      <div class="game-layout">
        <header class="game-heading">
          <div>
            <p class="eyebrow">${TYPES[game.type].label} scorecard</p>
            <h1>${escapeHtml(game.name)}</h1>
            <p class="game-heading__meta">Started ${formatDate(game.createdAt)} · ${game.players.length} players</p>
          </div>
          <div class="game-actions">
            ${
              game.rounds.length
                ? `<button class="button button--quiet button--small" type="button" data-action="undo-round">↶ Undo last round</button>`
                : ""
            }
            ${
              isComplete
                ? `<button class="button button--quiet button--small" type="button" data-action="rematch">Rematch</button>`
                : `<button class="button button--quiet button--small" type="button" data-action="restart">Restart</button>`
            }
          </div>
        </header>

        ${
          game.type === "rummy"
            ? `<section class="record-card panel" aria-label="Bo and Daylene all-time Rummy record">
                <div class="record-card__label">
                  <p class="eyebrow">Two-player Rummy record</p>
                <h2>Bo vs. Daylene</h2>
                </div>
                <div class="record-score">
                  <strong>${state.record.boWins}</strong>
                  <span>Bo wins<b>${state.record.boPoints} total pts</b></span>
                </div>
                <div class="record-score">
                  <strong>${state.record.dayleneWins}</strong>
                  <span>Daylene wins<b>${state.record.daylenePoints} total pts</b></span>
                </div>
              </section>`
            : ""
        }

        ${
          game.tieBreakPlayerIds.length && !isComplete
            ? `<div class="tiebreak-callout">
                <strong>Winner-take-all tiebreak</strong>
                <span>Only ${game.tieBreakPlayerIds
                  .map((id) => escapeHtml(game.players.find((player) => player.id === id)?.name || ""))
                  .join(" and ")} score this round. Highest total wins.</span>
              </div>`
            : ""
        }

        ${
          isComplete
            ? `<section class="winner-banner">
                <div class="winner-banner__icon" aria-hidden="true">★</div>
                <div>
                  <h2>${winnerNames.length === 1 ? `${escapeHtml(winnerNames[0])} wins!` : `${winnerNames.map(escapeHtml).join(" & ")} tie!`}</h2>
                  <p>${winnerMessage(game, winnerNames)}</p>
                </div>
                <button class="button button--primary" type="button" data-action="rematch">Play a rematch</button>
              </section>`
            : ""
        }

        <section class="panel scoreboard" aria-label="Current scores">
          <div class="scoreboard__topline">
            <div class="stat">
              <span class="stat__label">Round</span>
              <span class="stat__value">${isComplete ? game.rounds.length : roundLabel}</span>
            </div>
            <div class="stat">
              <span class="stat__label">Dealer</span>
              <span class="stat__value">${escapeHtml(dealer?.name || "—")}</span>
            </div>
            <div class="stat">
              <span class="stat__label">${game.type === "rummy" ? "Last out" : "Goal"}</span>
              <span class="stat__value">${game.type === "rummy" ? escapeHtml(lastWentOut?.name || "—") : TYPES[game.type].shortRule}</span>
            </div>
          </div>
          <div class="player-list">
            ${game.players.map((player, index) => renderPlayerRow(game, player, index)).join("")}
          </div>
        </section>

        ${isComplete ? renderHistorySummary(game) : renderRoundEntry(game)}
      </div>`;
  }

  function winnerMessage(game, names) {
    if (game.type === "phase10") {
      if (names.length > 1) return "They completed Phase 10 with the same lowest score.";
      return `${escapeHtml(names[0])} completed Phase 10 with the lowest finishing score.`;
    }
    if (game.tieBreakResolved) return `${escapeHtml(names[0])} finished the tiebreak with the highest total.`;
    return `${escapeHtml(names[0])} had the highest total when the target was reached.`;
  }

  function renderPlayerRow(game, player, index) {
    const isDealer = player.id === game.dealerId;
    const isTiebreak = game.tieBreakPlayerIds.includes(player.id);
    const isWinner = game.winnerIds.includes(player.id);
    const wentOutLastRound = getLastWentOut(game)?.id === player.id;
    let subline = `Seat ${index + 1}`;
    if (game.type === "phase10") {
      subline = player.completed ? "Completed Phase 10" : `Playing Phase ${player.phase}`;
    } else if (game.tieBreakPlayerIds.length && !isTiebreak) {
      subline = "Tiebreak spectator";
    }

    return `
      <div class="player-row">
        <div class="seat ${isDealer ? "seat--dealer" : ""}" title="${isDealer ? "Current dealer" : `Seat ${index + 1}`}">
          ${isDealer ? "D" : index + 1}
        </div>
        <div class="player-row__identity">
          <p class="player-row__name">
            ${escapeHtml(player.name)}
            ${isWinner ? '<span class="badge">Winner</span>' : ""}
            ${isTiebreak && game.status !== "complete" ? '<span class="badge badge--orange">Tiebreak</span>' : ""}
            ${wentOutLastRound ? '<span class="badge badge--orange">Went out</span>' : ""}
          </p>
          <p class="player-row__sub">${escapeHtml(subline)}</p>
        </div>
        <div class="player-row__score">${player.total}</div>
      </div>`;
  }

  function renderRoundEntry(game) {
    const activeIds = game.tieBreakPlayerIds.length ? game.tieBreakPlayerIds : game.players.map((player) => player.id);
    const activePlayers = game.players.filter((player) => activeIds.includes(player.id));
    const isPhase = game.type === "phase10";

    return `
      <form id="round-form" class="panel round-card">
        <div class="round-card__head">
          <h2>Round ${game.rounds.length + 1}</h2>
          <span class="badge ${isPhase ? "" : "badge--muted"}">${isPhase ? "Phase check" : "Score entry"}</span>
        </div>
        <p class="round-card__hint">${
          isPhase
            ? "Enter points left in each hand, then mark everyone who completed their current phase."
            : game.tieBreakPlayerIds.length
              ? "Enter this tiebreak round for the remaining players. Negative scores are allowed."
              : "Enter each player’s score for the round. Use a minus sign for deductions."
        }</p>
        <div class="score-entry-list">
          ${activePlayers.map((player) => renderScoreEntry(game, player)).join("")}
        </div>
        <p id="round-error" class="form-error" role="alert"></p>
        <button class="button button--primary" type="submit">Save round & pass the deal →</button>
      </form>`;
  }

  function renderScoreEntry(game, player) {
    const isPhase = game.type === "phase10";
    return `
      <div class="score-entry ${isPhase ? "score-entry--phase" : "score-entry--rummy"}">
        <label for="score-${player.id}">
          <span class="score-entry__name">${escapeHtml(player.name)}</span>
          ${isPhase ? `<span class="score-entry__phase">Currently on Phase ${player.phase}</span>` : ""}
        </label>
        <input
          class="score-input"
          id="score-${player.id}"
          name="score-${player.id}"
          type="number"
          inputmode="numeric"
          step="1"
          ${isPhase ? 'min="0"' : ""}
          value="0"
          aria-label="${escapeHtml(player.name)} round score"
          required
        />
        ${
          isPhase
            ? `<label class="round-check phase-check">
                <input name="phased-${player.id}" type="checkbox" />
                <span>Yes, ${escapeHtml(player.name)} completed Phase ${player.phase}</span>
              </label>`
            : `<label class="round-check went-out-check">
                <input name="went-out-${player.id}" type="checkbox" />
                <span>${escapeHtml(player.name)} went out this round</span>
              </label>`
        }
      </div>`;
  }

  function getLastWentOut(game) {
    if (game.type !== "rummy" || !game.rounds.length) return null;
    const winningEntry = game.rounds.at(-1).entries.find((entry) => entry.wentOut);
    return winningEntry ? game.players.find((player) => player.id === winningEntry.playerId) || null : null;
  }

  function renderHistorySummary(game) {
    return `
      <section class="panel round-card">
        <div class="round-card__head">
          <h2>Final scorecard</h2>
          <span class="badge">Complete</span>
        </div>
        <p class="round-card__hint">${game.rounds.length} round${game.rounds.length === 1 ? "" : "s"} played. This game stays in Saved games.</p>
        <button class="button button--primary" type="button" data-action="rematch">Start rematch</button>
      </section>`;
  }

  function renderSavedGames() {
    const sorted = [...state.games].sort((a, b) => b.updatedAt - a.updatedAt);
    const inProgress = sorted.filter((game) => game.status !== "complete");
    const complete = sorted.filter((game) => game.status === "complete");
    const list = document.getElementById("saved-games-list");

    if (!sorted.length) {
      list.innerHTML = '<div class="saved-empty">No scorecards yet. Start a game to save it here.</div>';
      return;
    }

    list.innerHTML = [renderSavedSection("In progress", inProgress), renderSavedSection("Finished", complete)]
      .filter(Boolean)
      .join("");
  }

  function renderSavedSection(label, games) {
    if (!games.length) return "";
    return `
      <section class="saved-section">
        <h3>${label}</h3>
        ${games
          .map(
            (game) => `
              <div class="saved-game">
                <div>
                  <p class="saved-game__name">${escapeHtml(game.name)}</p>
                  <p class="saved-game__meta">${TYPES[game.type].label} · ${game.players.map((player) => escapeHtml(player.name)).join(", ")} · ${game.rounds.length} rounds</p>
                </div>
                <button class="button button--quiet button--small" type="button" data-resume-game="${game.id}">
                  ${game.status === "complete" ? "View" : "Resume"}
                </button>
              </div>`,
          )
          .join("")}
      </section>`;
  }

  function openNewGame(type, seedNames = []) {
    setupType = type;
    document.getElementById("new-game-title").textContent = `Start ${TYPES[type].label}`;
    document.getElementById("game-name").value = "";
    setupError.textContent = "";
    playerInputs.innerHTML = "";
    const names = seedNames.length ? seedNames : ["", ""];
    names.forEach((name) => addPlayerInput(name));
    refreshDealerOptions();
    newGameDialog.showModal();
    window.setTimeout(() => playerInputs.querySelector("input")?.focus(), 50);
  }

  function addPlayerInput(value = "") {
    if (playerInputs.children.length >= 6) return;
    const row = document.createElement("div");
    row.className = "player-input-row";
    row.innerHTML = `
      <span class="player-input-row__number">${playerInputs.children.length + 1}</span>
      <input type="text" maxlength="28" autocomplete="off" placeholder="Player name" value="${escapeHtml(value)}" required />
      <button class="remove-player" type="button" aria-label="Remove player">×</button>`;
    playerInputs.appendChild(row);
    renumberPlayerInputs();
    refreshDealerOptions();
  }

  function renumberPlayerInputs() {
    [...playerInputs.children].forEach((row, index) => {
      row.querySelector(".player-input-row__number").textContent = index + 1;
      row.querySelector(".remove-player").disabled = playerInputs.children.length <= 2;
    });
    document.getElementById("add-player").disabled = playerInputs.children.length >= 6;
  }

  function refreshDealerOptions() {
    const previous = Number(firstDealer.value) || 0;
    const values = [...playerInputs.querySelectorAll("input")].map((input, index) => input.value.trim() || `Player ${index + 1}`);
    firstDealer.innerHTML = values.map((value, index) => `<option value="${index}">${escapeHtml(value)}</option>`).join("");
    firstDealer.value = String(Math.min(previous, Math.max(values.length - 1, 0)));
  }

  function createGame(event) {
    event.preventDefault();
    const names = [...playerInputs.querySelectorAll("input")].map((input) => input.value.trim());
    const normalized = names.map(normalizeName);
    if (names.length < 2 || names.some((name) => !name)) {
      setupError.textContent = "Add names for at least two players.";
      return;
    }
    if (new Set(normalized).size !== normalized.length) {
      setupError.textContent = "Each player needs a different name.";
      return;
    }
    if (names.length > 6) {
      setupError.textContent = "A game can have up to six players.";
      return;
    }

    const players = names.map((name) => ({ id: uid(), name, total: 0, phase: 1, completed: false }));
    const dealerIndex = Number(firstDealer.value) || 0;
    const now = Date.now();
    const customName = document.getElementById("game-name").value.trim();
    const game = {
      id: uid(),
      type: setupType,
      name: customName || `${TYPES[setupType].label} · ${formatDate(now)}`,
      players,
      rounds: [],
      dealerId: players[dealerIndex].id,
      initialDealerId: players[dealerIndex].id,
      status: "active",
      winnerIds: [],
      tieBreakPlayerIds: [],
      tieBreakResolved: false,
      createdAt: now,
      updatedAt: now,
    };

    state.games.push(game);
    state.activeTab = setupType;
    state.activeGameIdByType[setupType] = game.id;
    saveState();
    newGameDialog.close();
    render();
    showToast("Game saved. You can return to it anytime.");
  }

  function activeScoringPlayers(game) {
    const ids = game.tieBreakPlayerIds.length ? game.tieBreakPlayerIds : game.players.map((player) => player.id);
    return game.players.filter((player) => ids.includes(player.id));
  }

  function addRound(event) {
    event.preventDefault();
    const game = getActiveGame();
    if (!game || game.status === "complete") return;
    const activePlayers = activeScoringPlayers(game);
    const error = document.getElementById("round-error");
    const entries = [];
    const wentOutIds =
      game.type === "rummy"
        ? activePlayers
            .filter((player) => document.querySelector(`[name="went-out-${player.id}"]`)?.checked)
            .map((player) => player.id)
        : [];

    if (game.type === "rummy" && wentOutIds.length !== 1) {
      error.textContent = "Choose exactly one player who went out this round.";
      return;
    }

    for (const player of activePlayers) {
      const scoreInput = document.getElementById(`score-${player.id}`);
      const rawScore = scoreInput?.value;
      const score = Number(rawScore);
      if (rawScore === "" || !Number.isInteger(score) || (game.type === "phase10" && score < 0)) {
        error.textContent = game.type === "phase10" ? "Enter a whole number of zero or more for every player." : "Enter a whole-number score for every player.";
        scoreInput?.focus();
        return;
      }
      entries.push({
        playerId: player.id,
        score,
        phased: game.type === "phase10" ? Boolean(document.querySelector(`[name="phased-${player.id}"]`)?.checked) : false,
        wentOut: game.type === "rummy" && wentOutIds.includes(player.id),
      });
    }

    saveRoundEntries(game, entries);
    saveState();
    render();
    showToast(game.status === "complete" ? "Final round saved." : "Round saved. The deal has moved.");
  }

  function saveRoundEntries(game, entries) {
    const before = snapshotGame(game);
    entries.forEach((entry) => {
      const player = game.players.find((candidate) => candidate.id === entry.playerId);
      player.total += entry.score;
      if (game.type === "phase10" && entry.phased) {
        if (player.phase === 10) player.completed = true;
        else player.phase += 1;
      }
    });

    const roundId = uid();
    game.rounds.push({
      id: roundId,
      number: game.rounds.length + 1,
      entries,
      dealerBeforeId: game.dealerId,
      timestamp: Date.now(),
      before,
    });

    if (game.type === "rummy") settleRummy(game, roundId);
    else settlePhase10(game);

    if (game.status !== "complete") {
      const nextDealerPool = game.tieBreakPlayerIds.length ? game.tieBreakPlayerIds : game.players.map((player) => player.id);
      game.dealerId = nextDealer(game, game.dealerId, nextDealerPool);
    }
    game.updatedAt = Date.now();
  }

  function snapshotGame(game) {
    return {
      players: game.players.map((player) => ({ ...player })),
      dealerId: game.dealerId,
      status: game.status,
      winnerIds: [...game.winnerIds],
      tieBreakPlayerIds: [...game.tieBreakPlayerIds],
      tieBreakResolved: game.tieBreakResolved,
    };
  }

  function settleRummy(game, roundId) {
    if (game.tieBreakPlayerIds.length) {
      const remaining = game.players.filter((player) => game.tieBreakPlayerIds.includes(player.id));
      const highScore = Math.max(...remaining.map((player) => player.total));
      const leaders = remaining.filter((player) => player.total === highScore);
      if (leaders.length === 1) finishGame(game, [leaders[0].id], roundId, true);
      else game.tieBreakPlayerIds = leaders.map((player) => player.id);
      return;
    }

    const reachedTarget = game.players.filter((player) => player.total >= 500);
    if (!reachedTarget.length) return;
    const highScore = Math.max(...reachedTarget.map((player) => player.total));
    const leaders = reachedTarget.filter((player) => player.total === highScore);
    if (leaders.length === 1) finishGame(game, [leaders[0].id], roundId, false);
    else game.tieBreakPlayerIds = leaders.map((player) => player.id);
  }

  function settlePhase10(game) {
    const finishers = game.players.filter((player) => player.completed);
    if (!finishers.length) return;
    const lowScore = Math.min(...finishers.map((player) => player.total));
    const winners = finishers.filter((player) => player.total === lowScore);
    finishGame(game, winners.map((player) => player.id), game.rounds.at(-1).id, false);
  }

  function finishGame(game, winnerIds, roundId, tieBreakResolved) {
    game.status = "complete";
    game.winnerIds = winnerIds;
    game.tieBreakPlayerIds = [];
    game.tieBreakResolved = tieBreakResolved;
    applyRummyRecord(game, roundId);
  }

  function applyRummyRecord(game, roundId) {
    if (game.type !== "rummy" || game.players.length !== 2 || game.winnerIds.length !== 1) return;
    const names = game.players.map((player) => normalizeName(player.name)).sort();
    if (names[0] !== "bo" || names[1] !== "daylene") return;
    const winner = game.players.find((player) => player.id === game.winnerIds[0]);
    const bo = game.players.find((player) => normalizeName(player.name) === "bo");
    const daylene = game.players.find((player) => normalizeName(player.name) === "daylene");
    const winnerName = normalizeName(winner.name);
    if (winnerName === "bo") state.record.boWins += 1;
    if (winnerName === "daylene") state.record.dayleneWins += 1;
    state.record.boPoints += bo.total;
    state.record.daylenePoints += daylene.total;
    state.record.results.push({
      gameId: game.id,
      roundId,
      winner: winnerName,
      boPoints: bo.total,
      daylenePoints: daylene.total,
      timestamp: Date.now(),
    });
  }

  function nextDealer(game, currentDealerId, eligibleIds) {
    const currentIndex = game.players.findIndex((player) => player.id === currentDealerId);
    for (let step = 1; step <= game.players.length; step += 1) {
      const candidate = game.players[(currentIndex + step) % game.players.length];
      if (eligibleIds.includes(candidate.id)) return candidate.id;
    }
    return currentDealerId;
  }

  function undoLastRound() {
    const game = getActiveGame();
    const lastRound = game?.rounds.at(-1);
    if (!game || !lastRound) return;
    const recordIndex = state.record.results.findIndex((result) => result.gameId === game.id && result.roundId === lastRound.id);
    if (recordIndex >= 0) {
      const result = state.record.results[recordIndex];
      if (result.winner === "bo") state.record.boWins = Math.max(0, state.record.boWins - 1);
      if (result.winner === "daylene") state.record.dayleneWins = Math.max(0, state.record.dayleneWins - 1);
      state.record.boPoints -= Number(result.boPoints) || 0;
      state.record.daylenePoints -= Number(result.daylenePoints) || 0;
      state.record.results.splice(recordIndex, 1);
    }
    game.players = lastRound.before.players.map((player) => ({ ...player }));
    game.dealerId = lastRound.before.dealerId;
    game.status = lastRound.before.status;
    game.winnerIds = [...lastRound.before.winnerIds];
    game.tieBreakPlayerIds = [...lastRound.before.tieBreakPlayerIds];
    game.tieBreakResolved = lastRound.before.tieBreakResolved;
    game.rounds.pop();
    game.updatedAt = Date.now();
    saveState();
    render();
    showToast("Last round removed.");
  }

  function restartGame() {
    const game = getActiveGame();
    if (!game || game.status === "complete") return;
    game.players = game.players.map((player) => ({ ...player, total: 0, phase: 1, completed: false }));
    game.rounds = [];
    game.dealerId = game.initialDealerId;
    game.winnerIds = [];
    game.tieBreakPlayerIds = [];
    game.tieBreakResolved = false;
    game.updatedAt = Date.now();
    saveState();
    confirmDialog.close();
    render();
    showToast("Game restarted with the same player order.");
  }

  function rematch() {
    const game = getActiveGame();
    if (!game) return;
    openNewGame(game.type, game.players.map((player) => player.name));
    document.getElementById("game-name").value = `${TYPES[game.type].label} rematch`;
  }

  function registerWebMcpTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    try {
      void Promise.resolve(
        context.registerTool({
          name: "read_scorecard",
          title: "Read scorecard",
          description: "Read the visible game type, active saved game, player totals, phases, dealer, and winner state.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            const game = getActiveGame();
            return game
              ? {
                  type: game.type,
                  name: game.name,
                  status: game.status,
                  round: game.rounds.length + (game.status === "complete" ? 0 : 1),
                  dealer: game.players.find((player) => player.id === game.dealerId)?.name,
                  players: game.players.map(({ name, total, phase, completed }) => ({ name, total, phase, completed })),
                  winners: game.winnerIds.map((id) => game.players.find((player) => player.id === id)?.name),
                }
              : { type: state.activeTab, status: "no_active_game" };
          },
        }),
      ).catch(() => {});
      void Promise.resolve(
        context.registerTool({
          name: "save_scorecard_round",
          title: "Save scorecard round",
          description:
            "Save one complete round for the visible game. Include every currently scoring player once; set phased for Phase 10 players who completed their phase.",
          inputSchema: {
            type: "object",
            properties: {
              scores: {
                type: "array",
                minItems: 1,
                maxItems: 6,
                items: {
                  type: "object",
                  properties: {
                    player: { type: "string" },
                    score: { type: "integer" },
                    phased: { type: "boolean" },
                    wentOut: { type: "boolean" },
                  },
                  required: ["player", "score"],
                  additionalProperties: false,
                },
              },
            },
            required: ["scores"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const game = getActiveGame();
            if (!game || game.status === "complete") throw new Error("There is no active game to score.");
            if (!input || !Array.isArray(input.scores)) throw new Error("Scores must be an array.");
            const activePlayers = activeScoringPlayers(game);
            if (input.scores.length !== activePlayers.length) {
              throw new Error(`Include exactly ${activePlayers.length} scoring players.`);
            }
            const seen = new Set();
            const entries = input.scores.map((item) => {
              const name = typeof item.player === "string" ? normalizeName(item.player) : "";
              const player = activePlayers.find((candidate) => normalizeName(candidate.name) === name);
              if (!player || seen.has(player.id)) throw new Error("Each active player must appear exactly once.");
              if (!Number.isInteger(item.score) || (game.type === "phase10" && item.score < 0)) {
                throw new Error("Every score must be a valid whole number for this game.");
              }
              seen.add(player.id);
              return {
                playerId: player.id,
                score: item.score,
                phased: game.type === "phase10" && item.phased === true,
                wentOut: game.type === "rummy" && item.wentOut === true,
              };
            });
            if (game.type === "rummy" && entries.filter((entry) => entry.wentOut).length !== 1) {
              throw new Error("Choose exactly one player who went out this round.");
            }
            saveRoundEntries(game, entries);
            saveState();
            render();
            return {
              status: game.status,
              roundSaved: game.rounds.length,
              dealer: game.players.find((player) => player.id === game.dealerId)?.name,
              winners: game.winnerIds.map((id) => game.players.find((player) => player.id === id)?.name),
            };
          },
        }),
      ).catch(() => {});
    } catch (error) {
      // WebMCP is optional and unsupported browsers simply use the visible interface.
    }
  }

  app.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      state.activeTab = tab.dataset.tab;
      saveState();
      render();
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "new-game") openNewGame(state.activeTab);
    if (action === "saved-games") {
      renderSavedGames();
      savedGamesDialog.showModal();
    }
    if (action === "undo-round") undoLastRound();
    if (action === "restart") confirmDialog.showModal();
    if (action === "rematch") rematch();
  });

  app.addEventListener("submit", (event) => {
    if (event.target.id === "round-form") addRound(event);
  });

  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) document.getElementById(closeButton.dataset.closeDialog)?.close();

    const resumeButton = event.target.closest("[data-resume-game]");
    if (resumeButton) {
      const game = state.games.find((candidate) => candidate.id === resumeButton.dataset.resumeGame);
      if (!game) return;
      state.activeTab = game.type;
      state.activeGameIdByType[game.type] = game.id;
      saveState();
      savedGamesDialog.close();
      render();
    }
  });

  document.getElementById("new-game-form").addEventListener("submit", createGame);
  document.getElementById("add-player").addEventListener("click", () => addPlayerInput());
  document.getElementById("confirm-restart").addEventListener("click", restartGame);
  playerInputs.addEventListener("input", refreshDealerOptions);
  playerInputs.addEventListener("click", (event) => {
    const remove = event.target.closest(".remove-player");
    if (!remove || playerInputs.children.length <= 2) return;
    remove.closest(".player-input-row").remove();
    renumberPlayerInputs();
    refreshDealerOptions();
  });

  render();
  registerWebMcpTools();
  if (recordWasCleared) showToast("Bo and Daylene’s record was cleared.");
})();

import { getStore } from "@netlify/blobs";

const STORE_NAME = "family-scorecard-records";
const MAX_RESULTS = 5000;

function emptyRecord() {
  return {
    boWins: 0,
    dayleneWins: 0,
    boPoints: 0,
    daylenePoints: 0,
    results: [],
    updatedAt: 0,
  };
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanInteger(value, fallback = 0) {
  return Number.isSafeInteger(value) ? value : fallback;
}

function normalizeRecord(input) {
  const rawResults = Array.isArray(input?.results) ? input.results.slice(-MAX_RESULTS) : [];
  const seen = new Set();
  const results = [];

  for (const item of rawResults) {
    const gameId = cleanText(item?.gameId, 100);
    const roundId = cleanText(item?.roundId, 100);
    const winner = item?.winner === "bo" || item?.winner === "daylene" ? item.winner : "";
    if (!gameId || !roundId || !winner) continue;
    const resultKey = `${gameId}:${roundId}`;
    if (seen.has(resultKey)) continue;
    seen.add(resultKey);
    results.push({
      gameId,
      roundId,
      winner,
      boPoints: cleanInteger(item.boPoints),
      daylenePoints: cleanInteger(item.daylenePoints),
      timestamp: Math.max(0, cleanInteger(item.timestamp)),
    });
  }

  return {
    boWins: results.filter((item) => item.winner === "bo").length,
    dayleneWins: results.filter((item) => item.winner === "daylene").length,
    boPoints: results.reduce((sum, item) => sum + item.boPoints, 0),
    daylenePoints: results.reduce((sum, item) => sum + item.daylenePoints, 0),
    results,
    updatedAt: Math.max(0, cleanInteger(input?.updatedAt, Date.now())),
  };
}

export default async (request) => {
  if (request.method !== "GET" && request.method !== "PUT") {
    return json({ error: "Method not allowed." }, 405);
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return json({ error: "Cross-site requests are not allowed." }, 403);
  }

  try {
    const store = getStore(STORE_NAME);
    const key = "bo-daylene-shared-record";

    if (request.method === "GET") {
      const stored = await store.get(key, { type: "json", consistency: "strong" });
      return json({ exists: stored !== null, record: stored ? normalizeRecord(stored) : emptyRecord() });
    }

    const body = await request.json();
    const record = normalizeRecord(body?.record);
    await store.setJSON(key, record);
    return json({ saved: true, record });
  } catch (error) {
    console.error("Family record storage failed", error);
    return json({ error: "The shared record is temporarily unavailable." }, 500);
  }
};

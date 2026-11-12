
import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import "./App.css";

const FAST_SPEED = 15;
const MEDIUM_SPEED = 60;
const SLOW_SPEED = 180;

const TOTAL_DURATION = 8000;
const MEDIUM_START = 6000;
const SLOW_START = 7000;

// Secure random integer
function secureRandomInt(n) {
  if (n <= 1) return 0;

  const range = 4294967296;
  const limit = Math.floor(range / n) * n;
  const buffer = new Uint32Array(1);
  let value;

  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);

  return value % n;
}

// Fisher-Yates Shuffle
function shuffleList(list) {
  const deck = list.slice();

  for (let i = deck.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// Create shuffled deck
function makeShuffledDeck(min, max) {
  const deck = [];

  for (let n = min; n <= max; n++) {
    deck.push(n);
  }

  return shuffleList(deck);
}

export default function App() {
  const [start, setStart] = useState("1");
  const [end, setEnd] = useState("10000");
  const [totalPrizes, setTotalPrizes] = useState("51");

  const [winners, setWinners] = useState([]);
  const [current, setCurrent] = useState(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("READY TO DRAW");

  const timerRef = useRef(null);
  const autoStopRef = useRef(null);
  const startTimeRef = useRef(null);

  const winnersRef = useRef([]);
  const deckRef = useRef([]);
  const deckPosRef = useRef(0);
  const runningRef = useRef(false);

  // Get next spinning number
  function nextSpinNumber(min, max) {
    if (deckPosRef.current >= deckRef.current.length) {
      deckRef.current = makeShuffledDeck(min, max);
      deckPosRef.current = 0;
    }

    return deckRef.current[deckPosRef.current++];
  }

  // Finish draw and select winner
  const finishDraw = useCallback(() => {
    if (!runningRef.current) return;

    runningRef.current = false;

    clearTimeout(timerRef.current);
    clearTimeout(autoStopRef.current);

    timerRef.current = null;
    autoStopRef.current = null;

    const min = Number(start);
    const max = Number(end);
    const limit = Number(totalPrizes);

    if (winnersRef.current.length >= limit) {
      setRunning(false);
      setStatus("ALL PRIZES COMPLETED!");
      return;
    }

    // Exclude previous winners
    const used = new Set(
      winnersRef.current.map((winner) => winner.number)
    );

    const available = [];

    for (let n = min; n <= max; n++) {
      if (!used.has(n)) {
        available.push(n);
      }
    }

    if (available.length === 0) {
      setRunning(false);
      setStatus("NO NUMBERS AVAILABLE");
      return;
    }

    // Equal probability for all remaining numbers
    const chosen = available[
      secureRandomInt(available.length)
    ];

    const prize = winnersRef.current.length + 1;

    const updated = [
      ...winnersRef.current,
      {
        prize,
        number: chosen,
      },
    ];

    winnersRef.current = updated;

    setWinners(updated);
    setCurrent(chosen);
    setRunning(false);

    setStatus(
      prize >= limit
        ? "ALL PRIZES COMPLETED!"
        : "PRIZE WINNER SELECTED!"
    );
  }, [start, end, totalPrizes]);

  // Start draw
  const startDraw = useCallback(() => {
    if (runningRef.current) return;

    const min = Number(start);
    const max = Number(end);
    const limit = Number(totalPrizes);

    // Validate settings
    if (
      start.trim() === "" ||
      end.trim() === "" ||
      totalPrizes.trim() === "" ||
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      !Number.isInteger(limit) ||
      min < 1 ||
      max > 10000 ||
      min > max ||
      limit < 1 ||
      limit > 51 ||
      limit > max - min + 1
    ) {
      setStatus("PLEASE ENTER VALID SETTINGS");
      return;
    }

    if (winnersRef.current.length >= limit) {
      setStatus("ALL PRIZES COMPLETED!");
      return;
    }

    // Prepare shuffled deck
    deckRef.current = makeShuffledDeck(min, max);
    deckPosRef.current = 0;

    runningRef.current = true;
    startTimeRef.current = Date.now();

    setRunning(true);
    setStatus("DRAW IN PROGRESS...");

    // Fast, medium and slow spinning
    function tick() {
      if (!runningRef.current) return;

      const elapsed = Date.now() - startTimeRef.current;

      let nextSpeed = FAST_SPEED;

      if (elapsed >= SLOW_START) {
        nextSpeed = SLOW_SPEED;
      } else if (elapsed >= MEDIUM_START) {
        nextSpeed = MEDIUM_SPEED;
      }

      setCurrent(nextSpinNumber(min, max));

      timerRef.current = setTimeout(tick, nextSpeed);
    }

    tick();

    // Automatically finish after 8 seconds
    autoStopRef.current = setTimeout(
      finishDraw,
      TOTAL_DURATION
    );

  }, [start, end, totalPrizes, finishDraw]);

  // Space key: START only
  useEffect(() => {
    function handleSpacebar(event) {
      const tag = event.target?.tagName;

      if (
        event.code !== "Space" ||
        event.repeat ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tag)
      ) {
        return;
      }

      event.preventDefault();

      if (!runningRef.current) {
        startDraw();
      }
    }

    window.addEventListener("keydown", handleSpacebar);

    return () => {
      window.removeEventListener("keydown", handleSpacebar);
    };
  }, [startDraw]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;

      clearTimeout(timerRef.current);
      clearTimeout(autoStopRef.current);
    };
  }, []);

  // Reset draw
  function resetDraw() {
    runningRef.current = false;

    clearTimeout(timerRef.current);
    clearTimeout(autoStopRef.current);

    timerRef.current = null;
    autoStopRef.current = null;
    startTimeRef.current = null;

    winnersRef.current = [];
    deckRef.current = [];
    deckPosRef.current = 0;

    setWinners([]);
    setCurrent(null);
    setRunning(false);

    setStart("1");
    setEnd("10000");
    setTotalPrizes("51");

    setStatus("READY TO DRAW");
  }

  // Save winners as Excel
  function saveExcel() {
    if (winners.length === 0) return;

    const rows = winners.map((winner) => ({
      "Prize No": winner.prize,
      "Winning Number": winner.number,
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);

    sheet["!cols"] = [
      { wch: 12 },
      { wch: 18 },
    ];

    const book = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      book,
      sheet,
      "Winners"
    );

    XLSX.writeFile(
      book,
      "LuckyDraw_Winners.xlsx"
    );
  }

  return (
    <div className="page">
      <section className="draw-card">

        <header className="header">
          <div className="brand">

            <img
              src="/logo.png"
              alt="Thanaloram Charitable Society logo"
              className="logo"
            />

            <div className="brand-text">

              <p className="eyebrow">
                Thanaloram Charitable Society
              </p>

              <h1>LUCKY DRAW 2026</h1>

              <p className="subtitle">
                One Number. One Winner. Amazing Prizes!
              </p>

            </div>
          </div>
        </header>

        {/* DRAW SETTINGS */}
        <div className="settings">

          <label>
            START NUMBER

            <input
              type="number"
              min="1"
              max="10000"
              value={start}
              disabled={running || winners.length > 0}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>

          <label>
            END NUMBER

            <input
              type="number"
              min="1"
              max="10000"
              value={end}
              disabled={running || winners.length > 0}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>

          <label>
            TOTAL PRIZES

            <input
              type="number"
              min="1"
              max="51"
              value={totalPrizes}
              disabled={running || winners.length > 0}
              onChange={(e) => setTotalPrizes(e.target.value)}
            />
          </label>

        </div>

        <div className="layout">

          {/* LEFT DRAW SECTION */}
          <div className="left">

            <div
              className={
                "number-display " +
                (running ? "spinning" : "")
              }
            >

              <p className="number-label">
                {running
                  ? "FINDING THE WINNER"
                  : "LUCKY WINNER"}
              </p>

              <div className="number">
                {current ?? "00000"}
              </div>

              <p className="status">
                {status}
              </p>

            </div>

            {/* SINGLE START BUTTON */}
            <div className="controls">

              <button
                className="start-btn"
                onClick={startDraw}
                disabled={
                  running ||
                  winners.length >= Number(totalPrizes)
                }
              >
                {running ? "DRAWING..." : "START DRAW"}
              </button>

            </div>

          </div>

          {/* WINNERS SECTION */}
          <aside className="right">

            <div className="winner-heading">

              <h2>🏆 WINNERS</h2>

              <span>
                {winners.length} / {totalPrizes}
              </span>

            </div>

            <div className="winner-list">

              {winners.length === 0 ? (
                <p className="empty">
                  Winners will appear here
                </p>
              ) : (
                winners.map((winner) => (
                  <div
                    className="winner"
                    key={winner.prize}
                  >

                    <span>
                      PRIZE {winner.prize}
                    </span>

                    <strong>
                      {winner.number}
                    </strong>

                  </div>
                ))
              )}

            </div>

            <button
              className="save-btn"
              onClick={saveExcel}
              disabled={winners.length === 0}
            >
              ⬇️ SAVE AS EXCEL
            </button>

            <button
              className="reset-btn"
              onClick={resetDraw}
            >
              ↻ RESET DRAW
            </button>

          </aside>

        </div>

      </section>
    </div>
  );
}

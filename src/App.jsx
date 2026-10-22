import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import "./App.css";

const SPIN_MIN_MS = 25;
const SPIN_MAX_MS = 80;
const SMALL_NUMBER_CHANCE = 0.25;
const SHUFFLE_PASSES = 3;

function secureRandomInt(n) {
  const limit = Math.floor(4294967296 / n) * n;
  const buffer = new Uint32Array(1);
  let value;

  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);

  return value % n;
}

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function shuffleList(list, passes) {
  const deck = list.slice();

  for (let pass = 0; pass < passes; pass++) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      const temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }
  }

  return deck;
}

function makeShuffledDeck(min, max) {
  const deck = [];
  for (let n = min; n <= max; n++) deck.push(n);
  return shuffleList(deck, 1);
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
  const winnersRef = useRef([]);
  const deckRef = useRef([]);
  const deckPosRef = useRef(0);

  const startDraw = useCallback(() => {
    if (running) return;

    const min = Number(start);
    const max = Number(end);
    const limit = Number(totalPrizes);

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

    setRunning(true);
    setStatus("DRAW IN PROGRESS...");

    deckRef.current = makeShuffledDeck(min, max);
    deckPosRef.current = 0;

    const range = max - min + 1;

    function nextSpinNumber() {
      if (Math.random() < SMALL_NUMBER_CHANCE) {
        const small = Math.floor(Math.exp(Math.random() * Math.log(range + 1)));
        return Math.max(min, Math.min(max, min + small - 1));
      }

      if (deckPosRef.current >= deckRef.current.length) {
        deckRef.current = makeShuffledDeck(min, max);
        deckPosRef.current = 0;
      }

      const value = deckRef.current[deckPosRef.current];
      deckPosRef.current += 1;
      return value;
    }

    function tick() {
      setCurrent(nextSpinNumber());
      timerRef.current = setTimeout(tick, randInt(SPIN_MIN_MS, SPIN_MAX_MS));
    }

    tick();
  }, [running, start, end, totalPrizes]);

  const stopDraw = useCallback(() => {
    if (!running) return;

    clearTimeout(timerRef.current);
    timerRef.current = null;

    const min = Number(start);
    const max = Number(end);
    const limit = Number(totalPrizes);

    if (winnersRef.current.length >= limit) {
      setRunning(false);
      setStatus("ALL PRIZES COMPLETED!");
      return;
    }

    const used = new Set(winnersRef.current.map((winner) => winner.number));

    const available = [];
    for (let n = min; n <= max; n++) {
      if (!used.has(n)) available.push(n);
    }

    if (available.length === 0) {
      setRunning(false);
      setStatus("NO NUMBERS AVAILABLE");
      return;
    }

    const shuffled = shuffleList(available, SHUFFLE_PASSES);
    const chosen = shuffled[secureRandomInt(shuffled.length)];
    const prize = winnersRef.current.length + 1;

    const updated = [...winnersRef.current, { prize, number: chosen }];

    winnersRef.current = updated;
    setWinners(updated);
    setCurrent(chosen);
    setRunning(false);

    setStatus(
      prize >= limit ? "ALL PRIZES COMPLETED!" : "PRIZE WINNER SELECTED!"
    );
  }, [running, start, end, totalPrizes]);

  useEffect(() => {
    function handleSpacebar(event) {
      const tag = event.target.tagName;

      if (
        event.code !== "Space" ||
        event.repeat ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tag)
      ) {
        return;
      }

      event.preventDefault();

      if (running) {
        stopDraw();
      } else {
        startDraw();
      }
    }

    window.addEventListener("keydown", handleSpacebar);

    return () => {
      window.removeEventListener("keydown", handleSpacebar);
    };
  }, [running, startDraw, stopDraw]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  function resetDraw() {
    clearTimeout(timerRef.current);
    timerRef.current = null;

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

  function saveExcel() {
    if (winners.length === 0) return;

    const rows = winners.map((winner) => ({
      "Prize No": winner.prize,
      "Winning Number": winner.number,
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 12 }, { wch: 18 }];

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Winners");
    XLSX.writeFile(book, "LuckyDraw_Winners.xlsx");
  }

  return (
    <main className="page">
      <section className="draw-card">
        <header className="header">
          <div className="brand">
            <img
              className="logo"
              src="/logo.png"
              alt="Thanaloram Charitable Society logo"
            />
            <div className="brand-text">
              <p className="eyebrow">Thanaloram Charitable Society</p>
              <h1>LUCKY DRAW 2026</h1>
            </div>
          </div>
          <p className="subtitle">One Number. One Winner. Amazing Prizes!</p>
        </header>

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
          <div className="left">
            <div className={"number-display " + (running ? "spinning" : "")}>
              <p className="number-label">
                {running ? "FINDING THE WINNER" : "LUCKY WINNER"}
              </p>

              <div className="number">{current ?? "00000"}</div>

              <p className="status">{status}</p>
            </div>

            <div className="controls">
              <button
                className="start-btn"
                onClick={startDraw}
                disabled={running || winners.length >= Number(totalPrizes)}
              >
                START
              </button>

              <button
                className="stop-btn"
                onClick={stopDraw}
                disabled={!running}
              >
                STOP
              </button>
            </div>

            <p className="keyboard-hint">
              KEYBOARD CONTROL: PRESS SPACE TO START / STOP
            </p>
          </div>

          <aside className="right">
            <div className="winner-heading">
              <h2>🏆 WINNERS</h2>
              <span>
                {winners.length} / {totalPrizes}
              </span>
            </div>

            <div className="winner-list">
              {winners.length === 0 ? (
                <p className="empty">Winners will appear here</p>
              ) : (
                winners.map((winner) => (
                  <div className="winner" key={winner.prize}>
                    <span>PRIZE {winner.prize}</span>
                    <strong>{winner.number}</strong>
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

            <button className="reset-btn" onClick={resetDraw}>
              ↻ RESET DRAW
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
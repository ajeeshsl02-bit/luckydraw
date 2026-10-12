import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import "./App.css";

const SPIN_SPEED_MS = 10;

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

    timerRef.current = setInterval(() => {
      const random = Math.floor(Math.random() * (max - min + 1)) + min;
      setCurrent(random);
    }, SPIN_SPEED_MS);
  }, [running, start, end, totalPrizes]);

  const stopDraw = useCallback(() => {
    if (!running) return;

    clearInterval(timerRef.current);
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

    const chosen = available[Math.floor(Math.random() * available.length)];
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
    return () => clearInterval(timerRef.current);
  }, []);

  function resetDraw() {
    clearInterval(timerRef.current);
    timerRef.current = null;

    winnersRef.current = [];
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
          <p className="eyebrow">Thanaloram Charitable Society</p>
          <h1>LUCKY DRAW 2026</h1>
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
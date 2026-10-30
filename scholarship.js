/**
 * Scholarship Eligibility Checker — single-file version
 * ------------------------------------------------------
 * Everything (database setup, API, and frontend) lives in this one file
 * so it's easy to drop into VS Code and run.
 *
 * Setup:
 *   npm init -y
 *   npm install express better-sqlite3
 *   node app.js
 *
 * Then open http://localhost:3000
 *
 * A file called scholarship.db will be created next to this file on first
 * run, with a `students` table seeded with sample data. Delete it any time
 * to reset.
 */

const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');



const db = new Database(path.join(__dirname, 'scholarship.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name           TEXT    NOT NULL,
    cgpa                   REAL    NOT NULL,
    scholarship_threshold  REAL    NOT NULL
  );
`);

const { count } = db.prepare('SELECT COUNT(*) AS count FROM students').get();

if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO students (student_name, cgpa, scholarship_threshold) VALUES (?, ?, ?)'
  );
  const seedData = [
    ['Ananya Roy', 8.7, 8.5],
    ['Rohan Sen', 7.2, 7.5],
    ['Priya Das', 9.1, 8.0],
    ['Arjun Mehta', 6.8, 7.0],
    ['Ishita Banerjee', 8.0, 8.0],
    ['Kabir Khan', 7.9, 8.2],
    ['Meera Iyer', 9.4, 9.0],
    ['Siddharth Rao', 6.5, 6.5],
  ];
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(...row);
  });
  insertMany(seedData);
}

const SELECT_ALL = 'SELECT id, student_name, cgpa, scholarship_threshold FROM students ORDER BY student_name';
const SELECT_ONE = 'SELECT id, student_name, cgpa, scholarship_threshold FROM students WHERE id = ?';



const app = express();
app.use(express.json());

// GET /api/students — fetch the student enrollment database and thresholds
app.get('/api/students', (req, res) => {
  try {
    res.json(db.prepare(SELECT_ALL).all());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load student records.' });
  }
});

// POST /api/cgpa-update — { id, cgpa } -> updates that student's cgpa
app.post('/api/cgpa-update', (req, res) => {
  const { id, cgpa } = req.body ?? {};

  if (id === undefined || id === null || cgpa === undefined || cgpa === null) {
    return res.status(400).json({ error: 'Both "id" and "cgpa" are required.' });
  }

  const parsedId = Number(id);
  const parsedCgpa = Number(cgpa);

  if (!Number.isInteger(parsedId)) {
    return res.status(400).json({ error: '"id" must be an integer.' });
  }
  if (Number.isNaN(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
    return res.status(400).json({ error: '"cgpa" must be a number between 0 and 10.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(parsedId);
    if (!existing) {
      return res.status(404).json({ error: `No student found with id ${parsedId}.` });
    }

    db.prepare('UPDATE students SET cgpa = ? WHERE id = ?').run(parsedCgpa, parsedId);
    res.json(db.prepare(SELECT_ONE).get(parsedId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update cgpa.' });
  }
});



const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Scholarship Eligibility Ledger</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --ink: #16233D; --ink-soft: #4C5A73; --paper: #F2F4F3; --surface: #FFFFFF;
    --hairline: #D8DCE1; --brass: #A8813C; --brass-soft: #F3E8D3;
    --eligible: #2F6E4F; --eligible-bg: #E4F1E9; --ineligible: #A8453B; --ineligible-bg: #FBEAE8;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font-family: 'IBM Plex Sans', -apple-system, sans-serif; font-feature-settings: 'tnum' 1; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .page { max-width: 880px; margin: 0 auto; padding: 48px 24px 72px; }
  .masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding-bottom: 28px; border-bottom: 2px solid var(--ink); margin-bottom: 32px; }
  .masthead__title { display: flex; align-items: flex-start; gap: 16px; }
  .masthead__mark { font-family: 'Source Serif 4', serif; font-size: 34px; color: var(--brass); line-height: 1; padding-top: 4px; }
  h1 { font-family: 'Source Serif 4', serif; font-weight: 600; font-size: 30px; margin: 0 0 6px; letter-spacing: -0.01em; }
  .masthead__subtitle { margin: 0; color: var(--ink-soft); font-size: 14.5px; max-width: 46ch; }
  .refresh-btn { flex-shrink: 0; background: var(--surface); border: 1px solid var(--hairline); color: var(--ink); padding: 9px 16px; border-radius: 6px; font-family: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; }
  .refresh-btn:hover { border-color: var(--brass); background: var(--brass-soft); }
  .refresh-btn:active { transform: translateY(1px); }
  .stats { display: flex; margin-bottom: 32px; }
  .stat { flex: 1; padding: 4px 24px; border-left: 1px solid var(--hairline); display: flex; flex-direction: column; gap: 4px; }
  .stat:first-child { padding-left: 0; border-left: none; }
  .stat__value { font-family: 'Source Serif 4', serif; font-size: 32px; font-weight: 600; line-height: 1; }
  .stat__value--eligible { color: var(--eligible); }
  .stat__label { font-size: 12.5px; color: var(--ink-soft); }
  .ledger { background: var(--surface); border: 1px solid var(--hairline); border-radius: 10px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); padding: 14px 20px; border-bottom: 1px solid var(--hairline); background: #FAFAF8; }
  thead th:nth-child(2), thead th:nth-child(3) { text-align: right; }
  tbody td { padding: 14px 20px; border-bottom: 1px solid var(--hairline); font-size: 14.5px; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  .row--eligible { background: var(--eligible-bg); }
  .cell--name { font-weight: 500; }
  .cell--numeric { text-align: right; }
  .cell--action { text-align: right; width: 1%; white-space: nowrap; }
  .cgpa-input { width: 76px; text-align: right; padding: 7px 9px; border: 1px solid var(--hairline); border-radius: 6px; font-family: inherit; font-size: 14.5px; font-feature-settings: 'tnum' 1; background: var(--surface); color: var(--ink); }
  .cgpa-input:focus { outline: none; border-color: var(--brass); box-shadow: 0 0 0 3px var(--brass-soft); }
  .badge { display: inline-block; padding: 4px 11px; border-radius: 100px; font-size: 12.5px; font-weight: 500; }
  .badge--eligible { background: var(--eligible); color: #fff; }
  .badge--ineligible { background: var(--ineligible-bg); color: var(--ineligible); }
  .save-btn { background: var(--ink); color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: opacity 0.15s ease; }
  .save-btn:disabled { background: var(--hairline); color: var(--ink-soft); cursor: not-allowed; }
  .save-btn:not(:disabled):hover { opacity: 0.85; }
  .loading-row, .error-row { text-align: center; padding: 32px 20px; color: var(--ink-soft); font-size: 14px; }
  .error-row { color: var(--ineligible); }
  .footnote { margin-top: 20px; font-size: 12.5px; color: var(--ink-soft); max-width: 62ch; }
  .toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(12px); background: var(--ink); color: #fff; padding: 11px 20px; border-radius: 8px; font-size: 13.5px; opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease; }
  .toast--visible { opacity: 1; transform: translateX(-50%) translateY(0); }
  .toast--error { background: var(--ineligible); }
  @media (max-width: 560px) {
    .masthead { flex-direction: column; }
    .stats { flex-direction: column; gap: 16px; }
    .stat { border-left: none; padding-left: 0; }
    thead th:nth-child(3) { display: none; }
    tbody td:nth-child(3) { display: none; }
  }
</style>
</head>
<body>

  <div class="page">
    <header class="masthead">
      <div class="masthead__title">
        <span class="masthead__mark">&#167;</span>
        <div>
          <h1>Scholarship Eligibility Ledger</h1>
          <p class="masthead__subtitle">Live CGPA standing against each student's scholarship threshold</p>
        </div>
      </div>
      <button id="refreshBtn" class="refresh-btn" title="Reload from the database">Refresh</button>
    </header>

    <section class="stats" aria-label="Summary statistics">
      <div class="stat">
        <span class="stat__value" id="totalCount">&mdash;</span>
        <span class="stat__label">Students on record</span>
      </div>
      <div class="stat">
        <span class="stat__value stat__value--eligible" id="eligibleCount">&mdash;</span>
        <span class="stat__label">Currently eligible</span>
      </div>
      <div class="stat">
        <span class="stat__value" id="avgThreshold">&mdash;</span>
        <span class="stat__label">Average threshold</span>
      </div>
    </section>

    <section class="ledger" aria-label="Student records">
      <table>
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Current CGPA</th>
            <th scope="col">Threshold</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody id="studentsBody">
          <tr><td colspan="5" class="loading-row">Loading student records&hellip;</td></tr>
        </tbody>
      </table>
    </section>

    <p class="footnote">Eligibility rule: a row is marked <strong>Eligible</strong> the moment current CGPA meets or exceeds that student's own scholarship threshold.</p>
  </div>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

  <script>
    var tableBody = document.getElementById('studentsBody');
    var totalCountEl = document.getElementById('totalCount');
    var eligibleCountEl = document.getElementById('eligibleCount');
    var avgThresholdEl = document.getElementById('avgThreshold');
    var toastEl = document.getElementById('toast');
    var refreshBtn = document.getElementById('refreshBtn');
    var students = [];

    function isEligible(student) {
      return student.cgpa >= student.scholarship_threshold;
    }

    function showToast(message, type) {
      toastEl.textContent = message;
      toastEl.className = 'toast toast--visible' + (type === 'error' ? ' toast--error' : '');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(function () { toastEl.className = 'toast'; }, 2800);
    }

    function renderStats() {
      var eligible = students.filter(isEligible).length;
      var avgThreshold = students.length
        ? (students.reduce(function (sum, s) { return sum + s.scholarship_threshold; }, 0) / students.length).toFixed(2)
        : '0.00';
      totalCountEl.textContent = students.length;
      eligibleCountEl.textContent = eligible;
      avgThresholdEl.textContent = avgThreshold;
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function renderTable() {
      if (!students.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="loading-row">No student records yet.</td></tr>';
        return;
      }

      tableBody.innerHTML = students.map(function (student) {
        var eligible = isEligible(student);
        return (
          '<tr class="row' + (eligible ? ' row--eligible' : '') + '" data-id="' + student.id + '">' +
            '<td class="cell cell--name">' + escapeHtml(student.student_name) + '</td>' +
            '<td class="cell cell--numeric">' +
              '<input type="number" class="cgpa-input" step="0.01" min="0" max="10" value="' + student.cgpa + '" data-original="' + student.cgpa + '" aria-label="CGPA for ' + escapeHtml(student.student_name) + '" />' +
            '</td>' +
            '<td class="cell cell--numeric">' + student.scholarship_threshold.toFixed(2) + '</td>' +
            '<td class="cell cell--status">' +
              '<span class="badge ' + (eligible ? 'badge--eligible' : 'badge--ineligible') + '">' + (eligible ? 'Eligible' : 'Not eligible') + '</span>' +
            '</td>' +
            '<td class="cell cell--action"><button class="save-btn" disabled>Save</button></td>' +
          '</tr>'
        );
      }).join('');

      attachRowListeners();
    }

    function attachRowListeners() {
      var rows = tableBody.querySelectorAll('.row');
      rows.forEach(function (row) {
        var input = row.querySelector('.cgpa-input');
        var saveBtn = row.querySelector('.save-btn');

        input.addEventListener('input', function () {
          var original = Number(input.dataset.original);
          var current = Number(input.value);
          saveBtn.disabled = input.value === '' || isNaN(current) || current === original;
        });

        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !saveBtn.disabled) updateCgpa(row, input, saveBtn);
        });

        saveBtn.addEventListener('click', function () { updateCgpa(row, input, saveBtn); });
      });
    }

    function updateCgpa(row, input, saveBtn) {
      var id = Number(row.dataset.id);
      var cgpa = Number(input.value);

      if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
        showToast('CGPA must be a number between 0 and 10.', 'error');
        return;
      }

      var originalLabel = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      fetch('/api/cgpa-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, cgpa: cgpa }),
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          if (!result.ok) throw new Error(result.data.error || 'Update failed.');
          var idx = students.findIndex(function (s) { return s.id === id; });
          students[idx] = result.data;
          renderStats();
          renderTable();
          showToast(result.data.student_name + "'s CGPA updated to " + result.data.cgpa.toFixed(2) + '.');
        })
        .catch(function (err) {
          showToast(err.message, 'error');
          saveBtn.textContent = originalLabel;
          saveBtn.disabled = false;
        });
    }

    function loadStudents() {
      fetch('/api/students')
        .then(function (res) {
          if (!res.ok) throw new Error('Could not load student records.');
          return res.json();
        })
        .then(function (data) {
          students = data;
          renderStats();
          renderTable();
        })
        .catch(function (err) {
          tableBody.innerHTML = '<tr><td colspan="5" class="error-row">' + escapeHtml(err.message) + '</td></tr>';
        });
    }

    refreshBtn.addEventListener('click', loadStudents);
    loadStudents();
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.type('html').send(HTML_PAGE);
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scholarship Eligibility Checker running at http://localhost:${PORT}`);
});
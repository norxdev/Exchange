const amountEl = document.getElementById("amount");
const fromEl = document.getElementById("fromCurrency");
const toEl = document.getElementById("toCurrency");
const resultEl = document.getElementById("resultValue");
const updatedEl = document.getElementById("lastUpdated");
const favoriteBtn = document.getElementById("favoriteBtn");
const favoritesList = document.getElementById("favoritesList");
const historyList = document.getElementById("historyList");
const explanationEl = document.getElementById("explanation");
const copyLinkBtn = document.getElementById("copyLink");
const hypoEl = document.getElementById("hypotheticalRate");
const applyScenarioBtn = document.getElementById("applyScenario");
const scenarioResultEl = document.getElementById("scenarioResult");

let chart;
let currentRange = 30;
let previousRate = null;

const API_BASE = "https://api.frankfurter.app";

// Mini explanations
const explanations = {
  up: [
    "Currency strengthened due to positive economic data.",
    "Higher interest rates boosted investor confidence.",
    "Strong trade balance lifted currency value."
  ],
  down: [
    "Currency weakened due to slower growth expectations.",
    "Political instability lowered market confidence.",
    "Inflation fears reduced currency demand."
  ],
  stable: [
    "Currency stayed stable, showing low market volatility.",
    "No major economic events affected this pair today.",
    "Markets saw balanced supply and demand."
  ]
};

// --- Load currencies ---
async function loadCurrencies() {
  const res = await fetch(`${API_BASE}/currencies`);
  const data = await res.json();

  for (const code in data) {
    fromEl.add(new Option(`${code} – ${data[code]}`, code));
    toEl.add(new Option(`${code} – ${data[code]}`, code));
  }

  // Check URL params for shareable link
  const params = new URLSearchParams(window.location.search);
  if (params.has("amount")) amountEl.value = params.get("amount");
  if (params.has("from")) fromEl.value = params.get("from");
  if (params.has("to")) toEl.value = params.get("to");
  if (params.has("range")) currentRange = Number(params.get("range"));
}

// --- Conversion ---
async function convert() {
  const amount = amountEl.value;
  const from = fromEl.value;
  const to = toEl.value;
  if (!amount || from === to) return;

  const res = await fetch(`${API_BASE}/latest?amount=${amount}&from=${from}&to=${to}`);
  const data = await res.json();
  const rate = data.rates[to];
  resultEl.textContent = `${rate.toFixed(4)} ${to}`;
  updatedEl.textContent = `Updated: ${data.date}`;

  renderMovementExplanation(rate);
  previousRate = rate;

  saveHistory(amount, from, to, rate);
  loadChart();
}

// --- Why did this move? ---
function renderMovementExplanation(current) {
  if (previousRate === null) {
    explanationEl.textContent = "Check back tomorrow to see rate changes!";
    return;
  }
  let type = "stable";
  if (current > previousRate) type = "up";
  else if (current < previousRate) type = "down";
  const msgs = explanations[type];
  explanationEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
}

// --- History & favorites ---
function saveHistory(amount, from, to, rate) {
  const history = JSON.parse(localStorage.getItem("history") || "[]");
  history.unshift(`${amount} ${from} → ${rate.toFixed(4)} ${to}`);
  localStorage.setItem("history", JSON.stringify(history.slice(0,10)));
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  const history = JSON.parse(localStorage.getItem("history") || "[]");
  history.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    historyList.appendChild(li);
  });
}

function toggleFavorite() {
  const pair = `${fromEl.value}/${toEl.value}`;
  let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
  if (favs.includes(pair)) favs = favs.filter(f => f !== pair);
  else favs.push(pair);
  localStorage.setItem("favorites", JSON.stringify(favs));
  renderFavorites();
}

function renderFavorites() {
  favoritesList.innerHTML = "";
  const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
  favs.forEach(pair => {
    const li = document.createElement("li");
    li.textContent = pair;
    li.onclick = () => {
      const [from, to] = pair.split("/");
      fromEl.value = from;
      toEl.value = to;
      convert();
    };
    favoritesList.appendChild(li);
  });
}

// --- Chart ---
async function loadChart() {
  const from = fromEl.value;
  const to = toEl.value;

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - currentRange);

  const res = await fetch(
    `${API_BASE}/${start.toISOString().slice(0,10)}..${end.toISOString().slice(0,10)}?from=${from}&to=${to}`
  );

  const data = await res.json();
  const labels = Object.keys(data.rates);
  const values = labels.map(d => data.rates[d][to]);

  const color = values[values.length-1] > values[0] ? "green" :
                values[values.length-1] < values[0] ? "red" : "gray";

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("rateChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `${from}/${to}`,
        data: values,
        borderColor: color,
        backgroundColor: "rgba(0,0,0,0)",
        tension: 0.3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const idx = context.dataIndex;
              return `Rate: ${context.dataset.data[idx].toFixed(4)} — ${labels[idx]}`;
            }
          }
        }
      }
    }
  });
}

// --- Shareable link ---
copyLinkBtn.addEventListener("click", () => {
  const url = `${window.location.origin}${window.location.pathname}?amount=${amountEl.value}&from=${fromEl.value}&to=${toEl.value}&range=${currentRange}`;
  navigator.clipboard.writeText(url);
  alert("Link copied!");
});

// --- Scenario simulator ---
applyScenarioBtn.addEventListener("click", () => {
  const hypo = Number(hypoEl.value);
  if (!hypo || !previousRate) return;
  const amount = Number(amountEl.value);
  const diff = hypo - previousRate;
  scenarioResultEl.textContent = `Converted amount would be ${(amount * hypo).toFixed(4)} ${toEl.value} (Δ ${diff.toFixed(4)})`;
});

// --- Range buttons ---
document.querySelectorAll(".range-buttons button").forEach(btn => {
  btn.addEventListener("click", () => {
    currentRange = Number(btn.dataset.range);
    loadChart();
  });
});

// --- Swap currencies ---
document.getElementById("swap").addEventListener("click", () => {
  const temp = fromEl.value;
  fromEl.value = toEl.value;
  toEl.value = temp;
  convert();
});

// --- Event listeners ---
amountEl.addEventListener("input", convert);
fromEl.addEventListener("change", convert);
toEl.addEventListener("change", convert);
favoriteBtn.addEventListener("click", toggleFavorite);

loadCurrencies().then(() => {
  convert();
  renderFavorites();
  renderHistory();
});

const amountEl = document.getElementById("amount");
const fromEl = document.getElementById("fromCurrency");
const toEl = document.getElementById("toCurrency");
const resultEl = document.getElementById("resultValue");
const updatedEl = document.getElementById("lastUpdated");
const favoriteBtn = document.getElementById("favoriteBtn");
const favoritesList = document.getElementById("favoritesList");
const historyList = document.getElementById("historyList");

let chart;
let currentRange = 30;

const API_BASE = "https://api.frankfurter.app";

async function loadCurrencies() {
  const res = await fetch(`${API_BASE}/currencies`);
  const data = await res.json();

  for (const code in data) {
    fromEl.add(new Option(`${code} – ${data[code]}`, code));
    toEl.add(new Option(`${code} – ${data[code]}`, code));
  }

  fromEl.value = "USD";
  toEl.value = "EUR";
}

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

  saveHistory(amount, from, to, rate);
  loadChart();
}

function saveHistory(amount, from, to, rate) {
  const history = JSON.parse(localStorage.getItem("history") || "[]");
  history.unshift(`${amount} ${from} → ${rate.toFixed(4)} ${to}`);
  localStorage.setItem("history", JSON.stringify(history.slice(0, 10)));
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

  if (favs.includes(pair)) {
    favs = favs.filter(f => f !== pair);
  } else {
    favs.push(pair);
  }

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

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("rateChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `${from}/${to}`,
        data: values,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { display: false }
      }
    }
  });
}

document.querySelectorAll(".range-buttons button").forEach(btn => {
  btn.addEventListener("click", () => {
    currentRange = Number(btn.dataset.range);
    loadChart();
  });
});

amountEl.addEventListener("input", convert);
fromEl.addEventListener("change", convert);
toEl.addEventListener("change", convert);
favoriteBtn.addEventListener("click", toggleFavorite);

loadCurrencies().then(() => {
  convert();
  renderFavorites();
  renderHistory();
});

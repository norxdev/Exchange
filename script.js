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

let chart;
let currentRange = 30;
let previousRate = null;
const API_BASE = "https://api.frankfurter.app";

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

// --- Load currencies + shareable links ---
async function loadCurrencies() {
  const res = await fetch(`${API_BASE}/currencies`);
  const data = await res.json();
  for (const code in data) {
    fromEl.add(new Option(`${code} – ${data[code]}`, code));
    toEl.add(new Option(`${code} – ${data[code]}`, code));
  }
  const params = new URLSearchParams(window.location.search);
  if (params.has("amount")) amountEl.value = params.get("amount");
  if (params.has("from")) fromEl.value = params.get("from");
  if (params.has("to")) toEl.value = params.get("to");
  if (params.has("range")) currentRange = Number(params.get("range"));
}

// --- Conversion ---
async function convert() {
  const amount = amountEl.value, from = fromEl.value, to = toEl.value;
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
  addPoints(5); // gamification: 5 XP per conversion
  checkBadges();
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
  explanationEl.textContent = explanations[type][Math.floor(Math.random()*explanations[type].length)];
}

// --- History & favorites ---
function saveHistory(amount, from, to, rate) {
  const history = JSON.parse(localStorage.getItem("history")||"[]");
  history.unshift(`${amount} ${from} → ${rate.toFixed(4)} ${to}`);
  localStorage.setItem("history", JSON.stringify(history.slice(0,10)));
  renderHistory();
}
function renderHistory() {
  historyList.innerHTML = "";
  const history = JSON.parse(localStorage.getItem("history")||"[]");
  history.forEach(item => { const li=document.createElement("li"); li.textContent=item; historyList.appendChild(li); });
}

function toggleFavorite() {
  const pair = `${fromEl.value}/${toEl.value}`;
  let favs = JSON.parse(localStorage.getItem("favorites")||"[]");
  if(favs.includes(pair)) favs=favs.filter(f=>f!==pair);
  else favs.push(pair);
  localStorage.setItem("favorites",JSON.stringify(favs));
  renderFavorites();
}
function renderFavorites() {
  favoritesList.innerHTML="";
  const favs=JSON.parse(localStorage.getItem("favorites")||"[]");
  favs.forEach(pair=>{
    const li=document.createElement("li");
    li.textContent=pair;
    li.onclick=()=>{ const [from,to]=pair.split("/"); fromEl.value=from; toEl.value=to; convert(); };
    favoritesList.appendChild(li);
  });
}

// --- Chart ---
async function loadChart() {
  const from=fromEl.value,to=toEl.value;
  const end=new Date(),start=new Date();
  start.setDate(end.getDate()-currentRange);
  const res = await fetch(`${API_BASE}/${start.toISOString().slice(0,10)}..${end.toISOString().slice(0,10)}?from=${from}&to=${to}`);
  const data=await res.json();
  const labels=Object.keys(data.rates);
  const values=labels.map(d=>data.rates[d][to]);
  const color=values[values.length-1]>values[0]?"green":values[values.length-1]<values[0]?"red":"gray";
  if(chart) chart.destroy();
  chart=new Chart(document.getElementById("rateChart"),{type:"line",data:{labels,datasets:[{label:`${from}/${to}`,data:values,borderColor:color,backgroundColor:"rgba(0,0,0,0)",tension:0.3,pointHoverRadius:6} ] },options:{responsive:true,plugins:{tooltip:{callbacks:{label:function(context){return`Rate: ${context.dataset.data[context.dataIndex].toFixed(4)} — ${labels[context.dataIndex]}`;}}}}}});
}

// --- Shareable link ---
copyLinkBtn.addEventListener("click",()=>{
  const url=`${window.location.origin}${window.location.pathname}?amount=${amountEl.value}&from=${fromEl.value}&to=${toEl.value}&range=${currentRange}`;
  navigator.clipboard.writeText(url); alert("Link copied!"); 
});

// --- Scenario simulator ---
applyScenarioBtn.addEventListener("click",()=>{
  const hypo=Number(hypoEl.value);
  if(!hypo||!previousRate) return;
  const amount=Number(amountEl.value);
  const diff=hypo-previousRate;
  document.getElementById("scenarioResult").textContent=`Converted amount would be ${(amount*hypo).toFixed(4)} ${toEl.value} (Δ ${diff.toFixed(4)})`;
  addPoints(2); checkBadges(); // gamification: 2 XP per scenario
});

// --- Range buttons ---
document.querySelectorAll(".range-buttons button").forEach(btn=>btn.addEventListener("click",()=>{
  currentRange=Number(btn.dataset.range); loadChart();
}));

// --- Swap ---
document.getElementById("swap").addEventListener("click",()=>{ const temp=fromEl.value; fromEl.value=toEl.value; toEl.value=temp; convert(); });

// --- Gamification ---
function updateStreak() {
  const today=new Date().toISOString().slice(0,10);
  const lastVisit=localStorage.getItem("lastVisit");
  let streak=Number(localStorage.getItem("streakCount")||"0");
  if(lastVisit===today) return;
  if(lastVisit===new Date(Date.now()-86400000).toISOString().slice(0,10)) streak++;
  else streak=1;
  localStorage.setItem("lastVisit",today);
  localStorage.setItem("streakCount",streak);
  displayStreak(streak); addPoints(1); checkBadges();
}
function displayStreak(streak){
  const el=document.getElementById("streakBadge"); el.textContent=`🔥 ${streak}-day streak! Keep learning!`;
}
function addPoints(points){
  let xp=Number(localStorage.getItem("xp")||"0"); xp+=points; localStorage.setItem("xp",xp); updateXPDisplay(xp);
}
function updateXPDisplay(xp){ document.getElementById("xpDisplay").textContent=`💎 XP: ${xp}`; }
function unlockBadge(name,emoji){
  let badges=JSON.parse(localStorage.getItem("badges")||"[]");
  if(!badges.includes(name)){ badges.push(name); localStorage.setItem("badges",JSON.stringify(badges)); alert(`${emoji} You unlocked the "${name}" badge!`); renderBadges(); }
}
function renderBadges(){
  const container=document.getElementById("badgeContainer");
  container.innerHTML="";
  const badges=JSON.parse(localStorage.getItem("badges")||"[]");
  badges.forEach(b=>{ const span=document.createElement("span"); span.textContent=`🏆 ${b}`; span.style.marginRight="0.5rem"; container.appendChild(span); });
}
function checkBadges(){
  // first conversion
  const history=JSON.parse(localStorage.getItem("history")||"[]");
  if(history.length===1) unlockBadge("First Exchange","🥇");
  // favorites >=3
  const favs=JSON.parse(localStorage.getItem("favorites")||"[]");
  if(favs.length>=3) unlockBadge("Collector","⭐");
  // streak >=5
  const streak=Number(localStorage.getItem("streakCount")||0);
  if(streak>=5) unlockBadge("Streak Master","🔥");
  // scenario simulator used 5+
  let scenarioUses=Number(localStorage.getItem("scenarioUses")||0);
  scenarioUses++; localStorage.setItem("scenarioUses",scenarioUses);
  if(scenarioUses>=5) unlockBadge("Experimenter","🧠");
}

// --- Events ---
amountEl.addEventListener("input",convert);
fromEl.addEventListener("change",convert);
toEl.addEventListener("change",convert);
favoriteBtn.addEventListener("click",toggleFavorite);

loadCurrencies().then(()=>{
  convert();
  renderFavorites();
  renderHistory();
  updateStreak();
  renderBadges();
});

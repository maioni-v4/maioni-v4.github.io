const STORAGE_KEY = "oshiMoneyManager:v1";
const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

const now = new Date();
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const defaultState = {
  months: {}
};

let state = loadState();

const elements = {
  tabs: document.querySelectorAll(".tab-button"),
  screens: document.querySelectorAll(".screen"),
  remainingAmount: document.querySelector("#remainingAmount"),
  motivationMessage: document.querySelector("#motivationMessage"),
  oshiTotal: document.querySelector("#oshiTotal"),
  monthlyBudget: document.querySelector("#monthlyBudget"),
  spentTotal: document.querySelector("#spentTotal"),
  expenseList: document.querySelector("#expenseList"),
  emptyState: document.querySelector("#emptyState"),
  clearMonthButton: document.querySelector("#clearMonthButton"),
  settingsForm: document.querySelector("#settingsForm"),
  incomeInput: document.querySelector("#incomeInput"),
  fixedCostInput: document.querySelector("#fixedCostInput"),
  calculatedBudget: document.querySelector("#calculatedBudget"),
  settingsFeedback: document.querySelector("#settingsFeedback"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseMemo: document.querySelector("#expenseMemo"),
  inputFeedback: document.querySelector("#inputFeedback")
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentMonth() {
  if (!state.months[monthKey]) {
    state.months[monthKey] = {
      income: 0,
      fixedCost: 0,
      budget: 0,
      expenses: []
    };
  }
  return state.months[monthKey];
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function formatYen(value) {
  return yenFormatter.format(value);
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getTotals() {
  const month = getCurrentMonth();
  const spent = month.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const oshi = month.expenses
    .filter((expense) => expense.category === "推し活・趣味")
    .reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = month.budget - spent;

  return { spent, oshi, remaining };
}

function render() {
  const month = getCurrentMonth();
  const totals = getTotals();

  elements.remainingAmount.textContent = formatYen(totals.remaining);
  elements.oshiTotal.textContent = formatYen(totals.oshi);
  elements.monthlyBudget.textContent = formatYen(month.budget);
  elements.spentTotal.textContent = formatYen(totals.spent);
  elements.incomeInput.value = month.income || "";
  elements.fixedCostInput.value = month.fixedCost || "";
  elements.calculatedBudget.textContent = formatYen(Math.max(0, month.income - month.fixedCost));

  renderMessage(month.budget, totals.remaining);
  renderExpenses(month.expenses);
}

function renderMessage(budget, remaining) {
  const message = elements.motivationMessage;
  message.classList.remove("danger");

  if (budget <= 0) {
    message.textContent = "まずは設定で予算を登録しましょう！";
    return;
  }

  if (remaining <= budget * 0.3) {
    message.textContent = "今月はピンチ！";
    message.classList.add("danger");
    return;
  }

  message.textContent = "今月はまだ余裕があります！グッズ購入のチャンス！";
}

function renderExpenses(expenses) {
  elements.expenseList.innerHTML = "";
  elements.emptyState.hidden = expenses.length > 0;

  const sortedExpenses = [...expenses].sort((a, b) => b.createdAt - a.createdAt);

  sortedExpenses.forEach((expense) => {
    const item = document.createElement("li");
    item.className = "expense-item";

    const detail = document.createElement("div");
    const title = document.createElement("p");
    const meta = document.createElement("p");
    const amount = document.createElement("span");
    const deleteButton = document.createElement("button");

    title.className = "expense-title";
    meta.className = "expense-meta";
    amount.className = "expense-amount";
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `${expense.memo || expense.category}を削除`);

    title.textContent = expense.memo || expense.category;
    meta.textContent = `${expense.date}・${expense.category}`;
    amount.textContent = formatYen(expense.amount);
    deleteButton.textContent = "×";

    deleteButton.addEventListener("click", () => {
      const month = getCurrentMonth();
      month.expenses = month.expenses.filter((item) => item.id !== expense.id);
      saveState();
      render();
    });

    detail.append(title, meta);
    item.append(detail, amount, deleteButton);
    elements.expenseList.appendChild(item);
  });
}

function switchScreen(screenId) {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.screen === screenId);
  });

  elements.screens.forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });
}

function updateCalculationPreview() {
  const income = toNumber(elements.incomeInput.value);
  const fixedCost = toNumber(elements.fixedCostInput.value);
  elements.calculatedBudget.textContent = formatYen(Math.max(0, income - fixedCost));
}

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchScreen(tab.dataset.screen));
});

elements.incomeInput.addEventListener("input", updateCalculationPreview);
elements.fixedCostInput.addEventListener("input", updateCalculationPreview);

elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const month = getCurrentMonth();
  month.income = toNumber(elements.incomeInput.value);
  month.fixedCost = toNumber(elements.fixedCostInput.value);
  month.budget = Math.max(0, month.income - month.fixedCost);

  saveState();
  render();

  elements.settingsFeedback.textContent = "設定を保存しました。今月の自由予算が更新されています。";
  elements.settingsFeedback.className = "feedback success";
  switchScreen("home");
});

elements.expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = toNumber(elements.expenseAmount.value);
  if (amount <= 0) return;

  const formData = new FormData(elements.expenseForm);
  const month = getCurrentMonth();

  month.expenses.push({
    id: makeId(),
    amount,
    category: formData.get("category"),
    memo: elements.expenseMemo.value.trim(),
    date: new Date().toLocaleDateString("ja-JP"),
    createdAt: Date.now()
  });

  saveState();
  render();

  elements.expenseForm.reset();
  elements.expenseForm.querySelector('input[value="推し活・趣味"]').checked = true;
  elements.inputFeedback.textContent = `${formatYen(amount)}を記録しました。えらい、未来の自分が助かります。`;
  elements.inputFeedback.className = "feedback success";
  switchScreen("home");
});

elements.clearMonthButton.addEventListener("click", () => {
  const confirmed = confirm("今月の設定と支出をすべてリセットしますか？");
  if (!confirmed) return;

  state.months[monthKey] = {
    income: 0,
    fixedCost: 0,
    budget: 0,
    expenses: []
  };
  saveState();
  render();
});

render();

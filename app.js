// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD2cI9JWiFxB_MEJ6MpfpM1RWLoCnh1iZU",
  authDomain: "finance-dhg.firebaseapp.com",
  projectId: "finance-dhg",
  storageBucket: "finance-dhg.firebasestorage.app",
  messagingSenderId: "947417737806",
  appId: "1:947417737806:web:a1b2a8a857f22abd74711f",
  measurementId: "G-6GQM903964"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let transactions = [];

// Categories Configuration
const categories = {
    income: [
        { id: 'vendas', name: 'Venda / Contrato', icon: 'fa-handshake' },
        { id: 'recebiveis', name: 'Recebimento de Cliente', icon: 'fa-money-bill-trend-up' },
        { id: 'outro_renda', name: 'Outras Entradas', icon: 'fa-plus' }
    ],
    expense: [
        { id: 'fornecedores', name: 'Pagamento de Fornecedor', icon: 'fa-boxes-packing' },
        { id: 'materiais', name: 'Compra de Materiais', icon: 'fa-hammer' },
        { id: 'combustivel', name: 'Combustível / Custo de Rota', icon: 'fa-gas-pump' },
        { id: 'folha', name: 'Folha de Pagamento', icon: 'fa-users' },
        { id: 'impostos', name: 'Impostos e Taxas', icon: 'fa-file-invoice-dollar' },
        { id: 'outros', name: 'Despesa Geral', icon: 'fa-receipt' }
    ]
};

const balanceEl = document.getElementById('totalBalance');
const transactionListEl = document.getElementById('transactionList');
const modalOverlay = document.getElementById('transactionModal');
const transactionForm = document.getElementById('transactionForm');
const advisorCard = document.getElementById('advisorCard');
const advisorMessage = document.getElementById('advisorMessage');

// Init
function init() {
    // Sincronizar em tempo real da nuvem
    database.ref('transactions').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            transactions = Object.values(data);
            transactions.sort((a,b) => new Date(a.date) - new Date(b.date));
        } else {
            transactions = [];
        }
        updateUI();
    });
}

function formatCurrency(amount) {
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getCategoryData(catId, type) {
    const list = categories[type];
    const cat = list.find(c => c.id === catId);
    return cat || { name: catId, icon: type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up' };
}

function updateUI() {
    renderTransactions();
    calculateAndAnalyze();
}

function renderTransactions() {
    transactionListEl.innerHTML = '';
    
    if (transactions.length === 0) {
        transactionListEl.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px 0;">Nenhuma movimentação no banco.</p>';
        return;
    }

    const reversed = [...transactions].reverse();

    reversed.forEach((t) => {
        const li = document.createElement('li');
        li.className = 'transaction-item';
        
        const isIncome = t.type === 'income';
        const sign = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const iconClass = isIncome ? 'income' : 'expense';
        const catData = getCategoryData(t.category, t.type);

        li.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-icon ${iconClass}">
                    <i class="fa-solid ${catData.icon}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${t.description}</h4>
                    <p>${catData.name}</p>
                </div>
            </div>
            <div style="display: flex; align-items: center;">
                <span class="transaction-amount ${amountClass}">${sign} ${formatCurrency(t.amount)}</span>
                <button class="delete-btn" onclick="deleteTransaction('${t.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        transactionListEl.appendChild(li);
    });
}

function calculateAndAnalyze() {
    let income = 0;
    let expense = 0;
    let categoryExpenses = {};

    transactions.forEach(t => {
        if (t.type === 'income') {
            income += t.amount;
        } else {
            expense += t.amount;
            categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.amount;
        }
    });

    const balance = income - expense;
    balanceEl.innerText = formatCurrency(balance);

    analyzeFinances(income, expense, balance, categoryExpenses);
}

function analyzeFinances(income, expense, balance, categoryExpenses) {
    advisorCard.className = 'advisor-card'; 

    if (transactions.length === 0) {
        advisorMessage.innerText = "Conectado. Adicione receitas e despesas para começarmos.";
        advisorCard.classList.add('status-warning');
        return;
    }

    if (income === 0 && expense > 0) {
        advisorMessage.innerText = "Atenção: Tivemos saídas mas nenhuma entrada. Cuidado com a liquidez!";
        advisorCard.classList.add('status-danger');
        return;
    }

    const expenseRatio = expense / income;
    const fuelExpense = categoryExpenses['combustivel'] || 0;
    const materialsExpense = categoryExpenses['materiais'] || 0;
    
    if (balance < 0) {
        advisorMessage.innerText = "Alerta Vermelho: Caixa negativo. Otimize despesas urgentemente.";
        advisorCard.classList.add('status-danger');
    } else if (expenseRatio >= 0.85) {
        advisorMessage.innerText = `Cuidado! Despesas representam ${Math.round(expenseRatio * 100)}% das receitas. Margem perigosa.`;
        advisorCard.classList.add('status-warning');
    } else if (fuelExpense > (income * 0.15)) {
        advisorMessage.innerText = "Consulta Tática: Gastos altos com combustível (>15%). Considere otimizar rotas.";
        advisorCard.classList.add('status-warning');
    } else if (materialsExpense > (income * 0.40)) {
        advisorMessage.innerText = "Dica: Custo alto de matérias-primas. Tente renegociar preços de volume.";
        advisorCard.classList.add('status-warning');
    } else if (expenseRatio <= 0.6) {
         advisorMessage.innerText = "Fantástico: Margem folgada (<60%). Caixa muito saudável!";
         advisorCard.classList.add('status-good');
    } else {
         advisorMessage.innerText = "Tudo em ordem. Dados sincronizados e caixa verde.";
         advisorCard.classList.add('status-good');
    }
}

// Form Handlers
function openModal(type) {
    document.getElementById('transactionType').value = type;
    const title = type === 'income' ? 'Nova Entrada' : 'Nova Saída';
    document.getElementById('modalTitle').innerText = title;
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = type === 'income' ? 'Registrar Receita' : 'Lançar Despesa';
    submitBtn.style.backgroundColor = type === 'income' ? 'var(--income-color)' : 'var(--expense-color)';

    const select = document.getElementById('category');
    select.innerHTML = '';
    categories[type].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.innerText = cat.name;
        select.appendChild(opt);
    });

    modalOverlay.classList.add('active');
    setTimeout(() => document.getElementById('amount').focus(), 100);
}

function closeModal() {
    modalOverlay.classList.remove('active');
    transactionForm.reset();
}

modalOverlay.addEventListener('click', (e) => {
    if(e.target === modalOverlay) closeModal();
});

transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const type = document.getElementById('transactionType').value;
    const amountVal = document.getElementById('amount').value.replace(',', '.');
    const amount = parseFloat(amountVal);
    const description = document.getElementById('description').value;
    const category = document.getElementById('category').value;

    if (!amount || isNaN(amount) || !description) return;

    const transaction = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
        type,
        amount,
        description,
        category,
        date: new Date().toISOString()
    };

    database.ref('transactions/' + transaction.id).set(transaction).then(() => {
        closeModal();
    }).catch(err => {
        alert("Erro ao salvar: " + err.message);
    });
});

function deleteTransaction(id) {
    if(confirm('Apagar este lançamento definitivamente da nuvem?')) {
        database.ref('transactions/' + id).remove();
    }
}

// === REPORT LOGIC === //
const reportModal = document.getElementById('reportModal');
const reportContent = document.getElementById('reportContent');

function openReportModal() {
    generateMonthlyReport();
    reportModal.classList.add('active');
}

function closeReportModal() {
    reportModal.classList.remove('active');
}

reportModal.addEventListener('click', (e) => {
    if(e.target === reportModal) closeReportModal();
});

function generateMonthlyReport() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    document.getElementById('reportMonthName').innerText = monthNames[currentMonth] + " de " + currentYear;

    const monthlyTrans = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let catExpenses = {};

    monthlyTrans.forEach(t => {
        if(t.type === 'income') {
            totalIncome += t.amount;
        } else {
            totalExpense += t.amount;
            catExpenses[t.category] = (catExpenses[t.category] || 0) + t.amount;
        }
    });

    const balance = totalIncome - totalExpense;
    let html = `
        <div class="summary-box">
            <p>Saldo Geral deste Mês</p>
            <h2 style="color: ${balance >= 0 ? 'var(--income-color)' : 'var(--expense-color)'}">${formatCurrency(balance)}</h2>
            <div style="display:flex; justify-content: space-between; margin-top: 14px; font-size: 0.95rem; color: var(--text-muted); font-weight: 500;">
                <span style="color: var(--income-color)"><i class="fa-solid fa-arrow-down"></i> ${formatCurrency(totalIncome)}</span>
                <span style="color: var(--expense-color)"><i class="fa-solid fa-arrow-up"></i> ${formatCurrency(totalExpense)}</span>
            </div>
        </div>
    `;

    if(totalExpense > 0) {
        html += `<div class="report-section"><h4>Análise de Despesas</h4>`;
        
        const sortedCats = Object.entries(catExpenses).sort((a,b) => b[1] - a[1]);

        sortedCats.forEach(entry => {
            const catId = entry[0];
            const amount = entry[1];
            const percent = ((amount / totalExpense) * 100).toFixed(1);
            const catName = getCategoryData(catId, 'expense').name;

            html += `
                <div style="margin-bottom: 18px;">
                    <div class="report-row">
                        <strong>${catName}</strong>
                        <span>${formatCurrency(amount)} (${percent}%)</span>
                    </div>
                    <div class="report-bar-bg">
                        <div class="report-bar-fill" style="width: ${percent}%; background-color: var(--expense-color);"></div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    } else {
        html += `<p style="text-align:center; color: var(--text-muted); padding: 20px 0;">Nenhuma despesa para análise neste mês.</p>`;
    }

    reportContent.innerHTML = html;
}

init();

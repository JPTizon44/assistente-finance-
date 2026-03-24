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

// Initialize
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// State Variables
let allTransactions = [];
let allObras = [];
let currentObraId = null;

// Categories
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

// Views
const obrasView = document.getElementById('obrasView');
const dashboardView = document.getElementById('dashboardView');
const obrasGrid = document.getElementById('obrasGrid');

// Dashboard Elements
const balanceEl = document.getElementById('totalBalance');
const transactionListEl = document.getElementById('transactionList');
const advisorCard = document.getElementById('advisorCard');
const advisorMessage = document.getElementById('advisorMessage');
const subtitleEl = document.getElementById('currentObraSubtitle');

// Init logic (Fetch and Auto-Migrate Legacy Data)
function init() {
    // 1. Listen for Obras
    database.ref('obras').on('value', (snapshot) => {
        const data = snapshot.val();
        allObras = data ? Object.values(data) : [];
        renderObrasList();
    });

    // 2. Listen for Transactions and migrate legacy if needed
    database.ref('transactions').on('value', (snapshot) => {
        const data = snapshot.val();
        allTransactions = data ? Object.values(data) : [];
        allTransactions.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        // Migration Check
        const needsMigration = allTransactions.some(t => !t.obraId);
        if (needsMigration) {
            migrateData();
        } else {
            // Update current view if inside dashboard
            if(currentObraId) {
                updateDashboardUI();
            }
        }
    });
}

function migrateData() {
    // Check if Geral exists
    const geralId = 'caixa-geral-id';
    
    // Create Caixa Geral Obra if missing
    database.ref('obras/' + geralId).once('value', sn => {
        if(!sn.exists()) {
            database.ref('obras/' + geralId).set({
                id: geralId,
                name: 'Caixa Inicial Sede',
                createdAt: new Date().toISOString()
            });
        }
    });

    // Retrofit all old transactions
    const updates = {};
    allTransactions.forEach(t => {
        if (!t.obraId) {
            t.obraId = geralId;
            updates[t.id] = t;
        }
    });
    if(Object.keys(updates).length > 0) {
        database.ref('transactions').update(updates);
    }
}

// === OBRAS LIST VIEW LOGIC === //
function renderObrasList() {
    obrasGrid.innerHTML = '';
    
    if (allObras.length === 0) {
        obrasGrid.innerHTML = '<p style="text-align:center; color: var(--text-muted); grid-column: span 2;">Você não possui pastas. Clique em Criar Nova Obra para começar.</p>';
        return;
    }

    // Sort by newest
    allObras.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    allObras.forEach(obra => {
        const card = document.createElement('div');
        card.className = 'obra-card';
        card.onclick = () => openObra(obra);
        
        let transCount = allTransactions.filter(t => t.obraId === obra.id).length;
        
        card.innerHTML = `
            <i class="fa-solid fa-folder-open obra-icon"></i>
            <h3 class="obra-name">${obra.name}</h3>
            <p class="obra-stats">${transCount} lançamentos</p>
        `;
        obrasGrid.appendChild(card);
    });
}

const newObraModal = document.getElementById('newObraModal');
function openNewObraModal() { newObraModal.classList.add('active'); setTimeout(() => document.getElementById('obraName').focus(), 100); }
function closeNewObraModal() { newObraModal.classList.remove('active'); document.getElementById('newObraForm').reset(); }
newObraModal.addEventListener('click', (e) => { if (e.target === newObraModal) closeNewObraModal(); });

document.getElementById('newObraForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('obraName').value;
    if(!name.trim()) return;

    const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
    const novaObra = {
        id: newId,
        name: name,
        createdAt: new Date().toISOString()
    };

    database.ref('obras/' + novaObra.id).set(novaObra).then(() => {
        closeNewObraModal();
        openObra(novaObra); // Auto enter the newly created folder
    });
});

// View Routing
function openObra(obra) {
    currentObraId = obra.id;
    subtitleEl.innerText = obra.name;
    obrasView.style.display = 'none';
    dashboardView.style.display = 'flex';
    updateDashboardUI();
}

function goBackToObras() {
    currentObraId = null;
    dashboardView.style.display = 'none';
    obrasView.style.display = 'flex';
}

// === DASHBOARD LOGIC (Filtered by currentObraId) === //
function formatCurrency(amount) {
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function getCategoryData(catId, type) {
    const cat = categories[type].find(c => c.id === catId);
    return cat || { name: catId, icon: type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up' };
}

function updateDashboardUI() {
    if(!currentObraId) return;
    const currentTrans = allTransactions.filter(t => t.obraId === currentObraId);
    
    // Render list
    transactionListEl.innerHTML = '';
    if (currentTrans.length === 0) {
        transactionListEl.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px 0;">Sua pasta está vazia. Cadastre as movimentações estruturais aqui.</p>';
    } else {
        const reversed = [...currentTrans].reverse();
        reversed.forEach((t) => {
            const li = document.createElement('li');
            li.className = 'transaction-item';
            const isInc = t.type === 'income';
            const sign = isInc ? '+' : '-';
            const catData = getCategoryData(t.category, t.type);

            li.innerHTML = `
                <div class="transaction-info">
                    <div class="transaction-icon ${isInc ? 'income' : 'expense'}">
                        <i class="fa-solid ${catData.icon}"></i>
                    </div>
                    <div class="transaction-details">
                        <h4>${t.description}</h4>
                        <p>${catData.name}</p>
                    </div>
                </div>
                <div style="display: flex; align-items: center;">
                    <span class="transaction-amount ${isInc ? 'amount-income' : 'amount-expense'}">${sign} ${formatCurrency(t.amount)}</span>
                    <button class="delete-btn" onclick="deleteTransaction('${t.id}')"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            transactionListEl.appendChild(li);
        });
    }

    // Engine Calculus
    let income = 0; let expense = 0; let catExpenses = {};
    currentTrans.forEach(t => {
        if(t.type === 'income') income += t.amount;
        else {
            expense += t.amount;
            catExpenses[t.category] = (catExpenses[t.category] || 0) + t.amount;
        }
    });

    const balance = income - expense;
    balanceEl.innerText = formatCurrency(balance);
    analyzeFinances(currentTrans.length, income, expense, balance, catExpenses);
}

function analyzeFinances(qtyItems, income, expense, balance, catExpenses) {
    advisorCard.className = 'advisor-card'; 

    if (qtyItems === 0) {
        advisorMessage.innerText = "Pasta criada! Use os botões abaixo para iniciar os lançamentos desta Obra em específico.";
        advisorCard.classList.add('status-warning');
        return;
    }

    if (income === 0 && expense > 0) {
        advisorMessage.innerText = "Atenção: A obra iniciou sem capital de entrada inserido, registrando prejuízo imediato. Cuidado.";
        advisorCard.classList.add('status-danger');
        return;
    }

    const expenseRatio = expense / income;
    const fuelExpense = catExpenses['combustivel'] || 0;
    const materialsExpense = catExpenses['materiais'] || 0;
    
    if (balance < 0) {
        advisorMessage.innerText = "Alerta: O projeto estourou o caixa injetado. Operando no prejuízo no momento.";
        advisorCard.classList.add('status-danger');
    } else if (expenseRatio >= 0.85) {
        advisorMessage.innerText = `Cuidado: Custo do projeto está encostando em ${Math.round(expenseRatio * 100)}% da receita isolada dele.`;
        advisorCard.classList.add('status-warning');
    } else if (fuelExpense > (income * 0.15)) {
        advisorMessage.innerText = "Tática: Gastos com logística e combustível pesados (>15%). Verifique desperdício do projeto.";
        advisorCard.classList.add('status-warning');
    } else if (materialsExpense > (income * 0.40)) {
        advisorMessage.innerText = "Dica: Controle as perdas de materiais de construção/insumos. Custos com fornecedores parecem elevados.";
        advisorCard.classList.add('status-warning');
    } else if (expenseRatio <= 0.6) {
         advisorMessage.innerText = "Obra lucrativa: Margem e custos saudáveis e extremamente controlados.";
         advisorCard.classList.add('status-good');
    } else {
         advisorMessage.innerText = "Gestão controlada dessa obra. Tudo em dia.";
         advisorCard.classList.add('status-good');
    }
}

// Transaction Modals (Binded to `currentObraId`)
const transactionModal = document.getElementById('transactionModal');
const transactionForm = document.getElementById('transactionForm');

function openModal(type) {
    document.getElementById('transactionType').value = type;
    document.getElementById('modalTitle').innerText = type === 'income' ? 'Nova Entrada da Obra' : 'Nova Saída da Obra';
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = type === 'income' ? 'Registrar Receita' : 'Lançar Despesa';
    submitBtn.style.backgroundColor = type === 'income' ? 'var(--income-color)' : 'var(--expense-color)';

    const select = document.getElementById('category');
    select.innerHTML = '';
    categories[type].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id; opt.innerText = cat.name;
        select.appendChild(opt);
    });

    transactionModal.classList.add('active');
    setTimeout(() => document.getElementById('amount').focus(), 100);
}

function closeModal() { transactionModal.classList.remove('active'); transactionForm.reset(); }
transactionModal.addEventListener('click', (e) => { if(e.target === transactionModal) closeModal(); });

transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if(!currentObraId) return;

    const amount = parseFloat(document.getElementById('amount').value.replace(',', '.'));
    const description = document.getElementById('description').value;

    if (!amount || isNaN(amount) || !description) return;

    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
    const transaction = {
        id,
        obraId: currentObraId,
        type: document.getElementById('transactionType').value,
        amount,
        description,
        category: document.getElementById('category').value,
        date: new Date().toISOString()
    };

    database.ref('transactions/' + id).set(transaction).then(() => closeModal());
});

function deleteTransaction(id) {
    if(confirm('Apagar lançamento da base dessa Obra?')) database.ref('transactions/' + id).remove();
}

// REPORT MODAL (Filtered by Obra + Month)
const reportModal = document.getElementById('reportModal');
const reportContent = document.getElementById('reportContent');

function openReportModal() { generateMonthlyReport(); reportModal.classList.add('active'); }
function closeReportModal() { reportModal.classList.remove('active'); }
reportModal.addEventListener('click', (e) => { if(e.target === reportModal) closeReportModal(); });

function generateMonthlyReport() {
    if(!currentObraId) return;

    const now = new Date(); const currentM = now.getMonth(); const currentY = now.getFullYear();
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('reportMonthName').innerText = months[currentM] + " de " + currentY;

    // Filter by Obra ID AND Current Month
    const monthlyTrans = allTransactions.filter(t => {
        const d = new Date(t.date);
        return t.obraId === currentObraId && d.getMonth() === currentM && d.getFullYear() === currentY;
    });

    let inc = 0; let exp = 0; let catExp = {};
    monthlyTrans.forEach(t => {
        if(t.type === 'income') inc += t.amount;
        else { exp += t.amount; catExp[t.category] = (catExp[t.category] || 0) + t.amount; }
    });

    const bal = inc - exp;
    let html = `
        <div class="summary-box">
            <p>Saldo do Projeto no Mês</p>
            <h2 style="color: ${bal >= 0 ? 'var(--income-color)' : 'var(--expense-color)'}">${formatCurrency(bal)}</h2>
            <div style="display:flex; justify-content: space-between; margin-top: 14px; font-size: 0.95rem; color: var(--text-muted); font-weight: 500;">
                <span style="color: var(--income-color)"><i class="fa-solid fa-arrow-down"></i> ${formatCurrency(inc)}</span>
                <span style="color: var(--expense-color)"><i class="fa-solid fa-arrow-up"></i> ${formatCurrency(exp)}</span>
            </div>
        </div>
    `;

    if(exp > 0) {
        html += `<div class="report-section"><h4>Análise de Despesas do Projeto</h4>`;
        const sortedCats = Object.entries(catExp).sort((a,b) => b[1] - a[1]);
        sortedCats.forEach(entry => {
            const p = ((entry[1] / exp) * 100).toFixed(1);
            html += `
                <div style="margin-bottom: 18px;">
                    <div class="report-row">
                        <strong>${getCategoryData(entry[0], 'expense').name}</strong>
                        <span>${formatCurrency(entry[1])} (${p}%)</span>
                    </div>
                    <div class="report-bar-bg"><div class="report-bar-fill" style="width: ${p}%; background-color: var(--expense-color);"></div></div>
                </div>
            `;
        });
        html += `</div>`;
    } else {
        html += `<p style="text-align:center; color: var(--text-muted);">A obra não reportou saídas neste mês.</p>`;
    }
    reportContent.innerHTML = html;
}

// Start
init();

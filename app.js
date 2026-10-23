// ==========================================
// DHG TIZON - GUARDIÃO FINANCEIRO DAS OBRAS
// ==========================================

// Firebase Configuration (Realtime Cloud Sync)
const firebaseConfig = {
    apiKey: "AIzaSyAYYZF7RDi1qcH9y4i47bsNVCpjvPgXlsE",
    authDomain: "sentinel-22ad5.firebaseapp.com",
    databaseURL: "https://sentinel-22ad5-default-rtdb.firebaseio.com",
    projectId: "sentinel-22ad5",
    storageBucket: "sentinel-22ad5.firebasestorage.app",
    messagingSenderId: "910901030196",
    appId: "1:910901030196:web:67b3ec4470ac0302fc8961",
    measurementId: "G-BZ8YMDVPJP"
};

const DB_ROOT = 'dhg_tizon';
const CLOUD_CREDENTIALS = {
    email: "dhgtizon@consultoria.com",
    password: "dhgtizonpassword123"
};

let database = null;
let auth = null;
let isCloudReady = false;

// Storage Keys & Helpers (Offline-First Architecture)
const STORAGE_OBRAS_KEY = 'dhg_tizon_obras';
const STORAGE_TRANS_KEY = 'dhg_tizon_transactions';

function loadLocalData() {
    try {
        const rawObras = localStorage.getItem(STORAGE_OBRAS_KEY);
        if (rawObras) {
            allObras = JSON.parse(rawObras);
        } else {
            allObras = [];
        }
        const rawTrans = localStorage.getItem(STORAGE_TRANS_KEY);
        if (rawTrans) {
            allTransactions = JSON.parse(rawTrans);
        } else {
            allTransactions = [];
        }
    } catch (e) {
        console.warn('Erro ao carregar do localStorage:', e);
    }
}

function saveLocalObras() {
    try {
        localStorage.setItem(STORAGE_OBRAS_KEY, JSON.stringify(allObras));
    } catch (e) {
        console.warn('Erro ao salvar obras no localStorage:', e);
    }
}

function saveLocalTransactions() {
    try {
        localStorage.setItem(STORAGE_TRANS_KEY, JSON.stringify(allTransactions));
    } catch (e) {
        console.warn('Erro ao salvar transações no localStorage:', e);
    }
}

function generateSafeId(prefix = 'id') {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
            return crypto.randomUUID();
        } catch (e) {}
    }
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

// State Variables
let allTransactions = [];
let allObras = [];
let currentObraId = null;
let currentFilter = 'all'; // 'all' | 'income' | 'expense'
let currentChartMode = 'expense'; // 'expense' | 'ratio'
let dashboardChartInstance = null;
let reportChartInstance = null;
let isInitialized = false;

// Categories Definition
const categories = {
    income: [
        { id: 'vendas', name: 'Venda / Contrato', icon: 'fa-handshake', color: '#10b981' },
        { id: 'recebiveis', name: 'Recebimento de Cliente', icon: 'fa-money-bill-trend-up', color: '#06b6d4' },
        { id: 'outro_renda', name: 'Outras Entradas', icon: 'fa-plus', color: '#8b5cf6' }
    ],
    expense: [
        { id: 'fornecedores', name: 'Fornecedores', icon: 'fa-boxes-packing', color: '#f59e0b' },
        { id: 'materiais', name: 'Materiais de Construção', icon: 'fa-hammer', color: '#ef4444' },
        { id: 'combustivel', name: 'Combustível / Logística', icon: 'fa-gas-pump', color: '#ec4899' },
        { id: 'folha', name: 'Mão de Obra / Folha', icon: 'fa-users', color: '#3b82f6' },
        { id: 'impostos', name: 'Impostos e Taxas', icon: 'fa-file-invoice-dollar', color: '#6366f1' },
        { id: 'outros', name: 'Despesas Gerais', icon: 'fa-receipt', color: '#94a3b8' }
    ]
};

// UI Elements
const obrasView = document.getElementById('obrasView');
const dashboardView = document.getElementById('dashboardView');
const obrasGrid = document.getElementById('obrasGrid');
const searchObraInput = document.getElementById('searchObraInput');
const obrasCounter = document.getElementById('obrasCounter');

// Dashboard Elements
const balanceEl = document.getElementById('totalBalance');
const transactionListEl = document.getElementById('transactionList');
const advisorCard = document.getElementById('advisorCard');
const advisorMessage = document.getElementById('advisorMessage');
const subtitleEl = document.getElementById('currentObraSubtitle');

// Executive Summary Elements
const execTotalBalance = document.getElementById('execTotalBalance');
const execTotalIncome = document.getElementById('execTotalIncome');
const execTotalExpense = document.getElementById('execTotalExpense');
const execObrasCount = document.getElementById('execObrasCount');

// ==========================================
// THEME SWITCHER (Dark Luxury / Light)
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem('dhg_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('dhg_theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Refresh charts if open to update colors
    if (currentObraId) {
        renderDashboardChart();
    }
}

function updateThemeIcon(theme) {
    const icons = document.querySelectorAll('.theme-toggle i');
    icons.forEach(icon => {
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-moon';
        } else {
            icon.className = 'fa-solid fa-sun';
        }
    });
}

// ==========================================
// INITIALIZATION & REALTIME LISTENERS
// ==========================================
function init() {
    if (isInitialized) return;
    isInitialized = true;

    initTheme();

    // 1. Render imediato dos dados locais (super rápido, funciona offline)
    loadLocalData();
    renderExecutiveSummary();
    renderObrasList();

    // 2. Conecta à nuvem em segundo plano
    initCloudSync();
}

function updateCloudBadge(status) {
    const badges = document.querySelectorAll('#cloudStatusBadge');
    badges.forEach(b => {
        if (status === 'connected') {
            b.innerHTML = '<i class="fa-solid fa-cloud" style="color: #10b981;"></i> Nuvem Conectada';
            b.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else if (status === 'syncing') {
            b.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin" style="color: var(--gold-light);"></i> Conectando à Nuvem...';
            b.style.borderColor = 'var(--gold-primary)';
        } else {
            b.innerHTML = '<i class="fa-solid fa-cloud-slash" style="color: #f43f5e;"></i> Modo Offline';
            b.style.borderColor = 'rgba(244, 63, 94, 0.4)';
        }
    });
}

function initCloudSync() {
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            auth = firebase.auth();
            database = firebase.database();
            updateCloudBadge('syncing');

            // Autenticação transparente e automática na nuvem
            auth.onAuthStateChanged((user) => {
                if (user) {
                    isCloudReady = true;
                    updateCloudBadge('connected');
                    setupCloudListeners();
                    syncLocalToCloudIfEmpty();
                } else {
                    auth.signInWithEmailAndPassword(CLOUD_CREDENTIALS.email, CLOUD_CREDENTIALS.password)
                        .catch(err => {
                            console.warn('Erro de autenticação na nuvem:', err);
                            updateCloudBadge('offline');
                        });
                }
            });
        }
    } catch (err) {
        console.warn('Modo offline/local ativo:', err);
        updateCloudBadge('offline');
    }
}

function setupCloudListeners() {
    if (!database) return;

    // Escuta Obras na Nuvem
    database.ref(DB_ROOT + '/obras').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allObras = Object.values(data);
            saveLocalObras();
            renderExecutiveSummary();
            renderObrasList();
        }
        updateCloudBadge('connected');
    }, (err) => {
        console.warn('Erro ao escutar obras:', err);
    });

    // Escuta Transações na Nuvem
    database.ref(DB_ROOT + '/transactions').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allTransactions = Object.values(data);
            allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
            saveLocalTransactions();
            renderExecutiveSummary();
            renderObrasList();
            if (currentObraId) updateDashboardUI();
        }
        updateCloudBadge('connected');
    }, (err) => {
        console.warn('Erro ao escutar transações:', err);
    });
}

// Se a nuvem estiver vazia e o usuário já tiver dados locais, sobe para a nuvem
function syncLocalToCloudIfEmpty() {
    if (!database) return;
    database.ref(DB_ROOT + '/obras').once('value', sn => {
        if (!sn.exists() && allObras.length > 0) {
            const updates = {};
            allObras.forEach(o => { updates[o.id] = o; });
            database.ref(DB_ROOT + '/obras').set(updates);
        }
    });
    database.ref(DB_ROOT + '/transactions').once('value', sn => {
        if (!sn.exists() && allTransactions.length > 0) {
            const updates = {};
            allTransactions.forEach(t => { updates[t.id] = t; });
            database.ref(DB_ROOT + '/transactions').set(updates);
        }
    });
}

// Helper: Format Currency
function formatCurrency(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getCategoryData(catId, type) {
    const cat = categories[type]?.find(c => c.id === catId);
    return cat || { 
        name: catId || 'Geral', 
        icon: type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up',
        color: type === 'income' ? '#10b981' : '#f43f5e'
    };
}

// ==========================================
// EXECUTIVE CONSOLIDATED SUMMARY
// ==========================================
function renderExecutiveSummary() {
    let totalInc = 0;
    let totalExp = 0;

    allTransactions.forEach(t => {
        if (t.type === 'income') totalInc += (Number(t.amount) || 0);
        else totalExp += (Number(t.amount) || 0);
    });

    const totalBal = totalInc - totalExp;

    if (execTotalBalance) execTotalBalance.innerText = formatCurrency(totalBal);
    if (execTotalIncome) execTotalIncome.innerText = formatCurrency(totalInc);
    if (execTotalExpense) execTotalExpense.innerText = formatCurrency(totalExp);
    if (execObrasCount) execObrasCount.innerText = `${allObras.length} Obra${allObras.length === 1 ? '' : 's'}`;
    if (obrasCounter) obrasCounter.innerText = `${allObras.length} projeto${allObras.length === 1 ? '' : 's'}`;

    if (execTotalBalance) {
        execTotalBalance.style.color = totalBal >= 0 ? 'var(--gold-light)' : 'var(--expense-color)';
    }
}

// ==========================================
// OBRAS LIST VIEW LOGIC
// ==========================================
function handleSearchObra() {
    renderObrasList();
}

function renderObrasList() {
    obrasGrid.innerHTML = '';
    const query = (searchObraInput ? searchObraInput.value : '').toLowerCase().trim();

    const filtered = allObras.filter(obra => obra.name && obra.name.toLowerCase().includes(query));

    if (allObras.length === 0) {
        obrasGrid.innerHTML = `
            <div style="grid-column: span 2; text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--gold-primary); margin-bottom: 12px;"></i>
                <p>Nenhuma obra cadastrada ainda.</p>
                <p style="font-size: 0.85rem; margin-top: 4px;">Clique em <strong>Criar Nova Pasta de Obra</strong> para começar.</p>
            </div>
        `;
        return;
    }

    if (filtered.length === 0) {
        obrasGrid.innerHTML = `
            <div style="grid-column: span 2; text-align: center; padding: 30px 10px; color: var(--text-muted);">
                <p>Nenhuma obra encontrada para "<strong>${query}</strong>".</p>
            </div>
        `;
        return;
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    filtered.forEach(obra => {
        const obraTrans = allTransactions.filter(t => t.obraId === obra.id);
        const transCount = obraTrans.length;

        let obraIncome = 0;
        let obraExpense = 0;
        obraTrans.forEach(t => {
            if (t.type === 'income') obraIncome += Number(t.amount) || 0;
            else obraExpense += Number(t.amount) || 0;
        });
        const obraBalance = obraIncome - obraExpense;

        let balanceClass = 'neutral';
        if (obraBalance > 0) balanceClass = 'positive';
        else if (obraBalance < 0) balanceClass = 'negative';

        const card = document.createElement('div');
        card.className = 'obra-card';
        card.onclick = () => openObra(obra);

        card.innerHTML = `
            <button class="obra-card-delete" title="Excluir Pasta de Obra" onclick="event.stopPropagation(); deleteObra('${obra.id}', '${escapeHtml(obra.name)}')">
                <i class="fa-solid fa-trash-can"></i>
            </button>
            <div class="obra-icon-wrap">
                <i class="fa-solid fa-building-user obra-icon"></i>
            </div>
            <h3 class="obra-name">${escapeHtml(obra.name)}</h3>
            <p class="obra-stats">${transCount} lançamento${transCount === 1 ? '' : 's'}</p>
            <div class="obra-balance-pill ${balanceClass}">
                ${formatCurrency(obraBalance)}
            </div>
        `;
        obrasGrid.appendChild(card);
    });
}

// Modal Nova Obra
const newObraModal = document.getElementById('newObraModal');
function openNewObraModal() {
    newObraModal.classList.add('active');
    setTimeout(() => {
        const input = document.getElementById('obraName');
        input.focus();
        // Garante que o input fique visível quando o teclado abrir no mobile
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
}
function closeNewObraModal() {
    newObraModal.classList.remove('active');
    document.getElementById('newObraForm').reset();
}
newObraModal.addEventListener('click', (e) => {
    if (e.target === newObraModal) closeNewObraModal();
});

// Adicionar Nova Obra (Instantâneo + Offline-First + Sincronização em Nuvem)
document.getElementById('newObraForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('obraName');
    const name = (nameInput ? nameInput.value : '').trim();
    if (!name) return;

    const newId = generateSafeId('obra');
    const novaObra = {
        id: newId,
        name: name,
        createdAt: new Date().toISOString()
    };

    // 1. Salva localmente de imediato
    allObras.unshift(novaObra);
    saveLocalObras();

    // 2. Atualiza a interface e fecha o modal na hora
    renderExecutiveSummary();
    renderObrasList();
    closeNewObraModal();

    // 3. Abre a obra criada imediatamente
    openObra(novaObra);

    // 4. Sincroniza em segundo plano com a nuvem (aparece em todos os aparelhos na hora!)
    if (database) {
        database.ref(DB_ROOT + '/obras/' + novaObra.id).set(novaObra).catch(err => {
            console.warn('Erro ao salvar na nuvem:', err);
        });
    }
});

// Excluir Obra
function deleteObra(obraId, obraName) {
    if (confirm(`Deseja realmente excluir a pasta da obra "${obraName}"?\nTodos os lançamentos vinculados a ela também serão removidos de todos os aparelhos.`)) {
        allObras = allObras.filter(o => o.id !== obraId);
        saveLocalObras();

        allTransactions = allTransactions.filter(t => t.obraId !== obraId);
        saveLocalTransactions();

        if (currentObraId === obraId) {
            goBackToObras();
        } else {
            renderExecutiveSummary();
            renderObrasList();
        }

        if (database) {
            database.ref(DB_ROOT + '/obras/' + obraId).remove().catch(() => {});
            // Remove transações desta obra na nuvem também
            database.ref(DB_ROOT + '/transactions').once('value', sn => {
                const data = sn.val() || {};
                Object.values(data).forEach(t => {
                    if (t.obraId === obraId) {
                        database.ref(DB_ROOT + '/transactions/' + t.id).remove().catch(() => {});
                    }
                });
            });
        }
    }
}

// ==========================================
// NAVIGATION & VIEW SWITCHING
// ==========================================
function openObra(obra) {
    currentObraId = obra.id;
    subtitleEl.innerText = obra.name;
    obrasView.style.display = 'none';
    dashboardView.style.display = 'flex';
    currentFilter = 'all';
    
    // Reset filter pills
    document.querySelectorAll('.filter-pill').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === 0);
    });

    updateDashboardUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBackToObras() {
    currentObraId = null;
    dashboardView.style.display = 'none';
    obrasView.style.display = 'flex';
    renderExecutiveSummary();
    renderObrasList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// DASHBOARD VIEW LOGIC
// ==========================================
function setTransactionFilter(filter, buttonEl) {
    currentFilter = filter;
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    if (buttonEl) buttonEl.classList.add('active');
    renderTransactionList();
}

function switchDashboardChart(mode) {
    currentChartMode = mode;
    document.getElementById('btnChartExpense').classList.toggle('active', mode === 'expense');
    document.getElementById('btnChartBalance').classList.toggle('active', mode === 'ratio');
    renderDashboardChart();
}

function updateDashboardUI() {
    if (!currentObraId) return;
    const currentTrans = allTransactions.filter(t => t.obraId === currentObraId);

    // Calculations
    let income = 0;
    let expense = 0;
    let catExpenses = {};

    currentTrans.forEach(t => {
        const val = Number(t.amount) || 0;
        if (t.type === 'income') {
            income += val;
        } else {
            expense += val;
            catExpenses[t.category] = (catExpenses[t.category] || 0) + val;
        }
    });

    const balance = income - expense;
    balanceEl.innerText = formatCurrency(balance);
    balanceEl.style.color = balance >= 0 ? 'var(--income-color)' : 'var(--expense-color)';

    // Update AI Advisor
    analyzeFinances(currentTrans.length, income, expense, balance, catExpenses);

    // Render Charts and Extrato
    renderDashboardChart();
    renderTransactionList();
}

function renderTransactionList() {
    if (!currentObraId) return;
    const currentTrans = allTransactions.filter(t => t.obraId === currentObraId);

    let filtered = currentTrans;
    if (currentFilter === 'income') filtered = currentTrans.filter(t => t.type === 'income');
    else if (currentFilter === 'expense') filtered = currentTrans.filter(t => t.type === 'expense');

    transactionListEl.innerHTML = '';

    if (filtered.length === 0) {
        transactionListEl.innerHTML = `
            <div style="text-align: center; padding: 28px 10px; color: var(--text-muted);">
                <i class="fa-solid fa-receipt" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
                <p>Nenhum lançamento ${currentFilter === 'all' ? 'nesta obra' : 'nesta categoria'}.</p>
            </div>
        `;
        return;
    }

    const reversed = [...filtered].reverse();
    reversed.forEach(t => {
        const li = document.createElement('li');
        li.className = 'transaction-item';
        const isInc = t.type === 'income';
        const sign = isInc ? '+' : '-';
        const catData = getCategoryData(t.category, t.type);
        const dateStr = t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '';

        li.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-icon ${isInc ? 'income' : 'expense'}">
                    <i class="fa-solid ${catData.icon}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${escapeHtml(t.description)}</h4>
                    <p><i class="fa-regular fa-clock"></i> ${dateStr} • ${catData.name}</p>
                </div>
            </div>
            <div style="display: flex; align-items: center;">
                <span class="transaction-amount ${isInc ? 'amount-income' : 'amount-expense'}">${sign} ${formatCurrency(t.amount)}</span>
                <button class="delete-btn" title="Excluir lançamento" onclick="deleteTransaction('${t.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        transactionListEl.appendChild(li);
    });
}

// Chart.js: Dashboard Interactive Chart (Pie/Donut)
function renderDashboardChart() {
    const canvas = document.getElementById('dashboardChart');
    if (!canvas || !currentObraId) return;

    const currentTrans = allTransactions.filter(t => t.obraId === currentObraId);

    if (dashboardChartInstance) {
        dashboardChartInstance.destroy();
        dashboardChartInstance = null;
    }

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#cbd5e1' : '#334155';

    if (currentTrans.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '13px Inter';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText('Sem lançamentos para gerar gráfico.', canvas.width / 2 || 120, 100);
        return;
    }

    let labels = [];
    let data = [];
    let backgroundColors = [];

    if (currentChartMode === 'expense') {
        const catExpenses = {};
        currentTrans.filter(t => t.type === 'expense').forEach(t => {
            catExpenses[t.category] = (catExpenses[t.category] || 0) + Number(t.amount);
        });

        const sorted = Object.entries(catExpenses).sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            labels = ['Sem Despesas'];
            data = [1];
            backgroundColors = ['rgba(148, 163, 184, 0.3)'];
        } else {
            sorted.forEach(([catId, amount]) => {
                const catData = getCategoryData(catId, 'expense');
                labels.push(catData.name);
                data.push(amount);
                backgroundColors.push(catData.color || '#c9a84c');
            });
        }
    } else {
        // Mode 'ratio': Entradas vs Saídas
        let inc = 0;
        let exp = 0;
        currentTrans.forEach(t => {
            if (t.type === 'income') inc += Number(t.amount) || 0;
            else exp += Number(t.amount) || 0;
        });

        labels = ['Receitas', 'Despesas'];
        data = [inc, exp];
        backgroundColors = ['#10b981', '#f43f5e'];
    }

    dashboardChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: isDark ? '#0c1626' : '#ffffff',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        boxWidth: 12,
                        padding: 12,
                        font: { size: 11, family: 'Inter', weight: 600 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            const val = ctx.raw || 0;
                            return ` ${ctx.label}: ${formatCurrency(val)}`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// AI Financial Advisor Logic
function analyzeFinances(qtyItems, income, expense, balance, catExpenses) {
    advisorCard.className = 'advisor-card';

    if (qtyItems === 0) {
        advisorMessage.innerText = "Pasta de obra criada! Utilize os botões '+ Receita' e '- Despesa' para iniciar o fluxo financeiro deste projeto.";
        advisorCard.classList.add('status-warning');
        return;
    }

    if (income === 0 && expense > 0) {
        advisorMessage.innerText = "Atenção: A obra possui saídas registradas sem capital de entrada inserido. Registre o aporte ou medição inicial.";
        advisorCard.classList.add('status-danger');
        return;
    }

    const expenseRatio = income > 0 ? (expense / income) : 1;
    const fuelExpense = catExpenses['combustivel'] || 0;
    const materialsExpense = catExpenses['materiais'] || 0;

    if (balance < 0) {
        advisorMessage.innerText = `Alerta Crítico: O projeto estourou o caixa injetado em ${formatCurrency(Math.abs(balance))}. Operando com saldo devedor.`;
        advisorCard.classList.add('status-danger');
    } else if (expenseRatio >= 0.85) {
        advisorMessage.innerText = `Cuidado: Os custos do projeto já consom ${Math.round(expenseRatio * 100)}% da receita aportada. Monitore o orçamento de perto.`;
        advisorCard.classList.add('status-warning');
    } else if (fuelExpense > (income * 0.15)) {
        advisorMessage.innerText = "Tática: Gastos com frete, logística e combustível superam 15% das entradas. Avalie rotas e entregas de fornecedores.";
        advisorCard.classList.add('status-warning');
    } else if (materialsExpense > (income * 0.40)) {
        advisorMessage.innerText = "Gestão de Obras: Custos de materiais de construção acima de 40% da receita. Controle perdas e faça cotações com 3 fornecedores.";
        advisorCard.classList.add('status-warning');
    } else if (expenseRatio <= 0.6) {
        advisorMessage.innerText = "Margem Saudável: Obra altamente lucrativa com custos controlados e excelente margem operacional!";
        advisorCard.classList.add('status-good');
    } else {
        advisorMessage.innerText = "Gestão Equilibrada: Fluxo financeiro deste projeto está em conformidade e sem gargalos identificados.";
        advisorCard.classList.add('status-good');
    }
}

// ==========================================
// TRANSACTIONS CRUD (MODAL)
// ==========================================
const transactionModal = document.getElementById('transactionModal');
const transactionForm = document.getElementById('transactionForm');

function openModal(type) {
    document.getElementById('transactionType').value = type;
    document.getElementById('modalTitle').innerText = type === 'income' ? 'Nova Receita / Entrada' : 'Nova Despesa / Saída';

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

    transactionModal.classList.add('active');
    setTimeout(() => {
        const input = document.getElementById('amount');
        input.focus();
        // Garante que o input fique visível quando o teclado abrir no mobile
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
}

function closeModal() {
    transactionModal.classList.remove('active');
    transactionForm.reset();
}

transactionModal.addEventListener('click', (e) => {
    if (e.target === transactionModal) closeModal();
});

transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentObraId) return;

    const amountInput = document.getElementById('amount').value.replace(',', '.');
    const amount = parseFloat(amountInput);
    const description = (document.getElementById('description').value || '').trim();

    if (!amount || isNaN(amount) || !description) return;

    const id = generateSafeId('tx');
    const transaction = {
        id,
        obraId: currentObraId,
        type: document.getElementById('transactionType').value,
        amount: Math.abs(amount),
        description: description,
        category: document.getElementById('category').value,
        date: new Date().toISOString()
    };

    // 1. Salva localmente de imediato
    allTransactions.push(transaction);
    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveLocalTransactions();

    // 2. Atualiza a tela e fecha o modal na hora
    updateDashboardUI();
    renderExecutiveSummary();
    closeModal();

    // 3. Sincroniza em nuvem em tempo real (aparece em todos os aparelhos na hora!)
    if (database) {
        database.ref(DB_ROOT + '/transactions/' + id).set(transaction).catch(err => {
            console.warn('Erro ao salvar transação na nuvem:', err);
        });
    }
});

function deleteTransaction(id) {
    if (confirm('Deseja realmente excluir este lançamento desta obra?')) {
        allTransactions = allTransactions.filter(t => t.id !== id);
        saveLocalTransactions();
        updateDashboardUI();
        renderExecutiveSummary();

        if (database) {
            database.ref(DB_ROOT + '/transactions/' + id).remove().catch(() => {});
        }
    }
}

// ==========================================
// MONTHLY REPORT MODAL
// ==========================================
const reportModal = document.getElementById('reportModal');
const reportContent = document.getElementById('reportContent');

function openReportModal() {
    generateMonthlyReport();
    reportModal.classList.add('active');
}

function closeReportModal() {
    reportModal.classList.remove('active');
    if (reportChartInstance) {
        reportChartInstance.destroy();
        reportChartInstance = null;
    }
}

reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) closeReportModal();
});

function generateMonthlyReport() {
    if (!currentObraId) return;

    const now = new Date();
    const currentM = now.getMonth();
    const currentY = now.getFullYear();
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('reportMonthName').innerText = `${months[currentM]} de ${currentY}`;

    const monthlyTrans = allTransactions.filter(t => {
        const d = new Date(t.date);
        return t.obraId === currentObraId && d.getMonth() === currentM && d.getFullYear() === currentY;
    });

    let inc = 0;
    let exp = 0;
    let catExp = {};

    monthlyTrans.forEach(t => {
        const val = Number(t.amount) || 0;
        if (t.type === 'income') inc += val;
        else {
            exp += val;
            catExp[t.category] = (catExp[t.category] || 0) + val;
        }
    });

    const bal = inc - exp;
    let html = `
        <div class="summary-box">
            <p>Saldo da Obra no Mês</p>
            <h2 style="color: ${bal >= 0 ? 'var(--income-color)' : 'var(--expense-color)'}">
                ${formatCurrency(bal)}
            </h2>
            <div style="display:flex; justify-content: space-between; margin-top: 14px; font-size: 0.95rem; font-weight: 600;">
                <span style="color: var(--income-color)"><i class="fa-solid fa-arrow-down"></i> Entradas: ${formatCurrency(inc)}</span>
                <span style="color: var(--expense-color)"><i class="fa-solid fa-arrow-up"></i> Saídas: ${formatCurrency(exp)}</span>
            </div>
        </div>
    `;

    if (exp > 0) {
        html += `
            <div class="report-section">
                <h4><i class="fa-solid fa-chart-pie" style="color: var(--gold-primary);"></i> Gráfico de Despesas do Mês</h4>
                <div style="height: 180px; position: relative; margin-bottom: 20px;">
                    <canvas id="reportChart"></canvas>
                </div>
                
                <h4><i class="fa-solid fa-bars-progress" style="color: var(--gold-primary);"></i> Detalhamento por Categoria</h4>
        `;

        const sortedCats = Object.entries(catExp).sort((a, b) => b[1] - a[1]);
        sortedCats.forEach(entry => {
            const catData = getCategoryData(entry[0], 'expense');
            const p = ((entry[1] / exp) * 100).toFixed(1);
            html += `
                <div style="margin-bottom: 16px;">
                    <div class="report-row">
                        <strong><i class="fa-solid ${catData.icon}" style="color: ${catData.color}; margin-right: 6px;"></i> ${catData.name}</strong>
                        <span>${formatCurrency(entry[1])} (${p}%)</span>
                    </div>
                    <div class="report-bar-bg">
                        <div class="report-bar-fill" style="width: ${p}%; background-color: ${catData.color || 'var(--expense-color)'};"></div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    } else {
        html += `
            <div style="text-align: center; padding: 30px 10px; color: var(--text-muted);">
                <i class="fa-solid fa-file-circle-check" style="font-size: 2.2rem; color: var(--income-color); margin-bottom: 8px;"></i>
                <p>Nenhuma despesa registrada neste mês para esta obra.</p>
            </div>
        `;
    }

    reportContent.innerHTML = html;

    // Build Report Chart
    if (exp > 0) {
        setTimeout(() => {
            const reportCanvas = document.getElementById('reportChart');
            if (!reportCanvas) return;

            const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
            const sortedCats = Object.entries(catExp).sort((a, b) => b[1] - a[1]);
            const labels = [];
            const data = [];
            const colors = [];

            sortedCats.forEach(entry => {
                const catData = getCategoryData(entry[0], 'expense');
                labels.push(catData.name);
                data.push(entry[1]);
                colors.push(catData.color || '#c9a84c');
            });

            if (reportChartInstance) {
                reportChartInstance.destroy();
            }

            reportChartInstance = new Chart(reportCanvas, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors,
                        borderColor: isDark ? '#0f1c2f' : '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: isDark ? '#cbd5e1' : '#334155',
                                boxWidth: 10,
                                font: { size: 10, family: 'Inter' }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    return ` ${ctx.label}: ${formatCurrency(ctx.raw)}`;
                                }
                            }
                        }
                    }
                }
            });
        }, 50);
    }
}

// Utility: Prevent XSS
function escapeHtml(string) {
    const div = document.createElement('div');
    div.innerText = string || '';
    return div.innerHTML;
}

// ==========================================
// MOBILE KEYBOARD FIX
// Garante que o modal e inputs fiquem
// visíveis quando o teclado virtual abre
// ==========================================
(function () {
    // Detecta abertura do teclado via mudança de altura da viewport
    if (typeof window.visualViewport !== 'undefined') {
        window.visualViewport.addEventListener('resize', () => {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (!activeModal) return;

            const modalContent = activeModal.querySelector('.modal-content');
            const vvHeight = window.visualViewport.height;
            const winHeight = window.innerHeight;

            // Se o teclado reduziu a viewport, ajusta o modal para ficar na área visível
            if (vvHeight < winHeight * 0.85) {
                // Teclado aberto: modo centralizado / scroll
                activeModal.style.alignItems = 'flex-start';
                activeModal.style.overflowY = 'auto';
                modalContent.style.borderRadius = '0';
                modalContent.style.maxHeight = vvHeight + 'px';

                // Scrolla até o input focado
                const focused = document.activeElement;
                if (focused && modalContent.contains(focused)) {
                    setTimeout(() => {
                        focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
            } else {
                // Teclado fechado: restaura estilo normal
                activeModal.style.alignItems = '';
                activeModal.style.overflowY = '';
                modalContent.style.borderRadius = '';
                modalContent.style.maxHeight = '';
            }
        });
    }
})();

// Initialize on Load
document.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
}

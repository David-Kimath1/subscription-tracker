// Subscription Tracker - Complete Final Version

// State
let subscriptions = [];
let settings = { defaultCurrency: 'USD' };
let currentFilter = 'all';
let currentSort = 'name';
let sortAscending = true;
let editingId = null;
let notificationPermission = false;

// Currency symbols
const symbols = {
    USD: '$', KES: 'KSh', EUR: '€', GBP: '£',
    NGN: '₦', ZAR: 'R', INR: '₹'
};

// DOM Elements
let monthlyTotal, yearlyTotal, activeCount;
let subscriptionList, emptyState;
let subscriptionModal, settingsModal, confirmModal;
let modalTitle, subscriptionForm, deleteBtn;
let searchInput, sortSelect, sortIcon;

// Auto-calculate next billing date based on cycle
function calculateNextBillingDate(cycle) {
    const date = new Date();
    switch (cycle) {
        case 'weekly': date.setDate(date.getDate() + 7); break;
        case 'monthly': date.setMonth(date.getMonth() + 1); break;
        case 'quarterly': date.setMonth(date.getMonth() + 3); break;
        case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
        default: date.setMonth(date.getMonth() + 1);
    }
    return date.toISOString().split('T')[0];
}

// Update date when billing cycle changes
function onBillingCycleChange() {
    const cycle = document.getElementById('billingCycle').value;
    const dateInput = document.getElementById('nextBillingDate');
    if (!editingId || !dateInput.dataset.manuallySet) {
        dateInput.value = calculateNextBillingDate(cycle);
    }
}

// Mark date as manually set
function onDateManuallyChanged() {
    document.getElementById('nextBillingDate').dataset.manuallySet = 'true';
}

// Load data (fast - no blocking)
function loadData() {
    const saved = localStorage.getItem('subscriptions');
    if (saved) subscriptions = JSON.parse(saved);
    
    const savedSettings = localStorage.getItem('subscriptionSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        document.getElementById('defaultCurrency').value = settings.defaultCurrency;
    }
    
    setTimeout(() => detectLocationInBackground(), 100);
    setTimeout(() => requestNotificationPermission(), 500);
}

// Background location detection
async function detectLocationInBackground() {
    if (localStorage.getItem('currencyManuallySet')) return;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        
        let newCurrency = null;
        if (data.country_code === 'KE') newCurrency = 'KES';
        else if (data.country_code === 'NG') newCurrency = 'NGN';
        else if (data.country_code === 'ZA') newCurrency = 'ZAR';
        
        if (newCurrency && newCurrency !== settings.defaultCurrency) {
            settings.defaultCurrency = newCurrency;
            document.getElementById('defaultCurrency').value = newCurrency;
            saveSettings();
            updateSummary();
            renderSubscriptions();
        }
    } catch (e) { console.log('Location detection skipped'); }
}

// Notification functions
async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') notificationPermission = true;
    else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        notificationPermission = permission === 'granted';
    }
}

function showNotification(title, body) {
    if (!notificationPermission) return;
    try {
        new Notification(title, {
            body, icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            vibrate: [200, 100, 200], requireInteraction: true, tag: 'sub-reminder'
        });
    } catch (e) {}
}

function checkUpcomingBills() {
    if (!notificationPermission) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const activeSubs = subscriptions.filter(s => s.status === 'active');
    
    activeSubs.forEach(sub => {
        const billDate = new Date(sub.nextBillingDate); billDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((billDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntil === 3 || daysUntil === 2 || daysUntil === 1 || daysUntil === 0 || daysUntil < 0) {
            const lastNotified = localStorage.getItem(`notified_${sub.id}_${daysUntil}`);
            const today_str = today.toISOString().split('T')[0];
            
            if (lastNotified !== today_str) {
                let message = '', title = 'Subscription Reminder';
                if (daysUntil < 0) {
                    const overdue = Math.abs(daysUntil);
                    title = 'Overdue!';
                    message = `${sub.name} is ${overdue} day${overdue>1?'s':''} overdue! ${symbols[sub.currency]} ${sub.price}`;
                } else if (daysUntil === 0) {
                    title = 'Due Today!';
                    message = `${sub.name} bills today! ${symbols[sub.currency]} ${sub.price}`;
                } else if (daysUntil === 1) {
                    message = `${sub.name} bills tomorrow! ${symbols[sub.currency]} ${sub.price}`;
                } else {
                    message = `${sub.name} bills in ${daysUntil} days. ${symbols[sub.currency]} ${sub.price}`;
                }
                showNotification(title, message);
                localStorage.setItem(`notified_${sub.id}_${daysUntil}`, today_str);
            }
        }
    });
}

setInterval(checkUpcomingBills, 60 * 60 * 1000);

function saveData() { localStorage.setItem('subscriptions', JSON.stringify(subscriptions)); }
function saveSettings() { localStorage.setItem('subscriptionSettings', JSON.stringify(settings)); }

function updateSummary() {
    const active = subscriptions.filter(s => s.status === 'active');
    let monthly = 0;
    active.forEach(s => {
        let price = s.price;
        if (s.billingCycle === 'weekly') price = price * 4.33;
        else if (s.billingCycle === 'quarterly') price = price / 3;
        else if (s.billingCycle === 'yearly') price = price / 12;
        monthly += price;
    });
    const sym = symbols[settings.defaultCurrency] || '$';
    monthlyTotal.textContent = `${sym} ${monthly.toFixed(0)}`;
    yearlyTotal.textContent = `${sym} ${(monthly * 12).toFixed(0)}`;
    activeCount.textContent = active.length;
}

function renderSubscriptions() {
    let filtered = subscriptions.filter(s => {
        if (currentFilter === 'active') return s.status === 'active';
        if (currentFilter === 'cancelled') return s.status === 'cancelled';
        if (currentFilter === 'expiring') {
            if (s.status !== 'active') return false;
            const diff = Math.ceil((new Date(s.nextBillingDate) - new Date()) / (1000 * 60 * 60 * 24));
            return diff >= 0 && diff <= 7;
        }
        if (currentFilter === 'overdue') {
            if (s.status !== 'active') return false;
            const diff = Math.ceil((new Date(s.nextBillingDate) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
            return diff < 0;
        }
        return true;
    });
    
    const query = searchInput?.value.toLowerCase() || '';
    if (query) filtered = filtered.filter(s => s.name.toLowerCase().includes(query) || s.category.toLowerCase().includes(query));
    
    filtered.sort((a, b) => {
        let result = 0;
        if (currentSort === 'name') result = a.name.localeCompare(b.name);
        else if (currentSort === 'price') result = a.price - b.price;
        else if (currentSort === 'nextBilling') result = new Date(a.nextBillingDate) - new Date(b.nextBillingDate);
        else if (currentSort === 'category') result = a.category.localeCompare(b.category);
        return sortAscending ? result : -result;
    });
    
    if (filtered.length === 0) { subscriptionList.innerHTML = ''; emptyState.classList.remove('hidden'); return; }
    emptyState.classList.add('hidden');
    const sym = symbols[settings.defaultCurrency] || '$';
    
    subscriptionList.innerHTML = filtered.map(s => {
        const date = new Date(s.nextBillingDate);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
        let statusText = '', expiringClass = '';
        
        if (s.status === 'active') {
            if (daysUntil < 0) { statusText = `${Math.abs(daysUntil)}d overdue!`; expiringClass = 'overdue'; }
            else if (daysUntil === 0) { statusText = 'Today!'; expiringClass = 'urgent'; }
            else if (daysUntil === 1) { statusText = 'Tomorrow'; expiringClass = 'urgent'; }
            else if (daysUntil <= 3) { statusText = `In ${daysUntil}d`; expiringClass = 'soon'; }
            else { statusText = `In ${daysUntil}d`; }
        }
        
        return `<div class="subscription-card"><div class="card-color" style="background: ${s.color};"></div><div class="card-content">
            <div class="card-header"><div class="card-title"><h3>${escapeHtml(s.name)}</h3><span class="category-badge">${escapeHtml(s.category)}</span></div>
            <span class="card-price">${sym} ${s.price}/${s.billingCycle.slice(0,2)}</span></div>
            <div class="card-details"><div class="card-detail"><i class="fa-regular fa-calendar"></i><span>${date.toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</span></div>
            ${s.status==='active'?`<div class="card-detail ${expiringClass}"><i class="fa-regular fa-bell"></i><span>${statusText}</span></div>`:''}
            <span class="status-badge ${s.status}">${s.status}</span></div>
            <div class="card-actions"><button class="card-action-btn edit-btn" data-id="${s.id}"><i class="fa-regular fa-pen-to-square"></i></button>
            <button class="card-action-btn delete-btn" data-id="${s.id}"><i class="fa-regular fa-trash-can"></i></button></div></div></div>`;
    }).join('');
    
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); editSubscription(parseInt(btn.dataset.id)); }));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); confirmDelete(parseInt(btn.dataset.id)); }));
}

function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

function editSubscription(id) {
    const sub = subscriptions.find(s => s.id === id); if (!sub) return;
    editingId = id; modalTitle.textContent = 'Edit Subscription'; deleteBtn.classList.remove('hidden');
    document.getElementById('subscriptionId').value = sub.id;
    document.getElementById('serviceName').value = sub.name;
    document.getElementById('category').value = sub.category;
    document.getElementById('price').value = sub.price;
    document.getElementById('currency').value = sub.currency || settings.defaultCurrency;
    document.getElementById('billingCycle').value = sub.billingCycle;
    document.getElementById('nextBillingDate').value = sub.nextBillingDate;
    document.getElementById('paymentMethod').value = sub.paymentMethod || 'card';
    document.getElementById('notes').value = sub.notes || '';
    document.getElementById('status').value = sub.status;
    document.getElementById('nextBillingDate').dataset.manuallySet = 'true';
    const colorRadio = document.querySelector(`input[name="color"][value="${sub.color}"]`); if (colorRadio) colorRadio.checked = true;
    subscriptionModal.classList.remove('hidden');
}

let pendingDeleteId = null;
function confirmDelete(id) { pendingDeleteId = id; document.getElementById('confirmTitle').textContent = 'Delete'; document.getElementById('confirmMessage').textContent = 'Delete this subscription?'; confirmModal.classList.remove('hidden'); }

function openAddModal() {
    editingId = null; modalTitle.textContent = 'Add Subscription'; deleteBtn.classList.add('hidden'); subscriptionForm.reset();
    document.getElementById('subscriptionId').value = '';
    document.getElementById('currency').value = settings.defaultCurrency;
    document.getElementById('billingCycle').value = 'monthly';
    document.getElementById('status').value = 'active';
    document.getElementById('color1').checked = true;
    const dateInput = document.getElementById('nextBillingDate');
    dateInput.value = calculateNextBillingDate('monthly');
    dateInput.dataset.manuallySet = 'false';
    subscriptionModal.classList.remove('hidden');
}

function saveSubscription(e) {
    e.preventDefault();
    const sub = {
        id: editingId || Date.now(),
        name: document.getElementById('serviceName').value.trim(),
        category: document.getElementById('category').value,
        price: parseFloat(document.getElementById('price').value),
        currency: document.getElementById('currency').value,
        billingCycle: document.getElementById('billingCycle').value,
        nextBillingDate: document.getElementById('nextBillingDate').value,
        paymentMethod: document.getElementById('paymentMethod').value,
        notes: document.getElementById('notes').value.trim(),
        status: document.getElementById('status').value,
        color: document.querySelector('input[name="color"]:checked')?.value || '#e94560'
    };
    if (!sub.name || !sub.price) { showToast('Fill all fields', 'error'); return; }
    if (editingId) { const idx = subscriptions.findIndex(s => s.id === editingId); if (idx !== -1) subscriptions[idx] = sub; showToast('Updated'); }
    else { subscriptions.push(sub); showToast('Added'); if (!notificationPermission && 'Notification' in window && Notification.permission === 'default') { setTimeout(() => { if (confirm('Get billing reminders?')) requestNotificationPermission(); }, 500); } }
    saveData(); subscriptionModal.classList.add('hidden'); renderSubscriptions(); updateSummary(); setTimeout(checkUpcomingBills, 500);
}

function deleteSubscription() {
    if (pendingDeleteId) { subscriptions = subscriptions.filter(s => s.id !== pendingDeleteId); saveData(); renderSubscriptions(); updateSummary(); showToast('Deleted'); pendingDeleteId = null; }
    confirmModal.classList.add('hidden'); subscriptionModal.classList.add('hidden');
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast'); const icon = toast.querySelector('i');
    document.getElementById('toastMessage').textContent = msg;
    icon.className = type === 'error' ? 'fa-solid fa-exclamation-circle' : 'fa-solid fa-check-circle';
    toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--success)';
    toast.classList.remove('hidden'); setTimeout(() => toast.classList.add('hidden'), 2000);
}

function exportData() {
    const data = JSON.stringify({ subscriptions, settings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url); showToast('Exported');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = e => { try { const data = JSON.parse(e.target.result); if (data.subscriptions) subscriptions = data.subscriptions; if (data.settings) settings = data.settings; saveData(); saveSettings(); renderSubscriptions(); updateSummary(); showToast('Imported'); } catch { showToast('Invalid file', 'error'); } };
    reader.readAsText(file);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    monthlyTotal = document.getElementById('monthlyTotal'); yearlyTotal = document.getElementById('yearlyTotal'); activeCount = document.getElementById('activeCount');
    subscriptionList = document.getElementById('subscriptionList'); emptyState = document.getElementById('emptyState');
    subscriptionModal = document.getElementById('subscriptionModal'); settingsModal = document.getElementById('settingsModal'); confirmModal = document.getElementById('confirmModal');
    modalTitle = document.getElementById('modalTitle'); subscriptionForm = document.getElementById('subscriptionForm'); deleteBtn = document.getElementById('deleteSubscriptionBtn');
    searchInput = document.getElementById('searchInput'); sortSelect = document.getElementById('sortSelect'); sortIcon = document.getElementById('sortIcon');
    
    loadData(); renderSubscriptions(); updateSummary();
    
    document.getElementById('addSubscriptionBtn').addEventListener('click', openAddModal);
    document.getElementById('settingsBtn').addEventListener('click', () => { document.getElementById('defaultCurrency').value = settings.defaultCurrency; settingsModal.classList.remove('hidden'); });
    subscriptionForm.addEventListener('submit', saveSubscription);
    document.getElementById('cancelFormBtn').addEventListener('click', () => subscriptionModal.classList.add('hidden'));
    document.getElementById('closeModalBtn').addEventListener('click', () => subscriptionModal.classList.add('hidden'));
    deleteBtn.addEventListener('click', () => { if (editingId) confirmDelete(editingId); });
    document.getElementById('closeSettingsBtn').addEventListener('click', () => settingsModal.classList.add('hidden'));
    document.getElementById('saveSettingsBtn').addEventListener('click', () => { const newCurrency = document.getElementById('defaultCurrency').value; if (newCurrency !== settings.defaultCurrency) localStorage.setItem('currencyManuallySet', 'true'); settings.defaultCurrency = newCurrency; saveSettings(); settingsModal.classList.add('hidden'); renderSubscriptions(); updateSummary(); showToast('Saved'); });
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
    document.getElementById('clearAllDataBtn').addEventListener('click', () => { pendingDeleteId = 'all'; document.getElementById('confirmTitle').textContent = 'Clear All'; document.getElementById('confirmMessage').textContent = 'Delete everything?'; confirmModal.classList.remove('hidden'); });
    document.getElementById('confirmCancelBtn').addEventListener('click', () => { confirmModal.classList.add('hidden'); pendingDeleteId = null; });
    document.getElementById('confirmOkBtn').addEventListener('click', () => { if (pendingDeleteId === 'all') { subscriptions = []; saveData(); renderSubscriptions(); updateSummary(); showToast('Cleared'); } else deleteSubscription(); confirmModal.classList.add('hidden'); });
    
    document.querySelectorAll('.filter-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); currentFilter = tab.dataset.filter; renderSubscriptions(); }));
    searchInput.addEventListener('input', renderSubscriptions);
    sortSelect.addEventListener('change', e => { currentSort = e.target.value; renderSubscriptions(); });
    document.getElementById('sortDirectionBtn').addEventListener('click', () => { sortAscending = !sortAscending; sortIcon.className = sortAscending ? 'fa-solid fa-arrow-down' : 'fa-solid fa-arrow-up'; renderSubscriptions(); });
    
    const billingCycleSelect = document.getElementById('billingCycle'); billingCycleSelect.addEventListener('change', onBillingCycleChange);
    const dateInputField = document.getElementById('nextBillingDate'); dateInputField.addEventListener('change', onDateManuallyChanged); dateInputField.addEventListener('input', onDateManuallyChanged);
    
    [subscriptionModal, settingsModal, confirmModal].forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); }));
});
// Subscription Tracker - With Notification Reminders + Overdue Tab

// State
let subscriptions = [];
let settings = { 
    defaultCurrency: 'USD',
    notificationsEnabled: true,
    reminderDays: 3
};
let currentFilter = 'all';
let currentSort = 'name';
let sortAscending = true;
let editingId = null;

// Currency symbols
const symbols = {
    USD: '$', KES: 'KSh', EUR: '€', GBP: '£',
    NGN: '₦', ZAR: 'R', INR: '₹'
};

// DOM Elements
const monthlyTotal = document.getElementById('monthlyTotal');
const yearlyTotal = document.getElementById('yearlyTotal');
const activeCount = document.getElementById('activeCount');
const subscriptionList = document.getElementById('subscriptionList');
const emptyState = document.getElementById('emptyState');
const subscriptionModal = document.getElementById('subscriptionModal');
const settingsModal = document.getElementById('settingsModal');
const confirmModal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const subscriptionForm = document.getElementById('subscriptionForm');
const subscriptionId = document.getElementById('subscriptionId');
const deleteBtn = document.getElementById('deleteSubscriptionBtn');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const sortIcon = document.getElementById('sortIcon');

// Notification permission status
let notificationPermission = false;

// Load data
function loadData() {
    const saved = localStorage.getItem('subscriptions');
    if (saved) subscriptions = JSON.parse(saved);
    
    const savedSettings = localStorage.getItem('subscriptionSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        document.getElementById('defaultCurrency').value = settings.defaultCurrency;
    }
    
    // Detect location for currency
    detectLocation();
    
    // Request notification permission
    requestNotificationPermission();
    
    // Check for upcoming bills
    checkUpcomingBills();
}

async function detectLocation() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        
        if (data.country_code === 'KE') {
            settings.defaultCurrency = 'KES';
            document.getElementById('defaultCurrency').value = 'KES';
            saveSettings();
        } else if (data.country_code === 'NG') {
            settings.defaultCurrency = 'NGN';
            document.getElementById('defaultCurrency').value = 'NGN';
            saveSettings();
        } else if (data.country_code === 'ZA') {
            settings.defaultCurrency = 'ZAR';
            document.getElementById('defaultCurrency').value = 'ZAR';
            saveSettings();
        }
    } catch (e) {
        console.log('Could not detect location');
    }
}

// Notification functions
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Browser does not support notifications');
        return;
    }
    
    if (Notification.permission === 'granted') {
        notificationPermission = true;
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        notificationPermission = permission === 'granted';
    }
}

function showNotification(title, body, icon = null) {
    if (!notificationPermission) return;
    
    const options = {
        body: body,
        icon: icon || 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: 'subscription-reminder'
    };
    
    try {
        new Notification(title, options);
    } catch (e) {
        console.log('Notification error:', e);
    }
}

function checkUpcomingBills() {
    if (!notificationPermission) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeSubs = subscriptions.filter(s => s.status === 'active');
    
    activeSubs.forEach(sub => {
        const billDate = new Date(sub.nextBillingDate);
        billDate.setHours(0, 0, 0, 0);
        
        const daysUntil = Math.ceil((billDate - today) / (1000 * 60 * 60 * 24));
        
        // Check if we should notify (exactly 3 days before, 2 days, 1 day, today, or overdue)
        if (daysUntil === settings.reminderDays || daysUntil === 2 || daysUntil === 1 || daysUntil === 0 || daysUntil < 0) {
            // Check if we already notified for this subscription today
            const lastNotified = localStorage.getItem(`notified_${sub.id}_${daysUntil}`);
            const today_str = today.toISOString().split('T')[0];
            
            if (lastNotified !== today_str) {
                let message = '';
                let title = 'Subscription Reminder';
                
                if (daysUntil < 0) {
                    const daysOverdue = Math.abs(daysUntil);
                    title = 'Overdue Subscription!';
                    message = `Your ${sub.name} subscription is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue! Amount: ${symbols[sub.currency]} ${sub.price}`;
                } else if (daysUntil === 0) {
                    title = 'Subscription Due Today!';
                    message = `Your ${sub.name} subscription bills TODAY! Amount: ${symbols[sub.currency]} ${sub.price}`;
                } else if (daysUntil === 1) {
                    message = `Your ${sub.name} subscription bills TOMORROW! Amount: ${symbols[sub.currency]} ${sub.price}`;
                } else {
                    message = `Your ${sub.name} subscription bills in ${daysUntil} days. Amount: ${symbols[sub.currency]} ${sub.price}`;
                }
                
                showNotification(title, message);
                localStorage.setItem(`notified_${sub.id}_${daysUntil}`, today_str);
            }
        }
    });
}

// Check for upcoming bills every hour
setInterval(checkUpcomingBills, 60 * 60 * 1000);

// Also check when page loads
window.addEventListener('load', () => {
    setTimeout(checkUpcomingBills, 1000);
});

function saveData() {
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
}

function saveSettings() {
    localStorage.setItem('subscriptionSettings', JSON.stringify(settings));
}

// Update summary
function updateSummary() {
    const active = subscriptions.filter(s => s.status === 'active');
    let monthly = 0;
    
    active.forEach(s => {
        let price = s.price;
        if (s.billingCycle === 'weekly') price = price * 4.33;
        if (s.billingCycle === 'quarterly') price = price / 3;
        if (s.billingCycle === 'yearly') price = price / 12;
        monthly += price;
    });
    
    const sym = symbols[settings.defaultCurrency] || '$';
    monthlyTotal.textContent = `${sym} ${monthly.toFixed(0)}`;
    yearlyTotal.textContent = `${sym} ${(monthly * 12).toFixed(0)}`;
    activeCount.textContent = active.length;
}

// Render subscriptions
function renderSubscriptions() {
    let filtered = subscriptions.filter(s => {
        if (currentFilter === 'active') return s.status === 'active';
        if (currentFilter === 'cancelled') return s.status === 'cancelled';
        if (currentFilter === 'expiring') {
            if (s.status !== 'active') return false;
            const date = new Date(s.nextBillingDate);
            const today = new Date();
            const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
            return diff >= 0 && diff <= 7;
        }
        if (currentFilter === 'overdue') {
            if (s.status !== 'active') return false;
            const date = new Date(s.nextBillingDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
            return diff < 0;
        }
        return true;
    });
    
    const query = searchInput.value.toLowerCase();
    if (query) {
        filtered = filtered.filter(s => 
            s.name.toLowerCase().includes(query) || 
            s.category.toLowerCase().includes(query)
        );
    }
    
    filtered.sort((a, b) => {
        let result = 0;
        if (currentSort === 'name') result = a.name.localeCompare(b.name);
        if (currentSort === 'price') result = a.price - b.price;
        if (currentSort === 'nextBilling') result = new Date(a.nextBillingDate) - new Date(b.nextBillingDate);
        if (currentSort === 'category') result = a.category.localeCompare(b.category);
        return sortAscending ? result : -result;
    });
    
    if (filtered.length === 0) {
        subscriptionList.innerHTML = '';
        emptyState.classList.remove('hidden');
        
        // Update empty state message based on filter
        const emptyMessage = emptyState.querySelector('p');
        if (currentFilter === 'overdue') {
            emptyMessage.textContent = 'No overdue subscriptions! Great job!';
        } else if (currentFilter === 'expiring') {
            emptyMessage.textContent = 'No subscriptions expiring soon';
        } else if (currentFilter === 'active') {
            emptyMessage.textContent = 'No active subscriptions';
        } else if (currentFilter === 'cancelled') {
            emptyMessage.textContent = 'No cancelled subscriptions';
        } else {
            emptyMessage.textContent = 'Tap the + button to add your first subscription';
        }
        
        return;
    }
    
    emptyState.classList.add('hidden');
    const sym = symbols[settings.defaultCurrency] || '$';
    
    subscriptionList.innerHTML = filtered.map(s => {
        const date = new Date(s.nextBillingDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
        
        let statusText = '';
        let expiringClass = '';
        
        if (s.status === 'active') {
            if (daysUntil < 0) {
                const daysOverdue = Math.abs(daysUntil);
                statusText = `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue!`;
                expiringClass = 'overdue';
            } else if (daysUntil === 0) {
                statusText = 'Today!';
                expiringClass = 'urgent';
            } else if (daysUntil === 1) {
                statusText = 'Tomorrow';
                expiringClass = 'urgent';
            } else if (daysUntil <= 3) {
                statusText = `In ${daysUntil} days`;
                expiringClass = 'soon';
            } else {
                statusText = `In ${daysUntil} days`;
            }
        }
        
        return `
            <div class="subscription-card" style="cursor: pointer;">
                <div class="card-color" style="background: ${s.color};"></div>
                <div class="card-content">
                    <div class="card-header">
                        <div class="card-title">
                            <h3>${s.name}</h3>
                            <span class="category-badge">${s.category}</span>
                        </div>
                        <span class="card-price">${sym} ${s.price}/${s.billingCycle.slice(0,2)}</span>
                    </div>
                    <div class="card-details">
                        <div class="card-detail">
                            <i class="fa-regular fa-calendar"></i>
                            <span>${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        ${s.status === 'active' ? `
                            <div class="card-detail ${expiringClass}">
                                <i class="fa-regular fa-bell"></i>
                                <span>${statusText}</span>
                            </div>
                        ` : ''}
                        <span class="status-badge ${s.status}">${s.status}</span>
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn edit-btn" data-id="${s.id}">
                            <i class="fa-regular fa-pen-to-square"></i> Edit
                        </button>
                        <button class="card-action-btn delete-btn" data-id="${s.id}">
                            <i class="fa-regular fa-trash-can"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editSubscription(parseInt(btn.dataset.id));
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDelete(parseInt(btn.dataset.id));
        });
    });
}

function editSubscription(id) {
    const sub = subscriptions.find(s => s.id === id);
    if (!sub) return;
    
    editingId = id;
    modalTitle.textContent = 'Edit Subscription';
    deleteBtn.classList.remove('hidden');
    
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
    
    const colorRadio = document.querySelector(`input[name="color"][value="${sub.color}"]`);
    if (colorRadio) colorRadio.checked = true;
    
    subscriptionModal.classList.remove('hidden');
}

let pendingDeleteId = null;
function confirmDelete(id) {
    pendingDeleteId = id;
    document.getElementById('confirmTitle').textContent = 'Delete Subscription';
    document.getElementById('confirmMessage').textContent = 'Are you sure you want to delete this subscription?';
    confirmModal.classList.remove('hidden');
}

function openAddModal() {
    editingId = null;
    modalTitle.textContent = 'Add Subscription';
    deleteBtn.classList.add('hidden');
    subscriptionForm.reset();
    document.getElementById('subscriptionId').value = '';
    document.getElementById('currency').value = settings.defaultCurrency;
    document.getElementById('billingCycle').value = 'monthly';
    document.getElementById('status').value = 'active';
    document.getElementById('color1').checked = true;
    
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    document.getElementById('nextBillingDate').value = date.toISOString().split('T')[0];
    
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
    
    if (!sub.name || !sub.price) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    if (editingId) {
        const index = subscriptions.findIndex(s => s.id === editingId);
        if (index !== -1) subscriptions[index] = sub;
        showToast('Updated');
    } else {
        subscriptions.push(sub);
        showToast('Added');
        
        // Show notification permission reminder if not granted
        if (!notificationPermission && 'Notification' in window && Notification.permission === 'default') {
            setTimeout(() => {
                if (confirm('Would you like to receive billing reminders? Notifications will appear on your device when bills are due.')) {
                    requestNotificationPermission().then(() => {
                        if (notificationPermission) {
                            showToast('Notifications enabled!');
                        }
                    });
                }
            }, 1000);
        }
    }
    
    saveData();
    subscriptionModal.classList.add('hidden');
    renderSubscriptions();
    updateSummary();
    
    // Check for upcoming bills after adding
    setTimeout(checkUpcomingBills, 500);
}

function deleteSubscription() {
    if (pendingDeleteId) {
        subscriptions = subscriptions.filter(s => s.id !== pendingDeleteId);
        saveData();
        renderSubscriptions();
        updateSummary();
        showToast('Deleted');
        pendingDeleteId = null;
    }
    confirmModal.classList.add('hidden');
    subscriptionModal.classList.add('hidden');
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = toast.querySelector('i');
    document.getElementById('toastMessage').textContent = msg;
    
    if (type === 'error') {
        icon.className = 'fa-solid fa-exclamation-circle';
        toast.style.background = 'var(--danger)';
    } else {
        icon.className = 'fa-solid fa-check-circle';
        toast.style.background = 'var(--success)';
    }
    
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

function exportData() {
    const data = JSON.stringify({ subscriptions, settings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscriptions.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.subscriptions) subscriptions = data.subscriptions;
            if (data.settings) settings = data.settings;
            saveData();
            saveSettings();
            renderSubscriptions();
            updateSummary();
            showToast('Imported');
        } catch (err) {
            showToast('Invalid file', 'error');
        }
    };
    reader.readAsText(file);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderSubscriptions();
    updateSummary();
    
    document.getElementById('addSubscriptionBtn').addEventListener('click', openAddModal);
    
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('defaultCurrency').value = settings.defaultCurrency;
        settingsModal.classList.remove('hidden');
    });
    
    subscriptionForm.addEventListener('submit', saveSubscription);
    
    document.getElementById('cancelFormBtn').addEventListener('click', () => {
        subscriptionModal.classList.add('hidden');
    });
    
    document.getElementById('closeModalBtn').addEventListener('click', () => {
        subscriptionModal.classList.add('hidden');
    });
    
    deleteBtn.addEventListener('click', () => {
        if (editingId) confirmDelete(editingId);
    });
    
    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
    
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        settings.defaultCurrency = document.getElementById('defaultCurrency').value;
        saveSettings();
        settingsModal.classList.add('hidden');
        renderSubscriptions();
        updateSummary();
        showToast('Settings saved');
    });
    
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    
    document.getElementById('importDataBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    
    document.getElementById('importFileInput').addEventListener('change', (e) => {
        if (e.target.files[0]) importData(e.target.files[0]);
        e.target.value = '';
    });
    
    document.getElementById('clearAllDataBtn').addEventListener('click', () => {
        pendingDeleteId = 'all';
        document.getElementById('confirmTitle').textContent = 'Clear All Data';
        document.getElementById('confirmMessage').textContent = 'Delete all subscriptions?';
        confirmModal.classList.remove('hidden');
    });
    
    document.getElementById('confirmCancelBtn').addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        pendingDeleteId = null;
    });
    
    document.getElementById('confirmOkBtn').addEventListener('click', () => {
        if (pendingDeleteId === 'all') {
            subscriptions = [];
            saveData();
            renderSubscriptions();
            updateSummary();
            showToast('All cleared');
        } else {
            deleteSubscription();
        }
        confirmModal.classList.add('hidden');
    });
    
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderSubscriptions();
        });
    });
    
    searchInput.addEventListener('input', renderSubscriptions);
    
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderSubscriptions();
    });
    
    document.getElementById('sortDirectionBtn').addEventListener('click', () => {
        sortAscending = !sortAscending;
        sortIcon.className = sortAscending ? 'fa-solid fa-arrow-down' : 'fa-solid fa-arrow-up';
        renderSubscriptions();
    });
    
    subscriptionModal.addEventListener('click', (e) => {
        if (e.target === subscriptionModal) subscriptionModal.classList.add('hidden');
    });
    
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
    
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) confirmModal.classList.add('hidden');
    });
});
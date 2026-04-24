// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDd75ps84KlSHaG2iiJB46Nm3IDExOxy5g",
    authDomain: "subscriptiontracker-c2ca3.firebaseapp.com",
    projectId: "subscriptiontracker-c2ca3",
    storageBucket: "subscriptiontracker-c2ca3.firebasestorage.app",
    messagingSenderId: "765974058769",
    appId: "1:765974058769:web:143080d8088fa3244f5eb0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.log('Browser doesn\'t support persistence');
        }
    });

console.log("App starting...");

// Global variables
let subscriptions = [];
let settings = { defaultCurrency: 'USD' };
let currentFilter = 'all';
let currentSort = 'name';
let sortAscending = true;
let editingId = null;
let exchangeRates = {};
let currentUser = null;

// Currency symbols
const symbols = { 
    USD: '$', KES: 'KSh', EUR: '€', GBP: '£',
    NGN: '₦', ZAR: 'R', INR: '₹', CAD: 'C$',
    AUD: 'A$', JPY: '¥'
};

// Category colors (fallback)
const categoryColors = {
    entertainment: '#e94560', music: '#48dbfb', productivity: '#2ecc71',
    cloud: '#FF9A86', fitness: '#a29bfe', gaming: '#FFF0BE',
    education: '#f39c12', news: '#B6F500', shopping: '#e94560',
    food: '#48dbfb', vpn: '#2ecc71', other: '#a29bfe'
};

// Helper function
function getCurrencySymbol(currency) {
    if (currency && symbols[currency]) return symbols[currency];
    return symbols[settings.defaultCurrency] || '$';
}

// ==================== AUTHENTICATION ====================

async function initAuth() {
    console.log("Initializing authentication...");
    
    // Clear any stale user data
    auth.signOut().catch(() => {});
    
    try {
        const userCredential = await auth.signInAnonymously();
        currentUser = userCredential.user.uid;
        localStorage.setItem('userId', currentUser);
        console.log("Authenticated user:", currentUser);
        
        // Set up auth state listener
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                if (currentUser !== user.uid) {
                    currentUser = user.uid;
                    await loadSubscriptions();
                }
            } else {
                // Re-authenticate if signed out
                await initAuth();
            }
        });
        
        await loadSubscriptions();
    } catch (error) {
        console.error("Auth error:", error);
        // Fallback to localStorage only (no cross-user visibility)
        currentUser = 'local_' + Date.now();
        localStorage.setItem('userId', currentUser);
        loadSubscriptionsFromLocal();
    }
}

// ==================== LOAD SUBSCRIPTIONS (USER ISOLATED) ====================

async function loadSubscriptions() {
    console.log("Loading subscriptions for user:", currentUser);
    if (!currentUser || currentUser.startsWith('local_')) {
        loadSubscriptionsFromLocal();
        return;
    }
    
    try {
        // Query only current user's subscriptions
        const snapshot = await db.collection('subscriptions')
            .where('userId', '==', currentUser)
            .get();
        
        subscriptions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            subscriptions.push({ 
                id: doc.id, 
                name: data.name || 'Untitled',
                category: data.category || 'other',
                price: data.price || 0,
                currency: data.currency || 'USD',
                billingCycle: data.billingCycle || 'monthly',
                nextBillingDate: data.nextBillingDate || new Date().toISOString().split('T')[0],
                paymentMethod: data.paymentMethod || 'card',
                notes: data.notes || '',
                status: data.status || 'active',
                color: data.color || categoryColors[data.category] || '#e94560',
                userId: data.userId
            });
        });
        
        console.log(`Loaded ${subscriptions.length} subscriptions for user ${currentUser}`);
        
        // Backup to localStorage for this user only
        localStorage.setItem(`subscriptions_${currentUser}`, JSON.stringify(subscriptions));
        
        renderSubscriptions();
        updateSummary();
    } catch (error) {
        console.error("Error loading from Firestore:", error);
        loadSubscriptionsFromLocal();
    }
}

function loadSubscriptionsFromLocal() {
    console.log("Loading from localStorage for user:", currentUser);
    const saved = localStorage.getItem(`subscriptions_${currentUser}`);
    if (saved) {
        subscriptions = JSON.parse(saved);
        console.log(`Loaded ${subscriptions.length} subscriptions from localStorage`);
    } else {
        subscriptions = [];
        console.log("No saved subscriptions found");
    }
    renderSubscriptions();
    updateSummary();
}

// ==================== SAVE SUBSCRIPTION (WITH USER ID) ====================

async function saveSubscription(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showToast('Please wait, initializing...', 'error');
        return;
    }
    
    const sub = {
        id: editingId || Date.now().toString(),
        userId: currentUser, // Critical: Always set current user ID
        name: document.getElementById('serviceName')?.value.trim() || '',
        category: document.getElementById('category')?.value || 'other',
        price: parseFloat(document.getElementById('price')?.value) || 0,
        currency: document.getElementById('currency')?.value || 'USD',
        billingCycle: document.getElementById('billingCycle')?.value || 'monthly',
        nextBillingDate: document.getElementById('nextBillingDate')?.value || calculateNextBillingDate('monthly'),
        paymentMethod: document.getElementById('paymentMethod')?.value || 'card',
        notes: document.getElementById('notes')?.value.trim() || '',
        status: document.getElementById('status')?.value || 'active',
        color: document.querySelector('input[name="color"]:checked')?.value || '#e94560',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (!sub.name) {
        showToast('Please enter a service name', 'error');
        return;
    }
    
    try {
        if (!currentUser.startsWith('local_')) {
            // Save to Firestore
            await db.collection('subscriptions').doc(sub.id).set(sub);
            console.log("Saved to Firestore successfully!");
        }
        
        // Update local array
        if (editingId) {
            const index = subscriptions.findIndex(s => s.id == editingId);
            if (index !== -1) subscriptions[index] = sub;
        } else {
            subscriptions.push(sub);
        }
        
        // Save to localStorage (user-specific)
        localStorage.setItem(`subscriptions_${currentUser}`, JSON.stringify(subscriptions));
        
        renderSubscriptions();
        updateSummary();
        showToast(editingId ? 'Subscription updated' : 'Subscription added');
        
        // Close modal
        document.getElementById('subscriptionModal').classList.add('hidden');
        document.getElementById('subscriptionForm').reset();
        editingId = null;
        
        // Prompt for notifications on first subscription
        if (subscriptions.length === 1 && !window.notificationPromptShown) {
            gentleNotificationPrompt();
        }
    } catch (error) {
        console.error("Save error:", error);
        showToast('Error saving: ' + error.message, 'error');
    }
}

// ==================== DELETE SUBSCRIPTION ====================

let pendingDeleteId = null;

function confirmDelete(id) {
    pendingDeleteId = id;
    document.getElementById('confirmTitle').textContent = 'Delete';
    document.getElementById('confirmMessage').textContent = 'Delete this subscription?';
    document.getElementById('confirmModal').classList.remove('hidden');
}

async function deleteSubscription() {
    if (pendingDeleteId && pendingDeleteId !== 'all') {
        try {
            if (!currentUser.startsWith('local_')) {
                await db.collection('subscriptions').doc(pendingDeleteId).delete();
                console.log("Deleted from Firestore");
            }
            
            subscriptions = subscriptions.filter(s => s.id != pendingDeleteId);
            localStorage.setItem(`subscriptions_${currentUser}`, JSON.stringify(subscriptions));
            
            renderSubscriptions();
            updateSummary();
            showToast('Subscription deleted');
        } catch (error) {
            console.error("Delete error:", error);
            showToast('Error deleting', 'error');
        }
        pendingDeleteId = null;
    }
    document.getElementById('confirmModal').classList.add('hidden');
}

async function clearAllData() {
    if (!currentUser) return;
    
    try {
        if (!currentUser.startsWith('local_')) {
            const snapshot = await db.collection('subscriptions')
                .where('userId', '==', currentUser)
                .get();
            
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log("Cleared all data from Firestore");
        }
        
        subscriptions = [];
        localStorage.removeItem(`subscriptions_${currentUser}`);
        
        renderSubscriptions();
        updateSummary();
        showToast('All data cleared');
    } catch (error) {
        console.error("Clear all error:", error);
        showToast('Error clearing data', 'error');
    }
}

// ==================== RENDER SUBSCRIPTIONS ====================

function renderSubscriptions() {
    const container = document.getElementById('subscriptionList');
    const emptyState = document.getElementById('emptyState');
    
    if (!container) return;
    
    let filtered = [...subscriptions];
    
    // Apply filters
    if (currentFilter === 'active') {
        filtered = filtered.filter(s => s.status === 'active');
    } else if (currentFilter === 'cancelled') {
        filtered = filtered.filter(s => s.status === 'cancelled');
    } else if (currentFilter === 'expiring') {
        filtered = filtered.filter(s => {
            if (s.status !== 'active') return false;
            const diff = Math.ceil((new Date(s.nextBillingDate) - new Date()) / (1000 * 60 * 60 * 24));
            return diff >= 0 && diff <= 7;
        });
    } else if (currentFilter === 'overdue') {
        filtered = filtered.filter(s => {
            if (s.status !== 'active') return false;
            const diff = Math.ceil((new Date(s.nextBillingDate) - new Date()) / (1000 * 60 * 60 * 24));
            return diff < 0;
        });
    }
    
    // Apply search
    const searchInput = document.getElementById('searchInput');
    const query = searchInput?.value.toLowerCase() || '';
    if (query) {
        filtered = filtered.filter(s => s.name && s.name.toLowerCase().includes(query));
    }
    
    // Apply sort
    filtered.sort((a, b) => {
        let result = 0;
        switch (currentSort) {
            case 'name':
                result = (a.name || '').localeCompare(b.name || '');
                break;
            case 'price':
                result = (a.price || 0) - (b.price || 0);
                break;
            case 'nextBilling':
                result = new Date(a.nextBillingDate) - new Date(b.nextBillingDate);
                break;
            case 'category':
                result = (a.category || '').localeCompare(b.category || '');
                break;
            default:
                result = (a.name || '').localeCompare(b.name || '');
        }
        return sortAscending ? result : -result;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    
    container.innerHTML = filtered.map(sub => {
        let cycleAbbr = 'mo';
        if (sub.billingCycle) {
            if (sub.billingCycle === 'weekly') cycleAbbr = 'wk';
            else if (sub.billingCycle === 'monthly') cycleAbbr = 'mo';
            else if (sub.billingCycle === 'quarterly') cycleAbbr = 'qr';
            else if (sub.billingCycle === 'yearly') cycleAbbr = 'yr';
        }
        
        let formattedDate = 'N/A';
        if (sub.nextBillingDate) {
            try {
                formattedDate = new Date(sub.nextBillingDate).toLocaleDateString();
            } catch(e) {
                formattedDate = sub.nextBillingDate;
            }
        }
        
        const currencySymbol = getCurrencySymbol(sub.currency);
        
        return `
            <div class="subscription-card">
                <div class="card-color" style="background: ${sub.color || '#e94560'};"></div>
                <div class="card-content">
                    <div class="card-header">
                        <div class="card-title">
                            <h3>${escapeHtml(sub.name || 'Unknown')}</h3>
                            <span class="category-badge">${escapeHtml(sub.category || 'other')}</span>
                        </div>
                        <span class="card-price">${currencySymbol} ${sub.price || 0}/${cycleAbbr}</span>
                    </div>
                    <div class="card-details">
                        <div class="card-detail">
                            <i class="fa-regular fa-calendar"></i>
                            <span>${formattedDate}</span>
                        </div>
                        <div class="card-detail">
                            <i class="fa-regular fa-credit-card"></i>
                            <span>${escapeHtml(sub.paymentMethod || 'card')}</span>
                        </div>
                        <span class="status-badge ${sub.status || 'active'}">${sub.status || 'active'}</span>
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn edit-btn" data-id="${sub.id}">Edit</button>
                        <button class="card-action-btn delete-btn" data-id="${sub.id}">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            editSubscription(btn.dataset.id);
        };
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            confirmDelete(btn.dataset.id);
        };
    });
}

function editSubscription(id) {
    const sub = subscriptions.find(s => s.id == id);
    if (!sub) return;
    
    editingId = id;
    document.getElementById('modalTitle').textContent = 'Edit Subscription';
    document.getElementById('deleteSubscriptionBtn').classList.remove('hidden');
    document.getElementById('subscriptionId').value = sub.id;
    document.getElementById('serviceName').value = sub.name;
    document.getElementById('category').value = sub.category;
    document.getElementById('price').value = sub.price;
    document.getElementById('currency').value = sub.currency;
    document.getElementById('billingCycle').value = sub.billingCycle;
    document.getElementById('nextBillingDate').value = sub.nextBillingDate;
    document.getElementById('paymentMethod').value = sub.paymentMethod || 'card';
    document.getElementById('notes').value = sub.notes || '';
    document.getElementById('status').value = sub.status;
    
    const colorRadio = document.querySelector(`input[name="color"][value="${sub.color}"]`);
    if (colorRadio) colorRadio.checked = true;
    
    document.getElementById('subscriptionModal').classList.remove('hidden');
}

function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Add Subscription';
    document.getElementById('deleteSubscriptionBtn').classList.add('hidden');
    document.getElementById('subscriptionForm').reset();
    document.getElementById('subscriptionId').value = '';
    
    const currencySelect = document.getElementById('currency');
    if (currencySelect) currencySelect.value = settings.defaultCurrency;
    
    document.getElementById('billingCycle').value = 'monthly';
    document.getElementById('status').value = 'active';
    document.getElementById('color1').checked = true;
    document.getElementById('nextBillingDate').value = calculateNextBillingDate('monthly');
    
    document.getElementById('subscriptionModal').classList.remove('hidden');
}

// ==================== EXCHANGE RATES & CURRENCY ====================

async function fetchExchangeRates() {
    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        exchangeRates = data.rates;
        console.log("Exchange rates loaded");
    } catch (error) {
        console.error("Failed to fetch exchange rates, using fallback");
        exchangeRates = { USD: 1, KES: 130, EUR: 0.92, GBP: 0.79, NGN: 1500, ZAR: 19, INR: 83, CAD: 1.35, AUD: 1.5, JPY: 150 };
    }
}

function convertCurrency(amount, fromCurrency, toCurrency) {
    if (!fromCurrency || fromCurrency === toCurrency) return amount;
    if (!exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) return amount;
    const toUSD = amount / exchangeRates[fromCurrency];
    const toTarget = toUSD * exchangeRates[toCurrency];
    return toTarget;
}

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

async function updateSummary() {
    const active = subscriptions.filter(s => s.status === 'active');
    
    if (Object.keys(exchangeRates).length === 0) {
        await fetchExchangeRates();
    }
    
    let monthlyTotal = 0;
    let yearlyTotal = 0;
    
    active.forEach(sub => {
        let monthlyPrice = sub.price;
        let yearlyPrice = sub.price;
        
        switch (sub.billingCycle) {
            case 'weekly':
                monthlyPrice = sub.price * 4.33;
                yearlyPrice = sub.price * 52;
                break;
            case 'monthly':
                monthlyPrice = sub.price;
                yearlyPrice = sub.price * 12;
                break;
            case 'quarterly':
                monthlyPrice = sub.price / 3;
                yearlyPrice = sub.price * 4;
                break;
            case 'yearly':
                monthlyPrice = sub.price / 12;
                yearlyPrice = sub.price;
                break;
        }
        
        const convertedMonthly = convertCurrency(monthlyPrice, sub.currency, settings.defaultCurrency);
        const convertedYearly = convertCurrency(yearlyPrice, sub.currency, settings.defaultCurrency);
        
        monthlyTotal += convertedMonthly;
        yearlyTotal += convertedYearly;
    });
    
    const defaultSym = getCurrencySymbol(settings.defaultCurrency);
    
    const monthlyTotalEl = document.getElementById('monthlyTotal');
    const yearlyTotalEl = document.getElementById('yearlyTotal');
    const activeCountEl = document.getElementById('activeCount');
    
    if (monthlyTotalEl) monthlyTotalEl.textContent = `${defaultSym} ${monthlyTotal.toFixed(2)}`;
    if (yearlyTotalEl) yearlyTotalEl.textContent = `${defaultSym} ${yearlyTotal.toFixed(2)}`;
    if (activeCountEl) activeCountEl.textContent = active.length;
}

// ==================== AUTO DETECT CURRENCY ====================

async function autoDetectCurrency() {
    const hasManuallySet = localStorage.getItem('currencyManuallySet');
    if (hasManuallySet) {
        console.log("Using manually set currency:", settings.defaultCurrency);
        return;
    }
    
    try {
        console.log("Auto-detecting location...");
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const countryCode = data.country_code;
        
        const countryCurrencyMap = {
            'KE': 'KES', 'US': 'USD', 'GB': 'GBP', 'DE': 'EUR', 'FR': 'EUR',
            'IT': 'EUR', 'ES': 'EUR', 'NG': 'NGN', 'ZA': 'ZAR', 'IN': 'INR',
            'CA': 'CAD', 'AU': 'AUD', 'JP': 'JPY'
        };
        
        const detectedCurrency = countryCurrencyMap[countryCode];
        
        if (detectedCurrency && detectedCurrency !== settings.defaultCurrency) {
            console.log(`Auto-detected currency: ${detectedCurrency}`);
            settings.defaultCurrency = detectedCurrency;
            localStorage.setItem('subscriptionSettings', JSON.stringify(settings));
            
            const defaultCurrencySelect = document.getElementById('defaultCurrency');
            if (defaultCurrencySelect) defaultCurrencySelect.value = detectedCurrency;
        }
    } catch (error) {
        console.log("Auto-detection failed, keeping default USD");
    }
}

// ==================== NOTIFICATIONS ====================

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log("This browser does not support notifications");
        return false;
    }
    
    if (Notification.permission === 'granted') {
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    return false;
}

function showNotification(title, body, tag = 'subscription') {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    
    try {
        new Notification(title, {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            tag: tag,
            requireInteraction: true
        });
    } catch (error) {
        console.error("Notification error:", error);
    }
}

function checkUpcomingBills() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    
    activeSubscriptions.forEach(sub => {
        if (!sub.nextBillingDate) return;
        
        const billDate = new Date(sub.nextBillingDate);
        billDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((billDate - today) / (1000 * 60 * 60 * 24));
        
        const lastNotified = localStorage.getItem(`notified_${currentUser}_${sub.id}_${sub.nextBillingDate}`);
        
        const shouldNotify = (
            (daysUntil === 7 && !lastNotified) ||
            (daysUntil === 3 && !lastNotified) ||
            (daysUntil === 1 && !lastNotified) ||
            (daysUntil === 0 && !lastNotified)
        );
        
        if (shouldNotify) {
            const currencySymbol = getCurrencySymbol(sub.currency);
            let title = '', body = '';
            
            if (daysUntil === 0) {
                title = 'Due Today';
                body = `${sub.name} bills today for ${currencySymbol}${sub.price}`;
            } else if (daysUntil === 1) {
                title = 'Due Tomorrow';
                body = `${sub.name} bills tomorrow for ${currencySymbol}${sub.price}`;
            } else if (daysUntil === 3) {
                title = 'Upcoming Bill';
                body = `${sub.name} bills in 3 days for ${currencySymbol}${sub.price}`;
            } else if (daysUntil === 7) {
                title = 'Bill Reminder';
                body = `${sub.name} bills in 1 week for ${currencySymbol}${sub.price}`;
            }
            
            if (title) {
                showNotification(title, body, sub.id);
                localStorage.setItem(`notified_${currentUser}_${sub.id}_${sub.nextBillingDate}`, 'true');
            }
        }
    });
}

function startNotificationChecker() {
    setTimeout(() => checkUpcomingBills(), 5000);
    setInterval(() => checkUpcomingBills(), 60 * 60 * 1000);
}

let notificationPromptShown = false;

function gentleNotificationPrompt() {
    if (notificationPromptShown) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    
    notificationPromptShown = true;
    
    setTimeout(() => {
        const enableNotifications = confirm('Get reminders?\n\nReceive notifications when your subscriptions are about to bill.');
        if (enableNotifications) {
            requestNotificationPermission();
        }
    }, 3000);
}

// ==================== HELPER FUNCTIONS ====================

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    document.getElementById('toastMessage').textContent = msg;
    const icon = toast.querySelector('i');
    if (icon) {
        icon.className = type === 'error' ? 'fa-solid fa-exclamation-circle' : 'fa-solid fa-check-circle';
    }
    toast.style.background = type === 'error' ? '#ef4444' : '#10b981';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function exportData() {
    const dataToExport = {
        subscriptions: subscriptions,
        settings: settings,
        exportDate: new Date().toISOString()
    };
    const data = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported');
}

async function importData(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.subscriptions && Array.isArray(data.subscriptions)) {
                for (const sub of data.subscriptions) {
                    const id = sub.id || Date.now().toString() + Math.random();
                    sub.userId = currentUser;
                    sub.id = id;
                    
                    if (!currentUser.startsWith('local_')) {
                        await db.collection('subscriptions').doc(id).set(sub);
                    }
                }
                await loadSubscriptions();
                showToast('Data imported successfully');
            } else {
                showToast('Invalid file format', 'error');
            }
        } catch (error) {
            console.error("Import error:", error);
            showToast('Invalid file', 'error');
        }
    };
    reader.readAsText(file);
}

// ==================== INITIALIZE APP ====================

document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM ready, initializing app...");
    
    // Setup event listeners
    document.getElementById('addSubscriptionBtn').onclick = () => openAddModal();
    document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsModal').classList.remove('hidden');
    document.getElementById('closeSettingsBtn').onclick = () => document.getElementById('settingsModal').classList.add('hidden');
    document.getElementById('cancelFormBtn').onclick = () => {
        document.getElementById('subscriptionModal').classList.add('hidden');
        editingId = null;
    };
    document.getElementById('closeModalBtn').onclick = () => {
        document.getElementById('subscriptionModal').classList.add('hidden');
        editingId = null;
    };
    document.getElementById('deleteSubscriptionBtn').onclick = () => { 
        if (editingId) confirmDelete(editingId); 
    };
    document.getElementById('subscriptionForm').onsubmit = saveSubscription;
    document.getElementById('exportDataBtn').onclick = exportData;
    document.getElementById('importDataBtn').onclick = () => document.getElementById('importFileInput').click();
    document.getElementById('importFileInput').onchange = (e) => { 
        if (e.target.files[0]) importData(e.target.files[0]); 
        e.target.value = ''; 
    };
    
    document.getElementById('saveSettingsBtn').onclick = () => {
        settings.defaultCurrency = document.getElementById('defaultCurrency').value;
        localStorage.setItem('subscriptionSettings', JSON.stringify(settings));
        localStorage.setItem('currencyManuallySet', 'true');
        document.getElementById('settingsModal').classList.add('hidden');
        renderSubscriptions();
        updateSummary();
        showToast('Settings saved');
    };
    
    document.getElementById('clearAllDataBtn').onclick = () => {
        pendingDeleteId = 'all';
        document.getElementById('confirmTitle').textContent = 'Clear All Data';
        document.getElementById('confirmMessage').textContent = 'Delete ALL subscriptions? This cannot be undone.';
        document.getElementById('confirmModal').classList.remove('hidden');
    };
    
    document.getElementById('confirmCancelBtn').onclick = () => {
        document.getElementById('confirmModal').classList.add('hidden');
        pendingDeleteId = null;
    };
    
    document.getElementById('confirmOkBtn').onclick = async () => {
        if (pendingDeleteId === 'all') {
            await clearAllData();
        } else if (pendingDeleteId) {
            await deleteSubscription();
        }
        document.getElementById('confirmModal').classList.add('hidden');
    };
    
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderSubscriptions();
        };
    });
    
    // Search and sort
    document.getElementById('searchInput').oninput = () => renderSubscriptions();
    document.getElementById('sortSelect').onchange = (e) => { 
        currentSort = e.target.value; 
        renderSubscriptions(); 
    };
    document.getElementById('sortDirectionBtn').onclick = () => {
        sortAscending = !sortAscending;
        const sortIcon = document.getElementById('sortIcon');
        if (sortIcon) sortIcon.className = sortAscending ? 'fa-solid fa-arrow-down' : 'fa-solid fa-arrow-up';
        renderSubscriptions();
    };
    
    // Auto-calculate next billing date
    const billingCycleSelect = document.getElementById('billingCycle');
    if (billingCycleSelect) {
        billingCycleSelect.onchange = () => {
            document.getElementById('nextBillingDate').value = calculateNextBillingDate(billingCycleSelect.value);
        };
    }
    
    // Initialize data
    await fetchExchangeRates();
    await autoDetectCurrency();
    
    // Load saved settings
    const savedSettings = localStorage.getItem('subscriptionSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        const defaultCurrencySelect = document.getElementById('defaultCurrency');
        if (defaultCurrencySelect) defaultCurrencySelect.value = settings.defaultCurrency;
    }
    
    // Initialize auth and load data
    await initAuth();
    
    // Start notification checker
    startNotificationChecker();
    
    // Add a small delay to ensure everything is loaded
    setTimeout(() => {
        if (subscriptions.length > 0) {
            checkUpcomingBills();
        }
    }, 2000);
    
    console.log("App ready! User ID:", currentUser);
});

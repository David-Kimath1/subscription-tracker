// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDd75ps84KlSHaG2iiJB46Nm3IDExOxy5g",
    authDomain: "subscriptiontracker-c2ca3.firebaseapp.com",
    projectId: "subscriptiontracker-c2ca3",
    storageBucket: "subscriptiontracker-c2ca3.firebasestorage.app",
    messagingSenderId: "765974058769",
    appId: "1:765974058769:web:143080d8088fa3244f5eb0"
};

// ==================== FIREBASE CLOUD MESSAGING ====================

let messaging = null;
let fcmToken = null;
let notificationPermission = false;

// Initialize FCM
async function initFCM() {
    // Check if FCM is supported
    if (!firebase.messaging) {
        console.log("FCM not supported");
        return false;
    }
    
    try {
        messaging = firebase.messaging();
        
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log("Notification permission denied");
            return false;
        }
        
        // Get FCM token
        const vapidKey = 'BGeqRVK-623afQv9trzUtnt72YMLJfbGXgWFbxfj7YqPWrfg92eiKmO9WQQt1PEsc4k3itY5kkImHBsQpXtLoec';
        
        fcmToken = await messaging.getToken({
            vapidKey: vapidKey
        });
        
        if (fcmToken) {
            console.log("FCM Token:", fcmToken);
            notificationPermission = true;
            
            // Save token to Firestore
            await saveFCMToken(fcmToken);
            
            // Listen for foreground messages
            messaging.onMessage((payload) => {
                console.log("Foreground message:", payload);
                showNotificationFromFCM(payload);
            });
            
            return true;
        } else {
            console.log("No FCM token");
            return false;
        }
    } catch (error) {
        console.error("FCM initialization error:", error);
        return false;
    }
}

// Save FCM token to Firestore
async function saveFCMToken(token) {
    try {
        await db.collection('fcm_tokens').doc(token).set({
            token: token,
            createdAt: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
    } catch (error) {
        console.error("Error saving FCM token:", error);
    }
}

// Show notification from FCM (foreground)
function showNotificationFromFCM(payload) {
    const title = payload.notification?.title || 'Subscription Reminder';
    const body = payload.notification?.body || '';
    
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const icon = toast?.querySelector('i');
    
    if (toast && toastMessage) {
        toastMessage.textContent = `🔔 ${body}`;
        if (icon) icon.className = 'fa-solid fa-bell';
        toast.style.background = '#3b82f6';
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 5000);
    }
    
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            requireInteraction: true
        });
    }
}

// Check for upcoming bills and send FCM notifications
async function checkUpcomingBillsFCM() {
    if (!notificationPermission) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    
    for (const sub of activeSubscriptions) {
        if (!sub.nextBillingDate) continue;
        
        const billDate = new Date(sub.nextBillingDate);
        billDate.setHours(0, 0, 0, 0);
        
        const daysUntil = Math.ceil((billDate - today) / (1000 * 60 * 60 * 24));
        
        const notifiedKey = `fcm_notified_${sub.id}_${sub.nextBillingDate}`;
        const alreadyNotified = localStorage.getItem(notifiedKey);
        
        const shouldNotify = (
            (daysUntil === 7 && !alreadyNotified) ||
            (daysUntil === 3 && !alreadyNotified) ||
            (daysUntil === 1 && !alreadyNotified) ||
            (daysUntil === 0 && !alreadyNotified)
        );
        
        if (shouldNotify) {
            const currencySymbol = getCurrencySymbol(sub.currency);
            let title = '';
            let body = '';
            
            if (daysUntil === 0) {
                title = '💰 Subscription Due Today!';
                body = `${sub.name} bills today for ${currencySymbol}${sub.price}`;
            } else if (daysUntil === 1) {
                title = '⏰ Subscription Due Tomorrow!';
                body = `${sub.name} bills tomorrow for ${currencySymbol}${sub.price}`;
            } else if (daysUntil === 3) {
                title = '📅 Subscription Bill Reminder';
                body = `${sub.name} bills in 3 days for ${currencySymbol}${sub.price}`;
            } else if (daysUntil === 7) {
                title = '📅 Subscription Bill Reminder';
                body = `${sub.name} bills in 1 week for ${currencySymbol}${sub.price}`;
            }
            
            if (title) {
                new Notification(title, {
                    body: body,
                    icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
                    tag: sub.id,
                    requireInteraction: true
                });
                
                localStorage.setItem(notifiedKey, 'true');
            }
        }
    }
}

// ============ SINGLE NOTIFICATION CONTROL IN SETTINGS (NO HEADER BELL) ============
function addNotificationToSettings() {
    console.log("Adding notification section to Settings modal...");
    
    // Wait a bit for the modal to be ready
    setTimeout(() => {
        const settingsBody = document.querySelector('#settingsModal .modal-body');
        if (!settingsBody) {
            console.log("Settings modal body not found, retrying...");
            setTimeout(() => addNotificationToSettings(), 500);
            return;
        }
        
        // Check if already added
        if (document.getElementById('settingsNotificationSection')) {
            console.log("Notification section already exists");
            return;
        }
        
        // Create notification section
        const notificationSection = document.createElement('div');
        notificationSection.id = 'settingsNotificationSection';
        notificationSection.className = 'settings-section';
        notificationSection.innerHTML = `
            <h3><i class="fa-solid fa-bell"></i> Push Notifications</h3>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
                <div style="flex: 1;">
                    <strong>Bill Reminders</strong>
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Get notified before your subscriptions renew (7d, 3d, 1d, and due today)</p>
                </div>
                <button id="notificationToggleBtn" class="btn secondary" style="min-width: 100px;">
                    <i class="fa-regular fa-bell"></i> Enable
                </button>
            </div>
            <div id="notificationStatus" style="font-size: 12px; padding: 8px; border-radius: 8px; margin-top: 8px;">
                <i class="fa-regular fa-circle-info"></i> Notifications are disabled
            </div>
        `;
        
        // Find where to insert (after Data Management section)
        const dataManagementSection = settingsBody.querySelector('.settings-section');
        if (dataManagementSection) {
            dataManagementSection.insertAdjacentElement('afterend', notificationSection);
        } else {
            settingsBody.insertBefore(notificationSection, settingsBody.firstChild);
        }
        
        // Setup toggle button
        const toggleBtn = document.getElementById('notificationToggleBtn');
        const statusDiv = document.getElementById('notificationStatus');
        
        function updateNotificationUI() {
            if (Notification.permission === 'granted') {
                toggleBtn.innerHTML = '<i class="fa-solid fa-bell" style="color: #10b981;"></i> Enabled';
                toggleBtn.style.background = '#10b98120';
                toggleBtn.style.borderColor = '#10b981';
                toggleBtn.style.color = '#10b981';
                statusDiv.innerHTML = '<i class="fa-solid fa-check-circle" style="color: #10b981;"></i> ✅ Notifications are active. You will receive bill reminders.';
                statusDiv.style.background = '#10b98110';
            } else if (Notification.permission === 'denied') {
                toggleBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Blocked';
                toggleBtn.disabled = true;
                statusDiv.innerHTML = '<i class="fa-solid fa-exclamation-triangle" style="color: #ef4444;"></i> ❌ Notifications are blocked. Please enable in browser settings.';
                statusDiv.style.background = '#ef444410';
            } else {
                toggleBtn.innerHTML = '<i class="fa-regular fa-bell"></i> Enable';
                toggleBtn.style.background = '';
                toggleBtn.style.borderColor = '';
                toggleBtn.style.color = '';
                statusDiv.innerHTML = '<i class="fa-regular fa-circle-info"></i> 🔔 Click "Enable" to allow notifications for bill reminders.';
                statusDiv.style.background = '';
            }
        }
        
        toggleBtn.onclick = async () => {
            if (Notification.permission === 'granted') {
                showToast('Notifications are already enabled!', 'success');
                return;
            }
            
            toggleBtn.disabled = true;
            toggleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Requesting...';
            
            const granted = await requestNotificationPermission();
            
            if (granted) {
                updateNotificationUI();
                showToast('✅ Notifications enabled! You will receive bill reminders.', 'success');
                checkUpcomingBills();
                if (typeof initFCM === 'function') {
                    initFCM();
                }
            } else {
                updateNotificationUI();
                showToast('❌ Notification permission denied. Please check browser settings.', 'error');
            }
            
            toggleBtn.disabled = false;
        };
        
        updateNotificationUI();
        console.log("Notification section added to Settings!");
    }, 100);
}

// Gentle prompt for notifications (appears after adding first subscription)
let fcmPromptShown = false;

function gentleFCMNotificationPrompt() {
    if (fcmPromptShown) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    
    fcmPromptShown = true;
    
    setTimeout(() => {
        const enableNotifications = confirm('🔔 Get push notifications?\n\nReceive reminders when your subscriptions are about to bill.\n\nWorks even when the browser is closed!');
        
        if (enableNotifications) {
            initFCM().then(success => {
                if (success) {
                    showToast('✅ Notifications enabled!', 'success');
                    checkUpcomingBillsFCM();
                }
            });
        }
    }, 3000);
}

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log("App starting...");

// Global variables
let subscriptions = [];
let settings = { defaultCurrency: 'USD' };
let currentFilter = 'all';
let currentSort = 'name';
let sortAscending = true;
let editingId = null;
let exchangeRates = {};

// Currency symbols
const symbols = { 
    USD: '$', KES: 'KSh', EUR: '€', GBP: '£',
    NGN: '₦', ZAR: 'R', INR: '₹', CAD: 'C$',
    AUD: 'A$', JPY: '¥'
};

// Category colors
const categoryColors = {
    entertainment: '#e94560', music: '#48dbfb', productivity: '#2ecc71',
    cloud: '#FF9A86', fitness: '#a29bfe', gaming: '#FFF0BE',
    education: '#f39c12', news: '#B6F500', shopping: '#e94560',
    food: '#48dbfb', vpn: '#2ecc71', other: '#a29bfe'
};

// Helper function to get currency symbol
function getCurrencySymbol(currency) {
    if (currency && symbols[currency]) return symbols[currency];
    return symbols[settings.defaultCurrency] || '$';
}

// Auto-detect user's currency based on location (silent)
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
            
            localStorage.setItem('currencyAutoDetected', 'true');
        }
    } catch (error) {
        console.log("Auto-detection failed, keeping default USD");
    }
}

// ==================== PUSH NOTIFICATIONS ====================

// Request permission for notifications
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log("This browser does not support notifications");
        return false;
    }
    
    if (Notification.permission === 'granted') {
        console.log("Notification permission already granted");
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log("Notification permission granted");
            return true;
        }
    }
    
    console.log("Notification permission denied");
    return false;
}

// Show a notification
function showNotification(title, body, tag = 'subscription') {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    
    try {
        const notification = new Notification(title, {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            tag: tag,
            vibrate: [200, 100, 200],
            requireInteraction: true
        });
        
        setTimeout(() => notification.close(), 10000);
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
    } catch (error) {
        console.error("Notification error:", error);
    }
}

// Check for upcoming bills and send notifications
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
        
        const lastNotified = localStorage.getItem(`notified_${sub.id}_${sub.nextBillingDate}`);
        
        const shouldNotify = (
            (daysUntil === 7 && !lastNotified) ||
            (daysUntil === 3 && !lastNotified) ||
            (daysUntil === 1 && !lastNotified) ||
            (daysUntil === 0 && !lastNotified)
        );
        
        if (shouldNotify) {
            const currencySymbol = getCurrencySymbol(sub.currency);
            let title = '';
            let body = '';
            
            if (daysUntil === 0) {
                title = '💰 Due Today!';
                body = `${sub.name} bills today for ${currencySymbol}${sub.price}`;
            } else if (daysUntil === 1) {
                title = '⏰ Due Tomorrow!';
                body = `${sub.name} bills tomorrow for ${currencySymbol}${sub.price}`;
            } else if (daysUntil === 3) {
                title = '📅 Upcoming Bill';
                body = `${sub.name} bills in 3 days for ${currencySymbol}${sub.price}`;
            } else if (daysUntil === 7) {
                title = '📅 Bill Reminder';
                body = `${sub.name} bills in 1 week for ${currencySymbol}${sub.price}`;
            }
            
            if (title) {
                showNotification(title, body, sub.id);
                localStorage.setItem(`notified_${sub.id}_${sub.nextBillingDate}`, 'true');
            }
        }
    });
}

// Start notification checker (runs every hour)
let notificationInterval = null;

function startNotificationChecker() {
    setTimeout(() => {
        checkUpcomingBills();
    }, 5000);
    
    if (notificationInterval) clearInterval(notificationInterval);
    notificationInterval = setInterval(() => {
        checkUpcomingBills();
    }, 60 * 60 * 1000);
}

// Auto-request permission gently
let notificationPromptShown = false;

function gentleNotificationPrompt() {
    if (notificationPromptShown) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    
    notificationPromptShown = true;
    
    setTimeout(() => {
        const enableNotifications = confirm('📢 Would you like to receive bill reminders?\n\nGet notified before your subscriptions renew.');
        
        if (enableNotifications) {
            requestNotificationPermission().then(granted => {
                if (granted) {
                    showToast('Notifications enabled! You will receive bill reminders.', 'success');
                    checkUpcomingBills();
                }
            });
        }
    }, 2000);
}

// Fetch real exchange rates
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

// Convert currency using real exchange rates
function convertCurrency(amount, fromCurrency, toCurrency) {
    if (!fromCurrency || fromCurrency === toCurrency) return amount;
    if (!exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) return amount;
    
    const toUSD = amount / exchangeRates[fromCurrency];
    const toTarget = toUSD * exchangeRates[toCurrency];
    return toTarget;
}

// Calculate next billing date
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

// Update summary with accurate currency conversion
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
            default:
                monthlyPrice = sub.price;
                yearlyPrice = sub.price * 12;
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
    
    if (monthlyTotalEl) monthlyTotalEl.textContent = `${defaultSym} ${Math.round(monthlyTotal)}`;
    if (yearlyTotalEl) yearlyTotalEl.textContent = `${defaultSym} ${Math.round(yearlyTotal)}`;
    if (activeCountEl) activeCountEl.textContent = active.length;
}

// Render subscriptions
function renderSubscriptions() {
    const container = document.getElementById('subscriptionList');
    const emptyState = document.getElementById('emptyState');
    
    if (!container) return;
    
    let filtered = [...subscriptions];
    
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
    
    const searchInput = document.getElementById('searchInput');
    const query = searchInput?.value.toLowerCase() || '';
    if (query) {
        filtered = filtered.filter(s => s.name && s.name.toLowerCase().includes(query));
    }
    
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
                            <span>${sub.paymentMethod || 'card'}</span>
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

async function loadSubscriptions() {
    console.log("Loading subscriptions...");
    try {
        const snapshot = await db.collection('subscriptions').get();
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
                color: data.color || categoryColors[data.category] || '#e94560'
            });
        });
        console.log(`Loaded ${subscriptions.length} subscriptions`);
        renderSubscriptions();
        updateSummary();
    } catch (error) {
        console.error("Error loading:", error);
        const saved = localStorage.getItem('subscriptions');
        if (saved) {
            subscriptions = JSON.parse(saved);
            renderSubscriptions();
            updateSummary();
        }
    }
}

async function saveSubscription(e) {
    e.preventDefault();
    
    const sub = {
        id: editingId || Date.now().toString(),
        name: document.getElementById('serviceName')?.value.trim() || '',
        category: document.getElementById('category')?.value || 'other',
        price: parseFloat(document.getElementById('price')?.value) || 0,
        currency: document.getElementById('currency')?.value || 'USD',
        billingCycle: document.getElementById('billingCycle')?.value || 'monthly',
        nextBillingDate: document.getElementById('nextBillingDate')?.value || calculateNextBillingDate('monthly'),
        paymentMethod: document.getElementById('paymentMethod')?.value || 'card',
        notes: document.getElementById('notes')?.value.trim() || '',
        status: document.getElementById('status')?.value || 'active',
        color: document.querySelector('input[name="color"]:checked')?.value || '#e94560'
    };
    
    if (!sub.name || sub.price === 0) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    try {
        await db.collection('subscriptions').doc(sub.id).set(sub);
        
        if (editingId) {
            const index = subscriptions.findIndex(s => s.id == editingId);
            if (index !== -1) subscriptions[index] = sub;
        } else {
            subscriptions.push(sub);
        }
        
        renderSubscriptions();
        updateSummary();
        localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
        showToast(editingId ? 'Subscription updated!' : 'Subscription added!');
        document.getElementById('subscriptionModal').classList.add('hidden');
    } catch (error) {
        console.error("Save error:", error);
        showToast('Error saving', 'error');
    }

    if (subscriptions.length === 1 && !fcmPromptShown) {
        gentleFCMNotificationPrompt();
    }
}

let pendingDeleteId = null;

function confirmDelete(id) {
    pendingDeleteId = id;
    document.getElementById('confirmTitle').textContent = 'Delete';
    document.getElementById('confirmMessage').textContent = 'Delete this subscription?';
    document.getElementById('confirmModal').classList.remove('hidden');
}

async function deleteSubscription() {
    if (pendingDeleteId) {
        try {
            await db.collection('subscriptions').doc(pendingDeleteId).delete();
            subscriptions = subscriptions.filter(s => s.id != pendingDeleteId);
            renderSubscriptions();
            updateSummary();
            showToast('Subscription deleted');
        } catch (error) {
            console.error("Delete error:", error);
            showToast('Error deleting', 'error');
        }
        pendingDeleteId = null;
    }
}

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
    const data = JSON.stringify({ subscriptions, settings }, null, 2);
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
                    const id = sub.id || Date.now().toString();
                    await db.collection('subscriptions').doc(id).set({...sub, id: id});
                }
                await loadSubscriptions();
                showToast('Data imported successfully');
            }
        } catch (error) {
            console.error("Import error:", error);
            showToast('Invalid file format', 'error');
        }
    };
    reader.readAsText(file);
}

// ==================== TESTING MODE ====================

function testNotificationSystem() {
    console.log("=== TESTING NOTIFICATIONS ===");
    
    if (!('Notification' in window)) {
        showToast('❌ Your browser does not support notifications', 'error');
        return;
    }
    
    if (Notification.permission !== 'granted') {
        showToast('⚠️ Please enable notifications first (Settings → Notifications)', 'error');
        return;
    }
    
    new Notification('🔔 Test Notification', {
        body: 'If you see this, notifications are working!',
        icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
        requireInteraction: true
    });
    
    if (subscriptions.length === 0) {
        showToast('📝 Add a subscription first, then test again', 'error');
        return;
    }
    
    const testSub = subscriptions[0];
    const currencySymbol = getCurrencySymbol(testSub.currency);
    
    setTimeout(() => {
        new Notification('📅 [TEST] 7-Day Reminder', {
            body: `[TEST] ${testSub.name} would bill in 7 days for ${currencySymbol}${testSub.price}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            tag: 'test_notification',
            requireInteraction: true
        });
    }, 1000);
    
    setTimeout(() => {
        new Notification('📅 [TEST] 3-Day Reminder', {
            body: `[TEST] ${testSub.name} would bill in 3 days for ${currencySymbol}${testSub.price}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            tag: 'test_notification',
            requireInteraction: true
        });
    }, 2000);
    
    setTimeout(() => {
        new Notification('⏰ [TEST] Tomorrow Reminder', {
            body: `[TEST] ${testSub.name} would bill tomorrow for ${currencySymbol}${testSub.price}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            tag: 'test_notification',
            requireInteraction: true
        });
    }, 3000);
    
    setTimeout(() => {
        new Notification('💰 [TEST] Due Today', {
            body: `[TEST] ${testSub.name} would bill today for ${currencySymbol}${testSub.price}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            tag: 'test_notification',
            requireInteraction: true
        });
    }, 4000);
    
    showToast('🔔 Test notifications sent! Check your screen.', 'success');
}

// Keyboard shortcut: Press T 3 times to test
let testKeyCount = 0;
let testKeyTimeout;

document.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
        clearTimeout(testKeyTimeout);
        testKeyCount++;
        
        if (testKeyCount === 3) {
            testNotificationSystem();
            testKeyCount = 0;
        }
        
        testKeyTimeout = setTimeout(() => {
            testKeyCount = 0;
        }, 1000);
    }
});

// TEST: Set a subscription to due tomorrow (press D 3 times)
async function setTestDueDate() {
    if (subscriptions.length === 0) {
        showToast('Add a subscription first', 'error');
        return;
    }
    
    const testSub = subscriptions[0];
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const updatedSub = { ...testSub, nextBillingDate: tomorrowStr };
    
    try {
        await db.collection('subscriptions').doc(testSub.id).set(updatedSub);
        
        const index = subscriptions.findIndex(s => s.id === testSub.id);
        if (index !== -1) subscriptions[index] = updatedSub;
        
        renderSubscriptions();
        updateSummary();
        
        showToast(`✅ ${testSub.name} due date set to TOMORROW for testing!`, 'success');
        
        setTimeout(() => {
            checkUpcomingBillsFCM();
        }, 1000);
        
    } catch (error) {
        console.error("Error setting test date:", error);
        showToast('Error setting test date', 'error');
    }
}

let dateKeyCount = 0;
let dateKeyTimeout;

document.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
        clearTimeout(dateKeyTimeout);
        dateKeyCount++;
        
        if (dateKeyCount === 3) {
            setTestDueDate();
            dateKeyCount = 0;
        }
        
        dateKeyTimeout = setTimeout(() => {
            dateKeyCount = 0;
        }, 1000);
    }
});

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM ready, initializing app...");
    
    // Setup event listeners
    document.getElementById('addSubscriptionBtn').onclick = () => openAddModal();
    document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsModal').classList.remove('hidden');
    document.getElementById('closeSettingsBtn').onclick = () => document.getElementById('settingsModal').classList.add('hidden');
    document.getElementById('cancelFormBtn').onclick = () => document.getElementById('subscriptionModal').classList.add('hidden');
    document.getElementById('closeModalBtn').onclick = () => document.getElementById('subscriptionModal').classList.add('hidden');
    document.getElementById('deleteSubscriptionBtn').onclick = () => { if (editingId) confirmDelete(editingId); };
    document.getElementById('subscriptionForm').onsubmit = saveSubscription;
    document.getElementById('exportDataBtn').onclick = exportData;
    document.getElementById('importDataBtn').onclick = () => document.getElementById('importFileInput').click();
    document.getElementById('importFileInput').onchange = (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; };
    
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
        document.getElementById('confirmMessage').textContent = 'Delete ALL subscriptions?';
        document.getElementById('confirmModal').classList.remove('hidden');
    };
    
    document.getElementById('confirmCancelBtn').onclick = () => {
        document.getElementById('confirmModal').classList.add('hidden');
        pendingDeleteId = null;
    };
    
    document.getElementById('confirmOkBtn').onclick = async () => {
        if (pendingDeleteId === 'all') {
            for (const sub of subscriptions) {
                await db.collection('subscriptions').doc(sub.id).delete();
            }
            subscriptions = [];
            renderSubscriptions();
            updateSummary();
            showToast('All data cleared');
        } else if (pendingDeleteId) {
            await deleteSubscription();
        }
        document.getElementById('confirmModal').classList.add('hidden');
    };
    
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderSubscriptions();
        };
    });
    
    document.getElementById('searchInput').oninput = () => renderSubscriptions();
    document.getElementById('sortSelect').onchange = (e) => { currentSort = e.target.value; renderSubscriptions(); };
    document.getElementById('sortDirectionBtn').onclick = () => {
        sortAscending = !sortAscending;
        const sortIcon = document.getElementById('sortIcon');
        if (sortIcon) sortIcon.className = sortAscending ? 'fa-solid fa-arrow-down' : 'fa-solid fa-arrow-up';
        renderSubscriptions();
    };
    document.getElementById('billingCycle').onchange = () => {
        document.getElementById('nextBillingDate').value = calculateNextBillingDate(document.getElementById('billingCycle').value);
    };

    // Start FCM notification checker (every hour)
    setInterval(() => {
        if (Notification.permission === 'granted') {
            checkUpcomingBillsFCM();
        }
    }, 60 * 60 * 1000);
    
    // Add notification toggle to Settings modal (NO header bell)
    addNotificationToSettings();
    
    // Start regular notification checker
    startNotificationChecker();
    
    // Initialize data
    await fetchExchangeRates();
    await autoDetectCurrency();
    await loadSubscriptions();
    
    const savedSettings = localStorage.getItem('subscriptionSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        const defaultCurrencySelect = document.getElementById('defaultCurrency');
        if (defaultCurrencySelect) defaultCurrencySelect.value = settings.defaultCurrency;
    }
    
    console.log("App ready!");
});
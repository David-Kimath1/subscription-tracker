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
const messaging = firebase.messaging();

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => console.error("Persistence error:", error));

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
let fcmToken = null;
let notificationPermissionGranted = false;
let pendingDeleteId = null;
let pendingSignOut = false;

const VAPID_KEY = 'BGeqRVK-623afQv9trzUtnt72YMLJfbGXgWFbxfj7YqPWrfg92eiKmO9WQQt1PEsc4k3itY5kkImHBsQpXtLoec';

const symbols = { 
    USD: '$', KES: 'KSh', EUR: '€', GBP: '£',
    NGN: '₦', ZAR: 'R', INR: '₹', CAD: 'C$',
    AUD: 'A$', JPY: '¥'
};

const categoryColors = {
    entertainment: '#e94560', music: '#48dbfb', productivity: '#2ecc71',
    cloud: '#FF9A86', fitness: '#a29bfe', gaming: '#FFF0BE',
    education: '#f39c12', news: '#B6F500', shopping: '#e94560',
    food: '#48dbfb', vpn: '#2ecc71', other: '#a29bfe'
};

function getCurrencySymbol(currency) {
    if (currency && symbols[currency]) return symbols[currency];
    return symbols[settings.defaultCurrency] || '$';
}

// ==================== AUTHENTICATION UI ====================

function showAuthUI() {
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function hideAuthUI() {
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('signUpOverlay').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
}

function showSignUpUI() {
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('signUpOverlay').style.display = 'flex';
    window.scrollTo(0, 0);
}

function showSignInUI() {
    document.getElementById('signUpOverlay').style.display = 'none';
    document.getElementById('authOverlay').style.display = 'flex';
    window.scrollTo(0, 0);
}

function showError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 4000);
    }
}

function updateUserInfo(user) {
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    if (userEmailDisplay) {
        if (user.email) {
            const displayEmail = user.email.length > 25 ? user.email.substring(0, 22) + '...' : user.email;
            userEmailDisplay.innerHTML = `<i class="fa-regular fa-envelope"></i> ${displayEmail}`;
        } else if (user.isAnonymous) {
            userEmailDisplay.innerHTML = `<i class="fa-solid fa-user"></i> Guest User`;
        }
    }
}

// ==================== AUTHENTICATION FUNCTIONS ====================

async function signUp(email, password) {
    const signUpBtn = document.querySelector('#signUpForm button[type="submit"]');
    const originalText = signUpBtn.textContent;
    signUpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Creating account...';
    signUpBtn.disabled = true;
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        console.log("User signed up:", currentUser.uid);
        
        hideAuthUI();
        updateUserInfo(currentUser);
        await loadSubscriptions();
        
        showToast('Account created successfully!');
        document.getElementById('signUpForm').reset();
        
    } catch (error) {
        console.error("Sign up error:", error);
        let message = error.message;
        if (error.code === 'auth/email-already-in-use') {
            message = 'Email already in use. Please sign in instead.';
        } else if (error.code === 'auth/weak-password') {
            message = 'Password should be at least 6 characters.';
        }
        showError('signUpError', message);
    } finally {
        signUpBtn.innerHTML = originalText;
        signUpBtn.disabled = false;
    }
}

async function signIn(email, password) {
    const signInBtn = document.querySelector('#signInForm button[type="submit"]');
    const originalText = signInBtn.textContent;
    signInBtn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Signing in...';
    signInBtn.disabled = true;
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        console.log("User signed in:", currentUser.uid);
        
        hideAuthUI();
        updateUserInfo(currentUser);
        await loadSubscriptions();
        
        showToast('Signed in successfully!');
        document.getElementById('signInForm').reset();
        
    } catch (error) {
        console.error("Sign in error:", error);
        let message = error.message;
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
            message = 'Invalid email or password.';
        }
        showError('authError', message);
    } finally {
        signInBtn.innerHTML = originalText;
        signInBtn.disabled = false;
    }
}

async function signInWithGoogle(isSignUp = false) {
    const btn = document.getElementById(isSignUp ? 'googleSignUpBtn' : 'googleSignInBtn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Connecting to Google...';
    btn.disabled = true;
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        currentUser = result.user;
        console.log("Google sign in success:", currentUser.uid);
        
        hideAuthUI();
        updateUserInfo(currentUser);
        await loadSubscriptions();
        
        showToast(`Welcome ${currentUser.displayName || currentUser.email || 'User'}!`);
        
    } catch (error) {
        console.error("Google sign in error:", error);
        if (error.code === 'auth/popup-closed-by-user') {
            showError(isSignUp ? 'signUpError' : 'authError', 'Sign-in cancelled. Please try again.');
        } else if (error.code === 'auth/popup-blocked') {
            showError(isSignUp ? 'signUpError' : 'authError', 'Popup was blocked. Please allow popups for this site.');
        } else {
            showError(isSignUp ? 'signUpError' : 'authError', error.message || 'Google sign-in failed.');
        }
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

async function signInAsGuest() {
    const guestBtn = document.getElementById('guestSignInBtn');
    const originalText = guestBtn.innerHTML;
    guestBtn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Loading...';
    guestBtn.disabled = true;
    
    try {
        const userCredential = await auth.signInAnonymously();
        currentUser = userCredential.user;
        console.log("Guest user:", currentUser.uid);
        
        hideAuthUI();
        updateUserInfo({ email: null, isAnonymous: true, uid: currentUser.uid });
        await loadSubscriptions();
        
        showToast('Continuing as guest. Sign up to save your data across devices!', 'info');
        
    } catch (error) {
        console.error("Guest sign in error:", error);
        showError('authError', 'Error signing in as guest');
    } finally {
        guestBtn.innerHTML = originalText;
        guestBtn.disabled = false;
    }
}

function confirmSignOut() {
    pendingSignOut = true;
    document.getElementById('confirmTitle').textContent = 'Sign Out';
    document.getElementById('confirmMessage').innerHTML = 'Are you sure you want to sign out?<br><small>You will need to sign in again to access your subscriptions.</small>';
    document.getElementById('confirmModal').classList.remove('hidden');
}

async function signOut() {
    try {
        await auth.signOut();
        currentUser = null;
        subscriptions = [];
        renderSubscriptions();
        updateSummary();
        showAuthUI();
        showToast('Signed out successfully');
    } catch (error) {
        console.error("Sign out error:", error);
        showToast('Error signing out', 'error');
    }
    pendingSignOut = false;
}

// ==================== NOTIFICATION FUNCTIONS ====================

function areNotificationsSupported() {
    return 'Notification' in window;
}

async function requestNotificationPermission() {
    if (!areNotificationsSupported()) {
        showToast('Your browser does not support notifications', 'error');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        await setupFCMToken();
        updateNotificationUI(true);
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await setupFCMToken();
            updateNotificationUI(true);
            showToast('Notifications enabled! You will receive bill reminders.', 'success');
            return true;
        } else {
            updateNotificationUI(false);
            showToast('Notifications disabled.', 'error');
            return false;
        }
    }
    
    updateNotificationUI(false);
    return false;
}

async function setupFCMToken() {
    if (!messaging || Notification.permission !== 'granted') return null;
    
    try {
        const token = await messaging.getToken({ vapidKey: VAPID_KEY });
        if (token && currentUser) {
            await db.collection('users').doc(currentUser.uid).set({
                fcmToken: token,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        return token;
    } catch (error) {
        console.error("FCM token error:", error);
        return null;
    }
}

function showLocalNotification(title, body) {
    if (Notification.permission !== 'granted') return;
    
    navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
            vibrate: [200, 100, 200],
            requireInteraction: true
        });
    });
    showToast(body, 'info');
}

function updateNotificationUI(isEnabled) {
    const enableBtn = document.getElementById('enableNotificationsSettingsBtn');
    const statusDiv = document.getElementById('settingsNotificationStatus');
    const testBtn = document.getElementById('testNotificationBtn');
    
    if (enableBtn) {
        if (isEnabled) {
            enableBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Notifications Enabled';
            enableBtn.style.background = '#10b981';
            enableBtn.disabled = true;
        } else {
            enableBtn.innerHTML = '<i class="fa-solid fa-bell"></i> Enable Notifications';
            enableBtn.style.background = '#3b82f6';
            enableBtn.disabled = false;
        }
    }
    
    if (statusDiv) {
        if (isEnabled) {
            statusDiv.innerHTML = '<i class="fa-solid fa-check-circle" style="color: #10b981;"></i> Notifications are active. You will receive bill reminders.';
            statusDiv.style.background = '#10b98110';
        } else {
            statusDiv.innerHTML = '<i class="fa-regular fa-circle-info"></i> Notifications are disabled. Click "Enable Notifications" to receive bill reminders.';
            statusDiv.style.background = '#1e293b';
        }
    }
    
    if (testBtn) testBtn.style.display = isEnabled ? 'flex' : 'none';
}

function checkUpcomingBills() {
    if (Notification.permission !== 'granted') return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    subscriptions.filter(s => s.status === 'active').forEach(sub => {
        if (!sub.nextBillingDate) return;
        
        const billDate = new Date(sub.nextBillingDate);
        billDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((billDate - today) / (1000 * 60 * 60 * 24));
        
        const lastNotifiedKey = `notified_${currentUser?.uid}_${sub.id}_${sub.nextBillingDate}`;
        const lastNotified = localStorage.getItem(lastNotifiedKey);
        
        let title = '', body = '';
        const currencySymbol = getCurrencySymbol(sub.currency);
        
        if (daysUntil === 7 && !lastNotified) {
            title = '📆 Bill Reminder (7 Days)';
            body = `${sub.name} will bill ${currencySymbol}${sub.price} in 7 days`;
        } else if (daysUntil === 3 && !lastNotified) {
            title = '⏰ Bill Reminder (3 Days)';
            body = `${sub.name} will bill ${currencySymbol}${sub.price} in 3 days`;
        } else if (daysUntil === 1 && !lastNotified) {
            title = '⚠️ Bill Due Tomorrow';
            body = `${sub.name} bills TOMORROW for ${currencySymbol}${sub.price}`;
        } else if (daysUntil === 0 && !lastNotified) {
            title = '🔔 Payment Due TODAY';
            body = `${sub.name} bills TODAY for ${currencySymbol}${sub.price}`;
        }
        
        if (title) {
            showLocalNotification(title, body);
            localStorage.setItem(lastNotifiedKey, new Date().toISOString());
        }
    });
}

function startNotificationChecker() {
    setTimeout(() => checkUpcomingBills(), 3000);
    setInterval(() => checkUpcomingBills(), 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) setTimeout(() => checkUpcomingBills(), 1000);
    });
}

function addNotificationSettingsToModal() {
    setTimeout(() => {
        const settingsBody = document.querySelector('#settingsModal .modal-body');
        if (!settingsBody || document.getElementById('notificationSettingsSection')) return;
        
        const isEnabled = Notification.permission === 'granted';
        
        const notificationSection = document.createElement('div');
        notificationSection.id = 'notificationSettingsSection';
        notificationSection.className = 'settings-section';
        notificationSection.innerHTML = `
            <h3><i class="fa-solid fa-bell"></i> Push Notifications</h3>
            <div style="margin-bottom: 16px;">
                <p style="font-size: 13px; color: #94a3b8; margin-bottom: 16px;">
                    Receive reminders when your subscriptions are about to renew.
                </p>
                <button id="enableNotificationsSettingsBtn" class="btn primary" style="width: 100%; padding: 12px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; background: ${isEnabled ? '#10b981' : '#3b82f6'}; color: white;">
                    <i class="fa-solid ${isEnabled ? 'fa-check-circle' : 'fa-bell'}"></i>
                    ${isEnabled ? 'Notifications Enabled' : 'Enable Notifications'}
                </button>
                <button id="testNotificationBtn" class="btn secondary" style="width: 100%; padding: 12px; border-radius: 8px; display: ${isEnabled ? 'flex' : 'none'}; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fa-solid fa-flask"></i> Test Notification
                </button>
                <div id="settingsNotificationStatus" style="margin-top: 12px; padding: 12px; border-radius: 8px; font-size: 12px; background: ${isEnabled ? '#10b98110' : '#1e293b'};">
                    ${isEnabled ? '<i class="fa-solid fa-check-circle" style="color: #10b981;"></i> Notifications are active.' : '<i class="fa-regular fa-circle-info"></i> Click "Enable Notifications" to receive bill reminders.'}
                </div>
            </div>
        `;
        
        const dangerZone = settingsBody.querySelector('.danger-zone');
        dangerZone ? settingsBody.insertBefore(notificationSection, dangerZone) : settingsBody.appendChild(notificationSection);
        
        document.getElementById('enableNotificationsSettingsBtn').onclick = async () => {
            const btn = document.getElementById('enableNotificationsSettingsBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Requesting permission...';
            
            const granted = await requestNotificationPermission();
            updateNotificationUI(granted);
            if (!granted) btn.disabled = false;
        };
        
        document.getElementById('testNotificationBtn').onclick = () => {
            if (Notification.permission === 'granted') {
                showLocalNotification('Test Notification', 'Your notifications are working!');
                showToast('Test notification sent!', 'success');
            } else {
                showToast('Please enable notifications first', 'error');
            }
        };
    }, 300);
}

// ==================== SUBSCRIPTION CRUD ====================

async function loadSubscriptions() {
    if (!currentUser) return;
    
    try {
        const container = document.getElementById('subscriptionList');
        if (container) container.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-pulse"></i> Loading...</div>';
        
        const snapshot = await db.collection('subscriptions').where('userId', '==', currentUser.uid).get();
        
        subscriptions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            subscriptions.push({ 
                id: doc.id, name: data.name || 'Untitled', category: data.category || 'other',
                price: data.price || 0, currency: data.currency || 'USD',
                billingCycle: data.billingCycle || 'monthly',
                nextBillingDate: data.nextBillingDate || new Date().toISOString().split('T')[0],
                paymentMethod: data.paymentMethod || 'card', notes: data.notes || '',
                status: data.status || 'active', color: data.color || categoryColors[data.category] || '#e94560',
                userId: data.userId
            });
        });
        
        localStorage.setItem(`subscriptions_${currentUser.uid}`, JSON.stringify(subscriptions));
        renderSubscriptions();
        updateSummary();
        setTimeout(() => checkUpcomingBills(), 1000);
        
    } catch (error) {
        console.error("Error loading:", error);
        const saved = localStorage.getItem(`subscriptions_${currentUser.uid}`);
        if (saved) {
            subscriptions = JSON.parse(saved);
            renderSubscriptions();
            updateSummary();
        }
    }
}

async function saveSubscription(e) {
    e.preventDefault();
    if (!currentUser) return showToast('Please sign in first', 'error');
    
    const nameInput = document.getElementById('serviceName');
    if (!nameInput.value.trim()) return showToast('Please enter a service name', 'error');
    
    const sub = {
        id: editingId || `${currentUser.uid}_${Date.now()}`,
        userId: currentUser.uid,
        userEmail: currentUser.email || 'guest@anonymous.com',
        name: nameInput.value.trim(),
        category: document.getElementById('category').value,
        price: parseFloat(document.getElementById('price').value) || 0,
        currency: document.getElementById('currency').value,
        billingCycle: document.getElementById('billingCycle').value,
        nextBillingDate: document.getElementById('nextBillingDate').value,
        paymentMethod: document.getElementById('paymentMethod').value,
        notes: document.getElementById('notes').value.trim(),
        status: document.getElementById('status').value,
        color: document.querySelector('input[name="color"]:checked')?.value || '#e94560',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const saveBtn = document.querySelector('#subscriptionForm button[type="submit"]');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    try {
        await db.collection('subscriptions').doc(sub.id).set(sub);
        
        if (editingId) {
            const index = subscriptions.findIndex(s => s.id == editingId);
            if (index !== -1) subscriptions[index] = sub;
        } else {
            subscriptions.push(sub);
        }
        
        localStorage.setItem(`subscriptions_${currentUser.uid}`, JSON.stringify(subscriptions));
        renderSubscriptions();
        updateSummary();
        showToast(editingId ? 'Subscription updated' : 'Subscription added');
        
        document.getElementById('subscriptionModal').classList.add('hidden');
        document.getElementById('subscriptionForm').reset();
        editingId = null;
        setTimeout(() => checkUpcomingBills(), 500);
        
    } catch (error) {
        showToast('Error saving: ' + error.message, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

function confirmDelete(id) {
    pendingDeleteId = id;
    document.getElementById('confirmTitle').textContent = 'Delete';
    document.getElementById('confirmMessage').textContent = 'Delete this subscription?';
    document.getElementById('confirmModal').classList.remove('hidden');
}

async function deleteSubscription() {
    if (!pendingDeleteId || pendingDeleteId === 'all') return;
    
    try {
        await db.collection('subscriptions').doc(pendingDeleteId).delete();
        subscriptions = subscriptions.filter(s => s.id != pendingDeleteId);
        localStorage.setItem(`subscriptions_${currentUser.uid}`, JSON.stringify(subscriptions));
        renderSubscriptions();
        updateSummary();
        showToast('Subscription deleted');
    } catch (error) {
        showToast('Error deleting', 'error');
    }
    pendingDeleteId = null;
    document.getElementById('confirmModal').classList.add('hidden');
}

async function clearAllData() {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.collection('subscriptions').where('userId', '==', currentUser.uid).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        subscriptions = [];
        localStorage.removeItem(`subscriptions_${currentUser.uid}`);
        renderSubscriptions();
        updateSummary();
        showToast('All data cleared');
    } catch (error) {
        showToast('Error clearing data', 'error');
    }
}

// ==================== RENDER FUNCTIONS ====================

function renderSubscriptions() {
    const container = document.getElementById('subscriptionList');
    const emptyState = document.getElementById('emptyState');
    if (!container) return;
    
    let filtered = [...subscriptions];
    
    if (currentFilter === 'active') filtered = filtered.filter(s => s.status === 'active');
    else if (currentFilter === 'cancelled') filtered = filtered.filter(s => s.status === 'cancelled');
    else if (currentFilter === 'expiring') {
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
    
    const query = document.getElementById('searchInput')?.value.toLowerCase() || '';
    if (query) filtered = filtered.filter(s => s.name?.toLowerCase().includes(query));
    
    filtered.sort((a, b) => {
        let result = 0;
        switch (currentSort) {
            case 'name': result = (a.name || '').localeCompare(b.name || ''); break;
            case 'price': result = (a.price || 0) - (b.price || 0); break;
            case 'nextBilling': result = new Date(a.nextBillingDate) - new Date(b.nextBillingDate); break;
            case 'category': result = (a.category || '').localeCompare(b.category || ''); break;
        }
        return sortAscending ? result : -result;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        emptyState?.classList.remove('hidden');
        return;
    }
    
    emptyState?.classList.add('hidden');
    
    container.innerHTML = filtered.map(sub => {
        let cycleAbbr = 'mo';
        if (sub.billingCycle === 'weekly') cycleAbbr = 'wk';
        else if (sub.billingCycle === 'quarterly') cycleAbbr = 'qr';
        else if (sub.billingCycle === 'yearly') cycleAbbr = 'yr';
        
        let formattedDate = 'N/A';
        if (sub.nextBillingDate) {
            try { formattedDate = new Date(sub.nextBillingDate).toLocaleDateString(); } catch(e) {}
        }
        
        const currencySymbol = getCurrencySymbol(sub.currency);
        
        let billingClass = '', billingText = '';
        if (sub.status === 'active' && sub.nextBillingDate) {
            const daysUntil = Math.ceil((new Date(sub.nextBillingDate) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntil < 0) { billingClass = 'overdue'; billingText = ' (Overdue!)'; }
            else if (daysUntil === 0) { billingClass = 'urgent'; billingText = ' (Today!)'; }
            else if (daysUntil <= 3) { billingClass = 'soon'; billingText = ` (${daysUntil}d left)`; }
        }
        
        return `
            <div class="subscription-card">
                <div class="card-color" style="background: ${sub.color};"></div>
                <div class="card-content">
                    <div class="card-header">
                        <div class="card-title">
                            <h3>${escapeHtml(sub.name)}</h3>
                            <span class="category-badge">${escapeHtml(sub.category)}</span>
                        </div>
                        <span class="card-price">${currencySymbol} ${sub.price}/${cycleAbbr}</span>
                    </div>
                    <div class="card-details">
                        <div class="card-detail ${billingClass}">
                            <i class="fa-regular fa-calendar"></i> ${formattedDate}${billingText}
                        </div>
                        <div class="card-detail">
                            <i class="fa-regular fa-credit-card"></i> ${escapeHtml(sub.paymentMethod)}
                        </div>
                        <span class="status-badge ${sub.status}">${sub.status}</span>
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
        btn.onclick = (e) => { e.stopPropagation(); editSubscription(btn.dataset.id); };
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); confirmDelete(btn.dataset.id); };
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
    document.getElementById('paymentMethod').value = sub.paymentMethod;
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
    document.getElementById('currency').value = settings.defaultCurrency;
    document.getElementById('billingCycle').value = 'monthly';
    document.getElementById('status').value = 'active';
    document.getElementById('color1').checked = true;
    document.getElementById('nextBillingDate').value = calculateNextBillingDate('monthly');
    document.getElementById('subscriptionModal').classList.remove('hidden');
}

// ==================== EXCHANGE RATES & SUMMARY ====================

async function fetchExchangeRates() {
    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        exchangeRates = (await response.json()).rates;
    } catch (error) {
        exchangeRates = { USD: 1, KES: 130, EUR: 0.92, GBP: 0.79, NGN: 1500, ZAR: 19, INR: 83, CAD: 1.35, AUD: 1.5, JPY: 150 };
    }
}

function convertCurrency(amount, fromCurrency, toCurrency) {
    if (!fromCurrency || fromCurrency === toCurrency) return amount;
    if (!exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) return amount;
    return (amount / exchangeRates[fromCurrency]) * exchangeRates[toCurrency];
}

function calculateNextBillingDate(cycle) {
    const date = new Date();
    switch (cycle) {
        case 'weekly': date.setDate(date.getDate() + 7); break;
        case 'quarterly': date.setMonth(date.getMonth() + 3); break;
        case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
        default: date.setMonth(date.getMonth() + 1);
    }
    return date.toISOString().split('T')[0];
}

async function updateSummary() {
    const active = subscriptions.filter(s => s.status === 'active');
    if (Object.keys(exchangeRates).length === 0) await fetchExchangeRates();
    
    let monthlyTotal = 0, yearlyTotal = 0;
    
    active.forEach(sub => {
        let monthlyPrice = sub.price, yearlyPrice = sub.price;
        switch (sub.billingCycle) {
            case 'weekly': monthlyPrice = sub.price * 4.33; yearlyPrice = sub.price * 52; break;
            case 'monthly': monthlyPrice = sub.price; yearlyPrice = sub.price * 12; break;
            case 'quarterly': monthlyPrice = sub.price / 3; yearlyPrice = sub.price * 4; break;
            case 'yearly': monthlyPrice = sub.price / 12; yearlyPrice = sub.price; break;
        }
        monthlyTotal += convertCurrency(monthlyPrice, sub.currency, settings.defaultCurrency);
        yearlyTotal += convertCurrency(yearlyPrice, sub.currency, settings.defaultCurrency);
    });
    
    const sym = getCurrencySymbol(settings.defaultCurrency);
    document.getElementById('monthlyTotal').textContent = `${sym} ${monthlyTotal.toFixed(2)}`;
    document.getElementById('yearlyTotal').textContent = `${sym} ${yearlyTotal.toFixed(2)}`;
    document.getElementById('activeCount').textContent = active.length;
}

async function autoDetectCurrency() {
    if (localStorage.getItem('currencyManuallySet')) return;
    try {
        const response = await fetch('https://ipapi.co/json/');
        const countryCode = (await response.json()).country_code;
        const currencyMap = { KE: 'KES', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NG: 'NGN', ZA: 'ZAR', IN: 'INR', CA: 'CAD', AU: 'AUD', JP: 'JPY' };
        if (currencyMap[countryCode]) {
            settings.defaultCurrency = currencyMap[countryCode];
            localStorage.setItem('subscriptionSettings', JSON.stringify(settings));
            const defaultCurrencySelect = document.getElementById('defaultCurrency');
            if (defaultCurrencySelect) defaultCurrencySelect.value = settings.defaultCurrency;
        }
    } catch (error) { console.log("Auto-detection failed"); }
}

// ==================== HELPER FUNCTIONS ====================

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    document.getElementById('toastMessage').textContent = msg;
    const icon = toast.querySelector('i');
    if (icon) icon.className = type === 'error' ? 'fa-solid fa-exclamation-circle' : 'fa-solid fa-check-circle';
    toast.style.background = type === 'error' ? '#ef4444' : '#10b981';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function exportData() {
    const data = JSON.stringify({ subscriptions, settings, exportDate: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Data exported');
}

async function importData(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.subscriptions?.length) {
                for (const sub of data.subscriptions) {
                    sub.userId = currentUser.uid;
                    sub.userEmail = currentUser.email || 'guest@anonymous.com';
                    sub.id = sub.id || `${currentUser.uid}_${Date.now()}_${Math.random()}`;
                    await db.collection('subscriptions').doc(sub.id).set(sub);
                }
                await loadSubscriptions();
                showToast('Data imported successfully');
            } else {
                showToast('Invalid file format', 'error');
            }
        } catch (error) {
            showToast('Invalid file', 'error');
        }
    };
    reader.readAsText(file);
}

// ==================== INITIALIZE APP ====================

document.addEventListener('DOMContentLoaded', async function() {
    console.log("Initializing app...");
    
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('Service Worker registered');
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
    
    // Event Listeners
    document.getElementById('signInForm').addEventListener('submit', (e) => {
        e.preventDefault();
        signIn(document.getElementById('signInEmail').value, document.getElementById('signInPassword').value);
    });
    
    document.getElementById('signUpForm').addEventListener('submit', (e) => {
        e.preventDefault();
        signUp(document.getElementById('signUpEmail').value, document.getElementById('signUpPassword').value);
    });
    
    document.getElementById('googleSignInBtn').onclick = () => signInWithGoogle(false);
    document.getElementById('googleSignUpBtn').onclick = () => signInWithGoogle(true);
    document.getElementById('guestSignInBtn').onclick = () => signInAsGuest();
    document.getElementById('showSignUpBtn').onclick = () => showSignUpUI();
    document.getElementById('showSignInBtn').onclick = () => showSignInUI();
    document.getElementById('signOutBtnMain').onclick = () => confirmSignOut();
    
    document.getElementById('addSubscriptionBtn').onclick = () => openAddModal();
    document.getElementById('settingsBtn').onclick = () => {
        document.getElementById('settingsModal').classList.remove('hidden');
        addNotificationSettingsToModal();
    };
    document.getElementById('closeSettingsBtn').onclick = () => document.getElementById('settingsModal').classList.add('hidden');
    document.getElementById('cancelFormBtn').onclick = () => {
        document.getElementById('subscriptionModal').classList.add('hidden');
        editingId = null;
    };
    document.getElementById('closeModalBtn').onclick = () => {
        document.getElementById('subscriptionModal').classList.add('hidden');
        editingId = null;
    };
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
        document.getElementById('confirmMessage').textContent = 'Delete ALL subscriptions? This cannot be undone.';
        document.getElementById('confirmModal').classList.remove('hidden');
    };
    
    document.getElementById('confirmCancelBtn').onclick = () => {
        document.getElementById('confirmModal').classList.add('hidden');
        pendingDeleteId = null;
        pendingSignOut = false;
    };
    
    document.getElementById('confirmOkBtn').onclick = async () => {
        if (pendingSignOut) {
            await signOut();
            pendingSignOut = false;
        } else if (pendingDeleteId === 'all') {
            await clearAllData();
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
        document.getElementById('sortIcon').className = sortAscending ? 'fa-solid fa-arrow-down' : 'fa-solid fa-arrow-up';
        renderSubscriptions();
    };
    
    document.getElementById('billingCycle')?.addEventListener('change', function() {
        document.getElementById('nextBillingDate').value = calculateNextBillingDate(this.value);
    });
    
    await fetchExchangeRates();
    await autoDetectCurrency();
    
    const savedSettings = localStorage.getItem('subscriptionSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        const defaultCurrencySelect = document.getElementById('defaultCurrency');
        if (defaultCurrencySelect) defaultCurrencySelect.value = settings.defaultCurrency;
    }
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log("User found:", currentUser.uid);
            hideAuthUI();
            updateUserInfo(user);
            await loadSubscriptions();
            if (Notification.permission === 'granted') await setupFCMToken();
        } else {
            console.log("No user, showing auth UI");
            showAuthUI();
        }
    });
    
    startNotificationChecker();
    console.log("App ready!");
});

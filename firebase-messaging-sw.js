// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase configuration (USE SAME CONFIG)
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
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message: ', payload);
    
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/1827/1827333.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: payload.data?.subscriptionId || 'subscription'
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
});

# SubTracker - Smart Subscription Manager

A beautiful, free subscription tracker that helps you monitor all your recurring payments and sends reminders before bills are due.

![SubTracker](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)

## Features

- Track unlimited subscriptions in one place
- Monthly and yearly cost summaries in your local currency
- Push notifications at 7 days, 3 days, 1 day, and due date
- Works even when browser is closed (Android + Desktop)
- Auto-detects your local currency from IP address (silent, no popup)
- 8 color options for categorizing subscriptions
- Filter by All, Active, Expiring, Overdue, or Cancelled
- Search and sort functionality (Name, Price, Date, Category)
- Export/import data as JSON for backup
- Real-time cloud sync via Firebase
- Fully mobile responsive
- Dark theme
- 100% free · No ads · No tracking

## What's New

| Feature | Description |
|---------|-------------|
| Push Notifications | Get reminded at 7d, 3d, 1d, and due date |
| Firebase Sync | Real-time sync across all devices |
| Auto Currency | Silently detects your location and sets local currency |
| Overdue Tab | Quickly see missed payments |
| 8 Colors | Matching color palette for better categorization |

## Try Live

**[Try SubTracker Now](https://subscription-tracker.vercel.app)**

## How to Use

1. Open the app
2. Click the **+** button to add a subscription
3. Fill in service name, price, category, and billing cycle
4. Choose a color to easily identify each subscription
5. Enable notifications in **Settings** → **Push Notifications**
6. Receive reminders before each bill
7. Use the **Overdue** tab to see missed payments

## Mobile Setup (For Notifications)

For the best experience on mobile:

**Android (Chrome):**
1. Open in Chrome
2. Tap the three dots → **Install app**
3. Allow notifications when prompted

**iOS (Safari):**
1. Open in **Safari** (not Chrome)
2. Tap **Share** → **Add to Home Screen**
3. Name it "SubTracker" and tap **Add**
4. Open from home screen icon
5. Allow notifications when prompted

## Technologies Used

- HTML5
- CSS3 (Flexbox, Grid, Custom Properties, Animations)
- Vanilla JavaScript (ES6+)
- Firebase Firestore (Real-time database)
- Firebase Cloud Messaging (Push notifications)
- ExchangeRate-API (Currency conversion)
- IP Geolocation API (ipapi.co)

## Supported Currencies

| Code | Currency | Symbol |
|:----:|:---------|:------:|
| USD | US Dollar | $ |
| KES | Kenyan Shilling | KSh |
| EUR | Euro | € |
| GBP | British Pound | £ |
| NGN | Nigerian Naira | ₦ |
| ZAR | South African Rand | R |
| INR | Indian Rupee | ₹ |
| CAD | Canadian Dollar | C$ |
| AUD | Australian Dollar | A$ |
| JPY | Japanese Yen | ¥ |

## Supported Categories

| Category | Examples |
|:---------|:---------|
| Entertainment | Netflix, Disney+, HBO |
| Music | Spotify, Apple Music, YouTube Premium |
| Productivity | Notion, Evernote, Todoist |
| Cloud Storage | iCloud, Google Drive, Dropbox |
| Fitness | Gym, Strava, Peloton |
| Gaming | Xbox, PlayStation, Nintendo |
| Education | Coursera, Skillshare, Duolingo |
| News | NYT, WSJ, Medium |
| Shopping | Amazon Prime, Walmart+ |
| Food Delivery | Uber Eats, DoorDash |
| VPN | NordVPN, ExpressVPN |
| Other | Custom |

## Available Colors

| Color | Hex |
|:-----:|:---:|
| Red | #e94560 |
| Cyan | #48dbfb |
| Green | #2ecc71 |
| Coral | #FF9A86 |
| Purple | #a29bfe |
| Cream | #FFF0BE |
| Orange | #f39c12 |
| Lime | #B6F500 |

## Browser Support

| Browser | Support |
|:--------|:-------:|
| Chrome | ✅ Yes |
| Firefox | ✅ Yes |
| Safari | ✅ Yes |
| Edge | ✅ Yes |
| Opera | ✅ Yes |
| Mobile Chrome | ✅ Yes |
| Mobile Safari | ✅ Yes |

## Notification Schedule

| Days Before | Notification Message |
|:-----------:|:---------------------|
| 7 days | "[Service] bills in 1 week" |
| 3 days | "[Service] bills in 3 days" |
| 1 day | "[Service] bills tomorrow" |
| 0 days | "[Service] bills today" |

## Privacy

- Firebase used only for cloud sync and push notifications
- No personal data collected
- Your subscriptions are stored securely in Firebase
- You can export and delete your data anytime

## Installation

```bash
git clone https://github.com/David-Kimath1/subscription-tracker.git
cd subscription-tracker

# Open index.html in your browser

Author
David Kimathi

GitHub: https://github.com/David-Kimath1

Project: https://github.com/David-Kimath1/subscription-tracker

Contributing
Contributions are welcome! Feel free to:

Fork the repository

Create a feature branch (git checkout -b feature/amazing-feature)

Commit your changes (git commit -m 'Add amazing feature')

Push to the branch (git push origin feature/amazing-feature)

Open a Pull Request

License
This project is licensed under the MIT License.

Acknowledgments
Icons by FontAwesome

Font by Google Fonts

Firebase for real-time database and push notifications

ExchangeRate-API for currency conversion

Support
If you find this useful, please give it a ⭐ on GitHub!

Found a bug? Open an issue

Made with Lots of Love ❤️ by David Kimathi
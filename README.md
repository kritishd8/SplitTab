# SplitTab

<div align="center">
  <img src="icons/SplitTab.png" alt="SplitTab Logo" width="120" height="120">
  
  **Split bills fast. No login, no drama.**
  
  A quick and simple expense splitter that works offline.
</div>

## ✨ Features

- **🚀 Lightning Fast** - Split bills in seconds
- **📱 Lightweight** - Powered by PWA, installs to your device
- **🔥 Simple & Clean** - Minimal interface that just works
- **💾 Works Offline** - Use it anywhere, anytime

## 🎯 What It Does

SplitTab helps you split bills and expenses between multiple people quickly and easily. Perfect for:

- Restaurant bills with friends
- Shared household expenses
- Group trips and activities
- Any situation where you need to divide costs fairly

## 📦 Installation & Usage

### Web Version
1. Open your browser and navigate to the app
2. Start splitting bills immediately - no installation required

### PWA Installation
1. Visit the app in your browser
2. Click the install button (or "Add to Home Screen")
3. Enjoy native app-like experience

### Local Development
```bash
# Clone the repository
git clone https://github.com/kritishd8/SplitTab.git

# Navigate to the project
cd SplitTab

# Serve the files (any static server will work)
# Using Python 3:
python -m http.server 8000

# Using Node.js (if you have http-server installed):
npx http-server

# Open http://localhost:8000 in your browser
```

## 🏗️ Project Structure

```
SplitTab/
├── index.html          # Main application entry point
├── manifest.json       # PWA configuration
├── service-worker.js   # Offline functionality
├── style.css          # Application styles
├── js/
│   ├── app.js         # Main application logic
│   ├── calculations.js # Bill splitting calculations
│   ├── components.js  # UI components
│   ├── navigation.js  # Navigation and routing
│   ├── renderers.js  # Rendering functions
│   ├── state.js       # Application state management
│   ├── summary.js     # Summary and export functionality
│   └── utils.js       # Utility functions
├── icons/             # App icons and favicons
└── assets/fonts/      # Custom fonts
```


## 🌐 Live Demo

[See SplitTab in action](https://kritishd8.github.io/SplitTab/)


#!/bin/bash

# GameLab Development Setup Script

echo "🎮 GameLab Development Setup"
echo "================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi
echo "✅ npm found: $(npm --version)"

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "⚠️  Java is not installed. Required for Android development."
    echo "   Install Java: brew install java"
fi

# Check if Android SDK is available
if [ -z "$ANDROID_SDK_ROOT" ] && [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  Android SDK environment variables not set."
    echo "   If using Android Studio, Gradle will handle this automatically."
fi

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Syncing Capacitor with Android project..."
npx cap sync android

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open Android Studio: npx cap open android"
echo "2. Or build from command line: cd android && ./gradlew assembleDebug"
echo "3. Start Node.js server: npm start"
echo "4. Deploy to emulator/device: adb install app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "For detailed instructions, see: APK_BUILD_GUIDE.md"


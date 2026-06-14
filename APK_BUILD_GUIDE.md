# GameLab Android APK - Build Guide

## Overview
Your GameLab application has been set up with Capacitor to create an Android app. This guide will help you build and deploy the APK.

## Prerequisites
Before building the APK, ensure you have:

1. **Android SDK** installed (minimum API level 21)
2. **Java Development Kit (JDK)** 11 or higher
3. **Gradle** (usually comes with Android SDK)
4. **Android Studio** (recommended) or Android Command Line Tools
5. **Node.js** and your server running for testing

## Architecture Overview

The app has two deployment options:

### Option 1: Local Development (Localhost)
- Node.js server runs locally on your machine
- APK connects to `localhost:5000`
- Best for testing on development devices or emulators

### Option 2: Production (Remote Server)
- Deploy Node.js server to a cloud platform (Heroku, AWS, DigitalOcean, Render, etc.)
- APK server URL points to your deployed endpoint (e.g., https://gamelab.yourserver.com)
- Works on any device worldwide

## Building the APK

### Method 1: Using Android Studio (Recommended)

1. **Open the Android project in Android Studio:**
   ```bash
   npx cap open android
   ```
   This will open the Android Studio IDE with your project.

2. **Resolve Gradle issues (if any):**
   - Go to File → Project Structure
   - Select Project → Properties
   - Ensure Gradle JDK version matches your installed JDK
   - Click "Sync Now"

3. **Configure Server URL (Important):**
   - Open: `android/app/src/main/assets/public/index.html`
   - The app in local mode connects through relative URLs
   - For remote deployment, ensure your server URL is configured

4. **Build the APK:**
   - Go to: Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Wait for the build to complete
   - The APK will be located at: `android/app/release/app-release.apk`

5. **Sign the APK (for release):**
   - Go to: Build → Generate Signed Bundle / APK
   - Select APK
   - Create a new keystore or select existing one
   - Fill in the signing details
   - Select Release build variant
   - Click Finish

### Method 2: Command Line Build

```bash
cd /Users/mohamed.abdelmonem/AndroidStudioProjects/gamelab

# Sync Capacitor with Android project
npx cap sync android

# Build the APK (debug version)
cd android
./gradlew assembleDebug

# Build the APK (release version - requires signing)
./gradlew assembleRelease

# Built APK will be in:
# app/build/outputs/apk/debug/app-debug.apk  (debug)
# app/build/outputs/apk/release/app-release-unsigned.apk  (release, no signing config)
# app/build/outputs/apk/release/app-release.apk  (release, signing configured)
```

### Configure signing for command-line release builds

```bash
cd /Users/mohamed.abdelmonem/IdeaProjects/MO-PROJECTS/gamelab/android

# 1) Generate keystore (choose secure passwords when prompted)
keytool -genkeypair -v \
  -keystore release-key.jks \
  -alias gamelab-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 2) Copy template and fill real values
cp keystore.properties.example keystore.properties
```

Edit `android/keystore.properties`:

```properties
storeFile=/absolute/path/to/release-key.jks
storePassword=your_store_password
keyAlias=gamelab-release
keyPassword=your_key_password
```

Then run:

```bash
cd /Users/mohamed.abdelmonem/IdeaProjects/MO-PROJECTS/gamelab/android
./gradlew assembleRelease
```

## Running the APK

### On an Android Device:
1. Enable Developer Mode on your Android device
2. Connect device via USB
3. Allow USB Debugging when prompted
4. In Android Studio: Click the Run button or execute:
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

### On an Android Emulator:
1. In Android Studio: Tools → Device Manager
2. Create or start an existing emulator
3. Run the app from Android Studio using the Run button

## Deployment Options

### Option A: Deploy Your Node.js Server

#### Deploy to Render (Free tier available):
1. Push your project to GitHub
2. Go to https://render.com
3. Create new Web Service
4. Connect your GitHub repo
5. Set Build Command: `npm install`
6. Set Start Command: `npm start`
7. Get your service URL (e.g., https://gamelab-xxxxx.onrender.com)

#### Deploy to Heroku:
1. Install Heroku CLI
2. Run:
   ```bash
   heroku login
   heroku create gamelab-app
   git push heroku main
   ```

#### Deploy to Railway:
1. Connect GitHub to Railway
2. Create new project from repo
3. Railway auto-detects Node.js and deploys

### Option B: Update APK for Remote Server

Once your server is deployed, update the connection URL:

1. Edit `android/app/src/main/assets/public/index.html`
2. Add a startup script that configures the server URL:
   ```html
   <script>
       // Set this to your deployed server URL
       window.SERVER_URL = 'https://your-deployed-server.com';
   </script>
   ```

3. Update connection scripts in game files to use this URL

## Environment Setup (For Building)

### Install Required Tools on macOS:

```bash
# Install Java (if not installed)
brew install java

# Verify Java installation
java -version

# Install Android SDK (if using command line)
brew install android-sdk

# Set environment variables (add to ~/.zshrc)
export ANDROID_SDK_ROOT=/usr/local/opt/android-sdk
export ANDROID_HOME=/usr/local/opt/android-sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/tools:$ANDROID_SDK_ROOT/platform-tools

# Then run: source ~/.zshrc
```

## Testing Before Building

1. **Start your Node.js server locally:**
   ```bash
   npm start
   ```

2. **Test in a browser:**
   - Open http://localhost:5000 in your browser
   - Verify all games are working

3. **Test on Android Emulator:**
   - Build debug APK first
   - Install on emulator
   - The app should connect to your local server

## Troubleshooting

### Issue: Gradle sync failed
- Solution: Delete `android/.gradle` folder and try again
  ```bash
  rm -rf android/.gradle
  npx cap sync android
  ```

### Issue: "Unable to connect to server"
- Check if Node.js server is running on port 5000
- For emulator: use `http://10.0.2.2:5000` instead of localhost
- For device: use your machine's actual IP address

### Issue: WebSocket connection fails
- Ensure Socket.IO is properly configured
- Check CORS settings in app.js
- For emulator connecting to localhost, use: `http://10.0.2.2:5000`

### Issue: Build errors related to Kotlin/Gradle
- Update gradle wrapper version in `android/gradle/wrapper/gradle-wrapper.properties`
- Or in Android Studio: Tools → Project Structure → Project → Use default Gradle wrapper

## App Features to Test

After building, test these features:

1. ✅ App launches and shows game menu
2. ✅ All 8 games are clickable
3. ✅ Real-time multiplayer games work (Hangman, Chess, etc.)
4. ✅ WebSocket connections maintain through app suspend/resume
5. ✅ Navigation works smoothly
6. ✅ Touch controls are responsive

## Publishing to Google Play Store

Once your APK is working:

1. Create a Google Play Developer account ($25 one-time fee)
2. Follow Google Play Console guide for app submission
3. Ensure:
   - Privacy policy is set
   - Content rating is appropriate
   - App is signed with release keystore
   - Version code is incremented for updates

## File Locations

- Source code: `/Users/mohamed.abdelmonem/AndroidStudioProjects/gamelab/`
- Android project: `/Users/mohamed.abdelmonem/AndroidStudioProjects/gamelab/android/`
- Web assets: `/Users/mohamed.abdelmonem/AndroidStudioProjects/gamelab/public/`
- Built APK (debug): `android/app/build/outputs/apk/debug/app-debug.apk`
- Built APK (release unsigned): `android/app/build/outputs/apk/release/app-release-unsigned.apk`
- Built APK (release signed): `android/app/build/outputs/apk/release/app-release.apk`

## Next Steps

1. Open Android Studio: `npx cap open android`
2. Fix any Gradle sync issues (usually automatic)
3. Click "Run" to build and test on device/emulator
4. Once working, follow the deployment section above
5. Build a release APK for distribution

## Support Resources

- Capacitor Docs: https://capacitorjs.com/docs
- Android Developers: https://developer.android.com
- Node.js Deployment: https://nodejs.org/en/docs/guides
- Socket.IO Docs: https://socket.io/docs

---

**Questions?** Check the Capacitor documentation or test the app in Android Studio's debugger first!


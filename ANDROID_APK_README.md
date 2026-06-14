# 🎮 GameLab - Android APK

Your GameLab gaming platform has been configured to build as an Android APK! Here's everything you need to know.

## 📋 Quick Start

### Fastest Path to APK

```bash
# 1. Install dependencies (one time)
npm install

# 2. Open Android Studio to build
npx cap open android

# 3. In Android Studio: Build → Build APK(s)
# 4. APK will be ready in: android/app/build/outputs/apk/debug/app-debug.apk
```

## 🏗️ Architecture

Your app is built with **Capacitor**, which wraps your web app as a native Android application:

- **Frontend**: Static web files + games (already in `public/`)
- **Backend**: Node.js/Express server (`app.js`)
- **Platform**: Android via Capacitor
- **Communication**: Socket.IO for real-time multiplayer

### Two Operating Modes

#### 1️⃣ Development Mode
- **Server**: Runs on `localhost:5000`
- **Access**: Emulator uses `http://10.0.2.2:5000`
- **Device**: Uses your machine's IP (e.g., `http://192.168.1.100:5000`)
- **Best for**: Testing, debugging, local multiplayer

#### 2️⃣ Production Mode
- **Server**: Deployed to cloud (Heroku, Render, DigitalOcean, etc.)
- **Access**: Via public HTTPS URL
- **Best for**: Distribution, public use, multiplayer online

## ✅ System Requirements

### To Build the APK

- **macOS/Linux/Windows** with command line tools
- **Node.js** 14+ and npm
- **Java Development Kit (JDK)** 11 or higher
- **Android SDK** (with build-tools and API 21+)
- **Gradle** (bundled with Android SDK)
- **Android Studio** (optional but recommended)

### To Install APK

- **Android device** with minimum API level 21 (Android 5.0)
- **Developer mode enabled** (for USB installation)
- **Internet connection** (for multiplayer)

## 📦 Building the APK

### Method 1: Android Studio (Recommended)

```bash
# Open in Android Studio
npx cap open android
```

Then in Android Studio:

1. Wait for Gradle sync to complete
2. **To test**: Click the ▶️ Run button to install on device/emulator
3. **To build APK**: 
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Debug APK: ready in ~1-2 minutes
   - Release APK: Build → Generate Signed Bundle / APK

### Method 2: Command Line

```bash
cd android

# Debug APK (for testing)
./gradlew assembleDebug
# Find at: app/build/outputs/apk/debug/app-debug.apk

# Release APK (for distribution, requires signing)
./gradlew assembleRelease
# Unsigned output (if signing is not configured):
# app/build/outputs/apk/release/app-release-unsigned.apk
# Signed output (if signing is configured):
# app/build/outputs/apk/release/app-release.apk
```

### Configure release signing (once)

```bash
cd android

# 1) Generate a release keystore (you will choose passwords interactively)
keytool -genkeypair -v \
  -keystore release-key.jks \
  -alias gamelab-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 2) Create your local signing config from template
cp keystore.properties.example keystore.properties
```

Then edit `android/keystore.properties` with your real values:

```properties
storeFile=/absolute/path/to/android/release-key.jks
storePassword=your_store_password
keyAlias=gamelab-release
keyPassword=your_key_password
```

Now build a signed release APK:

```bash
cd android
./gradlew assembleRelease
```

Signed APK path:

`android/app/build/outputs/apk/release/app-release.apk`

### Method 3: Sync Changes

If you modify the web files, sync them to Android:

```bash
npx cap sync android
```

## 🚀 Deployment & Distribution

### Option A: Keep Using Web Server (Easier)

Your existing Node.js server stays the same. Users:
1. Install APK
2. Enter your server URL
3. Play games in the app

**Deploy server to:**
- **Render.com** (free tier: https://render.com)
- **Railway.app** (free tier initially)
- **Heroku** (paid)
- **DigitalOcean**
- **AWS** / **Google Cloud** / **Azure**

### Option B: Bundled Server (Advanced)

If you want the app fully standalone (no external server):

This requires bundling Node.js within the app - complex but possible using tools like:
- React Native with expo
- NativeScript
- Or a different architecture

For your current setup, **Option A is recommended**.

## 🔧 Configuration

### For Local Development

Edit `public/index.html` if you need custom server configuration:

```html
<script>
    // Point APK to your local development server
    // On emulator: 10.0.2.2 is special address for host localhost
    // On device: use your machine's IP address
    window.SERVER_URL = 'http://10.0.2.2:5000';
</script>
```

### For Production

Once you deploy your server (e.g., to Render):

1. Get your server URL: `https://gamelab-xxxxx.onrender.com`
2. Update in `android/app/src/main/assets/public/index.html`
3. Rebuild and redistribute APK

Or create a settings screen in-app for users to configure the server URL.

## 🔐 Security Settings

The file `android/app/src/main/res/xml/network_security_config.xml` controls:

- **Which domains allow HTTP** (development only)
- **Which domains require HTTPS** (production)

Default configuration:
- ✅ `localhost:5000` - allow HTTP (development)
- ✅ `10.0.2.2` - allow HTTP (emulator)
- ✅ `127.0.0.1` - allow HTTP (local)
- ❌ Everything else - requires HTTPS

**For production:** Change deployed server to use HTTPS (most hosting provides free SSL).

## 📱 Testing

### Before Building

```bash
# 1. Start your Node.js server
npm start

# 2. Test in web browser
open http://localhost:5000

# 3. Verify all games work
# 4. Test multiplayer with another browser tab
```

### After Building

**On Android Emulator:**
```bash
# Build
cd android && ./gradlew assembleDebug

# Install
adb install app/build/outputs/apk/debug/app-debug.apk

# Run
adb shell am start -n com.gamelab.app/.MainActivity
```

**On Physical Device:**
```bash
# Connect via USB
# Enable Developer Mode and USB Debugging

# Install
adb install app/build/outputs/apk/debug/app-debug.apk
```

**What to test:**
- [ ] App launches showing game menu
- [ ] Each game is clickable
- [ ] Multiplayer games work (connect from 2+ devices)
- [ ] WebSocket connections stable
- [ ] No crashes when disconnecting
- [ ] UI responsive on different screen sizes

## 📊 File Structure

```
gamelab/
├── app.js                           # Node.js Express server
├── public/
│   ├── index.html                   # ✨ NEW - APK entry point
│   ├── images/                      # Game images
│   ├── css/                         # Game styles
│   └── js/                          # Game logic
├── views/                           # Game HTML views
├── android/                         # ✨ NEW - Android project
│   ├── app/
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── java/            # Java code (MainActivity)
│   │   │   │   ├── res/             # Android resources
│   │   │   │   │   ├── xml/
│   │   │   │   │   │   └── network_security_config.xml
│   │   │   │   │   └── AndroidManifest.xml
│   │   │   │   └── assets/
│   │   │   │       └── public/      # Web files bundled in APK
│   │   └── build.gradle             # Build configuration
│   └── gradle/                      # Gradle wrapper
├── capacitor.config.json            # ✨ NEW - Capacitor config
├── APK_BUILD_GUIDE.md              # Full documentation
└── setup-android.sh                 # Setup script

```

## 🐛 Troubleshooting

### Gradle Issues

```bash
# Clean and rebuild
cd android
rm -rf .gradle build app/build
./gradlew clean
./gradlew assembleDebug
```

### Can't Connect to Server

**From Emulator:**
- Use `10.0.2.2` not `localhost`
- Example: `http://10.0.2.2:5000`

**From Device:**
- Use your computer's IP
- Get IP: `ifconfig | grep "inet "`
- Example: `http://192.168.1.100:5000`

### WebSocket Won't Connect

Check `app.js` Socket.IO configuration:
```javascript
const io = socketIo(server, {
    cors: { origin: '*' }  // Allow all origins for dev
});
```

### APK Won't Install

```bash
# Check if another version exists
adb uninstall com.gamelab.app

# Then install
adb install app/build/outputs/apk/debug/app-debug.apk
```

### App Crashes When Opening

- Check Android Studio Logcat for errors
- Ensure server is running: `npm start`
- Verify server URL in configuration
- Check network connectivity

## 📈 Next Steps

1. **Immediate**: Test the APK on an emulator
   ```bash
   npx cap open android
   # Build in Android Studio
   ```

2. **Short-term**: Deploy your Node.js server
   - Choose a hosting platform
   - Push your code
   - Get public URL

3. **Medium-term**: Build release APK and distribute
   - Generate signed APK
   - Update server configuration
   - Distribute to users

4. **Long-term**: Publish to Google Play Store
   - Create Google Play Developer account ($25)
   - Follow Play Store submission requirements
   - Set privacy policy and content rating

## 📚 Resources

- **Capacitor Docs**: https://capacitorjs.com/docs
- **Android Docs**: https://developer.android.com/docs
- **Node.js Deploy**: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
- **Socket.IO**: https://socket.io/docs/v4/
- **Android Studio**: https://developer.android.com/studio

## 💡 Pro Tips

1. **Test on real device** - Emulator may not reflect real performance
2. **Use Chrome DevTools** - Open DevTools in Android Studio to debug WebView
3. **Monitor Gradle** - First build takes longest, subsequent builds are faster
4. **Frequent testing** - Test after each major code change
5. **Create multiple APKs** - Debug APK for testing, Release APK for distribution

## 🎯 You're All Set!

Your GameLab app is ready to become an Android app. Start with:

```bash
./setup-android.sh
```

Or jump straight to building:

```bash
npx cap open android
```

Enjoy! 🎮

---

**Questions?** Check `APK_BUILD_GUIDE.md` for detailed troubleshooting.


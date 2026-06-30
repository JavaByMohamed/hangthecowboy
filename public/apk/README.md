# APK Download Feature - Production Setup

This directory (`public/apk/`) serves APK files for download from your server.

## How It Works

The `/download/latest-apk` endpoint searches for release APKs in this order:

1. **Local builds** (if running on development machine):  
   `android/app/build/outputs/apk/release/app-release.apk`

2. **Public upload** (for production servers):  
   `public/apk/app-release.apk`

This way:
- **Locally**: Use your freshly-built signed APK automatically
- **Production**: Upload a pre-built APK for users to download

## Production Deployment

### Option A: Commit APK to Git (Simple but Large)

```bash
# After building locally, copy APK here
cp android/app/build/outputs/apk/release/app-release.apk public/apk/

# Commit and push to your repo
git add public/apk/app-release.apk
git commit -m "Deploy signed APK"
git push
```

Then deploy normally to Render/Railway/Heroku, and the APK will be available for download.

### Option B: Upload APK After Deployment (Recommended)

If your APK is large (>25MB), avoid committing it to git:

```bash
# After deploying to production, upload APK via SFTP/SCP/FTP
# OR use a CI/CD pipeline to upload after building

scp app-release.apk user@your-server.com:/path/to/gamelab/public/apk/
```

### Option C: Use CI/CD Pipeline (Advanced)

Create a GitHub Actions / GitLab CI / Azure Pipelines workflow that:
1. Builds the APK on every release
2. Uploads it to your production server or S3

## Managing Multiple Versions

You can store multiple APKs:

```
public/apk/
├── .gitkeep
├── app-release.apk              # Latest production version
├── app-release-1.0.0.apk        # Version 1.0.0 archive
└── app-release-1.1.0.apk        # Version 1.1.0 archive
```

The download endpoint will serve **the latest by modification time**.

## Important Notes

- **Keystore Password**: Your release keystore password is stored in `android/keystore.properties` (git-ignored for security)
- **APK Size**: Large APK files (>50MB) may cause deployment timeouts
- **Signing**: Only signed APKs can be published to Google Play Store
- **Updates**: When publishing updates, rebuild the APK, increment version code, and replace the file in `public/apk/`

## Troubleshooting

**"No release APK file found" message:**
- Check that `app-release.apk` exists in this directory
- On production, ensure it was uploaded or deployed correctly

**Very old timestamp:**
- The endpoint returns the **newest APK by modification time**
- If uploading, update the file's timestamp: `touch public/apk/app-release.apk`

---

For more details, see `ANDROID_APK_README.md` or `APK_BUILD_GUIDE.md`.


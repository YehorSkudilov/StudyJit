# StudyJit app

The StudyJit app for Android, iPhone and iPad, Mac and Windows (.NET MAUI), built on
[AppSkeleton](https://github.com/YehorSkudilov/AppSkeleton) like Gym Book: the same swipeable tabs with the glass nav
bar, pull to refresh, loading screen and dark look. Like the website it holds no data of its own: everything comes from
the API (`../StudyJit.Api`) with the signed-in user's token (`Src/Services/ApiClient.cs`).

- **Home**: how studying is going, what's being generated now, and the study sets to do next.
- **Courses**: add courses by hand or paste a course list for the AI to read. A course has its study sets (one per
  folder of files), exams (built from chosen sets) and files: upload files or a YouTube video, folders, Sort with AI.
- **Library**: every study set and exam, searchable.
- **Study modes** (`Src/Views/Study`): Learn, Flashcards, Practice, Test, Match, True or False, Write, Exam answers
  (marked by the AI), Study guide and Cheat sheet, as on the website. What came up and how it went is kept on the device
  (`StudyHistory`), so new and missed questions come first.
- **Profile**: name, email, password, links to the website, signing out.

## Running it

AppSkeleton is referenced as `../../AppSkeleton`, so clone it next to this repository:

```bash
git clone https://github.com/YehorSkudilov/AppSkeleton.git ../AppSkeleton
```

```bash
cp StudyJit/.env.example StudyJit/.env   # set API_BASE_URL (and WEB_BASE_URL)
```

```bash
dotnet build StudyJit/StudyJit.csproj -f net10.0-android
```

Android builds anywhere (Linux too); iOS and Mac need a Mac, Windows needs Windows. Open `StudyJit.slnx` in Visual
Studio or Rider to run it on a device.

## Publishing

**Publish** (or **Publish App** alone) builds and uploads every platform picked, the same way Gym Book does: it bumps
the version in `StudyJit.csproj`, then Android goes to Google Play (the release channel picked), Windows to the
Microsoft Store, iOS to TestFlight and the Mac to App Store Connect, and the Android files go on a GitHub release.
Submitting for review stays manual in each store.

Set up once, in the repository's Settings › Secrets and variables › Actions (the same names as Gym Book's):

| What | Secrets | Variables |
| --- | --- | --- |
| Everything | `REPO_TOKEN` (reads AppSkeleton) | `API_BASE_URL`, `WEB_URL` (already there for the website) |
| Android | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYALIAS_NAME`, `ANDROID_KEYALIAS_PASS`, `ANDROID_KEYSTORE_PASS`, `SERVICE_ACCOUNT_JSON` | |
| Windows | `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `MSSTORE_SELLER_ID` | `MSSTORE_PACKAGE_NAME`, `MSSTORE_PUBLISHER`, `MSSTORE_PUBLISHER_DISPLAY_NAME`, `MSSTORE_PRODUCT_ID` |
| iOS | `IOS_P12_BASE64`, `IOS_P12_PASSWORD`, `IOS_PROFILE_BASE64`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_PRIVATE_KEY` | `IOS_XCODE_VERSION` (optional) |
| Mac | the iOS ones, plus `MACOS_INSTALLER_P12_BASE64`, `MACOS_INSTALLER_P12_PASSWORD`, `MACOS_PROFILE_BASE64` | |

The app is new to each store, so first:

- **Google Play**: create the app for `com.yehorskudilov.studyjit`, make a keystore for it, and upload the first AAB by
  hand (Play only lets the API upload once the app exists). The Gym Book service account can be given access to it.
- **Apple**: an App ID and App Store provisioning profiles (iOS and Mac Catalyst) for `com.yehorskudilov.studyjit`, and
  the app in App Store Connect. The distribution certificate and API key can be Gym Book's.
- **Microsoft Store**: reserve the name in Partner Center and copy its identity into the `MSSTORE_*` variables.

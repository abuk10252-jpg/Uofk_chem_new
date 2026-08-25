# UofK Chem - Mobile App

## Overview
A mobile (Expo/React Native) app for UofK Chem (University of Khartoum Chemistry Department) that provides:
- User authentication and role-based access (student/admin/super_admin) with pending/rejected states
- Tabbed student area with Academic, News, and Profile tabs
- Course content viewing with file upload/download (admin feature)
- Admin screens for user management, course/news creation, and quiz results
- Super admin screens for role/settings management
- Notifications screen
- Firebase Authentication integration
- Server API integration (REST calls to `https://server-2-xpsh.onrender.com/api`)
- Offline handling via NetInfo

## Architecture
- **Framework**: Expo 55 / React Native with expo-router (file-based routing)
- **Language**: TypeScript + JavaScript
- **Authentication**: Firebase Auth with custom backend `/auth/me` endpoint
- **State**: React Context (AuthContext) + AsyncStorage for persistence
- **API**: REST wrapper in `src/utils/api.ts` with Bearer token support
- **Internationalization**: EN/AR translations via `src/utils/i18n.ts`
- **Package Manager**: npm (yarn.lock present but npm used for install)

## Project Structure
```
app/               # expo-router routes
  _layout.tsx      # Root layout
  index.tsx        # Role-based redirect router
  login.tsx        # Login screen
  register.tsx     # Registration screen
  pending.tsx      # Pending approval screen
  (tabs)/          # Student tab area
    academic.tsx   # Academic courses tab
    news.tsx       # News tab
    profile.tsx    # Profile tab
  course/[id].tsx  # Course detail with files
  admin/           # Admin screens
  super-admin/     # Super admin screens
  notifications/   # Notifications
src/
  context/AuthContext.tsx  # Auth state management
  firebase.ts              # Firebase initialization
  utils/api.ts             # REST API wrapper
  utils/i18n.ts            # Internationalization
  utils/storage.js         # Storage utilities
  constants/colors.ts      # Color constants
  components/              # Shared components
assets/            # Images and icons
```

## Configuration
- **Backend API**: `https://server-2-xpsh.onrender.com/api` (configured in `app.json` extra.API_URL)
- **Firebase**: Uses environment variables (EXPO_PUBLIC_FIREBASE_*)
- **Metro config**: `metro.config.js` - configured to limit file watchers

## Running Locally
- Workflow: "Start application" runs `npx expo start --web --port 5000 --localhost`
- Web preview available at port 5000

## Deployment
- Target: autoscale
- Run: `npx expo start --web --port 5000 --localhost --no-dev --minify`

## Notes
- Package.json had escaped tildes (`\~`) in version strings, fixed to `~`
- Metro configured to block `.cache` and native platform directories to avoid ENOSPC
- `react-native-web` and `@expo/metro-runtime` installed for web support

# Hướng B: Backend — User System & Progress Tracking

TODO list for implementing Auth, Progress, and Leaderboard systems.

## Backend (NestJS)
- [x] Install backend dependencies (`bcryptjs`, `@types/bcryptjs`, `@nestjs/jwt`)
- [x] Create `User` entity
- [x] Create `UsersModule` (Service & Repository)
- [x] Create `AuthModule` (Register, Login, Profile endpoints, `JwtAuthGuard`, `CurrentUser` decorator)
- [x] Create `Progress` entity
- [x] Create `ProgressModule` (Save progress API, Leaderboard API, Stats API)
- [x] Verify Server compiling and APIs using Swagger

## Frontend (Next.js)
- [x] Create HTTP client utility `src/lib/api.ts`
- [x] Implement custom Navbar in client layout showing Login / Logout / User profile avatar
- [x] Create Login page `/login`
- [x] Create Register page `/register` with cute animal avatar picker
- [x] Create Profile page `/profile` displaying statistics and earned medals
- [x] Integrate API calls into challenge pages (`fingers`, `gestures`, `face`) to save high scores
- [x] Display top 5 live leaderboard in the left panel of challenge pages
- [x] Compile and verify client builds successfully with Webpack

# UTME Mock CBT Platform - TODO (Updated from Code Audit)

## Phase 1: Foundation

- [x] Database schema for users, questions, sessions, results, exams, groups, notifications, generated questions
- [x] Drizzle migrations created for schema evolution (0000 to 0004)
- [x] Design system and theme tokens configured
- [x] Global styles and typography configured
- [x] Seed question dataset present in questions-data.json

## Phase 2: Authentication & Access

- [x] OAuth login entry points wired from landing and signup screens
- [x] Server-side OAuth token exchange and user upsert flow
- [x] Session cookie handling and logout flow
- [x] Protected route handling
- [x] Role-based access control for user and admin
- [ ] Decide whether to keep current OAuth-only onboarding or implement true form signup

## Phase 3: Admin Dashboard

- [x] Admin dashboard page and layout
- [x] Question CRUD (create, edit, delete)
- [x] Question filtering and search (topic, difficulty, text)
- [x] Pagination for question bank
- [x] Bulk import with JSON and CSV support
- [x] Import preview, validation, duplicate detection, and error export
- [x] Manager account creation flow
- [x] Admin user listing

### Phase 3.1: Exam Management

- [x] Exam create, update, delete
- [x] Subject-based question counts
- [x] Optional manual question selection
- [x] Shuffle questions per user toggle
- [x] Show results after submission toggle
- [x] Availability timestamp control
- [x] Group targeting for exam access

### Phase 3.2: Exam Admin List

- [x] Total question count shown (manual + subject-based)
- [x] Subject badges shown in exam table
- [x] Shuffle status shown in exam table
- [x] Group restriction visibility in exam table
- [x] Expanded exam table columns for review speed

## Phase 4: Student Exam Experience

- [x] Exam selection dropdown on start screen
- [x] Availability filtering by timestamp and user group
- [x] Contextual no-exam messaging with group hints
- [x] Exam metadata display (duration, totals, groups, shuffle behavior)
- [x] Timer countdown with warning state
- [x] Question navigation (prev, next, jump)
- [x] Auto-save progress during session
- [x] Session start and submit flow via TRPC

### Phase 4.1: Session Integrity

- [x] Session stores exact ordered question IDs
- [x] Submission scoring uses session question set consistently
- [x] Legacy fallback behavior retained for older sessions

## Phase 5: Results

- [x] Score and percentage display
- [x] Topic performance breakdown
- [x] Answer review details
- [x] Time-taken tracking
- [x] Retake and navigation flow
- [ ] Downloadable PDF results

## Phase 6: AI, Voice, Media, Notifications

- [x] LLM utility layer available in core module
- [x] Voice transcription utility implemented in core module
- [x] Image generation utility implemented in core module
- [x] Owner notification utility and system notify endpoint
- [ ] Expose voice/image/LLM features through product-facing app routes and UI
- [ ] Implement automatic AI question generation workflow (UI + approvals + persistence)
- [ ] Implement automated result emails and completion notifications
- [ ] Add notification preferences management flow in app UI

## Phase 7: Testing & QA

- [x] Logout behavior test exists
- [ ] Add unit tests for question CRUD and exam creation rules
- [ ] Add tests for exam session start/save/submit lifecycle
- [ ] Add tests for result calculation correctness
- [ ] Add role authorization tests for admin-only routes
- [ ] Add end-to-end browser tests for core student and admin flows

## Phase 8: Release Readiness

- [ ] Run migrations in target environment and verify schema state
- [ ] Validate env setup for OAuth, database, and forge services
- [ ] Run type-check, tests, and production build in CI
- [ ] Add operational monitoring and error logging checks
- [ ] Final UAT pass across desktop and mobile

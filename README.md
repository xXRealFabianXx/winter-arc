# Winter Arc

Persönliches Trainings-Dashboard: Rad + Gym, 16 Etappen vom 12.10.2026 bis 31.1.2027.

- `index.html` – die komplette Seite (Plan, Umplanung, Ringe, Abzeichen, 3D-Rad)
- Einträge (Ruhetage, Festlegungen, abgehakte Übungen) liegen vorerst im Browser (localStorage)

## Fahrplan
1. Online auf Vercel (statische Seite) ✓
2. Strava über eigene API-App (`/api`-Funktionen auf Vercel) ← jetzt
3. Supabase als Speicher für Einträge
4. Login: nur der eigene Strava-Account darf eintragen
5. Feinschliff: App-Icon, Domain, Design

## Strava
- Umgebungsvariablen in Vercel: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`
- `/api/auth/login` → Strava-Anmeldung, `/api/auth/callback` → speichert die Sitzung als verschlüsseltes Cookie
- `/api/strava` → Aktivitäten seit 14.9.2026, FTP, Gewicht, Räder
- `/api/auth/logout` → Strava-Verbindung in diesem Browser trennen

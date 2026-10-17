# StudyJit website

The StudyJit UI (Next.js). It holds no data and no secrets: everything comes from the API (`../StudyJit.Api`), called
from the browser with the signed-in user's token (see `src/lib/api.ts`).

```bash
cp .env.example .env.local   # point NEXT_PUBLIC_API_URL at a running API
npm install
npm run dev
```

The API must list this site's address in `Cors__AllowedOrigins`.

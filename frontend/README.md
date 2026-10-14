# Smart Workforce: Frontend

React 19 + Vite app for the Smart Workforce & Task Allocation System.

```bash
npm install
npm run dev      # http://localhost:5173, /api is proxied to http://localhost:5000
npm run build    # production build → dist/ (served by the backend in production)
npm run lint     # oxlint
```

The backend must be running (`cd ../backend && npm run dev`, or `npm run dev` from the repository root to start both).

Architecture, routes and conventions: [../docs/ai/FRONTEND.md](../docs/ai/FRONTEND.md).

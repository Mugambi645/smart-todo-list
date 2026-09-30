# Smart To-Do — Full-Stack CRUD App with AI Categorization

A classic to-do list (Create, Read, Update, Delete) enhanced with AI: every
task is automatically categorized and prioritized based on its text, using
a Hugging Face zero-shot-classification model.

## Stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **AI:** Hugging Face Inference API (`facebook/bart-large-mnli` zero-shot
  classification by default — swap via `HF_MODEL`), with a built-in
  keyword-based local fallback so the app always works offline/in CI.
- **CI/CD:** GitHub Actions (test → build → push Docker images to GHCR)
- **Containers:** Docker + docker-compose

## How the AI categorization works

1. When a task is created (or its text edited), the backend sends the
   title + description to a Hugging Face zero-shot-classification model
   along with a list of candidate categories (`TASK_CATEGORIES`).
2. The model returns a ranked list of category scores; the top one becomes
   the task's `category`.
3. Priority (`low` / `medium` / `high`) is derived from urgency keywords
   ("urgent", "asap", "deadline"...) plus the model's confidence score.
4. If there's no Hugging Face token, the call fails, or
   `USE_LOCAL_FALLBACK=true`, the backend falls back to a local
   keyword-matching classifier (`backend/src/services/classifier.js`) —
   no network call needed. This keeps the app fully demoable and makes CI
   deterministic and free.

## Quick start (Docker)

```bash
git clone <your-repo-url>
cd todo-app
cp backend/.env.example .env   # then edit HUGGINGFACE_API_TOKEN if you have one
docker compose --env-file .env up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api/tasks
- Postgres: localhost:5432 (user `todo_user` / pass `todo_pass` / db `todo_db`)

Without a Hugging Face token, set `USE_LOCAL_FALLBACK=true` in `.env` and
the app will use the local keyword classifier automatically.

## Local development (without Docker)

**Backend**
```bash
cd backend
cp .env.example .env
npm install
npm run migrate     # creates the tasks table
npm run dev          # http://localhost:4000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /api to :4000
```

## API

| Method | Route                     | Description                                    |
|--------|---------------------------|-------------------------------------------------|
| GET    | `/api/tasks`               | List tasks (`?category=`, `?completed=`)        |
| GET    | `/api/tasks/:id`            | Get one task                                    |
| POST   | `/api/tasks`                | Create task `{ title, description? }` — AI-classified |
| PUT    | `/api/tasks/:id`            | Update task; re-classifies if text changed and category/priority not explicitly set |
| DELETE | `/api/tasks/:id`            | Delete task                                     |
| GET    | `/api/tasks/meta/categories`| List candidate categories                       |

## Testing

```bash
cd backend
npm test
```

Tests run with `USE_LOCAL_FALLBACK=true` so they need no external API
calls or credentials, and pass the same way in CI.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:
1. Spins up a Postgres service container, runs migrations, runs backend tests.
2. Builds the frontend.
3. On push to `main`, builds and pushes both Docker images to GitHub
   Container Registry (`ghcr.io/<owner>/<repo>/todo-backend` and
   `todo-frontend`).

## Project structure

```
todo-app/
├── backend/
│   ├── src/
│   │   ├── db/           # pool, schema.sql, migration runner
│   │   ├── routes/       # tasks CRUD routes
│   │   ├── services/     # classifier.js (HF + local fallback)
│   │   ├── __tests__/    # jest tests
│   │   └── index.js      # express app
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/   # TaskForm, TaskList, TaskItem
│   │   ├── App.jsx
│   │   └── api.js
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Extending

- Swap the HF model: change `HF_MODEL` (any zero-shot-classification
  model on the Hugging Face Hub works, e.g. multilingual models for
  Swahili task text).
- Swap Postgres for MongoDB: replace `src/db/*` and the `pg` queries in
  `routes/tasks.js` with a Mongoose model — the route contracts (request/
  response shapes) can stay the same so the frontend needs no changes.
# smart-todo-list

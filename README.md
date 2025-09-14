# storia

start api with
```
cd apps/backend
PIPENV_PIPFILE=./Pipfile pipenv install -r requirements.txt
pipenv run uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

start frontend with
```
cd apps/web
npm install
npm run dev
```
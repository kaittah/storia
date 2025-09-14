from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from langgraph import Client
from supabase import create_client

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE")
supabase = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

LANGGRAPH_API_URL = os.environ.get("LANGGRAPH_API_URL", "http://127.0.0.1:2024")
langgraph_client = Client(api_url=LANGGRAPH_API_URL, api_key=os.environ.get("LANGCHAIN_API_KEY"))

async def verify_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = auth_header.replace("Bearer ", "")
    
    try:
        user = supabase.auth.get_user(token)
        return user.data
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
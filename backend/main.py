
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.models import FailureRequest
from backend.simulation import (
    get_system_status,
    simulate_failure,
    recover_service,
    reset_system,
)
from backend.ai_service import generate_incident_analysis


# Load the .env file from the main ChaosLab-AI folder.
PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

load_dotenv(
    dotenv_path=os.path.join(PROJECT_ROOT, ".env")
)


# Create the FastAPI application.
app = FastAPI(
    title="ChaosLab AI",
    description="A local distributed-system failure simulator",
    version="1.0.0",
)


# Allow requests from the React frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to ChaosLab AI!",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }


@app.get("/system")
def system_status():
    return get_system_status()


@app.post("/failure")
def trigger_failure(request: FailureRequest):
    result = simulate_failure(
        request.service_name,
        request.failure_type,
    )

    if "error" in result:
        raise HTTPException(
            status_code=400,
            detail=result["error"],
        )

    return result


@app.post("/recover/{service_name}")
def recover(service_name: str):
    result = recover_service(service_name)

    if "error" in result:
        raise HTTPException(
            status_code=404,
            detail=result["error"],
        )

    return result


@app.post("/reset")
def reset():
    return reset_system()


@app.post("/analyze")
def analyze_incident(request: FailureRequest):
    system_status = get_system_status()

    analysis = generate_incident_analysis(
        service_name=request.service_name,
        failure_type=request.failure_type,
        system_status=system_status,
    )

    return {
        "service_name": request.service_name,
        "failure_type": request.failure_type,
        "analysis": analysis,
    }


from pydantic import BaseModel
from typing import Literal


class Service(BaseModel):
    name: str
    status: Literal["healthy", "failed", "slow"] = "healthy"
    latency_ms: float = 50.0
    failure_rate: float = 0.0


class FailureRequest(BaseModel):
    service_name: str
    failure_type: Literal["shutdown", "latency", "overload"]

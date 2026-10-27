
from backend.models import Service


services = {
    "API Gateway": Service(name="API Gateway"),
    "User Service": Service(name="User Service"),
    "Payment Service": Service(name="Payment Service"),
    "Database": Service(name="Database"),
}

dependencies = {
    "API Gateway": ["User Service", "Payment Service"],
    "User Service": ["Database"],
    "Payment Service": ["Database"],
    "Database": [],
}


def get_system_status():
    return {
        "services": {
            name: service.model_dump()
            for name, service in services.items()
        },
        "dependencies": dependencies,
    }


def propagate_failures():
    """Propagate complete failures through dependent services."""
    changed = True

    while changed:
        changed = False

        for dependent_name, required_services in dependencies.items():
            dependent = services[dependent_name]

            if dependent.status == "failed":
                continue

            if any(
                services[name].status == "failed"
                for name in required_services
            ):
                dependent.status = "failed"
                dependent.failure_rate = 100.0
                changed = True


def simulate_failure(service_name: str, failure_type: str):
    """Simulate shutdown, high latency, or overload."""

    if service_name not in services:
        return {"error": f"Service '{service_name}' not found"}

    if failure_type not in ["shutdown", "latency", "overload"]:
        return {"error": "Invalid failure type"}

    service = services[service_name]

    if failure_type == "shutdown":
        service.status = "failed"
        service.failure_rate = 100.0

    elif failure_type == "latency":
        service.status = "slow"
        service.latency_ms = 1000.0
        service.failure_rate = 0.0

    elif failure_type == "overload":
        service.status = "slow"
        service.latency_ms = 2000.0
        service.failure_rate = 50.0

    propagate_failures()

    return {
        "message": f"{service_name} is now experiencing {failure_type}",
        "service": service.model_dump(),
        "system": get_system_status(),
    }


def recover_service(service_name: str):
    """Recover a service and any failed dependents whose dependencies are healthy."""

    if service_name not in services:
        return {"error": f"Service '{service_name}' not found"}

    service = services[service_name]
    service.status = "healthy"
    service.latency_ms = 50.0
    service.failure_rate = 0.0

    changed = True

    while changed:
        changed = False

        for dependent_name, required_services in dependencies.items():
            dependent = services[dependent_name]

            if dependent_name == service_name:
                continue

            dependencies_healthy = all(
                services[name].status == "healthy"
                for name in required_services
            )

            if dependent.status == "failed" and dependencies_healthy:
                dependent.status = "healthy"
                dependent.latency_ms = 50.0
                dependent.failure_rate = 0.0
                changed = True

    propagate_failures()

    return {
        "message": f"{service_name} recovery attempted",
        "service": service.model_dump(),
        "system": get_system_status(),
    }


def reset_system():
    """Restore all services to their default state."""

    for service in services.values():
        service.status = "healthy"
        service.latency_ms = 50.0
        service.failure_rate = 0.0

    return {
        "message": "System reset successfully",
        "services": {
            name: service.model_dump()
            for name, service in services.items()
        },
    }

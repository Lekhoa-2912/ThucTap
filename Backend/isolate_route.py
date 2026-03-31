import sys
import os
import traceback
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from fastapi.openapi.utils import get_openapi

def test_routes():
    # Clear error log first
    with open("route_error.txt", "w") as f:
        f.write("--- ROUTE ERRORS ---\n")
    from fastapi.routing import APIRoute
    for route in app.routes:
        if isinstance(route, APIRoute):
            try:
                # Mock a small app with just this route to test openapi generator
                from fastapi import FastAPI
                test_app = FastAPI()
                test_app.router.routes.append(route)
                test_app.openapi()
            except Exception as e:
                with open("route_error.txt", "a") as f:
                    f.write(f"\nFAILED ROUTE: {route.path} [{route.methods}]\n")
                    traceback.print_exc(file=f)

if __name__ == "__main__":
    test_routes()

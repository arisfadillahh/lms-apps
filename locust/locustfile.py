import os

from locust import HttpUser, task, between
from locust.exception import StopUser


class CoderUser(HttpUser):
    # Adjust wait time to simulate real users
    wait_time = between(1, 3)

    @task(3)
    def get_dashboard(self):
        self.client.get("/coder/dashboard", name="GET /coder/dashboard")

    @task(1)
    def get_reports(self):
        self.client.get("/coder/reports", name="GET /coder/reports")

    @task(1)
    def get_ekskul(self):
        self.client.get("/coder/ekskul", name="GET /coder/ekskul")

    @task(1)
    def get_makeup(self):
        self.client.get("/coder/makeup", name="GET /coder/makeup")

    @task(1)
    def get_materials(self):
        self.client.get("/coder/materials", name="GET /coder/materials")

    @task(1)
    def get_profile(self):
        self.client.get("/coder/profile", name="GET /coder/profile")

    def on_start(self):
        username = os.getenv("LOCUST_USERNAME")
        password = os.getenv("LOCUST_PASSWORD")

        if not username or not password:
            raise StopUser("Missing LOCUST_USERNAME/LOCUST_PASSWORD")

        csrf_token = None
        with self.client.get("/api/auth/csrf", name="GET /api/auth/csrf", catch_response=True) as response:
            if response.status_code != 200:
                response.failure("Failed to fetch CSRF token")
                raise StopUser("Unable to login")
            try:
                csrf_token = response.json().get("csrfToken")
            except ValueError:
                response.failure("Invalid CSRF response")
                raise StopUser("Unable to login")

        if not csrf_token:
            raise StopUser("Missing CSRF token")

        payload = {
            "csrfToken": csrf_token,
            "username": username,
            "password": password,
            "redirect": "false",
            "json": "true",
            "callbackUrl": "/",
        }

        with self.client.post(
            "/api/auth/callback/credentials",
            data=payload,
            name="POST /api/auth/callback/credentials",
            catch_response=True,
        ) as response:
            if response.status_code not in (200, 302):
                response.failure(f"Login failed: {response.status_code}")
                raise StopUser("Unable to login")

        with self.client.get("/api/auth/session", name="GET /api/auth/session", catch_response=True) as response:
            if response.status_code != 200:
                response.failure("Failed to verify session")
                raise StopUser("Unable to login")
            try:
                data = response.json()
            except ValueError:
                response.failure("Invalid session response")
                raise StopUser("Unable to login")

            role = (data.get("user") or {}).get("role")
            if role != "CODER":
                response.failure(f"Unexpected role: {role}")
                raise StopUser("User is not CODER")

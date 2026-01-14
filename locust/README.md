# Locust load testing

This folder contains a basic Locust setup for this project.

## Requirements
- Python 3.8+
- Locust

## Install
```
pip install locust
```

## Run (local)
```
LOCUST_USERNAME=your_user LOCUST_PASSWORD=your_pass \
  locust -f locust/locustfile.py --host=http://127.0.0.1:3005
```

Then open: http://localhost:8089

## Notes
- Current tasks hit coder pages: `/coder/dashboard`, `/coder/reports`, `/coder/ekskul`, `/coder/makeup`, `/coder/materials`, `/coder/profile`.
- The script logs in via NextAuth credentials using `LOCUST_USERNAME` and `LOCUST_PASSWORD`.
- Add dynamic coder routes (like `/coder/materials/[lessonId]`) once you have IDs.
- If you use HTTPS with a public domain:
```
LOCUST_USERNAME=your_user LOCUST_PASSWORD=your_pass \
  locust -f locust/locustfile.py --host=https://lms.clev.io
```

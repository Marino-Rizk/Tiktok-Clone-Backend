import os

os.environ.setdefault("MONGODB_URI", "mongodb://127.0.0.1:27017/test")
os.environ.setdefault("FLASK_DEBUG", "False")
os.environ.setdefault("LLM_API_KEY", "")

import app  # noqa: F401

print("IMPORT_OK")


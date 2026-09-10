# ScanRig Final Server — Python Environment Fix

This build was patched from the server archive supplied by the user.

## AI retraining change
The server now:
1. Resolves AI_TRAINING_DIR.
2. Prefers `scanrig-ai/.venv/Scripts/python.exe` on Windows (or `.venv/bin/python` on macOS/Linux).
3. Verifies TensorFlow, ONNX, and ONNX Runtime before preprocessing or training.
4. Logs the exact Python executable and versions.
5. Falls back to a generic Python command only when no project virtual environment exists.

`PYTHON_BIN` can be left blank when the AI virtual environment lives inside `scanrig-ai/.venv`.

## Security
The uploaded Gemini API key was removed from this archive. Create/rotate your key and put the new value only in your local `.env`.

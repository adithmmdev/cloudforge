import zipfile
import os

with zipfile.ZipFile("mern.zip", "w") as zf:
    for root, dirs, files in os.walk("backend/tests/fixtures/mern-sample"):
        for f in files:
            full_path = os.path.join(root, f)
            arcname = os.path.relpath(full_path, "backend/tests/fixtures/mern-sample").replace("\\", "/")
            zf.write(full_path, arcname)
print("Created mern.zip properly.")

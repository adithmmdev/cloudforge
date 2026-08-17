import os
import pytest
from app.detector import registry
from app.detector.adapters.express import UnsupportedStackError

base_dir = "tests/fixtures"

def test_react_vite():
    adapter, meta = registry.detect(os.path.join(base_dir, "react-sample"))
    assert adapter is not None
    assert adapter.name == "react"
    assert meta["build_output_dir"] == "dist"

def test_react_cra():
    adapter, meta = registry.detect(os.path.join(base_dir, "react-cra-sample"))
    assert adapter is not None
    assert adapter.name == "react"
    assert meta["build_output_dir"] == "build"

def test_express():
    adapter, meta = registry.detect(os.path.join(base_dir, "express-sample"))
    assert adapter is not None
    assert adapter.name == "express"
    assert meta["entry_file"] == "src/server.js"

def test_express_ts():
    with pytest.raises(UnsupportedStackError):
        registry.detect(os.path.join(base_dir, "express-ts-sample"))

def test_flask():
    adapter, meta = registry.detect(os.path.join(base_dir, "flask-sample"))
    assert adapter is not None
    assert adapter.name == "flask"
    assert meta["wsgi_module"] == "app:app"

def test_fastapi():
    adapter, meta = registry.detect(os.path.join(base_dir, "fastapi-sample"))
    assert adapter is not None
    assert adapter.name == "fastapi"
    assert meta["module_path"] == "app.main"
    assert meta["app_var"] == "my_api"

def test_mern():
    adapter, meta = registry.detect(os.path.join(base_dir, "mern-sample"))
    assert adapter is not None
    assert adapter.name == "mern"
    assert "client" in meta
    assert "server" in meta

def test_broken_variants():
    assert registry.detect(os.path.join(base_dir, "broken-react"))[0] is None
    assert registry.detect(os.path.join(base_dir, "broken-express"))[0] is None
    assert registry.detect(os.path.join(base_dir, "broken-flask"))[0] is None
    assert registry.detect(os.path.join(base_dir, "broken-fastapi"))[0] is None
    assert registry.detect(os.path.join(base_dir, "broken-mern"))[0] is None


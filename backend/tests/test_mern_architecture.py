import pytest
import os
import shutil
from app.detector.adapters.express import _discover_mongo_config

@pytest.fixture
def temp_project(tmpdir):
    def _make(env_content, js_content):
        d = tmpdir.mkdir("test_project")
        if env_content:
            with open(os.path.join(str(d), ".env"), "w") as f:
                f.write(env_content)
        if js_content:
            with open(os.path.join(str(d), "index.js"), "w") as f:
                f.write(js_content)
        return str(d)
    return _make

def test_mongoose_connect(temp_project):
    p = temp_project(
        "MONGO_URI=mongodb+srv://foo:bar@cluster.net/app",
        "mongoose.connect(process.env.MONGO_URI);"
    )
    res = _discover_mongo_config(p)
    assert res["env_var"] == "MONGO_URI"
    assert res["db_name"] == "app"

def test_custom_db_name(temp_project):
    p = temp_project(
        "MY_DB_CONN=mongodb://localhost:27017/custom_db_name",
        "mongoose.connect(process.env.MY_DB_CONN);"
    )
    res = _discover_mongo_config(p)
    assert res["env_var"] == "MY_DB_CONN"
    assert res["db_name"] == "custom_db_name"

def test_uri_options(temp_project):
    p = temp_project(
        "DB=mongodb://host/db?retryWrites=true&w=majority",
        "mongoose.connect(process.env.DB);"
    )
    res = _discover_mongo_config(p)
    assert res["env_var"] == "DB"
    assert res["db_name"] == "db"
    assert res["options"] == "retryWrites=true&w=majority"

def test_missing_env(temp_project):
    p = temp_project(None, "mongoose.connect('mongodb://localhost/test');")
    res = _discover_mongo_config(p)
    assert res["env_var"] == "MONGO_URI"

def test_process_env_discovery(temp_project):
    p = temp_project(None, "mongoose.connect(process.env.MONGODB_ATLAS_CONNECTION);")
    res = _discover_mongo_config(p)
    assert res["env_var"] == "MONGODB_ATLAS_CONNECTION"

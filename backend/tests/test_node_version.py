import os
import shutil
import pytest
from app.build_service.builder import get_node_version
import json

def create_mock_project(tmp_path, name, package_json_content):
    project_dir = tmp_path / name
    project_dir.mkdir()
    pkg_file = project_dir / "package.json"
    with open(pkg_file, "w") as f:
        json.dump(package_json_content, f)
    return str(project_dir)

def test_node_version_detection(tmp_path):
    # 1. React project missing @types/node.
    p1 = create_mock_project(tmp_path, "missing-types", {
        "dependencies": {"react": "^18.0.0"}
    })
    assert get_node_version(p1) == "18"

    # 2. React project requiring Node >=20 via react-router.
    p2 = create_mock_project(tmp_path, "require-node-20", {
        "dependencies": {"react-router": "^7.4.0"}
    })
    assert get_node_version(p2) == "20"
    
    # Or via engines
    p2_engines = create_mock_project(tmp_path, "require-node-20-engines", {
        "engines": {"node": ">=20.0.0"}
    })
    assert get_node_version(p2_engines) == "20"
    
    # Or via @types/node
    p2_types = create_mock_project(tmp_path, "require-node-20-types", {
        "devDependencies": {"@types/node": "^20.10.0"}
    })
    assert get_node_version(p2_types) == "20"

    # 3. React project that works on Node 18.
    p3 = create_mock_project(tmp_path, "node-18-works", {
        "devDependencies": {"@types/node": "^18.0.0"}
    })
    assert get_node_version(p3) == "18"

    # 4. Existing MERN fixture. (Assume it has no special node version, so defaults to 18)
    # We can just test that an empty package.json returns 18
    p4 = create_mock_project(tmp_path, "empty-fixture", {})
    assert get_node_version(p4) == "18"

    # 5. The current real repository structure.
    # Real repo has @types/node ^20.10.0 and react-router is absent or present
    p5 = create_mock_project(tmp_path, "real-repo", {
        "dependencies": {
            "react": "^18.3.1",
            "react-dom": "^18.3.1"
        },
        "devDependencies": {
            "@types/node": "^20.10.0",
            "vite": "6.3.5"
        }
    })
    assert get_node_version(p5) == "20"

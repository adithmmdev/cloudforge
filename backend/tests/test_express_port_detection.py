import os
import pytest
from app.detector.adapters.express import _find_express_port

def test_find_express_port_default(tmp_path):
    project_dir = tmp_path / 'project'
    project_dir.mkdir()
    (project_dir / 'app.js').write_text('console.log("No port here");')
    assert _find_express_port(str(project_dir)) == '5000'

def test_find_express_port_process_env(tmp_path):
    project_dir = tmp_path / 'project'
    project_dir.mkdir()
    (project_dir / 'index.js').write_text('const PORT = process.env.PORT || 3000;\napp.listen(PORT);')
    assert _find_express_port(str(project_dir)) == '3000'

def test_find_express_port_process_env_8080(tmp_path):
    project_dir = tmp_path / 'project'
    project_dir.mkdir()
    (project_dir / 'index.js').write_text('const PORT = process.env.PORT || 8080;')
    assert _find_express_port(str(project_dir)) == '8080'

def test_find_express_port_app_listen(tmp_path):
    project_dir = tmp_path / 'project'
    project_dir.mkdir()
    (project_dir / 'server.js').write_text('app.listen(4000, () => {});')
    assert _find_express_port(str(project_dir)) == '4000'

def test_find_express_port_dockerfile_expose(tmp_path):
    project_dir = tmp_path / 'project'
    project_dir.mkdir()
    (project_dir / 'Dockerfile').write_text('FROM node:18\nEXPOSE 9000\nCMD ["npm", "start"]')
    (project_dir / 'server.js').write_text('const PORT = process.env.PORT || 3000;\napp.listen(PORT);')
    assert _find_express_port(str(project_dir)) == '9000'
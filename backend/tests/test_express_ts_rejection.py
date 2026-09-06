import pytest
from app.detector.adapters.express import detect_express

def test_express_ts_rejection(tmp_path):
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    (project_dir / "package.json").write_text('{"dependencies": {"express": "4.17.1"}}')
    (project_dir / "tsconfig.json").write_text('{}')
    (project_dir / "server.ts").write_text('import express from "express";')
    
    with pytest.raises(Exception, match="TypeScript Express is a known limitation this semester"):
        detect_express(str(project_dir))

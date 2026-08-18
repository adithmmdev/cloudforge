import os
from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app", "detector", "templates")

def test_fastapi_template():
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("fastapi.Dockerfile.j2")
    rendered = template.render(module_path="app.main", app_var="app")
    assert "uvicorn" in rendered
    assert "app.main:app" in rendered

def test_react_template():
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("react.Dockerfile.j2")
    rendered = template.render(build_output_dir="dist")
    assert "nginx" in rendered
    assert "nginx" in rendered

def test_express_template():
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("express.Dockerfile.j2")
    rendered = template.render(entry_file="src/index.js")
    assert "node" in rendered
    assert "src/index.js" in rendered

def test_flask_template():
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("flask.Dockerfile.j2")
    rendered = template.render(wsgi_module="app:app")
    assert "gunicorn" in rendered
    assert "app:app" in rendered

def test_mern_templates():
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    client = env.get_template("mern_client.Dockerfile.j2").render(build_output_dir="dist")
    server = env.get_template("mern_server.Dockerfile.j2").render(entry_file="server.js")
    nginx = env.get_template("mern_nginx.conf.j2").render()
    compose = env.get_template("mern_compose.yml.j2").render(project_id="test1", deployment_id="v1", host_port="8080")
    
    assert "nginx" in client
    assert "node" in server
    assert "proxy_pass http://server:5000;" in nginx
    assert "cloudforge-test1-client:v1" in compose
    assert "8080:80" in compose

def test_dockerignore():
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    rendered = env.get_template("dockerignore.j2").render()
    assert "node_modules" in rendered
    assert ".venv" in rendered

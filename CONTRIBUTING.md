# Contributing to CloudForge Adapters

CloudForge supports pluggable adapters to auto-detect frameworks and generate Dockerfiles.

## Creating a new Adapter

To create a new adapter (e.g., for Django, Vue, Next.js), you need to:

1. Create a new file in `backend/app/detector/adapters/`.
2. Implement a `detect(project_path: str) -> dict` function. This function should inspect the project directory, determine if the framework matches, and extract necessary entry-point information (e.g. start scripts, module paths).
3. Register your adapter in the priority list inside `backend/app/detector/registry.py`.
4. Add Jinja2 Dockerfile templates in `backend/app/build_service/templates/`. These templates should use the entry-point variables returned by your `detect` function.

### Adapter Contract

Your `detect` function must return a dictionary matching this schema if it successfully identifies the project:

```python
{
    "detected": True,
    "framework": "your_framework_name",
    "deployment_type": "single_container", # or "compose"
    "dockerfile_template": "your_template.jinja",
    "default_port": 8000,
    "health_check_hint": {"method": "GET", "path": "/"}
}
```

If not detected, return `{"detected": False}`.

## Priority Order

When adding an adapter to the registry, place it carefully in the priority list. More specific frameworks (e.g., MERN, Next.js) must be checked before generic ones (e.g., plain Node.js, plain React).

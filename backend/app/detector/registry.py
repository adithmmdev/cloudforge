from typing import List, Callable, Dict, Any, Optional

class Adapter:
    def __init__(self, name: str, detect_fn: Callable[[str], bool], extract_fn: Callable[[str], Dict[str, Any]], deployment_type: str = "single_container"):
        self.name = name
        self.detect_fn = detect_fn
        self.extract_fn = extract_fn
        self.deployment_type = deployment_type

class AdapterRegistry:
    def __init__(self):
        self._adapters: List[Adapter] = []

    def register(self, adapter: Adapter):
        self._adapters.append(adapter)

    def detect(self, project_path: str) -> Optional[tuple[Adapter, Dict[str, Any]]]:
        for adapter in self._adapters:
            if adapter.detect_fn(project_path):
                return adapter, adapter.extract_fn(project_path)
        return None, {}

registry = AdapterRegistry()

from . import adapters

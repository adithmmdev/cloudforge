import pytest
from app.remediation.classifier import classify_error

def test_missing_python_dep():
    res = classify_error("Traceback (most recent call last):\n  File \"app.py\", line 1, in <module>\n    import requests\nModuleNotFoundError: No module named 'requests'")
    assert res["error_class"] == "missing_python_dependency"
    assert res["extracted_token"] == "requests"

def test_missing_node_dep():
    res = classify_error("Error: Cannot find module 'express'\n    at Function.Module._resolveFilename")
    assert res["error_class"] == "missing_node_dependency"
    assert res["extracted_token"] == "express"

def test_port_conflict():
    res = classify_error("Error: listen EADDRINUSE: address already in use :::8000")
    assert res["error_class"] == "port_conflict"
    assert res["extracted_token"] == ""

def test_wrong_base_image_arch():
    res = classify_error("standard_init_linux.go:211: exec user process caused \"exec format error\"")
    assert res["error_class"] == "wrong_base_image_arch"

def test_out_of_memory():
    res = classify_error("container inspect shows OOMKilled: true")
    assert res["error_class"] == "out_of_memory"

def test_missing_or_wrong_start_command():
    res = classify_error("container exits within 2s, no matching CMD found")
    assert res["error_class"] == "missing_or_wrong_start_command"

def test_missing_env_var():
    res = classify_error("KeyError: 'DATABASE_URL'")
    assert res["error_class"] == "missing_env_var"
    assert res["extracted_token"] == "DATABASE_URL"

def test_db_connection_failed():
    res = classify_error("MongoNetworkError: failed to connect to server [localhost:27017] on first connect")
    assert res["error_class"] == "db_connection_failed"
    assert res["extracted_token"] == "mongo"

def test_build_network_error():
    res = classify_error("npm ERR! code ERR_SOCKET_TIMEOUT")
    assert res["error_class"] == "build_network_error"

def test_unclassified():
    res = classify_error("Some random unknown error occurred")
    assert res["error_class"] == "unclassified"

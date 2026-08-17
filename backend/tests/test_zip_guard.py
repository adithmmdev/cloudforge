import pytest
import os
import zipfile
import tempfile
from app.utils.zip_guard import safe_extract_zip, ZipBombError

def create_dummy_zip(path, num_files, size_per_file, file_name="file.txt"):
    with zipfile.ZipFile(path, 'w') as zf:
        if num_files == 1:
            zf.writestr(file_name, b'0' * size_per_file)
        else:
            for i in range(num_files):
                zf.writestr(f"file_{i}.txt", b'0' * size_per_file)

def test_safe_extract_zip_success():
    with tempfile.TemporaryDirectory() as td:
        zip_path = os.path.join(td, "test.zip")
        create_dummy_zip(zip_path, 5, 100)
        
        extract_dir = os.path.join(td, "extracted")
        os.makedirs(extract_dir)
        safe_extract_zip(zip_path, extract_dir)
        
        assert len(os.listdir(extract_dir)) == 5

def test_safe_extract_zip_too_many_files():
    with tempfile.TemporaryDirectory() as td:
        zip_path = os.path.join(td, "test.zip")
        create_dummy_zip(zip_path, 10001, 10)
        
        extract_dir = os.path.join(td, "extracted")
        os.makedirs(extract_dir)
        with pytest.raises(ZipBombError, match="too many files"):
            safe_extract_zip(zip_path, extract_dir)

def test_safe_extract_zip_too_large():
    with tempfile.TemporaryDirectory() as td:
        zip_path = os.path.join(td, "test.zip")
        create_dummy_zip(zip_path, 1, 100 * 1024 * 1024 + 10)
        
        extract_dir = os.path.join(td, "extracted")
        os.makedirs(extract_dir)
        with pytest.raises(ZipBombError, match="uncompressed size too large"):
            safe_extract_zip(zip_path, extract_dir)

def test_safe_extract_zip_path_traversal():
    with tempfile.TemporaryDirectory() as td:
        zip_path = os.path.join(td, "test.zip")
        create_dummy_zip(zip_path, 1, 10, "../evil.txt")
        
        extract_dir = os.path.join(td, "extracted")
        os.makedirs(extract_dir)
        with pytest.raises(ZipBombError, match="unsafe path traversal"):
            safe_extract_zip(zip_path, extract_dir)

import os
import zipfile

MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024 # 100 MB
MAX_FILES = 10000

class ZipBombError(Exception):
    pass

def safe_extract_zip(zip_path: str, extract_to: str):
    """
    Safely extracts a ZIP file, protecting against ZIP bombs.
    Checks that the uncompressed size is <= 100MB and the number of entries is <= 10000.
    """
    with zipfile.ZipFile(zip_path, 'r') as zf:
        total_size = 0
        file_count = 0
        
        for info in zf.infolist():
            file_count += 1
            total_size += info.file_size
            
            if file_count > MAX_FILES:
                raise ZipBombError(f"ZIP contains too many files (limit: {MAX_FILES})")
                
            if total_size > MAX_UNCOMPRESSED_SIZE:
                raise ZipBombError(f"ZIP uncompressed size too large (limit: {MAX_UNCOMPRESSED_SIZE} bytes)")
                
            # Path traversal check
            if ".." in info.filename or info.filename.startswith("/"):
                raise ZipBombError("ZIP contains unsafe path traversal")
                
        # If all checks pass, extract
        zf.extractall(extract_to)

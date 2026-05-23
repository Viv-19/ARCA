import hashlib

def compute_source_hash(regulator: str, title: str, date: str) -> str:
    """
    Computes a stable hash based on metadata to identify if a circular is already registered.
    """
    content = f"{regulator.upper().strip()}|{title.strip()}|{date.strip()}"
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def compute_file_hash(file_path: str) -> str:
    """
    Computes SHA-256 hash of the binary file content.
    """
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        # Read in blocks of 4KB to optimize memory usage
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

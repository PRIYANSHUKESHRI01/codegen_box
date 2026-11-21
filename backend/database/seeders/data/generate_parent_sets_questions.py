import os
import sys

sys.path.append(os.path.dirname(__file__))
from vault_helper import write_php_file

# Directory to output PHP seed data
OUT_DIR = os.path.join(os.path.dirname(__file__), 'mock_questions_parent_sets')
os.makedirs(OUT_DIR, exist_ok=True)

print("Starting generation of authentic Mock AI Interview Parent Sets (Sets 2 to 5)...")

"""Lanzador escritorio desde la raíz."""

import os
import runpy
from pathlib import Path

os.chdir(Path(__file__).parent / "academic_os")
runpy.run_path("main.py", run_name="__main__")

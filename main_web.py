"""Lanzador web desde la raíz del proyecto."""

import os
import runpy
from pathlib import Path

os.chdir(Path(__file__).parent / "academic_os")
runpy.run_path("run_web.py", run_name="__main__")

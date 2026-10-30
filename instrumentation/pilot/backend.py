"""Operate only the retained isolated Langfuse trial; never select a Docker context."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(os.environ.get('SKILL_PILOT_PRIVATE', '/Volumes/SumoDeus NVMe/skill-observability-bakeoff'))
DOCKER = {'PATH': os.environ['PATH'], 'HOME': str(Path.home()),
          'DOCKER_HOST': 'unix:///Volumes/SumoDeus NVMe/sob/bakeoff/docker.sock',
          'DOCKER_CONFIG': str(ROOT / 'docker')}

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ['up', 'stop', 'restart', 'ps', 'exec', 'logs']:
        raise SystemExit('usage: backend.py <up|stop|restart|ps|exec|logs> [compose arguments]')
    raise SystemExit(subprocess.call(['docker-compose', '-p', 'bakeoff-langfuse', '-f', str(ROOT / 'langfuse-compose.json'), *sys.argv[1:]], env=DOCKER))

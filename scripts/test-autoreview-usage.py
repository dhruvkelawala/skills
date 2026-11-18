#!/usr/bin/env python3
"""Check the pinned autoreview's usage/status contract without calling a model."""
import argparse
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
from unittest.mock import patch

api = runpy.run_path(sys.argv[1], run_name="usage_contract")
with tempfile.TemporaryDirectory() as root:
    root = Path(root)
    cases = [
        ("codex", {"type": "turn.completed", "usage": {"input_tokens": 100, "cached_input_tokens": 30, "output_tokens": 20, "reasoning_output_tokens": 5}}, "record_codex_usage"),
        ("claude", {"type": "result", "is_error": False, "usage": {"input_tokens": 10, "output_tokens": 20, "cache_read_input_tokens": 30, "cache_creation_input_tokens": 40}}, "record_claude_usage"),
    ]
    for engine, event, recorder in cases:
        for streaming in [False, True]:
            args = argparse.Namespace(engine=engine, model="test-model", status_output=str(root / "status.json"), review_usage=[], stream_engine_output=streaming, claude_bin="claude", tools=False, fallback_model=None, thinking=None)
            output = json.dumps(event) if not streaming else json.dumps({"type": "system", "subtype": "init"}) + "\n" + json.dumps(event) + "\n"
            if engine == "claude":
                globals_ = api['run_claude'].__globals__
                with patch.dict(globals_, ensure_claude_isolation_supported=lambda *_: None, resolve_command=lambda *_: "claude", safe_temp_root=lambda *_: root, safe_engine_env=lambda *_a, **_k: {}, run_with_heartbeat=lambda *_a, **_k: subprocess.CompletedProcess([], 0, output, "")):
                    api['run_claude'](args, root, "review the patch")
            else:
                api[recorder](args, output)
            api['write_review_status'](args, "clean", 0)
            status = json.loads((root / "status.json").read_text())
            assert status.get('usage', {}).get('tokens') == event['usage'], status
            assert status['usage']['complete'] is True, status
            # Failed and unknown attempts retain measured usage without declaring full coverage.
            api[recorder](args, "", completed=False)
            api['write_review_status'](args, "unavailable", 1)
            status = json.loads((root / "status.json").read_text())
            assert status['usage']['unknown_attempts'] == 1, status
            assert status['usage']['complete'] is False, status
print('PASS: Codex and Claude JSON/stream usage reaches status; unknown attempts remain incomplete')

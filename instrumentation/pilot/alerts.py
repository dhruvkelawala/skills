"""Configure real Langfuse predicates and read receipts from the isolated receiver."""
import http.cookiejar
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.parse
import urllib.request
from backend import ROOT, DOCKER

os.umask(0o077)
WORK = Path(os.environ['SKILL_PILOT_STATE'])
state = json.loads((WORK / 'probe.json').read_text())
registry = WORK / 'monitors.json'
if sys.argv[1:] in [['configure'], ['update']]:
    updating = sys.argv[1] == 'update'
    if registry.exists() and not updating:
        raise SystemExit('Monitor registry exists; reuse it rather than creating duplicate alerts.')
    config = json.loads((ROOT / 'langfuse-compose.json').read_text())
    env = config['services']['langfuse-web']['environment']
    base = 'http://localhost:3307'
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(path, data=None, form=False):
        body = None if data is None else (urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode())
        req = urllib.request.Request(base + path, data=body, headers={'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'})
        try:
            with opener.open(req, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            (WORK / 'alert-api-error.json').write_bytes(error.read())
            raise RuntimeError('alert API HTTP ' + str(error.code)) from None
    csrf = request('/api/auth/csrf')['csrfToken']
    request('/api/auth/callback/credentials', {'csrfToken': csrf, 'email': env['LANGFUSE_INIT_USER_EMAIL'], 'password': env['LANGFUSE_INIT_USER_PASSWORD'], 'json': 'true', 'callbackUrl': base}, True)
    if updating:
        trigger = json.loads(registry.read_text())[0]['rule']['triggerIds'][0]
    else:
        automation = request('/api/trpc/automations.createAutomation?batch=1', {'0': {'json': {'projectId': 'bakeoff-project', 'name': state['workflow'], 'eventSource': 'monitor', 'eventAction': [], 'filter': None, 'status': 'ACTIVE', 'actionType': 'WEBHOOK', 'actionConfig': {'type': 'WEBHOOK', 'url': 'http://bakeoff-alert/', 'apiVersion': {'monitor': 'v1'}}}}})
        trigger = automation[0]['result']['data']['json']['trigger']['id']
    options = {'projectId': 'bakeoff-project', 'workflow': state['workflow'], 'tokenWarning': int(os.environ.get('SKILL_TOKEN_WARNING', '100')), 'triggerIds': [trigger]}
    code = "import {monitorRules} from './instrumentation/queries.mjs'; console.log(JSON.stringify(monitorRules(JSON.parse(process.argv[1]))));"
    rules = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code, json.dumps(options)]))
    monitors = []
    old = json.loads(registry.read_text()) if updating else []
    for index, rule in enumerate(rules):
        payload = {**rule, 'id': old[index]['id']} if updating else rule
        response = request('/api/trpc/monitors.' + ('update' if updating else 'create') + '?batch=1', {'0': {'json': payload}})
        monitors.append({'id': response[0]['result']['data']['json']['id'], 'rule': rule})
    registry.write_text(json.dumps(monitors))
    print(json.dumps({'configured': True, 'workflow': state['workflow'], 'monitors': monitors}, indent=2))
elif sys.argv[1:] == ['read']:
    monitors = json.loads(registry.read_text())
    raw = subprocess.check_output(['docker-compose', '-p', 'bakeoff-langfuse', '-f', str(ROOT / 'langfuse-compose.json'), 'exec', '-T', 'bakeoff-alert', 'cat', '/tmp/receipts.jsonl'], env=DOCKER)
    (WORK / 'receipts.jsonl').write_bytes(raw)
    receipts = [json.loads(line) for line in raw.splitlines()]
    receipts = [item.get('payload', item) for item in receipts]
    result = []
    for monitor in monitors:
        matches = [item for item in receipts if item.get('monitorId') == monitor['id']]
        result.append({'workflow': state['workflow'], 'rule': monitor['rule'], 'receipts': [{key: item.get(key) for key in ['monitorId', 'monitorName', 'severity', 'metricValue', 'alertThreshold', 'thresholdOperator', 'filters', 'dataPermalink']} for item in matches]})
    print(json.dumps(result, indent=2))
    assert all(any(r['severity'] == 'ALERT' for r in item['receipts']) for item in result), 'both actual predicates must deliver'
    assert all(sum(r['severity'] == 'ALERT' for r in item['receipts']) == 1 for item in result), 'replay must not duplicate unresolved alerts'
else:
    raise SystemExit('usage: alerts.py configure|read')

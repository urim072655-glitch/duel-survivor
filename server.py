# -*- coding: utf-8 -*-
"""
Duel Survivor · 本地服务器（用户端数据接收 + 静态托管）

- 静态托管本目录（index.html / admin.html / js / css / data …）。
- POST /api/db ：实现 WorkBuddyCloud(Supabase 风格) 链式查询的后端语义，
  供 js/localdb.js 适配器调用（?localapi=1 时用户端/管理端走这里）。
- 数据持久化：data/local/db.json（ds_users 表）。
- 请求日志：控制台 + data/local/server.log（"接收用户端的数据"）。
- 内置管理员：admin（密码见 ADMIN_PWD，首次启动自动创建，可登录后发日元）。

用法：python server.py [port]
"""
import os
import sys
import json
import hashlib
import socket
import threading
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

DEPLOY = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(DEPLOY, 'data', 'local')
DB_PATH = os.path.join(DATA_DIR, 'db.json')
LOG_PATH = os.path.join(DATA_DIR, 'server.log')

ADMIN_NAME = 'admin'
ADMIN_PWD = 'Jkl072655'
SALT = 'ds:v1:'

_lock = threading.Lock()
_db = {'ds_users': []}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def pwd_hash(p):
    return hashlib.sha256((SALT + p).encode('utf-8')).hexdigest()


def log_api(msg):
    line = '[%s] %s' % (now_iso(), msg)
    print(line, flush=True)
    try:
        with open(LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except OSError:
        pass


def load_db():
    global _db
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH, 'r', encoding='utf-8') as f:
                _db = json.load(f)
        except (ValueError, OSError):
            _db = {'ds_users': []}
    _db.setdefault('ds_users', [])
    # 内置管理员（首次启动创建）
    if not any(u.get('name') == ADMIN_NAME and u.get('is_admin') for u in _db['ds_users']):
        _db['ds_users'].append({
            'id': 1, 'name': ADMIN_NAME, 'pwd_hash': pwd_hash(ADMIN_PWD),
            'is_admin': True, 'data': {'yen': 5000, 'yenSeq': 0},
            'created_at': now_iso(), 'last_login': None,
        })
        save_db()


def save_db():
    tmp = DB_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(_db, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DB_PATH)


def matches(row, f):
    col, op, val = f.get('col'), f.get('op'), f.get('val')
    v = row.get(col)
    if op == 'eq':
        return v == val
    if op == 'ilike':
        pat = str(val).strip('%')
        return pat.lower() in str(v).lower()
    if op == 'gte':
        if v is None:
            return False
        return str(v) >= str(val)
    return True


def project(row, cols):
    if not cols or cols == '*':
        return dict(row)
    return {c.strip(): row.get(c.strip()) for c in cols.split(',') if c.strip()}


def yen_of(patch):
    d = patch.get('data')
    if isinstance(d, str):
        try:
            d = json.loads(d)
        except ValueError:
            return None
    if isinstance(d, dict):
        return d.get('yen')
    return None


def name_of(filters):
    for f in filters or []:
        if f.get('col') == 'name' and f.get('op') == 'eq':
            return f.get('val')
    return None


def handle_db(body):
    table = body.get('table') or 'ds_users'
    op = body.get('op')
    filters = body.get('filters') or []
    with _lock:
        rows = _db.setdefault(table, [])
        idx = [i for i, r in enumerate(rows) if all(matches(r, f) for f in filters)]

        if op == 'select':
            matched = [rows[i] for i in idx]
            order = body.get('order')
            if order:
                col = order.get('col')
                matched.sort(key=lambda r: (r.get(col) is None, r.get(col)),
                             reverse=not order.get('asc', True))
            count = len(matched)
            rng = body.get('range')
            if rng:
                matched = matched[rng[0]: rng[1] + 1]
            lim = body.get('limit')
            if lim is not None:
                matched = matched[:lim]
            if body.get('head'):
                return {'data': None, 'count': count, 'error': None}
            cols = body.get('cols') or '*'
            proj = [project(r, cols) for r in matched]
            if body.get('single'):
                return {'data': (proj[0] if proj else None), 'count': count, 'error': None}
            return {'data': proj, 'count': count, 'error': None}

        if op == 'insert':
            row = body.get('row') or {}
            nm = row.get('name')
            if nm is not None and any(r.get('name') == nm for r in rows):
                log_api('INSERT %s REJECT-DUP name=%s' % (table, nm))
                return {'data': None, 'count': 0,
                        'error': {'code': '23505',
                                  'message': 'duplicate key value violates unique constraint "ds_users_name_key"'}}
            newid = max([r.get('id', 0) or 0 for r in rows], default=0) + 1
            rec = {'id': newid, 'created_at': now_iso(), 'last_login': None}
            rec.update(row)
            rows.append(rec)
            save_db()
            log_api('INSERT %s id=%s name=%s yen=%s' % (
                table, newid, nm, (row.get('data') or {}).get('yen') if isinstance(row.get('data'), dict) else '?'))
            return {'data': [project(rec, body.get('cols') or '*')], 'count': 1, 'error': None}

        if op == 'update':
            patch = body.get('patch') or {}
            affected = [rows[i] for i in idx]
            for i in idx:
                rows[i].update(patch)
            if affected:
                save_db()
            y = yen_of(patch)
            log_api('UPDATE %s n=%d name=%s keys=%s%s' % (
                table, len(affected), name_of(filters), ','.join(sorted(patch.keys())),
                (' yen=%s' % y) if y is not None else ''))
            ret = [project(r, body.get('cols') or '*') for r in affected] if body.get('returning') else []
            return {'data': ret, 'count': len(affected), 'error': None}

        if op == 'delete':
            affected = [rows[i] for i in idx]
            for i in sorted(idx, reverse=True):
                rows.pop(i)
            if affected:
                save_db()
            log_api('DELETE %s n=%d name=%s' % (table, len(affected), name_of(filters)))
            ret = affected if body.get('returning') else []
            return {'data': ret, 'count': len(affected), 'error': None}

        return {'data': None, 'count': 0, 'error': {'message': 'unknown op: %s' % op}}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DEPLOY, **kw)

    def log_message(self, fmt, *args):  # 静默静态请求噪音，API 走 log_api
        pass

    def _send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path.split('?')[0] != '/api/db':
            self._send_json({'data': None, 'error': {'message': 'not found'}}, 404)
            return
        try:
            length = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
        except (ValueError, OSError):
            self._send_json({'data': None, 'error': {'message': 'bad json'}}, 400)
            return
        self._send_json(handle_db(body))


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return '127.0.0.1'


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8100
    load_db()
    # v0.5.2b：监听所有网卡 —— 同一 Wi-Fi/局域网内的手机、其他电脑可直接访问
    httpd = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    ip = lan_ip()
    print('=' * 56, flush=True)
    print('  Duel Survivor · 本地服务器（接收用户端数据）', flush=True)
    print('=' * 56, flush=True)
    print('  游戏   : http://localhost:%d/index.html?localapi=1' % port, flush=True)
    print('  管理   : http://localhost:%d/admin.html?localapi=1' % port, flush=True)
    print('  局域网 : http://%s:%d/index.html?localapi=1' % (ip, port), flush=True)
    print('           （同一 Wi-Fi 的手机/电脑直接打开上面这个地址）', flush=True)
    print('  管理员 : %s / %s' % (ADMIN_NAME, ADMIN_PWD), flush=True)
    print('  数据   : %s' % os.path.relpath(DB_PATH, DEPLOY), flush=True)
    print('  日志   : %s' % os.path.relpath(LOG_PATH, DEPLOY), flush=True)
    print('  Ctrl+C 停止', flush=True)
    print('-' * 56, flush=True)
    log_api('SERVER START port=%d' % port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log_api('SERVER STOP')
        print('\n已停止。', flush=True)


if __name__ == '__main__':
    main()

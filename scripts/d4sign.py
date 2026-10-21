"""
Fala com a D4Sign pela funcao d4sign (21/10/2026).

    python scripts/d4sign.py cofres
    python scripts/d4sign.py documento <uuid do documento na D4Sign>

"cofres" confere as chaves da API (segredos no Supabase) e lista os cofres da
conta do escritorio. As chaves da D4Sign nunca passam por aqui; a chave
service_role vem do .env.local.
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
env = dict(l.split('=', 1) for l in (RAIZ / '.env.local').read_text(encoding='utf-8').splitlines() if '=' in l)
URL = env['VITE_SUPABASE_URL'].strip().rstrip('/')
CHAVE = env.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
if not CHAVE:
    sys.exit('Falta SUPABASE_SERVICE_ROLE_KEY no .env.local.')

acao = sys.argv[1] if len(sys.argv) > 1 else ''
if acao not in ('cofres', 'documento') or (acao == 'documento' and len(sys.argv) < 3):
    sys.exit(__doc__)
corpo = {'acao': acao, 'uuid': sys.argv[2] if acao == 'documento' else None}

req = urllib.request.Request(f'{URL}/functions/v1/d4sign', data=json.dumps(corpo).encode(), method='POST')
req.add_header('Authorization', f'Bearer {CHAVE}')
req.add_header('Content-Type', 'application/json')
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        print(json.dumps(json.load(r), ensure_ascii=False, indent=2))
except urllib.error.HTTPError as e:
    print('Erro', e.code, e.read().decode()[:600])

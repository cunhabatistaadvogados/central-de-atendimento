"""
Configura o numero do robo na Meta pela funcao whatsapp-numero (20/10/2026).

    python scripts/numero_whatsapp.py status
    python scripts/numero_whatsapp.py assinar
    python scripts/numero_whatsapp.py registrar

"registrar" pede o PIN de duas etapas (6 digitos) escondido: voce cria o PIN
agora e guarda num lugar seguro; a Meta pede ele se alguem tentar registrar o
numero em outro lugar. A chave service_role vem do .env.local.
"""
import getpass
import json
import pathlib
import sys
import urllib.error
import urllib.request

TELEFONE_ID = '1386403061224928'  # +55 13 99741-4361
CONTA_ID = '1355454649817117'  # conta do WhatsApp "Cunha Batista Advogados Associados"

RAIZ = pathlib.Path(__file__).resolve().parent.parent
env = dict(l.split('=', 1) for l in (RAIZ / '.env.local').read_text(encoding='utf-8').splitlines() if '=' in l)
URL = env['VITE_SUPABASE_URL'].strip().rstrip('/')
CHAVE = env.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
if not CHAVE:
    sys.exit('Falta SUPABASE_SERVICE_ROLE_KEY no .env.local.')

acao = sys.argv[1] if len(sys.argv) > 1 else ''
if acao not in ('status', 'assinar', 'registrar'):
    sys.exit(__doc__)
corpo = {'acao': acao, 'telefone_id': TELEFONE_ID, 'conta_id': CONTA_ID}
if acao == 'registrar':
    pin = getpass.getpass('Crie o PIN de 6 digitos do numero (nao aparece enquanto digita): ').strip()
    if pin != getpass.getpass('Repita o PIN: ').strip():
        sys.exit('Os dois PINs nao batem. Nada foi enviado.')
    corpo['pin'] = pin

req = urllib.request.Request(f'{URL}/functions/v1/whatsapp-numero', data=json.dumps(corpo).encode(), method='POST')
req.add_header('Authorization', f'Bearer {CHAVE}')
req.add_header('Content-Type', 'application/json')
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        print(json.dumps(json.load(r), ensure_ascii=False, indent=2))
except urllib.error.HTTPError as e:
    print('Erro', e.code, e.read().decode()[:600])

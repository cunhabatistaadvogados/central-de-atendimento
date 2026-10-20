"""
Configura o numero do robo na Meta pela funcao whatsapp-numero (20/10/2026).

    python scripts/numero_whatsapp.py status
    python scripts/numero_whatsapp.py assinar
    python scripts/numero_whatsapp.py registrar
    python scripts/numero_whatsapp.py foto <imagem.jpg>

"registrar" pede o PIN de duas etapas (6 digitos) escondido: voce cria o PIN
agora e guarda num lugar seguro; a Meta pede ele se alguem tentar registrar o
numero em outro lugar. A chave service_role vem do .env.local.
"""
import base64
import getpass
import json
import pathlib
import sys
import tempfile
import urllib.error
import urllib.request

TELEFONE_ID = '1386403061224928'  # +55 13 99741-4361
CONTA_ID = '1355454649817117'  # conta do WhatsApp "Cunha Batista Advogados Associados"
APP_ID = '1439216688176078'  # app "Central Cunha Batista" (a foto sobe por ele)

RAIZ = pathlib.Path(__file__).resolve().parent.parent
env = dict(l.split('=', 1) for l in (RAIZ / '.env.local').read_text(encoding='utf-8').splitlines() if '=' in l)
URL = env['VITE_SUPABASE_URL'].strip().rstrip('/')
CHAVE = env.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
if not CHAVE:
    sys.exit('Falta SUPABASE_SERVICE_ROLE_KEY no .env.local.')

acao = sys.argv[1] if len(sys.argv) > 1 else ''
if acao not in ('status', 'assinar', 'registrar', 'foto'):
    sys.exit(__doc__)
def pedir_pin(texto):
    # No Windows mostra um * por digito: com o getpass a tela fica parada e
    # parece que o teclado nao pegou.
    try:
        import msvcrt
    except ImportError:
        return getpass.getpass(texto).strip()
    print(texto, end='', flush=True)
    digitos = ''
    while True:
        c = msvcrt.getwch()
        if c in '\r\n':
            print()
            return digitos
        if c == '\x03':
            raise KeyboardInterrupt
        if c == '\b' and digitos:
            digitos = digitos[:-1]
            print('\b \b', end='', flush=True)
        elif c.isdigit() and len(digitos) < 6:
            digitos += c
            print('*', end='', flush=True)


corpo = {'acao': acao, 'telefone_id': TELEFONE_ID, 'conta_id': CONTA_ID}
if acao == 'registrar':
    for _ in range(3):
        pin = pedir_pin('Digite o PIN de 6 numeros: ')
        if len(pin) != 6:
            print('O PIN precisa ter 6 numeros. Vamos de novo.\n')
        elif pin != pedir_pin('Repita o PIN:            '):
            print('Os dois nao bateram. Vamos de novo.\n')
        else:
            break
    else:
        sys.exit('Nada foi enviado.')
    corpo['pin'] = pin
if acao == 'foto':
    # JPG quadrado de 640 px; o WhatsApp corta em circulo.
    if len(sys.argv) < 3:
        sys.exit('Informe a imagem: python scripts/numero_whatsapp.py foto <imagem.jpg>')
    corpo['app_id'] = APP_ID
    corpo['imagem'] = base64.b64encode(pathlib.Path(sys.argv[2]).read_bytes()).decode()

req = urllib.request.Request(f'{URL}/functions/v1/whatsapp-numero', data=json.dumps(corpo).encode(), method='POST')
req.add_header('Authorization', f'Bearer {CHAVE}')
req.add_header('Content-Type', 'application/json')
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        resultado = json.load(r)
except urllib.error.HTTPError as e:
    resultado = {'erro_da_funcao': e.code, 'texto': e.read().decode()[:600]}
print(json.dumps(resultado, ensure_ascii=False, indent=2))

if acao == 'registrar':
    # A janela costuma ser fechada antes de alguem ler: a resposta da Meta (sem
    # o PIN) fica num arquivo para conferir depois.
    (pathlib.Path(tempfile.gettempdir()) / 'registro_whatsapp.json').write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding='utf-8')
    resposta = resultado.get('resposta') or {}
    if resultado.get('http') == 200 and resposta.get('success') is True:
        print('\nDEU CERTO: a Meta registrou o numero.')
    else:
        erro = resposta.get('error') or {}
        print('\nNAO REGISTROU:', erro.get('error_user_msg') or erro.get('message') or resultado)

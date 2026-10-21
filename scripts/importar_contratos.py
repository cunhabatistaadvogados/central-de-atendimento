"""
Importa contratos ja assinados (D4Sign) para a Central (21/10/2026).

Pedido do Edu: a Andreia mandou os contratos ativos do escritorio e eles entram
no sistema novo, fora do historico.

    python scripts/importar_contratos.py <dados.json> <pasta dos PDFs> --previa
    python scripts/importar_contratos.py <dados.json> <pasta dos PDFs> --gravar

O dados.json (lido dos contratos, com CPF e endereco) e a pasta dos PDFs ficam
FORA do repositorio, que e publico. Cada item do json:
    pdf, cliente_id (do historico, ou null), nome, status (assinado | enviado),
    d4sign, gerado_em, enviado_em, assinado_em, dados (ficha do contrato), notas

Regras:
- cliente do historico sai dele (historico = false) e leva a conversa junto;
  sem cliente_id, nasce cliente novo SEM WhatsApp (a equipe preenche na ficha);
- etapa "contratado" (ou "contrato" se ainda falta assinatura), robo pausado:
  com contrato assinado quem atende e a equipe;
- PDF no bucket privado "contratos", em <cliente_id>/contrato.pdf;
- rodar de novo nao duplica: contrato com o mesmo codigo D4Sign (ou o mesmo
  documento do beneficiario) e pulado.
"""
import json
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
env = dict(l.split('=', 1) for l in (RAIZ / '.env.local').read_text(encoding='utf-8').splitlines() if '=' in l)
URL = env['VITE_SUPABASE_URL'].strip().rstrip('/')
CHAVE = env.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
if not CHAVE:
    sys.exit('Falta SUPABASE_SERVICE_ROLE_KEY no .env.local.')

if len(sys.argv) < 4 or sys.argv[3] not in ('--previa', '--gravar'):
    sys.exit(__doc__)
itens = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
pasta = pathlib.Path(sys.argv[2])
gravar = sys.argv[3] == '--gravar'


def pedir(metodo, caminho, corpo=None, cabecalhos=None, bruto=None):
    dados = bruto if bruto is not None else (json.dumps(corpo).encode() if corpo is not None else None)
    req = urllib.request.Request(f'{URL}/{caminho}', data=dados, method=metodo)
    req.add_header('apikey', CHAVE)
    req.add_header('Authorization', f'Bearer {CHAVE}')
    req.add_header('Content-Type', 'application/json')
    for k, v in (cabecalhos or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            texto = r.read().decode()
            return json.loads(texto) if texto else None
    except urllib.error.HTTPError as e:
        sys.exit(f'Erro {e.code} em {metodo} {caminho}: {e.read().decode()[:400]}')


def rest(metodo, caminho, corpo=None, prefer=None):
    return pedir(metodo, f'rest/v1/{caminho}', corpo, {'Prefer': prefer} if prefer else None)


def ja_importado(item):
    if item['d4sign']:
        achado = rest('GET', f"contratos?select=cliente_id&d4sign_uuid=eq.{item['d4sign']}")
    else:
        doc = urllib.parse.quote(item['dados']['documento'])
        achado = rest('GET', f"contratos?select=cliente_id&dados->>documento=eq.{doc}")
    return bool(achado)


def robo_pausado(atual, motivo):
    robo = dict(atual or {})
    robo.setdefault('ficha', {})
    robo.update({'ultimaPergunta': None, 'voltarPara': None, 'naoEntendeu': 0, 'pausado': True, 'encaminhado': False, 'motivoPausa': motivo})
    robo.setdefault('mensagensDoCliente', 0)
    return robo


def data_br(iso):
    return f'{iso[8:10]}/{iso[5:7]}/{iso[0:4]}' if iso else ''


for item in itens:
    pdf = pasta / item['pdf']
    if not pdf.exists():
        sys.exit(f'PDF não encontrado: {pdf}')
    assinado = item['status'] == 'assinado'
    etapa = 'contratado' if assinado else 'contrato'
    motivo = 'Contrato assinado (importado da D4Sign): a equipe atende' if assinado else 'Contrato aguardando assinatura do escritório: a equipe atende'
    beneficiario = item['dados']['nome']
    if ja_importado(item):
        print(f'= {beneficiario}: já importado, pulando')
        continue
    origem = f"cliente do histórico {item['cliente_id'][:8]}" if item['cliente_id'] else 'cliente novo, sem WhatsApp'
    print(f"+ {beneficiario} ({item['status']}) -> {origem}")
    if not gravar:
        continue

    if item['cliente_id']:
        cid = item['cliente_id']
        atual = rest('GET', f'clientes?select=robo&id=eq.{cid}')[0]
        rest('PATCH', f'clientes?id=eq.{cid}', {'historico': False, 'etapa': etapa, 'nome': item['nome'], 'robo': robo_pausado(atual['robo'], motivo), 'nao_lidas': 0})
    else:
        criado = rest('POST', 'clientes', {'telefone': None, 'nome': item['nome'], 'etapa': etapa, 'historico': False, 'robo': robo_pausado(None, motivo)}, 'return=representation')
        cid = criado[0]['id']

    caminho = f'{cid}/contrato.pdf'
    pedir('POST', f'storage/v1/object/contratos/{caminho}', cabecalhos={'Content-Type': 'application/pdf', 'x-upsert': 'true'}, bruto=pdf.read_bytes())

    rest('POST', 'contratos?on_conflict=cliente_id', {
        'cliente_id': cid, 'status': item['status'], 'com_parte_fixa': False, 'ok_advogado': True, 'dados': item['dados'],
        'd4sign_uuid': item['d4sign'], 'gerado_em': item['gerado_em'], 'enviado_em': item['enviado_em'],
        'assinado_em': item['assinado_em'], 'arquivo': caminho,
    }, 'resolution=merge-duplicates,return=minimal')

    texto = (f"Contrato assinado importado da D4Sign: {beneficiario}, assinado em {data_br(item['assinado_em'])}"
             + (f" (código {item['d4sign']})." if item['d4sign'] else '.')) if assinado else f'Contrato importado, aguardando assinatura do escritório: {beneficiario}.'
    eventos = [{'cliente_id': cid, 'tipo': 'contrato', 'texto': texto}]
    eventos += [{'cliente_id': cid, 'tipo': 'sistema', 'texto': n} for n in item['notas']]
    if not item['cliente_id']:
        eventos.append({'cliente_id': cid, 'tipo': 'sistema', 'texto': 'Sem WhatsApp: o número não veio no contrato. Preencher na ficha quando a equipe souber.'})
    rest('POST', 'eventos', eventos, 'return=minimal')

print('\nGravado.' if gravar else '\nPrévia: nada foi gravado. Rode com --gravar.')

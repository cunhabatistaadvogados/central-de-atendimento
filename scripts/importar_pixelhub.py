"""
Importa o historico de conversas do Pixel Hub (export no formato GoHighLevel:
conversations.json + messages.json) para a Central (Supabase).

Pedido do Edu em 20/10/2026: o Lucas mandou o backup das conversas com os
clientes, do numero 13 99741-4361, que saiu do Pixel Hub e veio para o robo.

    python scripts/importar_pixelhub.py "<pasta do backup>" --previa
    python scripts/importar_pixelhub.py "<pasta do backup>" --gravar

--previa so conta e mostra o que entraria. --gravar escreve no banco usando
SUPABASE_SERVICE_ROLE_KEY do .env.local (quem cola a chave e o Edu; ela nao
vai para o git). Pode rodar de novo sem duplicar: cada mensagem entra com
wamid "pixelhub:<id>" (unico no banco) e cliente que ja existe so ganha o
historico, sem mexer na etapa nem no robo dele.

Regras:
- cliente importado entra com o robo PAUSADO ("Historico importado do Pixel
  Hub"): quem volta a escrever cai para a equipe com o historico na tela, em
  vez de o robo recomecar o roteiro no meio de um atendimento;
- etapa pelas etiquetas: desqualificado -> perdido, agendamento -> reuniao,
  qualificado -> qualificado, cliente escreveu -> qualificacao, senao novo;
- mensagem da equipe (tem userId) entra como "Equipe (Pixel Hub)"; as sem
  userId sao da IA antiga, "Marlene (IA do Pixel Hub)". As duas como "equipe",
  para nao parecerem do robo novo;
- registros de atividade do sistema antigo ficam de fora; notas internas
  viram eventos no historico do cliente.
"""
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ROBO_PAUSADO = {
    'ficha': {}, 'ultimaPergunta': None, 'voltarPara': None, 'mensagensDoCliente': 0, 'naoEntendeu': 0,
    'pausado': True, 'encaminhado': True, 'motivoPausa': 'Histórico importado do Pixel Hub',
}
STATUS = {'sent': 'sent', 'delivered': 'delivered', 'read': 'read', 'failed': 'failed', 'undelivered': 'failed'}
CONVERSA = {'TYPE_WHATSAPP', 'TYPE_SMS', 'TYPE_CUSTOM_SMS', 'TYPE_CUSTOM_PROVIDER_SMS'}


def ler(pasta, nome):
    with open(pasta / nome, encoding='utf-8-sig') as f:
        return json.load(f)


def iso_ms(v):
    return datetime.fromtimestamp(int(v) / 1000, tz=timezone.utc).isoformat() if v else None


def so_digitos(t):
    return re.sub(r'\D', '', t or '')


def montar(pasta):
    conv = ler(pasta, 'conversations.json')
    msgs = ler(pasta, 'messages.json')
    por_conversa = defaultdict(list)
    for m in msgs:
        por_conversa[m.get('conversationId')].append(m)

    clientes, mensagens, eventos, pulados = {}, [], [], Counter()
    for c in conv:
        tel = so_digitos(c.get('phone'))
        if len(tel) < 10:
            pulados['conversa sem telefone'] += 1
            continue
        lista = sorted(por_conversa.get(c['id'], []), key=lambda m: m.get('dateAdded') or '')
        tags = [t.lower() for t in (c.get('tags') or [])]
        entrou = [m for m in lista if m.get('direction') == 'inbound' and m.get('messageType') in CONVERSA]
        agendou = any(m.get('messageType') == 'TYPE_ACTIVITY_APPOINTMENT' for m in lista)
        if 'desqualificado' in tags:
            etapa = 'perdido'
        elif agendou:
            etapa = 'reuniao'
        elif 'qualificado' in tags:
            etapa = 'qualificado'
        elif entrou:
            etapa = 'qualificacao'
        else:
            etapa = 'novo'
        nome = (c.get('fullName') or c.get('contactName') or '').strip()
        if not re.search(r'[A-Za-zÀ-ÿ]', nome):
            nome = ''
        site = any(re.search(r'vim da p[aá]gina|pelo site', m.get('body') or '', re.I) for m in entrou[:2])
        # Telefone repetido (mesmo cliente em duas conversas): junta as duas.
        cli = clientes.setdefault(tel, {
            'telefone': tel, 'nome': nome, 'origem': 'site' if site else 'anuncio', 'etapa': etapa,
            'robo': ROBO_PAUSADO, 'nao_lidas': 0,
            'motivo_perda': 'Desqualificado no atendimento do Pixel Hub' if etapa == 'perdido' else None,
            'criado_em': iso_ms(c.get('dateAdded')), 'atualizado_em': iso_ms(c.get('lastMessageDate') or c.get('dateUpdated')),
            'ultima_do_cliente_em': entrou[-1]['dateAdded'] if entrou else None,
            '_tags': tags, '_n': 0, '_de': None, '_ate': None,
        })
        for m in lista:
            tipo = m.get('messageType')
            texto = (m.get('body') or '').strip()
            if tipo == 'TYPE_INTERNAL_COMMENT' and texto:
                eventos.append({'telefone': tel, 'tipo': 'equipe', 'texto': f'Nota no Pixel Hub: {texto}', 'em': m.get('dateAdded')})
                continue
            if tipo not in CONVERSA:
                pulados['registro de atividade do sistema antigo'] += 1
                continue
            anexos = [a for a in (m.get('attachments') or []) if isinstance(a, str)]
            if anexos:
                texto = (texto + '\n' if texto else '') + '\n'.join(f'[anexo] {a}' for a in anexos)
            if not texto:
                pulados['mensagem vazia'] += 1
                continue
            entrada = m.get('direction') == 'inbound'
            mensagens.append({
                'telefone': tel,
                'de': 'cliente' if entrada else 'equipe',
                'texto': texto,
                'autor': None if entrada else ('Equipe (Pixel Hub)' if m.get('userId') else 'Marlene (IA do Pixel Hub)'),
                'wamid': f"pixelhub:{m['id']}",
                'status_envio': None if entrada else STATUS.get((m.get('status') or '').lower()),
                'erro_envio': (str(m.get('error'))[:300] if m.get('error') and not entrada else None),
                'em': m.get('dateAdded'),
            })
            cli['_n'] += 1
            cli['_de'] = min(filter(None, [cli['_de'], m.get('dateAdded')]))
            cli['_ate'] = max(filter(None, [cli['_ate'], m.get('dateAdded')]))
    return clientes, mensagens, eventos, pulados


class Banco:
    def __init__(self):
        env = {}
        for linha in (RAIZ / '.env.local').read_text(encoding='utf-8').splitlines():
            if '=' in linha and not linha.lstrip().startswith('#'):
                k, v = linha.split('=', 1)
                env[k.strip()] = v.strip().strip('"')
        self.url = env.get('VITE_SUPABASE_URL', '').rstrip('/')
        self.chave = env.get('SUPABASE_SERVICE_ROLE_KEY', '')
        if not self.url or not self.chave:
            sys.exit('Falta SUPABASE_SERVICE_ROLE_KEY no .env.local (a chave service_role do projeto LOAS).')

    def pedir(self, metodo, caminho, corpo=None, prefer=None):
        req = urllib.request.Request(f'{self.url}/rest/v1/{caminho}', method=metodo, data=json.dumps(corpo).encode() if corpo is not None else None)
        req.add_header('apikey', self.chave)
        req.add_header('Authorization', f'Bearer {self.chave}')
        req.add_header('Content-Type', 'application/json')
        if prefer:
            req.add_header('Prefer', prefer)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                txt = r.read().decode()
                return json.loads(txt) if txt else None
        except urllib.error.HTTPError as e:
            sys.exit(f'Supabase recusou {metodo} {caminho.split("?")[0]}: {e.code} {e.read().decode()[:400]}')


def em_lotes(lista, n):
    for i in range(0, len(lista), n):
        yield lista[i:i + n]


def gravar(clientes, mensagens, eventos):
    b = Banco()
    tels = list(clientes)
    ja = set()
    for lote in em_lotes(tels, 150):
        r = b.pedir('GET', f"clientes?select=telefone&telefone=in.({','.join(lote)})")
        ja.update(x['telefone'] for x in r)
    novos = [t for t in tels if t not in ja]
    print(f'clientes que ja estavam no banco (so ganham historico): {len(ja)} | novos: {len(novos)}')
    for lote in em_lotes(novos, 200):
        linhas = [{k: v for k, v in clientes[t].items() if not k.startswith('_')} for t in lote]
        b.pedir('POST', 'clientes?on_conflict=telefone', linhas, 'resolution=ignore-duplicates,return=minimal')
    ids = {}
    for lote in em_lotes(tels, 150):
        for x in b.pedir('GET', f"clientes?select=id,telefone&telefone=in.({','.join(lote)})"):
            ids[x['telefone']] = x['id']
    feitas = 0
    for lote in em_lotes(mensagens, 500):
        linhas = [{**{k: v for k, v in m.items() if k != 'telefone'}, 'cliente_id': ids[m['telefone']]} for m in lote if m['telefone'] in ids]
        b.pedir('POST', 'mensagens?on_conflict=wamid', linhas, 'resolution=ignore-duplicates,return=minimal')
        feitas += len(linhas)
        print(f'  mensagens enviadas: {feitas}/{len(mensagens)}', end='\r')
    print()
    # Eventos so para quem entrou agora: rodar de novo nao repete o historico.
    ev = []
    for t in novos:
        c = clientes[t]
        if t not in ids:
            continue
        ev.append({'cliente_id': ids[t], 'tipo': 'sistema', 'em': c['_ate'] or c['atualizado_em'],
                   'texto': f"Histórico importado do Pixel Hub: {c['_n']} mensagens, de {(c['_de'] or '')[:10]} a {(c['_ate'] or '')[:10]}. Robô pausado: a equipe continua o atendimento."})
        if c['_tags']:
            ev.append({'cliente_id': ids[t], 'tipo': 'sistema', 'em': c['_ate'] or c['atualizado_em'], 'texto': 'Etiquetas no Pixel Hub: ' + ', '.join(c['_tags'])})
    for e in eventos:
        if e['telefone'] in novos and e['telefone'] in ids:
            ev.append({'cliente_id': ids[e['telefone']], 'tipo': e['tipo'], 'texto': e['texto'], 'em': e['em']})
    for lote in em_lotes(ev, 500):
        b.pedir('POST', 'eventos', lote, 'return=minimal')
    print(f'eventos gravados: {len(ev)}')


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in ('--previa', '--gravar'):
        sys.exit(__doc__)
    pasta = pathlib.Path(sys.argv[1])
    clientes, mensagens, eventos, pulados = montar(pasta)
    print(f'clientes: {len(clientes)} | mensagens: {len(mensagens)} | notas internas: {len(eventos)}')
    print('etapas:', Counter(c['etapa'] for c in clientes.values()).most_common())
    print('quem fala:', Counter(m['autor'] or 'cliente' for m in mensagens).most_common())
    print('ficou de fora:', dict(pulados))
    if sys.argv[2] == '--gravar':
        gravar(clientes, mensagens, eventos)
        print('Pronto.')


if __name__ == '__main__':
    main()

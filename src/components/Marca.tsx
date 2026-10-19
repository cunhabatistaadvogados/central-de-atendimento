/**
 * Logo CB& redesenhado em SVG a partir do arquivo oficial
 * (src/assets/logo-cbaa.jpg): moldura com o canto inferior esquerdo
 * arredondado, "CB" em branco e o "&" no dourado. Em vetor ele fica nitido
 * no menu escuro e no favicon, onde o JPG ficaria com fundo quadrado.
 */
export function SeloCB({ className = 'h-12 w-12', fundo = true }: { className?: string; fundo?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="CB& Advogados Associados">
      {fundo && <rect width="120" height="120" rx="18" fill="#0F2A4A" />}
      <path d="M16 14 H103 V74" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 14 V90 Q16 104 30 104 H38" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <text x="40" y="84" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="700" fontSize="34" fill="#fff">
        CB
      </text>
      <text x="83" y="84" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="700" fontSize="34" fill="#B39A6B">
        &amp;
      </text>
      <text x="41" y="96" fontFamily="Manrope, sans-serif" fontWeight="600" fontSize="6.4" letterSpacing="2.2" fill="#fff">
        ADVOGADOS
      </text>
      <text x="41" y="104" fontFamily="Manrope, sans-serif" fontWeight="600" fontSize="6.4" letterSpacing="2.2" fill="#fff">
        ASSOCIADOS
      </text>
    </svg>
  )
}

export function MarcaHorizontal({ claro = true, subtitulo = 'Central de atendimento' }: { claro?: boolean; subtitulo?: string }) {
  return (
    <div className="flex items-center gap-3">
      <SeloCB className="h-12 w-12 shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,.25)]" />
      <div className="min-w-0 leading-none">
        <p className={`titulo-serif text-[22px] ${claro ? 'text-white' : 'text-marinho-900'}`}>
          Cunha Batista <span className="text-ouro-500">&amp;</span>
        </p>
        <p className={`mt-1.5 text-[9.5px] font-bold uppercase tracking-[0.24em] ${claro ? 'text-white/45' : 'text-marinho-600/70'}`}>{subtitulo}</p>
      </div>
    </div>
  )
}

/** Arte de fundo do menu: a moldura do logo repetida em dourado, bem apagada. */
export function ArteDoMenu() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 286 900" aria-hidden="true">
      <defs>
        <linearGradient id="fio" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#B39A6B" stopOpacity="0" />
          <stop offset=".45" stopColor="#B39A6B" stopOpacity=".22" />
          <stop offset="1" stopColor="#B39A6B" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M40 120 H330 V700" fill="none" stroke="url(#fio)" strokeWidth="1.2" />
      <path d="M40 120 V820 Q40 870 90 870 H140" fill="none" stroke="url(#fio)" strokeWidth="1.2" />
      <path d="M70 160 H360 V740" fill="none" stroke="url(#fio)" strokeWidth=".7" />
      <path d="M70 160 V780 Q70 820 110 820 H150" fill="none" stroke="url(#fio)" strokeWidth=".7" />
      <text x="150" y="640" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="700" fontSize="260" fill="#B39A6B" opacity=".045">
        &amp;
      </text>
    </svg>
  )
}

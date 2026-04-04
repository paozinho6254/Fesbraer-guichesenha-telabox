"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from './lib/supabase';

interface Piloto {
  id: string | number;
  nome: string;
  senha: number;
  categoria: string;
  janela_id: string;
  status: string;
  timer_final?: string;
  timer_ativo?: boolean;
  segundos_restantes?: number;
}

type Categoria = 'acrobatico' | 'escala' | 'jato';

const getCorPorCategoria = (categoria?: string): string => {
  const cat = categoria?.toLowerCase() as Categoria | undefined;
  if (cat === 'acrobatico') return 'bg-red-600 border-red-400';
  if (cat === 'escala') return 'bg-blue-600 border-blue-400';
  if (cat === 'jato') return 'bg-green-600 border-green-400';
  return 'bg-gray-700 border-gray-500';
};

export default function PainelBoxes() {
  const [janelaAtual, setJanelaAtual] = useState<Piloto[] | null>(null);
  const [janelasFila, setJanelasFila] = useState<Piloto[][]>([]);
  const [indexCarrossel, setIndexCarrossel] = useState(0);
  const [tempoDisplay, setTempoDisplay] = useState("00:10:00");
  const janelaAnteriorRef = useRef<Piloto[] | null>(null);
  
  const tocarBeep = () => {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, ctx.currentTime);
  gainNode.gain.setValueAtTime(1, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.5);
};

  // --- BUSCA INICIAL E REALTIME ---
  useEffect(() => {
    const carregarDados = async () => {
      const { data } = await supabase
        .from('pilotos')
        .select('*')
        .not('janela_id', 'is', null)
        .order('janela_id', { ascending: true });

      if (data) organizarJanelas(data);
    };

    carregarDados();

    const subscription = supabase
      .channel('mudancas-pista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pilotos' }, carregarDados)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

const organizarJanelas = (pilotos: Piloto[]) => {
  console.log("📦 Pilotos recebidos:", pilotos.map(p => ({
    id: p.id,
    nome: p.nome,
    status: p.status,
    janela_id: p.janela_id,
    timer_ativo: p.timer_ativo,
    segundos_restantes: p.segundos_restantes,
  })));

  const grupos = pilotos.reduce((acc: Record<string, Piloto[]>, p: Piloto) => {
    if (!acc[p.janela_id]) acc[p.janela_id] = [];
    acc[p.janela_id].push(p);
    return acc;
  }, {});

  const listaOrdenada = Object.values(grupos);
  const novaJanelaAtual = listaOrdenada[0] || null;

  // ✅ Toca beep quando a janela muda
  if (
    janelaAnteriorRef.current &&
    novaJanelaAtual &&
    janelaAnteriorRef.current[0]?.janela_id !== novaJanelaAtual[0]?.janela_id
  ) {
    tocarBeep();
  }

  janelaAnteriorRef.current = novaJanelaAtual;
  setJanelaAtual(novaJanelaAtual);
  setJanelasFila(listaOrdenada.slice(1) || []);
};

    const listaOrdenada = Object.values(grupos);
    setJanelaAtual(listaOrdenada[0] || null);
    setJanelasFila(listaOrdenada.slice(1) || []);
  };

  const janelaAtualRef = useRef(janelaAtual);

  useEffect(() => {
    janelaAtualRef.current = janelaAtual;
  }, [janelaAtual]);

  // --- LÓGICA DO CRONÔMETRO SINCRONIZADO ---
  useEffect(() => {
    if (!janelaAtual || janelaAtual.length === 0) {
      setTempoDisplay("00:10:00");
      return;
    }

    const p = janelaAtual[0];
    console.log("🔄 useEffect disparou — id:", p?.id, "| janela_id:", p?.janela_id, "| timer_ativo:", p?.timer_ativo);

    let interval: ReturnType<typeof setInterval>;

    const atualizarVisor = () => {
      if (p.timer_ativo === false) {
        setTempoDisplay(formatarSegundos(p.segundos_restantes ?? 600));
        return;
      }

      if (!p.timer_final) {
        setTempoDisplay(formatarSegundos(p.segundos_restantes ?? 600));
        return;
      }

      const agora = new Date().getTime();
      const tempoFinal = new Date(p.timer_final).getTime();
      const diff = Math.max(0, Math.floor((tempoFinal - agora) / 1000));
      setTempoDisplay(formatarSegundos(diff));
      if (diff <= 0) clearInterval(interval);
    };

    atualizarVisor();
    interval = setInterval(atualizarVisor, 1000);
    return () => clearInterval(interval);

  }, [janelaAtual]);

  const formatarSegundos = (totalSegundos: number) => {
    const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSegundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Carrossel das próximas janelas
  useEffect(() => {
    if (janelasFila.length <= 1) return;
    const timer = setInterval(() => {
      setIndexCarrossel((prev) => (prev + 1) % janelasFila.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [janelasFila]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col font-sans uppercase overflow-x-hidden">

      {/* SEÇÃO JANELA ATUAL */}
      <div className="text-center mb-6 md:mb-12">
        <h1 className="text-xl md:text-4xl font-bold mb-4 tracking-widest text-white-500">JANELA ATUAL</h1>

        {janelaAtual && (
          <div className={`${getCorPorCategoria(janelaAtual[0].categoria)} rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-2xl border-b-4 md:border-b-8`}>
            <h2 className="text-4xl md:text-8xl font-black mb-4 md:mb-8 drop-shadow-lg">
              {janelaAtual[0].categoria.toUpperCase()}
            </h2>

            <div className="flex flex-row w-full justify-center gap-3 md:gap-6 px-2 md:px-6">
              {janelaAtual.map(p => (
                <div
                  key={p.id}
                  className="bg-white text-black p-3 md:p-7 rounded-2xl md:rounded-3xl shadow-2xl flex-1 min-w-0"
                >
                  <div className="text-4xl md:text-7xl font-black">{p.senha}</div>
                  <div className="text-sm md:text-2xl font-bold mt-1 md:mt-2 truncate">
                    {p.nome}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO CRONOMETRO */}
      <div className="flex flex-col items-center mb-1">
        <div className="text-sm md:text-4xl tracking-tighter">
          TEMPO RESTANTE
        </div>
        <div className="rounded-b-3xl shadow-[0_0_50px_rgba(255,255,255,0.05)]">
          <span className="text-6xl md:text-7xl font-black text-white tabular-nums tracking-tighter">
            {tempoDisplay}
          </span>
        </div>
      </div>

      {/* SEÇÃO PRÓXIMAS JANELAS */}
      <div className="flex-1 flex flex-col justify-end pb-4">
        <h3 className="text-center text-xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-400">
          Próximas janelas {janelasFila.length > 0 && `(1 de ${janelasFila.length})`}
        </h3>

        <div className="relative h-48 md:h-72 w-full">
          {janelasFila.length > 0 ? (
            janelasFila.map((grupo, i) => (
              <div
                key={i}
                className={`absolute inset-0 flex justify-center transition-all duration-1000 ease-in-out transform ${i === indexCarrossel ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
                  }`}
              >
                <div className={`${getCorPorCategoria(grupo[0].categoria)} rounded-2xl md:rounded-3xl p-4 md:p-8 w-full md:w-3/4 flex flex-col items-center border-2 md:border-4 shadow-xl`}>
                  <h4 className="text-2xl md:text-5xl font-bold mb-3 md:mb-6 drop-shadow-md">
                    {grupo[0].categoria.toUpperCase()}
                  </h4>
                  <div className="flex flex-row w-full justify-center gap-2 md:gap-6">
                    {grupo.map(p => (
                      <div key={p.id} className="bg-white text-black p-2 md:p-8 rounded-xl md:rounded-2xl flex-1 min-w-0 text-center shadow-lg">
                        <div className="text-3xl md:text-5xl font-black">{p.senha}</div>
                        <div className="text-[12px] md:text-lg font-bold truncate mt-1">{p.nome}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-600 text-xl">Fila vazia</div>
          )}
        </div>
        {/* DOTS / INDICADORES NUMERADOS */}
        <div className="flex justify-center gap-3 md:gap-5 mt-4 md:mt-10">
          {janelasFila.map((_, i) => (
            <div
              key={i}
              className={`
        flex items-center justify-center 
        h-8 w-8 md:h-14 md:w-14 
        rounded-xl md:rounded-2xl 
        font-black text-sm md:text-2xl 
        transition-all duration-500 border-2
        ${i === indexCarrossel
                  ? 'bg-white text-black border-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                  : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                }
      `}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

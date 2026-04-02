"use client";

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

interface Piloto {
  id: string | number;
  nome: string;
  senha: number;
  categoria: string;
  janela_id: string;
  timer_final?: string;    // Campo vindo do banco
  timer_ativo?: boolean;   // Campo vindo do banco
  segundos_restantes?: number; // Valor estático quando pausado
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
    const grupos = pilotos.reduce((acc: Record<string, Piloto[]>, p: Piloto) => {
      if (!acc[p.janela_id]) acc[p.janela_id] = [];
      acc[p.janela_id].push(p);
      return acc;
    }, {});

    const listaOrdenada = Object.values(grupos);
    setJanelaAtual(listaOrdenada[0] || null);
    setJanelasFila(listaOrdenada.slice(1) || []);
  };

  // --- LÓGICA DO CRONÔMETRO SINCRONIZADO ---
  useEffect(() => {
    const interval = setInterval(() => {
      const p = janelaAtual?.[0];

      // Se não houver piloto ou o timer não estiver ativo no banco
      if (!p?.timer_final || !p?.timer_ativo) {
        const s = p?.segundos_restantes || 0;
        setTempoDisplay(formatarSegundos(s));
        return;
      }

      const agora = new Date().getTime();
      const final = new Date(p.timer_final).getTime();
      const diffSegundos = Math.max(0, Math.floor((final - agora) / 1000));

      setTempoDisplay(formatarSegundos(diffSegundos));
    }, 1000);

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
        <h1 className="text-xl md:text-2xl font-bold mb-4 tracking-widest text-gray-500">JANELA ATUAL</h1>

        {janelaAtual && (
          <div className={`${getCorPorCategoria(janelaAtual[0].categoria)} rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-2xl border-b-4 md:border-b-8`}>
            <h2 className="text-4xl md:text-8xl font-black mb-4 md:mb-8 drop-shadow-lg">
              {janelaAtual[0].categoria.toUpperCase()}
            </h2>

            <div className="flex flex-row w-full justify-center gap-3 md:gap-6 px-2 md:px-6">
              {janelaAtual.map(p => (
                <div
                  key={p.id}
                  className="bg-white text-black p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-2xl flex-1 min-w-0"
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
      <div className="flex flex-col items-center mt-5 mb-13">
        <div className="text-sm md:text-6xl tracking-tighter">
          TEMPO RESTANTE
        </div>
        <div className="rounded-b-3xl shadow-[0_0_50px_rgba(255,255,255,0.05)]">
          <span className="text-6xl md:text-9xl font-black text-white tabular-nums tracking-tighter">
            {tempoDisplay}
          </span>
        </div>
      </div>

      {/* SEÇÃO PRÓXIMAS JANELAS */}
      <div className="flex-1 flex flex-col justify-end pb-4">
        <h3 className="text-center text-xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-400 italic">Próximas janelas</h3>

        <div className="relative h-48 md:h-64 w-full">
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
                      <div key={p.id} className="bg-white text-black p-2 md:p-4 rounded-xl md:rounded-2xl flex-1 min-w-0 text-center shadow-lg">
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

        {/* DOTS */}
        <div className="flex justify-center gap-2 md:gap-4 mt-4 md:mt-8">
          {janelasFila.map((_, i) => (
            <div
              key={i}
              className={`h-2 md:h-4 rounded-full transition-all duration-500 ${i === indexCarrossel ? 'bg-white w-8 md:w-16' : 'bg-gray500 w-4 md:w-8'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
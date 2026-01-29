"use client";

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

interface Piloto {
  id: string;
  nome: string;
  senha: number;
  categoria: string;
  janela_id: string;
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

  // 1. ESCUTAR MUDANÇAS EM TEMPO REAL
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

    const canal = supabase
      .channel('mudancas_na_pista') // Nome qualquer para o canal
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta TUDO (Insert, Update, Delete)
          schema: 'public',
          table: 'pilotos'
        },
        (payload) => {
          console.log('Mudança detectada!', payload);
          carregarDados(); // Quando o banco mudar, ele chama a função de carregar de novo
        }
      )
      .subscribe();

    // Inscrição Realtime
    const subscription = supabase
      .channel('mudancas-pista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pilotos' }, carregarDados)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // 2. LOGICA DE AGRUPAMENTO
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

  // 3. TIMER DO CARROSSEL (10 SEGUNDOS)
  useEffect(() => {
    if (janelasFila.length <= 1) return;
    const timer = setInterval(() => {
      setIndexCarrossel((prev) => (prev + 1) % janelasFila.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [janelasFila]);

  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col font-sans uppercase">
      {/* SEÇÃO JANELA ATUAL */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 tracking-widest text-gray-300">JANELA ATUAL</h1>
        {janelaAtual && (
          <div className={`${getCorPorCategoria(janelaAtual[0].categoria)} rounded-3xl p-8 shadow-2xl transition-colors duration-500 border-b-8`}>
            <h2 className="text-8xl font-black mb-8 drop-shadow-lg">
              {janelaAtual[0].categoria.toUpperCase()}
            </h2>
            <div className="flex justify-center gap-8">
              {janelaAtual.map(p => (
                <div key={p.id} className="bg-white text-black p-5 rounded-3xl w-56 shadow-2xl transform scale-110">
                  <div className="text-7xl font-black">{p.senha}</div>
                  <div className="text-2xl font-bold mt-2 truncate">{p.nome}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timer po */}


      <div className="flex-1 flex flex-col justify-end pb-4 overflow-hidden">
        <h3 className="text-center text-3xl font-bold mb-6 text-gray-400">Próximas janelas</h3>

        <div className="relative h-64 w-full">
          {janelasFila.map((grupo, i) => (
            <div
              key={i}
              className={`absolute inset-0 flex justify-center transition-all duration-1000 ease-in-out transform ${i === indexCarrossel
                ? "translate-x-0 opacity-100"
                : "translate-x-full opacity-0"
                }`}
            >
              <div className={`${getCorPorCategoria(grupo[0].categoria)} rounded-3xl p-8 w-3/4 flex flex-col items-center border-4 shadow-xl`}>
                <h4 className="text-5xl font-bold mb-6 drop-shadow-md">
                  {grupo[0].categoria.toUpperCase()}
                </h4>
                <div className="flex gap-6">
                  {grupo.map(p => (
                    <div key={p.id} className="bg-white text-black p-4 rounded-2xl w-40 text-center shadow-lg">
                      <div className="text-5xl font-black">{p.senha}</div>
                      <div className="text-lg font-bold truncate mt-1">{p.nome}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DOTS */}
        <div className="flex justify-center gap-4 mt-8">
          {janelasFila.map((_, i) => (
            <div
              key={i}
              className={`h-4 rounded-full transition-all duration-500 ${i === indexCarrossel ? 'bg-white w-16' : 'bg-gray-800 w-4'
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
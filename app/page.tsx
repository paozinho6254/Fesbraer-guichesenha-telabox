"use client";

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

interface Piloto {
  id: string | number;
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

    return () => {
      supabase.removeChannel(subscription);
    };
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
        <h1 className="text-2xl md:text-4xl font-bold mb-4 tracking-widest text-gray-300">JANELA ATUAL</h1>

        {janelaAtual && (
          <div className={`${getCorPorCategoria(janelaAtual[0].categoria)} rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-2xl border-b-4 md:border-b-8`}>
            <h2 className="text-4xl md:text-8xl font-black mb-4 md:mb-8 drop-shadow-lg">
              {janelaAtual[0].categoria.toUpperCase()}
            </h2>

            {/* Grid adaptável: 1 coluna no celular, várias no PC */}
            <div className="flex flex-row w-full justify-center gap-3 md:gap-6 px-2 md:px-6">
              {janelaAtual.map(p => (
                <div
                  key={p.id}
                  className="bg-white text-black p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-2xl flex-1 min-w-0"
                >
                  {/* flex-1 acima faz ele esticar. min-w-0 evita que nomes longos quebrem o layout */}
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

        {/* DOTS / INDICADORES */}
        <div className="flex justify-center gap-2 md:gap-4 mt-4 md:mt-8">
          {janelasFila.map((_, i) => (
            <div
              key={i}
              className={`h-2 md:h-4 rounded-full transition-all duration-500 ${i === indexCarrossel ? 'bg-white w-8 md:w-16' : 'bg-gray-800 w-2 md:w-4'
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
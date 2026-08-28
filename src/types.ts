export interface Secao {
  numero: string;
  titulo: string;
}

export interface Capitulo {
  numero: number;
  id: string;
  titulo: string;
  parte: number | null;
  paginaInicio: number;
  paginaFim: number;
  texto: string;
  resumo: string | null;
  secoes: Secao[];
}

export interface Apendice {
  letra: string;
  id: string;
  titulo: string;
  paginaInicio: number;
  paginaFim: number;
  texto: string;
}

export interface Parte {
  numero: number;
  titulo: string;
  capitulos: number[];
}

export interface ManualData {
  meta: {
    titulo: string;
    totalPaginas: number;
    geradoEm: string;
    fonte: string;
  };
  partes: Parte[];
  capitulos: Capitulo[];
  apendices: Apendice[];
}

export interface HttpStatusEntry {
  codigo: number;
  nome: string;
  descricao: string;
}

export interface ConfigKeyEntry {
  chave: string;
  descricao: string;
  exemplo?: string;
}

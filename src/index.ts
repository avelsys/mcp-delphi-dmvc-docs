#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type {
  ManualData,
  HttpStatusEntry,
  ConfigKeyEntry,
  Capitulo,
  Apendice,
} from "./types.js";
import { dmvcSnippets } from "./dmvc-snippets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = (nome: string) => join(__dirname, "..", "data", nome);

const manual: ManualData = JSON.parse(
  readFileSync(dataPath("manual.json"), "utf-8")
);

let httpStatus: HttpStatusEntry[] | null = null;
let configKeys: ConfigKeyEntry[] | null = null;
try {
  httpStatus = JSON.parse(readFileSync(dataPath("apendice-a-http-status.json"), "utf-8"));
} catch {
  // parse estruturado nao disponivel - get_http_status cai para busca em texto bruto
}
try {
  configKeys = JSON.parse(readFileSync(dataPath("apendice-b-config-keys.json"), "utf-8"));
} catch {
  // parse estruturado nao disponivel - get_config_key cai para busca em texto bruto
}

function getCapitulo(numero: number): Capitulo | undefined {
  return manual.capitulos.find((c) => c.numero === numero);
}

function getApendice(letra: string): Apendice | undefined {
  return manual.apendices.find((a) => a.letra.toLowerCase() === letra.toLowerCase());
}

function trecho(texto: string, termo: string, ctx = 120): string {
  const idx = texto.toLowerCase().indexOf(termo.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - ctx);
  const end = Math.min(texto.length, idx + termo.length + ctx);
  const prefixo = start > 0 ? "..." : "";
  const sufixo = end < texto.length ? "..." : "";
  return prefixo + texto.slice(start, end).replace(/\s+/g, " ").trim() + sufixo;
}

function contarOcorrencias(texto: string, termo: string): number {
  if (!termo) return 0;
  return texto.toLowerCase().split(termo.toLowerCase()).length - 1;
}

const server = new Server(
  { name: "delphi-dmvc-docs", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_chapters",
      description:
        "Lista os capitulos do manual DMVCFramework, agrupados pelas partes do livro",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_chapter",
      description: "Retorna o texto completo de um capitulo do manual",
      inputSchema: {
        type: "object",
        properties: {
          numero: { type: "number", description: "Numero do capitulo (1 a 34)" },
        },
        required: ["numero"],
      },
    },
    {
      name: "get_chapter_summary",
      description: "Retorna o bloco RESUMO DO CAPITULO de um capitulo",
      inputSchema: {
        type: "object",
        properties: {
          numero: { type: "number", description: "Numero do capitulo (1 a 34)" },
        },
        required: ["numero"],
      },
    },
    {
      name: "search_manual",
      description:
        "Busca um termo em todos os capitulos e apendices do manual, retornando trechos de contexto",
      inputSchema: {
        type: "object",
        properties: {
          termo: { type: "string", description: "Termo de busca" },
        },
        required: ["termo"],
      },
    },
    {
      name: "list_appendices",
      description: "Lista os 4 apendices do manual (A, B, C, D)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_appendix",
      description: "Retorna o texto completo de um apendice do manual",
      inputSchema: {
        type: "object",
        properties: {
          letra: { type: "string", description: "Letra do apendice: a, b, c ou d" },
        },
        required: ["letra"],
      },
    },
    {
      name: "get_http_status",
      description:
        "Consulta o significado de um codigo HTTP_STATUS no Apendice A (lookup estruturado se disponivel, senao busca no texto bruto)",
      inputSchema: {
        type: "object",
        properties: {
          codigo: { type: "number", description: "Codigo HTTP, ex.: 404" },
        },
        required: ["codigo"],
      },
    },
    {
      name: "get_config_key",
      description:
        "Consulta uma chave de TMVCConfigKey/DotEnv no Apendice B (lookup estruturado se disponivel, senao busca no texto bruto)",
      inputSchema: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome ou trecho da chave de configuracao" },
        },
        required: ["nome"],
      },
    },
    {
      name: "get_snippet",
      description: "Retorna um snippet de codigo DMVCFramework",
      inputSchema: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            description: "Categoria do snippet",
            enum: Object.keys(dmvcSnippets),
          },
          nome: { type: "string", description: "Nome do snippet" },
        },
        required: ["categoria", "nome"],
      },
    },
    {
      name: "list_snippets",
      description: "Lista todos os snippets DMVC disponiveis, por categoria",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "search_snippets",
      description: "Busca snippets DMVC por palavra-chave (nome ou corpo do codigo)",
      inputSchema: {
        type: "object",
        properties: {
          termo: { type: "string", description: "Termo de busca" },
        },
        required: ["termo"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    if (name === "list_chapters") {
      let texto = `${manual.meta.titulo} (${manual.meta.totalPaginas} paginas)\n\n`;
      for (const parte of manual.partes) {
        texto += `PARTE ${parte.numero} — ${parte.titulo}\n`;
        for (const numCap of parte.capitulos) {
          const cap = getCapitulo(numCap);
          if (cap) {
            texto += `  ${cap.numero}. ${cap.titulo} (p. ${cap.paginaInicio}-${cap.paginaFim})\n`;
          }
        }
        texto += "\n";
      }
      return { content: [{ type: "text", text: texto }] };
    }

    if (name === "get_chapter") {
      const numero = args.numero as number;
      const cap = getCapitulo(numero);
      if (!cap) {
        return {
          content: [{ type: "text", text: `Capitulo nao encontrado: ${numero} (valido: 1-34)` }],
        };
      }
      return {
        content: [
          { type: "text", text: `Capitulo ${cap.numero} — ${cap.titulo}\n\n${cap.texto}` },
        ],
      };
    }

    if (name === "get_chapter_summary") {
      const numero = args.numero as number;
      const cap = getCapitulo(numero);
      if (!cap) {
        return {
          content: [{ type: "text", text: `Capitulo nao encontrado: ${numero} (valido: 1-34)` }],
        };
      }
      if (!cap.resumo) {
        return {
          content: [
            {
              type: "text",
              text: `Capitulo ${cap.numero} — ${cap.titulo}\n\n(Este capitulo nao tem um bloco RESUMO DO CAPITULO detectado. Use get_chapter para o texto completo.)`,
            },
          ],
        };
      }
      return {
        content: [
          { type: "text", text: `Capitulo ${cap.numero} — ${cap.titulo}\n\n${cap.resumo}` },
        ],
      };
    }

    if (name === "search_manual") {
      const termo = args.termo as string;
      const resultados: Array<{
        tipo: string;
        ref: string;
        titulo: string;
        ocorrencias: number;
        trecho: string;
      }> = [];

      for (const cap of manual.capitulos) {
        const ocorrencias = contarOcorrencias(cap.texto, termo);
        if (ocorrencias > 0) {
          resultados.push({
            tipo: "capitulo",
            ref: String(cap.numero),
            titulo: cap.titulo,
            ocorrencias,
            trecho: trecho(cap.texto, termo),
          });
        }
      }
      for (const apx of manual.apendices) {
        const ocorrencias = contarOcorrencias(apx.texto, termo);
        if (ocorrencias > 0) {
          resultados.push({
            tipo: "apendice",
            ref: apx.letra,
            titulo: apx.titulo,
            ocorrencias,
            trecho: trecho(apx.texto, termo),
          });
        }
      }

      if (resultados.length === 0) {
        return { content: [{ type: "text", text: `Nenhuma ocorrencia encontrada para: ${termo}` }] };
      }

      resultados.sort((a, b) => b.ocorrencias - a.ocorrencias);
      let texto = `Encontradas ocorrencias de "${termo}" em ${resultados.length} local(is):\n\n`;
      for (const r of resultados) {
        const rotulo = r.tipo === "capitulo" ? `Capitulo ${r.ref}` : `Apendice ${r.ref.toUpperCase()}`;
        texto += `${rotulo} — ${r.titulo} (${r.ocorrencias} ocorrencia(s))\n  "${r.trecho}"\n\n`;
      }
      return { content: [{ type: "text", text: texto }] };
    }

    if (name === "list_appendices") {
      let texto = "Apendices do manual:\n\n";
      for (const apx of manual.apendices) {
        texto += `${apx.letra.toUpperCase()}. ${apx.titulo} (p. ${apx.paginaInicio}-${apx.paginaFim})\n`;
      }
      return { content: [{ type: "text", text: texto }] };
    }

    if (name === "get_appendix") {
      const letra = args.letra as string;
      const apx = getApendice(letra);
      if (!apx) {
        return {
          content: [{ type: "text", text: `Apendice nao encontrado: ${letra} (valido: a, b, c, d)` }],
        };
      }
      return {
        content: [
          { type: "text", text: `Apendice ${apx.letra.toUpperCase()} — ${apx.titulo}\n\n${apx.texto}` },
        ],
      };
    }

    if (name === "get_http_status") {
      const codigo = args.codigo as number;
      if (httpStatus) {
        const entrada = httpStatus.find((h) => h.codigo === codigo);
        if (!entrada) {
          return { content: [{ type: "text", text: `Codigo HTTP nao encontrado: ${codigo}` }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `HTTP_STATUS.${entrada.nome} (${entrada.codigo})\n${entrada.descricao}`,
            },
          ],
        };
      }
      // Fallback: busca no texto bruto do Apendice A
      const apx = getApendice("a");
      if (!apx) {
        return { content: [{ type: "text", text: "Apendice A nao disponivel." }] };
      }
      const t = trecho(apx.texto, String(codigo), 200);
      if (!t) {
        return {
          content: [
            {
              type: "text",
              text: `Nao foi possivel localizar o codigo ${codigo} no texto do Apendice A. Use get_appendix("a") para ver a referencia completa.`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `(Busca em texto bruto do Apendice A — lookup estruturado nao disponivel)\n\n"${t}"`,
          },
        ],
      };
    }

    if (name === "get_config_key") {
      const nome = args.nome as string;
      if (configKeys) {
        const entrada = configKeys.find((c) => c.chave.toLowerCase().includes(nome.toLowerCase()));
        if (!entrada) {
          return { content: [{ type: "text", text: `Chave de configuracao nao encontrada: ${nome}` }] };
        }
        let texto = `${entrada.chave}\n${entrada.descricao}`;
        if (entrada.exemplo) texto += `\nExemplo: ${entrada.exemplo}`;
        return { content: [{ type: "text", text: texto }] };
      }
      // Fallback: busca no texto bruto do Apendice B
      const apx = getApendice("b");
      if (!apx) {
        return { content: [{ type: "text", text: "Apendice B nao disponivel." }] };
      }
      const t = trecho(apx.texto, nome, 200);
      if (!t) {
        return {
          content: [
            {
              type: "text",
              text: `Nao foi possivel localizar "${nome}" no texto do Apendice B. Use get_appendix("b") para ver a referencia completa.`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `(Busca em texto bruto do Apendice B — lookup estruturado nao disponivel)\n\n"${t}"`,
          },
        ],
      };
    }

    if (name === "get_snippet") {
      const categoria = args.categoria as string;
      const nome = args.nome as string;
      const snippet = dmvcSnippets[categoria]?.[nome];
      if (!snippet) {
        const disponiveis = Object.keys(dmvcSnippets[categoria] || {}).join(", ");
        return {
          content: [
            {
              type: "text",
              text: `Snippet nao encontrado: ${categoria}/${nome}\n\nDisponiveis: ${disponiveis}`,
            },
          ],
        };
      }
      return {
        content: [
          { type: "text", text: `Snippet: ${categoria}/${nome}\n\n\`\`\`pascal\n${snippet}\n\`\`\`` },
        ],
      };
    }

    if (name === "list_snippets") {
      let texto = "Snippets DMVC disponiveis:\n\n";
      for (const [cat, lista] of Object.entries(dmvcSnippets)) {
        texto += `${cat}:\n`;
        for (const nomeSnippet of Object.keys(lista)) {
          texto += `  - ${nomeSnippet}\n`;
        }
        texto += "\n";
      }
      return { content: [{ type: "text", text: texto }] };
    }

    if (name === "search_snippets") {
      const termo = args.termo as string;
      const resultados: Array<{ cat: string; nome: string }> = [];
      for (const [cat, lista] of Object.entries(dmvcSnippets)) {
        for (const [nomeSnippet, codigo] of Object.entries(lista)) {
          if (
            nomeSnippet.toLowerCase().includes(termo.toLowerCase()) ||
            codigo.toLowerCase().includes(termo.toLowerCase())
          ) {
            resultados.push({ cat, nome: nomeSnippet });
          }
        }
      }
      if (resultados.length === 0) {
        return { content: [{ type: "text", text: `Nenhum snippet encontrado com: ${termo}` }] };
      }
      let texto = `Encontrados ${resultados.length} snippet(s):\n\n`;
      for (const { cat, nome: nomeSnippet } of resultados) {
        texto += `- ${cat}/${nomeSnippet}\n`;
      }
      return { content: [{ type: "text", text: texto }] };
    }

    throw new Error("Ferramenta desconhecida");
  } catch (error) {
    return {
      content: [
        { type: "text", text: `Erro: ${error instanceof Error ? error.message : String(error)}` },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Delphi DMVC Docs rodando...");
}

main().catch(console.error);

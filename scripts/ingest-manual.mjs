// Script de ingestao unico: le o PDF do manual DMVCFramework e gera
// data/manual.json (+ apendices estruturados, se o parse for confiavel).
// Rodar com: npm run ingest
// Nao faz parte do build TS nem do servidor em runtime.

import pdf from "pdf-parse/lib/pdf-parse.js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
// Caminho do PDF: primeiro argumento de linha de comando, senao a variavel de
// ambiente DMVC_GUIDE_PDF, senao o nome padrao na raiz do projeto.
const PDF_PATH =
  process.argv[2] ||
  process.env.DMVC_GUIDE_PDF ||
  join(__dirname, "..", "DMVCFramework-Guia-Completo-PT-BR.pdf");

// Titulos que a deteccao automatica (1a linha nao-trivial apos o marcador)
// nao acertou - preencher apos rodar o script uma vez e comparar com o
// sumario real do PDF.
const TITULO_OVERRIDES = {
  // "cap-06": "Autenticacao e Autorizacao com JWT",
};

// Agrupamento de capitulos em partes do livro. Transcrito do sumario do PDF.
// Ajustar numeros de capitulo por parte apos conferir o sumario real.
const PARTES = [
  { numero: 1, titulo: "Fundamentos", capitulos: [1, 2, 3, 4] },
  { numero: 2, titulo: "Middlewares Essenciais", capitulos: [5, 6, 7, 8] },
  { numero: 3, titulo: "Persistência de Dados", capitulos: [9, 10, 11, 12] },
  { numero: 4, titulo: "Serialização", capitulos: [13, 14] },
  { numero: 5, titulo: "Documentação de API", capitulos: [15] },
  { numero: 6, titulo: "Comunicação e Integração", capitulos: [16, 17, 18] },
  { numero: 7, titulo: "Views e Front-end", capitulos: [19, 20] },
  { numero: 8, titulo: "Uso Avançado", capitulos: [21, 22, 23, 24, 25] },
  { numero: 9, titulo: "Configuração e Segurança", capitulos: [26, 27] },
  {
    numero: 10,
    titulo: "Projeto Final: Loja API",
    capitulos: [28, 29, 30, 31, 32, 33, 34],
  },
];

const ANCHOR_RE = /##MARK_(cap-(\d{2})|apx-([a-d]))##/;

let pageCounter = 0;

async function renderPage(pageData) {
  pageCounter++;
  const textContent = await pageData.getTextContent({ normalizeWhitespace: false });
  let lastY;
  let text = "";
  for (const item of textContent.items) {
    if (lastY === item.transform[5] || lastY === undefined) {
      text += item.str;
    } else {
      text += "\n" + item.str;
    }
    lastY = item.transform[5];
  }
  return `\n@@PAGE:${pageCounter}@@\n${text}`;
}

function splitByPage(fullText) {
  const parts = fullText.split(/@@PAGE:(\d+)@@/);
  const pages = [];
  for (let i = 1; i < parts.length; i += 2) {
    pages.push({ page: Number(parts[i]), text: parts[i + 1] });
  }
  return pages;
}

function findAnchors(pages) {
  const anchors = [];
  for (const p of pages) {
    const m = p.text.match(ANCHOR_RE);
    if (m) {
      anchors.push({
        raw: m[0],
        tipo: m[2] ? "capitulo" : "apendice",
        numero: m[2] ? Number(m[2]) : null,
        letra: m[3] ?? null,
        id: m[2] ? `cap-${m[2]}` : `apx-${m[3]}`,
        page: p.page,
      });
    }
  }
  return anchors;
}

const LINHA_IGNORADA_RE = /^(PARTE\s+[IVX]+|AP[ÊE]NDICES|Ap[êe]ndice\s+[A-D]|Cap[íi]tulo\s+\d+)\b/i;

function detectarTitulo(bodyFirstPageText, marcadorRaw) {
  const idx = bodyFirstPageText.indexOf(marcadorRaw);
  const depois = bodyFirstPageText
    .slice(idx + marcadorRaw.length)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && !LINHA_IGNORADA_RE.test(l));
  if (depois.length === 0) return "(titulo nao detectado)";

  // Titulos as vezes quebram em uma 2a linha curta (ex.: "...RQL, Paginacao e\nValidacao").
  // So anexa a linha seguinte se ela for uma continuacao curta (uma palavra ou poucas),
  // nunca o inicio de um paragrafo de corpo de texto (que normalmente e uma frase longa).
  let titulo = depois[0];
  if (depois[1] && depois[1].length <= 30 && !/\s.+\s/.test(depois[1])) {
    titulo += " " + depois[1];
  }
  return titulo;
}

function extractResumo(texto) {
  const m = texto.match(/RESUMO\s+DO\s+CAP[ÍI]TULO/i);
  if (!m) return null;
  return texto.slice(m.index).trim();
}

function extractSecoes(texto, capituloNum) {
  const linhaRe = new RegExp(
    `^${capituloNum}\\.(\\d+)\\s*([A-ZÀ-Ú][^\\n]{3,80})$`,
    "gm"
  );
  const secoes = [];
  let m;
  while ((m = linhaRe.exec(texto))) {
    secoes.push({ numero: `${capituloNum}.${m[1]}`, titulo: m[2].trim() });
  }
  return secoes;
}

function buildEntries(pages, anchors, totalPaginas) {
  const entries = [];
  for (let i = 0; i < anchors.length; i++) {
    const cur = anchors[i];
    const next = anchors[i + 1];
    const paginaInicio = cur.page;
    const paginaFim = next ? next.page - 1 : totalPaginas;

    const bodyPages = pages.filter(
      (p) => p.page >= paginaInicio && p.page <= paginaFim
    );
    const rawText = bodyPages.map((p) => p.text).join("\n");
    const texto = rawText.replace(cur.raw, "").trim();
    const tituloDetectado =
      TITULO_OVERRIDES[cur.id] ?? detectarTitulo(bodyPages[0]?.text ?? "", cur.raw);

    entries.push({ ...cur, paginaInicio, paginaFim, texto, titulo: tituloDetectado });
  }
  return entries;
}

function parseHttpStatus(texto) {
  const HTTP_RE = /^(\d{3})\s*[-–—:]\s*([A-Za-zÀ-ú ]{2,40}?)\s*[-–—:]\s*(.+)$/gm;
  const out = [];
  let m;
  while ((m = HTTP_RE.exec(texto))) {
    out.push({ codigo: Number(m[1]), nome: m[2].trim(), descricao: m[3].trim() });
  }
  return out;
}

function parseConfigKeys(texto) {
  const KEY_RE = /^([A-Za-z][A-Za-z0-9_]{2,40})\s*[-–—:]\s*(.+)$/gm;
  const out = [];
  let m;
  while ((m = KEY_RE.exec(texto))) {
    out.push({ chave: m[1].trim(), descricao: m[2].trim() });
  }
  return out;
}

async function main() {
  console.log(`Lendo PDF: ${PDF_PATH}`);
  const buffer = readFileSync(PDF_PATH);
  const result = await pdf(buffer, { pagerender: renderPage });
  const totalPaginas = result.numpages;
  console.log(`Total de paginas: ${totalPaginas}`);

  const pages = splitByPage(result.text);
  const anchors = findAnchors(pages);
  const capAnchors = anchors.filter((a) => a.tipo === "capitulo");
  const apxAnchors = anchors.filter((a) => a.tipo === "apendice");

  console.log(
    `Ancoras encontradas: ${capAnchors.length} capitulos, ${apxAnchors.length} apendices`
  );
  if (capAnchors.length !== 34) {
    console.error(
      `AVISO: esperado 34 capitulos, encontrado ${capAnchors.length}. Revisar ANCHOR_RE / PDF.`
    );
  }
  if (apxAnchors.length !== 4) {
    console.error(
      `AVISO: esperado 4 apendices, encontrado ${apxAnchors.length}. Revisar ANCHOR_RE / PDF.`
    );
  }

  const entries = buildEntries(pages, anchors, totalPaginas);

  const capitulos = entries
    .filter((e) => e.tipo === "capitulo")
    .map((e) => {
      const parte = PARTES.find((p) => p.capitulos.includes(e.numero))?.numero ?? null;
      return {
        numero: e.numero,
        id: e.id,
        titulo: e.titulo,
        parte,
        paginaInicio: e.paginaInicio,
        paginaFim: e.paginaFim,
        texto: e.texto,
        resumo: extractResumo(e.texto),
        secoes: extractSecoes(e.texto, e.numero),
      };
    });

  const apendices = entries
    .filter((e) => e.tipo === "apendice")
    .map((e) => ({
      letra: e.letra,
      id: e.id,
      titulo: e.titulo,
      paginaInicio: e.paginaInicio,
      paginaFim: e.paginaFim,
      texto: e.texto,
    }));

  console.log("\n--- Titulos detectados (conferir contra o sumario do PDF) ---");
  for (const c of capitulos) {
    console.log(`  cap-${String(c.numero).padStart(2, "0")} (p.${c.paginaInicio}): ${c.titulo}`);
  }
  for (const a of apendices) {
    console.log(`  apx-${a.letra} (p.${a.paginaInicio}): ${a.titulo}`);
  }

  const manual = {
    meta: {
      titulo: "DMVCFramework - Guia Completo (PT-BR)",
      totalPaginas,
      geradoEm: new Date().toISOString().slice(0, 10),
      fonte: "DMVCFramework-Guia-Completo-PT-BR.pdf",
    },
    partes: PARTES,
    capitulos,
    apendices,
  };

  writeFileSync(join(DATA_DIR, "manual.json"), JSON.stringify(manual, null, 2), "utf-8");
  console.log(`\nGravado data/manual.json (${capitulos.length} capitulos, ${apendices.length} apendices).`);

  const apxA = apendices.find((a) => a.letra === "a");
  const apxB = apendices.find((a) => a.letra === "b");

  if (apxA) {
    const httpStatus = parseHttpStatus(apxA.texto);
    console.log(`Apendice A: ${httpStatus.length} entradas HTTP_STATUS detectadas (esperado ~40-60).`);
    if (httpStatus.length >= 30) {
      writeFileSync(
        join(DATA_DIR, "apendice-a-http-status.json"),
        JSON.stringify(httpStatus, null, 2),
        "utf-8"
      );
      console.log("Gravado data/apendice-a-http-status.json (parse estruturado).");
    } else {
      console.log(
        "Contagem abaixo do esperado - NAO gravando JSON estruturado. get_http_status usara fallback em texto bruto."
      );
    }
  }

  if (apxB) {
    const configKeys = parseConfigKeys(apxB.texto);
    console.log(`Apendice B: ${configKeys.length} entradas TMVCConfigKey detectadas (esperado ~20-40).`);
    if (configKeys.length >= 15) {
      writeFileSync(
        join(DATA_DIR, "apendice-b-config-keys.json"),
        JSON.stringify(configKeys, null, 2),
        "utf-8"
      );
      console.log("Gravado data/apendice-b-config-keys.json (parse estruturado).");
    } else {
      console.log(
        "Contagem abaixo do esperado - NAO gravando JSON estruturado. get_config_key usara fallback em texto bruto."
      );
    }
  }

  console.log("\nIngestao concluida. Revise os titulos acima e ajuste TITULO_OVERRIDES/PARTES se necessario, depois rode novamente.");
}

main().catch((err) => {
  console.error("Falha na ingestao:", err);
  process.exit(1);
});

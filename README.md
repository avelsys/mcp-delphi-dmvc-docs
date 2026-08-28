# mcp-delphi-dmvc-docs

Servidor MCP (Model Context Protocol) com um **guia completo e original do
DelphiMVCFramework em português (PT-BR)**, mais de uma dúzia de snippets de
código prontos para uso, indexados e pesquisáveis por ferramentas como
Claude Code, Claude Desktop ou qualquer outro cliente MCP.

O guia foi escrito a partir da análise do código-fonte do
[DelphiMVCFramework](https://github.com/danieleteti/delphimvcframework)
(versão 3.4.3 "magnesium") — 34 capítulos cobrindo desde roteamento e
middlewares até WebSockets, JSON-RPC 2.0, Repository Pattern multi-banco e
views server-side (Mustache/TemplatePro/WebStencils).

> **Sobre licenciamento**: o DelphiMVCFramework (o framework em si) é do
> [Daniele Teti](https://github.com/danieleteti) e contribuidores, licenciado
> em Apache License 2.0. O conteúdo do guia neste repositório é uma obra
> **original**, escrita pelo autor deste pacote a partir da leitura do
> código-fonte do framework — não é uma cópia de nenhum material comercial de
> terceiros. Veja [LICENSE](./LICENSE) para detalhes.

## O que este servidor oferece

| Ferramenta | Para que serve |
|---|---|
| `list_chapters` | Lista os 34 capítulos do guia, agrupados por parte do livro |
| `get_chapter` | Retorna o texto completo de um capítulo (1–34) |
| `get_chapter_summary` | Retorna só o resumo de um capítulo |
| `search_manual` | Busca um termo em todos os capítulos e apêndices, com trechos de contexto |
| `list_appendices` | Lista os 4 apêndices (A–D) |
| `get_appendix` | Retorna o texto completo de um apêndice |
| `get_http_status` | Consulta o significado de um código `HTTP_STATUS` específico do DMVC |
| `get_config_key` | Consulta uma chave de configuração (`TMVCConfigKey`/`.env`) |
| `get_snippet` | Retorna um snippet de código pronto de uma categoria |
| `list_snippets` | Lista todos os snippets disponíveis, por categoria |
| `search_snippets` | Busca snippets por palavra-chave (nome ou conteúdo do código) |

### Categorias de snippets disponíveis

`dmvc_controller`, `dmvc_auth`, `dmvc_orm`, `dmvc_rql`, `dmvc_middleware`,
`dmvc_swagger`, `dmvc_jsonrpc`, `dmvc_websocket`, `dmvc_views`, `dmvc_config`,
`dmvc_tls`.

## Instalação

### Opção 1 — via `npx` (recomendado, sem instalar nada globalmente)

```bash
claude mcp add delphi-dmvc-docs -- npx -y mcp-delphi-dmvc-docs
```

### Opção 2 — instalar global via npm

```bash
npm install -g mcp-delphi-dmvc-docs
claude mcp add delphi-dmvc-docs -- mcp-delphi-dmvc-docs
```

### Opção 3 — a partir do código-fonte

```bash
git clone https://github.com/avelsys/mcp-delphi-dmvc-docs.git
cd mcp-delphi-dmvc-docs
npm install
npm run build
claude mcp add delphi-dmvc-docs -- node "$(pwd)/build/index.js"
```

Depois de registrado, o servidor fica disponível em qualquer projeto (escopo
`user`) ou só no projeto atual (`--scope local`, se preferir isolar).

### Configuração manual (`claude_desktop_config.json` ou `.mcp.json`)

```json
{
  "mcpServers": {
    "delphi-dmvc-docs": {
      "command": "npx",
      "args": ["-y", "mcp-delphi-dmvc-docs"]
    }
  }
}
```

## Regenerando o guia a partir de uma versão mais nova do PDF

O conteúdo já vem pronto em `data/manual.json` — não é necessário rodar nada
para usar o servidor. Mas se você quiser atualizar o guia a partir de uma
nova versão do PDF-fonte:

```bash
npm run ingest -- caminho/para/DMVCFramework-Guia-Completo-PT-BR.pdf
# ou, via variável de ambiente:
DMVC_GUIDE_PDF=caminho/para/o.pdf npm run ingest
```

O script confere automaticamente se encontrou os 34 capítulos e 4 apêndices
esperados e avisa se a estrutura do PDF mudou (veja `scripts/ingest-manual.mjs`).

## Desenvolvimento

```bash
npm install
npm run watch   # tsc --watch
```

O servidor usa stdio (`StdioServerTransport`) — para testar localmente sem um
cliente MCP completo, use o [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## Contribuindo

Issues e PRs são bem-vindos — principalmente correções de conteúdo do guia
(algum capítulo desatualizado em relação a uma versão nova do framework) ou
novos snippets. Abra uma issue descrevendo o que mudou antes de um PR grande.

## Licença

MIT — veja [LICENSE](./LICENSE).

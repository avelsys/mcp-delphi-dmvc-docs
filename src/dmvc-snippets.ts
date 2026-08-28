// Snippets DMVCFramework, escritos a mao com base nos exemplos de codigo do
// manual "DMVCFramework-Guia-Completo-PT-BR.pdf" (consultar get_chapter no
// numero indicado em cada comentario para o contexto completo).

export const dmvcSnippets: Record<string, Record<string, string>> = {
  dmvc_controller: {
    basic_controller: `// Cap. 3 - Roteamento e Controllers
[MVCPath('/produtos')]
[MVCRequiresAuthentication]
TProdutoController = class(TMVCController)
public
  [MVCPath]
  [MVCHTTPMethod([httpGET])]
  procedure GetProdutos;

  [MVCPath('/($id)')]
  [MVCHTTPMethod([httpGET])]
  procedure GetProdutoById(const id: Integer);
end;

procedure TProdutoController.GetProdutos;
begin
  Render(OKResponse(TProduto.All));
end;

procedure TProdutoController.GetProdutoById(const id: Integer);
var
  LProduto: TProduto;
begin
  LProduto := TMVCActiveRecord.GetByPk<TProduto>(id, False);
  if not Assigned(LProduto) then
    Render(NotFoundResponse('Produto nao encontrado'))
  else
    Render(OKResponse(LProduto));
end;`,

    parametros_injetados: `// Cap. 3 - Injecao de parametros (query string, header, body)
[MVCPath('/produtos')]
[MVCHTTPMethod([httpGET])]
procedure GetProdutos(
  [MVCFromQueryString('page', '1')] APage: Integer;
  [MVCFromQueryString('limit', '50')] ALimit: Integer;
  [MVCFromHeader('X-Empresa-Id', '0')] AEmpresaId: Integer);

[MVCPath]
[MVCHTTPMethod([httpPOST])]
[MVCConsumes(TMVCMediaType.APPLICATION_JSON)]
procedure CreateProduto([MVCFromBody] AProduto: TProduto);`,
  },

  dmvc_auth: {
    basic_auth_handler: `// Cap. 5 - Autenticacao Basic: contrato comum IMVCAuthenticationHandler
// (Basic, JWT e handlers customizados implementam a mesma interface)
IMVCAuthenticationHandler = interface
  ['{19B580EA-8A47-4364-A302-EEF3C6207A9F}']
  procedure OnRequest(const AContext: TWebContext; const AControllerQualifiedClassName,
    AActionName: string; var AAuthenticationRequired: Boolean);
  procedure OnAuthentication(const AContext: TWebContext; const AUserName, APassword: string;
    AUserRoles: TList<string>; var AIsValid: Boolean;
    const ASessionData: TDictionary<string, string>);
  procedure OnAuthorization(const AContext: TWebContext; AUserRoles: TList<string>;
    const AControllerQualifiedClassName: string; const AActionName: string;
    var AIsAuthorized: Boolean);
end;

// Registro:
FEngine.AddMiddleware(TMVCBasicAuthenticationMiddleware.Create(LMeuAuthHandler));`,

    role_based_auth: `// Cap. 5 - Autenticacao baseada em papeis (TRoleBasedAuthHandler)
TClienteAuthHandler = class(TRoleBasedAuthHandler)
public
  procedure OnAuthentication(const AContext: TWebContext;
    const UserName, Password: string; UserRoles: TList<string>;
    var IsValid: Boolean; const SessionData: TDictionary<string, string>); override;
  // OnRequest e OnAuthorization sao herdados de TRoleBasedAuthHandler:
  // continuam checando [MVCRequiresRole] via RTTI, sem precisar reescrever nada
end;

// Uso em um controller:
[MVCPath('/relatorios/financeiro')]
[MVCRequiresRole('admin;financeiro', MVCRoleEval.reOR)]  // admin OU financeiro
TRelatorioFinanceiroController = class(TBaseController)
public
  [MVCPath('/exportar')]
  [MVCHTTPMethods([httpGET])]
  [MVCRequiresRole('exportar_relatorio')]  // + precisa ter esse tambem (AND entre atributos)
  procedure Exportar;
end;`,

    jwt_setup: `// Cap. 5.4-5.5 - Registrando o middleware JWT no bootstrap
// (TJWT vive em MVCFramework.JWT.pas; middleware em
//  MVCFramework.Middleware.JWT.pas)
FEngine.AddMiddleware(
  TMVCJWTAuthenticationMiddleware.Create(
    LAuthHandler,               // IMVCAuthenticationHandler
    procedure(const JWT: TJWT)  // AConfigClaims: TJWTClaimsSetup
    begin
      JWT.Claims.Issuer := 'MinhaAPI';
      JWT.Claims.ExpirationTime := Now + OneHour;
      JWT.Claims.NotBefore := Now - OneMinute * 5;
      JWT.Claims.IssuedAt := Now;
    end,
    dotEnv.Env('jwt.secret.key', 'D3lph1MVCFram3w0rk'),  // ASecret
    '/login'                     // ALoginURLSegment
  )
);

// Protegendo uma rota:
[MVCPath('/produtos')]
[MVCRequiresAuthentication]
TProdutoController = class(TMVCController)
// ...`,

    jwt_refresh_token: `// Cap. 5.6 - Refresh token: contrato de armazenamento
// (TInMemoryRefreshTokenStorage para dev; TDatabaseRefreshTokenStorage p/ producao)
IRefreshTokenStorage = interface
  ['{B8F8D8E0-5E5C-4F1F-9B2A-1C3D4E5F6A7B}']
  procedure StoreRefreshToken(const AUsername, ARefreshToken: string; AExpiresAt: TDateTime);
  function ValidateRefreshToken(const ARefreshToken: string; out AUsername: string): Boolean;
  procedure RevokeRefreshToken(const ARefreshToken: string);
  procedure RevokeAllUserTokens(const AUsername: string);
end;

// Registro (TJWTRefreshAuthenticationMiddleware, classe de app, ver Cap. 5.6):
RefreshStorage := TInMemoryRefreshTokenStorage.Create;
LAuthHandler := TClienteAuthHandler.Create;
FEngine.AddMiddleware(TJWTRefreshAuthenticationMiddleware.Create(
  LAuthHandler, LClaimsSetup, RefreshStorage,
  dotEnv.Env('jwt.secret.key', 'D3lph1MVCFram3w0rk')));

// No handler: senha vazia = fluxo de refresh (so revalida se o usuario ainda existe/ativo)
procedure TClienteAuthHandler.OnAuthentication(const AContext: TWebContext;
  const UserName, Password: string; UserRoles: TList<string>;
  var IsValid: Boolean; const SessionData: TDictionary<string, string>);
begin
  IsValid := False;
  if Password.Trim.IsEmpty then
  begin
    // fluxo de refresh: so confirma que o cliente ainda existe e esta ativo
    // ...
    Exit;
  end;
  // ... fluxo de login normal ...
end;`,
  },

  dmvc_orm: {
    entidade_mapeada: `// Cap. 9.2 - Entidade MVCActiveRecord mapeada por atributos
[MVCNameCase(ncCamelCase)]
[MVCTable('produto')]
TProduto = class(TEntidadeBase)
private
  [MVCTableField('cdproduto', [foPrimaryKey, foAutoGenerated])]
  Fcdproduto: NullableInt64;
  [MVCTableField('dsproduto')]
  Fdsproduto: string;
  [MVCTableField('vlpreco')]
  Fvlpreco: Currency;
  [MVCTableField('qtestoque')]
  Fqtestoque: Integer;
public
  property cdproduto: NullableInt64 read Fcdproduto write Fcdproduto;
  property dsproduto: string read Fdsproduto write Fdsproduto;
  property vlpreco: Currency read Fvlpreco write Fvlpreco;
  property qtestoque: Integer read Fqtestoque write Fqtestoque;
end;
// Use NullableInt64 (ou outro NullableXxx) na PK: e o que permite Store()
// decidir sozinho entre Insert e Update (ver snippet crud_manual).`,

    crud_manual: `// Cap. 9.3-9.4 - LoadByPK/GetByPK, Insert, Update, Delete, Store
// (a) GetByPK - helper de classe, controla a instanciacao pra voce
LProduto := TMVCActiveRecord.GetByPK<TProduto>(id, False);
if not Assigned(LProduto) then
  Exit(RenderNotFound('Produto nao encontrado'));
try
  LProduto.vlpreco := ANovoPreco;
  LProduto.Update; // RaiseExceptionIfNotFound = True por padrao
finally
  LProduto.Free;
end;

// Insert
LProduto := TProduto.Create;
try
  LProduto.dsproduto := 'Teclado mecanico';
  LProduto.vlpreco := 249.90;
  LProduto.qtestoque := 50;
  LProduto.Insert; // cdproduto (foAutoGenerated) ja vem preenchido apos o Insert
  RenderCreated('Produto criado', LProduto);
finally
  LProduto.Free;
end;

// Store: decide Insert vs Update pela presenca de valor na PK Nullable*
procedure TMVCActiveRecord.Store;
begin
  if TryGetPKValue(...) then Update else Insert;
end;`,

    unit_of_work: `// Cap. 9.7 - IMVCUnitOfWork<T>: agrupa inserts/updates/deletes numa transacao
var
  LUoW: IMVCUnitOfWork<TPedidoItem>;
  LItem: TPedidoItem;
begin
  LUoW := TMVCUnitOfWork<TPedidoItem>.Create; // interface: sem Free manual
  for LItem in LItensNovos     do LUoW.RegisterInsert(LItem);
  for LItem in LItensAlterados do LUoW.RegisterUpdate(LItem);
  for LItem in LItensRemovidos do LUoW.RegisterDelete(LItem);

  TMVCActiveRecord.CurrentConnection.StartTransaction;
  try
    (LUoW as IMVCMultiExecutor<TPedidoItem>).Apply;
    TMVCActiveRecord.CurrentConnection.Commit;
  except
    TMVCActiveRecord.CurrentConnection.Rollback;
    raise;
  end;
end;`,

    merge_master_detail: `// Cap. 9.8 - Merge<T>: atalho para master-detail (compara lista atual x nova)
TMVCActiveRecord.Merge<TPedidoItem>(LItensAtuaisDoBanco, LItensRecebidosDoRequest,
  [mmInsert, mmUpdate, mmDelete]).Apply;

// Com callback (validacao / EADelete customizado):
TMVCActiveRecord.Merge<TClienteEndereco>(LEnderecosAtuais, LEnderecosNovos,
  [mmInsert, mmUpdate, mmDelete]).Apply(
  procedure(const AEndereco: TClienteEndereco; const AAction: TMVCEntityAction; var AHandled: Boolean)
  begin
    if (AAction in [eaCreate, eaUpdate]) and AEndereco.dscep.Trim.IsEmpty then
      raise EMVCActiveRecordValidationError.Create('CEP e obrigatorio para todo endereco.');
  end);`,

    select_rql_dataset: `// Cap. 9.9 - Select/SelectOne (SQL cru parametrizado), Where<T>, SelectDataSet
LProdutosBaixoEstoque := TMVCActiveRecord.Select<TProduto>(
  'SELECT * FROM produto WHERE qtestoque <= ? ORDER BY qtestoque', [10]);

LProduto := TMVCActiveRecord.SelectOne<TProduto>(
  'SELECT * FROM produto WHERE cdproduto = ?', [cdProduto]);

// Where<T> monta o SELECT inteiro (FROM + particao padrao + WHERE)
LProdutosAtivos := TMVCActiveRecord.Where<TProduto>('qtestoque > ?', [0]);

// Alimentar grid/relatorio sem materializar TProduto:
LDataSet := TMVCActiveRecord.SelectDataSet(
  'SELECT cdproduto, dsproduto, qtestoque FROM produto WHERE qtestoque <= ?', [10]);`,
  },

  dmvc_rql: {
    filtro_simples_composto: `// Cap. 10 - Sintaxe RQL
'eq(dsproduto,"Notebook")'                              // igualdade
'and(gt(vlpreco,100),lt(qtestoque,10))'                 // AND
'or(eq(dsproduto,"Notebook"),eq(dsproduto,"Mouse"))'    // OR
'and(gt(vltotal,1000),lt(dtpedido,"2026-01-01"))'       // data como string ISO
'contains(dscategorias,"eletronicos")'
'in(cdcliente,(10,25,42))'
'out(cdcliente,(1,2))'`,

    busca_paginada: `// Cap. 10 - SelectRQL / SelectOneByRQL, montagem com Format
LCliente := TMVCActiveRecord.SelectOneByRQL<TCliente>(
  Format('eq(dsemail,"%s")', [AEmail]), False);

// ultimos pedidos, mais recente primeiro, pagina 1 de 20
LPedidos := TMVCActiveRecord.SelectRQL<TPedido>('sort(-dtpedido)&limit(20,0)', 20);

// Count<T> com o mesmo filtro RQL (para paginacao)
LTotal := TMVCActiveRecord.Count<TPedido>('sort(-dtpedido)');

// CUIDADO: valores vindos do usuario devem ser interpolados com Format
// e nunca concatenados diretamente na string RQL.`,
  },

  dmvc_middleware: {
    pipeline_registro: `// Cap. 4 - Registrando middlewares no TMVCEngine (ordem importa: FIFO)
FEngine := TMVCEngine.Create(Self);
FEngine
  .AddMiddleware(TMVCCORSMiddleware.Create)
  .AddMiddleware(TMVCTraceMiddleware.Create)
  .AddMiddleware(TMeuMiddlewareCustom.Create);`,

    middleware_customizado: `// Cap. 4.4 - Middleware customizado completo (IMVCMiddleware)
unit App.Middleware.RequestId;
interface
uses
  MVCFramework, MVCFramework.Logger;
type
  TRequestIdMiddleware = class(TInterfacedObject, IMVCMiddleware)
  protected
    procedure OnBeforeRouting(AContext: TWebContext; var AHandled: Boolean);
    procedure OnBeforeControllerAction(AContext: TWebContext;
      const AControllerQualifiedClassName: string; const AActionName: string;
      var AHandled: Boolean);
    procedure OnAfterControllerAction(AContext: TWebContext;
      const AControllerQualifiedClassName: string; const AActionName: string;
      const AHandled: Boolean);
    procedure OnAfterRouting(AContext: TWebContext; const AHandled: Boolean);
  end;
// 4 fases do pipeline: OnBeforeRouting -> OnBeforeControllerAction ->
// (a action do controller roda) -> OnAfterControllerAction -> OnAfterRouting.
// Setar AHandled := True em qualquer fase "before" encerra a requisicao ali
// (ideal para CORS preflight, rate limit, auth) - a resposta ja deve estar montada.`,

    cors_middleware: `// Cap. 6.1 - CORS com origens explicitas (nunca '*' com AllowsCredentials=True)
FEngine.AddMiddleware(
  TMVCCORSMiddleware.Create(
    'https://app.minhaloja.com,https://staging.minhaloja.com', // AAllowedOriginURLs
    True,   // AAllowsCredentials - so seguro com origem explicita
    '',     // AExposeHeaders
    TMVCCORSDefaults.ALLOWS_HEADERS,
    TMVCCORSDefaults.ALLOWS_METHODS,
    600     // AAccessControlMaxAge (segundos)
  )
);`,

    session_middleware: `// Cap. 7 - Sessao (memoria, arquivo ou banco) + leitura/escrita no controller
FEngine.AddMiddleware(UseMemorySessionMiddleware(30 { minutos }, False { HttpOnly }));
// ou: UseFileSessionMiddleware(30, False, 'dmvc_sessions');
// ou: precisa TMVCActiveRecordMiddleware antes de UseDatabaseSessionMiddleware.

procedure TClienteController.Login(AContext: TWebContext);
begin
  Session['usuario_id'] := IntToStr(LUsuario.CdUsuario);
  RenderSuccess('Login efetuado');
end;

procedure TClienteController.Perfil(AContext: TWebContext);
begin
  if Session['usuario_id'].IsEmpty then
    RaiseSessionExpired; // -> EMVCSessionExpiredException, HTTP 401
  RenderSuccess(Format('Usuario logado: %s', [Session['usuario_id']]));
end;`,

    rate_limit_middleware: `// Cap. 8 - Rate limiting (memoria ou Redis) + callback de limite excedido
FEngine.AddMiddleware(
  TMVCRateLimitMiddleware.Create(
    100,  // max requests
    60    // janela em segundos
  )
);

// Com storage Redis (compartilhado entre instancias):
FEngine.AddMiddleware(
  TMVCRateLimitMiddleware.Create(100, 60, rlkIPAddress,
    TMVCRedisRateLimitStorage.Create(
      dotEnv.Env('redis.host', '127.0.0.1'),
      dotEnv.Env('redis.port', 6379),
      dotEnv.Env('redis.password', ''),
      'ratelimit:api:')));`,
  },

  dmvc_swagger: {
    registro_swagger: `// Cap. 15 - Info basica do documento Swagger/OpenAPI
LSwagInfo.Title := 'Loja API - Documentacao';
LSwagInfo.Version := 'v1';
LSwagInfo.Description := 'API RESTful de catalogo, clientes e pedidos';
LSwagInfo.ContactName := 'Equipe Loja API';
LSwagInfo.ContactEmail := 'suporte@loja-api.exemplo';
LSwagInfo.LicenseName := 'Apache License 2.0';`,

    controller_documentado: `// Cap. 15 - Controller documentado com atributos MVCSwagXxx
[MVCSWAGDefaultSummaryTags('Produtos')]
[MVCPath('/produtos')]
[MVCRequiresAuthentication]
[MVCSwagAuthentication(atJsonWebToken)]
TProdutoController = class(TBaseController)
public
  [MVCSwagSummary(TSwaggerConst.USE_DEFAULT_SUMMARY_TAGS, 'Listar produtos', 'GetProdutos')]
  [MVCSwagResponses(200, 'Lista de produtos retornada com sucesso')]
  [MVCSwagResponses(400, 'Parametros de paginacao invalidos')]
  procedure GetProdutos;
end;

// Ocultar um controller/action inteiro da documentacao:
[MVCPath('/health')]
[MVCSwagIgnorePath]
THealthController = class(TMVCController)
// ...`,
  },

  dmvc_jsonrpc: {
    servico_jsonrpc: `// Cap. 16 - Servico comum publicado como JSON-RPC (sem nenhum atributo)
type
  TCalculatorService = class
  public
    function Sum(const Value1, Value2: Integer): Integer;
    function Divide(const Value1, Value2: Double): Double;
    procedure LogOperation(const Description: string);
  end;

function TCalculatorService.Divide(const Value1, Value2: Double): Double;
begin
  if Value2 = 0 then
    raise EMVCJSONRPCServerError.Create(-32050, 'Divisao por zero');
  Result := Value1 / Value2;
end;

// Registro no bootstrap:
MVC.PublishObject(
  function: TObject
  begin
    Result := TCalculatorService.Create;
  end, '/calculator');
// Rotas automaticas: /calculator (dispatch), /calculator/describe,
// /calculator/proxy?language=delphi (gera client proxy pronto).`,

    cliente_jsonrpc: `// Cap. 16 - Chamando um servico JSON-RPC a partir do Delphi
var
  LExecutor: IMVCJSONRPCExecutor;
  LRequest: IJSONRPCRequest;
  LResponse: IJSONRPCResponse;
begin
  LExecutor := TMVCJSONRPCExecutor.Create('http://localhost:8080');
  LRequest := LExecutor.CreateRequest('Sum', 1); // metodo, id
  LRequest.Params.Add(10);
  LRequest.Params.Add(20);
  LResponse := LExecutor.ExecuteRequest('/calculator', LRequest);
  if not LResponse.IsError then
    WriteLn('Resultado: ', LResponse.Result.AsInteger)
  else
    WriteLn('Erro ', LResponse.Error.Code, ': ', LResponse.Error.ErrMessage);
end;

// Notification (fire-and-forget, sem resposta esperada):
LNotification := LExecutor.CreateNotification('LogOperation');
LNotification.Params.AddByName('Description', 'Soma executada pelo cliente de testes');
LExecutor.ExecuteNotification('/calculator', LNotification);`,
  },

  dmvc_websocket: {
    servidor_websocket: `// Cap. 18 - Servidor WebSocket com grupos e broadcast
var
  GWebSocketServer: TMVCWebSocketServer;
begin
  GWebSocketServer := TMVCWebSocketServer.Create(9091);
  GWebSocketServer.PeriodicMessageInterval := 30000; // heartbeat a cada 30s
  GWebSocketServer.OnClientConnect :=
    procedure(AClient: TWebSocketClient)
    begin
      AClient.JoinGroup('painel-vendas');
      AClient.Broadcast(Format('%s entrou na sala', [AClient.Username]));
    end;
  GWebSocketServer.OnMessage :=
    procedure(AClient: TWebSocketClient; const AMessage: string)
    begin
      // reenvia para o grupo, trata comandos, etc.
    end;
end;`,

    cliente_websocket: `// Cap. 18 - Cliente WebSocket com reconexao automatica
var
  LClient: TMVCWebSocketClient;
begin
  LClient := TMVCWebSocketClient.Create('ws://localhost:9091/chat');
  LClient.AutoReconnect := True;
  LClient.ReconnectInterval := 5; // segundos entre tentativas
  LClient.OnConnect :=
    procedure(Sender: TMVCWebSocketClient)
    begin
      Sender.SendText('Ola, servidor!');
    end;
  LClient.OnTextMessage :=
    procedure(Sender: TMVCWebSocketClient; const AMessage: string)
    begin
      // disparado pela thread de recebimento interna - sincronize com
      // TThread.Queue antes de tocar em componentes visuais
    end;
end;`,

    sse_endpoint: `// Cap. 18 - Server-Sent Events: endpoint de longa duracao
[MVCPath('/eventos/pedidos')]
TPedidosSSEController = class(TMVCSSEController)
protected
  function GetServerSentEvents(const LastEventID: String): TMVCSSEMessages; override;
end;

function TPedidosSSEController.GetServerSentEvents(const LastEventID: String): TMVCSSEMessages;
var
  LUltimoId: Integer;
  LPedidos: TObjectList<TPedido>;
begin
  LUltimoId := StrToIntDef(LastEventID, 0);
  LPedidos := TMVCActiveRecord.SelectRQL<TPedido>(
    Format('gt(cdpedido,%d)&sort(+cdpedido)&limit(20,0)', [LUltimoId]), []);
  // ... monta Result: TMVCSSEMessages a partir de LPedidos ...
end;

// Ou dentro de uma acao comum, com MVCProduces('text/event-stream'):
[MVCPath('/notificacoes/stream')]
[MVCHTTPMethod([httpGET])]
[MVCProduces('text/event-stream')]
procedure TNotificacaoController.GetStream;
begin
  RenderSSE(LProximaNotificacao.CdNotificacao.ToString,
            LProximaNotificacao.DsMensagem, 'notificacao');
end;`,
  },

  dmvc_views: {
    registro_view_engine: `// Cap. 19 - Registrando o motor de views (escolha UM dos tres)
fMVC := TMVCEngine.Create(Self,
  procedure(Config: TMVCConfig)
  begin
    Config[TMVCConfigKey.DefaultViewFileExtension] := 'html';
    Config[TMVCConfigKey.ViewPath] := 'templates';
    Config[TMVCConfigKey.ViewCache] := 'false'; // 'true' em producao
  end);
fMVC.AddController(TMyController);
fMVC.SetViewEngine(TMVCWebStencilsViewEngine);
// fMVC.SetViewEngine(TMVCTemplateProViewEngine);
// fMVC.SetViewEngine(TMVCMustacheViewEngine);`,

    renderizar_view: `// Cap. 19 - Passando dados para a view e renderizando
[MVCPath('/produtos')]
[MVCHTTPMethod([httpGET])]
procedure TSiteController.Index;
begin
  PushObjectToView('produtos', TProduto.All);
  Render(RenderView('produtos/index'));
end;
// Page(...) esta deprecated; prefira RenderView/RenderViews diretamente.`,

    htmx_fragmento: `// Cap. 20 - HTMX: pagina completa vs. fragmento na mesma acao
uses MVCFramework.HTMX; // habilita Context.Request.IsHTMX etc.

[MVCPath]
[MVCHTTPMethod([httpGET])]
procedure TProdutoController.Index;
var
  LFragmento: string;
begin
  LFragmento := MontaTabelaProdutosHTML(TMVCActiveRecord.All<TProduto>);
  if Context.Request.IsHTMX then
    Render(LFragmento)                      // veio de hx-get/hx-post
  else
    Render(MontaPaginaCompletaHTML(LFragmento)); // navegacao normal / F5
end;

// Disparar evento customizado no cliente apos uma acao:
Context.Response.HXTriggerClientEvent('produtoExcluido');
// Redirecionar de verdade (nao apenas trocar um pedaco do DOM):
Context.Response.HXSetRedirect('/dashboard');`,
  },

  dmvc_config: {
    dotenv_setup: `// Cap. 26 - Bootstrap do DotEnv com perfis empilhados
dotEnvConfigure(
  function: IMVCDotEnv
  begin
    Result := NewDotEnv
             .UseStrategy(TMVCDotEnvPriority.FileThenEnv)
             .UseProfile('test')
             .UseProfile('prod')
             .Build();
  end);
// A partir daqui, em qualquer unit: dotEnv.Env('chave', valorPadrao)
LServerPort := dotEnv.Env(ENV_DMVC_SERVER_PORT, DEFAULT_DMVC_SERVER_PORT);`,

    env_tipado: `// Cap. 26 - Leitura tipada com defaults (Env<T> por overload)
LPort    := dotEnv.Env('dmvc.server.port', 8080);             // Integer
LDebug   := dotEnv.Env('app.debug', False);                   // Boolean
LTimeout := dotEnv.Env('http.timeout.seconds', 30.0);         // Double (sempre en-US: 2.5, nunca 2,5)
LDbHost  := dotEnv.Env('database.host', 'localhost');         // String

// Constantes de chave centralizadas (evita strings magicas espalhadas):
const
  ENV_DMVC_SERVER_PORT = 'dmvc.server.port';
  DEFAULT_DMVC_SERVER_PORT = 8080;`,
  },

  dmvc_tls: {
    taurustls_setup: `// Cap. 27 - HTTPS com TaurusTLS (gerado pelo wizard de novo projeto)
procedure TTLSHandler.ConfigureTLS(aServer: TIdHTTPWebBrokerBridge);
var
  lTaurusTLSHandler: TTaurusTLSServerIOHandler;
begin
  lTaurusTLSHandler := TTaurusTLSServerIOHandler.Create(aServer);
  lTaurusTLSHandler.SSLOptions.Mode := sslmServer;
  lTaurusTLSHandler.DefaultCert.PublicKey  :=
    dotEnv.Env('https.cert.cacert',  'certificates\\localhost.crt');
  lTaurusTLSHandler.DefaultCert.PrivateKey :=
    dotEnv.Env('https.cert.privkey', 'certificates\\localhost.key');
  aServer.IOHandler := lTaurusTLSHandler;
end;`,

    mtls_client: `// Cap. 27 - Cliente REST com certificado mTLS
LClient := TMVCRESTClientFactory.New
  .BaseURL('https://parceiro.exemplo.com.br')
  .SetClientCertificate('C:\\certs\\cliente.pfx', 'senha-do-pfx')
  .SetValidateServerCertificateProc(
    procedure(const aSender: TObject; const aRequest: TURLRequest;
      const aCertificate: TCertificate; var aAccepted: Boolean)
    begin
      // Em producao: validar aCertificate.Issuer / aCertificate.Expiry
      aAccepted := True;
    end);
LResponse := LClient.Get('/pedidos');`,
  },
};

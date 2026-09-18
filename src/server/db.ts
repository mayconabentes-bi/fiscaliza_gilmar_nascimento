import Database from "better-sqlite3";
import path from "path";

export const DB_PATH = path.resolve(process.env.CIVIC_DB_PATH || path.join(process.cwd(), "civic_platform.db"));

function openDatabase() {
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function setupDatabase() {
  const db = openDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS municipios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      microrregiao TEXT,
      mesorregiao TEXT,
      populacao_estimada INTEGER,
      pib REAL,
      perfil_territorial TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome_completo TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      municipio TEXT NOT NULL,
      bairro TEXT NOT NULL,
      status TEXT DEFAULT 'ativo',
      consentimento_lgpd INTEGER DEFAULT 0,
      data_consentimento DATETIME,
      versao_consentimento TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS temas_agregados (
      id TEXT PRIMARY KEY,
      area_tematica TEXT NOT NULL,
      municipio TEXT NOT NULL,
      titulo_normalizado TEXT NOT NULL,
      score_recorrencia REAL DEFAULT 0.0,
      total_publicacoes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS publicacoes (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      tipo_participacao TEXT NOT NULL CHECK(tipo_participacao IN ('avaliacao', 'proposta', 'sugestao', 'relato')),
      area_tematica TEXT NOT NULL,
      municipio TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      status_moderacao TEXT DEFAULT 'pendente' CHECK(status_moderacao IN ('pendente', 'aprovado', 'rejeitado')),
      tema_agregado_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (tema_agregado_id) REFERENCES temas_agregados(id)
    );

    CREATE TABLE IF NOT EXISTS propostas_civicas (
      id TEXT PRIMARY KEY,
      autor_id TEXT NOT NULL,
      municipio TEXT NOT NULL,
      area_tematica TEXT NOT NULL,
      problema_resumido TEXT NOT NULL,
      proposta_solucao TEXT NOT NULL,
      impacto_estimado TEXT NOT NULL,
      custo_estimado TEXT,
      status TEXT DEFAULT 'ABERTA',
      nivel_apoio INTEGER DEFAULT 0,
      score_prioridade REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      latitude REAL,
      longitude REAL,
      bairro TEXT,
      foto_url TEXT,
      evidencia_texto TEXT,
      evidencia_foto_url TEXT,
      evidencia_data DATETIME,
      FOREIGN KEY (autor_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS demandas (
      id TEXT PRIMARY KEY,
      protocolo TEXT UNIQUE NOT NULL,
      nome_solicitante TEXT NOT NULL,
      contato TEXT,
      municipio TEXT NOT NULL,
      bairro TEXT,
      categoria TEXT NOT NULL,
      tipo_problema TEXT,
      descricao TEXT NOT NULL,
      prioridade TEXT DEFAULT 'MEDIA' CHECK(prioridade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
      status TEXT DEFAULT 'RECEBIDA' CHECK(status IN ('RECEBIDA', 'EM_TRIAGEM', 'ENCAMINHADA', 'EM_ANALISE', 'EM_EXECUCAO', 'CONCLUIDA', 'INDEFERIDA')),
      observacao_interna TEXT,
      usuario_id TEXT,
      aviso_privacidade_versao TEXT,
      aviso_privacidade_aceito_em DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS historico_status_demandas (
      id TEXT PRIMARY KEY,
      demanda_id TEXT NOT NULL,
      status_anterior TEXT,
      status_novo TEXT NOT NULL,
      usuario_responsavel_id TEXT,
      observacao TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (demanda_id) REFERENCES demandas(id)
    );

    CREATE TABLE IF NOT EXISTS denuncias (
      id TEXT PRIMARY KEY,
      publicacao_id TEXT NOT NULL,
      usuario_denunciante_id TEXT NOT NULL,
      motivo TEXT NOT NULL,
      status TEXT DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE', 'RESOLVIDA')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (publicacao_id) REFERENCES publicacoes(id),
      FOREIGN KEY (usuario_denunciante_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS registros_moderacao (
      id TEXT PRIMARY KEY,
      publicacao_id TEXT NOT NULL,
      decisao TEXT NOT NULL,
      justificativa TEXT NOT NULL,
      moderador_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (publicacao_id) REFERENCES publicacoes(id)
    );

    CREATE TABLE IF NOT EXISTS apoios_qualificados (
      id TEXT PRIMARY KEY,
      proposta_id TEXT NOT NULL,
      autor_id TEXT NOT NULL,
      tipo_apoio TEXT NOT NULL,
      justificativa TEXT NOT NULL,
      prioridade TEXT NOT NULL,
      municipio_autor TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (proposta_id) REFERENCES propostas_civicas(id),
      FOREIGN KEY (autor_id) REFERENCES usuarios(id),
      UNIQUE(proposta_id, autor_id)
    );

    CREATE TABLE IF NOT EXISTS comentarios_tecnicos (
      id TEXT PRIMARY KEY,
      proposta_id TEXT NOT NULL,
      autor_id TEXT NOT NULL,
      tipo_autor TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (proposta_id) REFERENCES propostas_civicas(id)
    );

    CREATE TABLE IF NOT EXISTS logs_auditoria (
      id TEXT PRIMARY KEY,
      entidade TEXT NOT NULL,
      entidade_id TEXT NOT NULL,
      acao TEXT NOT NULL,
      usuario_responsavel_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dados_transparencia (
      id TEXT PRIMARY KEY,
      entidade TEXT NOT NULL,
      tipo_dado TEXT NOT NULL,
      valor REAL NOT NULL,
      descricao TEXT NOT NULL,
      data_referencia DATETIME NOT NULL,
      link_origem TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS indicadores_saude_datasus (
      id TEXT PRIMARY KEY,
      municipio TEXT NOT NULL,
      cod_ibge TEXT,
      indicador TEXT NOT NULL,
      valor REAL NOT NULL,
      periodo TEXT NOT NULL,
      fonte_dados TEXT DEFAULT 'DATASUS',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_control (
      service_name TEXT PRIMARY KEY,
      last_sync DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agradecimentos_propostas (
      id TEXT PRIMARY KEY,
      proposta_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      mensagem TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (proposta_id) REFERENCES propostas_civicas(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      UNIQUE(proposta_id, usuario_id, tipo)
    );

    CREATE INDEX IF NOT EXISTS idx_demandas_protocolo ON demandas(protocolo);
    CREATE INDEX IF NOT EXISTS idx_demandas_status ON demandas(status);
    CREATE INDEX IF NOT EXISTS idx_demandas_municipio ON demandas(municipio);
    CREATE INDEX IF NOT EXISTS idx_demandas_categoria ON demandas(categoria);
    CREATE INDEX IF NOT EXISTS idx_demandas_tipo_problema ON demandas(tipo_problema);
    CREATE INDEX IF NOT EXISTS idx_historico_demandas_demanda ON historico_status_demandas(demanda_id);
  `);

  try { db.exec(`ALTER TABLE usuarios ADD COLUMN versao_consentimento TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE demandas ADD COLUMN aviso_privacidade_versao TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE demandas ADD COLUMN aviso_privacidade_aceito_em DATETIME;`); } catch (_) {}
  try { db.exec(`ALTER TABLE demandas ADD COLUMN tipo_problema TEXT;`); } catch (_) {}

  const propostasColumns = [
    "latitude REAL",
    "longitude REAL",
    "bairro TEXT",
    "foto_url TEXT",
    "evidencia_texto TEXT",
    "evidencia_foto_url TEXT",
    "evidencia_data DATETIME"
  ];
  for (const col of propostasColumns) {
    try { db.exec(`ALTER TABLE propostas_civicas ADD COLUMN ${col};`); } catch (_) {}
  }

  return db;
}

export function getDb() {
  return openDatabase();
}

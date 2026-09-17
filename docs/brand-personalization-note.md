# Personalização visual

## Bloco 1 — Base visual

- paleta institucional baseada na marca fornecida;
- azul como estrutura visual e laranja como cor de ação;
- marca aplicada de forma compacta no shell público e no login;
- header, footer, navegação pública/privada e login atualizados;
- nenhuma alteração de banco, autenticação, regras de negócio ou APIs;
- contrato de CI para preservar a identidade visual e a ausência de cargo político como texto de interface.

A imagem-fonte permanece preservada em `public/brand/gilmar-nascimento-oficial.png`. A interface usa um recorte visual por CSS apenas da parte superior (nome + elemento gráfico), sem alterar o arquivo original.

## Bloco 2 — Páginas públicas

Páginas personalizadas, na ordem do fluxo público:

1. Início (`/`)
2. Registrar (`/demandas/nova`)
3. Acompanhar (`/protocolo`)
4. Como funciona (`/metodologia`)
5. Sobre (`/transparencia`)

Diretrizes aplicadas:

- identidade azul/laranja e assinatura visual consistentes;
- uso do conceito “Você cuidando da cidade” como mensagem cívica de produto;
- conteúdo orientado a registro, protocolo, acompanhamento, transparência e privacidade;
- manutenção das advertências de que o FISCALIZE não substitui canais oficiais;
- ausência de promessas de resultado, pedido de apoio ou conteúdo eleitoral nas páginas personalizadas;
- preservação de endpoints, regras de idade, CEP, evidências, privacidade, geração de protocolo e consulta de histórico.

## Bloco 3 — Área privada

Módulos abrangidos:

1. Painel (`/dashboard`)
2. Triagem (`/admin/demandas`)
3. Radar Territorial (`/radar-manaus`)
4. Estratégia (`/estrategia-2028`)
5. Governança (`/admin`)
6. Auditoria (`/admin/audit`)

Diretrizes aplicadas:

- shell privado com identificação de acesso autenticado e módulo ativo;
- azul institucional como estrutura, navegação e identidade do produto;
- laranja reservado a ações principais e acentos de marca;
- verde, amarelo e vermelho preservados como cores semânticas de sucesso, alerta e risco;
- Painel, Governança e Auditoria revisados diretamente;
- Triagem, Radar e Estratégia harmonizados com estilos escopados por rota, reduzindo o risco de regressão em módulos extensos;
- nenhuma alteração de autenticação, autorização, endpoints, persistência, moderação, evidências ou inteligência territorial;
- contrato de CI ampliado para verificar shell privado e preservar os principais endpoints funcionais de cada módulo.

## Bloco 4 — Favicon e app icon

Assets adicionados:

- `public/favicon.svg` para navegadores modernos;
- `public/app-icon-192.png` e `public/app-icon-512.png` para instalação/web app;
- `public/apple-touch-icon.png` para atalhos em dispositivos Apple;
- `public/site.webmanifest` com nome, cores, escopo e suporte a ícone `maskable`.

Diretrizes aplicadas:

- símbolo simplificado do FISCALIZE: radar branco sobre azul institucional, com ponto e varredura em laranja;
- ausência de texto, nome pessoal ou cargo dentro do ícone, preservando legibilidade em tamanhos pequenos;
- área útil central respeitada para recortes de launcher em diferentes formatos;
- `index.html` passa a declarar favicon, touch icon, manifest e título para instalação;
- contrato de CI ampliado para verificar referências, paleta, manifest e presença dos PNGs.

## Bloco 5 — Relatórios e PDFs

A tela autenticada de relatórios (`/relatorios`) foi alinhada ao restante do núcleo privado sem alterar o endpoint `/api/relatorios/gerar` nem a lógica de filtros e seleção de colunas.

Diretrizes aplicadas:

- cabeçalho da página com identidade institucional e aviso de área autenticada;
- filtros, seleção de colunas, ações e prévia reorganizados para mobile e desktop;
- descrição permanece fora da exportação padrão quando nenhuma seleção manual de colunas é feita;
- prévia continua limitada visualmente aos primeiros 100 registros, enquanto PDF e CSV usam todo o conjunto retornado pelo serviço;
- nomes de arquivos passam a usar o prefixo `fiscalize_relatorio_demandas_`;
- PDF em A4 paisagem com cabeçalho azul, acento laranja, total de registros, filtros ativos e horário de geração;
- tabela do PDF com cabeçalho repetido, linhas alternadas, quebra controlada e paginação;
- rodapé do PDF identifica o documento como privado e orienta compartilhamento apenas para finalidade administrativa legítima;
- nenhum dado novo é buscado, enriquecido ou exposto pela personalização visual.

## Bloco 6 — Validação visual final desktop/mobile

A validação final consolida os contratos que já acompanham o rollout inteiro:

- shell público e privado preservam navegação e hierarquia responsivas;
- páginas públicas continuam protegidas pela matriz de dispositivos e orçamento mobile existentes no CI;
- relatórios agora possuem marcadores explícitos de layout responsivo, filtros empilháveis e tabela com rolagem horizontal controlada;
- CTAs mantêm áreas de toque adequadas e ações de exportação se reorganizam em telas estreitas;
- build de produção, Brand UI contract, Responsive device matrix e Mobile performance budget permanecem gates obrigatórios;
- preview Vercel é validado antes do merge e o deployment da `main` é conferido após a integração.

O rollout visual fica encerrado somente após CI completo, preview Vercel e deployment de produção concluírem com sucesso.
